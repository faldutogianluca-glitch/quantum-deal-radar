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
  test("valore del lotto prima e dopo le decurtazioni: il secondo e' quello di perizia", () => {
    assert.equal(perizia(ROZZANO).valoreMercato, 132075);
    assert.equal(perizia(ROZZANO).valoreGiudiziario, 121471.25);
  });
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
    assert.equal(p.valoreGiudiziario, 1386018.16);
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
    // abitato dalla proprietaria, che con il decreto di trasferimento deve lasciare
    assert.equal(p.statoOccupativo, "Libero ai fini della procedura (perizia)");
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

describe("regressioni della revisione del 18/10/2026", () => {
  test("numeri sopra mille senza punto delle migliaia", () => {
    assert.equal(perizia("Superficie commerciale complessiva mq 1424,00").mq, 1424);
    assert.equal(perizia("Superficie Catastale Totale: mq 1300").mq, 1300);
    assert.equal(perizia("Valore Totale = € 148000,00").valoreMercato, 148000);
    assert.equal(perizia("Valore LOTTO UNICO € 526000").valoreMercato, 526000);
  });
  test("un valore sotto i 10.000 euro non e' il valore di un lotto", () => {
    assert.equal(perizia("Valore Totale = € 884,40").valoreMercato, null);
  });
  test("il prezzo unitario non e' una superficie, il box non e' l'appartamento", () => {
    assert.equal(perizia("Il valore unitario riferito alla superficie commerciale è di €/mq 2.500,00").mq, null);
    assert.equal(perizia("Superficie commerciale del box: 18,00 mq\nSuperficie commerciale dell'appartamento = mq 95,00").mq, 95);
  });
  test("perizia di piu' lotti: solo il valore del lotto dell'annuncio, nessuna superficie", () => {
    const testo = `LOTTO 1 appartamento\nLOTTO 2 negozio\nValore LOTTO 1 € 300.000,00\nValore LOTTO 2 € 95.000,00
Consistenza commerciale complessiva unità principali: 120,00 m²`;
    assert.equal(leggiPerizia([RIEMPITIVO, testo], "2").valoreMercato, 95000);
    assert.equal(leggiPerizia([RIEMPITIVO, testo], "LOTTO 2").valoreMercato, 95000);
    assert.equal(leggiPerizia([RIEMPITIVO, testo], null).valoreMercato, null);
    assert.equal(leggiPerizia([RIEMPITIVO, testo], "1").mq, null);
    assert.equal(leggiPerizia([RIEMPITIVO, testo], "1").piuLotti, true);
  });
  test("'un lotto a sua volta contiguo' non e' il lotto A (via Cornalia)", () => {
    assert.equal(perizia("posto al centro di un lotto a sua volta contiguo\nLotto 1.\n130,0 129,09\nmq. lordi mq. commerciali").piuLotti, false);
  });
  test("stato occupativo: negazioni, liberazione, frasi miste", () => {
    const stato = (f: string) => perizia(`Stato occupativo\n${f}`).statoOccupativo;
    assert.equal(stato("Occupato dal debitore; il G.E. ha emesso ordine di liberazione."), "Occupato (perizia)");
    assert.equal(stato("Appartamento occupato dall'esecutato; il box pertinenziale risulta libero."), null);
    assert.equal(stato("Occupato da terzi senza titolo: non risultano contratti di locazione registrati."), "Occupato (perizia)");
    assert.equal(stato("L'immobile risulta non occupato e privo di arredi."), "Libero (perizia)");
    // Arluno: "liberi per la procedura" e' sulla seconda riga
    assert.equal(stato("utilizzati dalla proprietà con la propria famiglia,\nliberi per la procedura."), "Libero ai fini della procedura (perizia)");
  });
  test("conformita': 'si rimanda', 'si precisa', 'conformemente' non sono un si'", () => {
    assert.equal(perizia("Conformità edilizia: si rimanda al paragrafo 7.3 per le difformità").conformita, null);
    assert.equal(perizia("Conformità urbanistica: si precisa che è presente un ampliamento abusivo").conformita, null);
    assert.equal(perizia("Conformità edilizia:\nconformemente a quanto rilevato si riscontrano difformità").conformita, null);
  });
  test("la frase di rito sulle 'eventuali opere non sanabili' non rende insanabile", () => {
    const p = perizia(`Conformità edilizia: SI parziale. Le difformità sono sanabili con CILA in sanatoria.
Pagina dopo pagina di altro testo.
${"Testo generico della perizia. ".repeat(40)}
L'aggiudicatario dovrà provvedere a rimuovere le eventuali opere non sanabili a sua cura e spese.`);
    assert.equal(p.conformita, "sanabile");
  });
  test("insanabile detto nel giudizio", () => {
    assert.equal(perizia("Conformità urbanistica: NON CONFORME. Il soppalco realizzato è insanabile e va demolito.").conformita, "insanabile");
  });
});

