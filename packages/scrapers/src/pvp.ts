import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { estraiTestoPdf } from "./pdf.js";
import {
  leggiPerizia,
  ocrDisponibile,
  ocrPdf,
  scegliPerizia,
  testoLeggibile,
  VERSIONE_LETTORE,
  type AllegatoPvp,
  type EsitoPerizia,
} from "./perizia.js";
import { consentito, rallenta, USER_AGENT } from "./robots.js";
import type { ImmobileGrezzo, Scraper, ScrapeResult, SiteConfig } from "./types.js";

/**
 * Connettore del Portale delle Vendite Pubbliche (aste giudiziarie).
 *
 * Il PVP e' una single-page app che carica gli annunci da un'API pubblica, la
 * stessa che usa il browser di chi consulta il portale senza autenticarsi.
 * Leggerla direttamente e' piu' stabile e piu' leggero che fare scraping della
 * pagina resa: nessun browser, poche richieste, dati gia' strutturati (prezzo
 * base, offerta minima, coordinate, disponibilita', RGE, termine offerte).
 *
 * Tre passaggi, dal piu' leggero al piu' costoso:
 * 1. ricerca per tribunale e categoria, ordinata per data di vendita
 *    decrescente, fermandosi alle vendite gia' passate;
 * 2. dettaglio dei soli candidati (provincia e fascia di prezzo), per RGE,
 *    termine e modalita' di vendita;
 * 3. per i candidati, gli annunci passati della stessa procedura e dello stesso
 *    lotto: quante aste non hanno venduto. E' il segnale che conta per il
 *    binario A (docs/decisione-2026-10-18.md);
 * 4. per i candidati, la perizia di stima (perizia.ts): superficie, valore di
 *    mercato, conformita', occupazione. Ogni perizia si legge una volta: il
 *    risultato resta in una cache su disco legata alla versione del file.
 *
 * Dati personali: il dettaglio contiene delegato e custode (nome, codice
 * fiscale, contatti). Non si salvano: basta il link all'annuncio, dove chi deve
 * chiedere il sopralluogo li trova. Dal titolo si toglie anche l'intestazione
 * della procedura, che nelle liquidazioni porta il nome del debitore.
 */

export interface PvpConfig {
  /** Base dell'API di ricerca, es. https://pvp.giustizia.it/ric-.../ric-ms */
  apiRicerca: string;
  /** Base dell'API delle vendite (dettaglio), es. https://pvp.giustizia.it/ve-.../ve-ms */
  apiVendite: string;
  /** Nomi dei tribunali cosi' come li scrive il PVP: "Tribunale di MILANO". */
  tribunali: string[];
  /** Categorie di lotto, es. IMMOBILE_RESIDENZIALE, IMMOBILE_COMMERCIALE. */
  categorieLotto: string[];
  /**
   * Province dei beni da tenere, come le scrive il PVP ("Milano", "Monza e
   * della Brianza"). Un tribunale vende anche beni lontani (le procedure
   * concorsuali di Milano hanno lotti in Veneto e Trentino): fuori elenco si
   * scartano. Assente: tutte.
   */
  province?: string[];
  /** Fascia di prezzo base per aprire il dettaglio: fuori, l'annuncio resta con i dati della lista. */
  prezzoMin?: number;
  prezzoMax?: number;
  dimensionePagina: number;
  pagineMassime: number;
  /** Dettagli tentati al massimo per esecuzione: un tetto al carico su un servizio pubblico. */
  dettagliMassimi: number;
  /** Host degli allegati (la configurazione pubblica del portale lo chiama bucketsHost). */
  apiAllegati?: string;
  /** Perizie nuove da scaricare e leggere per esecuzione; 0 o assente: nessuna. */
  perizieMassime?: number;
  /** Perizie piu' grandi di cosi' (MB) non si scaricano. */
  perizieMbMassimi?: number;
  /** Pagine lette con l'OCR nelle perizie scansionate. */
  pagineOcr?: number;
}

/**
 * Cosa si conserva di una perizia: solo numeri, nessun testo. La chiave della
 * cache e' un'impronta del link, perche' i nomi dei file contengono spesso il
 * cognome del debitore.
 */
export type PeriziaInCache =
  | (EsitoPerizia & { letta: string; ocr: boolean; versione: number })
  /** Download o lettura falliti: si riprova, ma non per sempre. */
  | { fallita: true; tentativi: number; letta: string };

const TENTATIVI_PERIZIA = 2;

