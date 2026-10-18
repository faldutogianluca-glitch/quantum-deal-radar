import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { controllaDati } from "./controllo.js";
import type { ImmobileRow } from "./repository.js";

const OGGI = new Date("2026-10-18T12:00:00Z");
let id = 1;
function riga(campi: Partial<ImmobileRow>): ImmobileRow {
  return {
    id: id++, fonte: "demanio", id_esterno: String(id), titolo: "Appartamento", comune: "MILANO", comune_cod: "F205",
    indirizzo_raw: `Via Prova ${id}`, mq: 80, prezzo: 200_000, livello_zona: "zona", sottotipo_asset: "A3",
    scraped_at: "2026-10-18T10:00:00Z", qre_esito: "scarta", qre_valore_fonte: "omi_ottimo",
    ...campi,
  } as ImmobileRow;
}
const codici = (righe: ImmobileRow[], storico = []) => controllaDati(righe, storico, OGGI).map((a) => a.codice);

describe("controllo di qualita' dei dati", () => {
  test("dati puliti: nessuna anomalia", () => {
    assert.deepEqual(codici([riga({}), riga({})]), []);
  });

  test("superficie a zero su un residenziale: grave", () => {
    const a = controllaDati([riga({ mq: 0 })], [], OGGI);
    assert.equal(a[0]!.codice, "superficie_assente");
    assert.equal(a[0]!.gravita, "grave");
  });

  test("un box senza superficie non e' un problema: e' fuori perimetro", () => {
    assert.deepEqual(codici([riga({ mq: 0, sottotipo_asset: "C6", qre_esito: "fuori_perimetro" })]), []);
  });

  test("gemelli allo stesso indirizzo e ribassi sospetti, come i box di Manerbio", () => {
    const a = riga({ indirizzo_raw: "PIERPAOLO PASOLINI N. 33", comune: "MANERBIO" });
    const b = riga({ indirizzo_raw: "Pierpaolo Pasolini n. 33", comune: "MANERBIO" });
    const storico = [
      { immobile_id: a.id, prezzo: 21_889, rilevato_il: "2026-10-18T07:00:00Z" },
      { immobile_id: a.id, prezzo: 11_000, rilevato_il: "2026-10-18T08:00:00Z" },
    ];
    const c = controllaDati([a, b], storico as never, OGGI).map((x) => x.codice);
    assert.ok(c.includes("annunci_gemelli"));
    assert.ok(c.includes("ribasso_sospetto"));
  });

  test("verdetto positivo senza zona: grave", () => {
    assert.ok(codici([riga({ qre_esito: "passa", livello_zona: "comune", qre_valore_fonte: "omi_max" })]).includes("verdetto_senza_zona"));
  });

  test("verdetto positivo su un negozio: grave", () => {
    const negozio = riga({ qre_esito: "passa", sottotipo_asset: "IMMOBILE_COMMERCIALE / NEGOZIO" });
    assert.ok(codici([negozio]).includes("verdetto_non_residenziale"));
    assert.ok(!codici([riga({ qre_esito: "passa", sottotipo_asset: "A/3" })]).includes("verdetto_non_residenziale"));
  });

  test("zona non risolta in un comune che i perimetri coprono", () => {
    assert.ok(codici([riga({}), riga({ livello_zona: "comune" })]).includes("zona_non_risolta"));
  });

  test("fonte ferma da oltre due settimane", () => {
    assert.ok(codici([riga({ scraped_at: "2026-09-01T00:00:00Z" })]).includes("fonte_ferma"));
  });
});

