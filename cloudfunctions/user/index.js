const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const COLLECTION = 'users';
const MAX_NICKNAME_LEN = 20;
const AVATAR_DIR = 'avatars';

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

  // 白名单：只认这两个字段，其余入参一律忽略
  if (typeof event.nickName === 'string') {
    const nickName = event.nickName.trim();
    // 按码点计长，避免 emoji 被算成两个字符
    if ([...nickName].length > MAX_NICKNAME_LEN) {
      return { success: false, error: `昵称不能超过 ${MAX_NICKNAME_LEN} 个字` };
    }
    patch.nickName = nickName;
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
