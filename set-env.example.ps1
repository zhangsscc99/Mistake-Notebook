# 阿里云基础配置
$env:ALIYUN_ACCESS_KEY_ID = "your-access-key-id"
$env:ALIYUN_ACCESS_KEY_SECRET = "your-access-key-secret"

# OCR配置
$env:ALIYUN_OCR_ENDPOINT = "https://ocr-api.cn-hangzhou.aliyuncs.com"

# 通义千问AI配置
$env:DASHSCOPE_API_KEY = "your-dashscope-api-key"
$env:DASHSCOPE_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/"
$env:DASHSCOPE_MODEL = "qwen-turbo-latest"
$env:DASHSCOPE_APPLICATION_ID = "your-application-id"

Write-Host "环境变量已设置"