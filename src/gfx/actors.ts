import { C, RAMP } from '../core/palette';
import type { Biome } from '../data/levels';
import { Painter } from './painter';

/**
 * Postacie z klatkami animacji: bohaterowie (chód), wrogowie (pulsowanie, machanie skrzydłami,
 * mruganie, migotanie płomienia, obrót) i boss (oddech, pulsujące kule mocy).
 * Klatka `f` to parametr rysowania — kod gry wybiera ją przez animFrame().
 */

/** Sekwencja klatek i liczba kroków symulacji na klatkę. */
export const ANIM: Record<string, { seq: number[]; speed: number }> = {
  kestra: { seq: [0, 1, 2, 3], speed: 7 },
  borgun: { seq: [0, 1, 2, 3], speed: 8 },
  ignara: { seq: [0, 1, 2, 3], speed: 7 },
  morwen: { seq: [0, 1, 2, 3], speed: 8 },
  wraith: { seq: [0, 1, 2, 3], speed: 6 },
  wraithbig: { seq: [0, 1, 2, 3], speed: 7 },
  slime: { seq: [0, 1, 2, 3], speed: 9 },
  goldslime: { seq: [0, 1, 2, 3], speed: 5 },
  bat: { seq: [0, 1, 0, 2], speed: 4 },
  golem: { seq: [0, 1, 2, 3], speed: 10 },
  eye: { seq: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1], speed: 6 },
  wisp: { seq: [0, 1, 2, 1], speed: 5 },
  spinner: { seq: [0, 1, 2, 3], speed: 4 },
  cultist: { seq: [0, 2, 0, 3, 0, 2, 0, 1], speed: 9 },
  sentinel: { seq: [0, 1, 2, 3], speed: 10 },
  boss: { seq: [0, 1, 2, 3], speed: 12 },
  mimic: { seq: [0, 1], speed: 8 },
  stag: { seq: [0, 1, 2, 3], speed: 5 },
};

/** Numer klatki dla czasu (kroki symulacji) z przesunięciem `seed`, żeby tłum nie ruszał się synchronicznie. */
export function animFrame(base: string, step: number, seed: number): number {
  const a = ANIM[base.startsWith('boss') ? 'boss' : base];
  if (!a) return 0;
  return a.seq[Math.floor((step + seed) / a.speed) % a.seq.length];
}

