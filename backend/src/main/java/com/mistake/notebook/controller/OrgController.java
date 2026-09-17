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

    @GetMapping("/{slug}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> detail(@PathVariable String slug) {
        return ResponseEntity.ok(ApiResponse.success(orgShowcaseService.detail(slug)));
    }
}
