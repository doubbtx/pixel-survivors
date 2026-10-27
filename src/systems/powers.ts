import { rng } from '../core/rng';
import { sfx } from '../core/audio';
import { BAL } from '../data/balance';
import { BOSS_POWERS, BOSS_POWER_BY_ID, type BossPowerDef } from '../data/enemies';
import { SLOT } from '../entities/types';
import type { Run } from '../game/run';
import { spawnMinion } from './minions';

const TAU = Math.PI * 2;

/** Obrażenia mocy: obrażenia kart (moc gracza × głębokość) × przyrost za poziom mocy. */
function dmg(run: Run, base: number): number {
  return run.cardDamage(base) * (1 + BAL.bossPowers.perLevel * ((run.power?.level ?? 1) - 1));
}

/** Kąt do najbliższego wroga (null, gdy nikogo nie ma w zasięgu). */
function aimNearest(run: Run): number | null {
  const p = run.player, e = run.nearestEnemy(p.x, p.y, 220);
  return e ? Math.atan2(e.y - p.y, e.x - p.x) : null;
}

/** Wystrzał mocy; false = brak celu (spróbuje za chwilę). */
const FIRE: Record<string, (run: Run, name: string) => boolean> = {
  shotgun(run, name) {
    const a = aimNearest(run), p = run.player;
    if (a === null) return false;
    for (let i = 0; i < 7; i++) {
      run.spawnProjectile({ x: p.x, y: p.y, angle: a + (i - 3) * 0.13, speed: 170 * rng.range(0.7, 1.3), damage: dmg(run, 10), src: name, sprite: 'star', pierce: 1, life: 0.9 });
    }
    return true;
  },
  gapring(run, name) {
    const p = run.player, base = rng.range(0, TAU);
    for (let i = 0; i < 20; i++) run.spawnProjectile({ x: p.x, y: p.y, angle: base + (i * TAU) / 20, speed: 150, damage: dmg(run, 8), src: name, sprite: 'bolt', pierce: 2, life: 1.2 });
    return true;
  },
  flower(run, name) {
    const p = run.player;
    for (let k = 0; k < 2; k++) {
      run.schedule(k * 0.35, () => {
        for (let i = 0; i < 10; i++) run.spawnProjectile({ x: p.x, y: p.y, angle: (i * TAU) / 10 + k * 0.31, speed: 120, damage: dmg(run, 9), src: name, sprite: 'ember', pierce: 1, life: 1.3 });
      });
    }
    return true;
  },
  stream(run, name) {
    if (aimNearest(run) === null) return false;
    for (let k = 0; k < 5; k++) {
      run.schedule(k * 0.1, () => {
        const a = aimNearest(run), p = run.player;
        if (a === null) return;
        for (let i = -1; i <= 1; i++) run.spawnProjectile({ x: p.x, y: p.y, angle: a + i * 0.12, speed: 230, damage: dmg(run, 6), src: name, sprite: 'blade', pierce: 1, life: 0.8 });
      });
    }
    return true;
  },
  minefield(run, name) {
    const p = run.player;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + rng.range(0, 0.5), d = rng.range(30, 70);
      const z = run.addZone('mine', p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 24 * run.stats.area, dmg(run, 20), 4, SLOT.card, name);
      if (z) z.knock = 3;
    }
    return true;
  },
  crown(run, name) {
    const p = run.player, base = rng.range(0, TAU);
    for (let i = 0; i < 16; i++) run.spawnProjectile({ x: p.x, y: p.y, angle: base + (i * TAU) / 16, speed: 160, damage: dmg(run, 10), src: name, sprite: 'sun', pierce: 2, life: 1.2 });
    FIRE.shotgun(run, name);
    return true;
  },
  brood(run, name) {
    const p = run.player;
    for (let i = 0; i < 3; i++) spawnMinion(run, p.x, p.y, dmg(run, 7), 8, false, name);
    return true;
  },
};

/** Moc bossa: odliczanie i automatyczny wystrzał. */
export function updatePower(run: Run, dt: number): void {
  if (!run.power) return;
  run.powerT -= dt;
  if (run.powerT > 0) return;
  const def = BOSS_POWER_BY_ID[run.power.id];
  if (!FIRE[def.id](run, def.name)) { run.powerT = 0.3; return; }
  run.powerT = powerCd(run, def);
  sfx.play('ability');
}

/** Odnowienie mocy (skraca je redukcja odnowienia, jak umiejętności). */
export function powerCd(run: Run, def: BossPowerDef): number {
  return def.cd * BAL.cooldownMul(run.stats.cdr);
}

/** Oferta 3 mocy po bossie: losowe różne, a posiadana (poniżej maks. poziomu) zawsze jako ulepszenie. */
export function rollPowerOffer(run: Run): BossPowerDef[] {
  const own = run.power && run.power.level < BAL.bossPowers.maxLevel ? BOSS_POWER_BY_ID[run.power.id] : null;
  const pool = BOSS_POWERS.filter((p) => p.id !== run.power?.id && !p.secret);
  const out: BossPowerDef[] = own ? [own] : [];
  // Zapomniany Król: jego moc zawsze na początku oferty po zwycięstwie w kurhanie.
  if (run.cardState.kingPower && run.power?.id !== 'crown') out.unshift(BOSS_POWER_BY_ID.crown);
  delete run.cardState.kingPower;
  while (out.length < 3 && pool.length) out.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
  return out;
}

/** Wybór mocy: ta sama podnosi poziom, inna zastępuje obecną. */
export function takePower(run: Run, id: string): void {
  if (run.power?.id === id) run.power.level = Math.min(BAL.bossPowers.maxLevel, run.power.level + 1);
  else run.power = { id, level: 1 };
  run.powerT = 1;
}
