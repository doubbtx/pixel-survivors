import { W, H, type Renderer } from '../core/renderer';
import type { Input } from '../core/input';
import { C } from '../core/palette';
import { drawText, wrapText } from '../core/font';
import { sfx } from '../core/audio';
import { drawSprite } from '../gfx/sprites';
import { BAL } from '../data/balance';
import { fmt } from '../util/format';
import {
  RARITIES, BASE_BY_ID, SLOTS, implicitLine, statLine, statTotal, superLine, compareItems, salvageGold, salvageShards,
  type Item, type LootSource, type SlotId,
} from '../data/items';
import type { Run } from '../game/run';
import type { Stats } from '../entities/types';
import { Menu, dim, panel, slot, inside } from './widgets';
import { itemTags } from '../data/synergies';
import { drawTagIcons } from './synergies';

export const rarityCol = (it: Item): number => RARITIES[it.rarity].color;

/**
 * Gniazdo z przedmiotem: ramka w kolorze rzadkości, poświata dla epickich i lepszych, gwiazdka przy super-bonusie.
 * Pusty slot ekwipunku pokazuje blady zarys ikony (`ghost`).
 */
export function drawItemSlot(r: Renderer, it: Item | null, x: number, y: number, s: number, selected: boolean, ghost = ''): void {
  slot(r, x, y, s, it ? rarityCol(it) : C.slate);
  if (it) {
    if (it.rarity >= 3) r.withAlpha(0.25 + 0.1 * Math.sin(performance.now() / 250), () => r.rect(x + 2, y + 2, s - 4, s - 4, rarityCol(it)));
    drawSprite(r.g, BASE_BY_ID[it.base].icon, x + s / 2, y + s / 2);
    if (it.super) {
      r.rect(x + s - 6, y + 2, 4, 4, C.black);
      r.rect(x + s - 5, y + 3, 2, 2, C.yellow);
    }
  } else if (ghost) {
    r.withAlpha(0.22, () => drawSprite(r.g, ghost, x + s / 2, y + s / 2));
  }
  if (selected) {
    r.rect(x - 1, y - 1, s + 2, 1, C.yellow);
    r.rect(x - 1, y + s, s + 2, 1, C.yellow);
    r.rect(x - 1, y, 1, s, C.yellow);
    r.rect(x + s, y, 1, s, C.yellow);
  }
}

/**
 * Karta przedmiotu: ikona, nazwa w kolorze rzadkości, rzadkość i poziom, bonus bazowy, afiksy,
 * super-bonus (złoty), sumy statystyk gracza w nawiasach (gdy podano `stats`), tagi synergii (prawy dół), opcjonalnie miejsce na przyciski przekucia przy bonusach
 * (zwraca pozycje Y wierszy bonusów) i — gdy podano `cmp` — różnice względem założonego przedmiotu (zielone/czerwone).
 */
