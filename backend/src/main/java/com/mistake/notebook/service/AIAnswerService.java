package com.mistake.notebook.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mistake.notebook.config.AIConfig;
import com.mistake.notebook.config.SimpleOpenAIClient;
import com.mistake.notebook.util.AiJsonParser;
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
            你是一名专业的教辅老师。只输出一个完整 JSON 对象，不要 Markdown、不要额外说明。
            字段顺序必须是 answer → analysis → confidence：
            {
              "answer": "最终答案；选择题只写选项字母",
              "analysis": "完整解析：结论、逐步推理、关键公式、易错点。把推理写完，不要中途停下",
              "confidence": 0.85
            }
            JSON 必须完整闭合。如果无法作答，answer 写"待补充"，analysis 说明原因。
            """;

    private final SimpleOpenAIClient openAIClient;
    private final AIConfig aiConfig;
    private final ObjectMapper objectMapper;

    public AnswerResult generateAnswer(String questionText) {
        if (questionText == null || questionText.trim().isEmpty()) {
            return AnswerResult.empty("题目内容为空");
        }

        int limit = outputLimit();
        AnswerResult first = requestAnswer(questionText, limit, ANSWER_PROMPT);
        if (first.isSuccess()) {
            return first;
        }
        log.warn("首次答案解析失败，按 {} tokens 原提示重试：{}", limit, first.getAnalysis());
        AnswerResult retry = requestAnswer(questionText, limit, ANSWER_PROMPT);
        if (retry.isSuccess()) {
            return retry;
        }
        return first;
    }

    private int outputLimit() {
        int n = aiConfig.getMaxTokens();
        return n > 0 ? n : 10000;
    }

    private AnswerResult requestAnswer(String questionText, int maxTokens, String systemPrompt) {
        try {
            Map<String, Object> requestData = new HashMap<>();
            requestData.put("model", aiConfig.getModel());
            requestData.put("temperature", 0.3);
            requestData.put("max_tokens", maxTokens);
            requestData.put("stream", false);
            requestData.put("response_format", Map.of("type", "json_object"));

            List<Map<String, String>> messages = new ArrayList<>();
            messages.add(Map.of("role", "system", "content", systemPrompt));
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

                JsonNode choice = choices.get(0);
                String finishReason = choice.path("finish_reason").asText("");
                String content = choice.path("message").path("content").asText("");
                if (content.isBlank()) {
                    log.warn("AI答案返回内容为空，finish_reason={}，choices={}", finishReason, choice);
                    return AnswerResult.empty("AI回答内容为空");
                }

                JsonNode strict = null;
                try {
                    JsonNode parsed = objectMapper.readTree(AiJsonParser.unwrap(content));
                    if (parsed != null && parsed.isObject()) {
                        strict = parsed;
                    }
                } catch (Exception ignored) {
                    // truncated JSON from max_tokens; salvage below
                }
                JsonNode contentJson = strict != null ? strict : AiJsonParser.parseObject(objectMapper, content);
                boolean salvaged = strict == null && contentJson != null;
                if (contentJson == null) {
                    log.warn("AI答案JSON无法解析，finish_reason={}，content前200字：{}",
                            finishReason, content.substring(0, Math.min(200, content.length())));
                    return AnswerResult.empty("length".equalsIgnoreCase(finishReason)
                            ? "模型输出被截断，请再点一次重新解析"
                            : "模型返回的答案格式无法解析，请再点一次重新解析");
                }

                String answer = contentJson.path("answer").asText("").trim();
                String analysis = contentJson.path("analysis").asText("").trim();
                if (answer.isEmpty()) {
                    return AnswerResult.empty("模型没有给出答案，请再点一次重新解析");
                }
                if ((salvaged || "length".equalsIgnoreCase(finishReason)) && !analysis.isBlank()
                        && !analysis.contains("被截断")) {
                    analysis = analysis + "\n\n（解析在长度上限处被截断，答案已保留。）";
                }
                double confidence = contentJson.path("confidence").asDouble(0.85);
                log.info("AI答案生成成功：answer长度={}，analysis长度={}，finish_reason={}，confidence={}",
                        answer.length(), analysis.length(), finishReason, confidence);
                return new AnswerResult(answer, analysis, confidence, true);
            }
        } catch (Exception e) {
            log.error("生成AI答案失败", e);
            return AnswerResult.empty("AI答案生成异常，请再点一次重新解析");
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
            requestData.put("max_tokens", outputLimit());
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

    public String complete(String systemPrompt, String userPrompt, int maxTokens) {
        Map<String, Object> requestData = new HashMap<>();
        requestData.put("model", aiConfig.getModel());
        requestData.put("temperature", 0.4);
        requestData.put("max_tokens", Math.max(maxTokens, outputLimit()));
        requestData.put("stream", false);
        requestData.put("messages", List.of(
                Map.of("role", "system", "content", systemPrompt),
                Map.of("role", "user", "content", userPrompt)
        ));

        // 线路偶发连不上，重试一次比直接失败划算（一次报告生成本来就要十几秒）
        for (int attempt = 1; attempt <= 2; attempt++) {
            try (Response response = openAIClient.createChatCompletion(requestData)) {
                String responseBody = response.body() != null ? response.body().string() : "";
                if (!response.isSuccessful()) {
                    log.error("AI complete 失败，状态码 {}（第 {} 次）", response.code(), attempt);
                    continue;
                }
                JsonNode root = objectMapper.readTree(responseBody);
                String content = root.path("choices").path(0).path("message").path("content").asText("");
                if (!content.isBlank()) return content;
                log.warn("AI complete 返回空内容（第 {} 次）", attempt);
            } catch (Exception e) {
                log.error("AI complete 异常（第 {} 次）：{}", attempt, e.getMessage());
            }
        }
        return "";
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

