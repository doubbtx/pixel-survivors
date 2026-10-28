import { C, RAMP } from '../core/palette';
import type { Biome } from '../data/levels';
import { Painter, HI } from './painter';

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
  vesper: { seq: [0, 1, 2, 3], speed: 6 },
  aurel: { seq: [0, 1, 2, 3], speed: 8 },
  angel: { seq: [0, 1, 2, 3], speed: 6 },
  angelbig: { seq: [0, 1, 2, 3], speed: 7 },
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
  shieldbearer: { seq: [0, 1, 2, 1], speed: 9 },
  summoner: { seq: [0, 1, 2, 1], speed: 8 },
  kamikaze: { seq: [0, 1], speed: 4 },
  blinker: { seq: [0, 1, 2, 3], speed: 6 },
  weaver: { seq: [0, 1, 2, 3], speed: 6 },
  stag: { seq: [0, 1, 2, 3], speed: 5 },
};

/** Numer klatki dla czasu (kroki symulacji) z przesunięciem `seed`, żeby tłum nie ruszał się synchronicznie. */
export function animFrame(base: string, step: number, seed: number): number {
  const a = ANIM[base.startsWith('boss') ? 'boss' : base.split('~')[0]];
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

/** Nogi w chodzie (STRIDE): nogawki szerokości `w` od `y` w dół, buty o jednostkę szersze z jasnym czubkiem. */
function legs(p: Painter, f: number, xl: number, xr: number, y: number, w: number, pants: number, boot: number): void {
  const [lx, lh, rx, rh] = STRIDE[f];
  p.rect(xl + lx, y, w, lh, pants).rect(xr + rx, y, w, rh, pants);
  p.rect(xl + lx, y + lh - 1, w + 0.5, 1, boot).rect(xr + rx, y + rh - 1, w + 1, 1, boot);
  p.dot(xl + lx + 0.5, y, darkerOf(pants)).dot(xr + rx + w - 0.5, y + rh - 1, C.lavender);
}

/** Ciemniejszy kolor nogawki (szew przy kolanie). */
const darkerOf = (c: number) => (c === C.dgray ? C.slate : c === C.dbrown ? C.ddbrown : C.black);

/** Oko z odblaskiem: górny piksel obrazu biały, dolny w kolorze źrenicy. */
function eyeAt(p: Painter, x: number, y: number, col: number = C.black): void {
  p.dot(x, y, C.white).dot(x, y + 0.5, col).dot(x + 0.5, y + 0.5, col);
}

/** Kestra: łuczniczka w zielonym płaszczu z kapturem, kołczan na plecach, łuk w prawej dłoni. */
function kestra(f: number): Painter {
  const p = new Painter(20, 20, HI);
  const o = f % 2 === 1 ? -1 : 0; // podskok tułowia w kroku
  legs(p, f, 7, 10, 15, 2, C.dbrown, C.ddbrown);
  // Kołczan ze strzałami (lotki czerwone i białe) i pasem przez pierś.
  p.block(2.5, 6.5 + o, 3, 7.5, RAMP.wood);
  p.thin(2.5, 9 + o, 5.5, 9 + o, C.gold).thin(2.5, 12 + o, 5.5, 12 + o, C.gold);
  for (const [x, col] of [[3, C.red], [4, C.white], [5, C.red]] as const) p.thin(x, 4.5 + o, x, 6.5 + o, C.lgray).dot(x, 3.5 + o, col).dot(x, 4 + o, col).dot(x - 0.5, 4 + o, col);
  // Płaszcz z fałdami i jaśniejszym brzegiem.
  p.polyShade([[5.5, 9 + o], [13.5, 9 + o], [14.5, 15.5], [4.5, 15.5]], RAMP.green);
  p.thin(7, 11 + o, 6.3, 15.4, C.dgreen).thin(12.2, 11 + o, 12.8, 15.4, C.dgreen).thin(4.6, 15.4, 14.4, 15.4, C.lime);
  // Skórzana kamizelka, pas z klamrą i pas kołczanu.
  p.sphere(9.5, 12 + o, 2.4, 2.8, RAMP.wood);
  p.thin(5, 9.5 + o, 12, 13.5 + o, C.dbrown);
  p.rect(5.5, 13 + o, 8.5, 1, C.ddbrown).rect(9, 13 + o, 1.5, 1, C.gold).dot(9, 13 + o, C.yellow);
  // Kaptur ze szpicem, cień wokół twarzy.
  p.polyShade([[5, 6 + o], [5.5, 2.5 + o], [8, 4 + o]], RAMP.green);
  p.sphere(9.5, 6.5 + o, 4.6, 4.4, RAMP.green);
  p.thin(7.5, 3.2 + o, 11.5, 2.8 + o, C.lime);
  p.sphere(10.8, 7.6 + o, 3, 2.8, [C.teal, C.teal, C.dgreen, C.dgreen]);
  // Twarz: cieniowana skóra, rude kosmyki, oczy z odblaskiem, usta.
  p.sphere(11, 8 + o, 2.3, 2.1, RAMP.skin);
  p.thin(9, 5.9 + o, 12.8, 6.4 + o, C.rust).dot(9, 6.5 + o, C.rust);
  eyeAt(p, 10, 7.5 + o, C.dgreen);
  eyeAt(p, 12, 7.5 + o, C.dgreen);
  p.dot(11, 9.5 + o, C.brown);
  // Łuk: wygięte ramię z owijką, cięciwa, dłoń.
  for (let y = 2.5; y < 16; y += 0.5) {
    const x = 15.4 + 1.5 * Math.sin((Math.PI * (y - 2.5)) / 13.5);
    p.rect(x, y + o, 1, 0.5, C.brown).dot(x, y + o, C.clay);
  }
  p.thin(15.2, 2.8 + o, 15.2, 15.7 + o, C.lgray);
  p.rect(16.4, 8.5 + o, 1, 1.5, C.dred).dot(15.3, 2.5 + o, C.white).dot(15.3, 15.5 + o, C.white);
  p.sphere(15.6, 10.6 + o, 1.1, 1, RAMP.skin);
  return p.outline();
}

/** Borgun: wojownik w rogatym hełmie i płytowej zbroi, czerwona peleryna, topór w prawej dłoni. */
function borgun(f: number): Painter {
  const p = new Painter(23, 20, HI);
  const o = f % 2 === 1 ? -1 : 0;
  const sway = f === 1 ? -1 : f === 3 ? 1 : 0;
  // Peleryna za plecami.
  p.polyShade([[4, 8 + o], [8.5, 8 + o], [8.5, 18], [2.8 + sway, 18]], RAMP.red);
  p.thin(5, 10 + o, 4 + sway, 17.5, C.dred).thin(6.8, 10 + o, 6.5, 17.5, C.dred);
  legs(p, f, 7, 11, 15, 3, C.dgray, C.ddbrown);
  // Kolczuga pod zbroją (ditherowany splot).
  p.rect(6.5, 13.5 + o, 8.5, 2, C.dgray);
  for (let x = 6.5; x < 15; x += 1) p.dot(x + ((x * 2) % 2 ? 0 : 0.5), 14 + o, C.lavender).dot(x, 15 + o, C.lavender);
  // Napierśnik, tabard z godłem, naramienniki z nitami.
  p.sphere(10.5, 11.5 + o, 5, 4.2, RAMP.stone);
  p.rect(9.5, 9.5 + o, 2, 4.5, C.dred).thin(9.5, 9.5 + o, 9.5, 14 + o, C.gold).thin(11.4, 9.5 + o, 11.4, 14 + o, C.gold);
  p.dot(10.5, 11 + o, C.gold).dot(10, 11.5 + o, C.gold).dot(11, 11.5 + o, C.gold).dot(10.5, 12 + o, C.gold);
  p.sphere(6.2, 9.6 + o, 2.3, 1.8, RAMP.stone).sphere(14.8, 9.6 + o, 2.3, 1.8, RAMP.stone);
  p.dot(5.5, 9.5 + o, C.white).dot(14.2, 9.3 + o, C.white).dot(6.5, 10.6 + o, C.dgray).dot(15.2, 10.6 + o, C.dgray);
  p.rect(6, 13.3 + o, 9.5, 1, C.dbrown).rect(10, 13.3 + o, 1.5, 1, C.gold).dot(10, 13.3 + o, C.yellow);
  // Broda.
  p.polyShade([[8.5, 8.5 + o], [12.5, 8.5 + o], [12.2, 10.5 + o], [10.5, 11.8 + o], [8.8, 10.5 + o]], [C.dbrown, C.rust, C.clay, C.tan]);
  p.thin(9.6, 9 + o, 9.8, 10.8 + o, C.rust).thin(11.4, 9 + o, 11.2, 10.8 + o, C.rust);
  // Rogi (zakrzywione, kościane).
  p.polyShade([[7.6, 5.5 + o], [5.2, 3.6 + o], [4.4, 0.6 + o], [6.3, 2.4 + o], [8.6, 4.2 + o]], RAMP.bone);
  p.polyShade([[13.4, 5.5 + o], [15.8, 3.6 + o], [16.6, 0.6 + o], [14.7, 2.4 + o], [12.4, 4.2 + o]], RAMP.bone);
  // Hełm: wizjer z żarzącymi się oczami, nosal, krawędź.
  p.sphere(10.5, 6 + o, 4.3, 4, RAMP.stone);
  p.rect(8.3, 6.5 + o, 4.5, 1, C.black);
  p.dot(9.3, 6.5 + o, C.hotpink).dot(11.5, 6.5 + o, C.hotpink).dot(9.3, 7 + o, C.dred).dot(11.5, 7 + o, C.dred);
  p.thin(10.5, 3.6 + o, 10.5, 8.4 + o, C.dgray).thin(6.6, 8 + o, 14.4, 8 + o, C.lavender);
  p.dot(8.5, 4 + o, C.white).dot(9, 3.5 + o, C.white);
  // Topór: stylisko z owijką, ostrze z wyostrzoną krawędzią, rękawica.
  p.line(17, 3.5 + o, 17, 18.5 + o, C.brown).thin(16.9, 4 + o, 16.9, 18 + o, C.clay);
  for (let y = 12; y < 15; y += 1) p.thin(17, y + o, 17.9, y + 0.5 + o, C.ddbrown);
  p.polyShade([[17.5, 2.5 + o], [21.4, 0.8 + o], [22.2, 5.5 + o], [21.4, 10.2 + o], [17.5, 8.5 + o]], RAMP.stone);
  p.thin(21.8, 1.4 + o, 22.1, 9.6 + o, C.white).thin(17.6, 3 + o, 17.6, 8 + o, C.dgray);
  p.dot(19, 5.5 + o, C.dgray).dot(19.5, 5.5 + o, C.dgray);
  p.sphere(16.6, 11 + o, 1.4, 1.2, RAMP.stone);
  return p.outline();
}

/** Ignara: czarodziejka ognia w czerwonej szacie ze złotym haftem, rude włosy, kostur z kulą ognia. */
function ignara(f: number): Painter {
  const p = new Painter(20, 21, HI);
  const o = f % 2 === 1 ? -1 : 0;
  const glow = f % 2 === 0 ? C.yellow : C.gold;
  legs(p, f, 7, 10, 16, 2, C.ddbrown, C.black);
  // Szata z haftem na środku i przy rąbku.
  p.polyShade([[5, 9.5 + o], [14, 9.5 + o], [15.5, 17.5], [3.5, 17.5]], RAMP.red);
  p.thin(9.5, 10 + o, 9.5, 17.4, C.gold).thin(3.6, 17.2, 15.4, 17.2, C.gold);
  for (const x of [5.5, 7.5, 11.5, 13.5]) p.dot(x, 16.5, C.gold);
  p.thin(7.2, 12 + o, 6.5, 17, C.dred).thin(11.8, 12 + o, 12.5, 17, C.dred);
  // Rękawy i szarfa z klejnotem.
  p.sphere(5.6, 12 + o, 1.6, 2, RAMP.red).sphere(13.6, 11.6 + o, 1.6, 1.8, RAMP.red);
  p.rect(6, 12.5 + o, 7, 1, C.dbrown).dot(9.5, 12.5 + o, C.yellow).dot(10, 12.5 + o, C.gold);
  // Kaptur ze szpicem.
  p.polyShade([[6, 5.5 + o], [8.6, 0.4 + o], [10.6, 4 + o]], RAMP.red);
  p.sphere(9.5, 7.5 + o, 4, 4, RAMP.red);
  p.sphere(10.2, 8.4 + o, 2.9, 2.6, [C.dred, C.dred, C.ddbrown, C.ddbrown]);
  // Rude włosy spod kaptura.
  p.polyShade([[6.4, 6 + o], [8.6, 5.6 + o], [8, 8 + o], [7.2, 11 + o], [6, 10 + o]], [C.rust, C.orange, C.gold, C.yellow]);
  p.thin(8.4, 6.6 + o, 12.6, 6.6 + o, C.orange).thin(8.4, 6.2 + o, 12.4, 6.1 + o, C.gold);
  p.thin(6.6, 7 + o, 5.8, 11 + o, C.orange);
  // Twarz.
  p.sphere(10.4, 8.4 + o, 2.2, 2, RAMP.skin);
  eyeAt(p, 9.5, 8 + o, C.rust);
  eyeAt(p, 11.5, 8 + o, C.rust);
  p.dot(10.5, 9.8 + o, C.dred);
  // Kostur z pazurem i kulą ognia; płomień migocze między klatkami.
  p.line(16.5, 5 + o, 16.5, 19.5 + o, C.dbrown).thin(16.3, 5.5 + o, 16.3, 19 + o, C.brown);
  p.thin(15.2, 4.8 + o, 16.5, 3.8 + o, C.gold).thin(17.8, 4.8 + o, 16.5, 3.8 + o, C.gold);
  p.sphere(16.5, 2.8 + o, 1.9, 1.9, RAMP.fire).dot(16, 2.3 + o, C.white).dot(16.5, 2.8 + o, glow);
  p.dot(16.5, 0.3 + o, f % 2 ? C.yellow : C.orange).dot(15.5, 0.8 + o, f % 2 ? C.orange : C.yellow).dot(17.5, 0.6 + o, C.gold);
  p.sphere(14.8, 11.6 + o, 1, 0.9, RAMP.skin);
  return p.outline();
}

/** Morwen: przywoływaczka w fioletowej, postrzępionej szacie, twarz w cieniu z zielonymi oczami, kostur z czaszką. */
function morwen(f: number): Painter {
  const p = new Painter(20, 21, HI);
  const o = f % 2 === 1 ? -1 : 0;
  legs(p, f, 7, 10, 16, 2, C.black, C.navy);
  // Szata z postrzępionym dołem i runami.
  p.polyShade([[5, 9.5 + o], [14, 9.5 + o], [15.5, 17.5], [3.5, 17.5]], RAMP.purple);
  for (let x = 4; x < 15.5; x += 1.5) p.dot(x, 17, C.black).dot(x + 0.5, 17, C.black).dot(x, 16.5, C.plum);
  p.thin(7, 12 + o, 6.4, 16.5, C.plum).thin(12, 12 + o, 12.6, 16.5, C.plum);
  p.dot(7, 14.5 + o, C.lime).dot(12, 14.5 + o, C.lime).dot(9.5, 15.5 + o, C.lime).dot(9.5, 15 + o, C.green);
  // Kołnierz, pas z kością i zielonym klejnotem.
  p.sphere(9.5, 10 + o, 4.2, 1.4, [C.black, C.navy, C.plum, C.plum]);
  p.rect(6, 12.5 + o, 7, 1, C.ddbrown).rect(9, 12.5 + o, 1.5, 1, C.lime).dot(9, 12.5 + o, C.white);
  // Kaptur z daszkiem i cień twarzy.
  p.polyShade([[7, 5 + o], [9.5, 2.2 + o], [12, 5 + o]], RAMP.purple);
  p.sphere(9.5, 7.5 + o, 4, 4, RAMP.purple);
  p.sphere(9.6, 8.2 + o, 2.7, 2.5, [C.black, C.black, C.navy, C.navy]);
  // Świecące oczy z poświatą.
  for (const x of [8.3, 10.8]) p.dot(x, 8 + o, C.white).dot(x + 0.5, 8 + o, C.lime).dot(x, 8.5 + o, C.lime).dot(x - 0.5, 8 + o, C.green).dot(x + 1, 8.5 + o, C.green);
  // Kostur z czaszką i płomieniem duszy.
  p.line(16, 5 + o, 16, 19 + o, C.ddbrown).thin(15.8, 5.5 + o, 15.8, 18.5 + o, C.dbrown);
  p.sphere(16, 3.2 + o, 2, 1.9, RAMP.bone);
  p.dot(15.2, 3 + o, C.black).dot(15.5, 3 + o, C.black).dot(16.5, 3 + o, C.black).dot(16.8, 3 + o, C.black).dot(16, 4 + o, C.dgray);
  p.thin(15.2, 4.6 + o, 16.8, 4.6 + o, C.lgray);
  p.dot(16, 0 + o, f % 2 ? C.lime : C.green).dot(15.5, 0.8 + o, C.green).dot(16.5, 0.6 + o, C.lime).dot(16, 0.5 + o, C.white);
  p.sphere(14.6, 11.6 + o, 1, 0.9, [C.slate, C.dgray, C.lavender, C.lgray]);
  return p.outline();
}

/** Duch-sługa (mały) i wojownik Armii umarłych (duży): blada zjawa z postrzępionym ogonem i świecącymi oczami. */
function wraithOf(f: number, big: boolean): Painter {
  const s = big ? 1.5 : 1;
  const w = Math.round(14 * s), h = Math.round(16 * s);
  const p = new Painter(w, h, HI);
  const cx = w / 2, sway = [0, 1, 0, -1][f] * s;
  const pale = [C.slate, C.lavender, C.lgray, C.white];
  // Postrzępiony ogon z trzema językami.
  p.polyShade([[cx - 4 * s, 7 * s], [cx + 4 * s, 7 * s], [cx + 3 * s + sway, 15 * s], [cx + 1.5 * s + sway, 12.5 * s], [cx + sway * 0.5, 15.5 * s], [cx - 1.5 * s + sway, 12.5 * s], [cx - 3 * s + sway, 15 * s]], pale);
  p.thin(cx - 1.5 * s, 9 * s, cx - 1.5 * s + sway, 12 * s, C.lavender).thin(cx + 1.5 * s, 9 * s, cx + 1.5 * s + sway, 12 * s, C.lavender);
  // Ramiona-smugi.
  p.thin(cx - 4 * s, 8 * s, cx - 5.5 * s, 10.5 * s + sway, C.lgray).thin(cx + 4 * s, 8 * s, cx + 5.5 * s, 10.5 * s - sway, C.lgray);
  p.sphere(cx, 6 * s, 4.5 * s, 4.5 * s, pale);
  // Puste oczodoły ze świecącymi oczami i usta.
  for (const ex of [cx - 1.8 * s, cx + 1.4 * s]) p.sphere(ex, 6 * s, 1.1 * s, 1.2 * s, [C.navy, C.navy, C.slate, C.slate]).dot(ex, 5.8 * s, C.lime).dot(ex - 0.5, 5.8 * s, C.white);
  p.sphere(cx, 8.8 * s, 0.9 * s, 0.6 * s, [C.navy, C.navy, C.slate, C.slate]);
  if (big) {
    p.polyShade([[cx - 4 * s, 2 * s], [cx - 2.5 * s, 0.4], [cx - 1, 1.2 * s], [cx, 0], [cx + 1, 1.2 * s], [cx + 2.5 * s, 0.4], [cx + 4 * s, 2 * s], [cx, 3 * s]], RAMP.gold); // korona
    p.dot(cx, 1.6 * s, C.hotpink);
    p.line(w - 3, 4 * s, w - 3, h - 3, C.lgray).thin(w - 2.6, 4 * s, w - 2.6, h - 3.5, C.white).rect(w - 4, h - 4, 3, 0.5, C.gold).dot(w - 3, 4 * s - 1, C.white); // miecz
  }
  return p.outline(C.plum);
}
const wraith = (f: number) => wraithOf(f, false);
const wraithbig = (f: number) => wraithOf(f, true);

/** Vesper: skrytobójczyni w ciemnej kurtce i kapturze, czerwony szal i maska, sztylet w każdej dłoni. */
function vesper(f: number): Painter {
  const p = new Painter(20, 20, HI);
  const o = f % 2 === 1 ? -1 : 0;
  const flow = [0, 1, 0, -1][f];
  legs(p, f, 7, 10, 15, 2, C.black, C.slate);
  // Powiewający szal z frędzlami.
  p.polyShade([[5, 8 + o], [2 + flow, 10.5 + o], [1 + flow, 13 + o], [6, 11 + o]], RAMP.red);
  p.dot(1 + flow, 13.5 + o, C.red).dot(2 + flow, 13.3 + o, C.red).dot(1.5 + flow, 14 + o, C.dred);
  // Kurtka z pasami i pasem na noże.
  p.sphere(9.5, 12 + o, 4.2, 4, RAMP.night);
  p.thin(6.5, 10 + o, 12.5, 14 + o, C.slate).thin(12.5, 10 + o, 6.5, 14 + o, C.navy);
  p.rect(6, 13 + o, 8, 1, C.dbrown);
  for (const x of [7.5, 9.5, 11.5]) p.thin(x, 12.8 + o, x, 14.4 + o, C.lgray).dot(x, 12.8 + o, C.white);
  // Kaptur, wąski pas twarzy z oczami, maska.
  p.sphere(9.5, 7 + o, 4.2, 4.2, RAMP.night);
  p.thin(7, 3.5 + o, 11, 3.2 + o, C.slate);
  p.rect(8, 6 + o, 4, 2, C.tan).thin(8, 6 + o, 12, 6 + o, C.peach);
  eyeAt(p, 8.8, 6.5 + o, C.dred);
  eyeAt(p, 10.8, 6.5 + o, C.dred);
  p.rect(7.8, 8 + o, 4.5, 1.5, C.dred).thin(7.8, 8 + o, 12.3, 8 + o, C.red);
  // Sztylety: ostrza z połyskiem, jelce, dłonie.
  p.thin(3.2, 12.5 + o, 4.4, 8.5 + o, C.lgray).thin(3.6, 12.5 + o, 4.8, 8.6 + o, C.white).dot(4.6, 8.2 + o, C.white);
  p.rect(2.6, 12.6 + o, 2, 0.5, C.gold).rect(3, 13 + o, 1, 1, C.dbrown);
  p.thin(15.2, 9.8 + o, 17.4, 5.8 + o, C.lgray).thin(15.6, 9.9 + o, 17.8, 5.9 + o, C.white).dot(17.8, 5.4 + o, C.white);
  p.rect(14.6, 10 + o, 1.5, 0.5, C.gold).dot(15, 10.5 + o, C.dbrown);
  p.sphere(14.4, 10.4 + o, 0.9, 0.8, RAMP.skin).sphere(4.6, 12.4 + o, 0.8, 0.8, RAMP.skin);
  return p.outline();
}

/** Aurel: kapłan w białej szacie ze złotą stułą, siwy z brodą, aureola, kostur ze słońcem. */
function aurel(f: number): Painter {
  const p = new Painter(20, 22, HI);
  const o = f % 2 === 1 ? -1 : 0;
  const glow = f % 2 === 0 ? C.yellow : C.white;
  legs(p, f, 7, 10, 17, 2, C.dbrown, C.brown);
  // Szata z fałdami.
  p.polyShade([[5, 10 + o], [14, 10 + o], [15.5, 19], [3.5, 19]], RAMP.bone);
  p.thin(6.8, 12 + o, 6, 18.8, C.lgray).thin(12.2, 12 + o, 13, 18.8, C.lgray).thin(9.5, 15 + o, 9.5, 18.8, C.lavender);
  // Stuła z krzyżami, złoty pas.
  p.line(8, 10 + o, 7, 18.5, C.gold).line(11, 10 + o, 12, 18.5, C.gold);
  for (const [x, y] of [[7.5, 15], [11.5, 15]] as const) p.dot(x, y + o, C.yellow).dot(x, y - 0.5 + o, C.yellow).dot(x - 0.5, y - 0.25 + o, C.yellow).dot(x + 0.5, y - 0.25 + o, C.yellow);
  p.rect(6, 13 + o, 8, 1, C.gold).thin(6, 13 + o, 14, 13 + o, C.yellow);
  // Głowa: siwe włosy, broda, oczy.
  p.sphere(9.5, 8 + o, 3.6, 3.6, RAMP.skin);
  p.polyShade([[6.2, 7.5 + o], [6.8, 5 + o], [12.2, 5 + o], [12.8, 7.5 + o], [12, 6.2 + o], [7, 6.2 + o]], [C.lavender, C.lgray, C.cream, C.white]);
  p.polyShade([[7.6, 9.6 + o], [11.4, 9.6 + o], [11, 11.6 + o], [9.5, 12.4 + o], [8, 11.6 + o]], [C.lavender, C.lgray, C.cream, C.white]);
  eyeAt(p, 8.3, 8 + o, C.blue);
  eyeAt(p, 10.8, 8 + o, C.blue);
  p.dot(9.5, 9.2 + o, C.skin);
  // Aureola (elipsa świetlnych punktów).
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 10) p.dot(9.5 + Math.cos(a) * 3.6, 2.2 + o + Math.sin(a) * 0.9, Math.sin(a) > 0 ? C.gold : glow);
  // Kostur ze słońcem: promienie, złota tarcza, jasny środek.
  p.line(17, 5 + o, 17, 20.5 + o, C.brown).thin(16.8, 5.5 + o, 16.8, 20 + o, C.clay);
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; p.thin(17 + Math.cos(a) * 1.8, 3 + o + Math.sin(a) * 1.8, 17 + Math.cos(a) * 2.8, 3 + o + Math.sin(a) * 2.8, k % 2 ? C.yellow : C.gold); }
  p.disc(17, 3 + o, 1.7, C.gold).dot(16.5, 2.5 + o, C.white).dot(17, 3 + o, glow);
  p.sphere(15.5, 12.4 + o, 1, 0.9, RAMP.skin);
  return p.outline();
}

