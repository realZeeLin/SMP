/**
 * 页面风格图（设计稿）生成：与小程序 app.wxss 使用同一套设计规范（rpx ÷ 2 = px，375 宽）。
 * 输出 design/mockups.html（可直接浏览器打开）；design/render.js 负责截图为 PNG。
 * 示例数据均为虚构人物与虚构动态，仅用于展示版式。
 */
const { PATHS, svg } = require('./icon-paths');
const { renderWechatHtml } = require('../cloudfunctions/smp/lib/compose');

const C = { ink: '#1B2B48', accent: '#2F5D8C', gold: '#A8834A', goldSoft: '#F5EEDF', text: '#2B2F36', sub: '#6B717A', muted: '#9AA0A9', line: '#ECEAE4', paper: '#F7F6F2', green: '#2F7A5B', red: '#B0524A' };
const CAT = {
  org: ['专委会动态', '#1B2B48', '#E8ECF3'], honor: ['学术荣誉', '#9A7438', '#F5EEDF'], research: ['学术成果', '#2F6F62', '#E3F0EC'],
  project: ['科研项目', '#5E4E8C', '#ECE8F4'], activity: ['学术活动', '#2F5D8C', '#E4EDF6'], service: ['学术任职', '#7A5B3A', '#F1EAE2'],
  influence: ['学术影响力', '#A04F48', '#F6E7E5'],
};

