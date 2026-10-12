// Render a carousel HTML (one <section class="slide"> per slide, 1080x1350)
// into a PDF (LinkedIn document) + one PNG per slide, and report text that
// overlaps the footer/notes.
// Usage: node render-carousel.cjs /abs/carousel.html /abs/out.pdf /abs/slide-dir
// Playwright: set PLAYWRIGHT_PATH if it is not resolvable with require('playwright').
const {chromium} = require(process.env.PLAYWRIGHT_PATH || 'playwright');
(async () => {
  const [, , html, pdf, outdir] = process.argv;
  const b = await chromium.launch();
  const p = await b.newPage({viewport: {width: 1080, height: 1350}});
  await p.goto('file://' + html);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(300);
  await p.pdf({path: pdf, width: '1080px', height: '1350px', printBackground: true});
  const slides = await p.$$('section.slide');
  for (let i = 0; i < slides.length; i++) await slides[i].screenshot({path: `${outdir}/s-${i + 1}.png`});
  const report = await p.$$eval('section.slide', ss => ss.map((s, i) => {
    const skip = c => ['foot', 'notes', 'logo', 'swipe'].some(k => c.classList.contains(k));
    const top = s.getBoundingClientRect().top;
    const bottom = Math.max(...[...s.children].filter(c => !skip(c)).map(k => k.getBoundingClientRect().bottom)) - top;
    const lim = (s.querySelector('.notes') || s.querySelector('.foot') || s.querySelector('.swipe')).getBoundingClientRect().top - top;
    return `s${i + 1}: content ${Math.round(bottom)} / limit ${Math.round(lim)}${bottom > lim - 10 ? '  <-- OVERLAP' : ''}`;
  }));
  console.log(report.join('\n'));
  await b.close();
})();
