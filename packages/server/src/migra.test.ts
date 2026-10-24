/**
 * Migrazione dei dati gia' fusi dalla vecchia deduplica (schema v0 -> v2).
 * Il database di partenza e' SINTETICO e viene creato con lo schema precedente.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { analizza, copiaVerificata, migra, ripristina, sha256File } from "./migra.js";

const SCHEMA_PRECEDENTE = `
CREATE TABLE IF NOT EXISTS immobili (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chiave_dedup TEXT NOT NULL UNIQUE,

  fonte TEXT NOT NULL,
  id_esterno TEXT NOT NULL,
  url TEXT,
  titolo TEXT,
  immagine_url TEXT,

  tribunale TEXT,
  anno_rge INTEGER,
  numero_rge INTEGER,
  numero_lotto TEXT,

  indirizzo_raw TEXT,
  indirizzo_norm TEXT,
  civico TEXT,
  comune TEXT,
  comune_cod TEXT,

  lat REAL,
  lon REAL,
  precisione_geo TEXT,
  livello_zona TEXT,

  mq REAL,
  locali INTEGER,
  zona_omi TEXT,
  tipologia_omi TEXT,

  tipo_vendita TEXT,
  prezzo REAL,
  tipo_prezzo TEXT,
  valore_perizia REAL,
  n_esperimenti_deserti INTEGER,

  data_asta TEXT,
  termine_offerte TEXT,

  stato_occupazionale TEXT,
  conformita_urb TEXT,
  vincolo_culturale INTEGER,
  sottotipo_asset TEXT,

  fonti_json TEXT,
  note_merge_json TEXT,

  -- esito di valuta() da @qdr/core, riempito da 'npm run enrich'
  valore_centrale REAL,
  divergenza REAL,
  sconto_su_valore REAL,
  praticabile INTEGER,
  flags_json TEXT,

  first_seen_at TEXT NOT NULL,
  scraped_at TEXT NOT NULL
);

-- Storico dei prezzi: una riga per ogni variazione rilevata, non per ogni scraping.
--
-- Serve perche' il lavoro reale e' in buona parte attendere il ribasso: senza
-- storico, ogni ciclo sovrascriverebbe il prezzo precedente e l'informazione su
-- quanto e quando un immobile e' calato sarebbe irrecuperabile. E' anche il
-- segnale piu' diretto di un venditore motivato.
CREATE TABLE IF NOT EXISTS storico_prezzi (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  immobile_id INTEGER NOT NULL REFERENCES immobili(id) ON DELETE CASCADE,
  prezzo REAL NOT NULL,
  tipo_prezzo TEXT,
  rilevato_il TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_storico_immobile ON storico_prezzi(immobile_id, rilevato_il);

CREATE INDEX IF NOT EXISTS ix_immobili_fonte ON immobili(fonte);
-- identita' stabile dell'annuncio: usata dall'upsert quando chiave_dedup e' derivata
CREATE INDEX IF NOT EXISTS ix_immobili_origine ON immobili(fonte, id_esterno);
CREATE INDEX IF NOT EXISTS ix_immobili_comune ON immobili(comune);
CREATE INDEX IF NOT EXISTS ix_immobili_sconto ON immobili(sconto_su_valore);
`;

function creaDatabasePrecedente(percorso: string): void {
  const db = new DatabaseSync(percorso);
  db.exec(SCHEMA_PRECEDENTE);
  const ins = db.prepare(
    "INSERT INTO immobili (chiave_dedup, fonte, id_esterno, indirizzo_raw, comune, mq, locali, fonti_json, first_seen_at, scraped_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  // 1) due annunci fusi dalla vecchia deduplica per sola somiglianza (chiave geografica): da verificare
  ins.run("GEO|TESTOPOLI|VIA PROVA|10|80|3", "reperform", "r1", "Via Prova 10 int. 2", "Testopoli", 80, 3, '["reperform","portale"]', "2026-01-01", "2026-10-01");
  // 2) due fonti sulla stessa procedura: fusione per identificativo, non sospetta
  ins.run("RGE|MILANO|2030|9|1", "pvp", "v1", "Via Lotto 1", "Lottopoli", 70, 2, '["pvp","portale"]', "2026-01-02", "2026-10-01");
  // 3) riga semplice con storia dei prezzi
  ins.run("FONTE|portale|p1", "portale", "p1", "Via Storia 1", "Storicopoli", 60, 2, '["portale"]', "2026-01-03", "2026-10-01");
  db.exec("INSERT INTO storico_prezzi (immobile_id, prezzo, tipo_prezzo, rilevato_il) VALUES (3, 100000, 'richiesta_reoco', '2026-01-03'), (3, 90000, 'richiesta_reoco', '2026-05-03')");
  db.close();
}

const dir = mkdtempSync(join(tmpdir(), "qdr-migra-"));
const sorgente = join(dir, "produzione-sintetica.db");
creaDatabasePrecedente(sorgente);

describe("migrazione su copia", () => {
  test("l'analisi e' di sola lettura e segnala le fusioni per sola somiglianza", () => {
    const prima = sha256File(sorgente);
    const a = analizza(sorgente);
    assert.equal(a.immobili, 3);
    assert.equal(a.versioneSchema, 0);
    assert.equal(a.fuseSolaSomiglianza.length, 1);
    assert.equal(a.fuseSolaSomiglianza[0]!.chiave.startsWith("GEO|"), true);
    assert.equal(a.fuseConProcedura, 1);
    assert.equal(sha256File(sorgente), prima, "l'analisi non deve modificare il database");
  });

  test("backup verificato, migrazione sulla copia, originale intatto, ripristino provato", () => {
    const shaOriginale = sha256File(sorgente);
    const backup = join(dir, "backup.db");
    const bk = copiaVerificata(sorgente, backup);
    assert.equal(bk.integrita, "ok");
    assert.equal(bk.immobili, 3);

    const copia = join(dir, "copia.db");
    copyFileSync(backup, copia);
    const esito = migra(copia);
    for (const v of esito.verifiche) assert.equal(v.esito, "verificato", v.controllo);
    assert.equal(esito.prima.immobili, esito.dopo.immobili);
    assert.equal(esito.prima.storicoPrezzi, 2);
    assert.equal(esito.dopo.storicoPrezzi, 2);
    assert.equal(esito.segnateDaVerificare, 1);

    const db = new DatabaseSync(copia, { readOnly: true });
    const segnate = db.prepare("SELECT id FROM immobili WHERE fusione_da_verificare = 1").all();
    assert.equal(segnate.length, 1);
    const interno = db.prepare("SELECT interno FROM immobili WHERE id = 1").get() as { interno: string | null };
    assert.equal(interno.interno, "2", "l'identita' dell'unita' si ricava dall'indirizzo grezzo");
    db.close();

    assert.equal(sha256File(sorgente), shaOriginale, "l'originale resta identico finche' non si applica sul serio");

    // ripristino provato: dopo una migrazione applicata al "vero", il backup riporta ai dati di partenza
    const vero = join(dir, "vero.db");
    copyFileSync(sorgente, vero);
    migra(vero);
    assert.notEqual(sha256File(vero), shaOriginale);
    const r = ripristina(backup, vero, bk.sha256);
    assert.equal(r.sha256, bk.sha256);
    const ripristinato = analizza(vero);
    assert.equal(ripristinato.versioneSchema, 0);
    assert.equal(ripristinato.immobili, 3);
  });

  test("una seconda migrazione su un database gia' alla versione attuale e' rifiutata e non lo modifica", () => {
    const gia = join(dir, "gia-migrato.db");
    copyFileSync(sorgente, gia);
    migra(gia);
    const prima = sha256File(gia);
    assert.throws(() => migra(gia), /gia' alla versione/);
    assert.equal(sha256File(gia), prima);
  });

  test("un backup con checksum diverso non viene ripristinato", () => {
    const backup = join(dir, "backup.db");
    assert.throws(() => ripristina(backup, join(dir, "x.db"), "0".repeat(64)), /checksum/);
  });

  test("la copia non sovrascrive un file esistente", () => {
    assert.throws(() => copiaVerificata(sorgente, join(dir, "backup.db")), /esiste gia/);
  });
});

describe("avvio su un database precedente", () => {
  test("il server NON lo modifica da solo e indica il comando da eseguire", () => {
    const prima = sha256File(sorgente);
    const r = spawnSync(process.execPath, ["--input-type=module", "-e", 'await import("./db.js")'], {
      cwd: new URL(".", import.meta.url).pathname,
      env: { ...process.env, QDR_DB_PATH: sorgente, QDR_DATA_DIR: dir },
      encoding: "utf8",
    });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /npm run migra/);
    assert.equal(sha256File(sorgente), prima, "database non modificato");
  });

  test("con QDR_ACCETTA_MIGRAZIONE=1 l'avvio applica lo schema (scelta esplicita)", () => {
    const copia = join(dir, "avvio-esplicito.db");
    copyFileSync(sorgente, copia);
    const r = spawnSync(process.execPath, ["--input-type=module", "-e", 'await import("./db.js")'], {
      cwd: new URL(".", import.meta.url).pathname,
      env: { ...process.env, QDR_DB_PATH: copia, QDR_DATA_DIR: dir, QDR_ACCETTA_MIGRAZIONE: "1" },
      encoding: "utf8",
    });
    assert.equal(r.status, 0, r.stderr);
  });
});

void execFileSync;