const css = `
@font-face { font-family: Serif; src: local('Noto Serif CJK SC'); }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #E9E7E1; font-family: 'Noto Sans CJK SC', 'PingFang SC', sans-serif; color: ${C.text}; -webkit-font-smoothing: antialiased; }
.serif { font-family: 'Noto Serif CJK SC', 'Songti SC', serif; }
.num { font-variant-numeric: tabular-nums; font-family: 'Helvetica Neue', 'Noto Sans CJK SC', sans-serif; }
.board { padding: 56px 64px 64px; }
.board-head { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 40px; }
.board-head .eyebrow { font-size: 12px; letter-spacing: 6px; color: ${C.gold}; }
.board-head h1 { font-family: 'Noto Serif CJK SC', serif; font-size: 34px; color: ${C.ink}; margin-top: 8px; letter-spacing: 2px; }
.board-head p { color: ${C.sub}; font-size: 14px; margin-top: 6px; }
.palette { display: flex; gap: 14px; }
.sw { text-align: center; font-size: 11px; color: ${C.sub}; }
.sw i { display: block; width: 44px; height: 44px; border-radius: 10px; margin-bottom: 6px; border: 1px solid rgba(0,0,0,.06); }
.grid { display: grid; grid-template-columns: repeat(5, 375px); gap: 48px 40px; }
.cap { margin-top: 14px; text-align: center; }
.cap b { font-family: 'Noto Serif CJK SC', serif; color: ${C.ink}; font-size: 16px; }
.cap span { display: block; color: ${C.muted}; font-size: 12px; margin-top: 2px; }

.phone { width: 375px; height: 812px; background: ${C.paper}; border-radius: 44px; overflow: hidden; position: relative;
  box-shadow: 0 30px 60px rgba(27,43,72,.18), 0 0 0 10px #111, 0 0 0 11px #333; font-size: 14px; line-height: 1.6; letter-spacing: .25px; }
.status { height: 44px; display: flex; align-items: center; justify-content: space-between; padding: 0 28px 0 32px; font-size: 15px; font-weight: 600; }
.status .ic { display: flex; gap: 6px; align-items: center; }
.bat { width: 24px; height: 11px; border: 1.2px solid currentColor; border-radius: 3px; position: relative; padding: 1px; }
.bat i { display: block; height: 100%; width: 80%; background: currentColor; border-radius: 1px; }
.navbar { height: 44px; display: flex; align-items: center; justify-content: center; position: relative; font-size: 17px; font-weight: 600; color: #111; }
.navbar .back { position: absolute; left: 14px; font-size: 22px; font-weight: 300; }
.capsule { position: absolute; right: 7px; top: 6px; width: 87px; height: 32px; border-radius: 16px; border: 1px solid rgba(0,0,0,.12); background: rgba(255,255,255,.6);
  display: flex; align-items: center; justify-content: space-between; font-size: 14px; }
.capsule::after { content: ''; position: absolute; left: 43px; top: 8px; width: 1px; height: 16px; background: rgba(0,0,0,.12); }
.capsule .dots { width: 43px; display: flex; justify-content: center; } .capsule .rec { margin: 0 12px; } .capsule .rec { width: 16px; height: 16px; border-radius: 50%; border: 2px solid #111; position: relative; }
.capsule .rec::after { content: ''; position: absolute; left: 3px; top: 3px; width: 6px; height: 6px; border-radius: 50%; background: #111; }
.dark .status, .dark .navbar { color: #fff; } .dark .capsule { border-color: rgba(255,255,255,.3); background: rgba(0,0,0,.15); color: #fff; }
.dark .capsule .rec { border-color: #fff; } .dark .capsule .rec::after { background: #fff; } .dark .capsule::after { background: rgba(255,255,255,.3); }
.content { position: absolute; top: 88px; left: 0; right: 0; bottom: 0; overflow: hidden; }
.content.tabbed { bottom: 84px; } .content.bar { bottom: 76px; } .content.full { top: 44px; }
.tabbar { position: absolute; left: 0; right: 0; bottom: 0; height: 84px; background: #fff; border-top: .5px solid #E6E6E6; display: flex; padding-top: 6px; }
.tab { flex: 1; display: flex; flex-direction: column; align-items: center; font-size: 10px; color: #9AA0A9; }
.tab .ti { width: 26px; height: 26px; margin-bottom: 2px; } .tab.on { color: ${C.ink}; font-weight: 600; }
.home-ind { position: absolute; bottom: 8px; left: 50%; margin-left: -67px; width: 134px; height: 5px; border-radius: 3px; background: #111; z-index: 20; }
.actionbar { position: absolute; left: 0; right: 0; bottom: 0; height: 76px; background: rgba(255,255,255,.97); border-top: .5px solid ${C.line}; display: flex; gap: 10px; padding: 10px 16px 24px; z-index: 5; }
.actionbar .btn { flex: 1; }

.c { padding: 12px 16px 24px; }
.row { display: flex; align-items: center; } .between { display: flex; align-items: center; justify-content: space-between; } .flex1 { flex: 1; min-width: 0; } .wrap { flex-wrap: wrap; }
.eyebrow { font-size: 10px; letter-spacing: 3px; color: ${C.gold}; }
.h1 { font-family: 'Noto Serif CJK SC', serif; font-size: 22px; font-weight: 700; color: ${C.ink}; letter-spacing: 1px; line-height: 1.35; }
.h2 { font-family: 'Noto Serif CJK SC', serif; font-size: 17px; font-weight: 700; color: ${C.ink}; line-height: 1.4; }
.h3 { font-size: 15px; font-weight: 600; color: ${C.ink}; }
.sub { color: ${C.sub}; font-size: 12px; } .muted { color: ${C.muted}; font-size: 11px; }
.ellipsis { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.clamp2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.card { background: #fff; border-radius: 8px; border: .5px solid ${C.line}; padding: 16px; margin-bottom: 12px; box-shadow: 0 2px 12px rgba(27,43,72,.04); }
.card-flat { background: #fff; border-radius: 8px; border: .5px solid ${C.line}; margin-bottom: 12px; }
.hairline { height: .5px; background: ${C.line}; margin: 12px 0; }
.st { display: flex; align-items: baseline; margin: 20px 0 10px; }
.st .no { font-family: 'Noto Serif CJK SC', serif; color: ${C.gold}; font-size: 14px; margin-right: 8px; font-weight: 700; }
.st .t { font-family: 'Noto Serif CJK SC', serif; font-size: 16px; font-weight: 700; color: ${C.ink}; }
.st .more { margin-left: auto; color: ${C.muted}; font-size: 12px; }
.btn { display: flex; align-items: center; justify-content: center; height: 42px; border-radius: 6px; font-size: 14px; font-weight: 600; padding: 0 16px; }
.btn-primary { background: ${C.ink}; color: #fff; } .btn-ghost { background: #fff; color: ${C.ink}; border: .5px solid #D9DCE2; }
.btn-text { color: ${C.accent}; font-size: 13px; }
.chip { display: inline-flex; align-items: center; height: 22px; padding: 0 9px; border-radius: 11px; font-size: 11px; background: #F1F2F4; color: ${C.sub}; margin: 0 6px 6px 0; }
.chip.on { background: ${C.ink}; color: #fff; }
.tagl { display: inline-flex; height: 18px; padding: 0 6px; align-items: center; border-radius: 3px; font-size: 10px; border: .5px solid #D9DCE2; color: ${C.sub}; margin-right: 4px; }
.segment { display: flex; background: #EFEDE7; border-radius: 6px; padding: 3px; }
.seg { flex: 1; text-align: center; height: 30px; line-height: 30px; border-radius: 4.5px; font-size: 13px; color: ${C.sub}; }
.seg.on { background: #fff; color: ${C.ink}; font-weight: 600; box-shadow: 0 1px 4px rgba(0,0,0,.06); }
.pill { display: inline-flex; align-items: center; height: 20px; padding: 0 8px; border-radius: 10px; font-size: 11px; }
.pill i { width: 5px; height: 5px; border-radius: 50%; background: currentColor; margin-right: 4px; }
.pill.blue { color: #2F5D8C; background: #E8EEF6; } .pill.gold { color: #8C6A33; background: #F5EEDF; } .pill.green { color: #2F7A5B; background: #E4F1EA; }
.cat { display: inline-flex; align-items: center; height: 20px; padding: 0 7px 0 5px; border-radius: 3px; font-size: 11px; font-weight: 600; letter-spacing: .5px; }
.cat i { width: 2px; height: 10px; border-radius: 1px; margin-right: 5px; }
.avatar { width: 40px; height: 40px; border-radius: 50%; background: #E8ECF3; color: ${C.ink}; font-family: 'Noto Serif CJK SC', serif; font-size: 17px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.banner { display: flex; align-items: center; padding: 10px 14px; border-radius: 6px; font-size: 12px; margin-bottom: 12px; }
.banner.gold { background: ${C.goldSoft}; color: #7D5F2E; } .banner.blue { background: #E8EEF6; color: ${C.accent}; } .banner .act { margin-left: auto; font-weight: 600; }
.score { font-size: 12px; color: ${C.accent}; background: #EEF2F8; border-radius: 4px; padding: 1px 6px; }
.input { background: #F7F7F8; border-radius: 5px; padding: 9px 10px; font-size: 13px; color: ${C.text}; }

/* 工作台 */
.cover { position: relative; border-radius: 10px; padding: 18px 18px 14px; color: #fff; overflow: hidden;
  background: radial-gradient(120% 140% at 100% 0%, #2B4470 0%, #1B2B48 55%, #15223A 100%); box-shadow: 0 8px 20px rgba(27,43,72,.22); }
.cover::after { content: ''; position: absolute; right: -30px; top: -30px; width: 130px; height: 130px; border-radius: 50%; border: .5px solid rgba(245,238,223,.2); }
.cover::before { content: ''; position: absolute; right: 10px; top: 10px; width: 70px; height: 70px; border-radius: 50%; border: .5px solid rgba(245,238,223,.12); }
.cover .lt { color: #CBB28A; } .cno { font-family: 'Noto Serif CJK SC', serif; font-size: 38px; font-weight: 700; margin-top: 8px; letter-spacing: 2px; color: #F5EEDF; line-height: 1.2; }
.ctitle { font-family: 'Noto Serif CJK SC', serif; font-size: 17px; font-weight: 700; } .crange { font-size: 12px; color: rgba(255,255,255,.62); letter-spacing: 1px; }
.cstats { display: flex; margin-top: 16px; padding-top: 12px; border-top: .5px solid rgba(255,255,255,.14); }
.cs { flex: 1; } .cs .v { font-size: 20px; font-weight: 700; } .cs .v.g { color: #E3C892; } .cs .k { font-size: 11px; color: rgba(255,255,255,.55); }
.quick { display: flex; background: #fff; border-radius: 8px; border: .5px solid ${C.line}; margin-top: 12px; padding: 14px 4px; }
.q { flex: 1; display: flex; flex-direction: column; align-items: center; font-size: 12px; position: relative; }
.qi { width: 36px; height: 36px; border-radius: 10px; padding: 8px; margin-bottom: 6px; }
.badge { position: absolute; top: -3px; right: 14px; min-width: 16px; height: 16px; line-height: 16px; padding: 0 4px; border-radius: 8px; background: ${C.red}; color: #fff; font-size: 10px; text-align: center; }
.stats { display: flex; } .stats .s { flex: 1; text-align: center; position: relative; }
.stats .s + .s::before { content: ''; position: absolute; left: 0; top: 6px; bottom: 6px; width: .5px; background: ${C.line}; }
.stats .v { font-size: 20px; color: ${C.ink}; font-weight: 700; } .stats .k { font-size: 11px; color: ${C.muted}; }
.mono { width: 48px; height: 48px; border-radius: 6px; background: ${C.goldSoft}; color: ${C.gold}; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; text-align: center; line-height: 1.2; font-family: 'Noto Serif CJK SC', serif; }
.chg { display: flex; align-items: center; padding: 11px 16px; font-size: 13px; } .chg + .chg { border-top: .5px solid ${C.line}; }
.ct { font-size: 10px; padding: 1px 6px; border-radius: 3px; margin-right: 10px; flex-shrink: 0; }
.ct.added { background: #E4F1EA; color: ${C.green}; } .ct.removed { background: #F6E7E5; color: ${C.red}; } .ct.role { background: #E8EEF6; color: ${C.accent}; } .ct.org { background: ${C.goldSoft}; color: #8C6A33; }
.gear { width: 32px; height: 32px; border-radius: 50%; background: #fff; border: .5px solid ${C.line}; padding: 7px; }

/* 期刊 */
.issue { display: flex; background: #fff; border: .5px solid ${C.line}; border-radius: 8px; margin-bottom: 10px; overflow: hidden; }
.spine { width: 66px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 12px 0; background: ${C.ink}; color: #F5EEDF; }
.spine.m { background: ${C.goldSoft}; color: #8C6A33; }
.spine .k { font-size: 10px; letter-spacing: 2px; opacity: .75; } .spine .n { font-family: 'Noto Serif CJK SC', serif; font-size: 26px; font-weight: 700; line-height: 1.15; } .spine .y { font-size: 10px; opacity: .6; }
.ib { padding: 12px 14px; flex: 1; min-width: 0; } .ib .t { font-family: 'Noto Serif CJK SC', serif; font-size: 15px; font-weight: 700; color: ${C.ink}; }

/* 稿件 */
.note { margin-top: 14px; background: #fff; border-left: 2px solid ${C.gold}; border-radius: 0 6px 6px 0; padding: 12px 14px; font-size: 13px; line-height: 1.8; }
.item { background: #fff; border: .5px solid ${C.line}; border-radius: 7px; padding: 13px 12px; margin-bottom: 8px; display: flex; }
.rank { width: 24px; font-size: 13px; color: ${C.gold}; font-weight: 700; padding-top: 1px; }
.it { font-family: 'Noto Serif CJK SC', serif; font-size: 15px; font-weight: 700; color: ${C.ink}; line-height: 1.5; }
.ibx { font-size: 12.5px; color: ${C.sub}; margin-top: 4px; line-height: 1.7; }
.warn { font-size: 10px; color: #8C6A33; background: ${C.goldSoft}; border-radius: 3px; padding: 0 5px; margin-left: 6px; }

/* 复核 */
.tabs { display: flex; border-bottom: .5px solid ${C.line}; margin-bottom: 12px; }
.tb { flex: 1; text-align: center; padding: 9px 0 10px; font-size: 13px; color: ${C.sub}; position: relative; }
.tb.on { color: ${C.ink}; font-weight: 700; } .tb.on::after { content: ''; position: absolute; left: 50%; bottom: -.5px; width: 24px; margin-left: -12px; height: 2px; border-radius: 1px; background: ${C.ink}; }
.tb .n { margin-left: 3px; font-size: 10px; color: ${C.muted}; } .tb.on .n { color: ${C.gold}; }
.ev { padding: 14px; } .ev.att { border-color: #E6D3AE; box-shadow: 0 2px 12px rgba(168,131,74,.12); }
.et { font-family: 'Noto Serif CJK SC', serif; font-size: 15px; font-weight: 700; color: ${C.ink}; line-height: 1.5; margin-top: 8px; }
.person { display: inline-flex; align-items: baseline; margin: 0 10px 4px 0; } .pn { font-size: 13px; font-weight: 600; } .po { font-size: 11px; color: ${C.muted}; margin-left: 4px; }
.conf { width: 60px; height: 4px; background: #EEF0F3; border-radius: 2px; overflow: hidden; } .conf i { display: block; height: 100%; border-radius: 2px; }
.notes { margin-top: 8px; font-size: 11px; color: #8C6A33; background: ${C.goldSoft}; border-radius: 4px; padding: 5px 8px; }
.ops { display: flex; gap: 6px; margin-top: 12px; padding-top: 10px; border-top: .5px solid ${C.line}; }
.op { flex: 1; text-align: center; font-size: 12px; color: ${C.sub}; height: 28px; line-height: 28px; border-radius: 4px; }
.op.opk { color: ${C.ink}; background: #EEF2F8; font-weight: 600; } .op.opc { color: ${C.green}; background: #E4F1EA; font-weight: 600; }

/* 详情 */
.factor { display: flex; align-items: center; padding: 5px 0; } .fk { width: 70px; font-size: 12px; color: ${C.sub}; }
.ftrack { flex: 1; height: 6px; background: #F0F1F3; border-radius: 3px; overflow: hidden; } .fbar { height: 100%; background: linear-gradient(90deg, #7A9CC4, ${C.ink}); border-radius: 3px; }
.fv { width: 40px; text-align: right; font-size: 12px; color: ${C.ink}; }
.stt { font-size: 10px; padding: 1px 6px; border-radius: 3px; background: #E4F1EA; color: ${C.green}; }
.src { display: flex; align-items: center; padding: 12px 14px; } .src + .src { border-top: .5px solid ${C.line}; }
.si { width: 22px; height: 22px; border-radius: 50%; background: #F1F2F4; color: ${C.sub}; font-size: 11px; display: flex; align-items: center; justify-content: center; margin-right: 10px; flex-shrink: 0; }
.label { font-size: 11px; color: ${C.muted}; letter-spacing: 1px; margin-bottom: 5px; }

/* 委员 */
.search { display: flex; align-items: center; height: 38px; background: #fff; border: .5px solid ${C.line}; border-radius: 19px; padding: 0 14px; font-size: 13px; color: ${C.muted}; }
.mrow { display: flex; align-items: center; padding: 13px 14px; } .mrow + .mrow { border-top: .5px solid ${C.line}; }
.mn { font-family: 'Noto Serif CJK SC', serif; font-size: 16px; font-weight: 700; color: ${C.ink}; margin-right: 6px; }
.role { font-size: 10px; color: ${C.accent}; background: #EEF2F8; border-radius: 3px; padding: 0 5px; }
.hom { font-size: 10px; color: #8C6A33; background: ${C.goldSoft}; border-radius: 3px; padding: 0 5px; margin-left: 4px; }
.ring { width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
.ring i { width: 24px; height: 24px; border-radius: 50%; background: #fff; font-size: 9px; color: ${C.ink}; display: flex; align-items: center; justify-content: center; font-style: normal; }
.index { position: absolute; right: 3px; top: 160px; display: flex; flex-direction: column; font-size: 9px; color: ${C.accent}; gap: 2px; text-align: center; }

/* 画像 */
.hero { background: linear-gradient(180deg, #1B2B48 0%, #22365A 100%); color: #fff; padding: 12px 16px 0; }
.av-lg { width: 64px; height: 64px; border-radius: 50%; background: #F5EEDF; color: ${C.ink}; font-family: 'Noto Serif CJK SC', serif; font-size: 28px; font-weight: 700; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 3px rgba(245,238,223,.25); }
.hn { font-family: 'Noto Serif CJK SC', serif; font-size: 24px; font-weight: 700; letter-spacing: 2px; }
.ver { font-family: sans-serif; font-size: 10px; color: ${C.ink}; background: #E3C892; border-radius: 3px; padding: 1px 5px; margin-left: 8px; letter-spacing: 0; vertical-align: middle; }
.hr { font-size: 10px; color: #E3C892; border: .5px solid rgba(227,200,146,.5); border-radius: 3px; padding: 0 6px; margin: 0 6px 4px 0; }
.hstats { display: flex; margin-top: 16px; padding: 12px 0 14px; border-top: .5px solid rgba(255,255,255,.12); }
.hs { flex: 1; } .hs .v { font-size: 16px; font-weight: 700; } .hs .k { font-size: 10px; color: rgba(255,255,255,.55); }
.kv { display: flex; padding: 7px 0; font-size: 13px; } .kv .k { width: 75px; color: ${C.muted}; flex-shrink: 0; } .kv .v { flex: 1; min-width: 0; }
.chip.pos { background: #E4F1EA; color: ${C.green}; } .chip.neg { background: #F6E7E5; color: ${C.red}; }
.tl { position: relative; padding-left: 18px; } .tl::before { content: ''; position: absolute; left: 5px; top: 6px; bottom: 6px; width: 1px; background: #E1DED6; }
.tli { position: relative; margin-bottom: 12px; } .tld { position: absolute; left: -17px; top: 6px; width: 9px; height: 9px; border-radius: 50%; border: 2px solid ${C.paper}; }
.tlc { background: #fff; border: .5px solid ${C.line}; border-radius: 6px; padding: 10px 12px; margin-top: 4px; }
.tlt { font-size: 13.5px; color: ${C.ink}; font-weight: 600; margin: 5px 0 2px; line-height: 1.5; }

/* 名单 */
.tiles { display: flex; gap: 6px; margin-bottom: 10px; } .tile { flex: 1; background: #fff; border: .5px solid ${C.line}; border-radius: 6px; padding: 9px 0; text-align: center; }
.tile .v { font-size: 18px; font-weight: 700; color: ${C.ink}; } .tile .k { font-size: 10px; color: ${C.muted}; }
.paste { height: 120px; font-size: 12px; line-height: 1.7; color: ${C.sub}; white-space: pre; overflow: hidden; }

/* 设置 */
.kvs { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; font-size: 13px; } .kvs .k { color: ${C.sub}; }
.sw2 { width: 40px; height: 24px; border-radius: 12px; background: ${C.ink}; position: relative; } .sw2::after { content: ''; position: absolute; right: 2px; top: 2px; width: 20px; height: 20px; border-radius: 50%; background: #fff; }
.sw2.off { background: #E1E3E7; } .sw2.off::after { right: auto; left: 2px; }
.sl { display: flex; align-items: center; padding: 3px 0; } .sl .sk { width: 70px; font-size: 12px; color: ${C.sub}; }
.track { flex: 1; height: 3px; border-radius: 2px; background: ${C.line}; position: relative; } .track i { position: absolute; left: 0; top: 0; bottom: 0; background: ${C.ink}; border-radius: 2px; }
.track b { position: absolute; top: -7px; width: 17px; height: 17px; border-radius: 50%; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,.2); margin-left: -8px; }
.sl .sv { width: 38px; text-align: right; font-size: 12px; color: ${C.ink}; }
.stepper { display: flex; align-items: center; border: .5px solid #D9DCE2; border-radius: 5px; overflow: hidden; }
.stepper span { width: 28px; height: 26px; line-height: 26px; text-align: center; background: #F7F7F8; color: ${C.ink}; } .stepper em { min-width: 32px; text-align: center; font-style: normal; font-size: 13px; }
.g4 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 8px 0 6px; } .gl { font-size: 11px; color: ${C.muted}; margin-bottom: 4px; }
.state { font-size: 11px; padding: 1px 7px; border-radius: 3px; background: #E4F1EA; color: ${C.green}; }
.wx { background: #fff; padding: 18px 16px 20px; }
`;

