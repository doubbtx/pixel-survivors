import { C } from '../core/palette';
import { rng } from '../core/rng';
import type { Run } from '../game/run';

/** Odstęp strzałów wieżyczki (s) bez bonusów. */
const FIRE_EVERY = 0.7;

/** Stawia wieżyczkę obok gracza (efekty kart z tagiem Przywołania). */
export function spawnTurret(run: Run, x: number, y: number, life: number): void {
  const t = run.turrets.obtain();
  if (!t) return;
  t.x = x + rng.range(-14, 14);
  t.y = y + rng.range(-14, 14);
  t.life = life * run.stats.duration;
  t.timer = 0;
  run.burst(t.x, t.y, C.lgray, 8, 30);
}

/** Wieżyczki strzelają w najbliższego wroga i znikają po czasie. */
export function updateTurrets(run: Run, dt: number): void {
  const items = run.turrets.items;
  const rate = 1 + run.flag('turretRate');
  for (let i = items.length - 1; i >= 0; i--) {
    const t = items[i];
    t.life -= dt;
    if (t.life <= 0) { run.burst(t.x, t.y, C.dgray, 6, 25); run.turrets.release(t); continue; }
    t.timer -= dt * rate;
    if (t.timer > 0) continue;
    const e = run.nearestEnemy(t.x, t.y, 130);
    if (!e) { t.timer = 0.15; continue; }
    t.timer = FIRE_EVERY;
    run.spawnProjectile({
      x: t.x, y: t.y - 2, angle: Math.atan2(e.y - t.y, e.x - t.x), speed: 190,
      damage: run.cardDamage(9), src: 'Wieżyczka', sprite: 'bolt', pierce: 0, life: 1,
    });
  }
}
