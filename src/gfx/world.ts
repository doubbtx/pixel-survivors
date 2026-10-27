import { C, RAMP } from '../core/palette';
import { Rng } from '../core/rng';
import { Painter } from './painter';
import type { Biome } from '../data/levels';

/**
 * Klatki efektów (iskra trafienia, obłok śmierci, eksplozja), strzały w 16 kierunkach
 * i dekoracje terenu dla każdego biomu.
 */

export const FX_FRAMES = { spark: 4, poof: 5, boom: 6 } as const;
export const ARROW_DIRS = 16;
export const PROP_KINDS = 6;

/** Iskra trafienia 11×11: błysk → gwiazdka → rozbiegające się punkty. */
export function spark(f: number): Painter {
  const p = new Painter(11, 11);
  const c = 5;
  if (f === 0) p.rect(c - 1, c - 1, 3, 3, C.white).px(c, c - 2, C.yellow).px(c, c + 2, C.yellow).px(c - 2, c, C.yellow).px(c + 2, c, C.yellow);
  if (f === 1) {
    p.line(c, 1, c, 9, C.yellow).line(1, c, 9, c, C.yellow).line(c, 3, c, 7, C.white).line(3, c, 7, c, C.white);
    p.px(c - 2, c - 2, C.gold).px(c + 2, c - 2, C.gold).px(c - 2, c + 2, C.gold).px(c + 2, c + 2, C.gold);
  }
  if (f === 2) for (const [x, y] of [[c, 0], [c, 10], [0, c], [10, c], [2, 2], [8, 2], [2, 8], [8, 8]]) p.px(x, y, C.gold);
  if (f === 3) for (const [x, y] of [[c, 0], [0, c], [10, c], [c, 10]]) p.px(x, y, C.orange);
  return p;
}

/** Obłok po śmierci wroga 18×18: kłęby rosną i rzedną. */
export function poof(f: number): Painter {
  const p = new Painter(18, 18);
  const r = new Rng(31 + f);
  const grow = 2 + f * 1.4;
  const ramp = f < 2 ? RAMP.bone : f < 4 ? [C.slate, C.dgray, C.lavender, C.lgray] : [C.navy, C.slate, C.dgray, C.lavender];
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + 0.4;
    const rr = Math.max(1, 3.4 - f * 0.55);
    p.sphere(9 + Math.cos(a) * grow, 9 + Math.sin(a) * grow, rr, rr, ramp);
  }
  if (f >= 3) for (let i = 0; i < 6; i++) p.px(r.int(1, 16), r.int(1, 16), C.dgray);
  return p;
}

/** Eksplozja 34×34: błysk, kula ognia, rozpad w dym. */
export function boom(f: number): Painter {
  const p = new Painter(34, 34);
  const r = new Rng(91 + f);
  const c = 17;
  if (f === 0) p.sphere(c, c, 5, 5, [C.gold, C.yellow, C.white, C.white]);
  if (f === 1) p.sphere(c, c, 10, 10, RAMP.fire).sphere(c - 1, c - 1, 6, 6, [C.orange, C.gold, C.yellow, C.white]);
  if (f === 2) {
    p.sphere(c, c, 14, 14, [C.dred, C.rust, C.orange, C.gold]).sphere(c - 2, c - 2, 7, 7, [C.orange, C.gold, C.yellow, C.yellow]);
  }
  if (f >= 3) {
    const smoke = f === 3 ? [C.dbrown, C.rust, C.orange, C.gold] : f === 4 ? [C.black, C.slate, C.dgray, C.lavender] : [C.black, C.navy, C.slate, C.dgray];
    const n = f === 5 ? 6 : 9;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + f;
      const d = 6 + f * 2;
      const rr = f === 5 ? 2.5 : 4.5;
      p.sphere(c + Math.cos(a) * d, c + Math.sin(a) * d, rr, rr, smoke);
    }
    if (f === 3) p.sphere(c, c, 6, 6, [C.rust, C.orange, C.gold, C.yellow]);
    for (let i = 0; i < 8; i++) p.px(r.int(2, 31), r.int(2, 31), f === 3 ? C.gold : C.dgray);
  }
  return p;
}

