import type { DatabaseSync } from "node:sqlite";

/*
 * Schema del database. Separato da db.ts perche' non ha effetti collaterali: importarlo
 * non apre nessun database. Serve alla migrazione, che lo applica a una COPIA.
 */

export const SCHEMA_BASE_SQL = `
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

export const VERSIONE_SCHEMA = 2;

/**
 * Evoluzioni dello schema, idempotenti: si possono rieseguire su un database gia'
 * aggiornato. Esportata perche' la migrazione dei dati esistenti la applica a una
 * COPIA del database prima di toccare l'originale (vedi migra.ts).
 *
 * Versione 2 (24/10/2026): identita' dell'unita' (interno, scala, piano, subalterno),
 * tutte le origini fuse in una riga, candidati duplicati da verificare, e il segno
 * "fusione_da_verificare" per le righe che la vecchia deduplica aveva fuso per
 * sola somiglianza geografica.
 */
export function applicaSchema(database: DatabaseSync): void {
  database.exec(SCHEMA_BASE_SQL);
  const colonne = new Set(
    (database.prepare("PRAGMA table_info(immobili)").all() as Array<{ name: string }>).map((c) => c.name),
  );
  for (const [nome, tipo] of [
    ["interno", "TEXT"], ["scala", "TEXT"], ["piano", "TEXT"], ["subalterno", "TEXT"],
    ["id_fonti_json", "TEXT"], ["fusione_da_verificare", "INTEGER NOT NULL DEFAULT 0"],
  ] as const) {
    if (!colonne.has(nome)) database.exec(`ALTER TABLE immobili ADD COLUMN ${nome} ${tipo}`);
  }
  database.exec(`
CREATE TABLE IF NOT EXISTS origini_immobile (
  fonte TEXT NOT NULL,
  id_esterno TEXT NOT NULL,
  immobile_id INTEGER NOT NULL REFERENCES immobili(id) ON DELETE CASCADE,
  PRIMARY KEY (fonte, id_esterno)
);
CREATE INDEX IF NOT EXISTS ix_origini_immobile ON origini_immobile(immobile_id);

CREATE TABLE IF NOT EXISTS candidati_duplicato (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  origine_a TEXT NOT NULL,
  origine_b TEXT NOT NULL,
  motivo TEXT NOT NULL,
  stato TEXT NOT NULL DEFAULT 'aperto',
  rilevato_il TEXT NOT NULL,
  aggiornato_il TEXT NOT NULL,
  UNIQUE (origine_a, origine_b)
);

INSERT OR IGNORE INTO origini_immobile (fonte, id_esterno, immobile_id)
  SELECT fonte, id_esterno, id FROM immobili;
`);
  database.exec(`PRAGMA user_version = ${VERSIONE_SCHEMA}`);
}

