import { W, type Renderer } from '../core/renderer';
import type { Input } from '../core/input';
import { C } from '../core/palette';
import { drawText, wrapText } from '../core/font';
import { sfx } from '../core/audio';
import { BAL } from '../data/balance';
import { BOSS_POWER_BY_ID, type BossPowerDef } from '../data/enemies';
import type { Run } from '../game/run';
import { rollPowerOffer, takePower } from '../systems/powers';
import { dim, inside, cardFrame, cardIcon, pill, button } from './widgets';
import { hintShowing } from './hints';

const CARD_W = 132, CARD_H = 150, CARD_Y = 50;
const SKIP_BTN: [number, number, number, number] = [W / 2 - 40, CARD_Y + CARD_H + 21, 80, 14];

/**
 * Kradzież mocy po bossie: 3 nazwane ataki bossa do wyboru (1-3, klik, strzałki + Enter), X pomija.
 * Posiadana moc w ofercie = ulepszenie; inna zastępuje obecną.
 */
export class PowerPickView {
  private readonly options: BossPowerDef[];
  private sel = 0;
  private readonly born = performance.now();
  /** Ostatni ruch myszy (null przed pierwszą klatką): kursor odpoczywający nad kartą nie nadpisuje wyboru klawiaturą/padem. */
  private lastMouse: number | null = null;

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
    const moved = this.lastMouse !== null && input.mouse.lastMove !== this.lastMouse;
    this.lastMouse = input.mouse.lastMove;
    const n = this.options.length;
    if (n === 0 || input.pressed('skip')) return true;
    // Pomiń: przycisk pod kartami (dotyk: wcześniej tylko klawisz X).
    if (input.pressed('click') && !hintShowing() && inside(input.mouse.x, input.mouse.y, ...SKIP_BTN)) return true;
    if (input.pressed('left')) this.sel = (this.sel - 1 + n) % n;
    if (input.pressed('right')) this.sel = (this.sel + 1) % n;
    if (input.pressed('confirm')) return this.choose(this.sel);
    const nums = ['n1', 'n2', 'n3'] as const;
    for (let i = 0; i < n; i++) if (input.pressed(nums[i])) return this.choose(i);
    const m = input.mouse;
    for (let i = 0; i < n; i++) {
      if (!inside(m.x, m.y, this.cardX(i), CARD_Y, CARD_W, CARD_H)) continue;
      if (moved || input.pressed('click')) this.sel = i;
      if (input.pressed('click')) return this.choose(i);
    }
    return false;
  }

  render(r: Renderer): void {
    const g = r.g, own = this.run.power;
    dim(r);
    drawText(g, 'Moc bossa', W / 2, 10, C.yellow, { align: 'center', scale: 2, outline: C.black });
    drawText(g, 'Ukradnij jeden z ataków bossa. Strzela sam, w twoich wrogów.', W / 2, 37, C.lavender, { align: 'center', shadow: C.black });
    const t = (performance.now() - this.born) / 1000;
    this.options.forEach((o, i) => {
      // Wjazd kart od dołu jedna po drugiej (jak przy awansie); zaznaczona lekko uniesiona.
      const k = Math.max(0, Math.min(1, (t - i * 0.08) / 0.25));
      if (k <= 0) return;
      const x = this.cardX(i), on = i === this.sel, up = own?.id === o.id, cy = CARD_Y + Math.round((1 - k) ** 3 * 30) - (on ? 3 : 0);
      r.withAlpha(k, () => {
        cardFrame(r, x, cy, CARD_W, CARD_H, on ? C.pink : C.slate, on);
        // Wnętrze jak karty awansu: ikona w kole, nazwa, pigułka statusu (faza bossa albo ulepszenie), opis.
        cardIcon(r, o.icon, x + CARD_W / 2, cy + 30, C.plum, on ? C.pink : C.plum);
        drawText(g, o.name, x + CARD_W / 2, cy + 54, up ? C.yellow : C.white, { align: 'center', shadow: C.black });
        pill(r, x + CARD_W / 2, cy + 67, up ? `Ulepszenie: poziom ${own!.level + 1}/${BAL.bossPowers.maxLevel}` : `Faza ${o.phase + 1} bossa`, up ? C.lime : C.lavender, 'center');
        wrapText(o.desc, CARD_W - 16).forEach((l, j) => drawText(g, l, x + 8, cy + 82 + j * 11, C.lgray));
        if (up) pill(r, x + CARD_W / 2, cy + CARD_H - 15, `+${Math.round(BAL.bossPowers.perLevel * 100)}% obrażeń`, C.lime, 'center');
        drawText(g, String(i + 1), x + 6, cy + 4, on ? C.yellow : C.lavender);
      });
    });
    const cur = own ? `Obecna: ${BOSS_POWER_BY_ID[own.id].name} (poz. ${own.level}). Inna moc ją zastąpi.` : 'Nie masz jeszcze mocy bossa.';
    drawText(g, cur, W / 2, CARD_Y + CARD_H + 10, C.lavender, { align: 'center', shadow: C.black });
    if (!hintShowing()) button(r, ...SKIP_BTN, 'Skip [X]');
  }
}
