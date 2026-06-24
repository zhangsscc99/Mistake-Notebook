import { formatLatex } from './latex'

export function parseQuestionParas(text) {
  if (!text) return []
  const normalized = String(text).replace(/\r\n/g, '\n').trim()
  const lines = normalized.split('\n')
  const paras = []
  let stemBuffer = ''
  let curLabel = ''
  let subBuffer = ''

  const flushStem = () => {
    const content = stemBuffer.trim()
    if (content) paras.push({ label: '', text: content, sub: false })
    stemBuffer = ''
  }

  const flushSub = () => {
    const content = subBuffer.trim()
    if (curLabel && content) paras.push({ label: curLabel, text: content, sub: true })
    curLabel = ''
    subBuffer = ''
  }

  lines.forEach((rawLine) => {
    const line = rawLine.trim()
    const m = line.match(/^[（(]\s*(\d+)\s*[)）]\s*(.*)$/)
    if (m) {
      flushStem()
      flushSub()
      curLabel = m[1]
      subBuffer = m[2]
    } else if (curLabel) {
      if (line) subBuffer += (subBuffer ? '\n' : '') + line
    } else if (!line) {
      flushStem()
    } else {
      stemBuffer += (stemBuffer ? '\n' : '') + line
    }
  })
  flushStem()
  flushSub()
  return paras
}

export function formatQuestionText(raw) {
  return formatLatex(raw || '')
}

export function buildAiDisplayText(value, pending, emptyFallback, pendingFallback) {
  const raw = (value || '').trim()
  if (raw && raw !== '待补充') return formatQuestionText(raw)
  if (pending) return pendingFallback
  return emptyFallback
}

export function isPendingQuestion(q) {
  if (!q) return false
  // 优先使用后端真实的 AI 解析状态
  const status = (q.aiStatus || '').toLowerCase()
  if (status) {
    return status === 'pending' || status === 'processing' || status === 'failed'
  }
  // 旧数据无状态时，回退到内容启发式判断
  const answer = (q.aiAnswer || '').trim()
  const analysis = (q.aiAnalysis || '').trim()
  const answerPending = !answer || answer === '待补充'
  const analysisPending = !analysis || analysis === 'AI暂未给出解析' || analysis.includes('生成异常')
  return answerPending || analysisPending
}

export function isFailedQuestion(q) {
  const status = (q && q.aiStatus || '').toLowerCase()
  if (status) return status === 'failed'
  const analysis = (q && q.aiAnalysis || '').trim()
  return analysis.includes('生成异常') || analysis.includes('失败')
}

export function isProcessingQuestion(q) {
  const status = (q && q.aiStatus || '').toLowerCase()
  if (status) return status === 'processing'
  return isPendingQuestion(q) && !isFailedQuestion(q)
}

export function decoratePendingItem(item, index) {
  const failed = isFailedQuestion(item)
  const status = (item.aiStatus || '').toLowerCase()
  const processing = status === 'processing'
  const preview = (item.content || '').replace(/\s+/g, ' ').trim()
  let statusText = '等待解析…'
  if (failed) statusText = '解析失败'
  else if (processing) statusText = 'AI 解析中…'
  return {
    ...item,
    displayIndex: index + 1,
    preview: preview.length > 60 ? preview.slice(0, 60) + '…' : preview,
    isAnalyzing: !failed,
    isFailed: failed,
    statusText
  }
}
