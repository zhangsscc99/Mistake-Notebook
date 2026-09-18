const { callParent, selectedChildId, setSelectedChildId } = require('../../utils/parent');
const { formatDay, isPastDue } = require('../../utils/teacher');

function homeworkAction(item) {
  if (item.submissionStatus === 'graded') {
    return item.submissionScore == null ? '已批改' : ('已批改 · ' + item.submissionScore + '分');
  }
  if (item.overdue || isPastDue(item.dueAt)) {
    return item.submissionStatus === 'submitted' ? '已截止，待批改' : '已截止未交';
  }
  if (item.submissionStatus === 'submitted') return '已提交，待批改';
  return '尚未提交';
}

Page({
  data: {
    loading: true,
    children: [],
    childId: '',
    childName: '',
    homework: []
  },

  onShow() {
    this.load();
  },
  onPullDownRefresh() {
    this.load().finally(() => wx.stopPullDownRefresh());
  },

  async load() {
    this.setData({ loading: true });
    try {
      const r = await callParent('myChildren');
      if (!r.success) throw new Error(r.error || '加载失败');
      const children = r.data || [];
      let childId = selectedChildId();
      if (childId && !children.some((c) => c.studentId === childId)) childId = '';
      if (!childId && children[0]) childId = children[0].studentId;
      setSelectedChildId(childId);
      const current = children.find((c) => c.studentId === childId) || {};
      let homework = [];
      if (childId) {
        const h = await callParent('childHomework', { studentId: childId });
        if (!h.success) throw new Error(h.error || '作业加载失败');
        homework = (h.data || []).map((x) => ({
          ...x,
          meta: `${x.questionCount || 0} 道题 · ${x.dueAt ? ((isPastDue(x.dueAt) || x.overdue ? '已截止 ' : '截止 ') + formatDay(x.dueAt)) : '未设截止'}`,
          action: homeworkAction(x)
        }));
      }
      this.setData({
        children,
        childId,
        childName: current.nickName || '',
        homework
      });
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  selectChild(e) {
    const id = e.currentTarget.dataset.id;
    if (!id || id === this.data.childId) return;
    setSelectedChildId(id);
    this.load();
  },

  goBind() {
    wx.navigateTo({ url: '/pages/parentBind/parentBind' });
  },

  openHomework(e) {
    const id = e.currentTarget.dataset.id;
    const childId = this.data.childId;
    if (!id || !childId) return;
    wx.navigateTo({
      url: '/pages/parentHomework/parentHomework?id=' + id + '&studentId=' + childId
    });
  }
});
