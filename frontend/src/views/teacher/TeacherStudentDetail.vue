<template>
  <div class="page">
    <van-nav-bar :title="ov.student?.nickName || '学生详情'" left-arrow @click-left="$router.back()" fixed placeholder />

    <div class="tabs">
      <button v-for="t in tabs" :key="t.key" :class="{ on: tab === t.key }" @click="tab = t.key">{{ t.label }}</button>
    </div>

    <!-- 学习情况 -->
    <template v-if="tab === 'overview'">
      <div class="card stat-grid">
        <div class="stat"><b>{{ ov.questionCount || 0 }}</b><span>错题</span></div>
        <div class="stat"><b>{{ ov.masteredCount || 0 }}</b><span>已掌握</span></div>
        <div class="stat"><b>{{ ov.noteCount || 0 }}</b><span>笔记</span></div>
        <div class="stat"><b>{{ ov.checkinStreak || 0 }}</b><span>连续打卡</span></div>
      </div>

      <div class="card">
        <h3>近 14 天新增</h3>
        <div class="bars">
          <div v-for="d in ov.trend || []" :key="d.day" class="bar-col" :title="d.day + ' · ' + d.count + ' 题'">
            <div class="bar" :style="{ height: barHeight(d.count) }"></div>
            <span class="dot" :class="{ on: d.checked }"></span>
          </div>
        </div>
        <p class="hint">柱高为当日新增错题，下方圆点为当日打卡</p>
      </div>

      <div v-if="ov.categories?.length" class="card">
        <h3>分类分布</h3>
        <div v-for="c in ov.categories" :key="c.name" class="dist">
          <span class="dist-name">{{ c.name }}</span>
          <div class="track"><i :style="{ width: pct(c.count) + '%' }"></i></div>
          <span class="dist-num">{{ c.count }}</span>
        </div>
      </div>

      <div class="card">
        <h3>作业情况</h3>
        <div class="stat-grid">
          <div class="stat"><b>{{ ov.homeworkSubmitted || 0 }}</b><span>已提交</span></div>
          <div class="stat"><b>{{ ov.homeworkGraded || 0 }}</b><span>已批改</span></div>
          <div class="stat"><b>{{ ov.homeworkAvgScore ?? '—' }}</b><span>平均分</span></div>
        </div>
      </div>
    </template>

    <!-- 错题 -->
    <template v-else-if="tab === 'questions'">
      <div v-if="!questions.length" class="empty">这位学生还没有错题。</div>
      <div v-for="(q, i) in questions" :key="q.id" class="card q">
        <div class="q-meta">
          <span class="idx">#{{ i + 1 }}</span>
          <span class="tag">{{ q.category }}</span>
          <span class="diff" :class="'d-' + q.difficulty">{{ diffText(q.difficulty) }}</span>
        </div>
        <p class="q-content">{{ q.content }}</p>
        <button class="ghost" @click="q.open = !q.open">{{ q.open ? '收起答案' : '查看答案与解析' }}</button>
        <div v-if="q.open" class="answer">
          <b>答案</b><p>{{ q.aiAnswer || '暂无' }}</p>
          <b>解析</b><p>{{ q.aiAnalysis || '暂无' }}</p>
        </div>
      </div>
    </template>

    <!-- 留言 -->
    <template v-else-if="tab === 'messages'">
      <div class="chat">
        <div v-if="!messages.length" class="empty">还没有留言，给学生留一句吧。</div>
        <div v-for="m in messages" :key="m.id" class="msg" :class="m.senderRole === 'TEACHER' ? 'mine' : 'theirs'">
          <div class="bubble">{{ m.content }}</div>
          <span class="time">{{ fmt(m.createdAt) }}</span>
        </div>
      </div>
      <div class="composer">
        <input v-model="draft" placeholder="写给学生的话…" @keyup.enter="send" />
        <button class="primary slim" :disabled="sending || !draft.trim()" @click="send">发送</button>
      </div>
    </template>

    <!-- 家长报告 -->
    <template v-else>
      <div class="card">
        <h3>生成家长端报告</h3>
        <p class="hint">根据学生错题、掌握率、打卡和作业情况，自动生成一份给家长看的报告。</p>
        <textarea v-model="note" class="note" placeholder="老师补充（可选），例如课堂表现…"></textarea>
        <button class="primary" :disabled="generating" @click="genReport">{{ generating ? '生成中…' : '生成报告' }}</button>
      </div>
      <div v-for="r in reports" :key="r.id" class="card report">
        <div class="report-main" @click="$router.push('/teacher/parent-reports/' + r.id)">
          <b>{{ r.title }}</b>
          <span>{{ fmt(r.createdAt) }}</span>
        </div>
        <button class="del" @click="removeReport(r)">删除</button>
      </div>
    </template>
  </div>
