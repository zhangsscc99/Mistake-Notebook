const CLASS_KEY = 'mn_teacher_class_id'
const PICK_KEY = 'mn_teacher_pick'

export function getSelectedClassId() {
  try { return Number(sessionStorage.getItem(CLASS_KEY) || 0) || 0 } catch { return 0 }
}

export function setSelectedClassId(id) {
  try {
    if (id) sessionStorage.setItem(CLASS_KEY, String(id))
    else sessionStorage.removeItem(CLASS_KEY)
  } catch { /* ignore */ }
}

export function readPick() {
  try { return JSON.parse(sessionStorage.getItem(PICK_KEY) || 'null') || {} } catch { return {} }
}

export function writePick(next) {
  try {
    if (next && next.questionIds && next.questionIds.length) {
      sessionStorage.setItem(PICK_KEY, JSON.stringify(next))
    } else {
      sessionStorage.removeItem(PICK_KEY)
    }
  } catch { /* ignore */ }
}

export function pickIds() {
  const ids = readPick().questionIds
  return Array.isArray(ids) ? ids : []
}

export function markOf(name) {
  const n = (name || '学').trim()
  return n ? n.slice(0, 1) : '学'
}

export function fmtDay(t) {
  if (!t) return ''
  return String(t).replace('T', ' ').slice(0, 16)
}

export function shortText(s, n = 52) {
  const t = String(s || '').replace(/\s+/g, ' ').trim()
  return t.length <= n ? t : t.slice(0, n) + '…'
}
