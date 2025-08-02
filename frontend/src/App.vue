<template>
  <div id="app">
    <router-view v-slot="{ Component }">
      <component :is="Component" v-if="Component" />
    </router-view>
  </div>
</template>

<script>
export default {
  name: 'App'
}
</script>

<style>
#app {
  font-family: "Inter", -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: var(--text-primary);
  height: 100vh;
  background: var(--bg-primary);
  position: relative;
  overflow-x: hidden;
}

/* 🌟 App级别的背景光效 */
#app::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: 
    radial-gradient(ellipse 1200px 800px at 20% 30%, rgba(232, 168, 85, 0.06) 0%, transparent 50%),
    radial-gradient(ellipse 800px 600px at 80% 70%, rgba(244, 190, 126, 0.04) 0%, transparent 50%),
    radial-gradient(ellipse 600px 400px at 50% 90%, rgba(248, 213, 168, 0.03) 0%, transparent 50%);
  animation: floatingGlow 25s ease-in-out infinite;
  pointer-events: none;
  z-index: -2;
}

/* 无动画页面切换 */
.page-enter-active, .page-leave-active {
  transition: none;
}

.page-enter-from {
  opacity: 1;
}

.page-leave-to {
  opacity: 1;
}

/* 🎯 全局深色主题Vant组件覆盖 */
:deep(.van-nav-bar) {
  background: var(--bg-glass) !important;
  backdrop-filter: blur(12px) !important;
  border-bottom: 1px solid var(--border-color) !important;
}

:deep(.van-nav-bar__title) {
  color: var(--text-primary) !important;
  font-weight: 600 !important;
}

/* 🌟 精致底部导航栏 - 强制覆盖 */
.van-tabbar,
:deep(.van-tabbar),
:deep(.van-tabbar.van-tabbar--fixed) {
  background: var(--bg-glass) !important;
  background-color: var(--bg-glass) !important;
  backdrop-filter: blur(16px) !important;
  border-top: 1px solid var(--border-glow) !important;
  box-shadow: 
    0 -4px 20px rgba(0, 0, 0, 0.4),
    0 -1px 0 rgba(232, 168, 85, 0.1) !important;
  position: relative !important;
}

:deep(.van-tabbar::before) {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, 
    transparent 0%, 
    rgba(232, 168, 85, 0.3) 20%, 
    rgba(232, 168, 85, 0.6) 50%, 
    rgba(232, 168, 85, 0.3) 80%, 
    transparent 100%);
}

.van-tabbar-item,
:deep(.van-tabbar-item) {
  color: var(--text-secondary) !important;
  transition: all 0.4s var(--ease-smooth) !important;
  position: relative !important;
  overflow: visible !important;
  padding: 8px 4px !important;
}

:deep(.van-tabbar-item:hover) {
  color: var(--text-primary) !important;
  transform: translateY(-1px);
}

.van-tabbar-item--active,
:deep(.van-tabbar-item--active) {
  color: var(--text-accent) !important;
  position: relative !important;
}

/* 激活状态的顶部金色指示条 */
:deep(.van-tabbar-item--active::before) {
  content: '';
  position: absolute;
  top: -1px;
  left: 50%;
  transform: translateX(-50%);
  width: 32px;
  height: 3px;
  background: linear-gradient(90deg, 
    var(--primary-color) 0%, 
    #FFD700 50%, 
    var(--primary-light) 100%);
  border-radius: 0 0 2px 2px;
  box-shadow: 
    0 0 12px rgba(232, 168, 85, 0.8),
    0 2px 4px rgba(232, 168, 85, 0.3);
  animation: tabGlow 2s ease-in-out infinite;
}

/* 激活状态的背景光晕 */
:deep(.van-tabbar-item--active::after) {
  content: '';
  position: absolute;
  top: 4px;
  left: 50%;
  transform: translateX(-50%);
  width: 48px;
  height: 48px;
  background: radial-gradient(circle, 
    rgba(232, 168, 85, 0.15) 0%, 
    rgba(232, 168, 85, 0.05) 50%, 
    transparent 100%);
  border-radius: 50%;
  z-index: -1;
  animation: tabPulse 3s ease-in-out infinite;
}

