import { existsSync } from "node:fs";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { inflateRawSync } from "node:zlib";

import { ZONA_COMUNE, type GeoJsonFeatureCollection } from "@qdr/core";

import { DATA_DIR } from "./paths.js";

/*
 * I file che `enrich` si aspetta in data/, e da dove prenderli.
 *
 * Tutto cio' che e' OMI e' dell'Agenzia delle Entrate, licenza CC BY 4.0, da
 * citare come "Agenzia delle Entrate - OMI". Tre strade, in ordine di quanto
 * sono complete:
 *
 *  - i CSV ufficiali delle quotazioni (QI_*_VALORI.csv) dal servizio "Forniture
 *    dati OMI" dell'area riservata, o i riepiloghi che alcuni comuni
 *    ripubblicano in open data con le stesse colonne: lasciati in data/omi/,
 *    diventano data/quotazioni_omi.json. E' l'archivio intero, ma scaricarlo
 *    richiede le credenziali del titolare: non si automatizza;
 *  - i perimetri delle zone dal servizio pubblico GEOPOI, un KML per provincia,
 *    senza autenticazione -> data/zone_omi.geojson;
 *  - le quotazioni di una zona dalla consultazione GEOPOI, chieste solo per le
 *    zone in cui c'e' un immobile con un prezzo da confrontare: poche richieste
 *    mirate, non l'archivio.
 *
 * L'anagrafica dei comuni (codice catastale, sigla provincia) viene dall'ISTAT:
 * senza, il nome del comune scritto in un annuncio non si aggancia a nessuna
 * quotazione.
 */

export const ZONE_OMI_PATH = join(DATA_DIR, "zone_omi.geojson");
export const QUOTAZIONI_PATH = join(DATA_DIR, "quotazioni_omi.json");
export const COMUNI_PATH = join(DATA_DIR, "comuni.json");
export const OMI_DIR = join(DATA_DIR, "omi");
/** La zona convenzionale del ripiego comunale: non ha un perimetro e non si chiede a GEOPOI. */
export const ZONA_COMUNE_SENTINEL = ZONA_COMUNE;

const GEOPOI = "https://www1.agenziaentrate.gov.it/servizi/geopoi_omi";
const ISTAT_COMUNI = "https://www.istat.it/storage/codici-unita-amministrative/Elenco-comuni-italiani.csv";
const USER_AGENT = "QuantumDealRadar/0.1 (contatto: faldutogianluca@gmail.com)";

/** Pausa fra due richieste allo stesso servizio pubblico. */
const PAUSA_MS = 3000;

export interface QuotazioneRecord {
  comuneCod: string;
  zona: string;
  tipologia: string;
  vendMin: number;
  vendMax: number;
  /** "2026-1": anno e semestre, confrontabile come testo. */
  semestre: string;
  stato?: string;
}

type Feature = GeoJsonFeatureCollection["features"][number];

const pausa = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Un servizio pubblico ogni tanto risponde 503 per un attimo: due ritentativi
 * con attese crescenti bastano, di piu' sarebbe insistere.
 */
async function scarica(url: string, tentativi = 3): Promise<Response> {
  let ultimo: Error | null = null;
  for (let i = 0; i < tentativi; i++) {
    if (i > 0) await pausa(5000 * i);
    try {
      const r = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
      if (r.ok) return r;
      ultimo = new Error(`HTTP ${r.status} su ${url}`);
      if (r.status < 500) break;
    } catch (err) {
      ultimo = err as Error;
    }
  }
  throw ultimo ?? new Error(`richiesta fallita: ${url}`);
}

// ------------------------------------------------------------------ CSV

/**
 * Parser CSV minimo ma corretto: campi fra virgolette possono contenere il
 * separatore e andare a capo (l'intestazione ISTAT lo fa davvero).
 */
