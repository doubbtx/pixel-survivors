import { sfx } from '../core/audio';
import { C } from '../core/palette';
import type { Zone } from '../entities/types';
import type { Run } from '../game/run';
import { shardProjectile } from './weapons';

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
        if (z.t >= z.delay) {
          explode(run, z, C.orange);
          // Augmenty meteoru: płonący krater, odłamki skał.
          if (run.aug('meteor_crater')) run.addFire(z.x, z.y, z.r * 0.8, z.damage * 0.1, 3, z.src);
          if (run.aug('meteor_shards')) for (let k = 0; k < 5; k++) shardProjectile(run, z.x, z.y, (k / 5) * Math.PI * 2 + z.t, z.damage * 0.3, z.src, 'ember');
          run.zones.release(z);
        }
        break;
      case 'mine': {
        let trigger = z.t >= z.life;
        if (!trigger && z.t > 0.4) {
          run.enemiesInCircle(z.x, z.y, 8, () => (trigger = true));
          // Magnetyczne miny (augment): uzbrojona mina sunie do najbliższego wroga.
          const t = !trigger && run.aug('mine_magnet') ? run.nearestEnemy(z.x, z.y, 70) : null;
          if (t) { const d = Math.hypot(t.x - z.x, t.y - z.y) || 1; z.x += ((t.x - z.x) / d) * 60 * dt; z.y += ((t.y - z.y) / d) * 60 * dt; }
        }
        if (trigger) {
          explode(run, z, C.red);
          // Miny kasetowe (augment): 3 mniejsze miny (len = 1 oznacza minę z kasety — bez kolejnych).
          if (run.aug('mine_cluster') && z.len !== 1) for (let k = 0; k < 3; k++) {
            const a = (k / 3) * Math.PI * 2;
            const m = run.addZone('mine', z.x + Math.cos(a) * 14, z.y + Math.sin(a) * 14, z.r * 0.6, z.damage * 0.4, 2, z.slot, z.src);
            if (m) { m.len = 1; m.knock = z.knock; }
          }
          run.zones.release(z);
        }
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
