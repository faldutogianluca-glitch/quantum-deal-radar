import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  irrDaMargine, margine, margineDaIrr, MOLTIPLICATORE_DEFAULT, PARAMETRI_QRE_B, prezzoMassimo, prezzoMaxQre, valoreMqDaStime,
} from "./qre.js";

const k = (v: number | null): number => Math.round(v! / 1000);

describe("prezzo massimo: il piu' severo fra margine, IRR e stress test", () => {
  test("riproduce il caso di riferimento del documento (100 mq a 4.500 EUR/mq, 12 mesi)", () => {
    const r = prezzoMassimo(450_000, 100, 0.3, 0.15);
    assert.equal(k(r.prezzo), 260);
    assert.equal(r.vincolo, "margine");
  });

  test("al prezzo massimo il margine e' esattamente quello richiesto", () => {
    const { prezzo } = prezzoMassimo(450_000, 100, 0.3, 0.15);
    const m = margine(prezzo, 100, { valore: 450_000, mesi: 12, fattoreLavori: 1 }, PARAMETRI_QRE_B);
    assert.ok(Math.abs(m - 0.3) < 1e-9);
  });

  test("sul tetto al 20% lega lo stress test, non il margine", () => {
    // margine 20% darebbe 286k; uscita -15%, lavori +15% e +6 mesi a capitale salvo ne reggono 285k
    const r = prezzoMassimo(450_000, 100, 0.2, 0.15);
    assert.equal(r.vincolo, "stress");
    assert.equal(k(r.prezzo), 285);
  });

  test("con la zona non risolta lo stress si fa piu' severo e abbassa l'offerta", () => {
    const r = prezzoMassimo(450_000, 100, 0.3, 0.25);
    assert.equal(r.vincolo, "stress");
    assert.equal(k(r.prezzo), 245);
  });

  test("su un'operazione lunga lega l'IRR: un 30% in tre anni non basta", () => {
    const r = prezzoMassimo(450_000, 100, 0.3, 0.15, { ...PARAMETRI_QRE_B, mesi: 36 });
    assert.equal(r.vincolo, "irr");
    assert.ok(r.prezzo < prezzoMassimo(450_000, 100, 0.3, 0.15).prezzo);
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

  test("in trattativa il prezzo richiesto si negozia al ribasso, non sale come in asta", () => {
    // 275k richiesti sembrerebbero sopra l'offerta di 260k, ma si chiude a 256,6k
    const q = prezzoMaxQre({ ...base, prezzo: 275_000, trattativa: true });
    assert.equal(q.prezzoAtteso, Math.round(275_000 * 0.933));
    assert.equal(q.prezzoIngresso, q.prezzoAtteso);
    assert.equal(q.esito, "passa");
    assert.match(q.motivo, /richiesta/);
  });

  test("in trattativa fuori tetto dice quanto sconto servirebbe, e non parla di concorrenza", () => {
    const q = prezzoMaxQre({ ...base, prezzo: 400_000, trattativa: true });
    assert.equal(q.esito, "scarta");
    assert.match(q.motivo, /35% di sconto sulla richiesta/);
  });

  test("in giudiziaria sotto la base segnala il rischio di assegnazione", () => {
    const q = prezzoMaxQre({ ...base, prezzo: 360_000, giudiziaria: true });
    assert.match(q.motivo, /assegnazione/);
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

describe("perimetro del binario B e zona non risolta", () => {
  test("riconosce diritti parziali e categorie non residenziali", async () => {
    const { motivoFuoriPerimetro } = await import("./qre.js");
    assert.match(motivoFuoriPerimetro("USUFRUTTO DI APPARTAMENTO IN MILANO", "A2")!, /diritto parziale/);
    assert.match(motivoFuoriPerimetro("LOTTO 5 - QUOTA DI 4/18 DI APPARTAMENTO", "A3")!, /diritto parziale/);
    assert.match(motivoFuoriPerimetro("BOX IN MANERBIO", "C6")!, /C\/6/);
    assert.match(motivoFuoriPerimetro("UFFICIO", "A/10")!, /A\/10/);
    assert.equal(motivoFuoriPerimetro("APPARTAMENTO E BOX IN BERGAMO", "A2"), null, "il box di pertinenza non esclude");
    assert.equal(motivoFuoriPerimetro("APPARTAMENTO", null), null);
  });

  test("senza zona il massimo OMI comunale non diventa un valore di uscita", () => {
    const q = prezzoMaxQre({ mq: 66, prezzo: 250_000, valoreMq: 13_000, zonaRisolta: false });
    assert.equal(q.esito, "dati_mancanti");
    assert.equal(q.pmaxObiettivo, null);
    assert.match(q.motivo, /zona OMI non risolta/);
  });
});

describe("quote di proprieta' nei titoli reali", () => {
  test("l'intero non e' una quota, un accessorio nemmeno, un civico doppio nemmeno", async () => {
    const { motivoFuoriPerimetro: m } = await import("./qre.js");
    assert.equal(m("PIENA PROPRIETA' PER LA QUOTA DI 1/1 DI APPARTAMENTO", "A3"), null);
    assert.equal(m("appartamento, quota di 1000/1000 della proprieta'", "A3"), null);
    assert.equal(m("APPARTAMENTO CON QUOTA DI COMPROPRIETA' DEL CORTILE", "A3"), null);
    assert.equal(m("APPARTAMENTO IN VIA ROMA 12/14 DI MILANO", "A3"), null);
  });
  test("le quote vere si riconoscono in tutte le forme", async () => {
    const { motivoFuoriPerimetro: m } = await import("./qre.js");
    assert.ok(m("QUOTA DI 1/3 DI APPARTAMENTO IN TALAMONA", "A3"));
    assert.ok(m("1/2 DELLA PIENA PROPRIETA' DI APPARTAMENTO", "A3"));
    assert.ok(m("PROPRIETA' PER 1/2 DI VILLETTA", "A7"));
    assert.ok(m("LOTTO 5 - QUOTA DI 4/18 DI APPARTAMENTO E CANTINA", "A3"));
  });
  test("un usufrutto senza zona e' fuori perimetro, non 'dati mancanti'", () => {
    const q = prezzoMaxQre({ mq: 80, prezzo: 100_000, valoreMq: null, zonaRisolta: false, fuoriPerimetro: "diritto parziale" });
    assert.equal(q.esito, "fuori_perimetro");
  });
});
