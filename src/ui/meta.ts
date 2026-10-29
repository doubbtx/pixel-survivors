import { tr } from '../core/i18n';
import { W, H } from '../core/renderer';
import { C } from '../core/palette';
import { drawText } from '../core/font';
import { sfx } from '../core/audio';
import { drawSprite } from '../gfx/sprites';
import { BAL } from '../data/balance';
import { HEROES } from '../data/heroes';
import {
  heroMeta, heroTree, treeBranches, nodeCost, nodeUnlocked, prevNode, unlockLevel, nodeLine, paragonLevel, spentEssence, type MetaNode,
} from '../data/meta';
import { fmt } from '../util/format';
import type { App, Screen } from './app';
import { button, panel, inside } from './widgets';

const COL_W = 90, COL_X = 6, COL_STEP = 94;
const NODE_Y = 66, NODE_H = 28, NODE_STEP = 30;
const TAB_Y = 24, TAB_W = 62;
const BTN_Y = 240;

/**
 * Rozwój bohaterów (Ekspedycja i Endless): zakładka bohatera (Q/E albo klik), 4 gałęzie tematyczne + Wyprawa.
 * Węzeł wymaga poprzedniego w gałęzi; ostatni węzeł gałęzi tematycznej to klucz zmieniający umiejętność.
 * Strzałki / mysz: wybór, Enter / klik: kup poziom, B: przydziel pulę esencji (z migracji) temu bohaterowi,
 * X: prestiż bohatera (dwa razy, potwierdzenie), Esc: wróć.
 */
export class MetaScreen implements Screen {
  private hero = 0;
  private col = 0;
  private row = 0;
  private lastMouse = 0;
  private note = '';
  private noteT = 0;
  private confirmPrestige = false;

  /** `heroId`: otwarta zakładka bohatera (domyślnie ostatnio grany). */
  constructor(private readonly app: App, private readonly back: Screen, heroId = app.save.lastHero) {
    this.hero = Math.max(0, HEROES.findIndex((h) => h.id === heroId));
  }

  private get heroId(): string {
    return HEROES[this.hero].id;
  }

  private get hm() {
    return heroMeta(this.app.save.meta, this.heroId);
  }

  private get tree(): MetaNode[] {
    return heroTree(this.heroId);
  }

  private columns(): MetaNode[][] {
    const tree = this.tree;
    return treeBranches(this.heroId).map((b) => tree.filter((n) => n.branch === b));
  }

  private say(s: string, ok: boolean): void {
    this.note = s;
    this.noteT = 2.5;
    sfx.play(ok ? 'levelup' : 'hurt');
  }

  private buy(n: MetaNode): void {
    const h = this.hm, lvl = h.nodes[n.id] ?? 0;
    if (lvl >= n.max) return this.say('Maksymalny poziom', false);
    if (!nodeUnlocked(h, this.tree, n)) {
      const prev = prevNode(this.tree, n)!;
      return this.say(`Najpierw rozwiń ${prev.name} do ${unlockLevel(prev)}/${prev.max}`, false);
    }
    const cost = nodeCost(n, lvl);
    if (h.essence < cost) return this.say(`Potrzeba ${fmt(cost)} esencji`, false);
    h.essence -= cost;
    h.nodes[n.id] = lvl + 1;
    this.app.persist();
    this.say(`${n.name}: poziom ${lvl + 1}`, true);
  }

  /** Przenosi całą pulę esencji (zwrot z dawnego wspólnego drzewka) do wybranego bohatera. */
  private assign(): void {
    const m = this.app.save.meta;
    if (m.unassigned <= 0) return this.say('Brak esencji do rozdania', false);
    const h = this.hm;
    h.essence += m.unassigned;
    h.total += Math.max(m.unassigned, m.legacy ?? 0);
    m.legacy = 0;
    this.say(`+${fmt(m.unassigned)} esencji dla: ${HEROES[this.hero].name}`, true);
    m.unassigned = 0;
    this.app.persist();
  }

