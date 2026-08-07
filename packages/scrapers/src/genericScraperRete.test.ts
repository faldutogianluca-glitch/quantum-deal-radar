import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { GenericScraper } from "./genericScraper.js";
import { azzeraCacheRobots } from "./robots.js";
import type { SiteConfig } from "./types.js";

/**
 * Il percorso di rete di GenericScraper (fetchPagineStatic) non e' esercitato
 * dall'adapter demo, che legge una fixture da disco. Qui si inietta un fetch
 * finto: paginazione, errori HTTP e ricontrollo di robots.txt fra una pagina e
 * l'altra sono il codice che gira contro i portali veri.
 */

interface Rotta {
  ok?: boolean;
  status?: number;
  body: string;
}

function rete(rotte: Record<string, Rotta>) {
  const chiamate: string[] = [];
  const impl = (async (input: RequestInfo | URL) => {
    const url = String(input);
    chiamate.push(url);
    const r = rotte[url];
    if (!r) return { ok: false, status: 404, text: async () => "" } as unknown as Response;
    return { ok: r.ok ?? true, status: r.status ?? 200, text: async () => r.body } as unknown as Response;
  }) as unknown as typeof fetch;
  return { impl, chiamate };
}

const config = (o: Partial<SiteConfig> = {}): SiteConfig => ({
  name: "test",
  displayName: "Test",
  enabled: true,
  priorita: 10,
  fetchMode: "static",
  baseUrl: "https://sito.test",
  searchUrl: "https://sito.test/lista",
  listSelector: ".card",
  fields: { titolo: ".t", url: ".l::attr(href)" },
  pagination: { maxPages: 1 },
  rateLimitSeconds: 0,
  ...o,
});

/** Pagina con `n` schede, piu' un eventuale link "successiva". */
const pagina = (titoli: string[], next?: string): string =>
  titoli.map((t, i) => `<div class="card"><span class="t">${t}</span><a class="l" href="/im/${i}"></a></div>`).join("") +
  (next ? `<a class="next" href="${next}"></a>` : "");

const ROBOTS = "https://sito.test/robots.txt";
const APERTO = { body: "User-agent: *\nDisallow: /vietato\n" };

beforeEach(() => azzeraCacheRobots());

describe("scraper su rete: pagina singola", () => {
  test("scarica, parsa e riporta le schede", async () => {
    const { impl } = rete({ [ROBOTS]: APERTO, "https://sito.test/lista": { body: pagina(["A", "B"]) } });
    const r = await new GenericScraper(config(), impl).scrape();

    assert.deepEqual(r.errors, []);
    assert.equal(r.items.length, 2);
    assert.equal(r.items[0]!.titolo, "A");
    assert.equal(r.items[0]!.url, "https://sito.test/im/0", "gli href relativi vanno assolutizzati");
    assert.equal(r.items[0]!.fonte, "test");
  });

  test("robots.txt che vieta la searchUrl ferma tutto prima di scaricare", async () => {
    const { impl, chiamate } = rete({
      [ROBOTS]: { body: "User-agent: *\nDisallow: /lista\n" },
      "https://sito.test/lista": { body: pagina(["A"]) },
    });
    const r = await new GenericScraper(config(), impl).scrape();

    assert.equal(r.items.length, 0);
    assert.equal(r.errors.length, 1);
    assert.match(r.errors[0]!, /robots\.txt vieta/);
    assert.ok(!chiamate.includes("https://sito.test/lista"), "la pagina non deve essere richiesta");
  });

  test("una risposta HTTP non ok diventa un errore riportato, non un'eccezione", async () => {
    const { impl } = rete({ [ROBOTS]: APERTO, "https://sito.test/lista": { ok: false, status: 503, body: "" } });
    const r = await new GenericScraper(config(), impl).scrape();

    assert.equal(r.items.length, 0);
    assert.match(r.errors[0]!, /Fetch fallito/);
    assert.match(r.errors[0]!, /HTTP 503/);
  });

  test("una scheda senza titolo o senza url viene scartata in silenzio", async () => {
    const html = `<div class="card"><a class="l" href="/im/0"></a></div>` + pagina(["Buona"]);
    const { impl } = rete({ [ROBOTS]: APERTO, "https://sito.test/lista": { body: html } });
    const r = await new GenericScraper(config(), impl).scrape();

    assert.equal(r.items.length, 1);
    assert.equal(r.items[0]!.titolo, "Buona");
    assert.deepEqual(r.errors, [], "una scheda incompleta non e' un errore");
  });
});

