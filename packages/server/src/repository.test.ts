import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "qdr-repo-"));
process.env.QDR_DATA_DIR = dir;
process.env.QDR_DB_PATH = join(dir, "test.db");

const { db } = await import("./db.js");
const { getImmobile, listFonti, listImmobili } = await import("./repository.js");

let contatore = 0;

function inserisci(campi: Record<string, unknown> = {}): number {
  contatore++;
  const base: Record<string, unknown> = {
    chiave_dedup: `K-${contatore}`,
    fonte: "pvp",
    id_esterno: `e-${contatore}`,
    titolo: `Immobile ${contatore}`,
    comune: "Milano",
    prezzo: 100_000,
    praticabile: null,
    first_seen_at: "2026-01-01T00:00:00.000Z",
    scraped_at: `2026-01-0${contatore}T00:00:00.000Z`,
    ...campi,
  };
  const colonne = Object.keys(base);
  const info = db
    .prepare(`INSERT INTO immobili (${colonne.join(", ")}) VALUES (${colonne.map((c) => `@${c}`).join(", ")})`)
    .run(base);
  return Number(info.lastInsertRowid);
}

let idMilano = 0;

before(() => {
  idMilano = inserisci({ comune: "Milano", prezzo: 100_000, fonte: "pvp", praticabile: 1 });
  inserisci({ comune: "Sesto San Giovanni", prezzo: 250_000, fonte: "reperform", praticabile: 0 });
  inserisci({ comune: "Monza", prezzo: 500_000, fonte: "pvp", praticabile: null });
});

describe("listImmobili: filtri", () => {
  test("senza filtri restituisce tutto, dal piu' recente", () => {
    const righe = listImmobili();
    assert.equal(righe.length, 3);
    const date = righe.map((r) => r.scraped_at);
    assert.deepEqual(date, [...date].sort().reverse(), "ordinamento per scraped_at DESC");
  });

  test("filtro per fonte", () => {
    assert.deepEqual(listImmobili({ fonte: "pvp" }).map((r) => r.fonte), ["pvp", "pvp"]);
    assert.equal(listImmobili({ fonte: "reperform" }).length, 1);
    assert.equal(listImmobili({ fonte: "inesistente" }).length, 0);
  });

  test("filtro per comune: parziale e insensibile al maiuscolo", () => {
    assert.equal(listImmobili({ comune: "Milano" }).length, 1);
    assert.equal(listImmobili({ comune: "milano" }).length, 1, "LIKE e' case-insensitive su ASCII");
    assert.equal(listImmobili({ comune: "Sesto" }).length, 1, "corrispondenza parziale");
    assert.equal(listImmobili({ comune: "San Giovanni" }).length, 1, "anche a meta' stringa");
  });

  test("filtri di prezzo, singoli e combinati", () => {
    assert.equal(listImmobili({ prezzoMin: 250_000 }).length, 2);
    assert.equal(listImmobili({ prezzoMax: 250_000 }).length, 2);
    assert.equal(listImmobili({ prezzoMin: 200_000, prezzoMax: 300_000 }).length, 1);
    assert.equal(listImmobili({ prezzoMin: 600_000 }).length, 0);
  });

  test("prezzoMin a 0 e' un filtro attivo, non un valore assente", () => {
    // `if (f.prezzoMin !== undefined)`: uno 0 deve passare il controllo.
    assert.equal(listImmobili({ prezzoMin: 0 }).length, 3);
  });

  test("soloPraticabili tiene i NULL e scarta gli 0", () => {
    // NULL = non ancora valutato: nasconderlo farebbe sparire tutto prima dell'enrich.
    const righe = listImmobili({ soloPraticabili: true });
    assert.equal(righe.length, 2);
    assert.ok(righe.every((r) => r.praticabile === null || r.praticabile === 1));
  });

  test("soloPraticabili a false non filtra", () => {
    assert.equal(listImmobili({ soloPraticabili: false }).length, 3);
  });

  test("filtri combinati si sommano in AND", () => {
    assert.equal(listImmobili({ fonte: "pvp", prezzoMin: 200_000 }).length, 1);
    assert.equal(listImmobili({ fonte: "pvp", comune: "Sesto" }).length, 0);
  });
});

describe("listImmobili: limite", () => {
  test("il limite richiesto viene rispettato", () => {
    assert.equal(listImmobili({ limit: 2 }).length, 2);
    assert.equal(listImmobili({ limit: 1 }).length, 1);
  });

  test("valori non positivi vengono portati a 1", () => {
    // In SQLite LIMIT -1 significa "nessun limite": senza il clamp,
    // ?limit=-1 restituirebbe l'intera tabella.
    assert.equal(listImmobili({ limit: -1 }).length, 1);
    assert.equal(listImmobili({ limit: 0 }).length, 1);
  });

  test("un limite enorme viene tagliato al massimo consentito", () => {
    assert.equal(listImmobili({ limit: 10_000 }).length, 3, "3 righe in tabella, nessun errore");
  });

  test("un limite decimale viene troncato", () => {
    assert.equal(listImmobili({ limit: 2.9 }).length, 2);
  });

  test("NaN e Infinity ricadono sul limite di default", () => {
    assert.equal(listImmobili({ limit: Number.NaN }).length, 3);
    assert.equal(listImmobili({ limit: Number.POSITIVE_INFINITY }).length, 3);
  });
});

describe("getImmobile", () => {
  test("id esistente -> riga", () => {
    assert.equal(getImmobile(idMilano)?.comune, "Milano");
  });

  test("id inesistente -> undefined", () => {
    assert.equal(getImmobile(999_999), undefined);
  });
});

describe("listFonti", () => {
  test("fonti distinte e ordinate", () => {
    assert.deepEqual(listFonti(), ["pvp", "reperform"], "'pvp' compare due volte ma va elencata una sola");
  });
});
