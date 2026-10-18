import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { candidatiBinarioA, oggiInItalia, valutaBinarioA } from "./binarioA.js";
import type { ImmobileRow } from "./repository.js";

const OGGI = "2026-10-18";
const riga = (r: Partial<ImmobileRow>): ImmobileRow =>
  ({
    id: 1,
    fonte: "portale_vendite_pubbliche",
    titolo: "",
    mq: null,
    sottotipo_asset: null,
    n_esperimenti_deserti: 1,
    termine_offerte: "2026-11-17",
    data_asta: null,
    ...r,
  }) as ImmobileRow;

describe("filtro del binario A (decisione del 18/10/2026)", () => {
  test("ufficio di 255 mq a Milano gia' deserto: candidato per superficie e cambio d'uso (lotto 4626200)", () => {
    const e = valutaBinarioA(riga({ mq: 255, sottotipo_asset: "IMMOBILE_COMMERCIALE / UFFICIO" }), OGGI);
    assert.equal(e.candidato, true);
    assert.deepEqual(e.criteri, ["200 mq", "cambio d'uso"]);
  });
  test("abitazione di 120 mq con magazzino accessorio: niente cambio d'uso, niente binario A", () => {
    const e = valutaBinarioA(riga({ mq: 120, sottotipo_asset: "IMMOBILE_RESIDENZIALE / ABITAZIONE_TIPO_ECO / MAGAZZINI_E_DEPOSITO" }), OGGI);
    assert.equal(e.candidato, false);
    assert.deepEqual(e.criteri, []);
  });
  test("box, negozio sotto i 100 mq: non da binario A; negozio senza superficie: candidato da verificare", () => {
    assert.equal(valutaBinarioA(riga({ mq: 250, sottotipo_asset: "IMMOBILE_COMMERCIALE / GARAGE_AUTORIMESSA" }), OGGI).criteri.includes("cambio d'uso"), false);
    assert.equal(valutaBinarioA(riga({ mq: 63, sottotipo_asset: "IMMOBILE_COMMERCIALE / NEGOZIO" }), OGGI).candidato, false);
    const senzaMq = valutaBinarioA(riga({ sottotipo_asset: "IMMOBILE_COMMERCIALE / NEGOZIO" }), OGGI);
    assert.equal(senzaMq.candidato, true);
    assert.match(senzaMq.avvisi.join(" "), /superficie non letta/);
  });
  test("intero fabbricato o piu' unita' immobiliari: multi-unita'; 'perizia depositata' nel titolo non e' un deposito", () => {
    assert.deepEqual(valutaBinarioA(riga({ titolo: "via Dante 4/6/8 intero fabbricato ad uso commerciale e residenziale" }), OGGI).criteri, ["multi-unita'"]);
    assert.deepEqual(valutaBinarioA(riga({ titolo: "INTERA PROPRIETÀ DI DIVERSE UNITÀ IMMOBILIARI" }), OGGI).criteri, ["multi-unita'"]);
    assert.deepEqual(valutaBinarioA(riga({ mq: 150, titolo: "Appartamento, perizia depositata", sottotipo_asset: "A/3" }), OGGI).criteri, []);
  });
  test("mai andato deserto o termine scaduto: escluso; deserte non note: da verificare, non candidato", () => {
    const grande = { mq: 300, sottotipo_asset: "IMMOBILE_RESIDENZIALE / ABITAZIONE_IN_VILLE" };
    const mai = valutaBinarioA(riga({ ...grande, n_esperimenti_deserti: 0 }), OGGI);
    assert.equal(mai.candidato || mai.daVerificare, false);
    const ignoto = valutaBinarioA(riga({ ...grande, n_esperimenti_deserti: null }), OGGI);
    assert.equal(ignoto.candidato, false);
    assert.equal(ignoto.daVerificare, true);
    assert.match(ignoto.avvisi.join(" "), /deserte non note/);
    const scaduto = valutaBinarioA(riga({ ...grande, termine_offerte: "2026-10-01" }), OGGI);
    assert.equal(scaduto.candidato || scaduto.daVerificare, false);
  });
  test("zero deserte senza termine (dettaglio PVP mai aperto, lotto 4607450 di Carate, 441 mq a 33.550): da verificare", () => {
    const e = valutaBinarioA(riga({ mq: 441, n_esperimenti_deserti: 0, termine_offerte: null, data_asta: "2026-11-20", sottotipo_asset: "IMMOBILE_RESIDENZIALE / APPARTAMENTO" }), OGGI);
    assert.equal(e.candidato, false);
    assert.equal(e.daVerificare, true);
    assert.match(e.avvisi.join(" "), /dettaglio non aperto/);
    assert.match(e.avvisi.join(" "), /offerte chiudono prima/);
  });
  test("villa o grande abitazione gia' deserta senza superficie letta: da verificare (Villasanta, Pieve Emanuele)", () => {
    assert.equal(valutaBinarioA(riga({ sottotipo_asset: "IMMOBILE_RESIDENZIALE / ABITAZIONE_IN_VILLE", prezzo: 399000 }), OGGI).daVerificare, true);
    assert.equal(valutaBinarioA(riga({ sottotipo_asset: "IMMOBILE_RESIDENZIALE / APPARTAMENTO", prezzo: 636800 }), OGGI).daVerificare, true);
    assert.equal(valutaBinarioA(riga({ sottotipo_asset: "IMMOBILE_RESIDENZIALE / APPARTAMENTO", prezzo: 150000 }), OGGI).daVerificare, false);
  });
  test("quota parziale, usufrutto, diritto di superficie: mai candidato, da verificare; la quota del cortile non conta", () => {
    const grande = { mq: 300, sottotipo_asset: "IMMOBILE_RESIDENZIALE / ABITAZIONE_IN_VILLE" };
    for (const titolo of ["quota pari a 1/2 di villetta", "usufrutto appartamento", "diritto di superficie per 90 anni"]) {
      const e = valutaBinarioA(riga({ ...grande, titolo }), OGGI);
      assert.equal(e.candidato, false, titolo);
      assert.equal(e.daVerificare, true, titolo);
    }
    assert.equal(valutaBinarioA(riga({ ...grande, titolo: "magazzino oltre quota di 2/6 di aree esterne" }), OGGI).candidato, true);
    assert.equal(valutaBinarioA(riga({ ...grande, titolo: "per la quota di 1000/1000 di piena proprietà" }), OGGI).candidato, true);
  });
  test("multi-unita': frazionato, bifamiliare, negozio con soprastante abitazione; non il condominio di 40 unita', non una sola unita'", () => {
    for (const titolo of ["frazionato in 4 unità", "villa bifamiliare", "negozio mq 67 oltre a soprastante abitazione 104 mq", "n. 2 negozi"]) {
      assert.deepEqual(valutaBinarioA(riga({ titolo }), OGGI).criteri, ["multi-unita'"], titolo);
    }
    assert.deepEqual(valutaBinarioA(riga({ titolo: "bilocale in condominio di 40 unità immobiliari" }), OGGI).criteri, []);
    assert.deepEqual(valutaBinarioA(riga({ titolo: "1 unità immobiliare al piano terra" }), OGGI).criteri, []);
  });
  test("catasto C/2 e D/8 come le categorie PVP equivalenti", () => {
    assert.deepEqual(valutaBinarioA(riga({ mq: 150, sottotipo_asset: "C/2" }), OGGI).criteri, ["cambio d'uso"]);
    assert.deepEqual(valutaBinarioA(riga({ mq: 400, sottotipo_asset: "D/8" }), OGGI).criteri, ["200 mq", "cambio d'uso"]);
  });
  test("oggi in Italia, non in UTC: alle 00:30 del 19 ottobre e' gia' il 19", () => {
    assert.equal(oggiInItalia(new Date("2026-10-18T22:30:00Z")), "2026-10-19");
  });
  test("elenco: canale statale escluso, ordine per termine", () => {
    const lista = candidatiBinarioA(
      [
        riga({ id: 1, mq: 300, termine_offerte: "2026-12-11" }),
        riga({ id: 2, mq: 300, termine_offerte: "2026-10-27" }),
        riga({ id: 3, mq: 300, fonte: "demanio" }),
      ],
      OGGI,
    );
    assert.deepEqual(lista.candidati.map((x) => x.riga.id), [2, 1]);
  });
});
