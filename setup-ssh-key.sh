#!/bin/bash

# 在服务器上配置SSH Key用于Git Clone

set -e

echo "🔑 开始配置SSH Key..."

# 1. 检查是否已有SSH key
if [ -f ~/.ssh/id_rsa.pub ]; then
    echo "✅ 检测到已存在的SSH key"
    echo ""
    echo "📋 你的公钥内容："
    cat ~/.ssh/id_rsa.pub
    echo ""
    echo "请复制上面的公钥内容，添加到GitHub："
    echo "1. 访问 https://github.com/settings/keys"
    echo "2. 点击 'New SSH key'"
    echo "3. 粘贴上面的公钥内容"
    echo ""
    read -p "是否已添加到GitHub？(y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "请先添加SSH key到GitHub，然后重新运行此脚本"
        exit 1
    fi
else
    # 2. 生成新的SSH key
    echo "📝 生成新的SSH key..."
    ssh-keygen -t rsa -b 4096 -C "server@mistake-notebook" -f ~/.ssh/id_rsa -N ""
    
    echo ""
    echo "✅ SSH key生成成功！"
    echo ""
    echo "📋 你的公钥内容："
    cat ~/.ssh/id_rsa.pub
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📌 请执行以下步骤："
    echo ""
    echo "1. 复制上面的公钥内容（从 ssh-rsa 开始到结尾）"
    echo "2. 访问：https://github.com/settings/keys"
    echo "3. 点击 'New SSH key' 按钮"
    echo "4. Title填写：Mistake-Notebook-Server"
    echo "5. Key类型选择：Authentication Key"
    echo "6. 粘贴复制的公钥内容"
    echo "7. 点击 'Add SSH key'"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    read -p "已添加到GitHub？(y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "请先添加SSH key到GitHub，然后重新运行此脚本"
        exit 1
    fi
fi

# 3. 测试SSH连接
echo ""
echo "🔍 测试GitHub SSH连接..."
ssh -T git@github.com || true

# 4. 安装Git（如果未安装）
if ! command -v git &> /dev/null; then
    echo "📦 安装Git..."
    apt update
    apt install git -y
fi

# 5. 配置Git用户信息（可选）
echo ""
read -p "是否配置Git用户信息？(y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "输入Git用户名: " git_username
    read -p "输入Git邮箱: " git_email
    git config --global user.name "$git_username"
    git config --global user.email "$git_email"
    echo "✅ Git用户信息已配置"
fi

echo ""
echo "✅ SSH Key配置完成！"
echo ""
echo "📋 现在可以使用以下命令克隆仓库："
echo ""
echo "git clone git@github.com:zhangsscc99/Mistake-Notebook.git"
echo ""