export interface OpzioniPvp {
  /** File JSON della cache delle perizie. */
  cachePerizie?: string;
  /** Testo di un PDF, pagina per pagina: sostituibile nei test, che non devono dipendere da pdfjs o Tesseract. */
  testoPdf?: (dati: Uint8Array) => Promise<{ pagine: string[]; ocr: boolean }>;
}

/** Cache predefinita: accanto all'archivio, nella cartella dati del progetto. */
function cachePredefinita(): string {
  const radice = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
  return join(process.env.QDR_DATA_DIR ?? join(radice, "data"), "perizie_pvp.json");
}

async function testoPdfPredefinito(dati: Uint8Array, pagineOcr: number): Promise<{ pagine: string[]; ocr: boolean }> {
  const ocr = await ocrDisponibile();
  let pagine: string[] = [];
  try {
    pagine = await estraiTestoPdf(dati);
  } catch {
    // un PDF che pdfjs non apre puo' ancora passare dall'OCR
  }
  if (testoLeggibile(pagine) || !ocr) return { pagine, ocr };
  return { pagine: await ocrPdf(dati, pagineOcr), ocr };
}

export interface AnnuncioLista {
  id: number;
  tipoLotto?: string;
  categoriaLotto?: string;
  categoriaBene?: string[];
  indirizzo?: {
    via?: string;
    citta?: string;
    provincia?: string;
    coordinate?: { latitudine?: number | null; longitudine?: number | null } | null;
  };
  numeroLotto?: string;
  procedura?: string;
  prezzoBaseAsta?: number;
  offertaMinima?: number;
  dataVendita?: string | null;
  disponibilita?: string[];
  descLotto?: string | null;
  tribunale?: string;
  codiceTribunale?: string;
}

interface Dettaglio {
  descTipoVendita?: string;
  descModVendita?: string;
  dataTermPresOff?: string;
  lotto?: { idLotto?: number; codLotto?: string | null };
  allegati?: AllegatoPvp[];
  procedura?: { numeRg?: number | string; numeAnnoRg?: number | string; descTipoRito?: string; codTipoRegistro?: string };
}

interface Pagina {
  content: AnnuncioLista[];
  last: boolean;
}

const DISPONIBILITA: Record<string, string> = {
  LIBER: "Libero",
  OCCUP: "Occupato",
  OCCST: "Occupato dal debitore",
  INCOR: "In corso di liberazione",
};

/** Guasti di fila oltre i quali si smette di chiamare il dettaglio: il servizio e' giu'. */
const MASSIMO_GUASTI_DI_FILA = 3;
const TIMEOUT_MS = 30_000;

/**
 * Categoria catastale dalla descrizione del lotto ("cat.A3", "categoria
 * catastale: A/2", "Cat. C-6"). Un lotto unisce spesso abitazione, cantina e
 * box: se c'e' un'abitazione (A/1-A/9, A/11) vale quella, altrimenti la prima.
 */
export function categoriaCatastale(desc: string): string | null {
  const trovate = [
    ...desc.matchAll(/\bcat(?:egoria|\.)?(?:\s*catastale)?[\s.:]*([A-F])\s*[/-]?\s*(\d{1,2})\b/gi),
  ].map((m) => `${m[1]!.toUpperCase()}/${Number(m[2])}`);
  return trovate.find((c) => c.startsWith("A/") && c !== "A/10") ?? trovate[0] ?? null;
}

/** "1.809,00" -> 1809, "31.227" -> 31227, "249,60" -> 249.6, "95.5" -> 95.5 */
function numeroItaliano(s: string): number | null {
  let t = s.replace(/[.,]+$/, "");
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, "");
  t = t.replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Parole che, subito prima di una superficie, dicono che non e' quella dell'immobile. */
const ACCESSORIO =
  /(giardin\w*|terren\w*|cort\w*|cortil\w*|area|terrazz\w*|lastric\w*|box|autorimess\w*|posti? auto|parcheggi\w*)\W+(?:\w+\W+){0,3}$/i;

/**
 * Superficie del bene dalla descrizione libera del delegato.
 *
 * Solo numeri attaccati a "mq" (prima o dopo): mai il primo numero del testo,
 * che spesso e' un RGE o un foglio catastale. Fra i candidati vince quello
 * introdotto da "superficie" o "sup.", poi il primo: la descrizione parte
 * quasi sempre dall'unita' principale. Si scartano le superfici di giardini,
 * terreni, cortili, terrazzi e box, che non sono superficie dell'immobile.
 */
