import type { Run } from '../game/run';

/** Cząsteczki, liczby obrażeń i krótkie efekty — czysto wizualne, z limitami w pulach. */
export function updateEffects(run: Run, dt: number): void {
  const ps = run.particles.items;
  for (let i = ps.length - 1; i >= 0; i--) {
    const p = ps[i];
    p.life -= dt;
    if (p.life <= 0) { run.particles.release(p); continue; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.9;
    p.vy *= 0.9;
  }
  const ns = run.dmgNums.items;
  for (let i = ns.length - 1; i >= 0; i--) {
    const n = ns[i];
    n.life -= dt;
    n.y -= 18 * dt;
    if (n.life <= 0) run.dmgNums.release(n);
  }
  const fs = run.fx.items;
  for (let i = fs.length - 1; i >= 0; i--) {
    const f = fs[i];
    f.life -= dt;
    if (f.life <= 0) run.fx.release(f);
  }
}
