const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const https = require('https');

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;
const DASHSCOPE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

const DASHSCOPE_MODEL = 'qwen3-vl-flash';
const MAX_IMAGES = 10;
const ONE_SHOT_MAX = 5;

function callDashScopeVL(messages, temperature = 0.3) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: DASHSCOPE_MODEL,
      messages,
      stream: false,
      temperature
    });

    const url = new URL(DASHSCOPE_URL);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`Failed to parse DashScope response: ${e.message}, body: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(280000, () => {
      req.destroy();
      reject(new Error('DashScope timeout'));
    });
    req.write(data);
    req.end();
  });
}

function parseJsonArray(content) {
  if (!content || typeof content !== 'string') return null;
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return Array.isArray(parsed) ? parsed : null;
  } catch (e) {
    return null;
  }
}

function collectFileIDs(event) {
  const ids = [];
  if (Array.isArray(event.fileIDs)) ids.push(...event.fileIDs);
  if (event.fileID) ids.push(event.fileID);
  const unique = [];
  ids.forEach((id) => {
    if (id && unique.indexOf(id) === -1) unique.push(id);
  });
  return unique.slice(0, MAX_IMAGES);
}

async function mapPool(items, limit, mapper) {
  const result = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      result[index] = await mapper(items[index], index);
    }
  }
  const n = Math.min(limit, items.length) || 1;
  await Promise.all(Array.from({ length: n }, worker));
  return result;
}

exports.main = async (event) => {
  const { action } = event;

  try {
    switch (action) {
      case 'segment':
        return await segmentQuestions(event);
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  } catch (err) {
    console.error(err);
    return { success: false, error: err.message };
  }
};

async function downloadPages(fileIDs) {
  return mapPool(fileIDs, 4, async (fileID, index) => {
    const downloadRes = await cloud.downloadFile({ fileID });
    return {
      fileID,
      index,
      base64: downloadRes.fileContent.toString('base64')
    };
  });
}

async function segmentQuestions(event) {
  const fileIDs = collectFileIDs(event);
  if (!fileIDs.length) {
    return { success: false, error: 'Missing fileID' };
  }

  const pages = await downloadPages(fileIDs);
  let raw = [];

  if (pages.length === 1) {
    raw = await segmentOneShot(pages, singlePagePrompt());
  } else if (pages.length <= ONE_SHOT_MAX) {
    raw = await segmentOneShot(pages, multiPagePrompt(pages));
  } else {
    const chunks = [];
    for (let i = 0; i < pages.length; i += ONE_SHOT_MAX) {
      chunks.push(pages.slice(i, i + ONE_SHOT_MAX));
    }
    const chunkSegs = await mapPool(chunks, 2, async (chunk) =>
      segmentOneShot(chunk, multiPagePrompt(chunk))
    );
    const byPage = pages.map(() => []);
    chunkSegs.flat().forEach((item) => {
      const spans = Array.isArray(item.pageSpans) && item.pageSpans.length
        ? item.pageSpans
        : [{ pageIndex: item.pageIndex || 0, bounds: item.bounds }];
      const pageIndex = clampPageIndex(spans[0].pageIndex, pages.length);
      if (!byPage[pageIndex]) byPage[pageIndex] = [];
      byPage[pageIndex].push(item);
    });
    raw = await mergeCrossPage(byPage, pages.length);
  }

  const normalized = (raw || []).map((segment, index) =>
    normalizeSegment(segment, index, raw.length, pages.length)
  ).filter((segment) => segment.content);

  return {
    success: true,
    data: {
      segments: normalized,
      count: normalized.length,
      pageCount: pages.length
    }
  };
}

function singlePagePrompt() {
  return `这张图片可能包含多道题目。请识别并分割图片中的每一道题目。

对每一道题目，请提取以下信息并按JSON数组格式返回（不要包含markdown代码块标记）：

[
  {
    "content": "题目的完整文字内容",
    "type": "选择题 | 填空题 | 解答题 | 判断题 | 其他",
    "subject": "学科分类（只能是：数学、英语、物理、化学、生物、历史、地理、政治、语文、计算机/编程 之一）",
    "confidence": 0.0-1.0,
    "bounds": { "top": 0, "left": 0, "width": 0, "height": 0 }
  }
]

