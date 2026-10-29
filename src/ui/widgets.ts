import { W, H, type Renderer } from '../core/renderer';
import type { Input } from '../core/input';
import { C, PAL, type Ramp } from '../core/palette';
import { drawText, textWidth, LINE_H } from '../core/font';
import { sfx } from '../core/audio';
import { UI, tile } from './theme';
import { drawSprite } from '../gfx/sprites';

/**
 * Okno (wspólny styl z HUD-em, ui/theme.ts): delikatny cień, płaskie grafitowo-granatowe wypełnienie i jedna cienka ramka
 * w kolorze akcentu. Bez połysku, gradientów i ozdobników w rogach.
 */
export function panel(r: Renderer, x: number, y: number, w: number, h: number, accent: number = UI.border, fill: number = C.navy): void {
  x = Math.round(x); y = Math.round(y);
  r.withAlpha(0.35, () => r.roundRect(x + 1, y + 2, w, h, UI.radius + 1, C.black));
  r.withAlpha(0.94, () => r.roundRect(x, y, w, h, UI.radius + 1, fill));
  r.roundFrame(x, y, w, h, UI.radius + 1, accent, 1);
}

/**
 * Przewijany obszar (teksty opisowe przy dużym tekście): kółko myszy albo przeciąganie palcem nad obszarem, opcjonalnie
 * klawisze góra/dół. Rysowanie: `begin` przycina i zwraca przesunięcie, `end` zapamiętuje wysokość treści i rysuje pasek.
 */
export class Scroll {
  y = 0;
  private max = 0;

  /** `keys`: strzałki góra/dół też przewijają (gdy ekran nie używa ich do wyboru). */
  update(inp: Input, x: number, y: number, w: number, h: number, keys = false): void {
    if (inside(inp.mouse.x, inp.mouse.y, x, y, w, h)) this.y += inp.scroll;
    if (keys && inp.isDown('down')) this.y += 3;
    if (keys && inp.isDown('up')) this.y -= 3;
    // PageUp / PageDown i prawa gałka pada działają zawsze.
    if (inp.isDown('pageDown')) this.y += 4;
    if (inp.isDown('pageUp')) this.y -= 4;
    if (Math.abs(inp.padAim.y) > 0.3) this.y += inp.padAim.y * 4;
    this.y = Math.max(0, Math.min(this.max, this.y));
  }

  reset(): void {
    this.y = 0;
  }

  begin(r: Renderer, x: number, y: number, w: number, h: number): number {
    r.g.save();
    r.g.beginPath();
    r.g.rect(x, y, w, h);
    r.g.clip();
    return Math.round(this.y);
  }