export function drawItemCard(r: Renderer, it: Item, x: number, y: number, w: number, h: number, cmp?: Item | null, rerollButtons = false, stats?: Stats): number[] {
  const g = r.g, R = RARITIES[it.rarity], base = BASE_BY_ID[it.base];
  panel(r, x, y, w, h, R.color);
  const cx = x + 22, cy = y + 22;
  r.withAlpha(0.25, () => r.circle(cx, cy, 15, R.color, true));
  r.withAlpha(0.7, () => r.circle(cx, cy, 12, C.black, true));
  r.circle(cx, cy, 13, R.color);
  drawSprite(g, base.icon, cx, cy, { scale: 1 + (it.rarity >= 2 ? 1 : 0) });
  let ly = y + 8;
  for (const line of wrapText(it.name, w - 50).slice(0, 2)) {
    drawText(g, line, x + 40, ly, R.color, { shadow: C.black });
    ly += 11;
  }
  drawText(g, `${R.name[base.gender]} ${base.name.toLowerCase()}, poz. ${it.ilvl}${it.upg ? `, +${it.upg}` : ''}`, x + 40, Math.max(ly, y + 19), C.dgray);
  ly = y + 40;
  const tags = itemTags(it);
  if (tags.length) drawTagIcons(r, tags, x + w - 14 - ((tags.length - 1) * 18) / 2, y + h - 14);
  const bottom = y + h - (tags.length ? 30 : 14);
  const affixY: number[] = [];
  const line = (s: string, col: number, tw = w - 16) => {
    for (const l of wrapText(s, tw)) {
      if (ly > bottom) return;
      drawText(g, l, x + 8, ly, col);
      ly += 11;
    }
  };
  line(implicitLine(it) + (stats ? ` (${statTotal(it.implicit.stat, stats)})` : ''), C.white);
  r.rect(x + 8, ly + 1, w - 16, 1, C.slate);
  ly += 4;
  for (const a of it.affixes) {
    if (ly <= bottom) affixY.push(ly);
    line(statLine(a.stat, a.value) + (stats ? ` (${statTotal(a.stat, stats)})` : ''), C.cyan, rerollButtons ? w - 34 : w - 16);
  }
  if (it.super) {
    ly += 2;
    line(superLine(it), C.yellow);
  }
  if (cmp === undefined) return affixY;
  ly += 3;
  r.rect(x + 8, ly, w - 16, 1, C.slate);
  ly += 3;
  if (!cmp) { line('Pusty slot: czysty zysk.', C.lime); return affixY; }
  const diff = compareItems(it, cmp);
  if (!diff.length) line('Bez zmian w statystykach.', C.lgray);
  for (const d of diff) line(d.text, d.better ? C.lime : C.red);
  if (cmp.super && cmp.super.id !== it.super?.id) line(`Tracisz: ${superLine(cmp).split(':')[0]}`, C.red);
  return affixY;
}

/**
 * Nakładka łupu: nowy przedmiot obok aktualnie założonego w tym slocie.
 * Wybór: załóż / do plecaka / rozłóż na złoto.
 */
export class LootView {
  readonly item: Item;
  private menu: Menu;
  private done = false;
  private note = '';

  readonly source: LootSource;

  constructor(private readonly run: Run, loot: { source: LootSource; item: Item }) {
    this.item = loot.item;
    this.source = loot.source;
    const it = this.item;
    this.menu = new Menu([
      { label: () => 'Załóż', act: () => { const g = run.equip(it); this.finish(g ? `Stary przedmiot rozłożony: +${g} zł` : ''); } },
      {
        label: () => (run.bag.length >= BAL.bagSize ? 'Plecak pełny' : `Do plecaka (${run.bag.length}/${BAL.bagSize})`),
        act: () => { if (run.bag.length < BAL.bagSize) { run.bag.push(it); this.finish(''); } },
      },
      { label: () => `Rozłóż (+${salvageGold(it, run.stats.greed)} zł, +${salvageShards(it)} odł.)`, act: () => { run.salvage(it); this.finish(''); } },
    ], W / 2, 214, 200, 15);
    sfx.play(it.rarity >= 3 || it.super ? 'levelup' : 'chest');
  }

  private finish(note: string): void {
    this.note = note;
    this.done = true;
  }

  /** Zwraca true, gdy gracz podjął decyzję; `note` zawiera ewentualny komunikat. */
  update(input: Input): { done: boolean; note: string } {
    this.menu.update(input);
    return { done: this.done, note: this.note };
  }

  render(r: Renderer): void {
    const it = this.item, run = this.run;
    dim(r);
    const title = this.source === 'boss' ? 'Łup bossa!' : this.source === 'elite' ? 'Skrzynia elity!' : 'Przedmiot!';
    drawText(r.g, title, W / 2, 10, it.super ? C.yellow : rarityCol(it), { align: 'center', scale: 2, outline: C.black });
    const cur = run.equipment[run.slotFor(it)];
    drawItemCard(r, it, 18, 40, 216, 168, cur, false, run.stats);
    if (cur) {
      drawText(r.g, 'Założone', 246 + 108, 30, C.dgray, { align: 'center' });
      drawItemCard(r, cur, 246, 40, 216, 168, undefined, false, run.stats);
    } else {
      panel(r, 246, 40, 216, 168, C.slate);
      drawText(r.g, `Slot "${SLOTS.find((s) => s.id === run.slotFor(it))!.name}" jest pusty`, 246 + 108, 118, C.dgray, { align: 'center' });
    }
    this.menu.render(r);
  }
}

