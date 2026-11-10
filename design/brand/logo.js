/**
 * 小程序头像（Logo）方案：与界面同一设计语言（iOS 系统蓝渐变 + 白色图形，圆角/圆形裁切安全区内构图）。
 * 运行：node design/brand/logo.js → design/brand/*.png 与 brand-board.png
 */
const { chromium } = require('playwright');
const path = require('path');

const OUT = __dirname;
const grad = (id, a, b) => `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>
  <radialGradient id="${id}h" cx=".3" cy=".2" r=".9"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
  <rect width="1024" height="1024" fill="url(#${id})"/><rect width="1024" height="1024" fill="url(#${id}h)"/>`;

// A 推荐：对话气泡 + 学者关系网络（社会媒体处理 × 学术动态）
const A = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${grad('ga', '#2D9BFF', '#4F46E5')}
  <path d="M512 236c-168 0-292 104-292 246 0 78 38 147 101 194l-23 104c-4 18 15 32 31 23l116-63c21 4 44 6 67 6 168 0 292-104 292-246S680 236 512 236z" fill="#fff"/>
  <g stroke="#3B6CF6" stroke-width="34" stroke-linecap="round"><path d="M362 520 470 370M470 370 660 438M470 370 556 600M362 520 556 600M660 438 556 600"/></g>
  <g fill="#3B6CF6"><circle cx="470" cy="370" r="62"/><circle cx="362" cy="520" r="46"/><circle cx="660" cy="438" r="52"/><circle cx="556" cy="600" r="44"/></g>
  <circle cx="470" cy="370" r="24" fill="#fff"/></svg>`;

// B：SMP 字标
const B = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${grad('gb', '#1E7BFF', '#0040DD')}
  <text x="512" y="590" text-anchor="middle" font-family="Inter" font-weight="800" font-size="300" letter-spacing="-8" fill="#fff">SMP</text>
  <rect x="300" y="652" width="424" height="18" rx="9" fill="#fff" opacity=".55"/><circle cx="724" cy="661" r="26" fill="#FFD60A"/></svg>`;

