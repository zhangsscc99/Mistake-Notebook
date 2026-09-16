import { apiClient } from './config'

const studyAPI = {
  generateLearningReport() {
    return apiClient.post('/study/learning-reports').then((r) => r.data)
  },
  getOverview() {
    return apiClient.get('/study/overview').then((r) => r.data)
  },
  listLearningReports() {
    return apiClient.get('/study/learning-reports').then((r) => r.data)
  },
  getLearningReport(id) {
    return apiClient.get('/study/learning-reports/' + id).then((r) => r.data)
  },
  deleteLearningReport(id) {
    return apiClient.delete('/study/learning-reports/' + id).then((r) => r.data)
  },
  generateMistakeReport(questionId) {
    return apiClient.post('/study/mistake-reports', { questionId }).then((r) => r.data)
  },
  // 错因深度分析：多道题合成一份报告
  generateDeepMistakeReport(questionIds) {
    return apiClient.post('/study/mistake-reports', { questionIds }).then((r) => r.data)
  },
  // 错题讲解（针对单题，结果会缓存）
  explainQuestion(questionId, refresh = false) {
    return apiClient.post('/study/explain', { questionId, refresh }).then((r) => r.data)
  },
  practice(params = {}) {
    return apiClient.get('/study/practice', { params }).then((r) => r.data)
  },
  listMistakeReports() {
    return apiClient.get('/study/mistake-reports').then((r) => r.data)
  },
  getMistakeReport(id) {
    return apiClient.get('/study/mistake-reports/' + id).then((r) => r.data)
  },
  deleteMistakeReport(id) {
    return apiClient.delete('/study/mistake-reports/' + id).then((r) => r.data)
  },
  generateVariants(questionIds) {
    return apiClient.post('/study/variants', { questionIds }).then((r) => r.data)
  },
  updateMark(payload) {
    return apiClient.post('/study/marks', payload).then((r) => r.data)
  },
  listMarks(questionIds) {
    return apiClient.post('/study/marks/list', { questionIds }).then((r) => r.data)
  },
  saveNote(questionId, content) {
    return apiClient.post('/study/notes', { questionId, content }).then((r) => r.data)
  },
  listNotes(questionIds) {
    return apiClient.post('/study/notes/list', { questionIds }).then((r) => r.data)
  }
}

export default studyAPI
