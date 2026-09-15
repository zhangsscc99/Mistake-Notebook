const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
const $ = db.command.aggregate;

const COLLECTION = 'users';
const MAX_NICKNAME_LEN = 20;
const AVATAR_DIR = 'avatars';

const MARKS_COLLECTION = 'question_marks';
const CHECKIN_COLLECTION = 'checkins';
const COIN_LOG_COLLECTION = 'coin_logs';
const CHAT_USAGE_COLLECTION = 'chat_usage';
const PAPER_COLLECTION = 'papers';

// 与客户端 miniprogram/utils/profile.js 的 STAGES 保持一致。
// 客户端那份只管渲染，这份才是把关的 —— 客户端可以传任何字符串过来。
const STAGES = ['小学', '初中', '高中', '大学'];

// ── 金币经济。数值集中在这里，改数值不用碰逻辑 ──────────────────────────
const COIN_BASE_CHECKIN = 10;   // 基础签到
const COIN_BONUS_CHAT = 5;      // 加成：今天用过 AI 对话
const COIN_BONUS_PAPER = 5;     // 加成：今天生成过试卷
const VIP_COST_COINS = 200;     // 兑换会员所需金币
const VIP_DAYS = 7;             // 一次兑换的会员天数
const STREAK_LOOKBACK_DAYS = 60; // 算连续打卡时回看多少天

// ── 时区 ────────────────────────────────────────────────────────────────
// 云函数运行时是 UTC。打卡/配额/金币流水的「一天」都必须是北京时间的日历日，
// 否则北京时间 0:00–8:00 的动作会被算到前一天。
// 注意 cloudfunctions/category/index.js:98-99 用的是 new Date(y,m,d)（= UTC 零点），
// 那是既有的一处时区 bug，本函数不沿用那个写法。
const CN_OFFSET_MS = 8 * 60 * 60 * 1000;

function cnDayKey(ts) {
  const d = new Date((ts == null ? Date.now() : ts) + CN_OFFSET_MS);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD（北京时间的日历日）
}

// dayKey 对应的北京时间 00:00 那一刻的 UTC ISO 串，用于按时间戳过滤
function cnDayStartIso(dayKey) {
  return new Date(Date.parse(dayKey + 'T00:00:00Z') - CN_OFFSET_MS).toISOString();
}

// [今天, 昨天, ...]，中国没有夏令时，直接减 24h 是安全的
function recentDayKeys(n) {
  const now = Date.now();
  const keys = [];
  for (let i = 0; i < n; i++) keys.push(cnDayKey(now - i * 86400000));
  return keys;
}

