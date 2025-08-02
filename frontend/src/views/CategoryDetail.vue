<template>
  <div class="category-detail-page">
    <!-- 顶部导航 -->
    <van-nav-bar 
      :title="categoryInfo.name" 
      left-arrow 
      @click-left="$router.back()"
      fixed
      placeholder
    >
      <template #right>
        <van-icon name="share-o" @click="shareCategory" />
      </template>
    </van-nav-bar>

    <!-- 分类信息卡片 -->
    <div class="category-info-section">
      <div class="category-info-card">
        <div class="info-header">
          <div class="category-icon">
            <van-icon :name="categoryInfo.icon" :color="categoryInfo.color" size="32" />
          </div>
          <div class="info-details">
            <h2 class="category-name">{{ categoryInfo.name }}</h2>
            <p class="category-desc">{{ categoryInfo.description }}</p>
            <div class="category-stats">
              <span class="stat">{{ questions.length }} 道题目</span>
              <span class="stat">正确率 {{ accuracy }}%</span>
            </div>
          </div>
        </div>
        
        <!-- 操作按钮 -->
        <div class="action-buttons">
          <van-button type="primary" size="small" @click="startPractice">
            开始练习
          </van-button>
          <van-button type="default" size="small" @click="addToExam">
            加入组卷
          </van-button>
        </div>
      </div>
    </div>

    <!-- 筛选和排序 -->
    <div class="filter-section">
      <van-dropdown-menu>
        <van-dropdown-item v-model="sortBy" :options="sortOptions" />
        <van-dropdown-item v-model="filterBy" :options="filterOptions" />
      </van-dropdown-menu>
    </div>

    <!-- 题目列表 -->
    <div class="questions-section">
      <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
        <van-list
          v-model:loading="loading"
          :finished="finished"
          @load="onLoadMore"
        >
          <div 
            v-for="question in filteredQuestions" 
            :key="question.id"
            class="question-card"
            @click="viewQuestion(question)"
          >
            <!-- 题目内容 -->
            <div class="question-content">
              <!-- 题目图片 -->
              <div v-if="question.imageUrl" class="question-image-container">
                <img 
                  :src="question.imageUrl" 
                  alt="题目图片"
                  class="question-image"
                  @click.stop="previewImage(question.imageUrl)"
                />
              </div>
              
              <!-- 识别的文字 -->
              <div class="question-text">
                <p>{{ question.recognizedText }}</p>
              </div>
              
              <!-- 标签 -->
              <div class="question-tags" v-if="question.tags && question.tags.length">
                <van-tag 
                  v-for="tag in question.tags" 
                  :key="tag"
                  size="mini"
                  class="custom-tag"
                >
                  {{ tag }}
                </van-tag>
              </div>
            </div>

            <!-- 题目元信息 -->
            <div class="question-meta">
              <div class="meta-left">
                <span class="difficulty" :class="'difficulty-' + question.difficulty">
                  {{ getDifficultyText(question.difficulty) }}
                </span>
                <span class="confidence">
                  置信度: {{ Math.round(question.confidence * 100) }}%
                </span>
              </div>
              <div class="meta-right">
                <span class="add-time">{{ formatTime(question.createdAt) }}</span>
                <van-checkbox 
                  v-model="question.selected"
                  @click.stop="toggleSelection(question)"
                />
              </div>
            </div>
          </div>

          <!-- 空状态 -->
          <van-empty 
            v-if="!loading && filteredQuestions.length === 0" 
            description="该分类暂无题目"
            image="search"
          />
        </van-list>
      </van-pull-refresh>
    </div>

    <!-- 批量操作栏 -->
    <div v-if="selectedQuestions.length > 0" class="batch-actions">
      <div class="batch-info">
        已选择 {{ selectedQuestions.length }} 道题
      </div>
      <div class="batch-buttons">
        <van-button size="small" @click="batchAddToExam">批量组卷</van-button>
        <van-button size="small" type="danger" @click="batchDelete">删除</van-button>
      </div>
    </div>

    <!-- 浮动操作按钮 -->
    <van-floating-bubble 
      axis="xy" 
      v-model:offset="floatOffset"
      @click="$router.push('/camera')"
    >
      <van-icon name="plus" size="24" />
    </van-floating-bubble>
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Toast, Dialog, ImagePreview } from 'vant'

