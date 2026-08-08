import { DatabaseSync } from "node:sqlite";

import { DB_PATH } from "./paths.js";

/*
 * SQLite integrato in Node, non un modulo nativo da compilare.
 *
 * La scelta e' deliberata: con better-sqlite3 l'installazione richiedeva un
 * binario precompilato per la versione di Node in uso, e dove non esisteva
 * (versioni appena uscite) ricadeva su node-gyp, quindi su Visual Studio e
 * Windows SDK. Un'app che si installa solo se hai un compilatore C++ e' fragile
 * per chi la usa. node:sqlite non ha dipendenze da compilare.
 */
export const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL");

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
`);
