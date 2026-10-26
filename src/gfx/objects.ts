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
