const MARKS = {
  数学: '数',
  物理: '物',
  化学: '化',
  英语: '英',
  语文: '语',
  生物: '生',
  历史: '史',
  地理: '地',
  政治: '政',
  体育: '体',
  '计算机/编程': '码',
  计算机: '码',
  编程: '码'
}

export function categoryMark(name) {
  const key = String(name || '').trim()
  return MARKS[key] || '题'
}
