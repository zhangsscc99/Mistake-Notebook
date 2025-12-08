// API 统一配置文件
import axios from 'axios'

// 从环境变量获取 API 基础地址
// 本地开发环境 (npm run dev): http://localhost:8080/api
// 服务器开发环境 (npm run serve): http://103.146.124.206:8080/api (需要在服务器上创建 .env.development)
// 生产环境 (npm run build): /api (通过 Nginx 代理)
export const API_BASE_URL = process.env.VUE_APP_API_BASE_URL || 'http://localhost:8080/api'

// 创建默认 axios 实例（用于普通 API 请求）
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 创建用于文件上传的 axios 实例（超时时间更长）
export const uploadClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 300000, // 5分钟，图像识别可能需要较长时间
  // 不设置 Content-Type，让 axios 自动设置 FormData 的 Content-Type
})

// 通用请求拦截器（添加 token）
const requestInterceptor = (config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
}

// 通用响应拦截器
const responseInterceptor = (response) => {
  return response
}

const errorInterceptor = (error) => {
  if (error.response?.status === 401) {
    // 清除token并跳转到登录页
    localStorage.removeItem('token')
    // 这里可以添加路由跳转逻辑
  }
  console.error('API请求失败:', error)
  return Promise.reject(error)
}

// 为两个实例添加拦截器
apiClient.interceptors.request.use(requestInterceptor)
apiClient.interceptors.response.use(responseInterceptor, errorInterceptor)

uploadClient.interceptors.request.use(requestInterceptor)
uploadClient.interceptors.response.use(responseInterceptor, errorInterceptor)

export default apiClient

