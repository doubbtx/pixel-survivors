import { W, type Renderer } from '../core/renderer';
import type { Input } from '../core/input';
import { C } from '../core/palette';
import { drawText, wrapText } from '../core/font';
import { sfx } from '../core/audio';
import { rng } from '../core/rng';
import { drawSprite } from '../gfx/sprites';
import { RARITY, rollOffer, cardPool, type CardDef, type CardSource, type Rarity } from '../data/cards';
import type { Run } from '../game/run';
import { button, dim, panel, inside } from './widgets';
import { drawTagGain } from './synergies';

const CARD_W = 136;
const CARD_H = 166;
const CARD_Y = 34;
const BTN_Y = 208;
const PRISM_CYCLE = [C.pink, C.blue, C.cyan, C.lime, C.yellow, C.orange, C.salmon];

const SOURCE_LABEL: Record<CardSource, string> = { level: 'za awans', fight: 'za walkę', elite: 'za elitę', boss: 'za bossa', shop: 'ze sklepu' };

/** Kolor ramki karty; pryzmatyczne mienią się kolorami. */
export function rarityColor(r: Rarity, step: number): number {
  return r === 'prism' ? PRISM_CYCLE[Math.floor(step / 6) % PRISM_CYCLE.length] : RARITY[r].color;
}

export function drawCard(r: Renderer, c: CardDef, x: number, y: number, selected: boolean, step: number, stacks: number): void {
  const col = rarityColor(c.rarity, step);
  panel(r, x, y, CARD_W, CARD_H, col);
  if (c.rarity !== 'silver') r.frame(x + 4, y + 4, CARD_W - 8, CARD_H - 8, col);
  if (selected) r.frame(x - 2, y - 2, CARD_W + 4, CARD_H + 4, C.white);
  const g = r.g;
  const cx = x + CARD_W / 2;
  // Narożne klejnoty w kolorze rzadkości.
  for (const [gx, gy] of [[x + 4, y + 4], [x + CARD_W - 9, y + 4], [x + 4, y + CARD_H - 9], [x + CARD_W - 9, y + CARD_H - 9]]) {
    r.rect(gx + 2, gy, 1, 5, C.black); r.rect(gx, gy + 2, 5, 1, C.black);
    r.rect(gx + 1, gy + 1, 3, 3, col); r.rect(gx + 1, gy + 1, 1, 1, C.white);
  }
  drawText(g, c.cursed ? 'Przeklęta' : RARITY[c.rarity].name, cx, y + 9, c.cursed ? C.hotpink : col, { align: 'center', shadow: C.black });
  // Ikona karty na poświacie w kolorze rzadkości.
  r.withAlpha(0.22, () => r.circle(cx, y + 40, 21, c.cursed ? C.hotpink : col, true));
  r.withAlpha(0.6, () => r.circle(cx, y + 40, 17, C.black, true));
  r.circle(cx, y + 40, 18, c.cursed ? C.plum : col);
  drawSprite(g, c.icon!, cx, y + 40, { scale: 2 });
  // Pryzmatyczne: przesuwający się po karcie pas światła.
  if (c.rarity === 'prism') {
    const sx = x + ((step * 3) % (CARD_W + 60)) - 30;
    r.withAlpha(0.12, () => { for (let i = 0; i < 10; i++) r.rect(Math.max(x + 3, Math.min(x + CARD_W - 4, sx + i)), y + 3, 1, CARD_H - 6, C.white); });
  }
  let ly = y + 64;
  for (const line of wrapText(c.name, CARD_W - 16)) {
    drawText(g, line, cx, ly, C.white, { align: 'center', shadow: C.black });
    ly += 12;
  }
  drawText(g, c.tags.join(' / '), cx, ly, C.lavender, { align: 'center' });
  ly += 15;
  for (const line of wrapText(c.desc, CARD_W - 18).slice(0, 6)) {
    drawText(g, line, cx, ly, C.lgray, { align: 'center' });
    ly += 11;
  }
  const foot = [c.hero ? 'Bohater' : '', stacks > 0 ? `Masz x${stacks}` : ''].filter(Boolean).join('   ');
  if (foot) drawText(g, foot, cx, y + CARD_H - 32, C.gold, { align: 'center', shadow: C.black });
}

/**
 * Wybór karty (augmentu): 3 karty tej samej rzadkości, wybierasz 1.
 * [R] losuje ponownie tylko zaznaczoną kartę (zasób runu: losowania kart).
 */
