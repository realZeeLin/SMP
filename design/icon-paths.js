/**
 * 图标集（原创绘制，24×24 视口），参考 iOS 视觉：圆角端点、统一线宽、选中态为实心。
 * - TAB：标签栏图标，outline（未选中）与 fill（选中）两套；
 * - GLYPH：放在彩色圆角方块（类似 iOS“设置”）里的白色线性图标。
 */
const TAB = {
  feed: {
    outline: '<circle cx="12" cy="12" r="2.2"/><path d="M8.2 8.2a5.4 5.4 0 0 0 0 7.6M15.8 8.2a5.4 5.4 0 0 1 0 7.6M5.3 5.3a9.5 9.5 0 0 0 0 13.4M18.7 5.3a9.5 9.5 0 0 1 0 13.4"/>',
    fill: '<circle cx="12" cy="12" r="3" stroke="none"/><path fill="none" stroke-width="2.1" d="M8.2 8.2a5.4 5.4 0 0 0 0 7.6M15.8 8.2a5.4 5.4 0 0 1 0 7.6M5.3 5.3a9.5 9.5 0 0 0 0 13.4M18.7 5.3a9.5 9.5 0 0 1 0 13.4"/>',
  },
  home: {
    outline: '<rect x="3.5" y="3.5" width="7.2" height="7.2" rx="2"/><rect x="13.3" y="3.5" width="7.2" height="7.2" rx="2"/><rect x="3.5" y="13.3" width="7.2" height="7.2" rx="2"/><rect x="13.3" y="13.3" width="7.2" height="7.2" rx="2"/>',
    fill: '<g stroke="none"><rect x="3" y="3" width="8.2" height="8.2" rx="2.4"/><rect x="12.8" y="3" width="8.2" height="8.2" rx="2.4"/><rect x="3" y="12.8" width="8.2" height="8.2" rx="2.4"/><rect x="12.8" y="12.8" width="8.2" height="8.2" rx="2.4"/></g>',
  },
  issues: {
    outline: '<rect x="3.5" y="4" width="13.5" height="16.5" rx="2.6"/><path d="M17 8h1.8a1.7 1.7 0 0 1 1.7 1.7v8.3a2.5 2.5 0 0 1-2.5 2.5H6.5"/><path d="M7 8.5h6.5M7 12h6.5M7 15.5h4"/>',
    fill: '<mask id="m-is"><rect width="24" height="24" fill="#fff"/><path d="M7 8.5h6.5M7 12h6.5M7 15.5h4" stroke="#000" stroke-width="1.8" stroke-linecap="round" fill="none"/></mask><g stroke="none" mask="url(#m-is)"><rect x="3" y="3.5" width="14.5" height="17.5" rx="3"/></g><path fill="none" d="M17.5 8h1.3a1.7 1.7 0 0 1 1.7 1.7v8.3a2.5 2.5 0 0 1-2.5 2.5H6.5"/>',
  },
  review: {
    outline: '<circle cx="12" cy="12" r="8.6"/><path d="m8.3 12.3 2.6 2.6 5-5.6"/>',
    fill: '<mask id="m-rv"><rect width="24" height="24" fill="#fff"/><path d="m8.3 12.3 2.6 2.6 5-5.6" stroke="#000" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></mask><circle cx="12" cy="12" r="9.4" stroke="none" mask="url(#m-rv)"/>',
  },
  members: {
    outline: '<circle cx="9.3" cy="8.4" r="3.4"/><path d="M3.4 19.4c.5-3.4 2.9-5.4 5.9-5.4s5.4 2 5.9 5.4z"/><path d="M15.6 5.4a3 3 0 0 1 0 5.9M17.4 13.9c2 .6 3.3 2.4 3.6 5.1h-2.8"/>',
    fill: '<g stroke="none"><circle cx="9.3" cy="8.2" r="3.9"/><path d="M2.9 19.6c.5-3.8 3.1-6.1 6.4-6.1s5.9 2.3 6.4 6.1c.1.6-.4 1.1-1 1.1H3.9c-.6 0-1.1-.5-1-1.1z"/></g><path fill="none" d="M15.6 4.9a3.3 3.3 0 0 1 0 6.6M17.6 13.7c2.1.7 3.4 2.6 3.7 5.4"/>',
  },
};