// C：传播信号（节点 + 向外扩散的弧线）
const C = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${grad('gc', '#5E5CE6', '#2B2A8C')}
  <g fill="none" stroke="#fff" stroke-linecap="round"><path d="M600 402a130 130 0 0 1 0 220" stroke-width="40" opacity=".95"/><path d="M672 330a232 232 0 0 1 0 364" stroke-width="40" opacity=".7"/><path d="M744 258a334 334 0 0 1 0 508" stroke-width="40" opacity=".45"/></g>
  <circle cx="452" cy="512" r="110" fill="#fff"/><circle cx="452" cy="512" r="44" fill="#5E5CE6"/></svg>`;

const OPTIONS = [['A', A, '学者网络气泡', '对话气泡＝社会媒体，节点连线＝委员学术网络（推荐）'], ['B', B, 'SMP 字标', '直接突出专委会简称，辨识度高'], ['C', C, '传播信号', '节点向外扩散，寓意动态传播']];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const [k, svg] of OPTIONS) {
    for (const size of [1024, 144]) {
      await page.setViewportSize({ width: size, height: size });
      await page.setContent(`<html><body style="margin:0">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
      await page.waitForTimeout(50);
      await page.screenshot({ path: path.join(OUT, `avatar-${k}-${size}.png`), clip: { x: 0, y: 0, width: size, height: size } });
    }
  }
  // 展示板：原图、圆形裁切（微信多处以圆形展示）、小尺寸、搜索结果与“最近使用”场景
  const card = (k, svg, name, desc) => `
  <div class="opt ${k === 'A' ? 'rec' : ''}">
    <div class="head"><b>方案 ${k}</b>　${name}${k === 'A' ? '<span class="tag">推荐</span>' : ''}</div><div class="desc">${desc}</div>
    <div class="row">
      <div class="big">${svg}</div>
      <div class="col">
        <div class="circ">${svg}</div>
        <div class="sizes"><div class="c40">${svg}</div><div class="c28">${svg}</div><div class="c20">${svg}</div></div>
      </div>
    </div>
    <div class="scene">
      <div class="search"><div class="av">${svg}</div><div><div class="n">SMP学术动态</div><div class="d">小程序 · 社会媒体处理专委会委员学术动态</div></div></div>
      <div class="dock">${['#34C759', null, '#FF9500', '#8E8E93'].map((c) => `<div class="app">${c ? `<div class="ph" style="background:${c}"></div>` : `<div class="av2">${svg}</div>`}<span>${c ? '小程序' : 'SMP学术动态'}</span></div>`).join('')}</div>
    </div>
  </div>`;
  const html = `<html><head><meta charset="utf-8"><style>
    body{margin:0;background:#F2F2F7;font-family:Inter,'Noto Sans CJK SC';color:#1D1D1F}
    .board{padding:56px 60px;width:1500px}
    h1{font-size:40px;margin:0;letter-spacing:-.5px} .sub{color:#6E6E73;font-size:16px;margin:8px 0 36px}
    .grid{display:flex;gap:28px}
    .opt{flex:1;background:#fff;border-radius:22px;padding:26px;box-shadow:0 4px 18px rgba(0,0,0,.05)} .opt.rec{box-shadow:0 0 0 3px #007AFF,0 8px 30px rgba(0,122,255,.18)}
    .head{font-size:20px} .tag{background:#007AFF;color:#fff;font-size:13px;font-weight:600;border-radius:10px;padding:2px 9px;margin-left:8px;vertical-align:middle}
    .desc{color:#6E6E73;font-size:14px;margin:6px 0 18px;min-height:20px}
    .row{display:flex;gap:18px;align-items:center}
    .big svg{width:200px;height:200px;border-radius:44px;display:block}
    .col{display:flex;flex-direction:column;gap:14px;align-items:flex-start}
    .circ svg{width:110px;height:110px;border-radius:50%;display:block}
    .sizes{display:flex;gap:10px;align-items:flex-end} .sizes svg{display:block;border-radius:50%}
    .c40 svg{width:40px;height:40px}.c28 svg{width:28px;height:28px}.c20 svg{width:20px;height:20px}
    .scene{margin-top:22px;background:#F2F2F7;border-radius:16px;padding:14px}
    .search{display:flex;gap:12px;align-items:center;background:#fff;border-radius:12px;padding:12px}
    .search .av svg{width:48px;height:48px;border-radius:50%;display:block} .n{font-weight:600;font-size:16px} .d{font-size:12px;color:#86868B;margin-top:2px}
    .dock{display:flex;justify-content:space-around;margin-top:14px}
    .app{display:flex;flex-direction:column;align-items:center;font-size:11px;color:#6E6E73;gap:5px;width:70px;text-align:center}
    .app .ph{width:48px;height:48px;border-radius:50%;opacity:.25} .av2 svg{width:48px;height:48px;border-radius:50%;display:block}
  </style></head><body><div class="board" id="b"><h1>小程序头像方案</h1><div class="sub">与界面同一设计语言：iOS 系统色渐变 + 白色图形 · 构图位于圆形安全区内（微信多处以圆形展示）· 展示原图、圆形裁切、40/28/20px 小尺寸与真实场景</div>
  <div class="grid">${OPTIONS.map(([k, s, n, d]) => card(k, s, n, d)).join('')}</div></div></body></html>`;
  const p2 = await browser.newPage({ viewport: { width: 1620, height: 900 }, deviceScaleFactor: 1 });
  await p2.setContent(html);
  await p2.waitForTimeout(100);
  await p2.locator('#b').screenshot({ path: path.join(OUT, 'brand-board.png') });
  await browser.close();
  console.log('logo ok');
})();
