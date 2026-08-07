import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isAbsolute } from "node:path";

import { parseDataIt, parseImporto, tipoPrezzoValido, valutaSimbolo } from "./parsing.js";
import { getAllScrapers, getScraper, invalidaCacheSiti, loadSiteConfigs } from "./registry.js";

describe("parseImporto", () => {
  test("formato italiano: punto migliaia, virgola decimale", () => {
    assert.equal(parseImporto("€ 89.500,00"), 89500);
    assert.equal(parseImporto("1.234.567,89"), 1234567.89);
    assert.equal(parseImporto("1.234,5"), 1234.5);
  });

  test("senza virgola ogni punto e' separatore di migliaia", () => {
    // "210.000" vale 210000, non 210: e' la convenzione documentata del modulo.
    assert.equal(parseImporto("210.000 €"), 210000);
    assert.equal(parseImporto("1.500"), 1500);
  });

  test("numeri nudi", () => {
    assert.equal(parseImporto("89500"), 89500);
    assert.equal(parseImporto("Prezzo base 95000 EUR"), 95000);
  });

  test("prende il primo numero quando la stringa ne contiene piu' d'uno", () => {
    assert.equal(parseImporto("Base 89.500,00 - Offerta minima 67.125,00"), 89500);
  });

  test("senza cifre -> null", () => {
    assert.equal(parseImporto("prezzo su richiesta"), null);
    assert.equal(parseImporto(""), null);
  });
});

describe("parseDataIt", () => {
  test("formato numerico con separatori diversi", () => {
    assert.equal(parseDataIt("03/12/2026"), "2026-12-03");
    assert.equal(parseDataIt("3-7-2026"), "2026-07-03");
  });

  test("anno a due cifre interpretato nel 2000", () => {
    assert.equal(parseDataIt("03/12/26"), "2026-12-03");
  });

  test("formato testuale, insensibile al maiuscolo", () => {
    assert.equal(parseDataIt("Asta: 12 novembre 2026"), "2026-11-12");
    assert.equal(parseDataIt("1 Gennaio 2027"), "2027-01-01");
    assert.equal(parseDataIt("28 FEBBRAIO 2026"), "2026-02-28");
  });

  test("date impossibili -> null invece di una data slittata", () => {
    // Date.UTC(2026, 12, ...) rotolerebbe al 2027: isoData() lo intercetta.
    assert.equal(parseDataIt("01/13/2026"), null, "mese 13");
    assert.equal(parseDataIt("32/01/2026"), null, "giorno 32");
    assert.equal(parseDataIt("30/02/2026"), null, "30 febbraio");
    assert.equal(parseDataIt("00/01/2026"), null, "giorno 0");
  });

  test("mese testuale inesistente e testo non parsabile -> null", () => {
    assert.equal(parseDataIt("12 piovoso 2026"), null);
    assert.equal(parseDataIt("data da destinarsi"), null);
    assert.equal(parseDataIt(""), null);
  });

  test("gli anni bisestili passano", () => {
    assert.equal(parseDataIt("29/02/2028"), "2028-02-29");
    assert.equal(parseDataIt("29/02/2026"), null, "il 2026 non e' bisestile");
  });
});

describe("tipoPrezzoValido", () => {
  test("accetta i tre tipi previsti da @qdr/core", () => {
    for (const v of ["base_asta", "richiesta_reoco", "trattativa"]) {
      assert.equal(tipoPrezzoValido(v), v);
    }
  });

  test("qualunque altro valore -> undefined", () => {
    assert.equal(tipoPrezzoValido("asta"), undefined);
    assert.equal(tipoPrezzoValido(""), undefined);
    assert.equal(tipoPrezzoValido(undefined), undefined);
  });
});

describe("valutaSimbolo", () => {
  // NOTA: esportata da @qdr/scrapers ma non richiamata da nessuna parte.
  // Il test fissa il contratto finche' resta nella superficie pubblica.
  test("riconosce i simboli noti", () => {
    assert.equal(valutaSimbolo("€ 100"), "EUR");
    assert.equal(valutaSimbolo("$100"), "USD");
    assert.equal(valutaSimbolo("£100"), "GBP");
  });

  test("nessun simbolo -> null", () => {
    assert.equal(valutaSimbolo("100"), null);
  });
});

describe("registry dei siti", () => {
  test("i config con fetchMode 'file' hanno un searchUrl assoluto", async () => {
    // Altrimenti la fixture si risolverebbe rispetto alla cwd del processo
    // che importa @qdr/scrapers, non alla radice del pacchetto.
    const demo = (await loadSiteConfigs()).find((c) => c.name === "demo")!;
    assert.ok(isAbsolute(demo.searchUrl), demo.searchUrl);
  });

  test("getAllScrapers salta i siti disabilitati salvo richiesta esplicita", async () => {
    const attivi = (await getAllScrapers()).map((s) => s.name);
    const tutti = (await getAllScrapers(true)).map((s) => s.name);

    assert.deepEqual(attivi, ["demo"]);
    assert.ok(tutti.length > attivi.length);
    assert.ok(tutti.includes("astalegale") && tutti.includes("portale_vendite_pubbliche"));
  });

  test("getScraper su un nome inesistente -> null", async () => {
    assert.equal(await getScraper("non-esiste"), null);
    assert.equal((await getScraper("demo"))?.name, "demo");
  });

  test("invalidaCacheSiti forza la rilettura da disco", async () => {
    const primo = await loadSiteConfigs();
    assert.equal(await loadSiteConfigs(), primo, "senza invalidazione si riusa l'istanza in cache");

    invalidaCacheSiti();
    const dopo = await loadSiteConfigs();
    assert.notEqual(dopo, primo, "dopo l'invalidazione i config vengono riletti");
    assert.deepEqual(dopo.map((c) => c.name).sort(), primo.map((c) => c.name).sort());
  });
});
