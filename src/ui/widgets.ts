import { W, H, SW, OX, type Renderer } from '../core/renderer';
import type { Input } from '../core/input';
import { C, PAL, type Ramp } from '../core/palette';
import { drawText, wrapText, textWidth, LINE_H, smallS, DESC, descS, descLH } from '../core/font';
import { sfx } from '../core/audio';
import { UI, tile } from './theme';
import { drawSprite } from '../gfx/sprites';

/**
 * Karta (0.64, styl kart z paneli BoardUI): większe zaokrąglenie, miękki cień pod spodem, płaskie wypełnienie, cienka ramka
 * i jaśniejsza linia przy górnej krawędzi. Kolor ramki tylko ze znaczeniem (rzadkość, stan), domyślnie stalowy.
 */
export function panel(r: Renderer, x: number, y: number, w: number, h: number, accent: number = UI.border, fill: number = C.navy): void {
  x = Math.round(x); y = Math.round(y);
  const rad = UI.radius + 2;
  r.withAlpha(0.3, () => r.roundRect(x, y + 2, w, h, rad, C.black));
  r.withAlpha(0.95, () => r.roundRect(x, y, w, h, rad, fill));
  r.withAlpha(0.5, () => r.rect(x + rad, y + 0.75, w - rad * 2, 0.5, C.dgray));
  r.roundFrame(x, y, w, h, rad, accent, accent === UI.border ? 0.75 : 1);
}

/**
 * Pigułka statusu (0.64, BoardUI: „Shipped”, „Delivery failed”): zaokrąglona plakietka z tłem w kolorze statusu (przygaszonym)
 * i napisem w tym kolorze. Zwraca szerokość (pigułki w rzędzie).
 */
export function pill(r: Renderer, x: number, y: number, text: string, col: number, align: 'left' | 'center' | 'right' = 'left'): number {
  const sc = smallS(), w = Math.round(textWidth(text) * sc + 8), h = sc > 0.75 ? 11 : 10;
  const px = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  r.withAlpha(0.22, () => r.roundRect(px, y, w, h, h / 2, col));
  r.withAlpha(0.8, () => r.roundFrame(px, y, w, h, h / 2, col, 0.5));
  drawText(r.g, text, px + w / 2, y + 0.5, col, { align: 'center', scale: sc });
  return w;
}

/** Kafelek liczby (BoardUI „stat card”): mała przygaszona etykieta u góry, duża wartość pod nią, opcjonalny dopisek po prawej. */
export function statTile(r: Renderer, x: number, y: number, w: number, h: number, labelText: string, value: string, col: number = C.white, note?: string): void {
  panel(r, x, y, w, h);
  drawText(r.g, labelText, x + 6, y + 4, C.lavender, { scale: Math.min(smallS(), (w - 10) / Math.max(1, textWidth(labelText))) });
  drawText(r.g, value, x + 6, y + 13, col, { shadow: C.black, scale: textWidth(value) > w - 10 ? 0.75 : 1 });
  if (note) drawText(r.g, note, x + w - 5, y + 15, C.lavender, { align: 'right', scale: smallS() });
}

/**
 * Zakładki segmentowe (BoardUI „segmented control”): ciemny tor, aktywna zakładka jako jaśniejsza pigułka ze złotą kreską
 * pod spodem. Prostokąt zakładki do kliknięć: `tabRect` (te same liczby co przy rysowaniu).
 */
export function tabs(r: Renderer, x: number, y: number, w: number, h: number, labels: string[], active: number): void {
  r.withAlpha(0.6, () => r.roundRect(x, y, w, h, h / 2, C.black));
  labels.forEach((t, i) => {
    const [tx, ty, tw, th] = tabRect(x, y, w, h, labels.length, i), on = i === active, hot = hovered(tx, ty, tw, th);
    if (on) { r.roundRect(tx, ty, tw, th, th / 2, C.slate); r.withAlpha(0.9, () => r.rect(tx + th / 2, ty + th - 1, tw - th, 1, C.gold)); }
    else if (hot) r.withAlpha(0.5, () => r.roundRect(tx, ty, tw, th, th / 2, C.slate));
    const sc = Math.min(1, (tw - 6) / Math.max(1, textWidth(t)));
    drawText(r.g, t, tx + tw / 2, ty + Math.round((th - 12 * sc) / 2), on ? C.white : hot ? C.lgray : C.lavender, { align: 'center', scale: sc });
  });
}

