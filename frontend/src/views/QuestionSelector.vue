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
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { imageRecognitionAPI } from '../api/recognition'
import categoryAPI from '../api/category'
import { API_BASE_URL } from '../api/config'

function isDifficultQuestion(segment) {
  const type = segment.type || ''
  const confidence = typeof segment.confidence === 'number' ? segment.confidence : 1
  return type.includes('解答') || confidence < 0.85
}

function resolveImageUrl(url) {
  if (!url) return ''
  if (url.startsWith('http') || url.startsWith('blob:') || url.startsWith('data:')) return url
  const base = API_BASE_URL.replace(/\/api\/?$/, '')
  return `${base}${url.startsWith('/') ? url : '/' + url}`
}

export default {
  name: 'QuestionSelector',
  setup() {
    const router = useRouter()

    const originalImage = ref('')
    const serverImageUrl = ref('')
    const questions = reactive([])
    const saving = ref(false)
    const showCategoryModal = ref(false)
    
    // 分类相关（从 API 动态加载）
    const categories = reactive([])
    const selectedCategory = ref('')
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
      const draftRaw = sessionStorage.getItem('recognitionDraft')
      if (!draftRaw) {
        showToast('无识别结果')
        setTimeout(() => router.back(), 800)
        return
      }

      let draft
      try {
        draft = JSON.parse(draftRaw)
      } catch {
        showToast('识别数据无效')
        setTimeout(() => router.back(), 800)
        return
      }

      const segments = draft.segments || []
      if (!segments.length) {
        showToast('无识别结果')
        setTimeout(() => router.back(), 800)
        return
      }

      originalImage.value = draft.tempFilePath || resolveImageUrl(draft.imageUrl)
      serverImageUrl.value = draft.imageUrl || ''

      const mapped = segments.map((segment, index) => {
        const conf = segment.confidence || 0
        return {
          id: String(segment.id || index + 1),
          selected: segment.isDifficult !== undefined ? !!segment.isDifficult : isDifficultQuestion(segment),
          bounds: segment.bounds || { top: 15 + index * 12, left: 10, width: 80, height: 12 },
          text: segment.text || segment.content || '',
          type: segment.type || '',
          confidence: conf,
          difficulty: getDifficultyByConfidence(conf)
        }
      }).filter(q => q.text)

      questions.splice(0, questions.length, ...mapped)

      const defaultSubject = segments[0]?.subject
      if (defaultSubject && categories.length) {
        const match = categories.find(c => c.name === defaultSubject)
        if (match) selectedCategory.value = match.id
      }
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
          serverImageUrl.value || originalImage.value
        )

        const count = result?.data?.savedCount || selectedQuestions.length
        sessionStorage.removeItem('recognitionDraft')
        showToast(`已保存${count}道，AI解析中`)
        setTimeout(() => router.push('/categories'), 800)
        
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

    // 加载分类列表
    const loadCategories = async () => {
      try {
        const response = await categoryAPI.getCategories()
        if (response.success && response.data && response.data.data) {
          const list = response.data.data.map(cat => ({ id: cat.id, name: cat.name }))
          categories.splice(0, categories.length, ...list)
          if (!selectedCategory.value && list.length > 0) {
            selectedCategory.value = list[0].id
            tempCategory.value = list[0].id
          }
        }
      } catch (e) {
        // 降级：用常见学科
        const fallback = [
          { id: 'math', name: '数学' }, { id: 'chinese', name: '语文' },
          { id: 'english', name: '英语' }, { id: 'physics', name: '物理' },
          { id: 'chemistry', name: '化学' }, { id: 'biology', name: '生物' }
        ]
        categories.splice(0, categories.length, ...fallback)
        if (!selectedCategory.value) {
          selectedCategory.value = 'math'
          tempCategory.value = 'math'
        }
      }
    }

    // 生命周期
    onMounted(async () => {
      await loadCategories()
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
  position: relative;
}

/* 🌟 背景装饰 */
.question-selector::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: 
    radial-gradient(circle 600px at 20% 30%, rgba(31, 91, 255, 0.03) 0%, transparent 60%),
    radial-gradient(circle 400px at 80% 70%, rgba(31, 91, 255, 0.04) 0%, transparent 50%);
  z-index: -1;
  pointer-events: none;
}

/* 头部导航 */
.header {
  position: sticky;
  top: 0;
  z-index: 100;
}

:deep(.van-nav-bar) {
  background: var(--bg-glass) !important;
  backdrop-filter: blur(20px) !important;
  border-bottom: 1px solid var(--border-glow) !important;
  box-shadow: 
    0 4px 20px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
}

.nav-action {
  color: var(--text-accent);
  font-size: 14px;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

/* 🎨 提示区域 - 现代化设计 */
.tips-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  margin: 16px;
  background: var(--bg-card);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border-glow);
  border-radius: var(--radius-lg);
  box-shadow: 
    var(--shadow-glow),
    var(--shadow-inner);
  position: relative;
  overflow: hidden;
}

