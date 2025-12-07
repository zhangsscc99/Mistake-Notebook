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