export function tabRect(x: number, y: number, w: number, h: number, n: number, i: number): [number, number, number, number] {
  const tw = (w - 4) / n;
  return [x + 2 + i * tw, y + 1.5, tw, h - 3];
}

/** Pierścień-wskaźnik (BoardUI „progress ring”): tor w kolorze stali, łuk od góry zgodnie z ruchem wskazówek, zaokrąglone końce. */
export function ring(r: Renderer, cx: number, cy: number, R: number, w: number, frac: number, col: number): void {
  const g = r.g;
  g.lineWidth = w; g.lineCap = 'round';
  g.strokeStyle = PAL[C.slate]; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();
  if (frac > 0.005) { g.strokeStyle = PAL[col]; g.beginPath(); g.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, frac)); g.stroke(); }
  g.lineCap = 'butt';
}

/** Nagłówek sekcji w oknie: mała przygaszona etykieta i cienka linia do prawej krawędzi. */
export function sectionTitle(r: Renderer, text: string, x: number, y: number, w: number): void {
  drawText(r.g, text, x, y, C.lavender, { scale: smallS() });
  const tw = textWidth(text) * smallS() + 4;
  if (w > tw + 4) r.withAlpha(0.6, () => r.rect(x + tw, y + 4, w - tw, 0.5, C.slate));
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

/** Treść okienka podpowiedzi (`drawTip`): tytuł w kolorze, drobny dopisek po prawej i linie opisu. */
export interface Tip {
  title: string;
  col: number;
  tag?: string;
  lines?: [string, number][];
}

/**
 * Okienko z opisem rzeczy wskazanej myszą albo dotknięciem (ikona karty, przedmiotu, broni): nad prostokątem
 * kotwicy, a gdy brak miejsca — pod nim; zawsze w granicach ekranu. Linie opisu w rozmiarze tekstu opisów (DESC).
 */
export function drawTip(r: Renderer, t: Tip, ax: number, ay: number, aw: number, ah: number, w = 200): void {
  const tagW = t.tag ? textWidth(t.tag) * smallS() + 10 : 0;
  w = Math.min(W - 8, Math.max(w, textWidth(t.title) + tagW + 12));
  const tw = (w - 12) / descS(), lh = descLH();
  const rows: [string, number][] = [];
  for (const [text, col] of t.lines ?? []) for (const l of wrapText(text, tw)) rows.push([l, col]);
  const h = 17 + rows.length * lh + (rows.length ? 3 : 0);
  let y = ay - h - 3;
  if (y < 4) y = Math.min(H - h - 4, ay + ah + 3);
  const x = Math.max(4, Math.min(W - w - 4, ax + aw / 2 - w / 2));
  panel(r, x, y, w, h);
  drawText(r.g, t.title, x + 6, y + 4, t.col, { shadow: C.black });
  if (t.tag) drawText(r.g, t.tag, x + w - 6, y + 5, C.lavender, { align: 'right', scale: smallS() });
  rows.forEach(([l, col], i) => drawText(r.g, l, x + 6, y + 17 + i * lh, col, DESC));
}

export function inside(px: number, py: number, x: number, y: number, w: number, h: number): boolean {
  return px >= x && px < x + w && py >= y && py < y + h;
}

/**
 * Wskaźnik myszy do podświetleń przy rysowaniu (main.ts ustawia go przed każdą klatką; dotyk/pad = poza ekranem).
 * `hit`: w tej klatce mysz jest nad czymś klikalnym — main.ts zmienia wtedy kursor na rączkę.
 */
/** Mysz w tej klatce (main.ts): pozycja, czy coś klikalnego jest pod kursorem, czy przycisk myszy jest wciśnięty. */
export const pointer = { x: -1, y: -1, hit: false, down: false };

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

/**
 * Przycisk (0.64, BoardUI): zaokrąglony; wybrany (główna akcja) wypełniony kolorem akcentu z ciemnym napisem, zwykły ciemny
 * z cienką ramką, pod myszą jaśniejszy.
 */
export function button(r: Renderer, x: number, y: number, w: number, h: number, label: string, o: ButtonOpts = {}): void {
  const hot = hovered(x, y, w, h), acc = o.accent ?? C.gold, rad = UI.radius + 1;
  // Wciśnięty pod kursorem: przycisk „siada” o piksel (napis i ramka niżej, ciemniejsze tło).
  if (hot && pointer.down) { y += 1; h -= 1; }
  if (o.active && acc === C.gold) ember(r, x, y, w, h);
  r.withAlpha(o.active ? 1 : 0.9, () => r.roundRect(x, y, w, h, rad, o.active ? acc : hot ? C.slate : C.navy));
  if (!o.active) r.roundFrame(x, y, w, h, rad, hot ? C.lavender : UI.border, UI.line * 1.5);
  if (o.pulse && !o.active) r.withAlpha(0.35 + 0.35 * Math.sin(performance.now() / 160), () => r.roundFrame(x - 1, y - 1, w + 2, h + 2, rad + 1, C.yellow, 0.75));
  const sc = o.scale ?? 1, ty = y + Math.round((h - 12 * sc) / 2);
  if (o.active) drawText(r.g, label, x + w / 2, ty, o.col ?? C.navy, { align: 'center', scale: sc });
  else drawText(r.g, label, x + w / 2, ty, o.col ?? (hot ? C.white : C.lgray), { align: 'center', shadow: C.black, scale: sc });
}

/**
 * Wspólny przycisk Wstecz nakładek i podekranów (bronie, synergie, pomoc, księga, kolekcja, ekwipunek, sklep, kowadło):
 * zawsze w lewym górnym rogu, w tym samym miejscu i rozmiarze. Esc / pad zamykają ekran jak dotąd.
 */
export const BACK_BTN = [6, 8, 60, 16] as const;
/** Losowanie klawiszem (R = też ultimate) dopiero po tylu ms od pojawienia się kart (0.63, playtest: R wciśnięte w walce zużywało losowania). */
export const REROLL_GUARD = 700;

export function backButton(r: Renderer): void {
  button(r, ...BACK_BTN, 'Wstecz [Esc]');
}

/** Klik / dotknięcie w przycisk Wstecz w tej klatce. */
export function backHit(input: Input): boolean {
  return input.pressed('click') && inside(input.mouse.x, input.mouse.y, ...BACK_BTN);
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
  const bw = textWidth(text) * smallS() + 10;
  r.roundRect(cx - bw / 2, y - 5, bw, 10, 3, C.navy, C.black);
  r.roundFrame(cx - bw / 2 + 0.5, y - 4.5, bw - 1, 9, 3, col, 0.75);
  drawText(r.g, text, cx, y - 3, col, { align: 'center', scale: smallS() });
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
  r.withAlpha(0.65, () => r.cover(C.black));
  r.withAlpha(0.8, () => r.rect(-OX, 4, SW, 30, C.black));
  r.withAlpha(0.6, () => { r.rect(-OX, 4, SW, 0.5, C.gold); r.rect(-OX, 33.5, SW, 0.5, C.gold); });
}

/**
 * Tytuł ekranu menu na wstędze (jak wstęga tytułu nakładek w `dim`): ciemny pas na całą szerokość ze złotymi liniami,
 * dopasowany do tytułu w `y`, żeby nie zachodził na zakładki i przyciski pod nim.
 */
export function titleBar(r: Renderer, text: string, y: number, col: number = C.yellow): void {
  r.withAlpha(0.9, () => r.rect(-OX, y - 3, SW, 25, C.navy));
  r.withAlpha(0.6, () => { r.rect(-OX, y - 3, SW, 0.5, C.gold); r.rect(-OX, y + 21.5, SW, 0.5, C.gold); });
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

/**
 * Dwuetapowe potwierdzenie nieodwracalnej akcji (prestiż, porzucenie / poddanie runu).
 * Pierwsze naciśnięcie uzbraja; drugie wykonuje dopiero po `minMs` (podwójne dotknięcie / drgnięcie palca
 * nie przechodzi — za szybkie naciśnięcie tylko odnawia uzbrojenie), a uzbrojenie wygasa po `ttlMs`.
 */
export class Confirm {
  private at = -1;

  constructor(private readonly minMs = 350, private readonly ttlMs = 3000) {}

  /** Czy uzbrojone (etykieta „Na pewno?”); po wygaśnięciu wraca do zwykłej. */
  get armed(): boolean {
    return this.at >= 0 && performance.now() - this.at < this.ttlMs;
  }

  /** Naciśnięcie: `true` = wykonaj akcję. */
  press(): boolean {
    const now = performance.now();
    if (this.armed && now - this.at > this.minMs) { this.at = -1; return true; }
    this.at = now;
    return false;
  }

  reset(): void {
    this.at = -1;
  }
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
  /** Dotyk: pierwsze dotknięcie niezaznaczonej pozycji tylko ją zaznacza (podgląd opisu), drugie wykonuje.
   *  Lewa/prawa część suwaka działa od razu. Włączane tylko tam, gdzie pod listą jest opis (Ustawienia). */
  previewOnTouch = false;
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
        const item = this.items[i];
        const slider = (item.left && m.x < x + w / 3) || (item.right && m.x > x + (w * 2) / 3);
        if (this.previewOnTouch && input.lastDevice === 'touch' && this.sel !== i && !slider) {
          this.sel = i;
          sfx.play('hover');
          continue;
        }
        this.sel = i;
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
        // Aktywny wiersz (0.64, BoardUI: aktywna pozycja menu bocznego): jaśniejsze tło i złoty pasek po lewej.
        r.withAlpha(0.95, () => r.roundRect(x, yb, w, hb, 3, C.slate));
        r.roundRect(x + 2, yb + 3, 2, hb - 6, 1, C.gold);
      }
      const ty = y + Math.floor((h - LINE_H) / 2) + 1;
      if (it.value) {
        drawText(r.g, it.label(), x + 10, ty, on ? C.white : C.lgray, { shadow: C.black });
        drawText(r.g, it.left ? `< ${it.value()} >` : it.value(), x + w - 8, ty, on ? C.yellow : C.cyan, { align: 'right', shadow: C.black });
        return;
      }
      const label = it.left ? `< ${it.label()} >` : it.label();
      drawText(r.g, label, this.cx, ty, on ? C.white : C.lgray, { align: 'center', shadow: C.black });
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

/**
 * Liczba w wierszu (0.64, BoardUI „inline stat”): mała przygaszona etykieta i wartość pełnym rozmiarem obok, w jednej
 * linii (tam, gdzie nie ma miejsca na kafelek). `align: 'right'` = prawa krawędź w `x`. Zwraca szerokość.
 */
export function inlineStat(r: Renderer, x: number, y: number, labelText: string, value: string, col: number = C.white, align: 'left' | 'right' = 'left'): number {
  const sc = smallS(), lw = textWidth(labelText) * sc, w = lw + 4 + textWidth(value);
  const x0 = align === 'right' ? x - w : x;
  drawText(r.g, labelText, x0, y + 2, C.lavender, { scale: sc });
  drawText(r.g, value, x0 + lw + 4, y, col, { shadow: C.black });
  return w;
}

/**
 * Zakładki segmentowe na ciemnym tle ekranu menu (r.clear(C.black)): pod torem `tabs` granatowa podkładka z cienką ramką,
 * żeby tor był widoczny. Kliknięcia jak w `tabs`: `tabRect` z tymi samymi liczbami.
 */
export function screenTabs(r: Renderer, x: number, y: number, w: number, h: number, labels: string[], active: number): void {
  r.roundRect(x, y, w, h, h / 2, C.navy);
  r.roundFrame(x, y, w, h, h / 2, UI.border, 0.75);
  tabs(r, x, y, w, h, labels, active);
}

/**
 * Wiersz tabeli (0.64, BoardUI: listy z wyrównanymi kolumnami): co drugi wiersz z delikatnym tłem, wiersz pod myszą
 * jaśniejszy (bez rączki kursora: wiersz nie jest klikalny). `clip`: widoczny obszar przewijanej listy (hover tylko w nim).
 * Zwraca, czy mysz jest nad wierszem.
 */
export function rowBg(r: Renderer, x: number, y: number, w: number, h: number, i: number, clip?: readonly [number, number, number, number]): boolean {
  const hot = inside(pointer.x, pointer.y, x, y, w, h) && (!clip || inside(pointer.x, pointer.y, ...clip));
  if (hot) r.withAlpha(0.7, () => r.roundRect(x, y, w, h, 2, C.slate));
  else if (i % 2 === 0) r.withAlpha(0.3, () => r.roundRect(x, y, w, h, 2, C.black));
  return hot;
}

/** Nagłówek kolumn tabeli: ciemny pas z przygaszonymi etykietami; kolumna = [napis, x, wyrównanie]. */
export function tableHead(r: Renderer, x: number, y: number, w: number, cols: [string, number, 'left' | 'right'][]): void {
  r.withAlpha(0.55, () => r.roundRect(x, y, w, 11, 2, C.black));
  for (const [t, cx, align] of cols) drawText(r.g, t, cx, y + 1.5, C.lavender, { align, scale: smallS() });
}
