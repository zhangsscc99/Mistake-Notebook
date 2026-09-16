<template>
  <div class="page">
    <van-nav-bar :title="nb.title || '班级错题本'" left-arrow @click-left="$router.back()" fixed placeholder />

    <div v-if="!questions.length" class="empty">这本错题本还没有题目。</div>

    <template v-else>
      <div class="progress-bar">
        <span>第 {{ index + 1 }} / {{ questions.length }} 题</span>
        <div class="track"><i :style="{ width: ((index + 1) / questions.length) * 100 + '%' }"></i></div>
      </div>

      <div class="card">
        <div class="q-meta">
          <span v-if="current.tag" class="tag">{{ current.tag }}</span>
          <span v-if="current.category" class="tag">{{ current.category }}</span>
        </div>
        <p class="q-content">{{ current.content }}</p>

        <button v-if="!revealed" class="primary" @click="reveal">显示答案</button>
        <div v-else class="answer">
          <b>答案</b>
          <p>{{ current.answer || '暂无' }}</p>
          <b>解析</b>
          <p>{{ current.analysis || '暂无' }}</p>
        </div>
      </div>

      <div v-if="revealed" class="judge">
        <button class="ghost" @click="next(false)">还不会</button>
        <button class="primary slim" @click="next(true)">我会了</button>
      </div>

      <div v-if="finished" class="card done">
        <b>练完啦</b>
        <p>本次练习 {{ questions.length }} 题，标记「我会了」{{ masteredCount }} 题。</p>
        <button class="primary" @click="$router.push('/class-notebooks')">返回列表</button>
      </div>
    </template>
  </div>
</template>

<script>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { showToast } from 'vant'
import classroomAPI from '../api/classroom'

export default {
  name: 'ClassNotebookPractice',
  setup() {
    const route = useRoute()
    const nb = ref({})
    const questions = ref([])
    const index = ref(0)
    const revealed = ref(false)
    const masteredCount = ref(0)
    const finished = ref(false)

    const current = computed(() => questions.value[index.value] || {})

    const load = async () => {
      const res = await classroomAPI.notebook(route.params.id)
      const d = res.data || {}
      nb.value = d
      questions.value = d.questions || []
      masteredCount.value = d.masteredCount || 0
      index.value = Math.min(d.doneCount || 0, Math.max(0, questions.value.length - 1))
    }

    const reveal = () => { revealed.value = true }

    const next = async (mastered) => {
      if (mastered) masteredCount.value += 1
      const done = index.value + 1
      try {
        await classroomAPI.saveProgress(route.params.id, done, masteredCount.value)
      } catch { /* 进度失败不阻断练习 */ }
      if (done >= questions.value.length) {
        finished.value = true
        showToast({ type: 'success', message: '本次练习完成' })
        return
      }
      index.value = done
      revealed.value = false
    }

    onMounted(() => load().catch((e) => showToast({ type: 'fail', message: e.response?.data?.message || '加载失败' })))
    return { nb, questions, index, revealed, current, masteredCount, finished, reveal, next }
  }
}
</script>

<style scoped>
.page { min-height: 100vh; padding-bottom: 40px; background: #eef3fb; }
.progress-bar { margin: 12px 16px 0; font-size: 12px; color: rgba(11,22,51,0.55); }
.track { height: 6px; background: #fff; border-radius: 99px; overflow: hidden; margin-top: 6px; }
.track i { display: block; height: 100%; background: linear-gradient(90deg,#2459ff,#52b7ff); }
.card { background: #fff; margin: 12px 16px; padding: 18px; border-radius: 16px; border: 1px solid rgba(11,22,51,0.06); }
.q-meta { display: flex; gap: 8px; font-size: 12px; color: rgba(11,22,51,0.5); }
.tag { background: #f4f7fb; border-radius: 999px; padding: 3px 10px; }
.q-content { margin: 12px 0 16px; font-size: 16px; line-height: 1.7; white-space: pre-wrap; color: #0b1633; }
.answer { background: #f9fbff; border-radius: 12px; padding: 12px; font-size: 14px; }
.answer p { margin: 4px 0 10px; white-space: pre-wrap; line-height: 1.65; }
.primary { width: 100%; height: 44px; border: none; border-radius: 999px; color: #fff; font-weight: 700; background: linear-gradient(135deg,#2459ff,#52b7ff); }
.primary.slim { width: auto; padding: 0 22px; height: 42px; }
.judge { display: flex; gap: 10px; justify-content: space-between; margin: 0 16px; }
.ghost { border: none; background: #fff; color: #e11d48; border-radius: 999px; padding: 0 22px; height: 42px; font-weight: 700; border: 1px solid rgba(225,29,72,0.25); }
.done { text-align: center; }
.done b { font-size: 18px; }
.done p { margin: 8px 0 14px; font-size: 13px; color: rgba(11,22,51,0.6); }
.empty { padding: 40px 24px; text-align: center; color: rgba(11,22,51,0.5); font-size: 13px; }
</style>
