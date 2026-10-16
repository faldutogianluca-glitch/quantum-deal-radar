// Immagini social 1080x1080 di Milano Retail Tour da un file JSON di slide.
// Uso: node render.mjs <slides.json> <cartella-output>
// Ogni slide: { "file": "nome.png", "kicker": "...", "title": "...", "body": ["riga", ...], "big": "370 ore", "note": "Fonte: ..." }
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
// playwright dal progetto o, se manca, dall'installazione globale
const req = createRequire(import.meta.url);
const { chromium } = (() => { try { return req('playwright'); } catch { return req(`${process.env.NODE_PATH || '/opt/node22/lib/node_modules'}/playwright`); } })();
const radar = resolve(here, '../../radar');
const [, , specFile, outDir] = process.argv;
const slides = JSON.parse(readFileSync(specFile, 'utf8'));
mkdirSync(outDir, { recursive: true });

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const font = (name, file, w, st = 'normal') => `@font-face{font-family:${name};font-weight:${w};font-style:${st};src:url(data:font/woff2;base64,${readFileSync(`${radar}/fonts/${file}`).toString('base64')})}`;

const page = (s) => `<!doctype html><html><head><meta charset="utf-8"><style>
${font('Merriweather', 'merriweather-latin-400-normal.woff2', 400)}
${font('Merriweather', 'merriweather-latin-700-normal.woff2', 700)}
${font('Arvo', 'arvo-latin-400-normal.woff2', 400)}
${font('Arvo', 'arvo-latin-700-normal.woff2', 700)}
*{box-sizing:border-box;margin:0;padding:0}
body{width:1080px;height:1080px;background:#c9cacc;font-family:Arvo,Georgia,serif;color:#3d3c3f}
.card{position:absolute;inset:56px;background:#fff;border-radius:14px;padding:72px 76px;display:flex;flex-direction:column}
.kicker{font:700 22px/1.4 Merriweather,Georgia,serif;letter-spacing:5px;text-transform:uppercase;color:#707173}
.title{font:700 ${s.titleSize || 62}px/1.22 Merriweather,Georgia,serif;margin-top:34px;letter-spacing:-0.5px}
.big{font:700 ${s.bigSize || 150}px/1 Merriweather,Georgia,serif;margin-top:40px;letter-spacing:-2px}
.body{margin-top:38px;font-size:31px;line-height:1.5;color:#3d3c3f}
.body li{list-style:none;padding:12px 0 12px 46px;position:relative;border-top:2px solid #e6e6e8}
.body li:first-child{border-top:0}
.body li:before{content:"";position:absolute;left:4px;top:30px;width:16px;height:16px;border-radius:50%;background:#3d3c3f}
.body p{margin-bottom:18px}
.note{margin-top:auto;padding-top:28px;font-size:21px;line-height:1.45;color:#707173}
.foot{position:absolute;left:56px;right:56px;bottom:0;height:56px;display:flex;align-items:center;justify-content:space-between;font:700 19px/1 Merriweather,Georgia,serif;letter-spacing:3px;text-transform:uppercase;color:#3d3c3f}
.num{position:absolute;top:72px;right:76px;font:700 22px/1.4 Merriweather,Georgia,serif;color:#9a999c}
</style></head><body>
<div class="card">
 ${s.num ? `<div class="num">${esc(s.num)}</div>` : ''}
 ${s.kicker ? `<div class="kicker">${esc(s.kicker)}</div>` : ''}
 ${s.title ? `<div class="title">${esc(s.title)}</div>` : ''}
 ${s.big ? `<div class="big">${esc(s.big)}</div>` : ''}
 ${s.body ? `<ul class="body">${s.body.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
 ${s.para ? `<div class="body">${s.para.map((l) => `<p>${esc(l)}</p>`).join('')}</div>` : ''}
 ${s.note ? `<div class="note">${esc(s.note)}</div>` : ''}
</div>
<div class="foot"><span>Milano Retail Tour · MiRT</span><span>milanoretailtour.com</span></div>
</body></html>`;

const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 1080, height: 1080 } });
for (const s of slides) {
  await p.setContent(page(s), { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: resolve(outDir, s.file), type: s.file.endsWith('.jpg') ? 'jpeg' : 'png', quality: s.file.endsWith('.jpg') ? 92 : undefined });
  console.log('ok', s.file);
}
await browser.close();
