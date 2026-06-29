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
          <van-button v-if="!isPaperSelectMode" type="primary" size="small" @click="startPractice">
            开始练习
          </van-button>
          <van-button :type="isPaperSelectMode ? 'primary' : 'default'" size="small" @click="addToExam">
            {{ isPaperSelectMode ? '确认组卷' : '加入组卷' }}
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
      <div class="group-toggle">
        <span class="group-toggle-label">按知识点分组</span>
        <van-switch v-model="groupByKnowledgePoint" size="20px" />
      </div>
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
                <p>{{ question.displayContent || question.recognizedText }}</p>
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
                <span class="q-index">#{{ question.displayIndex }}</span>
                <span class="q-difficulty" :class="'diff-' + question.difficulty">{{ getDifficultyText(question.difficulty) }}</span>
                <span class="add-time">{{ formatTime(question.createdAt) }}</span>
              </div>
              <div class="meta-right" v-if="editMode">
                <van-checkbox 
                  v-model="question.selected"
                  @click.stop="toggleSelection(question)"
                />
              </div>
            </div>
            <van-button
              v-if="!editMode"
              size="mini"
              type="primary"
              plain
              class="ai-toggle-btn"
              @click.stop="openAIChat(question)"
            >
              AI答疑
            </van-button>
            <div v-if="question.showAI && !editMode" class="ai-box">
              <div class="ai-title">AI 标准答案与解析</div>
              <div class="ai-subtitle">标准答案：</div>
              <p class="ai-content" :class="{ 'detail-placeholder': question.aiPending && !question.hasAiAnswer }">
                {{ question.displayAiAnswer }}
              </p>
              <div class="ai-subtitle ai-subtitle-gap">智能解析：</div>
              <p class="ai-content" :class="{ 'detail-placeholder': question.aiPending && !question.hasAiAnalysis }">
                {{ question.displayAiAnalysis }}
              </p>
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
                <p>{{ question.displayContent || question.recognizedText }}</p>
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
                <span class="q-index">#{{ question.displayIndex }}</span>
                <span class="q-difficulty" :class="'diff-' + question.difficulty">{{ getDifficultyText(question.difficulty) }}</span>
                <span class="add-time">{{ formatTime(question.createdAt) }}</span>
              </div>
              <div class="meta-right" v-if="editMode">
                <van-checkbox 
                  v-model="question.selected"
                  @click.stop="toggleSelection(question)"
                />
              </div>
            </div>
            <van-button
              v-if="!editMode"
              size="mini"
              type="primary"
              plain
              class="ai-toggle-btn"
              @click.stop="openAIChat(question)"
            >
              AI答疑
            </van-button>
            <div v-if="question.showAI && !editMode" class="ai-box">
              <div class="ai-title">AI 标准答案与解析</div>
              <div class="ai-subtitle">标准答案：</div>
              <p class="ai-content" :class="{ 'detail-placeholder': question.aiPending && !question.hasAiAnswer }">
                {{ question.displayAiAnswer }}
              </p>
              <div class="ai-subtitle ai-subtitle-gap">智能解析：</div>
              <p class="ai-content" :class="{ 'detail-placeholder': question.aiPending && !question.hasAiAnalysis }">
                {{ question.displayAiAnalysis }}
              </p>
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
        <van-button size="small" type="primary" @click="savePaper">保存为试卷</van-button>
        <van-button size="small" type="danger" @click="batchDelete">删除</van-button>
      </div>
    </div>

    <!-- 题目详情弹窗（对齐小程序） -->
    <van-popup v-model:show="showDetailModal" position="bottom" round :style="{ height: '75%' }">
      <div v-if="detailQuestion" class="detail-modal">
        <div class="detail-modal-header">
          <span class="detail-modal-title">题目 #{{ detailQuestion.displayIndex }}</span>
          <van-icon name="cross" @click="showDetailModal = false" />
        </div>
        <div class="detail-modal-body">
          <img
            v-if="detailQuestion.imageUrl"
            :src="detailQuestion.imageUrl"
            class="detail-img"
            alt="题目图片"
            @click="previewImage(detailQuestion.imageUrl)"
          />
          <div class="detail-section">
            <div class="detail-section-title">题目内容</div>
            <div
              v-for="(para, idx) in detailQuestion.contentParas"
              :key="idx"
              class="detail-para"
            >
              <span v-if="para.sub" class="detail-para-label">（{{ para.label }}）</span>
              <p class="detail-section-body">{{ para.text }}</p>
            </div>
          </div>
          <div class="detail-section detail-section-ai">
            <div class="detail-section-title">AI 答案</div>
            <p
              class="detail-section-body"
              :class="{ 'detail-placeholder': detailQuestion.aiPending && !detailQuestion.hasAiAnswer }"
            >
              {{ detailQuestion.aiAnswer }}
            </p>
          </div>
          <div class="detail-section detail-section-ai">
            <div class="detail-section-title">AI 解析</div>
            <p
              class="detail-section-body"
              :class="{ 'detail-placeholder': detailQuestion.aiPending && !detailQuestion.hasAiAnalysis }"
            >
              {{ detailQuestion.aiAnalysis }}
            </p>
          </div>
          <div v-if="detailQuestion.tags?.length" class="detail-section">
            <div class="detail-section-title">标签</div>
            <van-tag v-for="tag in detailQuestion.tags" :key="tag" size="mini" class="custom-tag">{{ tag }}</van-tag>
          </div>
          <div class="detail-section">
            <div class="detail-section-title">添加时间</div>
            <p class="detail-section-body">{{ detailQuestion.formattedDate }}</p>
          </div>
        </div>
        <div class="detail-modal-footer">
          <van-button type="primary" block @click="openAIChat(detailQuestion)">AI 答疑</van-button>
        </div>
      </div>
    </van-popup>


  </div>