exports.main = async (event) => {
  const { action } = event;

  // 身份只从云端上下文取，绝不接受客户端传入的 openid。
  // 取不到就直接失败 —— 不要像 paper 那样兜底成 'anonymous'：
  // 命令行 tcb fn invoke 没有微信上下文，兜底会在库里造出 _id:'anonymous' 的假用户档。
  const openId = getOpenId();
  if (!openId) {
    return { success: false, error: 'No openid' };
  }

  try {
    switch (action) {
      case 'get':
        return await getProfile(openId);
      case 'ensure':
        return await ensureAccount(openId);
      case 'updateProfile':
        return await updateProfile(openId, event);
      case 'getWallet':
        return await getWallet(openId);
      case 'leaderboard':
        return await leaderboard(openId, event);
      case 'checkin':
        return await checkin(openId);
      case 'redeemVip':
        return await redeemVip(openId);
      case 'deleteAccount':
        return await deleteAccount(openId);
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  } catch (err) {
    console.error(err);
    return { success: false, error: err.message };
  }
};

function getOpenId() {
  const wxContext = cloud.getWXContext();
  return wxContext.OPENID || wxContext.FROM_OPENID || '';
}

const DEFAULT_CATEGORIES = [
  { name: '数学', description: '数学相关题目', color: '#E8A855' },
  { name: '物理', description: '物理相关题目', color: '#4A90E2' },
  { name: '化学', description: '化学相关题目', color: '#7ED321' },
  { name: '英语', description: '英语相关题目', color: '#F5A623' },
  { name: '语文', description: '语文相关题目', color: '#BD10E0' },
  { name: '生物', description: '生物相关题目', color: '#50E3C2' },
  { name: '历史', description: '历史相关题目', color: '#D0021B' },
  { name: '地理', description: '地理相关题目', color: '#8B572A' },
  { name: '计算机/编程', description: '计算机与编程相关题目', color: '#2A9D8F' },
  { name: '政治', description: '政治相关题目', color: '#C471ED' }
];

function emptyUserFields(openId) {
  return {
    openId,
    nickName: '',
    avatarFileID: '',
    stage: '',
    coins: 0,
    vipExpireAt: '',
    checkinStreak: 0,
    checkinLastDay: '',
    checkinTotalDays: 0,
    leaderboardPublic: false
  };
}

async function claimOrphans(collection, field, openId) {
  let claimed = 0;
  let skip = 0;
  for (let i = 0; i < 50; i++) {
    const res = await db.collection(collection).skip(skip).limit(20).get();
    const docs = res.data || [];
    if (!docs.length) break;
    const orphans = docs.filter((d) => d[field] == null || d[field] === '');
    if (orphans.length) {
      await Promise.all(orphans.map((d) =>
        db.collection(collection).doc(d._id).update({
          data: { [field]: openId }
        })
      ));
      claimed += orphans.length;
    }
    if (docs.length < 20) break;
    skip += docs.length;
  }
  return claimed;
}

async function seedPersonalCategories(openId) {
  const now = new Date().toISOString();
  let created = 0;
  for (const cat of DEFAULT_CATEGORIES) {
    const found = await db.collection('categories')
      .where({ openid: openId, name: cat.name, isDeleted: false })
      .limit(1)
      .get();
    if (found.data && found.data.length) continue;
    await db.collection('categories').add({
      data: {
        ...cat,
        openid: openId,
        isDeleted: false,
        createdAt: now,
        updatedAt: now
      }
    });
    created += 1;
  }
  return created;
}

// 登录 / 注册：没有用户档就建一个，并保证这个人有一份自己的默认分类。
// 环境里如果还只有这一个用户，就把旧的无归属错题/分类认领过来，避免演示数据一夜清空。
async function ensureAccount(openId) {
  const existing = await db.collection(COLLECTION).where({ _id: openId }).limit(1).get();
  let record = (existing.data || [])[0];
  let created = false;
  const now = new Date().toISOString();

  if (!record) {
    created = true;
    const data = {
      ...emptyUserFields(openId),
      createdAt: now,
      updatedAt: now
    };
    await db.collection(COLLECTION).doc(openId).set({ data });
    record = data;
  }

  let claimed = { questions: 0, categories: 0 };
  try {
    const userCount = await db.collection(COLLECTION).count();
    if (userCount.total <= 1) {
      claimed.questions = await claimOrphans('questions', 'openid', openId);
      claimed.categories = await claimOrphans('categories', 'openid', openId);
    }
  } catch (e) {
    console.warn('[user] claim legacy failed:', e.message);
  }

  const categoriesSeeded = await seedPersonalCategories(openId);

  return {
    success: true,
    data: {
      ...normalize(record, openId),
      created,
      categoriesSeeded,
      claimed
    }
  };
}

// 只接受明确的开/关。任意其它值（含 'yes'、1 以外的数字）都当没传，
// 避免把乱七八糟的 truthy 当成「用户同意公示」。
function parseExactBool(v) {
  if (v === true || v === false) return v;
  if (v === 'true' || v === 'false') return v === 'true';
  return undefined;
}

function normalize(record, openId) {
  const r = record || {};
  return {
    openId,
    exists: !!record,
    nickName: r.nickName || '',
    avatarFileID: r.avatarFileID || '',
    stage: r.stage || '',
    // 钱包字段。老用户档里没有这些键，一律退化成 0/'' —— 不要在这里补写库，
    // getProfile 是纯读（见下方注释），建档只发生在 updateProfile / checkin
    coins: r.coins || 0,
    vipExpireAt: r.vipExpireAt || '',
    checkinStreak: r.checkinStreak || 0,
    checkinLastDay: r.checkinLastDay || '',
    checkinTotalDays: r.checkinTotalDays || 0,
    // 排行榜公示开关。老用户档里没有这个键 —— 缺省即 false，
    // 正是我们要的默认（不公示），所以不需要数据迁移。
    // 刻意写 === true 而不是 !!r.xxx：非空字符串恒为真，
    // 万一库里落进一个 'false'，!! 会把它读成「已公示」——
    // 隐私开关必须 fail closed，认不出来就当没公示
    leaderboardPublic: r.leaderboardPublic === true,
    createdAt: r.createdAt || '',
    updatedAt: r.updatedAt || ''
  };
}

// 纯读，零副作用：文档不存在是全新用户的正常状态，返回 exists:false 而不是报错。
// 也不在这里建档 —— 否则「我的」页每次 onShow 都会写一次库。
async function getProfile(openId) {
  const result = await db.collection(COLLECTION).where({ _id: openId }).limit(1).get();
  return { success: true, data: normalize((result.data || [])[0], openId) };
}

async function updateProfile(openId, event) {
  const now = new Date().toISOString();
  const patch = {};

  // 白名单：只认这三个字段，其余入参一律忽略
  if (typeof event.nickName === 'string') {
    const nickName = event.nickName.trim();
    // 按码点计长，避免 emoji 被算成两个字符
    if ([...nickName].length > MAX_NICKNAME_LEN) {
      return { success: false, error: `昵称不能超过 ${MAX_NICKNAME_LEN} 个字` };
    }
    patch.nickName = nickName;
  }

  // 学段。空字符串是合法的（表示清除），非空则必须在白名单里 ——
  // 客户端传什么都拦不住，这一层才是真正的校验。
  if (typeof event.stage === 'string') {
    const stage = event.stage.trim();
    if (stage && STAGES.indexOf(stage) === -1) {
      return { success: false, error: 'Invalid stage' };
    }
    patch.stage = stage;
  }

  if (typeof event.avatarFileID === 'string' && event.avatarFileID) {
    const fid = event.avatarFileID;
    // 归属校验：fileID 完全由客户端提供，不校验的话用户能把它指向云存储里
    // 任意文件（包括别人的头像）。只接受自己 openid 目录下的文件。
    if (fid.indexOf('cloud://') !== 0) {
      return { success: false, error: 'Invalid avatarFileID' };
    }
    if (fid.indexOf(`/${AVATAR_DIR}/${openId}/`) === -1) {
      return { success: false, error: 'Avatar path not owned by caller' };
    }
    patch.avatarFileID = fid;
  }

  // 排行榜公示开关。只认明确的真/假，认不出来就当没传 —— fail closed。
  // 小程序 callFunction 偶尔会把 boolean 序列化成 'true'/'false'，
  // 以前只认 typeof === 'boolean'，开关点了等于没写进库。
  const publicFlag = parseExactBool(event.leaderboardPublic);
  if (publicFlag !== undefined) {
    patch.leaderboardPublic = publicFlag;
  }

  if (Object.keys(patch).length === 0) {
    return { success: false, error: '没有需要更新的内容' };
  }

  const existing = await db.collection(COLLECTION).where({ _id: openId }).limit(1).get();
  const current = (existing.data || [])[0];

  if (!current) {
    const data = {
      ...emptyUserFields(openId),
      ...patch,
      createdAt: now,
      updatedAt: now
    };
    await db.collection(COLLECTION).doc(openId).set({ data });
    return { success: true, data: normalize(data, openId) };
  }

  await db.collection(COLLECTION).doc(openId).update({
    data: { ...patch, updatedAt: now }
  });

  // 换了新头像就把旧的删掉，否则每换一次都在云存储留一份永久垃圾。
  // 故意不 await：deleteFile 是一次外部网络调用，让它拖慢整个更新不划算；
  // 删失败也只是留个几 KB 的孤儿文件，不该影响本次更新结果。
  if (patch.avatarFileID && current.avatarFileID && current.avatarFileID !== patch.avatarFileID) {
    cloud.deleteFile({ fileList: [current.avatarFileID] })
      .catch((e) => console.warn('[user] 删除旧头像失败:', current.avatarFileID, e.message));
  }

  return { success: true, data: normalize({ ...current, ...patch, updatedAt: now }, openId) };
}

// ── 打卡 / 金币 / 会员 ──────────────────────────────────────────────────

// 读钱包。纯读，零副作用（与 getProfile 同理：不在读的时候建档）
async function getWallet(openId) {
  return { success: true, data: await buildWallet(openId) };
}

// 今日加成。只能在「能归属到人」的行为上算：
//   chat_usage 按 openid 建；papers 有 openId 字段。
// 「录题」按 openid 隔离后可以归属到人，但今日加成仍只用对话 / 组卷，
// 避免「刷题骗金币」。金币规则保持原样。
//
// 一律用 where().limit(1) 判存在，不用 doc().get()：
// 后者在文档不存在时是抛异常还是返回空，不同 SDK 版本行为不一致。
async function computeTodayBonuses(openId, dayKey) {
  const out = { chat: 0, paper: 0 };

  const chatRes = await db.collection(CHAT_USAGE_COLLECTION)
    .where({ openid: openId, dayKey, count: _.gt(0) })
    .limit(1)
    .get();
  if ((chatRes.data || []).length) out.chat = COIN_BONUS_CHAT;

  const paperRes = await db.collection(PAPER_COLLECTION)
    .where({
      openId,
      isDeleted: false,
      createdAt: _.gte(cnDayStartIso(dayKey))
    })
    .limit(1)
    .get();
  if ((paperRes.data || []).length) out.paper = COIN_BONUS_PAPER;

  return out;
}

// 连续打卡天数。checkins 是权威来源，users 上那几个冗余字段只为少读一次库。
// 调用方必须保证「今天」这条已经在 checkins 里了，否则会算少一天。
async function computeStreak(openId, todayKey) {
  const res = await db.collection(CHECKIN_COLLECTION)
    .where({ openid: openId })
    .orderBy('dayKey', 'desc')
    .limit(STREAK_LOOKBACK_DAYS)
    .get();
  const days = new Set((res.data || []).map((d) => d.dayKey));

  // 从今天往回逐日检查。dayKey 是北京时间的日历日字符串，
  // 这里按 UTC 零点做纯日期算术：减 24h 再取日期部分正好是前一天，
  // 与 dayKey 的语义一致（中国没有夏令时，不用考虑 23/25 小时的天）
  let streak = 0;
  let cursor = Date.parse(todayKey + 'T00:00:00Z');
  while (days.has(new Date(cursor).toISOString().slice(0, 10))) {
    streak += 1;
    cursor -= 86400000;
  }
  return streak;
}

async function countCheckins(openId) {
  const res = await db.collection(CHECKIN_COLLECTION).where({ openid: openId }).count();
  return (res && res.total) || 0;
}

// 「我的」页要显示的全部状态。打卡成功后也会调用它来拿最新数字，
// 所以它读到的必须是写库之后的值
async function buildWallet(openId) {
  const todayKey = cnDayKey();
  const days = recentDayKeys(7);

  const usersRes = await db.collection(COLLECTION).where({ _id: openId }).limit(1).get();
  const user = (usersRes.data || [])[0] || {};

  // 最近 7 天一次性查出来做集合判断，比按天点查 7 次省 6 次往返
  const recentRes = await db.collection(CHECKIN_COLLECTION)
    .where({ openid: openId, dayKey: _.in(days) })
    .get();
  const checkedSet = new Set((recentRes.data || []).map((d) => d.dayKey));

  // 今日加成要在用户按打卡「之前」就能看到 —— 否则「先学习再打卡金币更多」
  // 这个机制是暗箱，用户没机会据此安排顺序
  const todayBonus = await computeTodayBonuses(openId, todayKey);

  // 收藏/置顶计数。各自兜底成 0：计数查失败不该让整个钱包打不开，
  // 用户主要看的是金币和打卡状态
  const [favRes, pinRes] = await Promise.all([
    db.collection(MARKS_COLLECTION).where({ openid: openId, favorite: true }).count()
      .catch(() => ({ total: 0 })),
    db.collection(MARKS_COLLECTION).where({ openid: openId, pinned: true }).count()
      .catch(() => ({ total: 0 }))
  ]);

  const vipExpireAt = user.vipExpireAt || '';
  const vipExpireMs = Date.parse(vipExpireAt) || 0;

  return {
    coins: user.coins || 0,
    vipExpireAt,
    vipExpireMs,
    isVip: vipExpireMs > Date.now(),
    vipCost: VIP_COST_COINS,
    vipDays: VIP_DAYS,
    checkinStreak: user.checkinStreak || 0,
    checkinLastDay: user.checkinLastDay || '',
    checkinTotalDays: user.checkinTotalDays || 0,
    todayChecked: checkedSet.has(todayKey),
    todayBonus: {
      base: COIN_BASE_CHECKIN,
      chat: todayBonus.chat,
      paper: todayBonus.paper,
      total: COIN_BASE_CHECKIN + todayBonus.chat + todayBonus.paper
    },
    // 按时间正序返回（最早的在左），前端那排格子直接 wx:for 就是左旧右新
    recentDays: days.slice().reverse().map((dayKey) => ({
      dayKey,
      day: dayKey.slice(8),
      checked: checkedSet.has(dayKey),
      isToday: dayKey === todayKey
    })),
    favoriteCount: (favRes && favRes.total) || 0,
    pinnedCount: (pinRes && pinRes.total) || 0
  };
}

// 签到。每天只能成功一次，且只有真正写入成功的那一次发币。
async function checkin(openId) {
  const now = new Date().toISOString();
  const dayKey = cnDayKey();
  const _id = `${openId}_${dayKey}`;
  // 本次写入的凭据。回查时靠它区分「这条记录是我这次写的」还是「并发的另一次点击先写的」
  const token = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    await db.collection(CHECKIN_COLLECTION).add({
      data: { _id, openid: openId, dayKey, token, createdAt: now }
    });
  } catch (e) {
    // 重复 _id 会走到这里，属正常（今天已打卡）。
    // 但**没抛异常不等于写成功**：@cloudbase/database 的 collection.add
    // 在服务端返回错误码时是 return res 而不是 throw
    // （node_modules/@cloudbase/database/dist/commonjs/collection.js:42-44），
    // 所以这里两种可能的失败都不断言，一律交给下面的回查定论。
  }

  const readBack = await db.collection(CHECKIN_COLLECTION).doc(_id).get().catch(() => null);
  const doc = readBack && readBack.data;

  if (!doc) {
    // 记录根本没落库 —— 是真失败。不能谎报「今日已打卡」，
    // 那会让用户以为打上了、然后发现金币没加
    return { success: false, error: '打卡写入失败，请重试' };
  }

  if (doc.token !== token) {
    // 库里留着的是另一次点击的令牌 → 今天的打卡已被占用。
    // 并发的两次点击只有一次能走到下面的发币逻辑
    const wallet = await buildWallet(openId);
    return { success: true, data: { ...wallet, alreadyChecked: true, rewarded: 0 } };
  }

  // 令牌对上了：确认是我这次写进去的，才发币
  const bonuses = await computeTodayBonuses(openId, dayKey);
  const breakdown = {
    base: COIN_BASE_CHECKIN,
    chatBonus: bonuses.chat,
    paperBonus: bonuses.paper
  };
  // 金币流水。_id 确定性 + set() 幂等 → 账本里不可能出现同日同因的两条。
  // 「只发一次」由上面的 token 守卫保证，这里保证的是账本本身不会重复
  const entries = [
    ['checkin', breakdown.base],
    ['bonus_chat', breakdown.chatBonus],
    ['bonus_paper', breakdown.paperBonus]
  ].filter(([, amount]) => amount > 0);

  // 总额从 entries 求和，不再手写一遍加法。
  // 原先这里写的是 breakdown.base + breakdown.chatBonus + breakdown.paper ——
  // 最后一个字段名少写了 Bonus，10 + 0 + undefined = NaN，落库成了 coins: NaN，
  // 而 coin_logs 里的流水却是对的（它读的是 breakdown.paperBonus），
  // 于是余额和账本对不上。单一来源就不会再有这种拼写级别的错
  const total = entries.reduce((sum, [, amount]) => sum + amount, 0);

  for (const [reason, amount] of entries) {
    await db.collection(COIN_LOG_COLLECTION).doc(`${openId}_${dayKey}_${reason}`).set({
      data: { openid: openId, dayKey, reason, amount, createdAt: now }
    });
  }

  // 必须在写入 checkins 之后算 —— computeStreak 依赖今天这条已经在集合里
  const streak = await computeStreak(openId, dayKey);
  const totalDays = await countCheckins(openId);

  const baseFields = {
    checkinStreak: streak,
    checkinLastDay: dayKey,
    checkinTotalDays: totalDays,
    updatedAt: now
  };

  // 用户可能从没改过资料、也就没有 users 档，此时 update 命中 0 行
  const existing = await db.collection(COLLECTION).where({ _id: openId }).limit(1).get();

  if (!(existing.data || [])[0]) {
    await db.collection(COLLECTION).doc(openId).set({
      data: {
        openId,
        nickName: '',
        avatarFileID: '',
        stage: '',
        vipExpireAt: '',
        leaderboardPublic: false,
        // 新档没有历史余额，直接给终值 —— _.inc 是更新指令，不能用在 set 里
        coins: total,
        ...baseFields,
        createdAt: now
      }
    });
  } else {
    // 有历史余额，必须原子累加，不能「先读后写」
    await db.collection(COLLECTION).doc(openId).update({
      data: { ...baseFields, coins: _.inc(total) }
    });
  }

  const wallet = await buildWallet(openId);
  return {
    success: true,
    data: { ...wallet, alreadyChecked: false, rewarded: total, breakdown }
  };
}

