<template>
  <div class="page">
    <van-nav-bar title="班级错题本" left-arrow @click-left="$router.push('/teacher')" fixed placeholder>
      <template #right>
        <span class="nav-action" @click="showBuilder = true">新建</span>
      </template>
    </van-nav-bar>

    <div v-if="!notebooks.length" class="empty">
      还没有班级错题本。点右上角「新建」，从名下学生的高频错题里挑题成册。
    </div>

    <div v-for="nb in notebooks" :key="nb.id" class="card">
      <div class="nb-head">
        <b>{{ nb.title }}</b>
        <span class="pill" :class="{ on: nb.pushedAt }">{{ nb.pushedAt ? '已推送' : '草稿' }}</span>
      </div>
      <p v-if="nb.description" class="desc">{{ nb.description }}</p>
      <div class="meta">{{ nb.questionCount }} 题 · 已开始 {{ nb.startedCount }}/{{ nb.studentCount }} 人 · 完成 {{ nb.finishedCount }} 人</div>
      <div class="actions">
        <button class="ghost" @click="$router.push('/teacher/class-notebooks/' + nb.id)">查看进度</button>
        <button v-if="!nb.pushedAt" class="primary slim" @click="push(nb)">推送给全班</button>
        <button v-else class="ghost" @click="push(nb)">重新推送</button>
        <button class="del" @click="remove(nb)">删除</button>
      </div>
    </div>

    <!-- 新建：从高频错题挑题 -->
    <van-popup v-model:show="showBuilder" position="bottom" round :style="{ height: '88%' }">
      <div class="builder">
        <div class="builder-head">
          <b>新建班级错题本</b>
          <van-icon name="cross" @click="showBuilder = false" />
        </div>
        <input v-model="form.title" class="input" placeholder="标题，例如「二次函数高频错题」" />
        <input v-model="form.description" class="input" placeholder="说明（可选）" />

        <div class="hf-head">
          <span>名下 {{ hf.studentCount || 0 }} 名学生，共 {{ hf.questionCount || 0 }} 道错题</span>
          <b>已选 {{ picked.length }} 题</b>
        </div>

        <div v-if="loadingHf" class="empty">正在统计高频错题…</div>
        <div v-for="t in hf.hotTags || []" :key="t.tag" class="tag-group">
          <div class="tag-head" @click="t.open = !t.open">
            <b>{{ t.tag }}</b>
            <span>{{ t.studentCount }} 人错 · {{ t.count }} 次</span>
            <van-icon :name="t.open ? 'arrow-up' : 'arrow-down'" />
          </div>
          <div v-if="t.open" class="tag-body">
            <label v-for="q in t.samples" :key="q.id" class="pick">
              <input type="checkbox" :checked="isPicked(q.id)" @change="toggle(q, t.tag)" />
              <span class="pick-text">{{ q.content }}</span>
            </label>
          </div>
        </div>

        <button class="primary" :disabled="saving || !picked.length" @click="save">
          {{ saving ? '保存中…' : `保存错题本（${picked.length} 题）` }}
        </button>
      </div>
    </van-popup>

    <TeacherTabBar />
  </div>
</template>

<script>
import { onMounted, reactive, ref, watch } from 'vue'
import { showConfirmDialog, showToast } from 'vant'
import teacherAPI from '../../api/teacher'
import TeacherTabBar from '../../components/TeacherTabBar.vue'

