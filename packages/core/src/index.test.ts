import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  deduplica, normalizzaIndirizzo, mqBucket, chiaveGiudiziaria,
  type ImmobileNorm, type Registry,
} from "./dedup.js";
import { valuta, PARAMETRI_DEFAULT, type QuotazioneOmi } from "./valutazione.js";

const REG: Registry = { pvp: { priorita: 1 }, reperform: { priorita: 2 }, bnl: { priorita: 4 }, portale: { priorita: 9 } };

const imm = (o: Partial<ImmobileNorm> & { fonte: string; idEsterno: string }): ImmobileNorm => o;

describe("normalizzazione indirizzi", () => {
  test("abbreviazioni e civico", () => {
    assert.deepEqual(normalizzaIndirizzo("V.le  Monza, 12/A - int. 3"), { indirizzo: "VIALE MONZA", civico: "12A" });
    assert.deepEqual(normalizzaIndirizzo("P.zza S. Ambrogio 5"), { indirizzo: "PIAZZA SAN AMBROGIO", civico: "5" });
    assert.deepEqual(normalizzaIndirizzo("C.so Buenos Aires n. 44"), { indirizzo: "CORSO BUENOS AIRES", civico: "44" });
    assert.deepEqual(normalizzaIndirizzo("Via Bergamo 7 scala B"), { indirizzo: "VIA BERGAMO", civico: "7" });
  });

  test("varianti dello stesso indirizzo collassano", () => {
    assert.equal(normalizzaIndirizzo("Viale Monza, 12").indirizzo, normalizzaIndirizzo("V.LE MONZA 12").indirizzo);
  });

  test("input vuoto", () => {
    assert.deepEqual(normalizzaIndirizzo(null), { indirizzo: null, civico: null });
    assert.deepEqual(normalizzaIndirizzo("   "), { indirizzo: null, civico: null });
  });

  test("bucket mq", () => {
    assert.equal(mqBucket(87), 90);
    assert.equal(mqBucket(82), 80);
    assert.equal(mqBucket(null), null);
  });
});

describe("deduplicazione", () => {
  const base = { tribunale: "Tribunale di Milano", annoRge: 2025, numeroRge: 1234, numeroLotto: "1" };

  test("stesso lotto da tre canali diventa uno", () => {
    const out = deduplica([
      imm({ fonte: "portale", idEsterno: "p1", prezzo: 295000, tipoPrezzo: "richiesta_reoco", mq: 82, ...base }),
      imm({ fonte: "pvp", idEsterno: "v1", prezzo: 214000, tipoPrezzo: "base_asta", valorePerizia: 268000, ...base }),
      imm({ fonte: "reperform", idEsterno: "r1", nEsperimentiDeserti: 2, ...base }),
    ], REG);

    assert.equal(out.length, 1);
    const u = out[0]!;
    assert.equal(u.prezzo, 214000, "la base d'asta deve prevalere sul prezzo richiesto");
    assert.equal(u.tipoPrezzo, "base_asta");
    assert.equal(u.nEsperimentiDeserti, 2, "il segnale di esperimenti deserti non si perde");
    assert.equal(u.mq, 82, "campo mancante nel master ereditato dalla fonte minore");
    assert.equal(u.valorePerizia, 268000);
    assert.deepEqual([...u.fonti!].sort(), ["portale", "pvp", "reperform"]);
  });

  test("pre-asta si aggancia all'asta via indirizzo", () => {
    const out = deduplica([
      imm({ fonte: "reperform", idEsterno: "r9", comune: "Milano", indirizzoRaw: "V.le Monza 12", mq: 82, locali: 3, tipoVendita: "pre_asta" }),
      imm({ fonte: "pvp", idEsterno: "v9", comune: "MILANO", indirizzoRaw: "Viale Monza, 12", mq: 80, locali: 3, tribunale: "Milano", annoRge: 2026, numeroRge: 77, prezzo: 95000, tipoPrezzo: "base_asta" }),
    ], REG);
    assert.equal(out.length, 1);
    assert.equal(out[0]!.numeroRge, 77);
    assert.equal(out[0]!.tipoVendita, "pre_asta");
  });

  test("beni diversi allo stesso civico restano separati", () => {
    const out = deduplica([
      imm({ fonte: "pvp", idEsterno: "1", comune: "Milano", indirizzoRaw: "Via Bergamo 7", mq: 60, locali: 2 }),
      imm({ fonte: "pvp", idEsterno: "2", comune: "Milano", indirizzoRaw: "Via Bergamo 7", mq: 140, locali: 5 }),
    ], REG);
    assert.equal(out.length, 2);
  });

  test("la conformita' piu' prudente vince", () => {
    const b = { comune: "Milano", indirizzoRaw: "Via Tal 1", mq: 70, locali: 3 };
    const out = deduplica([
      imm({ fonte: "portale", idEsterno: "1", conformitaUrb: "conforme", ...b }),
      imm({ fonte: "pvp", idEsterno: "2", conformitaUrb: "insanabile", ...b }),
    ], REG);
    assert.equal(out[0]!.conformitaUrb, "insanabile");
  });

  test("mq discordanti finiscono in noteMerge, non in una media", () => {
    const out = deduplica([
      imm({ fonte: "pvp", idEsterno: "1", mq: 80, tribunale: "Milano", annoRge: 2025, numeroRge: 9 }),
      imm({ fonte: "portale", idEsterno: "2", mq: 95, tribunale: "Milano", annoRge: 2025, numeroRge: 9 }),
    ], REG);
    assert.equal(out[0]!.mq, 80);
    assert.ok(out[0]!.noteMerge!.some((n) => n.includes("mq")));
  });

  test("record senza chiavi non vengono fusi per errore", () => {
    const out = deduplica([imm({ fonte: "a", idEsterno: "1" }), imm({ fonte: "b", idEsterno: "2" })], REG);
    assert.equal(out.length, 2);
  });

  test("chiave giudiziaria normalizzata", () => {
    assert.equal(
      chiaveGiudiziaria(imm({ fonte: "x", idEsterno: "1", tribunale: "Tribunale di Milano", annoRge: 2025, numeroRge: 12, numeroLotto: "a" })),
      chiaveGiudiziaria(imm({ fonte: "y", idEsterno: "2", tribunale: "MILANO", annoRge: 2025, numeroRge: 12, numeroLotto: "A" })),
    );
  });
});

