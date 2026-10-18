import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";

import { consentito, parseCsv, rallenta, trovaColonna, USER_AGENT } from "@qdr/scrapers";

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
export async function importaOmiMilano(semestre?: string, cartella = DATA_DIR, opzioni: { forza?: boolean } = {}): Promise<EsitoOmi> {
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
  return scriviOmi(quotazioniDaCsv(csv, scelto), zoneDaGeoJson(geo, COMUNE_MILANO), scelto, cartella, opzioni);
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
  opzioni: { forza?: boolean } = {},
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
  const quotPrima = existsSync(fileQuot) ? (JSON.parse(await readFile(fileQuot, "utf-8")) as QuotazioneRecord[]) : [];
  // un semestre piu' vecchio sopra uno piu' recente (es. l'open data del Comune dopo la fornitura
  // dell'Agenzia) declasserebbe i valori in silenzio: si rifiuta, salvo richiesta esplicita
  const piuRecenti = [...new Set(quotPrima.filter((q) => comuni.has(q.comuneCod) && q.semestre > semestre).map((q) => `${q.comuneCod} ${q.semestre}`))];
  if (piuRecenti.length && !opzioni.forza) {
    throw new Error(`in archivio c'e' un semestre piu' recente di ${semestre} (${piuRecenti.join(", ")}): i file restano com'erano, --forza per sovrascrivere`);
  }
  const quotEsistenti = quotPrima.filter((q) => !comuni.has(q.comuneCod));

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

/** Il contenuto di un tag dati, con o senza CDATA. */
const valoreDato = (testo: string | undefined) => (testo ?? "").replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1").trim();

/**
 * Perimetri OMI dal KML dell'Agenzia delle Entrate (servizio "Perimetri di
 * zona" o "Download perimetri" del visualizzatore GEOPOI), gia' in WGS84. Ogni
 * zona e' un Placemark con CODCOM (codice catastale del comune) e CODZONA nei
 * dati estesi (Data, o SimpleData se il file e' passato da QGIS/ogr2ogr), e uno
 * o piu' poligoni con eventuali buchi. Un Placemark senza CODCOM e CODZONA non
 * e' una zona OMI e si ignora.
 */
export function zoneDaKml(kml: string): FeatureCollection {
  const features: Feature[] = [];
  for (const pm of kml.match(/<Placemark\b[\s\S]*?<\/Placemark>/g) ?? []) {
    // il blocco del singolo Data: una regex pigra su tutto il Placemark sconfinerebbe nel Data successivo
    const dato = (nome: string) => {
      const blocco = new RegExp(`<Data\\s+name="${nome}"\\s*>([\\s\\S]*?)</Data>`).exec(pm)?.[1];
      if (blocco !== undefined) return valoreDato(/<value>([\s\S]*?)<\/value>/.exec(blocco)?.[1]);
      return valoreDato(new RegExp(`<SimpleData\\s+name="${nome}"\\s*>([\\s\\S]*?)</SimpleData>`).exec(pm)?.[1]);
    };
    const comune = dato("CODCOM");
    const zona = dato("CODZONA");
    if (!comune || !zona) continue;
    const anello = (testo: string) =>
      testo
        .replace(/,\s+/g, ",")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((t) => t.split(",").slice(0, 2).map(Number))
        .filter((c) => c.length === 2 && c.every(Number.isFinite));
    const coordinate = (blocco: string) => [...blocco.matchAll(/<coordinates>([\s\S]*?)<\/coordinates>/g)].map((m) => anello(m[1]!));
    const poligoni: number[][][][] = [];
    for (const pg of pm.match(/<Polygon\b[\s\S]*?<\/Polygon>/g) ?? []) {
      const esterno = coordinate(/<outerBoundaryIs>([\s\S]*?)<\/outerBoundaryIs>/.exec(pg)?.[1] ?? "")[0];
      // senza un anello esterno valido il poligono non c'e': un buco promosso a esterno sarebbe una zona falsa
      if (!esterno || esterno.length < 4) continue;
      const interni = [...pg.matchAll(/<innerBoundaryIs>([\s\S]*?)<\/innerBoundaryIs>/g)]
        .flatMap((m) => coordinate(m[1]!))
        .filter((a) => a.length >= 4);
      poligoni.push([esterno, ...interni]);
    }
    if (poligoni.length === 0) continue;
    features.push({
      type: "Feature",
      properties: { comune_amm: comune, zona },
      geometry: poligoni.length === 1 ? { type: "Polygon", coordinates: poligoni[0] } : { type: "MultiPolygon", coordinates: poligoni },
    });
  }
  return { type: "FeatureCollection", features };
}

/** "Anno/Semestre 2026/1", "Anno 2026 - Semestre 1" -> "2026-1" (titoli dentro i file). */
function semestreDaTitolo(testo: string): string | null {
  const m =
    /Anno\s*\/?\s*Semestre\s*(\d{4})\s*\/\s*([12])\b/i.exec(testo) ??
    /Anno\s*(\d{4})\D{1,20}Semestre\s*([12])\b/i.exec(testo) ??
    // "Quotazioni Immobiliari : Valori di Mercato - Semestre 2026/1 - elaborazione del 18-OTT-26"
    /Semestre\s*(\d{4})\s*\/\s*([12])\b/i.exec(testo);
  return m ? `${m[1]}-${m[2]}` : null;
}

/** "QI_1093784_1_20261_VALORI.csv", "H623 - ROZZANO 2026-1.kml" -> "2026-1": solo il nome del file, non la cartella. */
function semestreDaNomeFile(percorso: string): string | null {
  const m = /(?<!\d)(20\d\d)[-_ ]?([12])(?!\d)/.exec(basename(percorso));
  return m ? `${m[1]}-${m[2]}` : null;
}

/**
 * Windows-1252 da 0x80 a 0x9F: e' dove differisce da latin1. Node tratta
 * "windows-1252" come alias di latin1 e decodifica 0x92 come U+0092 invisibile.
 */
const CP1252: Record<number, string> = {
  0x80: "\u20ac", 0x82: "\u201a", 0x83: "\u0192", 0x84: "\u201e", 0x85: "\u2026", 0x86: "\u2020", 0x87: "\u2021",
  0x88: "\u02c6", 0x89: "\u2030", 0x8a: "\u0160", 0x8b: "\u2039", 0x8c: "\u0152", 0x8e: "\u017d", 0x91: "\u2018",
  0x92: "\u2019", 0x93: "\u201c", 0x94: "\u201d", 0x95: "\u2022", 0x96: "\u2013", 0x97: "\u2014", 0x98: "\u02dc",
  0x99: "\u2122", 0x9a: "\u0161", 0x9b: "\u203a", 0x9c: "\u0153", 0x9e: "\u017e", 0x9f: "\u0178",
};

/** Le forniture dell'Agenzia sono in Windows-1252 senza dichiararlo: latin1 storpierebbe gli apostrofi tipografici. */
function decodifica(dati: Buffer): string {
  const utf8 = dati.toString("utf8");
  if (!utf8.includes("\ufffd")) return utf8;
  let out = "";
  for (const b of dati) out += CP1252[b] ?? String.fromCharCode(b);
  return out;
}

/** Sotto i 100 EUR/mq non e' una quotazione residenziale, e' un separatore letto male ("1,300"). */
const QUOTAZIONE_MINIMA = 100;

export interface EsitoForniture extends EsitoOmi {
  file: string[];
  comuni: number;
  avvisi: string[];
}

export interface OpzioniForniture {
  /** Importa anche un semestre piu' vecchio di quello in archivio, o con meno zone. */
  forza?: boolean;
}

/**
 * Importa le forniture OMI dell'Agenzia delle Entrate scaricate a mano: CSV
 * delle quotazioni (area riservata, "Forniture dati OMI") e KML dei perimetri,
 * sciolti, in zip (anche annidati) o in una cartella. Sostituisce solo i comuni
 * contenuti nei file e conserva gli altri. Le quotazioni senza perimetri (o il
 * contrario) non servono al Gate 0: si importano solo i comuni che hanno
 * entrambi. Per ogni comune si rifiuta un semestre piu' vecchio di quello gia'
 * in archivio, o un import con meno zone: entrambi peggiorerebbero il valore di
 * uscita senza che nessuno se ne accorga.
 */
export async function importaForniture(
  percorsi: string[],
  cartella = DATA_DIR,
  opzioni: OpzioniForniture = {},
): Promise<EsitoForniture> {
  const file: { nome: string; dati: Buffer }[] = [];
  const espandi = (nome: string, dati: Buffer, profondita = 0) => {
    if (eZip(dati) && profondita < 4) {
      for (const v of leggiZip(dati)) espandi(v.nome, v.dati, profondita + 1);
    } else file.push({ nome, dati });
  };
  const aggiungi = async (p: string) => {
    if ((await stat(p)).isDirectory()) {
      for (const f of await readdir(p)) await aggiungi(join(p, f));
      return;
    }
    espandi(p, await readFile(p));
  };
  for (const p of percorsi) await aggiungi(p);

  const quotazioni: QuotazioneRecord[] = [];
  const zonePerChiave = new Map<string, Feature>();
  const semestri = new Set<string>();
  const letti: string[] = [];
  const avvisi: string[] = [];
  for (const f of file) {
    const est = extname(f.nome).toLowerCase();
    if (est !== ".kml" && est !== ".csv" && est !== ".txt") continue;
    const testo = decodifica(f.dati);
    if (est === ".kml") {
      const fc = zoneDaKml(testo);
      // un KML senza zone OMI (un altro file finito nella cartella) non conta, nemmeno per il semestre
      if (fc.features.length === 0) continue;
      const s = semestreDaTitolo(/<name>([^<]*)<\/name>/.exec(testo)?.[1] ?? "") ?? semestreDaNomeFile(f.nome);
      if (!s) throw new Error(`${basename(f.nome)}: semestre non riconoscibile, rinomina il file con anno e semestre (es. 2026-1)`);
      semestri.add(s);
      let nuove = 0;
      for (const z of fc.features) {
        const k = `${z.properties.comune_amm}|${z.properties.zona}`;
        // lo stesso perimetro dallo zip e dal KML estratto accanto: una volta sola
        if (!zonePerChiave.has(k)) {
          zonePerChiave.set(k, z);
          nuove++;
        }
      }
      letti.push(`${basename(f.nome)}: ${fc.features.length} zone${nuove < fc.features.length ? ` (${fc.features.length - nuove} gia' lette)` : ""}`);
    } else {
      const s = semestreDaTitolo(testo.split(/\r?\n/, 1)[0] ?? "") ?? semestreDaNomeFile(f.nome);
      const q = quotazioniDaCsv(testo, s ?? "sconosciuto");
      if (q.length === 0) continue;
      if (!s) throw new Error(`${basename(f.nome)}: semestre non riconoscibile, rinomina il file con anno e semestre (es. 2026-1)`);
      const plausibili = q.filter((x) => (x.vendMin ?? x.vendMinOttimo ?? 0) >= QUOTAZIONE_MINIMA);
      if (plausibili.length < q.length) avvisi.push(`${basename(f.nome)}: ${q.length - plausibili.length} quotazioni sotto ${QUOTAZIONE_MINIMA} EUR/mq scartate`);
      quotazioni.push(...plausibili);
      semestri.add(s);
      letti.push(`${basename(f.nome)}: ${plausibili.length} quotazioni`);
    }
  }
  if (semestri.size > 1) {
    throw new Error(`file di semestri diversi (${[...semestri].sort().join(", ")}): importane uno alla volta`);
  }
  const zone = [...zonePerChiave.values()];
  const conZone = new Set(zone.map((f) => String(f.properties.comune_amm)));
  const conQuot = new Set(quotazioni.map((q) => q.comuneCod));
  let comuni = [...conZone].filter((c) => conQuot.has(c));
  if (comuni.length === 0) {
    throw new Error(
      `nessun comune con quotazioni e perimetri insieme (quotazioni: ${conQuot.size} comuni, perimetri: ${conZone.size}). ` +
        "Servono entrambi i file dello stesso semestre.",
    );
  }
  const semestre = [...semestri][0]!;

  // cosa c'e' gia' in archivio, comune per comune
  const fileQuot = join(cartella, "quotazioni_omi.json");
  const fileZone = join(cartella, "zone_omi.geojson");
  const semestreEsistente = new Map<string, string>();
  if (existsSync(fileQuot)) {
    for (const q of JSON.parse(await readFile(fileQuot, "utf-8")) as QuotazioneRecord[]) {
      if ((semestreEsistente.get(q.comuneCod) ?? "") < q.semestre) semestreEsistente.set(q.comuneCod, q.semestre);
    }
  }
  const zoneEsistenti = new Map<string, number>();
  if (existsSync(fileZone)) {
    for (const f of (JSON.parse(await readFile(fileZone, "utf-8")) as FeatureCollection).features ?? []) {
      const c = String(f.properties?.comune_amm ?? f.properties?.comune_cod ?? "");
      zoneEsistenti.set(c, (zoneEsistenti.get(c) ?? 0) + 1);
    }
  }
  const zoneNuove = new Map<string, number>();
  for (const z of zone) zoneNuove.set(String(z.properties.comune_amm), (zoneNuove.get(String(z.properties.comune_amm)) ?? 0) + 1);
  const rifiutati: string[] = [];
  comuni = comuni.filter((c) => {
    const prima = semestreEsistente.get(c);
    if (prima && prima > semestre && !opzioni.forza) {
      rifiutati.push(`${c}: in archivio c'e' il semestre ${prima}, piu' recente di ${semestre}`);
      return false;
    }
    const zonePrima = zoneEsistenti.get(c) ?? 0;
    if (zonePrima > (zoneNuove.get(c) ?? 0) && !opzioni.forza) {
      rifiutati.push(`${c}: ${zoneNuove.get(c)} zone contro le ${zonePrima} in archivio`);
      return false;
    }
    return true;
  });
  if (rifiutati.length) avvisi.push(`Comuni non importati (--forza per importarli comunque): ${rifiutati.join("; ")}`);
  if (comuni.length === 0) throw new Error(`nessun comune da aggiornare. ${avvisi.join(" ")}`);

  const tenuti = new Set(comuni);
  const esito = await scriviOmi(
    quotazioni.filter((q) => tenuti.has(q.comuneCod)),
    { type: "FeatureCollection", features: zone.filter((f) => tenuti.has(String(f.properties.comune_amm))) },
    semestre,
    cartella,
    // i comuni con un semestre piu' recente sono gia' stati esclusi sopra, salvo --forza
    { forza: true },
  );
  return { ...esito, file: letti, comuni: comuni.length, avvisi };
}

const GEOPOI = "https://www1.agenziaentrate.gov.it/servizi/geopoi_omi";

export interface EsitoPerimetri {
  semestre: string;
  file: string[];
  comuni: number;
  zone: number;
}

/**
 * Scarica i perimetri OMI dal visualizzatore pubblico GEOPOI dell'Agenzia
 * delle Entrate: lo stesso file del pulsante "Download perimetri", livello
 * provincia. Il file "MI" comprende anche i comuni di Monza e della Brianza
 * (188 comuni nel primo semestre 2026). Decisione del titolare del 18/10/2026
 * (docs/condizioni-uso.md): un file per provincia e semestre, nessun'altra
 * richiesta al servizio. I file restano in data/import/omi/<semestre>/, pronti
 * per `omi importa` insieme alle quotazioni scaricate dall'area riservata.
 */
export async function scaricaPerimetri(province: string[], semestre?: string, cartella = DATA_DIR): Promise<EsitoPerimetri> {
  // argomenti controllati prima di qualunque richiesta: una sigla sbagliata non deve lasciare mezzo download
  const sigle = [...new Set(province.map((p) => p.trim().toUpperCase()))];
  const sbagliata = province.find((p) => !/^[A-Z]{2}$/.test(p.trim().toUpperCase()));
  if (sbagliata !== undefined) throw new Error(`provincia "${sbagliata}": serve la sigla, es. MI`);
  if (sigle.length === 0) throw new Error("nessuna provincia indicata");
  if (semestre !== undefined && !/^\d{4}\D?[12]$/.test(semestre.trim())) throw new Error(`semestre "${semestre}": serve anno e semestre, es. 2026-1`);
  if (!(await consentito(`${GEOPOI}/perimetri.php`))) throw new Error("robots.txt vieta il download dei perimetri");
  const chiama = async (url: string): Promise<Buffer> => {
    let ultimo: Error = new Error("nessun tentativo");
    for (let tentativo = 0; tentativo < 3; tentativo++) {
      // il servizio chiude a volte la connessione a meta' file: si riprova, sempre piu' piano
      await rallenta("geopoi_omi", 10 * (tentativo + 1));
      try {
        const resp = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(300_000) });
        if (resp.status >= 400 && resp.status < 500) throw Object.assign(new Error(`HTTP ${resp.status}`), { definitivo: true });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return Buffer.from(await resp.arrayBuffer());
      } catch (err) {
        if ((err as { definitivo?: boolean }).definitivo) throw err;
        ultimo = err as Error;
      }
    }
    throw ultimo;
  };
  // senza semestre, il piu' recente pubblicato
  const elenco = JSON.parse((await chiama(`${GEOPOI}/zoneomi.php?richiesta=5`)).toString("utf8")) as { SEMESTRE: string }[];
  const disponibili = elenco.map((x) => x.SEMESTRE).filter((x) => /^\d{4}[12]$/.test(x));
  // il piu' recente per valore, non per posizione: l'ordine dell'elenco non e' documentato
  const codice = semestre ? semestre.replace(/\D/g, "") : [...disponibili].sort().at(-1);
  if (!codice || !disponibili.includes(codice)) {
    throw new Error(`semestre ${semestre ?? "?"} non disponibile; disponibili: ${disponibili.slice(0, 6).join(", ")}...`);
  }
  const etichetta = `${codice.slice(0, 4)}-${codice.slice(4)}`;
  const dir = join(cartella, "import", "omi", etichetta);
  await mkdir(dir, { recursive: true });
  const file: string[] = [];
  const comuni = new Set<string>();
  // per chiave: due province che si sovrappongono non contano due volte la stessa zona
  const zone = new Set<string>();
  for (const sigla of sigle) {
    const dati = await chiama(`${GEOPOI}/perimetri.php?id=1&prov=${sigla}&codcom=&semestre=${codice}&formato=kml`);
    if (!eZip(dati)) throw new Error(`perimetri ${sigla}: il servizio non ha restituito uno zip`);
    // si controlla il contenuto prima di salvarlo: uno zip senza zone OMI non deve finire fra le forniture
    let zoneFile = 0;
    for (const v of leggiZip(dati)) {
      if (!/\.kml$/i.test(v.nome)) continue;
      const fc = zoneDaKml(decodifica(v.dati));
      zoneFile += fc.features.length;
      for (const f of fc.features) {
        comuni.add(String(f.properties.comune_amm));
        zone.add(`${f.properties.comune_amm}|${f.properties.zona}`);
      }
    }
    if (zoneFile === 0) throw new Error(`perimetri ${sigla}: nessuna zona OMI nel file`);
    const percorso = join(dir, `perimetri_${sigla}_${etichetta}.zip`);
    await writeFile(`${percorso}.tmp`, dati);
    await rename(`${percorso}.tmp`, percorso);
    file.push(percorso);
  }
  return { semestre: etichetta, file, comuni: comuni.size, zone: zone.size };
}

