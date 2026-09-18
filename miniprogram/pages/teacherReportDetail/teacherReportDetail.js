const { callTeacher, formatDay, shortText, defaultDateRange, decorateReport, buildCopyText } = require('../../utils/teacher');

function mapQuestions(list, start) {
  return (list || []).map((q, i) => ({
    ...q,
    index: start + i + 1,
    day: formatDay(q.createdAt),
    preview: shortText(q.content, 48)
  }));
}

Page({
  data: {
    loading: true,
    loadingMore: false,
    report: null,
    fromDate: '',
    toDate: '',
    today: '',
    questions: [],
    hasMore: false
  },

  onLoad(options) {
    this.reportId = (options && options.id) || '';
    const range = defaultDateRange();
    this.setData({ fromDate: range.from, toDate: range.to, today: range.today });
    this.load();
  },

  onFromDate(e) {
    let fromDate = e.detail.value;
    let toDate = this.data.toDate;
    if (fromDate > toDate) toDate = fromDate;
    this.setData({ fromDate, toDate, questions: [], hasMore: false });
    this.loadMistakes(false);
  },

  onToDate(e) {
    let toDate = e.detail.value;
    let fromDate = this.data.fromDate;
    if (fromDate > toDate) fromDate = toDate;
    this.setData({ fromDate, toDate, questions: [], hasMore: false });
    this.loadMistakes(false);
  },

  async load() {
    if (!this.reportId) {
      this.setData({ loading: false });
      return;
    }
    this.setData({ loading: true });
    try {
      const r = await callTeacher('parentReportDetail', { id: this.reportId });
      if (!r.success) throw new Error(r.error || '加载失败');
      this.setData({ report: decorateReport(r.data) });
      await this.loadMistakes(false);
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  async loadMistakes(append) {
    const classId = this.data.report && this.data.report.classId;
    if (!classId) {
      this.setData({ loading: false });
      return;
    }
    if (append && (this.data.loadingMore || !this.data.hasMore)) return;
    this.setData(append ? { loadingMore: true } : { loading: true });
    try {
      const r = await callTeacher('classMistakes', {
        classId,
        from: this.data.fromDate,
        to: this.data.toDate,
        skip: append ? this.data.questions.length : 0
      });
      if (!r.success) throw new Error(r.error || '错题加载失败');
      const d = r.data || {};
      const incoming = mapQuestions(d.questions, append ? this.data.questions.length : 0);
      this.setData({
        questions: append ? this.data.questions.concat(incoming) : incoming,
        hasMore: !!d.hasMore
      });
    } catch (e) {
      wx.showToast({ title: e.message || '错题加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false, loadingMore: false });
    }
  },

  loadMore() {
    this.loadMistakes(true);
  },

  copyReport() {
    if (!this.data.report) return;
    wx.setClipboardData({
      data: buildCopyText(this.data.report),
      success: () => wx.showToast({ title: '已复制，可发给家长', icon: 'success' })
    });
  },

  openStudent(e) {
    const studentId = e.currentTarget.dataset.id;
    const classId = this.data.report && this.data.report.classId;
    if (!studentId || !classId) return;
    wx.navigateTo({
      url: '/pages/teacherStudent/teacherStudent?classId=' + classId + '&studentId=' + studentId
    });
  },

  previewImage(e) {
    const url = e.currentTarget.dataset.url;
    if (!url) return;
    wx.previewImage({ urls: [url], current: url });
  }
});