export function analizzaCsv(testo: string, separatore = ";"): string[][] {
  const righe: string[][] = [];
  let riga: string[] = [];
  let campo = "";
  let fraVirgolette = false;
  for (let i = 0; i < testo.length; i++) {
    const c = testo[i]!;
    if (fraVirgolette) {
      if (c === '"') {
        if (testo[i + 1] === '"') {
          campo += '"';
          i++;
        } else fraVirgolette = false;
      } else campo += c;
      continue;
    }
    if (c === '"') fraVirgolette = true;
    else if (c === separatore) {
      riga.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && testo[i + 1] === "\n") i++;
      riga.push(campo);
      righe.push(riga);
      riga = [];
      campo = "";
    } else campo += c;
  }
  if (campo !== "" || riga.length > 0) {
    riga.push(campo);
    righe.push(riga);
  }
  return righe;
}

const numeroIt = (v: string | undefined): number | null => {
  if (!v) return null;
  const n = Number(v.trim().replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * Legge un CSV di quotazioni nel formato dell'Agenzia (QI_*_VALORI.csv, o i
 * riepiloghi comunali con le stesse colonne piu' Anno e Periodo).
 *
 * Il semestre si prende, nell'ordine, dalle colonne Anno/Periodo, dalla riga
 * di titolo ("Semestre 2024/2"), dal nome del file (QI_..._20242_VALORI.csv).
 * Senza semestre il record non entra: una quotazione di cui non si sa l'epoca
 * non e' confrontabile con niente.
 */
export function analizzaCsvQuotazioni(testo: string, nomeFile = ""): QuotazioneRecord[] {
  const righe = analizzaCsv(testo.replace(/^﻿/, ""));
  const iTesta = righe.findIndex((r) => r.some((c) => /^comune_amm$/i.test(c.trim())) && r.some((c) => /^zona$/i.test(c.trim())));
  if (iTesta < 0) return [];

  const testa = righe[iTesta]!.map((c) => c.trim().toLowerCase());
  const col = (nome: string): number => testa.indexOf(nome.toLowerCase());
  const iComune = col("Comune_amm");
  const iZona = col("Zona");
  const iTip = col("Descr_Tipologia");
  const iStato = col("Stato");
  const iMin = col("Compr_min");
  const iMax = col("Compr_max");
  const iAnno = col("Anno");
  const iPeriodo = col("Periodo");
  const iFile = col("file");
  if (iTip < 0 || iMin < 0 || iMax < 0) return [];

  const daTitolo = /semestre\s+(\d{4})\s*\/\s*([12])/i.exec(righe.slice(0, iTesta).map((r) => r.join(";")).join(" "));
  const daNome = /(\d{4})([12])_(?:VALORI|ZONE)/i.exec(nomeFile);
  const semestreFisso = daTitolo ? `${daTitolo[1]}-${daTitolo[2]}` : daNome ? `${daNome[1]}-${daNome[2]}` : null;

  const out: QuotazioneRecord[] = [];
  for (const r of righe.slice(iTesta + 1)) {
    const comuneCod = r[iComune]?.trim();
    const zona = r[iZona]?.trim();
    const tipologia = r[iTip]?.trim();
    const vendMin = numeroIt(r[iMin]);
    const vendMax = numeroIt(r[iMax]);
    if (!comuneCod || !zona || !tipologia || vendMin === null || vendMax === null) continue;

    let semestre = semestreFisso;
    if (iAnno >= 0 && iPeriodo >= 0 && r[iAnno] && r[iPeriodo]) {
      const p = /([12])/.exec(r[iPeriodo]!);
      if (p) semestre = `${r[iAnno]!.trim()}-${p[1]}`;
    } else if (iFile >= 0 && r[iFile]) {
      const f = /(\d{4})([12])/.exec(r[iFile]!);
      if (f) semestre = `${f[1]}-${f[2]}`;
    }
    if (!semestre) continue;

    out.push({ comuneCod, zona, tipologia, vendMin, vendMax, semestre, stato: r[iStato]?.trim() || undefined });
  }
  return out;
}

const chiaveQuotazione = (q: QuotazioneRecord): string => `${q.comuneCod}|${q.zona}|${q.tipologia}`;

/**
 * Per ogni comune+zona+tipologia resta una quotazione sola: il semestre piu'
 * recente e, a parita', lo stato conservativo NORMALE, che e' quello che OMI
 * indica come il piu' ricorrente nella zona.
 */
export function unisciQuotazioni(...elenchi: QuotazioneRecord[][]): QuotazioneRecord[] {
  const mappa = new Map<string, QuotazioneRecord>();
  for (const q of elenchi.flat()) {
    const k = chiaveQuotazione(q);
    const attuale = mappa.get(k);
    if (!attuale || q.semestre > attuale.semestre) {
      mappa.set(k, q);
      continue;
    }
    if (q.semestre === attuale.semestre && q.stato === "NORMALE" && attuale.stato !== "NORMALE") mappa.set(k, q);
  }
  return [...mappa.values()].sort((a, b) => chiaveQuotazione(a).localeCompare(chiaveQuotazione(b)));
}

async function caricaQuotazioniSalvate(): Promise<QuotazioneRecord[]> {
  if (!existsSync(QUOTAZIONI_PATH)) return [];
  return JSON.parse(await readFile(QUOTAZIONI_PATH, "utf-8")) as QuotazioneRecord[];
}

async function scriviQuotazioni(records: QuotazioneRecord[]): Promise<void> {
  await writeFile(QUOTAZIONI_PATH, JSON.stringify(records));
}

/** I CSV lasciati in data/omi/ entrano in data/quotazioni_omi.json, uniti a quanto c'e' gia'. */
export async function importaQuotazioniDaCartella(): Promise<{ file: number; record: number; totale: number }> {
  const nuove: QuotazioneRecord[] = [];
  let file = 0;
  if (existsSync(OMI_DIR)) {
    for (const nome of (await readdir(OMI_DIR)).filter((f) => f.toLowerCase().endsWith(".csv"))) {
      const grezzo = await readFile(join(OMI_DIR, nome));
      // l'Agenzia consegna in Latin-1, i portali open data in UTF-8: si riconosce dal BOM/UTF-8 valido
      const testo = decodifica(grezzo);
      const r = analizzaCsvQuotazioni(testo, nome);
      nuove.push(...r);
      file++;
    }
  }
  const unite = unisciQuotazioni(await caricaQuotazioniSalvate(), nuove);
  await scriviQuotazioni(unite);
  return { file, record: nuove.length, totale: unite.length };
}

function decodifica(buf: Buffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder("latin1").decode(buf);
  }
}

// ------------------------------------------------------------------ KML -> GeoJSON

function leggiCoordinate(testo: string): [number, number][] {
  return testo
    .trim()
    .split(/\s+/)
    .map((t) => t.split(",").slice(0, 2).map(Number) as [number, number])
    .filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat));
}

