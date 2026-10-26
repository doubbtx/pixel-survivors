import { W, H } from '../core/renderer';
import { C } from '../core/palette';
import { drawText } from '../core/font';
import { sfx } from '../core/audio';
import { drawSprite } from '../gfx/sprites';
import { BAL } from '../data/balance';
import {
  BRANCHES, META_NODES, nodeCost, nodeUnlocked, nodeLine, paragonLevel, spentEssence, type MetaNode,
} from '../data/meta';
import { fmt } from '../util/format';
import type { App, Screen } from './app';
import { panel, inside } from './widgets';

const COL_W = 112, COL_X = 8, COL_STEP = 118;
const NODE_Y = 56, NODE_H = 30, NODE_STEP = 33;
const BRANCH_NODES = BRANCHES.map((b) => META_NODES.filter((n) => n.branch === b));

/**
 * Drzewko rozwoju (menu główne): 4 gałęzie po 5 węzłów kupowanych esencją. Węzeł wymaga poprzedniego
 * w gałęzi. Strzałki / mysz: wybór, Enter / klik: kup poziom, X: prestiż (dwa razy, potwierdzenie), Esc: wróć.
 */
export class MetaScreen implements Screen {
  private col = 0;
  private row = 0;
  private lastMouse = 0;
  private note = '';
  private noteT = 0;
  private confirmPrestige = false;

  constructor(private readonly app: App, private readonly back: Screen) {}

  private get meta() {
    return this.app.save.meta;
  }

  private node(): MetaNode {
    return BRANCH_NODES[this.col][this.row];
  }

  private say(s: string, ok: boolean): void {
    this.note = s;
    this.noteT = 2.5;
    sfx.play(ok ? 'levelup' : 'hurt');
  }

  private buy(n: MetaNode): void {
    const m = this.meta, lvl = m.nodes[n.id] ?? 0;
    if (lvl >= n.max) return this.say('Maksymalny poziom', false);
    if (!nodeUnlocked(m, n)) return this.say('Najpierw kup poprzedni węzeł w tej gałęzi', false);
    const cost = nodeCost(n, lvl);
    if (m.essence < cost) return this.say(`Potrzeba ${fmt(cost)} esencji`, false);
    m.essence -= cost;
    m.nodes[n.id] = lvl + 1;
    this.app.persist();
    this.say(`${n.name}: poziom ${lvl + 1}`, true);
  }

  private prestige(): void {
    const m = this.meta;
    if (spentEssence(m) < BAL.meta.prestigeCost) return this.say(`Prestiż od ${fmt(BAL.meta.prestigeCost)} wydanej esencji`, false);
    if (!this.confirmPrestige) { this.confirmPrestige = true; return this.say('Wciśnij jeszcze raz: drzewko i esencja się wyzerują', false); }
    m.prestige++;
    m.nodes = {};
    m.essence = 0;
    this.confirmPrestige = false;
    this.app.persist();
    this.say(`Prestiż ${m.prestige}!`, true);
  }

  private nodePos(c: number, r: number): [number, number] {
    return [COL_X + c * COL_STEP, NODE_Y + r * NODE_STEP];
  }

  update(dt: number): void {
    this.noteT = Math.max(0, this.noteT - dt);
    const inp = this.app.input;
    if (inp.pressed('back')) { this.app.go(this.back); return; }
    const rows = BRANCH_NODES[this.col].length;
    if (inp.pressed('left')) this.col = (this.col + BRANCHES.length - 1) % BRANCHES.length;
    if (inp.pressed('right')) this.col = (this.col + 1) % BRANCHES.length;
    if (inp.pressed('up')) this.row = (this.row + rows - 1) % rows;
    if (inp.pressed('down')) this.row = (this.row + 1) % rows;
    this.row = Math.min(this.row, BRANCH_NODES[this.col].length - 1);
    if (inp.pressed('confirm')) this.buy(this.node());
    if (inp.pressed('skip')) this.prestige();
    const m = inp.mouse;
    BRANCH_NODES.forEach((list, c) => list.forEach((n, r) => {
      const [x, y] = this.nodePos(c, r);
      if (!inside(m.x, m.y, x, y, COL_W, NODE_H)) return;
      if (m.lastMove !== this.lastMouse) { this.col = c; this.row = r; }
      if (inp.pressed('click')) { this.col = c; this.row = r; this.buy(n); }
    }));
    if (inp.pressed('click') && inside(m.x, m.y, W - 128, 238, 120, 16)) this.prestige();
    if (inp.pressed('click') && inside(m.x, m.y, 8, 238, 70, 16)) this.app.go(this.back);
    this.lastMouse = m.lastMove;
  }

