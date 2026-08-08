import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { GenericScraper } from "./genericScraper.js";
import { analizzaPdf, estraiTestoPdf, giorniDaAggiornamento, leggiPdfLocale } from "./pdf.js";
import type { SiteConfig } from "./types.js";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");
const PDF = join(FIXTURES, "elenco_immobili.pdf");

/**
 * Config ricalcato su come sono fatti gli elenchi degli enti: una riga per
 * lotto, campi separati da trattini. Rigenerare la fixture con
 * `node packages/scrapers/fixtures/generaPdf.mjs`.
 */
function config(extra: Partial<SiteConfig> = {}): SiteConfig {
  return {
    name: "pdf-di-prova",
    displayName: "Ente di prova",
    enabled: false,
    priorita: 15,
    fetchMode: "pdf",
    baseUrl: "https://esempio.invalid",
    searchUrl: PDF,
    listSelector: "",
    tipoPrezzo: "base_asta",
    fields: { titolo: "", url: "" },
    pagination: { maxPages: 1 },
    rateLimitSeconds: 0,
    compliance: { stato: "consentito", note: "fixture locale del test" },
    pdf: {
      // I campi sono separati da " - ", ma un valore puo' contenere a sua volta
      // un trattino ("Edificio cielo-terra"): escluderlo con [^-] farebbe
      // sparire proprio quel lotto, in silenzio. Servono quantificatori pigri,
      // ancorati dal pezzo riconoscibile che segue (le mq).
      rigaLotto:
        "^Lotto (?<numeroLotto>\\d+) - (?<comune>[A-Z' ]+) \\([A-Z]{2}\\) - " +
        "(?<indirizzoRaw>.+?) - (?<sottotipoAsset>.+?) - " +
        "(?<mqRaw>[\\d.,]+) mq - Euro (?<prezzoRaw>[\\d.,]+)",
      rigaSospetta: "^Lotto \\d+",
      dataDocumento: "Aggiornamento: (\\d{1,2} \\w+ \\d{4})",
    },
    ...extra,
  };
}

