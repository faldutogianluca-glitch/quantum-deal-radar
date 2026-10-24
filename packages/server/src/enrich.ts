import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

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
import { caricaComuni, QUOTAZIONI_PATH, risolviComune, tipologiaDaSottotipo, ZONE_OMI_PATH } from "./omi.js";
import { listAllRows, rowToImmobileNorm, salvaArricchimentoGeo, salvaComuneCod, salvaValutazione } from "./repository.js";

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
): { zonaOmi: string | null; livello: "zona" | "comune"; precisioneGeo: string; lat: number; lon: number; motivo?: string } {
  const zona = trovaZona(indice, { lat, lon }, comuneCod);
  return zona
    ? { zonaOmi: zona.zona, livello: "zona", precisioneGeo: "civico", lat, lon }
    : {
        zonaOmi: ZONA_COMUNE,
        livello: "comune",
        precisioneGeo: "civico",
        lat,
        lon,
        motivo: "coordinate note ma fuori da ogni perimetro OMI caricato",
      };
}

export interface EsitoEnrich {
  eseguito: boolean;
  motivo?: string;
  zoneCaricate?: number;
  zoneScartate?: number;
  immobiliGeocodificati?: number;
  /** comuni agganciati al codice catastale in questa esecuzione (serve a trovare la quotazione) */
  comuniRisolti?: number;
  immobiliValutati?: number;
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
      motivo: `${ZONE_OMI_PATH} non trovato. Scarica i perimetri OMI con 'npm run omi -- perimetri' ` +
        `(dal servizio pubblico GEOPOI dell'Agenzia delle Entrate), oppure convertili da uno shapefile con: ` +
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

  const righe = listAllRows();
  let geocodificati = 0;

  const quotazioni = await caricaQuotazioni();
  let valutati = 0;

  // Il nome del comune c'e' quasi sempre, il codice catastale quasi mai: e' il
  // codice pero' che aggancia la quotazione. L'anagrafica ISTAT fa il ponte.
  const comuni = await caricaComuni();
  let comuniRisolti = 0;

  for (const riga of righe) {
    let comuneCod = riga.comune_cod;
    if (!comuneCod && riga.comune && comuni) {
      const c = risolviComune(riga.comune, comuni);
      if (c && salvaComuneCod(riga.id, c.cod)) {
        comuneCod = c.cod;
        comuniRisolti++;
      }
    }
    const imm = {
      ...rowToImmobileNorm(riga),
      comuneCod,
      tipologiaOmi: riga.tipologia_omi ?? tipologiaDaSottotipo(riga.sottotipo_asset, riga.titolo),
    };

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
    const esito =
      daRisolvere.zonaOmi == null && riga.lat != null && riga.lon != null
        ? daCoordinate(indice, riga.lat, riga.lon, comuneCod)
        : await risolviZona(daRisolvere, indice, geocoder);
    const scrittaGeo = salvaArricchimentoGeo(riga.id, esito);
    if (scrittaGeo && esito.livello === "zona") geocodificati++;

    if (quotazioni) {
      const arricchito = { ...imm, zonaOmi: esito.zonaOmi, livelloZona: esito.livello };
      const v = valuta(arricchito, { quotazioni, strategia: "flip" });
      if (salvaValutazione(riga.id, v)) valutati++;
    }
  }

  return {
    eseguito: true,
    zoneCaricate: zone.length,
    zoneScartate: scartate,
    immobiliGeocodificati: geocodificati,
    comuniRisolti,
    immobiliValutati: quotazioni ? valutati : undefined,
    valutazioneSaltata: quotazioni
      ? undefined
      : `${QUOTAZIONI_PATH} non trovato: zone OMI risolte, ma valutazione saltata (vedi README per il formato atteso).`,
  };
}
