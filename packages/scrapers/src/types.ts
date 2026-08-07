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

/**
 * Esito della verifica di conformita' per una fonte. Va compilato a mano dopo
 * aver letto robots.txt e le condizioni d'uso: e' la traccia di una decisione
 * presa da una persona, non qualcosa che il codice possa dedurre.
 */
export interface ComplianceConfig {
  /** "da_verificare" finche' nessuno ha guardato: e' lo stato iniziale onesto. */
  stato: "da_verificare" | "consentito" | "vietato" | "solo_contatto";
  /** Data della verifica, ISO. I siti cambiano condizioni: serve sapere quanto e' vecchia. */
  verificatoIl?: string;
  /** Chi ha deciso, e su quali basi. */
  note?: string;
  /** Crawl-delay dichiarato dal sito, in secondi: se presente, alzare rateLimitSeconds almeno a questo. */
  crawlDelay?: number;
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
  /**
   * Autorevolezza del dato, usata da deduplica() di @qdr/core: piu' bassa vince
   * sui conflitti di campo. Riflette *quanto ci si puo' fidare* della fonte, non
   * quanto interessa: il PVP porta l'RGE e la base d'asta ufficiale, quindi deve
   * prevalere su un servicer che pubblica un prezzo richiesto, anche se quel
   * servicer e' piu' interessante da monitorare.
   */
  priorita: number;
  /**
   * Ordine operativo di monitoraggio: quali fonti guardare per prime. Non
   * influenza il dedup — serve a ordinare la coda di lavoro e la dashboard.
   */
  ordineMonitoraggio?: number;
  fetchMode: FetchMode;
  baseUrl: string;
  searchUrl: string;
  /**
   * Alternativa a searchUrl per i siti che espongono deep-link parametrici
   * (es. una pagina per comune). Ogni segnaposto `{nome}` viene sostituito con
   * i valori di `parametri[nome]`, generando una ricerca per combinazione.
   *
   * Meglio di scaricare l'intero catalogo nazionale e filtrare dopo: meno
   * richieste al sito, meno probabilita' di essere bloccati, e si scarica solo
   * cio' che interessa davvero.
   */
  urlTemplate?: string;
  /** Valori per i segnaposto di urlTemplate. */
  parametri?: Record<string, string[]>;
  listSelector: string;
  /** tipo di prezzo dichiarato da questa fonte (vedi TipoPrezzo in @qdr/core) */
  tipoPrezzo?: TipoPrezzo;
  fields: FieldsConfig;
  pagination: PaginationConfig;
  browser?: BrowserConfig;
  compliance?: ComplianceConfig;
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
