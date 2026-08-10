import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { GenericScraper } from "./genericScraper.js";
import { indovinaSeparatore, parseCsv, trovaColonna } from "./csv.js";
import { importaCsv } from "./importa.js";
import type { SiteConfig } from "./types.js";

function config(extra: Partial<SiteConfig> = {}): SiteConfig {
  return {
    name: "portafoglio-di-prova",
    displayName: "Portafoglio di prova",
    enabled: false,
    priorita: 45,
    fetchMode: "manuale",
    baseUrl: "https://esempio.invalid",
    searchUrl: "https://esempio.invalid",
    listSelector: "",
    // un portafoglio di un servicer pubblica un prezzo richiesto, non una base d'asta
    tipoPrezzo: "richiesta_reoco",
    fields: { titolo: "", url: "" },
    pagination: { maxPages: 1 },
    rateLimitSeconds: 0,
    compliance: { stato: "consentito", note: "consegna diretta, nessuno scraping" },
    ...extra,
  };
}

describe("parsing CSV", () => {
  test("riconosce il punto e virgola di Excel italiano", () => {
    // la virgola e' gia' il separatore decimale: assumerla come separatore di
    // campo produrrebbe una colonna sola, e nessuno se ne accorgerebbe
    assert.equal(indovinaSeparatore("Comune;Indirizzo;Prezzo"), ";");
    assert.equal(indovinaSeparatore("Comune,Indirizzo,Prezzo"), ",");
  });

  test("un separatore dentro le virgolette non conta", () => {
    const csv = 'Comune;Indirizzo;Prezzo\nCremona;"Via Roma 3; int. 2";125.000,00';
    const r = parseCsv(csv);
    assert.equal(r.righe.length, 1);
    assert.equal(r.righe[0]!["Indirizzo"], "Via Roma 3; int. 2");
  });

  test("il BOM di Excel non deve entrare nel nome della prima colonna", () => {
    // senza toglierlo l'intestazione diventa "﻿Comune" e la mappatura fallisce
    const r = parseCsv("﻿Comune;Prezzo\nPavia;100.000");
    assert.deepEqual(r.intestazioni, ["Comune", "Prezzo"]);
    assert.equal(r.righe[0]!["Comune"], "Pavia");
  });

  test("le virgolette raddoppiate sono una virgoletta letterale", () => {
    const r = parseCsv('Nota\n"Il cosiddetto ""lotto unico"" del bando"');
    assert.equal(r.righe[0]!["Nota"], 'Il cosiddetto "lotto unico" del bando');
  });

  test("un a-capo dentro un campo non spezza la riga", () => {
    const r = parseCsv('Comune;Nota\nLodi;"prima riga\nseconda riga"');
    assert.equal(r.righe.length, 1);
    assert.match(r.righe[0]!["Nota"]!, /prima riga\nseconda riga/);
  });

  test("segnala le righe con un numero di campi diverso dall'intestazione", () => {
    const r = parseCsv("Comune;Indirizzo;Prezzo\nCremona;Via Roma 3\nPavia;Corso Cavour 8;90.000");
    assert.equal(r.righeIrregolari, 1);
  });

  test("trova le colonne ignorando maiuscole, accenti e spazi", () => {
    const h = ["COMUNE", " Citta' ", "Prezzo Richiesto"];
    assert.equal(trovaColonna(h, "comune"), "COMUNE");
    assert.equal(trovaColonna(h, "prezzorichiesto"), "Prezzo Richiesto");
    assert.equal(trovaColonna(h, "inesistente"), null);
  });
});

