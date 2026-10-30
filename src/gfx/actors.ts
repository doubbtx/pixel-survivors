import { C, RAMP } from '../core/palette';
import type { Biome } from '../data/levels';
import { Painter, HI } from './painter';

/**
 * Postacie z klatkami animacji: bohaterowie (chód), wrogowie (pulsowanie, machanie skrzydłami,
 * mruganie, migotanie płomienia, obrót) i boss (oddech, pulsujące kule mocy).
 * Klatka `f` to parametr rysowania — kod gry wybiera ją przez animFrame().
 */

/** Śmierć według materiału (game/render.ts, efekt 'fade'): rozprysk, rozpad na spadające bryły, rozbicie na odłamki; reszta blednie. */
export type DeathStyle = 'fade' | 'splat' | 'crumble' | 'shatter';
export const DEATH_STYLE: Record<string, DeathStyle> = {
  slime: 'splat', goldslime: 'splat', toad: 'splat', toadqueen: 'splat', lurker: 'splat',
  golem: 'crumble', dungeonkeeper: 'crumble', shieldbearer: 'crumble', mimic: 'crumble',
  sentinel: 'shatter', vaultwarden: 'shatter', blinker: 'shatter', splitter: 'shatter', voidprism: 'shatter',
  mirror: 'shatter', shatterknight: 'shatter', spinner: 'shatter',
};

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
  boarking: { seq: [0, 1, 2, 3], speed: 7 },
  toadqueen: { seq: [0, 1, 2, 1, 0, 3], speed: 9 },
  sandtyrant: { seq: [0, 1, 2, 3], speed: 8 },
  shatterknight: { seq: [0, 1, 2, 3], speed: 7 },
  voidprism: { seq: [0, 1, 2, 3], speed: 8 },
  vaultwarden: { seq: [0, 1, 2, 3], speed: 11 },
  dungeonkeeper: { seq: [0, 1, 2, 3], speed: 11 },
};

