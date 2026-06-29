// 轻量 LaTeX -> 可读数学符号转换（对齐小程序端）

const SUP = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶',
  '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻', '=': '⁼',
  '(': '⁽', ')': '⁾', 'n': 'ⁿ', 'i': 'ⁱ', 'a': 'ᵃ', 'b': 'ᵇ', 'c': 'ᶜ',
  'x': 'ˣ', 'y': 'ʸ', 'k': 'ᵏ', 'm': 'ᵐ', 't': 'ᵗ'
}

const SUB = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆',
  '7': '₇', '8': '₈', '9': '₉', '+': '₊', '-': '₋', '=': '₌',
  '(': '₍', ')': '₎', 'a': 'ₐ', 'e': 'ₑ', 'x': 'ₓ', 'i': 'ᵢ',
  'j': 'ⱼ', 'n': 'ₙ', 'm': 'ₘ', 'k': 'ₖ', 't': 'ₜ'
}

const SYMBOLS = {
  '\\infty': '∞', '\\leq': '≤', '\\geq': '≥', '\\le': '≤', '\\ge': '≥',
  '\\neq': '≠', '\\ne': '≠', '\\times': '×', '\\div': '÷', '\\cdot': '·',
  '\\pm': '±', '\\mp': '∓', '\\ast': '∗', '\\star': '⋆',
  '\\Rightarrow': '⇒', '\\Leftarrow': '⇐', '\\Leftrightarrow': '⇔',
  '\\rightarrow': '→', '\\leftarrow': '←', '\\to': '→', '\\mapsto': '↦',
  '\\perp': '⊥', '\\parallel': '∥', '\\angle': '∠',
  '\\in': '∈', '\\notin': '∉', '\\ni': '∋', '\\subset': '⊂',
  '\\subseteq': '⊆', '\\supset': '⊃', '\\supseteq': '⊇',
  '\\cup': '∪', '\\cap': '∩', '\\setminus': '∖',
  '\\forall': '∀', '\\exists': '∃', '\\nexists': '∄',
  '\\sum': '∑', '\\prod': '∏', '\\int': '∫', '\\oint': '∮',
  '\\partial': '∂', '\\nabla': '∇', '\\Delta': 'Δ',
  '\\approx': '≈', '\\equiv': '≡', '\\cong': '≅', '\\sim': '∼',
  '\\propto': '∝', '\\therefore': '∴', '\\because': '∵',
  '\\cdots': '⋯', '\\ldots': '…', '\\dots': '…', '\\vdots': '⋮',
  '\\circ': '∘', '\\varnothing': '∅', '\\emptyset': '∅', '\\degree': '°',
  '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\delta': 'δ',
  '\\epsilon': 'ε', '\\varepsilon': 'ε', '\\zeta': 'ζ', '\\eta': 'η',
  '\\theta': 'θ', '\\vartheta': 'ϑ', '\\iota': 'ι', '\\kappa': 'κ',
  '\\lambda': 'λ', '\\mu': 'μ', '\\nu': 'ν', '\\xi': 'ξ', '\\pi': 'π',
  '\\rho': 'ρ', '\\sigma': 'σ', '\\tau': 'τ', '\\upsilon': 'υ',
  '\\phi': 'φ', '\\varphi': 'φ', '\\chi': 'χ', '\\psi': 'ψ', '\\omega': 'ω',
  '\\Gamma': 'Γ', '\\Theta': 'Θ', '\\Lambda': 'Λ', '\\Xi': 'Ξ',
  '\\Pi': 'Π', '\\Sigma': 'Σ', '\\Phi': 'Φ', '\\Psi': 'Ψ', '\\Omega': 'Ω'
}

function mapStr(s, table) {
  let out = ''
  for (const ch of s) out += table[ch] || ch
  return out
}

const MATRIX_ENVS = 'vmatrix|Vmatrix|matrix|pmatrix|bmatrix|Bmatrix|Matrix|smallmatrix'

/** 解析矩阵体：支持 \\ 换行或 OCR 单斜杠 \ 换行 */
function parseMatrixBody(body) {
  let raw = String(body || '').trim()
  raw = raw.replace(/\s\\\\\s*/g, '\n')
  raw = raw.replace(/\s\\\s+/g, '\n')
  return raw
    .split('\n')
    .map(r => r.trim())
    .filter(Boolean)
    .map(row => row.split('&').map(c => c.trim().replace(/\\,/g, ',')))
}

