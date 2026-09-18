const { callTeacher } = require('../../utils/teacher');
const { ensureCloudSession, isAccessTokenError } = require('../../utils/cloud');
const app = getApp();
const { clearSession, goLogin } = require('../../utils/auth');
const { getCachedProfile, getProfile, setCachedProfile } = require('../../utils/profile');
const { performDeleteAccount, finishDeleteAccount } = require('../../utils/account');
const { pickAvatarPhoto, isCancel } = require('../../utils/avatar');

const MAX_NICKNAME_LEN = 20;

Page({
  data: {
    openId: '',
    nickName: '',
    avatarFileID: '',
    classCount: 0,
    studentCount: 0,
    assignmentCount: 0,
    deleting: false,
    uploadingAvatar: false,
    saving: false
  },

  onShow() {
    this.applyProfile(getCachedProfile());
    getProfile().then((x) => this.applyProfile(x)).catch(() => {});
    this.loadStats();
  },

  applyProfile(p) {
    this._savedNickName = (p && p.nickName) || '';
    this.setData({
      openId: (p && p.openId) || '',
      nickName: (p && p.nickName) || '',
      avatarFileID: (p && p.avatarFileID) || ''
    });
  },

  async loadStats() {
    const dash = await callTeacher('dashboard');
    if (!dash.success) return;
    const data = dash.data || {};
    this.setData({
      classCount: (data.classes || []).length,
      studentCount: data.studentCount || 0,
      assignmentCount: data.assignmentCount || 0
    });
  },

  goClass(e) {
    const focus = (e.currentTarget.dataset.focus) || '';
    const q = focus ? ('?focus=' + focus) : '';
    wx.reLaunch({ url: '/pages/teacher/teacher' + q });
  },
  goAssignments() { wx.navigateTo({ url: '/pages/teacherAssignments/teacherAssignments' }); },
  goPaper() { wx.reLaunch({ url: '/pages/teacherPaper/teacherPaper' }); },
  goQuestions() { wx.reLaunch({ url: '/pages/teacherQuestions/teacherQuestions' }); },
  goCapture() { wx.reLaunch({ url: '/pages/teacherCapture/teacherCapture' }); },
  goReport() { wx.navigateTo({ url: '/pages/teacherReport/teacherReport' }); },

  onNickInput(e) {
    this.setData({ nickName: String((e.detail && e.detail.value) || '') });
  },

  callUser(data) {
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: 'user',
        data,
        config: { timeout: 30000 },
        success: (res) => resolve(res.result || {}),
        fail: reject
      });
    });
  },

  onSaveNick() {
    if (this.data.saving) return;
    const nickName = String(this.data.nickName || '').trim();
    if (!nickName) {
      wx.showToast({ title: '请输入昵称', icon: 'none' });
      return;
    }
    if ([...nickName].length > MAX_NICKNAME_LEN) {
      wx.showToast({ title: '昵称不能超过 20 个字', icon: 'none' });
      return;
    }
    if (nickName === (this._savedNickName || '').trim()) {
      wx.showToast({ title: '昵称没有变化', icon: 'none' });
      return;
    }

    this.setData({ saving: true });
    wx.showLoading({ title: '保存中...', mask: true });
    this.callUser({ action: 'updateProfile', nickName })
      .then((res) => {
        if (!res.success) throw new Error(res.error || '保存失败');
        wx.hideLoading();
        this.applyProfile(setCachedProfile(res.data));
        wx.showToast({ title: '已保存', icon: 'success' });
      })
      .catch((err) => {
        wx.hideLoading();
        wx.showToast({ title: (err && err.message) || '保存失败，请重试', icon: 'none' });
      })
      .then(() => this.setData({ saving: false }));
  },

  onPickAvatar() {
    if (this.data.uploadingAvatar) return;
    pickAvatarPhoto()
      .then((path) => this.uploadAvatar(path))
      .catch((err) => {
        if (isCancel(err)) return;
        wx.showToast({ title: '选图失败，请重试', icon: 'none' });
      });
  },

  uploadAvatar(tempFilePath) {
    if (this.data.uploadingAvatar) return;
    if (!this.data.openId) {
      wx.showToast({ title: '资料还没加载好，请稍后重试', icon: 'none' });
      return;
    }

    this.setData({ uploadingAvatar: true });
    wx.showLoading({ title: '上传中...', mask: true });
    ensureCloudSession()
      .then(() => {
        const rand = Math.random().toString(36).slice(2, 8);
        const cloudPath = 'avatars/' + this.data.openId + '/' + Date.now() + '_' + rand + '.jpg';
        return new Promise((resolve, reject) => {
          wx.cloud.uploadFile({
            cloudPath,
            filePath: tempFilePath,
            config: { timeout: 60000 },
            success: resolve,
            fail: reject
          });
        });
      })
      .then((up) => this.callUser({ action: 'updateProfile', avatarFileID: up.fileID }))
      .then((res) => {
        if (!res.success) throw new Error(res.error || '保存失败');
        wx.hideLoading();
        this.applyProfile(setCachedProfile(res.data));
        wx.showToast({ title: '头像已更新', icon: 'success' });
      })
      .catch((err) => {
        wx.hideLoading();
        wx.showToast({
          title: isAccessTokenError(err) ? '云开发未登录，请重进小程序' : '头像上传失败，请重试',
          icon: 'none'
        });
      })
      .then(() => this.setData({ uploadingAvatar: false }));
  },

  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '退出后不会删除云端数据。下次登录可重新选择学生或老师。',
      confirmText: '退出',
      success: (res) => {
        if (!res.confirm) return;
        clearSession();
        app.globalData.teacherPick = null;
        goLogin({ force: true });
      }
    });
  },

  onDeleteAccount() {
    if (this.data.deleting) return;
    wx.showModal({
      title: '注销账号',
      content: '将永久删除本账号下的：\n· 个人资料与教师身份\n· 你创建的班级、作业、练习、试卷、题库与家长报告\n· 班级成员记录\n· 这些作业下的学生提交\n· 若有个人错题也会一并删除\n\n删除后无法恢复。同一微信再次登录需要重新选择身份。',
      confirmText: '继续',
      confirmColor: '#e11d48',
      success: (res) => {
        if (res.confirm) this.confirmDeleteAccount();
      }
    });
  },

  confirmDeleteAccount() {
    wx.showModal({
      title: '最后确认',
      content: '再次确认删除全部云端数据？\n\n微信账号不受影响。注销后同一微信可以重新选择学生或老师。',
      confirmText: '确认删除',
      confirmColor: '#e11d48',
      success: (res) => {
        if (res.confirm) this.doDeleteAccount();
      }
    });
  },

  doDeleteAccount() {
    this.setData({ deleting: true });
    wx.showLoading({ title: '注销中...', mask: true });
    performDeleteAccount()
      .then((res) => {
        this.setData({ deleting: false });
        wx.hideLoading();
        finishDeleteAccount(res);
      })
      .catch((err) => {
        this.setData({ deleting: false });
        wx.hideLoading();
        console.error('[teacherMine] 注销失败', err);
        wx.showToast({ title: err.message || '注销失败，请重试', icon: 'none' });
      });
  }
});
