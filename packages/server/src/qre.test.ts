import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  irrDaMargine, margine, margineDaIrr, MOLTIPLICATORE_DEFAULT, PARAMETRI_QRE_B, prezzoMassimo, prezzoMaxQre, valoreMqDaStime,
} from "./qre.js";

const k = (v: number | null): number => Math.round(v! / 1000);

describe("prezzo massimo: il piu' severo fra margine, IRR e stress test", () => {
  test("riproduce il caso di riferimento del documento (100 mq a 4.500 EUR/mq, 12 mesi)", () => {
    const r = prezzoMassimo(450_000, 100, 0.3, true);
    assert.equal(k(r.prezzo), 260);
    assert.equal(r.vincolo, "margine");
  });

  test("al prezzo massimo il margine e' esattamente quello richiesto", () => {
    const { prezzo } = prezzoMassimo(450_000, 100, 0.3, true);
    const m = margine(prezzo, 100, { valore: 450_000, mesi: 12, fattoreLavori: 1 }, PARAMETRI_QRE_B);
    assert.ok(Math.abs(m - 0.3) < 1e-9);
  });

  test("sul tetto al 20% lega lo stress test, non il margine", () => {
    // margine 20% darebbe 286k; uscita -15%, lavori +15% e +6 mesi a capitale salvo ne reggono 285k
    const r = prezzoMassimo(450_000, 100, 0.2, true);
    assert.equal(r.vincolo, "stress");
    assert.equal(k(r.prezzo), 285);
  });

  test("con la zona non risolta lo stress si fa piu' severo e abbassa l'offerta", () => {
    const r = prezzoMassimo(450_000, 100, 0.3, false);
    assert.equal(r.vincolo, "stress");
    assert.equal(k(r.prezzo), 245);
  });

  test("su un'operazione lunga lega l'IRR: un 30% in tre anni non basta", () => {
    const r = prezzoMassimo(450_000, 100, 0.3, true, { ...PARAMETRI_QRE_B, mesi: 36 });
    assert.equal(r.vincolo, "irr");
    assert.ok(r.prezzo < prezzoMassimo(450_000, 100, 0.3, true).prezzo);
  });

  test("IRR e margine sono l'uno l'inverso dell'altro", () => {
    assert.ok(Math.abs(irrDaMargine(margineDaIrr(0.12, 30), 30) - 0.12) < 1e-12);
  });
});

describe("esito: il prezzo che conta e' quello atteso di aggiudicazione", () => {
  const base = { mq: 100, valoreMq: 4500 };

  test("passa se anche l'aggiudicazione attesa (1,20 x base) sta entro l'offerta", () => {
    const q = prezzoMaxQre({ ...base, prezzo: 200_000 });
    assert.equal(q.prezzoAtteso, 240_000);
    assert.equal(q.esito, "passa");
  });

  test("al limite fra offerta e tetto", () => {
    assert.equal(prezzoMaxQre({ ...base, prezzo: 220_000 }).esito, "al_limite");
  });

  test("una base che passerebbe da sola diventa 'solo con poca concorrenza'", () => {
    // 250k di base sta sotto l'offerta di 260k, ma l'asta attesa chiude a 300k
    const q = prezzoMaxQre({ ...base, prezzo: 250_000 });
    assert.equal(q.esito, "solo_poca_concorrenza");
  });

  test("in giudiziaria si entra a tre quarti della base", () => {
    const entra = prezzoMaxQre({ ...base, prezzo: 360_000, giudiziaria: true });
    assert.equal(entra.prezzoIngresso, 270_000);
    assert.equal(entra.esito, "solo_poca_concorrenza");
    assert.equal(prezzoMaxQre({ ...base, prezzo: 400_000, giudiziaria: true }).esito, "scarta");
  });

  test("il moltiplicatore calibrato sostituisce il default", () => {
    const q = prezzoMaxQre({ ...base, prezzo: 250_000, moltiplicatore: { valore: 1, n: 8, fonte: "test" } });
    assert.equal(q.esito, "passa");
    assert.equal(q.dettaglio.moltiplicatore.n, 8);
  });

  test("il dettaglio porta margine e IRR all'offerta, base e stress, con le ipotesi", () => {
    const q = prezzoMaxQre({ ...base, prezzo: 200_000 });
    assert.ok(Math.abs(q.dettaglio.base!.margine - 0.3) < 1e-9);
    assert.ok(q.dettaglio.stress!.margine < q.dettaglio.base!.margine);
    assert.ok(q.dettaglio.ipotesi.length > 0);
    assert.equal(q.dettaglio.moltiplicatore, MOLTIPLICATORE_DEFAULT);
  });

  test("fuori taglio i numeri restano calcolati, ma l'esito lo dice", () => {
    const q = prezzoMaxQre({ mq: 220, valoreMq: 4500, prezzo: 100_000 });
    assert.equal(q.esito, "fuori_taglio");
    assert.ok(q.pmaxObiettivo! > 0);
  });

  test("senza quotazione OMI non si inventa un prezzo", () => {
    const q = prezzoMaxQre({ mq: 100, valoreMq: null, prezzo: 200_000 });
    assert.equal(q.esito, "dati_mancanti");
    assert.equal(q.pmaxObiettivo, null);
  });

  test("senza prezzo l'offerta massima si calcola comunque", () => {
    const q = prezzoMaxQre({ ...base, prezzo: null });
    assert.equal(q.esito, "dati_mancanti");
    assert.equal(k(q.pmaxObiettivo), 260);
  });

  test("un valore troppo basso per coprire i lavori da' zero, non un prezzo negativo", () => {
    const q = prezzoMaxQre({ mq: 100, valoreMq: 400, prezzo: 10_000 });
    assert.equal(q.pmaxObiettivo, 0);
    assert.equal(q.esito, "scarta");
  });

  test("la base del valore e' il massimo OMI, non la media", () => {
    const stime = [
      { metodo: "omi_min" as const, valoreMq: 3100, valoreTotale: 310_000, confidenza: 0.55, nota: "" },
      { metodo: "omi_max" as const, valoreMq: 3800, valoreTotale: 380_000, confidenza: 0.55, nota: "" },
    ];
    assert.equal(valoreMqDaStime(stime), 3800);
    assert.equal(valoreMqDaStime([]), null);
  });
});