  private prestige(): void {
    const h = this.hm;
    if (spentEssence(h, this.tree) < BAL.meta.prestigeCost) return this.say(`Prestiż od ${fmt(BAL.meta.prestigeCost)} wydanej esencji`, false);
    if (!this.confirmPrestige) { this.confirmPrestige = true; return this.say('Wciśnij jeszcze raz: drzewko i esencja bohatera się wyzerują', false); }
    h.prestige++;
    h.nodes = {};
    h.essence = 0;
    this.confirmPrestige = false;
    this.app.persist();
    this.say(`Prestiż ${h.prestige}!`, true);
  }

  private nodePos(c: number, r: number): [number, number] {
    return [COL_X + c * COL_STEP, NODE_Y + r * NODE_STEP];
  }

  private switchHero(d: number): void {
    this.hero = (this.hero + d + HEROES.length) % HEROES.length;
    this.confirmPrestige = false;
    sfx.play('select');
  }

  update(dt: number): void {
    this.noteT = Math.max(0, this.noteT - dt);
    const inp = this.app.input;
    if (inp.pressed('back')) { this.app.go(this.back); return; }
    if (inp.pressed('q')) this.switchHero(-1);
    if (inp.pressed('e')) this.switchHero(1);
    const cols = this.columns();
    this.col = Math.min(this.col, cols.length - 1);
    const rows = cols[this.col].length;
    if (inp.pressed('left')) this.col = (this.col + cols.length - 1) % cols.length;
    if (inp.pressed('right')) this.col = (this.col + 1) % cols.length;
    if (inp.pressed('up')) this.row = (this.row + rows - 1) % rows;
    if (inp.pressed('down')) this.row = (this.row + 1) % rows;
    this.row = Math.min(this.row, cols[this.col].length - 1);
    if (inp.pressed('confirm')) this.buy(cols[this.col][this.row]);
    if (inp.pressed('skip')) this.prestige();
    if (inp.pressed('banish')) this.assign();
    const m = inp.mouse;
    cols.forEach((list, c) => list.forEach((n, r) => {
      const [x, y] = this.nodePos(c, r);
      if (!inside(m.x, m.y, x, y, COL_W, NODE_H)) return;
      if (m.lastMove !== this.lastMouse) { this.col = c; this.row = r; }
      if (inp.pressed('click')) { this.col = c; this.row = r; this.buy(n); }
    }));
    if (inp.pressed('click')) {
      HEROES.forEach((_, i) => { if (inside(m.x, m.y, 8 + i * (TAB_W + 4), TAB_Y, TAB_W, 14) && i !== this.hero) this.switchHero(i - this.hero); });
      if (inside(m.x, m.y, W - 128, BTN_Y, 120, 16)) this.prestige();
      if (inside(m.x, m.y, 8, BTN_Y, 70, 16)) this.app.go(this.back);
      if (inside(m.x, m.y, W / 2 - 80, BTN_Y, 160, 16)) this.assign();
    }
    this.lastMouse = m.lastMove;
  }

