const api = require('../../utils/api');
const { decorateIssue } = require('../../utils/format');

Page({
  data: { kind: '', list: [], page: 0, hasMore: false, loaded: false },
  onShow() { this.load(true); },
  async onPullDownRefresh() { await this.load(true); wx.stopPullDownRefresh(); },
  switch(e) { this.setData({ kind: e.currentTarget.dataset.k }); this.load(true); },
  loadMore() { this.load(false); },
  async load(reset) {
    const page = reset ? 0 : this.data.page + 1;
    const r = await api.call('issue.list', { kind: this.data.kind, page });
    const list = r.list.map(decorateIssue);
    this.setData({ list: reset ? list : this.data.list.concat(list), page, hasMore: r.hasMore, loaded: true });
  },
  open(e) { wx.navigateTo({ url: `/pages/issue/index?id=${e.currentTarget.dataset.id}` }); },
});
