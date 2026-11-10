const app = getApp();
const api = require('../../utils/api');
const { CATEGORY, decorateIssue, decorateEvent } = require('../../utils/format');

const ORDER = ['org', 'honor', 'research', 'project', 'activity', 'service', 'influence', 'other'];

Page({
  data: { id: '', issue: null, events: [], sections: [], mode: 'draft' },

  onLoad({ id }) { this.setData({ id }); app.globalData.currentIssueId = id; },
  onShow() { this.load(); },
  async onPullDownRefresh() { await this.load(); wx.stopPullDownRefresh(); },

  async load() {
    const r = await api.call('issue.get', { id: this.data.id });
    const issue = decorateIssue(r.issue);
    const events = r.events.map(decorateEvent);
    const order = (issue.sections || []).map((s) => s.key);
    const keys = order.length ? order : ORDER;
    const sections = keys.map((k, i) => ({ key: k, name: CATEGORY[k].name, no: String(i + 1).padStart(2, '0'), events: events.filter((e) => e.category === k) }))
      .filter((s) => s.events.length);
    wx.setNavigationBarTitle({ title: `${issue.kindName} · ${issue.no}` });
    this.setData({ issue, events, sections });
  },

  switchMode(e) { this.setData({ mode: e.currentTarget.dataset.m }); },
  openEvent(e) { wx.navigateTo({ url: `/pages/event/index?id=${e.currentTarget.dataset.id}` }); },
  goReview() { app.globalData.currentIssueId = this.data.id; wx.switchTab({ url: '/pages/review/index' }); },

  async reanalyze() {
    await api.call('issue.analyze', { id: this.data.id }, { loading: '重新编排中' });
    wx.showToast({ title: '已更新', icon: 'success' });
    this.load();
  },

  async exportIssue() {
    wx.showActionSheet({
      itemList: ['复制公众号 HTML 下载链接（电脑端打开后全选复制）', '复制 Markdown 稿件'],
      success: async ({ tapIndex }) => {
        const r = await api.call('issue.export', { id: this.data.id }, { loading: '导出中' });
        wx.setClipboardData({ data: tapIndex === 0 ? r.url : r.markdown });
      },
    });
  },

  publish() {
    if (this.data.issue.status === 'published') return;
    const n = this.data.events.filter((e) => e.needsReview).length;
    wx.showModal({
      title: '定稿发布',
      content: `${n ? `仍有 ${n} 条人物待确认。` : ''}发布后本期条目将进入归档，用于后续跨期去重与委员画像时间线。`,
      confirmText: '发布',
      success: async ({ confirm }) => {
        if (!confirm) return;
        await api.call('issue.publish', { id: this.data.id }, { loading: '发布中' });
        wx.showToast({ title: '已发布', icon: 'success' });
        this.load();
      },
    });
  },
});
