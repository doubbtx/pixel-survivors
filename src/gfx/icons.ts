import { C, RAMP } from '../core/palette';
import { Painter } from './painter';
import { ITEM_ICONS } from './items';
import { CARD_ICONS_GFX } from './card-icons';
import { HERO_ICONS } from './hero-icons';

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

function wing(p: Painter, ramp: readonly number[]): void {
  p.polyShade([[1.5, 11], [7, 3], [14.5, 1.5], [12, 5], [14, 6.5], [10, 9], [12, 10.5], [6, 13]], ramp);
  p.line(4, 10, 10, 5, ramp[1]).line(6, 11, 11, 8, ramp[1]).line(7, 4, 13, 2, C.white);
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

function boltShape(p: Painter, ox: number, oy: number, col: number = C.yellow): void {
  p.poly([[ox + 8, oy + 1], [ox + 3, oy + 8], [ox + 7, oy + 8], [ox + 5, oy + 15], [ox + 12, oy + 6], [ox + 8, oy + 6], [ox + 10, oy + 1]], col);
  p.line(ox + 8, oy + 2, ox + 5, oy + 7, C.white);
}

export const ICON_FNS: Record<string, IconFn> = {
  ...ITEM_ICONS,
  ...CARD_ICONS_GFX,
  ...HERO_ICONS,
  // ===================== bronie =====================
  ic_bolt: (p) => { p.sphere(9.5, 6.5, 4, 4, RAMP.blue).px(8, 5, C.white).px(4, 11, C.blue).px(2, 13, C.cyan).px(6, 10, C.cyan); },
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
    p.line(3, 14, 10, 7, C.brown).line(4, 14, 11, 7, C.dbrown);
    p.ring(11.5, 5, 3, 1, C.gold);
    flame(p, 11.5, 5, 0.45);
  },
  ic_staff_evo: (p) => {
    p.line(2, 14, 9, 7, C.brown).line(3, 14, 10, 7, C.dbrown);
    p.poly([[6, 3], [10, 6], [5, 7]], C.orange).poly([[15, 1], [12, 7], [10, 3]], C.orange);
    p.sphere(11, 5, 3.5, 3.5, [C.orange, C.gold, C.yellow, C.white]).px(10, 4, C.white);
  },
  ic_souls: (p) => {
    for (const [x, y, s] of [[5, 10, 3], [11, 5, 2.6], [12, 12, 2]] as const) {
      p.sphere(x, y, s, s, [C.plum, C.pink, C.salmon, C.white]).px(x - 1, y - 1, C.white);
      p.px(x + s, y + 1, C.lime);
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
    p.sphere(8, 8, 2.5, 2.5, RAMP.blue);
    for (let k = 0; k < 3; k++) {
      const a = (k * TAU) / 3 - 0.5, x = 8 + Math.cos(a) * 5.5, y = 8 + Math.sin(a) * 5.5;
      p.poly([[x, y - 2.5], [x + 2, y], [x, y + 2.5], [x - 2, y]], C.lgray).px(Math.round(x) - 1, Math.round(y) - 1, C.white);
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
  ic_boomerang: (p) => { p.polyShade([[1.5, 4], [7.5, 1.5], [14.5, 5], [12.5, 8], [7.5, 5], [3.5, 8.5]], RAMP.wood); p.line(3, 4, 7, 2, C.gold); },
  ic_boomer_evo: (p) => {
    for (let k = 0; k < 3; k++) {
      const a = (k * TAU) / 3, c = Math.cos(a), s = Math.sin(a);
      const R = (x: number, y: number): [number, number] => [8 + x * c - y * s, 8 + x * s + y * c];
      p.poly([R(0, 0), R(6, -2), R(7, 0), R(1, 2)], k === 0 ? C.gold : C.clay);
    }
    p.sphere(8, 8, 1.8, 1.8, RAMP.stone);
  },
  ic_laser: (p) => { p.line(1, 3, 13, 13, C.pink).line(2, 2, 14, 12, C.pink).line(1, 2, 14, 13, C.white).sphere(2.5, 2.5, 2, 2, RAMP.purple); },
  ic_laser_evo: (p) => {
    p.polyShade([[8, 2], [13, 12], [3, 12]], [C.slate, C.lavender, C.lgray, C.white]);
    p.line(13, 9, 15, 7, C.red).line(13, 10, 15, 10, C.yellow).line(13, 11, 15, 13, C.cyan).line(0, 8, 5, 8, C.white);
  },
  ic_mines: (p) => {
    p.px(8, 1, C.lavender).px(8, 14, C.lavender).px(1, 8, C.lavender).px(14, 8, C.lavender).px(3, 3, C.lavender).px(13, 13, C.lavender);
    p.sphere(8, 8, 5, 5, RAMP.night).rect(7, 7, 2, 2, C.red).px(7, 7, C.salmon);
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
    p.sphere(5.5, 6, 3.6, 3.6, RAMP.purple).sphere(10.5, 10, 3.6, 3.6, RAMP.blue);
    p.px(4, 5, C.white).px(9, 9, C.white).line(8, 4, 12, 4, C.lgray).line(12, 4, 12, 6, C.lgray);
  },
  pi_magnet: (p) => {
    p.rect(2, 4, 4, 7, C.red).rect(10, 4, 4, 7, C.red).rect(2, 9, 12, 4, C.red).rect(3, 5, 1, 7, C.salmon).rect(4, 11, 8, 1, C.salmon);
    p.rect(2, 2, 4, 2, C.lgray).rect(10, 2, 4, 2, C.lgray).px(2, 2, C.white).px(10, 2, C.white);
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
    p.polyShade([[3, 14], [5, 6], [9, 2], [12, 4], [10, 9], [13, 12], [8, 15]], RAMP.fire);
    p.line(2, 4, 6, 1, C.yellow).line(1, 8, 4, 6, C.yellow).line(12, 1, 15, 3, C.yellow).px(8, 7, C.white);
  },
  pi_clover: (p) => {
    for (const [x, y] of [[5.5, 5], [10.5, 5], [5.5, 10], [10.5, 10]]) p.sphere(x, y, 3, 3, RAMP.green);
    p.px(8, 8, C.lime).line(9, 9, 13, 15, C.dgreen).px(4, 4, C.white);
  },

  // ===================== umiejętności =====================
  ab_k_volley: (p) => { arrow(p, 2, 14, 9, 2); arrow(p, 2, 14, 14, 7); arrow(p, 2, 14, 14, 13); },
  ab_k_net: (p) => {
    p.ring(8, 8, 7, 1, C.lgray);
    for (let k = -4; k <= 4; k += 4) { p.line(8 + k, 2, 8 + k, 14, C.lavender); p.line(2, 8 + k, 14, 8 + k, C.lavender); }
    p.px(4, 4, C.white).px(12, 12, C.white).px(8, 8, C.white);
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
    p.line(1, 5, 5, 5, C.orange).line(0, 8, 5, 8, C.gold).line(1, 11, 5, 11, C.orange);
    p.sphere(10, 8.5, 4.5, 4.5, RAMP.stone).rect(8, 9, 6, 1, C.black).line(7, 5, 6, 2, C.cream).line(13, 5, 14, 2, C.cream);
  },
  ab_b_slam: (p) => {
    for (let a = Math.PI; a < TAU; a += 0.06) p.px(8 + Math.cos(a) * 7, 12 + Math.sin(a) * 3.2, C.gold);
    p.rect(1, 12, 14, 3, C.dbrown).rect(1, 12, 14, 1, C.brown);
    p.line(8, 12, 5, 15, C.black).line(8, 12, 12, 15, C.black).line(8, 12, 8, 15, C.black);
    p.sphere(8, 6, 3.6, 3.4, RAMP.skin).rect(6, 2, 4, 2, C.dgray).px(6, 5, C.dbrown).px(9, 5, C.dbrown);
    p.px(2, 9, C.lgray).px(14, 8, C.lgray).px(3, 6, C.brown).px(13, 5, C.brown);
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
    p.ring(4.5, 9, 3, 1, C.dblue).ring(11.5, 7, 3.5, 1, C.cyan);
    p.px(11.5, 7, C.white).px(4.5, 9, C.blue);
    for (let x = 6; x <= 9; x += 2) p.px(x, 8, C.lavender);
    sparkle(p, 13, 2);
  },
  ab_i_inferno: (p) => {
    p.rect(1, 13, 14, 2, C.dred).rect(1, 13, 14, 1, C.rust);
    for (const [x, y, s] of [[4, 4, 0.35], [11, 2, 0.3], [8, 9, 0.45]] as const) {
      p.line(x - 3, y - 4, x, y, C.orange);
      flame(p, x, y, s);
    }
  },
  ab_m_raise: (p) => {
    p.rect(1, 13, 14, 2, C.dbrown).rect(1, 13, 14, 1, C.brown);
    for (const [x, s] of [[5, 1], [11, 0.8]] as const) {
      p.poly([[x - 3 * s, 8], [x + 3 * s, 8], [x + 1, 13], [x - 1, 13]], C.lavender);
      p.sphere(x, 6, 3 * s, 3 * s, [C.slate, C.lavender, C.lgray, C.white]).px(x - 1, 6, C.lime).px(x + 1, 6, C.lime);
    }
  },
  ab_m_curse: (p) => {
    p.sphere(8, 11, 7, 3.5, [C.black, C.teal, C.dgreen, C.green]);
    p.px(5, 10, C.lime).px(10, 11, C.lime).px(8, 12, C.pink);
    p.sphere(8, 5, 2.5, 2.5, RAMP.bone).px(7, 5, C.black).px(9, 5, C.black);
    p.line(4, 2, 5, 4, C.lime).line(12, 2, 11, 4, C.lime);
  },
  ab_m_shade: (p) => {
    p.sphere(10, 8, 4, 5, [C.black, C.plum, C.plum, C.pink]).px(9, 7, C.lime).px(11, 7, C.lime);
    for (let x = 1; x <= 6; x += 2) p.line(x, 6 + (x % 3), x + 2, 6 + (x % 3), C.plum).line(x, 10, x + 1, 10, C.dgray);
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
    const cols = [C.red, C.orange, C.yellow, C.lime, C.cyan, C.blue, C.pink, C.hotpink];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      p.line(8, 8, 8 + Math.cos(a) * 7, 8 + Math.sin(a) * 7, cols[i]);
    }
    p.sphere(8, 8, 3, 3, RAMP.bone).px(7, 7, C.white);
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
    p.block(2, 7, 12, 7, RAMP.wood).sphere(8, 7, 6, 3.5, RAMP.wood);
    p.rect(2, 8, 12, 1, C.gold).rect(7, 7, 2, 4, C.yellow).px(7, 10, C.dbrown);
    p.rect(3, 5, 1, 9, C.gold).rect(12, 5, 1, 9, C.gold);
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
    p.line(8, 1, 8, 4, C.brown).sphere(8, 9, 5, 5.5, RAMP.green);
    p.rect(6, 7, 4, 4, C.dgreen).px(7, 8, C.lime).px(8, 9, C.lime);
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
    p.line(8, 4, 8, 12, C.salmon).line(5, 8, 11, 8, C.salmon).px(8, 8, C.white);
  },
  'tag:Klątwa': (p) => { p.ring(8, 8, 7.5, 1, C.plum); skull(p, 8, 8); p.px(5, 7, C.hotpink).px(10, 7, C.hotpink); },
};