export default {
  name: 'CategoryDetail',
  setup() {
    const route = useRoute()
    const router = useRouter()
    
    const categoryId = route.params.id
    const refreshing = ref(false)
    const loading = ref(false)
    const finished = ref(false)
    const sortBy = ref('latest')
    const filterBy = ref('all')
    const floatOffset = reactive({ x: 16, y: 100 })

    const categoryInfo = reactive({
      id: '',
      name: '',
      description: '',
      icon: 'apps-o',
      color: '#1976d2'
    })

    const questions = reactive([])

    // 排序选项
    const sortOptions = [
      { text: '最新添加', value: 'latest' },
      { text: '最早添加', value: 'earliest' },
      { text: '置信度高', value: 'confidence' },
      { text: '难度高', value: 'difficulty' }
    ]

    // 筛选选项
    const filterOptions = [
      { text: '全部', value: 'all' },
      { text: '简单', value: 'easy' },
      { text: '中等', value: 'medium' },
      { text: '困难', value: 'hard' }
    ]

    // 计算属性
    const filteredQuestions = computed(() => {
      let filtered = [...questions]
      
      // 筛选
      if (filterBy.value !== 'all') {
        filtered = filtered.filter(q => q.difficulty === filterBy.value)
      }
      
      // 排序
      switch (sortBy.value) {
        case 'latest':
          filtered.sort((a, b) => b.createdAt - a.createdAt)
          break
        case 'earliest':
          filtered.sort((a, b) => a.createdAt - b.createdAt)
          break
        case 'confidence':
          filtered.sort((a, b) => b.confidence - a.confidence)
          break
        case 'difficulty':
          const difficultyOrder = { 'hard': 3, 'medium': 2, 'easy': 1 }
          filtered.sort((a, b) => difficultyOrder[b.difficulty] - difficultyOrder[a.difficulty])
          break
      }
      
      return filtered
    })

    const selectedQuestions = computed(() => {
      return questions.filter(q => q.selected)
    })

    const accuracy = computed(() => {
      if (questions.length === 0) return 0
      const correctCount = questions.filter(q => q.isCorrect).length
      return Math.round((correctCount / questions.length) * 100)
    })

    // 获取难度文本
    const getDifficultyText = (difficulty) => {
      const difficultyMap = {
        'easy': '简单',
        'medium': '中等',
        'hard': '困难'
      }
      return difficultyMap[difficulty] || '未知'
    }

    // 格式化时间
    const formatTime = (timestamp) => {
      const date = new Date(timestamp)
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString().slice(0, 5)
    }

    // 刷新数据
    const onRefresh = async () => {
      refreshing.value = true
      try {
        await loadCategoryInfo()
        await loadQuestions()
      } finally {
        refreshing.value = false
      }
    }

    // 加载更多
    const onLoadMore = async () => {
      if (finished.value) return
      
      loading.value = true
      try {
        await new Promise(resolve => setTimeout(resolve, 1000))
        finished.value = true
      } finally {
        loading.value = false
      }
    }

    // 查看题目详情
    const viewQuestion = (question) => {
      // 这里可以打开题目详情弹窗或跳转到详情页
      Toast(`查看题目: ${question.id}`)
    }

    // 预览图片
    const previewImage = (imageUrl) => {
      ImagePreview([imageUrl])
    }

    // 切换选择
    const toggleSelection = (question) => {
      question.selected = !question.selected
    }

    // 开始练习
    const startPractice = () => {
      if (questions.length === 0) {
        Toast('该分类暂无题目')
        return
      }
      Toast('开始练习功能待实现')
    }

    // 加入组卷
    const addToExam = () => {
      const selectedCount = selectedQuestions.value.length
      if (selectedCount === 0) {
        Toast('请先选择题目')
        return
      }
      
      // 跳转到组卷页面，携带选中的题目
      router.push({
        path: '/paper-builder',
        query: {
          questions: selectedQuestions.value.map(q => q.id).join(','),
          category: categoryId
        }
      })
    }

    // 批量加入组卷
    const batchAddToExam = () => {
      addToExam()
    }

    // 批量删除
    const batchDelete = async () => {
      try {
        await Dialog.confirm({
          title: '确认删除',
          message: `确定要删除选中的 ${selectedQuestions.value.length} 道题目吗？`,
        })
        
        // 执行删除
        const selectedIds = selectedQuestions.value.map(q => q.id)
        questions.splice(0, questions.length, ...questions.filter(q => !selectedIds.includes(q.id)))
        
        Toast.success('删除成功')
      } catch (error) {
        // 用户取消删除
      }
    }

    // 分享分类
    const shareCategory = () => {
      Toast('分享功能待实现')
    }

    // 加载分类信息
    const loadCategoryInfo = async () => {
      try {
        // 模拟API调用
        const mockInfo = {
          id: categoryId,
          name: '数学-二次函数',
          description: '关于二次函数的图像、性质等问题',
          icon: 'chart-trending-o',
          color: '#1976d2'
        }
        
        Object.assign(categoryInfo, mockInfo)
      } catch (error) {
        console.error('加载分类信息失败:', error)
      }
    }

    // 加载题目列表
    const loadQuestions = async () => {
      try {
        // 模拟API调用
        const mockQuestions = [
          {
            id: 1,
            recognizedText: '已知函数f(x) = x² - 2x + 1，求f(x)的最小值。',
            imageUrl: 'https://via.placeholder.com/300x200?text=Math+Question+1',
            tags: ['二次函数', '最值', '配方法'],
            difficulty: 'medium',
            confidence: 0.95,
            createdAt: Date.now() - 3600000,
            isCorrect: true,
            selected: false
          },
          {
            id: 2,
            recognizedText: '求函数y = x² + 4x + 3的顶点坐标。',
            imageUrl: 'https://via.placeholder.com/300x200?text=Math+Question+2',
            tags: ['二次函数', '顶点', '坐标'],
            difficulty: 'easy',
            confidence: 0.88,
            createdAt: Date.now() - 7200000,
            isCorrect: false,
            selected: false
          },
          {
            id: 3,
            recognizedText: '已知抛物线y = ax² + bx + c经过点(1,0), (2,0), (0,2)，求a, b, c的值。',
            imageUrl: 'https://via.placeholder.com/300x200?text=Math+Question+3',
            tags: ['二次函数', '待定系数法', '抛物线'],
            difficulty: 'hard',
            confidence: 0.82,
            createdAt: Date.now() - 86400000,
            isCorrect: true,
            selected: false
          }
        ]
        
        questions.splice(0, questions.length, ...mockQuestions)
      } catch (error) {
        console.error('加载题目失败:', error)
      }
    }

    // 组件挂载时加载数据
    onMounted(() => {
      loadCategoryInfo()
      loadQuestions()
    })

    return {
      categoryInfo,
      questions,
      filteredQuestions,
      selectedQuestions,
      accuracy,
      refreshing,
      loading,
      finished,
      sortBy,
      filterBy,
      sortOptions,
      filterOptions,
      floatOffset,
      getDifficultyText,
      formatTime,
      onRefresh,
      onLoadMore,
      viewQuestion,
      previewImage,
      toggleSelection,
      startPractice,
      addToExam,
      batchAddToExam,
      batchDelete,
      shareCategory
    }
  }
}
</script>

