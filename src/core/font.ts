import { PAL } from './palette';
import { tr } from './i18n';

/**
 * Proporcjonalna czcionka pikselowa w stylu 16-bit: wielkie i małe litery, cyfry, interpunkcja.
 * Glif = wiersze '#'/'.' (szerokość wynika z długości wiersza). Wysokość wersalików 7 px,
 * x-height 5 px, wydłużenia dolne 2 px. Nad wersalikami są 2 wiersze na akcenty polskich liter,
 * które składane są z litery bazowej + akcentu (ą ć ę ń ó ś ź ż i wielkie).
 * Układ komórki: [2 wiersze akcentów][7 wierszy korpusu][2 wiersze wydłużeń] = 11 px.
 */
const G: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  J: ['..###', '...#.', '...#.', '...#.', '#..#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  Ł: ['#....', '#....', '#.#..', '##...', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  a: ['....', '....', '.##.', '...#', '.###', '#..#', '.###'],
  b: ['#...', '#...', '###.', '#..#', '#..#', '#..#', '###.'],
  c: ['....', '....', '.###', '#...', '#...', '#...', '.###'],
  d: ['...#', '...#', '.###', '#..#', '#..#', '#..#', '.###'],
  e: ['....', '....', '.##.', '#..#', '####', '#...', '.###'],
  f: ['..##', '.#..', '####', '.#..', '.#..', '.#..', '.#..'],
  g: ['....', '....', '.###', '#..#', '#..#', '#..#', '.###', '...#', '.##.'],
  h: ['#...', '#...', '###.', '#..#', '#..#', '#..#', '#..#'],
  i: ['.#.', '...', '##.', '.#.', '.#.', '.#.', '###'],
  j: ['..#', '...', '.##', '..#', '..#', '..#', '..#', '#.#', '.#.'],
  k: ['#...', '#...', '#..#', '#.#.', '##..', '#.#.', '#..#'],
  l: ['##.', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  ł: ['##.', '.#.', '.##', '##.', '.#.', '.#.', '###'],
  m: ['.....', '.....', '##.#.', '#.#.#', '#.#.#', '#.#.#', '#...#'],
  n: ['....', '....', '###.', '#..#', '#..#', '#..#', '#..#'],
  o: ['....', '....', '.##.', '#..#', '#..#', '#..#', '.##.'],
  p: ['....', '....', '###.', '#..#', '#..#', '#..#', '###.', '#...', '#...'],
  q: ['....', '....', '.###', '#..#', '#..#', '#..#', '.###', '...#', '...#'],
  r: ['...', '...', '#.#', '##.', '#..', '#..', '#..'],
  s: ['....', '....', '.###', '#...', '.##.', '...#', '###.'],
  t: ['.#..', '.#..', '####', '.#..', '.#..', '.#..', '..##'],
  u: ['....', '....', '#..#', '#..#', '#..#', '#..#', '.###'],
  v: ['.....', '.....', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  w: ['.....', '.....', '#...#', '#...#', '#.#.#', '#.#.#', '.#.#.'],
  x: ['....', '....', '#..#', '#..#', '.##.', '#..#', '#..#'],
  y: ['....', '....', '#..#', '#..#', '#..#', '#..#', '.###', '...#', '.##.'],
  z: ['....', '....', '####', '...#', '.##.', '#...', '####'],
  '0': ['.##.', '#..#', '#.##', '##.#', '#..#', '#..#', '.##.'],
  '1': ['.#.', '##.', '.#.', '.#.', '.#.', '.#.', '###'],
  '2': ['.##.', '#..#', '...#', '..#.', '.#..', '#...', '####'],
  '3': ['###.', '...#', '...#', '.##.', '...#', '...#', '###.'],
  '4': ['..##', '.#.#', '#..#', '####', '...#', '...#', '...#'],
  '5': ['####', '#...', '###.', '...#', '...#', '#..#', '.##.'],
  '6': ['.##.', '#...', '#...', '###.', '#..#', '#..#', '.##.'],
  '7': ['####', '...#', '..#.', '..#.', '.#..', '.#..', '.#..'],
  '8': ['.##.', '#..#', '#..#', '.##.', '#..#', '#..#', '.##.'],
  '9': ['.##.', '#..#', '#..#', '.###', '...#', '...#', '.##.'],
  '.': ['.', '.', '.', '.', '.', '.', '#'],
  ',': ['..', '..', '..', '..', '..', '..', '.#', '#.'],
  ':': ['.', '.', '#', '.', '.', '.', '#'],
  ';': ['..', '..', '.#', '..', '..', '..', '.#', '#.'],
  '!': ['#', '#', '#', '#', '#', '.', '#'],
  '?': ['.##.', '#..#', '...#', '..#.', '.#..', '....', '.#..'],
  '-': ['...', '...', '...', '###', '...', '...', '...'],
  '+': ['...', '...', '.#.', '###', '.#.', '...', '...'],
  '/': ['...#', '...#', '..#.', '.#..', '.#..', '#...', '#...'],
  '%': ['#...#', '#..#.', '...#.', '..#..', '.#...', '.#..#', '#...#'],
  '(': ['.#', '#.', '#.', '#.', '#.', '#.', '.#'],
  ')': ['#.', '.#', '.#', '.#', '.#', '.#', '#.'],
  '[': ['##', '#.', '#.', '#.', '#.', '#.', '##'],
  ']': ['##', '.#', '.#', '.#', '.#', '.#', '##'],
  "'": ['#', '#', '.', '.', '.', '.', '.'],
  '"': ['#.#', '#.#', '...', '...', '...', '...', '...'],
  '=': ['...', '...', '###', '...', '###', '...', '...'],
  '<': ['...#', '..#.', '.#..', '#...', '.#..', '..#.', '...#'],
  '>': ['#...', '.#..', '..#.', '...#', '..#.', '.#..', '#...'],
  '*': ['...', '...', '#.#', '.#.', '#.#', '...', '...'],
  '#': ['.....', '.#.#.', '#####', '.#.#.', '#####', '.#.#.', '.....'],
  '_': ['....', '....', '....', '....', '....', '....', '####'],
  '^': ['.#.', '#.#', '...', '...', '...', '...', '...'],
  ' ': ['..', '..', '..', '..', '..', '..', '..'],
};

type Accent = 'acute' | 'dot' | 'ogonek';
const POLISH: Record<string, [string, Accent]> = {
  Ą: ['A', 'ogonek'], Ć: ['C', 'acute'], Ę: ['E', 'ogonek'], Ń: ['N', 'acute'], Ó: ['O', 'acute'],
  Ś: ['S', 'acute'], Ź: ['Z', 'acute'], Ż: ['Z', 'dot'],
  ą: ['a', 'ogonek'], ć: ['c', 'acute'], ę: ['e', 'ogonek'], ń: ['n', 'acute'], ó: ['o', 'acute'],
  ś: ['s', 'acute'], ź: ['z', 'acute'], ż: ['z', 'dot'],
};

export const LINE_H = 12;
const TOP = 2;
const CELL_H = 11;

/** Wiersze korpusu glifu (bez akcentów). Nieznane znaki rysowane jako '?'. */
export function glyph(ch: string): string[] {
  const pl = POLISH[ch];
  return G[pl ? pl[0] : ch] ?? G['?'];
}

function glyphWidth(ch: string): number {
  return glyph(ch)[0].length;
}

const cache = new Map<string, HTMLCanvasElement>();

function glyphCanvas(ch: string, col: number): HTMLCanvasElement {
  const key = ch + col;
  let c = cache.get(key);
  if (c) return c;
  const rows = glyph(ch);
  const w = rows[0].length;
  c = document.createElement('canvas');
  c.width = w;
  c.height = CELL_H;
  const g = c.getContext('2d')!;
  g.fillStyle = PAL[col];
  rows.forEach((row, y) => { for (let x = 0; x < w; x++) if (row[x] === '#') g.fillRect(x, TOP + y, 1, 1); });
  const pl = POLISH[ch];
  if (pl) {
    const upper = ch === ch.toUpperCase();
    const top = upper ? 0 : TOP;
    const cx = Math.floor(w / 2);
    if (pl[1] === 'acute') { g.fillRect(cx + 1, top, 1, 1); g.fillRect(cx, top + 1, 1, 1); }
    if (pl[1] === 'dot') g.fillRect(cx, top + 1, 1, 1);
    if (pl[1] === 'ogonek') { g.fillRect(w - 2, TOP + 7, 1, 1); g.fillRect(w - 1, TOP + 8, 1, 1); }
  }
  cache.set(key, c);
  return c;
}

/** Szerokość napisu bez tłumaczenia (napis już w docelowym języku). */
function rawWidth(s: string, scale = 1): number {
  let w = 0;
  for (const ch of s) w += glyphWidth(ch) + 1;
  return Math.max(0, w - 1) * scale;
}

/** Szerokość napisu po przetłumaczeniu (core/i18n.ts) — tak, jak go narysuje drawText. */
export function textWidth(s: string, scale = 1): number {
  return rawWidth(tr(s), scale);
}

export interface TextOpts {
  align?: 'left' | 'center' | 'right';
  /** Kolor cienia przesuniętego o 1 px w prawo i w dół. */
  shadow?: number;
  /** Kolor pełnego obrysu (czytelność na ruchliwym tle). */
  outline?: number;
  scale?: number;
}

/** Rysuje tekst. `y` to górna krawędź linii (łącznie z miejscem na akcenty wersalików). */
/** Kierunki obrysu napisu (8 sąsiadów). */
const OUTLINE_DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]];

