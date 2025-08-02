<template>
  <div class="paper-builder-page">
    <!-- 顶部导航 -->
    <van-nav-bar 
      title="组合试卷" 
      left-arrow 
      @click-left="$router.back()"
      fixed
      placeholder
    >
      <template #right>
        <van-button type="primary" size="mini" @click="exportPaper" class="nav-export-btn">
          导出
        </van-button>
      </template>
    </van-nav-bar>

    <!-- 试卷信息设置 -->
    <div class="paper-info-section">
      <van-cell-group inset class="tech-card">
        <van-field
          v-model="paperInfo.title"
          label="试卷标题"
          placeholder="请输入试卷标题"
          required
        />
        <van-field
          v-model="paperInfo.description"
          label="试卷说明"
          type="textarea"
          placeholder="请输入试卷说明（可选）"
          rows="2"
        />
        <van-cell title="考试时长" :value="`${paperInfo.duration} 分钟`" is-link @click="showDurationPicker = true" />
        <van-cell title="总分" :value="`${paperInfo.totalScore} 分`" is-link @click="showScorePicker = true" />
      </van-cell-group>
    </div>

    <!-- 分类选择器 -->
    <div class="category-selector-section">
      <div class="section-header">
        <h3>选择题目分类</h3>
        <van-button size="mini" type="primary" @click="showCategorySelector = true" class="add-category-btn">
          添加分类
        </van-button>
      </div>
      
      <div v-if="selectedCategories.length === 0" class="empty-categories tech-card">
        <van-empty description="请选择题目分类" image="search" />
      </div>
      
      <div v-else class="category-list tech-card">
        <van-swipe-cell 
          v-for="category in selectedCategories" 
          :key="category.id"
          class="category-item"
        >
          <div class="category-card">
            <div class="category-info">
              <van-icon :name="category.icon" :color="category.color" size="20" />
              <div class="category-details">
                <span class="category-name">{{ category.name }}</span>
                <span class="category-count">{{ category.selectedCount }}/{{ category.count }} 题</span>
              </div>
            </div>
            <van-button size="mini" @click="selectQuestions(category)">
              选题
            </van-button>
          </div>
          
          <template #right>
            <van-button square type="danger" text="删除" @click="removeCategory(category)" />
          </template>
        </van-swipe-cell>
      </div>
    </div>

    <!-- 已选题目预览 -->
    <div class="selected-questions-section" v-if="allSelectedQuestions.length > 0">
      <div class="section-header">
        <h3>已选题目 ({{ allSelectedQuestions.length }})</h3>
        <van-button size="mini" @click="clearAllQuestions">
          清空
        </van-button>
      </div>
      
      <van-list class="tech-card">
        <van-swipe-cell 
          v-for="(question, index) in allSelectedQuestions" 
          :key="question.id"
          class="question-item"
        >
          <div class="question-card">
            <div class="question-number">{{ index + 1 }}</div>
            <div class="question-content">
              <div class="question-text">{{ question.recognizedText }}</div>
              <div class="question-meta">
                <van-tag size="mini" class="custom-tag-category">{{ question.categoryName }}</van-tag>
                <van-tag size="mini" :class="getDifficultyTagClass(question.difficulty)">
                  {{ getDifficultyText(question.difficulty) }}
                </van-tag>
                <span class="question-score">{{ question.score || 5 }} 分</span>
              </div>
            </div>
            <div class="question-actions">
              <van-button size="mini" @click="editQuestionScore(question)">
                改分
              </van-button>
            </div>
          </div>
          
          <template #right>
            <van-button square type="danger" text="移除" @click="removeQuestion(question)" />
          </template>
        </van-swipe-cell>
      </van-list>
    </div>

    <!-- 试卷预览和导出 -->
    <div class="export-section" v-if="allSelectedQuestions.length > 0">
      <div class="export-stats tech-card">
        <div class="stat-item">
          <span class="stat-label">题目数量</span>
          <span class="stat-value">{{ allSelectedQuestions.length }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">预计时长</span>
          <span class="stat-value">{{ paperInfo.duration }} 分钟</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">总分</span>
          <span class="stat-value">{{ calculateTotalScore() }} 分</span>
        </div>
      </div>
      
      <div class="export-buttons">
        <van-button type="default" block @click="previewPaper">
          预览试卷
        </van-button>
        <van-button type="primary" block @click="exportPaper">
          导出PDF
        </van-button>
      </div>
    </div>

    <!-- 时长选择器 -->
    <van-popup v-model:show="showDurationPicker" position="bottom">
      <van-picker
        :columns="durationOptions"
        @confirm="onDurationConfirm"
        @cancel="showDurationPicker = false"
      />
    </van-popup>

    <!-- 分数选择器 -->
    <van-popup v-model:show="showScorePicker" position="bottom">
      <van-picker
        :columns="scoreOptions"
        @confirm="onScoreConfirm"
        @cancel="showScorePicker = false"
      />
    </van-popup>

    <!-- 分类选择器 -->
    <van-popup v-model:show="showCategorySelector" position="bottom" :style="{ height: '60%' }">
      <div class="category-selector">
        <div class="selector-header">
          <van-button size="mini" @click="showCategorySelector = false">取消</van-button>
          <span>选择分类</span>
          <van-button size="mini" type="primary" @click="confirmCategorySelection">确定</van-button>
        </div>
        
        <van-list class="category-option-list">
          <van-cell 
            v-for="category in availableCategories" 
            :key="category.id"
            :title="category.name"
            :label="category.description"
            clickable
            @click="toggleCategorySelection(category)"
          >
            <template #icon>
              <van-icon :name="category.icon" :color="category.color" />
            </template>
            <template #right-icon>
              <van-checkbox 
                :model-value="isCategorySelected(category.id)"
                @click.stop="toggleCategorySelection(category)"
              />
            </template>
          </van-cell>
        </van-list>
      </div>
    </van-popup>

    <!-- 底部导航 -->
    <van-tabbar route>
      <van-tabbar-item icon="home-o" to="/homepage">首页</van-tabbar-item>
      <van-tabbar-item icon="apps-o" to="/categories">分类</van-tabbar-item>
      <van-tabbar-item icon="edit" to="/paper-builder">组卷</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Toast, Dialog } from 'vant'
