import { readFile } from "node:fs/promises";

import * as cheerio from "cheerio";
import type { Cheerio, CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";

import { parseDataIt, parseImporto, tipoPrezzoValido } from "./parsing.js";
import { avviaChromium } from "./browserLauncher.js";
import { consentito, rallenta, USER_AGENT } from "./robots.js";
import type { CampoConfig, FieldsConfig, ImmobileGrezzo, Scraper, ScrapeResult, SiteConfig } from "./types.js";

/** Risolve un selettore in stile scrapy ('css::attr(nome)' o CSS puro = testo). */
function estraiGrezzo($: CheerioAPI, card: Cheerio<AnyNode>, selettore: string, baseUrl: string): string | null {
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
/**
 * Applica al valore grezzo l'eventuale regex e l'offset del campo.
 *
 * Se la regex non trova nulla il campo resta vuoto invece di ricevere il testo
 * intero: un valore sbagliato e' peggio di un valore assente, perche' passa
 * inosservato a valle.
 */
function estrai(
  $: CheerioAPI,
  card: Cheerio<AnyNode>,
  campo: CampoConfig | undefined,
  baseUrl: string,
): string | null {
  if (!campo) return null;
  if (typeof campo === "string") return estraiGrezzo($, card, campo, baseUrl);

  const grezzo = estraiGrezzo($, card, campo.selettore, baseUrl);
  if (grezzo === null) return null;

  let valore = grezzo;
  if (campo.regex) {
    // molti portali codificano i dati nelle query string: si legge meglio decodificato
    let testo = grezzo;
    try {
      testo = decodeURIComponent(grezzo.replace(/\+/g, " "));
    } catch {
      // sequenze di escape malformate: si lavora sul testo originale
    }
    const m = new RegExp(campo.regex).exec(testo) ?? new RegExp(campo.regex).exec(grezzo);
    if (!m) return null;
    valore = m[1] ?? m[0];
  }

  if (campo.offset !== undefined) {
    const n = Number(valore);
    if (!Number.isFinite(n)) return null;
    valore = String(n + campo.offset);
  }
  return valore;
}

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

    // Il vaglio di conformita' viene per primo, sempre: una fonte il cui stato e'
    // ancora "da_verificare" non parte. La decisione di scaricare da un sito
    // terzo va presa consapevolmente, non ereditata da un default.
    const stato = this.config.compliance?.stato;
    if (this.config.fetchMode !== "file" && stato !== "consentito") {
      result.errors.push(
        `"${this.name}" non e' stata autorizzata: compliance.stato = "${stato ?? "assente"}". ` +
          `Esegui 'npm run verifica -- <url>', leggi le condizioni d'uso e imposta ` +
          `compliance.stato = "consentito" solo se lo e' davvero.`,
      );
      return result;
    }

    // Poi: il motore che serve a questa fonte potrebbe non esistere ancora.
    // Va detto prima della guardia sui segnaposto, perche' su una fonte
    // "manuale" un indirizzo da compilare non esiste proprio — non c'e' un
    // catalogo pubblico — e invitare a riempirlo manderebbe fuori strada.
    if (this.config.fetchMode === "pdf" || this.config.fetchMode === "manuale") {
      try {
        await this.fetchPagine(this.config.searchUrl);
      } catch (err) {
        result.errors.push((err as Error).message);
      }
      return result;
    }

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

    const prezzoRaw = estrai($, card, f.prezzoRaw, base);
    const dataAstaRaw = estrai($, card, f.dataAstaRaw, base);
    const numero = (v: string | null): number | null => {
      if (v === null) return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    return {
      fonte: this.name,
      // un id proprio del portale e' piu' stabile dell'URL, che puo' cambiare slug
      idEsterno: estrai($, card, f.idEsterno, base) ?? url,
      url,
      titolo,
      immagineUrl: estrai($, card, f.immagineUrl, base),
      prezzo: prezzoRaw ? parseImporto(prezzoRaw) : null,
      tipoPrezzo: tipoPrezzoValido(this.config.tipoPrezzo) ?? null,
      comune: estrai($, card, f.comune, base),
      indirizzoRaw: estrai($, card, f.indirizzoRaw, base),
      dataAsta: dataAstaRaw ? parseDataIt(dataAstaRaw) : null,
      sottotipoAsset: estrai($, card, f.sottotipoAsset, base),
      tribunale: estrai($, card, f.tribunale, base),
      numeroLotto: estrai($, card, f.numeroLotto, base),
      lat: numero(estrai($, card, f.lat, base)),
      lon: numero(estrai($, card, f.lon, base)),
      nEsperimentiDeserti: numero(estrai($, card, f.nEsperimentiDeserti, base)) ?? undefined,
      tipoVendita: estrai($, card, f.tipoVendita, base),
    };
  }

  private async fetchPagine(partenza: string): Promise<string[]> {
    if (this.config.fetchMode === "file") return this.fetchPagineFile();
    if (this.config.fetchMode === "browser") return this.fetchPagineBrowser(partenza);
    if (this.config.fetchMode === "pdf") {
      throw new Error(
        `${this.config.name}: i lotti di questa fonte stanno in bandi PDF, e il motore ` +
          `che li legge non e' ancora implementato. La fonte resta in elenco per non perderla di vista.`,
      );
    }
    if (this.config.fetchMode === "manuale") {
      throw new Error(
        `${this.config.name}: questa fonte non pubblica un catalogo consultabile. ` +
          `I dati vanno acquisiti fuori dallo scraper (email, feed o caricamento a mano) ` +
          `e importati; il percorso di importazione non e' ancora implementato.`,
      );
    }
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

    const { browser, chiudi } = await avviaChromium();
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
      await chiudi();
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
