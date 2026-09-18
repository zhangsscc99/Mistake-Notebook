Component({
  properties: {
    active: {
      type: String,
      value: 'class'
    }
  },
  data: {
    tabs: [
      { key: 'class', text: '班级', url: '/pages/teacher/teacher', icon: '/images/tabbar/home.png', activeIcon: '/images/tabbar/home-active.png' },
      { key: 'capture', text: '拍照', url: '/pages/teacherCapture/teacherCapture', icon: '/images/tabbar/home.png', activeIcon: '/images/tabbar/home-active.png' },
      { key: 'questions', text: '题目', url: '/pages/teacherQuestions/teacherQuestions', icon: '/images/tabbar/apps.png', activeIcon: '/images/tabbar/apps-active.png' },
      { key: 'chat', text: '助手', url: '/pages/teacherChat/teacherChat', icon: '/images/tabbar/chat.png', activeIcon: '/images/tabbar/chat-active.png' },
      { key: 'paper', text: '组卷', url: '/pages/teacherPaper/teacherPaper', icon: '/images/tabbar/edit.png', activeIcon: '/images/tabbar/edit-active.png' },
      { key: 'mine', text: '我的', url: '/pages/teacherMine/teacherMine', icon: '/images/tabbar/profile.png', activeIcon: '/images/tabbar/profile-active.png' }
    ]
  },
  methods: {
    onTap: function (e) {
      const url = e.currentTarget.dataset.url;
      const pages = getCurrentPages();
      const cur = pages[pages.length - 1];
      if (cur && ('/' + cur.route) === url) return;
      wx.reLaunch({ url: url });
    }
  }
});
