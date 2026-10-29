import { C, RAMP } from '../core/palette';
import { Painter } from './painter';
import { ITEM_ICONS } from './items';
import { CARD_ICONS_GFX } from './card-icons';
import { HERO_ICONS } from './hero-icons';
import { ALT_EVOS, WEAPON_BY_ID, evolvesOf } from '../data/weapons';
import { PASSIVES } from '../data/passives';

/**
 * Ikony 16×16 (piktogramy) dla broni, pasywek, umiejętności i tagów kart.
 * Każda funkcja maluje na siatce 16×16 z 1 px marginesem — obrys dodaje rejestr sprite'ów.
 * Nazwy: ic_<broń>, pi_<pasywka>, ab_<umiejętność>, tag:<Tag>, it_<przedmiot> (gfx/items.ts).
 */
type IconFn = (p: Painter) => void;

const TAU = Math.PI * 2;

function arrow(p: Painter, x0: number, y0: number, x1: number, y1: number, head: number = C.lgray, fletch: number = C.red): void {
  p.line(x0, y0, x1, y1, C.brown);
  const dx = Math.sign(x1 - x0), dy = Math.sign(y1 - y0);
  p.px(x1, y1, C.white).px(x1 - dx, y1, head).px(x1, y1 - dy, head);
  p.px(x0, y0, fletch).px(x0 + dx, y0, fletch).px(x0, y0 + dy, fletch);
}

/** Strzała z wielokątów (styl 32-bit): drzewce z jaśniejszą krawędzią, stalowy grot z białą krawędzią, czerwone lotki. */
export function arrowHi(p: Painter, x0: number, y0: number, x1: number, y1: number, fl = 1): void {
  const L = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / L, uy = (y1 - y0) / L, nx = -uy, ny = ux;
  const at = (k: number, s: number): [number, number] => [x0 + ux * k + nx * s, y0 + uy * k + ny * s];
  // Lotki: dwa skośne pióra przy końcu.
  p.poly([at(0, 0), at(2.8 * fl, 0), at(3.6 * fl, 1.5 * fl), at(0.6 * fl, 1.5 * fl)], C.red).poly([at(0, 0), at(2.8 * fl, 0), at(3.6 * fl, -1.5 * fl), at(0.6 * fl, -1.5 * fl)], C.dred);
  // Drzewce.
  p.poly([at(0.5, 0.45), at(L - 2.4, 0.45), at(L - 2.4, -0.45), at(0.5, -0.45)], C.brown);
  p.thin(...at(1, -0.3), ...at(L - 2.6, -0.3), C.clay);
  // Grot.
  p.poly([at(L, 0), at(L - 3, 1.5), at(L - 2.4, 0), at(L - 3, -1.5)], C.lgray);
  p.thin(...at(L - 0.2, 0), ...at(L - 2.8, -1.3), C.white);
}

/**
 * Sieć (E Kestry i jej ewolucja): koło z ukośnych linek (oczka co 3 px), jasne węzły na skrzyżowaniach,
 * grubsza lina na obwodzie z obciążnikami. `rope`: [cień, linka, węzeł, lina brzegu], `weight`: kolor obciążników.
 */
export function netIcon(p: Painter, rope: readonly number[], weight: number): void {
  const [dark, mid, knot, rim] = rope, cx = 8, cy = 8, R = 6.3;
  // Rzadkie ukośne linki w dwóch kierunkach (cięciwy koła co 4 px): przez oczka widać tło.
  for (const sgn of [1, -1]) {
    for (let k = -8; k <= 8; k += 4) {
      const d = k / Math.SQRT2, h = Math.sqrt(Math.max(0, R * R - d * d)) - 0.6;
      if (h < 1) continue;
      const ux = 1 / Math.SQRT2, uy = sgn / Math.SQRT2, nx = -uy, ny = ux;
      // Cienka linka (2 piksele obrazu): oczka zostają otwarte, widać złapanego wroga.
      p.stroke(cx + nx * d - ux * h, cy + ny * d - uy * h, cx + nx * d + ux * h, cy + ny * d + uy * h, mid);
    }
  }
  // Węzły: przecięcia linek wewnątrz koła.
  for (let i = -8; i <= 8; i += 4) for (let j = -8; j <= 8; j += 4) {
    const x = cx + (i + j) / 2, y = cy + (j - i) / 2;
    if ((x - cx) ** 2 + (y - cy) ** 2 < (R - 1.2) ** 2) p.spot(x, y, knot);
  }
  // Lina brzegu: ciemny dół, jasna góra (światło z lewej góry), obciążniki po skosach.
  for (let a = 0; a < Math.PI * 2; a += 0.05) p.spot(cx + Math.cos(a) * R, cy + Math.sin(a) * R, Math.sin(a - 0.8) < -0.3 ? rim : dark);
  for (const a of [0.25, 0.75, 1.25, 1.75]) {
    const x = cx + Math.cos(a * Math.PI) * R, y = cy + Math.sin(a * Math.PI) * R;
    p.px(x, y, weight).px(x - 0.5, y - 0.5, C.lgray);
  }
}

function sparkle(p: Painter, x: number, y: number, c: number = C.white): void {
  p.px(x, y, c).px(x - 1, y, C.yellow).px(x + 1, y, C.yellow).px(x, y - 1, C.yellow).px(x, y + 1, C.yellow);
}

function heart(p: Painter, cx: number, cy: number, s: number, ramp: readonly number[]): void {
  p.sphere(cx - 2.5 * s, cy - 1 * s, 3 * s, 3 * s, ramp).sphere(cx + 2.5 * s, cy - 1 * s, 3 * s, 3 * s, ramp);
  p.polyShade([[cx - 5.4 * s, cy], [cx + 5.4 * s, cy], [cx, cy + 6 * s]], ramp);
  p.px(cx - 3, cy - 2.5, C.white);
}

function shield(p: Painter, ramp: readonly number[], emblem: number): void {
  p.polyShade([[3, 2], [13, 2], [13, 8], [8, 14.5], [3, 8]], ramp);
  p.line(4, 3, 12, 3, ramp[3]);
  p.line(8, 4, 8, 11, emblem).line(5, 6, 11, 6, emblem);
}

/** Skrzydło: pełna sylwetka od barku (prawa góra) do końca lotek (lewo), falista tylna krawędź, rysy między lotkami, jasna krawędź natarcia. */
function wing(p: Painter, ramp: readonly number[]): void {
  p.polyShade([[14.5, 1], [10, 1.8], [5.5, 4.5], [1, 9], [3.2, 9.6], [1.8, 12.5], [5, 11.5], [4.8, 14.5], [7.8, 12], [9, 14], [10.8, 10.2], [12.8, 11], [13.6, 6.5], [15, 4]], ramp);
  for (const [x0, y0, x1, y1] of [[11, 4.5, 3.2, 9.6], [11.8, 6, 5, 11.5], [12.4, 7.5, 7.8, 12], [13, 8.5, 10.8, 10.2]] as const) p.thin(x0, y0, x1, y1, ramp[1]);
  p.thin(14, 1.3, 5.5, 4.7, C.white).thin(5.5, 4.7, 1.5, 8.8, ramp[3]);
}

function flame(p: Painter, cx: number, cy: number, s: number): void {
  p.polyShade([[cx, cy - 7 * s], [cx + 5 * s, cy + 1 * s], [cx, cy + 6 * s], [cx - 5 * s, cy + 1 * s]], RAMP.fire);
  p.sphere(cx, cy + 2 * s, 4 * s, 4 * s, RAMP.fire);
  p.sphere(cx, cy + 3 * s, 2 * s, 2.2 * s, [C.gold, C.yellow, C.white]);
}

function skull(p: Painter, cx: number, cy: number): void {
  p.sphere(cx, cy - 1, 5, 4.5, RAMP.bone).rect(cx - 3, cy + 2, 6, 3, C.lgray).rect(cx - 3, cy + 2, 6, 1, C.cream);
  p.rect(cx - 3, cy - 1, 2, 2, C.black).rect(cx + 1, cy - 1, 2, 2, C.black).px(cx, cy + 1, C.black);
  for (let x = cx - 2; x <= cx + 2; x += 2) p.px(x, cy + 4, C.dgray);
}

/** Znak hybrydy z fuzji: różowy romb w lewym górnym rogu. */
function fuseMark(p: Painter): void {
  p.px(1, 0, C.hotpink).px(0, 1, C.hotpink).px(2, 1, C.hotpink).px(1, 2, C.hotpink).px(1, 1, C.white);
}

