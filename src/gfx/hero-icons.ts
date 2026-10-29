import { C, RAMP } from '../core/palette';
import type { Painter } from './painter';

/**
 * Ikony 16×16 bohaterów Vesper (zabójczyni) i Aurel (kapłan): broń z ewolucją oraz umiejętności z ewolucjami.
 * Te same zasady co w gfx/icons.ts (1 px marginesu, obrys dodaje rejestr sprite'ów).
 */
const TAU = Math.PI * 2;

/** Sztylet od rękojeści (x0, y0) do czubka (x1, y1): ostrze z jasną krawędzią i ciemnym grzbietem, złoty jelec, owinięta rękojeść. */
function dagger(p: Painter, x0: number, y0: number, x1: number, y1: number, blade: number = C.lgray): void {
  const L = Math.hypot(x1 - x0, y1 - y0) || 1, ux = (x1 - x0) / L, uy = (y1 - y0) / L, nx = -uy, ny = ux;
  const gx = x0 + ux * 3, gy = y0 + uy * 3;
  p.stroke(x0, y0, gx, gy, C.dbrown).spot(x0 + ux, y0 + uy, C.brown);
  p.line(gx, gy, x1, y1, blade).thin(gx + nx * 0.4, gy + ny * 0.4, x1, y1, C.white).thin(gx - nx * 0.6, gy - ny * 0.6, x1 - ux, y1 - uy, C.dgray);
  p.stroke(gx + nx * 1.8, gy + ny * 1.8, gx - nx * 1.8, gy - ny * 1.8, C.gold).px(x1, y1, C.white);
}

/** Słup światła (Sąd) o środku x i wysokości od y0 do y1. */
function pillar(p: Painter, x: number, y0: number, y1: number): void {
  p.rect(x - 1, y0, 3, y1 - y0, C.yellow).line(x, y0, x, y1, C.white);
  p.rect(x - 2, y1, 5, 1, C.gold);
}

function halo(p: Painter, cx: number, cy: number, rx: number, c: number = C.yellow): void {
  for (let a = 0; a < TAU; a += 0.15) p.px(cx + Math.cos(a) * rx, cy + Math.sin(a) * rx * 0.35, c);
}

