import { test, describe, afterEach } from "node:test";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";

import {
  PvpScraper,
  annuncioDaLista,
  categoriaCatastale,
  stessoLottoPrecedente,
  superficieDaDescrizione,
  titoloDaDescrizione,
  type AnnuncioLista,
} from "./pvp.js";
import type { SiteConfig } from "./types.js";

/*
 * Fixture ricavate da risposte reali dell'API del PVP (18/10/2026), ridotte ai
 * campi che il connettore legge. I dati personali del dettaglio (delegato,
 * custode, codici fiscali) sono sostituiti da segnaposto: servono a provare che
 * non finiscono nell'annuncio.
 */

const POZZO: AnnuncioLista = {
  id: 4646394,
  tipoLotto: "IMMOBILI",
  categoriaLotto: "IMMOBILE_RESIDENZIALE",
  categoriaBene: ["APPARTAMENTO"],
  indirizzo: {
    via: "Via M. L. King, 20060 Bettola MI, Italia",
    citta: "Pozzo d'Adda",
    provincia: "Milano",
    coordinate: { latitudine: 45.563163, longitudine: 9.487942 },
  },
  numeroLotto: "1",
  procedura: "68",
  prezzoBaseAsta: 70000,
  offertaMinima: 70000,
  dataVendita: "2027-01-28",
  disponibilita: ["NON_SPECIFICATA"],
  descLotto:
    "Liquidazione Controllata R.G. 68/2024: Pozzo d’Adda (MI) Via M.L.King snc Appartamento fg.4, part.286, sub.9, cat.A3, cl.4, cons. 3,5 vani, sup. 55mq, P1, r.c. € 177,14 Immobile occupato senza titolo",
  tribunale: "Tribunale di MILANO",
  codiceTribunale: "0151460094",
};

const MILANO_GRANDE: AnnuncioLista = {
  id: 4644188,
  categoriaLotto: "IMMOBILE_RESIDENZIALE",
  categoriaBene: ["APPARTAMENTO"],
  indirizzo: { via: "Via Esempio 1, Milano", citta: "Milano", coordinate: { latitudine: 45.47, longitudine: 9.19 } },
  numeroLotto: "LOTTO UNICO",
  procedura: "138",
  prezzoBaseAsta: 851000,
  dataVendita: "2027-01-14",
  disponibilita: ["LIBER"],
  descLotto: "Appartamento al piano settimo di mq 240 composto da sei locali oltre cucina e servizi, con cantina. Cat. A/2",
  tribunale: "Tribunale di MILANO",
};

describe("annuncioDaLista", () => {
  test("dall'annuncio reale di Pozzo d'Adda: superficie, categoria, prezzo, luogo", () => {
    const a = annuncioDaLista(POZZO, "pvp");
    assert.equal(a.idEsterno, "4646394");
    assert.equal(a.url, "https://pvp.giustizia.it/pvp/it/detail_annuncio.page?idAnnuncio=4646394");
    assert.equal(a.mq, 55);
    assert.equal(a.sottotipoAsset, "A/3");
    assert.equal(a.prezzo, 70000);
    assert.equal(a.tipoPrezzo, "base_asta");
    assert.equal(a.comune, "Pozzo d'Adda");
    assert.equal(a.lat, 45.563163);
    assert.equal(a.dataAsta, "2027-01-28");
    // NON_SPECIFICATA non e' un'informazione: meglio nessuno stato che uno inventato
    assert.equal(a.statoOccupazionale, null);
  });

  test("prezzo zero diventa assente, non un lotto regalato", () => {
    assert.equal(annuncioDaLista({ ...POZZO, prezzoBaseAsta: 0 }, "pvp").prezzo, null);
  });

  test("senza mq nella descrizione la superficie resta assente: niente numeri presi dai vani o dal foglio", () => {
    const a = annuncioDaLista({ ...POZZO, descLotto: "Appartamento fg.4 part.286 sub.9 cat.A3 cons. 3,5 vani" }, "pvp");
    assert.equal(a.mq, null);
  });

  test("la quota parziale scritta oltre i primi 160 caratteri resta nel titolo, dove la legge il Gate 0", () => {
    const desc = `${"Appartamento al piano primo composto da ingresso, soggiorno, cucina, due camere e bagno, con cantina. ".repeat(2)}Quota di 1/3 di piena proprieta'.`;
    assert.ok(desc.indexOf("Quota") > 160);
    assert.match(annuncioDaLista({ ...POZZO, descLotto: desc }, "pvp").titolo ?? "", /Quota di 1\/3/);
  });

  test("disponibilita' tradotta e senza ripetizioni", () => {
    assert.equal(annuncioDaLista({ ...POZZO, disponibilita: ["OCCUP", "OCCUP"] }, "pvp").statoOccupazionale, "Occupato");
  });
});

