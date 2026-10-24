import { readFile } from "node:fs/promises";
import { join } from "node:path";

import * as cheerio from "cheerio";
import type { Cheerio, CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";

import { parseDataIt, parseImporto, tipoPrezzoValido } from "./parsing.js";
import { avviaChromium } from "./browserLauncher.js";
import { chiudiBannerConsenso } from "./cattura.js";
import { importaCartella } from "./importa.js";
import { analizzaPdf, estraiTestoPdf, giorniDaAggiornamento, leggiPdfLocale, scaricaPdf } from "./pdf.js";
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
  return rifinisci(grezzo, campo);
}

type CampoEsteso = Exclude<CampoConfig, string>;

/** Regex, offset e template, nell'ordine: uguali per l'HTML e per il JSON. */
function rifinisci(grezzo: string, campo: CampoEsteso): string | null {
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

  if (campo.template) valore = campo.template.replaceAll("{}", valore);
  return valore;
}

/** Segue un percorso "a.b.c" dentro un record JSON. Un pezzo mancante vale null, non un errore. */
function leggiPercorso(record: unknown, percorso: string): unknown {
  let corrente: unknown = record;
  for (const parte of percorso.split(".")) {
    if (corrente === null || typeof corrente !== "object") return null;
    corrente = (corrente as Record<string, unknown>)[parte];
  }
  return corrente ?? null;
}

/**
 * Estrae un campo da un record JSON. Un numero resta un numero finche' non
 * c'e' una regex o un template da applicare: cosi' un prezzo "49928.63" non
 * passa dal parser dei prezzi italiani, che lo leggerebbe come 4.992.863.
 */
function estraiJson(record: unknown, campo: CampoConfig | undefined): string | number | null {
  if (!campo) return null;
  const cfg: CampoEsteso = typeof campo === "string" ? { selettore: campo } : campo;
  const grezzo = leggiPercorso(record, cfg.selettore);
  if (grezzo === null || grezzo === undefined) return null;
  if (typeof grezzo === "object") return null; // un elenco o un oggetto non sono un valore
  if (typeof grezzo === "number" && !cfg.regex && !cfg.template) {
    return cfg.offset === undefined ? grezzo : grezzo + cfg.offset;
  }
  return rifinisci(String(grezzo), cfg);
}

