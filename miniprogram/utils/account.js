const { clearSession, goLogin } = require('./auth');
const { clearProfileCache } = require('./profile');

// 服务端 failed[].target 是内部标识，直接拼进弹窗会漏出英文命名。
const FAILED_LABELS = {
  chatMemories: '对话记忆',
  papers: '试卷',
  users: '个人资料',
  'users:read': '个人资料',
  avatarFile: '头像图片',
  questionNotes: '错题笔记',
  mistakeReports: '错因分析报告',
  learningReports: '学习报告',
  checkins: '打卡记录',
  coinLogs: '金币流水',
  chatUsage: '对话配额',
  questionMarks: '错题收藏',
  questions: '错题',
  categories: '分类',
  classMembers: '班级成员',
  classMembersByClass: '班级成员',
  classPapers: '班级试卷',
  classNotebooks: '班级练习',
  parentReports: '家长报告',
  assignments: '作业',
  assignmentSubmissions: '作业提交',
  assignmentSubmissionsByAssignment: '作业提交',
  classes: '班级'
};

function failedLabel(item) {
  const target = (item && item.target) || '';
  return FAILED_LABELS[target] || target || '未知项目';
}

function performDeleteAccount() {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: 'user',
      data: { action: 'deleteAccount' },
      config: { timeout: 60000 },
      success: (res) => resolve(res.result || {}),
      fail: reject
    });
  }).then((res) => {
    if (!res.success) throw new Error(res.error || '注销失败');

    clearProfileCache();
    clearSession();
    try {
      wx.removeStorageSync('savedPapers');
    } catch (err) {
      // ignore
    }
    try {
      const app = getApp();
      if (app && app.globalData) {
        app.globalData.selectedPaperQuestions = [];
        app.globalData.recognitionDraft = null;
        app.globalData.teacherPick = null;
      }
    } catch (err) {
      // ignore
    }
    return res;
  });
}

function finishDeleteAccount(res) {
  const failed = (res && res.data && res.data.failed) || [];
  if (failed.length) {
    wx.showModal({
      title: '部分数据未能清除',
      content: '以下项目删除失败：' + failed.map(failedLabel).join('、') + '\n请稍后重试。',
      showCancel: false,
      success: () => goLogin({ force: true })
    });
    return;
  }
  wx.showToast({ title: '账号已注销', icon: 'success' });
  setTimeout(() => goLogin({ force: true }), 400);
}

module.exports = {
  failedLabel,
  performDeleteAccount,
  finishDeleteAccount
};
