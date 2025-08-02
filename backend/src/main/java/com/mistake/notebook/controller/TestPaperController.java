package com.mistake.notebook.controller;

import com.mistake.notebook.dto.ApiResponse;
import com.mistake.notebook.dto.QuestionDTO;
import com.mistake.notebook.service.PDFService;
import com.mistake.notebook.service.QuestionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

/**
 * 试卷生成控制器
 */
@RestController
@RequestMapping("/test-paper")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = {"http://localhost:3000", "http://127.0.0.1:3000"})
public class TestPaperController {

    private final PDFService pdfService;
    private final QuestionService questionService;

    /**
     * 生成试卷PDF
     */
    @PostMapping("/generate")
    public ResponseEntity<?> generateTestPaper(@RequestBody TestPaperRequest request) {
        try {
            if (request.getQuestionIds() == null || request.getQuestionIds().isEmpty()) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(ApiResponse.error("题目列表不能为空"));
            }

            // 获取题目信息
            List<QuestionDTO> questions = questionService.getQuestionsByIds(request.getQuestionIds());
            if (questions.isEmpty()) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(ApiResponse.error("未找到有效题目"));
            }

            // 生成PDF
            byte[] pdfBytes = pdfService.generateTestPaper(
                    request.getTitle(),
                    request.getDuration(),
                    request.getTotalScore(),
                    questions
            );

            // 设置响应头
            String fileName = URLEncoder.encode(
                    (request.getTitle() != null ? request.getTitle() : "试卷") + ".pdf",
                    StandardCharsets.UTF_8
            );

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_PDF);
            headers.setContentDispositionFormData("attachment", fileName);
            headers.setContentLength(pdfBytes.length);

            log.info("试卷PDF生成成功，文件大小：{} bytes", pdfBytes.length);
            return ResponseEntity.ok()
                    .headers(headers)
                    .body(pdfBytes);

        } catch (Exception e) {
            log.error("生成试卷PDF失败", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("生成失败：" + e.getMessage()));
        }
    }

    /**
     * 生成答案页PDF
     */
    @PostMapping("/generate-answers")
    public ResponseEntity<?> generateAnswerSheet(@RequestBody TestPaperRequest request) {
        try {
            if (request.getQuestionIds() == null || request.getQuestionIds().isEmpty()) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(ApiResponse.error("题目列表不能为空"));
            }

            List<QuestionDTO> questions = questionService.getQuestionsByIds(request.getQuestionIds());
            if (questions.isEmpty()) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(ApiResponse.error("未找到有效题目"));
            }

            byte[] pdfBytes = pdfService.generateAnswerSheet(request.getTitle(), questions);

            String fileName = URLEncoder.encode(
                    (request.getTitle() != null ? request.getTitle() : "试卷") + "-答案.pdf",
                    StandardCharsets.UTF_8
            );

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_PDF);
            headers.setContentDispositionFormData("attachment", fileName);
            headers.setContentLength(pdfBytes.length);

            return ResponseEntity.ok()
                    .headers(headers)
                    .body(pdfBytes);

        } catch (Exception e) {
            log.error("生成答案页PDF失败", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("生成失败：" + e.getMessage()));
        }
    }

    /**
     * 试卷请求DTO
     */
    public static class TestPaperRequest {
        private String title;
        private String duration;
        private String totalScore;
        private List<Long> questionIds;

        // Getters and Setters
        public String getTitle() { return title; }
        public void setTitle(String title) { this.title = title; }

        public String getDuration() { return duration; }
        public void setDuration(String duration) { this.duration = duration; }

        public String getTotalScore() { return totalScore; }
        public void setTotalScore(String totalScore) { this.totalScore = totalScore; }

        public List<Long> getQuestionIds() { return questionIds; }
        public void setQuestionIds(List<Long> questionIds) { this.questionIds = questionIds; }
    }
} 