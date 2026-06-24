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
  '\\pm': '±', '\\mp': '∓', '\\Rightarrow': '⇒', '\\Leftarrow': '⇐',
  '\\rightarrow': '→', '\\leftarrow': '←', '\\to': '→',
  '\\in': '∈', '\\notin': '∉', '\\sum': '∑', '\\prod': '∏', '\\int': '∫',
  '\\partial': '∂', '\\Delta': 'Δ', '\\approx': '≈', '\\equiv': '≡',
  '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\delta': 'δ',
  '\\theta': 'θ', '\\lambda': 'λ', '\\mu': 'μ', '\\pi': 'π', '\\sigma': 'σ',
  '\\omega': 'ω'
}

function mapStr(s, table) {
  let out = ''
  for (const ch of s) out += table[ch] || ch
  return out
}

function convertMath(seg) {
  let t = seg
  t = t.replace(/\\mathbb\s*\{R\}/g, 'ℝ').replace(/\\mathbb\s*R\b/g, 'ℝ')
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
  t = t.replace(/[{}]/g, '')
  return t
}

export function formatLatex(text) {
  if (!text) return ''
  let out = String(text)
  out = out.replace(/\\\[([\s\S]*?)\\\]/g, (m, g) => convertMath(g))
  out = out.replace(/\\\(([\s\S]*?)\\\)/g, (m, g) => convertMath(g))
  out = out.replace(/\$\$([\s\S]*?)\$\$/g, (m, g) => convertMath(g))
  out = out.replace(/\$([^$\n]+)\$/g, (m, g) => convertMath(g))
  out = out.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1')
  return out
}

export default { formatLatex }
