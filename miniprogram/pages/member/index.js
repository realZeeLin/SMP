const api = require('../../utils/api');
const { CATEGORY } = require('../../utils/format');

const FORM = [
  { key: 'title', label: '职称 / 职务', ph: '如：教授、博士生导师、学院院长' },
  { key: 'department', label: '院系', ph: '如：计算机科学与技术学院' },
  { key: 'researchAreas', label: '研究方向（逗号分隔）', ph: '自然语言处理, 社会计算', list: true },
  { key: 'keywords', label: '特征关键词（逗号分隔，用于消歧）', ph: '实验室名、团队名、代表成果', list: true },
  { key: 'negativeKeywords', label: '同名排除词（逗号分隔）', ph: '如：演员, 足球', list: true },
  { key: 'aliases', label: '其他写法 / 英文名（逗号分隔）', ph: 'Jie Tang', list: true },
  { key: 'homepage', label: '个人主页', ph: 'https://' },
  { key: 'bio', label: '简介', ph: '80 字以内', multi: true },
];
const CHANGE = { added: '入选专委会', removed: '离任', reactivated: '重新入选', role_changed: '身份变更', org_changed: '单位变更' };

Page({
  data: { m: null, homonyms: [], timeline: [], history: [], editing: false, form: [], verified: false },

  onLoad({ id }) { this.id = id; this.load(); },

  async load() {
    const r = await api.call('member.get', { id: this.id });
    const m = r.member;
    m.char = m.name.slice(0, 1);
    m.pct = Math.round((m.completeness || 0) * 100);
    m.englishText = (m.auto.englishNames || []).join(' / ');
    const changes = r.changes.map((c) => ({ key: c._id, date: c.date, text: `${CHANGE[c.type] || c.type}${c.type === 'role_changed' ? `：${(c.before || []).join('/')} → ${(c.after || []).join('/')}` : ''}${c.type === 'org_changed' ? `：${c.before} → ${c.after}` : ''}` }));
    const orgs = (m.orgHistory || []).map((h, i) => ({ key: `org${i}`, date: h.since, text: `任职 ${h.org}${h.until ? `（至 ${h.until}）` : ''}` }));
    this.setData({
      m, homonyms: r.homonyms, history: changes.concat(orgs),
      timeline: r.timeline.map((t) => ({ ...t, color: (CATEGORY[t.category] || CATEGORY.other).color, glyph: (CATEGORY[t.category] || CATEGORY.other).glyph,
        issueName: t.issueId.startsWith('weekly') ? `周报 ${t.issueId.split('-W')[1]} 期` : `月报 ${t.issueId.slice(-7)}` })),
    });
  },

  toggleEdit() {
    const p = this.data.m.profile;
    this.setData({ editing: !this.data.editing, verified: !!p.verified,
      form: FORM.map((f) => ({ ...f, value: f.list ? (p[f.key] || []).join(', ') : (p[f.key] || '') })) });
  },
  onField(e) { this.setData({ [`form[${e.currentTarget.dataset.i}].value`]: e.detail.value }); },
  toggleVerified(e) { this.setData({ verified: e.detail.value }); },

  async save() {
    const profile = { verified: this.data.verified };
    this.data.form.forEach((f) => {
      profile[f.key] = f.list ? f.value.split(/[,，、;；]/).map((s) => s.trim()).filter(Boolean) : f.value.trim();
    });
    await api.call('member.update', { id: this.id, profile }, { loading: '保存中' });
    wx.showToast({ title: '已保存', icon: 'success' });
    this.setData({ editing: false });
    this.load();
  },

  async enrich() {
    const r = await api.call('member.enrich', { id: this.id }, { loading: 'DeepSeek 检索中' });
    wx.showModal({ title: 'AI 补全完成', content: r.fields.length ? `已补全：${r.fields.join('、')}。请核验后勾选“已人工核验”。` : '未找到可补全的信息。', showCancel: false });
    this.load();
  },

  copy(e) { if (e.currentTarget.dataset.v) wx.setClipboardData({ data: e.currentTarget.dataset.v }); },
});