import { categoryAPI } from '../api/category'

export default {
  name: 'PaperBuilder',
  setup() {
    const route = useRoute()
    const router = useRouter()


    // 状态管理
    const showDurationPicker = ref(false)
    const showScorePicker = ref(false)
    const showCategorySelector = ref(false)
    const tempSelectedCategories = ref([])

    // 试卷信息
    const paperInfo = reactive({
      title: '数学练习试卷',
      description: '',
      duration: 90,
      totalScore: 100
    })

    // 分类和题目数据
    const availableCategories = reactive([])
    const selectedCategories = reactive([])
    const allSelectedQuestions = reactive([])

    // 选择器选项
    const durationOptions = [
      { text: '30分钟', value: 30 },
      { text: '45分钟', value: 45 },
      { text: '60分钟', value: 60 },
      { text: '90分钟', value: 90 },
      { text: '120分钟', value: 120 },
      { text: '150分钟', value: 150 }
    ]

    const scoreOptions = [
      { text: '50分', value: 50 },
      { text: '80分', value: 80 },
      { text: '100分', value: 100 },
      { text: '120分', value: 120 },
      { text: '150分', value: 150 }
    ]

    // 计算属性
    const calculateTotalScore = () => {
      return allSelectedQuestions.reduce((total, q) => total + (q.score || 5), 0)
    }

    // 获取难度标签类名
    const getDifficultyTagClass = (difficulty) => {
      const classMap = {
        'easy': 'custom-tag-easy',
        'medium': 'custom-tag-medium', 
        'hard': 'custom-tag-hard'
      }
      return classMap[difficulty] || 'custom-tag-default'
    }

    // 获取难度文本
    const getDifficultyText = (difficulty) => {
      const textMap = {
        'easy': '简单',
        'medium': '中等',
        'hard': '困难'
      }
      return textMap[difficulty] || '未知'
    }

    // 检查分类是否已选择
    const isCategorySelected = (categoryId) => {
      return tempSelectedCategories.value.includes(categoryId)
    }

    // 切换分类选择
    const toggleCategorySelection = (category) => {
      const index = tempSelectedCategories.value.indexOf(category.id)
      if (index > -1) {
        tempSelectedCategories.value.splice(index, 1)
      } else {
        tempSelectedCategories.value.push(category.id)
      }
    }

    // 确认分类选择
    const confirmCategorySelection = () => {
      const newCategories = availableCategories.filter(cat => 
        tempSelectedCategories.value.includes(cat.id) && 
        !selectedCategories.find(selected => selected.id === cat.id)
      )
      
      newCategories.forEach(cat => {
        selectedCategories.push({
          ...cat,
          selectedCount: 0,
          selectedQuestions: []
        })
      })
      
      showCategorySelector.value = false
    }

    // 移除分类
    const removeCategory = (category) => {
      const index = selectedCategories.findIndex(cat => cat.id === category.id)
      if (index > -1) {
        // 移除该分类下的所有题目
        const categoryQuestions = category.selectedQuestions || []
        categoryQuestions.forEach(question => {
          const questionIndex = allSelectedQuestions.findIndex(q => q.id === question.id)
          if (questionIndex > -1) {
            allSelectedQuestions.splice(questionIndex, 1)
          }
        })
        
        selectedCategories.splice(index, 1)
      }
    }

    // 选择题目
    const selectQuestions = (category) => {
      router.push({
        path: `/category/${category.id}`,
        query: { mode: 'select', returnTo: '/paper-builder' }
      })
    }

    // 移除题目
    const removeQuestion = (question) => {
      const index = allSelectedQuestions.findIndex(q => q.id === question.id)
      if (index > -1) {
        allSelectedQuestions.splice(index, 1)
        
        // 更新分类计数
        const category = selectedCategories.find(cat => cat.id === question.categoryId)
        if (category) {
          category.selectedCount = Math.max(0, category.selectedCount - 1)
          const questionIndex = category.selectedQuestions?.findIndex(q => q.id === question.id)
          if (questionIndex > -1) {
            category.selectedQuestions.splice(questionIndex, 1)
          }
        }
      }
    }

    // 清空所有题目
    const clearAllQuestions = async () => {
      try {
        await Dialog.confirm({
          title: '确认清空',
          message: '确定要清空所有已选题目吗？'
        })
        
        allSelectedQuestions.splice(0)
        selectedCategories.forEach(cat => {
          cat.selectedCount = 0
          cat.selectedQuestions = []
        })
        
        Toast.success('已清空所有题目')
      } catch (error) {
        // 用户取消
      }
    }

    // 编辑题目分数
    const editQuestionScore = async (question) => {
      try {
        const { value } = await Dialog.prompt({
          title: '设置分数',
          message: '请输入题目分数',
          inputPlaceholder: '请输入分数',
          inputValue: question.score || 5
        })
        
        const score = parseInt(value)
        if (score && score > 0) {
          question.score = score
          Toast.success('分数设置成功')
        } else {
          Toast.fail('请输入有效的分数')
        }
      } catch (error) {
        // 用户取消
      }
    }

    // 时长确认
    const onDurationConfirm = ({ selectedOptions }) => {
      paperInfo.duration = selectedOptions[0].value
      showDurationPicker.value = false
    }

    // 分数确认
    const onScoreConfirm = ({ selectedOptions }) => {
      paperInfo.totalScore = selectedOptions[0].value
      showScorePicker.value = false
    }

    // 预览试卷
    const previewPaper = () => {
      if (allSelectedQuestions.length === 0) {
        Toast('请先选择题目')
        return
      }
      
      Toast('预览功能开发中...')
    }

    // 导出试卷
    const exportPaper = async () => {
      if (allSelectedQuestions.length === 0) {
        Toast('请先选择题目')
        return
      }
      
      if (!paperInfo.title.trim()) {
        Toast('请输入试卷标题')
        return
      }
      
      try {
        Toast.loading('正在生成PDF...')
        
        // 模拟导出过程
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        Toast.success('PDF导出成功!')
        
      } catch (error) {
        console.error('导出失败:', error)
        Toast.fail('导出失败，请重试')
      }
    }

    // 加载可用分类
    const loadAvailableCategories = async () => {
      try {
        const result = await categoryAPI.getCategories()
        if (result.success) {
          availableCategories.splice(0, availableCategories.length, ...result.data)
        }
      } catch (error) {
        console.error('加载分类失败:', error)
        // 使用 mock 数据作为后备
        const mockCategories = [
          {
            id: 1,
            name: '数学 - 二次函数',
            description: '关于二次函数的图像、性质等问题',
            icon: 'chart-trending-o',
            color: '#E8A855',
            count: 15
          },
          {
            id: 2,
            name: '物理 - 力学',
            description: '牛顿定律、受力分析相关题目',
            icon: 'fire-o',
            color: '#F4BE7E',
            count: 8
          },
          {
            id: 3,
            name: '化学 - 有机化学',
            description: '有机物的结构、反应机制等',
            icon: 'experiment-o',
            color: '#F8D5A8',
            count: 12
          }
        ]
        availableCategories.splice(0, availableCategories.length, ...mockCategories)
      }
    }

    // 处理URL查询参数
    const handleQueryParams = () => {
      const { questions, category } = route.query
      
      if (questions && category) {
        // 从分类详情页面带来的选中题目
        const questionIds = questions.split(',').map(id => parseInt(id))
        
        // 这里应该根据questionIds加载具体的题目信息
        // 暂时使用模拟数据
        const mockQuestions = questionIds.map((id, index) => ({
          id: id,
          categoryId: parseInt(category),
          categoryName: '数学-二次函数',
          recognizedText: `题目 ${id} 的内容...`,
          difficulty: ['easy', 'medium', 'hard'][index % 3],
          score: 5
        }))
        
        allSelectedQuestions.splice(0, allSelectedQuestions.length, ...mockQuestions)
        
        // 更新分类选择状态
        const targetCategory = availableCategories.find(cat => cat.id === parseInt(category))
        if (targetCategory && !selectedCategories.find(cat => cat.id === targetCategory.id)) {
          selectedCategories.push({
            ...targetCategory,
            selectedCount: mockQuestions.length,
            selectedQuestions: mockQuestions
          })
        }
      }
    }

    // 组件挂载
    onMounted(async () => {
      await loadAvailableCategories()
      handleQueryParams()
    })

    return {
      paperInfo,
      selectedCategories,
      allSelectedQuestions,
      availableCategories,
      showDurationPicker,
      showScorePicker,
      showCategorySelector,
      tempSelectedCategories,
      durationOptions,
      scoreOptions,
      calculateTotalScore,
      getDifficultyTagClass,
      getDifficultyText,
      isCategorySelected,
      toggleCategorySelection,
      confirmCategorySelection,
      removeCategory,
      selectQuestions,
      removeQuestion,
      clearAllQuestions,
      editQuestionScore,
      onDurationConfirm,
      onScoreConfirm,
      previewPaper,
      exportPaper
    }
  }
}
</script>

