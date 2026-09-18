<template>
  <div class="page">
    <van-nav-bar title="勾选题库" left-arrow @click-left="$router.back()" fixed placeholder />

    <div class="tips">已自动全选，可点取消不需要的题。保存后进入老师题库，不进学生错题本，也不会自动带到组卷</div>

    <div v-if="pages.length > 1" class="page-tabs">
      <button
        v-for="(p, i) in pages"
        :key="i"
        class="page-tab"
        :class="{ on: pageIndex === i }"
        @click="switchPage(i)"
      >第{{ i + 1 }}页</button>
    </div>

    <div v-if="imagePath" class="image-wrap">
      <img class="preview" :src="imagePath" alt="" />
      <button
        v-for="item in overlays"
        :key="item.id + '-' + pageIndex"
        class="overlay"
        :class="{ on: item.selected }"
        :style="{
          top: item.bounds.top + '%',
          left: item.bounds.left + '%',
          width: item.bounds.width + '%',
          height: item.bounds.height + '%'
        }"
        @click="toggle(item.id)"
      >
        <span class="overlay-index">{{ item.id }}</span>
      </button>
    </div>

    <div class="list">
      <label v-for="(q, i) in questions" :key="q.id" class="card" @click.prevent="toggle(q.id)">
        <span class="check" :class="{ on: q.selected }">{{ q.selected ? '✓' : '' }}</span>
        <div class="body">
          <div class="meta">
            <span class="idx">第{{ i + 1 }}题</span>
            <span v-if="q.type" class="type">{{ q.type }}</span>
            <span v-if="q.isCrossPage" class="cross">{{ q.crossPageLabel }}</span>
          </div>
          <p>{{ q.text }}</p>
        </div>
      </label>
      <div v-if="!questions.length" class="empty">没有可保存的题目</div>
    </div>

    <div class="dock">
      <div class="dock-head">
        <span>{{ selectedCategory }} · {{ selectedDifficulty }}</span>
        <button class="link" @click="openPicker">修改 ›</button>
      </div>
      <button class="primary" :disabled="saving || !selectedCount" @click="saveSelected">
        {{ saving ? '正在保存…' : `存入老师题库 (${selectedCount})` }}
      </button>
    </div>

    <van-popup v-model:show="showPicker" round position="bottom" :style="{ padding: '20px 16px 24px' }">
      <div class="modal-head">
        <b>学科与难度</b>
        <button class="link" @click="showPicker = false">×</button>
      </div>
      <div class="label">学科</div>
      <div class="chips">
        <button v-for="c in categories" :key="c" class="chip" :class="{ on: tempCategory === c }" @click="tempCategory = c">{{ c }}</button>
      </div>
      <div class="label">难度</div>
      <div class="chips">
        <button v-for="d in difficulties" :key="d" class="chip" :class="{ on: tempDifficulty === d }" @click="tempDifficulty = d">{{ d }}</button>
      </div>
      <div class="modal-actions">
        <button class="ghost" @click="showPicker = false">取消</button>
        <button class="primary slim" @click="confirmPicker">确认</button>
      </div>
    </van-popup>
  </div>
</template>

<script>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showConfirmDialog, showToast } from 'vant'
import teacherAPI from '../../api/teacher'
import { API_BASE_URL } from '../../api/config'

const DRAFT_KEY = 'teacherBankDraft'
const CATEGORIES = ['数学', '物理', '化学', '英语', '语文', '生物', '历史', '地理', '政治']
const DIFFICULTIES = ['简单', '中等', '困难']

function resolveImageUrl(url) {
  if (!url) return ''
  if (url.startsWith('http') || url.startsWith('blob:') || url.startsWith('data:')) return url
  const base = API_BASE_URL.replace(/\/api\/?$/, '')
  return `${base}${url.startsWith('/') ? url : '/' + url}`
}

