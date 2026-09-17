package com.mistake.notebook.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mistake.notebook.entity.LearningReport;
import com.mistake.notebook.entity.MistakeReport;
import com.mistake.notebook.entity.Question;
import com.mistake.notebook.entity.QuestionMark;
import com.mistake.notebook.entity.QuestionNote;
import com.mistake.notebook.entity.QuestionExplanation;
import com.mistake.notebook.repository.QuestionExplanationRepository;
import com.mistake.notebook.repository.LearningReportRepository;
import com.mistake.notebook.repository.MistakeReportRepository;
import com.mistake.notebook.repository.QuestionMarkRepository;
import com.mistake.notebook.repository.QuestionNoteRepository;
import com.mistake.notebook.repository.QuestionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class StudyService {

    private final QuestionRepository questionRepository;
    private final LearningReportRepository learningReportRepository;
    private final MistakeReportRepository mistakeReportRepository;
    private final QuestionMarkRepository questionMarkRepository;
    private final QuestionNoteRepository questionNoteRepository;
    private final QuestionExplanationRepository questionExplanationRepository;
    private final AIAnswerService aiAnswerService;
    private final ObjectMapper objectMapper;

    @Transactional
    public LearningReport generateLearningReport(long userId) {
        List<Question> questions = questionRepository.findByUserIdAndIsDeletedFalseOrderByCreatedAtDesc(userId);
        if (questions.isEmpty()) {
            throw new IllegalArgumentException("至少先整理 1 道错题再生成报告");
        }
        StringBuilder digest = new StringBuilder();
        for (Question q : questions.subList(0, Math.min(30, questions.size()))) {
            digest.append("- [").append(q.getCategory()).append("] ")
                    .append(trim(q.getContent(), 80)).append("\n");
        }
        String content = aiAnswerService.complete(
                "你是学习规划老师。根据学生错题清单写一份个性化学习报告。严格按以下分节输出，每节以【标题】开头独占一行：【总评】【薄弱知识点】【复习建议】【下周计划】。用中文，不要 markdown 代码块，不要用 # 或 * 符号。",
                "共 " + questions.size() + " 道错题：\n" + digest,
                1800
        );
        if (content == null || content.isBlank()) {
            content = "根据你目前整理的 " + questions.size() + " 道错题，建议按科目把高频错因再练一遍，先攻最弱的那一科。";
        }
        LearningReport report = new LearningReport();
        report.setUserId(userId);
        report.setTitle("个性化学习报告");
        report.setOverview("基于 " + questions.size() + " 道错题生成");
        report.setContent(content);
        report.setQuestionCount(questions.size());
        report.setCreatedAt(LocalDateTime.now());
        return learningReportRepository.save(report);
    }

    public List<LearningReport> listLearningReports(long userId) {
        return learningReportRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    public LearningReport getLearningReport(long userId, long id) {
        return learningReportRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new IllegalArgumentException("报告不存在"));
    }

    @Transactional
    public void deleteLearningReport(long userId, long id) {
        LearningReport report = getLearningReport(userId, id);
        learningReportRepository.delete(report);
    }

    @Transactional
    public MistakeReport generateMistakeReport(long userId, long questionId) {
        return generateMistakeReport(userId, List.of(questionId));
    }

    /**
     * 错因深度分析：支持多道错题合成一份报告。
     * 输出用「【标题】正文」分节，前端按节渲染。
     */
    @Transactional
    public MistakeReport generateMistakeReport(long userId, List<Long> questionIds) {
        if (questionIds == null || questionIds.isEmpty()) {
            throw new IllegalArgumentException("请先选择一道错题");
        }
        List<Question> questions = new ArrayList<>();
        for (Long id : questionIds) {
            questionRepository.findByIdAndUserIdAndIsDeletedFalse(id, userId).ifPresent(questions::add);
        }
        if (questions.isEmpty()) {
            throw new IllegalArgumentException("找不到可分析的错题");
        }
        StringBuilder src = new StringBuilder();
        for (int i = 0; i < questions.size(); i++) {
            Question q = questions.get(i);
            src.append("第").append(i + 1).append("题（").append(nullToEmpty(q.getCategory())).append("）：")
                    .append(trim(q.getContent(), 400)).append("\n答案：").append(trim(nullToEmpty(q.getAiAnswer()), 200))
                    .append("\n解析：").append(trim(nullToEmpty(q.getAiAnalysis()), 400)).append("\n\n");
        }
        String system = questions.size() == 1
                ? "你是错因分析老师。学生给你一道错题，请分析这道题为什么容易错。"
                  + "严格按以下分节输出，每节以【标题】开头独占一行：【错因】【薄弱知识点】【订正步骤】【同类提醒】【下一步建议】。"
                  + "用中文，不要 markdown 代码块，不要用 # 或 * 符号。"
                : "你是错因分析老师。学生给你多道错题，请综合分析，找出共性错因与薄弱知识点。"
                  + "严格按以下分节输出，每节以【标题】开头独占一行：【共性错因】【薄弱知识点】【逐题点评】【订正步骤】【同类提醒】【下一步建议】。"
                  + "用中文，不要 markdown 代码块，不要用 # 或 * 符号。";
        String content = aiAnswerService.complete(system, "共 " + questions.size() + " 道错题：\n" + src, 2200);
        if (content == null || content.isBlank()) {
            content = "【订正步骤】建议对照解析逐步复查计算与概念，并再做一道同类题巩固。";
        }
        MistakeReport report = new MistakeReport();
        report.setUserId(userId);
        report.setQuestionId(questions.get(0).getId());
        report.setQuestionIds(questions.stream().map(q -> String.valueOf(q.getId())).reduce((a, b) -> a + "," + b).orElse(""));
        report.setQuestionCount(questions.size());
        report.setTitle(questions.size() + " 道错题深度分析 · " + trim(questions.get(0).getContent(), 14));
        report.setContent(content);
        report.setCreatedAt(LocalDateTime.now());
        return mistakeReportRepository.save(report);
    }

    /**
     * 错题讲解：针对单道题，像老师一样一步步讲。与通用对话助手区分，结果缓存。
     */
    @Transactional
    public QuestionExplanation explainQuestion(long userId, long questionId, boolean refresh) {
        Question q = questionRepository.findByIdAndUserIdAndIsDeletedFalse(questionId, userId)
                .orElseThrow(() -> new IllegalArgumentException("题目不存在"));
        QuestionExplanation existing = questionExplanationRepository.findByUserIdAndQuestionId(userId, questionId).orElse(null);
        if (existing != null && !refresh && existing.getContent() != null && !existing.getContent().isBlank()) {
            return existing;
        }
        String content = aiAnswerService.complete(
                "你是一位耐心的学科老师，给学生逐步讲解一道错题。严格按以下分节输出，每节以【标题】开头独占一行：" +
                "【题目考点】【解题思路】【分步讲解】【易错点】【一句话总结】。" +
                "分步讲解要写清每一步为什么这么做。用中文，不要 markdown 代码块，不要用 # 或 * 符号。",
                "题目：" + q.getContent() + "\n参考答案：" + nullToEmpty(q.getAiAnswer()) + "\n参考解析：" + nullToEmpty(q.getAiAnalysis()),
                1600
        );
        boolean aiFailed = content == null || content.isBlank();
        if (aiFailed) {
            // 模型没返回就不要把占位内容写进缓存，否则用户永远看到这一段
            QuestionExplanation fallback = new QuestionExplanation();
            fallback.setUserId(userId);
            fallback.setQuestionId(questionId);
            fallback.setContent("【解题思路】" + nullToEmpty(q.getAiAnalysis())
                    + "\n【提示】讲解服务暂时没响应，点右上角「重新讲」再试一次。");
            fallback.setCreatedAt(LocalDateTime.now());
            return fallback;
        }
        QuestionExplanation exp = existing != null ? existing : new QuestionExplanation();
        exp.setUserId(userId);
        exp.setQuestionId(questionId);
        exp.setContent(content);
        if (exp.getCreatedAt() == null) exp.setCreatedAt(LocalDateTime.now());
        return questionExplanationRepository.save(exp);
    }

    /**
     * 练习模式：取某分类（或全部）的题目，附带掌握标记
     */
    public List<Map<String, Object>> practiceQuestions(long userId, Long categoryId, boolean onlyUnmastered) {
        List<Question> list = categoryId == null
                ? questionRepository.findByUserIdAndIsDeletedFalseOrderByCreatedAtDesc(userId)
                : questionRepository.findByUserIdAndCategoryIdAndIsDeletedFalseOrderByCreatedAtDesc(userId, categoryId);
        List<Long> ids = list.stream().map(Question::getId).toList();
        Map<Long, QuestionMark> marks = new HashMap<>();
        for (QuestionMark m : listMarks(userId, ids)) marks.put(m.getQuestionId(), m);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Question q : list) {
            QuestionMark m = marks.get(q.getId());
            boolean mastered = m != null && Boolean.TRUE.equals(m.getMastered());
            if (onlyUnmastered && mastered) continue;
            Map<String, Object> row = new HashMap<>();
            row.put("id", q.getId());
            row.put("content", q.getContent());
            row.put("answer", nullToEmpty(q.getAiAnswer()));
            row.put("analysis", nullToEmpty(q.getAiAnalysis()));
            row.put("category", q.getCategory());
            row.put("difficulty", q.getDifficulty() == null ? "medium" : q.getDifficulty().name().toLowerCase());
            row.put("imageUrl", q.getImageUrl());
            row.put("mastered", mastered);
            row.put("favorite", m != null && Boolean.TRUE.equals(m.getFavorite()));
            out.add(row);
        }
        return out;
    }

    public List<MistakeReport> listMistakeReports(long userId) {
        return mistakeReportRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    public MistakeReport getMistakeReport(long userId, long id) {
        return mistakeReportRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new IllegalArgumentException("报告不存在"));
    }

    @Transactional
    public void deleteMistakeReport(long userId, long id) {
        mistakeReportRepository.delete(getMistakeReport(userId, id));
    }

    public List<Map<String, Object>> generateVariants(long userId, List<Long> questionIds) {
        if (questionIds == null || questionIds.isEmpty()) {
            throw new IllegalArgumentException("请先选择一道错题");
        }
        StringBuilder src = new StringBuilder();
        String category = "数学";
        int found = 0;
        for (Long id : questionIds) {
            Question q = questionRepository.findByIdAndUserIdAndIsDeletedFalse(id, userId).orElse(null);
            if (q == null) continue;
            found++;
            category = q.getCategory() == null ? category : q.getCategory();
            src.append(q.getContent()).append("\n\n");
        }
        if (found < 1) {
            throw new IllegalArgumentException("找不到可出变式的错题");
        }
        String raw = aiAnswerService.complete(
                "根据原题出 3 道同类变式题。只输出 JSON，不要 Markdown。格式：{\"variants\":[{\"content\":\"\",\"answer\":\"\",\"analysis\":\"\",\"difficulty\":\"MEDIUM\",\"knowledgePoint\":\"\"}]}",
                src.toString(),
                2200
        );
        List<Map<String, Object>> variants = parseVariants(raw, category);
        if (variants.isEmpty()) {
            log.warn("变式题解析失败，模型原文前 400 字：{}", raw == null ? "" : raw.substring(0, Math.min(400, raw.length())));
            throw new IllegalArgumentException("未能生成变式，请再试一次");
        }
        return variants;
    }

    @Transactional
    public QuestionMark updateMark(long userId, long questionId, Map<String, Object> body) {
        questionRepository.findByIdAndUserIdAndIsDeletedFalse(questionId, userId)
                .orElseThrow(() -> new IllegalArgumentException("题目不存在"));
        QuestionMark mark = questionMarkRepository.findByUserIdAndQuestionId(userId, questionId)
                .orElseGet(() -> {
                    QuestionMark m = new QuestionMark();
                    m.setUserId(userId);
                    m.setQuestionId(questionId);
                    return m;
                });
        if (body.containsKey("favorite")) mark.setFavorite(Boolean.TRUE.equals(body.get("favorite")));
        if (body.containsKey("pinned")) mark.setPinned(Boolean.TRUE.equals(body.get("pinned")));
        if (body.containsKey("mastered")) mark.setMastered(Boolean.TRUE.equals(body.get("mastered")));
        return questionMarkRepository.save(mark);
    }

    public List<QuestionMark> listMarks(long userId, List<Long> questionIds) {
        if (questionIds == null || questionIds.isEmpty()) return List.of();
        return questionMarkRepository.findByUserIdAndQuestionIdIn(userId, questionIds);
    }

    @Transactional
    public QuestionNote saveNote(long userId, long questionId, String content) {
        questionRepository.findByIdAndUserIdAndIsDeletedFalse(questionId, userId)
                .orElseThrow(() -> new IllegalArgumentException("题目不存在"));
        QuestionNote note = questionNoteRepository.findByUserIdAndQuestionId(userId, questionId)
                .orElseGet(() -> {
                    QuestionNote n = new QuestionNote();
                    n.setUserId(userId);
                    n.setQuestionId(questionId);
                    return n;
                });
        note.setContent(content == null ? "" : content);
        return questionNoteRepository.save(note);
    }

    public List<QuestionNote> listNotes(long userId, List<Long> questionIds) {
        if (questionIds == null || questionIds.isEmpty()) return List.of();
        return questionNoteRepository.findByUserIdAndQuestionIdIn(userId, questionIds);
    }

    private List<Map<String, Object>> parseVariants(String raw, String category) {
        List<Map<String, Object>> variants = new ArrayList<>();
        if (raw == null || raw.isBlank()) return variants;
        try {
            String json = raw.trim();
            int objStart = json.indexOf('{');
            int arrStart = json.indexOf('[');
            JsonNode node;
            if (objStart >= 0 && (arrStart < 0 || objStart < arrStart)) {
                int end = json.lastIndexOf('}');
                if (end <= objStart) return variants;
                node = objectMapper.readTree(json.substring(objStart, end + 1));
                if (node.has("variants")) node = node.get("variants");
            } else if (arrStart >= 0) {
                int end = json.lastIndexOf(']');
                if (end <= arrStart) return variants;
                node = objectMapper.readTree(json.substring(arrStart, end + 1));
            } else {
                return variants;
            }
            if (!node.isArray()) return variants;
            for (JsonNode item : node) {
                String content = item.path("content").asText("");
                if (content.isBlank()) continue;
                Map<String, Object> row = new HashMap<>();
                row.put("content", content);
                row.put("answer", item.path("answer").asText(""));
                row.put("analysis", item.path("analysis").asText(""));
                row.put("difficulty", item.path("difficulty").asText("MEDIUM"));
                row.put("knowledgePoint", item.path("knowledgePoint").asText(""));
                row.put("category", category);
                variants.add(row);
            }
        } catch (Exception e) {
            log.warn("变式题 JSON 解析失败: {}", e.getMessage());
        }
        return variants;
    }

    private String trim(String s, int n) {
        String t = s == null ? "" : s.replaceAll("\\s+", " ").trim();
        return t.length() <= n ? t : t.substring(0, n) + "…";
    }

    private String nullToEmpty(String s) {
        return s == null ? "" : s;
    }
}
