import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  aggregaPerComune,
  conCache,
  costruisciIndice,
  daGeoJson,
  geocoderNominatim,
  risolviZona,
  trovaZona,
  valuta,
  ZONA_COMUNE,
  type GeoJsonFeatureCollection,
  type QuotazioneOmi,
} from "@qdr/core";

import { cacheGeocodingSqlite } from "./geocodeCache.js";
import { DATA_DIR } from "./paths.js";
import { stimaDaComparabili } from "./comparabili.js";
import { importaComparabili, listComparabili, salvaGeoComparabile, type EsitoImportComparabili } from "./comparabiliStore.js";
import { famigliaDi, moltiplicatori } from "./esiti.js";
import { ESITI_AZIONABILI, prezzoMaxQre, valoreMqDaStime } from "./qre.js";
import { listAllRows, rowToImmobileNorm, salvaArricchimentoGeo, salvaPrezzoMaxQre, salvaValutazione } from "./repository.js";

const ZONE_OMI_PATH = join(DATA_DIR, "zone_omi.geojson");
const QUOTAZIONI_PATH = join(DATA_DIR, "quotazioni_omi.json");

interface QuotazioneRecord extends QuotazioneOmi {
  comuneCod: string;
  zona: string;
  tipologia: string;
}

async function caricaQuotazioni(): Promise<Map<string, QuotazioneOmi> | null> {
  if (!existsSync(QUOTAZIONI_PATH)) return null;
  const raw = JSON.parse(await readFile(QUOTAZIONI_PATH, "utf-8")) as QuotazioneRecord[];
  const mappa = new Map<string, QuotazioneOmi>();
  for (const r of raw) {
    mappa.set(`${r.comuneCod}|${r.zona}|${r.tipologia}`, {
      vendMin: r.vendMin, vendMax: r.vendMax, semestre: r.semestre,
    });
  }
  return aggregaPerComune(mappa);
}

/** Risoluzione della zona a partire da coordinate gia' note, senza geocoding. */
function daCoordinate(
  indice: Parameters<typeof trovaZona>[0],
  lat: number,
  lon: number,
  comuneCod: string | null,
  precisioneGeo: string,
): { zonaOmi: string | null; livello: "zona" | "comune"; precisioneGeo: string; lat: number; lon: number; motivo?: string } {
  const zona = trovaZona(indice, { lat, lon }, comuneCod);
  return zona
    ? { zonaOmi: zona.zona, livello: "zona", precisioneGeo, lat, lon }
    : {
        zonaOmi: ZONA_COMUNE,
        livello: "comune",
        precisioneGeo,
        lat,
        lon,
        motivo: "coordinate note ma fuori da ogni perimetro OMI caricato",
      };
}

/**
 * Le coordinate del lotto, solo se affidabili. Un geocoding impreciso restituisce
 * il centro del comune o della localita': cercarci intorno comparabili entro
 * 500 m vorrebbe dire confrontare il lotto con un quartiere qualunque. In quel
 * caso si torna alla zona OMI, o a nulla.
 */
function posizionePrecisa(
  esito: { lat?: number; lon?: number; precisioneGeo: string },
  riga: { lat: number | null; lon: number | null },
): { lat: number | null; lon: number | null } {
  const lat = esito.lat ?? riga.lat;
  const lon = esito.lon ?? riga.lon;
  const precisa = esito.precisioneGeo === "civico" || esito.precisioneGeo === "strada";
  return precisa && lat != null && lon != null ? { lat, lon } : { lat: null, lon: null };
}

export interface EsitoEnrich {
  eseguito: boolean;
  motivo?: string;
  zoneCaricate?: number;
  zoneScartate?: number;
  immobiliGeocodificati?: number;
  immobiliValutati?: number;
  /** CSV dei comparabili letti da data/comparabili a questo giro. */
  comparabili?: EsitoImportComparabili & { localizzati: number; totali: number };
  /** Immobili il cui valore di uscita viene dai comparabili invece che dall'OMI. */
  immobiliConComparabili?: number;
  /** Immobili che passano il Gate 0 QRE, binario B (esito "passa" o "al_limite"). */
  immobiliQre?: number;
  valutazioneSaltata?: string;
}

/**
 * Arricchimento opzionale: zona OMI (point-in-polygon) + valutazione triangolata.
 * Richiede due file preparati a mano una tantum (vedi README):
 *   - data/zone_omi.geojson  (perimetri OMI, riproiettati EPSG:4326)
 *   - data/quotazioni_omi.json (quotazioni min/max per comune+zona+tipologia)
 * Se mancano, esce con un messaggio chiaro invece di fallire: lo scraping e
 * la dashboard restano utilizzabili anche senza questo passo.
 */
