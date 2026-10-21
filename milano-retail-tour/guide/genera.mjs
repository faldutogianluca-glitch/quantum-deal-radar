// Genera le guide gratuite in PDF (it + en) da contenuto.mjs, nello stile del MiRT Radar.
// Uso: node genera.mjs   → output in ../sito/download/guide/
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { guide, ui } from './contenuto.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const req = createRequire(import.meta.url);
const { chromium } = (() => { try { return req('playwright'); } catch { return req(`${process.env.NODE_PATH || '/opt/node22/lib/node_modules'}/playwright`); } })();
const kit = resolve(here, '../brand-kit');
const out = resolve(here, '../sito/download/guide');
const b64 = (p) => readFileSync(p).toString('base64');
const font = (name, file, w, st = 'normal') => `@font-face{font-family:${name};font-weight:${w};font-style:${st};src:url(data:font/woff2;base64,${b64(`${kit}/font/${file}`)})}`;
const logo = readFileSync(`${kit}/logo/logo-mirt.svg`, 'utf8').replace(/ width="\d+" height="\d+"/, '');
const mappa = b64(`${kit}/immagini/sfondo-mappa-milano.jpg`);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const head = (k, t) => `${k ? `<p class="kick">${esc(k)}</p>` : ''}${t ? `<h2>${esc(t)}</h2>` : ''}`;

const block = {
  text: (b) => `<section>${head(b.kicker, b.title)}${b.body.map((p) => `<p class="body">${esc(p)}</p>`).join('')}</section>`,
  facts: (b) => `<section class="facts">${b.items.map(([n, t]) => `<div><b>${esc(n)}</b><span>${esc(t)}</span></div>`).join('')}</section>`,
  checklist: (b) => `<section>${head(b.kicker, b.title)}${b.groups.map(([g, items]) => `${g ? `<p class="grp">${esc(g)}</p>` : ''}<ul class="chk">${items.map((i) => `<li><i></i><span>${esc(i)}</span></li>`).join('')}</ul>`).join('')}</section>`,
  prompts: (b) => `<section>${head(b.kicker, b.title)}${b.intro ? `<p class="body">${esc(b.intro)}</p>` : ''}<ol class="prm">${b.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ol></section>`,
  steps: (b) => `<section>${head(b.kicker, b.title)}<ol class="stp">${b.items.map(([t, d]) => `<li><b>${esc(t)}</b><span>${esc(d)}</span></li>`).join('')}</ol></section>`,
  table: (b) => {
    const rows = b.prefill || Array.from({ length: b.rows }, () => b.cols.map(() => ''));
    return `<section>${head(b.kicker, b.title)}${b.intro ? `<p class="body">${esc(b.intro)}</p>` : ''}<table class="${b.prefill ? '' : 'blank'}"><tr>${b.cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table></section>`;
  },
  ideas: (b) => b.items.map(([n, t, where, big, small, fits]) => `<section class="idea"><div class="tn">${n}</div><p class="kick">${esc(where)}</p><h2>${esc(t)}</h2>
   <div class="cols"><div><p class="lab">${ui.cur.big}</p><p>${esc(big)}</p><p class="lab" style="margin-top:4mm">${ui.cur.fits}</p><p class="fits">${esc(fits)}</p></div><div><p class="lab">${ui.cur.small}</p><p class="move">${esc(small)}</p></div></div></section>`).join('')
};

