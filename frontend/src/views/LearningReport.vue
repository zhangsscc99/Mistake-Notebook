<template>
  <div class="page">
    <van-nav-bar title="个性化学习报告" left-arrow @click-left="$router.back()" fixed placeholder />

    <div class="hero">
      <div class="kicker">根据全部数据</div>
      <h1>学习总览</h1>
      <p>{{ overview.stage ? overview.stage + ' · ' : '' }}不选题，直接看整本错题本</p>
    </div>

    <div class="card stats">
      <div class="stat"><b>{{ overview.questionCount || 0 }}</b><span>错题</span></div>
      <div class="stat"><b>{{ overview.categoryCount || 0 }}</b><span>分类</span></div>
      <div class="stat"><b>{{ overview.checkinStreak || 0 }}</b><span>连续打卡</span></div>
      <div class="stat"><b>{{ overview.checkinTotalDays || 0 }}</b><span>累计打卡</span></div>
    </div>

    <div v-if="overview.categories?.length" class="card">
      <h3>分类分布</h3>
      <div v-for="c in overview.categories" :key="c.name" class="dist">
        <span class="dist-name">{{ c.name }}</span>
        <div class="track"><i :style="{ width: c.pct + '%' }"></i></div>
        <span class="dist-num">{{ c.count }}</span>
      </div>
    </div>

    <div v-if="overview.questionCount" class="card">
      <h3>难度结构</h3>
      <div class="diff-row">
        <div class="diff easy"><b>{{ overview.easy || 0 }}</b><span>简单 {{ overview.easyPct || 0 }}%</span></div>
        <div class="diff medium"><b>{{ overview.medium || 0 }}</b><span>中等 {{ overview.mediumPct || 0 }}%</span></div>
        <div class="diff hard"><b>{{ overview.hard || 0 }}</b><span>较难 {{ overview.hardPct || 0 }}%</span></div>
      </div>
    </div>

    <div class="card">
      <h3>学习习惯</h3>
      <div class="habit">
        <div><b>{{ overview.paperCount || 0 }}</b><span>组卷</span></div>
        <div><b>{{ overview.noteCount || 0 }}</b><span>笔记</span></div>
        <div><b>{{ overview.favoriteCount || 0 }}</b><span>收藏</span></div>
        <div><b>{{ overview.masteredCount || 0 }}</b><span>已掌握</span></div>
      </div>
    </div>

    <div class="card">
      <button class="primary" :disabled="loading || !overview.canGenerate" @click="generate">
        {{ loading ? '生成中…' : '根据全部数据生成报告' }}
      </button>
      <p class="hint" v-if="overview.canGenerate">约 10–20 秒，生成后会保存，可随时回看</p>
      <p class="hint" v-else>收录 1 道错题即可生成。当前还没有错题。</p>
    </div>

    <h2 v-if="list.length" class="hist">历史报告</h2>
    <div v-for="item in list" :key="item.id" class="item">
      <div class="item-main" @click="$router.push('/learning-report/' + item.id)">
        <b>{{ item.title }}</b>
        <span>{{ item.overview }}</span>
      </div>
      <button class="del" @click.stop="remove(item)">删除</button>
    </div>
  </div>
</template>
<script>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showConfirmDialog, showToast } from 'vant'
import studyAPI from '../api/study'

function decorate(raw) {
  const o = raw || {}
  const cats = Array.isArray(o.categories) ? o.categories.slice() : []
  const d = o.difficulties || {}
  const total = o.questionCount || 0
  const pct = (n) => (total ? Math.round((Number(n) || 0) * 100 / total) : 0)
  return {
    ...o,
    categories: cats,
    easy: d.EASY || 0,
    medium: d.MEDIUM || 0,
    hard: d.HARD || 0,
    easyPct: pct(d.EASY),
    mediumPct: pct(d.MEDIUM),
    hardPct: pct(d.HARD),
    canGenerate: !!o.canGenerate
  }
}

export default {
  name: 'LearningReportHub',
  setup() {
    const router = useRouter()
    const list = ref([])
    const overview = ref(decorate({}))
    const loading = ref(false)
    const load = async () => {
      const [ov, reports] = await Promise.all([
        studyAPI.getOverview(),
        studyAPI.listLearningReports()
      ])
      overview.value = decorate(ov.data || {})
      list.value = reports.data || []
    }
    const generate = async () => {
      loading.value = true
      try {
        const res = await studyAPI.generateLearningReport()
        showToast({ type: 'success', message: '已生成' })
        router.push('/learning-report/' + res.data.id)
      } catch (e) {
        showToast({ type: 'fail', message: e.response?.data?.message || '生成失败' })
      } finally { loading.value = false }
    }
    const remove = async (item) => {
      await showConfirmDialog({ title: '删除报告', message: '删除后无法恢复' })
      await studyAPI.deleteLearningReport(item.id)
      list.value = list.value.filter((r) => r.id !== item.id)
      showToast({ type: 'success', message: '已删除' })
    }
    onMounted(() => load().catch(() => {}))
    return { list, overview, loading, generate, remove }
  }
}
</script>
<style scoped>
.page { min-height: 100vh; background: #eef3fb; padding: 12px 0 32px; }
.hero { padding: 8px 20px 4px; }
.kicker { font-size: 12px; color: #2459ff; font-weight: 700; }
.hero h1 { margin: 4px 0; font-size: 24px; color: #0b1633; }
.hero p { margin: 0; font-size: 13px; color: rgba(11,22,51,0.5); }
.card, .item { background: #fff; margin: 12px 16px; padding: 16px; border-radius: 16px; }
.stats, .habit, .diff-row { display: flex; justify-content: space-around; text-align: center; }
.stat, .habit div, .diff { display: flex; flex-direction: column; gap: 4px; }
.card h3 { margin: 0 0 12px; font-size: 15px; }
.dist { display: grid; grid-template-columns: 64px 1fr 28px; gap: 8px; align-items: center; margin-bottom: 8px; font-size: 12px; }
.track { height: 8px; background: #eef3fb; border-radius: 99px; overflow: hidden; }
.track i { display: block; height: 100%; background: linear-gradient(90deg,#2459ff,#52b7ff); }
.diff.easy b { color: #16a34a; }
.diff.hard b { color: #e11d48; }
.primary { width: 100%; height: 42px; border: none; border-radius: 999px; color: #fff; font-weight: 700; background: linear-gradient(135deg,#2459ff,#52b7ff); }
.hint { margin: 8px 0 0; font-size: 12px; color: rgba(11,22,51,0.5); }
.hist { margin: 20px 16px 0; font-size: 15px; }
.item { display: flex; align-items: center; gap: 8px; }
.item-main { flex: 1; display: flex; flex-direction: column; gap: 4px; }
.item span { font-size: 12px; color: rgba(11,22,51,0.5); }
.del { border: none; background: none; color: #e11d48; font-weight: 700; }
</style>
