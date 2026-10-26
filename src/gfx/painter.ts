import { PAL, C, type Ramp } from '../core/palette';

/** Kierunek światła (z lewej-góry, lekko z przodu) — wspólny dla całej grafiki, żeby cieniowanie było spójne. */
const LIGHT = (() => {
  const v = [-0.55, -0.65, 0.52];
  const l = Math.hypot(v[0], v[1], v[2]);
  return v.map((x) => x / l);
})();

/**
 * "Malarz" sprite'ów 16-bit: rysuje indeksami palety na małej siatce, z cieniowaniem rampami
 * (światło z lewej-góry) i automatycznym obrysem. Grafika powstaje w kodzie, ale cały kod
 * gry odwołuje się tylko do nazw sprite'ów, więc podmiana na sprite sheet nie rusza logiki.
 */
export class Painter {
  private readonly d: Int16Array;

  constructor(readonly w: number, readonly h: number) {
    this.d = new Int16Array(w * h).fill(-1);
  }

  px(x: number, y: number, c: number): this {
    x = Math.floor(x); y = Math.floor(y);
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = c;
    return this;
  }

  get(x: number, y: number): number {
    return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.d[y * this.w + x] : -1;
  }

  rect(x: number, y: number, w: number, h: number, c: number): this {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.px(xx, yy, c);
    return this;
  }

  /** Elipsa cieniowana jak kula (światło z lewej-góry). `ramp` od cienia do światła. */
  sphere(cx: number, cy: number, rx: number, ry: number, ramp: Ramp): this {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
        const r2 = nx * nx + ny * ny;
        if (r2 > 1) continue;
        const nz = Math.sqrt(1 - r2);
        const v = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2];
        const t = Math.min(0.999, Math.max(0, (v + 0.3) / 1.15));
        this.px(x, y, ramp[Math.floor(t * ramp.length)]);
      }
    }
    return this;
  }

  /** Blok z fazą: jasna krawędź górna/lewa, ciemna dolna/prawa (metal, kamień, drewno). */
  block(x: number, y: number, w: number, h: number, ramp: Ramp): this {
    this.rect(x, y, w, h, ramp[Math.min(ramp.length - 2, 1)]);
    this.rect(x, y, w, 1, ramp[ramp.length - 1]);
    this.rect(x, y, 1, h, ramp[ramp.length - 2]);
    this.rect(x, y + h - 1, w, 1, ramp[0]);
    this.rect(x + w - 1, y + 1, 1, h - 1, ramp[0]);
    return this;
  }

  line(x0: number, y0: number, x1: number, y1: number, c: number): this {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) this.px(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), c);
    return this;
  }

  /** Wypełniony wielokąt (test punktu w środku piksela). */
  poly(pts: [number, number][], c: number): this {
    const ys = pts.map((p) => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
      for (let x = 0; x < this.w; x++) {
        let inside = false;
        const px = x + 0.5, py = y + 0.5;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, yi] = pts[i], [xj, yj] = pts[j];
          if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
        }
        if (inside) this.px(x, y, c);
      }
    }
    return this;
  }

  /** Wypełniony dysk jednym kolorem. */
  disc(cx: number, cy: number, r: number, c: number): this {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) this.px(x, y, c);
    }
    return this;
  }

  /** Pierścień o grubości `w`. */
  ring(cx: number, cy: number, r: number, w: number, c: number): this {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d <= r && d > r - w) this.px(x, y, c);
      }
    }
    return this;
  }

  /**
   * Wielokąt cieniowany kierunkowo: jaśniej w lewym-górnym rogu, ciemniej w prawym-dolnym,
   * z ciemniejszą krawędzią — szybki sposób na "wypukłe" ikony (tarcza, liść, kropla).
   */
  polyShade(pts: [number, number][], ramp: Ramp): this {
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const mask = new Painter(this.w, this.h).poly(pts, 0);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (mask.get(x, y) < 0) continue;
        const edge = mask.get(x + 1, y) < 0 || mask.get(x, y + 1) < 0;
        const t = 1 - (((x - x0) / Math.max(1, x1 - x0)) * 0.45 + ((y - y0) / Math.max(1, y1 - y0)) * 0.55);
        const i = edge ? 0 : Math.min(ramp.length - 1, 1 + Math.floor(t * (ramp.length - 1)));
        this.px(x, y, ramp[i]);
      }
    }
    return this;
  }

  /** Dodaje obrys 1 px wokół nieprzezroczystych pikseli (wymaga 1 px wolnego marginesu). */
  outline(c: number = C.black): this {
    const add: number[] = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y) !== -1) continue;
        if (this.get(x - 1, y) >= 0 || this.get(x + 1, y) >= 0 || this.get(x, y - 1) >= 0 || this.get(x, y + 1) >= 0) add.push(y * this.w + x);
      }
    }
    for (const i of add) this.d[i] = c;
    return this;
  }

  canvas(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = this.w;
    c.height = this.h;
    const g = c.getContext('2d')!;
    for (let i = 0; i < this.d.length; i++) {
      if (this.d[i] < 0) continue;
      g.fillStyle = PAL[this.d[i]];
      g.fillRect(i % this.w, Math.floor(i / this.w), 1, 1);
    }
    return c;
  }
}
