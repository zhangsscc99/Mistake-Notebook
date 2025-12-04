package com.mistake.notebook.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mistake.notebook.config.AIConfig;
import com.mistake.notebook.config.SimpleOpenAIClient;
import com.mistake.notebook.entity.Question;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import okhttp3.Response;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * AI分类服务
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AIClassificationService {

    private static final String CLASSIFICATION_PROMPT = """
            你是教育场景的题目分类助手。阅读用户提供的题目文字，严格输出 JSON：
            {
              "category": "数学|语文|英语|物理|化学|生物|历史|地理|政治|计算机/编程|综合",
              "tags": ["知识点1","知识点2"],
              "difficulty": "EASY|MEDIUM|HARD",
              "confidence": 0.0-1.0,
              "reasoning": "简短说明分类原因"
            }
            只返回 JSON，不要额外描述。
            """;

    private final SimpleOpenAIClient openAIClient;
    private final AIConfig aiConfig;
    private final ObjectMapper objectMapper;
    private final Random random = new Random();

    /**
     * 对题目进行智能分类
     */
    public ClassificationResult classifyQuestion(String questionText) {
        if (questionText == null || questionText.trim().isEmpty()) {
            return new ClassificationResult(false, "未分类", null, null, 0.0, "题目内容为空");
        }

        log.info("开始调用大模型分类...");
        ClassificationResult llmResult = classifyWithLLM(questionText);
        if (llmResult != null) {
            return llmResult;
        }

        log.warn("大模型分类失败，使用本地关键词算法兜底");
        return performSmartClassification(questionText);
    }

    private ClassificationResult classifyWithLLM(String questionText) {
        try {
            log.info("LLM分类请求配置 -> model: {}, baseUrl: {}, apiKeyPrefix: {}",
                    aiConfig.getModel(),
                    aiConfig.getBaseUrl(),
                    aiConfig.getApiKey() != null && aiConfig.getApiKey().length() > 8
                            ? aiConfig.getApiKey().substring(0, 8) + "****"
                            : "null");

            Map<String, Object> requestData = new HashMap<>();
            requestData.put("model", aiConfig.getModel());
            requestData.put("temperature", 0.2);
            requestData.put("max_tokens", 600);
            requestData.put("stream", false);
            requestData.put("response_format", Map.of("type", "json_object"));

            List<Map<String, String>> messages = new ArrayList<>();
            messages.add(Map.of("role", "system", "content", CLASSIFICATION_PROMPT));
            messages.add(Map.of("role", "user", "content", "题目如下：\n" + questionText));
            requestData.put("messages", messages);

            try (Response response = openAIClient.createChatCompletion(requestData)) {
                String responseBody = response.body() != null ? response.body().string() : "";

                if (!response.isSuccessful()) {
                    log.error("分类LLM调用失败，状态码 {}，响应体：{}", response.code(), responseBody);
                    return null;
                }

                log.debug("分类LLM响应：{}", responseBody);
                JsonNode root = objectMapper.readTree(responseBody);
                JsonNode choices = root.path("choices");
                if (!choices.isArray() || choices.isEmpty()) {
                    log.warn("分类LLM返回无choices");
                    return null;
                }

                JsonNode messageNode = choices.get(0).path("message");
                String content = messageNode.path("content").asText();
                if (content == null || content.trim().isEmpty()) {
                    log.warn("分类LLM返回空内容");
                    return null;
                }

                JsonNode resultJson = objectMapper.readTree(content);
                String category = normalizeCategory(resultJson.path("category").asText("综合"));
                Question.DifficultyLevel difficulty = parseDifficulty(resultJson.path("difficulty").asText("MEDIUM"));
                double confidence = clampConfidence(resultJson.path("confidence").asDouble(0.9));

                List<String> tags = new ArrayList<>();
                JsonNode tagsNode = resultJson.path("tags");
                if (tagsNode.isArray()) {
                    tagsNode.forEach(node -> tags.add(node.asText()));
                }

                log.info("LLM分类成功，类别：{}，难度：{}，置信度：{}", category, difficulty, confidence);
                return new ClassificationResult(true, category, tags, difficulty, confidence, null);
            }
        } catch (Exception e) {
            log.error("调用LLM分类失败", e);
            return null;
        }
    }

    private String normalizeCategory(String rawCategory) {
        if (rawCategory == null || rawCategory.isBlank()) {
            return "综合";
        }
        String target = rawCategory.toLowerCase(Locale.ROOT);
        if (target.contains("数") || target.contains("math")) return "数学";
        if (target.contains("语文") || target.contains("chinese")) return "语文";
        if (target.contains("英") || target.contains("english")) return "英语";
        if (target.contains("物") || target.contains("physics")) return "物理";
        if (target.contains("化") || target.contains("chem")) return "化学";
        if (target.contains("生") || target.contains("bio")) return "生物";
        if (target.contains("地")) return "地理";
        if (target.contains("政") || target.contains("polit")) return "政治";
        if (target.contains("历")) return "历史";
        if (target.contains("计算") || target.contains("编程") || target.contains("computer") || target.contains("program")) {
            return "计算机/编程";
        }
        return rawCategory;
    }

    private Question.DifficultyLevel parseDifficulty(String value) {
        if (value == null) {
            return Question.DifficultyLevel.MEDIUM;
        }
        switch (value.trim().toUpperCase(Locale.ROOT)) {
            case "EASY":
                return Question.DifficultyLevel.EASY;
            case "HARD":
                return Question.DifficultyLevel.HARD;
            default:
                return Question.DifficultyLevel.MEDIUM;
        }
    }

    private double clampConfidence(double value) {
        if (Double.isNaN(value)) {
            return 0.9;
        }
        return Math.min(0.99, Math.max(0.5, value));
    }

    /**
     * 基于关键词的智能分类算法
     */
    private ClassificationResult performSmartClassification(String text) {
        // 模拟处理时间
        try {
            Thread.sleep(500 + random.nextInt(1000)); // 0.5-1.5秒
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }

        String lowerText = text.toLowerCase();
        
        // 分类权重计算
        Map<String, Integer> categoryScores = new HashMap<>();
        categoryScores.put("数学", calculateMathScore(text, lowerText));
        categoryScores.put("语文", calculateChineseScore(text, lowerText));
        categoryScores.put("英语", calculateEnglishScore(text, lowerText));
        categoryScores.put("物理", calculatePhysicsScore(text, lowerText));
        categoryScores.put("化学", calculateChemistryScore(text, lowerText));

        // 找出得分最高的分类
        String bestCategory = categoryScores.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse("语文");

        int maxScore = categoryScores.get(bestCategory);
        if (maxScore == 0) {
            bestCategory = "语文"; // 默认分类
        }

        // 计算难度
        Question.DifficultyLevel difficulty = calculateDifficulty(text);

        // 提取标签
        List<String> tags = extractTags(text, bestCategory);

        // 计算置信度
        double confidence = calculateConfidence(maxScore, categoryScores);

        log.info("AI分类完成，分类：{}，难度：{}，置信度：{}", bestCategory, difficulty, confidence);
        
        return new ClassificationResult(true, bestCategory, tags, difficulty, confidence, null);
    }

    /**
     * 计算数学分类得分
     */
    private int calculateMathScore(String text, String lowerText) {
        int score = 0;
        
        // 数学关键词
        String[] mathKeywords = {
                "方程", "函数", "计算", "求解", "不等式", "几何", "代数", "微积分", 
                "导数", "积分", "极限", "概率", "统计", "三角", "向量", "矩阵"
        };
        
        for (String keyword : mathKeywords) {
            if (text.contains(keyword)) score += 2;
        }
        
        // 数学符号和模式
        if (text.matches(".*[x-z]\\s*[=<>+\\-*/].*")) score += 3; // 包含变量和运算符
        if (text.matches(".*\\d+\\s*[x-z].*")) score += 2; // 包含系数和变量
        if (text.contains("f(x)") || text.contains("f(")) score += 3; // 函数表示
        if (text.matches(".*[=<>].*")) score += 1; // 包含等号或不等号
        if (text.matches(".*[²³⁴⁵⁶⁷⁸⁹].*")) score += 2; // 包含上标
        if (text.matches(".*√.*")) score += 2; // 包含根号
        
        return score;
    }

    /**
     * 计算语文分类得分
     */
    private int calculateChineseScore(String text, String lowerText) {
        int score = 0;
        
        String[] chineseKeywords = {
                "阅读理解", "作文", "古诗", "文言文", "语法", "词语", "句子", "段落", 
                "修辞", "比喻", "拟人", "夸张", "排比", "对偶", "设问", "反问",
                "主旨", "中心思想", "表达效果", "写作手法", "情感", "意境"
        };
        
        for (String keyword : chineseKeywords) {
            if (text.contains(keyword)) score += 2;
        }
        
        // 语文特征模式
        if (text.matches(".*[\"\"''《》].*")) score += 2; // 包含中文引号或书名号
        if (text.matches(".*[，。；！？].*")) score += 1; // 包含中文标点
        if (text.contains("请分析") || text.contains("谈谈你的理解")) score += 2;
        if (text.length() > 100) score += 1; // 语文题目通常较长
        
        return score;
    }

    /**
     * 计算英语分类得分
     */
    private int calculateEnglishScore(String text, String lowerText) {
        int score = 0;
        
        String[] englishKeywords = {
                "what", "how", "where", "when", "why", "who", "which",
                "reading", "grammar", "vocabulary", "passage", "comprehension",
                "choose", "complete", "translate", "writing"
        };
        
        for (String keyword : englishKeywords) {
            if (lowerText.contains(keyword)) score += 2;
        }
        
        // 英语特征模式
        if (text.matches(".*[A-Z]\\).*[A-Z]\\).*")) score += 3; // 选择题格式
        if (text.matches(".*\\b[A-Za-z]{3,}\\b.*")) score += 1; // 包含英文单词
        if (lowerText.matches(".*\\ba\\).*b\\).*c\\).*d\\).*")) score += 3; // ABCD选项
        
        return score;
    }

    /**
     * 计算物理分类得分
     */
    private int calculatePhysicsScore(String text, String lowerText) {
        int score = 0;
        
        String[] physicsKeywords = {
                "力", "速度", "加速度", "电", "磁", "光", "声", "热", "能量", "功率",
                "电流", "电压", "电阻", "电场", "磁场", "波", "频率", "振动",
                "牛顿", "欧姆", "焦耳", "瓦特", "实验", "测量"
        };
        
        for (String keyword : physicsKeywords) {
            if (text.contains(keyword)) score += 2;
        }
        
        // 物理单位和符号
        if (text.matches(".*[mskgAV]\\b.*")) score += 1; // 物理单位
        if (text.contains("m/s") || text.contains("km/h")) score += 2;
        
        return score;
    }

    /**
     * 计算化学分类得分
     */
    private int calculateChemistryScore(String text, String lowerText) {
        int score = 0;
        
        String[] chemistryKeywords = {
                "反应", "元素", "化合物", "分子", "原子", "离子", "酸", "碱", "盐",
                "氧化", "还原", "催化", "平衡", "浓度", "溶液", "实验"
        };
        
        for (String keyword : chemistryKeywords) {
            if (text.contains(keyword)) score += 2;
        }
        
        // 化学分子式
        if (text.matches(".*[A-Z][a-z]?\\d*.*")) score += 2; // 可能包含化学式
        if (text.contains("H₂O") || text.contains("CO₂") || text.contains("NaCl")) score += 3;
        if (text.contains("→") || text.contains("=")) score += 1; // 化学反应箭头
        
        return score;
    }

    /**
     * 计算题目难度
     */
    private Question.DifficultyLevel calculateDifficulty(String text) {
        int difficultyScore = 0;
        
        // 困难关键词
        String[] hardKeywords = {"微积分", "导数", "积分", "复杂", "综合", "证明", "推导", "高级", "深入"};
        for (String keyword : hardKeywords) {
            if (text.contains(keyword)) difficultyScore += 2;
        }
        
        // 简单关键词
        String[] easyKeywords = {"基础", "简单", "入门", "基本", "初级"};
        for (String keyword : easyKeywords) {
            if (text.contains(keyword)) difficultyScore -= 1;
        }
        
        // 根据文本长度判断
        if (text.length() > 200) difficultyScore += 1;
        if (text.length() < 50) difficultyScore -= 1;
        
        if (difficultyScore >= 3) return Question.DifficultyLevel.HARD;
        if (difficultyScore <= -1) return Question.DifficultyLevel.EASY;
        return Question.DifficultyLevel.MEDIUM;
    }

    /**
     * 提取标签
     */
    private List<String> extractTags(String text, String category) {
        List<String> tags = new ArrayList<>();
        
        switch (category) {
            case "数学":
                // 按优先级顺序检查，具体的知识点优先于通用概念
                boolean isSpecificTopic = false;
                
                // 圆锥曲线相关 - 最高优先级
                if (text.contains("抛物线") || text.contains("椭圆") || text.contains("双曲线") || 
                    text.contains("焦点") || text.contains("顶点坐标") || text.contains("圆锥") ||
                    text.contains("准线") || text.contains("离心率") || text.contains("长轴") || 
                    text.contains("短轴") || text.contains("渐近线") || 
                    text.matches(".*x\\^?2.*y\\^?2.*") || // x²/a² + y²/b² 形式
                    text.matches(".*y\\^?2.*x.*") || // y² = 2px 形式
                    text.contains("圆心") || text.contains("半径") || text.contains("弦长")) {
                    tags.add("圆锥曲线");
                    isSpecificTopic = true;
                }
                
                // 三角函数相关
                if (!isSpecificTopic && (text.contains("sin") || text.contains("cos") || text.contains("tan") || 
                    text.contains("正弦") || text.contains("余弦") || text.contains("正切"))) {
                    tags.add("三角函数");
                    isSpecificTopic = true;
                }
                
                // 数列相关
                if (!isSpecificTopic && (text.contains("数列") || text.contains("等差") || text.contains("等比") || 
                    text.matches(".*a[_n].*") || text.matches(".*an.*"))) {
                    tags.add("数列");
                    isSpecificTopic = true;
                }
                
                // 导数相关
                if (!isSpecificTopic && (text.contains("导数") || text.contains("导函数") || text.contains("切线") || 
                    text.contains("极值") || text.contains("最值"))) {
                    tags.add("导数");
                    isSpecificTopic = true;
                }
                
                // 概率相关
                if (!isSpecificTopic && (text.contains("概率") || text.contains("随机") || text.contains("分布") || 
                    text.contains("期望") || text.contains("方差"))) {
                    tags.add("概率");
                    isSpecificTopic = true;
                }
                
                // 立体几何相关
                if (!isSpecificTopic && (text.contains("立体") || text.contains("几何体") || text.contains("体积") || 
                    text.contains("表面积") || text.contains("空间"))) {
                    tags.add("立体几何");
                    isSpecificTopic = true;
                }
                
                // 平面几何相关
                if (!isSpecificTopic && (text.contains("三角形") || text.contains("四边形") || text.contains("圆形") || 
                    text.contains("角度") || text.contains("面积"))) {
                    tags.add("平面几何");
                    isSpecificTopic = true;
                }
                
                // 方程和不等式
                if (!isSpecificTopic && text.contains("方程")) {
                    tags.add("方程");
                    isSpecificTopic = true;
                }
                if (!isSpecificTopic && text.contains("不等式")) {
                    tags.add("不等式");
                    isSpecificTopic = true;
                }
                
                // 函数相关 - 优先级较低，只有在没有更具体分类时才使用
                if (!isSpecificTopic && (text.contains("函数") || text.contains("f(x)") || text.contains("y="))) {
                    tags.add("函数");
                    isSpecificTopic = true;
                }
                
                // 如果没有匹配到任何具体标签，根据关键词添加通用标签
                if (tags.isEmpty()) {
                    if (text.contains("计算") || text.contains("求解")) tags.add("计算题");
                    else if (text.contains("证明")) tags.add("证明题");
                    else tags.add("综合题");
                }
                break;
            case "英语":
                if (text.toLowerCase().contains("reading")) tags.add("阅读理解");
                if (text.toLowerCase().contains("grammar")) tags.add("语法");
                if (text.toLowerCase().contains("vocabulary")) tags.add("词汇");
                if (text.toLowerCase().contains("writing")) tags.add("写作");
                break;
            case "物理":
                if (text.contains("力")) tags.add("力学");
                if (text.contains("电")) tags.add("电学");
                if (text.contains("光")) tags.add("光学");
                if (text.contains("热")) tags.add("热学");
                break;
            case "化学":
                if (text.contains("反应")) tags.add("化学反应");
                if (text.contains("元素")) tags.add("元素周期表");
                if (text.contains("酸") || text.contains("碱")) tags.add("酸碱反应");
                break;
            case "语文":
                if (text.contains("古诗")) tags.add("古诗词");
                if (text.contains("文言文")) tags.add("文言文");
                if (text.contains("阅读理解")) tags.add("现代文阅读");
                break;
        }
        
        return tags;
    }

    /**
     * 计算分类置信度
     */
    private double calculateConfidence(int maxScore, Map<String, Integer> allScores) {
        if (maxScore == 0) return 0.5; // 如果没有明确特征，置信度较低
        
        int totalScore = allScores.values().stream().mapToInt(Integer::intValue).sum();
        if (totalScore == 0) return 0.5;
        
        double ratio = (double) maxScore / totalScore;
        return Math.min(0.95, 0.7 + ratio * 0.25); // 置信度在0.7-0.95之间
    }

    /**
     * AI分类结果
     */
    public static class ClassificationResult {
        private final boolean success;
        private final String category;
        private final List<String> tags;
        private final Question.DifficultyLevel difficulty;
        private final double confidence;
        private final String error;

        public ClassificationResult(boolean success, String category, List<String> tags, 
                                    Question.DifficultyLevel difficulty, double confidence, String error) {
            this.success = success;
            this.category = category;
            this.tags = tags;
            this.difficulty = difficulty;
            this.confidence = confidence;
            this.error = error;
        }

        public boolean isSuccess() { return success; }
        public String getCategory() { return category; }
        public List<String> getTags() { return tags; }
        public Question.DifficultyLevel getDifficulty() { return difficulty; }
        public double getConfidence() { return confidence; }
        public String getError() { return error; }
    }
} 