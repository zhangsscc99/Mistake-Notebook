import { apiClient } from '../api/config'
import { decoratePendingItem, isPendingQuestion } from './questionFormat'

export async function fetchPendingQuestions() {
  // 后端 /questions/pending 直接返回待解析/处理中/失败的题目（基于真实 aiStatus）
  try {
    const res = await apiClient.get('/questions/pending')
    const list = res.data?.data || res.data || []
    if (Array.isArray(list)) {
      return list.filter(isPendingQuestion).map((q, i) => decoratePendingItem(q, i))
    }
  } catch (e) {
    // 回退到全量查询 + 启发式过滤（兼容旧后端）
    const res = await apiClient.get('/questions')
    const list = res.data?.data || res.data || []
    if (Array.isArray(list)) {
      return list.filter(isPendingQuestion).map((q, i) => decoratePendingItem(q, i))
    }
  }
  return []
}

export function startPendingPoll(onUpdate, intervalMs = 5000) {
  let timer = null
  let stopped = false

  const tick = async () => {
    if (stopped) return
    try {
      const list = await fetchPendingQuestions()
      onUpdate(list)
    } catch (e) {
      console.warn('pending poll error', e)
    }
  }

  tick()
  timer = setInterval(tick, intervalMs)

  return () => {
    stopped = true
    if (timer) clearInterval(timer)
  }
}
