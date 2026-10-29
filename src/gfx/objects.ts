import { C, RAMP, type Ramp } from '../core/palette';
import { Painter, HI } from './painter';

/**
 * Obiekty mapy (systems/events.ts): kapliczki (kula w kolorze błogosławieństwa), miecz w kamieniu,
 * portal do lochu (3 klatki wiru) i portal powrotny.
 */
/** Kolory kul kapliczek w kolejności błogosławieństw (systems/events.ts BLESSINGS). */
export const SHRINE_RAMPS: Ramp[] = [RAMP.red, [C.dblue, C.blue, C.cyan, C.white], RAMP.green, RAMP.gold, RAMP.blue];

/** Kamienny blok z fugami i drobnym mchem (cokoły, postumenty): `seams` = wysokości poziomych fug. */
function stone(p: Painter, x: number, y: number, w: number, h: number, seams: number[] = [], moss = true): void {
  const e = 1 / HI;
  p.block(x, y, w, h, RAMP.stone);
  for (const sy of seams) p.thin(x + e, sy, x + w - 2 * e, sy, C.slate).thin(x + e, sy + e, x + w - 2 * e, sy + e, C.lgray);
  p.dot(x + w * 0.3, y + h * 0.4, C.slate).dot(x + w * 0.7, y + h * 0.6, C.lgray);
  if (moss) for (const k of [0.15, 0.22, 0.8]) p.dot(x + w * k, y + h - 2 * e, C.green).dot(x + w * k + e, y + h - 2 * e, C.dgreen);
}

export function shrine(kind: number): Painter {
  const p = new Painter(18, 24, HI);
  const e = 1 / HI, orb = SHRINE_RAMPS[kind];
  // Dwustopniowy cokół z fugami, smukły postument z żłobieniami i brązowa obejma kuli.
  stone(p, 2.5, 19.5, 13, 3.5, [21]);
  stone(p, 4, 15, 10, 4.5, [17]);
  p.block(6.5, 10, 5, 5, RAMP.stone);
  for (const x of [7.8, 9, 10.2]) p.thin(x, 10.6, x, 14.4, C.slate);
  p.block(5.5, 9, 7, 1.5, RAMP.gold).dot(7, 9.3, C.yellow);
  p.poly([[5.5, 9], [6.5, 6.5], [7.3, 9]], C.orange).poly([[12.5, 9], [11.5, 6.5], [10.7, 9]], C.orange);
  // Kula: poświata w kolorze błogosławieństwa, połysk i jasny rdzeń.
  p.disc(9, 5.5, 4.9, orb[1]);
  p.sphere(9, 5.5, 4.3, 4.3, orb).disc(7.6, 4, 1, C.white).dot(10.6, 7.4, orb[3]).dot(10.2 + e, 7.8, orb[3]);
  return p.outline();
}

export function swordStone(): Painter {
  const p = new Painter(20, 26, HI);
  const e = 1 / HI;
  // Głaz o nieregularnym kształcie z rysą i mchem, szczelina, z której wychodzi ostrze.
  p.polyShade([[1, 25], [2.5, 19.5], [6, 16.5], [13, 16], [17.5, 18.5], [19, 25]], RAMP.stone);
  p.thin(4, 20, 6.5, 18.2, C.lgray).thin(14, 21, 16.5, 24, C.slate).thin(14 + e, 21, 16.5 + e, 24, C.dgray);
  for (const [x, y] of [[2.5, 24], [3.5, 24.4], [17, 24], [16, 24.5], [5, 23.8]]) p.dot(x, y, C.green).dot(x + e, y, C.dgreen);
  p.rect(8.5, 17.4, 4, 1, C.black);
  // Miecz wbity ostrzem w kamień: głowica, owinięta rękojeść, jelec z kamieniami, ostrze ze zbroczem do szczeliny.
  p.poly([[9, 8], [12, 8], [12, 17.5], [9, 17.5]], C.lgray);
  p.thin(10.5, 8.6, 10.5, 17, C.lavender).thin(9 + e, 8.4, 9 + e, 17.3, C.white).thin(12 - e, 8.4, 12 - e, 17.3, C.dgray);
  p.block(5, 6.4, 11, 1.8, RAMP.gold).spot(5.4, 6.8, C.red).spot(14.7, 6.8, C.red).dot(10.5, 6.9, C.yellow);
  p.rect(9.7, 2.4, 1.6, 4, C.dbrown);
  for (let y = 2.6; y < 6.2; y += 0.9) p.thin(9.7, y, 11.3, y + 0.4, C.brown);
  p.sphere(10.5, 1.6, 1.3, 1.1, RAMP.gold).dot(10.1, 1.2, C.yellow);
  return p.outline();
}

