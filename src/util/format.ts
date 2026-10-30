const SUFFIXES = ['', 'K', 'M', 'B', 'T'];

/**
 * Formatowanie dużych liczb: 999, 1.2K, 3.4M, 5.6B, 7.8T, potem notacja naukowa 1.2E15.
 * Double wystarcza do ~1e308; gdyby skalowanie miało wyjść poza ten zakres,
 * w etapie 5 wartości przejdą na break_infinity.js — formatowanie zostanie tu w jednym miejscu.
 */
export function fmt(n: number): string {
  if (!isFinite(n)) return 'INF';
  const a = Math.abs(n);
  if (a < 1000) return a < 10 && a % 1 !== 0 ? n.toFixed(1) : String(Math.floor(n));
  const tier = Math.floor(Math.log10(a) / 3);
  if (tier < SUFFIXES.length) {
    const v = n / 1000 ** tier;
    return `${v.toFixed(v < 10 ? 1 : 0)}${SUFFIXES[tier]}`;
  }
  const e = Math.floor(Math.log10(a));
  return `${(n / 10 ** e).toFixed(1)}E${e}`;
}

export function fmtTime(sec: number): string {
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** HP do wyświetlenia: obie liczby w górę, bieżące nie większe niż maksimum (wcześniej „107 / 106” przez różne zaokrąglenia). */
export function hpText(hp: number, max: number, sep = '/'): string {
  const m = Math.ceil(max);
  return `${fmt(Math.min(Math.ceil(hp), m))}${sep}${fmt(m)}`;
}
