import { W, H, type Renderer } from '../core/renderer';
import type { Input } from '../core/input';
import { C } from '../core/palette';
import { drawText, wrapText, DESC, descS, descLH } from '../core/font';
import { sfx } from '../core/audio';
import { tr } from '../core/i18n';
import { drawSprite } from '../gfx/sprites';
import { BAL } from '../data/balance';
import { fmt } from '../util/format';
import {
  RARITIES, BASE_BY_ID, SLOTS, itemAbout, UNIQUE_BY_ID, forgeMul, UNIQUE_COLOR, implicitLine, statLine, statTotal, superLine, compareItems, salvageGold, salvageShards, itemColor,
  type Item, type StatDiff, type LootSource, type SlotId,
} from '../data/items';
import type { Run } from '../game/run';
import type { Stats } from '../entities/types';
import { button, backButton, backHit, Menu, dim, panel, slot, inside, Scroll } from './widgets';
import { itemTags } from '../data/synergies';
import { AWAKENINGS } from '../data/forge';
import { drawTagIcons } from './synergies';


/**
 * Gniazdo z przedmiotem: ramka w kolorze rzadkości (unikat: własny kolor), poświata dla epickich i lepszych, gwiazdka przy super-bonusie.
 * Pusty slot ekwipunku pokazuje blady zarys ikony (`ghost`).
 */
