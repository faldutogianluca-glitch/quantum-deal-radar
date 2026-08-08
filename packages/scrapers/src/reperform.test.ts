import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { GenericScraper } from "./genericScraper.js";
import { loadSiteConfigs } from "./registry.js";
import type { SiteConfig } from "./types.js";

/**
 * Verifica i selettori di Reperform contro una scheda reale catturata dal sito.
 * Se il portale cambia struttura, questi test falliscono invece di lasciare che
 * lo scraping restituisca in silenzio zero risultati o campi vuoti.
 */
const FIXTURE = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "fixtures",
  "reperform_scheda.html",
);

async function estraiDallaFixture() {
  const config = (await loadSiteConfigs()).find((c) => c.name === "reperform")!;
  const suFile: SiteConfig = { ...config, fetchMode: "file", searchUrl: FIXTURE };
  return new GenericScraper(suFile).scrape();
}

describe("adapter Reperform, sui selettori reali", () => {
  test("estrae entrambe le schede senza errori", async () => {
    const r = await estraiDallaFixture();
    assert.deepEqual(r.errors, []);
    assert.equal(r.items.length, 2);
  });

  test("titolo, comune e link", async () => {
    const i = (await estraiDallaFixture()).items[0]!;
    assert.equal(i.titolo, "EDIFICIO IN CECCANO (FR)");
    assert.equal(i.comune, "Ceccano");
    assert.match(i.url ?? "", /\/pre-aste\/immobiliare\/4123\//);
  });

  test("usa l'id del portale, non lo slug dell'URL", async () => {
    // lo slug puo' cambiare se il portale rinomina l'annuncio; l'id no
    assert.equal((await estraiDallaFixture()).items[0]!.idEsterno, "4123");
  });

  test("l'immagine viene estratta dal background-image CSS", async () => {
    // non e' un tag <img>: senza regex sullo style il campo resterebbe vuoto
    const i = (await estraiDallaFixture()).items[0]!;
    assert.equal(i.immagineUrl, "https://www.reperform.com/storage/copia-di-sold-2026-02-04t151628090_rEE.png");
  });

  test("le coordinate sono lette dalla pagina, quindi niente geocoding", async () => {
    const i = (await estraiDallaFixture()).items[0]!;
    assert.equal(i.lat, 41.575734);
    assert.equal(i.lon, 13.320172);
  });

  test("gli esperimenti deserti sono uno in meno del numero di esperimento", async () => {
    const items = (await estraiDallaFixture()).items;
    // "N. esperimento: 1" = primo tentativo, nessuno ancora andato deserto
    assert.equal(items[0]!.nEsperimentiDeserti, 0);
    // "N. esperimento: 3" = due tentativi gia' andati deserti
    assert.equal(items[1]!.nEsperimentiDeserti, 2);
  });

  test("il numero di lotto viene estratto dalla query string", async () => {
    const items = (await estraiDallaFixture()).items;
    assert.equal(items[0]!.numeroLotto, "Lotto unico");
    assert.equal(items[1]!.numeroLotto, "Lotto 2");
  });

  test("nessun prezzo: la 'valutazione media' non e' un prezzo di vendita", async () => {
    // mapparla su prezzo renderebbe lo sconto autoreferenziale, su valorePerizia
    // le darebbe la confidenza di una perizia CTU: resta deliberatamente fuori
    for (const i of (await estraiDallaFixture()).items) {
      assert.equal(i.prezzo, null);
      assert.equal(i.tipoPrezzo, null);
    }
  });

  test("lo stato della vendita viene conservato", async () => {
    assert.equal((await estraiDallaFixture()).items[0]!.tipoVendita, "Pre-asta in corso");
  });
});
