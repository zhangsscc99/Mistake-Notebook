// pages/index/index.js
const app = getApp();

function formatTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
  return Math.floor(diff / 86400000) + '天前';
}

function buildRecentTitle(question) {
  const categoryName = question.category || '未分类';
  const plain = (question.content || '').replace(/\s+/g, ' ').trim();
  if (!plain) return categoryName + '题';
  const short = plain.length > 22 ? plain.slice(0, 22) + '...' : plain;
  return categoryName + '题 - ' + short;
}

Page({
  data: {
    tempFilePath: '',
    uploading: false,
    recentRecords: []
  },

  onShow: function () {
    this.loadRecentRecords();
  },

  loadRecentRecords: function () {
    const that = this;
    wx.cloud.callFunction({
      name: 'question',
      data: { action: 'list' },
      success: (res) => {
        if (res.result && res.result.success && Array.isArray(res.result.data)) {
          const records = res.result.data.slice(0, 10).map((q) => ({
            id: q._id || q.id,
            title: buildRecentTitle(q),
            timeText: formatTime(q.createdAt),
            categoryId: q.categoryId || '',
            categoryName: q.category || ''
          }));
          that.setData({ recentRecords: records });
        }
      },
      fail: () => {}
    });
  },

  viewRecord: function (e) {
    const item = e.currentTarget.dataset;
    const id = item.categoryid || '';
    const name = item.categoryname || '分类详情';
    if (id) {
      wx.navigateTo({ url: `/pages/categoryDetail/categoryDetail?id=${id}&name=${encodeURIComponent(name)}` });
    } else {
      wx.showToast({ title: '未找到该题目的分类', icon: 'none' });
    }
  },

  takePhoto: function () {
    this._chooseImageWithSource(['camera']);
  },

  selectFromGallery: function () {
    this._chooseImageWithSource(['album']);
  },

  _chooseImageWithSource: function (sourceType) {
    const that = this;
    if (wx.chooseMedia) {
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: sourceType,
        camera: 'back',
        success: (res) => {
          that.setData({ tempFilePath: res.tempFiles[0].tempFilePath });
        }
      });
    } else {
      wx.chooseImage({
        count: 1,
        sizeType: ['original', 'compressed'],
        sourceType: sourceType,
        success: (res) => {
          that.setData({ tempFilePath: res.tempFilePaths[0] });
        }
      });
    }
  },

  chooseImage: function () {
    this._chooseImageWithSource(['album', 'camera']);
  },

  resetImage: function () {
    this.setData({
      tempFilePath: '',
      uploading: false
    });
  },

  submitQuestion: function () {
    if (!this.data.tempFilePath) {
      wx.showToast({ title: '请先选择图片', icon: 'none' });
      return;
    }

    this.setData({ uploading: true });
    this.runRecognitionPipeline();
  },

  showLoading: function (title) {
    wx.showLoading({ title, mask: true });
  },

  callCloud: function (name, data) {
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name,
        data,
        success: (res) => resolve(res.result || {}),
        fail: reject
      });
    });
  },

  handleCloudError: function (err, stepName) {
    wx.hideLoading();
    this.setData({ uploading: false });
    const errMsg = (err && err.errMsg) || String(err);
    if (errMsg.includes('-504003') || errMsg.includes('timed out')) {
      wx.showModal({
        title: `${stepName}超时`,
        content: `请在云开发控制台将相关云函数超时改为 60 秒（至少：segment、classify、answer、upload），然后重新部署。`,
        showCancel: false
      });
      return;
    }
    wx.showModal({
      title: `${stepName}失败`,
      content: errMsg,
      showCancel: false
    });
  },

  /**
   * 识图流程（对齐网页端）：上传 → AI切题 → 跳转题目选择页
   */
  runRecognitionPipeline: async function () {
    const that = this;
    let fileID = '';

    try {
      that.showLoading('上传图片中...');
      const cloudPath = 'questions/' + Date.now() + '.jpg';
      const uploadRes = await new Promise((resolve, reject) => {
        wx.cloud.uploadFile({
          cloudPath,
          filePath: that.data.tempFilePath,
          success: resolve,
          fail: reject
        });
      });
      fileID = uploadRes.fileID;

      that.showLoading('AI识别中...');
      const segmentRes = await that.callCloud('segment', {
        action: 'segment',
        fileID
      });
      if (!segmentRes.success) {
        throw new Error(segmentRes.error || 'AI识别失败');
      }
      const segments = (segmentRes.data && segmentRes.data.segments) || [];
      if (!segments.length) {
        throw new Error('未识别到题目');
      }

      const localImagePath = that.data.tempFilePath;
      wx.hideLoading();
      that.setData({ uploading: false, tempFilePath: '' });

      app.globalData.recognitionDraft = {
        tempFilePath: localImagePath,
        fileID,
        segments
      };

      wx.navigateTo({ url: '/pages/questionPicker/questionPicker' });
    } catch (err) {
      console.error('识图流程失败:', err);
      const step = fileID ? '云函数' : '上传';
      that.handleCloudError(err, step);
    }
  }
});
