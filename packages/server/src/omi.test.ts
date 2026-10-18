import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
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

  test("l'open data del Comune non riporta Milano a un semestre piu' vecchio di quello in archivio, salvo --forza", async () => {
    const prima = readFileSync(join(dir, "quotazioni_omi.json"), "utf-8");
    const zonaB12 = zoneDaGeoJson({ type: "FeatureCollection", features: [{
      type: "Feature", properties: { Zona: "B12" },
      geometry: { type: "Polygon", coordinates: [[[9.18, 45.46], [9.19, 45.46], [9.19, 45.47], [9.18, 45.46]]] },
    }] }, "F205");
    // in archivio c'e' il 2024-2 (test precedente): il 2023-2 si rifiuta
    await assert.rejects(scriviOmi(quotazioniDaCsv(CSV, "2023-2"), zonaB12, "2023-2", dir), /semestre piu' recente/);
    assert.equal(readFileSync(join(dir, "quotazioni_omi.json"), "utf-8"), prima);
    await scriviOmi(quotazioniDaCsv(CSV, "2023-2"), zonaB12, "2023-2", dir, { forza: true });
    await scriviOmi(quotazioniDaCsv(CSV, "2024-2"), zonaB12, "2024-2", dir);
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

  test("un semestre piu' vecchio non sovrascrive quello in archivio, salvo --forza", async () => {
    const cartella = mkdtempSync(join(tmpdir(), "qdr-forniture-"));
    const csv = join(cartella, "QI_20261_VALORI.csv");
    writeFileSync(csv, CSV_AGENZIA);
    await importaForniture([ZIP_ROZZANO, csv], cartella);
    const vecchio = join(cartella, "vecchio");
    mkdirSync(vecchio);
    const kmlVecchio = leggiZip(readFileSync(ZIP_ROZZANO))[0]!.dati.toString("utf8").replace("Anno/Semestre 2026/1", "Anno/Semestre 2023/1");
    writeFileSync(join(vecchio, "rozzano.kml"), kmlVecchio);
    writeFileSync(join(vecchio, "QI_20231_VALORI.csv"), CSV_AGENZIA.replace("Anno 2026 - Semestre 1", "Anno 2023 - Semestre 1").replace("1.900", "1.500"));
    await assert.rejects(importaForniture([vecchio], cartella), /piu' recente di 2023-1/);
    const leggi = () => (JSON.parse(readFileSync(join(cartella, "quotazioni_omi.json"), "utf-8")) as { comuneCod: string; vendMin: number }[]).find((x) => x.comuneCod === "H623")!;
    assert.equal(leggi().vendMin, 1900, "il 2026-1 resta");
    await importaForniture([vecchio], cartella, { forza: true });
    assert.equal(leggi().vendMin, 1500);
  });

  test("meno zone di quelle in archivio: rifiutato (i 43 perimetri di Milano non diventano 1)", async () => {
    const cartella = mkdtempSync(join(tmpdir(), "qdr-forniture-"));
    const kml = leggiZip(readFileSync(ZIP_ROZZANO))[0]!.dati.toString("utf8");
    const unaZona = kml.replace(/<Placemark>[\s\S]*?<\/Placemark>/g, (pm) => (pm.includes(">B1<") ? pm : ""));
    writeFileSync(join(cartella, "z.kml"), unaZona);
    const csv = join(cartella, "QI_20261_VALORI.csv");
    writeFileSync(csv, CSV_AGENZIA);
    await importaForniture([ZIP_ROZZANO, csv], cartella);
    const solo = join(cartella, "solo");
    mkdirSync(solo);
    writeFileSync(join(solo, "z.kml"), unaZona);
    writeFileSync(join(solo, "QI_20261_VALORI.csv"), CSV_AGENZIA);
    await assert.rejects(importaForniture([solo], cartella), /1 zone contro le 4/);
  });

  test("semestre dal nome dei file dell'Agenzia, non dalla cartella; sconosciuto = errore", async () => {
    const cartella = mkdtempSync(join(tmpdir(), "qdr-forniture-"));
    const dir = join(cartella, "2026-1");
    mkdirSync(dir);
    const senzaTitolo = CSV_AGENZIA.split("\n").slice(1).join("\n");
    writeFileSync(join(dir, "QI_1093784_1_20261_VALORI.csv"), senzaTitolo);
    const r = await importaForniture([ZIP_ROZZANO, join(dir, "QI_1093784_1_20261_VALORI.csv")], cartella);
    assert.equal(r.semestre, "2026-1");
    writeFileSync(join(dir, "valori.csv"), senzaTitolo);
    await assert.rejects(importaForniture([ZIP_ROZZANO, join(dir, "valori.csv")], mkdtempSync(join(tmpdir(), "qdr-f-"))), /semestre non riconoscibile/);
  });

  test("titolo vero delle forniture 2026: 'Semestre 2026/1' senza 'Anno'; il file ZONE (descrizioni) si ignora", async () => {
    const cartella = mkdtempSync(join(tmpdir(), "qdr-forniture-"));
    const valori = CSV_AGENZIA.replace("Quotazioni Immobiliari - Anno 2026 - Semestre 1;", "Quotazioni Immobiliari : Valori di Mercato - Semestre 2026/1 - elaborazione del 18-OTT-26");
    writeFileSync(join(cartella, "valori.csv"), valori);
    writeFileSync(join(cartella, "zone.csv"),
      "Quotazioni Immobiliari : Informazioni di Zona OMI - Semestre 2026/1 - elaborazione del 18-OTT-26\n" +
      "Area_territoriale;Regione;Prov;Comune_ISTAT;Comune_cat;Sez;Comune_amm;Comune_descrizione;Fascia;Zona_Descr;Zona;LinkZona;Cod_tip_prev;Descr_tip_prev;Stato_prev;Microzona;\n" +
      "NORD-OVEST;LOMBARDIA;MI;15189;H623;;H623;ROZZANO;D;'PERIFERIA';D1;MI00004557;20;Abitazioni civili;N;0;\n");
    const r = await importaForniture([ZIP_ROZZANO, join(cartella, "valori.csv"), join(cartella, "zone.csv")], cartella);
    assert.equal(r.semestre, "2026-1");
    assert.equal(r.file.length, 2, "il KML e i valori; le descrizioni di zona non sono quotazioni");
  });

  test("Windows-1252: l'apostrofo tipografico resta un apostrofo", async () => {
    const cartella = mkdtempSync(join(tmpdir(), "qdr-forniture-"));
    const csv = CSV_AGENZIA.replace(/ROZZANO;D;D1/g, "CASSANO D\u2019ADDA;D;D1");
    const byte = Buffer.from(csv.replaceAll("\u2019", "\u0000"), "latin1");
    for (let i = byte.indexOf(0); i >= 0; i = byte.indexOf(0, i + 1)) byte[i] = 0x92;
    writeFileSync(join(cartella, "QI_20261_VALORI.csv"), byte);
    await importaForniture([ZIP_ROZZANO, join(cartella, "QI_20261_VALORI.csv")], cartella);
    const q = JSON.parse(readFileSync(join(cartella, "quotazioni_omi.json"), "utf-8")) as { comune?: string }[];
    assert.ok(q.some((x) => x.comune === "CASSANO D\u2019ADDA"));
    assert.equal(nomeComune("CASSANO D\u2019ADDA"), nomeComune("Cassano d'Adda"));
  });

  test("KML: CDATA, <value/>, SimpleData, coordinate con spazi, esterno non valido", () => {
    const pm = (dati: string, geom: string) => `<Placemark>${dati}<MultiGeometry>${geom}</MultiGeometry></Placemark>`;
    const quadrato = "<Polygon><outerBoundaryIs><LinearRing><coordinates>9.0, 45.0 9.1, 45.0 9.1, 45.1 9.0, 45.0</coordinates></LinearRing></outerBoundaryIs></Polygon>";
    const fc = zoneDaKml(
      "<kml>" +
        pm('<ExtendedData><Data name="CODCOM"><value><![CDATA[H623]]></value></Data><Data name="CODZONA"><value>D1</value></Data></ExtendedData>', quadrato) +
        pm('<ExtendedData><Data name="CODCOM"><value/></Data><Data name="CODZONA"><value>D2</value></Data></ExtendedData>', quadrato) +
        pm('<ExtendedData><SchemaData><SimpleData name="CODCOM">H623</SimpleData><SimpleData name="CODZONA">E1</SimpleData></SchemaData></ExtendedData>', quadrato) +
        pm('<ExtendedData><Data name="CODCOM"><value>H623</value></Data><Data name="CODZONA"><value>E2</value></Data></ExtendedData>',
          "<Polygon><outerBoundaryIs><LinearRing><coordinates>9,45 9.1,45</coordinates></LinearRing></outerBoundaryIs><innerBoundaryIs><LinearRing><coordinates>9.0,45.0 9.1,45.0 9.1,45.1 9.0,45.0</coordinates></LinearRing></innerBoundaryIs></Polygon>") +
        "</kml>",
    );
    assert.deepEqual(fc.features.map((f) => `${f.properties.comune_amm}|${f.properties.zona}`), ["H623|D1", "H623|E1"]);
    assert.deepEqual((fc.features[0]!.geometry.coordinates as number[][][])[0]![1], [9.1, 45.0], "nessun punto (9,0) dagli spazi");
  });

  test("zip e KML estratto nella stessa cartella: zone non raddoppiate; KML estraneo ignorato", async () => {
    const cartella = mkdtempSync(join(tmpdir(), "qdr-forniture-"));
    const dir = join(cartella, "scaricati");
    mkdirSync(dir);
    writeFileSync(join(dir, "rozzano.zip"), readFileSync(ZIP_ROZZANO));
    writeFileSync(join(dir, "rozzano 2026-1.kml"), leggiZip(readFileSync(ZIP_ROZZANO))[0]!.dati);
    writeFileSync(join(dir, "percorso bici 2019-2.kml"), "<kml><Placemark><name>giro</name></Placemark></kml>");
    writeFileSync(join(dir, "QI_20261_VALORI.csv"), CSV_AGENZIA);
    const r = await importaForniture([dir], cartella);
    assert.equal(r.zone, 4);
  });

  test("quotazioni sotto i 100 EUR/mq scartate, con avviso", async () => {
    const cartella = mkdtempSync(join(tmpdir(), "qdr-forniture-"));
    writeFileSync(join(cartella, "QI_20261_VALORI.csv"), CSV_AGENZIA + "NORD-OVEST;LOMBARDIA;MI;15189;H623;;H623;ROZZANO;R;R1;X;20;Abitazioni civili;NORMALE;P;1,300;1,500;L;;;L;\n");
    const r = await importaForniture([ZIP_ROZZANO, join(cartella, "QI_20261_VALORI.csv")], cartella);
    assert.match(r.avvisi.join(" "), /sotto 100 EUR\/mq/);
  });

  test("zip64 o troncato: messaggio chiaro", () => {
    const z = Buffer.from(readFileSync(ZIP_ROZZANO));
    const fine = z.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    const z64 = Buffer.from(z);
    z64.writeUInt32LE(0xffffffff, fine + 16);
    assert.throws(() => leggiZip(z64), /zip64 non supportato/);
    assert.throws(() => leggiZip(z.subarray(0, 200)), /archivio zip non valido/);
  });

  test("nomi di comune confrontabili fra PVP e Agenzia", () => {
    assert.equal(nomeComune("Cassano d’Adda"), nomeComune("CASSANO D'ADDA"));
    assert.equal(nomeComune("Cantù"), nomeComune("CANTU'"));
    assert.equal(nomeComune("  Pozzo d'Adda "), "POZZO D'ADDA");
    assert.equal(nomeComune("Trezzano sul Naviglio"), "TREZZANO SUL NAVIGLIO");
  });
});

const { scaricaPerimetri } = await import("./omi.js");

describe("perimetri dal visualizzatore pubblico GEOPOI", () => {
  const ZIP = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "omi_rozzano_2026-1.zip");

  const finto = (perimetri: () => Response) => {
    const chiamate: string[] = [];
    const originale = globalThis.fetch;
    globalThis.fetch = (async (input: string | URL) => {
      const url = String(input);
      chiamate.push(url);
      if (url.endsWith("/robots.txt")) return new Response("", { status: 404 });
      if (url.includes("richiesta=5")) return new Response(JSON.stringify([{ SEMESTRE: "20261" }, { SEMESTRE: "20252" }]));
      if (url.includes("perimetri.php")) return perimetri();
      return new Response("", { status: 404 });
    }) as typeof fetch;
    return { chiamate, ripristina: () => (globalThis.fetch = originale) };
  };

  test("ultimo semestre, un file per provincia, salvato fra le forniture dopo averne letto le zone", async () => {
    const cartella = mkdtempSync(join(tmpdir(), "qdr-perimetri-"));
    const f = finto(() => new Response(readFileSync(ZIP)));
    try {
      const r = await scaricaPerimetri(["MI"], undefined, cartella);
      assert.equal(r.semestre, "2026-1");
      assert.equal(r.zone, 4);
      assert.match(r.file[0]!, /import\/omi\/2026-1\/perimetri_MI_2026-1\.zip$/);
      assert.equal(f.chiamate.filter((u) => u.includes("perimetri.php")).length, 1);
      assert.match(f.chiamate.find((u) => u.includes("perimetri.php"))!, /prov=MI&codcom=&semestre=20261&formato=kml/);
    } finally {
      f.ripristina();
    }
  });

  test("provincia ripetuta: un solo download, zone contate una volta", async () => {
    const cartella = mkdtempSync(join(tmpdir(), "qdr-perimetri-"));
    const f = finto(() => new Response(readFileSync(ZIP)));
    try {
      const r = await scaricaPerimetri(["MI", "mi"], undefined, cartella);
      assert.equal(f.chiamate.filter((u) => u.includes("perimetri.php")).length, 1);
      assert.equal(r.zone, 4);
      assert.equal(r.file.length, 1);
    } finally {
      f.ripristina();
    }
  });

  test("sigla o semestre sbagliati: errore prima di qualunque richiesta, nessuna cartella creata", async () => {
    const cartella = mkdtempSync(join(tmpdir(), "qdr-perimetri-"));
    const f = finto(() => new Response(readFileSync(ZIP)));
    try {
      await assert.rejects(scaricaPerimetri(["MI", "Monza"], undefined, cartella), /serve la sigla/);
      await assert.rejects(scaricaPerimetri(["MI"], "ultimo", cartella), /serve anno e semestre/);
      assert.equal(f.chiamate.length, 0);
      assert.equal(existsSync(join(cartella, "import")), false);
    } finally {
      f.ripristina();
    }
  });

  test("senza semestre il piu' recente, anche se l'elenco non e' in ordine decrescente", async () => {
    const cartella = mkdtempSync(join(tmpdir(), "qdr-perimetri-"));
    const originale = globalThis.fetch;
    globalThis.fetch = (async (input: string | URL) => {
      const url = String(input);
      if (url.endsWith("/robots.txt")) return new Response("", { status: 404 });
      if (url.includes("richiesta=5")) return new Response(JSON.stringify([{ SEMESTRE: "20061" }, { SEMESTRE: "20252" }, { SEMESTRE: "20261" }]));
      if (url.includes("perimetri.php")) return new Response(readFileSync(ZIP));
      return new Response("", { status: 404 });
    }) as typeof fetch;
    try {
      assert.equal((await scaricaPerimetri(["MI"], undefined, cartella)).semestre, "2026-1");
    } finally {
      globalThis.fetch = originale;
    }
  });

  test("semestre non pubblicato o risposta che non e' uno zip: errore, niente salvato", async () => {
    const cartella = mkdtempSync(join(tmpdir(), "qdr-perimetri-"));
    const f = finto(() => new Response("<html>errore</html>"));
    try {
      await assert.rejects(scaricaPerimetri(["MI"], "2019-1", cartella), /non disponibile/);
      await assert.rejects(scaricaPerimetri(["MI"], "2026-1", cartella), /non ha restituito uno zip/);
    } finally {
      f.ripristina();
    }
  });
});