/** Świetlisty strażnik (Aurel): biała postać ze skrzydłami z piór i aureolą; duży = Anielski zastęp, z mieczem. */
function angelOf(f: number, big: boolean): Painter {
  const s = big ? 1.5 : 1;
  const w = Math.round(16 * s), h = Math.round(16 * s);
  const p = new Painter(w, h, HI);
  const cx = w / 2, flap = [0, 1, 2, 1][f] * s;
  // Skrzydła z piórami (lotki jako cienkie linie).
  for (const d of [-1, 1]) {
    p.polyShade([[cx + d * 2 * s, 6 * s], [cx + d * 7.2 * s, 2.6 * s - flap], [cx + d * 7 * s, 6 * s - flap / 2], [cx + d * 6 * s, 9.5 * s], [cx + d * 2 * s, 10 * s]], RAMP.bone);
    for (let k = 1; k < 4; k++) p.thin(cx + d * 2.5 * s, (6 + k) * s, cx + d * (5 + k * 0.5) * s, (3.5 + k * 1.6) * s - flap / 2, C.lgray);
  }
  // Szata ze złotym brzegiem.
  p.polyShade([[cx - 3 * s, 8 * s], [cx + 3 * s, 8 * s], [cx + 2.4 * s, 15 * s], [cx - 2.4 * s, 15 * s]], RAMP.bone);
  p.thin(cx - 2.4 * s, 14.6 * s, cx + 2.4 * s, 14.6 * s, C.gold).thin(cx, 9 * s, cx, 14.5 * s, C.yellow);
  p.sphere(cx, 5.5 * s, 2.8 * s, 2.8 * s, [C.tan, C.peach, C.peach, C.cream]);
  p.polyShade([[cx - 2.8 * s, 5 * s], [cx - 2 * s, 2.8 * s], [cx + 2 * s, 2.8 * s], [cx + 2.8 * s, 5 * s], [cx, 3.8 * s]], [C.orange, C.gold, C.yellow, C.cream]); // złote włosy
  eyeAt(p, cx - 1.2 * s, 5.5 * s, C.blue);
  eyeAt(p, cx + 0.8 * s, 5.5 * s, C.blue);
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) p.dot(cx + Math.cos(a) * 2.6 * s, 1.2 * s + Math.sin(a) * 0.6, f % 2 ? C.yellow : C.gold); // aureola
  if (big) {
    p.line(w - 3, 4 * s, w - 3, h - 4, C.lgray).thin(w - 2.6, 4 * s, w - 2.6, h - 4.5, C.white).dot(w - 3, 4 * s - 1, C.white); // miecz
    p.rect(w - 4.5, h - 4, 4, 1, C.gold).rect(w - 3, h - 3, 1, 2, C.brown);
  }
  return p.outline(C.gold);
}
const angel = (f: number) => angelOf(f, false);
const angelbig = (f: number) => angelOf(f, true);

