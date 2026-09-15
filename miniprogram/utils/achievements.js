// 成就 / 等级 / 勋章。纯前端从钱包统计推导，不另建集合。
// 经验来自已经发生的学习行为，不靠分享、不靠充值。

const LEVELS = [
  { level: 1, name: '萌新', xp: 0 },
  { level: 2, name: '入门', xp: 40 },
  { level: 3, name: '学优', xp: 120 },
  { level: 4, name: '学霸', xp: 250 },
  { level: 5, name: '学神', xp: 450 },
  { level: 6, name: '学圣', xp: 750 },
  { level: 7, name: '传说', xp: 1100 }
];

const MEDALS = [
  { id: 'checkin1', mark: '签', name: '初来乍到', desc: '完成第一次打卡', hint: '去打一次卡即可点亮' },
  { id: 'streak3', mark: '三', name: '三日坚持', desc: '连续打卡 3 天', hint: '连续打卡 3 天' },
  { id: 'streak7', mark: '周', name: '一周学霸', desc: '连续打卡 7 天', hint: '连续打卡 7 天' },
  { id: 'streak30', mark: '月', name: '月度毅力', desc: '连续打卡 30 天', hint: '连续打卡 30 天' },
  { id: 'days100', mark: '百', name: '百日不辍', desc: '累计打卡 100 天', hint: '累计打卡 100 天' },
  { id: 'q1', mark: '题', name: '第一道错题', desc: '收录第 1 道错题', hint: '去拍一道错题' },
  { id: 'q10', mark: '拾', name: '错题十记', desc: '整理满 10 道错题', hint: '再整理一些错题' },
  { id: 'q50', mark: '册', name: '错题成册', desc: '整理满 50 道错题', hint: '整理满 50 道' },
  { id: 'fav5', mark: '藏', name: '收藏家', desc: '收藏 5 道错题', hint: '在错题上点亮星星' },
  { id: 'note3', mark: '记', name: '笔记达人', desc: '写下 3 条错题笔记', hint: '给错题写笔记' },
  { id: 'paper1', mark: '卷', name: '组卷能手', desc: '生成第 1 份试卷', hint: '去组卷页生成一份' },
  { id: 'vip', mark: '会', name: '对话会员', desc: '开通对话会员', hint: '用金币兑换会员' }
];

function num(v) {
  return Number(v) || 0;
}

function calcXp(s) {
  return num(s.checkinTotalDays) * 8
    + num(s.checkinStreak) * 4
    + num(s.questionCount) * 6
    + num(s.paperCount) * 20
    + num(s.noteCount) * 10
    + num(s.favoriteCount) * 4
    + num(s.reportCount) * 15
    + (s.isVip ? 40 : 0);
}

function medalUnlocked(id, s) {
  if (id === 'checkin1') return num(s.checkinTotalDays) >= 1;
  if (id === 'streak3') return num(s.checkinStreak) >= 3;
  if (id === 'streak7') return num(s.checkinStreak) >= 7;
  if (id === 'streak30') return num(s.checkinStreak) >= 30;
  if (id === 'days100') return num(s.checkinTotalDays) >= 100;
  if (id === 'q1') return num(s.questionCount) >= 1;
  if (id === 'q10') return num(s.questionCount) >= 10;
  if (id === 'q50') return num(s.questionCount) >= 50;
  if (id === 'fav5') return num(s.favoriteCount) >= 5;
  if (id === 'note3') return num(s.noteCount) >= 3;
  if (id === 'paper1') return num(s.paperCount) >= 1;
  if (id === 'vip') return !!s.isVip;
  return false;
}

function buildAchievements(stats) {
  const s = stats || {};
  const xp = calcXp(s);
  let current = LEVELS[0];
  let next = LEVELS[1];
  for (let i = 0; i < LEVELS.length; i++) {
    if (xp >= LEVELS[i].xp) {
      current = LEVELS[i];
      next = LEVELS[i + 1] || null;
    }
  }
  const span = next ? (next.xp - current.xp) : 1;
  const into = next ? Math.min(span, xp - current.xp) : span;
  const progressPct = next ? Math.round((into / span) * 100) : 100;
  const medals = MEDALS.map((m) => ({
    ...m,
    unlocked: medalUnlocked(m.id, s)
  }));
  const unlocked = medals.filter((m) => m.unlocked).length;

  return {
    xp,
    level: current.level,
    levelName: current.name,
    nextLevel: next ? next.level : current.level,
    nextName: next ? next.name : current.name,
    nextXp: next ? next.xp : xp,
    remainXp: next ? Math.max(0, next.xp - xp) : 0,
    progressPct,
    maxed: !next,
    unlocked,
    total: medals.length,
    medals
  };
}

const EMPTY_ACH = buildAchievements({});

module.exports = {
  buildAchievements,
  EMPTY_ACH
};
