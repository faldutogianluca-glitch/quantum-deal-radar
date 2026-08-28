import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import { parseDataIt, parseImporto } from "./parsing.js";
import { consentito, USER_AGENT } from "./robots.js";
import type { ImmobileGrezzo, PdfConfig, SiteConfig } from "./types.js";

/**
 * Lettura dei bandi e degli elenchi pubblicati in PDF.
 *
 * Diversi enti — Banca d'Italia, INPS, Credit Agricole, CDP — non espongono un
 * elenco di schede HTML: pubblicano un documento. Un parser di selettori CSS li'
 * non serve a niente, e fingere che siano scrapabili avrebbe solo rimandato il
 * problema.
 *
 * Il testo di un PDF non ha struttura: e' una sequenza di righe. Il modo che
 * regge meglio nel tempo e' descrivere la riga-lotto con una sola espressione
 * regolare a gruppi nominati, dove ogni nome corrisponde a un campo. Cosi' la
 * calibrazione su un documento nuovo e' una riga di configurazione, non codice.
 */

/** Testo di un PDF, una stringa per pagina. */
export type TestoPdf = string[];

/**
 * Estrae il testo, pagina per pagina.
 *
 * pdfjs e' una dipendenza opzionale, importata solo qui: chi non usa fonti PDF
 * non deve installarla. Il messaggio d'errore lo dice, invece di lasciare un
 * "cannot find module" a chi non sa di che si tratta.
 */
/**
 * La parte di pdfjs che usiamo, descritta qui invece che importandone i tipi.
 *
 * pdfjs-dist e' una dipendenza OPZIONALE: chi non usa fonti PDF non la
 * installa. Referenziarne i tipi — anche solo con `typeof import(...)` — la
 * renderebbe obbligatoria per la compilazione, e un'opzionale che rompe il
 * build non e' opzionale. Queste interfacce sono il contratto minimo, e
 * l'import avviene con uno specificatore non letterale proprio perche' il
 * compilatore non provi a risolverlo.
 */
interface VocePdf {
  str?: string;
  hasEOL?: boolean;
}
interface PaginaPdf {
  getTextContent(): Promise<{ items: VocePdf[] }>;
}
interface DocumentoPdf {
  numPages: number;
  getPage(n: number): Promise<PaginaPdf>;
  cleanup(): Promise<void>;
}
interface ApiPdfJs {
  getDocument(opzioni: {
    data: Uint8Array;
    useSystemFonts?: boolean;
    standardFontDataUrl?: string;
  }): { promise: Promise<DocumentoPdf> };
}

const MODULO_PDFJS = "pdfjs-dist/legacy/build/pdf.mjs";

export async function estraiTestoPdf(dati: Uint8Array): Promise<TestoPdf> {
  let pdfjs: ApiPdfJs;
  try {
    pdfjs = (await import(MODULO_PDFJS)) as ApiPdfJs;
  } catch {
    throw new Error(
      "Per leggere i PDF serve pdfjs-dist, che e' una dipendenza opzionale.\n" +
        "  Esegui:  npm install",
    );
  }

  // Senza standardFontDataUrl pdfjs stampa un warning a ogni documento. Non e'
  // un errore, ma sporca l'output di un comando che deve restare leggibile: chi
  // legge non ha modo di sapere che quel messaggio e' innocuo.
  const doc = await pdfjs.getDocument({
    data: dati,
    useSystemFonts: false,
    standardFontDataUrl: cartellaFontStandard(),
  }).promise;
  try {
    const pagine: string[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const pagina = await doc.getPage(n);
      const contenuto = await pagina.getTextContent();
      // hasEOL segna dove il PDF va a capo: senza, l'intera pagina diventa una
      // riga sola e nessuna regex per riga potrebbe funzionare
      const testo = contenuto.items
        .map((v) => (v.str ?? "") + (v.hasEOL ? "\n" : ""))
        .join("");
      pagine.push(normalizza(testo));
    }
    return pagine;
  } finally {
    // libera il worker: senza, il processo resta appeso a fine comando
    await doc.cleanup();
  }
}

/**
 * I font standard che pdfjs si aspetta di trovare accanto a se'.
 *
 * Se il pacchetto non c'e' non si arriva mai qui, ma la risoluzione resta
 * difensiva: un percorso mancante produrrebbe solo il warning che questa
 * funzione serve a togliere, non un errore.
 */
function cartellaFontStandard(): string | undefined {
  try {
    const require = createRequire(import.meta.url);
    return join(dirname(require.resolve("pdfjs-dist/package.json")), "standard_fonts/");
  } catch {
    return undefined;
  }
}

/**
 * Riporta il testo a una forma prevedibile.
 *
 * I PDF usano gli apostrofi e i trattini tipografici (’ – —): una regex scritta
 * con l'apostrofo dritto non troverebbe nulla, e il motivo sarebbe invisibile a
 * chi la rilegge. Meglio uniformare qui, una volta.
 */
function normalizza(testo: string): string {
  return testo
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n");
}

export interface DocumentoScaricato {
  dati: Uint8Array;
  /** Data dichiarata dal server: primo indizio di un documento aggiornato. */
  ultimaModifica: string | null;
  /** Identificatore di versione del server: cambia quando cambia il file. */
  etag: string | null;
}

