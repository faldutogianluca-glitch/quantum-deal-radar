import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { loadSiteConfigs } from "./registry.js";
import { GenericScraper } from "./genericScraper.js";
import {
  daDecidere,
  sospettoBloccoDiRete,
  urlDiVerifica,
  verdetto,
  type RigaVerifica,
} from "./verificaTutte.js";
import type { SiteConfig } from "./types.js";

function riga(p: Partial<RigaVerifica>): RigaVerifica {
  return {
    fonte: "x",
    displayName: "X",
    url: "https://esempio.invalid/r",
    statoDichiarato: "da_verificare",
    esito: "regole_lette",
    stato: 200,
    consentito: true,
    ...p,
  };
}

describe("verdetto", () => {
  test("distingue i cinque esiti, che non si equivalgono", () => {
    assert.equal(verdetto(riga({ esito: "regole_lette", consentito: true })), "consentito");
    assert.equal(verdetto(riga({ esito: "regole_lette", consentito: false })), "VIETATO");
    assert.equal(verdetto(riga({ esito: "assente" })), "nessun robots.txt");
    assert.equal(verdetto(riga({ esito: "accesso_negato" })), "ROBOTS NEGATO");
    assert.equal(verdetto(riga({ esito: "errore_server" })), "SERVER KO");
    assert.equal(verdetto(riga({ esito: "irraggiungibile" })), "IRRAGGIUNGIBILE");
  });

  test("un URL segnaposto non viene spacciato per verificato", () => {
    // il rischio e' proprio questo: leggere una riga vuota come se fosse un via libera
    assert.equal(verdetto(riga({ esito: null, stato: null, consentito: false })), "URL DA FORNIRE");
  });
});

describe("daDecidere", () => {
  test("elenca le fonti che robots.txt non vieta ma che nessuno ha ancora deciso", () => {
    const aperte = daDecidere([
      riga({ fonte: "libera", esito: "regole_lette", consentito: true }),
      riga({ fonte: "senza_robots", esito: "assente", consentito: true }),
    ]);
    assert.deepEqual(aperte.map((r) => r.fonte), ["libera", "senza_robots"]);
  });

  test("non propone cio' che e' gia' deciso, ne' cio' che e' vietato", () => {
    const aperte = daDecidere([
      riga({ fonte: "gia_aperta", statoDichiarato: "consentito" }),
      riga({ fonte: "vietata", esito: "regole_lette", consentito: false }),
      riga({ fonte: "chiusa", statoDichiarato: "vietato" }),
      riga({ fonte: "senza_url", esito: null, consentito: false }),
    ]);
    assert.deepEqual(aperte, [], `nessuna di queste va proposta, ottenute: ${aperte.map((r) => r.fonte)}`);
  });
});

describe("urlDiVerifica", () => {
  const base: SiteConfig = {
    name: "t",
    displayName: "T",
    enabled: false,
    priorita: 30,
    fetchMode: "browser",
    baseUrl: "https://esempio.invalid",
    searchUrl: "https://esempio.invalid/ricerca",
    listSelector: ".c",
    fields: { titolo: ".t", url: "a::attr(href)" },
    pagination: { maxPages: 1 },
    compliance: { stato: "da_verificare" },
    rateLimitSeconds: 5,
  };

  test("con urlTemplate sostituisce i parametri: un URL con {comune} dentro non e' interrogabile", () => {
    const url = urlDiVerifica({
      ...base,
      urlTemplate: "https://esempio.invalid/annunci/{comune}",
      parametri: { comune: ["milano", "bergamo"] },
    });
    assert.equal(url, "https://esempio.invalid/annunci/milano");
  });

  test("senza urlTemplate usa searchUrl", () => {
    assert.equal(urlDiVerifica(base), "https://esempio.invalid/ricerca");
  });

  test("una fixture locale non ha nulla da verificare", () => {
    assert.equal(urlDiVerifica({ ...base, fetchMode: "file" }), null);
  });
});

