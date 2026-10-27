import { PAL } from './palette';

/** Rozdzielczość ekranu (piksele logiczne). Cała gra rysuje do bufora W×H skalowanego całkowitoliczbowo. */
export const W = 480;
export const H = 270;
/**
 * Powiększenie świata: 1 jednostka świata = 1.5 piksela ekranu. Logika gry działa w jednostkach świata,
 * więc kamera widzi VIEW_W × VIEW_H jednostek, a sprite'y mają dwa razy więcej detali niż hitboksy.
 */
export const ZOOM = 1.5;
export const VIEW_W = W / ZOOM;
export const VIEW_H = H / ZOOM;

/**
 * Renderer: bufor niskiej rozdzielczości + prezentacja na ekranie: wypełnienie okna (domyślnie; najpierw całkowite
 * powiększenie bez wygładzania, potem dopasowanie z wygładzaniem, więc piksele są równe) albo sama skala całkowita.
 * Prymitywy pikselowe (prostokąty, okręgi z cache, linie Bresenhama) trzymają się palety;
 * półprzezroczystość ustawia się przez globalAlpha (cienie, poświaty).
 */
export class Renderer {
  readonly buf: HTMLCanvasElement;
  readonly g: CanvasRenderingContext2D;
  private readonly ctx: CanvasRenderingContext2D;
  private scale = 1;
  /** Wypełnianie okna i bufor pośredni o całkowitej skali (tylko w tym trybie). */
  private fill = true;
  private readonly mid: HTMLCanvasElement = document.createElement('canvas');
  private readonly midCtx: CanvasRenderingContext2D;
  private circleCache = new Map<string, HTMLCanvasElement>();

  constructor(private readonly display: HTMLCanvasElement) {
    this.buf = document.createElement('canvas');
    this.buf.width = W;
    this.buf.height = H;
    this.g = this.buf.getContext('2d')!;
    this.g.imageSmoothingEnabled = false;
    this.ctx = display.getContext('2d')!;
    this.midCtx = this.mid.getContext('2d')!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  setFill(on: boolean): void {
    this.fill = on;
    this.resize();
  }

  /**
   * Wypełnienie: płótno o rozmiarze okna w pikselach urządzenia, bufor pośredni W×H × ceil(skala).
   * Inaczej największa całkowita skala mieszcząca się w oknie (min. 1; mniejsze ekrany skaluje CSS).
   */
  resize(): void {
    const fit = Math.min(window.innerWidth / W, window.innerHeight / H);
    if (this.fill && fit >= 1) {
      const dpr = window.devicePixelRatio || 1, cw = Math.floor(W * fit), ch = Math.floor(H * fit);
      this.scale = Math.ceil(fit * dpr);
      this.mid.width = W * this.scale;
      this.mid.height = H * this.scale;
      this.display.width = Math.round(cw * dpr);
      this.display.height = Math.round(ch * dpr);
      this.display.style.width = `${cw}px`;
      this.display.style.height = `${ch}px`;
      return;
    }
    const s = Math.floor(fit);
    this.scale = Math.max(1, s);
    this.display.width = W * this.scale;
    this.display.height = H * this.scale;
    const css = s >= 1 ? this.scale : Math.min(window.innerWidth / W, window.innerHeight / H);
    this.display.style.width = `${Math.floor(W * css)}px`;
    this.display.style.height = `${Math.floor(H * css)}px`;
  }

  present(): void {
    if (this.fill && this.mid.width === W * this.scale && this.display.width !== W * this.scale) {
      this.midCtx.imageSmoothingEnabled = false;
      this.midCtx.drawImage(this.buf, 0, 0, this.mid.width, this.mid.height);
      this.ctx.imageSmoothingEnabled = true;
      this.ctx.imageSmoothingQuality = 'high';
      this.ctx.drawImage(this.mid, 0, 0, this.display.width, this.display.height);
      return;
    }
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(this.buf, 0, 0, this.display.width, this.display.height);
  }

  /** Przelicza współrzędne zdarzenia (px ekranu) na piksele logiczne bufora. */
  toLogical(clientX: number, clientY: number): { x: number; y: number } {
    const r = this.display.getBoundingClientRect();
    return { x: ((clientX - r.left) / r.width) * W, y: ((clientY - r.top) / r.height) * H };
  }

  clear(col: number): void {
    this.g.fillStyle = PAL[col];
    this.g.fillRect(0, 0, W, H);
  }

  rect(x: number, y: number, w: number, h: number, col: number): void {
    this.g.fillStyle = PAL[col];
    this.g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  /** Ramka 1px. */
  frame(x: number, y: number, w: number, h: number, col: number): void {
    this.rect(x, y, w, 1, col);
    this.rect(x, y + h - 1, w, 1, col);
    this.rect(x, y, 1, h, col);
    this.rect(x + w - 1, y, 1, h, col);
  }

  /** Okrąg w stylu pikselowym (obrys lub dysk) — rasteryzowany raz i trzymany w cache. */
  circle(x: number, y: number, r: number, col: number, fill = false): void {
    r = Math.max(1, Math.round(r));
    if (r > 240) return;
    const key = `${r}|${col}|${fill ? 1 : 0}`;
    let c = this.circleCache.get(key);
    if (!c) {
      c = document.createElement('canvas');
      c.width = c.height = r * 2 + 1;
      const cg = c.getContext('2d')!;
      cg.fillStyle = PAL[col];
      for (let yy = -r; yy <= r; yy++) {
        for (let xx = -r; xx <= r; xx++) {
          const d = Math.sqrt(xx * xx + yy * yy);
          if (d <= r + 0.3 && (fill || d > r - 0.7)) cg.fillRect(xx + r, yy + r, 1, 1);
        }
      }
      this.circleCache.set(key, c);
    }
    this.g.drawImage(c, Math.round(x) - r, Math.round(y) - r);
  }

  /** Linia Bresenhama o grubości `w` pikseli. */
  line(x0: number, y0: number, x1: number, y1: number, col: number, w = 1): void {
    this.g.fillStyle = PAL[col];
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    const o = Math.floor(w / 2);
    let err = dx + dy;
    for (let i = 0; i < 1500; i++) {
      this.g.fillRect(x0 - o, y0 - o, w, w);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  /** Rysowanie z przezroczystością (cienie, poświaty, przyciemnienia). Zagnieżdżone wywołania mnożą przezroczystość. */
  withAlpha(a: number, fn: () => void): void {
    const prev = this.g.globalAlpha;
    this.g.globalAlpha = prev * a;
    fn();
    this.g.globalAlpha = prev;
  }
}