async function redeemVip(openId) {
  const now = new Date().toISOString();

  // 条件更新做原子扣款：把余额条件写进 where，扣不动就是命中 0 行。
  // 「先读余额、再判断、再扣」在连点两次时会双花，甚至把余额扣成负数
  const res = await db.collection(COLLECTION)
    .where({ _id: openId, coins: _.gte(VIP_COST_COINS) })
    .update({ data: { coins: _.inc(-VIP_COST_COINS), updatedAt: now } });

  const updated = (res && res.stats && res.stats.updated) || 0;
  if (updated === 0) {
    return { success: false, error: `金币不足，兑换会员需要 ${VIP_COST_COINS} 金币` };
  }

  // 扣款之后再读一次，拿余额和原到期时间。
  // 这次读到的 coins 已经是扣过的值，不要再减一次
  const afterRes = await db.collection(COLLECTION).where({ _id: openId }).limit(1).get();
  const after = (afterRes.data || [])[0] || {};

  // 续期从 max(现在, 原到期时间) 往后加 —— 还没到期时兑换是叠加，
  // 而不是把剩余天数覆盖掉
  const currentExpireMs = Date.parse(after.vipExpireAt || '') || 0;
  const startMs = Math.max(Date.now(), currentExpireMs);
  const vipExpireAt = new Date(startMs + VIP_DAYS * 86400000).toISOString();

  await db.collection(COLLECTION).doc(openId).update({ data: { vipExpireAt, updatedAt: now } });

  return {
    success: true,
    data: {
      coins: after.coins || 0,
      vipExpireAt,
      isVip: true,
      days: VIP_DAYS,
      cost: VIP_COST_COINS
    }
  };
}

