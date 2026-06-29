package com.mistake.notebook.controller;

import com.mistake.notebook.dto.ApiResponse;
import com.mistake.notebook.service.AIAnswerService;
import com.mistake.notebook.service.ChatMemoryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * AI 答疑控制器（对齐小程序 answer 云函数）
 */
@RestController
@RequestMapping("/answer")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = {"http://localhost:3060", "http://127.0.0.1:3060", "http://localhost:3000", "http://127.0.0.1:3000", "http://103.146.124.206:3060", "http://103.146.124.206:3000", "*"})
public class AnswerController {

    private final AIAnswerService aiAnswerService;
    private final ChatMemoryService chatMemoryService;

    @PostMapping("/chat")
    public ResponseEntity<ApiResponse<Map<String, String>>> chat(@RequestBody Map<String, Object> request) {
        try {
            @SuppressWarnings("unchecked")
            List<Map<String, String>> messages = (List<Map<String, String>>) request.get("messages");
            String questionContext = request.get("questionContext") != null
                    ? String.valueOf(request.get("questionContext"))
                    : "";
            String clientId = request.get("clientId") != null
                    ? String.valueOf(request.get("clientId"))
                    : "";

            // 读取该用户的长期记忆并注入对话
            String memoryBlock = chatMemoryService.buildMemoryBlock(clientId);
            String reply = aiAnswerService.chatReply(messages, questionContext, memoryBlock);

            // 每轮对话后轻量记录近期提问（不阻塞响应，不调用 LLM）
            chatMemoryService.recordTurnAsync(clientId, messages, questionContext);

            Map<String, String> data = new HashMap<>();
            data.put("reply", reply);
            return ResponseEntity.ok(ApiResponse.success("回复成功", data));
        } catch (Exception e) {
            log.error("AI chat 失败", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("对话失败：" + e.getMessage()));
        }
    }

    /**
     * 获取记忆状态（用于个性化问候）
     */
    @GetMapping("/memory-status")
    public ResponseEntity<ApiResponse<Map<String, Object>>> memoryStatus(
            @RequestParam(required = false) String clientId) {
        try {
            ChatMemoryService.MemoryStatus status = chatMemoryService.getStatus(clientId);
            Map<String, Object> data = new HashMap<>();
            data.put("hasMemory", status.isHasMemory());
            data.put("lastQuestions", status.getLastQuestions());
            data.put("topics", status.getTopics());
            data.put("summary", status.getSummary());
            data.put("profile", status.getProfile());
            data.put("preferences", status.getPreferences());
            data.put("weaknesses", status.getWeaknesses());
            data.put("mistakePatterns", status.getMistakePatterns());
            return ResponseEntity.ok(ApiResponse.success(data));
        } catch (Exception e) {
            log.error("获取记忆状态失败", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("获取记忆失败：" + e.getMessage()));
        }
    }

    /**
     * 显式总结记忆（对齐小程序 summarize；网页端在离开页面时调用）
     */
    @PostMapping("/summarize")
    public ResponseEntity<ApiResponse<Void>> summarize(@RequestBody Map<String, Object> request) {
        try {
            @SuppressWarnings("unchecked")
            List<Map<String, String>> messages = (List<Map<String, String>>) request.get("messages");
            String questionContext = request.get("questionContext") != null
                    ? String.valueOf(request.get("questionContext"))
                    : "";
            String clientId = request.get("clientId") != null
                    ? String.valueOf(request.get("clientId"))
                    : "";
            chatMemoryService.persistAsync(clientId, messages, questionContext);
            return ResponseEntity.ok(ApiResponse.<Void>success("已记录", null));
        } catch (Exception e) {
            log.error("总结记忆失败", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("总结失败：" + e.getMessage()));
        }
    }
}
