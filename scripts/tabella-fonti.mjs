#!/usr/bin/env node
/**
 * Genera docs/fonti-attendibilita.md dalla configurazione delle fonti e dal registro delle
 * verifiche live (docs/verifiche-fonti.json). Cosi' la tabella non puo' dire piu' di quanto
 * sia stato effettivamente provato: "verificata live" compare solo dove esiste una voce.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const radice = join(dirname(fileURLToPath(import.meta.url)), "..");
const siti = join(radice, "packages/scrapers/sites");
const fixtures = readdirSync(join(radice, "packages/scrapers/fixtures"));
const testi = readdirSync(join(radice, "packages/scrapers/src")).filter((f) => f.endsWith(".test.ts"))
  .map((f) => readFileSync(join(radice, "packages/scrapers/src", f), "utf8")).join("\n");
const live = existsSync(join(radice, "docs/verifiche-fonti.json")) ? JSON.parse(readFileSync(join(radice, "docs/verifiche-fonti.json"), "utf8")) : {};

const righe = readdirSync(siti).filter((f) => f.endsWith(".json")).sort().map((f) => {
  const c = JSON.parse(readFileSync(join(siti, f), "utf8"));
  const campi = c.fields ? Object.keys(c.fields) : c.pdf ? ["(estrazione da PDF)"] : [];
  const fixture = fixtures.filter((x) => x.includes(c.name));
  const specificoNeiTest = new RegExp(`["'\`]${c.name}["'\`]|${c.name}_|${c.name}\\.`).test(testi);
  const comp = c.compliance ?? {};
  const note = String(c.notes ?? "");
  // prudente: conta solo una dichiarazione esplicita di calibrazione su una pagina reale catturata
  const calibrata = /calibrat\w* sull['’]HTML reale/i.test(note) && !/da calibrare|va ancora calibrat|non calibrat/i.test(note);
  const v = (live[c.name] ?? []).slice(-1)[0];
  return {
    nome: c.name,
    configurata: "si",
    abilitata: c.enabled ? "si" : "no",
    autorizzata: comp.stato ? `${comp.stato}${comp.verificatoIl ? " (" + comp.verificatoIl + ")" : ""}` : c.name === "demo" ? "n/a (fixture locale)" : "non registrata",
    modo: c.fetchMode,
    fixture: fixture.length && specificoNeiTest ? `si (${fixture.join(", ")})` : "no: solo il motore generico",
    calibrazione: c.name === "demo" ? "n/a" : calibrata ? "su HTML reale" : "non dichiarata",
    live: v ? `si, ${v.data}: ${v.righe} righe, ${v.errori} errori` : "NO",
    campi: campi.length ? campi.join(", ") : "-",
    limiti: v ? v.limiti.join(" ") : "",
  };
});

const intest = "| Fonte | Configurata | Abilitata | Autorizzata (condizioni d'uso) | Modo | Testata su fixture | Selettori | Verificata live (ultima) | Campi configurati |\n|---|---|---|---|---|---|---|---|---|\n";
const corpo = righe.map((r) => `| ${r.nome} | ${r.configurata} | ${r.abilitata} | ${r.autorizzata} | ${r.modo} | ${r.fixture} | ${r.calibrazione} | ${r.live} | ${r.campi} |`).join("\n");
const dettagli = righe.filter((r) => r.limiti).map((r) => `### ${r.nome}\n\n${r.limiti.split(". ").map((s) => "- " + s.replace(/\.$/, "") + ".").join("\n")}`).join("\n\n");

const md = `# Attendibilita' delle fonti

Generato da \`node scripts/tabella-fonti.mjs\` leggendo \`packages/scrapers/sites/*.json\` e \`docs/verifiche-fonti.json\`. Non va modificato a mano: "verificata live" compare solo dove esiste una verifica registrata.

Totali: ${righe.length} fonti configurate, ${righe.filter((r) => r.abilitata === "si").length} abilitate, ${righe.filter((r) => r.live !== "NO").length} verificate live.

${intest}${corpo}

## Cosa significa ogni colonna

- **Autorizzata**: esito della lettura delle condizioni d'uso registrato nel file della fonte. \`da_verificare\` blocca lo scraper. \`solo_contatto\` e \`vietato\` non si raccolgono.
- **Testata su fixture**: esiste un HTML o PDF di prova specifico della fonte e un test che lo usa. "Solo il motore generico" significa che i selettori della fonte non sono mai stati provati.
- **Selettori**: "su HTML reale" se le note dichiarano la calibrazione su una pagina catturata; altrimenti "non dichiarata": va calibrata (\`npm run calibra\`) prima di abilitarla.
- **Verificata live**: una esecuzione reale con esito osservato, registrata con data. Non e' una garanzia sul futuro: i portali cambiano.

## Limiti dichiarati delle verifiche live

${dettagli || "Nessuna verifica live registrata."}

## Stato complessivo

Solo le fonti con tutte le colonne positive possono alimentare il radar: oggi sono **${righe.filter((r) => r.abilitata === "si" && r.live !== "NO" && !r.autorizzata.startsWith("n/a")).length}** (la fonte \`demo\` e' una fixture locale, non un mercato). Le altre non vanno abilitate in massa: ognuna richiede lettura delle condizioni d'uso, calibrazione dei selettori su HTML reale e una prima esecuzione verificata.
`;
writeFileSync(join(radice, "docs/fonti-attendibilita.md"), md);
console.log(`scritto docs/fonti-attendibilita.md (${righe.length} fonti)`);
