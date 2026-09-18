function callParent(action, data, timeout) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: 'parent',
      data: Object.assign({ action: action }, data || {}),
      config: { timeout: timeout || 30000 },
      success: (res) => resolve(res.result || {}),
      fail: reject
    });
  });
}

function selectedChildId() {
  try {
    const app = getApp();
    return (app && app.globalData && app.globalData.parentChildId) || wx.getStorageSync('parentChildId') || '';
  } catch (e) {
    return '';
  }
}

function setSelectedChildId(id) {
  const value = String(id || '');
  try {
    const app = getApp();
    if (app && app.globalData) app.globalData.parentChildId = value;
  } catch (e) {
    // ignore
  }
  try {
    if (value) wx.setStorageSync('parentChildId', value);
    else wx.removeStorageSync('parentChildId');
  } catch (e) {
    // ignore
  }
}

module.exports = {
  callParent,
  selectedChildId,
  setSelectedChildId
};
