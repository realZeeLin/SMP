const api = require('../../utils/api');
const { decorateIssue } = require('../../utils/format');

Page({
  data: { statusBar: 20, kind: '', list: [], groups: [], page: 0, hasMore: false, loaded: false },
  onLoad() {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    this.setData({ statusBar: info.statusBarHeight || 20 });
  },
  onShow() { this.load(true); },
  async onPullDownRefresh() { await this.load(true); wx.stopPullDownRefresh(); },
  switch(e) { this.setData({ kind: e.currentTarget.dataset.k }); this.load(true); },
  loadMore() { this.load(false); },
  async load(reset) {
    const page = reset ? 0 : this.data.page + 1;
    const r = await api.call('issue.list', { kind: this.data.kind, page });
    const list = r.list.map(decorateIssue);
    const all = reset ? list : this.data.list.concat(list);
    const years = [...new Set(all.map((i) => i.year))];
    this.setData({ list: all, groups: years.map((y) => ({ year: y, list: all.filter((i) => i.year === y) })), page, hasMore: r.hasMore, loaded: true });
  },
  open(e) { wx.navigateTo({ url: `/pages/issue/index?id=${e.currentTarget.dataset.id}` }); },
});
