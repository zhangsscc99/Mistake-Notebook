<template>
  <div class="page">
    <div class="hero">
      <div class="kicker">TEACHER</div>
      <h1>班级工作台</h1>
      <p>学生凭加入码申请，通过后才会进入班级。点加入码可复制</p>
      <div class="hero-stats">
        <div class="hero-stat"><b>{{ classes.length }}</b><span>班级</span></div>
        <div class="hero-stat" @click="goRoster"><b>{{ dash.studentCount || 0 }}</b><span>学生</span></div>
        <div class="hero-stat"><b>{{ dash.assignmentCount || 0 }}</b><span>作业</span></div>
      </div>
    </div>

    <div class="section-head">
      <span class="section-title">我的班级</span>
      <button class="ghost" @click="createClass">＋ 新建班级</button>
    </div>
    <div
      v-for="item in classes"
      :key="item.id"
      class="card row-card"
      :class="{ on: selected.id === item.id }"
      @click="selectClass(item)"
    >
      <div class="class-dot"></div>
      <div class="grow">
        <b>{{ item.name }}</b>
        <span>{{ item.grade || '未设置学段' }} · {{ item.studentCount || 0 }} 名学生<span v-if="item.pendingCount"> · {{ item.pendingCount }} 人待审核</span></span>
      </div>
      <button class="code" @click.stop="copyCode(item.joinCode)">{{ item.joinCode }}</button>
    </div>
    <div v-if="!classes.length" class="empty">还没有班级<span>创建后把加入码发给学生</span></div>

    <template v-if="selected.id && pending.length">
      <div class="section-head">
        <span class="section-title">待审核</span>
        <span class="note">{{ pending.length }} 人</span>
      </div>
      <div v-for="s in pending" :key="s.id" class="card pending">
        <div class="pending-top">
          <div class="avatar">{{ mark(s.nickName) }}</div>
          <div class="grow">
            <b>{{ s.nickName || '未设置昵称' }}</b>
            <span>申请加入班级，通过后可查看错题</span>
          </div>
        </div>
        <div class="pending-actions">
          <button class="ghost" @click="reject(s)">拒绝</button>
          <button class="primary slim" @click="approve(s)">通过</button>
        </div>
      </div>
    </template>

    <div class="section-head">
      <span class="section-title">{{ selected.name || '班级学生' }}</span>
      <span v-if="studentMore > 0" class="note" @click="goRoster">查看全部 ›</span>
      <span v-else class="note">{{ students.length }} 人</span>
    </div>
    <div
      v-for="s in preview"
      :key="s.id"
      class="card row-card"
      @click="$router.push(`/teacher/students/${s.id}?classId=${selected.id}`)"
    >
      <div class="avatar">{{ mark(s.nickName) }}</div>
      <div class="grow">
        <b>{{ s.nickName || '未设置昵称' }}</b>
        <span>错题 {{ s.questionCount || 0 }} 道 · 点开查看</span>
      </div>
      <span class="arrow">›</span>
    </div>
    <div v-if="studentMore > 0" class="card row-card" @click="goRoster">
      <div class="grow">
        <b>查看全部 {{ students.length }} 人</b>
        <span>还可按昵称搜索</span>
      </div>
      <span class="arrow">›</span>
    </div>
    <div v-if="selected.id && !students.length && !pending.length" class="empty">
      班级还没有学生<span>把加入码发给学生，通过申请后才会出现在这里</span>
    </div>

    <div class="section-head"><span class="section-title">教学工具</span></div>
    <div class="tool-grid">
      <div class="tool" @click="$router.push('/teacher/questions')">
        <b>全班题目</b><span>学生错题与班级题库</span>
      </div>
      <div class="tool" @click="$router.push('/teacher/paper')">
        <b>班级组卷</b><span>选题后发给班级或存为题单</span>
      </div>
      <div class="tool" @click="$router.push('/teacher/homework')">
        <b>作业批改</b><span>查看提交与打分</span>
      </div>
      <div class="tool" @click="openReport">
        <b>家长报告</b><span>班级学情快照</span>
      </div>
      <div class="tool" @click="$router.push('/teacher/class-notebooks')">
        <b>班级错题本</b><span>高频错题成册推给全班</span>
      </div>
      <div class="tool" @click="$router.push('/teacher/analytics')">
        <b>教学分析</b><span>提交率与掌握度</span>
      </div>
    </div>
    <TeacherTabBar />

    <van-popup v-model:show="showCreate" round position="center" :style="{ width: '86%', padding: '20px' }">
      <b class="popup-title">新建班级</b>
      <input v-model="newName" class="input" placeholder="例如：高一（3）班" maxlength="30" />
      <div class="popup-actions">
        <button class="ghost" @click="showCreate = false">取消</button>
        <button class="primary slim" :disabled="creating" @click="submitClass">创建</button>
      </div>
    </van-popup>
  </div>
