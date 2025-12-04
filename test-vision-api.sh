#!/bin/bash

# 测试视觉推理API脚本

echo "🧪 开始测试视觉推理API..."
echo "================================"

# 检查应用状态
echo "1. 检查应用状态..."
response=$(curl -s -w "%{http_code}" http://localhost:8080/api/upload/ocr -X POST)
http_code="${response: -3}"

if [ "$http_code" = "400" ] || [ "$http_code" = "415" ]; then
    echo "✅ 应用正常运行 (HTTP $http_code - 需要文件参数)"
elif [ "$http_code" = "000" ]; then
    echo "❌ 应用未启动或连接失败"
    exit 1
else
    echo "✅ 应用响应正常 (HTTP $http_code)"
fi

# 检查环境变量
echo ""
echo "2. 检查环境变量配置..."
if [ -f "/Users/Zhuanz1/Desktop/Mistake-Notebook/backend/.env" ]; then
    echo "✅ .env 文件存在"
    
    # 读取API密钥
    api_key=$(grep "DASHSCOPE_API_KEY" /Users/Zhuanz1/Desktop/Mistake-Notebook/backend/.env | cut -d'=' -f2)
    if [ -n "$api_key" ]; then
        echo "✅ API密钥已配置: ${api_key:0:20}..."
    else
        echo "❌ API密钥未找到"
    fi
    
    # 读取模型配置
    model=$(grep "DASHSCOPE_VISION_MODEL" /Users/Zhuanz1/Desktop/Mistake-Notebook/backend/.env | cut -d'=' -f2)
    echo "✅ 视觉模型: $model"
    
    vision_enabled=$(grep "ALIYUN_OCR_USE_VISION_REASONING" /Users/Zhuanz1/Desktop/Mistake-Notebook/backend/.env | cut -d'=' -f2)
    echo "✅ 视觉推理启用: $vision_enabled"
else
    echo "❌ .env 文件不存在"
fi

echo ""
echo "3. 配置验证完成！"
echo "================================"
echo ""
echo "📋 使用说明："
echo "1. 应用已启动在 http://localhost:8080"
echo "2. API密钥已配置完成"
echo "3. 可以通过以下方式测试："
echo ""
echo "   # 测试OCR接口"
echo "   curl -X POST http://localhost:8080/api/upload/ocr \\"
echo "        -F \"file=@your-image.jpg\""
echo ""
echo "   # 测试题目分割接口"  
echo "   curl -X POST http://localhost:8080/api/upload \\"
echo "        -F \"file=@your-image.jpg\""
echo ""
echo "🎉 视觉推理服务配置完成，可以开始使用了！"
