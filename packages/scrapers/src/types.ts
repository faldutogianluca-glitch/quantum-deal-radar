import type { ImmobileNorm, TipoPrezzo } from "@qdr/core";

/**
 * Record grezzo prodotto da uno scraper, prima della normalizzazione indirizzo
 * (fatta da deduplica()/normalizzaIndirizzo in @qdr/core). ImmobileNorm non ha
 * un campo titolo (il dominio e' aste giudiziarie, non annunci consumer):
 * lo aggiungiamo qui solo per la UI, non entra nella logica di dedup/valutazione.
 */
export type ImmobileGrezzo = ImmobileNorm & {
  titolo?: string | null;
  immagineUrl?: string | null;
};

/**
 * - `static`  : fetch + parsing HTML. Veloce, ma vede solo l'HTML servito dal server.
 * - `browser` : Chromium headless. Necessario quando i risultati sono resi da
 *               JavaScript o il sito respinge le richieste non-browser.
 * - `file`    : legge una fixture locale (demo e test, nessuna rete).
 */
export type FetchMode = "static" | "browser" | "file";

/** Selettori in stile scrapy: CSS puro = testo dell'elemento, 'css::attr(nome)' = attributo. */
export interface FieldsConfig {
  titolo: string;
  url: string;
  immagineUrl?: string;
  prezzoRaw?: string;
  comune?: string;
  indirizzoRaw?: string;
  dataAstaRaw?: string;
  sottotipoAsset?: string;
  tribunale?: string;
  numeroLotto?: string;
}

export interface PaginationConfig {
  nextPageSelector?: string;
  maxPages: number;
}

/** Opzioni valide solo con fetchMode "browser". */
export interface BrowserConfig {
  /**
   * Selettore da attendere prima di leggere la pagina. Senza, si rischia di
   * parsare il markup prima che i risultati siano stati resi: di norma va
   * impostato sullo stesso valore di listSelector.
   */
  attendiSelettore?: string;
  /** Attesa aggiuntiva in ms dopo il caricamento, per contenuti che arrivano tardi. */
  attesaExtraMs?: number;
  /** Millisecondi massimi per il caricamento di una pagina. */
  timeoutMs?: number;
}

export interface SiteConfig {
  name: string;
  displayName: string;
  enabled: boolean;
  /** priorita' piu' bassa = fonte piu' autorevole, usata da deduplica() di @qdr/core */
  priorita: number;
  fetchMode: FetchMode;
  baseUrl: string;
  searchUrl: string;
  listSelector: string;
  /** tipo di prezzo dichiarato da questa fonte (vedi TipoPrezzo in @qdr/core) */
  tipoPrezzo?: TipoPrezzo;
  fields: FieldsConfig;
  pagination: PaginationConfig;
  browser?: BrowserConfig;
  rateLimitSeconds: number;
  notes?: string;
}

export interface Scraper {
  readonly name: string;
  scrape(): Promise<ScrapeResult>;
}

export interface ScrapeResult {
  source: string;
  items: ImmobileGrezzo[];
  errors: string[];
}
