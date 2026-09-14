Page({
  data: { loading: true, isTeacher: false, classes: [], selectedClass: {}, students: [], studentCount: 0, messageCount: 0 },

  onLoad() { this.loadDashboard(); },
  onPullDownRefresh() { this.loadDashboard().finally(() => wx.stopPullDownRefresh()); },

  call(action, data = {}) {
    return new Promise((resolve, reject) => wx.cloud.callFunction({ name: 'teacher', data: { action, ...data }, success: r => resolve(r.result || {}), fail: reject }));
  },

  async loadDashboard() {
    this.setData({ loading: true });
    try {
      const result = await this.call('dashboard');
      if (!result.success) throw new Error(result.error || '加载失败');
      const data = result.data || {};
      const classes = data.classes || [];
      const selectedClass = classes.find(c => c.id === this.data.selectedClass.id) || classes[0] || {};
      this.setData({ isTeacher: true, classes, selectedClass, students: data.students || [], studentCount: data.studentCount || 0, messageCount: data.messageCount || 0 });
    } catch (e) {
      this.setData({ isTeacher: false });
      if (e.message !== 'NOT_TEACHER') wx.showToast({ title: e.message || '加载失败', icon: 'none' });
    } finally { this.setData({ loading: false }); }
  },

  async createClass() {
    const name = await new Promise(resolve => wx.showModal({ title: '新建班级', editable: true, placeholderText: '例如：高一（3）班', confirmText: '创建', success: r => resolve(r.confirm ? (r.content || '').trim() : '') }));
    if (!name) return;
    const result = await this.call('createClass', { name });
    if (!result.success) return wx.showToast({ title: result.error || '创建失败', icon: 'none' });
    wx.showToast({ title: '班级已创建', icon: 'success' });
    this.loadDashboard();
  },

  async selectClass(e) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.classes.find(c => c.id === id);
    if (!item) return;
    const result = await this.call('students', { classId: id });
    this.setData({ selectedClass: item, students: result.success ? (result.data || []) : [] });
  },

  showStudent(e) {
    const student = this.data.students.find(s => s.id === e.currentTarget.dataset.id);
    if (!student) return;
    wx.showModal({ title: student.nickName || '学生情况', content: `错题 ${student.questionCount || 0} 道\n近7天练习 ${student.practiceCount || 0} 次\n最近学习：${student.lastActiveAt || '暂无记录'}`, showCancel: false, confirmText: '知道了' });
  },

  openMessage() {
    if (!this.data.selectedClass.id) return wx.showToast({ title: '请先选择班级', icon: 'none' });
    wx.showModal({ title: '发送班级留言', editable: true, placeholderText: '写下给学生的话', confirmText: '发送', success: async r => { if (!r.confirm || !r.content.trim()) return; const result = await this.call('message', { classId: this.data.selectedClass.id, content: r.content.trim() }); if (result.success) wx.showToast({ title: '留言已发送', icon: 'success' }); else wx.showToast({ title: result.error || '发送失败', icon: 'none' }); } });
  },

  comingSoon() { wx.showToast({ title: '功能正在接入中', icon: 'none' }); }
});