/**
 * Converte i KML di GEOPOI nella FeatureCollection che daGeoJson() di @qdr/core
 * legge: comune_cod e zona nelle proprieta', poligoni in EPSG:4326 (il KML e'
 * gia' in gradi; la quota viene scartata). Senza dipendenze: la struttura e'
 * fissa e un parser XML completo sarebbe piu' codice di quello che protegge.
 */
export function kmlInGeoJson(kml: string): GeoJsonFeatureCollection {
  const features: Feature[] = [];
  for (const m of kml.matchAll(/<Placemark[\s\S]*?<\/Placemark>/g)) {
    const pm = m[0];
    const dato = (nome: string): string | null => {
      const r =
        new RegExp(`<Data name="${nome}">[\\s\\S]*?<value>([^<]*)</value>`).exec(pm) ??
        new RegExp(`<SimpleData name="${nome}">([^<]*)</SimpleData>`).exec(pm);
      const v = r?.[1]?.trim();
      return v ? v : null;
    };
    const comuneCod = dato("CODCOM");
    const zona = dato("CODZONA");
    const nome = /<name>([^<]*)<\/name>/.exec(pm)?.[1]?.trim();

    const poligoni: [number, number][][][] = [];
    for (const p of pm.matchAll(/<Polygon>[\s\S]*?<\/Polygon>/g)) {
      const esterno = /<outerBoundaryIs>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/.exec(p[0]);
      if (!esterno) continue;
      const anelli = [leggiCoordinate(esterno[1]!)];
      for (const interno of p[0].matchAll(/<innerBoundaryIs>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/g)) {
        anelli.push(leggiCoordinate(interno[1]!));
      }
      if (anelli[0]!.length >= 4) poligoni.push(anelli);
    }
    if (!comuneCod || !zona || poligoni.length === 0) continue;

    features.push({
      type: "Feature",
      properties: { comune_cod: comuneCod, zona, ...(nome ? { descrizione: nome } : {}) },
      geometry:
        poligoni.length === 1
          ? { type: "Polygon", coordinates: poligoni[0] }
          : { type: "MultiPolygon", coordinates: poligoni },
    });
  }
  return { type: "FeatureCollection", features };
}

