import { apiClient } from './config'

const userAPI = {
  register(payload) {
    return apiClient.post('/auth/register', payload).then((r) => r.data)
  },
  login(payload) {
    return apiClient.post('/auth/login', payload).then((r) => r.data)
  },
  me() {
    return apiClient.get('/user/me').then((r) => r.data)
  },
  updateProfile(payload) {
    return apiClient.post('/user/profile', payload).then((r) => r.data)
  },
  changePassword(oldPassword, newPassword) {
    return apiClient.post('/user/password', { oldPassword, newPassword }).then((r) => r.data)
  },
  wallet() {
    return apiClient.get('/user/wallet').then((r) => r.data)
  },
  checkin() {
    return apiClient.post('/user/checkin').then((r) => r.data)
  },
  shareCheckin(content) {
    return apiClient.post('/user/checkin/share', { content: content || '' }).then((r) => r.data)
  },
  checkinFeed() {
    return apiClient.get('/user/checkin/feed').then((r) => r.data)
  },
  likeCheckin(postId) {
    return apiClient.post('/user/checkin/like', { postId }).then((r) => r.data)
  },
  redeemVip() {
    return apiClient.post('/user/vip').then((r) => r.data)
  },
  stats() {
    return apiClient.get('/user/stats').then((r) => r.data)
  },
  leaderboard() {
    return apiClient.get('/user/leaderboard').then((r) => r.data)
  },
  deleteAccount() {
    return apiClient.delete('/user/account').then((r) => r.data)
  }
}

export default userAPI
