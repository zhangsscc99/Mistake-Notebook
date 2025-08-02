# 错题本整理系统

一个基于Vue 3 + SpringBoot的智能错题本整理分类系统，支持拍照识别、智能分类和试卷生成。

## 🌟 项目特色

- **📱 移动端优化**：专为手机使用设计，参考苹果UI设计风格
- **📷 拍照识别**：支持拍照上传，自动OCR识别题目内容
- **🤖 智能分类**：AI自动分类题目到数学、语文、英语、物理、化学等科目
- **📚 分类管理**：按科目和难度管理错题，支持标签系统
- **📝 试卷生成**：自由组合题目生成试卷，支持预览和下载
- **☁️ 云服务集成**：预留阿里云OCR和通义千问API接口

## 🛠 技术栈

### 前端
- **Vue 3** + **TypeScript** + **Vite**
- **Vant 4** - 移动端UI组件库
- **Pinia** - 状态管理
- **Vue Router** - 路由管理
- **PostCSS** - 移动端适配

### 后端
- **Spring Boot 3.2**
- **Spring Data JPA** + **H2数据库**（开发环境）
- **Maven** - 依赖管理
- **阿里云SDK** - OCR识别和AI分类（预留接口）

## 🚀 快速开始

### 环境要求
- Node.js 16+
- Java 17+
- Maven 3.6+

### 前端启动

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

前端将运行在 `http://localhost:3000`

### 后端启动

```bash
cd backend

# 启动SpringBoot应用
mvn spring-boot:run
```

后端将运行在 `http://localhost:8080/api`

### 数据库管理

开发环境使用H2内存数据库，可通过以下地址访问数据库控制台：
- URL: `http://localhost:8080/api/h2-console`
- JDBC URL: `jdbc:h2:mem:notebook`
- 用户名: `sa`
- 密码: 空

## 📱 功能演示

### 主要功能界面

1. **主页面** - 拍照上传和最近题目
2. **错题分类** - 按科目浏览和管理
3. **分类详情** - 查看特定科目的所有题目
4. **试卷生成** - 选择题目生成试卷并预览

### 核心功能流程

1. **拍照上传** → OCR识别 → AI分类 → 保存题目
2. **浏览题目** → 按分类/难度筛选 → 选择题目
3. **生成试卷** → 题目排序 → 预览 → 下载

## 🔧 配置说明

### 阿里云服务配置

在 `backend/src/main/resources/application.yml` 中配置：

```yaml
aliyun:
  access-key-id: ${ALIYUN_ACCESS_KEY_ID:your-access-key-id}
  access-key-secret: ${ALIYUN_ACCESS_KEY_SECRET:your-access-key-secret}
  dashscope:
    api-key: ${DASHSCOPE_API_KEY:your-dashscope-api-key}
```

### 文件上传配置

```yaml
file:
  upload:
    path: ./uploads/
    max-size: 10485760  # 10MB
```

## 🌍 API接口文档

### 题目管理
- `GET /api/questions` - 查询题目列表
- `POST /api/questions` - 创建题目
- `PUT /api/questions/{id}` - 更新题目
- `DELETE /api/questions/{id}` - 删除题目

### 文件上传
- `POST /api/upload/question` - 上传图片并创建题目
- `POST /api/upload/ocr` - 仅进行OCR识别
- `POST /api/upload/classify` - 仅进行AI分类

### 统计信息
- `GET /api/questions/statistics/category` - 分类统计
- `GET /api/questions/statistics/difficulty` - 难度统计

## 🎨 设计特色

### 苹果风格设计系统
- 简洁现代的界面设计
- 流畅的动画过渡
- 一致的色彩搭配
- 优雅的卡片布局

### 移动端优化
- 响应式设计适配各种屏幕
- 触摸友好的交互体验
- 原生应用般的操作感受

## 🔮 扩展功能

### 已预留的扩展点
1. **真实阿里云服务集成**
2. **PDF试卷生成**
3. **用户系统和权限管理**
4. **题目收藏和学习记录**
5. **错题练习和复习提醒**

### 部署优化
- 生产环境MySQL数据库配置
- Docker容器化部署
- 静态资源CDN配置

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交Issue和Pull Request来改进项目！

---

**快速体验：**
1. 启动后端服务：`cd backend && mvn spring-boot:run`
2. 启动前端服务：`cd frontend && npm run dev`
3. 访问 `http://localhost:3000` 开始使用

**注意：** 当前版本使用模拟的OCR和AI服务，在生产环境中需要配置真实的阿里云API密钥。 