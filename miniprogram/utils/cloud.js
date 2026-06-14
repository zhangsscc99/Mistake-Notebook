/**
 * 确保微信登录态有效，云存储 uploadFile 依赖此 token。
 * 失败常见于：未登录开发者工具、VPN/代理、登录态过期。
 */
function ensureCloudSession() {
  return new Promise((resolve, reject) => {
    wx.login({
      success: (res) => {
        if (res.code) {
          console.log('[cloud] wx.login 成功');
          resolve(res);
        } else {
          reject(new Error('wx.login 未返回 code'));
        }
      },
      fail: (err) => {
        console.error('[cloud] wx.login 失败', err);
        reject(err);
      }
    });
  });
}

function isAccessTokenError(err) {
  const msg = (err && err.errMsg) || String(err || '');
  return msg.includes('access_token missing') || msg.includes('wxCloudApiToken');
}

module.exports = {
  ensureCloudSession,
  isAccessTokenError
};
