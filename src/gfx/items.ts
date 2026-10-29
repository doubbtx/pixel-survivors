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
    // Hełm rycerski: kopuła, policzki, wizjer ze szparą i nosalem, czerwony pióropusz, nity.
    p.polyShade([[9, 0.5], [12, 1], [11, 4], [8, 3]], RAMP.red);
    p.sphere(8, 7.5, 6, 5.5, STEEL);
    p.polyShade([[2, 7], [14, 7], [14, 12], [11, 15], [5, 15], [2, 12]], STEEL);
    p.rect(3, 8.5, 10, 1.6, C.black).rect(7.4, 8.5, 1.2, 5, C.black);
    p.thin(3, 7, 13, 7, STEEL[3]).spot(4, 12, C.lgray).spot(11.5, 12, C.dgray);
    p.thin(5, 3, 7, 2, C.white);
  },
  it_hood: (p) => {
    // Kaptur: szpiczasty, cień twarzy w otworze, świecące oczy, opadające poły.
    p.polyShade([[8, 0.5], [13.5, 6], [15, 15], [1, 15], [2.5, 6]], RAMP.green);
    p.sphere(8, 9, 4.2, 4.6, [C.black, C.black, C.navy, C.slate]);
    p.spot(6.2, 9, C.yellow).spot(9.2, 9, C.yellow).px(6.5, 9, C.white);
    p.thin(8, 1.5, 3.5, 6.5, C.lime).thin(3, 11, 2.5, 15, C.teal).thin(13, 11, 13.5, 15, C.teal);
  },
  it_crown: (p) => {
    p.polyShade([[2, 13], [2, 5], [5, 9], [8, 3], [11, 9], [14, 5], [14, 13]], GOLD);
    p.rect(2, 11, 13, 3, GOLD[1]).rect(2, 11, 13, 1, GOLD[3]);
    gem(p, 7, 11, C.red);
    p.px(2, 4, C.white).px(8, 2, C.white).px(14, 4, C.white);
  },
  // ---------------- zbroje ----------------
  it_plate: (p) => {
    // Napierśnik: wycięcie na szyję, naramienniki, grzbiet na środku, złoty pas.
    p.polyShade([[3, 4], [6, 3], [8, 5], [10, 3], [13, 4], [13, 10], [11, 15], [5, 15], [3, 10]], STEEL);
    p.sphere(3, 4.5, 2.6, 2.4, STEEL).sphere(13, 4.5, 2.6, 2.4, STEEL);
    p.thin(8, 6, 8, 14, STEEL[3]).thin(8.4, 6, 8.4, 14, STEEL[1]);
    p.rect(4, 11, 8, 1.4, GOLD[2]).rect(4, 11, 8, 0.5, GOLD[3]).spot(7.6, 11.2, C.red);
    p.thin(5, 6, 6, 9, C.white);
  },
  it_mail: (p) => {
    // Kolczuga z rękawami: rzędy ogniw (przesunięte co rząd), skórzany kołnierz i pas.
    p.polyShade([[4, 2], [12, 2], [15, 7], [13, 9], [12.5, 15], [3.5, 15], [3, 9], [1, 7]], RAMP.night);
    for (let y = 3.5; y < 14.5; y += 1.5) for (let x = 3 + ((y * 2) % 2 ? 0.75 : 0); x < 13.5; x += 1.5) {
      if (x < 4 && y > 8) continue;
      p.spot(x, y, y < 7 ? C.lgray : y < 11 ? C.lavender : C.dgray);
    }
    p.rect(5.5, 2, 5, 1.2, C.brown).rect(3.5, 12, 9, 1.2, C.dbrown).spot(8, 12.2, GOLD[2]);
  },
  it_robe: (p) => {
    // Szata maga: kołnierz-kaptur, rozszerzony dół, złote obszycie i gwiazda.
    p.polyShade([[5, 1.5], [11, 1.5], [12, 6], [15, 15], [1, 15], [4, 6]], RAMP.blue);
    p.polyShade([[4.5, 1], [11.5, 1], [10, 4], [6, 4]], [C.navy, C.dblue, C.blue, C.cyan]);
    p.thin(8, 4, 8, 15, GOLD[3]).rect(1.5, 14, 13, 1, GOLD[2]).thin(4, 6, 12, 6, GOLD[2]);
    p.poly([[8, 7.5], [9, 9.5], [11, 9.8], [9.4, 11], [9.8, 13], [8, 12], [6.2, 13], [6.6, 11], [5, 9.8], [7, 9.5]], C.yellow);
    p.px(8, 10, C.white).thin(5, 7, 3, 13, C.cyan);
  },
  // ---------------- rękawice ----------------
  it_gloves: (p) => {
    // Rękawica: oddzielone palce i kciuk, stalowe płytki na kłykciach, mankiet ze szwem.
    p.polyShade([[3, 8], [3.5, 3], [5.5, 2.5], [6, 5], [6.5, 1.5], [8.5, 1.5], [9, 5], [9.5, 2], [11.5, 2.5], [11.5, 6], [13.5, 5], [14.5, 7], [12, 11], [12, 13], [4, 13]], RAMP.wood);
    p.thin(6, 3, 6, 7, C.dbrown).thin(9, 2.5, 9.2, 7, C.dbrown).thin(11.3, 6, 11.5, 8, C.dbrown);
    p.rect(4, 7, 7, 1.6, STEEL[2]).rect(4, 7, 7, 0.5, C.white);
    p.block(3, 12, 10, 3, RAMP.wood).thin(3.5, 13.5, 12.5, 13.5, C.tan);
  },
  it_bracers: (p) => {
    // Karwasz: walec ze stali pod skosem, rzemienie z klamrami, klejnot.
    p.polyShade([[3, 5], [10, 1], [14, 6], [7, 14.5], [2, 11]], STEEL);
    p.thin(4, 6, 10.5, 2, C.white).thin(3, 10.5, 9.5, 6.5, STEEL[3]);
    p.stroke(4.5, 8, 11.5, 3.5, C.dbrown).stroke(6.5, 12, 13, 7.5, C.dbrown);
    p.spot(8, 6, GOLD[2]).spot(10, 9.8, GOLD[2]);
    p.sphere(7.4, 9.3, 1.5, 1.5, RAMP.blue).px(7, 8.8, C.white);
  },
  // ---------------- buty ----------------
  it_boots: (p) => {
    // But: wywinięta cholewka, sznurowanie, nosek i obcas z podeszwą.
    p.polyShade([[3, 2], [10, 2], [10, 9], [14.5, 10.5], [15, 14], [3, 14]], RAMP.wood);
    p.block(2.5, 1, 8, 3, RAMP.wood).thin(3, 1.5, 10, 1.5, C.clay);
    for (const y of [5, 7, 9]) p.thin(7, y, 9.5, y + 0.8, C.tan);
    p.rect(3, 13.5, 12.5, 1.8, C.ddbrown).rect(3, 13, 4, 2.3, C.black);
    p.thin(4, 4, 4, 12, C.clay).spot(13, 11, C.clay);
  },
  it_sandals: (p) => {
    // Skrzydlaty sandał: niski skórzany but z wycięciami między rzemieniami, ciemna podeszwa, skrzydełko przy pięcie.
    p.polyShade([[3, 8], [7, 7], [10, 8.5], [14, 11], [15, 13], [15, 14.5], [3, 14.5]], RAMP.wood);
    for (const x of [6.5, 9, 11.5]) p.stroke(x, 9, x - 1.2, 12.5, C.ddbrown);
    p.rect(2.5, 13.5, 13, 1.6, C.ddbrown).thin(3, 8.5, 8, 7.5, C.clay).spot(4.6, 10.5, GOLD[2]);
    p.polyShade([[5, 8.5], [0.5, 0.5], [2.6, 4.5], [0.3, 5.5], [2.6, 8.5], [0.6, 10], [5, 11.5]], RAMP.bone);
    p.thin(4.5, 9, 1.2, 1.5, C.white).thin(4.5, 10, 0.8, 6, C.white).thin(4.5, 11, 1.2, 9.8, C.lgray);
  },
  it_ring: (p) => {
    p.ring(8, 9.5, 5, 1.6, GOLD[2]);
    p.line(4, 7, 6, 5, GOLD[3]).line(10, 14, 12, 12, GOLD[1]);
    p.sphere(8, 4, 2.2, 2.2, RAMP.blue).px(7, 3, C.white);
  },
  it_signet: (p) => {
    // Sygnet: stalowa obrączka i złota płytka z wygrawerowanym herbem (tarcza) i klejnotem.
    p.ring(8, 10.5, 4.8, 1.6, STEEL[2]);
    p.thin(4, 8, 6, 6.3, C.white).thin(10, 15, 12, 13.4, STEEL[0]);
    p.polyShade([[4, 1], [12, 1], [13, 4], [12, 7], [4, 7], [3, 4]], GOLD);
    p.poly([[6.5, 2.5], [9.5, 2.5], [9.5, 4.5], [8, 6], [6.5, 4.5]], GOLD[0]).px(8, 3.5, C.red);
    p.thin(4.5, 1.5, 11.5, 1.5, C.yellow);
  },
  // ---------------- amulety ----------------
  it_amulet: (p) => {
    p.line(3, 1, 8, 8, GOLD[2]).line(13, 1, 8, 8, GOLD[2]);
    p.polyShade([[8, 6], [13, 10], [8, 15], [3, 10]], GOLD);
    p.sphere(8, 10.5, 2.5, 2.5, RAMP.red).px(7, 9, C.white);
  },
  it_necklace: (p) => {
    // Naszyjnik z pereł: łuk koralików (cieniowane kulki) i zielony wisior w złotej oprawie.
    for (let k = 0; k <= 10; k++) {
      const a = Math.PI * (k / 10), x = 8 - Math.cos(a) * 6.2, y = 1.5 + Math.sin(a) * 7;
      p.sphere(x, y, 0.9, 0.9, RAMP.bone);
    }
    p.ring(8, 11.6, 2.9, 0.8, GOLD[2]);
    p.sphere(8, 11.6, 2.3, 2.3, RAMP.green).px(7.3, 10.8, C.white);
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
    // Maska demona: kościana twarz, ciemne zakrzywione rogi, wycięte oczy z czerwonym blaskiem, kły i malowane pręgi.
    p.stroke(4, 4, 2, 2.5, C.dbrown).stroke(2, 2.5, 1.5, 0.5, C.clay).stroke(12, 4, 14, 2.5, C.dbrown).stroke(14, 2.5, 14.5, 0.5, C.clay);
    p.polyShade([[3.5, 3.5], [12.5, 3.5], [13.5, 8.5], [11, 14], [5, 14], [2.5, 8.5]], RAMP.bone);
    p.poly([[4.5, 6.5], [7, 7], [6.5, 8.6], [4.5, 8]], C.black).poly([[11.5, 6.5], [9, 7], [9.5, 8.6], [11.5, 8]], C.black);
    p.spot(5.5, 7.4, C.red).spot(10.2, 7.4, C.red);
    p.rect(5.5, 11, 5, 1.2, C.black).poly([[6, 11], [7, 11], [6.5, 12.8]], C.white).poly([[9, 11], [10, 11], [9.5, 12.8]], C.white);
    p.thin(8, 4, 8, 6, C.dred).thin(3.5, 9.5, 5.5, 10.2, C.dred).thin(12.5, 9.5, 10.5, 10.2, C.dred);
    p.thin(4, 4, 12, 4, C.white);
  },
  it_cloak: (p) => {
    // Płaszcz: falujące poły z fałdami, ciemna podszewka, złota zapinka przy kołnierzu.
    p.polyShade([[5, 1.5], [11, 1.5], [14, 12], [15, 15], [11, 13.5], [8, 15.5], [5, 13.5], [1, 15], [2, 12]], RAMP.purple);
    p.poly([[6.5, 2.5], [9.5, 2.5], [10, 6], [6, 6]], C.black);
    p.thin(5.5, 6, 3.5, 13, C.plum).thin(8, 7, 8, 14.5, C.plum).thin(10.5, 6, 12.5, 13, C.plum).thin(6, 5, 4, 11, C.salmon);
    p.sphere(8, 2.5, 1.8, 1.6, GOLD).px(7.5, 2, C.white).thin(4.5, 2, 11.5, 2, GOLD[1]);
  },
  it_claws: (p) => {
    // Pazury: trzy długie, zakrzywione ostrza wychodzące z rękawicy (jasna krawędź, ciemny grzbiet).
    for (const [x, y] of [[2.5, 9], [5, 11], [7.5, 13]] as const) {
      p.stroke(x + 2, y - 1, x + 7, y - 5, STEEL[1]).stroke(x + 7, y - 5, x + 11.5, y - 6.5, STEEL[1]);
      p.thin(x + 2, y - 1.6, x + 7, y - 5.6, C.white).thin(x + 7, y - 5.6, x + 11.5, y - 7, C.lgray);
    }
    p.polyShade([[1, 11], [5, 7.5], [9, 12], [6, 15.5], [1.5, 15]], RAMP.wood);
    p.thin(2, 12, 6, 9, C.clay).spot(4.5, 12, GOLD[2]);
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
