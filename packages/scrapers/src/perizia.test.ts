import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { leggiPerizia, scegliPerizia, testoLeggibile } from "./perizia.js";

/*
 * Brani di perizie vere scaricate dal PVP il 18/10/2026 (Rozzano, Agrate
 * Brianza, Milano via Padova, Arluno, Pozzo d'Adda), con nomi, codici fiscali e
 * indirizzi tolti. Il riempitivo serve a superare la soglia di leggibilita',
 * come fa il resto di una perizia vera.
 */
const RIEMPITIVO = "Il valore della stima per la vendita dell'immobile che il perito indica con la sua relazione. ".repeat(10);
const perizia = (...brani: string[]) => leggiPerizia([RIEMPITIVO, ...brani]);

describe("leggiPerizia: modello del Tribunale di Milano", () => {
  const ROZZANO = `INDICE SINTETICO
Stato occupativo
il bene è risultato occupato e in uso in forza di regolare contratto di locazione
Conformità edilizia
No
Conformità catastale
No
Superficie Catastale Totale: 59 m2, Totale escluse aree scoperte: 57 m2
6.2. Conformità edilizia: NON CONFORME
Appartamento mq. 57,5 100% 57,5
Balcone mq. 4,1 30% 1,2
61,6 58,7
mq. lordi mq. commerciali
9.4. Adeguamenti e correzioni della stima• Valore LOTTO UNICO € 132.075,00
• Riduzione del valore del 5% per assenza di garanzia per vizi -€ 6.603,75
• Spese di regolarizzazione edilizia e catastale -€ 4.000,00
Valore LOTTO UNICO al netto delle decurtazioni € 121.471,25`;

  test("superficie commerciale dalla tabella, non la catastale", () => {
    const p = perizia(ROZZANO);
    assert.equal(p.mq, 58.7);
    assert.equal(p.fonteMq, "tabella_commerciale");
  });
  test("valore del lotto prima delle decurtazioni", () => assert.equal(perizia(ROZZANO).valoreMercato, 132075));
  test("non conforme con spese di regolarizzazione quantificate: sanabile", () => assert.equal(perizia(ROZZANO).conformita, "sanabile"));
  test("locato", () => assert.equal(perizia(ROZZANO).statoOccupativo, "Occupato con contratto (perizia)"));
});

describe("leggiPerizia: modello del software di stima", () => {
  const AGRATE = `Alla data del sopralluogo gli immobili risultano occupato dalla famiglia *** DATO OSCURATO ***
Consistenza commerciale complessiva unità principali: 1.424,00 m²
Consistenza commerciale complessiva accessori: 0,00 m²
Valore di Mercato dell'immobile nello stato di fatto e di diritto in cui si trova: €. 1.630.609,60
Valore di vendita giudiziaria dell'immobile nello stato di fatto e di diritto in cui si
trova:
€. 1.386.018,16
8.1. CONFORMITÀ EDILIZIA:
Dall'esame delle pratiche presenti nell'archivio dell'ufficio tecnico emergono due pratiche principali
8.2. CONFORMITÀ CATASTALE: NESSUNA DIFFORMITÀ
l foglio 32 particella 55 sub. 6 (catasto fabbricati), categoria C/6, classe 2, consistenza 30 mq,`;

  test("superficie, valore di mercato (non quello di vendita giudiziaria), occupazione", () => {
    const p = perizia(AGRATE);
    assert.equal(p.mq, 1424);
    assert.equal(p.valoreMercato, 1630609.6);
    assert.equal(p.statoOccupativo, "Occupato (perizia)");
  });
  test("conformita' edilizia descritta senza un giudizio esplicito: nessun verdetto", () => {
    // la catastale "nessuna difformita'" non dice nulla dell'edilizia
    assert.equal(perizia(AGRATE).conformita, null);
  });
});

