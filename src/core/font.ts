import { PAL } from './palette';
import { tr } from './i18n';

/**
 * Czcionka gry: gładka, zaokrąglona Nunito (licencja OFL, pakiet @fontsource/nunito, ładowana w main.ts) rysowana wektorowo
 * na buforze K× — ostre krawędzie przy każdej skali okna. Rozmiar dobrany do dawnej czcionki pikselowej: linia 12 px,
 * wersaliki ok. 6 px, linia bazowa 8,5 px poniżej górnej krawędzi (nad nią miejsce na akcenty wersalików).
 * Większe napisy (scale ≥ 2: tytuły) w grubszej odmianie.
 */
export const LINE_H = 12;
const FONT_PX = 8.5;
const BASELINE = 8.5;
const FAMILY = '"Nunito", "Segoe UI", "Helvetica Neue", Arial, sans-serif';

const fontOf = (scale: number) => `${scale >= 2 ? 800 : 700} ${FONT_PX * scale}px ${FAMILY}`;

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
  return rawWidth(tr(s), scale);
}

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
  s = tr(s);
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
 * Dla często powtarzanych krótkich napisów (liczby obrażeń); pamięć podręczna czyszczona po 500 wpisach.
 */
export function drawLabel(g: CanvasRenderingContext2D, s: string, x: number, y: number, col: number, outline: number): void {
  s = tr(s);
  const key = `${s}|${col}|${outline}`;
  let c = labels.get(key);
  if (!c) {
    if (labels.size > 500) labels.clear();
    c = document.createElement('canvas');
    c.width = Math.ceil((rawWidth(s) + 4) * LABEL_RES);
    c.height = (LINE_H + 2) * LABEL_RES;
    const cg = c.getContext('2d')!;
    cg.scale(LABEL_RES, LABEL_RES);
    drawText(cg, s, 2, 1, col, { outline });
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
