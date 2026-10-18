import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  distanzaMetri, medianaPesata, PARAMETRI_COMPARABILI, quantile, statoDaTesto, stimaDaComparabili, type Comparabile,
} from "./comparabili.js";
import { prezzoMaxQre } from "./qre.js";

const OGGI = new Date("2026-10-18T00:00:00Z");
const CENTRO = { lat: 45.47, lon: 9.19 };
let prossimoId = 1;

/** Un comparabile a `nord` metri a nord del centro (0,001 gradi di latitudine sono circa 111 m). */
function comp(campi: Partial<Comparabile> & { nord?: number; eurMq?: number }): Comparabile {
  const { nord = 100, eurMq = 5000, ...resto } = campi;
  const mq = resto.mq ?? 100;
  return {
    id: prossimoId++, fonte: "test", indirizzo: null, comune: "Milano",
    lat: CENTRO.lat + nord / 111_195, lon: CENTRO.lon, zonaOmi: "B7",
    mq, prezzo: eurMq * mq, tipoPrezzo: "richiesta", stato: "ristrutturato", data: "2026-07-01", url: null,
    ...resto,
  };
}

const bersaglio = { ...CENTRO, zonaOmi: "B7", mq: 100 };
/** 5.000 EUR/mq richiesti, riportati al rogito. */
const RIF = Math.round(5000 * PARAMETRI_COMPARABILI.haircutRichiesta);
// a 50 m l'uno dall'altro, oltre la soglia dei duplicati
const buoni = () => [100, 150, 200, 250, 300, 350].map((nord) => comp({ nord }));

describe("comparabili: filtri", () => {
  test("lo stato si riconosce dal testo, e 'da ristrutturare' non e' 'ristrutturato'", () => {
    assert.equal(statoDaTesto("Ottimo / Ristrutturato"), "ristrutturato");
    assert.equal(statoDaTesto("Da ristrutturare"), "da_ristrutturare");
    assert.equal(statoDaTesto("Nuovo / In costruzione"), "nuovo");
    assert.equal(statoDaTesto("Buono / Abitabile"), "buono");
    assert.equal(statoDaTesto(""), null);
  });

  test("restano fuori stato sbagliato, dati vecchi, taglio diverso e distanza, e vengono contati", () => {
    const s = stimaDaComparabili(bersaglio, [
      ...buoni(),
      comp({ stato: "da_ristrutturare" }),
      comp({ stato: null }),
      comp({ data: "2024-01-01" }),
      comp({ data: null }),
      comp({ data: "2027-06-01" }),
      comp({ mq: 300 }),
      comp({ nord: 3000 }),
    ], OGGI);
    assert.equal(s.n, 6);
    assert.deepEqual(s.esclusi, { stato: 2, data: 3, taglio: 1, distanza: 1, duplicati: 0, anomali: 0 });
    assert.equal(s.ambito, "entro 500 m");
    assert.equal(s.affidabile, true);
  });

  test("lo stesso appartamento pubblicato da due agenzie conta una volta, col prezzo piu' recente", () => {
    // stesso palazzo, stessa superficie, prezzo del 6% piu' alto e annuncio piu' vecchio
    const doppione = comp({ nord: 110, mq: 101, eurMq: 5300, data: "2026-03-01" });
    const s = stimaDaComparabili(bersaglio, [...buoni(), doppione], OGGI);
    assert.equal(s.esclusi.duplicati, 1);
    assert.equal(s.n, 6);
    assert.equal(Math.round(s.valoreMq!), RIF);
  });

  test("si allarga a 1 km solo se entro 500 m non bastano", () => {
    const s = stimaDaComparabili(bersaglio, [100, 200, 700, 800, 900].map((nord) => comp({ nord })), OGGI);
    assert.equal(s.ambito, "entro 1000 m");
    assert.equal(s.n, 5);
  });

  test("senza coordinate del bersaglio si usa la stessa zona OMI", () => {
    const s = stimaDaComparabili({ lat: null, lon: null, zonaOmi: "B7", mq: 100 }, [...buoni(), comp({ zonaOmi: "C1" })], OGGI);
    assert.equal(s.ambito, "zona OMI B7");
    assert.equal(s.n, 6);
  });
});

