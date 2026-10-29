import { W, H, type Renderer } from '../core/renderer';
import type { Input, Action } from '../core/input';
import { C } from '../core/palette';
import { drawText, wrapText, textWidth, DESC, descS, descLH, smallS } from '../core/font';
import { sfx } from '../core/audio';
import { drawSprite } from '../gfx/sprites';
import { BAL } from '../data/balance';
import { BIOMES, objectiveLabel } from '../data/levels';
import { BIOME_WAVES } from '../data/waves';
import { ENEMIES, BIOME_MINIBOSS } from '../data/enemies';
import {
  NODE_INFO, actBiome, chooseTier, tierOpen, MAP_RARITY, MAP_MOD_BY_ID, MAP_BONUS_BY_ID, EX_BLESSINGS, CAMP_BUFFS, exRow, isCombat, levelAt, linked, nextLanes, depthAt, mapReward,
  type MapNode, type NodeKind,
} from '../data/expedition';
import type { Run } from '../game/run';
import { fmt } from '../util/format';
import { panel, inside, hovered, button, Scroll } from './widgets';
import { tile, iconSlot, UI } from './theme';
import { CHUNK, groundChunk, groundBase, groundFrame } from '../gfx/ground';
import { drawElemMark } from '../gfx/elemmark';
import { tr } from '../core/i18n';
import { ELEMENTS, type Element } from '../data/elements';
import { ELITE_MODS } from '../data/enemies';

const MAP_X = 8, MAP_Y = 28, MAP_W = W - 16, MAP_H = 140;
const NODE = 20;
const DET_Y = MAP_Y + MAP_H + 4;
/** Przyciski w prawym dolnym rogu panelu szczegółów: Plecak, Menu, Wyrusz (lewy górny róg, szerokość). */
const BTN_Y = H - 21, BTN_H = 14;
const BTNS: { label: string; w: number; act: 'inventory' | 'menu' | 'go' }[] = [
  { label: 'Plecak [I]', w: 56, act: 'inventory' }, { label: 'Menu [Esc]', w: 56, act: 'menu' }, { label: 'Wyrusz [Enter]', w: 86, act: 'go' },
];
function btnX(i: number): number {
  let x = MAP_X + MAP_W - 8;
  for (let k = BTNS.length - 1; k >= i; k--) x -= BTNS[k].w + (k < BTNS.length - 1 ? 3 : 0);
  return x;
}
/** Legenda rodzajów węzłów (górny wiersz mapy). */
/** Legenda: tylko rodzaje obecne na mapie aktu (kolejność stała). */
const LEGEND: NodeKind[] = ['fight', 'elite', 'ambush', 'hunt', 'dungeon', 'vault', 'treasure', 'shop', 'anvil', 'rest', 'shrine', 'boss', 'secret'];
/** Karty wyboru obozu / kapliczki (lewy górny róg, rozmiar). */
const OFFER_H = 40;
/** Szerokość karty oferty (2 albo 3 opcje — Mapa pielgrzyma). */
const offerW = (n: number) => (n > 2 ? 112 : 150);
const offerPos = (i: number, n = 2): [number, number] => [MAP_X + 60 + i * (offerW(n) + 8), DET_Y + 18];

/** Przyciski poziomu trudności w prawym górnym rogu panelu szczegółów (lewy górny róg przycisku). */
const TIER_W = 50, TIER_H = 14;
/** Lista modyfikatorów w panelu mapy (x, y, w, h): pod nazwą mapy, do przycisków. */
const MODS_AREA = [MAP_X + 8, DET_Y + 38, 250, BTN_Y - DET_Y - 40] as const;
const tierPos = (i: number): [number, number] => [MAP_X + MAP_W - 8 - (4 - i) * (TIER_W + 3) + 3, DET_Y + 6];
/** Mały tekst panelu szczegółów. */
const SMALL: { readonly scale: number } = { get scale() { return smallS(); } };

/** Środek węzła (rząd, kolumna) na ekranie. */
function nodePos(row: number, lane: number): [number, number] {
  const X = BAL.expedition;
  const step = (MAP_W - 60) / (X.rows - 1);
  return [MAP_X + 30 + row * step, MAP_Y + 34 + lane * ((MAP_H - 50) / (X.lanes - 1))];
}