  render(): void {
    const r = this.app.r, g = r.g, h = this.hm, tree = this.tree, meta = this.app.save.meta;
    r.clear(C.black);
    drawText(g, 'Rozwój', W / 2, 4, C.yellow, { align: 'center', scale: 2, outline: C.black });
    drawText(g, 'Q / E: bohater', W - 10, 8, C.lavender, { align: 'right' });
    // Zakładki bohaterów.
    HEROES.forEach((hero, i) => {
      const x = 8 + i * (TAB_W + 4), on = i === this.hero;
      button(r, x, TAB_Y, TAB_W, 14, hero.name, { active: on, accent: hero.color });
    });
    const par = paragonLevel(h.total);
    const bonusPct = Math.round((BAL.meta.paragonPct * par + BAL.meta.prestigePct * h.prestige) * 100);
    drawText(g, `Esencja: ${fmt(h.essence)}`, 10, 42, C.cyan, { shadow: C.black });
    drawText(g, `Paragon ${par}   Prestiż ${h.prestige}   (+${bonusPct}% obrażeń i maks. HP)`, W - 10, 42, C.pink, { align: 'right', shadow: C.black });
    this.columns().forEach((list, c) => {
      const [bx] = this.nodePos(c, 0);
      drawText(g, list[0].branch, bx + COL_W / 2, 54, C.lavender, { align: 'center' });
      list.forEach((n, row) => {
        const [x, y] = this.nodePos(c, row);
        const lvl = h.nodes[n.id] ?? 0, open = nodeUnlocked(h, tree, n), maxed = lvl >= n.max;
        const sel = c === this.col && row === this.row;
        const cost = nodeCost(n, lvl);
        panel(r, x, y, COL_W, NODE_H, sel ? C.yellow : maxed ? C.gold : n.key ? C.pink : lvl > 0 ? C.lavender : C.slate);
        if (open) drawSprite(g, n.icon, x + 12, y + 14);
        else r.withAlpha(0.3, () => drawSprite(g, n.icon, x + 12, y + 14));
        drawText(g, n.name, x + 22, y + 3, open ? (n.key ? C.pink : C.white) : C.lavender);
        if (n.max > 1) drawText(g, `${lvl}/${n.max}`, x + COL_W - 5, y + 14, maxed ? C.gold : C.lgray, { align: 'right' });
        // Zablokowany węzeł: ile poziomów poprzedniego jeszcze potrzeba (połowa jego maksimum).
        const prev = prevNode(tree, n);
        const costTxt = maxed ? 'MAX' : !open && prev ? `wymaga ${unlockLevel(prev)}/${prev.max}` : fmt(cost);
        drawText(g, costTxt, x + 22, y + 14, maxed ? C.gold : !open ? C.lavender : h.essence >= cost ? C.cyan : C.salmon);
      });
    });
    // Opis zaznaczonego węzła.
    const n = this.columns()[this.col][this.row], lvl = h.nodes[n.id] ?? 0, prev = prevNode(tree, n);
    // Kawałki tłumaczone osobno (nazwy i opisy węzłów bywają po polsku albo po angielsku — 0.32 Takezo).
    const lock = !nodeUnlocked(h, tree, n) && prev ? `${tr('Odblokowanie')}: ${tr(prev.name)} ${h.nodes[prev.id] ?? 0}/${unlockLevel(prev)}   ` : '';
    const now = lock + (n.key ? `${tr(lvl ? 'Aktywny' : 'Klucz')}: ${tr(n.desc)}` : lvl > 0 ? `${tr('Teraz')}: ${tr(nodeLine(n, lvl))}` : tr('Nie kupiony'));
    const next = !n.key && lvl < n.max ? `   ${tr('Następny poziom')}: ${tr(nodeLine(n, lvl + 1))}` : '';
    drawText(g, `${tr(n.name)}. ${now}${next}`, W / 2, 222, C.lgray, { align: 'center' });
    // Przyciski.
    button(r, 8, BTN_Y, 70, 16, 'Wstecz [Esc]');
    if (meta.unassigned > 0) {
      button(r, W / 2 - 80, BTN_Y, 160, 16, `[B] Przydziel ${fmt(meta.unassigned)} esencji`, { accent: C.cyan, pulse: true });
    } else {
      drawText(g, 'Essence: end of every Expedition and Endless run', W / 2, BTN_Y + 2, C.lavender, { align: 'center' });
    }
    const canPrestige = spentEssence(h, tree) >= BAL.meta.prestigeCost;
    button(r, W - 128, BTN_Y, 120, 16, this.confirmPrestige ? 'Na pewno? [X]' : '[X] Prestiż', { active: this.confirmPrestige, accent: this.confirmPrestige ? C.red : C.pink, col: canPrestige ? undefined : C.dgray });
    if (this.noteT > 0) drawText(g, this.note, W / 2, H - 12, C.yellow, { align: 'center', outline: C.black });
  }
}
