import { readFile } from "node:fs/promises";

import * as cheerio from "cheerio";
import type { Cheerio, CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";

import { parseDataIt, parseImporto, tipoPrezzoValido } from "./parsing.js";
import { consentito, rallenta, USER_AGENT } from "./robots.js";
import type { FieldsConfig, ImmobileGrezzo, Scraper, ScrapeResult, SiteConfig } from "./types.js";

/** Risolve un selettore in stile scrapy ('css::attr(nome)' o CSS puro = testo). */
function estrai($: CheerioAPI, card: Cheerio<AnyNode>, selettore: string, baseUrl: string): string | null {
  const matchAttr = selettore.match(/^(.*)::attr\(([^)]+)\)$/);
  if (matchAttr) {
    const [, css, nomeAttr] = matchAttr;
    const target = css ? card.find(css).first() : card;
    const valore = target.attr(nomeAttr ?? "");
    if (!valore) return null;
    if ((nomeAttr === "href" || nomeAttr === "src") && !/^https?:\/\//.test(valore)) {
      try {
        return new URL(valore, baseUrl).toString();
      } catch {
        return valore;
      }
    }
    return valore;
  }

  const css = selettore.endsWith("::text") ? selettore.slice(0, -"::text".length) : selettore;
  const target = css ? card.find(css).first() : card;
  const testo = target.text().trim();
  return testo || null;
}

export class GenericScraper implements Scraper {
  readonly name: string;

  /** `fetchImpl` e' iniettabile per i test: il percorso di rete non e' altrimenti
   *  esercitabile senza uscire davvero verso i portali. */
  constructor(
    private readonly config: SiteConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.name = config.name;
  }

  async scrape(): Promise<ScrapeResult> {
    const result: ScrapeResult = { source: this.name, items: [], errors: [] };

    if (this.config.fetchMode !== "file" && !(await consentito(this.config.searchUrl, this.fetchImpl))) {
      result.errors.push(`robots.txt vieta lo scraping di ${this.config.searchUrl}: salto.`);
      return result;
    }

    let pagine: string[];
    try {
      pagine = await this.fetchPagine();
    } catch (err) {
      result.errors.push(`Fetch fallito per ${this.config.searchUrl}: ${(err as Error).message}`);
      return result;
    }

    for (const html of pagine) {
      const $ = cheerio.load(html);
      const cards = $(this.config.listSelector);
      cards.each((_, el) => {
        try {
          const item = this.parseCard($, $(el));
          if (item) result.items.push(item);
        } catch (err) {
          result.errors.push(`Card non parsabile: ${(err as Error).message}`);
        }
      });
    }

    return result;
  }

  private parseCard($: CheerioAPI, card: Cheerio<AnyNode>): ImmobileGrezzo | null {
    const f: FieldsConfig = this.config.fields;
    const base = this.config.baseUrl;

    const titolo = estrai($, card, f.titolo, base);
    const url = estrai($, card, f.url, base);
    if (!titolo || !url) return null;

    const prezzoRaw = f.prezzoRaw ? estrai($, card, f.prezzoRaw, base) : null;
    const dataAstaRaw = f.dataAstaRaw ? estrai($, card, f.dataAstaRaw, base) : null;

    return {
      fonte: this.name,
      idEsterno: url,
      url,
      titolo,
      immagineUrl: f.immagineUrl ? estrai($, card, f.immagineUrl, base) : null,
      prezzo: prezzoRaw ? parseImporto(prezzoRaw) : null,
      tipoPrezzo: tipoPrezzoValido(this.config.tipoPrezzo) ?? null,
      comune: f.comune ? estrai($, card, f.comune, base) : null,
      indirizzoRaw: f.indirizzoRaw ? estrai($, card, f.indirizzoRaw, base) : null,
      dataAsta: dataAstaRaw ? parseDataIt(dataAstaRaw) : null,
      sottotipoAsset: f.sottotipoAsset ? estrai($, card, f.sottotipoAsset, base) : null,
      tribunale: f.tribunale ? estrai($, card, f.tribunale, base) : null,
      numeroLotto: f.numeroLotto ? estrai($, card, f.numeroLotto, base) : null,
    };
  }

  private async fetchPagine(): Promise<string[]> {
    if (this.config.fetchMode === "file") return this.fetchPagineFile();
    return this.fetchPagineStatic();
  }

  /** Legge searchUrl come percorso locale (relativo alla working dir del processo).
   *  Usato dall'adapter demo e nei test: pipeline completa senza rete. */
  private async fetchPagineFile(): Promise<string[]> {
    const contenuto = await readFile(this.config.searchUrl, "utf-8");
    return [contenuto];
  }

  private async fetchPagineStatic(): Promise<string[]> {
    const pagine: string[] = [];
    let url = this.config.searchUrl;

    for (let i = 0; i < Math.max(1, this.config.pagination.maxPages); i++) {
      await rallenta(this.name, this.config.rateLimitSeconds);
      const resp = await this.fetchImpl(url, { headers: { "User-Agent": USER_AGENT } });
      if (!resp.ok) throw new Error(`HTTP ${resp.status} su ${url}`);
      const html = await resp.text();
      pagine.push(html);

      const nextSel = this.config.pagination.nextPageSelector;
      if (!nextSel) break;
      const $ = cheerio.load(html);
      const href = $(nextSel).first().attr("href");
      if (!href) break;
      url = new URL(href, this.config.baseUrl).toString();
      if (!(await consentito(url, this.fetchImpl))) break;
    }
    return pagine;
  }
}
