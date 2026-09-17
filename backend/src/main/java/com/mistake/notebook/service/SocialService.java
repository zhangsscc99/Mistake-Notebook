package com.mistake.notebook.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mistake.notebook.entity.Friendship;
import com.mistake.notebook.entity.HelpPost;
import com.mistake.notebook.entity.HelpPostLike;
import com.mistake.notebook.entity.HelpReply;
import com.mistake.notebook.entity.PkMatch;
import com.mistake.notebook.entity.Question;
import com.mistake.notebook.entity.User;
import com.mistake.notebook.repository.CheckinPostRepository;
import com.mistake.notebook.repository.FriendshipRepository;
import com.mistake.notebook.repository.HelpPostLikeRepository;
import com.mistake.notebook.repository.HelpPostRepository;
import com.mistake.notebook.repository.HelpReplyRepository;
import com.mistake.notebook.repository.PkMatchRepository;
import com.mistake.notebook.repository.QuestionMarkRepository;
import com.mistake.notebook.repository.QuestionRepository;
import com.mistake.notebook.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class SocialService {

    private static final DateTimeFormatter CLOCK = DateTimeFormatter.ofPattern("MM-dd HH:mm");
    private static final TypeReference<List<Map<String, Object>>> MAP_LIST = new TypeReference<>() {};

    private final UserRepository userRepository;
    private final HelpPostRepository helpPostRepository;
    private final HelpReplyRepository helpReplyRepository;
    private final HelpPostLikeRepository helpPostLikeRepository;
    private final FriendshipRepository friendshipRepository;
    private final PkMatchRepository pkMatchRepository;
    private final QuestionRepository questionRepository;
    private final QuestionMarkRepository questionMarkRepository;
    private final CheckinPostRepository checkinPostRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public Map<String, Object> home(long userId) {
        ensureSeed();
        User me = user(userId);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("me", brief(me));
        data.put("helpCount", helpPostRepository.count());
        data.put("plazaCount", checkinPostRepository.count());
        data.put("friendCount", friendshipRepository.countByUserIdAndStatus(userId, "ACCEPTED"));
        data.put("pendingFriendCount", friendshipRepository.findByFriendIdAndStatus(userId, "PENDING").size());
        data.put("outgoingFriendCount", friendshipRepository.findByUserIdAndStatus(userId, "PENDING").size());
        data.put("pendingPkCount", pkMatchRepository.findByOpponentIdAndStatusOrderByCreatedAtDesc(userId, "PENDING").size());
        List<Map<String, Object>> recentHelp = new ArrayList<>();
        for (HelpPost post : helpPostRepository.findTop80ByOrderByCreatedAtDesc()) {
            recentHelp.add(helpCard(userId, post));
            if (recentHelp.size() >= 4) break;
        }
        data.put("recentHelp", recentHelp);
        List<Map<String, Object>> recentPk = new ArrayList<>();
        for (PkMatch match : pkMatchRepository.findRecentByUser(userId)) {
            recentPk.add(pkCard(userId, match));
            if (recentPk.size() >= 4) break;
        }
        data.put("recentPk", recentPk);
        return data;
    }

    @Transactional
    public List<Map<String, Object>> listHelp(long userId, String subject) {
        ensureSeed();
        String sub = subject == null ? "" : subject.trim();
        List<HelpPost> rows = sub.isEmpty()
                ? helpPostRepository.findTop80ByOrderByCreatedAtDesc()
                : helpPostRepository.findTop80BySubjectOrderByCreatedAtDesc(sub);
        List<Map<String, Object>> out = new ArrayList<>();
        for (HelpPost post : rows) out.add(helpCard(userId, post));
        return out;
    }

    @Transactional
    public Map<String, Object> createHelp(long userId, Map<String, Object> body) {
        User me = user(userId);
        String title = text(body.get("title"), 80);
        String content = text(body.get("content"), 800);
        if (title.length() < 2) throw new IllegalArgumentException("请写一个求助标题");
        if (content.length() < 4) throw new IllegalArgumentException("请写清你卡在哪一步");
        HelpPost post = new HelpPost();
        post.setUserId(userId);
        post.setNickName(displayName(me));
        post.setSubject(text(body.get("subject"), 20));
        post.setTitle(title);
        post.setContent(content);
        post.setSnippet(text(body.get("snippet"), 200));
        post.setQuestionId(asLong(body.get("questionId")));
        post.setLikeCount(0);
        post.setReplyCount(0);
        post.setSeeded(false);
        post.setCreatedAt(LocalDateTime.now());
        return helpDetail(userId, helpPostRepository.save(post).getId());
    }

    public Map<String, Object> helpDetail(long userId, long postId) {
        HelpPost post = helpPostRepository.findById(postId)
                .orElseThrow(() -> new IllegalArgumentException("帖子不存在"));
        Map<String, Object> data = helpCard(userId, post);
        data.put("content", post.getContent());
        data.put("snippet", nullToEmpty(post.getSnippet()));
        data.put("questionId", post.getQuestionId());
        data.put("mine", post.getUserId() != null && post.getUserId() == userId);
        List<Map<String, Object>> replies = new ArrayList<>();
        for (HelpReply reply : helpReplyRepository.findByPostIdOrderByCreatedAtAsc(postId)) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", reply.getId());
            row.put("nickName", reply.getNickName());
            row.put("content", reply.getContent());
            row.put("mine", reply.getUserId() != null && reply.getUserId() == userId);
            row.put("createdAt", formatTime(reply.getCreatedAt()));
            replies.add(row);
        }
        data.put("replies", replies);
        return data;
    }

    @Transactional
    public Map<String, Object> replyHelp(long userId, long postId, Map<String, Object> body) {
        HelpPost post = helpPostRepository.findById(postId)
                .orElseThrow(() -> new IllegalArgumentException("帖子不存在"));
        String content = text(body.get("content"), 500);
        if (content.length() < 2) throw new IllegalArgumentException("请写回复内容");
        User me = user(userId);
        HelpReply reply = new HelpReply();
        reply.setPostId(postId);
        reply.setUserId(userId);
        reply.setNickName(displayName(me));
        reply.setContent(content);
        reply.setCreatedAt(LocalDateTime.now());
        helpReplyRepository.save(reply);
        post.setReplyCount((post.getReplyCount() == null ? 0 : post.getReplyCount()) + 1);
        helpPostRepository.save(post);
        return helpDetail(userId, postId);
    }

    @Transactional
    public Map<String, Object> toggleHelpLike(long userId, long postId) {
        HelpPost post = helpPostRepository.findById(postId)
                .orElseThrow(() -> new IllegalArgumentException("帖子不存在"));
        var existing = helpPostLikeRepository.findByPostIdAndUserId(postId, userId);
        int likes = post.getLikeCount() == null ? 0 : post.getLikeCount();
        if (existing.isPresent()) {
            helpPostLikeRepository.delete(existing.get());
            likes = Math.max(0, likes - 1);
        } else {
            HelpPostLike like = new HelpPostLike();
            like.setPostId(postId);
            like.setUserId(userId);
            helpPostLikeRepository.save(like);
            likes++;
        }
        post.setLikeCount(likes);
        helpPostRepository.save(post);
        return helpDetail(userId, postId);
    }

    @Transactional
    public Map<String, Object> deleteHelp(long userId, long postId) {
        HelpPost post = helpPostRepository.findById(postId)
                .orElseThrow(() -> new IllegalArgumentException("帖子不存在"));
        if (post.getUserId() == null || post.getUserId() != userId) {
            throw new IllegalArgumentException("只能删除自己的帖子");
        }
        helpReplyRepository.deleteByPostId(postId);
        helpPostLikeRepository.deleteByPostId(postId);
        helpPostRepository.delete(post);
        return Map.of("deleted", true, "id", postId);
    }

    @Transactional
    public Map<String, Object> deleteReply(long userId, long postId, long replyId) {
        HelpReply reply = helpReplyRepository.findById(replyId)
                .orElseThrow(() -> new IllegalArgumentException("回复不存在"));
        if (reply.getPostId() == null || reply.getPostId() != postId) {
            throw new IllegalArgumentException("回复不在这条帖子下");
        }
        if (reply.getUserId() == null || reply.getUserId() != userId) {
            throw new IllegalArgumentException("只能删除自己的回复");
        }
        helpReplyRepository.delete(reply);
        HelpPost post = helpPostRepository.findById(postId).orElse(null);
        if (post != null) {
            int n = post.getReplyCount() == null ? 0 : post.getReplyCount();
            post.setReplyCount(Math.max(0, n - 1));
            helpPostRepository.save(post);
        }
        return helpDetail(userId, postId);
    }

    public List<Map<String, Object>> searchUsers(long userId, String query) {
        String q = query == null ? "" : query.trim();
        if (q.length() < 1) return List.of();
        List<Map<String, Object>> out = new ArrayList<>();
        for (User u : userRepository.findTop12ByUsernameContainingIgnoreCaseOrNickNameContainingIgnoreCase(q, q)) {
            if (u.getId() == userId) continue;
            Map<String, Object> row = brief(u);
            row.put("relation", relation(userId, u.getId()));
            out.add(row);
        }
        return out;
    }

    public Map<String, Object> friendsHome(long userId) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("friends", mapFriends(friendshipRepository.findByUserIdAndStatus(userId, "ACCEPTED")));
        List<Map<String, Object>> incoming = new ArrayList<>();
        for (Friendship f : friendshipRepository.findByFriendIdAndStatus(userId, "PENDING")) {
            userRepository.findById(f.getUserId()).ifPresent(u -> {
                Map<String, Object> row = brief(u);
                row.put("requestId", f.getId());
                incoming.add(row);
            });
        }
        data.put("incoming", incoming);
        List<Map<String, Object>> outgoing = new ArrayList<>();
        for (Friendship f : friendshipRepository.findByUserIdAndStatus(userId, "PENDING")) {
            userRepository.findById(f.getFriendId()).ifPresent(u -> {
                Map<String, Object> row = brief(u);
                row.put("requestId", f.getId());
                outgoing.add(row);
            });
        }
        data.put("outgoing", outgoing);
        List<Map<String, Object>> pendingPk = new ArrayList<>();
        for (PkMatch match : pkMatchRepository.findByOpponentIdAndStatusOrderByCreatedAtDesc(userId, "PENDING")) {
            pendingPk.add(pkCard(userId, match));
        }
        data.put("pendingPk", pendingPk);
        List<Map<String, Object>> matches = new ArrayList<>();
        for (PkMatch match : pkMatchRepository.findRecentByUser(userId)) {
            matches.add(pkCard(userId, match));
            if (matches.size() >= 20) break;
        }
        data.put("matches", matches);
        data.put("myPower", powerCard(user(userId)));
        return data;
    }

    @Transactional
    public Map<String, Object> addFriend(long userId, String username) {
        if (username == null || username.trim().isEmpty()) {
            throw new IllegalArgumentException("请输入对方账号");
        }
        User target = userRepository.findByUsername(username.trim())
                .orElseThrow(() -> new IllegalArgumentException("找不到这个账号"));
        if (target.getId() == userId) throw new IllegalArgumentException("不能加自己");
        if (friendshipRepository.findByUserIdAndFriendId(userId, target.getId())
                .filter(f -> "ACCEPTED".equals(f.getStatus())).isPresent()) {
            throw new IllegalArgumentException("你们已经是好友");
        }
        Friendship incoming = friendshipRepository.findByUserIdAndFriendId(target.getId(), userId).orElse(null);
        if (incoming != null && "PENDING".equals(incoming.getStatus())) {
            acceptPair(incoming);
            return friendsHome(userId);
        }
        Friendship mine = friendshipRepository.findByUserIdAndFriendId(userId, target.getId()).orElse(null);
        if (mine != null && "PENDING".equals(mine.getStatus())) {
            throw new IllegalArgumentException("好友申请已发出，等对方通过");
        }
        Friendship row = new Friendship();
        row.setUserId(userId);
        row.setFriendId(target.getId());
        row.setStatus("PENDING");
        row.setCreatedAt(LocalDateTime.now());
        friendshipRepository.save(row);
        return friendsHome(userId);
    }

    @Transactional
    public Map<String, Object> acceptFriend(long userId, long fromUserId) {
        Friendship incoming = friendshipRepository.findByUserIdAndFriendId(fromUserId, userId)
                .orElseThrow(() -> new IllegalArgumentException("没有这条申请"));
        if (!"PENDING".equals(incoming.getStatus())) {
            throw new IllegalArgumentException("申请已处理");
        }
        acceptPair(incoming);
        return friendsHome(userId);
    }

    @Transactional
    public Map<String, Object> rejectFriend(long userId, long fromUserId) {
        Friendship incoming = friendshipRepository.findByUserIdAndFriendId(fromUserId, userId)
                .orElseThrow(() -> new IllegalArgumentException("没有这条申请"));
        if (!"PENDING".equals(incoming.getStatus())) {
            throw new IllegalArgumentException("申请已处理");
        }
        friendshipRepository.delete(incoming);
        return friendsHome(userId);
    }

    @Transactional
    public Map<String, Object> cancelFriend(long userId, long toUserId) {
        Friendship mine = friendshipRepository.findByUserIdAndFriendId(userId, toUserId)
                .orElseThrow(() -> new IllegalArgumentException("没有发出过申请"));
        if (!"PENDING".equals(mine.getStatus())) {
            throw new IllegalArgumentException("申请已处理");
        }
        friendshipRepository.delete(mine);
        return friendsHome(userId);
    }

    @Transactional
    public Map<String, Object> unfriend(long userId, long friendId) {
        if (!areFriends(userId, friendId)) throw new IllegalArgumentException("你们还不是好友");
        friendshipRepository.deleteByUserIdAndFriendId(userId, friendId);
        friendshipRepository.deleteByUserIdAndFriendId(friendId, userId);
        return friendsHome(userId);
    }

    @Transactional
    public Map<String, Object> challenge(long userId, long friendId) {
        if (userId == friendId) throw new IllegalArgumentException("不能和自己 PK");
        if (!areFriends(userId, friendId)) throw new IllegalArgumentException("只能和好友 PK，先加好友");
        for (PkMatch m : pkMatchRepository.findRecentByUser(userId)) {
            if (!involves(m, userId, friendId)) continue;
            if ("PENDING".equals(m.getStatus()) || "ACTIVE".equals(m.getStatus())) {
                throw new IllegalArgumentException("已有一场未结束的对战");
            }
        }
        List<Map<String, Object>> pack = buildQuizPack(userId, friendId);
        PkMatch match = new PkMatch();
        match.setChallengerId(userId);
        match.setOpponentId(friendId);
        match.setStatus("PENDING");
        match.setCreatedAt(LocalDateTime.now());
        match.setChallengerAnswers("");
        match.setOpponentAnswers("");
        if (pack.isEmpty()) {
            match.setMode("POWER");
            match.setQuestionsJson("");
        } else {
            match.setMode("QUIZ");
            match.setQuestionsJson(writeJson(pack));
        }
        pkMatchRepository.save(match);
        Map<String, Object> data = friendsHome(userId);
        data.put("lastMatch", pkCard(userId, match));
        return data;
    }

    @Transactional
    public Map<String, Object> acceptPk(long userId, long matchId) {
        PkMatch match = pkMatchRepository.findById(matchId)
                .orElseThrow(() -> new IllegalArgumentException("对战不存在"));
        if (match.getOpponentId() == null || match.getOpponentId() != userId) {
            throw new IllegalArgumentException("这场对战不是发给你的");
        }
        if (!"PENDING".equals(match.getStatus())) {
            throw new IllegalArgumentException("已经开始或结算过了");
        }
        if ("QUIZ".equals(match.getMode()) && !readMaps(match.getQuestionsJson()).isEmpty()) {
            match.setStatus("ACTIVE");
            pkMatchRepository.save(match);
            Map<String, Object> data = friendsHome(userId);
            data.put("lastMatch", pkCard(userId, match));
            data.put("play", pkPlay(userId, match));
            return data;
        }
        settlePower(match);
        pkMatchRepository.save(match);
        Map<String, Object> data = friendsHome(userId);
        data.put("lastMatch", pkCard(userId, match));
        return data;
    }

    public Map<String, Object> pkDetail(long userId, long matchId) {
        PkMatch match = requirePkPlayer(userId, matchId);
        Map<String, Object> data = pkCard(userId, match);
        data.put("play", pkPlay(userId, match));
        return data;
    }

    @Transactional
    public Map<String, Object> submitPk(long userId, long matchId, Map<String, Object> body) {
        PkMatch match = requirePkPlayer(userId, matchId);
        if (!"QUIZ".equals(match.getMode())) {
            throw new IllegalArgumentException("这场是战力对决，不用答题");
        }
        if ("PENDING".equals(match.getStatus())) {
            throw new IllegalArgumentException("对方还没应战");
        }
        if ("DONE".equals(match.getStatus())) {
            throw new IllegalArgumentException("已经结算过了");
        }
        boolean challenger = match.getChallengerId() == userId;
        String mine = challenger ? match.getChallengerAnswers() : match.getOpponentAnswers();
        if (mine != null && !mine.isBlank()) throw new IllegalArgumentException("你已经交过卷了");
        List<Map<String, Object>> questions = readMaps(match.getQuestionsJson());
        Map<Long, String> given = readAnswerMap(body.get("answers"));
        List<Map<String, Object>> graded = new ArrayList<>();
        int correct = 0;
        int total = 0;
        for (Map<String, Object> q : questions) {
            Long qid = asLong(q.get("id"));
            String official = String.valueOf(q.getOrDefault("answer", "")).trim();
            String text = given.getOrDefault(qid, "").trim();
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("questionId", qid);
            row.put("text", text);
            boolean scored = !official.isBlank();
            boolean ok = scored && sameAnswer(official, text);
            row.put("correct", ok);
            graded.add(row);
            if (scored) {
                total++;
                if (ok) correct++;
            }
        }
        String json = writeJson(graded);
        if (challenger) match.setChallengerAnswers(json);
        else match.setOpponentAnswers(json);
        boolean both = notBlank(match.getChallengerAnswers()) && notBlank(match.getOpponentAnswers());
        if (both) {
            int ls = countCorrect(match.getChallengerAnswers());
            int rs = countCorrect(match.getOpponentAnswers());
            match.setChallengerScore(ls);
            match.setOpponentScore(rs);
            if (ls > rs) match.setWinnerId(match.getChallengerId());
            else if (rs > ls) match.setWinnerId(match.getOpponentId());
            else match.setWinnerId(null);
            match.setStatus("DONE");
            try {
                Map<String, Object> snap = new HashMap<>();
                snap.put("total", total);
                snap.put("challengerCorrect", ls);
                snap.put("opponentCorrect", rs);
                match.setSnapshotJson(objectMapper.writeValueAsString(snap));
            } catch (Exception ignored) {
                match.setSnapshotJson("");
            }
        }
        pkMatchRepository.save(match);
        Map<String, Object> data = pkCard(userId, match);
        data.put("play", pkPlay(userId, match));
        data.put("myCorrect", correct);
        data.put("myTotal", total);
        return data;
    }

    private void settlePower(PkMatch match) {
        User challenger = user(match.getChallengerId());
        User opponent = user(match.getOpponentId());
        Map<String, Object> left = powerCard(challenger);
        Map<String, Object> right = powerCard(opponent);
        int ls = ((Number) left.get("score")).intValue();
        int rs = ((Number) right.get("score")).intValue();
        match.setMode("POWER");
        match.setChallengerScore(ls);
        match.setOpponentScore(rs);
        if (ls > rs) match.setWinnerId(challenger.getId());
        else if (rs > ls) match.setWinnerId(opponent.getId());
        else match.setWinnerId(null);
        match.setStatus("DONE");
        try {
            Map<String, Object> snap = new HashMap<>();
            snap.put("challenger", left);
            snap.put("opponent", right);
            match.setSnapshotJson(objectMapper.writeValueAsString(snap));
        } catch (Exception ignored) {
            match.setSnapshotJson("");
        }
    }

    private PkMatch requirePkPlayer(long userId, long matchId) {
        PkMatch match = pkMatchRepository.findById(matchId)
                .orElseThrow(() -> new IllegalArgumentException("对战不存在"));
        if (match.getChallengerId() != userId && match.getOpponentId() != userId) {
            throw new IllegalArgumentException("这场对战不是你的");
        }
        return match;
    }

    private Map<String, Object> pkPlay(long userId, PkMatch match) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("id", match.getId());
        data.put("mode", match.getMode() == null ? "POWER" : match.getMode());
        data.put("status", match.getStatus());
        boolean challenger = match.getChallengerId() == userId;
        boolean myDone = notBlank(challenger ? match.getChallengerAnswers() : match.getOpponentAnswers());
        boolean theirDone = notBlank(challenger ? match.getOpponentAnswers() : match.getChallengerAnswers());
        boolean reveal = "DONE".equals(match.getStatus());
        data.put("mineChallenger", challenger);
        data.put("submitted", myDone);
        data.put("opponentSubmitted", theirDone);
        data.put("canSubmit", "ACTIVE".equals(match.getStatus()) && !myDone);
        boolean showQuestions = "ACTIVE".equals(match.getStatus()) || "DONE".equals(match.getStatus());
        List<Map<String, Object>> questions = new ArrayList<>();
        Map<Long, Map<String, Object>> myById = indexAnswers(challenger ? match.getChallengerAnswers() : match.getOpponentAnswers());
        Map<Long, Map<String, Object>> theirById = indexAnswers(challenger ? match.getOpponentAnswers() : match.getChallengerAnswers());
        if (showQuestions) {
            for (Map<String, Object> q : readMaps(match.getQuestionsJson())) {
                Map<String, Object> row = new LinkedHashMap<>();
                Long qid = asLong(q.get("id"));
                row.put("id", qid);
                row.put("title", q.get("title"));
                row.put("content", q.get("content"));
                row.put("category", q.get("category"));
                if (myDone) {
                    Map<String, Object> mine = myById.get(qid);
                    row.put("myAnswer", mine == null ? "" : mine.get("text"));
                    row.put("myCorrect", mine != null && Boolean.TRUE.equals(mine.get("correct")));
                }
                if (reveal) {
                    row.put("answer", q.get("answer"));
                    Map<String, Object> theirs = theirById.get(qid);
                    row.put("opponentAnswer", theirs == null ? "" : theirs.get("text"));
                    row.put("opponentCorrect", theirs != null && Boolean.TRUE.equals(theirs.get("correct")));
                }
                questions.add(row);
            }
        }
        data.put("questions", questions);
        data.put("questionCount", showQuestions ? questions.size() : readMaps(match.getQuestionsJson()).size());
        return data;
    }

    private List<Map<String, Object>> buildQuizPack(long a, long b) {
        List<Question> pool = new ArrayList<>();
        pool.addAll(questionRepository.findByUserIdAndIsDeletedFalseOrderByCreatedAtDesc(a));
        pool.addAll(questionRepository.findByUserIdAndIsDeletedFalseOrderByCreatedAtDesc(b));
        List<Question> picked = new ArrayList<>();
        Set<Long> seen = new LinkedHashSet<>();
        for (Question q : pool) {
            if (q.getId() == null || !seen.add(q.getId())) continue;
            if (Boolean.TRUE.equals(q.getIsVariant())) continue;
            if (q.getContent() == null || q.getContent().isBlank()) continue;
            picked.add(q);
        }
        Collections.shuffle(picked);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Question q : picked) {
            if (out.size() >= 5) break;
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", q.getId());
            String content = q.getContent().trim();
            row.put("title", content.length() <= 24 ? content : content.substring(0, 24) + "…");
            row.put("content", content.length() <= 400 ? content : content.substring(0, 400));
            row.put("category", q.getCategory() == null ? "" : q.getCategory());
            row.put("answer", q.getAiAnswer() == null ? "" : q.getAiAnswer());
            out.add(row);
        }
        return out;
    }

    private void acceptPair(Friendship incoming) {
        incoming.setStatus("ACCEPTED");
        friendshipRepository.save(incoming);
        Friendship reverse = friendshipRepository
                .findByUserIdAndFriendId(incoming.getFriendId(), incoming.getUserId())
                .orElseGet(Friendship::new);
        reverse.setUserId(incoming.getFriendId());
        reverse.setFriendId(incoming.getUserId());
        reverse.setStatus("ACCEPTED");
        if (reverse.getCreatedAt() == null) reverse.setCreatedAt(LocalDateTime.now());
        friendshipRepository.save(reverse);
    }

    private boolean areFriends(long a, long b) {
        return friendshipRepository.findByUserIdAndFriendId(a, b)
                .filter(f -> "ACCEPTED".equals(f.getStatus()))
                .isPresent();
    }

    private String relation(long me, long other) {
        if (areFriends(me, other)) return "FRIEND";
        if (friendshipRepository.findByUserIdAndFriendId(me, other)
                .filter(f -> "PENDING".equals(f.getStatus())).isPresent()) return "OUTGOING";
        if (friendshipRepository.findByUserIdAndFriendId(other, me)
                .filter(f -> "PENDING".equals(f.getStatus())).isPresent()) return "INCOMING";
        return "NONE";
    }

    private List<Map<String, Object>> mapFriends(List<Friendship> rows) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Friendship f : rows) {
            userRepository.findById(f.getFriendId()).ifPresent(u -> out.add(brief(u)));
        }
        return out;
    }

    private Map<String, Object> powerCard(User user) {
        int questions = (int) questionRepository.countByUserIdAndIsDeleted(user.getId(), false);
        int mastered = (int) questionMarkRepository.countByUserIdAndMasteredTrue(user.getId());
        int streak = user.getCheckinStreak() == null ? 0 : user.getCheckinStreak();
        int coins = user.getCoins() == null ? 0 : user.getCoins();
        int score = 20 + streak * 12 + questions * 3 + mastered * 8 + Math.min(coins, 200) / 10;
        Map<String, Object> data = brief(user);
        data.put("questions", questions);
        data.put("mastered", mastered);
        data.put("streak", streak);
        data.put("score", score);
        return data;
    }

    private Map<String, Object> pkCard(long viewerId, PkMatch match) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("id", match.getId());
        data.put("status", match.getStatus());
        data.put("mode", match.getMode() == null ? "POWER" : match.getMode());
        data.put("questionCount", readMaps(match.getQuestionsJson()).size());
        data.put("challengerScore", match.getChallengerScore());
        data.put("opponentScore", match.getOpponentScore());
        data.put("createdAt", formatTime(match.getCreatedAt()));
        userRepository.findById(match.getChallengerId()).ifPresent(u -> data.put("challenger", brief(u)));
        userRepository.findById(match.getOpponentId()).ifPresent(u -> data.put("opponent", brief(u)));
        boolean mineChallenge = match.getChallengerId() != null && match.getChallengerId() == viewerId;
        data.put("incoming", "PENDING".equals(match.getStatus()) && match.getOpponentId() == viewerId);
        data.put("waiting", "PENDING".equals(match.getStatus()) && mineChallenge);
        boolean myDone = notBlank(mineChallenge ? match.getChallengerAnswers() : match.getOpponentAnswers());
        data.put("myTurn", "ACTIVE".equals(match.getStatus()) && !myDone);
        data.put("playable", "QUIZ".equals(match.getMode()) && ("ACTIVE".equals(match.getStatus()) || "DONE".equals(match.getStatus())));
        String result = "待应战";
        if ("ACTIVE".equals(match.getStatus())) result = myDone ? "等待对方交卷" : "答题中";
        if ("DONE".equals(match.getStatus())) {
            if (match.getWinnerId() == null) result = "平局";
            else if (match.getWinnerId() == viewerId) result = "你赢了";
            else result = "对方赢了";
        }
        data.put("result", result);
        return data;
    }

    private Map<String, Object> helpCard(long userId, HelpPost post) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("id", post.getId());
        data.put("title", post.getTitle());
        data.put("subject", nullToEmpty(post.getSubject()));
        data.put("nickName", post.getNickName());
        data.put("replyCount", post.getReplyCount() == null ? 0 : post.getReplyCount());
        data.put("likeCount", post.getLikeCount() == null ? 0 : post.getLikeCount());
        data.put("liked", helpPostLikeRepository.findByPostIdAndUserId(post.getId(), userId).isPresent());
        data.put("questionId", post.getQuestionId());
        data.put("preview", preview(post.getContent()));
        data.put("createdAt", formatTime(post.getCreatedAt()));
        data.put("seeded", Boolean.TRUE.equals(post.getSeeded()));
        data.put("mine", post.getUserId() != null && post.getUserId() == userId);
        return data;
    }

    private void ensureSeed() {
        if (helpPostRepository.count() > 0) return;
        seedPost("数学", "二次函数顶点式老是写错",
                "把 y=x²-4x+3 配成顶点式，我写成 y=(x-2)²+3，答案却是 −1。谁能讲一下常数项怎么移？",
                "把 y=x²-4x+3 配方成顶点式", "案例同学");
        seedPost("英语", "定语从句 that / which 怎么选",
                "非限制性定语从句为什么不能用 that？我这道选择题两个看起来都能填。",
                "The book, ____ I bought yesterday, is missing.", "启明学长");
        seedPost("物理", "滑动摩擦力方向总画反",
                "木块沿斜面上滑，摩擦力到底沿斜面向上还是向下？我和同桌吵起来了。",
                "物体沿粗糙斜面上滑时的摩擦力方向", "青藤学姐");
        List<HelpPost> posts = helpPostRepository.findTop80ByOrderByCreatedAtDesc();
        if (posts.isEmpty()) return;
        HelpPost first = posts.get(posts.size() - 1);
        HelpReply reply = new HelpReply();
        reply.setPostId(first.getId());
        reply.setUserId(0L);
        reply.setNickName("启明学长");
        reply.setContent("配方是 y=(x-2)²−1。先凑 (x−2)²=x²−4x+4，所以原式 = (x−2)²+3−4，常数要减掉多出来的 4。");
        reply.setCreatedAt(LocalDateTime.now());
        helpReplyRepository.save(reply);
        first.setReplyCount(1);
        helpPostRepository.save(first);
    }

    private void seedPost(String subject, String title, String content, String snippet, String nick) {
        HelpPost post = new HelpPost();
        post.setUserId(0L);
        post.setNickName(nick);
        post.setSubject(subject);
        post.setTitle(title);
        post.setContent(content);
        post.setSnippet(snippet);
        post.setLikeCount(0);
        post.setReplyCount(0);
        post.setSeeded(true);
        post.setCreatedAt(LocalDateTime.now());
        helpPostRepository.save(post);
    }

    private User user(long userId) {
        return userRepository.findById(userId).orElseThrow(() -> new IllegalArgumentException("用户不存在"));
    }

    private Map<String, Object> brief(User user) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("id", user.getId());
        data.put("username", user.getUsername());
        data.put("nickName", displayName(user));
        data.put("avatarUrl", user.getAvatarUrl() == null ? "" : user.getAvatarUrl());
        data.put("stage", user.getStage() == null ? "" : user.getStage());
        return data;
    }

    private String displayName(User user) {
        if (user.getNickName() != null && !user.getNickName().isBlank()) return user.getNickName();
        return user.getUsername();
    }

    private String text(Object raw, int max) {
        String s = raw == null ? "" : String.valueOf(raw).trim();
        return s.length() <= max ? s : s.substring(0, max);
    }

    private String preview(String content) {
        String s = nullToEmpty(content).replace('\n', ' ');
        return s.length() <= 72 ? s : s.substring(0, 72) + "…";
    }

    private String formatTime(LocalDateTime t) {
        return t == null ? "" : t.format(CLOCK);
    }

    private String nullToEmpty(String s) {
        return s == null ? "" : s;
    }

    private boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }

    private Long asLong(Object raw) {
        if (raw == null) return null;
        if (raw instanceof Number n) return n.longValue();
        String s = String.valueOf(raw).trim();
        if (s.isEmpty() || "null".equals(s)) return null;
        try {
            return Long.parseLong(s);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private boolean involves(PkMatch m, long a, long b) {
        return (m.getChallengerId() == a && m.getOpponentId() == b)
                || (m.getChallengerId() == b && m.getOpponentId() == a);
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            return "[]";
        }
    }

    private List<Map<String, Object>> readMaps(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            List<Map<String, Object>> rows = objectMapper.readValue(json, MAP_LIST);
            return rows == null ? List.of() : rows;
        } catch (Exception e) {
            return List.of();
        }
    }

    private Map<Long, Map<String, Object>> indexAnswers(String json) {
        Map<Long, Map<String, Object>> out = new LinkedHashMap<>();
        for (Map<String, Object> row : readMaps(json)) {
            Long id = asLong(row.get("questionId"));
            if (id != null) out.put(id, row);
        }
        return out;
    }

    @SuppressWarnings("unchecked")
    private Map<Long, String> readAnswerMap(Object raw) {
        Map<Long, String> out = new LinkedHashMap<>();
        if (raw instanceof Map<?, ?> map) {
            for (Map.Entry<?, ?> e : map.entrySet()) {
                Long id = asLong(e.getKey());
                if (id != null) out.put(id, e.getValue() == null ? "" : String.valueOf(e.getValue()));
            }
            return out;
        }
        if (raw instanceof List<?> list) {
            for (Object o : list) {
                if (!(o instanceof Map<?, ?> m)) continue;
                Long id = asLong(m.get("questionId") != null ? m.get("questionId") : m.get("id"));
                Object text = m.get("text") != null ? m.get("text") : m.get("answer");
                if (id != null) out.put(id, text == null ? "" : String.valueOf(text));
            }
        }
        return out;
    }

    private int countCorrect(String json) {
        int n = 0;
        for (Map<String, Object> row : readMaps(json)) {
            if (Boolean.TRUE.equals(row.get("correct"))) n++;
        }
        return n;
    }

    private boolean sameAnswer(String official, String given) {
        String a = normalizeAnswer(official);
        String b = normalizeAnswer(given);
        if (a.isEmpty() || b.isEmpty()) return false;
        if (a.equals(b)) return true;
        return a.contains(b) || b.contains(a);
    }

    private String normalizeAnswer(String s) {
        return s == null ? "" : s.replaceAll("[\\s\\p{Punct}]+", "").toLowerCase();
    }
}
