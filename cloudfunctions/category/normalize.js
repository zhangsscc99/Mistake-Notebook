function normalizeCategory(record) {
  if (!record) return record;
  const id = record.id || record._id || '';
  return {
    ...record,
    id,
    _id: record._id || id,
    questionCount: record.questionCount || 0
  };
}

module.exports = { normalizeCategory };
