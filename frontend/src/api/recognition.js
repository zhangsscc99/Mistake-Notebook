// 图像识别API服务
import axios from 'axios'

const API_BASE_URL = process.env.VUE_APP_API_BASE_URL || 'http://localhost:8080/api'

// 创建axios实例
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 图像识别可能需要较长时间
  // 移除默认的Content-Type，让axios自动设置FormData的Content-Type
})

// 请求拦截器
apiClient.interceptors.request.use(
  config => {
    // 可以在这里添加认证token等
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  error => {
    return Promise.reject(error)
  }
)

// 响应拦截器
apiClient.interceptors.response.use(
  response => {
    return response.data
  },
  error => {
    console.error('API Error:', error)
    return Promise.reject(error)
  }
)

export const imageRecognitionAPI = {
  /**
   * 识别图片中的文字和题目信息
   * @param {Array} images - 图片文件数组
   * @returns {Promise} 识别结果
   */
  async recognizeImages(images) {
    const formData = new FormData()
    
    // 题目分割识别只支持单个文件，使用第一个图片
    if (images && images.length > 0) {
      formData.append('file', images[0].file)
    }
    
    try {
      // 发送题目分割识别请求
      const result = await apiClient.post('/upload/question-segment', formData)
      
      return {
        success: true,
        data: result.data,
        message: '识别成功'
      }
    } catch (error) {
      // 如果后端还未实现，返回模拟数据
      if (error.code === 'ECONNREFUSED' || error.response?.status === 404) {
        console.warn('后端API未启动，使用模拟数据')
        return this.getMockQuestionSegmentResult(images)
      }
      
      throw {
        success: false,
        message: error.response?.data?.message || '识别失败',
        error: error
      }
    }
  },

  /**
   * 题目分割识别
   * @param {File} imageFile - 单个图片文件
   * @returns {Promise} 分割识别结果
   */
  async recognizeAndSegmentQuestions(imageFile) {
    const formData = new FormData()
    formData.append('file', imageFile)
    
    try {
      const result = await apiClient.post('/upload/question-segment', formData)
      
      return {
        success: true,
        data: result.data,
        message: '题目分割识别成功'
      }
    } catch (error) {
      // 如果后端还未实现，返回模拟数据
      if (error.code === 'ECONNREFUSED' || error.response?.status === 404) {
        console.warn('后端API未启动，使用模拟数据')
        return this.getMockQuestionSegmentResult([{ file: imageFile }])
      }
      
      throw {
        success: false,
        message: error.response?.data?.message || '题目分割识别失败',
        error: error
      }
    }
  },

  /**
   * 获取模拟识别结果
   * @param {Array} images - 图片文件数组
   * @returns {Promise} 模拟结果
   */
  async getMockRecognitionResult(images) {
    // 模拟API延迟
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    const mockResults = images.map((image, index) => ({
      imageId: `img_${Date.now()}_${index}`,
      imageName: image.name,
      recognizedText: this.getMockText(index),
      questions: this.getMockQuestions(index),
      category: this.getMockCategory(index),
      confidence: Math.random() * 0.3 + 0.7 // 0.7-1.0的置信度
    }))

    return {
      success: true,
      data: {
        results: mockResults,
        totalProcessed: images.length,
        categoriesFound: [...new Set(mockResults.map(r => r.category.name))].length
      },
      message: '识别成功'
    }
  },

  /**
   * 获取模拟识别文本
   */
  getMockText(index) {
    const texts = [
      '已知函数f(x) = x² - 2x + 1，求f(x)的最小值。',
      '一质量为2kg的物体在水平面上受到10N的水平推力，求物体的加速度。',
      '化学反应CH₄ + 2O₂ → CO₂ + 2H₂O中，CH₄的摩尔质量是多少？',
      'Complete the sentence: I have been living here _____ five years.'
    ]
    return texts[index % texts.length]
  },

  /**
   * 获取模拟题目信息
   */
  getMockQuestions(index) {
    const questions = [
      {
        type: 'math',
        subject: '数学',
        difficulty: 'medium',
        keywords: ['二次函数', '最值', '配方法']
      },
      {
        type: 'physics',
        subject: '物理',
        difficulty: 'easy',
        keywords: ['牛顿第二定律', '力与运动', '加速度']
      },
      {
        type: 'chemistry',
        subject: '化学',
        difficulty: 'easy',
        keywords: ['摩尔质量', '化学反应', '计算']
      },
      {
        type: 'english',
        subject: '英语',
        difficulty: 'medium',
        keywords: ['现在完成进行时', '介词', 'for']
      }
    ]
    return questions[index % questions.length]
  },

  /**
   * 获取模拟分类信息
   */
  getMockCategory(index) {
    const categories = [
      {
        id: 'math_quadratic',
        name: '数学-二次函数',
        parentCategory: '数学',
        confidence: 0.95
      },
      {
        id: 'physics_mechanics',
        name: '物理-力学',
        parentCategory: '物理',
        confidence: 0.88
      },
      {
        id: 'chemistry_calculation',
        name: '化学-计算题',
        parentCategory: '化学',
        confidence: 0.82
      },
      {
        id: 'english_grammar',
        name: '英语-语法',
        parentCategory: '英语',
        confidence: 0.90
      }
    ]
    return categories[index % categories.length]
  },

  /**
   * 保存选中的题目到数据库
   * @param {Array} selectedQuestions 选中的题目数组
   * @param {String} category 分类
   * @param {String} difficulty 难度
   * @param {String} imageUrl 图片URL
   * @returns {Promise} 保存结果
   */
  async saveSelectedQuestions(selectedQuestions, category, difficulty, imageUrl) {
    try {
      const requestData = {
        questions: selectedQuestions,
        category: category,
        difficulty: difficulty,
        imageUrl: imageUrl
      }

      const result = await apiClient.post('/upload/save-questions', requestData, {
        headers: {
          'Content-Type': 'application/json'
        }
      })

      return {
        success: true,
        data: result.data,
        message: '题目保存成功'
      }
    } catch (error) {
      console.error('保存题目失败:', error)
      throw {
        success: false,
        message: error.response?.data?.message || '保存失败',
        error: error
      }
    }
  },

  /**
   * 获取模拟题目分割识别结果
   * @param {Array} images - 图片文件数组
   * @returns {Promise} 模拟分割结果
   */
  async getMockQuestionSegmentResult(images) {
    // 模拟API延迟
    await new Promise(resolve => setTimeout(resolve, 2500))
    
    // 模拟识别出的多个题目
    const mockQuestions = [
      {
        id: 1,
        text: "1. (1+5i)的绝对值",
        bounds: { top: 15, left: 10, width: 80, height: 12 },
        confidence: 0.92,
        isDifficult: false
      },
      {
        id: 2,
        text: "2. 设集合U={1,2,3,4,5,6,7,8}，集合A={1,3,5,7}，B(A)表示A在全集U中的补集",
        bounds: { top: 30, left: 10, width: 80, height: 12 },
        confidence: 0.88,
        isDifficult: true
      },
      {
        id: 3,
        text: "3. 若直线l经过点P(1,2)且倾斜角为π/3，则直线l的方程为",
        bounds: { top: 45, left: 10, width: 80, height: 12 },
        confidence: 0.90,
        isDifficult: false
      },
      {
        id: 4,
        text: "4. 若点(a,b)(a>0)是圆M上一点，且到直线y=2tan(x-π/4)的距离为max，M的圆心的横坐标是",
        bounds: { top: 60, left: 10, width: 80, height: 15 },
        confidence: 0.85,
        isDifficult: false
      },
      {
        id: 5,
        text: "5. 设f(x)是定义在R上的函数，若对于任意x≤3时，f(x)=x-21，M=max{f(x)|x∈R}",
        bounds: { top: 78, left: 10, width: 80, height: 15 },
        confidence: 0.87,
        isDifficult: true
      },
      {
        id: 6,
        text: "6. 假设扔掷，运动总量的信息只需满足以下大小的的，是对信息风险的风力",
        bounds: { top: 95, left: 10, width: 80, height: 25 },
        confidence: 0.75,
        isDifficult: false
      }
    ]

    const overallConfidence = mockQuestions.reduce((sum, q) => sum + q.confidence, 0) / mockQuestions.length

    return {
      success: true,
      data: {
        success: true,
        imageUrl: images[0]?.url || '/mock-image-url',
        questionsCount: mockQuestions.length,
        overallConfidence: overallConfidence,
        questions: mockQuestions
      },
      message: '题目分割识别成功'
    }
  }
}

export default imageRecognitionAPI