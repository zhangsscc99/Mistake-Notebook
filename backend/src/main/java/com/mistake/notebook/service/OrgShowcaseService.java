package com.mistake.notebook.service;

import com.mistake.notebook.entity.Category;
import com.mistake.notebook.entity.OrgMember;
import com.mistake.notebook.entity.OrgStaff;
import com.mistake.notebook.entity.Organization;
import com.mistake.notebook.entity.Question;
import com.mistake.notebook.entity.QuestionMark;
import com.mistake.notebook.entity.User;
import com.mistake.notebook.repository.OrgMemberRepository;
import com.mistake.notebook.repository.OrgStaffRepository;
import com.mistake.notebook.repository.OrganizationRepository;
import com.mistake.notebook.repository.QuestionMarkRepository;
import com.mistake.notebook.repository.QuestionRepository;
import com.mistake.notebook.repository.UserRepository;
import com.mistake.notebook.security.AuthContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * 机构版：三套演示案例 + 教师真实租户（Logo / 品牌色 / 公开主页）。
 */
@Service
@RequiredArgsConstructor
public class OrgShowcaseService {

    private static final Set<String> RESERVED = Set.of("mine", "join", "joined", "qiming", "qingteng", "xinghe");
    private static final String PENDING = "PENDING";
    private static final String APPROVED = "APPROVED";
    private static final String REJECTED = "REJECTED";
    private static final String ORG_BANK = "org_bank";
    private static final String OWNER = "OWNER";
    private static final String ADMIN = "ADMIN";

    private final OrganizationRepository organizationRepository;
    private final OrgMemberRepository orgMemberRepository;
    private final OrgStaffRepository orgStaffRepository;
    private final UserRepository userRepository;
    private final QuestionRepository questionRepository;
    private final QuestionMarkRepository questionMarkRepository;
    private final TeacherWorkspaceService teacherWorkspaceService;
    private final TeacherService teacherService;
    private final CategorySeedService categorySeedService;