/** Szlam w kolorach rampy (zielony zwykły, złoty — rzadki Złoty szlam): galareta z bąbelkami, odblaskiem i kroplą. */
function slimeOf(f: number, ramp: readonly number[], mouth: number): Painter {
  const p = new Painter(20, 17, HI);
  const rx = 7 + [0, 0.8, 0, -0.5][f], ry = 5.6 + [0, -0.8, 0, 0.6][f];
  const cy = 15 - ry;
  p.sphere(10, cy, rx, ry, ramp);
  // Ciemniejsza podstawa i kapiąca kropla.
  p.thin(10 - rx * 0.8, 14.6, 10 + rx * 0.8, 14.6, ramp[0]).sphere(14.5, 15.4, 0.8, 0.9, ramp);
  // Bąbelki w środku.
  for (const [x, y, r] of [[13.6, cy + 1.2, 0.7], [6.4, cy + 2.4, 0.5], [12, cy + 3, 0.45]] as const) p.ring(x, y, r + 0.5, 0.5, ramp[3]).dot(x - 0.3, y - 0.3, C.white);
  // Podłużny odblask u góry.
  p.thin(6.5, cy - ry * 0.55, 8.5, cy - ry * 0.75, C.white).dot(6.2, cy - ry * 0.35, C.white).dot(9.5, cy - ry * 0.8, ramp[3]);
  // Oczy z białkami i usta.
  const ey = cy - 0.6;
  for (const ex of [7.2, 12.2]) p.rect(ex, ey, 1.5, 2, C.white).rect(ex + 0.5, ey + 0.5, 1, 1.5, C.black).dot(ex + 0.5, ey + 0.5, C.white);
  p.rect(9.2, ey + 3, 2.5, 0.5, mouth).dot(9, ey + 2.5, mouth).dot(11.7, ey + 2.5, mouth);
  return p.outline();
}

