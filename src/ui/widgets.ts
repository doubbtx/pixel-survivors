import { W, H, type Renderer } from '../core/renderer';
import type { Input } from '../core/input';
import { C, PAL, type Ramp } from '../core/palette';
import { drawText, LINE_H } from '../core/font';
import { sfx } from '../core/audio';

/**
 * Okno: miękki cień, czarne zaokrąglone tło, ramka w kolorze akcentu z cienką jasną linią w środku,
 * wnętrze z gradientem (granat → czerń) i małe romby w rogach. Linie ułamkowe — bufor ma więcej pikseli niż logika.
 */
export function panel(r: Renderer, x: number, y: number, w: number, h: number, accent: number = C.lavender, fill: number = C.navy): void {
  x = Math.round(x); y = Math.round(y);
  r.withAlpha(0.45, () => r.roundRect(x + 2, y + 3, w, h, 5, C.black));
  r.roundRect(x, y, w, h, 5, C.black);
  r.roundRect(x + 1, y + 1, w - 2, h - 2, 4, fill, C.black);
  r.roundFrame(x + 0.5, y + 0.5, w - 1, h - 1, 4.5, accent, 1);
  r.withAlpha(0.35, () => r.roundFrame(x + 2, y + 2, w - 4, h - 4, 3, C.white, 0.5));
  // Faza 32-bit: jasna krawędź u góry, cień u dołu wnętrza.
  r.withAlpha(0.22, () => r.rect(x + 4, y + 2.5, w - 8, 1, C.white));
  r.withAlpha(0.45, () => r.rect(x + 4, y + h - 3.5, w - 8, 1, C.black));
  // Romby w rogach z jasnym środkiem.
  for (const [cx, cy] of [[x + 3, y + 3], [x + w - 3, y + 3], [x + 3, y + h - 3], [x + w - 3, y + h - 3]]) {
    r.g.fillStyle = PAL[accent];
    r.g.beginPath();
    r.g.moveTo(cx, cy - 2); r.g.lineTo(cx + 2, cy); r.g.lineTo(cx, cy + 2); r.g.lineTo(cx - 2, cy);
    r.g.fill();
    r.rect(cx - 0.5, cy - 0.5, 1, 1, C.white);
  }
}

export function inside(px: number, py: number, x: number, y: number, w: number, h: number): boolean {
  return px >= x && px < x + w && py >= y && py < y + h;
}

/**
 * Wskaźnik myszy do podświetleń przy rysowaniu (main.ts ustawia go przed każdą klatką; dotyk/pad = poza ekranem).
 * `hit`: w tej klatce mysz jest nad czymś klikalnym — main.ts zmienia wtedy kursor na rączkę.
 */
export const pointer = { x: -1, y: -1, hit: false };

/** Czy mysz jest nad prostokątem (i oznacza go jako klikalny). */
export function hovered(x: number, y: number, w: number, h: number): boolean {
  const on = inside(pointer.x, pointer.y, x, y, w, h);
  if (on) pointer.hit = true;
  return on;
}

export interface ButtonOpts {
  /** Wybrany / włączony (wypełnienie i ramka w kolorze akcentu). */
  active?: boolean;
  accent?: number;
  /** Kolor etykiety (domyślnie biały, żółty gdy wybrany lub pod myszą). */
  col?: number;
  /** Pulsujące obramowanie: tu jest coś do zobaczenia. */
  pulse?: boolean;
  scale?: number;
}

