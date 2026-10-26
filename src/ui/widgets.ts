import { W, H, type Renderer } from '../core/renderer';
import type { Input } from '../core/input';
import { C, PAL, type Ramp } from '../core/palette';
import { drawText, LINE_H } from '../core/font';
import { sfx } from '../core/audio';

let checker: CanvasPattern | null = null;

/** Wzór szachownicy (dithering 50%) w kolorze tła okien. */
function checkerPattern(r: Renderer): CanvasPattern {
  if (!checker) {
    const c = document.createElement('canvas');
    c.width = c.height = 2;
    const g = c.getContext('2d')!;
    g.fillStyle = PAL[C.black];
    g.fillRect(0, 0, 1, 1);
    g.fillRect(1, 1, 1, 1);
    checker = r.g.createPattern(c, 'repeat');
  }
  return checker!;
}

/**
 * Okno w stylu 16-bit: czarny obrys z zaokrąglonymi rogami, ramka w kolorze akcentu z jasną
 * krawędzią górną, tło z przejściem granat → czerń (dithering), cień pod oknem.
 */
export function panel(r: Renderer, x: number, y: number, w: number, h: number, accent: number = C.lavender, fill: number = C.navy): void {
  x = Math.round(x); y = Math.round(y);
  r.withAlpha(0.4, () => r.rect(x + 3, y + 3, w, h, C.black));
  r.rect(x + 1, y, w - 2, h, C.black);
  r.rect(x, y + 1, w, h - 2, C.black);
  r.rect(x + 1, y + 1, w - 2, h - 2, accent);
  r.rect(x + 2, y + 1, w - 4, 1, C.white);
  r.rect(x + 2, y + 2, w - 4, h - 4, C.black);
  r.rect(x + 3, y + 3, w - 6, h - 6, fill);
  // Dolna część okna przechodzi w czerń (dithering) — klasyczny gradient okien z ery 16-bit.
  const band = Math.floor((h - 6) * 0.2);
  r.g.fillStyle = checkerPattern(r);
  r.g.fillRect(x + 3, y + h - 3 - band, w - 6, band);
  r.rect(x + 3, y + 3, w - 6, 1, C.slate);
}

export function inside(px: number, py: number, x: number, y: number, w: number, h: number): boolean {
  return px >= x && px < x + w && py >= y && py < y + h;
}

/** Przyciemnienie świata pod nakładkami (pauza, awans) + ciemniejszy pas na tytuł, żeby nie mieszał się z HUD. */
export function dim(r: Renderer): void {
  r.withAlpha(0.6, () => r.rect(0, 0, W, H, C.black));
  r.withAlpha(0.75, () => r.rect(0, 4, W, 30, C.black));
}

/** Pasek 16-bit: czarna ramka, wypełnienie z połyskiem u góry i cieniem u dołu. `ramp` od cienia do światła. */
export function bar(r: Renderer, x: number, y: number, w: number, h: number, frac: number, ramp: Ramp, bg: number = C.ddbrown): void {
  const f = Math.round((w - 2) * Math.max(0, Math.min(1, frac)));
  r.rect(x, y, w, h, C.black);
  r.rect(x + 1, y + 1, w - 2, h - 2, bg);
  if (f <= 0) return;
  r.rect(x + 1, y + 1, f, h - 2, ramp[2]);
  r.rect(x + 1, y + 1, f, 1, ramp[3]);
  if (h > 4) r.rect(x + 1, y + h - 2, f, 1, ramp[1]);
}

/** Kursor-strzałka menu (lekko kołysze się w poziomie). */
export function cursor(r: Renderer, x: number, y: number): void {
  const bob = Math.floor(performance.now() / 180) % 2;
  const rows = ['#....', '##...', '#o#..', '#oo#.', '#o#..', '##...', '#....'];
  rows.forEach((row, yy) => {
    for (let xx = 0; xx < row.length; xx++) {
      if (row[xx] === '#') r.rect(x + xx - bob, y + yy, 1, 1, C.black);
      if (row[xx] === 'o') r.rect(x + xx - bob, y + yy, 1, 1, C.yellow);
    }
  });
}

