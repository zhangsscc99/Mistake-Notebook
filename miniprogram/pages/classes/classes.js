const { formatDay } = require('../../utils/teacher');

function taskTime(iso) {
  return Date.parse(iso || '') || 0;
}

function homeworkAction(item) {
  if (item.submissionStatus === 'graded') {
    return item.submissionScore == null ? '已批改' : ('已批改 · ' + item.submissionScore + '分');
  }
  if (item.submissionStatus === 'submitted') return '已提交，等待批改';
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
      const [c, n, a] = await Promise.all([
        this.call('myClasses'),
        this.call('myNotebooks'),
        this.call('myAssignments')
      ]);
      const classes = c.success ? c.data || [] : [];
      const practices = ((n.success && n.data) || []).map((x) => ({
        key: 'practice-' + x.id,
        id: x.id,
        type: 'practice',
        title: x.title || '班级练习',
        meta: `${x.className || '班级'} · ${x.questionCount || 0} 道题`,
        createdAt: x.createdAt || '',
        badge: '练习',
        action: '查看题目 ›'
      }));
      const homeworks = ((a.success && a.data) || []).map((x) => ({
        key: 'homework-' + (x._id || x.id),
        id: x._id || x.id,
        type: 'homework',
        title: x.title || '班级作业',
        meta: `${(x.questionIds || []).length} 道题 · ${x.dueAt ? ('截止 ' + formatDay(x.dueAt)) : '未设截止'}`,
        createdAt: x.createdAt || '',
        badge: '作业',
        action: homeworkAction(x)
      }));
      const tasks = practices.concat(homeworks).sort((p, q) => taskTime(q.createdAt) - taskTime(p.createdAt));
      this.setData({ classes, tasks });
      this._ready = true;
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  openTask(e) {
    const { id, type } = e.currentTarget.dataset;
    if (!id) return;
    if (type === 'homework') {
      wx.navigateTo({ url: `/pages/assignment/assignment?id=${id}` });
    } else {
      wx.navigateTo({ url: `/pages/classPractice/classPractice?id=${id}` });
    }
  }
});