const slime = (f: number) => slimeOf(f, [C.dgreen, C.green, C.lime, C.lime], C.teal);
const goldslime = (f: number) => slimeOf(f, [C.dbrown, C.orange, C.gold, C.yellow], C.dbrown);

/** Nietoperz: błoniaste skrzydła z kośćmi palców, futrzane ciało, uszy, kły i żarzące się oczy. */
function bat(f: number): Painter {
  const p = new Painter(23, 17, HI);
  const lift = [0, -3, 2][f];
  const wing: [number, number][] = [[9, 7], [2, 3 + lift], [3, 7 + lift / 2], [1, 11 + lift], [4, 10], [5, 12.5], [7, 11]];
  const mirror = (pts: [number, number][]) => pts.map(([x, y]) => [22 - x, y] as [number, number]);
  p.polyShade(wing, [C.navy, C.plum, C.plum, C.pink]).polyShade(mirror(wing), [C.navy, C.plum, C.plum, C.pink]);
  // Kości palców w skrzydłach.
  for (const [x, y] of [[2, 3 + lift], [3, 7 + lift / 2], [1, 11 + lift], [5, 12.5]] as const) p.thin(8.5, 7.5, x, y, C.pink).thin(13.5, 7.5, 22 - x, y, C.pink);
  const by = f === 1 ? 1 : 0;
  // Uszy z różowym środkiem.
  p.polyShade([[8.6, 7.5 + by], [8.6, 2.8 + by], [11, 6 + by]], RAMP.purple).polyShade([[13.4, 7.5 + by], [13.4, 2.8 + by], [11, 6 + by]], RAMP.purple);
  p.thin(9.1, 4 + by, 9.6, 6 + by, C.salmon).thin(12.9, 4 + by, 12.4, 6 + by, C.salmon);
  p.sphere(11, 9 + by, 3.6, 3.6, RAMP.purple);
  for (const x of [9.5, 10.5, 11.5, 12.5]) p.dot(x, 11.8 + by, C.plum); // futro
  // Oczy z poświatą i kły.
  for (const ex of [9.6, 11.8]) p.dot(ex, 8.6 + by, C.white).dot(ex + 0.5, 8.6 + by, C.hotpink).dot(ex, 9.1 + by, C.hotpink).dot(ex + 0.5, 9.1 + by, C.dred);
  p.dot(10, 10.8 + by, C.white).dot(10, 11.3 + by, C.white).dot(12, 10.8 + by, C.white).dot(12, 11.3 + by, C.white);
  return p.outline();
}