/** Osłona terenu (systems/terrain.ts): 0 skrzynia, 1 głaz, 2 kolumna; `cracked` = uszkodzona (pęknięcia). */
export function cover(v: number, cracked: boolean): Painter {
  const p = new Painter(26, 28, HI);
  const e = 1 / HI;
  if (v === 0) {
    // Skrzynia okuta metalem: deski z fugami i słojami, metalowe narożniki z nitami (detale w drobnych pikselach).
    p.block(2, 8, 22, 18, RAMP.wood);
    for (const y of [12.5, 17, 21.5]) p.thin(2 + e, y, 24 - e, y, C.ddbrown).thin(2 + e, y + e, 24 - e, y + e, C.clay);
    p.rect(12, 8, 2, 18, C.dbrown).thin(12, 8, 12, 26 - e, C.ddbrown).thin(13.5, 8, 13.5, 26 - e, C.clay);
    for (const [x, y] of [[5, 10], [17, 14.5], [7, 19], [19, 23.5], [8, 14.5], [16, 10]]) p.thin(x, y, x + 3, y, C.dbrown);
    p.rect(2, 8, 22, e * 2, C.tan);
    for (const [x, y, sx, sy] of [[2, 8, 1, 1], [24, 8, -1, 1], [2, 26, 1, -1], [24, 26, -1, -1]] as const) {
      const x0 = sx > 0 ? x : x - 4, y0 = sy > 0 ? y : y - 4;
      p.block(x0, y0, 4, 4, RAMP.stone).dot(x0 + 1.4, y0 + 1.4, C.white).dot(x0 + 2.4, y0 + 2.4, C.dgray);
    }
    p.block(11.5, 15, 3, 4, RAMP.gold).dot(12.8, 16.5, C.ddbrown).dot(12.8, 17, C.ddbrown);
  } else if (v === 1) {
    // Głaz o nieregularnym kształcie, rysy i mech w drobnych pikselach.
    p.polyShade([[1, 26], [3, 14], [8, 6], [15, 4], [22, 9], [25, 18], [24, 26]], RAMP.stone);
    p.thin(8, 9, 12, 7, C.lgray).thin(5, 15, 7, 11, C.lgray).thin(9, 8, 10.5, 7.3, C.white);
    p.thin(14, 14, 18, 22, C.slate).thin(18, 22, 21, 20, C.slate).thin(14.3, 14, 18.3, 22, C.dgray);
    for (const [x, y] of [[3, 24], [5, 25], [4, 23.5], [21, 25], [23, 24]]) p.dot(x, y, C.green).dot(x + e, y, C.dgreen);
  } else {
    // Kolumna z głowicą: żłobienia i faza w drobnych pikselach.
    p.block(7, 4, 12, 20, RAMP.stone).block(4, 22, 18, 4, RAMP.stone).block(5, 1, 16, 4, [C.dgray, C.lavender, C.lavender, C.white]);
    for (const x of [9.5, 12.5, 15.5]) p.thin(x, 5.5, x, 21.5, C.slate).thin(x + e, 5.5, x + e, 21.5, C.lgray);
  }
  if (cracked) {
    for (const [a, b, c2, d] of [[8, 10, 13, 16], [13, 16, 10, 22], [13, 16, 18, 13]] as const) p.thin(a, b, c2, d, C.black).thin(a + e, b, c2 + e, d, C.dgray);
  }
  return p.outline();
}

