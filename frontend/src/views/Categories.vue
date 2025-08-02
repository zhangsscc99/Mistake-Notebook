<template>
  <div class="categories-page">
    <!-- 顶部搜索栏 -->
    <div class="search-section">
      <van-search 
        v-model="searchText" 
        placeholder="搜索错题分类"
        @search="onSearch"
        show-action
        clearable
        class="tech-search"
      >
        <template #action>
          <div @click="onSearch">搜索</div>
        </template>
      </van-search>
    </div>

    <!-- 分类统计卡片 -->
    <div class="stats-section">
          <div class="stats-card">
      <div class="stats-decoration"></div>
      <div class="stat-item">
        <span class="stat-number">{{ totalQuestions }}</span>
        <span class="stat-label">总题数</span>
      </div>
      <div class="stat-item">
        <span class="stat-number">{{ totalCategories }}</span>
        <span class="stat-label">分类数</span>
      </div>
      <div class="stat-item">
        <span class="stat-number">{{ todayAdded }}</span>
        <span class="stat-label">今日新增</span>
      </div>
    </div>
    </div>

    <!-- 分类列表 -->
    <div class="categories-section">
      <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
        <van-list
          v-model:loading="loading"
          :finished="finished"
          finished-text="没有更多了"
          @load="onLoadMore"
        >
          <div 
            v-for="category in filteredCategories" 
            :key="category.id"
            class="category-card"
            @click="viewCategory(category)"
          >
            <div class="category-header">
              <div class="category-icon">
                <van-icon :name="category.icon" :color="category.color" size="24" />
              </div>
              <div class="category-info">
                <h3 class="category-title">{{ category.name }}</h3>
                <p class="category-description">{{ category.description }}</p>
              </div>
              <div class="category-count">
                <span class="count-number">{{ category.count }}</span>
                <span class="count-label">题</span>
              </div>
            </div>
            
            <div class="category-tags" v-if="category.tags && category.tags.length">
              <van-tag 
                v-for="tag in category.tags.slice(0, 3)" 
                :key="tag"
                size="mini"
                class="custom-tag"
              >
                {{ tag }}
              </van-tag>
              <span v-if="category.tags.length > 3" class="more-tags">
                +{{ category.tags.length - 3 }}
              </span>
            </div>

            <div class="category-footer">
              <span class="last-updated">
                最近更新: {{ formatTime(category.lastUpdated) }}
              </span>
              <van-icon name="arrow" />
            </div>
          </div>

          <!-- 空状态 -->
          <van-empty v-if="!loading && filteredCategories.length === 0" 
                     description="暂无分类数据"
                     image="search">
            <van-button type="primary" @click="$router.push('/camera')">
              去拍照录入
            </van-button>
          </van-empty>
        </van-list>
      </van-pull-refresh>
    </div>



    <!-- 底部导航 -->
    <van-tabbar route>
      <van-tabbar-item icon="home-o" to="/camera">首页</van-tabbar-item>
      <van-tabbar-item icon="apps-o" to="/categories">分类</van-tabbar-item>
      <van-tabbar-item icon="edit" to="/paper-builder">组卷</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { categoryAPI } from '../api/category'

