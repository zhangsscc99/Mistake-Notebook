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
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> list() {
        return ResponseEntity.ok(ApiResponse.success(orgShowcaseService.list()));
    }

    @GetMapping("/mine")
    public ResponseEntity<ApiResponse<Map<String, Object>>> mine() {
        return ResponseEntity.ok(ApiResponse.success(orgShowcaseService.mine(AuthContext.requireUserId())));
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
    public ResponseEntity<ApiResponse<Map<String, Object>>> approve(@PathVariable Long studentId) {
        return ResponseEntity.ok(ApiResponse.success("已通过", orgShowcaseService.approveJoin(AuthContext.requireUserId(), studentId)));
    }

    @PostMapping("/mine/requests/{studentId}/reject")
    public ResponseEntity<ApiResponse<Map<String, Object>>> reject(@PathVariable Long studentId) {
        return ResponseEntity.ok(ApiResponse.success("已拒绝", orgShowcaseService.rejectJoin(AuthContext.requireUserId(), studentId)));
    }

    @GetMapping("/{slug}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> detail(@PathVariable String slug) {
        return ResponseEntity.ok(ApiResponse.success(orgShowcaseService.detail(slug)));
    }
}
