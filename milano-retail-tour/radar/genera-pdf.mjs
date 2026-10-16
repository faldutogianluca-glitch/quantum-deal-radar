// Genera download/MiRT-Radar-2027.pdf da contenuto.json, con font, logo e mappa del brand kit.
// Uso: node genera-pdf.mjs
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const req = createRequire(import.meta.url);
const { chromium } = (() => { try { return req('playwright'); } catch { return req(`${process.env.NODE_PATH || '/opt/node22/lib/node_modules'}/playwright`); } })();
const kit = resolve(here, '../brand-kit');
const c = JSON.parse(readFileSync(resolve(here, 'contenuto.json'), 'utf8'));
const b64 = (p) => readFileSync(p).toString('base64');
const font = (name, file, w, st = 'normal') => `@font-face{font-family:${name};font-weight:${w};font-style:${st};src:url(data:font/woff2;base64,${b64(`${kit}/font/${file}`)})}`;
const logo = readFileSync(`${kit}/logo/logo-mirt.svg`, 'utf8').replace(/ width="\d+" height="\d+"/, '');
const mappa = b64(`${kit}/immagini/sfondo-mappa-milano.jpg`);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

const trend = (t) => `<section class="trend">
 <div class="tn">${t.n}</div>
 <h2>${esc(t.title)}</h2>
 <div class="cols">
  <div><p class="lab">I numeri</p>${t.facts.map((f) => `<p class="fact">${esc(f)}</p>`).join('')}</div>
  <div><p class="lab">Un esempio</p><p class="ex">${esc(t.example)}</p><p class="lab">La prima mossa</p><p class="move">${esc(t.move)}</p></div>
 </div>
</section>`;

const pages = [];
for (let i = 0; i < c.trends.length; i += 2) pages.push(c.trends.slice(i, i + 2));
const foot = (n) => `<div class="pf"><span>MiRT Radar 2027 · Milano Retail Tour</span><span>${n}</span></div>`;

