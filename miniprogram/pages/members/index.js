const api = require('../../utils/api');
const { ROLE_SHORT } = require('../../utils/format');

Page({
  data: { q: '', role: '', roles: [], list: [], total: 0, page: 0, hasMore: false, loaded: false },
  onLoad() { this.load(true); },
  async onPullDownRefresh() { await this.load(true); wx.stopPullDownRefresh(); },
  onReachBottom() { if (this.data.hasMore) this.load(false); },
  onInput(e) {
    this.setData({ q: e.detail.value });
    clearTimeout(this.t);
    this.t = setTimeout(() => this.load(true), 400);
  },
  onSearch() { this.load(true); },
  pickRole(e) { this.setData({ role: e.currentTarget.dataset.r }); this.load(true); },
  async load(reset) {
    const page = reset ? 0 : this.data.page + 1;
    const r = await api.call('member.list', { q: this.data.q.trim(), role: this.data.role, page });
    const list = r.list.map((m) => ({ ...m, char: m.name.slice(0, 1), roleText: ROLE_SHORT[m.roles[0]] || m.roles[0],
      pct: Math.round((m.completeness || 0) * 100), homonym: m.auto && m.auto.homonyms && m.auto.homonyms.length > 0 }));
    this.setData({ list: reset ? list : this.data.list.concat(list), total: r.total, roles: r.roles, page, hasMore: r.hasMore, loaded: true });
  },
  open(e) { wx.navigateTo({ url: `/pages/member/index?id=${e.currentTarget.dataset.id}` }); },
  goRoster() { wx.navigateTo({ url: '/pages/roster/index' }); },
});
