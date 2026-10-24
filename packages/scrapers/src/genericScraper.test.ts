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

    const base = (await loadSiteConfigs()).find((c) => c.name === "reperform")!;
    // simula l'errore di chi abilita un adapter prima di compilarne gli indirizzi:
    // la conformita' e' a posto, manca solo l'URL vero
    const template = {
      ...base,
      name: "prova-template",
      enabled: true,
      baseUrl: "https://DA-COMPILARE.invalid",
      searchUrl: "https://DA-COMPILARE.invalid/risultati",
      compliance: { stato: "consentito" as const },
    };

    const r = await new GenericScraper(template).scrape();
    assert.equal(r.items.length, 0);
    assert.equal(r.errors.length, 1);
    assert.match(r.errors[0]!, /ancora un template/);
  });

  test("nessun config lasciato con un segnaposto e insieme abilitato", async () => {
    const { loadSiteConfigs } = await import("./registry.js");
    for (const c of await loadSiteConfigs()) {
      if (!/DA-COMPILARE/i.test(c.searchUrl) && !/DA-COMPILARE/i.test(c.baseUrl)) continue;
      assert.equal(c.enabled, false, `${c.name} ha un URL segnaposto ma risulta abilitata`);
    }
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

describe("motore json (fixture locale, nessuna rete)", () => {
  test("legge i record da un percorso nella risposta e lascia i numeri numeri", async () => {
    const { GenericScraper } = await import("./genericScraper.js");
    const { loadSiteConfigs } = await import("./registry.js");
    const { dirname, join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");

    const base = (await loadSiteConfigs()).find((c) => c.name === "portale_vendite_pubbliche")!;
    assert.equal(base.fetchMode, "json");
    // dist/genericScraper.test.js -> ../fixtures: una risposta vera, ridotta a tre lotti
    const fixture = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "pvp_ricerca.json");
    const r = await new GenericScraper({ ...base, name: "pvp-fixture", searchUrl: fixture }).scrape();

    assert.deepEqual(r.errors, []);
    assert.equal(r.items.length, 3);

    const conCoordinate = r.items.find((i) => i.idEsterno === "1738450")!;
    assert.equal(conCoordinate.prezzo, 513000, "un prezzo JSON non passa dal parser italiano");
    assert.equal(conCoordinate.tipoPrezzo, "base_asta");
    assert.equal(conCoordinate.comune, "Livorno");
    assert.equal(conCoordinate.lat, 43.472491);
    assert.equal(conCoordinate.lon, 10.33323);
    assert.equal(conCoordinate.url, "https://pvp.giustizia.it/pvp/it/detail_annuncio.page?idAnnuncio=1738450");
    assert.match(conCoordinate.dataAsta ?? "", /^\d{4}-\d{2}-\d{2}$/);

    const conMq = r.items.find((i) => i.idEsterno === "1747211")!;
    assert.equal(conMq.mq, 3.66, "la superficie si estrae dal testo libero, con la virgola italiana");

    const senzaCoordinate = r.items.find((i) => i.idEsterno === "1772673")!;
    assert.equal(senzaCoordinate.lat, null);
    assert.equal(senzaCoordinate.mq, null);
  });

  test("una risposta senza l'elenco atteso lo dice, invece di produrre zero record in silenzio", async () => {
    const { GenericScraper } = await import("./genericScraper.js");
    const { loadSiteConfigs } = await import("./registry.js");
    const { dirname, join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");

    const base = (await loadSiteConfigs()).find((c) => c.name === "portale_vendite_pubbliche")!;
    const fixture = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "pvp_ricerca.json");
    const r = await new GenericScraper({ ...base, name: "pvp-rotto", searchUrl: fixture, listSelector: "body.elenco" }).scrape();
    assert.equal(r.items.length, 0);
    assert.match(r.errors[0] ?? "", /non e' un elenco/);
  });
});

describe("parseDataIt con date ISO", () => {
  test("una data API in ISO non viene scambiata per giorno/mese/anno", () => {
    assert.equal(parseDataIt("2027-01-23"), "2027-01-23");
    assert.equal(parseDataIt("2027-01-23T10:00"), "2027-01-23");
  });
});
