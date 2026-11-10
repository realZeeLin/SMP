const api = require('../../utils/api');
const { CATEGORY, cnDate } = require('../../utils/format');

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function dayLabel(day) {
  if (!day) return '日期未知';
  const t = new Date();
  const y = new Date(Date.now() - 86400e3);
  if (day === ymd(t)) return '今天';
  if (day === ymd(y)) return '昨天';
  return day.slice(0, 4) === String(t.getFullYear()) ? cnDate(day) : `${day.slice(0, 4)}年${cnDate(day)}`;
}

Page({
  data: { statusBar: 20, q: '', filter: 'all', list: [], groups: [], total: 0, page: 0, hasMore: false, loaded: false, job: null },

  onLoad() {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    this.setData({ statusBar: info.statusBarHeight || 20 });
  },
  onShow() { this.load(true); this.watchJob(); },
  onHide() { this.stopWatch(); },
  onUnload() { this.stopWatch(); },
  async onPullDownRefresh() { await this.load(true); wx.stopPullDownRefresh(); },
  onReachBottom() { if (this.data.hasMore) this.load(false); },

  onInput(e) {
    this.setData({ q: e.detail.value });
    clearTimeout(this.t);
    this.t = setTimeout(() => this.load(true), 350);
  },
  onSearch() { this.load(true); },
  pickFilter(e) { this.setData({ filter: e.currentTarget.dataset.f }); this.load(true); },

  async load(reset) {
    const page = reset ? 0 : this.data.page + 1;
    const r = await api.call('feed.list', { q: this.data.q.trim(), filter: this.data.filter, page });
    const items = r.list.map((x) => {
      const c = CATEGORY[x.category] || CATEGORY.other;
      return { ...x, catName: x.fromSmpAccount && x.category === 'org' ? '专委会' : c.name, catColor: c.color, day: x.published || '' };
    });
    const list = reset ? items : this.data.list.concat(items);
    const groups = [];
    list.forEach((x) => {
      const last = groups[groups.length - 1];
      if (last && last.day === x.day) last.list.push(x); else groups.push({ day: x.day, label: dayLabel(x.day), list: [x] });
    });
    this.setData({ list, groups, total: r.total, page, hasMore: r.hasMore, loaded: true });
  },

  /** 有拉取任务在跑时，页面可见期间顺带推进队列并显示进度。 */
  async watchJob() {
    if (this.watching) return;
    this.watching = true;
    const loop = async () => {
      if (!this.watching) return;
      const st = await api.call('feed.status', {}, { silent: true }).catch(() => null);
      const job = st && st.jobs.find((j) => j.status === 'running');
      this.setData({ job: job ? { ...job, pct: job.progress.tasks ? Math.round((job.progress.done / job.progress.tasks) * 100) : 0 } : null });
      if (!job) { this.watching = false; return; }
      await api.call('feed.pump', {}, { silent: true }).catch(() => null);
      this.load(true);
      this.timer = setTimeout(loop, 2500);
    };
    loop();
  },
  stopWatch() { this.watching = false; clearTimeout(this.timer); },

  open(e) {
    const item = this.data.list.find((x) => x._id === e.currentTarget.dataset.i);
    if (!item) return;
    const actions = ['复制原文链接'].concat(item.memberIds && item.memberIds.length ? item.memberNames.map((n) => `查看委员：${n}`) : []);
    wx.showActionSheet({
      itemList: actions,
      success: ({ tapIndex }) => {
        if (tapIndex === 0) wx.setClipboardData({ data: item.url });
        else wx.navigateTo({ url: `/pages/member/index?id=${item.memberIds[tapIndex - 1]}` });
      },
    });
  },
  goAdmin() { wx.navigateTo({ url: '/pages/admin/index' }); },
});
