import { PAL, C, type Ramp } from '../core/palette';

/** Kierunek światła (z lewej-góry, lekko z przodu) — wspólny dla całej grafiki, żeby cieniowanie było spójne. */
const LIGHT = (() => {
  const v = [-0.55, -0.65, 0.52];
  const l = Math.hypot(v[0], v[1], v[2]);
  return v.map((x) => x / l);
})();

/** Jasność kolorów palety (0..1) i kolory pomijane przy przemalowaniu (czerń, biel, skóra). */
const LUMA = PAL.map((hex) => {
  const v = parseInt(hex.slice(1), 16);
  return Math.min(0.999, (0.3 * (v >> 16) + 0.59 * ((v >> 8) & 255) + 0.11 * (v & 255)) / 255 * 1.25);
});
const KEEP = new Set<number>([C.black, C.white, C.skin, C.tan, C.peach]);

/** Ciemniejszy i jaśniejszy odcień tego samego koloru w palecie (światło krawędzi i kolorowy obrys w stylu 32-bit). */
const SHADE: Record<number, [number, number]> = {
  [C.rust]: [C.dbrown, C.clay], [C.clay]: [C.rust, C.tan], [C.cream]: [C.tan, C.white], [C.tan]: [C.brown, C.cream],
  [C.brown]: [C.dbrown, C.tan], [C.dbrown]: [C.ddbrown, C.brown], [C.ddbrown]: [C.black, C.dbrown], [C.dred]: [C.ddbrown, C.red],
  [C.red]: [C.dred, C.salmon], [C.orange]: [C.rust, C.gold], [C.gold]: [C.orange, C.yellow], [C.yellow]: [C.gold, C.white],
  [C.lime]: [C.green, C.lime], [C.green]: [C.dgreen, C.lime], [C.dgreen]: [C.teal, C.green], [C.teal]: [C.black, C.dgreen],
  [C.dblue]: [C.navy, C.blue], [C.blue]: [C.dblue, C.cyan], [C.cyan]: [C.blue, C.white], [C.white]: [C.lgray, C.white],
  [C.lgray]: [C.lavender, C.white], [C.lavender]: [C.dgray, C.lgray], [C.dgray]: [C.slate, C.lavender], [C.slate]: [C.navy, C.dgray],
  [C.navy]: [C.black, C.slate], [C.black]: [C.black, C.navy], [C.hotpink]: [C.dred, C.salmon], [C.plum]: [C.navy, C.pink],
  [C.pink]: [C.plum, C.salmon], [C.salmon]: [C.red, C.peach], [C.peach]: [C.skin, C.cream], [C.skin]: [C.brown, C.peach],
};
const darker = (c: number) => SHADE[c]?.[0] ?? c;
const lighter = (c: number) => SHADE[c]?.[1] ?? c;

/** Macierz Bayera 4×4 (progi 0..1): dithering przejść między odcieniami rampy przy res > 1. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

/**
 * "Malarz" sprite'ów: rysuje indeksami palety na małej siatce, z cieniowaniem rampami (światło z lewej-góry)
 * i automatycznym obrysem. Współrzędne podaje się w jednostkach projektu (w × h); `res` to liczba pikseli
 * obrazu na jednostkę: przy res 2 (styl 32-bit) kule, wielokąty, dyski, pierścienie i linie liczone są na drobnej
 * siatce (gładsze kształty, płynniejsze cieniowanie), a obrys i faza mają 1 drobny piksel. `px`/`rect` malują
 * całą jednostkę, `dot` jeden drobny piksel (detale). Kod gry odwołuje się tylko do nazw sprite'ów.
 */
export class Painter {
  private readonly d: Int16Array;
  /** Wymiary siatki obrazu (piksele): w·res × h·res. */
  private readonly fw: number;
  private readonly fh: number;

