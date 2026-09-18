<template>
  <div class="page">
    <van-nav-bar title="作业批改" left-arrow @click-left="$router.push('/teacher')" fixed placeholder />
    <div class="chips">
      <button class="chip" :class="{ on: !classId }" @click="classId = 0">全部</button>
      <button v-for="c in classes" :key="c.id" class="chip" :class="{ on: classId === c.id }" @click="classId = c.id">{{ c.name }}</button>
    </div>
    <div v-for="hw in visible" :key="hw.id" class="card tap" @click="$router.push('/teacher/homework/' + hw.id)">
      <div class="head">
        <b>{{ hw.title }}</b>
        <span v-if="hw.submitted > hw.graded" class="pill hot">{{ hw.submitted - hw.graded }} 待批</span>
      </div>
      <div class="meta">
        {{ hw.className || '班级' }} · {{ hw.questionCount }} 题 · 已交 {{ hw.submitted }}/{{ hw.studentCount }}
        <span v-if="hw.dueAt"> · 截止 {{ fmt(hw.dueAt) }}</span>
      </div>
    </div>
    <div v-if="!visible.length" class="empty">还没有作业<span>先去组卷生成试卷，打开后发给班级并选作业</span></div>
    <TeacherTabBar />
  </div>
</template>

<script>
import { computed, onMounted, ref } from 'vue'
import { showToast } from 'vant'
import teacherAPI from '../../api/teacher'
import TeacherTabBar from '../../components/TeacherTabBar.vue'
import { fmtDay, getSelectedClassId } from '../../utils/teacherClass'

export default {
  name: 'TeacherHomework',
  components: { TeacherTabBar },
  setup() {
    const list = ref([])
    const classes = ref([])
    const classId = ref(getSelectedClassId() || 0)
    const visible = computed(() => classId.value ? list.value.filter((h) => h.classId === classId.value) : list.value)
    const fmt = fmtDay
    onMounted(async () => {
      try {
        const [hw, dash] = await Promise.all([teacherAPI.homework(), teacherAPI.dashboard()])
        list.value = hw.data || []
        classes.value = (dash.data && dash.data.classes) || []
      } catch (e) {
        showToast({ type: 'fail', message: e.response?.data?.message || '加载失败' })
      }
    })
    return { list, classes, classId, visible, fmt }
  }
}
</script>

<style scoped>
.page { min-height: 100vh; padding-bottom: 90px; background: #eef3fb; }
.chips { display: flex; gap: 8px; flex-wrap: wrap; padding: 12px 16px; }
.chip { border: none; background: #fff; border-radius: 999px; padding: 6px 12px; font-weight: 700; }
.chip.on { background: linear-gradient(135deg,#2459ff,#52b7ff); color: #fff; }
.card {
  background: #fff; margin: 0 16px 8px; padding: 14px 16px; border-radius: 16px;
  border: 1px solid rgba(11,22,51,0.06); cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}
.head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.meta { margin-top: 6px; font-size: 12px; color: rgba(11,22,51,0.5); }
.pill { font-size: 11px; padding: 3px 10px; border-radius: 999px; white-space: nowrap; }
.pill.hot { background: rgba(225,29,72,0.12); color: #e11d48; }
.empty { text-align: center; padding: 32px 16px; color: rgba(11,22,51,0.45); }
.empty span { display: block; margin-top: 6px; font-size: 12px; }
</style>
