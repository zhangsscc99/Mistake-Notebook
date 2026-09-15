const { callTeacher } = require('../../utils/teacher');
const app = getApp();
const { clearSession } = require('../../utils/auth');
const { getCachedProfile, getProfile } = require('../../utils/profile');

Page({
  data: {
    nickName: '',
    classCount: 0,
    studentCount: 0,
    assignmentCount: 0
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
      content: '退出后不会删除云端班级数据。下次登录可重新选择学生或老师。',
      confirmText: '退出',
      success: (res) => {
        if (!res.confirm) return;
        clearSession();
        app.globalData.teacherPick = null;
        wx.reLaunch({ url: '/pages/login/login' });
      }
    });
  }
});