/** Beczka wybuchowa: malowane klepki, metalowe obręcze, pas ostrzegawczy i lont na wieku. */
export function barrel(): Painter {
  const p = new Painter(14, 18, HI);
  const e = 1 / HI;
  p.sphere(7, 9.5, 5.4, 7, RAMP.red);
  for (const x of [3.6, 5.8, 8.2, 10.4]) p.thin(x, 4.2, x, 15, C.dred);
  for (const y of [5.4, 13.4]) p.rect(1.8, y, 10.4, 1.2, C.slate).thin(1.8, y, 12, y, C.lgray).dot(3, y + 0.5, C.white).dot(11, y + 0.5, C.white);
  // Pas ostrzegawczy w ukośne paski i czaszka.
  p.rect(2, 8, 10, 3.4, C.yellow);
  for (let x = 2; x < 12; x += 2) p.poly([[x, 11.4], [x + 1, 11.4], [x + 2, 8], [x + 1, 8]], C.black);
  p.disc(7, 9.7, 1.6, C.cream).dot(6.4, 9.4, C.black).dot(7.4, 9.4, C.black).thin(6.4, 10.6, 7.6, 10.6, C.dgray);
  // Wieko i lont z iskrą.
  p.sphere(7, 3.6, 4.6, 1.6, [C.dred, C.red, C.salmon, C.salmon]).dot(7, 3.6, C.black);
  p.thin(7, 3.4, 8.2, 1.4, C.tan).thin(8.2, 1.4, 9.2, 1, C.tan).spot(9.4, 0.6, C.yellow).dot(9.4 + e, 0.6, C.white);
  return p.outline();
}

/** Kolce: kuta płyta z nitami i otworami, `up` = wysunięte ostrza ze światłem krawędzi. */
export function spikes(up: boolean): Painter {
  const p = new Painter(26, 18, HI);
  const e = 1 / HI;
  p.sphere(13, 12.5, 12, 5, RAMP.night);
  for (const [x, y] of [[3.5, 12.5], [22.5, 12.5], [13, 8.2], [13, 16.7]]) p.dot(x, y, C.lavender).dot(x + e, y + e, C.black);
  for (const [x, y] of [[6, 11], [13, 10], [20, 11], [9, 14], [17, 14]]) {
    p.sphere(x, y + 1, 1.8, 1, [C.black, C.black, C.navy]).thin(x - 1, y + 2, x + 1, y + 2, C.slate);
    if (up) {
      p.poly([[x - 1.5, y + 1], [x, y - 7], [x + 1.5, y + 1]], C.lgray);
      p.thin(x - 0.6, y - 5.5, x - 0.6, y + 0.5, C.white).thin(x + 0.7, y - 4, x + 0.7, y + 0.5, C.dgray).dot(x, y - 6.6, C.white);
      p.dot(x - 0.3, y - 1.5, C.dred).dot(x + 0.2, y - 0.8, C.red);
    }
  }
  return p.outline();
}

/** Kamień zadania (systems/tasks.ts): zwężający się obelisk z wyrytą, świecącą turkusową runą. */
export function taskStone(): Painter {
  const p = new Painter(16, 26, HI);
  const e = 1 / HI;
  stone(p, 2, 21.5, 12, 3.5, [23]);
  p.polyShade([[4.5, 21.5], [5.2, 4], [8, 1.5], [10.8, 4], [11.5, 21.5]], RAMP.stone);
  p.thin(5.4, 4.5, 5.9, 21, C.lgray).thin(8, 2, 8, 3.5, C.white);
  // Runa: ciemne żłobienie, w środku turkusowe światło z jasnym rdzeniem.
  const glyph: [number, number, number, number][] = [[8, 6.5, 8, 15.5], [6.4, 8.5, 9.6, 8.5], [6.4, 12.5, 8, 10.5], [9.6, 12.5, 8, 10.5], [6.6, 15.5, 9.4, 15.5]];
  for (const [a, b, c2, d] of glyph) p.stroke(a - e, b + e, c2 - e, d + e, C.navy);
  for (const [a, b, c2, d] of glyph) p.stroke(a - e, b, c2 - e, d, C.cyan);
  p.dot(8, 7, C.white).dot(8, 11, C.white).dot(8, 14, C.white);
  p.thin(6, 18, 10, 18, C.blue).dot(4.5, 20.8, C.cyan).dot(11.3, 20.6, C.cyan);
  return p.outline();
}