export default {
  name: 'Categories',
  setup() {
    const router = useRouter()

    const searchText = ref('')
    const refreshing = ref(false)
    const loading = ref(false)
    const finished = ref(false)

    
    const categories = reactive([])
    const stats = reactive({
      totalQuestions: 0,
      totalCategories: 0,
      todayAdded: 0
    })

    // 计算属性
    const filteredCategories = computed(() => {
      if (!searchText.value) return categories
      return categories.filter(cat => 
        cat.name.includes(searchText.value) || 
        cat.description.includes(searchText.value) ||
        (cat.tags && cat.tags.some(tag => tag.includes(searchText.value)))
      )
    })

    const totalQuestions = computed(() => stats.totalQuestions)
    const totalCategories = computed(() => stats.totalCategories)
    const todayAdded = computed(() => stats.todayAdded)

    // 搜索功能
    const onSearch = () => {
      // 搜索逻辑已通过计算属性实现
      console.log('搜索:', searchText.value)
    }

    // 刷新数据
    const onRefresh = async () => {
      refreshing.value = true
      try {
        await loadCategories()
        await loadStats()
      } finally {
        refreshing.value = false
      }
    }

    // 加载更多
    const onLoadMore = async () => {
      if (finished.value) return
      
      loading.value = true
      try {
        // 模拟加载更多数据
        await new Promise(resolve => setTimeout(resolve, 1000))
        finished.value = true
      } finally {
        loading.value = false
      }
    }

    // 查看分类详情
    const viewCategory = (category) => {
      router.push(`/category/${category.id}`)
    }

    // 格式化时间
    const formatTime = (timestamp) => {
      const date = new Date(timestamp)
      const now = new Date()
      const diff = now - date
      
      if (diff < 60000) return '刚刚'
      if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
      if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
      return `${Math.floor(diff / 86400000)}天前`
    }

    // 加载分类数据
    const loadCategories = async () => {
      try {
        // 模拟API调用
        const mockCategories = [
          {
            id: 1,
            name: '数学 - 二次函数',
            description: '关于二次函数的图像、性质等问题',
            icon: 'chart-trending-o',
            color: '#E8A855',
            count: 15,
            tags: ['函数', '图像', '最值', '对称轴'],
            lastUpdated: Date.now() - 3600000
          },
          {
            id: 2,
            name: '物理 - 力学',
            description: '牛顿定律、受力分析相关题目',
            icon: 'fire-o',
            color: '#ff5722',
            count: 8,
            tags: ['牛顿定律', '受力分析', '加速度'],
            lastUpdated: Date.now() - 7200000
          },
          {
            id: 3,
            name: '化学 - 有机化学',
            description: '有机物的结构、反应机制等',
            icon: 'experiment',
            color: '#4caf50',
            count: 12,
            tags: ['有机反应', '分子结构', '合成'],
            lastUpdated: Date.now() - 86400000
          },
          {
            id: 4,
            name: '英语 - 语法',
            description: '时态、语态、从句等语法问题',
            icon: 'chat-o',
            color: '#9c27b0',
            count: 6,
            tags: ['时态', '从句', '语态'],
            lastUpdated: Date.now() - 172800000
          }
        ]
        
        categories.splice(0, categories.length, ...mockCategories)
      } catch (error) {
        console.error('加载分类失败:', error)
      }
    }

    // 加载统计数据
    const loadStats = async () => {
      try {
        // 模拟API调用
        const mockStats = {
          totalQuestions: 41,
          totalCategories: 4,
          todayAdded: 3
        }
        
        Object.assign(stats, mockStats)
      } catch (error) {
        console.error('加载统计失败:', error)
      }
    }

    // 组件挂载时加载数据
    onMounted(() => {
      loadCategories()
      loadStats()
    })

    return {
      activeTab,
      searchText,
      refreshing,
      loading,
      finished,
      floatOffset,
      filteredCategories,
      totalQuestions,
      totalCategories,
      todayAdded,
      onSearch,
      onRefresh,
      onLoadMore,
      viewCategory,
      formatTime
    }
  }
}
</script>

<style scoped>
.categories-page {
  min-height: 100vh;
  background: var(--bg-primary);
  padding-bottom: 60px;
  position: relative;
}

.search-section {
  padding: 8px 16px 16px 16px;
  background: var(--bg-primary);
}

/* 🌟 本地搜索框强制金色主题 */
.tech-search {
  background: var(--bg-card) !important;
  backdrop-filter: blur(12px) !important;
  border: 1px solid var(--border-glow) !important;
  border-radius: var(--radius-lg) !important;
  box-shadow: var(--shadow-glow) !important;
  margin: 0 !important;
}

