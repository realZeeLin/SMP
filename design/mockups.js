/**
 * 页面风格图（Apple 风格设计稿）：与小程序 app.wxss 使用同一套 iOS 设计规范（rpx ÷ 2 = px，375 宽）。
 * 输出 design/mockups.html；design/render.js 截图为 PNG。示例人物与动态均为虚构。
 */
const { TAB, GLYPH, line, solid } = require('./icon-paths');
const { renderWechatHtml } = require('../cloudfunctions/smp/lib/compose');

const CAT = {
  org: ['专委会动态', '#5856D6', 'building'], honor: ['学术荣誉', '#FF9500', 'sparkles'], research: ['学术成果', '#30B0C7', 'doc'],
  project: ['科研项目', '#AF52DE', 'chart'], activity: ['学术活动', '#007AFF', 'globe'], service: ['学术任职', '#A2845E', 'person'],
  influence: ['学术影响力', '#FF2D55', 'bolt'],
};
const rgba = (hex, a) => `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${a})`;

const css = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #E8E8ED; font-family: Inter, 'Noto Sans CJK SC', sans-serif; -webkit-font-smoothing: antialiased; }
.board { padding: 64px 72px 72px; }
.bh { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 48px; }
.bh .k { font-size: 15px; font-weight: 600; color: #0071E3; }
.bh h1 { font-size: 44px; font-weight: 700; letter-spacing: -.5px; color: #1D1D1F; margin-top: 6px; }
.bh p { font-size: 16px; color: #6E6E73; margin-top: 8px; }
.pal { display: flex; gap: 12px; }
.pal div { text-align: center; font-size: 11px; color: #6E6E73; width: 56px; }
.pal i { display: block; width: 44px; height: 44px; border-radius: 12px; margin: 0 auto 6px; box-shadow: inset 0 0 0 1px rgba(0,0,0,.06); }
.grid { display: grid; grid-template-columns: repeat(6, 375px); gap: 56px 44px; }
.cap { text-align: center; margin-top: 18px; } .cap b { font-size: 17px; color: #1D1D1F; } .cap span { display: block; font-size: 13px; color: #86868B; margin-top: 2px; }

.phone { --blue:#007AFF; --green:#34C759; --orange:#FF9500; --red:#FF3B30; --indigo:#5856D6;
  --label:#000; --label2:rgba(60,60,67,.6); --label3:rgba(60,60,67,.3); --sep:rgba(60,60,67,.18); --fill:rgba(118,118,128,.12);
  --bg:#F2F2F7; --card:#FFF; --bar:rgba(249,249,249,.94); --segon:#FFF; --shadow:0 1px 3px rgba(0,0,0,.04),0 4px 12px rgba(0,0,0,.04);
  width: 375px; height: 812px; border-radius: 54px; overflow: hidden; position: relative; background: var(--bg); color: var(--label);
  font-size: 17px; line-height: 1.3; letter-spacing: -.2px; box-shadow: 0 0 0 11px #1C1C1E, 0 0 0 12px #3A3A3C, 0 40px 80px rgba(0,0,0,.25); }
.phone.dark { --blue:#0A84FF; --green:#30D158; --orange:#FF9F0A; --red:#FF453A; --indigo:#5E5CE6;
  --label:#FFF; --label2:rgba(235,235,245,.6); --label3:rgba(235,235,245,.3); --sep:rgba(84,84,88,.6); --fill:rgba(118,118,128,.24);
  --bg:#000; --card:#1C1C1E; --bar:rgba(22,22,22,.9); --segon:#636366; --shadow:none; }
.island { position: absolute; top: 11px; left: 50%; margin-left: -63px; width: 126px; height: 37px; border-radius: 20px; background: #000; z-index: 30; }
.sb { position: absolute; top: 0; left: 0; right: 0; height: 54px; display: flex; align-items: center; justify-content: space-between; padding: 6px 34px 0 52px; font-size: 16px; font-weight: 600; z-index: 25; color: var(--label); }
.sb .ic { display: flex; gap: 6px; align-items: center; }
.bat { width: 25px; height: 12px; border: 1.2px solid currentColor; border-radius: 4px; padding: 1.5px; opacity: .9; position: relative; } .bat i { display: block; height: 100%; width: 78%; background: currentColor; border-radius: 1.5px; }
.nav { position: absolute; top: 54px; left: 0; right: 0; height: 44px; display: flex; align-items: center; justify-content: center; font-size: 17px; font-weight: 600; z-index: 20; }
.nav .back { position: absolute; left: 8px; display: flex; align-items: center; color: var(--blue); font-weight: 400; font-size: 17px; }
.nav .back svg { width: 22px; height: 22px; }
.navbg { position: absolute; top: 0; left: 0; right: 0; height: 98px; background: var(--bar); backdrop-filter: blur(20px); border-bottom: .5px solid var(--sep); z-index: 15; }
.capsule { position: absolute; right: 7px; top: 6px; width: 87px; height: 32px; border-radius: 16px; display: flex; align-items: center; border: .5px solid var(--sep); background: rgba(255,255,255,.6); color: #000; }
.dark .capsule { background: rgba(0,0,0,.3); color: #fff; border-color: rgba(255,255,255,.2); }
.capsule > span { flex: 1; display: flex; justify-content: center; } .capsule .d { width: .5px; height: 18px; background: var(--sep); flex: none; }
.capsule .rec { width: 17px; height: 17px; border-radius: 50%; border: 2px solid currentColor; position: relative; } .capsule .rec::after { content: ''; position: absolute; inset: 3px; border-radius: 50%; background: currentColor; }
.content { position: absolute; top: 98px; left: 0; right: 0; bottom: 0; overflow: hidden; }
.content.ltnav { top: 54px; }
.content.tab { bottom: 83px; } .content.tool { bottom: 0; }
.tabbar { position: absolute; left: 0; right: 0; bottom: 0; height: 83px; background: var(--bar); backdrop-filter: blur(20px); border-top: .5px solid var(--sep); display: flex; padding-top: 7px; z-index: 20; }
.tabbar .t { flex: 1; display: flex; flex-direction: column; align-items: center; font-size: 10px; font-weight: 500; color: #8E8E93; letter-spacing: 0; }
.tabbar .t.on { color: var(--blue); } .tabbar .ti { width: 28px; height: 28px; margin-bottom: 1px; }
.toolbar { position: absolute; left: 0; right: 0; bottom: 0; padding: 8px 16px 34px; display: flex; gap: 8px; background: var(--bar); backdrop-filter: blur(20px); border-top: .5px solid var(--sep); z-index: 20; }
.toolbar .btn { flex: 1; height: 44px; border-radius: 11px; font-size: 16px; }
.home { position: absolute; bottom: 8px; left: 50%; margin-left: -67px; width: 134px; height: 5px; border-radius: 3px; background: var(--label); z-index: 40; }

.lt { padding: 44px 16px 8px; } .lt-date { font-size: 13px; font-weight: 600; color: var(--label2); }
.lt-title { font-size: 34px; font-weight: 700; letter-spacing: .2px; display: flex; align-items: center; justify-content: space-between; line-height: 1.2; }
.row { display: flex; align-items: center; } .between { display: flex; align-items: center; justify-content: space-between; } .flex1 { flex: 1; min-width: 0; } .wrap { flex-wrap: wrap; }
.title1 { font-size: 28px; font-weight: 700; line-height: 1.2; } .title2 { font-size: 22px; font-weight: 700; } .title3 { font-size: 20px; font-weight: 600; }
.headline { font-size: 17px; font-weight: 600; line-height: 1.3; } .subhead { font-size: 15px; line-height: 1.33; } .footnote { font-size: 13px; } .caption { font-size: 12px; } .callout { font-size: 16px; }
.secondary { color: var(--label2); } .tertiary { color: var(--label3); } .tint { color: var(--blue); } .semi { font-weight: 600; }
.num { font-variant-numeric: tabular-nums; }
.ellipsis { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .clamp2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.group { margin: 0 16px 28px; } .gh { padding: 0 32px 7px; font-size: 13px; color: var(--label2); display: flex; justify-content: space-between; align-items: flex-end; }
.gh .big { font-size: 20px; font-weight: 700; color: var(--label); } .gf { padding: 7px 16px 0; font-size: 13px; color: var(--label2); line-height: 1.4; }
.list { background: var(--card); border-radius: 10px; overflow: hidden; }
.cell { position: relative; display: flex; align-items: center; min-height: 44px; padding: 10px 16px; }
.cell + .cell::before { content: ''; position: absolute; top: 0; right: 0; left: 16px; height: .5px; background: var(--sep); }
.icons .cell + .cell::before { left: 60px; } .avs .cell + .cell::before { left: 72px; } .cal .cell + .cell::before { left: 68px; }
.value { color: var(--label2); margin-left: 8px; }
.chev { width: 8px; height: 8px; border-top: 2px solid var(--label3); border-right: 2px solid var(--label3); transform: rotate(45deg); margin-left: 8px; flex-shrink: 0; border-radius: 1px; }
.tile { width: 29px; height: 29px; border-radius: 6.5px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-right: 15px; }
.tile.sm { width: 18px; height: 18px; border-radius: 4.5px; margin-right: 6px; } .tile.round { width: 22px; height: 22px; border-radius: 50%; margin-right: 15px; } .tile.rnd { margin-right: 22px; }
.tile i { display: block; width: 20px; height: 20px; } .tile.sm i { width: 13px; height: 13px; } .tile.round i { width: 15px; height: 15px; }
.card { background: var(--card); border-radius: 12px; padding: 14px 16px; box-shadow: var(--shadow); }
.wh { display: flex; align-items: center; font-size: 15px; font-weight: 600; }
.metric { font-size: 32px; font-weight: 700; letter-spacing: -.5px; line-height: 1.1; font-variant-numeric: tabular-nums; } .metric small { font-size: 15px; color: var(--label2); margin-left: 3px; font-weight: 600; }
.btn { display: flex; align-items: center; justify-content: center; height: 50px; border-radius: 12px; font-size: 17px; font-weight: 600; }
.filled { background: var(--blue); color: #fff; } .tinted { background: rgba(0,122,255,.15); color: var(--blue); } .gray { background: var(--fill); color: var(--label); }
.seg { display: flex; background: var(--fill); border-radius: 9px; padding: 2px; } .seg div { flex: 1; text-align: center; height: 28px; line-height: 28px; border-radius: 7px; font-size: 13px; font-weight: 500; }
.seg .on { background: var(--segon); font-weight: 600; box-shadow: 0 3px 8px rgba(0,0,0,.12), 0 3px 1px rgba(0,0,0,.04); }
.cap2 { display: inline-flex; align-items: center; height: 22px; padding: 0 8px; border-radius: 11px; font-size: 12px; font-weight: 600; white-space: nowrap; }
.cap2 .dt { width: 6px; height: 6px; border-radius: 50%; margin-right: 4px; }
.chip { display: inline-flex; align-items: center; height: 30px; padding: 0 13px; border-radius: 15px; font-size: 14px; background: var(--fill); margin-right: 7px; white-space: nowrap; } .chip.on { background: var(--blue); color: #fff; font-weight: 600; }
.mono { width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(180deg,#A5ABB8,#858994); color: #fff; font-size: 17px; font-weight: 600; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.track { height: 6px; background: var(--fill); border-radius: 3px; overflow: hidden; } .track i { display: block; height: 100%; border-radius: 3px; background: var(--blue); }
.notice { display: flex; align-items: center; margin: 0 16px 16px; padding: 12px 14px; border-radius: 10px; background: var(--card); font-size: 15px; }
.notice .act { margin-left: auto; color: var(--blue); font-weight: 600; }
.search { display: flex; align-items: center; height: 36px; background: var(--fill); border-radius: 10px; padding: 0 8px; font-size: 17px; color: var(--label2); }
.search i { width: 18px; height: 18px; margin-right: 5px; display: block; }
.badge { min-width: 18px; height: 18px; line-height: 18px; border-radius: 9px; background: var(--red); color: #fff; font-size: 12px; font-weight: 600; text-align: center; padding: 0 5px; }
.legend div { display: flex; align-items: center; margin-top: 4px; } .legend .ld { width: 7px; height: 7px; border-radius: 50%; margin-right: 6px; } .legend span + span { margin-left: 6px; }
.w2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: -12px 16px 28px; }
.cal { } .calendar { width: 40px; height: 42px; border-radius: 8px; background: var(--card); overflow: hidden; box-shadow: 0 0 0 .5px var(--sep), 0 1px 3px rgba(0,0,0,.06); text-align: center; flex-shrink: 0; margin-right: 12px; }
.calendar .top { height: 12px; line-height: 12px; font-size: 8px; font-weight: 700; color: #fff; } .calendar .n { font-size: 20px; font-weight: 600; line-height: 29px; }
.rank { display: inline-flex; min-width: 18px; height: 18px; border-radius: 9px; background: var(--fill); color: var(--label2); font-size: 11px; font-weight: 600; align-items: center; justify-content: center; margin-right: 6px; padding: 0 4px; }
.why { display: flex; margin-top: 8px; padding: 7px 9px; border-radius: 7px; background: rgba(255,149,0,.12); color: #C77700; font-size: 13px; line-height: 1.4; }
.dark .why { color: #FFB340; }
.why .ic { width: 15px; height: 15px; border-radius: 50%; background: #FF9500; margin: 1px 5px 0 0; flex-shrink: 0; display: flex; } .why .ic i { width: 15px; height: 15px; display: block; }
.btn-sm { height: 30px; border-radius: 15px; font-size: 15px; font-weight: 600; display: flex; align-items: center; justify-content: center; }
.swipe { position: relative; overflow: hidden; } .swipe .inner { transform: translateX(-148px); background: var(--card); } .swipe .acts { position: absolute; right: 0; top: 0; bottom: 0; display: flex; } .swipe .acts div { width: 74px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 15px; font-weight: 600; }
.kv { align-items: flex-start; } .kv .k { width: 90px; flex-shrink: 0; font-size: 15px; color: var(--label2); padding-top: 1px; } .kv .v { flex: 1; font-size: 16px; line-height: 1.4; }
.tagf { display: inline-block; font-size: 13px; background: var(--fill); border-radius: 5px; padding: 2px 7px; margin: 0 5px 5px 0; }
.stepper { display: flex; align-items: center; height: 32px; background: var(--fill); border-radius: 8px; } .stepper span { width: 46px; text-align: center; font-size: 20px; } .stepper i { width: .5px; height: 18px; background: var(--sep); display: block; }
.switch { width: 51px; height: 31px; border-radius: 16px; background: var(--green); position: relative; flex-shrink: 0; } .switch::after { content: ''; position: absolute; right: 2px; top: 2px; width: 27px; height: 27px; border-radius: 50%; background: #fff; box-shadow: 0 3px 8px rgba(0,0,0,.15); }
.switch.off { background: rgba(120,120,128,.16); } .switch.off::after { right: auto; left: 2px; }
.slider { flex: 1; height: 4px; border-radius: 2px; background: #E5E5EA; position: relative; margin: 0 10px; } .dark .slider { background: #3A3A3C; }
.slider i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 2px; } .slider b { position: absolute; top: -12px; width: 28px; height: 28px; margin-left: -14px; border-radius: 50%; background: #fff; box-shadow: 0 3px 8px rgba(0,0,0,.15), 0 0 0 .5px rgba(0,0,0,.04); }
.wx { background: #fff; padding: 18px 18px 24px; }
`;

// ---------- 基础部件 ----------
const tileHtml = (glyph, color, cls = '') => `<div class="tile ${cls}" style="background:${color}"><i>${line(GLYPH[glyph], '#FFFFFF', 2)}</i></div>`;
const statusBar = () => `<div class="sb"><span class="num">9:41</span><span class="ic"><svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg><svg width="16" height="12" viewBox="0 0 16 12" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M1.2 4.2a9.6 9.6 0 0 1 13.6 0M3.6 6.9a6.2 6.2 0 0 1 8.8 0"/><circle cx="8" cy="10" r="1.1" fill="currentColor" stroke="none"/></svg><span class="bat"><i></i></span></span></div>`;
const capsule = '<div class="capsule"><span><svg width="18" height="4" viewBox="0 0 18 4" fill="currentColor"><circle cx="2" cy="2" r="1.8"/><circle cx="9" cy="2" r="2.2"/><circle cx="16" cy="2" r="1.8"/></svg></span><span class="d"></span><span><span class="rec"></span></span></div>';
const backSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4.5 7.5 12l7.5 7.5"/></svg>';
const tabbar = (on, dark) => `<div class="tabbar">${[['home', '工作台'], ['issues', '期刊'], ['review', '复核'], ['members', '委员']]
  .map(([k, n]) => `<div class="t ${on === k ? 'on' : ''}"><div class="ti">${on === k ? solid(TAB[k].fill, dark ? '#0A84FF' : '#007AFF', 1.7) : line(TAB[k].outline, '#8E8E93', 1.7)}</div>${n}</div>`).join('')}</div>`;
const cat = (k) => `<span class="cap2" style="color:${CAT[k][1]};background:${rgba(CAT[k][1], 0.15)}"><span class="dt" style="background:${CAT[k][1]}"></span>${CAT[k][0]}</span>`;
const pill = (t, c) => `<span class="cap2" style="color:${c};background:${rgba(c, 0.15)}">${t}</span>`;
const gh = (t, r = '') => `<div class="gh"><span>${t}</span>${r ? `<span>${r}</span>` : ''}</div>`;

/** opts: dark, title (标准导航) | lt (大标题导航内容在 body 内), tab, toolbar */
function phone({ dark = false, title = null, back = true, tab = null, toolbar = null, body, ltnav = false }) {
  return `<div class="phone ${dark ? 'dark' : ''}"><div class="island"></div>${statusBar()}
  ${title !== null ? `<div class="navbg"></div><div class="nav">${back ? `<span class="back">${backSvg}</span>` : ''}${title}${capsule}</div>` : `<div class="nav">${capsule}</div>`}
  <div class="content ${ltnav ? 'ltnav' : ''} ${tab ? 'tab' : ''}">${body}</div>
  ${tab ? tabbar(tab, dark) : ''}${toolbar ? `<div class="toolbar">${toolbar}</div>` : ''}<div class="home"></div></div>`;
}

const rings = (vals, size = 118) => {
  const colors = ['#FF2D55', '#34C759', '#00C7BE']; const lw = size * 0.11; const gap = lw * 0.18;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${vals.map((v, i) => {
    const r = size / 2 - lw / 2 - i * (lw + gap); const c = 2 * Math.PI * r;
    return `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${colors[i]}" stroke-opacity=".2" stroke-width="${lw}"/>`
      + `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${colors[i]}" stroke-width="${lw}" stroke-linecap="round" stroke-dasharray="${c * v / 100} ${c}" transform="rotate(-90 ${size / 2} ${size / 2})"/>`;
  }).join('')}</svg>`;
};

// ---------- 页面 ----------
const S = [];

const homeBody = () => `
<div class="lt"><div class="lt-date">11月10日 星期二</div><div class="lt-title"><span>工作台</span><div class="mono" style="width:32px;height:32px;font-size:14px">秘</div></div></div>
<div class="group" style="margin-top:8px"><div class="card" style="padding:14px 16px 16px">
  <div class="wh">${tileHtml('weekly', '#007AFF', 'sm')}<span class="tint">本期周报</span><span class="flex1"></span>${pill('待复核', '#FF9500')}</div>
  <div class="row" style="margin-top:12px"><div class="flex1">
    <div class="title1 num">第 45 期</div><div class="subhead secondary" style="margin-top:2px">11.02 — 11.08</div>
    <div class="legend" style="margin-top:12px"><div><span class="ld" style="background:#FF2D55"></span><span class="footnote secondary">采集</span><span class="footnote semi num">471/471</span></div>
      <div><span class="ld" style="background:#34C759"></span><span class="footnote secondary">入选</span><span class="footnote semi num">42 条</span></div>
      <div><span class="ld" style="background:#00C7BE"></span><span class="footnote secondary">复核</span><span class="footnote semi num">剩 5 条</span></div></div>
  </div>${rings([100, 84, 88])}</div></div></div>
<div class="w2">
  ${[['review', '#FF9500', '待复核', '5', '条', '人物待确认'], ['person', '#007AFF', '在任委员', '401', '位', '委员名录与画像'], ['monthly', '#5856D6', '本月月报', '48', '条', '10月 · 已发布'], ['review', '#34C759', '已发布', '44', '期', '周报与月报']]
    .map(([g, c, t, v, u, f]) => `<div class="card" style="padding:12px 14px 14px"><div class="wh">${tileHtml(g, c, 'sm')}<span style="color:${c}">${t}</span><span class="flex1"></span><span class="chev"></span></div>
    <div class="metric" style="margin-top:12px">${v}<small>${u}</small></div><div class="footnote secondary" style="margin-top:2px">${f}</div></div>`).join('')}
</div>
${gh('快捷操作')}
<div class="group"><div class="list icons">
  ${[['weekly', '#007AFF', '新建周报'], ['monthly', '#5856D6', '新建月报'], ['roster', '#34C759', '名单变更'], ['settings', '#8E8E93', '系统设置']]
    .map(([g, c, t]) => `<div class="cell">${tileHtml(g, c)}<span class="flex1">${t}</span><span class="chev"></span></div>`).join('')}
</div></div>`;
S.push({ id: '01-home', name: '工作台', desc: '大标题 · Fitness 三环 · 小组件', html: phone({ ltnav: true, tab: 'home', body: homeBody() }) });

const issues = [['W', 45, '待复核', '#FF9500', '11.02 — 11.08', 42], ['W', 44, '已发布', '#34C759', '10.26 — 11.01', 38], ['M', 10, '已发布', '#34C759', '10.01 — 10.31', 48],
  ['W', 43, '已发布', '#34C759', '10.19 — 10.25', 35], ['W', 42, '已发布', '#34C759', '10.12 — 10.18', 41], ['W', 41, '已发布', '#34C759', '10.05 — 10.11', 31], ['M', 9, '已发布', '#34C759', '09.01 — 09.30', 50]];
S.push({ id: '02-issues', name: '期刊', desc: '分段控件 · 日历式期号', html: phone({ ltnav: true, tab: 'issues', body: `
<div class="lt"><div class="lt-title">期刊</div><div class="seg" style="margin-top:10px"><div class="on">全部</div><div>周报</div><div>月报</div></div></div>
<div style="margin-top:12px">${gh('2026 年')}<div class="group"><div class="list cal">
${issues.map(([k, n, s, c, r, a]) => `<div class="cell"><div class="calendar"><div class="top" style="background:${k === 'W' ? '#FF3B30' : '#5856D6'}">${k === 'W' ? `第${n}期` : `${n}月`}</div><div class="n num">${n}</div></div>
  <div class="flex1"><div class="headline">委员学术动态${k === 'W' ? '周报' : '月报'}</div><div class="subhead secondary num" style="margin-top:2px">${r} · 入选 ${a} 条</div></div>${pill(s, c)}<span class="chev"></span></div>`).join('')}
</div></div></div>` }) });

const art = (rank, k, site, h, b, ms, warn) => `<div class="cell" style="align-items:flex-start;padding:13px 16px 14px"><div class="flex1">
  <div class="caption secondary row"><span class="rank num">${rank}</span><span class="semi" style="color:${CAT[k][1]}">${CAT[k][0]}</span><span style="margin-left:4px">· ${site}</span></div>
  <div class="headline clamp2" style="margin-top:4px">${h}</div><div class="subhead secondary clamp2" style="margin-top:4px">${b}</div>
  <div class="row" style="margin-top:6px">${ms.map((m) => `<span class="footnote tint" style="margin-right:8px">${m}</span>`).join('')}${warn ? pill('待确认', '#FF9500') : ''}</div></div><span class="chev" style="margin-top:28px"></span></div>`;
S.push({ id: '03-issue', name: '稿件', desc: '阅读式排版 · 半透明工具栏', html: phone({ title: '稿件', toolbar: '<div class="btn gray">复核</div><div class="btn gray">导出</div><div class="btn filled">定稿发布</div>', body: `
<div style="padding:8px 16px 0"><div class="seg"><div class="on">稿件</div><div>公众号预览</div></div></div>
<div class="notice" style="margin-top:12px">${tileHtml('swap', '#FF9500')}<div class="flex1"><div class="semi">复核结论已更新</div><div class="footnote secondary">重新编排后生效</div></div><span class="act">重新编排</span></div>
<div style="padding:4px 24px 16px"><div style="color:#FF3B30;font-size:13px;font-weight:700">周报 · 第 45 期</div>
  <div class="title1" style="margin-top:4px">SMP 委员动态周报 | 2026年第45期</div><div class="row" style="margin-top:8px">${pill('待复核', '#FF9500')}<span class="footnote secondary" style="margin-left:8px">11.02 — 11.08 · 共 42 条</span></div></div>
<div class="group" style="margin-bottom:22px"><div class="card"><div class="headline">编者按</div><div class="callout secondary" style="margin-top:6px;line-height:1.5">本期收录 42 条：两位委员当选 IEEE Fellow，三篇论文获国际会议最佳论文奖，第十五届全国社会媒体处理大会顺利召开。</div></div></div>
<div class="gh"><span class="big">学术荣誉</span><span>9 条</span></div>
<div class="group"><div class="list">
${art(2, 'honor', '复旦大学新闻网 · 11月3日', '林知远当选 IEEE Fellow', '复旦大学林知远教授当选 IEEE Fellow，表彰其在社会网络分析领域的学术贡献。', ['林知远'], true)}
${art(3, 'honor', '新华网 · 11月8日', '温如初团队论文获 EMNLP 2026 最佳论文奖', '西安交通大学温如初教授团队关于大语言模型对齐的论文获最佳论文奖。', ['温如初'], false)}
</div></div>` }) });

const rv = (k, score, h, people, conf, n, why, needs) => `<div class="cell" style="flex-direction:column;align-items:stretch;padding:13px 16px 14px">
  <div class="between">${cat(k)}<span class="footnote secondary num">${score} 分</span></div>
  <div class="headline" style="margin-top:6px">${h}</div>
  <div class="row wrap" style="margin-top:6px">${people.map(([nm, org]) => `<span class="row" style="margin:0 12px 4px 0"><span class="mono" style="width:22px;height:22px;font-size:11px;margin-right:5px">${nm[0]}</span><span class="subhead">${nm}</span><span class="footnote secondary" style="margin-left:4px">${org}</span></span>`).join('')}</div>
  <div class="row" style="margin-top:6px"><div class="track" style="width:60px"><i style="width:${conf}%;background:${conf >= 60 ? 'var(--green)' : 'var(--orange)'}"></i></div><span class="footnote secondary" style="margin-left:6px">人物置信 ${conf}% · ${n} 家报道</span></div>
  ${why ? `<div class="why"><span class="ic"><i>${line(GLYPH.info, '#fff', 2.2)}</i></span>${why}</div>` : ''}
  ${needs ? '<div class="row" style="margin-top:10px;gap:8px"><div class="btn-sm gray flex1">认错人</div><div class="btn-sm flex1" style="background:rgba(52,199,89,.15);color:#248A3D">人物无误</div></div>' : ''}</div>`;
const reviewBody = () => `
<div class="lt"><div class="lt-title"><span>复核</span><span class="row" style="font-size:15px;font-weight:600;color:var(--blue);background:var(--fill);border-radius:15px;height:30px;padding:0 11px;letter-spacing:0">周报 第 45 期<span style="width:6px;height:6px;border-right:2px solid var(--blue);border-bottom:2px solid var(--blue);transform:rotate(45deg);margin:-4px 0 0 7px"></span></span></div>
<div class="seg" style="margin-top:10px"><div class="on">待复核 5</div><div>入选 42</div><div>候选 144</div><div>已过滤 63</div></div></div>
<div style="margin-top:12px"><div class="footnote secondary" style="padding:0 32px 7px">向左轻扫可保留或剔除</div><div class="group"><div class="list">
${rv('honor', '79.6', '林知远当选 IEEE Fellow', [['林知远', '复旦大学'], ['林知远', '浙江大学']], 55, 2, '名单内同名（复旦大学 / 浙江大学），报道未出现单位', true)}
<div class="swipe" style="border-top:.5px solid var(--sep)"><div class="inner">${rv('activity', '52.4', '陆鸣谦教授应邀在 CCL 2026 作主旨报告', [['陆鸣谦', '东南大学']], 58, 1, '', false)}</div><div class="acts"><div style="background:#007AFF">保留</div><div style="background:#FF3B30">剔除</div></div></div>
</div></div></div>`;
S.push({ id: '04-review', name: '复核', desc: '分段筛选 · 左滑操作 · 置信度', html: phone({ ltnav: true, tab: 'review', body: reviewBody() }) });

S.push({ id: '05-event', name: '动态详情', desc: '分组表单 · 评分拆解 · 证据', html: phone({ title: '动态详情', toolbar: '<div class="btn gray" style="color:var(--red)">剔除</div><div class="btn filled">保存</div>', body: `
<div style="padding-top:12px">${gh('成稿')}
<div class="group" style="margin-bottom:22px"><div class="list">
  <div class="cell" style="flex-direction:column;align-items:stretch"><span class="caption secondary">标题</span><span class="headline" style="margin-top:3px">温如初团队论文获 EMNLP 2026 最佳论文奖</span></div>
  <div class="cell" style="flex-direction:column;align-items:stretch"><span class="caption secondary">摘要</span><span style="margin-top:3px;line-height:1.4">西安交通大学温如初教授团队关于大语言模型对齐的论文，在 EMNLP 2026 上荣获最佳论文奖。</span></div>
  <div class="cell"><span class="flex1">栏目</span>${cat('honor')}<span class="chev"></span></div></div></div>
${gh('重要性评分', '<span class="num">78.3 分</span>')}
<div class="group" style="margin-bottom:22px"><div class="list">${[['栏目', 1], ['级别', 1], ['信源权威', 0.95], ['报道覆盖', 0.77], ['领域相关', 0.67]]
  .map(([k, v]) => `<div class="cell"><span class="subhead" style="width:70px">${k}</span><div class="track flex1"><i style="width:${v * 100}%"></i></div><span class="subhead secondary num" style="width:38px;text-align:right">${v.toFixed(2)}</span></div>`).join('')}</div></div>
${gh('人物识别')}
<div class="group"><div class="list"><div class="cell" style="flex-direction:column;align-items:stretch"><div class="row"><div class="mono">温</div><div class="flex1" style="margin-left:12px"><div>温如初</div><div class="subhead secondary">西安交通大学</div></div>${pill('已确认 95%', '#34C759')}<span class="chev"></span></div>
<div class="row wrap" style="margin:8px 0 0 52px">${['单位邻近:西安交通大学', '学术语境', '查询来源', '标题提及'].map((e) => `<span class="tagf secondary">${e}</span>`).join('')}</div></div></div></div></div>` }) });

const people = [['C', [['程', '程思远', '北京师范大学 · 常务委员']]], ['F', [['方', '方以宁', '大连理工大学 · 委员']]], ['H', [['韩', '韩照临', '中山大学 · 委员']]],
  ['L', [['林', '林知远', '浙江大学 · 副主任', 1], ['林', '林知远', '复旦大学 · 常务委员', 1], ['陆', '陆鸣谦', '东南大学 · 委员']]], ['M', [['孟', '孟书禾', '苏州大学 · 委员']]]];
S.push({ id: '06-members', name: '委员名录', desc: '通讯录式 A–Z 分组与索引', html: phone({ ltnav: true, tab: 'members', body: `
<div class="lt" style="padding-bottom:10px"><div class="lt-title"><span>委员</span><span style="font-size:17px;font-weight:400;color:var(--blue);letter-spacing:0">名单变更</span></div>
<div class="search" style="margin-top:8px"><i>${line(GLYPH.search, '#8E8E93', 2.2)}</i>姓名、单位或研究方向</div>
<div style="margin-top:10px;white-space:nowrap;overflow:hidden"><span class="chip on">全部</span><span class="chip">指导委员会</span><span class="chip">主任</span><span class="chip">副主任</span><span class="chip">常务委员</span></div></div>
<div style="background:var(--card);height:100%">
<div class="row" style="padding:14px 16px;border-bottom:.5px solid var(--sep)"><div class="mono" style="width:60px;height:60px;font-size:18px;background:linear-gradient(180deg,#4F8EF7,#1D5FD6)">SMP</div><div style="margin-left:12px"><div class="title3">社会媒体处理专委会</div><div class="subhead secondary">401 位在任委员</div></div></div>
${people.map(([k, ms]) => `<div style="padding:4px 16px;font-size:15px;font-weight:600;color:var(--label2)">${k}</div>${ms.map(([c, n, s, h]) => `<div class="row" style="padding:0 28px 0 16px;height:60px"><div class="mono">${c}</div>
  <div class="flex1" style="margin-left:12px;height:60px;display:flex;flex-direction:column;justify-content:center;border-bottom:.5px solid var(--sep)"><div class="row"><span class="semi">${n}</span>${h ? `<span style="margin-left:6px">${pill('同名', '#FF9500')}</span>` : ''}</div><div class="subhead secondary">${s}</div></div></div>`).join('')}`).join('')}
</div>
<div style="position:absolute;right:3px;top:250px;display:flex;flex-direction:column;align-items:center;font-size:11px;font-weight:600;color:var(--blue);line-height:1.3">${'ABCDEFGHJKLMNPQRSTWXYZ#'.split('').map((c) => `<span>${c}</span>`).join('')}</div>` }) });

const memberBody = () => `
<div style="display:flex;flex-direction:column;align-items:center;padding:6px 24px 16px;text-align:center">
  <div class="mono" style="width:100px;height:100px;font-size:42px">程</div><div class="title1" style="margin-top:12px">程思远</div><div class="subhead secondary" style="margin-top:2px">北京师范大学</div>
  <div class="row" style="margin-top:8px;gap:6px">${pill('常务委员', '#007AFF')}${pill('已核验', '#34C759')}</div></div>
<div class="row" style="margin:0 16px 16px;gap:8px">${[['pencil', '编辑'], ['sparkles', 'AI 补全'], ['link', '主页'], ['copy', '复制']]
  .map(([g, t]) => `<div style="flex:1;height:58px;background:var(--card);border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--blue);font-size:12px"><i style="width:22px;height:22px;display:block;margin-bottom:3px">${line(GLYPH[g], '#007AFF', 2)}</i>${t}</div>`).join('')}</div>
<div class="group" style="margin-bottom:22px"><div class="list row" style="padding:12px 0">${[['7', '', '已发布动态'], ['92', '%', '画像完整度'], ['1', '', '任职单位']]
  .map(([v, u, k], i) => `<div style="flex:1;text-align:center;${i ? 'border-left:.5px solid var(--sep)' : ''}"><div class="metric" style="font-size:24px">${v}<small>${u}</small></div><div class="caption secondary">${k}</div></div>`).join('')}</div></div>
${gh('学术画像')}
<div class="group"><div class="list">
  <div class="cell kv"><span class="k">职称 / 职务</span><span class="v">教授、博士生导师</span></div>
  <div class="cell kv"><span class="k">研究方向</span><span class="v">${['计算传播学', '社交媒体分析', '舆论动力学'].map((t) => `<span class="tagf">${t}</span>`).join('')}</span></div>
  <div class="cell kv"><span class="k">个人主页</span><span class="v tint ellipsis">example.edu.cn/~chengsy</span></div></div></div>`;
S.push({ id: '07-member', name: '委员画像', desc: '通讯录名片 · 快捷操作 · 分组信息', html: phone({ title: '', body: memberBody() }) });

S.push({ id: '08-roster', name: '名单变更', desc: '粘贴名单 · 变更预览', html: phone({ title: '名单变更', toolbar: '<div class="btn tinted">预览变更</div><div class="btn filled">确认导入</div>', body: `
<div style="padding-top:12px">${gh('名单文本')}
<div class="group" style="margin-bottom:22px"><div class="list icons">
  <div class="cell" style="height:110px;align-items:flex-start;font-size:15px;line-height:1.5;color:var(--label2);white-space:pre">主任\n甄学文 清华大学\n副主任\n林知远 浙江大学 …</div>
  <div class="cell">${tileHtml('copy', '#007AFF')}<span class="flex1 tint">从剪贴板粘贴</span><span class="value num">812 行</span></div></div></div>
<div class="group" style="margin-bottom:22px"><div class="list">
  <div class="cell"><span class="flex1">生效日期</span><span class="value num">2027-01-01</span><span class="chev"></span></div>
  <div class="cell"><span class="flex1">来源说明</span><span class="value">第十届换届名单</span></div></div></div>
${gh('变更预览', '共解析 412 人')}
<div class="group" style="margin-bottom:12px"><div class="list row" style="padding:12px 0">${[['12', '新增', '#34C759'], ['1', '离任', '#FF3B30'], ['6', '身份', '#007AFF'], ['2', '单位', '#FF9500'], ['391', '未变', 'var(--label)']]
  .map(([v, k, c]) => `<div style="flex:1;text-align:center"><div class="metric" style="font-size:24px;color:${c}">${v}</div><div class="caption secondary">${k}</div></div>`).join('')}</div></div>
<div class="group"><div class="list icons">
  ${[['plus', '#34C759', '钟予安', '上海交通大学 · 委员', '新增'], ['swap', '#007AFF', '程思远', '委员 → 常务委员', '身份变化'], ['building', '#FF9500', '裴语冰', '华南理工大学 → 深圳大学', '单位变化']]
    .map(([g, c, n, d, t]) => `<div class="cell">${tileHtml(g, c, 'round rnd')}<div class="flex1"><div>${n}</div><div class="subhead secondary">${d}</div></div><span class="footnote secondary">${t}</span></div>`).join('')}
</div></div></div>` }) });

const sl = (k, v, c) => `<div class="cell"><span class="subhead" style="width:62px">${k}</span><div class="slider"><i style="width:${v * 2}%;background:${c}"></i><b style="left:${v * 2}%"></b></div><span class="subhead secondary num" style="width:36px;text-align:right">${v}%</span></div>`;
S.push({ id: '09-settings', name: '设置', desc: 'iOS 设置式分组 · 开关 · 步进器 · 滑块', html: phone({ title: '设置', body: `
<div style="padding-top:12px">${gh('DeepSeek 开放搜索')}
<div class="group" style="margin-bottom:6px"><div class="list icons">
  <div class="cell">${tileHtml('key', '#8E8E93')}<span class="flex1">API Key</span><span style="color:var(--green)">已配置</span></div>
  <div class="cell">${tileHtml('search', '#007AFF')}<span class="flex1">Search 接口</span><span class="value footnote">/v1/tools/search</span></div>
  <div class="cell">${tileHtml('tray', '#5856D6')}<span class="flex1">返回条数</span><div class="stepper"><span>−</span><i></i><span>+</span></div><span class="value num" style="width:28px;text-align:right">20</span></div>
  <div class="cell">${tileHtml('link', '#34C759')}<span class="flex1">回查正文</span><div class="switch off"></div></div></div>
<div class="gf">API Key 保存在云函数环境变量中，小程序端不可见。</div></div>
<div style="height:20px"></div>
${gh('周报选稿')}
<div class="group" style="margin-bottom:22px"><div class="list">${[['最少条数', 30], ['最多条数', 50], ['入选分数线', 25]].map(([k, v]) => `<div class="cell"><span class="flex1">${k}</span><span class="value num">${v}</span></div>`).join('')}
  <div class="cell"><span class="flex1">只收录学术动态</span><div class="switch"></div></div></div></div>
${gh('重要性权重', '<span class="num">合计 100%</span>')}
<div class="group"><div class="list">${sl('栏目', 25, 'var(--blue)')}${sl('级别', 20, 'var(--blue)')}${sl('信源权威', 15, 'var(--blue)')}</div></div></div>` }) });

const wxIssue = {
  title: 'SMP 委员动态周报 | 2026年第45期（11.02—11.08）', period: { kind: 'weekly', start: '2026-11-02', end: '2026-11-08' }, count: 42,
  editorNote: '本期收录委员学术动态 42 条：两位委员当选 IEEE Fellow，三篇论文获国际会议最佳论文奖，第十五届全国社会媒体处理大会顺利召开。',
  sections: [
    { key: 'org', name: '专委会动态', events: [{ rank: 1, headline: 'SMP 2026 第十五届全国社会媒体处理大会召开', blurb: '大会设置特邀报告、技术评测与青年学者论坛，甄学文教授出席并致辞。', url: 'https://example.org/1', site: '中国中文信息学会', date: '11月4日', members: [], nSources: 1 }] },
    { key: 'honor', name: '学术荣誉', events: [
      { rank: 2, headline: '林知远当选 IEEE Fellow', blurb: '复旦大学林知远教授当选 IEEE Fellow，表彰其在社会网络分析领域的学术贡献。', url: 'https://example.org/2', site: '复旦大学新闻网', date: '11月3日', members: [{ name: '林知远', org: '复旦大学' }], nSources: 2 },
      { rank: 3, headline: '温如初团队论文获 EMNLP 2026 最佳论文奖', blurb: '西安交通大学温如初教授团队关于大语言模型对齐的论文获最佳论文奖。', url: 'https://example.org/3', site: '新华网', date: '11月8日', members: [{ name: '温如初', org: '西安交通大学' }], nSources: 3 }] },
  ],
};
S.push({ id: '10-wechat', name: '公众号成稿', desc: '导出的内联样式 HTML', html: phone({ title: 'SMP 社会媒体处理', body: `<div class="wx">${renderWechatHtml(wxIssue)}</div>` }) });

S.push({ id: '11-home-dark', name: '工作台 · 深色', desc: '深色模式自动适配', html: phone({ dark: true, ltnav: true, tab: 'home', body: homeBody() }) });
S.push({ id: '12-review-dark', name: '复核 · 深色', desc: '深色模式自动适配', html: phone({ dark: true, ltnav: true, tab: 'review', body: reviewBody() }) });

const palette = [['System Blue', '#007AFF'], ['Green', '#34C759'], ['Orange', '#FF9500'], ['Red', '#FF3B30'], ['Indigo', '#5856D6'], ['Teal', '#30B0C7'], ['Grouped BG', '#F2F2F7'], ['Label', '#000000']];
const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>SMP 学术动态 · Apple 风格页面设计</title><style>${css}</style></head><body>
<div class="board" id="board"><div class="bh"><div><div class="k">SMP 学术动态 · 小程序界面设计</div><h1>Apple 风格：清爽、克制、精致</h1>
<p>参照 Apple Human Interface Guidelines：系统字体与字号阶梯 · 系统色 · 大标题导航 · 圆角分组列表 · 彩色图标方块 · 深色模式　｜　示例人物与动态均为虚构</p></div>
<div class="pal">${palette.map(([n, c]) => `<div><i style="background:${c}"></i>${n}<br>${c}</div>`).join('')}</div></div>
<div class="grid">${S.map((s) => `<div><div id="s-${s.id}" style="padding:14px">${s.html}</div><div class="cap"><b>${s.name}</b><span>${s.desc}</span></div></div>`).join('')}</div></div></body></html>`;

module.exports = { html, screens: S };
if (require.main === module) {
  require('fs').writeFileSync(require('path').join(__dirname, 'mockups.html'), html);
  console.log('design/mockups.html written');
}
