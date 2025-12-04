#!/bin/bash

echo "🔍 调试视觉推理API"
echo "=================="

# 1. 检查应用状态
echo "1. 检查应用状态..."
response=$(curl -s -w "%{http_code}" http://localhost:8080/api/upload/ocr -X POST)
http_code="${response: -3}"
echo "应用响应码: $http_code"

# 2. 检查环境变量
echo ""
echo "2. 检查环境变量..."
if [ -f "/Users/Zhuanz1/Desktop/Mistake-Notebook/backend/.env" ]; then
    echo "✅ .env文件存在"
    api_key=$(grep "DASHSCOPE_API_KEY" /Users/Zhuanz1/Desktop/Mistake-Notebook/backend/.env | cut -d'=' -f2)
    echo "API Key: ${api_key:0:20}..."
else
    echo "❌ .env文件不存在"
fi

# 3. 测试简单的API调用
echo ""
echo "3. 测试API调用..."
echo "创建测试文件..."
echo "Hello World" > test-simple.txt

echo "测试文件上传..."
response=$(curl -s -X POST http://localhost:8080/api/upload/ocr \
  -F "file=@test-simple.txt" \
  -H "Accept: application/json")

echo "响应: $response"

# 4. 测试图片文件
echo ""
echo "4. 测试图片文件..."
if [ -f "test-math.jpg" ]; then
    echo "✅ 测试图片存在"
    file_size=$(wc -c < test-math.jpg)
    echo "图片大小: $file_size bytes"
    
    echo "发送图片识别请求..."
    response=$(curl -s -X POST http://localhost:8080/api/upload/ocr \
      -F "file=@test-math.jpg" \
      -H "Accept: application/json" \
      --max-time 30)
    
    echo "响应: $response"
else
    echo "❌ 测试图片不存在"
fi

# 5. 检查应用日志（如果可以访问）
echo ""
echo "5. 建议检查应用日志以获取详细错误信息"
echo "可以在应用控制台查看具体的错误堆栈"

# 清理临时文件
rm -f test-simple.txt

echo ""
echo "🔍 调试完成"
