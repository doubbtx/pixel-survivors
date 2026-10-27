import { rng } from '../core/rng';
import { sfx } from '../core/audio';
import { BAL } from '../data/balance';
import { ENEMIES, ELITE_MODS } from '../data/enemies';
import { WAVES, EVENTS } from '../data/waves';
import type { Enemy } from '../entities/types';
import type { Run } from '../game/run';

/** Promień, na którym pojawiają się wrogowie — tuż poza ekranem (półprzekątna ≈ 184 px). */
const SPAWN_R = 196;

export interface SpawnOpts {
  elite?: string[];
}

/** Tworzy wroga z definicji, skalując HP i obrażenia według czasu poziomu i głębokości (BAL). */
export function spawnEnemy(run: Run, id: string, x: number, y: number, o: SpawnOpts = {}): Enemy | null {
  const e = run.enemies.obtain();
  if (!e) return null;
  const def = ENEMIES[id];
  const P = BAL.power, lvl = run.level - 1;
  const hpMul = BAL.enemyHpMul(run.time) * BAL.depthHpMul(run.depth) * (1 + run.flag('enemyHp')) * run.powerMul * (1 + P.levelHp * lvl);
  e.uid = run.newUid();
  e.def = def;
  e.sprite = def.behavior === 'boss' ? `boss${run.levelInfo.biome}` : def.sprite;
  e.x = x; e.y = y; e.kx = 0; e.ky = 0;
  e.maxHp = e.hp = def.hp * hpMul;
  e.speed = def.speed * rng.range(0.9, 1.1) * (1 + run.flag('enemySpeed'));
  e.damage = def.damage * BAL.enemyDmgMul(run.time) * BAL.depthDmgMul(run.depth) * Math.pow(run.powerMul, P.dmgExp) * (1 + P.levelDmg * lvl);
  e.radius = def.radius;
  e.xp = def.xp;
  e.flash = 0; e.slowT = 0; e.slowF = 0; e.stunT = 0;
  e.burnT = 0; e.burnDps = 0; e.chill = 0; e.shockT = 0; e.poisonT = 0; e.poisonStacks = 0; e.poisonUnit = 0; e.dotT = 0;
  e.reactT = 0; e.brittle = 0;
  e.shootT = def.shoot ? rng.range(0.5, def.shoot.cooldown) : 0;
  e.shootA = rng.range(0, Math.PI * 2);
  e.age = 0; e.dead = false; e.elite = null; e.boss = false; e.scale = 1;
  e.dr = 0; e.regen = 0; e.extraRing = false; e.burstLeft = 0; e.burstT = 0; e.touchCd = 0;
  e.hitStamp.fill(-9999);
  e.phase = 0; e.invuln = 0; e.actT = 3; e.dashT = 0; e.dvx = 0; e.dvy = 0;

  if (o.elite) {
    e.elite = o.elite;
    e.scale = 2;
    e.radius *= 1.8;
    e.maxHp = e.hp = e.hp * BAL.eliteHpMul;
    e.damage *= 1.5;
    e.xp *= 10;
    for (const m of o.elite.map((k) => ELITE_MODS[k])) {
      if (m.speedMul) e.speed *= m.speedMul;
      if (m.dr) e.dr = m.dr;
      if (m.regen) e.regen = m.regen;
      if (m.hpMul) { e.maxHp *= m.hpMul; e.hp = e.maxHp; }
      if (m.ring) e.extraRing = true;
    }
  }
  if (def.behavior === 'boss') {
    e.boss = true;
    e.speed = def.speed;
    run.boss = e;
  }
  return e;
}

function ringPos(run: Run, a: number, r = SPAWN_R): [number, number] {
  return [run.player.x + Math.cos(a) * r, run.player.y + Math.sin(a) * r];
}

function currentMix(t: number): [string, number][] {
  let mix = WAVES[0].mix;
  for (const w of WAVES) if (w.from <= t) mix = w.mix;
  return mix;
}