// ------------------------------------------------------------------ zip

/**
 * Legge un archivio zip dalla directory centrale. Basta per i KML di GEOPOI
 * (deflate o stored) e non porta una dipendenza per 40 righe.
 */
export function leggiZip(buf: Buffer): { nome: string; dati: Buffer }[] {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) {
    const inizio = buf.subarray(0, 120).toString("latin1").replace(/\s+/g, " ").trim();
    throw new Error(`il file non e' un archivio zip (inizia con: "${inizio.slice(0, 80)}")`);
  }

  const voci = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const out: { nome: string; dati: Buffer }[] = [];
  for (let k = 0; k < voci; k++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) throw new Error("zip: directory centrale corrotta");
    const metodo = buf.readUInt16LE(off + 10);
    const compressi = buf.readUInt32LE(off + 20);
    const nLen = buf.readUInt16LE(off + 28);
    const eLen = buf.readUInt16LE(off + 30);
    const cLen = buf.readUInt16LE(off + 32);
    const locale = buf.readUInt32LE(off + 42);
    const nome = buf.toString("utf8", off + 46, off + 46 + nLen);

    const inizio = locale + 30 + buf.readUInt16LE(locale + 26) + buf.readUInt16LE(locale + 28);
    const blocco = buf.subarray(inizio, inizio + compressi);
    if (metodo !== 0 && metodo !== 8) throw new Error(`zip: metodo di compressione ${metodo} non supportato`);
    out.push({ nome, dati: metodo === 0 ? Buffer.from(blocco) : inflateRawSync(blocco) });
    off += 46 + nLen + eLen + cLen;
  }
  return out;
}

// ------------------------------------------------------------------ GEOPOI

/** L'ultimo semestre pubblicato, nel formato di GEOPOI ("20261"). */
export async function semestreGeopoi(): Promise<string> {
  const elenco = (await (await scarica(`${GEOPOI}/zoneomi.php?richiesta=5`)).json()) as { SEMESTRE: string }[];
  const s = elenco[0]?.SEMESTRE;
  if (!s || !/^\d{5}$/.test(s)) throw new Error("GEOPOI non ha risposto con l'elenco dei semestri");
  return s;
}

export const semestreLeggibile = (s: string): string => `${s.slice(0, 4)}-${s.slice(4)}`;

/**
 * GEOPOI usa la ripartizione provinciale precedente al 2017: le province nate
 * dopo non esistono e i loro comuni stanno sotto quelle di origine. La sigla
 * ISTAT va quindi tradotta, ma solo verso sigle che GEOPOI conosce davvero.
 */
const ALIAS_PROVINCE: Record<string, string[]> = {
  BT: ["BA", "FG"],
  MB: ["MI"],
  FM: ["AP"],
  SU: ["CA", "CI", "VS"],
  // sigle cambiate nel tempo, non province nuove
  FC: ["FO"],
  PU: ["PS"],
};

export function traduciProvince(richieste: string[], note: string[]): { province: string[]; ignorate: string[] } {
  const conosciute = new Set(note);
  const province = new Set<string>();
  const ignorate: string[] = [];
  for (const sigla of richieste) {
    if (conosciute.has(sigla)) {
      province.add(sigla);
      continue;
    }
    const alias = (ALIAS_PROVINCE[sigla] ?? []).filter((a) => conosciute.has(a));
    if (alias.length === 0) ignorate.push(sigla);
    for (const a of alias) province.add(a);
  }
  return { province: [...province].sort(), ignorate };
}

export async function provinceGeopoi(): Promise<string[]> {
  const elenco = (await (await scarica(`${GEOPOI}/zoneomi.php?richiesta=1`)).json()) as { PROVINCIA: string }[];
  return elenco.map((p) => p.PROVINCIA);
}

