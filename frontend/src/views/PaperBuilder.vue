<template>
  <div class="paper-builder-page">
    <!-- 顶部操作栏 -->
    <div class="page-header">
      <h2 class="page-title">智能组卷</h2>
      <van-button 
        type="primary" 
        size="small" 
        icon="plus"
        class="create-paper-btn"
        @click="createNewPaper"
      >
        组建新卷
      </van-button>
    </div>

    <!-- 统计卡片（试卷数 / 总题数，对齐小程序） -->
    <div class="paper-stats-card">
      <div class="paper-stat">
        <div class="paper-stat-num">{{ paperStats.paperCount }}</div>
        <div class="paper-stat-label">试卷数</div>
      </div>
      <div class="paper-stat-divider"></div>
      <div class="paper-stat">
        <div class="paper-stat-num">{{ paperStats.totalQuestions }}</div>
        <div class="paper-stat-label">总题数</div>
      </div>
    </div>

    <!-- 当前组卷草稿 -->
    <div class="pending-section" v-if="pendingQuestions.length > 0">
      <div class="section-header">
        <h3>当前组卷 <span class="pending-count">{{ pendingQuestions.length }}题</span></h3>
        <div class="pending-actions">
          <van-button size="mini" type="danger" plain @click="clearPending">清空</van-button>
          <van-button size="mini" type="primary" @click="savePendingAsPaper">保存为试卷</van-button>
        </div>
      </div>
      <div class="pending-question-list">
        <div
          v-for="(q, idx) in pendingQuestions"
          :key="q.id"
          class="pending-question-item"
        >
          <span class="pq-index">{{ idx + 1 }}</span>
          <span class="pq-content">{{ q.content || '（无内容）' }}</span>
          <van-icon name="cross" class="pq-remove" @click="removePending(q)" />
        </div>
      </div>
      <van-button
        type="default"
        size="small"
        block
        class="add-more-btn"
        @click="createNewPaper"
      >继续添加题目</van-button>
    </div>

    <!-- 已保存的试卷列表 -->
    <div class="saved-papers-section" v-if="savedPapers.length > 0">
      <div class="section-header">
        <h3>我的试卷</h3>
      </div>
      
      <div 
        v-for="paper in savedPapers" 
        :key="paper.id"
        class="paper-card tech-card"
        @click="viewPaper(paper)"
      >
        <div class="paper-header">
          <div class="paper-icon">📝</div>
          <div class="paper-info">
            <h4 class="paper-title">{{ paper.title }}</h4>
            <p class="paper-meta">{{ paper.questionCount }} 道题 · {{ paper.createdAt }}</p>
          </div>
          <van-icon
            name="delete-o"
            class="paper-delete-icon"
            color="var(--text-secondary)"
            @click.stop="deletePaperItem(paper)"
          />
          <van-icon name="arrow" color="var(--text-secondary)" />
        </div>
      </div>
    </div>

    <!-- 空状态提示 -->
    <van-empty 
      v-if="savedPapers.length === 0"
      description="还没有组建试卷"
      image="search"
      class="empty-state"
    >
      <van-button 
        type="primary" 
        @click="createNewPaper"
        class="create-paper-btn-large"
      >
        立即组建新卷
      </van-button>
    </van-empty>


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
import { showToast, showLoadingToast, showDialog, showConfirmDialog } from 'vant'
import categoryAPI from '../api/category'
import paperAPI from '../api/paper'
import { apiClient } from '../api/config'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

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
    
    // 已保存的试卷列表
    const savedPapers = reactive([])

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
        
        showToast({ message: '已清空所有题目', type: 'success' })
      } catch (error) {
        // 用户取消
      }
    }

    // 编辑题目分数
    const editQuestionScore = (question) => {
      const score = prompt('请输入题目分数', question.score || 5)
      
      if (score === null) {
        return // 用户取消
      }
      
      const parsedScore = parseInt(score)
      if (parsedScore && parsedScore > 0) {
        question.score = parsedScore
        showToast({ message: '分数设置成功', type: 'success' })
      } else {
        showToast({ message: '请输入有效的分数', type: 'fail' })
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
        showToast('请先选择题目')
        return
      }
      
      showToast('预览功能开发中...')
    }

    // 导出试卷
    const exportPaper = async () => {
      if (allSelectedQuestions.length === 0) {
        showToast('请先选择题目')
        return
      }
      
      if (!paperInfo.title.trim()) {
        showToast('请输入试卷标题')
        return
      }
      
      try {
        showLoadingToast({ message: '正在生成PDF...', forbidClick: true, duration: 0 })
        
        // 模拟导出过程
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        showToast({ message: 'PDF导出成功!', type: 'success' })
        
      } catch (error) {
        console.error('导出失败:', error)
        showToast({ message: '导出失败，请重试', type: 'fail' })
      }
    }

    // 创建新试卷
    const createNewPaper = () => {
      // 跳转到分类选择页面，带上组卷模式标记
      router.push({
        path: '/categories',
        query: { mode: 'paper-builder' }
      })
    }

    // 查看试卷详情
    const viewPaper = (paper) => {
      // 显示试卷详情对话框
      const questionsList = paper.questions.map((q, index) => `
        <div style="padding: 12px; margin-bottom: 8px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(31, 91, 255, 0.15); border-radius: 8px; text-align: left;">
          <div style="display: flex; align-items: flex-start; gap: 8px;">
            <span style="color: var(--text-accent); font-weight: 600; min-width: 30px;">${index + 1}.</span>
            <span style="color: var(--text-primary); flex: 1;">${q.content}</span>
          </div>
        </div>
      `).join('')
      
      // 先显示试卷详情
      showDialog({
        title: paper.title,
        message: `
          <div style="text-align: left;">
            <div style="margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid rgba(31, 91, 255, 0.15);">
              <div style="color: var(--text-secondary); font-size: 14px; margin-bottom: 4px;">
                📊 共 ${paper.questionCount} 道题
              </div>
              <div style="color: var(--text-secondary); font-size: 12px;">
                创建时间：${paper.createdAt}
              </div>
            </div>
            <div style="max-height: 400px; overflow-y: auto;">
              ${questionsList}
            </div>
          </div>
        `,
        allowHtml: true,
        confirmButtonText: '导出选项',
        className: 'paper-detail-dialog'
      }).then(() => {
        // 用户点击"导出选项"，显示导出方式选择
        showExportOptions(paper)
      }).catch(() => {
        // 用户关闭对话框
      })
    }
    
    // 显示导出选项
    const showExportOptions = (paper) => {
      showConfirmDialog({
        title: '选择导出方式',
        message: '请选择导出PDF的方式',
        confirmButtonText: '带解析版',
        cancelButtonText: '不带解析',
        className: 'export-options-dialog'
      }).then(() => {
        // 导出带解析的PDF
        exportPaperPDF(paper, true)
      }).catch(() => {
        // 导出不带解析的PDF
        exportPaperPDF(paper, false)
      })
    }
    
    // 导出试卷PDF
    const exportPaperPDF = async (paper, withAnalysis) => {
      const mode = withAnalysis ? '带解析' : '不带解析'
      showLoadingToast({ message: `正在生成${mode}PDF...`, forbidClick: true, duration: 0 })
      
      try {
        // 等待一下让loading显示出来
        await new Promise(resolve => setTimeout(resolve, 300))

        // 带解析版导出前，刷新最新 AI 答案/解析
        if (withAnalysis) {
          const freshQuestions = await refreshPaperAnalysis(paper)
          paper = { ...paper, questions: freshQuestions }
        }

        // 创建临时容器用于渲染HTML
        const container = document.createElement('div')
        container.style.cssText = `
          position: fixed;
          left: -9999px;
          top: 0;
          width: 800px;
          background: white;
          padding: 40px;
          font-family: "SimSun", "宋体", serif;
          line-height: 1.8;
          color: #333;
        `
        
        // 生成HTML内容
        let htmlContent = `
          <div style="text-align: center; margin-bottom: 40px; border-bottom: 2px solid #2459ff; padding-bottom: 20px;">
            <div style="font-size: 24px; font-weight: bold; margin-bottom: 10px;">${paper.title}</div>
            <div style="font-size: 14px; color: #666;">共 ${paper.questionCount} 道题 · 创建时间：${paper.createdAt}</div>
          </div>
          <div>
        `
        
        // 添加题目内容
        paper.questions.forEach((q, index) => {
          htmlContent += `
            <div style="margin-bottom: ${withAnalysis ? '40px' : '30px'};">
              <div style="font-weight: bold; color: #2459ff; margin-bottom: 8px;">第 ${index + 1} 题</div>
              <div style="margin-bottom: 15px; padding: 15px; background: #f9f9f9; border-left: 4px solid #2459ff; border-radius: 4px;">
                ${q.content}
              </div>
          `
          
          // 只有带解析版才显示答案和解析
          if (withAnalysis) {
            htmlContent += `
              <div style="margin-top: 15px; padding: 15px; background: #fff8e1; border-left: 4px solid #4caf50; border-radius: 4px;">
                <div style="font-weight: bold; color: #4caf50; margin-bottom: 8px;">参考答案</div>
                <div>${q.answer || 'A'}</div>
              </div>
              <div style="margin-top: 10px; padding: 15px; background: #e3f2fd; border-left: 4px solid #2196f3; border-radius: 4px;">
                <div style="font-weight: bold; color: #2196f3; margin-bottom: 8px;">详细解析</div>
                <div>${q.analysis || 'AI暂未给出解析'}</div>
              </div>
            `
          } else {
            // 不带解析版：添加空白答题区域
            htmlContent += `
              <div style="margin-top: 15px; padding: 40px; background: #fafafa; border: 1px dashed #ddd; border-radius: 4px; min-height: 80px;">
                <div style="color: #999; font-size: 12px;">答题区域（请在此处作答）</div>
              </div>
            `
          }
          
          htmlContent += `</div>`
        })
        
        htmlContent += `
          </div>
          <div style="margin-top: 60px; text-align: center; color: #999; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px;">
            本试卷由智能组卷系统生成
          </div>
        `
        
        container.innerHTML = htmlContent
        document.body.appendChild(container)
        
        // 使用html2canvas转换为图片
        const canvas = await html2canvas(container, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff'
        })
        
        // 移除临时容器
        document.body.removeChild(container)
        
        // 创建PDF
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        })
        
        const imgData = canvas.toDataURL('image/png')
        const imgWidth = 210 // A4宽度
        const pageHeight = 297 // A4高度
        const imgHeight = (canvas.height * imgWidth) / canvas.width
        let heightLeft = imgHeight
        let position = 0
        
        // 添加第一页
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
        
        // 如果内容超过一页，添加更多页面
        while (heightLeft > 0) {
          position = heightLeft - imgHeight
          pdf.addPage()
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
          heightLeft -= pageHeight
        }
        
        // 下载PDF
        pdf.save(`${paper.title}_${mode}.pdf`)
        
        showToast({ message: `${mode}PDF已下载!`, type: 'success' })
        console.log('导出试卷:', paper.title, '模式:', mode)
        
      } catch (error) {
        console.error('导出失败:', error)
        showToast({ message: '导出失败：' + error.message, type: 'fail' })
      }
    }

    // 统计：试卷数 / 总题数
    const paperStats = computed(() => ({
      paperCount: savedPapers.length,
      totalQuestions: savedPapers.reduce((sum, p) => sum + (p.questionCount || (p.questions ? p.questions.length : 0)), 0)
    }))

    // 导出带解析版前，刷新题目的最新 AI 答案/解析（对齐小程序 question.batch）
    const refreshPaperAnalysis = async (paper) => {
      const ids = (paper.questions || [])
        .map(q => q.id)
        .filter(id => id !== undefined && id !== null && !Number.isNaN(Number(id)))
        .map(Number)
      if (!ids.length) return paper.questions
      try {
        const res = await apiClient.post('/questions/batch', ids)
        const fresh = res.data?.data || []
        const map = new Map(fresh.map(q => [String(q.id), q]))
        return (paper.questions || []).map(q => {
          const f = map.get(String(q.id))
          if (!f) return q
          return {
            ...q,
            answer: (f.aiAnswer && f.aiAnswer !== '待补充') ? f.aiAnswer : q.answer,
            analysis: (f.aiAnalysis && f.aiAnalysis !== 'AI暂未给出解析') ? f.aiAnalysis : q.analysis
          }
        })
      } catch (e) {
        console.warn('刷新试卷解析失败，使用已保存内容', e)
        return paper.questions
      }
    }

    // 加载已保存的试卷（云端优先）
    const loadSavedPapers = async () => {
      try {
        const papers = await paperAPI.listPapers()
        savedPapers.splice(0, savedPapers.length, ...papers)
      } catch (e) {
        console.error('加载试卷失败:', e)
      }
    }

    // 删除试卷
    const deletePaperItem = async (paper) => {
      try {
        await showConfirmDialog({ title: '确认删除', message: `确定要删除试卷「${paper.title}」吗？` })
      } catch {
        return
      }
      await paperAPI.deletePaper(paper.id)
      const idx = savedPapers.findIndex(p => String(p.id) === String(paper.id))
      if (idx > -1) savedPapers.splice(idx, 1)
      showToast({ message: '已删除', type: 'success' })
    }

    // 加载可用分类
    const loadAvailableCategories = async () => {
      try {
        const result = await categoryAPI.getCategories()
        console.log('PaperBuilder - 分类API响应:', result)
        if (result.success && result.data && result.data.data) {
          const categories = result.data.data.map(cat => ({
            id: cat.id,
            name: cat.name,
            description: cat.description || '暂无描述',
            icon: cat.icon || 'apps-o',
            color: cat.color || '#2459ff',
            count: cat.questionCount || 0
          }))
          availableCategories.splice(0, availableCategories.length, ...categories)
          console.log('PaperBuilder - 成功加载分类:', categories)
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
            color: '#2459ff',
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

    // 当前草稿题目（从分类详情页「加入组卷」带来）
    const pendingQuestions = reactive([])

    // 加载草稿题目（从 sessionStorage）
    const loadPendingQuestions = () => {
      const json = sessionStorage.getItem('pendingPaperQuestions')
      if (json) {
        try {
          const list = JSON.parse(json)
          pendingQuestions.splice(0, pendingQuestions.length, ...list.map(q => ({ ...q, score: q.score || 5 })))
        } catch (e) {
          console.error('解析草稿题目失败:', e)
        }
      }
    }

    // 清空草稿
    const clearPending = async () => {
      try {
        await showConfirmDialog({ title: '确认清空', message: '确定要清空当前组卷的所有题目吗？' })
        pendingQuestions.splice(0)
        sessionStorage.removeItem('pendingPaperQuestions')
        showToast({ message: '已清空', type: 'success' })
      } catch (e) { /* 取消 */ }
    }

    // 从草稿中移除单题
    const removePending = (question) => {
      const idx = pendingQuestions.findIndex(q => q.id === question.id)
      if (idx > -1) {
        pendingQuestions.splice(idx, 1)
        sessionStorage.setItem('pendingPaperQuestions', JSON.stringify(pendingQuestions))
      }
    }

    // 将草稿保存为试卷
    const savePendingAsPaper = () => {
      if (pendingQuestions.length === 0) {
        showToast('当前组卷没有题目')
        return
      }
      let inputValue = '数学练习卷'
      showConfirmDialog({
        title: '保存试卷',
        message: `
          <div style="text-align:left;padding:20px 0;">
            <div style="margin-bottom:8px;color:var(--text-secondary);font-size:14px;">请输入试卷名称</div>
            <input id="pending-paper-title" type="text" value="数学练习卷"
              style="width:100%;padding:12px;border:1px solid rgba(31,91,255,0.3);border-radius:8px;
                     font-size:14px;background:rgba(255,255,255,0.05);color:var(--text-primary);
                     outline:none;box-sizing:border-box;" />
          </div>`,
        allowHtml: true,
        confirmButtonText: '保存',
        cancelButtonText: '取消',
        beforeClose: (action) => {
          if (action === 'confirm') {
            const input = document.getElementById('pending-paper-title')
            inputValue = input ? input.value : '数学练习卷'
          }
          return true
        }
      }).then(async () => {
        if (!inputValue || !inputValue.trim()) { showToast('请输入试卷名称'); return }
        const { paper, localOnly } = await paperAPI.savePaper(
          pendingQuestions.map(q => ({ ...q })),
          inputValue.trim()
        )
        savedPapers.unshift(paper)
        pendingQuestions.splice(0)
        sessionStorage.removeItem('pendingPaperQuestions')
        showToast({ message: localOnly ? '已本地保存' : '试卷保存成功', type: 'success' })
      }).catch(() => {})
      setTimeout(() => {
        const input = document.getElementById('pending-paper-title')
        if (input) { input.focus(); input.select() }
      }, 100)
    }

    // 组件挂载
    onMounted(async () => {
      await loadAvailableCategories()
      loadSavedPapers()
      loadPendingQuestions()
    })

    return {
      paperInfo,
      paperStats,
      selectedCategories,
      allSelectedQuestions,
      availableCategories,
      savedPapers,
      pendingQuestions,
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
      clearPending,
      removePending,
      savePendingAsPaper,
      editQuestionScore,
      onDurationConfirm,
      onScoreConfirm,
      previewPaper,
      exportPaper,
      createNewPaper,
      viewPaper,
      exportPaperPDF,
      showExportOptions,
      deletePaperItem
    }
  }
}
</script>

<style scoped>
.paper-stats-card {
  display: flex;
  align-items: center;
  justify-content: space-around;
  margin: 0 16px 16px;
  padding: 18px 16px;
  border-radius: var(--radius-lg, 16px);
  background: linear-gradient(135deg, rgba(36, 89, 255, 0.92), rgba(82, 183, 255, 0.92));
  color: #fff;
  box-shadow: 0 12px 32px rgba(31, 91, 255, 0.24);
}

.paper-stat {
  text-align: center;
  flex: 1;
}

.paper-stat-num {
  font-size: 26px;
  font-weight: 800;
  line-height: 1.1;
}

.paper-stat-label {
  font-size: 13px;
  opacity: 0.92;
  margin-top: 4px;
}

.paper-stat-divider {
  width: 1px;
  height: 32px;
  background: rgba(255, 255, 255, 0.35);
}

.paper-builder-page {
  min-height: 100vh;
  background: var(--bg-primary);
  padding-bottom: 60px;
  position: relative;
}

/* 当前组卷草稿区 */
.pending-section {
  padding: 20px 20px 8px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.section-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.pending-count {
  font-size: 13px;
  color: var(--text-accent);
  margin-left: 6px;
}

.pending-actions {
  display: flex;
  gap: 8px;
}

.pending-question-list {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  overflow: hidden;
  margin-bottom: 12px;
}

.pending-question-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  gap: 10px;
}

.pending-question-item:last-child {
  border-bottom: none;
}

.pq-index {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-accent);
  min-width: 22px;
}

