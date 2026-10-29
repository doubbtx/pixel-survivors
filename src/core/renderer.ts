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
/** Okręgi o większym promieniu (piksele logiczne) rysowane są łukiem zamiast z gotowej bitmapy. */
const CIRCLE_BITMAP_MAX = 24;
/** Limit gotowych bitmap okręgów w pamięci podręcznej. */
const CIRCLE_CACHE_MAX = 300;
export let VIEW_S = 1;
export let VIEW_W = W / ZOOM;
export let VIEW_H = H / ZOOM;
export let VW = W;
export let VH = H;

/**
 * Renderer: bufor W·K × H·K (K całkowite) — UI rysuje w pikselach logicznych przez transformację ×K (gładkie linie, zaokrąglenia).
 * Świat (beginWorld) rysuje się na osobnym płótnie w pikselach logicznych świata (VW × VH, płótno `worldRes` razy gęstsze)
 * i endWorld wkleja je do bufora powiększone o K·s (też całkowite, więc piksele sprite'ów są równe).
 * Prymitywy pikselowe (prostokąty, okręgi z cache, linie Bresenhama) trzymają się palety;
 * półprzezroczystość ustawia się przez globalAlpha (cienie, poświaty).
 */
export class Renderer {
  /** Płótno ekranu: W·K × H·K pikseli, przeglądarka skaluje je do rozmiaru okna (CSS). */
  readonly buf: HTMLCanvasElement;
  /** Bieżący kontekst rysowania: ekran (UI) albo płótno świata (między beginWorld a endWorld). */
  g: CanvasRenderingContext2D;
  private readonly ui: CanvasRenderingContext2D;
  private readonly world: HTMLCanvasElement = document.createElement('canvas');
  private readonly wg: CanvasRenderingContext2D;
  /** Mnożnik bufora (piksele płótna na piksel logiczny), 2..4. */
  private k = 2;
  private fill = true;
  /** Przybliżenie świata żądane w Ustawieniach (rzeczywiste: VIEW_S, zaokrąglone tak, żeby K·s było całkowite). */
  private zoom = 1;
  private circleCache = new Map<string, HTMLCanvasElement>();
  /** Rozdzielczość płótna świata (piksele na piksel logiczny świata): 3 = pełne detale grafiki, 2 = Efekty oszczędne. */
  private worldRes = 3;

