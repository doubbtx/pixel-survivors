import { C } from '../core/palette';
import { rng } from '../core/rng';
import { BAL } from '../data/balance';
import type { Run } from '../game/run';

/**
 * Sługi (bohaterka Morwen, karty z tagiem Przywołania): duchy gonią najbliższego wroga w zasięgu i ranią go w zwarciu
 * co BAL.minions.hitEvery; bez celu krążą przy graczu. Znikają po czasie (Nieśmiertelny legion: wybuchają).
 */
export function spawnMinion(run: Run, x: number, y: number, damage: number, life: number, big: boolean, src: string, burst = false): void {
  const m = run.minions.obtain();
  if (!m) return;
  m.x = x + rng.range(-12, 12);
  m.y = y + rng.range(-12, 12);
  m.life = life * run.stats.duration * (1 + run.flag('minionLife'));
  m.damage = damage * (1 + run.flag('minionDmg'));
  m.hitT = 0;
  m.big = big;
  m.burst = burst;
  m.src = src;
  run.burst(m.x, m.y, C.pink, 6, 30);
}

export function updateMinions(run: Run, dt: number): void {
  const M = BAL.minions, p = run.player;
  const speed = M.speed * (1 + run.flag('minionSpeed'));
  const items = run.minions.items;
  for (let i = items.length - 1; i >= 0; i--) {
    const m = items[i];
    m.life -= dt;
    if (m.life <= 0) {
      if (m.burst) run.explode(m.x, m.y, 30 * run.stats.area, m.damage * 3, m.src, C.pink, 4);
      else run.burst(m.x, m.y, C.plum, 6, 25);
      run.minions.release(m);
      continue;
    }
    m.hitT -= dt;
    const r = m.big ? M.bigRadius : M.radius;
    const t = run.nearestEnemy(m.x, m.y, M.range);
    // Bez celu: wraca w pobliże gracza.
    const tx = t ? t.x : p.x, ty = t ? t.y : p.y;
    const dx = tx - m.x, dy = ty - m.y, d = Math.hypot(dx, dy) || 1;
    const stop = t ? r + t.radius - 2 : M.follow;
    if (d > stop) {
      const step = Math.min(d - stop, speed * (m.big ? 0.85 : 1) * dt);
      m.x += (dx / d) * step;
      m.y += (dy / d) * step;
    }
    if (t && d <= r + t.radius + 2 && m.hitT <= 0) {
      m.hitT = M.hitEvery;
      run.damageEnemy(t, m.damage, m.src, { kx: dx, ky: dy, knock: m.big ? 3 : 1 });
    }
  }
}