export function superficieDaDescrizione(desc: string): number | null {
  const testo = desc.replace(/m²|(?<![a-z])m2\b|metri quadr\w*/gi, "mq");
  const numero = String.raw`(\d[\d.]*(?:,\d+)?)`;
  const candidati: { n: number; indice: number; prima: string }[] = [];
  for (const re of [new RegExp(`${numero}\\s*mq\\b`, "gi"), new RegExp(`\\bmq\\.?\\)?[\\s:]*(?:di\\s*)?${numero}`, "gi")]) {
    for (const m of testo.matchAll(re)) {
      const n = numeroItaliano(m[1]!);
      const prima = testo.slice(Math.max(0, m.index - 40), m.index);
      if (n && !ACCESSORIO.test(prima)) candidati.push({ n, indice: m.index, prima });
    }
  }
  // "sup. comm. 255 circa": la superficie dichiarata come tale, anche senza l'unita'
  for (const m of testo.matchAll(new RegExp(`\\b(?:superficie|sup\\.)\\s*(?:commerciale|comm\\.|lorda|netta)\\s*(?:di\\s*)?(?:circa\\s*)?${numero}(?!\\s*[/%])`, "gi"))) {
    const n = numeroItaliano(m[1]!);
    if (n && n >= 15) candidati.push({ n, indice: m.index, prima: "superficie" });
  }
  candidati.sort((a, b) => a.indice - b.indice);
  const introdotto = candidati.find((c) => /(superficie|sup\.)[^.;]*$/i.test(c.prima));
  return (introdotto ?? candidati[0])?.n ?? null;
}

/**
 * Titolo dalla descrizione, senza l'intestazione della procedura
 * ("Liquidazione Giudiziale Mario Rossi D.I. R.G. 56/2026: ..."), che nelle
 * procedure concorsuali porta il nome del debitore e al radar non serve.
 */
export function titoloDaDescrizione(desc: string): string {
  const senzaIntestazione = desc.replace(/^[^:]{0,160}\bR\.?\s?G\.?\s?E?\.?\s*(?:n\.?\s*)?\d+\s*\/\s*\d{2,4}\s*:\s*/i, "");
  // lungo abbastanza da contenere "quota di 1/3" o "nuda proprieta'", che il
  // filtro di perimetro del Gate 0 legge nel titolo
  return senzaIntestazione.slice(0, 300);
}

/** Dalla risposta dell'API all'annuncio del radar: solo cio' che serve, nessun dato personale. */
export function annuncioDaLista(a: AnnuncioLista, fonte: string): ImmobileGrezzo {
  const desc = (a.descLotto ?? "").replace(/\s+/g, " ").trim();
  const mq = superficieDaDescrizione(desc);
  const disp = (a.disponibilita ?? []).map((d) => DISPONIBILITA[d]).filter(Boolean);
  const c = coordinate(a);
  return {
    fonte,
    idEsterno: String(a.id),
    url: `https://pvp.giustizia.it/pvp/it/detail_annuncio.page?idAnnuncio=${a.id}`,
    titolo: titoloDaDescrizione(desc) || `${a.categoriaBene?.join(", ") ?? "Immobile"} a ${a.indirizzo?.citta ?? ""}`,
    prezzo: a.prezzoBaseAsta || null,
    tipoPrezzo: "base_asta",
    comune: a.indirizzo?.citta ?? null,
    indirizzoRaw: a.indirizzo?.via ?? null,
    lat: c?.lat ?? null,
    lon: c?.lon ?? null,
    tribunale: a.tribunale ?? null,
    numeroLotto: lottoProprio(a) ?? a.numeroLotto ?? null,
    dataAsta: a.dataVendita ?? null,
    // sotto i 15 mq e' una cantina o un posto auto, o un numero letto male
    mq: mq && mq >= 15 ? mq : null,
    statoOccupazionale: disp.length ? [...new Set(disp)].join(", ") : null,
    sottotipoAsset:
      categoriaCatastale(desc) ?? ([a.categoriaLotto, ...(a.categoriaBene ?? [])].filter(Boolean).join(" / ") || null),
  };
}

/** Distanza in metri fra due punti, abbastanza precisa sotto il chilometro. */
function metri(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const k = 111_320;
  const dx = (a.lon - b.lon) * k * Math.cos((a.lat * Math.PI) / 180);
  const dy = (a.lat - b.lat) * k;
  return Math.hypot(dx, dy);
}

