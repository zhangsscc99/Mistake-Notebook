<template>
  <div class="question-selector">
    <!-- 头部导航 -->
    <div class="header">
      <van-nav-bar
        title="去手写"
        left-arrow
        @click-left="goBack"
        :safe-area-inset-top="true"
      >
        <template #right>
          <span class="nav-action" @click="adjustImage">调整图片</span>
        </template>
      </van-nav-bar>
    </div>

    <!-- 提示区域 -->
    <div class="tips-section">
      <div class="tips-content">
        <van-icon name="info-o" class="tips-icon" />
        <span class="tips-text">已自动选中疑难题目，点击</span>
        <van-icon name="plus" class="plus-icon" />
        <span class="tips-text">继续选择</span>
      </div>
      <van-icon name="cross" class="close-tips" @click="hideTips" />
    </div>

    <!-- 图片和题目识别区域 -->
    <div class="main-content">
      <div class="image-container">
        <img :src="originalImage" alt="原图" class="original-image" />
        
        <!-- 题目选择框 -->
        <div class="questions-overlay">
          <div 
            v-for="(question, index) in questions" 
            :key="index"
            class="question-box"
            :class="{ 'selected': question.selected }"
            :style="{
              top: question.bounds.top + '%',
              left: question.bounds.left + '%',
              width: question.bounds.width + '%',
              height: question.bounds.height + '%'
            }"
            @click="toggleQuestion(index)"
          >
            <div class="question-number">{{ index + 1 }}</div>
            <div class="select-indicator">
              <van-icon 
                :name="question.selected ? 'checked' : 'plus'" 
                :class="question.selected ? 'selected-icon' : 'add-icon'"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部分类和保存区域 -->
    <div class="bottom-section">
      <div class="category-selector">
        <div class="category-tags">
          <van-tag 
            v-for="category in categories" 
            :key="category.id"
            :type="selectedCategory === category.id ? 'primary' : 'default'"
            @click="selectCategory(category.id)"
            class="category-tag"
          >
            {{ category.name }}
          </van-tag>
          <van-tag type="default" class="category-tag">
            {{ selectedDifficulty }}
          </van-tag>
          <van-tag type="default" class="category-tag">
            {{ selectedPeriod }}
          </van-tag>
        </div>
        <span class="modify-btn" @click="showCategoryPicker">修改 ></span>
      </div>

      <!-- 保存按钮 -->
      <van-button 
        type="primary" 
        size="large" 
        block
        class="save-btn"
        :loading="saving"
        @click="saveSelectedQuestions"
      >
        保存到错题本 ({{ selectedCount }})
      </van-button>
    </div>

    <!-- 分类选择弹窗 -->
    <van-popup 
      v-model:show="showCategoryModal" 
      position="bottom" 
      :style="{ height: '60%' }"
      closeable
      close-icon-position="top-right"
    >
      <div class="category-modal">
        <h3>编辑分类信息</h3>
        
        <div class="form-section">
          <label>学科分类</label>
          <van-radio-group v-model="tempCategory">
            <div class="radio-grid">
              <van-radio 
                v-for="cat in categories" 
                :key="cat.id"
                :name="cat.id"
                class="radio-item"
              >
                {{ cat.name }}
              </van-radio>
            </div>
          </van-radio-group>
        </div>

        <div class="form-section">
          <label>难度等级</label>
          <van-radio-group v-model="tempDifficulty">
            <div class="radio-grid">
              <van-radio name="简单" class="radio-item">简单</van-radio>
              <van-radio name="中等" class="radio-item">中等</van-radio>
              <van-radio name="困难" class="radio-item">困难</van-radio>
            </div>
          </van-radio-group>
        </div>

        <div class="form-section">
          <label>学习阶段</label>
          <van-radio-group v-model="tempPeriod">
            <div class="radio-grid">
              <van-radio name="小学" class="radio-item">小学</van-radio>
              <van-radio name="初中" class="radio-item">初中</van-radio>
              <van-radio name="高中" class="radio-item">高中</van-radio>
              <van-radio name="大学" class="radio-item">大学</van-radio>
            </div>
          </van-radio-group>
        </div>

        <div class="modal-actions">
          <van-button @click="cancelCategoryEdit" class="cancel-btn">取消</van-button>
          <van-button type="primary" @click="confirmCategoryEdit" class="confirm-btn">确认</van-button>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { showToast } from 'vant'
import { imageRecognitionAPI } from '../api/recognition'

