const { callTeacher } = require('../../utils/teacher');

Page({
  data: {
    loading: true,
    isTeacher: false,
    classes: [],
    selectedClass: {},
    students: [],
    studentCount: 0,
    assignmentCount: 0
  },

  onLoad(options) {
    this._focus = (options && options.focus) || '';
    this.loadDashboard().then(() => {
      if (this._focus === 'students') {
        setTimeout(() => wx.pageScrollTo({ selector: '#section-students', duration: 280 }), 250);
      }
    });
  },
  onPullDownRefresh() { this.loadDashboard().finally(() => wx.stopPullDownRefresh()); },

  async loadDashboard() {
    this.setData({ loading: true });
    try {
      const result = await callTeacher('dashboard');
      if (!result.success) throw new Error(result.error || '加载失败');
      const data = result.data || {};
      const classes = data.classes || [];
      const selectedClass = classes.find((c) => c.id === this.data.selectedClass.id) || classes[0] || {};
      this.setData({
        isTeacher: true,
        classes,
        selectedClass,
        students: (data.students || []).map((s) => ({
          ...s,
          mark: (s.nickName || '学').slice(0, 1)
        })),
        studentCount: data.studentCount || 0,
        assignmentCount: data.assignmentCount || 0
      });
      if (selectedClass.id && selectedClass.id !== (classes[0] && classes[0].id)) {
        this.loadStudents(selectedClass.id);
      }
    } catch (e) {
      this.setData({ isTeacher: false });
      if (e.message !== 'NOT_TEACHER') wx.showToast({ title: e.message || '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  async loadStudents(classId) {
    const result = await callTeacher('students', { classId });
    this.setData({ students: result.success ? (result.data || []).map((s) => ({
      ...s,
      mark: (s.nickName || '学').slice(0, 1)
    })) : [] });
  },

  async createClass() {
    const name = await new Promise((resolve) => wx.showModal({
      title: '新建班级',
      editable: true,
      placeholderText: '例如：高一（3）班',
      confirmText: '创建',
      success: (r) => resolve(r.confirm ? (r.content || '').trim() : '')
    }));
    if (!name) return;
    const result = await callTeacher('createClass', { name });
    if (!result.success) return wx.showToast({ title: result.error || '创建失败', icon: 'none' });
    wx.showToast({ title: '班级已创建', icon: 'success' });
    this.loadDashboard();
  },

  async selectClass(e) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.classes.find((c) => c.id === id);
    if (!item) return;
    this.setData({ selectedClass: item });
    await this.loadStudents(id);
  },

  showStudent(e) {
    const studentId = e.currentTarget.dataset.id;
    const classId = this.data.selectedClass.id;
    if (!studentId || !classId) return;
    wx.navigateTo({
      url: `/pages/teacherStudent/teacherStudent?classId=${classId}&studentId=${studentId}`
    });
  },

  copyJoinCode(e) {
    const code = e.currentTarget.dataset.code;
    if (!code) return;
    wx.setClipboardData({
      data: String(code),
      success: () => wx.showToast({ title: '加入码已复制', icon: 'success' })
    });
  },

  openQuestions() { wx.reLaunch({ url: '/pages/teacherQuestions/teacherQuestions' }); },
  openPaper() { wx.reLaunch({ url: '/pages/teacherPaper/teacherPaper' }); },
  openAssignments() { wx.navigateTo({ url: '/pages/teacherAssignments/teacherAssignments' }); },
  openReport() {
    const classId = this.data.selectedClass.id || '';
    const q = classId ? ('?classId=' + classId) : '';
    wx.navigateTo({ url: '/pages/teacherReport/teacherReport' + q });
  }
});
