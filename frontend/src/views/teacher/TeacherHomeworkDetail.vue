<template>
  <div class="page">
    <van-nav-bar :title="hw.title || '作业详情'" left-arrow @click-left="$router.back()" fixed placeholder />
    <div class="hero">
      <div class="kicker">{{ hw.className || '作业' }}</div>
      <h1>{{ hw.title }}</h1>
      <p>截止 {{ hw.dueAt ? fmt(hw.dueAt) : '不限' }}</p>
      <div class="hero-stats">
        <div class="hero-stat"><b>{{ hw.submitted || 0 }}/{{ hw.studentCount || 0 }}</b><span>已交</span></div>
        <div class="hero-stat"><b>{{ hw.missing || 0 }}</b><span>未交</span></div>
        <div class="hero-stat"><b>{{ hw.graded || 0 }}</b><span>已批</span></div>
      </div>
    </div>

    <div class="section-head"><span>题目</span><span class="note">{{ (hw.questions || []).length }} 道</span></div>
    <div v-for="(q, i) in hw.questions || []" :key="i" class="card">
      <div class="q-index">第 {{ i + 1 }} 题</div>
      <div class="q-content">{{ q.content }}</div>
    </div>

    <div class="section-head"><span>学生</span><span class="note">{{ roster.length }} 人</span></div>
    <div v-if="roster.length > 6" class="search">
      <input v-model="keyword" placeholder="搜索学生昵称" />
    </div>
    <div v-for="s in visibleRoster" :key="s.studentId" class="card tap" @click="openGrade(s)">
      <div class="row">
        <div class="mark">{{ s.mark || (s.nickName || '学').slice(0, 1) }}</div>
        <div class="grow">
          <b>{{ s.nickName }}</b>
          <span>{{ s.statusKey === 'missing' ? '尚未提交' : (s.statusKey === 'graded' ? '点开查看作答' : '点开查看作答并打分') }}</span>
        </div>
        <span class="badge" :class="s.statusKey">{{ s.status }}</span>
      </div>
    </div>
    <div v-if="!roster.length" class="empty">班里还没有学生</div>
    <div class="footer">
      <button class="danger" @click="recall">撤回作业</button>
    </div>

    <van-popup v-model:show="gradeOpen" position="bottom" round :style="{ height: '86%' }">
      <div class="sheet">
        <div class="sheet-head">
          <b>{{ gradeStudent.nickName }}</b>
          <span>{{ gradeStudent.status }}</span>
          <van-icon name="cross" @click="gradeOpen = false" />
        </div>
        <div class="sheet-body">
          <div v-for="(item, i) in gradeItems" :key="i" class="grade-q">
            <div class="q-index">第 {{ item.index }} 题</div>
            <div class="q-content">{{ item.content }}</div>
            <div class="ans">{{ item.answer || '（空）' }}</div>
            <div class="mark-row">
              <button class="mark-chip" :class="{ 'on-right': item.result === 'right' }" @click="item.result = 'right'">对</button>
              <button class="mark-chip" :class="{ 'on-wrong': item.result === 'wrong' }" @click="item.result = 'wrong'">错</button>
            </div>
          </div>
          <label class="field">分数
            <input v-model="gradeScore" type="number" min="0" max="100" />
          </label>
          <p v-if="markHint" class="hint">{{ markHint }}</p>
          <textarea v-model="gradeComment" maxlength="200" placeholder="评语，选填" class="comment"></textarea>
          <button class="primary" :disabled="grading || gradeStudent.statusKey === 'missing'" @click="confirmGrade">确认批改</button>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<script>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showConfirmDialog, showToast } from 'vant'
import teacherAPI from '../../api/teacher'
import { fmtDay } from '../../utils/teacherClass'

export default {
  name: 'TeacherHomeworkDetail',
  setup() {
    const route = useRoute()
    const router = useRouter()
    const hw = ref({})
    const keyword = ref('')
    const gradeOpen = ref(false)
    const gradeStudent = ref({})
    const gradeItems = ref([])
    const gradeScore = ref('')
    const gradeComment = ref('')
    const grading = ref(false)
    const fail = (e) => showToast({ type: 'fail', message: e.response?.data?.message || '操作失败' })
    const fmt = fmtDay
    const roster = computed(() => hw.value.roster || [])
    const visibleRoster = computed(() => {
      const kw = keyword.value.trim()
      if (!kw) return roster.value
      return roster.value.filter((s) => (s.nickName || '').includes(kw))
    })
    const markHint = computed(() => {
      const n = gradeItems.value.length
      const marked = gradeItems.value.filter((x) => x.result).length
      if (!n) return ''
      if (marked && marked !== n) return '请把每道题标成对或错'
      if (marked === n) {
        const right = gradeItems.value.filter((x) => x.result === 'right').length
        return `按对错预填 ${Math.round(right / n * 100)} 分，可改`
      }
      return ''
    })

    const load = async () => {
      const res = await teacherAPI.homeworkDetail(route.params.id)
      hw.value = res.data || {}
    }

    watch(gradeItems, (items) => {
      const n = items.length
      const marked = items.filter((x) => x.result).length
      if (marked === n && n) {
        const right = items.filter((x) => x.result === 'right').length
        gradeScore.value = String(Math.round(right / n * 100))
      }
    }, { deep: true })

    const openGrade = (s) => {
      if (s.statusKey === 'missing') return showToast('该学生尚未提交')
      gradeStudent.value = s
      const qs = hw.value.questions || []
      const answers = s.answers || []
      const marks = s.marks || []
      gradeItems.value = qs.map((q, i) => ({
        index: i + 1,
        content: q.content,
        answer: typeof answers[i] === 'object' ? (answers[i]?.value ?? '') : (answers[i] ?? ''),
        result: marks[i] === 'right' || marks[i] === 'wrong' ? marks[i] : ''
      }))
      gradeScore.value = s.score == null ? '' : String(s.score)
      gradeComment.value = s.comment || s.feedback || ''
      gradeOpen.value = true
    }

    const confirmGrade = async () => {
      const n = gradeItems.value.length
      const marks = gradeItems.value.map((x) => x.result)
      if (marks.filter(Boolean).length !== n) return showToast('请把每道题标成对或错')
      grading.value = true
      try {
        await teacherAPI.grade(gradeStudent.value.submissionId || gradeStudent.value.id, {
          marks,
          score: Number(gradeScore.value),
          comment: gradeComment.value
        })
        gradeOpen.value = false
        await load()
        showToast({ type: 'success', message: '已批改' })
      } catch (e) { fail(e) }
      finally { grading.value = false }
    }

    const recall = async () => {
      await showConfirmDialog({ title: '撤回作业', message: '撤回后学生将看不到这份作业。', confirmButtonText: '撤回', confirmButtonColor: '#e11d48' })
      await teacherAPI.recallHomework(route.params.id)
      showToast({ type: 'success', message: '已撤回' })
      router.replace('/teacher/homework')
    }

    onMounted(() => load().catch(fail))
    return {
      hw, keyword, roster, visibleRoster, gradeOpen, gradeStudent, gradeItems, gradeScore, gradeComment,
      grading, markHint, fmt, openGrade, confirmGrade, recall
    }
  }
}
</script>

