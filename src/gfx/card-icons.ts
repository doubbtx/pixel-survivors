import { C, RAMP } from '../core/palette';
import type { Painter } from './painter';
import { netIcon, arrowHi } from './icons';

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
    // Odłamki: osiem równych klinów-ostrzy wokół kuli (symetrycznie względem środka 8,8).
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + TAU / 16, c = Math.cos(a), s = Math.sin(a);
      p.poly([[8 + c * 3.6 - s * 1, 8 + s * 3.6 + c * 1], [8 + c * 7.2, 8 + s * 7.2], [8 + c * 3.6 + s * 1, 8 + s * 3.6 - c * 1]], i % 2 ? C.lavender : C.lgray);
    }
    p.sphere(8, 8, 2.7, 2.7, RAMP.stone);
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
    // Szklane działo: lufa z pękniętego szkła (jasne odblaski, rysy) na drewnianym kole, błysk wystrzału.
    p.polyShade([[2, 9], [11, 4.5], [13, 8], [4, 12.5]], [C.dblue, C.blue, C.cyan, C.white]);
    p.thin(3, 9.2, 11, 5.2, C.white).thin(6, 7.6, 7.5, 10.5, C.navy).thin(7.5, 10.5, 9, 9.5, C.navy);
    p.sphere(5, 12.5, 2.6, 2.6, RAMP.wood).px(5, 12.5, C.ddbrown);
    for (let k = 0; k < 5; k++) { const a = -1.2 + k * 0.3; p.thin(13, 6, 13 + Math.cos(a) * 3, 6 + Math.sin(a) * 3, C.yellow); }
    p.spot(13.2, 6, C.white);
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
    // Grad strzał: cztery strzały rozchodzących się wachlarzem z jednego punktu (równe kąty), złoty krąg u nasady.
    for (let k = 0; k < 4; k++) {
      const a = -Math.PI / 2 + 0.15 + (k / 3) * (Math.PI / 2 - 0.3);
      arrowHi(p, 2 + Math.cos(a) * 3.5, 14 + Math.sin(a) * 3.5, 2 + Math.cos(a) * 13.3, 14 + Math.sin(a) * 13.3, 0.7);
    }
    p.ring(2.6, 13.4, 2.2, 0.8, C.yellow);
  },
  ab_k_net_evo: (p) => {
    // Lodowa sieć: ta sama sieć w kolorach lodu, w środku kryształ.
    p.sphere(8, 9, 4.6, 3.8, RAMP.blue).px(6.5, 8, C.navy).px(9.5, 8, C.navy).px(6, 7, C.white);
    netIcon(p, [C.dblue, C.cyan, C.white, C.blue], C.lgray);
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
  ab_m_raise_evo: (p) => {
    for (const [x, y] of [[3, 8], [8, 5], [13, 8], [6, 12], [11, 12]] as const) {
      p.sphere(x, y, 2.2, 2.2, [C.slate, C.lavender, C.lgray, C.white]).px(x, y, C.lime);
    }
    p.ring(8, 9, 7.5, 1, C.pink);
  },
  ab_m_curse_evo: (p) => {
    p.sphere(8, 11, 7.5, 4, [C.black, C.plum, C.dgreen, C.lime]);
    p.line(4, 3, 7, 8, C.yellow).line(7, 8, 6, 9, C.yellow).line(6, 9, 9, 13, C.white);
    p.sphere(11, 5, 2.4, 2.4, RAMP.bone).px(10, 5, C.black).px(12, 5, C.black);
  },
  ab_m_legion_evo: (p) => {
    // Legion: sześć klinów (złote i różowe) symetrycznie wokół czaszki z koroną, oczy po obu stronach osi.
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + Math.PI / 6, c = Math.cos(a), s = Math.sin(a);
      p.poly([[8 + c * 3 - s * 1.2, 8 + s * 3 + c * 1.2], [8 + c * 7.3, 8 + s * 7.3], [8 + c * 3 + s * 1.2, 8 + s * 3 - c * 1.2]], i % 2 ? C.pink : C.gold);
    }
    p.sphere(8, 8.5, 3.5, 3.3, [C.slate, C.lavender, C.lgray, C.white]);
    p.rect(5.67, 8, 1.33, 1.33, C.lime).rect(9, 8, 1.33, 1.33, C.lime);
    p.poly([[4.5, 5], [5.5, 2.5], [7, 4], [8, 1.8], [9, 4], [10.5, 2.5], [11.5, 5]], C.gold);
  },
};