export function drawItemSlot(r: Renderer, it: Item | null, x: number, y: number, s: number, selected: boolean, ghost = ''): void {
  slot(r, x, y, s, it ? itemColor(it) : C.slate);
  if (it) {
    if (it.rarity >= 3) r.withAlpha(0.25 + 0.1 * Math.sin(performance.now() / 250), () => r.rect(x + 2, y + 2, s - 4, s - 4, itemColor(it)));
    drawSprite(r.g, BASE_BY_ID[it.base].icon, x + s / 2, y + s / 2);
    // Legendarny: migocząca iskra wędrująca po rogach gniazda.
    if (it.rarity >= 4) {
      const k = Math.floor(performance.now() / 180) % 4;
      const [sx, sy] = [[x + 2, y + 2], [x + s - 4, y + 2], [x + s - 4, y + s - 4], [x + 2, y + s - 4]][k];
      r.rect(sx, sy, 2, 2, C.white);
    }
    if (it.super) {
      r.rect(x + s - 6, y + 2, 4, 4, C.black);
      r.rect(x + s - 5, y + 3, 2, 2, C.yellow);
    }
    if (it.fresh) drawText(r.g, '!', x + 3, y + 1, C.lime, { outline: C.black });
    // Poziom kuźni (+N), na czerwono gdy pęknięty.
    if (it.upg) drawText(r.g, `+${it.upg}`, x + s - 2, y + s - 11, it.cracked ? C.red : it.upg >= 9 ? C.cyan : C.white, { align: 'right', outline: C.black });
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
  const g = r.g, R = RARITIES[it.rarity], base = BASE_BY_ID[it.base], col = itemColor(it);
  const uniq = it.unique ? UNIQUE_BY_ID[it.unique] : null;
  panel(r, x, y, w, h, col);
  const cx = x + 22, cy = y + 22;
  r.withAlpha(0.25, () => r.circle(cx, cy, 15, col, true));
  r.withAlpha(0.7, () => r.circle(cx, cy, 12, C.black, true));
  r.circle(cx, cy, 13, col);
  drawSprite(g, base.icon, cx, cy, { scale: 1 + (it.rarity >= 2 ? 1 : 0) });
  let ly = y + 8;
  for (const line of wrapText(it.name, w - 50).slice(0, 2)) {
    drawText(g, line, x + 40, ly, col, { shadow: C.black });
    ly += 11;
  }
  drawText(g, `${uniq ? 'Unikat:' : R.name[base.gender]} ${base.name.toLowerCase()}, poz. ${it.ilvl}${it.upg ? `, +${it.upg}` : ''}`, x + 40, Math.max(ly, y + 19), C.lavender);
  ly = y + 40;
  const tags = itemTags(it);
  if (tags.length) drawTagIcons(r, tags, x + w - 14 - ((tags.length - 1) * 18) / 2, y + h - 14);
  const bottom = y + h - (tags.length ? 30 : 14);
  const affixY: number[] = [];
  // Porównanie z założonym przedmiotem: zmiana przy wierszu bonusu (↑ lepiej, ↓ gorzej) zamiast drugiej listy;
  // osobno tylko statystyki, które ma wyłącznie założony przedmiot. Sumy w nawiasach wtedy pomijane (za długie wiersze).
  const diffs = cmp ? compareItems(it, cmp) : [];
  const totals = stats && !cmp;
  const shown = new Set<StatDiff['stat']>();
  const diffOf = (k: StatDiff['stat']): StatDiff | undefined => {
    if (shown.has(k)) return undefined;
    shown.add(k);
    return diffs.find((d) => d.stat === k);
  };
  const line = (s: string, col: number, tw = w - 16, d?: StatDiff) => {
    for (const [i, l] of wrapText(s, d ? tw - 30 : tw).entries()) {
      if (ly > bottom) return;
      drawText(g, l, x + 8, ly, col);
      if (i === 0 && d) drawText(g, `${d.better ? '↑' : '↓'}${d.short}`, x + w - 8, ly, d.better ? C.lime : C.red, { align: 'right' });
      ly += 11;
    }
  };
  line(implicitLine(it) + (totals ? ` (${statTotal(it.implicit.stat, stats)})` : ''), C.white, w - 16, diffOf(it.implicit.mode === 'mul' ? 'mul' : it.implicit.stat));
  r.rect(x + 8, ly + 1, w - 16, 1, C.slate);
  ly += 4;
  const k = forgeMul(it);
  for (const a of it.affixes) {
    if (ly <= bottom) affixY.push(ly);
    line(statLine(a.stat, a.value * (a.stat === 'amount' ? 1 : k)) + (totals ? ` (${statTotal(a.stat, stats)})` : ''), C.cyan, rerollButtons ? w - 34 : w - 16, diffOf(a.stat));
  }
  if (it.super) {
    ly += 2;
    line(superLine(it), C.yellow);
  }
  if (uniq) {
    ly += 2;
    line(uniq.desc, UNIQUE_COLOR);
  }
  // Kuźnia: Przebudzenie (+9, x2 od +15) i pęknięcie.
  const lvl = it.upg ?? 0;
  if (lvl >= 9) {
    const awk = AWAKENINGS[base.kind];
    ly += 2;
    line(`${awk.name}: ${awk.desc(lvl >= 15 ? 2 : 1)}`, it.cracked ? C.dgray : C.cyan);
  }
  if (it.cracked) line(`Pęknięty: wartości -${Math.round((1 - BAL.forge.crackMul) * 100)}%, napraw w kowadle`, C.red);
  if (cmp === undefined) return affixY;
  ly += 3;
  if (!cmp) { line('Pusty slot: czysty zysk.', C.lime); return affixY; }
  const rest = diffs.filter((d) => !shown.has(d.stat));
  if (!diffs.length) line('Bez zmian w statystykach.', C.lavender);
  for (const d of rest) line(d.text, d.better ? C.lime : C.red);
  if (cmp.super && cmp.super.id !== it.super?.id) line(`Tracisz: ${superLine(cmp).split(':')[0]}`, C.red);
  if (cmp.unique && cmp.unique !== it.unique) line(`Tracisz efekt: ${cmp.name}`, C.red);
  return affixY;
}

/**
 * Nakładka łupu: nowy przedmiot obok aktualnie założonego w tym slocie.
 * Wybór: załóż / do plecaka / rozłóż na złoto.
 */
/** Unikat albo legenda: zawsze osobne okno łupu. */
const special = (it: Item): boolean => !!it.unique || it.rarity >= RARITIES.length - 1;

/** „Wszystko do plecaka”: bieżący i zwykłe przedmioty z kolejki łupu; zwraca podsumowanie do komunikatu. */
function takeAll(run: Run, first: Item): string {
  const items = [first, ...run.pendingLoot.filter((l) => !special(l.item)).map((l) => l.item)];
  run.pendingLoot = run.pendingLoot.filter((l) => special(l.item));
  let stashed = 0, gold = 0;
  for (const it of items) {
    if (run.bag.length < BAL.bagSize) { run.stash(it); stashed++; } else gold += run.salvage(it);
  }
  return gold > 0 ? `${tr('To backpack')}: ${stashed}, ${tr('salvaged')}: +${fmt(gold)} zł` : `${tr('To backpack')}: ${stashed}`;
}

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
        act: () => { if (run.bag.length < BAL.bagSize) { run.stash(it); this.finish(''); } },
      },
      { label: () => `Rozłóż (+${salvageGold(it, run.stats.greed)} zł, +${salvageShards(it)} odł.)`, act: () => { run.salvage(it); this.finish(''); } },
    ], W / 2, 211, 200, 14);
    // Seria łupu (0.44, playtest 2: po bossie 3 okna łupu pod rząd): ten i dalsze zwykłe przedmioty z kolejki naraz do
    // plecaka (pełny plecak: rozłożone); unikaty i legendy zostają w kolejce na osobne okno.
    const rest = () => run.pendingLoot.filter((l) => !special(l.item)).length;
    if (rest() > 0 && !special(it)) {
      this.menu.items.push({ label: () => `${tr('Take all to backpack')} (${rest() + 1})`, act: () => this.finish(takeAll(run, it)) });
      this.menu.y -= 14;
    }
    sfx.play(it.rarity >= 3 || it.super || it.unique ? 'levelup' : 'chest');
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
    const title = it.unique ? 'Unikat!' : this.source === 'boss' ? 'Łup bossa!' : this.source === 'elite' ? 'Skrzynia elity!' : 'Przedmiot!';
    drawText(r.g, title, W / 2, 10, it.super ? C.yellow : itemColor(it), { align: 'center', scale: 2, outline: C.black });
    const cur = run.equipment[run.slotFor(it)];
    // Przy czwartej opcji („Wszystko do plecaka”) karty niższe, żeby menu ich nie zasłaniało.
    const ch = this.menu.items.length > 3 ? 152 : 168;
    // Pusty slot: jeden szerszy panel (nie ma z czym porównać), inaczej nowy obok założonego.
    if (!cur) {
      drawItemCard(r, it, W / 2 - 150, 40, 300, ch, null, false, run.stats);
    } else {
      drawItemCard(r, it, 18, 40, 216, ch, cur, false, run.stats);
      drawText(r.g, 'Założone', 246 + 108, 30, C.lavender, { align: 'center' });
      drawItemCard(r, cur, 246, 40, 216, ch, undefined, false, run.stats);
    }
    this.menu.render(r);
  }
}