.van-tabbar-item--active .van-tabbar-item__text,
:deep(.van-tabbar-item--active .van-tabbar-item__text) {
  color: var(--text-accent) !important;
  font-weight: 700 !important;
  text-shadow: 
    0 0 8px rgba(232, 168, 85, 0.4),
    0 1px 2px rgba(0, 0, 0, 0.3) !important;
  background: linear-gradient(135deg, 
    var(--text-accent) 0%, 
    #FFD700 50%, 
    var(--text-accent) 100%) !important;
  background-size: 200% 100% !important;
  -webkit-background-clip: text !important;
  -webkit-text-fill-color: transparent !important;
  background-clip: text !important;
  animation: shimmer 4s ease-in-out infinite !important;
}

.van-tabbar-item--active .van-tabbar-item__icon,
:deep(.van-tabbar-item--active .van-tabbar-item__icon) {
  color: var(--text-accent) !important;
  filter: 
    drop-shadow(0 0 8px rgba(232, 168, 85, 0.6))
    drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3)) !important;
  transform: scale(1.15) translateY(-1px) !important;
  animation: iconFloat 3s ease-in-out infinite !important;
}

:deep(.van-tabbar-item__text) {
  font-weight: 500 !important;
  font-size: 11px !important;
  letter-spacing: 0.5px !important;
  margin-top: 2px !important;
}

:deep(.van-tabbar-item__icon) {
  font-size: 20px !important;
  transition: all 0.4s var(--ease-smooth) !important;
}

/* 添加底部导航栏动画 */
@keyframes tabGlow {
  0%, 100% { opacity: 0.8; }
  50% { opacity: 1; box-shadow: 0 0 16px rgba(232, 168, 85, 1), 0 2px 6px rgba(232, 168, 85, 0.4); }
}

@keyframes tabPulse {
  0%, 100% { opacity: 0.3; transform: translateX(-50%) scale(1); }
  50% { opacity: 0.5; transform: translateX(-50%) scale(1.05); }
}

@keyframes iconFloat {
  0%, 100% { transform: scale(1.15) translateY(-1px); }
  50% { transform: scale(1.2) translateY(-2px); }
}

:deep(.van-button--primary) {
  background: linear-gradient(135deg, var(--primary-color), var(--primary-light)) !important;
  border: none !important;
  box-shadow: 0 4px 16px rgba(232, 168, 85, 0.3) !important;
  color: var(--bg-primary) !important;
}

:deep(.van-button--default) {
  background: var(--bg-glass) !important;  
  border: 1px solid var(--border-color) !important;
  color: var(--text-primary) !important;
  backdrop-filter: blur(8px) !important;
}

/* 移除所有蓝色按钮样式 */
:deep(.van-button) {
  background: var(--bg-glass) !important;
  border: 1px solid var(--border-glow) !important;
  color: var(--text-accent) !important;
  backdrop-filter: blur(8px) !important;
}

:deep(.van-button--primary) {
  background: linear-gradient(135deg, var(--primary-color), var(--primary-light)) !important;
  border: none !important;
  color: var(--bg-primary) !important;
}

:deep(.van-tag--primary) {
  background: rgba(232, 168, 85, 0.2) !important;
  color: var(--text-accent) !important;
  border: 1px solid rgba(232, 168, 85, 0.3) !important;
}

:deep(.van-tag--default) {
  background: var(--bg-glass) !important;
  color: var(--text-secondary) !important;
  border: 1px solid var(--border-color) !important;
}

/* 移除所有可能的蓝色元素 */
:deep(.van-circle) {
  display: none !important;
}

:deep(.van-icon) {
  color: var(--text-accent) !important;
}

:deep(.van-loading__spinner) {
  color: var(--text-accent) !important;
}

:deep(.van-pull-refresh__loading) {
  color: var(--text-accent) !important;
}

/* 🌟 搜索框金色主题样式 - 强制覆盖 */
:deep(.van-search) {
  background: var(--bg-card) !important;
  backdrop-filter: blur(12px) !important;
  border: 1px solid var(--border-glow) !important;
  border-radius: var(--radius-lg) !important;
  box-shadow: var(--shadow-glow) !important;
  margin: 16px !important;
}

