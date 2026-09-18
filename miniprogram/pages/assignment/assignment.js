const { callTeacher, formatDay, isPastDue } = require('../../utils/teacher');
const { ensureCloudSession } = require('../../utils/cloud');

function statusCopy(status, score, overdue) {
  if (status === 'graded') {
    return score == null ? '已批改' : ('已批改 · ' + score + '分');
  }
  if (overdue) {
    return status === 'submitted' ? '已截止，等待老师批改' : '已过截止时间，不能再提交';
  }
  if (status === 'submitted') return '已提交，等待批改。批改前还可修改再交';
  return '可以打字，也可以拍照或从相册上传图片。老师批改后就不能再改';
}

Page({
  data: {
    loading: true,
    title: '',
    meta: '',
    status: 'pending',
    statusText: '',
    scoreText: '',
    readOnly: false,
    canSubmit: true,
    submitLabel: '提交作业',
    comment: '',
    questions: [],
    answers: [],
    answerImages: [],
    uploadingIndex: -1,
    submitting: false
  },

  onLoad(options) {
    this.id = (options && options.id) || '';
    this.load();
  },

  async load() {
    if (!this.id) {
      this.setData({ loading: false, title: '未找到' });
      return;
    }
    this.setData({ loading: true });
    try {
      const r = await callTeacher('myAssignmentDetail', { assignmentId: this.id });
      if (!r.success) throw new Error(r.error || '加载失败');
      const d = r.data || {};
      const marks = Array.isArray(d.marks) ? d.marks : [];
      const questions = (d.questions || []).map((q, i) => {
        const result = marks[i] === 'right' || marks[i] === 'wrong' ? marks[i] : '';
        return {
          ...q,
          index: i + 1,
          imageUrl: q.imageUrl || '',
          result,
          resultLabel: result === 'right' ? '对' : (result === 'wrong' ? '错' : '')
        };
      });
      const answers = questions.map((_, i) => String((d.answers && d.answers[i]) || ''));
      const answerImages = questions.map((_, i) => String((d.answerImages && d.answerImages[i]) || ''));
      const status = d.submissionStatus || 'pending';
      const score = d.submissionScore;
      const overdue = !!d.overdue || isPastDue(d.dueAt);
      this.setData({
        title: d.title || '班级作业',
        meta: (d.dueAt ? ('截止 ' + formatDay(d.dueAt)) : '未设截止') + (overdue ? ' · 已截止' : '') + ' · ' + questions.length + ' 道题',
        status,
        statusText: statusCopy(status, score, overdue),
        scoreText: status === 'graded' && score != null ? String(score) : '',
        comment: d.comment || '',
        readOnly: !!d.readOnly || overdue,
        canSubmit: d.canSubmit !== false && !overdue,
        submitLabel: status === 'submitted' ? '重新提交' : '提交作业',
        questions,
        answers,
        answerImages
      });
      wx.setNavigationBarTitle({
        title: status === 'graded' ? '作业批改' : (status === 'submitted' ? '已交作业' : '完成作业')
      });
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' });
      this.setData({ title: '加载失败' });
    } finally {
      this.setData({ loading: false });
    }
  },

  onAnswer(e) {
    if (this.data.readOnly) return;
    const answers = this.data.answers.slice();
    answers[e.currentTarget.dataset.index] = e.detail.value;
    this.setData({ answers });
  },

  clearImage(e) {
    const index = e.currentTarget.dataset.index;
    const questions = this.data.questions.slice();
    if (!questions[index]) return;
    questions[index] = Object.assign({}, questions[index], { imageUrl: '' });
    this.setData({ questions });
  },

  previewImage(e) {
    const url = e.currentTarget.dataset.url;
    if (!url) return;
    wx.previewImage({ urls: [url], current: url });
  },

  chooseAnswerImage(e) {
    if (this.data.readOnly || this.data.uploadingIndex >= 0) return;
    const index = Number(e.currentTarget.dataset.index);
    const source = e.currentTarget.dataset.source === 'album' ? ['album'] : ['camera'];
    this._pickAnswerImage(index, source);
  },

  _pickAnswerImage(index, sourceType) {
    const that = this;
    const onPicked = (filePath) => {
      if (!filePath) return;
      that._uploadAnswerImage(index, filePath);
    };
    if (wx.chooseMedia) {
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType,
        camera: 'back',
        success: (res) => {
          const file = (res.tempFiles || [])[0] || {};
          onPicked(file.tempFilePath);
        }
      });
    } else {
      wx.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType,
        success: (res) => onPicked((res.tempFilePaths || [])[0])
      });
    }
  },

  _uploadOne(filePath, index) {
    const cloudPath = 'homework/' + this.id + '/' + Date.now() + '-' + index + '-' + Math.random().toString(36).slice(2, 8) + '.jpg';
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

  async _uploadAnswerImage(index, filePath) {
    this.setData({ uploadingIndex: index });
    try {
      await ensureCloudSession();
      const fileID = await this._uploadOne(filePath, index);
      const answerImages = this.data.answerImages.slice();
      answerImages[index] = fileID;
      this.setData({ answerImages });
    } catch (e) {
      wx.showToast({ title: (e && e.errMsg) || e.message || '上传失败', icon: 'none' });
    } finally {
      this.setData({ uploadingIndex: -1 });
    }
  },

  removeAnswerImage(e) {
    if (this.data.readOnly) return;
    const index = Number(e.currentTarget.dataset.index);
    const answerImages = this.data.answerImages.slice();
    answerImages[index] = '';
    this.setData({ answerImages });
  },

  async submit() {
    if (this.data.submitting || this.data.readOnly || !this.data.canSubmit) return;
    if (this.data.uploadingIndex >= 0) {
      return wx.showToast({ title: '图片还在上传', icon: 'none' });
    }
    const texts = this.data.answers || [];
    const images = this.data.answerImages || [];
    const blank = texts.every((a, i) => !String(a || '').trim() && !String(images[i] || '').trim());
    if (blank) {
      const ok = await new Promise((resolve) => wx.showModal({
        title: '答案还是空的',
        content: '确定提交空白作业吗？',
        confirmText: '提交',
        success: (r) => resolve(!!r.confirm)
      }));
      if (!ok) return;
    }
    this.setData({ submitting: true });
    try {
      const r = await callTeacher('submitAssignment', {
        assignmentId: this.id,
        answers: this.data.answers,
        answerImages: this.data.answerImages
      });
      if (!r.success) throw new Error(r.error || '提交失败');
      wx.showToast({ title: '已提交', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 700);
    } catch (e) {
      wx.showToast({ title: e.message || '提交失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  }
});
