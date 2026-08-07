import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { getScraper, getFontiRegistry } from "./registry.js";
import { parseImporto, parseDataIt } from "./parsing.js";

describe("parsing", () => {
  test("parseImporto formato italiano", () => {
    assert.equal(parseImporto("€ 89.500,00"), 89500);
    assert.equal(parseImporto("210.000 €"), 210000);
  });

  test("parseDataIt formati numerico e testuale", () => {
    assert.equal(parseDataIt("03/12/2026"), "2026-12-03");
    assert.equal(parseDataIt("Asta: 12 novembre 2026"), "2026-11-12");
  });
});

describe("adapter demo (fixture locale, nessuna rete)", () => {
  test("produce record grezzi coerenti con la fixture", async () => {
    const scraper = await getScraper("demo");
    assert.ok(scraper, "adapter demo deve esistere");

    const result = await scraper!.scrape();
    assert.deepEqual(result.errors, []);
    assert.equal(result.items.length, 3);

    const primo = result.items[0]!;
    assert.equal(primo.fonte, "demo");
    assert.equal(primo.titolo, "Appartamento trilocale con terrazzo");
    assert.equal(primo.prezzo, 89500);
    assert.equal(primo.comune, "Milano");
    assert.equal(primo.dataAsta, "2026-11-12");
    assert.match(primo.url ?? "", /\/immobile\/1$/);
  });
});

describe("protezione dei template non compilati", () => {
  test("un config col segnaposto non parte, e lo dice", async () => {
    const { GenericScraper } = await import("./genericScraper.js");
    const { loadSiteConfigs } = await import("./registry.js");

    const template = (await loadSiteConfigs()).find((c) => /DA-COMPILARE/i.test(c.searchUrl));
    assert.ok(template, "deve esistere almeno un template da compilare");

    // simula l'errore di chi lo abilita prima di compilarlo
    const r = await new GenericScraper({ ...template!, enabled: true }).scrape();
    assert.equal(r.items.length, 0);
    assert.equal(r.errors.length, 1);
    assert.match(r.errors[0]!, /ancora un template/);
  });
});

describe("autorizzazione della fonte", () => {
  test("una fonte non verificata non parte", async () => {
    const { GenericScraper } = await import("./genericScraper.js");
    const { loadSiteConfigs } = await import("./registry.js");

    const base = (await loadSiteConfigs()).find((c) => c.name === "demo")!;
    const nonVerificata = {
      ...base,
      name: "prova-non-verificata",
      fetchMode: "static" as const,
      searchUrl: "https://esempio.invalid/ricerca",
      baseUrl: "https://esempio.invalid",
      compliance: { stato: "da_verificare" as const },
    };

    const r = await new GenericScraper(nonVerificata).scrape();
    assert.equal(r.items.length, 0);
    assert.match(r.errors[0] ?? "", /non e' stata autorizzata/);
  });
});

describe("espandiRicerche", () => {
  test("senza template usa la sola searchUrl", async () => {
    const { espandiRicerche } = await import("./genericScraper.js");
    const { loadSiteConfigs } = await import("./registry.js");
    const demo = (await loadSiteConfigs()).find((c) => c.name === "demo")!;
    assert.deepEqual(espandiRicerche(demo), [demo.searchUrl]);
  });

  test("genera una ricerca per ogni valore del parametro", async () => {
    const { espandiRicerche } = await import("./genericScraper.js");
    const { loadSiteConfigs } = await import("./registry.js");
    const base = (await loadSiteConfigs()).find((c) => c.name === "demo")!;

    const urls = espandiRicerche({
      ...base,
      urlTemplate: "https://esempio.invalid/annunci/{comune}",
      parametri: { comune: ["milano", "bergamo"] },
    });
    assert.deepEqual(urls, [
      "https://esempio.invalid/annunci/milano",
      "https://esempio.invalid/annunci/bergamo",
    ]);
  });

  test("i valori vengono codificati per l'URL", async () => {
    const { espandiRicerche } = await import("./genericScraper.js");
    const { loadSiteConfigs } = await import("./registry.js");
    const base = (await loadSiteConfigs()).find((c) => c.name === "demo")!;

    const urls = espandiRicerche({
      ...base,
      urlTemplate: "https://esempio.invalid/{comune}",
      parametri: { comune: ["reggio emilia"] },
    });
    assert.deepEqual(urls, ["https://esempio.invalid/reggio%20emilia"]);
  });

  test("combina piu' parametri", async () => {
    const { espandiRicerche } = await import("./genericScraper.js");
    const { loadSiteConfigs } = await import("./registry.js");
    const base = (await loadSiteConfigs()).find((c) => c.name === "demo")!;

    const urls = espandiRicerche({
      ...base,
      urlTemplate: "https://esempio.invalid/{regione}/{tipo}",
      parametri: { regione: ["lombardia"], tipo: ["residenziale", "commerciale"] },
    });
    assert.equal(urls.length, 2);
    assert.ok(urls.includes("https://esempio.invalid/lombardia/residenziale"));
  });
});

describe("registry", () => {
  test("getFontiRegistry include tutte le fonti configurate", async () => {
    const reg = await getFontiRegistry();
    assert.ok("demo" in reg);
    assert.ok("astalegale" in reg);
    assert.ok("portale_vendite_pubbliche" in reg);
  });
});
