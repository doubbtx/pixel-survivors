import { C, RAMP } from '../core/palette';
import { Rng } from '../core/rng';
import { Painter, HI } from './painter';

/**
 * Klatki efektów (iskra trafienia, obłok śmierci, eksplozja), strzały w 16 kierunkach
 * i dekoracje terenu dla każdego biomu.
 */

export const FX_FRAMES = { spark: 4, poof: 5, boom: 6 } as const;
export const ARROW_DIRS = 16;
export const PROP_KINDS = 6;

/** Iskra trafienia 11×11: błysk → gwiazdka → rozbiegające się punkty. */
export function spark(f: number): Painter {
  const p = new Painter(11, 11, HI);
  const c = 5;
  if (f === 0) p.rect(c - 1, c - 1, 3, 3, C.white).spot(c, c - 2, C.yellow).spot(c, c + 2, C.yellow).spot(c - 2, c, C.yellow).spot(c + 2, c, C.yellow);
  if (f === 1) {
    p.stroke(c, 1, c, 9, C.yellow).stroke(1, c, 9, c, C.yellow).stroke(c, 3, c, 7, C.white).stroke(3, c, 7, c, C.white);
    p.spot(c - 2, c - 2, C.gold).spot(c + 2, c - 2, C.gold).spot(c - 2, c + 2, C.gold).spot(c + 2, c + 2, C.gold);
  }
  if (f === 2) for (const [x, y] of [[c, 0], [c, 10], [0, c], [10, c], [2, 2], [8, 2], [2, 8], [8, 8]]) p.spot(x, y, C.gold);
  if (f === 3) for (const [x, y] of [[c, 0], [0, c], [10, c], [c, 10]]) p.spot(x, y, C.orange);
  return p;
}

/** Obłok po śmierci wroga 18×18: kłęby rosną i rzedną. */
export function poof(f: number): Painter {
  const p = new Painter(18, 18, HI);
  const r = new Rng(31 + f);
  const grow = 2 + f * 1.4;
  const ramp = f < 2 ? RAMP.bone : f < 4 ? [C.slate, C.dgray, C.lavender, C.lgray] : [C.navy, C.slate, C.dgray, C.lavender];
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + 0.4;
    const rr = Math.max(1, 3.4 - f * 0.55);
    p.sphere(9 + Math.cos(a) * grow, 9 + Math.sin(a) * grow, rr, rr, ramp);
  }
  if (f >= 3) for (let i = 0; i < 6; i++) p.spot(r.int(1, 16), r.int(1, 16), C.dgray);
  return p;
}

/**
 * Eksplozja 34×34: błysk z promieniami, nieregularna chmura kul ognia (bez jednej gładkiej sfery — po powiększeniu
 * wyglądała jak piłka), iskry, potem rozpad w dym.
 */
export function boom(f: number): Painter {
  const p = new Painter(34, 34, HI);
  const r = new Rng(91 + f);
  const c = 17;
  /** Kule rozrzucone wokół środka: liczba, odległość, promień, rampa. */
  const blobs = (n: number, dist: number, rad: number, ramp: readonly number[]) => {
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + r.range(-0.35, 0.35), d = dist * r.range(0.55, 1), rr = rad * r.range(0.7, 1.15);
      p.sphere(c + Math.cos(a) * d, c + Math.sin(a) * d, rr, rr, ramp);
    }
  };
  const embers = (n: number, spread: number, col: number) => {
    for (let k = 0; k < n; k++) {
      const a = r.range(0, Math.PI * 2), d = r.range(spread * 0.6, spread);
      p.spot(c + Math.cos(a) * d, c + Math.sin(a) * d, col);
    }
  };
  if (f === 0) {
    // Błysk: jasny rdzeń i krótkie promienie.
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + 0.2, l = k % 2 ? 6 : 9;
      p.thin(c, c, c + Math.cos(a) * l, c + Math.sin(a) * l, k % 2 ? C.gold : C.yellow);
    }
    p.sphere(c, c, 4, 4, [C.gold, C.yellow, C.white, C.white]);
  }
  if (f === 1) {
    blobs(6, 5, 4.5, RAMP.fire);
    p.sphere(c, c, 5, 5, [C.orange, C.gold, C.yellow, C.white]);
    embers(10, 14, C.yellow);
  }
  if (f === 2) {
    blobs(8, 9, 5, [C.dred, C.rust, C.orange, C.gold]);
    blobs(5, 4, 4, [C.rust, C.orange, C.gold, C.yellow]);
    embers(12, 16, C.gold);
  }
  if (f === 3) {
    blobs(9, 11, 4, [C.dbrown, C.rust, C.orange, C.gold]);
    blobs(3, 3, 3, [C.rust, C.orange, C.gold, C.yellow]);
    embers(10, 16, C.orange);
  }
  if (f >= 4) {
    const smoke = f === 4 ? [C.black, C.slate, C.dgray, C.lavender] : [C.black, C.navy, C.slate, C.dgray];
    blobs(f === 4 ? 9 : 7, 12 + (f - 4) * 3, f === 4 ? 3.5 : 2.5, smoke);
    embers(6, 16, C.dgray);
  }
  return p;
}

