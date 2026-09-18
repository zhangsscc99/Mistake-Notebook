// pages/index/index.js
const app = getApp();
const { ensureCloudSession, isAccessTokenError } = require('../../utils/cloud.js');
const { getProfile, getCachedProfile, greetingPrefix } = require('../../utils/profile.js');
const { inviteCard, timelineCard, enableShareMenu } = require('../../utils/share.js');
const { dismissLoginOverlay, guardStudentShell } = require('../../utils/auth.js');

// 一次识别最多 10 张。微信 chooseMedia/chooseImage 单次最多 9 张，
// 满 9 张后再点「继续添加」可补到 10。
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

// 昵称最长 20 个码点（cloudfunctions/user/index.js 的 MAX_NICKNAME_LEN），
// 这里不截断，交给 WXSS 的省略号兜底；但昵称为空时不能留下一个孤零零的逗号
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
  data: {
    images: [],
    imageCount: 0,
    canAddMore: true,
    processLabel: '开始识别',
    uploading: false,
    recentRecords: [],
    avatarFileID: '',
    nickName: '',
    greeting: ''
  },

  onShow: function () {
    if (guardStudentShell()) return;
    dismissLoginOverlay();
    enableShareMenu();
    this.loadRecentRecords();
    this.loadProfile();
  },

  // 先铺缓存再拉最新的：头像和问候语不该等一次网络往返才出现。
  // getProfile() 非 force —— 其他页面已经拉过的话这里直接命中缓存，不再打云函数。
  loadProfile: function () {
    const apply = (p) => this.setData({
      avatarFileID: p.avatarFileID || '',
      nickName: p.nickName || '',
      greeting: buildGreeting(p.nickName)
    });

    apply(getCachedProfile());
    getProfile()
      .then(apply)
      .catch((err) => {
        // 拉失败就继续用缓存那份，不要把已经显示出来的头像问候语清掉
        console.warn('[index] 读取资料失败，沿用缓存', err);
      });
  },

  // 「我的」是 tab 页，必须 switchTab（navigateTo 跳 tab 页会直接失败）
  goProfile: function () {
    wx.switchTab({ url: '/pages/profile/profile' });
  },

  loadRecentRecords: function () {
    const that = this;
    wx.cloud.callFunction({
      name: 'question',
      data: { action: 'list' },
      success: (res) => {
        if (res.result && res.result.success && Array.isArray(res.result.data)) {
          const settled = res.result.data.filter((q) => {
            const status = q.aiStatus || '';
            return status !== 'pending' && status !== 'processing' && status !== 'failed';
          });
          const records = settled.slice(0, 10).map((q) => ({
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

  addMoreImages: function () {
    this._chooseImageWithSource(['album', 'camera']);
  },

  _chooseImageWithSource: function (sourceType) {
    const that = this;
    const remaining = MAX_IMAGES - this.data.images.length;
    if (remaining <= 0) {
      wx.showToast({ title: '一次最多10张', icon: 'none' });
      return;
    }

    let imageQuality = 'high';
    try {
      const settings = wx.getStorageSync('appSettings') || {};
      imageQuality = settings.imageQuality || 'high';
    } catch (e) {}
    const sizeType = imageQuality === 'high' ? ['original'] : ['compressed'];
    const isCamera = sourceType.length === 1 && sourceType[0] === 'camera';
    const count = isCamera ? 1 : Math.min(WECHAT_PICK_MAX, remaining);

    if (wx.chooseMedia) {
      wx.chooseMedia({
        count: count,
        mediaType: ['image'],
        sourceType: sourceType,
        camera: 'back',
        success: (res) => {
          const files = (res.tempFiles || []).map((file) => ({
            path: file.tempFilePath,
            size: file.size || 0
          }));
          that._appendImages(files, imageQuality);
        }
      });
    } else {
      wx.chooseImage({
        count: count,
        sizeType: sizeType,
        sourceType: sourceType,
        success: (res) => {
          const files = (res.tempFilePaths || []).map((path) => ({ path, size: 0 }));
          that._appendImages(files, imageQuality);
        }
      });
    }
  },

  _compressImage: function (filePath, quality) {
    return new Promise((resolve) => {
      wx.compressImage({
        src: filePath,
        quality: Math.round(quality * 100),
        success: (res) => resolve(res.tempFilePath || filePath),
        fail: () => resolve(filePath)
      });
    });
  },

  _appendImages: async function (files, imageQuality) {
    const room = MAX_IMAGES - this.data.images.length;
    if (room <= 0) {
      wx.showToast({ title: '一次最多10张', icon: 'none' });
      return;
    }

    const incoming = (files || []).filter((f) => f && f.path).slice(0, room);
    if (!incoming.length) return;

    const willBeMulti = this.data.images.length + incoming.length > 1;
    const prepared = [];
    for (let i = 0; i < incoming.length; i++) {
      const file = incoming[i];
      let quality = 0;
      if (imageQuality === 'low' && file.size > 500 * 1024) quality = 0.4;
      else if (imageQuality === 'medium' && file.size > 1024 * 1024) quality = 0.7;
      else if (willBeMulti && file.size > 400 * 1024) quality = 0.55;
      else if (file.size > 3 * 1024 * 1024) quality = 0.7;

      const path = quality ? await this._compressImage(file.path, quality) : file.path;
      prepared.push({
        id: Date.now() + '-' + i + '-' + Math.random().toString(36).slice(2, 8),
        path
      });
    }

    const images = this.data.images.concat(prepared);
    this.setData(syncImages(images));

    if ((files || []).length > incoming.length) {
      wx.showToast({ title: '一次最多10张，已截取前' + incoming.length + '张', icon: 'none' });
    }
  },

  chooseImage: function () {
    this._chooseImageWithSource(['album', 'camera']);
  },

  removeImage: function (e) {
    const index = Number(e.currentTarget.dataset.index);
    if (Number.isNaN(index)) return;
    const images = this.data.images.filter((_, i) => i !== index);
    this.setData(syncImages(images));
  },

  moveImageLeft: function (e) {
    const index = Number(e.currentTarget.dataset.index);
    if (index <= 0) return;
    this._swapImages(index, index - 1);
  },

  moveImageRight: function (e) {
    const index = Number(e.currentTarget.dataset.index);
    if (index >= this.data.images.length - 1) return;
    this._swapImages(index, index + 1);
  },

  _swapImages: function (a, b) {
    const images = this.data.images.slice();
    const tmp = images[a];
    images[a] = images[b];
    images[b] = tmp;
    this.setData(syncImages(images));
  },

  resetImage: function () {
    this.setData(Object.assign({ uploading: false }, syncImages([])));
  },

  submitQuestion: function () {
    if (!this.data.images.length) {
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
        content: '无法获取云开发凭证（access_token missing）。请依次检查：\n1. 关闭 VPN/系统代理\n2. 微信开发者工具右上角重新扫码登录\n3. 点击「云开发」确认环境 ai-mistakenotebook-d7cw2be1433bd 已选中\n4. 清缓存后重新编译',
        showCancel: false
      });
      return;
    }
    if (errMsg.includes('-504003') || errMsg.includes('timed out') || /timeout/i.test(errMsg)) {
      wx.showModal({
        title: '识别超时',
        content: '这次照片较多或较糊，识别超过时限了。请少选几张再试，跨页题保留相邻两页即可。',
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

  _uploadOne: function (filePath, index) {
    const cloudPath = 'questions/' + Date.now() + '-' + index + '-' + Math.random().toString(36).slice(2, 8) + '.jpg';
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

  /**
   * 识图流程：上传（可多张）→ AI切题（跨页合并）→ 跳转题目选择页
   */
  runRecognitionPipeline: async function () {
    const that = this;
    let uploadedAny = false;
    const tPipeline = Date.now();

    try {
      const localPages = (that.data.images || []).map((item) => item.path).filter(Boolean);
      if (!localPages.length) throw new Error('filePath 为空，无法上传');

      await ensureCloudSession();

      const fileIDs = [];
      const tUpload = Date.now();
      for (let i = 0; i < localPages.length; i++) {
        that.showLoading('上传图片 ' + (i + 1) + '/' + localPages.length);
        const fileID = await that._uploadOne(localPages[i], i);
        uploadedAny = true;
        fileIDs.push(fileID);
      }
      const uploadMs = Date.now() - tUpload;
      console.log(`[Step2] 上传 ${fileIDs.length} 张 耗时 ${uploadMs}ms`);

      that.showLoading('AI识别中');
      const tSegment = Date.now();
      const segmentPayload = fileIDs.length === 1
        ? { action: 'segment', fileID: fileIDs[0] }
        : { action: 'segment', fileIDs: fileIDs, fileID: fileIDs[0] };
      const segmentRes = await that.callCloud('segment', segmentPayload, { timeout: 300000 });
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

      wx.hideLoading();
      that.setData(Object.assign({ uploading: false }, syncImages([])));

      app.globalData.recognitionDraft = {
        tempFilePath: localPages[0],
        fileID: fileIDs[0],
        pages: localPages.map((path, index) => ({
          tempFilePath: path,
          fileID: fileIDs[index]
        })),
        fileIDs,
        segments
      };

      wx.navigateTo({ url: '/pages/questionPicker/questionPicker' });
    } catch (err) {
      const totalMs = Date.now() - tPipeline;
      console.error(`[识图流程失败] 总耗时 ${totalMs}ms`, err && err.errMsg || err);
      const step = uploadedAny ? '云函数' : '上传';
      that.handleCloudError(err, step);
    }
  },

  onShareAppMessage: function () {
    return inviteCard();
  },

  onShareTimeline: function () {
    return timelineCard();
  }
});
