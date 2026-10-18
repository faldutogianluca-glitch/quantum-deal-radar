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

  test("senza posizione resta la quotazione comunale, ma non lo stato ottimo di una zona", async () => {
    const id = inserisci({ lat: null, lon: null, indirizzo_raw: null });
    await eseguiEnrich();
    const r = db.prepare("SELECT comune_cod, livello_zona, valore_centrale, qre_valore_fonte FROM immobili WHERE id = ?")
      .get(id) as Record<string, unknown>;
    assert.equal(r.comune_cod, "F205", "dal nome");
    assert.equal(r.livello_zona, "comune");
    assert.ok(r.valore_centrale != null, "l'aggregato comunale si trova solo col codice");
    assert.equal(r.qre_valore_fonte, "omi_max");
  });
});
