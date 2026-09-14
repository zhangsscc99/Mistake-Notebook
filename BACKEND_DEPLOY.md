# 后端服务器部署指南

## 📋 前置准备

1. **确保已安装 Java 17+**
```bash
java -version
# 应该显示 java version "17" 或更高
```

2. **确保已安装 Maven**
```bash
mvn -version
```

3. **确保 MySQL 已启动并创建数据库**
```bash
# 登录 MySQL
mysql -u root -p

# 创建数据库（如果不存在）
CREATE DATABASE IF NOT EXISTS mistake_notebook CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;
```

## 🔧 步骤 1：创建环境变量文件

在服务器上创建 `.env` 文件：

```bash
cd /root/Mistake-Notebook/backend
nano .env
```

将以下内容粘贴进去（**记得修改数据库密码**）：

```bash
# 阿里云百炼平台API密钥
DASHSCOPE_API_KEY=your-dashscope-api-key

# 视觉推理模型配置
DASHSCOPE_VISION_MODEL=qwen3-vl-plus
DASHSCOPE_ENABLE_THINKING=true
DASHSCOPE_THINKING_BUDGET=81920
DASHSCOPE_MAX_TOKENS=4000
DASHSCOPE_TEMPERATURE=0.1

# OCR服务配置
ALIYUN_OCR_USE_VISION_REASONING=true

# AI 通用模型配置（文本分类/对话）
AI_ALIYUN_API_KEY=your-dashscope-api-key
AI_ALIYUN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1/
AI_ALIYUN_MODEL=qwen-plus
AI_ALIYUN_APPLICATION_ID=
AI_ALIYUN_SYSTEM_CONTENT=你是一个擅长教育领域的智能助手，能够根据题目内容判断学科、知识点和难度，回答简洁准确。
AI_ALIYUN_PAYMENT_MODEL=qwen-plus
AI_ALIYUN_PAYMENT_SYSTEM_CONTENT=你是一个有用的AI助手

# 数据库配置（生产环境）
DB_USERNAME=root
DB_PASSWORD=你的数据库密码
```

保存并退出（`Ctrl+X`，然后 `Y`，然后 `Enter`）

## 🔨 步骤 2：构建后端 JAR

```bash
cd /root/Mistake-Notebook/backend

# 清理并打包（跳过测试）
mvn clean package -DskipTests

# 检查 JAR 文件是否生成
ls -lh target/notebook-backend-1.0.0.jar
```

## 🚀 步骤 3：使用 PM2 启动后端

### 方式一：使用 PM2 配置文件（推荐）

```bash
cd /root/Mistake-Notebook/backend

# 1. 创建日志目录
mkdir -p logs

# 2. 加载环境变量并启动
# 注意：PM2 不会自动加载 .env 文件，需要手动 source
source .env
export $(cat .env | grep -v '^#' | xargs)

# 3. 使用 PM2 启动
pm2 start ecosystem.config.js

# 4. 保存 PM2 配置
pm2 save

# 5. 设置开机自启
pm2 startup
# 执行上面命令输出的 sudo 命令
```

### 方式二：直接使用 PM2 命令（简单）

```bash
cd /root/Mistake-Notebook/backend

# 1. 创建日志目录
mkdir -p logs

# 2. 加载环境变量
source .env
export $(cat .env | grep -v '^#' | xargs)

# 3. 启动后端
pm2 start java \
  --name "mistake-notebook-backend" \
  --cwd /root/Mistake-Notebook/backend \
  -- \
  -jar target/notebook-backend-1.0.0.jar \
  --spring.profiles.active=prod

# 4. 保存并设置自启
pm2 save
pm2 startup
# 执行上面命令输出的 sudo 命令
```

### 方式三：使用启动脚本（最方便）

创建启动脚本 `start-backend.sh`：

```bash
cd /root/Mistake-Notebook/backend
nano start-backend.sh
```

内容：

