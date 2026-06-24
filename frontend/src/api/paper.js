import { apiClient } from './config'

const LOCAL_KEY = 'savedPapers'

function readLocalPapers() {
  try {
    const json = localStorage.getItem(LOCAL_KEY)
    return json ? JSON.parse(json) : []
  } catch {
    return []
  }
}

function writeLocalPapers(papers) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(papers))
  } catch {
    // ignore quota errors
  }
}

function normalizePaperQuestion(q) {
  if (!q) return q
  return {
    ...q,
    id: q.id || q._id,
    content: q.content || q.recognizedText || '',
    answer: q.answer || q.aiAnswer || '待补充',
    analysis: q.analysis || q.aiAnalysis || 'AI暂未给出解析'
  }
}

function buildPaperPayload(questions, title, options = {}) {
  const list = (questions || []).map(normalizePaperQuestion)
  return {
    title,
    questionCount: list.length,
    duration: options.duration || 90,
    totalScore: options.totalScore || list.reduce((sum, q) => sum + (q.score || 5), 0) || list.length * 5,
    questions: list.map(q => ({
      id: q.id,
      content: q.content,
      answer: q.answer,
      analysis: q.analysis,
      categoryId: q.categoryId,
      categoryName: q.categoryName,
      tags: q.tags || [],
      difficulty: q.difficulty
    }))
  }
}

const paperAPI = {
  normalizePaperQuestion,
  buildPaperPayload,

  /**
   * 获取试卷列表（云端优先，失败回退本地缓存）
   */
  async listPapers() {
    try {
      const res = await apiClient.get('/test-paper/saved')
      const body = res.data
      if (body?.success && Array.isArray(body.data)) {
        const papers = body.data.map(p => ({
          ...p,
          questions: (p.questions || []).map(normalizePaperQuestion)
        }))
        writeLocalPapers(papers)
        return papers
      }
    } catch (e) {
      console.warn('云端试卷加载失败，使用本地缓存', e)
    }
    return readLocalPapers().map(p => ({
      ...p,
      questions: (p.questions || []).map(normalizePaperQuestion)
    }))
  },

  /**
   * 保存试卷到云端并写入本地缓存
   * @returns {Promise<{paper, localOnly}>}
   */
  async savePaper(questions, title, options = {}) {
    const payload = buildPaperPayload(questions, title, options)
    try {
      const res = await apiClient.post('/test-paper/saved', payload)
      const body = res.data
      if (body?.success && body.data) {
        const cloudPaper = {
          ...body.data,
          questions: (body.data.questions || []).map(normalizePaperQuestion)
        }
        const papers = readLocalPapers()
        papers.unshift(cloudPaper)
        writeLocalPapers(papers)
        return { paper: cloudPaper, localOnly: false }
      }
    } catch (e) {
      console.warn('云端保存试卷失败，仅本地保存', e)
    }
    const localPaper = {
      ...payload,
      id: Date.now(),
      createdAt: new Date().toLocaleDateString()
    }
    const papers = readLocalPapers()
    papers.unshift(localPaper)
    writeLocalPapers(papers)
    return { paper: localPaper, localOnly: true }
  },

  /**
   * 删除试卷
   */
  async deletePaper(id) {
    let cloudOk = false
    try {
      const res = await apiClient.delete(`/test-paper/saved/${id}`)
      cloudOk = !!res.data?.success
    } catch (e) {
      console.warn('云端删除试卷失败', e)
    }
    const papers = readLocalPapers().filter(p => String(p.id) !== String(id))
    writeLocalPapers(papers)
    return cloudOk
  }
}

export default paperAPI
