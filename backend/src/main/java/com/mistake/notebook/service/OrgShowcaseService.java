package com.mistake.notebook.service;

import com.mistake.notebook.entity.OrgMember;
import com.mistake.notebook.entity.Organization;
import com.mistake.notebook.entity.User;
import com.mistake.notebook.repository.OrgMemberRepository;
import com.mistake.notebook.repository.OrganizationRepository;
import com.mistake.notebook.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
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

    private final OrganizationRepository organizationRepository;
    private final OrgMemberRepository orgMemberRepository;
    private final UserRepository userRepository;
    private final TeacherWorkspaceService teacherWorkspaceService;
    private final TeacherService teacherService;

    public List<Map<String, Object>> list() {
        ensureDemos();
        List<Map<String, Object>> out = new ArrayList<>();
        for (Organization org : organizationRepository.findAllByOrderByDemoDescCreatedAtDesc()) {
            if (!Boolean.TRUE.equals(org.getDemo()) && !Boolean.TRUE.equals(org.getPublished())) continue;
            out.add(card(org));
        }
        return out;
    }

    public Map<String, Object> detail(String slug) {
        ensureDemos();
        Organization org = organizationRepository.findBySlug(slug)
                .orElseThrow(() -> new IllegalArgumentException("没有这个机构"));
        if (Boolean.TRUE.equals(org.getDemo())) {
            Map<String, Object> demo = demoPayload(slug);
            overlayBrand(demo, org);
            return demo;
        }
        if (!Boolean.TRUE.equals(org.getPublished())) {
            throw new IllegalArgumentException("这个机构尚未公开");
        }
        return liveDetail(org);
    }

    public Map<String, Object> mine(long teacherId) {
        teacherWorkspaceService.requireTeacher(teacherId);
        ensureDemos();
        return organizationRepository.findByOwnerId(teacherId)
                .map(org -> {
                    ensureJoinCode(org);
                    Map<String, Object> data = brand(org);
                    data.put("exists", true);
                    data.put("published", Boolean.TRUE.equals(org.getPublished()));
                    data.put("joinCode", org.getJoinCode() == null ? "" : org.getJoinCode());
                    data.put("publicPath", "/orgs/" + org.getSlug());
                    data.put("pending", memberRows(org.getId(), PENDING));
                    data.put("members", memberRows(org.getId(), APPROVED));
                    return data;
                })
                .orElseGet(() -> {
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
                    return data;
                });
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
        return mine(teacherId);
    }

    @Transactional
    public Map<String, Object> join(long studentId, String code) {
        User me = userRepository.findById(studentId).orElseThrow(() -> new IllegalArgumentException("用户不存在"));
        if ("TEACHER".equals(me.getRole())) throw new IllegalArgumentException("教师账号不能加入机构");
        String joinCode = code == null ? "" : code.trim().toUpperCase();
        if (joinCode.isEmpty()) throw new IllegalArgumentException("请输入机构加入码");
        Organization org = organizationRepository.findByJoinCode(joinCode)
                .filter(o -> !Boolean.TRUE.equals(o.getDemo()))
                .orElseThrow(() -> new IllegalArgumentException("加入码无效"));
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
    public Map<String, Object> approveJoin(long teacherId, long studentId) {
        Organization org = ownedOrg(teacherId);
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
    public Map<String, Object> rejectJoin(long teacherId, long studentId) {
        Organization org = ownedOrg(teacherId);
        OrgMember m = orgMemberRepository.findByOrgIdAndStudentId(org.getId(), studentId)
                .orElseThrow(() -> new IllegalArgumentException("没有这条申请"));
        if (APPROVED.equals(m.getStatus())) throw new IllegalArgumentException("该学生已在机构中");
        m.setStatus(REJECTED);
        orgMemberRepository.save(m);
        return Map.of("orgId", org.getId(), "studentId", studentId);
    }

    private Map<String, Object> card(Organization org) {
        Map<String, Object> card = brand(org);
        if (Boolean.TRUE.equals(org.getDemo())) {
            Map<String, Object> demo = demoPayload(org.getSlug());
            card.put("studentCount", demo.get("studentCount"));
            card.put("classCount", demo.get("classCount"));
            if (blank(org.getHeadline())) card.put("headline", demo.get("headline"));
            if (blank(org.getTagline())) card.put("tagline", demo.get("tagline"));
        } else {
            try {
                Map<String, Object> dash = teacherWorkspaceService.dashboard(org.getOwnerId());
                card.put("studentCount", dash.getOrDefault("studentCount", 0));
                card.put("classCount", dash.get("classes") instanceof List<?> list ? list.size() : 0);
            } catch (Exception e) {
                card.put("studentCount", 0);
                card.put("classCount", 0);
            }
            if (blank(org.getHeadline())) card.put("headline", "真实入驻机构，班级与题库来自老师工作台");
        }
        return card;
    }

    private Map<String, Object> liveDetail(Organization org) {
        Map<String, Object> data = brand(org);
        data.put("exists", true);
        List<Map<String, Object>> classes = new ArrayList<>();
        List<Map<String, Object>> roster = new ArrayList<>();
        List<Map<String, Object>> bank = new ArrayList<>();
        int studentCount = 0;
        try {
            List<Map<String, Object>> cls = teacherWorkspaceService.listClasses(org.getOwnerId());
            for (Map<String, Object> c : cls) {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("name", c.get("name"));
                row.put("grade", c.get("grade"));
                Object n = c.get("studentCount");
                int students = n instanceof Number num ? num.intValue() : 0;
                row.put("students", students);
                studentCount += students;
                classes.add(row);
                Long classId = c.get("id") instanceof Number id ? id.longValue() : null;
                if (classId == null) continue;
                if (roster.size() < 12) {
                    for (Map<String, Object> s : teacherWorkspaceService.listStudents(org.getOwnerId(), classId)) {
                        if (roster.size() >= 12) break;
                        Map<String, Object> stu = new LinkedHashMap<>();
                        stu.put("name", s.get("nickName") != null ? s.get("nickName") : s.get("username"));
                        stu.put("className", c.get("name"));
                        stu.put("questions", s.getOrDefault("questionCount", 0));
                        stu.put("mastered", s.getOrDefault("masteredCount", 0));
                        roster.add(stu);
                    }
                }
                if (bank.size() < 8) {
                    for (Map<String, Object> q : teacherWorkspaceService.listBank(org.getOwnerId(), classId)) {
                        if (bank.size() >= 8) break;
                        String content = String.valueOf(q.getOrDefault("content", "")).trim();
                        if (content.isEmpty()) continue;
                        Map<String, Object> item = new LinkedHashMap<>();
                        item.put("title", content.length() <= 20 ? content : content.substring(0, 20) + "…");
                        item.put("subject", q.getOrDefault("category", ""));
                        item.put("difficulty", q.getOrDefault("difficulty", "MEDIUM"));
                        item.put("content", content);
                        bank.add(item);
                    }
                }
            }
        } catch (Exception ignored) {
            // keep empty lists
        }
        data.put("classCount", classes.size());
        data.put("studentCount", studentCount);
        data.put("classes", classes);
        data.put("roster", roster);
        data.put("bank", bank);
        data.put("modules", List.of("真实租户", "Logo 与品牌色", "多班级审批", "班级题库", "作业与练习", "教学分析"));
        if (blank(org.getPitch())) {
            data.put("pitch", "这是老师自己开通的机构主页。班级、学生和题库来自教师工作台的真实数据，不是演示案例。");
        }
        if (blank(org.getHeadline())) {
            data.put("headline", classes.isEmpty() ? "刚入驻，班级还在建设中" : "在读 " + studentCount + " 人 · " + classes.size() + " 个班");
        }
        List<Map<String, Object>> analytics = new ArrayList<>();
        try {
            Map<String, Object> a = teacherService.analytics(org.getOwnerId());
            analytics.add(metric("在读学生", String.valueOf(a.getOrDefault("studentCount", studentCount)), "工作台名册"));
            analytics.add(metric("错题总量", String.valueOf(a.getOrDefault("totalQuestions", 0)), "学生错题本"));
            analytics.add(metric("掌握率", a.getOrDefault("masteryRate", 0) + "%", "已掌握 / 错题"));
            analytics.add(metric("本周活跃", String.valueOf(a.getOrDefault("activeWeek", 0)), "近 7 天有录入"));
            analytics.add(metric("作业份数", String.valueOf(a.getOrDefault("homeworkCount", 0)), "已布置"));
            analytics.add(metric("作业提交", String.valueOf(a.getOrDefault("submissionCount", 0)), "累计回收"));
        } catch (Exception e) {
            analytics.add(metric("在读学生", String.valueOf(studentCount), "工作台名册"));
            analytics.add(metric("班级", String.valueOf(classes.size()), "已创建"));
        }
        data.put("analytics", analytics);
        data.put("story", List.of(
                "老师开通机构主页，决定是否公开发布。",
                "学生输入机构加入码申请，老师通过后才会进入机构。",
                "班级加入码仍然只管进班，和机构加入是两件事。"
        ));
        return data;
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

    private void overlayBrand(Map<String, Object> demo, Organization org) {
        demo.put("logoUrl", org.getLogoUrl() == null ? "" : org.getLogoUrl());
        demo.put("demo", true);
        if (!blank(org.getName())) demo.put("name", org.getName());
        if (!blank(org.getShortName())) demo.put("shortName", org.getShortName());
        if (!blank(org.getTagline())) demo.put("tagline", org.getTagline());
        if (!blank(org.getHeadline())) demo.put("headline", org.getHeadline());
        Map<String, Object> theme = new LinkedHashMap<>();
        theme.put("primary", org.getPrimaryColor());
        theme.put("accent", org.getAccentColor());
        demo.put("theme", theme);
    }

    private synchronized void ensureDemos() {
        seedDemo(qiming());
        seedDemo(qingteng());
        seedDemo(xinghe());
    }

    private void seedDemo(Map<String, Object> payload) {
        String slug = String.valueOf(payload.get("slug"));
        if (organizationRepository.existsBySlug(slug)) return;
        Organization org = new Organization();
        org.setSlug(slug);
        org.setName(String.valueOf(payload.get("name")));
        org.setShortName(String.valueOf(payload.get("shortName")));
        org.setCity(String.valueOf(payload.get("city")));
        org.setMark(String.valueOf(payload.get("mark")));
        org.setTagline(String.valueOf(payload.get("tagline")));
        org.setHeadline(String.valueOf(payload.get("headline")));
        org.setPitch(String.valueOf(payload.getOrDefault("pitch", "")));
        org.setQuote(String.valueOf(payload.getOrDefault("quote", "")));
        org.setQuoteBy(String.valueOf(payload.getOrDefault("quoteBy", "")));
        org.setLogoUrl("");
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
        org.setCreatedAt(LocalDateTime.now());
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
                "竞赛向高中数学专训。专属题库、班级作业、家长周报一套走完。",
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
                "初中全科托管。作业回收、互助答疑、打卡社区一起开给学生和家长看。",
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
                "语文专项。文言文、作文错因、朗读打卡，给教培机构做白标皮肤。",
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
        return organizationRepository.findByOwnerId(teacherId)
                .orElseThrow(() -> new IllegalArgumentException("还没有开通机构"));
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