// ── 排行榜 ──────────────────────────────────────────────────────────────

const LEADERBOARD_LIMIT = 50;
const LEADERBOARD_METRICS = ['checkin', 'questions'];

// 一行榜单数据。**白名单逐字段挑，绝不 ...doc。**
// users 文档的 _id 就是 openid，直接把文档发出去等于把全站 openid 集体泄漏。
function toLeaderboardRow(doc, rank, openId, extra) {
  const isMe = doc._id === openId;
  const nickName = (doc.nickName || '').trim();
  return {
    rank,
    isMe,
    name: nickName || '未设置昵称',
    avatarFileID: doc.avatarFileID || '',
    score: extra.score || 0,
    scoreUnit: extra.scoreUnit || '',
    subLabel: extra.subLabel || ''
  };
}

async function fetchUsersByIds(ids) {
  const map = {};
  const unique = [];
  const seen = {};
  (ids || []).forEach((id) => {
    if (!id || seen[id]) return;
    seen[id] = true;
    unique.push(id);
  });
  for (let i = 0; i < unique.length; i += 10) {
    const chunk = unique.slice(i, i + 10);
    const res = await db.collection(COLLECTION).where({ _id: _.in(chunk) }).get();
    (res.data || []).forEach((d) => { map[d._id] = d; });
  }
  return map;
}

