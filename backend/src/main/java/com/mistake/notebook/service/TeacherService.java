package com.mistake.notebook.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mistake.notebook.entity.*;
import com.mistake.notebook.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 教师管理后台：学生绑定、留言、班级错题本、作业、家长报告、教学效果分析。
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TeacherService {

    private static final ZoneId CN = ZoneId.of("Asia/Shanghai");

    private final UserRepository userRepository;
    private final TeacherStudentRepository teacherStudentRepository;
    private final TeacherMessageRepository teacherMessageRepository;
    private final ClassNotebookRepository classNotebookRepository;
    private final ClassNotebookProgressRepository classNotebookProgressRepository;
    private final HomeworkRepository homeworkRepository;
    private final HomeworkSubmissionRepository homeworkSubmissionRepository;
    private final ParentReportRepository parentReportRepository;
    private final QuestionRepository questionRepository;
    private final QuestionMarkRepository questionMarkRepository;
    private final QuestionNoteRepository questionNoteRepository;
    private final MistakeReportRepository mistakeReportRepository;
    private final LearningReportRepository learningReportRepository;
    private final CheckinRepository checkinRepository;
    private final TeacherClassRepository teacherClassRepository;
    private final ClassMemberRepository classMemberRepository;
    private final TeacherWorkspaceService teacherWorkspaceService;
    private final AIAnswerService aiAnswerService;
    private final ObjectMapper objectMapper;

    // ───────────────────────── 通用 ─────────────────────────

    public User requireTeacher(long userId) {
        User u = userRepository.findById(userId).orElseThrow(() -> new IllegalArgumentException("用户不存在"));
        if (!"TEACHER".equals(u.getRole())) {
            throw new IllegalArgumentException("仅教师账号可用");
        }
        return u;
    }

    private User requireStudentOf(long teacherId, long studentId) {
        if (teacherStudentRepository.findByTeacherIdAndStudentId(teacherId, studentId).isPresent()) {
            return userRepository.findById(studentId).orElseThrow(() -> new IllegalArgumentException("学生不存在"));
        }
        for (TeacherClass c : teacherClassRepository.findByTeacherIdAndIsDeletedFalseOrderByCreatedAtDesc(teacherId)) {
            Optional<ClassMember> m = classMemberRepository.findByClassIdAndStudentId(c.getId(), studentId);
            if (m.isPresent() && "APPROVED".equals(m.get().getStatus())) {
                return userRepository.findById(studentId).orElseThrow(() -> new IllegalArgumentException("学生不存在"));
            }
        }
        throw new IllegalArgumentException("该学生不在你名下");
    }

    private List<Long> studentIdsOf(long teacherId) {
        LinkedHashSet<Long> ids = new LinkedHashSet<>();
        teacherStudentRepository.findByTeacherIdOrderByCreatedAtDesc(teacherId)
                .forEach(link -> ids.add(link.getStudentId()));
        for (TeacherClass c : teacherClassRepository.findByTeacherIdAndIsDeletedFalseOrderByCreatedAtDesc(teacherId)) {
            classMemberRepository.findByClassIdAndStatusOrderByRequestedAtDesc(c.getId(), "APPROVED")
                    .forEach(m -> ids.add(m.getStudentId()));
        }
        return new ArrayList<>(ids);
    }

    private Map<String, Object> brief(User u) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", u.getId());
        m.put("username", u.getUsername());
        m.put("nickName", u.getNickName());
        m.put("avatarUrl", u.getAvatarUrl());
        m.put("stage", u.getStage());
        m.put("school", u.getSchool());
        m.put("className", u.getClassName());
        m.put("role", u.getRole());
        return m;
    }

    // ───────────────────────── 学生管理 ─────────────────────────

    public Map<String, Object> dashboard(long teacherId) {
        User t = requireTeacher(teacherId);
        List<Long> ids = studentIdsOf(teacherId);
        long totalQuestions = 0;
        long weekQuestions = 0;
        LocalDateTime weekAgo = LocalDateTime.now(CN).minusDays(7);
        for (Long sid : ids) {
            totalQuestions += questionRepository.countByUserIdAndIsDeleted(sid, false);
            weekQuestions += questionRepository.countByUserIdAndCreatedAtAfterAndIsDeleted(sid, weekAgo, false);
        }
        long pendingGrade = 0;
        for (Homework hw : homeworkRepository.findByTeacherIdAndIsDeletedFalseOrderByCreatedAtDesc(teacherId)) {
            pendingGrade += homeworkSubmissionRepository.countByHomeworkIdAndStatus(hw.getId(), "SUBMITTED");
        }
        Map<String, Object> d = new HashMap<>();
        d.put("teacher", brief(t));
        d.put("inviteCode", t.getInviteCode());
        d.put("studentCount", ids.size());
        d.put("totalQuestions", totalQuestions);
        d.put("weekQuestions", weekQuestions);
        d.put("unreadMessages", teacherMessageRepository.countByTeacherIdAndSenderRoleAndReadAtIsNull(teacherId, "STUDENT"));
        d.put("pendingGrade", pendingGrade);
        d.put("notebookCount", classNotebookRepository.findByTeacherIdAndIsDeletedFalseOrderByCreatedAtDesc(teacherId).size());
        d.put("homeworkCount", homeworkRepository.findByTeacherIdAndIsDeletedFalseOrderByCreatedAtDesc(teacherId).size());
        return d;
    }

    public List<Map<String, Object>> listStudents(long teacherId) {
        requireTeacher(teacherId);
        List<Map<String, Object>> out = new ArrayList<>();
        LocalDateTime weekAgo = LocalDateTime.now(CN).minusDays(7);
        for (TeacherStudent link : teacherStudentRepository.findByTeacherIdOrderByCreatedAtDesc(teacherId)) {
            User s = userRepository.findById(link.getStudentId()).orElse(null);
            if (s == null) continue;
            Map<String, Object> row = brief(s);
            row.put("remark", link.getRemark());
            row.put("boundAt", link.getCreatedAt());
            row.put("questionCount", questionRepository.countByUserIdAndIsDeleted(s.getId(), false));
            row.put("weekQuestions", questionRepository.countByUserIdAndCreatedAtAfterAndIsDeleted(s.getId(), weekAgo, false));
            row.put("masteredCount", questionMarkRepository.countByUserIdAndMasteredTrue(s.getId()));
            row.put("checkinStreak", s.getCheckinStreak());
            row.put("checkinTotalDays", s.getCheckinTotalDays());
            row.put("unread", teacherMessageRepository.countByTeacherIdAndStudentIdAndSenderRoleAndReadAtIsNull(teacherId, s.getId(), "STUDENT"));
            out.add(row);
        }
        return out;
    }

    @Transactional
    public Map<String, Object> bindStudentByUsername(long teacherId, String username, String remark) {
        requireTeacher(teacherId);
        User s = userRepository.findByUsername(username == null ? "" : username.trim())
                .orElseThrow(() -> new IllegalArgumentException("找不到这个学生账号"));
        if ("TEACHER".equals(s.getRole())) throw new IllegalArgumentException("不能绑定教师账号");
        if (teacherStudentRepository.findByTeacherIdAndStudentId(teacherId, s.getId()).isPresent()) {
            throw new IllegalArgumentException("这个学生已经在你名下");
        }
        TeacherStudent link = new TeacherStudent();
        link.setTeacherId(teacherId);
        link.setStudentId(s.getId());
        link.setRemark(remark == null ? "" : remark.trim());
        link.setCreatedAt(LocalDateTime.now());
        teacherStudentRepository.save(link);
        List<TeacherClass> classes = teacherClassRepository.findByTeacherIdAndIsDeletedFalseOrderByCreatedAtDesc(teacherId);
        if (classes.isEmpty()) {
            teacherWorkspaceService.ensureClasses(teacherId);
            classes = teacherClassRepository.findByTeacherIdAndIsDeletedFalseOrderByCreatedAtDesc(teacherId);
        }
        if (!classes.isEmpty()) {
            TeacherClass cls = classes.get(0);
            ClassMember member = classMemberRepository.findByClassIdAndStudentId(cls.getId(), s.getId()).orElseGet(() -> {
                ClassMember m = new ClassMember();
                m.setClassId(cls.getId());
                m.setStudentId(s.getId());
                m.setRequestedAt(LocalDateTime.now());
                return m;
            });
            member.setStatus("APPROVED");
            member.setApprovedAt(LocalDateTime.now());
            classMemberRepository.save(member);
        }
        return brief(s);
    }

    @Transactional
    public void unbindStudent(long teacherId, long studentId) {
        requireTeacher(teacherId);
        teacherStudentRepository.findByTeacherIdAndStudentId(teacherId, studentId)
                .ifPresent(teacherStudentRepository::delete);
        for (TeacherClass c : teacherClassRepository.findByTeacherIdAndIsDeletedFalseOrderByCreatedAtDesc(teacherId)) {
            classMemberRepository.findByClassIdAndStudentId(c.getId(), studentId)
                    .ifPresent(classMemberRepository::delete);
        }
    }

    @Transactional
    public void updateRemark(long teacherId, long studentId, String remark) {
        requireTeacher(teacherId);
        TeacherStudent link = teacherStudentRepository.findByTeacherIdAndStudentId(teacherId, studentId)
                .orElseThrow(() -> new IllegalArgumentException("该学生不在你名下"));
        link.setRemark(remark == null ? "" : remark.trim());
        teacherStudentRepository.save(link);
    }

    /** 学生详情：资料 + 统计 + 分类分布 + 最近错题 + 报告数 */
    public Map<String, Object> studentOverview(long teacherId, long studentId) {
        requireTeacher(teacherId);
        User s = requireStudentOf(teacherId, studentId);
        Map<String, Object> d = new HashMap<>();
        d.put("student", brief(s));
        d.put("questionCount", questionRepository.countByUserIdAndIsDeleted(studentId, false));
        d.put("masteredCount", questionMarkRepository.countByUserIdAndMasteredTrue(studentId));
        d.put("favoriteCount", questionMarkRepository.countByUserIdAndFavoriteTrue(studentId));
        d.put("noteCount", questionNoteRepository.countByUserId(studentId));
        d.put("mistakeReportCount", mistakeReportRepository.countByUserId(studentId));
        d.put("learningReportCount", learningReportRepository.countByUserId(studentId));
        d.put("checkinStreak", s.getCheckinStreak());
        d.put("checkinTotalDays", s.getCheckinTotalDays());
        List<Map<String, Object>> cats = new ArrayList<>();
        for (Object[] row : questionRepository.countCategoryByUserId(studentId)) {
            Map<String, Object> c = new HashMap<>();
            c.put("name", row[0] == null ? "未分类" : String.valueOf(row[0]));
            c.put("count", ((Number) row[1]).longValue());
            cats.add(c);
        }
        cats.sort((a, b) -> Long.compare(((Number) b.get("count")).longValue(), ((Number) a.get("count")).longValue()));
        d.put("categories", cats);
        Map<String, Long> diff = new HashMap<>();
        for (Object[] row : questionRepository.countDifficultyByUserId(studentId)) {
            if (row[0] != null) diff.put(String.valueOf(row[0]), ((Number) row[1]).longValue());
        }
        d.put("difficulties", diff);
        List<Question> recent = questionRepository.findByUserIdAndIsDeletedFalseOrderByCreatedAtDesc(studentId);
        d.put("recentQuestions", recent.stream().limit(20).map(this::questionBrief).toList());
        // 近 14 天每日新增
        List<Map<String, Object>> trend = new ArrayList<>();
        LocalDate today = LocalDate.now(CN);
        for (int i = 13; i >= 0; i--) {
            LocalDate day = today.minusDays(i);
            long n = recent.stream().filter(q -> q.getCreatedAt() != null && q.getCreatedAt().toLocalDate().equals(day)).count();
            Map<String, Object> cell = new HashMap<>();
            cell.put("day", day.toString());
            cell.put("count", n);
            cell.put("checked", checkinRepository.findByUserIdAndDayKey(studentId, day.toString()).isPresent());
            trend.add(cell);
        }
        d.put("trend", trend);
        // 作业情况
        List<HomeworkSubmission> subs = homeworkSubmissionRepository.findByStudentId(studentId);
        d.put("homeworkSubmitted", subs.size());
        d.put("homeworkGraded", subs.stream().filter(x -> "GRADED".equals(x.getStatus())).count());
        OptionalDouble avg = subs.stream().filter(x -> x.getScore() != null).mapToInt(HomeworkSubmission::getScore).average();
        d.put("homeworkAvgScore", avg.isPresent() ? Math.round(avg.getAsDouble()) : null);
        return d;
    }

    /** 教师查看学生的全部错题（只读） */
    public List<Map<String, Object>> studentQuestions(long teacherId, long studentId) {
        requireTeacher(teacherId);
        requireStudentOf(teacherId, studentId);
        return questionRepository.findByUserIdAndIsDeletedFalseOrderByCreatedAtDesc(studentId)
                .stream().map(this::questionBrief).toList();
    }

    private Map<String, Object> questionBrief(Question q) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", q.getId());
        m.put("content", q.getContent());
        m.put("category", q.getCategory());
        m.put("difficulty", q.getDifficulty() == null ? "medium" : q.getDifficulty().name().toLowerCase());
        m.put("tags", q.getTags() == null ? List.of() : q.getTags());
        m.put("aiAnswer", q.getAiAnswer());
        m.put("aiAnalysis", q.getAiAnalysis());
        m.put("imageUrl", q.getImageUrl());
        m.put("createdAt", q.getCreatedAt());
        return m;
    }

    // ───────────────────────── 留言 ─────────────────────────

    public List<TeacherMessage> messages(long teacherId, long studentId, boolean asTeacher) {
        List<TeacherMessage> list = teacherMessageRepository.findByTeacherIdAndStudentIdOrderByCreatedAtAsc(teacherId, studentId);
        String otherRole = asTeacher ? "STUDENT" : "TEACHER";
        boolean dirty = false;
        for (TeacherMessage m : list) {
            if (otherRole.equals(m.getSenderRole()) && m.getReadAt() == null) {
                m.setReadAt(LocalDateTime.now());
                dirty = true;
            }
        }
        if (dirty) teacherMessageRepository.saveAll(list);
        return list;
    }

    @Transactional
    public TeacherMessage sendMessage(long teacherId, long studentId, String senderRole, String content) {
        if (content == null || content.trim().isEmpty()) throw new IllegalArgumentException("留言不能为空");
        teacherStudentRepository.findByTeacherIdAndStudentId(teacherId, studentId)
                .orElseThrow(() -> new IllegalArgumentException("师生未绑定"));
        TeacherMessage m = new TeacherMessage();
        m.setTeacherId(teacherId);
        m.setStudentId(studentId);
        m.setSenderRole(senderRole);
        m.setContent(content.trim());
        m.setCreatedAt(LocalDateTime.now());
        return teacherMessageRepository.save(m);
    }

    // ───────────────────────── 班级错题本 ─────────────────────────

    /** 名下学生的高频错题：按知识点标签聚合，附样题 */
    public Map<String, Object> highFrequency(long teacherId) {
        requireTeacher(teacherId);
        List<Long> ids = studentIdsOf(teacherId);
        Map<String, List<Question>> byTag = new LinkedHashMap<>();
        Map<String, Set<Long>> tagStudents = new HashMap<>();
        Map<String, Long> byCategory = new HashMap<>();
        List<Question> all = new ArrayList<>();
        for (Long sid : ids) {
            for (Question q : questionRepository.findByUserIdAndIsDeletedFalseOrderByCreatedAtDesc(sid)) {
                all.add(q);
                byCategory.merge(q.getCategory() == null ? "未分类" : q.getCategory(), 1L, Long::sum);
                List<String> tags = q.getTags() == null || q.getTags().isEmpty() ? List.of(q.getCategory() == null ? "未分类" : q.getCategory()) : q.getTags();
                for (String t : tags) {
                    byTag.computeIfAbsent(t, k -> new ArrayList<>()).add(q);
                    tagStudents.computeIfAbsent(t, k -> new HashSet<>()).add(sid);
                }
            }
        }
        List<Map<String, Object>> hot = new ArrayList<>();
        for (Map.Entry<String, List<Question>> e : byTag.entrySet()) {
            Map<String, Object> row = new HashMap<>();
            row.put("tag", e.getKey());
            row.put("count", e.getValue().size());
            row.put("studentCount", tagStudents.get(e.getKey()).size());
            row.put("samples", e.getValue().stream().limit(6).map(this::questionBrief).toList());
            hot.add(row);
        }
        hot.sort((a, b) -> {
            int c = Integer.compare((int) b.get("studentCount"), (int) a.get("studentCount"));
            return c != 0 ? c : Integer.compare((int) b.get("count"), (int) a.get("count"));
        });
        List<Map<String, Object>> cats = byCategory.entrySet().stream().map(e -> {
            Map<String, Object> m = new HashMap<>();
            m.put("name", e.getKey());
            m.put("count", e.getValue());
            return m;
        }).sorted((a, b) -> Long.compare((long) b.get("count"), (long) a.get("count"))).toList();
        Map<String, Object> d = new HashMap<>();
        d.put("studentCount", ids.size());
        d.put("questionCount", all.size());
        d.put("hotTags", hot.stream().limit(20).toList());
        d.put("categories", cats);
        return d;
    }

    public List<Map<String, Object>> listNotebooks(long teacherId) {
        requireTeacher(teacherId);
        List<Map<String, Object>> out = new ArrayList<>();
        int studentCount = studentIdsOf(teacherId).size();
        for (ClassNotebook nb : classNotebookRepository.findByTeacherIdAndIsDeletedFalseOrderByCreatedAtDesc(teacherId)) {
            Map<String, Object> row = notebookMap(nb, false);
            List<ClassNotebookProgress> progress = classNotebookProgressRepository.findByNotebookId(nb.getId());
            row.put("studentCount", studentCount);
            row.put("startedCount", progress.size());
            row.put("finishedCount", progress.stream().filter(p -> p.getTotalCount() > 0 && p.getDoneCount() >= p.getTotalCount()).count());
            out.add(row);
        }
        return out;
    }

    public Map<String, Object> notebookDetail(long teacherId, long id) {
        requireTeacher(teacherId);
        ClassNotebook nb = classNotebookRepository.findByIdAndTeacherId(id, teacherId)
                .orElseThrow(() -> new IllegalArgumentException("错题本不存在"));
        Map<String, Object> row = notebookMap(nb, true);
        List<Map<String, Object>> progress = new ArrayList<>();
        for (ClassNotebookProgress p : classNotebookProgressRepository.findByNotebookId(id)) {
            User s = userRepository.findById(p.getStudentId()).orElse(null);
            if (s == null) continue;
            Map<String, Object> pm = brief(s);
            pm.put("doneCount", p.getDoneCount());
            pm.put("masteredCount", p.getMasteredCount());
            pm.put("totalCount", p.getTotalCount());
            pm.put("updatedAt", p.getUpdatedAt());
            progress.add(pm);
        }
        row.put("progress", progress);
        return row;
    }

    private Map<String, Object> notebookMap(ClassNotebook nb, boolean withQuestions) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", nb.getId());
        m.put("teacherId", nb.getTeacherId());
        m.put("title", nb.getTitle());
        m.put("description", nb.getDescription());
        m.put("questionCount", nb.getQuestionCount());
        m.put("classId", nb.getClassId());
        m.put("pushedAt", nb.getPushedAt());
        m.put("createdAt", nb.getCreatedAt());
        m.put("updatedAt", nb.getUpdatedAt());
        if (withQuestions) m.put("questions", readList(nb.getQuestionsJson()));
        return m;
    }

    @Transactional
    public Map<String, Object> saveNotebook(long teacherId, Long id, Map<String, Object> body) {
        requireTeacher(teacherId);
        ClassNotebook nb = id == null ? new ClassNotebook()
                : classNotebookRepository.findByIdAndTeacherId(id, teacherId).orElseThrow(() -> new IllegalArgumentException("错题本不存在"));
        String title = String.valueOf(body.getOrDefault("title", "")).trim();
        if (title.isEmpty()) throw new IllegalArgumentException("请填写标题");
        nb.setTeacherId(teacherId);
        nb.setTitle(title.substring(0, Math.min(120, title.length())));
        nb.setDescription(String.valueOf(body.getOrDefault("description", "")));
        List<Map<String, Object>> questions = new ArrayList<>();
        if (body.get("questions") instanceof List<?> raw) {
            for (Object o : raw) {
                if (!(o instanceof Map)) continue;
                @SuppressWarnings("unchecked")
                Map<String, Object> mm = (Map<String, Object>) o;
                Map<String, Object> q = new HashMap<>();
                String content = String.valueOf(mm.getOrDefault("content", "")).trim();
                if (content.isEmpty()) continue;
                q.put("content", content);
                q.put("answer", String.valueOf(mm.getOrDefault("answer", "")));
                q.put("analysis", String.valueOf(mm.getOrDefault("analysis", "")));
                q.put("category", String.valueOf(mm.getOrDefault("category", "")));
                q.put("difficulty", String.valueOf(mm.getOrDefault("difficulty", "medium")));
                q.put("tag", String.valueOf(mm.getOrDefault("tag", "")));
                q.put("sourceQuestionId", mm.get("sourceQuestionId"));
                questions.add(q);
            }
        }
        nb.setQuestionsJson(writeJson(questions));
        nb.setQuestionCount(questions.size());
        if (nb.getCreatedAt() == null) nb.setCreatedAt(LocalDateTime.now());
        nb.setUpdatedAt(LocalDateTime.now());
        nb = classNotebookRepository.save(nb);
        return notebookMap(nb, true);
    }

    @Transactional
    public Map<String, Object> pushNotebook(long teacherId, long id) {
        requireTeacher(teacherId);
        ClassNotebook nb = classNotebookRepository.findByIdAndTeacherId(id, teacherId)
                .orElseThrow(() -> new IllegalArgumentException("错题本不存在"));
        if (nb.getQuestionCount() == null || nb.getQuestionCount() == 0) throw new IllegalArgumentException("先加入题目再推送");
        nb.setPushedAt(LocalDateTime.now());
        classNotebookRepository.save(nb);
        // 推送同时给每个学生留一条消息
        for (Long sid : studentIdsOf(teacherId)) {
            TeacherMessage m = new TeacherMessage();
            m.setTeacherId(teacherId);
            m.setStudentId(sid);
            m.setSenderRole("TEACHER");
            m.setContent("老师推送了班级错题本「" + nb.getTitle() + "」，共 " + nb.getQuestionCount() + " 题，去「班级错题本」练一练吧。");
            m.setCreatedAt(LocalDateTime.now());
            teacherMessageRepository.save(m);
        }
        return notebookMap(nb, false);
    }

    @Transactional
    public void deleteNotebook(long teacherId, long id) {
        requireTeacher(teacherId);
        ClassNotebook nb = classNotebookRepository.findByIdAndTeacherId(id, teacherId)
                .orElseThrow(() -> new IllegalArgumentException("错题本不存在"));
        nb.setIsDeleted(true);
        classNotebookRepository.save(nb);
    }

    // 学生侧
    public List<Map<String, Object>> studentNotebooks(long studentId) {
        LinkedHashMap<Long, Map<String, Object>> uniq = new LinkedHashMap<>();
        List<Long> teacherIds = teacherStudentRepository.findByStudentId(studentId).stream().map(TeacherStudent::getTeacherId).toList();
        if (!teacherIds.isEmpty()) {
            for (ClassNotebook nb : classNotebookRepository.findByTeacherIdInAndIsDeletedFalseAndPushedAtIsNotNullOrderByPushedAtDesc(teacherIds)) {
                uniq.put(nb.getId(), notebookRowForStudent(nb, studentId));
            }
        }
        for (Map<String, Object> row : teacherWorkspaceService.studentClassNotebooks(studentId)) {
            Long id = ((Number) row.get("id")).longValue();
            uniq.putIfAbsent(id, row);
        }
        return new ArrayList<>(uniq.values());
    }

    private Map<String, Object> notebookRowForStudent(ClassNotebook nb, long studentId) {
        Map<String, Object> row = notebookMap(nb, false);
        userRepository.findById(nb.getTeacherId()).ifPresent(t -> row.put("teacherName", t.getNickName()));
        ClassNotebookProgress p = classNotebookProgressRepository.findByNotebookIdAndStudentId(nb.getId(), studentId).orElse(null);
        row.put("doneCount", p == null ? 0 : p.getDoneCount());
        row.put("masteredCount", p == null ? 0 : p.getMasteredCount());
        return row;
    }

    public Map<String, Object> studentNotebookDetail(long studentId, long id) {
        ClassNotebook nb = classNotebookRepository.findById(id).filter(n -> !Boolean.TRUE.equals(n.getIsDeleted()))
                .orElseThrow(() -> new IllegalArgumentException("错题本不存在"));
        boolean linked = teacherStudentRepository.findByTeacherIdAndStudentId(nb.getTeacherId(), studentId).isPresent();
        boolean inClass = nb.getClassId() != null && classMemberRepository.findByClassIdAndStudentId(nb.getClassId(), studentId)
                .filter(m -> "APPROVED".equals(m.getStatus())).isPresent();
        if (!linked && !inClass) throw new IllegalArgumentException("你不在该班级");
        if (nb.getPushedAt() == null && !inClass) throw new IllegalArgumentException("错题本不存在");
        Map<String, Object> row = notebookMap(nb, true);
        if (nb.getQuestionIds() != null && !nb.getQuestionIds().isBlank()) {
            row.put("questions", teacherWorkspaceService.listPickedQuestions(
                    Arrays.stream(nb.getQuestionIds().split(","))
                            .filter(s -> !s.isBlank())
                            .map(Long::valueOf)
                            .toList()));
        }
        ClassNotebookProgress p = classNotebookProgressRepository.findByNotebookIdAndStudentId(id, studentId).orElse(null);
        row.put("doneCount", p == null ? 0 : p.getDoneCount());
        row.put("masteredCount", p == null ? 0 : p.getMasteredCount());
        return row;
    }

    @Transactional
    public ClassNotebookProgress saveProgress(long studentId, long notebookId, int done, int mastered) {
        ClassNotebook nb = classNotebookRepository.findById(notebookId).orElseThrow(() -> new IllegalArgumentException("错题本不存在"));
        ClassNotebookProgress p = classNotebookProgressRepository.findByNotebookIdAndStudentId(notebookId, studentId)
                .orElseGet(() -> {
                    ClassNotebookProgress n = new ClassNotebookProgress();
                    n.setNotebookId(notebookId);
                    n.setStudentId(studentId);
                    return n;
                });
        p.setTotalCount(nb.getQuestionCount());
        p.setDoneCount(Math.min(Math.max(done, p.getDoneCount()), nb.getQuestionCount()));
        p.setMasteredCount(Math.min(Math.max(mastered, 0), nb.getQuestionCount()));
        p.setUpdatedAt(LocalDateTime.now());
        return classNotebookProgressRepository.save(p);
    }

    // ───────────────────────── 作业 ─────────────────────────

    public List<Map<String, Object>> listHomework(long teacherId) {
        requireTeacher(teacherId);
        List<Map<String, Object>> out = new ArrayList<>();
        int studentCount = studentIdsOf(teacherId).size();
        for (Homework hw : homeworkRepository.findByTeacherIdAndIsDeletedFalseOrderByCreatedAtDesc(teacherId)) {
            Map<String, Object> row = homeworkMap(hw, false);
            int target = hw.getStudentIds() == null || hw.getStudentIds().isBlank() ? studentCount : hw.getStudentIds().split(",").length;
            row.put("targetCount", target);
            row.put("submittedCount", homeworkSubmissionRepository.countByHomeworkId(hw.getId()));
            row.put("gradedCount", homeworkSubmissionRepository.countByHomeworkIdAndStatus(hw.getId(), "GRADED"));
            out.add(row);
        }
        return out;
    }

    private Map<String, Object> homeworkMap(Homework hw, boolean withQuestions) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", hw.getId());
        m.put("teacherId", hw.getTeacherId());
        m.put("title", hw.getTitle());
        m.put("description", hw.getDescription());
        m.put("questionCount", hw.getQuestionCount());
        m.put("dueAt", hw.getDueAt());
        m.put("classId", hw.getClassId());
        m.put("createdAt", hw.getCreatedAt());
        m.put("studentIds", hw.getStudentIds() == null || hw.getStudentIds().isBlank() ? List.of()
                : Arrays.stream(hw.getStudentIds().split(",")).map(Long::valueOf).toList());
        if (withQuestions) m.put("questions", readList(hw.getQuestionsJson()));
        return m;
    }

    @Transactional
    public Map<String, Object> createHomework(long teacherId, Map<String, Object> body) {
        requireTeacher(teacherId);
        String title = String.valueOf(body.getOrDefault("title", "")).trim();
        if (title.isEmpty()) throw new IllegalArgumentException("请填写作业标题");
        List<Map<String, Object>> questions = new ArrayList<>();
        if (body.get("questions") instanceof List<?> raw) {
            for (Object o : raw) {
                if (!(o instanceof Map)) continue;
                @SuppressWarnings("unchecked")
                Map<String, Object> mm = (Map<String, Object>) o;
                String content = String.valueOf(mm.getOrDefault("content", "")).trim();
                if (content.isEmpty()) continue;
                Map<String, Object> q = new HashMap<>();
                q.put("content", content);
                q.put("answer", String.valueOf(mm.getOrDefault("answer", "")));
                q.put("analysis", String.valueOf(mm.getOrDefault("analysis", "")));
                Object sc = mm.get("score");
                q.put("score", sc instanceof Number n ? n.intValue() : 10);
                questions.add(q);
            }
        }
        if (questions.isEmpty()) throw new IllegalArgumentException("至少添加一道题");
        Homework hw = new Homework();
        hw.setTeacherId(teacherId);
        hw.setTitle(title.substring(0, Math.min(120, title.length())));
        hw.setDescription(String.valueOf(body.getOrDefault("description", "")));
        hw.setQuestionsJson(writeJson(questions));
        hw.setQuestionCount(questions.size());
        if (body.get("studentIds") instanceof List<?> sids && !sids.isEmpty()) {
            hw.setStudentIds(sids.stream().map(String::valueOf).collect(Collectors.joining(",")));
        }
        if (body.get("dueAt") instanceof String due && !due.isBlank()) {
            try { hw.setDueAt(LocalDateTime.parse(due.length() == 10 ? due + "T23:59:00" : due)); } catch (Exception ignored) {}
        }
        if (body.get("classId") instanceof Number n) hw.setClassId(n.longValue());
        else if (body.get("classId") instanceof String s && !s.isBlank()) {
            try { hw.setClassId(Long.parseLong(s.trim())); } catch (Exception ignored) {}
        }
        hw.setCreatedAt(LocalDateTime.now());
        hw = homeworkRepository.save(hw);
        // 通知学生
        List<Long> targets = hw.getStudentIds() == null || hw.getStudentIds().isBlank() ? studentIdsOf(teacherId)
                : Arrays.stream(hw.getStudentIds().split(",")).map(Long::valueOf).toList();
        for (Long sid : targets) {
            TeacherMessage m = new TeacherMessage();
            m.setTeacherId(teacherId);
            m.setStudentId(sid);
            m.setSenderRole("TEACHER");
            m.setContent("老师布置了新作业「" + hw.getTitle() + "」，共 " + hw.getQuestionCount() + " 题" + (hw.getDueAt() != null ? "，截止 " + hw.getDueAt().toString().replace('T', ' ').substring(0, 16) : "") + "。");
            m.setCreatedAt(LocalDateTime.now());
            teacherMessageRepository.save(m);
        }
        return homeworkMap(hw, true);
    }

    @Transactional
    public void deleteHomework(long teacherId, long id) {
        Homework hw = homeworkRepository.findByIdAndTeacherId(id, teacherId).orElseThrow(() -> new IllegalArgumentException("作业不存在"));
        hw.setIsDeleted(true);
        homeworkRepository.save(hw);
    }

    /** 教师查看作业详情 + 所有提交 */
    public Map<String, Object> homeworkDetail(long teacherId, long id) {
        requireTeacher(teacherId);
        Homework hw = homeworkRepository.findByIdAndTeacherId(id, teacherId).orElseThrow(() -> new IllegalArgumentException("作业不存在"));
        Map<String, Object> row = homeworkMap(hw, true);
        List<Map<String, Object>> subs = new ArrayList<>();
        Set<Long> submitted = new HashSet<>();
        for (HomeworkSubmission s : homeworkSubmissionRepository.findByHomeworkIdOrderBySubmittedAtDesc(id)) {
            submitted.add(s.getStudentId());
            subs.add(submissionMap(s));
        }
        List<Long> targets = hw.getStudentIds() == null || hw.getStudentIds().isBlank() ? studentIdsOf(teacherId)
                : Arrays.stream(hw.getStudentIds().split(",")).map(Long::valueOf).toList();
        List<Map<String, Object>> notSubmitted = new ArrayList<>();
        for (Long sid : targets) {
            if (submitted.contains(sid)) continue;
            userRepository.findById(sid).ifPresent(u -> notSubmitted.add(brief(u)));
        }
        row.put("submissions", subs);
        row.put("notSubmitted", notSubmitted);
        return row;
    }

    private Map<String, Object> submissionMap(HomeworkSubmission s) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", s.getId());
        m.put("homeworkId", s.getHomeworkId());
        m.put("studentId", s.getStudentId());
        userRepository.findById(s.getStudentId()).ifPresent(u -> {
            m.put("studentName", u.getNickName());
            m.put("studentUsername", u.getUsername());
            m.put("avatarUrl", u.getAvatarUrl());
        });
        List<Object> packed = readAnyList(s.getAnswersJson());
        m.put("answers", answerTexts(packed));
        m.put("answerImages", answerImagesFrom(packed));
        m.put("itemScores", readAnyList(s.getItemScoresJson()));
        m.put("status", s.getStatus());
        m.put("score", s.getScore());
        m.put("feedback", s.getFeedback());
        m.put("comment", s.getFeedback());
        m.put("marks", readAnyList(s.getMarksJson()));
        m.put("aiFeedback", s.getAiFeedback());
        m.put("submittedAt", s.getSubmittedAt());
        m.put("gradedAt", s.getGradedAt());
        return m;
    }

    /** 教师批改 */
    @Transactional
    public Map<String, Object> gradeSubmission(long teacherId, long submissionId, Map<String, Object> body) {
        requireTeacher(teacherId);
        HomeworkSubmission s = homeworkSubmissionRepository.findById(submissionId).orElseThrow(() -> new IllegalArgumentException("提交不存在"));
        Homework hw = homeworkRepository.findByIdAndTeacherId(s.getHomeworkId(), teacherId).orElseThrow(() -> new IllegalArgumentException("无权批改"));
        List<Long> targets = hw.getClassId() != null
                ? classMemberRepository.findByClassIdAndStatusOrderByRequestedAtDesc(hw.getClassId(), "APPROVED")
                    .stream().map(ClassMember::getStudentId).toList()
                : studentIdsOf(teacherId);
        if (!targets.contains(s.getStudentId()) && teacherStudentRepository.findByTeacherIdAndStudentId(teacherId, s.getStudentId()).isEmpty()) {
            throw new IllegalArgumentException("无权批改");
        }
        if (body.get("marks") instanceof List<?>) {
            return teacherWorkspaceService.gradeAssignment(teacherId, submissionId, body);
        }
        List<Object> itemScores = new ArrayList<>();
        int total = 0;
        if (body.get("itemScores") instanceof List<?> raw) {
            for (Object o : raw) {
                int v = o instanceof Number n ? n.intValue() : 0;
                itemScores.add(v);
                total += v;
            }
        }
        if (body.get("score") instanceof Number n) total = n.intValue();
        String feedback = String.valueOf(body.getOrDefault("feedback", body.getOrDefault("comment", "")));
        s.setItemScoresJson(writeJson(itemScores));
        s.setScore(total);
        s.setFeedback(feedback);
        s.setStatus("GRADED");
        s.setGradedAt(LocalDateTime.now());
        s = homeworkSubmissionRepository.save(s);
        TeacherMessage m = new TeacherMessage();
        m.setTeacherId(teacherId);
        m.setStudentId(s.getStudentId());
        m.setSenderRole("TEACHER");
        m.setContent("你的作业已批改，得分 " + total + " 分。" + (s.getFeedback().isBlank() ? "" : "老师点评：" + s.getFeedback()));
        m.setCreatedAt(LocalDateTime.now());
        teacherMessageRepository.save(m);
        return submissionMap(s);
    }

    /** AI 预批改：给教师一个逐题评分建议 */
    @Transactional
    public Map<String, Object> aiGrade(long teacherId, long submissionId) {
        requireTeacher(teacherId);
        HomeworkSubmission s = homeworkSubmissionRepository.findById(submissionId).orElseThrow(() -> new IllegalArgumentException("提交不存在"));
        Homework hw = homeworkRepository.findByIdAndTeacherId(s.getHomeworkId(), teacherId).orElseThrow(() -> new IllegalArgumentException("无权批改"));
        List<Map<String, Object>> questions = readList(hw.getQuestionsJson());
        List<Object> answers = readAnyList(s.getAnswersJson());
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < questions.size(); i++) {
            Map<String, Object> q = questions.get(i);
            Object ans = i < answers.size() ? answers.get(i) : "";
            sb.append("第").append(i + 1).append("题（满分").append(q.getOrDefault("score", 10)).append("）\n题目：").append(q.get("content"))
                    .append("\n参考答案：").append(q.getOrDefault("answer", "")).append("\n学生作答：").append(clipAnswerText(ans));
            String img = clipAnswerImage(ans);
            if (!img.isEmpty()) sb.append("\n学生作答图片：").append(img);
            sb.append("\n\n");
        }
        String raw = aiAnswerService.complete(
                "你是作业批改老师。逐题比较学生作答与参考答案，给出每题得分和简短点评。只输出 JSON：{\"items\":[{\"score\":整数,\"comment\":\"\"}],\"summary\":\"总体点评\"}",
                sb.toString(), 1600);
        List<Object> scores = new ArrayList<>();
        String summary = "";
        try {
            String json = raw.substring(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
            var node = objectMapper.readTree(json);
            for (var it : node.path("items")) scores.add(it.path("score").asInt(0));
            summary = node.path("summary").asText("");
            StringBuilder fb = new StringBuilder(summary);
            int i = 1;
            for (var it : node.path("items")) fb.append("\n第").append(i++).append("题：").append(it.path("comment").asText(""));
            s.setAiFeedback(fb.toString());
        } catch (Exception e) {
            s.setAiFeedback(raw == null ? "" : raw);
        }
        homeworkSubmissionRepository.save(s);
        Map<String, Object> d = submissionMap(s);
        d.put("suggestedScores", scores);
        d.put("suggestedSummary", summary);
        return d;
    }

    // 学生侧
    public List<Map<String, Object>> studentHomework(long studentId) {
        LinkedHashSet<Long> teacherIds = new LinkedHashSet<>();
        teacherStudentRepository.findByStudentId(studentId).forEach(l -> teacherIds.add(l.getTeacherId()));
        List<Long> classIds = classMemberRepository.findByStudentIdAndStatus(studentId, "APPROVED")
                .stream().map(ClassMember::getClassId).toList();
        for (Long cid : classIds) {
            teacherClassRepository.findById(cid).ifPresent(c -> teacherIds.add(c.getTeacherId()));
        }
        if (teacherIds.isEmpty() && classIds.isEmpty()) return List.of();
        LinkedHashMap<Long, Homework> uniq = new LinkedHashMap<>();
        if (!teacherIds.isEmpty()) {
            for (Homework hw : homeworkRepository.findByTeacherIdInAndIsDeletedFalseOrderByCreatedAtDesc(new ArrayList<>(teacherIds))) {
                uniq.put(hw.getId(), hw);
            }
        }
        if (!classIds.isEmpty()) {
            for (Homework hw : homeworkRepository.findByClassIdInAndIsDeletedFalseOrderByCreatedAtDesc(classIds)) {
                uniq.put(hw.getId(), hw);
            }
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (Homework hw : uniq.values()) {
            if (hw.getStudentIds() != null && !hw.getStudentIds().isBlank()
                    && Arrays.stream(hw.getStudentIds().split(",")).noneMatch(x -> x.equals(String.valueOf(studentId)))) {
                continue;
            }
            if (hw.getClassId() != null && !classIds.contains(hw.getClassId())) continue;
            Map<String, Object> row = homeworkMap(hw, false);
            userRepository.findById(hw.getTeacherId()).ifPresent(t -> row.put("teacherName", t.getNickName()));
            HomeworkSubmission s = homeworkSubmissionRepository.findByHomeworkIdAndStudentId(hw.getId(), studentId).orElse(null);
            row.put("status", s == null ? "TODO" : s.getStatus());
            row.put("score", s == null ? null : s.getScore());
            row.put("overdue", hw.getDueAt() != null && s == null && hw.getDueAt().isBefore(LocalDateTime.now()));
            out.add(row);
        }
        return out;
    }

    public Map<String, Object> studentHomeworkDetail(long studentId, long id) {
        Homework hw = homeworkRepository.findById(id).filter(h -> !Boolean.TRUE.equals(h.getIsDeleted()))
                .orElseThrow(() -> new IllegalArgumentException("作业不存在"));
        assertCanSeeHomework(studentId, hw);
        Map<String, Object> row = homeworkMap(hw, true);
        HomeworkSubmission s = homeworkSubmissionRepository.findByHomeworkIdAndStudentId(id, studentId).orElse(null);
        if (s != null) {
            row.put("submission", submissionMap(s));
        } else {
            List<Map<String, Object>> qs = readList(hw.getQuestionsJson());
            for (Map<String, Object> q : qs) { q.remove("answer"); q.remove("analysis"); }
            row.put("questions", qs);
        }
        return row;
    }

    @Transactional
    public Map<String, Object> submitHomework(long studentId, long id, List<Object> answers) {
        return submitHomework(studentId, id, answers, List.of());
    }

    @Transactional
    public Map<String, Object> submitHomework(long studentId, long id, List<Object> answers, List<Object> images) {
        Homework hw = homeworkRepository.findById(id).filter(h -> !Boolean.TRUE.equals(h.getIsDeleted()))
                .orElseThrow(() -> new IllegalArgumentException("作业不存在"));
        assertCanSeeHomework(studentId, hw);
        if (hw.getDueAt() != null && LocalDateTime.now().isAfter(hw.getDueAt())) {
            throw new IllegalArgumentException("已过截止时间，不能提交");
        }
        HomeworkSubmission s = homeworkSubmissionRepository.findByHomeworkIdAndStudentId(id, studentId).orElseGet(() -> {
            HomeworkSubmission n = new HomeworkSubmission();
            n.setHomeworkId(id);
            n.setStudentId(studentId);
            n.setSubmittedAt(LocalDateTime.now());
            return n;
        });
        if ("GRADED".equals(s.getStatus())) throw new IllegalArgumentException("作业已批改，不能再修改");
        int n = readList(hw.getQuestionsJson()).size();
        if (n == 0 && hw.getQuestionCount() != null) n = hw.getQuestionCount();
        if (n == 0) n = Math.max(answers == null ? 0 : answers.size(), images == null ? 0 : images.size());
        s.setAnswersJson(writeJson(packAnswers(answers, images, n)));
        s.setStatus("SUBMITTED");
        s.setUpdatedAt(LocalDateTime.now());
        return submissionMap(homeworkSubmissionRepository.save(s));
    }

    private void assertCanSeeHomework(long studentId, Homework hw) {
        if (hw.getClassId() != null) {
            ClassMember m = classMemberRepository.findByClassIdAndStudentId(hw.getClassId(), studentId)
                    .orElseThrow(() -> new IllegalArgumentException("你不在该班级"));
            if ("PENDING".equals(m.getStatus())) throw new IllegalArgumentException("加入申请待老师审核");
            if (!"APPROVED".equals(m.getStatus())) throw new IllegalArgumentException("你不在该班级");
            return;
        }
        teacherStudentRepository.findByTeacherIdAndStudentId(hw.getTeacherId(), studentId)
                .orElseThrow(() -> new IllegalArgumentException("你不在该老师名下"));
    }

    // ───────────────────────── 家长报告 ─────────────────────────

    @Transactional
    public ParentReport generateParentReport(long teacherId, long studentId, String teacherNote) {
        User t = requireTeacher(teacherId);
        User s = requireStudentOf(teacherId, studentId);
        Map<String, Object> ov = studentOverview(teacherId, studentId);
        StringBuilder facts = new StringBuilder();
        facts.append("学生：").append(s.getNickName()).append("，学段：").append(nullToEmpty(s.getStage())).append("\n");
        facts.append("累计错题 ").append(ov.get("questionCount")).append(" 道，已掌握 ").append(ov.get("masteredCount"))
                .append(" 道，笔记 ").append(ov.get("noteCount")).append(" 条，连续打卡 ").append(ov.get("checkinStreak"))
                .append(" 天，累计打卡 ").append(ov.get("checkinTotalDays")).append(" 天\n");
        facts.append("作业：提交 ").append(ov.get("homeworkSubmitted")).append(" 次，平均分 ").append(ov.get("homeworkAvgScore") == null ? "暂无" : ov.get("homeworkAvgScore")).append("\n");
        facts.append("分类分布：");
        for (Object c : (List<?>) ov.get("categories")) {
            Map<?, ?> m = (Map<?, ?>) c;
            facts.append(m.get("name")).append(" ").append(m.get("count")).append(" 道；");
        }
        facts.append("\n最近错题摘要：\n");
        int i = 0;
        for (Object q : (List<?>) ov.get("recentQuestions")) {
            if (i++ >= 8) break;
            Map<?, ?> m = (Map<?, ?>) q;
            facts.append("- [").append(m.get("category")).append("] ").append(trim(String.valueOf(m.get("content")), 60)).append("\n");
        }
        if (teacherNote != null && !teacherNote.isBlank()) facts.append("教师补充：").append(teacherNote).append("\n");
        String content = aiAnswerService.complete(
                "你是班主任，要给家长写一份孩子近期的学习情况报告。语气亲切、客观、鼓励为主，避免专业术语堆砌。" +
                "严格按以下分节输出，每节以【标题】开头独占一行：【整体表现】【学习习惯】【薄弱环节】【老师建议】【家长可以这样配合】。" +
                "用中文，不要 markdown 代码块，不要用 # 或 * 符号。",
                facts.toString(), 1600);
        if (content == null || content.isBlank()) content = "【整体表现】" + facts;
        ParentReport r = new ParentReport();
        r.setTeacherId(teacherId);
        r.setStudentId(studentId);
        r.setTitle(s.getNickName() + " 的学习报告 · " + LocalDate.now(CN));
        r.setContent(content);
        r.setCreatedAt(LocalDateTime.now());
        return parentReportRepository.save(r);
    }

    public List<ParentReport> listParentReports(long teacherId, long studentId) {
        requireTeacher(teacherId);
        return parentReportRepository.findByTeacherIdAndStudentIdOrderByCreatedAtDesc(teacherId, studentId);
    }

    public ParentReport getParentReport(long userId, long id) {
        ParentReport r = parentReportRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("报告不存在"));
        if (!Objects.equals(r.getTeacherId(), userId) && !Objects.equals(r.getStudentId(), userId)) {
            throw new IllegalArgumentException("无权查看");
        }
        return r;
    }

    @Transactional
    public void deleteParentReport(long teacherId, long id) {
        parentReportRepository.findByIdAndTeacherId(id, teacherId).ifPresent(parentReportRepository::delete);
    }

    public List<ParentReport> studentParentReports(long studentId) {
        return parentReportRepository.findByStudentIdOrderByCreatedAtDesc(studentId);
    }

    // ───────────────────────── 教学效果分析 ─────────────────────────

    public Map<String, Object> analytics(long teacherId) {
        requireTeacher(teacherId);
        List<Long> ids = studentIdsOf(teacherId);
        LocalDate today = LocalDate.now(CN);
        long total = 0, mastered = 0, activeWeek = 0, checkedToday = 0;
        Map<String, Long> byCategory = new HashMap<>();
        Map<String, Long> byTag = new HashMap<>();
        List<Map<String, Object>> perStudent = new ArrayList<>();
        long[] daily = new long[14];
        for (Long sid : ids) {
            User s = userRepository.findById(sid).orElse(null);
            if (s == null) continue;
            List<Question> qs = questionRepository.findByUserIdAndIsDeletedFalseOrderByCreatedAtDesc(sid);
            long m = questionMarkRepository.countByUserIdAndMasteredTrue(sid);
            total += qs.size();
            mastered += m;
            boolean active = false;
            for (Question q : qs) {
                byCategory.merge(q.getCategory() == null ? "未分类" : q.getCategory(), 1L, Long::sum);
                if (q.getTags() != null) for (String t : q.getTags()) byTag.merge(t, 1L, Long::sum);
                if (q.getCreatedAt() != null) {
                    long ago = java.time.temporal.ChronoUnit.DAYS.between(q.getCreatedAt().toLocalDate(), today);
                    if (ago >= 0 && ago < 14) daily[13 - (int) ago]++;
                    if (ago >= 0 && ago < 7) active = true;
                }
            }
            if (active) activeWeek++;
            if (checkinRepository.findByUserIdAndDayKey(sid, today.toString()).isPresent()) checkedToday++;
            List<HomeworkSubmission> subs = homeworkSubmissionRepository.findByStudentId(sid);
            OptionalDouble avg = subs.stream().filter(x -> x.getScore() != null).mapToInt(HomeworkSubmission::getScore).average();
            Map<String, Object> row = brief(s);
            row.put("questionCount", qs.size());
            row.put("masteredCount", m);
            row.put("masteryRate", qs.isEmpty() ? 0 : Math.round(m * 100.0 / qs.size()));
            row.put("checkinStreak", s.getCheckinStreak());
            row.put("homeworkAvg", avg.isPresent() ? Math.round(avg.getAsDouble()) : null);
            row.put("homeworkCount", subs.size());
            row.put("activeWeek", active);
            perStudent.add(row);
        }
        perStudent.sort((a, b) -> Long.compare(((Number) b.get("questionCount")).longValue(), ((Number) a.get("questionCount")).longValue()));
        List<Map<String, Object>> trend = new ArrayList<>();
        for (int i = 0; i < 14; i++) {
            Map<String, Object> c = new HashMap<>();
            c.put("day", today.minusDays(13 - i).toString());
            c.put("count", daily[i]);
            trend.add(c);
        }
        // 作业整体
        List<Homework> hws = homeworkRepository.findByTeacherIdAndIsDeletedFalseOrderByCreatedAtDesc(teacherId);
        long subCount = 0; double scoreSum = 0; long scored = 0;
        for (Homework hw : hws) {
            for (HomeworkSubmission s : homeworkSubmissionRepository.findByHomeworkIdOrderBySubmittedAtDesc(hw.getId())) {
                subCount++;
                if (s.getScore() != null) { scoreSum += s.getScore(); scored++; }
            }
        }
        Map<String, Object> d = new HashMap<>();
        d.put("studentCount", ids.size());
        d.put("totalQuestions", total);
        d.put("masteredQuestions", mastered);
        d.put("masteryRate", total == 0 ? 0 : Math.round(mastered * 100.0 / total));
        d.put("activeWeek", activeWeek);
        d.put("checkedToday", checkedToday);
        d.put("homeworkCount", hws.size());
        d.put("submissionCount", subCount);
        d.put("homeworkAvg", scored == 0 ? null : Math.round(scoreSum / scored));
        d.put("categories", sortedCounts(byCategory, 10));
        d.put("hotTags", sortedCounts(byTag, 10));
        d.put("trend", trend);
        d.put("students", perStudent);
        return d;
    }

    private List<Map<String, Object>> sortedCounts(Map<String, Long> src, int limit) {
        return src.entrySet().stream()
                .sorted((a, b) -> Long.compare(b.getValue(), a.getValue()))
                .limit(limit)
                .map(e -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("name", e.getKey());
                    m.put("count", e.getValue());
                    return m;
                }).toList();
    }

    // ───────────────────────── 学生侧：老师 ─────────────────────────

    public List<Map<String, Object>> myTeachers(long studentId) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (TeacherStudent link : teacherStudentRepository.findByStudentId(studentId)) {
            userRepository.findById(link.getTeacherId()).ifPresent(t -> {
                Map<String, Object> row = brief(t);
                row.put("unread", teacherMessageRepository.countByTeacherIdAndStudentIdAndSenderRoleAndReadAtIsNull(t.getId(), studentId, "TEACHER"));
                row.put("boundAt", link.getCreatedAt());
                out.add(row);
            });
        }
        return out;
    }

    @Transactional
    public Map<String, Object> bindTeacher(long studentId, String code) {
        return teacherWorkspaceService.joinClass(studentId, code);
    }

    @Transactional
    public void unbindTeacher(long studentId, long teacherId) {
        teacherStudentRepository.findByTeacherIdAndStudentId(teacherId, studentId).ifPresent(teacherStudentRepository::delete);
        for (TeacherClass c : teacherClassRepository.findByTeacherIdAndIsDeletedFalseOrderByCreatedAtDesc(teacherId)) {
            classMemberRepository.findByClassIdAndStudentId(c.getId(), studentId)
                    .ifPresent(classMemberRepository::delete);
        }
    }

    public long studentUnread(long studentId) {
        return teacherMessageRepository.countByStudentIdAndSenderRoleAndReadAtIsNull(studentId, "TEACHER");
    }

    // ───────────────────────── util ─────────────────────────

    private List<Map<String, Object>> readList(String json) {
        if (json == null || json.isBlank()) return new ArrayList<>();
        try {
            return objectMapper.readValue(json, new TypeReference<List<Map<String, Object>>>() {});
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    private List<Object> readAnyList(String json) {
        if (json == null || json.isBlank()) return new ArrayList<>();
        try {
            return objectMapper.readValue(json, new TypeReference<List<Object>>() {});
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    private String writeJson(Object o) {
        try {
            return objectMapper.writeValueAsString(o);
        } catch (Exception e) {
            return "[]";
        }
    }

    private String clipLen(String s, int n) {
        if (s == null) return "";
        return s.length() <= n ? s : s.substring(0, n);
    }

    private String clipAnswerText(Object v) {
        if (v instanceof Map<?, ?> m) {
            Object t = m.get("text");
            if (t == null) t = m.get("answer");
            if (t == null) t = m.get("value");
            return clipLen(t == null ? "" : String.valueOf(t), 2000);
        }
        return clipLen(v == null ? "" : String.valueOf(v), 2000);
    }

    private String clipAnswerImage(Object v) {
        if (v instanceof Map<?, ?> m) {
            Object t = m.get("image");
            if (t == null) t = m.get("imageFileID");
            if (t == null) t = m.get("url");
            return clipAnswerImage(t);
        }
        String s = v == null ? "" : String.valueOf(v).trim();
        if (s.isEmpty()) return "";
        if (s.startsWith("http://") || s.startsWith("https://") || s.startsWith("cloud://")) {
            return clipLen(s, 600);
        }
        return "";
    }

    private List<Map<String, String>> packAnswers(List<Object> answers, List<Object> images, int n) {
        List<Map<String, String>> out = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            Object a = answers != null && i < answers.size() ? answers.get(i) : "";
            Object img = images != null && i < images.size() ? images.get(i) : "";
            Map<String, String> row = new HashMap<>();
            row.put("text", clipAnswerText(a));
            String image = clipAnswerImage(img);
            if (image.isEmpty()) image = clipAnswerImage(a);
            row.put("image", image);
            out.add(row);
        }
        return out;
    }

    private List<String> answerTexts(List<Object> raw) {
        List<String> out = new ArrayList<>();
        if (raw == null) return out;
        for (Object v : raw) out.add(clipAnswerText(v));
        return out;
    }

    private List<String> answerImagesFrom(List<Object> raw) {
        List<String> out = new ArrayList<>();
        if (raw == null) return out;
        for (Object v : raw) out.add(clipAnswerImage(v));
        return out;
    }

    private String trim(String s, int n) {
        String t = s == null ? "" : s.replaceAll("\\s+", " ").trim();
        return t.length() <= n ? t : t.substring(0, n) + "…";
    }

    private String nullToEmpty(String s) {
        return s == null ? "" : s;
    }
}
