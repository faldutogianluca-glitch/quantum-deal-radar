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

/**
 * Espande urlTemplate nelle ricerche concrete, una per combinazione di parametri.
 * Senza template, l'unica ricerca e' searchUrl.
 */
export function espandiRicerche(config: SiteConfig): string[] {
  if (!config.urlTemplate) return [config.searchUrl];

  const nomi = Object.keys(config.parametri ?? {});
  if (nomi.length === 0) return [config.urlTemplate];

  let urls = [config.urlTemplate];
  for (const nome of nomi) {
    const valori = config.parametri![nome] ?? [];
    if (valori.length === 0) continue;
    urls = urls.flatMap((u) =>
      valori.map((v) => u.replaceAll(`{${nome}}`, encodeURIComponent(v))),
    );
  }
  return urls;
}

export class GenericScraper implements Scraper {
  readonly name: string;

  constructor(private readonly config: SiteConfig) {
    this.name = config.name;
  }

  async scrape(): Promise<ScrapeResult> {
    const result: ScrapeResult = { source: this.name, items: [], errors: [] };

    // Rete di sicurezza: un template col segnaposto abilitato per errore non deve
    // partire in silenzio e riempire il DB di nulla. Il dominio .invalid non
    // risolve mai (RFC 2606), ma il messaggio esplicito e' piu' utile di un timeout.
    if (/DA-COMPILARE/i.test(this.config.searchUrl) || /DA-COMPILARE/i.test(this.config.baseUrl)) {
      result.errors.push(
        `La configurazione di "${this.name}" e' ancora un template: searchUrl/baseUrl vanno compilati ` +
          `con gli indirizzi reali prima di abilitarla.`,
      );
      return result;
    }

    // Una fonte il cui stato di conformita' e' ancora "da_verificare" non parte:
    // la decisione di scaricare da un sito terzo va presa consapevolmente, non
    // ereditata da un default.
    const stato = this.config.compliance?.stato;
    if (this.config.fetchMode !== "file" && stato !== "consentito") {
      result.errors.push(
        `"${this.name}" non e' stata autorizzata: compliance.stato = "${stato ?? "assente"}". ` +
          `Esegui 'npm run verifica -- <url>', leggi le condizioni d'uso e imposta ` +
          `compliance.stato = "consentito" solo se lo e' davvero.`,
      );
      return result;
    }

    const ricerche = espandiRicerche(this.config);
    const pagine: string[] = [];

    for (const ricerca of ricerche) {
      if (this.config.fetchMode !== "file" && !(await consentito(ricerca))) {
        result.errors.push(`robots.txt vieta lo scraping di ${ricerca}: salto.`);
        continue;
      }
      try {
        pagine.push(...(await this.fetchPagine(ricerca)));
      } catch (err) {
        // una ricerca fallita non deve annullare le altre
        result.errors.push(`Fetch fallito per ${ricerca}: ${(err as Error).message}`);
      }
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

  private async fetchPagine(partenza: string): Promise<string[]> {
    if (this.config.fetchMode === "file") return this.fetchPagineFile();
    if (this.config.fetchMode === "browser") return this.fetchPagineBrowser(partenza);
    return this.fetchPagineStatic(partenza);
  }

  /**
   * Carica le pagine con Chromium headless. Serve quando i risultati sono resi da
   * JavaScript o il sito respinge le richieste che non provengono da un browser.
   *
   * Playwright e' una dipendenza opzionale e viene importato solo qui: chi usa
   * unicamente il fetch statico non deve installarlo ne' scaricare un browser.
   */
  private async fetchPagineBrowser(partenza: string): Promise<string[]> {
    const opz = this.config.browser ?? {};
    const timeout = opz.timeoutMs ?? 30_000;

    let chromium: typeof import("playwright").chromium;
    try {
      ({ chromium } = await import("playwright"));
    } catch {
      throw new Error(
        `fetchMode "browser" richiede Playwright, che non risulta installato. ` +
          `Esegui: npm install playwright && npx playwright install chromium`,
      );
    }

    // Un ambiente che ha gia' un Chromium (immagini CI, container preconfigurati)
    // puo' indicarlo qui invece di farne scaricare un altro.
    const eseguibile = process.env.QDR_CHROMIUM_PATH;
    const browser = await chromium.launch(eseguibile ? { executablePath: eseguibile } : {});

    try {
      const contesto = await browser.newContext({ userAgent: USER_AGENT, locale: "it-IT" });
      const page = await contesto.newPage();
      const pagine: string[] = [];
      let url = partenza;

      for (let i = 0; i < Math.max(1, this.config.pagination.maxPages); i++) {
        await rallenta(this.name, this.config.rateLimitSeconds);
        const risposta = await page.goto(url, { timeout, waitUntil: "domcontentloaded" });
        if (risposta && !risposta.ok()) {
          throw new Error(`HTTP ${risposta.status()} su ${url}`);
        }

        // Senza attesa esplicita si rischia di leggere il markup prima che i
        // risultati siano stati resi, ottenendo zero schede da una pagina piena.
        if (opz.attendiSelettore) {
          await page.waitForSelector(opz.attendiSelettore, { timeout });
        }
        if (opz.attesaExtraMs) await page.waitForTimeout(opz.attesaExtraMs);

        pagine.push(await page.content());

        const nextSel = this.config.pagination.nextPageSelector;
        if (!nextSel) break;
        const href = await page.locator(nextSel).first().getAttribute("href").catch(() => null);
        if (!href) break;
        url = new URL(href, this.config.baseUrl).toString();
        if (!(await consentito(url))) break;
      }
      return pagine;
    } finally {
      await browser.close();
    }
  }

  /** Legge searchUrl come percorso locale (relativo alla working dir del processo).
   *  Usato dall'adapter demo e nei test: pipeline completa senza rete. */
  private async fetchPagineFile(): Promise<string[]> {
    const contenuto = await readFile(this.config.searchUrl, "utf-8");
    return [contenuto];
  }

  private async fetchPagineStatic(partenza: string): Promise<string[]> {
    const pagine: string[] = [];
    let url = partenza;

    for (let i = 0; i < Math.max(1, this.config.pagination.maxPages); i++) {
      await rallenta(this.name, this.config.rateLimitSeconds);
      const resp = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
      if (!resp.ok) throw new Error(`HTTP ${resp.status} su ${url}`);
      const html = await resp.text();
      pagine.push(html);

      const nextSel = this.config.pagination.nextPageSelector;
      if (!nextSel) break;
      const $ = cheerio.load(html);
      const href = $(nextSel).first().attr("href");
      if (!href) break;
      url = new URL(href, this.config.baseUrl).toString();
      if (!(await consentito(url))) break;
    }
    return pagine;
  }
}
