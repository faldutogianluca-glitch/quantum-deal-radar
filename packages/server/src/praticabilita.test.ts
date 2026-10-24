/**
 * Filtro "solo praticabili" e stato della valutazione (rilievo 2 della revisione del 24/10/2026).
 * Database isolato, dati SINTETICI.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "qdr-prat-"));
process.env.QDR_DATA_DIR = dir;
process.env.QDR_DB_PATH = join(dir, "test.db");

const { integraImmobili } = await import("./pipeline.js");
const { listImmobili, salvaValutazione, listAllRows, listCandidati, confermaCandidato } = await import("./repository.js");
const { db } = await import("./db.js");
const { valuta } = await import("@qdr/core");

const REG = { pvp: { priorita: 1 }, portale: { priorita: 9 } };
const q = new Map([["F205|B1|Abitazioni civili", { vendMin: 3000, vendMax: 3600, semestre: "2026-1" }]]);
const oggi = new Date(Date.UTC(2026, 7, 5));

const idDi = (idEsterno: string) => listAllRows().find((r) => r.id_esterno === idEsterno)!.id;

describe("filtro praticabili", () => {
  test("tre immobili mai valutati (come nella demo) NON passano il filtro solo-praticabili", () => {
    integraImmobili([
      { fonte: "portale", idEsterno: "m1", comune: "Praticopoli", indirizzoRaw: "Via A 1 int. 1", prezzo: 100000 },
      { fonte: "portale", idEsterno: "m2", comune: "Praticopoli", indirizzoRaw: "Via A 1 int. 2", prezzo: 110000 },
      { fonte: "portale", idEsterno: "m3", comune: "Praticopoli", indirizzoRaw: "Via A 1 int. 3", prezzo: 120000 },
    ], REG);
    assert.equal(listImmobili({ comune: "Praticopoli" }).length, 3);
    assert.equal(listImmobili({ comune: "Praticopoli", soloPraticabili: true }).length, 0, "non valutato non e' praticabile");
    assert.equal(listImmobili({ comune: "Praticopoli", valutazione: "non_valutato" }).length, 3);
  });

  test("positivo, negativo e non valutato si separano", () => {
    const base = { comune: "Statopoli", comuneCod: "F205", zonaOmi: "B1", mq: 100, prezzo: 200000, tipoPrezzo: "base_asta" as const };
    integraImmobili([
      { fonte: "pvp", idEsterno: "s1", indirizzoRaw: "Via B 1 int. 1", ...base, valorePerizia: 320000, termineOfferte: "2099-12-31" },
      { fonte: "pvp", idEsterno: "s2", indirizzoRaw: "Via B 1 int. 2", ...base, valorePerizia: 320000, termineOfferte: "2026-07-01" },
      { fonte: "pvp", idEsterno: "s3", indirizzoRaw: "Via B 1 int. 3", ...base, valorePerizia: 320000 },
      { fonte: "pvp", idEsterno: "s4", indirizzoRaw: "Via B 1 int. 4", comune: "Statopoli", prezzo: 90000 },
    ], REG);
    for (const [idEst, imm] of [
      ["s1", { ...base, valorePerizia: 320000, termineOfferte: "2099-12-31" }],
      ["s2", { ...base, valorePerizia: 320000, termineOfferte: "2026-07-01" }],
      ["s3", { ...base, valorePerizia: 320000 }],
      ["s4", { comune: "Statopoli", prezzo: 90000 }],
    ] as const) {
      const v = valuta({ fonte: "pvp", idEsterno: idEst, ...imm } as never, { quotazioni: q, oggi });
      assert.ok(salvaValutazione(idDi(idEst), v));
    }
    const nome = (f: object) => listImmobili({ comune: "Statopoli", ...f }).map((r) => r.id_esterno).sort();
    assert.deepEqual(nome({ valutazione: "positivo" }), ["s1"]);
    assert.deepEqual(nome({ soloPraticabili: true }), ["s1"]);
    assert.deepEqual(nome({ valutazione: "negativo" }), ["s2"]);
    assert.deepEqual(nome({ valutazione: "non_valutato" }), ["s3", "s4"]);
  });

  test("lo stato non valutato porta motivo e prossimo controllo nel database", () => {
    const r = listAllRows().find((x) => x.id_esterno === "s3")!;
    assert.equal(r.esito_valutazione, "non_valutato");
    assert.equal(r.praticabile, null);
    const mancanti = JSON.parse(r.mancanti_json!);
    assert.ok(mancanti.length >= 1 && mancanti[0].prossimoControllo);
  });

  test("una riga valutata dal motore precedente (praticabile=1 senza esito) non conta come positiva", () => {
    db.prepare("UPDATE immobili SET praticabile = 1, esito_valutazione = NULL WHERE id_esterno = 's1'").run();
    assert.deepEqual(listImmobili({ comune: "Statopoli", soloPraticabili: true }).map((r) => r.id_esterno), []);
  });
});

describe("valutazione non piu' attuale", () => {
  const base = { comune: "Scadopoli", comuneCod: "F205", zonaOmi: "B1", mq: 100, prezzo: 200000, tipoPrezzo: "base_asta" as const, valorePerizia: 320000 };

  test("un nuovo scraping che cambia i dati rilevanti azzera la valutazione precedente", () => {
    integraImmobili([{ fonte: "pvp", idEsterno: "t1", indirizzoRaw: "Via C 1 int. 1", ...base, termineOfferte: "2099-06-01" }], REG);
    assert.ok(salvaValutazione(idDi("t1"), valuta({ fonte: "pvp", idEsterno: "t1", ...base, termineOfferte: "2099-06-01" } as never, { quotazioni: q, oggi })));
    assert.equal(listImmobili({ comune: "Scadopoli", soloPraticabili: true }).length, 1);
    // il portale ora riporta un termine diverso: la valutazione vecchia non vale piu'
    integraImmobili([{ fonte: "pvp", idEsterno: "t1", indirizzoRaw: "Via C 1 int. 1", ...base, termineOfferte: "2026-01-01" }], REG);
    assert.equal(listImmobili({ comune: "Scadopoli", soloPraticabili: true }).length, 0);
    assert.equal(listImmobili({ comune: "Scadopoli", valutazione: "non_valutato" }).length, 1);
  });

  test("uno scraping che non cambia i dati conserva la valutazione", () => {
    integraImmobili([{ fonte: "pvp", idEsterno: "t2", indirizzoRaw: "Via C 1 int. 2", ...base, termineOfferte: "2099-06-01" }], REG);
    assert.ok(salvaValutazione(idDi("t2"), valuta({ fonte: "pvp", idEsterno: "t2", ...base, termineOfferte: "2099-06-01" } as never, { quotazioni: q, oggi })));
    integraImmobili([{ fonte: "pvp", idEsterno: "t2", indirizzoRaw: "Via C 1 int. 2", ...base, termineOfferte: "2099-06-01" }], REG);
    assert.ok(listImmobili({ comune: "Scadopoli", soloPraticabili: true }).some((r) => r.id_esterno === "t2"));
  });

  test("un positivo il cui termine e' passato dopo l'ultima valutazione non e' piu' praticabile", () => {
    integraImmobili([{ fonte: "pvp", idEsterno: "t3", indirizzoRaw: "Via C 1 int. 3", ...base, termineOfferte: "2099-06-01" }], REG);
    assert.ok(salvaValutazione(idDi("t3"), valuta({ fonte: "pvp", idEsterno: "t3", ...base, termineOfferte: "2099-06-01" } as never, { quotazioni: q, oggi })));
    // il termine "passa" senza che nessuno rieseguga l'arricchimento (formato italiano incluso)
    db.prepare("UPDATE immobili SET termine_offerte = ? WHERE id = ?").run("01/02/2026", idDi("t3"));
    assert.ok(!listImmobili({ comune: "Scadopoli", soloPraticabili: true }).some((r) => r.id_esterno === "t3"));
    assert.ok(listImmobili({ comune: "Scadopoli", valutazione: "non_valutato" }).some((r) => r.id_esterno === "t3"));
  });
});

describe("conferma manuale di un candidato", () => {
  test("la riga unita non eredita la valutazione positiva dell'altra e va rivalutata", () => {
    const b = { comune: "Confermopoli", indirizzoRaw: "Via D 4", mq: 90, locali: 3 };
    integraImmobili([{ fonte: "portale", idEsterno: "k1", ...b, vincoloCulturale: true }], REG);
    integraImmobili([{ fonte: "pvp", idEsterno: "k2", ...b, comuneCod: "F205", zonaOmi: "B1", prezzo: 200000, tipoPrezzo: "base_asta", valorePerizia: 320000, termineOfferte: "2099-06-01" }], REG);
    assert.ok(salvaValutazione(idDi("k2"), valuta({ fonte: "pvp", idEsterno: "k2", ...b, comuneCod: "F205", zonaOmi: "B1", prezzo: 200000, tipoPrezzo: "base_asta", valorePerizia: 320000, termineOfferte: "2099-06-01" } as never, { quotazioni: q, oggi })));
    const cand = listCandidati("aperto").find((c) => c.origine_a.includes("k") && (c.origine_a.includes("k1") || c.origine_b.includes("k1")));
    assert.ok(cand, "i due annunci sono un candidato da verificare");
    assert.ok(confermaCandidato(cand!.id));
    const r = listAllRows().filter((x) => x.comune === "Confermopoli");
    assert.equal(r.length, 1);
    assert.equal(r[0]!.esito_valutazione, null);
    assert.equal(listImmobili({ comune: "Confermopoli", soloPraticabili: true }).length, 0);
  });
});
