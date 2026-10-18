import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "qdr-esiti-"));
process.env.QDR_DATA_DIR = dir;
process.env.QDR_DB_PATH = join(dir, "test.db");

const { db } = await import("./db.js");
const { EsitoNonValido, famigliaDi, MINIMO_ESITI, moltiplicatorePer, registraEsito } = await import("./esiti.js");
const { MOLTIPLICATORE_DEFAULT, MOLTIPLICATORE_TRATTATIVA_DEFAULT } = await import("./qre.js");

function inserisci(campi: Record<string, string | number | null>): number {
  const now = new Date().toISOString();
  const base = { chiave_dedup: `T|${Math.random()}`, fonte: "demanio", id_esterno: "x", prezzo: 100_000, first_seen_at: now, scraped_at: now, ...campi };
  const col = Object.keys(base);
  return Number(db.prepare(`INSERT INTO immobili (${col.join(", ")}) VALUES (${col.map((c) => `@${c}`).join(", ")})`).run(base).lastInsertRowid);
}

describe("esiti delle aste e calibrazione del prezzo atteso", () => {
  test("la famiglia separa giudiziarie, statali e il resto", () => {
    const r = (fonte: string, tipo: string | null, rge: number | null = null) =>
      famigliaDi({ fonte, tribunale: rge ? "Milano" : null, numero_rge: rge, tipo_prezzo: tipo });
    assert.equal(r("reperform", "base_asta", 12), "giudiziaria");
    assert.equal(r("demanio", "base_asta"), "statale");
    assert.equal(r("bnl_immobili", "richiesta_reoco"), "trattativa");
    assert.equal(r("quimmo", "base_asta"), "asta");
    assert.equal(r("sconosciuta", null), "asta", "prezzo di tipo ignoto: ipotesi prudente, si tratta come gara");
  });

  test("sotto la soglia minima di esiti resta il default, e lo dice", () => {
    db.prepare("DELETE FROM esiti_aste").run();
    registraEsito(inserisci({}), 105_000);
    const m = moltiplicatorePer("statale");
    assert.equal(m.valore, MOLTIPLICATORE_DEFAULT.valore);
    assert.match(m.fonte, /1 esiti statale/);
  });

  test("superata la soglia, il moltiplicatore e' la mediana osservata", () => {
    db.prepare("DELETE FROM esiti_aste").run();
    const rapporti = [1.0, 1.05, 1.1, 1.3, 1.02];
    assert.equal(rapporti.length, MINIMO_ESITI);
    for (const r of rapporti) registraEsito(inserisci({}), 100_000 * r);
    const m = moltiplicatorePer("statale");
    assert.ok(Math.abs(m.valore - 1.05) < 1e-9);
    assert.equal(m.n, 5);
    // le giudiziarie non ereditano gli esiti delle statali
    assert.equal(moltiplicatorePer("giudiziaria").valore, MOLTIPLICATORE_DEFAULT.valore);
  });

  test("la trattativa parte da 0,90 x richiesta, non da 1,20 x base", () => {
    db.prepare("DELETE FROM esiti_aste").run();
    assert.equal(moltiplicatorePer("trattativa"), MOLTIPLICATORE_TRATTATIVA_DEFAULT);
    assert.equal(moltiplicatorePer("trattativa").valore, 0.9);
  });

  test("senza prezzo base il rapporto non si puo' calcolare: errore esplicito", () => {
    assert.throws(() => registraEsito(inserisci({ prezzo: null }), 100_000), EsitoNonValido);
    assert.throws(() => registraEsito(999_999, 100_000), EsitoNonValido);
  });
});
