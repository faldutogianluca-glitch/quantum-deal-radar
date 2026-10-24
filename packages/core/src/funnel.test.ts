/**
 * Misura del funnel (blocco 5). Tutti i dati sono SINTETICI: servono a provare il calcolo,
 * non provano nessun esito commerciale. I valori attesi sono calcolati a mano nei commenti.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  eLavorativo, esitoFeedback, esitoOfferta, festivita, finestraOfferta, metrichePilota, POLITICA_PUBBLICA,
  scadenzaFeedback, type PoliticaSla, type Segnalazione,
} from "./funnel.js";

const lavorativa: PoliticaSla = { ...POLITICA_PUBBLICA, giorniFeedback: "lavorativi", giorniOfferta: "lavorativi" };
const t = (s: string) => new Date(s);

describe("calendario", () => {
  test("Pasqua e Pasquetta degli anni vicini (date note)", () => {
    // Pasqua: 2025-04-20, 2026-04-05, 2027-03-28, 2028-04-16; il giorno dopo e' festivo
    for (const [anno, pasquetta] of [[2025, "2025-04-21"], [2026, "2026-04-06"], [2027, "2027-03-29"], [2028, "2028-04-17"]] as const) {
      assert.ok(festivita(anno).has(pasquetta), `Pasquetta ${anno}`);
    }
  });
  test("festivita' fisse e weekend non sono lavorativi", () => {
    assert.equal(eLavorativo(t("2026-12-08T10:00:00Z")), false, "Immacolata (martedi')");
    assert.equal(eLavorativo(t("2026-10-24T10:00:00Z")), false, "sabato");
    assert.equal(eLavorativo(t("2026-10-26T10:00:00Z")), true, "lunedi'");
  });
});

describe("scadenze", () => {
  test("48 ore solari partendo da un venerdi' alle 10:00: scade domenica alle 10:00", () => {
    assert.equal(scadenzaFeedback(t("2026-10-23T10:00:00Z")).toISOString(), "2026-10-25T10:00:00.000Z");
  });
  test("48 ore lavorative dal venerdi' alle 10:00: 14 ore il venerdi' + 24 il lunedi' + 10 il martedi' = martedi' alle 10:00", () => {
    assert.equal(scadenzaFeedback(t("2026-10-23T10:00:00Z"), lavorativa).toISOString(), "2026-10-27T10:00:00.000Z");
  });
  test("offerta, giorni solari: documenti completi lunedi' 2/11 -> dal 9/11 al 12/11", () => {
    const f = finestraOfferta(t("2026-11-02T09:00:00Z"));
    assert.equal(f.dal.toISOString().slice(0, 10), "2026-11-09");
    assert.equal(f.entro.toISOString().slice(0, 10), "2026-11-12");
  });
  test("offerta, giorni lavorativi: dal 11/11 (settimo) al 16/11 (decimo), saltando il weekend", () => {
    const f = finestraOfferta(t("2026-11-02T09:00:00Z"), lavorativa);
    assert.equal(f.dal.toISOString().slice(0, 10), "2026-11-11");
    assert.equal(f.entro.toISOString().slice(0, 10), "2026-11-16");
  });
  test("un festivo infrasettimanale non conta: lunedi' 7/12 + 1 giorno lavorativo = mercoledi' 9/12 (l'8 e' festa)", () => {
    const f = finestraOfferta(t("2026-12-07T09:00:00Z"), { ...lavorativa, giorniOffertaMin: 1, giorniOffertaMax: 1 });
    assert.equal(f.dal.toISOString().slice(0, 10), "2026-12-09");
  });
});

const base = (o: Partial<Segnalazione> = {}): Segnalazione => ({
  id: "s", canale: "agente", inTarget: true, fonteCompleta: true, ricevutaIl: "2026-11-02T09:00:00Z", completaIl: null,
  feedbackIl: null, verdetto: null, documentiCompletiIl: null, offertaIl: null, acquisitoIl: null, ...o,
});

describe("esito dello SLA", () => {
  test("feedback in tempo, in ritardo, in corso, non misurabile", () => {
    const adesso = t("2026-11-03T09:00:00Z");
    assert.equal(esitoFeedback(base({ feedbackIl: "2026-11-03T08:00:00Z" }), adesso), "in_tempo");
    assert.equal(esitoFeedback(base({ feedbackIl: "2026-11-04T10:00:00Z" }), adesso), "in_ritardo");
    assert.equal(esitoFeedback(base(), adesso), "in_corso");
    assert.equal(esitoFeedback(base(), t("2026-11-05T09:00:00Z")), "in_ritardo");
    assert.equal(esitoFeedback(base({ ricevutaIl: null }), adesso), "non_misurabile");
  });
  test("l'orologio parte da 'completa' se la segnalazione era incompleta alla ricezione", () => {
    // ricevuta il 2/11 incompleta, completata il 4/11 alle 09:00: scade il 6/11 alle 09:00
    const s = base({ completaIl: "2026-11-04T09:00:00Z", feedbackIl: "2026-11-05T09:00:00Z" });
    assert.equal(esitoFeedback(s, t("2026-11-10T00:00:00Z")), "in_tempo");
  });
  test("l'offerta si misura solo con i documenti completi", () => {
    assert.equal(esitoOfferta(base(), t("2026-12-31T00:00:00Z")), "non_misurabile");
    const s = base({ documentiCompletiIl: "2026-11-02T09:00:00Z", offertaIl: "2026-11-11T09:00:00Z" });
    assert.equal(esitoOfferta(s, t("2026-12-31T00:00:00Z")), "in_tempo");
    assert.equal(esitoOfferta({ ...s, offertaIl: "2026-11-13T09:00:00Z" }, t("2026-12-31T00:00:00Z")), "in_ritardo");
  });
});

describe("metriche del pilota (dati sintetici)", () => {
  const finestra = { dal: "2026-11-02T00:00:00Z", al: "2026-11-30T23:59:59Z" };
  const adesso = t("2026-12-15T00:00:00Z");

  test("zero eventi: conclusione esplicita di non-prova", () => {
    const m = metrichePilota([], finestra, adesso);
    assert.equal(m.conclusione, "nessun_evento");
    assert.equal(m.percentualeFeedbackInTempo, null);
    assert.match(m.avvertenza, /nulla viene dimostrato/);
  });

  test("campione sotto il minimo: indicativo, mai un successo", () => {
    const campione = Array.from({ length: 5 }, (_, i) => base({ id: `c${i}`, feedbackIl: "2026-11-03T08:00:00Z" }));
    const m = metrichePilota(campione, finestra, adesso);
    assert.equal(m.conclusione, "campione_insufficiente");
    assert.equal(m.percentualeFeedbackInTempo, 100, "il numero c'e', ma l'avvertenza lo declassa");
    assert.match(m.avvertenza, /non provano successo/);
  });

  test("campione sufficiente: percentuali e passaggi calcolati per canale", () => {
    // 20 agenti: 15 in tempo (feedback dopo 10 ore), 5 in ritardo (feedback dopo 60 ore)
    // 8 arrivano ai documenti, 3 all'offerta, 1 all'acquisizione. 4 proprietari, tutti in tempo.
    const agenti = Array.from({ length: 20 }, (_, i) =>
      base({
        id: `a${i}`, canale: "agente", ricevutaIl: "2026-11-03T08:00:00Z",
        feedbackIl: i < 15 ? "2026-11-03T18:00:00Z" : "2026-11-06T20:00:00Z",
        documentiCompletiIl: i < 8 ? "2026-11-10T09:00:00Z" : null,
        offertaIl: i < 3 ? "2026-11-17T09:00:00Z" : null,
        acquisitoIl: i < 1 ? "2026-12-01T09:00:00Z" : null,
      }),
    );
    const proprietari = Array.from({ length: 4 }, (_, i) =>
      base({ id: `p${i}`, canale: "proprietario", ricevutaIl: "2026-11-04T08:00:00Z", feedbackIl: "2026-11-04T20:00:00Z" }),
    );
    const m = metrichePilota([...agenti, ...proprietari], finestra, adesso);
    assert.equal(m.conclusione, "misurato");
    assert.equal(m.totale.segnalazioni, 24);
    assert.equal(m.perCanale.agente!.feedbackInTempo, 15);
    assert.equal(m.perCanale.agente!.feedbackInRitardo, 5);
    assert.equal(m.perCanale.agente!.aDocumenti, 8);
    assert.equal(m.perCanale.agente!.aOfferta, 3);
    assert.equal(m.perCanale.agente!.acquisiti, 1);
    // mediana ore agenti: 15 valori da 10 h e 5 da 60 h -> mediana 10
    assert.equal(m.perCanale.agente!.oreMedianeFeedback, 10);
    assert.equal(m.perCanale.proprietario!.feedbackInTempo, 4);
    // in tempo: 15 + 4 = 19 su 24 conclusi = 79,166...%
    assert.ok(Math.abs(m.percentualeFeedbackInTempo! - (19 / 24) * 100) < 1e-9);
    assert.match(m.avvertenza, /solo questa finestra/);
  });

  test("le segnalazioni fuori finestra non contano", () => {
    const m = metrichePilota([base({ ricevutaIl: "2026-10-01T09:00:00Z" })], finestra, adesso);
    assert.equal(m.conclusione, "nessun_evento");
  });
});