async function scaricaPerimetriProvincia(prov: string, semestre: string): Promise<Feature[]> {
  const url = `${GEOPOI}/perimetri.php?id=1&prov=${encodeURIComponent(prov)}&codcom=&semestre=${semestre}&formato=kml`;
  const zip = Buffer.from(await (await scarica(url)).arrayBuffer());
  const features: Feature[] = [];
  for (const f of leggiZip(zip)) {
    if (/\.kml$/i.test(f.nome)) features.push(...kmlInGeoJson(f.dati.toString("utf8")).features);
  }
  return features;
}

/**
 * Perimetri lasciati a mano in data/omi/: i KML di GEOPOI (anche in zip) o un
 * GeoJSON gia' pronto. Un GeoJSON senza il codice comune nelle proprieta' lo
 * prende dal nome del file, `zone_F205.geojson`: e' il caso dei dataset open
 * data comunali, che pubblicano le zone di un comune solo.
 */
export async function leggiPerimetriLocali(): Promise<{ file: string; features: Feature[] }[]> {
  const out: { file: string; features: Feature[] }[] = [];
  if (!existsSync(OMI_DIR)) return out;
  for (const nome of await readdir(OMI_DIR)) {
    const minuscolo = nome.toLowerCase();
    if (minuscolo.endsWith(".kml")) {
      out.push({ file: nome, features: kmlInGeoJson(await readFile(join(OMI_DIR, nome), "utf-8")).features });
    } else if (minuscolo.endsWith(".zip")) {
      const features: Feature[] = [];
      for (const f of leggiZip(await readFile(join(OMI_DIR, nome)))) {
        if (/\.kml$/i.test(f.nome)) features.push(...kmlInGeoJson(f.dati.toString("utf8")).features);
      }
      out.push({ file: nome, features });
    } else if (minuscolo.endsWith(".geojson")) {
      const fc = JSON.parse(await readFile(join(OMI_DIR, nome), "utf-8")) as GeoJsonFeatureCollection;
      const dalNome = /zone_([A-Z]\d{3})\.geojson$/i.exec(nome)?.[1]?.toUpperCase();
      out.push({ file: nome, features: normalizzaFeature(fc.features ?? [], dalNome) });
    }
  }
  return out;
}

/** Porta le proprieta' di un GeoJSON qualunque a quelle che daGeoJson() legge. */
export function normalizzaFeature(features: Feature[], comuneCodDefault?: string): Feature[] {
  const out: Feature[] = [];
  for (const f of features) {
    const p = f.properties ?? {};
    const zona = p.zona ?? p.Zona ?? p.ZONA ?? p.cod_zona ?? p.CODZONA;
    const comuneCod = p.comune_cod ?? p.comune_amm ?? p.COMUNE_AMM ?? p.CODCOM ?? comuneCodDefault;
    if (!zona || !comuneCod || !f.geometry) continue;
    const descrizione = p.descrizione ?? p.Zona_Descr ?? p.Name ?? p.LINKZONA;
    out.push({
      type: "Feature",
      properties: { comune_cod: String(comuneCod), zona: String(zona), ...(descrizione ? { descrizione: String(descrizione) } : {}) },
      geometry: f.geometry,
    });
  }
  return out;
}

export interface EsitoPerimetri {
  semestre: string | null;
  province: string[];
  fileLocali: number;
  zoneScaricate: number;
  zoneTotali: number;
  /** province che non si sono potute scaricare, col motivo: si rilanciano con le sole sigle */
  errori: string[];
}

/**
 * Scarica i perimetri delle province indicate e li fonde in data/zone_omi.geojson:
 * i comuni gia' presenti vengono sostituiti, gli altri restano.
 */
