const STAGES = ['小学', '初中', '高中', '大学'];

const UNI_RE = /\bODE\b|\bPDE\b|ordinary\s+differential|partial\s+differential|differential\s+equation|常微分|偏微分|微分方程|拉普拉斯|Laplace|傅里叶|Fourier|高等数学|线性代数|初值问题|边值问题|积分因子|分离变量|通解|特解|Wronskian|Bernoulli\s*(方程|equation)|复变函数|实变函数|数理方程|概率论与数理统计|数值分析|离散数学|抽象代数|泛函分析|拓扑学|特征值|特征向量|拉格朗日乘数|格林公式|斯托克斯|二重积分|三重积分|曲面积分|线积分|向量空间|正交对角化|正定矩阵|二次型|幂级数解|级数解|欧拉方程|变分法|勒贝格|实分析|复分析|z变换|Z\s*变换|y''|y′′|d\^2y|d²y|dy\/dx|\\frac\{d|\\frac\{dy\}/i;

function normalizePeriod(value) {
  const period = String(value || '').trim();
  return STAGES.indexOf(period) === -1 ? '' : period;
}

function inferPeriod(text) {
  const s = String(text || '');
  if (!s.trim()) return '';
  if (UNI_RE.test(s)) return '大学';
  return '';
}

module.exports = { STAGES, normalizePeriod, inferPeriod };
