import { W, type Renderer } from '../core/renderer';
import type { Input } from '../core/input';
import { C } from '../core/palette';
import { drawText, wrapText, textWidth, descS } from '../core/font';
import { sfx } from '../core/audio';
import { drawSprite } from '../gfx/sprites';
import { RARITIES } from '../data/items';
import { generateOptions, applyOption, canBanish, optionScore, type Option, type Recipe } from '../systems/levelup';
import type { Run } from '../game/run';
import { button, panel, dim, inside, slot } from './widgets';
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
  const q = o.quality ?? 0;
  // Jakość ulepszenia broni: ramka w kolorze jakości, Epickie i Legendarne pulsują jaśniej.
  const qCol = q >= 3 && !run.reduceFlash && Math.floor(performance.now() / 250) % 2 ? C.white : RARITIES[q].color;
  panel(r, x, y, CARD_W, CARD_H, warn ? C.red : selected ? C.gold : q ? qCol : recommended ? C.yellow : C.slate);
  const cx = x + CARD_W / 2;
  const isNew = o.kind === 'weaponNew' || o.kind === 'passiveNew';
  const evolve = o.kind === 'evolve' || o.kind === 'abilityEvolve' || o.kind === 'passiveEvolve' || o.kind === 'fusion';
  const augment = o.kind === 'augment';
  const tagCol = q ? RARITIES[q].color : evolve ? C.yellow : isNew ? C.white : augment ? C.cyan : C.lavender;
  drawText(r.g, o.tag, cx, y + 7, tagCol, { align: 'center', shadow: C.black });
  // Znaczek "Polecane" na górnej krawędzi karty (plakietka zamiast napisu nad kartą, który wchodził na wstęgę tytułu).
  if (recommended) {
    const bw = textWidth('Polecane') * 0.75 + 10;
    r.roundRect(cx - bw / 2, y - 5, bw, 10, 3, C.dbrown, C.black);
    r.roundFrame(cx - bw / 2 + 0.5, y - 4.5, bw - 1, 9, 3, C.yellow, 0.75);
    drawText(r.g, 'Polecane', cx, y - 3, C.yellow, { align: 'center', scale: 0.75 });
  }
  const glow = q ? RARITIES[q].color : evolve ? C.gold : isNew ? C.lgray : augment ? C.cyan : C.dgray;
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
  // Z przepisem (ikony) podpowiedź tylko, gdy mieści się w jednej linii — ikony mówią to samo.
  const hintAll = o.hint ? wrapText(o.hint, CARD_W - 12) : [];
  // Pasywka bez posiadanej broni do ewolucji: ścieżki ewolucji obrazkami (broń > ewolucja) w miejscu przepisu.
  const evoRow = !o.recipe && o.evolves?.length ? o.evolves : null;
  const big = wrapText(o.desc, CARD_W - 14), room = (o.tags.length ? 5 : 6) - (o.recipe || evoRow ? 2 : 0);
  // Duży tekst (Ustawienia): opis zawsze w pełnym rozmiarze, podpowiedź ustępuje miejsca opisowi.
  let hint = o.recipe ? (hintAll.length === 1 ? hintAll : []) : hintAll.slice(0, 2);
  if (descS() >= 1 && big.length > room - hint.length) hint = [];
  const descMax = room - hint.length;
  // Opis, który się nie mieści: zwykle małym tekstem (więcej linii w tym samym miejscu), przy dużym tekście ucięty z „...”.
  const small = big.length > descMax && descS() < 1;
  const lines = small ? wrapText(o.desc, (CARD_W - 14) / 0.75).slice(0, Math.floor((descMax * 11) / 9))
    : big.length > descMax ? [...big.slice(0, descMax - 1), `${big[descMax - 1]}...`] : big;
  for (const line of lines) {
    drawText(r.g, line, cx, ly, C.lgray, { align: 'center', scale: small ? 0.75 : 1 });
    ly += small ? 9 : 11;
  }
  for (const line of hint) {
    drawText(r.g, line, cx, ly + 2, C.lavender, { align: 'center' });
    ly += 11;
  }
  // Przepis ewolucji / fuzji ikonami, nad tagami synergii.
  if (o.recipe) drawRecipe(r, o.recipe, cx, y + CARD_H - (o.tags.length ? 38 : 26));
  else if (evoRow) drawEvoRow(r, evoRow, cx, y + CARD_H - (o.tags.length ? 38 : 26));
  // Tagi synergii, które wzmacnia ta opcja, z postępem po wyborze.
  if (o.tags.length) drawTagGain(r, run, o.tags, cx, y + CARD_H - 14);
}

