import { apiClient } from './config'

const unwrap = (p) => p.then((r) => r.data)

const classroomAPI = {
  summary() {
    return unwrap(apiClient.get('/classroom/summary'))
  },
  teachers() {
    return unwrap(apiClient.get('/classroom/teachers'))
  },
  bindTeacher(code) {
    return unwrap(apiClient.post('/classroom/teachers', { code }))
  },
  joinClass(code) {
    return unwrap(apiClient.post('/classroom/join', { code }))
  },
  classes() {
    return unwrap(apiClient.get('/classroom/classes'))
  },
  unbindTeacher(teacherId) {
    return unwrap(apiClient.delete('/classroom/teachers/' + teacherId))
  },
  messages(teacherId) {
    return unwrap(apiClient.get(`/classroom/teachers/${teacherId}/messages`))
  },
  sendMessage(teacherId, content) {
    return unwrap(apiClient.post(`/classroom/teachers/${teacherId}/messages`, { content }))
  },
  notebooks() {
    return unwrap(apiClient.get('/classroom/notebooks'))
  },
  notebook(id) {
    return unwrap(apiClient.get('/classroom/notebooks/' + id))
  },
  saveProgress(id, doneCount, masteredCount) {
    return unwrap(apiClient.post(`/classroom/notebooks/${id}/progress`, { doneCount, masteredCount }))
  },
  homework() {
    return unwrap(apiClient.get('/classroom/homework'))
  },
  homeworkDetail(id) {
    return unwrap(apiClient.get('/classroom/homework/' + id))
  },
  submitHomework(id, answers, answerImages = []) {
    return unwrap(apiClient.post(`/classroom/homework/${id}/submit`, { answers, answerImages }))
  },
  parentReports() {
    return unwrap(apiClient.get('/classroom/parent-reports'))
  },
  parentReport(id) {
    return unwrap(apiClient.get('/classroom/parent-reports/' + id))
  }
}

export default classroomAPI
