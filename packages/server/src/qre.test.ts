import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { pmax, prezzoMaxQre, valoreMqDaStime } from "./qre.js";

describe("prezzo massimo QRE, binario B", () => {
  test("riproduce il caso di riferimento del documento (100 mq a 4.500 EUR/mq)", () => {
    // docs/economia-deal-binario-b.md: 260k col margine 30%, 286k col 20%
    assert.equal(Math.round(pmax(450_000, 100, 0.3) / 1000), 260);
    assert.equal(Math.round(pmax(450_000, 100, 0.2) / 1000), 286);
  });

  test("tre esiti a seconda di dove cade il prezzo", () => {
    const base = { mq: 100, valoreMq: 4500 };
    assert.equal(prezzoMaxQre({ ...base, prezzo: 250_000 }).esito, "passa");
    assert.equal(prezzoMaxQre({ ...base, prezzo: 275_000 }).esito, "al_limite");
    assert.equal(prezzoMaxQre({ ...base, prezzo: 300_000 }).esito, "scarta");
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

  test("senza prezzo il P_max si calcola comunque: e' il numero da portare in offerta", () => {
    const q = prezzoMaxQre({ mq: 100, valoreMq: 4500, prezzo: null });
    assert.equal(q.esito, "dati_mancanti");
    assert.ok(q.pmaxTetto! > 0);
  });

  test("un valore troppo basso per coprire i lavori da' P_max zero, non negativo", () => {
    const q = prezzoMaxQre({ mq: 100, valoreMq: 400, prezzo: 10_000 });
    assert.equal(q.pmaxObiettivo, 0);
    assert.equal(q.esito, "scarta");
  });

  test("la base e' il massimo OMI, non la media", () => {
    const stime = [
      { metodo: "omi_min" as const, valoreMq: 3100, valoreTotale: 310_000, confidenza: 0.55, nota: "" },
      { metodo: "omi_max" as const, valoreMq: 3800, valoreTotale: 380_000, confidenza: 0.55, nota: "" },
    ];
    assert.equal(valoreMqDaStime(stime), 3800);
    assert.equal(valoreMqDaStime([]), null);
  });
});