export async function aggiornaPerimetri(
  province: string[],
  opz: { log?: (riga: string) => void; pausaMs?: number } = {},
): Promise<EsitoPerimetri> {
  const log = opz.log ?? (() => {});
  let esistenti: Feature[] = [];
  if (existsSync(ZONE_OMI_PATH)) {
    esistenti = (JSON.parse(await readFile(ZONE_OMI_PATH, "utf-8")) as GeoJsonFeatureCollection).features ?? [];
  }
  const sostituisci = (nuove: Feature[]): void => {
    const comuni = new Set(nuove.map((f) => String(f.properties?.comune_cod)));
    esistenti = esistenti.filter((f) => !comuni.has(String(f.properties?.comune_cod)));
    esistenti.push(...nuove);
  };

  // prima i file lasciati a mano: non costano una richiesta e possono coprire province intere
  const locali = await leggiPerimetriLocali();
  for (const l of locali) {
    sostituisci(l.features);
    log(`  ${l.file}: ${l.features.length} zone`);
  }

  const salva = (): Promise<void> =>
    writeFile(ZONE_OMI_PATH, JSON.stringify({ type: "FeatureCollection", features: esistenti }));
  await salva();

  let scaricate = 0;
  let semestre: string | null = null;
  const errori: string[] = [];
  if (province.length > 0) {
    semestre = await semestreGeopoi();
    const tradotte = traduciProvince(province, await provinceGeopoi());
    for (const sigla of tradotte.ignorate) errori.push(`${sigla}: provincia sconosciuta a GEOPOI`);
    province = tradotte.province;
    for (const prov of province) {
      await pausa(opz.pausaMs ?? PAUSA_MS);
      try {
        const nuove = await scaricaPerimetriProvincia(prov, semestre);
        sostituisci(nuove);
        scaricate += nuove.length;
        log(`  ${prov}: ${nuove.length} zone in ${new Set(nuove.map((f) => String(f.properties?.comune_cod))).size} comuni`);
      } catch (err) {
        // una provincia che non arriva non deve costare quelle gia' scaricate
        errori.push(`${prov}: ${(err as Error).message}`);
        log(`  ${prov}: ! ${(err as Error).message}`);
      }
      await salva();
    }
  }

  return {
    semestre: semestre ? semestreLeggibile(semestre) : null,
    province,
    fileLocali: locali.length,
    zoneScaricate: scaricate,
    zoneTotali: esistenti.length,
    errori,
  };
}

const pulisciCella = (html: string): string =>
  html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|&euro;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Legge la tabella della pagina di consultazione di una zona: una riga per
 * tipologia, con stato conservativo e forbice di compravendita in euro al mq.
 * Le righe di locazione non servono alla valutazione e restano fuori.
 */
export function analizzaStampaOmi(html: string): Omit<QuotazioneRecord, "comuneCod" | "zona" | "semestre">[] {
  const out: Omit<QuotazioneRecord, "comuneCod" | "zona" | "semestre">[] = [];
  for (const riga of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const celle = [...riga[1]!.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => pulisciCella(c[1]!));
    if (celle.length < 4) continue;
    const vendMin = numeroIt(celle[2]);
    const vendMax = numeroIt(celle[3]);
    if (!celle[0] || vendMin === null || vendMax === null) continue;
    out.push({ tipologia: celle[0], stato: celle[1] || undefined, vendMin, vendMax });
  }
  return out;
}

export interface ZonaDaQuotare {
  comuneCod: string;
  zona: string;
}

async function scaricaQuotazioniZona(z: ZonaDaQuotare, semestre: string, pausaMs: number): Promise<QuotazioneRecord[]> {
  await pausa(pausaMs);
  const url = `${GEOPOI}/zoneomi.php?richiesta=8&codcom=${z.comuneCod}&semestre=${semestre}&zo=${encodeURIComponent(z.zona)}`;
  const destinazioni = (await (await scarica(url)).json()) as { LINK_ZONA: string; DESCR_TIPOLOGIA: string }[];
  const out: QuotazioneRecord[] = [];
  for (const d of destinazioni) {
    await pausa(pausaMs);
    const lettera = d.DESCR_TIPOLOGIA.charAt(0).toUpperCase();
    const pagina = `${GEOPOI}/stampaomi.php?${z.comuneCod}/${d.LINK_ZONA}/${semestre}/${lettera}/${encodeURIComponent(z.zona)}/0/0`;
    const html = await (await scarica(pagina)).text();
    for (const r of analizzaStampaOmi(html)) {
      out.push({ ...r, comuneCod: z.comuneCod, zona: z.zona, semestre: semestreLeggibile(semestre) });
    }
  }
  return out;
}