.tips-section::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 100%;
  background: linear-gradient(180deg, var(--primary-color), var(--primary-light));
  border-radius: var(--radius-sm) 0 0 var(--radius-sm);
}

.tips-content {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--text-accent);
  font-weight: 500;
}

.tips-icon {
  font-size: 18px;
  color: var(--primary-color);
}

.plus-icon {
  font-size: 14px;
  color: var(--primary-color);
  font-weight: bold;
  background: linear-gradient(135deg, var(--primary-color), var(--primary-light));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.close-tips {
  font-size: 18px;
  color: var(--text-secondary);
  opacity: 0.8;
  cursor: pointer;
  transition: all 0.3s var(--ease-smooth);
}

.close-tips:hover {
  opacity: 1;
  color: var(--text-primary);
  transform: scale(1.1);
}

/* 主要内容区域 */
.main-content {
  flex: 1;
  padding: 0 16px 20px 16px;
  overflow: auto;
}

/* 🖼️ 图片容器 - 玻璃拟态效果 */
.image-container {
  position: relative;
  width: 100%;
  background: var(--bg-card);
  backdrop-filter: blur(16px);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-xl);
  overflow: hidden;
  box-shadow: 
    var(--shadow-glow),
    var(--shadow-card),
    0 8px 32px rgba(31, 91, 255, 0.08);
  margin-bottom: 20px;
}

.original-image {
  width: 100%;
  height: auto;
  display: block;
}

