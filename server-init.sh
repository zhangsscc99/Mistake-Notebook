#!/bin/bash

# 服务器初始化脚本 - 在服务器上执行

set -e

echo "🔧 开始初始化服务器环境..."

# 1. 更新系统
echo "📦 更新系统..."
apt update && apt upgrade -y

# 2. 安装Java 17
echo "☕ 安装Java 17..."
apt install openjdk-17-jdk -y

# 3. 安装MySQL
echo "🗄️  安装MySQL..."
apt install mysql-server -y

# 4. 安装Nginx
echo "🌐 安装Nginx..."
apt install nginx -y

# 5. 创建应用目录
echo "📁 创建应用目录..."
mkdir -p /opt/mistake-notebook/frontend
mkdir -p /opt/mistake-notebook/uploads

# 6. 配置MySQL数据库
echo "🗄️  配置数据库..."
mysql -u root <<MYSQL_SCRIPT
CREATE DATABASE IF NOT EXISTS mistake_notebook CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'notebook_user'@'localhost' IDENTIFIED BY 'Notebook@2024!';
GRANT ALL PRIVILEGES ON mistake_notebook.* TO 'notebook_user'@'localhost';
FLUSH PRIVILEGES;
MYSQL_SCRIPT

echo "✅ 数据库配置完成！"
echo "   数据库名: mistake_notebook"
echo "   用户名: notebook_user"
echo "   密码: Notebook@2024!"
echo ""
echo "⚠️  请记住修改数据库密码！"

# 7. 创建systemd服务文件
echo "⚙️  创建systemd服务..."
cat > /etc/systemd/system/mistake-notebook.service <<EOF
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
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# 8. 创建Nginx配置
echo "🌐 配置Nginx..."
cat > /etc/nginx/sites-available/mistake-notebook <<EOF
server {
    listen 80;
    server_name _;

    # 前端静态文件
    location / {
        root /opt/mistake-notebook/frontend/dist;
        try_files \$uri \$uri/ /index.html;
        index index.html;
    }

    # 后端API代理
    location /api {
        proxy_pass http://localhost:8080;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
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
EOF

# 启用Nginx配置
ln -sf /etc/nginx/sites-available/mistake-notebook /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# 测试Nginx配置
nginx -t

# 9. 配置防火墙
echo "🔥 配置防火墙..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
echo "y" | ufw enable

# 10. 创建.env文件模板
echo "📝 创建环境变量模板..."
cat > /opt/mistake-notebook/.env <<EOF
# 数据库配置
DB_USERNAME=notebook_user
DB_PASSWORD=Notebook@2024!

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
EOF

echo ""
echo "✅ 服务器初始化完成！"
echo ""
echo "📋 下一步："
echo "1. 修改 /opt/mistake-notebook/.env 文件中的配置"
echo "2. 上传JAR文件和前端构建产物"
echo "3. 运行: systemctl daemon-reload"
echo "4. 运行: systemctl start mistake-notebook"
echo "5. 运行: systemctl restart nginx"