describe("importazione di un portafoglio", () => {
  const CSV = [
    "Codice;Comune;Indirizzo;Tipologia;Superficie;Prezzo;Note",
    "BP-001;Cremona;Via Giuseppe Verdi 14;Ufficio;1.250,00;1.480.000,00;da ristrutturare",
    "BP-002;Pavia;Corso Cavour 8;Deposito;640,50;312.000,00;libero",
  ].join("\n");

  test("riconosce le colonne senza bisogno di configurarle", () => {
    const r = importaCsv(CSV, config(), "portafoglio.csv");
    assert.equal(r.immobili.length, 2);

    const primo = r.immobili[0]!;
    assert.equal(primo.idEsterno, "BP-001");
    assert.equal(primo.comune, "Cremona");
    assert.equal(primo.indirizzoRaw, "Via Giuseppe Verdi 14");
    assert.equal(primo.sottotipoAsset, "Ufficio");
    assert.equal(primo.prezzo, 1_480_000);
    assert.equal(primo.tipoPrezzo, "richiesta_reoco");
  });

  test("i decimali con la virgola restano decimali", () => {
    const r = importaCsv(CSV, config(), "portafoglio.csv");
    assert.equal(r.immobili[1]!.mq, 640.5);
  });

  test("una colonna che nessun campo usa viene riportata, non ignorata in silenzio", () => {
    const r = importaCsv(CSV, config(), "portafoglio.csv");
    // chi prepara il file deve poter scoprire che un campo non arriva
    assert.ok(r.colonneIgnorate.includes("Note"));
  });

  test("la mappatura esplicita vince sugli alias", () => {
    const csv = "Comune;Valore di perizia;Richiesta\nLodi;900.000;750.000";
    const conMappa = config({ manuale: { cartella: "x", colonne: { prezzoRaw: "Richiesta" } } });
    const r = importaCsv(csv, conMappa, "x.csv");
    // senza la mappatura, "Valore" verrebbe preso per il prezzo: e' il caso in
    // cui l'automatismo sbaglia e va potuto correggere dal config
    assert.equal(r.immobili[0]!.prezzo, 750_000);
  });

  test("una riga senza comune, indirizzo ne' titolo e' rumore dell'export, non un immobile", () => {
    const csv = "Comune;Indirizzo;Prezzo\nCremona;Via Roma 3;100.000\n;;TOTALE 100.000";
    const r = importaCsv(csv, config(), "x.csv");
    assert.equal(r.immobili.length, 1, "la riga di totale non deve diventare un immobile");
  });

  test("un file di cui non si riconosce nessuna colonna lo dice, con i nomi trovati", () => {
    const r = importaCsv("aaa;bbb\n1;2", config(), "strano.csv");
    assert.equal(r.immobili.length, 0);
    assert.match(r.avvisi[0]!, /nessuna colonna riconosciuta/);
    assert.match(r.avvisi[0]!, /aaa, bbb/);
  });

  test("senza id proprio, l'id include il file: due invii non si sovrascrivono", () => {
    const csv = "Comune;Prezzo\nCremona;100.000";
    const a = importaCsv(csv, config(), "gennaio.csv").immobili[0]!;
    const b = importaCsv(csv, config(), "febbraio.csv").immobili[0]!;
    assert.notEqual(a.idEsterno, b.idEsterno);
  });
});

describe("fonte manuale, dalla cartella di consegna", () => {
  test("raccoglie i CSV lasciati nella cartella", async () => {
    const cartella = await mkdtemp(join(tmpdir(), "qdr-import-"));
    await writeFile(
      join(cartella, "portafoglio.csv"),
      "Comune;Indirizzo;Prezzo\nMantova;Via Roma 121;275.500,00",
      "utf-8",
    );

    const r = await new GenericScraper(config({ manuale: { cartella } })).scrape();
    assert.equal(r.items.length, 1);
    assert.equal(r.items[0]!.comune, "Mantova");
    assert.equal(r.items[0]!.prezzo, 275_500);
  });

  test("una cartella che non esiste spiega dove mettere il file, non lamenta un percorso", async () => {
    const r = await new GenericScraper(
      config({ manuale: { cartella: join(tmpdir(), "qdr-cartella-inesistente-xyz") } }),
    ).scrape();
    assert.equal(r.items.length, 0);
    assert.match(r.errors.join(" "), /lasciaci dentro i CSV ricevuti/);
  });

  test("il vaglio di conformita' vale anche per le fonti manuali", async () => {
    const r = await new GenericScraper(config({ compliance: { stato: "da_verificare" } })).scrape();
    assert.equal(r.items.length, 0);
    assert.match(r.errors[0]!, /non e' stata autorizzata/);
  });
});
