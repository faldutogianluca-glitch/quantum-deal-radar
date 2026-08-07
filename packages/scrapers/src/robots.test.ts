import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { azzeraCacheRobots, consentito, parseRobotsTxt, rallenta, TOKEN_BOT } from "./robots.js";

/** fetch finto che serve sempre lo stesso robots.txt, contando le richieste. */
function serviRobots(testo: string, opz: { ok?: boolean; errore?: boolean } = {}) {
  let richieste = 0;
  const impl = (async () => {
    richieste++;
    if (opz.errore) throw new Error("ECONNREFUSED");
    return { ok: opz.ok ?? true, text: async () => testo } as unknown as Response;
  }) as unknown as typeof fetch;
  return { impl, richieste: () => richieste };
}

beforeEach(() => azzeraCacheRobots());

describe("parseRobotsTxt: selezione del gruppo", () => {
  test("il gruppo che ci nomina prevale sul wildcard", () => {
    // Regressione: i due gruppi venivano uniti, quindi un sito che ci concede
    // l'accesso esplicito ereditava comunque i divieti generici.
    const r = parseRobotsTxt(
      `User-agent: *\nDisallow: /\n\nUser-agent: QuantumDealRadarBot\nDisallow: /privato\n`,
    );
    assert.deepEqual(r.disallow, ["/privato"], "il gruppo wildcard va ignorato del tutto");
  });

  test("senza un gruppo che ci nomina vale il wildcard", () => {
    const r = parseRobotsTxt(`User-agent: *\nDisallow: /privato\n\nUser-agent: GoogleBot\nDisallow: /\n`);
    assert.deepEqual(r.disallow, ["/privato"], "il gruppo di un altro bot non ci riguarda");
  });

  test("righe User-agent consecutive condividono le stesse regole", () => {
    const r = parseRobotsTxt(`User-agent: GoogleBot\nUser-agent: QuantumDealRadarBot\nDisallow: /x\n`);
    assert.deepEqual(r.disallow, ["/x"]);
  });

  test("un nuovo User-agent dopo delle regole apre un gruppo distinto", () => {
    const r = parseRobotsTxt(
      `User-agent: QuantumDealRadarBot\nDisallow: /a\n\nUser-agent: AltroBot\nDisallow: /b\n`,
    );
    assert.deepEqual(r.disallow, ["/a"]);
  });

  test("il confronto sul token e' insensibile al maiuscolo", () => {
    assert.deepEqual(parseRobotsTxt(`User-agent: QUANTUMDEALRADARBOT\nDisallow: /x\n`).disallow, ["/x"]);
    assert.deepEqual(parseRobotsTxt(`user-agent: quantumdealradarbot\ndisallow: /y\n`).disallow, ["/y"]);
  });

  test("'Disallow:' vuoto non e' un divieto", () => {
    // Un prefisso vuoto combacerebbe con qualunque path e bloccherebbe tutto.
    const r = parseRobotsTxt(`User-agent: *\nDisallow:\n`);
    assert.deepEqual(r.disallow, []);
  });

  test("commenti ignorati e righe CRLF gestite", () => {
    const r = parseRobotsTxt("User-agent: *\r\nDisallow: /a # nota\r\n# riga intera\r\nAllow: /a/ok\r\n");
    assert.deepEqual(r.disallow, ["/a"]);
    assert.deepEqual(r.allow, ["/a/ok"]);
  });

  test("robots.txt vuoto o senza gruppi non produce regole", () => {
    assert.deepEqual(parseRobotsTxt(""), { disallow: [], allow: [] });
    assert.deepEqual(parseRobotsTxt("Disallow: /orfano\n"), { disallow: [], allow: [] });
  });

  test("il product token e' sovrascrivibile", () => {
    assert.deepEqual(parseRobotsTxt(`User-agent: altro\nDisallow: /z\n`, "altro").disallow, ["/z"]);
    assert.equal(TOKEN_BOT, "quantumdealradarbot");
  });
});

