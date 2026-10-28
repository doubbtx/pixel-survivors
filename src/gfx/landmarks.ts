import { C, RAMP } from '../core/palette';
import type { Biome } from '../data/levels';
import { Painter, HI } from './painter';

/**
 * Charakterystyczne kompozycje terenu (czysto dekoracyjne, bez kolizji): fragment bramy, zniszczony obelisk,
 * pozostałości obozowiska, niskie ruiny murów i powalone kolumny. Kamień w kolorach biomu, porośnięty mchem.
 * Sprite'y są niskie i szerokie (leżą na ziemi), żeby nie udawały przeszkód, przez które nie da się przejść.
 */
export const LANDMARK_KINDS = 5;

/** Mech: drobne plamki w dwóch odcieniach wzdłuż odcinka. */
function moss(p: Painter, b: Biome, x0: number, y0: number, x1: number, y1: number, n: number): void {
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t + ((i * 7) % 3) * 0.4;
    p.spot(x, y, b.tuft[0]).dot(x + 0.4, y - 0.3, b.tuft[1]);
  }
}

/** Kamienny blok z fazą i rysą. */
function brick(p: Painter, ramp: readonly number[], x: number, y: number, w: number, h: number, crack = false): void {
  p.block(x, y, w, h, ramp);
  if (crack) p.thin(x + w * 0.3, y + 0.5, x + w * 0.5, y + h - 0.5, ramp[0]);
}

function gate(p: Painter, b: Biome): void {
  const s = b.stone;
  // Gruz u podstawy.
  for (const [x, y, w] of [[4, 40, 6], [11, 42, 4], [44, 41, 5], [52, 39, 6]] as const) brick(p, s, x, y, w, 3);
  // Lewy filar z ocalałym fragmentem łuku.
  for (let k = 0; k < 6; k++) brick(p, s, 10, 36 - k * 5, 9, 5, k === 2);
  p.polyShade([[10, 6], [19, 6], [27, 2], [33, 4], [26, 9], [19, 11]], s);
  p.thin(19, 6, 27, 2, s[3]);
  // Prawy filar złamany nisko.
  for (let k = 0; k < 3; k++) brick(p, s, 38, 36 - k * 5, 9, 5, k === 1);
  p.polyShade([[38, 26], [43, 23], [47, 26]], s);
  // Bluszcz na lewym filarze i mech.
  for (let k = 0; k < 8; k++) p.spot(11 + (k % 3) * 2.5, 12 + k * 3, k % 2 ? b.tuft[1] : b.tuft[0]);
  moss(p, b, 38, 35.5, 47, 35.5, 4);
}

function obelisk(p: Painter, b: Biome): void {
  const s = b.stone;
  brick(p, s, 3, 34, 18, 5);
  p.polyShade([[6, 34], [8, 10], [12, 6], [15, 9], [18, 34]], s);
  // Runy (przygaszone, nie świecą — to dekoracja, nie cel).
  for (const y of [14, 19, 24, 29]) p.thin(10.5, y, 13.5, y + 0.5, s[0]).dot(12, y + 1.5, s[0]);
  // Odłamany wierzchołek leży obok.
  p.polyShade([[22, 38], [26, 33], [31, 34], [29, 39]], s);
  moss(p, b, 4, 33.5, 20, 33.5, 6);
  moss(p, b, 7, 22, 8, 31, 3);
}

function camp(p: Painter, b: Biome): void {
  // Krąg kamieni z popiołem i zwęglonymi polanami.
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2, x = 20 + Math.cos(a) * 7, y = 24 + Math.sin(a) * 4;
    p.sphere(x, y, 1.8, 1.4, b.stone);
  }
  p.sphere(20, 24, 5, 2.6, [C.black, C.slate, C.dgray, C.dgray]);
  p.stroke(16, 25, 23, 22, C.ddbrown).stroke(17, 22, 24, 25, C.black).dot(19, 23, C.rust).dot(21, 24, C.orange);
  // Kłoda do siedzenia, podarty tobołek, garnek.
  p.block(30, 25, 14, 4, RAMP.wood).sphere(44, 27, 1.2, 2, [C.dbrown, C.brown, C.clay, C.tan]).thin(32, 26.5, 41, 26.5, C.ddbrown);
  p.polyShade([[2, 14], [12, 12], [14, 17], [4, 19]], [C.dred, C.rust, C.clay, C.tan]);
  p.thin(4, 15, 12, 14, C.ddbrown);
  p.sphere(30, 15, 3, 2.4, RAMP.night).rect(27.5, 13, 5, 1, C.dgray);
  moss(p, b, 34, 29.5, 42, 29.5, 3);
}

function ruin(p: Painter, b: Biome): void {
  const s = b.stone;
  // Niski mur w kształcie L z wyszczerbionym brzegiem.
  for (let k = 0; k < 6; k++) brick(p, s, 4 + k * 7, 26, 7, 5, k === 3);
  for (let k = 0; k < 4; k++) brick(p, s, 4 + k * 7 + (k % 2) * 3, 21, 7, 5, k === 0);
  brick(p, s, 7, 16, 7, 5);
  for (let k = 0; k < 2; k++) brick(p, s, 4, 31 + k * 5, 6, 5);
  // Rozsypane cegły i trawa wyrastająca spod muru.
  for (const [x, y] of [[50, 30], [56, 34], [47, 36]] as const) brick(p, s, x, y, 5, 3);
  moss(p, b, 5, 25.5, 45, 25.5, 9);
  moss(p, b, 4, 31, 46, 31, 7);
}

function columns(p: Painter, b: Biome): void {
  const s = b.stone;
  // Kikut kolumny z bazą.
  brick(p, s, 5, 26, 14, 4);
  p.block(7, 12, 10, 14, s).thin(10, 13, 10, 25, s[0]).thin(14, 13, 14, 25, s[0]);
  p.polyShade([[7, 12], [10, 9], [13, 12], [17, 10], [17, 12]], s);
  // Powalone segmenty leżą obok (bębny kolumny jako elipsy z boku).
  for (const [x, y] of [[24, 25], [35, 27], [47, 26]] as const) {
    p.block(x, y, 9, 6, s);
    p.sphere(x + 9, y + 3, 1.6, 3, s);
    p.thin(x + 3, y + 0.5, x + 3, y + 5.5, s[0]).thin(x + 6, y + 0.5, x + 6, y + 5.5, s[0]);
  }
  moss(p, b, 6, 25.5, 18, 25.5, 4);
  moss(p, b, 25, 30.5, 55, 30.5, 8);
}

const SIZES: [number, number][] = [[60, 46], [34, 42], [48, 32], [62, 42], [60, 34]];
const BUILD = [gate, obelisk, camp, ruin, columns];

/** Sprite kompozycji `kind` w kolorach biomu (obrys w ciemnym odcieniu, jak reszta świata). */
export function landmark(b: Biome, kind: number): Painter {
  const [w, h] = SIZES[kind];
  const p = new Painter(w, h, HI);
  BUILD[kind](p, b);
  return p.outline(C.black);
}
