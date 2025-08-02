// 分类管理API服务
import axios from 'axios'

const API_BASE_URL = process.env.VUE_APP_API_BASE_URL || 'http://localhost:3060/api'

// 创建axios实例
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器
apiClient.interceptors.request.use(
  config => {
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
    console.error('Category API Error:', error)
    return Promise.reject(error)
  }
)

export const categoryAPI = {
  /**
   * 获取所有分类列表
   * @returns {Promise} 分类列表
   */
  async getCategories() {
    try {
      const result = await apiClient.get('/categories')
      return {
        success: true,
        data: result.data,
        message: '获取分类成功'
      }
    } catch (error) {
      if (error.code === 'ECONNREFUSED' || error.response?.status === 404) {
        console.warn('后端API未启动，使用模拟数据')
        return this.getMockCategories()
      }
      throw error
    }
  },

  /**
   * 获取分类详情
   * @param {string} categoryId - 分类ID
   * @returns {Promise} 分类详情
   */
  async getCategoryDetail(categoryId) {
    try {
      const result = await apiClient.get(`/categories/${categoryId}`)
      return {
        success: true,
        data: result.data
      }
    } catch (error) {
      if (error.code === 'ECONNREFUSED' || error.response?.status === 404) {
        return this.getMockCategoryDetail(categoryId)
      }
      throw error
    }
  },

  /**
   * 获取分类下的题目列表
   * @param {string} categoryId - 分类ID
   * @param {Object} params - 查询参数
   * @returns {Promise} 题目列表
   */
  async getCategoryQuestions(categoryId, params = {}) {
    try {
      const result = await apiClient.get(`/categories/${categoryId}/questions`, { params })
      return {
        success: true,
        data: result.data
      }
    } catch (error) {
      if (error.code === 'ECONNREFUSED' || error.response?.status === 404) {
        return this.getMockCategoryQuestions(categoryId, params)
      }
      throw error
    }
  },

  /**
   * 创建新分类
   * @param {Object} categoryData - 分类数据
   * @returns {Promise} 创建结果
   */
  async createCategory(categoryData) {
    try {
      const result = await apiClient.post('/categories', categoryData)
      return {
        success: true,
        data: result.data,
        message: '创建分类成功'
      }
    } catch (error) {
      throw {
        success: false,
        message: error.response?.data?.message || '创建分类失败'
      }
    }
  },

  /**
   * 更新分类信息
   * @param {string} categoryId - 分类ID
   * @param {Object} categoryData - 更新的分类数据
   * @returns {Promise} 更新结果
   */
  async updateCategory(categoryId, categoryData) {
    try {
      const result = await apiClient.put(`/categories/${categoryId}`, categoryData)
      return {
        success: true,
        data: result.data,
        message: '更新分类成功'
      }
    } catch (error) {
      throw {
        success: false,
        message: error.response?.data?.message || '更新分类失败'
      }
    }
  },

  /**
   * 删除分类
   * @param {string} categoryId - 分类ID
   * @returns {Promise} 删除结果
   */
  async deleteCategory(categoryId) {
    try {
      await apiClient.delete(`/categories/${categoryId}`)
      return {
        success: true,
        message: '删除分类成功'
      }
    } catch (error) {
      throw {
        success: false,
        message: error.response?.data?.message || '删除分类失败'
      }
    }
  },

  /**
   * 获取分类统计信息
   * @returns {Promise} 统计信息
   */
  async getCategoryStats() {
    try {
      const result = await apiClient.get('/categories/stats')
      return {
        success: true,
        data: result.data
      }
    } catch (error) {
      if (error.code === 'ECONNREFUSED' || error.response?.status === 404) {
        return this.getMockCategoryStats()
      }
      throw error
    }
  },

  // ===== 模拟数据方法 =====

  /**
   * 获取模拟分类列表
   */
  async getMockCategories() {
    await new Promise(resolve => setTimeout(resolve, 500))
    
    return {
      success: true,
      data: [
        {
          id: 1,
          name: '数学 - 二次函数',
          description: '关于二次函数的图像、性质等问题',
          icon: 'chart-trending-o',
          color: '#1976d2',
          count: 15,
          tags: ['函数', '图像', '最值', '对称轴'],
          lastUpdated: Date.now() - 3600000,
          createdAt: Date.now() - 86400000 * 7
        },
        {
          id: 2,
          name: '物理 - 力学',
          description: '牛顿定律、受力分析相关题目',
          icon: 'fire-o',
          color: '#ff5722',
          count: 8,
          tags: ['牛顿定律', '受力分析', '加速度'],
          lastUpdated: Date.now() - 7200000,
          createdAt: Date.now() - 86400000 * 5
        },
        {
          id: 3,
          name: '化学 - 有机化学',
          description: '有机物的结构、反应机制等',
          icon: 'experiment',
          color: '#4caf50',
          count: 12,
          tags: ['有机反应', '分子结构', '合成'],
          lastUpdated: Date.now() - 86400000,
          createdAt: Date.now() - 86400000 * 3
        },
        {
          id: 4,
          name: '英语 - 语法',
          description: '时态、语态、从句等语法问题',
          icon: 'chat-o',
          color: '#9c27b0',
          count: 6,
          tags: ['时态', '从句', '语态'],
          lastUpdated: Date.now() - 172800000,
          createdAt: Date.now() - 86400000 * 2
        }
      ],
      message: '获取分类成功'
    }
  },

  /**
   * 获取模拟分类详情
   */
  async getMockCategoryDetail(categoryId) {
    await new Promise(resolve => setTimeout(resolve, 300))
    
    const categories = {
      1: {
        id: 1,
        name: '数学 - 二次函数',
        description: '关于二次函数的图像、性质等问题',
        icon: 'chart-trending-o',
        color: '#1976d2',
        count: 15,
        tags: ['函数', '图像', '最值', '对称轴'],
        lastUpdated: Date.now() - 3600000,
        createdAt: Date.now() - 86400000 * 7,
        accuracy: 75,
        practiceCount: 45,
        difficulty: 'medium'
      }
    }
    
    return {
      success: true,
      data: categories[categoryId] || categories[1]
    }
  },

  /**
   * 获取模拟分类题目列表
   */
  async getMockCategoryQuestions(categoryId, params) {
    await new Promise(resolve => setTimeout(resolve, 800))
    
    const questions = [
      {
        id: 1,
        categoryId: categoryId,
        recognizedText: '已知函数f(x) = x² - 2x + 1，求f(x)的最小值。',
        imageUrl: 'https://via.placeholder.com/300x200?text=Math+Question+1',
        tags: ['二次函数', '最值', '配方法'],
        difficulty: 'medium',
        confidence: 0.95,
        createdAt: Date.now() - 3600000,
        isCorrect: true,
        selected: false,
        practiceCount: 3,
        lastPracticed: Date.now() - 86400000
      },
      {
        id: 2,
        categoryId: categoryId,
        recognizedText: '求函数y = x² + 4x + 3的顶点坐标。',
        imageUrl: 'https://via.placeholder.com/300x200?text=Math+Question+2',
        tags: ['二次函数', '顶点', '坐标'],
        difficulty: 'easy',
        confidence: 0.88,
        createdAt: Date.now() - 7200000,
        isCorrect: false,
        selected: false,
        practiceCount: 1,
        lastPracticed: Date.now() - 172800000
      },
      {
        id: 3,
        categoryId: categoryId,
        recognizedText: '已知抛物线y = ax² + bx + c经过点(1,0), (2,0), (0,2)，求a, b, c的值。',
        imageUrl: 'https://via.placeholder.com/300x200?text=Math+Question+3',
        tags: ['二次函数', '待定系数法', '抛物线'],
        difficulty: 'hard',
        confidence: 0.82,
        createdAt: Date.now() - 86400000,
        isCorrect: true,
        selected: false,
        practiceCount: 2,
        lastPracticed: Date.now() - 259200000
      }
    ]
    
    return {
      success: true,
      data: {
        questions: questions,
        total: questions.length,
        page: params.page || 1,
        pageSize: params.pageSize || 20
      }
    }
  },

  /**
   * 获取模拟统计信息
   */
  async getMockCategoryStats() {
    await new Promise(resolve => setTimeout(resolve, 300))
    
    return {
      success: true,
      data: {
        totalQuestions: 41,
        totalCategories: 4,
        todayAdded: 3,
        weeklyAdded: 12,
        averageAccuracy: 78,
        totalPracticeTime: 1250 // 分钟
      }
    }
  }
}

export default categoryAPI