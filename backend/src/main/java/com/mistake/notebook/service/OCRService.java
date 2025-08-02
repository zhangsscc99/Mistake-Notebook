package com.mistake.notebook.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

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
} 