/** Półksiężyc: łuk zewnętrzny (promień R) minus przesunięty łuk wewnętrzny, wypukły w stronę kąta `rot`. */
export function crescentPts(cx: number, cy: number, R: number, cut: number, rot: number): [number, number][] {
  const pts: [number, number][] = [], n = 14, span = 2.3;
  for (let i = 0; i <= n; i++) { const a = rot - span + (2 * span * i) / n; pts.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]); }
  const ix = cx - Math.cos(rot) * cut, iy = cy - Math.sin(rot) * cut, r = R * 0.9;
  for (let i = n; i >= 0; i--) { const a = rot - span * 0.82 + (2 * span * 0.82 * i) / n; pts.push([ix + Math.cos(a) * r, iy + Math.sin(a) * r]); }
  return pts;
}

/** Kostka do gry: zaokrąglony kwadrat z oczkami (1–6). */
export function die(p: Painter, x: number, y: number, s: number, face: number, body: readonly number[], pip: number): void {
  p.polyShade([[x + 1, y], [x + s - 1, y], [x + s, y + 1], [x + s, y + s - 1], [x + s - 1, y + s], [x + 1, y + s], [x, y + s - 1], [x, y + 1]], body as number[]);
  const q = s / 4, c = s / 2, P: Record<number, [number, number][]> = {
    1: [[c, c]], 2: [[q, q], [s - q, s - q]], 3: [[q, q], [c, c], [s - q, s - q]], 4: [[q, q], [s - q, q], [q, s - q], [s - q, s - q]],
    5: [[q, q], [s - q, q], [c, c], [q, s - q], [s - q, s - q]], 6: [[q, q], [s - q, q], [q, c], [s - q, c], [q, s - q], [s - q, s - q]],
  };
  for (const [px, py] of P[face]) p.spot(x + px - 0.3, y + py - 0.3, pip);
}

function boltShape(p: Painter, ox: number, oy: number, col: number = C.yellow): void {
  p.poly([[ox + 8, oy + 1], [ox + 3, oy + 8], [ox + 7, oy + 8], [ox + 5, oy + 15], [ox + 12, oy + 6], [ox + 8, oy + 6], [ox + 10, oy + 1]], col);
  p.line(ox + 8, oy + 2, ox + 5, oy + 7, C.white);
}

