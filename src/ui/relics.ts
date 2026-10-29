import { W, H, type Renderer } from '../core/renderer';
import type { Input } from '../core/input';
import { C } from '../core/palette';
import { drawText, wrapText, DESC, descS, descLH } from '../core/font';
import { sfx } from '../core/audio';
import { tr } from '../core/i18n';
import { rng } from '../core/rng';
import { drawSprite } from '../gfx/sprites';
import { BAL } from '../data/balance';
import { RELICS, RELIC_BY_ID, type RelicDef } from '../data/relics';
import type { Run } from '../game/run';
import { dim, inside, cardFrame, button } from './widgets';

const CARD_W = 136, CARD_H = 156, CARD_Y = 50;

/**
 * Relikwia po bossie (R2): 3 do wyboru (1-3, klik, strzałki + Enter). Przy limicie BAL.relics.max drugi krok:
 * którą z posiadanych oddać (albo „Zostaw obecne” — nowa przepada). Zaleta na zielono, wada na czerwono.
 */
export class RelicPickView {
  private readonly offer: RelicDef[];
  /** Wybrana nowa relikwia, gdy trzeba oddać jedną z posiadanych. */
  private pending: RelicDef | null = null;
  private sel = 0;

  constructor(private readonly run: Run) {
    const pool = RELICS.filter((r) => !run.relic(r.id) && (!r.mode || r.mode === run.mode));
    const out: RelicDef[] = [];
    while (out.length < BAL.relics.offer && pool.length) out.push(pool.splice(Math.floor(rng.next() * pool.length), 1)[0]);
    this.offer = out;
    sfx.play('chest');
  }

  private get list(): RelicDef[] {
    return this.pending ? this.run.relics.map((id) => RELIC_BY_ID[id]) : this.offer;
  }

  private cardX(i: number): number {
    const n = this.list.length;
    return (W - (n * CARD_W + (n - 1) * 10)) / 2 + i * (CARD_W + 10);
  }

  private take(r: RelicDef): void {
    this.run.relics.push(r.id);
    this.run.onBuildChanged();
    this.run.showBanner(`${tr('Relic')}: ${tr(r.name)}!`);
    sfx.play('levelup');
  }

  /** Zwraca true, gdy wybór jest zakończony. */
  private choose(i: number): boolean {
    const r = this.list[i];
    if (!r) return false;
    if (this.pending) {
      // Oddana relikwia: wymiana na nową.
      this.run.relics = this.run.relics.filter((id) => id !== r.id);
      this.take(this.pending);
      return true;
    }
    if (this.run.relics.length >= BAL.relics.max) { this.pending = r; this.sel = 0; sfx.play('select'); return false; }
    this.take(r);
    return true;
  }

  update(input: Input): boolean {
    const n = this.list.length;
    if (n === 0) return true;
    this.sel = Math.min(this.sel, n - 1);
    if (input.pressed('left')) { this.sel = (this.sel + n - 1) % n; sfx.play('select'); }
    if (input.pressed('right')) { this.sel = (this.sel + 1) % n; sfx.play('select'); }
    if (input.pressed('confirm')) return this.choose(this.sel);
    const nums = ['n1', 'n2', 'n3'] as const;
    for (let i = 0; i < n; i++) if (input.pressed(nums[i])) return this.choose(i);
    const m = input.mouse;
    for (let i = 0; i < n; i++) {
      if (!inside(m.x, m.y, this.cardX(i), CARD_Y, CARD_W, CARD_H)) continue;
      this.sel = i;
      if (input.pressed('click')) return this.choose(i);
    }
    // Przy wymianie: zostaw obecne (nowa relikwia przepada).
    if (this.pending && (input.pressed('back') || input.pressed('skip') || (input.pressed('click') && inside(m.x, m.y, W / 2 - 60, H - 34, 120, 16)))) return true;
    return false;
  }

  render(r: Renderer): void {
    dim(r);
    const g = r.g;
    drawText(g, this.pending ? `${tr('Swap a relic')}: ${tr(this.pending.name)}` : 'Relic - boss reward', W / 2, 10, C.yellow, { align: 'center', scale: 2, outline: C.black });
    drawText(g, this.pending ? 'You can carry 3 relics. Pick one to give up.' : 'Relics last the whole run (max 3). Each one has a price.', W / 2, 36, C.lavender, { align: 'center' });
    this.list.forEach((rel, i) => {
      const x = this.cardX(i), y = CARD_Y - (i === this.sel ? 3 : 0), cx = x + CARD_W / 2;
      cardFrame(r, x, y, CARD_W, CARD_H, this.pending ? C.salmon : C.gold, i === this.sel);
      drawSprite(g, rel.icon, cx, y + 22, { scale: 2 });
      let ly = y + 42;
      for (const l of wrapText(rel.name, CARD_W - 12)) { drawText(g, l, cx, ly, C.yellow, { align: 'center', shadow: C.black }); ly += 11; }
      ly += 3;
      const tw = (CARD_W - 14) / descS(), lh = descLH();
      for (const l of wrapText(rel.desc, tw)) { drawText(g, l, cx, ly, C.lime, { ...DESC, align: 'center' }); ly += lh; }
      ly += 3;
      for (const l of wrapText(rel.drawback, tw)) { drawText(g, l, cx, ly, C.salmon, { ...DESC, align: 'center' }); ly += lh; }
      drawText(g, String(i + 1), x + 8, y + CARD_H - 14, C.lavender);
    });
    if (this.pending) button(r, W / 2 - 60, H - 34, 120, 16, 'Keep current [Esc]');
    drawText(g, '1-3 / click: choose', W / 2, H - 14, C.lavender, { align: 'center', shadow: C.black });
  }
}
