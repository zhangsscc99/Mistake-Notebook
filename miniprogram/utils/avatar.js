// 头像：相册或拍照，再尽量按 1:1 裁剪。不用 chooseAvatar，那个主要是「用微信头像」。

function isCancel(err) {
  return /cancel/i.test(String((err && err.errMsg) || err && err.message || ''));
}

function chooseImageFile() {
  return new Promise((resolve, reject) => {
    const fail = function (err) {
      if (isCancel(err)) {
        reject(new Error('cancel'));
        return;
      }
      reject(err || new Error('choose fail'));
    };

    if (typeof wx.chooseMedia === 'function') {
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        sizeType: ['compressed'],
        success: function (res) {
          const path = res.tempFiles && res.tempFiles[0] && res.tempFiles[0].tempFilePath;
          if (path) resolve(path);
          else reject(new Error('empty'));
        },
        fail: fail
      });
      return;
    }

    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: function (res) {
        const path = res.tempFilePaths && res.tempFilePaths[0];
        if (path) resolve(path);
        else reject(new Error('empty'));
      },
      fail: fail
    });
  });
}

function cropSquare(src) {
  if (typeof wx.cropImage !== 'function') return Promise.resolve(src);
  return new Promise((resolve) => {
    wx.cropImage({
      src: src,
      cropScale: '1:1',
      success: function (res) {
        resolve((res && res.tempFilePath) || src);
      },
      fail: function () {
        resolve(src);
      }
    });
  });
}

function pickAvatarPhoto() {
  return chooseImageFile().then(cropSquare);
}

module.exports = {
  pickAvatarPhoto,
  isCancel
};