```bash
#!/bin/bash
cd /root/Mistake-Notebook/backend

# 加载环境变量
set -a
source .env
set +a

# 启动后端
java -jar target/notebook-backend-1.0.0.jar --spring.profiles.active=prod
```

保存后：

```bash
chmod +x start-backend.sh

# 使用 PM2 启动脚本
pm2 start start-backend.sh --name "mistake-notebook-backend"

# 保存并设置自启
pm2 save
pm2 startup
```

## 📊 管理命令

```bash
# 查看状态
pm2 status
pm2 list

# 查看日志
pm2 logs mistake-notebook-backend
pm2 logs mistake-notebook-backend --lines 100

# 重启
pm2 restart mistake-notebook-backend

# 停止
pm2 stop mistake-notebook-backend

# 删除
pm2 delete mistake-notebook-backend

# 监控
pm2 monit
```

## 🔍 验证部署

```bash
# 1. 检查进程
pm2 list

# 2. 检查日志
pm2 logs mistake-notebook-backend --lines 50

# 3. 测试 API
curl http://localhost:8080/api/categories

# 4. 检查端口
netstat -tlnp | grep 8080
```

## ⚠️ 常见问题

### 问题 1：环境变量未加载

**症状**：日志显示 `not-configured` 或 API 调用失败

**解决**：
```bash
# 确保 .env 文件存在
ls -la /root/Mistake-Notebook/backend/.env

# 手动加载并重启
cd /root/Mistake-Notebook/backend
source .env
export $(cat .env | grep -v '^#' | xargs)
pm2 restart mistake-notebook-backend
```

### 问题 2：端口被占用

**症状**：`Port 8080 was already in use`

**解决**：
```bash
# 查找占用端口的进程
lsof -ti:8080

# 杀死进程
lsof -ti:8080 | xargs kill -9

# 或者修改 application.yml 中的端口
```

### 问题 3：数据库连接失败

**症状**：`Communications link failure` 或 `Access denied`

**解决**：
```bash
# 1. 检查 MySQL 是否运行
systemctl status mysql

# 2. 检查数据库是否存在
mysql -u root -p -e "SHOW DATABASES;"

# 3. 检查 .env 中的数据库密码是否正确
cat /root/Mistake-Notebook/backend/.env | grep DB_PASSWORD
```

### 问题 4：JAR 文件不存在

**症状**：`Error: Unable to access jarfile`

**解决**：
```bash
cd /root/Mistake-Notebook/backend
mvn clean package -DskipTests
ls -lh target/notebook-backend-1.0.0.jar
```

## 🔄 更新部署

```bash
cd /root/Mistake-Notebook/backend

# 1. 停止服务
pm2 stop mistake-notebook-backend

# 2. 拉取最新代码（如果使用 Git）
git pull

# 3. 重新构建
mvn clean package -DskipTests

# 4. 重启服务
pm2 restart mistake-notebook-backend

# 5. 查看日志确认
pm2 logs mistake-notebook-backend --lines 50
```

## 📝 完整部署命令序列

```bash
# ===== 首次部署 =====

# 1. 进入后端目录
cd /root/Mistake-Notebook/backend

# 2. 创建 .env 文件（手动编辑，填入正确的数据库密码）
nano .env

# 3. 构建 JAR
mvn clean package -DskipTests

# 4. 创建日志目录
mkdir -p logs

# 5. 加载环境变量并启动
source .env
export $(cat .env | grep -v '^#' | xargs)
pm2 start java \
  --name "mistake-notebook-backend" \
  --cwd /root/Mistake-Notebook/backend \
  -- \
  -jar target/notebook-backend-1.0.0.jar \
  --spring.profiles.active=prod

# 6. 保存配置
pm2 save

# 7. 设置开机自启
pm2 startup
# 复制并执行输出的 sudo 命令

# 8. 查看状态
pm2 status
pm2 logs mistake-notebook-backend
```

