package com.mistake.notebook.controller;

import com.mistake.notebook.dto.ApiResponse;
import com.mistake.notebook.entity.ParentReport;
import com.mistake.notebook.entity.TeacherMessage;
import com.mistake.notebook.security.AuthContext;
import com.mistake.notebook.service.TeacherService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 学生侧的师生功能：绑定老师、留言、班级错题本、作业、家长报告。
 */
@RestController
@RequestMapping("/classroom")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class StudentClassController {

    private final TeacherService teacherService;

    @GetMapping("/teachers")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> teachers() {
        return ResponseEntity.ok(ApiResponse.success(teacherService.myTeachers(AuthContext.requireUserId())));
    }

    @PostMapping("/teachers")
    public ResponseEntity<ApiResponse<Map<String, Object>>> bind(@RequestBody Map<String, String> body) {
        return ResponseEntity.ok(ApiResponse.success("已绑定老师",
                teacherService.bindTeacher(AuthContext.requireUserId(), body.get("code"))));
    }

    @DeleteMapping("/teachers/{teacherId}")
    public ResponseEntity<ApiResponse<Void>> unbind(@PathVariable Long teacherId) {
        teacherService.unbindTeacher(AuthContext.requireUserId(), teacherId);
        return ResponseEntity.ok(ApiResponse.success("已解绑", null));
    }

    @GetMapping("/summary")
    public ResponseEntity<ApiResponse<Map<String, Object>>> summary() {
        long sid = AuthContext.requireUserId();
        Map<String, Object> d = new java.util.HashMap<>();
        d.put("teachers", teacherService.myTeachers(sid));
        d.put("unread", teacherService.studentUnread(sid));
        d.put("notebooks", teacherService.studentNotebooks(sid));
        d.put("homework", teacherService.studentHomework(sid));
        d.put("parentReports", teacherService.studentParentReports(sid));
        return ResponseEntity.ok(ApiResponse.success(d));
    }

    // ── 留言 ──
    @GetMapping("/teachers/{teacherId}/messages")
    public ResponseEntity<ApiResponse<List<TeacherMessage>>> messages(@PathVariable Long teacherId) {
        return ResponseEntity.ok(ApiResponse.success(teacherService.messages(teacherId, AuthContext.requireUserId(), false)));
    }

    @PostMapping("/teachers/{teacherId}/messages")
    public ResponseEntity<ApiResponse<TeacherMessage>> send(@PathVariable Long teacherId, @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(ApiResponse.success("已发送",
                teacherService.sendMessage(teacherId, AuthContext.requireUserId(), "STUDENT", body.get("content"))));
    }

    // ── 班级错题本 ──
    @GetMapping("/notebooks")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> notebooks() {
        return ResponseEntity.ok(ApiResponse.success(teacherService.studentNotebooks(AuthContext.requireUserId())));
    }

    @GetMapping("/notebooks/{id}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> notebook(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(teacherService.studentNotebookDetail(AuthContext.requireUserId(), id)));
    }

    @PostMapping("/notebooks/{id}/progress")
    public ResponseEntity<ApiResponse<Object>> progress(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        int done = body.get("doneCount") instanceof Number n ? n.intValue() : 0;
        int mastered = body.get("masteredCount") instanceof Number n2 ? n2.intValue() : 0;
        return ResponseEntity.ok(ApiResponse.success("已记录",
                teacherService.saveProgress(AuthContext.requireUserId(), id, done, mastered)));
    }

    // ── 作业 ──
    @GetMapping("/homework")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> homework() {
        return ResponseEntity.ok(ApiResponse.success(teacherService.studentHomework(AuthContext.requireUserId())));
    }

    @GetMapping("/homework/{id}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> homeworkDetail(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(teacherService.studentHomeworkDetail(AuthContext.requireUserId(), id)));
    }

    @PostMapping("/homework/{id}/submit")
    public ResponseEntity<ApiResponse<Map<String, Object>>> submit(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        @SuppressWarnings("unchecked")
        List<Object> answers = body.get("answers") instanceof List<?> raw ? (List<Object>) raw : List.of();
        return ResponseEntity.ok(ApiResponse.success("已提交",
                teacherService.submitHomework(AuthContext.requireUserId(), id, answers)));
    }

    // ── 家长报告（学生可见） ──
    @GetMapping("/parent-reports")
    public ResponseEntity<ApiResponse<List<ParentReport>>> parentReports() {
        return ResponseEntity.ok(ApiResponse.success(teacherService.studentParentReports(AuthContext.requireUserId())));
    }

    @GetMapping("/parent-reports/{id}")
    public ResponseEntity<ApiResponse<ParentReport>> parentReport(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(teacherService.getParentReport(AuthContext.requireUserId(), id)));
    }
}
