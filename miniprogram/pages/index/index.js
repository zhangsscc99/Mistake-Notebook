// pages/index/index.js
const app = getApp();
const { ensureCloudSession, isAccessTokenError } = require('../../utils/cloud.js');

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
    let imageQuality = 'high';
    try {
      const settings = wx.getStorageSync('appSettings') || {};
      imageQuality = settings.imageQuality || 'high';
    } catch (e) {}
    // 'high' → original, 'medium'/'low' → compressed
    const sizeType = imageQuality === 'high' ? ['original'] : ['compressed'];

    if (wx.chooseMedia) {
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: sourceType,
        camera: 'back',
        success: (res) => {
          const file = res.tempFiles[0];
          if (imageQuality === 'low' && file.size > 500 * 1024) {
            that._compressImage(file.tempFilePath, 0.4);
          } else if (imageQuality === 'medium' && file.size > 1024 * 1024) {
            that._compressImage(file.tempFilePath, 0.7);
          } else {
            that.setData({ tempFilePath: file.tempFilePath });
          }
        }
      });
    } else {
      wx.chooseImage({
        count: 1,
        sizeType: sizeType,
        sourceType: sourceType,
        success: (res) => {
          that.setData({ tempFilePath: res.tempFilePaths[0] });
        }
      });
    }
  },

  _compressImage: function (filePath, quality) {
    const that = this;
    wx.compressImage({
      src: filePath,
      quality: Math.round(quality * 100),
      success: (res) => {
        that.setData({ tempFilePath: res.tempFilePath });
      },
      fail: () => {
        that.setData({ tempFilePath: filePath });
      }
    });
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

  callCloud: function (name, data, options) {
    const timeout = (options && options.timeout) || 60000;
    return new Promise((resolve, reject) => {
      const t0 = Date.now();
      wx.cloud.callFunction({
        name,
        data,
        config: { timeout },
        success: (res) => {
          const ms = Date.now() - t0;
          console.log(`[callCloud:${name}] 耗时 ${ms}ms`);
          resolve(res.result || {});
        },
        fail: (err) => {
          const ms = Date.now() - t0;
          console.error(`[callCloud:${name}] 失败 耗时 ${ms}ms`, err && err.errMsg);
          reject(err);
        }
      });
    });
  },

  handleCloudError: function (err, stepName) {
    wx.hideLoading();
    this.setData({ uploading: false });
    const errMsg = (err && err.errMsg) || String(err);
    if (isAccessTokenError(err)) {
      wx.showModal({
        title: '云开发未登录',
        content: '无法获取云开发凭证（access_token missing）。请依次检查：\n1. 关闭 VPN/系统代理\n2. 微信开发者工具右上角重新扫码登录\n3. 点击「云开发」确认环境 ai-mistake-notebook-d6byf98c0b95 已选中\n4. 清缓存后重新编译',
        showCancel: false
      });
      return;
    }
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
    const tPipeline = Date.now();

    try {
      // Step 1: validate file
      const filePath = that.data.tempFilePath;
      console.log('[Step1] filePath:', filePath);
      if (!filePath) throw new Error('filePath 为空，无法上传');

      that.showLoading('上传图片中...');
      const cloudPath = 'questions/' + Date.now() + '.jpg';
      const tUpload = Date.now();
      console.log('[Step2] 开始上传 cloudPath:', cloudPath);

      await ensureCloudSession();

      const uploadRes = await new Promise((resolve, reject) => {
        const task = wx.cloud.uploadFile({
          cloudPath,
          filePath,
          config: { timeout: 60000 },
          success: (res) => {
            const ms = Date.now() - tUpload;
            console.log(`[Step2] 上传成功 耗时 ${ms}ms fileID:`, res.fileID);
            resolve(res);
          },
          fail: (err) => {
            const ms = Date.now() - tUpload;
            console.error(`[Step2] 上传失败 耗时 ${ms}ms errMsg:`, err && err.errMsg, 'full:', JSON.stringify(err));
            reject(err);
          }
        });
        if (task && task.onProgressUpdate) {
          task.onProgressUpdate((p) => {
            console.log('[Step2] 上传进度:', p.progress + '%', '已传:', p.totalBytesSent, '总:', p.totalBytesExpectedToSend);
          });
        }
      });
      fileID = uploadRes.fileID;
      const uploadMs = Date.now() - tUpload;

      that.showLoading('AI识别中...');
      const tSegment = Date.now();
      console.log('[Step3] 调用 segment 云函数 fileID:', fileID);
      const segmentRes = await that.callCloud('segment', {
        action: 'segment',
        fileID
      }, { timeout: 120000 });
      const segmentMs = Date.now() - tSegment;
      console.log(`[Step3] segment 返回 耗时 ${segmentMs}ms:`, JSON.stringify(segmentRes).slice(0, 200));
      if (!segmentRes.success) {
        throw new Error(segmentRes.error || 'AI识别失败');
      }
      const segments = (segmentRes.data && segmentRes.data.segments) || [];
      if (!segments.length) {
        throw new Error('未识别到题目');
      }
      console.log('[Step3] 识别题目数:', segments.length);

      const totalMs = Date.now() - tPipeline;
      console.log(`[识图流程] 总耗时 ${totalMs}ms（上传 ${uploadMs}ms + segment ${segmentMs}ms）`);

      const localImagePath = filePath;
      wx.hideLoading();
      that.setData({ uploading: false, tempFilePath: '' });

      app.globalData.recognitionDraft = {
        tempFilePath: localImagePath,
        fileID,
        segments
      };

      wx.navigateTo({ url: '/pages/questionPicker/questionPicker' });
    } catch (err) {
      const totalMs = Date.now() - tPipeline;
      console.error(`[识图流程失败] 总耗时 ${totalMs}ms`, err && err.errMsg || err);
      const step = fileID ? '云函数' : '上传';
      that.handleCloudError(err, step);
    }
  }
});
