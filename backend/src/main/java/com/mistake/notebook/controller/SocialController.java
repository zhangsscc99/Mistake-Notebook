package com.mistake.notebook.controller;

import com.mistake.notebook.dto.ApiResponse;
import com.mistake.notebook.security.AuthContext;
import com.mistake.notebook.service.SocialService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/social")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class SocialController {

    private final SocialService socialService;

    @GetMapping("/home")
    public ResponseEntity<ApiResponse<Map<String, Object>>> home() {
        return ResponseEntity.ok(ApiResponse.success(socialService.home(AuthContext.requireUserId())));
    }

    @GetMapping("/help")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> help(
            @RequestParam(required = false, defaultValue = "") String subject) {
        return ResponseEntity.ok(ApiResponse.success(socialService.listHelp(AuthContext.requireUserId(), subject)));
    }

    @PostMapping("/help")
    public ResponseEntity<ApiResponse<Map<String, Object>>> createHelp(@RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(ApiResponse.success("已发布", socialService.createHelp(AuthContext.requireUserId(), body)));
    }

    @GetMapping("/help/{id}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> helpDetail(@PathVariable long id) {
        return ResponseEntity.ok(ApiResponse.success(socialService.helpDetail(AuthContext.requireUserId(), id)));
    }

    @PostMapping("/help/{id}/replies")
    public ResponseEntity<ApiResponse<Map<String, Object>>> reply(@PathVariable long id, @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(ApiResponse.success("已回复", socialService.replyHelp(AuthContext.requireUserId(), id, body)));
    }

    @PostMapping("/help/{id}/like")
    public ResponseEntity<ApiResponse<Map<String, Object>>> like(@PathVariable long id) {
        return ResponseEntity.ok(ApiResponse.success(socialService.toggleHelpLike(AuthContext.requireUserId(), id)));
    }

    @DeleteMapping("/help/{id}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> deleteHelp(@PathVariable long id) {
        return ResponseEntity.ok(ApiResponse.success("已删除", socialService.deleteHelp(AuthContext.requireUserId(), id)));
    }

    @DeleteMapping("/help/{id}/replies/{rid}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> deleteReply(@PathVariable long id, @PathVariable long rid) {
        return ResponseEntity.ok(ApiResponse.success("已删除回复", socialService.deleteReply(AuthContext.requireUserId(), id, rid)));
    }

    @GetMapping("/friends")
    public ResponseEntity<ApiResponse<Map<String, Object>>> friends() {
        return ResponseEntity.ok(ApiResponse.success(socialService.friendsHome(AuthContext.requireUserId())));
    }

    @GetMapping("/users")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> users(@RequestParam(defaultValue = "") String q) {
        return ResponseEntity.ok(ApiResponse.success(socialService.searchUsers(AuthContext.requireUserId(), q)));
    }

    @PostMapping("/friends")
    public ResponseEntity<ApiResponse<Map<String, Object>>> addFriend(@RequestBody Map<String, String> body) {
        return ResponseEntity.ok(ApiResponse.success("已发送申请", socialService.addFriend(AuthContext.requireUserId(), body.get("username"))));
    }

    @PostMapping("/friends/{userId}/accept")
    public ResponseEntity<ApiResponse<Map<String, Object>>> acceptFriend(@PathVariable long userId) {
        return ResponseEntity.ok(ApiResponse.success("已通过", socialService.acceptFriend(AuthContext.requireUserId(), userId)));
    }

    @PostMapping("/friends/{userId}/reject")
    public ResponseEntity<ApiResponse<Map<String, Object>>> rejectFriend(@PathVariable long userId) {
        return ResponseEntity.ok(ApiResponse.success("已拒绝", socialService.rejectFriend(AuthContext.requireUserId(), userId)));
    }

    @PostMapping("/friends/{userId}/cancel")
    public ResponseEntity<ApiResponse<Map<String, Object>>> cancelFriend(@PathVariable long userId) {
        return ResponseEntity.ok(ApiResponse.success("已撤回", socialService.cancelFriend(AuthContext.requireUserId(), userId)));
    }

    @DeleteMapping("/friends/{userId}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> unfriend(@PathVariable long userId) {
        return ResponseEntity.ok(ApiResponse.success("已解除好友", socialService.unfriend(AuthContext.requireUserId(), userId)));
    }

    @PostMapping("/pk")
    public ResponseEntity<ApiResponse<Map<String, Object>>> challenge(@RequestBody Map<String, Object> body) {
        long friendId = Long.parseLong(String.valueOf(body.get("friendId")));
        return ResponseEntity.ok(ApiResponse.success("已发出 PK", socialService.challenge(AuthContext.requireUserId(), friendId)));
    }

    @GetMapping("/pk/{id}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> pkDetail(@PathVariable long id) {
        return ResponseEntity.ok(ApiResponse.success(socialService.pkDetail(AuthContext.requireUserId(), id)));
    }

    @PostMapping("/pk/{id}/accept")
    public ResponseEntity<ApiResponse<Map<String, Object>>> acceptPk(@PathVariable long id) {
        Map<String, Object> data = socialService.acceptPk(AuthContext.requireUserId(), id);
        Object last = data.get("lastMatch");
        String msg = "对战已结算";
        if (last instanceof Map<?, ?> m && "QUIZ".equals(m.get("mode")) && "ACTIVE".equals(m.get("status"))) {
            msg = "已应战，开始答题";
        }
        return ResponseEntity.ok(ApiResponse.success(msg, data));
    }

    @PostMapping("/pk/{id}/submit")
    public ResponseEntity<ApiResponse<Map<String, Object>>> submitPk(@PathVariable long id, @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(ApiResponse.success("已交卷", socialService.submitPk(AuthContext.requireUserId(), id, body)));
    }
}