describe("categoriaCatastale", () => {
  test("abitazione con box: vale l'abitazione, anche se il box viene prima", () => {
    assert.equal(categoriaCatastale("box cat. C/6 cl. 3 e appartamento categoria A/2"), "A/2");
  });
  test("ufficio e negozio restano tali", () => {
    assert.equal(categoriaCatastale("ufficio cat.A10"), "A/10");
    assert.equal(categoriaCatastale("negozio categoria catastale C/1"), "C/1");
  });
  test("con due punti o trattino", () => {
    assert.equal(categoriaCatastale("categoria catastale: A/3"), "A/3");
    assert.equal(categoriaCatastale("cat.: A/2"), "A/2");
    assert.equal(categoriaCatastale("Categoria: C/1"), "C/1");
    assert.equal(categoriaCatastale("categoria A-3"), "A/3");
  });
  test("nessuna categoria: assente", () => {
    assert.equal(categoriaCatastale("appartamento di tre locali"), null);
  });
});

describe("stessoLottoPrecedente", () => {
  const prima = (x: Partial<AnnuncioLista>): AnnuncioLista => ({
    ...MILANO_GRANDE,
    id: 1,
    dataVendita: "2026-05-10",
    prezzoBaseAsta: 1_000_000,
    ...x,
  });

  test("stessa procedura, stesso lotto, stesso posto, prezzo piu' alto e data precedente: e' un'asta precedente", () => {
    assert.equal(stessoLottoPrecedente(prima({}), MILANO_GRANDE), true);
    // "LOTTO UNICO" e "UNICO" sono lo stesso lotto
    assert.equal(stessoLottoPrecedente(prima({ numeroLotto: "UNICO" }), MILANO_GRANDE), true);
  });

  test("procedura omonima in un'altra citta' (registri diversi, stesso numero): no", () => {
    // caso reale: la procedura 92 di Milano comprende vendite a Verona e a Paderno Dugnano
    const verona = prima({ indirizzo: { citta: "Verona", coordinate: { latitudine: 45.44, longitudine: 10.99 } } });
    assert.equal(stessoLottoPrecedente(verona, MILANO_GRANDE), false);
  });

  test("stessa citta' ma oltre 300 metri: no", () => {
    assert.equal(
      stessoLottoPrecedente(prima({ indirizzo: { citta: "Milano", coordinate: { latitudine: 45.48, longitudine: 9.19 } } }), MILANO_GRANDE),
      false,
    );
  });

  test("senza coordinate da una parte basta il comune? No: serve la stessa via", () => {
    const senza = { ...MILANO_GRANDE, indirizzo: { citta: "Milano", via: "Via Esempio 1, Milano" } };
    assert.equal(stessoLottoPrecedente(prima({ indirizzo: { citta: "Milano", via: "Viale Altro 9, Milano" } }), senza), false);
    assert.equal(stessoLottoPrecedente(prima({ indirizzo: { citta: "Milano", via: "Via Esempio 1, Milano" } }), senza), true);
  });

  test("prezzo zero dichiarato dall'API non esclude", () => {
    assert.equal(stessoLottoPrecedente(prima({ prezzoBaseAsta: 0 }), MILANO_GRANDE), true);
  });

  test("numeri di lotto scritti in modi diversi", () => {
    const uno = { ...MILANO_GRANDE, numeroLotto: "1" };
    assert.equal(stessoLottoPrecedente(prima({ numeroLotto: "Lotto n. 1" }), uno), true);
    assert.equal(stessoLottoPrecedente(prima({ numeroLotto: "LOTTO UNICO" }), uno), true);
    assert.equal(stessoLottoPrecedente(prima({ numeroLotto: "01" }), uno), true);
  });

  test("senza data non si abbina", () => {
    assert.equal(stessoLottoPrecedente(prima({ dataVendita: null }), MILANO_GRANDE), false);
  });

  test("lotto diverso della stessa procedura: no", () => {
    assert.equal(stessoLottoPrecedente(prima({ numeroLotto: "2" }), MILANO_GRANDE), false);
  });

  test("prezzo base piu' basso prima che dopo: non e' un ribasso dopo un'asta deserta", () => {
    assert.equal(stessoLottoPrecedente(prima({ prezzoBaseAsta: 500_000 }), MILANO_GRANDE), false);
  });

  test("data successiva o uguale: no", () => {
    assert.equal(stessoLottoPrecedente(prima({ dataVendita: "2027-01-14" }), MILANO_GRANDE), false);
  });

  test("numero di lotto sostituito dall'identificativo: serve la stessa posizione entro 50 metri", () => {
    const qui = { ...MILANO_GRANDE, numeroLotto: String(MILANO_GRANDE.id) };
    assert.equal(stessoLottoPrecedente(prima({ numeroLotto: "1" }), qui), true);
    const vicino = prima({ numeroLotto: "1", indirizzo: { citta: "Milano", coordinate: { latitudine: 45.4715, longitudine: 9.19 } } });
    assert.equal(stessoLottoPrecedente(vicino, qui), false, "170 metri: troppo per lotti senza numero confrontabile");
    const senzaCoordinate = { ...qui, indirizzo: { citta: "Milano" } };
    assert.equal(stessoLottoPrecedente(prima({ numeroLotto: "1" }), senzaCoordinate), false);
  });
});