/** Totem do obrony (zadanie): rzeźbiony słup z twarzą, czaszka na szczycie i pióra na rzemieniach. */
export function totem(): Painter {
  const p = new Painter(18, 30, HI);
  const e = 1 / HI;
  stone(p, 3, 25.5, 12, 3.5, [27]);
  p.block(5, 9.5, 8, 16, RAMP.wood);
  for (const y of [14.5, 20.5]) p.thin(5 + e, y, 13 - 2 * e, y, C.ddbrown).thin(5 + e, y + e, 13 - 2 * e, y + e, C.clay);
  for (const [x, y] of [[6.2, 11], [11.4, 17.5], [7, 23]]) p.thin(x, y, x + 1.4, y, C.dbrown);
  // Rzeźbiona twarz: oczy z czerwonym blaskiem i usta.
  p.rect(6.4, 15.8, 1.8, 1.2, C.black).rect(9.8, 15.8, 1.8, 1.2, C.black).dot(7, 16.1, C.red).dot(10.4, 16.1, C.red);
  p.rect(7.2, 18.4, 3.6, 1, C.ddbrown).dot(7.6, 18.6, C.cream).dot(9, 18.6, C.cream).dot(10.3, 18.6, C.cream);
  p.rect(4.2, 13, 9.6, 1, C.gold).dot(5, 13.2, C.yellow).dot(9, 13.2, C.yellow);
  // Czaszka: oczodoły, nos, zęby.
  p.sphere(9, 5.6, 4.4, 4.2, RAMP.bone).rect(7, 9, 4, 1.4, C.lgray);
  p.disc(7.3, 5.6, 1, C.black).disc(10.7, 5.6, 1, C.black).dot(7.1, 5.3, C.red).dot(10.5, 5.3, C.red);
  p.dot(9, 7.3, C.dgray).dot(9 - e, 7.6, C.dgray);
  for (const x of [7.6, 8.6, 9.6]) p.thin(x, 9, x, 10.3, C.lavender);
  // Pióra na rzemieniach po bokach.
  for (const [x, dir] of [[3.5, -1], [14.5, 1]] as const) {
    p.thin(x - dir * 0.8, 11, x, 13.5, C.tan);
    p.poly([[x, 13.5], [x + dir * 1.6, 15], [x + dir * 1.2, 19], [x - dir * 0.2, 16]], C.red);
    p.thin(x + dir * 0.2, 14, x + dir * 1, 18.4, C.salmon).dot(x + dir * 1.1, 18.6, C.white);
  }
  return p.outline();
}

