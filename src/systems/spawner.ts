import { C } from '../core/palette';
import { rng } from '../core/rng';
import { VIEW_W, VIEW_H } from '../core/renderer';
import { sfx } from '../core/audio';
import { BAL } from '../data/balance';
import { ENEMIES, ELITE_MODS, BIOME_MINIBOSS, eliteCompatible } from '../data/enemies';
import { WAVES, EVENTS, BIOME_WAVES } from '../data/waves';
import type { Enemy } from '../entities/types';
import type { Run } from '../game/run';
import { updateSituations } from './situations';

/**
 * Promień, na którym pojawiają się wrogowie — tuż poza ekranem: co najmniej 196 jednostek (półprzekątna widoku 16:9 ≈ 184),
 * na szerokim ekranie (telefony 20:9) więcej, żeby nie wyskakiwali przy bocznych krawędziach.
 */
const spawnR = (): number => Math.max(196, Math.hypot(VIEW_W, VIEW_H) / 2 + 12);

export interface SpawnOpts {
  elite?: string[];
  /** Uderzenie scenariusza (0.56): HP bez pogoni w górę (min(powerMul, 1)), żeby sprawdzian był przewidywalny. */
  noChase?: boolean;
}

/** Tworzy wroga z definicji, skalując HP i obrażenia według czasu poziomu i głębokości (BAL). */
export function spawnEnemy(run: Run, id: string, x: number, y: number, o: SpawnOpts = {}): Enemy | null {
  const e = run.enemies.obtain();
  if (!e) return null;
  const def = ENEMIES[id];
  const P = BAL.power, lvl = run.level - 1;
  const hpMul = BAL.enemyHpMul(run.time) * BAL.depthHpMul(run.depth) * (1 + run.flag('enemyHp')) * (o.noChase ? Math.min(run.powerMul, 1) : run.powerMul) * (1 + P.levelHp * lvl);
  e.uid = run.newUid();
  e.def = def;
  e.sprite = def.behavior === 'boss' ? `boss${run.levelInfo.biome}` : def.sprite;
  e.x = x; e.y = y; e.kx = 0; e.ky = 0;
  e.maxHp = e.hp = def.hp * hpMul;
  e.speed = def.speed * rng.range(0.9, 1.1) * (1 + run.flag('enemySpeed'));
  e.damage = def.damage * BAL.enemyDmgMul(run.time) * BAL.depthDmgMul(run.depth) * (run.scripted ? 1 : P.dmg(run.depth, run.depthTime())) * (1 + P.levelDmg * lvl) * (1 + run.flag('enemyDmg'));
  e.radius = def.radius;
  e.xp = def.xp;
  e.flash = 0; e.slowT = 0; e.slowF = 0; e.stunT = 0;
  e.burnT = 0; e.burnDps = 0; e.chill = 0; e.shockT = 0; e.poisonT = 0; e.poisonStacks = 0; e.poisonUnit = 0; e.dotT = 0;
  e.reactT = 0; e.brittle = 0;
  e.shootT = def.shoot ? rng.range(0.5, def.shoot.cooldown) : 0;
  e.shootA = rng.range(0, Math.PI * 2);
  e.age = 0; e.dead = false; e.elite = null; e.boss = false; e.scale = 1;
  e.dr = 0; e.regen = 0; e.extraRing = false; e.burstLeft = 0; e.burstT = 0; e.touchCd = 0; e.abilT = 0;
  e.hitStamp.fill(-9999);
  e.phase = 0; e.invuln = 0; e.actT = 3; e.dashT = 0; e.dvx = 0; e.dvy = 0; e.z = 0; e.hidden = false; e.tx = 0; e.ty = 0; e.nextAlt = 0; e.told = false; e.sit = 0; e.summons = 0; e.traitT = 2; e.buffT = 0; e.brandT = 0; e.brandBoom = false; e.plague = false; e.markT = 0; e.pressT = 0;

  if (o.elite) {
    // Pakt „Elity z cechami”: dodatkowe, różne cechy — z tymi samymi zasadami co zwykłe elity
    // (cechy zachowania dopiero od aktu 2 / późniejszych fal, mapa odporności nigdy nie dostaje „Pancernego”).
    const mods = [...o.elite];
    const traitsOn = run.expedition ? run.expedition.act >= 2 : run.waveTime() >= BAL.eliteTraits.from;
    for (let i = 0; i < run.flag('eliteMods'); i++) {
      const left = Object.keys(ELITE_MODS).filter((k) => eliteCompatible(mods, k) && (traitsOn || !ELITE_MODS[k].kind) && !(k === 'armored' && run.levelInfo.resist));
      if (left.length) mods.push(rng.pick(left));
    }
    e.elite = mods;
    e.abilT = rng.range(1.5, BAL.eliteAbility.cdMax);
    e.scale = 2;
    e.radius *= 1.8;
    e.maxHp = e.hp = e.hp * BAL.eliteHpMul;
    e.damage *= 1.5;
    e.xp *= 10;
    for (const m of mods.map((k) => ELITE_MODS[k])) {
      if (m.speedMul) e.speed *= m.speedMul;
      if (m.dr) e.dr = m.dr;
      if (m.regen) e.regen = m.regen;
      if (m.hpMul) { e.maxHp *= m.hpMul; e.hp = e.maxHp; }
      if (m.ring) e.extraRing = true;
    }
  }
  if (def.behavior === 'boss') {
    e.boss = true;
    run.cardState.bossHit = 0;
    // Boss: mnożnik siły (z obrażeń obszarowych) liczy się słabiej — walka ma trwać około minuty uników, nie kilka.
    e.maxHp = e.hp = e.maxHp * (1 + run.flag('bossHp')) * Math.pow(run.powerMul, BAL.bossPowerExp - 1) * (run.expedition && run.levelInfo.boss && !run.dungeon ? BAL.expedition.bossHp : 1);
    e.speed = def.speed;
    run.boss = e;
    if (run.relic('hourglass') && !run.dungeon) e.damage *= BAL.relics.bossDmg;
    run.bossSoftShown = false;
  }
  return e;
}