async function loadMyUser(openId) {
  const meRes = await db.collection(COLLECTION).where({ _id: openId }).limit(1).get();
  return (meRes.data || [])[0] || { _id: openId };
}

function wrapLeaderboard(metric, rows, meDoc, myRank, extraMe) {
  return {
    success: true,
    data: {
      metric,
      rows,
      me: {
        rank: myRank,
        onBoard: rows.some((r) => r.isMe),
        name: (meDoc.nickName || '').trim(),
        avatarFileID: meDoc.avatarFileID || '',
        score: extraMe.score || 0,
        scoreUnit: extraMe.scoreUnit || '',
        subLabel: extraMe.subLabel || ''
      },
      limit: LEADERBOARD_LIMIT
    }
  };
}

// 打卡榜：连续天数。必须过滤 checkinLastDay ——
// users.checkinStreak 只在打卡那一刻回写，10 天前打过之后没回来的人
// 档里仍写着 10，不过滤会站着一排已经断签的人。含昨天是因为今天还没过完。
async function leaderboardByCheckin(openId) {
  const recentTwoDays = recentDayKeys(2);
  const conditions = {
    checkinStreak: _.gt(0),
    checkinLastDay: _.in(recentTwoDays)
  };

  const res = await db.collection(COLLECTION)
    .where(conditions)
    .orderBy('checkinStreak', 'desc')
    .orderBy('checkinTotalDays', 'desc')
    .limit(LEADERBOARD_LIMIT)
    .get();

  const rows = (res.data || []).map((doc, i) => toLeaderboardRow(doc, i + 1, openId, {
    score: doc.checkinStreak || 0,
    scoreUnit: '天',
    subLabel: '累计 ' + (doc.checkinTotalDays || 0) + ' 天'
  }));

  const me = await loadMyUser(openId);
  const myStreak = me.checkinStreak || 0;
  const myLastDay = me.checkinLastDay || '';
  const iAmRanked = myStreak > 0 && recentTwoDays.indexOf(myLastDay) !== -1;

  let myRank = 0;
  if (iAmRanked) {
    const ahead = await db.collection(COLLECTION)
      .where({ ...conditions, checkinStreak: _.gt(myStreak) })
      .count();
    myRank = ((ahead && ahead.total) || 0) + 1;
  }

  return wrapLeaderboard('checkin', rows, me, myRank, {
    score: myStreak,
    scoreUnit: '天',
    subLabel: myRank ? '累计 ' + (me.checkinTotalDays || 0) + ' 天' : '昨天或今天打过卡才上榜'
  });
}

