<template>
  <div class="analyzing-page">
    <van-nav-bar title="AI 解析进度" left-arrow @click-left="goBack" fixed placeholder />

    <div class="page-header">
      <h2 class="page-title">AI 解析进度</h2>
      <p v-if="pendingCount > 0" class="page-desc">共 {{ pendingCount }} 道题正在后台生成解析</p>
    </div>

    <div v-if="loading" class="loading-wrap">
      <van-loading size="24">加载中…</van-loading>
    </div>

    <div v-else-if="allDone" class="empty-state">
      <span class="empty-icon">✓</span>
      <p class="empty-title">全部解析完成</p>
      <p class="empty-desc">题目已自动进入对应分类</p>
      <van-button type="primary" round @click="goBack">返回分类</van-button>
    </div>

    <div v-else class="question-list">
      <div v-for="item in pendingList" :key="item.id" class="question-item">
        <div class="item-header">
          <span class="item-index">第{{ item.displayIndex }}题</span>
          <span v-if="item.category" class="item-category">{{ item.category }}</span>
        </div>
        <p class="item-preview">{{ item.preview || '暂无内容' }}</p>

        <div v-if="item.isAnalyzing" class="status-row">
          <div class="indeterminate-bar">
            <div class="indeterminate-bar-fill"></div>
          </div>
          <span class="status-text analyzing">{{ item.statusText }}</span>
        </div>

        <div v-else-if="item.isFailed" class="status-row failed-row">
          <span class="status-text failed">解析失败</span>
          <van-button size="mini" type="primary" plain @click="retryQuestion(item.id)">
            重试
          </van-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showLoadingToast, closeToast } from 'vant'
import { fetchPendingQuestions, startPendingPoll } from '../utils/pendingQuestions'
import { apiClient } from '../api/config'

export default {
  name: 'Analyzing',
  setup() {
    const router = useRouter()
    const pendingList = reactive([])
    const loading = ref(true)
    let stopPoll = null

    const pendingCount = computed(() => pendingList.length)
    const allDone = computed(() => !loading.value && pendingList.length === 0)

    const applyList = (list) => {
      pendingList.splice(0, pendingList.length, ...(list || []))
      loading.value = false
    }

    const loadPending = async () => {
      loading.value = true
      try {
        const list = await fetchPendingQuestions()
        applyList(list)
      } catch (e) {
        showToast((e && e.message) || '加载失败')
        loading.value = false
      }
    }

    const retryQuestion = async (id) => {
      if (!id) return
      showLoadingToast({ message: '重新排队…', forbidClick: true })
      try {
        await apiClient.post(`/questions/${id}/retry-ai`)
        closeToast()
        showToast('已重新排队')
        await loadPending()
      } catch {
        closeToast()
        showToast('重试失败')
      }
    }

    const goBack = () => {
      router.push('/categories').catch(() => router.back())
    }

    onMounted(() => {
      loadPending()
      stopPoll = startPendingPoll(applyList, 5000)
    })

    onBeforeUnmount(() => {
      if (stopPoll) stopPoll()
    })

    return {
      pendingList,
      loading,
      pendingCount,
      allDone,
      retryQuestion,
      goBack
    }
  }
}
</script>

<style scoped>
.analyzing-page {
  min-height: 100vh;
  padding: 0 20px 40px;
  background: #eaf3ff;
}

.page-header {
  margin: 16px 0 20px;
}

.page-title {
  font-size: 22px;
  font-weight: 800;
  color: #0b1633;
  margin: 0 0 6px;
}

.page-desc {
  font-size: 13px;
  color: rgba(11, 22, 51, 0.55);
  margin: 0;
}

.loading-wrap {
  padding: 60px 0;
  text-align: center;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80px 20px;
  text-align: center;
}

.empty-icon {
  width: 56px;
  height: 56px;
  line-height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, #2459ff, #52b7ff);
  color: #fff;
  font-size: 28px;
  font-weight: 800;
  margin-bottom: 16px;
}

.empty-title {
  font-size: 18px;
  font-weight: 700;
  color: #0b1633;
  margin: 0 0 8px;
}

.empty-desc {
  font-size: 13px;
  color: rgba(11, 22, 51, 0.55);
  margin: 0 0 24px;
}

.question-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.question-item {
  background: #fff;
  border: 1px solid rgba(11, 22, 51, 0.06);
  border-radius: 18px;
  padding: 16px;
  box-shadow: 0 12px 36px rgba(11, 22, 51, 0.06);
}

.item-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.item-index {
  font-size: 14px;
  font-weight: 700;
  color: #2459ff;
}

.item-category {
  font-size: 12px;
  color: rgba(11, 22, 51, 0.5);
  background: rgba(36, 89, 255, 0.08);
  padding: 2px 8px;
  border-radius: 8px;
}

.item-preview {
  font-size: 13px;
  color: rgba(11, 22, 51, 0.75);
  margin: 0 0 12px;
  line-height: 1.5;
}

.status-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.indeterminate-bar {
  flex: 1;
  height: 4px;
  background: rgba(36, 89, 255, 0.12);
  border-radius: 2px;
  overflow: hidden;
}

.indeterminate-bar-fill {
  width: 40%;
  height: 100%;
  background: linear-gradient(90deg, #2459ff, #52b7ff);
  border-radius: 2px;
  animation: shimmer 1.4s ease-in-out infinite;
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(350%); }
}

.status-text {
  font-size: 12px;
  white-space: nowrap;
}

.status-text.analyzing {
  color: #2459ff;
}

.status-text.failed {
  color: #ee0a24;
}

.failed-row {
  justify-content: space-between;
}
</style>
