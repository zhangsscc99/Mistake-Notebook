// pages/analyzing/analyzing.js
const { startPendingWatch, closePendingWatch, fetchPendingQuestions } = require('../../utils/aiPendingWatch.js');

function decorateItem(item, index) {
  const status = item.aiStatus || 'pending';
  const isAnalyzing = status === 'pending' || status === 'processing';
  const isFailed = status === 'failed';
  return {
    ...item,
    displayIndex: index + 1,
    isAnalyzing,
    isFailed,
    statusText: isFailed ? '解析失败' : (status === 'processing' ? 'AI 解析中…' : '等待解析…')
  };
}

Page({
  data: {
    pendingList: [],
    pendingCount: 0,
    loading: true,
    allDone: false
  },

  onShow() {
    this.loadPending();
    this.startWatch();
  },

  onPullDownRefresh() {
    this.loadPending();
    setTimeout(() => wx.stopPullDownRefresh(), 500);
  },

  onHide() {
    this.stopWatch();
  },

  onUnload() {
    this.stopWatch();
  },

  loadPending() {
    this.setData({ loading: true });
    fetchPendingQuestions()
      .then((list) => {
        this.applyPendingList(list);
      })
      .catch((err) => {
        wx.showToast({ title: (err && err.message) || '加载失败', icon: 'none' });
        this.setData({ loading: false });
      });
  },

  applyPendingList(list) {
    const pendingList = (list || []).map(decorateItem);
    this.setData({
      pendingList,
      pendingCount: pendingList.length,
      allDone: pendingList.length === 0,
      loading: false
    });
  },

  startWatch() {
    this.stopWatch();
    this._watcher = startPendingWatch((docs) => {
      this.applyPendingList(docs);
    });
  },

  stopWatch() {
    closePendingWatch(this._watcher);
    this._watcher = null;
  },

  retryQuestion(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;

    wx.showLoading({ title: '重新排队…', mask: true });
    wx.cloud.callFunction({
      name: 'question',
      data: { action: 'retry', id },
      success: (res) => {
        wx.hideLoading();
        if (res.result && res.result.success) {
          wx.showToast({ title: '已重新排队', icon: 'none' });
          this.loadPending();
        } else {
          wx.showToast({ title: (res.result && res.result.error) || '重试失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '重试失败', icon: 'none' });
      }
    });
  },

  goBack() {
    wx.navigateBack({
      fail: () => wx.switchTab({ url: '/pages/categories/categories' })
    });
  }
});
