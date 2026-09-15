// 邀请海报：画在 type=2d 的 canvas 上，再导出临时文件给「保存图片 / 转发封面」。
const { APP_NAME } = require('./share');

const POSTER_W = 600;
const POSTER_H = 840;
const DEFAULT_AVATAR = '/images/default-avatar.png';

function roundRectPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function ellipsize(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let s = String(text || '');
  while (s.length && ctx.measureText(s + '…').width > maxWidth) {
    s = s.slice(0, -1);
  }
  return s ? s + '…' : '';
}

function loadCanvasImage(canvas, src) {
  return new Promise((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }
    const img = canvas.createImage();
    img.onload = function () { resolve(img); };
    img.onerror = function () { resolve(null); };
    img.src = src;
  });
}

function resolveAvatarSrc(fileID) {
  if (!fileID) return Promise.resolve(DEFAULT_AVATAR);
  if (fileID.indexOf('cloud://') !== 0) return Promise.resolve(fileID);
  return wx.cloud.getTempFileURL({ fileList: [fileID] }).then((res) => {
    const url = res.fileList && res.fileList[0] && res.fileList[0].tempFileURL;
    return url || DEFAULT_AVATAR;
  }).catch(function () {
    return DEFAULT_AVATAR;
  });
}

function queryCanvas(id) {
  return new Promise((resolve, reject) => {
    wx.createSelectorQuery()
      .select('#' + id)
      .fields({ node: true, size: true })
      .exec((res) => {
        const info = res && res[0];
        if (!info || !info.node) {
          reject(new Error('canvas missing'));
          return;
        }
        resolve(info);
      });
  });
}

function waitCanvas(id, tries) {
  tries = tries || 0;
  return queryCanvas(id).then((info) => {
    if (info.width > 0 && info.height > 0) return info;
    if (tries >= 10) return Promise.reject(new Error('canvas not ready'));
    return new Promise((r) => setTimeout(r, 40)).then(() => waitCanvas(id, tries + 1));
  }).catch((err) => {
    if (tries >= 10) return Promise.reject(err);
    return new Promise((r) => setTimeout(r, 40)).then(() => waitCanvas(id, tries + 1));
  });
}

