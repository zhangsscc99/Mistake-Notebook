@echo off
REM 阿里云基础配置
set ALIYUN_ACCESS_KEY_ID=your-access-key-id
set ALIYUN_ACCESS_KEY_SECRET=your-access-key-secret

REM OCR配置
set ALIYUN_OCR_ENDPOINT=https://ocr-api.cn-hangzhou.aliyuncs.com

REM 通义千问AI配置
set DASHSCOPE_API_KEY=your-dashscope-api-key
set DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1/
set DASHSCOPE_MODEL=qwen-turbo-latest
set DASHSCOPE_APPLICATION_ID=your-application-id

echo 环境变量已设置