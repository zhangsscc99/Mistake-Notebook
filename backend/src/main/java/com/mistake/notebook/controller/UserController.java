package com.mistake.notebook.controller;

import com.mistake.notebook.dto.ApiResponse;
import com.mistake.notebook.security.AuthContext;
import com.mistake.notebook.service.UserAccountService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/user")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class UserController {

    private final UserAccountService userAccountService;

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<Map<String, Object>>> me() {
        return ResponseEntity.ok(ApiResponse.success(userAccountService.profile(AuthContext.requireUserId())));
    }

    @PostMapping("/profile")
    public ResponseEntity<ApiResponse<Map<String, Object>>> update(@RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(ApiResponse.success("已保存", userAccountService.updateProfile(AuthContext.requireUserId(), body)));
    }

    @GetMapping("/wallet")
    public ResponseEntity<ApiResponse<Map<String, Object>>> wallet() {
        return ResponseEntity.ok(ApiResponse.success(userAccountService.wallet(AuthContext.requireUserId())));
    }

    @PostMapping("/checkin")
    public ResponseEntity<ApiResponse<Map<String, Object>>> checkin() {
        return ResponseEntity.ok(ApiResponse.success("打卡成功", userAccountService.checkin(AuthContext.requireUserId())));
    }

    @PostMapping("/vip")
    public ResponseEntity<ApiResponse<Map<String, Object>>> vip() {
        return ResponseEntity.ok(ApiResponse.success(userAccountService.redeemVip(AuthContext.requireUserId())));
    }

    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<Map<String, Object>>> stats() {
        return ResponseEntity.ok(ApiResponse.success(userAccountService.stats(AuthContext.requireUserId())));
    }

    @GetMapping("/leaderboard")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> leaderboard() {
        return ResponseEntity.ok(ApiResponse.success(userAccountService.leaderboard()));
    }

    @DeleteMapping("/account")
    public ResponseEntity<ApiResponse<Map<String, Object>>> deleteAccount() {
        return ResponseEntity.ok(ApiResponse.success("账号已注销", userAccountService.deleteAccount(AuthContext.requireUserId())));
    }
}
