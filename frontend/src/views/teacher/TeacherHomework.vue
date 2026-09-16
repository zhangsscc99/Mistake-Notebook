<template>
  <div class="page">
    <van-nav-bar title="作业布置与批改" left-arrow @click-left="$router.push('/teacher')" fixed placeholder>
      <template #right>
        <span class="nav-action" @click="openBuilder">布置</span>
      </template>
    </van-nav-bar>

    <div v-if="!list.length" class="empty">还没有布置作业。点右上角「布置」新建一份。</div>

    <div v-for="hw in list" :key="hw.id" class="card">
      <div class="hw-head">
        <b>{{ hw.title }}</b>
        <span v-if="hw.gradedCount < hw.submittedCount" class="pill hot">{{ hw.submittedCount - hw.gradedCount }} 待批改</span>
      </div>
      <p v-if="hw.description" class="desc">{{ hw.description }}</p>
      <div class="meta">
        {{ hw.questionCount }} 题 · 提交 {{ hw.submittedCount }}/{{ hw.targetCount }} · 已批改 {{ hw.gradedCount }}
        <span v-if="hw.dueAt"> · 截止 {{ fmt(hw.dueAt) }}</span>
      </div>
      <div class="actions">
        <button class="ghost" @click="$router.push('/teacher/homework/' + hw.id)">查看与批改</button>
        <button class="del" @click="remove(hw)">删除</button>
      </div>
    </div>

    <van-popup v-model:show="showBuilder" position="bottom" round :style="{ height: '90%' }">
      <div class="builder">
        <div class="builder-head">
          <b>布置作业</b>
          <van-icon name="cross" @click="showBuilder = false" />
        </div>
        <input v-model="form.title" class="input" placeholder="作业标题" />
        <input v-model="form.description" class="input" placeholder="作业说明（可选）" />
        <label class="field">截止日期<input v-model="form.dueAt" type="date" /></label>

        <div class="sub-head">
          <span>指定学生（不选 = 全部名下学生）</span>
        </div>
        <div class="chips">
          <button
            v-for="s in students"
            :key="s.id"
            class="chip"
            :class="{ on: form.studentIds.includes(s.id) }"
            @click="toggleStudent(s.id)"
          >{{ s.nickName }}</button>
        </div>

        <div class="sub-head">
          <span>题目</span>
          <button class="link" @click="addQuestion">+ 加一题</button>
        </div>
        <div v-for="(q, i) in form.questions" :key="i" class="q-edit">
          <div class="q-edit-head">
            <b>第 {{ i + 1 }} 题</b>
            <input v-model.number="q.score" type="number" min="1" class="score" /> 分
            <button class="del" @click="form.questions.splice(i, 1)">移除</button>
          </div>
          <textarea v-model="q.content" placeholder="题目内容"></textarea>
          <input v-model="q.answer" class="input" placeholder="参考答案（批改时用）" />
        </div>

        <button class="primary" :disabled="saving" @click="save">{{ saving ? '布置中…' : '布置作业' }}</button>
      </div>
    </van-popup>

    <TeacherTabBar />
  </div>
</template>

<script>
import { onMounted, reactive, ref } from 'vue'
import { showConfirmDialog, showToast } from 'vant'
import teacherAPI from '../../api/teacher'
import TeacherTabBar from '../../components/TeacherTabBar.vue'

