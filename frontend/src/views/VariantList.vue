<template>
  <div class="page">
    <van-nav-bar title="已保存变式题" left-arrow @click-left="$router.back()" fixed placeholder>
      <template #right>
        <span class="nav-action" @click="toggleEdit">{{ editMode ? '完成' : '加入组卷' }}</span>
      </template>
    </van-nav-bar>

    <div v-if="loading" class="state">加载中…</div>
    <div v-else-if="!list.length" class="empty">
      <div class="empty-title">还没有保存过变式题</div>
      <div class="empty-sub">进入分类，勾选错题生成变式题，再点「收入题库」才会出现在这里</div>
      <button class="primary" @click="$router.push('/categories')">去选择错题</button>
    </div>
    <template v-else>
      <div class="hint">
        <b>共 {{ list.length }} 道已保存的变式题</b>
        <span>{{ editMode ? '勾选要组卷的题目，再点底部确认' : '变式题会同时出现在对应分类里，标签为「变式题」' }}</span>
      </div>
      <div
        v-for="item in list"
        :key="item.id"
        class="card"
        :class="{ selected: item.selected }"
        @click="editMode && toggleSelect(item)"
      >
        <div class="meta">
          <span class="idx">#{{ item.index }}</span>
          <span class="diff" :class="'d-' + item.difficulty">{{ difficultyText(item.difficulty) }}</span>
          <span v-if="item.category" class="cat">{{ item.category }}</span>
        </div>
        <p class="content">{{ item.content }}</p>
        <button v-if="!editMode" class="ghost" @click.stop="item.showAnswer = !item.showAnswer">
          {{ item.showAnswer ? '收起答案' : '查看答案与解析' }}
        </button>
        <div v-if="item.showAnswer && !editMode" class="answer">
          <b>答案</b>
          <p>{{ item.aiAnswer || '暂无答案' }}</p>
          <b>解析</b>
          <p>{{ item.aiAnalysis || '暂无解析' }}</p>
        </div>
        <div v-if="!editMode" class="links">
          <span @click.stop="goCategory(item)">去分类查看</span>
          <span class="danger" @click.stop="remove(item)">删除</span>
        </div>
        <button v-if="!editMode" class="primary slim" @click.stop="addOne(item)">加入组卷</button>
        <van-checkbox v-else v-model="item.selected" @click.stop="toggleSelect(item)" />
      </div>
    </template>

    <div v-if="editMode && selectedCount" class="batch">
      <span>已选 {{ selectedCount }} 道</span>
      <button class="primary slim" @click="confirmExam">确认组卷</button>
    </div>
  </div>
</template>

<script>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showConfirmDialog, showToast } from 'vant'
import { apiClient } from '../api/config'
import { partitionPaperQuestions } from '../utils/questionFormat'

