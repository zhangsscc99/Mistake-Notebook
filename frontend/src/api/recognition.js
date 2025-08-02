// 图像识别API服务
import axios from 'axios'

const API_BASE_URL = process.env.VUE_APP_API_BASE_URL || 'http://localhost:3060/api'

// 创建axios实例
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 图像识别可能需要较长时间
  headers: {
    'Content-Type': 'multipart/form-data'
  }
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
    
    // 添加图片文件到表单数据
    images.forEach((image, index) => {
      formData.append(`images`, image.file)
    })
    
    try {
      // 发送识别请求
      const result = await apiClient.post('/recognition/images', formData)
      
      return {
        success: true,
        data: result.data,
        message: '识别成功'
      }
    } catch (error) {
      // 如果后端还未实现，返回模拟数据
      if (error.code === 'ECONNREFUSED' || error.response?.status === 404) {
        console.warn('后端API未启动，使用模拟数据')
        return this.getMockRecognitionResult(images)
      }
      
      throw {
        success: false,
        message: error.response?.data?.message || '识别失败',
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
  }
}

export default imageRecognitionAPI