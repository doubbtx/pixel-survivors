import { W, H, type Renderer } from '../core/renderer';
import type { Input } from '../core/input';
import { C } from '../core/palette';
import { drawText, wrapText, textWidth, DESC, descS, descLH } from '../core/font';
import { sfx } from '../core/audio';
import { drawSprite } from '../gfx/sprites';
import { BAL } from '../data/balance';
import { BIOMES, objectiveLabel } from '../data/levels';
import { BIOME_WAVES } from '../data/waves';
import { ENEMIES, BIOME_MINIBOSS } from '../data/enemies';
import {
  NODE_INFO, actBiome, chooseTier, MAP_RARITY, MAP_MOD_BY_ID, MAP_BONUS_BY_ID, EX_BLESSINGS, CAMP_BUFFS, exRow, isCombat, levelAt, linked, nextLanes, depthAt, mapReward,
  type MapNode, type NodeKind,
} from '../data/expedition';
import type { Run } from '../game/run';
import { fmt } from '../util/format';
import { panel, inside, hovered, button, Scroll } from './widgets';
import { tile, iconSlot, UI } from './theme';
import { CHUNK, groundChunk, groundBase, groundFrame } from '../gfx/ground';

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
const LEGEND: NodeKind[] = ['fight', 'elite', 'dungeon', 'treasure', 'shop', 'anvil', 'rest', 'shrine', 'boss'];

/** Przyciski poziomu trudności w prawym górnym rogu panelu szczegółów (lewy górny róg przycisku). */
const TIER_W = 50, TIER_H = 14;
/** Lista modyfikatorów w panelu mapy (x, y, w, h): pod nazwą mapy, do przycisków. */
const MODS_AREA = [MAP_X + 8, DET_Y + 38, 250, BTN_Y - DET_Y - 40] as const;
const tierPos = (i: number): [number, number] => [MAP_X + MAP_W - 8 - (4 - i) * (TIER_W + 3) + 3, DET_Y + 6];
/** Mały tekst panelu szczegółów. */
const SMALL = { scale: 0.75 } as const;

/** Środek węzła (rząd, kolumna) na ekranie. */
function nodePos(row: number, lane: number): [number, number] {
  const X = BAL.expedition;
  const step = (MAP_W - 60) / (X.rows - 1);
  return [MAP_X + 30 + row * step, MAP_Y + 34 + lane * ((MAP_H - 50) / (X.lanes - 1))];
}

export type MapAction = { pick: number } | 'inventory' | 'menu' | null;

/** Kolor ramki węzła: rzadkość mapy (z walką) albo kolor rodzaju węzła. */
const nodeColor = (m: MapNode) => (isCombat(m.kind) && m.kind !== 'boss' && m.rarity ? MAP_RARITY[m.rarity].color : NODE_INFO[m.kind].color);

/**
 * Mapa aktu Ekspedycji: rzędy węzłów od lewej do prawej, ścieżki między sąsiednimi kolumnami, przebyta droga na złoto.
 * Mapy z walką mają rzadkość (kolor ramki), modyfikatory ryzyka z nagrodą i bonus — szczegóły na dole.
 * Strzałki / mysz: wybór dostępnego węzła, Enter / klik: idź, I: ekwipunek, Esc: menu.
 */
export class ExpeditionMapView {
  private sel = 0;
  private lastMouse = 0;
  /** Przewijanie listy modyfikatorów zaznaczonej mapy (zerowane przy zmianie zaznaczenia). */
  private modScroll = new Scroll();
  private modKey = '';

  /** `onTier`: gracz zmienił poziom trudności (zapamiętanie na następne wyprawy). */
  constructor(private readonly run: Run, private readonly onTier: (tier: number) => void) {}

  private get lanes(): number[] {
    return nextLanes(this.run.expedition!);
  }

