<template>
  <div class="camera-page">
    <!-- 顶部标题栏 -->
    <van-nav-bar title="错题本整理" fixed placeholder class="tech-nav">
      <template #right>
        <van-icon name="setting-o" @click="$router.push('/settings')" class="nav-icon" />
      </template>
    </van-nav-bar>

    <!-- 产品介绍/照片选择区域 -->
    <div class="camera-section">
      <div class="camera-container tech-card" v-if="!selectedImages.length">
        <div class="product-guide">
          <div class="guide-header">
            <h2 class="guide-title">📚 错题本整理助手</h2>
            <p class="guide-subtitle">智能识别 · 自动分类 · 高效复习</p>
          </div>
          
          <div class="guide-features">
            <div class="feature-item">
              <div class="feature-icon">📷</div>
              <div class="feature-text">
                <h4>拍照识别</h4>
                <p>一键拍摄错题，AI自动识别文字内容</p>
              </div>
            </div>
            
            <div class="feature-item">
              <div class="feature-icon">🤖</div>
              <div class="feature-text">
                <h4>智能分类</h4>
                <p>大模型自动分析题目类型并归类整理</p>
              </div>
            </div>
            
            <div class="feature-item">
              <div class="feature-icon">📝</div>
              <div class="feature-text">
                <h4>组卷练习</h4>
                <p>自由组合错题生成试卷，支持打印导出</p>
              </div>
            </div>
          </div>
          
          <div class="guide-cta">
            <p class="cta-text">📱 点击下方按钮开始使用</p>
          </div>
          
          <div class="guide-glow"></div>
        </div>
      </div>

      <!-- 已选择的图片预览 -->
      <div v-else class="image-preview-container tech-card">
        <div class="image-grid">
          <div 
            v-for="(image, index) in selectedImages" 
            :key="index"
            class="image-item card-interactive"
          >
            <img :src="image.url" alt="错题照片" class="preview-image" />
            <div class="image-overlay">
              <van-icon 
                name="close" 
                class="remove-icon" 
                @click="removeImage(index)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 操作按钮区域 -->
    <div class="action-section">
      <div class="action-buttons">
        <van-button 
          type="primary" 
          icon="camera-o" 
          size="large"
          @click="takePhoto"
          :disabled="processing"
        >
          开始拍照
        </van-button>
        
        <van-button 
          type="default" 
          icon="photo-o" 
          size="large"
          @click="selectFromGallery"
          :disabled="processing"
        >
          从相册选择
        </van-button>
      </div>

      <!-- 处理按钮 -->
      <van-button 
        v-if="selectedImages.length > 0"
        type="primary" 
        size="large"
        block
        :loading="processing"
        @click="processImages"
        class="process-btn"
      >
        {{ processing ? '正在识别中...' : `开始识别 (${selectedImages.length}张)` }}
      </van-button>
    </div>

    <!-- 最近处理记录 -->
    <div v-if="recentRecords.length > 0" class="recent-section">
      <van-divider>最近处理</van-divider>
      <div class="recent-list">
        <div 
          v-for="record in recentRecords" 
          :key="record.id"
          class="recent-item"
          @click="viewRecord(record)"
        >
          <img :src="record.thumbnail" alt="缩略图" class="recent-thumbnail" />
          <div class="recent-info">
            <p class="recent-title">{{ record.title }}</p>
            <p class="recent-time">{{ formatTime(record.createdAt) }}</p>
          </div>
          <van-icon name="arrow" />
        </div>
      </div>
    </div>

    <!-- 文件上传组件（隐藏） -->
    <input 
      ref="fileInput"
      type="file" 
      accept="image/*" 
      multiple
      style="display: none"
      @change="handleFileSelect"
    />

    <!-- 底部导航 -->
    <van-tabbar route>
      <van-tabbar-item icon="home-o" to="/camera">首页</van-tabbar-item>
      <van-tabbar-item icon="apps-o" to="/categories">分类</van-tabbar-item>
      <van-tabbar-item icon="edit" to="/paper-builder">组卷</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Toast } from 'vant'
import { imageRecognitionAPI } from '../api/recognition'