describe("superficieDaDescrizione (casi reali e del revisore)", () => {
  const casi: [string, number | null][] = [
    ["Appartamento fg.4, part.286, sub.9, cat.A3, cons. 3,5 vani, sup. 55mq, P1", 55],
    ["Appartamento di 95m2 al piano primo", 95],
    ["Esecuzione R.G.E. 1234/2022 - Appartamento, superficie commerciale (mq): 95", 95],
    ["Appartamento, superficie in mq da definire, fg. 512 part. 88", null],
    ["Appartamento di mq 60 con giardino esclusivo di mq 300", 60],
    // reale, Agrate Brianza: villa, box e un capannone nello stesso lotto
    ["Villa mq 340 T-S1,giardino;2 box 30 mq cadauna; edificio industriale/terziario mq 1120", 340],
    // reale, Cernusco: "1000/1000" e' la quota, non la superficie
    ["Piena proprieta' per la quota 1000/1000 di CAPANNONE ARTIGIANALE di circa mq. 317,75, composto da laboratorio", 317.75],
    ["Fabbricato commerciale della superficie commerciale di 1.809,00 mq", 1809],
    ["Complesso da riqualificare di 31.227 mq sito a Loreo", 31227],
    ["Appartamento con cantina di 103,00 mq. e box di 18,30 mq.", 103],
    ["Porzione di villa bifamiliare di mq 249,60 e box di mq 41", 249.6],
    // reale, Milano: superficie dichiarata senza unita'
    ["UFFICIO al piano primo con ampia vetrata panoramica (sup. comm. 255 circa) e tre locali", 255],
    ["Appartamento, superficie commerciale 1/2 di proprieta'", null],
  ];
  for (const [desc, atteso] of casi) {
    test(desc.slice(0, 70), () => assert.equal(superficieDaDescrizione(desc), atteso));
  }
});

