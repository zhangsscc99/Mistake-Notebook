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
      <van-tabbar-item icon="home-o" to="/homepage">首页</van-tabbar-item>
      <van-tabbar-item icon="apps-o" to="/categories">分类</van-tabbar-item>
      <van-tabbar-item icon="edit" to="/paper-builder">组卷</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import categoryAPI from '../api/category'

export default {
  name: 'Categories',
  setup() {
    const router = useRouter()
    const route = useRoute()

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

    // 加载更多 - 当前版本不需要分页，直接标记为完成
    const onLoadMore = async () => {
      if (finished.value) return
      
      loading.value = true
      try {
        // 当前版本一次性加载所有分类，无需分页
        finished.value = true
      } finally {
        loading.value = false
      }
    }

    // 查看分类详情
    const viewCategory = (category) => {
      // 检查是否是组卷模式
      const mode = route.query.mode
      if (mode === 'paper-builder') {
        // 组卷模式：跳转到分类详情页并自动开启编辑模式
        router.push({
          path: `/category/${category.id}`,
          query: { mode: 'paper-select' }
        })
      } else {
        // 正常模式：查看分类详情
        router.push(`/category/${category.id}`)
      }
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
        console.log('开始调用分类API...')
        const response = await categoryAPI.getCategories()
        console.log('API响应:', response)
        
        if (response.success && response.data && response.data.data) {
          // 处理API返回的数据，转换为前端需要的格式
          const apiCategories = response.data.data.map(cat => ({
            id: cat.id,
            name: cat.name,
            description: cat.description || '暂无描述',
            icon: cat.icon || 'apps-o',
            color: cat.color || '#E8A855',
            count: cat.questionCount || 0,
            tags: [],
            lastUpdated: Date.now() // 暂时使用当前时间
          }))
          
          categories.splice(0, categories.length, ...apiCategories)
          console.log('成功加载分类数据:', apiCategories)
        } else {
          console.error('API返回格式错误:', response)
        }
      } catch (error) {
        console.error('加载分类失败:', error)
        // 不使用模拟数据，保持categories为空数组
        categories.splice(0, categories.length)
      }
    }

        // 加载统计数据
    const loadStats = async () => {
      try {
        console.log('开始调用统计API...')
        const response = await categoryAPI.getCategoryStats()
        console.log('统计API响应:', response)
        
        if (response.success && response.data && response.data.data) {
          const apiStats = {
            totalQuestions: response.data.data.totalQuestions || 0,
            totalCategories: response.data.data.totalCategories || 0,
            todayAdded: response.data.data.todayAdded || 0
          }
          Object.assign(stats, apiStats)
          console.log('成功加载统计数据:', apiStats)
        } else {
          console.error('统计API返回格式错误:', response)
        }
      } catch (error) {
        console.error('加载统计失败:', error)
        // 不使用模拟数据，保持统计数据为0
        Object.assign(stats, {
          totalQuestions: 0,
          totalCategories: 0,
          todayAdded: 0
        })
      }
    }

    // 组件挂载时加载数据
    onMounted(() => {
      loadCategories()
      loadStats()
    })

    return {
      searchText,
      refreshing,
      loading,
      finished,
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

/* 🔥 强制覆盖底部导航栏样式 */
:deep(.van-tabbar) {
  background: var(--bg-glass) !important;
  backdrop-filter: blur(16px) !important;
  border-top: 1px solid var(--border-glow) !important;
  box-shadow: 
    0 -4px 20px rgba(0, 0, 0, 0.4) !important,
    0 -1px 0 rgba(232, 168, 85, 0.1) !important;
  padding: 8px 12px !important;
}

:deep(.van-tabbar-item) {
  color: rgba(255, 255, 255, 0.6) !important;
  border-radius: 12px !important;
  margin: 0 4px !important;
  padding: 6px 8px !important;
  transition: all 0.3s ease !important;
  position: relative !important;
  overflow: hidden !important;
}

:deep(.van-tabbar-item:hover) {
  background: rgba(232, 168, 85, 0.1) !important;
  transform: translateY(-1px) !important;
}

:deep(.van-tabbar-item--active) {
  color: #E8A855 !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
}

:deep(.van-tabbar-item--active .van-tabbar-item__text) {
  color: #E8A855 !important;
  font-weight: 700 !important;
  text-shadow: 0 0 8px rgba(232, 168, 85, 0.6) !important;
}

:deep(.van-tabbar-item--active .van-tabbar-item__icon) {
  color: #E8A855 !important;
  filter: drop-shadow(0 0 8px rgba(232, 168, 85, 0.6)) !important;
  transform: scale(1.1) !important;
}
</style>