/** Udział żywiołów w obrażeniach z ostatniej mapy, np. „Your build: Fire 42%, Ice 10%, other 48%”. */
function buildElements(dmg: Partial<Record<Element | 'none', number>>): string {
  const total = Object.values(dmg).reduce((a, b) => a + (b ?? 0), 0);
  if (total <= 0) return 'Your build: no damage data yet';
  const parts = (Object.keys(ELEMENTS) as Element[]).filter((k) => (dmg[k] ?? 0) / total >= 0.01)
    .sort((a, b) => (dmg[b] ?? 0) - (dmg[a] ?? 0)).map((k) => `${tr(ELEMENTS[k].name)} ${Math.round(((dmg[k] ?? 0) / total) * 100)}%`);
  return `Your build (last map): ${parts.length ? parts.join(', ') : tr('no elements')}`;
}

export type MapAction = { pick: number } | 'inventory' | 'menu' | null;

/** Kolor ramki węzła: rzadkość mapy (z walką) albo kolor rodzaju węzła. */
const nodeColor = (m: MapNode) => (isCombat(m.kind) && m.kind !== 'boss' && m.rarity ? MAP_RARITY[m.rarity].color : NODE_INFO[m.kind].color);

/**
 * Mapa aktu Ekspedycji: rzędy węzłów od lewej do prawej, ścieżki między sąsiednimi kolumnami, przebyta droga na złoto.
 * Mapy z walką mają rzadkość (kolor ramki), modyfikatory ryzyka z nagrodą i bonus — szczegóły na dole.
 * Strzałki / mysz: wybór dostępnego węzła, Enter / klik: idź, I: ekwipunek, Esc: menu.
 * Podgląd trasy (0.35): mysz nad dowolnym dalszym węzłem pokazuje jego szczegóły i podświetla drogi do niego.
 * Obóz i kapliczka (0.35): przed dalszą drogą wybór jednej z dwóch opcji (strzałki / 1-2 / klik, Enter).
 */
export class ExpeditionMapView {
  private sel = 0;
  private lastMouse = 0;
  /** Przewijanie listy modyfikatorów zaznaczonej mapy (zerowane przy zmianie zaznaczenia). */
  private modScroll = new Scroll();
  private modKey = '';
  /** Węzeł pod myszą poza najbliższym rzędem (podgląd trasy): rząd, kolumna. */
  private peek: [number, number] | null = null;
  private offerSel = 0;

  /**
   * `onTier`: gracz zmienił poziom trudności (zapamiętanie na następne wyprawy).
   * `onChosen`: wybrano bonus obozu albo kapliczki (komunikat, zapis).
   */
  constructor(private readonly run: Run, private readonly onTier: (tier: number) => void, private readonly onChosen: (text: string) => void) {}

  /** Wybór obozu / kapliczki: zwraca true, gdy nakładka wyboru przejęła wejście. */
  private updateOffer(input: Input): boolean {
    const ex = this.run.expedition!, offer = ex.offer;
    if (!offer) return false;
    const m = input.mouse;
    const n = offer.ids.length;
    if (input.pressed('left') || input.pressed('up')) { this.offerSel = (this.offerSel + n - 1) % n; sfx.play('select'); }
    if (input.pressed('right') || input.pressed('down')) { this.offerSel = (this.offerSel + 1) % n; sfx.play('select'); }
    let pick = input.pressed('confirm') ? this.offerSel : input.pressed('n1') ? 0 : input.pressed('n2') ? 1 : input.pressed('n3') && n > 2 ? 2 : -1;
    offer.ids.forEach((_, i) => {
      const [x, y] = offerPos(i, n);
      if (!inside(m.x, m.y, x, y, offerW(n), OFFER_H)) return;
      if (m.lastMove !== this.lastMouse) this.offerSel = i;
      if (input.pressed('click')) pick = i;
    });
    this.lastMouse = m.lastMove;
    if (pick < 0) return true;
    const X = BAL.expedition;
    if (offer.kind === 'rest') {
      const c = CAMP_BUFFS.find((b) => b.id === offer.ids[pick])!;
      ex.camp = c.id;
      this.onChosen(`Camp: +${Math.round(X.restHeal * 100)}% HP, +${X.restMaxHp} max HP. Next map: ${c.name} (${c.desc})`);
    } else {
      const b = EX_BLESSINGS.find((x) => x.id === offer.ids[pick])!;
      ex.blessing = { id: b.id, maps: X.blessingMaps };
      this.onChosen(`Kapliczka: ${b.name} (${b.desc}) na ${X.blessingMaps} mapy`);
    }
    ex.offer = null;
    this.offerSel = 0;
    sfx.play('levelup');
    return true;
  }

  private get lanes(): number[] {
    return nextLanes(this.run.expedition!);
  }

