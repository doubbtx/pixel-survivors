/** Obiekt zarządzany przez pulę: `_i` to jego indeks w gęstej tablicy aktywnych (-1 = wolny). */
export interface Poolable {
  _i: number;
}

/**
 * Pula obiektów z gęstą tablicą aktywnych elementów.
 * - obtain(): bierze obiekt z listy wolnych (lub tworzy nowy) — brak alokacji w trakcie gry.
 * - release(): usuwa w O(1) przez zamianę z ostatnim elementem.
 * Bezpieczna iteracja z usuwaniem: pętla od końca i zwalnianie tylko bieżącego elementu.
 * Pola obiektu resetuje wywołujący zaraz po obtain().
 */
export class Pool<T extends Poolable> {
  readonly items: T[] = [];
  private readonly free: T[] = [];

  constructor(private readonly create: () => T, public cap = Infinity) {}

  get count(): number {
    return this.items.length;
  }

  /** Zwraca null, gdy osiągnięto limit — wywołujący decyduje, co wtedy (np. pominąć cząsteczkę). */
  obtain(): T | null {
    if (this.items.length >= this.cap) return null;
    const o = this.free.pop() ?? this.create();
    o._i = this.items.length;
    this.items.push(o);
    return o;
  }

  release(o: T): void {
    const i = o._i;
    if (i < 0) return;
    const last = this.items.pop()!;
    if (last !== o) {
      this.items[i] = last;
      last._i = i;
    }
    o._i = -1;
    this.free.push(o);
  }

  clear(): void {
    for (const o of this.items) {
      o._i = -1;
      this.free.push(o);
    }
    this.items.length = 0;
  }
}
