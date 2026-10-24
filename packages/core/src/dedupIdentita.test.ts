/**
 * Casi di identita' degli immobili (rilievo critico n. 1 della revisione del 24/10/2026).
 * Tutti i dati sono SINTETICI: indirizzi e numeri di procedura sono inventati per i test.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { analizzaDuplicati, confronta, deduplica, identitaUnita, type ImmobileNorm, type Registry } from "./dedup.js";

const REG: Registry = { pvp: { priorita: 1 }, reperform: { priorita: 2 }, portale: { priorita: 9 } };
const imm = (o: Partial<ImmobileNorm> & { fonte: string; idEsterno: string }): ImmobileNorm => o;
const EDIFICIO = { comune: "Milano", mq: 80, locali: 3 };

describe("stesso edificio, unita' diverse", () => {
  test("interni 2 e 3, entrambi 80 mq e tre locali, da due fonti: restano due immobili", () => {
    const out = deduplica([
      imm({ fonte: "pvp", idEsterno: "1", indirizzoRaw: "Via Esempio 10 int. 2", ...EDIFICIO }),
      imm({ fonte: "portale", idEsterno: "2", indirizzoRaw: "Via Esempio 10 int. 3", ...EDIFICIO }),
    ], REG);
    assert.equal(out.length, 2);
  });

  test("interni 2 e 3 dalla stessa fonte: due immobili", () => {
    const out = deduplica([
      imm({ fonte: "portale", idEsterno: "1", indirizzoRaw: "Via Esempio 10 int. 2", ...EDIFICIO }),
      imm({ fonte: "portale", idEsterno: "2", indirizzoRaw: "Via Esempio 10 int. 3", ...EDIFICIO }),
    ], REG);
    assert.equal(out.length, 2);
  });

  test("scala, piano e subalterno diversi escludono la fusione", () => {
    for (const [a, b] of [
      [{ scala: "A" }, { scala: "B" }],
      [{ piano: "2" }, { piano: "3" }],
      [{ subalterno: "10" }, { subalterno: "11" }],
    ] as const) {
      const r = confronta(
        imm({ fonte: "pvp", idEsterno: "1", indirizzoRaw: "Via Esempio 10", ...EDIFICIO, ...a }),
        imm({ fonte: "portale", idEsterno: "2", indirizzoRaw: "Via Esempio 10", ...EDIFICIO, ...b }),
      );
      assert.equal(r.relazione, "esclusa", JSON.stringify([a, b]));
    }
  });

  test("l'identita' dell'unita' si ricava dall'indirizzo grezzo e i campi espliciti prevalgono", () => {
    assert.deepEqual(identitaUnita(imm({ fonte: "x", idEsterno: "1", indirizzoRaw: "Via Esempio 10, scala B, piano 2, int. 7, sub. 31" })), {
      interno: "7", scala: "B", piano: "2", subalterno: "31",
    });
    assert.equal(identitaUnita(imm({ fonte: "x", idEsterno: "1", indirizzoRaw: "Via Esempio 10 int. 7", interno: "9" })).interno, "9");
  });
});

describe("identificativi giudiziari incompatibili", () => {
  const geo = { comune: "Milano", indirizzoRaw: "Via Esempio 10", mq: 80, locali: 3 };

  test("procedura, anno o tribunale diversi: nessuna fusione, anche con identica chiave geofisica", () => {
    const casi: Array<Partial<ImmobileNorm>[]> = [
      [{ tribunale: "Milano", annoRge: 2025, numeroRge: 100 }, { tribunale: "Milano", annoRge: 2025, numeroRge: 101 }],
      [{ tribunale: "Milano", annoRge: 2025, numeroRge: 100 }, { tribunale: "Milano", annoRge: 2024, numeroRge: 100 }],
      [{ tribunale: "Milano", annoRge: 2025, numeroRge: 100 }, { tribunale: "Monza", annoRge: 2025, numeroRge: 100 }],
    ];
    for (const [a, b] of casi) {
      const out = deduplica([
        imm({ fonte: "pvp", idEsterno: "1", ...geo, ...a }),
        imm({ fonte: "portale", idEsterno: "2", ...geo, ...b }),
      ], REG);
      assert.equal(out.length, 2, JSON.stringify([a, b]));
    }
  });

  test("stessa procedura ma lotti diversi: due immobili", () => {
    const base = { tribunale: "Milano", annoRge: 2025, numeroRge: 100 };
    const out = deduplica([
      imm({ fonte: "pvp", idEsterno: "1", ...geo, ...base, numeroLotto: "1" }),
      imm({ fonte: "portale", idEsterno: "2", ...geo, ...base, numeroLotto: "2" }),
    ], REG);
    assert.equal(out.length, 2);
  });

  test("stessa procedura, lotto indicato da una sola fonte: candidato, non fusione", () => {
    const base = { tribunale: "Milano", annoRge: 2025, numeroRge: 100 };
    const a = analizzaDuplicati([
      imm({ fonte: "pvp", idEsterno: "1", ...geo, ...base, numeroLotto: "1" }),
      imm({ fonte: "portale", idEsterno: "2", ...geo, ...base }),
    ], REG);
    assert.equal(a.risultato.length, 2);
    assert.equal(a.candidati.length, 1);
  });
});

describe("idempotenza e fusione confermata", () => {
  test("lo stesso annuncio riletto resta uno e prevale il dato piu' recente", () => {
    const vecchio = imm({ fonte: "portale", idEsterno: "7", indirizzoRaw: "Via Esempio 10 int. 2", ...EDIFICIO, prezzo: 100000, tipoPrezzo: "richiesta_reoco" });
    const nuovo = imm({ fonte: "portale", idEsterno: "7", indirizzoRaw: "Via Esempio 10 int. 2", ...EDIFICIO, prezzo: 95000, tipoPrezzo: "richiesta_reoco" });
    const out = deduplica([vecchio, nuovo], REG);
    assert.equal(out.length, 1);
    assert.equal(out[0]!.prezzo, 95000);
    const di_nuovo = deduplica([out[0]!, nuovo], REG);
    assert.equal(di_nuovo.length, 1, "una seconda rilettura non crea record");
  });

  test("duplicato confermato tra fonti: fusione con provenienza e conflitti conservati", () => {
    const base = { tribunale: "Milano", annoRge: 2025, numeroRge: 100, numeroLotto: "1" };
    const out = deduplica([
      imm({ fonte: "portale", idEsterno: "p1", mq: 95, prezzo: 295000, tipoPrezzo: "richiesta_reoco", ...base }),
      imm({ fonte: "pvp", idEsterno: "v1", mq: 80, prezzo: 214000, tipoPrezzo: "base_asta", ...base }),
    ], REG);
    assert.equal(out.length, 1);
    const u = out[0]!;
    assert.deepEqual([...u.fonti!].sort(), ["portale", "pvp"]);
    assert.deepEqual(u.idFonti, ["portale:p1", "pvp:v1"], "ogni origine resta rintracciabile");
    assert.ok(u.noteMerge!.some((n) => n.includes("mq: 80") && n.includes("95")), "il conflitto sui mq non sparisce");
    assert.equal(u.prezzo, 214000);
  });

  test("stesso edificio e stesso interno da due fonti diverse: fusione certa", () => {
    const r = confronta(
      imm({ fonte: "pvp", idEsterno: "1", indirizzoRaw: "Via Esempio 10 int. 2", ...EDIFICIO }),
      imm({ fonte: "portale", idEsterno: "2", indirizzoRaw: "V. Esempio, 10 interno 2", ...EDIFICIO }),
    );
    assert.equal(r.relazione, "certa");
  });
});

describe("identificativi incompleti e legami ambigui", () => {
  test("senza identificativo dell'unita' la somiglianza produce un candidato, non una fusione", () => {
    const a = analizzaDuplicati([
      imm({ fonte: "pvp", idEsterno: "1", indirizzoRaw: "Via Esempio 10", ...EDIFICIO }),
      imm({ fonte: "portale", idEsterno: "2", indirizzoRaw: "Via Esempio 10", ...EDIFICIO }),
    ], REG);
    assert.equal(a.risultato.length, 2);
    assert.deepEqual(a.candidati.map((c) => [c.a, c.b]), [["portale:2", "pvp:1"]]);
  });

  test("due annunci distinti della stessa fonte allo stesso indirizzo non sono nemmeno candidati", () => {
    const a = analizzaDuplicati([
      imm({ fonte: "portale", idEsterno: "1", indirizzoRaw: "Via Esempio 10", ...EDIFICIO }),
      imm({ fonte: "portale", idEsterno: "2", indirizzoRaw: "Via Esempio 10", ...EDIFICIO }),
    ], REG);
    assert.equal(a.risultato.length, 2);
    assert.equal(a.candidati.length, 0);
  });

  test("legame transitivo ambiguo (A=B, A=C, ma B e C incompatibili): nessuna fusione distruttiva", () => {
    const a = analizzaDuplicati([
      imm({ fonte: "pvp", idEsterno: "1", indirizzoRaw: "Via Esempio 10 int. 2", ...EDIFICIO }),
      imm({ fonte: "pvp", idEsterno: "1", indirizzoRaw: "Via Esempio 10 int. 3", ...EDIFICIO }),
      imm({ fonte: "reperform", idEsterno: "9", indirizzoRaw: "Via Esempio 10 int. 2", ...EDIFICIO }),
    ], REG);
    assert.equal(a.risultato.length, 3, "nessun record deve sparire");
    assert.equal(a.ambigui.length, 1);
    assert.ok(a.candidati.length >= 1);
  });
});

describe("indipendenza dall'ordine", () => {
  const permutazioni = <T,>(v: T[]): T[][] =>
    v.length <= 1 ? [v] : v.flatMap((x, i) => permutazioni([...v.slice(0, i), ...v.slice(i + 1)]).map((p) => [x, ...p]));

  test("lo stesso insieme in qualunque ordine produce lo stesso risultato", () => {
    const base = { tribunale: "Milano", annoRge: 2025, numeroRge: 100, numeroLotto: "1" };
    const recs = [
      imm({ fonte: "portale", idEsterno: "p1", mq: 95, prezzo: 295000, tipoPrezzo: "richiesta_reoco", ...base }),
      imm({ fonte: "pvp", idEsterno: "v1", mq: 80, prezzo: 214000, tipoPrezzo: "base_asta", ...base }),
      imm({ fonte: "reperform", idEsterno: "r1", nEsperimentiDeserti: 2, ...base }),
      imm({ fonte: "pvp", idEsterno: "x", indirizzoRaw: "Via Altra 3 int. 1", ...EDIFICIO }),
      imm({ fonte: "portale", idEsterno: "y", indirizzoRaw: "Via Altra 3 int. 2", ...EDIFICIO }),
    ];
    const firma = (rs: ImmobileNorm[]) =>
      JSON.stringify(rs.map((r) => JSON.parse(JSON.stringify(r))).sort((a, b) => (a.idFonti?.[0] ?? `${a.fonte}:${a.idEsterno}`).localeCompare(b.idFonti?.[0] ?? `${b.fonte}:${b.idEsterno}`)));
    const attesa = firma(deduplica(recs, REG));
    for (const p of permutazioni(recs)) assert.equal(firma(deduplica(p, REG)), attesa);
  });
});

describe("rilievi medi della revisione indipendente (24/10/2026)", () => {
  const proc = { tribunale: "Milano", annoRge: 2031, numeroRge: 5 };

  test("stessa procedura, nessun lotto, due annunci della STESSA fonte: candidato, non fusione", () => {
    const a = analizzaDuplicati([
      imm({ fonte: "pvp", idEsterno: "1", indirizzoRaw: "Via A 1", mq: 80, ...proc }),
      imm({ fonte: "pvp", idEsterno: "2", indirizzoRaw: "Via B 9", mq: 50, ...proc }),
    ], REG);
    assert.equal(a.risultato.length, 2);
    assert.equal(a.candidati.length, 1);
  });

  test("stessa procedura, nessun lotto, fonti diverse: resta fusione (lotto unico)", () => {
    const out = deduplica([
      imm({ fonte: "pvp", idEsterno: "1", ...proc }),
      imm({ fonte: "portale", idEsterno: "2", ...proc }),
    ], REG);
    assert.equal(out.length, 1);
  });

  test("interno uguale con scala dichiarata da un solo lato: candidato, non certa", () => {
    const c = confronta(
      imm({ fonte: "pvp", idEsterno: "1", indirizzoRaw: "Via Roma 3 scala A int. 3", ...EDIFICIO }),
      imm({ fonte: "portale", idEsterno: "2", indirizzoRaw: "Via Roma 3 int. 3", ...EDIFICIO }),
    );
    assert.equal(c.relazione, "candidata");
  });

  test("interno e scala uguali su entrambi i lati: certa", () => {
    const c = confronta(
      imm({ fonte: "pvp", idEsterno: "1", indirizzoRaw: "Via Roma 3 scala A int. 3", ...EDIFICIO }),
      imm({ fonte: "portale", idEsterno: "2", indirizzoRaw: "Via Roma 3 scala A int. 3", ...EDIFICIO }),
    );
    assert.equal(c.relazione, "certa");
  });

  test("la fusione non cancella un vincolo culturale ne' un'occupazione segnalati da una fonte", () => {
    for (const ordine of [0, 1]) {
      const x = imm({ fonte: "pvp", idEsterno: "1", vincoloCulturale: false, statoOccupazionale: "libero", ...proc, numeroLotto: "1" });
      const y = imm({ fonte: "portale", idEsterno: "2", vincoloCulturale: true, statoOccupazionale: "occupato dal debitore", ...proc, numeroLotto: "1" });
      const [u] = deduplica(ordine ? [y, x] : [x, y], REG);
      assert.equal(u!.vincoloCulturale, true, `ordine ${ordine}`);
      assert.match(String(u!.statoOccupazionale), /occupato/, `ordine ${ordine}`);
      assert.ok(u!.noteMerge!.some((n) => n.includes("statoOccupazionale")));
    }
  });

  test("un campo noto da una sola fonte si completa come prima", () => {
    const [u] = deduplica([
      imm({ fonte: "pvp", idEsterno: "1", ...proc, numeroLotto: "1" }),
      imm({ fonte: "portale", idEsterno: "2", statoOccupazionale: "libero", ...proc, numeroLotto: "1" }),
    ], REG);
    assert.equal(u!.statoOccupazionale, "libero");
  });
});