export const HERO_ICONS: Record<string, (p: Painter) => void> = {
  // ===================== bronie =====================
  ic_knives: (p) => { dagger(p, 2, 13, 9, 6); dagger(p, 6, 14, 13, 7); dagger(p, 3, 9, 9, 3); },
  ic_knives_evo: (p) => {
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * TAU + 0.4;
      dagger(p, Math.round(8 + Math.cos(a) * 2), Math.round(8 + Math.sin(a) * 2), Math.round(8 + Math.cos(a) * 7), Math.round(8 + Math.sin(a) * 7), C.lavender);
    }
    p.sphere(8, 8, 2, 2, RAMP.night).px(8, 8, C.hotpink);
  },
  // Pierścień światła: jasny środek i dwa rozchodzące się kręgi.
  ic_light: (p) => {
    p.ring(8, 8, 7, 1, C.gold).ring(8, 8, 4.6, 1, C.yellow);
    p.sphere(8, 8, 2.4, 2.4, [C.gold, C.yellow, C.cream, C.white]);
    p.px(8, 1, C.white).px(15, 8, C.white).px(8, 15, C.white).px(1, 8, C.white);
  },
  ic_light_evo: (p) => {
    p.ring(8, 8, 6.5, 1, C.gold);
    for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; p.line(8 + Math.cos(a) * 3, 8 + Math.sin(a) * 3, 8 + Math.cos(a) * 7, 8 + Math.sin(a) * 7, k % 2 ? C.yellow : C.white); }
    p.sphere(8, 8, 2.6, 2.6, [C.orange, C.gold, C.yellow, C.white]);
  },

  // ===================== Vesper =====================
  ab_v_step: (p) => {
    // Cienisty krok: dwa gasnące cienie (powidoki) i zabójczyni z wysuniętym sztyletem.
    p.sphere(3, 9, 2, 3, [C.black, C.navy, C.slate]).sphere(6.5, 8.5, 2.4, 3.3, [C.black, C.navy, C.plum]);
    p.sphere(10, 8, 2.8, 3.6, RAMP.night).px(9.5, 7, C.hotpink).px(11, 7, C.hotpink);
    p.thin(1, 12.5, 7, 12.5, C.slate).thin(2, 14, 8, 14, C.dgray);
    dagger(p, 10, 12, 15, 2);
  },
  ab_v_step_evo: (p) => {
    p.sphere(3, 10, 2, 3, RAMP.night).sphere(8, 8, 2, 3, RAMP.night).px(8, 7, C.hotpink);
    dagger(p, 10, 14, 14, 3, C.lavender);
    p.px(5, 9, C.slate).px(11, 6, C.white);
  },
  ab_v_exec: (p) => {
    for (let a = -0.9; a <= 0.9; a += 0.08) p.px(5 + Math.cos(a - 0.6) * 9, 9 + Math.sin(a - 0.6) * 9, C.salmon);
    for (let a = -0.7; a <= 0.7; a += 0.1) p.px(5 + Math.cos(a - 0.6) * 7, 9 + Math.sin(a - 0.6) * 7, C.white);
    dagger(p, 2, 14, 7, 8);
    p.px(13, 12, C.red).px(12, 13, C.dred);
  },
  ab_v_exec_evo: (p) => {
    p.ring(8, 8, 6.5, 1, C.salmon).ring(8, 8, 5, 1, C.red);
    dagger(p, 4, 12, 12, 4, C.white);
    p.px(2, 3, C.red).px(13, 13, C.red);
  },
  ab_v_vanish: (p) => {
    // Zniknięcie: kłąb fioletowego dymu, w nim tylko świecące oczy, iskry rozwiewania.
    for (const [x, y, r] of [[5, 10, 3.6], [10.5, 10, 3.6], [8, 6.5, 3.8], [3.5, 6, 2.2], [12.5, 5.5, 2.2]] as const) p.sphere(x, y, r, r, [C.black, C.slate, C.lavender, C.lgray]);
    p.poly([[6, 8], [8, 8.5], [6.5, 9.5]], C.black).poly([[10, 8], [8.5, 8.5], [9.5, 9.5]], C.black).px(6.6, 8.7, C.hotpink).px(9.4, 8.7, C.hotpink);
    p.px(1, 2, C.lavender).px(14.5, 1.5, C.white).px(15, 12, C.lavender);
  },
  ab_v_dance: (p) => {
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * TAU - 0.3;
      dagger(p, Math.round(8 + Math.cos(a) * 2), Math.round(8 + Math.sin(a) * 2), Math.round(8 + Math.cos(a + 0.8) * 7), Math.round(8 + Math.sin(a + 0.8) * 7));
    }
    for (let a = 0; a < TAU; a += 0.3) p.px(8 + Math.cos(a) * 7, 8 + Math.sin(a) * 7, C.lavender);
  },
  ab_v_dance_evo: (p) => {
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * TAU;
      dagger(p, Math.round(8 + Math.cos(a) * 3), Math.round(8 + Math.sin(a) * 3), Math.round(8 + Math.cos(a + 0.6) * 7), Math.round(8 + Math.sin(a + 0.6) * 7), C.white);
    }
    p.sphere(8, 8, 2, 2, RAMP.purple);
  },

  // ===================== Aurel =====================
  ab_a_guard: (p) => {
    // Anioł stróż: cieniowane skrzydła z piórami, szata, głowa i aureola.
    p.polyShade([[5.5, 7], [0.5, 1.5], [1, 6], [0.5, 9], [2, 11], [5.5, 10.5]], RAMP.bone);
    p.polyShade([[10.5, 7], [15.5, 1.5], [15, 6], [15.5, 9], [14, 11], [10.5, 10.5]], RAMP.bone);
    p.thin(4.5, 8, 1.5, 3, C.white).thin(4.5, 9.5, 1.5, 7.5, C.lavender).thin(11.5, 8, 14.5, 3, C.white).thin(11.5, 9.5, 14.5, 7.5, C.lavender);
    p.polyShade([[5.5, 8], [10.5, 8], [11.5, 15], [4.5, 15]], [C.lavender, C.lgray, C.cream, C.white]);
    p.thin(8, 9, 8, 14.5, C.gold);
    p.sphere(8, 5.5, 2.4, 2.4, RAMP.skin);
    halo(p, 8, 2.2, 3.2);
  },
  ab_a_guard_evo: (p) => {
    p.poly([[4, 6], [0, 1], [1, 10], [5, 11]], C.yellow).poly([[12, 6], [16, 1], [15, 10], [11, 11]], C.yellow);
    p.poly([[5, 8], [11, 8], [10, 15], [6, 15]], C.white);
    p.sphere(8, 5.5, 2.6, 2.6, RAMP.bone);
    p.line(13, 6, 13, 15, C.white).rect(12, 12, 3, 1, C.gold);
    halo(p, 8, 2, 3.5, C.gold);
  },
  ab_a_sanct: (p) => {
    halo(p, 8, 12, 7, C.gold);
    halo(p, 8, 12, 4.5, C.yellow);
    p.rect(7, 3, 3, 8, C.yellow).rect(5, 5, 7, 2, C.yellow).px(8, 4, C.white).px(8, 6, C.white);
  },
  ab_a_sanct_evo: (p) => {
    p.polyShade([[3, 2], [13, 2], [13, 8], [8, 14.5], [3, 8]], RAMP.gold);
    p.rect(7, 4, 2, 8, C.white).rect(5, 6, 6, 2, C.white);
    halo(p, 8, 14, 6, C.yellow);
  },
  ab_a_step: (p) => {
    for (let a = 0; a < TAU; a += 0.5) p.line(10 + Math.cos(a) * 2, 7 + Math.sin(a) * 2, 10 + Math.cos(a) * 5, 7 + Math.sin(a) * 5, C.yellow);
    p.sphere(10, 7, 2, 2, [C.gold, C.yellow, C.white, C.white]);
    p.line(1, 13, 7, 9, C.cream).line(2, 14, 7, 11, C.lgray);
  },
  ab_a_judge: (p) => { pillar(p, 4, 1, 12); pillar(p, 11, 3, 14); p.px(7, 7, C.white).px(14, 5, C.yellow); },
  ab_a_judge_evo: (p) => {
    pillar(p, 3, 1, 10); pillar(p, 8, 2, 14); pillar(p, 13, 1, 11);
    p.rect(1, 0, 14, 1, C.gold);
  },
};