function asBounds(raw) {
  if (!raw || typeof raw !== 'object') return null
  const top = Number(raw.top)
  const left = Number(raw.left)
  const width = Number(raw.width)
  const height = Number(raw.height)
  if (![top, left, width, height].every(Number.isFinite)) return null
  if (top <= 1.5 && left <= 1.5 && width <= 1.5 && height <= 1.5) {
    return { top: top * 100, left: left * 100, width: width * 100, height: height * 100 }
  }
  return { top, left, width, height }
}

function pickCategory(hint) {
  const want = String(hint || '').replace(/\s+/g, '')
  if (!want) return CATEGORIES[0]
  return CATEGORIES.find((n) => n === want)
    || CATEGORIES.find((n) => want.includes(n) || n.includes(want))
    || CATEGORIES[0]
}

function overlaysForPage(questions, pageIndex) {
  const overlays = []
  ;(questions || []).forEach((q) => {
    const spans = q.pageSpans || []
    const hit = spans.filter((span) => Number(span.pageIndex) === pageIndex && span.bounds)
    if (!hit.length && pageIndex === 0 && q.bounds && (!q.pageIndexes || !q.pageIndexes.length)) {
      overlays.push({ id: q.id, selected: q.selected, bounds: q.bounds })
      return
    }
    hit.forEach((span) => overlays.push({ id: q.id, selected: q.selected, bounds: span.bounds }))
  })
  return overlays.filter((item) => item.bounds)
}

