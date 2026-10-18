import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Fixture isolate, predisposte *prima* di importare qualunque modulo che legga
// questi percorsi (da qui gli import dinamici piu' sotto).
const dir = mkdtempSync(join(tmpdir(), "qdr-enrich-"));
process.env.QDR_DATA_DIR = dir;
process.env.QDR_DB_PATH = join(dir, "test.db");

// Due zone quadrate attorno al centro di Milano, nel formato che daGeoJson() si aspetta.
writeFileSync(
  join(dir, "zone_omi.geojson"),
  JSON.stringify({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { comune_amm: "F205", zona: "B7" },
        geometry: {
          type: "Polygon",
          coordinates: [[[9.18, 45.46], [9.2, 45.46], [9.2, 45.48], [9.18, 45.48], [9.18, 45.46]]],
        },
      },
    ],
  }),
);
writeFileSync(
  join(dir, "quotazioni_omi.json"),
  JSON.stringify([
    { comuneCod: "F205", zona: "B7", tipologia: "Abitazioni civili", vendMin: 3100, vendMax: 3800, semestre: "2026-1" },
  ]),
);

const { eseguiEnrich } = await import("./enrich.js");
const { db } = await import("./db.js");

/** Inserisce una riga con una chiave_dedup deliberatamente NON ricalcolabile dai suoi
 *  campi: e' il caso che faceva fallire in silenzio gli UPDATE agganciati alla chiave. */
function inserisciImmobile(chiaveDedup: string, campi: Record<string, unknown>): number {
  const now = new Date().toISOString();
  const base: Record<string, unknown> = {
    chiave_dedup: chiaveDedup, fonte: "test", id_esterno: chiaveDedup, titolo: "Immobile di prova",
    lat: null, lon: null, indirizzo_raw: null,
    comune: "Milano", comune_cod: "F205", zona_omi: null, mq: 100, prezzo: 200000,
    tipo_prezzo: "base_asta", valore_perizia: 320000, first_seen_at: now, scraped_at: now,
    ...campi,
  };
  const colonne = Object.keys(base);
  const info = db
    .prepare(`INSERT INTO immobili (${colonne.join(", ")}) VALUES (${colonne.map((c) => `@${c}`).join(", ")})`)
    .run(base as Record<string, string | number | null>);
  return Number(info.lastInsertRowid);
}

describe("coordinate gia' presenti", () => {
  test("la zona si risolve senza geocoding", async () => {
    db.prepare("DELETE FROM immobili").run();
    // punto dentro la zona B7 della fixture, con coordinate note e nessun indirizzo:
    // se il codice geocodificasse, non avendo indirizzo ripiegherebbe sul comune
    const id = inserisciImmobile("COORD|1", {
      indirizzo_raw: null, lat: 45.47, lon: 9.19, zona_omi: null,
    });

    const esito = await eseguiEnrich();
    assert.equal(esito.eseguito, true);

    const riga = db.prepare("SELECT zona_omi, livello_zona FROM immobili WHERE id = ?").get(id) as {
      zona_omi: string; livello_zona: string;
    };
    assert.equal(riga.zona_omi, "B7", "le coordinate vanno usate direttamente");
    assert.equal(riga.livello_zona, "zona");
  });

  test("coordinate fuori dai perimetri noti ripiegano sul comune", async () => {
    db.prepare("DELETE FROM immobili").run();
    const id = inserisciImmobile("COORD|2", { indirizzo_raw: null, lat: 44.0, lon: 8.0, zona_omi: null });
    await eseguiEnrich();
    const riga = db.prepare("SELECT zona_omi, livello_zona FROM immobili WHERE id = ?").get(id) as {
      zona_omi: string; livello_zona: string;
    };
    assert.equal(riga.livello_zona, "comune");
  });
});

