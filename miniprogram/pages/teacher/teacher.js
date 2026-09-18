const { callTeacher } = require('../../utils/teacher');

const PREVIEW = 6;

function withMark(list) {
  return (list || []).map((s) => ({
    ...s,
    mark: (s.nickName || '学').slice(0, 1)
  }));
}

function packStudents(list) {
  const students = withMark(list);
  return {
    students,
    previewStudents: students.slice(0, PREVIEW),
    studentMore: Math.max(0, students.length - PREVIEW)
  };
}

Page({
  data: {
    loading: true,
    isTeacher: false,
    classes: [],
    selectedClass: {},
    students: [],
    previewStudents: [],
    studentMore: 0,
    pendingStudents: [],
    studentCount: 0,
    assignmentCount: 0
  },

  onLoad(options) {
    this._focus = (options && options.focus) || '';
  },
  onShow() {
    this.loadDashboard().then(() => {
      if (this._focus === 'students') {
        this._focus = '';
        setTimeout(() => wx.pageScrollTo({ selector: '#section-students', duration: 280 }), 250);
      }
    });
  },
  onPullDownRefresh() { this.loadDashboard().finally(() => wx.stopPullDownRefresh()); },

  async loadDashboard() {
    if (!this.data.classes.length) this.setData({ loading: true });
    try {
      const result = await callTeacher('dashboard');
      if (!result.success) throw new Error(result.error || '加载失败');
      const data = result.data || {};
      const classes = data.classes || [];
      const selectedClass = classes.find((c) => c.id === this.data.selectedClass.id) || classes[0] || {};
      this.setData(Object.assign({
        isTeacher: true,
        classes,
        selectedClass,
        pendingStudents: withMark(data.pendingStudents),
        studentCount: data.studentCount || 0,
        assignmentCount: data.assignmentCount || 0
      }, packStudents(data.students)));
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
    const [result, pending] = await Promise.all([
      callTeacher('students', { classId }),
      callTeacher('joinRequests', { classId })
    ]);
    this.setData(Object.assign({
      pendingStudents: pending.success ? withMark(pending.data) : []
    }, packStudents(result.success ? result.data : [])));
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

  goRoster() {
    const classId = this.data.selectedClass.id;
    if (!classId) return;
    const name = encodeURIComponent(this.data.selectedClass.name || '');
    wx.navigateTo({
      url: `/pages/teacherRoster/teacherRoster?classId=${classId}&name=${name}`
    });
  },

  showStudent(e) {
    const studentId = e.currentTarget.dataset.id;
    const classId = this.data.selectedClass.id;
    if (!studentId || !classId) return;
    wx.navigateTo({
      url: `/pages/teacherStudent/teacherStudent?classId=${classId}&studentId=${studentId}`
    });
  },

  async approveJoin(e) {
    const studentId = e.currentTarget.dataset.id;
    const classId = this.data.selectedClass.id;
    if (!studentId || !classId) return;
    const result = await callTeacher('approveJoin', { classId, studentId });
    if (!result.success) return wx.showToast({ title: result.error || '通过失败', icon: 'none' });
    wx.showToast({ title: '已通过', icon: 'success' });
    await this.loadStudents(classId);
    this.loadDashboard();
  },

  async rejectJoin(e) {
    const studentId = e.currentTarget.dataset.id;
    const classId = this.data.selectedClass.id;
    if (!studentId || !classId) return;
    const ok = await new Promise((resolve) => wx.showModal({
      title: '拒绝申请',
      content: '拒绝后该学生不会进入班级，可再次提交申请。',
      confirmText: '拒绝',
      confirmColor: '#e11d48',
      success: (r) => resolve(!!r.confirm)
    }));
    if (!ok) return;
    const result = await callTeacher('rejectJoin', { classId, studentId });
    if (!result.success) return wx.showToast({ title: result.error || '操作失败', icon: 'none' });
    wx.showToast({ title: '已拒绝', icon: 'none' });
    await this.loadStudents(classId);
    this.loadDashboard();
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
  openCapture() { wx.reLaunch({ url: '/pages/teacherCapture/teacherCapture' }); },
  openPaper() { wx.reLaunch({ url: '/pages/teacherPaper/teacherPaper' }); },
  openAssignments() { wx.navigateTo({ url: '/pages/teacherAssignments/teacherAssignments' }); },
  openReport() {
    const classId = this.data.selectedClass.id || '';
    const q = classId ? ('?classId=' + classId) : '';
    wx.navigateTo({ url: '/pages/teacherReport/teacherReport' + q });
  }
});
