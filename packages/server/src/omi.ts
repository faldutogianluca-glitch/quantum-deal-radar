import { existsSync } from "node:fs";
import { readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { parseCsv, trovaColonna } from "@qdr/scrapers";

import { DATA_DIR } from "./paths.js";

/**
 * Quotazioni e perimetri OMI del comune di Milano dal portale open data del
 * Comune (dati.comune.milano.it, licenza CC BY 4.0), senza l'area riservata
 * dell'Agenzia delle Entrate.
 *
 * Il Comune ripubblica ogni semestre i dati OMI della citta': un CSV di
 * quotazioni e un GeoJSON di perimetri gia' in WGS84. Copre solo Milano citta';
 * per l'hinterland servono le forniture dell'Agenzia, che restano nel formato
 * descritto nel README. L'importazione sostituisce solo le righe di Milano
 * (F205) e conserva quelle degli altri comuni gia' presenti nei file.
 *
 * Le quotazioni OMI distinguono lo stato conservativo. NORMALE e' quello che
 * serve alla valutazione dell'immobile com'e'; OTTIMO e' la proxy piu' vicina a
 * un appartamento appena ristrutturato, e il Gate 0 lo usa come valore di
 * uscita quando la zona lo pubblica.
 */

const CKAN = "https://dati.comune.milano.it/api/3/action";
export const COMUNE_MILANO = "F205";
export const ATTRIBUZIONE = "Dati OMI Agenzia delle Entrate, ripubblicati dal Comune di Milano (dati.comune.milano.it), CC BY 4.0";

export interface QuotazioneRecord {
  comuneCod: string;
  /** Nome del comune: serve a ricavare il codice per i lotti che hanno solo il nome. */
  comune?: string;
  zona: string;
  tipologia: string;
  vendMin: number | null;
  vendMax: number | null;
  /** Stato OTTIMO, quando la zona lo quota: la proxy del ristrutturato. */
  vendMinOttimo?: number | null;
  vendMaxOttimo?: number | null;
  semestre: string;
}

interface Feature {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: { type: string; coordinates: unknown };
}
interface FeatureCollection {
  type: "FeatureCollection";
  features: Feature[];
}

const numero = (v: string | undefined): number | null => {
  const n = Number((v ?? "").trim());
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * Dal CSV OMI alle quotazioni del radar: una riga per comune, zona e tipologia,
 * con NORMALE e OTTIMO affiancati. Se una zona quota solo OTTIMO (succede in
 * centro, dove e' lo stato prevalente) quello vale anche per la valutazione
 * dell'immobile com'e', perche' e' cio' che l'OMI considera tipico li'.
 */
export function quotazioniDaCsv(csv: string, semestre: string): QuotazioneRecord[] {
  // le forniture dell'Agenzia hanno una riga di titolo sopra l'intestazione: si salta
  const linee = csv.replace(/^\uFEFF/, "").split(/\r?\n/);
  const inizio = linee.findIndex((l) => /\bZona\b/i.test(l) && /Compr_min/i.test(l));
  const { righe, intestazioni } = parseCsv(inizio > 0 ? linee.slice(inizio).join("\n") : csv);
  const col = (nome: string) => trovaColonna(intestazioni, nome) ?? nome;
  const [cComune, cZona, cTip, cStato, cMin, cMax, cNome] =
    ["Comune_amm", "Zona", "Descr_Tipologia", "Stato", "Compr_min", "Compr_max", "Comune_descrizione"].map(col);

  const mappa = new Map<string, QuotazioneRecord>();
  for (const r of righe) {
    const comuneCod = (r[cComune!] ?? "").trim();
    const zona = (r[cZona!] ?? "").trim();
    const tipologia = (r[cTip!] ?? "").trim();
    if (!comuneCod || !zona || !tipologia) continue;
    const chiave = `${comuneCod}|${zona}|${tipologia}`;
    const nome = (r[cNome!] ?? "").trim();
    const q = mappa.get(chiave) ??
      { comuneCod, ...(nome ? { comune: nome } : {}), zona, tipologia, vendMin: null, vendMax: null, semestre };
    const min = numero(r[cMin!]);
    const max = numero(r[cMax!]);
    const stato = (r[cStato!] ?? "").trim().toUpperCase();
    if (stato === "OTTIMO") {
      q.vendMinOttimo = min;
      q.vendMaxOttimo = max;
    } else if (stato === "NORMALE") {
      q.vendMin = min;
      q.vendMax = max;
    }
    mappa.set(chiave, q);
  }
  for (const q of mappa.values()) {
    if (q.vendMin == null && q.vendMinOttimo != null) {
      q.vendMin = q.vendMinOttimo;
      q.vendMax = q.vendMaxOttimo ?? null;
    }
  }
  return [...mappa.values()].filter((q) => q.vendMin != null || q.vendMinOttimo != null);
}

/** I perimetri del Comune hanno "Zona" ma non il codice del comune: si normalizzano per daGeoJson(). */
export function zoneDaGeoJson(fc: FeatureCollection, comuneCod: string): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: fc.features
      .filter((f) => f.geometry && (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon"))
      .map((f) => ({
        type: "Feature" as const,
        properties: {
          comune_amm: comuneCod,
          zona: String(f.properties.Zona ?? f.properties.zona ?? "").trim(),
          descrizione: String(f.properties.Zona_Descr ?? ""),
        },
        // la terza coordinata (quota zero) non serve e raddoppia il peso del file
        geometry: { type: f.geometry.type, coordinates: senzaQuota(f.geometry.coordinates) },
      }))
      .filter((f) => f.properties.zona),
  };
}

function senzaQuota(c: unknown): unknown {
  if (Array.isArray(c) && typeof c[0] === "number") return c.slice(0, 2);
  return Array.isArray(c) ? c.map(senzaQuota) : c;
}

interface PacchettoCkan {
  name: string;
  resources: { format: string; url: string }[];
}

async function cercaPacchetti(prefisso: string): Promise<Map<string, PacchettoCkan>> {
  const resp = await fetch(`${CKAN}/package_search?q=${encodeURIComponent(prefisso)}&rows=100`);
  if (!resp.ok) throw new Error(`portale open data del Comune: HTTP ${resp.status}`);
  const dati = (await resp.json()) as { result: { results: PacchettoCkan[] } };
  const candidati = dati.result.results
    .map((p) => ({ p, m: new RegExp(`${prefisso.replace(/ /g, "-")}-(\\d{4})-(\\d)$`).exec(p.name) }))
    .filter((x) => x.m)
    .map((x) => ({ pacchetto: x.p, semestre: `${x.m![1]}-${x.m![2]}` }))
    .sort((a, b) => b.semestre.localeCompare(a.semestre));
  return new Map(candidati.map((c) => [c.semestre, c.pacchetto]));
}

async function scaricaRisorsa(p: PacchettoCkan, formato: string): Promise<string> {
  const r = p.resources.find((x) => x.format.toUpperCase() === formato);
  if (!r) throw new Error(`${p.name}: nessuna risorsa ${formato}`);
  const resp = await fetch(r.url);
  if (!resp.ok) throw new Error(`${r.url}: HTTP ${resp.status}`);
  return resp.text();
}

export interface EsitoOmi {
  semestre: string;
  zone: number;
  quotazioni: number;
  conOttimo: number;
  /** Righe di altri comuni gia' presenti e conservate. */
  conservate: { zone: number; quotazioni: number };
}

/**
 * Scrive i due file OMI di data/ con i dati di Milano: il semestre richiesto
 * ("2024-2") o, senza argomento, il piu' recente in cui ci sono sia quotazioni
 * sia perimetri.
 */
export async function importaOmiMilano(semestre?: string, cartella = DATA_DIR): Promise<EsitoOmi> {
  const quot = await cercaPacchetti("quotazioni immobiliari omi compravendita semestre");
  const zone = await cercaPacchetti("zone e perimetri omi");
  // il semestre piu' recente in cui ci sono entrambi: i perimetri escono a volte dopo
  const comuni = [...quot.keys()].filter((s) => zone.has(s)).sort().reverse();
  const scelto = semestre ?? comuni[0];
  if (!scelto || !quot.has(scelto) || !zone.has(scelto)) {
    throw new Error(semestre ? `quotazioni o perimetri mancanti per il semestre ${semestre}` : "nessun semestre con quotazioni e perimetri");
  }
  const csv = await scaricaRisorsa(quot.get(scelto)!, "CSV");
  const geo = JSON.parse(await scaricaRisorsa(zone.get(scelto)!, "GEOJSON")) as FeatureCollection;
  return scriviOmi(quotazioniDaCsv(csv, scelto), zoneDaGeoJson(geo, COMUNE_MILANO), scelto, cartella);
}

async function scriviAtomico(file: string, contenuto: string): Promise<void> {
  const temporaneo = `${file}.tmp`;
  await writeFile(temporaneo, contenuto);
  await rename(temporaneo, file);
}

/** Unisce ai file esistenti, sostituendo solo il comune importato. */
export async function scriviOmi(
  quotazioni: QuotazioneRecord[],
  zone: FeatureCollection,
  semestre: string,
  cartella = DATA_DIR,
): Promise<EsitoOmi> {
  // Un file letto male (formato cambiato, intestazione spostata) darebbe zero righe:
  // scriverlo cancellerebbe i dati buoni di prima. Meglio fermarsi e dirlo.
  if (quotazioni.length === 0 || zone.features.length === 0) {
    throw new Error(
      `importazione OMI vuota (${quotazioni.length} quotazioni, ${zone.features.length} zone): ` +
        "il formato del portale potrebbe essere cambiato, i file esistenti restano com'erano",
    );
  }
  const fileZone = join(cartella, "zone_omi.geojson");
  const fileQuot = join(cartella, "quotazioni_omi.json");
  const comuni = new Set([
    ...quotazioni.map((q) => q.comuneCod),
    ...zone.features.map((f) => String(f.properties.comune_amm ?? "")),
  ]);

  const zoneEsistenti = existsSync(fileZone)
    ? ((JSON.parse(await readFile(fileZone, "utf-8")) as FeatureCollection).features ?? []).filter(
        (f) => !comuni.has(String(f.properties?.comune_amm ?? f.properties?.comune_cod ?? "")),
      )
    : [];
  const quotEsistenti = existsSync(fileQuot)
    ? (JSON.parse(await readFile(fileQuot, "utf-8")) as QuotazioneRecord[]).filter((q) => !comuni.has(q.comuneCod))
    : [];

  // scrittura atomica: un'interruzione a meta' non lascia un file troncato
  await scriviAtomico(fileZone, JSON.stringify({ type: "FeatureCollection", features: [...zoneEsistenti, ...zone.features] }));
  await scriviAtomico(fileQuot, JSON.stringify([...quotEsistenti, ...quotazioni], null, 1));
  return {
    semestre,
    zone: zone.features.length,
    quotazioni: quotazioni.length,
    conOttimo: quotazioni.filter((q) => q.vendMinOttimo != null).length,
    conservate: { zone: zoneEsistenti.length, quotazioni: quotEsistenti.length },
  };
}
