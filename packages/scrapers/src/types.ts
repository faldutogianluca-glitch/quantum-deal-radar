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
/**
 * Come si arriva ai dati di una fonte.
 *
 * `pdf` e `manuale` sono dichiarati ma non ancora implementati: compaiono qui
 * perche' diverse fonti in elenco funzionano cosi', e tenerne traccia nel
 * config e' meglio che lasciarle fuori facendo finta che siano scrapabili.
 * Chi prova a lanciarle riceve un messaggio esplicito, non un errore oscuro.
 */
export type FetchMode =
  /** HTML servito cosi' com'e': una richiesta e via. */
  | "static"
  /** Pagina resa da JavaScript, o sito che respinge le richieste non-browser. */
  | "browser"
  /** Fixture locale, per i test. */
  | "file"
  /** I lotti stanno dentro bandi e avvisi in PDF, non in una pagina di risultati. */
  | "pdf"
  /** Nessun catalogo pubblico: i dati arrivano per email, feed o caricamento a mano. */
  | "manuale";

/**
 * Un campo si configura con un selettore, o con un oggetto quando il valore va
 * ancora estratto da cio' che il selettore restituisce.
 *
 * Serve piu' spesso di quanto sembri: i portali nascondono i dati utili dentro
 * attributi (`style="background-image: url(...)"`), query string di link
 * (`?id_bene=4123`) o testo misto ("Valutazione media: 852.000,00").
 */
export type CampoConfig =
  | string
  | {
      /** Selettore in stile scrapy: CSS puro = testo, 'css::attr(nome)' = attributo. */
      selettore: string;
      /** Regex con un gruppo di cattura: il valore diventa quel gruppo. */
      regex?: string;
      /** Sommato al valore numerico estratto. Utile per i conteggi sfasati di uno:
       *  "esperimento n. 1" significa zero tentativi andati deserti. */
      offset?: number;
    };

/** Selettori in stile scrapy: CSS puro = testo dell'elemento, 'css::attr(nome)' = attributo. */
export interface FieldsConfig {
  titolo: CampoConfig;
  url: CampoConfig;
  immagineUrl?: CampoConfig;
  prezzoRaw?: CampoConfig;
  comune?: CampoConfig;
  indirizzoRaw?: CampoConfig;
  dataAstaRaw?: CampoConfig;
  sottotipoAsset?: CampoConfig;
  tribunale?: CampoConfig;
  numeroLotto?: CampoConfig;
  /** Identificativo stabile dell'annuncio sul portale: meglio dell'URL, che puo' cambiare. */
  idEsterno?: CampoConfig;
  /** Coordinate gia' presenti nella pagina: evitano del tutto il geocoding. */
  lat?: CampoConfig;
  lon?: CampoConfig;
  /** Tentativi d'asta andati deserti: segnale di un venditore sempre piu' disposto a trattare. */
  nEsperimentiDeserti?: CampoConfig;
  /** Stato della vendita cosi' come lo scrive il portale (es. "Pre-asta in corso"). */
  tipoVendita?: CampoConfig;
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
  /**
   * Che fare col banner di consenso ai cookie.
   *
   * Assente o `"rifiuta"`: si rifiutano i cookie facoltativi. E' il default e
   * copre quasi tutti i casi. `"accetta"` acconsente a tutto, e serve sui
   * portali che non mostrano nulla finche' non si acconsente: e' una scelta di
   * chi gestisce il progetto, quindi va scritta qui a mano, per fonte, e resta
   * leggibile nel config invece di essere un comportamento implicito.
   */
  consensoCookie?: "rifiuta" | "accetta";
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
  /**
   * Fascia di lavorazione decisa dal titolare del progetto: P1 si affronta per
   * prima. E' distinta da `priorita`, che serve alla deduplica per stabilire
   * quale fonte prevale sul dato quando due portali descrivono lo stesso
   * immobile: una fonte puo' essere facile da attaccare (P1) e insieme poco
   * autorevole sul prezzo.
   */
  fascia?: "P1" | "P2" | "P3";
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
