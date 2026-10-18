import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Dati nel formato prodotto dal comando "omi": codice e nome del comune, stato ottimo.
const dir = mkdtempSync(join(tmpdir(), "qdr-enrich-omi-"));
process.env.QDR_DATA_DIR = dir;
process.env.QDR_DB_PATH = join(dir, "test.db");
writeFileSync(join(dir, "zone_omi.geojson"), JSON.stringify({
  type: "FeatureCollection",
  features: [{
    type: "Feature",
    properties: { comune_amm: "F205", zona: "C12" },
    geometry: { type: "Polygon", coordinates: [[[9.16, 45.44], [9.2, 45.44], [9.2, 45.47], [9.16, 45.47], [9.16, 45.44]]] },
  }],
}));
writeFileSync(join(dir, "quotazioni_omi.json"), JSON.stringify([{
  comuneCod: "F205", comune: "MILANO", zona: "C12", tipologia: "Abitazioni civili",
  vendMin: 4500, vendMax: 5600, vendMinOttimo: 5800, vendMaxOttimo: 7000, semestre: "2024-2",
}, {
  comuneCod: "F205", comune: "MILANO", zona: "C12", tipologia: "Abitazioni di tipo economico",
  vendMin: 2600, vendMax: 3200, vendMinOttimo: 3300, vendMaxOttimo: 3900, semestre: "2024-2",
}]));

const { eseguiEnrich } = await import("./enrich.js");
const { db } = await import("./db.js");

function inserisci(campi: Record<string, string | number | null>): number {
  const now = new Date().toISOString();
  const base = {
    chiave_dedup: `T|${Math.random()}`, fonte: "demanio", id_esterno: String(Math.random()), titolo: "Lotto",
    comune: "MILANO", comune_cod: null, mq: 90, prezzo: 250_000, tipo_prezzo: "base_asta",
    first_seen_at: now, scraped_at: now, ...campi,
  };
  const col = Object.keys(base);
  return Number(db.prepare(`INSERT INTO immobili (${col.join(", ")}) VALUES (${col.map((c) => `@${c}`).join(", ")})`).run(base).lastInsertRowid);
}

describe("enrich con le quotazioni OMI reali di Milano", () => {
  test("usufrutti, quote e box restano fuori dal perimetro del binario B", async () => {
    const usufrutto = inserisci({ lat: 45.455, lon: 9.18, titolo: "USUFRUTTO DI APPARTAMENTO, CANTINA E BOX IN MILANO" });
    const box = inserisci({ lat: 45.455, lon: 9.18, titolo: "BOX IN MILANO", sottotipo_asset: "C6" });
    await eseguiEnrich();
    const esito = (id: number) => (db.prepare("SELECT qre_esito FROM immobili WHERE id = ?").get(id) as { qre_esito: string }).qre_esito;
    assert.equal(esito(usufrutto), "fuori_perimetro");
    assert.equal(esito(box), "fuori_perimetro");
  });

  test("un A/3 si valuta con le abitazioni di tipo economico, non con le civili", async () => {
    // caso reale: Arluno, A/3, valutato con 2.000 EUR/mq invece di 1.450 (18/10/2026)
    const economico = inserisci({ lat: 45.455, lon: 9.18, sottotipo_asset: "A/3" });
    const pvp = inserisci({ lat: 45.455, lon: 9.18, sottotipo_asset: "IMMOBILE_RESIDENZIALE / ABITAZIONE_TIPO_ECO" });
    const ville = inserisci({ lat: 45.455, lon: 9.18, sottotipo_asset: "A/7" });
    await eseguiEnrich();
    const mq = (id: number) => (db.prepare("SELECT qre_valore_mq FROM immobili WHERE id = ?").get(id) as { qre_valore_mq: number }).qre_valore_mq;
    assert.equal(mq(economico), 3300);
    assert.equal(mq(pvp), 3300);
    assert.equal(mq(ville), 5800, "ville e villini non quotate in zona: la tipologia prevalente");
    const tip = (id: number) => (db.prepare("SELECT tipologia_omi FROM immobili WHERE id = ?").get(id) as { tipologia_omi: string }).tipologia_omi;
    assert.equal(tip(economico), "Abitazioni di tipo economico", "la tipologia usata resta sulla riga");
  });

  test("il codice del comune si ricava, la valutazione trova la quotazione, l'uscita usa lo stato ottimo", async () => {
    // come lo scrive il Demanio: solo il nome del comune, coordinate dalla pagina
    const id = inserisci({ lat: 45.455, lon: 9.18 });
    await eseguiEnrich();
    const r = db.prepare("SELECT comune_cod, zona_omi, valore_centrale, qre_valore_fonte, qre_valore_mq FROM immobili WHERE id = ?")
      .get(id) as Record<string, unknown>;
    assert.equal(r.comune_cod, "F205");
    assert.equal(r.zona_omi, "C12");
    assert.ok(r.valore_centrale != null, "senza codice comune la valutazione OMI non trovava mai nulla");
    assert.equal(r.qre_valore_fonte, "omi_ottimo");
    assert.equal(r.qre_valore_mq, 5800);
  });

  test("senza posizione la valutazione usa l'aggregato comunale, il Gate 0 no", async () => {
    const id = inserisci({ lat: null, lon: null, indirizzo_raw: null });
    await eseguiEnrich();
    const r = db.prepare("SELECT comune_cod, livello_zona, valore_centrale, qre_valore_fonte FROM immobili WHERE id = ?")
      .get(id) as Record<string, unknown>;
    assert.equal(r.comune_cod, "F205", "dal nome");
    assert.equal(r.livello_zona, "comune");
    assert.ok(r.valore_centrale != null, "l'aggregato comunale si trova solo col codice");
    assert.equal(r.qre_valore_fonte, null, "il massimo comunale e' il centro citta': non descrive il lotto");
  });
});
