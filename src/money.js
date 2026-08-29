// =============================================================
// money.js —— 全站金额以「枚」为单位，内部用 6 位定点 BigInt 记账
// 1 枚 = 1_000_000 最小单位；全程整数运算，禁止浮点，杜绝尾差
// =============================================================

export const SCALE = 1_000_000n; // 1 枚支持到小数点后 6 位

/** 整数枚 -> 内部最小单位（下注/提现等整数场景） */
export function coin(n) {
  return BigInt(n) * SCALE;
}

/**
 * 「枚」的数值/字符串 -> 内部 BigInt。
 * 最多接受 6 位小数，超出部分截断（与链上 18 位充值截准口径一致）。
 * 例：toInner('0.019801') === 19801n
 */
export function toInner(input) {
  if (typeof input === 'bigint') return input * SCALE; // 已是整数枚
  const s = String(input).trim();
  const m = s.match(/^(-?)(\d+)(?:\.(\d{1,9}))?$/);
  if (!m) throw new Error(`金额格式非法：${input}（单位：枚，最多 6 位小数）`);
  const sign = m[1] === '-' ? -1n : 1n;
  const whole = BigInt(m[2]) * SCALE;
  let frac = 0n;
  if (m[3]) {
    const f = (m[3] + '000000').slice(0, 6); // 截到 6 位
    frac = BigInt(f);
  }
  return sign * (whole + frac);
}

/** 内部 BigInt -> 「枚」展示字符串（去掉多余尾零） */
export function toCoin(inner) {
  const neg = inner < 0n;
  const v = neg ? -inner : inner;
  const whole = v / SCALE;
  const frac = v % SCALE;
  let s = whole.toString();
  if (frac > 0n) {
    const f = frac.toString().padStart(6, '0').replace(/0+$/, '');
    s += '.' + f;
  }
  return (neg ? '-' : '') + s + ' 枚';
}

/** floor(a*b/c)，非负 BigInt 比例运算（按比例分奖用，无浮点、无溢出） */
export function mulDivFloor(a, b, c) {
  if (c === 0n) throw new Error('比例运算除零');
  return (a * b) / c;
}

export function bnSum(list) {
  return list.reduce((acc, x) => acc + x, 0n);
}
