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
  valuta,
  type GeoJsonFeatureCollection,
  type QuotazioneOmi,
} from "@qdr/core";

import { cacheGeocodingSqlite } from "./geocodeCache.js";
import { DATA_DIR } from "./paths.js";
import { chiaveDedup, listAllAsImmobileNorm, salvaArricchimentoGeo, salvaValutazione } from "./repository.js";

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

export interface EsitoEnrich {
  eseguito: boolean;
  motivo?: string;
  zoneCaricate?: number;
  zoneScartate?: number;
  immobiliGeocodificati?: number;
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

  const immobili = listAllAsImmobileNorm();
  let geocodificati = 0;

  const quotazioni = await caricaQuotazioni();
  let valutati = 0;

  for (const imm of immobili) {
    const chiave = chiaveDedup(imm);
    const esito = await risolviZona(imm, indice, geocoder);
    salvaArricchimentoGeo(chiave, esito);
    if (esito.livello === "zona") geocodificati++;

    if (quotazioni) {
      const arricchito = { ...imm, zonaOmi: esito.zonaOmi, livelloZona: esito.livello };
      const v = valuta(arricchito, { quotazioni, strategia: "flip" });
      salvaValutazione(chiave, v);
      valutati++;
    }
  }

  return {
    eseguito: true,
    zoneCaricate: zone.length,
    zoneScartate: scartate,
    immobiliGeocodificati: geocodificati,
    immobiliValutati: quotazioni ? valutati : undefined,
    valutazioneSaltata: quotazioni
      ? undefined
      : `${QUOTAZIONI_PATH} non trovato: zone OMI risolte, ma valutazione saltata (vedi README per il formato atteso).`,
  };
}
