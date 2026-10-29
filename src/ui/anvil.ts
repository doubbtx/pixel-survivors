import { tr } from '../core/i18n';
import { W, H, type Renderer } from '../core/renderer';
import type { Input } from '../core/input';
import { C } from '../core/palette';
import { drawText, wrapText } from '../core/font';
import { rng } from '../core/rng';
import { sfx } from '../core/audio';
import { drawSprite } from '../gfx/sprites';
import { BAL } from '../data/balance';
import { fmt } from '../util/format';
import { RARITIES, BASE_BY_ID, SLOTS, salvageGold, salvageShards, superLine, itemColor, type Item } from '../data/items';
import { MATERIALS, MAT_BY_ID, SCROLLS, FORGE_TIERS, AWAKENINGS, CRAFTS, type MatId, type ScrollId } from '../data/forge';
import {
  nextStep, forgeChance, failRisks, forgeGold, forgeBlock, forgeAttempt, repairCost, repairItem, OUTCOME_COL,
  craft, craftBlock, craftChance, craftGold,
  type ForgeOpts, type ForgeOutcome,
} from '../systems/forge';
import {
  anvilCost, anvilReroll, anvilRerollAll, anvilRarity, anvilTransfer, anvilUpgradeCost, rerollAllCost, upgradeAnvil,
  type AnvilResult, type Cost,
} from '../systems/anvil';
import type { Run } from '../game/run';
import { drawItemSlot, drawItemCard } from './items';
import { button, Menu, dim, panel, inside } from './widgets';

const CELL = 24, STEP = 25;
const GRID_X = 14, EQ_Y = 46, BAG_Y = 80;
const DET_X = 228, DET_W = 246, DET_H = 196;
const COLS = 8, ROWS = 4;
/** Przycisk przekucia przy bonusie (prawy brzeg karty) i "Przekuj wszystkie" pod kartą. */
const RB_X = DET_X + DET_W - 22, RB_W = 14, RB_H = 12;
const ALL_Y = 232;

type Stage = 'pick' | 'ops' | 'target' | 'forge' | 'craft';
/** Warsztat: wysokość wiersza przepisu i przycisk w etapie wyboru. */
const CRAFT_Y = 54, CRAFT_H = 40, WORKSHOP_Y = 212;

/** Kuźnia: przełączniki zwojów i trybu ryzyka (klawisze 1-4), wiersze na panelu. */
const OPT_KEYS: (ScrollId | 'risk')[] = ['bless', 'dragon', 'talisman', 'risk'];
const OPT_Y = 138, OPT_H = 12, FORGE_BTN_Y = 210;
/** Krótkie opisy przełączników kuźni (pełne nazwy zwojów w data/forge.ts). */
const OPT_LABEL: Record<ScrollId | 'risk', string> = {
  bless: 'Błogosławieństwo: bez spadku', dragon: 'Zwój smoka: +15% szansy', talisman: 'Talizman: bez pęknięcia', risk: '',
};
/** Czas animacji młota (s) i pokazywania wyniku. */
const HAMMER_T = 0.9, RESULT_T = 2.2;

const costText = (c: Cost) => `${fmt(c.gold)} zł, ${fmt(c.shards)} odł.`;