export interface EsitoQuotazioniGeopoi {
  semestre: string;
  zoneRichieste: number;
  zoneGiaNote: number;
  record: number;
  totale: number;
}

/**
 * Chiede a GEOPOI le quotazioni delle sole zone indicate, saltando quelle di
 * cui data/quotazioni_omi.json ha gia' il semestre corrente.
 */
export async function aggiornaQuotazioniGeopoi(
  zone: ZonaDaQuotare[],
  opz: { log?: (riga: string) => void; pausaMs?: number } = {},
): Promise<EsitoQuotazioniGeopoi> {
  const log = opz.log ?? (() => {});
  const semestre = await semestreGeopoi();
  const leggibile = semestreLeggibile(semestre);
  const salvate = await caricaQuotazioniSalvate();
  const note = new Set(salvate.filter((q) => q.semestre >= leggibile).map((q) => `${q.comuneCod}|${q.zona}`));

  const nuove: QuotazioneRecord[] = [];
  let giaNote = 0;
  let richieste = 0;
  for (const z of zone) {
    if (note.has(`${z.comuneCod}|${z.zona}`)) {
      giaNote++;
      continue;
    }
    richieste++;
    try {
      const r = await scaricaQuotazioniZona(z, semestre, opz.pausaMs ?? PAUSA_MS);
      nuove.push(...r);
      log(`  ${z.comuneCod} ${z.zona}: ${r.length} quotazioni`);
    } catch (err) {
      log(`  ${z.comuneCod} ${z.zona}: ${(err as Error).message}`);
    }
  }
  const unite = unisciQuotazioni(salvate, nuove);
  await scriviQuotazioni(unite);
  return { semestre: leggibile, zoneRichieste: richieste, zoneGiaNote: giaNote, record: nuove.length, totale: unite.length };
}

// ------------------------------------------------------------------ comuni (ISTAT)

export interface ComuneInfo {
  /** Codice catastale (Belfiore), lo stesso che OMI usa come Comune_amm. */
  cod: string;
  prov: string;
  nome: string;
}

