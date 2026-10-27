import { W, H, type Renderer } from '../core/renderer';
import type { Input } from '../core/input';
import { C } from '../core/palette';
import { drawText, wrapText } from '../core/font';
import { sfx } from '../core/audio';
import { drawSprite } from '../gfx/sprites';
import { BAL } from '../data/balance';
import { BIOMES, objectiveLabel } from '../data/levels';
import {
  NODE_INFO, MAP_RARITY, MAP_MOD_BY_ID, MAP_BONUS_BY_ID, EX_BLESSINGS, exRow, isCombat, levelAt, linked, nextLanes, depthAt, mapReward,
  type MapNode,
} from '../data/expedition';
import type { Run } from '../game/run';
import { fmt } from '../util/format';
import { dim, panel, slot, inside } from './widgets';

const MAP_X = 8, MAP_Y = 30, MAP_W = W - 16, MAP_H = 136;
const NODE = 20;
const DET_Y = MAP_Y + MAP_H + 4;

/** Środek węzła (rząd, kolumna) na ekranie. */
function nodePos(row: number, lane: number): [number, number] {
  const X = BAL.expedition;
  const step = (MAP_W - 60) / (X.rows - 1);
  return [MAP_X + 30 + row * step, MAP_Y + 30 + lane * ((MAP_H - 44) / (X.lanes - 1))];
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

  constructor(private readonly run: Run) {}

  private get lanes(): number[] {
    return nextLanes(this.run.expedition!);
  }

  update(input: Input): MapAction {
    const lanes = this.lanes;
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
      if (input.pressed('click')) { this.sel = i; return { pick: lanes[i] }; }
    }
    this.lastMouse = m.lastMove;
    if (input.pressed('confirm')) return { pick: lanes[this.sel] };
    return null;
  }

  render(r: Renderer): void {
    const g = r.g, run = this.run, ex = run.expedition!;
    const X = BAL.expedition;
    dim(r);
    drawText(g, `Ekspedycja - akt ${ex.act}/${X.acts}`, W / 2, 6, C.yellow, { align: 'center', scale: 2, outline: C.black });
    drawText(g, 'Enter/klik: idź   I: plecak', W - 8, 4, C.dgray, { align: 'right' });
    drawText(g, 'Esc: menu (zapis)', W - 8, 15, C.dgray, { align: 'right' });
    panel(r, MAP_X, MAP_Y, MAP_W, MAP_H, C.gold);
    const biome = BIOMES[(ex.act - 1) % BIOMES.length];
    drawText(g, biome.name, MAP_X + 8, MAP_Y + 5, C.lavender);
    const bless = ex.blessing ? EX_BLESSINGS.find((b) => b.id === ex.blessing!.id) : null;
    const info = [`mapy ${ex.cleared}`, `łup +${ex.bonus}%`, `złoto ${fmt(run.gold)}`, `HP ${fmt(run.player.hp)}/${fmt(run.stats.maxHp)}`];
    if (bless) info.unshift(`${bless.name} (${ex.blessing!.maps})`);
    drawText(g, info.join('   '), MAP_X + MAP_W - 8, MAP_Y + 5, C.lgray, { align: 'right' });

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
          r.line(x0, y0, x1, y1, walked ? C.gold : open ? (b === target ? C.yellow : C.lavender) : C.slate);
        });
      });
    }
    // Węzły.
    const t = performance.now() / 1000;
    ex.map.forEach((cells, row) => cells.forEach((m, lane) => {
      if (!m) return;
      const [x, y] = nodePos(row, lane);
      const reachable = row === cur + 1 && lanes.includes(lane);
      const picked = lane === target && reachable;
      const visited = ex.path[row] === lane;
      const bob = picked ? Math.round(Math.sin(t * 6)) : 0;
      const draw = () => {
        slot(r, x - NODE / 2, y - NODE / 2 + bob, NODE, picked ? C.white : visited ? C.gold : nodeColor(m));
        drawSprite(g, NODE_INFO[m.kind].icon, x, y + bob);
        // Liczba modyfikatorów mapy: kropki pod węzłem.
        for (let k = 0; k < (m.mods?.length ?? 0); k++) r.rect(x - 7 + k * 4, y + NODE / 2 + 1 + bob, 3, 2, C.salmon);
      };
      if ((row <= cur && !visited) || row > cur + 1 || (row === cur + 1 && !reachable)) r.withAlpha(0.45, draw);
      else draw();
      if (row === cur && visited) drawSprite(g, `${run.hero.sprite}@0`, x, y - 18);
    }));
    if (cur < 0) drawText(g, 'Start', MAP_X + 8, MAP_Y + MAP_H - 14, C.lavender);

    // Szczegóły zaznaczonego węzła.
    panel(r, MAP_X, DET_Y, MAP_W, H - DET_Y - 4);
    if (target === undefined) return;
    const m = ex.map[cur + 1][target]!;
    const kind = NODE_INFO[m.kind];
    const x0 = MAP_X + 8, y0 = DET_Y + 6;
    drawSprite(g, kind.icon, x0 + 10, y0 + 10, { scale: 2 });
    if (isCombat(m.kind)) {
      const lv = levelAt(ex.act, cur + 1, m);
      const rar = MAP_RARITY[m.rarity ?? 0];
      drawText(g, m.name ?? kind.name, x0 + 26, y0, m.kind === 'boss' ? kind.color : rar.color, { shadow: C.black });
      drawText(g, m.kind === 'boss' ? `${kind.name}: ${lv.bossName}` : `${kind.name}, ${rar.name.toLowerCase()}`, x0 + 26, y0 + 11, C.lavender);
      const goal = lv.dungeon ? `Fale lochu: ${BAL.events.dungeonWaves}` : `Cel: ${objectiveLabel(lv.objective)}`;
      drawText(g, `${goal}   głębokość ${lv.depth}`, x0 + 26, y0 + 22, C.lgray);
      // Modyfikatory (ryzyko) po lewej, bonus i nagroda po prawej.
      const mods = (m.mods ?? []).map((id) => MAP_MOD_BY_ID[id]);
      mods.forEach((mod, i) => drawText(g, `${mod.name}: ${mod.desc}`, x0, y0 + 36 + i * 10, C.salmon));
      if (!mods.length) drawText(g, 'Bez modyfikatorów', x0, y0 + 36, C.dgray);
      const rx = MAP_X + MAP_W - 8;
      if (m.bonus) {
        const b = MAP_BONUS_BY_ID[m.bonus];
        drawText(g, `Bonus: ${b.name}`, rx, y0, C.lime, { align: 'right' });
        wrapText(b.desc, 170).forEach((l, i) => drawText(g, l, rx, y0 + 11 + i * 10, C.lgray, { align: 'right' }));
      }
      const rew = mapReward(m);
      if (rew > 0) drawText(g, `Nagroda: +${rew}% łupu i jakości, +${Math.round(rew * X.rewardEssence)}% esencji`, rx, y0 + 66, C.gold, { align: 'right' });
    } else {
      drawText(g, kind.name, x0 + 26, y0, kind.color, { shadow: C.black });
      wrapText(kind.desc, 300).forEach((l, i) => drawText(g, l, x0 + 26, y0 + 12 + i * 11, C.lgray));
      drawText(g, `Głębokość ${depthAt(ex.act, cur + 1)}`, MAP_X + MAP_W - 8, y0, C.lavender, { align: 'right' });
    }
  }
}