/* 🎯 题目选择框 - 现代化交互 */
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
  border-radius: var(--radius-md);
  background: rgba(31, 91, 255, 0.06);
  cursor: pointer;
  pointer-events: all;
  transition: all 0.4s var(--ease-smooth);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 6px;
  box-shadow: 
    0 2px 12px rgba(31, 91, 255, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.question-box:hover {
  background: rgba(31, 91, 255, 0.12);
  border-color: var(--primary-color);
  transform: scale(1.02);
  box-shadow: 
    0 4px 20px rgba(31, 91, 255, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

.question-box.selected {
  border-color: #B8860B;
  background: linear-gradient(135deg, 
    rgba(184, 134, 11, 0.18) 0%, 
    rgba(184, 134, 11, 0.10) 100%);
  box-shadow: 
    0 0 20px rgba(184, 134, 11, 0.35),
    0 4px 16px rgba(184, 134, 11, 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  animation: selectedGlow 2s ease-in-out infinite;
}

@keyframes selectedGlow {
  0%, 100% { box-shadow: 
    0 0 20px rgba(184, 134, 11, 0.35),
    0 4px 16px rgba(184, 134, 11, 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.2); }
  50% { box-shadow: 
    0 0 30px rgba(184, 134, 11, 0.45),
    0 6px 24px rgba(184, 134, 11, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.3); }
}

.question-number {
  background: linear-gradient(135deg, 
    rgba(0, 0, 0, 0.85) 0%, 
    rgba(0, 0, 0, 0.7) 100%);
  color: white;
  font-size: 12px;
  font-weight: bold;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  min-width: 24px;
  text-align: center;
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.select-indicator {
  background: linear-gradient(135deg, var(--primary-color), var(--primary-light));
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.4s var(--ease-smooth);
  box-shadow: 
    0 2px 8px rgba(31, 91, 255, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

.question-box.selected .select-indicator {
  background: linear-gradient(135deg, #B8860B, #DAA520);
  transform: scale(1.1);
  box-shadow: 
    0 0 16px rgba(184, 134, 11, 0.45),
    0 2px 8px rgba(184, 134, 11, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.4);
}

.add-icon, .selected-icon {
  font-size: 12px;
  color: white;
  font-weight: bold;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

/* 🎨 底部区域 - 现代化设计 */
.bottom-section {
  background: var(--bg-card);
  backdrop-filter: blur(16px);
  border-top: 1px solid var(--border-glow);
  padding: 20px;
  position: relative;
  box-shadow: 
    0 -4px 20px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.bottom-section::before {
  content: '';
  position: absolute;
  top: 0;
  left: 20px;
  right: 20px;
  height: 2px;
  background: linear-gradient(90deg, 
    transparent 0%, 
    var(--primary-color) 50%, 
    transparent 100%);
  opacity: 0.6;
}

.category-selector {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  padding: 16px;
  background: var(--bg-glass);
  backdrop-filter: blur(8px);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-inner);
}

/* 🏷️ 分类标签 - 现代化样式 */
.category-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  flex: 1;
}

.category-tag {
  font-size: 12px !important;
  padding: 6px 12px !important;
  border-radius: var(--radius-sm) !important;
  background: linear-gradient(135deg, 
    rgba(31, 91, 255, 0.1) 0%, 
    rgba(31, 91, 255, 0.05) 100%) !important;
  border: 1px solid rgba(31, 91, 255, 0.2) !important;
  color: var(--text-primary) !important;
  font-weight: 500 !important;
  transition: all 0.3s var(--ease-smooth) !important;
  backdrop-filter: blur(4px);
  box-shadow: 
    0 2px 4px rgba(31, 91, 255, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.category-tag:hover {
  background: linear-gradient(135deg, 
    rgba(31, 91, 255, 0.15) 0%, 
    rgba(31, 91, 255, 0.08) 100%) !important;
  border-color: rgba(31, 91, 255, 0.3) !important;
  transform: translateY(-1px);
  box-shadow: 
    0 4px 8px rgba(31, 91, 255, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

.modify-btn {
  color: var(--text-accent);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  padding: 8px 16px;
  background: var(--bg-glass);
  border: 1px solid var(--border-glow);
  border-radius: var(--radius-md);
  transition: all 0.3s var(--ease-smooth);
  backdrop-filter: blur(8px);
  box-shadow: var(--shadow-inner);
}

.modify-btn:hover {
  background: linear-gradient(135deg, 
    rgba(31, 91, 255, 0.1) 0%, 
    rgba(31, 91, 255, 0.05) 100%);
  border-color: var(--primary-color);
  transform: translateY(-1px);
  box-shadow: 
    0 4px 12px rgba(31, 91, 255, 0.2),
    var(--shadow-inner);
}

/* 🚀 保存按钮 - 炫酷渐变 */
.save-btn {
  height: 52px !important;
  border-radius: var(--radius-xl) !important;
  background: linear-gradient(135deg, 
    var(--primary-color) 0%, 
    var(--primary-light) 50%, 
    #B8860B 100%) !important;
  font-weight: 700 !important;
  font-size: 16px !important;
  letter-spacing: 0.5px !important;
  position: relative !important;
  overflow: hidden !important;
  border: none !important;
  box-shadow: 
    0 8px 24px rgba(31, 91, 255, 0.3),
    0 4px 16px rgba(184, 134, 11, 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.3) !important;
  transition: all 0.4s var(--ease-smooth) !important;
}

.save-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, 
    transparent 0%, 
    rgba(255, 255, 255, 0.2) 50%, 
    transparent 100%);
  transition: left 0.6s ease;
}

.save-btn:hover::before {
  left: 100%;
}

.save-btn:hover {
  transform: translateY(-2px) !important;
  box-shadow: 
    0 12px 32px rgba(31, 91, 255, 0.4),
    0 6px 24px rgba(184, 134, 11, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.4) !important;
}

.save-btn:active {
  transform: translateY(0) !important;
}

/* 🎭 分类选择弹窗 - 现代化设计 */
.category-modal {
  padding: 24px;
  background: var(--bg-card);
  backdrop-filter: blur(20px);
  border-radius: var(--radius-xl);
  box-shadow: 
    0 20px 60px rgba(0, 0, 0, 0.2),
    var(--shadow-glow),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.category-modal h3 {
  text-align: center;
  margin-bottom: 24px;
  color: var(--text-primary);
  font-size: 18px;
  font-weight: 600;
  background: linear-gradient(135deg, var(--primary-color), var(--primary-light));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.form-section {
  margin-bottom: 20px;
  padding: 16px;
  background: var(--bg-glass);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  backdrop-filter: blur(8px);
  box-shadow: var(--shadow-inner);
}

.form-section label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-accent);
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.radio-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

:deep(.radio-item) {
  font-size: 14px !important;
  font-weight: 500 !important;
}

:deep(.radio-item .van-radio__label) {
  color: var(--text-primary) !important;
}

:deep(.radio-item .van-radio__icon--checked .van-icon) {
  background: linear-gradient(135deg, var(--primary-color), var(--primary-light)) !important;
  border-color: var(--primary-color) !important;
}

.modal-actions {
  display: flex;
  gap: 16px;
  margin-top: 32px;
}

.cancel-btn, .confirm-btn {
  flex: 1;
  height: 48px !important;
  border-radius: var(--radius-lg) !important;
  font-weight: 600 !important;
  transition: all 0.3s var(--ease-smooth) !important;
}

.cancel-btn {
  background: var(--bg-glass) !important;
  color: var(--text-secondary) !important;
  border: 1px solid var(--border-color) !important;
  backdrop-filter: blur(8px);
  box-shadow: var(--shadow-inner) !important;
}

.cancel-btn:hover {
  background: var(--bg-secondary) !important;
  color: var(--text-primary) !important;
  transform: translateY(-1px) !important;
}

.confirm-btn {
  background: linear-gradient(135deg, var(--primary-color), #B8860B) !important;
  border: none !important;
  box-shadow: 
    0 6px 20px rgba(31, 91, 255, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.3) !important;
}

.confirm-btn:hover {
  transform: translateY(-2px) !important;
  box-shadow: 
    0 8px 28px rgba(31, 91, 255, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.4) !important;
}

/* 🌟 全局动画关键帧 */
@keyframes glowPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.8; }
}

@keyframes floatingGlow {
  0%, 100% { transform: translate(-50%, -50%) scale(1); }
  50% { transform: translate(-50%, -50%) scale(1.1); }
}
</style>