/** 将矩阵渲染为带竖线/括号的多行可读格式 */
function renderMatrix(rows, env) {
  if (!rows.length) return ''
  const raw = env || 'matrix'
  const e = raw.toLowerCase()
  let open = '', close = ''
  if (e === 'pmatrix') { open = '(', close = ')' }
  else if (e === 'bmatrix') { open = '[', close = ']' }
  else if (raw === 'Vmatrix') { open = '‖', close = '‖' }
  else if (e === 'vmatrix') { open = '|', close = '|' }
  else if (e === 'matrix' || e === 'smallmatrix') { open = '', close = '' }

  const colCount = Math.max(...rows.map(r => r.length))
  const widths = Array.from({ length: colCount }, (_, ci) =>
    Math.max(...rows.map(r => (r[ci] || '').length), 1)
  )

  const formatRow = (cells) => {
    const parts = widths.map((w, i) => (cells[i] || '').padStart(w))
    const inner = parts.join('  ')
    if (open || close) return `${open} ${inner} ${close}`.trim()
    return `[ ${inner} ]`
  }

  return rows.map(formatRow).join('\n')
}

/** 增广矩阵 [ A | b ] 样式，最后一列前加竖线 */
function renderAugmentedMatrix(rows) {
  if (!rows.length) return ''
  const colCount = Math.max(...rows.map(r => r.length))
  const widths = Array.from({ length: colCount }, (_, ci) =>
    Math.max(...rows.map(r => (r[ci] || '').length), 1)
  )
  return rows.map((cells) => {
    if (cells.length >= 2) {
      const left = cells.slice(0, -1)
      const right = cells[cells.length - 1]
      const leftStr = left.map((c, i) => c.padStart(widths[i])).join('  ')
      const rightStr = right.padStart(widths[colCount - 1])
      return `[ ${leftStr} | ${rightStr} ]`
    }
    const inner = cells.map((c, i) => c.padStart(widths[i])).join('  ')
    return `[ ${inner} ]`
  }).join('\n')
}

/** 单元格内符号转换（\alpha、\to 等） */
function convertSymbolsInCell(cell) {
  let c = String(cell || '').trim()
  for (const k in SYMBOLS) c = c.split(k).join(SYMBOLS[k])
  c = c.replace(/\\([a-zA-Z]+)/g, '$1')
  return c.trim()
}

/** 解析括号行：( 2 \quad 0 \quad 2 \quad 3 ) */
function parseRowCells(inner) {
  let s = String(inner).replace(/\\quad/g, ' ').trim()
  if (s.includes('&')) {
    return s.split('&').map(c => convertSymbolsInCell(c)).filter(Boolean)
  }
  return s.split(/\s+/).filter(Boolean).map(c => convertSymbolsInCell(c))
}

/**
 * 增广矩阵常见写法：连续多个 ( ... \quad ... )
 * 例：$B \to ( 2 \quad 0 \quad 2 \quad 3 )
 *     ( 0 \alpha \alpha 1 )
 *     ( 0 0 0 \alpha )$
 */
function convertParenRowMatrices(text) {
  const rowRe = /\(\s*([^()]+)\s*\)/g
  const matches = []
  let m
  while ((m = rowRe.exec(text)) !== null) {
    const cells = parseRowCells(m[1])
    if (cells.length >= 2) {
      matches.push({ index: m.index, end: m.index + m[0].length, cells })
    }
  }
  if (matches.length < 2) return text

  const groups = []
  let group = [matches[0]]
  for (let i = 1; i < matches.length; i++) {
    const gap = text.slice(matches[i - 1].end, matches[i].index)
    // 行间仅允许空白、换行、$、逗号等
    if (/^[\s$,，]*$/.test(gap)) {
      group.push(matches[i])
    } else {
      if (group.length >= 2) groups.push(group)
      group = [matches[i]]
    }
  }
  if (group.length >= 2) groups.push(group)

  let result = text
  for (const g of groups.reverse()) {
    const start = g[0].index
    const end = g[g.length - 1].end
    result = result.slice(0, start) + renderAugmentedMatrix(g.map(x => x.cells)) + result.slice(end)
  }
  return result
}