/** Portal: kamienny łuk z jarzącymi się runami i wirem w środku (klatka 0-2); `exit` = portal powrotny (zielony). */
export function portal(f: number, exit: boolean): Painter {
  const p = new Painter(26, 30, HI);
  const e = 1 / HI, ramp: Ramp = exit ? RAMP.green : RAMP.purple, glow = exit ? C.lime : C.pink;
  // Wir: kula w kolorze portalu z ciemnym środkiem i spiralnymi ramionami (obrót z klatką).
  p.sphere(13, 15, 8.6, 10.2, ramp);
  p.sphere(13, 15, 5, 6.5, [C.black, C.black, ramp[1], ramp[2]]);
  for (let i = 0; i < 3; i++) {
    const a0 = (i / 3) * Math.PI * 2 + f * 0.7;
    for (let t = 0; t < 1; t += 0.06) {
      const a = a0 + t * 2.6, rr = 1.2 + t * 7.4;
      const x = 13 + Math.cos(a) * rr * 0.85, y = 15 + Math.sin(a) * rr;
      if (t < 0.55) p.spot(x, y, t < 0.25 ? C.white : glow);
      else p.dot(x, y, glow);
    }
  }
  // Łuk z bloków: dwa filary i sklepienie, na kamieniach runy w kolorze wiru.
  p.ring(13, 13.5, 11.6, 2.6, C.dgray).ring(13, 13.5, 11.6, 0.5, C.lgray).ring(13, 13.5, 9.4, 0.4, C.slate);
  p.rect(1, 14, 3, 13, C.dgray).rect(22, 14, 3, 13, C.dgray);
  p.block(1, 13.5, 3, 13.5, RAMP.stone).block(22, 13.5, 3, 13.5, RAMP.stone);
  for (let k = 0; k < 7; k++) {
    const a = Math.PI + (k / 6) * Math.PI;
    p.thin(13 + Math.cos(a) * 9.4, 13.5 + Math.sin(a) * 9.4, 13 + Math.cos(a) * 11.6, 13.5 + Math.sin(a) * 11.6, C.slate);
  }
  for (const [x, y] of [[2.5, 17], [23.5, 21], [13, 2.9], [5, 6], [21, 6]]) p.spot(x - e, y, glow);
  stone(p, 0.5, 26.5, 25, 2.8, [], true);
  return p.outline();
}

// ---------------- sekrety map (systems/mapsecrets.ts) ----------------

/** Fontanna życzeń: dwupiętrowa kamienna misa, woda z falami i strumień z góry (klatka = faza kropel). */
export function fountain(f: number): Painter {
  const p = new Painter(26, 24, HI);
  const e = 1 / HI;
  p.sphere(13, 18.5, 12, 4.8, RAMP.stone).sphere(13, 17.4, 10, 3, [C.dblue, C.dblue, C.blue, C.cyan]);
  p.thin(6, 18, 9, 18, C.cyan).thin(15, 18.6, 19, 18.6, C.cyan).dot(10.5, 17, C.white).dot(16, 16.6, C.white);
  for (const [x, y] of [[2.4, 20], [3.6, 21.6], [23, 20.5]]) p.dot(x, y, C.green).dot(x + e, y, C.dgreen);
  // Kolumna i górna czarka.
  p.block(11.5, 8, 3, 9, RAMP.stone).thin(12.5, 9, 12.5, 16, C.lgray);
  p.sphere(13, 7.5, 4.6, 1.8, RAMP.stone).sphere(13, 7, 3.4, 0.9, [C.dblue, C.blue, C.cyan, C.cyan]);
  // Strumień i krople: przesuwają się z klatką.
  p.thin(13, 2.5, 13, 6.4, C.cyan).dot(13 - e, 3, C.white);
  for (let i = 0; i < 4; i++) {
    const t = ((f + i * 0.75) % 3) / 3, side = i % 2 ? 1 : -1;
    p.spot(13 + side * (2 + t * 5), 8 + t * t * 8, t < 0.5 ? C.white : C.cyan);
  }
  return p.outline();
}

/** Kolory run (kolejność = indeks runy, mural pokazuje sekwencję). */
export const RUNE_COLS = [C.red, C.lime, C.cyan, C.yellow];

/** Znaki run (odcinki w jednostkach projektu, środek kamienia ok. 7,11): każda runa ma inny kształt. */
const GLYPHS: [number, number, number, number][][] = [
  [[7, 6.5, 7, 15.5], [7, 8, 9.5, 10], [7, 12, 9.5, 10]],
  [[5.5, 15.5, 7, 6.5], [7, 6.5, 8.5, 15.5], [6, 12, 8, 12]],
  [[5.5, 7, 5.5, 15], [8.5, 7, 8.5, 15], [5.5, 9, 8.5, 13]],
  [[7, 6.5, 7, 15.5], [5, 8.5, 9, 12.5], [9, 8.5, 5, 12.5]],
];

