package com.mistake.notebook.service;

import com.mistake.notebook.entity.Checkin;
import com.mistake.notebook.entity.User;
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

    @Transactional
    public Map<String, Object> register(String username, String password, String nickName) {
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
        user.setCreatedAt(LocalDateTime.now());
        user.setUpdatedAt(LocalDateTime.now());
        user = userRepository.save(user);
        categorySeedService.seedForUser(user.getId());
        return authPayload(user, true);
    }

    public Map<String, Object> login(String username, String password) {
        User user = userRepository.findByUsername(username == null ? "" : username.trim())
                .orElseThrow(() -> new IllegalArgumentException("账号或密码不对"));
        if (!hash(user.getPasswordSalt(), password == null ? "" : password).equals(user.getPasswordHash())) {
            throw new IllegalArgumentException("账号或密码不对");
        }
        categorySeedService.seedForUser(user.getId());
        return authPayload(user, false);
    }

    public Map<String, Object> profile(long userId) {
        User user = userRepository.findById(userId).orElseThrow(() -> new IllegalArgumentException("用户不存在"));
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
        user.setUpdatedAt(LocalDateTime.now());
        return userMap(userRepository.save(user));
    }

    public Map<String, Object> wallet(long userId) {
        User user = userRepository.findById(userId).orElseThrow(() -> new IllegalArgumentException("用户不存在"));
        String today = cnDay(LocalDate.now(CN));
        boolean todayChecked = checkinRepository.findByUserIdAndDayKey(userId, today).isPresent();
        Map<String, Object> bonus = new HashMap<>();
        bonus.put("base", COIN_BASE);
        boolean chatToday = false;
        boolean paperToday = false;
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
        int coins = COIN_BASE;
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
        return wallet(userId);
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
        if (!Boolean.TRUE.equals(quota.get("isVip"))) {
            int used = ((Number) quota.get("used")).intValue() + 1;
            user.setChatDayKey(String.valueOf(quota.get("dayKey")));
            user.setChatUsedCount(used);
            userRepository.save(user);
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
        purge(failed, removed, "questionMarks", () -> questionMarkRepository.deleteByUserId(userId));
        purge(failed, removed, "questionNotes", () -> questionNoteRepository.deleteByUserId(userId));
        purge(failed, removed, "mistakeReports", () -> mistakeReportRepository.deleteByUserId(userId));
        purge(failed, removed, "learningReports", () -> learningReportRepository.deleteByUserId(userId));
        purge(failed, removed, "savedPapers", () -> savedPaperRepository.deleteByUserId(userId));
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
        if (!vip) {
            if (today.equals(user.getChatDayKey() == null ? "" : user.getChatDayKey())) {
                used = user.getChatUsedCount() == null ? 0 : user.getChatUsedCount();
            }
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
        return data;
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
