package com.mistake.notebook.controller;

import com.mistake.notebook.dto.ApiResponse;
import com.mistake.notebook.service.UserAccountService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class AuthController {

    private final UserAccountService userAccountService;

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<Map<String, Object>>> register(@RequestBody Map<String, String> body) {
        Map<String, Object> data = userAccountService.register(
                body.getOrDefault("username", ""),
                body.getOrDefault("password", ""),
                body.getOrDefault("nickName", "匿名用户"),
                body.getOrDefault("role", "STUDENT")
        );
        return ResponseEntity.ok(ApiResponse.success("账号已创建", data));
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<Map<String, Object>>> login(@RequestBody Map<String, String> body) {
        Map<String, Object> data = userAccountService.login(
                body.getOrDefault("username", ""),
                body.getOrDefault("password", "")
        );
        return ResponseEntity.ok(ApiResponse.success("欢迎回来", data));
    }
}
