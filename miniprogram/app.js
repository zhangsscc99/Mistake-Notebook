// app.js
const {
  restoreSessionFromCloud,
  getSessionRole,
  goLogin,
  bounceTeacherOffStudentShell,
  bounceParentOffOtherShells,
  hasLockedRole
} = require('./utils/auth');

const TEACHER_PREFIX = 'pages/teacher';
const PARENT_PREFIX = 'pages/parent';

App({
  // 全局数据声明在顶层，不能放进 onLaunch —— onLaunch 开头有个
  // `if (!wx.cloud) return`，一旦走到那条分支 globalData 就永远不会被赋值，
  // 而首页 / 对话页 / 设置页都要读它。
  globalData: {
    // 由 utils/profile.js 统一读写（服务端才是权威，这里只是缓存）
    profile: null,
    loggedIn: false,
    recognitionDraft: null,
    selectedPaperQuestions: [],
    teacherPick: null,
    parentChildId: '',
    categoriesMode: null,
    aiChatContext: ''
  },

  onLaunch: function () {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
      return;
    }

    wx.cloud.init({
      env: 'ai-mistakenotebook-d7cw2be1433bd',
      traceUser: true
    });

    // 刷新登录态，避免 uploadFile 报 access_token missing
    wx.login({
      success: () => console.log('[app] 云开发登录态已刷新'),
      fail: (err) => console.warn('[app] wx.login 失败，上传可能受影响:', err)
    });

    // 本地标记丢了也从云端认回；认回后再 ensure 分类。
    // 还没选定身份、或已主动退出时，整栈去登录页，避免空身份进学生 Tab。
    this.ensureAccountIfKnown();

    // 只确保集合存在。默认分类改在登录时按账号创建，不再写入全局题库。
    setTimeout(() => {
      wx.cloud.callFunction({
        name: 'init',
        data: { action: 'seed' },
        success: (res) => {
          if (res.result && res.result.success) {
            console.log('云数据库初始化:', res.result.message || res.result.data);
          }
        },
        fail: (err) => {
          console.warn('云数据库初始化失败，请在开发者工具部署 init 云函数:', err);
        }
      });
    }, 1000);
  },

  ensureAccountIfKnown: function () {
    restoreSessionFromCloud()
      .then((result) => this.routeAfterRestore(result))
      .catch((err) => console.warn('[app] 恢复登录失败:', err));
  },

  routeAfterRestore: function (result) {
    if (!result || result.uncertain) {
      if (!hasLockedRole(getSessionRole())) goLogin({ force: true });
      else {
        bounceTeacherOffStudentShell();
        bounceParentOffOtherShells();
      }
      return;
    }
    if (result.optedOut || result.needsRole || !result.loggedIn) {
      goLogin({ force: true });
      return;
    }
    if (bounceTeacherOffStudentShell()) return;
    if (bounceParentOffOtherShells()) return;
    const pages = getCurrentPages();
    const route = (pages.length && pages[pages.length - 1] && pages[pages.length - 1].route) || '';
    const role = getSessionRole();
    if (role === 'student' && (route.indexOf(TEACHER_PREFIX) === 0 || route.indexOf(PARENT_PREFIX) === 0)) {
      wx.switchTab({ url: '/pages/index/index' });
    }
  },

  onShow: function () {
    const pages = getCurrentPages();
    const cur = pages[pages.length - 1];
    const route = (cur && cur.route) || '';
    if (route === 'pages/login/login') return;

    restoreSessionFromCloud()
      .then((result) => this.routeAfterRestore(result))
      .catch((err) => {
        console.warn('[app] 恢复登录失败:', err);
      });
  }
});
