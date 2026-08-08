/**
 * Genera la fixture PDF usata dai test del motore `pdf`.
 *
 * Il PDF e' scritto a mano, byte per byte, invece di usare una libreria: serve
 * un file deterministico e minuscolo, e aggiungere una dipendenza solo per
 * produrre una fixture di prova non varrebbe il costo. Il contenuto ricalca la
 * forma di un elenco immobili pubblicato da un ente: intestazione, righe di
 * tabella, e in fondo il rumore che questi documenti si portano dietro.
 *
 * Rigenerare con:  node packages/scrapers/fixtures/generaPdf.mjs
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RIGHE = [
  "BANCA D'ESEMPIO - ELENCO IMMOBILI DISPONIBILI PER LA VENDITA",
  "Aggiornamento: 12 marzo 2026",
  "",
  "Lotto 1 - CREMONA (CR) - Via Giuseppe Verdi 14 - Ufficio - 1.250,00 mq - Euro 1.480.000,00",
  "Lotto 2 - PAVIA (PV) - Corso Cavour 8 - Deposito - 640,50 mq - Euro 312.000,00",
  "Lotto 3 - LODI (LO) - Piazza della Vittoria 3 - Edificio cielo-terra - 2.100,00 mq - Euro 2.950.000,00",
  "Lotto 4 - MANTOVA (MN) - Via Roma 121 - Locale commerciale - 380,00 mq - Euro 275.500,00",
  "",
  "Manifestazioni di interesse pervenute: Lotto 2, Lotto 3.",
  "Trattative in corso: nessuna.",
  "",
  "Le offerte vanno presentate secondo le modalita' indicate nell'avviso.",
  "Il presente elenco non costituisce offerta al pubblico.",
];

/** Testo dentro un content stream PDF: le parentesi e le barre vanno protette. */
const esc = (s) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

const contenuto =
  "BT\n/F1 11 Tf\n14 TL\n40 780 Td\n" +
  RIGHE.map((r) => `(${esc(r)}) Tj T*`).join("\n") +
  "\nET";

const oggetti = [
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] " +
    "/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  `<< /Length ${Buffer.byteLength(contenuto, "latin1")} >>\nstream\n${contenuto}\nendstream`,
];

let pdf = "%PDF-1.4\n";
const offset = [];
oggetti.forEach((corpo, i) => {
  offset.push(Buffer.byteLength(pdf, "latin1"));
  pdf += `${i + 1} 0 obj\n${corpo}\nendobj\n`;
});

const inizioXref = Buffer.byteLength(pdf, "latin1");
pdf += `xref\n0 ${oggetti.length + 1}\n0000000000 65535 f \n`;
for (const o of offset) pdf += `${String(o).padStart(10, "0")} 00000 n \n`;
pdf += `trailer\n<< /Size ${oggetti.length + 1} /Root 1 0 R >>\nstartxref\n${inizioXref}\n%%EOF\n`;

const destinazione = join(dirname(fileURLToPath(import.meta.url)), "elenco_immobili.pdf");
writeFileSync(destinazione, Buffer.from(pdf, "latin1"));
console.log(`scritto ${destinazione} (${Buffer.byteLength(pdf, "latin1")} byte)`);
