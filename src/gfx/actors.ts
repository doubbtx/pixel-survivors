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
  takezo: { seq: [0, 1, 2, 3], speed: 7 },
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
  boar: { seq: [0, 1, 2, 3], speed: 6 },
  thornling: { seq: [0, 1, 0, 1, 2, 3], speed: 9 },
  toad: { seq: [0, 1, 2, 1, 0, 3], speed: 8 },
  lurker: { seq: [0, 1, 2, 3], speed: 8 },
  salamander: { seq: [0, 1, 2, 3], speed: 6 },
  scorpion: { seq: [0, 1, 2, 3], speed: 7 },
  splitter: { seq: [0, 1, 2, 3], speed: 7 },
  mirror: { seq: [0, 1, 2, 3], speed: 6 },
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

/** Kultysta: zakapturzona postać w niebieskiej szacie z rozcięciem i złotym rąbkiem, oczy w cieniu kaptura i kula mocy w dłoniach (f=1: rozbłysk, f=2/3: szata faluje). */
function cultist(f: number): Painter {
  const p = new Painter(16, 19, HI);
  const sway = f === 2 ? -0.7 : f === 3 ? 0.7 : 0, flare = f === 1;
  // Szata: płaszcz rozszerzony ku dołowi, w rozcięciu ciemna suknia, złoty rąbek.
  p.polyShade([[8, 3], [12.6, 7], [14.6 + sway, 18], [1.4 + sway, 18], [3.4, 7]], RAMP.blue);
  p.polyShade([[8, 12], [10.4 + sway, 18], [5.6 + sway, 18]], [C.black, C.navy, C.navy, C.dblue]);
  p.thin(4.2, 9, 2.8 + sway, 16.6, C.cyan).thin(11.6, 9, 13.2 + sway, 16.6, C.navy).thin(6, 12, 5.2 + sway, 16.6, C.dblue);
  p.thin(1.8 + sway, 17.5, 14.2 + sway, 17.5, C.gold).thin(1.8 + sway, 18, 14.2 + sway, 18, C.dbrown);
  for (const x of [3.2, 12.8]) p.dot(x + sway, 16.8, C.gold).dot(x + sway, 16.2, C.orange);
  // Kaptur ze szpicem i jasną krawędzią, w środku głęboki cień.
  p.polyShade([[8, 0.4], [11.8, 3.6], [12.8, 8.6], [3.2, 8.6], [4.2, 3.6]], RAMP.blue);
  p.thin(4.4, 3.8, 7.8, 0.8, C.cyan).thin(3.6, 8.2, 4.4, 4, C.blue);
  p.sphere(8, 6.6, 3.1, 2.6, [C.black, C.black, C.navy, C.navy]);
  for (const ex of [6.4, 9.6]) p.rect(ex - 0.4, 6.2, 1.2, 0.8, C.cyan).dot(ex, 6.2, flare ? C.white : C.cyan).dot(ex, 6.9, C.dblue);
  // Rękawy zbiegające się przy kuli, blade dłonie.
  p.polyShade([[3.4, 8.4], [6.8, 11], [6.2, 13], [2.8, 10.6]], RAMP.blue).polyShade([[12.6, 8.4], [9.2, 11], [9.8, 13], [13.2, 10.6]], RAMP.blue);
  p.sphere(6.2, 12.4, 1, 0.8, RAMP.bone).sphere(9.8, 12.4, 1, 0.8, RAMP.bone);
  // Kula mocy: przy rozbłysku większa, z pierścieniem i iskrami.
  const orb = flare ? 2.6 : 2.1;
  if (flare) p.ring(8, 12.4, orb + 1.2, 0.5, C.cyan).dot(4.4, 10, C.white).dot(11.6, 10, C.white).dot(8, 8.8, C.cyan);
  p.sphere(8, 12.4, orb, orb, [C.dblue, C.blue, C.cyan, C.white]).dot(7.3, 11.6, C.white).dot(7.8, 11.6, C.white);
  return p.outline();
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

/** Tarczownik: zbrojny w hełmie z pióropuszem, czerwony wapenrok, buzdygan i pawęż z herbem (łuk tarczy w kierunku patrzenia rysuje render.ts). */
function shieldbearer(f: number): Painter {
  const p = new Painter(18, 20, HI);
  const [ll, rl] = [[4, 5], [5, 4], [4.5, 4.5]][f] ?? [4, 5], bob = f === 1 ? 0.5 : 0;
  // Nogi w nagolennikach, ciemne trzewiki.
  p.block(6, 15, 2.4, ll, RAMP.stone).block(10, 15, 2.4, rl, RAMP.stone);
  p.rect(5.6, 14 + ll, 3.2, 1, C.slate).rect(9.6, 14 + rl, 3.2, 1, C.slate);
  // Napierśnik, wapenrok z pasem i naramienniki.
  p.sphere(9, 11 + bob, 5, 4.6, RAMP.stone);
  p.polyShade([[7.4, 9 + bob], [10.6, 9 + bob], [11.2, 16 + bob], [6.8, 16 + bob]], RAMP.red);
  p.thin(9, 9.5 + bob, 9, 15.6 + bob, C.dred).thin(6.8, 15.8 + bob, 11.2, 15.8 + bob, C.gold);
  p.rect(4.6, 11.6 + bob, 8.8, 1, C.dbrown).rect(8.4, 11.4 + bob, 1.4, 1.4, C.gold).dot(8.6, 11.6 + bob, C.yellow);
  p.sphere(4.6, 8.4 + bob, 2, 1.5, RAMP.stone).sphere(13.4, 8.4 + bob, 2, 1.5, RAMP.stone).dot(3.8, 7.6 + bob, C.white).dot(12.6, 7.6 + bob, C.white);
  // Prawa ręka z buzdyganem.
  p.stroke(13.6, 12.4 + bob, 15.6, 6.4 + bob, C.brown).thin(13.6, 12.4 + bob, 15.6, 6.4 + bob, C.clay);
  p.sphere(15.8, 5.6 + bob, 1.6, 1.6, RAMP.stone).dot(15.2, 5 + bob, C.white);
  for (const [x, y] of [[15.8, 3.6], [17.4, 5.6], [14.2, 4.4]] as const) p.dot(x, y + bob, C.lgray);
  p.sphere(13.8, 12.6 + bob, 1.1, 1, RAMP.stone);
  // Hełm garnczkowy: wizjer z czerwonym żarem, nity, pióropusz.
  p.sphere(9, 5 + bob, 3.7, 3.7, RAMP.stone);
  p.rect(6.4, 4 + bob, 5.2, 1.1, C.black).dot(7.8, 4.2 + bob, C.red).dot(10.2, 4.2 + bob, C.red).dot(7.8, 4.7 + bob, C.dred).dot(10.2, 4.7 + bob, C.dred);
  p.thin(9, 5.4 + bob, 9, 8 + bob, C.dgray).thin(6, 6.6 + bob, 12, 6.6 + bob, C.lavender).dot(6.6, 2.6 + bob, C.white);
  p.polyShade([[8.4, 1.8 + bob], [9.6, 1.8 + bob], [10.6, -0.2 + bob], [12.4, 0.6 + bob], [10.2, 2.6 + bob]], RAMP.red);
  // Pawęż na lewym ramieniu: stalowa obwódka, niebieskie pole, złoty krzyż z guzem.
  const sy = bob;
  p.polyShade([[0.6, 7.6 + sy], [7.8, 7.6 + sy], [7.8, 13.6 + sy], [4.2, 18.4 + sy], [0.6, 13.6 + sy]], RAMP.stone);
  p.polyShade([[1.6, 8.6 + sy], [6.8, 8.6 + sy], [6.8, 13.2 + sy], [4.2, 17 + sy], [1.6, 13.2 + sy]], RAMP.blue);
  p.thin(4.2, 9 + sy, 4.2, 16.4 + sy, C.gold).thin(2, 11.6 + sy, 6.4, 11.6 + sy, C.gold);
  p.disc(4.2, 11.6 + sy, 1, C.yellow).dot(3.9, 11.3 + sy, C.white);
  p.thin(0.8, 7.8 + sy, 7.6, 7.8 + sy, C.white).thin(1.8, 9 + sy, 1.8, 12.6 + sy, C.cyan);
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

/** Kamikaze: żeliwna bomba z nitowaną obręczą, gniewnymi oczami, żarzącymi się pęknięciami, lontem z iskrą-gwiazdką i nóżkami (f=1: żar jaśniej). */
function kamikaze(f: number): Painter {
  const p = new Painter(14, 15, HI);
  const hot = f === 1;
  // Nóżki pod spodem.
  p.rect(3.6, 12.4, 2, 1.4, C.dgray).rect(8.4, 12.4, 2, 1.4, C.dgray).thin(3.6, 13.6, 5.6, 13.6, C.slate).thin(8.4, 13.6, 10.4, 13.6, C.slate);
  // Kula z połyskiem i obręczą z nitami.
  p.sphere(7, 8, 5.2, 5, RAMP.night);
  p.dot(4.4, 5.2, C.white).dot(4.9, 4.8, C.lgray).dot(4, 5.8, C.lavender).dot(5.4, 4.6, C.lavender);
  p.thin(1.9, 9.4, 12.1, 9.4, C.dgray).thin(2.1, 10.1, 11.9, 10.1, C.slate);
  for (const x of [3.4, 7, 10.6]) p.dot(x, 9.6, C.lgray);
  // Żarzące się pęknięcia.
  const crack = hot ? C.yellow : C.orange;
  p.thin(9.8, 4.6, 10.8, 6.4, crack).thin(10.8, 6.4, 10.2, 7.6, crack).thin(3.4, 11, 4.6, 12, hot ? C.orange : C.rust);
  // Gniewne brwi i oczy.
  p.thin(4.2, 6.2, 6.2, 7.2, C.black).thin(9.8, 6.2, 7.8, 7.2, C.black);
  p.rect(4.8, 7.6, 1.2, 1.2, hot ? C.yellow : C.red).rect(8.2, 7.6, 1.2, 1.2, hot ? C.yellow : C.red).dot(4.8, 7.6, C.white).dot(8.2, 7.6, C.white);
  // Nasadka, lont i iskra.
  p.block(5.6, 2.2, 2.8, 1.4, RAMP.stone);
  p.thin(7.2, 2.2, 8.6, 1, C.brown).thin(8.6, 1, 9.6, 1, C.tan);
  const sx = 10.4, sy = 0.8;
  p.dot(sx, sy, C.white).dot(sx - 0.7, sy, hot ? C.yellow : C.orange).dot(sx + 0.7, sy, hot ? C.yellow : C.orange).dot(sx, sy - 0.7, C.yellow).dot(sx, sy + 0.7, C.gold);
  if (hot) p.dot(sx + 1.2, sy - 0.6, C.yellow).dot(sx - 1, sy + 1, C.orange);
  return p.outline();
}

/** Skoczek: kryształowa zjawa z jasną i ciemną fasetą, szczytem z odblaskiem, odłamkami u dołu i iskrami teleportu (4 klatki migotania). */
function blinker(f: number): Painter {
  const p = new Painter(16, 18, HI);
  const lift = f % 2 ? -0.5 : 0;
  // Ślad teleportu: blady odłamek w tle, przesuwa się z klatkami.
  const gx = [2, 13, 3, 12][f];
  p.polyShade([[gx, 9], [gx + 1.2, 11.5], [gx, 14], [gx - 1.2, 11.5]], [C.dblue, C.blue, C.blue, C.cyan]);
  // Główny kryształ: jasna faseta lewa, ciemna prawa, szczyt z białym odblaskiem.
  p.polyShade([[8, 1 + lift], [3, 7 + lift], [4.4, 14.6 + lift], [8, 12.6 + lift]], [C.dblue, C.blue, C.cyan, C.white]);
  p.polyShade([[8, 1 + lift], [13, 7 + lift], [11.6, 14.6 + lift], [8, 12.6 + lift]], [C.navy, C.dblue, C.blue, C.cyan]);
  p.polyShade([[8, 1 + lift], [5.4, 5 + lift], [8, 6.2 + lift], [10.6, 5 + lift]], [C.blue, C.cyan, C.white, C.white]);
  p.thin(8, 6.2 + lift, 8, 12.4 + lift, C.navy).thin(3.4, 7 + lift, 4.6, 13.8 + lift, C.white).dot(6.4, 3 + lift, C.white);
  // Oczy: ciemne szczeliny z cyjanowym żarem.
  for (const ex of [5.6, 9.4]) p.rect(ex, 7.6 + lift, 1.4, 1.6, C.navy).dot(ex + 0.4, 8 + lift, f === 2 ? C.white : C.cyan);
  // Odłamki unoszące się pod kryształem.
  p.polyShade([[5.2, 15.2 + lift], [6.6, 15 + lift], [5.8, 17.6]], [C.dblue, C.blue, C.cyan, C.cyan]);
  p.polyShade([[9.4, 15 + lift], [10.8, 15.2 + lift], [10.2, 17.6]], [C.navy, C.dblue, C.blue, C.cyan]);
  // Iskry teleportu.
  for (let k = 0; k < 4; k++) {
    const a = f * 0.8 + k * (Math.PI / 2), x = 8 + Math.cos(a) * 6.6, y = 8.6 + Math.sin(a) * 6.6;
    p.dot(x, y, k % 2 ? C.white : C.cyan);
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

/* ── Wrogowie biomów (0.30). Domyślnie zwróceni w prawo (gra odbija sprite, gdy wróg stoi na prawo od gracza). ── */

/** Dzik: masywny tułów z grzywą szczeciny, kły, racice w cyklu kłusa (4 klatki). */
function boar(f: number): Painter {
  const p = new Painter(24, 17, HI);
  const bob = f % 2 ? -0.5 : 0, [a, b] = [[0, 1], [1, 0], [0, -1], [-1, 0]][f];
  // Nogi (tylne ciemniejsze) z racicami.
  for (const [x, o, dark] of [[6, -a, 1], [9, b, 0], [15, a, 1], [18, -b, 0]] as const) {
    p.block(x + o * 0.5, 11, 2, 4 - Math.abs(o) * 0.5, dark ? [C.ddbrown, C.ddbrown, C.dbrown, C.dbrown] : RAMP.wood);
    p.rect(x + o * 0.5, 14.6 - Math.abs(o) * 0.5, 2, 0.8, C.black);
  }
  p.sphere(11, 9 + bob, 8, 4.6, RAMP.wood);
  p.thin(5, 12 + bob, 16, 12.4 + bob, C.ddbrown);
  // Grzywa szczeciny na grzbiecie.
  for (let x = 5; x <= 15; x += 1.5) p.thin(x, 5.4 + bob, x - 0.8, 3.6 + bob + (x % 3 ? 0 : -0.6), C.dbrown);
  // Głowa z ryjem, uchem, okiem i kłami.
  p.sphere(18.5, 9.5 + bob, 3.8, 3.4, RAMP.wood);
  p.polyShade([[17, 6.4 + bob], [16.4, 3.6 + bob], [18.8, 5.8 + bob]], RAMP.wood);
  p.sphere(22, 10.5 + bob, 1.6, 1.6, [C.dbrown, C.clay, C.tan, C.peach]).dot(22.4, 10.2 + bob, C.dbrown).dot(22.4, 11 + bob, C.dbrown);
  p.rect(19, 8 + bob, 1, 1, C.red).dot(19, 8 + bob, C.yellow);
  p.thin(20.6, 12 + bob, 21.6, 10.4 + bob, C.cream).dot(21.6, 10.2 + bob, C.white);
  // Ogon-chwost.
  p.thin(3.2, 8 + bob, 2, 6.6 + bob, C.dbrown).dot(1.8, 6.4 + bob, C.ddbrown);
  return p.outline();
}

/** Cierniak: krzaczasta istota z kolcami, korzeniami-nóżkami i kwitnącym pąkiem-moździerzem na głowie. */
function thornling(f: number): Painter {
  const p = new Painter(18, 19, HI);
  const sw = f % 2 ? 0.5 : -0.5;
  for (const [x, o] of [[6, -1], [9, 0], [12, 1]] as const) p.thin(x, 14, x + o * 1.5, 18, C.dbrown).thin(x + o * 1.5, 18, x + o * 2.5, 18, C.brown);
  p.sphere(9, 11, 5.5, 4.8, RAMP.green);
  // Kolce dookoła krzaka.
  for (let k = 0; k < 9; k++) {
    const an = -Math.PI * 0.95 + (k / 8) * Math.PI * 1.9 + sw * 0.1, x = 9 + Math.cos(an) * 5, y = 11 + Math.sin(an) * 4.4;
    p.thin(x, y, x + Math.cos(an) * 1.8, y + Math.sin(an) * 1.6, C.cream);
  }
  for (const [x, y] of [[6, 9], [11.5, 12.5], [7.5, 13]] as const) p.dot(x, y, C.teal);
  // Oczy-szpary.
  p.rect(6.6, 10, 1.2, 1, C.black).rect(10.2, 10, 1.2, 1, C.black).dot(7, 10, C.yellow).dot(10.6, 10, C.yellow);
  // Pąk na łodyżce: puchnie przed strzałem (klatki 2-3).
  const r = f >= 2 ? 2.4 : 1.9;
  p.thin(9, 6.4, 9 + sw, 4.2, C.dgreen);
  p.sphere(9 + sw, 3 - (r - 1.9), r, r, [C.dred, C.plum, C.hotpink, C.salmon]);
  p.thin(7.6 + sw, 4.4, 10.4 + sw, 4.4, C.green).dot(8.6 + sw, 2, C.white);
  return p.outline();
}

/** Ropucha bagienna: przysadzista, brodawkowata, z workiem rezonansowym, który nadyma się w klatkach 1-2. */
function toad(f: number): Painter {
  const p = new Painter(20, 15, HI);
  const sq = f === 3 ? 0.6 : 0;
  // Tylne łapy w przysiadzie.
  p.sphere(4.5, 11 + sq, 3.2, 2.6, [C.teal, C.dgreen, C.green, C.green]).sphere(15.5, 11 + sq, 3.2, 2.6, [C.teal, C.dgreen, C.green, C.green]);
  p.thin(2, 13.6, 4.4, 13.6, C.dgreen).thin(15.6, 13.6, 18, 13.6, C.dgreen);
  p.sphere(10, 9 + sq, 7, 4.8 - sq, RAMP.green);
  // Worek pod gardłem.
  const sac = [1.6, 2.2, 2.6, 1.4][f];
  p.sphere(13.5, 12 + sq, sac + 0.4, sac * 0.8, [C.tan, C.cream, C.cream, C.white]);
  // Brodawki.
  for (const [x, y] of [[6, 7.5], [8, 6], [11, 6.6], [5, 10], [9, 9.6]] as const) p.dot(x, y + sq, C.teal).dot(x + 0.5, y + sq - 0.5, C.lime);
  // Wyłupiaste oczy na czubku.
  for (const ex of [12, 15.4]) p.sphere(ex, 5.2 + sq, 1.7, 1.7, [C.dbrown, C.orange, C.gold, C.yellow]).rect(ex - 0.8, 5 + sq, 1.8, 0.6, C.black);
  p.thin(13, 10 + sq, 17.4, 9.4 + sq, C.dgreen);
  p.rect(6, 13.4, 8, 1, C.dgreen);
  return p.outline();
}

/** Topielec: utopiec z wodorostami we włosach, sinoniebieska skóra, długie szpony i ociekająca woda. */
function lurker(f: number): Painter {
  const p = new Painter(18, 22, HI);
  const sw = [0, 0.5, 0, -0.5][f];
  p.block(6, 16, 2, 5, [C.navy, C.dblue, C.dblue, C.blue]).block(10, 16, 2, 5 - Math.abs(sw), [C.navy, C.dblue, C.dblue, C.blue]);
  p.polyShade([[4, 8], [14, 8], [13, 17], [5, 17]], [C.navy, C.teal, C.dblue, C.blue]);
  // Żebra.
  for (const y of [10.5, 12, 13.5]) p.thin(6.5, y, 11.5, y, C.navy);
  // Ramiona ze szponami wyciągniętymi do przodu.
  p.thin(13.5, 9, 16.5, 12 + sw, C.dblue).thin(16.5, 12 + sw, 17.5, 13.5 + sw, C.cyan).thin(16.5, 12 + sw, 16.4, 14 + sw, C.cyan);
  p.thin(4.5, 9, 2.5, 13 - sw, C.dblue).thin(2.5, 13 - sw, 2, 14.5 - sw, C.cyan);
  // Głowa, wodorosty, białe oczy.
  p.sphere(9, 5, 3.6, 3.6, [C.navy, C.teal, C.dblue, C.blue]);
  for (const [x, l] of [[5.6, 7], [7, 5], [11, 6], [12.6, 8]] as const) p.thin(x, 2.4, x + sw * 0.6, 2.4 + l, (x * 2) % 3 ? C.dgreen : C.green);
  p.thin(6, 2, 12, 2, C.dgreen);
  p.rect(7.4, 4.6, 1, 1, C.white).rect(10, 4.6, 1, 1, C.white);
  p.thin(7.6, 7, 10.4, 7, C.black).dot(8.4, 7.4, C.white).dot(9.6, 7.4, C.white);
  // Kapiące krople.
  p.dot(4.4, 17.5 + f % 2, C.cyan).dot(13.4, 18.5 - f % 2, C.cyan);
  return p.outline();
}

/** Salamandra: ognista jaszczurka z płonącym grzebieniem, łuskami i wężowym ogonem (4 klatki chodu). */
function salamander(f: number): Painter {
  const p = new Painter(24, 15, HI);
  const w = [0, 1, 0, -1][f];
  // Ogon falujący.
  p.thin(6, 9, 3, 9 + w * 0.6, C.rust).thin(3, 9 + w * 0.6, 1, 7.6 - w * 0.4, C.orange).dot(0.8, 7.4, C.gold);
  // Łapy rozstawione.
  for (const [x, o] of [[8, w], [16, -w]] as const) { p.thin(x, 10, x - 1 + o, 13, C.dred).thin(x + 2, 10, x + 3 - o, 13, C.dred); }
  p.sphere(12, 9, 6.5, 2.8, RAMP.fire);
  for (let x = 8; x <= 16; x += 2) p.dot(x, 10.4, C.gold);
  // Głowa z paszczą.
  p.sphere(19.5, 8, 3.2, 2.4, RAMP.fire);
  p.thin(19, 9.2, 22.6, 9, C.dred);
  p.rect(20, 7, 1, 1, C.black).dot(20, 7, C.yellow);
  // Płonący grzebień.
  for (let k = 0; k < 6; k++) {
    const x = 7 + k * 2.2, h = 2 + ((k + f) % 3) * 0.8;
    p.thin(x, 6.6, x + 0.4, 6.6 - h, (k + f) % 2 ? C.gold : C.orange).dot(x + 0.4, 6.4 - h, C.yellow);
  }
  return p.outline();
}

/** Skorpion: segmentowany pancerz, szczypce, ogon zawinięty nad grzbietem z jarzącym się żądłem-celownikiem. */
function scorpion(f: number): Painter {
  const p = new Painter(24, 19, HI);
  const l = f % 2 ? 0.5 : -0.5;
  // Nogi.
  for (let k = 0; k < 3; k++) {
    const x = 9 + k * 2.5, o = (k + f) % 2 ? l : -l;
    p.thin(x, 13, x - 1.5 + o, 17.5, C.dbrown).thin(x, 13, x + 1.5 - o, 17.5, C.dbrown);
  }
  // Odwłok i ogon (segmenty łukiem nad grzbietem).
  p.sphere(11, 13, 5.5, 3, RAMP.gold);
  for (const x of [8, 10.5, 13]) p.thin(x, 10.6, x, 15, C.orange);
  const tail = [[6, 12], [3.5, 10], [3, 7], [4.5, 4.4], [7.5, 3]] as const;
  for (const [x, y] of tail) p.sphere(x, y, 1.6, 1.4, RAMP.gold);
  p.polyShade([[8.5, 2.2], [11, 3.4 + l * 0.5], [8.6, 4.2]], [C.dred, C.red, C.hotpink, C.salmon]);
  p.dot(10.4, 3.4 + l * 0.5, C.white);
  // Głowa i szczypce.
  p.sphere(17, 12.5, 2.8, 2.2, RAMP.gold);
  p.dot(17.6, 11.4, C.black).dot(18.6, 11.4, C.black);
  for (const [y, s] of [[10.5, -1], [14.5, 1]] as const) {
    p.thin(18.5, y, 20.5, y + s * 0.5, C.orange);
    p.polyShade([[20, y - 1.2], [23.5, y - 0.6 - l], [22, y + 0.2], [23.5, y + 1 + l], [20, y + 1.2]], RAMP.gold);
  }
  return p.outline();
}

/** Rozszczepieniec: pęknięta geoda — dwie połówki w ciemnej skorupie, w szczelinie kryształy i pulsujący rdzeń (pęka mocniej w klatkach 2-3). */
function splitter(f: number): Painter {
  const p = new Painter(18, 18, HI);
  const gap = f >= 2 ? 0.9 : 0.4, pulse = f % 2 === 1;
  const half = (cx: number, side: number): [number, number][] => {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 8; i++) {
      const a = -Math.PI / 2 + (side * i * Math.PI) / 8, r = 7 - (i % 2) * 0.5;
      pts.push([cx + Math.cos(a) * r, 9 + Math.sin(a) * r]);
    }
    return pts;
  };
  // Skorupa: lewa jaśniejsza (światło z lewej), prawa w cieniu.
  p.polyShade(half(9 - gap, -1), [C.navy, C.plum, C.pink, C.salmon]);
  p.polyShade(half(9 + gap, 1), [C.black, C.navy, C.plum, C.pink]);
  // Wnętrze geody przy szczelinie: kryształy.
  for (const [s, cx] of [[-1, 9 - gap], [1, 9 + gap]] as const) {
    for (const y of [4.5, 8, 11.5]) p.polyShade([[cx, y - 1.4], [cx + s * 2.4, y], [cx, y + 1.4]], [C.dblue, C.blue, C.cyan, C.white]);
  }
  // Szczelina i rdzeń.
  p.thin(9, 2.2, 9, 15.8, pulse ? C.white : C.hotpink);
  p.disc(9, 9, pulse ? 1.8 : 1.4, C.hotpink).disc(9, 9, 0.8, C.salmon).dot(8.8, 8.6, C.white);
  // Oczy na połówkach i rysy skorupy.
  for (const ex of [5.2, 11.6]) p.rect(ex, 6.6, 1.4, 1.6, C.black).dot(ex + 0.4, 6.8, ex < 9 ? C.white : C.salmon);
  p.thin(3, 11, 5, 13, C.plum).thin(14.4, 5, 13, 7, C.black).dot(4.2, 4.6, C.white).dot(4.6, 4.2, C.salmon);
  return p.outline();
}

/** Odbicie: lustrzany sobowtór — rycerz z tafli szkła (jasne, ciemne i odbijające niebo), hełm z wizjerem, ukośne refleksy, rysy i szklany miecz. */
function mirror(f: number): Painter {
  const p = new Painter(18, 22, HI);
  const glass = [C.slate, C.lavender, C.lgray, C.white], dark = [C.navy, C.slate, C.lavender, C.lgray], sky = [C.dblue, C.blue, C.cyan, C.white];
  const fl = f % 2 ? 0.4 : 0;
  // Płaszcz z tafli: lewa jasna, prawa ciemna, środkowa odbija niebo; poszarpany dół.
  p.polyShade([[9, 7], [4, 9], [3, 20], [6, 18], [9, 21]], glass);
  p.polyShade([[9, 7], [14, 9], [15, 20], [12, 18], [9, 21]], dark);
  p.polyShade([[9, 9], [11.4, 12], [9, 18], [6.6, 12]], sky);
  // Ukośne refleksy (przesuwają się z klatkami) i rysy.
  const o = f * 1.2;
  p.thin(4 + o * 0.5, 15 - o, 7 + o * 0.5, 11 - o, C.white).thin(5 + o * 0.5, 16 - o, 7.6 + o * 0.5, 12.6 - o, C.white);
  p.thin(12, 10, 13.4, 14, C.slate).thin(13.4, 14, 12.6, 16, C.slate).thin(5, 18, 6.4, 15.6, C.lavender);
  // Naramienniki-odłamki.
  p.polyShade([[3, 9.6], [6, 7.6], [5.4, 10.4]], glass).polyShade([[15, 9.6], [12, 7.6], [12.6, 10.4]], dark);
  // Hełm: fasetowany romb z wizjerem i cyjanowymi oczami.
  p.polyShade([[9, 1], [12.4, 4.6], [11.6, 8], [6.4, 8], [5.6, 4.6]], glass);
  p.polyShade([[9, 1], [12.4, 4.6], [11.6, 8], [9, 8]], dark);
  p.rect(6.4, 4.6, 5.2, 1.2, C.black).dot(7.6, 4.8, C.cyan).dot(10.4, 4.8, C.cyan).dot(6.8, 2.8, C.white);
  // Szklane ostrze z jelcem w wyciągniętej dłoni.
  p.thin(13.6, 11, 16, 11.6, C.lavender);
  p.thin(15, 10.6, 17.6, 11.4, C.gold);
  p.polyShade([[16, 11], [17.4, 1.6 + fl], [18, 2 + fl], [17, 11.4]], sky).thin(16.8, 10, 17.6, 2.4 + fl, C.white);
  return p.outline();
}

/**
 * Takezo: ronin na wzór Musashiego — granatowa hakama, szare kimono z brązowym pasem, związane włosy i czerwona opaska,
 * długi miecz w prawej dłoni (w górę), krótki w lewej (w dół). 4 klatki chodu, pole opaski powiewa.
 */
function takezo(f: number): Painter {
  const p = new Painter(22, 21, HI);
  const o = f % 2 === 1 ? -1 : 0;
  const flow = [0, 1, 0, -1][f];
  legs(p, f, 8, 11, 16, 2, C.black, C.dbrown);
  // Hakama: szerokie spodnie z fałdami.
  p.polyShade([[6.5, 12.5 + o], [14.5, 12.5 + o], [16, 18], [12, 18], [10.5, 15.5], [9, 18], [5, 18]], [C.black, C.navy, C.dblue, C.blue]);
  p.thin(8.2, 13.5 + o, 7, 17.8, C.navy).thin(12.8, 13.5 + o, 14, 17.8, C.navy).thin(10.5, 13 + o, 10.5, 15.4, C.navy);
  // Kimono z zakładką i pas obi.
  p.sphere(10.5, 10.5 + o, 4.4, 3.4, [C.slate, C.dgray, C.lavender, C.lgray]);
  p.thin(8.6, 8 + o, 11, 12 + o, C.lgray).thin(12.4, 8 + o, 11, 12 + o, C.slate);
  p.rect(6.5, 12 + o, 8, 1.2, C.dbrown).thin(6.5, 12 + o, 14.5, 12 + o, C.brown);
  // Głowa: dzika fryzura z kokiem, czerwona opaska z powiewającymi końcami.
  p.sphere(10.5, 6.3 + o, 3.3, 3.2, RAMP.skin);
  p.polyShade([[7, 5.8 + o], [7.5, 2.8 + o], [9.5, 2 + o], [12, 2.2 + o], [14, 3.5 + o], [14, 6 + o], [12.5, 4.4 + o], [8.5, 4.4 + o]], [C.black, C.black, C.navy, C.slate]);
  p.sphere(11, 1.2 + o, 1.2, 1, [C.black, C.black, C.navy, C.slate]);
  p.rect(7.3, 4.2 + o, 6.6, 0.9, C.red).thin(7.3, 4.2 + o, 13.9, 4.2 + o, C.salmon);
  p.thin(7.4, 4.6 + o, 5.5, 5.5 + o + flow * 0.4, C.red).thin(7.4, 4.9 + o, 5.8, 6.4 + o + flow * 0.5, C.dred);
  eyeAt(p, 9.6, 6.3 + o, C.black);
  eyeAt(p, 11.8, 6.3 + o, C.black);
  p.thin(9, 5.6 + o, 10.2, 5.8 + o, C.black).thin(11.4, 5.8 + o, 12.6, 5.6 + o, C.black);
  p.dot(10.7, 8 + o, C.dbrown).thin(9.5, 9 + o, 11.8, 9 + o, C.dbrown);
  // Długi miecz w prawej dłoni (w górę, w przód) i krótki w lewej (w dół).
  p.polyShade([[15.4, 9.6 + o], [21.2, 0.6 + o], [21.8, 1 + o], [16.2, 10.2 + o]], [C.slate, C.lavender, C.lgray, C.white]);
  p.thin(15.8, 9.4 + o, 21.3, 1 + o, C.white);
  p.stroke(14.4, 9 + o, 16.4, 10.8 + o, C.gold);
  p.thin(15.4, 10.6 + o, 14.2, 12.4 + o, C.dblue).thin(15.7, 10.8 + o, 14.5, 12.6 + o, C.navy);
  p.polyShade([[5.4, 13.6 + o], [2, 18 + o], [2.6, 18.4 + o], [6, 14.1 + o]], [C.slate, C.lavender, C.lgray, C.white]);
  p.stroke(4.6, 13 + o, 6.8, 14.2 + o, C.gold);
  p.thin(6.2, 12.6 + o, 7, 11.6 + o, C.dblue);
  p.sphere(14.6, 10.6 + o, 1, 0.9, RAMP.skin).sphere(6.4, 13 + o, 0.9, 0.8, RAMP.skin);
  return p.outline();
}

export const ACTORS: Record<string, (f: number) => Painter> = {
  kestra, borgun, ignara, morwen, vesper, aurel, takezo, wraith, wraithbig, angel, angelbig, slime, goldslime, bat, golem, eye, wisp, spinner, cultist, sentinel, mimic, stag,
  shieldbearer, summoner, kamikaze, blinker, weaver, boar, thornling, toad, lurker, salamander, scorpion, splitter, mirror,
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
