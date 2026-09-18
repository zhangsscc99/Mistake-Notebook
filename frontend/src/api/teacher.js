import { apiClient } from './config'

const unwrap = (p) => p.then((r) => r.data)

const teacherAPI = {
  dashboard() {
    return unwrap(apiClient.get('/teacher/dashboard'))
  },
  analytics() {
    return unwrap(apiClient.get('/teacher/analytics'))
  },

  classes() {
    return unwrap(apiClient.get('/teacher/classes'))
  },
  createClass(name, grade) {
    return unwrap(apiClient.post('/teacher/classes', { name, grade }))
  },
  classStudents(classId) {
    return unwrap(apiClient.get(`/teacher/classes/${classId}/students`))
  },
  joinRequests(classId) {
    return unwrap(apiClient.get(`/teacher/classes/${classId}/join-requests`))
  },
  approveJoin(classId, studentId) {
    return unwrap(apiClient.post(`/teacher/classes/${classId}/approve`, { studentId }))
  },
  rejectJoin(classId, studentId) {
    return unwrap(apiClient.post(`/teacher/classes/${classId}/reject`, { studentId }))
  },
  classStudentOverview(classId, studentId) {
    return unwrap(apiClient.get(`/teacher/classes/${classId}/students/${studentId}`))
  },
  classStudentQuestions(classId, studentId) {
    return unwrap(apiClient.get(`/teacher/classes/${classId}/students/${studentId}/questions`))
  },

  students() {
    return unwrap(apiClient.get('/teacher/students'))
  },
  bindStudent(username, remark) {
    return unwrap(apiClient.post('/teacher/students', { username, remark }))
  },
  unbindStudent(studentId) {
    return unwrap(apiClient.delete('/teacher/students/' + studentId))
  },
  saveRemark(studentId, remark) {
    return unwrap(apiClient.post(`/teacher/students/${studentId}/remark`, { remark }))
  },
  studentOverview(studentId) {
    return unwrap(apiClient.get('/teacher/students/' + studentId))
  },
  studentQuestions(studentId) {
    return unwrap(apiClient.get(`/teacher/students/${studentId}/questions`))
  },

  messages(studentId) {
    return unwrap(apiClient.get(`/teacher/students/${studentId}/messages`))
  },
  sendMessage(studentId, content) {
    return unwrap(apiClient.post(`/teacher/students/${studentId}/messages`, { content }))
  },

  classQuestions(classId) {
    return unwrap(apiClient.get('/teacher/class-questions', { params: { classId } }))
  },
  classStats(classId) {
    return unwrap(apiClient.get('/teacher/class-stats', { params: { classId } }))
  },
  bank(classId) {
    return unwrap(apiClient.get('/teacher/bank', classId ? { params: { classId } } : {}))
  },
  saveBank(payload) {
    return unwrap(apiClient.post('/teacher/bank', payload))
  },
  deleteBank(id) {
    return unwrap(apiClient.delete('/teacher/bank/' + id))
  },
  picked(questionIds) {
    return unwrap(apiClient.post('/teacher/picked', { questionIds }))
  },

  papers(classId) {
    return unwrap(apiClient.get('/teacher/papers', classId ? { params: { classId } } : {}))
  },
  savePaper(payload) {
    return unwrap(apiClient.post('/teacher/papers', payload))
  },
  paper(id) {
    return unwrap(apiClient.get('/teacher/papers/' + id))
  },
  updatePaper(id, payload) {
    return unwrap(apiClient.post(`/teacher/papers/${id}`, payload))
  },
  recallPaper(id) {
    return unwrap(apiClient.post(`/teacher/papers/${id}/recall`))
  },

  classNotebooks(classId) {
    return unwrap(apiClient.get('/teacher/class-notebooks', { params: { classId } }))
  },
  classNotebook(id) {
    return unwrap(apiClient.get('/teacher/class-notebooks/' + id))
  },
  publishNotebook(payload) {
    return unwrap(apiClient.post('/teacher/notebooks/publish', payload))
  },
  recallNotebook(id) {
    return unwrap(apiClient.post(`/teacher/notebooks/${id}/recall`))
  },

  highFrequency() {
    return unwrap(apiClient.get('/teacher/high-frequency'))
  },
  notebooks() {
    return unwrap(apiClient.get('/teacher/notebooks'))
  },
  notebook(id) {
    return unwrap(apiClient.get('/teacher/notebooks/' + id))
  },
  createNotebook(payload) {
    return unwrap(apiClient.post('/teacher/notebooks', payload))
  },
  updateNotebook(id, payload) {
    return unwrap(apiClient.post('/teacher/notebooks/' + id, payload))
  },
  pushNotebook(id) {
    return unwrap(apiClient.post(`/teacher/notebooks/${id}/push`))
  },
  deleteNotebook(id) {
    return unwrap(apiClient.delete('/teacher/notebooks/' + id))
  },

  homework() {
    return unwrap(apiClient.get('/teacher/homework'))
  },
  createHomework(payload) {
    return unwrap(apiClient.post('/teacher/homework', payload))
  },
  homeworkDetail(id) {
    return unwrap(apiClient.get('/teacher/homework/' + id))
  },
  deleteHomework(id) {
    return unwrap(apiClient.delete('/teacher/homework/' + id))
  },
  recallHomework(id) {
    return unwrap(apiClient.post(`/teacher/homework/${id}/recall`))
  },
  grade(submissionId, payload) {
    return unwrap(apiClient.post(`/teacher/submissions/${submissionId}/grade`, payload))
  },
  aiGrade(submissionId) {
    return unwrap(apiClient.post(`/teacher/submissions/${submissionId}/ai-grade`))
  },

  chat(payload) {
    return unwrap(apiClient.post('/teacher/chat', payload))
  },

  classReports(classId) {
    return unwrap(apiClient.get('/teacher/class-reports', { params: { classId } }))
  },
  createClassReport(classId) {
    return unwrap(apiClient.post('/teacher/class-reports', { classId }))
  },
  classReport(id) {
    return unwrap(apiClient.get('/teacher/class-reports/' + id))
  },

  parentReports(studentId) {
    return unwrap(apiClient.get(`/teacher/students/${studentId}/parent-reports`))
  },
  generateParentReport(studentId, note) {
    return unwrap(apiClient.post(`/teacher/students/${studentId}/parent-reports`, { note }))
  },
  parentReport(id) {
    return unwrap(apiClient.get('/teacher/parent-reports/' + id))
  },
  deleteParentReport(id) {
    return unwrap(apiClient.delete('/teacher/parent-reports/' + id))
  }
}

export default teacherAPI