/** Golem: ciężki chód w 4 klatkach (nogi na zmianę, ramiona w przeciwfazie), kamienne płyty, mech i świecący rdzeń. */
function golem(f: number): Painter {
  const p = new Painter(25, 25, HI);
  const bob = f % 2 === 1 ? -1 : 0;
  const swing = [0, 1, 0, -1][f];
  const [ll, rl] = [[5, 4], [5, 5], [4, 5], [5, 5]][f];
  // Nogi-kolumny ze stopami.
  p.block(8, 18, 3, ll, RAMP.stone).block(14, 18, 3, rl, RAMP.stone);
  p.rect(7, 17 + ll, 5, 1, C.slate).rect(13, 17 + rl, 5, 1, C.slate);
  // Ramiona i pięści.
  p.sphere(5, 13 + swing + bob, 3.2, 4.4, RAMP.stone).sphere(20, 13 - swing + bob, 3.2, 4.4, RAMP.stone);
  p.polyShade([[2.6, 16 + swing + bob], [7, 16 + swing + bob], [6.6, 18.6 + swing + bob], [3, 18.6 + swing + bob]], RAMP.stone);
  p.polyShade([[18, 16 - swing + bob], [22.4, 16 - swing + bob], [22, 18.6 - swing + bob], [18.4, 18.6 - swing + bob]], RAMP.stone);
  // Tułów z płytami i szczelinami.
  p.sphere(12.5, 12 + bob, 6.8, 6.2, RAMP.stone);
  p.thin(7, 15 + bob, 18, 15 + bob, C.slate).thin(12.5, 15 + bob, 12.5, 18 + bob, C.slate);
  p.thin(9, 9.5 + bob, 11, 13 + bob, C.slate).thin(15, 8.5 + bob, 16.2, 12 + bob, C.slate).thin(16.2, 12 + bob, 17.5, 12.5 + bob, C.slate);
  p.dot(7.5, 9.5 + bob, C.white).dot(8, 9 + bob, C.white).dot(3.5, 11 + swing + bob, C.white);
  // Rdzeń z poświatą i runami.
  const core = f % 2 ? [C.cyan, C.white] : [C.blue, C.cyan];
  p.disc(12.5, 12.5 + bob, 1.6, C.dblue).disc(12.5, 12.5 + bob, 1.1, core[0]).dot(12.2, 12.2 + bob, core[1]);
  for (const [x, y] of [[10, 12.5], [15, 12.5], [12.5, 10]] as const) p.dot(x, y + bob, C.cyan);
  // Głowa z oczami-żarem.
  p.sphere(12.5, 5.5 + bob, 4, 3.5, RAMP.stone);
  p.thin(9.5, 6.5 + bob, 15.5, 6.5 + bob, C.dgray);
  for (const ex of [11, 14]) p.rect(ex, 5 + bob, 1, 1, C.orange).dot(ex, 5 + bob, C.yellow);
  // Mech (ditherowane kępki).
  for (const [x, y] of [[9.5, 2.5], [10.5, 2], [11, 2.5], [16, 8], [16.5, 7.5], [17, 8], [4, 10 + swing], [4.5, 9.5 + swing], [18.5, 11 - swing]] as const) p.dot(x, y + bob, (x * 2) % 2 ? C.lime : C.green);
  return p.outline();
}

/** Oko: gałka z żyłkami, tęczówka z pierścieniem, źrenica i odblaski; powieka mruga (f=1 przymknięta, f=2 zamknięta). */
function eye(f: number): Painter {
  const p = new Painter(18, 18, HI);
  p.sphere(9, 9, 7, 7, RAMP.bone);
  // Żyłki z rozgałęzieniami.
  for (const [x0, y0, x1, y1] of [[2.5, 7, 5.5, 8.2], [5.5, 8.2, 6, 7], [14.5, 12.5, 12, 11], [12, 11, 12.5, 12.5], [4.5, 13.5, 6.2, 11.2], [13, 4, 11.8, 5.6]] as const) p.thin(x0, y0, x1, y1, C.salmon);
  p.sphere(10, 9, 3.6, 3.6, RAMP.blue);
  p.ring(10, 9, 3.6, 0.5, C.dblue).ring(10, 9, 2.2, 0.5, C.cyan);
  p.disc(10.3, 9.2, 1.3, C.black);
  p.dot(8.6, 7.6, C.white).dot(9, 7.6, C.white).dot(8.6, 8, C.white).dot(11.5, 10.5, C.lgray);
  // Powieka (cieniowana jak skóra) z rzęsami.
  if (f > 0) {
    const edge = f === 1 ? 8 : 10;
    const lid = new Painter(18, 18, HI).sphere(9, 9, 7, 7, [C.plum, C.pink, C.salmon, C.salmon]);
    for (let y = 0; y < edge; y += 0.5) for (let x = 0; x < 18; x += 0.5) if (lid.get(x, y) >= 0) p.dot(x, y, lid.get(x, y));
    p.thin(2.2, edge, 15.8, edge, C.black);
    if (f === 2) {
      for (let y = edge + 0.5; y < 18; y += 0.5) for (let x = 0; x < 18; x += 0.5) if (lid.get(x, y) >= 0) p.dot(x, y, lid.get(x, y));
      for (const x of [5, 8, 11, 13]) p.thin(x, edge + 0.5, x - 0.5, edge + 1.5, C.black);
    }
  }
  return p.outline(C.plum);
}

