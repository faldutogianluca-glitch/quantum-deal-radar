/**
 * Persistenza dell'identita' degli immobili (rilievo critico n. 1 della revisione del 24/10/2026).
 * Database isolato in una cartella temporanea. Tutti i dati sono SINTETICI.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "qdr-identita-"));
process.env.QDR_DATA_DIR = dir;
process.env.QDR_DB_PATH = join(dir, "test.db");

const { integraImmobili } = await import("./pipeline.js");
const { listAllRows, listCandidati, confermaCandidato, respingiCandidato, storicoPrezzi } = await import("./repository.js");
const { db } = await import("./db.js");

const REG = { pvp: { priorita: 1 }, reperform: { priorita: 2 }, portale: { priorita: 9 } };
const coinvolge = (c: { origine_a: string; origine_b: string }, id: string) => c.origine_a.includes(id) || c.origine_b.includes(id);
const righe = (comune: string) => listAllRows().filter((r) => r.comune === comune);

describe("stesso edificio, unita' diverse", () => {
  test("interni 2 e 3, 80 mq e tre locali: due righe, anche rileggendo piu' volte", () => {
    const base = { comune: "Testopoli", mq: 80, locali: 3 };
    const uno = { fonte: "pvp", idEsterno: "a1", indirizzoRaw: "Via Prova 10 int. 2", ...base };
    const due = { fonte: "portale", idEsterno: "b1", indirizzoRaw: "Via Prova 10 int. 3", ...base };
    integraImmobili([uno, due], REG);
    assert.equal(righe("Testopoli").length, 2);
    integraImmobili([uno, due], REG);
    integraImmobili([due, uno], REG);
    assert.equal(righe("Testopoli").length, 2, "nessuna fusione ne' duplicazione alle riletture");
    assert.deepEqual(righe("Testopoli").map((r) => r.interno).sort(), ["2", "3"], "l'interno si conserva");
  });

  test("due unita' dello stesso lotto con interni diversi non si sovrascrivono", () => {
    const lotto = { comune: "Lottopoli", tribunale: "Milano", annoRge: 2030, numeroRge: 9, numeroLotto: "1", mq: 70, locali: 2 };
    integraImmobili([
      { fonte: "pvp", idEsterno: "u1", indirizzoRaw: "Via Lotto 1 int. 1", ...lotto },
      { fonte: "pvp", idEsterno: "u2", indirizzoRaw: "Via Lotto 1 int. 2", ...lotto },
    ], REG);
    assert.equal(righe("Lottopoli").length, 2);
  });
});

describe("procedure giudiziarie incompatibili", () => {
  test("RGE diversi allo stesso indirizzo: due righe", () => {
    const geo = { comune: "Procopoli", indirizzoRaw: "Via Prova 5", mq: 60, locali: 2, tribunale: "Milano", annoRge: 2030 };
    integraImmobili([
      { fonte: "pvp", idEsterno: "p1", numeroRge: 100, ...geo },
      { fonte: "portale", idEsterno: "p2", numeroRge: 101, ...geo },
    ], REG);
    assert.equal(righe("Procopoli").length, 2);
  });
});

describe("idempotenza e provenienza", () => {
  test("lo stesso annuncio riletto aggiorna la riga e annota il prezzo solo se cambia", () => {
    const a = { fonte: "portale", idEsterno: "idem1", comune: "Idempoli", indirizzoRaw: "Via Idem 3 int. 8", mq: 50, locali: 2, prezzo: 100000, tipoPrezzo: "richiesta_reoco" as const };
    const e1 = integraImmobili([a], REG);
    const e2 = integraImmobili([a], REG);
    const e3 = integraImmobili([{ ...a, prezzo: 90000 }], REG);
    assert.equal(e1.nuovi, 1);
    assert.equal(e2.nuovi, 0);
    assert.equal(e3.nuovi, 0);
    const r = righe("Idempoli");
    assert.equal(r.length, 1);
    assert.equal(r[0]!.prezzo, 90000);
    assert.deepEqual(storicoPrezzi(r[0]!.id).map((s) => s.prezzo), [100000, 90000]);
  });

  test("duplicato confermato tra fonti: una riga con tutte le origini, e la rilettura da una fonte secondaria non duplica", () => {
    const base = { comune: "Fusopoli", tribunale: "Milano", annoRge: 2031, numeroRge: 1, numeroLotto: "1" };
    const portale = { fonte: "portale", idEsterno: "x9", mq: 95, prezzo: 200000, tipoPrezzo: "richiesta_reoco" as const, ...base };
    const pvp = { fonte: "pvp", idEsterno: "y9", mq: 80, prezzo: 150000, tipoPrezzo: "base_asta" as const, ...base };
    integraImmobili([portale, pvp], REG);
    let r = righe("Fusopoli");
    assert.equal(r.length, 1);
    assert.deepEqual(JSON.parse(r[0]!.id_fonti_json!), ["portale:x9", "pvp:y9"]);
    assert.ok(JSON.parse(r[0]!.note_merge_json!).some((n: string) => n.startsWith("mq")), "il conflitto resta annotato");
    // rilettura dalla sola fonte secondaria: nessun nuovo record
    const e = integraImmobili([portale], REG);
    assert.equal(e.nuovi, 0);
    r = righe("Fusopoli");
    assert.equal(r.length, 1);
  });

  test("assorbire un doppione conserva lo storico dei prezzi", () => {
    const luogo = { comune: "Storicopoli", mq: 70, locali: 3 };
    // due righe separate, ciascuna con la sua storia
    integraImmobili([{ fonte: "portale", idEsterno: "s1", indirizzoRaw: "Via Storia 1 int. 3", prezzo: 120000, tipoPrezzo: "richiesta_reoco" as const, ...luogo }], REG);
    integraImmobili([{ fonte: "portale", idEsterno: "s1", indirizzoRaw: "Via Storia 1 int. 3", prezzo: 110000, tipoPrezzo: "richiesta_reoco" as const, ...luogo }], REG);
    integraImmobili([{ fonte: "pvp", idEsterno: "s2", tribunale: "Milano", annoRge: 2032, numeroRge: 4, ...luogo, prezzo: 70000, tipoPrezzo: "base_asta" as const }], REG);
    assert.equal(righe("Storicopoli").length, 2);
    // un solo record che porta entrambe le identita': interno + procedura
    integraImmobili([{ fonte: "pvp", idEsterno: "s2", tribunale: "Milano", annoRge: 2032, numeroRge: 4, indirizzoRaw: "Via Storia 1 int. 3", ...luogo, prezzo: 70000, tipoPrezzo: "base_asta" as const }], REG);
    const r = righe("Storicopoli");
    assert.equal(r.length, 1);
    const prezzi = storicoPrezzi(r[0]!.id).map((s) => s.prezzo);
    assert.ok(prezzi.includes(120000) && prezzi.includes(110000), `storia persa: ${prezzi}`);
  });
});

describe("candidati da verificare", () => {
  const base = { comune: "Candipoli", indirizzoRaw: "Via Dubbio 4", mq: 80, locali: 3 };

  test("somiglianza senza identificativo: due righe e un candidato aperto", () => {
    const e = integraImmobili([
      { fonte: "reperform", idEsterno: "c1", prezzo: 90000, tipoPrezzo: "richiesta_reoco" as const, ...base },
      { fonte: "pvp", idEsterno: "c2", tribunale: "Milano", annoRge: 2033, numeroRge: 6, prezzo: 70000, tipoPrezzo: "base_asta" as const, ...base },
    ], REG);
    assert.equal(righe("Candipoli").length, 2);
    assert.equal(e.candidati, 1);
    const aperti = listCandidati("aperto").filter((c) => coinvolge(c, "c1"));
    assert.equal(aperti.length, 1);
    // il candidato non scompare e non si duplica ai cicli successivi
    integraImmobili([{ fonte: "reperform", idEsterno: "c1", ...base }], REG);
    assert.equal(listCandidati("aperto").filter((c) => coinvolge(c, "c1")).length, 1);
  });

  test("conferma manuale: fonde, conserva storico e origini; il candidato non torna aperto", () => {
    const [cand] = listCandidati("aperto").filter((c) => coinvolge(c, "c1"));
    const sopravvissuta = confermaCandidato(cand!.id);
    assert.ok(sopravvissuta);
    const r = righe("Candipoli");
    assert.equal(r.length, 1);
    assert.deepEqual(JSON.parse(r[0]!.id_fonti_json!), ["pvp:c2", "reperform:c1"]);
    integraImmobili([{ fonte: "reperform", idEsterno: "c1", ...base }, { fonte: "pvp", idEsterno: "c2", tribunale: "Milano", annoRge: 2033, numeroRge: 6, ...base }], REG);
    assert.equal(righe("Candipoli").length, 1, "dopo la conferma le due origini restano un solo bene");
    assert.equal(listCandidati("aperto").filter((c) => coinvolge(c, "c1")).length, 0);
  });

  test("rifiuto: il candidato respinto non torna aperto", () => {
    const b2 = { comune: "Respinopoli", indirizzoRaw: "Via No 1", mq: 60, locali: 2 };
    integraImmobili([{ fonte: "reperform", idEsterno: "n1", ...b2 }, { fonte: "pvp", idEsterno: "n2", ...b2 }], REG);
    const [cand] = listCandidati("aperto").filter((c) => coinvolge(c, "n1"));
    assert.ok(respingiCandidato(cand!.id));
    integraImmobili([{ fonte: "reperform", idEsterno: "n1", ...b2 }, { fonte: "pvp", idEsterno: "n2", ...b2 }], REG);
    assert.equal(listCandidati("aperto").filter((c) => coinvolge(c, "n1")).length, 0);
    assert.equal(righe("Respinopoli").length, 2);
  });
});

test("lo schema e' alla versione attesa", () => {
  const v = (db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version;
  assert.equal(v, 2);
});

describe("un gruppo gia' fuso che diventa ambiguo non fa sparire nessun immobile", () => {
  for (const [nome, ordine] of [["ordine A,B,C", [0, 1, 2]], ["ordine C,B,A", [2, 1, 0]]] as const) {
    test(`pvp 'int. 3 piano 2' + reperform 'int. 3' fusi; poi arriva 'int. 3 piano 3' (${nome})`, () => {
      const comune = `Ambigopoli${ordine.join("")}`;
      const base = { comune, mq: 80, locali: 3 };
      const A = { fonte: "pvp", idEsterno: `A1-${comune}`, indirizzoRaw: "Via Uno 5 int. 3 piano 2", ...base };
      const B = { fonte: "reperform", idEsterno: `B1-${comune}`, indirizzoRaw: "Via Uno 5 int. 3", ...base };
      const C = { fonte: "portale", idEsterno: `C1-${comune}`, indirizzoRaw: "Via Uno 5 int. 3 piano 3", ...base };
      integraImmobili([A, B], REG);
      assert.equal(righe(comune).length, 1, "il primo giorno A e B sono lo stesso bene");
      integraImmobili(ordine.map((k) => [A, B, C][k]!), REG);
      const dopo = righe(comune);
      // ogni annuncio resta rappresentato da una riga, nessuno e' sparito
      const origini = dopo.flatMap((r) => JSON.parse(r.id_fonti_json ?? "[]") as string[]).sort();
      assert.deepEqual(origini, [`pvp:A1-${comune}`, `portale:C1-${comune}`, `reperform:B1-${comune}`].sort());
      assert.equal(dopo.length, 3);
      // stabile alle riletture successive
      integraImmobili([A, B, C], REG);
      integraImmobili([C, A, B], REG);
      assert.equal(righe(comune).length, 3);
      const chiavi1 = righe(comune).map((r) => r.chiave_dedup).sort();
      integraImmobili([A, B, C], REG);
      assert.deepEqual(righe(comune).map((r) => r.chiave_dedup).sort(), chiavi1, "la chiave non cambia a ogni run");
    });
  }
});