  /** `contentH`: wysokość narysowanej treści (bez przesunięcia). */
  end(r: Renderer, contentH: number, x: number, y: number, w: number, h: number): void {
    r.g.restore();
    this.max = Math.max(0, contentH - h);
    this.y = Math.min(this.y, this.max);
    if (this.max <= 0) return;
    // Pasek: tor i suwak przy prawej krawędzi.
    const th = Math.max(10, (h * h) / contentH), ty = y + (h - th) * (this.y / this.max);
    r.withAlpha(0.35, () => r.rect(x + w - 2, y, 1.5, h, C.slate));
    r.rect(x + w - 2, ty, 1.5, th, C.lavender);
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

/** Przycisk: płaski, cienka ramka; pod myszą jaśniejszy, wybrany z ramką w kolorze akcentu. */
export function button(r: Renderer, x: number, y: number, w: number, h: number, label: string, o: ButtonOpts = {}): void {
  const hot = hovered(x, y, w, h), acc = o.accent ?? C.gold;
  if (o.active && acc === C.gold) ember(r, x, y, w, h);
  r.withAlpha(o.active ? 0.95 : 0.85, () => r.roundRect(x, y, w, h, UI.radius, o.active ? C.ddbrown : hot ? C.slate : C.navy));
  r.roundFrame(x, y, w, h, UI.radius, o.active || hot ? acc : UI.border, o.active ? 1 : UI.line * 1.5);
  if (o.pulse && !o.active) r.withAlpha(0.35 + 0.35 * Math.sin(performance.now() / 160), () => r.roundFrame(x - 1, y - 1, w + 2, h + 2, UI.radius + 1, C.yellow, 0.75));
  const sc = o.scale ?? 1;
  drawText(r.g, label, x + w / 2, y + Math.round((h - 12 * sc) / 2), o.col ?? (o.active || hot ? C.yellow : C.white), { align: 'center', shadow: C.black, scale: sc });
}

/**
 * Żar: ciepła poświata pod zaznaczonym elementem (pozycja menu, aktywny przycisk, wybrana karta). Jedyny „świecący”
 * element interfejsu: okna są ciche, światło ogniska pokazuje, gdzie jest gracz.
 */
export function ember(r: Renderer, x: number, y: number, w: number, h: number, rad: number = UI.radius): void {
  r.withAlpha(0.1, () => r.roundRect(x - 4, y - 3, w + 8, h + 6, rad + 4, C.orange));
  r.withAlpha(0.14, () => r.roundRect(x - 2, y - 1.5, w + 4, h + 3, rad + 2, C.gold));
}

/**
 * Wspólna oprawa kart wyboru (awans, karty, moc bossa, kolekcja): okno z ramką w kolorze kategorii (jakość, rzadkość),
 * zaznaczona karta dostaje złotą obwódkę na zewnątrz (ekrany unoszą ją też o kilka pikseli).
 */
export function cardFrame(r: Renderer, x: number, y: number, w: number, h: number, accent: number, selected: boolean): void {
  if (selected) ember(r, x - 2, y - 2, w + 4, h + 4, UI.radius + 2);
  panel(r, x, y, w, h, accent);
  if (selected) r.roundFrame(x - 2, y - 2, w + 4, h + 4, UI.radius + 2, C.gold, 1);
}

/** Plakietka na środku górnej krawędzi karty („Recommended”, „New!”). */
export function cardBadge(r: Renderer, cx: number, y: number, text: string, col: number): void {
  const bw = textWidth(text) * 0.75 + 10;
  r.roundRect(cx - bw / 2, y - 5, bw, 10, 3, C.navy, C.black);
  r.roundFrame(cx - bw / 2 + 0.5, y - 4.5, bw - 1, 9, 3, col, 0.75);
  drawText(r.g, text, cx, y - 3, col, { align: 'center', scale: 0.75 });
}

/** Ikona karty (×2) w ciemnym kole z poświatą i obręczą w kolorze kategorii. */
export function cardIcon(r: Renderer, icon: string, cx: number, cy: number, col: number, ring: number = col): void {
  r.withAlpha(0.2, () => r.circle(cx, cy, 20, col, true));
  r.withAlpha(0.6, () => r.circle(cx, cy, 16, C.black, true));
  r.circle(cx, cy, 17, ring);
  drawSprite(r.g, icon, cx, cy, { scale: 2 });
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

/**
 * Tytuł ekranu menu na wstędze (jak wstęga tytułu nakładek w `dim`): ciemny pas na całą szerokość ze złotymi liniami,
 * dopasowany do tytułu w `y`, żeby nie zachodził na zakładki i przyciski pod nim.
 */
export function titleBar(r: Renderer, text: string, y: number, col: number = C.yellow): void {
  r.withAlpha(0.9, () => r.rect(0, y - 3, W, 25, C.navy));
  r.withAlpha(0.6, () => { r.rect(0, y - 3, W, 0.5, C.gold); r.rect(0, y + 21.5, W, 0.5, C.gold); });
  drawText(r.g, text, W / 2, y, col, { align: 'center', scale: 2, outline: C.black });
}

/** Pasek (menu i nakładki): płaski jak w HUD-zie — ciemny tor, wypełnienie jasnym tonem rampy, podziałki co 10% przy długich paskach. */
export function bar(r: Renderer, x: number, y: number, w: number, h: number, frac: number, ramp: Ramp, bg: number = C.black): void {
  r.withAlpha(bg === C.black ? UI.trackA : 1, () => r.roundRect(x, y, w, h, Math.min(1.5, h / 2), bg));
  const f = w * Math.max(0, Math.min(1, frac));
  if (f > 0) r.roundRect(x, y, Math.max(1, f), h, Math.min(1.5, h / 2), ramp[Math.min(ramp.length - 1, 2)]);
  r.withAlpha(0.4, () => r.roundFrame(x, y, w, h, Math.min(1.5, h / 2), C.black, UI.line));
  if (w >= 60 && h >= 5) r.withAlpha(0.3, () => { for (let i = 1; i < 10; i++) r.rect(x + (w * i) / 10, y + 1, 0.5, h - 2, C.black); });
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
        // Podświetlenie co najmniej na wysokość litery z ogonkiem (ę, g, j), też przy gęstych listach.
        const hb = Math.max(h, LINE_H + 2), yb = y - (hb - h) / 2;
        ember(r, x, yb, w, hb, 3);
        r.withAlpha(0.9, () => r.roundRect(x, yb, w, hb, 3, C.dbrown, C.ddbrown));
        r.roundFrame(x, yb, w, hb, 3, C.gold, 0.75);
        r.withAlpha(0.5, () => r.rect(x + 3, yb + 0.5, w - 6, 0.5, C.yellow));
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
export function slot(r: Renderer, x: number, y: number, s: number, border: number = UI.border): void {
  r.withAlpha(0.7, () => r.roundRect(x, y, s, s, UI.radius, C.black));
  r.roundFrame(x, y, s, s, UI.radius, border, UI.line * 1.5);
}

/** Półprzezroczysta płytka pod tekst (czytelność na ruchliwym tle) — ta sama co w HUD-zie. */
export function plate(r: Renderer, x: number, y: number, w: number, h: number): void {
  tile(r, x, y, w, h);
}