/**
 * Pełna pula: zwalnia miejsce kosztem zwykłego wroga — nigdy bossa ani elity (zwolniony obiekt bossa zostałby użyty
 * ponownie jako inny wróg, a `run.boss` wskazywałby na niego bez końca i blokował spawner).
 */
function freeSlot(run: Run): void {
  if (run.enemies.count < run.enemies.cap) return;
  const e = run.enemies.items.find((x) => !x.boss && !x.elite && !x.dead) ?? run.enemies.items.find((x) => !x.boss);
  if (e) run.enemies.release(e);
}

function ringPos(run: Run, a: number, r = spawnR()): [number, number] {
  return [run.player.x + Math.cos(a) * r, run.player.y + Math.sin(a) * r];
}

/** Okrążenie: `n` zwykłych wrogów składu fali w pierścieniu wokół gracza i `elites` elit tuż za nim (zadania, Zasadzka). */
export function encircle(run: Run, n: number, elites: number, eliteMods?: string[]): void {
  const p = run.player, mix = currentMix(run.waveTime(), run.levelInfo.biome);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    spawnEnemy(run, rng.weighted(mix), p.x + Math.cos(a) * 170, p.y + Math.sin(a) * 170);
  }
  const mods = Object.keys(ELITE_MODS);
  for (let i = 0; i < elites; i++) {
    const a = rng.range(0, Math.PI * 2);
    spawnEnemy(run, rng.weighted(mix.filter(([id]) => id !== 'bat')), p.x + Math.cos(a) * 180, p.y + Math.sin(a) * 180, { elite: eliteMods ? [...eliteMods] : [rng.pick(mods)] });
  }
  run.addShake(4);
}

/** Skład fali (id wroga, waga) dla czasu fal `t`, z wrogami biomu (BIOME_WAVES) dołożonymi do zwykłego składu. */
export function currentMix(t: number, biome: number): [string, number][] {
  let mix = WAVES[0].mix, extra: [string, number][] = [];
  for (const w of WAVES) if (w.from <= t) mix = w.mix;
  for (const w of BIOME_WAVES[biome] ?? []) if (w.from <= t) extra = w.mix;
  return extra.length ? [...mix, ...extra] : mix;
}

/**
 * Fale wrogów, zdarzenia, elity i boss. Spawner dąży do docelowej liczby wrogów z BAL.
 * Skład i gęstość fal liczone są od "czasu fal" = czas poziomu + przesunięcie głębokości,
 * a boss pojawia się po wykonaniu celu poziomu.
 */