.pq-content {
  flex: 1;
  font-size: 13px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pq-remove {
  font-size: 16px;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
}

.pq-remove:hover {
  color: #ff4d4f;
}

.add-more-btn {
  border-color: var(--border-glow) !important;
  color: var(--text-accent) !important;
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
    radial-gradient(circle 500px at 30% 20%, rgba(31, 91, 255, 0.05) 0%, transparent 50%),
    radial-gradient(circle 400px at 70% 80%, rgba(82, 183, 255, 0.04) 0%, transparent 50%);
  animation: floatingGlow 35s ease-in-out infinite;
  pointer-events: none;
  z-index: -1;
}

/* 📋 页面顶部 */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border-color);
  box-shadow: var(--shadow-glow);
}

.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  background: linear-gradient(135deg, var(--text-primary), var(--text-accent));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.create-paper-btn {
  background: linear-gradient(135deg, var(--primary-color), var(--primary-light)) !important;
  border: none !important;
  color: var(--bg-primary) !important;
  font-weight: 600 !important;
  box-shadow: 0 4px 16px rgba(31, 91, 255, 0.3) !important;
  border-radius: var(--radius-md) !important;
}

.create-paper-btn-large {
  background: linear-gradient(135deg, var(--primary-color), var(--primary-light)) !important;
  border: none !important;
  color: var(--bg-primary) !important;
  font-weight: 600 !important;
  padding: 12px 32px !important;
  font-size: 16px !important;
  box-shadow: 0 4px 16px rgba(31, 91, 255, 0.3) !important;
  border-radius: var(--radius-md) !important;
}