const GLYPH = {
  signal: '<circle cx="12" cy="12" r="2"/><path d="M8.2 8.2a5.4 5.4 0 0 0 0 7.6M15.8 8.2a5.4 5.4 0 0 1 0 7.6M5.3 5.3a9.5 9.5 0 0 0 0 13.4M18.7 5.3a9.5 9.5 0 0 1 0 13.4"/>',
  refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4h-4"/>',
  wechat: '<path d="M9.5 5C5.9 5 3 7.4 3 10.4c0 1.7.9 3.2 2.4 4.2l-.6 2 2.3-1.2c.8.2 1.6.4 2.4.4"/><path d="M15 9.5c-3.3 0-6 2.2-6 5s2.7 5 6 5c.7 0 1.4-.1 2-.3l2 1.1-.5-1.8c1.3-.9 2.5-2.3 2.5-4 0-2.8-2.7-5-6-5z"/>',
  layout: '<rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M4 9.5h16M9.5 9.5V20"/>',
  weekly: '<rect x="4" y="5.5" width="16" height="14.5" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/><path d="M10 13h4l-2.3 4.6"/>',
  monthly: '<rect x="4" y="5.5" width="16" height="14.5" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/><circle cx="8.5" cy="13.6" r=".4"/><circle cx="12" cy="13.6" r=".4"/><circle cx="15.5" cy="13.6" r=".4"/><circle cx="8.5" cy="16.8" r=".4"/><circle cx="12" cy="16.8" r=".4"/>',
  roster: '<rect x="4.5" y="3.5" width="15" height="17" rx="2.8"/><circle cx="12" cy="9.6" r="2.4"/><path d="M8.3 16c.6-1.9 2-2.9 3.7-2.9s3.1 1 3.7 2.9"/>',
  review: '<path d="m6.5 12.5 3.6 3.6 7.6-8.2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3.3v2.4M12 18.3v2.4M20.7 12h-2.4M5.7 12H3.3M18.2 5.8l-1.7 1.7M7.5 16.5l-1.7 1.7M18.2 18.2l-1.7-1.7M7.5 7.5 5.8 5.8"/>',
  search: '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 4.5 4.5"/>',
  sparkles: '<path d="M10 4.5 11.6 9l4.4 1.6-4.4 1.6L10 16.7 8.4 12.2 4 10.6 8.4 9z"/><path d="M17.3 14.2l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
  link: '<path d="M10.2 13.8a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1.2 1.2"/><path d="M13.8 10.2a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1.2-1.2"/>',
  doc: '<path d="M7 3.5h6.5L18 8v11a1.5 1.5 0 0 1-1.5 1.5h-9.5A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5z"/><path d="M13.5 3.5V8H18M8.8 12.5h6.4M8.8 16h4.2"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>',
  key: '<circle cx="8.5" cy="12" r="3.8"/><path d="M12.3 12H20.5M17.5 12v3M20 12v2.2"/>',
  slider: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  person: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5.5 19.5c.7-3.6 3.3-5.6 6.5-5.6s5.8 2 6.5 5.6"/>',
  bolt: '<path d="M13 3.5 6 13.2h5.4L10.6 20.5 18 10.6h-5.4z"/>',
  plus: '<path d="M12 6v12M6 12h12"/>',
  minus: '<path d="M6 12h12"/>',
  swap: '<path d="M5 9h13l-3.5-3.5M19 15H6l3.5 3.5"/>',
  building: '<path d="M5 20V6.5L12 4v16M12 9.5l7 2.5v8M3.5 20h17M8 9h1M8 12.5h1M8 16h1M15.5 15h1"/>',
  chart: '<path d="M5 19.5V13M10 19.5V8.5M15 19.5V11M20 19.5V4.5"/>',
  shield: '<path d="M12 3.5 5.5 6v5.6c0 4 2.7 7.2 6.5 8.9 3.8-1.7 6.5-4.9 6.5-8.9V6z"/><path d="m9.2 12 2 2 3.8-4.2"/>',
  tray: '<path d="M4 13.5 6.5 5.5h11l2.5 8v5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5z"/><path d="M4 13.5h4.3l1.2 2h5l1.2-2H20"/>',
  share: '<path d="M12 3.5v11M8 7.5l4-4 4 4"/><path d="M8.5 10.5H7A1.5 1.5 0 0 0 5.5 12v6.5A1.5 1.5 0 0 0 7 20h10a1.5 1.5 0 0 0 1.5-1.5V12a1.5 1.5 0 0 0-1.5-1.5h-1.5"/>',
  pencil: '<path d="M15.5 4.5 19.5 8.5 9 19H5v-4z"/><path d="m13.5 6.5 4 4"/>',
  copy: '<rect x="8" y="8" width="11.5" height="11.5" rx="2.2"/><path d="M5.5 15.5h-.2A1.8 1.8 0 0 1 3.5 13.7V5.3A1.8 1.8 0 0 1 5.3 3.5h8.4a1.8 1.8 0 0 1 1.8 1.8v.2"/>',
  globe: '<circle cx="12" cy="12" r="8.2"/><path d="M3.8 12h16.4M12 3.8c2.3 2.3 3.4 5 3.4 8.2s-1.1 5.9-3.4 8.2c-2.3-2.3-3.4-5-3.4-8.2S9.7 6.1 12 3.8z"/>',
  bell: '<path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5z"/><path d="M10 20.5h4"/>',
  info: '<circle cx="12" cy="12" r="8.2"/><path d="M12 11v5.5M12 7.8v.2"/>',
};

/** 线性：fill none；实心：shape 自带 stroke="none" 时使用填充色。 */
const line = (d, color, sw = 1.8) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const solid = (d, color, sw = 1.8) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><g fill="${color}">${d.replace(/<g stroke="none"/g, `<g stroke="none" fill="${color}"`).replace(/stroke="none" mask/g, `stroke="none" fill="${color}" mask`)}</g></svg>`;

module.exports = { TAB, GLYPH, line, solid };
