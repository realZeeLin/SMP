const api = require('./utils/api');

App({
  globalData: { user: null, currentIssueId: '' },

  onLaunch() {
    if (!wx.cloud) {
      wx.showModal({ title: '提示', content: '请使用 2.2.3 或以上的基础库以使用云能力', showCancel: false });
      return;
    }
    // env 留空表示使用开发者工具中选择的默认云环境；生产可填写环境 ID
    wx.cloud.init({ env: wx.cloud.DYNAMIC_CURRENT_ENV, traceUser: true });
  },

  /** 获取当前用户角色（缓存），页面 onShow 时调用。 */
  async ensureUser(force = false) {
    if (this.globalData.user && !force) return this.globalData.user;
    const user = await api.call('auth.me', {}, { silent: true });
    this.globalData.user = user;
    return user;
  },
});
