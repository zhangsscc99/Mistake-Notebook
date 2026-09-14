# 部署指南

## 📋 部署前准备

### 服务器要求
- Ubuntu 20.04+ / CentOS 7+
- Java 17+
- Node.js 16+ (仅用于构建前端)
- MySQL 8.0+
- Nginx (用于反向代理)

### 本地构建

#### 1. 构建前端

```bash
cd frontend
npm install
# 生产环境构建会自动使用 .env.production 中的配置
npm run build
```

构建产物在 `frontend/dist` 目录

**注意**：`.env.production` 文件已配置为使用相对路径 `/api`，这样前端会通过Nginx代理访问后端。

#### 2. 构建后端

```bash
cd backend
mvn clean package -DskipTests
```

构建产物在 `backend/target/notebook-backend-1.0.0.jar`

## 🚀 服务器部署步骤

### 1. 连接服务器

```bash
ssh root@103.146.124.206
```

### 2. 安装必要软件

```bash
# 更新系统
apt update && apt upgrade -y

# 安装Java 17
apt install openjdk-17-jdk -y

# 安装MySQL
apt install mysql-server -y

# 安装Nginx
apt install nginx -y

# 安装Node.js (用于构建，可选)
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs
```

### 3. 配置MySQL数据库

```bash
# 登录MySQL
mysql -u root -p

# 创建数据库和用户
CREATE DATABASE mistake_notebook CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'notebook_user'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON mistake_notebook.* TO 'notebook_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 4. 创建应用目录

```bash
mkdir -p /opt/mistake-notebook
cd /opt/mistake-notebook
```

### 5. 上传文件到服务器

**方式一：使用scp上传**

```bash
# 在本地执行
# 上传后端JAR文件
scp backend/target/notebook-backend-1.0.0.jar root@103.146.124.206:/opt/mistake-notebook/

# 上传前端构建产物
scp -r frontend/dist root@103.146.124.206:/opt/mistake-notebook/frontend
```

**方式二：使用git（如果服务器有git）**

```bash
# 在服务器上
cd /opt/mistake-notebook
git clone <your-repo-url> .
cd backend && mvn clean package -DskipTests
cd ../frontend && npm install && npm run build
```

### 6. 配置后端环境变量

```bash
cd /opt/mistake-notebook
nano .env
```

添加以下内容：

```bash
# 数据库配置
DB_USERNAME=notebook_user
DB_PASSWORD=your_secure_password

# 阿里云API配置
AI_ALIYUN_API_KEY=your-dashscope-api-key
AI_ALIYUN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1/
AI_ALIYUN_MODEL=qwen-plus
AI_ALIYUN_APPLICATION_ID=dec67a3c4cbb45548b530dc7df0feacb

# DashScope配置
DASHSCOPE_API_KEY=your-dashscope-api-key
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1/
DASHSCOPE_MODEL=qwen-turbo
DASHSCOPE_VISION_MODEL=qwen3-vl-plus
```

### 7. 创建systemd服务

```bash
nano /etc/systemd/system/mistake-notebook.service
```

添加以下内容：

```ini
[Unit]
Description=Mistake Notebook Backend Service
After=network.target mysql.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/mistake-notebook
EnvironmentFile=/opt/mistake-notebook/.env
ExecStart=/usr/bin/java -jar -Dspring.profiles.active=prod /opt/mistake-notebook/notebook-backend-1.0.0.jar
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

启动服务：

```bash
systemctl daemon-reload
systemctl enable mistake-notebook
systemctl start mistake-notebook
systemctl status mistake-notebook
```

### 8. 配置Nginx

```bash
nano /etc/nginx/sites-available/mistake-notebook
```

添加以下配置：

```nginx
server {
    listen 80;
    server_name your-domain.com;  # 替换为你的域名或IP

    # 前端静态文件
    location / {
        root /opt/mistake-notebook/frontend/dist;
        try_files $uri $uri/ /index.html;
        index index.html;
    }

    # 后端API代理
    location /api {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 文件上传大小限制
        client_max_body_size 10M;
        
        # 超时设置
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        root /opt/mistake-notebook/frontend/dist;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

启用配置：

```bash
ln -s /etc/nginx/sites-available/mistake-notebook /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

### 9. 配置防火墙

```bash
# 允许HTTP和HTTPS
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 22/tcp
ufw enable
```

### 10. 配置SSL证书（可选，推荐）

使用Let's Encrypt免费证书：

```bash
apt install certbot python3-certbot-nginx -y
certbot --nginx -d your-domain.com
```

## 🔄 更新部署

### 更新后端

```bash
# 1. 上传新的JAR文件
scp backend/target/notebook-backend-1.0.0.jar root@103.146.124.206:/opt/mistake-notebook/

# 2. 在服务器上重启服务
ssh root@103.146.124.206
systemctl restart mistake-notebook
```

### 更新前端

```bash
# 1. 构建新版本
cd frontend && npm run build

# 2. 上传到服务器
scp -r frontend/dist root@103.146.124.206:/opt/mistake-notebook/frontend

# 3. 重启Nginx
ssh root@103.146.124.206
systemctl restart nginx
```

## 📊 监控和日志

### 查看后端日志

```bash
journalctl -u mistake-notebook -f
```

### 查看Nginx日志

```bash
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

## 🛠 故障排查

### 后端无法启动

1. 检查Java版本：`java -version`
2. 检查端口占用：`netstat -tlnp | grep 8080`
3. 查看日志：`journalctl -u mistake-notebook -n 50`

### 前端无法访问

1. 检查Nginx状态：`systemctl status nginx`
2. 检查配置文件：`nginx -t`
3. 检查文件权限：`ls -la /opt/mistake-notebook/frontend/dist`

### 数据库连接失败

1. 检查MySQL状态：`systemctl status mysql`
2. 测试连接：`mysql -u notebook_user -p mistake_notebook`
3. 检查防火墙：`ufw status`

## 📝 注意事项

1. **安全建议**：
   - 修改默认数据库密码
   - 使用强密码
   - 定期更新系统
   - 配置防火墙规则
   - 使用HTTPS

2. **性能优化**：
   - 配置MySQL连接池
   - 启用Nginx缓存
   - 使用CDN加速静态资源

3. **备份**：
   - 定期备份数据库
   - 备份上传的文件
   - 备份配置文件

