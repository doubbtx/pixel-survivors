import { PAL } from './palette';

/** Rozdzielczość logiczna ekranu: UI rysuje w pikselach W×H (bufor ma K razy więcej pikseli, patrz Renderer). */
export const W = 480;
export const H = 270;
/**
 * Powiększenie świata: 1 jednostka świata = 1.5 piksela logicznego przy przybliżeniu 1. Logika gry działa w jednostkach świata.
 * Przybliżenie świata (Ustawienia: VIEW_S) dodatkowo powiększa świat; kamera widzi VIEW_W × VIEW_H jednostek,
 * a świat rysuje się w obszarze VW × VH pikseli logicznych świata (renderer skaluje go do całego ekranu).
 */
export const ZOOM = 1.5;
export let VIEW_S = 1;
export let VIEW_W = W / ZOOM;
export let VIEW_H = H / ZOOM;
export let VW = W;
export let VH = H;

/**
 * Renderer: bufor W·K × H·K (K całkowite, dobrane do ekranu) — UI rysuje w pikselach logicznych przez transformację ×K,
 * świat (beginWorld) przez ×K·s, gdzie K·s też jest całkowite, więc piksele sprite'ów są równe przy każdym przybliżeniu.
 * Prezentacja: bufor dopasowany do okna (wypełnienie, z wygładzaniem) albo skala całkowita (ostre piksele, z ramką).
 * Prymitywy pikselowe (prostokąty, okręgi z cache, linie Bresenhama) trzymają się palety;
 * półprzezroczystość ustawia się przez globalAlpha (cienie, poświaty).
 */
export class Renderer {
  readonly buf: HTMLCanvasElement;
  readonly g: CanvasRenderingContext2D;
  private readonly ctx: CanvasRenderingContext2D;
  /** Mnożnik bufora (piksele bufora na piksel logiczny). */
  private k = 1;
  private fill = true;
  /** Przybliżenie świata żądane w Ustawieniach (rzeczywiste: VIEW_S, zaokrąglone tak, żeby K·s było całkowite). */
  private zoom = 1;
  private circleCache = new Map<string, HTMLCanvasElement>();

  constructor(private readonly display: HTMLCanvasElement) {
    this.buf = document.createElement('canvas');
    this.g = this.buf.getContext('2d')!;
    this.ctx = display.getContext('2d')!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  setFill(on: boolean): void {
    this.fill = on;
    this.resize();
  }

  /** Przybliżenie świata (1 = najdalej). */
  setZoom(z: number): void {
    this.zoom = z;
    this.applyZoom();
  }

  private applyZoom(): void {
    VIEW_S = Math.max(1, Math.round(this.k * this.zoom) / this.k);
    VW = W / VIEW_S;
    VH = H / VIEW_S;
    VIEW_W = VW / ZOOM;
    VIEW_H = VH / ZOOM;
  }

  /**
   * Wypełnienie: płótno o rozmiarze okna w pikselach urządzenia, K = 4 (przybliżenia 1, 1.25 i 1.5 dają całkowite K·s).
   * Inaczej największa całkowita skala mieszcząca się w oknie (min. 1; mniejsze ekrany skaluje CSS).
   */
  resize(): void {
    const fit = Math.min(window.innerWidth / W, window.innerHeight / H);
    const dpr = window.devicePixelRatio || 1;
    if (this.fill && fit >= 1) {
      const cw = Math.floor(W * fit), ch = Math.floor(H * fit);
      this.k = 4;
      this.display.width = Math.round(cw * dpr);
      this.display.height = Math.round(ch * dpr);
      this.display.style.width = `${cw}px`;
      this.display.style.height = `${ch}px`;
    } else {
      const s = Math.max(1, Math.floor(fit));
      this.k = Math.min(4, Math.max(2, s));
      this.display.width = W * s;
      this.display.height = H * s;
      const css = fit >= 1 ? s : fit;
      this.display.style.width = `${Math.floor(W * css)}px`;
      this.display.style.height = `${Math.floor(H * css)}px`;
    }
    // Zmiana rozmiaru płótna zeruje stan kontekstu.
    this.buf.width = W * this.k;
    this.buf.height = H * this.k;
    this.g.imageSmoothingEnabled = false;
    this.g.setTransform(this.k, 0, 0, this.k, 0, 0);
    this.applyZoom();
  }

  /** Rysowanie świata: piksele logiczne świata (obszar VW × VH) powiększone o VIEW_S. */
  beginWorld(): void {
    const s = this.k * VIEW_S;
    this.g.setTransform(s, 0, 0, s, 0, 0);
  }

  /** Powrót do pikseli logicznych UI. */
  endWorld(): void {
    this.g.setTransform(this.k, 0, 0, this.k, 0, 0);
  }

  present(): void {
    const same = this.display.width === this.buf.width && this.display.height === this.buf.height;
    this.ctx.imageSmoothingEnabled = !same;
    this.ctx.imageSmoothingQuality = 'high';
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

  /** Zaokrąglony prostokąt wypełniony kolorem albo pionowym gradientem (góra → dół) z palety. Interfejs (gładkie okna). */
  roundRect(x: number, y: number, w: number, h: number, rad: number, col: number, bottom?: number): void {
    const g = this.g;
    if (bottom === undefined) g.fillStyle = PAL[col];
    else {
      const gr = g.createLinearGradient(0, y, 0, y + h);
      gr.addColorStop(0, PAL[col]);
      gr.addColorStop(1, PAL[bottom]);
      g.fillStyle = gr;
    }
    g.beginPath();
    g.roundRect(x, y, w, h, Math.min(rad, w / 2, h / 2));
    g.fill();
  }

  /** Obrys zaokrąglonego prostokąta linią o grubości `lw` pikseli logicznych (może być ułamkowa: bufor ma K× więcej pikseli). */
  roundFrame(x: number, y: number, w: number, h: number, rad: number, col: number, lw = 1): void {
    const g = this.g;
    g.strokeStyle = PAL[col];
    g.lineWidth = lw;
    g.beginPath();
    g.roundRect(x + lw / 2, y + lw / 2, w - lw, h - lw, Math.max(0, Math.min(rad, w / 2, h / 2) - lw / 2));
    g.stroke();
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
