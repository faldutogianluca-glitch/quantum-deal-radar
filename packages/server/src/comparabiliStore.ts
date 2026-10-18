import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { parseCsv, parseDataIt, parseImporto, trovaColonna, type RigaCsv } from "@qdr/scrapers";

import { statoDaTesto, type Comparabile } from "./comparabili.js";
import { db } from "./db.js";
import { DATA_DIR } from "./paths.js";

/**
 * Archivio dei comparabili e loro importazione.
 *
 * I comparabili arrivano come CSV in data/comparabili/, non da uno scraper: i
 * grandi portali di annunci vietano la raccolta automatica nelle condizioni
 * d'uso, e il registro delle fonti non apre una fonte vietata. Le strade
 * percorribili sono gli export con licenza (servizi dati dei portali, agenzie
 * partner), le schede raccolte a mano su una microzona prima di un'offerta, e i
 * rogiti propri. La cartella non e' versionata: contiene dati di terzi.
 */

export const CARTELLA_COMPARABILI = join(DATA_DIR, "comparabili");

db.exec(`
CREATE TABLE IF NOT EXISTS comparabili (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chiave TEXT NOT NULL UNIQUE,
  fonte TEXT NOT NULL,
  indirizzo TEXT,
  comune TEXT,
  lat REAL,
  lon REAL,
  zona_omi TEXT,
  -- 1 quando la posizione e' gia' stata cercata: un indirizzo che non si risolve
  -- non va rigeocodificato a ogni enrich
  geo_tentato INTEGER NOT NULL DEFAULT 0,
  mq REAL NOT NULL,
  prezzo REAL NOT NULL,
  tipo_prezzo TEXT NOT NULL,
  stato TEXT,
  data TEXT,
  url TEXT,
  file TEXT,
  importato_il TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_comparabili_zona ON comparabili(zona_omi);
`);

/** Nomi di colonna riconosciuti, in ordine di preferenza. */
const COLONNE: Record<string, string[]> = {
  codice: ["Codice", "Id", "Riferimento", "Rif"],
  fonte: ["Fonte", "Portale", "Origine"],
  indirizzo: ["Indirizzo", "Via"],
  comune: ["Comune", "Citta"],
  lat: ["Lat", "Latitudine"],
  lon: ["Lon", "Lng", "Longitudine"],
  mq: ["Superficie", "Mq", "Metri quadri", "Superficie commerciale"],
  prezzo: ["Prezzo", "Prezzo richiesto", "Prezzo di vendita", "Valore"],
  tipoPrezzo: ["Tipo prezzo", "Tipo"],
  stato: ["Stato", "Condizioni", "Stato immobile", "Stato conservativo"],
  data: ["Data", "Data annuncio", "Data rogito", "Data pubblicazione"],
  url: ["Url", "Link"],
};

export interface EsitoImportComparabili {
  file: number;
  importati: number;
  aggiornati: number;
  scartati: { motivo: string; n: number }[];
  /** Colonne presenti che nessun campo usa: dice a chi prepara il file cosa non sta arrivando. */
  colonneIgnorate: string[];
}

function dataIso(raw: string): string | null {
  // l'ISO va riconosciuto prima del parser italiano, che su "2026-05-12"
  // leggerebbe "26-05-12" come 26 maggio 2012
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw.trim());
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : parseDataIt(raw);
}

