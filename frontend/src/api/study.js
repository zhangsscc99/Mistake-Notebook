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
