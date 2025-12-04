# 视觉推理功能使用指南

## 概述

本项目已升级支持阿里云百炼平台的视觉推理模型，相比传统OCR具有以下优势：

### 视觉推理 vs 传统OCR

| 特性 | 视觉推理模型 | 传统OCR |
|------|-------------|---------|
| 文字识别准确率 | 更高，特别是复杂场景 | 一般 |
| 数学公式识别 | 优秀，支持复杂公式 | 有限 |
| 题目理解能力 | 具备语义理解 | 仅文字识别 |
| 题目分割能力 | 智能分割，理解题目结构 | 基于规则分割 |
| 学科分类 | 自动识别学科类型 | 需要后续AI分类 |
| 推理过程 | 提供思考过程 | 无 |

## 配置说明

### 1. 环境变量配置

```bash
# 必需：百炼平台API Key
DASHSCOPE_API_KEY=sk-your-api-key

# 可选：视觉推理模型配置
DASHSCOPE_VISION_MODEL=qwen3-vl-plus          # 推荐模型
DASHSCOPE_ENABLE_THINKING=true                # 启用思考过程
DASHSCOPE_THINKING_BUDGET=81920               # 思考过程最大Token数
DASHSCOPE_MAX_TOKENS=4000                     # 响应最大Token数
DASHSCOPE_TEMPERATURE=0.1                     # 温度参数（0.1较准确）

# 可选：OCR模式控制
ALIYUN_OCR_USE_VISION_REASONING=true          # 是否使用视觉推理
```

### 2. 支持的模型

#### 推荐模型（混合思考）
- `qwen3-vl-plus` - 平衡性能和成本，推荐使用
- `qwen3-vl-flash` - 更快响应速度

#### 高级模型（仅思考）
- `qwen3-vl-235b-a22b-thinking` - 最强性能
- `qwen3-vl-32b-thinking` - 高性能
- `qwen3-vl-8b-thinking` - 轻量级

#### 特殊模型
- `qvq-max` - 专门的视觉推理模型（仅流式输出）

## API使用示例

### 1. 基础文字识别

```bash
curl -X POST http://localhost:8080/api/upload/ocr \
  -F "file=@math_problem.jpg" \
  -H "Content-Type: multipart/form-data"
```

响应示例：
```json
{
  "success": true,
  "text": "1. 求解方程 x² + 2x - 3 = 0\nA. x = 1, x = -3\nB. x = -1, x = 3\nC. x = 2, x = -1\nD. x = 3, x = -2",
  "confidence": 0.95,
  "error": null
}
```

### 2. 智能题目分割

```bash
curl -X POST http://localhost:8080/api/upload \
  -F "file=@multiple_questions.jpg" \
  -H "Content-Type: multipart/form-data"
```

响应示例：
```json
{
  "success": true,
  "questions": [
    {
      "id": 1,
      "text": "求解方程 x² + 2x - 3 = 0",
      "bounds": {
        "top": 0.0,
        "left": 0.0,
        "width": 1.0,
        "height": 0.5
      },
      "confidence": 0.95,
      "isDifficult": false
    },
    {
      "id": 2,
      "text": "证明：对于任意实数a, b，有 (a+b)² ≥ 4ab",
      "bounds": {
        "top": 0.5,
        "left": 0.0,
        "width": 1.0,
        "height": 0.5
      },
      "confidence": 0.92,
      "isDifficult": true
    }
  ],
  "overallConfidence": 0.935,
  "error": null
}
```

## 功能特性

### 1. 智能回退机制

系统采用智能回退策略：
1. 优先使用视觉推理模型
2. 如果视觉推理失败，自动回退到传统OCR
3. 确保服务的高可用性

### 2. 思考过程展示

启用思考模式时，模型会提供详细的推理过程：

```json
{
  "success": true,
  "content": "这是一道二次方程求解题...",
  "reasoningContent": "首先我需要识别这是一个二次方程。方程为 x² + 2x - 3 = 0。使用求根公式...",
  "confidence": 0.95
}
```

### 3. 多学科支持

视觉推理模型能够自动识别和处理：
- 数学：方程、函数、几何图形
- 物理：公式、图表、实验数据
- 化学：分子式、反应方程式
- 语文：古诗词、文言文
- 英语：阅读理解、语法题

### 4. 复杂格式支持

- 数学公式：支持分数、根号、积分等复杂符号
- 表格数据：自动识别表格结构
- 图表信息：理解图表内容和数据关系
- 多列布局：正确处理复杂版面

## 性能优化建议

### 1. 图片质量

- 分辨率：建议1080p以上
- 格式：支持JPG、PNG、WebP等
- 清晰度：确保文字清晰可读
- 光线：避免反光和阴影

### 2. 参数调优

```yaml
# 高准确率配置（推荐）
temperature: 0.1
thinking-budget: 81920
enable-thinking: true

# 快速响应配置
temperature: 0.3
thinking-budget: 40960
enable-thinking: false
```

### 3. 成本控制

- 使用 `qwen3-vl-flash` 模型降低成本
- 适当调整 `thinking-budget` 控制思考长度
- 对简单图片可关闭思考模式

## 故障排除

### 1. 常见错误

#### API Key未配置
```
错误：API未配置
解决：设置 DASHSCOPE_API_KEY 环境变量
```

#### 模型调用失败
```
错误：API调用失败，状态码：400
解决：检查API Key是否正确，模型名称是否支持
```

#### 图片格式不支持
```
错误：不支持的文件类型
解决：使用JPG、PNG等标准图片格式
```

### 2. 性能问题

#### 响应时间过长
- 减少 `thinking-budget` 参数
- 使用 `qwen3-vl-flash` 模型
- 关闭思考模式

#### 识别准确率低
- 提高图片质量和分辨率
- 启用思考模式
- 使用更高级的模型

## 开发集成

### 1. 服务注入

```java
@Service
public class YourService {
    
    @Autowired
    private VisionReasoningService visionReasoningService;
    
    @Autowired
    private OCRService ocrService; // 已集成视觉推理
    
    public void processImage(MultipartFile file) {
        // 直接使用OCRService，会自动选择最佳识别方式
        OCRResult result = ocrService.recognizeText(file);
        
        // 或直接使用视觉推理服务
        VisionResult visionResult = visionReasoningService.recognizeText(file);
    }
}
```

### 2. 自定义配置

```java
@Component
public class VisionConfig {
    
    @Value("${aliyun.dashscope.vision.model}")
    private String model;
    
    @PostConstruct
    public void init() {
        log.info("使用视觉推理模型：{}", model);
    }
}
```

## 最佳实践

1. **生产环境**：使用 `qwen3-vl-plus` 模型，启用思考模式
2. **开发测试**：使用 `qwen3-vl-flash` 模型，关闭思考模式
3. **成本敏感**：设置合理的 `thinking-budget` 和 `max-tokens`
4. **高可用性**：保持传统OCR作为备用方案
5. **监控告警**：监控API调用成功率和响应时间

## 更新日志

### v1.0.0 (当前版本)
- ✅ 集成阿里云百炼视觉推理模型
- ✅ 支持智能题目分割和学科分类
- ✅ 提供思考过程展示
- ✅ 实现智能回退机制
- ✅ 兼容原有OCR接口

### 计划功能
- 🔄 支持批量图片处理
- 🔄 添加视觉推理结果缓存
- 🔄 提供更多模型选择
- 🔄 支持自定义提示词模板
