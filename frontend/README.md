# 错题本整理分类软件 - 前端

这是一个基于Vue 3开发的移动端错题本整理应用，支持拍照识别、智能分类和试卷组合功能。

## 功能特性

- 📸 **拍照整理**: 支持拍照或从相册选择图片，自动识别题目文字
- 🤖 **智能分类**: 使用AI大模型自动对题目进行分类整理
- 📋 **分类浏览**: 按分类查看错题，支持搜索和筛选
- 📄 **试卷组合**: 自由组合不同分类的题目，生成完整试卷
- 📱 **移动端优化**: 专为手机端设计，响应式布局适配各种屏幕
- ☁️ **云服务支持**: 集成阿里云图像识别和文本分析服务

## 技术栈

- **前端框架**: Vue 3 + Composition API
- **UI组件库**: Vant 4 (移动端组件库)
- **路由管理**: Vue Router 4
- **HTTP客户端**: Axios
- **构建工具**: Vue CLI
- **样式**: CSS3 + 移动端适配

## 项目结构

```
frontend/
├── public/
│   └── index.html              # HTML模板
├── src/
│   ├── api/                    # API服务层
│   │   ├── recognition.js      # 图像识别API
│   │   └── category.js         # 分类管理API
│   ├── components/             # 共用组件
│   ├── views/                  # 页面组件
│   │   ├── Camera.vue          # 拍照页面
│   │   ├── Categories.vue      # 分类列表页面
│   │   ├── CategoryDetail.vue  # 分类详情页面
│   │   ├── PaperBuilder.vue    # 试卷组合页面
│   │   └── Settings.vue        # 设置页面
│   ├── router/                 # 路由配置
│   │   └── index.js
│   ├── styles/                 # 样式文件
│   │   ├── global.css          # 全局样式
│   │   └── mobile-optimization.css # 移动端优化
│   ├── App.vue                 # 根组件
│   └── main.js                 # 入口文件
├── package.json                # 项目配置
└── README.md                   # 项目说明
```

## 安装和运行

### 环境要求

- Node.js >= 14.0.0
- npm >= 6.0.0

### 安装依赖

```bash
cd frontend
npm install
```

### 开发运行

```bash
npm run serve
```

应用将启动在 http://localhost:3060 

如果需要在手机上调试，可以访问：`http://[你的电脑IP]:3060`

### 构建生产版本

```bash
npm run build
```

## 核心页面说明

### 1. 拍照页面 (Camera.vue)
- 支持调用相机拍照或从相册选择图片
- 图片预览和批量处理
- 调用后端API进行文字识别和分类
- 显示最近处理记录

### 2. 分类列表页面 (Categories.vue)
- 显示所有错题分类
- 统计信息展示（总题数、分类数、今日新增）
- 支持搜索和下拉刷新
- 每个分类显示题目数量和最近更新时间

### 3. 分类详情页面 (CategoryDetail.vue)
- 显示分类下的所有题目
- 支持按难度、时间等维度排序筛选
- 题目预览和批量选择
- 支持加入试卷组合

### 4. 试卷组合页面 (PaperBuilder.vue)
- 设置试卷信息（标题、时长、总分）
- 从不同分类选择题目
- 题目排序和分数设置
- 导出PDF试卷功能

### 5. 设置页面 (Settings.vue)
- 个人信息管理
- 自动分类和识别参数配置
- 阿里云服务配置
- 数据备份和导入导出

## API服务

### 图像识别服务 (recognition.js)
- `recognizeImages()`: 批量识别图片中的文字
- 支持模拟数据，便于前端开发调试
- 自动处理网络错误和服务不可用情况

### 分类管理服务 (category.js)
- `getCategories()`: 获取所有分类
- `getCategoryDetail()`: 获取分类详情
- `getCategoryQuestions()`: 获取分类下的题目
- 提供完整的CRUD操作和统计功能

## 移动端优化

### 响应式设计
- 使用CSS媒体查询适配不同屏幕尺寸
- 针对手机竖屏、横屏进行专门优化
- 最小支持320px宽度的设备

### 交互优化
- 44px最小点击区域，符合iOS人机界面指南
- 滑动操作支持，如侧滑删除
- 合理的页面间转场动画
- 防止iOS缩放的字体大小设置

### 性能优化
- 图片懒加载和压缩
- 合理的骨架屏和加载状态
- 组件按需加载，减小包体积

## 环境变量配置

在项目根目录创建 `.env.local` 文件：

```bash
# API服务地址
VUE_APP_API_BASE_URL=http://localhost:3060/api

# 阿里云配置（可选）
VUE_APP_ALIYUN_REGION=cn-hangzhou

# 开发端口（可选，也可以在vue.config.js中配置）
PORT=3060
```

注意：`.env.local` 文件不会被提交到版本控制系统。

## 开发指南

### 添加新页面
1. 在 `src/views/` 下创建Vue组件
2. 在 `src/router/index.js` 中添加路由配置
3. 根据需要在底部导航栏添加入口

### 添加新API
1. 在 `src/api/` 下创建对应的服务文件
2. 实现API方法和错误处理
3. 提供模拟数据用于开发调试

### 样式规范
- 使用CSS变量定义主题色彩
- 遵循移动端设计规范
- 使用语义化的CSS类名

## 与后端对接

确保后端服务运行在 `http://localhost:8080`，并提供以下API端点：

- `POST /api/recognition/images` - 图像识别
- `GET /api/categories` - 获取分类列表
- `GET /api/categories/{id}` - 获取分类详情
- `GET /api/categories/{id}/questions` - 获取分类题目

## 部署说明

### 开发环境部署
1. 确保后端服务已启动
2. 运行 `npm run serve`
3. 在移动设备上访问开发服务器IP地址

### 生产环境部署
1. 配置生产环境API地址
2. 运行 `npm run build` 生成静态文件
3. 将 `dist/` 目录部署到Web服务器

## 常见问题

### Q: 图像识别功能不工作？
A: 检查后端API服务是否正常运行，或者查看是否在使用模拟数据模式。

### Q: 在手机上访问样式错乱？
A: 确保在手机浏览器中禁用了桌面版网站模式。

### Q: 拍照功能无法使用？
A: 需要在HTTPS环境下或localhost才能调用相机API。

## License

MIT License