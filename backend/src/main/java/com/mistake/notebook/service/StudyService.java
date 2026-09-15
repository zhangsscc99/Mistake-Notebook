package com.mistake.notebook.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mistake.notebook.entity.LearningReport;
import com.mistake.notebook.entity.MistakeReport;
import com.mistake.notebook.entity.Question;
import com.mistake.notebook.entity.QuestionMark;
import com.mistake.notebook.entity.QuestionNote;
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
                "你是学习规划老师。根据学生错题清单写一份个性化学习报告，用中文，分：总评、薄弱知识点、复习建议、下周计划。不要用 markdown 代码块。",
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
        Question q = questionRepository.findByIdAndUserIdAndIsDeletedFalse(questionId, userId)
                .orElseThrow(() -> new IllegalArgumentException("题目不存在"));
        String content = aiAnswerService.complete(
                "你是错因分析老师。针对这道错题写出：可能错因、关键知识点、订正步骤、同类提醒。用中文，不要代码块。",
                "题目：" + q.getContent() + "\n答案：" + nullToEmpty(q.getAiAnswer()) + "\n解析：" + nullToEmpty(q.getAiAnalysis()),
                1200
        );
        if (content == null || content.isBlank()) content = "建议对照解析逐步复查计算与概念，并再做一道同类题巩固。";
        MistakeReport report = new MistakeReport();
        report.setUserId(userId);
        report.setQuestionId(questionId);
        report.setTitle(trim(q.getContent(), 24));
        report.setContent(content);
        report.setCreatedAt(LocalDateTime.now());
        return mistakeReportRepository.save(report);
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
            throw new IllegalArgumentException("请先选择题目");
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
        if (found == 0) {
            throw new IllegalArgumentException("题目不存在");
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
