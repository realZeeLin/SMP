const app = getApp();
const api = require('../../utils/api');
const { decorateIssue } = require('../../utils/format');

Page({
  data: {
    statusBar: 20, loaded: false, role: null, bootstrapable: false, openid: '',
    today: '', weekly: null, monthly: null, memberCount: 0, pendingReview: 0, publishedCount: 0, changes: [],
    dateText: '', meChar: '我', rings: [0, 0, 0], errorMsg: '',
    changeMeta: {
      added: { name: '新增委员', glyph: 'plus', color: '#34C759' },
      removed: { name: '离任', glyph: 'minus', color: '#FF3B30' },
      role_changed: { name: '身份变更', glyph: 'swap', color: '#007AFF' },
      org_changed: { name: '单位变更', glyph: 'building', color: '#FF9500' },
      reactivated: { name: '重新入选', glyph: 'plus', color: '#30B0C7' },
    },
  },

  onLoad() {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    this.setData({ statusBar: info.statusBarHeight || 20 });
  },

  async onShow() {
    await this.refresh();
  },
  onHide() { this.stopPump(); },
  onUnload() { this.stopPump(); },
  async onPullDownRefresh() { await this.refresh(true); wx.stopPullDownRefresh(); },

  async refresh(force = false) {
    try {
      const user = await app.ensureUser(force);
      this.setData({ errorMsg: '', role: user.role, bootstrapable: user.bootstrapable, openid: user.openid, loaded: true, meChar: (user.name || '我').slice(0, 1) });
      if (!user.role) return;
      const d = await api.call('dashboard');
      const weekly = decorateIssue(d.weekly);
      const wk = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][new Date(`${d.today}T00:00:00`).getDay()];
      this.setData({
        today: d.today, dateText: `${+d.today.slice(5, 7)}月${+d.today.slice(8, 10)}日 ${wk}`, rings: this.calcRings(weekly), weekly, monthly: decorateIssue(d.monthly), memberCount: d.memberCount, pendingReview: d.pendingReview,
        changes: d.changes, publishedCount: d.recent.filter((i) => i.status === 'published').length,
      });
      if (weekly) app.globalData.currentIssueId = weekly._id;
      if (weekly && weekly.status === 'collecting') this.startPump(weekly._id); else this.stopPump();
    } catch (e) {
      // 把真实原因显示出来（如环境不匹配 -501000、缺少依赖、超时等）
      const msg = (e && (e.errMsg || e.message)) || String(e);
      this.setData({ loaded: true, errorMsg: msg });
      console.error('[smp] 调用云函数失败', e);
    }
  },
  retry() { this.refresh(true); },
  copyError() { wx.setClipboardData({ data: this.data.errorMsg }); },

  /** 页面可见期间主动推进采集队列（定时触发器每分钟也会推进）。 */
  startPump(id) {
    if (this.pumping) return;
    this.pumping = true;
    const loop = async () => {
      if (!this.pumping) return;
      try { await api.call('issue.pump', { id }, { silent: true }); } catch (e) { /* 忽略，下一轮重试 */ }
      const d = await api.call('dashboard', {}, { silent: true }).catch(() => null);
      if (d) { const w = decorateIssue(d.weekly); this.setData({ weekly: w, rings: this.calcRings(w), pendingReview: d.pendingReview }); }
      if (d && d.weekly && d.weekly.status !== 'collecting') { this.pumping = false; return; }
      this.timer = setTimeout(loop, 3000);
    };
    loop();
  },
  /** 三环：采集进度 / 入选（相对 50 条上限）/ 已复核比例。 */
  calcRings(w) {
    if (!w) return [0, 0, 0];
    const s = w.stats || {};
    const sel = w.count || s.selected || 0;
    return [w.percent, Math.min(100, Math.round((sel / 50) * 100)), sel ? Math.round((1 - (s.needsReview || 0) / sel) * 100) : 0];
  },
  stopPump() { this.pumping = false; clearTimeout(this.timer); },

  async bootstrap() {
    await api.call('auth.bootstrap', {}, { loading: '初始化中' });
    wx.showToast({ title: '初始化完成', icon: 'success' });
    this.refresh(true);
  },
  copyOpenid() { wx.setClipboardData({ data: this.data.openid }); },

  start(e) {
    const kind = e.currentTarget.dataset.kind;
    wx.showModal({
      title: kind === 'weekly' ? '新建周报' : '新建月报',
      content: kind === 'weekly' ? '将检索上一个完整自然周的委员学术动态（约 470 次 DeepSeek 检索）。' : '将汇总上一个自然月：复用当月周报数据，并补充检索核心委员。',
      confirmText: '开始采集',
      success: async ({ confirm }) => {
        if (!confirm) return;
        const r = await api.call('issue.start', { kind }, { loading: '创建中' });
        if (r.existed) wx.showToast({ title: '本期已存在', icon: 'none' });
        this.refresh();
      },
    });
  },

  openIssue(e) { wx.navigateTo({ url: `/pages/issue/index?id=${e.currentTarget.dataset.id}` }); },
  openMember(e) { if (e.currentTarget.dataset.id) wx.navigateTo({ url: `/pages/member/index?id=${e.currentTarget.dataset.id}` }); },
  goRoster() { wx.navigateTo({ url: '/pages/roster/index' }); },
  goSettings() { wx.navigateTo({ url: '/pages/settings/index' }); },
  goReview() { wx.switchTab({ url: '/pages/review/index' }); },
  goMembers() { wx.switchTab({ url: '/pages/members/index' }); },
  goIssues() { wx.switchTab({ url: '/pages/issues/index' }); },
  openMonthly() {
    if (this.data.monthly) wx.navigateTo({ url: `/pages/issue/index?id=${this.data.monthly._id}` });
    else this.start({ currentTarget: { dataset: { kind: 'monthly' } } });
  },
});