const CELL = 24;
const EQ_X = 14, EQ_Y = 44, EQ_DX = 40;
const BAG_X = 108, BAG_Y = 44, BAG_COLS = 6;
const DET_X = 270, DET_W = 202;
/** Szerokość przycisku pod szczegółami (dwa obok siebie). */
const BTN_W = (DET_W - 6) / 2;
/** Krótkie podpisy slotów (pełne nazwy nie mieszczą się pod gniazdem). */
const SLOT_LABEL: Record<SlotId, string> = { weapon: 'Broń', helmet: 'Hełm', armor: 'Zbroja', gloves: 'Ręce', boots: 'Buty', ring1: 'Pier. 1', ring2: 'Pier. 2', amulet: 'Amulet' };
/** Zarys ikony w pustym slocie. */
const SLOT_GHOST: Record<SlotId, string> = { weapon: 'it_sword', helmet: 'it_helm', armor: 'it_plate', gloves: 'it_gloves', boots: 'it_boots', ring1: 'it_ring', ring2: 'it_ring', amulet: 'it_amulet' };

type Cell = { kind: 'eq'; slot: SlotId } | { kind: 'bag'; i: number };

/**
 * Ekran ekwipunku: 8 slotów (2×4), plecak 6×4 i szczegóły zaznaczonego przedmiotu
 * z porównaniem do założonego i sumami statystyk. Enter/klik: załóż/zdejmij, X: rozłóż, Esc/I: wróć.
 * Przekuwanie bonusów jest w kowadle (między poziomami).
 */
export class InventoryView {
  private cx = 0;
  private cy = 0;
  private note = '';
  private noteT = 0;
  private lastMouse = 0;

  constructor(private readonly run: Run) {}

  /** Kolumny 0–1 to sloty, 2–7 plecak. */
  private cellAt(cx: number, cy: number): Cell {
    if (cx < 2) return { kind: 'eq', slot: SLOTS[cy * 2 + cx].id };
    return { kind: 'bag', i: cy * BAG_COLS + (cx - 2) };
  }

  private cellRect(cx: number, cy: number): [number, number] {
    return cx < 2 ? [EQ_X + cx * EQ_DX, EQ_Y + cy * (CELL + 14)] : [BAG_X + (cx - 2) * (CELL + 1), BAG_Y + cy * (CELL + 1)];
  }

  private itemAt(c: Cell): Item | null {
    return c.kind === 'eq' ? this.run.equipment[c.slot] : this.run.bag[c.i] ?? null;
  }

  private say(s: string): void {
    this.note = s;
    this.noteT = 2.5;
  }

  private activate(c: Cell): void {
    const run = this.run, it = this.itemAt(c);
    if (!it) return;
    if (c.kind === 'eq') {
      if (!run.unequip(c.slot)) this.say('Plecak pełny');
    } else {
      const gold = run.equip(it);
      if (gold) this.say(`Plecak pełny, stary przedmiot rozłożony: +${gold} zł`);
    }
    sfx.play('select');
  }

  private salvage(c: Cell): void {
    const it = this.itemAt(c);
    if (!it) return;
    this.say(`Rozłożono: +${this.run.salvage(it)} zł`);
    sfx.play('pickup');
  }

