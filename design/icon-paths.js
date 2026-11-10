/** 线性图标路径（24×24 视口），图标 PNG 与设计稿共用。 */
const PATHS = {
  home: '<path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/>',
  issues: '<rect x="5" y="3.5" width="12" height="16" rx="1.5"/><path d="M8.5 8h5M8.5 11.5h5M8.5 15h3"/><path d="M19 7v13a1 1 0 0 1-1 1H8"/>',
  review: '<path d="M5 4.5h10.5L19 8v11.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-14a1 1 0 0 1 1-1z"/><path d="m8.5 13 2.5 2.5 5-5"/>',
  members: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19.5c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="16.5" cy="9" r="2.4"/><path d="M15.5 14.6c2.6-.3 4.5 1.3 5 4.4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M18 6l-1.6 1.6M7.6 16.4 6 18M18 18l-1.6-1.6M7.6 7.6 6 6"/>',
  weekly: '<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/><path d="M10 13.5h4l-2.4 4.5"/>',
  monthly: '<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/><path d="M8 13.5h2M11 13.5h2M14 13.5h2M8 16.5h2M11 16.5h2"/>',
  roster: '<rect x="4.5" y="3.5" width="15" height="17" rx="2"/><circle cx="12" cy="9.5" r="2.3"/><path d="M8.5 15.5c.6-1.8 1.9-2.7 3.5-2.7s2.9.9 3.5 2.7"/>',
  reviewq: '<path d="M14.5 4.5 19.5 9.5 10 19H5v-5z"/><path d="m12.5 6.5 5 5"/>',
  search: '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 4.5 4.5"/>',
};

const svg = (d, color, sw = 1.6) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

module.exports = { PATHS, svg };