// ---------- 小部件 ----------
const statusBar = (dark) => `<div class="status"><span class="num">9:41</span><span class="ic"><svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor"><rect x="0" y="7" width="3" height="4" rx=".7"/><rect x="4.5" y="5" width="3" height="6" rx=".7"/><rect x="9" y="2.5" width="3" height="8.5" rx=".7"/><rect x="13.5" y="0" width="3" height="11" rx=".7"/></svg><svg width="15" height="11" viewBox="0 0 15 11" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M1 3.8a9 9 0 0 1 13 0M3.3 6.3a5.6 5.6 0 0 1 8.4 0"/><circle cx="7.5" cy="9" r="1" fill="currentColor"/></svg><span class="bat"><i></i></span></span></div>`;
const navbar = (title, back = true) => `<div class="navbar">${back ? '<span class="back">‹</span>' : ''}${title}<div class="capsule"><span class="dots"><svg width="18" height="4" viewBox="0 0 18 4" fill="currentColor"><circle cx="2" cy="2" r="1.8"/><circle cx="9" cy="2" r="2.2"/><circle cx="16" cy="2" r="1.8"/></svg></span><span class="rec"></span></div></div>`;
const tabbar = (on) => `<div class="tabbar">${[['home', '工作台'], ['issues', '期刊'], ['review', '复核'], ['members', '委员']].map(([k, n]) =>
  `<div class="tab ${on === k ? 'on' : ''}"><div class="ti">${svg(PATHS[k], on === k ? C.ink : '#9AA0A9', on === k ? 1.9 : 1.6)}</div>${n}</div>`).join('')}</div>`;
