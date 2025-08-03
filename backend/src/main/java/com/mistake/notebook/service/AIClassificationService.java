package com.mistake.notebook.service;

import com.mistake.notebook.entity.Question;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Pattern;

/**
 * AI分类服务
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AIClassificationService {

    @Value("${aliyun.dashscope.api-key}")
    private String apiKey;
    
    @Value("${aliyun.dashscope.base-url}")
    private String baseUrl;
    
    @Value("${aliyun.dashscope.model}")
    private String model;
    
    @Value("${aliyun.dashscope.application-id}")
    private String applicationId;

    private final Random random = new Random();

    /**
     * 对题目进行智能分类
     */
    public ClassificationResult classifyQuestion(String questionText) {
        try {
            if (questionText == null || questionText.trim().isEmpty()) {
                return new ClassificationResult(false, "未分类", null, null, 0.0, "题目内容为空");
            }

            log.info("开始AI分类，题目内容：{}", questionText.substring(0, Math.min(50, questionText.length())));

            // 这里预留了真实的阿里云通义千问API调用
            // 目前使用基于关键词的智能分类算法
            return performSmartClassification(questionText);

            /*
            // 真实的通义千问API调用代码
            Generation gen = new Generation();
            MessageManager msgManager = new MessageManager(10);
            
            String prompt = buildClassificationPrompt(questionText);
            Message userMsg = Message.builder().role(Role.USER.getValue()).content(prompt).build();
            msgManager.add(userMsg);
            
            GenerationParam param = GenerationParam.builder()
                .model("qwen-turbo")
                .messages(msgManager.get())
                .resultFormat(GenerationParam.ResultFormat.MESSAGE)
                .build();
                
            GenerationResult result = gen.call(param);
            String response = result.getOutput().getChoices().get(0).getMessage().getContent();
            
            return parseClassificationResponse(response);
            */

        } catch (Exception e) {
            log.error("AI分类失败", e);
            return new ClassificationResult(false, "未分类", null, null, 0.0, "分类过程中发生错误：" + e.getMessage());
        }
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
                if (text.contains("方程")) tags.add("方程");
                if (text.contains("函数")) tags.add("函数");
                if (text.contains("几何")) tags.add("几何");
                if (text.contains("不等式")) tags.add("不等式");
                if (text.contains("概率")) tags.add("概率");
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