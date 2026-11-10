/** 云函数调用封装：统一 loading、错误提示与返回结构。 */
function call(action, data = {}, { loading = false, silent = false } = {}) {
  if (loading) wx.showLoading({ title: typeof loading === 'string' ? loading : '加载中', mask: true });
  return wx.cloud.callFunction({ name: 'smp', data: { action, ...data } })
    .then(({ result }) => {
      if (!result || !result.ok) {
        const err = new Error((result && result.error) || '服务异常');
        err.code = result && result.code;
        throw err;
      }
      return result.data;
    })
    .catch((e) => {
      if (!silent) wx.showToast({ title: e.message || '网络异常', icon: 'none', duration: 2500 });
      throw e;
    })
    .finally(() => { if (loading) wx.hideLoading(); });
}

module.exports = { call };
