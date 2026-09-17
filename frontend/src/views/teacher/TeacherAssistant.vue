<template>
  <div class="page">
    <div class="chips">
      <button v-for="c in classes" :key="c.id" class="chip" :class="{ on: selected.id === c.id }" @click="selectClass(c)">{{ c.name }}</button>
    </div>
    <p class="hint">面向老师：基于当前班级错题统计，帮你看高频、薄弱学科和组卷建议。不会像学生端那样讲题答疑。</p>
    <div class="chat" ref="scroller">
      <div v-for="m in messages" :key="m.id" class="row" :class="{ user: m.role === 'user' }">
        <div class="bubble" :class="m.role">{{ m.content }}</div>
      </div>
      <div v-if="messages.length === 1 && !sending" class="suggest">
        <button v-for="s in suggestions" :key="s" class="chip" @click="useSuggestion(s)">{{ s }}</button>
      </div>
    </div>
    <div class="composer">
      <input v-model="input" placeholder="问班级学情，例如：这周该练什么" @keyup.enter="send" />
      <button class="primary slim" :disabled="sending || !input.trim()" @click="send">发送</button>
    </div>
    <TeacherTabBar />
  </div>
</template>

<script>
import { nextTick, onMounted, ref } from 'vue'
import { showToast } from 'vant'
import teacherAPI from '../../api/teacher'
import TeacherTabBar from '../../components/TeacherTabBar.vue'
import { getSelectedClassId, setSelectedClassId } from '../../utils/teacherClass'

const SUGGESTIONS = ['这班高频错题是哪些？', '哪个学科最薄弱？', '建议组一套针对性练习', '哪些学生错题比较多？']

function greeting(cls, stats) {
  if (!cls || !cls.id) {
    return '你好老师，我是班级教学助手，不是学生答疑。先去「班级」建班并把加入码发给学生，他们在学生端录入错题后，我就能帮你看高频错题、薄弱学科，并建议组卷后发给班级。'
  }
  const name = cls.name || '当前班级'
  const total = (stats && stats.total) || 0
  const hot = ((stats && stats.hot) || [])[0]
  if (!total) return `你好老师，现在看的是「${name}」。班里还没有可统计的错题。等学生在学生端录入后，再问我高频错题或组卷建议。`
  const hotHint = hot ? `目前最高频的是「${String(hot.content || '').slice(0, 24)}」（${hot.count} 次 / ${hot.studentCount} 人）。` : ''
  return `你好老师，现在看的是「${name}」，共 ${total} 道班级错题。${hotHint}问我高频错题、薄弱学科，或让我帮你决定组哪些练习。`
}

export default {
  name: 'TeacherAssistant',
  components: { TeacherTabBar },
  setup() {
    const classes = ref([])
    const selected = ref({})
    const messages = ref([])
    const suggestions = SUGGESTIONS
    const input = ref('')
    const sending = ref(false)
    const scroller = ref(null)
    const nextId = ref(1)
    const fail = (e) => showToast({ type: 'fail', message: e.response?.data?.message || '发送失败' })

    const reset = async () => {
      let stats = { total: 0, hot: [] }
      if (selected.value.id) {
        const st = await teacherAPI.classStats(selected.value.id)
        stats = st.data || stats
      }
      messages.value = [{ id: 0, role: 'assistant', content: greeting(selected.value, stats) }]
      nextId.value = 1
    }

    const boot = async () => {
      const res = await teacherAPI.dashboard()
      classes.value = (res.data && res.data.classes) || []
      const want = getSelectedClassId()
      selected.value = classes.value.find((c) => c.id === want) || classes.value[0] || {}
      if (selected.value.id) setSelectedClassId(selected.value.id)
      await reset()
    }

    const selectClass = async (c) => {
      if (c.id === selected.value.id) return
      selected.value = c
      setSelectedClassId(c.id)
      await reset()
    }

    const useSuggestion = (s) => {
      input.value = s
      send()
    }

    const send = async () => {
      const text = input.value.trim()
      if (!text || sending.value) return
      const id = nextId.value++
      messages.value.push({ id, role: 'user', content: text })
      input.value = ''
      sending.value = true
      await nextTick()
      if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight
      try {
        const payload = {
          classId: selected.value.id,
          messages: messages.value.filter((m) => m.id !== 0).map((m) => ({ role: m.role, content: m.content }))
        }
        const res = await teacherAPI.chat(payload)
        messages.value.push({ id: nextId.value++, role: 'assistant', content: (res.data && res.data.reply) || '暂时无法回答' })
      } catch (e) { fail(e) }
      finally {
        sending.value = false
        await nextTick()
        if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight
      }
    }

    onMounted(() => boot().catch(fail))
    return { classes, selected, messages, suggestions, input, sending, scroller, selectClass, useSuggestion, send }
  }
}
</script>

<style scoped>
.page { height: 100vh; display: flex; flex-direction: column; background: #eef3fb; padding-bottom: 56px; }
.chips { display: flex; gap: 8px; overflow-x: auto; padding: 12px 16px 0; }
.chip { border: none; background: #fff; border-radius: 999px; padding: 6px 12px; font-weight: 700; white-space: nowrap; }
.chip.on { background: linear-gradient(135deg,#2459ff,#52b7ff); color: #fff; }
.hint { margin: 8px 16px 0; font-size: 12px; color: rgba(11,22,51,0.5); line-height: 1.5; }
.chat { flex: 1; overflow-y: auto; padding: 12px 16px 16px; }
.row { display: flex; margin-bottom: 10px; }
.row.user { justify-content: flex-end; }
.bubble { max-width: 82%; padding: 10px 12px; border-radius: 14px; background: #fff; font-size: 14px; line-height: 1.6; white-space: pre-wrap; }
.bubble.user { background: linear-gradient(135deg,#2459ff,#52b7ff); color: #fff; }
.suggest { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.composer { display: flex; gap: 8px; padding: 10px 16px calc(10px + env(safe-area-inset-bottom)); background: #fff; border-top: 1px solid rgba(11,22,51,0.06); }
.composer input { flex: 1; height: 40px; border: none; background: #f4f7fb; border-radius: 999px; padding: 0 14px; min-width: 0; }
.primary.slim { border: none; border-radius: 999px; padding: 0 16px; height: 40px; color: #fff; font-weight: 700; background: linear-gradient(135deg,#2459ff,#52b7ff); }
</style>