/** Ognik: warstwowy płomień (zewnętrzny, środkowy, gorący rdzeń) z oczami i iskrami. */
function wisp(f: number): Painter {
  const p = new Painter(17, 19, HI);
  const tip = [0, -1.5, 1.5][f];
  p.polyShade([[8.5 + tip, 0.5], [2.5, 11], [14.5, 11]], [C.dred, C.rust, C.orange, C.orange]);
  p.polyShade([[3, 9], [0.8, 4 + f], [5, 10]], [C.dred, C.rust, C.rust, C.orange]).polyShade([[14, 9], [16.2, 6 - f], [12, 10]], [C.dred, C.rust, C.rust, C.orange]);
  p.polyShade([[8.5 + tip / 2, 3], [5.2, 11], [11.8, 11]], [C.orange, C.gold, C.gold, C.yellow]);
  p.sphere(8.5, 12, 5, 5, RAMP.fire);
  p.sphere(8.5, 12.6, 2.8, 2.6, [C.gold, C.yellow, C.yellow, C.white]);
  for (const ex of [6.3, 10.3]) p.rect(ex, 11.5, 1, 1.5, C.ddbrown).dot(ex, 11.5, C.dred);
  p.dot(8.5 + tip, 1.5 - f * 0.3, C.yellow).dot(3 - tip / 2, 3 + f, C.gold).dot(14 + tip / 2, 2 + f, C.orange); // iskry
  return p.outline(C.dred);
}

/** Wirujący: kolczasta gwiazda z gradientem i okiem w środku, obraca się. */
function spinner(f: number): Painter {
  const p = new Painter(21, 21, HI);
  const rot = -Math.PI / 2 + f * (Math.PI / 20);
  p.polyShade(starPts(10.5, 10.5, 5, 9.5, 4, rot), [C.navy, C.plum, C.plum, C.pink]);
  p.polyShade(starPts(10.5, 10.5, 5, 6.8, 3, rot), [C.plum, C.pink, C.pink, C.salmon]);
  for (let k = 0; k < 5; k++) { const a = rot + (k * 2 * Math.PI) / 5; p.thin(10.5 + Math.cos(a) * 4, 10.5 + Math.sin(a) * 4, 10.5 + Math.cos(a) * 8.5, 10.5 + Math.sin(a) * 8.5, C.salmon); }
  p.sphere(10.5, 10.5, 3.6, 3.6, RAMP.purple);
  p.disc(10.8, 10.8, 1.4, C.black).dot(10, 9.8, C.white).dot(10.5, 9.8, C.white);
  return p.outline();
}

/** Kultysta: zakapturzona postać w niebieskiej szacie z haftem, świecące oczy i kula mocy (f=1: rozbłysk, f=2/3: szata faluje). */
function cultist(f: number): Painter {
  const p = new Painter(16, 19, HI);
  const sway = f === 2 ? -1 : f === 3 ? 1 : 0;
  p.polyShade([[8, 1], [13, 7], [14.5 + sway, 18], [1.5 + sway, 18], [3, 7]], RAMP.blue);
  p.thin(8, 7, 8 + sway, 17.5, C.navy).thin(2 + sway, 17.5, 14 + sway, 17.5, C.cyan);
  p.thin(5, 9, 3.5 + sway, 17, C.dblue).thin(11, 9, 12.5 + sway, 17, C.dblue);
  for (const x of [4.5, 7, 9, 11.5]) p.dot(x + sway, 16.8, C.cyan); // haft przy rąbku
  // Wnętrze kaptura i oczy.
  p.sphere(8, 6.5, 3.6, 3.2, [C.black, C.navy, C.navy, C.dblue]);
  for (const ex of [6.2, 9.6]) p.dot(ex, 6.2, f ? C.white : C.cyan).dot(ex + 0.5, 6.2, C.cyan).dot(ex, 6.7, C.blue);
  // Rękawy obejmujące kulę mocy.
  p.thin(3.5, 10, 6, 11.8, C.navy).thin(12.5, 10, 10, 11.8, C.navy);
  p.sphere(5.6, 12.2, 1, 0.8, [C.slate, C.dgray, C.lavender, C.lgray]).sphere(10.4, 12.2, 1, 0.8, [C.slate, C.dgray, C.lavender, C.lgray]);
  const orb = f ? 2.6 : 2;
  p.sphere(8, 12.5, orb, orb, [C.dblue, C.blue, C.cyan, C.white]).dot(7.3, 11.6, C.white);
  if (f === 1) p.dot(5, 10.5, C.white).dot(11, 10.5, C.white).dot(8, 9.6, C.cyan);
  return p.outline(C.navy);
}

/** Strażnik: unoszący się kryształ z fasetami i okiem; runy krążą wokół (4 klatki), rdzeń pulsuje. */
function sentinel(f: number): Painter {
  const p = new Painter(20, 24, HI);
  const o = f % 2 ? 0 : 1;
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + f * (Math.PI / 6);
    const x = 10 + Math.cos(a) * 8.5, y = 10 + o + Math.sin(a) * 3.5, col = k === f % 3 ? C.white : C.cyan;
    p.dot(x, y, col).dot(x + 0.5, y, col).dot(x, y + 0.5, C.blue);
  }
  // Fasety: lewa jasna, prawa ciemna, dolne w półcieniu.
  p.polyShade([[10, 1 + o], [3, 9 + o], [10, 9 + o]], [C.blue, C.cyan, C.cyan, C.white]);
  p.polyShade([[10, 1 + o], [17, 9 + o], [10, 9 + o]], [C.dblue, C.blue, C.blue, C.cyan]);
  p.polyShade([[3, 9 + o], [10, 21 + o], [10, 9 + o]], [C.dblue, C.blue, C.blue, C.cyan]);
  p.polyShade([[17, 9 + o], [10, 21 + o], [10, 9 + o]], [C.navy, C.dblue, C.dblue, C.blue]);
  p.thin(10, 1.5 + o, 10, 20.5 + o, C.white).thin(3.5, 9 + o, 16.5, 9 + o, C.dblue);
  p.sphere(10, 10 + o, 2.8, 2.8, f % 2 ? [C.plum, C.pink, C.salmon, C.white] : RAMP.purple);
  p.disc(10.2, 10.2 + o, 0.9, C.black).dot(9.5, 9.5 + o, C.white);
  // Runiczny krąg pod kryształem.
  p.thin(5, 23, 15, 23, C.slate);
  for (const x of [4, 7, 10, 13, 16]) p.dot(x, 22.5, C.cyan);
  return p.outline(C.navy);
}

/** Mimik: skrzynia z okuciami i zamkiem, kłapie zębami (klatka 1 = otwarta paszcza z językiem). */
function mimic(f: number): Painter {
  const p = new Painter(20, 18, HI);
  const open = f === 1 ? 3 : 0;
  p.block(2, 9, 16, 8, RAMP.wood);
  for (const y of [11, 14]) p.thin(2.5, y, 17.5, y, C.dbrown); // słoje desek
  p.rect(2, 12, 16, 1, C.gold).rect(4, 9, 1, 8, C.gold).rect(15, 9, 1, 8, C.gold);
  p.block(2, 3 - open, 16, 6, RAMP.wood).rect(2, 3 - open, 16, 1, C.clay).rect(4, 3 - open, 1, 6, C.gold).rect(15, 3 - open, 1, 6, C.gold);
  p.rect(9, 7 - open, 2, 2.5, C.gold).dot(9.5, 8 - open, C.black).dot(9, 7 - open, C.yellow); // zamek
  if (open) { p.rect(3, 6, 14, 3, C.dred).polyShade([[7, 7], [13, 7], [12, 9], [8, 9]], [C.red, C.salmon, C.salmon, C.peach]); }
  for (let x = 3; x < 17; x += 2) { p.polyShade([[x, 9 - (open ? 1 : 0)], [x + 1, 9 - (open ? 1 : 0)], [x + 0.5, 10.5 - (open ? 1 : 0)]], RAMP.bone); p.polyShade([[x + 1, 8 + open], [x + 2, 8 + open], [x + 1.5, 6.5 + open]], RAMP.bone); }
  for (const ex of [6, 13]) p.disc(ex + 0.5, 4.5 - open, 0.8, C.red).dot(ex + 0.2, 4.2 - open, C.yellow);
  return p.outline();
}