:deep(.van-search__content),
:deep(.van-search__content--square) {
  background: var(--bg-glass) !important;
  border: 1px solid var(--border-glow) !important;
  border-radius: var(--radius-md) !important;
  box-shadow: 
    var(--shadow-glow),
    inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
  backdrop-filter: blur(8px) !important;
}

:deep(.van-search__field),
:deep(.van-search .van-field) {
  background: transparent !important;
}

:deep(.van-search .van-field__control),
:deep(.van-field__control) {
  color: var(--text-primary) !important;
  background: transparent !important;
  font-weight: 500 !important;
}

:deep(.van-search .van-field__control::placeholder) {
  color: var(--text-secondary) !important;
}

:deep(.van-search__action) {
  color: var(--text-accent) !important;
  font-weight: 600 !important;
}

/* 针对特定页面的搜索框 */
:deep(.tech-search .van-search__content) {
  background: var(--bg-glass) !important;
  border: 1px solid var(--border-glow) !important;
  border-radius: var(--radius-md) !important;
}

:deep(.tech-search .van-field__control) {
  background: transparent !important;
  color: var(--text-primary) !important;
}

/* 🔥 超强优先级 - 移除所有白色背景 */
:deep(.van-search__content--square),
:deep(.van-search__content),
:deep(.van-field__body),
:deep(.van-field),
:deep(.van-cell) {
  background: var(--bg-glass) !important;
  background-color: var(--bg-glass) !important;
}

/* 专门针对搜索框内部元素 */
:deep(.van-search .van-field__body) {
  background: transparent !important;
  background-color: transparent !important;
}

/* 🎯 精确覆盖Vant默认样式 */
.van-search__content--square {
  background: var(--bg-glass) !important;
  background-color: var(--bg-glass) !important;
}

.van-search .van-field {
  background: transparent !important;
  background-color: transparent !important;
}

.van-search .van-field__body {
  background: transparent !important;
  background-color: transparent !important;
}

/* 🌟 表单字段金色主题样式 - 全面覆盖 */
:deep(.van-cell-group),
:deep(.van-cell-group--inset) {
  background: var(--bg-card) !important;
  backdrop-filter: blur(12px) !important;
  border: 1px solid var(--border-glow) !important;
  border-radius: var(--radius-lg) !important;
  box-shadow: var(--shadow-glow) !important;
  overflow: hidden !important;
  margin: 16px !important;
}

:deep(.van-cell) {
  background: var(--bg-glass) !important;
  background-color: var(--bg-glass) !important;
  border-bottom: 1px solid var(--divider-color) !important;
  backdrop-filter: blur(8px) !important;
}

:deep(.van-cell:last-child) {
  border-bottom: none !important;
}

:deep(.van-cell__title) {
  color: var(--text-primary) !important;
  font-weight: 500 !important;
}

:deep(.van-cell__value) {
  color: var(--text-accent) !important;
  font-weight: 500 !important;
}

:deep(.van-field__label) {
  color: var(--text-primary) !important;
  font-weight: 500 !important;
}

:deep(.van-field__body) {
  background: transparent !important;
  background-color: transparent !important;
  border-radius: var(--radius-sm) !important;
}

:deep(.van-field) {
  background: transparent !important;
  background-color: transparent !important;
}

:deep(.van-field__control) {
  color: var(--text-primary) !important;
  background: transparent !important;
  background-color: transparent !important;
  font-weight: 500 !important;
}

:deep(.van-field__control::placeholder) {
  color: var(--text-secondary) !important;
}

/* 🔥 强制移除任何白色背景 */
:deep(.van-field),
:deep(.van-field__body),
:deep(.van-cell),
:deep(.van-cell-group) {
  background: var(--bg-glass) !important;
  background-color: var(--bg-glass) !important;
}

:deep(.van-field__control),
:deep(.van-field__body) {
  background: transparent !important;
  background-color: transparent !important;
}

/* 🌟 下拉菜单金色主题 */
:deep(.van-dropdown-menu) {
  background: var(--bg-card) !important;
  backdrop-filter: blur(12px) !important;
  border-bottom: 1px solid var(--border-glow) !important;
  box-shadow: var(--shadow-glow) !important;
}

:deep(.van-dropdown-item) {
  background: var(--bg-glass) !important;
  color: var(--text-primary) !important;
  border-right: 1px solid var(--divider-color) !important;
}


</style>