  update(input: Input): MapAction {
    const lanes = this.lanes;
    this.modScroll.update(input, ...MODS_AREA);
    const n = lanes.length;
    if (input.pressed('back') || input.pressed('pause')) return 'menu';
    if (input.pressed('inventory')) return 'inventory';
    if (this.updateOffer(input)) { this.peek = null; return null; }
    if (n === 0) return null;
    this.sel = Math.min(this.sel, n - 1);
    if (input.pressed('up') || input.pressed('left')) { this.sel = (this.sel - 1 + n) % n; sfx.play('select'); }
    if (input.pressed('down') || input.pressed('right')) { this.sel = (this.sel + 1) % n; sfx.play('select'); }
    const m = input.mouse;
    const row = exRow(this.run.expedition!) + 1;
    // Podgląd (bez wejścia): węzeł pod myszą, tylko gdy mysz się ruszyła; klawiatura i pad zdejmują podgląd,
    // żeby panel zawsze pokazywał to, w co wejdzie Enter. Po zablokowaniu trudności R/X (LB/RB) przełączają podgląd.
    const later = this.previewable(row, lanes);
    if (m.lastMove !== this.lastMouse) {
      this.peek = later.find(([r, l]) => { const [x, y] = nodePos(r, l); return inside(m.x, m.y, x - NODE / 2, y - NODE / 2, NODE, NODE); }) ?? null;
    }
    if ((['up', 'down', 'left', 'right', 'confirm', 'n1', 'n2', 'n3', 'n4'] as Action[]).some((a) => input.pressed(a))) this.peek = null;
    const pstep = !tierOpen(this.run.expedition!) ? (input.pressed('skip') ? 1 : input.pressed('reroll') ? -1 : 0) : 0;
    if (pstep && later.length) {
      const i = this.peek ? later.findIndex(([r, l]) => r === this.peek![0] && l === this.peek![1]) : pstep > 0 ? -1 : 0;
      this.peek = later[(i + pstep + later.length) % later.length];
      sfx.play('select');
    }
    for (let i = 0; i < n; i++) {
      const [x, y] = nodePos(row, lanes[i]);
      if (!inside(m.x, m.y, x - NODE / 2, y - NODE / 2, NODE, NODE)) continue;
      if (m.lastMove !== this.lastMouse) this.sel = i;
      // Klik tylko zaznacza węzeł; wejście przyciskiem Wyrusz albo Enterem (bez przypadkowego startu walki).
      if (input.pressed('click') && this.sel !== i) { this.sel = i; sfx.play('select'); }
      else if (input.pressed('click')) this.sel = i;
    }
    this.lastMouse = m.lastMove;
    // Poziom trudności wyprawy: klawisze 1-4, LB/RB na padzie (R/X) albo klik w przycisk (gdy zaznaczona mapa ma poziomy).
    const ex = this.run.expedition!, tiered = !!ex.map[row][lanes[this.sel]]?.tiers;
    const step = input.pressed('skip') ? 1 : input.pressed('reroll') ? -1 : 0;
    if (tiered && step) {
      const t = Math.max(0, Math.min(ex.maxTier ?? MAP_RARITY.length - 1, (ex.tier ?? 0) + step));
      if (chooseTier(ex, t)) { sfx.play('select'); this.onTier(t); }
    }
    const keys = ['n1', 'n2', 'n3', 'n4'] as const;
    keys.forEach((key, t) => {
      const [bx, by] = tierPos(t);
      if (!input.pressed(key) && !(tiered && input.pressed('click') && inside(m.x, m.y, bx, by, TIER_W, TIER_H))) return;
      if (!chooseTier(ex, t)) return;
      sfx.play('select');
      this.onTier(t);
    });
    // Przyciski: Plecak, Menu, Wyrusz.
    if (input.pressed('click')) {
      for (let i = 0; i < BTNS.length; i++) {
        if (!inside(m.x, m.y, btnX(i), BTN_Y, BTNS[i].w, BTN_H)) continue;
        const act = BTNS[i].act;
        return act === 'go' ? { pick: lanes[this.sel] } : act;
      }
    }
    if (input.pressed('confirm')) return { pick: lanes[this.sel] };
    return null;
  }