  render(): void {
    const r = this.app.r, g = r.g, m = this.meta;
    r.clear(C.black);
    drawText(g, 'Rozwój', W / 2, 6, C.yellow, { align: 'center', scale: 2, outline: C.black });
    const par = paragonLevel(m.total);
    const bonusPct = Math.round((BAL.meta.paragonPct * par + BAL.meta.prestigePct * m.prestige) * 100);
    drawText(g, `Esencja: ${fmt(m.essence)}`, 10, 30, C.cyan, { shadow: C.black });
    drawText(g, `Paragon ${par}   Prestiż ${m.prestige}   (+${bonusPct}% obrażeń i maks. HP)`, W - 10, 30, C.pink, { align: 'right', shadow: C.black });
    BRANCH_NODES.forEach((list, c) => {
      const [bx] = this.nodePos(c, 0);
      drawText(g, BRANCHES[c], bx + COL_W / 2, 44, C.lavender, { align: 'center' });
      list.forEach((n, row) => {
        const [x, y] = this.nodePos(c, row);
        const lvl = m.nodes[n.id] ?? 0, open = nodeUnlocked(m, n), maxed = lvl >= n.max;
        const sel = c === this.col && row === this.row;
        const cost = nodeCost(n, lvl);
        panel(r, x, y, COL_W, NODE_H, sel ? C.yellow : maxed ? C.gold : lvl > 0 ? C.lavender : C.slate);
        if (open) drawSprite(g, n.icon, x + 13, y + 15);
        else r.withAlpha(0.3, () => drawSprite(g, n.icon, x + 13, y + 15));
        drawText(g, n.name, x + 25, y + 4, open ? C.white : C.dgray);
        drawText(g, `${lvl}/${n.max}`, x + COL_W - 6, y + 4, maxed ? C.gold : C.lgray, { align: 'right' });
        const costTxt = maxed ? 'MAX' : !open ? 'zablokowany' : `${fmt(cost)} esencji`;
        drawText(g, costTxt, x + 25, y + 15, maxed ? C.gold : !open ? C.dgray : m.essence >= cost ? C.cyan : C.salmon);
      });
    });
    // Opis zaznaczonego węzła.
    const n = this.node(), lvl = m.nodes[n.id] ?? 0;
    const now = lvl > 0 ? `Teraz: ${nodeLine(n, lvl)}` : 'Nie kupiony';
    const next = lvl < n.max ? `   Następny poziom: ${nodeLine(n, lvl + 1)}` : '';
    drawText(g, `${n.name}. ${now}${next}`, W / 2, 222, C.lgray, { align: 'center' });
    // Przyciski.
    panel(r, 8, 238, 70, 16, C.slate);
    drawText(g, 'Wróć', 43, 240, C.lgray, { align: 'center' });
    const canPrestige = spentEssence(m) >= BAL.meta.prestigeCost;
    panel(r, W - 128, 238, 120, 16, this.confirmPrestige ? C.red : canPrestige ? C.pink : C.slate);
    drawText(g, this.confirmPrestige ? 'Na pewno? [X]' : '[X] Prestiż', W - 68, 240, canPrestige ? C.white : C.dgray, { align: 'center' });
    drawText(g, 'Esencja: koniec każdego runu', W / 2, 238, C.dgray, { align: 'center' });
    drawText(g, `Prestiż od ${fmt(BAL.meta.prestigeCost)} wydanej`, W / 2, 248, C.dgray, { align: 'center' });
    if (this.noteT > 0) drawText(g, this.note, W / 2, H - 12, C.yellow, { align: 'center', outline: C.black });
  }
}
