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
import type { QuotazioneRecord } from "./omi.js";
import { DATA_DIR } from "./paths.js";
import { chiaveZonaComparabili, stimaDaComparabili } from "./comparabili.js";
import { importaComparabili, listComparabili, salvaGeoComparabile, type EsitoImportComparabili } from "./comparabiliStore.js";
import { famigliaDi, moltiplicatori } from "./esiti.js";
import { ESITI_AZIONABILI, motivoFuoriPerimetro, prezzoMaxQre, valoreMqDaStime, tipologiaOmiDa } from "./qre.js";
import { listAllRows, rowToImmobileNorm, salvaArricchimentoGeo, salvaPrezzoMaxQre, salvaValutazione } from "./repository.js";

const ZONE_OMI_PATH = join(DATA_DIR, "zone_omi.geojson");
const QUOTAZIONI_PATH = join(DATA_DIR, "quotazioni_omi.json");

/** Quotazioni per la valutazione (stato NORMALE), e a parte il minimo dello stato OTTIMO per il Gate 0. */
async function caricaQuotazioni(): Promise<{
  mappa: Map<string, QuotazioneOmi>;
  ottimo: Map<string, number>;
  codiciComune: Map<string, string>;
} | null> {
  if (!existsSync(QUOTAZIONI_PATH)) return null;
  const raw = JSON.parse(await readFile(QUOTAZIONI_PATH, "utf-8")) as QuotazioneRecord[];
  const mappa = new Map<string, QuotazioneOmi>();
  const ottimo = new Map<string, number>();
  const codiciComune = new Map<string, string>();
  for (const r of raw) {
    const chiave = `${r.comuneCod}|${r.zona}|${r.tipologia}`;
    mappa.set(chiave, { vendMin: r.vendMin, vendMax: r.vendMax, semestre: r.semestre });
    if (r.vendMinOttimo) ottimo.set(chiave, r.vendMinOttimo);
    if (r.comune) codiciComune.set(nomeComune(r.comune), r.comuneCod);
  }
  return { mappa: aggregaPerComune(mappa), ottimo, codiciComune };
}

/** "Milano", "MILANO ", "milano" sono lo stesso comune. */
/**
 * Nome del comune confrontabile fra fonti: il PVP scrive "Cassano d’Adda" o
 * "Cantù", le forniture dell'Agenzia "CASSANO D'ADDA" e "CANTU'".
 */
