const db = wx.cloud.database();
const _ = db.command;

function mapPendingDoc(doc) {
  const id = doc._id || doc.id || '';
  const content = (doc.content || '').replace(/\s+/g, ' ').trim();
  return {
    id,
    _id: id,
    content,
    preview: content.length > 60 ? content.slice(0, 60) + '…' : content,
    category: doc.category || '',
    aiStatus: doc.aiStatus || 'pending',
    createdAt: doc.createdAt || ''
  };
}

function startPendingWatch(onSnapshot, onError) {
  return db.collection('questions')
    .where({
      isDeleted: false,
      aiStatus: _.in(['pending', 'processing', 'failed'])
    })
    .orderBy('createdAt', 'desc')
    .watch({
      onChange: (snapshot) => {
        const docs = (snapshot.docs || []).map(mapPendingDoc);
        onSnapshot(docs, snapshot);
      },
      onError: (err) => {
        console.warn('pendingWatch error', err);
        if (typeof onError === 'function') onError(err);
      }
    });
}

function closePendingWatch(watcher) {
  if (watcher && typeof watcher.close === 'function') {
    watcher.close();
  }
}

function fetchPendingQuestions() {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: 'question',
      data: { action: 'pending' },
      success: (res) => {
        const result = res.result || {};
        if (!result.success) {
          reject(new Error(result.error || '加载解析中题目失败'));
          return;
        }
        const list = (result.data || []).map((q) => mapPendingDoc({
          ...q,
          _id: q.id || q._id
        }));
        resolve(list);
      },
      fail: reject
    });
  });
}

module.exports = {
  mapPendingDoc,
  startPendingWatch,
  closePendingWatch,
  fetchPendingQuestions
};
