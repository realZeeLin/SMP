const api = require('../../utils/api');

const pad = (n) => String(n).padStart(2, '0');
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

Page({
  data: { text: '', lines: 0, effective: today(), source: '', preview: null, versions: [],
    typeName: { added: '新增', removed: '离任', role_changed: '身份', org_changed: '单位', reactivated: '恢复' } },

  onShow() { this.loadVersions(); },
  async loadVersions() { const r = await api.call('roster.versions'); this.setData({ versions: r.list }); },

  onText(e) { this.setData({ text: e.detail.value, lines: e.detail.value.split('\n').filter((l) => l.trim()).length, preview: null }); },
  onDate(e) { this.setData({ effective: e.detail.value, preview: null }); },
  onSource(e) { this.setData({ source: e.detail.value }); },
  pasteClipboard() {
    wx.getClipboardData({ success: ({ data }) => this.onText({ detail: { value: data } }) });
  },

  async doPreview() {
    if (!this.data.text.trim()) { wx.showToast({ title: '请先粘贴名单', icon: 'none' }); return; }
    const r = await api.call('roster.preview', { text: this.data.text, effective: this.data.effective }, { loading: '解析中' });
    r.changes = r.changes.map((c) => ({ ...c, desc: c.type === 'added' ? `${c.after.org} · ${c.after.roles.join('/')}`
      : c.type === 'removed' ? c.before.org : c.type === 'role_changed' ? `${c.before.join('/')} → ${c.after.join('/')}`
        : c.type === 'org_changed' ? `${c.before} → ${c.after}` : '' }));
    this.setData({ preview: r });
  },

  apply() {
    if (!this.data.preview) return;
    const s = this.data.preview.summary;
    wx.showModal({
      title: '确认导入名单',
      content: `新增 ${s.added} 人，离任 ${s.removed} 人，身份变化 ${s.roleChanged} 人，单位变化 ${s.orgChanged} 人。离任委员的画像与历史将保留。`,
      confirmText: '确认导入', confirmColor: '#1B2B48',
      success: async ({ confirm }) => {
        if (!confirm) return;
        await api.call('roster.apply', { text: this.data.text, effective: this.data.effective, source: this.data.source }, { loading: '导入中' });
        wx.showToast({ title: '名单已更新', icon: 'success' });
        this.setData({ preview: null, text: '', lines: 0 });
        this.loadVersions();
      },
    });
  },
});