    public List<Map<String, Object>> list(String q) {
        ensureDemos();
        String needle = q == null ? "" : q.trim().toLowerCase(Locale.ROOT);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Organization org : organizationRepository.findAllByOrderByDemoDescCreatedAtDesc()) {
            if (!Boolean.TRUE.equals(org.getDemo()) && !Boolean.TRUE.equals(org.getPublished())) continue;
            if (!needle.isEmpty() && !matchesQuery(org, needle)) continue;
            out.add(publicCard(org));
        }
        return out;
    }

    public Map<String, Object> detail(String slug) {
        ensureDemos();
        Organization org = organizationRepository.findBySlug(slug)
                .orElseThrow(() -> new IllegalArgumentException("没有这个机构"));
        if (!Boolean.TRUE.equals(org.getDemo()) && !Boolean.TRUE.equals(org.getPublished())) {
            throw new IllegalArgumentException("这个机构尚未公开");
        }
        Map<String, Object> data = publicCard(org);
        attachViewer(data, org);
        return data;
    }

    public Map<String, Object> mine(long teacherId, String slug) {
        teacherWorkspaceService.requireTeacher(teacherId);
        ensureDemos();
        Organization org = resolveWorkspace(teacherId, slug, false);
        List<Map<String, Object>> staffOrgs = staffOrgRows(teacherId);
        if (org == null) {
            Map<String, Object> data = emptyMine();
            data.put("staffOrgs", staffOrgs);
            data.put("pendingCount", 0);
            data.put("canEditBrand", true);
            data.put("canManageStaff", false);
            data.put("canManageBank", false);
            data.put("myRole", "");
            data.put("staff", List.of());
            return data;
        }
        return packWorkspace(org, teacherId, staffOrgs);
    }

    @Transactional
    public Map<String, Object> saveMine(long teacherId, Map<String, Object> body) {
        User teacher = teacherWorkspaceService.requireTeacher(teacherId);
        String name = text(body.get("name"), 80);
        if (name.length() < 2) throw new IllegalArgumentException("请填写机构名称");
        Organization org = organizationRepository.findByOwnerId(teacherId).orElseGet(Organization::new);
        boolean creating = org.getId() == null;
        String slug = slugify(text(body.get("slug"), 40));
        if (slug.isEmpty()) slug = "org" + teacherId;
        if (RESERVED.contains(slug) && (creating || !slug.equals(org.getSlug()))) {
            throw new IllegalArgumentException("这个访问名已被演示案例占用");
        }
        Organization clash = organizationRepository.findBySlug(slug).orElse(null);
        if (clash != null && (org.getId() == null || !clash.getId().equals(org.getId()))) {
            throw new IllegalArgumentException("这个访问名已被占用");
        }
        if (creating) {
            org.setOwnerId(teacherId);
            org.setDemo(false);
            org.setPublished(false);
            org.setCreatedAt(LocalDateTime.now());
        }
        if (body.containsKey("published")) {
            org.setPublished(bool(body.get("published")));
        }
        org.setSlug(slug);
        org.setName(name);
        String shortName = text(body.get("shortName"), 20);
        org.setShortName(shortName.isEmpty() ? name.substring(0, Math.min(4, name.length())) : shortName);
        org.setCity(text(body.get("city"), 40));
        String mark = text(body.get("mark"), 8);
        org.setMark(mark.isEmpty() ? org.getShortName().substring(0, 1) : mark);
        org.setTagline(text(body.get("tagline"), 200));
        org.setHeadline(text(body.get("headline"), 200));
        org.setPitch(text(body.get("pitch"), 1200));
        org.setLogoUrl(text(body.get("logoUrl"), 500));
        org.setPrimaryColor(color(body.get("primary"), org.getPrimaryColor()));
        org.setAccentColor(color(body.get("accent"), org.getAccentColor()));
        org.setQuote(text(body.get("quote"), 400));
        String quoteBy = text(body.get("quoteBy"), 80);
        org.setQuoteBy(quoteBy.isEmpty() ? displayName(teacher) : quoteBy);
        ensureJoinCode(org);
        organizationRepository.save(org);
        if (creating) ensureOwnerStaff(org);
        return mine(teacherId, org.getSlug());
    }

    @Transactional
    public Map<String, Object> join(long studentId, String code) {
        String joinCode = code == null ? "" : code.trim().toUpperCase();
        if (joinCode.isEmpty()) throw new IllegalArgumentException("请输入机构加入码");
        Organization org = organizationRepository.findByJoinCode(joinCode)
                .filter(o -> !Boolean.TRUE.equals(o.getDemo()))
                .orElseThrow(() -> new IllegalArgumentException("加入码无效"));
        return applyTo(studentId, org);
    }

    @Transactional
    public Map<String, Object> applyBySlug(long studentId, String slug) {
        Organization org = organizationRepository.findBySlug(slug)
                .orElseThrow(() -> new IllegalArgumentException("没有这个机构"));
        if (Boolean.TRUE.equals(org.getDemo())) throw new IllegalArgumentException("示例机构不能加入");
        if (!Boolean.TRUE.equals(org.getPublished())) throw new IllegalArgumentException("这个机构尚未公开");
        return applyTo(studentId, org);
    }

    public List<Map<String, Object>> myOrgs(long studentId) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (OrgMember m : orgMemberRepository.findByStudentId(studentId)) {
            if (REJECTED.equals(m.getStatus())) continue;
            Organization org = organizationRepository.findById(m.getOrgId()).orElse(null);
            if (org == null || Boolean.TRUE.equals(org.getDemo())) continue;
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", org.getId());
            row.put("name", org.getName());
            row.put("slug", org.getSlug());
            row.put("city", org.getCity() == null ? "" : org.getCity());
            row.put("published", Boolean.TRUE.equals(org.getPublished()));
            row.put("status", statusApi(m.getStatus()));
            row.put("joinedAt", m.getApprovedAt() == null ? m.getRequestedAt() : m.getApprovedAt());
            userRepository.findById(org.getOwnerId() == null ? -1L : org.getOwnerId())
                    .ifPresent(t -> row.put("teacherName", t.getNickName()));
            out.add(row);
        }
        return out;
    }

    @Transactional
    public Map<String, Object> approveJoin(long teacherId, long studentId, String slug) {
        Organization org = staffedOrg(teacherId, slug);
        OrgMember m = orgMemberRepository.findByOrgIdAndStudentId(org.getId(), studentId)
                .orElseThrow(() -> new IllegalArgumentException("没有这条申请"));
        if (APPROVED.equals(m.getStatus())) {
            return Map.of("orgId", org.getId(), "studentId", studentId, "alreadyJoined", true);
        }
        m.setStatus(APPROVED);
        m.setApprovedAt(LocalDateTime.now());
        orgMemberRepository.save(m);
        return Map.of("orgId", org.getId(), "studentId", studentId);
    }

    @Transactional
    public Map<String, Object> rejectJoin(long teacherId, long studentId, String slug) {
        Organization org = staffedOrg(teacherId, slug);
        OrgMember m = orgMemberRepository.findByOrgIdAndStudentId(org.getId(), studentId)
                .orElseThrow(() -> new IllegalArgumentException("没有这条申请"));
        if (APPROVED.equals(m.getStatus())) throw new IllegalArgumentException("该学生已在机构中");
        m.setStatus(REJECTED);
        orgMemberRepository.save(m);
        return Map.of("orgId", org.getId(), "studentId", studentId);
    }

    public List<Map<String, Object>> listBank(long teacherId, String slug) {
        Organization org = staffedOrg(teacherId, slug);
        return mapOrgBank(loadOrgBank(org.getId()));
    }

    public List<Map<String, Object>> memberBank(long studentId, String slug) {
        return enrichBank(studentId, loadMemberBank(studentId, slug));
    }

    public List<Map<String, Object>> memberPractice(long studentId, String slug, boolean onlyUnmastered) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> q : memberBank(studentId, slug)) {
            boolean mastered = Boolean.TRUE.equals(q.get("mastered"));
            if (onlyUnmastered && mastered) continue;
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", q.get("id"));
            row.put("content", q.get("content"));
            row.put("answer", q.get("aiAnswer") == null ? "" : q.get("aiAnswer"));
            row.put("analysis", q.get("aiAnalysis") == null ? "" : q.get("aiAnalysis"));
            row.put("category", q.get("category"));
            row.put("difficulty", q.get("difficulty"));
            row.put("imageUrl", q.get("imageUrl"));
            row.put("mastered", mastered);
            out.add(row);
        }
        return out;
    }

    @Transactional
    public Map<String, Object> markMemberQuestion(long studentId, String slug, long questionId, boolean mastered) {
        List<Map<String, Object>> bank = loadMemberBank(studentId, slug);
        boolean found = false;
        for (Map<String, Object> q : bank) {
            Object id = q.get("id");
            if (id instanceof Number n && n.longValue() == questionId) {
                found = true;
                break;
            }
        }
        if (!found) throw new IllegalArgumentException("题目不在该机构题库中");
        QuestionMark mark = questionMarkRepository.findByUserIdAndQuestionId(studentId, questionId)
                .orElseGet(() -> {
                    QuestionMark m = new QuestionMark();
                    m.setUserId(studentId);
                    m.setQuestionId(questionId);
                    m.setFavorite(false);
                    m.setPinned(false);
                    return m;
                });
        mark.setMastered(mastered);
        questionMarkRepository.save(mark);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("questionId", questionId);
        data.put("mastered", mastered);
        return data;
    }

    @Transactional
    public Map<String, Object> leaveOrg(long studentId, String slug) {
        Organization org = organizationRepository.findBySlug(slug)
                .orElseThrow(() -> new IllegalArgumentException("没有这个机构"));
        OrgMember m = orgMemberRepository.findByOrgIdAndStudentId(org.getId(), studentId)
                .orElseThrow(() -> new IllegalArgumentException("你不在该机构中"));
        if (REJECTED.equals(m.getStatus())) throw new IllegalArgumentException("你不在该机构中");
        boolean pending = PENDING.equals(m.getStatus());
        orgMemberRepository.delete(m);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("orgId", org.getId());
        data.put("pending", pending);
        data.put("left", true);
        return data;
    }

    private List<Map<String, Object>> loadMemberBank(long studentId, String slug) {
        Organization org = organizationRepository.findBySlug(slug)
                .orElseThrow(() -> new IllegalArgumentException("没有这个机构"));
        if (Boolean.TRUE.equals(org.getDemo())) throw new IllegalArgumentException("示例机构没有专属题库");
        requireMemberOrStaff(studentId, org);
        return mapOrgBank(loadOrgBank(org.getId()));
    }

    private List<Map<String, Object>> enrichBank(long studentId, List<Map<String, Object>> rows) {
        List<Long> ids = new ArrayList<>();
        for (Map<String, Object> q : rows) {
            Object id = q.get("id");
            if (id instanceof Number n) ids.add(n.longValue());
        }
        Map<Long, QuestionMark> marks = new HashMap<>();
        if (!ids.isEmpty()) {
            for (QuestionMark m : questionMarkRepository.findByUserIdAndQuestionIdIn(studentId, ids)) {
                marks.put(m.getQuestionId(), m);
            }
        }
        for (Map<String, Object> q : rows) {
            Object id = q.get("id");
            long qid = id instanceof Number n ? n.longValue() : -1;
            QuestionMark mark = marks.get(qid);
            q.put("mastered", mark != null && Boolean.TRUE.equals(mark.getMastered()));
        }
        return rows;
    }

    @Transactional
    public Map<String, Object> addBank(long teacherId, Map<String, Object> body, String slug) {
        Organization org = staffedOrg(teacherId, slug);
        Object raw = body.get("questions");
        if (!(raw instanceof List<?> items) || items.isEmpty()) throw new IllegalArgumentException("请选择题目");
        String category = text(body.get("category"), 50);
        if (category.isEmpty()) category = "未分类";
        Question.DifficultyLevel difficulty = parseDifficulty(body.get("difficulty"));
        Category cat = categorySeedService.findForUser(teacherId, category);
        String defaultAnswer = text(body.get("answer"), 2000);
        String defaultAnalysis = text(body.get("analysis"), 4000);
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
            q.setOrgId(org.getId());
            q.setSource(ORG_BANK);
            q.setContent(content);
            q.setImageUrl(firstText(mm.get("imageUrl"), body.get("imageUrl")));
            q.setCategory(category);
            q.setCategoryId(cat == null ? 1L : cat.getId());
            q.setDifficulty(difficulty);
            String answer = firstText(mm.get("answer"), defaultAnswer);
            String analysis = firstText(mm.get("analysis"), defaultAnalysis);
            q.setAiAnswer(answer);
            q.setAiAnalysis(analysis);
            q.setAiStatus(Question.AiStatus.COMPLETED);
            q.setIsDeleted(false);
            q.setCreatedAt(LocalDateTime.now());
            q.setUpdatedAt(LocalDateTime.now());
            q = questionRepository.save(q);
            ids.add(q.getId());
            saved++;
        }
        if (ids.isEmpty()) throw new IllegalArgumentException("没有可保存的题目");
        Map<String, Object> d = new LinkedHashMap<>();
        d.put("ids", ids);
        d.put("savedCount", ids.size());
        return d;
    }

    @Transactional
    public void deleteBank(long teacherId, long questionId, String slug) {
        Organization org = staffedOrg(teacherId, slug);
        Question q = requireOrgQuestion(org.getId(), questionId);
        q.setIsDeleted(true);
        q.setUpdatedAt(LocalDateTime.now());
        questionRepository.save(q);
    }

    public Map<String, Object> students(long teacherId, String q, String slug) {
        Organization org = staffedOrg(teacherId, slug);
        String needle = q == null ? "" : q.trim().toLowerCase(Locale.ROOT);
        List<Map<String, Object>> members = new ArrayList<>();
        for (OrgMember m : orgMemberRepository.findByOrgIdAndStatusOrderByRequestedAtDesc(org.getId(), APPROVED)) {
            User u = userRepository.findById(m.getStudentId()).orElse(null);
            if (u == null) continue;
            String nick = u.getNickName() == null ? "" : u.getNickName();
            String username = u.getUsername() == null ? "" : u.getUsername();
            if (!needle.isEmpty()
                    && !nick.toLowerCase(Locale.ROOT).contains(needle)
                    && !username.toLowerCase(Locale.ROOT).contains(needle)) {
                continue;
            }
            long questions = questionRepository.countByUserIdAndIsDeleted(u.getId(), false);
            long mastered = questionMarkRepository.countByUserIdAndMasteredTrue(u.getId());
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", u.getId());
            row.put("nickName", nick);
            row.put("username", username);
            row.put("stage", u.getStage() == null ? "" : u.getStage());
            row.put("questionCount", questions);
            row.put("masteredCount", mastered);
            row.put("masteryRate", questions == 0 ? 0 : Math.round(mastered * 100.0 / questions));
            row.put("checkinStreak", u.getCheckinStreak() == null ? 0 : u.getCheckinStreak());
            row.put("joinedAt", m.getApprovedAt() == null ? m.getRequestedAt() : m.getApprovedAt());
            members.add(row);
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("pending", memberRows(org.getId(), PENDING));
        data.put("members", members);
        data.put("memberCount", members.size());
        return data;
    }

    @Transactional
    public Map<String, Object> removeMember(long teacherId, long studentId, String slug) {
        Organization org = staffedOrg(teacherId, slug);
        OrgMember m = orgMemberRepository.findByOrgIdAndStudentId(org.getId(), studentId)
                .orElseThrow(() -> new IllegalArgumentException("该学生不在机构中"));
        orgMemberRepository.delete(m);
        return Map.of("orgId", org.getId(), "studentId", studentId);
    }

    public Map<String, Object> analytics(long teacherId, String slug) {
        Organization org = staffedOrg(teacherId, slug);
        List<Long> ids = orgMemberRepository.findByOrgIdAndStatusOrderByRequestedAtDesc(org.getId(), APPROVED)
                .stream().map(OrgMember::getStudentId).toList();
        Map<String, Object> data = new LinkedHashMap<>(teacherService.analyticsFor(teacherId, ids));
        List<Question> bank = loadOrgBank(org.getId());
        List<Long> bankIds = bank.stream().map(Question::getId).toList();
        long tried = 0;
        long mastered = 0;
        long practicedStudents = 0;
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> students = (List<Map<String, Object>>) data.get("students");
        if (students == null) students = List.of();
        for (Map<String, Object> row : students) {
            Object rawId = row.get("id");
            long sid = rawId instanceof Number n ? n.longValue() : -1;
            long sTried = 0;
            long sMastered = 0;
            if (sid > 0 && !bankIds.isEmpty()) {
                for (QuestionMark mark : questionMarkRepository.findByUserIdAndQuestionIdIn(sid, bankIds)) {
                    sTried++;
                    if (Boolean.TRUE.equals(mark.getMastered())) sMastered++;
                }
            }
            if (sTried > 0) practicedStudents++;
            tried += sTried;
            mastered += sMastered;
            row.put("orgPracticeTried", sTried);
            row.put("orgPracticeMastered", sMastered);
            row.put("orgPracticeRate", bankIds.isEmpty() ? 0 : Math.round(sMastered * 100.0 / bankIds.size()));
        }
        data.put("bankCount", bankIds.size());
        data.put("memberCount", ids.size());
        data.put("orgPracticeTried", tried);
        data.put("orgPracticeMastered", mastered);
        data.put("orgPracticeStudents", practicedStudents);
        data.put("orgPracticeRate", tried == 0 ? 0 : Math.round(mastered * 100.0 / tried));
        return data;
    }

    public List<Map<String, Object>> listStaff(long teacherId, String slug) {
        Organization org = staffedOrg(teacherId, slug);
        return staffRows(org);
    }

    @Transactional
    public Map<String, Object> addStaff(long teacherId, String username) {
        Organization org = ownedOrg(teacherId);
        String name = username == null ? "" : username.trim();
        if (name.isEmpty()) throw new IllegalArgumentException("请填写老师账号");
        User teacher = userRepository.findByUsername(name)
                .orElseThrow(() -> new IllegalArgumentException("没有这个账号"));
        if (!"TEACHER".equals(teacher.getRole())) throw new IllegalArgumentException("只能添加老师账号");
        if (teacher.getId().equals(org.getOwnerId())) throw new IllegalArgumentException("创建者已在机构中");
        if (orgStaffRepository.findByOrgIdAndTeacherId(org.getId(), teacher.getId()).isPresent()) {
            throw new IllegalArgumentException("这位老师已在机构中");
        }
        OrgStaff staff = new OrgStaff();
        staff.setOrgId(org.getId());
        staff.setTeacherId(teacher.getId());
        staff.setRole(ADMIN);
        staff.setCreatedAt(LocalDateTime.now());
        orgStaffRepository.save(staff);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("orgId", org.getId());
        data.put("teacherId", teacher.getId());
        data.put("staff", staffRows(org));
        return data;
    }

    @Transactional
    public Map<String, Object> removeStaff(long teacherId, long staffTeacherId) {
        Organization org = ownedOrg(teacherId);
        if (org.getOwnerId() != null && org.getOwnerId().equals(staffTeacherId)) {
            throw new IllegalArgumentException("不能移除创建者");
        }
        OrgStaff staff = orgStaffRepository.findByOrgIdAndTeacherId(org.getId(), staffTeacherId)
                .orElseThrow(() -> new IllegalArgumentException("这位老师不在机构中"));
        orgStaffRepository.delete(staff);
        return Map.of("orgId", org.getId(), "teacherId", staffTeacherId);
    }

    private Map<String, Object> publicCard(Organization org) {
        Map<String, Object> card = brand(org);
        card.put("pitch", "");
        card.put("quote", "");
        card.put("quoteBy", "");
        card.put("headline", "");
        card.put("bank", List.of());
        card.put("roster", List.of());
        card.put("modules", List.of());
        card.put("analytics", List.of());
        card.put("story", List.of());
        card.put("classes", List.of());
        if (Boolean.TRUE.equals(org.getDemo())) {
            Map<String, Object> demo = demoPayload(org.getSlug());
            card.put("studentCount", demo.get("studentCount"));
            card.put("classCount", 0);
            if (blank(org.getTagline())) card.put("tagline", demo.get("tagline"));
        } else {
            int members = orgMemberRepository
                    .findByOrgIdAndStatusOrderByRequestedAtDesc(org.getId(), APPROVED).size();
            card.put("studentCount", members);
            card.put("classCount", 0);
        }
        return card;
    }

    private Map<String, Object> brand(Organization org) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("slug", org.getSlug());
        data.put("name", org.getName());
        data.put("shortName", org.getShortName());
        data.put("city", org.getCity());
        data.put("mark", org.getMark());
        data.put("tagline", org.getTagline());
        data.put("headline", org.getHeadline());
        data.put("pitch", org.getPitch());
        data.put("logoUrl", org.getLogoUrl() == null ? "" : org.getLogoUrl());
        data.put("quote", org.getQuote());
        data.put("quoteBy", org.getQuoteBy());
        data.put("demo", Boolean.TRUE.equals(org.getDemo()));
        data.put("ownerId", org.getOwnerId());
        Map<String, Object> theme = new LinkedHashMap<>();
        theme.put("primary", org.getPrimaryColor() == null ? "#2459ff" : org.getPrimaryColor());
        theme.put("accent", org.getAccentColor() == null ? "#52b7ff" : org.getAccentColor());
        data.put("theme", theme);
        return data;
    }

    private synchronized void ensureDemos() {
        seedDemo(qiming());
        seedDemo(qingteng());
        seedDemo(xinghe());
    }

    private void seedDemo(Map<String, Object> payload) {
        String slug = String.valueOf(payload.get("slug"));
        Organization org = organizationRepository.findBySlug(slug).orElseGet(Organization::new);
        boolean creating = org.getId() == null;
        org.setSlug(slug);
        org.setName(String.valueOf(payload.get("name")));
        org.setShortName(String.valueOf(payload.get("shortName")));
        org.setCity(String.valueOf(payload.get("city")));
        org.setMark(String.valueOf(payload.get("mark")));
        org.setTagline(String.valueOf(payload.get("tagline")));
        org.setHeadline("");
        org.setPitch("");
        org.setQuote("");
        org.setQuoteBy("");
        if (creating) org.setLogoUrl("");
        Object theme = payload.get("theme");
        if (theme instanceof Map<?, ?> t) {
            Object p = t.get("primary");
            Object a = t.get("accent");
            org.setPrimaryColor(p == null ? "#2459ff" : String.valueOf(p));
            org.setAccentColor(a == null ? "#52b7ff" : String.valueOf(a));
        }
        org.setDemo(true);
        org.setPublished(true);
        org.setOwnerId(null);
        if (creating) org.setCreatedAt(LocalDateTime.now());
        organizationRepository.save(org);
    }

    private Map<String, Object> demoPayload(String slug) {
        if ("qingteng".equals(slug)) return qingteng();
        if ("xinghe".equals(slug)) return xinghe();
        return qiming();
    }

    private Map<String, Object> qiming() {
        Map<String, Object> org = base(
                "qiming", "启明数理学院", "启明", "深圳", "启",
                "面向高中的数学竞赛培训。",
                "#1e3a5f", "#c9a227", 3, 86,
                "接入 12 周后，高一期中均分 +11.4"
        );
        org.put("pitch", "面向竞赛班和重点高中理科。机构自己的题库不和学生个人错题本混在一起，老师拍完卷直接进班级池，再一键发成练习或作业。");
        org.put("modules", List.of("专属题库", "多班级审批加入", "作业对错批改", "班级错题本", "家长周报", "教学效果分析"));
        org.put("bank", List.of(
                item("导数恒成立", "数学", "HARD", "已知 f(x)=ln x + a/x，当 x>1 时 f(x)≥0 恒成立，求 a 的取值范围。"),
                item("圆锥曲线焦点弦", "数学", "HARD", "椭圆 x²/4 + y²/3 = 1 过焦点的弦中点轨迹方程。"),
                item("数列通项与放缩", "数学", "MEDIUM", "由 aₙ₊₁ = (aₙ+2)/(aₙ+1) 求通项并证明 aₙ < √2。")
        ));
        org.put("classes", List.of(
                cls("高一竞赛 A 班", "高一", 28, 96, 78),
                cls("高一竞赛 B 班", "高一", 30, 91, 71),
                cls("高二冲刺班", "高二", 28, 88, 74)
        ));
        org.put("roster", List.of(
                student("林启辰", "高一竞赛 A 班", 41, 18, 94),
                student("周予安", "高一竞赛 A 班", 36, 12, 81),
                student("陈慕白", "高二冲刺班", 52, 21, 88)
        ));
        org.put("analytics", List.of(
                metric("作业提交率", "94%", "近 14 天"),
                metric("班级错题订正率", "72%", "已掌握 / 已下发"),
                metric("家长周报打开率", "81%", "本学期"),
                metric("高频错因", "配方漏常数 / 焦点弦中点", "本周")
        ));
        org.put("story", List.of(
                "第 1 周：把纸质周测拍进班级题库，按班级发成限时作业。",
                "第 4 周：对错批改后自动归入班级错题本，晚自习只练高频错题。",
                "第 12 周：高一期中均分 +11.4，家长周报成为班主任固定周五动作。"
        ));
        org.put("quote", "以前错题散在各班微信群。现在题库、作业、报告都在同一套班级工作台。");
        org.put("quoteBy", "启明数理 · 高一备课组长");
        return org;
    }

    private Map<String, Object> qingteng() {
        Map<String, Object> org = base(
                "qingteng", "青藤学业", "青藤", "广州", "藤",
                "初中全科托管，关注作业与日常学习。",
                "#0f6b4c", "#7bc47f", 4, 124,
                "托管班作业回收率做到 98%"
        );
        org.put("pitch", "连锁托管要的是「今晚有没有交、错在哪、家长能不能看见」。青藤用班级作业 + 社区互助，把晚辅导从对答案变成订正闭环。");
        org.put("modules", List.of("多校区班级", "作业回收", "互助答疑", "打卡广场", "家长报告", "学生名册检索"));
        org.put("bank", List.of(
                item("一元二次方程应用", "数学", "MEDIUM", "矩形花园周长 48 m，面积最大时边长是多少？"),
                item("阅读理解主旨", "英语", "MEDIUM", "根据短文选出作者对学校午餐改革的态度。"),
                item("凸透镜成像", "物理", "EASY", "物体从两倍焦距外移向焦点，像如何变化？")
        ));
        org.put("classes", List.of(
                cls("初二（3）班托管", "初二", 32, 99, 69),
                cls("初二（5）班托管", "初二", 30, 97, 64),
                cls("初三冲刺晚辅", "初三", 34, 98, 73),
                cls("初一衔接班", "初一", 28, 96, 58)
        ));
        org.put("roster", List.of(
                student("黄小禾", "初二（3）班托管", 22, 9, 90),
                student("邓可心", "初三冲刺晚辅", 39, 15, 86),
                student("许予风", "初二（5）班托管", 18, 4, 72)
        ));
        org.put("analytics", List.of(
                metric("作业回收率", "98%", "近 30 天"),
                metric("互助帖回复时长", "14 分钟", "中位数"),
                metric("连续打卡 ≥7 天", "61%", "在读学生"),
                metric("家长报告送达", "每周五 20:00", "自动")
        ));
        org.put("story", List.of(
                "把四个托管班的纸质练习统一拍照进班。",
                "学生在社区互助里问「这题卡在第二问」，值班老师当晚回复。",
                "未交作业的名单直接出现在老师名册搜索里，前台不用再对微信。"
        ));
        org.put("quote", "回收率不再靠群里 @所有人。没交的人，名册里一眼能搜到。");
        org.put("quoteBy", "青藤学业 · 运营主管");
        return org;
    }

    private Map<String, Object> xinghe() {
        Map<String, Object> org = base(
                "xinghe", "星河艺文塾", "星河", "杭州", "河",
                "语文专项，覆盖文言文、作文和朗读。",
                "#4a1c2a", "#d4a574", 2, 54,
                "作文错因报告让家长第一次看懂「为什么只有 42 分」"
        );
        org.put("pitch", "艺文类机构最怕系统长得像理科刷题机。星河案例用同一套老师工作台，换成墨色皮肤，题库改成文言文与作文片段，家长报告改写错因而不是正确率。");
        org.put("modules", List.of("白标皮肤", "文言专属题库", "作文错因分析", "班级助手", "家长周报", "打卡社区"));
        org.put("bank", List.of(
                item("文言实词", "语文", "MEDIUM", "解释「走」在「两股战战，几欲先走」中的意思，并再举一例。"),
                item("作文立意", "语文", "HARD", "以「把名字写小」为题，列出三种容易跑题的立意并改正。"),
                item("句子仿写", "语文", "EASY", "仿照「书是一行行的足迹」再写两个比喻句。")
        ));
        org.put("classes", List.of(
                cls("初三文言精读", "初三", 26, 92, 77),
                cls("高一作文工坊", "高一", 28, 89, 68)
        ));
        org.put("roster", List.of(
                student("沈清和", "高一作文工坊", 15, 6, 84),
                student("顾晚宁", "初三文言精读", 27, 11, 91),
                student("梁知夏", "高一作文工坊", 19, 5, 76)
        ));
        org.put("analytics", List.of(
                metric("错因报告完成率", "100%", "每次作文课后"),
                metric("家长打开「错因」一节", "86%", "高于正确率一节"),
                metric("文言实词订正", "2.3 轮", "平均每篇"),
                metric("社区朗读打卡", "44 人", "本周")
        ));
        org.put("story", List.of(
                "把作文纸拍照进班，老师只标对错，系统出【错因】【立意】【下一步】。",
                "家长报告不再只给分数，第一屏是「跑题 / 素材旧 / 结尾空」三张卡片。",
                "机构对外讲课时直接打开这页案例，作为白标定制样板。"
        ));
        org.put("quote", "家长要看的不是 42 分，是这 42 分到底栽在立意还是素材。");
        org.put("quoteBy", "星河艺文塾 · 主讲老师");
        return org;
    }

    private Map<String, Object> base(String slug, String name, String shortName, String city, String mark,
                                    String tagline, String primary, String accent, int classCount, int studentCount,
                                    String headline) {
        Map<String, Object> org = new LinkedHashMap<>();
        org.put("slug", slug);
        org.put("name", name);
        org.put("shortName", shortName);
        org.put("city", city);
        org.put("mark", mark);
        org.put("tagline", tagline);
        org.put("headline", headline);
        org.put("classCount", classCount);
        org.put("studentCount", studentCount);
        org.put("logoUrl", "");
        Map<String, Object> theme = new LinkedHashMap<>();
        theme.put("primary", primary);
        theme.put("accent", accent);
        org.put("theme", theme);
        org.put("demo", true);
        return org;
    }

    private Map<String, Object> item(String title, String subject, String difficulty, String content) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("title", title);
        row.put("subject", subject);
        row.put("difficulty", difficulty);
        row.put("content", content);
        return row;
    }

    private Map<String, Object> cls(String name, String grade, int students, int submitRate, int mastery) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("name", name);
        row.put("grade", grade);
        row.put("students", students);
        row.put("submitRate", submitRate);
        row.put("mastery", mastery);
        return row;
    }

    private Map<String, Object> student(String name, String className, int questions, int mastered, int submit) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("name", name);
        row.put("className", className);
        row.put("questions", questions);
        row.put("mastered", mastered);
        row.put("submit", submit);
        return row;
    }

    private Map<String, Object> metric(String label, String value, String hint) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("label", label);
        row.put("value", value);
        row.put("hint", hint);
        return row;
    }

    private Organization ownedOrg(long teacherId) {
        teacherWorkspaceService.requireTeacher(teacherId);
        Organization org = organizationRepository.findByOwnerId(teacherId)
                .orElseThrow(() -> new IllegalArgumentException("还没有开通机构"));
        ensureOwnerStaff(org);
        return org;
    }

    private Organization staffedOrg(long teacherId, String slug) {
        Organization org = resolveWorkspace(teacherId, slug, true);
        if (org == null) throw new IllegalArgumentException("还没有开通机构");
        return org;
    }

    private Organization resolveWorkspace(long teacherId, String slug, boolean required) {
        teacherWorkspaceService.requireTeacher(teacherId);
        if (slug != null && !slug.isBlank()) {
            Organization org = organizationRepository.findBySlug(slug.trim())
                    .orElseThrow(() -> new IllegalArgumentException("没有这个机构"));
            if (Boolean.TRUE.equals(org.getDemo())) throw new IllegalArgumentException("示例机构不能管理");
            if (!isStaff(org, teacherId)) throw new IllegalArgumentException("无权管理该机构");
            if (isOwner(org, teacherId)) ensureOwnerStaff(org);
            return org;
        }
        Organization owned = organizationRepository.findByOwnerId(teacherId).orElse(null);
        if (owned != null) {
            ensureOwnerStaff(owned);
            return owned;
        }
        for (OrgStaff staff : orgStaffRepository.findByTeacherId(teacherId)) {
            Organization org = organizationRepository.findById(staff.getOrgId()).orElse(null);
            if (org == null || Boolean.TRUE.equals(org.getDemo())) continue;
            return org;
        }
        if (required) throw new IllegalArgumentException("还没有开通机构");
        return null;
    }

    private Map<String, Object> packWorkspace(Organization org, long teacherId, List<Map<String, Object>> staffOrgs) {
        ensureJoinCode(org);
        if (isOwner(org, teacherId)) ensureOwnerStaff(org);
        boolean owner = isOwner(org, teacherId);
        List<Map<String, Object>> pending = memberRows(org.getId(), PENDING);
        Map<String, Object> data = brand(org);
        data.put("exists", true);
        data.put("published", Boolean.TRUE.equals(org.getPublished()));
        data.put("joinCode", org.getJoinCode() == null ? "" : org.getJoinCode());
        data.put("publicPath", "/orgs/" + org.getSlug());
        data.put("pending", pending);
        data.put("pendingCount", pending.size());
        data.put("members", memberRows(org.getId(), APPROVED));
        data.put("bankCount", loadOrgBank(org.getId()).size());
        data.put("memberCount", orgMemberRepository
                .findByOrgIdAndStatusOrderByRequestedAtDesc(org.getId(), APPROVED).size());
        data.put("canEditBrand", owner);
        data.put("canManageStaff", owner);
        data.put("canManageBank", true);
        data.put("myRole", staffRole(org, teacherId));
        data.put("staff", staffRows(org));
        data.put("staffOrgs", staffOrgs);
        return data;
    }

    private Map<String, Object> emptyMine() {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("exists", false);
        data.put("published", false);
        data.put("joinCode", "");
        data.put("slug", "");
        data.put("name", "");
        data.put("shortName", "");
        data.put("city", "");
        data.put("mark", "");
        data.put("tagline", "");
        data.put("headline", "");
        data.put("pitch", "");
        data.put("logoUrl", "");
        data.put("quote", "");
        data.put("quoteBy", "");
        Map<String, Object> theme = new LinkedHashMap<>();
        theme.put("primary", "#2459ff");
        theme.put("accent", "#52b7ff");
        data.put("theme", theme);
        data.put("demo", false);
        data.put("pending", List.of());
        data.put("members", List.of());
        data.put("bankCount", 0);
        data.put("memberCount", 0);
        return data;
    }

    private List<Map<String, Object>> staffOrgRows(long teacherId) {
        Map<Long, Map<String, Object>> byId = new LinkedHashMap<>();
        organizationRepository.findByOwnerId(teacherId).ifPresent(org -> byId.put(org.getId(), staffOrgRow(org, OWNER)));
        for (OrgStaff staff : orgStaffRepository.findByTeacherId(teacherId)) {
            if (byId.containsKey(staff.getOrgId())) continue;
            Organization org = organizationRepository.findById(staff.getOrgId()).orElse(null);
            if (org == null || Boolean.TRUE.equals(org.getDemo())) continue;
            byId.put(org.getId(), staffOrgRow(org, staff.getRole()));
        }
        return new ArrayList<>(byId.values());
    }

    private Map<String, Object> staffOrgRow(Organization org, String role) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", org.getId());
        row.put("slug", org.getSlug());
        row.put("name", org.getName());
        row.put("shortName", org.getShortName());
        row.put("role", role);
        row.put("pendingCount", orgMemberRepository.findByOrgIdAndStatusOrderByRequestedAtDesc(org.getId(), PENDING).size());
        return row;
    }

    private List<Map<String, Object>> staffRows(Organization org) {
        Map<Long, Map<String, Object>> byId = new LinkedHashMap<>();
        if (org.getOwnerId() != null) {
            byId.put(org.getOwnerId(), staffUserRow(org.getOwnerId(), OWNER));
        }
        for (OrgStaff staff : orgStaffRepository.findByOrgIdOrderByCreatedAtAsc(org.getId())) {
            if (byId.containsKey(staff.getTeacherId())) continue;
            byId.put(staff.getTeacherId(), staffUserRow(staff.getTeacherId(), staff.getRole()));
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> row : byId.values()) {
            if (row != null) out.add(row);
        }
        return out;
    }

    private Map<String, Object> staffUserRow(long teacherId, String role) {
        User u = userRepository.findById(teacherId).orElse(null);
        if (u == null) return null;
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", u.getId());
        row.put("nickName", u.getNickName() == null ? "" : u.getNickName());
        row.put("username", u.getUsername());
        row.put("role", OWNER.equals(role) ? OWNER : ADMIN);
        return row;
    }

    private void ensureOwnerStaff(Organization org) {
        if (org.getId() == null || org.getOwnerId() == null) return;
        OrgStaff existing = orgStaffRepository.findByOrgIdAndTeacherId(org.getId(), org.getOwnerId()).orElse(null);
        if (existing != null) {
            if (!OWNER.equals(existing.getRole())) {
                existing.setRole(OWNER);
                orgStaffRepository.save(existing);
            }
            return;
        }
        OrgStaff staff = new OrgStaff();
        staff.setOrgId(org.getId());
        staff.setTeacherId(org.getOwnerId());
        staff.setRole(OWNER);
        staff.setCreatedAt(LocalDateTime.now());
        orgStaffRepository.save(staff);
    }

    private boolean isOwner(Organization org, long teacherId) {
        return org.getOwnerId() != null && org.getOwnerId().equals(teacherId);
    }

    private boolean isStaff(Organization org, long teacherId) {
        if (isOwner(org, teacherId)) return true;
        return orgStaffRepository.findByOrgIdAndTeacherId(org.getId(), teacherId).isPresent();
    }

    private String staffRole(Organization org, long teacherId) {
        if (isOwner(org, teacherId)) return OWNER;
        return orgStaffRepository.findByOrgIdAndTeacherId(org.getId(), teacherId)
                .map(OrgStaff::getRole)
                .orElse("");
    }

    private void requireMemberOrStaff(long userId, Organization org) {
        if (isStaff(org, userId)) return;
        OrgMember m = orgMemberRepository.findByOrgIdAndStudentId(org.getId(), userId)
                .orElseThrow(() -> new IllegalArgumentException("通过后才能查看题库"));
        if (!APPROVED.equals(m.getStatus())) throw new IllegalArgumentException("通过后才能查看题库");
    }

    private List<Question> loadOrgBank(Long orgId) {
        if (orgId == null) return List.of();
        return questionRepository.findByOrgIdAndSourceAndIsDeletedFalseOrderByCreatedAtDesc(orgId, ORG_BANK);
    }

    private List<Map<String, Object>> mapOrgBank(List<Question> questions) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Question q : questions) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", q.getId());
            m.put("content", q.getContent());
            m.put("category", q.getCategory() == null || q.getCategory().isBlank() ? "未分类" : q.getCategory());
            m.put("difficulty", q.getDifficulty() == null ? "MEDIUM" : q.getDifficulty().name());
            m.put("aiAnswer", q.getAiAnswer() == null ? "" : q.getAiAnswer());
            m.put("aiAnalysis", q.getAiAnalysis() == null ? "" : q.getAiAnalysis());
            m.put("imageUrl", q.getImageUrl());
            m.put("source", ORG_BANK);
            m.put("orgId", q.getOrgId());
            out.add(m);
        }
        return out;
    }

    private Question requireOrgQuestion(Long orgId, long questionId) {
        Question q = questionRepository.findById(questionId)
                .orElseThrow(() -> new IllegalArgumentException("题目不存在"));
        if (Boolean.TRUE.equals(q.getIsDeleted()) || !ORG_BANK.equals(q.getSource())
                || q.getOrgId() == null || !q.getOrgId().equals(orgId)) {
            throw new IllegalArgumentException("题目不在该机构题库中");
        }
        return q;
    }

    private Question.DifficultyLevel parseDifficulty(Object raw) {
        String s = raw == null ? "" : String.valueOf(raw).trim().toUpperCase(Locale.ROOT);
        if (s.contains("EASY") || s.contains("简单")) return Question.DifficultyLevel.EASY;
        if (s.contains("HARD") || s.contains("困难")) return Question.DifficultyLevel.HARD;
        return Question.DifficultyLevel.MEDIUM;
    }

    private String firstText(Object... vals) {
        if (vals == null) return "";
        for (Object v : vals) {
            if (v == null) continue;
            String s = String.valueOf(v).trim();
            if (!s.isEmpty() && !"null".equalsIgnoreCase(s)) return s;
        }
        return "";
    }

    private Map<String, Object> applyTo(long studentId, Organization org) {
        User me = userRepository.findById(studentId).orElseThrow(() -> new IllegalArgumentException("用户不存在"));
        if ("TEACHER".equals(me.getRole())) throw new IllegalArgumentException("教师账号不能加入机构");
        OrgMember existing = orgMemberRepository.findByOrgIdAndStudentId(org.getId(), studentId).orElse(null);
        if (existing != null && APPROVED.equals(existing.getStatus())) {
            return joinResult(org, false, true, "approved");
        }
        if (existing != null && PENDING.equals(existing.getStatus())) {
            return joinResult(org, true, false, "pending");
        }
        if (existing == null) {
            existing = new OrgMember();
            existing.setOrgId(org.getId());
            existing.setStudentId(studentId);
        }
        existing.setStatus(PENDING);
        existing.setRequestedAt(LocalDateTime.now());
        existing.setApprovedAt(null);
        orgMemberRepository.save(existing);
        return joinResult(org, true, false, "pending");
    }

    private void attachViewer(Map<String, Object> data, Organization org) {
        data.put("membership", "none");
        data.put("canApply", false);
        Long uid = AuthContext.getUserId();
        if (uid == null || Boolean.TRUE.equals(org.getDemo())) return;
        if (org.getOwnerId() != null && org.getOwnerId().equals(uid)) {
            data.put("membership", "owner");
            return;
        }
        if (orgStaffRepository.findByOrgIdAndTeacherId(org.getId(), uid).isPresent()) {
            data.put("membership", "staff");
            return;
        }
        User u = userRepository.findById(uid).orElse(null);
        if (u == null || "TEACHER".equals(u.getRole())) {
            data.put("membership", "teacher");
            return;
        }
        OrgMember m = orgMemberRepository.findByOrgIdAndStudentId(org.getId(), uid).orElse(null);
        if (m != null && APPROVED.equals(m.getStatus())) {
            data.put("membership", "approved");
            return;
        }
        if (m != null && PENDING.equals(m.getStatus())) {
            data.put("membership", "pending");
            return;
        }
        data.put("canApply", Boolean.TRUE.equals(org.getPublished()));
    }

    private boolean matchesQuery(Organization org, String needle) {
        String hay = ((org.getName() == null ? "" : org.getName())
                + " " + (org.getShortName() == null ? "" : org.getShortName())
                + " " + (org.getCity() == null ? "" : org.getCity())
                + " " + (org.getTagline() == null ? "" : org.getTagline())
                + " " + (org.getSlug() == null ? "" : org.getSlug()))
                .toLowerCase(Locale.ROOT);
        return hay.contains(needle);
    }

    private Map<String, Object> joinResult(Organization org, boolean pending, boolean alreadyJoined, String status) {
        Map<String, Object> d = new LinkedHashMap<>();
        d.put("orgId", org.getId());
        d.put("name", org.getName());
        d.put("pending", pending);
        d.put("alreadyJoined", alreadyJoined);
        d.put("status", status);
        return d;
    }

    private List<Map<String, Object>> memberRows(Long orgId, String status) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (OrgMember m : orgMemberRepository.findByOrgIdAndStatusOrderByRequestedAtDesc(orgId, status)) {
            userRepository.findById(m.getStudentId()).ifPresent(u -> {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("id", u.getId());
                row.put("nickName", u.getNickName() == null ? "" : u.getNickName());
                row.put("username", u.getUsername());
                row.put("status", statusApi(m.getStatus()));
                row.put("requestedAt", m.getRequestedAt());
                row.put("joinedAt", m.getApprovedAt() == null ? m.getRequestedAt() : m.getApprovedAt());
                out.add(row);
            });
        }
        return out;
    }

    private void ensureJoinCode(Organization org) {
        if (org.getJoinCode() != null && !org.getJoinCode().isBlank()) return;
        org.setJoinCode(newOrgJoinCode());
        if (org.getId() != null) organizationRepository.save(org);
    }

    private String newOrgJoinCode() {
        for (int i = 0; i < 12; i++) {
            String code = UUID.randomUUID().toString().replace("-", "").substring(0, 6).toUpperCase();
            if (organizationRepository.findByJoinCode(code).isEmpty()) return code;
        }
        return UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase();
    }

    private String statusApi(String status) {
        if (APPROVED.equals(status)) return "approved";
        if (REJECTED.equals(status)) return "rejected";
        return "pending";
    }

    private boolean bool(Object raw) {
        if (raw instanceof Boolean b) return b;
        return "true".equalsIgnoreCase(String.valueOf(raw));
    }

    private String text(Object raw, int max) {
        String s = raw == null ? "" : String.valueOf(raw).trim();
        return s.length() <= max ? s : s.substring(0, max);
    }

    private String color(Object raw, String fallback) {
        String s = raw == null ? "" : String.valueOf(raw).trim();
        if (s.matches("#[0-9a-fA-F]{6}")) return s.toLowerCase(Locale.ROOT);
        return fallback == null || fallback.isBlank() ? "#2459ff" : fallback;
    }

    private String slugify(String raw) {
        String s = raw == null ? "" : raw.trim().toLowerCase(Locale.ROOT);
        s = s.replaceAll("[^a-z0-9-]", "");
        s = s.replaceAll("-{2,}", "-");
        if (s.startsWith("-")) s = s.substring(1);
        if (s.endsWith("-")) s = s.substring(0, s.length() - 1);
        return s.length() <= 40 ? s : s.substring(0, 40);
    }

    private boolean blank(String s) {
        return s == null || s.isBlank();
    }

    private String displayName(User user) {
        if (user.getNickName() != null && !user.getNickName().isBlank()) return user.getNickName();
        return user.getUsername();
    }
}
