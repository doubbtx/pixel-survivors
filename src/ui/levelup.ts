import { W, type Renderer } from '../core/renderer';
import type { Input } from '../core/input';
import { C } from '../core/palette';
import { drawText, wrapText } from '../core/font';
import { sfx } from '../core/audio';
import { drawSprite } from '../gfx/sprites';
import { generateOptions, applyOption, canBanish, optionScore, type Option } from '../systems/levelup';
import type { Run } from '../game/run';
import { panel, dim, inside } from './widgets';
import { drawTagGain } from './synergies';

const CARD_W = 108;
const CARD_H = 150;
const CARD_Y = 42;
const BTN_Y = 204;
const BTN_W = 120;

/**
 * Karta ulepszenia: rodzaj i poziom, ikona, nazwa, co daje, podpowiedź (ewolucje) na fioletowo
 * i na dole tagi synergii z postępem po wyborze (zielony = nowy próg). `recommended` = znaczek "Polecane".
 */
function drawOptionCard(r: Renderer, run: Run, o: Option, x: number, y: number, selected: boolean, warn: boolean, recommended: boolean): void {
  panel(r, x, y, CARD_W, CARD_H, warn ? C.red : selected ? C.gold : recommended ? C.yellow : C.slate);
  const cx = x + CARD_W / 2;
  const isNew = o.kind === 'weaponNew' || o.kind === 'passiveNew';
  const evolve = o.kind === 'evolve' || o.kind === 'abilityEvolve';
  const augment = o.kind === 'augment';
  const tagCol = evolve ? C.yellow : isNew ? C.lime : augment ? C.cyan : C.lavender;
  drawText(r.g, o.tag, cx, y + 7, tagCol, { align: 'center', shadow: C.black });
  if (recommended) drawText(r.g, 'Polecane', cx, y - 11, C.yellow, { align: 'center', outline: C.black });
  const glow = evolve ? C.gold : isNew ? C.lime : augment ? C.cyan : C.blue;
  r.withAlpha(0.2, () => r.circle(cx, y + 36, 20, glow, true));
  r.withAlpha(0.6, () => r.circle(cx, y + 36, 16, C.black, true));
  r.circle(cx, y + 36, 17, glow);
  drawSprite(r.g, o.icon, cx, y + 36, { scale: 2 });
  let ly = y + 60;
  for (const line of wrapText(o.name, CARD_W - 12)) {
    drawText(r.g, line, cx, ly, o.color, { align: 'center', shadow: C.black });
    ly += 12;
  }
  ly += 4;
  const hint = o.hint ? wrapText(o.hint, CARD_W - 12).slice(0, 2) : [];
  const descMax = (o.tags.length ? 5 : 6) - hint.length;
  for (const line of wrapText(o.desc, CARD_W - 14).slice(0, descMax)) {
    drawText(r.g, line, cx, ly, C.lgray, { align: 'center' });
    ly += 11;
  }
  for (const line of hint) {
    drawText(r.g, line, cx, ly + 2, C.lavender, { align: 'center' });
    ly += 11;
  }
  // Tagi synergii, które wzmacnia ta opcja, z postępem po wyborze.
  if (o.tags.length) drawTagGain(r, run, o.tags, cx, y + CARD_H - 14);
}

/**
 * Ekran awansu: 3 (z Koniczyną 4) karty, wybór klawiszami 1-4 / strzałkami / myszą.
 * Zasoby runu: [R] losuj ponownie, [X] pomiń, [B] tryb wygnania (usuwa nową broń/pasywkę z puli).
 * Najlepiej oceniona opcja (optionScore) ma znaczek "Polecane".
 */
export class LevelUpView {
  options: Option[] = [];
  sel = 0;
  banishMode = false;

  constructor(private readonly run: Run) {
    this.roll();
    sfx.play('levelup');
  }

  private get count(): number {
    return Math.min(4, 3 + this.run.stats.luck);
  }

  private roll(): void {
    this.options = generateOptions(this.run, this.count);
    this.sel = Math.min(this.sel, this.options.length - 1);
  }

  private cardX(i: number): number {
    const n = this.options.length;
    const total = n * CARD_W + (n - 1) * 10;
    return (W - total) / 2 + i * (CARD_W + 10);
  }

