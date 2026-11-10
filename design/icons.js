/**
 * 生成小程序图标 PNG：
 *  images/tab/*.png      标签栏（未选中：灰色线性；选中：系统蓝实心）
 *  images/glyph/*.png    白色线性图标，放在彩色圆角方块里使用（iOS“设置”风格）
 *  images/glyph/*-gray.png  灰色版本（搜索框等）
 * 运行：node design/icons.js
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { TAB, GLYPH, line, solid } = require('./icon-paths');

const OUT = path.join(__dirname, '..', 'miniprogram', 'images');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const shot = async (inner, size, pad, file) => {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<html><body style="margin:0;background:transparent"><div style="width:${size}px;height:${size}px;padding:${pad}px;box-sizing:border-box">${inner}</div></body></html>`);
    await page.screenshot({ path: file, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  };
  fs.rmSync(path.join(OUT, 'icon'), { recursive: true, force: true });
  for (const d of ['tab', 'glyph']) fs.mkdirSync(path.join(OUT, d), { recursive: true });
  for (const [k, v] of Object.entries(TAB)) {
    await shot(line(v.outline, '#8E8E93', 1.7), 81, 14, path.join(OUT, 'tab', `${k}.png`));
    await shot(solid(v.fill, '#007AFF', 1.7), 81, 14, path.join(OUT, 'tab', `${k}-on.png`));
  }
  for (const [k, d] of Object.entries(GLYPH)) {
    await shot(line(d, '#FFFFFF', 2), 72, 6, path.join(OUT, 'glyph', `${k}.png`));
  }
  for (const k of ['search', 'sparkles', 'pencil', 'link', 'copy', 'share']) {
    await shot(line(GLYPH[k], '#8E8E93', 2), 72, 6, path.join(OUT, 'glyph', `${k}-gray.png`));
    await shot(line(GLYPH[k], '#007AFF', 2), 72, 6, path.join(OUT, 'glyph', `${k}-blue.png`));
  }
  await browser.close();
  console.log('icons ok');
})();
