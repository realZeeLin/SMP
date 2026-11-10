const samples = require('../../data/samples');
const { CATEGORY } = require('../../utils/format');

Page({
  data: { kind: 'weekly', mode: 'draft', s: null, colors: Object.fromEntries(Object.entries(CATEGORY).map(([k, v]) => [k, v.color])) },
  onLoad({ kind }) { this.show(kind === 'monthly' ? 'monthly' : 'weekly'); },
  show(kind) {
    const s = samples[kind];
    wx.setNavigationBarTitle({ title: kind === 'weekly' ? '周报示例' : '月报示例' });
    this.setData({ kind, s });
  },
  pickKind(e) { this.show(e.currentTarget.dataset.k); },
  pickMode(e) { this.setData({ mode: e.currentTarget.dataset.m }); },
  copySource() { wx.setClipboardData({ data: this.data.s.source.url }); },
  copyMarkdown() { wx.setClipboardData({ data: this.data.s.markdown }); },
});
