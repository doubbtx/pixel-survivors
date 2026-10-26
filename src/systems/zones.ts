import { sfx } from '../core/audio';
import { C } from '../core/palette';
import type { Zone } from '../entities/types';
import type { Run } from '../game/run';

/** Wybuch obszarowy: obrażenia z odrzutem od środka + efekty. */
function explode(run: Run, z: Zone, col: number): void {
  run.enemiesInCircle(z.x, z.y, z.r, (e) => run.damageEnemy(e, z.damage, z.src, { kx: e.x - z.x, ky: e.y - z.y, knock: z.knock }));
  const f = run.addFx('ring', z.x, z.y, col, 0.25);
  if (f) f.r = z.r;
  run.boomFx(z.x, z.y, z.r);
  run.burst(z.x, z.y, col, 14, 70);
  run.burst(z.x, z.y, C.yellow, 6, 40);
  run.addShake(1.5);
  sfx.play('explode');
}

/**
 * Strefy: meteoryt (opóźniony wybuch), mina (uzbrojenie + zapalnik zbliżeniowy),
 * sieć i deszcz strzał (obrażenia co `tick` kroków), promień (linia od gracza).
 */
export function updateZones(run: Run, dt: number): void {
  const items = run.zones.items;
  const p = run.player;
  for (let i = items.length - 1; i >= 0; i--) {
    const z = items[i];
    z.t += dt;
    const tick = run.step % z.tick === 0;
    switch (z.kind) {
      case 'meteor':
        if (z.t >= z.delay) { explode(run, z, C.orange); run.zones.release(z); }
        break;
      case 'mine': {
        let trigger = z.t >= z.life;
        if (!trigger && z.t > 0.4) run.enemiesInCircle(z.x, z.y, 8, () => (trigger = true));
        if (trigger) { explode(run, z, C.red); run.zones.release(z); }
        break;
      }
      case 'net':
      case 'rain':
      case 'fire':
        if (tick) {
          run.enemiesInCircle(z.x, z.y, z.r, (e) => {
            run.damageEnemy(e, z.damage, z.src);
            if (z.slow > 0) { e.slowT = 0.5; e.slowF = Math.max(e.slowF, z.slow); }
          });
        }
        if (z.t >= z.life) run.zones.release(z);
        break;
      case 'beam': {
        z.x = p.x;
        z.y = p.y;
        if (tick) {
          const cx = Math.cos(z.angle), cy = Math.sin(z.angle);
          // Próbkowanie odcinka okręgami co 8 px; hitStamp == step chroni przed podwójnym trafieniem.
          for (let d = 6; d <= z.len; d += 8) {
            run.enemiesInCircle(z.x + cx * d, z.y + cy * d, z.r + 2, (e) => {
              if (e.hitStamp[z.slot] === run.step) return;
              e.hitStamp[z.slot] = run.step;
              run.damageEnemy(e, z.damage, z.src);
            });
          }
        }
        if (z.t >= z.life) run.zones.release(z);
        break;
      }
    }
  }
}