  update(input: Input): MapAction {
    const lanes = this.lanes;
    this.modScroll.update(input, ...MODS_AREA);
    const n = lanes.length;
    if (input.pressed('back') || input.pressed('pause')) return 'menu';
    if (input.pressed('inventory')) return 'inventory';
    if (n === 0) return null;
    this.sel = Math.min(this.sel, n - 1);
    if (input.pressed('up') || input.pressed('left')) { this.sel = (this.sel - 1 + n) % n; sfx.play('select'); }
    if (input.pressed('down') || input.pressed('right')) { this.sel = (this.sel + 1) % n; sfx.play('select'); }
    const m = input.mouse;
    const row = exRow(this.run.expedition!) + 1;
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
    r.withAlpha(0.82, () => r.rect(0, 0, W, H, C.black));
    const secretAct = ex.act > X.acts;
    drawText(g, secretAct ? 'Ekspedycja - akt 4: Pustka' : `Ekspedycja - akt ${ex.act}/${X.acts}`, W / 2, 4, secretAct ? C.hotpink : C.yellow, { align: 'center', scale: 2, outline: C.black });
    // Lewa strona nagłówka: biom aktu i postęp aktów (kropki).
    const biomeId = actBiome(ex.act), biome = BIOMES[biomeId];
    for (let k = 0; k < X.acts; k++) r.roundRect(MAP_X + 2 + k * 8, 10, 6, 6, 1, k < ex.act - 1 ? C.gold : k === ex.act - 1 ? C.yellow : C.slate);
    const bname = ex.voidKey && !secretAct ? `${biome.name}   Klucz Pustki` : biome.name, bx = MAP_X + 4 + X.acts * 8;
    drawText(g, bname, bx, 6, ex.voidKey ? C.hotpink : C.lavender);
    // Ukończone mapy: plakietka obok nazwy biomu.
    const mt = `mapy ${ex.cleared}`, mw = textWidth(mt) * 0.75 + 8, mx = bx + textWidth(bname) + 5;
    tile(r, mx, 7, mw, 10, C.lgray);
    drawText(g, mt, mx + mw / 2, 7.5, C.lgray, { align: 'center', scale: 0.75 });
    // Prawa strona nagłówka: plakietki stanu wyprawy.
    const bless = ex.blessing ? EX_BLESSINGS.find((b) => b.id === ex.blessing!.id) : null;
    // Esencja: nagrody modyfikatorów ukończonych map zwiększają esencję na koniec wyprawy (BAL.expedition.rewardEssence).
    const essence = Math.round(ex.bonus * X.rewardEssence);
    const chips: [string, number, string?][] = [
      [`HP ${fmt(run.player.hp)}/${fmt(run.stats.maxHp)}`, C.salmon], [`złoto ${fmt(run.gold)}`, C.gold],
      [`esencja +${essence}%`, C.cyan, 'Nagrody za modyfikatory ukończonych map. Na koniec wyprawy dostaniesz tyle więcej esencji do Rozwoju.'],
    ];
    if (bless) chips.push([`${bless.name} (${ex.blessing!.maps})`, C.yellow]);
    const camp = ex.camp ? CAMP_BUFFS.find((b) => b.id === ex.camp) : null;
    if (camp) chips.push([`${camp.name} (1)`, C.lime, `Camp bonus for the next fight: ${camp.desc}.`]);
    let cx = MAP_X + MAP_W, tip: { text: string; x: number } | null = null;
    for (const [t, col, help] of chips) {
      const w = textWidth(t) * 0.75 + 8;
      cx -= w;
      if (cx < W / 2 + 90) break;
      tile(r, cx, 7, w, 10, col);
      drawText(g, t, cx + w / 2, 7.5, col, { align: 'center', scale: 0.75 });
      if (help && hovered(cx, 7, w, 10)) tip = { text: help, x: cx + w };
      cx -= 3;
    }

    // Mapa: tło z podłoża biomu aktu (ten sam generator co w grze), przygaszone.
    panel(r, MAP_X, MAP_Y, MAP_W, MAP_H, C.gold);
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
    for (const k of LEGEND) {
      const info = NODE_INFO[k];
      r.withAlpha(0.8, () => drawSprite(g, info.icon, lx + 5, MAP_Y + 9));
      drawText(g, info.name, lx + 14, MAP_Y + 5, info.color, { scale: 0.75, outline: C.black });
      lx += 19 + textWidth(info.name) * 0.75;
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
    // Ścieżki: złote na przebytej drodze, jaśniejsze do dostępnych węzłów.
    for (let row = 0; row < last; row++) {
      ex.map[row].forEach((k, a) => {
        if (!k) return;
        ex.map[row + 1].forEach((k2, b) => {
          if (!k2 || !linked(a, b, row + 1 === last)) return;
          const [x0, y0] = nodePos(row, a), [x1, y1] = nodePos(row + 1, b);
          const walked = ex.path[row] === a && ex.path[row + 1] === b;
          const open = row === cur && ex.path[row] === a && lanes.includes(b);
          const col = walked ? C.gold : open ? (b === target ? C.yellow : C.lavender) : C.dgray;
          r.withAlpha(walked || open ? 1 : 0.6, () => { r.line(x0, y0 + 1, x1, y1 + 1, C.black, 2); r.line(x0, y0, x1, y1, col, walked || b === target && open ? 2 : 1); });
        });
      });
    }
    // Węzły.
    const t = performance.now() / 1000;
    ex.map.forEach((cells, row) => cells.forEach((m, lane) => {
      if (!m) return;
      const [x, y] = nodePos(row, lane);
      const reachable = row === cur + 1 && lanes.includes(lane);
      if (reachable) hovered(x - NODE / 2, y - NODE / 2, NODE, NODE);
      const picked = lane === target && reachable;
      const visited = ex.path[row] === lane;
      const bob = picked ? Math.round(Math.sin(t * 6)) : 0;
      const draw = () => {
        // Dostępne węzły: delikatny puls ramki; wybrany: biała ramka i podpis rodzaju.
        if (reachable && !picked) r.withAlpha(0.25 + 0.2 * Math.sin(t * 4 + lane), () => r.roundRect(x - NODE / 2 - 2, y - NODE / 2 - 2, NODE + 4, NODE + 4, UI.radius + 1, nodeColor(m)));
        iconSlot(r, x - NODE / 2, y - NODE / 2 + bob, NODE, picked ? C.white : visited ? C.gold : nodeColor(m), 0.8);
        drawSprite(g, NODE_INFO[m.kind].icon, x, y + bob);
        if (picked) {
          const nm = NODE_INFO[m.kind].name, w = textWidth(nm) * 0.75 + 6;
          tile(r, x - w / 2, y + NODE / 2 + 3, w, 8, C.white, 0.85);
          drawText(g, nm, x, y + NODE / 2 + 3, C.white, { align: 'center', scale: 0.75 });
        }
        // Liczba modyfikatorów mapy: kropki pod węzłem.
        if (!picked) for (let k = 0; k < (m.mods?.length ?? 0); k++) r.rect(x - 8 + k * 3, y + NODE / 2 + 1 + bob, 2, 2, C.salmon);
      };
      if ((row <= cur && !visited) || row > cur + 1 || (row === cur + 1 && !reachable)) r.withAlpha(0.45, draw);
      else draw();
      if (row === cur && visited) drawSprite(g, `${run.heroSprite}@0`, x, y - 18);
    }));

    // Szczegóły zaznaczonego węzła i przyciski.
    panel(r, MAP_X, DET_Y, MAP_W, H - DET_Y - 4);
    BTNS.forEach((b, i) => button(r, btnX(i), BTN_Y, b.w, BTN_H, b.label, b.act === 'go' ? { accent: C.gold, col: C.yellow, pulse: target !== undefined, scale: 0.75 } : { scale: 0.75 }));
    if (target === undefined) return;
    const m = ex.map[cur + 1][target]!;
    const kind = NODE_INFO[m.kind];
    const key = `${ex.act}:${cur}:${target}:${m.rarity ?? 0}`;
    if (key !== this.modKey) { this.modKey = key; this.modScroll.reset(); }
    const x0 = MAP_X + 8, y0 = DET_Y + 6;
    drawSprite(g, kind.icon, x0 + 10, y0 + 10, { scale: 2 });
    if (isCombat(m.kind)) {
      const lv = levelAt(ex.act, cur + 1, m);
      const rar = MAP_RARITY[m.rarity ?? 0];
      drawText(g, m.name ?? kind.name, x0 + 26, y0, m.kind === 'boss' ? kind.color : rar.color, { shadow: C.black });
      drawText(g, m.kind === 'boss' ? `${kind.name}: ${lv.bossName}` : `${kind.name}, ${rar.name.toLowerCase()}`, x0 + 26, y0 + 11, C.lavender);
      const goal = lv.dungeon ? `Fale lochu: ${BAL.events.dungeonWaves}` : `Cel: ${objectiveLabel(lv.objective)}`;
      drawText(g, `${goal}   głębokość ${lv.depth}`, x0 + 26, y0 + 22, C.lgray);
      // Modyfikatory (ryzyko) po lewej: „nazwa: opis” zawijane, przewijane przy wielu modyfikatorach albo dużym tekście.
      const mods = (m.mods ?? []).map((id) => MAP_MOD_BY_ID[id]);
      const [ax, ay, aw, ah] = MODS_AREA, lh = descLH(), oy = this.modScroll.begin(r, ax, ay, aw, ah);
      let my = ay + 1 - oy;
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
      if (m.tiers) {
        drawText(g, 'Difficulty [1-4, R/X]', tierPos(0)[0] - 4, tierPos(0)[1] + 2, C.lavender, { align: 'right', ...SMALL });
        m.tiers.forEach((t, i) => {
          const [bx, by] = tierPos(i), on = i === (m.rarity ?? 0), rr = MAP_RARITY[i];
          // Poziom jeszcze niezdobyty (data/unlocks.ts): przygaszony, z opisem, jak go odblokować.
          if (i > (this.run.expedition!.maxTier ?? 3)) {
            r.withAlpha(0.5, () => r.roundRect(bx, by, TIER_W, TIER_H, UI.radius, C.black));
            drawText(g, `${i + 1} ${rr.name}`, bx + TIER_W / 2, by + 3.5, C.lavender, { align: 'center', ...SMALL });
            drawText(g, 'locked', bx + TIER_W / 2, by + TIER_H + 2, C.lavender, { align: 'center', ...SMALL });
            return;
          }
          const hot = hovered(bx, by, TIER_W, TIER_H);
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
      wrapText(kind.desc, 300).forEach((l, i) => drawText(g, l, x0 + 26, y0 + 12 + i * 11, C.lgray));
      drawText(g, `Głębokość ${depthAt(ex.act, cur + 1)}`, MAP_X + MAP_W - 8, y0, C.lavender, { align: 'right' });
    }
  }
}
