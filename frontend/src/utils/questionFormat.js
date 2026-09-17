import { formatLatex, splitMatrixSegments } from './latex'

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

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

export function getQuestionSegments(raw, { preformatted = false } = {}) {
  const formatted = preformatted ? (raw || '') : formatLatex(raw || '')
  return splitMatrixSegments(formatted)
}

export function formatQuestionHtml(raw) {
  const matrixStyle = 'font-family:Menlo,Consolas,monospace;font-size:13px;line-height:1.55;margin:6px 0;padding:8px 10px;background:#f4f6f8;border-radius:6px;white-space:pre;overflow-x:auto;display:block;'
  const flowStyle = 'white-space:pre-wrap;word-break:break-word;'
  return getQuestionSegments(raw).map((seg) => {
    if (seg.type === 'matrix') {
      return `<pre class="math-matrix" style="${matrixStyle}">${escapeHtml(seg.content)}</pre>`
    }
    return `<span class="question-text-flow" style="${flowStyle}">${escapeHtml(seg.content).replace(/\n/g, '<br>')}</span>`
  }).join('')
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

export function canAddToPaper(q) {
  if (!q || isPendingQuestion(q)) return false
  const answer = String(q.sourceAiAnswer || q.aiAnswer || q.answer || '').trim()
  if (!answer || answer === '待补充' || answer.startsWith('AI 答案')) return false
  const analysis = String(q.sourceAiAnalysis || q.aiAnalysis || q.analysis || '').trim()
  if (analysis.includes('生成异常') || analysis.includes('AI答案生成异常') || analysis.includes('无法解析')) {
    return false
  }
  return true
}

export function canTeacherPickForPaper(q) {
  if (!q) return false
  const source = String(q.source || '').toLowerCase()
  if (source === 'teacher_bank') {
    return !!(q.content || q.recognizedText || '').trim()
  }
  return canAddToPaper(q)
}

export function partitionPaperQuestions(list, { teacher = false } = {}) {
  const ready = []
  const blocked = []
  const check = teacher ? canTeacherPickForPaper : canAddToPaper
  ;(list || []).forEach((q) => {
    if (check(q)) ready.push(q)
    else blocked.push(q)
  })
  return { ready, blocked }
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

// 后台解析正常只要几十秒。超过这个时间还挂着，基本是服务重启把任务丢了，
// 再显示「解析中」就是在骗用户，按卡住处理，让他能重试或删除。
// 必须看最近一次排队/处理时间，不能看 createdAt：重试不会改创建时间。
const STALE_ANALYZING_MS = 10 * 60 * 1000

export function parseQuestionTime(raw) {
  if (raw == null || raw === '') return NaN
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw < 1e12 ? raw * 1000 : raw
  }
  if (Array.isArray(raw) && raw.length >= 3) {
    const [y, m, d, h = 0, min = 0, s = 0] = raw
    return new Date(y, m - 1, d, h, min, Math.floor(s)).getTime()
  }
  const t = new Date(raw).getTime()
  return Number.isNaN(t) ? NaN : t
}

export function isStaleAnalyzing(q) {
  if (!q || isFailedQuestion(q)) return false
  const status = (q.aiStatus || '').toLowerCase()
  if (status && status !== 'pending' && status !== 'processing') return false
  const t = parseQuestionTime(q.updatedAt) || parseQuestionTime(q.createdAt)
  if (Number.isNaN(t) || !t) return false
  return Date.now() - t > STALE_ANALYZING_MS
}

export function decoratePendingItem(item, index) {
  const failed = isFailedQuestion(item)
  const stale = isStaleAnalyzing(item)
  const status = (item.aiStatus || '').toLowerCase()
  const processing = status === 'processing'
  const preview = formatLatex((item.content || '').replace(/\s+/g, ' ').trim())
  let statusText = '等待解析…'
  if (failed) statusText = '解析失败'
  else if (stale) statusText = '解析卡住了'
  else if (processing) statusText = 'AI 解析中…'
  // 卡住的题和失败的题一样需要用户处理，归到同一栏
  const needsAction = failed || stale
  return {
    ...item,
    displayIndex: index + 1,
    preview: preview.length > 60 ? preview.slice(0, 60) + '…' : preview,
    isAnalyzing: !needsAction,
    isFailed: needsAction,
    isStale: stale && !failed,
    statusText
  }
}
