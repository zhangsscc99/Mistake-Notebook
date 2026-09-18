const { callTeacher, formatDay } = require('../../utils/teacher');
const { normalizePaperQuestion } = require('../../utils/paper.js');

Page({
  data: {
    loading: true,
    type: 'paper',
    id: '',
    classId: '',
    title: '',
    kindLabel: '',
    meta: '',
    questions: []
  },

  onLoad(options) {
    const type = options && options.type === 'notebook' ? 'notebook' : 'paper';
    const id = (options && options.id) || '';
    this.setData({ type, id });
    this.load(type, id);
  },

  onShow() {
    if (this._ready && this.data.id) this.load(this.data.type, this.data.id);
  },

  async load(type, id) {
    if (!id) {
      this.setData({ loading: false, title: '未找到' });
      return;
    }
    this.setData({ loading: true });
    try {
      const action = type === 'notebook' ? 'notebookDetail' : 'paperDetail';
      const r = await callTeacher(action, { id });
      if (!r.success) throw new Error(r.error || '加载失败');
      const d = r.data || {};
      const questions = (d.questions || []).map((q, i) => ({
        ...q,
        index: i + 1
      }));
      this.setData({
        classId: d.classId || '',
        title: d.title || (type === 'notebook' ? '班级练习' : '试卷'),
        kindLabel: type === 'notebook' ? '已发给学生的练习' : '仅老师可见的试卷',
        meta: `${questions.length} 道题 · ${formatDay(d.createdAt) || ''}`,
        questions
      });
      wx.setNavigationBarTitle({
        title: type === 'notebook' ? '练习' : '试卷'
      });
      this._ready = true;
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' });
      this.setData({ title: '加载失败' });
    } finally {
      this.setData({ loading: false });
    }
  },

  sendToClass() {
    if (!this.data.questions.length) return wx.showToast({ title: '试卷里没有题目', icon: 'none' });
    const id = this.data.id;
    wx.navigateTo({
      url: `/pages/teacherAssignmentCreate/teacherAssignmentCreate?paperId=${id}`
    });
  },

  addMore() {
    const classId = this.data.classId;
    const id = this.data.id;
    if (!id) return;
    wx.navigateTo({
      url: `/pages/teacherQuestions/teacherQuestions?pick=1&paperId=${id}` + (classId ? '&classId=' + classId : '')
    });
  },

  exportPdf() {
    const paper = {
      title: this.data.title,
      duration: 90,
      totalScore: (this.data.questions || []).length * 5,
      questionCount: (this.data.questions || []).length,
      questions: this.data.questions
    };
    wx.showActionSheet({
      itemList: ['带解析版', '不带解析版'],
      success: (res) => this.generatePDF(paper, res.tapIndex === 0)
    });
  },

  generatePDF(paper, withAnalysis) {
    wx.showLoading({ title: '正在生成PDF...', mask: true });
    wx.cloud.callFunction({
      name: 'pdf',
      config: { timeout: 120000 },
      data: {
        action: 'generate',
        title: paper.title,
        duration: paper.duration || 90,
        totalScore: paper.totalScore,
        withAnalysis: !!withAnalysis,
        questions: (paper.questions || []).map((q) => {
          const normalized = normalizePaperQuestion(q);
          return {
            id: normalized.id,
            content: normalized.content,
            answer: normalized.answer || q.aiAnswer || '',
            analysis: normalized.analysis || q.aiAnalysis || '',
            tags: normalized.tags || [],
            difficulty: normalized.difficulty,
            needsAnswerArea: !withAnalysis
          };
        })
      },
      success: (res) => {
        wx.hideLoading();
        if (!res.result || !res.result.success) {
          wx.showToast({ title: (res.result && res.result.error) || '生成失败', icon: 'none' });
          return;
        }
        wx.cloud.downloadFile({
          fileID: res.result.data.fileID,
          success: (dl) => {
            wx.openDocument({
              filePath: dl.tempFilePath,
              fileType: 'pdf',
              showMenu: true,
              fail: () => wx.showToast({ title: 'PDF已生成', icon: 'success' })
            });
          },
          fail: () => wx.showToast({ title: '下载失败', icon: 'none' })
        });
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '生成失败', icon: 'none' });
      }
    });
  },

  async recall() {
    const isPaper = this.data.type === 'paper';
    const ok = await new Promise((resolve) => wx.showModal({
      title: isPaper ? '删除试卷' : '撤回练习',
      content: isPaper ? '删除后学生本来也看不见。只是从试卷列表拿掉。' : '撤回后学生在「我的班级」将看不到这份练习。',
      confirmText: isPaper ? '删除' : '撤回',
      confirmColor: '#e11d48',
      success: (r) => resolve(!!r.confirm)
    }));
    if (!ok) return;
    const action = isPaper ? 'recallPaper' : 'recallNotebook';
    const r = await callTeacher(action, { id: this.data.id });
    wx.showToast({
      title: r.success ? (isPaper ? '已删除' : '已撤回') : (r.error || '操作失败'),
      icon: r.success ? 'success' : 'none'
    });
    if (r.success) setTimeout(() => wx.navigateBack(), 500);
  }
});
