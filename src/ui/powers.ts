import { W, type Renderer } from '../core/renderer';
import type { Input } from '../core/input';
import { C } from '../core/palette';
import { drawText, wrapText } from '../core/font';
import { sfx } from '../core/audio';
import { drawSprite } from '../gfx/sprites';
import { BAL } from '../data/balance';
import { BOSS_POWER_BY_ID, type BossPowerDef } from '../data/enemies';
import type { Run } from '../game/run';
import { rollPowerOffer, takePower } from '../systems/powers';
import { dim, inside, cardFrame } from './widgets';

const CARD_W = 132, CARD_H = 150, CARD_Y = 50;

/**
 * Kradzież mocy po bossie: 3 nazwane ataki bossa do wyboru (1-3, klik, strzałki + Enter), X pomija.
 * Posiadana moc w ofercie = ulepszenie; inna zastępuje obecną.
 */
export class PowerPickView {
  private readonly options: BossPowerDef[];
  private sel = 0;

  constructor(private readonly run: Run) {
    this.options = rollPowerOffer(run);
    sfx.play('chest');
  }

  private cardX(i: number): number {
    const n = this.options.length;
    return (W - (n * CARD_W + (n - 1) * 12)) / 2 + i * (CARD_W + 12);
  }

  private choose(i: number): boolean {
    const o = this.options[i];
    if (!o) return false;
    takePower(this.run, o.id);
    this.run.showBanner(`Moc bossa: ${o.name}!`);
    sfx.play('levelup');
    return true;
  }

  /** Zwraca true, gdy wybór jest zakończony (wybrana moc albo pominięcie). */
  update(input: Input): boolean {
    const n = this.options.length;
    if (n === 0 || input.pressed('skip')) return true;
    if (input.pressed('left')) this.sel = (this.sel - 1 + n) % n;
    if (input.pressed('right')) this.sel = (this.sel + 1) % n;
    if (input.pressed('confirm')) return this.choose(this.sel);
    const nums = ['n1', 'n2', 'n3'] as const;
    for (let i = 0; i < n; i++) if (input.pressed(nums[i])) return this.choose(i);
    const m = input.mouse;
    for (let i = 0; i < n; i++) {
      if (!inside(m.x, m.y, this.cardX(i), CARD_Y, CARD_W, CARD_H)) continue;
      this.sel = i;
      if (input.pressed('click')) return this.choose(i);
    }
    return false;
  }

  render(r: Renderer): void {
    const g = r.g, own = this.run.power;
    dim(r);
    drawText(g, 'Moc bossa', W / 2, 10, C.yellow, { align: 'center', scale: 2, outline: C.black });
    drawText(g, 'Ukradnij jeden z ataków bossa. Strzela sam, w twoich wrogów.', W / 2, 37, C.lavender, { align: 'center', shadow: C.black });
    this.options.forEach((o, i) => {
      const x = this.cardX(i), on = i === this.sel, up = own?.id === o.id;
      cardFrame(r, x, CARD_Y, CARD_W, CARD_H, on ? C.pink : C.slate, on);
      r.withAlpha(0.3, () => r.circle(x + CARD_W / 2, CARD_Y + 30, 20, C.plum, true));
      drawSprite(g, o.icon, x + CARD_W / 2, CARD_Y + 30, { scale: 2 });
      drawText(g, o.name, x + CARD_W / 2, CARD_Y + 54, up ? C.yellow : C.white, { align: 'center', shadow: C.black });
      drawText(g, up ? `Ulepszenie: poziom ${own!.level + 1}/${BAL.bossPowers.maxLevel}` : `Faza ${o.phase + 1} bossa`, x + CARD_W / 2, CARD_Y + 66, up ? C.lime : C.lavender, { align: 'center' });
      wrapText(o.desc, CARD_W - 16).forEach((l, k) => drawText(g, l, x + 8, CARD_Y + 82 + k * 11, C.lgray));
      if (up) drawText(g, `+${Math.round(BAL.bossPowers.perLevel * 100)}% obrażeń`, x + CARD_W / 2, CARD_Y + CARD_H - 16, C.lime, { align: 'center' });
      drawText(g, String(i + 1), x + 6, CARD_Y + 4, on ? C.yellow : C.lavender);
    });
    const cur = own ? `Obecna: ${BOSS_POWER_BY_ID[own.id].name} (poz. ${own.level}). Inna moc ją zastąpi.` : 'Nie masz jeszcze mocy bossa.';
    drawText(g, cur, W / 2, CARD_Y + CARD_H + 10, C.lavender, { align: 'center', shadow: C.black });
    drawText(g, '1-3 / klik: wybierz    X: pomiń', W / 2, CARD_Y + CARD_H + 24, C.lavender, { align: 'center', shadow: C.black });
  }
}
