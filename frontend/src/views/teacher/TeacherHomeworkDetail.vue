<template>
  <div class="page">
    <van-nav-bar :title="hw.title || '作业详情'" left-arrow @click-left="$router.back()" fixed placeholder />

    <div class="card">
      <p v-if="hw.description" class="desc">{{ hw.description }}</p>
      <div class="meta">
        {{ hw.questionCount }} 题
        <span v-if="hw.dueAt"> · 截止 {{ fmt(hw.dueAt) }}</span>
      </div>
    </div>

    <div v-if="hw.notSubmitted?.length" class="card">
      <h3>未提交（{{ hw.notSubmitted.length }}）</h3>
      <div class="chips">
        <span v-for="s in hw.notSubmitted" :key="s.id" class="chip">{{ s.nickName }}</span>
      </div>
    </div>

    <div class="card">
      <h3>已提交（{{ hw.submissions?.length || 0 }}）</h3>
      <div v-if="!hw.submissions?.length" class="empty">还没有学生提交。</div>
      <div v-for="s in hw.submissions || []" :key="s.id" class="sub">
        <div class="sub-head" @click="s.open = !s.open">
          <b>{{ s.studentName }}</b>
          <span class="pill" :class="s.status === 'GRADED' ? 'ok' : 'hot'">
            {{ s.status === 'GRADED' ? '已批改 ' + (s.score ?? 0) + ' 分' : '待批改' }}
          </span>
          <van-icon :name="s.open ? 'arrow-up' : 'arrow-down'" />
        </div>

        <div v-if="s.open" class="sub-body">
          <div v-for="(q, i) in hw.questions || []" :key="i" class="item">
            <div class="item-q">
              <span class="idx">{{ i + 1 }}</span>
              <span>{{ q.content }}</span>
            </div>
            <div class="item-ref">参考答案：{{ q.answer || '—' }}</div>
            <div class="item-ans">学生作答：{{ answerOf(s, i) || '（未作答）' }}</div>
            <div class="item-score">
              得分
              <input v-model.number="scoreDraft(s)[i]" type="number" min="0" :max="q.score || 10" class="score" />
              / {{ q.score || 10 }}
            </div>
          </div>

          <textarea v-model="s.feedbackDraft" class="feedback" placeholder="老师点评（会发给学生）"></textarea>

          <div v-if="s.aiFeedback" class="ai-box">
            <b>AI 批改建议</b>
            <p>{{ s.aiFeedback }}</p>
          </div>

          <div class="sub-actions">
            <button class="ghost" :disabled="s.aiLoading" @click="runAiGrade(s)">
              {{ s.aiLoading ? 'AI 批改中…' : 'AI 预批改' }}
            </button>
            <button class="primary slim" :disabled="s.saving" @click="submitGrade(s)">
              {{ s.saving ? '保存中…' : '保存批改' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { showToast } from 'vant'
import teacherAPI from '../../api/teacher'

export default {
  name: 'TeacherHomeworkDetail',
  setup() {
    const route = useRoute()
    const hw = ref({})
    const fail = (e) => showToast({ type: 'fail', message: e.response?.data?.message || '操作失败' })

    const decorate = (data) => {
      const qCount = (data.questions || []).length
      data.submissions = (data.submissions || []).map((s) => ({
        ...s,
        open: false,
        saving: false,
        aiLoading: false,
        feedbackDraft: s.feedback || '',
        scores: Array.from({ length: qCount }, (_, i) => {
          const v = (s.itemScores || [])[i]
          if (v == null) return 0
          return typeof v === 'object' ? (v.value ?? 0) : v
        })
      }))
      return data
    }

    const load = async () => {
      const res = await teacherAPI.homeworkDetail(route.params.id)
      hw.value = decorate(res.data || {})
    }

    const answerOf = (s, i) => {
      const a = (s.answers || [])[i]
      if (a == null) return ''
      return typeof a === 'object' ? (a.value ?? '') : a
    }
    const scoreDraft = (s) => s.scores

    const runAiGrade = async (s) => {
      s.aiLoading = true
      try {
        const res = await teacherAPI.aiGrade(s.id)
        const d = res.data || {}
        s.aiFeedback = d.aiFeedback || ''
        const suggested = d.suggestedScores || []
        suggested.forEach((v, i) => {
          if (i < s.scores.length) s.scores[i] = typeof v === 'number' ? v : Number(v) || 0
        })
        showToast({ type: 'success', message: 'AI 已给出建议分数，可手动调整' })
      } catch (e) {
        fail(e)
      } finally {
        s.aiLoading = false
      }
    }

    const submitGrade = async (s) => {
      s.saving = true
      try {
        await teacherAPI.grade(s.id, { itemScores: s.scores, feedback: s.feedbackDraft })
        await load()
        showToast({ type: 'success', message: '已批改，学生会收到通知' })
      } catch (e) {
        fail(e)
      } finally {
        s.saving = false
      }
    }

    const fmt = (t) => (t ? String(t).replace('T', ' ').slice(0, 16) : '')
    onMounted(() => load().catch(fail))
    return { hw, answerOf, scoreDraft, runAiGrade, submitGrade, fmt }
  }
}
</script>

<style scoped>
.page { min-height: 100vh; padding-bottom: 32px; background: #eef3fb; }
.card { background: #fff; margin: 12px 16px; padding: 16px; border-radius: 16px; border: 1px solid rgba(11,22,51,0.06); }
.card h3 { margin: 0 0 10px; font-size: 15px; }
.desc { margin: 0 0 8px; font-size: 13px; color: rgba(11,22,51,0.6); }
.meta { font-size: 12px; color: rgba(11,22,51,0.5); }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chip { background: #f4f7fb; border-radius: 999px; padding: 5px 12px; font-size: 12px; color: rgba(11,22,51,0.6); }
.empty { padding: 20px; text-align: center; color: rgba(11,22,51,0.45); font-size: 13px; }
.sub { border-top: 1px solid rgba(11,22,51,0.06); padding: 10px 0; }
.sub-head { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.sub-head b { flex: 1; font-size: 14px; }
.pill { font-size: 11px; padding: 3px 10px; border-radius: 999px; white-space: nowrap; }
.pill.ok { background: rgba(22,163,74,0.12); color: #16a34a; }
.pill.hot { background: rgba(225,29,72,0.12); color: #e11d48; }
.sub-body { margin-top: 10px; }
.item { background: #f9fbff; border-radius: 12px; padding: 12px; margin-bottom: 10px; font-size: 13px; }
.item-q { display: flex; gap: 8px; line-height: 1.6; }
.idx { width: 20px; height: 20px; border-radius: 6px; background: #2459ff; color: #fff; font-size: 12px; text-align: center; line-height: 20px; flex-shrink: 0; font-weight: 700; }
.item-ref { margin-top: 8px; color: rgba(11,22,51,0.5); }
.item-ans { margin-top: 4px; color: #0b1633; }
.item-score { margin-top: 8px; display: flex; align-items: center; gap: 6px; color: rgba(11,22,51,0.6); }
.score { width: 60px; height: 32px; border: none; background: #fff; border-radius: 8px; text-align: center; }
.feedback { width: 100%; height: 72px; border: none; background: #f4f7fb; border-radius: 12px; padding: 10px; resize: none; }
.ai-box { margin-top: 10px; background: rgba(36,89,255,0.06); border-radius: 12px; padding: 12px; font-size: 13px; }
.ai-box b { color: #2459ff; }
.ai-box p { margin: 6px 0 0; white-space: pre-wrap; line-height: 1.6; }
.sub-actions { display: flex; gap: 8px; margin-top: 12px; }
.ghost { border: none; background: #eef3fb; color: #2459ff; border-radius: 999px; padding: 9px 14px; font-weight: 700; }
.primary.slim { border: none; border-radius: 999px; padding: 0 18px; height: 38px; color: #fff; font-weight: 700; background: linear-gradient(135deg,#2459ff,#52b7ff); margin-left: auto; }
</style>