const css = `
${font('Merriweather', 'merriweather-latin-400-normal.woff2', 400)}${font('Merriweather', 'merriweather-latin-700-normal.woff2', 700)}
${font('Arvo', 'arvo-latin-400-normal.woff2', 400)}${font('Arvo', 'arvo-latin-700-normal.woff2', 700)}
@page{size:A4;margin:0}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arvo,Georgia,serif;color:#3d3c3f;font-size:11pt;line-height:1.55}
.page{width:210mm;height:297mm;position:relative;overflow:hidden;page-break-after:always;padding:20mm 18mm 22mm}
.cover{background:#c9cacc url(data:image/jpeg;base64,${mappa}) center/cover;padding:0}
.cover .card{position:absolute;left:18mm;right:18mm;top:50mm;background:#fff;border-radius:4mm;padding:15mm 15mm 13mm}
.cover .card svg{height:22mm;width:auto;display:block;margin-bottom:11mm}
.cover h1{font:700 30pt/1.15 Merriweather,Georgia,serif;margin:4mm 0 6mm;letter-spacing:-.3pt}
.cover .sub{font:400 12.5pt/1.55 Merriweather,Georgia,serif;color:#5a595c;border-top:.6mm solid #3d3c3f;padding-top:6mm}
.cover .free{display:inline-block;margin-top:8mm;background:#3d3c3f;color:#fff;border-radius:20mm;padding:2.5mm 6mm;font-size:9pt;font-weight:700}
.kick{font:700 8pt/1.4 Merriweather,Georgia,serif;letter-spacing:2.2pt;text-transform:uppercase;color:#707173}
h2{font:700 17pt/1.25 Merriweather,Georgia,serif;margin:1.5mm 0 4mm}
section{margin-bottom:9mm}
.body{margin-bottom:3mm}
.facts{display:grid;grid-template-columns:1fr 1fr;gap:4mm}
.facts div{background:#f6f6f7;border-radius:2mm;padding:4mm 5mm}
.facts b{display:block;font:700 22pt/1.1 Merriweather,Georgia,serif;margin-bottom:1.5mm}
.facts span{font-size:9.5pt;color:#5a595c;line-height:1.45}
.grp{font:700 11pt/1.3 Merriweather,Georgia,serif;margin:5mm 0 2mm}
.chk{list-style:none}
.chk li{display:flex;gap:4mm;padding:2.4mm 0;border-bottom:.3mm solid #e6e6e8;font-size:10.5pt}
.chk i{flex:0 0 4.6mm;height:4.6mm;border:.45mm solid #3d3c3f;border-radius:.8mm;margin-top:.5mm}
.prm{list-style:none;counter-reset:p}
.prm li{counter-increment:p;position:relative;background:#f6f6f7;border-left:1mm solid #3d3c3f;padding:3mm 4mm 3mm 13mm;margin-bottom:2.6mm;font-size:10pt;line-height:1.5}
.prm li::before{content:counter(p,decimal-leading-zero);position:absolute;left:4mm;top:3mm;font:700 10pt Merriweather,Georgia,serif;color:#707173}
.stp{list-style:none;counter-reset:s}
.stp li{counter-increment:s;display:grid;grid-template-columns:10mm 1fr;column-gap:2mm;padding:2.8mm 0;border-bottom:.3mm solid #e6e6e8}
.stp li::before{content:counter(s,decimal-leading-zero);grid-row:span 2;font:700 13pt/1.2 Merriweather,Georgia,serif;color:#9a999c}
.stp b{font-family:Merriweather,Georgia,serif;font-size:11pt}
.stp span{font-size:10pt;color:#5a595c}
table{width:100%;border-collapse:collapse;font-size:9.5pt;margin-top:2mm}
th{text-align:left;font:700 7.5pt/1.4 Merriweather,Georgia,serif;letter-spacing:1.4pt;text-transform:uppercase;color:#707173;border-bottom:.5mm solid #3d3c3f;padding:2mm 2mm 2mm 0}
td{border-bottom:.3mm solid #c9cacc;padding:2.4mm 3mm 2.4mm 0;vertical-align:top}
table.blank td{height:13mm;border-right:.3mm solid #e6e6e8;padding-left:2mm}
table.blank td:last-child{border-right:0}
.idea{border-top:.6mm solid #3d3c3f;padding-top:5mm;position:relative}
.tn{font:700 30pt/1 Merriweather,Georgia,serif;color:#c9cacc;position:absolute;right:0;top:4mm}
.idea h2{padding-right:20mm}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:8mm;font-size:10.5pt}
.lab{font:700 7.5pt/1.4 Merriweather,Georgia,serif;letter-spacing:1.8pt;text-transform:uppercase;color:#707173;margin-bottom:1.5mm}
.fits{color:#5a595c;font-size:9.5pt}
.move{background:#f6f6f7;border-left:1mm solid #3d3c3f;padding:3.5mm 4.5mm;font-weight:700}
.pf{position:absolute;left:18mm;right:18mm;bottom:10mm;display:flex;justify-content:space-between;font-size:8pt;color:#9a999c;border-top:.3mm solid #e6e6e8;padding-top:3mm}
.end{background:#3d3c3f;color:#fff}
.end h2{color:#fff;font-size:22pt;margin-bottom:6mm}
.end p{font-size:11pt;line-height:1.6;margin-bottom:5mm;color:#e6e6e8;max-width:155mm}
.end .kick{color:#c9cacc}
.end .btn{display:inline-block;background:#fff;color:#3d3c3f;border-radius:20mm;padding:3.5mm 8mm;font:700 10pt/1 Arvo,Georgia,serif;letter-spacing:.6pt;text-transform:uppercase;text-decoration:none;margin:2mm 0 8mm}
.end .more{border:.3mm solid #707173;border-radius:2mm;padding:4mm 5mm;margin-bottom:9mm}
.end .pf{border-color:#5a595c}
.src{font-size:8.5pt;line-height:1.45;color:#c9cacc}
.src a{color:#c9cacc}
.src li{margin:0 0 1.2mm 4mm}
`;

const labels = { it: { big: 'Cosa fa il grande brand', small: 'In piccolo, nel tuo negozio', fits: 'Funziona per' }, en: { big: 'What the big brand does', small: 'Small-scale, in your store', fits: 'Works for' } };

const build = (g, lang) => {
  const u = ui[lang];
  ui.cur = labels[lang];
  const foot = (n) => `<div class="pf"><span>${esc(g.title)} · Milano Retail Tour</span><span>${n}</span></div>`;
  const body = g.pages.map((p, i) => `<div class="page">${p.map((b) => block[b.type](b)).join('')}${foot(i + 2)}</div>`).join('');
  const end = `<div class="page end"><p class="kick">${u.endKick}</p><h2>${u.endTitle}</h2><p>${u.endText}</p>
<a class="btn" href="${u.endUrl}">${u.endBtn}</a><p class="more">${u.more}</p>
<p class="kick">${u.sources}</p><ol class="src">${g.sources.map(([t, l]) => `<li><a href="${l}">${esc(t)}</a></li>`).join('')}</ol>
<p class="src" style="margin-top:4mm">${g.note ? esc(g.note) + ' ' : ''}${u.signature}<br>${u.contacts}</p>${foot(g.pages.length + 2)}</div>`;
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${esc(g.title)}</title><style>${css}</style></head><body>
<div class="page cover"><div class="card">${logo}<p class="kick">${esc(g.kicker)}</p><h1>${esc(g.title)}</h1><p class="sub">${esc(g.sub)}</p><span class="free">${u.free}</span></div></div>
${body}${end}</body></html>`;
};

mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
for (const lang of ['it', 'en']) {
  for (const g of guide[lang]) {
    await page.setContent(build(g, lang), { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.pdf({ path: `${out}/${g.slug}.pdf`, format: 'A4', printBackground: true, preferCSSPageSize: true });
    console.log(lang, g.keyword, `${g.slug}.pdf`);
  }
}
await browser.close();
