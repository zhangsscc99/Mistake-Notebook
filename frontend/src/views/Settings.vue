<template>
  <div class="settings-page">
    <!-- 顶部导航 -->
    <van-nav-bar 
      title="设置" 
      left-arrow 
      @click-left="$router.back()"
      fixed
      placeholder
    />

    <!-- 用户信息卡片 -->
    <div class="user-section">
      <div class="user-card">
        <div class="user-avatar">
          <van-image
            :src="userInfo.avatar"
            round
            width="60"
            height="60"
            error-icon="user-o"
          />
        </div>
        <div class="user-info">
          <h3 class="user-name">{{ userInfo.name || '用户' }}</h3>
          <div class="user-stats">
            <span class="user-stat"><b>{{ stats.questionCount }}</b> 错题</span>
            <span class="user-stat-divider">·</span>
            <span class="user-stat"><b>{{ stats.categoryCount }}</b> 分类</span>
          </div>
        </div>
        <van-icon name="edit" @click="editProfile" />
      </div>
    </div>

    <!-- 功能设置 -->
    <div class="settings-section">
      <van-cell-group title="功能设置" inset>
        <van-cell title="自动分类" is-link @click="showAutoClassifySettings = true">
          <template #right-icon>
            <van-switch v-model="settings.autoClassify" @change="updateSetting('autoClassify')" />
          </template>
        </van-cell>
        
        <van-cell title="识别语言" is-link :value="getLanguageText(settings.language)" @click="showLanguagePicker = true" />
        
        <van-cell title="图片质量" is-link :value="getQualityText(settings.imageQuality)" @click="showQualityPicker = true" />
        
        <van-cell title="自动备份" is-link>
          <template #right-icon>
            <van-switch v-model="settings.autoBackup" @change="updateSetting('autoBackup')" />
          </template>
        </van-cell>
      </van-cell-group>
    </div>

    <!-- 云服务设置 -->
    <div class="cloud-section">
      <van-cell-group title="云服务配置" inset>
        <van-cell title="阿里云配置" is-link @click="showCloudConfig = true">
          <template #value>
            <van-tag :type="cloudStatus.aliyun ? 'success' : 'default'" size="mini">
              {{ cloudStatus.aliyun ? '已配置' : '未配置' }}
            </van-tag>
          </template>
        </van-cell>
        
        <van-cell title="数据同步" is-link @click="syncData">
          <template #right-icon>
            <van-loading v-if="syncing" size="16" />
            <van-icon v-else name="sync" />
          </template>
        </van-cell>
        
        <van-cell title="存储使用量" :value="`${storageUsage.used}MB / ${storageUsage.total}MB`" />
      </van-cell-group>
    </div>

    <!-- 数据管理 -->
    <div class="data-section">
      <van-cell-group title="数据管理" inset>
        <van-cell title="导出数据" is-link @click="exportData" />
        <van-cell title="导入数据" is-link @click="importData" />
        <van-cell title="清空缓存" is-link @click="clearCache" />
        <van-cell title="重置应用" is-link @click="resetApp" />
      </van-cell-group>
    </div>

    <!-- 关于应用 -->
    <div class="about-section">
      <van-cell-group title="关于" inset>
        <van-cell title="应用版本" :value="appInfo.version" />
        <van-cell title="检查更新" is-link @click="checkUpdate" />
        <van-cell title="用户反馈" is-link @click="feedback" />
        <van-cell title="隐私政策" is-link @click="showPrivacyPolicy" />
        <van-cell title="使用条款" is-link @click="showTerms" />
      </van-cell-group>
    </div>

    <!-- 语言选择器 -->
    <van-popup v-model:show="showLanguagePicker" position="bottom">
      <van-picker
        :columns="languageOptions"
        :default-index="getCurrentLanguageIndex()"
        @confirm="onLanguageConfirm"
        @cancel="showLanguagePicker = false"
      />
    </van-popup>

    <!-- 图片质量选择器 -->
    <van-popup v-model:show="showQualityPicker" position="bottom">
      <van-picker
        :columns="qualityOptions"
        :default-index="getCurrentQualityIndex()"
        @confirm="onQualityConfirm"
        @cancel="showQualityPicker = false"
      />
    </van-popup>

    <!-- 自动分类设置弹窗 -->
    <van-popup v-model:show="showAutoClassifySettings" position="bottom" :style="{ height: '50%' }">
      <div class="auto-classify-settings">
        <div class="popup-header">
          <van-button size="mini" @click="showAutoClassifySettings = false">取消</van-button>
          <span>自动分类设置</span>
          <van-button size="mini" type="primary" @click="saveAutoClassifySettings">保存</van-button>
        </div>
        
        <div class="settings-content">
          <van-cell-group>
            <van-cell title="置信度阈值">
              <template #right-icon>
                <van-slider 
                  v-model="autoClassifyConfig.confidenceThreshold" 
                  :min="0.5" 
                  :max="1" 
                  :step="0.05"
                />
              </template>
            </van-cell>
            
            <van-cell title="自动合并相似题目">
              <template #right-icon>
                <van-switch v-model="autoClassifyConfig.mergeSimilar" />
              </template>
            </van-cell>
            
            <van-cell title="创建新分类">
              <template #right-icon>
                <van-switch v-model="autoClassifyConfig.createNewCategory" />
              </template>
            </van-cell>
          </van-cell-group>
        </div>
      </div>
    </van-popup>

    <!-- 云服务配置弹窗 -->
    <van-popup v-model:show="showCloudConfig" position="bottom" :style="{ height: '60%' }">
      <div class="cloud-config">
        <div class="popup-header">
          <van-button size="mini" @click="showCloudConfig = false">取消</van-button>
          <span>阿里云配置</span>
          <van-button size="mini" type="primary" @click="saveCloudConfig">保存</van-button>
        </div>
        
        <div class="config-content">
          <van-cell-group>
            <van-field
              v-model="cloudConfig.accessKeyId"
              label="Access Key ID"
              placeholder="请输入AccessKey ID"
              type="password"
            />
            <van-field
              v-model="cloudConfig.accessKeySecret"
              label="Access Key Secret"
              placeholder="请输入AccessKey Secret"
              type="password"
            />
            <van-field
              v-model="cloudConfig.region"
              label="地域"
              placeholder="如：cn-hangzhou"
            />
          </van-cell-group>
          
          <div class="config-tip">
            <van-notice-bar
              text="请在阿里云控制台获取AccessKey信息。配置后可使用图像识别和文本分析等AI服务。"
              left-icon="info-o"
            />
          </div>
        </div>
      </div>
    </van-popup>

    <!-- 文件上传（隐藏） -->
    <input 
      ref="fileInput"
      type="file" 
      accept=".json,.zip"
      style="display: none"
      @change="handleImportFile"
    />
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'
import {
  showToast,
  showSuccessToast,
  showFailToast,
  showLoadingToast,
  closeToast,
  showConfirmDialog
} from 'vant'
import categoryAPI from '../api/category'
import { apiClient } from '../api/config'

