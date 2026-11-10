const api = require('./utils/api');
const { envId } = require('./config');

App({
  globalData: { user: null, currentIssueId: '' },

  onLaunch() {
    if (!wx.cloud) {
      wx.showModal({ title: '提示', content: '请使用 2.2.3 或以上的基础库以使用云能力', showCancel: false });
      return;
    }
    // 小程序端必须显式指定环境 ID（DYNAMIC_CURRENT_ENV 只适用于云函数端），见 config.js
    wx.cloud.init({ env: envId, traceUser: true });
  },

  /** 获取当前用户角色（缓存），页面 onShow 时调用。 */
  async ensureUser(force = false) {
    if (this.globalData.user && !force) return this.globalData.user;
    const user = await api.call('auth.me', {}, { silent: true });
    this.globalData.user = user;
    return user;
  },
});
