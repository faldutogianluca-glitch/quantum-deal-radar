import { DatabaseSync } from "node:sqlite";

import { DB_PATH } from "./paths.js";
import { applicaSchema, VERSIONE_SCHEMA } from "./schema.js";

export { applicaSchema, VERSIONE_SCHEMA } from "./schema.js";

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

/*
 * Un database con dati e uno schema precedente NON si modifica da solo all'avvio:
 * la migrazione tocca l'identita' dei beni e va fatta con backup e su una copia
 * (npm run migra). I database nuovi, o gia' alla versione attuale, partono normalmente.
 */
const tabellaEsiste = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'immobili'").get() !== undefined;
const versione = (db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version;
const righe = tabellaEsiste ? Number((db.prepare("SELECT COUNT(*) AS n FROM immobili").get() as { n: number }).n) : 0;
if (tabellaEsiste && righe > 0 && versione < VERSIONE_SCHEMA && process.env.QDR_ACCETTA_MIGRAZIONE !== "1") {
  throw new Error(
    `Il database ${DB_PATH} ha ${righe} immobili e uno schema precedente (versione ${versione}, attesa ${VERSIONE_SCHEMA}). ` +
      `Non viene modificato in automatico. Esegui prima: npm run migra -- analizza "${DB_PATH}"`,
  );
}

// WAL si imposta solo dopo il controllo: cambiarlo modifica l'intestazione del file, e un
// database che rifiutiamo di aprire non deve risultare toccato.
db.exec("PRAGMA journal_mode = WAL");
applicaSchema(db);