describe("i config dei siti", () => {
  test("dichiarano tutti uno stato di conformita': senza, la fonte sfuggirebbe al blocco", async () => {
    const configs = await loadSiteConfigs();
    const ammessi = ["da_verificare", "consentito", "vietato", "solo_contatto"];
    for (const c of configs) {
      if (c.fetchMode === "file") continue;
      assert.ok(c.compliance, `${c.name}: manca il blocco compliance`);
      const stato = c.compliance!.stato;
      assert.ok(ammessi.includes(stato), `${c.name}: stato "${stato}" non riconosciuto`);
    }
  });

  test("nessuna fonte abilitata senza una decisione esplicita di conformita'", async () => {
    const configs = await loadSiteConfigs();
    for (const c of configs) {
      if (!c.enabled || c.fetchMode === "file") continue;
      assert.equal(
        c.compliance?.stato,
        "consentito",
        `${c.name} e' abilitata ma il suo stato e' "${c.compliance?.stato}"`,
      );
    }
  });

  test("le fonti senza catalogo pubblico dicono dove consegnare i dati", async () => {
    const configs = await loadSiteConfigs();
    const manuali = configs.filter((c) => c.fetchMode === "manuale");
    assert.ok(manuali.length > 0, "l'elenco fonti ne contiene: il test perderebbe senso");

    for (const c of manuali) {
      assert.ok(c.manuale?.cartella, `${c.name}: una fonte manuale deve dichiarare manuale.cartella`);
      // senza file consegnati non produce nulla, ma deve dire dove metterli:
      // lamentare un percorso mancante non aiuterebbe nessuno
      const r = await new GenericScraper({ ...c, compliance: { stato: "consentito" } }).scrape();
      assert.equal(r.items.length, 0);
      assert.ok(
        r.errors.some((e) => /lasciaci dentro i CSV|Nessun CSV in/.test(e)),
        `${c.name}: atteso un messaggio su dove consegnare, ottenuti: ${JSON.stringify(r.errors)}`,
      );
    }
  });

  test("nessuna fonte pdf abilitata senza la regex che ne legge i lotti", async () => {
    const configs = await loadSiteConfigs();
    for (const c of configs) {
      if (c.fetchMode !== "pdf" || !c.enabled) continue;
      // il motore PDF c'e', ma senza rigaLotto scaricherebbe il documento per
      // poi non ricavarne niente: meglio non partire affatto
      assert.ok(
        c.pdf?.rigaLotto,
        `${c.name} e' abilitata in modalita' pdf ma non dichiara pdf.rigaLotto: ` +
          `va calibrata con 'npm run pdftesto' prima di accenderla`,
      );
    }
  });
});

describe("sospettoBloccoDiRete", () => {
  test("riconosce il guasto locale: venti portali ostili insieme non sono credibili", () => {
    const tutte = Array.from({ length: 10 }, (_, i) =>
      riga({ fonte: `f${i}`, esito: "accesso_negato", stato: 403, consentito: false }),
    );
    assert.equal(sospettoBloccoDiRete(tutte), true);
  });

  test("un sito ostile isolato non fa sospettare la rete", () => {
    const righe = [
      riga({ fonte: "ostile", esito: "accesso_negato", stato: 403, consentito: false }),
      ...Array.from({ length: 9 }, (_, i) => riga({ fonte: `ok${i}`, esito: "regole_lette" })),
    ];
    assert.equal(sospettoBloccoDiRete(righe), false);
  });

  test("con pochissime fonti interrogate non si azzarda una diagnosi", () => {
    // due fallimenti su due non dicono nulla: il campione e' troppo piccolo
    const righe = [
      riga({ fonte: "a", esito: "irraggiungibile", stato: null, consentito: false }),
      riga({ fonte: "b", esito: "irraggiungibile", stato: null, consentito: false }),
    ];
    assert.equal(sospettoBloccoDiRete(righe), false);
  });

  test("i segnaposto non contano: non sono stati interrogati", () => {
    const righe = [
      ...Array.from({ length: 8 }, (_, i) => riga({ fonte: `p${i}`, esito: null, consentito: false })),
      ...Array.from({ length: 5 }, (_, i) => riga({ fonte: `ok${i}`, esito: "regole_lette" })),
    ];
    assert.equal(sospettoBloccoDiRete(righe), false);
  });
});
