const api = require('../../utils/api');
const { CATEGORY, decorateEvent } = require('../../utils/format');

const FACTORS = [['type', '栏目'], ['level', '级别'], ['role', '委员身份'], ['authority', '信源权威'], ['coverage', '报道覆盖'], ['relevance', '领域相关'], ['recency', '时效']];
const STATUS = { confirmed: '已确认', ambiguous: '待确认', rejected: '已否定' };
const CATS = Object.keys(CATEGORY);

Page({
  data: { ev: null, headline: '', blurb: '', factors: [], catNames: CATS.map((k) => CATEGORY[k].name), catIndex: 0 },

  onLoad({ id }) { this.id = id; this.load(); },

  async load() {
    const { event, members } = await api.call('event.get', { id: this.id });
    const ev = decorateEvent(event);
    const orgOf = Object.fromEntries(members.map((m) => [m._id, m.org]));
    ev.memberEvidence = (ev.memberEvidence || []).map((m) => ({ ...m, org: orgOf[m.memberId] || '', initialChar: m.name.slice(0, 1),
      pct: Math.round(m.confidence * 100), statusName: STATUS[m.status] || m.status }));
    const d = ev.scoreDetail || {};
    this.setData({ ev, headline: ev.headline || ev.title, blurb: ev.blurb || '', catIndex: Math.max(0, CATS.indexOf(ev.category)),
      factors: FACTORS.map(([k, name]) => ({ k, name, v: (d[k] || 0).toFixed(2), pct: Math.round((d[k] || 0) * 100) })) });
  },

  onHeadline(e) { this.setData({ headline: e.detail.value }); },
  onBlurb(e) { this.setData({ blurb: e.detail.value }); },
  changeCat(e) { const i = +e.detail.value; this.setData({ catIndex: i, 'ev.category': CATS[i] }); },

  async save() {
    await api.call('event.edit', { id: this.id, headline: this.data.headline, blurb: this.data.blurb, category: CATS[this.data.catIndex] }, { loading: '保存中' });
    wx.showToast({ title: '已保存', icon: 'success' });
  },
  async drop() {
    const decision = this.data.ev.selected ? 'drop' : 'keep';
    await api.call('event.decide', { id: this.id, decision });
    wx.showToast({ title: decision === 'drop' ? '已剔除' : '已保留', icon: 'none' });
    this.setData({ 'ev.selected': decision === 'keep' });
  },
  openMember(e) { wx.navigateTo({ url: `/pages/member/index?id=${e.currentTarget.dataset.id}` }); },
  copyUrl(e) { wx.setClipboardData({ data: e.currentTarget.dataset.url }); },
});