export default {
  name: 'TeacherHomework',
  components: { TeacherTabBar },
  setup() {
    const list = ref([])
    const students = ref([])
    const showBuilder = ref(false)
    const saving = ref(false)
    const form = reactive({ title: '', description: '', dueAt: '', studentIds: [], questions: [] })

    const fail = (e) => showToast({ type: 'fail', message: e.response?.data?.message || '操作失败' })

    const load = async () => {
      const res = await teacherAPI.homework()
      list.value = res.data || []
    }
    const openBuilder = async () => {
      showBuilder.value = true
      if (!form.questions.length) addQuestion()
      if (!students.value.length) {
        try {
          const res = await teacherAPI.students()
          students.value = res.data || []
        } catch (e) { fail(e) }
      }
    }
    const addQuestion = () => form.questions.push({ content: '', answer: '', score: 10 })
    const toggleStudent = (id) => {
      const i = form.studentIds.indexOf(id)
      if (i >= 0) form.studentIds.splice(i, 1)
      else form.studentIds.push(id)
    }
    const save = async () => {
      if (!form.title.trim()) {
        showToast('请填写标题')
        return
      }
      const questions = form.questions.filter((q) => q.content.trim())
      if (!questions.length) {
        showToast('至少写一道题')
        return
      }
      saving.value = true
      try {
        await teacherAPI.createHomework({
          title: form.title.trim(),
          description: form.description.trim(),
          dueAt: form.dueAt || '',
          studentIds: form.studentIds,
          questions
        })
        showBuilder.value = false
        form.title = ''
        form.description = ''
        form.dueAt = ''
        form.studentIds = []
        form.questions = []
        await load()
        showToast({ type: 'success', message: '已布置，学生会收到通知' })
      } catch (e) {
        fail(e)
      } finally {
        saving.value = false
      }
    }
    const remove = async (hw) => {
      await showConfirmDialog({ title: '删除作业', message: `删除「${hw.title}」？` })
      await teacherAPI.deleteHomework(hw.id)
      await load()
    }
    const fmt = (t) => (t ? String(t).replace('T', ' ').slice(0, 16) : '')

    onMounted(() => load().catch(fail))
    return { list, students, showBuilder, saving, form, openBuilder, addQuestion, toggleStudent, save, remove, fmt }
  }
}
</script>

<style scoped>
.page { min-height: 100vh; padding-bottom: 90px; background: #eef3fb; }
.nav-action { color: #2459ff; font-weight: 700; font-size: 14px; }
.card { background: #fff; margin: 12px 16px; padding: 16px; border-radius: 16px; border: 1px solid rgba(11,22,51,0.06); }
.hw-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.hw-head b { font-size: 15px; color: #0b1633; }
.pill { font-size: 11px; padding: 3px 10px; border-radius: 999px; background: #f4f7fb; color: rgba(11,22,51,0.5); white-space: nowrap; }
.pill.hot { background: rgba(225,29,72,0.12); color: #e11d48; }
.desc { margin: 8px 0 0; font-size: 13px; color: rgba(11,22,51,0.6); }
.meta { margin-top: 8px; font-size: 12px; color: rgba(11,22,51,0.5); }
.actions { display: flex; gap: 8px; align-items: center; margin-top: 12px; }
.ghost { border: none; background: #eef3fb; color: #2459ff; border-radius: 999px; padding: 8px 14px; font-weight: 700; }
.del { border: none; background: none; color: #e11d48; font-weight: 700; margin-left: auto; }
.primary { width: 100%; height: 44px; border: none; border-radius: 999px; color: #fff; font-weight: 700; background: linear-gradient(135deg,#2459ff,#52b7ff); margin-top: 8px; }
.empty { padding: 32px 24px; text-align: center; color: rgba(11,22,51,0.5); font-size: 13px; }
.builder { padding: 16px; height: 100%; overflow-y: auto; }
.builder-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.builder-head b { font-size: 17px; }
.input { width: 100%; height: 42px; border: none; background: #f4f7fb; border-radius: 12px; padding: 0 12px; margin-bottom: 10px; }
.field { display: flex; align-items: center; justify-content: space-between; font-size: 13px; color: rgba(11,22,51,0.6); margin-bottom: 10px; }
.field input { height: 38px; border: none; background: #f4f7fb; border-radius: 10px; padding: 0 10px; }
.sub-head { display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: rgba(11,22,51,0.5); margin: 14px 0 8px; }
.link { border: none; background: none; color: #2459ff; font-weight: 700; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chip { border: none; background: #f4f7fb; color: rgba(11,22,51,0.7); border-radius: 999px; padding: 6px 12px; font-size: 13px; }
.chip.on { background: linear-gradient(135deg,#2459ff,#52b7ff); color: #fff; }
.q-edit { background: #f9fbff; border-radius: 12px; padding: 12px; margin-bottom: 10px; }
.q-edit-head { display: flex; align-items: center; gap: 6px; font-size: 13px; margin-bottom: 8px; }
.q-edit-head b { flex-shrink: 0; }
.score { width: 56px; height: 32px; border: none; background: #fff; border-radius: 8px; padding: 0 8px; text-align: center; }
.q-edit textarea { width: 100%; height: 72px; border: none; background: #fff; border-radius: 10px; padding: 10px; resize: none; margin-bottom: 8px; }
</style>
