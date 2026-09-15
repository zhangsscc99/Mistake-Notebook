const { ensureCloudSession } = require('../../utils/cloud');
const {
  setLoggedIn,
  isLoggedIn,
  restoreSessionFromCloud,
  isOptedOut,
  leaveLoginToTab,
  getSessionRole,
  enterByRole
} = require('../../utils/auth');
const { setCachedProfile, getCachedProfile } = require('../../utils/profile');
const { inviteCard, timelineCard, enableShareMenu } = require('../../utils/share');
const { pickAvatarPhoto, isCancel } = require('../../utils/avatar');

const MAX_NICKNAME_LEN = 20;
const DEFAULT_NICK = '匿名用户';

function clipNick(raw) {
  const nick = String(raw || '').trim();
  if (!nick) return '';
  return [...nick].slice(0, MAX_NICKNAME_LEN).join('');
}

Page({
  data: {
    returning: false,
    nickName: DEFAULT_NICK,
    avatarFileID: '',
    avatarTempPath: '',
    submitting: false,
    invited: false,
    checking: true,
    intentRole: 'student'
  },

  onLoad: function (options) {
    this.setData({ invited: !!(options && options.from === 'share') });
    enableShareMenu();
    this.bounceOrStay();
  },

  onShow: function () {
    this.bounceOrStay();
  },

  // 登录页不能叠在 Tab 上。除了主动退出，一律立刻切回原来的工作台。
  bounceOrStay: function () {
    if (isOptedOut()) {
      this.applyKnownProfile(getCachedProfile());
      this.setData({ checking: false });
      return;
    }
    if (isLoggedIn()) {
      enterByRole(getSessionRole());
      return;
    }
    this.applyKnownProfile(getCachedProfile());
    setTimeout(() => leaveLoginToTab(), 60);
    restoreSessionFromCloud().catch(() => {});
  },

  applyKnownProfile: function (p) {
    const nick = clipNick(p && p.nickName);
    const avatarFileID = (p && p.avatarFileID) || '';
    const returning = !!(p && (p.hasProfile || nick || avatarFileID));
    const patch = {
      returning,
      nickName: returning ? (nick || DEFAULT_NICK) : DEFAULT_NICK,
      avatarFileID: returning ? avatarFileID : ''
    };
    // 只有库里已经选过身份才预填；不要把「没写 role」当成学生，否则会冲掉用户刚点的老师
    if (p && (p.role === 'teacher' || p.role === 'student')) patch.intentRole = p.role;
    this.setData(patch);
  },

  onPickAvatar: function () {
    pickAvatarPhoto()
      .then((path) => this.setData({ avatarTempPath: path }))
      .catch((err) => {
        if (isCancel(err)) return;
        wx.showToast({ title: '选图失败，请重试', icon: 'none' });
      });
  },

  onNickInput: function (e) {
    this.setData({ nickName: clipNick(e.detail && e.detail.value) });
  },

  onNickBlur: function (e) {
    this.setData({ nickName: clipNick(e.detail && e.detail.value) || DEFAULT_NICK });
  },

  onNickReview: function (e) {
    if (e.detail && e.detail.pass === false) {
      wx.showToast({ title: '昵称未通过审核，请换一个', icon: 'none' });
      return;
    }
    const nick = clipNick((e.detail && (e.detail.nickname || e.detail.value)) || '');
    this.setData({ nickName: nick || DEFAULT_NICK });
  },

  selectRole: function (e) {
    const intentRole = e.currentTarget.dataset.role === 'teacher' ? 'teacher' : 'student';
    this.setData({ intentRole });
  },

  onLogin: function () {
    this.doLogin();
  },

  doLogin: function () {
    if (this.data.submitting) return;
    this.setData({ submitting: true });

    const nick = clipNick(this.data.nickName) || DEFAULT_NICK;
    if ([...nick].length > MAX_NICKNAME_LEN) {
      this.setData({ submitting: false });
      wx.showToast({ title: '昵称不能超过 20 个字', icon: 'none' });
      return;
    }

    let created = false;
    let openId = '';

    ensureCloudSession()
      .then(() => this.callUser({ action: 'ensure' }))
      .then((res) => {
        if (!res.success) throw new Error(res.error || '登录失败');
        created = !!(res.data && res.data.created);
        openId = (res.data && res.data.openId) || '';
        return this.callUser({ action: 'setRole', role: this.data.intentRole });
      })
      .then((res) => {
        if (!res.success) throw new Error(res.error || '保存身份失败');
        openId = (res.data && res.data.openId) || openId;
        setCachedProfile(res.data);
        setLoggedIn(openId, this.data.intentRole);
      })
      .then(() => this.callUser({ action: 'updateProfile', nickName: nick })
        .then((up) => {
          if (up.success) setCachedProfile(up.data);
        })
        .catch((err) => {
          console.warn('[login] 保存昵称失败', err);
        }))
      .then(() => this.uploadAvatarIfNeeded(openId))
      .then(() => {
        wx.showToast({
          title: created ? '账号已创建' : '欢迎回来',
          icon: 'success'
        });
        setTimeout(() => enterByRole(this.data.intentRole), 400);
      })
      .catch((err) => {
        console.error('[login] 失败', err);
        const msg = (err && (err.message || err.errMsg)) || '登录失败，请重试';
        wx.showToast({ title: msg.slice(0, 20), icon: 'none' });
      })
      .then(() => this.setData({ submitting: false }));
  },

  uploadAvatarIfNeeded: function (openId) {
    const tempFilePath = this.data.avatarTempPath;
    if (!tempFilePath || !openId) return Promise.resolve();

    const rand = Math.random().toString(36).slice(2, 8);
    const cloudPath = 'avatars/' + openId + '/' + Date.now() + '_' + rand + '.jpg';

    return new Promise((resolve, reject) => {
      wx.cloud.uploadFile({
        cloudPath,
        filePath: tempFilePath,
        config: { timeout: 60000 },
        success: resolve,
        fail: reject
      });
    })
      .then((up) => this.callUser({ action: 'updateProfile', avatarFileID: up.fileID }))
      .then((up) => {
        if (up.success) setCachedProfile(up.data);
      })
      .catch((err) => {
        console.warn('[login] 头像上传失败', err);
      });
  },

  callUser: function (data) {
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: 'user',
        data,
        config: { timeout: 30000 },
        success: (res) => resolve(res.result || {}),
        fail: (err) => reject(new Error((err && (err.errMsg || err.message)) || '云函数调用失败'))
      });
    });
  },

  onShareAppMessage: function () {
    return inviteCard();
  },

  onShareTimeline: function () {
    return timelineCard();
  }
});
