const { ensureCloudSession } = require('../../utils/cloud');
const {
  setLoggedIn,
  isLoggedIn,
  restoreSessionFromCloud,
  isOptedOut,
  getSessionRole,
  enterByRole,
  hasLockedRole
} = require('../../utils/auth');
const { setCachedProfile, getCachedProfile, getProfile } = require('../../utils/profile');
const { inviteCard, timelineCard, enableShareMenu } = require('../../utils/share');
const { pickAvatarPhoto, isCancel } = require('../../utils/avatar');

const MAX_NICKNAME_LEN = 20;
const DEFAULT_NICK = '匿名用户';

function clipNick(raw) {
  const nick = String(raw || '').trim();
  if (!nick) return '';
  return [...nick].slice(0, MAX_NICKNAME_LEN).join('');
}

function roleLabel(role) {
  return role === 'teacher' ? '老师' : '学生';
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
    intentRole: 'student',
    roleLocked: false
  },

  onLoad: function (options) {
    this.setData({ invited: !!(options && options.from === 'share') });
    enableShareMenu();
    this.bounceOrStay();
  },

  onShow: function () {
    this.bounceOrStay();
  },

  bounceOrStay: function () {
    if (isOptedOut()) {
      this.applyKnownProfile(getCachedProfile());
      this.refreshLockedRole();
      return;
    }
    if (isLoggedIn() && hasLockedRole(getSessionRole())) {
      enterByRole(getSessionRole());
      return;
    }

    this.applyKnownProfile(getCachedProfile());
    restoreSessionFromCloud()
      .then((result) => {
        const profile = (result && result.profile) || getCachedProfile();
        this.applyKnownProfile(profile);
        if (result && result.loggedIn && hasLockedRole(profile.role)) {
          enterByRole(profile.role);
          return;
        }
        this.setData({ checking: false });
      })
      .catch(() => {
        this.setData({ checking: false });
      });
  },

  refreshLockedRole: function () {
    getProfile({ force: true })
      .then((p) => this.applyKnownProfile(p))
      .catch(() => {})
      .then(() => this.setData({ checking: false }));
  },

  applyKnownProfile: function (p) {
    const nick = clipNick(p && p.nickName);
    const avatarFileID = (p && p.avatarFileID) || '';
    const returning = !!(p && (p.hasProfile || nick || avatarFileID));
    const locked = hasLockedRole(p && p.role);
    const patch = {
      returning,
      nickName: returning ? (nick || DEFAULT_NICK) : DEFAULT_NICK,
      avatarFileID: returning ? avatarFileID : '',
      roleLocked: locked
    };
    if (locked) patch.intentRole = p.role;
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
    if (this.data.roleLocked || this.data.submitting) return;
    const intentRole = e.currentTarget.dataset.role === 'teacher' ? 'teacher' : 'student';
    this.setData({ intentRole });
  },

  onLogin: function () {
    if (this.data.submitting) return;
    if (this.data.roleLocked) {
      this.doLogin();
      return;
    }
    const label = roleLabel(this.data.intentRole);
    wx.showModal({
      title: '确认身份',
      content: '你将以' + label + '身份进入。一个微信只能绑定一种身份，选定后不能更改，除非注销账号。',
      confirmText: '确定',
      cancelText: '再想想',
      success: (res) => {
        if (res.confirm) this.doLogin();
      }
    });
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
    let enterRole = this.data.intentRole;

    ensureCloudSession()
      .then(() => this.callUser({ action: 'ensure' }))
      .then((res) => {
        if (!res.success) throw new Error(res.error || '登录失败');
        created = !!(res.data && res.data.created);
        openId = (res.data && res.data.openId) || '';
        const cloudRole = res.data && res.data.role;
        if (hasLockedRole(cloudRole)) {
          enterRole = cloudRole;
          this.setData({ roleLocked: true, intentRole: cloudRole });
          setCachedProfile(res.data);
          return res;
        }
        return this.callUser({ action: 'setRole', role: this.data.intentRole }).then((roleRes) => {
          if (roleRes.success) return roleRes;
          if (roleRes.error === 'ROLE_LOCKED' && hasLockedRole(roleRes.data && roleRes.data.role)) {
            enterRole = roleRes.data.role;
            this.setData({ roleLocked: true, intentRole: roleRes.data.role });
            return { success: true, data: roleRes.data };
          }
          throw new Error(roleRes.message || (roleRes.error === 'ROLE_LOCKED'
            ? '该微信已绑定身份，不能更改'
            : (roleRes.error || '保存身份失败')));
        });
      })
      .then((res) => {
        if (!res.success) {
          throw new Error(res.message || (res.error === 'ROLE_LOCKED'
            ? '该微信已绑定身份，不能更改'
            : (res.error || '保存身份失败')));
        }
        openId = (res.data && res.data.openId) || openId;
        if (hasLockedRole(res.data && res.data.role)) enterRole = res.data.role;
        setCachedProfile(res.data);
        setLoggedIn(openId, enterRole);
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
        setTimeout(() => enterByRole(enterRole), 400);
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
