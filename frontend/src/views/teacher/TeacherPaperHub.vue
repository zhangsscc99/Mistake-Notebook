<template>
  <div class="page">
    <div class="hero">
      <div class="kicker">PAPER</div>
      <h1>班级组卷</h1>
      <p>从题目里勾选生成试卷。打开后再发给任意班级。</p>
      <div class="hero-stats">
        <div class="hero-stat"><b>{{ papers.length }}</b><span>试卷数</span></div>
        <div class="hero-stat"><b>{{ totalQuestionCount }}</b><span>总题数</span></div>
      </div>
    </div>
    <button class="create" @click="createNewPaper">＋ 组建新卷</button>

    <div v-if="papers.length" class="section-head"><span class="section-title">我的试卷</span></div>
    <div v-for="p in papers" :key="p.id" class="paper" @click="goSet(p.id)">
      <div class="accent"></div>
      <div class="body">
        <div class="row">
          <div class="icon">卷</div>
          <div class="info">
            <b>{{ p.title }}</b>
            <span>{{ p.questionCount }} 道题 · {{ fmt(p.createdAt) }}</span>
          </div>
          <em>›</em>
        </div>
        <div class="badges">
          <i>{{ p.questionCount }} 题</i>
          <i>仅老师可见</i>
        </div>
      </div>
    </div>
    <div v-if="!papers.length" class="empty">
      还没有试卷
      <span>从题目里选题组成试卷，打开后再发给任意班级</span>
      <button class="create slim" @click="createNewPaper">立即组建新卷</button>
    </div>
    <TeacherTabBar />
  </div>
</template>

<script>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import teacherAPI from '../../api/teacher'
import TeacherTabBar from '../../components/TeacherTabBar.vue'
import { fmtDay } from '../../utils/teacherClass'

export default {
  name: 'TeacherPaperHub',
  components: { TeacherTabBar },
  setup() {
    const router = useRouter()
    const papers = ref([])
    const fail = (e) => showToast({ type: 'fail', message: e.response?.data?.message || '加载失败' })
    const fmt = fmtDay
    const totalQuestionCount = computed(() => papers.value.reduce((sum, p) => sum + (p.questionCount || 0), 0))

    const reload = async () => {
      const p = await teacherAPI.papers()
      papers.value = p.data || []
    }

    const boot = async () => {
      await reload()
    }

    const createNewPaper = () => {
      router.push({ path: '/teacher/questions', query: { pick: 1, from: 'paper' } })
    }
    const goSet = (id) => router.push(`/teacher/sets/paper/${id}`)

    onMounted(() => boot().catch(fail))
    return { papers, totalQuestionCount, fmt, createNewPaper, goSet }
  }
}
</script>

<style scoped>
.page { min-height: 100vh; padding: 20px 16px 90px; background: #eef3fb; }
.hero { background: linear-gradient(135deg, #2459ff, #52b7ff); border-radius: 20px; padding: 18px; color: #fff; margin-bottom: 12px; }
.kicker { font-size: 12px; opacity: 0.85; }
.hero h1 { margin: 4px 0 6px; font-size: 22px; }
.hero p { margin: 0; font-size: 13px; opacity: 0.88; }
.hero-stats { margin-top: 14px; display: flex; background: rgba(255,255,255,0.18); border-radius: 14px; }
.hero-stat { flex: 1; text-align: center; padding: 10px 0; }
.hero-stat b { display: block; font-size: 18px; }
.hero-stat span { font-size: 11px; }
.chips { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
.chip { border: none; background: #fff; border-radius: 999px; padding: 6px 12px; font-weight: 700; }
.chip.on { background: linear-gradient(135deg,#2459ff,#52b7ff); color: #fff; }
.create {
  width: 100%; height: 44px; border: none; border-radius: 14px; color: #fff; font-weight: 800;
  background: linear-gradient(135deg,#2459ff,#52b7ff); box-shadow: 0 10px 24px rgba(31,91,255,0.30); margin-bottom: 12px;
}
.create.slim { width: auto; padding: 0 22px; margin-top: 16px; }
.section-head { display: flex; justify-content: space-between; margin: 16px 2px 8px; }
.section-title { font-weight: 800; }
.paper { display: flex; background: #fff; border-radius: 16px; margin-bottom: 10px; border: 1px solid rgba(11,22,51,0.06); overflow: hidden; cursor: pointer; }
.accent { width: 5px; background: linear-gradient(180deg, #2459ff, #52b7ff); }
.body { flex: 1; padding: 14px; }
.row { display: flex; align-items: center; gap: 10px; }
.icon { width: 40px; height: 40px; border-radius: 12px; background: linear-gradient(135deg,#2459ff,#52b7ff); color: #fff; font-weight: 800; display: flex; align-items: center; justify-content: center; }
.info { flex: 1; min-width: 0; }
.info b { display: block; }
.info span { display: block; margin-top: 3px; font-size: 12px; color: rgba(11,22,51,0.5); }
.row em { font-style: normal; color: rgba(11,22,51,0.28); }
.badges { display: flex; gap: 8px; margin-top: 10px; }
.badges i { font-style: normal; font-size: 11px; font-weight: 700; color: #2459ff; background: rgba(36,89,255,0.08); border-radius: 999px; padding: 3px 10px; }
.empty { text-align: center; padding: 36px 8px; color: rgba(11,22,51,0.45); font-size: 15px; font-weight: 700; }
.empty span { display: block; margin-top: 8px; font-size: 13px; font-weight: 500; }
</style>
