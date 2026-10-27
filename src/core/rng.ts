/** Prosty generator losowy (mulberry32) — deterministyczny dla danego ziarna, przydatny przy debugowaniu. */
export class Rng {
  constructor(private s = (Math.random() * 2 ** 32) >>> 0) {}

  /** Nowe ziarno (wyzwanie dnia: ten sam start dla wszystkich). */
  seed(s: number): void {
    this.s = s >>> 0;
  }

  next(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(a: number, b: number): number {
    return a + (b - a) * this.next();
  }

  int(a: number, b: number): number {
    return Math.floor(this.range(a, b + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** Losowanie z wagami: [element, waga][] */
  weighted<T>(arr: readonly (readonly [T, number])[]): T {
    let sum = 0;
    for (const [, w] of arr) sum += w;
    let r = this.next() * sum;
    for (const [v, w] of arr) {
      r -= w;
      if (r <= 0) return v;
    }
    return arr[arr.length - 1][0];
  }
}

export const rng = new Rng();