describe("leggiPerizia: testi OCR e formule minori", () => {
  test("via Padova: superficie con '= mq.', valore totale, conformita' urbanistico-edilizia", () => {
    const p = perizia(`zona censuaria 3, categoria A/3, classe 4, consistenza 4 vani, superficie catastale totale 64 mq,
Conformità urbanistico-edilizia: nessuna difformità.
È » Superficie commerciale dell'appartamento = mq.58,00
2. Valore del Corpo Appartamento = € 145.000,00
Valore cantina (a corpo) = € 3.000,00
$ Valore Totale = € 148.000,00`);
    assert.equal(p.mq, 58);
    assert.equal(p.fonteMq, "superficie_commerciale");
    assert.equal(p.valoreMercato, 148000);
    assert.equal(p.conformita, "conforme");
  });

  test("Arluno: due tabelle (casa e autorimessa), vale la prima; 'SI parziale' non e' conforme", () => {
    const p = perizia(`Conformità edilizia: SI parziale
camera e bagno in sottotetto 59,00 100% 59,00
557,00 345,85
mq lordi mq commerciali
Autorimessa 68,50 100% 68,50
68,50 68,50
mq lordi mq commerciali
Complessivamente — LOTTO UNICO Euro 526.000,00`);
    assert.equal(p.mq, 345.85);
    assert.equal(p.valoreMercato, 526000);
    assert.equal(p.conformita, "non_verificata");
  });

  test("via Cornalia (OCR): solo la catastale, e il prezzo base dell'esperto non e' un valore di mercato", () => {
    const p = perizia(`categoria A/2, classe 4, consistenza vani 6,5, Superficie catastale totale mq 130, escluse aree scoperte
Stato occupativo
Corpo A al sopralluogo, libero ai fini della procedura, abitato dalla proprietaria e dalla sua famiglia.
Prezzo a base d'asta del Lotta unico, Euro 850.000 {arrotondato].`);
    assert.equal(p.mq, 130);
    assert.equal(p.fonteMq, "catastale");
    assert.equal(p.valoreMercato, null);
    assert.equal(p.statoOccupativo, "Libero (perizia)");
  });

  test("Pozzo d'Adda (OCR): 'risultava abitato' dopo la data del sopralluogo", () => {
    const p = perizia("Alla data del sopralluogo tenutosi il 02/10/2024 l'immobile risultava abitato ed arredato.");
    assert.equal(p.statoOccupativo, "Occupato (perizia)");
  });

  test("niente formule riconosciute: tutto vuoto, nessun numero indovinato", () => {
    const p = perizia("Il foglio 512 particella 88 subalterno 3, 4 vani, rendita 1.234,00");
    assert.deepEqual([p.mq, p.valoreMercato, p.conformita, p.statoOccupativo], [null, null, null, null]);
  });

  test("superficie sotto i 15 mq: scartata", () => {
    assert.equal(perizia("Consistenza commerciale complessiva unità principali: 9,00 m²").mq, null);
  });
});

describe("testoLeggibile", () => {
  test("una scansione o un font senza mappatura non e' testo", () => {
    assert.equal(testoLeggibile(""), false);
    assert.equal(testoLeggibile(`!  ""#  ""  $ %&% !  (((( %(  ) 2) 2) 2) .-1+1.3-4- `.repeat(200)), false);
    assert.equal(leggiPerizia(["   "]).leggibile, false);
  });
  test("una perizia vera si'", () => assert.equal(testoLeggibile(RIEMPITIVO), true));
});

describe("scegliPerizia", () => {
  const a = (nomeFile: string, codiceTipoAllegato: string, dimensioneAllegato = 1000) => ({
    nomeFile,
    codiceTipoAllegato,
    dimensioneAllegato,
    linkAllegato: `/allegati/1/${encodeURIComponent(nomeFile)}?versionId=x`,
  });

  test("fra gli allegati PERIZ vince la perizia, non visure e planimetrie", () => {
    const scelta = scegliPerizia([
      a("Allegato 2 Visura per soggetto Foglio 4.pdf", "PERIZ", 800_000),
      a("Periza Pozzo d Adda 03062026.pdf", "PERIZ", 9_000_000),
      a("Allegato 4 Visura storica.pdf", "PERIZ", 1_600_000),
      a("Avviso di vendita.pdf", "AVEND", 300_000),
    ]);
    assert.equal(scelta?.nomeFile, "Periza Pozzo d Adda 03062026.pdf");
  });
  test("perizia e integrazione: la perizia", () => {
    assert.equal(scegliPerizia([a("Integrazione perizia.pdf", "PERIZ", 300_000), a("Perizia privacy_.pdf", "PERIZ", 700_000)])?.nomeFile, "Perizia privacy_.pdf");
  });
  test("codice STIMA e nome qualunque", () => {
    assert.equal(scegliPerizia([a("Relazione di stima.pdf", "STIMA")])?.nomeFile, "Relazione di stima.pdf");
    assert.equal(scegliPerizia([a("doc 7.pdf", "PERIZ")])?.nomeFile, "doc 7.pdf");
  });
  test("nessuna perizia, o solo immagini", () => {
    assert.equal(scegliPerizia([a("Avviso.pdf", "AVEND"), a("Planimetria.jpg", "PERIZ")]), null);
  });
});
