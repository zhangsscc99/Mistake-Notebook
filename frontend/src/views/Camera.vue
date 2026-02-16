<template>
  <div class="camera-page">
    <!-- 主要内容区域 -->
    <div class="main-section">
      <div class="content-container tech-card">
        <!-- 产品介绍 -->
        <div v-if="!selectedImages.length" class="product-guide">
          <div class="guide-header">
            <h2 class="guide-title">📚 错题本整理助手</h2>
            <p class="guide-subtitle">智能识别 · 自动分类 · 高效复习</p>
          </div>
          
          <div class="guide-features">
            <div class="feature-item">
              <div class="feature-text">
                <h4>拍照识别</h4>
                <p>一键拍摄错题，AI自动识别文字内容</p>
              </div>
            </div>
            
            <div class="feature-item">
              <div class="feature-text">
                <h4>智能分类</h4>
                <p>大模型自动分析题目类型并归类整理</p>
              </div>
            </div>
            
            <div class="feature-item">
              <div class="feature-text">
                <h4>组卷练习</h4>
                <p>自由组合错题生成试卷，支持打印导出</p>
              </div>
            </div>
          </div>
          
          <div class="guide-glow"></div>
        </div>

        <!-- 已选择的图片预览 -->
        <div v-else class="image-preview-area">
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

        <!-- 操作按钮区域 -->
        <div class="action-area">
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
      </div>
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
      <van-tabbar-item icon="home-o" to="/homepage">首页</van-tabbar-item>
      <van-tabbar-item icon="apps-o" to="/categories">分类</van-tabbar-item>
      <van-tabbar-item icon="edit" to="/paper-builder">组卷</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
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
        showToast('请先选择图片')
        return
      }

      processing.value = true
      
      try {
        console.log('开始调用API识别...') // 调试信息
        
        // 调用图像识别API进行OCR识别
        const results = await imageRecognitionAPI.recognizeImages(selectedImages)
        
        console.log('API识别结果:', results) // 调试信息
        console.log('API调用成功，准备显示Toast...') // 调试信息
        
        showToast('识别完成!')
        
        console.log('Toast显示完成，准备跳转...') // 调试信息
        
        // 获取第一张图片的URL用于题目选择页面
        const firstImageUrl = selectedImages[0].url
        
        console.log('准备跳转到题目选择页面, 图片URL:', firstImageUrl) // 调试信息
        
        // 先尝试简单跳转测试
        console.log('当前路由器对象:', router) // 调试信息
        
        // 跳转到题目选择页面，传递图片和识别结果
        const routeData = {
          path: '/question-selector',
          query: {
            image: encodeURIComponent(firstImageUrl),
            results: JSON.stringify(results)
          }
        }
        
        console.log('路由数据:', routeData) // 调试信息
        
        // 先测试简单跳转
        try {
          console.log('开始执行路由跳转...') // 调试信息
          await router.push(routeData)
          console.log('路由跳转执行完成') // 调试信息
        } catch (error) {
          console.error('路由跳转失败:', error) // 调试信息
        }
        
        // 清空已选择的图片
        selectedImages.splice(0)
        
        // 更新最近记录
        loadRecentRecords()
        
      } catch (error) {
        console.error('图像识别失败:', error)
        showToast('识别失败，请重试')
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
          createdAt: Date.now() - 3600000,
          categoryId: 1
        },
        {
          id: 2,
          title: '物理题 - 力学',
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
  /* Homepage-only theme override (Copilot/M365-ish: premium glass panels on a crisp blue-white canvas). */
  --primary-color: #2459ff;
  --primary-light: #52b7ff;
  --primary-dark: #1742d6;
  --secondary-color: #1451d6;
  --accent-color: #b6a6ff;
  --accent-violet: #8a7dff;
  --accent-pink: #ff7bd0;
  --accent-peach: #ffb56a;

  /* Canvas */
  --bg-primary: #eaf3ff;
  --bg-secondary: rgba(255, 255, 255, 0.85);
  --bg-card: rgba(255, 255, 255, 0.72);
  --bg-glass: rgba(255, 255, 255, 0.62);
  --glass-strong: rgba(255, 255, 255, 0.78);
  --glass-soft: rgba(255, 255, 255, 0.56);
  --glass-lavender: rgba(246, 236, 255, 0.58);
  --glass-rose: rgba(255, 235, 248, 0.34);

  --text-primary: #0b1633;
  --text-secondary: rgba(11, 22, 51, 0.62);
  --text-disabled: rgba(11, 22, 51, 0.38);
  --text-accent: #1f5bff;

  --border-color: rgba(47, 107, 255, 0.14);
  --border-glow: rgba(47, 107, 255, 0.22);
  --divider-color: rgba(11, 22, 51, 0.08);

  --shadow-glow: 0 20px 70px rgba(31, 91, 255, 0.12), 0 34px 120px rgba(255, 123, 208, 0.10);
  --shadow-card: 0 14px 44px rgba(11, 22, 51, 0.10);
  --shadow-hover: 0 20px 70px rgba(11, 22, 51, 0.16);
  --shadow-inner: inset 0 1px 0 rgba(255, 255, 255, 0.55);

  min-height: 100vh;
  background: var(--bg-primary);
  padding-bottom: 60px;
  position: relative;
  overflow-x: hidden;
  font-family: "Segoe UI Variable", "Segoe UI", -apple-system, BlinkMacSystemFont, "PingFang SC",
    "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial, sans-serif;
}