/** Strzała obrócona o k·22.5° (krytyczna ma złoty grot i lotki). */
export function arrowSprite(k: number, crit: boolean): Painter {
  const p = new Painter(17, 17, HI);
  const a = (k * Math.PI * 2) / ARROW_DIRS;
  const cx = 8.5, cy = 8.5, ux = Math.cos(a), uy = Math.sin(a);
  const at = (d: number, side = 0): [number, number] => [cx + ux * d - uy * side, cy + uy * d + ux * side];
  // Drzewce 2 piksele obrazu, grot jako trójkąt, lotki cienkimi kreskami (gęstość jak u postaci).
  const [bx, by] = at(-6), [tx, ty] = at(4);
  p.stroke(bx, by, tx, ty, C.brown);
  p.poly([at(7), at(3.2, 1.6), at(3.2, -1.6)], crit ? C.gold : C.lgray).thin(...at(6.4), ...at(3.6, 0.6), crit ? C.yellow : C.white);
  for (const side of [-1.4, 1.4]) p.thin(...at(-3.5), ...at(-6.3, side), crit ? C.yellow : C.salmon).thin(...at(-4.5), ...at(-7, side), crit ? C.gold : C.red);
  return p.outline(crit ? C.dbrown : C.ddbrown);
}

/** Dekoracje terenu: 6 rodzajów na biom (krzaki, kamienie, grzyby, trzciny, kaktusy, kości, kryształy…). */
export function prop(biome: number, k: number): Painter {
  const p = new Painter(22, 22, HI);
  const kinds: Record<number, ((p: Painter) => void)[]> = {
    0: [
      (q) => { q.sphere(8, 13, 5, 4, RAMP.green).sphere(14, 12, 5, 5, RAMP.green).sphere(11, 9, 4.5, 4, RAMP.green).spot(10, 7, C.lime).spot(13, 10, C.red).spot(8, 12, C.red); },
      (q) => { for (const [x, y, c] of [[6, 12, C.yellow], [11, 9, C.white], [15, 13, C.salmon]]) { q.stroke(x + 0.3, y + 1, x + 0.3, y + 5, C.green).thin(x + 1, y + 3.5, x + 2, y + 2.8, C.lime); for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) q.disc(x + 0.5 + dx * 0.9, y + 0.5 + dy * 0.9, 0.85, c); q.disc(x + 0.5, y + 0.5, 0.6, C.gold); } },
      (q) => { q.sphere(11, 12, 6.5, 5, RAMP.stone).dot(8, 9, C.white).thin(8.4, 9, 9.6, 8.6, C.lgray).thin(12, 10, 14, 14, C.slate).thin(14, 14, 15.5, 13.5, C.slate); },
      (q) => { q.rect(10, 12, 3, 6, C.cream).sphere(11.5, 10, 5, 3.5, RAMP.red).spot(9, 9, C.white).spot(13, 8, C.white).spot(11, 11, C.peach); },
      (q) => { q.block(6, 10, 10, 8, RAMP.wood).sphere(11, 10, 5, 2, [C.dbrown, C.clay, C.tan, C.peach]).spot(11, 10, C.brown).spot(4, 17, C.green).spot(17, 16, C.lime); },
      (q) => { for (let i = 0; i < 6; i++) q.stroke(5 + i * 2, 18, 4 + i * 2 + (i % 2) * 2, 8 + (i % 3) * 2, i % 2 ? C.green : C.lime); },
    ],
    1: [
      (q) => { for (let i = 0; i < 5; i++) { const x = 6 + i * 2; q.stroke(x, 19, x + (i % 2), 6 + i, C.green).rect(x - 1 + (i % 2), 4 + i, 2, 3, C.dbrown); } },
      (q) => { q.sphere(11, 14, 8, 4, [C.navy, C.dblue, C.dblue, C.blue]).sphere(10, 13, 4.5, 2.5, RAMP.green).spot(14, 15, C.white).spot(12, 12, C.salmon); },
      (q) => { q.rect(10, 13, 2, 5, C.lgray).sphere(11, 11, 5, 3, [C.dblue, C.blue, C.cyan, C.white]).spot(9, 10, C.white); q.rect(15, 15, 1, 3, C.lgray).sphere(15.5, 14, 2.5, 1.6, [C.dblue, C.blue, C.cyan, C.cyan]); },
      (q) => { q.block(2, 11, 18, 6, RAMP.wood).sphere(19, 14, 1.5, 3, [C.dbrown, C.brown, C.clay, C.tan]).stroke(5, 12, 15, 12, C.clay).spot(8, 10, C.green).spot(13, 10, C.lime); },
      (q) => { q.sphere(11, 14, 8, 3.5, [C.black, C.navy, C.dblue, C.slate]).stroke(7, 13, 10, 13, C.lavender).spot(14, 15, C.lavender); },
      (q) => { q.sphere(11, 13, 6, 4.5, RAMP.night).spot(8, 11, C.slate).spot(14, 14, C.green).spot(13, 15, C.dgreen); },
    ],
    2: [
      (q) => { q.block(9, 4, 4, 15, RAMP.green).block(4, 9, 3, 5, RAMP.green).block(15, 7, 3, 6, RAMP.green).rect(6, 13, 3, 2, C.dgreen).rect(13, 11, 2, 2, C.dgreen).spot(10, 3, C.salmon).spot(11, 2, C.hotpink); },
      (q) => { q.sphere(11, 12, 5.5, 4.5, RAMP.bone).rect(8, 15, 6, 2, C.lgray).rect(8, 11, 2, 2, C.black).rect(12, 11, 2, 2, C.black).spot(11, 14, C.dgray); },
      (q) => { q.rect(5, 16, 13, 2, C.dbrown); q.sphere(11, 12, 6.5, 5, RAMP.wood).spot(8, 9, C.peach).stroke(12, 10, 14, 14, C.ddbrown); },
      (q) => { for (let i = 0; i < 7; i++) q.stroke(11, 17, 11 + Math.cos(-0.3 - i * 0.42) * 8, 17 + Math.sin(-0.3 - i * 0.42) * 8, i % 2 ? C.dbrown : C.brown); },
      (q) => { q.stroke(4, 15, 17, 12, C.cream).sphere(4, 15, 2, 2, RAMP.bone).sphere(17, 12, 2, 2, RAMP.bone).stroke(7, 10, 14, 17, C.lgray).sphere(14, 17, 1.6, 1.6, RAMP.bone); },
      (q) => { for (const [x, y] of [[6, 14], [11, 12], [15, 16], [9, 17]]) q.sphere(x, y, 1.8, 1.4, RAMP.wood); },
    ],
    3: [
      (q) => { q.polyShade([[11, 2], [14, 12], [11, 18], [8, 12]], RAMP.purple).polyShade([[6, 8], [8, 14], [6, 18], [4, 14]], RAMP.purple).polyShade([[16, 9], [18, 14], [16, 18], [14, 14]], RAMP.purple).spot(10, 6, C.white); },
      (q) => { q.polyShade([[11, 3], [14, 12], [11, 18], [8, 12]], RAMP.blue).polyShade([[15, 9], [17, 14], [15, 18], [13, 14]], RAMP.blue).spot(10, 7, C.white); },
      (q) => { q.block(6, 5, 10, 13, RAMP.night).stroke(9, 8, 13, 8, C.pink).stroke(11, 8, 11, 14, C.pink).stroke(9, 12, 13, 14, C.pink).spot(11, 10, C.salmon); },
      (q) => { q.sphere(11, 12, 5, 4.5, RAMP.bone).rect(8, 11, 2, 2, C.black).rect(12, 11, 2, 2, C.black).stroke(4, 18, 17, 16, C.lgray); },
      (q) => { q.rect(10, 13, 2, 5, C.lavender).sphere(11, 11, 5, 3, RAMP.purple).spot(9, 10, C.white).spot(13, 11, C.salmon); },
      (q) => { q.sphere(11, 13, 6, 4.5, RAMP.night).spot(9, 11, C.dgray).spot(13, 14, C.plum); },
    ],
    // Pustka (sekretny biom): unoszące się odłamki, dziury w nicości, gwiazdy, pęknięte kolumny.
    4: [
      (q) => { q.polyShade([[11, 3], [15, 9], [11, 13], [7, 9]], [C.black, C.plum, C.hotpink, C.pink]).spot(10, 6, C.white).rect(8, 17, 7, 1, C.plum); },
      (q) => { q.sphere(11, 13, 7, 3.5, [C.black, C.black, C.black, C.plum]).spot(7, 12, C.hotpink).spot(15, 14, C.hotpink); },
      (q) => { for (const [x, y] of [[5, 6], [15, 4], [11, 11], [6, 16], [17, 15]]) q.spot(x, y, C.white).spot(x - 1, y, C.lavender).spot(x + 1, y, C.lavender); },
      (q) => { q.block(8, 6, 6, 12, RAMP.night).rect(7, 17, 8, 2, C.slate).stroke(9, 6, 12, 10, C.black).spot(10, 5, C.plum).spot(12, 4, C.plum); },
      (q) => { q.sphere(11, 10, 4, 4, RAMP.bone).sphere(11, 10, 2, 2, [C.black, C.plum, C.hotpink, C.hotpink]).spot(11, 10, C.white).rect(9, 17, 5, 1, C.plum); },
      (q) => { q.stroke(4, 16, 9, 12, C.hotpink).stroke(9, 12, 13, 15, C.hotpink).stroke(13, 15, 18, 10, C.hotpink).stroke(4, 17, 18, 11, C.black); },
    ],
  };
  kinds[biome][k](p);
  return p.outline();
}

/** Mała czaszka do licznika zabójstw w HUD (11×11). */
export function uiSkull(): Painter {
  const p = new Painter(11, 11, HI);
  p.sphere(5.5, 4.5, 4, 3.6, RAMP.bone).rect(3, 7, 5, 2, C.lgray);
  p.rect(3, 4, 2, 2, C.black).rect(6, 4, 2, 2, C.black).px(5, 6, C.dgray).px(4, 8, C.dgray).px(6, 8, C.dgray);
  return p.outline();
}
