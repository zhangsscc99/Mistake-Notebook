package com.mistake.notebook.controller;

import com.mistake.notebook.dto.ApiResponse;
import com.mistake.notebook.security.AuthContext;
import com.mistake.notebook.service.OrgShowcaseService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/orgs")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class OrgController {

    private final OrgShowcaseService orgShowcaseService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> list(@RequestParam(required = false) String q) {
        return ResponseEntity.ok(ApiResponse.success(orgShowcaseService.list(q)));
    }

    @GetMapping("/mine")
    public ResponseEntity<ApiResponse<Map<String, Object>>> mine(@RequestParam(required = false) String slug) {
        return ResponseEntity.ok(ApiResponse.success(orgShowcaseService.mine(AuthContext.requireUserId(), slug)));
    }

    @PutMapping("/mine")
    public ResponseEntity<ApiResponse<Map<String, Object>>> saveMine(@RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(ApiResponse.success("已保存机构主页", orgShowcaseService.saveMine(AuthContext.requireUserId(), body)));
    }

    @PostMapping("/join")
    public ResponseEntity<ApiResponse<Map<String, Object>>> join(@RequestBody Map<String, String> body) {
        String code = body.get("code") == null ? body.get("joinCode") : body.get("code");
        Map<String, Object> data = orgShowcaseService.join(AuthContext.requireUserId(), code);
        String msg = Boolean.TRUE.equals(data.get("alreadyJoined"))
                ? "你已在该机构中"
                : "已提交加入申请，等待老师通过";
        return ResponseEntity.ok(ApiResponse.success(msg, data));
    }

    @GetMapping("/joined")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> joined() {
        return ResponseEntity.ok(ApiResponse.success(orgShowcaseService.myOrgs(AuthContext.requireUserId())));
    }

    @PostMapping("/mine/requests/{studentId}/approve")
    public ResponseEntity<ApiResponse<Map<String, Object>>> approve(
            @PathVariable Long studentId, @RequestParam(required = false) String slug) {
        return ResponseEntity.ok(ApiResponse.success("已通过", orgShowcaseService.approveJoin(AuthContext.requireUserId(), studentId, slug)));
    }

    @PostMapping("/mine/requests/{studentId}/reject")
    public ResponseEntity<ApiResponse<Map<String, Object>>> reject(
            @PathVariable Long studentId, @RequestParam(required = false) String slug) {
        return ResponseEntity.ok(ApiResponse.success("已拒绝", orgShowcaseService.rejectJoin(AuthContext.requireUserId(), studentId, slug)));
    }

    @GetMapping("/mine/bank")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> bank(@RequestParam(required = false) String slug) {
        return ResponseEntity.ok(ApiResponse.success(orgShowcaseService.listBank(AuthContext.requireUserId(), slug)));
    }

    @PostMapping("/mine/bank")
    public ResponseEntity<ApiResponse<Map<String, Object>>> addBank(
            @RequestBody Map<String, Object> body, @RequestParam(required = false) String slug) {
        return ResponseEntity.ok(ApiResponse.success("已写入专属题库", orgShowcaseService.addBank(AuthContext.requireUserId(), body, slug)));
    }

    @DeleteMapping("/mine/bank/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteBank(
            @PathVariable Long id, @RequestParam(required = false) String slug) {
        orgShowcaseService.deleteBank(AuthContext.requireUserId(), id, slug);
        return ResponseEntity.ok(ApiResponse.success("已从题库删除", null));
    }

    @GetMapping("/mine/students")
    public ResponseEntity<ApiResponse<Map<String, Object>>> students(
            @RequestParam(required = false, defaultValue = "") String q,
            @RequestParam(required = false) String slug) {
        return ResponseEntity.ok(ApiResponse.success(orgShowcaseService.students(AuthContext.requireUserId(), q, slug)));
    }

    @DeleteMapping("/mine/members/{studentId}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> removeMember(
            @PathVariable Long studentId, @RequestParam(required = false) String slug) {
        return ResponseEntity.ok(ApiResponse.success("已移出机构", orgShowcaseService.removeMember(AuthContext.requireUserId(), studentId, slug)));
    }

    @GetMapping("/mine/analytics")
    public ResponseEntity<ApiResponse<Map<String, Object>>> analytics(@RequestParam(required = false) String slug) {
        return ResponseEntity.ok(ApiResponse.success(orgShowcaseService.analytics(AuthContext.requireUserId(), slug)));
    }

    @GetMapping("/mine/staff")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> staff(@RequestParam(required = false) String slug) {
        return ResponseEntity.ok(ApiResponse.success(orgShowcaseService.listStaff(AuthContext.requireUserId(), slug)));
    }

    @PostMapping("/mine/staff")
    public ResponseEntity<ApiResponse<Map<String, Object>>> addStaff(@RequestBody Map<String, String> body) {
        return ResponseEntity.ok(ApiResponse.success("已添加管理员", orgShowcaseService.addStaff(AuthContext.requireUserId(), body.get("username"))));
    }

    @DeleteMapping("/mine/staff/{teacherId}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> removeStaff(@PathVariable Long teacherId) {
        return ResponseEntity.ok(ApiResponse.success("已移出", orgShowcaseService.removeStaff(AuthContext.requireUserId(), teacherId)));
    }

    @GetMapping("/{slug}/bank")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> memberBank(@PathVariable String slug) {
        return ResponseEntity.ok(ApiResponse.success(orgShowcaseService.memberBank(AuthContext.requireUserId(), slug)));
    }

    @GetMapping("/{slug}/practice")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> memberPractice(
            @PathVariable String slug,
            @RequestParam(defaultValue = "false") boolean onlyUnmastered) {
        return ResponseEntity.ok(ApiResponse.success(
                orgShowcaseService.memberPractice(AuthContext.requireUserId(), slug, onlyUnmastered)));
    }

    @PostMapping("/{slug}/practice/mark")
    public ResponseEntity<ApiResponse<Map<String, Object>>> markPractice(
            @PathVariable String slug,
            @RequestBody Map<String, Object> body) {
        long questionId = Long.parseLong(String.valueOf(body.get("questionId")));
        boolean mastered = Boolean.TRUE.equals(body.get("mastered"));
        return ResponseEntity.ok(ApiResponse.success("已记录",
                orgShowcaseService.markMemberQuestion(AuthContext.requireUserId(), slug, questionId, mastered)));
    }

    @PostMapping("/{slug}/apply")
    public ResponseEntity<ApiResponse<Map<String, Object>>> apply(@PathVariable String slug) {
        Map<String, Object> data = orgShowcaseService.applyBySlug(AuthContext.requireUserId(), slug);
        String msg = Boolean.TRUE.equals(data.get("alreadyJoined"))
                ? "你已在该机构中"
                : "已提交加入申请，等待老师通过";
        return ResponseEntity.ok(ApiResponse.success(msg, data));
    }

    @DeleteMapping("/{slug}/membership")
    public ResponseEntity<ApiResponse<Map<String, Object>>> leave(@PathVariable String slug) {
        Map<String, Object> data = orgShowcaseService.leaveOrg(AuthContext.requireUserId(), slug);
        String msg = Boolean.TRUE.equals(data.get("pending")) ? "已取消申请" : "已退出机构";
        return ResponseEntity.ok(ApiResponse.success(msg, data));
    }

    @GetMapping("/{slug}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> detail(@PathVariable String slug) {
        return ResponseEntity.ok(ApiResponse.success(orgShowcaseService.detail(slug)));
    }
}
