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
 * AI 答疑分类长期记忆：profile / preferences / mastery(weaknesses) /
 * mistake_patterns / dialog(lastQuestions+summary) / context(lastQuestionContext)。
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ChatMemoryService {

    private static final int MAX_TOPICS = 12;
    private static final int MAX_LAST_QUESTIONS = 5;
    private static final int MAX_PREFERENCES = 10;
    private static final int MAX_WEAKNESSES = 12;
    private static final int MAX_MISTAKE_PATTERNS = 8;

    private static final String SUMMARIZE_PROMPT = """
            你是错题本学习助手的记忆整理模块。阅读师生对话，按以下六类提炼可长期记忆的信息，严格输出 JSON（不要 markdown）：
            {
              "summary": "一句话概括本次学习重点与困惑",
              "topics": ["知识点1","知识点2"],
              "profile": { "grade": "年级或空字符串", "subject": "学科或空", "goal": "学习目标或空" },
              "preferences": [{ "topic": "偏好主题如讲解方式", "value": "具体偏好" }],
              "weaknesses": [{ "topic": "薄弱知识点", "level": "weak|learning|ok", "note": "简短说明" }],
              "mistake_patterns": [{ "pattern": "常见错误模式", "note": "简短说明" }]
            }
            规则：
            - topics 3-8 个，2-6 字
            - 只输出对话中有依据的内容；没有则对应字段为空对象/空数组
            - weaknesses.level 仅 weak/learning/ok 三档
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
                .map(this::toMemoryStatus)
                .orElse(MemoryStatus.empty());
    }

    private MemoryStatus toMemoryStatus(ChatMemory m) {
        List<String> topics = parseJsonStringArray(m.getTopics());
        List<String> lastQuestions = parseJsonStringArray(m.getLastQuestions());
        Map<String, String> profile = parseProfile(m.getProfile());
        List<Map<String, String>> preferences = parseObjectArray(m.getPreferences());
        List<Map<String, String>> weaknesses = parseObjectArray(m.getWeaknesses());
        List<Map<String, String>> mistakePatterns = parseObjectArray(m.getMistakePatterns());
        boolean hasMemory = hasRecallableMemory(m);
        return new MemoryStatus(
                hasMemory, lastQuestions, topics, m.getSummary(),
                profile, preferences, weaknesses, mistakePatterns
        );
    }

    private boolean hasRecallableMemory(ChatMemory m) {
        if (m == null) return false;
        if (m.getSummary() != null && !m.getSummary().isBlank()) return true;
        if (m.getLastQuestionContext() != null && !m.getLastQuestionContext().isBlank()) return true;
        if (!parseJsonStringArray(m.getLastQuestions()).isEmpty()) return true;
        if (!parseJsonStringArray(m.getTopics()).isEmpty()) return true;
        if (!parseProfile(m.getProfile()).isEmpty()) return true;
        if (!parseObjectArray(m.getPreferences()).isEmpty()) return true;
        if (!parseObjectArray(m.getWeaknesses()).isEmpty()) return true;
        return !parseObjectArray(m.getMistakePatterns()).isEmpty();
    }

    /**
     * L0/L1 分层注入：L0 精简画像+薄弱点，L1 完整分类记忆。
     */
    public String buildMemoryBlock(String clientId) {
        if (clientId == null || clientId.isBlank()) {
            return "";
        }
        Optional<ChatMemory> opt = chatMemoryRepository.findByClientId(clientId);
        if (opt.isEmpty() || !hasRecallableMemory(opt.get())) {
            return "";
        }
        ChatMemory m = opt.get();
        Map<String, String> profile = parseProfile(m.getProfile());
        List<Map<String, String>> weaknesses = parseObjectArray(m.getWeaknesses());
        List<Map<String, String>> preferences = parseObjectArray(m.getPreferences());
        List<Map<String, String>> mistakePatterns = parseObjectArray(m.getMistakePatterns());
        List<String> topics = parseJsonStringArray(m.getTopics());
        List<String> lastQuestions = parseJsonStringArray(m.getLastQuestions());

        StringBuilder sb = new StringBuilder();
        sb.append("""
                
                【长期记忆 · L0 概要（优先参考）】
                当学生问「记得吗/上次问了什么」时，必须引用下方 dialog 段的原话，不要编造。
                """);

        appendProfileLine(sb, profile);
        appendWeaknessL0(sb, weaknesses);

        sb.append("\n【长期记忆 · L1 详情】\n");

        if (!lastQuestions.isEmpty()) {
            sb.append("- dialog·最近提问（原文）：\n");
            for (int i = 0; i < lastQuestions.size(); i++) {
                sb.append("  ").append(i + 1).append(". ").append(lastQuestions.get(i)).append("\n");
            }
        }
        if (m.getLastQuestionContext() != null && !m.getLastQuestionContext().isBlank()) {
            sb.append("- context·上次答疑题目：")
                    .append(truncate(m.getLastQuestionContext(), 300)).append("\n");
        }
        if (m.getSummary() != null && !m.getSummary().isBlank()) {
            sb.append("- dialog·学习摘要：").append(m.getSummary().trim()).append("\n");
        }
        if (!topics.isEmpty()) {
            sb.append("- mastery·涉及知识点：")
                    .append(String.join("、", topics.stream().limit(MAX_TOPICS).toList()))
                    .append("\n");
        }
        appendPreferences(sb, preferences);
        appendWeaknessL1(sb, weaknesses);
        appendMistakePatterns(sb, mistakePatterns);

        return sb.toString();
    }

    private void appendProfileLine(StringBuilder sb, Map<String, String> profile) {
        if (profile.isEmpty()) return;
        List<String> parts = new ArrayList<>();
        if (notBlank(profile.get("grade"))) parts.add(profile.get("grade"));
        if (notBlank(profile.get("subject"))) parts.add(profile.get("subject") + "学科");
        if (notBlank(profile.get("goal"))) parts.add("目标：" + profile.get("goal"));
        if (!parts.isEmpty()) {
            sb.append("- profile·学生画像：").append(String.join("，", parts)).append("\n");
        }
    }

    private void appendWeaknessL0(StringBuilder sb, List<Map<String, String>> weaknesses) {
        List<String> weakTopics = weaknesses.stream()
                .filter(w -> "weak".equalsIgnoreCase(w.get("level")) || "learning".equalsIgnoreCase(w.get("level")))
                .map(w -> w.get("topic"))
                .filter(this::notBlank)
                .limit(3)
                .toList();
        if (!weakTopics.isEmpty()) {
            sb.append("- mastery·需加强：").append(String.join("、", weakTopics)).append("\n");
        }
    }

    private void appendPreferences(StringBuilder sb, List<Map<String, String>> preferences) {
        if (preferences.isEmpty()) return;
        String line = preferences.stream()
                .limit(MAX_PREFERENCES)
                .map(p -> p.getOrDefault("topic", "") + "→" + p.getOrDefault("value", ""))
                .filter(s -> !s.equals("→"))
                .collect(Collectors.joining("；"));
        if (!line.isBlank()) {
            sb.append("- preferences·学习偏好：").append(line).append("\n");
        }
    }

    private void appendWeaknessL1(StringBuilder sb, List<Map<String, String>> weaknesses) {
        if (weaknesses.isEmpty()) return;
        String line = weaknesses.stream()
                .limit(MAX_WEAKNESSES)
                .map(w -> {
                    String topic = w.getOrDefault("topic", "");
                    String level = w.getOrDefault("level", "");
                    String note = w.getOrDefault("note", "");
                    if (topic.isBlank()) return "";
                    return topic + "(" + level + ")" + (note.isBlank() ? "" : "：" + note);
                })
                .filter(s -> !s.isBlank())
                .collect(Collectors.joining("；"));
        if (!line.isBlank()) {
            sb.append("- mastery·知识点掌握：").append(line).append("\n");
        }
    }

    private void appendMistakePatterns(StringBuilder sb, List<Map<String, String>> patterns) {
        if (patterns.isEmpty()) return;
        String line = patterns.stream()
                .limit(MAX_MISTAKE_PATTERNS)
                .map(p -> {
                    String pattern = p.getOrDefault("pattern", "");
                    String note = p.getOrDefault("note", "");
                    if (pattern.isBlank()) return "";
                    return pattern + (note.isBlank() ? "" : "（" + note + "）");
                })
                .filter(s -> !s.isBlank())
                .collect(Collectors.joining("；"));
        if (!line.isBlank()) {
            sb.append("- mistake_patterns·常见失误：").append(line).append("\n");
        }
    }

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
            ChatMemory existing = chatMemoryRepository.findByClientId(clientId).orElse(null);
            ExtractedMemory extracted = summarizeWithLLM(messages, existing);
            saveMemory(clientId, lastQuestions, questionContext, extracted);
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
                              String questionContext, ExtractedMemory extracted) {
        ChatMemory memory = chatMemoryRepository.findByClientId(clientId)
                .orElseGet(() -> {
                    ChatMemory m = new ChatMemory();
                    m.setClientId(clientId);
                    m.setSessionCount(0);
                    return m;
                });

        memory.setLastQuestions(toJsonStringArray(lastQuestions));

        if (questionContext != null && !questionContext.isBlank()) {
            memory.setLastQuestionContext(truncate(questionContext, 500));
        }

        if (extracted != null) {
            if (extracted.summary() != null && !extracted.summary().isBlank()) {
                memory.setSummary(extracted.summary().trim());
            }
            if (extracted.topics() != null && !extracted.topics().isEmpty()) {
                List<String> merged = mergeTopics(parseJsonStringArray(memory.getTopics()), extracted.topics());
                memory.setTopics(toJsonStringArray(merged));
            }
            memory.setProfile(toJson(mergeProfile(parseProfile(memory.getProfile()), extracted.profile())));
            memory.setPreferences(toJson(mergePreferences(
                    parseObjectArray(memory.getPreferences()), extracted.preferences())));
            memory.setWeaknesses(toJson(mergeWeaknesses(
                    parseObjectArray(memory.getWeaknesses()), extracted.weaknesses())));
            memory.setMistakePatterns(toJson(mergeMistakePatterns(
                    parseObjectArray(memory.getMistakePatterns()), extracted.mistakePatterns())));
        }

        memory.setSessionCount((memory.getSessionCount() == null ? 0 : memory.getSessionCount()) + 1);
        chatMemoryRepository.save(memory);
        log.info("分类AI记忆已更新 clientId={}", clientId);
    }

    private Map<String, String> mergeProfile(Map<String, String> existing, Map<String, String> incoming) {
        Map<String, String> merged = new LinkedHashMap<>(existing);
        if (incoming != null) {
            for (String key : List.of("grade", "subject", "goal")) {
                String val = incoming.get(key);
                if (notBlank(val)) {
                    merged.put(key, val.trim());
                }
            }
        }
        return merged;
    }

    private List<Map<String, String>> mergePreferences(
            List<Map<String, String>> existing, List<Map<String, String>> incoming) {
        LinkedHashMap<String, Map<String, String>> map = new LinkedHashMap<>();
        for (Map<String, String> item : existing) {
            String key = preferenceKey(item);
            if (!key.isBlank()) map.put(key, item);
        }
        if (incoming != null) {
            for (Map<String, String> item : incoming) {
                String key = preferenceKey(item);
                if (!key.isBlank()) map.put(key, item);
            }
        }
        return map.values().stream().limit(MAX_PREFERENCES).collect(Collectors.toList());
    }

    private String preferenceKey(Map<String, String> item) {
        return (item.getOrDefault("topic", "") + "|" + item.getOrDefault("value", "")).trim();
    }

    private List<Map<String, String>> mergeWeaknesses(
            List<Map<String, String>> existing, List<Map<String, String>> incoming) {
        LinkedHashMap<String, Map<String, String>> map = new LinkedHashMap<>();
        for (Map<String, String> item : existing) {
            String topic = item.getOrDefault("topic", "").trim();
            if (!topic.isBlank()) map.put(topic, item);
        }
        if (incoming != null) {
            for (Map<String, String> item : incoming) {
                String topic = item.getOrDefault("topic", "").trim();
                if (!topic.isBlank()) map.put(topic, item);
            }
        }
        return map.values().stream().limit(MAX_WEAKNESSES).collect(Collectors.toList());
    }

    private List<Map<String, String>> mergeMistakePatterns(
            List<Map<String, String>> existing, List<Map<String, String>> incoming) {
        LinkedHashMap<String, Map<String, String>> map = new LinkedHashMap<>();
        for (Map<String, String> item : existing) {
            String pattern = item.getOrDefault("pattern", "").trim();
            if (!pattern.isBlank()) map.put(pattern, item);
        }
        if (incoming != null) {
            for (Map<String, String> item : incoming) {
                String pattern = item.getOrDefault("pattern", "").trim();
                if (!pattern.isBlank()) map.put(pattern, item);
            }
        }
        return map.values().stream().limit(MAX_MISTAKE_PATTERNS).collect(Collectors.toList());
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

    private ExtractedMemory summarizeWithLLM(List<Map<String, String>> messages, ChatMemory existing) {
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

            String existingContext = "";
            if (existing != null) {
                existingContext = "【已有记忆摘要】：" + nullToEmpty(existing.getSummary()) + "\n"
                        + "【已有画像】：" + nullToEmpty(existing.getProfile()) + "\n";
            }

            Map<String, Object> requestData = new HashMap<>();
            requestData.put("model", aiConfig.getModel());
            requestData.put("temperature", 0.2);
            requestData.put("max_tokens", 900);
            requestData.put("stream", false);
            requestData.put("response_format", Map.of("type", "json_object"));

            List<Map<String, String>> chatMessages = new ArrayList<>();
            chatMessages.add(Map.of("role", "system", "content", SUMMARIZE_PROMPT));
            chatMessages.add(Map.of("role", "user", "content", existingContext + "本次对话：\n" + convo));
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
                return parseExtractedMemory(objectMapper.readTree(content));
            }
        } catch (Exception e) {
            log.error("记忆总结LLM异常", e);
            return null;
        }
    }

    private ExtractedMemory parseExtractedMemory(JsonNode json) {
        String summary = json.path("summary").asText("").trim();
        List<String> topics = parseStringArrayNode(json.path("topics"));
        Map<String, String> profile = new LinkedHashMap<>();
        JsonNode profileNode = json.path("profile");
        if (profileNode.isObject()) {
            for (String key : List.of("grade", "subject", "goal")) {
                String val = profileNode.path(key).asText("").trim();
                if (!val.isEmpty()) profile.put(key, val);
            }
        }
        List<Map<String, String>> preferences = parsePreferenceArray(json.path("preferences"));
        List<Map<String, String>> weaknesses = parseWeaknessArray(json.path("weaknesses"));
        List<Map<String, String>> mistakePatterns = parsePatternArray(json.path("mistake_patterns"));
        return new ExtractedMemory(summary, topics, profile, preferences, weaknesses, mistakePatterns);
    }

    private List<Map<String, String>> parsePreferenceArray(JsonNode node) {
        List<Map<String, String>> list = new ArrayList<>();
        if (!node.isArray()) return list;
        node.forEach(n -> {
            String topic = n.path("topic").asText("").trim();
            String value = n.path("value").asText("").trim();
            if (!topic.isBlank() && !value.isBlank()) {
                list.add(Map.of("topic", topic, "value", value));
            }
        });
        return list;
    }

    private List<Map<String, String>> parseWeaknessArray(JsonNode node) {
        List<Map<String, String>> list = new ArrayList<>();
        if (!node.isArray()) return list;
        node.forEach(n -> {
            String topic = n.path("topic").asText("").trim();
            if (topic.isBlank()) return;
            String level = n.path("level").asText("learning").trim();
            if (!List.of("weak", "learning", "ok").contains(level)) level = "learning";
            String note = n.path("note").asText("").trim();
            Map<String, String> item = new LinkedHashMap<>();
            item.put("topic", topic);
            item.put("level", level);
            if (!note.isBlank()) item.put("note", note);
            list.add(item);
        });
        return list;
    }

    private List<Map<String, String>> parsePatternArray(JsonNode node) {
        List<Map<String, String>> list = new ArrayList<>();
        if (!node.isArray()) return list;
        node.forEach(n -> {
            String pattern = n.path("pattern").asText("").trim();
            if (pattern.isBlank()) return;
            String note = n.path("note").asText("").trim();
            Map<String, String> item = new LinkedHashMap<>();
            item.put("pattern", pattern);
            if (!note.isBlank()) item.put("note", note);
            list.add(item);
        });
        return list;
    }

    private List<String> parseStringArrayNode(JsonNode node) {
        List<String> list = new ArrayList<>();
        if (!node.isArray()) return list;
        node.forEach(n -> {
            String t = n.asText("").trim();
            if (!t.isEmpty()) list.add(t);
        });
        return list;
    }

    private Map<String, String> parseProfile(String json) {
        if (json == null || json.isBlank()) return new LinkedHashMap<>();
        try {
            JsonNode node = objectMapper.readTree(json);
            Map<String, String> map = new LinkedHashMap<>();
            for (String key : List.of("grade", "subject", "goal")) {
                String val = node.path(key).asText("").trim();
                if (!val.isEmpty()) map.put(key, val);
            }
            return map;
        } catch (Exception e) {
            return new LinkedHashMap<>();
        }
    }

    private List<Map<String, String>> parseObjectArray(String json) {
        if (json == null || json.isBlank()) return new ArrayList<>();
        try {
            JsonNode node = objectMapper.readTree(json);
            if (!node.isArray()) return new ArrayList<>();
            List<Map<String, String>> list = new ArrayList<>();
            node.forEach(n -> {
                Map<String, String> item = new LinkedHashMap<>();
                n.fields().forEachRemaining(entry ->
                        item.put(entry.getKey(), entry.getValue().asText("").trim()));
                if (!item.isEmpty()) list.add(item);
            });
            return list;
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    private List<String> parseJsonStringArray(String json) {
        if (json == null || json.isBlank()) return new ArrayList<>();
        try {
            JsonNode node = objectMapper.readTree(json);
            if (node.isArray()) {
                return parseStringArrayNode(node);
            }
        } catch (Exception e) {
            log.debug("解析记忆JSON数组失败：{}", json);
        }
        return new ArrayList<>();
    }

    private String toJsonStringArray(List<String> list) {
        try {
            return objectMapper.writeValueAsString(list == null ? List.of() : list);
        } catch (Exception e) {
            return "[]";
        }
    }

    private String toJson(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj == null ? Map.of() : obj);
        } catch (Exception e) {
            return obj instanceof List ? "[]" : "{}";
        }
    }

    private boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }

    private String truncate(String text, int maxLen) {
        if (text == null) return "";
        String trimmed = text.trim();
        return trimmed.length() > maxLen ? trimmed.substring(0, maxLen) + "…" : trimmed;
    }

    private String nullToEmpty(String s) {
        return s == null ? "" : s;
    }

    private record ExtractedMemory(
            String summary,
            List<String> topics,
            Map<String, String> profile,
            List<Map<String, String>> preferences,
            List<Map<String, String>> weaknesses,
            List<Map<String, String>> mistakePatterns
    ) {}

    public static class MemoryStatus {
        private final boolean hasMemory;
        private final List<String> lastQuestions;
        private final List<String> topics;
        private final String summary;
        private final Map<String, String> profile;
        private final List<Map<String, String>> preferences;
        private final List<Map<String, String>> weaknesses;
        private final List<Map<String, String>> mistakePatterns;

        public MemoryStatus(
                boolean hasMemory,
                List<String> lastQuestions,
                List<String> topics,
                String summary,
                Map<String, String> profile,
                List<Map<String, String>> preferences,
                List<Map<String, String>> weaknesses,
                List<Map<String, String>> mistakePatterns
        ) {
            this.hasMemory = hasMemory;
            this.lastQuestions = lastQuestions;
            this.topics = topics;
            this.summary = summary;
            this.profile = profile;
            this.preferences = preferences;
            this.weaknesses = weaknesses;
            this.mistakePatterns = mistakePatterns;
        }

        public static MemoryStatus empty() {
            return new MemoryStatus(
                    false, new ArrayList<>(), new ArrayList<>(), null,
                    Map.of(), List.of(), List.of(), List.of()
            );
        }

        public boolean isHasMemory() { return hasMemory; }
        public List<String> getLastQuestions() { return lastQuestions; }
        public List<String> getTopics() { return topics; }
        public String getSummary() { return summary; }
        public Map<String, String> getProfile() { return profile; }
        public List<Map<String, String>> getPreferences() { return preferences; }
        public List<Map<String, String>> getWeaknesses() { return weaknesses; }
        public List<Map<String, String>> getMistakePatterns() { return mistakePatterns; }
    }
}
