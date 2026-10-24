/**
 * Migrazione dei dati gia' presenti (schema precedente alla versione 2).
 *
 * Non tocca mai un database senza averlo copiato e verificato. Il flusso e':
 *   1. analizza    sola lettura: quali righe la vecchia deduplica puo' aver fuso per sola somiglianza
 *   2. copia       backup con checksum SHA-256 e controllo di integrita'
 *   3. migra       applica la migrazione a una COPIA e verifica che nulla sia andato perso
 *   4. ripristina  riporta un backup sul database, controllando il checksum
 *
 * Cosa NON si puo' ricostruire: se la vecchia deduplica ha fuso due annunci in una riga e ha
 * eliminato l'altra, l'originale non esiste piu' nel database. La riga resta, segnata
 * "fusione_da_verificare", e serve riprendere i dati dalle fonti o da un backup precedente.
 */
import { copyFileSync, existsSync, readFileSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

import { chiaveArchivio, identitaUnita } from "@qdr/core";
import type { ImmobileNorm } from "@qdr/core";

import { applicaSchema, VERSIONE_SCHEMA } from "./schema.js";

export function sha256File(percorso: string): string {
  return createHash("sha256").update(readFileSync(percorso)).digest("hex");
}

function apri(percorso: string, soloLettura = false): DatabaseSync {
  if (!existsSync(percorso)) throw new Error(`Database non trovato: ${percorso}`);
  return new DatabaseSync(percorso, { readOnly: soloLettura });
}

const num = (db: DatabaseSync, sql: string): number => Number((db.prepare(sql).get() as { n: number }).n);

export interface RigaSospetta {
  id: number;
  chiave: string;
  fonti: string[];
  comune: string | null;
  motivo: string;
}

export interface Analisi {
  database: string;
  versioneSchema: number;
  immobili: number;
  storicoPrezzi: number;
  righeConPiuFonti: number;
  fuseSolaSomiglianza: RigaSospetta[];
  fuseConProcedura: number;
}

/** Sola lettura. Non scrive niente nel database. */
export function analizza(percorso: string): Analisi {
  const db = apri(percorso, true);
  try {
    const righe = db.prepare("SELECT id, chiave_dedup, fonti_json, comune FROM immobili").all() as unknown as Array<{ id: number; chiave_dedup: string; fonti_json: string | null; comune: string | null }>;
    const sospette: RigaSospetta[] = [];
    let conProcedura = 0;
    let conPiuFonti = 0;
    for (const r of righe) {
      const fonti: string[] = r.fonti_json ? JSON.parse(r.fonti_json) : [];
      if (fonti.length < 2) continue;
      conPiuFonti++;
      if (r.chiave_dedup.startsWith("RGE|")) conProcedura++;
      else
        sospette.push({
          id: r.id, chiave: r.chiave_dedup, fonti, comune: r.comune,
          motivo: "fusa per sola somiglianza di indirizzo, superficie e locali: potrebbe contenere piu' beni",
        });
    }
    return {
      database: percorso,
      versioneSchema: (db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version,
      immobili: righe.length,
      storicoPrezzi: num(db, "SELECT COUNT(*) AS n FROM storico_prezzi"),
      righeConPiuFonti: conPiuFonti,
      fuseSolaSomiglianza: sospette,
      fuseConProcedura: conProcedura,
    };
  } finally {
    db.close();
  }
}

export interface EsitoCopia {
  origine: string;
  copia: string;
  sha256: string;
  immobili: number;
  integrita: string;
}

/** Copia coerente (VACUUM INTO) con checksum e controllo di integrita'. */
export function copiaVerificata(origine: string, destinazione: string): EsitoCopia {
  if (existsSync(destinazione)) throw new Error(`La destinazione esiste gia': ${destinazione}. Non la sovrascrivo.`);
  const db = apri(origine, true);
  try {
    db.exec(`VACUUM INTO '${destinazione.replace(/'/g, "''")}'`);
  } finally {
    db.close();
  }
  const c = apri(destinazione, true);
  try {
    const integrita = (c.prepare("PRAGMA integrity_check").get() as { integrity_check: string }).integrity_check;
    if (integrita !== "ok") throw new Error(`La copia non supera il controllo di integrita': ${integrita}`);
    return { origine, copia: destinazione, sha256: sha256File(destinazione), immobili: num(c, "SELECT COUNT(*) AS n FROM immobili"), integrita };
  } finally {
    c.close();
  }
}

function comeImmobile(r: Record<string, unknown>): ImmobileNorm {
  return {
    fonte: String(r.fonte), idEsterno: String(r.id_esterno),
    tribunale: r.tribunale as string | null, annoRge: r.anno_rge as number | null, numeroRge: r.numero_rge as number | null,
    numeroLotto: r.numero_lotto as string | null, indirizzoRaw: r.indirizzo_raw as string | null,
    indirizzoNorm: r.indirizzo_norm as string | null, civico: r.civico as string | null, comune: r.comune as string | null,
    mq: r.mq as number | null, locali: r.locali as number | null,
    interno: r.interno as string | null, scala: r.scala as string | null, piano: r.piano as string | null, subalterno: r.subalterno as string | null,
  };
}

export interface EsitoMigrazione {
  database: string;
  prima: { immobili: number; storicoPrezzi: number };
  dopo: { immobili: number; storicoPrezzi: number; origini: number };
  chiaviRiallineate: number;
  chiaviInConflitto: number;
  segnateDaVerificare: number;
  verifiche: Array<{ controllo: string; esito: "verificato" | "fallito" }>;
}

/**
 * Applica la migrazione al database indicato (che deve essere una COPIA). Poi verifica:
 * stesso numero di immobili e di prezzi storici, integrita', nessuna riga persa.
 */
export function migra(percorso: string): EsitoMigrazione {
  const db = apri(percorso);
  try {
    // una seconda migrazione riscriverebbe le origini fuse con la sola origine propria
    const versione = (db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version;
    if (versione >= VERSIONE_SCHEMA) {
      throw new Error(`Il database ${percorso} e' gia' alla versione ${versione}: nessuna migrazione da applicare, e rieseguirla perderebbe le origini fuse.`);
    }
    const primaImm = num(db, "SELECT COUNT(*) AS n FROM immobili");
    const primaSt = num(db, "SELECT COUNT(*) AS n FROM storico_prezzi");
    const idPrima = (db.prepare("SELECT id FROM immobili ORDER BY id").all() as unknown as Array<{ id: number }>).map((r) => r.id);

    db.exec("BEGIN");
    let riallineate = 0, conflitto = 0, segnate = 0;
    try {
      applicaSchema(db);
      const righe = db.prepare("SELECT * FROM immobili").all() as unknown as Array<Record<string, unknown>>;
      const usate = new Set(righe.map((r) => String(r.chiave_dedup)));
      const upd = db.prepare("UPDATE immobili SET interno = ?, scala = ?, piano = ?, subalterno = ?, id_fonti_json = ?, chiave_dedup = ?, fusione_da_verificare = ? WHERE id = ?");
      for (const r of righe) {
        const i = comeImmobile(r);
        const u = identitaUnita(i);
        const fonti: string[] = r.fonti_json ? JSON.parse(String(r.fonti_json)) : [];
        const sospetta = fonti.length > 1 && String(r.chiave_dedup).startsWith("GEO|");
        // la nuova chiave, solo se libera: in caso di conflitto resta quella esistente
        const nuova = chiaveArchivio({ ...i, ...u });
        let chiave = String(r.chiave_dedup);
        if (nuova !== chiave) {
          if (usate.has(nuova)) conflitto++;
          else { usate.delete(chiave); usate.add(nuova); chiave = nuova; riallineate++; }
        }
        if (sospetta) segnate++;
        upd.run(u.interno, u.scala, u.piano, u.subalterno, JSON.stringify([`${i.fonte}:${i.idEsterno}`]), chiave, sospetta ? 1 : 0, Number(r.id));
      }
      db.exec("INSERT OR IGNORE INTO origini_immobile (fonte, id_esterno, immobile_id) SELECT fonte, id_esterno, id FROM immobili");
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }

    const dopoImm = num(db, "SELECT COUNT(*) AS n FROM immobili");
    const dopoSt = num(db, "SELECT COUNT(*) AS n FROM storico_prezzi");
    const idDopo = (db.prepare("SELECT id FROM immobili ORDER BY id").all() as unknown as Array<{ id: number }>).map((r) => r.id);
    const integrita = (db.prepare("PRAGMA integrity_check").get() as { integrity_check: string }).integrity_check;
    const verifiche: EsitoMigrazione["verifiche"] = [
      { controllo: "stesso numero di immobili", esito: dopoImm === primaImm ? "verificato" : "fallito" },
      { controllo: "stessi identificativi di riga", esito: JSON.stringify(idPrima) === JSON.stringify(idDopo) ? "verificato" : "fallito" },
      { controllo: "storico prezzi intatto", esito: dopoSt === primaSt ? "verificato" : "fallito" },
      { controllo: "versione schema aggiornata", esito: (db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version === VERSIONE_SCHEMA ? "verificato" : "fallito" },
      { controllo: "controllo di integrita' del database", esito: integrita === "ok" ? "verificato" : "fallito" },
      { controllo: "ogni riga ha almeno la sua origine registrata", esito: num(db, "SELECT COUNT(*) AS n FROM immobili i WHERE NOT EXISTS (SELECT 1 FROM origini_immobile o WHERE o.immobile_id = i.id)") === 0 ? "verificato" : "fallito" },
    ];
    return {
      database: percorso,
      prima: { immobili: primaImm, storicoPrezzi: primaSt },
      dopo: { immobili: dopoImm, storicoPrezzi: dopoSt, origini: num(db, "SELECT COUNT(*) AS n FROM origini_immobile") },
      chiaviRiallineate: riallineate,
      chiaviInConflitto: conflitto,
      segnateDaVerificare: segnate,
      verifiche,
    };
  } finally {
    db.close();
  }
}

/** Riporta un backup sul database, solo se il checksum del backup coincide con quello atteso. */
export function ripristina(backup: string, destinazione: string, sha256Atteso: string): { sha256: string } {
  const attuale = sha256File(backup);
  if (attuale !== sha256Atteso) throw new Error(`Il backup non coincide con il checksum atteso (${attuale} invece di ${sha256Atteso}). Non ripristino.`);
  for (const suffisso of ["-wal", "-shm"]) if (existsSync(destinazione + suffisso)) rmSync(destinazione + suffisso);
  copyFileSync(backup, destinazione);
  return { sha256: sha256File(destinazione) };
}
