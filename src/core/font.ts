import { PAL } from './palette';
import { tr } from './i18n';
import { keyGlyphs } from './input';

/**
 * Czcionka gry: pikselowa, wąska Jersey 10 (licencja OFL, pakiet @fontsource/jersey-10, ładowana w main.ts, z polskimi znakami)
 * rysowana wektorowo na buforze K× — pasuje do pixel artu i jest ostra przy każdej skali okna. Ma jedną grubość (400).
 * Rozmiar dobrany do dawnej czcionki pikselowej: linia 12 px, wersaliki ok. 6 px, linia bazowa 8,5 px poniżej górnej krawędzi (nad nią miejsce na akcenty wersalików).
 */
export const LINE_H = 12;
const FONT_PX = 11.5;
const BASELINE = 8.5;
const FAMILY = '"Jersey 10", "Segoe UI", "Helvetica Neue", Arial, sans-serif';

const fontOf = (scale: number) => `${FONT_PX * scale}px ${FAMILY}`;

/** Pomiar szerokości: osobny kontekst i pamięć podręczna (czyszczona po wczytaniu czcionki, `resetFontCache`). */
const measure = document.createElement('canvas').getContext('2d')!;
const widths = new Map<string, number>();

export function resetFontCache(): void {
  widths.clear();
  labels.clear();
}

/** Szerokość napisu bez tłumaczenia (napis już w docelowym języku). */
function rawWidth(s: string, scale = 1): number {
  const key = `${scale >= 2 ? 'b' : 'n'}${s}`;
  let w = widths.get(key);
  if (w === undefined) {
    if (widths.size > 8000) widths.clear();
    measure.font = fontOf(scale >= 2 ? 2 : 1);
    w = measure.measureText(s).width / (scale >= 2 ? 2 : 1);
    widths.set(key, w);
  }
  return w * scale;
}

/** Szerokość napisu po przetłumaczeniu (core/i18n.ts) — tak, jak go narysuje drawText. */
export function textWidth(s: string, scale = 1): number {
  return rawWidth(keyGlyphs(tr(s)), scale);
}

/**
 * Teksty opisowe (umiejętności, karty, przedmioty, mapa, pauza, kolekcja): skala i odstęp linii zależne od ustawienia
 * „Text size” — Normal rysuje je pomniejszone (0.75), Large w pełnym rozmiarze (ekrany przewijają albo dzielą treść na strony).
 * Drobne etykiety (LV, klawisze, liczniki, podpowiedzi) mają skalę smallS(): 0.75 przy Normal, 0.85 przy Large
 * (żeby na telefonie najmniejszy tekst dało się przeczytać).
 */
let descScale = 0.75, smallScale = 0.75;
export function setTextSize(large: boolean): void {
  descScale = large ? 1 : 0.75;
  smallScale = large ? 0.85 : 0.75;
}
/** Skala tekstu opisowego. */
export const descS = (): number => descScale;
/** Skala drobnych etykiet. */
export const smallS = (): number => smallScale;
/** Odstęp linii tekstu opisowego. */
export const descLH = (): number => (descScale >= 1 ? 11 : 9);
/** Opcje rysowania tekstu opisowego (świeże przy każdym wywołaniu, bo skala zależy od ustawienia). */
export const DESC: { readonly scale: number } = { get scale() { return descScale; } };

export interface TextOpts {
  align?: 'left' | 'center' | 'right';
  /** Kolor cienia przesuniętego w prawo i w dół. */
  shadow?: number;
  /** Kolor pełnego obrysu (czytelność na ruchliwym tle). */
  outline?: number;
  scale?: number;
}

/** Rysuje tekst. `y` to górna krawędź linii (łącznie z miejscem na akcenty wersalików). */
export function drawText(g: CanvasRenderingContext2D, s: string, x: number, y: number, col: number, o: TextOpts = {}): void {
  s = keyGlyphs(tr(s));
  if (!s) return;
  const scale = o.scale ?? 1;
  const w = rawWidth(s, scale);
  const sx = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
  const by = y + BASELINE * scale;
  g.font = fontOf(scale);
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  if (o.outline !== undefined) {
    g.strokeStyle = PAL[o.outline];
    g.lineJoin = 'round';
    g.lineWidth = Math.max(0.9, 1.3 * scale);
    g.strokeText(s, sx, by);
  }
  if (o.shadow !== undefined) {
    g.fillStyle = PAL[o.shadow];
    g.fillText(s, sx + 0.75 * scale, by + 0.75 * scale);
  }
  g.fillStyle = PAL[col];
  g.fillText(s, sx, by);
}

const labels = new Map<string, HTMLCanvasElement>();
/** Rozdzielczość gotowych napisów (piksele obrazu na piksel logiczny): ostre także po powiększeniu. */
const LABEL_RES = 4;

/**
 * Napis z obrysem wyśrodkowany w (x, y) z gotowego obrazka — jedno rysowanie zamiast tekstu wektorowego co klatkę.
 * Dla często powtarzanych krótkich napisów (liczby obrażeń, `scale` dla krytyków); pamięć podręczna czyszczona po 500 wpisach.
 */
export function drawLabel(g: CanvasRenderingContext2D, s: string, x: number, y: number, col: number, outline: number, scale = 1): void {
  s = tr(s);
  const key = `${s}|${col}|${outline}|${scale}`;
  let c = labels.get(key);
  if (!c) {
    if (labels.size > 500) labels.clear();
    c = document.createElement('canvas');
    c.width = Math.ceil((rawWidth(s, scale) + 4) * LABEL_RES);
    c.height = Math.ceil((LINE_H * scale + 2) * LABEL_RES);
    const cg = c.getContext('2d')!;
    cg.scale(LABEL_RES, LABEL_RES);
    drawText(cg, s, 2, 1, col, { outline, scale });
    labels.set(key, c);
  }
  const w = c.width / LABEL_RES, h = c.height / LABEL_RES;
  g.drawImage(c, Math.round(x - w / 2), Math.round(y) - 1, w, h);
}

/** Łamie tekst (najpierw tłumaczony w całości) na linie o szerokości max `maxW` pikseli, po słowach. */
export function wrapText(s: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of tr(s).split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const cand = line ? `${line} ${word}` : word;
      if (rawWidth(cand) <= maxW || !line) line = cand;
      else { out.push(line); line = word; }
    }
    out.push(line);
  }
  return out;
}