  constructor(readonly w: number, readonly h: number, readonly res = 1) {
    this.fw = w * res;
    this.fh = h * res;
    this.d = new Int16Array(this.fw * this.fh).fill(-1);
  }

  /** Piksel obrazu (drobny). */
  private set(fx: number, fy: number, c: number): void {
    if (fx >= 0 && fy >= 0 && fx < this.fw && fy < this.fh) this.d[fy * this.fw + fx] = c;
  }

  private at(fx: number, fy: number): number {
    return fx >= 0 && fy >= 0 && fx < this.fw && fy < this.fh ? this.d[fy * this.fw + fx] : -1;
  }

  /** Jednostka projektu (res × res pikseli obrazu). */
  px(x: number, y: number, c: number): this {
    const fx = Math.floor(x * this.res), fy = Math.floor(y * this.res);
    for (let j = 0; j < this.res; j++) for (let i = 0; i < this.res; i++) this.set(fx + i, fy + j, c);
    return this;
  }

  /**
   * Indeks w rampie dla ciągłej wartości `v` (0..n): przy res > 1 przejście między sąsiednimi odcieniami jest
   * ditherowane (wąski pas wokół granicy), co daje gładkie cieniowanie w stylu 32-bit.
   */
  private step(v: number, fx: number, fy: number, n: number): number {
    const i = Math.floor(v);
    if (this.res === 1) return i;
    const frac = v - i;
    if (frac > 0.65 && i + 1 < n && (frac - 0.65) / 0.35 > BAYER[(fy & 3) * 4 + (fx & 3)]) return i + 1;
    return i;
  }

  /** Pojedynczy piksel obrazu w punkcie projektu (detale w stylu 32-bit; przy res 1 to samo co px). */
  dot(x: number, y: number, c: number): this {
    this.set(Math.floor(x * this.res), Math.floor(y * this.res), c);
    return this;
  }

  get(x: number, y: number): number {
    return this.at(Math.floor(x * this.res), Math.floor(y * this.res));
  }

  rect(x: number, y: number, w: number, h: number, c: number): this {
    const r = this.res;
    for (let fy = Math.floor(y * r); fy < Math.floor((y + h) * r); fy++) for (let fx = Math.floor(x * r); fx < Math.floor((x + w) * r); fx++) this.set(fx, fy, c);
    return this;
  }