describe("estrazione del testo da un PDF", () => {
  test("legge le righe, una pagina per elemento", async () => {
    const pagine = await estraiTestoPdf(await leggiPdfLocale(PDF));
    assert.equal(pagine.length, 1);
    assert.match(pagine[0]!, /ELENCO IMMOBILI DISPONIBILI/);
    assert.match(pagine[0]!, /Lotto 3 - LODI/);
  });

  test("normalizza gli apostrofi tipografici, che altrimenti farebbero fallire le regex", async () => {
    const pagine = await estraiTestoPdf(await leggiPdfLocale(PDF));
    // il PDF contiene U+2019: una regex scritta con l'apostrofo dritto non
    // troverebbe nulla, e il motivo sarebbe invisibile a chi la rilegge
    assert.match(pagine[0]!, /BANCA D'ESEMPIO/);
    assert.ok(!pagine[0]!.includes("’"), "l'apostrofo tipografico non deve sopravvivere");
  });
});

describe("analisi dei lotti", () => {
  test("ricava i campi dai gruppi nominati della regex", async () => {
    const pagine = await estraiTestoPdf(await leggiPdfLocale(PDF));
    const esito = analizzaPdf(pagine, config(), "https://ente.invalid/elenco.pdf");

    assert.equal(esito.immobili.length, 4);

    const primo = esito.immobili[0]!;
    assert.equal(primo.numeroLotto, "1");
    assert.equal(primo.comune, "CREMONA");
    assert.equal(primo.indirizzoRaw, "Via Giuseppe Verdi 14");
    assert.equal(primo.sottotipoAsset, "Ufficio");
    assert.equal(primo.mq, 1250);
    assert.equal(primo.prezzo, 1_480_000);
    assert.equal(primo.tipoPrezzo, "base_asta");
  });

  test("i decimali con la virgola non vengono presi per migliaia", async () => {
    const pagine = await estraiTestoPdf(await leggiPdfLocale(PDF));
    const esito = analizzaPdf(pagine, config(), "https://ente.invalid/elenco.pdf");
    // 640,50 mq: mezzo metro, non seicentoquaranta migliaia
    assert.equal(esito.immobili[1]!.mq, 640.5);
    assert.equal(esito.immobili[1]!.prezzo, 312_000);
  });

  test("un valore che contiene il separatore non fa sparire il lotto", async () => {
    const pagine = await estraiTestoPdf(await leggiPdfLocale(PDF));
    const esito = analizzaPdf(pagine, config(), "https://ente.invalid/elenco.pdf");
    // "Edificio cielo-terra" ha un trattino dentro, e i campi sono separati da
    // trattini: e' la trappola in cui si cade scrivendo [^-]+ per i campi
    const lodi = esito.immobili.find((i) => i.comune === "LODI");
    assert.ok(lodi, "il lotto col trattino nel valore non deve sparire");
    assert.equal(lodi!.sottotipoAsset, "Edificio cielo-terra");
    assert.equal(lodi!.indirizzoRaw, "Piazza della Vittoria 3");
  });

  test("legge la data dichiarata dal documento", async () => {
    const pagine = await estraiTestoPdf(await leggiPdfLocale(PDF));
    const esito = analizzaPdf(pagine, config(), "https://ente.invalid/elenco.pdf");
    assert.equal(esito.dataDocumento, "2026-03-12");
  });

  test("ogni lotto punta al documento da cui viene, con un frammento suo", async () => {
    const pagine = await estraiTestoPdf(await leggiPdfLocale(PDF));
    const esito = analizzaPdf(pagine, config(), "https://ente.invalid/elenco.pdf");
    // un lotto in un PDF non ha un indirizzo web proprio: il documento e' la fonte
    assert.equal(esito.immobili[2]!.url, "https://ente.invalid/elenco.pdf#lotto-3");
    // e gli id devono restare distinti, altrimenti la deduplica li fonderebbe
    const id = new Set(esito.immobili.map((i) => i.idEsterno));
    assert.equal(id.size, 4);
  });

  test("le righe che sembrano lotti ma non si leggono vengono segnalate, non buttate", async () => {
    const pagine = await estraiTestoPdf(await leggiPdfLocale(PDF));
    // regex volutamente troppo stretta: e' cosi' che si presenta un documento
    // ristrutturato, ed e' il caso in cui la fonte muore senza avvisare
    const stretta = config({
      pdf: { rigaLotto: "^Lotto (?<numeroLotto>9\\d+) -", rigaSospetta: "^Lotto \\d+" },
    });
    const esito = analizzaPdf(pagine, stretta, "https://ente.invalid/elenco.pdf");

    assert.equal(esito.immobili.length, 0);
    assert.equal(esito.righeNonLette.length, 4, "le quattro righe scartate devono essere visibili");
    assert.match(esito.righeNonLette[0]!, /Lotto 1 - CREMONA/);
  });

  test("una fonte pdf senza rigaLotto lo dice, invece di restituire zero senza motivo", async () => {
    const pagine = await estraiTestoPdf(await leggiPdfLocale(PDF));
    const senza = config({ pdf: undefined });
    assert.throws(() => analizzaPdf(pagine, senza, "https://ente.invalid/x.pdf"), /pdf\.rigaLotto/);
  });
});

describe("eta' del documento", () => {
  test("misura quanti giorni sono passati dall'aggiornamento dichiarato", () => {
    assert.equal(giorniDaAggiornamento("2026-03-12", new Date("2026-08-08T00:00:00Z")), 149);
  });

  test("senza data non si inventa un'eta'", () => {
    assert.equal(giorniDaAggiornamento(null), null);
    assert.equal(giorniDaAggiornamento("non una data"), null);
  });
});

describe("scraping completo di una fonte pdf", () => {
  test("produce gli immobili passando dalla pipeline normale", async () => {
    const r = await new GenericScraper(config()).scrape();
    assert.deepEqual(r.errors, []);
    assert.equal(r.items.length, 4);
    assert.equal(r.items[3]!.comune, "MANTOVA");
    assert.equal(r.items[3]!.prezzo, 275_500);
  });

  test("zero lotti su un documento che esiste e' un allarme, non un risultato", async () => {
    const stretta = config({ pdf: { rigaLotto: "^Nessuna riga combacia mai$" } });
    const r = await new GenericScraper(stretta).scrape();
    assert.equal(r.items.length, 0);
    assert.ok(
      r.errors.some((e) => /nessun lotto riconosciuto/i.test(e)),
      `atteso un avviso esplicito, ottenuti: ${JSON.stringify(r.errors)}`,
    );
  });

  test("il vaglio di conformita' vale anche per i PDF", async () => {
    const r = await new GenericScraper(config({ compliance: { stato: "da_verificare" } })).scrape();
    assert.equal(r.items.length, 0);
    assert.match(r.errors[0]!, /non e' stata autorizzata/);
  });
});
