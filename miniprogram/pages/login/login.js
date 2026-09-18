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

function roleLabel(role) {
  return role === 'teacher' ? '老师' : '学生';
}

Page({
  data: {
    returning: false,
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

  bounceOrStay: function () {
    if (isOptedOut()) {
      this.applyKnownProfile(getCachedProfile());
      this.refreshKnownProfile();
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

  refreshKnownProfile: function () {
    getProfile({ force: true })
      .then((p) => this.applyKnownProfile(p))
      .catch(() => {})
      .then(() => this.setData({ checking: false }));
  },

  applyKnownProfile: function (p) {
    const savedRole = hasLockedRole(p && p.role) ? p.role : '';
    this._savedRole = savedRole;
    const returning = !!(p && (p.hasProfile || savedRole));
    const patch = { returning };
    if (savedRole) patch.intentRole = savedRole;
    this.setData(patch);
  },

  selectRole: function (e) {
    if (this.data.submitting) return;
    const intentRole = e.currentTarget.dataset.role === 'teacher' ? 'teacher' : 'student';
    this.setData({ intentRole });
  },

  onLogin: function () {
    if (this.data.submitting) return;
    const same = this._savedRole && this._savedRole === this.data.intentRole;
    if (same) {
      this.doLogin();
      return;
    }
    const label = roleLabel(this.data.intentRole);
    const switching = !!this._savedRole;
    wx.showModal({
      title: switching ? '切换身份' : '确认身份',
      content: switching
        ? '将以' + label + '身份进入。错题本和班级数据都会保留，退出后可再切回来。'
        : '你将以' + label + '身份进入。退出登录后可再换成另一种身份，数据都会保留。',
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

    let created = false;
    let openId = '';
    let enterRole = this.data.intentRole;

    ensureCloudSession()
      .then(() => this.callUser({ action: 'ensure' }))
      .then((res) => {
        if (!res.success) throw new Error(res.error || '登录失败');
        created = !!(res.data && res.data.created);
        openId = (res.data && res.data.openId) || '';
        setCachedProfile(res.data);
        return this.callUser({ action: 'setRole', role: this.data.intentRole });
      })
      .then((res) => {
        if (!res.success) {
          throw new Error(res.message || res.error || '保存身份失败');
        }
        openId = (res.data && res.data.openId) || openId;
        if (hasLockedRole(res.data && res.data.role)) enterRole = res.data.role;
        setCachedProfile(res.data);
        setLoggedIn(openId, enterRole);
      })
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