describe("titoloDaDescrizione", () => {
  test("toglie l'intestazione della procedura, che puo' portare il nome del debitore", () => {
    const t = titoloDaDescrizione("Liquidazione Giudiziale Nome Cognome D.I. R.G. 56/2026: Arluno (MI) Via X 3, capannone");
    assert.equal(t, "Arluno (MI) Via X 3, capannone");
  });
  test("lascia intatta una descrizione senza intestazione", () => {
    assert.equal(titoloDaDescrizione("Appartamento al piano primo: tre locali"), "Appartamento al piano primo: tre locali");
  });
});

describe("PvpScraper", () => {
  const fetchOriginale = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = fetchOriginale;
  });

  const config = (stato: "consentito" | "da_verificare", dettagliMassimi = 10): SiteConfig => ({
    name: "pvp_test",
    displayName: "PVP di prova",
    enabled: true,
    priorita: 1,
    fetchMode: "pvp",
    baseUrl: "https://pvp.test",
    searchUrl: "https://pvp.test/pvp/",
    listSelector: "",
    fields: { titolo: "", url: "" },
    pagination: { maxPages: 1 },
    rateLimitSeconds: 0,
    compliance: { stato, note: "" },
    pvp: {
      apiRicerca: "https://pvp.test/ric-ms",
      apiVendite: "https://pvp.test/ve-ms",
      tribunali: ["Tribunale di MILANO"],
      categorieLotto: ["IMMOBILE_RESIDENZIALE"],
      prezzoMin: 100_000,
      prezzoMax: 1_600_000,
      dimensionePagina: 2,
      pagineMassime: 5,
      dettagliMassimi,
    },
  });

  const PASSATA: AnnuncioLista = { ...MILANO_GRANDE, id: 900, dataVendita: "2026-10-01" };
  const PRECEDENTI: AnnuncioLista[] = [
    { ...MILANO_GRANDE, id: 10, dataVendita: "2025-11-20", prezzoBaseAsta: 1_330_000 },
    { ...MILANO_GRANDE, id: 11, dataVendita: "2026-05-14", prezzoBaseAsta: 1_064_000 },
    // rettifica dello stesso esperimento: stessa data, conta una volta
    { ...MILANO_GRANDE, id: 14, dataVendita: "2026-05-14", prezzoBaseAsta: 1_064_000 },
    // altro lotto della stessa procedura
    { ...MILANO_GRANDE, id: 12, numeroLotto: "2", dataVendita: "2026-05-14", prezzoBaseAsta: 1_200_000 },
    // procedura omonima di un altro registro, altrove
    { ...MILANO_GRANDE, id: 13, indirizzo: { citta: "Verona" }, dataVendita: "2024-02-20", prezzoBaseAsta: 2_000_000 },
    MILANO_GRANDE,
  ];

  const DETTAGLI: Record<string, unknown> = {
    "4644188": {
      descTipoVendita: "Senza Incanto",
      descModVendita: "Sincrona Mista",
      dataTermPresOff: "13/01/2027",
      lotto: { idLotto: 1, codLotto: "LOTTO UNICO" },
      procedura: {
        numeRg: "138",
        numeAnnoRg: 2024,
        descTipoRito: "Espropriazione Immobiliare (cartabia)",
        codTipoRegistro: "ESECUZIONI_CIVILI_IMMOBILIARI",
      },
      soggetti: [{ nome: "NOME_DELEGATO", codiceFiscale: "CODICEFISCALEXXX", email: "delegato@example.test" }],
    },
    "4646395": {
      descTipoVendita: "Senza Incanto",
      dataTermPresOff: "27/01/2027",
      procedura: { numeRg: "68", numeAnnoRg: 2024, descTipoRito: "Liquidazione Controllata (cci)", codTipoRegistro: "PROCEDURE_CONCORSUALI" },
      soggetti: [{ nome: "NOME_CUSTODE", codiceFiscale: "ALTROCODICEFISC" }],
    },
  };

  /** Un finto PVP: registra le chiamate e risponde come l'API vera. */
  function fintoPvp(opzioni: { guastiDettaglio?: number } = {}) {
    const chiamate: { url: string; corpo: Record<string, unknown> | null }[] = [];
    let guasti = opzioni.guastiDettaglio ?? 0;
    const futura = { ...POZZO, id: 4646395, prezzoBaseAsta: 150_000 };
    const fuoriFascia = { ...POZZO, id: 4646396, prezzoBaseAsta: 40_000 };
    const pagine = [[MILANO_GRANDE, futura], [fuoriFascia, PASSATA], [{ ...PASSATA, id: 901 }]];
    globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      const corpo = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null;
      chiamate.push({ url, corpo });
      const json = (body: unknown) => new Response(JSON.stringify({ messaggio: "ok", body }), { status: 200 });
      if (url.endsWith("/robots.txt")) return new Response("", { status: 404 });
      if (url.includes("/ricerca/vendite")) {
        if (corpo?.procedura === "138") return json({ content: PRECEDENTI, last: true });
        if (corpo?.procedura) return json({ content: [], last: true });
        const pagina = Number(new URL(url).searchParams.get("page"));
        return json({ content: pagine[pagina] ?? [], last: pagina >= pagine.length - 1 });
      }
      const m = /\/vendite\/(\d+)\/restricted$/.exec(url);
      if (m) {
        if (guasti > 0) {
          guasti--;
          return new Response("", { status: 503 });
        }
        return json(DETTAGLI[m[1]!] ?? {});
      }
      return new Response("", { status: 404 });
    }) as typeof fetch;
    return chiamate;
  }

  test("senza autorizzazione del titolare non fa nessuna richiesta", async () => {
    const chiamate = fintoPvp();
    const r = await new PvpScraper(config("da_verificare"), () => "2026-10-18").scrape();
    assert.equal(r.items.length, 0);
    assert.match(r.errors[0] ?? "", /non e' stata autorizzata/);
    assert.equal(chiamate.length, 0);
  });

  test("vendite future, dettaglio solo in fascia, aste precedenti contate sul solo stesso bene", async () => {
    const chiamate = fintoPvp();
    const r = await new PvpScraper(config("consentito"), () => "2026-10-18").scrape();
    assert.deepEqual(r.errors, []);
    // la seconda pagina contiene una vendita passata: la terza non si chiede
    assert.deepEqual(r.items.map((i) => i.idEsterno).sort(), ["4644188", "4646395", "4646396"]);
    assert.equal(chiamate.filter((c) => c.url.includes("page=2")).length, 0);

    const grande = r.items.find((i) => i.idEsterno === "4644188")!;
    assert.equal(grande.numeroRge, 138);
    assert.equal(grande.annoRge, 2024);
    assert.equal(grande.termineOfferte, "2027-01-13");
    assert.equal(grande.tipoVendita, "Senza Incanto, Sincrona Mista, Espropriazione Immobiliare (cartabia)");
    assert.equal(grande.nEsperimentiDeserti, 2, "contano 10 e 11 (14 e' una rettifica di 11); non il lotto 2, non Verona, non se stessa");
    assert.equal(grande.mq, 240);

    // liquidazione: niente RGE (e' un altro registro), ma le aste precedenti si cercano lo stesso
    const liquidazione = r.items.find((i) => i.idEsterno === "4646395")!;
    assert.equal(liquidazione.numeroRge ?? null, null);
    assert.equal(liquidazione.termineOfferte, "2027-01-27");
    assert.equal(liquidazione.nEsperimentiDeserti, 0);

    // fuori fascia: nessun dettaglio
    assert.equal(chiamate.filter((c) => c.url.includes("/vendite/4646396/")).length, 0);
    assert.equal(r.items.find((i) => i.idEsterno === "4646396")!.termineOfferte ?? null, null);

    // la ricerca delle precedenti filtra per tribunale, numero e anno della procedura
    const prec = chiamate.find((c) => c.corpo?.procedura === "138")!;
    assert.equal(prec.corpo!.tribunale, "Tribunale di MILANO");
    assert.equal(prec.corpo!.anno, "2024");

    // nessun dato personale di delegato o custode nell'annuncio
    const testo = JSON.stringify(r.items);
    for (const personale of ["NOME_DELEGATO", "CODICEFISCALEXXX", "delegato@example.test", "NOME_CUSTODE", "ALTROCODICEFISC"]) {
      assert.ok(!testo.includes(personale), personale);
    }
  });

  test("i lotti grandi si aprono per primi e il tetto ai dettagli si dichiara", async () => {
    const chiamate = fintoPvp();
    const r = await new PvpScraper(config("consentito", 1), () => "2026-10-18").scrape();
    const dettagli = chiamate.filter((c) => c.url.includes("/restricted"));
    assert.deepEqual(dettagli.map((c) => c.url), ["https://pvp.test/ve-ms/vendite/4644188/restricted"]);
    assert.match(r.errors.join(" "), /dettagli limitati a 1/);
  });

  test("un 503 sul dettaglio si ritenta, poi il dato arriva", async () => {
    fintoPvp({ guastiDettaglio: 1 });
    const r = await new PvpScraper(config("consentito"), () => "2026-10-18").scrape();
    assert.deepEqual(r.errors, []);
    assert.equal(r.items.find((i) => i.idEsterno === "4644188")!.termineOfferte, "2027-01-13");
  });
  /** Un PVP minimale con risposte decise dal test. */
  function conFetch(gestore: (url: string, corpo: Record<string, unknown> | null) => Response) {
    const chiamate: string[] = [];
    globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      chiamate.push(url);
      if (url.endsWith("/robots.txt")) return new Response("", { status: 404 });
      return gestore(url, init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null);
    }) as typeof fetch;
    return chiamate;
  }
  const busta = (body: unknown) => new Response(JSON.stringify({ messaggio: "ok", body }), { status: 200 });

  test("una busta senza elenco e' un errore, non zero annunci", async () => {
    conFetch(() => new Response(JSON.stringify({ messaggio: "Servizio non disponibile", body: null }), { status: 200 }));
    const r = await new PvpScraper(config("consentito"), () => "2026-10-18").scrape();
    assert.equal(r.items.length, 0);
    assert.match(r.errors.join(" "), /risposta senza elenco: Servizio non disponibile/);
  });

  test("una pagina HTML con 200 (manutenzione) non si ritenta", async () => {
    const chiamate = conFetch(() => new Response("<html>manutenzione</html>", { status: 200 }));
    const r = await new PvpScraper(config("consentito"), () => "2026-10-18").scrape();
    assert.equal(chiamate.filter((u) => u.includes("/ricerca/")).length, 1);
    assert.match(r.errors.join(" "), /non JSON/);
  });

  test("un annuncio senza data non ferma la paginazione", async () => {
    const chiamate = conFetch((url) => {
      const pagina = Number(new URL(url).searchParams.get("page"));
      if (pagina === 0) return busta({ content: [{ ...MILANO_GRANDE, id: 1, dataVendita: null }, { ...MILANO_GRANDE, id: 2 }], last: false });
      return busta({ content: [{ ...MILANO_GRANDE, id: 3, prezzoBaseAsta: 50_000 }], last: true });
    });
    const r = await new PvpScraper(config("consentito", 0), () => "2026-10-18").scrape();
    assert.deepEqual(r.items.map((i) => i.idEsterno), ["2", "3"]);
    assert.ok(chiamate.some((u) => u.includes("page=1")));
    assert.match(r.errors.join(" "), /1 annunci senza data/);
  });

  test("il tetto di pagine si dichiara: mancherebbero le aste piu' vicine", async () => {
    conFetch(() => busta({ content: [{ ...MILANO_GRANDE, id: Math.random() }], last: false }));
    const r = await new PvpScraper(config("consentito", 0), () => "2026-10-18").scrape();
    assert.match(r.errors.join(" "), /raggiunte 5 pagine/);
  });

  test("dettagli sempre in errore: il tetto conta i tentativi e l'interruttore ferma le chiamate", async () => {
    const chiamate = conFetch((url) => {
      if (url.includes("/restricted")) return new Response("", { status: 503 });
      return busta({
        content: Array.from({ length: 6 }, (_, i) => ({ ...MILANO_GRANDE, id: 100 + i })),
        last: true,
      });
    });
    const r = await new PvpScraper(config("consentito", 10), () => "2026-10-18").scrape();
    // 3 dettagli falliti di fila, 3 tentativi ciascuno, poi basta
    assert.equal(chiamate.filter((u) => u.includes("/restricted")).length, 9);
    assert.match(r.errors.join(" "), /3 dettagli falliti di fila/);
  });

  test("Retry-After lungo: si rinuncia invece di insistere", async () => {
    const chiamate = conFetch(() => new Response("", { status: 429, headers: { "Retry-After": "3600" } }));
    const r = await new PvpScraper(config("consentito"), () => "2026-10-18").scrape();
    assert.equal(chiamate.filter((u) => u.includes("/ricerca/")).length, 1);
    assert.match(r.errors.join(" "), /Retry-After 3600/);
  });

  test("le province fuori elenco si scartano", async () => {
    conFetch(() =>
      busta({
        content: [
          { ...MILANO_GRANDE, id: 1, indirizzo: { ...MILANO_GRANDE.indirizzo, provincia: "Milano" } },
          { ...MILANO_GRANDE, id: 2, indirizzo: { citta: "Loreo", provincia: "Rovigo" } },
        ],
        last: true,
      }),
    );
    const c = config("consentito", 0);
    c.pvp!.province = ["Milano", "Monza e della Brianza"];
    const r = await new PvpScraper(c, () => "2026-10-18").scrape();
    assert.deepEqual(r.items.map((i) => i.idEsterno), ["1"]);
  });

  test("procedura con oltre 100 vendite: si legge dalle piu' recenti e lo si dichiara", async () => {
    let ordinePrecedenti = "";
    conFetch((url, corpo) => {
      if (url.includes("/restricted")) return busta(DETTAGLI["4644188"]);
      if (corpo?.procedura) {
        ordinePrecedenti = new URL(url).searchParams.get("sort") ?? "";
        return busta({ content: PRECEDENTI, last: false });
      }
      return busta({ content: [MILANO_GRANDE], last: true });
    });
    const r = await new PvpScraper(config("consentito"), () => "2026-10-18").scrape();
    assert.equal(ordinePrecedenti, "dataOraVendita,desc");
    assert.match(r.errors.join(" "), /oltre 100 vendite/);
    assert.equal(r.items[0]!.nEsperimentiDeserti, 2);
  });
  test("perizie: superficie dalla perizia, letta una volta sola, nessun testo conservato", async () => {
    const cartella = mkdtempSync(join(tmpdir(), "qdr-perizie-"));
    const cachePerizie = join(cartella, "perizie_pvp.json");
    const senzaMq = { ...MILANO_GRANDE, descLotto: "Appartamento al piano settimo di quattro locali", indirizzo: { ...MILANO_GRANDE.indirizzo } };
    const allegati = [
      { nomeFile: "Visura.pdf", codiceTipoAllegato: "PERIZ", dimensioneAllegato: 10, linkAllegato: "/allegati/4644188/Visura.pdf?versionId=v" },
      { nomeFile: "Relazione di stima.pdf", codiceTipoAllegato: "PERIZ", dimensioneAllegato: 20, linkAllegato: "/allegati/4644188/Relazione di stima.pdf?versionId=1" },
    ];
    const scaricati: string[] = [];
    conFetch((url) => {
      if (url.startsWith("https://bucket.test/")) {
        scaricati.push(url);
        return new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]), { status: 200 });
      }
      if (url.includes("/restricted")) return busta({ ...(DETTAGLI["4644188"] as object), allegati });
      if (url.includes("/ricerca/") && url.includes("sort=dataOraVendita,desc&")) return busta({ content: [senzaMq], last: true });
      return busta({ content: [senzaMq], last: true });
    });
    const c = config("consentito");
    c.pvp!.apiAllegati = "https://bucket.test";
    c.pvp!.perizieMassime = 5;
    const RIEMPITIVO = "Il valore della stima per la vendita dell'immobile che il perito indica. ".repeat(10);
    const testoPdf = async () => ({
      pagine: [RIEMPITIVO, "Esperto: NOME_PERITO CODICEFISCALEPERITO\n120,0 96,4\nmq. lordi mq. commerciali\nValore LOTTO UNICO € 900.000,00"],
      ocr: false,
    });

    const r1 = await new PvpScraper(c, () => "2026-10-18", { cachePerizie, testoPdf }).scrape();
    const lotto = r1.items[0]!;
    assert.equal(lotto.mq, 96.4);
    assert.equal(lotto.valorePerizia, 900000);
    // si scarica la perizia, non la visura, con lo spazio del nome codificato
    assert.deepEqual(scaricati, ["https://bucket.test/allegati/4644188/Relazione%20di%20stima.pdf?versionId=1"]);
    const cache = readFileSync(cachePerizie, "utf-8");
    assert.ok(!cache.includes("NOME_PERITO") && !cache.includes("CODICEFISCALEPERITO"), "nella cache solo numeri");

    // seconda esecuzione: la perizia viene dalla cache, nessun nuovo download
    const r2 = await new PvpScraper(c, () => "2026-10-19", { cachePerizie, testoPdf }).scrape();
    assert.equal(scaricati.length, 1);
    assert.equal(r2.items[0]!.mq, 96.4);
  });

  test("perizie: tetto a zero, nessun download; allegato che non e' un PDF, errore dichiarato", async () => {
    const cartella = mkdtempSync(join(tmpdir(), "qdr-perizie-"));
    const cachePerizie = join(cartella, "perizie_pvp.json");
    const allegati = [{ nomeFile: "Perizia.pdf", codiceTipoAllegato: "PERIZ", linkAllegato: "/allegati/1/Perizia.pdf?versionId=1" }];
    const scaricati: string[] = [];
    conFetch((url) => {
      if (url.startsWith("https://bucket.test/")) {
        scaricati.push(url);
        return new Response("<html>errore</html>", { status: 200 });
      }
      if (url.includes("/restricted")) return busta({ ...(DETTAGLI["4644188"] as object), allegati });
      return busta({ content: [MILANO_GRANDE], last: true });
    });
    const c = config("consentito");
    c.pvp!.apiAllegati = "https://bucket.test";
    const testoPdf = async () => ({ pagine: [], ocr: true });
    await new PvpScraper(c, () => "2026-10-18", { cachePerizie, testoPdf }).scrape();
    assert.equal(scaricati.length, 0, "perizieMassime assente: nessuna perizia");
    c.pvp!.perizieMassime = 1;
    const r = await new PvpScraper(c, () => "2026-10-18", { cachePerizie, testoPdf }).scrape();
    assert.equal(scaricati.length, 1);
    assert.match(r.errors.join(" "), /non e' un PDF/);
    assert.equal(existsSync(cachePerizie), false, "un download fallito non entra in cache: si riprova");
  });
});