const pill = (tone, t) => `<span class="pill ${tone}"><i></i>${t}</span>`;
const cat = (k) => `<span class="cat" style="color:${CAT[k][1]};background:${CAT[k][2]}"><i style="background:${CAT[k][1]}"></i>${CAT[k][0]}</span>`;
const st = (no, t, more = '') => `<div class="st"><span class="no">${no}</span><span class="t">${t}</span>${more ? `<span class="more">${more}</span>` : ''}</div>`;
const phone = ({ dark = false, title = '', back = true, nav = true, tab = null, bar = null, body, full = false, navBg = '' }) => `
<div class="phone ${dark ? 'dark' : ''}">
  <div style="position:absolute;inset:0 0 auto 0;height:${nav ? 88 : 44}px;background:${navBg || 'transparent'};z-index:3">${statusBar(dark)}${nav ? navbar(title, back) : ''}</div>
  <div class="content ${tab ? 'tabbed' : ''} ${bar ? 'bar' : ''} ${full || !nav ? 'full' : ''}">${body}</div>
  ${tab ? tabbar(tab) : ''}${bar ? `<div class="actionbar">${bar}</div>` : ''}<div class="home-ind"></div>
</div>`;

// ---------- 各页面 ----------
const screens = [];

screens.push({ id: '01-home', name: '工作台', desc: '期刊封面卡 · 采集进度 · 快捷操作', html: phone({ nav: false, tab: 'home', body: `
<div class="c" style="padding-top:10px">
  <div class="eyebrow">SMP · ACADEMIC BULLETIN</div>
  <div class="row" style="margin-top:4px"><div class="h1 flex1">学术动态工作台</div><div class="gear">${svg(PATHS.settings, C.ink, 1.7)}</div></div>
  <div class="sub">中国中文信息学会 · 社会媒体处理专委会　2026-11-10</div>
  <div class="cover" style="margin-top:14px">
    <div class="between"><span class="eyebrow lt">WEEKLY · 2026-W45</span>${pill('gold', '待复核')}</div>
    <div class="cno">第 45 期</div>
    <div class="ctitle">委员学术动态周报</div>
    <div class="crange num">11.02 — 11.08</div>
    <div class="cstats">
      <div class="cs"><div class="v num">186</div><div class="k">候选事件</div></div>
      <div class="cs"><div class="v num">42</div><div class="k">入选</div></div>
      <div class="cs"><div class="v num g">5</div><div class="k">待复核</div></div>
    </div>
  </div>
  <div class="quick">
    ${[['weekly', '新建周报', '#E8ECF3', C.ink], ['monthly', '新建月报', '#F5EEDF', '#9A7438'], ['roster', '名单变更', '#E3F0EC', '#2F6F62'], ['reviewq', '复核', '#F6E7E5', '#A04F48']]
    .map(([k, n, bg, fg]) => `<div class="q"><div class="qi" style="background:${bg}">${svg(PATHS[k], fg, 1.7)}</div>${n}${k === 'reviewq' ? '<span class="badge num">5</span>' : ''}</div>`).join('')}
  </div>
  ${st('01', '本月月报')}
  <div class="card" style="padding:14px 16px"><div class="row"><div class="mono">10<br>月刊</div><div class="flex1" style="margin-left:12px"><div class="h3">委员学术动态月报</div><div class="sub">10.01 — 10.31 · 入选 48 条</div></div>${pill('green', '已发布')}</div></div>
  ${st('02', '专委会概览')}
  <div class="card"><div class="stats"><div class="s"><div class="v num">401</div><div class="k">在任委员</div></div><div class="s"><div class="v num">44</div><div class="k">已发布期数</div></div><div class="s"><div class="v num">5</div><div class="k">待复核</div></div></div></div>
</div>` }) });

