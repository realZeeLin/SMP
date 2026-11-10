const api = require('../../utils/api');
const { ROLE_SHORT } = require('../../utils/format');

Page({
  data: { statusBar: 20, q: '', role: '', roles: [], sections: [], total: 0, loaded: false },

  onLoad() {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    this.setData({ statusBar: info.statusBarHeight || 20 });
    this.load();
  },
  async onPullDownRefresh() { await this.load(); wx.stopPullDownRefresh(); },
  onInput(e) {
    this.setData({ q: e.detail.value });
    clearTimeout(this.t);
    this.t = setTimeout(() => this.load(), 350);
  },
  onSearch() { this.load(); },
  pickRole(e) { this.setData({ role: e.currentTarget.dataset.r }); this.load(); },

  /** 通讯录式：按拼音首字母分组，一次加载全部（约 400 人，100/页）。 */
  async load() {
    const token = (this.token = (this.token || 0) + 1);
    let page = 0; let all = []; let r;
    do {
      r = await api.call('member.list', { q: this.data.q.trim(), role: this.data.role, page, pageSize: 100, sort: 'initial' });
      all = all.concat(r.list);
      page++;
    } while (r.hasMore && token === this.token);
    if (token !== this.token) return;
    const groups = {};
    all.forEach((m) => {
      const k = /^[A-Z]$/.test(m.initial) ? m.initial : '#';
      (groups[k] = groups[k] || []).push({ ...m, char: m.name.slice(0, 1), roleText: ROLE_SHORT[m.roles[0]] || m.roles[0],
        homonym: !!(m.auto && m.auto.homonyms && m.auto.homonyms.length) });
    });
    const keys = Object.keys(groups).sort((a, b) => (a === '#') - (b === '#') || a.localeCompare(b));
    this.setData({ sections: keys.map((k) => ({ key: k, list: groups[k] })), total: r.total, roles: r.roles, loaded: true });
  },

  jump(e) { wx.pageScrollTo({ selector: `#sec-${e.currentTarget.dataset.k}`, duration: 0 }); wx.vibrateShort({ type: 'light' }); },
  open(e) { wx.navigateTo({ url: `/pages/member/index?id=${e.currentTarget.dataset.id}` }); },
  goRoster() { wx.navigateTo({ url: '/pages/roster/index' }); },
});
