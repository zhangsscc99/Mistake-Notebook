<template>
  <div class="page">
    <van-nav-bar title="家长报告" left-arrow @click-left="$router.back()" fixed placeholder />
    <div class="chips">
      <button v-for="c in classes" :key="c.id" class="chip" :class="{ on: classId === c.id }" @click="select(c)">{{ c.name }}</button>
    </div>
    <button class="primary" :disabled="!classId || generating" @click="generate">{{ generating ? '生成中…' : '生成班级学情报告' }}</button>

    <div v-if="report.id" class="card">
      <b>{{ report.title }}</b>
      <p class="meta">{{ report.className }} · {{ report.studentCount }} 人 · 均分 {{ report.classAverage ?? '暂无' }}</p>
      <div class="section" v-if="report.byCategory?.length">
        <h4>学科分布</h4>
        <div v-for="c in report.byCategory" :key="c.name" class="dist">
          <span>{{ c.name }}</span>
          <div class="track"><i :style="{ width: (c.pct || 0) + '%' }"></i></div>
          <em>{{ c.count }}</em>
        </div>
      </div>
      <div class="section" v-if="report.hot?.length">
        <h4>高频错题</h4>
        <p v-for="(h, i) in report.hot" :key="i" class="hot">{{ i + 1 }}. {{ h.content }}（{{ h.count }} 次 / {{ h.studentCount }} 人）</p>
      </div>
      <div class="section" v-if="report.students?.length">
        <h4>学生</h4>
        <div v-for="s in report.students" :key="s.studentId" class="stu">
          <b>{{ s.nickName }}</b>
          <span>错题 {{ s.questionCount }} · 均分 {{ s.averageScore ?? '暂无' }} · 薄弱 {{ s.weak || '暂无' }}</span>
        </div>
      </div>
      <button class="ghost" @click="copy">复制全文发给家长</button>
    </div>

    <div class="section-head">历史报告</div>
    <div v-for="r in history" :key="r.id" class="card tap" @click="open(r.id)">
      <b>{{ r.title }}</b>
      <span>{{ fmt(r.createdAt) }} · {{ r.studentCount || 0 }} 人</span>
    </div>
    <div v-if="!history.length && !report.id" class="empty">还没有班级家长报告</div>
  </div>
</template>

<script>
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { showToast } from 'vant'
import teacherAPI from '../../api/teacher'
import { fmtDay, getSelectedClassId, setSelectedClassId } from '../../utils/teacherClass'

export default {
  name: 'TeacherClassReport',
  setup() {
    const route = useRoute()
    const classes = ref([])
    const classId = ref(0)
    const report = ref({})
    const history = ref([])
    const generating = ref(false)
    const fmt = fmtDay
    const fail = (e) => showToast({ type: 'fail', message: e.response?.data?.message || '操作失败' })

    const loadHistory = async (id) => {
      const res = await teacherAPI.classReports(id)
      history.value = res.data || []
    }

    const select = async (c) => {
      classId.value = c.id
      setSelectedClassId(c.id)
      report.value = {}
      await loadHistory(c.id)
    }

    const generate = async () => {
      generating.value = true
      try {
        const res = await teacherAPI.createClassReport(classId.value)
        report.value = res.data || {}
        await loadHistory(classId.value)
      } catch (e) { fail(e) }
      finally { generating.value = false }
    }

    const open = async (id) => {
      const res = await teacherAPI.classReport(id)
      report.value = res.data || {}
    }

    const copy = async () => {
      try {
        await navigator.clipboard.writeText(`${report.value.title}\n\n${report.value.content || ''}`)
        showToast({ type: 'success', message: '已复制' })
      } catch {
        showToast('长按选择文字复制')
      }
    }

    onMounted(async () => {
      try {
        const res = await teacherAPI.dashboard()
        classes.value = (res.data && res.data.classes) || []
        const want = Number(route.query.classId || getSelectedClassId() || 0)
        const cls = classes.value.find((c) => c.id === want) || classes.value[0]
        if (cls) await select(cls)
      } catch (e) { fail(e) }
    })

    return { classes, classId, report, history, generating, fmt, select, generate, open, copy }
  }
}
</script>

<style scoped>
.page { min-height: 100vh; padding-bottom: 24px; background: #eef3fb; }
.chips { display: flex; gap: 8px; flex-wrap: wrap; padding: 12px 16px; }
.chip { border: none; background: #fff; border-radius: 999px; padding: 6px 12px; font-weight: 700; }
.chip.on { background: linear-gradient(135deg,#2459ff,#52b7ff); color: #fff; }
.primary { display: block; margin: 0 16px 12px; width: calc(100% - 32px); height: 44px; border: none; border-radius: 999px; color: #fff; font-weight: 700; background: linear-gradient(135deg,#2459ff,#52b7ff); }
.card { background: #fff; margin: 0 16px 8px; padding: 14px; border-radius: 16px; border: 1px solid rgba(11,22,51,0.06); }
.card.tap { display: flex; flex-direction: column; cursor: pointer; }
.card.tap span, .meta { font-size: 12px; color: rgba(11,22,51,0.5); margin-top: 4px; }
.section { margin-top: 12px; }
.section h4 { margin: 0 0 8px; font-size: 13px; }
.dist { display: grid; grid-template-columns: 64px 1fr 28px; align-items: center; gap: 8px; font-size: 12px; margin-bottom: 6px; }
.track { height: 6px; background: #eef3fb; border-radius: 999px; overflow: hidden; }
.track i { display: block; height: 100%; background: linear-gradient(135deg,#2459ff,#52b7ff); }
.hot, .stu span { font-size: 13px; color: rgba(11,22,51,0.7); line-height: 1.5; }
.stu { display: flex; flex-direction: column; margin-bottom: 8px; }
.ghost { margin-top: 12px; border: none; background: #eef3fb; color: #2459ff; border-radius: 999px; padding: 8px 14px; font-weight: 700; }
.section-head { margin: 16px 16px 8px; font-weight: 800; }
.empty { text-align: center; padding: 24px; color: rgba(11,22,51,0.45); }
</style>
