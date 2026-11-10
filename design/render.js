/** 渲染页面风格图：design/screens/*.png（单页 @2x）与 design/overview.png（总览）。运行：npm run mockups */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { html, screens } = require('./mockups');

(async () => {
  const out = path.join(__dirname, 'screens');
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'mockups.html'), html);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 2700, height: 1200 }, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  for (const s of screens) {
    await page.locator(`#s-${s.id} .phone`).screenshot({ path: path.join(out, `${s.id}.png`), omitBackground: true });
  }
  const p2 = await browser.newPage({ viewport: { width: 2700, height: 1200 }, deviceScaleFactor: 1 });
  await p2.setContent(html, { waitUntil: 'load' });
  await p2.evaluate(() => document.fonts.ready);
  await p2.locator('#board').screenshot({ path: path.join(__dirname, 'overview.png') });
  await browser.close();
  console.log(`rendered ${screens.length} screens`);
})();
