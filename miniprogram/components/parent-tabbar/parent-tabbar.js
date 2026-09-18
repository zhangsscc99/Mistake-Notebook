Component({
  properties: {
    active: {
      type: String,
      value: 'home'
    }
  },
  data: {
    tabs: [
      { key: 'home', text: '孩子', url: '/pages/parent/parent', icon: '/images/tabbar/home.png', activeIcon: '/images/tabbar/home-active.png' },
      { key: 'mistakes', text: '错题', url: '/pages/parentMistakes/parentMistakes', icon: '/images/tabbar/apps.png', activeIcon: '/images/tabbar/apps-active.png' },
      { key: 'reports', text: '报告', url: '/pages/parentReports/parentReports', icon: '/images/tabbar/edit.png', activeIcon: '/images/tabbar/edit-active.png' },
      { key: 'mine', text: '我的', url: '/pages/parentMine/parentMine', icon: '/images/tabbar/profile.png', activeIcon: '/images/tabbar/profile-active.png' }
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
