import type { Renderer } from '../core/renderer';
import { C } from '../core/palette';
import { drawText, textWidth, type TextOpts } from '../core/font';

/**
 * Wspólny styl HUD-u: grafitowo-granatowe płytki z lekką przezroczystością, cienka ramka (pół piksela logicznego),
 * płaskie paski bez połysku i ograniczone akcenty: czerwony = życie i zagrożenia, turkus = doświadczenie,
 * złoto = nagrody i ulepszenia. Wszystkie rozmiary i odstępy HUD-u są tutaj; układ liczy się w ui/hud.ts.
 */
export const UI = {
  /** Margines od krawędzi ekranu i odstęp między grupami. */
  edge: 4,
  gap: 2,
  /** Grubość ramek (piksele logiczne; bufor ma K× więcej pikseli). */
  line: 0.5,
  radius: 2,
  /** Tło płytek i jego krycie. */
  fill: C.navy,
  fillA: 0.62,
  /** Ramka płytek i jej krycie. */
  border: C.slate,
  borderA: 0.9,
  /** Tło torów pasków. */
  track: C.black,
  trackA: 0.6,
  text: C.lgray,
  textHi: C.white,
  textDim: C.lavender,
  life: C.red,
  /** Ślad świeżo utraconego życia: jasny, żeby trafienie było widać od razu. */
  lifeTrail: C.cream,
  xp: C.cyan,
  reward: C.gold,
  threat: C.red,
  /** Rozmiary elementów. */
  xpH: 2,
  card: { w: 108, h: 31, portrait: 25 },
  slot: 18,
  ability: 24,
  abilityGap: 3,
  minimap: { w: 70, h: 44 },
  synIcon: 12,
} as const;

/** Małe napisy HUD (3/4 rozmiaru, czarny obrys). */
export const SMALL: TextOpts = { scale: 0.75, outline: C.black };
export const OUT: TextOpts = { outline: C.black };

/** Płytka HUD: lekko przezroczyste wypełnienie i cienka ramka. `accent` zmienia kolor ramki (wyróżnienie). */
export function tile(r: Renderer, x: number, y: number, w: number, h: number, accent?: number, fillA: number = UI.fillA): void {
  r.withAlpha(fillA, () => r.roundRect(x, y, w, h, UI.radius, UI.fill));
  r.withAlpha(accent === undefined ? UI.borderA : 1, () => r.roundFrame(x, y, w, h, UI.radius, accent ?? UI.border, UI.line));
}

/**
 * Płaski pasek: ciemny tor, wypełnienie jednym kolorem i opcjonalny „ślad” (np. świeżo utracone życie w jaśniejszym
 * kolorze, który dogania wartość). Bez gradientów i połysku.
 */
export function meter(r: Renderer, x: number, y: number, w: number, h: number, frac: number, col: number, trail = 0, trailCol: number = C.white): void {
  const f = Math.max(0, Math.min(1, frac)), t = Math.max(f, Math.min(1, trail));
  r.withAlpha(UI.trackA, () => r.roundRect(x, y, w, h, Math.min(1, h / 2), UI.track));
  if (t > f) r.withAlpha(0.7, () => r.roundRect(x + w * f, y, w * (t - f), h, 0, trailCol));
  if (f > 0) r.roundRect(x, y, Math.max(1, w * f), h, Math.min(1, h / 2), col);
  r.withAlpha(0.35, () => r.roundFrame(x, y, w, h, Math.min(1, h / 2), C.black, UI.line));
}

/** Gniazdo na ikonę: ciemne tło, ramka tylko gdy podano kolor (puste gniazda bez obramowania). */
export function iconSlot(r: Renderer, x: number, y: number, s: number, border?: number, fillA = 0.55): void {
  r.withAlpha(fillA, () => r.roundRect(x, y, s, s, UI.radius, C.black));
  if (border !== undefined) r.roundFrame(x, y, s, s, UI.radius, border, UI.line);
}

/** Mały znacznik z liczbą w rogu ikony (poziom), na ciemnym tle — nie zasłania środka ikony. */
export function cornerTag(r: Renderer, text: string, x: number, y: number, col: number = UI.textHi): void {
  const w = textWidth(text) * 0.75 + 2;
  r.withAlpha(0.75, () => r.roundRect(x - w, y - 6, w, 6, 1, C.black));
  drawText(r.g, text, x - 1, y - 7, col, { align: 'right', scale: 0.75 });
}

/** Etykieta-pigułka (wydarzenia, kombo): płytka z napisem; `a` = krycie (animacja pojawienia się i wygaszenia). */
export function label(r: Renderer, text: string, cx: number, y: number, col: number, a = 1): void {
  if (a <= 0) return;
  const w = textWidth(text) * 0.75 + 8;
  r.withAlpha(a, () => {
    tile(r, cx - w / 2, y, w, 9, col, 0.7);
    drawText(r.g, text, cx, y + 0.5, col, { align: 'center', ...SMALL });
  });
}

/** Wygładzanie wartości w czasie (animacje pasków): zbliża `cur` do `target` z szybkością `rate` na sekundę. */
export function approach(cur: number, target: number, dt: number, rate: number): number {
  return cur + (target - cur) * Math.min(1, dt * rate);
}