  render(r: Renderer): void {
    const g = r.g, run = this.run, ex = run.expedition!;
    const X = BAL.expedition;
    r.withAlpha(0.82, () => r.cover(C.black));
    const secretAct = ex.act > X.acts;
    drawText(g, secretAct ? 'Ekspedycja - akt 4: Pustka' : `Ekspedycja - akt ${ex.act}/${X.acts}`, W / 2, 4, secretAct ? C.hotpink : C.yellow, { align: 'center', scale: 2, outline: C.black });
    // Lewa strona nagłówka: biom aktu i postęp aktów (kropki).
    const biomeId = actBiome(ex.act), biome = BIOMES[biomeId];
    for (let k = 0; k < X.acts; k++) r.roundRect(MAP_X + 2 + k * 8, 10, 6, 6, 1, k < ex.act - 1 ? C.gold : k === ex.act - 1 ? C.yellow : C.slate);
    const bname = ex.voidKey && !secretAct ? `${biome.name}   Klucz Pustki` : biome.name, bx = MAP_X + 4 + X.acts * 8;
    drawText(g, bname, bx, 6, ex.voidKey ? C.hotpink : C.lavender);
    // Ukończone mapy: plakietka obok nazwy biomu.
    const mt = `mapy ${ex.cleared}`, mw = textWidth(mt) * smallS() + 8, mx = bx + textWidth(bname) + 5;
    tile(r, mx, 7, mw, 10, C.lgray);
    drawText(g, mt, mx + mw / 2, 7.5, C.lgray, { align: 'center', scale: smallS() });
    // Prawa strona nagłówka: plakietki stanu wyprawy.
    const bless = ex.blessing ? EX_BLESSINGS.find((b) => b.id === ex.blessing!.id) : null;
    // Esencja: nagrody modyfikatorów ukończonych map zwiększają esencję na koniec wyprawy (BAL.expedition.rewardEssence).
    const essence = Math.round(ex.bonus * X.rewardEssence);
    const chips: [string, number, string?][] = [
      [`HP ${fmt(Math.ceil(run.player.hp))}/${fmt(run.stats.maxHp)}`, C.salmon], [`złoto ${fmt(Math.floor(run.gold))}`, C.gold],
      [`esencja +${essence}%`, C.cyan, 'Nagrody za modyfikatory ukończonych map. Na koniec wyprawy dostaniesz tyle więcej esencji do Rozwoju.'],
    ];
    if (bless) chips.push([`${bless.name} (${ex.blessing!.maps})`, C.yellow]);
    const camp = ex.camp ? CAMP_BUFFS.find((b) => b.id === ex.camp) : null;
    if (camp) chips.push([`${camp.name} (1)`, C.lime, `Camp bonus for the next fight: ${camp.desc}.`]);
    let cx = MAP_X + MAP_W, tip: { text: string; x: number } | null = null;
    for (const [t, col, help] of chips) {
      const w = textWidth(t) * smallS() + 8;
      cx -= w;
      if (cx < W / 2 + 90) break;
      tile(r, cx, 7, w, 10, col);
      drawText(g, t, cx + w / 2, 7.5, col, { align: 'center', scale: smallS() });
      if (help && hovered(cx, 7, w, 10)) tip = { text: help, x: cx + w };
      cx -= 3;
    }

    // Mapa: tło z podłoża biomu aktu (ten sam generator co w grze), przygaszone.
    panel(r, MAP_X, MAP_Y, MAP_W, MAP_H);
    g.save();
    g.beginPath(); g.rect(MAP_X + 1, MAP_Y + 1, MAP_W - 2, MAP_H - 2); g.clip();
    groundFrame(8);
    const seed = 900 + ex.act * 31;
    for (let gx = 0; gx * CHUNK < MAP_W; gx++) {
      const c = groundChunk(biome, seed, gx, 0, 2);
      if (c) g.drawImage(c, MAP_X + gx * CHUNK, MAP_Y, CHUNK, CHUNK);
      else { g.fillStyle = groundBase(biome); g.fillRect(MAP_X + gx * CHUNK, MAP_Y, CHUNK, CHUNK); }
    }
    r.withAlpha(0.55, () => r.rect(MAP_X, MAP_Y, MAP_W, MAP_H, C.black));
    g.restore();
    // Legenda rodzajów węzłów.
    let lx = MAP_X + 8;
    const legend = LEGEND.filter((k) => ex.map.some((row) => row.some((n) => n?.kind === k)));
    for (const k of legend) {
      const info = NODE_INFO[k];
      r.withAlpha(0.8, () => drawSprite(g, info.icon, lx + 5, MAP_Y + 9));
      drawText(g, info.name, lx + 14, MAP_Y + 5, info.color, { scale: smallS(), outline: C.black });
      lx += 19 + textWidth(info.name) * smallS();
    }
    // Podpowiedź plakietki pod myszą (nad legendą mapy).
    if (tip) {
      const tw = descS() >= 1 ? 260 : 208, lines = wrapText(tip.text, (tw - 8) / descS()), lh = descLH() - 1, tx = Math.min(tip.x, MAP_X + MAP_W) - tw;
      tile(r, tx, 19, tw, lines.length * lh + 4, C.cyan, 0.95);
      lines.forEach((l, i) => drawText(g, l, tx + 4, 20 + i * lh, C.white, DESC));
    }

    const cur = exRow(ex);
    const lanes = this.lanes;
    const target = lanes[this.sel];
    const last = ex.map.length - 1;
    const route = this.peek ? this.routeTo(...this.peek) : null;
    // Ścieżki: złote na przebytej drodze, jaśniejsze do dostępnych węzłów, turkusowe na drogach do podglądanego węzła.
    for (let row = 0; row < last; row++) {
      ex.map[row].forEach((k, a) => {
        if (!k) return;
        ex.map[row + 1].forEach((k2, b) => {
          if (!k2 || !linked(a, b, row + 1 === last)) return;
          const [x0, y0] = nodePos(row, a), [x1, y1] = nodePos(row + 1, b);
          const walked = ex.path[row] === a && ex.path[row + 1] === b;
          const open = row === cur && ex.path[row] === a && lanes.includes(b);
          const onRoute = !!route && route.has(`${row}:${a}`) && route.has(`${row + 1}:${b}`);
          const col = walked ? C.gold : onRoute ? C.cyan : open ? (b === target ? C.yellow : C.lavender) : C.dgray;
          r.withAlpha(walked || open || onRoute ? 1 : 0.6, () => { r.line(x0, y0 + 1, x1, y1 + 1, C.black, 2); r.line(x0, y0, x1, y1, col, walked || onRoute || b === target && open ? 2 : 1); });
        });
      });
    }
    // Węzły; podpis wybranego rysowany na końcu, żeby węzeł poniżej go nie zasłaniał.
    const t = performance.now() / 1000;
    let label: (() => void) | undefined;
    ex.map.forEach((cells, row) => cells.forEach((m, lane) => {
      if (!m) return;
      const [x, y] = nodePos(row, lane);
      const reachable = row === cur + 1 && lanes.includes(lane);
      if (reachable) hovered(x - NODE / 2, y - NODE / 2, NODE, NODE);
      const peeked = !!this.peek && this.peek[0] === row && this.peek[1] === lane;
      const picked = (lane === target && reachable && !this.peek) || peeked;
      const visited = ex.path[row] === lane;
      const bob = picked ? Math.round(Math.sin(t * 6)) : 0;
      const draw = () => {
        // Dostępne węzły: delikatny puls ramki; wybrany: biała ramka i podpis rodzaju.
        if (reachable && !picked) r.withAlpha(0.25 + 0.2 * Math.sin(t * 4 + lane), () => r.roundRect(x - NODE / 2 - 2, y - NODE / 2 - 2, NODE + 4, NODE + 4, UI.radius + 1, nodeColor(m)));
        iconSlot(r, x - NODE / 2, y - NODE / 2 + bob, NODE, picked ? C.white : visited ? C.gold : nodeColor(m), 0.8);
        drawSprite(g, NODE_INFO[m.kind].icon, x, y + bob);
        if (picked) label = () => {
          const nm = NODE_INFO[m.kind].name, w = textWidth(nm) * smallS() + 6;
          tile(r, x - w / 2, y + NODE / 2 + 3, w, 9, C.white, 0.85);
          drawText(g, nm, x, y + NODE / 2 + 3, C.white, { align: 'center', scale: smallS() });
        };
        // Liczba modyfikatorów mapy: kropki pod węzłem; bonus mapy: zielony znak w rogu.
        if (!picked) for (let k = 0; k < (m.mods?.length ?? 0); k++) r.rect(x - 8 + k * 3, y + NODE / 2 + 1 + bob, 2, 2, C.salmon);
        // Powinowactwo żywiołu: znacznik (kształt dla daltonistów) w lewym dolnym rogu, kreska: zielona podatność, czerwona odporność.
        if (m.affinity && row > cur) {
          const ax = x - NODE / 2 + 2, ay = y + NODE / 2 - 3 + bob;
          drawElemMark(r, m.affinity.el, ax, ay);
          r.rect(ax - 3, ay + 4, 7, 1, m.affinity.kind === 'weak' ? C.lime : C.red);
        }
        if (m.bonus && row > cur) { r.roundRect(x + NODE / 2 - 5, y - NODE / 2 - 2 + bob, 7, 7, 1, C.black); drawText(g, '+', x + NODE / 2 - 1.5, y - NODE / 2 - 1.5 + bob, C.lime, { align: 'center', scale: 0.75 }); }
      };
      const onRoute = !!route?.has(`${row}:${lane}`);
      if (!onRoute && ((row <= cur && !visited) || row > cur + 1 || (row === cur + 1 && !reachable))) r.withAlpha(0.45, draw);
      else draw();
      // Bohater nad bieżącym węzłem (w górnej kolumnie obok węzła, żeby nie zasłaniał legendy).
      if (row === cur && visited) drawSprite(g, `${run.heroSprite}@0`, lane === 0 ? x - 17 : x, lane === 0 ? y : y - 18);
    }));
    label?.();

    // Szczegóły zaznaczonego węzła i przyciski.
    panel(r, MAP_X, DET_Y, MAP_W, H - DET_Y - 4);
    BTNS.forEach((b, i) => button(r, btnX(i), BTN_Y, b.w, BTN_H, b.label, b.act === 'go' ? { accent: C.gold, col: C.yellow, pulse: target !== undefined && !ex.offer, scale: smallS() } : { scale: smallS() }));
    if (ex.offer) { this.renderOffer(r); return; }
    const [drow, dlane] = this.peek ?? [cur + 1, target];
    if (dlane === undefined) return;
    const m = ex.map[drow][dlane]!;
    const kind = NODE_INFO[m.kind];
    const key = `${ex.act}:${drow}:${dlane}:${m.rarity ?? 0}`;
    if (key !== this.modKey) { this.modKey = key; this.modScroll.reset(); }
    const x0 = MAP_X + 8, y0 = DET_Y + 6;
    drawSprite(g, kind.icon, x0 + 10, y0 + 10, { scale: 2 });
    // Rozdarcie w podglądzie: tylko „???” i opis (tajemnica do wejścia).
    if (isCombat(m.kind) && !(m.kind === 'secret' && this.peek)) {
      const lv = levelAt(ex.act, drow, m);
      const rar = MAP_RARITY[m.rarity ?? 0];
      drawText(g, m.name ?? kind.name, x0 + 26, y0, m.kind === 'boss' ? kind.color : rar.color, { shadow: C.black });
      const sub = m.kind === 'boss' ? `${kind.name}: ${lv.bossName}` : `${kind.name}, ${rar.name.toLowerCase()}`;
      drawText(g, sub, x0 + 26, y0 + 11, C.lavender);
      if (this.peek) drawText(g, 'preview', x0 + 32 + textWidth(sub), y0 + 11, C.cyan);
      const goal = lv.dungeon ? `Fale lochu: ${lv.dungeonKind === 'vault' ? BAL.secretsMap.vaultWaves : BAL.events.dungeonWaves}` : `Cel: ${objectiveLabel(lv.objective)}`;
      drawText(g, `${goal}   głębokość ${lv.depth}`, x0 + 26, y0 + 22, C.lgray);
      // Modyfikatory (ryzyko) po lewej: „nazwa: opis” zawijane, przewijane przy wielu modyfikatorach albo dużym tekście.
      const mods = (m.mods ?? []).map((id) => MAP_MOD_BY_ID[id]);
      const [ax, ay, aw, ah] = MODS_AREA, lh = descLH(), oy = this.modScroll.begin(r, ax, ay, aw, ah);
      let my = ay + 1 - oy;
      const para = (text: string, col: number) => { for (const l of wrapText(text, (aw - 6) / descS())) { drawText(g, l, ax, my, col, DESC); my += lh; } };
      // Powinowactwo żywiołu i udział żywiołów buildu z ostatniej mapy (czy ta mapa pasuje do buildu).
      if (m.affinity) {
        const e = ELEMENTS[m.affinity.el];
        const en = tr(e.name);
        para(m.affinity.kind === 'weak' ? `Weak to ${en}: ${en} damage +${Math.round((X.weakMul - 1) * 100)}%` : `Resists ${en}: ${en} damage -${Math.round((1 - BAL.bossResist.mul) * 100)}%, its statuses and reactions blocked, +${X.resistReward}% loot`, m.affinity.kind === 'weak' ? C.lime : C.salmon);
        para(buildElements(run.elemDmg), C.lavender);
      }
      if (m.eliteMods) para(`Elites: ${m.eliteMods.map((k) => tr(ELITE_MODS[k].name)).join(' + ')}`, C.orange);
      // Węzły-wydarzenia: opis zasad (czym różnią się od zwykłej mapy) po informacjach, które zależą od buildu.
      if (m.kind === 'ambush' || m.kind === 'hunt' || m.kind === 'vault') para(kind.desc, kind.color);
      for (const mod of mods) {
        wrapText(`${mod.name}: ${mod.desc}`, (aw - 6) / descS()).forEach((l, i) => {
          drawText(g, l, ax, my, C.lgray, DESC);
          // Nazwa w pierwszej linii na czerwono (rysowana na wierzchu tym samym krojem).
          if (i === 0) drawText(g, `${mod.name}:`, ax, my, C.salmon, DESC);
          my += lh;
        });
      }
      if (!mods.length) { drawText(g, 'Bez modyfikatorów', ax, my, C.lavender, DESC); my += lh; }
      // Kogo spotkasz: wrogowie biomu mapy, na mapie elit także miniboss (w tej samej przewijanej liście).
      if (m.kind !== 'boss') {
        const foes = [...new Set((BIOME_WAVES[lv.biome] ?? []).flatMap((w) => w.mix.map(([id]) => id)))];
        if (m.kind === 'elite' || m.kind === 'secret') foes.unshift(BIOME_MINIBOSS[lv.biome]);
        my += 3;
        drawText(g, 'Enemies:', ax, my + 4, C.lavender);
        let fx = ax + textWidth('Enemies:') + 6;
        for (const id of foes) {
          const e = ENEMIES[id], boss = BIOME_MINIBOSS.includes(id);
          if (!e) continue;
          if (fx + 18 + textWidth(e.name) > ax + aw - 4) { fx = ax + textWidth('Enemies:') + 6; my += 18; }
          drawSprite(g, `${e.sprite}@0`, fx + 8, my + 8, { scale: boss ? 1 : 0.8 });
          drawText(g, e.name, fx + 18, my + 4, boss ? C.salmon : C.lgray);
          fx += 24 + textWidth(e.name);
        }
        my += 18;
      }
      this.modScroll.end(r, my + oy - ay, ax, ay, aw, ah);
      // Poziom trudności wyprawy (przyciski 1-4) w prawym górnym rogu.
      const rx = MAP_X + MAP_W - 8;
      const open = tierOpen(ex);
      if (m.tiers) {
        drawText(g, open ? 'Difficulty [1-4, R/X]' : 'Difficulty (set for this act)', tierPos(0)[0] - 4, tierPos(0)[1] + 2, C.lavender, { align: 'right', ...SMALL });
        m.tiers.forEach((t, i) => {
          const [bx, by] = tierPos(i), on = i === (m.rarity ?? 0), rr = MAP_RARITY[i];
          // Poziom jeszcze niezdobyty (data/unlocks.ts): przygaszony, z opisem, jak go odblokować.
          if (i > (this.run.expedition!.maxTier ?? 3)) {
            r.withAlpha(0.5, () => r.roundRect(bx, by, TIER_W, TIER_H, UI.radius, C.black));
            drawText(g, `${i + 1} ${rr.name}`, bx + TIER_W / 2, by + 3.5, C.lavender, { align: 'center', ...SMALL });
            drawText(g, 'locked', bx + TIER_W / 2, by + TIER_H + 2, C.lavender, { align: 'center', ...SMALL });
            return;
          }
          // Akt w toku: poziom zablokowany (wybór tylko przed pierwszym węzłem aktu), inne poziomy przygaszone.
          if (!open && !on) {
            r.withAlpha(0.35, () => { r.roundRect(bx, by, TIER_W, TIER_H, UI.radius, C.black); r.roundFrame(bx, by, TIER_W, TIER_H, UI.radius, C.slate, 0.5); });
            drawText(g, `${i + 1} ${rr.name}`, bx + TIER_W / 2, by + 3.5, C.dgray, { align: 'center', ...SMALL });
            return;
          }
          const hot = open && hovered(bx, by, TIER_W, TIER_H);
          r.roundRect(bx, by, TIER_W, TIER_H, UI.radius, on ? C.navy : hot ? C.slate : C.black);
          r.roundFrame(bx, by, TIER_W, TIER_H, UI.radius, on || hot ? rr.color : C.slate, on ? 1 : 0.5);
          drawText(g, `${i + 1} ${rr.name}`, bx + TIER_W / 2, by + 3.5, on || hot ? rr.color : C.lavender, { align: 'center', ...SMALL });
          drawText(g, t.length ? `${t.length} mod.` : 'bez mod.', bx + TIER_W / 2, by + TIER_H + 2, C.lavender, { align: 'center', ...SMALL });
        });
      }
      // Bonus i nagroda pod przyciskami.
      if (m.bonus) {
        const b = MAP_BONUS_BY_ID[m.bonus];
        drawText(g, `Bonus: ${b.name}`, rx, y0 + 26, C.lime, { align: 'right' });
        wrapText(b.desc, 200 / SMALL.scale).forEach((l, i) => drawText(g, l, rx, y0 + 37 + i * 9, C.lgray, { align: 'right', ...SMALL }));
      }
      const rew = mapReward(m);
      if (rew > 0) drawText(g, `Nagroda: +${rew}% łupu i jakości, +${Math.round(rew * X.rewardEssence)}% esencji`, rx, y0 + 58, C.gold, { align: 'right', ...SMALL });
    } else {
      drawText(g, kind.name, x0 + 26, y0, kind.color, { shadow: C.black });
      if (this.peek) drawText(g, 'preview', x0 + 32 + textWidth(kind.name), y0, C.cyan);
      wrapText(kind.desc, 300).forEach((l, i) => drawText(g, l, x0 + 26, y0 + 12 + i * 11, C.lgray));
      drawText(g, `Głębokość ${depthAt(ex.act, drow)}`, MAP_X + MAP_W - 8, y0, C.lavender, { align: 'right' });
    }
  }