<style scoped>
.category-detail-page {
  min-height: 100vh;
  background: var(--bg-primary);
  padding-bottom: 60px;
  position: relative;
}

/* 🌟 页面背景光效 */
.category-detail-page::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: 
    radial-gradient(circle 400px at 20% 30%, rgba(232, 168, 85, 0.04) 0%, transparent 50%),
    radial-gradient(circle 300px at 80% 70%, rgba(244, 190, 126, 0.03) 0%, transparent 50%);
  animation: floatingGlow 30s ease-in-out infinite;
  pointer-events: none;
  z-index: -1;
}

.category-info-section {
  padding: 20px;
}

.category-info-card {
  position: relative;
  background: var(--bg-card);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-xl);
  padding: 24px;
  box-shadow: 
    var(--shadow-glow),
    var(--shadow-inner),
    var(--shadow-card);
  overflow: hidden;
}

.category-info-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, 
    var(--primary-color) 0%, 
    var(--primary-light) 50%,
    var(--accent-color) 100%
  );
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
}

.info-header {
  display: flex;
  margin-bottom: 16px;
}

.category-icon {
  margin-right: 16px;
  padding: 12px;
  background: #f5f5f5;
  border-radius: 12px;
  align-self: flex-start;
}

.info-details {
  flex: 1;
}

