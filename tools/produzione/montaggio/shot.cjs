const { chromium } = require('playwright');
(async () => {
  const [dir] = process.argv.slice(2);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1350 } });
  await p.goto('file://' + dir + '/carosello.html'); await p.evaluate(() => document.fonts.ready);
  const n = await p.$$eval('.slide', s => s.length);
  for (let i = 0; i < n; i++) { const el = (await p.$$('.slide'))[i]; await el.screenshot({ path: `${dir}/slide/s-${i + 1}.png` }); }
  await p.pdf({ path: dir + '/quantumre-carosello-cosa-resta-tuo.pdf', width: '1080px', height: '1350px', printBackground: true });
  await p.goto('file://' + dir + '/giovanni.html'); await p.evaluate(() => document.fonts.ready);
  await (await p.$('.slide')).screenshot({ path: dir + '/post-giovanni.png' });
  await b.close(); console.log('slides', n);
})();