// 错题整理榜：按每人未删除错题数。题目已按 openid 隔离，这里才能按人计数。
async function leaderboardByQuestions(openId) {
  const agg = await db.collection('questions')
    .aggregate()
    .match({ isDeleted: false })
    .group({ _id: '$openid', count: $.sum(1) })
    .sort({ count: -1 })
    .limit(1000)
    .end();

  const ranked = (agg.list || []).filter((g) => g._id && g.count > 0);
  const board = ranked.slice(0, LEADERBOARD_LIMIT);
  const users = await fetchUsersByIds(board.map((g) => g._id).concat([openId]));

  const rows = board.map((g, i) => toLeaderboardRow(
    users[g._id] || { _id: g._id },
    i + 1,
    openId,
    { score: g.count, scoreUnit: '道', subLabel: '' }
  ));

  const me = users[openId] || { _id: openId };
  const mine = ranked.find((g) => g._id === openId);
  const myCount = mine ? mine.count : 0;
  let myRank = 0;
  if (myCount > 0) {
    myRank = ranked.filter((g) => g.count > myCount).length + 1;
  }

  return wrapLeaderboard('questions', rows, me, myRank, {
    score: myCount,
    scoreUnit: '道',
    subLabel: myRank ? '' : '整理错题后即可上榜'
  });
}

