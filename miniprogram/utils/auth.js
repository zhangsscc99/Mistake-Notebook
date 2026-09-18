// 本地登录态。真正的身份在云函数里用微信 OPENID。
// 本地 authSession 只是快捷标记；丢了要从云端 ensure 认回来，不能跳到登录页。
const { getCachedProfile, setCachedProfile, clearProfileCache } = require('./profile');

const SESSION_KEY = 'authSession';
const LOGOUT_KEY = 'authLoggedOut';

const TAB_URLS = {
  'pages/index/index': '/pages/index/index',
  'pages/categories/categories': '/pages/categories/categories',
  'pages/aiChat/aiChat': '/pages/aiChat/aiChat',
  'pages/paperBuilder/paperBuilder': '/pages/paperBuilder/paperBuilder',
  'pages/profile/profile': '/pages/profile/profile'
};

// 必须作为声明存在：按需注入打包时若引用了这个名字却没有定义，App() 会直接崩，
// 首页 Page 也不会注册，随后出现 wx://not-found。
const STUDENT_TAB_ROUTES = {
  'pages/index/index': true,
  'pages/categories/categories': true,
  'pages/aiChat/aiChat': true,
  'pages/paperBuilder/paperBuilder': true,
  'pages/profile/profile': true
};

let memoryLoggedIn = false;
let restoring = null;

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
  if (memoryLoggedIn) return true;
  try {
    const app = getApp();
    if (app && app.globalData && app.globalData.loggedIn) return true;
  } catch (e) {
    // getApp 在极早启动时可能还没有
  }
  return !!readSession();
}

function hasLockedRole(role) {
  return role === 'teacher' || role === 'student' || role === 'parent';
}

function setLoggedIn(openId, role) {
  if (!hasLockedRole(role)) return;
  memoryLoggedIn = true;
  try {
    const app = getApp();
    if (app && app.globalData) app.globalData.loggedIn = true;
  } catch (e) {
    // ignore
  }
  try {
    wx.setStorageSync(SESSION_KEY, {
      loggedIn: true,
      openId: openId || '',
      role,
      at: Date.now()
    });
    wx.removeStorageSync(LOGOUT_KEY);
  } catch (e) {
    // 写失败也不挡这次进入：内存标记 + 云端 OPENID 仍有效
  }
}

function getSessionRole() {
  const s = readSession();
  return hasLockedRole(s && s.role) ? s.role : '';
}

function isTeacherSession() {
  return getSessionRole() === 'teacher';
}

function isParentSession() {
  return getSessionRole() === 'parent';
}

function enterByRole(role) {
  if (role === 'teacher') {
    wx.reLaunch({ url: '/pages/teacher/teacher' });
    return;
  }
  if (role === 'parent') {
    wx.reLaunch({ url: '/pages/parent/parent' });
    return;
  }
  if (role === 'student') {
    wx.switchTab({ url: '/pages/index/index' });
    return;
  }
  goLogin({ force: true });
}

// 冷启动时 App.onShow 里 getCurrentPages() 经常还是空的，老师会被留在学生首页。
// 学生 Tab、空路由、以及其它非教师页都要送回教师壳。
function bounceTeacherOffStudentShell() {
  if (getSessionRole() !== 'teacher') return false;
  const pages = getCurrentPages();
  const route = (pages.length && pages[pages.length - 1] && pages[pages.length - 1].route) || '';
  if (route.indexOf('pages/teacher') === 0) return false;
  if (route === 'pages/login/login') return false;
  if (route && !STUDENT_TAB_ROUTES[route] && route.indexOf('pages/') !== 0) return false;
  wx.reLaunch({ url: '/pages/teacher/teacher' });
  return true;
}

function bounceParentOffOtherShells() {
  if (getSessionRole() !== 'parent') return false;
  const pages = getCurrentPages();
  const route = (pages.length && pages[pages.length - 1] && pages[pages.length - 1].route) || '';
  if (route.indexOf('pages/parent') === 0) return false;
  if (route === 'pages/login/login') return false;
  wx.reLaunch({ url: '/pages/parent/parent' });
  return true;
}

// 学生 Tab 冷启动先于云端 ensure。没有锁定身份时必须去登录页选角色，
// 不能把上一个微信的本地会话当成这个人已经是学生。
function guardStudentShell() {
  if (bounceTeacherOffStudentShell()) return true;
  if (bounceParentOffOtherShells()) return true;
  if (hasLockedRole(getSessionRole())) return false;
  goLogin({ force: true });
  return true;
}

function dropLocalSession() {
  memoryLoggedIn = false;
  try {
    const app = getApp();
    if (app && app.globalData) app.globalData.loggedIn = false;
  } catch (e) {
    // ignore
  }
  try {
    wx.removeStorageSync(SESSION_KEY);
  } catch (e) {
    // ignore
  }
}