.camera-page::before {
  content: '';
  position: absolute;
  inset: 0;
  /* Meshy pastel blobs like the reference screenshots (no "grid", lots of air). */
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.75) 0%, rgba(247, 251, 255, 0.20) 45%, rgba(255, 245, 252, 0.18) 100%),
    radial-gradient(900px 700px at 18% 22%, rgba(36, 89, 255, 0.18) 0%, transparent 60%),
    radial-gradient(820px 620px at 82% 18%, rgba(255, 123, 208, 0.20) 0%, transparent 62%),
    radial-gradient(980px 760px at 22% 78%, rgba(138, 125, 255, 0.22) 0%, transparent 60%),
    radial-gradient(980px 760px at 76% 84%, rgba(255, 181, 106, 0.18) 0%, transparent 62%),
    radial-gradient(1400px 1100px at 50% 110%, rgba(82, 183, 255, 0.12) 0%, transparent 58%);
  pointer-events: none;
  z-index: 0;
  filter: saturate(1.02);
}

.camera-page::after {
  /* Ultra subtle grain + top sheen (keeps it from feeling flat). */
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(900px 320px at 52% -10%, rgba(255, 255, 255, 0.78) 0%, transparent 70%),
    radial-gradient(1000px 520px at 50% 0%, rgba(255, 255, 255, 0.22) 0%, transparent 70%);
  opacity: 0.22;
  pointer-events: none;
  z-index: 0;
  mix-blend-mode: overlay;
}



.main-section {
  padding: 16px;
  min-height: auto;
  position: relative;
  z-index: 1;
}

.content-container {
  min-height: auto;
  border: 1px solid rgba(255, 255, 255, 0.55);
  position: relative;
  overflow: visible;
  padding: 20px;
  border-radius: var(--radius-xl);
  background: linear-gradient(135deg, var(--glass-lavender), rgba(255, 255, 255, 0.48) 46%, var(--glass-rose));
  backdrop-filter: blur(18px) saturate(1.4);
  -webkit-backdrop-filter: blur(18px) saturate(1.4);
  box-shadow:
    var(--shadow-glow),
    var(--shadow-inner),
    var(--shadow-card);
}

.content-container::before {
  /* Gradient glass stroke without changing layout. */
  content: '';
  position: absolute;
  inset: 0;
  padding: 1px;
  border-radius: inherit;
  background: linear-gradient(
    135deg,
    rgba(36, 89, 255, 0.34),
    rgba(82, 183, 255, 0.18),
    rgba(255, 123, 208, 0.16),
    rgba(138, 125, 255, 0.14)
  );
  pointer-events: none;
  z-index: 0;
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
}

.content-container::after {
  /* Specular highlight band (very subtle). */
  content: '';
  position: absolute;
  inset: -40% -60%;
  background: linear-gradient(
    120deg,
    transparent 35%,
    rgba(255, 255, 255, 0.35) 45%,
    rgba(255, 255, 255, 0.10) 52%,
    transparent 62%
  );
  transform: translateX(-22%) rotate(12deg);
  opacity: 0.55;
  pointer-events: none;
  z-index: 0;
  animation: glassSweep 8s cubic-bezier(0.2, 0.8, 0.2, 1) infinite;
}

.content-container > * {
  position: relative;
  z-index: 1;
}

@keyframes glassSweep {
  0% { transform: translateX(-22%) rotate(12deg); }
  50% { transform: translateX(18%) rotate(12deg); }
  100% { transform: translateX(-22%) rotate(12deg); }
}

@media (prefers-reduced-motion: reduce) {
  .content-container::after { animation: none; }
  .process-btn::after { display: none; }
}

/* 🌟 产品介绍指南样式 */
.product-guide {
  position: relative;
  z-index: 2;
  text-align: center;
  margin-bottom: 30px;
}

.guide-header {
  margin-bottom: 16px;
}