  constructor(private readonly display: HTMLCanvasElement) {
    this.buf = display;
    this.ui = this.g = display.getContext('2d')!;
    this.wg = this.world.getContext('2d')!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  setFill(on: boolean): void {
    this.fill = on;
    this.resize();
  }

  /** Rozdzielczość płótna świata (Ustawienia: Efekty pełne 3, oszczędne 2). */
  setWorldRes(res: number): void {
    if (res === this.worldRes) return;
    this.worldRes = res;
    this.applyZoom();
  }

  /** Piksele płótna świata na piksel logiczny (podłoże budowane w tej rozdzielczości). */
  worldDensity(): number {
    return this.worldRes;
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
    this.world.width = Math.ceil(VW) * this.worldRes;
    this.world.height = Math.ceil(VH) * this.worldRes;
    this.wg.imageSmoothingEnabled = false;
    // Rysowanie w pikselach logicznych świata; sprite'y 32-bit (obraz 2×) pokazują wtedy pełne detale.
    this.wg.setTransform(this.worldRes, 0, 0, this.worldRes, 0, 0);
  }

  /**
   * Wypełnienie: płótno K× (K = skala okna w pikselach urządzenia, w górę, 2..4) dopasowane do okna przez CSS z wygładzaniem.
   * Ostre piksele: tylko całkowite powiększenie bez wygładzania (z ramką).
   */
  resize(): void {
    const fit = Math.min(window.innerWidth / W, window.innerHeight / H);
    const dpr = window.devicePixelRatio || 1;
    const css = this.fill || fit < 1 ? fit : Math.floor(fit);
    this.k = Math.min(4, Math.max(2, Math.ceil(css * dpr - 0.01)));
    this.display.width = W * this.k;
    this.display.height = H * this.k;
    this.display.style.width = `${Math.floor(W * css)}px`;
    this.display.style.height = `${Math.floor(H * css)}px`;
    this.display.style.imageRendering = this.fill ? 'auto' : 'pixelated';
    // Zmiana rozmiaru płótna zeruje stan kontekstu.
    this.ui.imageSmoothingEnabled = false;
    this.ui.setTransform(this.k, 0, 0, this.k, 0, 0);
    this.applyZoom();
  }

  /** Rysowanie świata na płótnie świata (piksele logiczne świata, obszar VW × VH). */
  beginWorld(): void {
    this.g = this.wg;
  }

  /** Wkleja świat do bufora (powiększenie VIEW_S, piksele równe) i wraca do rysowania UI. */
  endWorld(): void {
    this.g = this.ui;
    this.ui.drawImage(this.world, 0, 0, (this.world.width / this.worldRes) * VIEW_S, (this.world.height / this.worldRes) * VIEW_S);
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

  /** Siatka prymitywów (podziałki na piksel logiczny): w świecie piksele płótna świata, jak w sprite'ach; w UI piksele logiczne. */
  private get dens(): number {
    return this.g === this.wg ? this.worldRes : 1;
  }

  /** Zaokrąglenie do siatki prymitywów. */
  private snap(v: number): number {
    const d = this.dens;
    return Math.round(v * d) / d;
  }

  rect(x: number, y: number, w: number, h: number, col: number): void {
    this.g.fillStyle = PAL[col];
    const d = this.dens;
    this.g.fillRect(this.snap(x), this.snap(y), Math.round(w * d) / d, Math.round(h * d) / d);
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
    // Duże okręgi (fale, aury, strefy — często rosnące co klatkę): rysowane wprost jako łuk, bez budowania obrazka.
    // Budowanie bitmapy dla każdego nowego promienia kosztowało setki tysięcy pikseli na klatkę.
    if (r > CIRCLE_BITMAP_MAX) {
      const g = this.g;
      g.fillStyle = g.strokeStyle = PAL[col];
      g.beginPath();
      if (fill) { g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
      else { g.lineWidth = 1; g.arc(x, y, r - 0.5, 0, Math.PI * 2); g.stroke(); }
      return;
    }
    // Małe okręgi: z pamięci podręcznej, liczone na siatce prymitywów (krawędź tej samej gęstości co sprite'y),
    // obwódka grubości 1 piksela logicznego. W UI po siatce bufora (K), żeby pasowały do gładkich ramek.
    const d = this.g === this.wg ? this.worldRes : this.k, R = Math.max(d, Math.round(r * d));
    const key = `${R}|${d}|${col}|${fill ? 1 : 0}`;
    let c = this.circleCache.get(key);
    if (!c) {
      const n = R * 2 + 1, img = new ImageData(n, n), px = img.data, hex = parseInt(PAL[col].slice(1), 16);
      const cr = (hex >> 16) & 255, cgr = (hex >> 8) & 255, cb = hex & 255;
      for (let yy = -R; yy <= R; yy++) {
        for (let xx = -R; xx <= R; xx++) {
          const dd = Math.sqrt(xx * xx + yy * yy);
          if (dd > R + 0.3 || (!fill && dd <= R - d + 0.3)) continue;
          const o = ((yy + R) * n + xx + R) * 4;
          px[o] = cr; px[o + 1] = cgr; px[o + 2] = cb; px[o + 3] = 255;
        }
      }
      c = document.createElement('canvas');
      c.width = c.height = n;
      c.getContext('2d')!.putImageData(img, 0, 0);
      this.circleCache.set(key, c);
      if (this.circleCache.size > CIRCLE_CACHE_MAX) this.circleCache.delete(this.circleCache.keys().next().value!);
    }
    this.g.drawImage(c, Math.round(x * d) / d - R / d, Math.round(y * d) / d - R / d, (R * 2 + 1) / d, (R * 2 + 1) / d);
  }

  /** Obwódka elipsy grubości jednej podziałki siatki prymitywów (w świecie: drobny piksel, bez wygładzania wektorowego). */
  ellipse(x: number, y: number, rx: number, ry: number, col: number): void {
    this.g.fillStyle = PAL[col];
    const d = this.dens, cx = this.snap(x) * d, cy = this.snap(y) * d, RX = rx * d, RY = ry * d;
    for (let yy = Math.floor(-RY) - 1; yy <= Math.ceil(RY) + 1; yy++) {
      for (let xx = Math.floor(-RX) - 1; xx <= Math.ceil(RX) + 1; xx++) {
        // Odległość od brzegu w pikselach siatki (przybliżenie przez gradient funkcji elipsy).
        const f = (xx / RX) ** 2 + (yy / RY) ** 2 - 1;
        const gl = 2 * Math.hypot(xx / (RX * RX), yy / (RY * RY)) || 1;
        if (Math.abs(f / gl) <= 0.5) this.g.fillRect((cx + xx) / d, (cy + yy) / d, 1 / d, 1 / d);
      }
    }
  }

  /** Linia Bresenhama o grubości `w` pikseli logicznych, krokowana co podziałkę siatki prymitywów (gładkie skosy w świecie). */
  line(x0: number, y0: number, x1: number, y1: number, col: number, w = 1): void {
    // NaN / nieskończoność (np. kierunek z zerowej prędkości): nic do rysowania (Bresenham zrobiłby 1500·d pustych kroków).
    if (!Number.isFinite(x0 + y0 + x1 + y1)) return;
    // Przycięcie odcinka do widoku (z marginesem grubości): długie linie poza ekranem nic nie kosztują.
    const m = w + 1, maxX = (this.g === this.wg ? VW : W) + m, maxY = (this.g === this.wg ? VH : H) + m;
    const c = clipSegment(x0, y0, x1, y1, -m, -m, maxX, maxY);
    if (!c) return;
    [x0, y0, x1, y1] = c;
    this.g.fillStyle = PAL[col];
    const d = this.dens, len = Math.hypot(x1 - x0, y1 - y0);
    // Grube, półprzezroczyste albo długie linie: jeden wypełniony czworokąt (z kwadratowymi końcami jak dawniej).
    // Stary sposób (kwadrat w×w na każdym kroku) kosztował długość·gęstość wywołań i nakładał przezroczystość.
    if (w > 1 || this.g.globalAlpha < 1 || len * d > 48) {
      const h = w / 2, ux = len > 0 ? (x1 - x0) / len : 1, uy = len > 0 ? (y1 - y0) / len : 0;
      const g = this.g;
      g.beginPath();
      g.moveTo(x0 - ux * h - uy * h, y0 - uy * h + ux * h);
      g.lineTo(x1 + ux * h - uy * h, y1 + uy * h + ux * h);
      g.lineTo(x1 + ux * h + uy * h, y1 + uy * h - ux * h);
      g.lineTo(x0 - ux * h + uy * h, y0 - uy * h - ux * h);
      g.closePath();
      g.fill();
      return;
    }
    x0 = Math.round(x0 * d); y0 = Math.round(y0 * d); x1 = Math.round(x1 * d); y1 = Math.round(y1 * d);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    const o = Math.floor((w * d) / 2);
    let err = dx + dy;
    for (let i = 0; i < 1500 * d; i++) {
      this.g.fillRect((x0 - o) / d, (y0 - o) / d, w, w);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  /** Wypełniony wycinek koła (stożek) od kąta a0 do a1: jedna ścieżka, jednolita przezroczystość. */
  fan(x: number, y: number, r: number, a0: number, a1: number, col: number): void {
    const g = this.g;
    g.fillStyle = PAL[col];
    g.beginPath();
    g.moveTo(x, y);
    g.arc(x, y, r, a0, a1);
    g.closePath();
    g.fill();
  }

  /** Rysowanie z przezroczystością (cienie, poświaty, przyciemnienia). Zagnieżdżone wywołania mnożą przezroczystość. */
  withAlpha(a: number, fn: () => void): void {
    const prev = this.g.globalAlpha;
    this.g.globalAlpha = prev * a;
    fn();
    this.g.globalAlpha = prev;
  }
}

/** Przycięcie odcinka do prostokąta (Liang-Barsky); null, gdy odcinek jest całkiem poza. */
function clipSegment(x0: number, y0: number, x1: number, y1: number, minX: number, minY: number, maxX: number, maxY: number): [number, number, number, number] | null {
  const dx = x1 - x0, dy = y1 - y0;
  let t0 = 0, t1 = 1;
  const p = [-dx, dx, -dy, dy], q = [x0 - minX, maxX - x0, y0 - minY, maxY - y0];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return null; continue; }
    const t = q[i] / p[i];
    if (p[i] < 0) { if (t > t1) return null; if (t > t0) t0 = t; } else { if (t < t0) return null; if (t < t1) t1 = t; }
  }
  return [x0 + dx * t0, y0 + dy * t0, x0 + dx * t1, y0 + dy * t1];
}
