import Database from "better-sqlite3";
import type { Database as DatabaseType } from "better-sqlite3";

import { DB_PATH } from "./paths.js";

export const db: DatabaseType = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
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

CREATE INDEX IF NOT EXISTS ix_immobili_fonte ON immobili(fonte);
CREATE INDEX IF NOT EXISTS ix_immobili_comune ON immobili(comune);
CREATE INDEX IF NOT EXISTS ix_immobili_sconto ON immobili(sconto_su_valore);
`);
