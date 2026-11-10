const app = getApp();
const api = require('../../utils/api');
const { decorateIssue } = require('../../utils/format');

Page({
  data: {
    statusBar: 20, loaded: false, role: null, bootstrapable: false, openid: '',
    today: '', weekly: null, monthly: null, memberCount: 0, pendingReview: 0, publishedCount: 0, changes: [],
    changeName: { added: '新增', removed: '离任', role_changed: '身份', org_changed: '单位', reactivated: '恢复' },
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
      this.setData({ role: user.role, bootstrapable: user.bootstrapable, openid: user.openid, loaded: true });
      if (!user.role) return;
      const d = await api.call('dashboard');
      const weekly = decorateIssue(d.weekly);
      this.setData({
        today: d.today, weekly, monthly: decorateIssue(d.monthly), memberCount: d.memberCount, pendingReview: d.pendingReview,
        changes: d.changes, publishedCount: d.recent.filter((i) => i.status === 'published').length,
      });
      if (weekly) app.globalData.currentIssueId = weekly._id;
      if (weekly && weekly.status === 'collecting') this.startPump(weekly._id); else this.stopPump();
    } catch (e) { this.setData({ loaded: true }); }
  },

  /** 页面可见期间主动推进采集队列（定时触发器每分钟也会推进）。 */
  startPump(id) {
    if (this.pumping) return;
    this.pumping = true;
    const loop = async () => {
      if (!this.pumping) return;
      try { await api.call('issue.pump', { id }, { silent: true }); } catch (e) { /* 忽略，下一轮重试 */ }
      const d = await api.call('dashboard', {}, { silent: true }).catch(() => null);
      if (d) this.setData({ weekly: decorateIssue(d.weekly), pendingReview: d.pendingReview });
      if (d && d.weekly && d.weekly.status !== 'collecting') { this.pumping = false; return; }
      this.timer = setTimeout(loop, 3000);
    };
    loop();
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
      confirmText: '开始采集', confirmColor: '#1B2B48',
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
});