</template>

<script>
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showConfirmDialog, showToast } from 'vant'
import teacherAPI from '../../api/teacher'

export default {
  name: 'TeacherStudentDetail',
  setup() {
    const route = useRoute()
    const router = useRouter()
    const studentId = route.params.id
    const tab = ref('overview')
    const tabs = [
      { key: 'overview', label: '学习情况' },
      { key: 'questions', label: '错题' },
      { key: 'messages', label: '留言' },
      { key: 'reports', label: '家长报告' }
    ]
    const ov = ref({})
    const questions = ref([])
    const messages = ref([])
    const reports = ref([])
    const draft = ref('')
    const note = ref('')
    const sending = ref(false)
    const generating = ref(false)

    const fail = (e) => showToast({ type: 'fail', message: e.response?.data?.message || '加载失败' })

    const loadOverview = async () => {
      const res = await teacherAPI.studentOverview(studentId)
      ov.value = res.data || {}
    }
    const loadQuestions = async () => {
      const res = await teacherAPI.studentQuestions(studentId)
      questions.value = (res.data || []).map((q) => ({ ...q, open: false }))
    }
    const loadMessages = async () => {
      const res = await teacherAPI.messages(studentId)
      messages.value = res.data || []
    }
    const loadReports = async () => {
      const res = await teacherAPI.parentReports(studentId)
      reports.value = res.data || []
    }

    watch(tab, (t) => {
      if (t === 'questions' && !questions.value.length) loadQuestions().catch(fail)
      if (t === 'messages') loadMessages().catch(fail)
      if (t === 'reports') loadReports().catch(fail)
    })

    const send = async () => {
      if (!draft.value.trim()) return
      sending.value = true
      try {
        await teacherAPI.sendMessage(studentId, draft.value.trim())
        draft.value = ''
        await loadMessages()
      } catch (e) {
        fail(e)
      } finally {
        sending.value = false
      }
    }

    const genReport = async () => {
      generating.value = true
      try {
        const res = await teacherAPI.generateParentReport(studentId, note.value)
        note.value = ''
        showToast({ type: 'success', message: '已生成' })
        router.push('/teacher/parent-reports/' + res.data.id)
      } catch (e) {
        fail(e)
      } finally {
        generating.value = false
      }
    }

    const removeReport = async (r) => {
      await showConfirmDialog({ title: '删除报告', message: '删除后无法恢复' })
      await teacherAPI.deleteParentReport(r.id)
      reports.value = reports.value.filter((x) => x.id !== r.id)
    }

    const maxTrend = () => Math.max(1, ...(ov.value.trend || []).map((d) => d.count))
    const barHeight = (n) => Math.max(4, Math.round((n / maxTrend()) * 56)) + 'px'
    const pct = (n) => {
      const max = Math.max(1, ...(ov.value.categories || []).map((c) => c.count))
      return Math.round((n / max) * 100)
    }
    const diffText = (d) => ({ easy: '简单', medium: '中等', hard: '困难' }[d] || '中等')
    const fmt = (t) => (t ? String(t).replace('T', ' ').slice(0, 16) : '')

    onMounted(() => loadOverview().catch(fail))
    return {
      tab, tabs, ov, questions, messages, reports, draft, note, sending, generating,
      send, genReport, removeReport, barHeight, pct, diffText, fmt
    }
  }
}
</script>