export function drawText(g: CanvasRenderingContext2D, s: string, x: number, y: number, col: number, o: TextOpts = {}): void {
  s = tr(s);
  const scale = o.scale ?? 1;
  const w = rawWidth(s, scale);
  let sx = Math.round(o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x);
  const sy = Math.round(y);
  for (const ch of s) {
    const gw = glyphWidth(ch);
    if (ch !== ' ') {
      const dw = gw * scale, dh = CELL_H * scale;
      if (o.outline !== undefined) {
        const oc = glyphCanvas(ch, o.outline);
        // Obrys pół piksela logicznego (bufor ma więcej pikseli): cieńszy i czystszy niż pełny piksel.
        const o2 = 0.5 * scale;
        for (const [dx, dy] of OUTLINE_DIRS) g.drawImage(oc, sx + dx * o2, sy + dy * o2, dw, dh);
      }
      if (o.shadow !== undefined) g.drawImage(glyphCanvas(ch, o.shadow), sx + scale, sy + scale, dw, dh);
      g.drawImage(glyphCanvas(ch, col), sx, sy, dw, dh);
    }
    sx += (gw + 1) * scale;
  }
}

const labels = new Map<string, HTMLCanvasElement>();

/**
 * Napis z obrysem wyśrodkowany w (x, y) z gotowego obrazka — jedno rysowanie zamiast pięciu na znak.
 * Dla często powtarzanych krótkich napisów (liczby obrażeń); pamięć podręczna czyszczona po 500 wpisach.
 */
export function drawLabel(g: CanvasRenderingContext2D, s: string, x: number, y: number, col: number, outline: number): void {
  s = tr(s);
  const key = `${s}|${col}|${outline}`;
  let c = labels.get(key);
  if (!c) {
    if (labels.size > 500) labels.clear();
    c = document.createElement('canvas');
    c.width = textWidth(s) + 2;
    c.height = CELL_H + 2;
    drawText(c.getContext('2d')!, s, 1, 1, col, { outline });
    labels.set(key, c);
  }
  g.drawImage(c, Math.round(x - c.width / 2), Math.round(y) - 1);
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
