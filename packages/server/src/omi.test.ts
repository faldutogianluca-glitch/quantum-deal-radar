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

const { zoneDaKml, importaForniture } = await import("./omi.js");
const { leggiZip } = await import("./zip.js");
const { nomeComune } = await import("./enrich.js");
const { dirname } = await import("node:path");
const { fileURLToPath } = await import("node:url");

describe("forniture OMI dell'Agenzia delle Entrate", () => {
  // perimetri veri di Rozzano, primo semestre 2026, scaricati dal visualizzatore GEOPOI dell'Agenzia
  const ZIP_ROZZANO = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "omi_rozzano_2026-1.zip");

  const CSV_AGENZIA =
    "Quotazioni Immobiliari - Anno 2026 - Semestre 1;\n" +
    "Area_territoriale;Regione;Prov;Comune_ISTAT;Comune_cat;Sez;Comune_amm;Comune_descrizione;Fascia;Zona;LinkZona;Cod_Tip;Descr_Tipologia;Stato;Stato_prev;Compr_min;Compr_max;Sup_NL_compr;Loc_min;Loc_max;Sup_NL_loc;\n" +
    "NORD-OVEST;LOMBARDIA;MI;15189;H623;;H623;ROZZANO;D;D1;MI00004557;20;Abitazioni civili;NORMALE;P;1.900;2.400;L;7,5;9;L;\n" +
    "NORD-OVEST;LOMBARDIA;MI;15189;H623;;H623;ROZZANO;D;D1;MI00004557;20;Abitazioni civili;OTTIMO;;2500;2950;L;9;11;L;\n" +
    "NORD-OVEST;LOMBARDIA;MI;15146;F205;;F205;MILANO;B;B12;MI00003228;20;Abitazioni civili;NORMALE;P;8300;10800;L;;;L;\n";

  test("zip dell'Agenzia letto senza dipendenze", () => {
    const voci = leggiZip(readFileSync(ZIP_ROZZANO));
    assert.equal(voci.length, 1);
    assert.match(voci[0]!.nome, /ROZZANO 2026-1\.kml$/);
    assert.match(voci[0]!.dati.toString("utf8"), /^<\?xml/);
  });

  test("KML vero: quattro zone con codice catastale, poligoni chiusi in WGS84, buchi conservati", () => {
    const kml = leggiZip(readFileSync(ZIP_ROZZANO))[0]!.dati.toString("utf8");
    const fc = zoneDaKml(kml);
    assert.deepEqual(fc.features.map((f) => f.properties.zona).sort(), ["B1", "D1", "R1", "R2"]);
    assert.ok(fc.features.every((f) => f.properties.comune_amm === "H623"));
    const d1 = fc.features.find((f) => f.properties.zona === "D1")!;
    const anelli = d1.geometry.coordinates as number[][][];
    assert.equal(anelli.length, 2, "D1 ha un buco");
    const [lon, lat] = anelli[0]![0]!;
    assert.ok(lon! > 9 && lon! < 9.3 && lat! > 45.3 && lat! < 45.5, "coordinate di Rozzano in WGS84");
    assert.equal(fc.features.find((f) => f.properties.zona === "R1")!.geometry.type, "MultiPolygon");
  });

  test("importa zip dei perimetri e CSV delle quotazioni; solo i comuni con entrambi, gli altri restano", async () => {
    const cartella = mkdtempSync(join(tmpdir(), "qdr-forniture-"));
    const csv = join(cartella, "QI_20261_VALORI.csv");
    writeFileSync(csv, CSV_AGENZIA);
    writeFileSync(join(cartella, "quotazioni_omi.json"), JSON.stringify([{ comuneCod: "F704", zona: "C1", tipologia: "Abitazioni civili", vendMin: 1, vendMax: 2, semestre: "2024-2" }]));
    const r = await importaForniture([ZIP_ROZZANO, csv], cartella);
    assert.equal(r.semestre, "2026-1");
    assert.equal(r.comuni, 1, "Milano ha quotazioni ma non perimetri in questi file: non si tocca");
    const q = JSON.parse(readFileSync(join(cartella, "quotazioni_omi.json"), "utf-8")) as { comuneCod: string; vendMin: number; vendMinOttimo?: number }[];
    assert.ok(q.some((x) => x.comuneCod === "F704"), "il comune gia' presente resta");
    const d1 = q.find((x) => x.comuneCod === "H623")!;
    assert.equal(d1.vendMin, 1900, "punto delle migliaia");
    assert.equal(d1.vendMinOttimo, 2500);
    const z = JSON.parse(readFileSync(join(cartella, "zone_omi.geojson"), "utf-8")) as { features: unknown[] };
    assert.equal(z.features.length, 4);
  });

  test("file di semestri diversi: errore, niente fusione", async () => {
    const cartella = mkdtempSync(join(tmpdir(), "qdr-forniture-"));
    const csv = join(cartella, "QI_20252_VALORI.csv");
    writeFileSync(csv, CSV_AGENZIA.replace("Anno 2026 - Semestre 1", "Anno 2025 - Semestre 2"));
    await assert.rejects(importaForniture([ZIP_ROZZANO, csv], cartella), /semestri diversi/);
  });

  test("solo perimetri senza quotazioni: errore chiaro, file esistenti intatti", async () => {
    const cartella = mkdtempSync(join(tmpdir(), "qdr-forniture-"));
    await assert.rejects(importaForniture([ZIP_ROZZANO], cartella), /quotazioni e perimetri insieme/);
  });

  test("nomi di comune confrontabili fra PVP e Agenzia", () => {
    assert.equal(nomeComune("Cassano d’Adda"), nomeComune("CASSANO D'ADDA"));
    assert.equal(nomeComune("Cantù"), nomeComune("CANTU'"));
    assert.equal(nomeComune("  Pozzo d'Adda "), "POZZO D'ADDA");
    assert.equal(nomeComune("Trezzano sul Naviglio"), "TREZZANO SUL NAVIGLIO");
  });
});
