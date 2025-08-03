package com.mistake.notebook.controller;

import com.mistake.notebook.dto.ApiResponse;
import com.mistake.notebook.dto.CreateQuestionRequest;
import com.mistake.notebook.dto.QuestionDTO;
import com.mistake.notebook.service.AIClassificationService;
import com.mistake.notebook.service.OCRService;
import com.mistake.notebook.service.QuestionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 文件上传控制器
 */
@RestController
@RequestMapping("/upload")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = {"http://localhost:3060", "http://127.0.0.1:3060"})
public class UploadController {

    private final OCRService ocrService;
    private final AIClassificationService aiClassificationService;
    private final QuestionService questionService;

    @Value("${file.upload.path}")
    private String uploadPath;

    /**
     * 上传图片并进行OCR识别和AI分类
     */
    @PostMapping("/question")
    public ResponseEntity<ApiResponse<QuestionDTO>> uploadQuestionImage(
            @RequestParam("file") MultipartFile file) {
        try {
            log.info("接收到文件上传请求，文件名：{}，大小：{} bytes", 
                     file.getOriginalFilename(), file.getSize());

            // 1. 保存文件
            String imageUrl = saveFile(file);
            if (imageUrl == null) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(ApiResponse.error("文件保存失败"));
            }

            // 2. OCR识别
            OCRService.OCRResult ocrResult = ocrService.recognizeText(file);
            if (!ocrResult.isSuccess()) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(ApiResponse.error("图片识别失败：" + ocrResult.getError()));
            }

            // 3. AI分类
            AIClassificationService.ClassificationResult classificationResult = 
                    aiClassificationService.classifyQuestion(ocrResult.getText());
            
            if (!classificationResult.isSuccess()) {
                log.warn("AI分类失败，使用默认分类");
            }

            // 4. 创建题目
            CreateQuestionRequest request = new CreateQuestionRequest();
            request.setContent(ocrResult.getText());
            request.setImageUrl(imageUrl);
            request.setCategory(classificationResult.isSuccess() ? 
                    classificationResult.getCategory() : "语文");
            request.setDifficulty(classificationResult.isSuccess() && 
                    classificationResult.getDifficulty() != null ? 
                    classificationResult.getDifficulty().name().toLowerCase() : "medium");
            request.setTags(classificationResult.isSuccess() ? 
                    classificationResult.getTags() : null);
            request.setOcrConfidence(ocrResult.getConfidence());
            request.setAiConfidence(classificationResult.isSuccess() ? 
                    classificationResult.getConfidence() : null);

            QuestionDTO question = questionService.createQuestion(request);

