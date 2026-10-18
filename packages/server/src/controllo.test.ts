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
      [{ comuneCod: "H623", zona: "D1" }, { comuneCod: "H623", zona: "B1" }, { comuneCod: "H623", zona: "R1" }],
    ).map((a) => a.codice);
    assert.deepEqual(codici.sort(), ["omi_perimetro_senza_quotazione", "omi_quotazione_implausibile", "omi_semestri_misti", "omi_zona_senza_perimetro"]);
  });
  test("file coerenti: nessuna anomalia", async () => {
    const { controllaOmi } = await import("./controllo.js");
    assert.deepEqual(controllaOmi([{ comuneCod: "F205", zona: "B12", vendMin: 8300, semestre: "2024-2" }], [{ comuneCod: "F205", zona: "B12" }]), []);
  });
});