/** Numer klatki dla czasu (kroki symulacji) z przesunięciem `seed`, żeby tłum nie ruszał się synchronicznie. */
export function animFrame(base: string, step: number, seed: number): number {
  const a = ANIM[base.startsWith('boss') ? 'boss' : base.split('~')[0]];
  if (!a) return 0;
  return a.seq[Math.floor((step + seed) / a.speed) % a.seq.length];
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
  // Postrzępiony całun z trzema językami, falującymi z klatką.
  p.polyShade([[cx - 4.4 * s, 6 * s], [cx + 4.4 * s, 6 * s], [cx + 3.4 * s + sway, 15 * s], [cx + 1.6 * s + sway, 12.6 * s], [cx + sway * 0.5, 15.6 * s], [cx - 1.6 * s + sway, 12.6 * s], [cx - 3.4 * s + sway, 15 * s]], pale);
  p.thin(cx - 1.6 * s, 9 * s, cx - 1.6 * s + sway, 12.2 * s, C.lavender).thin(cx + 1.6 * s, 9 * s, cx + 1.6 * s + sway, 12.2 * s, C.slate);
  p.thin(cx - 3.6 * s, 7 * s, cx - 2.8 * s + sway, 13.6 * s, C.white);
  // Rozwiane rękawy ze szponami.
  for (const d of [-1, 1]) {
    const tip: [number, number] = [cx + d * 6.4 * s, 10.4 * s - d * sway];
    p.polyShade([[cx + d * 3.6 * s, 6.4 * s], [cx + d * 4.6 * s, 9 * s], tip], pale);
    p.thin(tip[0], tip[1], tip[0] + d * 0.6 * s, tip[1] + 1.2 * s, C.lgray).thin(tip[0], tip[1], tip[0] - d * 0.2 * s, tip[1] + 1.4 * s, C.lgray);
  }
  // Kaptur ze szpicem i jasną krawędzią; twarz w głębokim cieniu.
  p.polyShade([[cx, 0.6 * s], [cx + 4.6 * s, 4.6 * s], [cx + 4 * s, 9 * s], [cx - 4 * s, 9 * s], [cx - 4.6 * s, 4.6 * s]], pale);
  p.thin(cx - 4.2 * s, 4.6 * s, cx - 0.4 * s, 1 * s, C.white);
  p.sphere(cx, 6 * s, 2.9 * s, 2.6 * s, [C.black, C.navy, C.navy, C.slate]);
  // Świecące oczy z poświatą (mrugają w klatce 2).
  const eye = f === 2 ? C.green : C.lime;
  for (const ex of [cx - 1.3 * s, cx + 1.1 * s]) p.rect(ex - 0.4 * s, 5.6 * s, 0.9 * s, 0.7 * s, eye).dot(ex, 5.6 * s, C.white);
  // Łańcuch z kajdanem na szyi.
  for (let k = 0; k < 4; k++) p.ring(cx - 2.4 * s + k * 1.6 * s, 9.6 * s + (k % 2) * 0.4, 0.6 * s, 0.3, C.dgray);
  if (big) {
    p.polyShade([[cx - 3.4 * s, 2.4 * s], [cx - 2.4 * s, 0.4], [cx - 1, 1.4 * s], [cx, 0], [cx + 1, 1.4 * s], [cx + 2.4 * s, 0.4], [cx + 3.4 * s, 2.4 * s], [cx, 3.2 * s]], RAMP.gold); // korona
    p.dot(cx, 1.8 * s, C.hotpink);
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
  // Skrzydła: wachlarz osobnych lotek (każda cieniowana), na nich zaokrąglone pokrywy przy barku ze złotą krawędzią.
  for (const d of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      const bx = cx + d * (2.8 + k * 0.5) * s, by = (6.6 + k * 1) * s;
      const tip: [number, number] = [cx + d * (7.6 - k * 0.5) * s, (2.6 + k * 2) * s - flap * (1 - k * 0.2)];
      p.polyShade([[bx - 0.9 * s, by], [bx + 0.9 * s, by], tip], k % 2 ? [C.lavender, C.lgray, C.white, C.white] : RAMP.bone);
    }
    p.sphere(cx + d * 4 * s, 7 * s - flap / 3, 2.2 * s, 1.6 * s, RAMP.bone);
    p.thin(cx + d * 2.2 * s, 8 * s, cx + d * 5.8 * s, 7.4 * s - flap / 3, C.gold);
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
function golem(f: number, deco?: Deco): Painter {
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
  deco?.(p, f);
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
    // Kopiowanie powieki co drobny piksel (środki pikseli 1/HI): krok 0.5 zostawiał kratkę.
    const copy = (y0: number, y1: number) => {
      for (let j = Math.round(y0 * HI); j < y1 * HI; j++) for (let i = 0; i < 18 * HI; i++) {
        const x = (i + 0.5) / HI, y = (j + 0.5) / HI, c = lid.get(x, y);
        if (c >= 0) p.dot(x, y, c);
      }
    };
    copy(0, edge);
    p.thin(2.2, edge, 15.8, edge, C.black);
    if (f === 2) {
      copy(edge, 18);
      for (const x of [5, 8, 11, 13]) p.thin(x, edge + 0.5, x - 0.5, edge + 1.5, C.black);
    }
  }
  return p.outline(C.plum);
}

/** Ognik: płomień w trzech warstwach (zewnętrzna, środkowa, rdzeń), ramiona-języki, żarzące się oczy z ciemną paszczą i iskry unoszące się w górę (3 klatki migotania). */
function wisp(f: number): Painter {
  const p = new Painter(17, 19, HI);
  const tip = [0, -1.5, 1.5][f];
  p.polyShade([[8.5 + tip, 0.5], [2.5, 11], [14.5, 11]], [C.dred, C.rust, C.orange, C.orange]);
  p.polyShade([[3, 9], [0.8, 4 + f], [5, 10]], [C.dred, C.rust, C.rust, C.orange]).polyShade([[14, 9], [16.2, 6 - f], [12, 10]], [C.dred, C.rust, C.rust, C.orange]);
  p.polyShade([[8.5 + tip / 2, 3], [5.2, 11], [11.8, 11]], [C.orange, C.gold, C.gold, C.yellow]);
  p.sphere(8.5, 12, 5, 5, RAMP.fire);
  p.sphere(8.5, 12.6, 2.8, 2.6, [C.gold, C.yellow, C.yellow, C.white]);
  // Oczy-szparki z żarem i ciemna, migocząca paszcza.
  for (const ex of [6.3, 10.3]) p.rect(ex, 11.2, 1.2, 1.6, C.ddbrown).dot(ex + 0.2, 11.4, f === 1 ? C.white : C.yellow);
  p.rect(7.6, 14.2, 1.8, f === 2 ? 1.4 : 0.8, C.dred);
  // Iskry unoszące się w górę i drobne języki u dołu.
  for (let k = 0; k < 3; k++) p.dot(4 + k * 4 + tip * 0.3, 2.6 + ((k * 3 + f * 2) % 5), k % 2 ? C.yellow : C.gold);
  p.dot(8.5 + tip, 0.6, C.white);
  for (const x of [5.4, 8.5, 11.6]) p.polyShade([[x - 0.8, 16], [x + 0.8, 16], [x + (f - 1) * 0.4, 18.4]], [C.dred, C.rust, C.orange, C.orange]);
  return p.outline(C.dred);
}

/** Wirujący: demoniczny shuriken — pięć ostrzy z jasną krawędzią tnącą i ciemną bruzdą, pierścień z nitami, czerwone oko w środku (obrót w klatkach). */
function spinner(f: number): Painter {
  const p = new Painter(21, 21, HI);
  const rot = -Math.PI / 2 + f * (Math.PI / 20), c = 10.5;
  const at = (a: number, r: number): [number, number] => [c + Math.cos(a) * r, c + Math.sin(a) * r];
  // Ostrza: każde osobno (jasna strona wiodąca, ciemna spływowa), zakrzywione w kierunku obrotu.
  for (let k = 0; k < 5; k++) {
    const a = rot + (k * 2 * Math.PI) / 5;
    p.polyShade([at(a - 0.55, 3.6), at(a + 0.18, 9.8), at(a, 6)], [C.navy, C.plum, C.pink, C.salmon]);
    p.polyShade([at(a + 0.55, 3.6), at(a + 0.18, 9.8), at(a, 6)], [C.black, C.navy, C.plum, C.plum]);
    const [x0, y0] = at(a - 0.3, 4.4), [x1, y1] = at(a + 0.18, 9.4);
    p.thin(x0, y0, x1, y1, C.white);
    const [gx, gy] = at(a + 0.12, 5.6), [hx, hy] = at(a + 0.16, 7.6);
    p.thin(gx, gy, hx, hy, C.black);
  }
  // Pierścień z nitami i oko.
  p.sphere(c, c, 4, 4, [C.slate, C.dgray, C.lavender, C.lgray]);
  for (let k = 0; k < 5; k++) { const [x, y] = at(rot + 0.6 + (k * 2 * Math.PI) / 5, 3.2); p.dot(x, y, C.white); }
  p.sphere(c, c, 2.6, 2.6, [C.dred, C.red, C.red, C.salmon]);
  p.rect(c - 0.4, c - 1.6, 0.9, 3.2, C.black).dot(c - 1, c - 1, C.white);
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
function sentinel(f: number, deco?: Deco): Painter {
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
  deco?.(p, f);
  return p.outline(C.navy);
}

/** Mimik: skrzynia z desek ze słojami i żelaznymi okuciami z nitami, zamek, świecące oczy w szparze; w klatce 1 otwarta paszcza z kłami i językiem. */
function mimic(f: number): Painter {
  const p = new Painter(20, 18, HI);
  const open = f === 1 ? 3 : 0;
  // Dolna część: deski ze słojami, żelazne okucia z nitami, nóżki-pazury.
  p.block(2, 9, 16, 8, RAMP.wood);
  for (const y of [11, 14]) p.thin(2.5, y, 17.5, y, C.dbrown);
  for (const x of [5.6, 9, 12.4]) p.dot(x, 12.4, C.ddbrown).dot(x + 0.5, 15.4, C.ddbrown);
  p.rect(2, 12, 16, 1, C.dgray).thin(2, 12, 18, 12, C.lgray);
  for (const x of [4, 15]) { p.rect(x, 9, 1.2, 8, C.dgray); p.thin(x, 9, x, 17, C.lgray); p.dot(x + 0.6, 10.4, C.white).dot(x + 0.6, 15.4, C.white); }
  for (const x of [2.4, 16.4]) p.polyShade([[x, 17], [x + 1.4, 17], [x + 0.6, 18]], RAMP.bone);
  // Wieko.
  p.block(2, 3 - open, 16, 6, RAMP.wood).rect(2, 3 - open, 16, 1, C.clay);
  p.thin(2.5, 5.6 - open, 17.5, 5.6 - open, C.dbrown);
  for (const x of [4, 15]) { p.rect(x, 3 - open, 1.2, 6, C.dgray); p.thin(x, 3 - open, x, 9 - open, C.lgray); p.dot(x + 0.6, 4.4 - open, C.white); }
  p.rect(8.8, 7 - open, 2.4, 2.6, C.gold).dot(9.6, 8 - open, C.black).dot(9, 7 - open, C.yellow); // zamek
  // Otwarta paszcza: czerwone wnętrze, język, kły.
  if (open) { p.rect(3, 6, 14, 3, C.dred).polyShade([[7, 7], [13, 7], [12, 9], [8, 9]], [C.red, C.salmon, C.salmon, C.peach]); }
  for (let x = 3; x < 17; x += 2) { p.polyShade([[x, 9 - (open ? 1 : 0)], [x + 1, 9 - (open ? 1 : 0)], [x + 0.5, 10.5 - (open ? 1 : 0)]], RAMP.bone); p.polyShade([[x + 1, 8 + open], [x + 2, 8 + open], [x + 1.5, 6.5 + open]], RAMP.bone); }
  // Oczy: w szparze pod wiekiem (zamknięta) albo na wieku (otwarta).
  for (const ex of [6, 13]) p.disc(ex + 0.5, open ? 4.5 - open : 8.6, 0.8, C.red).dot(ex + 0.2, open ? 4.2 - open : 8.3, C.yellow);
  return p.outline();
}

/** Biały jeleń: duch lasu — smukłe ciało z jaśniejszą piersią, nogi ze stawami i kopytami, szyja z grzywą, pysk i ucho, rozłożyste poroże z jarzącymi się końcami i smugi poświaty za nim (4 klatki biegu). */
function stag(f: number): Painter {
  const p = new Painter(24, 22, HI);
  const leg = [0, 1, 0, -1][f], bob = f % 2 ? -0.4 : 0;
  // Smugi ducha za zadem.
  for (let k = 0; k < 3; k++) p.dot(2 - k * 0.6 + (f % 2) * 0.4, 9 + k * 1.6 + bob, k % 2 ? C.cyan : C.lgray);
  // Nogi: udo i goleń ze stawem, ciemne kopyta (tylne ciemniejsze).
  for (const [x, d, back] of [[6, leg, 1], [8.6, -leg, 0], [14.4, leg, 1], [16.6, -leg, 0]] as const) {
    const kx = x + d * 0.4, ky = 16.4;
    p.thin(x, 13 + bob, kx, ky, back ? C.lavender : C.lgray).thin(x + 0.5, 13 + bob, kx + 0.5, ky, back ? C.slate : C.lavender);
    p.thin(kx, ky, x + d, 19.6, back ? C.lavender : C.lgray).thin(kx + 0.4, ky, x + d + 0.4, 19.6, C.lavender);
    p.rect(x + d - 0.2, 19.6, 1.2, 0.8, C.dgray);
  }
  // Tułów z jaśniejszą piersią i cieniem brzucha.
  p.sphere(11, 11 + bob, 7, 3.8, RAMP.bone);
  p.sphere(15.6, 11 + bob, 2.6, 2.6, [C.lgray, C.cream, C.white, C.white]);
  p.thin(6, 13.8 + bob, 15, 13.8 + bob, C.lavender);
  // Szyja z grzywą, głowa z pyskiem, ucho i świecące oko.
  p.polyShade([[14.6, 9 + bob], [17, 5 + bob], [19.6, 6.4 + bob], [17.6, 11 + bob]], RAMP.bone);
  for (const y of [7, 8.4, 9.8]) p.thin(15.6, y + bob, 14.8, y + 1 + bob, C.lgray);
  p.sphere(18.8, 6 + bob, 2.6, 2.2, RAMP.bone).sphere(21, 7 + bob, 1.4, 1.1, RAMP.bone);
  p.dot(22, 7 + bob, C.dgray).thin(20, 8 + bob, 21.6, 8 + bob, C.lavender);
  p.polyShade([[17, 4.6 + bob], [15.4, 3.4 + bob], [17.6, 5.8 + bob]], RAMP.bone).dot(16.4, 4 + bob, C.salmon);
  p.rect(18.8, 5.4 + bob, 1, 1, C.cyan).dot(19, 5.4 + bob, C.white);
  // Rozłożyste poroże (dwie gałęzie z odnogami), końce jarzą się na zmianę.
  for (const d of [-1, 1]) {
    const bx = 18.4 + d * 0.8, by = 4 + bob;
    p.stroke(bx, by, bx + d * 1.6, by - 3, C.cream).thin(bx + d * 1.6, by - 3, bx + d * 3.4, by - 4, C.cream);
    p.thin(bx + d * 0.8, by - 1.5, bx + d * 2.8, by - 1.4, C.cream).thin(bx + d * 1.6, by - 3, bx + d * 1.2, by - 4.4, C.cream);
    for (const [tx, ty] of [[bx + d * 3.4, by - 4], [bx + d * 2.8, by - 1.4], [bx + d * 1.2, by - 4.4]] as const) p.dot(tx, ty, (f + d) % 2 ? C.cyan : C.white);
  }
  // Ogon.
  p.dot(4.4, 9.6 + bob, C.white).dot(3.9, 10.1 + bob, C.white);
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

/** Przywoływacz: szaman w fioletowej szacie z płaszczem z piór i pasem z kości, kościana maska z rogami, kostur ze szponem trzymającym zieloną kulę (pulsuje przed przywołaniem). */
function summoner(f: number): Painter {
  const p = new Painter(18, 21, HI);
  const pulse = f % 2 === 1;
  // Szata: postrzępiony dół, ciemniejszy przód, runy przy rąbku.
  const hem: [number, number][] = [];
  for (let x = 14.6; x >= 3.4; x -= 1.4) hem.push([x, 19.6 + ((x * 5) % 2 > 1 ? 0.8 : 0)]);
  p.polyShade([[9, 5], [13.6, 9], [14.6, 19.6], ...hem, [3.4, 19.6], [4.4, 9]], RAMP.purple);
  p.polyShade([[9, 10], [11, 19.8], [7, 19.8]], [C.black, C.black, C.plum, C.plum]);
  p.thin(5, 11, 4, 19, C.salmon).thin(12.8, 11, 13.8, 19, C.black);
  for (const [x, y] of [[5, 18], [12.6, 18], [9, 16.4]] as const) p.dot(x, y, pulse ? C.white : C.lime).dot(x, y - 0.6, C.green);
  // Pas z kośćmi.
  p.thin(4.6, 13, 13.4, 13, C.ddbrown);
  for (const x of [6, 8, 10, 12]) p.sphere(x, 13.6, 0.6, 0.8, RAMP.bone);
  // Płaszcz z piór na ramionach.
  for (let k = 0; k < 7; k++) {
    const x = 4 + k * 1.65, y = 9 + Math.abs(k - 3) * 0.35;
    p.polyShade([[x - 0.9, y - 1], [x + 0.9, y - 1], [x, y + 1.8]], k % 2 ? [C.dbrown, C.tan, C.cream, C.white] : [C.dred, C.rust, C.salmon, C.peach]);
  }
  // Kościana maska: rogi, szpary oczu z zielonym żarem, zęby.
  p.polyShade([[6.2, 4.4], [4.2, 0.6], [5.2, 0.4], [7.4, 3.4]], RAMP.bone).polyShade([[11.8, 4.4], [13.8, 0.6], [12.8, 0.4], [10.6, 3.4]], RAMP.bone);
  p.sphere(9, 6, 3.6, 3.2, RAMP.bone);
  p.thin(9, 3, 9, 4.6, C.lavender).dot(7.2, 4, C.white);
  for (const ex of [7.6, 10.4]) p.rect(ex - 0.7, 5.4, 1.4, 1, C.black).dot(ex, 5.6, pulse ? C.white : C.lime);
  p.rect(7.6, 8, 2.8, 1, C.black);
  for (const x of [8, 9, 10]) p.dot(x, 8, C.cream);
  // Rękaw i dłoń przy kosturze.
  p.polyShade([[12.6, 9.6], [15, 11], [14.4, 12.6], [12.4, 11.6]], RAMP.purple).sphere(15, 11.8, 0.9, 0.8, RAMP.bone);
  // Kostur z sękami i szponem, kula z poświatą.
  p.stroke(15.2, 5, 15.2, 20.4, C.dbrown).thin(15.4, 5.5, 15.4, 20, C.brown);
  p.dot(15.6, 9, C.clay).dot(15.6, 16, C.clay);
  p.thin(13.6, 4.6, 14.8, 5.6, C.lgray).thin(16.8, 4.6, 15.6, 5.6, C.lgray);
  const rad = pulse ? 2.5 : 2;
  if (pulse) p.ring(15.2, 3, rad + 1.2, 0.5, C.lime).dot(12.4, 1.4, C.lime).dot(17.6, 0.8, C.white);
  p.sphere(15.2, 3, rad, rad, [C.dgreen, C.green, C.lime, C.white]).dot(14.6, 2.2, C.white);
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
function boar(f: number, deco?: Deco): Painter {
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
  deco?.(p, f);
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

/** Ropucha bagienna: przysadzista, z jaśniejszym brzuchem, brodawkami z odblaskiem, łapami, szerokim pyskiem i wyłupiastymi oczami; worek rezonansowy nadyma się w klatkach 1-2. */
function toad(f: number, deco?: Deco): Painter {
  const p = new Painter(20, 15, HI);
  const sq = f === 3 ? 0.6 : 0;
  const skin = [C.teal, C.dgreen, C.green, C.lime];
  // Tylna łapa złożona w przysiadzie, przednie łapy z palcami.
  p.sphere(5, 10.6 + sq, 3.6, 3, skin);
  p.thin(2, 13.8, 6, 13.8, C.dgreen).dot(1.6, 13.4, C.green).dot(3.4, 13.4, C.green);
  // Tułów i głowa (zwrócona w prawo).
  p.sphere(9.4, 9 + sq, 6.6, 4.6 - sq, skin);
  p.sphere(14.4, 8.6 + sq, 4.2, 3.6 - sq * 0.5, skin);
  p.sphere(10.6, 11.6 + sq, 4.6, 1.8, [C.dgreen, C.tan, C.cream, C.cream]);
  // Worek pod gardłem.
  const sac = [1.4, 2.2, 2.7, 1.2][f];
  p.sphere(15.4, 11.6 + sq, sac + 0.4, sac * 0.8, [C.tan, C.cream, C.cream, C.white]).dot(15, 11 + sq, C.white);
  // Pysk.
  p.thin(12.4, 9.8 + sq, 18.2, 9.4 + sq, C.teal).thin(17.6, 9.4 + sq, 18.4, 8.8 + sq, C.teal);
  p.dot(17.4, 7.6 + sq, C.teal);
  // Przednie łapy.
  for (const x of [12, 15.6]) p.thin(x, 11.6 + sq, x + 0.6, 13.8, C.dgreen).thin(x - 0.4, 13.8, x + 1.4, 13.8, C.green);
  // Brodawki z odblaskiem.
  for (const [x, y] of [[5.4, 7.6], [8, 6], [10.6, 6.4], [4.4, 10.2], [8.4, 9.4], [12.2, 7]] as const) p.dot(x, y + sq, C.teal).dot(x - 0.3, y + sq - 0.4, C.lime);
  // Wyłupiaste oczy z pionową źrenicą.
  for (const ex of [13, 16.2]) {
    p.sphere(ex, 5 + sq, 1.8, 1.8, [C.dbrown, C.orange, C.gold, C.yellow]);
    p.rect(ex - 0.2, 4 + sq, 0.6, 2, C.black).dot(ex - 0.8, 4.2 + sq, C.white);
  }
  p.thin(11.4, 4.6 + sq, 17.6, 4.4 + sq, C.dgreen);
  deco?.(p, f);
  return p.outline();
}

/** Topielec: przygarbiony utopiec o sinej skórze, z włosami-wodorostami opadającymi na twarz, świecącymi oczami, łachmanami u pasa i długimi szponami; kapie z niego woda. */
function lurker(f: number): Painter {
  const p = new Painter(18, 22, HI);
  const sw = [0, 0.5, 0, -0.5][f];
  const skin = [C.navy, C.teal, C.dblue, C.blue];
  // Chude, zgięte nogi.
  p.thin(7, 16, 6 + sw, 20.6, C.teal).thin(7.6, 16, 6.6 + sw, 20.6, C.dblue);
  p.thin(11, 16, 12 - sw, 20.6, C.teal).thin(11.6, 16, 12.6 - sw, 20.6, C.navy);
  p.rect(5 + sw, 20.6, 2.4, 0.8, C.navy).rect(11.4 - sw, 20.6, 2.4, 0.8, C.navy);
  // Tułów pochylony do przodu, żebra, łachmany u pasa.
  p.polyShade([[4.6, 9.4], [7.4, 7.2], [12.4, 7.4], [13.8, 9.6], [12.6, 15], [9, 15.6], [5.8, 15.2], [5, 12]], skin);
  p.sphere(9.4, 13, 2.6, 1.8, [C.teal, C.dblue, C.blue, C.blue]);
  for (const y of [9.6, 11, 12.4]) p.thin(6.8, y, 11.6, y - 0.3, C.navy).thin(7, y + 0.4, 11.2, y + 0.1, C.cyan);
  const rags: [number, number][] = [[4.6, 14.4], [13.8, 14]];
  for (let x = 13.4; x >= 5; x -= 1.2) rags.push([x, 17 + ((x * 3) % 2 > 1 ? 1.2 : 0)]);
  p.polyShade([[4.6, 14.4], [13.8, 14], ...rags.slice(2)], [C.black, C.ddbrown, C.dgray, C.slate]);
  // Długie ramiona ze szponami (prawe sięga do przodu).
  p.stroke(13, 8.6, 16, 12 + sw, C.teal).thin(13, 8.4, 16, 11.6 + sw, C.blue);
  for (const d of [-0.8, 0, 0.8]) p.thin(16, 12 + sw, 17.4 + d * 0.3, 14 + sw + d, C.lgray);
  p.stroke(5.2, 8.6, 3, 13 - sw, C.teal);
  for (const d of [-0.6, 0.6]) p.thin(3, 13 - sw, 2 + d, 15 - sw, C.lgray);
  // Głowa: świecące oczy spod wodorostów, otwarte usta.
  p.sphere(9.4, 5, 3.6, 3.4, skin);
  p.rect(7.6, 4.6, 1.2, 1, C.white).rect(10.4, 4.6, 1.2, 1, C.white).dot(7.8, 4.8, C.cyan).dot(10.6, 4.8, C.cyan);
  p.rect(8.4, 6.8, 2.2, 1.2, C.black).dot(8.8, 6.8, C.lgray).dot(9.8, 6.8, C.lgray);
  for (const [x, l] of [[5.8, 8], [6.8, 5.4], [8.2, 3.2], [10.8, 3], [12, 5.6], [13, 9]] as const) {
    p.thin(x, 1.8, x + sw * 0.6 + (x < 9 ? -0.4 : 0.4), 1.8 + l, (x * 2) % 3 > 1 ? C.dgreen : C.green);
  }
  p.thin(6, 1.6, 12.6, 1.6, C.dgreen).dot(8, 1.4, C.lime).dot(11, 1.4, C.lime);
  // Kapiące krople.
  p.dot(3.6, 16.5 + (f % 2) * 1.5, C.cyan).dot(14.4, 17.5 - (f % 2), C.cyan).dot(9, 21.4, f === 2 ? C.white : C.cyan);
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
function scorpion(f: number, deco?: Deco): Painter {
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
  deco?.(p, f);
  return p.outline();
}

/** Rozszczepieniec: pęknięta geoda — dwie połówki w ciemnej skorupie, w szczelinie kryształy i pulsujący rdzeń (pęka mocniej w klatkach 2-3). */
function splitter(f: number, deco?: Deco): Painter {
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
  deco?.(p, f);
  return p.outline();
}

/** Odbicie: lustrzany sobowtór — rycerz z tafli szkła (jasne, ciemne i odbijające niebo), hełm z wizjerem, ukośne refleksy, rysy i szklany miecz. */
function mirror(f: number, deco?: Deco): Painter {
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
  deco?.(p, f);
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

/** Dodatek rysowany na postaci przed obrysem (wersje minibossów: korony, zbroje, przebarwienia). */
type Deco = (p: Painter, f: number) => void;

/** Złota korona z klejnotem: środek `x`, dół `y`, szerokość `w`. */
function crown(p: Painter, x: number, y: number, w: number, gem: number = C.red): void {
  const h = w * 0.55;
  p.polyShade([[x - w / 2, y], [x - w / 2, y - h], [x - w / 4, y - h * 0.5], [x, y - h * 1.1], [x + w / 4, y - h * 0.5], [x + w / 2, y - h], [x + w / 2, y]], RAMP.gold);
  p.thin(x - w / 2, y - 0.2, x + w / 2, y - 0.2, C.orange).dot(x, y - h * 0.4, gem).dot(x - 0.2, y - h * 0.5, C.white);
}

/**
 * Minibossy (strażnicy aktów, skala 2): ciało zwykłego wroga z własnymi insygniami, żeby nie wyglądały jak powiększony zwykły wróg.
 */
const MINIBOSSES: Record<string, (f: number) => Painter> = {
  // Król dzików: korona, złote kły, blizna przez oko.
  boarking: (f) => boar(f, (p, k) => {
    const b = k % 2 ? -0.5 : 0;
    crown(p, 19.4, 4.6 + b, 4.4);
    p.thin(20.6, 12 + b, 21.8, 10 + b, C.gold).dot(21.8, 9.8 + b, C.yellow);
    p.thin(18.2, 7 + b, 20, 9.4 + b, C.salmon);
  }),
  // Matrona ropuch: korona z lilii z lotosem między oczami.
  toadqueen: (f) => toad(f, (p, k) => {
    const sq = k === 3 ? 0.6 : 0;
    p.sphere(14.6, 3.2 + sq, 2.6, 1, [C.teal, C.dgreen, C.green, C.lime]);
    for (const dx of [-1.2, 0, 1.2]) p.polyShade([[14.6 + dx - 0.7, 3 + sq], [14.6 + dx + 0.7, 3 + sq], [14.6 + dx * 1.2, 0.6 + sq - (dx ? 0 : 0.6)]], [C.plum, C.pink, C.salmon, C.white]);
  }),
  // Tyran piasku: karmazynowy pancerz i złota korona kolców na grzbiecie.
  sandtyrant: (f) => scorpion(f, (p) => {
    p.recolor([C.black, C.ddbrown, C.dred, C.red, C.orange]);
    for (const x of [8, 10.5, 13]) p.polyShade([[x - 0.8, 10.4], [x + 0.8, 10.4], [x, 8]], RAMP.gold);
  }),
  // Strzaskany rycerz: przyciemnione szkło, czerwony wizjer, pęknięcia z żarem.
  shatterknight: (f) => mirror(f, (p) => {
    p.recolor([C.black, C.black, C.navy, C.slate, C.dgray]);
    p.rect(6.4, 4.6, 5.2, 1.2, C.black).dot(7.6, 4.8, C.red).dot(10.4, 4.8, C.red);
    p.thin(6, 12, 8, 16, C.hotpink).thin(12, 10, 13, 13, C.hotpink);
  }),
  // Pryzmat pustki: geoda w barwach pustki z krążącymi okruchami.
  voidprism: (f) => splitter(f, (p, k) => {
    p.recolor([C.black, C.navy, C.plum, C.pink, C.hotpink]);
    for (let i = 0; i < 4; i++) {
      const a = k * (Math.PI / 4) + (i * Math.PI) / 2;
      p.dot(9 + Math.cos(a) * 8.4, 9 + Math.sin(a) * 8.4, i % 2 ? C.cyan : C.white);
    }
  }),
  // Strażnik skarbca: złote okucia kryształu i korona nad szczytem.
  vaultwarden: (f) => sentinel(f, (p, k) => {
    const o = k % 2 ? 0 : 1;
    p.thin(3, 9 + o, 17, 9 + o, C.gold).thin(10, 1.4 + o, 10, 20.6 + o, C.gold);
    crown(p, 10, 2 + o, 5, C.cyan);
  }),
  // Strażnik lochu: rogi, kajdany z łańcuchem i żarzące się runy.
  dungeonkeeper: (f) => golem(f, (p, k) => {
    const bob = k % 2 === 1 ? -1 : 0;
    p.polyShade([[9, 3 + bob], [7, -0.4 + bob], [10.2, 2.4 + bob]], RAMP.bone).polyShade([[16, 3 + bob], [18, -0.4 + bob], [14.8, 2.4 + bob]], RAMP.bone);
    p.rect(2.4, 15 + bob, 5, 1.4, C.dgray).rect(18, 15 + bob, 5, 1.4, C.dgray);
    for (let x = 7.6; x < 18; x += 1.6) p.ring(x, 17.6 + bob + Math.sin(x) * 0.4, 0.7, 0.3, C.lgray);
    for (const [x, y] of [[10, 12.5], [15, 12.5], [12.5, 10]] as const) p.dot(x, y + bob, C.orange);
  }),
};

export const ACTORS: Record<string, (f: number) => Painter> = {
  kestra, borgun, ignara, morwen, vesper, aurel, takezo, wraith, wraithbig, angel, angelbig, slime, goldslime, bat, golem, eye, wisp, spinner, cultist, sentinel, mimic, stag,
  shieldbearer, summoner, kamikaze, blinker, weaver, boar, thornling, toad, lurker, salamander, scorpion, splitter, mirror,
  ...MINIBOSSES,
};

/** Bossowie biomów 1-4 (biom 0: Władca Otchłani, `lich`). Wszyscy 37×38, 4 klatki: oddech / puls / ruch detali. */
const BOSS_ART: ((f: number) => Painter)[] = [swampQueen, magmaLord, voidEye, voidHeart];

/** Boss biomu `i` (sprite 'boss<i>'): biom 0 i nieznane — Władca Otchłani w kolorach biomu. */
export function boss(b: Biome, f: number, i: number): Painter {
  return i >= 1 && BOSS_ART[i - 1] ? BOSS_ART[i - 1](f) : lich(b, f);
}

/** Królowa Bagien: rozdęta ropucha-królowa w błotnej spódnicy, korona z liści lilii z lotosem, pnącza zamiast włosów, kostur z pałki wodnej, muchy. */
function swampQueen(f: number): Painter {
  const p = new Painter(37, 38, HI);
  const o = f % 2 ? 0 : 1, wave = (f >> 1) & 1;
  const mud = [C.black, C.ddbrown, C.dbrown, C.brown], skin = [C.teal, C.dgreen, C.green, C.lime];
  // Błotna spódnica z kapiącym dołem.
  const hem: [number, number][] = [];
  for (let x = 33; x >= 4; x -= 2) hem.push([x, 35 + ((x / 2 + wave) % 2 ? 1 : 0)]);
  p.polyShade([[8, 24 + o], [29, 24 + o], [33, 35], ...hem, [4, 35]], mud);
  for (const x of [9, 16, 23, 29]) p.thin(x, 30 + o, x + (wave ? 0.5 : -0.5), 35.5, C.ddbrown);
  p.dot(7 + wave * 2, 37, C.dbrown).dot(27 - wave * 2, 37.4, C.dbrown);
  // Kostur z pałki wodnej (z lewej).
  p.stroke(3.5, 9, 3.5, 36, C.dbrown).thin(3.8, 9.5, 3.8, 35.5, C.brown);
  p.sphere(3.5, 7, 1.6, 3.4, RAMP.wood).thin(3.5, 2.6, 3.5, 3.8, C.tan).thin(2, 12, 0.6, 9, C.green).thin(5, 12, 6.6, 8.6, C.green);
  // Rozdęte ciało, jasny brzuch, brodawki.
  p.sphere(18.5, 22 + o, 12.5, 9, skin);
  p.sphere(18.5, 25 + o, 7.6, 5.4, [C.dgreen, C.tan, C.cream, C.cream]);
  for (const [x, y] of [[9, 19], [12, 16], [26, 17], [28, 22], [10, 25], [25.6, 25]] as const) p.dot(x, y + o, C.teal).dot(x - 0.4, y - 0.4 + o, C.lime);
  // Grube ramiona: lewe trzyma kostur, prawe z błotną kulą.
  p.sphere(6.6, 21 + o, 3.4, 4.4, skin).sphere(4.6, 25 + o, 2.2, 1.8, skin);
  p.sphere(30.6, 21 + o, 3.4, 4.4, skin).sphere(32, 26 + o, 2.8, 2.6, mud).dot(31, 25 + o, C.tan);
  // Głowa: szeroki żabi pysk z wargą, policzki.
  p.sphere(18.5, 12 + o, 9, 6.2, skin);
  p.thin(11, 14.6 + o, 26, 14.6 + o, C.teal).thin(11, 15.2 + o, 26, 15.2 + o, C.dgreen).thin(10.4, 14 + o, 11, 14.6 + o, C.teal).thin(26.6, 14 + o, 26, 14.6 + o, C.teal);
  p.dot(13, 12.4 + o, C.salmon).dot(24, 12.4 + o, C.salmon);
  // Wyłupiaste oczy z pionową źrenicą.
  for (const ex of [13.4, 23.6]) {
    p.sphere(ex, 8 + o, 2.8, 2.6, [C.dbrown, C.orange, C.gold, C.yellow]);
    p.rect(ex - 0.3, 6.6 + o, 0.8, 3, C.black).dot(ex - 1.2, 7 + o, C.white);
  }
  // Pnącza opadające z głowy.
  for (const [x, l] of [[10.4, 10], [9.4, 13], [27, 11], [28, 14]] as const) p.thin(x, 9 + o, x + (wave ? 0.6 : -0.6) * (x < 18 ? -1 : 1), 9 + o + l, (x * 3) % 2 > 1 ? C.dgreen : C.green);
  // Korona: liście lilii i lotos.
  for (const [x, y, rx] of [[12, 4.4, 3], [25, 4.4, 3], [18.5, 3.4, 3.4]] as const) {
    p.sphere(x, y + o, rx, 1.6, skin).thin(x, y + o, x + 1.4, y + 1.4 + o, C.teal);
  }
  for (const [dx, h] of [[-2.2, 2.8], [0, 4], [2.2, 2.8]] as const) p.polyShade([[18.5 + dx - 1.2, 3 + o], [18.5 + dx + 1.2, 3 + o], [18.5 + dx * 1.3, 3 - h + o]], [C.plum, C.pink, C.salmon, C.white]);
  p.disc(18.5, 2.8 + o, 0.9, C.yellow);
  // Muchy krążące wokół.
  for (let k = 0; k < 3; k++) {
    const a = f * 1.3 + k * 2.1;
    p.dot(18.5 + Math.cos(a) * 15, 13 + Math.sin(a) * 6, C.black).dot(18.5 + Math.cos(a) * 15 + 0.5, 12.6 + Math.sin(a) * 6, C.lgray);
  }
  return p.outline();
}

/** Żar Pustkowia: kolos z zastygłej lawy — kamienne bryły z żarzącymi się pęknięciami, rdzeń w piersi, pięści z magmy, korona płomieni i iskry. */
function magmaLord(f: number): Painter {
  const p = new Painter(37, 38, HI);
  const o = f % 2 ? 0 : 1, hot = f % 2 === 1;
  const rock = [C.black, C.black, C.ddbrown, C.dbrown], glow = hot ? C.yellow : C.orange;
  // Nogi-kolumny.
  p.block(11, 28, 5, 9, rock).block(21, 28, 5, 9, rock);
  p.thin(13, 30, 14, 36, glow).thin(23.6, 31, 23, 36, glow);
  // Ramiona z pięściami z magmy.
  p.sphere(5.4, 21 + o, 3.6, 5, rock).sphere(31.6, 21 + o, 3.6, 5, rock);
  p.sphere(5, 28 + o, 3.4, 3.2, RAMP.fire).sphere(32, 28 + o, 3.4, 3.2, RAMP.fire);
  p.dot(4, 27 + o, C.yellow).dot(31, 27 + o, C.yellow).dot(4.6, 27.6 + o, C.white);
  // Tułów i barki-głazy.
  p.sphere(18.5, 20 + o, 11, 9.4, rock);
  p.sphere(8, 13 + o, 4.6, 3.6, rock).sphere(29, 13 + o, 4.6, 3.6, rock);
  // Pęknięcia z lawą.
  const cracks: [number, number, number, number][] = [[10, 15, 13, 19], [13, 19, 11, 24], [27, 16, 24, 20], [24, 20, 26, 25], [15, 25, 18.5, 27.6], [22, 25, 18.5, 27.6], [7, 12, 9, 14.6], [30, 12, 28, 14.6]];
  for (const [x0, y0, x1, y1] of cracks) p.stroke(x0, y0 + o, x1, y1 + o, C.rust).thin(x0, y0 + o, x1, y1 + o, glow);
  p.dot(10, 12 + o, C.brown).dot(25, 14 + o, C.brown).dot(14, 13 + o, C.dbrown);
  // Rdzeń w piersi.
  p.disc(18.5, 19 + o, hot ? 3.4 : 3, C.rust).disc(18.5, 19 + o, hot ? 2.4 : 2, C.orange).disc(18.5, 19 + o, 1.2, hot ? C.white : C.yellow);
  // Głowa: kamienny łeb, oczy-szczeliny i rozżarzona paszcza.
  p.sphere(18.5, 9 + o, 5.4, 4.6, rock);
  p.rect(15, 8 + o, 2.6, 1, glow).rect(19.6, 8 + o, 2.6, 1, glow).dot(16, 8 + o, C.white).dot(20.6, 8 + o, C.white);
  p.rect(16.4, 11 + o, 4.2, 1.2, C.rust).thin(16.6, 11.2 + o, 20.4, 11.2 + o, glow);
  // Korona płomieni (wysokość zmienia się z klatką).
  const hs = [[4, 6, 5, 7, 4], [5, 7, 6, 5, 3], [3, 5, 7, 6, 5], [5, 6, 4, 7, 5]][f];
  [12.4, 15.4, 18.5, 21.6, 24.6].forEach((x, i) => p.polyShade([[x - 1.6, 6 + o], [x + 1.6, 6 + o], [x + (i % 2 ? 0.6 : -0.6), 6 - hs[i] + o]], RAMP.fire));
  p.dot(18.5, 3 + o, C.white);
  // Iskry unoszące się w górę.
  for (let k = 0; k < 4; k++) p.dot(6 + ((k * 9 + f * 3) % 26), 2 + ((k * 5 + f * 4) % 10), k % 2 ? C.yellow : C.orange);
  return p.outline();
}

/** Oko Pustki: lewitujące oko w mięsistej skorupie z kolcami, kosmiczna tęczówka z gwiazdami i pionową źrenicą, sześć falujących macek, krąg run. */
function voidEye(f: number): Painter {
  const p = new Painter(37, 38, HI);
  const o = f % 2 ? 0 : 1;
  const flesh = [C.black, C.navy, C.plum, C.pink];
  // Macki: łańcuch kul malejących, falują z klatką.
  for (let t = 0; t < 6; t++) {
    const bx = 8 + t * 4.2, ph = f * 0.9 + t * 1.3;
    for (let k = 0; k < 7; k++) {
      const y = 24 + k * 1.9 + o, x = bx + Math.sin(ph + k * 0.7) * (0.6 + k * 0.35), r = 1.7 - k * 0.2;
      p.sphere(x, y, r, r, flesh);
    }
  }
  // Kolce na obrzeżu skorupy.
  for (let k = 0; k < 9; k++) {
    const a = Math.PI + (k * Math.PI) / 8, cx = 18.5 + Math.cos(a) * 12.4, cy = 15 + o + Math.sin(a) * 11.4;
    const tx = 18.5 + Math.cos(a) * 15.6, ty = 15 + o + Math.sin(a) * 14.4;
    p.polyShade([[cx - Math.sin(a) * 1.2, cy + Math.cos(a) * 1.2], [cx + Math.sin(a) * 1.2, cy - Math.cos(a) * 1.2], [tx, ty]], RAMP.bone);
  }
  // Skorupa i powieki.
  p.sphere(18.5, 16 + o, 12.6, 11.4, flesh);
  p.sphere(18.5, 16 + o, 9.4, 8.2, [C.black, C.black, C.navy, C.navy]);
  // Gałka z żyłkami.
  p.sphere(18.5, 16 + o, 8.6, 7.4, RAMP.bone);
  for (const [x0, y0, x1, y1] of [[10.6, 14, 13, 15], [11, 19, 13.4, 17.6], [26.4, 13.4, 24, 15], [26, 19.4, 23.6, 18]] as const) p.thin(x0, y0 + o, x1, y1 + o, C.salmon);
  // Kosmiczna tęczówka z gwiazdami i pionową źrenicą.
  p.sphere(18.5, 16 + o, 5.4, 5.4, [C.navy, C.dblue, C.blue, C.cyan]);
  p.ring(18.5, 16 + o, 5.4, 0.6, C.hotpink).ring(18.5, 16 + o, 3.6, 0.4, C.cyan);
  for (const [x, y] of [[16, 14], [21, 13.4], [20.4, 18.6], [15.6, 18]] as const) p.dot(x, y + o, C.white);
  const pw = f === 2 ? 0.6 : 1.2;
  p.polyShade([[18.5, 11.6 + o], [18.5 + pw, 16 + o], [18.5, 20.4 + o], [18.5 - pw, 16 + o]], [C.black, C.black, C.black, C.navy]);
  p.dot(16.2, 13 + o, C.white).dot(16.6, 13 + o, C.white).dot(16.2, 13.4 + o, C.white);
  // Górna powieka (cień) i krąg run.
  p.thin(10.4, 10 + o, 26.6, 10 + o, C.plum);
  for (let k = 0; k < 8; k++) {
    const a = f * (Math.PI / 8) + (k * Math.PI) / 4;
    p.dot(18.5 + Math.cos(a) * 17.4, 16 + o + Math.sin(a) * 4.4, k % 2 ? C.cyan : C.hotpink);
  }
  return p.outline();
}

/** Serce Pustki: kryształowe serce bijące w rytmie klatek (f=1 skurcz), tętnice u góry, wbite odłamki, jarzący rdzeń, krążące kryształy i macki cienia u dołu. */
function voidHeart(f: number): Painter {
  const p = new Painter(37, 38, HI);
  const beat = f === 1 ? 1 : f === 3 ? 0.5 : 0, s = 1 + beat * 0.08;
  const heart = [C.black, C.navy, C.plum, C.pink], crystal = [C.navy, C.dblue, C.cyan, C.white];
  // Macki cienia pod sercem.
  for (const [x, d] of [[13, -1], [18.5, 0], [24, 1]] as const) {
    for (let k = 0; k < 5; k++) p.sphere(x + d * k * 0.8 + Math.sin(f + k) * 0.6, 29 + k * 1.6, 1.6 - k * 0.22, 1.6 - k * 0.22, [C.black, C.black, C.navy, C.plum]);
  }
  // Tętnice.
  p.stroke(14, 9, 12, 2, C.plum).stroke(23, 9, 25.6, 3, C.plum).stroke(18.5, 8, 18.5, 1.6, C.dred);
  p.thin(12.2, 2.4, 12.6, 4, C.pink).thin(25.4, 3.4, 25, 5, C.pink);
  for (const [x, y] of [[12, 1.6], [25.6, 2.4], [18.5, 1]] as const) p.ring(x, y, 1.2, 0.4, C.plum);
  // Serce: dwa płaty i spiczasty dół.
  const cx = 18.5, cy = 17;
  p.sphere(cx - 5.4 * s, cy - 3 * s, 6.4 * s, 6 * s, heart).sphere(cx + 5.4 * s, cy - 3 * s, 6.4 * s, 6 * s, heart);
  p.polyShade([[cx - 11.6 * s, cy - 2 * s], [cx + 11.6 * s, cy - 2 * s], [cx, cy + 12 * s]], heart);
  p.thin(cx, cy - 6 * s, cx, cy + 9 * s, C.black);
  for (const [x0, y0, x1, y1] of [[cx - 8, cy - 4, cx - 4, cy + 3], [cx + 7, cy - 6, cx + 4, cy + 2], [cx - 3, cy + 5, cx + 2, cy + 8]] as const) p.thin(x0, y0, x1, y1, C.dred);
  // Wbite odłamki kryształu.
  for (const [x, y, h, d] of [[cx - 8, cy - 7, 5, -1], [cx + 8.4, cy - 6, 6, 1], [cx + 3, cy + 4, 4, 1], [cx - 4, cy + 1, 3.6, -1]] as const) {
    p.polyShade([[x - 1.4, y + 1], [x + 1.4, y + 1], [x + d * 0.8, y - h]], crystal);
  }
  // Jarzący się rdzeń.
  p.disc(cx, cy, 3.4 + beat, C.plum).disc(cx, cy, 2.4 + beat * 0.8, C.hotpink).disc(cx, cy, 1.2, f === 1 ? C.white : C.salmon);
  p.dot(cx - 6, cy - 6, C.white).dot(cx - 5.4, cy - 6.6, C.salmon);
  // Krążące kryształy.
  for (let k = 0; k < 4; k++) {
    const a = f * (Math.PI / 4) + (k * Math.PI) / 2, x = cx + Math.cos(a) * 16, y = cy + Math.sin(a) * 6;
    p.polyShade([[x, y - 2.4], [x + 1.2, y], [x, y + 2.4], [x - 1.2, y]], crystal);
  }
  return p.outline();
}

/**
 * Władca Otchłani 37×38: szata w kolorach biomu (cieniowana, z fałdami, runami i pasem), naramienniki z kolcami, czaszka, korona
 * z klejnotami, pulsujące kule mocy i iskry wokół (4 klatki: oddech, puls kul, krążące iskry, falujący dół szaty).
 */
function lich(b: Biome, f: number): Painter {
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