export default {
  name: 'VariantListPage',
  setup() {
    const router = useRouter()
    const list = ref([])
    const loading = ref(true)
    const editMode = ref(false)
    const selectedCount = computed(() => list.value.filter((q) => q.selected).length)

    const difficultyText = (d) => ({ easy: '简单', medium: '中等', hard: '困难' }[d] || '中等')

    const load = async () => {
      loading.value = true
      try {
        const res = await apiClient.get('/questions', { params: { tag: '变式题' } })
        const records = res.data?.data || []
        list.value = records.map((item, i) => ({
          ...item,
          index: i + 1,
          showAnswer: false,
          selected: false,
          difficulty: String(item.difficulty || 'medium').toLowerCase()
        }))
      } catch {
        list.value = []
      } finally {
        loading.value = false
      }
    }

    const toggleEdit = () => {
      editMode.value = !editMode.value
      if (!editMode.value) list.value.forEach((q) => { q.selected = false })
    }
    const toggleSelect = (item) => { item.selected = !item.selected }

    const pushPending = (items) => {
      const { ready, blocked } = partitionPaperQuestions(items)
      if (!ready.length) {
        showToast(blocked.length ? '未解析完成的题目不能加入组卷' : '请先选择题目')
        return
      }
      if (blocked.length) {
        showToast(`已跳过 ${blocked.length} 道未解析完成的题`)
      }
      const existing = JSON.parse(sessionStorage.getItem('pendingPaperQuestions') || '[]')
      ready.forEach((q) => {
        if (!existing.find((e) => e.id === q.id)) {
          existing.push({
            id: q.id,
            content: q.content,
            answer: q.aiAnswer || '待补充',
            analysis: q.aiAnalysis || 'AI暂未给出解析',
            aiStatus: q.aiStatus || '',
            aiAnswer: q.aiAnswer || '',
            aiAnalysis: q.aiAnalysis || '',
            categoryId: q.categoryId,
            categoryName: q.category,
            difficulty: q.difficulty,
            tags: q.tags || []
          })
        }
      })
      sessionStorage.setItem('pendingPaperQuestions', JSON.stringify(existing))
      showToast({ type: 'success', message: '已加入组卷' })
      router.push('/paper-builder')
    }

    const addOne = (item) => pushPending([item])
    const confirmExam = () => {
      const selected = list.value.filter((q) => q.selected)
      if (!selected.length) {
        showToast('请勾选题目')
        return
      }
      pushPending(selected)
    }

    const goCategory = (item) => {
      if (item.categoryId) router.push('/category/' + item.categoryId)
      else showToast('未找到分类')
    }

    const remove = async (item) => {
      await showConfirmDialog({ title: '删除变式题', message: '从题库中移除这道变式题？' })
      await apiClient.delete('/questions/' + item.id)
      list.value = list.value.filter((q) => q.id !== item.id)
      showToast({ type: 'success', message: '已删除' })
    }

    onMounted(load)
    return {
      list, loading, editMode, selectedCount, difficultyText,
      toggleEdit, toggleSelect, addOne, confirmExam, goCategory, remove
    }
  }
}
</script>

<style scoped>
.page { min-height: 100vh; background: #eef3fb; padding-bottom: 88px; }
.nav-action { color: #2459ff; font-size: 14px; font-weight: 700; }
.state, .empty { padding: 48px 24px; text-align: center; color: rgba(11,22,51,0.5); }
.empty-title { font-size: 18px; font-weight: 800; color: #0b1633; margin-bottom: 8px; }
.empty-sub { margin-bottom: 16px; font-size: 13px; }
.hint, .card { background: #fff; margin: 12px 16px; padding: 14px 16px; border-radius: 16px; }
.hint { display: flex; flex-direction: column; gap: 4px; }
.hint span { font-size: 12px; color: rgba(11,22,51,0.5); }
.card.selected { outline: 2px solid #2459ff; }
.meta { display: flex; gap: 8px; align-items: center; font-size: 12px; color: rgba(11,22,51,0.5); }
.idx { font-weight: 700; color: #2459ff; }
.diff.d-easy { color: #16a34a; }
.diff.d-hard { color: #e11d48; }
.content { margin: 10px 0; line-height: 1.6; white-space: pre-wrap; }
.ghost, .primary, .links span { cursor: pointer; }
.ghost { border: none; background: #eef3fb; color: #2459ff; border-radius: 999px; padding: 6px 12px; font-weight: 700; }
.answer { margin-top: 10px; background: #f4f7fb; border-radius: 12px; padding: 10px; font-size: 13px; }
.answer p { margin: 4px 0 10px; white-space: pre-wrap; }
.links { display: flex; justify-content: space-between; margin: 10px 0; font-size: 13px; color: #2459ff; }
.danger { color: #e11d48 !important; }
.primary { width: calc(100% - 32px); margin: 0 16px; height: 42px; border: none; border-radius: 999px; color: #fff; font-weight: 700; background: linear-gradient(135deg,#2459ff,#52b7ff); }
.primary.slim { width: 100%; margin: 8px 0 0; height: 36px; }
.batch { position: fixed; left: 0; right: 0; bottom: 0; display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #fff; box-shadow: 0 -8px 24px rgba(11,22,51,0.08); }
.batch .primary { width: auto; padding: 0 18px; margin: 0; }
</style>
