#!/usr/bin/env node
/**
 * node scripts/controlli-calendario.mjs [--oggi 2026-10-24] [--metricool snapshot.jsonl] [--json]
 * Esce con 1 se ci sono errori (voci future non conformi, scollamenti con Metricool).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { controllaVoce, riconcilia, riepilogo } from "./lib/controlli.mjs";

const radice = join(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const oggi = new Date(arg("--oggi") ?? new Date().toISOString().slice(0, 10) + "T00:00:00Z");
const voci = JSON.parse(readFileSync(join(radice, "marketing/calendario-pubblicazioni.json"), "utf8")).contenuti;

let esiti = voci.flatMap((e) => controllaVoce(e, oggi));
const snap = arg("--metricool");
if (snap) {
  const righe = readFileSync(snap, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  esiti = esiti.concat(riconcilia(voci, righe, oggi));
}
const per = riepilogo(esiti);
if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ oggi: oggi.toISOString().slice(0, 10), voci: voci.length, riepilogo: per, esiti }, null, 1));
} else {
  console.log(`Voci: ${voci.length} | oggi: ${oggi.toISOString().slice(0, 10)} | ${Object.entries(per).map(([k, v]) => `${k}: ${v}`).join(", ") || "nessun rilievo"}`);
  for (const livello of ["errore", "attribuzione", "non_verificato", "bozza_orfana"]) {
    const l = esiti.filter((e) => e.livello === livello);
    if (!l.length) continue;
    console.log(`\n## ${livello} (${l.length})`);
    for (const e of l.slice(0, 40)) console.log(`- ${e.id} [${e.regola}] ${e.dettaglio}`);
    if (l.length > 40) console.log(`... e altre ${l.length - 40}`);
  }
}
process.exit(per.errore ? 1 : 0);
