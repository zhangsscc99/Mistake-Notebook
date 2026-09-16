const { callTeacher } = require('../../utils/teacher');
const app = getApp();
const { clearSession, goLogin } = require('../../utils/auth');
const { getCachedProfile, getProfile } = require('../../utils/profile');
const { performDeleteAccount, finishDeleteAccount } = require('../../utils/account');

Page({
  data: {
    nickName: '',
    classCount: 0,
    studentCount: 0,
    assignmentCount: 0,
    deleting: false
  },

  onShow() {
    const p = getCachedProfile();
    this.setData({ nickName: p.nickName || '' });
    getProfile().then((x) => this.setData({ nickName: x.nickName || '' })).catch(() => {});
    this.loadStats();
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
  goReport() { wx.navigateTo({ url: '/pages/teacherReport/teacherReport' }); },

  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '退出后不会删除云端班级数据，身份也不会改变。下次登录仍进入教师工作台。',
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
      content: '将永久删除本账号下的：\n· 个人资料与教师身份\n· 你创建的班级、作业、练习、题单与家长报告\n· 班级成员记录\n· 这些作业下的学生提交\n· 若有个人错题也会一并删除\n\n删除后无法恢复。同一微信再次登录需要重新选择身份。',
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