describe("enrich: arricchimento OMI e valutazione", () => {
  test("scrive la valutazione anche quando chiave_dedup non e' ricalcolabile dai campi", async () => {
    // il conteggio delle valutazioni va misurato su una tabella nota
    db.prepare("DELETE FROM immobili").run();
    // Chiave RGE memorizzata, ma tribunale/annoRge/numeroRge assenti dalla riga:
    // ricalcolarla darebbe una chiave diversa e l'UPDATE non aggancerebbe nulla.
    const id = inserisciImmobile("RGE|MILANO|2026|4242|1", { zona_omi: "B7" });

    const esito = await eseguiEnrich();
    assert.equal(esito.eseguito, true);

    const riga = db.prepare("SELECT * FROM immobili WHERE id = ?").get(id) as {
      valore_centrale: number | null; sconto_su_valore: number | null; livello_zona: string | null;
    };
    assert.ok(riga.valore_centrale !== null, "la valutazione deve essere stata scritta");
    assert.ok(riga.sconto_su_valore !== null && riga.sconto_su_valore > 0.3);
    assert.equal(riga.livello_zona, "zona");

    // il contatore riflette scritture riuscite, non tentativi
    assert.equal(esito.immobiliValutati, 1);
  });

  test("calcola il prezzo massimo QRE dal massimo OMI di zona", async () => {
    db.prepare("DELETE FROM immobili").run();
    // 100 mq a 3.800 EUR/mq (massimo OMI della fixture): offerta massima circa 212.500 EUR.
    // Base 170.000: l'aggiudicazione attesa (1,20 x base = 204.000) ci sta dentro.
    const id = inserisciImmobile("QRE|1", { zona_omi: "B7", prezzo: 170000 });

    const esito = await eseguiEnrich();
    const riga = db.prepare("SELECT * FROM immobili WHERE id = ?").get(id) as {
      qre_valore_mq: number; qre_pmax_obiettivo: number; qre_pmax_tetto: number; qre_esito: string;
    };
    assert.equal(riga.qre_valore_mq, 3800);
    assert.equal(Math.round(riga.qre_pmax_obiettivo / 1000), 213);
    assert.ok(riga.qre_pmax_tetto > riga.qre_pmax_obiettivo);
    assert.equal(riga.qre_esito, "passa");
    assert.equal(esito.immobiliQre, 1);
  });

  test("una base che regge da sola ma non regge l'asta attesa non passa", async () => {
    db.prepare("DELETE FROM immobili").run();
    // base 200.000 sotto l'offerta massima di 212.500, ma l'asta attesa chiude a 240.000,
    // sopra anche il tetto (circa 231.800, fissato dallo stress test): si vince solo se in pochi
    const id = inserisciImmobile("QRE|2", { zona_omi: "B7", prezzo: 200000 });
    await eseguiEnrich();
    const riga = db.prepare("SELECT qre_esito, qre_prezzo_atteso FROM immobili WHERE id = ?").get(id) as {
      qre_esito: string; qre_prezzo_atteso: number;
    };
    assert.equal(riga.qre_prezzo_atteso, 240000);
    assert.equal(riga.qre_esito, "solo_poca_concorrenza");
  });

  test("un ripiego comunale resta tale a ogni riesecuzione (idempotenza)", async () => {
    db.prepare("DELETE FROM immobili").run();
    // Nessun indirizzo: risolviZona() ripiega sul livello comunale e salva il sentinel "*".
    const id = inserisciImmobile("GEO|SENZA-INDIRIZZO", {});

    const primo = await eseguiEnrich();
    const dopoPrimo = db.prepare("SELECT zona_omi, livello_zona FROM immobili WHERE id = ?").get(id) as {
      zona_omi: string; livello_zona: string;
    };
    assert.equal(dopoPrimo.zona_omi, "*");
    assert.equal(dopoPrimo.livello_zona, "comune");
    assert.equal(primo.immobiliGeocodificati, 0, "un ripiego non conta come zona risolta");

    // Seconda passata: il sentinel "*" gia' in DB non deve essere riletto come zona risolta.
    const secondo = await eseguiEnrich();
    const dopoSecondo = db.prepare("SELECT zona_omi, livello_zona FROM immobili WHERE id = ?").get(id) as {
      zona_omi: string; livello_zona: string;
    };
    assert.equal(dopoSecondo.livello_zona, "comune", "il ripiego non deve promuoversi a 'zona'");
    assert.equal(dopoSecondo.zona_omi, "*");
    assert.equal(secondo.immobiliGeocodificati, 0);
  });
});