/** Le coordinate hanno il punto decimale anche negli export italiani, a volte la virgola. */
function coordinata(raw: string | undefined): number | null {
  if (!raw?.trim()) return null;
  const n = Number(raw.trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function rigaInComparabile(
  riga: RigaCsv,
  mappa: Record<string, string | null>,
  file: string,
): { ok: true; c: Omit<Comparabile, "id" | "zonaOmi"> & { chiave: string } } | { ok: false; motivo: string } {
  const v = (campo: string) => (mappa[campo] ? riga[mappa[campo]!] ?? "" : "");
  const mq = parseImporto(v("mq"));
  const prezzo = parseImporto(v("prezzo"));
  if (!mq || mq < 15) return { ok: false, motivo: "superficie mancante o non plausibile" };
  if (!prezzo || prezzo < 10_000) return { ok: false, motivo: "prezzo mancante o non plausibile" };

  const fonte = v("fonte") || file.replace(/\.csv$/i, "");
  const indirizzo = v("indirizzo") || null;
  const comune = v("comune") || null;
  const codice = v("codice");
  const chiave = codice ? `${fonte}|${codice}` : `${fonte}|${indirizzo}|${comune}|${mq}|${prezzo}`.toUpperCase();
  return {
    ok: true,
    c: {
      chiave, fonte, indirizzo, comune,
      lat: coordinata(v("lat")), lon: coordinata(v("lon")),
      mq, prezzo,
      tipoPrezzo: /rogit|compravend|vendut|atto/i.test(v("tipoPrezzo")) ? "rogito" : "richiesta",
      stato: statoDaTesto(v("stato")),
      data: v("data") ? dataIso(v("data")) : null,
      url: v("url") || null,
    },
  };
}

const CAMBIA_INDIRIZZO =
  "(excluded.indirizzo IS NOT comparabili.indirizzo OR excluded.comune IS NOT comparabili.comune)";
const CAMBIA_POSIZIONE =
  `((excluded.lat IS NOT NULL AND (excluded.lat IS NOT comparabili.lat OR excluded.lon IS NOT comparabili.lon))
    OR (excluded.lat IS NULL AND ${CAMBIA_INDIRIZZO}))`;

const UPSERT = db.prepare(`
  INSERT INTO comparabili (chiave, fonte, indirizzo, comune, lat, lon, mq, prezzo, tipo_prezzo, stato, data, url, file, importato_il)
  VALUES (@chiave, @fonte, @indirizzo, @comune, @lat, @lon, @mq, @prezzo, @tipoPrezzo, @stato, @data, @url, @file, @ora)
  ON CONFLICT(chiave) DO UPDATE SET
    prezzo = excluded.prezzo, stato = excluded.stato, data = excluded.data, url = excluded.url,
    tipo_prezzo = excluded.tipo_prezzo, file = excluded.file, importato_il = excluded.importato_il,
    mq = excluded.mq, fonte = excluded.fonte,
    -- La posizione si ricalcola se cambia: coordinate diverse nel file, oppure un
    -- indirizzo diverso senza coordinate. Altrimenti si tiene quella gia' trovata.
    geo_tentato = CASE WHEN ${CAMBIA_POSIZIONE} THEN 0 ELSE comparabili.geo_tentato END,
    zona_omi = CASE WHEN ${CAMBIA_POSIZIONE} THEN NULL ELSE comparabili.zona_omi END,
    lat = CASE WHEN excluded.lat IS NOT NULL THEN excluded.lat
               WHEN ${CAMBIA_INDIRIZZO} THEN NULL ELSE comparabili.lat END,
    lon = CASE WHEN excluded.lon IS NOT NULL THEN excluded.lon
               WHEN ${CAMBIA_INDIRIZZO} THEN NULL ELSE comparabili.lon END,
    indirizzo = excluded.indirizzo, comune = excluded.comune
`);

export async function importaComparabili(cartella = CARTELLA_COMPARABILI): Promise<EsitoImportComparabili> {
  const esito: EsitoImportComparabili = { file: 0, importati: 0, aggiornati: 0, scartati: [], colonneIgnorate: [] };
  if (!existsSync(cartella)) return esito;

  const scarti = new Map<string, number>();
  const ignorate = new Set<string>();
  const esistenti = new Set((db.prepare("SELECT chiave FROM comparabili").all() as { chiave: string }[]).map((r) => r.chiave));
  const ora = new Date().toISOString();

  for (const file of (await readdir(cartella)).filter((f) => f.toLowerCase().endsWith(".csv")).sort()) {
    esito.file++;
    const { righe, intestazioni } = parseCsv(await readFile(join(cartella, file), "utf-8"));
    const mappa: Record<string, string | null> = {};
    for (const [campo, nomi] of Object.entries(COLONNE)) {
      mappa[campo] = nomi.map((n) => trovaColonna(intestazioni, n)).find((x) => x) ?? null;
    }
    const usate = new Set(Object.values(mappa).filter(Boolean));
    for (const h of intestazioni) if (!usate.has(h)) ignorate.add(h);

    for (const riga of righe) {
      const r = rigaInComparabile(riga, mappa, file);
      if (!r.ok) {
        scarti.set(r.motivo, (scarti.get(r.motivo) ?? 0) + 1);
        continue;
      }
      UPSERT.run({ ...r.c, file, ora });
      if (esistenti.has(r.c.chiave)) esito.aggiornati++;
      else {
        esito.importati++;
        esistenti.add(r.c.chiave);
      }
    }
  }
  esito.scartati = [...scarti].map(([motivo, n]) => ({ motivo, n }));
  esito.colonneIgnorate = [...ignorate];
  return esito;
}

interface RigaComparabile {
  id: number; fonte: string; indirizzo: string | null; comune: string | null;
  lat: number | null; lon: number | null; zona_omi: string | null; geo_tentato: number;
  mq: number; prezzo: number; tipo_prezzo: string; stato: string | null; data: string | null; url: string | null;
}

export function listComparabili(): (Comparabile & { geoTentato: boolean })[] {
  return (db.prepare("SELECT * FROM comparabili").all() as unknown as RigaComparabile[]).map((r) => ({
    id: r.id, fonte: r.fonte, indirizzo: r.indirizzo, comune: r.comune, lat: r.lat, lon: r.lon,
    zonaOmi: r.zona_omi, mq: r.mq, prezzo: r.prezzo,
    tipoPrezzo: r.tipo_prezzo === "rogito" ? "rogito" : "richiesta",
    stato: (r.stato as Comparabile["stato"]) ?? null,
    data: r.data, url: r.url, geoTentato: r.geo_tentato === 1,
  }));
}

const AGGIORNA_GEO = db.prepare("UPDATE comparabili SET lat = ?, lon = ?, zona_omi = ?, geo_tentato = 1 WHERE id = ?");

export function salvaGeoComparabile(id: number, lat: number | null, lon: number | null, zonaOmi: string | null): void {
  AGGIORNA_GEO.run(lat, lon, zonaOmi, id);
}