const html = `<!doctype html><html lang="it"><head><meta charset="utf-8"><style>
${font('Merriweather', 'merriweather-latin-400-normal.woff2', 400)}${font('Merriweather', 'merriweather-latin-700-normal.woff2', 700)}${font('Merriweather', 'merriweather-latin-700-italic.woff2', 700, 'italic')}
${font('Arvo', 'arvo-latin-400-normal.woff2', 400)}${font('Arvo', 'arvo-latin-700-normal.woff2', 700)}
@page{size:A4;margin:0}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arvo,Georgia,serif;color:#3d3c3f;font-size:12.5pt;line-height:1.55}
.page{width:210mm;height:297mm;position:relative;overflow:hidden;page-break-after:always;padding:24mm 18mm 22mm}
.cover{background:#c9cacc url(data:image/jpeg;base64,${mappa}) center/cover;padding:0}
.cover .card{position:absolute;left:18mm;right:18mm;top:58mm;background:#fff;border-radius:4mm;padding:16mm 15mm 14mm}
.cover .card svg{height:24mm;width:auto;display:block;margin-bottom:12mm}
.kick{font:700 8.5pt/1.4 Merriweather,Georgia,serif;letter-spacing:2.5pt;text-transform:uppercase;color:#707173}
.cover h1{font:700 34pt/1.15 Merriweather,Georgia,serif;margin:4mm 0 6mm;letter-spacing:-.3pt}
.cover .sub{font:400 13pt/1.55 Merriweather,Georgia,serif;color:#5a595c;border-top:.6mm solid #3d3c3f;padding-top:6mm;max-width:140mm}
.cover .date{margin-top:8mm;font-size:9.5pt;color:#707173}
h2{font:700 19pt/1.25 Merriweather,Georgia,serif;margin:2mm 0 6mm}
.intro p{font:400 13pt/1.7 Merriweather,Georgia,serif;margin-bottom:6mm}
.idx{list-style:none;margin-top:4mm;border-top:.3mm solid #e6e6e8}
.idx li{display:flex;gap:6mm;padding:3.4mm 0;border-bottom:.3mm solid #e6e6e8;font-size:12.5pt}
.idx b{font-family:Merriweather,Georgia,serif;color:#707173;width:9mm}
.trend{border-top:.6mm solid #3d3c3f;padding-top:6mm;margin-bottom:16mm;position:relative}
.tn{font:700 34pt/1 Merriweather,Georgia,serif;color:#c9cacc;position:absolute;right:0;top:4mm}
.trend h2{padding-right:22mm}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:8mm}
.lab{font:700 8.5pt/1.4 Merriweather,Georgia,serif;letter-spacing:2pt;text-transform:uppercase;color:#707173;margin:0 0 1.8mm}
.fact{margin-bottom:4.5mm}
.ex{font-style:normal;color:#5a595c;margin-bottom:6mm}
.move{background:#f6f6f7;border-left:1mm solid #3d3c3f;padding:4mm 5mm;font-weight:700}
.pf{position:absolute;left:18mm;right:18mm;bottom:10mm;display:flex;justify-content:space-between;font-size:8pt;color:#9a999c;border-top:.3mm solid #e6e6e8;padding-top:3mm}
.end{background:#3d3c3f;color:#fff}
.end h2{color:#fff;font-size:22pt;margin-bottom:6mm}
.end p{font-size:11.5pt;line-height:1.6;margin-bottom:5mm;color:#e6e6e8;max-width:150mm}
.end .btn{display:inline-block;background:#fff;color:#3d3c3f;border-radius:20mm;padding:3.5mm 8mm;font:700 10pt/1 Arvo,Georgia,serif;letter-spacing:.6pt;text-transform:uppercase;text-decoration:none;margin:2mm 0 10mm}
.svc{display:grid;grid-template-columns:1fr 1fr;gap:5mm;margin-bottom:10mm}
.svc div{border:.3mm solid #707173;border-radius:2mm;padding:4mm}
.svc b{display:block;font:700 10pt/1.3 Merriweather,Georgia,serif;margin-bottom:1mm;color:#fff}
.svc span{font-size:9pt;color:#c9cacc}
.end .kick{color:#c9cacc}
.end .pf{color:#9a999c;border-color:#5a595c}
.src{font-size:8.5pt;line-height:1.45;color:#c9cacc}
.src a{color:#c9cacc}
.src li{margin:0 0 1.2mm 4mm}
</style></head><body>
<div class="page cover"><div class="card">${logo}<p class="kick">Osservatorio Milano Retail Tour</p><h1>MiRT Radar 2027</h1><p class="sub">Dieci trend del retail specializzato, dove l’AI è già al lavoro, e la prima mossa per ognuno.</p><p class="date">Edizione di ottobre 2026 · milanoretailtour.com</p></div></div>
<div class="page intro"><p class="kick">Come leggere il Radar</p><h2>Prima il retail, poi l’AI</h2><p>${esc(c.intro)}</p>
<ol class="idx">${c.trends.map((t) => `<li><b>${t.n}</b>${esc(t.title)}</li>`).join('')}</ol>${foot(2)}</div>
${pages.map((p, i) => `<div class="page">${p.map(trend).join('')}${foot(i + 3)}</div>`).join('')}
<div class="page end"><p class="kick">Il passo successivo</p><h2>Quali di questi trend contano per il tuo negozio?</h2>
<p>Prenota la <b>Diagnosi MiRT</b>: 30 minuti in videochiamata, gratis. Prima della chiamata guardiamo il tuo negozio da fuori (scheda Google, recensioni, sito, cosa dicono gli assistenti AI); in chiamata ti indichiamo i tre punti dove l’AI ti fa guadagnare tempo o clienti.</p>
<a class="btn" href="https://www.milanoretailtour.com/contatti/?diagnosi">Prenota la Diagnosi →</a>
<div class="svc"><div><b>MiRT Explore</b><span>AI Retail Tour e Academy: l’AI già al lavoro nei negozi di Milano</span></div><div><b>MiRT Check</b><span>AI Readiness Check: dove l’AI ti fa guadagnare, con quali strumenti, in che ordine</span></div><div><b>MiRT Watch</b><span>L’osservatorio che lavora per il tuo negozio, ogni giorno</span></div><div><b>MiRT Act</b><span>Agenti AI per clienteling, contenuti, recensioni e dati di vendita</span></div></div>
<p class="kick">Fonti</p><ol class="src">${c.sources.map(([t, u]) => `<li><a href="${u}">${esc(t)}</a></li>`).join('')}</ol>
<p class="src" style="margin-top:4mm">Contenuto scritto con l’ausilio dell’AI con la supervisione di Gianluca Falduto. Milano Retail Tour · info@milanoretailtour.com · +39 02 97376045 · Corso S. Gottardo 18, Milano.</p>${foot(8)}</div>
</body></html>`;

mkdirSync(resolve(here, '../sito/download'), { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.pdf({ path: resolve(here, '../sito/download/MiRT-Radar-2027.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true });
await browser.close();
console.log('ok');
