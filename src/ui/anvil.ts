import { W, H, type Renderer } from '../core/renderer';
import type { Input } from '../core/input';
import { C } from '../core/palette';
import { drawText } from '../core/font';
import { sfx } from '../core/audio';
import { drawSprite } from '../gfx/sprites';
import { BAL } from '../data/balance';
import { fmt } from '../util/format';
import { RARITIES, BASE_BY_ID, SLOTS, salvageValue, salvageShards, superLine, type Item } from '../data/items';
import {
  anvilCost, anvilUpgrade, anvilReroll, anvilRerollAll, anvilRarity, anvilTransfer, anvilUpgradeCost, rerollAllCost, upgradeAnvil,
  type AnvilResult, type Cost,
} from '../systems/anvil';
import type { Run } from '../game/run';
import { drawItemSlot, drawItemCard } from './items';
import { Menu, dim, panel, inside } from './widgets';

const CELL = 24, STEP = 25;
const GRID_X = 14, EQ_Y = 46, BAG_Y = 80;
const DET_X = 228, DET_W = 246, DET_H = 196;
const COLS = 8, ROWS = 4;
/** Przycisk przekucia przy bonusie (prawy brzeg karty) i "Przekuj wszystkie" pod kartą. */
const RB_X = DET_X + DET_W - 22, RB_W = 14, RB_H = 12;
const ALL_Y = 232;

type Stage = 'pick' | 'ops' | 'target';

const costText = (c: Cost) => `${fmt(c.gold)} zł, ${fmt(c.shards)} odł.`;

/**
 * Kowadło: siatka przedmiotów (założone + plecak) i karta zaznaczonego przedmiotu. Przy każdym bonusie
 * przycisk R przekuwa go (koszt po najechaniu), pod kartą "Przekuj wszystkie" (taniej). Enter na przedmiocie
 * otwiera menu: ulepszenie poziomu, jakość, przeniesienie super-bonusu, rozłożenie na złoto i odłamki.
 */
export class AnvilView {
  private stage: Stage = 'pick';
  private cx = 0;
  private cy = 0;
  private lastMouse = 0;
  private menu: Menu;
  /** Dawca super-bonusu (etap 'target'). */
  private donor: Item | null = null;
  /** Pozycje Y wierszy bonusów z ostatniego rysowania karty. */
  private affixY: number[] = [];
  private hover = '';
  private note = '';
  private noteT = 0;
  private noteBad = false;

  /** `onChange` — po każdej udanej operacji (zapis runu). */
  constructor(private readonly run: Run, private readonly onChange: () => void) {
    const it = () => this.item()!;
    this.menu = new Menu([
      { label: () => `Ulepsz do poz. ${it().ilvl + 1}: ${costText(anvilCost(run, 'upgrade', it()))}`, act: () => this.apply(anvilUpgrade(run, it())) },
      {
        label: () => (it().rarity >= RARITIES.length - 1 ? 'Najwyższa jakość' : `Jakość: ${RARITIES[it().rarity + 1].name[BASE_BY_ID[it().base].gender]}: ${costText(anvilCost(run, 'rarity', it()))}`),
        act: () => this.apply(anvilRarity(run, it())),
      },
      { label: () => (it().affixes.length ? `Przekuj wszystkie: ${costText(rerollAllCost(run, it()))}` : 'Brak bonusów'), act: () => this.apply(anvilRerollAll(run, it())) },
      {
        label: () => (it().super ? 'Przenieś super-bonus na inny' : 'Brak super-bonusu'),
        act: () => { if (it().super) { this.donor = it(); this.stage = 'target'; } },
      },
      { label: () => `Rozłóż: +${fmt(Math.round(salvageValue(it()) * run.stats.greed))} zł, +${salvageShards(it())} odł.`, act: () => this.salvage() },
    ], GRID_X + 100, 189, 216, 13);
  }

  private cellItem(cx: number, cy: number): Item | null {
    return cy === 0 ? this.run.equipment[SLOTS[cx].id] : this.run.bag[(cy - 1) * COLS + cx] ?? null;
  }