/** Biały jeleń: smukła sylwetka z rozgałęzionym porożem, bieg w 4 klatkach. */
function stag(f: number): Painter {
  const p = new Painter(24, 22, HI);
  const leg = [0, 1, 0, -1][f];
  // Nogi z kopytami.
  for (const [x, d] of [[6, leg], [9, -leg], [14, leg], [16, -leg]]) p.thin(x, 13.5, x + d, 19.5, C.lgray).thin(x + 0.5, 13.5, x + d + 0.5, 19.5, C.lavender).dot(x + d, 20, C.dgray).dot(x + d + 0.5, 20, C.dgray);
  p.sphere(11, 11, 7, 3.6, RAMP.bone);
  p.polyShade([[15, 9], [17.5, 5.5], [19.5, 7], [17.5, 11]], RAMP.bone); // szyja
  p.sphere(18.5, 6.6, 2.6, 2.3, RAMP.bone).sphere(20.6, 7.4, 1.2, 1, RAMP.bone);
  p.dot(21.4, 7.4, C.dgray).dot(19, 6.2, C.black).dot(18.8, 6, C.cyan);
  // Rozgałęzione poroże.
  for (const d of [-1, 1]) {
    const bx = 18.5 + d * 1;
    p.thin(bx, 4.5, bx + d * 2, 0.5, C.cream).thin(bx + d * 1, 2.5, bx + d * 3, 2, C.cream).thin(bx + d * 1.5, 1.5, bx + d * 0.5, 0, C.cream);
  }
  p.dot(4.5, 9.5, C.white).dot(4, 10, C.white); // ogon
  p.thin(6, 13.6, 16, 13.6, C.lgray);
  return p.outline();
}

/** Tarczownik: zbrojny w hełmie z pióropuszem (tarcza rysowana osobno, zgodnie z kierunkiem, w render.ts). */
function shieldbearer(f: number): Painter {
  const p = new Painter(18, 20, HI);
  const s = f === 1 ? 1 : 0;
  p.block(6, 15, 2, 4 + s, RAMP.stone).block(10, 15, 2, 5 - s, RAMP.stone);
  // Napierśnik z pasem, naramiennikami i nitami.
  p.sphere(9, 11, 5, 4.4, RAMP.stone);
  p.rect(4.5, 11.5, 9, 1, C.dbrown).rect(8.5, 11.5, 1, 1, C.gold);
  p.sphere(4.6, 8.6, 1.8, 1.4, RAMP.stone).sphere(13.4, 8.6, 1.8, 1.4, RAMP.stone);
  for (const [x, y] of [[6.5, 9.5], [11.5, 9.5], [7, 13.5], [11, 13.5]] as const) p.dot(x, y, C.lgray);
  // Hełm z przyłbicą, czerwone oczy, pióropusz.
  p.sphere(9, 5, 3.6, 3.6, RAMP.stone);
  p.rect(6.6, 4, 5, 1, C.black).dot(7.8, 4, C.red).dot(10.2, 4, C.red).dot(7.8, 4.5, C.dred).dot(10.2, 4.5, C.dred);
  p.thin(6, 6.4, 12, 6.4, C.lavender);
  p.polyShade([[8.5, 2], [9.5, 2], [10.5 + s * 0.5, -0.2], [12, 0.6 + s * 0.5], [10, 2.6]], RAMP.red);
  return p.outline();
}

/** Przywoływacz: szaman w kościanej masce, szata z piórami, kostur z kulą, która pulsuje przed przywołaniem. */
function summoner(f: number): Painter {
  const p = new Painter(18, 21, HI);
  p.polyShade([[9, 3], [14, 9], [15, 20], [3, 20], [4, 9]], RAMP.purple);
  p.thin(9, 10, 9, 19.5, C.plum).thin(3.4, 19.6, 14.6, 19.6, C.pink);
  for (const [x, y] of [[4.5, 10], [13.5, 10], [5, 12], [13, 12]] as const) p.thin(x, y, x + (x < 9 ? -1 : 1), y + 2, C.cream); // pióra przy ramionach
  for (const x of [5.5, 8, 10, 12.5]) p.dot(x, 17.5, C.lime); // runy
  // Kościana maska z rogami i szparami oczu.
  p.polyShade([[6, 3.4], [5, 1], [6.8, 2.6]], RAMP.bone).polyShade([[12, 3.4], [13, 1], [11.2, 2.6]], RAMP.bone);
  p.sphere(9, 6, 3.5, 3, RAMP.bone);
  p.rect(7.4, 5.6, 1.2, 0.8, C.black).rect(9.6, 5.6, 1.2, 0.8, C.black).dot(7.8, 5.6, C.lime).dot(10, 5.6, C.lime);
  p.rect(8, 8, 2.2, 0.8, C.dred).thin(9, 3.8, 9, 5, C.lavender);
  // Kostur z kulą.
  const r = 2 + (f % 2) * 0.6;
  p.line(15, 4, 15, 20, C.brown).thin(14.8, 4.5, 14.8, 19.5, C.clay);
  p.sphere(15, 3, r, r, [C.dgreen, C.green, C.lime, C.white]).dot(14.4, 2.3, C.white);
  if (f % 2) p.dot(12.5, 1.5, C.lime).dot(17.2, 1, C.lime).dot(15, 0, C.white);
  return p.outline();
}

/** Kamikaze: metalowa bomba z obręczą, gniewnymi oczami, lontem z iskrą i nóżkami. */
function kamikaze(f: number): Painter {
  const p = new Painter(14, 15, HI);
  p.sphere(7, 8, 5, 5, RAMP.night);
  p.ring(7, 8, 5, 0.5, C.slate).thin(2.2, 9.5, 11.8, 9.5, C.slate).thin(2.4, 10, 11.6, 10, C.dgray);
  p.dot(4.6, 5.4, C.white).dot(5, 5, C.lavender).dot(4.4, 6, C.lavender); // odblask
  // Gniewne oczy.
  p.thin(4.5, 6.6, 6, 7.4, C.black).thin(9.5, 6.6, 8, 7.4, C.black);
  p.rect(5, 7.6, 1, 1, f ? C.yellow : C.red).rect(8.5, 7.6, 1, 1, f ? C.yellow : C.red);
  // Nasadka, lont i iskra.
  p.rect(6, 2.6, 2, 1, C.dgray).thin(7, 2.6, 8.6, 1, C.brown).thin(8.6, 1, 9.4, 0.8, C.tan);
  p.dot(9.8, 0.2, f ? C.yellow : C.orange).dot(10.3, 0.6, f ? C.orange : C.yellow).dot(9.5, -0.2, C.white);
  p.rect(4, 12.6, 1.5, 1, C.dgray).rect(8.5, 12.6, 1.5, 1, C.dgray);
  return p.outline();
}

/** Skoczek: kryształowa zjawa z rozmytym konturem i iskrami teleportu (4 klatki migotania). */
function blinker(f: number): Painter {
  const p = new Painter(16, 18, HI);
  p.polyShade([[8, 1], [13, 7], [12, 17], [8, 14], [4, 17], [3, 7]], [C.navy, C.dblue, C.cyan, C.white]);
  p.thin(8, 1.5, 8, 13.5, C.white).thin(3.5, 7, 12.5, 7, C.blue);
  for (const ex of [5, 9]) p.rect(ex, 6, 2, 2, C.black).dot(ex, 6, C.white).dot(ex + 1.5, 7.5, C.cyan);
  for (let k = 0; k < 4; k++) {
    const x = 1.5 + ((f + k * 3) % 13), y = 2 + ((f * 5 + k * 4) % 14);
    p.dot(x, y, C.cyan).dot(x + 0.5, y, C.white);
  }
  return p.outline();
}