<style scoped>
.page { min-height: 100vh; padding-bottom: 80px; background: #eef3fb; }
.tabs { display: flex; gap: 8px; padding: 12px 16px 0; overflow-x: auto; }
.tabs button { border: none; background: #fff; color: rgba(11,22,51,0.6); border-radius: 999px; padding: 8px 14px; font-weight: 700; white-space: nowrap; }
.tabs button.on { background: linear-gradient(135deg,#2459ff,#52b7ff); color: #fff; }
.card { background: #fff; margin: 12px 16px; padding: 16px; border-radius: 16px; border: 1px solid rgba(11,22,51,0.06); }
.card h3 { margin: 0 0 10px; font-size: 15px; }
.hint { margin: 0 0 10px; font-size: 12px; color: rgba(11,22,51,0.5); }
.stat-grid { display: flex; justify-content: space-around; text-align: center; }
.stat b { display: block; font-size: 20px; color: #0b1633; }
.stat span { font-size: 11px; color: rgba(11,22,51,0.5); }
.bars { display: flex; align-items: flex-end; gap: 4px; height: 70px; }
.bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 4px; }
.bar { width: 100%; border-radius: 4px 4px 0 0; background: linear-gradient(180deg,#2459ff,#52b7ff); }
.dot { width: 5px; height: 5px; border-radius: 50%; background: rgba(11,22,51,0.15); }
.dot.on { background: #16a34a; }
.dist { display: grid; grid-template-columns: 70px 1fr 32px; gap: 8px; align-items: center; margin-bottom: 8px; font-size: 12px; }
.track { height: 8px; background: #eef3fb; border-radius: 99px; overflow: hidden; }
.track i { display: block; height: 100%; background: linear-gradient(90deg,#2459ff,#52b7ff); }
.empty { padding: 32px 24px; text-align: center; color: rgba(11,22,51,0.5); font-size: 13px; }
.q-meta { display: flex; gap: 8px; align-items: center; font-size: 12px; color: rgba(11,22,51,0.5); }
.idx { font-weight: 800; color: #2459ff; }
.q-content { margin: 8px 0; line-height: 1.6; white-space: pre-wrap; font-size: 14px; }
.ghost { border: none; background: #eef3fb; color: #2459ff; border-radius: 999px; padding: 6px 12px; font-weight: 700; }
.answer { margin-top: 10px; background: #f4f7fb; border-radius: 12px; padding: 10px; font-size: 13px; }
.answer p { margin: 4px 0 10px; white-space: pre-wrap; }
.d-easy { color: #16a34a; }
.d-hard { color: #e11d48; }
.chat { padding: 12px 16px 0; display: flex; flex-direction: column; gap: 10px; }
.msg { display: flex; flex-direction: column; max-width: 78%; }
.msg.mine { align-self: flex-end; align-items: flex-end; }
.msg.theirs { align-self: flex-start; }
.bubble { padding: 10px 12px; border-radius: 14px; background: #fff; font-size: 14px; line-height: 1.6; white-space: pre-wrap; }
.msg.mine .bubble { background: linear-gradient(135deg,#2459ff,#52b7ff); color: #fff; }
.time { font-size: 11px; color: rgba(11,22,51,0.35); margin-top: 4px; }
.composer { position: fixed; left: 0; right: 0; bottom: 0; display: flex; gap: 8px; padding: 12px 16px calc(12px + env(safe-area-inset-bottom)); background: #fff; border-top: 1px solid rgba(11,22,51,0.06); }
.composer input { flex: 1; height: 40px; border: none; background: #f4f7fb; border-radius: 999px; padding: 0 14px; }
.note { width: 100%; height: 80px; border: none; background: #f4f7fb; border-radius: 12px; padding: 10px; resize: none; margin-bottom: 10px; }
.primary { width: 100%; height: 42px; border: none; border-radius: 999px; color: #fff; font-weight: 700; background: linear-gradient(135deg,#2459ff,#52b7ff); }
.primary.slim { width: auto; padding: 0 18px; height: 40px; }
.report { display: flex; align-items: center; gap: 8px; }
.report-main { flex: 1; display: flex; flex-direction: column; cursor: pointer; }
.report-main span { font-size: 12px; color: rgba(11,22,51,0.45); }
.del { border: none; background: none; color: #e11d48; font-weight: 700; }
</style>