export default {
  name: 'Homepage',
  setup() {
    const router = useRouter()

    const processing = ref(false)
    const selectedImages = reactive([])
    const recentRecords = reactive([])
    const fileInput = ref(null)

    // 确保所有响应式数据都有初始值
    if (!selectedImages) {
      selectedImages.splice(0, selectedImages.length)
    }
    if (!recentRecords) {
      recentRecords.splice(0, recentRecords.length)
    }

    // 拍照功能
    const takePhoto = () => {
      // 在真实应用中，这里会调用相机API
      // 现在先调用文件选择作为替代
      selectFromGallery()
    }

    // 从相册选择
    const selectFromGallery = () => {
      fileInput.value.click()
    }

    // 处理文件选择
    const handleFileSelect = (event) => {
      const files = Array.from(event.target.files)
      
      files.forEach(file => {
        if (file.type.startsWith('image/')) {
          const reader = new FileReader()
          reader.onload = (e) => {
            selectedImages.push({
              file: file,
              url: e.target.result,
              name: file.name
            })
          }
          reader.readAsDataURL(file)
        }
      })
      
      // 清空文件输入
      event.target.value = ''
    }

    // 移除图片
    const removeImage = (index) => {
      selectedImages.splice(index, 1)
    }

    // 处理图片识别
    const processImages = async () => {
      if (selectedImages.length === 0) {
        Toast('请先选择图片')
        return
      }

      processing.value = true
      
      try {
        // 调用图像识别API
        const results = await imageRecognitionAPI.recognizeImages(selectedImages)
        
        Toast.success('识别完成!')
        
        // 跳转到分类页面查看结果
        router.push('/categories')
        
        // 清空已选择的图片
        selectedImages.splice(0)
        
        // 更新最近记录
        loadRecentRecords()
        
      } catch (error) {
        console.error('图像识别失败:', error)
        Toast.fail('识别失败，请重试')
      } finally {
        processing.value = false
      }
    }

    // 查看记录
    const viewRecord = (record) => {
      router.push(`/category/${record.categoryId}`)
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

    // 加载最近记录
    const loadRecentRecords = () => {
      // 模拟最近记录数据
      const mockRecords = [
        {
          id: 1,
          title: '数学题 - 二次函数',
          thumbnail: 'https://via.placeholder.com/60x60',
          createdAt: Date.now() - 3600000,
          categoryId: 1
        },
        {
          id: 2,
          title: '物理题 - 力学',
          thumbnail: 'https://via.placeholder.com/60x60',
          createdAt: Date.now() - 7200000,
          categoryId: 2
        }
      ]
      
      recentRecords.splice(0, recentRecords.length, ...mockRecords)
    }



    // 组件挂载时加载数据
    onMounted(() => {
      loadRecentRecords()
    })

    return {
      processing,
      selectedImages,
      recentRecords,
      fileInput,
      takePhoto,
      selectFromGallery,
      handleFileSelect,
      removeImage,
      processImages,
      viewRecord,
      formatTime
    }
  }
}
</script>

<style scoped>
.camera-page {
  min-height: 100vh;
  background: var(--bg-primary);
  padding-bottom: 60px;
  position: relative;
}

/* 🌟 精致导航栏 */
.tech-nav {
  background: var(--bg-glass) !important;
  backdrop-filter: blur(12px) !important;
  border-bottom: 1px solid var(--border-color) !important;
  box-shadow: var(--shadow-glow) !important;
}

.nav-icon {
  color: var(--text-accent) !important;
  transition: all 0.3s var(--ease-smooth);
}

.nav-icon:hover {
  color: var(--primary-light) !important;
  transform: scale(1.1);
}

.camera-section {
  padding: 20px;
  min-height: 320px;
}

.camera-container {
  min-height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px dashed var(--border-glow);
  position: relative;
  overflow: hidden;
}

/* 🌟 产品介绍指南样式 */
.product-guide {
  position: relative;
  z-index: 2;
  padding: 32px 24px;
  text-align: center;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.guide-header {
  margin-bottom: 32px;
}

.guide-title {
  font-size: 24px;
  font-weight: 700;
  background: linear-gradient(135deg, var(--text-primary), var(--text-accent));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin: 0 0 12px 0;
  animation: shimmer 3s ease-in-out infinite;
}

.guide-subtitle {
  font-size: 16px;
  color: var(--text-accent);
  font-weight: 500;
  margin: 0;
  opacity: 0.9;
}

.guide-features {
  display: flex;
  flex-direction: column;
  gap: 24px;
  margin-bottom: 32px;
}

.feature-item {
  display: flex;
  align-items: flex-start;
  text-align: left;
  gap: 16px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: var(--radius-md);
  border: 1px solid rgba(232, 168, 85, 0.1);
  backdrop-filter: blur(8px);
  transition: all 0.3s var(--ease-smooth);
}

.feature-item:hover {
  background: rgba(232, 168, 85, 0.05);
  border-color: rgba(232, 168, 85, 0.2);
  transform: translateY(-2px);
}

.feature-icon {
  font-size: 24px;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(232, 168, 85, 0.1);
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.feature-text h4 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 8px 0;
}

.feature-text p {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.4;
}

.guide-cta {
  margin-top: auto;
}

.cta-text {
  font-size: 16px;
  color: var(--text-accent);
  font-weight: 600;
  margin: 0;
  animation: glowPulse 2s ease-in-out infinite;
}

.guide-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 200px;
  height: 200px;
  background: radial-gradient(circle, rgba(232, 168, 85, 0.08) 0%, transparent 70%);
  border-radius: 50%;
  animation: floatingGlow 8s ease-in-out infinite;
  z-index: -1;
}

.image-preview-container {
  padding: 20px;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 16px;
}

.image-item {
  position: relative;
  aspect-ratio: 1;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-glow);
  transition: all 0.3s var(--ease-smooth);
}