.guide-title {
  font-size: 24px;
  font-weight: 700;
  background: linear-gradient(
    90deg,
    var(--text-primary) 0%,
    var(--text-accent) 25%,
    #00a3ff 55%,
    var(--text-accent) 78%,
    rgba(11, 22, 51, 0.92) 100%
  );
  background-size: 200% 100%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin: 0 0 12px 0;
  animation: shimmer 3s ease-in-out infinite;
}

.guide-subtitle {
  font-size: 16px;
  color: rgba(11, 22, 51, 0.70);
  font-weight: 600;
  margin: 0;
  opacity: 0.9;
}

.guide-features {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.feature-item {
  display: flex;
  align-items: flex-start;
  text-align: left;
  gap: 12px;
  padding: 10px;
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.78), rgba(255, 255, 255, 0.55));
  border-radius: var(--radius-md);
  border: 1px solid rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(14px) saturate(1.25);
  -webkit-backdrop-filter: blur(14px) saturate(1.25);
  transition: transform 0.26s var(--ease-smooth), box-shadow 0.26s var(--ease-smooth), border-color 0.26s var(--ease-smooth);
  box-shadow:
    0 8px 22px rgba(11, 22, 51, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.6);
}

.feature-item::before {
  content: '';
  position: absolute;
  inset: 0;
  padding: 1px;
  border-radius: inherit;
  background: linear-gradient(
    135deg,
    rgba(47, 107, 255, 0.28),
    rgba(142, 211, 255, 0.14),
    rgba(138, 125, 255, 0.12)
  );
  pointer-events: none;
  z-index: 0;
  opacity: 0.65;
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
}

.feature-item::after {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(700px 220px at 12% 0%, rgba(47, 107, 255, 0.10) 0%, transparent 55%);
  pointer-events: none;
  z-index: 0;
  opacity: 0.9;
}

.feature-item > * {
  position: relative;
  z-index: 1;
}

.feature-item:hover {
  border-color: rgba(47, 107, 255, 0.22);
  box-shadow:
    0 14px 34px rgba(11, 22, 51, 0.12),
    0 18px 44px rgba(31, 91, 255, 0.10);
  transform: translateY(-2px);
}

.feature-icon {
  font-size: 24px;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(47, 107, 255, 0.10);
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
  background: radial-gradient(circle, rgba(47, 107, 255, 0.12) 0%, transparent 70%);
  border-radius: 50%;
  animation: floatingGlow 8s ease-in-out infinite;
  z-index: -1;
}

.image-preview-area {
  margin-bottom: 30px;
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
    0 0 22px rgba(31, 91, 255, 0.16),
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
  background: rgba(11, 22, 51, 0.38);
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
  background: rgba(255, 255, 255, 0.92);
  color: rgba(11, 22, 51, 0.92);
  border-radius: 50%;
  padding: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s var(--ease-smooth);
  box-shadow: 0 10px 26px rgba(11, 22, 51, 0.20);
}

.remove-icon:hover {
  background: rgba(255, 255, 255, 1);
  color: var(--primary-dark);
  transform: scale(1.1);
}

.action-area {
  margin-top: auto;
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
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.44), rgba(255, 255, 255, 0.16)) !important;
  border: 1px solid rgba(255, 255, 255, 0.62) !important;
  color: rgba(11, 22, 51, 0.82) !important;
  backdrop-filter: blur(16px) saturate(1.35);
  -webkit-backdrop-filter: blur(16px) saturate(1.35);
  box-shadow:
    0 14px 34px rgba(11, 22, 51, 0.10) !important,
    inset 0 1px 0 rgba(255, 255, 255, 0.55) !important;
  transition: transform 0.22s var(--ease-smooth), box-shadow 0.22s var(--ease-smooth), border-color 0.22s var(--ease-smooth) !important;
}

.action-buttons .van-button--primary {
  /* Primary stays transparent glass; differentiation via border/glow + text color. */
  color: rgba(31, 91, 255, 0.92) !important;
  border-color: rgba(47, 107, 255, 0.24) !important;
  box-shadow:
    0 18px 44px rgba(31, 91, 255, 0.14) !important,
    0 10px 28px rgba(11, 22, 51, 0.08) !important,
    inset 0 1px 0 rgba(255, 255, 255, 0.62) !important;
}

.action-buttons .van-button--default {
  border-color: rgba(255, 255, 255, 0.58) !important;
  color: rgba(11, 22, 51, 0.78) !important;
}

/* Honor browser can render black curved seams on button pseudo layers. */
.action-buttons .van-button::before,
.action-buttons .van-button::after {
  content: none !important;
  display: none !important;
}

.action-buttons .van-button :deep(.van-icon) {
  color: currentColor !important;
}