describe("valutazione", () => {
  const quotazioni = new Map<string, QuotazioneOmi>([
    ["F205|B1|Abitazioni civili", { vendMin: 3000, vendMax: 3600, semestre: "2026-1" }],
  ]);
  const oggi = new Date(Date.UTC(2026, 7, 5));
  const b = (o: Partial<ImmobileNorm> = {}): ImmobileNorm =>
    imm({ fonte: "pvp", idEsterno: "x", comune: "Milano", comuneCod: "F205", zonaOmi: "B1", mq: 100, prezzo: 200000, tipoPrezzo: "base_asta", ...o });

  test("divergenza blocca il valore centrale", () => {
    const v = valuta(b({ valorePerizia: 180000 }), { quotazioni, oggi });
    assert.equal(v.valoreCentrale, null);
    assert.ok(v.flags.some((f) => f.tipo === "divergenza_valutativa"));
    assert.equal(v.scontoSuValore, null, "senza valore centrale non si calcola lo sconto");
  });

  test("stime coerenti producono un valore", () => {
    const v = valuta(b({ valorePerizia: 320000 }), { quotazioni, oggi });
    assert.ok(v.valoreCentrale && v.valoreCentrale > 0);
    assert.ok(v.divergenza! < PARAMETRI_DEFAULT.sogliaDivergenza);
    assert.ok(v.scontoSuValore! > 0.3);
  });

  test("hard filter temporale dipende dalla strategia", () => {
    const i = b({ valorePerizia: 320000, termineOfferte: "2026-08-20" });
    assert.equal(valuta(i, { quotazioni, oggi, strategia: "flip" }).praticabile, true);
    assert.equal(valuta(i, { quotazioni, oggi, strategia: "cambio_uso" }).praticabile, false);
  });

  test("termine passato", () => {
    const v = valuta(b({ valorePerizia: 320000, termineOfferte: "01/07/2026" }), { quotazioni, oggi });
    assert.ok(v.flags.some((f) => f.tipo === "scaduto"));
  });

  test("abuso insanabile azzera frazionamento ma non flip", () => {
    const i = b({ valorePerizia: 320000, conformitaUrb: "insanabile" });
    assert.equal(valuta(i, { quotazioni, oggi, strategia: "frazionamento" }).praticabile, false);
    assert.equal(valuta(i, { quotazioni, oggi, strategia: "flip" }).praticabile, true);
  });

  test("stima singola segnalata", () => {
    const v = valuta(b({ comuneCod: null, valorePerizia: 300000 }), { quotazioni, oggi });
    assert.ok(v.flags.some((f) => f.tipo === "stima_singola"));
  });

  test("nessuna base di stima", () => {
    const v = valuta(b({ comuneCod: null, mq: null, valorePerizia: null }), { quotazioni, oggi });
    assert.ok(v.flags.some((f) => f.tipo === "dato_mancante"));
    assert.equal(v.valoreCentrale, null);
  });

  test("comparabili sotto i 3 non entrano nella stima", () => {
    const v = valuta(b({ comuneCod: null, valorePerizia: 300000 }), { quotazioni, oggi, compsMq: 3500, nComps: 2 });
    assert.equal(v.stime.length, 1);
  });

  test("bassa liquidita' segnalata", () => {
    const v = valuta(b({ valorePerizia: 320000 }), { quotazioni, oggi, ntn: 12 });
    assert.ok(v.flags.some((f) => f.tipo === "bassa_liquidita"));
  });

  test("vincolo culturale segnalato senza bloccare", () => {
    const v = valuta(b({ valorePerizia: 320000, vincoloCulturale: true }), { quotazioni, oggi });
    assert.ok(v.flags.some((f) => f.tipo === "vincolo_culturale"));
    assert.equal(v.praticabile, true);
  });
});
