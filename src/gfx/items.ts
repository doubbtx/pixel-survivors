import { C, RAMP } from '../core/palette';
import type { Painter } from './painter';

/**
 * Ikony przedmiotów ekwipunku 16×16 (nazwy it_<typ bazowy>, data/items.ts).
 * Maluje się je tak jak ikony broni — obrys dodaje rejestr sprite'ów.
 */
const STEEL = RAMP.stone;
const GOLD = RAMP.gold;

function gem(p: Painter, x: number, y: number, c: number = C.red): void {
  p.px(x, y, c).px(x + 1, y, c).px(x, y + 1, c).px(x + 1, y + 1, c).px(x, y, C.white);
}

export const ITEM_ICONS: Record<string, (p: Painter) => void> = {
  // ---------------- broń ----------------
  it_sword: (p) => {
    p.poly([[12, 1.5], [14.5, 1.5], [14.5, 4], [6, 12.5], [3.5, 10]], STEEL[2]);
    p.line(13, 2, 5, 10, C.white).line(14, 4, 6, 12, STEEL[1]);
    p.line(2, 9, 7, 14, GOLD[2]).px(2, 9, GOLD[3]);
    p.line(4, 12, 2, 14, C.brown).px(1, 15, GOLD[2]);
  },
  it_axe: (p) => {
    p.line(4, 14, 11, 3, C.brown).line(5, 14, 12, 3, C.dbrown);
    p.polyShade([[9, 1], [15, 3], [14.5, 9], [11, 6]], STEEL);
    p.line(14, 3, 14, 8, C.white);
    p.polyShade([[9, 2], [6, 2.5], [8, 6]], STEEL);
  },
  it_staff: (p) => {
    p.line(4, 15, 10, 5, C.brown).line(5, 15, 11, 5, C.dbrown);
    p.ring(11, 4.5, 3, 1, GOLD[2]);
    p.sphere(11, 4.5, 2, 2, RAMP.purple).px(10, 3, C.white);
    p.px(14, 1, C.cyan).px(7, 2, C.cyan);
  },
  it_dagger: (p) => {
    p.poly([[13, 2], [14, 3], [8, 10], [7, 9]], STEEL[2]).line(13, 2, 8, 8, C.white);
    p.line(5, 8, 9, 12, GOLD[2]);
    p.line(6, 11, 3, 14, C.dbrown).px(2, 15, C.red);
  },
  // ---------------- hełmy ----------------
  it_helm: (p) => {
    p.sphere(8, 8, 6, 6, STEEL).rect(2, 9, 13, 5, C.black);
    p.block(2, 8, 12, 5, STEEL);
    p.rect(4, 9, 8, 2, C.black).rect(7, 9, 2, 4, C.black);
    p.line(8, 2, 8, 7, STEEL[3]).px(6, 4, C.white);
  },
  it_hood: (p) => {
    p.polyShade([[8, 1], [14, 8], [13, 15], [3, 15], [2, 8]], RAMP.green);
    p.sphere(8, 10, 3.5, 4, RAMP.night).px(6, 10, C.yellow).px(10, 10, C.yellow);
  },
  it_crown: (p) => {
    p.polyShade([[2, 13], [2, 5], [5, 9], [8, 3], [11, 9], [14, 5], [14, 13]], GOLD);
    p.rect(2, 11, 13, 3, GOLD[1]).rect(2, 11, 13, 1, GOLD[3]);
    gem(p, 7, 11, C.red);
    p.px(2, 4, C.white).px(8, 2, C.white).px(14, 4, C.white);
  },
  // ---------------- zbroje ----------------
  it_plate: (p) => {
    p.polyShade([[2, 3], [6, 2], [8, 4], [10, 2], [14, 3], [13, 9], [12, 14], [4, 14], [3, 9]], STEEL);
    p.line(8, 5, 8, 13, STEEL[1]).line(5, 4, 5, 8, C.white);
    p.rect(4, 10, 8, 1, GOLD[2]);
  },
  it_mail: (p) => {
    p.polyShade([[2, 3], [6, 2], [8, 4], [10, 2], [14, 3], [13, 14], [3, 14]], RAMP.night);
    for (let y = 5; y < 14; y += 2) for (let x = 4 + (y % 4 === 1 ? 1 : 0); x < 13; x += 2) p.px(x, y, STEEL[2]);
    p.rect(3, 12, 10, 1, C.brown);
  },
  it_robe: (p) => {
    p.polyShade([[5, 1], [11, 1], [12, 6], [15, 15], [1, 15], [4, 6]], RAMP.blue);
    p.line(8, 2, 8, 15, GOLD[2]).rect(4, 7, 8, 1, GOLD[3]);
    p.px(6, 2, C.white);
  },
  // ---------------- rękawice ----------------
  it_gloves: (p) => {
    p.polyShade([[3, 6], [4, 2], [6, 2], [7, 5], [8, 1], [10, 1], [10, 5], [12, 3], [14, 4], [12, 10], [11, 14], [4, 14]], RAMP.wood);
    p.rect(4, 11, 8, 3, C.brown).rect(4, 11, 8, 1, C.clay);
    p.px(5, 3, C.clay).px(9, 2, C.clay);
  },
  it_bracers: (p) => {
    p.block(2, 4, 5, 10, STEEL).block(9, 2, 5, 10, STEEL);
    p.rect(2, 7, 5, 1, GOLD[2]).rect(9, 5, 5, 1, GOLD[2]);
    gem(p, 3, 10, C.cyan);
    gem(p, 10, 8, C.cyan);
  },
  // ---------------- buty ----------------
  it_boots: (p) => {
    p.polyShade([[3, 1], [9, 1], [9, 9], [15, 11], [15, 15], [3, 15]], RAMP.wood);
    p.rect(3, 13, 13, 2, C.ddbrown).rect(3, 3, 6, 1, C.clay);
    p.px(5, 5, C.clay).px(6, 7, C.clay);
  },
  it_sandals: (p) => {
    p.polyShade([[3, 12], [14, 12], [14, 15], [2, 15]], RAMP.wood);
    p.line(5, 12, 9, 6, C.tan).line(12, 12, 9, 6, C.tan).line(4, 8, 10, 4, C.tan);
    p.px(9, 6, GOLD[3]);
    p.line(12, 3, 14, 1, C.white).line(13, 5, 15, 3, C.white);
  },
  // ---------------- pierścienie ----------------
  it_ring: (p) => {
    p.ring(8, 9.5, 5, 1.6, GOLD[2]);
    p.line(4, 7, 6, 5, GOLD[3]).line(10, 14, 12, 12, GOLD[1]);
    p.sphere(8, 4, 2.2, 2.2, RAMP.blue).px(7, 3, C.white);
  },
  it_signet: (p) => {
    p.ring(8, 10, 5, 1.6, STEEL[2]);
    p.block(4, 1, 8, 6, GOLD);
    p.rect(6, 3, 4, 2, GOLD[1]).px(7, 3, GOLD[3]);
  },
  // ---------------- amulety ----------------
  it_amulet: (p) => {
    p.line(3, 1, 8, 8, GOLD[2]).line(13, 1, 8, 8, GOLD[2]);
    p.polyShade([[8, 6], [13, 10], [8, 15], [3, 10]], GOLD);
    p.sphere(8, 10.5, 2.5, 2.5, RAMP.red).px(7, 9, C.white);
  },
  it_necklace: (p) => {
    for (let k = 0; k <= 8; k++) {
      const a = Math.PI * (k / 8), x = 8 - Math.cos(a) * 6, y = 2 + Math.sin(a) * 8;
      p.px(Math.round(x), Math.round(y), k % 2 ? C.white : C.lgray);
    }
    p.sphere(8, 11, 2.5, 2.5, RAMP.green).px(7, 10, C.white);
  },
  it_talisman: (p) => {
    p.line(8, 0, 8, 3, C.brown);
    p.disc(8, 9, 6, C.dbrown).disc(8, 9, 5, C.clay).disc(8, 9, 3.5, C.tan);
    p.line(8, 6, 8, 12, C.dred).line(5, 9, 11, 9, C.dred).px(8, 9, C.red);
  },
  // ---------------- dodatkowe typy (więcej różnorodności łupu) ----------------
  it_mace: (p) => {
    p.line(3, 15, 9, 7, C.brown).line(4, 15, 10, 7, C.dbrown);
    p.sphere(11, 5, 4, 4, STEEL);
    for (const [x, y] of [[11, 0], [15, 5], [6, 4], [14, 9], [8, 1]]) p.px(x, y, C.lgray);
    p.px(10, 4, C.white);
  },
  it_wand: (p) => {
    p.line(3, 14, 11, 6, C.plum).line(4, 14, 12, 6, C.pink);
    p.poly([[12, 1], [13.5, 4.5], [16, 5], [13.5, 6.5], [12, 10], [10.5, 6.5], [8, 5], [10.5, 4.5]], C.yellow).px(12, 5, C.white);
  },
  it_mask: (p) => {
    p.polyShade([[2, 3], [14, 3], [14, 9], [8, 15], [2, 9]], RAMP.bone);
    p.rect(4, 6, 3, 2, C.black).rect(9, 6, 3, 2, C.black).line(6, 11, 10, 11, C.dred);
    p.line(2, 4, 14, 4, C.white).px(5, 6, C.red).px(10, 6, C.red);
  },
  it_cloak: (p) => {
    p.polyShade([[5, 1], [11, 1], [14, 15], [2, 15]], RAMP.purple);
    p.line(8, 2, 8, 14, C.plum).rect(5, 1, 6, 2, C.gold).px(8, 2, C.yellow);
  },
  it_claws: (p) => {
    p.block(3, 8, 9, 6, RAMP.wood);
    for (const x of [4, 7, 10]) p.line(x, 8, x + 3, 1, STEEL[3]).px(x + 3, 1, C.white);
    p.rect(3, 12, 9, 1, C.dbrown);
  },
  it_greaves: (p) => {
    p.block(3, 1, 4, 11, STEEL).block(9, 1, 4, 11, STEEL);
    p.block(2, 11, 6, 4, RAMP.wood).block(8, 11, 6, 4, RAMP.wood);
    p.px(4, 3, C.white).px(10, 3, C.white).rect(3, 6, 4, 1, GOLD[2]).rect(9, 6, 4, 1, GOLD[2]);
  },
  it_band: (p) => {
    p.ring(8, 9, 5.5, 2, GOLD[2]).ring(8, 9, 5.5, 1, GOLD[3]);
    p.px(4, 6, C.white).px(12, 12, GOLD[1]);
  },
  it_charm: (p) => {
    p.line(3, 1, 8, 6, GOLD[2]).line(13, 1, 8, 6, GOLD[2]);
    p.poly([[8, 6], [12, 10], [8, 15], [4, 10]], C.cyan).poly([[8, 7.5], [10.5, 10], [8, 13], [5.5, 10]], C.blue).px(7, 9, C.white);
  },
};
