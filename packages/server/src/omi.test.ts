import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// omi.ts crea DATA_DIR al caricamento: meglio una cartella usa e getta.
process.env.QDR_DATA_DIR = mkdtempSync(join(tmpdir(), "qdr-omi-"));

const { daGeoJson } = await import("@qdr/core");
const {
  analizzaCsvQuotazioni,
  analizzaStampaOmi,
  chiaveComune,
  costruisciComuni,
  kmlInGeoJson,
  leggiZip,
  risolviComune,
  tipologiaDaSottotipo,
  unisciQuotazioni,
} = await import("./omi.js");

describe("quotazioni dal CSV dell'Agenzia", () => {
  const csv = [
    "Quotazioni Immobiliari : Valori - Semestre 2024/2 - elaborazione del 21-NOV-24",
    "Area_territoriale;Regione;Prov;Comune_ISTAT;Comune_cat;Sez;Comune_amm;Comune_descrizione;Fascia;Zona;LinkZona;Cod_Tip;Descr_Tipologia;Stato;Stato_prev;Compr_min;Compr_max;Sup_NL_compr;Loc_min;Loc_max;Sup_NL_loc;",
    "NORD-OVEST;LOMBARDIA;MI;3015146;C1AA; ;F205;MILANO;B;B12;MI00003228;20;Abitazioni civili;NORMALE;P;8800;12600;L;26,5;38;L;",
    "NORD-OVEST;LOMBARDIA;MI;3015146;C1AA; ;F205;MILANO;B;B12;MI00003228;20;Abitazioni civili;SCADENTE; ;7000;9500;L;20;27,5;L;",
    "NORD-OVEST;LOMBARDIA;MI;3015146;C1AA; ;F205;MILANO;E;E8;MI00004787;8;Capannoni industriali;NORMALE;P;;;L;;;L;",
    "",
  ].join("\n");

  test("legge il semestre dal titolo e i decimali con la virgola", () => {
    const r = analizzaCsvQuotazioni(csv);
    assert.equal(r.length, 2, "la riga senza valori di compravendita non entra");
    assert.deepEqual(r[0], {
      comuneCod: "F205", zona: "B12", tipologia: "Abitazioni civili", vendMin: 8800, vendMax: 12600, semestre: "2024-2", stato: "NORMALE",
    });
  });

  test("il riepilogo open data porta Anno e Periodo per riga, e l'ultimo semestre vince", () => {
    const riepilogo =
      "Anno;Periodo;Comune_amm;Zona;Descr_Tipologia;Stato;Compr_min;Compr_max\n" +
      "2004;2 semestre;F205;B01;Abitazioni civili;NORMALE;3850;5450\n" +
      "2024;2 semestre;F205;B01;Abitazioni civili;NORMALE;9000;12000\n" +
      "2024;2 semestre;F205;B01;Abitazioni civili;SCADENTE;7000;9000\n";
    const unite = unisciQuotazioni(analizzaCsvQuotazioni(riepilogo));
    assert.equal(unite.length, 1);
    assert.equal(unite[0]!.semestre, "2024-2");
    assert.equal(unite[0]!.stato, "NORMALE");
    assert.equal(unite[0]!.vendMin, 9000);
  });

  test("senza semestre il record non entra", () => {
    const senza = "Comune_amm;Zona;Descr_Tipologia;Compr_min;Compr_max\nF205;B01;Abitazioni civili;100;200\n";
    assert.deepEqual(analizzaCsvQuotazioni(senza), []);
    assert.equal(analizzaCsvQuotazioni(senza, "QI_123_1_20251_VALORI.csv")[0]?.semestre, "2025-1");
  });
});

