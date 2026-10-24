/**
 * Comando di migrazione. Entrata separata dalla CLI principale: NON importa il modulo del
 * database, quindi non apre ne' modifica nessun database all'avvio.
 *
 *   npm run migra -- analizza <db>
 *   npm run migra -- copia <db> <backup>
 *   npm run migra -- prova <db> <cartella-di-lavoro>    backup + migrazione su copia + ripristino provato
 *   npm run migra -- applica <db> <backup> --conferma   migra il database vero, dopo il backup
 *   npm run migra -- ripristina <backup> <db> <sha256>
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { analizza, copiaVerificata, migra, ripristina, sha256File } from "./migra.js";

const [cmd, a, b, c] = process.argv.slice(2);
const stampa = (x: unknown) => console.log(JSON.stringify(x, null, 2));

switch (cmd) {
  case "analizza":
    if (!a) throw new Error("uso: analizza <db>");
    stampa(analizza(a));
    break;
  case "copia":
    if (!a || !b) throw new Error("uso: copia <db> <backup>");
    stampa(copiaVerificata(a, b));
    break;
  case "prova": {
    if (!a || !b) throw new Error("uso: prova <db> <cartella-di-lavoro>");
    mkdirSync(b, { recursive: true });
    const backup = join(b, "backup.db");
    const copia = join(b, "copia-migrata.db");
    const bk = copiaVerificata(a, backup);
    copyFileSync(backup, copia);
    const esito = migra(copia);
    // ripristino provato: si riporta il backup su un file diverso e si confronta il checksum
    const prova = ripristina(backup, join(b, "ripristinato.db"), bk.sha256);
    stampa({ backup: bk, migrazione: esito, ripristino: { checksumUguale: prova.sha256 === bk.sha256 } });
    break;
  }
  case "applica": {
    if (!a || !b) throw new Error("uso: applica <db> <backup> --conferma");
    if (!process.argv.includes("--conferma")) throw new Error("Migrazione del database vero: serve --conferma esplicita.");
    const bk = copiaVerificata(a, b);
    console.log(`Backup creato: ${b}\nsha256: ${bk.sha256}`);
    stampa(migra(a));
    break;
  }
  case "ripristina":
    if (!a || !b || !c) throw new Error("uso: ripristina <backup> <db> <sha256>");
    stampa(ripristina(a, b, c));
    break;
  default:
    console.error("Comandi: analizza, copia, prova, applica, ripristina");
    process.exit(2);
}
void sha256File;