<style scoped>
.paper-builder-page {
  min-height: 100vh;
  background: var(--bg-primary);
  padding-bottom: 60px;
  position: relative;
}

/* 🌟 页面背景光效 */
.paper-builder-page::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: 
    radial-gradient(circle 500px at 30% 20%, rgba(232, 168, 85, 0.05) 0%, transparent 50%),
    radial-gradient(circle 400px at 70% 80%, rgba(244, 190, 126, 0.04) 0%, transparent 50%);
  animation: floatingGlow 35s ease-in-out infinite;
  pointer-events: none;
  z-index: -1;
}

.paper-info-section {
  padding: 20px;
}

.category-selector-section,
.selected-questions-section,
.export-section {
  padding: 20px;
  margin-top: 12px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.empty-categories {
  background: var(--bg-card);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 40px 20px;
  box-shadow: var(--shadow-glow);
}

.category-list,
.question-list {
  background: var(--bg-card);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-glow);
}

.category-item,
.question-item {
  border-bottom: 1px solid var(--divider-color);
  transition: all 0.3s var(--ease-smooth);
}

.category-item:last-child,
.question-item:last-child {
  border-bottom: none;
}

.category-item:hover,
.question-item:hover {
  background: rgba(232, 168, 85, 0.05);
}

.category-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
}