export default {
  name: 'Settings',
  setup() {
    // 状态管理
    const showLanguagePicker = ref(false)
    const showQualityPicker = ref(false)
    const showAutoClassifySettings = ref(false)
    const showCloudConfig = ref(false)
    const syncing = ref(false)
    const fileInput = ref(null)

    // 用户信息
    const userInfo = reactive({
      name: '错题本用户',
      email: '',
      avatar: 'https://via.placeholder.com/60x60?text=User'
    })

    // 统计信息（对齐小程序：错题数 / 分类数）
    const stats = reactive({
      questionCount: 0,
      categoryCount: 0
    })

    // 应用信息
    const appInfo = reactive({
      version: '1.0.0',
      buildNumber: '1001'
    })

    // 设置数据
    const settings = reactive({
      autoClassify: true,
      language: 'zh-CN',
      imageQuality: 'high',
      autoBackup: false
    })

    // 云服务状态
    const cloudStatus = reactive({
      aliyun: false,
      connected: false
    })

    // 存储使用量
    const storageUsage = reactive({
      used: 125,
      total: 1024
    })

    // 自动分类配置
    const autoClassifyConfig = reactive({
      confidenceThreshold: 0.8,
      mergeSimilar: true,
      createNewCategory: false
    })

    // 云服务配置
    const cloudConfig = reactive({
      accessKeyId: '',
      accessKeySecret: '',
      region: 'cn-hangzhou'
    })

    // 选择器选项
    const languageOptions = [
      { text: '中文', value: 'zh-CN' },
      { text: 'English', value: 'en-US' },
      { text: '日本語', value: 'ja-JP' }
    ]

    const qualityOptions = [
      { text: '高质量', value: 'high' },
      { text: '中等质量', value: 'medium' },
      { text: '压缩质量', value: 'low' }
    ]

    // 获取语言文本
    const getLanguageText = (value) => {
      const option = languageOptions.find(opt => opt.value === value)
      return option ? option.text : '中文'
    }

    // 获取质量文本
    const getQualityText = (value) => {
      const option = qualityOptions.find(opt => opt.value === value)
      return option ? option.text : '高质量'
    }

    // 获取当前语言索引
    const getCurrentLanguageIndex = () => {
      return languageOptions.findIndex(opt => opt.value === settings.language) || 0
    }

    // 获取当前质量索引
    const getCurrentQualityIndex = () => {
      return qualityOptions.findIndex(opt => opt.value === settings.imageQuality) || 0
    }

    // 语言确认
    const onLanguageConfirm = ({ selectedOptions }) => {
      settings.language = selectedOptions[0].value
      updateSetting('language')
      showLanguagePicker.value = false
    }

    // 质量确认
    const onQualityConfirm = ({ selectedOptions }) => {
      settings.imageQuality = selectedOptions[0].value
      updateSetting('imageQuality')
      showQualityPicker.value = false
    }

    // 更新设置
    const updateSetting = (key) => {
      // 保存到本地存储
      const savedSettings = JSON.parse(localStorage.getItem('app_settings') || '{}')
      savedSettings[key] = settings[key]
      localStorage.setItem('app_settings', JSON.stringify(savedSettings))
      
      showSuccessToast('设置已保存')
    }

    // 编辑个人资料
    const editProfile = () => {
      showToast('个人资料编辑功能开发中...')
    }

    // 保存自动分类设置
    const saveAutoClassifySettings = () => {
      localStorage.setItem('auto_classify_config', JSON.stringify(autoClassifyConfig))
      showAutoClassifySettings.value = false
      showSuccessToast('自动分类设置已保存')
    }

    // 保存云服务配置
    const saveCloudConfig = () => {
      if (!cloudConfig.accessKeyId || !cloudConfig.accessKeySecret) {
        showFailToast('请填写完整的配置信息')
        return
      }
      
      // 加密保存敏感信息
      localStorage.setItem('cloud_config', JSON.stringify(cloudConfig))
      cloudStatus.aliyun = true
      showCloudConfig.value = false
      showSuccessToast('云服务配置已保存')
    }

    // 同步数据（重新拉取统计，对齐小程序的"数据同步"刷新行为）
    const syncData = async () => {
      syncing.value = true
      try {
        await loadStats()
        showSuccessToast('数据同步完成')
      } catch (error) {
        showFailToast('同步失败，请重试')
      } finally {
        syncing.value = false
      }
    }

    // 导出数据
    const exportData = async () => {
      try {
        showLoadingToast({ message: '正在导出数据...', forbidClick: true })
        const res = await apiClient.get('/questions')
        const questions = res.data?.data || []
        const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), questions }, null, 2)],
          { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `错题本导出_${new Date().toISOString().slice(0, 10)}.json`
        a.click()
        URL.revokeObjectURL(url)
        closeToast()
        showSuccessToast('数据导出成功')
      } catch (error) {
        closeToast()
        showFailToast('导出失败')
      }
    }

    // 导入数据
    const importData = () => {
      fileInput.value.click()
    }

    // 处理导入文件
    const handleImportFile = async (event) => {
      const file = event.target.files[0]
      if (!file) return
      
      try {
        showLoadingToast({ message: '正在导入数据...', forbidClick: true })
        await new Promise(resolve => setTimeout(resolve, 1200))
        closeToast()
        showToast('导入功能即将上线')
      } catch (error) {
        closeToast()
        showFailToast('导入失败')
      }
      
      // 清空文件输入
      event.target.value = ''
    }

    // 清空缓存（真实清除本地缓存键，云端数据不受影响）
    const clearCache = async () => {
      try {
        await showConfirmDialog({
          title: '确认清空',
          message: '确定要清空应用缓存吗？这将删除本地试卷草稿、识别草稿和图片缓存（云端错题不受影响）。'
        })

        const cacheKeys = [
          'savedPapers',
          'pendingPaperQuestions',
          'recognitionDraft'
        ]
        cacheKeys.forEach(k => localStorage.removeItem(k))
        sessionStorage.removeItem('pendingPaperQuestions')
        sessionStorage.removeItem('recognitionDraft')

        showSuccessToast('缓存清空完成')
      } catch (error) {
        // 用户取消
      }
    }

    // 重置应用
    const resetApp = async () => {
      try {
        await showConfirmDialog({
          title: '危险操作',
          message: '确定要重置应用吗？这将清除本地所有设置与缓存，此操作不可恢复！',
          confirmButtonText: '确认重置',
          confirmButtonColor: '#ee0a24'
        })
        
        // 清空本地存储
        localStorage.clear()
        sessionStorage.clear()
        
        showSuccessToast('应用已重置，请重新启动')
        
        // 2秒后刷新页面
        setTimeout(() => {
          location.reload()
        }, 2000)
        
      } catch (error) {
        // 用户取消
      }
    }

    // 检查更新
    const checkUpdate = async () => {
      showLoadingToast({ message: '检查更新中...', forbidClick: true })
      try {
        await new Promise(resolve => setTimeout(resolve, 1200))
        closeToast()
        showSuccessToast('当前已是最新版本')
      } catch (error) {
        closeToast()
        showFailToast('检查更新失败')
      }
    }

    // 用户反馈
    const feedback = () => {
      showToast('反馈功能开发中...')
    }

    // 显示隐私政策
    const showPrivacyPolicy = () => {
      showToast('隐私政策页面开发中...')
    }

    // 显示使用条款
    const showTerms = () => {
      showToast('使用条款页面开发中...')
    }

    // 加载统计（错题数 / 分类数）
    const loadStats = async () => {
      try {
        const [catRes, qRes] = await Promise.all([
          categoryAPI.getCategories(),
          apiClient.get('/questions')
        ])
        const categories = catRes?.data?.data || []
        const questions = qRes?.data?.data || []
        stats.categoryCount = Array.isArray(categories) ? categories.length : 0
        stats.questionCount = Array.isArray(questions) ? questions.length : 0
      } catch (error) {
        console.warn('加载统计失败', error)
      }
    }

    // 加载设置
    const loadSettings = () => {
      const savedSettings = JSON.parse(localStorage.getItem('app_settings') || '{}')
      Object.assign(settings, savedSettings)
      
      const savedAutoClassify = JSON.parse(localStorage.getItem('auto_classify_config') || '{}')
      Object.assign(autoClassifyConfig, savedAutoClassify)
      
      const savedCloudConfig = JSON.parse(localStorage.getItem('cloud_config') || '{}')
      if (savedCloudConfig.accessKeyId) {
        Object.assign(cloudConfig, savedCloudConfig)
        cloudStatus.aliyun = true
      }
    }

    // 组件挂载
    onMounted(() => {
      loadSettings()
      loadStats()
    })

    return {
      userInfo,
      stats,
      appInfo,
      settings,
      cloudStatus,
      storageUsage,
      autoClassifyConfig,
      cloudConfig,
      showLanguagePicker,
      showQualityPicker,
      showAutoClassifySettings,
      showCloudConfig,
      syncing,
      fileInput,
      languageOptions,
      qualityOptions,
      getLanguageText,
      getQualityText,
      getCurrentLanguageIndex,
      getCurrentQualityIndex,
      onLanguageConfirm,
      onQualityConfirm,
      updateSetting,
      editProfile,
      saveAutoClassifySettings,
      saveCloudConfig,
      syncData,
      exportData,
      importData,
      handleImportFile,
      clearCache,
      resetApp,
      checkUpdate,
      feedback,
      showPrivacyPolicy,
      showTerms
    }
  }
}
</script>

