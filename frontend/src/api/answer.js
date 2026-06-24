import { apiClient } from './config'

const CLIENT_ID_KEY = 'ai_chat_client_id'

// 生成/读取稳定的客户端标识，作为后端 SQL 记忆的主键维度
function getClientId() {
  try {
    let id = localStorage.getItem(CLIENT_ID_KEY)
    if (!id) {
      id = 'web-' + (crypto?.randomUUID ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2)))
      localStorage.setItem(CLIENT_ID_KEY, id)
    }
    return id
  } catch {
    return 'web-anonymous'
  }
}

const answerAPI = {
  getClientId,

  async chat(messages, questionContext = '') {
    const res = await apiClient.post('/answer/chat', {
      messages,
      questionContext,
      clientId: getClientId()
    })
    const body = res.data
    if (body?.success && body?.data?.reply) {
      return { success: true, reply: body.data.reply }
    }
    return {
      success: false,
      reply: body?.message || '抱歉，我这边出了点问题，请稍后再试。'
    }
  },

  // 从后端 SQL 读取记忆状态，用于个性化问候
  async getMemoryStatus() {
    try {
      const res = await apiClient.get('/answer/memory-status', {
        params: { clientId: getClientId() }
      })
      const data = res.data?.data
      if (data) {
        return {
          hasMemory: !!data.hasMemory,
          lastQuestions: data.lastQuestions || [],
          topics: data.topics || [],
          summary: data.summary || ''
        }
      }
    } catch (e) {
      // ignore
    }
    return { hasMemory: false, lastQuestions: [], topics: [], summary: '' }
  },

  // 对话结束后让后端异步总结并持久化记忆（离开页面时调用）
  async persistSessionMemory(messages, questionContext) {
    const apiMessages = (messages || [])
      .filter(m => (m.role === 'user' || m.role === 'assistant') && m.content)
      .map(m => ({ role: m.role, content: String(m.content) }))
    if (!apiMessages.some(m => m.role === 'user')) return
    try {
      await apiClient.post('/answer/summarize', {
        messages: apiMessages,
        questionContext: questionContext || '',
        clientId: getClientId()
      })
    } catch (e) {
      // ignore
    }
  }
}

export default answerAPI