screens.push({ id: '02-issues', name: '期刊', desc: '书脊式期号 · 周报/月报分段', html: phone({ title: '期刊', back: false, tab: 'issues', navBg: C.paper, body: `
<div class="c">
  <div class="segment"><div class="seg on">全部</div><div class="seg">周报</div><div class="seg">月报</div></div>
  <div style="margin-top:14px">
  ${[['w', '45', '委员学术动态周报 | 2026年第45期', '11.02 — 11.08', 'gold', '待复核', 42, 186],
    ['w', '44', '委员学术动态周报 | 2026年第44期', '10.26 — 11.01', 'green', '已发布', 38, 171],
    ['m', '10', '委员学术动态月报 | 2026年10月', '10.01 — 10.31', 'green', '已发布', 48, 402],
    ['w', '43', '委员学术动态周报 | 2026年第43期', '10.19 — 10.25', 'green', '已发布', 35, 158],
    ['w', '42', '委员学术动态周报 | 2026年第42期', '10.12 — 10.18', 'green', '已发布', 41, 193],
    ['w', '41', '委员学术动态周报 | 2026年第41期', '10.05 — 10.11', 'green', '已发布', 31, 140]]
    .map(([k, n, t, r, tone, s, a, b]) => `<div class="issue"><div class="spine ${k === 'm' ? 'm' : ''}"><div class="k">${k === 'm' ? '月报' : '周报'}</div><div class="n">${n}</div><div class="y num">2026</div></div>
      <div class="ib"><div class="t ellipsis">${t}</div><div class="sub num">${r}</div><div class="row" style="margin-top:8px">${pill(tone, s)}<span class="muted" style="margin-left:8px">入选 <span class="num">${a}</span> · 候选 <span class="num">${b}</span></span></div></div></div>`).join('')}
  </div>
</div>` }) });