/**
 * Kowadło: siatka przedmiotów (założone + plecak) i karta zaznaczonego przedmiotu. Przy każdym bonusie
 * przycisk R przekuwa go (koszt po najechaniu), pod kartą "Przekuj wszystkie" (taniej). Enter na przedmiocie
 * otwiera menu: Kuźnia (ulepszenie z szansą do +15, materiały i zwoje, data/forge.ts) albo naprawa pękniętego przedmiotu,
 * jakość, przeniesienie super-bonusu, rozłożenie na złoto i odłamki.
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
  /** Kuźnia: wybrane zwoje i tryb ryzyka, animacja młota, wynik ostatniej próby, potwierdzenie ryzyka. */
  private opts: ForgeOpts = { bless: false, dragon: false, talisman: false, risk: false };
  /** Pad / strzałki w kuźni: zaznaczona opcja (-1 = brak, mysz i klawisze 1-4 działają bez niej). */
  private optSel = -1;
  private hammer = 0;
  private result: { text: string; outcome: ForgeOutcome; t: number } | null = null;
  private confirmRisk = false;
  private sparks: { x: number; y: number; vx: number; vy: number; t: number }[] = [];
  /** Warsztat: zaznaczony przepis. */
  private craftSel = 0;

  /** `onChange` — po każdej udanej operacji (zapis runu). */
  constructor(private readonly run: Run, private readonly onChange: () => void) {
    const it = () => this.item()!;
    this.menu = new Menu([
      {
        label: () => {
          const i = it();
          if (i.cracked) { const c = repairCost(run, i); return `Napraw pęknięcie: ${fmt(c.gold)} zł, ${c.ore} ruda`; }
          return (i.upg ?? 0) >= BAL.anvil.maxUpgrades ? 'Kuźnia: maksymalny poziom +15' : `Kuźnia: +${i.upg ?? 0} > +${(i.upg ?? 0) + 1}`;
        },
        act: () => {
          const i = it();
          if (i.cracked) this.apply(repairItem(run, i));
          else if (nextStep(i)) { this.stage = 'forge'; this.confirmRisk = false; this.result = null; }
        },
      },
      {
        label: () => (it().rarity >= RARITIES.length - 1 ? 'Najwyższa jakość' : `Jakość: ${RARITIES[it().rarity + 1].name[BASE_BY_ID[it().base].gender]}: ${costText(anvilCost(run, 'rarity', it()))}`),
        act: () => this.apply(anvilRarity(run, it())),
      },
      { label: () => (it().affixes.length ? `Przekuj wszystkie: ${costText(rerollAllCost(run, it()))}` : 'Brak bonusów'), act: () => this.apply(anvilRerollAll(run, it())) },
      {
        label: () => (it().super ? 'Przenieś super-bonus na inny' : 'Brak super-bonusu'),
        act: () => { if (it().super) { this.donor = it(); this.stage = 'target'; } },
      },
      { label: () => `Rozłóż: +${fmt(salvageGold(it(), run.stats.greed))} zł, +${salvageShards(it())} odł.`, act: () => this.salvage() },
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

  /** Przełącza zwój (gdy jest w zapasie) albo tryb ryzyka. */
  private toggle(k: ScrollId | 'risk'): void {
    if (k !== 'risk' && !this.opts[k] && (this.run.scrolls[k] ?? 0) <= 0) { this.say('Brak zwoju w zapasie', true); sfx.play('hurt'); return; }
    this.opts[k] = !this.opts[k];
    this.confirmRisk = false;
    sfx.play('select');
  }

  /** Start próby kucia: sprawdzenie, potwierdzenie ryzyka zniszczenia, animacja młota (wynik po jej końcu). */
  private strike(): void {
    const it = this.item();
    if (!it) return;
    const block = forgeBlock(this.run, it, this.opts);
    if (block) { this.say(block, true); sfx.play('hurt'); return; }
    if (this.opts.risk && failRisks(it, this.opts).crack > 0 && !this.confirmRisk) {
      this.confirmRisk = true;
      this.say('Tryb ryzyka: przedmiot może zostać ZNISZCZONY. Enter jeszcze raz, żeby kuć.', true);
      return;
    }
    this.confirmRisk = false;
    this.hammer = HAMMER_T;
    this.result = null;
  }

  /** Koniec animacji: rzut i wynik (zwoje z zapasu zużyte, odznaczone gdy się skończyły). */
  private finishStrike(): void {
    const it = this.item();
    if (!it) return;
    const res = forgeAttempt(this.run, it, this.opts);
    this.result = { text: res.note, outcome: res.outcome, t: RESULT_T };
    for (const k of ['bless', 'dragon', 'talisman'] as ScrollId[]) if ((this.run.scrolls[k] ?? 0) <= 0) this.opts[k] = false;
    sfx.play(res.outcome === 'success' ? 'levelup' : res.outcome === 'destroy' ? 'explode' : 'hurt');
    this.onChange();
    if (res.outcome === 'destroy' || !this.item()) this.stage = 'pick';
    else if (!nextStep(it) || it.cracked) this.stage = 'ops';
  }

  /** Etap kuźni: klawisze 1-4 przełączają zwoje i ryzyko (pad: góra/dół i RB albo X), Enter / przycisk kuje, Esc wraca do menu. */
  private updateForge(input: Input, back: boolean): void {
    if (this.hammer > 0) return;
    if (back) { this.stage = 'ops'; return; }
    const nums = ['n1', 'n2', 'n3', 'n4'] as const;
    nums.forEach((n, i) => { if (input.pressed(n)) this.toggle(OPT_KEYS[i]); });
    const n = OPT_KEYS.length;
    if (input.pressed('down')) this.optSel = (this.optSel + 1) % n;
    if (input.pressed('up')) this.optSel = (Math.max(0, this.optSel) + n - 1) % n;
    if (input.pressed('skip') && this.optSel >= 0) this.toggle(OPT_KEYS[this.optSel]);
    if (input.pressed('confirm')) this.strike();
    if (!input.pressed('click')) return;
    const m = input.mouse;
    OPT_KEYS.forEach((k, i) => { if (inside(m.x, m.y, DET_X, OPT_Y + i * OPT_H, DET_W, OPT_H)) this.toggle(k); });
    if (inside(m.x, m.y, DET_X + 40, FORGE_BTN_Y, DET_W - 80, 16)) this.strike();
  }

  /** Warsztat: strzałki wybierają przepis, Enter / klik (drugi raz w ten sam) przetapia, Esc wraca. */
  private updateCraft(input: Input, back: boolean): void {
    const n = CRAFTS.length;
    if (back) { this.stage = 'pick'; return; }
    if (input.pressed('up')) this.craftSel = (this.craftSel + n - 1) % n;
    if (input.pressed('down')) this.craftSel = (this.craftSel + 1) % n;
    let go = input.pressed('confirm');
    if (input.pressed('click')) CRAFTS.forEach((_, i) => {
      if (!inside(input.mouse.x, input.mouse.y, DET_X, CRAFT_Y + i * CRAFT_H, DET_W, CRAFT_H - 2)) return;
      if (this.craftSel === i) go = true;
      this.craftSel = i;
    });
    if (go) {
      const res = craft(this.run, CRAFTS[this.craftSel]);
      this.apply(res);
      if (res.ok) for (let i = 0; i < 12; i++) this.sparks.push({ x: DET_X + 20, y: CRAFT_Y + this.craftSel * CRAFT_H + 14, vx: rng.range(-60, 60), vy: rng.range(-90, -20), t: rng.range(0.3, 0.6) });
    }
  }

  /** Panel warsztatu: przepisy (wynik, składniki z zapasem, odłamki, złoto, szansa). */
  private renderCraft(r: Renderer): void {
    const g = r.g, run = this.run;
    panel(r, DET_X, 32, DET_W, 196);
    drawText(g, 'Warsztat: przetapianie', DET_X + DET_W / 2, 37, C.orange, { align: 'center' });
    CRAFTS.forEach((c, i) => {
      const y = CRAFT_Y + i * CRAFT_H, on = i === this.craftSel, out = MAT_BY_ID[c.out], block = craftBlock(run, c);
      panel(r, DET_X + 4, y, DET_W - 8, CRAFT_H - 2, on ? C.gold : C.slate);
      drawSprite(g, out.icon, DET_X + 18, y + 13);
      drawText(g, out.name, DET_X + 30, y + 3, out.color);
      drawText(g, `${Math.round(craftChance(run, c) * 100)}%   ${fmt(craftGold(run, c))} zł`, DET_X + DET_W - 10, y + 3, block ? C.lavender : C.yellow, { align: 'right' });
      // Składniki: ikona i zapas/potrzeba, odłamki jako katalizator.
      let x = DET_X + 30;
      for (const [id, n] of Object.entries(c.need) as [MatId, number][]) {
        drawSprite(g, MAT_BY_ID[id].icon, x + 6, y + 24);
        drawText(g, `${run.mats[id]}/${n}`, x + 15, y + 19, run.mats[id] >= n ? C.white : C.salmon);
        x += 44;
      }
      if (c.shards) { drawSprite(g, 'sh_shard', x + 6, y + 24); drawText(g, `${run.shards}/${c.shards}`, x + 15, y + 19, run.shards >= c.shards ? C.white : C.salmon); }
    });
    for (const sp of this.sparks) r.rect(sp.x, sp.y, 2, 2, sp.t > 0.3 ? C.yellow : C.orange);
    drawText(g, 'Enter: przetop   Esc: wróć   Porażka: połowa składników przepada   Szansa rośnie z poziomem kowadła', W / 2, 234, C.lavender, { align: 'center' });
  }

  /** Zwraca true, gdy kowadło ma zostać zamknięte. */
  update(input: Input, dt: number): boolean {
    this.noteT = Math.max(0, this.noteT - dt);
    this.hover = '';
    // Animacja młota (3 uderzenia z iskrami), potem wynik.
    for (const s of this.sparks) { s.t -= dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 200 * dt; }
    this.sparks = this.sparks.filter((s) => s.t > 0);
    if (this.result) { this.result.t -= dt; if (this.result.t <= 0) this.result = null; }
    if (this.hammer > 0) {
      const before = Math.floor((HAMMER_T - this.hammer) / 0.3);
      this.hammer -= dt;
      const after = Math.floor((HAMMER_T - this.hammer) / 0.3);
      if (after > before) {
        sfx.play('hit');
        for (let i = 0; i < 10; i++) this.sparks.push({ x: DET_X + DET_W / 2, y: 84, vx: rng.range(-70, 70), vy: rng.range(-110, -30), t: rng.range(0.3, 0.6) });
      }
      if (this.hammer <= 0) this.finishStrike();
      return false;
    }
    const back = input.pressed('back') || input.pressed('pause') || (input.pressed('click') && inside(input.mouse.x, input.mouse.y, 6, 9, 54, 16));
    if (this.cardButtons(input)) { this.lastMouse = input.mouse.lastMove; return false; }
    if (this.stage === 'pick') {
      if (back) return true;
      // Ulepszenie kowadła: R albo przycisk pod siatką.
      if (input.pressed('reroll') || (input.pressed('click') && inside(input.mouse.x, input.mouse.y, 14, 192, 200, 18))) this.apply(upgradeAnvil(this.run));
      else if (input.pressed('banish') || (input.pressed('click') && inside(input.mouse.x, input.mouse.y, 14, WORKSHOP_Y, 200, 16))) { this.stage = 'craft'; sfx.play('select'); }
      else if (this.gridInput(input, true)) { this.stage = 'ops'; this.menu.sel = 0; }
    } else if (this.stage === 'forge') {
      this.updateForge(input, back);
    } else if (this.stage === 'craft') {
      this.updateCraft(input, back);
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
    drawText(g, 'Kowadło', W / 2, 10, C.yellow, { align: 'center', scale: 2, outline: C.black });
    button(r, 6, 9, 54, 16, 'Wstecz [Esc]', { scale: 0.85 });
    drawSprite(g, 'coin', W - 118, 18);
    drawText(g, fmt(run.gold), W - 110, 13, C.yellow, { outline: C.black });
    drawSprite(g, 'sh_shard', W - 58, 18);
    drawText(g, fmt(run.shards), W - 50, 13, C.cyan, { outline: C.black });
    // Zapasy kuźni: materiały (lewo) i zwoje (przy tytule).
    MATERIALS.forEach((m, i) => {
      drawSprite(g, m.icon, 70 + i * 24, 18);
      drawText(g, String(run.mats[m.id]), 78 + i * 24, 13, run.mats[m.id] ? m.color : C.lavender, { outline: C.black });
    });
    SCROLLS.forEach((s, i) => {
      drawSprite(g, s.icon, 296 + i * 22, 18);
      drawText(g, String(run.scrolls[s.id]), 304 + i * 22, 13, run.scrolls[s.id] ? s.color : C.lavender, { outline: C.black });
    });

    panel(r, 6, 32, 216, 152, this.stage === 'target' ? C.yellow : undefined);
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
    if (this.stage === 'craft') {
      this.affixY = [];
      this.renderCraft(r);
    } else if (it && this.stage === 'forge') {
      this.affixY = [];
      this.renderForge(r, it);
    } else if (it) {
      this.affixY = drawItemCard(r, it, DET_X, 32, DET_W, DET_H, undefined, this.stage !== 'target', run.stats);
      if (this.stage !== 'target') {
        for (const y of this.affixY) {
          panel(r, RB_X, y - 1, RB_W, RB_H, C.slate);
          drawText(g, 'R', RB_X + RB_W / 2, y - 1, C.cyan, { align: 'center' });
        }
        if (it.affixes.length) {
          button(r, DET_X, ALL_Y, DET_W, 16, `Przekuj wszystkie: ${costText(rerollAllCost(run, it))}`, { col: C.cyan, accent: C.cyan });
        }
      }
    } else {
      this.affixY = [];
      panel(r, DET_X, 32, DET_W, DET_H, C.slate);
      drawText(g, 'Pusty slot', DET_X + DET_W / 2, 126, C.lavender, { align: 'center' });
    }

    if (this.stage === 'ops' && it) this.menu.render(r);
    if (this.stage === 'pick') {
      const max = run.anvilLevel >= BAL.anvilUpgrade.max;
      button(r, 14, 192, 200, 18, max ? `Kowadło poziom ${run.anvilLevel} (max)` : `[R] Ulepsz kowadło (poz. ${run.anvilLevel}): ${costText(anvilUpgradeCost(run))}`, { accent: C.orange, col: max ? C.gold : undefined });
      button(r, 14, WORKSHOP_Y, 200, 16, '[B] Warsztat: przetapianie materiałów', { accent: C.orange });
      drawText(g, 'Enter / klik: wybierz przedmiot', 114, 232, C.lavender, { align: 'center' });
    }
    // Wynik ostatniej próby kucia (także po wyjściu z panelu, np. po zniszczeniu przedmiotu).
    if (this.result && this.stage !== 'forge') drawText(g, this.result.text, W / 2, H - 26, OUTCOME_COL[this.result.outcome], { align: 'center', outline: C.black });
    const hint = this.stage === 'target' && this.donor
      ? `Wybierz cel dla: ${superLine(this.donor).split(':')[0]}. Dawca przepadnie (${it ? costText(anvilCost(run, 'transfer', it)) : '-'}).`
      : this.hover;
    if (this.noteT > 0) drawText(g, this.note, W / 2, H - 13, this.noteBad ? C.salmon : C.lime, { align: 'center', outline: C.black });
    else if (hint) drawText(g, hint, W / 2, H - 13, C.lavender, { align: 'center', outline: C.black });
  }

  /**
   * Panel kuźni: przedmiot i poziomy, szansa z rozbiciem, koszt (materiał, złoto), skutki porażki, zwoje i tryb ryzyka,
   * najbliższy próg i przycisk Kuj. W trakcie animacji młot uderza w kowadło, potem wielki napis wyniku.
   */
  private renderForge(r: Renderer, it: Item): void {
    const g = r.g, run = this.run, x = DET_X, cx = DET_X + DET_W / 2, lvl = it.upg ?? 0, s = nextStep(it);
    panel(r, x, 32, DET_W, 196, this.opts.risk ? C.red : C.orange);
    drawText(g, it.name, cx, 36, itemColor(it), { align: 'center', shadow: C.black });
    drawText(g, s ? `+${lvl}  >  +${lvl + 1}` : `+${lvl} (max)`, cx, 46, C.yellow, { align: 'center', scale: 2, outline: C.black });
    // Kowadło, przedmiot i młot (unosi się i opada przy każdym z 3 uderzeń).
    r.rect(cx - 22, 88, 44, 6, C.dgray); r.rect(cx - 14, 94, 28, 6, C.slate); r.rect(cx - 22, 88, 44, 1, C.lgray);
    drawSprite(g, BASE_BY_ID[it.base].icon, cx, 78, { scale: 2, flash: this.hammer > 0 && Math.floor(this.hammer * 10) % 3 === 0 });
    const ph = this.hammer > 0 ? ((HAMMER_T - this.hammer) % 0.3) / 0.3 : 0;
    const hy = 86 - (this.hammer > 0 ? Math.round(Math.abs(Math.sin(ph * Math.PI)) * 14) : 0);
    r.rect(cx + 18, hy - 6, 12, 8, C.lgray); r.rect(cx + 18, hy - 6, 12, 2, C.white); r.rect(cx + 28, hy - 2, 14, 3, C.brown);
    for (const sp of this.sparks) r.rect(sp.x, sp.y, 2, 2, sp.t > 0.3 ? C.yellow : C.orange);
    if (this.result) {
      const col = OUTCOME_COL[this.result.outcome], big = { success: 'SUKCES!', fail: 'Porażka', down: 'Spadek!', crack: 'PĘKNIĘCIE!', destroy: 'ZNISZCZONY!' }[this.result.outcome];
      drawText(g, big, cx, 64, col, { align: 'center', scale: 2, outline: C.black });
    }
    if (!s) return;
    const ch = forgeChance(it, this.opts), risks = failRisks(it, this.opts), pct = (v: number) => `${Math.round(v * 100)}%`;
    const parts = [pct(ch.base), ch.pity && `litość ${pct(ch.pity)}`, ch.dragon && `smok ${pct(ch.dragon)}`, ch.risk && `ryzyko ${pct(ch.risk)}`].filter(Boolean);
    drawText(g, `Szansa: ${parts.join(' + ')}${parts.length > 1 ? ` = ${pct(ch.total)}` : ''}`, x + 8, 103, ch.total >= 0.5 ? C.lime : ch.total >= 0.2 ? C.yellow : C.salmon);
    const mat = MAT_BY_ID[s.mat], have = run.mats[s.mat];
    drawSprite(g, mat.icon, x + 15, 120);
    drawText(g, `${tr(mat.name)} ${have}/${s.count}   ${fmt(forgeGold(run, it))} zł`, x + 25, 114, have >= s.count ? C.white : C.salmon);
    const fail = risks.crack > 0 ? `${this.opts.risk ? 'ZNISZCZENIE' : 'pęknięcie'} ${pct(risks.crack)}` : '';
    const failText = [risks.down > 0 && `spadek ${pct(risks.down)}`, fail].filter(Boolean).join(', ') || 'nic nie tracisz poza materiałem';
    drawText(g, `Porażka: ${failText}`, x + 8, 125, this.opts.risk && risks.crack ? C.red : C.lgray);
    // Zwoje i tryb ryzyka.
    OPT_KEYS.forEach((k, i) => {
      const y = OPT_Y + i * OPT_H, on = this.opts[k];
      const label = k === 'risk' ? `Ryzyko: +${Math.round(BAL.forge.risk * 100)}%, pęknięcie = zniszczenie` : `${tr(OPT_LABEL[k])} (${run.scrolls[k]})`;
      if (i === this.optSel) r.roundFrame(x + 4, y - 1, DET_W - 8, OPT_H - 1, 2, C.yellow, 0.5);
      r.rect(x + 8, y + 2, 7, 7, C.black);
      if (on) r.rect(x + 9, y + 3, 5, 5, k === 'risk' ? C.red : C.lime);
      drawText(g, `${i + 1}`, x + 18, y, C.lavender);
      drawText(g, label, x + 26, y, on ? (k === 'risk' ? C.red : C.white) : k !== 'risk' && !run.scrolls[k] ? C.lavender : C.lgray);
    });
    // Najbliższy próg kuźni (Przebudzenie z opisem dla typu przedmiotu).
    const tier = FORGE_TIERS.find((t) => t.at > lvl);
    if (tier) {
      const desc = tier.at === 9 ? `${AWAKENINGS[BASE_BY_ID[it.base].kind].name}: ${AWAKENINGS[BASE_BY_ID[it.base].kind].desc(1)}` : tier.desc;
      wrapText(`Próg +${tier.at} ${tier.name}: ${desc}`, DET_W - 16).slice(0, 2).forEach((l, k) => drawText(g, l, x + 8, 187 + k * 10, C.cyan));
    }
    const block = forgeBlock(run, it, this.opts);
    button(r, x + 40, FORGE_BTN_Y, DET_W - 80, 16, this.hammer > 0 ? 'Kucie...' : block ?? (this.confirmRisk ? '[Enter] Na pewno?' : '[Enter] Kuj'), { accent: this.opts.risk ? C.red : C.gold, col: block ? C.salmon : undefined, pulse: !block && this.hammer <= 0 });
  }
}
