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

describe("Demanio: elenco e schede di dettaglio (pagine reali salvate, rete simulata)", () => {
  test("legge prezzo base, superficie, stato, scadenza e indirizzo dalla scheda", async () => {
    const { readFile } = await import("node:fs/promises");
    const { fileURLToPath } = await import("node:url");
    const { loadSiteConfigs } = await import("./registry.js");
    const { GenericScraper } = await import("./genericScraper.js");
    const fixture = (nome: string) => readFile(fileURLToPath(new URL(`../fixtures/${nome}`, import.meta.url)), "utf-8");
    const elenco = await fixture("demanio_elenco.html");
    const scheda = await fixture("demanio_scheda.html");
    // la stessa scheda come apparirebbe a vendita chiusa: e' lo stesso campo, valorizzato
    const aggiudicata = scheda.replace(/(Prezzo di Aggiudicazione:<\/th>\s*<td>)/, "$175.000,00");

    const base = (await loadSiteConfigs()).find((c) => c.name === "demanio")!;
    const config = {
      ...base,
      urlTemplate: undefined,
      rateLimitSeconds: 0,
      compliance: { stato: "consentito" as const },
    };
    const richieste: string[] = [];
    const fetchOriginale = globalThis.fetch;
    globalThis.fetch = (async (input: string | URL) => {
      const url = String(input);
      richieste.push(url);
      if (url.endsWith("/robots.txt")) return new Response("", { status: 404 });
      if (url.includes("/ricerca/")) return new Response(elenco, { status: 200 });
      if (url.includes("id-immobile=19987")) return new Response(scheda, { status: 200 });
      if (url.includes("id-immobile=19992")) return new Response(aggiudicata, { status: 200 });
      return new Response("non trovata", { status: 404 });
    }) as typeof fetch;
    try {
      const r = await new GenericScraper(config).scrape();
      assert.equal(r.items.length, 2);
      const chiari = r.items.find((i) => i.idEsterno === "19987")!;
      assert.equal(chiari.titolo, "LOTTO 1 - BS0623 - CHIARI - APPARTAMENTO IN VIA P. CADEO N. 6");
      assert.equal(chiari.tipoVendita, "Scaduto");
      assert.equal(chiari.prezzo, 63600);
      assert.equal(chiari.mq, 72, "superficie catastale, il primo numero della cella");
      assert.equal(chiari.statoOccupazionale, "Libero");
      assert.equal(chiari.termineOfferte, "2026-05-06");
      assert.equal(chiari.comune, "CHIARI");
      assert.equal(chiari.indirizzoRaw, "VIALE P. CADEO n. 6");
      assert.equal(chiari.sottotipoAsset, "A3");
      assert.equal(chiari.prezzoAggiudicazione ?? null, null, "cella vuota: nessuna aggiudicazione");
      assert.equal(chiari.tipoPrezzo, "base_asta");
      const aggiudicato = r.items.find((i) => i.idEsterno === "19992")!;
      assert.equal(aggiudicato.prezzoAggiudicazione, 75000);
      assert.deepEqual(r.errors, []);
      assert.ok(richieste.some((u) => u.includes("id-immobile=19987")));
    } finally {
      globalThis.fetch = fetchOriginale;
    }
  });
});

describe("Invimit: tabella della Vetrina (pagina reale salvata, rete simulata)", () => {
  test("legge le vendite con superficie, prezzo e scadenza, e lascia fuori le locazioni", async () => {
    const { readFile } = await import("node:fs/promises");
    const { fileURLToPath } = await import("node:url");
    const { loadSiteConfigs } = await import("./registry.js");
    const { GenericScraper } = await import("./genericScraper.js");
    const html = await readFile(fileURLToPath(new URL("../fixtures/invimit_vetrina.html", import.meta.url)), "utf-8");
    const base = (await loadSiteConfigs()).find((c) => c.name === "invimit")!;
    const fetchOriginale = globalThis.fetch;
    globalThis.fetch = (async (input: string | URL) =>
      String(input).endsWith("/robots.txt") ? new Response("", { status: 404 }) : new Response(html, { status: 200 })) as typeof fetch;
    try {
      const r = await new GenericScraper({ ...base, rateLimitSeconds: 0, compliance: { stato: "consentito" } }).scrape();
      assert.deepEqual(r.errors, []);
      assert.equal(r.items.length, 2, "la riga di locazione non entra");
      const napoli = r.items.find((i) => i.idEsterno === "F15-003-NA")!;
      assert.equal(napoli.comune, "Napoli");
      assert.equal(napoli.indirizzoRaw, "Via Marechiaro 93");
      assert.equal(napoli.mq, 666.28);
      assert.equal(napoli.prezzo, 600000);
      assert.equal(napoli.termineOfferte, "2026-12-07");
      assert.match(napoli.url ?? "", /SCHEDA-TECNICA\.pdf$/);
      assert.equal(napoli.tipoPrezzo, "base_asta");
    } finally {
      globalThis.fetch = fetchOriginale;
    }
  });
});

describe("sito sovraccarico", () => {
  test("un 503 si riprova dopo un'attesa, invece di perdere la pagina", async () => {
    const { loadSiteConfigs } = await import("./registry.js");
    const { GenericScraper, ATTESE_RIPROVA } = await import("./genericScraper.js");
    const base = (await loadSiteConfigs()).find((c) => c.name === "invimit")!;
    const { readFile } = await import("node:fs/promises");
    const { fileURLToPath } = await import("node:url");
    const html = await readFile(fileURLToPath(new URL("../fixtures/invimit_vetrina.html", import.meta.url)), "utf-8");
    let chiamate = 0;
    const fetchOriginale = globalThis.fetch;
    const attese = ATTESE_RIPROVA.valori;
    ATTESE_RIPROVA.valori = [1, 1];
    globalThis.fetch = (async (input: string | URL) => {
      if (String(input).endsWith("/robots.txt")) return new Response("", { status: 404 });
      chiamate++;
      return chiamate === 1 ? new Response("", { status: 503 }) : new Response(html, { status: 200 });
    }) as typeof fetch;
    try {
      const r = await new GenericScraper({ ...base, rateLimitSeconds: 0, compliance: { stato: "consentito" } }).scrape();
      assert.deepEqual(r.errors, []);
      assert.equal(r.items.length, 2);
      assert.equal(chiamate, 2);
    } finally {
      globalThis.fetch = fetchOriginale;
      ATTESE_RIPROVA.valori = attese;
    }
  });
});

describe("superfici come le scrive la Vetrina Demanio", () => {
  test("il numero piu' grande accanto a mq, non il subalterno ne' la categoria", async () => {
    const { parseSuperficie, parseImporto } = await import("./parsing.js");
    assert.equal(parseSuperficie("Superficie catastale: sub. 8 - 99 mq sub.16 - 26 mq (sup. catastale)"), 99);
    assert.equal(parseSuperficie("sup. cat. mq 199 + 97 (sup. catastale)"), 199);
    assert.equal(parseSuperficie("A/1: 404 mq, C/6: 20 mq (sup. catastale)"), 404);
    assert.equal(parseSuperficie("superficie catastale 72 mq - totale escluse aree scoperte 69 mq"), 72);
    assert.equal(parseSuperficie("98 mq. + 31 mq. (sup. catastale)"), 98);
    assert.equal(parseSuperficie(" 666,28 mq "), 666.28);
    assert.equal(parseSuperficie("80"), 80);
    assert.equal(parseImporto("sup. cat. 199"), 199, "il punto di 'sup.' non e' un numero");
  });
});