async function leaderboard(openId, event) {
  const metric = event.metric === 'questions' ? 'questions' : 'checkin';
  if (LEADERBOARD_METRICS.indexOf(metric) === -1) {
    return { success: false, error: 'Invalid metric' };
  }
  if (metric === 'questions') return leaderboardByQuestions(openId);
  return leaderboardByCheckin(openId);
}

async function countOf(collection, where) {
  const res = await db.collection(collection).where(where).count();
  return (res && res.total) || 0;
}

// 删一批，并**用删前删后的记录数自证删干净了**。
//
// 不靠 remove() 的返回结构做判断：这个 SDK 确实给 stats.removed
// （wx-server-sdk/index.js 里 resolve({ stats: { removed } })），但与其依赖它，
// 不如数一遍 —— 数出来的差值不会骗人，也能顺带发现「字段名写错导致一条没删」
// 这个本功能最危险的失败模式（用户以为删干净了，其实原封不动）。
//
// where().remove() 不支持 skip/limit，没法分页，所以循环删到剩 0 为止；
// 上限 10 轮纯粹防呆，正常第一轮就清空。
// 归属字段探针。先确认 where 里用的字段名在集合里真的存在，再动手删。
//
// 为什么需要它：字段名写错时 where 一条都匹配不上，before / after 都是 0，
// 差值也是 0 —— 「一条都没删」和「本来就没有数据」在计数上长得一模一样。
// 光靠数数抓不到这个最危险的失败模式（用户以为删干净了，其实原封不动）。
//
// 而这里的探针是可靠的：papers 只有 paper/index.js:102 一个写入点，
// chat_memories 只有 answer/index.js:138 的 upsertMemory 一个写入点，
// 每个写入路径都必带归属字段。所以「集合非空、却没有任何一条含该键」
// 只可能是拼写错误，不会误伤。
async function ownerFieldExists(collection, field) {
  try {
    const res = await db.collection(collection).limit(5).get();
    const docs = res.data || [];
    if (!docs.length) return true; // 空集合，无从判断，放行
    return docs.some((d) => Object.prototype.hasOwnProperty.call(d, field));
  } catch (e) {
    return true; // 探针自己失败不该阻断删除，后续 purge 的 try/catch 会如实报错
  }
}

