import { W, H } from '../core/renderer';
import { C } from '../core/palette';
import { drawText } from '../core/font';
import { BAL } from '../data/balance';
import { RARITIES, rollItem, upgradeItem } from '../data/items';
import type { App, Screen } from './app';
import { panel } from './widgets';

/**
 * Podgląd balansu (Ustawienia, tryb debug): wartości do sprawdzenia bez grania — HP zbroi z poziomem przedmiotu
 * i po wszystkich ulepszeniach w kowadle, skalowanie wrogów w czasie i miękkie limity statystyk.
 */
export class BalanceScreen implements Screen {
  private readonly lines: [string, string][] = [];

  constructor(private readonly app: App, private readonly back: Screen) {
    const L = this.lines;
    L.push(['Zbroja (Legendarna): maks. HP', 'z łupu / po ' + BAL.anvil.maxUpgrades + ' ulepszeniach']);
    for (const ilvl of [1, 5, 10, 15]) {
      const it = rollItem(ilvl, 'boss', 0, 'armor');
      it.rarity = RARITIES.length - 1;
      const raw = 20 * BAL.itemHpScale(ilvl) * RARITIES[it.rarity].power;
      it.implicit.value = raw;
      while (upgradeItem(it));
      L.push([`  poziom przedmiotu ${ilvl}`, `${Math.round(raw)} / ${Math.round(it.implicit.value)}`]);
    }
    L.push(['Wrogowie (głębokość 1): HP / obrażenia', 'mnożnik czasu']);
    for (const min of [1, 5, 10, 15]) {
      const t = min * 60;
      L.push([`  minuta ${min}`, `x${BAL.enemyHpMul(t).toFixed(1)} / x${BAL.enemyDmgMul(t).toFixed(2)}, elity co ${Math.round(BAL.eliteEvery * BAL.eliteGap(t))} s, salwy x${BAL.patternDensity(t).toFixed(2)}`]);
    }
    L.push(['Siła buildu (BAL.power)', `mnożnik 1-${BAL.power.max}, obrażenia ^${BAL.power.dmgExp}, cel TTK ${BAL.power.ttk(0).toFixed(2)}-${BAL.power.ttk(900).toFixed(2)} s`]);
    L.push(['Miękkie limity: krytyk 50% / 100% / 200%', [0.5, 1, 2].map((v) => `${Math.round(BAL.softCap(v, BAL.softCaps.crit!) * 100)}%`).join(' / ')]);
    L.push(['  szybkość ruchu +100% / +200%', [1, 2].map((v) => `+${Math.round(BAL.softCap(v, BAL.softCaps.speedBonus!) * 100)}%`).join(' / ')]);
  }

  update(): void {
    const inp = this.app.input;
    if (inp.pressed('back') || inp.pressed('confirm') || inp.pressed('click')) this.app.go(this.back);
  }

  render(): void {
    const r = this.app.r, g = r.g;
    r.clear(C.black);
    drawText(g, 'Podgląd balansu', W / 2, 8, C.yellow, { align: 'center', scale: 2, outline: C.black });
    panel(r, 12, 34, W - 24, H - 46);
    this.lines.forEach(([k, v], i) => {
      const head = !k.startsWith('  ');
      drawText(g, k, 22, 42 + i * 13, head ? C.yellow : C.lgray);
      drawText(g, v, W - 22, 42 + i * 13, head ? C.lavender : C.white, { align: 'right' });
    });
  }
}
