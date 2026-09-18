<template>
  <div class="page">
    <van-nav-bar title="发给班级" left-arrow @click-left="$router.back()" fixed placeholder />
    <div class="hero">
      <div class="kicker">SEND</div>
      <h1>发给班级</h1>
      <p>发卷就是发作业。选发给哪个班，学生作答提交后你再批改。</p>
    </div>
    <p class="hint">学生可以打字或上传图片作答，老师在作业页打分。</p>

    <div class="section-head"><span>班级</span></div>
    <div class="chips">
      <button v-for="c in classes" :key="c.id" class="chip" :class="{ on: selected.id === c.id }" @click="selected = c">{{ c.name }}</button>
    </div>

    <div class="section-head"><span>名称</span></div>
    <div class="card"><input v-model="title" class="field" placeholder="例如：周五作业" maxlength="30" /></div>

    <div class="section-head"><span>截止时间</span></div>
    <div class="card row">
      <input v-model="dueAt" type="date" class="field" />
      <button v-if="dueAt" class="link" @click="dueAt = ''">清除</button>
    </div>

    <div class="section-head"><span>本次题目</span><span class="note" v-if="cart.length">{{ cart.length }} 道</span></div>
    <div v-for="q in cart" :key="q.id" class="card">
      <b>{{ q.index }}. {{ q.content }}</b>
      <span class="meta">{{ q.sourceLabel }} · {{ q.category }}</span>
    </div>
    <div v-if="!cart.length" class="empty">还没有试卷题目<span class="go" @click="$router.push('/teacher/paper')">去组卷页组建试卷</span></div>
    <div v-if="cart.length" class="footer">
      <button class="primary" :disabled="saving" @click="submit">{{ saving ? '发送中…' : '发给班级' }}</button>
    </div>
  </div>
</template>

<script>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import teacherAPI from '../../api/teacher'
import { setSelectedClassId, shortText } from '../../utils/teacherClass'

export default {
  name: 'TeacherSend',
  setup() {
    const route = useRoute()
    const router = useRouter()
    const classes = ref([])
    const selected = ref({})
    const title = ref('')
    const dueAt = ref('')
    const cart = ref([])
    const saving = ref(false)
    const paperId = String(route.query.paperId || '')
    const fail = (e) => showToast({ type: 'fail', message: e.response?.data?.message || '发送失败' })

    const boot = async () => {
      const res = await teacherAPI.dashboard()
      classes.value = (res.data && res.data.classes) || []
      const want = Number(route.query.classId || 0)
      selected.value = classes.value.find((c) => c.id === want) || classes.value[0] || {}
      if (!paperId) return
      const r = await teacherAPI.paper(paperId)
      const d = r.data || {}
      if (d.title && !title.value) title.value = d.title
      cart.value = (d.questions || []).map((q, i) => ({
        id: q.id,
        index: i + 1,
        content: shortText(q.content, 60),
        category: q.category || '未分类',
        sourceLabel: q.source === 'teacher_bank' ? '题库' : '错题'
      }))
    }

    const submit = async () => {
      if (!selected.value.id) return showToast('请先选择班级')
      if (!paperId) return showToast('请打开一份试卷再发给班级')
      const name = title.value.trim() || '班级作业'
      saving.value = true
      try {
        await teacherAPI.createHomework({ classId: selected.value.id, title: name, paperId, dueAt: dueAt.value })
        setSelectedClassId(selected.value.id)
        showToast({ type: 'success', message: '作业已发给班级' })
        router.replace('/teacher/homework')
      } catch (e) { fail(e) }
      finally { saving.value = false }
    }

    onMounted(() => boot().catch(fail))
    return { classes, selected, title, dueAt, cart, saving, submit }
  }
}
</script>

<style scoped>
.page { min-height: 100vh; padding-bottom: 32px; background: #eef3fb; }
.hero { margin: 12px 16px; background: linear-gradient(135deg, #2459ff, #52b7ff); border-radius: 20px; padding: 18px; color: #fff; }
.kicker { font-size: 12px; opacity: 0.85; }
.hero h1 { margin: 4px 0 6px; font-size: 22px; }
.hero p { margin: 0; font-size: 13px; opacity: 0.88; }
.section-head { display: flex; justify-content: space-between; margin: 16px 16px 8px; font-weight: 800; }
.note { font-weight: 500; color: rgba(11,22,51,0.45); }
.chips { display: flex; gap: 8px; flex-wrap: wrap; padding: 0 16px; }
.chip { border: none; background: #fff; border-radius: 999px; padding: 6px 12px; font-weight: 700; }
.chip.on { background: linear-gradient(135deg,#2459ff,#52b7ff); color: #fff; }
.hint { margin: 8px 16px; font-size: 12px; color: rgba(11,22,51,0.5); }
.card { background: #fff; margin: 0 16px 8px; padding: 14px; border-radius: 16px; border: 1px solid rgba(11,22,51,0.06); }
.card.row { display: flex; align-items: center; gap: 8px; }
.field { width: 100%; height: 40px; border: none; background: transparent; }
.meta { display: block; margin-top: 4px; font-size: 12px; color: rgba(11,22,51,0.5); }
.link { border: none; background: none; color: #2459ff; font-weight: 700; }
.empty { text-align: center; padding: 24px; color: rgba(11,22,51,0.45); }
.go { display: block; margin-top: 8px; color: #2459ff; font-weight: 700; }
.footer { padding: 16px; }
.primary { width: 100%; height: 44px; border: none; border-radius: 999px; color: #fff; font-weight: 700; background: linear-gradient(135deg,#2459ff,#52b7ff); }
</style>
