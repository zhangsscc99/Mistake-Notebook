package com.mistake.notebook.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mistake.notebook.entity.*;
import com.mistake.notebook.repository.*;
import com.mistake.notebook.util.PaperReadiness;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 对齐小程序教师工作台：多班级、加入审核、题库、组卷、练习/作业、撤回、班级助手。
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TeacherWorkspaceService {

    public static final String PENDING = "PENDING";
    public static final String APPROVED = "APPROVED";
    public static final String REJECTED = "REJECTED";
    public static final String BANK = "teacher_bank";

    private final UserRepository userRepository;
    private final TeacherClassRepository teacherClassRepository;
    private final ClassMemberRepository classMemberRepository;
    private final TeacherStudentRepository teacherStudentRepository;
    private final TeacherPaperRepository teacherPaperRepository;
    private final QuestionRepository questionRepository;
    private final ClassNotebookRepository classNotebookRepository;
    private final HomeworkRepository homeworkRepository;
    private final HomeworkSubmissionRepository homeworkSubmissionRepository;
    private final ParentReportRepository parentReportRepository;
    private final TeacherMessageRepository teacherMessageRepository;
    private final CategorySeedService categorySeedService;
    private final AIAnswerService aiAnswerService;
    private final ObjectMapper objectMapper;

    public User requireTeacher(long userId) {
        User u = userRepository.findById(userId).orElseThrow(() -> new IllegalArgumentException("用户不存在"));
        if (!"TEACHER".equals(u.getRole())) throw new IllegalArgumentException("仅教师账号可用");
        return u;
    }

    private TeacherClass ownedClass(long teacherId, long classId) {
        return teacherClassRepository.findByIdAndTeacherIdAndIsDeletedFalse(classId, teacherId)
                .orElseThrow(() -> new IllegalArgumentException("班级不存在"));
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
        m.put("mark", mark(u.getNickName()));
        return m;
    }

    private String mark(String nick) {
        String n = nick == null || nick.isBlank() ? "学" : nick.trim();
        return n.substring(0, 1);
    }

    private String statusApi(String status) {
        if (APPROVED.equals(status)) return "approved";
        if (REJECTED.equals(status)) return "rejected";
        return "pending";
    }

    /** 把旧的「名下学生」迁进一个默认班，保证老师打开工作台就能用。 */
    @Transactional
    public List<TeacherClass> ensureClasses(long teacherId) {
        requireTeacher(teacherId);
        List<TeacherClass> existing = teacherClassRepository.findByTeacherIdAndIsDeletedFalseOrderByCreatedAtDesc(teacherId);
        if (!existing.isEmpty()) return existing;
        List<TeacherStudent> links = teacherStudentRepository.findByTeacherIdOrderByCreatedAtDesc(teacherId);
        if (links.isEmpty()) return existing;
        User t = userRepository.findById(teacherId).orElseThrow();
        TeacherClass cls = new TeacherClass();
        cls.setTeacherId(teacherId);
        String name = t.getClassName() == null || t.getClassName().isBlank() ? "默认班级" : t.getClassName().trim();
        cls.setName(name);
        cls.setGrade(t.getStage() == null ? "" : t.getStage());
        String invite = t.getInviteCode() == null ? "" : t.getInviteCode().trim().toUpperCase();
        cls.setJoinCode(invite.isBlank() || teacherClassRepository.findByJoinCodeAndIsDeletedFalse(invite).isPresent()
                ? newJoinCode() : invite);
        cls.setIsDeleted(false);
        cls.setCreatedAt(LocalDateTime.now());
        cls = teacherClassRepository.save(cls);
        for (TeacherStudent link : links) {
            ClassMember m = new ClassMember();
            m.setClassId(cls.getId());
            m.setStudentId(link.getStudentId());
            m.setStatus(APPROVED);
            m.setRequestedAt(link.getCreatedAt() == null ? LocalDateTime.now() : link.getCreatedAt());
            m.setApprovedAt(LocalDateTime.now());
            classMemberRepository.save(m);
        }
        return teacherClassRepository.findByTeacherIdAndIsDeletedFalseOrderByCreatedAtDesc(teacherId);
    }

    private String newJoinCode() {
        for (int i = 0; i < 12; i++) {
            String code = UUID.randomUUID().toString().replace("-", "").substring(0, 6).toUpperCase();
            if (teacherClassRepository.findByJoinCodeAndIsDeletedFalse(code).isEmpty()) return code;
        }
        return UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase();
    }

    public Map<String, Object> classMap(TeacherClass c) {
        List<ClassMember> members = classMemberRepository.findByClassId(c.getId());
        long approved = members.stream().filter(m -> APPROVED.equals(m.getStatus())).count();
        long pending = members.stream().filter(m -> PENDING.equals(m.getStatus())).count();
        Map<String, Object> m = new HashMap<>();
        m.put("id", c.getId());
        m.put("name", c.getName());
        m.put("grade", c.getGrade() == null ? "" : c.getGrade());
        m.put("joinCode", c.getJoinCode());
        m.put("studentCount", approved);
        m.put("pendingCount", pending);
        m.put("createdAt", c.getCreatedAt());
        return m;
    }

    public Map<String, Object> dashboard(long teacherId) {
        User t = requireTeacher(teacherId);
        List<TeacherClass> classes = ensureClasses(teacherId);
        List<Map<String, Object>> classMaps = classes.stream().map(this::classMap).toList();
        TeacherClass selected = classes.isEmpty() ? null : classes.get(0);
        List<Map<String, Object>> students = selected == null ? List.of() : listStudents(teacherId, selected.getId());
        List<Map<String, Object>> pending = selected == null ? List.of() : joinRequests(teacherId, selected.getId());
        long assignmentCount = homeworkRepository.findByTeacherIdAndIsDeletedFalseOrderByCreatedAtDesc(teacherId).size();
        long notebookCount = classNotebookRepository.findByTeacherIdAndIsDeletedFalseOrderByCreatedAtDesc(teacherId).size();
        Map<String, Object> d = new HashMap<>();
        d.put("teacher", brief(t));
        d.put("inviteCode", t.getInviteCode());
        d.put("classes", classMaps);
        d.put("students", students);
        d.put("pendingStudents", pending);
        d.put("studentCount", classMaps.stream().mapToLong(c -> ((Number) c.get("studentCount")).longValue()).sum());
        d.put("pendingCount", classMaps.stream().mapToLong(c -> ((Number) c.get("pendingCount")).longValue()).sum());
        d.put("assignmentCount", assignmentCount);
        d.put("notebookCount", notebookCount);
        return d;
    }

    @Transactional
    public Map<String, Object> createClass(long teacherId, String name, String grade) {
        requireTeacher(teacherId);
        String n = name == null ? "" : name.trim();
        if (n.isEmpty()) throw new IllegalArgumentException("请输入班级名称");
        TeacherClass cls = new TeacherClass();
        cls.setTeacherId(teacherId);
        cls.setName(n.substring(0, Math.min(80, n.length())));
        cls.setGrade(grade == null ? "" : grade.trim());
        cls.setJoinCode(newJoinCode());
        cls.setIsDeleted(false);
        cls.setCreatedAt(LocalDateTime.now());
        return classMap(teacherClassRepository.save(cls));
    }

    public List<Map<String, Object>> listClasses(long teacherId) {
        return ensureClasses(teacherId).stream().map(this::classMap).toList();
    }

    public List<Long> approvedStudentIds(long classId) {
        return classMemberRepository.findByClassIdAndStatusOrderByRequestedAtDesc(classId, APPROVED)
                .stream().map(ClassMember::getStudentId).toList();
    }

    public List<Map<String, Object>> listStudents(long teacherId, long classId) {
        ownedClass(teacherId, classId);
        List<Map<String, Object>> out = new ArrayList<>();
        for (ClassMember m : classMemberRepository.findByClassIdAndStatusOrderByRequestedAtDesc(classId, APPROVED)) {
            userRepository.findById(m.getStudentId()).ifPresent(u -> {
                Map<String, Object> row = brief(u);
                row.put("questionCount", questionRepository.countByUserIdAndIsDeleted(u.getId(), false));
                row.put("joinedAt", m.getApprovedAt() == null ? m.getRequestedAt() : m.getApprovedAt());
                out.add(row);
            });
        }
        return out;
    }

    public List<Map<String, Object>> joinRequests(long teacherId, long classId) {
        ownedClass(teacherId, classId);
        List<Map<String, Object>> out = new ArrayList<>();
        for (ClassMember m : classMemberRepository.findByClassIdAndStatusOrderByRequestedAtDesc(classId, PENDING)) {
            userRepository.findById(m.getStudentId()).ifPresent(u -> {
                Map<String, Object> row = brief(u);
                row.put("requestedAt", m.getRequestedAt());
                out.add(row);
            });
        }
        return out;
    }

    @Transactional
    public Map<String, Object> approveJoin(long teacherId, long classId, long studentId) {
        ownedClass(teacherId, classId);
        ClassMember m = classMemberRepository.findByClassIdAndStudentId(classId, studentId)
                .orElseThrow(() -> new IllegalArgumentException("没有这条申请"));
        if (APPROVED.equals(m.getStatus())) {
            return Map.of("classId", classId, "studentId", studentId, "alreadyJoined", true);
        }
        m.setStatus(APPROVED);
        m.setApprovedAt(LocalDateTime.now());
        classMemberRepository.save(m);
        if (teacherStudentRepository.findByTeacherIdAndStudentId(teacherId, studentId).isEmpty()) {
            TeacherStudent link = new TeacherStudent();
            link.setTeacherId(teacherId);
            link.setStudentId(studentId);
            link.setCreatedAt(LocalDateTime.now());
            teacherStudentRepository.save(link);
        }
        return Map.of("classId", classId, "studentId", studentId);
    }

    @Transactional
    public Map<String, Object> rejectJoin(long teacherId, long classId, long studentId) {
        ownedClass(teacherId, classId);
        ClassMember m = classMemberRepository.findByClassIdAndStudentId(classId, studentId)
                .orElseThrow(() -> new IllegalArgumentException("没有这条申请"));
        if (APPROVED.equals(m.getStatus())) throw new IllegalArgumentException("该学生已在班级中");
        m.setStatus(REJECTED);
        classMemberRepository.save(m);
        return Map.of("classId", classId, "studentId", studentId);
    }

    private void assertApprovedMember(long classId, long studentId) {
        ClassMember m = classMemberRepository.findByClassIdAndStudentId(classId, studentId)
                .orElseThrow(() -> new IllegalArgumentException("学生不在该班级"));
        if (PENDING.equals(m.getStatus())) throw new IllegalArgumentException("加入申请待老师审核");
        if (!APPROVED.equals(m.getStatus())) throw new IllegalArgumentException("学生不在该班级");
    }

    public Map<String, Object> studentOverview(long teacherId, long classId, long studentId) {
        TeacherClass cls = ownedClass(teacherId, classId);
        assertApprovedMember(classId, studentId);
        User s = userRepository.findById(studentId).orElseThrow(() -> new IllegalArgumentException("学生不存在"));
        List<Question> qs = questionRepository.findByUserIdAndIsDeletedFalseOrderByCreatedAtDesc(studentId);
        Map<String, Long> catMap = new LinkedHashMap<>();
        for (Question q : qs) {
            String cat = q.getCategory() == null || q.getCategory().isBlank() ? "未分类" : q.getCategory();
            catMap.merge(cat, 1L, Long::sum);
        }
        int total = qs.size();
        List<Map<String, Object>> categories = catMap.entrySet().stream()
                .sorted((a, b) -> Long.compare(b.getValue(), a.getValue()))
                .map(e -> {
                    Map<String, Object> c = new HashMap<>();
                    c.put("name", e.getKey());
                    c.put("count", e.getValue());
                    c.put("pct", total == 0 ? 0 : Math.round(e.getValue() * 100.0 / total));
                    return c;
                }).toList();
        List<Homework> assignments = homeworkRepository.findByClassIdAndIsDeletedFalseOrderByCreatedAtDesc(classId);
        List<Map<String, Object>> homework = new ArrayList<>();
        int submittedCount = 0;
        int missingCount = 0;
        for (Homework hw : assignments) {
            HomeworkSubmission sub = homeworkSubmissionRepository.findByHomeworkIdAndStudentId(hw.getId(), studentId).orElse(null);
            Map<String, Object> row = new HashMap<>();
            row.put("id", hw.getId());
            row.put("title", hw.getTitle());
            row.put("questionCount", hw.getQuestionCount());
            row.put("dueAt", hw.getDueAt());
            String statusKey = "missing";
            String status = "未交";
            Integer score = null;
            if (sub != null) {
                submittedCount++;
                if ("GRADED".equals(sub.getStatus())) {
                    statusKey = "graded";
                    status = sub.getScore() == null ? "已批改" : ("已批改 " + sub.getScore() + "分");
                    score = sub.getScore();
                } else {
                    statusKey = "submitted";
                    status = "已交待批";
                }
            } else {
                missingCount++;
            }
            row.put("status", status);
            row.put("statusKey", statusKey);
            row.put("score", score);
            homework.add(row);
        }
        Map<String, Object> student = brief(s);
        ClassMember member = classMemberRepository.findByClassIdAndStudentId(classId, studentId).orElse(null);
        if (member != null) student.put("joinedAt", member.getApprovedAt() == null ? member.getRequestedAt() : member.getApprovedAt());
        Map<String, Object> d = new HashMap<>();
        d.put("student", student);
        d.put("className", cls.getName());
        d.put("classId", classId);
        d.put("questionCount", total);
        d.put("assignmentCount", homework.size());
        d.put("submittedCount", submittedCount);
        d.put("missingCount", missingCount);
        d.put("categories", categories);
        d.put("weak", categories.stream().limit(3).toList());
        d.put("questions", qs.stream().limit(100).map(this::questionMap).toList());
        d.put("homework", homework);
        return d;
    }

    public List<Map<String, Object>> studentQuestions(long teacherId, long classId, long studentId) {
        ownedClass(teacherId, classId);
        assertApprovedMember(classId, studentId);
        return questionRepository.findByUserIdAndIsDeletedFalseOrderByCreatedAtDesc(studentId)
                .stream().limit(80).map(this::questionMap).toList();
    }

    public Map<String, Object> teacherQuestions(long teacherId, Long classId) {
        List<TeacherClass> classes = ensureClasses(teacherId);
        if (classes.isEmpty()) return Map.of("classId", "", "questions", List.of(), "stats", List.of());
        long target = classId != null && classes.stream().anyMatch(c -> c.getId().equals(classId))
                ? classId : classes.get(0).getId();
        List<Long> studentIds = approvedStudentIds(target);
        List<Question> rows = studentIds.isEmpty()
                ? List.of()
                : questionRepository.findByUserIdInAndIsDeletedFalseOrderByCreatedAtDesc(studentIds);
        Map<Long, String> names = new HashMap<>();
        for (Long sid : studentIds) {
            userRepository.findById(sid).ifPresent(u -> names.put(sid, u.getNickName() == null ? "" : u.getNickName()));
        }
        List<Map<String, Object>> questions = new ArrayList<>();
        for (Question q : rows) {
            if (BANK.equals(q.getSource())) continue;
            Map<String, Object> m = questionMap(q);
            m.put("nickName", names.getOrDefault(q.getUserId(), "未设置昵称"));
            questions.add(m);
        }
        Map<String, Object> d = new HashMap<>();
        d.put("classId", target);
        d.put("questions", questions);
        return d;
    }

    public List<Map<String, Object>> listBank(long teacherId, Long classId) {
        requireTeacher(teacherId);
        return questionRepository.findByUserIdAndSourceAndIsDeletedFalseOrderByCreatedAtDesc(teacherId, BANK)
                .stream().map(q -> {
                    Map<String, Object> m = questionMap(q);
                    m.put("nickName", "老师录入");
                    return m;
                }).toList();
    }

    @Transactional
    public Map<String, Object> saveBankQuestions(long teacherId, Map<String, Object> body) {
        requireTeacher(teacherId);
        Object raw = body.get("questions");
        if (!(raw instanceof List<?> items) || items.isEmpty()) throw new IllegalArgumentException("请选择题目");
        String category = String.valueOf(body.getOrDefault("category", "")).trim();
        if (category.isEmpty()) category = "未分类";
        Question.DifficultyLevel difficulty = parseDifficulty(body.get("difficulty"));
        Category cat = categorySeedService.findForUser(teacherId, category);
        List<Long> ids = new ArrayList<>();
        int saved = 0;
        for (Object o : items) {
            if (saved >= 40) break;
            if (!(o instanceof Map<?, ?> mm)) continue;
            String content = firstText(mm.get("text"), mm.get("content"));
            if (content.isBlank()) continue;
            Question q = new Question();
            q.setUserId(teacherId);
            q.setClassId(null);
            q.setSource(BANK);
            q.setContent(content);
            q.setImageUrl(firstText(mm.get("imageUrl"), body.get("imageUrl")));
            q.setCategory(category);
            q.setCategoryId(cat == null ? 1L : cat.getId());
            q.setDifficulty(difficulty);
            List<String> tags = new ArrayList<>();
            String type = firstText(mm.get("type"));
            String subject = firstText(mm.get("subject"));
            if (!type.isBlank()) tags.add(type);
            if (!subject.isBlank()) tags.add(subject);
            q.setTags(tags);
            if (mm.get("confidence") instanceof Number n) q.setOcrConfidence(n.doubleValue());
            q.setAiStatus(Question.AiStatus.COMPLETED);
            q.setIsDeleted(false);
            q.setCreatedAt(LocalDateTime.now());
            q.setUpdatedAt(LocalDateTime.now());
            q = questionRepository.save(q);
            ids.add(q.getId());
            saved++;
        }
        if (ids.isEmpty()) throw new IllegalArgumentException("没有可保存的题目");
        Map<String, Object> d = new HashMap<>();
        d.put("ids", ids);
        d.put("savedCount", ids.size());
        return d;
    }

    @Transactional
    public void deleteBankQuestion(long teacherId, long id) {
        Question q = questionRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("题目不存在"));
        if (Boolean.TRUE.equals(q.getIsDeleted())) throw new IllegalArgumentException("题目不存在");
        Long owner = q.getUserId();
        if (owner == null || owner != teacherId || !BANK.equals(q.getSource())) {
            throw new IllegalArgumentException("无权删除");
        }
        q.setIsDeleted(true);
        questionRepository.save(q);
    }

    public List<Map<String, Object>> listPickedQuestions(List<Long> ids) {
        if (ids == null || ids.isEmpty()) return List.of();
        Map<Long, Question> byId = questionRepository.findByIdInAndIsDeletedFalse(ids).stream()
                .collect(Collectors.toMap(Question::getId, q -> q, (a, b) -> a));
        List<Map<String, Object>> out = new ArrayList<>();
        for (Long id : ids) {
            Question q = byId.get(id);
            if (q != null) out.add(questionMap(q));
        }
        return out;
    }

    public Map<String, Object> classStats(long teacherId, Long classId) {
        List<TeacherClass> classes = ensureClasses(teacherId);
        if (classes.isEmpty()) {
            return Map.of("classId", "", "total", 0, "byCategory", List.of(), "hot", List.of(), "studentCount", 0);
        }
        long target = classId != null && classes.stream().anyMatch(c -> c.getId().equals(classId))
                ? classId : classes.get(0).getId();
        List<Long> studentIds = approvedStudentIds(target);
        List<Question> rows = studentIds.isEmpty()
                ? List.of()
                : questionRepository.findByUserIdInAndIsDeletedFalseOrderByCreatedAtDesc(studentIds)
                .stream().filter(q -> !BANK.equals(q.getSource())).limit(200).toList();
        Map<String, Long> catMap = new HashMap<>();
        Map<String, Map<String, Object>> hotMap = new LinkedHashMap<>();
        for (Question q : rows) {
            String cat = q.getCategory() == null || q.getCategory().isBlank() ? "未分类" : q.getCategory();
            catMap.merge(cat, 1L, Long::sum);
            String key = contentKey(q.getContent());
            if (key.isBlank()) key = String.valueOf(q.getId());
            Map<String, Object> item = hotMap.computeIfAbsent(key, k -> {
                Map<String, Object> h = new HashMap<>();
                h.put("content", q.getContent() == null ? "" : q.getContent());
                h.put("category", cat);
                h.put("difficulty", q.getDifficulty() == null ? "MEDIUM" : q.getDifficulty().name());
                h.put("count", 0);
                h.put("questionIds", new ArrayList<Long>());
                h.put("students", new HashSet<Long>());
                return h;
            });
            item.put("count", ((Number) item.get("count")).intValue() + 1);
            @SuppressWarnings("unchecked")
            List<Long> qids = (List<Long>) item.get("questionIds");
            qids.add(q.getId());
            @SuppressWarnings("unchecked")
            Set<Long> students = (Set<Long>) item.get("students");
            if (q.getUserId() != null) students.add(q.getUserId());
        }
        List<Map<String, Object>> byCategory = catMap.entrySet().stream()
                .sorted((a, b) -> Long.compare(b.getValue(), a.getValue()))
                .map(e -> {
                    Map<String, Object> c = new HashMap<>();
                    c.put("name", e.getKey());
                    c.put("count", e.getValue());
                    return c;
                }).toList();
        List<Map<String, Object>> hot = hotMap.values().stream()
                .sorted((a, b) -> {
                    int cmp = Integer.compare(((Number) b.get("count")).intValue(), ((Number) a.get("count")).intValue());
                    if (cmp != 0) return cmp;
                    return Integer.compare(((Set<?>) b.get("students")).size(), ((Set<?>) a.get("students")).size());
                })
                .limit(20)
                .map(item -> {
                    Map<String, Object> h = new HashMap<>();
                    h.put("content", item.get("content"));
                    h.put("category", item.get("category"));
                    h.put("difficulty", item.get("difficulty"));
                    h.put("count", item.get("count"));
                    @SuppressWarnings("unchecked")
                    Set<Long> students = (Set<Long>) item.get("students");
                    h.put("studentCount", students.size());
                    @SuppressWarnings("unchecked")
                    List<Long> qids = (List<Long>) item.get("questionIds");
                    h.put("questionId", qids.isEmpty() ? null : qids.get(0));
                    h.put("questionIds", qids);
                    return h;
                }).toList();
        Map<String, Object> d = new HashMap<>();
        d.put("classId", target);
        d.put("total", rows.size());
        d.put("studentCount", studentIds.size());
        d.put("byCategory", byCategory);
        d.put("hot", hot);
        return d;
    }

    @Transactional
    public Map<String, Object> publishNotebook(long teacherId, Map<String, Object> body) {
        long classId = asLong(body.get("classId"));
        ownedClass(teacherId, classId);
        String title = String.valueOf(body.getOrDefault("title", "班级错题练习")).trim();
        if (title.isEmpty()) title = "班级错题练习";
        List<Long> ids = asIdList(body.get("questionIds"));
        if (ids.isEmpty() && body.get("paperId") != null) {
            long paperId = asLong(body.get("paperId"));
            TeacherPaper p = teacherPaperRepository.findByIdAndTeacherId(paperId, teacherId)
                    .filter(x -> !Boolean.TRUE.equals(x.getIsDeleted()))
                    .orElseThrow(() -> new IllegalArgumentException("无权使用该试卷"));
            ids = parseIdCsv(p.getQuestionIds());
        }
        if (ids.isEmpty()) throw new IllegalArgumentException("请选择题目");
        List<Map<String, Object>> questions = snapshotQuestions(ids);
        ClassNotebook nb = new ClassNotebook();
        nb.setTeacherId(teacherId);
        nb.setClassId(classId);
        nb.setTitle(title.substring(0, Math.min(120, title.length())));
        nb.setQuestionIds(ids.stream().map(String::valueOf).collect(Collectors.joining(",")));
        nb.setQuestionsJson(writeJson(questions));
        nb.setQuestionCount(questions.size());
        nb.setPushedAt(LocalDateTime.now());
        nb.setIsDeleted(false);
        nb.setCreatedAt(LocalDateTime.now());
        nb.setUpdatedAt(LocalDateTime.now());
        nb = classNotebookRepository.save(nb);
        notifyClass(teacherId, classId, "老师发了新练习「" + nb.getTitle() + "」，共 " + nb.getQuestionCount() + " 题。");
        Map<String, Object> d = new HashMap<>();
        d.put("id", nb.getId());
        d.put("title", nb.getTitle());
        d.put("questionCount", nb.getQuestionCount());
        d.put("createdAt", nb.getCreatedAt());
        return d;
    }

    @Transactional
    public Map<String, Object> savePaper(long teacherId, Map<String, Object> body) {
        requireTeacher(teacherId);
        String title = String.valueOf(body.getOrDefault("title", "班级试卷")).trim();
        if (title.isEmpty()) title = "班级试卷";
        List<Long> ids = asIdList(body.get("questionIds"));
        if (ids.isEmpty()) throw new IllegalArgumentException("请选择题目");
        List<Question> picked = questionRepository.findByIdInAndIsDeletedFalse(ids);
        Map<Long, Question> byId = picked.stream().collect(Collectors.toMap(Question::getId, q -> q, (a, b) -> a));
        for (Long id : ids) {
            Question q = byId.get(id);
            if (q == null) throw new IllegalArgumentException("题目不存在");
            if (!PaperReadiness.forTeacherPaper(q)) {
                throw new IllegalArgumentException("未解析完成的题目不能加入组卷");
            }
        }
        TeacherPaper p = new TeacherPaper();
        p.setTeacherId(teacherId);
        p.setClassId(null);
        p.setTitle(title.substring(0, Math.min(120, title.length())));
        p.setQuestionIds(ids.stream().map(String::valueOf).collect(Collectors.joining(",")));
        p.setQuestionCount(ids.size());
        Object dur = body.get("duration");
        p.setDuration(dur instanceof Number n ? n.intValue() : 90);
        p.setIsDeleted(false);
        p.setCreatedAt(LocalDateTime.now());
        p = teacherPaperRepository.save(p);
        Map<String, Object> d = new HashMap<>();
        d.put("id", p.getId());
        d.put("title", p.getTitle());
        d.put("questionCount", p.getQuestionCount());
        d.put("createdAt", p.getCreatedAt());
        return d;
    }

    @Transactional
    public Map<String, Object> updatePaper(long teacherId, long paperId, Map<String, Object> body) {
        TeacherPaper p = teacherPaperRepository.findByIdAndTeacherId(paperId, teacherId)
                .filter(x -> !Boolean.TRUE.equals(x.getIsDeleted()))
                .orElseThrow(() -> new IllegalArgumentException("无权修改该试卷"));
        List<Long> incoming = asIdList(body.get("questionIds"));
        if (incoming.isEmpty()) throw new IllegalArgumentException("请选择题目");
        List<Long> merged = new ArrayList<>(parseIdCsv(p.getQuestionIds()));
        for (Long id : incoming) {
            if (!merged.contains(id)) merged.add(id);
        }
        List<Question> picked = questionRepository.findByIdInAndIsDeletedFalse(merged);
        Map<Long, Question> byId = picked.stream().collect(Collectors.toMap(Question::getId, q -> q, (a, b) -> a));
        for (Long id : merged) {
            Question q = byId.get(id);
            if (q == null) throw new IllegalArgumentException("题目不存在");
            if (!PaperReadiness.forTeacherPaper(q)) {
                throw new IllegalArgumentException("未解析完成的题目不能加入组卷");
            }
        }
        p.setQuestionIds(merged.stream().map(String::valueOf).collect(Collectors.joining(",")));
        p.setQuestionCount(merged.size());
        teacherPaperRepository.save(p);
        Map<String, Object> d = new HashMap<>();
        d.put("id", p.getId());
        d.put("title", p.getTitle());
        d.put("questionCount", p.getQuestionCount());
        d.put("createdAt", p.getCreatedAt());
        return d;
    }

    public List<Map<String, Object>> listPapers(long teacherId, Long classId) {
        requireTeacher(teacherId);
        List<TeacherPaper> list = teacherPaperRepository.findByTeacherIdAndIsDeletedFalseOrderByCreatedAtDesc(teacherId);
        return list.stream().map(this::paperMap).toList();
    }

    public List<Map<String, Object>> listClassNotebooks(long teacherId, Long classId) {
        requireTeacher(teacherId);
        List<ClassNotebook> list;
        if (classId != null && classId != 0) {
            ownedClass(teacherId, classId);
            list = classNotebookRepository.findByTeacherIdAndClassIdAndIsDeletedFalseOrderByCreatedAtDesc(teacherId, classId);
        } else {
            list = classNotebookRepository.findByTeacherIdAndIsDeletedFalseOrderByCreatedAtDesc(teacherId);
        }
        return list.stream().map(nb -> {
            Map<String, Object> m = new HashMap<>();
            m.put("id", nb.getId());
            m.put("title", nb.getTitle());
            m.put("classId", nb.getClassId());
            m.put("questionCount", nb.getQuestionCount());
            m.put("createdAt", nb.getCreatedAt());
            return m;
        }).toList();
    }

    public Map<String, Object> paperDetail(long teacherId, long id) {
        TeacherPaper p = teacherPaperRepository.findByIdAndTeacherId(id, teacherId)
                .filter(x -> !Boolean.TRUE.equals(x.getIsDeleted()))
                .orElseThrow(() -> new IllegalArgumentException("无权查看该试卷"));
        List<Long> ids = parseIdCsv(p.getQuestionIds());
        Map<String, Object> d = new HashMap<>();
        d.put("id", p.getId());
        d.put("type", "paper");
        d.put("title", p.getTitle());
        d.put("classId", p.getClassId());
        d.put("createdAt", p.getCreatedAt());
        List<Map<String, Object>> questions = listPickedQuestions(ids);
        d.put("questions", questions);
        d.put("questionCount", questions.size());
        d.put("questionIds", ids);
        d.put("duration", p.getDuration());
        return d;
    }

    public Map<String, Object> classNotebookDetail(long teacherId, long id) {
        ClassNotebook n = classNotebookRepository.findByIdAndTeacherId(id, teacherId)
                .filter(x -> !Boolean.TRUE.equals(x.getIsDeleted()))
                .orElseThrow(() -> new IllegalArgumentException("无权查看该错题本"));
        List<Long> ids = parseIdCsv(n.getQuestionIds());
        List<Map<String, Object>> questions = ids.isEmpty() ? readList(n.getQuestionsJson()) : listPickedQuestions(ids);
        Map<String, Object> d = new HashMap<>();
        d.put("id", n.getId());
        d.put("type", "notebook");
        d.put("title", n.getTitle());
        d.put("classId", n.getClassId());
        d.put("createdAt", n.getCreatedAt());
        d.put("questions", questions);
        d.put("questionCount", questions.size());
        return d;
    }

    @Transactional
    public Map<String, Object> createAssignment(long teacherId, Map<String, Object> body) {
        long classId = asLong(body.get("classId"));
        ownedClass(teacherId, classId);
        String title = String.valueOf(body.getOrDefault("title", "班级作业")).trim();
        if (title.isEmpty()) title = "班级作业";
        List<Long> ids = asIdList(body.get("questionIds"));
        if (ids.isEmpty() && body.get("paperId") != null) {
            long paperId = asLong(body.get("paperId"));
            TeacherPaper p = teacherPaperRepository.findByIdAndTeacherId(paperId, teacherId)
                    .filter(x -> !Boolean.TRUE.equals(x.getIsDeleted()))
                    .orElseThrow(() -> new IllegalArgumentException("无权使用该试卷"));
            ids = parseIdCsv(p.getQuestionIds());
        }
        if (ids.isEmpty()) throw new IllegalArgumentException("请选择题目");
        List<Map<String, Object>> questions = snapshotQuestions(ids);
        Homework hw = new Homework();
        hw.setTeacherId(teacherId);
        hw.setClassId(classId);
        hw.setTitle(title.substring(0, Math.min(120, title.length())));
        hw.setDescription(String.valueOf(body.getOrDefault("description", "")));
        hw.setQuestionsJson(writeJson(questions));
        hw.setQuestionCount(questions.size());
        if (body.get("dueAt") instanceof String due && !due.isBlank()) {
            hw.setDueAt(parseDue(due));
        }
        hw.setIsDeleted(false);
        hw.setCreatedAt(LocalDateTime.now());
        hw = homeworkRepository.save(hw);
        String dueHint = hw.getDueAt() == null ? "" : ("，截止 " + hw.getDueAt().toString().replace('T', ' ').substring(0, 16));
        notifyClass(teacherId, classId, "老师布置了新作业「" + hw.getTitle() + "」，共 " + hw.getQuestionCount() + " 题" + dueHint + "。");
        Map<String, Object> d = new HashMap<>();
        d.put("id", hw.getId());
        d.put("title", hw.getTitle());
        d.put("questionCount", hw.getQuestionCount());
        d.put("dueAt", hw.getDueAt());
        d.put("createdAt", hw.getCreatedAt());
        return d;
    }

    public List<Map<String, Object>> teacherAssignments(long teacherId) {
        requireTeacher(teacherId);
        List<Homework> list = homeworkRepository.findByTeacherIdAndIsDeletedFalseOrderByCreatedAtDesc(teacherId);
        Map<Long, String> classNames = new HashMap<>();
        Map<Long, Integer> classSize = new HashMap<>();
        for (TeacherClass c : teacherClassRepository.findByTeacherIdAndIsDeletedFalseOrderByCreatedAtDesc(teacherId)) {
            classNames.put(c.getId(), c.getName());
            classSize.put(c.getId(), approvedStudentIds(c.getId()).size());
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (Homework a : list) {
            int studentCount = a.getClassId() == null
                    ? teacherStudentRepository.findByTeacherIdOrderByCreatedAtDesc(teacherId).size()
                    : classSize.getOrDefault(a.getClassId(), 0);
            long submitted = homeworkSubmissionRepository.countByHomeworkId(a.getId());
            long graded = homeworkSubmissionRepository.countByHomeworkIdAndStatus(a.getId(), "GRADED");
            Map<String, Object> row = new HashMap<>();
            row.put("id", a.getId());
            row.put("title", a.getTitle());
            row.put("classId", a.getClassId());
            row.put("className", a.getClassId() == null ? "" : classNames.getOrDefault(a.getClassId(), ""));
            row.put("questionCount", a.getQuestionCount());
            row.put("dueAt", a.getDueAt());
            row.put("createdAt", a.getCreatedAt());
            row.put("studentCount", studentCount);
            row.put("submitted", submitted);
            row.put("missing", Math.max(0, studentCount - (int) submitted));
            row.put("graded", graded);
            out.add(row);
        }
        return out;
    }

    public Map<String, Object> assignmentDetail(long teacherId, long id) {
        requireTeacher(teacherId);
        Homework a = homeworkRepository.findByIdAndTeacherId(id, teacherId)
                .filter(x -> !Boolean.TRUE.equals(x.getIsDeleted()))
                .orElseThrow(() -> new IllegalArgumentException("无权访问该作业"));
        String className = "";
        List<Long> studentIds;
        if (a.getClassId() != null) {
            TeacherClass cls = ownedClass(teacherId, a.getClassId());
            className = cls.getName();
            studentIds = approvedStudentIds(a.getClassId());
        } else {
            studentIds = teacherStudentRepository.findByTeacherIdOrderByCreatedAtDesc(teacherId)
                    .stream().map(TeacherStudent::getStudentId).toList();
        }
        Map<Long, HomeworkSubmission> subBy = new HashMap<>();
        for (HomeworkSubmission s : homeworkSubmissionRepository.findByHomeworkIdOrderBySubmittedAtDesc(id)) {
            subBy.put(s.getStudentId(), s);
        }
        List<Map<String, Object>> questions = readList(a.getQuestionsJson());
        int n = questions.size();
        List<Map<String, Object>> roster = new ArrayList<>();
        for (Long sid : studentIds) {
            User u = userRepository.findById(sid).orElse(null);
            if (u == null) continue;
            HomeworkSubmission s = subBy.get(sid);
            Map<String, Object> row = brief(u);
            row.put("studentId", sid);
            String statusKey = "missing";
            String status = "未交";
            if (s != null) {
                if ("GRADED".equals(s.getStatus())) {
                    statusKey = "graded";
                    status = s.getScore() == null ? "已批改" : ("已批改 " + s.getScore() + "分");
                } else {
                    statusKey = "submitted";
                    status = "已交待批";
                }
                row.put("id", s.getId());
                row.put("submissionId", s.getId());
                row.put("score", s.getScore());
                row.put("comment", s.getFeedback() == null ? "" : s.getFeedback());
                row.put("feedback", s.getFeedback());
                row.put("answers", readAnyList(s.getAnswersJson()));
                row.put("marks", normalizeMarks(readStringList(s.getMarksJson()), n));
                row.put("submittedAt", s.getSubmittedAt());
                row.put("aiFeedback", s.getAiFeedback());
                row.put("statusRaw", s.getStatus());
            } else {
                row.put("score", null);
                row.put("comment", "");
                row.put("answers", List.of());
                row.put("marks", normalizeMarks(List.of(), n));
                row.put("submissionId", "");
            }
            row.put("statusKey", statusKey);
            row.put("status", status);
            roster.add(row);
        }
        roster.sort((x, y) -> {
            Map<String, Integer> order = Map.of("submitted", 0, "graded", 1, "missing", 2);
            return Integer.compare(order.getOrDefault(x.get("statusKey"), 9), order.getOrDefault(y.get("statusKey"), 9));
        });
        Map<String, Object> d = new HashMap<>();
        d.put("id", a.getId());
        d.put("title", a.getTitle());
        d.put("description", a.getDescription());
        d.put("classId", a.getClassId());
        d.put("className", className);
        d.put("dueAt", a.getDueAt());
        d.put("createdAt", a.getCreatedAt());
        d.put("questions", questions);
        d.put("questionCount", n);
        d.put("studentCount", roster.size());
        d.put("submitted", roster.stream().filter(x -> !"missing".equals(x.get("statusKey"))).count());
        d.put("missing", roster.stream().filter(x -> "missing".equals(x.get("statusKey"))).count());
        d.put("graded", roster.stream().filter(x -> "graded".equals(x.get("statusKey"))).count());
        d.put("roster", roster);
        d.put("submissions", roster.stream().filter(x -> x.get("submissionId") instanceof Long).toList());
        d.put("notSubmitted", roster.stream().filter(x -> "missing".equals(x.get("statusKey"))).toList());
        return d;
    }

    @Transactional
    public Map<String, Object> gradeAssignment(long teacherId, long submissionId, Map<String, Object> body) {
        requireTeacher(teacherId);
        HomeworkSubmission s = homeworkSubmissionRepository.findById(submissionId)
                .orElseThrow(() -> new IllegalArgumentException("提交记录不存在"));
        Homework a = homeworkRepository.findByIdAndTeacherId(s.getHomeworkId(), teacherId)
                .orElseThrow(() -> new IllegalArgumentException("无权批改该作业"));
        int n = a.getQuestionCount() == null ? 0 : a.getQuestionCount();
        List<String> marks = normalizeMarks(body.get("marks") instanceof List<?> raw
                ? raw.stream().map(String::valueOf).toList() : List.of(), n);
        int marked = (int) marks.stream().filter(v -> !v.isBlank()).count();
        if (marked > 0 && marked != n) throw new IllegalArgumentException("请把每道题标成对或错");
        Integer score = null;
        if (body.get("score") instanceof Number num) score = num.intValue();
        if (score == null) {
            if (marked == n && n > 0) {
                long right = marks.stream().filter("right"::equals).count();
                score = (int) Math.round(right * 100.0 / n);
            } else {
                throw new IllegalArgumentException("请输入有效分数");
            }
        }
        if (score < 0) throw new IllegalArgumentException("请输入有效分数");
        String comment = String.valueOf(body.getOrDefault("comment", body.getOrDefault("feedback", "")));
        if (comment.length() > 200) comment = comment.substring(0, 200);
        s.setScore(score);
        s.setMarksJson(writeJson(marks));
        s.setFeedback(comment);
        s.setStatus("GRADED");
        s.setGradedAt(LocalDateTime.now());
        s = homeworkSubmissionRepository.save(s);
        TeacherMessage msg = new TeacherMessage();
        msg.setTeacherId(teacherId);
        msg.setStudentId(s.getStudentId());
        msg.setSenderRole("TEACHER");
        msg.setContent("你的作业已批改，得分 " + score + " 分。" + (comment.isBlank() ? "" : "老师点评：" + comment));
        msg.setCreatedAt(LocalDateTime.now());
        teacherMessageRepository.save(msg);
        Map<String, Object> d = new HashMap<>();
        d.put("id", s.getId());
        d.put("score", score);
        d.put("marks", marks);
        d.put("comment", comment);
        d.put("status", "graded");
        return d;
    }

    @Transactional
    public void recallAssignment(long teacherId, long id) {
        Homework a = homeworkRepository.findByIdAndTeacherId(id, teacherId)
                .filter(x -> !Boolean.TRUE.equals(x.getIsDeleted()))
                .orElseThrow(() -> new IllegalArgumentException("无权撤回该作业"));
        a.setIsDeleted(true);
        homeworkRepository.save(a);
    }

    @Transactional
    public void recallPaper(long teacherId, long id) {
        TeacherPaper p = teacherPaperRepository.findByIdAndTeacherId(id, teacherId)
                .filter(x -> !Boolean.TRUE.equals(x.getIsDeleted()))
                .orElseThrow(() -> new IllegalArgumentException("无权删除该试卷"));
        p.setIsDeleted(true);
        teacherPaperRepository.save(p);
    }

    @Transactional
    public void recallNotebook(long teacherId, long id) {
        ClassNotebook n = classNotebookRepository.findByIdAndTeacherId(id, teacherId)
                .filter(x -> !Boolean.TRUE.equals(x.getIsDeleted()))
                .orElseThrow(() -> new IllegalArgumentException("无权撤回该练习"));
        n.setIsDeleted(true);
        classNotebookRepository.save(n);
    }

    @Transactional
    public Map<String, Object> classParentReport(long teacherId, long classId) {
        TeacherClass cls = ownedClass(teacherId, classId);
        List<Long> ids = approvedStudentIds(classId);
        List<Homework> assignments = homeworkRepository.findByClassIdAndIsDeletedFalseOrderByCreatedAtDesc(classId);
        List<Question> qrows = ids.isEmpty() ? List.of()
                : questionRepository.findByUserIdInAndIsDeletedFalseOrderByCreatedAtDesc(ids)
                .stream().filter(q -> !BANK.equals(q.getSource())).limit(200).toList();
        Map<Long, Integer> qCount = new HashMap<>();
        Map<Long, Map<String, Integer>> catBy = new HashMap<>();
        Map<String, Integer> catMap = new HashMap<>();
        Map<String, Map<String, Object>> hotMap = new LinkedHashMap<>();
        for (Question q : qrows) {
            Long sid = q.getUserId();
            String cat = q.getCategory() == null || q.getCategory().isBlank() ? "未分类" : q.getCategory();
            qCount.merge(sid, 1, Integer::sum);
            catBy.computeIfAbsent(sid, k -> new HashMap<>()).merge(cat, 1, Integer::sum);
            catMap.merge(cat, 1, Integer::sum);
            String key = contentKey(q.getContent());
            if (key.isBlank()) key = String.valueOf(q.getId());
            Map<String, Object> h = hotMap.computeIfAbsent(key, k -> {
                Map<String, Object> item = new HashMap<>();
                item.put("content", q.getContent() == null ? "" : q.getContent());
                item.put("category", cat);
                item.put("count", 0);
                item.put("students", new HashSet<Long>());
                return item;
            });
            h.put("count", ((Number) h.get("count")).intValue() + 1);
            @SuppressWarnings("unchecked")
            Set<Long> st = (Set<Long>) h.get("students");
            if (sid != null) st.add(sid);
        }
        List<Map<String, Object>> students = new ArrayList<>();
        List<Integer> scored = new ArrayList<>();
        for (Long sid : ids) {
            User u = userRepository.findById(sid).orElse(null);
            if (u == null) continue;
            int submitted = 0;
            int graded = 0;
            List<Integer> scores = new ArrayList<>();
            for (Homework hw : assignments) {
                HomeworkSubmission sub = homeworkSubmissionRepository.findByHomeworkIdAndStudentId(hw.getId(), sid).orElse(null);
                if (sub == null) continue;
                submitted++;
                if ("GRADED".equals(sub.getStatus()) && sub.getScore() != null) {
                    graded++;
                    scores.add(sub.getScore());
                }
            }
            Map<String, Integer> cats = catBy.getOrDefault(sid, Map.of());
            List<Map<String, Object>> catList = cats.entrySet().stream()
                    .sorted((a, b) -> Integer.compare(b.getValue(), a.getValue()))
                    .map(e -> {
                        Map<String, Object> c = new HashMap<>();
                        c.put("name", e.getKey());
                        c.put("count", e.getValue());
                        return c;
                    }).toList();
            Integer avg = scores.isEmpty() ? null : (int) Math.round(scores.stream().mapToInt(Integer::intValue).average().orElse(0));
            if (avg != null) scored.add(avg);
            Map<String, Object> row = brief(u);
            row.put("studentId", sid);
            row.put("questionCount", qCount.getOrDefault(sid, 0));
            row.put("submitted", submitted);
            row.put("graded", graded);
            row.put("averageScore", avg);
            row.put("weak", catList.isEmpty() ? "" : catList.get(0).get("name"));
            row.put("categories", catList.stream().limit(3).toList());
            students.add(row);
        }
        int qtotal = qrows.size();
        List<Map<String, Object>> byCategory = catMap.entrySet().stream()
                .sorted((a, b) -> Integer.compare(b.getValue(), a.getValue()))
                .limit(8)
                .map(e -> {
                    Map<String, Object> c = new HashMap<>();
                    c.put("name", e.getKey());
                    c.put("count", e.getValue());
                    c.put("pct", qtotal == 0 ? 0 : Math.round(e.getValue() * 100.0 / qtotal));
                    return c;
                }).toList();
        List<Map<String, Object>> hot = hotMap.values().stream()
                .sorted((a, b) -> {
                    int cmp = Integer.compare(((Number) b.get("count")).intValue(), ((Number) a.get("count")).intValue());
                    if (cmp != 0) return cmp;
                    return Integer.compare(((Set<?>) b.get("students")).size(), ((Set<?>) a.get("students")).size());
                })
                .limit(5)
                .map(item -> {
                    Map<String, Object> h = new HashMap<>();
                    h.put("content", item.get("content"));
                    h.put("category", item.get("category"));
                    h.put("count", item.get("count"));
                    h.put("studentCount", ((Set<?>) item.get("students")).size());
                    return h;
                }).toList();
        Integer classAverage = scored.isEmpty() ? null : (int) Math.round(scored.stream().mapToInt(Integer::intValue).average().orElse(0));
        Map<String, Object> report = new LinkedHashMap<>();
        report.put("classId", classId);
        report.put("className", cls.getName());
        report.put("title", cls.getName() + " 学习情况报告");
        report.put("studentCount", ids.size());
        report.put("questionTotal", qtotal);
        report.put("assignmentCount", assignments.size());
        report.put("classAverage", classAverage);
        report.put("byCategory", byCategory);
        report.put("hot", hot);
        report.put("students", students);
        ParentReport saved = new ParentReport();
        saved.setTeacherId(teacherId);
        saved.setStudentId(0L);
        saved.setClassId(classId);
        saved.setTitle(cls.getName() + " 学习情况报告");
        saved.setContent(renderClassReport(report));
        saved.setSnapshotJson(writeJson(report));
        saved.setCreatedAt(LocalDateTime.now());
        saved = parentReportRepository.save(saved);
        report.put("id", saved.getId());
        report.put("createdAt", saved.getCreatedAt());
        report.put("content", saved.getContent());
        return report;
    }

    public List<Map<String, Object>> listClassParentReports(long teacherId, Long classId) {
        requireTeacher(teacherId);
        List<ParentReport> list = classId == null || classId == 0
                ? parentReportRepository.findByTeacherIdAndStudentIdOrderByCreatedAtDesc(teacherId, 0L)
                : parentReportRepository.findByTeacherIdAndClassIdOrderByCreatedAtDesc(teacherId, classId)
                .stream().filter(p -> p.getStudentId() != null && p.getStudentId() == 0L).toList();
        List<Map<String, Object>> out = new ArrayList<>();
        for (ParentReport p : list) {
            Map<String, Object> m = new HashMap<>();
            m.put("id", p.getId());
            m.put("title", p.getTitle());
            m.put("classId", p.getClassId());
            m.put("createdAt", p.getCreatedAt());
            Map<String, Object> snap = readObject(p.getSnapshotJson());
            m.put("className", snap.getOrDefault("className", ""));
            m.put("studentCount", snap.getOrDefault("studentCount", 0));
            m.put("assignmentCount", snap.getOrDefault("assignmentCount", 0));
            m.put("questionTotal", snap.getOrDefault("questionTotal", 0));
            out.add(m);
        }
        return out;
    }

    public Map<String, Object> classParentReportDetail(long teacherId, long id) {
        ParentReport p = parentReportRepository.findByIdAndTeacherId(id, teacherId)
                .orElseThrow(() -> new IllegalArgumentException("无权查看该报告"));
        Map<String, Object> snap = readObject(p.getSnapshotJson());
        snap.put("id", p.getId());
        snap.put("title", p.getTitle());
        snap.put("content", p.getContent());
        snap.put("createdAt", p.getCreatedAt());
        snap.put("classId", p.getClassId());
        return snap;
    }

    public Map<String, Object> chat(long teacherId, Map<String, Object> body) {
        requireTeacher(teacherId);
        List<TeacherClass> classes = ensureClasses(teacherId);
        Long classId = body.get("classId") == null ? null : asLong(body.get("classId"));
        TeacherClass cls = classes.stream()
                .filter(c -> classId != null && c.getId().equals(classId))
                .findFirst()
                .orElse(classes.isEmpty() ? null : classes.get(0));
        Map<String, Object> stats = cls == null ? null : classStats(teacherId, cls.getId());
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> hot = stats == null ? List.of() : (List<Map<String, Object>>) stats.getOrDefault("hot", List.of());
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> byCat = stats == null ? List.of() : (List<Map<String, Object>>) stats.getOrDefault("byCategory", List.of());
        StringBuilder hotLines = new StringBuilder();
        for (int i = 0; i < Math.min(8, hot.size()); i++) {
            Map<String, Object> h = hot.get(i);
            String snippet = String.valueOf(h.getOrDefault("content", "")).replaceAll("\\s+", " ").trim();
            if (snippet.length() > 60) snippet = snippet.substring(0, 60);
            hotLines.append(i + 1).append(". [").append(h.get("category")).append("] ")
                    .append(snippet)
                    .append(" （").append(h.get("count")).append(" 次 / ").append(h.get("studentCount")).append(" 人）\n");
        }
        String catLines = byCat.stream().limit(8)
                .map(c -> c.get("name") + " " + c.get("count") + " 道")
                .collect(Collectors.joining("，"));
        StringBuilder system = new StringBuilder();
        system.append("你是给老师用的班级教学助手，不是学生答疑老师。\n");
        system.append("只根据下面的班级错题统计回答：指出高频错题、薄弱学科、适合组卷或布置作业的题目。\n");
        system.append("用「老师」称呼对方。先给结论，再给可执行建议（例如推哪些题、布置几道作业）。\n");
        system.append("不要编造数据里没有的题目，不要给学生讲题步骤，除非老师明确问某道题怎么教。\n");
        if (cls == null) {
            system.append("老师还没有班级。请提醒老师先建班并把加入码发给学生。");
        } else {
            system.append("当前班级：").append(cls.getName()).append('\n');
            if (stats != null) {
                system.append("错题总数 ").append(stats.get("total")).append("，学生 ").append(stats.get("studentCount"))
                        .append(" 人。学科分布：").append(catLines.isBlank() ? "暂无" : catLines).append("。\n");
            }
            if (hotLines.length() > 0) system.append("高频错题：\n").append(hotLines);
            else system.append("还没有可统计的错题。");
        }
        List<Map<String, String>> history = new ArrayList<>();
        if (body.get("messages") instanceof List<?> raw) {
            for (Object o : raw) {
                if (!(o instanceof Map<?, ?> mm)) continue;
                String role = String.valueOf(mm.get("role"));
                String content = String.valueOf(mm.get("content") == null ? "" : mm.get("content")).trim();
                if (content.isEmpty()) continue;
                if (!"user".equals(role) && !"assistant".equals(role)) continue;
                history.add(Map.of("role", role, "content", content));
            }
        }
        if (history.size() > 8) history = history.subList(history.size() - 8, history.size());
        StringBuilder user = new StringBuilder();
        for (Map<String, String> m : history) {
            user.append("user".equals(m.get("role")) ? "老师：" : "助手：").append(m.get("content")).append("\n");
        }
        if (user.isEmpty()) throw new IllegalArgumentException("请输入问题");
        String reply = aiAnswerService.complete(system.toString(), user.toString(), 1200);
        if (reply == null || reply.isBlank()) throw new IllegalArgumentException("教师助手暂时无法回答");
        Map<String, Object> d = new HashMap<>();
        d.put("reply", reply.trim());
        d.put("classId", cls == null ? null : cls.getId());
        return d;
    }

    @Transactional
    public Map<String, Object> joinClass(long studentId, String code) {
        User me = userRepository.findById(studentId).orElseThrow(() -> new IllegalArgumentException("用户不存在"));
        if ("TEACHER".equals(me.getRole())) throw new IllegalArgumentException("教师账号不能加入班级");
        String joinCode = code == null ? "" : code.trim().toUpperCase();
        if (joinCode.isEmpty()) throw new IllegalArgumentException("请输入班级加入码");
        TeacherClass cls = teacherClassRepository.findByJoinCodeAndIsDeletedFalse(joinCode).orElse(null);
        if (cls == null) {
            User t = userRepository.findByInviteCode(joinCode)
                    .filter(u -> "TEACHER".equals(u.getRole()))
                    .orElseThrow(() -> new IllegalArgumentException("加入码无效"));
            List<TeacherClass> classes = ensureClasses(t.getId());
            if (classes.isEmpty()) throw new IllegalArgumentException("加入码无效");
            cls = classes.get(0);
        }
        ClassMember existing = classMemberRepository.findByClassIdAndStudentId(cls.getId(), studentId).orElse(null);
        if (existing != null && APPROVED.equals(existing.getStatus())) {
            Map<String, Object> d = new HashMap<>();
            d.put("classId", cls.getId());
            d.put("name", cls.getName());
            d.put("alreadyJoined", true);
            d.put("pending", false);
            d.put("status", "approved");
            return d;
        }
        if (existing != null && PENDING.equals(existing.getStatus())) {
            Map<String, Object> d = new HashMap<>();
            d.put("classId", cls.getId());
            d.put("name", cls.getName());
            d.put("alreadyJoined", false);
            d.put("pending", true);
            d.put("status", "pending");
            return d;
        }
        if (existing == null) {
            existing = new ClassMember();
            existing.setClassId(cls.getId());
            existing.setStudentId(studentId);
        }
        existing.setStatus(PENDING);
        existing.setRequestedAt(LocalDateTime.now());
        existing.setApprovedAt(null);
        classMemberRepository.save(existing);
        Map<String, Object> d = new HashMap<>();
        d.put("classId", cls.getId());
        d.put("name", cls.getName());
        d.put("alreadyJoined", false);
        d.put("pending", true);
        d.put("status", "pending");
        userRepository.findById(cls.getTeacherId()).ifPresent(t -> d.put("teacherName", t.getNickName()));
        return d;
    }

    public List<Map<String, Object>> myClasses(long studentId) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (ClassMember m : classMemberRepository.findByStudentId(studentId)) {
            if (REJECTED.equals(m.getStatus())) continue;
            TeacherClass cls = teacherClassRepository.findById(m.getClassId()).orElse(null);
            if (cls == null || Boolean.TRUE.equals(cls.getIsDeleted())) continue;
            Map<String, Object> row = new HashMap<>();
            row.put("id", cls.getId());
            row.put("name", cls.getName());
            row.put("grade", cls.getGrade() == null ? "" : cls.getGrade());
            row.put("joinCode", cls.getJoinCode());
            row.put("status", statusApi(m.getStatus()));
            row.put("joinedAt", m.getApprovedAt() == null ? m.getRequestedAt() : m.getApprovedAt());
            userRepository.findById(cls.getTeacherId()).ifPresent(t -> {
                row.put("teacherId", t.getId());
                row.put("teacherName", t.getNickName());
            });
            out.add(row);
        }
        return out;
    }

    public List<Long> approvedClassIds(long studentId) {
        return classMemberRepository.findByStudentIdAndStatus(studentId, APPROVED).stream()
                .map(ClassMember::getClassId).toList();
    }

    public List<Map<String, Object>> studentClassNotebooks(long studentId) {
        List<Long> ids = approvedClassIds(studentId);
        if (ids.isEmpty()) return List.of();
        List<Map<String, Object>> out = new ArrayList<>();
        for (ClassNotebook n : classNotebookRepository.findByClassIdInAndIsDeletedFalseOrderByCreatedAtDesc(ids)) {
            Map<String, Object> m = new HashMap<>();
            m.put("id", n.getId());
            m.put("title", n.getTitle());
            m.put("questionCount", n.getQuestionCount());
            m.put("createdAt", n.getCreatedAt());
            m.put("pushedAt", n.getPushedAt());
            m.put("classId", n.getClassId());
            teacherClassRepository.findById(n.getClassId() == null ? -1L : n.getClassId())
                    .ifPresent(c -> m.put("className", c.getName()));
            userRepository.findById(n.getTeacherId()).ifPresent(t -> m.put("teacherName", t.getNickName()));
            out.add(m);
        }
        return out;
    }

    public Map<String, Object> studentClassNotebookDetail(long studentId, long id) {
        ClassNotebook n = classNotebookRepository.findById(id)
                .filter(x -> !Boolean.TRUE.equals(x.getIsDeleted()))
                .orElseThrow(() -> new IllegalArgumentException("练习不存在"));
        if (n.getClassId() != null) {
            ClassMember m = classMemberRepository.findByClassIdAndStudentId(n.getClassId(), studentId).orElse(null);
            if (m == null || !APPROVED.equals(m.getStatus())) {
                if (m != null && PENDING.equals(m.getStatus())) throw new IllegalArgumentException("加入申请待老师审核");
                throw new IllegalArgumentException("不在该班级");
            }
        }
        List<Long> ids = parseIdCsv(n.getQuestionIds());
        List<Map<String, Object>> questions = ids.isEmpty() ? readList(n.getQuestionsJson()) : listPickedQuestions(ids);
        Map<String, Object> d = new HashMap<>();
        d.put("id", n.getId());
        d.put("title", n.getTitle());
        d.put("createdAt", n.getCreatedAt());
        d.put("questions", questions);
        d.put("questionCount", questions.size());
        if (n.getClassId() != null) {
            teacherClassRepository.findById(n.getClassId()).ifPresent(c -> d.put("className", c.getName()));
        }
        return d;
    }

    private void notifyClass(long teacherId, long classId, String content) {
        for (Long sid : approvedStudentIds(classId)) {
            TeacherMessage m = new TeacherMessage();
            m.setTeacherId(teacherId);
            m.setStudentId(sid);
            m.setSenderRole("TEACHER");
            m.setContent(content);
            m.setCreatedAt(LocalDateTime.now());
            teacherMessageRepository.save(m);
        }
    }

    private Map<String, Object> paperMap(TeacherPaper p) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", p.getId());
        m.put("title", p.getTitle());
        m.put("classId", p.getClassId());
        m.put("questionCount", p.getQuestionCount());
        m.put("questionIds", parseIdCsv(p.getQuestionIds()));
        m.put("duration", p.getDuration());
        m.put("createdAt", p.getCreatedAt());
        return m;
    }

    private Map<String, Object> questionMap(Question q) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", q.getId());
        m.put("content", q.getContent());
        m.put("category", q.getCategory() == null || q.getCategory().isBlank() ? "未分类" : q.getCategory());
        m.put("difficulty", q.getDifficulty() == null ? "MEDIUM" : q.getDifficulty().name());
        m.put("tags", q.getTags() == null ? List.of() : q.getTags());
        m.put("aiAnswer", q.getAiAnswer());
        m.put("aiAnalysis", q.getAiAnalysis());
        m.put("aiStatus", q.getAiStatus() == null ? "" : q.getAiStatus().name());
        m.put("imageUrl", q.getImageUrl());
        m.put("createdAt", q.getCreatedAt());
        m.put("source", q.getSource() == null || q.getSource().isBlank() ? "student" : q.getSource());
        m.put("classId", q.getClassId());
        m.put("userId", q.getUserId());
        return m;
    }

    private List<Map<String, Object>> snapshotQuestions(List<Long> ids) {
        Map<Long, Question> byId = questionRepository.findByIdInAndIsDeletedFalse(ids).stream()
                .collect(Collectors.toMap(Question::getId, q -> q, (a, b) -> a));
        List<Map<String, Object>> questions = new ArrayList<>();
        for (Long qid : ids) {
            Question q = byId.get(qid);
            if (q == null) continue;
            Map<String, Object> item = new HashMap<>();
            item.put("content", q.getContent());
            item.put("answer", q.getAiAnswer() == null ? "" : q.getAiAnswer());
            item.put("analysis", q.getAiAnalysis() == null ? "" : q.getAiAnalysis());
            item.put("score", 10);
            item.put("questionId", q.getId());
            item.put("imageUrl", q.getImageUrl());
            item.put("category", q.getCategory());
            item.put("source", q.getSource());
            questions.add(item);
        }
        if (questions.isEmpty()) throw new IllegalArgumentException("请选择题目");
        return questions;
    }

    private String renderClassReport(Map<String, Object> report) {
        StringBuilder sb = new StringBuilder();
        sb.append("【班级概况】").append(report.get("className")).append("，")
                .append(report.get("studentCount")).append(" 名学生，错题 ")
                .append(report.get("questionTotal")).append(" 道，作业 ")
                .append(report.get("assignmentCount")).append(" 份。班级均分 ")
                .append(report.get("classAverage") == null ? "暂无" : report.get("classAverage")).append("。\n\n");
        sb.append("【学科分布】");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> byCategory = (List<Map<String, Object>>) report.get("byCategory");
        if (byCategory == null || byCategory.isEmpty()) sb.append("暂无。\n\n");
        else {
            sb.append(byCategory.stream().map(c -> c.get("name") + " " + c.get("count") + " 道").collect(Collectors.joining("，"))).append("。\n\n");
        }
        sb.append("【高频错题】");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> hot = (List<Map<String, Object>>) report.get("hot");
        if (hot == null || hot.isEmpty()) sb.append("暂无。\n\n");
        else {
            sb.append('\n');
            for (int i = 0; i < hot.size(); i++) {
                Map<String, Object> h = hot.get(i);
                sb.append(i + 1).append(". ").append(String.valueOf(h.get("content")).replaceAll("\\s+", " "))
                        .append("（").append(h.get("count")).append(" 次 / ").append(h.get("studentCount")).append(" 人）\n");
            }
            sb.append('\n');
        }
        sb.append("【学生】");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> students = (List<Map<String, Object>>) report.get("students");
        if (students != null) {
            for (Map<String, Object> s : students) {
                sb.append('\n').append(s.get("nickName")).append("：错题 ").append(s.get("questionCount"))
                        .append("，作业均分 ").append(s.get("averageScore") == null ? "暂无" : s.get("averageScore"))
                        .append("，薄弱 ").append(s.get("weak") == null || String.valueOf(s.get("weak")).isBlank() ? "暂无" : s.get("weak"));
            }
        }
        return sb.toString();
    }

    private List<String> normalizeMarks(Object raw, int n) {
        List<String> src = new ArrayList<>();
        if (raw instanceof List<?> list) {
            for (Object o : list) src.add(String.valueOf(o == null ? "" : o));
        }
        List<String> out = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            String v = i < src.size() ? src.get(i) : "";
            if ("right".equalsIgnoreCase(v) || "对".equals(v) || "correct".equalsIgnoreCase(v)) out.add("right");
            else if ("wrong".equalsIgnoreCase(v) || "错".equals(v) || "incorrect".equalsIgnoreCase(v)) out.add("wrong");
            else out.add("");
        }
        return out;
    }

    private Question.DifficultyLevel parseDifficulty(Object raw) {
        String v = raw == null ? "" : String.valueOf(raw).trim();
        if ("简单".equals(v) || "EASY".equalsIgnoreCase(v)) return Question.DifficultyLevel.EASY;
        if ("困难".equals(v) || "HARD".equalsIgnoreCase(v)) return Question.DifficultyLevel.HARD;
        return Question.DifficultyLevel.MEDIUM;
    }

    private LocalDateTime parseDue(String due) {
        try {
            if (due.length() == 10) return LocalDateTime.parse(due + "T23:59:00");
            return LocalDateTime.parse(due);
        } catch (Exception e) {
            return null;
        }
    }

    private String contentKey(String content) {
        if (content == null) return "";
        return content.replaceAll("\\s+", "").toLowerCase();
    }

    private long asLong(Object o) {
        if (o instanceof Number n) return n.longValue();
        if (o == null) throw new IllegalArgumentException("缺少班级");
        String s = String.valueOf(o).trim();
        if (s.isEmpty()) throw new IllegalArgumentException("缺少班级");
        try {
            return Long.parseLong(s);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("缺少班级");
        }
    }

    private List<Long> asIdList(Object raw) {
        List<Long> ids = new ArrayList<>();
        if (raw instanceof List<?> list) {
            for (Object o : list) {
                try {
                    long id = o instanceof Number n ? n.longValue() : Long.parseLong(String.valueOf(o));
                    if (id > 0) ids.add(id);
                } catch (Exception ignored) {}
            }
        }
        return ids;
    }

    private List<Long> parseIdCsv(String csv) {
        if (csv == null || csv.isBlank()) return List.of();
        List<Long> ids = new ArrayList<>();
        for (String p : csv.split(",")) {
            try {
                long id = Long.parseLong(p.trim());
                if (id > 0) ids.add(id);
            } catch (Exception ignored) {}
        }
        return ids;
    }

    private String firstText(Object... vals) {
        for (Object v : vals) {
            if (v == null) continue;
            String s = String.valueOf(v).trim();
            if (!s.isEmpty() && !"null".equals(s)) return s;
        }
        return "";
    }

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

    private List<String> readStringList(String json) {
        if (json == null || json.isBlank()) return new ArrayList<>();
        try {
            return objectMapper.readValue(json, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    private Map<String, Object> readObject(String json) {
        if (json == null || json.isBlank()) return new HashMap<>();
        try {
            return objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            return new HashMap<>();
        }
    }

    private String writeJson(Object o) {
        try {
            return objectMapper.writeValueAsString(o);
        } catch (Exception e) {
            return "[]";
        }
    }
}