const items = [
  ['org', 'SMP 2026 第十五届全国社会媒体处理大会召开', '大会设置特邀报告、技术评测与青年学者论坛，甄学文教授出席并致辞。', [], '中国中文信息学会 · 11月4日', '81.2'],
  ['honor', '林知远当选 IEEE Fellow', '复旦大学林知远教授当选 IEEE Fellow，表彰其在社会网络分析领域的学术贡献。', ['林知远'], '复旦大学新闻网 · 11月3日', '79.6'],
  ['honor', '温如初团队论文获 EMNLP 2026 最佳论文奖', '西安交通大学温如初教授团队关于大语言模型对齐的论文获最佳论文奖。', ['温如初'], '新华网 · 11月8日', '78.3'],
  ['research', '苏墨言团队在 ACL 2026 发表计算社会科学成果', '研究提出了新的舆情演化建模框架，相关论文被 ACL 2026 录用。', ['苏墨言'], '武汉大学新闻网 · 11月5日', '66.1'],
];
screens.push({ id: '03-issue', name: '稿件', desc: '刊头 · 编者按 · 栏目编号 · 定稿操作', html: phone({ title: '周报 · 第 45 期', bar: '<div class="btn btn-ghost">复核</div><div class="btn btn-ghost">导出</div><div class="btn btn-primary">定稿发布</div>', navBg: C.paper, body: `
<div class="c">
  <div class="segment"><div class="seg on">编辑视图</div><div class="seg">公众号预览</div></div>
  <div class="banner gold" style="margin-top:12px">复核结论已更新，重新编排后生效<span class="act">重新编排 ›</span></div>
  <div style="padding-bottom:14px;border-bottom:.5px solid ${C.line}">
    <div class="eyebrow">SMP · WEEKLY · 2026-W45</div>
    <div class="h1" style="font-size:19px;margin-top:6px">SMP 委员动态周报 | 2026年第45期（11.02—11.08）</div>
    <div class="row" style="margin-top:8px">${pill('gold', '待复核')}<span class="sub" style="margin-left:8px">11.02 — 11.08 · 共 42 条</span></div>
  </div>
  <div class="note"><b class="serif" style="color:${C.ink}">编者按</b>　本期收录委员学术动态 42 条：两位委员当选 IEEE Fellow，三篇论文获国际会议最佳论文奖，第十五届全国社会媒体处理大会顺利召开……</div>
  ${st('01', '专委会动态', '1 条')}
  ${items.slice(0, 1).map((x, i) => itemCard(x, i + 1)).join('')}
  ${st('02', '学术荣誉', '9 条')}
  ${items.slice(1, 3).map((x, i) => itemCard(x, i + 2, i === 0)).join('')}
</div>` }) });

function itemCard([, h, b, ms, src, sc], rank, warn = false) {
  return `<div class="item"><div class="rank num">${rank}</div><div class="flex1"><div class="it">${h}</div><div class="ibx clamp2">${b}</div>
  <div class="row wrap" style="margin-top:6px">${ms.map((m) => `<span class="tagl">${m}</span>`).join('')}<span class="muted">${src}</span>${warn ? '<span class="warn">待确认</span>' : ''}</div></div>
  <div style="margin-left:8px"><span class="score num">${sc}</span></div></div>`;
}

screens.push({ id: '04-review', name: '复核', desc: '人物置信度 · 一键保留/剔除/认错人', html: phone({ title: '复核', back: false, tab: 'review', navBg: C.paper, body: `
<div class="c">
  <div class="between" style="padding-bottom:12px"><div><div class="eyebrow">REVIEW</div><div class="h2">周报 · 第 45 期</div></div><div class="sub" style="background:#fff;border:.5px solid ${C.line};border-radius:15px;padding:4px 11px">11.02 — 11.08 ⌄</div></div>
  <div class="tabs"><div class="tb on">待复核<span class="n num">5</span></div><div class="tb">入选<span class="n num">42</span></div><div class="tb">候选<span class="n num">144</span></div><div class="tb">已过滤<span class="n num">63</span></div></div>
  <div class="card ev att">
    <div class="between">${cat('honor')}<span class="score num">79.6</span></div>
    <div class="et">林知远当选 IEEE Fellow</div>
    <div class="row wrap" style="margin-top:6px"><span class="person"><span class="pn">林知远</span><span class="po">复旦大学</span></span><span class="person"><span class="pn">林知远</span><span class="po">浙江大学</span></span></div>
    <div class="row" style="margin-top:6px"><div class="conf"><i style="width:55%;background:${C.gold}"></i></div><span class="muted" style="margin-left:6px">人物置信 55% · 2 家报道</span></div>
    <div class="notes">人物待确认：名单内同名（复旦大学 / 浙江大学），报道未出现单位</div>
    <div class="ops"><div class="op opk">保留</div><div class="op">剔除</div><div class="op">认错人</div><div class="op opc">人物无误</div></div>
  </div>
  <div class="card ev att">
    <div class="between">${cat('activity')}<span class="score num">52.4</span></div>
    <div class="et">陆鸣谦教授应邀在 CCL 2026 作主旨报告</div>
    <div class="row wrap" style="margin-top:6px"><span class="person"><span class="pn">陆鸣谦</span><span class="po">东南大学</span></span></div>
    <div class="row" style="margin-top:6px"><div class="conf"><i style="width:58%;background:${C.gold}"></i></div><span class="muted" style="margin-left:6px">人物置信 58% · 1 家报道</span></div>
    <div class="ops"><div class="op opk">保留</div><div class="op">剔除</div><div class="op">认错人</div><div class="op opc">人物无误</div></div>
  </div>
</div>` }) });

screens.push({ id: '05-event', name: '动态详情', desc: '成稿编辑 · 评分拆解 · 消歧证据 · 信源', html: phone({ title: '动态详情', bar: '<div class="btn btn-ghost">剔除</div><div class="btn btn-primary">保存修改</div>', navBg: C.paper, body: `
<div class="c">
  <div class="between">${cat('honor')}<span class="btn-text">调整栏目 ›</span></div>
  <div class="card" style="margin-top:10px">
    <div class="label">成稿标题</div><div class="serif" style="font-size:17px;font-weight:700;color:${C.ink};line-height:1.5">温如初团队论文获 EMNLP 2026 最佳论文奖</div>
    <div class="hairline"></div>
    <div class="label">成稿摘要</div><div style="font-size:13.5px;line-height:1.75">西安交通大学温如初教授团队关于大语言模型对齐的论文，在 EMNLP 2026 国际学术会议上荣获最佳论文奖。</div>
  </div>
  ${st('01', '重要性评分', '<span class="num">78.3 分</span>')}
  <div class="card">${[['栏目', 1], ['级别', 1], ['委员身份', 0.5], ['信源权威', 0.95], ['报道覆盖', 0.77], ['领域相关', 0.67], ['时效', 1]]
    .map(([k, v]) => `<div class="factor"><div class="fk">${k}</div><div class="ftrack"><div class="fbar" style="width:${v * 100}%"></div></div><div class="fv num">${v.toFixed(2)}</div></div>`).join('')}</div>
  ${st('02', '人物识别')}
  <div class="card"><div class="row"><div class="avatar">温</div><div class="flex1" style="margin-left:10px"><div class="h3">温如初 <span class="sub">西安交通大学</span></div><div class="row" style="margin-top:3px"><span class="stt">已确认</span><span class="muted" style="margin-left:6px">置信度 95% · 规则</span></div></div></div>
    <div class="row wrap" style="margin-top:8px"><span class="chip">单位邻近:西安交通大学</span><span class="chip">学术语境</span><span class="chip">查询来源</span><span class="chip">标题提及</span></div></div>
</div>` }) });

