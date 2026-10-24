#!/usr/bin/env node
/**
 * Esecuzione ripetibile della suite completa (rilievo "installazione ripetibile").
 *
 *  1. controlla il runtime (Node >= 22.5, necessario per SQLite integrato);
 *  2. rigenera la fixture PDF se manca (node packages/scrapers/fixtures/generaPdf.mjs);
 *  3. trova Chromium: QDR_CHROMIUM_PATH, oppure PLAYWRIGHT_BROWSERS_PATH, oppure le cartelle
 *     predefinite di Playwright. Se non lo trova, FALLISCE: una suite verde con i test del
 *     browser saltati non dimostra niente. Con --senza-browser li salta dichiarandolo;
 *  4. lancia i test dei tre pacchetti e riassume test, passati, falliti e SALTATI.
 *
 * Esce con 0 solo se non ci sono fallimenti e (in modalita' normale) nessun test saltato.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const radice = join(dirname(fileURLToPath(import.meta.url)), "..");
const senzaBrowser = process.argv.includes("--senza-browser");

const [maggiore, minore] = process.versions.node.split(".").map(Number);
if (maggiore < 22 || (maggiore === 22 && minore < 5)) {
  console.error(`Node ${process.versions.node} non basta: serve la 22.5 o successiva (SQLite integrato).`);
  process.exit(2);
}

const pdf = join(radice, "packages/scrapers/fixtures/elenco_immobili.pdf");
if (!existsSync(pdf)) {
  console.log("Fixture PDF assente: la rigenero.");
  const r = spawnSync(process.execPath, [join(radice, "packages/scrapers/fixtures/generaPdf.mjs")], { stdio: "inherit" });
  if (r.status !== 0) { console.error("Rigenerazione della fixture PDF fallita."); process.exit(2); }
}

function trovaChromium() {
  if (process.env.QDR_CHROMIUM_PATH && existsSync(process.env.QDR_CHROMIUM_PATH)) return process.env.QDR_CHROMIUM_PATH;
  const radici = [process.env.PLAYWRIGHT_BROWSERS_PATH, join(homedir(), ".cache", "ms-playwright"), "/opt/pw-browsers"].filter(Boolean);
  const candidati = ["chrome-linux/chrome", "chrome-linux64/chrome", "chrome-win/chrome.exe", "chrome-mac/Chromium.app/Contents/MacOS/Chromium"];
  for (const base of radici) {
    if (!existsSync(base)) continue;
    for (const cartella of readdirSync(base).filter((n) => /^chromium-\d+$/.test(n)).sort().reverse()) {
      for (const c of candidati) if (existsSync(join(base, cartella, c))) return join(base, cartella, c);
    }
  }
  return null;
}

const env = { ...process.env };
if (!senzaBrowser) {
  const chromium = trovaChromium();
  if (!chromium) {
    console.error(
      "Chromium non trovato: i test del motore browser non possono girare.\n" +
        "  Installalo con:  npx playwright install chromium\n" +
        "  oppure indica un Chromium esistente con QDR_CHROMIUM_PATH.\n" +
        "  Per saltare quei test dichiarandolo:  npm test -- --senza-browser",
    );
    process.exit(2);
  }
  env.QDR_CHROMIUM_PATH = chromium;
  env.QDR_RICHIEDI_BROWSER = "1";
  console.log(`Chromium: ${chromium}`);
}

// test degli script del repository (controlli del calendario): stesso conteggio, stesso rigore
const scriptTest = spawnSync(process.execPath, ["--test", join(radice, "scripts/controlli.test.mjs")], { cwd: radice, encoding: "utf8" });
process.stdout.write(scriptTest.stdout ?? "");
process.stderr.write(scriptTest.stderr ?? "");
if (scriptTest.status !== 0) { console.error("Test degli script falliti."); process.exit(scriptTest.status || 1); }

const figlio = spawn("npm", ["run", "test", "-w", "@qdr/core", "-w", "@qdr/scrapers", "-w", "@qdr/server"], { cwd: radice, env, shell: process.platform === "win32" });
let uscita = scriptTest.stdout ?? "";
figlio.stdout.on("data", (d) => { process.stdout.write(d); uscita += d; });
figlio.stderr.on("data", (d) => process.stderr.write(d));
figlio.on("close", (codice) => {
  const somma = (nome) => [...uscita.matchAll(new RegExp(`^# ${nome} (\\d+)`, "gm"))].reduce((a, m) => a + Number(m[1]), 0);
  const [test, passati, falliti, saltati] = ["tests", "pass", "fail", "skipped"].map(somma);
  console.log(`\n=== RIEPILOGO: ${test} test, ${passati} passati, ${falliti} falliti, ${saltati} saltati ===`);
  if (codice !== 0 || falliti > 0) process.exit(codice || 1);
  if (saltati > 0 && !senzaBrowser) {
    console.error(`Ci sono ${saltati} test saltati: una suite con test saltati non e' un esito verde. Usa --senza-browser per accettarlo esplicitamente.`);
    process.exit(1);
  }
  process.exit(0);
});
