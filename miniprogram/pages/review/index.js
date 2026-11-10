const app = getApp();
const api = require('../../utils/api');
const { decorateIssue, decorateEvent, DECISION } = require('../../utils/format');

Page({
  data: {
    statusBar: 20, issue: null, tab: 'review', tabs: [], list: [], page: 0, hasMore: false, loaded: false,
    slideButtons: [{ text: '保留', extClass: 'sv-keep', data: 'keep' }, { type: 'warn', text: '剔除', extClass: 'sv-drop', data: 'drop' }],
  },

  onLoad() {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    this.setData({ statusBar: info.statusBarHeight || 20 });
  },

  async onShow() {
    let id = app.globalData.currentIssueId;
    if (!id) {
      const r = await api.call('issue.list', {});
      const cand = r.list.find((i) => i.status === 'reviewing') || r.list[0];
      id = cand && cand._id;
    }
    if (!id) { this.setData({ loaded: true, issue: null }); return; }
    await this.loadIssue(id);
  },
  async onPullDownRefresh() { if (this.data.issue) await this.loadIssue(this.data.issue._id); wx.stopPullDownRefresh(); },

  async loadIssue(id) {
    const { issue } = await api.call('issue.get', { id });
    const d = decorateIssue(issue);
    const s = issue.stats || {};
    const filteredN = Object.values(s.filtered || {}).reduce((a, b) => a + b, 0);
    this.setData({
      issue: d,
      tabs: [
        { key: 'review', name: '待复核', n: s.needsReview || 0 },
        { key: 'selected', name: '入选', n: issue.count || s.selected || 0 },
        { key: 'candidates', name: '候选', n: Math.max(0, (s.events || 0) - (s.selected || 0)) },
        { key: 'filtered', name: '已过滤', n: filteredN },
      ],
    });
    await this.load(true);
  },

  switchTab(e) { this.setData({ tab: e.currentTarget.dataset.k }); this.load(true); },
  loadMore() { this.load(false); },

  async load(reset) {
    const page = reset ? 0 : this.data.page + 1;
    const r = await api.call('event.list', { issueId: this.data.issue._id, tab: this.data.tab, page });
    const list = this.data.tab === 'filtered' ? r.list.map((x) => ({ ...x, memberNames: (x.memberNames || []).join('、') })) : r.list.map(decorateEvent);
    this.setData({ list: reset ? list : this.data.list.concat(list), page, hasMore: r.hasMore, loaded: true });
  },

  onSlide(e) {
    this.decide({ currentTarget: { dataset: { id: e.currentTarget.dataset.id, d: e.detail.data } } });
  },

  async decide(e) {
    const { id, d } = e.currentTarget.dataset;
    await api.call('event.decide', { id, decision: d });
    const list = this.data.list.map((x) => (x._id === id ? { ...x, decision: d, decisionName: DECISION[d], needsReview: d === 'keep' || d === 'confirm' || d === 'wrong_person' ? false : x.needsReview } : x));
    this.setData({ list, 'issue.dirty': true });
    wx.showToast({ title: DECISION[d], icon: 'none', duration: 800 });
  },

  async reanalyze() {
    await api.call('issue.analyze', { id: this.data.issue._id }, { loading: '重新编排中' });
    await this.loadIssue(this.data.issue._id);
    wx.showToast({ title: '已更新稿件', icon: 'success' });
  },

  async pickIssue() {
    const r = await api.call('issue.list', {});
    const list = r.list.map(decorateIssue).slice(0, 6);
    wx.showActionSheet({
      itemList: list.map((i) => `${i.kindName} ${i.no}（${i.range}）`),
      success: ({ tapIndex }) => { app.globalData.currentIssueId = list[tapIndex]._id; this.loadIssue(list[tapIndex]._id); },
    });
  },

  open(e) { wx.navigateTo({ url: `/pages/event/index?id=${e.currentTarget.dataset.id}` }); },
});