async function purge(failed, removed, label, collection, where) {
  const field = Object.keys(where)[0];
  removed[label] = 0; // 先占位，保证返回结构在提前退出时也是一致的

  if (!(await ownerFieldExists(collection, field))) {
    failed.push({
      target: label,
      error: `归属字段 ${field} 在 ${collection} 中不存在，疑似拼写错误，已跳过删除`
    });
    return;
  }

  try {
    const before = await countOf(collection, where);
    let after = before;
    for (let i = 0; i < 10; i++) {
      await db.collection(collection).where(where).remove();
      after = await countOf(collection, where);
      if (after === 0) break;
    }
    removed[label] = before - after;
    if (after > 0) {
      failed.push({ target: label, error: `仍有 ${after} 条未删除` });
    }
  } catch (e) {
    failed.push({ target: label, error: e.message });
  }
}

// 注销：只删真正属于调用者的数据，含其名下错题与分类。
async function deleteAccount(openId) {
  // 兜底守卫。上层 :16-18 已经挡了空 openid，但这是个破坏性操作，
  // 值得再挡一次字面量 'anonymous' —— paper/index.js:40 就会兜底成这个值，
  // 所以库里可能真有 openId:'anonymous' 的数据行。
  // 万一将来有人给 getOpenId 加了兜底，这一行能防止「删掉一整批匿名用户的数据」。
  if (!openId || openId === 'anonymous') {
    return { success: false, error: 'No openid' };
  }

  const removed = {};
  const failed = [];

  // 头像 fileID 必须趁 users 档还在时读出来
  let avatarFileID = '';
  try {
    const res = await db.collection(COLLECTION).where({ _id: openId }).limit(1).get();
    avatarFileID = ((res.data || [])[0] || {}).avatarFileID || '';
  } catch (e) {
    failed.push({ target: 'users:read', error: e.message });
  }

  // 字段名不一致，抄错不会报错、只会静默少删：
  // chat_memories 用小写 openid（answer/index.js:142），papers 用驼峰 openId（paper/index.js:82）。
  // papers 不加 isDeleted 过滤 —— 软删过的行里一样存着用户的题目内容。
  await purge(failed, removed, 'chatMemories', 'chat_memories', { openid: openId });
  await purge(failed, removed, 'papers', 'papers', { openId: openId });
  await purge(failed, removed, 'questionNotes', 'question_notes', { openid: openId });
  await purge(failed, removed, 'mistakeReports', 'mistake_reports', { openid: openId });

  // 打卡与金币相关。这四个集合统一用小写 openid（本文件新建，不需要迁就历史命名）。
  // 注销是「清除我的数据」，留着打卡和金币流水就名不副实。
  // users 档里的 coins / vipExpireAt 随下面的 users 一起删掉
  await purge(failed, removed, 'checkins', CHECKIN_COLLECTION, { openid: openId });
  await purge(failed, removed, 'coinLogs', COIN_LOG_COLLECTION, { openid: openId });
  await purge(failed, removed, 'chatUsage', CHAT_USAGE_COLLECTION, { openid: openId });
  // 收藏/置顶/掌握标记
  await purge(failed, removed, 'questionMarks', MARKS_COLLECTION, { openid: openId });
  await purge(failed, removed, 'questions', 'questions', { openid: openId });
  await purge(failed, removed, 'categories', 'categories', { openid: openId });

  if (avatarFileID) {
    try {
      await cloud.deleteFile({ fileList: [avatarFileID] });
      removed.avatarFile = 1;
    } catch (e) {
      failed.push({ target: 'avatarFile', error: e.message });
    }
  }

  // users 档放在最后删。
  // 它是 avatarFileID 的唯一记录 —— 先删掉的话，后面任何一步失败/超时，
  // 重试时就再也查不到那个 fileID，云存储里会留下一个永远没人认领的孤儿文件。
  await purge(failed, removed, 'users', COLLECTION, { _id: openId });

  // 成功与否都返回 success:true —— 注销这件事本身跑完了。
  // 是否彻底用 complete 表达，让客户端能区分「全删干净」和「删了一部分」，
  // 不至于因为一轮网络抖动就谎报全部失败、把已经删掉的数据说成还在。
  return {
    success: true,
    data: { removed, failed, complete: failed.length === 0 }
  };
}