export async function scaricaPdf(url: string): Promise<DocumentoScaricato> {
  if (!(await consentito(url))) {
    throw new Error(`robots.txt vieta l'accesso a ${url}`);
  }
  const risposta = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!risposta.ok) throw new Error(`HTTP ${risposta.status} su ${url}`);

  const tipo = risposta.headers.get("content-type") ?? "";
  // un portale che risponde con una pagina d'errore HTML produrrebbe altrimenti
  // un "PDF corrotto" incomprensibile
  if (tipo && !/pdf|octet-stream/i.test(tipo)) {
    throw new Error(
      `${url} non ha restituito un PDF ma "${tipo}". ` +
        `Probabilmente l'indirizzo porta a una pagina, non al documento.`,
    );
  }

  return {
    dati: new Uint8Array(await risposta.arrayBuffer()),
    ultimaModifica: risposta.headers.get("last-modified"),
    etag: risposta.headers.get("etag"),
  };
}

/** Legge un PDF gia' salvato: serve alla calibrazione, che non deve ripetere richieste. */
export async function leggiPdfLocale(percorso: string): Promise<Uint8Array> {
  return new Uint8Array(await readFile(percorso));
}

/** Campi che una riga-lotto puo' dichiarare, come gruppi nominati della regex. */
const CAMPI_TESTUALI = [
  "titolo",
  "comune",
  "indirizzoRaw",
  "numeroLotto",
  "tribunale",
  "tipoVendita",
  "sottotipoAsset",
  "statoOccupazionale",
] as const;

export interface EsitoAnalisiPdf {
  immobili: ImmobileGrezzo[];
  /** Data dichiarata dentro il documento, se il config la sa riconoscere. */
  dataDocumento: string | null;
  /** Righe che somigliano a un lotto ma che la regex non ha saputo leggere. */
  righeNonLette: string[];
}

/**
 * Ricava i lotti dal testo.
 *
 * Le righe che la regex non riconosce non vengono buttate in silenzio: finiscono
 * in `righeNonLette`, perche' una regex che smette di combaciare dopo un
 * restyling del documento e' il modo tipico in cui una fonte muore senza che
 * nessuno se ne accorga. Meglio vedere venti righe scartate che zero risultati
 * inspiegabili.
 */
export function analizzaPdf(
  pagine: TestoPdf,
  config: SiteConfig,
  urlDocumento: string,
): EsitoAnalisiPdf {
  const pdf: PdfConfig | undefined = config.pdf;
  if (!pdf?.rigaLotto) {
    throw new Error(
      `La fonte "${config.name}" e' in modalita' pdf ma non ha "pdf.rigaLotto": ` +
        `serve l'espressione regolare che riconosce una riga di lotto. ` +
        `Usa 'npm run pdftesto -- <url-o-file>' per vedere il testo e scriverla.`,
    );
  }

  const rigaLotto = new RegExp(pdf.rigaLotto);
  const sospetta = pdf.rigaSospetta ? new RegExp(pdf.rigaSospetta) : null;
  const testo = pagine.join("\n");

  let dataDocumento: string | null = null;
  if (pdf.dataDocumento) {
    const m = new RegExp(pdf.dataDocumento).exec(testo);
    if (m) dataDocumento = parseDataIt(m[1] ?? m[0]);
  }

  const immobili: ImmobileGrezzo[] = [];
  const righeNonLette: string[] = [];
  const visti = new Set<string>();

  for (const riga of testo.split("\n")) {
    const pulita = riga.trim();
    if (!pulita) continue;

    const m = rigaLotto.exec(pulita);
    if (!m) {
      if (sospetta?.test(pulita)) righeNonLette.push(pulita);
      continue;
    }

    const g = m.groups ?? {};
    // Un lotto in un PDF non ha un indirizzo web proprio: il documento stesso
    // e' la fonte. Il frammento distingue i lotti fra loro e mantiene il
    // collegamento al file da cui provengono.
    const numeroLotto = g["numeroLotto"]?.trim() ?? null;
    const chiave = numeroLotto ?? pulita.slice(0, 80);
    if (visti.has(chiave)) continue; // gli elenchi ripetono le righe nelle intestazioni di pagina
    visti.add(chiave);

    const item: ImmobileGrezzo = {
      fonte: config.name,
      idEsterno: `${dataDocumento ?? "senza-data"}#${chiave}`,
      url: `${urlDocumento}#lotto-${encodeURIComponent(chiave)}`,
      titolo: g["titolo"]?.trim() || pulita.slice(0, 160),
      prezzo: g["prezzoRaw"] ? parseImporto(g["prezzoRaw"]) : null,
      tipoPrezzo: config.tipoPrezzo ?? null,
      mq: g["mqRaw"] ? parseImporto(g["mqRaw"]) : null,
      dataAsta: g["dataAstaRaw"] ? parseDataIt(g["dataAstaRaw"]) : null,
      termineOfferte: g["termineOfferteRaw"] ? parseDataIt(g["termineOfferteRaw"]) : null,
    };
    for (const campo of CAMPI_TESTUALI) {
      const v = g[campo]?.trim();
      if (v) (item as unknown as Record<string, unknown>)[campo] = v;
    }

    immobili.push(item);
  }

  return { immobili, dataDocumento, righeNonLette };
}

/**
 * Quanto e' vecchio il documento, in giorni. Serve perche' alcuni enti lasciano
 * online elenchi fermi da anni: trattarli come attuali significa inseguire
 * immobili gia' venduti.
 */
export function giorniDaAggiornamento(dataDocumento: string | null, oggi = new Date()): number | null {
  if (!dataDocumento) return null;
  const d = new Date(dataDocumento);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((oggi.getTime() - d.getTime()) / 86_400_000);
}
