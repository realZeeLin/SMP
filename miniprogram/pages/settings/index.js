const api = require('../../utils/api');

const WEIGHT_NAMES = { type: '栏目', level: '级别', role: '委员身份', authority: '信源权威', coverage: '报道覆盖', relevance: '领域相关', recency: '时效' };

const setPath = (obj, path, v) => {
  const ks = path.split('.'); let cur = obj;
  ks.slice(0, -1).forEach((k) => { cur[k] = cur[k] || {}; cur = cur[k]; });
  cur[ks[ks.length - 1]] = v;
};

Page({
  data: { s: null, apiKey: false, admins: [], kinds: [], weights: [], weightSum: 0, confirmPct: 60, rejectPct: 40,
    weekdays: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] },

  onLoad() { this.load(); },

  async load() {
    const r = await api.call('settings.get');
    this.patch = {};
    this.render(r.settings);
    this.setData({ apiKey: r.apiKeyConfigured, admins: r.admins.map((a) => ({ ...a, char: (a.name || '编').slice(0, 1) })) });
  },

  render(s) {
    const weights = Object.entries(s.scoring.weights).map(([k, v]) => ({ k, name: WEIGHT_NAMES[k] || k, v: Math.round(v * 100) }));
    this.setData({ s, weights, weightSum: weights.reduce((a, b) => a + b.v, 0),
      kinds: [{ k: 'weekly', name: '周报', cfg: s.selection.weekly }, { k: 'monthly', name: '月报', cfg: s.selection.monthly }],
      confirmPct: Math.round(s.disambiguation.confirm_threshold * 100), rejectPct: Math.round(s.disambiguation.reject_threshold * 100) });
  },

  change(path, v) { setPath(this.patch, path, v); const s = this.data.s; setPath(s, path, v); this.render(s); },
  onStep(e) {
    const { path, d, min, max } = e.currentTarget.dataset;
    const cur = path.split('.').reduce((o, k) => o[k], this.data.s);
    this.change(path, Math.min(+max, Math.max(+min, cur + +d)));
  },
  onSwitch(e) { this.change(e.currentTarget.dataset.path, e.detail.value); },
  onNum(e) { this.change(e.currentTarget.dataset.path, Number(e.detail.value) || 0); },
  onPct(e) { this.change(e.currentTarget.dataset.path, e.detail.value / 100); },
  onPick(e) { this.change(e.currentTarget.dataset.path, Number(e.detail.value)); },
  onWeight(e) { this.change(`scoring.weights.${e.currentTarget.dataset.k}`, e.detail.value / 100); },

  async save() {
    if (Math.abs(this.data.weightSum - 100) > 1) { wx.showToast({ title: '权重合计应为 100%', icon: 'none' }); return; }
    await api.call('settings.update', { patch: this.patch }, { loading: '保存中' });
    wx.showToast({ title: '已保存', icon: 'success' });
    this.patch = {};
  },
  reset() { this.load(); },

  addAdmin() {
    wx.showModal({
      title: '添加编辑', editable: true, placeholderText: '粘贴对方在工作台看到的 OpenID',
      success: async ({ confirm, content }) => {
        if (!confirm || !content) return;
        await api.call('admin.add', { openid: content.trim(), name: '编辑', role: 'editor' });
        this.load();
      },
    });
  },
});