/** Przycisk: zaokrąglony, pod myszą jaśniejszy i lekko uniesiony, wybrany wypełniony kolorem akcentu. */
export function button(r: Renderer, x: number, y: number, w: number, h: number, label: string, o: ButtonOpts = {}): void {
  const hot = hovered(x, y, w, h), acc = o.accent ?? C.blue, lift = hot ? -1 : 0;
  r.withAlpha(0.45, () => r.roundRect(x + 1, y + 2, w, h, 4, C.black));
  r.roundRect(x, y + lift, w, h, 4, o.active ? C.dblue : hot ? C.slate : C.navy, C.black);
  r.roundFrame(x + 0.5, y + 0.5 + lift, w - 1, h - 1, 3.5, o.active || hot ? acc : C.slate, o.active ? 1 : 0.75);
  if (o.pulse && !o.active) r.withAlpha(0.35 + 0.35 * Math.sin(performance.now() / 160), () => r.roundFrame(x - 0.5, y - 0.5 + lift, w + 1, h + 1, 4.5, C.yellow, 1));
  if (hot || o.active) r.withAlpha(0.5, () => r.rect(x + 3, y + 1 + lift, w - 6, 0.5, C.white));
  const sc = o.scale ?? 1;
  drawText(r.g, label, x + w / 2, y + lift + Math.round((h - 11 * sc) / 2), o.col ?? (o.active || hot ? C.yellow : C.white), { align: 'center', shadow: C.black, scale: sc });
}

/** Pulsująca strzałka-trójkąt: w tym kierunku jest więcej treści (`dir` 1 = w prawo, -1 = w lewo). */
export function moreArrow(r: Renderer, x: number, y: number, dir: 1 | -1, col: number = C.yellow): void {
  const off = Math.round(Math.sin(performance.now() / 150) * 1.5) * dir;
  r.g.fillStyle = PAL[C.black];
  r.g.beginPath();
  r.g.moveTo(x + off - 4 * dir, y - 5); r.g.lineTo(x + off + 4 * dir, y); r.g.lineTo(x + off - 4 * dir, y + 5);
  r.g.fill();
  r.g.fillStyle = PAL[col];
  r.g.beginPath();
  r.g.moveTo(x + off - 3 * dir, y - 3.5); r.g.lineTo(x + off + 2.5 * dir, y); r.g.lineTo(x + off - 3 * dir, y + 3.5);
  r.g.fill();
}

/** Przyciemnienie świata pod nakładkami (pauza, awans) + ciemniejsza wstęga na tytuł ze złotymi liniami. */
export function dim(r: Renderer): void {
  r.withAlpha(0.65, () => r.rect(0, 0, W, H, C.black));
  r.withAlpha(0.8, () => r.rect(0, 4, W, 30, C.black));
  r.withAlpha(0.6, () => { r.rect(0, 4, W, 0.5, C.gold); r.rect(0, 33.5, W, 0.5, C.gold); });
}

/** Pasek: zaokrąglona czarna oprawa, wypełnienie z gradientem rampy (światło u góry), połysk i podziałki co 10%. `ramp` od cienia do światła. */
export function bar(r: Renderer, x: number, y: number, w: number, h: number, frac: number, ramp: Ramp, bg: number = C.ddbrown): void {
  const rad = Math.min(3, h / 2);
  const f = (w - 2) * Math.max(0, Math.min(1, frac));
  r.roundRect(x, y, w, h, rad, C.black);
  r.roundRect(x + 1, y + 1, w - 2, h - 2, rad - 0.5, bg, C.black);
  if (f > 0) {
    const fw = Math.max(f, Math.min(2, w - 2));
    r.roundRect(x + 1, y + 1, fw, h - 2, rad - 0.5, ramp[3], ramp[1]);
    // Połysk 32-bit: jasny pas w górnej części wypełnienia i cień w dolnej.
    r.withAlpha(0.55, () => r.rect(x + 2, y + 1.5, Math.max(0, f - 2), 0.5, C.white));
    if (h >= 5) {
      r.withAlpha(0.18, () => r.rect(x + 1, y + 1, fw, (h - 2) * 0.4, C.white));
      r.withAlpha(0.22, () => r.rect(x + 1, y + 1 + (h - 2) * 0.7, fw, (h - 2) * 0.3, C.black));
    }
  }
  if (w >= 60 && h >= 5) r.withAlpha(0.35, () => { for (let i = 1; i < 10; i++) r.rect(x + 1 + ((w - 2) * i) / 10, y + 1, 0.5, h - 2, C.black); });
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
  /** Wartość opcji: etykieta wtedy po lewej, wartość po prawej (lista ustawień). */
  value?: () => string;
}

