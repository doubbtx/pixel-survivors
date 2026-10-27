import { W, H, type Renderer } from '../core/renderer';
import type { Input } from '../core/input';
import { C } from '../core/palette';
import { drawText, wrapText } from '../core/font';
import { sfx } from '../core/audio';
import { drawSprite } from '../gfx/sprites';
import { BAL } from '../data/balance';
import { BIOMES, objectiveLabel } from '../data/levels';
import { NODE_INFO, exRow, isCombat, levelAt, linked, nextLanes, depthAt } from '../data/expedition';
import type { Run } from '../game/run';
import { fmt } from '../util/format';
import { dim, panel, slot, inside } from './widgets';

const MAP_X = 12, MAP_Y = 40, MAP_W = W - 24, MAP_H = 150;
const NODE = 22;
const DET_Y = MAP_Y + MAP_H + 6;

/** Środek węzła (rząd, kolumna) na ekranie. */
function nodePos(row: number, lane: number): [number, number] {
  const step = (MAP_W - 70) / (BAL.expedition.rows - 1);
  return [MAP_X + 35 + row * step, MAP_Y + 30 + lane * 45];
}

export type MapAction = { pick: number } | 'inventory' | 'menu' | null;

/**
 * Mapa aktu Ekspedycji: rzędy węzłów od lewej do prawej, ścieżki między sąsiednimi kolumnami,
 * przebyta droga na złoto. Strzałki / mysz: wybór dostępnego węzła, Enter / klik: idź, I: ekwipunek, Esc: menu.
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
    drawText(g, `Ekspedycja - akt ${ex.act}/${X.acts}`, W / 2, 8, C.yellow, { align: 'center', scale: 2, outline: C.black });
    panel(r, MAP_X, MAP_Y, MAP_W, MAP_H, C.gold);
    const biome = BIOMES[(ex.act - 1) % BIOMES.length];
    drawText(g, biome.name, MAP_X + 10, MAP_Y + 6, C.lavender);
    drawText(g, `ukończone węzły ${ex.cleared}   złoto ${fmt(run.gold)}   HP ${fmt(run.player.hp)}/${fmt(run.stats.maxHp)}`, MAP_X + MAP_W - 10, MAP_Y + 6, C.lgray, { align: 'right' });

    const cur = exRow(ex);
    const lanes = this.lanes;
    const target = lanes[this.sel];
    // Ścieżki: złote na przebytej drodze, jaśniejsze do dostępnych węzłów.
    for (let row = 0; row < ex.map.length - 1; row++) {
      ex.map[row].forEach((k, a) => {
        if (!k) return;
        ex.map[row + 1].forEach((k2, b) => {
          if (!k2 || !linked(a, b)) return;
          const [x0, y0] = nodePos(row, a), [x1, y1] = nodePos(row + 1, b);
          const walked = ex.path[row] === a && ex.path[row + 1] === b;
          const open = row === cur && ex.path[row] === a && lanes.includes(b);
          r.line(x0, y0, x1, y1, walked ? C.gold : open ? (b === target ? C.yellow : C.lavender) : C.slate);
        });
      });
    }
    // Węzły.
    const t = performance.now() / 1000;
    ex.map.forEach((cells, row) => cells.forEach((k, lane) => {
      if (!k) return;
      const info = NODE_INFO[k];
      const [x, y] = nodePos(row, lane);
      const reachable = row === cur + 1 && lanes.includes(lane);
      const picked = lane === target && reachable;
      const visited = ex.path[row] === lane;
      const bob = picked ? Math.round(Math.sin(t * 6)) : 0;
      const draw = () => {
        slot(r, x - NODE / 2, y - NODE / 2 + bob, NODE, picked ? C.yellow : visited ? C.gold : reachable ? info.color : C.slate);
        drawSprite(g, info.icon, x, y + bob);
      };
      if (row < cur + 1 && !visited || row > cur + 1 || (row === cur + 1 && !reachable)) r.withAlpha(0.45, draw);
      else draw();
      if (row === cur && visited) drawSprite(g, `${run.hero.sprite}@0`, x, y - 20);
    }));
    if (cur < 0) drawText(g, 'Start', nodePos(0, 1)[0] - 30, nodePos(0, 1)[1] - 4, C.lavender, { align: 'center' });

    // Szczegóły zaznaczonego węzła.
    panel(r, MAP_X, DET_Y, MAP_W, H - DET_Y - 6);
    if (target !== undefined) {
      const kind = ex.map[cur + 1][target]!;
      const info = NODE_INFO[kind];
      drawSprite(g, info.icon, MAP_X + 20, DET_Y + 18, { scale: 2 });
      drawText(g, info.name, MAP_X + 40, DET_Y + 8, info.color, { shadow: C.black });
      wrapText(info.desc, 250).forEach((l, i) => drawText(g, l, MAP_X + 40, DET_Y + 21 + i * 11, C.lgray));
      const lines = isCombat(kind)
        ? (() => { const lv = levelAt(ex.act, cur + 1, kind); return [`Cel: ${objectiveLabel(lv.objective)}`, lv.boss ? `potem ${lv.bossName}` : '', `Głębokość ${lv.depth}`]; })()
        : [`Głębokość ${depthAt(ex.act, cur + 1)}`];
      lines.filter(Boolean).forEach((l, i) => drawText(g, l, MAP_X + MAP_W - 10, DET_Y + 8 + i * 11, i === 0 ? C.white : C.lavender, { align: 'right' }));
    }
    drawText(g, 'Strzałki: wybór   Enter/klik: idź   I: ekwipunek   Esc: menu', W / 2, H - 18, C.dgray, { align: 'center' });
  }
}