.category-name {
  font-size: 20px;
  font-weight: bold;
  color: var(--text-primary);
  margin: 0 0 8px 0;
  background: linear-gradient(135deg, var(--text-primary), var(--text-accent));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.category-desc {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0 0 12px 0;
  line-height: 1.4;
}

.category-stats {
  display: flex;
  gap: 16px;
}

.stat {
  font-size: 13px;
  color: #999;
  padding: 4px 8px;
  background: #f5f5f5;
  border-radius: 12px;
}

.action-buttons {
  display: flex;
  gap: 12px;
}

.filter-section {
  background: var(--bg-glass);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border-color);
  box-shadow: var(--shadow-glow);
}

.questions-section {
  padding: 20px;
}

.question-card {
  position: relative;
  background: var(--bg-card);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: 
    var(--shadow-glow),
    var(--shadow-inner),
    var(--shadow-card);
  cursor: pointer;
  transition: all 0.3s var(--ease-smooth);
  overflow: hidden;
}

.question-card::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, 
    var(--primary-color) 0%, 
    var(--primary-light) 50%,
    var(--accent-color) 100%
  );
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  opacity: 0.7;
}

.question-card:hover {
  border-color: var(--border-glow);
  box-shadow: 
    0 0 30px rgba(232, 168, 85, 0.12),
    var(--shadow-inner),
    var(--shadow-hover);
  transform: translateY(-4px);
}

.question-image-container {
  margin-bottom: 12px;
}

.question-image {
  width: 100%;
  max-height: 200px;
  object-fit: contain;
  border-radius: 8px;
  cursor: pointer;
}

.question-text {
  margin-bottom: 12px;
}

.question-text p {
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-primary);
  margin: 0;
}

.question-tags {
  margin-bottom: 12px;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.question-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid #f5f5f5;
  padding-top: 12px;
}

.meta-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.difficulty {
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 4px;
  color: white;
}

.difficulty-easy {
  background: #4caf50;
}

.difficulty-medium {
  background: #ff9800;
}

.difficulty-hard {
  background: #f44336;
}

.confidence {
  font-size: 12px;
  color: #999;
}

.meta-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.add-time {
  font-size: 12px;
  color: var(--text-secondary);
}

/* 自定义标签样式 */
.custom-tag {
  background: rgba(232, 168, 85, 0.15) !important;
  color: var(--text-accent) !important;
  border: 1px solid rgba(232, 168, 85, 0.3) !important;
  border-radius: var(--radius-sm) !important;
}

.batch-actions {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--bg-glass);
  backdrop-filter: blur(12px);
  border-top: 1px solid var(--border-color);
  padding: 16px 20px;
  box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.3);
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 100;
}

.batch-info {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 500;
}

.batch-buttons {
  display: flex;
  gap: 8px;
}
</style>