const { callParent } = require('../../utils/parent');
const { formatDay, isPastDue } = require('../../utils/teacher');

function statusCopy(status, score, overdue) {
  if (status === 'graded') {
    return score == null ? '已批改' : ('已批改 · ' + score + '分');
  }
  if (overdue) {
    return status === 'submitted' ? '已截止，等待老师批改' : '已过截止时间，未提交';
  }
  if (status === 'submitted') return '已提交，等待批改';
  return '尚未提交';
}

Page({
  data: {
    loading: true,
    title: '',
    meta: '',
    status: 'pending',
    statusText: '',
    scoreText: '',
    comment: '',
    questions: []
  },

  onLoad(options) {
    this.id = (options && options.id) || '';
    this.studentId = (options && options.studentId) || '';
    this.load();
  },

  async load() {
    if (!this.id || !this.studentId) {
      this.setData({ loading: false, title: '未找到' });
      return;
    }
    this.setData({ loading: true });
    try {
      const r = await callParent('childHomeworkDetail', {
        assignmentId: this.id,
        studentId: this.studentId
      });
      if (!r.success) throw new Error(r.error || '加载失败');
      const d = r.data || {};
      const marks = Array.isArray(d.marks) ? d.marks : [];
      const questions = (d.questions || []).map((q, i) => {
        const result = marks[i] === 'right' || marks[i] === 'wrong' ? marks[i] : '';
        return {
          ...q,
          index: i + 1,
          imageUrl: q.imageUrl || '',
          answer: String((d.answers && d.answers[i]) || ''),
          result,
          resultLabel: result === 'right' ? '对' : (result === 'wrong' ? '错' : '')
        };
      });
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
        questions
      });
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' });
      this.setData({ title: '加载失败' });
    } finally {
      this.setData({ loading: false });
    }
  },

  previewImage(e) {
    const url = e.currentTarget.dataset.url;
    if (!url) return;
    wx.previewImage({ urls: [url], current: url });
  },

  clearImage(e) {
    const index = e.currentTarget.dataset.index;
    const questions = this.data.questions.slice();
    if (!questions[index]) return;
    questions[index] = Object.assign({}, questions[index], { imageUrl: '' });
    this.setData({ questions });
  }
});
