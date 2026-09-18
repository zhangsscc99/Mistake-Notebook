<template>
  <div class="page">
    <van-nav-bar :title="isPaper ? '试卷' : '练习'" left-arrow @click-left="$router.back()" fixed placeholder />
    <div class="hero">
      <div class="kicker">{{ kindLabel }}</div>
      <h1>{{ title }}</h1>
      <p>{{ meta }}</p>
    </div>
    <div v-if="loading" class="empty">加载题目…</div>
    <div v-for="q in questions" :key="q.id || q.index" class="card">
      <div class="idx">第 {{ q.index }} 题</div>
      <div class="content">{{ q.content }}</div>
      <div class="q-meta" v-if="q.category || q.nickName">
        <span class="badge" v-if="q.category">{{ q.category }}</span>
        <span class="badge" v-if="q.nickName">{{ q.nickName }}</span>
      </div>
    </div>
    <div v-if="!loading && !questions.length" class="empty">这份试卷里没有可显示的题目<span>题目可能已被删除</span></div>
    <div v-if="!loading && isPaper" class="footer">
      <button v-if="questions.length" class="primary" @click="sendToClass">发给班级</button>
      <button v-if="questions.length" class="ghost" @click="addMore">继续加题</button>
      <button class="danger" @click="recall">删除试卷</button>
    </div>
    <div v-if="!loading && !isPaper" class="footer">
      <button class="danger" @click="recall">撤回练习</button>
    </div>
  </div>
</template>

<script>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showConfirmDialog, showToast } from 'vant'
import teacherAPI from '../../api/teacher'
import { fmtDay } from '../../utils/teacherClass'

export default {
  name: 'TeacherSetDetail',
  setup() {
    const route = useRoute()
    const router = useRouter()
    const loading = ref(true)
    const title = ref('')
    const classId = ref('')
    const meta = ref('')
    const questions = ref([])
    const isPaper = computed(() => route.params.type !== 'notebook')
    const kindLabel = computed(() => isPaper.value ? '仅老师可见的试卷' : '已发给学生的练习')

    const load = async () => {
      const id = route.params.id
      const type = isPaper.value ? 'paper' : 'notebook'
      if (!id) {
        loading.value = false
        title.value = '未找到'
        return
      }
      loading.value = true
      try {
        const res = type === 'notebook' ? await teacherAPI.classNotebook(id) : await teacherAPI.paper(id)
        const d = res.data || {}
        const rows = (d.questions || []).map((q, i) => ({ ...q, index: i + 1 }))
        classId.value = d.classId || ''
        title.value = d.title || (type === 'notebook' ? '班级练习' : '试卷')
        questions.value = rows
        meta.value = `${rows.length} 道题 · ${fmtDay(d.createdAt) || ''}`
      } catch (e) {
        title.value = '加载失败'
        showToast({ type: 'fail', message: e.response?.data?.message || '加载失败' })
      } finally {
        loading.value = false
      }
    }

    const sendToClass = () => {
      if (!questions.value.length) return showToast('试卷里没有题目')
      router.push({ path: '/teacher/send', query: { paperId: route.params.id } })
    }
    const addMore = () => {
      router.push({
        path: '/teacher/questions',
        query: { pick: 1, paperId: route.params.id, classId: classId.value }
      })
    }

    const recall = async () => {
      const paper = isPaper.value
      try {
        await showConfirmDialog({
          title: paper ? '删除试卷' : '撤回练习',
          message: paper ? '删除后学生本来也看不见。只是从试卷列表拿掉。' : '撤回后学生在「我的班级」将看不到这份练习。',
          confirmButtonText: paper ? '删除' : '撤回',
          confirmButtonColor: '#e11d48'
        })
        if (paper) await teacherAPI.recallPaper(route.params.id)
        else await teacherAPI.recallNotebook(route.params.id)
        showToast({ type: 'success', message: paper ? '已删除' : '已撤回' })
        setTimeout(() => router.back(), 400)
      } catch (e) {
        if (e !== 'cancel') showToast({ type: 'fail', message: e.response?.data?.message || '操作失败' })
      }
    }

    onMounted(load)
    return { loading, title, meta, questions, isPaper, kindLabel, sendToClass, addMore, recall }
  }
}
</script>

<style scoped>
.page { min-height: 100vh; padding-bottom: 40px; background: #eef3fb; }
.hero { margin: 12px 16px; background: linear-gradient(135deg, #2459ff, #52b7ff); border-radius: 20px; padding: 18px; color: #fff; }
.kicker { font-size: 12px; opacity: 0.85; }
.hero h1 { margin: 4px 0 6px; font-size: 22px; }
.hero p { margin: 0; font-size: 13px; opacity: 0.88; }
.card {
  background: #fff; margin: 8px 16px; padding: 14px; border-radius: 16px;
  border: 1px solid rgba(11,22,51,0.06);
}
.idx { font-size: 12px; font-weight: 800; color: #2459ff; }
.content { margin-top: 8px; font-size: 14px; line-height: 1.55; color: #0b1633; white-space: pre-wrap; }
.q-meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.badge { font-size: 11px; background: #f4f7fb; color: rgba(11,22,51,0.55); border-radius: 999px; padding: 2px 8px; }
.empty { text-align: center; padding: 28px 16px; color: rgba(11,22,51,0.45); }
.empty span { display: block; margin-top: 6px; font-size: 12px; }
.footer { margin: 16px; display: flex; flex-direction: column; gap: 10px; }
.primary {
  border: none; border-radius: 14px; height: 44px; color: #fff; font-weight: 800;
  background: linear-gradient(135deg,#2459ff,#52b7ff); box-shadow: 0 10px 24px rgba(31,91,255,0.30);
}
.ghost {
  border: none; border-radius: 14px; height: 44px; color: #2459ff; font-weight: 800;
  background: #fff; box-shadow: inset 0 0 0 2px rgba(36,89,255,0.30);
}
.danger { border: none; background: none; color: #e11d48; font-weight: 800; height: 40px; }
</style>