function clearSession() {
  dropLocalSession();
  // 只清登录态，不动 profileCache：昵称头像在云端 users 档里，
  // 缓存留给登录页展示「欢迎回来 + 昵称」。注销账号时由 profile 页单独 clearProfileCache()。
  try {
    wx.setStorageSync(LOGOUT_KEY, true);
  } catch (e) {
    // ignore
  }
}

function isOptedOut() {
  try {
    return !!wx.getStorageSync(LOGOUT_KEY) && !isLoggedIn();
  } catch (e) {
    return false;
  }
}

// 从任意 Tab / 子页自动跳到登录页，微信会把登录层叠在当前页上：
// 标题还是「组合试卷」「对话助手」，底部 Tab 还在，按钮经常点不动。
// 所以自动恢复会话时绝不跳登录页；只有用户主动退出/注销（force）才整栈重置到登录页。
function goLogin(options) {
  const force = !!(options && options.force);
  const pages = getCurrentPages();
  const cur = pages[pages.length - 1];
  if (cur && cur.route === 'pages/login/login') return;
  if (!force) return;
  wx.reLaunch({ url: '/pages/login/login' });
}

// 若登录页被叠在 Tab 上，切回底下的 Tab，拆掉这层点不了的界面。
function dismissLoginOverlay() {
  const pages = getCurrentPages();
  if (!pages.length) return false;
  const top = pages[pages.length - 1];
  if (!top || top.route !== 'pages/login/login') return false;
  if (isOptedOut()) return false;

  if (isTeacherSession()) {
    wx.reLaunch({ url: '/pages/teacher/teacher' });
    return true;
  }
  if (isParentSession()) {
    wx.reLaunch({ url: '/pages/parent/parent' });
    return true;
  }
  for (let i = pages.length - 2; i >= 0; i--) {
    const url = TAB_URLS[pages[i].route];
    if (url) {
      wx.switchTab({ url });
      return true;
    }
  }
  wx.switchTab({ url: '/pages/index/index' });
  return true;
}

function leaveLoginToTab() {
  if (isTeacherSession()) {
    wx.reLaunch({ url: '/pages/teacher/teacher' });
    return;
  }
  if (isParentSession()) {
    wx.reLaunch({ url: '/pages/parent/parent' });
    return;
  }
  const pages = getCurrentPages();
  for (let i = pages.length - 2; i >= 0; i--) {
    const url = TAB_URLS[pages[i].route];
    if (url) {
      wx.switchTab({ url });
      return;
    }
  }
  wx.switchTab({ url: '/pages/index/index' });
}

// 用 ensure 恢复登录：有档就读回来，没档就建档。不要用 get（exists=false 会被当成未登录）。
// 云端还没有锁定身份时不算已登录，必须去登录页选定。
// 本地缓存可能是上一个微信号留下的，openid 对不上就丢掉，不能冒充学生进首页。
function restoreSessionFromCloud() {
  if (isOptedOut()) {
    return Promise.resolve({ loggedIn: false, restored: false, optedOut: true });
  }
  if (restoring) return restoring;

  restoring = new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: 'user',
      data: { action: 'ensure' },
      config: { timeout: 20000 },
      success: (res) => resolve(res.result || {}),
      fail: reject
    });
  })
    .then((res) => {
      if (!res.success) throw new Error(res.error || '登录恢复失败');
      const incoming = res.data || {};
      const cloudOpenId = incoming.openId || '';
      const cached = getCachedProfile();
      const session = readSession();
      const localOpenId = (session && session.openId) || cached.openId || '';
      if (localOpenId && cloudOpenId && localOpenId !== cloudOpenId) {
        clearProfileCache();
        dropLocalSession();
        try {
          const app = getApp();
          if (app && app.globalData) app.globalData.parentChildId = '';
        } catch (e) {
          // ignore
        }
      }
      const p = setCachedProfile(incoming);
      if (!hasLockedRole(p.role)) {
        dropLocalSession();
        return { loggedIn: false, restored: true, needsRole: true, profile: p };
      }
      setLoggedIn(p.openId, p.role);
      return { loggedIn: true, restored: true, profile: p };
    })
    .catch((err) => {
      if (isLoggedIn() && hasLockedRole(getSessionRole())) {
        return { loggedIn: true, restored: false, uncertain: true, error: err };
      }
      return { loggedIn: false, restored: false, uncertain: true, error: err };
    })
    .then((result) => {
      restoring = null;
      return result;
    });

  return restoring;
}

function requireLogin() {
  return isLoggedIn();
}

module.exports = {
  SESSION_KEY,
  STUDENT_TAB_ROUTES,
  isLoggedIn,
  setLoggedIn,
  getSessionRole,
  hasLockedRole,
  isTeacherSession,
  isParentSession,
  enterByRole,
  bounceTeacherOffStudentShell,
  bounceParentOffOtherShells,
  guardStudentShell,
  clearSession,
  goLogin,
  restoreSessionFromCloud,
  requireLogin,
  dismissLoginOverlay,
  leaveLoginToTab,
  isOptedOut
};