describe("scraper su rete: paginazione", () => {
  const conPagine = (maxPages: number) =>
    config({ pagination: { maxPages, nextPageSelector: ".next" } });

  test("segue il link alla pagina successiva fino a maxPages", async () => {
    const { impl, chiamate } = rete({
      [ROBOTS]: APERTO,
      "https://sito.test/lista": { body: pagina(["A"], "/lista?p=2") },
      "https://sito.test/lista?p=2": { body: pagina(["B"], "/lista?p=3") },
      "https://sito.test/lista?p=3": { body: pagina(["C"]) },
    });
    const r = await new GenericScraper(conPagine(2), impl).scrape();

    assert.deepEqual(r.items.map((i) => i.titolo), ["A", "B"], "maxPages=2 si ferma alla seconda");
    assert.ok(!chiamate.includes("https://sito.test/lista?p=3"));
  });

  test("si ferma quando il link successivo non c'e'", async () => {
    const { impl } = rete({
      [ROBOTS]: APERTO,
      "https://sito.test/lista": { body: pagina(["A"]) },
    });
    const r = await new GenericScraper(conPagine(5), impl).scrape();
    assert.deepEqual(r.items.map((i) => i.titolo), ["A"]);
  });

  test("senza nextPageSelector si scarica una sola pagina", async () => {
    const { impl, chiamate } = rete({
      [ROBOTS]: APERTO,
      "https://sito.test/lista": { body: pagina(["A"], "/lista?p=2") },
      "https://sito.test/lista?p=2": { body: pagina(["B"]) },
    });
    const r = await new GenericScraper(config({ pagination: { maxPages: 5 } }), impl).scrape();

    assert.deepEqual(r.items.map((i) => i.titolo), ["A"]);
    assert.ok(!chiamate.includes("https://sito.test/lista?p=2"));
  });

  test("si ferma se la pagina successiva e' vietata da robots.txt", async () => {
    const { impl, chiamate } = rete({
      [ROBOTS]: APERTO,
      "https://sito.test/lista": { body: pagina(["A"], "/vietato/p2") },
      "https://sito.test/vietato/p2": { body: pagina(["B"]) },
    });
    const r = await new GenericScraper(conPagine(5), impl).scrape();

    assert.deepEqual(r.items.map((i) => i.titolo), ["A"]);
    assert.ok(!chiamate.includes("https://sito.test/vietato/p2"), "robots va ricontrollato a ogni pagina");
  });

  test("maxPages a 0 scarica comunque la prima pagina", async () => {
    const { impl } = rete({ [ROBOTS]: APERTO, "https://sito.test/lista": { body: pagina(["A"]) } });
    const r = await new GenericScraper(config({ pagination: { maxPages: 0 } }), impl).scrape();
    assert.equal(r.items.length, 1);
  });
});

describe("estrazione dei campi", () => {
  const conCampo = (selettore: string) =>
    config({ fields: { titolo: ".t", url: ".l::attr(href)", sottotipoAsset: selettore } });

  const scrape = async (html: string, selettore: string) => {
    const { impl } = rete({ [ROBOTS]: APERTO, "https://sito.test/lista": { body: html } });
    return (await new GenericScraper(conCampo(selettore), impl).scrape()).items[0];
  };

  test("un attributo diverso da href/src si legge grezzo", async () => {
    const html = `<div class="card"><span class="t">A</span><a class="l" href="/im/0"></a><i class="k" data-id="XY-9"></i></div>`;
    assert.equal((await scrape(html, ".k::attr(data-id)"))?.sottotipoAsset, "XY-9");
  });

  test("un href gia' assoluto resta invariato", async () => {
    const html = `<div class="card"><span class="t">A</span><a class="l" href="https://altro.test/x"></a></div>`;
    const { impl } = rete({ [ROBOTS]: APERTO, "https://sito.test/lista": { body: html } });
    const r = await new GenericScraper(config(), impl).scrape();
    assert.equal(r.items[0]!.url, "https://altro.test/x");
  });

  test("un href non risolvibile ripiega sul valore grezzo invece di far saltare la scheda", async () => {
    const html = `<div class="card"><span class="t">A</span><a class="l" href="/im/0"></a><i class="k" href="//["></i></div>`;
    assert.equal((await scrape(html, ".k::attr(href)"))?.sottotipoAsset, "//[");
  });

  test("un attributo assente da' null, non una stringa vuota", async () => {
    const html = `<div class="card"><span class="t">A</span><a class="l" href="/im/0"></a></div>`;
    assert.equal((await scrape(html, ".manca::attr(data-id)"))?.sottotipoAsset, null);
  });

  test("il suffisso ::text e' equivalente al selettore nudo", async () => {
    const html = `<div class="card"><span class="t">A</span><a class="l" href="/im/0"></a><i class="k"> Villa </i></div>`;
    assert.equal((await scrape(html, ".k::text"))?.sottotipoAsset, "Villa", "il testo va ripulito");
  });
});
