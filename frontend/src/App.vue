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

:deep(.van-tabbar) {
  background: var(--bg-glass) !important;
  backdrop-filter: blur(12px) !important;
  border-top: 1px solid var(--border-color) !important;
  box-shadow: 0 -2px 16px rgba(0, 0, 0, 0.3) !important;
}

:deep(.van-tabbar-item) {
  color: var(--text-secondary) !important;
}

:deep(.van-tabbar-item--active) {
  color: var(--text-accent) !important;
}

:deep(.van-tabbar-item__text) {
  font-weight: 500 !important;
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

/* 确保搜索框样式正确 */
:deep(.van-search) {
  background: var(--bg-glass) !important;
  backdrop-filter: blur(12px) !important;
}

:deep(.van-search__content) {
  background: var(--bg-glass) !important;
  border: 1px solid var(--border-color) !important;
}

:deep(.van-field__control) {
  color: var(--text-primary) !important;
  background: transparent !important;
}

/* 🌟 浮动按钮全局样式覆盖 */
:deep(.van-floating-bubble) {
  background: linear-gradient(135deg, var(--primary-color), var(--primary-light)) !important;
  border: 2px solid rgba(255, 255, 255, 0.2) !important;
  box-shadow: 
    0 8px 32px rgba(232, 168, 85, 0.4),
    0 4px 16px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.3) !important;
  backdrop-filter: blur(12px) !important;
}

:deep(.van-floating-bubble:hover) {
  transform: scale(1.1) !important;
  box-shadow: 
    0 12px 48px rgba(232, 168, 85, 0.6),
    0 6px 24px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.4) !important;
  transition: all 0.3s var(--ease-smooth) !important;
}

:deep(.van-floating-bubble .van-icon) {
  color: var(--bg-primary) !important;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3)) !important;
}
</style>