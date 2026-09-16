<template>
  <div class="page">
    <van-nav-bar title="教学效果分析" left-arrow @click-left="$router.push('/teacher')" fixed placeholder />

    <div class="card stat-grid">
      <div class="stat"><b>{{ a.studentCount || 0 }}</b><span>学生</span></div>
      <div class="stat"><b>{{ a.totalQuestions || 0 }}</b><span>错题总数</span></div>
      <div class="stat"><b>{{ a.masteryRate || 0 }}%</b><span>整体掌握率</span></div>
      <div class="stat"><b>{{ a.activeWeek || 0 }}</b><span>本周活跃</span></div>
    </div>

    <div class="card">
      <h3>今日与作业</h3>
      <div class="stat-grid">
        <div class="stat"><b>{{ a.checkedToday || 0 }}</b><span>今日打卡</span></div>
        <div class="stat"><b>{{ a.homeworkCount || 0 }}</b><span>布置作业</span></div>
        <div class="stat"><b>{{ a.submissionCount || 0 }}</b><span>提交次数</span></div>
        <div class="stat"><b>{{ a.homeworkAvg ?? '—' }}</b><span>作业均分</span></div>
      </div>
    </div>

    <div class="card">
      <h3>近 14 天班级错题新增</h3>
      <div class="bars">
        <div v-for="d in a.trend || []" :key="d.day" class="bar-col" :title="d.day + ' · ' + d.count">
          <div class="bar" :style="{ height: barHeight(d.count) }"></div>
        </div>
      </div>
    </div>

    <div v-if="a.hotTags?.length" class="card">
      <h3>高频薄弱知识点</h3>
      <div v-for="t in a.hotTags" :key="t.name" class="dist">
        <span class="dist-name">{{ t.name }}</span>
        <div class="track"><i :style="{ width: pct(t.count, a.hotTags) + '%' }"></i></div>
        <span class="dist-num">{{ t.count }}</span>
      </div>
    </div>

    <div v-if="a.categories?.length" class="card">
      <h3>学科分布</h3>
      <div v-for="c in a.categories" :key="c.name" class="dist">
        <span class="dist-name">{{ c.name }}</span>
        <div class="track"><i :style="{ width: pct(c.count, a.categories) + '%' }"></i></div>
        <span class="dist-num">{{ c.count }}</span>
      </div>
    </div>

    <div class="card">
      <h3>学生明细</h3>
      <div class="table-head">
        <span class="col-name">学生</span>
        <span>错题</span>
        <span>掌握率</span>
        <span>作业均分</span>
      </div>
      <div v-for="s in a.students || []" :key="s.id" class="table-row" @click="$router.push('/teacher/students/' + s.id)">
        <span class="col-name">
          {{ s.nickName }}
          <i v-if="!s.activeWeek" class="idle">本周未活跃</i>
        </span>
        <span>{{ s.questionCount }}</span>
        <span>{{ s.masteryRate }}%</span>
        <span>{{ s.homeworkAvg ?? '—' }}</span>
      </div>
      <div v-if="!a.students?.length" class="empty">还没有学生数据</div>
    </div>

    <TeacherTabBar />
  </div>
</template>

<script>
import { onMounted, ref } from 'vue'
import { showToast } from 'vant'
import teacherAPI from '../../api/teacher'
import TeacherTabBar from '../../components/TeacherTabBar.vue'

export default {
  name: 'TeacherAnalytics',
  components: { TeacherTabBar },
  setup() {
    const a = ref({})
    const load = async () => {
      const res = await teacherAPI.analytics()
      a.value = res.data || {}
    }
    const barHeight = (n) => {
      const max = Math.max(1, ...(a.value.trend || []).map((d) => d.count))
      return Math.max(4, Math.round((n / max) * 60)) + 'px'
    }
    const pct = (n, list) => {
      const max = Math.max(1, ...(list || []).map((x) => x.count))
      return Math.round((n / max) * 100)
    }
    onMounted(() => load().catch((e) => showToast({ type: 'fail', message: e.response?.data?.message || '加载失败' })))
    return { a, barHeight, pct }
  }
}
</script>

<style scoped>
.page { min-height: 100vh; padding-bottom: 90px; background: #eef3fb; }
.card { background: #fff; margin: 12px 16px; padding: 16px; border-radius: 16px; border: 1px solid rgba(11,22,51,0.06); }
.card h3 { margin: 0 0 10px; font-size: 15px; }
.stat-grid { display: flex; justify-content: space-around; text-align: center; }
.stat b { display: block; font-size: 20px; color: #0b1633; }
.stat span { font-size: 11px; color: rgba(11,22,51,0.5); }
.bars { display: flex; align-items: flex-end; gap: 4px; height: 64px; }
.bar-col { flex: 1; display: flex; align-items: flex-end; }
.bar { width: 100%; border-radius: 4px 4px 0 0; background: linear-gradient(180deg,#2459ff,#52b7ff); }
.dist { display: grid; grid-template-columns: 90px 1fr 36px; gap: 8px; align-items: center; margin-bottom: 8px; font-size: 12px; }
.dist-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.track { height: 8px; background: #eef3fb; border-radius: 99px; overflow: hidden; }
.track i { display: block; height: 100%; background: linear-gradient(90deg,#2459ff,#52b7ff); }
.table-head, .table-row { display: grid; grid-template-columns: 1.6fr 0.7fr 0.8fr 0.9fr; gap: 6px; align-items: center; font-size: 13px; padding: 8px 0; }
.table-head { font-size: 12px; color: rgba(11,22,51,0.45); border-bottom: 1px solid rgba(11,22,51,0.06); }
.table-row { border-bottom: 1px solid rgba(11,22,51,0.04); cursor: pointer; }
.table-head span:not(.col-name), .table-row span:not(.col-name) { text-align: center; }
.col-name { display: flex; flex-direction: column; }
.idle { font-size: 11px; color: #e11d48; font-style: normal; }
.empty { padding: 20px; text-align: center; color: rgba(11,22,51,0.45); font-size: 13px; }
</style>