  private cellPos(cx: number, cy: number): [number, number] {
    return [GRID_X + cx * STEP, cy === 0 ? EQ_Y : BAG_Y + (cy - 1) * STEP];
  }

  private item(): Item | null {
    return this.cellItem(this.cx, this.cy);
  }

  private say(note: string, bad: boolean): void {
    this.note = note;
    this.noteT = 2.5;
    this.noteBad = bad;
  }

  private apply(res: AnvilResult): void {
    this.say(res.note, !res.ok);
    sfx.play(res.ok ? 'levelup' : 'hurt');
    if (res.ok) this.onChange();
    if (!this.item()) this.stage = 'pick';
  }

  private salvage(): void {
    const it = this.item();
    if (!it) return;
    const shards = salvageShards(it);
    const gold = this.run.salvage(it);
    this.apply({ ok: true, note: `Rozłożono: +${fmt(gold)} zł, +${shards} odł.` });
  }

  /** Nawigacja po siatce strzałkami i myszą; zwraca true przy wyborze (Enter / klik). */
  private gridInput(input: Input, keys: boolean): boolean {
    if (keys) {
      if (input.pressed('up')) this.cy = (this.cy + ROWS - 1) % ROWS;
      if (input.pressed('down')) this.cy = (this.cy + 1) % ROWS;
      if (input.pressed('left')) this.cx = (this.cx + COLS - 1) % COLS;
      if (input.pressed('right')) this.cx = (this.cx + 1) % COLS;
    }
    let chosen = keys && input.pressed('confirm');
    const m = input.mouse;
    for (let cy = 0; cy < ROWS; cy++) {
      for (let cx = 0; cx < COLS; cx++) {
        const [x, y] = this.cellPos(cx, cy);
        if (!inside(m.x, m.y, x, y, CELL, CELL)) continue;
        if (m.lastMove !== this.lastMouse) { this.cx = cx; this.cy = cy; }
        if (input.pressed('click')) { this.cx = cx; this.cy = cy; chosen = true; }
      }
    }
    return chosen && !!this.item();
  }

  /** Przyciski przekucia na karcie przedmiotu (mysz) + koszt pod kursorem. True = kliknięto. */
  private cardButtons(input: Input): boolean {
    const it = this.item(), m = input.mouse;
    if (!it || this.stage === 'target') return false;
    let clicked = false;
    this.affixY.forEach((y, i) => {
      if (!inside(m.x, m.y, RB_X, y - 1, RB_W, RB_H)) return;
      this.hover = `Przekuj ten bonus: ${costText(anvilCost(this.run, 'reroll', it))}`;
      if (input.pressed('click')) { this.apply(anvilReroll(this.run, it, i)); clicked = true; }
    });
    if (it.affixes.length && inside(m.x, m.y, DET_X, ALL_Y, DET_W, 16)) {
      this.hover = 'Wszystkie bonusy naraz, taniej niż po kolei';
      if (input.pressed('click')) { this.apply(anvilRerollAll(this.run, it)); clicked = true; }
    }
    return clicked;
  }

  /** Zwraca true, gdy kowadło ma zostać zamknięte. */
  update(input: Input, dt: number): boolean {
    this.noteT = Math.max(0, this.noteT - dt);
    this.hover = '';
    const back = input.pressed('back') || input.pressed('pause') || (input.pressed('click') && inside(input.mouse.x, input.mouse.y, 6, 8, 70, 18));
    if (this.cardButtons(input)) { this.lastMouse = input.mouse.lastMove; return false; }
    if (this.stage === 'pick') {
      if (back) return true;
      // Ulepszenie kowadła: R albo przycisk pod siatką.
      if (input.pressed('reroll') || (input.pressed('click') && inside(input.mouse.x, input.mouse.y, 14, 192, 200, 18))) this.apply(upgradeAnvil(this.run));
      else if (this.gridInput(input, true)) { this.stage = 'ops'; this.menu.sel = 0; }
    } else if (this.stage === 'ops') {
      if (back) this.stage = 'pick';
      // Klik w siatkę zmienia przedmiot bez wychodzenia z menu; klawisze sterują menu.
      else if (!(input.pressed('click') && this.gridInput(input, false))) this.menu.update(input);
    } else {
      if (back) { this.stage = 'ops'; this.donor = null; }
      else if (this.gridInput(input, true)) {
        const res = anvilTransfer(this.run, this.donor!, this.item()!);
        this.donor = null;
        this.stage = 'pick';
        this.apply(res);
      }
    }
    this.lastMouse = input.mouse.lastMove;
    return false;
  }

