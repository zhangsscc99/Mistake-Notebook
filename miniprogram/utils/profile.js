// utils/profile.js
// 资料共享加载器。原先每个页面各拉各的，首页 / 对话页 / 设置页都要用昵称头像后
// 那样会变成一次冷启动打三次云函数。这里做三层缓存 + 并发去重。

// 与 pages/questionPicker 的「学习阶段」共用一份列表，不再各写一个字面量
const STAGES = ['小学', '初中', '高中', '大学'];

const CACHE_KEY = 'profileCache';

const EMPTY_PROFILE = {
  openId: '',
  nickName: '',
  avatarFileID: '',
  stage: '',
  hasProfile: false
};

// 合并成固定形状：页面 setData 时不至于因为少个字段而拿到 undefined
function normalize(data) {
  const d = data || {};
  return {
    openId: d.openId || '',
    nickName: d.nickName || '',
    avatarFileID: d.avatarFileID || '',
    stage: d.stage || '',
    hasProfile: !!d.exists
  };
}

// 同步读，供页面 onLoad 先渲染出内容再等网络 —— 否则头像昵称会闪一下
function getCachedProfile() {
  const app = getApp();
  const fromGlobal = app && app.globalData && app.globalData.profile;
  if (fromGlobal) return { ...EMPTY_PROFILE, ...fromGlobal };
  try {
    const cached = wx.getStorageSync(CACHE_KEY);
    if (cached && typeof cached === 'object') return { ...EMPTY_PROFILE, ...cached };
  } catch (e) {
    // 读缓存失败不是错误，走空档案即可
  }
  return { ...EMPTY_PROFILE };
}

function writeCache(profile) {
  const app = getApp();
  if (app && app.globalData) app.globalData.profile = profile;
  try {
    wx.setStorageSync(CACHE_KEY, profile);
  } catch (e) {
    // 写缓存失败不影响本次返回
  }
}

// 并发去重的关键：同一时刻只允许一个请求在飞
let inFlight = null;

function getProfile(options) {
  const force = !!(options && options.force);
  const app = getApp();
  const cached = app && app.globalData && app.globalData.profile;

  if (!force && cached) return Promise.resolve(cached);
  if (inFlight) return inFlight;

  const req = new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: 'user',
      data: { action: 'get' },
      config: { timeout: 15000 },
      success: (res) => resolve(res.result || {}),
      fail: reject
    });
  })
    .then((res) => {
      if (!res.success) throw new Error(res.error || '读取资料失败');
      const profile = normalize(res.data);
      writeCache(profile);
      return profile;
    });

  inFlight = req;
  // 无论成败都要放锁，否则一次失败会让后续所有调用都复用一个已 reject 的 promise
  req.then(
    () => { inFlight = null; },
    () => { inFlight = null; }
  );
  return req;
}

// 资料页保存成功后就地更新缓存，省掉一次回拉
function setCachedProfile(data) {
  const merged = { ...getCachedProfile(), ...normalize(data) };
  // normalize 会把 exists 映射成 hasProfile；这里 data 可能来自 updateProfile 的返回，
  // 它带 exists:true，所以上面那行已经处理好了
  writeCache(merged);
  return merged;
}

function clearProfileCache() {
  const app = getApp();
  if (app && app.globalData) app.globalData.profile = null;
  try {
    wx.removeStorageSync(CACHE_KEY);
  } catch (e) {
    // ignore
  }
}

// 按小时给问候语，纯客户端计算，不占云函数调用
function greetingPrefix(now) {
  const h = (now || new Date()).getHours();
  if (h < 6) return '夜深了';
  if (h < 12) return '早上好';
  if (h < 18) return '下午好';
  return '晚上好';
}

module.exports = {
  STAGES,
  getProfile,
  getCachedProfile,
  setCachedProfile,
  clearProfileCache,
  greetingPrefix
};
