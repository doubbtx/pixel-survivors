/**
 * Spatial hash grid: przebudowywany co klatkę, zapytania o sąsiedztwo zamiast O(n²).
 *
 * Implementacja bez alokacji: "listy połączone w tablicach".
 *  - head[komórka] = indeks pierwszego obiektu w komórce (-1 = pusta)
 *  - next[indeks]  = kolejny obiekt w tej samej komórce
 * Współrzędne komórek są zawijane maską (2^bits × 2^bits), więc świat może być nieskończony;
 * fałszywe trafienia z "zawinięcia" odsiewa dokładny test odległości po stronie wywołującego.
 * clear() czyści tylko komórki dotknięte w tej klatce.
 */
export class SpatialHash<T extends { x: number; y: number }> {
  private readonly mask: number;
  private readonly head: Int32Array;
  private next: Int32Array;
  private readonly touched: Int32Array;
  private nTouched = 0;
  private readonly objs: T[] = [];
  private n = 0;

  constructor(readonly cell = 16, private readonly bits = 8, cap = 4096) {
    this.mask = (1 << bits) - 1;
    this.head = new Int32Array(1 << (bits * 2)).fill(-1);
    this.touched = new Int32Array(1 << (bits * 2));
    this.next = new Int32Array(cap);
  }

  clear(): void {
    for (let i = 0; i < this.nTouched; i++) this.head[this.touched[i]] = -1;
    this.nTouched = 0;
    this.n = 0;
  }

  private key(cx: number, cy: number): number {
    return ((cy & this.mask) << this.bits) | (cx & this.mask);
  }

  insert(o: T): void {
    if (this.n >= this.next.length) {
      const nn = new Int32Array(this.next.length * 2);
      nn.set(this.next);
      this.next = nn;
    }
    const idx = this.n++;
    this.objs[idx] = o;
    const k = this.key(Math.floor(o.x / this.cell), Math.floor(o.y / this.cell));
    if (this.head[k] === -1) this.touched[this.nTouched++] = k;
    this.next[idx] = this.head[k];
    this.head[k] = idx;
  }

  /** Wypełnia `out` kandydatami z komórek pokrywających kwadrat (x±r, y±r). Zwraca `out`. */
  query(x: number, y: number, r: number, out: T[]): T[] {
    out.length = 0;
    const c = this.cell;
    const span = Math.min(this.mask, Math.ceil((2 * r) / c) + 1);
    const x0 = Math.floor((x - r) / c), y0 = Math.floor((y - r) / c);
    for (let cy = y0; cy <= y0 + span && cy <= Math.floor((y + r) / c); cy++) {
      for (let cx = x0; cx <= x0 + span && cx <= Math.floor((x + r) / c); cx++) {
        for (let i = this.head[this.key(cx, cy)]; i !== -1; i = this.next[i]) out.push(this.objs[i]);
      }
    }
    return out;
  }
}
