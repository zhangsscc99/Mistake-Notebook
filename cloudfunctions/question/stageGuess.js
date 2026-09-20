const STAGES = ['小学', '初中', '高中', '大学'];

const UNI_RE = /\bODE\b|\bPDE\b|ordinary\s+differential|partial\s+differential|differential\s+equation|常微分|偏微分|微分方程|拉普拉斯|Laplace|傅里叶|Fourier|高等数学|线性代数|初值问题|边值问题|积分因子|分离变量|通解|特解|Wronskian|Bernoulli\s*(方程|equation)|复变函数|实变函数|数理方程|概率论与数理统计|数值分析|离散数学|抽象代数|泛函分析|拓扑学|特征值|特征向量|拉格朗日乘数|格林公式|斯托克斯|二重积分|三重积分|曲面积分|线积分|向量空间|正交对角化|正定矩阵|二次型|幂级数解|级数解|欧拉方程|变分法|勒贝格|实分析|复分析|z变换|Z\s*变换|y''|y′′|d\^2y|d²y|dy\/dx|\\frac\{d|\\frac\{dy\}/i;

const HIGH_RE = /高考|圆锥曲线|等差数列|等比数列|立体几何|解析几何|正弦定理|余弦定理|二项式定理|椭圆|双曲线|抛物线/;
const MID_RE = /中考|一次函数|二次函数|全等三角形|相似三角形|勾股|一元一次|分式方程/;
const PRI_RE = /鸡兔同笼|植树问题|分数加减|小数乘/;

function normalizePeriod(value) {
  const period = String(value || '').trim();
  return STAGES.indexOf(period) === -1 ? '' : period;
}

function inferPeriod(text) {
  const s = String(text || '');
  if (!s.trim()) return '';
  if (UNI_RE.test(s)) return '大学';
  if (HIGH_RE.test(s)) return '高中';
  if (MID_RE.test(s)) return '初中';
  if (PRI_RE.test(s)) return '小学';
  return '';
}

function attachPeriodTag(tags, period) {
  const list = Array.isArray(tags) ? tags.slice() : [];
  const p = normalizePeriod(period);
  if (p && list.indexOf(p) === -1) list.push(p);
  return list;
}

module.exports = {
  STAGES,
  normalizePeriod,
  inferPeriod,
  attachPeriodTag
};
