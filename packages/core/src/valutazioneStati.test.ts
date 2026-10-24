/**
 * Praticabilita' a tre stati e correttezza del valore centrale (rilievi 2 e 7 della revisione
 * del 24/10/2026). Dati SINTETICI; i valori attesi sono calcolati a mano nei commenti.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { indiceSemestre, valuta, type QuotazioneOmi } from "./valutazione.js";
import type { ImmobileNorm } from "./dedup.js";

const quotazioni = new Map<string, QuotazioneOmi>([
  ["F205|B1|Abitazioni civili", { vendMin: 3000, vendMax: 3600, semestre: "2026-1" }],
]);
const oggi = new Date(Date.UTC(2026, 7, 5)); // 5 agosto 2026: semestre corrente 2026-2
const base = (o: Partial<ImmobileNorm> = {}): ImmobileNorm => ({
  fonte: "pvp", idEsterno: "x", comune: "Milano", comuneCod: "F205", zonaOmi: "B1", mq: 100,
  prezzo: 200000, tipoPrezzo: "base_asta", termineOfferte: "2026-12-31", ...o,
});

describe("tre stati: positivo, negativo, non valutato", () => {
  test("senza nessuna base di stima l'esito e' non valutato, non positivo", () => {
    const v = valuta(base({ comuneCod: null, mq: null, valorePerizia: null }), { quotazioni, oggi });
    assert.equal(v.esito, "non_valutato");
    assert.equal(v.praticabile, null);
    assert.equal(v.datiEconomici, "assenti");
    assert.ok(v.mancanti.length >= 1);
    assert.match(v.mancanti[0]!.prossimoControllo, /perizia|OMI|comparabili/);
  });

  test("vendita giudiziaria senza data: non valutato, con motivo e prossimo controllo", () => {
    const v = valuta(base({ valorePerizia: 320000, termineOfferte: null, dataAsta: null }), { quotazioni, oggi });
    assert.equal(v.esito, "non_valutato");
    assert.equal(v.praticabile, null);
    assert.ok(v.flags.some((f) => f.tipo === "termine_mancante"));
    assert.ok(v.mancanti.some((m) => /avviso di vendita/.test(m.prossimoControllo)));
  });

  test("vendita non giudiziaria senza data: la data non e' indispensabile", () => {
    const v = valuta(base({ tipoPrezzo: "richiesta_reoco", valorePerizia: 320000, termineOfferte: null }), { quotazioni, oggi });
    assert.equal(v.esito, "positivo");
  });

  test("una data illeggibile non vale come termine lontano", () => {
    const v = valuta(base({ valorePerizia: 320000, termineOfferte: "tra poco" }), { quotazioni, oggi });
    assert.equal(v.esito, "non_valutato");
    assert.ok(v.flags.some((f) => f.tipo === "termine_illeggibile"));
  });

  test("termine scaduto: negativo, anche con dati completi", () => {
    const v = valuta(base({ valorePerizia: 320000, termineOfferte: "2026-07-01" }), { quotazioni, oggi });
    assert.equal(v.esito, "negativo");
    assert.equal(v.praticabile, false);
    assert.equal(v.vincoli, "bloccanti");
  });

  test("stime divergenti: non valutato, nessun valore centrale", () => {
    const v = valuta(base({ valorePerizia: 180000 }), { quotazioni, oggi });
    assert.equal(v.valoreCentrale, null);
    assert.equal(v.esito, "non_valutato");
    assert.ok(v.mancanti.some((m) => /revisione umana/.test(m.prossimoControllo)));
  });

  test("dati completi e nessun blocco: positivo", () => {
    const v = valuta(base({ valorePerizia: 320000 }), { quotazioni, oggi });
    assert.equal(v.esito, "positivo");
    assert.equal(v.praticabile, true);
    assert.equal(v.datiEconomici, "completi");
    assert.equal(v.vincoli, "nessuno_noto");
    assert.equal(v.pesiEuristici, true);
  });

  test("dati economici, vincoli ed esito sono riportati separatamente", () => {
    // economici completi, vincolo bloccante
    const v = valuta(base({ valorePerizia: 320000, termineOfferte: "2026-08-10" }), { quotazioni, oggi, strategia: "cambio_uso" });
    assert.equal(v.datiEconomici, "completi");
    assert.equal(v.vincoli, "bloccanti");
    assert.equal(v.esito, "negativo");
  });
});

describe("OMI come fonte unica", () => {
  // perizia 320.000; OMI 100 mq: min 300.000, max 360.000; confidenze: perizia 0,85, OMI 0,55.
  // Con l'OMI contata UNA volta: i due estremi pesano 0,275 ciascuno.
  // valore = (0,85*320000 + 0,275*300000 + 0,275*360000) / (0,85 + 0,55)
  //        = (272000 + 82500 + 99000) / 1,40 = 453500 / 1,40 = 323928,57
  // (con la doppia pesatura precedente il risultato sarebbe 635000 / 1,95 = 325641,03)
  test("il valore centrale conta l'OMI una sola volta", () => {
    const v = valuta(base({ valorePerizia: 320000 }), { quotazioni, oggi });
    assert.ok(Math.abs(v.valoreCentrale! - 323928.57) < 0.01, `ottenuto ${v.valoreCentrale}`);
  });

  test("l'intervallo OMI si conserva", () => {
    const v = valuta(base({ valorePerizia: 320000 }), { quotazioni, oggi });
    assert.deepEqual(v.intervalloOmi, { min: 300000, max: 360000 });
  });

  test("un solo estremo OMI: segnalato e trattato come punto", () => {
    const solo = new Map<string, QuotazioneOmi>([["F205|B1|Abitazioni civili", { vendMin: 3000, semestre: "2026-1" }]]);
    const v = valuta(base({ valorePerizia: 310000 }), { quotazioni: solo, oggi });
    assert.ok(v.flags.some((f) => f.tipo === "omi_estremo_singolo"));
    assert.deepEqual(v.intervalloOmi, { min: 300000, max: 300000 });
    // (0,85*310000 + 0,55*300000) / 1,40 = (263500 + 165000) / 1,40 = 306071,43
    assert.ok(Math.abs(v.valoreCentrale! - 306071.43) < 0.01, `ottenuto ${v.valoreCentrale}`);
  });
});

describe("semestre OMI", () => {
  test("indiceSemestre riconosce i formati e rifiuta il resto", () => {
    assert.equal(indiceSemestre("2026-1"), 4052);
    assert.equal(indiceSemestre("2026_S2"), 4053);
    assert.equal(indiceSemestre("2026/2"), 4053);
    assert.equal(indiceSemestre("?"), null);
    assert.equal(indiceSemestre(undefined), null);
  });

  const piuAvanti = new Date(Date.UTC(2027, 8, 1)); // semestre corrente 2027-2, tre semestri dopo 2026-1

  test("quotazione obsoleta: con la politica predefinita l'esito e' non valutato, mai positivo", () => {
    const vecchia = valuta(base({ valorePerizia: 320000, termineOfferte: "2027-12-31" }), { quotazioni, oggi: piuAvanti });
    assert.ok(vecchia.flags.some((f) => f.tipo === "omi_semestre_obsoleto"));
    assert.equal(vecchia.esito, "non_valutato");
    assert.equal(vecchia.praticabile, null);
    assert.ok(vecchia.mancanti.some((m) => /quotazioni OMI/.test(m.prossimoControllo)));
  });

  test("politica 'penalizza' scelta esplicitamente: segnalata e a confidenza ridotta", () => {
    const fresca = valuta(base({ valorePerizia: 320000 }), { quotazioni, oggi });
    const vecchia = valuta(base({ valorePerizia: 320000, termineOfferte: "2027-12-31" }), {
      quotazioni, oggi: piuAvanti, parametri: { semestreOmi: { maxEtaSemestri: 2, obsoleto: "penalizza", sconosciuto: "penalizza", penalita: 0.7 } },
    });
    assert.ok(vecchia.stime.find((s) => s.metodo === "omi_min")!.confidenza < fresca.stime.find((s) => s.metodo === "omi_min")!.confidenza);
  });

  test("politica configurabile: non_valutare rende l'esito non valutato", () => {
    const v = valuta(base({ valorePerizia: 320000, termineOfferte: "2027-12-31" }), {
      quotazioni, oggi: piuAvanti, parametri: { semestreOmi: { maxEtaSemestri: 2, obsoleto: "non_valutare", sconosciuto: "avvisa", penalita: 0.7 } },
    });
    assert.equal(v.esito, "non_valutato");
    assert.ok(v.mancanti.some((m) => /quotazioni OMI/.test(m.prossimoControllo)));
  });

  test("politica 'avvisa': solo il flag, confidenza invariata", () => {
    const fresca = valuta(base({ valorePerizia: 320000 }), { quotazioni, oggi });
    const v = valuta(base({ valorePerizia: 320000, termineOfferte: "2027-12-31" }), {
      quotazioni, oggi: piuAvanti, parametri: { semestreOmi: { maxEtaSemestri: 2, obsoleto: "avvisa", sconosciuto: "avvisa", penalita: 0.7 } },
    });
    assert.ok(v.flags.some((f) => f.tipo === "omi_semestre_obsoleto"));
    assert.equal(v.stime.find((s) => s.metodo === "omi_min")!.confidenza, fresca.stime.find((s) => s.metodo === "omi_min")!.confidenza);
  });

  test("semestre sconosciuto: segnalato", () => {
    const q = new Map<string, QuotazioneOmi>([["F205|B1|Abitazioni civili", { vendMin: 3000, vendMax: 3600, semestre: "?" }]]);
    const v = valuta(base({ valorePerizia: 320000 }), { quotazioni: q, oggi });
    assert.ok(v.flags.some((f) => f.tipo === "omi_semestre_sconosciuto"));
  });
});

describe("prezzo mancante", () => {
  const quot = new Map<string, QuotazioneOmi>([["F205|B1|Abitazioni civili", { vendMin: 3000, vendMax: 3600, semestre: "2026-1" }]]);
  const adesso = new Date(Date.UTC(2026, 7, 5));
  const bene = { fonte: "pvp", idEsterno: "x", comune: "Milano", comuneCod: "F205", zonaOmi: "B1", mq: 100, valorePerizia: 320000, termineOfferte: "2099-12-31", tipoPrezzo: "base_asta" as const };

  for (const prezzo of [null, undefined, 0] as const) {
    test(`prezzo ${String(prezzo)}: non valutato con il dato mancante indicato`, () => {
      const v = valuta({ ...bene, prezzo } as never, { quotazioni: quot, oggi: adesso });
      assert.equal(v.esito, "non_valutato");
      assert.equal(v.praticabile, null);
      assert.ok(v.flags.some((f) => f.tipo === "prezzo_mancante"));
      assert.ok(v.mancanti.some((m) => /prezzo/.test(m.dato)));
    });
  }

  test("con il prezzo lo stesso bene e' positivo", () => {
    assert.equal(valuta({ ...bene, prezzo: 200000 } as never, { quotazioni: quot, oggi: adesso }).esito, "positivo");
  });

  test("prezzo mancante e termine scaduto: resta negativo (il blocco accertato prevale)", () => {
    assert.equal(valuta({ ...bene, prezzo: null, termineOfferte: "2026-01-01" } as never, { quotazioni: quot, oggi: adesso }).esito, "negativo");
  });
});
