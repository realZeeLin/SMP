/**
 * 生成小程序图标 PNG（tabBar 需本地 PNG）：线性图标，1.6px 描边，圆角端点，墨蓝/灰两态。
 * 运行：node design/icons.js
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'miniprogram', 'images');
const { PATHS: P, svg } = require('./icon-paths');


(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const shot = async (html, size, file) => {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<html><body style="margin:0;background:transparent">${html}</body></html>`);
    await page.screenshot({ path: file, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  };
  fs.mkdirSync(path.join(OUT, 'tab'), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'icon'), { recursive: true });
  for (const k of ['home', 'issues', 'review', 'members']) {
    await shot(`<div style="width:81px;height:81px;padding:12px;box-sizing:border-box">${svg(P[k], '#9AA0A9')}</div>`, 81, path.join(OUT, 'tab', `${k}.png`));
    await shot(`<div style="width:81px;height:81px;padding:12px;box-sizing:border-box">${svg(P[k], '#1B2B48', 1.9)}</div>`, 81, path.join(OUT, 'tab', `${k}-on.png`));
  }
  // 快捷操作：圆角方块浅底 + 线性图标
  const tiles = { weekly: ['#E8ECF3', '#1B2B48'], monthly: ['#F5EEDF', '#9A7438'], roster: ['#E3F0EC', '#2F6F62'], review: ['#F6E7E5', '#A04F48'] };
  for (const [k, [bg, fg]] of Object.entries(tiles)) {
    const d = k === 'review' ? P.reviewq : P[k];
    await shot(`<div style="width:144px;height:144px;border-radius:40px;background:${bg};padding:36px;box-sizing:border-box">${svg(d, fg, 1.7)}</div>`, 144, path.join(OUT, 'icon', `${k}.png`));
  }
  await shot(`<div style="width:72px;height:72px;padding:6px;box-sizing:border-box">${svg(P.settings, '#1B2B48', 1.7)}</div>`, 72, path.join(OUT, 'icon', 'settings.png'));
  await shot(`<div style="width:64px;height:64px;padding:4px;box-sizing:border-box">${svg(P.search, '#9AA0A9', 2)}</div>`, 64, path.join(OUT, 'icon', 'search.png'));
  await browser.close();
  console.log('icons ok');
})();