            log.info("题目创建成功，ID：{}，分类：{}", question.getId(), question.getCategory());
            return ResponseEntity.ok(ApiResponse.success("题目创建成功", question));

        } catch (Exception e) {
            log.error("处理上传文件失败", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("处理失败：" + e.getMessage()));
        }
    }

    /**
     * 单独上传文件（不进行处理）
     */
    @PostMapping("/file")
    public ResponseEntity<ApiResponse<Map<String, String>>> uploadFile(
            @RequestParam("file") MultipartFile file) {
        try {
            String fileUrl = saveFile(file);
            if (fileUrl == null) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(ApiResponse.error("文件保存失败"));
            }

            Map<String, String> result = new HashMap<>();
            result.put("url", fileUrl);
            result.put("filename", file.getOriginalFilename());

            return ResponseEntity.ok(ApiResponse.success("文件上传成功", result));
        } catch (Exception e) {
            log.error("文件上传失败", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("上传失败：" + e.getMessage()));
        }
    }

    /**
     * 仅进行OCR识别（不保存题目）
     */
    @PostMapping("/ocr")
    public ResponseEntity<ApiResponse<Map<String, Object>>> performOCR(
            @RequestParam("file") MultipartFile file) {
        try {
            OCRService.OCRResult ocrResult = ocrService.recognizeText(file);
            
            Map<String, Object> result = new HashMap<>();
            result.put("success", ocrResult.isSuccess());
            result.put("text", ocrResult.getText());
            result.put("confidence", ocrResult.getConfidence());
            
            if (!ocrResult.isSuccess()) {
                result.put("error", ocrResult.getError());
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(ApiResponse.<Map<String, Object>>error("识别失败"));
            }

            return ResponseEntity.ok(ApiResponse.success("识别成功", result));
        } catch (Exception e) {
            log.error("OCR识别失败", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("识别失败：" + e.getMessage()));
        }
    }

    /**
     * 仅进行AI分类（不保存题目）
     */
    @PostMapping("/classify")
    public ResponseEntity<ApiResponse<Map<String, Object>>> performClassification(
            @RequestBody Map<String, String> request) {
        try {
            String text = request.get("text");
            if (text == null || text.trim().isEmpty()) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(ApiResponse.error("文本内容不能为空"));
            }

            AIClassificationService.ClassificationResult classificationResult = 
                    aiClassificationService.classifyQuestion(text);

            Map<String, Object> result = new HashMap<>();
            result.put("success", classificationResult.isSuccess());
            result.put("category", classificationResult.getCategory());
            result.put("tags", classificationResult.getTags());
            result.put("difficulty", classificationResult.getDifficulty() != null ? 
                    classificationResult.getDifficulty().name().toLowerCase() : null);
            result.put("confidence", classificationResult.getConfidence());

            if (!classificationResult.isSuccess()) {
                result.put("error", classificationResult.getError());
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(ApiResponse.<Map<String, Object>>error("分类失败"));
            }

            return ResponseEntity.ok(ApiResponse.success("分类成功", result));
        } catch (Exception e) {
            log.error("AI分类失败", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("分类失败：" + e.getMessage()));
        }
    }

    /**
     * 题目分割识别（识别并分割多个题目）
     */
    @PostMapping("/question-segment")
    public ResponseEntity<ApiResponse<Map<String, Object>>> performQuestionSegmentation(
            @RequestParam("file") MultipartFile file) {
        try {
            log.info("接收到题目分割识别请求，文件名：{}，大小：{} bytes", 
                     file.getOriginalFilename(), file.getSize());

            // 1. 保存文件
            String imageUrl = saveFile(file);
            if (imageUrl == null) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(ApiResponse.error("文件保存失败"));
            }

            // 2. 题目分割识别
            OCRService.QuestionSegmentResult segmentResult = ocrService.recognizeAndSegmentQuestions(file);
            if (!segmentResult.isSuccess()) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(ApiResponse.error("题目分割识别失败：" + segmentResult.getError()));
            }

            // 3. 构建返回结果
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("imageUrl", imageUrl);
            result.put("questionsCount", segmentResult.getQuestions().size());
            result.put("overallConfidence", segmentResult.getOverallConfidence());
            result.put("questions", segmentResult.getQuestions());

            log.info("题目分割识别成功，识别到{}道题目", segmentResult.getQuestions().size());
            return ResponseEntity.ok(ApiResponse.success("题目分割识别成功", result));

        } catch (Exception e) {
            log.error("题目分割识别失败", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("识别失败：" + e.getMessage()));
        }
    }

    /**
     * 批量保存选中的题目
     */
    @PostMapping("/save-questions")
    public ResponseEntity<ApiResponse<Map<String, Object>>> saveSelectedQuestions(
            @RequestBody Map<String, Object> request) {
        try {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> selectedQuestions = (List<Map<String, Object>>) request.get("questions");
            String category = (String) request.get("category");
            String difficulty = (String) request.get("difficulty");
            String imageUrl = (String) request.get("imageUrl");
            
            log.info("接收到批量保存题目请求，题目数量：{}", selectedQuestions.size());
            log.info("分类：{}，难度：{}，图片URL：{}", category, difficulty, imageUrl);
            
            List<QuestionDTO> savedQuestions = new ArrayList<>();
            
            for (Map<String, Object> questionData : selectedQuestions) {
                CreateQuestionRequest createRequest = new CreateQuestionRequest();
                
                // 设置题目内容
                String content = (String) questionData.get("text");
                if (content == null || content.trim().isEmpty()) {
                    log.warn("题目内容为空，跳过该题目");
                    continue;
                }
                createRequest.setContent(content);
                
                // 设置图片URL（处理过长的URL）
                String processedImageUrl = processImageUrl(imageUrl);
                createRequest.setImageUrl(processedImageUrl);
                
                // 设置分类
                createRequest.setCategory(convertCategoryToEnglish(category));
                
                // 设置难度（使用全局难度设置）
                createRequest.setDifficulty(convertDifficultyToEnglish(difficulty));
                
                // 设置OCR置信度
                Object confidenceObj = questionData.get("confidence");
                if (confidenceObj instanceof Number) {
                    createRequest.setOcrConfidence(((Number) confidenceObj).doubleValue());
                } else {
                    createRequest.setOcrConfidence(0.85); // 默认置信度
                }
                
                // 调用AI分类服务进行智能分析
                log.info("开始AI分类分析题目: {}", content.substring(0, Math.min(50, content.length())));
                try {
                    AIClassificationService.ClassificationResult aiResult = aiClassificationService.classifyQuestion(content);
                    
                    if (aiResult.isSuccess()) {
                        // 使用AI分析的结果覆盖分类和难度
                        createRequest.setCategory(convertCategoryToEnglish(aiResult.getCategory()));
                        createRequest.setDifficulty(aiResult.getDifficulty().name());
                        createRequest.setTags(aiResult.getTags()); // 直接使用标签列表
                        createRequest.setAiConfidence(aiResult.getConfidence());
                        
                        log.info("AI分类完成 - 分类: {}, 难度: {}, 标签: {}, 置信度: {}", 
                                aiResult.getCategory(), 
                                aiResult.getDifficulty().name(), 
                                aiResult.getTags(), 
                                aiResult.getConfidence());
                    } else {
                        // AI分类失败，使用默认值
                        log.warn("AI分类失败，使用默认设置");
                        createRequest.setAiConfidence(0.5);
                        createRequest.setTags(null); // 空标签
                    }
                } catch (Exception aiException) {
                    log.error("AI分类服务异常，使用默认设置", aiException);
                    createRequest.setAiConfidence(0.5);
                    createRequest.setTags(null); // 空标签
                }
                
                log.info("准备保存题目: {}", content.substring(0, Math.min(50, content.length())));
                
                try {
                    QuestionDTO savedQuestion = questionService.createQuestion(createRequest);
                    savedQuestions.add(savedQuestion);
                    log.info("成功保存题目 ID: {}", savedQuestion.getId());
                } catch (Exception e) {
                    log.error("保存单个题目失败: {}", content.substring(0, Math.min(30, content.length())), e);
                    throw e; // 重新抛出异常，让外层处理
                }
            }
            
            Map<String, Object> result = new HashMap<>();
            result.put("savedCount", savedQuestions.size());
            result.put("questions", savedQuestions);
            
            log.info("批量保存题目完成，成功保存{}道题目", savedQuestions.size());
            return ResponseEntity.ok(ApiResponse.success("题目保存成功", result));
            
        } catch (Exception e) {
            log.error("批量保存题目失败，错误详情：", e);
            String errorMessage = "保存失败：" + e.getMessage();
            if (e.getCause() != null) {
                errorMessage += " (原因: " + e.getCause().getMessage() + ")";
            }
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error(errorMessage));
        }
    }

    /**
     * 将中文难度转换为英文枚举值
     */
    private String convertDifficultyToEnglish(String chineseDifficulty) {
        if (chineseDifficulty == null) return "medium";
        
        switch (chineseDifficulty) {
            case "简单":
                return "easy";
            case "困难":
                return "hard";
            case "中等":
            default:
                return "medium";
        }
    }

    /**
     * 将中文分类转换为英文（如果需要的话）
     */
    private String convertCategoryToEnglish(String chineseCategory) {
        if (chineseCategory == null) return "数学";
        
        // 目前保持中文分类，因为数据库支持中文
        // 如果需要英文分类，可以在这里添加转换逻辑
        switch (chineseCategory) {
            case "数学":
                return "数学";
            case "语文":
                return "语文";
            case "英语":
                return "英语";
            case "物理":
                return "物理";
            case "化学":
                return "化学";
            case "生物":
                return "生物";
            case "历史":
                return "历史";
            case "地理":
                return "地理";
            default:
                return chineseCategory;
        }
    }

    /**
     * 保存文件到本地
     */
    private String saveFile(MultipartFile file) {
        try {
            // 创建上传目录
            Path uploadDir = Paths.get(uploadPath);
            if (!Files.exists(uploadDir)) {
                Files.createDirectories(uploadDir);
            }

            // 生成唯一文件名
            String originalFilename = file.getOriginalFilename();
            String extension = "";
            if (originalFilename != null && originalFilename.contains(".")) {
                extension = originalFilename.substring(originalFilename.lastIndexOf("."));
            }
            
            String filename = UUID.randomUUID().toString() + extension;
            Path filePath = uploadDir.resolve(filename);

            // 保存文件
            Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);

            // 返回访问URL（这里简化处理，实际应该配置静态资源访问）
            String fileUrl = "/uploads/" + filename;
            log.info("文件保存成功：{}", fileUrl);
            
            return fileUrl;
        } catch (IOException e) {
            log.error("保存文件失败", e);
            return null;
        }
    }

    /**
     * 处理过长的图片URL
     */
    private String processImageUrl(String imageUrl) {
        if (imageUrl == null) {
            return null;
        }
        
        // 记录原始URL长度
        log.info("原始图片URL长度: {}", imageUrl.length());
        
        // 如果URL过长（超过1000字符），截断或使用占位符
        if (imageUrl.length() > 1000) {
            log.warn("图片URL过长 ({} 字符)，使用占位符", imageUrl.length());
            // 可以选择截断前面部分，保留文件名
            if (imageUrl.contains("/")) {
                String fileName = imageUrl.substring(imageUrl.lastIndexOf("/"));
                return "URL_TOO_LONG" + fileName;
            } else {
                return "URL_TOO_LONG_" + System.currentTimeMillis();
            }
        }
        
        return imageUrl;
    }
} 