function starPts(cx: number, cy: number, n: number, ro: number, ri: number, rot: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? ri : ro, a = rot + (i * Math.PI) / n;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

/** Nogi w cyklu chodu: [x lewej, wysokość lewej, x prawej, wysokość prawej] dla klatek 0-3. */
const STRIDE = [[0, 3, 0, 3], [-1, 3, 1, 2], [0, 3, 0, 3], [1, 2, -1, 3]];

function kestra(f: number): Painter {
  const p = new Painter(20, 20);
  const o = f % 2 === 1 ? -1 : 0; // podskok tułowia w kroku
  const [lx, lh, rx, rh] = STRIDE[f];
  p.rect(7 + lx, 15, 2, lh, C.dbrown).rect(7 + lx, 14 + lh, 2, 1, C.ddbrown);
  p.rect(10 + rx, 15, 2, rh, C.dbrown).rect(10 + rx, 14 + rh, 3, 1, C.ddbrown);
  p.block(3, 7 + o, 3, 7, RAMP.wood).px(3, 6 + o, C.red).px(4, 5 + o, C.salmon).px(5, 6 + o, C.lgray); // kołczan
  p.sphere(9.5, 12 + o, 4.5, 4.2, RAMP.green); // płaszcz
  p.rect(6, 13 + o, 8, 1, C.dbrown).px(9, 13 + o, C.gold); // pas z klamrą
  p.sphere(9.5, 7 + o, 4.5, 4.3, RAMP.green); // kaptur
  p.px(5, 4 + o, C.dgreen).px(6, 3 + o, C.green);
  p.rect(9, 6 + o, 4, 3, C.tan).rect(9, 6 + o, 4, 1, C.peach).px(12, 8 + o, C.skin); // twarz
  p.px(10, 7 + o, C.black).px(12, 7 + o, C.black);
  p.line(15, 3 + o, 16, 5 + o, C.brown).line(16, 5 + o, 16, 14 + o, C.brown).line(16, 14 + o, 15, 16 + o, C.brown).px(16, 7 + o, C.clay).px(16, 8 + o, C.clay); // łuk
  p.line(15, 4 + o, 15, 15 + o, C.lgray); // cięciwa
  p.px(14, 10 + o, C.tan).px(14, 11 + o, C.skin); // dłoń
  return p.outline();
}

function borgun(f: number): Painter {
  const p = new Painter(23, 20);
  const o = f % 2 === 1 ? -1 : 0;
  const sway = f === 1 ? -1 : f === 3 ? 1 : 0;
  const [lx, lh, rx, rh] = STRIDE[f];
  p.poly([[4, 8 + o], [8, 8 + o], [8, 18], [3 + sway, 18]], C.dred).line(4, 9 + o, 3 + sway, 17, C.red); // peleryna
  p.rect(7 + lx, 15, 3, lh, C.dgray).rect(7 + lx, 14 + lh, 3, 1, C.ddbrown);
  p.rect(11 + rx, 15, 3, rh, C.dgray).rect(11 + rx, 14 + rh, 4, 1, C.ddbrown);
  p.sphere(10.5, 12 + o, 5, 4.5, RAMP.stone); // zbroja
  p.rect(6, 13 + o, 10, 1, C.dbrown).px(10, 13 + o, C.gold).px(11, 13 + o, C.gold);
  p.rect(9, 9 + o, 5, 2, C.clay).px(9, 10 + o, C.rust).px(13, 10 + o, C.rust); // broda
  p.sphere(10.5, 6.5 + o, 4.2, 4, RAMP.stone); // hełm
  p.rect(9, 7 + o, 5, 1, C.black).px(12, 7 + o, C.hotpink);
  p.line(6, 4 + o, 5, 1 + o, C.cream).px(5, 1 + o, C.white).line(15, 4 + o, 16, 1 + o, C.cream).px(16, 1 + o, C.white); // rogi
  p.line(17, 4 + o, 17, 18 + o, C.brown).px(17, 5 + o, C.clay); // stylisko
  p.poly([[17, 3 + o], [21, 2 + o], [21, 9 + o], [17, 8 + o]], C.lavender).line(20, 2 + o, 20, 9 + o, C.lgray).line(21, 3 + o, 21, 8 + o, C.white).line(17, 3 + o, 17, 8 + o, C.dgray);
  p.rect(15, 10 + o, 3, 2, C.dgray);
  return p.outline();
}

function ignara(f: number): Painter {
  const p = new Painter(20, 21);
  const o = f % 2 === 1 ? -1 : 0;
  const [lx, lh, rx, rh] = STRIDE[f];
  const glow = f % 2 === 0 ? C.yellow : C.gold;
  p.rect(7 + lx, 16, 2, lh, C.ddbrown).rect(10 + rx, 16, 2, rh, C.ddbrown);
  p.poly([[5, 9 + o], [14, 9 + o], [15, 17], [4, 17]], C.dred); // szata
  p.sphere(9.5, 13 + o, 4.5, 4, RAMP.red);
  p.line(9, 10 + o, 9, 17, C.gold).rect(6, 12 + o, 7, 1, C.dbrown).px(9, 12 + o, C.gold);
  p.sphere(9.5, 7.5 + o, 4, 4, RAMP.red); // kaptur
  p.poly([[6, 5 + o], [9, 0 + o], [10, 4 + o]], C.dred).px(9, 1 + o, C.red); // czubek kaptura
  p.rect(8, 7 + o, 4, 3, C.tan).rect(8, 7 + o, 4, 1, C.peach); // twarz
  p.px(9, 8 + o, C.black).px(11, 8 + o, C.black);
  p.line(3, 4 + o, 13, 6 + o, C.orange).px(3, 4 + o, C.rust); // pasmo włosów spod kaptura
  p.line(16, 5 + o, 16, 18 + o, C.brown).px(16, 9 + o, C.clay); // kostur
  p.disc(16, 3 + o, 2, C.orange).px(16, 3 + o, glow).px(16, 1 + o, C.gold);
  p.px(14, 11 + o, C.tan).px(15, 11 + o, C.skin); // dłoń
  return p.outline();
}

/** Morwen: przywoływaczka w fioletowej szacie z kapturem, kostur z czaszką i zielonym płomieniem duszy. */
function morwen(f: number): Painter {
  const p = new Painter(20, 21);
  const o = f % 2 === 1 ? -1 : 0;
  const [lx, lh, rx, rh] = STRIDE[f];
  p.rect(7 + lx, 16, 2, lh, C.black).rect(10 + rx, 16, 2, rh, C.black);
  p.poly([[5, 9 + o], [14, 9 + o], [15, 17], [4, 17]], C.plum); // szata
  p.sphere(9.5, 13 + o, 4.5, 4, RAMP.purple);
  p.line(6, 16, 13, 16, C.black).rect(6, 12 + o, 7, 1, C.ddbrown).px(9, 12 + o, C.lime);
  p.sphere(9.5, 7.5 + o, 4, 4, RAMP.purple); // kaptur
  p.sphere(9.5, 8 + o, 2.6, 2.4, [C.black, C.black, C.navy, C.navy]); // cień pod kapturem
  p.px(8, 8 + o, C.lime).px(11, 8 + o, C.lime); // świecące oczy
  p.line(16, 5 + o, 16, 18 + o, C.dbrown).px(16, 10 + o, C.brown); // kostur
  p.sphere(16, 3 + o, 2, 2, RAMP.bone).px(15, 3 + o, C.black).px(17, 3 + o, C.black);
  p.px(16, 0 + o, f % 2 ? C.lime : C.green).px(15, 1 + o, C.green).px(17, 1 + o, C.lime); // płomień duszy
  p.px(14, 11 + o, C.lavender).px(15, 11 + o, C.lgray); // dłoń
  return p.outline();
}

/** Duch-sługa (mały) i wojownik Armii umarłych (duży): półprzezroczysta postać z falującym ogonem. */
function wraithOf(f: number, big: boolean): Painter {
  const s = big ? 1.5 : 1;
  const w = Math.round(14 * s), h = Math.round(16 * s);
  const p = new Painter(w, h);
  const cx = w / 2, sway = [0, 1, 0, -1][f] * s;
  p.poly([[cx - 4 * s, 7 * s], [cx + 4 * s, 7 * s], [cx + 2 * s + sway, 15 * s], [cx + sway, 12 * s], [cx - 2 * s + sway, 15 * s]], C.lavender);
  p.sphere(cx, 6 * s, 4.5 * s, 4.5 * s, [C.slate, C.lavender, C.lgray, C.white]);
  p.px(cx - 2 * s, 6 * s, C.lime).px(cx + 1.5 * s, 6 * s, C.lime).rect(cx - 1, 8.5 * s, 2, 1, C.dgray);
  if (big) {
    p.poly([[cx - 4 * s, 2 * s], [cx - 1, 0], [cx + 1, 0], [cx + 4 * s, 2 * s], [cx, 3 * s]], C.gold); // korona
    p.line(w - 3, 4 * s, w - 3, h - 3, C.lgray).px(w - 3, 4 * s - 1, C.white); // miecz
  }
  return p.outline(C.plum);
}
const wraith = (f: number) => wraithOf(f, false);
const wraithbig = (f: number) => wraithOf(f, true);

/** Szlam w kolorach rampy (zielony zwykły, złoty — rzadki Złoty szlam). */
function slimeOf(f: number, ramp: readonly number[], mouth: number): Painter {
  const p = new Painter(20, 17);
  const rx = 7 + [0, 0.8, 0, -0.5][f], ry = 5.6 + [0, -0.8, 0, 0.6][f];
  const cy = 15 - ry;
  p.sphere(10, cy, rx, ry, ramp);
  const ey = Math.round(cy - 1);
  p.px(6, ey - 3, C.white).px(7, ey - 4, C.white).px(7, ey - 3, ramp[3]);
  p.rect(7, ey, 2, 2, C.black).rect(12, ey, 2, 2, C.black).px(7, ey, C.white).px(12, ey, C.white);
  p.rect(9, ey + 3, 3, 1, mouth);
  return p.outline();
}

const slime = (f: number) => slimeOf(f, [C.dgreen, C.green, C.lime, C.lime], C.teal);
const goldslime = (f: number) => slimeOf(f, [C.dbrown, C.orange, C.gold, C.yellow], C.dbrown);

function bat(f: number): Painter {
  const p = new Painter(23, 17);
  const lift = [0, -3, 2][f];
  const wing: [number, number][] = [[9, 7], [2, 3 + lift], [3, 7 + lift / 2], [1, 11 + lift], [5, 10], [7, 13]];
  p.poly(wing, C.plum).poly(wing.map(([x, y]) => [22 - x, y] as [number, number]), C.plum);
  p.line(3, 4 + lift, 8, 8, C.pink).line(19, 4 + lift, 14, 8, C.pink);
  const by = f === 1 ? 1 : 0;
  p.poly([[9, 7 + by], [9, 3 + by], [11, 6 + by]], C.plum).poly([[13, 7 + by], [13, 3 + by], [11, 6 + by]], C.plum); // uszy
  p.sphere(11, 9 + by, 3.5, 3.5, RAMP.purple);
  p.px(10, 9 + by, C.hotpink).px(12, 9 + by, C.hotpink).px(10, 11 + by, C.white).px(12, 11 + by, C.white);
  return p.outline();
}

/** Golem: ciężki chód w 4 klatkach (nogi na zmianę, ramiona w przeciwfazie, tułów podskakuje), mech i świecący rdzeń. */
function golem(f: number): Painter {
  const p = new Painter(25, 25);
  const bob = f % 2 === 1 ? -1 : 0;
  const swing = [0, 1, 0, -1][f];
  const [ll, rl] = [[5, 4], [5, 5], [4, 5], [5, 5]][f];
  p.rect(8, 18, 3, ll, C.dgray).rect(14, 18, 3, rl, C.dgray);
  p.rect(7, 17 + ll, 5, 1, C.slate).rect(13, 17 + rl, 5, 1, C.slate);
  p.sphere(5, 13 + swing + bob, 3.2, 4.4, RAMP.stone).sphere(20, 13 - swing + bob, 3.2, 4.4, RAMP.stone);
  p.rect(3, 16 + swing + bob, 4, 2, C.dgray).rect(18, 16 - swing + bob, 4, 2, C.dgray); // pięści
  p.sphere(12.5, 12 + bob, 6.8, 6.2, RAMP.stone);
  p.line(7, 15 + bob, 18, 15 + bob, C.slate);
  p.sphere(12.5, 5.5 + bob, 4, 3.5, RAMP.stone);
  p.px(11, 5 + bob, C.gold).px(14, 5 + bob, C.gold).px(11, 6 + bob, C.orange).px(14, 6 + bob, C.orange);
  p.line(9, 10 + bob, 11, 13 + bob, C.slate).line(15, 9 + bob, 16, 12 + bob, C.slate).px(8, 13 + bob, C.lgray);
  const core = f % 2 ? [C.cyan, C.white] : [C.blue, C.cyan];
  p.px(12, 12 + bob, core[1]).px(13, 12 + bob, core[0]).px(12, 13 + bob, core[0]).px(13, 13 + bob, C.dblue);
  p.px(10, 2 + bob, C.green).px(11, 2 + bob, C.lime).px(9, 3 + bob, C.green).px(16, 8 + bob, C.green).px(17, 8 + bob, C.lime).px(4, 10 + swing + bob, C.green);
  return p.outline();
}

function eye(f: number): Painter {
  const p = new Painter(18, 18);
  p.sphere(9, 9, 7, 7, RAMP.bone);
  p.line(3, 7, 5, 8, C.salmon).line(14, 12, 12, 11, C.salmon).line(5, 13, 6, 11, C.salmon);
  p.sphere(10, 9, 3.5, 3.5, RAMP.blue);
  p.rect(10, 8, 2, 2, C.black).px(9, 7, C.white);
  // Powieka (cieniowana jak skóra): f=1 przymknięta do połowy, f=2 zamknięta ze szparą i rzęsami.
  if (f > 0) {
    const edge = f === 1 ? 8 : 10;
    const lid = new Painter(18, 18).sphere(9, 9, 7, 7, [C.plum, C.pink, C.salmon, C.salmon]);
    for (let y = 0; y < edge; y++) for (let x = 0; x < 18; x++) if (lid.get(x, y) >= 0) p.px(x, y, lid.get(x, y));
    for (let x = 0; x < 18; x++) if (lid.get(x, edge) >= 0) p.px(x, edge, C.black);
    if (f === 2) {
      for (let y = edge + 1; y < 18; y++) for (let x = 0; x < 18; x++) if (lid.get(x, y) >= 0) p.px(x, y, lid.get(x, y));
      for (const x of [5, 8, 11, 13]) p.px(x, edge + 1, C.black);
    }
  }
  return p.outline(C.plum);
}

function wisp(f: number): Painter {
  const p = new Painter(17, 19);
  const tip = [0, -1.5, 1.5][f];
  p.poly([[8.5 + tip, 0.5], [3, 11], [14, 11]], C.rust).poly([[8.5 + tip / 2, 3], [5.5, 11], [11.5, 11]], C.orange);
  p.poly([[3, 9], [1, 4 + f], [5, 10]], C.rust).poly([[14, 9], [16, 6 - f], [12, 10]], C.rust);
  p.sphere(8.5, 12, 5, 5, RAMP.fire);
  p.sphere(8.5, 12.5, 2.6, 2.6, [C.gold, C.yellow, C.white]);
  p.px(6, 12, C.ddbrown).px(11, 12, C.ddbrown);
  return p.outline(C.dred);
}

function spinner(f: number): Painter {
  const p = new Painter(21, 21);
  const rot = -Math.PI / 2 + f * (Math.PI / 20);
  p.poly(starPts(10.5, 10.5, 5, 9.5, 4, rot), C.plum).poly(starPts(10.5, 10.5, 5, 7, 3, rot), C.pink);
  p.sphere(10.5, 10.5, 3.6, 3.6, RAMP.purple);
  p.rect(10, 10, 2, 2, C.black).px(10, 9, C.white);
  return p.outline();
}

/** Kultysta: zakapturzona postać w niebieskiej szacie, świecące oczy i kula mocy (f=1: rozbłysk, f=2/3: szata faluje). */
function cultist(f: number): Painter {
  const p = new Painter(16, 19);
  const sway = f === 2 ? -1 : f === 3 ? 1 : 0;
  p.polyShade([[8, 1], [13, 7], [14.5 + sway, 18], [1.5 + sway, 18], [3, 7]], RAMP.blue);
  p.line(8, 6, 8 + sway, 17, C.navy).line(3 + sway, 17, 13 + sway, 17, C.dblue);
  p.px(4 + sway, 16, C.navy).px(11 + sway, 15, C.navy); // fałdy
  p.sphere(8, 6.5, 3.6, 3.2, [C.black, C.navy, C.navy, C.dblue]); // wnętrze kaptura
  p.px(6, 6, f ? C.white : C.cyan).px(10, 6, f ? C.white : C.cyan);
  const orb = f ? 2.6 : 2;
  p.sphere(8, 12.5, orb, orb, [C.dblue, C.blue, C.cyan, C.white]);
  p.line(4, 11, 6, 12, C.dblue).line(12, 11, 10, 12, C.dblue); // rękawy
  return p.outline(C.navy);
}

/** Strażnik: unoszący się kryształ z okiem; runy krążą wokół (4 klatki), rdzeń pulsuje. */
function sentinel(f: number): Painter {
  const p = new Painter(20, 24);
  const o = f % 2 ? 0 : 1;
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + f * (Math.PI / 6);
    p.px(10 + Math.cos(a) * 8.5, 10 + o + Math.sin(a) * 3.5, k === f % 3 ? C.white : C.cyan);
  }
  p.polyShade([[10, 1 + o], [17, 9 + o], [10, 21 + o], [3, 9 + o]], [C.dblue, C.blue, C.cyan, C.white]);
  p.line(10, 2 + o, 10, 20 + o, C.blue).line(4, 9 + o, 16, 9 + o, C.dblue);
  p.sphere(10, 10 + o, 2.8, 2.8, f % 2 ? [C.plum, C.pink, C.salmon, C.white] : RAMP.purple);
  p.rect(10, 10 + o, 1, 1, C.black);
  p.line(5, 23, 15, 23, C.slate).px(4, 22, C.cyan).px(16, 22, C.cyan); // runy pod kryształem
  return p.outline(C.navy);
}