/**
 * Ścieżki ewolucji pasywki: do dwóch par „broń > ewolucja” (ewolucja w złotej ramce), przy większej liczbie same ewolucje.
 */
function drawEvoRow(r: Renderer, pairs: [string, string][], cx: number, y: number): void {
  const S = 18;
  if (pairs.length <= 2) {
    const pw = S * 2 + 8, gap = 6, w = pairs.length * pw + (pairs.length - 1) * gap;
    let x = cx - w / 2;
    for (const [base, into] of pairs) {
      slot(r, x, y, S, C.slate);
      drawSprite(r.g, base, x + S / 2, y + S / 2);
      drawText(r.g, '>', x + S + 4, y + 4, C.yellow, { align: 'center', outline: C.black });
      slot(r, x + S + 8, y, S, C.gold);
      drawSprite(r.g, into, x + S + 8 + S / 2, y + S / 2);
      x += pw + gap;
    }
    return;
  }
  const w = pairs.length * (S + 3) - 3;
  pairs.forEach(([, into], i) => {
    const x = cx - w / 2 + i * (S + 3);
    slot(r, x, y, S, C.gold);
    drawSprite(r.g, into, x + S / 2, y + S / 2);
  });
}

/** „A + B → C”: małe gniazda z ikonami składników, plus, strzałka i wynik w złotej ramce. */
function drawRecipe(r: Renderer, rc: Recipe, cx: number, y: number): void {
  const S = 18, gap = 9, n = rc.parts.length;
  const w = (n + 1) * S + n * gap + 4;
  let x = cx - w / 2;
  rc.parts.forEach((icon, i) => {
    slot(r, x, y, S, C.slate);
    drawSprite(r.g, icon, x + S / 2, y + S / 2);
    x += S;
    drawText(r.g, i < n - 1 ? '+' : '>', x + gap / 2, y + 5, i < n - 1 ? C.lgray : C.yellow, { align: 'center', outline: C.black });
    x += gap;
  });
  slot(r, x + 4, y, S, C.gold);
  drawSprite(r.g, rc.result, x + 4 + S / 2, y + S / 2);
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
  /** Chwila wylosowania oferty (animacja wjazdu kart). */
  private born = 0;

  constructor(private readonly run: Run) {
    this.roll();
    sfx.play('levelup');
  }

  private get count(): number {
    return Math.min(4, 3 + this.run.stats.choices);
  }

  private roll(): void {
    this.born = performance.now();
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
    const t = (performance.now() - this.born) / 1000;
    this.options.forEach((o, i) => {
      // Wjazd kart od dołu jedna po drugiej; zaznaczona lekko uniesiona; rzadkie (Epickie+, ewolucje) z błyskiem.
      const k = Math.max(0, Math.min(1, (t - i * 0.07) / 0.22));
      if (k <= 0) return;
      const x = this.cardX(i), y = CARD_Y + Math.round((1 - (1 - (1 - k) ** 3)) * 30) - (i === this.sel ? 3 : 0);
      r.withAlpha(k, () => {
        drawOptionCard(r, this.run, o, x, y, i === this.sel, this.banishMode && canBanish(o), !this.banishMode && i === best && this.options.length > 1);
        drawText(r.g, String(i + 1), x + 8, y + CARD_H - 16, C.slate);
      });
      const rare = (o.quality ?? 0) >= 3 || o.kind === 'evolve' || o.kind === 'abilityEvolve' || o.kind === 'passiveEvolve';
      const flash = rare ? 0.7 - (t - i * 0.07 - 0.22) * 2.5 : 0;
      if (flash > 0) r.withAlpha(Math.min(0.7, flash), () => r.rect(x + 2, y + 2, CARD_W - 4, CARD_H - 4, C.white));
    });
    for (const b of this.buttons()) {
      const on = b.label.includes('Wygnaj') && this.banishMode;
      button(r, b.x, BTN_Y, BTN_W, 20, b.label, { active: on, accent: on ? C.red : C.gold, col: on ? C.salmon : undefined });
    }
    // Podpis na ciemnym tle: pod nim są sloty HUD.
    const note = 'Wygnanie usuwa nową broń lub pasywkę z puli do końca runu.   1-4 / klik: wybór', nw = textWidth(note) + 12;
    r.withAlpha(0.85, () => r.roundRect(W / 2 - nw / 2, 233, nw, 14, 4, C.black));
    drawText(r.g, note, W / 2, 236, C.lavender, { align: 'center', shadow: C.black });
  }
}
