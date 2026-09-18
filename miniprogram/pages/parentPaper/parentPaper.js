const { callParent, selectedChildId, setSelectedChildId } = require('../../utils/parent');
const { formatDay } = require('../../utils/teacher');
const { normalizePaperQuestion } = require('../../utils/paper.js');

Page({
  data: {
    loading: true,
    children: [],
    childId: '',
    childName: '',
    papers: [],
    totalQuestionCount: 0
  },

  onShow() { this.boot(); },
  onPullDownRefresh() { this.boot().finally(() => wx.stopPullDownRefresh()); },

  async boot() {
    this.setData({ loading: true });
    try {
      const r = await callParent('myChildren');
      const children = (r.success && r.data) || [];
      let childId = selectedChildId();
      if (childId && !children.some((c) => c.studentId === childId)) childId = '';
      if (!childId && children[0]) childId = children[0].studentId;
      setSelectedChildId(childId);
      const current = children.find((c) => c.studentId === childId) || {};
      this.setData({ children, childId, childName: current.nickName || '' });
      if (childId) await this.loadPapers(childId);
      else this.setData({ papers: [], totalQuestionCount: 0 });
    } finally {
      this.setData({ loading: false });
    }
  },

  async loadPapers(studentId) {
    const r = await callParent('childPapers', { studentId });
    const papers = ((r.success && r.data) || []).map((p) => ({
      ...p,
      createdAt: formatDay(p.createdAt)
    }));
    const totalQuestionCount = papers.reduce((n, p) => n + (p.questionCount || 0), 0);
    this.setData({ papers, totalQuestionCount });
  },

  selectChild(e) {
    const id = e.currentTarget.dataset.id;
    if (!id || id === this.data.childId) return;
    setSelectedChildId(id);
    const current = this.data.children.find((c) => c.studentId === id) || {};
    this.setData({ childId: id, childName: current.nickName || '' });
    this.loadPapers(id);
  },

  createNewPaper() {
    if (!this.data.childId) return wx.showToast({ title: '请先绑定孩子', icon: 'none' });
    wx.navigateTo({ url: '/pages/parentPaperPick/parentPaperPick' });
  },

  openPaper(e) {
    const id = e.currentTarget.dataset.id;
    const paper = this.data.papers.find((p) => p.id === id);
    if (!paper) return;
    const questionsList = (paper.questions || []).map((q, i) => (i + 1) + '. ' + (q.content || '')).join('\n');
    wx.showModal({
      title: paper.title,
      content: `共 ${paper.questionCount} 道题\n${questionsList.slice(0, 200)}${questionsList.length > 200 ? '...' : ''}`,
      confirmText: '导出PDF',
      cancelText: '关闭',
      success: (res) => {
        if (res.confirm) this.showExportOptions(paper);
      }
    });
  },

  showExportOptions(paper) {
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
        totalScore: paper.totalScore || (paper.questionCount || 0) * 5,
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
            wx.openDocument({ filePath: dl.tempFilePath, fileType: 'pdf', showMenu: true });
          },
          fail: () => wx.showToast({ title: 'PDF已生成', icon: 'success' })
        });
      },
      fail: (err) => {
        wx.hideLoading();
        wx.showModal({ title: '导出失败', content: err.errMsg || '请稍后重试', showCancel: false });
      }
    });
  }
});