describe("perimetri dal KML di GEOPOI", () => {
  const kml = `<?xml version="1.0"?><kml><Document>
<Placemark><name>CRESPINA LORENZANA - Zona OMI E1</name>
<ExtendedData><Data name="CODCOM"><displayName>Codice Comune</displayName><value>M328</value></Data>
<Data name="CODZONA"><displayName>Codice Zona</displayName><value>E1</value></Data></ExtendedData>
<Polygon><outerBoundaryIs><LinearRing><coordinates>
10.50,43.60,0 10.60,43.60,0 10.60,43.70,0 10.50,43.70,0 10.50,43.60,0
</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>
<Placemark><name>Due pezzi</name>
<ExtendedData><Data name="CODCOM"><value>M328</value></Data><Data name="CODZONA"><value>R1</value></Data></ExtendedData>
<MultiGeometry>
<Polygon><outerBoundaryIs><LinearRing><coordinates>10.7,43.6,0 10.8,43.6,0 10.8,43.7,0 10.7,43.6,0</coordinates></LinearRing></outerBoundaryIs>
<innerBoundaryIs><LinearRing><coordinates>10.72,43.62,0 10.74,43.62,0 10.74,43.64,0 10.72,43.62,0</coordinates></LinearRing></innerBoundaryIs></Polygon>
<Polygon><outerBoundaryIs><LinearRing><coordinates>10.9,43.6,0 11.0,43.6,0 11.0,43.7,0 10.9,43.6,0</coordinates></LinearRing></outerBoundaryIs></Polygon>
</MultiGeometry></Placemark>
<Placemark><name>senza codici</name><Polygon><outerBoundaryIs><LinearRing><coordinates>1,1,0 2,1,0 2,2,0 1,1,0</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>
</Document></kml>`;

  test("produce feature che daGeoJson() di core accetta, scartando la quota", () => {
    const fc = kmlInGeoJson(kml);
    assert.equal(fc.features.length, 2, "il placemark senza codici resta fuori");
    assert.deepEqual(fc.features[0]!.properties, { comune_cod: "M328", zona: "E1", descrizione: "CRESPINA LORENZANA - Zona OMI E1" });
    assert.equal(fc.features[0]!.geometry!.type, "Polygon");
    assert.deepEqual((fc.features[0]!.geometry!.coordinates as number[][][])[0]![0], [10.5, 43.6]);
    assert.equal(fc.features[1]!.geometry!.type, "MultiPolygon");

    const { zone, scartate } = daGeoJson(fc);
    assert.equal(scartate, 0);
    assert.equal(zone.length, 2);
    assert.equal(zone[1]!.geom[0]!.length, 2, "l'anello interno resta attaccato al suo poligono");
  });
});

describe("perimetri da un GeoJSON qualunque", () => {
  test("le proprieta' vengono riportate ai nomi attesi, il comune dal file se manca", async () => {
    const { normalizzaFeature } = await import("./omi.js");
    const f = normalizzaFeature(
      [
        { type: "Feature", properties: { Name: "MILANO - Zona OMI B12", Zona: "B12", Zona_Descr: "CENTRO STORICO" }, geometry: { type: "Polygon", coordinates: [[[9.18, 45.46], [9.2, 45.46], [9.2, 45.48], [9.18, 45.46]]] } },
        { type: "Feature", properties: { Name: "senza zona" }, geometry: { type: "Polygon", coordinates: [] } },
      ],
      "F205",
    );
    assert.equal(f.length, 1);
    assert.deepEqual(f[0]!.properties, { comune_cod: "F205", zona: "B12", descrizione: "CENTRO STORICO" });
    assert.equal(daGeoJson({ type: "FeatureCollection", features: f }).zone.length, 1);
  });
});