.image-item:hover {
  transform: scale(1.05);
  box-shadow: 
    0 0 20px rgba(232, 168, 85, 0.2),
    var(--shadow-hover);
}

.preview-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: all 0.3s var(--ease-smooth);
}

.image-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  padding: 8px;
  opacity: 0;
  transition: all 0.3s var(--ease-smooth);
}

.image-item:hover .image-overlay {
  opacity: 1;
}

.remove-icon {
  background: rgba(232, 168, 85, 0.9);
  color: var(--bg-primary);
  border-radius: 50%;
  padding: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s var(--ease-smooth);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.remove-icon:hover {
  background: var(--primary-light);
  transform: scale(1.1);
}

.action-section {
  padding: 20px;
}

.action-buttons {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
}

.action-buttons .van-button {
  flex: 1;
  height: 48px;
  border-radius: var(--radius-md) !important;
  font-weight: 600 !important;
  backdrop-filter: blur(8px);
  transition: all 0.3s var(--ease-smooth) !important;
}

.action-buttons .van-button--primary {
  background: linear-gradient(135deg, var(--primary-color), var(--primary-light)) !important;
  border: none !important;
  box-shadow: 0 4px 16px rgba(232, 168, 85, 0.3) !important;
}

.action-buttons .van-button--default {
  background: var(--bg-glass) !important;
  border: 1px solid var(--border-glow) !important;
  color: var(--text-accent) !important;
}

.action-buttons .van-button:hover {
  transform: translateY(-2px);
}

.process-btn {
  margin-top: 12px;
  height: 52px !important;
  border-radius: var(--radius-lg) !important;
  background: linear-gradient(135deg, var(--primary-color), var(--primary-light)) !important;
  box-shadow: 
    0 6px 24px rgba(232, 168, 85, 0.4) !important,
    inset 0 1px 0 rgba(255, 255, 255, 0.2) !important;
}

.recent-section {
  padding: 0 20px 20px;
}

.recent-list {
  background: var(--bg-card);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-glow);
}

.recent-item {
  display: flex;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--divider-color);
  cursor: pointer;
  transition: all 0.3s var(--ease-smooth);
  position: relative;
}

.recent-item:last-child {
  border-bottom: none;
}

.recent-item:hover {
  background: rgba(232, 168, 85, 0.05);
  transform: translateX(4px);
}

.recent-item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: linear-gradient(180deg, var(--primary-color), var(--primary-light));
  opacity: 0;
  transition: opacity 0.3s var(--ease-smooth);
}

.recent-item:hover::before {
  opacity: 1;
}

.recent-thumbnail {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-sm);
  object-fit: cover;
  margin-right: 16px;
  border: 1px solid var(--border-color);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.recent-info {
  flex: 1;
}

.recent-title {
  font-size: 14px;
  color: var(--text-primary);
  margin: 0 0 4px 0;
  font-weight: 500;
}

.recent-time {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0;
}
</style>