.action-buttons .van-button :deep(.van-button__content::before) {
  content: none !important;
}

.action-buttons .van-button:hover {
  transform: translateY(-2px);
}

.action-buttons .van-button:active {
  transform: translateY(-1px) scale(0.99);
}

.process-btn {
  margin-top: 12px;
  height: 52px !important;
  border-radius: var(--radius-lg) !important;
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.44), rgba(255, 255, 255, 0.16)) !important;
  border: 1px solid rgba(47, 107, 255, 0.24) !important;
  color: rgba(31, 91, 255, 0.92) !important;
  backdrop-filter: blur(18px) saturate(1.4) !important;
  -webkit-backdrop-filter: blur(18px) saturate(1.4) !important;
  box-shadow: 
    0 22px 54px rgba(31, 91, 255, 0.16) !important,
    0 12px 30px rgba(11, 22, 51, 0.10) !important,
    inset 0 1px 0 rgba(255, 255, 255, 0.62) !important;
}

.process-btn::before {
  content: '';
  position: absolute;
  inset: 0;
  padding: 1px;
  border-radius: inherit;
  background: linear-gradient(
    135deg,
    rgba(47, 107, 255, 0.34),
    rgba(142, 211, 255, 0.18),
    rgba(138, 125, 255, 0.14)
  );
  pointer-events: none;
  opacity: 0.95;
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
}

.process-btn::after {
  content: '';
  position: absolute;
  inset: -70% -70%;
  background: linear-gradient(
    120deg,
    transparent 38%,
    rgba(255, 255, 255, 0.34) 46%,
    rgba(255, 255, 255, 0.10) 54%,
    transparent 64%
  );
  transform: translateX(-12%) rotate(12deg);
  opacity: 0.65;
  pointer-events: none;
}

.process-btn:hover {
  transform: translateY(-2px);
  box-shadow:
    0 28px 70px rgba(31, 91, 255, 0.18) !important,
    0 18px 44px rgba(11, 22, 51, 0.12) !important,
    inset 0 1px 0 rgba(255, 255, 255, 0.68) !important;
}

.process-btn:active {
  transform: translateY(-1px) scale(0.99);
}

.recent-section {
  padding: 0 20px 20px;
  position: relative;
  z-index: 1;
}

.recent-list {
  position: relative;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.78), rgba(255, 255, 255, 0.56));
  backdrop-filter: blur(18px) saturate(1.3);
  -webkit-backdrop-filter: blur(18px) saturate(1.3);
  border: 1px solid rgba(255, 255, 255, 0.55);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-glow);
}

.recent-list::before {
  content: '';
  position: absolute;
  inset: 0;
  padding: 1px;
  border-radius: inherit;
  background: linear-gradient(
    135deg,
    rgba(47, 107, 255, 0.26),
    rgba(142, 211, 255, 0.14),
    rgba(138, 125, 255, 0.12)
  );
  pointer-events: none;
  opacity: 0.65;
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
}

.recent-item {
  display: flex;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--divider-color);
  cursor: pointer;
  transition: transform 0.26s var(--ease-smooth), background 0.26s var(--ease-smooth);
  position: relative;
}

.recent-item:last-child {
  border-bottom: none;
}

.recent-item:hover {
  background: rgba(47, 107, 255, 0.06);
  transform: translateX(4px);
}

.recent-item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: linear-gradient(180deg, var(--primary-color), rgba(0, 163, 255, 0.9));
  opacity: 0;
  transition: opacity 0.3s var(--ease-smooth);
}

.recent-item:hover::before {
  opacity: 1;
}



.camera-page :deep(.van-divider) {
  color: rgba(11, 22, 51, 0.50) !important;
  border-color: rgba(11, 22, 51, 0.10) !important;
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
  color: var(--primary-color) !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
}

:deep(.van-tabbar-item--active .van-tabbar-item__text) {
  color: var(--primary-color) !important;
  font-weight: 700 !important;
  text-shadow: 0 0 12px rgba(31, 91, 255, 0.16) !important;
  background: none !important;
  -webkit-background-clip: initial !important;
  background-clip: initial !important;
  -webkit-text-fill-color: currentColor !important;
  animation: none !important;
}

:deep(.van-tabbar-item--active .van-tabbar-item__icon) {
  color: var(--primary-color) !important;
  filter: drop-shadow(0 0 10px rgba(31, 91, 255, 0.18)) !important;
  transform: scale(1.1) !important;
  animation: none !important;
}

/* Remove global gold indicator bars/pulses from App.vue for this page. */
:deep(.van-tabbar-item--active::before),
:deep(.van-tabbar-item--active::after) {
  content: none !important;
}
</style>