export default {
  name: 'QuestionSelector',
  setup() {
    const router = useRouter()
    const route = useRoute()

    // 响应式数据
    const originalImage = ref('')
    const questions = reactive([])
    const saving = ref(false)
    const showCategoryModal = ref(false)
    
    // 分类相关
    const categories = reactive([
      { id: 'math', name: '数学' },
      { id: 'chinese', name: '语文' },
      { id: 'english', name: '英语' },
      { id: 'physics', name: '物理' },
      { id: 'chemistry', name: '化学' },
      { id: 'biology', name: '生物' },
      { id: 'history', name: '历史' },
      { id: 'geography', name: '地理' }
    ])

    const selectedCategory = ref('math')
    const selectedDifficulty = ref('中等')
    const selectedPeriod = ref('高中')

    // 临时分类数据（用于弹窗编辑）
    const tempCategory = ref('math')
    const tempDifficulty = ref('中等')
    const tempPeriod = ref('高中')

    // 计算属性
    const selectedCount = computed(() => {
      return questions.filter(q => q.selected).length
    })

    // 初始化数据
    const initializeData = () => {
      console.log('QuestionSelector 初始化开始') // 调试信息
      console.log('路由参数:', route.query) // 调试信息
      
      // 从路由参数获取图片
      if (route.query.image) {
        originalImage.value = decodeURIComponent(route.query.image)
        console.log('获取到图片URL:', originalImage.value) // 调试信息
      }

      // 从路由参数获取识别结果
      if (route.query.results) {
        try {
          console.log('开始解析识别结果') // 调试信息
          const results = JSON.parse(route.query.results)
          console.log('解析后的结果:', results) // 调试信息
          
          if (results.data && results.data.questions) {
            // 将后端返回的题目数据转换为前端格式
            const backendQuestions = results.data.questions.map(q => ({
              id: q.id,
              selected: q.isDifficult || q.difficult, // 默认选中疑难题目（兼容两种字段名）
              bounds: q.bounds,
              text: q.text,
              difficulty: getDifficultyByConfidence(q.confidence),
              confidence: q.confidence
            }))
            
            console.log('转换后的题目数据:', backendQuestions) // 调试信息
            questions.splice(0, questions.length, ...backendQuestions)
            return
          }
        } catch (error) {
          console.error('解析识别结果失败:', error)
        }
      }

      // 如果没有识别结果，使用模拟数据
      const mockQuestions = [
        {
          id: 1,
          selected: false,
          bounds: { top: 15, left: 10, width: 80, height: 12 },
          text: '1. (1+5i)的绝对值',
          difficulty: '简单',
          confidence: 0.92
        },
        {
          id: 2,
          selected: true, // 默认选中疑难题目
          bounds: { top: 30, left: 10, width: 80, height: 12 },
          text: '2. 设集合U={1,2,3,4,5,6,7,8}，集合A={1,3,5,7}，B(A)表示A在全集U中的补集',
          difficulty: '中等',
          confidence: 0.88
        },
        {
          id: 3,
          selected: false,
          bounds: { top: 45, left: 10, width: 80, height: 12 },
          text: '3. 若直线l经过点P(1,2)且倾斜角为π/3，则直线l的方程为',
          difficulty: '中等',
          confidence: 0.90
        },
        {
          id: 4,
          selected: false,
          bounds: { top: 60, left: 10, width: 80, height: 15 },
          text: '4. 若点(a,b)(a>0)是圆M上一点，且到直线y=2tan(x-π/4)的距离为max，M的圆心的横坐标是',
          difficulty: '困难',
          confidence: 0.85
        },
        {
          id: 5,
          selected: true, // 默认选中疑难题目
          bounds: { top: 78, left: 10, width: 80, height: 15 },
          text: '5. 设f(x)是定义在R上的函数，若对于任意x≤3时，f(x)=x-21，M=max{f(x)|x∈R}',
          difficulty: '困难',
          confidence: 0.87
        },
        {
          id: 6,
          selected: false,
          bounds: { top: 95, left: 10, width: 80, height: 25 },
          text: '6. 假设扔掷，运动总量的信息只需满足以下大小的的，是对信息风险的风力',
          difficulty: '中等',
          confidence: 0.75
        }
      ]

      questions.splice(0, questions.length, ...mockQuestions)
    }

    // 根据置信度判断难度
    const getDifficultyByConfidence = (confidence) => {
      if (confidence >= 0.9) return '简单'
      if (confidence >= 0.8) return '中等'
      return '困难'
    }

    // 方法
    const goBack = () => {
      router.back()
    }

    const adjustImage = () => {
      showToast('调整图片功能')
    }

    const hideTips = () => {
      // 隐藏提示
    }

    const toggleQuestion = (index) => {
      questions[index].selected = !questions[index].selected
    }

    const selectCategory = (categoryId) => {
      selectedCategory.value = categoryId
    }

    const showCategoryPicker = () => {
      tempCategory.value = selectedCategory.value
      tempDifficulty.value = selectedDifficulty.value
      tempPeriod.value = selectedPeriod.value
      showCategoryModal.value = true
    }

    const cancelCategoryEdit = () => {
      showCategoryModal.value = false
    }

    const confirmCategoryEdit = () => {
      selectedCategory.value = tempCategory.value
      selectedDifficulty.value = tempDifficulty.value
      selectedPeriod.value = tempPeriod.value
      showCategoryModal.value = false
    }

    const saveSelectedQuestions = async () => {
      const selectedQuestions = questions.filter(q => q.selected)
      
      if (selectedQuestions.length === 0) {
        showToast('请至少选择一道题目')
        return
      }

      saving.value = true

      try {
        console.log('开始保存选中的题目...', selectedQuestions) // 调试信息
        
        // 调用真实的API保存选中的题目
        const result = await imageRecognitionAPI.saveSelectedQuestions(
          selectedQuestions,
          getCategoryName(selectedCategory.value),
          selectedDifficulty.value,
          originalImage.value
        )
        
        console.log('保存结果:', result) // 调试信息

        showToast(`已保存${selectedQuestions.length}道题目到错题本`)
        
        // 跳转到分类页面
        router.push('/categories')
        
      } catch (error) {
        console.error('保存失败:', error)
        showToast('保存失败，请重试')
      } finally {
        saving.value = false
      }
    }

    // 获取分类名称
    const getCategoryName = (categoryId) => {
      const category = categories.find(cat => cat.id === categoryId)
      return category ? category.name : '数学'
    }

    // 生命周期
    onMounted(() => {
      initializeData()
    })

    return {
      originalImage,
      questions,
      saving,
      showCategoryModal,
      categories,
      selectedCategory,
      selectedDifficulty,
      selectedPeriod,
      tempCategory,
      tempDifficulty,
      tempPeriod,
      selectedCount,
      goBack,
      adjustImage,
      hideTips,
      toggleQuestion,
      selectCategory,
      showCategoryPicker,
      cancelCategoryEdit,
      confirmCategoryEdit,
      saveSelectedQuestions,
      getCategoryName
    }
  }
}
</script>