  render(r: Renderer): void {
    const g = r.g, run = this.run;
    dim(r);
    drawText(g, 'Kowadło', W / 2, 10, C.orange, { align: 'center', scale: 2, outline: C.black });
    drawText(g, '[Esc] wróć', 10, 12, C.lgray, { outline: C.black });
    drawSprite(g, 'coin', W - 118, 18);
    drawText(g, fmt(run.gold), W - 110, 13, C.yellow, { outline: C.black });
    drawSprite(g, 'sh_shard', W - 58, 18);
    drawText(g, fmt(run.shards), W - 50, 13, C.cyan, { outline: C.black });

    panel(r, 6, 32, 216, 152, this.stage === 'target' ? C.yellow : C.lavender);
    drawText(g, 'Założone', GRID_X, 35, C.lavender);
    drawText(g, `Plecak ${run.bag.length}/${BAL.bagSize}`, GRID_X, 69, C.lavender);
    for (let cy = 0; cy < ROWS; cy++) {
      for (let cx = 0; cx < COLS; cx++) {
        const [x, y] = this.cellPos(cx, cy);
        const it = this.cellItem(cx, cy);
        drawItemSlot(r, it, x, y, CELL, cx === this.cx && cy === this.cy);
        if (it && it === this.donor) r.frame(x - 2, y - 2, CELL + 4, CELL + 4, C.orange);
      }
    }

    const it = this.item();
    if (it) {
      this.affixY = drawItemCard(r, it, DET_X, 32, DET_W, DET_H, undefined, this.stage !== 'target', run.stats);
      if (this.stage !== 'target') {
        for (const y of this.affixY) {
          panel(r, RB_X, y - 1, RB_W, RB_H, C.slate);
          drawText(g, 'R', RB_X + RB_W / 2, y - 1, C.cyan, { align: 'center' });
        }
        if (it.affixes.length) {
          panel(r, DET_X, ALL_Y, DET_W, 16, C.slate);
          drawText(g, `Przekuj wszystkie: ${costText(rerollAllCost(run, it))}`, DET_X + DET_W / 2, ALL_Y + 2, C.cyan, { align: 'center' });
        }
      }
    } else {
      this.affixY = [];
      panel(r, DET_X, 32, DET_W, DET_H, C.slate);
      drawText(g, 'Pusty slot', DET_X + DET_W / 2, 126, C.dgray, { align: 'center' });
    }

    if (this.stage === 'ops' && it) this.menu.render(r);
    if (this.stage === 'pick') {
      const max = run.anvilLevel >= BAL.anvilUpgrade.max;
      panel(r, 14, 192, 200, 18, max ? C.gold : C.orange);
      drawText(g, max ? `Kowadło poziom ${run.anvilLevel} (max)` : `[R] Ulepsz kowadło (poz. ${run.anvilLevel}): ${costText(anvilUpgradeCost(run))}`, 114, 195, max ? C.gold : C.white, { align: 'center' });
      drawText(g, 'Taniej, lepsze bonusy, częściej super-bonus', 114, 214, C.dgray, { align: 'center' });
      drawText(g, 'Enter / klik: wybierz przedmiot', 114, 228, C.dgray, { align: 'center' });
    }
    const hint = this.stage === 'target' && this.donor
      ? `Wybierz cel dla: ${superLine(this.donor).split(':')[0]}. Dawca przepadnie (${it ? costText(anvilCost(run, 'transfer', it)) : '-'}).`
      : this.hover;
    if (this.noteT > 0) drawText(g, this.note, W / 2, H - 13, this.noteBad ? C.salmon : C.lime, { align: 'center', outline: C.black });
    else if (hint) drawText(g, hint, W / 2, H - 13, C.lavender, { align: 'center', outline: C.black });
  }
}
