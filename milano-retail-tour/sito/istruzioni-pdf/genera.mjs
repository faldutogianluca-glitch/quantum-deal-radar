// Genera sito/Istruzioni-pubblicazione-MiRT.pdf (istruzioni per chi gestisce milanoretailtour.com).
// Uso: node genera.mjs
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const req = createRequire(import.meta.url);
const { chromium } = (() => { try { return req('playwright'); } catch { return req(`${process.env.NODE_PATH || '/opt/node22/lib/node_modules'}/playwright`); } })();
const kit = resolve(here, '../../brand-kit');
const b64 = (p) => readFileSync(p).toString('base64');
const font = (name, file, w) => `@font-face{font-family:${name};font-weight:${w};src:url(data:font/woff2;base64,${b64(`${kit}/font/${file}`)})}`;
const logo = readFileSync(`${kit}/logo/logo-mirt.svg`, 'utf8').replace(/ width="\d+" height="\d+"/, '');
const pages = JSON.parse(readFileSync(resolve(here, '../pages-json-aggiunte.json'), 'utf8'));
const it = (d) => d ? d.split('-').reverse().map(Number).join('/') : '26/10/2026';
const rows = Object.entries(pages).filter(([k]) => !k.startsWith('en/')).map(([k, v]) =>
  `<tr><td><code>/${k}/</code><br><span class="en">EN: <code>/en/${k}/</code></span></td><td>${v.title.replace(/ \| Milano Retail Tour$/, '')}</td><td class="d">${it(v.date)}</td></tr>`).join('');