/** Kamień runiczny `i`: zaokrąglony menhir z wyrytym znakiem, zapalony = jaśniejący znak i poświata. */
export function rune(i: number, lit: boolean): Painter {
  const p = new Painter(14, 20, HI);
  const e = 1 / HI, col = RUNE_COLS[i];
  p.polyShade([[2, 19], [2.4, 6], [4, 3], [7, 2], [10, 3], [11.6, 6], [12, 19]], RAMP.stone);
  p.thin(3, 6, 3.4, 18, C.lgray).dot(10, 15, C.slate).dot(9.6, 7, C.slate);
  for (const [x, y] of [[2.8, 18.4], [11, 18.2]]) p.dot(x, y, C.green).dot(x + e, y, C.dgreen);
  if (lit) p.soft((x, y) => Math.hypot((x - 7) / 4.5, (y - 11) / 6), col, 0.9);
  for (const [a, b, c2, d] of GLYPHS[i]) p.stroke(a, b + e, c2, d + e, C.navy);
  for (const [a, b, c2, d] of GLYPHS[i]) p.stroke(a - e, b, c2 - e, d, lit ? C.white : col);
  return p.outline();
}

/** Malowidło: oprawiona kamienna tablica z kolejnością czterech kolorów (strzałki między nimi). */
export function mural(order: number[]): Painter {
  const p = new Painter(30, 20, HI);
  const e = 1 / HI;
  p.block(1, 3, 28, 15, RAMP.wood);
  for (const [x, y] of [[1.6, 3.6], [27.6, 3.6], [1.6, 16.6], [27.6, 16.6]]) p.dot(x, y, C.gold).dot(x + e, y + e, C.dbrown);
  p.rect(3, 5, 24, 11, C.tan).rect(3.4, 5.4, 23.2, 10.2, C.cream);
  for (const [x, y] of [[6, 13.5], [20, 6.4], [24, 14]]) p.thin(x, y, x + 2, y + 0.5, C.tan);
  order.forEach((c, k) => {
    const x = 6.5 + k * 6;
    p.sphere(x, 10.5, 2.3, 2.3, [C.black, RUNE_COLS[c], RUNE_COLS[c], C.white]);
    if (k < 3) p.thin(x + 2.7, 10.5, x + 3.6, 10.5, C.brown).dot(x + 3.3, 10.2, C.brown).dot(x + 3.3, 10.8, C.brown);
  });
  return p.outline();
}

/** Dziwny grzyb (do zjedzenia): kapelusz w kropki, blaszki pod spodem i lekka poświata. */
export function mushroom(): Painter {
  const p = new Painter(12, 13, HI);
  const e = 1 / HI;
  p.soft((x, y) => Math.hypot((x - 6) / 5.6, (y - 6.4) / 4.6), C.plum, 0.9);
  p.block(4.8, 7, 2.6, 5, [C.tan, C.cream, C.cream, C.white]).thin(5.2, 8, 5.2, 11.4, C.white);
  p.sphere(6, 6, 5.2, 3.4, [C.plum, C.pink, C.hotpink, C.salmon]);
  for (let x = 2; x < 10.5; x += 1) p.dot(x, 7.4, C.plum);
  for (const [x, y, r] of [[3.8, 4.8, 0.8], [7.6, 3.8, 0.9], [6, 6, 0.6], [9.2, 5.8, 0.5]] as const) p.disc(x, y, r, C.white);
  p.dot(2.6, 12.2, C.green).dot(9, 12, C.green).dot(9 + e, 12, C.dgreen);
  return p.outline();
}