</template>

<script>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showConfirmDialog, showToast } from 'vant'
import teacherAPI from '../../api/teacher'
import TeacherTabBar from '../../components/TeacherTabBar.vue'
import { markOf, setSelectedClassId } from '../../utils/teacherClass'

const PREVIEW = 6

export default {
  name: 'TeacherHome',
  components: { TeacherTabBar },
  setup() {
    const router = useRouter()
    const dash = ref({})
    const classes = ref([])
    const selected = ref({})
    const students = ref([])
    const pending = ref([])
    const showCreate = ref(false)
    const newName = ref('')
    const creating = ref(false)
    const preview = computed(() => students.value.slice(0, PREVIEW))
    const studentMore = computed(() => Math.max(0, students.value.length - PREVIEW))
    const mark = markOf
    const fail = (e) => showToast({ type: 'fail', message: e.response?.data?.message || '加载失败' })

    const applyDash = (data, keepId) => {
      dash.value = data || {}
      classes.value = data.classes || []
      selected.value = classes.value.find((c) => c.id === keepId) || classes.value[0] || {}
      if (selected.value.id) setSelectedClassId(selected.value.id)
      pending.value = data.pendingStudents || []
      students.value = data.students || []
    }

    const loadStudents = async (classId) => {
      const [stu, req] = await Promise.all([
        teacherAPI.classStudents(classId),
        teacherAPI.joinRequests(classId)
      ])
      students.value = stu.data || []
      pending.value = req.data || []
    }

    const load = async () => {
      const res = await teacherAPI.dashboard()
      applyDash(res.data || {}, selected.value.id)
      if (selected.value.id && classes.value[0] && selected.value.id !== classes.value[0].id) {
        await loadStudents(selected.value.id)
      }
    }

    const selectClass = async (item) => {
      selected.value = item
      setSelectedClassId(item.id)
      await loadStudents(item.id)
    }

    const createClass = () => {
      newName.value = ''
      showCreate.value = true
    }

    const submitClass = async () => {
      if (!newName.value.trim()) {
        showToast('请输入班级名称')
        return
      }
      creating.value = true
      try {
        await teacherAPI.createClass(newName.value.trim())
        showCreate.value = false
        showToast({ type: 'success', message: '班级已创建' })
        await load()
      } catch (e) { fail(e) }
      finally { creating.value = false }
    }

    const copyCode = async (code) => {
      if (!code) return
      try {
        await navigator.clipboard.writeText(code)
        showToast({ type: 'success', message: '加入码已复制' })
      } catch {
        showToast('加入码：' + code)
      }
    }

    const approve = async (s) => {
      try {
        await teacherAPI.approveJoin(selected.value.id, s.id)
        showToast({ type: 'success', message: '已通过' })
        await loadStudents(selected.value.id)
        await load()
      } catch (e) { fail(e) }
    }

    const reject = async (s) => {
      await showConfirmDialog({
        title: '拒绝申请',
        message: '拒绝后该学生不会进入班级，可再次提交申请。',
        confirmButtonText: '拒绝',
        confirmButtonColor: '#e11d48'
      })
      try {
        await teacherAPI.rejectJoin(selected.value.id, s.id)
        showToast('已拒绝')
        await loadStudents(selected.value.id)
        await load()
      } catch (e) { fail(e) }
    }

    const goRoster = () => {
      if (!selected.value.id) return
      router.push({ path: '/teacher/students', query: { classId: selected.value.id, name: selected.value.name } })
    }

    const openReport = () => {
      const q = selected.value.id ? { classId: selected.value.id } : {}
      router.push({ path: '/teacher/report', query: q })
    }

    onMounted(() => load().catch(fail))
    return {
      dash, classes, selected, students, pending, preview, studentMore, showCreate, newName, creating,
      mark, selectClass, createClass, submitClass, copyCode, approve, reject, goRoster, openReport
    }
  }
}
</script>

