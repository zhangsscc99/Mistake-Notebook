import { apiClient } from './config'

const unwrap = (p) => p.then((r) => r.data)

const teacherAPI = {
  dashboard() {
    return unwrap(apiClient.get('/teacher/dashboard'))
  },
  analytics() {
    return unwrap(apiClient.get('/teacher/analytics'))
  },

  // 学员管理
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

  // 留言
  messages(studentId) {
    return unwrap(apiClient.get(`/teacher/students/${studentId}/messages`))
  },
  sendMessage(studentId, content) {
    return unwrap(apiClient.post(`/teacher/students/${studentId}/messages`, { content }))
  },

  // 班级错题本
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

  // 作业
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
  grade(submissionId, payload) {
    return unwrap(apiClient.post(`/teacher/submissions/${submissionId}/grade`, payload))
  },
  aiGrade(submissionId) {
    return unwrap(apiClient.post(`/teacher/submissions/${submissionId}/ai-grade`))
  },

  // 家长报告
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
