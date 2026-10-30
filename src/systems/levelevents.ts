import { rng } from '../core/rng';
import { sfx } from '../core/audio';
import { C } from '../core/palette';
import { BAL } from '../data/balance';
import type { Run } from '../game/run';

/**
 * Wydarzenia poziomu (BAL.levelEvents): co jakiś czas na `duration` s świat się zmienia.
 *  blood  Krwawy księżyc — elity dużo częściej, więcej łupu (czerwone niebo),
 *  gold   Złota godzina — więcej złota i monet z wrogów,
 *  storm  Burza — pioruny biją w losowe miejsca (zapowiedź kręgiem), ranią wrogów i gracza.
 * Flagi wydarzenia dokłada Run.indexEffects (`eventFlags`).
 */
export type LevelEventId = 'blood' | 'gold' | 'storm';

export const LEVEL_EVENTS: Record<LevelEventId, { name: string; desc: string; color: number; flags: Record<string, number> }> = {
  blood: { name: 'Krwawy księżyc', desc: 'więcej elit i łupu', color: C.red, flags: { eliteRate: 2, mapLoot: 1 } },
  gold: { name: 'Złota godzina', desc: 'więcej złota', color: C.gold, flags: { mapGold: 1, goldRain: 1 } },
  storm: { name: 'Burza', desc: 'pioruny biją w ziemię', color: C.cyan, flags: {} },
};

export function eventFlags(run: Run): Record<string, number> {
  return run.levelEvent ? LEVEL_EVENTS[run.levelEvent.id].flags : {};
}

export function updateLevelEvents(run: Run, dt: number): void {
  const E = BAL.levelEvents;
  const ev = run.levelEvent;
  updateStrikes(run, dt);
  if (ev) {
    ev.t -= dt;
    if (ev.id === 'storm') updateStorm(run, dt);
    if (ev.t <= 0) { run.levelEvent = null; run.strikes = run.strikes.filter((s) => s.foe); run.onBuildChanged(); }
    return;
  }
  if (run.dungeon || run.boss || (run.bossSpawned && run.mode !== 'endless')) return;
  run.levelEventT -= dt;
  if (run.levelEventT > 0) return;
  run.levelEventT = E.every;
  if (!rng.chance(E.chance)) return;
  const id = rng.pick(Object.keys(LEVEL_EVENTS) as LevelEventId[]);
  run.levelEvent = { id, t: E.duration };
  run.showBanner(`${LEVEL_EVENTS[id].name}! (${LEVEL_EVENTS[id].desc})`);
  sfx.play('boss');
  run.onBuildChanged();
}

/** Uderzenia w zaznaczone kręgi: piorun burzy rani wrogów i gracza, deszcz żaru bossa tylko gracza. */
function updateStrikes(run: Run, dt: number): void {
  if (!run.strikes.length) return;
  const E = BAL.levelEvents, p = run.player;
  for (const s of run.strikes) {
    s.t -= dt;
    if (s.t > 0) continue;
    const R = s.r ?? E.stormR, hit = (s.x - p.x) ** 2 + (s.y - p.y) ** 2 < (R + (s.r ? p.r : 0)) ** 2;
    if (s.foe && s.seed) {
      // Nasiono Cierniaka: kłujący wybuch zieleni, bez ognistej eksplozji.
      if (hit) run.hurtPlayer(s.foe);
      run.burst(s.x, s.y, C.green, 10, 60, true);
      run.burst(s.x, s.y, C.lime, 6, 90, true);
      sfx.play('hit');
    } else if (s.foe) {
      if (hit) run.hurtPlayer(s.foe);
      run.boomFx(s.x, s.y, E.stormR, true);
      run.burst(s.x, s.y, C.orange, 12, 70, true);
      sfx.play('explode');
    } else {
      run.enemiesInCircle(s.x, s.y, E.stormR, (e) => run.damageEnemy(e, run.cardDamage(E.stormDmg), 'Burza'));
      if (hit) run.hurtPlayer(run.stats.maxHp * E.stormHurt);
      const f = run.addFx('line', s.x, s.y - 140, C.white, 0.15);
      if (f) { f.x2 = s.x; f.y2 = s.y; f.w = 2; }
      run.burst(s.x, s.y, C.cyan, 12, 70);
      sfx.play('zap');
    }
    run.addShake(1.5);
  }
  run.strikes = run.strikes.filter((s) => s.t > 0);
}

/** Burza: co `stormEvery` s piorun w losowym miejscu przy graczu (najpierw krąg ostrzegawczy). */
function updateStorm(run: Run, dt: number): void {
  const E = BAL.levelEvents, p = run.player;
  run.stormT -= dt;
  if (run.stormT > 0) return;
  run.stormT = E.stormEvery;
  const a = rng.range(0, Math.PI * 2), d = rng.range(0, 140);
  run.strikes.push({ x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, t: E.stormWarn });
}

/** Kombo: zabójstwa bez oberwania; mnożnik złota rośnie z kombo (BAL.combo). */
export function comboOnKill(run: Run): void {
  run.combo++;
  if (run.combo % BAL.combo.announce === 0) { run.popText(run.player.x, run.player.y - 24, `Kombo ${run.combo}!`, C.yellow); sfx.play('select'); }
}

export function comboOnHurt(run: Run): void {
  if (run.combo >= BAL.combo.announce) run.popText(run.player.x, run.player.y - 24, 'Kombo przerwane', C.salmon);
  run.combo = 0;
}

export function comboGoldMul(run: Run): number {
  return 1 + Math.min(BAL.combo.maxBonus, run.combo * BAL.combo.per);
}