function coordinate(x: AnnuncioLista): { lat: number; lon: number } | null {
  const c = x.indirizzo?.coordinate;
  return c?.latitudine != null && c?.longitudine != null ? { lat: c.latitudine, lon: c.longitudine } : null;
}

/**
 * Numero del lotto confrontabile fra annunci: "LOTTO UNICO", "Lotto n. 1",
 * "01" diventano "1". Null quando il portale ha messo al suo posto
 * l'identificativo dell'annuncio o un codice interno lungo.
 */
function lottoProprio(x: AnnuncioLista): string | null {
  const n = (x.numeroLotto ?? "").trim().toUpperCase();
  if (!n || n === String(x.id) || /^\d{6,}$/.test(n)) return null;
  const pulito = n.replace(/^LOTTO\s*/, "").replace(/^(N\.?|N°|NR\.?)\s*/, "").replace(/^0+(?=\d)/, "").trim();
  return pulito === "UNICO" ? "1" : pulito;
}

const viaNorm = (x: AnnuncioLista) => (x.indirizzo?.via ?? "").split(",")[0]!.toUpperCase().replace(/[^A-Z0-9]/g, "");

/**
 * `prec` e' un'asta precedente dello stesso bene di `a`?
 *
 * La ricerca per numero e anno di procedura mescola registri diversi (una
 * esecuzione 92/2024 e una liquidazione 92/2024 hanno lo stesso numero) e,
 * nelle procedure con molti lotti, lotti diversi. Per non contare come
 * deserta l'asta di un altro bene si chiede tutto insieme:
 * - una data precedente;
 * - lo stesso comune e lo stesso posto: meno di 300 metri se entrambe hanno
 *   coordinate, altrimenti la stessa via scritta allo stesso modo;
 * - lo stesso numero di lotto, salvo quando il portale lo ha sostituito con
 *   l'identificativo dell'annuncio: allora servono meno di 50 metri;
 * - un prezzo base non inferiore, quando entrambi lo dichiarano: dopo un'asta
 *   deserta il prezzo scende.
 */
export function stessoLottoPrecedente(prec: AnnuncioLista, a: AnnuncioLista): boolean {
  if (prec.id === a.id || !prec.dataVendita || !a.dataVendita || !(prec.dataVendita < a.dataVendita)) return false;
  const citta = (x: AnnuncioLista) => (x.indirizzo?.citta ?? "").trim().toLowerCase();
  if (!citta(a) || citta(prec) !== citta(a)) return false;
  const [cp, ca] = [coordinate(prec), coordinate(a)];
  const distanza = cp && ca ? metri(cp, ca) : null;
  if (distanza != null ? distanza > 300 : !viaNorm(a) || viaNorm(prec) !== viaNorm(a)) return false;
  const [lp, la] = [lottoProprio(prec), lottoProprio(a)];
  if (lp && la) {
    if (lp !== la) return false;
  } else if (distanza == null || distanza > 50) {
    return false;
  }
  const [pp, pa] = [prec.prezzoBaseAsta ?? 0, a.prezzoBaseAsta ?? 0];
  return !(pp > 0 && pa > 0 && pp < pa * 0.99);
}

/** "13/01/2027" o "13/01/2027 12:00" -> "2027-01-13" */
const dataIso = (s: string | undefined): string | null => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s ?? "");
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};

const normalizzaProvincia = (s: string | undefined) => (s ?? "").trim().toLowerCase();

export class PvpScraper implements Scraper {
  readonly name: string;
  private readonly pvp: PvpConfig;

  constructor(
    private readonly config: SiteConfig,
    private readonly oggi: () => string = oggiARoma,
    private readonly opzioni: OpzioniPvp = {},
  ) {
    this.name = config.name;
    if (!config.pvp) throw new Error(`"${config.name}": fetchMode pvp senza blocco "pvp" nel config`);
    this.pvp = config.pvp;
  }