/** Schody w głąb (pod rozbitą ścianą): dziura z kamiennym obrzeżem, stopnie ciemnieją w dół. */
export function stairs(): Painter {
  const p = new Painter(22, 16, HI);
  p.sphere(11, 9, 10, 6, RAMP.stone);
  p.sphere(11, 9.4, 8.2, 4.6, [C.black, C.black, C.navy, C.slate]);
  const steps = [C.lavender, C.dgray, C.slate, C.navy];
  for (let k = 0; k < 4; k++) {
    const w = 11 - k * 2, y = 6 + k * 1.8;
    p.rect(11 - w / 2, y, w, 1.2, steps[k]).thin(11 - w / 2, y, 11 + w / 2, y, k ? steps[k - 1] : C.lgray);
  }
  for (const [x, y] of [[3, 7], [18, 6], [4, 12]]) p.spot(x, y, C.dgray);
  return p.outline();
}

/** Kurhan: porośnięty kopiec z kamiennym portalem i trzema gniazdami na klucze (`open`: drzwi otwarte, gniazda świecą). */
export function barrow(open: boolean): Painter {
  const p = new Painter(32, 24, HI);
  const e = 1 / HI;
  p.sphere(16, 19, 15, 10, RAMP.green).sphere(16, 19.5, 12, 7.5, [C.dgreen, C.dgreen, C.green, C.green]);
  for (let k = 0; k < 14; k++) { const x = 3 + k * 1.9, y = 15 + Math.abs(k - 7) * 0.6; p.thin(x, y, x + 0.4, y - 1.2, k % 2 ? C.lime : C.dgreen); }
  // Portal: nadproże i ościeża z bloków, drzwi z kamiennej płyty albo czarny otwór.
  p.block(9.5, 8.5, 13, 2.2, RAMP.stone).block(10, 10.5, 2.6, 12, RAMP.stone).block(19.4, 10.5, 2.6, 12, RAMP.stone);
  if (open) p.rect(12.6, 10.7, 6.8, 11.8, C.black).thin(12.6, 10.7, 19.4, 10.7, C.navy);
  else p.block(12.6, 10.7, 6.8, 11.8, [C.slate, C.dgray, C.dgray, C.lavender]).thin(16, 11.5, 16, 21.5, C.slate);
  for (let k = 0; k < 3; k++) {
    const x = 12 + k * 4;
    p.disc(x, 9.6, 0.7, open ? C.gold : C.black);
    if (open) p.dot(x - e, 9.3, C.yellow);
  }
  return p.outline();
}

/** Ukryty gaj białego jelenia: krąg drobnych kwiatów wokół świecącego kryształu na kamieniu. */
export function grove(): Painter {
  const p = new Painter(26, 18, HI);
  const e = 1 / HI;
  p.soft((x, y) => Math.hypot((x - 13) / 9, (y - 10) / 5.4), C.dgreen, 0.6);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2, x = 13 + Math.cos(a) * 11, y = 10 + Math.sin(a) * 6, c = i % 2 ? C.white : C.pink;
    p.thin(x, y + 0.4, x, y + 1.6, C.green);
    for (const [dx, dy] of [[-0.6, 0], [0.6, 0], [0, -0.6], [0, 0.6]]) p.dot(x + dx, y + dy, c);
    p.dot(x, y, C.yellow);
  }
  p.sphere(13, 13, 4, 2, RAMP.stone);
  p.soft((x, y) => Math.hypot((x - 13) / 3.4, (y - 9) / 4), C.cyan, 0.8);
  p.polyShade([[13, 4.5], [15, 9], [13, 12.6], [11, 9]], [C.dblue, C.blue, C.cyan, C.white]).thin(12.6, 6, 12.2, 9, C.white).dot(13 + e, 5.4, C.white);
  return p.outline();
}

// ---------------- cechy elit (0.41, systems/enemies.ts) ----------------

