const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const COLLECTION = 'users';
const MAX_NICKNAME_LEN = 20;
const AVATAR_DIR = 'avatars';

// 与客户端 miniprogram/utils/profile.js 的 STAGES 保持一致。
// 客户端那份只管渲染，这份才是把关的 —— 客户端可以传任何字符串过来。
const STAGES = ['小学', '初中', '高中', '大学'];

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
      case 'updateProfile':
        return await updateProfile(openId, event);
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

function normalize(record, openId) {
  return {
    openId,
    exists: !!record,
    nickName: (record && record.nickName) || '',
    avatarFileID: (record && record.avatarFileID) || '',
    stage: (record && record.stage) || '',
    createdAt: (record && record.createdAt) || '',
    updatedAt: (record && record.updatedAt) || ''
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

  if (Object.keys(patch).length === 0) {
    return { success: false, error: '没有需要更新的内容' };
  }

  const existing = await db.collection(COLLECTION).where({ _id: openId }).limit(1).get();
  const current = (existing.data || [])[0];

  if (!current) {
    const data = {
      openId,
      nickName: '',
      avatarFileID: '',
      stage: '',
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

// 注销：只删真正属于调用者的数据。
// 刻意不碰 questions / categories —— 那两个集合写入时根本没有归属字段
// （question/index.js:92、upload/index.js:184 都不带主人标记），是全局共享的，
// 删了会连累其他用户。这一点在客户端弹窗里也说清楚了，不能含糊。
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
