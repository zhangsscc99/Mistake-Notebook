# 快速部署指南

## 🚀 一键部署（推荐）

### 步骤1：在服务器上初始化环境（仅首次需要）

```bash
# 上传初始化脚本到服务器
scp server-init.sh root@103.146.124.206:/root/

# SSH登录服务器
ssh root@103.146.124.206

# 执行初始化脚本
chmod +x server-init.sh
./server-init.sh
```

### 步骤2：在本地执行部署

```bash
# 在项目根目录执行
./deploy.sh
```

## 📝 手动部署步骤

### 1. 本地构建

```bash
# 构建前端
cd frontend
npm install
npm run build
cd ..

# 构建后端
cd backend
mvn clean package -DskipTests
cd ..
```

### 2. 上传文件

```bash
# 上传后端JAR
scp backend/target/notebook-backend-1.0.0.jar root@103.146.124.206:/opt/mistake-notebook/

# 上传前端
scp -r frontend/dist/* root@103.146.124.206:/opt/mistake-notebook/frontend/
```

### 3. 配置环境变量

```bash
ssh root@103.146.124.206
nano /opt/mistake-notebook/.env
```

确保配置了正确的API密钥和数据库密码。

### 4. 启动服务

```bash
# 重新加载systemd
systemctl daemon-reload

# 启动后端
systemctl start mistake-notebook
systemctl enable mistake-notebook

# 重启Nginx
systemctl restart nginx

# 查看状态
systemctl status mistake-notebook
```

## 🔍 验证部署

访问：`http://103.146.124.206`

如果看到前端页面，说明部署成功！

## 🐛 常见问题

### 后端无法启动

```bash
# 查看日志
journalctl -u mistake-notebook -f

# 检查端口
netstat -tlnp | grep 8080
```

### 前端404

```bash
# 检查Nginx配置
nginx -t

# 检查文件是否存在
ls -la /opt/mistake-notebook/frontend/dist/
```

### 数据库连接失败

```bash
# 测试数据库连接
mysql -u notebook_user -p mistake_notebook

# 检查MySQL状态
systemctl status mysql
```

