const { callTeacher, formatDay } = require('../../utils/teacher');

Page({
  data: {
    loading: true,
    papers: [],
    totalQuestionCount: 0
  },

  onLoad() {
    this.boot();
  },
  onShow() {
    if (this._ready) this.reload();
  },
  onPullDownRefresh() { this.reload().finally(() => wx.stopPullDownRefresh()); },

  async boot() {
    await this.reload();
    this._ready = true;
  },

  async reload() {
    this.setData({ loading: true });
    try {
      const papers = await callTeacher('listPapers');
      const list = ((papers.success && papers.data) || []).map((p) => ({
        ...p,
        createdAt: formatDay(p.createdAt)
      }));
      const totalQuestionCount = list.reduce((sum, p) => sum + (p.questionCount || 0), 0);
      this.setData({ papers: list, totalQuestionCount });
    } finally {
      this.setData({ loading: false });
    }
  },

  createNewPaper() {
    wx.reLaunch({
      url: '/pages/teacherQuestions/teacherQuestions?pick=1&from=paper'
    });
  },

  openPaper(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({
      url: '/pages/teacherSetDetail/teacherSetDetail?type=paper&id=' + id
    });
  }
});