bounds 使用该页百分比 0-100。如果图片中只有一道题目，也请按数组格式返回。请确保提取尽可能完整的题目内容。`;
}

function multiPagePrompt(pages) {
  const first = (pages[0] && pages[0].index) || 0;
  const last = (pages[pages.length - 1] && pages[pages.length - 1].index) || first;
  const indexes = pages.map((page) => page.index).join(', ');
  return `下面按顺序给出同一份试卷的连续页：第${first + 1}页到第${last + 1}页。

请切出每一道完整题目。如果一道题从某一页末尾跨到下一页开头，必须合并成一条，不要拆成两道残题。

按 JSON 数组返回（不要 markdown 代码块）：
[
  {
    "content": "完整题目文字（跨页题请拼接两页内容）",
    "type": "选择题 | 填空题 | 解答题 | 判断题 | 其他",
    "subject": "学科（数学、英语、物理、化学、生物、历史、地理、政治、语文、计算机/编程 之一）",
    "confidence": 0.0-1.0,
    "pageSpans": [
      { "pageIndex": ${first}, "bounds": { "top": 0, "left": 0, "width": 100, "height": 30 } }
    ]
  }
]

pageIndex 必须使用图上标注的真实编号（${indexes}），不要从 0 重新计数。bounds 是该页百分比 0-100。跨页题的 pageSpans 含多个页。`;
}

async function segmentOneShot(pages, prompt) {
  const content = [];
  pages.forEach((page, i) => {
    content.push({
      type: 'image_url',
      image_url: {
        url: `data:image/jpeg;base64,${page.base64}`
      }
    });
    if (pages.length > 1) {
      content.push({
        type: 'text',
        text: `以上是第${page.index + 1}页，pageIndex=${page.index}。`
      });
    }
  });
  content.push({ type: 'text', text: prompt });

  const response = await callDashScopeVL([
    { role: 'user', content }
  ], 0.2);

  if (!response.choices || !response.choices.length) {
    throw new Error('Segmentation failed: ' + JSON.stringify(response));
  }

  const text = response.choices[0].message.content;
  const parsed = parseJsonArray(text);
  if (parsed) {
    return pages.length === 1
      ? parsed.map((item) => ({ ...item, pageIndex: pages[0].index }))
      : parsed;
  }

  return [{
    content: text,
    type: '其他',
    subject: '',
    confidence: 0.5,
    pageIndex: pages[0].index,
    bounds: null
  }];
}

async function mergeCrossPage(perPageItems, pageCount) {
  const pages = perPageItems.map((segments, pageIndex) => ({
    pageIndex,
    questions: (segments || []).map((item, index) => ({
      index,
      type: item.type || '',
      content: String(item.content || item.text || '').slice(0, 500)
    }))
  }));

  const fallback = flattenPages(perPageItems);

  try {
    const prompt = `下面是按页切好的题目摘要（JSON）。这些页是同一份试卷的连续页。