export const ICON_FNS: Record<string, IconFn> = {
  ...ITEM_ICONS,
  ...CARD_ICONS_GFX,
  ...HERO_ICONS,
  // ===================== bronie =====================
  ic_sickle: (p) => {
    // Sierp krwi: drewniany trzonek i zakrzywione ostrze z czerwoną krawędzią, kropla krwi.
    p.stroke(3, 15, 7, 9, C.dbrown).thin(3.5, 14.5, 7, 9.5, C.clay);
    p.polyShade(crescentPts(9, 6.5, 6, 2.6, -0.5), [C.slate, C.lgray, C.lavender, C.white]);
    p.poly(crescentPts(9, 6.5, 6, 4.6, -0.5), C.red);
    p.px(13, 12, C.red).px(13, 13, C.dred);
  },
  ic_sickle_evo: (p) => {
    // Księżyc żniwiarza: krwawy półksiężyc z poświatą i kroplami.
    p.polyShade(crescentPts(8, 8, 7, 3, -0.6), [C.dred, C.red, C.salmon, C.white]);
    p.poly(crescentPts(8, 8, 7, 1.3, -0.6), C.salmon);
    p.px(4, 13, C.red).px(3, 14, C.dred).px(13, 14, C.salmon);
    sparkle(p, 12, 4);
  },
  ic_dice: (p) => {
    die(p, 1, 6, 8, 3, [C.slate, C.lgray, C.white, C.white], C.dgray);
    die(p, 7, 2, 8, 6, [C.slate, C.lgray, C.white, C.white], C.red);
  },
  ic_dice_evo: (p) => {
    die(p, 2, 3, 11, 6, [C.dbrown, C.orange, C.gold, C.yellow], C.ddbrown);
    sparkle(p, 14, 2);
    p.px(1, 14, C.gold).px(14, 14, C.yellow);
  },
  ic_bolt: (p) => {
    // Magiczny pocisk: świecąca kula z ogonem komety i iskrami.
    p.stroke(2, 14, 6, 10, C.dblue).stroke(3, 13.5, 7, 9.5, C.blue).thin(2.5, 12.5, 7.5, 8.5, C.cyan);
    p.sphere(10, 6, 4.4, 4.4, RAMP.blue).sphere(9.2, 5.2, 1.8, 1.8, [C.cyan, C.white, C.white]);
    p.px(13.5, 1.5, C.cyan).px(3, 8, C.cyan).px(14, 10, C.white);
  },
  ic_bolt_evo: (p) => {
    p.poly([[9, 1], [10.6, 5.5], [15, 5.8], [11.6, 8.8], [12.8, 13.5], [9, 10.8], [5.2, 13.5], [6.4, 8.8], [3, 5.8], [7.4, 5.5]], C.gold);
    p.poly([[9, 3.5], [10, 6.5], [12.5, 6.8], [10.5, 8.6], [11.2, 11.3], [9, 9.6], [6.8, 11.3], [7.5, 8.6], [5.5, 6.8], [8, 6.5]], C.yellow);
    p.px(9, 7, C.white);
    sparkle(p, 3, 12);
  },
  ic_arrow: (p) => { arrow(p, 2, 13, 12, 3); p.poly([[10, 2], [14, 2], [14, 6]], C.lgray).px(13, 2, C.white); },
  ic_arrow_evo: (p) => {
    p.line(4, 2, 2, 7, C.brown).line(2, 7, 2, 9, C.brown).line(2, 9, 4, 14, C.brown).px(3, 4, C.clay).px(2, 8, C.clay);
    p.line(4, 2, 4, 14, C.lgray);
    arrow(p, 5, 8, 14, 8, C.cyan, C.cyan);
    p.line(7, 4, 12, 4, C.cyan).line(8, 12, 13, 12, C.cyan).px(13, 5, C.white).px(14, 11, C.white);
  },
  ic_staff: (p) => {
    // Kostur ognia: drzewce ze słojami, złote ramię i duża kula płomienia.
    p.line(2, 15, 9, 8, C.dbrown).thin(2.5, 14, 9, 7.5, C.clay);
    p.ring(11, 5.5, 3.8, 1, C.gold).thin(8.5, 3, 10, 2, C.yellow);
    p.sphere(11, 5.5, 3, 3, RAMP.fire).sphere(10.4, 4.8, 1.4, 1.4, [C.gold, C.yellow, C.white]);
    p.px(14.5, 1.5, C.orange).px(15, 4, C.gold);
  },
  ic_staff_evo: (p) => {
    p.line(2, 14, 9, 7, C.brown).line(3, 14, 10, 7, C.dbrown);
    p.poly([[6, 3], [10, 6], [5, 7]], C.orange).poly([[15, 1], [12, 7], [10, 3]], C.orange);
    p.sphere(11, 5, 3.5, 3.5, [C.orange, C.gold, C.yellow, C.white]).px(10, 4, C.white);
  },
  ic_souls: (p) => {
    // Dusze: trzy ogniki z falującymi ogonami i czarnymi oczami.
    for (const [x, y, sz] of [[5, 6, 3], [11, 5, 2.4], [9.5, 11.5, 2.6]] as const) {
      p.stroke(x, y + sz * 0.6, x - sz * 0.6, y + sz * 1.7, C.plum).stroke(x - sz * 0.6, y + sz * 1.7, x + sz * 0.2, y + sz * 2.4, C.pink);
      p.sphere(x, y, sz, sz * 1.05, [C.plum, C.pink, C.salmon, C.white]);
      p.px(x - sz * 0.4, y - 0.2, C.black).px(x + sz * 0.3, y - 0.2, C.black);
    }
  },
  ic_souls_evo: (p) => {
    p.ring(8, 8, 6.5, 1, C.lime);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      p.sphere(8 + Math.cos(a) * 5, 8 + Math.sin(a) * 5, 1.8, 1.8, [C.plum, C.pink, C.salmon, C.white]);
    }
    p.sphere(8, 8, 2.4, 2.4, RAMP.bone).px(7, 8, C.black).px(9, 8, C.black);
  },
  ic_orbit: (p) => {
    // Orbita: świecący rdzeń, eliptyczny tor i trzy kryształy na nim (jasna ściana od światła).
    for (let a = 0; a < TAU; a += 0.06) p.spot(8 + Math.cos(a) * 6.3, 8 + Math.sin(a) * 3.2, Math.sin(a) > 0 ? C.lavender : C.slate);
    p.sphere(8, 8, 2.6, 2.6, RAMP.blue).px(7.3, 7.3, C.white);
    for (const a of [-2.2, 0.3, 2.3]) {
      const x = 8 + Math.cos(a) * 6.3, y = 8 + Math.sin(a) * 3.2;
      p.poly([[x, y - 2.8], [x + 1.8, y], [x, y + 2.8], [x - 1.8, y]], C.cyan).poly([[x, y - 2.8], [x, y + 2.8], [x - 1.8, y]], C.white).px(x + 0.5, y + 0.5, C.blue);
    }
  },
  ic_orbit_evo: (p) => {
    p.sphere(8, 8, 4.5, 4.5, RAMP.purple);
    for (let a = 0; a < TAU; a += 0.05) { const x = 8 + Math.cos(a) * 7, y = 8 + Math.sin(a) * 2.6; if (y > 8 || Math.abs(x - 8) > 4) p.px(x, y, C.gold); }
    p.line(2, 8, 14, 8, C.yellow).px(6, 6, C.white);
  },
  ic_aura: (p) => {
    p.ring(8, 8, 7, 2, C.gold).ring(8, 8, 4.5, 1, C.orange);
    p.sphere(8, 8, 2.5, 2.5, RAMP.gold).px(7, 7, C.white);
  },
  ic_aura_evo: (p) => {
    p.block(4, 5, 8, 10, RAMP.stone).rect(3, 3, 2, 3, C.lavender).rect(7, 3, 2, 3, C.lavender).rect(11, 3, 2, 3, C.lavender);
    p.rect(3, 3, 2, 1, C.lgray).rect(7, 3, 2, 1, C.lgray).rect(11, 3, 2, 1, C.lgray);
    p.rect(7, 10, 2, 5, C.ddbrown).px(7, 7, C.gold).px(8, 7, C.yellow);
    p.ring(8, 9, 7.5, 1, C.orange);
  },
  ic_chain: (p) => boltShape(p, 0, 0),
  ic_chain_evo: (p) => {
    p.sphere(5, 5, 3.5, 3, RAMP.stone).sphere(10, 4.5, 4.5, 3.5, RAMP.stone).rect(3, 6, 11, 2, C.lavender);
    p.poly([[9, 7], [6, 11], [8, 11], [6.5, 15], [11, 9.5], [9, 9.5], [10.5, 7]], C.cyan).px(8, 9, C.white);
  },
  ic_meteor: (p) => {
    p.poly([[1, 1], [8, 6], [6, 9]], C.orange).poly([[2, 3], [7, 7], [5, 8]], C.gold);
    p.sphere(9.5, 9.5, 4.2, 4.2, RAMP.fire).px(8, 8, C.yellow);
  },
  ic_meteor_evo: (p) => {
    p.poly([[1, 0.5], [7, 6], [5, 8]], C.red).poly([[5, 0.5], [10, 6], [8, 7]], C.orange).poly([[0.5, 5], [6, 10], [4, 11]], C.orange);
    p.sphere(10, 10, 4.5, 4.5, RAMP.red).px(9, 8, C.salmon).px(11, 11, C.ddbrown);
  },
  ic_boomerang: (p) => {
    // Bumerang: wygięte ramiona z jaśniejszą krawędzią, słoje drewna i łuk ruchu.
    p.polyShade([[1.5, 9], [7.5, 2.5], [9.5, 3.5], [5, 9], [9.5, 13], [14.5, 12], [13, 14.5], [7.5, 15], [3.5, 12]], RAMP.wood);
    p.thin(2.5, 9, 7.5, 3.5, C.tan).thin(5, 10, 9, 13.8, C.clay).spot(6, 7, C.dbrown).spot(8.5, 12.5, C.dbrown);
    for (let a = -1.4; a < 0.2; a += 0.14) p.spot(10 + Math.cos(a) * 5.5, 8 + Math.sin(a) * 5.5, C.lgray);
  },
  ic_boomer_evo: (p) => {
    for (let k = 0; k < 3; k++) {
      const a = (k * TAU) / 3, c = Math.cos(a), s = Math.sin(a);
      const R = (x: number, y: number): [number, number] => [8 + x * c - y * s, 8 + x * s + y * c];
      p.poly([R(0, 0), R(6, -2), R(7, 0), R(1, 2)], k === 0 ? C.gold : C.clay);
    }
    p.sphere(8, 8, 1.8, 1.8, RAMP.stone);
  },
  ic_laser: (p) => {
    // Laser: fioletowy kryształ-emiter i szeroka wiązka z jasnym rdzeniem, iskry na końcu.
    p.line(4.5, 3.5, 15, 14, C.plum).line(3.5, 4.5, 14, 15, C.plum).line(4, 4, 14.5, 14.5, C.pink).thin(4.3, 4.3, 14.5, 14.5, C.white).thin(4.8, 4.3, 15, 14.5, C.white);
    p.polyShade([[3, 0.5], [6.5, 3.5], [3.5, 6.5], [0.5, 3]], RAMP.purple).px(2.5, 2.5, C.white);
    p.px(15, 12, C.white).px(12, 15, C.pink).px(15, 15, C.salmon);
  },
  ic_laser_evo: (p) => {
    p.polyShade([[8, 2], [13, 12], [3, 12]], [C.slate, C.lavender, C.lgray, C.white]);
    p.line(13, 9, 15, 7, C.red).line(13, 10, 15, 10, C.yellow).line(13, 11, 15, 13, C.cyan).line(0, 8, 5, 8, C.white);
  },
  ic_mines: (p) => {
    // Mina: stalowa kula z kolcami, nity i czerwona dioda.
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU + 0.2;
      p.stroke(8 + Math.cos(a) * 4, 8.5 + Math.sin(a) * 4, 8 + Math.cos(a) * 6.8, 8.5 + Math.sin(a) * 6.8, k < 4 ? C.dgray : C.lavender);
    }
    p.sphere(8, 8.5, 5, 5, RAMP.night).thin(4.5, 7, 7, 4.5, C.dgray);
    p.sphere(8, 8.5, 1.6, 1.6, [C.dred, C.red, C.salmon, C.white]);
    p.spot(5.5, 10.5, C.slate).spot(10.5, 10.5, C.slate);
  },
  ic_mines_evo: (p) => {
    p.polyShade([[1, 14.5], [6, 5], [10, 5], [15, 14.5]], RAMP.wood);
    p.rect(6, 5, 4, 2, C.orange).poly([[7, 5], [5, 0.5], [9, 3], [11, 0.5], [9, 5]], C.red).line(7, 7, 6, 12, C.orange).px(8, 9, C.gold);
  },
  ic_axe: (p) => { p.line(3, 14, 10, 5, C.brown).polyShade([[8.5, 1], [14.5, 3], [13.5, 10], [9, 7]], RAMP.stone); p.line(14, 3, 13, 9, C.white); },
  ic_axe_evo: (p) => {
    p.line(3, 14, 10, 5, C.ddbrown).polyShade([[8.5, 1], [14.5, 3], [13.5, 10], [9, 7]], RAMP.red);
    p.line(14, 3, 13, 9, C.salmon).px(11, 11, C.red).px(11, 12, C.dred).px(5, 13, C.red);
  },

  // ===================== hybrydy z fuzji =====================
  // Znak fuzji: różowy romb w lewym górnym rogu (fuseMark).
  ic_f_firearrow: (p) => {
    p.line(2, 14, 11, 5, C.brown).px(2, 14, C.red).px(3, 14, C.red).px(2, 13, C.red);
    flame(p, 11.5, 5, 0.55);
    p.px(5, 9, C.orange).px(7, 10, C.gold);
    fuseMark(p);
  },
  ic_f_stormarrow: (p) => {
    arrow(p, 2, 14, 10, 6, C.yellow, C.cyan);
    p.poly([[10, 6], [15, 1], [13, 5], [15, 6], [11, 8]], C.yellow).px(13, 3, C.white);
    p.line(11, 9, 14, 12, C.yellow).line(7, 4, 9, 1, C.yellow);
    fuseMark(p);
  },
  ic_f_frostwhirl: (p) => {
    for (let k = 0; k < 2; k++) {
      const a = k * Math.PI, c = Math.cos(a), s = Math.sin(a);
      const R = (x: number, y: number): [number, number] => [8 + x * c - y * s, 8 + x * s + y * c];
      p.polyShade([R(1, -2), R(6.5, -5), R(7, 1), R(2, 1)], [C.navy, C.blue, C.cyan, C.white]);
    }
    p.ring(8, 8, 7, 1, C.cyan).sphere(8, 8, 1.8, 1.8, RAMP.stone);
    p.px(3, 3, C.white).px(13, 13, C.white);
    fuseMark(p);
  },
  ic_f_flyaxe: (p) => {
    for (let a = 0.6; a < 4.4; a += 0.15) p.px(8 + Math.cos(a) * 6.5, 8 + Math.sin(a) * 6.5, C.lavender);
    p.line(4, 12, 9, 7, C.brown).polyShade([[8, 3], [13.5, 4.5], [12.5, 10], [9.5, 7.5]], RAMP.stone).line(13, 5, 12.5, 9, C.white);
    p.px(14, 12, C.lgray).px(12, 14, C.lgray);
    fuseMark(p);
  },
  ic_f_stormstaff: (p) => {
    p.line(2, 14, 9, 7, C.brown).line(3, 14, 10, 7, C.dbrown);
    p.sphere(11, 5, 3.6, 3.6, [C.navy, C.blue, C.cyan, C.white]);
    p.poly([[11.5, 2], [9.5, 5.5], [11.2, 5.5], [10, 8.5], [13, 4.5], [11.5, 4.5], [12.5, 2]], C.yellow);
    p.px(15, 2, C.yellow).px(14, 9, C.yellow);
    fuseMark(p);
  },
  ic_f_comet: (p) => {
    p.poly([[0.5, 4], [9, 7], [7, 10]], C.cyan).poly([[2, 1], [10, 6], [8, 8]], C.blue).poly([[3, 6], [9, 9], [8, 10]], C.white);
    p.sphere(10.5, 10.5, 4.5, 4.5, [C.dred, C.orange, C.gold, C.white]).px(9, 9, C.white);
    fuseMark(p);
  },
  ic_f_soulwhirl: (p) => {
    for (let a = 0; a < TAU; a += 0.1) p.px(8 + Math.cos(a) * (3 + a * 0.6), 8 + Math.sin(a) * (3 + a * 0.6), a < 3 ? C.lime : C.green);
    for (const [x, y] of [[12, 4], [4, 12], [13, 12]] as const) p.sphere(x, y, 1.8, 1.8, [C.plum, C.pink, C.salmon, C.white]);
    p.sphere(8, 8, 2.2, 2.2, RAMP.bone).px(7, 8, C.black).px(9, 8, C.black);
    fuseMark(p);
  },
  ic_f_gravemines: (p) => {
    p.px(8, 1, C.lime).px(8, 15, C.lime).px(1, 8, C.lime).px(15, 8, C.lime).px(3, 3, C.lime).px(13, 13, C.lime).px(13, 3, C.lime);
    p.sphere(8, 8.5, 5.5, 5.5, RAMP.night);
    p.sphere(8, 8, 3.2, 3, RAMP.bone).rect(6, 7, 2, 2, C.black).rect(9, 7, 2, 2, C.black).px(8, 10, C.lime);
    fuseMark(p);
  },
  ic_f_bladering: (p) => {
    p.ring(8, 8, 6.5, 1, C.slate);
    for (let k = 0; k < 4; k++) {
      const a = (k * TAU) / 4 + 0.4, x = 8 + Math.cos(a) * 5.5, y = 8 + Math.sin(a) * 5.5, t = a + Math.PI / 2;
      p.line(x - Math.cos(t) * 2.5, y - Math.sin(t) * 2.5, x + Math.cos(t) * 2.5, y + Math.sin(t) * 2.5, C.lgray).px(x + Math.cos(t) * 2.5, y + Math.sin(t) * 2.5, C.white);
    }
    p.sphere(8, 8, 2, 2, RAMP.purple);
    fuseMark(p);
  },
  ic_f_shuriken: (p) => {
    p.poly([[8, 0.5], [9.5, 6.5], [15.5, 8], [9.5, 9.5], [8, 15.5], [6.5, 9.5], [0.5, 8], [6.5, 6.5]], C.slate);
    p.poly([[8, 2.5], [9, 7], [8, 8], [7, 7]], C.lavender).poly([[13.5, 8], [9, 9], [8, 8], [9, 7]], C.lgray);
    p.disc(8, 8, 1.2, C.black).px(8, 2, C.white).px(13, 8, C.white);
    fuseMark(p);
  },
  ic_f_halo: (p) => {
    for (let a = 0; a < TAU; a += TAU / 8) p.line(8 + Math.cos(a) * 3, 9 + Math.sin(a) * 3, 8 + Math.cos(a) * 7, 9 + Math.sin(a) * 7, C.orange);
    for (let a = 0; a < TAU; a += 0.05) p.px(8 + Math.cos(a) * 5.5, 5 + Math.sin(a) * 2, Math.sin(a) > 0 ? C.gold : C.yellow);
    p.sphere(8, 9.5, 2.6, 2.6, [C.gold, C.yellow, C.cream, C.white]);
    fuseMark(p);
  },
  ic_f_sunbeam: (p) => {
    p.line(5, 6, 15, 15, C.gold).line(6, 5, 15, 14, C.yellow).line(5, 5, 15, 15, C.white);
    for (let a = 0; a < TAU; a += TAU / 8) p.px(5 + Math.cos(a) * 5, 5 + Math.sin(a) * 5, C.orange);
    p.sphere(5, 5, 3.4, 3.4, [C.orange, C.gold, C.yellow, C.white]);
    fuseMark(p);
  },
  ic_f_thunderorb: (p) => {
    p.sphere(8, 8, 6.5, 6.5, [C.navy, C.blue, C.cyan, C.white]);
    p.poly([[9, 2.5], [5, 8.5], [7.5, 8.5], [6, 13.5], [11, 7], [8.5, 7], [10.5, 2.5]], C.yellow).px(7, 7, C.white);
    fuseMark(p);
  },
  ic_f_frostring: (p) => {
    p.ring(8, 8, 6, 1.4, C.cyan).ring(8, 8, 3.5, 1, C.blue);
    for (let k = 0; k < 6; k++) {
      const a = (k * TAU) / 6, x = 8 + Math.cos(a) * 6.5, y = 8 + Math.sin(a) * 6.5;
      p.poly([[x, y - 2], [x + 1.2, y], [x, y + 2], [x - 1.2, y]], C.white);
    }
    p.px(8, 8, C.white);
    fuseMark(p);
  },
  ic_f_firefield: (p) => {
    p.polyShade([[0.5, 12], [15.5, 12], [15.5, 15], [0.5, 15]], RAMP.wood);
    flame(p, 4, 9, 0.4); flame(p, 11, 8, 0.5); flame(p, 8, 11, 0.3);
    p.px(2, 13, C.orange).px(13, 14, C.red);
    fuseMark(p);
  },
  ic_f_mirror: (p) => {
    p.polyShade([[9, 1.5], [14.5, 7], [9, 12.5], [3.5, 7]], [C.slate, C.lavender, C.lgray, C.white]);
    p.line(0.5, 14, 7, 9, C.pink).line(9, 7, 15, 13, C.pink).px(15, 13, C.white).px(0, 14, C.white);
    p.line(9, 4, 12, 7, C.white);
    fuseMark(p);
  },

  // ===================== pasywki =====================
  pi_might: (p) => {
    p.line(3, 13, 12, 4, C.lgray).line(4, 13, 13, 4, C.lavender).line(12, 3, 13, 3, C.white).px(13, 2, C.white);
    p.line(3, 9, 7, 13, C.gold).line(2, 10, 6, 14, C.orange);
    p.line(1, 15, 3, 13, C.brown).px(1, 15, C.gold);
  },
  pi_heart: (p) => heart(p, 8, 7, 1, RAMP.red),
  pi_armor: (p) => shield(p, RAMP.stone, C.gold),
  pi_wings: (p) => wing(p, RAMP.bone),
  pi_clock: (p) => {
    p.ring(8, 8, 7, 1.5, C.gold).sphere(8, 8, 5.6, 5.6, RAMP.bone);
    p.line(8, 8, 8, 4, C.black).line(8, 8, 11, 9, C.dred).px(8, 8, C.gold);
    p.px(8, 3, C.dgray).px(13, 8, C.dgray).px(8, 13, C.dgray).px(3, 8, C.dgray);
  },
  pi_lens: (p) => {
    p.line(10, 10, 14, 14, C.brown).line(11, 10, 14, 13, C.dbrown);
    p.sphere(6.5, 6.5, 4, 4, RAMP.blue).ring(6.5, 6.5, 5.5, 1.6, C.gold).px(5, 4, C.white).px(4, 5, C.cyan);
  },
  pi_dup: (p) => {
    // Duplikator: pocisk i jego kopia (półprzezroczysta poświata), strzałka podwojenia.
    p.sphere(10.5, 10, 4, 4, RAMP.blue).sphere(9.6, 9, 1.6, 1.6, [C.cyan, C.white, C.white]);
    p.sphere(5.5, 5.5, 3.6, 3.6, [C.navy, C.dblue, C.blue, C.cyan]).px(4.6, 4.6, C.white);
    p.stroke(6, 10.5, 6, 14, C.lime).stroke(4.5, 12.2, 7.5, 12.2, C.lime);
  },
  pi_magnet: (p) => {
    // Magnes podkowiasty: cieniowane czerwone ramiona, stalowe końcówki, linie pola i przyciągany kryształ.
    for (let a = 0; a <= Math.PI; a += 0.08) {
      p.spot(8 + Math.cos(a) * 5, 8 + Math.sin(a) * 5, a < 1.4 ? C.salmon : C.red).spot(8 + Math.cos(a) * 3.6, 8 + Math.sin(a) * 3.6, C.dred);
    }
    p.block(2.2, 4, 2.8, 4, RAMP.red).block(11, 4, 2.8, 4, RAMP.red);
    p.block(2.2, 1.5, 2.8, 2.6, RAMP.stone).block(11, 1.5, 2.8, 2.6, RAMP.stone);
    p.thin(6, 1, 6.5, 3.5, C.cyan).thin(10, 1, 9.5, 3.5, C.cyan);
    p.poly([[8, 1], [9.2, 2.6], [8, 4.2], [6.8, 2.6]], C.cyan).px(7.6, 2.2, C.white);
  },
  pi_crit: (p) => {
    p.poly([[1, 8], [5, 4], [11, 4], [15, 8], [11, 12], [5, 12]], C.cream);
    p.sphere(8, 8, 3.2, 3.2, RAMP.gold).rect(7, 7, 2, 2, C.black).px(7, 6, C.white);
    p.line(4, 3, 12, 2, C.dbrown);
  },
  pi_hourglass: (p) => {
    p.rect(3, 1, 10, 2, C.brown).rect(3, 13, 10, 2, C.brown).rect(3, 1, 10, 1, C.clay).rect(3, 13, 10, 1, C.clay);
    p.poly([[4, 3], [12, 3], [8, 8]], C.lgray).poly([[8, 8], [12, 13], [4, 13]], C.lgray);
    p.poly([[6, 4.5], [10, 4.5], [8, 7]], C.gold).poly([[8, 10], [11, 13], [5, 13]], C.gold).px(8, 8, C.yellow);
  },
  pi_fang: (p) => {
    p.polyShade([[8, 1], [12.5, 8], [8, 14.5], [3.5, 8]], RAMP.red);
    p.sphere(8, 9.5, 4.4, 4.4, RAMP.red).px(6, 7, C.white).px(6, 8, C.salmon);
  },
  pi_herb: (p) => {
    p.polyShade([[2, 14], [3, 7], [8, 2], [14, 1.5], [13, 7], [8, 12]], RAMP.green);
    p.line(3, 13, 12, 3, C.dgreen).line(6, 9, 5, 6, C.dgreen).line(8, 7, 10, 9, C.dgreen);
    p.px(12, 12, C.white).px(13, 13, C.lime);
  },
  pi_fury: (p) => {
    // Furia: zaciśnięta pięść w czerwonej aurze, płomienie gniewu.
    p.sphere(8, 9, 7, 6.5, [C.ddbrown, C.dred, C.dred, C.red]);
    for (const [x, y] of [[3, 3], [8, 1], [13, 3]] as const) p.polyShade([[x, y], [x + 1.6, y + 4], [x - 1.6, y + 4]], RAMP.fire);
    p.polyShade([[4.5, 6], [11.5, 6], [12, 10], [11, 13.5], [5, 13.5], [4, 10]], RAMP.skin);
    for (const x of [6.3, 8.2, 10.1]) p.thin(x, 6.3, x, 9, C.dbrown);
    p.thin(4.5, 9.5, 11.5, 9.5, C.dbrown).thin(5, 6.5, 11, 6.5, C.peach);
  },
  pi_ember: (p) => {
    // Żar: rozgrzany węgielek w kształcie kropli z płomykami i iskrami.
    for (const [x, y, h] of [[5, 6, 4], [8, 3, 5.5], [11, 6, 4]] as const) p.polyShade([[x - 1.8, y + h], [x, y], [x + 1.8, y + h]], RAMP.fire);
    p.sphere(8, 10.5, 5, 4.2, [C.ddbrown, C.dred, C.rust, C.orange]);
    p.thin(5.5, 9.5, 8, 12, C.gold).thin(8, 12, 10.5, 9.8, C.gold).thin(7, 8.5, 9, 10, C.yellow);
    p.dot(5.4, 8.4, C.peach).spot(2.5, 3, C.gold).spot(13.2, 2.4, C.yellow);
  },
  pi_whetstone: (p) => {
    // Osełka: szary kamień ukośnie, po nim ostrze z jasną krawędzią i iskrą szlifu.
    p.polyShade([[1.5, 11], [10, 4.5], [13, 7.5], [4.5, 14]], RAMP.stone);
    p.thin(2.5, 11, 10, 5.3, C.white).thin(4.8, 13.2, 12.4, 7.6, C.slate);
    p.polyShade([[6, 8.5], [14.5, 0.8], [15.2, 1.5], [7.2, 9.6]], [C.slate, C.lavender, C.lgray, C.white]);
    p.thin(6.6, 8.6, 14.6, 1.2, C.white);
    p.spot(5, 6.5, C.yellow).dot(4, 5.6, C.gold).dot(6.2, 5.2, C.gold);
  },
  pi_horseshoe: (p) => {
    // Podkowa otwarta ku górze (żelazo z jasną krawędzią), otwory na gwoździe i złota iskra szczęścia.
    const pt = (a: number, r: number): [number, number] => [8 + Math.cos(a) * r, 7.5 + Math.sin(a) * r * 1.05];
    for (let a = -0.2 * Math.PI; a < 1.2 * Math.PI; a += 0.12) {
      p.line(...pt(a, 5.6), ...pt(a + 0.12, 5.6), C.slate);
      p.line(...pt(a, 4.6), ...pt(a + 0.12, 4.6), a > 0.6 * Math.PI ? C.lgray : C.lavender);
    }
    for (const a of [0.1, 0.35, 0.65, 0.9]) p.dot(...pt(a * Math.PI, 5.1), C.black);
    p.px(2.5, 3, C.lgray).px(12.5, 3, C.lavender);
    p.px(8, 1, C.yellow).dot(8.3, 0.4, C.white).dot(7.4, 1.4, C.gold).dot(9.2, 1.4, C.gold);
  },
  pi_clover: (p) => {
    for (const [x, y] of [[5.5, 5], [10.5, 5], [5.5, 10], [10.5, 10]]) p.sphere(x, y, 3, 3, RAMP.green);
    p.px(8, 8, C.lime).line(9, 9, 13, 15, C.dgreen).px(4, 4, C.white);
  },

  // ===================== umiejętności =====================
  // Salwa: trzy równoległe strzały lecące w prawo w górę (symetryczne względem przekątnej).
  ab_k_volley: (p) => { arrowHi(p, 1.5, 10.5, 10, 2); arrowHi(p, 2.5, 13.5, 13.5, 2.5); arrowHi(p, 5.5, 14.5, 14, 6); },
  ab_k_net: (p) => {
    // Złapany szlam pod siecią (od razu widać, do czego służy), na nim jasna linka.
    p.sphere(8, 9, 4.6, 3.8, RAMP.green).px(6.5, 8, C.black).px(9.5, 8, C.black).px(6, 7, C.white);
    netIcon(p, [C.slate, C.lgray, C.white, C.lavender], C.dgray);
  },
  ab_k_roll: (p) => {
    for (let a = Math.PI * 0.6; a < Math.PI * 2.1; a += 0.08) p.px(8 + Math.cos(a) * 5.5, 8 + Math.sin(a) * 5.5, C.blue);
    for (let a = Math.PI * 0.8; a < Math.PI * 2; a += 0.1) p.px(8 + Math.cos(a) * 3.5, 8 + Math.sin(a) * 3.5, C.cyan);
    p.poly([[11, 9], [15, 9], [13, 13]], C.cyan).px(13, 10, C.white);
  },
  ab_k_rain: (p) => {
    p.sphere(5, 3.5, 3.5, 2.5, RAMP.stone).sphere(10, 3, 4.5, 2.8, RAMP.stone);
    arrow(p, 4, 7, 4, 13, C.lgray, C.gold); arrow(p, 8, 8, 8, 14, C.lgray, C.gold); arrow(p, 12, 7, 12, 13, C.lgray, C.gold);
  },
  ab_b_charge: (p) => {
    // Szarża: rogaty hełm pochylony do przodu, smugi pędu i pył spod nóg.
    p.stroke(0.5, 5, 5, 5, C.orange).stroke(0, 8.5, 5, 8.5, C.gold).stroke(0.5, 12, 5, 12, C.orange);
    p.sphere(10, 9, 4.6, 4.4, RAMP.stone).rect(6.5, 9, 7.5, 1.3, C.black).rect(9.5, 9, 1.3, 3.5, C.black);
    p.polyShade([[6.5, 6], [3.5, 1.5], [5.5, 2], [8, 5.5]], RAMP.bone).polyShade([[13, 6], [15.5, 1.5], [13.5, 2], [11, 5.5]], RAMP.bone);
    p.thin(7, 6, 11, 5, C.white).spot(5, 14, C.tan).spot(3, 13.5, C.clay);
  },
  ab_b_slam: (p) => {
    // Uderzenie: wielki młot wbity w ziemię, pęknięcia rozchodzące się od miejsca trafienia, fala i odłamki.
    for (let a = Math.PI; a < TAU; a += 0.06) p.spot(8 + Math.cos(a) * 7.3, 13 + Math.sin(a) * 2.8, C.gold);
    p.block(0.5, 13, 15, 2.5, RAMP.wood);
    p.thin(8, 13.2, 3.5, 15.5, C.black).thin(8, 13.2, 12.5, 15.5, C.black).thin(8, 13.2, 7.5, 15.5, C.black);
    p.line(13.5, 1, 9, 6, C.dbrown).thin(13, 0.8, 8.6, 5.4, C.clay);
    p.polyShade([[3, 6.5], [9.5, 3.5], [12.5, 9], [6, 12.5]], RAMP.stone);
    p.thin(3.5, 7, 9.5, 4, C.white).rect(6.6, 6.2, 2.2, 2.2, C.gold);
    p.spot(1.5, 9, C.lgray).spot(14, 9.5, C.lgray).spot(2.5, 11.5, C.clay).spot(13.5, 11.8, C.clay);
  },
  ab_b_leap: (p) => {
    p.polyShade([[5, 3], [10, 3], [10, 9], [14, 11], [14, 14], [4, 14], [4, 9]], RAMP.wood);
    p.rect(4, 12, 10, 1, C.ddbrown).line(1, 5, 3, 5, C.lgray).line(0, 8, 3, 8, C.white).line(1, 11, 3, 11, C.lgray);
  },
  ab_i_fireball: (p) => {
    p.line(1, 15, 6, 10, C.orange).line(2, 15, 7, 10, C.gold).line(1, 13, 5, 9, C.rust);
    p.sphere(10, 6, 5, 5, RAMP.fire).sphere(10.5, 5.5, 2.5, 2.5, [C.gold, C.yellow, C.white]);
  },
  ab_i_ring: (p) => {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      flame(p, 8 + Math.cos(a) * 5.5, 8.5 + Math.sin(a) * 5.5, 0.28);
    }
    p.sphere(8, 8, 1.8, 1.8, RAMP.bone);
  },
  ab_i_blink: (p) => {
    // Mignięcie: gasnący kontur w miejscu startu, smuga iskier i rozbłysk w miejscu przybycia.
    p.sphere(4, 10, 2.6, 3.4, [C.navy, C.dblue, C.dblue, C.blue]).px(4, 9, C.cyan);
    for (let k = 0; k < 5; k++) p.spot(6 + k * 1.4, 9 - k * 1.1, k % 2 ? C.cyan : C.white);
    for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; p.thin(12 + Math.cos(a) * 1.5, 4 + Math.sin(a) * 1.5, 12 + Math.cos(a) * (k % 2 ? 3 : 3.8), 4 + Math.sin(a) * (k % 2 ? 3 : 3.8), k % 2 ? C.cyan : C.white); }
    p.sphere(12, 4, 1.6, 1.6, [C.blue, C.cyan, C.white]);
  },
  ab_i_inferno: (p) => {
    p.rect(1, 13, 14, 2, C.dred).rect(1, 13, 14, 1, C.rust);
    for (const [x, y, s] of [[4, 4, 0.35], [11, 2, 0.3], [8, 9, 0.45]] as const) {
      p.line(x - 3, y - 4, x, y, C.orange);
      flame(p, x, y, s);
    }
  },
  ab_m_raise: (p) => {
    // Wskrzeszenie: dwie czaszki wynurzające się z rozkopanej ziemi, kościste ręce i zielona poświata.
    p.block(0.5, 11.5, 15, 4, RAMP.wood).thin(1, 12, 15, 12, C.clay);
    for (const [x, y] of [[5, 8], [11, 7]] as const) {
      p.sphere(x, y, 2.8, 2.6, RAMP.bone).rect(x - 1.8, y - 0.2, 1.3, 1.2, C.black).rect(x + 0.5, y - 0.2, 1.3, 1.2, C.black);
      p.px(x - 1.3, y + 0.2, C.lime).px(x + 1, y + 0.2, C.lime).rect(x - 1.2, y + 2, 2.4, 1.4, C.lgray);
    }
    p.stroke(1.5, 11.5, 1, 8, C.lgray).stroke(14.5, 11.5, 15, 8.5, C.lgray).spot(1, 7.5, C.white).spot(15, 8, C.white);
    p.px(3, 2, C.lime).px(13.5, 2.5, C.lime).px(8, 1, C.green);
  },
  ab_m_curse: (p) => {
    p.sphere(8, 11, 7, 3.5, [C.black, C.teal, C.dgreen, C.green]);
    p.px(5, 10, C.lime).px(10, 11, C.lime).px(8, 12, C.pink);
    p.sphere(8, 5, 2.5, 2.5, RAMP.bone).px(7, 5, C.black).px(9, 5, C.black);
    p.line(4, 2, 5, 4, C.lime).line(12, 2, 11, 4, C.lime);
  },
  ab_m_shade: (p) => {
    // Cień: upiorna postać w kapturze z rozwianym dołem, zielone oczy i smugi ruchu.
    p.polyShade([[10, 1.5], [14, 6], [14.5, 11], [12, 15], [10.5, 12.5], [8.5, 15], [6.5, 11], [6.5, 6]], [C.black, C.plum, C.plum, C.pink]);
    p.sphere(10.3, 6.5, 2.4, 2.6, [C.black, C.black, C.navy]).spot(9.3, 6.5, C.lime).spot(11, 6.5, C.lime);
    p.stroke(0.5, 5, 5.5, 5, C.plum).stroke(1.5, 8.5, 6, 8.5, C.pink).stroke(0.5, 12, 5.5, 12, C.plum);
  },
  ab_m_legion: (p) => {
    for (const [x, y] of [[4, 9], [8, 7], [12, 9]] as const) {
      p.sphere(x, y, 2.6, 2.6, [C.slate, C.lavender, C.lgray, C.white]).px(x - 1, y, C.lime).px(x + 1, y, C.lime);
      p.line(x, y + 3, x, y + 6, C.lavender);
    }
    p.poly([[5, 3], [8, 1], [11, 3], [8, 4]], C.gold);
  },
  ab_b_titan: (p) => {
    p.ring(8, 8.5, 7.5, 1, C.red);
    p.sphere(8, 9, 5, 5, RAMP.red).rect(5, 9, 7, 1, C.black).px(10, 9, C.yellow);
    p.line(4, 6, 2, 1, C.cream).px(2, 1, C.white).line(12, 6, 14, 1, C.cream).px(14, 1, C.white);
  },

  // ===================== sklep =====================
  sh_potion: (p) => {
    p.rect(6, 1, 4, 2, C.brown).rect(6, 1, 4, 1, C.clay).rect(7, 3, 2, 3, C.lgray);
    p.sphere(8, 10, 5.5, 5, RAMP.red).rect(4, 8, 8, 1, C.salmon);
    p.px(5, 7, C.white).px(6, 7, C.white).px(5, 11, C.salmon);
  },
  sh_card: (p) => {
    p.rect(5, 1, 9, 13, C.dgray).rect(2, 3, 9, 12, C.black).rect(3, 4, 7, 10, C.gold);
    p.rect(4, 5, 5, 8, C.navy).rect(3, 4, 7, 1, C.yellow);
    p.poly([[6.5, 6], [8.5, 9], [6.5, 12], [4.5, 9]], C.cyan).px(6, 8, C.white);
  },
  sh_dice: (p) => {
    p.block(2, 3, 11, 11, RAMP.bone);
    for (const [x, y] of [[4, 5], [10, 5], [7, 8], [4, 11], [10, 11]]) p.rect(x, y, 2, 2, C.dred);
  },
  sh_scroll: (p) => {
    p.block(3, 3, 10, 10, RAMP.bone).rect(2, 2, 12, 2, C.tan).rect(2, 12, 12, 2, C.tan).rect(2, 2, 12, 1, C.cream);
    p.line(5, 6, 11, 6, C.dbrown).line(5, 8, 10, 8, C.dbrown).line(5, 10, 9, 10, C.dbrown).px(11, 10, C.dred);
  },

  sh_upgrade: (p) => {
    p.line(3, 14, 9, 8, C.brown).line(4, 14, 10, 8, C.dbrown);
    p.block(7, 3, 7, 5, RAMP.stone).rect(7, 3, 7, 1, C.white);
    p.poly([[3, 1], [4, 3], [6, 3.5], [4, 4.5], [3, 7], [2, 4.5], [0, 3.5], [2, 3]], C.yellow);
  },
  sh_shard: (p) => {
    p.polyShade([[8, 1], [13, 6], [9, 15], [3, 8]], [C.dblue, C.blue, C.cyan, C.white]);
    p.line(8, 2, 6, 9, C.white).line(9, 6, 9, 13, C.dblue);
  },

  syn_all: (p) => {
    // Osiem równych promieni-klinów w kolorach synergii wokół środka 8,8 (długie na osiach, krótsze na skosach).
    const cols = [C.red, C.orange, C.yellow, C.lime, C.cyan, C.blue, C.pink, C.hotpink];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU - Math.PI / 2, R = i % 2 ? 6 : 7.3, c = Math.cos(a), s = Math.sin(a);
      p.poly([[8 + c * 2.4 - s * 1.5, 8 + s * 2.4 + c * 1.5], [8 + c * R, 8 + s * R], [8 + c * 2.4 + s * 1.5, 8 + s * 2.4 - c * 1.5]], cols[i]);
    }
    p.sphere(8, 8, 2.7, 2.7, RAMP.bone).dot(7, 6.8, C.white).dot(7.34, 6.8, C.white);
  },

  // ===================== węzły mapy Ekspedycji =====================
  ex_fight: (p) => {
    // Skrzyżowane miecze: ostrza, jelce, rękojeści.
    p.line(2, 2, 11, 11, C.lgray).line(3, 2, 12, 11, C.white);
    p.line(14, 2, 5, 11, C.lgray).line(13, 2, 4, 11, C.white);
    p.line(9, 12, 13, 8, C.gold).line(3, 8, 7, 12, C.gold);
    p.line(12, 12, 14, 14, C.brown).line(4, 12, 2, 14, C.brown);
  },
  ex_elite: (p) => {
    p.poly([[2, 1], [5, 5], [3, 6]], C.cream).poly([[14, 1], [11, 5], [13, 6]], C.cream);
    skull(p, 8, 8);
    p.px(5, 7, C.red).px(10, 7, C.red);
  },
  ex_boss: (p) => {
    p.poly([[2, 5], [5, 9], [8, 3], [11, 9], [14, 5], [13, 13], [3, 13]], C.gold);
    p.rect(3, 11, 11, 2, C.orange).rect(3, 13, 11, 1, C.dbrown);
    p.px(8, 8, C.red).px(5, 11, C.cyan).px(11, 11, C.cyan).px(8, 4, C.yellow).px(4, 9, C.yellow);
  },
  ex_chest: (p) => {
    // Skrzynia symetryczna względem x = 8: wieko-kopuła, korpus, dwie złote okucia, zamek z dziurką na środku.
    p.block(2, 7.5, 12, 6.5, RAMP.wood).sphere(8, 7.5, 6, 3.6, RAMP.wood);
    p.thin(2.4, 10.4, 13.6, 10.4, C.dbrown).thin(2.4, 12.4, 13.6, 12.4, C.dbrown);
    p.rect(2, 7.67, 12, 1, C.gold).rect(2, 7.67, 12, 0.34, C.yellow);
    p.rect(3.67, 4.6, 1.33, 9.4, C.gold).rect(11, 4.6, 1.33, 9.4, C.gold).rect(3.67, 4.6, 0.34, 9.4, C.yellow).rect(11, 4.6, 0.34, 9.4, C.yellow);
    p.rect(6.67, 7, 2.66, 3.67, C.gold).rect(6.67, 7, 2.66, 0.67, C.yellow).rect(6.67, 7, 0.34, 3.67, C.yellow);
    p.rect(7.67, 8.33, 0.66, 0.67, C.ddbrown).rect(7.67, 9, 0.66, 0.67, C.ddbrown);
  },
  ex_shop: (p) => {
    p.sphere(8, 10, 5.5, 4.5, RAMP.wood).rect(6, 3, 4, 2, C.brown).line(5, 5, 11, 5, C.gold);
    p.disc(8, 10, 2.5, C.gold).px(8, 10, C.yellow).px(7, 9, C.white);
  },
  ex_anvil: (p) => {
    p.block(3, 4, 11, 4, RAMP.stone).poly([[1, 4], [3, 4], [3, 6]], C.dgray);
    p.rect(6, 8, 5, 3, C.dgray).block(4, 11, 9, 3, RAMP.night);
    p.rect(3, 4, 11, 1, C.white);
    sparkle(p, 12, 2);
  },
  ex_rest: (p) => {
    p.line(3, 14, 13, 11, C.brown).line(3, 11, 13, 14, C.dbrown);
    flame(p, 8, 8, 0.8);
  },
  ex_dungeon: (p) => {
    // Kamienny łuk wejścia z ciemnym wnętrzem i fioletową poświatą.
    p.block(2, 4, 12, 11, RAMP.stone).sphere(8, 5, 6, 3.5, RAMP.stone);
    p.rect(5, 6, 6, 9, C.black).sphere(8, 6.5, 3, 2.5, [C.black, C.black, C.black, C.black]);
    p.px(7, 10, C.pink).px(8, 11, C.plum).px(9, 9, C.pink).rect(2, 14, 12, 1, C.dgray);
  },
  ex_secret: (p) => {
    // Rozdarcie: fioletowa szczelina z białym pytajnikiem.
    p.sphere(8, 8, 6.5, 6.5, [C.black, C.plum, C.hotpink, C.pink]);
    p.rect(6, 3, 4, 2, C.white).rect(9, 5, 2, 3, C.white).rect(7, 8, 2, 2, C.white).rect(7, 12, 2, 2, C.white);
  },
  ex_ambush: (p) => {
    // Zasadzka: pierścień czerwonych oczu w ciemności zamyka się wokół jasnej postaci w środku.
    p.sphere(8, 8, 7, 7, [C.black, C.black, C.navy, C.dgreen]);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU, x = 8 + Math.cos(a) * 5.4, y = 8 + Math.sin(a) * 5.4; p.px(x - 0.6, y, C.red).px(x + 0.6, y, C.salmon); }
    p.disc(8, 8, 1.6, C.lime).px(8, 7, C.white);
  },
  ex_hunt: (p) => {
    // Polowanie: czaszka w czerwonym celowniku.
    skull(p, 8, 8);
    p.ring(8, 8, 6.4, 0.8, C.red).thin(8, 0.5, 8, 3, C.red).thin(8, 13, 8, 15.5, C.red).thin(0.5, 8, 3, 8, C.red).thin(13, 8, 15.5, 8, C.red);
  },
  ex_vault: (p) => {
    // Skarbiec: okrągłe drzwi sejfu w kamiennej ścianie, złote koło ze szprychami.
    p.block(1, 2, 14, 13, RAMP.stone);
    p.sphere(8, 8.5, 5.6, 5.6, RAMP.night).ring(8, 8.5, 5.2, 0.9, C.gold);
    for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + 0.4; p.thin(8, 8.5, 8 + Math.cos(a) * 3.6, 8.5 + Math.sin(a) * 3.6, C.yellow); }
    p.disc(8, 8.5, 1.2, C.gold).px(8, 8, C.white);
  },
  ex_shrine: (p) => {
    p.block(5, 7, 6, 8, RAMP.stone).rect(3, 13, 10, 2, C.dgray).rect(4, 6, 8, 1, C.lgray);
    p.sphere(8, 4, 2.5, 2.5, [C.orange, C.gold, C.yellow, C.white]);
    sparkle(p, 13, 3);
  },

  // ===================== kuźnia: materiały i zwoje (data/forge.ts) =====================
  mt_stone: (p) => {
    p.polyShade([[2, 13], [3, 6], [8, 3], [13, 5], [14, 12], [9, 14.5]], RAMP.stone);
    p.line(5, 8, 8, 6, C.white).line(9, 10, 12, 12, C.slate).px(6, 11, C.lgray);
  },
  mt_ore: (p) => {
    p.polyShade([[1, 13], [3, 7], [8, 4], [14, 6], [15, 13], [8, 15]], RAMP.night);
    for (const [x, y] of [[5, 9], [9, 7], [11, 11], [7, 12]]) p.rect(x, y, 2, 2, C.blue).px(x, y, C.cyan);
    sparkle(p, 13, 3);
  },
  mt_heart: (p) => {
    p.sphere(5.5, 6.5, 3.5, 3.5, RAMP.red).sphere(10.5, 6.5, 3.5, 3.5, RAMP.red);
    p.poly([[2, 8], [14, 8], [8, 15]], C.red).line(4, 9, 8, 13, C.dred).px(4, 5, C.white).px(5, 4, C.salmon);
    p.line(8, 5, 8, 11, C.orange).px(8, 7, C.yellow);
  },
  mt_tear: (p) => {
    p.poly([[8, 1], [12, 8], [4, 8]], C.cyan).sphere(8, 10, 4.5, 4.5, RAMP.blue);
    p.px(6, 8, C.white).px(6, 9, C.white).px(7, 4, C.white);
  },
  mt_void: (p) => {
    p.sphere(8, 8, 6, 6, RAMP.purple).sphere(8, 8, 3, 3, [C.black, C.navy, C.plum, C.pink]);
    for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + 0.4; p.px(8 + Math.cos(a) * 7, 8 + Math.sin(a) * 7, C.white); }
  },
  sc_bless: (p) => {
    p.block(3, 3, 10, 11, RAMP.bone).rect(2, 2, 12, 2, C.tan).rect(2, 13, 12, 2, C.tan);
    p.poly([[8, 5], [11, 8], [8, 11], [5, 8]], C.yellow).px(8, 8, C.white);
  },
  sc_dragon: (p) => {
    p.block(3, 3, 10, 11, RAMP.bone).rect(2, 2, 12, 2, C.tan).rect(2, 13, 12, 2, C.tan);
    flame(p, 8, 9, 0.6);
  },
  sc_talisman: (p) => {
    // Zwój ochronny: talizman na sznurku, złota oprawa, zielony kamień z wyrytym znakiem.
    p.thin(8, 0.5, 5, 4, C.tan).thin(8, 0.5, 11, 4, C.tan);
    p.ring(8, 9, 5.6, 1, C.gold).sphere(8, 9, 4.6, 4.6, RAMP.green);
    p.poly([[8, 6], [10.4, 9], [8, 12], [5.6, 9]], C.dgreen).thin(8, 6.6, 8, 11.4, C.lime).thin(6.3, 9, 9.7, 9, C.lime);
    p.px(6, 6.5, C.white).spot(8, 3.6, C.gold);
  },

  // ===================== moce bossów (data/enemies.ts BOSS_POWERS): oko otchłani + wzór salwy =====================
  bp_shotgun: (p) => {
    p.sphere(4, 8, 3.5, 3.5, RAMP.purple).px(3, 7, C.white);
    for (const [x, y] of [[10, 3], [13, 5], [14, 8], [13, 11], [10, 13], [11, 8]]) p.disc(x, y, 1.2, C.salmon).px(x, y, C.white);
  },
  bp_ring: (p) => {
    for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; if (i === 2 || i === 3) continue; p.disc(8 + Math.cos(a) * 6, 8 + Math.sin(a) * 6, 1.2, C.pink); }
    p.sphere(8, 8, 3, 3, RAMP.purple).px(7, 7, C.white);
  },
  bp_flower: (p) => {
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; p.line(8, 8, 8 + Math.cos(a) * 4 + Math.cos(a + 1.4) * 3, 8 + Math.sin(a) * 4 + Math.sin(a + 1.4) * 3, C.orange); }
    p.sphere(8, 8, 3, 3, RAMP.fire).px(7, 7, C.yellow);
  },
  bp_stream: (p) => {
    p.sphere(3.5, 8, 3, 3, RAMP.purple).px(3, 7, C.white);
    for (const y of [4, 8, 12]) p.line(8, y, 14, 8 + (y - 8) * 0.4, C.lgray).px(14, Math.round(8 + (y - 8) * 0.4), C.white);
  },
  bp_mines: (p) => {
    for (const [x, y] of [[4, 4], [12, 4], [4, 12], [12, 12]]) p.sphere(x, y, 2.5, 2.5, RAMP.night).px(x, y, C.red);
    p.sphere(8, 8, 2.5, 2.5, RAMP.purple).px(7, 7, C.white);
  },
  bp_crown: (p) => {
    p.poly([[2, 6], [5, 10], [8, 3], [11, 10], [14, 6], [13, 14], [3, 14]], C.gold);
    p.rect(3, 12, 10, 2, C.orange).px(8, 7, C.red).px(5, 11, C.cyan).px(11, 11, C.cyan);
    for (let i = 0; i < 6; i++) p.px(8 + Math.cos(i) * 7.5, 9 + Math.sin(i) * 6.5, C.pink);
  },
  bp_toxic: (p) => {
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; p.disc(8 + Math.cos(a) * 6, 8 + Math.sin(a) * 6, 1.3, C.lime); }
    p.sphere(8, 8, 3, 3, RAMP.green).px(7, 7, C.white);
  },
  bp_meteor: (p) => {
    for (const [x, y] of [[4, 12], [11, 13], [8, 7]]) { p.line(x - 3, y - 6, x, y, C.orange); p.sphere(x, y, 2, 2, RAMP.fire); }
    p.px(13, 2, C.yellow);
  },
  bp_gaze: (p) => {
    p.sphere(4, 8, 3.5, 3.5, [C.navy, C.dblue, C.blue, C.cyan]).rect(3, 7, 2, 2, C.black).px(3, 7, C.white);
    p.line(7, 8, 15, 6, C.yellow).line(7, 9, 15, 10, C.yellow).line(7, 8, 15, 8, C.white);
  },
  bp_brood: (p) => {
    p.sphere(8, 6, 4.5, 4, RAMP.purple).rect(6, 5, 1, 2, C.white).rect(10, 5, 1, 2, C.white);
    p.poly([[4, 8], [12, 8], [13, 15], [10.5, 12.5], [8, 15], [5.5, 12.5], [3, 15]], C.pink);
  },

  // ===================== tagi kart =====================
  'tag:Ogień': (p) => flame(p, 8, 8, 1),
  'tag:Krytyk': (p) => {
    p.poly([[8, 0.5], [9.5, 6.5], [15.5, 8], [9.5, 9.5], [8, 15.5], [6.5, 9.5], [0.5, 8], [6.5, 6.5]], C.orange);
    p.poly([[8, 3], [9, 7], [13, 8], [9, 9], [8, 13], [7, 9], [3, 8], [7, 7]], C.yellow).px(8, 8, C.white);
  },
  'tag:Przywołania': (p) => {
    p.line(4, 14, 6, 10, C.dgray).line(12, 14, 10, 10, C.dgray);
    p.block(4, 8, 8, 4, RAMP.stone).sphere(8, 6, 4.5, 4, RAMP.stone).rect(10, 5, 5, 2, C.slate).px(7, 5, C.cyan).px(14, 5, C.yellow);
  },
  'tag:Tarcze': (p) => shield(p, RAMP.blue, C.cyan),
  'tag:Szybkość': (p) => wing(p, [C.dblue, C.blue, C.cyan, C.white]),
  'tag:Pociski': (p) => { p.sphere(6, 6, 3.5, 3.5, RAMP.blue).sphere(11, 11, 3.5, 3.5, RAMP.blue).px(5, 5, C.white).px(10, 10, C.white).px(13, 3, C.cyan).px(3, 13, C.cyan); },
  'tag:Obszar': (p) => { p.ring(8, 8, 7.5, 1.5, C.lime).ring(8, 8, 4.5, 1, C.green).sphere(8, 8, 2, 2, RAMP.green); },
  'tag:Życie': (p) => { heart(p, 8, 7, 1, [C.dred, C.hotpink, C.salmon, C.peach]); p.rect(7, 5, 3, 1, C.white).rect(8, 4, 1, 3, C.white); },
  'tag:Umiejętności': (p) => {
    p.polyShade([[8, 1], [14, 8], [8, 15], [2, 8]], RAMP.purple);
    // Krzyż na środku: `line` zajmuje x..x+1, więc współrzędne o pół jednostki mniej niż środek 8.
    p.line(7.5, 4, 7.5, 11, C.salmon).line(4.5, 7.5, 10.5, 7.5, C.salmon).spot(7.67, 7.67, C.white);
  },
  'tag:Klątwa': (p) => { p.ring(8, 8, 7.5, 1, C.plum); skull(p, 8, 8); p.px(5, 7, C.hotpink).px(10, 7, C.hotpink); },
};