export interface MenuItem {
  label: () => string;
  act?: () => void;
  /** Dla suwaków/przełączników: zmiana wartości strzałkami. */
  left?: () => void;
  right?: () => void;
}

/**
 * Pionowe menu obsługiwane klawiaturą, padem i myszą/dotykiem.
 * Przy suwakach kliknięcie lewej/prawej części pozycji zmniejsza/zwiększa wartość.
 */
export class Menu {
  sel = 0;
  private lastMouse = 0;

  constructor(public items: MenuItem[], public cx: number, public y: number, public w = 180, public lineH = 17) {}

  private rect(i: number): [number, number, number, number] {
    return [this.cx - this.w / 2, this.y + i * this.lineH, this.w, this.lineH - 2];
  }

  update(input: Input): void {
    const n = this.items.length;
    if (input.pressed('up')) { this.sel = (this.sel - 1 + n) % n; sfx.play('select'); }
    if (input.pressed('down')) { this.sel = (this.sel + 1) % n; sfx.play('select'); }
    const it = this.items[this.sel];
    if (input.pressed('left') && it.left) { it.left(); sfx.play('select'); }
    if (input.pressed('right') && it.right) { it.right(); sfx.play('select'); }
    if (input.pressed('confirm')) { (it.act ?? it.right)?.(); sfx.play('select'); return; }

    const m = input.mouse;
    for (let i = 0; i < n; i++) {
      const [x, y, w, h] = this.rect(i);
      if (!inside(m.x, m.y, x, y, w, h)) continue;
      if (m.lastMove !== this.lastMouse) this.sel = i;
      if (input.pressed('click')) {
        this.sel = i;
        const item = this.items[i];
        if (item.left && m.x < x + w / 3) item.left();
        else if (item.right && m.x > x + (w * 2) / 3) item.right();
        else (item.act ?? item.right)?.();
        sfx.play('select');
      }
    }
    this.lastMouse = m.lastMove;
  }

  render(r: Renderer): void {
    this.items.forEach((it, i) => {
      const [x, y, w, h] = this.rect(i);
      const on = i === this.sel;
      if (on) {
        r.withAlpha(0.85, () => r.rect(x, y, w, h, C.dblue));
        r.rect(x, y, w, 1, C.blue);
        r.rect(x, y + h - 1, w, 1, C.navy);
        cursor(r, x + 6, y + Math.floor((h - 7) / 2));
      }
      const label = it.left ? `< ${it.label()} >` : it.label();
      drawText(r.g, label, this.cx, y + Math.floor((h - LINE_H) / 2) + 1, on ? C.yellow : C.lgray, { align: 'center', shadow: C.black });
    });
  }
}

/** Gniazdo na ikonę (HUD, pauza): ciemne wnętrze z fazą — jasna krawędź u góry, cień u dołu. */
export function slot(r: Renderer, x: number, y: number, s: number, border: number = C.slate): void {
  r.rect(x, y, s, s, C.black);
  r.rect(x + 1, y + 1, s - 2, s - 2, border);
  r.rect(x + 2, y + 2, s - 4, s - 4, C.navy);
  r.rect(x + 2, y + 2, s - 4, 1, C.slate);
  r.rect(x + 2, y + s - 3, s - 4, 1, C.black);
}

/** Półprzezroczysta płytka pod tekst HUD (czytelność na ruchliwym tle). */
export function plate(r: Renderer, x: number, y: number, w: number, h: number): void {
  r.withAlpha(0.55, () => {
    r.rect(x + 1, y, w - 2, h, C.black);
    r.rect(x, y + 1, w, h - 2, C.black);
  });
}