export class CardPickView {
  rarity: Rarity;
  cards: CardDef[];
  sel = 0;
  private step = 0;
  /** Chwila otwarcia (animacja wjazdu kart). */
  private readonly born = performance.now();

  constructor(private readonly run: Run, private readonly source: CardSource) {
    const offer = rollOffer(run, source);
    this.rarity = offer.rarity;
    this.cards = offer.cards;
    run.noteCardsSeen(this.cards.map((c) => c.id));
    sfx.play('chest');
  }

  private cardX(i: number): number {
    const n = this.cards.length;
    const total = n * CARD_W + (n - 1) * 14;
    return (W - total) / 2 + i * (CARD_W + 14);
  }

  private reroll(i: number): void {
    if (this.run.cardRerolls <= 0) return;
    const pool = cardPool(this.run, this.rarity, this.cards.map((c) => c.id));
    if (pool.length === 0) return;
    this.cards[i] = rng.pick(pool);
    this.run.noteCardsSeen([this.cards[i].id]);
    this.run.cardRerolls--;
    sfx.play('select');
  }

  private choose(i: number): boolean {
    const c = this.cards[i];
    if (!c) return false;
    this.run.addCard(c.id);
    sfx.play('levelup');
    return true;
  }

  /** Zwraca true, gdy karta została wybrana. */
  update(input: Input): boolean {
    this.step++;
    const n = this.cards.length;
    if (n === 0) return true;
    if (input.pressed('left')) this.sel = (this.sel - 1 + n) % n;
    if (input.pressed('right')) this.sel = (this.sel + 1) % n;
    if (input.pressed('confirm')) return this.choose(this.sel);
    const nums = ['n1', 'n2', 'n3'] as const;
    for (let i = 0; i < nums.length; i++) if (input.pressed(nums[i])) return this.choose(i);
    if (input.pressed('reroll')) this.reroll(this.sel);

    const m = input.mouse;
    for (let i = 0; i < n; i++) {
      const x = this.cardX(i);
      if (inside(m.x, m.y, x, CARD_Y, CARD_W, CARD_H)) {
        this.sel = i;
        if (input.pressed('click')) return this.choose(i);
      }
      if (input.pressed('click') && inside(m.x, m.y, x + 28, BTN_Y, CARD_W - 56, 20)) this.reroll(i);
    }
    return false;
  }

  render(r: Renderer): void {
    dim(r);
    const col = rarityColor(this.rarity, this.step);
    drawText(r.g, `Karta ${RARITY[this.rarity].name.toLowerCase()} - ${SOURCE_LABEL[this.source]}`, W / 2, 10, col, { align: 'center', scale: 2, outline: C.black });
    const t = (performance.now() - this.born) / 1000;
    this.cards.forEach((c, i) => {
      // Wjazd kart od dołu jedna po drugiej; pryzmatyczne z błyskiem.
      const k = Math.max(0, Math.min(1, (t - i * 0.08) / 0.25));
      if (k <= 0) return;
      const x = this.cardX(i), y = CARD_Y + Math.round((1 - k) ** 3 * 30);
      const stacks = this.run.cards.find((kk) => kk.id === c.id)?.stacks ?? 0;
      r.withAlpha(k, () => drawCard(r, c, x, y, i === this.sel, this.step, stacks));
      const flash = this.rarity === 'prism' ? 0.7 - (t - i * 0.08 - 0.25) * 2.5 : 0;
      if (flash > 0) r.withAlpha(Math.min(0.7, flash), () => r.rect(x + 2, y + 2, CARD_W - 4, CARD_H - 4, C.white));
      // Karta, której nie ma jeszcze w kolekcji.
      if (!this.run.knownCards.has(c.id)) drawText(r.g, 'Nowa!', x + CARD_W - 8, CARD_Y - 4, C.lime, { align: 'right', outline: C.black });
      // Postęp synergii po wyborze (zielony = nowy próg).
      drawTagGain(r, this.run, c.tags, x + CARD_W / 2, CARD_Y + CARD_H - 13);
      const can = this.run.cardRerolls > 0;
      button(r, x + 28, BTN_Y, CARD_W - 56, 20, i === this.sel ? '[R] Losuj' : 'Losuj', { active: i === this.sel && can, accent: C.lavender, col: can ? undefined : C.dgray });
    });
    drawText(r.g, `Losowania kart: ${this.run.cardRerolls}    1-3 / klik: wybierz`, W / 2, 238, C.lavender, { align: 'center', shadow: C.black });
  }
}
