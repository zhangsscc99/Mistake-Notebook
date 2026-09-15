<template>
  <div class="page">
    <van-nav-bar title="错因分析历史" left-arrow @click-left="$router.back()" />
    <div v-if="!list.length" class="empty">还没有错因报告。在题目详情里可以生成。</div>
    <div v-for="item in list" :key="item.id" class="item">
      <div class="main" @click="$router.push('/mistake-report/' + item.id)">
        <b>{{ item.title }}</b>
      </div>
      <button class="del" @click.stop="remove(item)">删除</button>
    </div>
  </div>
</template>
<script>
import { ref, onMounted } from 'vue'
import { showConfirmDialog, showToast } from 'vant'
import studyAPI from '../api/study'
export default {
  name: 'ReportListPage',
  setup() {
    const list = ref([])
    const load = async () => {
      const res = await studyAPI.listMistakeReports()
      list.value = res.data || []
    }
    const remove = async (item) => {
      await showConfirmDialog({ title: '删除报告', message: '删除后无法恢复' })
      await studyAPI.deleteMistakeReport(item.id)
      list.value = list.value.filter((r) => r.id !== item.id)
      showToast({ type: 'success', message: '已删除' })
    }
    onMounted(load)
    return { list, remove }
  }
}
</script>
<style scoped>
.page { min-height: 100vh; background: #eef3fb; }
.item { background: #fff; margin: 10px 16px; padding: 14px; border-radius: 14px; display: flex; align-items: center; gap: 8px; }
.main { flex: 1; }
.empty { padding: 40px 16px; text-align: center; color: rgba(11,22,51,0.5); }
.del { border: none; background: none; color: #e11d48; font-weight: 700; }
</style>