  async scrape(): Promise<ScrapeResult> {
    const result: ScrapeResult = { source: this.name, items: [], errors: [] };
    if (this.config.compliance?.stato !== "consentito") {
      result.errors.push(
        `"${this.name}" non e' stata autorizzata: compliance.stato = "${this.config.compliance?.stato ?? "assente"}".`,
      );
      return result;
    }
    if (!(await consentito(this.pvp.apiRicerca))) {
      result.errors.push(`robots.txt vieta ${this.pvp.apiRicerca}: salto.`);
      return result;
    }

    const oggi = this.oggi();
    const province = this.pvp.province?.length ? new Set(this.pvp.province.map(normalizzaProvincia)) : null;
    const visti = new Set<number>();
    const lista: AnnuncioLista[] = [];
    for (const tribunale of this.pvp.tribunali) {
      for (const categoria of this.pvp.categorieLotto) {
        try {
          for (const a of await this.cercaFuture(tribunale, categoria, oggi, result.errors)) {
            if (visti.has(a.id)) continue;
            visti.add(a.id);
            if (!province || province.has(normalizzaProvincia(a.indirizzo?.provincia))) lista.push(a);
          }
        } catch (err) {
          result.errors.push(`Ricerca ${tribunale} / ${categoria}: ${(err as Error).message}`);
        }
      }
    }

    const inFascia = (a: AnnuncioLista) =>
      (a.prezzoBaseAsta ?? 0) >= (this.pvp.prezzoMin ?? 0) && (a.prezzoBaseAsta ?? 0) <= (this.pvp.prezzoMax ?? Infinity);
    const items = lista.map((a) => ({ a, item: annuncioDaLista(a, this.name) }));
    // senza superficie dichiarata un lotto puo' ancora essere da binario A: sta
    // dopo quelli da almeno 200 mq e prima di quelli dichiarati piu' piccoli
    const peso = (mq: number | null | undefined) => mq ?? 199.5;
    const candidati = items.filter(({ a }) => inFascia(a)).sort((x, y) => peso(y.item.mq) - peso(x.item.mq));

    let tentati = 0;
    let guastiDiFila = 0;
    const conPerizia: { item: ImmobileGrezzo; allegato: AllegatoPvp }[] = [];
    for (const { a, item } of candidati) {
      if (tentati >= this.pvp.dettagliMassimi) {
        result.errors.push(
          `${this.name}: dettagli limitati a ${this.pvp.dettagliMassimi} su ${candidati.length} candidati, gli altri restano coi dati della lista.`,
        );
        break;
      }
      if (guastiDiFila >= MASSIMO_GUASTI_DI_FILA) {
        result.errors.push(`${this.name}: ${guastiDiFila} dettagli falliti di fila, smetto di chiamare il servizio.`);
        break;
      }
      tentati++;
      try {
        const det = await this.dettaglio(a.id);
        guastiDiFila = 0;
        const proc = det.procedura ?? {};
        item.tipoVendita = [det.descTipoVendita, det.descModVendita, proc.descTipoRito].filter(Boolean).join(", ") || null;
        item.termineOfferte = dataIso(det.dataTermPresOff) ?? item.termineOfferte ?? null;
        if (!lottoProprio(a) && det.lotto?.codLotto) item.numeroLotto = det.lotto.codLotto;
        const perizia = scegliPerizia(det.allegati ?? [], item.numeroLotto);
        if (perizia) conPerizia.push({ item, allegato: perizia });
        const numero = Number(proc.numeRg) || null;
        const anno = Number(proc.numeAnnoRg) || null;
        // l'RGE e' il numero delle esecuzioni immobiliari; una liquidazione o una
        // divisione con lo stesso numero e' un'altra procedura, e la deduplica fra
        // fonti la confonderebbe con l'esecuzione
        if (/ESECUZIONI.*IMMOBILIARI/i.test(proc.codTipoRegistro ?? "")) {
          item.numeroRge = numero;
          item.annoRge = anno;
        }
        if (numero && anno && a.tribunale) {
          item.nEsperimentiDeserti = await this.esperimentiPrecedenti(a, numero, anno, result.errors);
        }
      } catch (err) {
        guastiDiFila++;
        result.errors.push(`Dettaglio ${a.id}: ${(err as Error).message}`);
      }
    }

    if (this.pvp.apiAllegati && conPerizia.length) {
      // le perizie arricchiscono: un loro guasto non deve costare gli annunci gia' raccolti
      try {
        await this.leggiPerizie(conPerizia, result.errors);
      } catch (err) {
        result.errors.push(`Perizie: ${(err as Error).message}`);
      }
    }

    result.items = items.map(({ item }) => item);
    return result;
  }