.category-info {
  display: flex;
  align-items: center;
  flex: 1;
}

.category-details {
  margin-left: 12px;
  display: flex;
  flex-direction: column;
}

.category-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.category-count {
  font-size: 12px;  
  color: var(--text-secondary);
  margin-top: 2px;
}

.question-card {
  display: flex;
  align-items: flex-start;
  padding: 16px;
  gap: 12px;
}

.question-number {
  background: linear-gradient(135deg, var(--primary-color), var(--primary-light));
  color: white;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: bold;
  flex-shrink: 0;
}

.question-content {
  flex: 1;
  min-width: 0;
}

.question-text {
  font-size: 14px;
  color: var(--text-primary);
  line-height: 1.4;
  margin-bottom: 8px;
}

.question-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.question-score {
  font-size: 12px;
  color: #1976d2;
  font-weight: 500;
}

.question-actions {
  flex-shrink: 0;
}

.export-stats {
  position: relative;
  background: var(--bg-card);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 20px;
  margin-bottom: 20px;
  display: flex;
  justify-content: space-around;
  box-shadow: var(--shadow-glow);
  overflow: hidden;
}

.export-stats::before {
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
}

.stat-item {
  text-align: center;
  position: relative;
  z-index: 2;
}

.stat-label {
  display: block;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 6px;
  font-weight: 500;
}

