import { apiClient } from './config'

const orgAPI = {
  list() {
    return apiClient.get('/orgs').then((r) => r.data)
  },
  detail(slug) {
    return apiClient.get('/orgs/' + slug).then((r) => r.data)
  },
  mine() {
    return apiClient.get('/orgs/mine').then((r) => r.data)
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
  approve(studentId) {
    return apiClient.post('/orgs/mine/requests/' + studentId + '/approve').then((r) => r.data)
  },
  reject(studentId) {
    return apiClient.post('/orgs/mine/requests/' + studentId + '/reject').then((r) => r.data)
  }
}

export default orgAPI