</template>

<script>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast, showDialog, showConfirmDialog, ImagePreview, Dialog } from 'vant'
import categoryAPI from '../api/category'
import paperAPI from '../api/paper'
import { apiClient } from '../api/config'
import {
  formatQuestionText,
  parseQuestionParas,
  buildAiDisplayText,
  isPendingQuestion
} from '../utils/questionFormat'

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
    const isPaperSelectMode = computed(() => route.query.mode === 'paper-select')
    const showDetailModal = ref(false)
    const detailQuestion = ref(null)


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

    const buildDetailQuestion = (question, index) => {
      const pending = isPendingQuestion(question)
      const hasAiAnswer = !!(question.aiAnswer && question.aiAnswer.trim() && question.aiAnswer !== '待补充')
      const hasAiAnalysis = !!(question.aiAnalysis && question.aiAnalysis.trim() && question.aiAnalysis !== 'AI暂未给出解析')
      const rawContent = question.recognizedText || question.content || '暂无内容'
      const formattedContent = formatQuestionText(rawContent)
      const contentParas = parseQuestionParas(formattedContent)
      return {
        ...question,
        displayIndex: index + 1,
        content: formattedContent,
        displayContent: formattedContent,
        contentParas: contentParas.length ? contentParas : [{ label: '', text: formattedContent, sub: false }],
        hasAiAnswer,
        hasAiAnalysis,
        aiPending: pending,
        displayAiAnswer: buildAiDisplayText(
          question.aiAnswer,
          pending,
          hasAiAnalysis ? '见下方解析' : '暂无 AI 答案',
          'AI 答案生成中…'
        ),
        displayAiAnalysis: buildAiDisplayText(
          question.aiAnalysis,
          pending,
          '暂无 AI 解析',
          'AI 解析生成中…'
        ),
        aiAnswer: buildAiDisplayText(
          question.aiAnswer,
          pending,
          hasAiAnalysis ? '见下方解析' : '暂无 AI 答案',
          'AI 答案生成中…'
        ),
        aiAnalysis: buildAiDisplayText(
          question.aiAnalysis,
          pending,
          '暂无 AI 解析',
          'AI 解析生成中…'
        ),
        formattedDate: formatTime(question.createdAt)
      }
    }

    // 查看题目详情（打开时拉取最新数据，确保 AI 答案/解析是最新的）
    const viewQuestion = async (question) => {
      const idx = questions.findIndex(q => q.id === question.id)
      detailQuestion.value = buildDetailQuestion(question, idx >= 0 ? idx : 0)
      showDetailModal.value = true

      try {
        const res = await apiClient.get(`/questions/${question.id}`)
        const fresh = res.data?.data
        if (fresh && showDetailModal.value && detailQuestion.value?.id === question.id) {
          const merged = {
            ...question,
            aiAnswer: fresh.aiAnswer || question.aiAnswer,
            aiAnalysis: fresh.aiAnalysis || question.aiAnalysis,
            aiStatus: fresh.aiStatus || question.aiStatus,
            tags: Array.isArray(fresh.tags) && fresh.tags.length ? fresh.tags : question.tags,
            difficulty: fresh.difficulty || question.difficulty
          }
          detailQuestion.value = buildDetailQuestion(merged, idx >= 0 ? idx : 0)
          // 同步更新列表中的题目，便于卡片内 AI 区域刷新
          if (idx >= 0) {
            questions[idx] = { ...questions[idx], ...merged }
          }
        }
      } catch (e) {
        // 忽略，沿用已有数据
      }
    }

    const openAIChat = (question) => {
      const content = question.content || question.recognizedText || question.displayContent || ''
      showDetailModal.value = false
      router.push({
        path: '/ai-chat',
        query: { context: encodeURIComponent(content) }
      })
    }

    const toggleShowAI = (question) => {
      question.showAI = !question.showAI
    }

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
      if (selectedQuestions.value.length === 0) {
        showToast('请先选择题目')
        return
      }

      // 组卷选题模式：确认组卷 → 直接保存为试卷（对齐小程序一步式确认）
      if (isPaperSelectMode.value) {
        savePaper()
        return
      }

      // 把选中题目的完整数据写入 sessionStorage，由 PaperBuilder 读取合并
      const incoming = selectedQuestions.value.map(q => ({
        id: q.id,
        content: q.recognizedText || q.content || '',
        answer: q.aiAnswer || '待补充',
        analysis: q.aiAnalysis || 'AI暂未给出解析',
        categoryId: categoryId,
        categoryName: categoryInfo.name,
        difficulty: q.difficulty || 'medium',
        tags: q.tags || []
      }))
      const existing = JSON.parse(sessionStorage.getItem('pendingPaperQuestions') || '[]')
      const merged = [...existing]
      incoming.forEach(q => {
        if (!merged.find(e => e.id === q.id)) merged.push(q)
      })
      sessionStorage.setItem('pendingPaperQuestions', JSON.stringify(merged))

      // 退出编辑模式后跳转
      editMode.value = false
      questions.forEach(q => (q.selected = false))
      showToast({ message: `已加入组卷 ${merged.length} 道`, type: 'success' })
      setTimeout(() => router.push('/paper-builder'), 800)
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

    // 保存为试卷
    const savePaper = () => {
      console.log('===== savePaper 开始执行 =====')
      console.log('selectedQuestions:', selectedQuestions.value)
      console.log('selectedQuestions 数量:', selectedQuestions.value.length)
      
      if (selectedQuestions.value.length === 0) {
        showToast('请先选择题目')
        return
      }
      
      // 创建输入框元素
      let inputValue = ''
      
      console.log('准备调用 showConfirmDialog...')
      
      try {
        const dialog = showConfirmDialog({
        title: '保存试卷',
        message: `
          <div style="text-align: left; padding: 20px 0;">
            <div style="margin-bottom: 8px; color: var(--text-secondary); font-size: 14px;">请输入试卷名称</div>
            <input 
              id="paper-title-input"
              type="text" 
              value="数学练习卷"
              placeholder="例如：数学第一次月考"
              style="
                width: 100%;
                padding: 12px;
                border: 1px solid rgba(31, 91, 255, 0.3);
                border-radius: 8px;
                font-size: 14px;
                background: rgba(255, 255, 255, 0.05);
                color: var(--text-primary);
                outline: none;
                box-sizing: border-box;
              "
            />
          </div>
        `,
        allowHtml: true,
        confirmButtonText: '保存',
        cancelButtonText: '取消',
        className: 'save-paper-dialog',
        beforeClose: (action) => {
          if (action === 'confirm') {
            const input = document.getElementById('paper-title-input')
            inputValue = input ? input.value : ''
            console.log('beforeClose - 获取到的值:', inputValue)
          }
          return true
        }
      })
      
      // 等待 DOM 渲染完成后聚焦输入框
      setTimeout(() => {
        const input = document.getElementById('paper-title-input')
        if (input) {
          input.focus()
          input.select()
        }
      }, 100)
      
      dialog.then(async () => {
        // 用户点击确定
        if (!inputValue || !inputValue.trim()) {
          showToast('请输入试卷名称')
          return
        }

        // 保存试卷（云端优先，失败回退本地）
        const { localOnly } = await paperAPI.savePaper(
          selectedQuestions.value.map(q => ({
            id: q.id,
            content: q.recognizedText || q.content,
            answer: q.aiAnswer || '待补充',
            analysis: q.aiAnalysis || 'AI暂未给出解析',
            categoryId: categoryId,
            categoryName: categoryInfo.name,
            tags: q.tags || [],
            difficulty: q.difficulty
          })),
          inputValue.trim()
        )

        showToast({ message: localOnly ? '已本地保存' : '试卷保存成功', type: 'success' })

        // 根据模式决定是否跳转
        if (isPaperSelectMode.value) {
          // 从"组建新卷"进来的，跳转回组卷页面
          setTimeout(() => {
            console.log('跳转到组卷页面')
            router.push('/paper-builder')
          }, 800)
        } else {
          // 正常浏览分类的，提示可以到组卷页面查看
          setTimeout(() => {
            showToast('可到组卷页面查看试卷')
            // 取消选中状态
            questions.forEach(q => q.selected = false)
            // 退出编辑模式
            editMode.value = false
          }, 800)
        }
        
      }).catch((error) => {
        // 用户点击取消
        console.log('用户点击了取消按钮或发生错误:', error)
      })
      
      console.log('showConfirmDialog 调用完成')
      
      } catch (error) {
        console.error('showConfirmDialog 调用失败:', error)
        showToast('弹窗显示失败：' + error.message)
      }
    }

    // 分享分类
    const shareCategory = () => {
      showToast('分享功能待实现')
    }

    // 加载分类信息
    const loadCategoryInfo = async () => {
      try {
        const response = await categoryAPI.getCategoryDetail(categoryId)
        if (response.success && response.data && response.data.data) {
          const category = response.data.data
          Object.assign(categoryInfo, {
            id: category.id,
            name: category.name || '未知分类',
            description: category.description || '暂无描述',
            icon: category.icon || 'apps-o',
            color: category.color || '#2459ff'
          })
        } else {
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
          const apiQuestions = response.data.data.map((question, index) => {
            const base = {
              id: question.id,
              recognizedText: question.content || question.recognizedText || '暂无内容',
              content: question.content || question.recognizedText || '暂无内容',
              imageUrl: question.imageUrl || '',
              aiAnswer: question.aiAnswer || '待补充',
              aiAnalysis: question.aiAnalysis || 'AI暂未给出解析',
              tags: (() => {
                if (!question.tags) return []
                if (typeof question.tags === 'string') {
                  return question.tags.split(',').filter(tag => tag.trim())
                }
                if (Array.isArray(question.tags)) return question.tags
                return []
              })(),
              difficulty: question.difficulty || 'medium',
              confidence: question.aiConfidence || 0.85,
              createdAt: new Date(question.createdAt).getTime(),
              isCorrect: question.isCorrect || false,
              selected: false,
              showAI: false
            }
            return buildDetailQuestion(base, index)
          })
          
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
      
      // 检查是否是组卷选题模式
      if (route.query.mode === 'paper-select') {
        editMode.value = true
      }
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
      shareCategory,
      isPaperSelectMode,
      savePaper,
      showDetailModal,
      detailQuestion,
      openAIChat,
      toggleShowAI
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

/* 🌑 深色主题对话框 - 与应用风格统一 */
:deep(.question-detail-dialog) {
  align-items: flex-start !important;
  justify-content: flex-start !important;
  padding: 4vh 0 0 4vw !important;
}

/* 🎨 对话框主体 - 深色毛玻璃效果 */
:deep(.question-detail-dialog .van-dialog) {
  width: 90vw !important;
  max-width: 600px !important;
  margin-left: 0 !important;
  margin-right: auto !important;
  text-align: left !important;
  background: var(--bg-card) !important;
  backdrop-filter: blur(12px) !important;
  border: 1px solid var(--border-color) !important;
  border-radius: var(--radius-xl) !important;
  box-shadow: 
    var(--shadow-glow),
    var(--shadow-inner),
    var(--shadow-card) !important;
  overflow: hidden !important;
  position: relative !important;
}

/* 🌟 对话框顶部渐变装饰条 */
:deep(.question-detail-dialog .van-dialog)::before {
  content: '' !important;
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  height: 3px !important;
  background: linear-gradient(90deg, 
    var(--primary-color) 0%, 
    var(--primary-light) 50%,
    var(--accent-color) 100%) !important;
  border-radius: var(--radius-xl) var(--radius-xl) 0 0 !important;
  box-shadow: 0 2px 12px rgba(31, 91, 255, 0.5) !important;
}

/* 🎨 对话框标题样式 */
:deep(.question-detail-dialog .van-dialog__header) {
  text-align: left !important;
  padding: 24px 24px 16px 24px !important;
  background: transparent !important;
  font-size: 18px !important;
  font-weight: 700 !important;
  color: var(--text-primary) !important;
  letter-spacing: 0.5px !important;
  background: linear-gradient(135deg, var(--text-primary), var(--text-accent)) !important;
  -webkit-background-clip: text !important;
  -webkit-text-fill-color: transparent !important;
  background-clip: text !important;
}

/* 🎨 对话框内容区域 */
:deep(.question-detail-dialog .van-dialog__message) {
  max-height: 65vh !important;
  overflow-y: auto !important;
  text-align: left !important;
  padding: 0 24px 24px 24px !important;
  color: var(--text-primary) !important;
}

/* 🎨 自定义滚动条 - 深色主题 */
:deep(.question-detail-dialog .van-dialog__message)::-webkit-scrollbar {
  width: 6px !important;
}

:deep(.question-detail-dialog .van-dialog__message)::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05) !important;
  border-radius: 3px !important;
}

:deep(.question-detail-dialog .van-dialog__message)::-webkit-scrollbar-thumb {
  background: rgba(31, 91, 255, 0.4) !important;
  border-radius: 3px !important;
}

:deep(.question-detail-dialog .van-dialog__message)::-webkit-scrollbar-thumb:hover {
  background: rgba(31, 91, 255, 0.6) !important;
}

/* 📝 所有内容左对齐 */
:deep(.question-detail-dialog .van-dialog__message *) {
  text-align: left !important;
}

/* 📦 内容分区样式 */
:deep(.dialog-section) {
  margin-bottom: 20px !important;
  text-align: left !important;
}

:deep(.dialog-section:last-child) {
  margin-bottom: 0 !important;
}

:deep(.dialog-section__title) {
  font-weight: 600 !important;
  font-size: 15px !important;
  color: var(--text-accent) !important;
  margin-bottom: 10px !important;
  text-align: left !important;
  display: flex !important;
  align-items: center !important;
  letter-spacing: 0.3px !important;
}

:deep(.dialog-section__title)::before {
  content: '' !important;
  display: inline-block !important;
  width: 4px !important;
  height: 16px !important;
  background: linear-gradient(180deg, var(--primary-color) 0%, var(--primary-light) 100%) !important;
  border-radius: 2px !important;
  margin-right: 8px !important;
  box-shadow: 0 0 8px rgba(31, 91, 255, 0.5) !important;
}

:deep(.dialog-section__body) {
  background: rgba(255, 255, 255, 0.03) !important;
  border: 1px solid var(--border-color) !important;
  border-radius: var(--radius-md) !important;
  padding: 16px !important;
  line-height: 1.8 !important;
  color: var(--text-primary) !important;
  word-break: break-word !important;
  text-align: left !important;
  box-shadow: var(--shadow-inner) !important;
  transition: all 0.3s var(--ease-smooth) !important;
}

/* ✨ 按钮样式美化 */
:deep(.question-detail-dialog .van-dialog__footer) {
  padding: 16px 24px 24px 24px !important;
  background: transparent !important;
}

:deep(.question-detail-dialog .van-dialog__confirm) {
  background: linear-gradient(135deg, var(--primary-color), var(--primary-light)) !important;
  color: var(--bg-primary) !important;
  border: none !important;
  border-radius: var(--radius-md) !important;
  padding: 12px 32px !important;
  font-weight: 600 !important;
  box-shadow: 
    0 4px 16px rgba(31, 91, 255, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.2) !important;
  transition: all 0.3s var(--ease-smooth) !important;
}

:deep(.question-detail-dialog .van-dialog__confirm):active {
  transform: translateY(-1px) scale(0.98) !important;
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
    radial-gradient(circle 400px at 20% 30%, rgba(31, 91, 255, 0.04) 0%, transparent 50%),
    radial-gradient(circle 300px at 80% 70%, rgba(82, 183, 255, 0.03) 0%, transparent 50%);
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

.group-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-top: 1px solid var(--border-color);
}

.group-toggle-label {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 600;
}

.q-index {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-accent, #2459ff);
  margin-right: 8px;
}

.q-difficulty {
  font-size: 11px;
  padding: 1px 8px;
  border-radius: 10px;
  margin-right: 8px;
  font-weight: 600;
  background: rgba(31, 91, 255, 0.1);
  color: #2459ff;
}

.q-difficulty.diff-easy {
  background: rgba(7, 193, 96, 0.12);
  color: #07a463;
}

.q-difficulty.diff-medium {
  background: rgba(255, 151, 30, 0.14);
  color: #e8821a;
}

.q-difficulty.diff-hard {
  background: rgba(238, 10, 36, 0.12);
  color: #ee0a24;
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
  box-shadow: 0 0 8px rgba(31, 91, 255, 0.5);
}

.question-card:hover {
  border-color: var(--border-glow);
  box-shadow: 
    0 0 40px rgba(31, 91, 255, 0.15),
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
  line-height: 1.6;
  color: var(--text-primary);
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
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
  display: flex;
  align-items: center;
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
  background: rgba(31, 91, 255, 0.15) !important;
  color: var(--text-accent) !important;
  border: 1px solid rgba(31, 91, 255, 0.3) !important;
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
  z-index: 1000;
  pointer-events: auto;
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

.batch-buttons .van-button {
  pointer-events: auto;
  cursor: pointer;
  z-index: 1;
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
  box-shadow: 0 0 8px rgba(31, 91, 255, 0.5);
}

.group-header:hover {
  border-color: var(--border-glow);
  box-shadow: 
    0 0 30px rgba(31, 91, 255, 0.15),
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
  background: rgba(31, 91, 255, 0.1);
  padding: 4px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(31, 91, 255, 0.2);
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
    rgba(31, 91, 255, 0.3) 0%, 
    rgba(31, 91, 255, 0.1) 50%,
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
  box-shadow: 0 0 8px rgba(31, 91, 255, 0.6);
}

/* 🌑 保存试卷对话框 - 深色主题 */
:deep(.save-paper-dialog .van-dialog) {
  background: var(--bg-card) !important;
  backdrop-filter: blur(12px) !important;
  border: 1px solid var(--border-color) !important;
  border-radius: var(--radius-xl) !important;
  box-shadow: 
    var(--shadow-glow),
    var(--shadow-inner),
    var(--shadow-card) !important;
  width: 85vw !important;
  max-width: 400px !important;
}

:deep(.save-paper-dialog .van-dialog)::before {
  content: '' !important;
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  height: 3px !important;
  background: linear-gradient(90deg, 
    var(--primary-color) 0%, 
    var(--primary-light) 50%,
    var(--accent-color) 100%) !important;
  border-radius: var(--radius-xl) var(--radius-xl) 0 0 !important;
}

:deep(.save-paper-dialog .van-dialog__header) {
  color: var(--text-primary) !important;
  background: transparent !important;
  font-weight: 700 !important;
  padding: 24px 24px 16px 24px !important;
  background: linear-gradient(135deg, var(--text-primary), var(--text-accent)) !important;
  -webkit-background-clip: text !important;
  -webkit-text-fill-color: transparent !important;
  background-clip: text !important;
}

:deep(.save-paper-dialog .van-dialog__message) {
  color: var(--text-primary) !important;
  text-align: left !important;
  padding: 0 24px 24px 24px !important;
}

:deep(.save-paper-dialog .van-dialog__confirm) {
  background: linear-gradient(135deg, var(--primary-color), var(--primary-light)) !important;
  color: var(--bg-primary) !important;
  border: none !important;
  font-weight: 600 !important;
}

:deep(.save-paper-dialog .van-dialog__cancel) {
  color: var(--text-secondary) !important;
}

/* 输入框焦点样式 */
:deep(.save-paper-dialog #paper-title-input:focus) {
  border-color: var(--primary-color) !important;
  box-shadow: 0 0 0 2px rgba(31, 91, 255, 0.2) !important;
}

.ai-toggle-btn {
  margin-top: 10px;
  border-radius: 16px !important;
}

.ai-box {
  margin-top: 12px;
  padding: 12px;
  background: rgba(36, 89, 255, 0.06);
  border-radius: 12px;
  border: 1px solid rgba(36, 89, 255, 0.12);
}

.ai-title {
  font-size: 13px;
  font-weight: 700;
  color: #2459ff;
  margin-bottom: 8px;
}

.ai-subtitle {
  font-size: 12px;
  color: rgba(11, 22, 51, 0.55);
  margin-bottom: 4px;
}

.ai-subtitle-gap {
  margin-top: 10px;
}

.ai-content {
  font-size: 13px;
  line-height: 1.55;
  color: #0b1633;
  margin: 0;
  white-space: pre-wrap;
}

.detail-placeholder {
  color: rgba(11, 22, 51, 0.45);
  font-style: italic;
}

.detail-modal {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 0 16px 16px;
}

.detail-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 0;
  border-bottom: 1px solid rgba(11, 22, 51, 0.08);
}

.detail-modal-title {
  font-size: 16px;
  font-weight: 700;
}

.detail-modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 0;
}

.detail-modal-footer {
  padding-top: 12px;
}

.detail-img {
  width: 100%;
  border-radius: 12px;
  margin-bottom: 16px;
}

.detail-section {
  margin-bottom: 16px;
}

.detail-section-title {
  font-size: 13px;
  font-weight: 700;
  color: #2459ff;
  margin-bottom: 8px;
}

.detail-section-body {
  font-size: 14px;
  line-height: 1.6;
  color: #0b1633;
  margin: 0;
  white-space: pre-wrap;
}

.detail-para-label {
  font-weight: 700;
  margin-right: 4px;
}
</style>