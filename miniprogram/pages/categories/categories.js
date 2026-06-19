// pages/categories/categories.js
const app = getApp();
const { startPendingWatch, closePendingWatch, fetchPendingQuestions } = require('../../utils/aiPendingWatch.js');

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
    pendingCount: 0,
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
    this.loadPending();
    this.startWatch();
  },

  onHide: function () {
    this.stopWatch();
  },

  onUnload: function () {
    this.stopWatch();
  },

  onPullDownRefresh: function () {
    const that = this;
    let done = 0;
    const finish = () => {
      done++;
      if (done >= 3) wx.stopPullDownRefresh();
    };
    wx.cloud.callFunction({
      name: 'category',
      data: { action: 'stats' },
      success: (res) => {
        if (res.result && res.result.success) {
          const data = res.result.data;
          that.setData({
            totalQuestions: data.totalQuestions || 0,
            todayAdded: data.todayAdded || 0,
            pendingCount: data.pendingCount || 0
          });
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
    fetchPendingQuestions()
      .then((list) => {
        that.setData({ pendingCount: list.length });
      })
      .catch(() => {})
      .finally(finish);
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
            todayAdded: data.todayAdded || 0,
            pendingCount: data.pendingCount || 0
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

  loadPending: function () {
    fetchPendingQuestions()
      .then((list) => {
        this.setData({ pendingCount: list.length });
      })
      .catch(() => {});
  },

  startWatch: function () {
    this.stopWatch();
    this._watcher = startPendingWatch((docs) => {
      const pendingCount = docs.length;
      const prevCount = this.data.pendingCount;
      this.setData({ pendingCount });
      if (prevCount > 0 && pendingCount === 0) {
        this.fetchStats();
        this.fetchCategories();
      }
    });
  },

  stopWatch: function () {
    closePendingWatch(this._watcher);
    this._watcher = null;
  },

  goToAnalyzing: function () {
    wx.navigateTo({ url: '/pages/analyzing/analyzing' });
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
