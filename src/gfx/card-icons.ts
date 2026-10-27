import { C, RAMP } from '../core/palette';
import type { Painter } from './painter';

/**
 * Ikony 16×16 dla kart o unikalnych efektach (cd_<nazwa>) i ewolucji umiejętności (ab_<id>_evo).
 * Pozostałe karty używają pasujących ikon broni, pasywek i umiejętności (data/cards.ts CARD_ICONS).
 */
const TAU = Math.PI * 2;

export const CARD_ICONS_GFX: Record<string, (p: Painter) => void> = {
  // ---------------- karty ----------------
  cd_echo: (p) => {
    p.ring(8, 8, 7, 1, C.lavender).ring(8, 8, 4.5, 1, C.pink);
    p.sphere(8, 8, 2.2, 2.2, RAMP.purple).px(7, 7, C.white);
  },
  cd_bounce: (p) => {
    p.line(1, 14, 7, 3, C.lgray).line(7, 3, 14, 13, C.lgray).line(1, 15, 15, 15, C.slate);
    p.sphere(12.5, 10, 2.5, 2.5, RAMP.blue).px(12, 9, C.white).px(7, 2, C.yellow);
  },
  cd_explode: (p) => {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      p.line(8, 8, 8 + Math.cos(a) * 7, 8 + Math.sin(a) * 7, i % 2 ? C.orange : C.gold);
    }
    p.sphere(8, 8, 3.5, 3.5, RAMP.fire).px(7, 7, C.white);
  },
  cd_nova: (p) => {
    p.ring(8, 8, 7.5, 1, C.yellow).ring(8, 8, 5, 1, C.gold);
    p.sphere(8, 8, 3, 3, [C.gold, C.yellow, C.white, C.white]);
    p.px(8, 0, C.white).px(8, 15, C.white).px(0, 8, C.white).px(15, 8, C.white);
  },
  cd_phoenix: (p) => {
    p.polyShade([[8, 3], [15, 1], [12, 7], [14, 9], [9, 10], [8, 15], [7, 10], [2, 9], [4, 7], [1, 1]], RAMP.fire);
    p.sphere(8, 6, 2, 2, [C.gold, C.yellow, C.white, C.white]).px(8, 4, C.dred);
  },
  cd_shrapnel: (p) => {
    p.sphere(8, 8, 2.5, 2.5, RAMP.stone);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + 0.3;
      p.line(8 + Math.cos(a) * 4, 8 + Math.sin(a) * 4, 8 + Math.cos(a) * 7, 8 + Math.sin(a) * 7, C.lgray);
    }
  },
  cd_frost: (p) => {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI;
      p.line(8 - Math.cos(a) * 7, 8 - Math.sin(a) * 7, 8 + Math.cos(a) * 7, 8 + Math.sin(a) * 7, C.cyan);
    }
    p.sphere(8, 8, 2.5, 2.5, [C.dblue, C.blue, C.cyan, C.white]).px(4, 3, C.white).px(12, 13, C.white);
  },
  cd_blood: (p) => {
    p.polyShade([[8, 1], [12.5, 8], [8, 14.5], [3.5, 8]], RAMP.red);
    p.sphere(8, 9.5, 4.4, 4.4, RAMP.red).px(6, 8, C.white);
    p.line(2, 14, 14, 2, C.black).line(3, 14, 14, 3, C.plum);
  },
  cd_tempest: (p) => {
    p.ring(8, 8, 7, 1.5, C.blue).ring(8, 8, 4, 1, C.cyan);
    p.poly([[9, 2], [5, 9], [8, 9], [6, 14], [11, 7], [8, 7], [10, 2]], C.yellow).px(8, 4, C.white);
  },
  cd_glass: (p) => {
    p.block(2, 7, 9, 5, RAMP.stone).rect(10, 8, 5, 3, C.dgray).sphere(4, 13, 2, 2, RAMP.wood);
    p.line(5, 4, 8, 7, C.cyan).line(9, 3, 9, 6, C.cyan).px(12, 5, C.white).px(4, 9, C.white);
  },
  cd_fever: (p) => {
    p.rect(7, 1, 3, 10, C.lgray).rect(8, 4, 1, 8, C.red);
    p.sphere(8.5, 12.5, 3, 3, RAMP.red).px(7, 11, C.white);
    p.px(12, 3, C.orange).px(13, 6, C.orange).px(3, 5, C.orange);
  },
  cd_gold: (p) => {
    p.sphere(6, 10, 4, 3, RAMP.gold).sphere(11, 9, 4, 3, RAMP.gold).sphere(8.5, 6, 4, 3, RAMP.gold);
    p.px(7, 5, C.white).px(5, 9, C.white);
    p.rect(11, 1, 3, 3, C.plum).px(12, 2, C.hotpink);
  },

  // ---------------- ewolucje umiejętności ----------------
  ab_k_volley_evo: (p) => {
    for (const [x, y] of [[13, 2], [15, 7], [15, 12], [10, 1]]) p.line(1, 14, x, y, C.peach).px(x, y, C.white);
    p.ring(3, 13, 2.5, 1, C.yellow);
  },
  ab_k_net_evo: (p) => {
    p.ring(8, 8, 7, 1, C.cyan);
    for (let i = 0; i < 4; i++) { p.line(2 + i * 4, 1, 2 + i * 4, 15, C.lgray); p.line(1, 2 + i * 4, 15, 2 + i * 4, C.lgray); }
    p.sphere(8, 8, 2.5, 2.5, [C.dblue, C.blue, C.cyan, C.white]);
  },
  ab_k_rain_evo: (p) => {
    p.sphere(8, 3, 6, 2.5, RAMP.night).px(5, 2, C.slate);
    for (const x of [3, 6, 9, 12]) p.line(x, 6, x - 2, 14, C.yellow).px(x - 2, 14, C.white);
  },
  ab_b_charge_evo: (p) => {
    p.polyShade([[1, 6], [9, 6], [9, 3], [15, 8], [9, 13], [9, 10], [1, 10]], RAMP.fire);
    p.ring(13, 8, 3, 1, C.yellow).line(2, 7, 8, 7, C.white);
  },
  ab_b_slam_evo: (p) => {
    p.ring(8, 9, 7.5, 1, C.brown).ring(8, 9, 5, 1, C.orange).ring(8, 9, 2.5, 1, C.yellow);
    p.line(8, 1, 8, 6, C.lgray).rect(6, 1, 5, 2, C.dgray);
  },
  ab_b_titan_evo: (p) => {
    p.ring(8, 8.5, 7.5, 1.5, C.gold);
    p.sphere(8, 9, 5, 5, RAMP.red).rect(5, 9, 7, 1, C.black).px(10, 9, C.yellow);
    p.line(4, 6, 2, 1, C.gold).px(2, 1, C.white).line(12, 6, 14, 1, C.gold).px(14, 1, C.white);
  },
  ab_i_fireball_evo: (p) => {
    p.ring(8, 8, 7, 1, C.gold);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      p.line(8 + Math.cos(a) * 5, 8 + Math.sin(a) * 5, 8 + Math.cos(a) * 7, 8 + Math.sin(a) * 7, C.yellow);
    }
    p.sphere(8, 8, 4, 4, [C.orange, C.gold, C.yellow, C.white]).px(7, 7, C.white);
  },
  ab_i_ring_evo: (p) => {
    p.ring(8, 8, 7, 1.5, C.orange).ring(8, 8, 5, 1, C.gold);
    p.polyShade([[5, 4], [11, 4], [11, 8], [8, 12], [5, 8]], RAMP.blue).px(7, 5, C.white);
  },
  ab_i_inferno_evo: (p) => {
    p.rect(0, 12, 16, 4, C.dred).rect(0, 12, 16, 1, C.orange);
    for (const [x, y] of [[3, 3], [8, 6], [13, 2], [5, 9], [11, 9]] as const) {
      p.line(x - 2, y - 3, x, y, C.gold);
      p.sphere(x, y, 1.8, 1.8, RAMP.fire).px(x, y, C.yellow);
    }
  },
};
