// 使用统一的 API 配置
import { apiClient as api } from './config'

/**
 * 获取所有分类列表（包含题目数量）
 */
export const getAllCategories = async () => {
  try {
    const response = await api.get('/categories')
    console.log('获取分类列表:', response.data)
    return response.data
  } catch (error) {
    console.error('获取分类列表失败:', error)
    throw error
  }
}

/**
 * 获取分类统计信息
 */
export const getCategoryStats = async () => {
  try {
    const response = await api.get('/categories/stats')
    console.log('获取统计信息:', response.data)
    return response.data
  } catch (error) {
    console.error('获取统计信息失败:', error)
    throw error
  }
}

/**
 * 根据分类ID获取题目列表
 */
export const getQuestionsByCategory = async (categoryId) => {
  try {
    const response = await api.get(`/questions/by-category/${categoryId}`)
    console.log(`获取分类${categoryId}的题目:`, response.data)
    return response.data
  } catch (error) {
    console.error(`获取分类${categoryId}题目失败:`, error)
    throw error
  }
}

export default {
  getAllCategories,
  getCategoryStats,
  getQuestionsByCategory
}