const html = `<!doctype html><html lang="it"><head><meta charset="utf-8"><style>
${font('Merriweather', 'merriweather-latin-400-normal.woff2', 400)}${font('Merriweather', 'merriweather-latin-700-normal.woff2', 700)}
${font('Arvo', 'arvo-latin-400-normal.woff2', 400)}${font('Arvo', 'arvo-latin-700-normal.woff2', 700)}
@page{size:A4;margin:18mm 18mm 20mm}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arvo,Georgia,serif;color:#3d3c3f;font-size:10.5pt;line-height:1.55}
header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:.6mm solid #3d3c3f;padding-bottom:5mm;margin-bottom:8mm}
header svg{height:16mm;width:auto}
.kick{font:700 8pt/1.4 Merriweather,Georgia,serif;letter-spacing:2pt;text-transform:uppercase;color:#707173}
h1{font:700 22pt/1.2 Merriweather,Georgia,serif;margin:2mm 0 4mm}
h2{font:700 13pt/1.3 Merriweather,Georgia,serif;margin:9mm 0 3mm}
p{margin-bottom:3mm}
.lead{font:400 11.5pt/1.6 Merriweather,Georgia,serif}
.alert{background:#3d3c3f;color:#fff;border-radius:2mm;padding:4mm 5mm;margin:5mm 0;font-weight:700}
table{width:100%;border-collapse:collapse;font-size:9.5pt;margin-top:2mm}
th{text-align:left;font:700 7.5pt/1.4 Merriweather,Georgia,serif;letter-spacing:1.5pt;text-transform:uppercase;color:#707173;border-bottom:.4mm solid #3d3c3f;padding:2mm 2mm 2mm 0}
td{border-bottom:.3mm solid #e6e6e8;padding:2.2mm 3mm 2.2mm 0;vertical-align:top}
td.d{white-space:nowrap;font-weight:700}
tr.first td{background:#f6f6f7}
.en{color:#707173;font-size:8.5pt}
code{font-family:Arvo,monospace;font-size:9pt;background:#f6f6f7;padding:.3mm 1.2mm;border-radius:1mm}
ol,ul{margin:0 0 3mm 6mm}
li{margin-bottom:1.8mm}
.box{border-left:1mm solid #3d3c3f;background:#f6f6f7;padding:3.5mm 5mm;margin:3mm 0}
.avoid{page-break-inside:avoid}
footer{margin-top:10mm;border-top:.3mm solid #e6e6e8;padding-top:3mm;font-size:8.5pt;color:#707173}
</style></head><body>
<header>${logo}<span class="kick">Campagna MiRT Radar 2027</span></header>
<p class="kick">Istruzioni per chi gestisce il sito</p>
<h1>Pagine nuove da pubblicare su milanoretailtour.com</h1>
<p class="lead">Questo documento accompagna il file <code>pacchetto-sito-mirt.zip</code>. Si aggiungono una landing page, la pagina delle guide gratuite, 7 PDF e 8 articoli del blog, in italiano e inglese. Le pagine esistenti del sito non cambiano.</p>
<div class="alert">Entro lunedì 26 ottobre devono essere online: /radar/, il PDF e il primo articolo. Il 27 ottobre escono i primi video e post social che li linkano.</div>

<h2>1. Cosa c'è nel pacchetto</h2>
<ul>
<li><b><code>content/*.html</code></b>: 20 frammenti HTML (10 IT e 10 EN; i file EN iniziano con <code>en__</code>). Contengono solo il corpo della pagina: vanno inseriti nel template del sito, con header e footer, come le altre pagine.</li>
<li><b><code>download/MiRT-Radar-2027.pdf</code></b> e <b><code>download/mirt-radar-2027-anteprima.jpg</code></b>: il PDF scaricabile e la sua immagine di anteprima; <b><code>download/guide/</code></b>: le 6 guide gratuite.</li>
<li><b><code>pages-json-aggiunte.json</code></b>: per ogni pagina indirizzo, titolo SEO, meta description, lingua, file e data.</li>
</ul>
<div class="box">I frammenti usano solo classi CSS già presenti nel sito (<code>fmt</code>, <code>fmt-card</code>, <code>fmt-lead</code>, <code>fmt-cols</code>, <code>fmt-tags</code>, <code>fmt-cta</code>, <code>ai-kicker</code>…). Non contengono stili o script inline, quindi rispettano la Content Security Policy attuale.</div>

<div class="avoid"><h2>2. Indirizzi e date</h2>
<p>Ogni pagina va pubblicata <b>entro</b> la data indicata. La soluzione più semplice è pubblicare tutto subito.</p>
<table><tr><th>Indirizzo</th><th>Pagina</th><th>Entro</th></tr>
<tr class="first"><td><code>/download/MiRT-Radar-2027.pdf</code><br><code>/download/mirt-radar-2027-anteprima.jpg</code></td><td>PDF del Radar e immagine di anteprima</td><td class="d">26/10/2026</td></tr>
<tr class="first"><td><code>/download/guide/</code> (6 PDF)</td><td>Guide gratuite per chi commenta i post</td><td class="d">26/10/2026</td></tr>
${rows.replace('<tr>', '<tr class="first">').replace('<tr>', '<tr class="first">')}
</table></div>

<div class="avoid"><h2>3. Il modulo della landing page</h2>
<ul>
<li>Il modulo su <code>/radar/</code> invia a FormSubmit (<code>formsubmit.co/info@milanoretailtour.com</code>), che è <b>già attivato</b>: non serve fare nulla.</li>
<li>Dopo l'invio la pagina mostra subito il pulsante per aprire <code>/download/MiRT-Radar-2027.pdf</code>; il modulo è inviato via AJAX e in questo caso FormSubmit non manda l'email automatica al visitatore (arriva solo la notifica a info@). Per questo il PDF deve stare esattamente a quell'indirizzo.</li>
<li>Se la CSP del sito limita <code>form-action</code> o <code>connect-src</code>, va aggiunto <code>https://formsubmit.co</code>.</li>
</ul></div>

<div class="avoid"><h2>4. Verifica dopo la pubblicazione</h2>
<ol>
<li>Aprire <code>milanoretailtour.com/radar/</code> e <code>/en/radar/</code>: la pagina deve avere lo stile del sito e mostrare l'immagine di anteprima.</li>
<li>Aprire <code>milanoretailtour.com/download/MiRT-Radar-2027.pdf</code>: il PDF si deve scaricare.</li>
<li>Compilare il modulo con un'email di prova: la pagina deve mostrare il pulsante "Apri il PDF" e deve arrivare la notifica a info@milanoretailtour.com.</li>
<li>Aprire due o tre articoli e provare i pulsanti verso <code>/radar/</code> e <code>/contatti/?diagnosi</code>.</li>
<li>Se c'è una sitemap, aggiungere i nuovi indirizzi.</li>
</ol></div>
<footer>Milano Retail Tour · milanoretailtour.com · Per dubbi: Gianluca Falduto</footer>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'load' });
await page.pdf({ path: resolve(here, '../Istruzioni-pubblicazione-MiRT.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true });
await browser.close();
console.log('ok');
