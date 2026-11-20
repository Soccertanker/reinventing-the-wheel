const SUFFIX = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

/** Whole-number display: 999, 1.23K, 4.56M, ... */
export function fmt(n: number): string {
  if (!Number.isFinite(n)) return '∞';
  if (n < 1000) return Math.floor(n).toLocaleString('en-US');
  let e = Math.floor(Math.log10(n) / 3);
  if ((n / 1000 ** e).toFixed(2) === '1000.00') e++; // 999,999.9 -> 1.00M, not 1000.00K
  if (e < SUFFIX.length) return `${(n / 1000 ** e).toFixed(2)}${SUFFIX[e]}`;
  return n.toExponential(2);
}

/** Rates and small values keep a decimal. */
export function fmtRate(n: number): string {
  return n < 100 ? n.toFixed(n < 10 ? 2 : 1) : fmt(n);
}

const YEAR = 365.25 * 86400;

/** Honest durations, all the way to absurd. */
export function fmtDuration(sec: number): string {
  if (!Number.isFinite(sec)) return 'never';
  if (sec < 60) return `${Math.ceil(sec)}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${Math.floor(sec % 60)}s`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
  if (sec < YEAR) return `${(sec / 86400).toFixed(1)} days`;
  const years = sec / YEAR;
  if (years < 1e9) return `${fmt(years)} years`;
  if (years < 1e11) return `${fmt(years)} years (longer than the universe has existed)`;
  return 'after the heat death of the universe';
}

/** 1e6 -> "1M", 3.2e9 -> "3.2B" parameters. */
export function fmtParams(logSize: number): string {
  const n = 10 ** logSize;
  const units: [number, string][] = [
    [1e15, 'Q'],
    [1e12, 'T'],
    [1e9, 'B'],
    [1e6, 'M'],
  ];
  for (const [v, u] of units) if (n >= v) return `${+(n / v).toPrecision(2)}${u}`;
  return String(Math.round(n));
}

export const pct = (f: number, digits = 0) => `${(f * 100).toFixed(digits)}%`;