  /** Węzły leżące na jakiejkolwiek drodze z bieżącego węzła do (row, lane): klucze `rząd:kolumna`. */
  private routeTo(row: number, lane: number): Set<string> {
    const ex = this.run.expedition!, cur = exRow(ex), last = ex.map.length - 1;
    // Wprzód: osiągalne z bieżącego węzła; wstecz: z których da się dojść do celu.
    let fwd = new Set<number>(cur < 0 ? ex.map[0].map((n, l) => (n ? l : -1)).filter((l) => l >= 0) : [ex.path[cur]]);
    const reach: Set<number>[] = [];
    reach[Math.max(0, cur)] = fwd;
    for (let r = Math.max(0, cur) + 1; r <= row; r++) {
      const next = new Set<number>();
      ex.map[r].forEach((n, l) => { if (n && [...fwd].some((a) => linked(a, l, r === last))) next.add(l); });
      reach[r] = fwd = next;
    }
    const out = new Set<string>();
    if (!reach[row]?.has(lane)) return out;
    let back = new Set([lane]);
    out.add(`${row}:${lane}`);
    for (let r = row - 1; r >= Math.max(0, cur); r--) {
      const prev = new Set<number>();
      for (const l of reach[r]) if ([...back].some((b) => linked(l, b, r + 1 === last))) { prev.add(l); out.add(`${r}:${l}`); }
      back = prev;
    }
    return out;
  }

