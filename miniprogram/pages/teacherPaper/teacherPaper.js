const { callTeacher, formatDay, defaultDateRange } = require('../../utils/teacher');

Page({
  data: {
    loading: true,
    papers: [],
    totalQuestionCount: 0,
    fromDate: '',
    toDate: '',
    today: ''
  },

  onLoad() {
    this.boot();
  },
  onShow() {
    if (this._ready) this.reload();
  },
  onPullDownRefresh() { this.reload().finally(() => wx.stopPullDownRefresh()); },

  async boot() {
    const range = defaultDateRange();
    this.setData({
      fromDate: range.from,
      toDate: range.to,
      today: range.today
    });
    await this.reload();
    this._ready = true;
  },

  async reload() {
    this.setData({ loading: true });
    try {
      const range = {
        from: this.data.fromDate,
        to: this.data.toDate
      };
      const papers = await callTeacher('listPapers', range);
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

  onFromDate(e) {
    let fromDate = e.detail.value;
    let toDate = this.data.toDate;
    if (fromDate > toDate) toDate = fromDate;
    this.setData({ fromDate, toDate }, () => this.reload());
  },

  onToDate(e) {
    let toDate = e.detail.value;
    let fromDate = this.data.fromDate;
    if (fromDate > toDate) fromDate = toDate;
    this.setData({ fromDate, toDate }, () => this.reload());
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