const mlist = [['甄', '甄学文', '指导委主任', '清华大学 · 教授', 82, 6], ['林', '林知远', '副主任', '浙江大学 · 教授', 64, 4, true], ['林', '林知远', '常务委员', '复旦大学 · 教授', 58, 5, true],
  ['苏', '苏墨言', '常务委员', '武汉大学 · 教授', 76, 3], ['方', '方以宁', '委员', '大连理工大学 · 副教授', 40, 2], ['程', '程思远', '常务委员', '北京师范大学 · 教授', 92, 7],
  ['温', '温如初', '委员', '西安交通大学 · 教授', 60, 2], ['陆', '陆鸣谦', '委员', '东南大学', 20, 1], ['韩', '韩照临', '委员', '中山大学 · 研究员', 48, 0]];
screens.push({ id: '06-members', name: '委员名录', desc: '检索 · 身份筛选 · 画像完整度环', html: phone({ title: '委员', back: false, tab: 'members', navBg: C.paper, body: `
<div class="c" style="padding-top:8px">
  <div class="search">${`<span style="width:16px;height:16px;margin-right:8px;display:inline-block">${svg(PATHS.search, '#9AA0A9', 2)}</span>`}搜索姓名、单位或研究方向</div>
  <div style="margin-top:10px;white-space:nowrap;overflow:hidden"><span class="chip on">全部</span><span class="chip">指导委员会主任</span><span class="chip">主任</span><span class="chip">副主任</span><span class="chip">常务委员</span><span class="chip">委员</span></div>
  <div class="between" style="margin:2px 0 8px"><span class="sub">共 <span class="num">401</span> 位在任委员</span><span class="btn-text">名单变更 ›</span></div>
  <div class="card-flat">${mlist.map(([c, n, r, o, p, e, h]) => `<div class="mrow"><div class="avatar">${c}</div><div class="flex1" style="margin-left:10px"><div class="row"><span class="mn">${n}</span><span class="role">${r}</span>${h ? '<span class="hom">同名</span>' : ''}</div><div class="sub ellipsis">${o}</div></div>
    <div style="display:flex;flex-direction:column;align-items:center;margin-left:8px"><div class="ring" style="background:conic-gradient(${C.ink} ${p}%, ${C.line} 0)"><i class="num">${p}</i></div><div class="muted" style="font-size:10px">动态 ${e}</div></div></div>`).join('')}</div>
</div>` }) });

screens.push({ id: '07-member', name: '委员画像', desc: '墨蓝档案头 · 消歧信息 · 动态时间线', html: phone({ title: '程思远', dark: true, navBg: C.ink, bar: '<div class="btn btn-ghost">AI 补全画像</div><div class="btn btn-primary">编辑画像</div>', body: `
<div class="hero"><div class="row"><div class="av-lg">程</div><div class="flex1" style="margin-left:14px"><div class="hn">程思远<span class="ver">已核验</span></div><div style="font-size:13px;color:rgba(255,255,255,.72)">北京师范大学</div><div class="row wrap" style="margin-top:6px"><span class="hr">常务委员</span></div></div></div>
  <div class="hstats"><div class="hs"><div class="v num">7</div><div class="k">已发布动态</div></div><div class="hs"><div class="v num">92%</div><div class="k">画像完整度</div></div><div class="hs"><div class="v num">2026-11-10</div><div class="k">入选日期</div></div></div></div>
<div class="c">
  ${st('01', '学术画像', '编辑')}
  <div class="card" style="padding:12px 16px">
    <div class="kv"><div class="k">职称/职务</div><div class="v">教授、博士生导师</div></div>
    <div class="kv"><div class="k">研究方向</div><div class="v"><span class="chip">计算传播学</span><span class="chip">社交媒体分析</span><span class="chip">舆论动力学</span></div></div>
    <div class="kv"><div class="k">个人主页</div><div class="v ellipsis" style="color:${C.accent}">https://example.edu.cn/~chengsy</div></div>
  </div>
  ${st('02', '消歧信息')}
  <div class="card" style="padding:12px 16px">
    <div class="kv"><div class="k">英文名</div><div class="v">Siyuan Cheng / Cheng Siyuan</div></div>
    <div class="kv"><div class="k">特征关键词</div><div class="v"><span class="chip pos">新媒体传播实验室</span><span class="chip pos">计算传播</span></div></div>
    <div class="kv"><div class="k">同名排除词</div><div class="v"><span class="chip neg">演员</span><span class="chip neg">足球</span></div></div>
  </div>
  ${st('03', '学术动态', '7 条')}
  <div class="tl">
    <div class="tli"><div class="tld" style="background:#9A7438"></div><div class="muted num">2026-11-05</div><div class="tlc">${cat('honor')}<div class="tlt">程思远入选全球前 2% 顶尖科学家榜单</div><div class="muted">周报 45 期</div></div></div>
  </div>
</div>` }) });

screens.push({ id: '08-roster', name: '名单变更', desc: '粘贴官网名单 · 自动比对增删改', html: phone({ title: '名单变更', navBg: C.paper, bar: '<div class="btn btn-ghost">预览变更</div><div class="btn btn-primary">确认导入</div>', body: `
<div class="c">
  <div class="eyebrow">ROSTER UPDATE</div>
  <div class="h2" style="margin-top:4px">导入新一届 / 调整后的委员名单</div>
  <div class="sub" style="margin-top:4px;line-height:1.7">粘贴官网“委员介绍”全文或 CSV，系统自动识别新增、离任、身份与单位变化，委员 ID 与画像保持不变。</div>
  <div class="card" style="margin-top:12px;padding:12px 16px">
    <div class="label">名单文本</div>
    <div class="input paste">主任\n甄学文 清华大学\n副主任\n林知远 浙江大学\n常务委员\n程思远 北京师范大学\n……</div>
    <div class="between" style="margin-top:6px"><span class="muted">812 行</span><span class="btn-text">从剪贴板粘贴</span></div>
    <div class="hairline"></div>
    <div class="label">生效日期</div><div class="input num">2027-01-01</div>
  </div>
  ${st('01', '变更预览', '共解析 412 人')}
  <div class="tiles">${[['12', '新增', C.green], ['1', '离任', C.red], ['6', '身份变化', C.accent], ['2', '单位变化', C.gold], ['391', '未变', C.ink]].map(([v, k, c]) => `<div class="tile"><div class="v num" style="color:${c}">${v}</div><div class="k">${k}</div></div>`).join('')}</div>
  <div class="card-flat">
    <div class="chg"><span class="ct added">新增</span><b style="color:${C.ink}">钟予安</b><span class="sub" style="margin-left:6px">上海交通大学 · 委员</span></div>
    <div class="chg"><span class="ct role">身份</span><b style="color:${C.ink}">程思远</b><span class="sub" style="margin-left:6px">委员 → 常务委员</span></div>
    <div class="chg"><span class="ct org">单位</span><b style="color:${C.ink}">裴语冰</b><span class="sub" style="margin-left:6px">华南理工大学 → 深圳大学</span></div>
  </div>
</div>` }) });