export function updateSpawner(run: Run, dt: number): void {
  // W lochu wrogów wystawia systems/events.ts (fale), zwykła mapa czeka.
  if (run.dungeon && run.levelInfo.objective.kind === 'hunt') run.huntPaused += dt;
  if (run.dungeon || run.scripted) return;
  // Zabezpieczenie: boss poziomu zgubiony bez zabicia (np. wejście do lochu w trakcie walki, Król z kurhanu zamiast bossa)
  // — bossSpawned bez bossa i bez końca poziomu zablokowałby poziom na zawsze (także w Endless: bez kolejnych głębokości).
  if (run.bossSpawned && !run.boss && run.levelInfo.boss && run.outcome === 'none') run.bossSpawned = false;
  const t = run.time;
  const waveT = t + run.levelInfo.waveOffset;

  if (!run.bossSpawned && run.objectiveProgress() >= 1 && !run.levelInfo.boss) {
    run.clearObjective();
    return;
  }
  if (!run.bossSpawned && run.objectiveProgress() >= 1) {
    run.bossSpawned = true;
    // Zapowiedziana sytuacja przepada (odliczanie do następnej wraca po walce).
    run.situation = null;
    // Boss musi się pojawić nawet przy pełnej puli — zwalniamy miejsce kosztem zwykłego wroga.
    freeSlot(run);
    const [x, y] = ringPos(run, rng.range(0, Math.PI * 2), 150);
    const b = spawnEnemy(run, 'boss', x, y);
    // Wznowiony poziom: boss wraca z HP z zapisu.
    if (b && run.bossHpFrac < 1) b.hp = b.maxHp * Math.max(0.05, run.bossHpFrac);
    run.bossHpFrac = 1;
    // Zwykli wrogowie uciekają przed bossem: arena należy do niego i jego wzorów pocisków (elity zostają).
    for (const e of run.enemies.items) {
      if (e.dead || e.boss || e.elite) continue;
      e.dead = true;
      run.burst(e.x, e.y, C.lgray, 3, 30);
    }
    run.showBanner(`Nadchodzi ${run.levelInfo.bossName}!`);
    run.addShake(6);
    sfx.play('boss');
  }

  // Zabezpieczenie: obiekt bossa zwolniony z puli (już nie boss) — boss pojawi się ponownie zamiast blokady poziomu.
  if (run.boss && (!run.boss.boss || run.boss.dead)) { run.boss = null; if (!run.dungeon) run.bossSpawned = false; }
  // W trakcie walki z bossem żadnych nowych wrogów (poza tymi, których przyzywa sam boss).
  if (run.boss) return;
  // Zasadzka (Ekspedycja): własne pierścienie co kilkanaście sekund, coraz gęstsze, ostatnie z elitami; bez zwykłych okrążeń.
  if (run.levelInfo.ambush) {
    const X = BAL.expedition;
    run.ambushT -= dt;
    if (run.ambushT <= 0) {
      run.ambushT = X.ambushEvery;
      // Numer pierścienia z czasu mapy (po wczytaniu zapisu pierścienie nie zaczynają od nowa).
      run.ambushRing = Math.floor((t - X.ambushEvery * 0.4) / X.ambushEvery) + 1;
      encircle(run, X.ambushRing + X.ambushGrow * run.ambushRing, run.ambushRing >= X.ambushEliteFrom ? 2 : 0, run.levelInfo.eliteMods);
      run.showBanner(`Ambush! Ring ${run.ambushRing}`);
      sfx.play('boss');
    }
  }
  updateSituations(run, dt, waveT);
  while (!run.levelInfo.ambush && !run.levelInfo.script && run.nextEvent < EVENTS.length && EVENTS[run.nextEvent].at <= t) {
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
    run.eliteT = BAL.eliteEvery * run.levelInfo.eliteMul * BAL.eliteGap(waveT) / (1 + run.flag('eliteRate'));
    // Cechy zachowania (R3) dopiero w późniejszych falach; pary zakazane pomijane.
    // Ekspedycja: cechy zachowania od aktu 2 (czas fal zawiera przesunięcie głębokości).
    const traitsOn = run.expedition ? run.expedition.act >= 2 : waveT >= BAL.eliteTraits.from;
    const mods = Object.keys(ELITE_MODS).filter((k) => traitsOn || !ELITE_MODS[k].kind);
    // Mapa elit / Zasadzka w Ekspedycji: stałe cechy elit widoczne na mapie przed wejściem.
    const picked = run.levelInfo.eliteMods ? [...run.levelInfo.eliteMods] : [rng.pick(mods)];
    // Przeniewierca: częściej dowódcy i sztandary (żeby zaleta w ogóle działała).
    if (!run.levelInfo.eliteMods && traitsOn && run.relic('turncoat') && rng.chance(BAL.relics.turncoatAura)) picked[0] = rng.pick(['commander', 'banner']);
    if (!run.levelInfo.eliteMods && waveT > 150) {
      const second = rng.pick(mods);
      if (eliteCompatible(picked, second)) picked.push(second);
    }
    const [x, y] = ringPos(run, rng.range(0, Math.PI * 2));
    const base = rng.weighted(currentMix(waveT, run.levelInfo.biome).filter(([id]) => id !== 'bat'));
    const e = spawnEnemy(run, base, x, y, { elite: picked });
    // Przeniewierca (wada): elity z cechą zachowania mają więcej HP.
    if (e && run.relic('turncoat') && picked.some((k) => ELITE_MODS[k].kind)) e.maxHp = e.hp = e.maxHp * BAL.relics.turncoatHp;
    if (e) run.showBanner(`Elita: ${picked.map((k) => ELITE_MODS[k].name).join(', ')}`);
  }

  updateMiniboss(run, dt, waveT);

  // Scenariusz: oddech bez nowych wrogów, w trakcie uderzenia zwykłe fale rzadsze (BAL.scripts).
  if (run.breathT > 0) return;
  const target = BAL.targetEnemies(waveT) * (1 + run.flag('enemyCount')) * (run.beatT > 0 ? BAL.scripts.beatDensity : 1);
  const deficit = target - run.enemies.count;
  if (deficit <= 0) return;
  run.spawnAcc += Math.min(BAL.spawnRateCap(waveT), deficit * 2) * dt;
  const mix = currentMix(waveT, run.levelInfo.biome);
  while (run.spawnAcc >= 1) {
    run.spawnAcc -= 1;
    const [x, y] = ringPos(run, rng.range(0, Math.PI * 2), spawnR() + rng.range(0, 30));
    // Złoty szlam: rzadki, uciekający wróg pełen złota.
    if (run.goldSlimeT <= 0 && rng.chance(BAL.events.goldSlimeChance * (1 + run.flag('goldSlimeRate'))) && !run.enemies.items.some((e) => !e.dead && e.def.id === 'goldslime')) {
      run.goldSlimeT = BAL.events.goldSlimeGap;
      spawnEnemy(run, 'goldslime', x, y);
      run.showBanner('Złoty szlam! Złap go!');
    }
    else spawnEnemy(run, rng.weighted(mix), x, y);
  }
}

