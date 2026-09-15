// 把 AI 生成的「【标题】正文」结构文本解析成分块数组，
// 供 WXML 分节渲染（错题讲解、错因分析报告共用）。
// 返回 [{ title: '题目考点', text: '…多行正文…' }]，无标题的散行归入 title 为 '' 的块。
function parseSectionedText(text) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let cur = null;

  lines.forEach((raw) => {
    const line = raw.trim();
    if (!line) return;
    const m = line.match(/^【(.+?)】\s*(.*)$/);
    if (m) {
      cur = { title: m[1], lines: m[2] ? [m[2]] : [] };
      blocks.push(cur);
    } else if (cur) {
      cur.lines.push(line);
    } else {
      cur = { title: '', lines: [line] };
      blocks.push(cur);
    }
  });

  return blocks.map((b) => ({ title: b.title, text: b.lines.join('\n') }));
}

module.exports = { parseSectionedText };
