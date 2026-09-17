package com.mistake.notebook.controller;

import com.mistake.notebook.dto.ApiResponse;
import com.mistake.notebook.entity.ParentReport;
import com.mistake.notebook.entity.TeacherMessage;
import com.mistake.notebook.security.AuthContext;
import com.mistake.notebook.service.TeacherService;
import com.mistake.notebook.service.TeacherWorkspaceService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 教师工作台：对齐小程序班级 / 题目 / 助手 / 组卷 / 我的。
 */
@RestController
@RequestMapping("/teacher")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class TeacherController {

    private final TeacherService teacherService;
    private final TeacherWorkspaceService workspace;

    @GetMapping("/dashboard")
    public ResponseEntity<ApiResponse<Map<String, Object>>> dashboard() {
        return ResponseEntity.ok(ApiResponse.success(workspace.dashboard(AuthContext.requireUserId())));
    }

    @GetMapping("/analytics")
    public ResponseEntity<ApiResponse<Map<String, Object>>> analytics() {
        return ResponseEntity.ok(ApiResponse.success(teacherService.analytics(AuthContext.requireUserId())));
    }

    // ── 班级 ──
    @GetMapping("/classes")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> classes() {
        return ResponseEntity.ok(ApiResponse.success(workspace.listClasses(AuthContext.requireUserId())));
    }

    @PostMapping("/classes")
    public ResponseEntity<ApiResponse<Map<String, Object>>> createClass(@RequestBody Map<String, String> body) {
        return ResponseEntity.ok(ApiResponse.success("班级已创建",
                workspace.createClass(AuthContext.requireUserId(), body.get("name"), body.get("grade"))));
    }

    @GetMapping("/classes/{classId}/students")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> classStudents(@PathVariable Long classId) {
        return ResponseEntity.ok(ApiResponse.success(workspace.listStudents(AuthContext.requireUserId(), classId)));
    }

    @GetMapping("/classes/{classId}/join-requests")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> joinRequests(@PathVariable Long classId) {
        return ResponseEntity.ok(ApiResponse.success(workspace.joinRequests(AuthContext.requireUserId(), classId)));
    }

    @PostMapping("/classes/{classId}/approve")
    public ResponseEntity<ApiResponse<Map<String, Object>>> approve(@PathVariable Long classId, @RequestBody Map<String, Object> body) {
        long studentId = ((Number) body.get("studentId")).longValue();
        return ResponseEntity.ok(ApiResponse.success("已通过",
                workspace.approveJoin(AuthContext.requireUserId(), classId, studentId)));
    }

    @PostMapping("/classes/{classId}/reject")
    public ResponseEntity<ApiResponse<Map<String, Object>>> reject(@PathVariable Long classId, @RequestBody Map<String, Object> body) {
        long studentId = ((Number) body.get("studentId")).longValue();
        return ResponseEntity.ok(ApiResponse.success("已拒绝",
                workspace.rejectJoin(AuthContext.requireUserId(), classId, studentId)));
    }

    @GetMapping("/classes/{classId}/students/{studentId}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> classStudentOverview(@PathVariable Long classId, @PathVariable Long studentId) {
        return ResponseEntity.ok(ApiResponse.success(workspace.studentOverview(AuthContext.requireUserId(), classId, studentId)));
    }

    @GetMapping("/classes/{classId}/students/{studentId}/questions")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> classStudentQuestions(@PathVariable Long classId, @PathVariable Long studentId) {
        return ResponseEntity.ok(ApiResponse.success(workspace.studentQuestions(AuthContext.requireUserId(), classId, studentId)));
    }

    // ── 学员管理（兼容旧入口） ──
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

    // ── 全班题目 / 题库 ──
    @GetMapping("/class-questions")
    public ResponseEntity<ApiResponse<Map<String, Object>>> classQuestions(@RequestParam(required = false) Long classId) {
        return ResponseEntity.ok(ApiResponse.success(workspace.teacherQuestions(AuthContext.requireUserId(), classId)));
    }

    @GetMapping("/class-stats")
    public ResponseEntity<ApiResponse<Map<String, Object>>> classStats(@RequestParam(required = false) Long classId) {
        return ResponseEntity.ok(ApiResponse.success(workspace.classStats(AuthContext.requireUserId(), classId)));
    }

    @GetMapping("/bank")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> bank(@RequestParam Long classId) {
        return ResponseEntity.ok(ApiResponse.success(workspace.listBank(AuthContext.requireUserId(), classId)));
    }

    @PostMapping("/bank")
    public ResponseEntity<ApiResponse<Map<String, Object>>> saveBank(@RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(ApiResponse.success("已存入题库", workspace.saveBankQuestions(AuthContext.requireUserId(), body)));
    }

    @DeleteMapping("/bank/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteBank(@PathVariable Long id) {
        workspace.deleteBankQuestion(AuthContext.requireUserId(), id);
        return ResponseEntity.ok(ApiResponse.success("已删除", null));
    }

    @PostMapping("/picked")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> picked(@RequestBody Map<String, Object> body) {
        @SuppressWarnings("unchecked")
        List<Object> raw = body.get("questionIds") instanceof List<?> list ? (List<Object>) list : List.of();
        List<Long> ids = raw.stream().map(o -> o instanceof Number n ? n.longValue() : Long.parseLong(String.valueOf(o))).toList();
        return ResponseEntity.ok(ApiResponse.success(workspace.listPickedQuestions(ids)));
    }

    // ── 组卷 / 练习 ──
    @GetMapping("/papers")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> papers(@RequestParam(required = false) Long classId) {
        return ResponseEntity.ok(ApiResponse.success(workspace.listPapers(AuthContext.requireUserId(), classId)));
    }

    @PostMapping("/papers")
    public ResponseEntity<ApiResponse<Map<String, Object>>> savePaper(@RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(ApiResponse.success("已存为题单", workspace.savePaper(AuthContext.requireUserId(), body)));
    }

    @GetMapping("/papers/{id}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> paper(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(workspace.paperDetail(AuthContext.requireUserId(), id)));
    }

    @PostMapping("/papers/{id}/recall")
    public ResponseEntity<ApiResponse<Void>> recallPaper(@PathVariable Long id) {
        workspace.recallPaper(AuthContext.requireUserId(), id);
        return ResponseEntity.ok(ApiResponse.success("已删除题单", null));
    }

    @GetMapping("/class-notebooks")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> classNotebooks(@RequestParam(required = false) Long classId) {
        return ResponseEntity.ok(ApiResponse.success(workspace.listClassNotebooks(AuthContext.requireUserId(), classId)));
    }

    @GetMapping("/class-notebooks/{id}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> classNotebook(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(workspace.classNotebookDetail(AuthContext.requireUserId(), id)));
    }

    @PostMapping("/notebooks/publish")
    public ResponseEntity<ApiResponse<Map<String, Object>>> publishNotebook(@RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(ApiResponse.success("已发给班级", workspace.publishNotebook(AuthContext.requireUserId(), body)));
    }

    @PostMapping("/notebooks/{id}/recall")
    public ResponseEntity<ApiResponse<Void>> recallNotebook(@PathVariable Long id) {
        workspace.recallNotebook(AuthContext.requireUserId(), id);
        return ResponseEntity.ok(ApiResponse.success("已撤回练习", null));
    }

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
        return ResponseEntity.ok(ApiResponse.success(workspace.teacherAssignments(AuthContext.requireUserId())));
    }

    @PostMapping("/homework")
    public ResponseEntity<ApiResponse<Map<String, Object>>> createHomework(@RequestBody Map<String, Object> body) {
        if (body.get("questionIds") != null || body.get("paperId") != null) {
            return ResponseEntity.ok(ApiResponse.success("已布置", workspace.createAssignment(AuthContext.requireUserId(), body)));
        }
        return ResponseEntity.ok(ApiResponse.success("已布置", teacherService.createHomework(AuthContext.requireUserId(), body)));
    }

    @GetMapping("/homework/{id}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> homeworkDetail(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(workspace.assignmentDetail(AuthContext.requireUserId(), id)));
    }

    @DeleteMapping("/homework/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteHomework(@PathVariable Long id) {
        workspace.recallAssignment(AuthContext.requireUserId(), id);
        return ResponseEntity.ok(ApiResponse.success("已撤回", null));
    }

    @PostMapping("/homework/{id}/recall")
    public ResponseEntity<ApiResponse<Void>> recallHomework(@PathVariable Long id) {
        workspace.recallAssignment(AuthContext.requireUserId(), id);
        return ResponseEntity.ok(ApiResponse.success("已撤回作业", null));
    }

    @PostMapping("/submissions/{id}/grade")
    public ResponseEntity<ApiResponse<Map<String, Object>>> grade(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        if (body.get("marks") instanceof List<?>) {
            return ResponseEntity.ok(ApiResponse.success("已批改", workspace.gradeAssignment(AuthContext.requireUserId(), id, body)));
        }
        return ResponseEntity.ok(ApiResponse.success("已批改", teacherService.gradeSubmission(AuthContext.requireUserId(), id, body)));
    }

    @PostMapping("/submissions/{id}/ai-grade")
    public ResponseEntity<ApiResponse<Map<String, Object>>> aiGrade(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success("AI 已给出批改建议", teacherService.aiGrade(AuthContext.requireUserId(), id)));
    }

    // ── 班级助手 ──
    @PostMapping("/chat")
    public ResponseEntity<ApiResponse<Map<String, Object>>> chat(@RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(ApiResponse.success(workspace.chat(AuthContext.requireUserId(), body)));
    }

    // ── 家长报告 ──
    @GetMapping("/class-reports")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> classReports(@RequestParam(required = false) Long classId) {
        return ResponseEntity.ok(ApiResponse.success(workspace.listClassParentReports(AuthContext.requireUserId(), classId)));
    }

    @PostMapping("/class-reports")
    public ResponseEntity<ApiResponse<Map<String, Object>>> createClassReport(@RequestBody Map<String, Object> body) {
        long classId = ((Number) body.get("classId")).longValue();
        return ResponseEntity.ok(ApiResponse.success("报告已生成",
                workspace.classParentReport(AuthContext.requireUserId(), classId)));
    }

    @GetMapping("/class-reports/{id}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> classReport(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(workspace.classParentReportDetail(AuthContext.requireUserId(), id)));
    }

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