export default {
  name: 'TeacherClassNotebooks',
  components: { TeacherTabBar },
  setup() {
    const notebooks = ref([])
    const hf = ref({})
    const loadingHf = ref(false)
    const showBuilder = ref(false)
    const saving = ref(false)
    const picked = ref([])
    const form = reactive({ title: '', description: '' })

    const fail = (e) => showToast({ type: 'fail', message: e.response?.data?.message || '操作失败' })

    const load = async () => {
      const res = await teacherAPI.notebooks()
      notebooks.value = res.data || []
    }
    const loadHf = async () => {
      loadingHf.value = true
      try {
        const res = await teacherAPI.highFrequency()
        const d = res.data || {}
        d.hotTags = (d.hotTags || []).map((t, i) => ({ ...t, open: i < 2 }))
        hf.value = d
      } finally {
        loadingHf.value = false
      }
    }

    watch(showBuilder, (open) => {
      if (open && !hf.value.hotTags) loadHf().catch(fail)
    })

    const isPicked = (id) => picked.value.some((p) => p.sourceQuestionId === id)
    const toggle = (q, tag) => {
      if (isPicked(q.id)) {
        picked.value = picked.value.filter((p) => p.sourceQuestionId !== q.id)
      } else {
        picked.value.push({
          sourceQuestionId: q.id,
          content: q.content,
          answer: q.aiAnswer || '',
          analysis: q.aiAnalysis || '',
          category: q.category || '',
          difficulty: q.difficulty || 'medium',
          tag
        })
      }
    }

    const save = async () => {
      if (!form.title.trim()) {
        showToast('请填写标题')
        return
      }
      saving.value = true
      try {
        await teacherAPI.createNotebook({
          title: form.title.trim(),
          description: form.description.trim(),
          questions: picked.value
        })
        showBuilder.value = false
        picked.value = []
        form.title = ''
        form.description = ''
        await load()
        showToast({ type: 'success', message: '已保存，可推送给全班' })
      } catch (e) {
        fail(e)
      } finally {
        saving.value = false
      }
    }

    const push = async (nb) => {
      await showConfirmDialog({ title: '推送给全班', message: `把「${nb.title}」推送给名下所有学生？` })
      try {
        await teacherAPI.pushNotebook(nb.id)
        await load()
        showToast({ type: 'success', message: '已推送' })
      } catch (e) {
        fail(e)
      }
    }

    const remove = async (nb) => {
      await showConfirmDialog({ title: '删除', message: `删除「${nb.title}」？` })
      await teacherAPI.deleteNotebook(nb.id)
      await load()
    }

    onMounted(() => load().catch(fail))
    return { notebooks, hf, loadingHf, showBuilder, saving, picked, form, isPicked, toggle, save, push, remove }
  }
}
</script>

<style scoped>
.page { min-height: 100vh; padding-bottom: 90px; background: #eef3fb; }
.nav-action { color: #2459ff; font-weight: 700; font-size: 14px; }
.card { background: #fff; margin: 12px 16px; padding: 16px; border-radius: 16px; border: 1px solid rgba(11,22,51,0.06); }
.nb-head { display: flex; justify-content: space-between; align-items: center; }
.nb-head b { font-size: 15px; color: #0b1633; }
.pill { font-size: 11px; padding: 3px 10px; border-radius: 999px; background: #f4f7fb; color: rgba(11,22,51,0.5); }
.pill.on { background: rgba(22,163,74,0.12); color: #16a34a; }
.desc { margin: 8px 0 0; font-size: 13px; color: rgba(11,22,51,0.6); }
.meta { margin-top: 8px; font-size: 12px; color: rgba(11,22,51,0.5); }
.actions { display: flex; gap: 8px; align-items: center; margin-top: 12px; flex-wrap: wrap; }
.ghost { border: none; background: #eef3fb; color: #2459ff; border-radius: 999px; padding: 8px 14px; font-weight: 700; }
.primary { width: 100%; height: 44px; border: none; border-radius: 999px; color: #fff; font-weight: 700; background: linear-gradient(135deg,#2459ff,#52b7ff); }
.primary.slim { width: auto; height: 36px; padding: 0 16px; }
.del { border: none; background: none; color: #e11d48; font-weight: 700; margin-left: auto; }
.empty { padding: 32px 24px; text-align: center; color: rgba(11,22,51,0.5); font-size: 13px; }
.builder { padding: 16px; height: 100%; overflow-y: auto; }
.builder-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.builder-head b { font-size: 17px; }
.input { width: 100%; height: 42px; border: none; background: #f4f7fb; border-radius: 12px; padding: 0 12px; margin-bottom: 10px; }
.hf-head { display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: rgba(11,22,51,0.5); margin: 12px 0 8px; }
.hf-head b { color: #2459ff; }
.tag-group { border: 1px solid rgba(11,22,51,0.06); border-radius: 12px; margin-bottom: 8px; overflow: hidden; }
.tag-head { display: flex; align-items: center; gap: 8px; padding: 12px; background: #f9fbff; cursor: pointer; }
.tag-head b { flex: 1; font-size: 14px; }
.tag-head span { font-size: 12px; color: rgba(11,22,51,0.5); }
.tag-body { padding: 4px 12px 12px; }
.pick { display: flex; gap: 8px; align-items: flex-start; padding: 8px 0; border-top: 1px solid rgba(11,22,51,0.04); }
.pick-text { flex: 1; font-size: 13px; line-height: 1.55; color: rgba(11,22,51,0.8); }
</style>
