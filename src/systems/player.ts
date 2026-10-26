import type { Input } from '../core/input';
import { VIEW_W, VIEW_H, ZOOM } from '../core/renderer';
import { BAL } from '../data/balance';
import type { Run } from '../game/run';

/** Ruch gracza, doskok, timery nietykalności, regeneracja i punkt celowania. */
export function updatePlayer(run: Run, input: Input, dt: number): void {
  const p = run.player;
  if (p.dashT > 0) {
    p.dashT -= dt;
    p.x += p.dvx * dt;
    p.y += p.dvy * dt;
    run.burst(p.x, p.y, run.hero.color, 1, 10);
  } else {
    const mv = input.move();
    const speed = run.stats.speed * BAL.speedMul(run.stats.speedBonus);
    p.moving = mv.x !== 0 || mv.y !== 0;
    if (p.moving) {
      p.x += mv.x * speed * dt;
      p.y += mv.y * speed * dt;
      const l = Math.hypot(mv.x, mv.y);
      p.fx = mv.x / l;
      p.fy = mv.y / l;
    }
  }
  if (p.iframes > 0) p.iframes -= dt;
  if (p.hurtCd > 0) p.hurtCd -= dt;
  if (p.flash > 0) p.flash--;
  if (run.stats.regen > 0) run.heal(run.stats.regen * dt);

  // Punkt celowania wg ustawienia (core/save.ts AimMode):
  // prawa gałka pada > mysz (poza trybem 'auto') > najbliższy wróg (poza trybem 'manual') > kierunek patrzenia.
  const manual = run.aimMode !== 'auto';
  if (manual && (input.padAim.x !== 0 || input.padAim.y !== 0)) {
    run.aimX = p.x + input.padAim.x * 80;
    run.aimY = p.y + input.padAim.y * 80;
  } else if (manual && input.mouseAiming()) {
    run.aimX = p.x - VIEW_W / 2 + input.mouse.x / ZOOM;
    run.aimY = p.y - VIEW_H / 2 + input.mouse.y / ZOOM;
  } else {
    const e = run.aimMode !== 'manual' ? run.nearestEnemy(p.x, p.y, 160) : null;
    run.aimX = e ? e.x : p.x + p.fx * 60;
    run.aimY = e ? e.y : p.y + p.fy * 60;
  }
}
