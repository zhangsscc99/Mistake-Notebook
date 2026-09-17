package com.mistake.notebook.service;

import com.mistake.notebook.entity.Checkin;
import com.mistake.notebook.entity.CheckinPost;
import com.mistake.notebook.entity.CheckinPostLike;
import com.mistake.notebook.entity.User;
import com.mistake.notebook.repository.CheckinPostLikeRepository;
import com.mistake.notebook.repository.CheckinPostRepository;
import com.mistake.notebook.repository.CheckinRepository;
import com.mistake.notebook.repository.LearningReportRepository;
import com.mistake.notebook.repository.MistakeReportRepository;
import com.mistake.notebook.repository.QuestionMarkRepository;
import com.mistake.notebook.repository.QuestionNoteRepository;
import com.mistake.notebook.repository.QuestionRepository;
import com.mistake.notebook.repository.SavedPaperRepository;
import com.mistake.notebook.repository.UserRepository;
import com.mistake.notebook.repository.CategoryRepository;
import com.mistake.notebook.repository.ChatMemoryRepository;
import com.mistake.notebook.repository.TeacherStudentRepository;
import com.mistake.notebook.repository.TeacherMessageRepository;
import com.mistake.notebook.repository.HomeworkRepository;
import com.mistake.notebook.repository.HomeworkSubmissionRepository;
import com.mistake.notebook.repository.ClassNotebookRepository;
import com.mistake.notebook.repository.ClassNotebookProgressRepository;
import com.mistake.notebook.repository.ParentReportRepository;
import com.mistake.notebook.repository.QuestionExplanationRepository;
import com.mistake.notebook.repository.TeacherClassRepository;
import com.mistake.notebook.repository.ClassMemberRepository;
import com.mistake.notebook.repository.TeacherPaperRepository;
import com.mistake.notebook.repository.HelpPostRepository;
import com.mistake.notebook.repository.HelpReplyRepository;
import com.mistake.notebook.repository.FriendshipRepository;
import com.mistake.notebook.repository.PkMatchRepository;
import com.mistake.notebook.repository.HelpPostLikeRepository;
import com.mistake.notebook.repository.OrganizationRepository;
import com.mistake.notebook.security.TokenService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserAccountService {

    private static final ZoneId CN = ZoneId.of("Asia/Shanghai");
    private static final int COIN_BASE = 10;
    private static final int COIN_CHAT = 5;
    private static final int COIN_PAPER = 5;
    private static final int VIP_COST = 200;
    private static final int VIP_DAYS = 7;
    private static final int FREE_DAILY_CHAT = 100;

    private final UserRepository userRepository;
    private final CheckinRepository checkinRepository;
    private final CheckinPostRepository checkinPostRepository;
    private final CheckinPostLikeRepository checkinPostLikeRepository;
    private final QuestionRepository questionRepository;
    private final CategorySeedService categorySeedService;
    private final SavedPaperRepository savedPaperRepository;
    private final QuestionMarkRepository questionMarkRepository;
    private final QuestionNoteRepository questionNoteRepository;
    private final LearningReportRepository learningReportRepository;
    private final MistakeReportRepository mistakeReportRepository;
    private final TokenService tokenService;
    private final ChatMemoryRepository chatMemoryRepository;
    private final CategoryRepository categoryRepository;
    private final TeacherStudentRepository teacherStudentRepository;
    private final TeacherMessageRepository teacherMessageRepository;
    private final HomeworkRepository homeworkRepository;
    private final HomeworkSubmissionRepository homeworkSubmissionRepository;
    private final ClassNotebookRepository classNotebookRepository;
    private final ClassNotebookProgressRepository classNotebookProgressRepository;
    private final ParentReportRepository parentReportRepository;
    private final QuestionExplanationRepository questionExplanationRepository;
    private final TeacherClassRepository teacherClassRepository;
    private final ClassMemberRepository classMemberRepository;
    private final TeacherPaperRepository teacherPaperRepository;
    private final HelpPostRepository helpPostRepository;
    private final HelpReplyRepository helpReplyRepository;
    private final FriendshipRepository friendshipRepository;
    private final PkMatchRepository pkMatchRepository;
    private final HelpPostLikeRepository helpPostLikeRepository;
    private final OrganizationRepository organizationRepository;

    @Transactional
    public Map<String, Object> register(String username, String password, String nickName) {
        return register(username, password, nickName, "STUDENT");
    }

    @Transactional
    public Map<String, Object> register(String username, String password, String nickName, String role) {
        String userKey = username.trim();
        if (userKey.length() < 2 || userKey.length() > 40) {
            throw new IllegalArgumentException("账号长度为 2–40 个字符");
        }
        if (password == null || password.length() < 4) {
            throw new IllegalArgumentException("密码至少 4 位");
        }
        if (userRepository.findByUsername(userKey).isPresent()) {
            throw new IllegalArgumentException("这个账号已被注册");
        }
        User user = new User();
        user.setUsername(userKey);
        String salt = UUID.randomUUID().toString().replace("-", "");
        user.setPasswordSalt(salt);
        user.setPasswordHash(hash(salt, password));
        String nick = nickName == null ? "" : nickName.trim();
        user.setNickName(nick.isEmpty() ? "匿名用户" : nick.substring(0, Math.min(20, nick.length())));
        boolean teacher = "TEACHER".equalsIgnoreCase(role == null ? "" : role.trim());
        user.setRole(teacher ? "TEACHER" : "STUDENT");
        if (teacher) {
            user.setInviteCode(newInviteCode());
        }
        user.setCreatedAt(LocalDateTime.now());
        user.setUpdatedAt(LocalDateTime.now());
        user = userRepository.save(user);
        if (!teacher) {
            categorySeedService.seedForUser(user.getId());
        }
        return authPayload(user, true);
    }

    private String newInviteCode() {
        String alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        java.security.SecureRandom rnd = new java.security.SecureRandom();
        for (int attempt = 0; attempt < 20; attempt++) {
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < 6; i++) sb.append(alphabet.charAt(rnd.nextInt(alphabet.length())));
            String code = sb.toString();
            if (userRepository.findByInviteCode(code).isEmpty()) return code;
        }
        return UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }

    /** 老账号没有角色/邀请码时补齐 */
    @Transactional
    public User ensureRole(User user) {
        boolean dirty = false;
        if (user.getRole() == null || user.getRole().isBlank()) {
            user.setRole("STUDENT");
            dirty = true;
        }
        if ("TEACHER".equals(user.getRole()) && (user.getInviteCode() == null || user.getInviteCode().isBlank())) {
            user.setInviteCode(newInviteCode());
            dirty = true;
        }
        return dirty ? userRepository.save(user) : user;
    }

    public Map<String, Object> login(String username, String password) {
        User user = userRepository.findByUsername(username == null ? "" : username.trim())
                .orElseThrow(() -> new IllegalArgumentException("账号或密码不对"));
        if (!hash(user.getPasswordSalt(), password == null ? "" : password).equals(user.getPasswordHash())) {
            throw new IllegalArgumentException("账号或密码不对");
        }
        user = ensureRole(user);
        if (!"TEACHER".equals(user.getRole())) {
            categorySeedService.seedForUser(user.getId());
        }
        return authPayload(user, false);
    }

    @Transactional
    public Map<String, Object> changePassword(long userId, String oldPassword, String newPassword) {
        User user = userRepository.findById(userId).orElseThrow(() -> new IllegalArgumentException("用户不存在"));
        if (!hash(user.getPasswordSalt(), oldPassword == null ? "" : oldPassword).equals(user.getPasswordHash())) {
            throw new IllegalArgumentException("原密码不对");
        }
        if (newPassword == null || newPassword.length() < 4) {
            throw new IllegalArgumentException("新密码至少 4 位");
        }
        String salt = UUID.randomUUID().toString().replace("-", "");
        user.setPasswordSalt(salt);
        user.setPasswordHash(hash(salt, newPassword));
        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);
        Map<String, Object> data = new HashMap<>();
        data.put("token", tokenService.issue(user.getId()));
        return data;
    }

    public Map<String, Object> profile(long userId) {
        User user = ensureRole(userRepository.findById(userId).orElseThrow(() -> new IllegalArgumentException("用户不存在")));
        Map<String, Object> data = userMap(user);
        data.put("hasProfile", true);
        return data;
    }

    @Transactional
    public Map<String, Object> updateProfile(long userId, Map<String, Object> body) {
        User user = userRepository.findById(userId).orElseThrow(() -> new IllegalArgumentException("用户不存在"));
        if (body.get("nickName") instanceof String nick) {
            String trimmed = nick.trim();
            if (trimmed.codePointCount(0, trimmed.length()) > 20) {
                throw new IllegalArgumentException("昵称不能超过 20 个字");
            }
            user.setNickName(trimmed.isEmpty() ? "匿名用户" : trimmed);
        }
        if (body.get("stage") instanceof String stage) {
            user.setStage(stage.trim());
        }
        if (body.get("avatarUrl") instanceof String avatar) {
            user.setAvatarUrl(avatar);
        }
        if (body.get("leaderboardPublic") instanceof Boolean pub) {
            user.setLeaderboardPublic(pub);
        }
        if (body.get("school") instanceof String school) {
            user.setSchool(school.trim().substring(0, Math.min(60, school.trim().length())));
        }
        if (body.get("className") instanceof String cls) {
            user.setClassName(cls.trim().substring(0, Math.min(60, cls.trim().length())));
        }
        user.setUpdatedAt(LocalDateTime.now());
        return userMap(userRepository.save(user));
    }

    public Map<String, Object> wallet(long userId) {
        User user = userRepository.findById(userId).orElseThrow(() -> new IllegalArgumentException("用户不存在"));
        String today = cnDay(LocalDate.now(CN));
        boolean todayChecked = checkinRepository.findByUserIdAndDayKey(userId, today).isPresent();
        Map<String, Object> bonus = new HashMap<>();
        bonus.put("base", COIN_BASE);
        boolean chatToday = chatToday(user, today);
        boolean paperToday = paperToday(userId);
        bonus.put("chat", chatToday ? COIN_CHAT : 0);
        bonus.put("paper", paperToday ? COIN_PAPER : 0);
        bonus.put("total", COIN_BASE + (chatToday ? COIN_CHAT : 0) + (paperToday ? COIN_PAPER : 0));

        List<Map<String, Object>> recentDays = new ArrayList<>();
        for (int i = 6; i >= 0; i--) {
            LocalDate d = LocalDate.now(CN).minusDays(i);
            String key = cnDay(d);
            Map<String, Object> cell = new HashMap<>();
            cell.put("dayKey", key);
            cell.put("day", d.getDayOfMonth());
            cell.put("isToday", i == 0);
            cell.put("checked", checkinRepository.findByUserIdAndDayKey(userId, key).isPresent());
            recentDays.add(cell);
        }

        Map<String, Object> data = new HashMap<>();
        data.put("coins", user.getCoins());
        data.put("checkinStreak", user.getCheckinStreak());
        data.put("checkinTotalDays", user.getCheckinTotalDays());
        data.put("todayChecked", todayChecked);
        data.put("recentDays", recentDays);
        data.put("todayBonus", bonus);
        data.put("vipCost", VIP_COST);
        data.put("vipDays", VIP_DAYS);
        data.put("vipExpireAt", user.getVipExpireAt());
        data.put("isVip", isVip(user));
        data.put("vipExpireText", formatVip(user.getVipExpireAt()));
        return data;
    }

    @Transactional
    public Map<String, Object> checkin(long userId) {
        User user = userRepository.findById(userId).orElseThrow(() -> new IllegalArgumentException("用户不存在"));
        String today = cnDay(LocalDate.now(CN));
        if (checkinRepository.findByUserIdAndDayKey(userId, today).isPresent()) {
            throw new IllegalArgumentException("今天已经打过卡了");
        }
        int coins = COIN_BASE
                + (chatToday(user, today) ? COIN_CHAT : 0)
                + (paperToday(userId) ? COIN_PAPER : 0);
        Checkin row = new Checkin();
        row.setUserId(userId);
        row.setDayKey(today);
        row.setCoins(coins);
        checkinRepository.save(row);

        String yesterday = cnDay(LocalDate.now(CN).minusDays(1));
        int streak = yesterday.equals(user.getCheckinLastDay()) ? user.getCheckinStreak() + 1 : 1;
        user.setCheckinStreak(streak);
        user.setCheckinLastDay(today);
        user.setCheckinTotalDays(user.getCheckinTotalDays() + 1);
        user.setCoins(user.getCoins() + coins);
        userRepository.save(user);
        Map<String, Object> data = wallet(userId);
        data.put("rewarded", coins);
        data.put("canSharePlaza", checkinPostRepository.findByUserIdAndDayKey(userId, today).isEmpty());
        return data;
    }

    @Transactional
    public Map<String, Object> publishCheckinPost(long userId, String rawContent) {
        User user = userRepository.findById(userId).orElseThrow(() -> new IllegalArgumentException("用户不存在"));
        String today = cnDay(LocalDate.now(CN));
        if (checkinRepository.findByUserIdAndDayKey(userId, today).isEmpty()) {
            throw new IllegalArgumentException("今天还没打卡，先打卡再分享到广场");
        }
        if (checkinPostRepository.findByUserIdAndDayKey(userId, today).isPresent()) {
            throw new IllegalArgumentException("今天已经分享过打卡了");
        }
        String content = sanitizePlazaText(rawContent);
        if (content.isBlank()) {
            content = "今日已打卡，继续整理错题。";
        }
        CheckinPost post = new CheckinPost();
        post.setUserId(userId);
        post.setDayKey(today);
        post.setContent(content);
        post.setStreak(user.getCheckinStreak() == null ? 0 : user.getCheckinStreak());
        post.setTotalDays(user.getCheckinTotalDays() == null ? 0 : user.getCheckinTotalDays());
        post.setQuestionCount((int) questionRepository.countByUserIdAndIsDeleted(userId, false));
        post.setLikeCount(0);
        post.setCreatedAt(LocalDateTime.now(CN));
        checkinPostRepository.save(post);
        return toPostMap(post, user, true, false);
    }

    public List<Map<String, Object>> checkinFeed(long userId) {
        List<CheckinPost> posts = checkinPostRepository.findTop80ByOrderByCreatedAtDesc();
        List<Long> ids = posts.stream().map(CheckinPost::getId).toList();
        java.util.Set<Long> liked = new java.util.HashSet<>();
        if (!ids.isEmpty()) {
            for (CheckinPostLike like : checkinPostLikeRepository.findByUserIdAndPostIdIn(userId, ids)) {
                liked.add(like.getPostId());
            }
        }
        List<Map<String, Object>> rows = new ArrayList<>();
        for (CheckinPost post : posts) {
            User author = userRepository.findById(post.getUserId()).orElse(null);
            rows.add(toPostMap(post, author, userId == post.getUserId(), liked.contains(post.getId())));
        }
        return rows;
    }

    @Transactional
    public Map<String, Object> toggleCheckinLike(long userId, long postId) {
        CheckinPost post = checkinPostRepository.findById(postId)
                .orElseThrow(() -> new IllegalArgumentException("动态不存在"));
        var existing = checkinPostLikeRepository.findByPostIdAndUserId(postId, userId);
        boolean liked;
        if (existing.isPresent()) {
            checkinPostLikeRepository.delete(existing.get());
            post.setLikeCount(Math.max(0, post.getLikeCount() - 1));
            liked = false;
        } else {
            CheckinPostLike like = new CheckinPostLike();
            like.setPostId(postId);
            like.setUserId(userId);
            checkinPostLikeRepository.save(like);
            post.setLikeCount(post.getLikeCount() + 1);
            liked = true;
        }
        checkinPostRepository.save(post);
        Map<String, Object> data = new HashMap<>();
        data.put("liked", liked);
        data.put("likeCount", post.getLikeCount());
        data.put("id", post.getId());
        return data;
    }

    private Map<String, Object> toPostMap(CheckinPost post, User author, boolean mine, boolean liked) {
        Map<String, Object> row = new HashMap<>();
        row.put("id", post.getId());
        row.put("content", post.getContent());
        row.put("streak", post.getStreak());
        row.put("totalDays", post.getTotalDays());
        row.put("questionCount", post.getQuestionCount());
        row.put("likeCount", post.getLikeCount());
        row.put("dayKey", post.getDayKey());
        row.put("createdAt", post.getCreatedAt());
        row.put("mine", mine);
        row.put("liked", liked);
        row.put("nickName", author == null ? "同学" : author.getNickName());
        row.put("avatarUrl", author == null ? "" : author.getAvatarUrl());
        return row;
    }

    private String sanitizePlazaText(String raw) {
        if (raw == null) return "";
        String text = raw.replaceAll("<[^>]*>", "").replaceAll("\\s+", " ").trim();
        return text.length() > 80 ? text.substring(0, 80) : text;
    }

    /** 今天有过 AI 对话（会员不计次数，则看当天是否有记录 dayKey） */
    private boolean chatToday(User user, String today) {
        return today.equals(user.getChatDayKey()) && user.getChatUsedCount() != null && user.getChatUsedCount() > 0;
    }

    /** 今天保存过试卷 */
    private boolean paperToday(long userId) {
        LocalDateTime startOfDay = LocalDate.now(CN).atStartOfDay();
        return savedPaperRepository.countByUserIdAndIsDeletedFalseAndCreatedAtAfter(userId, startOfDay) > 0;
    }

    @Transactional
    public Map<String, Object> redeemVip(long userId) {
        User user = userRepository.findById(userId).orElseThrow(() -> new IllegalArgumentException("用户不存在"));
        if (user.getCoins() < VIP_COST) {
            throw new IllegalArgumentException("金币不够，再打卡攒一攒");
        }
        user.setCoins(user.getCoins() - VIP_COST);
        LocalDateTime now = LocalDateTime.now(CN);
        LocalDateTime start = isVip(user) ? parseVip(user.getVipExpireAt()) : now;
        if (start.isBefore(now)) start = now;
        LocalDateTime expire = start.plusDays(VIP_DAYS);
        user.setVipExpireAt(expire.toString());
        userRepository.save(user);
        return wallet(userId);
    }

    public Map<String, Object> stats(long userId) {
        Map<String, Object> data = new HashMap<>();
        data.put("questionCount", questionRepository.countByUserIdAndIsDeleted(userId, false));
        data.put("paperCount", savedPaperRepository.countByUserIdAndIsDeletedFalse(userId));
        data.put("favoriteCount", questionMarkRepository.countByUserIdAndFavoriteTrue(userId));
        data.put("pinnedCount", questionMarkRepository.countByUserIdAndPinnedTrue(userId));
        data.put("noteCount", questionNoteRepository.countByUserId(userId));
        data.put("reportCount", learningReportRepository.countByUserId(userId)
                + mistakeReportRepository.countByUserId(userId));
        User user = userRepository.findById(userId).orElseThrow();
        data.put("checkinStreak", user.getCheckinStreak());
        data.put("checkinTotalDays", user.getCheckinTotalDays());
        data.put("isVip", isVip(user));
        data.put("totalQuestions", data.get("questionCount"));
        data.put("totalCategories", categorySeedService.listForUser(userId).size());
        return data;
    }

    public List<Map<String, Object>> leaderboard() {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (User user : userRepository.findByLeaderboardPublicTrue()) {
            long questions = questionRepository.countByUserIdAndIsDeleted(user.getId(), false);
            Map<String, Object> row = new HashMap<>();
            row.put("nickName", user.getNickName());
            row.put("avatarUrl", user.getAvatarUrl());
            row.put("checkinStreak", user.getCheckinStreak());
            row.put("checkinTotalDays", user.getCheckinTotalDays());
            row.put("questionCount", questions);
            row.put("score", user.getCheckinTotalDays() * 8 + questions * 6);
            rows.add(row);
        }
        rows.sort((a, b) -> Long.compare(((Number) b.get("score")).longValue(), ((Number) a.get("score")).longValue()));
        for (int i = 0; i < rows.size(); i++) rows.get(i).put("rank", i + 1);
        return rows;
    }

    public Map<String, Object> chatQuota(long userId) {
        User user = userRepository.findById(userId).orElseThrow(() -> new IllegalArgumentException("用户不存在"));
        return buildQuota(user);
    }

    @Transactional
    public Map<String, Object> consumeChatQuota(long userId) {
        User user = userRepository.findById(userId).orElseThrow(() -> new IllegalArgumentException("用户不存在"));
        Map<String, Object> quota = buildQuota(user);
        if (!Boolean.TRUE.equals(quota.get("allowed"))) {
            return quota;
        }
        String today = String.valueOf(quota.get("dayKey"));
        int used = today.equals(user.getChatDayKey()) && user.getChatUsedCount() != null ? user.getChatUsedCount() + 1 : 1;
        user.setChatDayKey(today);
        user.setChatUsedCount(used);
        userRepository.save(user);
        if (!Boolean.TRUE.equals(quota.get("isVip"))) {
            quota.put("used", used);
            quota.put("remaining", Math.max(0, FREE_DAILY_CHAT - used));
        }
        return quota;
    }

    public Map<String, Object> learningOverview(long userId) {
        User user = userRepository.findById(userId).orElseThrow(() -> new IllegalArgumentException("用户不存在"));
        long questionCount = questionRepository.countByUserIdAndIsDeleted(userId, false);
        List<Map<String, Object>> categories = new ArrayList<>();
        long max = 1;
        for (Object[] row : questionRepository.countCategoryByUserId(userId)) {
            long count = ((Number) row[1]).longValue();
            max = Math.max(max, count);
            Map<String, Object> cat = new HashMap<>();
            cat.put("name", row[0] == null ? "未分类" : String.valueOf(row[0]));
            cat.put("count", count);
            categories.add(cat);
        }
        for (Map<String, Object> cat : categories) {
            long count = ((Number) cat.get("count")).longValue();
            cat.put("pct", Math.round(count * 100.0 / max));
        }
        Map<String, Object> difficulties = new HashMap<>();
        difficulties.put("EASY", 0);
        difficulties.put("MEDIUM", 0);
        difficulties.put("HARD", 0);
        for (Object[] row : questionRepository.countDifficultyByUserId(userId)) {
            if (row[0] != null) {
                difficulties.put(String.valueOf(row[0]), ((Number) row[1]).longValue());
            }
        }
        Map<String, Object> data = new HashMap<>();
        data.put("questionCount", questionCount);
        data.put("categoryCount", categorySeedService.listForUser(userId).size());
        data.put("categories", categories);
        data.put("difficulties", difficulties);
        data.put("masteredCount", questionMarkRepository.countByUserIdAndMasteredTrue(userId));
        data.put("favoriteCount", questionMarkRepository.countByUserIdAndFavoriteTrue(userId));
        data.put("pinnedCount", questionMarkRepository.countByUserIdAndPinnedTrue(userId));
        data.put("noteCount", questionNoteRepository.countByUserId(userId));
        data.put("paperCount", savedPaperRepository.countByUserIdAndIsDeletedFalse(userId));
        data.put("checkinStreak", user.getCheckinStreak());
        data.put("checkinTotalDays", user.getCheckinTotalDays());
        data.put("stage", user.getStage() == null ? "" : user.getStage());
        data.put("canGenerate", questionCount >= 1);
        data.put("minQuestions", 1);
        return data;
    }

    @Transactional
    public Map<String, Object> deleteAccount(long userId) {
        Map<String, Object> removed = new HashMap<>();
        List<String> failed = new ArrayList<>();
        purge(failed, removed, "chatMemories", () -> chatMemoryRepository.deleteByClientId("web-" + userId));
        purge(failed, removed, "teacherLinks", () -> { teacherStudentRepository.deleteByStudentId(userId); teacherStudentRepository.deleteByTeacherId(userId); });
        purge(failed, removed, "classMembers", () -> {
            classMemberRepository.deleteByStudentId(userId);
            teacherClassRepository.findByTeacherIdAndIsDeletedFalseOrderByCreatedAtDesc(userId)
                    .forEach(c -> classMemberRepository.deleteByClassId(c.getId()));
        });
        purge(failed, removed, "teacherClasses", () -> teacherClassRepository.deleteByTeacherId(userId));
        purge(failed, removed, "teacherPapers", () -> teacherPaperRepository.deleteByTeacherId(userId));
        purge(failed, removed, "messages", () -> { teacherMessageRepository.deleteByStudentId(userId); teacherMessageRepository.deleteByTeacherId(userId); });
        purge(failed, removed, "homeworkSubmissions", () -> homeworkSubmissionRepository.deleteByStudentId(userId));
        purge(failed, removed, "homeworks", () -> homeworkRepository.deleteByTeacherId(userId));
        purge(failed, removed, "classNotebooks", () -> { classNotebookProgressRepository.deleteByStudentId(userId); classNotebookRepository.deleteByTeacherId(userId); });
        purge(failed, removed, "parentReports", () -> { parentReportRepository.deleteByStudentId(userId); parentReportRepository.deleteByTeacherId(userId); });
        purge(failed, removed, "explanations", () -> questionExplanationRepository.deleteByUserId(userId));
        purge(failed, removed, "questionMarks", () -> questionMarkRepository.deleteByUserId(userId));
        purge(failed, removed, "questionNotes", () -> questionNoteRepository.deleteByUserId(userId));
        purge(failed, removed, "mistakeReports", () -> mistakeReportRepository.deleteByUserId(userId));
        purge(failed, removed, "learningReports", () -> learningReportRepository.deleteByUserId(userId));
        purge(failed, removed, "savedPapers", () -> savedPaperRepository.deleteByUserId(userId));
        purge(failed, removed, "helpLikes", () -> helpPostLikeRepository.deleteByUserId(userId));
        purge(failed, removed, "helpReplies", () -> helpReplyRepository.deleteByUserId(userId));
        purge(failed, removed, "helpPosts", () -> helpPostRepository.deleteByUserId(userId));
        purge(failed, removed, "friendships", () -> friendshipRepository.deleteByUserIdOrFriendId(userId, userId));
        purge(failed, removed, "pkMatches", () -> pkMatchRepository.deleteByChallengerIdOrOpponentId(userId, userId));
        purge(failed, removed, "organizations", () -> organizationRepository.deleteByOwnerId(userId));
        purge(failed, removed, "checkinLikes", () -> checkinPostLikeRepository.deleteByUserId(userId));
        purge(failed, removed, "checkinPosts", () -> checkinPostRepository.deleteByUserId(userId));
        purge(failed, removed, "checkins", () -> checkinRepository.deleteByUserId(userId));
        purge(failed, removed, "questions", () -> questionRepository.deleteAll(questionRepository.findByUserId(userId)));
        purge(failed, removed, "categories", () -> categoryRepository.deleteByUserId(userId));
        purge(failed, removed, "users", () -> userRepository.deleteById(userId));
        Map<String, Object> data = new HashMap<>();
        data.put("removed", removed);
        data.put("failed", failed);
        data.put("complete", failed.isEmpty());
        return data;
    }

    private void purge(List<String> failed, Map<String, Object> removed, String key, Runnable action) {
        try {
            action.run();
            removed.put(key, 1);
        } catch (Exception e) {
            failed.add(key + ": " + e.getMessage());
        }
    }

    private Map<String, Object> buildQuota(User user) {
        String today = cnDay(LocalDate.now(CN));
        boolean vip = isVip(user);
        int used = 0;
        if (today.equals(user.getChatDayKey() == null ? "" : user.getChatDayKey())) {
            used = user.getChatUsedCount() == null ? 0 : user.getChatUsedCount();
        }
        Map<String, Object> data = new HashMap<>();
        data.put("dayKey", today);
        data.put("isVip", vip);
        data.put("vipExpireAt", user.getVipExpireAt());
        data.put("limit", FREE_DAILY_CHAT);
        data.put("used", vip ? 0 : used);
        data.put("remaining", vip ? -1 : Math.max(0, FREE_DAILY_CHAT - used));
        data.put("allowed", vip || used < FREE_DAILY_CHAT);
        return data;
    }

    private Map<String, Object> authPayload(User user, boolean created) {
        Map<String, Object> data = userMap(user);
        data.put("token", tokenService.issue(user.getId()));
        data.put("created", created);
        return data;
    }

    private Map<String, Object> userMap(User user) {
        Map<String, Object> data = new HashMap<>();
        data.put("id", user.getId());
        data.put("username", user.getUsername());
        data.put("nickName", user.getNickName());
        data.put("avatarUrl", user.getAvatarUrl());
        data.put("stage", user.getStage());
        data.put("coins", user.getCoins());
        data.put("vipExpireAt", user.getVipExpireAt());
        data.put("checkinStreak", user.getCheckinStreak());
        data.put("checkinTotalDays", user.getCheckinTotalDays());
        data.put("leaderboardPublic", user.getLeaderboardPublic());
        data.put("isVip", isVip(user));
        data.put("role", user.getRole() == null || user.getRole().isBlank() ? "STUDENT" : user.getRole());
        data.put("inviteCode", user.getInviteCode() == null ? "" : user.getInviteCode());
        data.put("school", user.getSchool() == null ? "" : user.getSchool());
        data.put("className", user.getClassName() == null ? "" : user.getClassName());
        return data;
    }

    public boolean isTeacher(long userId) {
        return userRepository.findById(userId).map(u -> "TEACHER".equals(u.getRole())).orElse(false);
    }

    private boolean isVip(User user) {
        LocalDateTime exp = parseVip(user.getVipExpireAt());
        return exp != null && exp.isAfter(LocalDateTime.now(CN));
    }

    private LocalDateTime parseVip(String raw) {
        if (raw == null || raw.isBlank()) return LocalDateTime.MIN;
        try {
            return LocalDateTime.parse(raw);
        } catch (Exception e) {
            return LocalDateTime.MIN;
        }
    }

    private String formatVip(String raw) {
        LocalDateTime exp = parseVip(raw);
        if (exp == null || exp.equals(LocalDateTime.MIN)) return "";
        return exp.toLocalDate().toString();
    }

    private String cnDay(LocalDate d) {
        return d.format(DateTimeFormatter.ISO_LOCAL_DATE);
    }

    private String hash(String salt, String password) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] out = md.digest((salt + password).getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : out) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
