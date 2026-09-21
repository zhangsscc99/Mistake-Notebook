import { apiClient } from './config'

const slugParams = (slug) => (slug ? { params: { slug } } : undefined)

const orgAPI = {
  list(q) {
    return apiClient.get('/orgs', { params: { q: q || undefined } }).then((r) => r.data)
  },
  detail(slug) {
    return apiClient.get('/orgs/' + slug).then((r) => r.data)
  },
  apply(slug) {
    return apiClient.post('/orgs/' + slug + '/apply').then((r) => r.data)
  },
  leave(slug) {
    return apiClient.delete('/orgs/' + slug + '/membership').then((r) => r.data)
  },
  memberBank(slug) {
    return apiClient.get('/orgs/' + slug + '/bank').then((r) => r.data)
  },
  memberPractice(slug, onlyUnmastered) {
    return apiClient.get('/orgs/' + slug + '/practice', { params: { onlyUnmastered: !!onlyUnmastered } }).then((r) => r.data)
  },
  markPractice(slug, questionId, mastered) {
    return apiClient.post('/orgs/' + slug + '/practice/mark', { questionId, mastered }).then((r) => r.data)
  },
  mine(slug) {
    return apiClient.get('/orgs/mine', slugParams(slug)).then((r) => r.data)
  },
  saveMine(payload) {
    return apiClient.put('/orgs/mine', payload).then((r) => r.data)
  },
  join(code) {
    return apiClient.post('/orgs/join', { code }).then((r) => r.data)
  },
  joined() {
    return apiClient.get('/orgs/joined').then((r) => r.data)
  },
  approve(studentId, slug) {
    return apiClient.post('/orgs/mine/requests/' + studentId + '/approve', null, slugParams(slug)).then((r) => r.data)
  },
  reject(studentId, slug) {
    return apiClient.post('/orgs/mine/requests/' + studentId + '/reject', null, slugParams(slug)).then((r) => r.data)
  },
  bank(slug) {
    return apiClient.get('/orgs/mine/bank', slugParams(slug)).then((r) => r.data)
  },
  addBank(payload, slug) {
    return apiClient.post('/orgs/mine/bank', payload, slugParams(slug)).then((r) => r.data)
  },
  deleteBank(id, slug) {
    return apiClient.delete('/orgs/mine/bank/' + id, slugParams(slug)).then((r) => r.data)
  },
  students(q, slug) {
    return apiClient.get('/orgs/mine/students', { params: { q: q || '', slug: slug || undefined } }).then((r) => r.data)
  },
  removeMember(studentId, slug) {
    return apiClient.delete('/orgs/mine/members/' + studentId, slugParams(slug)).then((r) => r.data)
  },
  analytics(slug) {
    return apiClient.get('/orgs/mine/analytics', slugParams(slug)).then((r) => r.data)
  },
  staff(slug) {
    return apiClient.get('/orgs/mine/staff', slugParams(slug)).then((r) => r.data)
  },
  addStaff(username) {
    return apiClient.post('/orgs/mine/staff', { username }).then((r) => r.data)
  },
  removeStaff(teacherId) {
    return apiClient.delete('/orgs/mine/staff/' + teacherId).then((r) => r.data)
  }
}

export default orgAPI