:deep(.tech-search .van-search__content) {
  background: var(--bg-glass) !important;
  border: 1px solid var(--border-glow) !important;
  border-radius: var(--radius-md) !important;
  box-shadow: 
    0 4px 16px rgba(232, 168, 85, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
  backdrop-filter: blur(8px) !important;
}

:deep(.tech-search .van-field) {
  background: transparent !important;
}

:deep(.tech-search .van-field__control) {
  background: transparent !important;
  color: var(--text-primary) !important;
  font-weight: 500 !important;
}

:deep(.tech-search .van-field__control::placeholder) {
  color: var(--text-secondary) !important;
}

:deep(.tech-search .van-search__action) {
  color: var(--text-accent) !important;
  font-weight: 600 !important;
}

.stats-section {
  padding: 20px;
}

.stats-card {
  position: relative;
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-light) 50%, var(--accent-color) 100%);
  color: var(--bg-primary);
  border-radius: var(--radius-xl);
  padding: 24px;
  display: flex;
  justify-content: space-around;
  box-shadow: 
    0 8px 32px rgba(232, 168, 85, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  overflow: hidden;
}

.stats-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: 
    radial-gradient(circle 400px at 30% 20%, rgba(255, 255, 255, 0.1) 0%, transparent 50%),
    radial-gradient(circle 300px at 70% 80%, rgba(255, 255, 255, 0.05) 0%, transparent 50%);
  pointer-events: none;
}

.stats-decoration {
  position: absolute;
  left: 20px;
  top: 50%;
  transform: translateY(-50%);
  width: 60px;
  height: 60px;
  background: linear-gradient(135deg, var(--primary-color), var(--primary-light)) !important;
  border-radius: 50%;
  backdrop-filter: blur(8px);
  border: 2px solid rgba(255, 255, 255, 0.3);
  box-shadow: 
    0 8px 32px rgba(232, 168, 85, 0.4),
    0 4px 16px rgba(0, 0, 0, 0.2),
    inset 0 2px 0 rgba(255, 255, 255, 0.4);
  animation: glowPulse 4s ease-in-out infinite;
}

.stat-item {
  text-align: center;
  position: relative;
  z-index: 2;
}

.stat-number {
  display: block;
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 12px;
  opacity: 0.9;
}

.categories-section {
  padding: 0 20px;
}

.category-card {
  position: relative;
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
  overflow: hidden;
}

.category-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 100%;
  background: linear-gradient(180deg, var(--primary-color), var(--primary-light));
  border-radius: var(--radius-lg) 0 0 var(--radius-lg);
  box-shadow: 0 0 8px rgba(232, 168, 85, 0.5);
}

.category-card:hover {
  border-color: var(--border-glow);
  box-shadow: 
    0 0 40px rgba(232, 168, 85, 0.15),
    var(--shadow-inner),
    var(--shadow-hover);
  transform: translateY(-4px);
}

.category-header {
  display: flex;
  align-items: flex-start;
  margin-bottom: 12px;
}

.category-icon {
  margin-right: 12px;
  padding: 8px;
  background: #f5f5f5;
  border-radius: 8px;
}

.category-info {
  flex: 1;
  min-width: 0;
}

.category-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 4px 0;
  background: linear-gradient(135deg, var(--text-primary), var(--text-accent));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.category-description {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.4;
}

.category-count {
  text-align: center;
  margin-left: 12px;
}

.count-number {
  display: block;
  font-size: 20px;
  font-weight: bold;
  color: var(--text-accent);
  text-shadow: 0 0 8px rgba(232, 168, 85, 0.3);
}

.count-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.category-tags {
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.more-tags {
  font-size: 12px;
  color: #999;
}

.category-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid #f5f5f5;
  padding-top: 12px;
}

.last-updated {
  font-size: 12px;
  color: var(--text-secondary);
}

/* 自定义标签样式 */
.custom-tag {
  background: rgba(232, 168, 85, 0.15) !important;
  color: var(--text-accent) !important;
  border: 1px solid rgba(232, 168, 85, 0.3) !important;
  border-radius: var(--radius-sm) !important;
}


</style>