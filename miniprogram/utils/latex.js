// 轻量 LaTeX -> 可读数学符号转换（小程序无原生公式渲染，做近似美化）

const SUP = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶',
  '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻', '=': '⁼',
  '(': '⁽', ')': '⁾', 'n': 'ⁿ', 'i': 'ⁱ', 'a': 'ᵃ', 'b': 'ᵇ', 'c': 'ᶜ',
  'x': 'ˣ', 'y': 'ʸ', 'k': 'ᵏ', 'm': 'ᵐ', 't': 'ᵗ'
};

const SUB = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆',
  '7': '₇', '8': '₈', '9': '₉', '+': '₊', '-': '₋', '=': '₌',
  '(': '₍', ')': '₎', 'a': 'ₐ', 'e': 'ₑ', 'x': 'ₓ', 'i': 'ᵢ',
  'j': 'ⱼ', 'n': 'ₙ', 'm': 'ₘ', 'k': 'ₖ', 't': 'ₜ'
};

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
  '\\partial': '∂', '\\nabla': '∇', '\\Delta': 'Δ', '\\nabla': '∇',
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
};

function mapStr(s, table) {
  let out = '';
  for (const ch of s) out += table[ch] || ch;
  return out;
}

function convertMath(seg) {
  let t = seg;

  t = t.replace(/\\mathbb\s*\{R\}/g, 'ℝ')
    .replace(/\\mathbb\s*\{N\}/g, 'ℕ')
    .replace(/\\mathbb\s*\{Z\}/g, 'ℤ')
    .replace(/\\mathbb\s*\{Q\}/g, 'ℚ')
    .replace(/\\mathbb\s*\{C\}/g, 'ℂ');

  // \frac{a}{b} -> (a)/(b)
  t = t.replace(/\\d?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '($1)/($2)');
  // \sqrt{x} -> √(x)
  t = t.replace(/\\sqrt\s*\{([^{}]*)\}/g, '√($1)');
  // \text{...} -> 原文
  t = t.replace(/\\text\s*\{([^{}]*)\}/g, '$1');

  for (const k in SYMBOLS) {
    t = t.split(k).join(SYMBOLS[k]);
  }

  t = t.replace(/\\left/g, '').replace(/\\right/g, '');

  // 上标
  t = t.replace(/\^\{([^{}]*)\}/g, (m, g) => mapStr(g, SUP));
  t = t.replace(/\^(\\?\w)/g, (m, g) => mapStr(g.replace('\\', ''), SUP));
  // 下标
  t = t.replace(/_\{([^{}]*)\}/g, (m, g) => mapStr(g, SUB));
  t = t.replace(/_(\\?\w)/g, (m, g) => mapStr(g.replace('\\', ''), SUB));

  // 残余命令去掉反斜杠
  t = t.replace(/\\([a-zA-Z]+)/g, '$1');
  t = t.replace(/\\[,;:! ]/g, ' ');
  // 去掉残余花括号
  t = t.replace(/[{}]/g, '');

  return t;
}

function formatLatex(text) {
  if (!text) return '';
  let out = String(text);
  // \[ ... \] 和 \( ... \)
  out = out.replace(/\\\[([\s\S]*?)\\\]/g, (m, g) => convertMath(g));
  out = out.replace(/\\\(([\s\S]*?)\\\)/g, (m, g) => convertMath(g));
  // $$ ... $$ 和 $ ... $
  out = out.replace(/\$\$([\s\S]*?)\$\$/g, (m, g) => convertMath(g));
  out = out.replace(/\$([^$\n]+)\$/g, (m, g) => convertMath(g));
  // 去掉 markdown 粗体/标题标记
  out = out.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1');
  return out;
}

module.exports = { formatLatex };
