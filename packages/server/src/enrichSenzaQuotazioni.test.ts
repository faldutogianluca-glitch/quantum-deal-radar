import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "qdr-enrich-parziale-"));
process.env.QDR_DATA_DIR = dir;
process.env.QDR_DB_PATH = join(dir, "test.db");

// Perimetri presenti, quotazioni NO: e' il degrado documentato (zone risolte,
// valutazione saltata). Una feature e' deliberatamente non poligonale, per
// esercitare anche il conteggio degli scarti.
writeFileSync(
  join(dir, "zone_omi.geojson"),
  JSON.stringify({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { comune_amm: "F205", zona: "B7" },
        geometry: {
          type: "Polygon",
          coordinates: [[[9.18, 45.46], [9.2, 45.46], [9.2, 45.48], [9.18, 45.48], [9.18, 45.46]]],
        },
      },
      {
        type: "Feature",
        properties: { comune_amm: "F205", zona: "SCARTO" },
        geometry: { type: "LineString", coordinates: [] },
      },
    ],
  }),
);

const { eseguiEnrich } = await import("./enrich.js");
const { db } = await import("./db.js");

describe("enrich senza quotazioni OMI", () => {
  test("risolve le zone ma salta la valutazione, dicendolo", async () => {
    const now = new Date().toISOString();
    const info = db
      .prepare(
        `INSERT INTO immobili (chiave_dedup, fonte, id_esterno, titolo, comune, comune_cod, zona_omi,
                               mq, prezzo, tipo_prezzo, valore_perizia, first_seen_at, scraped_at)
         VALUES ('K1', 'test', 'e1', 'Trilocale', 'Milano', 'F205', 'B7',
                 100, 200000, 'base_asta', 320000, @now, @now)`,
      )
      .run({ now });
    const id = Number(info.lastInsertRowid);

    const esito = await eseguiEnrich();

    assert.equal(esito.eseguito, true);
    assert.equal(esito.zoneCaricate, 1);
    assert.equal(esito.zoneScartate, 1, "la feature non poligonale va contata, non ingoiata");
    assert.equal(esito.immobiliValutati, undefined, "senza quotazioni non si contano valutazioni");
    assert.match(esito.valutazioneSaltata ?? "", /quotazioni_omi\.json/);

    const riga = db.prepare("SELECT * FROM immobili WHERE id = ?").get(id) as {
      zona_omi: string | null; livello_zona: string | null; valore_centrale: number | null;
    };
    assert.equal(riga.livello_zona, "zona", "la parte geografica viene comunque scritta");
    assert.equal(riga.zona_omi, "B7");
    assert.equal(riga.valore_centrale, null, "nessun valore inventato in assenza di quotazioni");
  });
});