const slider = (k, v, color = C.ink, suffix = '%') => `<div class="sl"><span class="sk">${k}</span><div class="track"><i style="width:${v * 2}%;background:${color}"></i><b style="left:${v * 2}%"></b></div><span class="sv num">${v}${suffix}</span></div>`;
screens.push({ id: '09-settings', name: '系统设置', desc: 'DeepSeek 接口 · 选稿规则 · 权重 · 定时', html: phone({ title: '系统设置', navBg: C.paper, bar: '<div class="btn btn-ghost">放弃修改</div><div class="btn btn-primary">保存设置</div>', body: `
<div class="c" style="padding-top:4px">
  ${st('01', 'DeepSeek 开放搜索')}
  <div class="card" style="padding:12px 16px">
    <div class="kvs"><span>API Key（云函数环境变量）</span><span class="state">已配置</span></div>
    <div class="kvs"><span class="k">Search 接口</span><span class="num">/v1/tools/search</span></div>
    <div class="kvs"><span class="k">Fetch 接口</span><span class="num">/v1/tools/fetch</span></div>
    <div class="kvs"><span class="k">每次返回条数</span><span class="stepper"><span>−</span><em class="num">20</em><span>＋</span></span></div>
    <div class="kvs"><span class="k">回查正文（Fetch）</span><span class="sw2 off"></span></div>
  </div>
  ${st('02', '选稿规则')}
  <div class="card" style="padding:12px 16px"><div class="h3">周报</div>
    <div class="g4">${[['最少条数', 30], ['最多条数', 50], ['入选分数线', 25], ['每人上限', 2]].map(([k, v]) => `<div><div class="gl">${k}</div><div class="input num">${v}</div></div>`).join('')}</div>
    <div class="kvs"><span class="k">只收录学术动态</span><span class="sw2"></span></div></div>
  ${st('03', '重要性权重', '合计 100%')}
  <div class="card" style="padding:10px 16px">${slider('栏目', 25)}${slider('级别', 20)}${slider('信源权威', 15)}${slider('委员身份', 10)}${slider('报道覆盖', 10)}</div>
</div>` }) });

// 公众号成稿效果：直接使用云函数的 renderWechatHtml 输出
const wxIssue = {
  title: 'SMP 委员动态周报 | 2026年第45期（11.02—11.08）', period: { start: '2026-11-02', end: '2026-11-08' }, count: 42,
  editorNote: '本期收录委员学术动态 42 条：两位委员当选 IEEE Fellow，三篇论文获国际会议最佳论文奖，第十五届全国社会媒体处理大会顺利召开。',
  sections: [
    { key: 'org', name: '专委会动态', events: [{ rank: 1, headline: 'SMP 2026 第十五届全国社会媒体处理大会召开', blurb: '大会设置特邀报告、技术评测与青年学者论坛，甄学文教授出席并致辞。', url: 'https://example.org/1', site: '中国中文信息学会', date: '11月4日', members: [], nSources: 1 }] },
    { key: 'honor', name: '学术荣誉', events: [
      { rank: 2, headline: '林知远当选 IEEE Fellow', blurb: '复旦大学林知远教授当选 IEEE Fellow，表彰其在社会网络分析领域的学术贡献。', url: 'https://example.org/2', site: '复旦大学新闻网', date: '11月3日', members: [{ name: '林知远', org: '复旦大学' }], nSources: 2 },
      { rank: 3, headline: '温如初团队论文获 EMNLP 2026 最佳论文奖', blurb: '西安交通大学温如初教授团队关于大语言模型对齐的论文获最佳论文奖。', url: 'https://example.org/3', site: '新华网', date: '11月8日', members: [{ name: '温如初', org: '西安交通大学' }], nSources: 3 }] },
  ],
};
screens.push({ id: '10-wechat', name: '公众号成稿', desc: '导出的内联样式 HTML（同一设计语言）', html: phone({ title: 'SMP 社会媒体处理', navBg: '#fff', body: `<div class="wx">${renderWechatHtml(wxIssue)}</div>` }) });

const palette = [['墨蓝 主色', C.ink], ['学术蓝', C.accent], ['鎏金 点缀', C.gold], ['金 浅底', C.goldSoft], ['纸色 背景', C.paper], ['细线', C.line], ['正文', C.text], ['辅助', C.sub]];
const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>SMP 学术动态 · 小程序页面风格图</title><style>${css}</style></head><body>
<div class="board" id="board">
  <div class="board-head">
    <div><div class="eyebrow">SMP · ACADEMIC BULLETIN · DESIGN</div><h1>委员学术动态小程序 · 页面风格图</h1>
      <p>学术 · 简洁清爽 · 精致　｜　宋体标题 + 黑体正文　｜　墨蓝主色、鎏金点缀、纸色背景、细线卡片　｜　示例人物与动态均为虚构</p></div>
    <div class="palette">${palette.map(([n, c]) => `<div class="sw"><i style="background:${c}"></i>${n}<br><span class="num">${c}</span></div>`).join('')}</div>
  </div>
  <div class="grid">${screens.map((s) => `<div><div id="s-${s.id}" style="padding:12px">${s.html}</div><div class="cap"><b>${s.name}</b><span>${s.desc}</span></div></div>`).join('')}</div>
</div></body></html>`;

module.exports = { html, screens };
if (require.main === module) {
  require('fs').writeFileSync(require('path').join(__dirname, 'mockups.html'), html);
  console.log('design/mockups.html written');
}