  /**
   * Applica le perizie gia' lette e ne legge di nuove, fino al tetto. Prima i
   * lotti senza superficie: sono quelli che il Gate 0 non riesce a valutare.
   */
  private async leggiPerizie(lotti: { item: ImmobileGrezzo; allegato: AllegatoPvp }[], errori: string[]): Promise<void> {
    const file = this.opzioni.cachePerizie ?? cachePredefinita();
    const cache = await leggiCache(file, errori);
    const ocrOra = this.opzioni.testoPdf ? true : await ocrDisponibile();
    const massime = this.pvp.perizieMassime ?? 0;
    const byteMassimi = (this.pvp.perizieMbMassimi ?? 25) * 1024 * 1024;
    const ordinati = [...lotti].sort((x, y) => Number(x.item.mq != null) - Number(y.item.mq != null));
    let nuove = 0;
    let illeggibili = 0;
    let modificata = false;
    // voci di versioni precedenti, con il link (e quindi il nome del file) come chiave: via
    for (const k of Object.keys(cache)) {
      if (!/^[0-9a-f]{32}$/.test(k)) {
        delete cache[k];
        modificata = true;
      }
    }
    for (const { item, allegato } of ordinati) {
      // lo stesso file puo' servire piu' lotti della procedura: il risultato dipende dal lotto
      const chiave = createHash("sha256").update(`${allegato.linkAllegato}|${item.numeroLotto ?? ""}`).digest("hex").slice(0, 32);
      let voce = cache[chiave];
      const daRileggere =
        !voce ||
        ("fallita" in voce ? voce.tentativi < TENTATIVI_PERIZIA : voce.versione !== VERSIONE_LETTORE || (!voce.leggibile && !voce.ocr && ocrOra));
      if (daRileggere) {
        if (nuove >= massime || (allegato.dimensioneAllegato ?? 0) > byteMassimi) {
          if (!voce || "fallita" in voce) continue;
        } else {
          nuove++;
          try {
            const dati = await this.scaricaAllegato(allegato.linkAllegato!, byteMassimi);
            const { pagine, ocr } = this.opzioni.testoPdf
              ? await this.opzioni.testoPdf(dati)
              : await testoPdfPredefinito(dati, this.pvp.pagineOcr ?? 30);
            voce = { ...leggiPerizia(pagine, item.numeroLotto), letta: this.oggi(), ocr, versione: VERSIONE_LETTORE };
          } catch (err) {
            // nell'errore solo l'annuncio: il messaggio puo' contenere il nome del file
            errori.push(`Perizia dell'annuncio ${item.idEsterno}: ${(err as Error).message.replace(/https?:\S+/g, "<allegato>")}`);
            const tentativi = voce && "fallita" in voce ? voce.tentativi + 1 : 1;
            voce = { fallita: true, tentativi, letta: this.oggi() };
          }
          cache[chiave] = voce;
          modificata = true;
        }
      }
      if (!voce || "fallita" in voce) continue;
      if (!voce.leggibile) {
        illeggibili++;
        continue;
      }
      // la superficie catastale comprende balconi e cantine: solo se il delegato non ne ha scritta una
      if (voce.mq && (voce.fonteMq !== "catastale" || item.mq == null)) item.mq = voce.mq;
      // il core intende per valore di perizia quello dopo le decurtazioni
      if (voce.valoreGiudiziario) item.valorePerizia = voce.valoreGiudiziario;
      if (voce.conformita) item.conformitaUrb = voce.conformita;
      item.statoOccupazionale = statoConPerizia(item.statoOccupazionale ?? null, voce.statoOccupativo);
    }
    if (illeggibili) {
      errori.push(`${illeggibili} perizie illeggibili${ocrOra ? "" : ": scansioni, serve l'OCR (tesseract-ocr e poppler-utils)"}.`);
    }
    if (modificata) {
      await mkdir(dirname(file), { recursive: true });
      const temporaneo = `${file}.${process.pid}.tmp`;
      await writeFile(temporaneo, JSON.stringify(cache, null, 1));
      await rename(temporaneo, file);
    }
  }

