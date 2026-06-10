function normalizeDifficulty(difficulty) {
  if (!difficulty) return 'medium';
  const value = String(difficulty).toLowerCase();
  if (value === 'easy' || value === '简单') return 'easy';
  if (value === 'hard' || value === '困难') return 'hard';
  return 'medium';
}

function normalizeQuestion(record) {
  if (!record) return record;
  const id = record.id || record._id || '';
  return {
    ...record,
    id,
    _id: record._id || id,
    content: record.content || record.recognizedText || '',
    recognizedText: record.recognizedText || record.content || '',
    difficulty: normalizeDifficulty(record.difficulty),
    categoryId: record.categoryId || '',
    createdAt: record.createdAt || record.updatedAt || ''
  };
}

module.exports = { normalizeDifficulty, normalizeQuestion };
