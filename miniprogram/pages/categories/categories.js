// pages/categories/categories.js
const app = getApp();

const SYMBOL_MAP = {
  '数学': '数', '物理': '物', '化学': '化', '英语': '英',
  '语文': '语', '生物': '生', '历史': '史', '地理': '地',
  '政治': '政', '体育': '体'
};

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
        } else {
          this.setData({ totalQuestions: 42, todayAdded: 3 });
        }
      },
      fail: () => {
        this.setData({ totalQuestions: 42, todayAdded: 3 });
      }
    });
  },

  fetchCategories: function () {
    wx.cloud.callFunction({
      name: 'category',
      data: { action: 'list' },
      success: (res) => {
        if (res.result && res.result.success) {
          const categories = res.result.data.map(c => ({
            ...c,
            icon: SYMBOL_MAP[c.name] || '题'
          }));
          this.setData({ categories, filteredCategories: categories });
        } else {
          this.setMockCategories();
        }
      },
      fail: () => {
        this.setMockCategories();
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
    const filtered = this.data.categories.filter(c =>
      c.name.includes(keyword) || (c.description && c.description.includes(keyword))
    );
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