function drawPoster(ctx, avatarImg, opts) {
  const W = POSTER_W;
  const H = POSTER_H;
  const nick = (opts && opts.nickName) || '同学';
  const levelName = (opts && opts.levelName) || '';

  ctx.fillStyle = '#eef3fb';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = 'rgba(82,183,255,0.16)';
  ctx.beginPath();
  ctx.arc(W - 30, 10, 170, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(182,166,255,0.14)';
  ctx.beginPath();
  ctx.arc(8, 90, 130, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(11,22,51,0.035)';
  ctx.lineWidth = 1;
  for (let i = 0; i < W; i += 22) {
    ctx.beginPath();
    ctx.moveTo(i + 0.5, 0);
    ctx.lineTo(i + 0.5, H);
    ctx.stroke();
  }
  for (let j = 0; j < H; j += 22) {
    ctx.beginPath();
    ctx.moveTo(0, j + 0.5);
    ctx.lineTo(W, j + 0.5);
    ctx.stroke();
  }

  const cx = 36;
  const cy = 44;
  const cw = W - 72;
  const ch = H - 116;

  ctx.save();
  ctx.shadowColor = 'rgba(11,22,51,0.10)';
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 10;
  roundRectPath(ctx, cx, cy, cw, ch, 28);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundRectPath(ctx, cx, cy, cw, ch, 28);
  ctx.clip();
  const bar = ctx.createLinearGradient(cx, cy, cx + cw, cy);
  bar.addColorStop(0, '#2459ff');
  bar.addColorStop(0.5, '#52b7ff');
  bar.addColorStop(1, '#b6a6ff');
  ctx.fillStyle = bar;
  ctx.fillRect(cx, cy, cw, 6);
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#0b1633';
  ctx.font = '800 40px sans-serif';
  ctx.fillText(APP_NAME, W / 2, cy + 52);

  ctx.fillStyle = 'rgba(11,22,51,0.48)';
  ctx.font = '500 20px sans-serif';
  ctx.fillText('拍照就能整理错题，AI 自动分类组卷', W / 2, cy + 96);

  const ax = W / 2;
  const ay = cy + 188;
  const ar = 46;
  ctx.save();
  ctx.beginPath();
  ctx.arc(ax, ay, ar, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = '#dbe7ff';
  ctx.fillRect(ax - ar, ay - ar, ar * 2, ar * 2);
  if (avatarImg) {
    ctx.drawImage(avatarImg, ax - ar, ay - ar, ar * 2, ar * 2);
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(ax, ay, ar, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(36,89,255,0.28)';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = '#0b1633';
  ctx.font = '700 28px sans-serif';
  const inviteLine = ellipsize(ctx, nick, cw - 120) + ' 邀请你一起用';
  ctx.fillText(inviteLine, W / 2, ay + ar + 40);

  if (levelName) {
    const pill = 'Lv · ' + levelName;
    ctx.font = '600 16px sans-serif';
    const pw = Math.min(cw - 80, ctx.measureText(pill).width + 28);
    const px = (W - pw) / 2;
    const py = ay + ar + 62;
    roundRectPath(ctx, px, py, pw, 28, 14);
    ctx.fillStyle = 'rgba(36,89,255,0.10)';
    ctx.fill();
    ctx.fillStyle = '#2459ff';
    ctx.textBaseline = 'middle';
    ctx.fillText(pill, W / 2, py + 14);
  }

  const rows = [
    '拍照录入，自动分类',
    '智能组卷，导出 PDF',
    '错因分析，变式训练'
  ];
  const rowY0 = ay + ar + 118;
  rows.forEach(function (text, i) {
    const y = rowY0 + i * 52;
    ctx.beginPath();
    ctx.arc(cx + 56, y, 11, 0, Math.PI * 2);
    ctx.fillStyle = '#2459ff';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✓', cx + 56, y + 1);
    ctx.fillStyle = '#0b1633';
    ctx.font = '600 22px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(text, cx + 80, y);
  });

  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(11,22,51,0.42)';
  ctx.font = '500 18px sans-serif';
  ctx.fillText('微信搜索「' + APP_NAME + '」即可使用', W / 2, H - 52);
}

function exportCanvas(canvas) {
  return new Promise((resolve, reject) => {
    wx.canvasToTempFilePath({
      canvas: canvas,
      fileType: 'png',
      destWidth: POSTER_W,
      destHeight: POSTER_H,
      success: function (res) {
        if (!res.tempFilePath) {
          reject(new Error('export empty'));
          return;
        }
        resolve(res.tempFilePath);
      },
      fail: reject
    });
  });
}

function renderInvitePoster(canvasId, opts) {
  return waitCanvas(canvasId).then((info) => {
    const canvas = info.node;
    const ctx = canvas.getContext('2d');
    if (!ctx) return Promise.reject(new Error('no 2d context'));

    const dpr = (wx.getSystemInfoSync() || {}).pixelRatio || 2;
    canvas.width = POSTER_W * dpr;
    canvas.height = POSTER_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    return resolveAvatarSrc(opts && opts.avatarFileID)
      .then((src) => loadCanvasImage(canvas, src))
      .then((avatarImg) => loadCanvasImage(canvas, DEFAULT_AVATAR).then((fallback) => {
        drawPoster(ctx, avatarImg || fallback, opts);
        return exportCanvas(canvas);
      }));
  });
}

function errMsgOf(err) {
  return String((err && (err.errMsg || err.message)) || '');
}

function isAuthFail(err) {
  const msg = errMsgOf(err).toLowerCase();
  return msg.indexOf('auth deny') !== -1
    || msg.indexOf('authorize') !== -1
    || msg.indexOf('permission') !== -1;
}

function isPrivacyFail(err) {
  return errMsgOf(err).toLowerCase().indexOf('privacy') !== -1;
}

function persistTempFile(filePath) {
  return new Promise((resolve) => {
    if (!filePath || typeof wx.getFileSystemManager !== 'function') {
      resolve(filePath);
      return;
    }
    try {
      wx.getFileSystemManager().saveFile({
        tempFilePath: filePath,
        success: function (res) {
          resolve(res.savedFilePath || filePath);
        },
        fail: function () {
          resolve(filePath);
        }
      });
    } catch (e) {
      resolve(filePath);
    }
  });
}

function callSave(filePath) {
  return new Promise((resolve, reject) => {
    wx.saveImageToPhotosAlbum({
      filePath: filePath,
      success: resolve,
      fail: reject
    });
  });
}

function askOpenAlbumSetting() {
  return new Promise((resolve, reject) => {
    wx.showModal({
      title: '需要相册权限',
      content: '保存邀请图到相册，请打开「保存到相册」权限',
      confirmText: '去设置',
      success: function (m) {
        if (!m.confirm) {
          reject(new Error('cancel'));
          return;
        }
        wx.openSetting({
          success: function (s) {
            if (s.authSetting && s.authSetting['scope.writePhotosAlbum']) resolve();
            else reject(new Error('denied'));
          },
          fail: reject
        });
      }
    });
  });
}

function requirePrivacyIfNeeded() {
  return new Promise((resolve, reject) => {
    if (typeof wx.requirePrivacyAuthorize !== 'function') {
      resolve();
      return;
    }
    wx.requirePrivacyAuthorize({
      success: resolve,
      fail: function (err) {
        if (errMsgOf(err).indexOf('authorized') !== -1) resolve();
        else reject(err);
      }
    });
  });
}

// 不要先 wx.authorize：新基础库对相册不再弹授权窗，authorize 会直接失败。
// 也不要在保存前 showLoading(mask)：系统授权弹窗会被挡住。
function savePosterToAlbum(filePath) {
  return persistTempFile(filePath).then((path) => {
    return callSave(path).catch((err) => {
      if (isPrivacyFail(err)) {
        return requirePrivacyIfNeeded().then(() => callSave(path));
      }
      if (isAuthFail(err)) {
        return askOpenAlbumSetting().then(() => callSave(path));
      }
      return Promise.reject(err);
    });
  });
}

function saveFailHint(err) {
  if (err && err.message === 'cancel') return '';
  const platform = ((wx.getSystemInfoSync() || {}).platform) || '';
  if (platform === 'devtools') {
    return '开发者工具写不了系统相册，请用真机预览后再保存';
  }
  if (err && err.message === 'denied') return '未打开相册权限';
  if (isAuthFail(err)) return '没有相册权限';
  if (isPrivacyFail(err)) return '请先同意隐私协议';
  return '保存失败';
}

module.exports = {
  renderInvitePoster,
  savePosterToAlbum,
  saveFailHint
};
