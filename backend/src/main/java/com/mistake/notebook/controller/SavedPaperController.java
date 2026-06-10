package com.mistake.notebook.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mistake.notebook.dto.ApiResponse;
import com.mistake.notebook.entity.SavedPaper;
import com.mistake.notebook.repository.SavedPaperRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/test-paper/saved")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = {"http://localhost:3000", "http://127.0.0.1:3000", "http://103.146.124.206:3060", "http://103.146.124.206:3000", "*"})
public class SavedPaperController {

    private final SavedPaperRepository savedPaperRepository;
    private final ObjectMapper objectMapper;

    @GetMapping
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> listSavedPapers() {
        try {
            List<Map<String, Object>> papers = savedPaperRepository.findByIsDeletedFalseOrderByCreatedAtDesc()
                    .stream()
                    .map(this::toResponse)
                    .collect(Collectors.toList());
            return ResponseEntity.ok(ApiResponse.success("获取试卷列表成功", papers));
        } catch (Exception e) {
            log.error("获取试卷列表失败", e);
            return ResponseEntity.status(500).body(ApiResponse.error("获取试卷列表失败：" + e.getMessage()));
        }
    }

    @PostMapping
    public ResponseEntity<ApiResponse<Map<String, Object>>> savePaper(@RequestBody Map<String, Object> request) {
        try {
            String title = (String) request.get("title");
            Object questionsObj = request.get("questions");
            if (title == null || title.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(ApiResponse.error("试卷标题不能为空"));
            }
            if (!(questionsObj instanceof List) || ((List<?>) questionsObj).isEmpty()) {
                return ResponseEntity.badRequest().body(ApiResponse.error("试卷题目不能为空"));
            }

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> questions = (List<Map<String, Object>>) questionsObj;

            SavedPaper paper = new SavedPaper();
            paper.setTitle(title.trim());
            paper.setQuestionCount(questions.size());
            paper.setDuration(parseInteger(request.get("duration"), 90));
            paper.setTotalScore(parseInteger(request.get("totalScore"), questions.size() * 5));
            paper.setQuestionsJson(objectMapper.writeValueAsString(questions));
            paper.setIsDeleted(false);

            SavedPaper saved = savedPaperRepository.save(paper);
            return ResponseEntity.ok(ApiResponse.success("试卷保存成功", toResponse(saved)));
        } catch (Exception e) {
            log.error("保存试卷失败", e);
            return ResponseEntity.status(500).body(ApiResponse.error("保存试卷失败：" + e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deletePaper(@PathVariable Long id) {
        try {
            SavedPaper paper = savedPaperRepository.findById(id)
                    .orElseThrow(() -> new IllegalArgumentException("试卷不存在"));
            paper.setIsDeleted(true);
            savedPaperRepository.save(paper);
            return ResponseEntity.ok(ApiResponse.success("删除试卷成功", null));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        } catch (Exception e) {
            log.error("删除试卷失败", e);
            return ResponseEntity.status(500).body(ApiResponse.error("删除试卷失败：" + e.getMessage()));
        }
    }

    private Map<String, Object> toResponse(SavedPaper paper) {
        Map<String, Object> response = new HashMap<>();
        response.put("id", paper.getId());
        response.put("title", paper.getTitle());
        response.put("questionCount", paper.getQuestionCount());
        response.put("duration", paper.getDuration());
        response.put("totalScore", paper.getTotalScore());
        response.put("createdAt", paper.getCreatedAt() != null ? paper.getCreatedAt().toLocalDate().toString() : "");
        try {
            response.put("questions", objectMapper.readValue(
                    paper.getQuestionsJson(),
                    new TypeReference<List<Map<String, Object>>>() {}
            ));
        } catch (Exception e) {
            response.put("questions", List.of());
        }
        return response;
    }

    private Integer parseInteger(Object value, int defaultValue) {
        if (value instanceof Number) {
            return ((Number) value).intValue();
        }
        if (value != null) {
            try {
                return Integer.parseInt(value.toString());
            } catch (NumberFormatException ignored) {
                return defaultValue;
            }
        }
        return defaultValue;
    }
}
