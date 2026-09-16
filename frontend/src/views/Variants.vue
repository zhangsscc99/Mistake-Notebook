<template>
  <div class="page">
    <van-nav-bar title="变式题" left-arrow @click-left="$router.back()" />
    <div class="card">
      <p>根据已选的 {{ ids.length }} 道错题生成同类变式。至少需要 2 道原题，确认后会存进你的题库。</p>
      <p v-if="ids.length < 2" class="warn">请返回分类页点「编辑」，勾选至少 2 道错题后再生成。</p>
      <button class="primary" :disabled="loading || ids.length < 2" @click="generate">{{ loading ? '生成中…' : '生成变式' }}</button>
    </div>
    <div v-for="(v, i) in variants" :key="i" class="item">
      <p>{{ v.content }}</p>
      <label><input type="checkbox" v-model="v.picked" /> 收入题库</label>
    </div>
    <button v-if="variants.length" class="primary save" :disabled="saving" @click="save">保存勾选</button>
  </div>
</template>
<script>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import studyAPI from '../api/study'
import { apiClient } from '../api/config'
export default {
  name: 'VariantsPage',
  setup() {
    const route = useRoute()
    const router = useRouter()
    const variants = ref([])
    const loading = ref(false)
    const saving = ref(false)
    const ids = String(route.query.ids || '').split(',').filter(Boolean)
    const generate = async () => {
      if (ids.length < 2) {
        showToast('变式题生成至少需要 2 道错题')
        return
      }
      loading.value = true
      try {
        const res = await studyAPI.generateVariants(ids)
        const list = res.data || []
        if (!list.length) {
          showToast({ type: 'fail', message: res.message || '未能生成变式，请再试一次' })
          return
        }
        variants.value = list.map((v) => ({ ...v, picked: true }))
      } catch (e) {
        showToast({ type: 'fail', message: e.response?.data?.message || '生成失败' })
      } finally { loading.value = false }
    }
    const save = async () => {
      saving.value = true
      try {
        const picked = variants.value.filter((v) => v.picked)
        for (const v of picked) {
          await apiClient.post('/questions', {
            content: v.content,
            category: v.category || '数学',
            difficulty: (v.difficulty || 'MEDIUM').toLowerCase(),
            tags: ['变式题'],
            isVariant: true,
            aiAnswer: v.answer,
            aiAnalysis: v.analysis,
            aiStatus: 'completed'
          })
        }
        showToast({ type: 'success', message: '已保存 ' + picked.length + ' 道' })
        router.back()
      } finally { saving.value = false }
    }
    return { ids, variants, loading, saving, generate, save }
  }
}
</script>
<style scoped>
.page { min-height: 100vh; background: #eef3fb; padding-bottom: 40px; }
.card, .item { background: #fff; margin: 12px 16px; padding: 14px; border-radius: 16px; }
.primary { width: calc(100% - 32px); margin: 0 16px; height: 42px; border: none; border-radius: 999px; color: #fff; font-weight: 700; background: linear-gradient(135deg,#2459ff,#52b7ff); }
.primary:disabled { opacity: 0.45; }
.save { margin-top: 8px; }
.warn { color: #e11d48; font-size: 13px; }
</style>