.stat-value {
  display: block;
  font-size: 20px;
  font-weight: bold;
  color: var(--text-accent);
  text-shadow: 0 0 8px rgba(232, 168, 85, 0.3);
}

.export-buttons {
  display: flex;
  gap: 12px;
}

.export-buttons .van-button {
  flex: 1;
}

.category-selector {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.selector-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: white;
  border-bottom: 1px solid #f5f5f5;
  font-weight: 500;
}

.category-option-list {
  flex: 1;
  overflow-y: auto;
}

/* 自定义标签样式 */
.custom-tag-category {
  background: rgba(232, 168, 85, 0.15) !important;
  color: var(--text-accent) !important;
  border: 1px solid rgba(232, 168, 85, 0.3) !important;
  border-radius: var(--radius-sm) !important;
}

.custom-tag-easy {
  background: rgba(76, 175, 80, 0.15) !important;
  color: #4caf50 !important;
  border: 1px solid rgba(76, 175, 80, 0.3) !important;
  border-radius: var(--radius-sm) !important;
}

.custom-tag-medium {
  background: rgba(255, 152, 0, 0.15) !important;
  color: #ff9800 !important;
  border: 1px solid rgba(255, 152, 0, 0.3) !important;
  border-radius: var(--radius-sm) !important;
}

.custom-tag-hard {
  background: rgba(244, 67, 54, 0.15) !important;
  color: #ff6b6b !important;
  border: 1px solid rgba(244, 67, 54, 0.3) !important;
  border-radius: var(--radius-sm) !important;
}

.custom-tag-default {
  background: var(--bg-glass) !important;
  color: var(--text-secondary) !important;
  border: 1px solid var(--border-color) !important;
  border-radius: var(--radius-sm) !important;
}

/* 🌟 PaperBuilder专属按钮样式 */
.nav-export-btn {
  background: linear-gradient(135deg, var(--primary-color), var(--primary-light)) !important;
  border: none !important;
  color: var(--bg-primary) !important;
  font-weight: 600 !important;
  box-shadow: 0 4px 16px rgba(232, 168, 85, 0.3) !important;
  border-radius: var(--radius-md) !important;
}

.add-category-btn {
  background: linear-gradient(135deg, var(--primary-color), var(--primary-light)) !important;
  border: none !important;
  color: var(--bg-primary) !important;
  font-weight: 600 !important;
  box-shadow: 0 4px 16px rgba(232, 168, 85, 0.3) !important;
  border-radius: var(--radius-md) !important;
}

/* 🎯 本页面表单元素强制金色主题 */
:deep(.tech-card .van-cell-group) {
  background: var(--bg-card) !important;
  backdrop-filter: blur(12px) !important;
  border: 1px solid var(--border-glow) !important;
  border-radius: var(--radius-lg) !important;
  box-shadow: var(--shadow-glow) !important;
  overflow: hidden !important;
}

:deep(.tech-card .van-cell) {
  background: var(--bg-glass) !important;
  border-bottom: 1px solid var(--divider-color) !important;
  backdrop-filter: blur(8px) !important;
}

:deep(.tech-card .van-cell:last-child) {
  border-bottom: none !important;
}

:deep(.tech-card .van-field) {
  background: transparent !important;
}

:deep(.tech-card .van-field__control) {
  background: transparent !important;
  color: var(--text-primary) !important;
  font-weight: 500 !important;
}

:deep(.tech-card .van-field__control::placeholder) {
  color: var(--text-secondary) !important;
}

:deep(.tech-card .van-field__label) {
  color: var(--text-primary) !important;
  font-weight: 500 !important;
}

:deep(.tech-card .van-cell__title) {
  color: var(--text-primary) !important;
  font-weight: 500 !important;
}

:deep(.tech-card .van-cell__value) {
  color: var(--text-accent) !important;
  font-weight: 500 !important;
}
</style>