/** Strzała obrócona o k·22.5° (krytyczna ma złoty grot i lotki). */
export function arrowSprite(k: number, crit: boolean): Painter {
  const p = new Painter(17, 17);
  const a = (k * Math.PI * 2) / ARROW_DIRS;
  const cx = 8.5, cy = 8.5, ux = Math.cos(a), uy = Math.sin(a);
  const pt = (d: number): [number, number] => [Math.round(cx + ux * d - 0.5), Math.round(cy + uy * d - 0.5)];
  const [bx, by] = pt(-6), [tx, ty] = pt(5);
  p.line(bx, by, tx, ty, C.brown);
  const [hx, hy] = pt(6);
  p.px(hx, hy, crit ? C.yellow : C.white).px(tx, ty, crit ? C.gold : C.lgray);
  const [fx, fy] = pt(-5);
  p.px(bx, by, crit ? C.gold : C.red).px(fx, fy, crit ? C.yellow : C.salmon);
  return p.outline(crit ? C.dbrown : C.ddbrown);
}

/** Dekoracje terenu: 6 rodzajów na biom (krzaki, kamienie, grzyby, trzciny, kaktusy, kości, kryształy…). */
/**
 * Plama podłoża 48×32 (druga warstwa terenu): nieregularny kształt z ciemniejszego lub jaśniejszego odcienia biomu,
 * brzeg z ditheringiem, kilka drobin akcentu. `v` wybiera kształt i odcień.
 */
export function patch(b: Biome, v: number): Painter {
  const p = new Painter(48, 32);
  const r = new Rng(v * 104729 + 7);
  const col = v % 2 ? b.ground[0] : b.ground[2];
  const blobs = Array.from({ length: 4 }, () => [r.range(12, 36), r.range(10, 22), r.range(6, 11), r.range(4, 8)]);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 48; x++) {
      let best = 9;
      for (const [cx, cy, rx, ry] of blobs) best = Math.min(best, ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2);
      if (best <= 0.7 || (best <= 1 && (x + y) % 2 === 0)) p.px(x, y, col);
    }
  }
  for (let i = 0; i < 5; i++) {
    const x = r.int(10, 38), y = r.int(8, 24);
    if (p.get(x, y) >= 0) p.px(x, y, i % 2 ? b.tuft[1] : b.accent);
  }
  return p;
}

