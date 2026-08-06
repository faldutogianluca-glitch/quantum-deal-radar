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

export type FetchMode = "static" | "file";

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
