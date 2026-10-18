import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "qdr-omi-"));
process.env.QDR_DATA_DIR = dir;
process.env.QDR_DB_PATH = join(dir, "test.db");

const { quotazioniDaCsv, scriviOmi, zoneDaGeoJson } = await import("./omi.js");

// righe nel formato del CSV del Comune di Milano (semestre 2024/2)
const CSV =
  "Area_territoriale;Regione;Prov;Comune_ISTAT;Comune_cat;Sez;Comune_amm;Comune_descrizione;Fascia;Zona;LinkZona;Cod_Tip;Descr_Tipologia;Stato;Stato_prev;Compr_min;Compr_max;Sup_NL_compr\n" +
  "NORD-OVEST;LOMBARDIA;MI;3015146;C1AA; ;F205;MILANO;B;B12;MI00003228;20;Abitazioni civili;NORMALE;P;8300;10800;L\n" +
  "NORD-OVEST;LOMBARDIA;MI;3015146;C1AA; ;F205;MILANO;B;B12;MI00003228;20;Abitazioni civili;OTTIMO; ;10900;14700;L\n" +
  "NORD-OVEST;LOMBARDIA;MI;3015146;C1AA; ;F205;MILANO;B;B15;MI00003544;20;Abitazioni civili;OTTIMO; ;10500;14000;L\n" +
  "NORD-OVEST;LOMBARDIA;MI;3015146;C1AA; ;F205;MILANO;B;B15;MI00003544;20;Box;NORMALE;P;;;L\n";

describe("OMI dal portale open data del Comune di Milano", () => {
  test("normale e ottimo affiancati; dove c'e' solo ottimo vale anche per la valutazione", () => {
    const q = quotazioniDaCsv(CSV, "2024-2");
    assert.equal(q.length, 2, "la riga senza valori si scarta");
    const b12 = q.find((x) => x.zona === "B12")!;
    assert.deepEqual(
      { min: b12.vendMin, max: b12.vendMax, minO: b12.vendMinOttimo, maxO: b12.vendMaxOttimo, comune: b12.comune },
      { min: 8300, max: 10800, minO: 10900, maxO: 14700, comune: "MILANO" },
    );
    const b15 = q.find((x) => x.zona === "B15")!;
    assert.equal(b15.vendMin, 10500, "stato prevalente ottimo: e' il valore tipico della zona");
    assert.equal(b15.vendMinOttimo, 10500);
  });

  test("i perimetri prendono il codice del comune e perdono la quota inutile", () => {
    const fc = zoneDaGeoJson({
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        properties: { Zona: "B12", Zona_Descr: "CENTRO STORICO" },
        geometry: { type: "Polygon", coordinates: [[[9.18, 45.46, 0], [9.19, 45.46, 0], [9.19, 45.47, 0], [9.18, 45.46, 0]]] },
      }],
    }, "F205");
    assert.deepEqual(fc.features[0]!.properties, { comune_amm: "F205", zona: "B12", descrizione: "CENTRO STORICO" });
    assert.deepEqual((fc.features[0]!.geometry.coordinates as number[][][])[0]![0], [9.18, 45.46]);
  });

  test("reimportare Milano non cancella gli altri comuni gia' nei file", async () => {
    writeFileSync(join(dir, "quotazioni_omi.json"), JSON.stringify([
      { comuneCod: "A794", zona: "B1", tipologia: "Abitazioni civili", vendMin: 2000, vendMax: 2600, semestre: "2025-1" },
      { comuneCod: "F205", zona: "VECCHIA", tipologia: "Abitazioni civili", vendMin: 1, vendMax: 2, semestre: "2020-1" },
    ]));
    const zonaB12 = zoneDaGeoJson({ type: "FeatureCollection", features: [{
      type: "Feature", properties: { Zona: "B12" },
      geometry: { type: "Polygon", coordinates: [[[9.18, 45.46], [9.19, 45.46], [9.19, 45.47], [9.18, 45.46]]] },
    }] }, "F205");
    const esito = await scriviOmi(quotazioniDaCsv(CSV, "2024-2"), zonaB12, "2024-2", dir);
    const dopo = JSON.parse(readFileSync(join(dir, "quotazioni_omi.json"), "utf-8")) as { comuneCod: string; zona: string }[];
    assert.ok(dopo.some((q) => q.comuneCod === "A794"), "Bergamo resta");
    assert.ok(!dopo.some((q) => q.zona === "VECCHIA"), "il Milano vecchio se ne va");
    assert.equal(esito.conservate.quotazioni, 1);
  });

  test("un'importazione letta male non cancella i dati buoni", async () => {
    const prima = readFileSync(join(dir, "quotazioni_omi.json"), "utf-8");
    await assert.rejects(
      () => scriviOmi([], { type: "FeatureCollection", features: [] }, "2025-1", dir),
      /importazione OMI vuota/,
    );
    assert.equal(readFileSync(join(dir, "quotazioni_omi.json"), "utf-8"), prima);
  });

  test("una riga di titolo sopra l'intestazione (formato dell'Agenzia) non azzera il file", () => {
    const q = quotazioniDaCsv("Quotazioni OMI - semestre 2024/2\n" + CSV, "2024-2");
    assert.equal(q.length, 2);
  });
});