<style scoped>
.question-selector {
  min-height: 100vh;
  background: var(--bg-primary);
  display: flex;
  flex-direction: column;
}

/* 头部导航 */
.header {
  position: sticky;
  top: 0;
  z-index: 100;
}

:deep(.van-nav-bar) {
  background: var(--bg-glass) !important;
  backdrop-filter: blur(16px) !important;
  border-bottom: 1px solid var(--border-glow) !important;
}

.nav-action {
  color: var(--primary-color);
  font-size: 14px;
  font-weight: 500;
}

/* 提示区域 */
.tips-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: rgba(33, 150, 255, 0.1);
  border-bottom: 1px solid rgba(33, 150, 255, 0.2);
}

.tips-content {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  color: #2196F3;
}

.tips-icon {
  font-size: 16px;
}

.plus-icon {
  font-size: 14px;
  color: #2196F3;
  font-weight: bold;
}

.close-tips {
  font-size: 16px;
  color: #2196F3;
  opacity: 0.7;
}

/* 主要内容区域 */
.main-content {
  flex: 1;
  padding: 16px;
  overflow: auto;
}

.image-container {
  position: relative;
  width: 100%;
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.original-image {
  width: 100%;
  height: auto;
  display: block;
}

/* 题目选择框 */
.questions-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.question-box {
  position: absolute;
  border: 2px solid transparent;
  border-radius: 6px;
  background: rgba(33, 150, 255, 0.1);
  cursor: pointer;
  pointer-events: all;
  transition: all 0.3s ease;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 4px;
}

.question-box.selected {
  border-color: #52c41a;
  background: rgba(82, 196, 26, 0.15);
}

.question-number {
  background: rgba(0, 0, 0, 0.7);
  color: white;
  font-size: 12px;
  font-weight: bold;
  padding: 2px 6px;
  border-radius: 4px;
  min-width: 20px;
  text-align: center;
}

.select-indicator {
  background: #2196F3;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.question-box.selected .select-indicator {
  background: #52c41a;
}

.add-icon, .selected-icon {
  font-size: 12px;
  color: white;
  font-weight: bold;
}

/* 底部区域 */
.bottom-section {
  background: var(--bg-card);
  border-top: 1px solid var(--border-color);
  padding: 16px;
}

.category-selector {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.category-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.category-tag {
  font-size: 12px !important;
  padding: 2px 8px !important;
}

.modify-btn {
  color: var(--primary-color);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.save-btn {
  height: 48px !important;
  border-radius: 24px !important;
  background: linear-gradient(135deg, #1890ff, #52c41a) !important;
  font-weight: 600;
  font-size: 16px;
}

/* 分类选择弹窗 */
.category-modal {
  padding: 20px;
}

.category-modal h3 {
  text-align: center;
  margin-bottom: 20px;
  color: var(--text-primary);
}

.form-section {
  margin-bottom: 20px;
}

.form-section label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.radio-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.radio-item {
  font-size: 14px !important;
}

.modal-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.cancel-btn, .confirm-btn {
  flex: 1;
  height: 44px !important;
  border-radius: 22px !important;
}

.cancel-btn {
  background: var(--bg-secondary) !important;
  color: var(--text-secondary) !important;
  border: 1px solid var(--border-color) !important;
}

.confirm-btn {
  background: linear-gradient(135deg, var(--primary-color), var(--primary-light)) !important;
}
</style>