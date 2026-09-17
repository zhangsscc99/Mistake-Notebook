import { apiClient } from './config'

const socialAPI = {
  home() {
    return apiClient.get('/social/home').then((r) => r.data)
  },
  listHelp(subject) {
    return apiClient.get('/social/help', { params: { subject: subject || '' } }).then((r) => r.data)
  },
  createHelp(payload) {
    return apiClient.post('/social/help', payload).then((r) => r.data)
  },
  helpDetail(id) {
    return apiClient.get('/social/help/' + id).then((r) => r.data)
  },
  replyHelp(id, content) {
    return apiClient.post('/social/help/' + id + '/replies', { content }).then((r) => r.data)
  },
  likeHelp(id) {
    return apiClient.post('/social/help/' + id + '/like').then((r) => r.data)
  },
  deleteHelp(id) {
    return apiClient.delete('/social/help/' + id).then((r) => r.data)
  },
  deleteReply(postId, replyId) {
    return apiClient.delete('/social/help/' + postId + '/replies/' + replyId).then((r) => r.data)
  },
  friends() {
    return apiClient.get('/social/friends').then((r) => r.data)
  },
  searchUsers(q) {
    return apiClient.get('/social/users', { params: { q } }).then((r) => r.data)
  },
  addFriend(username) {
    return apiClient.post('/social/friends', { username }).then((r) => r.data)
  },
  acceptFriend(userId) {
    return apiClient.post('/social/friends/' + userId + '/accept').then((r) => r.data)
  },
  rejectFriend(userId) {
    return apiClient.post('/social/friends/' + userId + '/reject').then((r) => r.data)
  },
  cancelFriend(userId) {
    return apiClient.post('/social/friends/' + userId + '/cancel').then((r) => r.data)
  },
  unfriend(userId) {
    return apiClient.delete('/social/friends/' + userId).then((r) => r.data)
  },
  challenge(friendId) {
    return apiClient.post('/social/pk', { friendId }).then((r) => r.data)
  },
  pkDetail(id) {
    return apiClient.get('/social/pk/' + id).then((r) => r.data)
  },
  acceptPk(id) {
    return apiClient.post('/social/pk/' + id + '/accept').then((r) => r.data)
  },
  submitPk(id, answers) {
    return apiClient.post('/social/pk/' + id + '/submit', { answers }).then((r) => r.data)
  }
}

export default socialAPI
