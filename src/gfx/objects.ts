import { C, RAMP, type Ramp } from '../core/palette';
import { Painter } from './painter';

/**
 * Obiekty mapy (systems/events.ts): kapliczki (kula w kolorze błogosławieństwa), miecz w kamieniu,
 * portal do lochu (3 klatki wiru) i portal powrotny.
 */
/** Kolory kul kapliczek w kolejności błogosławieństw (systems/events.ts BLESSINGS). */
export const SHRINE_RAMPS: Ramp[] = [RAMP.red, [C.dblue, C.blue, C.cyan, C.white], RAMP.green, RAMP.gold, RAMP.blue];

export function shrine(kind: number): Painter {
  const p = new Painter(18, 24);
  p.block(4, 14, 10, 8, RAMP.stone).rect(3, 21, 12, 2, C.dgray).rect(4, 14, 10, 1, C.lgray);
  p.block(6, 10, 6, 4, RAMP.stone);
  p.line(5, 17, 12, 17, C.dgray).line(5, 19, 12, 19, C.dgray);
  p.sphere(9, 6, 4.5, 4.5, SHRINE_RAMPS[kind]).px(7, 4, C.white).px(8, 4, C.white);
  return p.outline();
}

export function swordStone(): Painter {
  const p = new Painter(20, 26);
  p.sphere(10, 21, 9, 4.5, RAMP.stone).px(5, 19, C.lgray).px(14, 22, C.dgray);
  p.rect(9, 3, 3, 15, C.lgray).rect(9, 3, 1, 15, C.white).rect(11, 3, 1, 15, C.dgray);
  p.rect(5, 15, 11, 2, RAMP.gold[2]).rect(5, 15, 11, 1, RAMP.gold[3]);
  p.rect(9, 0, 3, 3, C.brown).px(10, 0, RAMP.gold[3]);
  return p.outline();
}

/** Osłona terenu (systems/terrain.ts): 0 skrzynia, 1 głaz, 2 kolumna; `cracked` = uszkodzona (pęknięcia). */
export function cover(v: number, cracked: boolean): Painter {
  const p = new Painter(26, 28);
  if (v === 0) {
    // Skrzynia okuta metalem.
    p.block(2, 8, 22, 18, RAMP.wood).rect(2, 16, 22, 1, C.ddbrown).rect(12, 8, 2, 18, C.ddbrown);
    p.line(3, 9, 23, 25, C.dbrown).rect(2, 8, 22, 1, C.clay);
    for (const [x, y] of [[2, 8], [21, 8], [2, 23], [21, 23]]) p.rect(x, y, 3, 3, C.lgray).px(x + 1, y + 1, C.white);
  } else if (v === 1) {
    // Głaz o nieregularnym kształcie.
    p.polyShade([[1, 26], [3, 14], [8, 6], [15, 4], [22, 9], [25, 18], [24, 26]], RAMP.stone);
    p.line(8, 9, 12, 7, C.lgray).line(5, 15, 7, 11, C.lgray).line(14, 14, 18, 22, C.slate).line(18, 22, 21, 20, C.slate);
  } else {
    // Kolumna z głowicą.
    p.block(7, 4, 12, 20, RAMP.stone).rect(4, 22, 18, 4, C.dgray).rect(4, 22, 18, 1, C.lgray).rect(5, 1, 16, 4, C.lavender).rect(5, 1, 16, 1, C.white);
    p.line(10, 6, 10, 21, C.slate).line(15, 6, 15, 21, C.slate);
  }
  if (cracked) p.line(8, 10, 13, 16, C.black).line(13, 16, 10, 22, C.black).line(13, 16, 18, 13, C.black);
  return p.outline();
}

/** Beczka wybuchowa: czerwona z ostrzegawczym pasem. */
export function barrel(): Painter {
  const p = new Painter(14, 18);
  p.block(2, 3, 10, 13, RAMP.red).rect(2, 6, 10, 1, C.dgray).rect(2, 12, 10, 1, C.dgray);
  p.rect(4, 8, 6, 3, C.yellow).px(6, 9, C.black).px(7, 9, C.black);
  p.sphere(7, 3, 5, 1.6, RAMP.red).px(7, 3, C.black);
  return p.outline();
}

/** Kolce: płyta z otworami, `up` = wysunięte ostrza. */
export function spikes(up: boolean): Painter {
  const p = new Painter(26, 18);
  p.sphere(13, 12, 12, 5, RAMP.night);
  for (const [x, y] of [[6, 11], [13, 10], [20, 11], [9, 14], [17, 14]]) {
    if (up) p.poly([[x - 2, y + 1], [x, y - 7], [x + 2, y + 1]], C.lgray).line(x, y - 6, x, y, C.white);
    else p.rect(x - 1, y, 3, 2, C.black);
  }
  return p.outline();
}

/** Kamień zadania (systems/tasks.ts): obelisk z turkusową runą. */
export function taskStone(): Painter {
  const p = new Painter(16, 26);
  p.block(2, 21, 12, 4, RAMP.stone).rect(2, 21, 12, 1, C.lgray);
  p.block(4, 4, 8, 17, RAMP.stone).rect(5, 2, 6, 2, C.lavender).rect(6, 1, 4, 1, C.lgray);
  p.rect(7, 7, 2, 1, C.cyan).rect(6, 9, 4, 1, C.cyan).rect(7, 11, 2, 4, C.cyan).px(7, 7, C.white).px(7, 11, C.white);
  p.rect(6, 16, 4, 1, C.blue);
  return p.outline();
}

/** Totem do obrony (zadanie): rzeźbiony słup z czaszką i piórami. */
export function totem(): Painter {
  const p = new Painter(18, 30);
  p.block(3, 25, 12, 4, RAMP.stone);
  p.block(5, 8, 8, 17, RAMP.wood).line(5, 14, 12, 14, C.ddbrown).line(5, 20, 12, 20, C.ddbrown);
  p.rect(7, 16, 1, 2, C.gold).rect(10, 16, 1, 2, C.gold);
  p.sphere(9, 6, 4.5, 4.5, RAMP.bone).rect(7, 5, 1, 2, C.black).rect(10, 5, 1, 2, C.black).rect(8, 8, 2, 1, C.dgray);
  p.rect(2, 9, 3, 1, C.red).rect(1, 10, 3, 1, C.salmon).rect(13, 9, 3, 1, C.red).rect(14, 10, 3, 1, C.salmon);
  return p.outline();
}

/** Portal: wir z obracającymi się ramionami (klatka 0-2); `exit` = portal powrotny (zielony). */
export function portal(f: number, exit: boolean): Painter {
  const p = new Painter(26, 30);
  const ramp: Ramp = exit ? RAMP.green : RAMP.purple;
  p.block(2, 26, 22, 3, RAMP.stone).rect(2, 26, 22, 1, C.lgray);
  p.sphere(13, 14, 10, 12, ramp);
  p.sphere(13, 14, 6, 8, [C.black, ramp[1], ramp[2], ramp[3]]);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + f * 0.5;
    for (let r = 2; r < 9; r += 1.5) p.px(Math.round(13 + Math.cos(a + r * 0.25) * r * 0.8), Math.round(14 + Math.sin(a + r * 0.25) * r), C.white);
  }
  return p.outline();
}