export default {
  name: 'TeacherBankPicker',
  setup() {
    const router = useRouter()
    const pages = ref([])
    const pageIndex = ref(0)
    const imagePath = ref('')
    const fileID = ref('')
    const questions = ref([])
    const selectedCategory = ref('数学')
    const selectedDifficulty = ref('中等')
    const tempCategory = ref('数学')
    const tempDifficulty = ref('中等')
    const saving = ref(false)
    const showPicker = ref(false)
    const categories = CATEGORIES
    const difficulties = DIFFICULTIES

    const selectedCount = computed(() => questions.value.filter((q) => q.selected).length)
    const overlays = computed(() => overlaysForPage(questions.value, pageIndex.value))

    const switchPage = (index) => {
      const page = pages.value[index]
      if (!page) return
      pageIndex.value = index
      imagePath.value = page.tempFilePath || resolveImageUrl(page.fileID || page.imageUrl)
      fileID.value = page.fileID || page.imageUrl || fileID.value
    }

    const toggle = (id) => {
      questions.value = questions.value.map((q) => q.id === id ? { ...q, selected: !q.selected } : q)
    }

    const openPicker = () => {
      tempCategory.value = selectedCategory.value
      tempDifficulty.value = selectedDifficulty.value
      showPicker.value = true
    }
    const confirmPicker = () => {
      selectedCategory.value = tempCategory.value
      selectedDifficulty.value = tempDifficulty.value
      showPicker.value = false
    }

    const saveSelected = async () => {
      const selectedQuestions = questions.value.filter((q) => q.selected)
      if (!selectedQuestions.length) return showToast('请至少选择一道题')
      saving.value = true
      try {
        await teacherAPI.saveBank({
          category: selectedCategory.value,
          difficulty: selectedDifficulty.value,
          imageUrl: fileID.value,
          questions: selectedQuestions.map((q) => ({
            text: q.text,
            type: q.type,
            subject: q.subject,
            confidence: q.confidence,
            imageUrl: q.imageUrl || fileID.value,
            pageFileIDs: q.pageFileIDs || [],
            pageSpans: q.pageSpans || []
          }))
        })
        sessionStorage.removeItem(DRAFT_KEY)
        try {
          await showConfirmDialog({
            title: '已存入老师题库',
            message: '题目已保存在老师账号下，不会进入学生错题本，也不会自动带进组卷。需要组卷时再到题目页勾选。',
            confirmButtonText: '去选题',
            cancelButtonText: '完成'
          })
          router.replace({ path: '/teacher/questions', query: { bank: '1', pick: '1' } })
        } catch {
          router.replace({ path: '/teacher/questions', query: { bank: '1' } })
        }
      } catch (e) {
        showToast({ type: 'fail', message: e.response?.data?.message || e.message || '保存失败' })
      } finally {
        saving.value = false
      }
    }

    onMounted(() => {
      let draft
      try { draft = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null') } catch { draft = null }
      if (!draft || draft.mode !== 'teacher_bank' || !draft.segments || !draft.segments.length) {
        showToast('无识别结果')
        setTimeout(() => router.back(), 800)
        return
      }
      const pageRows = Array.isArray(draft.pages) && draft.pages.length
        ? draft.pages.map((page) => ({
          tempFilePath: page.tempFilePath || page.path || '',
          fileID: page.fileID || page.imageUrl || '',
          imageUrl: page.imageUrl || page.fileID || ''
        }))
        : [{
          tempFilePath: draft.tempFilePath || '',
          fileID: draft.fileID || draft.imageUrl || '',
          imageUrl: draft.imageUrl || draft.fileID || ''
        }]
      const fileIDs = Array.isArray(draft.fileIDs) && draft.fileIDs.length
        ? draft.fileIDs
        : pageRows.map((p) => p.fileID || p.imageUrl)

      const mapped = (draft.segments || []).map((segment, index) => {
        const pageSpansRaw = Array.isArray(segment.pageSpans) && segment.pageSpans.length
          ? segment.pageSpans
          : [{ pageIndex: segment.pageIndex || 0, bounds: segment.bounds || null }]
        const pageSpans = pageSpansRaw.map((span) => ({
          pageIndex: Number(span.pageIndex) || 0,
          bounds: asBounds(span.bounds || segment.bounds)
        }))
        const extraPages = Array.isArray(segment.pages) ? segment.pages.map(Number) : []
        extraPages.forEach((p) => {
          if (!pageSpans.some((span) => span.pageIndex === p)) {
            pageSpans.push({ pageIndex: p, bounds: p === (segment.pageIndex || 0) ? asBounds(segment.bounds) : null })
          }
        })
        const pageIndexes = pageSpans.map((span) => span.pageIndex)
        const firstPage = pageIndexes[0] || 0
        const isCrossPage = pageIndexes.length > 1 || !!segment.crossPage
        return {
          id: String(segment.id || index + 1),
          text: segment.content || segment.text || '',
          type: segment.type || '',
          subject: segment.subject || '',
          confidence: segment.confidence || 0,
          bounds: asBounds(pageSpans[0] && pageSpans[0].bounds) || asBounds(segment.bounds),
          pageSpans,
          pageIndexes,
          isCrossPage,
          crossPageLabel: isCrossPage ? (`跨${pageIndexes.length || 2}页`) : '',
          imageUrl: fileIDs[firstPage] || draft.fileID || '',
          pageFileIDs: pageIndexes.map((i) => fileIDs[i]).filter(Boolean),
          selected: true
        }
      }).filter((q) => q.text)

      const category = pickCategory((mapped[0] && mapped[0].subject) || '')
      pages.value = pageRows
      pageIndex.value = 0
      imagePath.value = (pageRows[0] && (pageRows[0].tempFilePath || resolveImageUrl(pageRows[0].fileID || pageRows[0].imageUrl))) || resolveImageUrl(draft.tempFilePath || draft.imageUrl)
      fileID.value = (pageRows[0] && (pageRows[0].fileID || pageRows[0].imageUrl)) || draft.fileID || draft.imageUrl || ''
      questions.value = mapped
      selectedCategory.value = category
      tempCategory.value = category
    })

    return {
      pages, pageIndex, imagePath, questions, overlays, selectedCount,
      selectedCategory, selectedDifficulty, tempCategory, tempDifficulty,
      categories, difficulties, saving, showPicker,
      switchPage, toggle, openPicker, confirmPicker, saveSelected
    }
  }
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding-bottom: 140px;
  background-color: #eef3fb;
  background-image:
    radial-gradient(circle 420px at 100% 0%, rgba(82,183,255,0.12) 0%, transparent 60%),
    radial-gradient(circle 360px at 0% 4%, rgba(182,166,255,0.10) 0%, transparent 55%);
}
.tips {
  margin: 12px 16px 0;
  padding: 12px 14px;
  border-radius: 12px;
  background: rgba(36, 89, 255, 0.08);
  color: #2459ff;
  font-size: 13px;
  line-height: 1.5;
}
.page-tabs { display: flex; gap: 8px; overflow-x: auto; padding: 12px 16px 0; }
.page-tab {
  border: none; background: #fff; color: #2459ff; border-radius: 999px;
  padding: 6px 12px; font-weight: 700; white-space: nowrap;
  box-shadow: 0 6px 16px rgba(11,22,51,0.06);
}
.page-tab.on { color: #fff; background: linear-gradient(135deg,#2459ff,#52b7ff); }
.image-wrap {
  position: relative; margin: 12px 16px; border-radius: 16px; overflow: hidden;
  background: #fff; box-shadow: 0 8px 32px rgba(31,91,255,0.08);
}
.preview { width: 100%; display: block; }
.overlay {
  position: absolute; box-sizing: border-box; padding: 0;
  border: 2px solid rgba(36,89,255,0.75); border-radius: 8px;
  background: rgba(36,89,255,0.08);
}
.overlay.on {
  border-color: #2459ff; background: rgba(36,89,255,0.22);
  box-shadow: 0 0 0 3px rgba(36,89,255,0.15);
}
.overlay-index {
  position: absolute; top: 4px; left: 6px; min-width: 20px; height: 20px;
  line-height: 20px; text-align: center; border-radius: 999px; font-size: 11px;
  color: #fff; background: linear-gradient(135deg,#2459ff,#52b7ff);
  font-weight: 800;
}
.list { padding: 0 16px 12px; }
.card {
  display: flex; gap: 12px; background: #fff; border: 1px solid rgba(11,22,51,0.06);
  border-radius: 16px; padding: 14px; margin-bottom: 10px; cursor: pointer;
}
.check {
  width: 22px; height: 22px; border-radius: 6px; flex-shrink: 0;
  border: 1.5px solid rgba(36,89,255,0.4); text-align: center; line-height: 20px;
  font-size: 12px; color: #fff;
}
.check.on { background: #2459ff; border-color: #2459ff; }
.body { flex: 1; min-width: 0; }
.meta { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 6px; }
.idx, .type { font-size: 12px; color: #2459ff; font-weight: 700; }
.cross {
  font-size: 11px; color: #2459ff; background: rgba(36,89,255,0.12);
  border-radius: 999px; padding: 1px 8px; font-weight: 700;
}
.body p { margin: 0; font-size: 14px; line-height: 1.6; color: #0b1633; white-space: pre-wrap; }
.empty { text-align: center; padding: 24px; color: rgba(11,22,51,0.45); }
.dock {
  position: fixed; left: 0; right: 0; bottom: 0; padding: 12px 16px 20px;
  background: rgba(255,255,255,0.96); box-shadow: 0 -8px 32px rgba(11,22,51,0.08);
}
.dock-head { display: flex; justify-content: space-between; margin-bottom: 10px; font-weight: 600; }
.link { border: none; background: none; color: #2459ff; font-weight: 700; }
.primary {
  width: 100%; border: none; border-radius: 14px; height: 46px; color: #fff; font-weight: 800;
  background: linear-gradient(135deg,#2459ff,#52b7ff); box-shadow: 0 10px 24px rgba(31,91,255,0.30);
}
.primary:disabled { opacity: 0.45; box-shadow: none; }
.primary.slim { width: auto; padding: 0 20px; height: 40px; }
.ghost { border: none; background: #eef3fb; border-radius: 12px; padding: 0 16px; font-weight: 700; }
.label { margin: 12px 0 8px; font-size: 13px; color: rgba(11,22,51,0.55); font-weight: 700; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chip { border: none; background: #f4f7fb; border-radius: 999px; padding: 6px 12px; font-weight: 700; }
.chip.on { color: #fff; background: linear-gradient(135deg,#2459ff,#52b7ff); }
.modal-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
</style>
