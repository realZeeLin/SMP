/**
 * 小程序头像：SMP 字标 + 社交动态讯号，三个融合方案，输出 JPG（1024 / 512 / 144）与对比板。
 * 构图位于圆形安全区内（微信多处以圆形展示）。运行：node design/brand/logo.js
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT = __dirname;
const bg = (id, a, b) => `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>
  <radialGradient id="${id}h" cx=".25" cy=".15" r=".95"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
  <rect width="1024" height="1024" fill="url(#${id})"/><rect width="1024" height="1024" fill="url(#${id}h)"/>`;
// 以 (cx,cy) 为圆心、开口朝右上方的讯号弧（-80°~-10°）
const arc = (cx, cy, r, a0 = -80, a1 = -10) => {
  const p = (a) => [cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)];
  const [x0, y0] = p(a0); const [x1, y1] = p(a1);
  return `M${x0.toFixed(1)} ${y0.toFixed(1)}A${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
};
const SMP = (y, size, fill = '#fff', extra = '') => `<text x="512" y="${y}" text-anchor="middle" font-family="Inter" font-weight="800" font-size="${size}" letter-spacing="-6" fill="${fill}" ${extra}>SMP</text>`;

// 方案 1（推荐）：SMP 字标 + 右上方扩散讯号，讯号源为一个“动态”亮点
const S1 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${bg('g1', '#2D9BFF', '#3B3FE0')}
  ${SMP(660, 290)}
  <circle cx="712" cy="356" r="40" fill="#FFD60A"/>
  <g fill="none" stroke="#fff" stroke-linecap="round" stroke-width="42">
    <path d="${arc(712, 356, 92)}" opacity=".95"/><path d="${arc(712, 356, 160)}" opacity=".65"/><path d="${arc(712, 356, 228)}" opacity=".35"/></g>
  <rect x="392" y="716" width="240" height="20" rx="10" fill="#fff" opacity=".45"/></svg>`;

// 方案 2：对话气泡（社交）内含 SMP，气泡右上角发出讯号
const S2 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${bg('g2', '#1E88FF', '#4F46E5')}
  <path d="M470 300c-160 0-272 92-272 214 0 66 32 124 86 164l-20 92c-4 17 14 30 29 22l104-56c23 5 47 8 73 8 160 0 272-92 272-214S630 300 470 300z" fill="#fff"/>
  ${SMP(580, 196, '#2F5BEA', 'transform="translate(-42 0)"')}
  <g fill="none" stroke="#fff" stroke-linecap="round" stroke-width="30">
    <path d="${arc(742, 300, 70)}" opacity=".95"/><path d="${arc(742, 300, 128)}" opacity=".6"/></g>
  <circle cx="742" cy="300" r="22" fill="#FFD60A"/></svg>`;

// 方案 3：SMP 字标 + 上方学者网络节点（节点间连线 + 向外的讯号弧）
const S3 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${bg('g3', '#5E5CE6', '#1D4ED8')}
  ${SMP(700, 270)}
  <g fill="none" stroke="#fff" stroke-width="22" stroke-linecap="round" stroke-linejoin="round" opacity=".9"><path d="M330 380 470 300 610 360 720 290"/></g>
  <g fill="#fff"><circle cx="330" cy="380" r="34"/><circle cx="470" cy="300" r="42"/><circle cx="610" cy="360" r="34"/></g>
  <circle cx="720" cy="290" r="36" fill="#FFD60A"/>
  <g fill="none" stroke="#fff" stroke-linecap="round" stroke-width="22"><path d="${arc(720, 290, 78, -70, 10)}" opacity=".8"/><path d="${arc(720, 290, 130, -70, 10)}" opacity=".45"/></g></svg>`;

const OPTIONS = [
  ['1', S1, 'SMP + 扩散讯号', '字标居中、右上方三道讯号弧，黄色亮点为“动态”源（推荐）'],
  ['2', S2, '社交气泡 + SMP', '对话气泡内嵌 SMP，气泡发出讯号，社交属性最直观'],
  ['3', S3, 'SMP + 学者网络', '上方节点连线代表委员网络，末端节点发出讯号'],
];

(async () => {
  for (const f of fs.readdirSync(OUT)) if (/^avatar-.*\.(png|jpg)$/.test(f)) fs.unlinkSync(path.join(OUT, f));
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const [k, svg] of OPTIONS) {
    for (const size of [1024, 512, 144]) {
      await page.setViewportSize({ width: size, height: size });
      await page.setContent(`<html><body style="margin:0">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: path.join(OUT, `avatar-${k}-${size}.jpg`), type: 'jpeg', quality: 95, clip: { x: 0, y: 0, width: size, height: size } });
    }
  }
  const card = (k, svg, name, desc) => `
  <div class="opt ${k === '1' ? 'rec' : ''}">
    <div class="head"><b>方案 ${k}</b>　${name}${k === '1' ? '<span class="tag">推荐</span>' : ''}</div><div class="desc">${desc}</div>
    <div class="row"><div class="big">${svg}</div>
      <div class="col"><div class="circ">${svg}</div><div class="sizes"><div class="c40">${svg}</div><div class="c28">${svg}</div><div class="c20">${svg}</div></div></div></div>
    <div class="scene"><div class="search"><div class="av">${svg}</div><div><div class="n">SMP学术动态</div><div class="d">小程序 · 社会媒体处理专委会委员学术动态</div></div></div></div>
  </div>`;
  const html = `<html><head><meta charset="utf-8"><style>
    body{margin:0;background:#F2F2F7;font-family:Inter,'Noto Sans CJK SC';color:#1D1D1F}
    .board{padding:56px 60px;width:1500px} h1{font-size:40px;margin:0;letter-spacing:-.5px} .sub{color:#6E6E73;font-size:16px;margin:8px 0 36px}
    .grid{display:flex;gap:28px} .opt{flex:1;background:#fff;border-radius:22px;padding:26px;box-shadow:0 4px 18px rgba(0,0,0,.05)}
    .opt.rec{box-shadow:0 0 0 3px #007AFF,0 8px 30px rgba(0,122,255,.18)}
    .head{font-size:20px} .tag{background:#007AFF;color:#fff;font-size:13px;font-weight:600;border-radius:10px;padding:2px 9px;margin-left:8px;vertical-align:middle}
    .desc{color:#6E6E73;font-size:14px;margin:6px 0 18px;min-height:40px}
    .row{display:flex;gap:18px;align-items:center} .big svg{width:200px;height:200px;border-radius:44px;display:block}
    .col{display:flex;flex-direction:column;gap:14px} .circ svg{width:110px;height:110px;border-radius:50%;display:block}
    .sizes{display:flex;gap:10px;align-items:flex-end} .sizes svg{display:block;border-radius:50%}
    .c40 svg{width:40px;height:40px}.c28 svg{width:28px;height:28px}.c20 svg{width:20px;height:20px}
    .scene{margin-top:22px;background:#F2F2F7;border-radius:16px;padding:14px}
    .search{display:flex;gap:12px;align-items:center;background:#fff;border-radius:12px;padding:12px}
    .search .av svg{width:48px;height:48px;border-radius:50%;display:block} .n{font-weight:600;font-size:16px} .d{font-size:12px;color:#86868B;margin-top:2px}
  </style></head><body><div class="board" id="b"><h1>小程序头像：SMP × 社交动态讯号</h1>
  <div class="sub">三个融合方案 · 构图位于圆形安全区内 · 展示原图、圆形裁切、40/28/20px 小尺寸与搜索结果场景</div>
  <div class="grid">${OPTIONS.map(([k, s, n, d]) => card(k, s, n, d)).join('')}</div></div></body></html>`;
  const p2 = await browser.newPage({ viewport: { width: 1620, height: 900 }, deviceScaleFactor: 1 });
  await p2.setContent(html);
  await p2.evaluate(() => document.fonts.ready);
  await p2.locator('#b').screenshot({ path: path.join(OUT, 'brand-board.jpg'), type: 'jpeg', quality: 92 });
  await browser.close();
  console.log('logo ok');
})();