  /** Zwraca true, gdy ekran ma zostać zamknięty. */
  update(input: Input, dt: number): boolean {
    this.noteT = Math.max(0, this.noteT - dt);
    if (input.pressed('back') || input.pressed('inventory') || input.pressed('pause')) return true;
    if (input.pressed('up')) this.cy = (this.cy + 3) % 4;
    if (input.pressed('down')) this.cy = (this.cy + 1) % 4;
    if (input.pressed('left')) this.cx = (this.cx + 7) % 8;
    if (input.pressed('right')) this.cx = (this.cx + 1) % 8;
    if (input.pressed('confirm')) this.activate(this.cellAt(this.cx, this.cy));
    if (input.pressed('skip')) this.salvage(this.cellAt(this.cx, this.cy));
    const m = input.mouse;
    for (let cy = 0; cy < 4; cy++) {
      for (let cx = 0; cx < 8; cx++) {
        const [x, y] = this.cellRect(cx, cy);
        if (!inside(m.x, m.y, x, y, CELL, CELL)) continue;
        if (m.lastMove !== this.lastMouse) { this.cx = cx; this.cy = cy; }
        if (input.pressed('click')) { this.cx = cx; this.cy = cy; this.activate(this.cellAt(cx, cy)); }
      }
    }
    // Przyciski pod szczegółami (mysz / dotyk).
    if (input.pressed('click')) {
      if (inside(m.x, m.y, DET_X, 236, BTN_W, 16)) this.activate(this.cellAt(this.cx, this.cy));
      if (inside(m.x, m.y, DET_X + BTN_W + 6, 236, BTN_W, 16)) this.salvage(this.cellAt(this.cx, this.cy));
      if (inside(m.x, m.y, 14, 236, 60, 16)) return true;
    }
    this.lastMouse = m.lastMove;
    return false;
  }

  render(r: Renderer): void {
    const g = r.g, run = this.run;
    dim(r);
    drawText(g, 'Ekwipunek', W / 2, 10, C.yellow, { align: 'center', scale: 2, outline: C.black });
    panel(r, 6, 34, 94, 196);
    panel(r, BAG_X - 6, 34, BAG_COLS * (CELL + 1) + 11, 196);
    const sel = this.cellAt(this.cx, this.cy);
    for (let cy = 0; cy < 4; cy++) {
      for (let cx = 0; cx < 8; cx++) {
        const [x, y] = this.cellRect(cx, cy);
        const c = this.cellAt(cx, cy);
        const on = cx === this.cx && cy === this.cy;
        drawItemSlot(r, this.itemAt(c), x, y, CELL, on, c.kind === 'eq' ? SLOT_GHOST[c.slot] : '');
        if (c.kind === 'eq') drawText(g, SLOT_LABEL[c.slot], x + CELL / 2, y + CELL + 1, on ? C.yellow : C.dgray, { align: 'center' });
      }
    }
    drawText(g, `Plecak ${run.bag.length}/${BAL.bagSize}`, BAG_X, 150, C.lavender);
    drawText(g, `Złoto: ${fmt(run.gold)}   odłamki: ${fmt(run.shards)}`, BAG_X, 164, C.gold);
    drawText(g, 'Gwiazdka = super-bonus', BAG_X, 180, C.dgray);
    drawText(g, 'W nawiasie: twoja suma', BAG_X, 190, C.dgray);
    drawText(g, 'X: rozłóż   Esc: wróć', BAG_X, 204, C.dgray);
    const it = this.itemAt(sel);
    if (it) {
      const cmp = sel.kind === 'bag' ? run.equipment[run.slotFor(it)] : undefined;
      drawItemCard(r, it, DET_X, 34, DET_W, 196, cmp, false, run.stats);
    } else {
      panel(r, DET_X, 34, DET_W, 196, C.slate);
      drawText(g, sel.kind === 'eq' ? 'Pusty slot' : 'Puste miejsce', DET_X + DET_W / 2, 124, C.dgray, { align: 'center' });
    }
    const btn = (x: number, w: number, label: string, col: number) => {
      panel(r, x, 236, w, 16, C.slate);
      drawText(g, label, x + w / 2, 238, col, { align: 'center' });
    };
    btn(14, 60, 'Wróć', C.lgray);
    if (it) {
      btn(DET_X, BTN_W, sel.kind === 'eq' ? 'Zdejmij' : 'Załóż', C.white);
      btn(DET_X + BTN_W + 6, BTN_W, `Rozłóż +${fmt(salvageGold(it, run.stats.greed))}`, C.gold);
    }
    if (this.noteT > 0) drawText(g, this.note, W / 2, H - 12, C.yellow, { align: 'center', outline: C.black });
  }
}