/* 📝 试卷列表 */
.saved-papers-section {
  padding: 20px;
}

.paper-card {
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
  position: relative;
  overflow: hidden;
}

.paper-card::before {
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

.paper-card:hover {
  border-color: var(--border-glow);
  box-shadow: 
    0 0 40px rgba(31, 91, 255, 0.15),
    var(--shadow-inner),
    var(--shadow-hover);
  transform: translateY(-4px);
}

.paper-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.paper-icon {
  font-size: 32px;
  filter: drop-shadow(0 2px 4px rgba(31, 91, 255, 0.3));
}

.paper-delete-icon {
  font-size: 18px;
  padding: 4px;
}

.paper-info {
  flex: 1;
  min-width: 0;
}

.paper-title {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.paper-meta {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.paper-stats {
  display: flex;
  gap: 8px;
  padding-left: 44px;
}

.stat-badge {
  background: rgba(31, 91, 255, 0.15);
  color: var(--text-accent);
  border: 1px solid rgba(31, 91, 255, 0.3);
  border-radius: var(--radius-sm);
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 500;
}

/* 🌌 空状态 */
.empty-state {
  margin-top: 100px;
  padding: 40px 20px;
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
  background: rgba(31, 91, 255, 0.05);
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
  text-shadow: 0 0 8px rgba(31, 91, 255, 0.3);
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
  background: rgba(31, 91, 255, 0.15) !important;
  color: var(--text-accent) !important;
  border: 1px solid rgba(31, 91, 255, 0.3) !important;
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
  box-shadow: 0 4px 16px rgba(31, 91, 255, 0.3) !important;
  border-radius: var(--radius-md) !important;
}

.add-category-btn {
  background: linear-gradient(135deg, var(--primary-color), var(--primary-light)) !important;
  border: none !important;
  color: var(--bg-primary) !important;
  font-weight: 600 !important;
  box-shadow: 0 4px 16px rgba(31, 91, 255, 0.3) !important;
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

/* 🔥 强制覆盖底部导航栏样式 */
:deep(.van-tabbar) {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.88), rgba(255, 255, 255, 0.72)) !important;
  backdrop-filter: blur(18px) saturate(1.35) !important;
  -webkit-backdrop-filter: blur(18px) saturate(1.35) !important;
  border-top: 1px solid rgba(47, 107, 255, 0.16) !important;
  box-shadow: 
    0 -14px 34px rgba(11, 22, 51, 0.10) !important,
    0 -1px 0 rgba(255, 255, 255, 0.72) !important;
  padding: 8px 12px !important;
}

:deep(.van-tabbar-item) {
  color: rgba(11, 22, 51, 0.60) !important;
  border-radius: 12px !important;
  margin: 0 4px !important;
  padding: 6px 8px !important;
  transition: transform 0.22s var(--ease-smooth), background 0.22s var(--ease-smooth), color 0.22s var(--ease-smooth) !important;
  position: relative !important;
  overflow: hidden !important;
}

:deep(.van-tabbar-item:hover) {
  background: transparent !important;
  transform: translateY(-1px) !important;
}

:deep(.van-tabbar-item--active) {
  color: #2459ff !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
}

:deep(.van-tabbar-item--active .van-tabbar-item__text) {
  color: #2459ff !important;
  font-weight: 700 !important;
  text-shadow: 0 0 12px rgba(31, 91, 255, 0.16) !important;
  background: none !important;
  -webkit-background-clip: initial !important;
  background-clip: initial !important;
  -webkit-text-fill-color: currentColor !important;
  animation: none !important;
}

:deep(.van-tabbar-item--active .van-tabbar-item__icon) {
  color: #2459ff !important;
  filter: drop-shadow(0 0 10px rgba(31, 91, 255, 0.18)) !important;
  transform: scale(1.1) !important;
  animation: none !important;
}

/* Remove global active indicator/glow layers from App.vue on this page. */
:deep(.van-tabbar-item--active::before),
:deep(.van-tabbar-item--active::after) {
  content: none !important;
}

/* 🌑 试卷详情对话框 - 深色主题 */
:deep(.paper-detail-dialog .van-dialog) {
  background: var(--bg-card) !important;
  backdrop-filter: blur(12px) !important;
  border: 1px solid var(--border-color) !important;
  border-radius: var(--radius-xl) !important;
  box-shadow: 
    var(--shadow-glow),
    var(--shadow-inner),
    var(--shadow-card) !important;
}

:deep(.paper-detail-dialog .van-dialog)::before {
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

:deep(.paper-detail-dialog .van-dialog__header) {
  color: var(--text-primary) !important;
  background: transparent !important;
  font-weight: 700 !important;
  background: linear-gradient(135deg, var(--text-primary), var(--text-accent)) !important;
  -webkit-background-clip: text !important;
  -webkit-text-fill-color: transparent !important;
  background-clip: text !important;
}

:deep(.paper-detail-dialog .van-dialog__message) {
  color: var(--text-primary) !important;
  text-align: left !important;
}

:deep(.paper-detail-dialog .van-dialog__confirm) {
  background: linear-gradient(135deg, var(--primary-color), var(--primary-light)) !important;
  color: var(--bg-primary) !important;
  border: none !important;
  font-weight: 600 !important;
}

:deep(.paper-detail-dialog .van-dialog__cancel) {
  color: var(--text-secondary) !important;
}

/* 🌑 导出选项对话框 - 深色主题 */
:deep(.export-options-dialog .van-dialog) {
  background: var(--bg-card) !important;
  backdrop-filter: blur(12px) !important;
  border: 1px solid var(--border-color) !important;
  border-radius: var(--radius-xl) !important;
  box-shadow: 
    var(--shadow-glow),
    var(--shadow-inner),
    var(--shadow-card) !important;
}

:deep(.export-options-dialog .van-dialog)::before {
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

:deep(.export-options-dialog .van-dialog__header) {
  color: var(--text-primary) !important;
  background: transparent !important;
  font-weight: 700 !important;
  background: linear-gradient(135deg, var(--text-primary), var(--text-accent)) !important;
  -webkit-background-clip: text !important;
  -webkit-text-fill-color: transparent !important;
  background-clip: text !important;
}

:deep(.export-options-dialog .van-dialog__message) {
  color: var(--text-primary) !important;
}

:deep(.export-options-dialog .van-dialog__confirm) {
  background: linear-gradient(135deg, var(--primary-color), var(--primary-light)) !important;
  color: var(--bg-primary) !important;
  border: none !important;
  font-weight: 600 !important;
}

:deep(.export-options-dialog .van-dialog__cancel) {
  background: rgba(31, 91, 255, 0.15) !important;
  color: var(--text-accent) !important;
  border: 1px solid rgba(31, 91, 255, 0.3) !important;
  font-weight: 600 !important;
}
</style>
