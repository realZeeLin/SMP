const api = require('../../utils/api');
const samples = require('../../data/samples');

const SCOPES = [
  { key: 'org', name: '专委会', desc: '专委会新闻与社媒派SMP 公众号（约 5 次检索）' },
  { key: 'core', name: '核心委员', desc: '另加主任、副主任、常务委员等核心层委员（每人 1 次检索）' },
  { key: 'all', name: '全体委员', desc: '另加全体在任委员（每人 1 次检索，需管理员）' },
];

Page({
  data: {
    scopes: SCOPES, scope: 'org', scopeDesc: SCOPES[0].desc, dayOptions: [3, 7, 30], days: 7,
    est: { queries: 5, usd: 0 }, job: null, status: {}, urls: '',
    samples: { weekly: samples.weekly.count, monthly: samples.monthly.count },
  },

  onShow() { this.loadStatus(); },
  onHide() { this.stopPump(); },
  onUnload() { this.stopPump(); },

  async loadStatus() {
    const st = await api.call('feed.status');
    this.setData({ status: st });
    this.updateEstimate();
    this.showJob(st.jobs[0]);
    if (st.jobs[0] && st.jobs[0].status === 'running') this.startPump();
  },

  updateEstimate() {
    const e = (this.data.status.estimates || {})[this.data.scope];
    if (e) this.setData({ est: { queries: e.queries, usd: e.usd.toFixed(2) } });
  },

  showJob(job) {
    if (!job) { this.setData({ job: null }); return; }
    const p = job.progress || {};
    this.setData({ job: { ...job, pct: p.tasks ? Math.round((p.done / p.tasks) * 100) : 100, scopeName: (SCOPES.find((s) => s.key === job.scope) || {}).name || job.scope } });
  },

  pickScope(e) {
    const s = SCOPES.find((x) => x.key === e.currentTarget.dataset.k);
    this.setData({ scope: s.key, scopeDesc: s.desc });
    this.updateEstimate();
  },
  pickDays(e) { this.setData({ days: Number(e.currentTarget.dataset.d) }); },

  refresh() {
    if (this.data.job && this.data.job.status === 'running') return;
    wx.showModal({
      title: '拉取最新动态',
      content: `范围：${SCOPES.find((s) => s.key === this.data.scope).name}，近 ${this.data.days} 天，约 ${this.data.est.queries} 次 DeepSeek 检索。`,
      confirmText: '开始',
      success: async ({ confirm }) => {
        if (!confirm) return;
        const r = await api.call('feed.refresh', { scope: this.data.scope, days: this.data.days }, { loading: '创建任务' });
        if (r.existed) wx.showToast({ title: '已有任务在进行', icon: 'none' });
        this.loadStatus();
      },
    });
  },

  /** 页面打开期间持续推进拉取任务（定时触发器每分钟也会推进）。 */
  startPump() {
    if (this.pumping) return;
    this.pumping = true;
    const loop = async () => {
      if (!this.pumping) return;
      await api.call('feed.pump', {}, { silent: true }).catch(() => null);
      const st = await api.call('feed.status', {}, { silent: true }).catch(() => null);
      if (st) { this.setData({ status: st }); this.showJob(st.jobs[0]); }
      if (!st || !st.jobs[0] || st.jobs[0].status !== 'running') { this.pumping = false; return; }
      this.timer = setTimeout(loop, 2000);
    };
    loop();
  },
  stopPump() { this.pumping = false; clearTimeout(this.timer); },

  onUrls(e) { this.setData({ urls: e.detail.value }); },
  async importUrls() {
    if (!this.data.urls.trim()) { wx.showToast({ title: '请先粘贴文章链接', icon: 'none' }); return; }
    const r = await api.call('feed.import', { urls: this.data.urls, own: true }, { loading: '抓取中' });
    const ok = r.results.filter((x) => x.ok).length;
    const fail = r.results.filter((x) => !x.ok);
    wx.showModal({ title: `导入 ${ok} 篇`, content: fail.length ? fail.map((x) => `${x.url}\n${x.error || '未通过过滤'}`).join('\n\n') : '已进入动态信息流', showCancel: false });
    if (ok) this.setData({ urls: '' });
    this.loadStatus();
  },
  async pullWechat() {
    if (!this.data.status.wechatConfigured) {
      wx.showModal({ title: '未配置公众号接口', content: '在云函数 smp 的环境变量中配置 WX_MP_APPID / WX_MP_SECRET（社媒派SMP 公众号的开发者凭证），并在公众号后台把云函数出口 IP 加入白名单。也可以直接粘贴文章链接导入。', showCancel: false });
      return;
    }
    const r = await api.call('feed.pullWechat', {}, { loading: '同步中' });
    wx.showToast({ title: `同步 ${r.synced} 篇`, icon: 'success' });
    this.loadStatus();
  },

  openSample(e) { wx.navigateTo({ url: `/pages/sample/index?kind=${e.currentTarget.dataset.k}` }); },
  go(e) { wx.navigateTo({ url: e.currentTarget.dataset.u }); },
  goFeed() { wx.switchTab({ url: '/pages/feed/index' }); },
});