describe("consentito: applicazione delle regole", () => {
  test("nessun divieto -> consentito", async () => {
    const { impl } = serviRobots(`User-agent: *\nDisallow: /altro\n`);
    assert.equal(await consentito("https://a.test/aste/1", impl), true);
  });

  test("prefisso vietato -> bloccato", async () => {
    const { impl } = serviRobots(`User-agent: *\nDisallow: /privato\n`);
    assert.equal(await consentito("https://a.test/privato/x", impl), false);
  });

  test("Disallow: / blocca tutto", async () => {
    const { impl } = serviRobots(`User-agent: *\nDisallow: /\n`);
    assert.equal(await consentito("https://a.test/qualsiasi", impl), false);
  });

  test("l'Allow piu' specifico batte il Disallow", async () => {
    const { impl } = serviRobots(`User-agent: *\nDisallow: /a\nAllow: /a/ok\n`);
    assert.equal(await consentito("https://a.test/a/ok/1", impl), true);
    assert.equal(await consentito("https://a.test/a/no/1", impl), false);
  });

  test("a parita' di lunghezza vince Allow", async () => {
    const { impl } = serviRobots(`User-agent: *\nDisallow: /a\nAllow: /a\n`);
    assert.equal(await consentito("https://a.test/a", impl), true);
  });

  test("il gruppo che ci nomina sblocca cio' che il wildcard vieta", async () => {
    const { impl } = serviRobots(
      `User-agent: *\nDisallow: /\n\nUser-agent: QuantumDealRadarBot\nDisallow: /privato\n`,
    );
    assert.equal(await consentito("https://a.test/aste/1", impl), true);
    assert.equal(await consentito("https://a.test/privato/1", impl), false);
  });

  test("la query string rientra nel confronto", async () => {
    const { impl } = serviRobots(`User-agent: *\nDisallow: /cerca?ordina\n`);
    assert.equal(await consentito("https://a.test/cerca?ordina=prezzo", impl), false);
    assert.equal(await consentito("https://a.test/cerca?pagina=2", impl), true);
  });

  test("robots.txt assente (404) -> consenti tutto", async () => {
    const { impl } = serviRobots("", { ok: false });
    assert.equal(await consentito("https://a.test/qualsiasi", impl), true);
  });

  test("robots.txt irraggiungibile -> consenti tutto", async () => {
    const { impl } = serviRobots("", { errore: true });
    assert.equal(await consentito("https://a.test/qualsiasi", impl), true);
  });

  test("robots.txt letto una volta sola per origin", async () => {
    const { impl, richieste } = serviRobots(`User-agent: *\nDisallow: /x\n`);
    await consentito("https://a.test/1", impl);
    await consentito("https://a.test/2", impl);
    assert.equal(richieste(), 1, "la cache evita di riscaricare robots.txt a ogni URL");

    await consentito("https://b.test/1", impl);
    assert.equal(richieste(), 2, "un origin diverso ha il suo robots.txt");
  });

  test("azzeraCacheRobots forza una rilettura", async () => {
    const { impl, richieste } = serviRobots(`User-agent: *\nDisallow: /x\n`);
    await consentito("https://a.test/1", impl);
    azzeraCacheRobots();
    await consentito("https://a.test/1", impl);
    assert.equal(richieste(), 2);
  });
});

describe("rallenta: distanziamento per sito", () => {
  test("la prima richiesta non attende, la seconda si", async () => {
    const t0 = Date.now();
    await rallenta("sito-a", 0.12);
    assert.ok(Date.now() - t0 < 100, "nessuna attesa alla prima richiesta");

    const t1 = Date.now();
    await rallenta("sito-a", 0.12);
    assert.ok(Date.now() - t1 >= 100, "la seconda deve rispettare l'intervallo");
  });

  test("siti diversi non si bloccano a vicenda", async () => {
    await rallenta("sito-b", 5);
    const t0 = Date.now();
    await rallenta("sito-c", 5);
    assert.ok(Date.now() - t0 < 100, "il timer e' per sito, non globale");
  });
});