describe("modello di Milano 'Prezzo base d'asta' (perizie di Arluno e Basiano, 18/10/2026)", () => {
  // impaginazione di pdfjs, come la produce estraiTestoPdf
  const CARSO = `Stato occupativo (All. 3,7/F)
Alla data del sopralluogo congiunto (15/04/2026) i beni immobili oggetto di perizia erano occupati
dal OMISSIS; come anche verificato dal Custode Giudiziario; (senza titolo).
Appartamento mq. 96,00 100% 96,00
mq. lordi 105,00 mq. commerciali 98,00
Box autorimessa mq. 21,00 100% 21,00
mq. lordi 21,00 mq. commerciali 21,00
VALORE LOTTO UNICO : Euro 162.000,00
Riduzione del valore del 5% per assenza di garanzia per vizi : Euro - 8.100,00
Prezzo base d’asta Lotto Unico al netto delle decurtazioni (LIBERO) Euro 141.050,00`;
  const MANZONI = `Destinazione U.M Superficie lorda Coeff. Superficie
Omogeneizzata
Abitazione p. t Mq. 42,12 100% 42,12
Sottotetto Mq. 45,64 50% 22,82
Totale 132,16 109,34
arrotondato 109,00
VALORE LOTTO 001 € 119.900,00
Prezzo base d'asta intero LOTTO 001 al netto delle decurtazioni
LIBERO € 112.905,00
arrotondato € 113.000,00
Prezzo base d'asta LOTTO 001 al netto delle decurtazioni Occupato:
non ricorre il caso € 0,00`;
  test("totali con etichette alternate: la prima tabella, non il box; valore prima e dopo le decurtazioni", () => {
    const p = perizia(CARSO);
    assert.equal(p.mq, 98);
    assert.equal(p.valoreMercato, 162000);
    assert.equal(p.valoreGiudiziario, 141050);
  });
  test("titolo con il rimando agli allegati: occupato senza titolo", () => assert.equal(perizia(CARSO).statoOccupativo, "Occupato (perizia)"));
  test("tabella omogeneizzata: la superficie arrotondata; il valore da libero, non la riga 'Occupato'", () => {
    const p = perizia(MANZONI);
    assert.equal(p.mq, 109);
    assert.equal(p.valoreMercato, 119900);
    assert.equal(p.valoreGiudiziario, 112905);
  });
  test("perizia di piu' lotti: il valore del lotto dell'annuncio, anche scritto 002", () => {
    const due = `Lotto 1 appartamento. Lotto 2 box.
Prezzo base d'asta LOTTO 001 al netto delle decurtazioni (LIBERO) € 90.000,00
Prezzo base d'asta LOTTO 002 al netto delle decurtazioni (LIBERO) € 12.500,00`;
    assert.equal(leggiPerizia([RIEMPITIVO, due], "2").valoreGiudiziario, 12500);
    assert.equal(leggiPerizia([RIEMPITIVO, due], null).valoreGiudiziario, null);
  });
});

describe("testoLeggibile", () => {
  test("frontespizio di testo davanti a un corpo scansionato: non leggibile, serve l'OCR", () => {
    assert.equal(testoLeggibile([RIEMPITIVO, "", " ", "\f", "x", "y"]), false);
  });
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
  test("nomi difficili: % non codificato, 'Allegato A perizia', relazione notarile", () => {
    assert.equal(scegliPerizia([{ ...a("x", "PERIZ"), nomeFile: "Perizia ribasso 25%.pdf", linkAllegato: "/allegati/1/Perizia ribasso 25%.pdf?versionId=1" }])?.nomeFile, "Perizia ribasso 25%.pdf");
    assert.equal(scegliPerizia([a("Allegato A perizia.pdf", "PERIZ")])?.nomeFile, "Allegato A perizia.pdf");
    assert.equal(scegliPerizia([a("Elaborato peritale.pdf", "PERIZ")])?.nomeFile, "Elaborato peritale.pdf");
    assert.equal(scegliPerizia([a("Relazione notarile ventennale.pdf", "PERIZ", 9e6), a("Perizia.pdf", "PERIZ", 1e6)])?.nomeFile, "Perizia.pdf");
  });
  test("perizie per lotto: quella del lotto dell'annuncio, mai quella di un altro", () => {
    const allegati = [a("Perizia lotto 1.pdf", "PERIZ", 9e6), a("Perizia lotto 2.pdf", "PERIZ", 1e6)];
    assert.equal(scegliPerizia(allegati, "2")?.nomeFile, "Perizia lotto 2.pdf");
    assert.equal(scegliPerizia([a("Perizia lotto 1.pdf", "PERIZ")], "2"), null);
  });
  test("nessuna perizia, o solo immagini", () => {
    assert.equal(scegliPerizia([a("Avviso.pdf", "AVEND"), a("Planimetria.jpg", "PERIZ")]), null);
  });
});