  private buttons(): { label: string; x: number; act: () => boolean }[] {
    const run = this.run;
    return [
      { label: `[R] Losuj ponownie (${run.rerolls})`, x: W / 2 - BTN_W * 1.5 - 10, act: () => this.reroll() },
      { label: `[X] Pomiń (${run.skips})`, x: W / 2 - BTN_W / 2, act: () => this.skip() },
      { label: `[B] Wygnaj (${run.banishes})`, x: W / 2 + BTN_W / 2 + 10, act: () => this.toggleBanish() },
    ];
  }

  private reroll(): boolean {
    if (this.run.rerolls <= 0) return false;
    this.run.rerolls--;
    this.roll();
    sfx.play('select');
    return false;
  }

  private skip(): boolean {
    if (this.run.skips <= 0) return false;
    this.run.skips--;
    return true;
  }

  private toggleBanish(): boolean {
    if (this.run.banishes > 0) this.banishMode = !this.banishMode;
    return false;
  }

  /** Zwraca true, gdy wybór został dokonany (ekran do zamknięcia). */
  private choose(i: number): boolean {
    const o = this.options[i];
    if (!o) return false;
    if (this.banishMode) {
      if (!canBanish(o)) return false;
      this.run.banished.add(o.id);
      this.run.banishes--;
      this.banishMode = false;
      const repl = generateOptions(this.run, 1, this.options)[0];
      if (repl) this.options[i] = repl;
      else this.options.splice(i, 1);
      this.sel = 0;
      sfx.play('kill');
      return this.options.length === 0;
    }
    applyOption(this.run, o);
    sfx.play('select');
    return true;
  }

  update(input: Input): boolean {
    const n = this.options.length;
    if (input.pressed('left')) this.sel = (this.sel - 1 + n) % n;
    if (input.pressed('right')) this.sel = (this.sel + 1) % n;
    if (input.pressed('confirm')) return this.choose(this.sel);
    const nums = ['n1', 'n2', 'n3', 'n4'] as const;
    for (let i = 0; i < nums.length; i++) if (input.pressed(nums[i])) return this.choose(i);
    if (input.pressed('reroll')) this.reroll();
    if (input.pressed('skip')) return this.skip();
    if (input.pressed('banish')) this.toggleBanish();

    const m = input.mouse;
    for (let i = 0; i < this.options.length; i++) {
      if (!inside(m.x, m.y, this.cardX(i), CARD_Y, CARD_W, CARD_H)) continue;
      this.sel = i;
      if (input.pressed('click')) return this.choose(i);
    }
    if (input.pressed('click')) {
      for (const b of this.buttons()) if (inside(m.x, m.y, b.x, BTN_Y, BTN_W, 20)) return b.act();
    }
    return false;
  }

  render(r: Renderer): void {
    dim(r);
    const title = this.banishMode ? 'Wybierz kartę do wygnania' : `Awans! LV ${this.run.level - this.run.pendingLevels + 1}`;
    drawText(r.g, title, W / 2, 10, this.banishMode ? C.salmon : C.yellow, { align: 'center', scale: 2, outline: C.black });
    const scores = this.options.map((o) => optionScore(this.run, o));
    const best = scores.indexOf(Math.max(...scores));
    this.options.forEach((o, i) => {
      drawOptionCard(r, this.run, o, this.cardX(i), CARD_Y, i === this.sel, this.banishMode && canBanish(o), !this.banishMode && i === best && this.options.length > 1);
      drawText(r.g, String(i + 1), this.cardX(i) + 8, CARD_Y + CARD_H - 16, C.slate);
    });
    for (const b of this.buttons()) {
      const on = b.label.includes('Wygnaj') && this.banishMode;
      panel(r, b.x, BTN_Y, BTN_W, 20, on ? C.red : C.slate);
      drawText(r.g, b.label, b.x + BTN_W / 2, BTN_Y + 4, on ? C.salmon : C.white, { align: 'center', shadow: C.black });
    }
    drawText(r.g, 'Wygnanie usuwa nową broń lub pasywkę z puli do końca runu.   1-4 / klik: wybór', W / 2, 236, C.lavender, { align: 'center', shadow: C.black });
  }
}