请把「上一页最后一题 + 下一页第一题」其实是同一道跨页题的合并成一条；其余保持独立。
返回 JSON 数组，不要 markdown：
[{ "content": "完整题文，若合并请自行拼接", "type": "原题型", "subject": "", "confidence": 0.9, "parts": [{ "pageIndex": 0, "index": 2 }, { "pageIndex": 1, "index": 0 }] }]
parts 必须引用上面已有的 pageIndex 和 index。不要发明不存在的题。`;

    const response = await callDashScopeVL([
      { role: 'user', content: [{ type: 'text', text: prompt + '\n' + JSON.stringify(pages) }] }
    ], 0.1);

    const text = (response.choices && response.choices[0] && response.choices[0].message.content) || '';
    const parsed = parseJsonArray(text);
    if (!parsed || !parsed.length) return fallback;

    const rebuilt = [];
    parsed.forEach((row) => {
      const parts = Array.isArray(row.parts) ? row.parts : [];
      const sources = parts
        .map((part) => {
          const p = Number(part.pageIndex);
          const i = Number(part.index);
          return perPageItems[p] && perPageItems[p][i] ? { pageIndex: p, item: perPageItems[p][i] } : null;
        })
        .filter(Boolean);

      if (!sources.length) return;

      const contents = sources.map((s) => s.item.content || s.item.text || '');
      const content = (row.content && String(row.content).trim()) || contents.join('\n');
      rebuilt.push({
        content,
        type: row.type || sources[0].item.type || '其他',
        subject: row.subject || sources[0].item.subject || '',
        confidence: typeof row.confidence === 'number' ? row.confidence : sources[0].item.confidence,
        pageSpans: sources.map((s) => ({
          pageIndex: s.pageIndex,
          bounds: s.item.bounds
        }))
      });
    });

    return rebuilt.length ? rebuilt : fallback;
  } catch (err) {
    console.warn('cross-page merge failed, using per-page segments', err);
    return fallback;
  }
}

function flattenPages(perPageItems) {
  const out = [];
  perPageItems.forEach((segments, pageIndex) => {
    (segments || []).forEach((item) => {
      out.push({
        ...item,
        pageIndex,
        pageSpans: [{ pageIndex, bounds: item.bounds }]
      });
    });
  });
  return out;
}

function toPercent(value, fallback = 0) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback;
  }
  const clamped = Math.min(1, Math.max(0, value <= 1 ? value : value / 100));
  return clamped * 100;
}

function normalizeBounds(bounds, index, total) {
  if (bounds && typeof bounds === 'object') {
    if (bounds.top !== undefined || bounds.left !== undefined) {
      return {
        top: toPercent(bounds.top, index * (100 / Math.max(total, 1))),
        left: toPercent(bounds.left, 2),
        width: toPercent(bounds.width, 45),
        height: toPercent(bounds.height, Math.max(12, 100 / Math.max(total, 1)))
      };
    }

    if (bounds.x !== undefined) {
      const scale = (v) => Math.min(100, Math.max(0, (Number(v) / 1000) * 100));
      return {
        left: scale(bounds.x),
        top: scale(bounds.y || 0),
        width: scale(bounds.width || 200),
        height: scale(bounds.height || 120)
      };
    }
  }

  const row = Math.floor(index / 2);
  const col = index % 2;
  return {
    top: row * 18,
    left: 2 + col * 48,
    width: 45,
    height: Math.max(12, Math.min(25, 100 / Math.max(total, 1)))
  };
}

function clampPageIndex(value, pageCount) {
  const n = Number(value);
  if (Number.isNaN(n)) return 0;
  return Math.min(Math.max(0, Math.round(n)), Math.max(pageCount - 1, 0));
}

function fixOneBasedPages(spans, pageCount) {
  if (!spans.length || pageCount < 2) return spans;
  const idxs = spans.map((s) => s.pageIndex);
  const max = Math.max.apply(null, idxs);
  const min = Math.min.apply(null, idxs);
  if (min >= 1 && max === pageCount) {
    return spans.map((s) => ({ ...s, pageIndex: s.pageIndex - 1 }));
  }
  return spans;
}

function normalizePageSpans(segment, pageCount) {
  let spans = Array.isArray(segment.pageSpans) ? segment.pageSpans.slice() : [];
  if (!spans.length) {
    spans = [{
      pageIndex: segment.pageIndex || 0,
      bounds: segment.bounds
    }];
  }

  spans = spans.map((span, index) => ({
    pageIndex: clampPageIndex(span.pageIndex, pageCount),
    bounds: normalizeBounds(span.bounds, index, spans.length)
  }));

  return fixOneBasedPages(spans, pageCount);
}

function normalizeSegment(segment, index, total, pageCount) {
  const content = segment.content || segment.text || '';
  const type = segment.type || '其他';
  const pageSpans = normalizePageSpans(segment, pageCount || 1);
  const pageIndexes = [];
  pageSpans.forEach((span) => {
    if (pageIndexes.indexOf(span.pageIndex) === -1) pageIndexes.push(span.pageIndex);
  });
  const isCrossPage = pageIndexes.length > 1;

  return {
    ...segment,
    content,
    text: content,
    type,
    subject: segment.subject || '',
    confidence: typeof segment.confidence === 'number' ? segment.confidence : 0.5,
    isDifficult: type.includes('解答'),
    pageSpans,
    pageIndexes,
    isCrossPage,
    bounds: pageSpans[0] ? pageSpans[0].bounds : normalizeBounds(segment.bounds, index, total)
  };
}
