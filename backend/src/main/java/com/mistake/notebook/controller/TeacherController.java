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
 * 教师管理后台接口。全部接口要求调用者是 TEACHER 角色。
 */
@RestController
@RequestMapping("/teacher")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class TeacherController {

    private final TeacherService teacherService;

    // ── 总览 ──
    @GetMapping("/dashboard")
    public ResponseEntity<ApiResponse<Map<String, Object>>> dashboard() {
        return ResponseEntity.ok(ApiResponse.success(teacherService.dashboard(AuthContext.requireUserId())));
    }

    @GetMapping("/analytics")
    public ResponseEntity<ApiResponse<Map<String, Object>>> analytics() {
        return ResponseEntity.ok(ApiResponse.success(teacherService.analytics(AuthContext.requireUserId())));
    }

    // ── 学员管理 ──
    @GetMapping("/students")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> students() {
        return ResponseEntity.ok(ApiResponse.success(teacherService.listStudents(AuthContext.requireUserId())));
    }

    @PostMapping("/students")
    public ResponseEntity<ApiResponse<Map<String, Object>>> bindStudent(@RequestBody Map<String, String> body) {
        return ResponseEntity.ok(ApiResponse.success("已绑定", teacherService.bindStudentByUsername(
                AuthContext.requireUserId(), body.get("username"), body.get("remark"))));
    }

    @DeleteMapping("/students/{studentId}")
    public ResponseEntity<ApiResponse<Void>> unbindStudent(@PathVariable Long studentId) {
        teacherService.unbindStudent(AuthContext.requireUserId(), studentId);
        return ResponseEntity.ok(ApiResponse.success("已解绑", null));
    }

    @PostMapping("/students/{studentId}/remark")
    public ResponseEntity<ApiResponse<Void>> remark(@PathVariable Long studentId, @RequestBody Map<String, String> body) {
        teacherService.updateRemark(AuthContext.requireUserId(), studentId, body.get("remark"));
        return ResponseEntity.ok(ApiResponse.success("已保存", null));
    }

    @GetMapping("/students/{studentId}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> studentOverview(@PathVariable Long studentId) {
        return ResponseEntity.ok(ApiResponse.success(teacherService.studentOverview(AuthContext.requireUserId(), studentId)));
    }

    @GetMapping("/students/{studentId}/questions")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> studentQuestions(@PathVariable Long studentId) {
        return ResponseEntity.ok(ApiResponse.success(teacherService.studentQuestions(AuthContext.requireUserId(), studentId)));
    }

    // ── 留言 ──
    @GetMapping("/students/{studentId}/messages")
    public ResponseEntity<ApiResponse<List<TeacherMessage>>> messages(@PathVariable Long studentId) {
        long teacherId = AuthContext.requireUserId();
        teacherService.requireTeacher(teacherId);
        return ResponseEntity.ok(ApiResponse.success(teacherService.messages(teacherId, studentId, true)));
    }

    @PostMapping("/students/{studentId}/messages")
    public ResponseEntity<ApiResponse<TeacherMessage>> sendMessage(@PathVariable Long studentId, @RequestBody Map<String, String> body) {
        long teacherId = AuthContext.requireUserId();
        teacherService.requireTeacher(teacherId);
        return ResponseEntity.ok(ApiResponse.success("已发送",
                teacherService.sendMessage(teacherId, studentId, "TEACHER", body.get("content"))));
    }

    // ── 班级错题本 ──
    @GetMapping("/high-frequency")
    public ResponseEntity<ApiResponse<Map<String, Object>>> highFrequency() {
        return ResponseEntity.ok(ApiResponse.success(teacherService.highFrequency(AuthContext.requireUserId())));
    }

    @GetMapping("/notebooks")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> notebooks() {
        return ResponseEntity.ok(ApiResponse.success(teacherService.listNotebooks(AuthContext.requireUserId())));
    }

    @GetMapping("/notebooks/{id}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> notebook(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(teacherService.notebookDetail(AuthContext.requireUserId(), id)));
    }

    @PostMapping("/notebooks")
    public ResponseEntity<ApiResponse<Map<String, Object>>> createNotebook(@RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(ApiResponse.success("已保存", teacherService.saveNotebook(AuthContext.requireUserId(), null, body)));
    }

    @PostMapping("/notebooks/{id}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> updateNotebook(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(ApiResponse.success("已保存", teacherService.saveNotebook(AuthContext.requireUserId(), id, body)));
    }

    @PostMapping("/notebooks/{id}/push")
    public ResponseEntity<ApiResponse<Map<String, Object>>> pushNotebook(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success("已推送给全班", teacherService.pushNotebook(AuthContext.requireUserId(), id)));
    }

    @DeleteMapping("/notebooks/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteNotebook(@PathVariable Long id) {
        teacherService.deleteNotebook(AuthContext.requireUserId(), id);
        return ResponseEntity.ok(ApiResponse.success("已删除", null));
    }

    // ── 作业 ──
    @GetMapping("/homework")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> homework() {
        return ResponseEntity.ok(ApiResponse.success(teacherService.listHomework(AuthContext.requireUserId())));
    }

    @PostMapping("/homework")
    public ResponseEntity<ApiResponse<Map<String, Object>>> createHomework(@RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(ApiResponse.success("已布置", teacherService.createHomework(AuthContext.requireUserId(), body)));
    }

    @GetMapping("/homework/{id}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> homeworkDetail(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(teacherService.homeworkDetail(AuthContext.requireUserId(), id)));
    }

    @DeleteMapping("/homework/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteHomework(@PathVariable Long id) {
        teacherService.deleteHomework(AuthContext.requireUserId(), id);
        return ResponseEntity.ok(ApiResponse.success("已删除", null));
    }

    @PostMapping("/submissions/{id}/grade")
    public ResponseEntity<ApiResponse<Map<String, Object>>> grade(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(ApiResponse.success("已批改", teacherService.gradeSubmission(AuthContext.requireUserId(), id, body)));
    }

    @PostMapping("/submissions/{id}/ai-grade")
    public ResponseEntity<ApiResponse<Map<String, Object>>> aiGrade(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success("AI 已给出批改建议", teacherService.aiGrade(AuthContext.requireUserId(), id)));
    }

    // ── 家长报告 ──
    @GetMapping("/students/{studentId}/parent-reports")
    public ResponseEntity<ApiResponse<List<ParentReport>>> parentReports(@PathVariable Long studentId) {
        return ResponseEntity.ok(ApiResponse.success(teacherService.listParentReports(AuthContext.requireUserId(), studentId)));
    }

    @PostMapping("/students/{studentId}/parent-reports")
    public ResponseEntity<ApiResponse<ParentReport>> generateParentReport(@PathVariable Long studentId,
                                                                          @RequestBody(required = false) Map<String, String> body) {
        String note = body == null ? "" : body.getOrDefault("note", "");
        return ResponseEntity.ok(ApiResponse.success("报告已生成",
                teacherService.generateParentReport(AuthContext.requireUserId(), studentId, note)));
    }

    @GetMapping("/parent-reports/{id}")
    public ResponseEntity<ApiResponse<ParentReport>> parentReport(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(teacherService.getParentReport(AuthContext.requireUserId(), id)));
    }

    @DeleteMapping("/parent-reports/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteParentReport(@PathVariable Long id) {
        teacherService.deleteParentReport(AuthContext.requireUserId(), id);
        return ResponseEntity.ok(ApiResponse.success("已删除", null));
    }
}
