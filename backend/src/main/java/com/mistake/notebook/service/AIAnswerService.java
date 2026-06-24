package com.mistake.notebook.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mistake.notebook.config.AIConfig;
import com.mistake.notebook.config.SimpleOpenAIClient;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import okhttp3.Response;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class AIAnswerService {

    private static final String ANSWER_PROMPT = """
            你是一名专业的教辅老师。请阅读题目内容，输出JSON：
            {
              "answer": "最终答案或步骤总结",
              "analysis": "详细解析步骤，指出思路与关键公式",
              "confidence": 0.0-1.0
            }
            如果无法作答，answer写"待补充"，analysis说明原因。
            """;

    private final SimpleOpenAIClient openAIClient;
    private final AIConfig aiConfig;
    private final ObjectMapper objectMapper;

    public AnswerResult generateAnswer(String questionText) {
        if (questionText == null || questionText.trim().isEmpty()) {
            return AnswerResult.empty("题目内容为空");
        }

        try {
            Map<String, Object> requestData = new HashMap<>();
            requestData.put("model", aiConfig.getModel());
            requestData.put("temperature", 0.3);
            requestData.put("max_tokens", 800);
            requestData.put("stream", false);
            requestData.put("response_format", Map.of("type", "json_object"));

            List<Map<String, String>> messages = new ArrayList<>();
            messages.add(Map.of("role", "system", "content", ANSWER_PROMPT));
            messages.add(Map.of("role", "user", "content", questionText));
            requestData.put("messages", messages);

            try (Response response = openAIClient.createChatCompletion(requestData)) {
                String responseBody = response.body() != null ? response.body().string() : "";

                if (!response.isSuccessful()) {
                    log.error("AI答案生成失败，状态码 {}，响应 {}", response.code(), responseBody);
                    return AnswerResult.empty("AI接口HTTP状态码：" + response.code());
                }

                if (responseBody.isBlank()) {
                    log.error("AI答案生成失败，响应体为空");
                    return AnswerResult.empty("AI接口响应为空");
                }

                JsonNode root = objectMapper.readTree(responseBody);
                JsonNode choices = root.path("choices");
                if (!choices.isArray() || choices.isEmpty()) {
                    log.warn("AI答案返回空choices，原始响应：{}", responseBody);
                    return AnswerResult.empty("AI回答choices为空");
                }

                String content = choices.get(0).path("message").path("content").asText("");
                if (content.isBlank()) {
                    log.warn("AI答案返回内容为空，原始choices：{}", choices.get(0));
                    return AnswerResult.empty("AI回答内容为空");
                }

                JsonNode contentJson = objectMapper.readTree(content);
                String answer = contentJson.path("answer").asText("待补充");
                String analysis = contentJson.path("analysis").asText("");
                double confidence = contentJson.path("confidence").asDouble(0.85);

                log.info("AI答案生成成功：answer长度={}，confidence={}", answer.length(), confidence);
                return new AnswerResult(answer, analysis, confidence, true);
            }
        } catch (Exception e) {
            log.error("生成AI答案失败", e);
            return AnswerResult.empty("AI答案生成异常：" + e.getMessage());
        }
    }

    /**
     * AI 答疑对话（对齐小程序 answer.chat）
     */
    public String chatReply(List<Map<String, String>> messages, String questionContext) {
        return chatReply(messages, questionContext, null);
    }

    public String chatReply(List<Map<String, String>> messages, String questionContext, String memoryBlock) {
        if (messages == null || messages.isEmpty()) {
            return "请先输入你的问题。";
        }

        String contextBlock = (questionContext != null && !questionContext.isBlank())
                ? "【当前题目】：\n" + questionContext + "\n\n请结合这道题，用清晰、循序渐进的方式解答学生的追问。"
                : "请用清晰、循序渐进的方式回答学生的问题。";

        String memorySection = (memoryBlock != null && !memoryBlock.isBlank()) ? memoryBlock : "";

        String systemPrompt = """
                你是一位耐心、专业的学习辅导老师，正在帮一位学生答疑。
                """ + contextBlock + memorySection + """
                
                可以使用分步骤说明，必要时给出关键公式与思路，语言简洁友好，不要使用 markdown 代码块。
                """;

        try {
            Map<String, Object> requestData = new HashMap<>();
            requestData.put("model", aiConfig.getModel());
            requestData.put("temperature", 0.6);
            requestData.put("max_tokens", 1200);
            requestData.put("stream", false);

            List<Map<String, String>> chatMessages = new ArrayList<>();
            chatMessages.add(Map.of("role", "system", "content", systemPrompt));
            for (Map<String, String> m : messages) {
                if (m == null || m.get("content") == null) continue;
                String role = m.get("role");
                if (!"user".equals(role) && !"assistant".equals(role)) continue;
                chatMessages.add(Map.of("role", role, "content", m.get("content")));
            }
            if (chatMessages.size() <= 1) {
                return "请先输入你的问题。";
            }
            requestData.put("messages", chatMessages);

            try (Response response = openAIClient.createChatCompletion(requestData)) {
                String responseBody = response.body() != null ? response.body().string() : "";
                if (!response.isSuccessful()) {
                    log.error("AI chat 失败，状态码 {}，响应 {}", response.code(), responseBody);
                    return "抱歉，我这边出了点问题，请稍后再试。";
                }
                JsonNode root = objectMapper.readTree(responseBody);
                JsonNode choices = root.path("choices");
                if (!choices.isArray() || choices.isEmpty()) {
                    return "抱歉，我这边出了点问题，请稍后再试。";
                }
                String content = choices.get(0).path("message").path("content").asText("");
                return content.isBlank() ? "抱歉，我这边出了点问题，请稍后再试。" : content;
            }
        } catch (Exception e) {
            log.error("AI chat 异常", e);
            return "网络好像不太顺畅，请稍后再问我一次。";
        }
    }

    @Data
    @AllArgsConstructor
    public static class AnswerResult {
        private String answer;
        private String analysis;
        private double confidence;
        private boolean success;

        public static AnswerResult empty(String message) {
            log.warn("AI答案生成失败：{}", message);
            return new AnswerResult("待补充", message, 0.0, false);
        }
    }
}

