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
        <div class="nav-actions">
          <span 
            v-if="editMode" 
            class="nav-action" 
            @click="toggleSelectAll"
          >
            {{ isAllSelected ? '取消全选' : '全选' }}
          </span>
          <span class="nav-action" @click="toggleEditMode">{{ editMode ? '完成' : '编辑' }}</span>
          <van-icon name="share-o" @click="shareCategory" />
        </div>
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
        <van-dropdown-item v-model="knowledgePointFilter" :options="knowledgePointOptions" />
      </van-dropdown-menu>
    </div>

    <!-- 知识点分组展示 -->
    <div v-if="groupByKnowledgePoint && knowledgePointGroups.length > 0" class="knowledge-points-section">
      <div v-for="group in knowledgePointGroups" :key="group.name" class="knowledge-point-group">
        <div class="group-header" @click="toggleGroup(group.name)">
          <van-icon :name="group.expanded ? 'arrow-down' : 'arrow'" />
          <span class="group-title">{{ group.name }}</span>
          <span class="group-count">{{ group.questions.length }}题</span>
        </div>
        
        <div v-show="group.expanded" class="group-questions">
          <div 
            v-for="question in group.questions" 
            :key="question.id"
            class="question-card"
            @click="editMode ? toggleSelection(question) : viewQuestion(question)"
          >
            <!-- 题目内容 -->
            <div class="question-content">
              <!-- 题目图片 - 只在有有效图片URL时显示 -->
              <div v-if="question.imageUrl && question.imageUrl.trim() && !question.imageUrl.includes('placeholder')" class="question-image-container">
                <img 
                  :src="question.imageUrl" 
                  alt="题目图片"
                  class="question-image"
                  @click.stop="previewImage(question.imageUrl)"
                  @error="onImageError"
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
                <span class="add-time">{{ formatTime(question.createdAt) }}</span>
              </div>
              <div class="meta-right" v-if="editMode">
                <van-checkbox 
                  v-model="question.selected"
                  @click.stop="toggleSelection(question)"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 题目列表 - 只在非分组模式下显示 -->
    <div v-if="!groupByKnowledgePoint || knowledgePointGroups.length === 0" class="questions-section">
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
            @click="editMode ? toggleSelection(question) : viewQuestion(question)"
          >
            <!-- 题目内容 -->
            <div class="question-content">
              <!-- 题目图片 - 只在有有效图片URL时显示 -->
              <div v-if="question.imageUrl && question.imageUrl.trim() && !question.imageUrl.includes('placeholder')" class="question-image-container">
                <img 
                  :src="question.imageUrl" 
                  alt="题目图片"
                  class="question-image"
                  @click.stop="previewImage(question.imageUrl)"
                  @error="onImageError"
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
                <span class="add-time">{{ formatTime(question.createdAt) }}</span>
              </div>
              <div class="meta-right" v-if="editMode">
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
    <div v-if="editMode && selectedQuestions.length > 0" class="batch-actions">
      <div class="batch-info">
        已选择 {{ selectedQuestions.length }} 道题
      </div>
      <div class="batch-buttons">
        <van-button size="small" @click="batchAddToExam">批量组卷</van-button>
        <van-button size="small" type="danger" @click="batchDelete">删除</van-button>
      </div>
    </div>


  </div>
</template>