/** Chiave di confronto per i nomi di comune: maiuscole, senza accenti ne' punteggiatura. */
export function chiaveComune(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s*\([A-Z]{2}\)\s*$/, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

/** Dall'elenco ISTAT dei comuni (CSV con ';') alla mappa nome -> codice catastale e provincia. */
export function costruisciComuni(csv: string): Record<string, ComuneInfo> {
  const righe = analizzaCsv(csv.replace(/^﻿/, ""));
  const testa = righe[0] ?? [];
  const indice = (re: RegExp): number => testa.findIndex((c) => re.test(c));
  const iCod = indice(/codice catastale/i);
  const iProv = indice(/sigla automobilistica/i);
  const iNomeIt = indice(/denominazione in italiano/i);
  const iNomeAltro = indice(/denominazione altra lingua/i);
  const iNomeTutto = indice(/denominazione \(italiana/i);
  if (iCod < 0 || iProv < 0 || iNomeIt < 0) throw new Error("elenco ISTAT: colonne attese non trovate");

  const out: Record<string, ComuneInfo> = {};
  for (const r of righe.slice(1)) {
    const cod = r[iCod]?.trim();
    const prov = r[iProv]?.trim();
    const nome = r[iNomeIt]?.trim();
    if (!cod || !prov || !nome) continue;
    const info: ComuneInfo = { cod, prov, nome };
    const varianti = [nome, r[iNomeAltro] ?? "", ...(r[iNomeTutto] ?? "").split("/")];
    for (const v of varianti) {
      const k = chiaveComune(v);
      if (k && !out[k]) out[k] = info;
      // la forma senza preposizioni vive sotto un prefisso, cosi' non copre mai un nome esatto
      const kc = `~${chiaveComuneCompatta(v)}`;
      if (kc.length > 1 && !out[kc]) out[kc] = info;
    }
  }
  return out;
}

export async function scaricaComuniIstat(): Promise<number> {
  const grezzo = Buffer.from(await (await scarica(ISTAT_COMUNI)).arrayBuffer());
  const comuni = costruisciComuni(decodifica(grezzo));
  await writeFile(COMUNI_PATH, JSON.stringify(comuni));
  return new Set(Object.values(comuni).map((c) => c.cod)).size;
}

export async function caricaComuni(): Promise<Map<string, ComuneInfo> | null> {
  if (!existsSync(COMUNI_PATH)) return null;
  const obj = JSON.parse(await readFile(COMUNI_PATH, "utf-8")) as Record<string, ComuneInfo>;
  return new Map(Object.entries(obj));
}

/**
 * Lo stesso nome senza preposizioni: i portali scrivono "Santa Teresa di
 * Gallura" dove l'ISTAT ha "Santa Teresa Gallura". E' un secondo tentativo,
 * registrato a parte: la forma esatta vince sempre.
 */
export function chiaveComuneCompatta(nome: string): string {
  return chiaveComune(nome)
    .split(" ")
    .filter((p) => !PREPOSIZIONI.has(p))
    .join(" ");
}

const PREPOSIZIONI = new Set(["DI", "DEL", "DELLA", "DELLE", "DEI", "DEGLI", "DE", "DI", "AL", "SUL", "SULLA", "SULLE", "IN", "A"]);

export function risolviComune(nome: string, comuni: Map<string, ComuneInfo>): ComuneInfo | null {
  return comuni.get(chiaveComune(nome)) ?? comuni.get(`~${chiaveComuneCompatta(nome)}`) ?? null;
}

// ------------------------------------------------------------------ tipologia

/**
 * Dalla categoria del lotto alla tipologia OMI. Senza questo passaggio un
 * capannone verrebbe valutato come abitazione: un numero plausibile e
 * sbagliato, che e' peggio di nessun numero. "Terreni" non ha quotazioni al mq
 * in OMI, e infatti non produce alcuna stima.
 */
const SPECIFICHE = new Set(["Box", "Capannoni industriali", "Magazzini", "Uffici"]);

export function tipologiaDaSottotipo(sottotipo: string | null | undefined, descrizione?: string | null): string | undefined {
  const daTesto = (testo: string): string | undefined => {
    const t = testo.toUpperCase();
    if (/BOX|AUTORIMESS|POSTO AUTO|GARAGE/.test(t)) return "Box";
    if (/CAPANNON|INDUSTRIAL|PRODUTTIV|OPIFIC/.test(t)) return "Capannoni industriali";
    if (/MAGAZZIN|DEPOSIT/.test(t)) return "Magazzini";
    if (/UFFIC|DIREZIONAL/.test(t)) return "Uffici";
    if (/NEGOZ|COMMERCIAL|LOCALE COMM/.test(t)) return "Negozi";
    if (/VILL/.test(t)) return "Ville e Villini";
    if (/RESIDENZIAL|ABITAZ|APPARTAMENT/.test(t)) return "Abitazioni civili";
    if (/TERREN|AGRICOL|FONDO RUSTIC/.test(t)) return "Terreni";
    return undefined;
  };
  // Un indizio preciso nel testo ("magazzino", "box", "capannone", "ufficio")
  // vale piu' della categoria del portale, che e' generica: "commerciale"
  // copre anche i depositi, e un deposito quotato come negozio vale il doppio.
  const dalTesto = descrizione ? daTesto(descrizione) : undefined;
  const daCategoria = sottotipo && !/^ALTRA/i.test(sottotipo) ? daTesto(sottotipo) : undefined;
  // ...ma non su un residenziale: "appartamento con box auto" resta un appartamento.
  const generica = !daCategoria || daCategoria === "Negozi";
  if (generica && dalTesto && SPECIFICHE.has(dalTesto)) return dalTesto;
  if (daCategoria) return daCategoria;
  // "ALTRA_CATEGORIA" o nessuna categoria: resta la descrizione dell'annuncio.
  // Se nemmeno quella dice cos'e', meglio nessuna stima che una stima da abitazione.
  return dalTesto ?? (sottotipo || descrizione ? "Non classificata" : undefined);
}
