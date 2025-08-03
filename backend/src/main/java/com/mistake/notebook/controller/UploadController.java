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
            
            List<QuestionDTO> savedQuestions = new ArrayList<>();
            
            for (Map<String, Object> questionData : selectedQuestions) {
                CreateQuestionRequest createRequest = new CreateQuestionRequest();
                createRequest.setContent((String) questionData.get("text"));
                createRequest.setImageUrl(imageUrl);
                createRequest.setCategory(category);
                createRequest.setDifficulty(difficulty);
                createRequest.setOcrConfidence(((Number) questionData.get("confidence")).doubleValue());
                
                QuestionDTO savedQuestion = questionService.createQuestion(createRequest);
                savedQuestions.add(savedQuestion);
            }
            
            Map<String, Object> result = new HashMap<>();
            result.put("savedCount", savedQuestions.size());
            result.put("questions", savedQuestions);
            
            log.info("批量保存题目完成，成功保存{}道题目", savedQuestions.size());
            return ResponseEntity.ok(ApiResponse.success("题目保存成功", result));
            
        } catch (Exception e) {
            log.error("批量保存题目失败", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("保存失败：" + e.getMessage()));
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
} 