/** Mimik: skrzynia z zębami, kłapie (klatka 1 = otwarta paszcza z językiem). */
function mimic(f: number): Painter {
  const p = new Painter(20, 18);
  const open = f === 1 ? 3 : 0;
  p.block(2, 9, 16, 8, RAMP.wood).rect(2, 12, 16, 1, C.gold);
  p.block(2, 3 - open, 16, 6, RAMP.wood).rect(2, 3 - open, 16, 1, C.clay);
  if (open) { p.rect(3, 6, 14, 3, C.dred).rect(7, 7, 6, 2, C.salmon); }
  for (let x = 3; x < 17; x += 3) { p.px(x, 9 - (open ? 1 : 0), C.white).px(x + 1, 8 + open, C.white); }
  p.px(6, 4 - open, C.red).px(13, 4 - open, C.red);
  return p.outline();
}

/** Biały jeleń: smukła sylwetka z porożem, bieg w 4 klatkach. */
function stag(f: number): Painter {
  const p = new Painter(24, 22);
  const leg = [0, 1, 0, -1][f];
  p.sphere(11, 11, 7, 3.5, RAMP.bone).sphere(18, 7, 2.5, 2.5, RAMP.bone).px(19, 6, C.black);
  p.line(17, 4, 15, 0, C.cream).line(16, 2, 14, 2, C.cream).line(19, 4, 21, 0, C.cream).line(20, 2, 22, 2, C.cream);
  for (const [x, d] of [[6, leg], [9, -leg], [14, leg], [16, -leg]]) p.line(x, 14, x + d, 20, C.lgray);
  p.px(4, 10, C.white);
  return p.outline();
}

