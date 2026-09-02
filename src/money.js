// =============================================================
// money.js - all amounts in 'units', internal 6-decimal fixed-point BigInt
// 1 unit = 1_000_000 min units; integer arithmetic only, no floats, no rounding drift
// =============================================================

export const SCALE = 1_000_000n; // 1 unit supports 6 decimal places

/** Integer units -> internal min units (bet/withdraw etc.) */
export function coin(n) {
  return BigInt(n) * SCALE;
}

/**
 * Numeric/string 'units' -> internal BigInt.
 * Accepts up to 6 decimals, excess truncated (consistent with on-chain 18-decimal deposit truncation).
 * Example: toInner('0.019801') === 19801n
 */
export function toInner(input) {
  if (typeof input === 'bigint') return input * SCALE; // already integer units
  const s = String(input).trim();
  const m = s.match(/^(-?)(\d+)(?:\.(\d{1,9}))?$/);
  if (!m) throw new Error(`Invalid amount format：${input}(unit: units, max 6 decimals)`);
  const sign = m[1] === '-' ? -1n : 1n;
  const whole = BigInt(m[2]) * SCALE;
  let frac = 0n;
  if (m[3]) {
    const f = (m[3] + '000000').slice(0, 6); // truncate to 6 decimals
    frac = BigInt(f);
  }
  return sign * (whole + frac);
}

/** Internal BigInt -> display string in 'units' (strip trailing zeros) */
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
  return (neg ? '-' : '') + s + ' units';
}

/** Mixed payment: when in-site available (internal) insufficient for bet total (internal), the on-chain top-up delta (internal, >=0) */
export function needTopUp(availableInner, totalInner) {
  const a = BigInt(availableInner), t = BigInt(totalInner);
  return t > a ? t - a : 0n;
}

/** floor(a*b/c), non-negative BigInt ratio math (for proportional payout, no floats, no overflow) */
export function mulDivFloor(a, b, c) {
  if (c === 0n) throw new Error('Ratio math division by zero');
  return (a * b) / c;
}

export function bnSum(list) {
  return list.reduce((acc, x) => acc + x, 0n);
}