/**
 * Pionowe menu obsługiwane klawiaturą, padem i myszą/dotykiem.
 * Przy suwakach kliknięcie lewej/prawej części pozycji zmniejsza/zwiększa wartość.
 */
export class Menu {
  sel = 0;
  private lastMouse = 0;

  /** `gaps`: dodatkowy odstęp (px) przed pozycją o danym indeksie (grupy w menu głównym). */
  constructor(public items: MenuItem[], public cx: number, public y: number, public w = 180, public lineH = 17, public gaps: Record<number, number> = {}) {}

  /** Górna krawędź pozycji `i` (z odstępami grup). */
  top(i: number): number {
    let y = this.y + i * this.lineH;
    for (const k in this.gaps) if (Number(k) <= i) y += this.gaps[k];
    return y;
  }

  private rect(i: number): [number, number, number, number] {
    return [this.cx - this.w / 2, this.top(i), this.w, this.lineH - 2];
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
      if (m.lastMove !== this.lastMouse && this.sel !== i) { this.sel = i; sfx.play('hover'); }
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
      hovered(x, y, w, h);
      if (on) {
        r.withAlpha(0.9, () => r.roundRect(x, y, w, h, 3, C.dblue, C.navy));
        r.roundFrame(x, y, w, h, 3, C.blue, 0.5);
        r.withAlpha(0.5, () => r.rect(x + 3, y + 0.5, w - 6, 0.5, C.cyan));
        cursor(r, x + 6, y + Math.floor((h - 7) / 2));
      }
      const ty = y + Math.floor((h - LINE_H) / 2) + 1;
      if (it.value) {
        drawText(r.g, it.label(), x + 16, ty, on ? C.yellow : C.lgray, { shadow: C.black });
        drawText(r.g, it.left ? `< ${it.value()} >` : it.value(), x + w - 8, ty, on ? C.white : C.cyan, { align: 'right', shadow: C.black });
        return;
      }
      const label = it.left ? `< ${it.label()} >` : it.label();
      drawText(r.g, label, this.cx, ty, on ? C.yellow : C.lgray, { align: 'center', shadow: C.black });
    });
  }
}

/** Gniazdo na ikonę (HUD, pauza): zaokrąglone, czarna oprawa, ramka w kolorze `border`, wnętrze z gradientem i połyskiem. */
export function slot(r: Renderer, x: number, y: number, s: number, border: number = C.slate): void {
  r.roundRect(x, y, s, s, 3, C.black);
  r.roundRect(x + 1, y + 1, s - 2, s - 2, 2.5, C.slate, C.black);
  r.roundFrame(x + 0.5, y + 0.5, s - 1, s - 1, 3, border, 1);
  r.withAlpha(0.3, () => r.rect(x + 2.5, y + 1.75, s - 5, 0.5, C.white));
  // Wklęsłe wnętrze: cień przy dolnej krawędzi.
  r.withAlpha(0.35, () => r.rect(x + 2.5, y + s - 3, s - 5, 1, C.black));
}

/** Półprzezroczysta zaokrąglona płytka pod tekst HUD (czytelność na ruchliwym tle). */
export function plate(r: Renderer, x: number, y: number, w: number, h: number): void {
  r.withAlpha(0.7, () => r.roundRect(x, y, w, h, 3, C.navy, C.black));
  r.withAlpha(0.4, () => r.roundFrame(x, y, w, h, 3, C.lavender, 0.5));
  r.withAlpha(0.15, () => r.rect(x + 3, y + 1, w - 6, 0.5, C.white));
}
