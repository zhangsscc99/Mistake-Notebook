<template>
  <div class="page">
    <van-nav-bar :title="hw.title || '作业'" left-arrow @click-left="$router.back()" fixed placeholder />

    <div class="card">
      <p v-if="hw.description" class="desc">{{ hw.description }}</p>
      <div class="meta">
        {{ hw.questionCount }} 题
        <span v-if="hw.dueAt"> · 截止 {{ fmt(hw.dueAt) }}</span>
      </div>
      <div v-if="graded" class="score-box">
        <b>{{ sub.score ?? 0 }}</b> 分
        <p v-if="sub.feedback">老师点评：{{ sub.feedback }}</p>
      </div>
    </div>

    <div v-for="(q, i) in hw.questions || []" :key="i" class="card">
      <div class="q-head">
        <span class="idx">{{ i + 1 }}</span>
        <span class="score-tag">{{ q.score || 10 }} 分</span>
        <span v-if="graded && sub.marks?.length" class="got">{{ markText(i) }}</span>
      </div>
      <p class="q-content">{{ q.content }}</p>
      <textarea
        v-if="!submitted"
        v-model="answers[i]"
        class="answer-input"
        placeholder="写下你的作答…"
      ></textarea>
      <div v-else class="answer-done">
        <b>你的作答</b>
        <p>{{ answers[i] || '（未作答）' }}</p>
        <template v-if="graded && q.answer">
          <b>参考答案</b>
          <p>{{ q.answer }}</p>
        </template>
      </div>
    </div>

    <div v-if="!submitted" class="footer">
      <button class="primary" :disabled="saving" @click="submit">{{ saving ? '提交中…' : '提交作业' }}</button>
    </div>
    <p v-else class="tip">{{ graded ? '老师已批改。' : '已提交，等待老师批改。' }}</p>
  </div>
</template>

<script>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { showToast } from 'vant'
import classroomAPI from '../api/classroom'

export default {
  name: 'StudentHomeworkDetail',
  setup() {
    const route = useRoute()
    const hw = ref({})
    const sub = ref({})
    const answers = ref([])
    const saving = ref(false)

    const submitted = computed(() => !!sub.value.status)
    const graded = computed(() => sub.value.status === 'GRADED')

    const plain = (v) => (v && typeof v === 'object' ? (v.value ?? '') : (v ?? ''))

    const load = async () => {
      const res = await classroomAPI.homeworkDetail(route.params.id)
      const d = res.data || {}
      hw.value = d
      sub.value = d.submission || {}
      const count = (d.questions || []).length
      const existing = (sub.value.answers || []).map(plain)
      answers.value = Array.from({ length: count }, (_, i) => existing[i] ?? '')
    }

    const itemScore = (i) => {
      const v = (sub.value.itemScores || [])[i]
      if (v == null) return 0
      return typeof v === 'object' ? (v.value ?? 0) : v
    }
    const markText = (i) => {
      const m = (sub.value.marks || [])[i]
      if (m === 'right' || m === '对') return '对'
      if (m === 'wrong' || m === '错') return '错'
      return '得 ' + itemScore(i) + ' 分'
    }

    const submit = async () => {
      saving.value = true
      try {
        await classroomAPI.submitHomework(route.params.id, answers.value)
        await load()
        showToast({ type: 'success', message: '已提交' })
      } catch (e) {
        showToast({ type: 'fail', message: e.response?.data?.message || '提交失败' })
      } finally {
        saving.value = false
      }
    }

    const fmt = (t) => (t ? String(t).replace('T', ' ').slice(0, 16) : '')
    onMounted(() => load().catch((e) => showToast({ type: 'fail', message: e.response?.data?.message || '加载失败' })))
    return { hw, sub, answers, saving, submitted, graded, itemScore, markText, submit, fmt }
  }
}
</script>

<style scoped>
.page { min-height: 100vh; padding-bottom: 100px; background: #eef3fb; }
.card { background: #fff; margin: 12px 16px; padding: 16px; border-radius: 16px; border: 1px solid rgba(11,22,51,0.06); }
.desc { margin: 0 0 8px; font-size: 13px; color: rgba(11,22,51,0.6); }
.meta { font-size: 12px; color: rgba(11,22,51,0.5); }
.score-box { margin-top: 12px; background: rgba(36,89,255,0.08); border-radius: 12px; padding: 12px; }
.score-box b { font-size: 24px; color: #2459ff; }
.score-box p { margin: 6px 0 0; font-size: 13px; color: rgba(11,22,51,0.7); }
.q-head { display: flex; align-items: center; gap: 8px; }
.idx { width: 22px; height: 22px; border-radius: 7px; background: #2459ff; color: #fff; font-size: 12px; text-align: center; line-height: 22px; font-weight: 700; }
.score-tag { font-size: 12px; color: rgba(11,22,51,0.5); }
.got { margin-left: auto; font-size: 12px; font-weight: 700; color: #16a34a; }
.q-content { margin: 10px 0; font-size: 14px; line-height: 1.65; white-space: pre-wrap; }
.answer-input { width: 100%; height: 90px; border: none; background: #f4f7fb; border-radius: 12px; padding: 10px; resize: none; font-size: 14px; }
.answer-done { background: #f9fbff; border-radius: 12px; padding: 12px; font-size: 13px; }
.answer-done p { margin: 4px 0 10px; white-space: pre-wrap; line-height: 1.6; }
.footer { position: fixed; left: 0; right: 0; bottom: 0; padding: 12px 16px calc(12px + env(safe-area-inset-bottom)); background: #fff; border-top: 1px solid rgba(11,22,51,0.06); }
.primary { width: 100%; height: 44px; border: none; border-radius: 999px; color: #fff; font-weight: 700; background: linear-gradient(135deg,#2459ff,#52b7ff); }
.tip { text-align: center; font-size: 13px; color: rgba(11,22,51,0.5); padding: 8px 16px 24px; }
</style>