/** Znaczek ewolucji pasywki: złota czteroramienna gwiazda w prawym górnym rogu na ciemnym tle. */
function evoStar(p: Painter): void {
  p.disc(13, 3, 2.9, C.black);
  p.poly([[13, -0.2], [13.8, 2.2], [16.2, 3], [13.8, 3.8], [13, 6.2], [12.2, 3.8], [9.8, 3], [12.2, 2.2]], C.gold);
  p.poly([[13, 1.2], [13.5, 2.5], [14.8, 3], [13.5, 3.5], [13, 4.8], [12.5, 3.5], [11.2, 3], [12.5, 2.5]], C.yellow).spot(12.67, 2.67, C.white);
}

// Warianty ewolucji broni (data/weapons.ts ALT_EVOS): ikona ewolucji podstawowej przemalowana rampą wariantu.
for (const a of ALT_EVOS) {
  const src = WEAPON_BY_ID[evolvesOf(WEAPON_BY_ID[a.base])[0].into].icon;
  ICON_FNS[`ic_${a.id}`] = (p) => { ICON_FNS[src](p); p.recolor(a.ramp); };
}
// Ewolucje pasywek: ikona pasywki ze złotą gwiazdą.
for (const d of PASSIVES) ICON_FNS[`${d.icon}_evo`] = (p) => { ICON_FNS[d.icon](p); evoStar(p); };