describe("controllo dei file OMI", () => {
  test("semestri misti, quotazione implausibile, zone e perimetri spaiati", async () => {
    const { controllaOmi } = await import("./controllo.js");
    const codici = controllaOmi(
      [
        { comuneCod: "H623", zona: "D1", vendMin: 1900, semestre: "2026-1" },
        { comuneCod: "H623", zona: "B1", vendMin: 2100, semestre: "2023-1" },
        { comuneCod: "H623", zona: "E9", vendMin: 1.3, semestre: "2026-1" },
      ],
      [{ comuneCod: "H623", zona: "D1" }, { comuneCod: "H623", zona: "B1" }, { comuneCod: "H623", zona: "C1" }],
    ).map((a) => a.codice);
    assert.deepEqual(codici.sort(), ["omi_perimetro_senza_quotazione", "omi_quotazione_implausibile", "omi_semestri_misti", "omi_zona_senza_perimetro"]);
  });
  test("zona rurale senza quotazioni: non e' un'anomalia (l'Agenzia non le quota)", async () => {
    const { controllaOmi } = await import("./controllo.js");
    assert.deepEqual(controllaOmi([{ comuneCod: "A010", zona: "B1", vendMin: 1900, semestre: "2026-1" }], [{ comuneCod: "A010", zona: "B1" }, { comuneCod: "A010", zona: "R1" }]), []);
  });
  test("zona rurale senza quotazioni in un comune che ne quota altre: import parziale", async () => {
    const { controllaOmi } = await import("./controllo.js");
    const codici = controllaOmi(
      [{ comuneCod: "C986", zona: "B1", vendMin: 1900, semestre: "2026-1" }, { comuneCod: "C986", zona: "R1", vendMin: 900, semestre: "2026-1" }],
      [{ comuneCod: "C986", zona: "B1" }, { comuneCod: "C986", zona: "R1" }, { comuneCod: "C986", zona: "R2" }],
    ).map((a) => a.codice);
    assert.deepEqual(codici, ["omi_perimetro_senza_quotazione"]);
  });
  test("quotazione ottimo fuori scala o valore assurdo: implausibile", async () => {
    const { controllaOmi } = await import("./controllo.js");
    const zone = [{ comuneCod: "F205", zona: "B12" }];
    for (const q of [{ vendMin: null, vendMinOttimo: 12 }, { vendMin: 8300, vendMinOttimo: 1_090_000 }, { vendMin: 830_000 }]) {
      const codici = controllaOmi([{ comuneCod: "F205", zona: "B12", semestre: "2026-1", ...q }], zone).map((a) => a.codice);
      assert.deepEqual(codici, ["omi_quotazione_implausibile"], JSON.stringify(q));
    }
  });
  test("file in archivio: proprieta' lette come le legge l'enrich (maiuscole di ogr2ogr), file illeggibile segnalato", async () => {
    const { anomalieFileOmi } = await import("./controllo.js");
    const { mkdtempSync, writeFileSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const cartella = mkdtempSync(join(tmpdir(), "qdr-controllo-omi-"));
    writeFileSync(join(cartella, "quotazioni_omi.json"), JSON.stringify([{ comuneCod: "F205", zona: "D12", vendMin: 3500, semestre: "2026-1" }]));
    writeFileSync(join(cartella, "zone_omi.geojson"), JSON.stringify({ type: "FeatureCollection", features: [{
      type: "Feature", properties: { COMUNE_AMM: "F205", ZONA: "D12" },
      geometry: { type: "Polygon", coordinates: [[[9.18, 45.46], [9.19, 45.46], [9.19, 45.47], [9.18, 45.46]]] },
    }] }));
    assert.deepEqual(await anomalieFileOmi(cartella), []);
    writeFileSync(join(cartella, "zone_omi.geojson"), "{troncato");
    assert.deepEqual((await anomalieFileOmi(cartella)).map((a) => a.codice), ["omi_file_illeggibile"]);
  });
  test("valore di perizia per mq fuori scala rispetto all'OMI della zona o del comune (Cassano, 31 mq)", async () => {
    const { controllaPerizieOmi } = await import("./controllo.js");
    const quot = [
      { comuneCod: "C003", zona: "B1", tipologia: "Abitazioni civili", vendMin: 1400, vendMax: 1800, vendMaxOttimo: 2000, semestre: "2026-1" },
      { comuneCod: "C003", zona: "B1", tipologia: "Negozi", vendMin: 1400, vendMax: 9000, semestre: "2026-1" },
    ];
    const r = (x: object) => ({ id: 1, comune: "Cassano d'Adda", comune_cod: "C003", zona_omi: "R1", ...x }) as never;
    assert.deepEqual(controllaPerizieOmi([r({ mq: 31, valore_perizia: 147882 })], quot).map((a) => a.codice), ["perizia_fuori_scala_omi"]);
    assert.deepEqual(controllaPerizieOmi([r({ mq: 98, valore_perizia: 147882 })], quot), []);
  });
  test("file coerenti: nessuna anomalia", async () => {
    const { controllaOmi } = await import("./controllo.js");
    assert.deepEqual(controllaOmi([{ comuneCod: "F205", zona: "B12", vendMin: 8300, semestre: "2024-2" }], [{ comuneCod: "F205", zona: "B12" }]), []);
  });
});

