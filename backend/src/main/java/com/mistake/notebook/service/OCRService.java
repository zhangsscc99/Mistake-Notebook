package com.mistake.notebook.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

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

        // 模拟识别出的多个题目
        List<QuestionSegment> questions = List.of(
            new QuestionSegment(1, "1. (1+5i)的绝对值", 
                new QuestionBounds(15, 10, 80, 12), 0.92, false),
            new QuestionSegment(2, "2. 设集合U={1,2,3,4,5,6,7,8}，集合A={1,3,5,7}，B(A)表示A在全集U中的补集", 
                new QuestionBounds(30, 10, 80, 12), 0.88, true),
            new QuestionSegment(3, "3. 若直线l经过点P(1,2)且倾斜角为π/3，则直线l的方程为", 
                new QuestionBounds(45, 10, 80, 12), 0.90, false),
            new QuestionSegment(4, "4. 若点(a,b)(a>0)是圆M上一点，且到直线y=2tan(x-π/4)的距离为max，M的圆心的横坐标是", 
                new QuestionBounds(60, 10, 80, 15), 0.85, false),
            new QuestionSegment(5, "5. 设f(x)是定义在R上的函数，若对于任意x≤3时，f(x)=x-21，M=max{f(x)|x∈R}", 
                new QuestionBounds(78, 10, 80, 15), 0.87, true),
            new QuestionSegment(6, "6. 假设扔掷，运动总量的信息只需满足以下大小的的，是对信息风险的风力", 
                new QuestionBounds(95, 10, 80, 25), 0.75, false)
        );

        double overallConfidence = questions.stream()
            .mapToDouble(QuestionSegment::getConfidence)
            .average()
            .orElse(0.85);

        log.info("模拟题目分割完成，识别到{}道题目", questions.size());
        return new QuestionSegmentResult(true, questions, null, overallConfidence);
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