<style scoped>
.page { min-height: 100vh; padding: 20px 16px 90px; background: #eef3fb; }
.hero { background: linear-gradient(135deg, #2459ff, #52b7ff); border-radius: 20px; padding: 18px; color: #fff; margin-bottom: 14px; }
.kicker { font-size: 12px; opacity: 0.85; letter-spacing: 1px; }
.hero h1 { margin: 4px 0 6px; font-size: 22px; }
.hero p { margin: 0; font-size: 13px; opacity: 0.88; line-height: 1.5; }
.hero-stats { margin-top: 16px; display: flex; background: rgba(255,255,255,0.18); border-radius: 14px; overflow: hidden; }
.hero-stat { flex: 1; text-align: center; padding: 10px 0; cursor: pointer; }
.hero-stat b { display: block; font-size: 20px; }
.hero-stat span { font-size: 11px; opacity: 0.85; }
.section-head { display: flex; justify-content: space-between; align-items: center; margin: 18px 2px 8px; }
.section-title { font-size: 15px; font-weight: 800; color: #0b1633; }
.note { font-size: 12px; color: rgba(11,22,51,0.45); }
.card { background: #fff; border-radius: 16px; padding: 14px 16px; margin-bottom: 8px; border: 1px solid rgba(11,22,51,0.06); }
.row-card {
  display: flex; align-items: center; gap: 12px; cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}
.row-card.on { box-shadow: inset 0 0 0 2px rgba(36,89,255,0.35); }
.class-dot { width: 10px; height: 10px; border-radius: 50%; background: #2459ff; box-shadow: 0 0 0 4px rgba(36,89,255,0.12); flex-shrink: 0; }
.grow { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.grow b { font-size: 15px; color: #0b1633; }
.grow span { font-size: 12px; color: rgba(11,22,51,0.5); margin-top: 4px; }
.code { border: none; background: none; color: #2459ff; font-weight: 800; letter-spacing: 1px; }
.avatar { width: 40px; height: 40px; border-radius: 50%; background: #eaf1ff; color: #2459ff; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.arrow { color: rgba(11,22,51,0.3); font-size: 18px; }
.pending-top { display: flex; gap: 12px; align-items: center; }
.pending-actions { display: flex; gap: 8px; margin-top: 12px; justify-content: flex-end; }
.ghost { border: none; background: #eef3fb; color: #2459ff; border-radius: 999px; padding: 8px 14px; font-weight: 700; }
.primary.slim { border: none; border-radius: 999px; padding: 0 18px; height: 36px; color: #fff; font-weight: 700; background: linear-gradient(135deg,#2459ff,#52b7ff); }
.empty { padding: 20px 8px; text-align: center; color: rgba(11,22,51,0.45); font-size: 13px; }
.empty span { display: block; margin-top: 6px; font-size: 12px; }
.tool-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.tool {
  background: #fff; border-radius: 16px; padding: 16px;
  border: 1px solid rgba(11,22,51,0.06); cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}
@media (hover: hover) and (pointer: fine) {
  .tool:hover {
    z-index: 2;
    transform: translateY(-4px);
    border-color: rgba(36, 89, 255, 0.32);
    box-shadow: 0 16px 32px rgba(31, 91, 255, 0.16);
  }
}
.tool b { display: block; font-size: 15px; color: #0b1633; }
.tool span { display: block; margin-top: 6px; font-size: 12px; color: rgba(11,22,51,0.46); }
.popup-title { display: block; font-size: 16px; margin-bottom: 12px; }
.input { width: 100%; height: 42px; border: none; background: #f4f7fb; border-radius: 12px; padding: 0 12px; }
.popup-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
</style>
