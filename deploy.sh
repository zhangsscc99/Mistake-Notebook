#!/bin/bash

# 部署脚本 - 一键部署到服务器

set -e

# 配置
SERVER_IP="103.146.124.206"
SERVER_USER="root"
APP_DIR="/opt/mistake-notebook"
FRONTEND_DIR="frontend"
BACKEND_DIR="backend"

echo "🚀 开始部署错题本系统..."

# 1. 构建前端
echo "📦 构建前端..."
cd $FRONTEND_DIR
npm install
# 确保使用生产环境配置
npm run build
cd ..

# 2. 构建后端
echo "📦 构建后端..."
cd $BACKEND_DIR
mvn clean package -DskipTests
cd ..

# 3. 上传文件到服务器
echo "📤 上传文件到服务器..."

# 创建远程目录
ssh $SERVER_USER@$SERVER_IP "mkdir -p $APP_DIR/frontend"

# 上传后端JAR
echo "  上传后端JAR文件..."
scp $BACKEND_DIR/target/notebook-backend-1.0.0.jar $SERVER_USER@$SERVER_IP:$APP_DIR/

# 上传前端构建产物
echo "  上传前端构建产物..."
scp -r $FRONTEND_DIR/dist/* $SERVER_USER@$SERVER_IP:$APP_DIR/frontend/

# 4. 在服务器上执行部署命令
echo "🔧 配置服务器..."
ssh $SERVER_USER@$SERVER_IP << 'ENDSSH'
cd /opt/mistake-notebook

# 重启后端服务
if systemctl is-active --quiet mistake-notebook; then
    echo "  重启后端服务..."
    systemctl restart mistake-notebook
else
    echo "  启动后端服务..."
    systemctl start mistake-notebook
fi

# 重启Nginx
echo "  重启Nginx..."
systemctl restart nginx

# 检查服务状态
echo "📊 服务状态："
systemctl status mistake-notebook --no-pager -l
ENDSSH

echo "✅ 部署完成！"
echo "🌐 访问地址: http://$SERVER_IP"

