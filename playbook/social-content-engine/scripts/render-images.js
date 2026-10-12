// Screenshot single-image post HTML files (1080x1350) to PNG next to each file.
// Usage: node render-images.js /abs/a.html /abs/b.html ...
const {chromium} = require(process.env.PLAYWRIGHT_PATH || 'playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({viewport: {width: 1080, height: 1350}});
  for (const f of process.argv.slice(2)) {
    await p.goto('file://' + f);
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(300);
    await p.screenshot({path: f.replace(/\.html$/, '.png')});
    console.log('ok', f);
  }
  await b.close();
})();
