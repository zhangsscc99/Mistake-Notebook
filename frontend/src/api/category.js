// 分类管理API服务
import axios from 'axios'

const API_BASE_URL = process.env.VUE_APP_API_BASE_URL || 'http://localhost:8080/api'

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
    return response
  },
  error => {
    if (error.response?.status === 401) {
      // 清除token并跳转到登录页
      localStorage.removeItem('token')
      // 这里可以添加路由跳转逻辑
    }
    return Promise.reject(error)
  }
)

// 分类API对象
const categoryAPI = {
  /**
   * 获取分类列表
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
      console.error('获取分类列表失败:', error)
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
      console.error('获取分类详情失败:', error)
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
      console.error('获取分类题目失败:', error)
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
      return {
        success: false,
        message: error.response?.data?.message || '创建分类失败'
      }
    }
  },

  /**
   * 更新分类
   * @param {string} categoryId - 分类ID
   * @param {Object} categoryData - 分类数据
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
      return {
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
      return {
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
        data: result.data,
        message: '获取统计信息成功'
      }
    } catch (error) {
      console.error('获取统计信息失败:', error)
      throw error
    }
  }
}

export default categoryAPI
