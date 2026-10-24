import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { GenericScraper } from "./genericScraper.js";
import { parseDataJson, risolviCampo } from "./json.js";
import type { SiteConfig } from "./types.js";

// La forma dell'API di Ferservizi: un elenco di chiavi, una scheda per annuncio.
async function fixture(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "qdr-json-"));
  await writeFile(
    join(dir, "elenco.json"),
    JSON.stringify({
      data: [
        { id: 1, isVendite: true, prezzo: 19500000, mq: 72557, dataGara: "20270120000000" },
        { id: 2, isVendite: false, prezzo: 900, mq: 60, dataGara: null },
        { id: 3, isVendite: true, prezzo: "150.000", mq: 95, dataGara: null },
      ],
    }),
  );
  await writeFile(
    join(dir, "det_1.json"),
    JSON.stringify({ annuncio: { codice: "AU4TO03", comune: "Torino", immobile: { indirizzo: "via Passo Buole snc" } } }),
  );
  await writeFile(
    join(dir, "det_3.json"),
    JSON.stringify({ annuncio: { codice: "CO1", comune: "Collegno", immobile: { indirizzo: null } } }),
  );
  return dir;
}

function config(dir: string, extra: Partial<SiteConfig["json"]> = {}): SiteConfig {
  return {
    name: "prova-json",
    displayName: "Prova JSON",
    enabled: true,
    priorita: 99,
    fetchMode: "json",
    baseUrl: "https://esempio.invalid",
    searchUrl: join(dir, "elenco.json"),
    listSelector: ".nessuno",
    tipoPrezzo: "base_asta",
    fields: { titolo: ".nessuno", url: ".nessuno" },
    pagination: { maxPages: 1 },
    rateLimitSeconds: 0,
    compliance: { stato: "consentito" },
    json: {
      elenco: "data",
      filtro: { isVendite: true },
      dettaglio: join(dir, "det_{elenco.id}.json"),
      campi: {
        idEsterno: "{elenco.id}",
        url: "https://esempio.invalid/#/dettaglio-annuncio?id={elenco.id}",
        titolo: "{dettaglio.annuncio.codice} - {dettaglio.annuncio.comune}",
        prezzoRaw: "elenco.prezzo",
        mqRaw: "elenco.mq",
        comune: "dettaglio.annuncio.comune",
        indirizzoRaw: "dettaglio.annuncio.immobile.indirizzo",
        dataAstaRaw: "elenco.dataGara",
      },
      ...extra,
    },
  };
}

describe("modalita' json", () => {
  test("legge elenco e schede, tenendo solo cio' che passa il filtro", async () => {
    const r = await new GenericScraper(config(await fixture())).scrape();
    assert.deepEqual(r.errors, []);
    assert.equal(r.items.length, 2, "l'affitto (isVendite: false) resta fuori");

    const [torino, collegno] = r.items;
    assert.equal(torino!.idEsterno, "1");
    assert.equal(torino!.titolo, "AU4TO03 - Torino");
    assert.equal(torino!.url, "https://esempio.invalid/#/dettaglio-annuncio?id=1");
    assert.equal(torino!.prezzo, 19_500_000);
    assert.equal(torino!.mq, 72_557);
    assert.equal(torino!.comune, "Torino");
    assert.equal(torino!.indirizzoRaw, "via Passo Buole snc");
    assert.equal(torino!.dataAsta, "2027-01-20", "data compatta delle API");

    assert.equal(collegno!.prezzo, 150_000, "un importo in testo si legge come gli altri");
    assert.equal(collegno!.indirizzoRaw, undefined, "un campo nullo resta vuoto, non 'null'");
    assert.equal(collegno!.dataAsta, null);
  });

  test("limite riduce gli elementi letti", async () => {
    const r = await new GenericScraper(config(await fixture(), { limite: 1 })).scrape();
    assert.equal(r.items.length, 1);
  });

  test("una scheda che non risponde non fa cadere l'elenco", async () => {
    const dir = await fixture();
    const r = await new GenericScraper(config(dir, { dettaglio: join(dir, "manca_{elenco.id}.json") })).scrape();
    assert.equal(r.items.length, 0);
    assert.ok(r.errors.some((e) => /Scheda .*manca_1\.json/.test(e)), JSON.stringify(r.errors));
    assert.ok(r.errors.some((e) => /nessun immobile letto/.test(e)), "zero risultati va segnalato");
  });

  test("un percorso dell'elenco sbagliato lo dice, invece di restituire zero", async () => {
    const r = await new GenericScraper(config(await fixture(), { elenco: "risultati" })).scrape();
    assert.equal(r.items.length, 0);
    assert.match(r.errors[0]!, /json\.elenco = "risultati" non porta a un array/);
  });

  test("il vaglio di conformita' vale anche per le API", async () => {
    const c = { ...config(await fixture()), compliance: { stato: "da_verificare" as const } };
    const r = await new GenericScraper(c).scrape();
    assert.equal(r.items.length, 0);
    assert.match(r.errors[0]!, /non e' stata autorizzata/);
  });

  test("un modello con un segnaposto vuoto vale null", () => {
    assert.equal(risolviCampo("{elenco.a}, {elenco.b}", { elenco: { a: "Torino", b: null } }), null);
    assert.equal(risolviCampo("{elenco.a}", { elenco: { a: 7 } }), "7");
  });

  test("date delle API", () => {
    assert.equal(parseDataJson("20270120000000"), "2027-01-20");
    assert.equal(parseDataJson("20270120"), "2027-01-20");
    assert.equal(parseDataJson("2026-11-18T12:00:00Z"), "2026-11-18");
    assert.equal(parseDataJson("18/11/2026"), "2026-11-18");
    assert.equal(parseDataJson(null), null);
  });
});