  /** Wybór obozu / kapliczki w panelu szczegółów: dwie karty z nazwą i opisem. */
  private renderOffer(r: Renderer): void {
    const g = r.g, offer = this.run.expedition!.offer!, rest = offer.kind === 'rest';
    const info = NODE_INFO[offer.kind], x0 = MAP_X + 8, y0 = DET_Y + 6;
    drawSprite(g, info.icon, x0 + 10, y0 + 10, { scale: 2 });
    drawText(g, rest ? 'Camp: pick a bonus for the next map' : 'Shrine: pick a blessing', x0 + 26, y0, info.color, { shadow: C.black });
    offer.ids.forEach((id, i) => {
      const n = offer.ids.length, OW = offerW(n);
      const b = (rest ? CAMP_BUFFS : EX_BLESSINGS).find((x) => x.id === id)!, [x, y] = offerPos(i, n), on = i === this.offerSel;
      r.roundRect(x, y, OW, OFFER_H, UI.radius, on ? C.navy : C.black);
      r.roundFrame(x, y, OW, OFFER_H, UI.radius, on ? info.color : C.slate, on ? 1 : 0.6);
      drawText(g, `${i + 1}. ${b.name}`, x + 6, y + 4, on ? info.color : C.lgray, { shadow: C.black });
      wrapText(b.desc, (OW - 12) / descS()).slice(0, 2).forEach((l, k) => drawText(g, l, x + 6, y + 16 + k * descLH(), C.lgray, DESC));
    });
    const note = rest ? 'Lasts one map with combat (dungeons do not use it up).' : `Lasts ${BAL.expedition.blessingMaps} maps with combat (dungeons count too).`;
    drawText(g, note, x0 + 26, DET_Y + 18 + OFFER_H + 4, C.lavender, SMALL);
  }

  /** Węzły do podglądu: dalsze rzędy oraz niedostępne węzły najbliższego rzędu (kolejno rzędami). */
  private previewable(next: number, lanes: number[]): [number, number][] {
    const out: [number, number][] = [];
    this.run.expedition!.map.forEach((cells, r) => {
      if (r < next) return;
      cells.forEach((k, l) => { if (k && (r > next || !lanes.includes(l))) out.push([r, l]); });
    });
    return out;
  }
}