<style scoped>
.page { min-height: 100vh; padding-bottom: 32px; background: #eef3fb; }
.hero { margin: 12px 16px; background: linear-gradient(135deg, #2459ff, #52b7ff); border-radius: 20px; padding: 18px; color: #fff; }
.kicker { font-size: 12px; opacity: 0.85; }
.hero h1 { margin: 4px 0 6px; font-size: 22px; }
.hero p { margin: 0; font-size: 13px; opacity: 0.88; }
.hero-stats { margin-top: 14px; display: flex; background: rgba(255,255,255,0.18); border-radius: 14px; }
.hero-stat { flex: 1; text-align: center; padding: 10px 0; }
.hero-stat b { display: block; font-size: 18px; }
.hero-stat span { font-size: 11px; }
.section-head { display: flex; justify-content: space-between; margin: 16px 16px 8px; font-weight: 800; }
.note { font-weight: 500; color: rgba(11,22,51,0.45); }
.card { background: #fff; margin: 0 16px 8px; padding: 14px; border-radius: 16px; border: 1px solid rgba(11,22,51,0.06); }
.q-index { font-size: 12px; color: #2459ff; font-weight: 800; }
.q-content { margin-top: 6px; font-size: 14px; line-height: 1.55; }
.search { margin: 0 16px 8px; background: #fff; border-radius: 12px; padding: 0 12px; }
.search input { width: 100%; height: 40px; border: none; }
.tap { cursor: pointer; }
.row { display: flex; align-items: center; gap: 10px; }
.mark { width: 36px; height: 36px; border-radius: 50%; background: #eaf1ff; color: #2459ff; font-weight: 800; display: flex; align-items: center; justify-content: center; }
.grow { flex: 1; display: flex; flex-direction: column; }
.grow span { font-size: 12px; color: rgba(11,22,51,0.5); margin-top: 2px; }
.badge { font-size: 11px; padding: 3px 10px; border-radius: 999px; white-space: nowrap; background: #f4f7fb; }
.badge.submitted { background: rgba(217,119,6,0.12); color: #d97706; }
.badge.graded { background: rgba(22,163,74,0.12); color: #16a34a; }
.badge.missing { color: rgba(11,22,51,0.45); }
.footer { padding: 16px; }
.danger { width: 100%; height: 42px; border: none; border-radius: 999px; background: rgba(225,29,72,0.1); color: #e11d48; font-weight: 700; }
.empty { text-align: center; padding: 20px; color: rgba(11,22,51,0.45); }
.sheet { display: flex; flex-direction: column; height: 100%; }
.sheet-head { display: flex; align-items: center; gap: 8px; padding: 16px; border-bottom: 1px solid rgba(11,22,51,0.06); }
.sheet-head b { flex: 1; }
.sheet-head span { font-size: 12px; color: rgba(11,22,51,0.5); }
.sheet-body { flex: 1; overflow-y: auto; padding: 12px 16px 24px; }
.grade-q { background: #f9fbff; border-radius: 12px; padding: 12px; margin-bottom: 10px; }
.ans { margin-top: 8px; color: #0b1633; font-size: 13px; }
.mark-row { display: flex; gap: 8px; margin-top: 10px; }
.mark-chip { flex: 1; height: 36px; border: none; border-radius: 999px; background: #fff; font-weight: 700; }
.mark-chip.on-right { background: rgba(22,163,74,0.15); color: #16a34a; }
.mark-chip.on-wrong { background: rgba(225,29,72,0.12); color: #e11d48; }
.field { display: flex; align-items: center; gap: 8px; margin: 8px 0; font-size: 14px; }
.field input { flex: 1; height: 40px; border: none; background: #f4f7fb; border-radius: 12px; padding: 0 12px; }
.hint { font-size: 12px; color: rgba(11,22,51,0.5); }
.comment { width: 100%; min-height: 72px; border: none; background: #f4f7fb; border-radius: 12px; padding: 10px; }
.primary { width: 100%; height: 44px; margin-top: 12px; border: none; border-radius: 999px; color: #fff; font-weight: 700; background: linear-gradient(135deg,#2459ff,#52b7ff); }
</style>
