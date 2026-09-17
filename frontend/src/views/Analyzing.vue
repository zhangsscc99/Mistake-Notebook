<template>
  <div class="analyzing-page">
    <van-nav-bar title="AI 解析进度" left-arrow @click-left="goBack" fixed placeholder />

    <div class="page-header">
      <h2 class="page-title">AI 解析进度</h2>
      <p v-if="analyzingList.length > 0" class="page-desc">
        {{ analyzingList.length }} 道题正在后台生成解析<span v-if="failedList.length"> · {{ failedList.length }} 道解析失败</span>
      </p>
      <p v-else-if="failedList.length > 0" class="page-desc">
        {{ failedList.length }} 道题解析失败，可以重试或删除
      </p>
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

    <template v-else>
      <!-- 解析失败：放最上面，需要用户处理 -->
      <div v-if="failedList.length > 0" class="section">
        <div class="section-head">
          <div class="section-title failed">
            解析失败
            <span class="section-count">{{ failedList.length }} 道</span>
          </div>

          <div class="section-actions">
            <van-button size="mini" type="primary" plain :loading="bulkRetrying" @click="retryAll">
              全部重试
            </van-button>
            <van-button size="mini" type="danger" plain :loading="bulkDeleting" @click="deleteAll">
              全部删除
            </van-button>
          </div>
        </div>
        <p class="section-hint">解析失败的题目不会自己恢复。重试会重新排队，删除会从错题本移除。</p>

        <div v-for="item in failedList" :key="item.id" class="question-item failed-item">
          <div class="item-header">
            <span class="item-index">第{{ item.displayIndex }}题</span>
            <span v-if="item.category" class="item-category">{{ item.category }}</span>
          </div>
          <p class="item-preview">{{ item.preview || '暂无内容' }}</p>
          <p v-if="item.aiError" class="item-error">失败原因：{{ item.aiError }}</p>
          <p v-else-if="item.isStale" class="item-error">排队太久没有结果，可能是解析任务已丢失。</p>

          <div class="status-row failed-row">
            <span class="status-text failed">{{ item.statusText }}</span>
            <div class="row-actions">
              <van-button
                size="mini"
                type="primary"
                plain
                :loading="retryingId === item.id"
                :disabled="retryingId === item.id || bulkRetrying"
                @click="retryQuestion(item.id)"
              >重试</van-button>
              <van-button size="mini" type="danger" plain @click="deleteQuestion(item)">删除</van-button>
            </div>
          </div>
        </div>
      </div>

      <!-- 解析中 -->
      <div v-if="analyzingList.length > 0" class="section">
        <div class="section-head">
          <div class="section-title">
            解析中
            <span class="section-count">{{ analyzingList.length }} 道</span>
          </div>
        </div>

        <div v-for="item in analyzingList" :key="item.id" class="question-item">
          <div class="item-header">
            <span class="item-index">第{{ item.displayIndex }}题</span>
            <span v-if="item.category" class="item-category">{{ item.category }}</span>
          </div>
          <p class="item-preview">{{ item.preview || '暂无内容' }}</p>

          <div class="status-row">
            <div class="indeterminate-bar">
              <div class="indeterminate-bar-fill"></div>
            </div>
            <span class="status-text analyzing">{{ item.statusText }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showLoadingToast, closeToast, showConfirmDialog } from 'vant'
import { fetchPendingQuestions, startPendingPoll, splitPending } from '../utils/pendingQuestions'
import { apiClient } from '../api/config'