export function prop(biome: number, k: number): Painter {
  const p = new Painter(22, 22);
  const kinds: Record<number, ((p: Painter) => void)[]> = {
    0: [
      (q) => { q.sphere(8, 13, 5, 4, RAMP.green).sphere(14, 12, 5, 5, RAMP.green).sphere(11, 9, 4.5, 4, RAMP.green).px(10, 7, C.lime).px(13, 10, C.red).px(8, 12, C.red); },
      (q) => { for (const [x, y, c] of [[6, 12, C.yellow], [11, 9, C.white], [15, 13, C.salmon]]) { q.line(x, y + 1, x, y + 5, C.green).rect(x - 1, y - 1, 3, 3, c).px(x, y, C.gold); } },
      (q) => { q.rect(5, 16, 13, 2, C.teal); q.sphere(11, 12, 6.5, 5, RAMP.stone).px(8, 9, C.white).px(9, 9, C.lgray).line(12, 10, 14, 14, C.slate); },
      (q) => { q.rect(10, 12, 3, 6, C.cream).sphere(11.5, 10, 5, 3.5, RAMP.red).px(9, 9, C.white).px(13, 8, C.white).px(11, 11, C.peach); },
      (q) => { q.block(6, 10, 10, 8, RAMP.wood).sphere(11, 10, 5, 2, [C.dbrown, C.clay, C.tan, C.peach]).px(11, 10, C.brown).px(4, 17, C.green).px(17, 16, C.lime); },
      (q) => { for (let i = 0; i < 6; i++) q.line(5 + i * 2, 18, 4 + i * 2 + (i % 2) * 2, 8 + (i % 3) * 2, i % 2 ? C.green : C.lime); },
    ],
    1: [
      (q) => { for (let i = 0; i < 5; i++) { const x = 6 + i * 2; q.line(x, 19, x + (i % 2), 6 + i, C.green).rect(x - 1 + (i % 2), 4 + i, 2, 3, C.dbrown); } },
      (q) => { q.sphere(11, 14, 8, 4, [C.navy, C.dblue, C.dblue, C.blue]).sphere(10, 13, 4.5, 2.5, RAMP.green).px(14, 15, C.white).px(12, 12, C.salmon); },
      (q) => { q.rect(10, 13, 2, 5, C.lgray).sphere(11, 11, 5, 3, [C.dblue, C.blue, C.cyan, C.white]).px(9, 10, C.white); q.rect(15, 15, 1, 3, C.lgray).sphere(15.5, 14, 2.5, 1.6, [C.dblue, C.blue, C.cyan, C.cyan]); },
      (q) => { q.block(2, 11, 18, 6, RAMP.wood).sphere(19, 14, 1.5, 3, [C.dbrown, C.brown, C.clay, C.tan]).line(5, 12, 15, 12, C.clay).px(8, 10, C.green).px(13, 10, C.lime); },
      (q) => { q.sphere(11, 14, 8, 3.5, [C.black, C.navy, C.dblue, C.slate]).line(7, 13, 10, 13, C.lavender).px(14, 15, C.lavender); },
      (q) => { q.sphere(11, 13, 6, 4.5, RAMP.night).px(8, 11, C.slate).px(14, 14, C.green).px(13, 15, C.dgreen); },
    ],
    2: [
      (q) => { q.block(9, 4, 4, 15, RAMP.green).block(4, 9, 3, 5, RAMP.green).block(15, 7, 3, 6, RAMP.green).rect(6, 13, 3, 2, C.dgreen).rect(13, 11, 2, 2, C.dgreen).px(10, 3, C.salmon).px(11, 2, C.hotpink); },
      (q) => { q.sphere(11, 12, 5.5, 4.5, RAMP.bone).rect(8, 15, 6, 2, C.lgray).rect(8, 11, 2, 2, C.black).rect(12, 11, 2, 2, C.black).px(11, 14, C.dgray); },
      (q) => { q.rect(5, 16, 13, 2, C.dbrown); q.sphere(11, 12, 6.5, 5, RAMP.wood).px(8, 9, C.peach).line(12, 10, 14, 14, C.ddbrown); },
      (q) => { for (let i = 0; i < 7; i++) q.line(11, 17, 11 + Math.cos(-0.3 - i * 0.42) * 8, 17 + Math.sin(-0.3 - i * 0.42) * 8, i % 2 ? C.dbrown : C.brown); },
      (q) => { q.line(4, 15, 17, 12, C.cream).sphere(4, 15, 2, 2, RAMP.bone).sphere(17, 12, 2, 2, RAMP.bone).line(7, 10, 14, 17, C.lgray).sphere(14, 17, 1.6, 1.6, RAMP.bone); },
      (q) => { for (const [x, y] of [[6, 14], [11, 12], [15, 16], [9, 17]]) q.sphere(x, y, 1.8, 1.4, RAMP.wood); },
    ],
    3: [
      (q) => { q.polyShade([[11, 2], [14, 12], [11, 18], [8, 12]], RAMP.purple).polyShade([[6, 8], [8, 14], [6, 18], [4, 14]], RAMP.purple).polyShade([[16, 9], [18, 14], [16, 18], [14, 14]], RAMP.purple).px(10, 6, C.white); },
      (q) => { q.polyShade([[11, 3], [14, 12], [11, 18], [8, 12]], RAMP.blue).polyShade([[15, 9], [17, 14], [15, 18], [13, 14]], RAMP.blue).px(10, 7, C.white); },
      (q) => { q.block(6, 5, 10, 13, RAMP.night).line(9, 8, 13, 8, C.pink).line(11, 8, 11, 14, C.pink).line(9, 12, 13, 14, C.pink).px(11, 10, C.salmon); },
      (q) => { q.sphere(11, 12, 5, 4.5, RAMP.bone).rect(8, 11, 2, 2, C.black).rect(12, 11, 2, 2, C.black).line(4, 18, 17, 16, C.lgray); },
      (q) => { q.rect(10, 13, 2, 5, C.lavender).sphere(11, 11, 5, 3, RAMP.purple).px(9, 10, C.white).px(13, 11, C.salmon); },
      (q) => { q.sphere(11, 13, 6, 4.5, RAMP.night).px(9, 11, C.dgray).px(13, 14, C.plum); },
    ],
  };
  kinds[biome][k](p);
  return p.outline();
}

/** Mała czaszka do licznika zabójstw w HUD (11×11). */
export function uiSkull(): Painter {
  const p = new Painter(11, 11);
  p.sphere(5.5, 4.5, 4, 3.6, RAMP.bone).rect(3, 7, 5, 2, C.lgray);
  p.rect(3, 4, 2, 2, C.black).rect(6, 4, 2, 2, C.black).px(5, 6, C.dgray).px(4, 8, C.dgray).px(6, 8, C.dgray);
  return p.outline();
}