  /**
   * Un allegato dal bucket pubblico del portale, con le stesse regole di
   * cortesia delle API. I link del portale non sono codificati (spazi, "°",
   * "#", "%" nei nomi): si codifica ogni segmento del percorso, e la query
   * comincia solo da "?versionId=".
   */
  private async scaricaAllegato(link: string, byteMassimi: number): Promise<Uint8Array> {
    const url = urlAllegato(this.pvp.apiAllegati!, link);
    if (!(await consentito(url))) throw new Error("robots.txt vieta l'allegato");
    await rallenta(this.name, this.config.rateLimitSeconds);
    const resp = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(120_000) });
    if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`);
    if (Number(resp.headers.get("content-length") ?? 0) > byteMassimi) {
      await resp.body.cancel();
      throw new Error("allegato oltre il limite di dimensione");
    }
    // a flusso: un allegato senza dimensione dichiarata non deve riempire la memoria
    const parti: Uint8Array[] = [];
    let totale = 0;
    const lettore = resp.body.getReader();
    for (;;) {
      const { done, value } = await lettore.read();
      if (done) break;
      totale += value.length;
      if (totale > byteMassimi) {
        await lettore.cancel();
        throw new Error("allegato oltre il limite di dimensione");
      }
      parti.push(value);
    }
    const dati = new Uint8Array(totale);
    let pos = 0;
    for (const p of parti) {
      dati.set(p, pos);
      pos += p.length;
    }
    // %PDF: un errore servito come pagina HTML non va passato al lettore
    if (!(dati[0] === 0x25 && dati[1] === 0x50 && dati[2] === 0x44 && dati[3] === 0x46)) throw new Error("l'allegato non e' un PDF");
    return dati;
  }

  /** Vendite future di un tribunale e una categoria, dalla piu' lontana a oggi. */
  private async cercaFuture(tribunale: string, categoria: string, oggi: string, errori: string[]): Promise<AnnuncioLista[]> {
    const out: AnnuncioLista[] = [];
    let senzaData = 0;
    for (let pagina = 0; ; pagina++) {
      if (pagina >= this.pvp.pagineMassime) {
        // l'ordine e' decrescente: cio' che resta fuori sono le aste piu' vicine
        errori.push(`Ricerca ${tribunale} / ${categoria}: raggiunte ${pagina} pagine senza arrivare a oggi, mancano le aste piu' vicine.`);
        break;
      }
      const corpo = await this.ricerca(
        { tribunale, tipoLotto: "IMMOBILI", categoriaLotto: categoria, categoriaBene: [], flagRicerca: 1 },
        pagina,
        "dataOraVendita,desc",
      );
      let passate = false;
      for (const a of corpo.content) {
        if (!a.dataVendita) senzaData++;
        else if (a.dataVendita >= oggi) out.push(a);
        else passate = true;
      }
      if (passate || corpo.last || corpo.content.length === 0) break;
    }
    if (senzaData) errori.push(`Ricerca ${tribunale} / ${categoria}: ${senzaData} annunci senza data di vendita, saltati.`);
    return out;
  }

  /**
   * Quante aste della stessa procedura e dello stesso lotto si sono gia' tenute
   * prima di questa. Una vendita ripubblicata nasce spesso con un nuovo
   * identificativo, quindi si cerca per procedura (numero e anno) e si tengono
   * solo le aste che stessoLottoPrecedente() riconosce come lo stesso bene, una
   * per data (le rettifiche ripubblicano lo stesso esperimento).
   * Un'asta seguita da un'altra dello stesso bene non ha venduto: deserta, o
   * aggiudicata e decaduta. Il dettaglio non distingue i due casi.
   */
  private async esperimentiPrecedenti(a: AnnuncioLista, numero: number, anno: number, errori: string[]): Promise<number> {
    // le piu' recenti prima: in una procedura con molte vendite sono quelle che contano
    const corpo = await this.ricerca(
      { tribunale: a.tribunale, procedura: String(numero), anno: String(anno), categoriaBene: [], flagRicerca: 1 },
      0,
      "dataOraVendita,desc",
      100,
    );
    if (!corpo.last) errori.push(`Procedura ${numero}/${anno}: oltre 100 vendite, aste precedenti contate sulle 100 piu' recenti.`);
    return new Set(corpo.content.filter((x) => stessoLottoPrecedente(x, a)).map((x) => x.dataVendita)).size;
  }

  private async ricerca(
    filtri: Record<string, unknown>,
    pagina: number,
    ordine: string,
    dimensione = this.pvp.dimensionePagina,
  ): Promise<Pagina> {
    const url = `${this.pvp.apiRicerca}/ricerca/vendite?language=it&page=${pagina}&size=${dimensione}&sort=${ordine}`;
    const json = (await this.chiama(url, { method: "POST", body: JSON.stringify(filtri) })) as {
      messaggio?: string;
      body?: { content?: unknown; last?: boolean } | null;
    } | null;
    // una busta senza elenco e' un errore del servizio, non zero annunci
    const corpo = json?.body;
    if (!corpo || !Array.isArray(corpo.content)) {
      throw new Error(`risposta senza elenco${json?.messaggio ? `: ${json.messaggio}` : ""}`);
    }
    return { content: corpo.content as AnnuncioLista[], last: corpo.last ?? true };
  }

  private async dettaglio(id: number): Promise<Dettaglio> {
    const json = (await this.chiama(`${this.pvp.apiVendite}/vendite/${id}/restricted`, { method: "GET" })) as {
      messaggio?: string;
      body?: Dettaglio | null;
    } | null;
    if (!json?.body || typeof json.body !== "object") {
      throw new Error(`dettaglio vuoto${json?.messaggio ? `: ${json.messaggio}` : ""}`);
    }
    return json.body;
  }

  /**
   * Una chiamata rallentata. Due nuovi tentativi se la connessione cade o il
   * servizio risponde 5xx o 429, attendendo almeno quanto chiede Retry-After.
   * Un 4xx o una risposta che non e' JSON (pagina di manutenzione) non si
   * ritentano: ripeterli non cambia l'esito.
   */
  private async chiama(url: string, init: { method: string; body?: string }): Promise<unknown> {
    let ultimoErrore: Error = new Error("nessun tentativo");
    let attesaMinima = 0;
    for (let tentativo = 0; tentativo < 3; tentativo++) {
      await rallenta(this.name, Math.max(this.config.rateLimitSeconds * (tentativo + 1), attesaMinima));
      let resp: Response;
      try {
        resp = await fetch(url, {
          ...init,
          headers: { "User-Agent": USER_AGENT, "Content-Type": "application/json", Accept: "application/json" },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch (err) {
        ultimoErrore = err as Error;
        continue;
      }
      if (resp.status >= 500 || resp.status === 429) {
        attesaMinima = Number(resp.headers.get("retry-after")) || 0;
        ultimoErrore = new Error(`HTTP ${resp.status}`);
        await resp.body?.cancel();
        // chi chiede di aspettare piu' di due minuti chiede di tornare un altro giorno
        if (attesaMinima > 120) throw new Error(`HTTP ${resp.status}, Retry-After ${attesaMinima} s: rinuncio`);
        continue;
      }
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const testo = await resp.text();
      try {
        return JSON.parse(testo);
      } catch {
        throw new Error(`risposta non JSON (${testo.slice(0, 60).replace(/\s+/g, " ")})`);
      }
    }
    throw ultimoErrore;
  }
}

/** URL di un allegato: segmenti codificati uno per uno, query solo da "?versionId=". */
export function urlAllegato(host: string, link: string): string {
  const q = link.lastIndexOf("?versionId=");
  const percorso = q >= 0 ? link.slice(0, q) : link;
  const query = q >= 0 ? link.slice(q) : "";
  const segmenti = percorso.split("/").map((seg) => encodeURIComponent(seg));
  return `${host.replace(/\/+$/, "")}${segmenti.join("/")}${query.replace(/^\?versionId=(.*)$/, (_, v: string) => `?versionId=${encodeURIComponent(v)}`)}`;
}

/** La cache delle perizie; se il file e' corrotto si mette da parte e si riparte da vuota. */
async function leggiCache(file: string, errori: string[]): Promise<Record<string, PeriziaInCache>> {
  if (!existsSync(file)) return {};
  try {
    const dati = JSON.parse(await readFile(file, "utf-8")) as unknown;
    if (dati && typeof dati === "object" && !Array.isArray(dati)) return dati as Record<string, PeriziaInCache>;
    throw new Error("formato inatteso");
  } catch (err) {
    errori.push(`Cache delle perizie illeggibile (${(err as Error).message}): spostata in .corrotto, si riparte da vuota.`);
    await rename(file, `${file}.corrotto`).catch(() => undefined);
    return {};
  }
}

function oggiARoma(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" }).format(new Date());
}

/**
 * Stato occupativo del portale e della perizia. Se dicono la stessa cosa vale
 * quello del portale; se si contraddicono (Arluno: "Libero" sul PVP, occupato
 * da terzi senza titolo nella perizia) si mostrano entrambi: il "libero" del
 * portale puo' voler dire "da liberare a cura della procedura", e chi valuta
 * deve vedere il dubbio invece di una sola versione.
 */
export function statoConPerizia(portale: string | null, perizia: string | null): string | null {
  if (!perizia) return portale;
  if (!portale) return perizia;
  const senso = (s: string) => (/occupat/i.test(s) ? "occupato" : /liber/i.test(s) ? "libero" : null);
  const a = senso(portale);
  const b = senso(perizia);
  if (a === b || a == null || b == null) return portale;
  return `${portale} (PVP); ${perizia}`;
}