export default {
  name: 'Analyzing',
  setup() {
    const router = useRouter()
    const pendingList = reactive([])
    const loading = ref(true)
    const bulkRetrying = ref(false)
    const bulkDeleting = ref(false)
    const retryingId = ref(null)
    let stopPoll = null

    const analyzingList = computed(() => splitPending(pendingList).analyzing)
    const failedList = computed(() => splitPending(pendingList).failed)
    const allDone = computed(() => !loading.value && pendingList.length === 0)

    const applyList = (list) => {
      pendingList.splice(0, pendingList.length, ...(list || []))
      loading.value = false
    }

    const loadPending = async () => {
      try {
        applyList(await fetchPendingQuestions())
      } catch (e) {
        showToast((e && e.message) || '加载失败')
        loading.value = false
      }
    }

    const retryQuestion = async (id) => {
      if (!id || retryingId.value) return
      retryingId.value = id
      showLoadingToast({ message: '重新排队…', forbidClick: true })
      try {
        const res = await apiClient.post(`/questions/${id}/retry-ai`)
        closeToast()
        if (res.data && res.data.success === false) {
          showToast(res.data.message || '重试失败')
          return
        }
        showToast('已重新排队')
        await loadPending()
      } catch (e) {
        closeToast()
        showToast(e.response?.data?.message || '重试失败')
      } finally {
        retryingId.value = null
      }
    }

    const deleteQuestion = async (item) => {
      try {
        await showConfirmDialog({
          title: '删除题目',
          message: '这道题会从错题本移除，删除后无法恢复。'
        })
      } catch {
        return
      }
      showLoadingToast({ message: '删除中…', forbidClick: true })
      try {
        await apiClient.delete(`/questions/${item.id}`)
        closeToast()
        showToast('已删除')
        await loadPending()
      } catch {
        closeToast()
        showToast('删除失败')
      }
    }

    const retryAll = async () => {
      const ids = failedList.value.map((q) => q.id)
      if (!ids.length) return
      bulkRetrying.value = true
      try {
        await Promise.all(ids.map((id) => apiClient.post(`/questions/${id}/retry-ai`)))
        await loadPending()
        showToast(`已重新排队 ${ids.length} 道`)
      } catch {
        showToast('部分重试失败，请再试一次')
        await loadPending()
      } finally {
        bulkRetrying.value = false
      }
    }

    const deleteAll = async () => {
      const ids = failedList.value.map((q) => q.id)
      if (!ids.length) return
      try {
        await showConfirmDialog({
          title: '删除全部失败题目',
          message: `将删除 ${ids.length} 道解析失败的题目，删除后无法恢复。`
        })
      } catch {
        return
      }
      bulkDeleting.value = true
      try {
        await Promise.all(ids.map((id) => apiClient.delete(`/questions/${id}`)))
        await loadPending()
        showToast(`已删除 ${ids.length} 道`)
      } catch {
        showToast('部分删除失败，请再试一次')
        await loadPending()
      } finally {
        bulkDeleting.value = false
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
      analyzingList,
      failedList,
      loading,
      allDone,
      bulkRetrying,
      bulkDeleting,
      retryingId,
      retryQuestion,
      deleteQuestion,
      retryAll,
      deleteAll,
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

.section {
  margin-bottom: 24px;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.section-title {
  font-size: 15px;
  font-weight: 800;
  color: #2459ff;
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.section-title.failed {
  color: #e11d48;
}

.section-count {
  font-size: 12px;
  font-weight: 600;
  color: rgba(11, 22, 51, 0.45);
}

.section-actions {
  display: flex;
  gap: 8px;
}

.section-hint {
  font-size: 12px;
  color: rgba(11, 22, 51, 0.45);
  margin: 0 0 12px;
  line-height: 1.5;
}

.question-item {
  background: #fff;
  border: 1px solid rgba(11, 22, 51, 0.06);
  border-radius: 18px;
  padding: 16px;
  box-shadow: 0 12px 36px rgba(11, 22, 51, 0.06);
  margin-bottom: 14px;
}

.failed-item {
  border-color: rgba(225, 29, 72, 0.22);
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

.item-error {
  font-size: 12px;
  color: rgba(225, 29, 72, 0.85);
  background: rgba(225, 29, 72, 0.06);
  border-radius: 8px;
  padding: 8px 10px;
  margin: 0 0 12px;
  line-height: 1.5;
  word-break: break-all;
}

.status-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.row-actions {
  display: flex;
  gap: 8px;
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
  color: #e11d48;
  font-weight: 700;
}

.failed-row {
  justify-content: space-between;
}
</style>
