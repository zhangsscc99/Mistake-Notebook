const { formatDay, isPastDue } = require('../../utils/teacher');

function taskTime(iso) {
  return Date.parse(iso || '') || 0;
}

function homeworkAction(item) {
  if (item.submissionStatus === 'graded') {
    return item.submissionScore == null ? '已批改' : ('已批改 · ' + item.submissionScore + '分');
  }
  if (isPastDue(item.dueAt) && item.submissionStatus === 'pending') return '已截止';
  if (item.submissionStatus === 'submitted') return '已提交，可查看 ›';
  return '开始作答 ›';
}

Page({
  data: { classes: [], tasks: [], loading: true },

  onLoad() { this.load(); },
  onShow() { if (this._ready) this.load(); },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()); },

  call(action) {
    return new Promise((resolve, reject) => wx.cloud.callFunction({
      name: 'teacher',
      data: { action },
      success: (r) => resolve(r.result || {}),
      fail: reject
    }));
  },

  async load() {
    this.setData({ loading: true });
    try {
      const [c, a] = await Promise.all([
        this.call('myClasses'),
        this.call('myAssignments')
      ]);
      const classes = c.success ? c.data || [] : [];
      const tasks = ((a.success && a.data) || []).map((x) => ({
        key: 'homework-' + (x._id || x.id),
        id: x._id || x.id,
        title: x.title || '班级作业',
        meta: `${x.questionCount || (x.questionIds || []).length || 0} 道题 · ${x.dueAt ? ((isPastDue(x.dueAt) ? '已截止 ' : '截止 ') + formatDay(x.dueAt)) : '未设截止'}`,
        createdAt: x.createdAt || '',
        action: homeworkAction(x)
      })).sort((p, q) => taskTime(q.createdAt) - taskTime(p.createdAt));
      this.setData({ classes, tasks });
      this._ready = true;
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  openTask(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/assignment/assignment?id=${id}` });
  }
});
