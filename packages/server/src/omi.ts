import { existsSync } from "node:fs";
import { readdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

import { parseCsv, trovaColonna } from "@qdr/scrapers";

import { DATA_DIR } from "./paths.js";
import { eZip, leggiZip } from "./zip.js";

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

/** "1300", "1.300", "1300,5": le forniture non sono sempre coerenti nei separatori. */
const numero = (v: string | undefined): number | null => {
  let t = (v ?? "").trim();
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, "");
  const n = Number(t.replace(",", "."));
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

/**
 * Perimetri OMI dal KML dell'Agenzia delle Entrate (servizio "Perimetri di
 * zona" o "Download perimetri" del visualizzatore GEOPOI), gia' in WGS84. Ogni
 * zona e' un Placemark con CODCOM (codice catastale del comune) e CODZONA nei
 * dati estesi, e uno o piu' poligoni con eventuali buchi.
 */
export function zoneDaKml(kml: string): FeatureCollection {
  const features: Feature[] = [];
  for (const pm of kml.match(/<Placemark[\s\S]*?<\/Placemark>/g) ?? []) {
    const dato = (nome: string) =>
      new RegExp(`<Data name="${nome}">[\\s\\S]*?<value>([^<]*)</value>`).exec(pm)?.[1]?.trim() ?? "";
    const comune = dato("CODCOM");
    const zona = dato("CODZONA");
    if (!comune || !zona) continue;
    const anello = (testo: string) =>
      testo
        .trim()
        .split(/\s+/)
        .map((t) => t.split(",").slice(0, 2).map(Number))
        .filter((c) => c.length === 2 && c.every(Number.isFinite));
    const poligoni = (pm.match(/<Polygon>[\s\S]*?<\/Polygon>/g) ?? [])
      .map((pg) => {
        const esterno = /<outerBoundaryIs>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/.exec(pg)?.[1];
        const interni = [...pg.matchAll(/<innerBoundaryIs>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/g)].map((m) => anello(m[1]!));
        return esterno ? [anello(esterno), ...interni].filter((a) => a.length >= 4) : [];
      })
      .filter((p) => p.length > 0);
    if (poligoni.length === 0) continue;
    features.push({
      type: "Feature",
      properties: { comune_amm: comune, zona },
      geometry: poligoni.length === 1 ? { type: "Polygon", coordinates: poligoni[0] } : { type: "MultiPolygon", coordinates: poligoni },
    });
  }
  return { type: "FeatureCollection", features };
}

/** "ROZZANO (MI) Anno/Semestre 2026/1", "Anno 2026 - Semestre 1" -> "2026-1" */
function semestreDaTesto(testo: string): string | null {
  const m = /Anno\s*\/?\s*Semestre\s*(\d{4})\s*\/\s*([12])/i.exec(testo) ?? /Anno\s*(\d{4})\D{1,20}Semestre\s*([12])/i.exec(testo) ?? /\b(20\d\d)[-_ ]?([12])\b/.exec(testo);
  return m ? `${m[1]}-${m[2]}` : null;
}

export interface EsitoForniture extends EsitoOmi {
  file: string[];
  comuni: number;
}

/**
 * Importa le forniture OMI dell'Agenzia delle Entrate scaricate a mano: CSV
 * delle quotazioni (area riservata, "Forniture dati OMI") e KML dei perimetri,
 * sciolti, in zip o in una cartella. Sostituisce solo i comuni contenuti nei
 * file e conserva gli altri. Le quotazioni senza perimetri (o il contrario)
 * non servono al Gate 0: si importano solo i comuni che hanno entrambi.
 */
export async function importaForniture(percorsi: string[], cartella = DATA_DIR): Promise<EsitoForniture> {
  const file: { nome: string; dati: Buffer }[] = [];
  const aggiungi = async (p: string) => {
    if ((await stat(p)).isDirectory()) {
      for (const f of await readdir(p)) await aggiungi(join(p, f));
      return;
    }
    const dati = await readFile(p);
    if (eZip(dati)) {
      for (const v of leggiZip(dati)) {
        if (eZip(v.dati)) for (const w of leggiZip(v.dati)) file.push(w);
        else file.push(v);
      }
    } else file.push({ nome: p, dati });
  };
  for (const p of percorsi) await aggiungi(p);

  const quotazioni: QuotazioneRecord[] = [];
  const zone: Feature[] = [];
  const semestri = new Set<string>();
  const letti: string[] = [];
  for (const f of file) {
    const est = extname(f.nome).toLowerCase();
    // le forniture dell'Agenzia sono in Windows-1252 senza dichiararlo
    const testo = /\uFFFD/.test(f.dati.toString("utf8")) ? f.dati.toString("latin1") : f.dati.toString("utf8");
    if (est === ".kml") {
      const fc = zoneDaKml(testo);
      zone.push(...fc.features);
      const s = semestreDaTesto(/<name>([^<]*)<\/name>/.exec(testo)?.[1] ?? "") ?? semestreDaTesto(f.nome);
      if (s) semestri.add(s);
      letti.push(`${f.nome}: ${fc.features.length} zone`);
    } else if (est === ".csv" || est === ".txt") {
      const s = semestreDaTesto(testo.split(/\r?\n/, 1)[0] ?? "") ?? semestreDaTesto(f.nome) ?? "sconosciuto";
      const q = quotazioniDaCsv(testo, s);
      if (q.length === 0) continue;
      quotazioni.push(...q);
      semestri.add(s);
      letti.push(`${f.nome}: ${q.length} quotazioni`);
    }
  }
  if (semestri.size > 1) {
    throw new Error(`file di semestri diversi (${[...semestri].sort().join(", ")}): importane uno alla volta`);
  }
  const conZone = new Set(zone.map((f) => String(f.properties.comune_amm)));
  const conQuot = new Set(quotazioni.map((q) => q.comuneCod));
  const comuni = [...conZone].filter((c) => conQuot.has(c));
  if (comuni.length === 0) {
    throw new Error(
      `nessun comune con quotazioni e perimetri insieme (quotazioni: ${conQuot.size} comuni, perimetri: ${conZone.size}). ` +
        "Servono entrambi i file dello stesso semestre.",
    );
  }
  const tenuti = new Set(comuni);
  const semestre = [...semestri][0] ?? "sconosciuto";
  const esito = await scriviOmi(
    quotazioni.filter((q) => tenuti.has(q.comuneCod)),
    { type: "FeatureCollection", features: zone.filter((f) => tenuti.has(String(f.properties.comune_amm))) },
    semestre,
    cartella,
  );
  return { ...esito, file: letti, comuni: comuni.length };
}