export const ACTORS: Record<string, (f: number) => Painter> = { kestra, borgun, ignara, morwen, wraith, wraithbig, slime, goldslime, bat, golem, eye, wisp, spinner, cultist, sentinel, mimic, stag };

/**
 * Boss 36×36: szata w kolorach biomu z wzorem run i pasem, naramienniki z kolcami, czaszka, korona,
 * pulsujące kule mocy i iskry wokół (4 klatki: oddech, puls kul, krążące iskry, falujący dół szaty).
 */
/** Przesunięcie falowania dołu szaty bossa w klatce. */
const x0 = (f: number) => (f >> 1) & 1;

export function boss(b: Biome, f: number): Painter {
  const p = new Painter(37, 38);
  const robe = b.bossRobe;
  const o = f % 2 ? 0 : 1; // klatki parzyste o piksel niżej — "oddech"
  for (let y = 16; y < 34; y++) {
    const half = 6 + Math.floor((y - 16) * 0.62) + (y > 30 && (x0(f) + y) % 2 ? 1 : 0);
    for (let x = 18 - half; x < 18 + half; x++) {
      const t = (x - (18 - half)) / (2 * half);
      const fold = (x + Math.floor(y / 3) + f) % 7 === 0;
      p.px(x, y + (y < 24 ? o : 0), y === 16 ? robe[3] : fold ? robe[0] : t < 0.25 ? robe[2] : t < 0.62 ? robe[1] : robe[0]);
    }
  }
  p.rect(12, 33, 13, 1, robe[0]);
  // Pas z klamrą i runy na szacie.
  p.rect(11, 24, 15, 2, C.ddbrown).rect(17, 24, 3, 2, C.gold).px(18, 24, C.yellow);
  for (const [x, y] of [[13, 28], [18, 30], [23, 28]] as const) p.px(x, y, f === 2 ? C.white : b.accent).px(x, y + 1, robe[0]);
  // Naramienniki z kolcami.
  for (const sx of [10, 26]) {
    p.sphere(sx, 18 + o, 3.5, 2.5, RAMP.stone);
    p.line(sx, 16 + o, sx + (sx < 18 ? -2 : 2), 13 + o, C.lgray).px(sx + (sx < 18 ? -2 : 2), 13 + o, C.white);
  }
  const orb = 3.6 + (f % 2 ? 0.8 : 0);
  p.sphere(5, 23 + o, orb, orb, RAMP.purple).px(4, 22 + o, C.white);
  p.sphere(31, 23 + o, orb, orb, RAMP.blue).px(30, 22 + o, C.white);
  // Iskry krążące wokół kul.
  for (const [cx, col] of [[5, C.pink], [31, C.cyan]] as const) {
    const a = f * (Math.PI / 2);
    p.px(cx + Math.cos(a) * 5.5, 23 + o + Math.sin(a) * 5.5, col);
  }
  p.line(8, 21 + o, 12, 19 + o, robe[1]).line(28, 21 + o, 24, 19 + o, robe[1]); // rękawy
  p.sphere(18, 11 + o, 7, 7, RAMP.bone); // czaszka
  p.line(13, 8 + o, 14, 10 + o, C.lgray).px(23, 13 + o, C.lgray); // pęknięcia
  p.rect(14, 10 + o, 3, 3, C.black).rect(20, 10 + o, 3, 3, C.black);
  const glow = f % 2 ? C.red : C.hotpink;
  p.px(15, 11 + o, glow).px(21, 11 + o, glow);
  p.px(17, 14 + o, C.dgray).px(18, 14 + o, C.dgray);
  p.rect(14, 16 + o, 8, 2, C.cream);
  for (let x = 15; x < 22; x += 2) p.px(x, 16 + o, C.dgray).px(x, 17 + o, C.dgray);
  p.poly([[10, 6 + o], [12, 1 + o], [14, 4 + o], [18, 0.2 + o], [22, 4 + o], [24, 1 + o], [26, 6 + o]], C.gold).rect(11, 4 + o, 15, 3, C.gold);
  p.rect(11, 4 + o, 15, 1, C.yellow).px(18, 2 + o, C.yellow).px(14, 5 + o, C.hotpink).px(18, 5 + o, C.cyan).px(22, 5 + o, C.hotpink);
  return p.outline();
}