/**
 * Miniboss biomu (0.30): w Ekspedycji raz na mapie elit (przy połowie celu), w Endless jako wydarzenie co BAL.biomeEnemies.miniEvery s.
 * Pojawia się jako elita bez cech (skrzynia elity, karta i XP po zabiciu); HP skalowane siłą buildu słabiej, jak u bossa.
 */
function updateMiniboss(run: Run, dt: number, waveT: number): void {
  const B = BAL.biomeEnemies;
  if (run.mode === 'endless') {
    run.minibossT -= dt;
    if (run.minibossT > 0) return;
    run.minibossT = B.miniEvery;
  } else if (run.levelInfo.objective.kind === 'hunt') {
    // Polowanie: miniboss od razu (po wczytaniu zapisu pojawia się ponownie), dopóki nie zginie.
    if (run.minibossDone || run.huntKilled || run.dungeon || run.time < 3) return;
  } else {
    if (run.minibossDone || run.levelInfo.eliteMul >= 1 || run.objectiveProgress() < B.miniAt) return;
  }
  freeSlot(run);
  const id = BIOME_MINIBOSS[Math.min(BIOME_MINIBOSS.length - 1, run.levelInfo.biome)];
  const [x, y] = ringPos(run, rng.range(0, Math.PI * 2), 150);
  const e = spawnEnemy(run, id, x, y, { elite: [] });
  // Pełna pula: spróbuj w następnym kroku (flaga dopiero po udanym pojawieniu się).
  if (!e) return;
  run.minibossDone = true;
  const hunt = run.levelInfo.objective.kind === 'hunt';
  e.maxHp = e.hp = e.maxHp * Math.pow(run.powerMul, BAL.bossPowerExp - 1) * (1 + Math.max(0, waveT - 300) / 600) * (hunt ? BAL.expedition.huntHp : 1);
  if (hunt) {
    // Eskorta: elity bez skrzyń (Run.killEnemy).
    const mods = Object.keys(ELITE_MODS);
    for (let i = 0; i < BAL.expedition.huntEscort; i++) spawnEnemy(run, rng.weighted(currentMix(waveT, run.levelInfo.biome).filter(([k]) => k !== 'bat')), x + rng.range(-20, 20), y + rng.range(-20, 20), { elite: [rng.pick(mods)] });
  }
  run.showBanner(hunt ? `Hunt: ${ENEMIES[id].name}!` : `Miniboss: ${ENEMIES[id].name}!`);
  run.addShake(3);
  sfx.play('boss');
}
