const { ensureCloudSession } = require('../../utils/cloud');
const { setLoggedIn, isLoggedIn } = require('../../utils/auth');
const { setCachedProfile, getProfile } = require('../../utils/profile');

const MAX_NICKNAME_LEN = 20;

function enterHome() {
  wx.switchTab({ url: '/pages/index/index' });
}

Page({
  data: {
    returning: false,
    nickName: '',
    submitting: false
  },

  onLoad: function () {
    if (isLoggedIn()) {
      enterHome();
      return;
    }
    this.probeAccount();
  },

  probeAccount: function () {
    getProfile({ force: true })
      .then((p) => {
        this.setData({
          returning: !!(p && p.hasProfile)
        });
      })
      .catch(() => {
        this.setData({ returning: false });
      });
  },

  onNickInput: function (e) {
    this.setData({ nickName: (e.detail && e.detail.value) || '' });
  },

  onLogin: function () {
    if (this.data.submitting) return;
    this.setData({ submitting: true });

    const nick = (this.data.nickName || '').trim();
    if ([...nick].length > MAX_NICKNAME_LEN) {
      this.setData({ submitting: false });
      wx.showToast({ title: '昵称不能超过 20 个字', icon: 'none' });
      return;
    }

    ensureCloudSession()
      .then(() => this.callUser({ action: 'ensure' }))
      .then((res) => {
        if (!res.success) throw new Error(res.error || '登录失败');
        const created = !!(res.data && res.data.created);
        setCachedProfile(res.data);
        setLoggedIn(res.data && res.data.openId);

        if (!created || !nick) return res;

        return this.callUser({ action: 'updateProfile', nickName: nick })
          .then((up) => {
            if (up.success) setCachedProfile(up.data);
            return res;
          })
          .catch(() => res);
      })
      .then((res) => {
        const created = !!(res.data && res.data.created);
        wx.showToast({
          title: created ? '账号已创建' : '欢迎回来',
          icon: 'success'
        });
        setTimeout(enterHome, 400);
      })
      .catch((err) => {
        console.error('[login] 失败', err);
        wx.showToast({ title: (err && err.message) || '登录失败，请重试', icon: 'none' });
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
        fail: reject
      });
    });
  }
});
