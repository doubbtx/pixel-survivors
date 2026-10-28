import { sfx } from '../core/audio';
import { C } from '../core/palette';
import { itemColor } from '../data/items';
import type { Run } from '../game/run';
import { springMimic } from './mapsecrets';
import { comboGoldMul } from './levelevents';

/** Bazowy zasięg przyciągania kryształów (px), mnożony przez statystykę `magnet`. */
const MAGNET_BASE = 34;

/** Przyciąga obiekt do gracza z przyspieszeniem. Zwraca true, gdy został zebrany. */
function fly(run: Run, o: { x: number; y: number; v: number }, dt: number): boolean {
  const p = run.player;
  const dx = p.x - o.x, dy = p.y - o.y;
  const d = Math.hypot(dx, dy);
  if (d < 5) return true;
  o.v = Math.max(60, o.v + 400 * dt);
  const step = Math.min(d, o.v * dt);
  o.x += (dx / d) * step;
  o.y += (dy / d) * step;
  return false;
}

export function updatePickups(run: Run, dt: number): void {
  const p = run.player;
  const R = MAGNET_BASE * run.stats.magnet;
  const R2 = R * R;

  const gems = run.gems.items;
  for (let i = gems.length - 1; i >= 0; i--) {
    const g = gems[i];
    if (!g.flying && (g.x - p.x) ** 2 + (g.y - p.y) ** 2 < R2) g.flying = true;
    if (g.flying && fly(run, g, dt)) {
      run.addXp(g.value);
      sfx.play('pickup');
      // Zebranie: błysk paska XP i mały turkusowy pierścień przy bohaterze (najwyżej jeden naraz).
      if (run.xpPulse < 0.05) { const f = run.addFx('ring', p.x, p.y, C.cyan, 0.18); if (f) f.r = 7; }
      run.xpPulse = 0.15;
      run.burst(p.x, p.y - 4, C.cyan, 1, 30);
      run.gems.release(g);
    }
  }

  const items = run.pickups.items;
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    const d2 = (it.x - p.x) ** 2 + (it.y - p.y) ** 2;
    // Skrzynie trzeba podnieść osobiście; reszta reaguje na magnes.
    if (!it.flying && d2 < (it.kind === 'chest' ? 100 : R2)) it.flying = true;
    if (!it.flying || !fly(run, it, dt)) continue;
    switch (it.kind) {
      case 'meat':
        run.heal(run.stats.maxHp * 0.3 * (1 + run.flag('meatHeal')));
        sfx.play('pickup');
        break;
      case 'magnet':
        for (const g of run.gems.items) g.flying = true;
        sfx.play('levelup');
        break;
      case 'coin':
        run.gold += it.value * run.stats.greed * comboGoldMul(run);
        run.burst(p.x, p.y - 4, C.gold, 1, 30);
        sfx.play('pickup');
        break;
      case 'chest': {
        if (it.mimic) { springMimic(run, it.x, it.y); break; }
        // Łup: pierścień i napis w kolorze jakości przedmiotu.
        if (it.item) run.pendingLoot.push({ source: it.source, item: it.item });
        const col = it.item ? itemColor(it.item) : C.gold;
        const f = run.addFx('ring', p.x, p.y, col, 0.35);
        if (f) f.r = 18;
        run.burst(p.x, p.y, col, 12, 70);
        run.popText(p.x, p.y - 16, 'Łup!', col);
        sfx.play('chest');
        break;
      }
    }
    run.pickups.release(it);
  }
}