/** Sztandar elity: drzewce ze złotym grotem i czerwony płat ze złotym obszyciem i godłem, powiewający (klatka 0-2). */
export function banner(f: number): Painter {
  const p = new Painter(16, 24, HI);
  const e = 1 / HI, w = [0, 0.8, -0.6][f % 3];
  p.rect(2.5, 3, 1.2, 20, C.dbrown).thin(2.5, 3, 2.5, 22.5, C.clay);
  p.poly([[3.1, 0.5], [4.1, 2.8], [2.1, 2.8]], C.gold).dot(3.1, 1.2, C.yellow);
  p.disc(3.1, 23, 1.6, C.slate);
  // Płat: górna krawędź prosta przy drzewcu, dół i wolny brzeg falują z klatką.
  const cloth: [number, number][] = [[3.7, 3.2], [14 + w, 3.6 + w * 0.5], [13 - w, 8.5], [14.4 + w, 13.4 - w * 0.4], [3.7, 12.6]];
  p.polyShade(cloth, RAMP.red);
  p.thin(3.8, 3.4, 14 + w, 3.8 + w * 0.5, C.gold).thin(3.8, 12.4, 14.4 + w, 13.2 - w * 0.4, C.gold);
  // Godło: skrzyżowane złote miecze z jelcami.
  p.stroke(6.4, 5.6, 10.6, 10.2, C.gold).stroke(10.6, 5.6, 6.4, 10.2, C.gold);
  p.thin(6.6, 5.7, 8.6, 7.9, C.yellow).dot(6.2 + e, 5.4, C.yellow).dot(10.6, 5.4, C.yellow);
  p.thin(6.2, 9.4, 7.6, 10.8, C.dbrown).thin(10.8, 9.4, 9.4, 10.8, C.dbrown);
  return p.outline();
}

/** Ikona cechy elity 10×10 nad paskiem życia: korona (Dowódca), flaga (Chorąży), duch (Fazujący), trzy odłamki (Rozszczepiający). */
export function traitMark(kind: string): Painter {
  const p = new Painter(10, 10, HI);
  if (kind === 'commander') {
    p.poly([[1.2, 7.8], [1.6, 3], [3.6, 5.2], [5, 2], [6.4, 5.2], [8.4, 3], [8.8, 7.8]], C.gold);
    p.rect(1.2, 7, 7.6, 1.4, C.orange).dot(5, 7.4, C.red).dot(3, 7.4, C.cyan).dot(7, 7.4, C.cyan).dot(5, 2.4, C.yellow);
  } else if (kind === 'banner') {
    p.rect(2, 1, 0.9, 8, C.brown).poly([[2.9, 1.4], [8.4, 2.4], [7, 4], [8.4, 5.6], [2.9, 5.6]], C.red).thin(2.9, 1.5, 8, 2.4, C.salmon);
  } else if (kind === 'phase') {
    p.sphere(5, 4.6, 3.4, 3.4, [C.plum, C.lavender, C.lgray, C.white]).poly([[1.6, 4.6], [8.4, 4.6], [8.4, 8.8], [6.7, 7.6], [5, 8.8], [3.3, 7.6], [1.6, 8.8]], C.lavender);
    p.dot(3.8, 4.2, C.black).dot(6, 4.2, C.black);
  } else {
    for (const [x, y] of [[5, 2.6], [2.6, 7], [7.4, 7]]) p.polyShade([[x, y - 1.8], [x + 1.6, y], [x, y + 1.8], [x - 1.6, y]], RAMP.purple);
    p.thin(5, 4.4, 3.4, 5.6, C.pink).thin(5, 4.4, 6.6, 5.6, C.pink);
  }
  return p.outline();
}

/** Wzmocnienie od Dowódcy: podwójna złota strzałka w górę nad wrogiem (7×7). */
export function buffMark(): Painter {
  const p = new Painter(7, 7, HI);
  for (const y of [1, 3.6]) p.poly([[1, y + 2.4], [3.5, y], [6, y + 2.4], [4.8, y + 2.4], [3.5, y + 1.2], [2.2, y + 2.4]], y < 2 ? C.yellow : C.gold);
  return p.outline();
}
