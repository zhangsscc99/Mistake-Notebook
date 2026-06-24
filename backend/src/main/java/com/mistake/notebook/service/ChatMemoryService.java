package com.mistake.notebook.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mistake.notebook.config.AIConfig;
import com.mistake.notebook.config.SimpleOpenAIClient;
import com.mistake.notebook.entity.ChatMemory;
import com.mistake.notebook.repository.ChatMemoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import okhttp3.Response;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

/**
 * AI 答疑记忆服务：SQL 持久化每位用户的长期记忆，
 * 在对话时注入系统提示，在对话后异步总结更新。
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ChatMemoryService {

    private static final int MAX_TOPICS = 12;
    private static final int MAX_LAST_QUESTIONS = 5;

    private static final String SUMMARIZE_PROMPT = """
            你是学习助手的记忆整理模块。阅读师生对话，提炼出可长期记忆的信息，严格输出 JSON：
            {
              "summary": "一句话概括学生最近的学习重点与困惑",
              "topics": ["知识点1","知识点2"]
            }
            topics 为学生涉及的学科知识点关键词（3-8个），只返回 JSON。
            """;

    private final ChatMemoryRepository chatMemoryRepository;
    private final SimpleOpenAIClient openAIClient;
    private final AIConfig aiConfig;
    private final ObjectMapper objectMapper;

    public MemoryStatus getStatus(String clientId) {
        if (clientId == null || clientId.isBlank()) {
            return MemoryStatus.empty();
        }
        return chatMemoryRepository.findByClientId(clientId)
                .map(m -> {
                    List<String> topics = parseJsonArray(m.getTopics());
                    List<String> lastQuestions = parseJsonArray(m.getLastQuestions());
                    boolean hasMemory = !topics.isEmpty() || !lastQuestions.isEmpty();
                    return new MemoryStatus(hasMemory, lastQuestions, topics, m.getSummary());
                })
                .orElse(MemoryStatus.empty());
    }

    /**
     * 构建注入对话的记忆块（供 system prompt 使用）
     */
    public String buildMemoryBlock(String clientId) {
        if (clientId == null || clientId.isBlank()) {
            return "";
        }
        Optional<ChatMemory> opt = chatMemoryRepository.findByClientId(clientId);
        if (opt.isEmpty()) {
            return "";
        }
        ChatMemory m = opt.get();
        List<String> topics = parseJsonArray(m.getTopics());
        List<String> lastQuestions = parseJsonArray(m.getLastQuestions());
        if (topics.isEmpty() && lastQuestions.isEmpty()
                && (m.getSummary() == null || m.getSummary().isBlank())) {
            return "";
        }

        StringBuilder sb = new StringBuilder();
        sb.append("\n【关于这位学生的长期记忆（请自然地参考，不要生硬复述）】\n");
        if (m.getSummary() != null && !m.getSummary().isBlank()) {
            sb.append("- 学习概况：").append(m.getSummary().trim()).append("\n");
        }
        if (!topics.isEmpty()) {
            sb.append("- 学过/关注的知识点：")
                    .append(String.join("、", topics.stream().limit(MAX_TOPICS).collect(Collectors.toList())))
                    .append("\n");
        }
        if (!lastQuestions.isEmpty()) {
            sb.append("- 最近问过：")
                    .append(lastQuestions.stream().limit(MAX_LAST_QUESTIONS)
                            .map(q -> "「" + q + "」").collect(Collectors.joining("，")))
                    .append("\n");
        }
        return sb.toString();
    }

    /**
     * 每轮对话后的轻量记忆更新（仅记录近期提问与上下文，不调用 LLM，开销极小）
     */
    @Async("aiTaskExecutor")
    public void recordTurnAsync(String clientId, List<Map<String, String>> messages, String questionContext) {
        if (clientId == null || clientId.isBlank() || messages == null || messages.isEmpty()) {
            return;
        }
        try {
            List<String> lastQuestions = extractLastQuestions(messages);
            if (lastQuestions.isEmpty()) {
                return;
            }
            saveMemory(clientId, lastQuestions, questionContext, null);
        } catch (Exception e) {
            log.error("记录AI对话记忆失败 clientId={}", clientId, e);
        }
    }

    /**
     * 对话结束后异步总结并持久化记忆（含 LLM 主题提炼）
     */
    @Async("aiTaskExecutor")
    public void persistAsync(String clientId, List<Map<String, String>> messages, String questionContext) {
        if (clientId == null || clientId.isBlank() || messages == null || messages.isEmpty()) {
            return;
        }
        try {
            List<String> lastQuestions = extractLastQuestions(messages);
            if (lastQuestions.isEmpty()) {
                return;
            }
            SummaryResult summary = summarizeWithLLM(messages);
            saveMemory(clientId, lastQuestions, questionContext, summary);
        } catch (Exception e) {
            log.error("持久化AI记忆失败 clientId={}", clientId, e);
        }
    }

    private List<String> extractLastQuestions(List<Map<String, String>> messages) {
        List<String> userMessages = messages.stream()
                .filter(m -> m != null && "user".equals(m.get("role")) && m.get("content") != null)
                .map(m -> m.get("content").trim())
                .filter(s -> !s.isEmpty())
                .map(s -> s.length() > 150 ? s.substring(0, 150) : s)
                .collect(Collectors.toList());
        if (userMessages.size() > MAX_LAST_QUESTIONS) {
            return new ArrayList<>(userMessages.subList(userMessages.size() - MAX_LAST_QUESTIONS, userMessages.size()));
        }
        return userMessages;
    }

    @Transactional
    protected void saveMemory(String clientId, List<String> lastQuestions,
                              String questionContext, SummaryResult summary) {
        ChatMemory memory = chatMemoryRepository.findByClientId(clientId)
                .orElseGet(() -> {
                    ChatMemory m = new ChatMemory();
                    m.setClientId(clientId);
                    m.setSessionCount(0);
                    return m;
                });

        memory.setLastQuestions(toJsonArray(lastQuestions));

        if (questionContext != null && !questionContext.isBlank()) {
            memory.setLastQuestionContext(
                    questionContext.length() > 500 ? questionContext.substring(0, 500) : questionContext);
        }

        if (summary != null) {
            if (summary.getSummary() != null && !summary.getSummary().isBlank()) {
                memory.setSummary(summary.getSummary().trim());
            }
            if (summary.getTopics() != null && !summary.getTopics().isEmpty()) {
                List<String> merged = mergeTopics(parseJsonArray(memory.getTopics()), summary.getTopics());
                memory.setTopics(toJsonArray(merged));
            }
        }

        memory.setSessionCount((memory.getSessionCount() == null ? 0 : memory.getSessionCount()) + 1);
        chatMemoryRepository.save(memory);
        log.info("AI记忆已更新 clientId={}, topics={}", clientId, memory.getTopics());
    }

    private List<String> mergeTopics(List<String> existing, List<String> incoming) {
        LinkedHashSet<String> set = new LinkedHashSet<>();
        if (incoming != null) {
            incoming.stream().filter(Objects::nonNull).map(String::trim)
                    .filter(s -> !s.isEmpty()).forEach(set::add);
        }
        if (existing != null) {
            existing.stream().filter(Objects::nonNull).map(String::trim)
                    .filter(s -> !s.isEmpty()).forEach(set::add);
        }
        return set.stream().limit(MAX_TOPICS).collect(Collectors.toList());
    }

    private SummaryResult summarizeWithLLM(List<Map<String, String>> messages) {
        try {
            StringBuilder convo = new StringBuilder();
            for (Map<String, String> m : messages) {
                if (m == null || m.get("content") == null) continue;
                String role = m.get("role");
                if (!"user".equals(role) && !"assistant".equals(role)) continue;
                convo.append("user".equals(role) ? "学生：" : "老师：")
                        .append(m.get("content").trim()).append("\n");
            }
            if (convo.length() == 0) {
                return null;
            }

            Map<String, Object> requestData = new HashMap<>();
            requestData.put("model", aiConfig.getModel());
            requestData.put("temperature", 0.2);
            requestData.put("max_tokens", 400);
            requestData.put("stream", false);
            requestData.put("response_format", Map.of("type", "json_object"));

            List<Map<String, String>> chatMessages = new ArrayList<>();
            chatMessages.add(Map.of("role", "system", "content", SUMMARIZE_PROMPT));
            chatMessages.add(Map.of("role", "user", "content", "对话如下：\n" + convo));
            requestData.put("messages", chatMessages);

            try (Response response = openAIClient.createChatCompletion(requestData)) {
                String body = response.body() != null ? response.body().string() : "";
                if (!response.isSuccessful() || body.isBlank()) {
                    log.warn("记忆总结LLM失败，状态码 {}", response.code());
                    return null;
                }
                JsonNode root = objectMapper.readTree(body);
                JsonNode choices = root.path("choices");
                if (!choices.isArray() || choices.isEmpty()) {
                    return null;
                }
                String content = choices.get(0).path("message").path("content").asText("");
                if (content.isBlank()) {
                    return null;
                }
                JsonNode json = objectMapper.readTree(content);
                String summary = json.path("summary").asText("");
                List<String> topics = new ArrayList<>();
                JsonNode topicsNode = json.path("topics");
                if (topicsNode.isArray()) {
                    topicsNode.forEach(n -> {
                        String t = n.asText("").trim();
                        if (!t.isEmpty()) topics.add(t);
                    });
                }
                return new SummaryResult(summary, topics);
            }
        } catch (Exception e) {
            log.error("记忆总结LLM异常", e);
            return null;
        }
    }

    private List<String> parseJsonArray(String json) {
        if (json == null || json.isBlank()) {
            return new ArrayList<>();
        }
        try {
            JsonNode node = objectMapper.readTree(json);
            if (node.isArray()) {
                List<String> list = new ArrayList<>();
                node.forEach(n -> {
                    String v = n.asText("").trim();
                    if (!v.isEmpty()) list.add(v);
                });
                return list;
            }
        } catch (Exception e) {
            log.debug("解析记忆JSON数组失败：{}", json);
        }
        return new ArrayList<>();
    }

    private String toJsonArray(List<String> list) {
        try {
            return objectMapper.writeValueAsString(list == null ? List.of() : list);
        } catch (Exception e) {
            return "[]";
        }
    }

    public static class MemoryStatus {
        private final boolean hasMemory;
        private final List<String> lastQuestions;
        private final List<String> topics;
        private final String summary;

        public MemoryStatus(boolean hasMemory, List<String> lastQuestions, List<String> topics, String summary) {
            this.hasMemory = hasMemory;
            this.lastQuestions = lastQuestions;
            this.topics = topics;
            this.summary = summary;
        }

        public static MemoryStatus empty() {
            return new MemoryStatus(false, new ArrayList<>(), new ArrayList<>(), null);
        }

        public boolean isHasMemory() { return hasMemory; }
        public List<String> getLastQuestions() { return lastQuestions; }
        public List<String> getTopics() { return topics; }
        public String getSummary() { return summary; }
    }

    public static class SummaryResult {
        private final String summary;
        private final List<String> topics;

        public SummaryResult(String summary, List<String> topics) {
            this.summary = summary;
            this.topics = topics;
        }

        public String getSummary() { return summary; }
        public List<String> getTopics() { return topics; }
    }
}
