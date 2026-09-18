const app = getApp();
const { callTeacher } = require('../../utils/teacher');
const { ensureCloudSession, isAccessTokenError } = require('../../utils/cloud.js');
const { getProfile, getCachedProfile, greetingPrefix } = require('../../utils/profile.js');

const MAX_IMAGES = 10;
const WECHAT_PICK_MAX = 9;

function syncImages(images) {
  const next = (images || []).slice(0, MAX_IMAGES);
  const n = next.length;
  return {
    images: next,
    imageCount: n,
    canAddMore: n < MAX_IMAGES,
    processLabel: n ? ('开始识别 (' + n + '张)') : '开始识别'
  };
}

function buildGreeting(nickName) {
  const prefix = greetingPrefix();
  const name = (nickName || '').trim();
  return name ? prefix + '，' + name : prefix;
}

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
  data: Object.assign({
    uploading: false,
    recentRecords: [],
    avatarFileID: '',
    nickName: '',
    greeting: ''
  }, syncImages([])),

  onShow() {
    this.loadProfile();
    this.loadRecentRecords();
  },

  goMine() {
    wx.reLaunch({ url: '/pages/teacherMine/teacherMine' });
  },

  loadProfile() {
    const apply = (p) => this.setData({
      avatarFileID: (p && p.avatarFileID) || '',
      nickName: (p && p.nickName) || '',
      greeting: buildGreeting(p && p.nickName)
    });
    apply(getCachedProfile());
    getProfile().then(apply).catch(() => {});
  },

  loadRecentRecords() {
    callTeacher('listBank').then((r) => {
      if (!r.success || !Array.isArray(r.data)) return;
      const records = r.data.slice(0, 10).map((q) => ({
        id: q.id || q._id,
        title: buildRecentTitle(q),
        timeText: formatTime(q.createdAt)
      }));
      this.setData({ recentRecords: records });
    }).catch(() => {});
  },

  viewRecord() {
    wx.reLaunch({ url: '/pages/teacherQuestions/teacherQuestions?bank=1' });
  },

  takePhoto() { this._chooseImageWithSource(['camera']); },
  selectFromGallery() { this._chooseImageWithSource(['album']); },
  addMoreImages() { this._chooseImageWithSource(['album', 'camera']); },

  _chooseImageWithSource(sourceType) {
    const remaining = MAX_IMAGES - this.data.images.length;
    if (remaining <= 0) {
      wx.showToast({ title: '一次最多10张', icon: 'none' });
      return;
    }
    const isCamera = sourceType.length === 1 && sourceType[0] === 'camera';
    const count = isCamera ? 1 : Math.min(WECHAT_PICK_MAX, remaining);
    const that = this;
    if (wx.chooseMedia) {
      wx.chooseMedia({
        count,
        mediaType: ['image'],
        sourceType,
        camera: 'back',
        success: (res) => {
          const files = (res.tempFiles || []).map((file) => ({
            path: file.tempFilePath,
            size: file.size || 0
          }));
          that._appendImages(files);
        }
      });
    } else {
      wx.chooseImage({
        count,
        sourceType,
        success: (res) => {
          const files = (res.tempFilePaths || []).map((path) => ({ path, size: 0 }));
          that._appendImages(files);
        }
      });
    }
  },

  _appendImages(files) {
    const room = MAX_IMAGES - this.data.images.length;
    if (room <= 0) {
      wx.showToast({ title: '一次最多10张', icon: 'none' });
      return;
    }
    const next = this.data.images.concat((files || []).slice(0, room).map((f, i) => ({
      id: Date.now() + '-' + i,
      path: f.path
    })));
    this.setData(syncImages(next));
  },

  removeImage(e) {
    const index = Number(e.currentTarget.dataset.index);
    const images = this.data.images.slice();
    images.splice(index, 1);
    this.setData(syncImages(images));
  },

  moveImageLeft(e) {
    const index = Number(e.currentTarget.dataset.index);
    if (index <= 0) return;
    this._swapImages(index, index - 1);
  },

  moveImageRight(e) {
    const index = Number(e.currentTarget.dataset.index);
    if (index >= this.data.images.length - 1) return;
    this._swapImages(index, index + 1);
  },

  _swapImages(a, b) {
    const images = this.data.images.slice();
    const tmp = images[a];
    images[a] = images[b];
    images[b] = tmp;
    this.setData(syncImages(images));
  },

  submitQuestion() {
    if (!this.data.images.length) {
      wx.showToast({ title: '请先选择图片', icon: 'none' });
      return;
    }
    this.setData({ uploading: true });
    this.runRecognitionPipeline();
  },

  showLoading(title) {
    wx.showLoading({ title, mask: true });
  },

  callCloud(name, data, options) {
    const timeout = (options && options.timeout) || 60000;
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name,
        data,
        config: { timeout },
        success: (res) => resolve(res.result || {}),
        fail: reject
      });
    });
  },

  handleCloudError(err, stepName) {
    wx.hideLoading();
    this.setData({ uploading: false });
    const errMsg = (err && err.errMsg) || String(err);
    if (isAccessTokenError(err)) {
      wx.showModal({
        title: '云开发未登录',
        content: '无法获取云开发凭证。请重新编译后再试。',
        showCancel: false
      });
      return;
    }
    if (errMsg.includes('-504003') || errMsg.includes('timed out') || /timeout/i.test(errMsg)) {
      wx.showModal({
        title: '识别超时',
        content: '这次照片较多或较糊。请少选几张再试，跨页题保留相邻两页即可。',
        showCancel: false
      });
      return;
    }
    wx.showModal({
      title: stepName + '失败',
      content: errMsg,
      showCancel: false
    });
  },

  _uploadOne(filePath, index) {
    const cloudPath = 'teacher-bank/' + Date.now() + '-' + index + '-' + Math.random().toString(36).slice(2, 8) + '.jpg';
    return new Promise((resolve, reject) => {
      wx.cloud.uploadFile({
        cloudPath,
        filePath,
        config: { timeout: 60000 },
        success: (res) => resolve(res.fileID),
        fail: reject
      });
    });
  },

  async runRecognitionPipeline() {
    let uploadedAny = false;
    try {
      const localPages = (this.data.images || []).map((item) => item.path).filter(Boolean);
      if (!localPages.length) throw new Error('filePath 为空，无法上传');
      await ensureCloudSession();
      const fileIDs = [];
      for (let i = 0; i < localPages.length; i++) {
        this.showLoading('上传图片 ' + (i + 1) + '/' + localPages.length);
        fileIDs.push(await this._uploadOne(localPages[i], i));
        uploadedAny = true;
      }
      this.showLoading('AI识别中');
      const segmentPayload = fileIDs.length === 1
        ? { action: 'segment', fileID: fileIDs[0] }
        : { action: 'segment', fileIDs, fileID: fileIDs[0] };
      const segmentRes = await this.callCloud('segment', segmentPayload, { timeout: 300000 });
      if (!segmentRes.success) throw new Error(segmentRes.error || 'AI识别失败');
      const segments = (segmentRes.data && segmentRes.data.segments) || [];
      if (!segments.length) throw new Error('未识别到题目');
      wx.hideLoading();
      this.setData(Object.assign({ uploading: false }, syncImages([])));
      app.globalData.recognitionDraft = {
        mode: 'teacher_bank',
        tempFilePath: localPages[0],
        fileID: fileIDs[0],
        pages: localPages.map((path, index) => ({
          tempFilePath: path,
          fileID: fileIDs[index]
        })),
        fileIDs,
        segments
      };
      wx.navigateTo({ url: '/pages/teacherBankPicker/teacherBankPicker' });
    } catch (err) {
      this.handleCloudError(err, uploadedAny ? '云函数' : '上传');
    }
  }
});
