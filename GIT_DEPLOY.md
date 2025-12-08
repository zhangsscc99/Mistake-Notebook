# 使用Git部署指南

## 🔑 步骤1：在服务器上配置SSH Key

### 方式一：使用脚本（推荐）

```bash
# 1. 上传脚本到服务器
scp setup-ssh-key.sh root@103.146.124.206:/root/

# 2. SSH登录服务器
ssh root@103.146.124.206

# 3. 执行脚本
chmod +x setup-ssh-key.sh
./setup-ssh-key.sh
```

脚本会自动：
- 生成SSH key（如果没有）
- 显示公钥内容
- 引导你添加到GitHub
- 测试SSH连接
- 安装Git（如果需要）

### 方式二：手动配置

```bash
# 1. SSH登录服务器
ssh root@103.146.124.206

# 2. 生成SSH key
ssh-keygen -t rsa -b 4096 -C "server@mistake-notebook"
# 按回车使用默认路径，可以设置密码或直接回车

# 3. 查看公钥
cat ~/.ssh/id_rsa.pub

# 4. 复制公钥内容，添加到GitHub：
#    - 访问：https://github.com/settings/keys
#    - 点击 "New SSH key"
#    - Title: Mistake-Notebook-Server
#    - 粘贴公钥内容
#    - 点击 "Add SSH key"

# 5. 测试连接
ssh -T git@github.com
# 应该看到：Hi zhangsscc99! You've successfully authenticated...
```

## 📥 步骤2：克隆仓库

```bash
# 在服务器上
cd /opt
git clone git@github.com:zhangsscc99/Mistake-Notebook.git mistake-notebook
cd mistake-notebook
```

## 🚀 步骤3：部署应用

### 3.1 初始化服务器环境（仅首次）

```bash
# 上传初始化脚本
scp server-init.sh root@103.146.124.206:/opt/mistake-notebook/

# 在服务器上执行
cd /opt/mistake-notebook
chmod +x server-init.sh
./server-init.sh
```

### 3.2 构建和部署

```bash
# 在服务器上
cd /opt/mistake-notebook

# 构建前端
cd frontend
npm install
npm run build
cd ..

# 构建后端
cd backend
mvn clean package -DskipTests
cd ..

# 配置环境变量
nano .env
# 编辑API密钥和数据库密码

# 启动服务
systemctl daemon-reload
systemctl start mistake-notebook
systemctl enable mistake-notebook
systemctl restart nginx
```

## 🔄 更新部署

### 方式一：手动更新

```bash
# 在服务器上
cd /opt/mistake-notebook

# 拉取最新代码
git pull origin main

# 重新构建前端
cd frontend
npm install
npm run build
cd ..

# 重新构建后端
cd backend
mvn clean package -DskipTests
cd ..

# 重启服务
systemctl restart mistake-notebook
systemctl restart nginx
```

### 方式二：使用更新脚本

创建 `update.sh` 脚本：

```bash
#!/bin/bash
cd /opt/mistake-notebook
git pull origin main
cd frontend && npm install && npm run build && cd ..
cd backend && mvn clean package -DskipTests && cd ..
systemctl restart mistake-notebook
systemctl restart nginx
echo "✅ 更新完成！"
```

## 📝 完整部署流程（首次）

```bash
# 1. 在服务器上配置SSH key
ssh root@103.146.124.206
./setup-ssh-key.sh  # 或手动配置

# 2. 克隆仓库
cd /opt
git clone git@github.com:zhangsscc99/Mistake-Notebook.git mistake-notebook
cd mistake-notebook

# 3. 初始化服务器环境
chmod +x server-init.sh
./server-init.sh

# 4. 配置环境变量
nano .env
# 编辑数据库密码和API密钥

# 5. 构建应用
cd frontend && npm install && npm run build && cd ..
cd backend && mvn clean package -DskipTests && cd ..

# 6. 启动服务
systemctl daemon-reload
systemctl start mistake-notebook
systemctl enable mistake-notebook
systemctl restart nginx

# 7. 检查状态
systemctl status mistake-notebook
```

## 🔍 验证部署

访问：`http://103.146.124.206`

如果看到前端页面，说明部署成功！

## 🐛 常见问题

### SSH连接失败

```bash
# 检查SSH key是否添加
ssh -T git@github.com

# 如果失败，检查：
cat ~/.ssh/id_rsa.pub  # 确认公钥存在
# 确认已添加到GitHub
```

### Git clone失败

```bash
# 确认使用SSH URL
git clone git@github.com:zhangsscc99/Mistake-Notebook.git

# 不要使用HTTPS URL
# git clone https://github.com/zhangsscc99/Mistake-Notebook.git
```

### 构建失败

```bash
# 检查Node.js版本
node -v  # 需要 16+

# 检查Java版本
java -version  # 需要 17+

# 检查Maven
mvn -v
```