  /** Elipsa cieniowana jak kula (światło z lewej-góry). `ramp` od cienia do światła. */
  sphere(cx: number, cy: number, rx: number, ry: number, ramp: Ramp): this {
    const r = this.res;
    for (let fy = Math.floor((cy - ry) * r); fy <= Math.ceil((cy + ry) * r); fy++) {
      for (let fx = Math.floor((cx - rx) * r); fx <= Math.ceil((cx + rx) * r); fx++) {
        const nx = ((fx + 0.5) / r - cx) / rx, ny = ((fy + 0.5) / r - cy) / ry;
        const r2 = nx * nx + ny * ny;
        if (r2 > 1) continue;
        const nz = Math.sqrt(1 - r2);
        const v = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2];
        const t = Math.min(0.999, Math.max(0, (v + 0.3) / 1.15));
        this.set(fx, fy, ramp[this.step(t * ramp.length, fx, fy, ramp.length)]);
      }
    }
    return this;
  }

  /** Blok z fazą: jasna krawędź górna/lewa, ciemna dolna/prawa (metal, kamień, drewno); krawędzie 1 piksel obrazu. */
  block(x: number, y: number, w: number, h: number, ramp: Ramp): this {
    const e = 1 / this.res;
    this.rect(x, y, w, h, ramp[Math.min(ramp.length - 2, 1)]);
    this.rect(x, y, w, e, ramp[ramp.length - 1]);
    this.rect(x, y, e, h, ramp[ramp.length - 2]);
    this.rect(x, y + h - e, w, e, ramp[0]);
    this.rect(x + w - e, y + e, e, h - e, ramp[0]);
    return this;
  }

  /** Linia grubości jednej jednostki, krokowana co piksel obrazu (gładsze skosy przy res > 1). */
  line(x0: number, y0: number, x1: number, y1: number, c: number): this {
    const r = this.res, n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1) * r;
    for (let i = 0; i <= n; i++) {
      const fx = Math.round((x0 + ((x1 - x0) * i) / n) * r), fy = Math.round((y0 + ((y1 - y0) * i) / n) * r);
      for (let j = 0; j < r; j++) for (let k = 0; k < r; k++) this.set(fx + k, fy + j, c);
    }
    return this;
  }

  /** Linia grubości jednego piksela obrazu (cięciwy, szwy, fałdy, krawędzie w stylu 32-bit). */
  thin(x0: number, y0: number, x1: number, y1: number, c: number): this {
    const r = this.res, n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1 / r) * r;
    for (let i = 0; i <= n; i++) this.set(Math.floor((x0 + ((x1 - x0) * i) / n) * r), Math.floor((y0 + ((y1 - y0) * i) / n) * r), c);
    return this;
  }

  /** Wypełniony wielokąt (test środka piksela obrazu). */
  poly(pts: [number, number][], c: number): this {
    const r = this.res, ys = pts.map((p) => p[1]);
    for (let fy = Math.floor(Math.min(...ys) * r); fy <= Math.ceil(Math.max(...ys) * r); fy++) {
      for (let fx = 0; fx < this.fw; fx++) {
        let inside = false;
        const px = (fx + 0.5) / r, py = (fy + 0.5) / r;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, yi] = pts[i], [xj, yj] = pts[j];
          if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
        }
        if (inside) this.set(fx, fy, c);
      }
    }
    return this;
  }

  /** Wypełniony dysk jednym kolorem. */
  disc(cx: number, cy: number, rad: number, c: number): this {
    const r = this.res;
    for (let fy = Math.floor((cy - rad) * r); fy <= Math.ceil((cy + rad) * r); fy++) {
      for (let fx = Math.floor((cx - rad) * r); fx <= Math.ceil((cx + rad) * r); fx++) if (((fx + 0.5) / r - cx) ** 2 + ((fy + 0.5) / r - cy) ** 2 <= rad * rad) this.set(fx, fy, c);
    }
    return this;
  }

  /** Pierścień o grubości `w` (jednostki projektu). */
  ring(cx: number, cy: number, rad: number, w: number, c: number): this {
    const r = this.res;
    for (let fy = Math.floor((cy - rad) * r); fy <= Math.ceil((cy + rad) * r); fy++) {
      for (let fx = Math.floor((cx - rad) * r); fx <= Math.ceil((cx + rad) * r); fx++) {
        const d = Math.hypot((fx + 0.5) / r - cx, (fy + 0.5) / r - cy);
        if (d <= rad && d > rad - w) this.set(fx, fy, c);
      }
    }
    return this;
  }

  /**
   * Wielokąt cieniowany kierunkowo: jaśniej w lewym-górnym rogu, ciemniej w prawym-dolnym,
   * z ciemniejszą krawędzią — szybki sposób na "wypukłe" ikony (tarcza, liść, kropla).
   */
  polyShade(pts: [number, number][], ramp: Ramp): this {
    const r = this.res, xs = pts.map((p) => p[0] * r), ys = pts.map((p) => p[1] * r);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const mask = new Painter(this.w, this.h, r).poly(pts, 0);
    for (let fy = 0; fy < this.fh; fy++) {
      for (let fx = 0; fx < this.fw; fx++) {
        if (mask.at(fx, fy) < 0) continue;
        const edge = mask.at(fx + 1, fy) < 0 || mask.at(fx, fy + 1) < 0;
        const t = 1 - (((fx - x0) / Math.max(1, x1 - x0)) * 0.45 + ((fy - y0) / Math.max(1, y1 - y0)) * 0.55);
        const i = edge ? 0 : Math.min(ramp.length - 1, 1 + Math.floor(t * (ramp.length - 1)));
        this.set(fx, fy, ramp[i]);
      }
    }
    return this;
  }

  /**
   * Dodaje obrys 1 piksel obrazu wokół nieprzezroczystych pikseli (wymaga wolnego marginesu). Przy res > 1 (styl 32-bit)
   * najpierw światło krawędzi: brzegi od strony światła (lewa-góra) o odcień jaśniejsze, od cienia (prawa-dół) ciemniejsze,
   * a obrys ma ciemny odcień koloru obok (przy jasnych kolorach `c`).
   */
  outline(c: number = C.black): this {
    const hi = this.res > 1;
    if (hi) {
      const src = this.d.slice();
      const get = (x: number, y: number) => (x >= 0 && y >= 0 && x < this.fw && y < this.fh ? src[y * this.fw + x] : -1);
      for (let fy = 0; fy < this.fh; fy++) {
        for (let fx = 0; fx < this.fw; fx++) {
          const v = src[fy * this.fw + fx];
          if (v < 0 || v === C.black) continue;
          if (get(fx - 1, fy) < 0 || get(fx, fy - 1) < 0) this.d[fy * this.fw + fx] = lighter(v);
          else if (get(fx + 1, fy) < 0 || get(fx, fy + 1) < 0) this.d[fy * this.fw + fx] = darker(v);
        }
      }
    }
    const add: [number, number][] = [];
    for (let fy = 0; fy < this.fh; fy++) {
      for (let fx = 0; fx < this.fw; fx++) {
        if (this.at(fx, fy) !== -1) continue;
        const n = [this.at(fx - 1, fy), this.at(fx + 1, fy), this.at(fx, fy - 1), this.at(fx, fy + 1)].find((v) => v >= 0);
        if (n === undefined) continue;
        let col = c;
        if (hi) {
          // Ciemny odcień koloru obok; zbyt jasny (białe, kremowe) zastępuje `c`, żeby sylwetka zawsze odcinała się od tła.
          col = darker(darker(n));
          for (let k = 0; k < 3 && LUMA[col] > 0.25; k++) col = darker(col);
          if (LUMA[col] > 0.25) col = c;
        }
        add.push([fy * this.fw + fx, col]);
      }
    }
    for (const [i, col] of add) this.d[i] = col;
    return this;
  }

  /**
   * Przemalowanie (skórki bohaterów): każdy kolor poza czernią, bielą i odcieniami skóry zamienia się na kolor rampy
   * o podobnej jasności.
   */
  recolor(ramp: readonly number[]): this {
    for (let i = 0; i < this.d.length; i++) {
      const c = this.d[i];
      if (c < 0 || KEEP.has(c)) continue;
      this.d[i] = ramp[Math.min(ramp.length - 1, Math.floor(LUMA[c] * ramp.length))];
    }
    return this;
  }

  /** Obraz w pikselach obrazu (w·res × h·res); `canvasRes` zwraca jego `res` (rozmiar logiczny = obraz / res). */
  canvas(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = this.fw;
    c.height = this.fh;
    const g = c.getContext('2d')!;
    for (let i = 0; i < this.d.length; i++) {
      if (this.d[i] < 0) continue;
      g.fillStyle = PAL[this.d[i]];
      g.fillRect(i % this.fw, Math.floor(i / this.fw), 1, 1);
    }
    RES.set(c, this.res);
    return c;
  }
}

/** Rozdzielczość obrazów z Painter.canvas() (rozmiar logiczny sprite'a = obraz / res). */
const RES = new WeakMap<HTMLCanvasElement, number>();

/** Rozdzielczość grafiki świata w stylu 32-bit (piksele obrazu na jednostkę); ikony interfejsu zostają przy 1. */
export const HI = 3;
export const canvasRes = (c: HTMLCanvasElement): number => RES.get(c) ?? 1;
