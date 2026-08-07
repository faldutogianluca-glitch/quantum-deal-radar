import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { GenericScraper } from "./genericScraper.js";
import type { SiteConfig } from "./types.js";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");

/** Chromium e' opzionale: dove non c'e', i test del motore browser vengono saltati
 *  invece di far fallire l'intera suite. */
async function chromiumDisponibile(): Promise<boolean> {
  try {
    const { chromium } = await import("playwright");
    const exe = process.env.QDR_CHROMIUM_PATH;
    const b = await chromium.launch(exe ? { executablePath: exe } : {});
    await b.close();
    return true;
  } catch {
    return false;
  }
}

let server: Server;
let base = "";

before(async () => {
  const html = await readFile(join(FIXTURES, "sito_js", "index.html"), "utf-8");
  server = createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  });
  await new Promise<void>((r) => server.listen(0, r));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});

after(() => new Promise<void>((r) => server.close(() => r())));

function config(fetchMode: SiteConfig["fetchMode"]): SiteConfig {
  return {
    name: `js-${fetchMode}`,
    displayName: "Portale finto con rendering JS",
    enabled: false,
    priorita: 90,
    fetchMode,
    baseUrl: base,
    searchUrl: base,
    listSelector: ".card",
    fields: {
      titolo: ".titolo",
      url: ".link::attr(href)",
      prezzoRaw: ".prezzo",
      comune: ".comune",
      dataAstaRaw: ".data",
    },
    pagination: { maxPages: 1 },
    browser: { attendiSelettore: ".card", timeoutMs: 15_000 },
    rateLimitSeconds: 0,
  };
}

describe("fetchMode browser", () => {
  test("il fetch statico non vede i risultati resi da JavaScript", async () => {
    const r = await new GenericScraper(config("static")).scrape();
    assert.deepEqual(r.errors, []);
    assert.equal(r.items.length, 0, "l'HTML servito non contiene ancora le schede");
  });

  test("il motore browser li vede", async (t) => {
    if (!(await chromiumDisponibile())) {
      t.skip("Chromium non disponibile in questo ambiente");
      return;
    }
    const r = await new GenericScraper(config("browser")).scrape();
    assert.deepEqual(r.errors, []);
    assert.equal(r.items.length, 2);

    const primo = r.items[0]!;
    assert.equal(primo.titolo, "Lotto reso via JS");
    assert.equal(primo.prezzo, 123000);
    assert.equal(primo.comune, "Pavia");
    assert.equal(primo.dataAsta, "2027-03-05");
    assert.match(primo.url ?? "", /\/lotto\/10$/);

    // la seconda scheda usa una data in lettere: verifica che il parsing regga entrambi i formati
    assert.equal(r.items[1]!.dataAsta, "2027-04-18");
  });
});