/** Pajęczarz: pająk z odwłokiem w kształt czaszki, ośmioma stawowymi nogami i wieloma oczami (4 klatki chodu). */
function weaver(f: number): Painter {
  const p = new Painter(22, 16, HI);
  for (let k = 0; k < 4; k++) {
    const o = (k + f) % 2 ? 1 : -1;
    // Noga z kolanem: udo w górę, goleń w dół.
    for (const side of [-1, 1]) {
      const bx = 11 + side * 3, kx = 11 + side * (5.5 + k * 1.2), ky = 3 + k * 1.6 + o * 0.5, ex = 11 + side * (9.5 - k * 0.3), ey = 6 + k * 3 + o;
      p.thin(bx, 8, kx, ky, C.dgray).thin(kx, ky, ex, ey, C.slate).dot(kx, ky, C.lavender);
    }
  }
  p.sphere(11, 9.5, 5, 4.5, RAMP.night);
  // Znak czaszki na odwłoku.
  p.disc(11, 9.6, 1.6, C.lgray).rect(10.2, 10.6, 1.6, 1, C.lgray).dot(10.4, 9.4, C.black).dot(11.6, 9.4, C.black).dot(11, 10.2, C.dgray);
  p.sphere(11, 5, 3, 2.5, RAMP.night);
  for (const [x, y, c] of [[10, 4, C.red], [12, 4, C.red], [9.5, 5, C.dred], [12.5, 5, C.dred], [11, 3.5, C.hotpink]] as const) p.dot(x, y, c);
  p.dot(10, 6.6, C.white).dot(12, 6.6, C.white); // szczękoczułki
  return p.outline();
}

export const ACTORS: Record<string, (f: number) => Painter> = {
  kestra, borgun, ignara, morwen, vesper, aurel, wraith, wraithbig, angel, angelbig, slime, goldslime, bat, golem, eye, wisp, spinner, cultist, sentinel, mimic, stag,
  shieldbearer, summoner, kamikaze, blinker, weaver,
};

/**
 * Boss 37×38: szata w kolorach biomu (cieniowana, z fałdami, runami i pasem), naramienniki z kolcami, czaszka, korona
 * z klejnotami, pulsujące kule mocy i iskry wokół (4 klatki: oddech, puls kul, krążące iskry, falujący dół szaty).
 */
export function boss(b: Biome, f: number): Painter {
  const p = new Painter(37, 38, HI);
  const robe = b.bossRobe;
  const o = f % 2 ? 0 : 1; // klatki parzyste o piksel niżej — "oddech"
  const wave = (f >> 1) & 1;
  // Szata: trapez z falującym, postrzępionym dołem.
  const hem: [number, number][] = [];
  for (let x = 30; x >= 6; x -= 2) hem.push([x, 33.6 + ((x / 2 + wave) % 2 ? 0.8 : 0)]);
  p.polyShade([[12, 16 + o], [24, 16 + o], [30.5, 33.6], ...hem, [5.5, 33.6]], robe);
  for (const x of [10, 14.5, 21.5, 26]) p.thin(x + (x < 18 ? 2 : -2), 19 + o, x + (wave ? 0.5 : -0.5), 33, robe[0]); // fałdy
  p.thin(18, 26, 18, 33.5, robe[0]).thin(12, 16.4 + o, 24, 16.4 + o, robe[3]);
  for (const [x, y] of [[13, 28], [18, 30], [23, 28]] as const) {
    const col = f === 2 ? C.white : b.accent;
    p.dot(x, y, col).dot(x + 0.5, y, col).dot(x, y + 0.5, col).dot(x - 0.5, y + 1, col).dot(x + 1, y + 1, col);
  }
  // Pas z klamrą.
  p.rect(11, 24, 15, 2, C.ddbrown).thin(11, 24, 26, 24, C.dbrown).rect(17, 23.5, 3, 3, C.gold).dot(17.5, 24, C.yellow).dot(18.5, 25, C.dred);
  // Rękawy.
  p.polyShade([[12, 18 + o], [8, 21 + o], [7, 24 + o], [10, 23 + o]], robe).polyShade([[24, 18 + o], [28, 21 + o], [29, 24 + o], [26, 23 + o]], robe);
  // Naramienniki z kolcami.
  for (const sx of [10, 26]) {
    const d = sx < 18 ? -1 : 1;
    p.sphere(sx, 18 + o, 3.6, 2.6, RAMP.stone);
    p.polyShade([[sx - 0.6, 16.2 + o], [sx + 0.6, 16.2 + o], [sx + d * 2.4, 12.6 + o]], RAMP.bone);
    p.dot(sx - 1.5, 17.2 + o, C.white).thin(sx - 3, 19.6 + o, sx + 3, 19.6 + o, C.dgray);
  }
  // Kule mocy z poświatą i krążące iskry.
  const orb = 3.6 + (f % 2 ? 0.8 : 0);
  p.ring(5, 23 + o, orb + 1, 0.5, C.pink).sphere(5, 23 + o, orb, orb, RAMP.purple).dot(4, 21.8 + o, C.white).dot(4.5, 21.8 + o, C.white);
  p.ring(31, 23 + o, orb + 1, 0.5, C.cyan).sphere(31, 23 + o, orb, orb, RAMP.blue).dot(30, 21.8 + o, C.white).dot(30.5, 21.8 + o, C.white);
  for (const [cx, col] of [[5, C.pink], [31, C.cyan]] as const) {
    const a = f * (Math.PI / 2);
    for (const k of [0, Math.PI]) p.dot(cx + Math.cos(a + k) * 5.8, 23 + o + Math.sin(a + k) * 5.8, k ? C.white : col);
  }
  // Czaszka: pęknięcia, oczodoły z żarem, nos, szczęka z zębami.
  p.sphere(18, 11 + o, 7, 7, RAMP.bone);
  p.thin(13, 7.5 + o, 14.5, 10 + o, C.lavender).thin(14.5, 10 + o, 13.8, 11 + o, C.lavender).thin(23, 12.5 + o, 22, 14 + o, C.lavender);
  const glow = f % 2 ? C.red : C.hotpink;
  for (const ex of [15.5, 21.5]) p.sphere(ex, 11.5 + o, 1.8, 1.8, [C.black, C.black, C.navy, C.navy]).rect(ex - 0.5, 11.5 + o, 1, 1, glow).dot(ex - 0.5, 11.5 + o, C.white);
  p.polyShade([[17.2, 13.6 + o], [18.8, 13.6 + o], [18, 15 + o]], [C.black, C.black, C.navy, C.navy]);
  p.rect(14, 16 + o, 8, 2, C.cream).thin(14, 16 + o, 22, 16 + o, C.white);
  for (let x = 15; x < 22; x += 1.5) p.thin(x, 16 + o, x, 18 + o, C.lavender);
  // Korona z klejnotami.
  p.polyShade([[10, 6 + o], [12, 1 + o], [14, 4 + o], [18, 0.2 + o], [22, 4 + o], [24, 1 + o], [26, 6 + o], [26, 7 + o], [10, 7 + o]], RAMP.gold);
  p.thin(10.5, 4.5 + o, 25.5, 4.5 + o, C.yellow).thin(10.5, 6.8 + o, 25.5, 6.8 + o, C.orange);
  for (const [x, col] of [[14, C.hotpink], [18, C.cyan], [22, C.hotpink]] as const) p.disc(x, 5.6 + o, 0.9, col).dot(x - 0.3, 5.2 + o, C.white);
  for (const x of [12, 18, 24]) p.dot(x, 1.2 + o, C.white);
  return p.outline();
}
