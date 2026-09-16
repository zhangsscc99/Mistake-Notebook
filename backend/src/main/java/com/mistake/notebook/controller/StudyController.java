package com.mistake.notebook.controller;

import com.mistake.notebook.dto.ApiResponse;
import com.mistake.notebook.entity.LearningReport;
import com.mistake.notebook.entity.MistakeReport;
import com.mistake.notebook.entity.QuestionMark;
import com.mistake.notebook.entity.QuestionNote;
import com.mistake.notebook.entity.QuestionExplanation;
import com.mistake.notebook.security.AuthContext;
import com.mistake.notebook.service.StudyService;
import com.mistake.notebook.service.UserAccountService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/study")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class StudyController {

    private final StudyService studyService;
    private final UserAccountService userAccountService;

    @GetMapping("/overview")
    public ResponseEntity<ApiResponse<Map<String, Object>>> overview() {
        return ResponseEntity.ok(ApiResponse.success(userAccountService.learningOverview(AuthContext.requireUserId())));
    }

    @PostMapping("/learning-reports")
    public ResponseEntity<ApiResponse<LearningReport>> generateLearning() {
        return ResponseEntity.ok(ApiResponse.success("报告已生成",
                studyService.generateLearningReport(AuthContext.requireUserId())));
    }

    @GetMapping("/learning-reports")
    public ResponseEntity<ApiResponse<List<LearningReport>>> listLearning() {
        return ResponseEntity.ok(ApiResponse.success(studyService.listLearningReports(AuthContext.requireUserId())));
    }

    @GetMapping("/learning-reports/{id}")
    public ResponseEntity<ApiResponse<LearningReport>> getLearning(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(studyService.getLearningReport(AuthContext.requireUserId(), id)));
    }

    @DeleteMapping("/learning-reports/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteLearning(@PathVariable Long id) {
        studyService.deleteLearningReport(AuthContext.requireUserId(), id);
        return ResponseEntity.ok(ApiResponse.success("已删除", null));
    }

    @PostMapping("/mistake-reports")
    public ResponseEntity<ApiResponse<MistakeReport>> generateMistake(@RequestBody Map<String, Object> body) {
        List<Long> ids = new java.util.ArrayList<>();
        if (body.get("questionIds") instanceof List<?> raw) {
            for (Object v : raw) ids.add(Long.parseLong(String.valueOf(v)));
        }
        if (ids.isEmpty() && body.get("questionId") != null) {
            ids.add(Long.parseLong(String.valueOf(body.get("questionId"))));
        }
        return ResponseEntity.ok(ApiResponse.success("错因报告已生成",
                studyService.generateMistakeReport(AuthContext.requireUserId(), ids)));
    }

    @PostMapping("/explain")
    public ResponseEntity<ApiResponse<QuestionExplanation>> explain(@RequestBody Map<String, Object> body) {
        long questionId = Long.parseLong(String.valueOf(body.get("questionId")));
        boolean refresh = Boolean.TRUE.equals(body.get("refresh"));
        return ResponseEntity.ok(ApiResponse.success(studyService.explainQuestion(AuthContext.requireUserId(), questionId, refresh)));
    }

    @GetMapping("/practice")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> practice(
            @RequestParam(required = false) Long categoryId,
            @RequestParam(defaultValue = "false") boolean onlyUnmastered) {
        return ResponseEntity.ok(ApiResponse.success(studyService.practiceQuestions(AuthContext.requireUserId(), categoryId, onlyUnmastered)));
    }

    @GetMapping("/mistake-reports")
    public ResponseEntity<ApiResponse<List<MistakeReport>>> listMistake() {
        return ResponseEntity.ok(ApiResponse.success(studyService.listMistakeReports(AuthContext.requireUserId())));
    }

    @GetMapping("/mistake-reports/{id}")
    public ResponseEntity<ApiResponse<MistakeReport>> getMistake(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(studyService.getMistakeReport(AuthContext.requireUserId(), id)));
    }

    @DeleteMapping("/mistake-reports/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteMistake(@PathVariable Long id) {
        studyService.deleteMistakeReport(AuthContext.requireUserId(), id);
        return ResponseEntity.ok(ApiResponse.success("已删除", null));
    }

    @PostMapping("/variants")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> variants(@RequestBody Map<String, Object> body) {
        @SuppressWarnings("unchecked")
        List<Object> raw = (List<Object>) body.get("questionIds");
        List<Long> ids = raw == null ? List.of() : raw.stream().map(v -> Long.parseLong(String.valueOf(v))).toList();
        return ResponseEntity.ok(ApiResponse.success(studyService.generateVariants(AuthContext.requireUserId(), ids)));
    }

    @PostMapping("/marks")
    public ResponseEntity<ApiResponse<QuestionMark>> marks(@RequestBody Map<String, Object> body) {
        long questionId = Long.parseLong(String.valueOf(body.get("questionId")));
        return ResponseEntity.ok(ApiResponse.success(studyService.updateMark(AuthContext.requireUserId(), questionId, body)));
    }

    @PostMapping("/marks/list")
    public ResponseEntity<ApiResponse<List<QuestionMark>>> listMarks(@RequestBody Map<String, Object> body) {
        @SuppressWarnings("unchecked")
        List<Object> raw = (List<Object>) body.get("questionIds");
        List<Long> ids = raw == null ? List.of() : raw.stream().map(v -> Long.parseLong(String.valueOf(v))).toList();
        return ResponseEntity.ok(ApiResponse.success(studyService.listMarks(AuthContext.requireUserId(), ids)));
    }

    @PostMapping("/notes")
    public ResponseEntity<ApiResponse<QuestionNote>> notes(@RequestBody Map<String, Object> body) {
        long questionId = Long.parseLong(String.valueOf(body.get("questionId")));
        String content = body.get("content") == null ? "" : String.valueOf(body.get("content"));
        return ResponseEntity.ok(ApiResponse.success(studyService.saveNote(AuthContext.requireUserId(), questionId, content)));
    }

    @PostMapping("/notes/list")
    public ResponseEntity<ApiResponse<List<QuestionNote>>> listNotes(@RequestBody Map<String, Object> body) {
        @SuppressWarnings("unchecked")
        List<Object> raw = (List<Object>) body.get("questionIds");
        List<Long> ids = raw == null ? List.of() : raw.stream().map(v -> Long.parseLong(String.valueOf(v))).toList();
        return ResponseEntity.ok(ApiResponse.success(studyService.listNotes(AuthContext.requireUserId(), ids)));
    }
}