/**
 * Fale wrogów, zdarzenia, elity i boss. Spawner dąży do docelowej liczby wrogów z BAL.
 * Skład i gęstość fal liczone są od "czasu fal" = czas poziomu + przesunięcie głębokości,
 * a boss pojawia się po wykonaniu celu poziomu.
 */
export function updateSpawner(run: Run, dt: number): void {
  // W lochu wrogów wystawia systems/events.ts (fale), zwykła mapa czeka.
  if (run.dungeon) return;
  const t = run.time;
  const waveT = t + run.levelInfo.waveOffset;

  if (!run.bossSpawned && run.objectiveProgress() >= 1 && !run.levelInfo.boss) {
    run.clearObjective();
    return;
  }
  if (!run.bossSpawned && run.objectiveProgress() >= 1) {
    run.bossSpawned = true;
    // Boss musi się pojawić nawet przy pełnej puli — zwalniamy miejsce kosztem zwykłego wroga.
    if (run.enemies.count >= run.enemies.cap) run.enemies.release(run.enemies.items[0]);
    const [x, y] = ringPos(run, rng.range(0, Math.PI * 2), 150);
    const b = spawnEnemy(run, 'boss', x, y);
    // Wznowiony poziom: boss wraca z HP z zapisu.
    if (b && run.bossHpFrac < 1) b.hp = b.maxHp * Math.max(0.05, run.bossHpFrac);
    run.bossHpFrac = 1;
    run.showBanner(`Nadchodzi ${run.levelInfo.bossName}!`);
    run.addShake(6);
    sfx.play('boss');
  }

  while (run.nextEvent < EVENTS.length && EVENTS[run.nextEvent].at <= t) {
    const ev = EVENTS[run.nextEvent++];
    for (let i = 0; i < ev.count; i++) {
      const [x, y] = ringPos(run, (i / ev.count) * Math.PI * 2, 170);
      spawnEnemy(run, ev.enemy, x, y);
    }
    run.showBanner('Okrążenie!');
  }

  run.goldSlimeT -= dt;
  run.eliteT -= dt;
  if (run.eliteT <= 0) {
    run.eliteT = BAL.eliteEvery * run.levelInfo.eliteMul * BAL.eliteGap(waveT);
    const mods = Object.keys(ELITE_MODS);
    const picked = [rng.pick(mods)];
    if (waveT > 150) {
      const second = rng.pick(mods);
      if (second !== picked[0]) picked.push(second);
    }
    const [x, y] = ringPos(run, rng.range(0, Math.PI * 2));
    const base = rng.weighted(currentMix(waveT).filter(([id]) => id !== 'bat'));
    const e = spawnEnemy(run, base, x, y, { elite: picked });
    if (e) run.showBanner(`Elita: ${picked.map((k) => ELITE_MODS[k].name).join(', ')}`);
  }

  const target = BAL.targetEnemies(waveT) * (run.bossSpawned ? 0.35 : 1);
  const deficit = target - run.enemies.count;
  if (deficit <= 0) return;
  run.spawnAcc += Math.min(BAL.spawnRateCap(waveT), deficit * 2) * dt;
  const mix = currentMix(waveT);
  while (run.spawnAcc >= 1) {
    run.spawnAcc -= 1;
    const [x, y] = ringPos(run, rng.range(0, Math.PI * 2), SPAWN_R + rng.range(0, 30));
    // Złoty szlam: rzadki, uciekający wróg pełen złota.
    if (run.goldSlimeT <= 0 && rng.chance(BAL.events.goldSlimeChance) && !run.enemies.items.some((e) => !e.dead && e.def.id === 'goldslime')) {
      run.goldSlimeT = BAL.events.goldSlimeGap;
      spawnEnemy(run, 'goldslime', x, y);
      run.showBanner('Złoty szlam! Złap go!');
    }
    else spawnEnemy(run, rng.weighted(mix), x, y);
  }
}