/** Un valore gia' numerico resta tale; un testo passa dal parser dei prezzi italiani. */
function importo(v: string | number | null): number | null {
  if (v === null) return null;
  return typeof v === "number" ? v : parseImporto(v);
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

    // "manuale" non ha un motore e non puo' averne uno: non esiste un catalogo
    // da leggere. Va detto prima della guardia sui segnaposto, perche' li' un
    // indirizzo da compilare non c'e' proprio, e invitare a riempirlo
    // manderebbe fuori strada.
    if (this.config.fetchMode === "manuale") {
      try {
        return await this.scrapeManuale();
      } catch (err) {
        result.errors.push((err as Error).message);
        return result;
      }
    }

    if (this.config.fetchMode === "pdf") {
      try {
        return await this.scrapePdf();
      } catch (err) {
        result.errors.push((err as Error).message);
        return result;
      }
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

    if (this.config.fetchMode === "json") {
      try {
        return await this.scrapeJson();
      } catch (err) {
        result.errors.push((err as Error).message);
        return result;
      }
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
    const base = this.config.baseUrl;
    return this.costruisci((campo) => estrai($, card, campo, base));
  }

  /**
   * Dal record grezzo all'immobile: la stessa mappa dei campi per una scheda
   * HTML e per un record JSON, cambia solo chi legge il valore.
   */
  private costruisci(prendi: (campo: CampoConfig | undefined) => string | number | null): ImmobileGrezzo | null {
    const f: FieldsConfig = this.config.fields;
    const testo = (v: string | number | null): string | null => (v === null ? null : String(v));
    const numero = (v: string | number | null): number | null => {
      if (v === null) return null;
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const titolo = testo(prendi(f.titolo));
    const url = testo(prendi(f.url));
    if (!titolo || !url) return null;

    const dataAstaRaw = testo(prendi(f.dataAstaRaw));

    return {
      fonte: this.name,
      // un id proprio del portale e' piu' stabile dell'URL, che puo' cambiare slug
      idEsterno: testo(prendi(f.idEsterno)) ?? url,
      url,
      titolo,
      immagineUrl: testo(prendi(f.immagineUrl)),
      prezzo: importo(prendi(f.prezzoRaw)),
      tipoPrezzo: tipoPrezzoValido(this.config.tipoPrezzo) ?? null,
      comune: testo(prendi(f.comune)),
      indirizzoRaw: testo(prendi(f.indirizzoRaw)),
      dataAsta: dataAstaRaw ? parseDataIt(dataAstaRaw) : null,
      sottotipoAsset: testo(prendi(f.sottotipoAsset)),
      tribunale: testo(prendi(f.tribunale)),
      numeroLotto: testo(prendi(f.numeroLotto)),
      lat: numero(prendi(f.lat)),
      lon: numero(prendi(f.lon)),
      mq: importo(prendi(f.mq)),
      nEsperimentiDeserti: numero(prendi(f.nEsperimentiDeserti)) ?? undefined,
      tipoVendita: testo(prendi(f.tipoVendita)),
    };
  }

  /**
   * Legge i record da un endpoint JSON, pagina per pagina.
   *
   * E' lo stesso endpoint che alimenta l'interfaccia del sito: una richiesta
   * porta decine di annunci gia' strutturati, senza selettori da ricalibrare a
   * ogni restyling. Un percorso locale al posto dell'URL serve ai test e a
   * rilavorare una risposta gia' salvata senza richiederla al sito.
   */
  private async scrapeJson(): Promise<ScrapeResult> {
    const result: ScrapeResult = { source: this.name, items: [], errors: [] };
    const j = this.config.json ?? {};
    const pag = j.pagina;

    for (const ricerca of espandiRicerche(this.config)) {
      const daRete = /^https?:\/\//.test(ricerca);
      if (daRete && !(await consentito(ricerca))) {
        result.errors.push(`robots.txt vieta lo scraping di ${ricerca}: salto.`);
        continue;
      }

      for (let i = 0; i < Math.max(1, this.config.pagination.maxPages); i++) {
        let dati: unknown;
        try {
          if (daRete) {
            await rallenta(this.name, this.config.rateLimitSeconds);
            const url = new URL(ricerca);
            if (pag) {
              url.searchParams.set(pag.param, String((pag.primo ?? 0) + i));
              if (pag.sizeParam && pag.size) url.searchParams.set(pag.sizeParam, String(pag.size));
            }
            const metodo = j.method ?? (j.body ? "POST" : "GET");
            const resp = await fetch(url, {
              method: metodo,
              headers: {
                "User-Agent": USER_AGENT,
                Accept: "application/json",
                ...(j.body ? { "Content-Type": "application/json" } : {}),
              },
              body: j.body ? JSON.stringify(j.body) : undefined,
            });
            if (!resp.ok) throw new Error(`HTTP ${resp.status} su ${url}`);
            dati = await resp.json();
          } else {
            dati = JSON.parse(await readFile(ricerca, "utf-8"));
          }
        } catch (err) {
          result.errors.push(`Fetch fallito per ${ricerca}: ${(err as Error).message}`);
          break;
        }

        const elenco = leggiPercorso(dati, this.config.listSelector);
        if (!Array.isArray(elenco)) {
          // la struttura della risposta e' il contratto: se cambia va detto subito
          result.errors.push(
            `${this.name}: "${this.config.listSelector}" non e' un elenco nella risposta. ` +
              `L'API e' cambiata? Controlla listSelector.`,
          );
          break;
        }
        for (const record of elenco) {
          try {
            const item = this.costruisci((campo) => estraiJson(record, campo));
            if (item) result.items.push(item);
          } catch (err) {
            result.errors.push(`Record non parsabile: ${(err as Error).message}`);
          }
        }

        if (elenco.length === 0 || !daRete || !pag) break;
        const totale = j.totalePagine ? Number(leggiPercorso(dati, j.totalePagine)) : NaN;
        if (Number.isFinite(totale) && (pag.primo ?? 0) + i + 1 >= totale) break;
      }
    }

    if (result.items.length === 0 && result.errors.length === 0) {
      result.errors.push(`${this.name}: nessun record nella risposta. Il filtro in "json.body" e' ancora valido?`);
    }
    return result;
  }

  /**
   * Legge i lotti da un documento PDF.
   *
   * Non passa da fetchPagine perche' un PDF non e' una pagina da parsare con
   * cheerio: il percorso e' diverso dall'inizio alla fine, e forzarlo dentro
   * l'astrazione HTML avrebbe prodotto solo finzione.
   */
  private async scrapePdf(): Promise<ScrapeResult> {
    const result: ScrapeResult = { source: this.name, items: [], errors: [] };

    // Un percorso locale invece di un URL: serve alle fixture dei test e a
    // rilavorare un documento gia' scaricato senza richiederlo di nuovo al sito.
    const daRete = /^https?:\/\//.test(this.config.searchUrl);
    if (daRete) await rallenta(this.name, this.config.rateLimitSeconds);
    const dati = daRete
      ? (await scaricaPdf(this.config.searchUrl)).dati
      : await leggiPdfLocale(this.config.searchUrl);
    const pagine = await estraiTestoPdf(dati);
    const esito = analizzaPdf(pagine, this.config, this.config.searchUrl);

    result.items.push(...esito.immobili);

    // Un documento che non produce nulla, su un file che pero' esiste, quasi
    // sempre significa che il documento e' cambiato: senza dirlo, la fonte
    // morirebbe in silenzio e nessuno se ne accorgerebbe per mesi.
    if (esito.immobili.length === 0) {
      result.errors.push(
        `${this.name}: nessun lotto riconosciuto in ${pagine.length} pagine di PDF. ` +
          `Se il documento e' cambiato, ricalibra "pdf.rigaLotto" con 'npm run pdftesto'.`,
      );
    }
    for (const riga of esito.righeNonLette.slice(0, 10)) {
      result.errors.push(`Riga simile a un lotto ma non letta: "${riga.slice(0, 120)}"`);
    }

    // Alcuni enti lasciano online elenchi fermi da anni: trattarli come attuali
    // significa inseguire immobili gia' venduti.
    const eta = giorniDaAggiornamento(esito.dataDocumento);
    if (eta !== null && eta > 365) {
      result.errors.push(
        `Il documento dichiara di essere aggiornato al ${esito.dataDocumento}, ` +
          `cioe' ${Math.floor(eta / 365)} anni fa: verifica che la procedura sia ancora valida.`,
      );
    }

    return result;
  }

  /**
   * Raccoglie i CSV consegnati a mano.
   *
   * Non c'e' nessuna richiesta di rete: per queste fonti un catalogo pubblico
   * non esiste, e cercare di dedurlo sarebbe inventare. Le colonne non
   * riconosciute vengono riportate invece di essere ignorate in silenzio: e'
   * l'unico modo perche' chi prepara il file scopra che un campo non arriva.
   */
  private async scrapeManuale(): Promise<ScrapeResult> {
    const result: ScrapeResult = { source: this.name, items: [], errors: [] };

    const cartella = this.config.manuale?.cartella ?? join("data", "import", this.name);
    const esito = await importaCartella(cartella, this.config);

    result.items.push(...esito.immobili);
    result.errors.push(...esito.avvisi);

    if (esito.colonneIgnorate.length > 0) {
      result.errors.push(
        `Colonne presenti nel file ma non usate: ${esito.colonneIgnorate.join(", ")}. ` +
          `Se una di queste serve, mappala in "manuale.colonne".`,
      );
    }
    return result;
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

        // Il banner di consenso va chiuso PRIMA di attendere il selettore delle
        // schede: su molti portali la lista non viene montata finche' il dialogo
        // e' aperto, e l'attesa scadrebbe su una pagina che non caricava affatto.
        // Solo alla prima pagina: dalla seconda il consenso e' gia' registrato.
        if (i === 0) {
          await chiudiBannerConsenso(page, opz.consensoCookie ?? "rifiuta");
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