export const nomeComune = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘`´]/g, "'")
    .toUpperCase()
    .replace(/([AEIOU])'(?=\s|$)/g, "$1")
    .replace(/\s*'\s*/g, "'")
    .replace(/\s+/g, " ")
    .trim();

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
  /** Passerebbero il Gate 0, ma il termine per le offerte e' gia' passato. */
  immobiliQreScaduti?: number;
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
  // La zona di un comparabile si salva come "comune|zona": i codici si ripetono fra
  // comuni (R2 c'e' a Milano e a Rozzano), e con i perimetri dell'hinterland un lotto
  // di Rozzano senza coordinate verrebbe stimato con i comparabili di Milano.
  const chiaveZona = (lat: number, lon: number) => {
    const z = trovaZona(indice, { lat, lon }, null);
    return z ? chiaveZonaComparabili(z.comuneCod, z.zona) : null;
  };
  for (const c of listComparabili()) {
    // una zona senza comune viene da una versione precedente: si ricalcola
    if (c.lat != null && c.lon != null && c.zonaOmi?.includes("|")) continue;
    if (c.lat != null && c.lon != null) {
      salvaGeoComparabile(c.id, c.lat, c.lon, chiaveZona(c.lat, c.lon));
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
    const zona = preciso && g.lat != null && g.lon != null ? chiaveZona(g.lat, g.lon) : null;
    salvaGeoComparabile(c.id, preciso ? g.lat ?? null : null, preciso ? g.lon ?? null : null, zona);
    if (preciso) localizzati++;
  }
  const comparabili = listComparabili();
  let conComparabili = 0;

  const righe = listAllRows();
  let geocodificati = 0;

  const caricate = await caricaQuotazioni();
  const quotazioni = caricate?.mappa ?? null;
  let valutati = 0;
  let passanoQre = 0;
  let passanoScaduti = 0;
  // la data di oggi a Roma: in UTC fra mezzanotte e le due i lotti di ieri sembrerebbero aperti
  const oggi = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" }).format(new Date());
  // letti una volta per ciclo: gli esiti non cambiano durante un enrich
  const molt = moltiplicatori();

  for (const riga of righe) {
    // I portali scrivono il nome del comune, non il codice catastale che le quotazioni
    // OMI usano come chiave: senza codice nessuna quotazione verrebbe mai trovata. Si
    // prende dal nome, se le quotazioni lo conoscono, e poi dalla zona in cui cade il punto.
    const codiceDaNome = riga.comune ? caricate?.codiciComune.get(nomeComune(riga.comune)) ?? null : null;
    const imm = { ...rowToImmobileNorm(riga), comuneCod: riga.comune_cod ?? codiceDaNome };

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
        ? daCoordinate(indice, riga.lat!, riga.lon!, imm.comuneCod, precisioneSalvata ?? "civico")
        : await risolviZona(daRisolvere, indice, geocoder);
    const lat = esito.lat ?? riga.lat;
    const lon = esito.lon ?? riga.lon;
    if (esito.livello === "zona" && lat != null && lon != null) {
      imm.comuneCod = trovaZona(indice, { lat, lon }, imm.comuneCod)?.comuneCod ?? imm.comuneCod;
    }
    // la quotazione della tipologia giusta, se la zona la pubblica; altrimenti la prevalente
    const tipologia = tipologiaOmiDa(riga.sottotipo_asset);
    imm.tipologiaOmi =
      tipologia && quotazioni?.has(`${imm.comuneCod}|${esito.zonaOmi}|${tipologia}`) ? tipologia : "Abitazioni civili";
    const scrittaGeo = salvaArricchimentoGeo(riga.id, esito, imm.comuneCod, imm.tipologiaOmi ?? null);
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
      // OTTIMO solo con la zona risolta: l'aggregato comunale mescolerebbe il centro con la periferia
      const omiOttimoMq =
        esito.livello === "zona" && imm.comuneCod
          ? caricate?.ottimo.get(`${imm.comuneCod}|${esito.zonaOmi}|${imm.tipologiaOmi ?? "Abitazioni civili"}`) ?? null
          : null;

      const famiglia = famigliaDi(riga);
      const stimaComps =
        imm.mq && comparabili.length
          ? stimaDaComparabili(
              {
                ...posizionePrecisa(esito, riga),
                zonaOmi: esito.livello === "zona" && imm.comuneCod ? chiaveZonaComparabili(imm.comuneCod, esito.zonaOmi) : null,
                mq: imm.mq,
              },
              comparabili,
            )
          : null;
      const qre = prezzoMaxQre({
        comparabili: stimaComps,
        mq: imm.mq,
        prezzo: imm.prezzo,
        valoreMq: omiMaxMq,
        valoreMqOttimo: omiOttimoMq,
        zonaRisolta: esito.livello === "zona",
        giudiziaria: famiglia === "giudiziaria",
        trattativa: famiglia === "trattativa",
        moltiplicatore: molt[famiglia],
        fuoriPerimetro: motivoFuoriPerimetro(riga.titolo, riga.sottotipo_asset),
      });
      // un lotto con il termine passato puo' passare il Gate 0, ma non ci si puo' piu' muovere:
      // si conta a parte, perche' "passano" deve dire su cosa agire adesso
      const termine = imm.termineOfferte ?? imm.dataAsta ?? null;
      if (salvaPrezzoMaxQre(riga.id, qre) && ESITI_AZIONABILI.includes(qre.esito)) {
        if (termine && termine < oggi) passanoScaduti++;
        else passanoQre++;
      }
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
    immobiliQreScaduti: quotazioni || comparabili.length ? passanoScaduti : undefined,
    comparabili: { ...importComparabili, localizzati, totali: comparabili.length },
    immobiliConComparabili: comparabili.length ? conComparabili : undefined,
    valutazioneSaltata: quotazioni
      ? undefined
      : `${QUOTAZIONI_PATH} non trovato: zone OMI risolte, ma valutazione saltata (vedi README per il formato atteso).`,
  };
}