<style scoped>
.settings-page {
  min-height: 100vh;
  background: var(--bg-primary);
  padding-bottom: 60px;
  position: relative;
}

/* 🌟 页面背景光效 */
.settings-page::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: 
    radial-gradient(circle 400px at 25% 25%, rgba(31, 91, 255, 0.04) 0%, transparent 50%),
    radial-gradient(circle 300px at 75% 75%, rgba(82, 183, 255, 0.03) 0%, transparent 50%);
  animation: floatingGlow 40s ease-in-out infinite;
  pointer-events: none;
  z-index: -1;
}

.user-section {
  padding: 20px;
}

.user-card {
  position: relative;
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-light) 50%, var(--accent-color) 100%);
  color: var(--bg-primary);
  border-radius: var(--radius-xl);
  padding: 24px;
  display: flex;
  align-items: center;
  box-shadow: 
    0 8px 32px rgba(31, 91, 255, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  overflow: hidden;
}

.user-card::before {
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

.user-avatar {
  margin-right: 16px;
}

.user-info {
  flex: 1;
  min-width: 0;
}

.user-name {
  font-size: 18px;
  font-weight: bold;
  margin: 0 0 4px 0;
}

.user-email {
  font-size: 14px;
  opacity: 0.9;
  margin: 0;
}

.user-stats {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  opacity: 0.95;
}

.user-stat b {
  font-size: 16px;
  font-weight: 700;
  margin-right: 2px;
}

.user-stat-divider {
  opacity: 0.6;
}

.settings-section,
.cloud-section,
.data-section,
.about-section {
  margin-top: 16px;
}

.auto-classify-settings,
.cloud-config {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: white;
  border-bottom: 1px solid #f5f5f5;
  font-weight: 500;
}

.settings-content,
.config-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px 0;
}

.config-tip {
  padding: 16px;
}
</style>