export async function eseguiEnrich(): Promise<EsitoEnrich> {
  if (!existsSync(ZONE_OMI_PATH)) {
    return {
      eseguito: false,
      motivo: `${ZONE_OMI_PATH} non trovato. Scarica i perimetri OMI dall'area riservata ` +
        `dell'Agenzia delle Entrate e convertili con: ` +
        `ogr2ogr -f GeoJSON -t_srs EPSG:4326 data/zone_omi.geojson ZONE_OMI.shp`,
    };
  }

  const fc = JSON.parse(await readFile(ZONE_OMI_PATH, "utf-8")) as GeoJsonFeatureCollection;
  const { zone, scartate, motivi } = daGeoJson(fc);
  if (scartate > 0) {
    console.warn(`enrich: ${scartate} feature OMI scartate:`, motivi);
  }
  const indice = costruisciIndice(zone);

  const geocoder = conCache(
    geocoderNominatim({ userAgent: "QuantumDealRadar/0.1 (contatto: faldutogianluca@gmail.com)" }),
    cacheGeocodingSqlite(),
  );

  // --- comparabili: import dei CSV, poi posizione di quelli che non ce l'hanno ancora
  const importComparabili = await importaComparabili();
  let localizzati = 0;
  for (const c of listComparabili()) {
    if (c.lat != null && c.lon != null && c.zonaOmi) continue;
    if (c.lat != null && c.lon != null) {
      salvaGeoComparabile(c.id, c.lat, c.lon, trovaZona(indice, { lat: c.lat, lon: c.lon }, null)?.zona ?? null);
      localizzati++;
      continue;
    }
    if (c.geoTentato || !c.indirizzo || !c.comune) continue;
    const g = await risolviZona(
      { fonte: c.fonte, idEsterno: String(c.id), indirizzoRaw: c.indirizzo, comune: c.comune },
      indice,
      geocoder,
    );
    // solo una posizione precisa: un centroide comunale metterebbe il comparabile
    // vicino a immobili che non c'entrano
    const preciso = g.livello === "zona";
    salvaGeoComparabile(c.id, preciso ? g.lat ?? null : null, preciso ? g.lon ?? null : null, preciso ? g.zonaOmi : null);
    if (preciso) localizzati++;
  }
  const comparabili = listComparabili();
  let conComparabili = 0;

  const righe = listAllRows();
  let geocodificati = 0;

  const quotazioni = await caricaQuotazioni();
  let valutati = 0;
  let passanoQre = 0;
  // letti una volta per ciclo: gli esiti non cambiano durante un enrich
  const molt = moltiplicatori();

  for (const riga of righe) {
    const imm = rowToImmobileNorm(riga);

    // risolviZona() tratta qualunque zonaOmi valorizzata come gia' risolta. Un enrich
    // precedente puo' pero' aver salvato il sentinel di ripiego comunale ("*"): rileggerlo
    // cosi' com'e' lo promuoverebbe a zona risolta, perdendo il flag di ripiego. Un ripiego
    // va quindi ritentato da zero: i perimetri o il geocoding possono nel frattempo
    // essere migliorati.
    const daRisolvere =
      riga.zona_omi === ZONA_COMUNE || riga.livello_zona === "comune" ? { ...imm, zonaOmi: null } : imm;

    // Alcuni portali pubblicano gia' le coordinate nella pagina. risolviZona()
    // geocodificherebbe comunque l'indirizzo: qui si usa il punto esatto, evitando
    // una richiesta a Nominatim, il suo limite di una al secondo e l'imprecisione
    // di un indirizzo interpretato.
    // Solo coordinate precise: quelle della pagina (precisione ancora vuota) o di un
    // geocoding al civico o alla strada. Il centro di un comune salvato da un geocoding
    // impreciso non va promosso a punto esatto, ne' per la zona ne' per i comparabili.
    const precisioneSalvata = riga.precisione_geo;
    const coordinatePrecise =
      riga.lat != null && riga.lon != null &&
      (precisioneSalvata == null || precisioneSalvata === "civico" || precisioneSalvata === "strada");
    const esito =
      daRisolvere.zonaOmi == null && coordinatePrecise
        ? daCoordinate(indice, riga.lat!, riga.lon!, riga.comune_cod, precisioneSalvata ?? "civico")
        : await risolviZona(daRisolvere, indice, geocoder);
    const scrittaGeo = salvaArricchimentoGeo(riga.id, esito);
    if (scrittaGeo && esito.livello === "zona") geocodificati++;

    // Il Gate 0 QRE si ricalcola sempre: senza fonti di valore esce "dati_mancanti",
    // ma non lascia sulla riga i numeri di un calcolo vecchio.
    {
      let omiMaxMq: number | null = null;
      if (quotazioni) {
        const arricchito = { ...imm, zonaOmi: esito.zonaOmi, livelloZona: esito.livello };
        const v = valuta(arricchito, { quotazioni, strategia: "flip" });
        if (salvaValutazione(riga.id, v)) valutati++;
        omiMaxMq = valoreMqDaStime(v.stime);
      }

      const famiglia = famigliaDi(riga);
      const stimaComps =
        imm.mq && comparabili.length
          ? stimaDaComparabili(
              { ...posizionePrecisa(esito, riga), zonaOmi: esito.zonaOmi, mq: imm.mq },
              comparabili,
            )
          : null;
      const qre = prezzoMaxQre({
        comparabili: stimaComps,
        mq: imm.mq,
        prezzo: imm.prezzo,
        valoreMq: omiMaxMq,
        zonaRisolta: esito.livello === "zona",
        giudiziaria: famiglia === "giudiziaria",
        trattativa: famiglia === "trattativa",
        moltiplicatore: molt[famiglia],
      });
      if (salvaPrezzoMaxQre(riga.id, qre) && ESITI_AZIONABILI.includes(qre.esito)) passanoQre++;
      if (qre.valoreFonte === "comparabili") conComparabili++;
    }
  }

  return {
    eseguito: true,
    zoneCaricate: zone.length,
    zoneScartate: scartate,
    immobiliGeocodificati: geocodificati,
    immobiliValutati: quotazioni ? valutati : undefined,
    immobiliQre: quotazioni || comparabili.length ? passanoQre : undefined,
    comparabili: { ...importComparabili, localizzati, totali: comparabili.length },
    immobiliConComparabili: comparabili.length ? conComparabili : undefined,
    valutazioneSaltata: quotazioni
      ? undefined
      : `${QUOTAZIONI_PATH} non trovato: zone OMI risolte, ma valutazione saltata (vedi README per il formato atteso).`,
  };
}