<script>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast, showDialog, showConfirmDialog, ImagePreview } from 'vant'
import categoryAPI from '../api/category'

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
    const knowledgePointFilter = ref('all')
    const groupByKnowledgePoint = ref(true)
    const expandedGroups = reactive(new Set())
    const editMode = ref(false)
    const isAllSelected = computed(() => questions.length > 0 && questions.every(q => q.selected))


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

    // 知识点筛选选项（动态生成）
    const knowledgePointOptions = computed(() => {
      const knowledgePoints = new Set()
      questions.forEach(question => {
        if (question.tags && question.tags.length > 0) {
          question.tags.forEach(tag => knowledgePoints.add(tag))
        }
      })
      
      const options = [{ text: '全部知识点', value: 'all' }]
      Array.from(knowledgePoints).forEach(point => {
        options.push({ text: point, value: point })
      })
      return options
    })

    // 计算属性
    const filteredQuestions = computed(() => {
      let filtered = [...questions]
      
      // 筛选
      if (filterBy.value !== 'all') {
        filtered = filtered.filter(q => q.difficulty === filterBy.value)
      }

      // 知识点筛选
      if (knowledgePointFilter.value !== 'all') {
        filtered = filtered.filter(q => 
          q.tags && q.tags.includes(knowledgePointFilter.value)
        )
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

    // 知识点分组
    const knowledgePointGroups = computed(() => {
      if (!groupByKnowledgePoint.value) return []
      
      const groups = new Map()
      const filtered = filteredQuestions.value
      
      filtered.forEach(question => {
        let knowledgePoints = []
        
        // 从标签中提取知识点
        if (question.tags && question.tags.length > 0) {
          knowledgePoints = question.tags
        } else {
          // 如果没有标签，尝试从题目内容中智能提取知识点
          knowledgePoints = extractKnowledgePointsFromContent(question.recognizedText)
        }
        
        // 如果仍然没有知识点，归类到"其他"
        if (knowledgePoints.length === 0) {
          knowledgePoints = ['其他']
        }
        
        // 为每个知识点创建分组
        knowledgePoints.forEach(point => {
          if (!groups.has(point)) {
            groups.set(point, {
              name: point,
              questions: [],
              expanded: expandedGroups.has(point)
            })
          }
          groups.get(point).questions.push(question)
        })
      })
      
      // 转换为数组并排序
      const result = Array.from(groups.values())
      result.sort((a, b) => b.questions.length - a.questions.length) // 按题目数量排序
      
      // 确保所有分组都有正确的展开状态
      result.forEach(group => {
        group.expanded = expandedGroups.has(group.name)
      })
      
      // 默认展开前3个分组（如果还没有任何展开的分组）
      if (expandedGroups.size === 0) {
        result.slice(0, 3).forEach(group => {
          expandedGroups.add(group.name)
          group.expanded = true
        })
      }
      
      return result
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
      const formatRichText = (text) => {
        return (text || '暂无内容').replace(/\n/g, '<br/>')
      }
      const content = formatRichText(question.recognizedText || question.text || question.content)
      const answer = formatRichText(question.aiAnswer || '待补充')
      const analysis = formatRichText(question.aiAnalysis || 'AI暂未给出解析')

      showDialog({
        title: `题目 #${question.id}`,
        message: `
          <div class="dialog-section">
            <div class="dialog-section__title">题目内容</div>
            <div class="dialog-section__body">${content}</div>
          </div>
          <div class="dialog-section">
            <div class="dialog-section__title">参考答案</div>
            <div class="dialog-section__body">${answer}</div>
          </div>
          <div class="dialog-section">
            <div class="dialog-section__title">解析</div>
            <div class="dialog-section__body">${analysis}</div>
          </div>
          ${question.tags.length > 0 ? `
            <div class="dialog-section">
              <div class="dialog-section__title">标签</div>
              <div class="dialog-section__body">${question.tags.join(', ')}</div>
            </div>` : ''}
          <div class="dialog-section">
            <div class="dialog-section__title">添加时间</div>
            <div class="dialog-section__body">${formatTime(question.createdAt)}</div>
          </div>
        `,
        allowHtml: true,
        confirmButtonText: '关闭',
        className: 'question-detail-dialog',
        width: '90%'
      }).catch(() => {
        // 用户关闭弹窗
      })
    }

    // 预览图片
    const previewImage = (imageUrl) => {
      ImagePreview([imageUrl])
    }

    // 图片加载错误处理
    const onImageError = (event) => {
      console.log('图片加载失败:', event.target.src)
      // 隐藏失败的图片容器
      event.target.parentElement.style.display = 'none'
    }

    // 从题目内容中智能提取知识点
    const extractKnowledgePointsFromContent = (content) => {
      if (!content) return []
      
      const knowledgePointKeywords = {
        '函数': ['函数', 'f(x)', 'y='],
        '圆锥曲线': ['抛物线', '椭圆', '双曲线', '圆', '焦点', '顶点'],
        '三角函数': ['sin', 'cos', 'tan', '正弦', '余弦', '正切'],
        '数列': ['数列', '等差', '等比', 'a_n', 'an'],
        '导数': ['导数', '导函数', '切线', '极值', '最值'],
        '概率': ['概率', '随机', '分布', '期望', '方差'],
        '立体几何': ['立体', '几何体', '体积', '表面积', '空间'],
        '平面几何': ['三角形', '四边形', '圆形', '角度', '面积']
      }
      
      const extractedPoints = []
      Object.entries(knowledgePointKeywords).forEach(([point, keywords]) => {
        if (keywords.some(keyword => content.includes(keyword))) {
          extractedPoints.push(point)
        }
      })
      
      return extractedPoints
    }

    // 切换分组展开/收缩
    const toggleGroup = (groupName) => {
      console.log('toggleGroup called:', groupName)
      
      if (expandedGroups.has(groupName)) {
        expandedGroups.delete(groupName)
      } else {
        expandedGroups.add(groupName)
      }
      
      console.log('expandedGroups after toggle:', Array.from(expandedGroups))
      
      // 强制更新响应式数据
      knowledgePointGroups.value.forEach(group => {
        if (group.name === groupName) {
          group.expanded = expandedGroups.has(groupName)
        }
      })
    }

    // 切换选择
    const toggleSelection = (question) => {
      question.selected = !question.selected
    }

    const toggleEditMode = () => {
      editMode.value = !editMode.value
      if (!editMode.value) {
        questions.forEach(q => (q.selected = false))
      }
    }

    const toggleSelectAll = () => {
      const target = !isAllSelected.value
      questions.forEach(q => (q.selected = target))
    }
    // 开始练习
    const startPractice = () => {
      if (questions.length === 0) {
        showToast('该分类暂无题目')
        return
      }
      showToast('开始练习功能待实现')
    }

    // 加入组卷
    const addToExam = () => {
      const selectedCount = selectedQuestions.value.length
      if (selectedCount === 0) {
        showToast('请先选择题目')
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
        await showConfirmDialog({
          title: '确认删除',
          message: `确定要删除选中的 ${selectedQuestions.value.length} 道题目吗？`,
        })
        
        const selectedIds = selectedQuestions.value.map(q => q.id)
        const response = await categoryAPI.batchDeleteQuestions(selectedIds)
        if (!response.success) {
          showToast(response.message || '删除失败')
          return
        }
        questions.splice(0, questions.length, ...questions.filter(q => !selectedIds.includes(q.id)))
        
        showToast({ message: '删除成功', type: 'success' })
      } catch (error) {
        // 用户取消删除
      }
    }

    // 分享分类
    const shareCategory = () => {
      showToast('分享功能待实现')
    }

    // 加载分类信息
    const loadCategoryInfo = async () => {
      try {
        console.log('开始加载分类信息，categoryId:', categoryId)
        // 调用API获取所有分类，然后找到当前分类
        const response = await categoryAPI.getCategories()
        console.log('分类API响应:', response)
        
        if (response.success && response.data && response.data.data) {
          const category = response.data.data.find(cat => cat.id == categoryId)
          if (category) {
            const categoryData = {
              id: category.id,
              name: category.name || '未知分类',
              description: category.description || '暂无描述',
              icon: category.icon || 'apps-o',
              color: category.color || '#E8A855'
            }
            Object.assign(categoryInfo, categoryData)
            console.log('成功加载分类信息:', categoryData)
          } else {
            console.error('未找到指定分类:', categoryId)
            showToast('分类不存在')
          }
        } else {
          console.error('获取分类信息失败:', response)
          showToast('获取分类信息失败')
        }
      } catch (error) {
        console.error('加载分类信息失败:', error)
        showToast('加载分类信息失败')
      }
    }

    // 加载题目列表
    const loadQuestions = async () => {
      try {
        console.log('开始加载分类题目，categoryId:', categoryId)
        // 调用API获取特定分类的题目
        const response = await categoryAPI.getCategoryQuestions(categoryId)
        console.log('题目API响应:', response)
        
        if (response.success && response.data && response.data.data) {
          const apiQuestions = response.data.data.map(question => ({
            id: question.id,
            recognizedText: question.content || question.recognizedText || '暂无内容',
            imageUrl: question.imageUrl || '',
            aiAnswer: question.aiAnswer || '待补充',
            aiAnalysis: question.aiAnalysis || 'AI暂未给出解析',
            tags: (() => {
              if (!question.tags) return [];
              if (typeof question.tags === 'string') {
                return question.tags.split(',').filter(tag => tag.trim());
              }
              if (Array.isArray(question.tags)) {
                return question.tags;
              }
              return [];
            })(),
            difficulty: question.difficulty || 'medium',
            confidence: question.aiConfidence || 0.85,
            createdAt: new Date(question.createdAt).getTime(),
            isCorrect: false, // 默认值，如果需要可以从API获取
            selected: false
          }))
          
          questions.splice(0, questions.length, ...apiQuestions)
          console.log('成功加载题目数据:', apiQuestions)
        } else {
          console.log('该分类暂无题目，响应:', response)
          questions.splice(0, questions.length) // 清空数组
        }
      } catch (error) {
        console.error('加载题目失败:', error)
        showToast('加载题目失败')
        questions.splice(0, questions.length) // 清空数组
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
      knowledgePointFilter,
      groupByKnowledgePoint,
      sortOptions,
      filterOptions,
      knowledgePointOptions,
      knowledgePointGroups,
      editMode,
      isAllSelected,
      getDifficultyText,
      formatTime,
      onRefresh,
      onLoadMore,
      viewQuestion,
      previewImage,
      onImageError,
      toggleSelection,
      toggleEditMode,
      toggleSelectAll,
      toggleGroup,
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
  padding-bottom: 20px;
  position: relative;
}

.nav-action {
  margin-right: 12px;
  color: var(--primary-color);
  font-size: 14px;
}

:deep(.question-detail-dialog) {
  width: 90% !important;
  max-width: 560px;
}

:deep(.question-detail-dialog .van-dialog__message) {
  max-height: 70vh;
  overflow-y: auto;
  text-align: left;
}

.dialog-section {
  margin-bottom: 16px;
}

.dialog-section__title {
  font-weight: 600;
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.dialog-section__body {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 12px;
  line-height: 1.6;
  color: var(--text-primary);
  word-break: break-word;
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: 8px;
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

.question-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 100%;
  background: linear-gradient(180deg, var(--primary-color), var(--primary-light));
  border-radius: var(--radius-lg) 0 0 var(--radius-lg);
  box-shadow: 0 0 8px rgba(232, 168, 85, 0.5);
}

.question-card:hover {
  border-color: var(--border-glow);
  box-shadow: 
    0 0 40px rgba(232, 168, 85, 0.15),
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
  flex: 1;
}



.meta-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.add-time {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
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

/* 知识点分组样式 */
.knowledge-points-section {
  padding: 0 20px 20px;
}

.knowledge-point-group {
  margin-bottom: 24px;
}

.group-header {
  display: flex;
  align-items: center;
  padding: 16px 20px;
  background: var(--bg-card);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  margin-bottom: 12px;
  cursor: pointer;
  transition: all 0.3s var(--ease-smooth);
  box-shadow: 
    var(--shadow-glow),
    var(--shadow-inner),
    var(--shadow-card);
  position: relative;
  overflow: hidden;
}

.group-header::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 100%;
  background: linear-gradient(180deg, var(--primary-color), var(--primary-light));
  border-radius: var(--radius-lg) 0 0 var(--radius-lg);
  box-shadow: 0 0 8px rgba(232, 168, 85, 0.5);
}

.group-header:hover {
  border-color: var(--border-glow);
  box-shadow: 
    0 0 30px rgba(232, 168, 85, 0.15),
    var(--shadow-inner),
    var(--shadow-hover);
  transform: translateY(-2px);
}

.group-header .van-icon {
  margin-right: 12px;
  color: var(--primary-color);
  transition: transform 0.3s var(--ease-smooth);
}

.group-header .van-icon[name="arrow-down"] {
  transform: rotate(90deg);
}

.group-title {
  flex: 1;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  background: linear-gradient(135deg, var(--text-primary), var(--text-accent));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.group-count {
  font-size: 14px;
  color: var(--text-secondary);
  background: rgba(232, 168, 85, 0.1);
  padding: 4px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(232, 168, 85, 0.2);
  font-weight: 500;
}

.group-questions {
  padding-left: 20px;
  position: relative;
}

.group-questions::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 2px;
  background: linear-gradient(180deg, 
    rgba(232, 168, 85, 0.3) 0%, 
    rgba(232, 168, 85, 0.1) 50%,
    transparent 100%
  );
  border-radius: 1px;
}

.group-questions .question-card {
  margin-bottom: 12px;
  margin-left: 12px;
  position: relative;
}

.group-questions .question-card::after {
  content: '';
  position: absolute;
  left: -14px;
  top: 50%;
  transform: translateY(-50%);
  width: 6px;
  height: 6px;
  background: var(--primary-color);
  border-radius: 50%;
  box-shadow: 0 0 8px rgba(232, 168, 85, 0.6);
}
</style>