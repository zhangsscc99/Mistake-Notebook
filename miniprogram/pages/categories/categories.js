// pages/categories/categories.js
const app = getApp();

const SYMBOL_MAP = {
  '数学': '数', '物理': '物', '化学': '化', '英语': '英',
  '语文': '语', '生物': '生', '历史': '史', '地理': '地',
  '政治': '政', '体育': '体'
};

function formatRelativeTime(ts) {
  if (!ts) return '未知';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '未知';
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
  return Math.floor(diff / 86400000) + '天前';
}

function mapCategory(c) {
  return {
    ...c,
    icon: SYMBOL_MAP[c.name] || '题',
    formattedUpdatedAt: formatRelativeTime(c.updatedAt || c.lastUpdated || c.createdAt)
  };
}

Page({
  data: {
    totalQuestions: 0,
    todayAdded: 0,
    categories: [],
    filteredCategories: [],
    searchKeyword: '',
    isPaperBuilderMode: false
  },

  onShow: function () {
    const isPaperBuilderMode = app.globalData.categoriesMode === 'paper-builder';
    this.setData({ isPaperBuilderMode });
    this.fetchStats();
    this.fetchCategories();
  },

  onPullDownRefresh: function () {
    const that = this;
    let done = 0;
    const finish = () => {
      done++;
      if (done >= 2) wx.stopPullDownRefresh();
    };
    wx.cloud.callFunction({
      name: 'category',
      data: { action: 'stats' },
      success: (res) => {
        if (res.result && res.result.success) {
          const data = res.result.data;
          that.setData({ totalQuestions: data.totalQuestions || 0, todayAdded: data.todayAdded || 0 });
        }
        finish();
      },
      fail: finish
    });
    wx.cloud.callFunction({
      name: 'category',
      data: { action: 'list' },
      success: (res) => {
        if (res.result && res.result.success) {
          const cats = res.result.data.map(mapCategory);
          that.setData({ categories: cats, filteredCategories: cats });
        }
        finish();
      },
      fail: finish
    });
  },

  fetchStats: function () {
    wx.cloud.callFunction({
      name: 'category',
      data: { action: 'stats' },
      success: (res) => {
        if (res.result && res.result.success) {
          const data = res.result.data;
          this.setData({
            totalQuestions: data.totalQuestions || 0,
            todayAdded: data.todayAdded || 0
          });
        }
      },
      fail: () => {}
    });
  },

  fetchCategories: function () {
    wx.cloud.callFunction({
      name: 'category',
      data: { action: 'list' },
      success: (res) => {
        if (res.result && res.result.success) {
          const categories = res.result.data.map(mapCategory);
          this.setData({ categories, filteredCategories: categories });
        } else {
          this.setData({ categories: [], filteredCategories: [] });
        }
      },
      fail: () => {
        this.setData({ categories: [], filteredCategories: [] });
      }
    });
  },

  setMockCategories: function () {
    const raw = [
      { id: 1, name: '数学', description: '高数、代数、几何错题等', color: '#2459ff', questionCount: 15, tags: ['函数', '方程', '几何'] },
      { id: 2, name: '物理', description: '力学、电磁学、光学、热学等', color: '#2459ff', questionCount: 10, tags: ['力学', '电学'] },
      { id: 3, name: '化学', description: '无机、有机、化学反应平衡等', color: '#2459ff', questionCount: 6, tags: ['有机', '无机', '反应'] },
      { id: 4, name: '英语', description: '阅读理解、完形填空、语法填空等', color: '#2459ff', questionCount: 8, tags: ['阅读', '填空'] },
      { id: 5, name: '语文', description: '文言文阅读、诗歌鉴赏、现代文等', color: '#2459ff', questionCount: 3, tags: ['文言文', '诗歌'] }
    ];
    const categories = raw.map(c => ({ ...c, icon: SYMBOL_MAP[c.name] || '题' }));
    this.setData({ categories, filteredCategories: categories });
  },

  onSearchInput: function (e) {
    const keyword = e.detail.value;
    this.setData({ searchKeyword: keyword });
    this.filterCategories(keyword);
  },

  onSearch: function () {
    this.filterCategories(this.data.searchKeyword);
  },

  filterCategories: function (keyword) {
    if (!keyword) {
      this.setData({ filteredCategories: this.data.categories });
      return;
    }
    const kw = keyword.toLowerCase();
    const filtered = this.data.categories.filter(c => {
      if (c.name && c.name.toLowerCase().includes(kw)) return true;
      if (c.description && c.description.toLowerCase().includes(kw)) return true;
      if (Array.isArray(c.tags) && c.tags.some(t => t.toLowerCase().includes(kw))) return true;
      return false;
    });
    this.setData({ filteredCategories: filtered });
  },

  goToDetail: function (e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name;
    let url = `/pages/categoryDetail/categoryDetail?id=${id}&name=${encodeURIComponent(name)}`;
    if (this.data.isPaperBuilderMode) {
      url += '&mode=paper-select';
    }
    wx.navigateTo({ url });
  },

  exitPaperBuilderMode: function () {
    app.globalData.categoriesMode = null;
    this.setData({ isPaperBuilderMode: false });
  },

  goToCamera: function () {
    wx.switchTab({ url: '/pages/index/index' });
  }
});