/** 转换 \begin{vmatrix}...\end{vmatrix} 及 OCR 残缺写法 beginvmatrix...endvmatrix */
function convertMatrixEnvironments(text) {
  let t = text

  // 标准 LaTeX：\begin{vmatrix}...\end{vmatrix}
  t = t.replace(
    new RegExp(`\\\\begin\\{(${MATRIX_ENVS})\\}([\\s\\S]*?)\\\\end\\{\\1\\}`, 'gi'),
    (m, env, body) => renderMatrix(parseMatrixBody(body), env)
  )

  // OCR 残缺：beginvmatrix ... endvmatrix（无反斜杠/花括号）
  t = t.replace(
    new RegExp(`begin(${MATRIX_ENVS})\\s+([\\s\\S]*?)\\s+end\\1`, 'gi'),
    (m, env, body) => renderMatrix(parseMatrixBody(body), env)
  )

  return t
}

function convertMath(seg) {
  let t = convertMatrixEnvironments(seg)
  t = convertParenRowMatrices(t)
  t = t.replace(/\\quad/g, '  ')

  t = t.replace(/\\mathbb\s*\{R\}/g, 'ℝ').replace(/\\mathbb\s*R\b/g, 'ℝ')
  t = t.replace(/\\mathbb\s*\{N\}/g, 'ℕ').replace(/\\mathbb\s*N\b/g, 'ℕ')
  t = t.replace(/\\mathbb\s*\{Z\}/g, 'ℤ').replace(/\\mathbb\s*Z\b/g, 'ℤ')
  t = t.replace(/\\mathbb\s*\{Q\}/g, 'ℚ').replace(/\\mathbb\s*Q\b/g, 'ℚ')
  t = t.replace(/\\mathbb\s*\{C\}/g, 'ℂ').replace(/\\mathbb\s*C\b/g, 'ℂ')

  t = t.replace(/\\d?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '($1)/($2)')
  t = t.replace(/\\sqrt\s*\{([^{}]*)\}/g, '√($1)')
  t = t.replace(/\\text\s*\{([^{}]*)\}/g, '$1')

  for (const k in SYMBOLS) t = t.split(k).join(SYMBOLS[k])

  t = t.replace(/\\left/g, '').replace(/\\right/g, '')

  t = t.replace(/\^\{([^{}]*)\}/g, (m, g) => mapStr(g, SUP))
  t = t.replace(/\^(\\?\w)/g, (m, g) => mapStr(g.replace('\\', ''), SUP))
  t = t.replace(/_\{([^{}]*)\}/g, (m, g) => mapStr(g, SUB))
  t = t.replace(/_(\\?\w)/g, (m, g) => mapStr(g.replace('\\', ''), SUB))

  t = t.replace(/\\([a-zA-Z]+)/g, '$1')
  t = t.replace(/\\[,;:! ]/g, ' ')
  t = t.replace(/[{}]/g, '')

  return t
}

/** 未包裹 $ 的常见写法兜底，如 x^2、a_1、\alpha */
function convertPlainMath(text) {
  let t = text
  t = convertParenRowMatrices(t)
  for (const k in SYMBOLS) t = t.split(k).join(SYMBOLS[k])
  t = t.replace(/\\quad/g, '  ')
  t = t.replace(/\\([a-zA-Z]+)/g, '$1')
  t = t.replace(/([a-zA-Z0-9\)])\^\{([^{}]+)\}/g, (m, base, exp) => base + mapStr(exp, SUP))
  t = t.replace(/([a-zA-Z0-9\)])\^(\d+)/g, (m, base, exp) => base + mapStr(exp, SUP))
  t = t.replace(/([a-zA-Z])_\{([^{}]+)\}/g, (m, base, sub) => base + mapStr(sub, SUB))
  t = t.replace(/([a-zA-Z])_(\d+)/g, (m, base, sub) => base + mapStr(sub, SUB))
  return t
}

export function formatLatex(text) {
  if (!text) return ''
  let out = String(text)

  // 矩阵 / 增广矩阵（含 OCR 残缺写法，通常不在 $ 内）
  out = convertMatrixEnvironments(out)
  out = convertParenRowMatrices(out)

  out = out.replace(/\\\[([\s\S]*?)\\\]/g, (m, g) => convertMath(g))
  out = out.replace(/\\\(([\s\S]*?)\\\)/g, (m, g) => convertMath(g))
  out = out.replace(/\$\$([\s\S]*?)\$\$/g, (m, g) => convertMath(g))
  // 支持跨行 $...$（增广矩阵常跨多行）
  out = out.replace(/\$([\s\S]*?)\$/g, (m, g) => convertMath(g))

  out = out.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1')

  return convertPlainMath(out)
}

export default { formatLatex }
