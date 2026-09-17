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
  }
}

export default orgAPI