describe("archivio zip senza dipendenze", () => {
  test("legge una voce 'stored' dalla directory centrale", () => {
    const nome = Buffer.from("a.kml");
    const dati = Buffer.from("<kml/>");
    const locale = Buffer.alloc(30);
    locale.writeUInt32LE(0x04034b50, 0);
    locale.writeUInt16LE(0, 8); // stored
    locale.writeUInt32LE(dati.length, 18);
    locale.writeUInt32LE(dati.length, 22);
    locale.writeUInt16LE(nome.length, 26);
    const centrale = Buffer.alloc(46);
    centrale.writeUInt32LE(0x02014b50, 0);
    centrale.writeUInt16LE(0, 10);
    centrale.writeUInt32LE(dati.length, 20);
    centrale.writeUInt32LE(dati.length, 24);
    centrale.writeUInt16LE(nome.length, 28);
    centrale.writeUInt32LE(0, 42);
    const fine = Buffer.alloc(22);
    fine.writeUInt32LE(0x06054b50, 0);
    fine.writeUInt16LE(1, 10);
    fine.writeUInt32LE(centrale.length + nome.length, 12);
    fine.writeUInt32LE(locale.length + nome.length + dati.length, 16);
    const zip = Buffer.concat([locale, nome, dati, centrale, nome, fine]);

    const voci = leggiZip(zip);
    assert.equal(voci.length, 1);
    assert.equal(voci[0]!.nome, "a.kml");
    assert.equal(voci[0]!.dati.toString(), "<kml/>");
  });

  test("un file qualunque non viene scambiato per uno zip", () => {
    assert.throws(() => leggiZip(Buffer.from("ciao")), /non e' un archivio zip/);
  });
});

describe("tabella delle quotazioni di GEOPOI", () => {
  test("una riga per tipologia, forbice di compravendita, locazioni ignorate", () => {
    const html =
      `<table><tr><th rowspan="2">Tipologia</th><th>Stato</th></tr><tr><th>Min</th><th>Max</th></tr>` +
      `<tr><td id='sin'>Abitazioni civili&nbsp;</td><td id='sin'>NORMALE&nbsp;</td><td id='dx' style='text-align: right'>1100&nbsp;</td><td>1300&nbsp;</td><td>L&nbsp;</td><td>3,9&nbsp;</td><td>5,4&nbsp;</td><td>L&nbsp;</td></tr>` +
      `<tr><td id='sin'>Box&nbsp;</td><td id='sin'>NORMALE&nbsp;</td><td>475&nbsp;</td><td>620&nbsp;</td><td>L&nbsp;</td><td>2,1&nbsp;</td><td>2,4&nbsp;</td><td>L&nbsp;</td></tr>` +
      `<tr><td colspan="4"><a href="#">Stampa</a></td><td colspan="4">Legenda</td></tr></table>`;
    assert.deepEqual(analizzaStampaOmi(html), [
      { tipologia: "Abitazioni civili", stato: "NORMALE", vendMin: 1100, vendMax: 1300 },
      { tipologia: "Box", stato: "NORMALE", vendMin: 475, vendMax: 620 },
    ]);
  });
});

describe("anagrafica dei comuni", () => {
  const csv =
    'Codice Regione;"Codice dell\'Unità territoriale sovracomunale \n(valida a fini statistici)";Codice Provincia (Storico)(1);Progressivo del Comune (2);Codice Comune formato alfanumerico;Denominazione (Italiana e straniera);Denominazione in italiano;Denominazione altra lingua;Codice Ripartizione Geografica;Ripartizione geografica;Denominazione Regione;Denominazione UTS;Tipologia UTS;Flag capoluogo;Sigla automobilistica;Codice Comune formato numerico;c110;c107;c103;Codice Catastale del comune;NUTS1;NUTS2;NUTS3\n' +
    "03;015;015;146;015146;Milano;Milano;;1;Nord-ovest;Lombardia;Milano;Città metropolitana;1;MI;15146;15146;15146;15146;F205;ITC;ITC4;ITC4C\n" +
    "09;050;050;041;050041;Crespina Lorenzana;Crespina Lorenzana;;3;Centro;Toscana;Pisa;Provincia;0;PI;50041;50041;;;M328;ITI;ITI1;ITI17\n" +
    "04;021;021;008;021008;Bolzano/Bozen;Bolzano;Bozen;2;Nord-est;Trentino-Alto Adige;Bolzano;Provincia autonoma;1;BZ;21008;21008;21008;21008;A952;ITH;ITH1;ITH10\n";

  test("risolve nomi con accenti, maiuscole e sigla di provincia in coda", () => {
    const comuni = new Map(Object.entries(costruisciComuni(csv)));
    assert.deepEqual(risolviComune("Milano (MI)", comuni), { cod: "F205", prov: "MI", nome: "Milano" });
    assert.equal(risolviComune("CRESPINA  LORENZANA", comuni)?.cod, "M328");
    assert.equal(risolviComune("Bozen", comuni)?.cod, "A952", "anche il nome nell'altra lingua");
    assert.equal(risolviComune("Atlantide", comuni), null);
    assert.equal(risolviComune("Crespina di Lorenzana", comuni)?.cod, "M328", "le preposizioni non contano, al secondo tentativo");
    assert.equal(chiaveComune("Santa teresa di Gallura"), "SANTA TERESA DI GALLURA");
  });
});

describe("province nella ripartizione di GEOPOI", () => {
  test("le sigle recenti si traducono in quelle di origine, le ignote si segnalano", async () => {
    const { traduciProvince } = await import("./omi.js");
    const r = traduciProvince(["MI", "BT", "SU", "FC", "XX"], ["MI", "BA", "FG", "CA", "CI", "VS", "FO"]);
    assert.deepEqual(r.province, ["BA", "CA", "CI", "FG", "FO", "MI", "VS"]);
    assert.deepEqual(r.ignorate, ["XX"]);
  });
});

describe("tipologia OMI dalla categoria del lotto", () => {
  test("una categoria porta alla sua tipologia, un terreno a nessuna stima", () => {
    assert.equal(tipologiaDaSottotipo("IMMOBILE_RESIDENZIALE"), "Abitazioni civili");
    assert.equal(tipologiaDaSottotipo("IMMOBILE_COMMERCIALE"), "Negozi");
    assert.equal(tipologiaDaSottotipo("IMMOBILE_INDUSTRIALE"), "Capannoni industriali");
    assert.equal(tipologiaDaSottotipo("TERRENO"), "Terreni");
    assert.equal(tipologiaDaSottotipo(null), undefined);
    assert.equal(tipologiaDaSottotipo("ALTRA_CATEGORIA", "Immobile a destinazione autorimessa, piano S1"), "Box");
    assert.equal(tipologiaDaSottotipo("IMMOBILE_COMMERCIALE", "Locale deposito/magazzino di 327 mq"), "Magazzini", "un indizio preciso nel testo vince sulla categoria generica");
    assert.equal(tipologiaDaSottotipo("IMMOBILE_COMMERCIALE", "Locale consistenza 396 mq"), "Negozi");
    assert.equal(tipologiaDaSottotipo("IMMOBILE_RESIDENZIALE", "appartamento con box auto"), "Abitazioni civili", "su un residenziale il testo non comanda");
    assert.equal(tipologiaDaSottotipo("ALTRA_CATEGORIA", "Quota di un diritto"), "Non classificata", "senza indizi niente stima da abitazione");
  });
});
