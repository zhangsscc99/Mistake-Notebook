// 本地登录态。真正的身份在云函数里用微信 OPENID，
// 这里只记「用户点过登录」，用来决定进登录页还是进首页。
const SESSION_KEY = 'authSession';

function readSession() {
  try {
    const s = wx.getStorageSync(SESSION_KEY);
    if (s && s.loggedIn) return s;
  } catch (e) {
    // ignore
  }
  return null;
}

function isLoggedIn() {
  return !!readSession();
}

function setLoggedIn(openId) {
  try {
    wx.setStorageSync(SESSION_KEY, {
      loggedIn: true,
      openId: openId || '',
      at: Date.now()
    });
  } catch (e) {
    // 写失败也不挡这次进入：云函数仍能靠 OPENID 认出人
  }
}

function clearSession() {
  try {
    wx.removeStorageSync(SESSION_KEY);
  } catch (e) {
    // ignore
  }
}

function goLogin() {
  const pages = getCurrentPages();
  const cur = pages[pages.length - 1];
  if (cur && cur.route === 'pages/login/login') return;
  wx.reLaunch({ url: '/pages/login/login' });
}

function requireLogin() {
  if (isLoggedIn()) return true;
  goLogin();
  return false;
}

module.exports = {
  SESSION_KEY,
  isLoggedIn,
  setLoggedIn,
  clearSession,
  goLogin,
  requireLogin
};
