package com.mistake.notebook.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

/**
 * OCR图像识别服务
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OCRService {

    @Value("${aliyun.access-key-id}")
    private String accessKeyId;

    @Value("${aliyun.access-key-secret}")
    private String accessKeySecret;

    @Value("${aliyun.ocr.endpoint}")
    private String endpoint;

    private final Random random = new Random();

    /**
     * 识别图片中的文字
     */
    public OCRResult recognizeText(MultipartFile file) {
        try {
            // 验证文件
            if (file.isEmpty()) {
                return new OCRResult(false, "", 0.0, "文件为空");
            }

            // 验证文件大小（最大10MB）
            if (file.getSize() > 10 * 1024 * 1024) {
                return new OCRResult(false, "", 0.0, "文件大小超过限制");
            }

            // 验证文件类型
            String contentType = file.getContentType();
            if (contentType == null || !isImageFile(contentType)) {
                return new OCRResult(false, "", 0.0, "不支持的文件类型");
            }

            log.info("开始OCR识别，文件名：{}，大小：{} bytes", file.getOriginalFilename(), file.getSize());

            // 这里预留了真实的阿里云OCR API调用
            // 目前返回模拟数据用于开发测试
            return performMockOCR();

            /*
            // 真实的阿里云OCR API调用代码（需要配置阿里云凭证）
            DefaultProfile profile = DefaultProfile.getProfile("cn-hangzhou", accessKeyId, accessKeySecret);
            IAcsClient client = new DefaultAcsClient(profile);
            
            RecognizeGeneralRequest request = new RecognizeGeneralRequest();
            request.setSysEndpoint(endpoint);
            request.setImageType(1); // 1表示传入图片为base64编码
            
            // 将图片转换为base64
            byte[] imageBytes = file.getBytes();
            String base64Image = Base64.getEncoder().encodeToString(imageBytes);
            request.setImageData(base64Image);
            
            RecognizeGeneralResponse response = client.getAcsResponse(request);
            
            if (response.getData() != null && response.getData().getContent() != null) {
                String recognizedText = response.getData().getContent();
                double confidence = response.getData().getConfidence() != null ? 
                    response.getData().getConfidence() : 0.9;
                
                log.info("OCR识别成功，识别文字长度：{}", recognizedText.length());
                return new OCRResult(true, recognizedText, confidence, null);
            } else {
                return new OCRResult(false, "", 0.0, "OCR识别失败");
            }
            */

        } catch (Exception e) {
            log.error("OCR识别失败", e);
            return new OCRResult(false, "", 0.0, "识别过程中发生错误：" + e.getMessage());
        }
    }

    /**
     * 识别图片中的多个题目并分割
     */
    public QuestionSegmentResult recognizeAndSegmentQuestions(MultipartFile file) {
        try {
            // 验证文件
            if (file.isEmpty()) {
                return new QuestionSegmentResult(false, null, "文件为空");
            }

            // 验证文件大小和类型
            if (file.getSize() > 10 * 1024 * 1024) {
                return new QuestionSegmentResult(false, null, "文件大小超过限制");
            }

            String contentType = file.getContentType();
            if (contentType == null || !isImageFile(contentType)) {
                return new QuestionSegmentResult(false, null, "不支持的文件类型");
            }

            log.info("开始题目分割OCR识别，文件名：{}，大小：{} bytes", file.getOriginalFilename(), file.getSize());

            // 这里预留了真实的题目分割API调用
            // 目前返回模拟数据用于开发测试
            return performMockQuestionSegmentation();

        } catch (Exception e) {
            log.error("题目分割OCR识别失败", e);
            return new QuestionSegmentResult(false, null, "识别过程中发生错误：" + e.getMessage());
        }
    }

    /**
     * 模拟题目分割识别（用于开发测试）
     */
    private QuestionSegmentResult performMockQuestionSegmentation() {
        // 模拟处理时间
        try {
            Thread.sleep(1500 + random.nextInt(2000)); // 1.5-3.5秒
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }

        // 智能题目分割：根据题目特征动态生成边界框
        List<QuestionSegment> questions = generateIntelligentQuestionSegments();

        double overallConfidence = questions.stream()
            .mapToDouble(QuestionSegment::getConfidence)
            .average()
            .orElse(0.85);

        log.info("智能题目分割完成，识别到{}道题目", questions.size());
        return new QuestionSegmentResult(true, questions, null, overallConfidence);
    }

    /**
     * 智能生成题目分割段（通用算法，基于大题标号分割）
     */
    private List<QuestionSegment> generateIntelligentQuestionSegments() {
        // 模拟OCR识别的完整文本内容
        String fullText = simulateFullOCRText();
        
        // 使用通用算法识别和分割大题
        return segmentQuestionsByNumber(fullText);
    }
    
    /**
     * 模拟OCR识别的完整文本（实际使用时这里会是真实的OCR结果）
     */
    private String simulateFullOCRText() {
        return "20. 第1小题满分4分，第2小题满分6分，第3小题满分8分。\n" +
               "已知函数f(x)=x²-2ax+1，在x=2处与P、Q点。\n" +
               "(1) 若高心等于2，求b的值；\n" +
               "(2) 若b=√6/3，P在第一象限，∠MAP是等腰三角形，求P点的坐标；\n" +
               "(3) 直接QQ开率长及效应转求x，若AR·A₁F=1，求P点的取值范围。\n" +
               "\n" +
               "21. 第1小题满分4分，第2小题满分6分，第3小题满分8分。\n" +
               "已知D是R的一个非空子集，y=f(x)定义在R上的函数。对于任意M(a,b)，函数\n" +
               "s(x)=(x-a)²+(f(x)-b)²，若对于P(x₀,f(x₀))，满足s(x)在x=x₀处取最小值，则称\n" +
               "P是关于M的f最近点。\n" +
               "(1) D=(0,+∞)，f(x)=1/x，M(0,0)，求证：在区间M的f最近点；\n" +
               "(2) D=R，f(x)=eˣ，M(1,0)，若y=f(x)上一点P满足MP平行于f'线段MP平行于f最近点；\n" +
               "(3) 已知y=f(x)是奇导的，g(x)定义在R上且函数值为正，...";
    }
    
    /**
     * 通用题目分割算法：根据大题标号（如"20.", "21."）分割题目
     */
    private List<QuestionSegment> segmentQuestionsByNumber(String fullText) {
        List<QuestionSegment> segments = new ArrayList<>();
        
        // 按行分割文本
        String[] lines = fullText.split("\n");
        List<Integer> questionStartLines = new ArrayList<>();
        List<String> questionNumbers = new ArrayList<>();
        
        // 查找所有大题标号的位置
        for (int i = 0; i < lines.length; i++) {
            String line = lines[i].trim();
            // 匹配大题标号格式：数字 + 点号开头
            if (line.matches("^\\d+\\..*")) {
                questionStartLines.add(i);
                // 提取题号
                String questionNum = line.replaceAll("^(\\d+)\\..*", "$1");
                questionNumbers.add(questionNum);
            }
        }
        
        // 为每个大题生成分割段
        for (int i = 0; i < questionStartLines.size(); i++) {
            int startLine = questionStartLines.get(i);
            int endLine = (i + 1 < questionStartLines.size()) ? 
                         questionStartLines.get(i + 1) - 1 : lines.length - 1;
            
            // 组合题目完整内容
            StringBuilder questionContent = new StringBuilder();
            for (int lineIdx = startLine; lineIdx <= endLine; lineIdx++) {
                if (lineIdx < lines.length && !lines[lineIdx].trim().isEmpty()) {
                    if (questionContent.length() > 0) {
                        questionContent.append(" ");
                    }
                    questionContent.append(lines[lineIdx].trim());
                }
            }
            
            String content = questionContent.toString();
            if (content.length() > 150) {
                content = content.substring(0, 147) + "..."; // 截断过长内容
            }
            
            // 计算该题目在图片中的位置（基于行数估算）
            double positionY = calculatePositionFromLineNumber(startLine, lines.length);
            double height = calculateHeightFromContent(content, endLine - startLine + 1);
            
            // 创建边界框
            QuestionBounds bounds = new QuestionBounds(positionY, 3, 94, height);
            
            // 计算置信度和难度
            double confidence = calculateConfidenceByComplexity(content);
            boolean isDifficult = assessQuestionDifficulty(content);
            
            segments.add(new QuestionSegment(
                Integer.parseInt(questionNumbers.get(i)), 
                content, 
                bounds, 
                confidence, 
                isDifficult
            ));
        }
        
        return segments;
    }
    
    /**
     * 根据行号计算在图片中的Y坐标位置（百分比）
     */
    private double calculatePositionFromLineNumber(int lineNumber, int totalLines) {
        // 假设文本从图片5%位置开始，到95%位置结束
        double startPercent = 5.0;
        double endPercent = 95.0;
        double range = endPercent - startPercent;
        
        return startPercent + (range * lineNumber / totalLines);
    }
    
    /**
     * 根据内容和行数计算题目高度
     */
    private double calculateHeightFromContent(String content, int lineCount) {
        // 基础高度：每行约占3-4%的图片高度
        double baseHeight = lineCount * 3.5;
        
        // 根据内容复杂度调整
        if (content.contains("函数") || content.contains("方程")) {
            baseHeight += 2; // 数学内容需要更多空间
        }
        
        // 限制最小和最大高度
        return Math.max(8, Math.min(25, baseHeight));
    }
    
    /**
     * 评估题目难度
     */
    private boolean assessQuestionDifficulty(String content) {
        // 根据关键词判断难度
        String[] difficultKeywords = {"函数", "证明", "求证", "区间", "最值", "导数", "积分"};
        String[] complexSymbols = {"²", "³", "∞", "∑", "∫", "∂"};
        
        for (String keyword : difficultKeywords) {
            if (content.contains(keyword)) return true;
        }
        
        for (String symbol : complexSymbols) {
            if (content.contains(symbol)) return true;
        }
        
        // 题目长度也是难度指标
        return content.length() > 80;
    }
    

    
    /**
     * 根据题目复杂度计算置信度
     */
    private double calculateConfidenceByComplexity(String text) {
        double baseConfidence = 0.85;
        
        // 题目越长，OCR识别可能越不准确
        if (text.length() > 100) {
            baseConfidence -= 0.1;
        } else if (text.length() > 60) {
            baseConfidence -= 0.05;
        }
        
        // 包含数学符号降低置信度
        if (text.contains("∞") || text.contains("²") || text.contains("₁") || text.contains("₂")) {
            baseConfidence -= 0.03;
        }
        
        // 包含括号和公式
        if (text.contains("f(x)") || text.contains("g(x)")) {
            baseConfidence -= 0.02;
        }
        
        // 确保置信度在合理范围内
        return Math.max(0.70, Math.min(0.95, baseConfidence + random.nextGaussian() * 0.02));
    }

    /**
     * 模拟OCR识别（用于开发测试）
     */
    private OCRResult performMockOCR() {
        // 模拟处理时间
        try {
            Thread.sleep(1000 + random.nextInt(2000)); // 1-3秒
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }

        // 模拟识别结果
        String[] mockResults = {
                "求解方程：2x + 3 = 7，求x的值。",
                "计算函数f(x) = x² + 2x - 3在x=2处的值。",
                "解不等式：3x - 5 > 2x + 1",
                "英语阅读理解：What is the main idea of the passage? A) The importance of education B) The benefits of technology C) The impact of climate change D) The role of government",
                "化学反应：2H₂ + O₂ → 2H₂O，计算当有4mol H₂参与反应时，生成水的质量。",
                "古诗文理解：请分析杜甫《春望》中\"感时花溅泪，恨别鸟惊心\"一句的表达效果。",
                "物理实验：在\"测定金属丝电阻率\"的实验中，需要测量哪些物理量？",
                "数学证明：证明：若a > 0, b > 0，则 (a + b)/2 ≥ √(ab)",
                "地理问题：分析我国东南沿海地区发展外向型经济的有利条件。",
                "历史材料题：根据材料分析明朝海禁政策对我国经济发展的影响。"
        };

        String recognizedText = mockResults[random.nextInt(mockResults.length)];
        double confidence = 0.85 + random.nextDouble() * 0.1; // 0.85-0.95之间

        log.info("模拟OCR识别完成，文字：{}", recognizedText.substring(0, Math.min(30, recognizedText.length())));
        return new OCRResult(true, recognizedText, confidence, null);
    }

    /**
     * 验证是否为图片文件
     */
    private boolean isImageFile(String contentType) {
        return contentType.startsWith("image/") && 
               (contentType.contains("jpeg") || 
                contentType.contains("jpg") || 
                contentType.contains("png") || 
                contentType.contains("gif") || 
                contentType.contains("bmp"));
    }

    /**
     * OCR识别结果
     */
    public static class OCRResult {
        private final boolean success;
        private final String text;
        private final double confidence;
        private final String error;

        public OCRResult(boolean success, String text, double confidence, String error) {
            this.success = success;
            this.text = text;
            this.confidence = confidence;
            this.error = error;
        }

        public boolean isSuccess() { return success; }
        public String getText() { return text; }
        public double getConfidence() { return confidence; }
        public String getError() { return error; }
    }

    /**
     * 题目分割识别结果
     */
    public static class QuestionSegmentResult {
        private final boolean success;
        private final List<QuestionSegment> questions;
        private final String error;
        private final double overallConfidence;

        public QuestionSegmentResult(boolean success, List<QuestionSegment> questions, String error) {
            this.success = success;
            this.questions = questions;
            this.error = error;
            this.overallConfidence = 0.0;
        }

        public QuestionSegmentResult(boolean success, List<QuestionSegment> questions, String error, double overallConfidence) {
            this.success = success;
            this.questions = questions;
            this.error = error;
            this.overallConfidence = overallConfidence;
        }

        public boolean isSuccess() { return success; }
        public List<QuestionSegment> getQuestions() { return questions; }
        public String getError() { return error; }
        public double getOverallConfidence() { return overallConfidence; }
    }

    /**
     * 单个题目分割信息
     */
    public static class QuestionSegment {
        private final int id;
        private final String text;
        private final QuestionBounds bounds;
        private final double confidence;
        private final boolean isDifficult; // 是否为疑难题目

        public QuestionSegment(int id, String text, QuestionBounds bounds, double confidence, boolean isDifficult) {
            this.id = id;
            this.text = text;
            this.bounds = bounds;
            this.confidence = confidence;
            this.isDifficult = isDifficult;
        }

        public int getId() { return id; }
        public String getText() { return text; }
        public QuestionBounds getBounds() { return bounds; }
        public double getConfidence() { return confidence; }
        public boolean isDifficult() { return isDifficult; }
    }

    /**
     * 题目边界信息（百分比坐标）
     */
    public static class QuestionBounds {
        private final double top;    // 顶部位置（百分比）
        private final double left;   // 左侧位置（百分比）
        private final double width;  // 宽度（百分比）
        private final double height; // 高度（百分比）

        public QuestionBounds(double top, double left, double width, double height) {
            this.top = top;
            this.left = left;
            this.width = width;
            this.height = height;
        }

        public double getTop() { return top; }
        public double getLeft() { return left; }
        public double getWidth() { return width; }
        public double getHeight() { return height; }
    }
} 