const CELL = 24;
const EQ_X = 14, EQ_Y = 44, EQ_DX = 40;
const BAG_X = 108, BAG_Y = 44, BAG_COLS = 6;
/** Obszar opisu przedmiotu pod plecakiem (x, y, w, h). */
const ABOUT_AREA = [BAG_X - 2, 173, BAG_COLS * (CELL + 1) + 2, 52] as const;
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
  /** Opis zaznaczonego przedmiotu pod plecakiem: przewijany. */
  private about = new Scroll();
  private aboutKey = '';
  private cx = 0;
  private cy = 0;
  private note = '';
  private noteT = 0;
  private lastMouse = 0;
  /** Dotyk: komórka (cy*8+cx) zaznaczona pierwszym dotknięciem; drugie dotknięcie w nią działa. -1: brak. */
  private armed = -1;

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

  /** Najlepszy ekwipunek (przycisk / R): Run.autoEquip. */
  private best(): void {
    this.armed = -1;
    const n = this.run.autoEquip().length;
    this.say(n ? `${tr('Best gear equipped')} (${n})` : tr('You already wear the best items'));
    sfx.play(n ? 'pickup' : 'select');
  }

  private activate(c: Cell): void {
    const run = this.run, it = this.itemAt(c);
    // Plecak się zmienia (przedmioty się przesuwają): następny dotyk znów tylko zaznacza.
    this.armed = -1;
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
    this.armed = -1;
    if (!it) return;
    this.say(`Rozłożono: +${this.run.salvage(it)} zł`);
    sfx.play('pickup');
  }

  /** Zwraca true, gdy ekran ma zostać zamknięty. */
  update(input: Input, dt: number): boolean {
    this.about.update(input, ...ABOUT_AREA);
    this.noteT = Math.max(0, this.noteT - dt);
    if (input.pressed('back') || input.pressed('inventory') || input.pressed('pause') || backHit(input)) return this.close();
    if (input.pressed('up')) this.cy = (this.cy + 3) % 4;
    if (input.pressed('down')) this.cy = (this.cy + 1) % 4;
    if (input.pressed('left')) this.cx = (this.cx + 7) % 8;
    if (input.pressed('right')) this.cx = (this.cx + 1) % 8;
    if (input.pressed('confirm')) this.activate(this.cellAt(this.cx, this.cy));
    if (input.pressed('skip')) this.salvage(this.cellAt(this.cx, this.cy));
    if (input.pressed('reroll')) this.best();
    const m = input.mouse;
    for (let cy = 0; cy < 4; cy++) {
      for (let cx = 0; cx < 8; cx++) {
        const [x, y] = this.cellRect(cx, cy);
        if (!inside(m.x, m.y, x, y, CELL, CELL)) continue;
        if (m.lastMove !== this.lastMouse) { this.cx = cx; this.cy = cy; }
        // Dotyk: pierwsze dotknięcie zaznacza (opis i przycisk Rozłóż), drugie zakłada / zdejmuje.
        // Liczy się komórka uzbrojona poprzednim dotknięciem, nie samo zaznaczenie (nowy widok startuje na broni).
        if (input.pressed('click')) {
          const key = cy * 8 + cx;
          this.cx = cx; this.cy = cy;
          if (input.lastDevice !== 'touch' || this.armed === key) this.activate(this.cellAt(cx, cy));
          else this.armed = key;
        }
      }
    }
    // Przyciski pod szczegółami (mysz / dotyk).
    if (input.pressed('click')) {
      if (inside(m.x, m.y, DET_X, 236, BTN_W, 16)) this.activate(this.cellAt(this.cx, this.cy));
      if (inside(m.x, m.y, DET_X + BTN_W + 6, 236, BTN_W, 16)) this.salvage(this.cellAt(this.cx, this.cy));
      if (inside(m.x, m.y, 14, 236, 104, 16)) this.best();
    }
    this.lastMouse = m.lastMove;
    return false;
  }

  /** Zamknięcie: przedmioty w plecaku przestają być „nowe”. */
  private close(): boolean {
    for (const it of this.run.bag) it.fresh = false;
    return true;
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
        if (c.kind === 'eq') drawText(g, SLOT_LABEL[c.slot], x + CELL / 2, y + CELL + 1, on ? C.yellow : C.lavender, { align: 'center' });
      }
    }
    drawText(g, `Plecak ${run.bag.length}/${BAL.bagSize}`, BAG_X, 148, C.lavender);
    drawText(g, `${fmt(Math.floor(run.gold))} zł   ${fmt(run.shards)} odł.`, BAG_X + BAG_COLS * (CELL + 1) - 1, 148, C.gold, { align: 'right' });
    // Opis zaznaczonego przedmiotu (albo slotu) małym tekstem pod plecakiem.
    const it = this.itemAt(sel), aw = (BAG_COLS * (CELL + 1) - 4) / descS();
    drawText(g, it ? 'O przedmiocie' : 'Wskazówka', BAG_X, 162, C.yellow);
    const about = it ? itemAbout(it) : [sel.kind === 'eq' ? 'Pusty slot: najedź na przedmiot w plecaku i kliknij, żeby go założyć.' : 'Najedź na przedmiot, żeby zobaczyć opis. Klik: załóż / zdejmij, X: rozłóż na złoto.'];
    // Opis przewijany (kółko / palec / PageUp-PageDown), od góry przy zmianie zaznaczenia.
    const key = `${sel.kind}:${this.cx}:${this.cy}`;
    if (key !== this.aboutKey) { this.aboutKey = key; this.about.reset(); }
    const oy = this.about.begin(r, ...ABOUT_AREA);
    let ay = ABOUT_AREA[1] + 1 - oy;
    for (const para of about) {
      for (const l of wrapText(para, aw)) { drawText(g, l, BAG_X, ay, C.lgray, DESC); ay += descLH() - 1; }
    }
    this.about.end(r, ay + oy - ABOUT_AREA[1], ...ABOUT_AREA);
    if (it) {
      const cmp = sel.kind === 'bag' ? run.equipment[run.slotFor(it)] : undefined;
      drawItemCard(r, it, DET_X, 34, DET_W, 196, cmp, false, run.stats);
    } else {
      panel(r, DET_X, 34, DET_W, 196, C.slate);
      drawText(g, sel.kind === 'eq' ? 'Pusty slot' : 'Puste miejsce', DET_X + DET_W / 2, 124, C.lavender, { align: 'center' });
    }
    const btn = (x: number, w: number, label: string, col: number) => {
      button(r, x, 236, w, 16, label, { col });
    };
    backButton(r);
    btn(14, 104, 'Best gear [R]', C.lime);
    if (it) {
      btn(DET_X, BTN_W, sel.kind === 'eq' ? 'Zdejmij' : 'Załóż', C.white);
      btn(DET_X + BTN_W + 6, BTN_W, `Rozłóż +${fmt(salvageGold(it, run.stats.greed))}`, C.gold);
    }
    if (this.noteT > 0) drawText(g, this.note, W / 2, H - 12, C.yellow, { align: 'center', outline: C.black });
  }
}