describe("comparabili: omogeneizzazione e stima", () => {
  test("prezzo richiesto riportato al rogito con lo sconto medio di Banca d'Italia", () => {
    const s = stimaDaComparabili(bersaglio, buoni(), OGGI);
    assert.equal(Math.round(s.valoreMq!), Math.round(5000 * PARAMETRI_COMPARABILI.haircutRichiesta));
  });

  test("i rogiti non subiscono l'haircut, il nuovo si riporta al ristrutturato", () => {
    const rogiti = stimaDaComparabili(bersaglio, buoni().map((c) => ({ ...c, tipoPrezzo: "rogito" as const })), OGGI);
    assert.equal(Math.round(rogiti.valoreMq!), 5000);
    const nuovi = stimaDaComparabili(bersaglio, buoni().map((c) => ({ ...c, stato: "nuovo" as const })), OGGI);
    assert.equal(Math.round(nuovi.valoreMq!), Math.round(5000 * PARAMETRI_COMPARABILI.haircutRichiesta * PARAMETRI_COMPARABILI.fattoreNuovo));
  });

  test("un bilocale piu' piccolo del bersaglio vale meno al mq una volta riportato al taglio", () => {
    const piccoli = [100, 150, 200, 250, 300].map((nord) => comp({ nord, mq: 70 }));
    const s = stimaDaComparabili(bersaglio, piccoli, OGGI);
    // (100/70)^-0,1 = 0,965
    assert.equal(Math.round(s.valoreMq!), Math.round(5000 * PARAMETRI_COMPARABILI.haircutRichiesta * (100 / 70) ** -0.1));
  });

  test("un attico da 15.000 EUR/mq non sposta la stima: e' un anomalo", () => {
    const s = stimaDaComparabili(bersaglio, [...buoni(), comp({ nord: 120, eurMq: 15_000 })], OGGI);
    assert.equal(s.esclusi.anomali, 1);
    assert.equal(Math.round(s.valoreMq!), RIF);
  });

  test("pochi comparabili: stima calcolata ma non affidabile", () => {
    const s = stimaDaComparabili(bersaglio, buoni().slice(0, 3), OGGI);
    assert.equal(s.affidabile, false);
    assert.match(s.motivo, /ne servono 5/);
  });

  test("comparabili troppo eterogenei: non affidabile", () => {
    const misti = [3000, 3600, 4300, 5200, 6000, 6600].map((eurMq, i) => comp({ nord: 100 + i * 40, eurMq }));
    const s = stimaDaComparabili(bersaglio, misti, OGGI);
    assert.ok(s.dispersione! > PARAMETRI_COMPARABILI.dispersioneMassima);
    assert.equal(s.affidabile, false);
  });

  test("i comparabili vicini pesano di piu'", () => {
    assert.equal(medianaPesata([{ v: 1, peso: 3 }, { v: 2, peso: 1 }, { v: 3, peso: 1 }]), 1);
    assert.equal(quantile([1, 2, 3, 4], 0.5), 2.5);
    assert.ok(Math.abs(distanzaMetri(CENTRO, { lat: CENTRO.lat + 0.001, lon: CENTRO.lon }) - 111.2) < 0.5);
  });
});

describe("comparabili nel Gate 0 QRE", () => {
  test("se affidabili sostituiscono l'OMI, e lo stress segue la loro dispersione", () => {
    const comps = stimaDaComparabili(bersaglio, buoni(), OGGI);
    const q = prezzoMaxQre({ mq: 100, prezzo: 200_000, valoreMq: 3800, comparabili: comps });
    assert.equal(q.valoreFonte, "comparabili");
    assert.equal(Math.round(q.valoreMq!), RIF);
    // dispersione zero: lo stress resta al minimo del 10%
    assert.equal(q.dettaglio.uscita.stress, 0.1);
    assert.ok(Math.abs(q.dettaglio.uscita.divergenzaOmi! - (q.valoreMq! / 3800 - 1)) < 1e-9);
  });

  test("se non affidabili resta l'OMI, e il motivo finisce fra le ipotesi", () => {
    const comps = stimaDaComparabili(bersaglio, buoni().slice(0, 2), OGGI);
    const q = prezzoMaxQre({ mq: 100, prezzo: 200_000, valoreMq: 3800, comparabili: comps });
    assert.equal(q.valoreFonte, "omi_max");
    assert.match(q.dettaglio.ipotesi[0]!, /comparabili non usati/);
  });

  test("con comparabili affidabili il Gate 0 funziona anche senza quotazione OMI", () => {
    const comps = stimaDaComparabili(bersaglio, buoni(), OGGI);
    const q = prezzoMaxQre({ mq: 100, prezzo: 200_000, valoreMq: null, comparabili: comps });
    assert.equal(q.valoreFonte, "comparabili");
    assert.notEqual(q.esito, "dati_mancanti");
  });
});
