import { rng } from '../core/rng';
import { sfx } from '../core/audio';
import { C } from '../core/palette';
import { BAL } from '../data/balance';
import type { Volley, ShootDef } from '../data/enemies';
import { ELEM } from '../data/elements';
import type { Enemy } from '../entities/types';
import type { Run } from '../game/run';
import { spawnEnemy } from './spawner';
import { VOID_BIOME } from '../data/levels';

const TAU = Math.PI * 2;
/** Wrogowie dalej niż to od gracza są przenoszeni przed niego (jak w Vampire Survivors). */
const RELOCATE_DIST = 330;

/**
 * Wystrzeliwuje salwę (data/enemies.ts Volley). `base` = kąt bazowy: środek wachlarza
 * albo obrót pierścienia (dla pierścienia z luką — środek luki).
 */
export function fireVolley(run: Run, x: number, y: number, v: Volley, base: number, damage: number): void {
  // W późnej grze salwy są gęstsze (BAL.patternDensity); pierścień z luką zachowuje lukę.
  const n = Math.round(v.count * (BAL.patternDensity(run.waveTime()) + run.flag('bulletDensity')));
  const gap = v.shape === 'gapRing' ? v.gap ?? 3 : 0;
  for (let i = 0; i < n; i++) {
    // Pierścień z luką: pomijamy pociski najbliżej kąta bazowego (po obu stronach).
    if (gap && (i < Math.ceil(gap / 2) || n - i <= Math.floor(gap / 2))) continue;
    const a = v.shape === 'fan' || v.shape === 'shotgun' ? base + (i - (n - 1) / 2) * (v.spread ?? 0.2) : base + (i * TAU) / n;
    const b = run.bullets.obtain();
    if (!b) return;
    const var_ = v.speedVar ?? 0.35;
    const sp = v.speed * (v.shape === 'shotgun' ? rng.range(1 - var_, 1 + var_) : 1) * (1 + run.flag('bulletSpeed'));
    b.x = x; b.y = y;
    b.vx = Math.cos(a) * sp;
    b.vy = Math.sin(a) * sp;
    b.life = 6;
    b.damage = damage;
    b.radius = v.sprite === 'eb_big' ? 3 : 2;
    b.sprite = v.sprite;
    b.acc = v.acc ?? 0;
    b.minV = v.minV ?? 8;
    b.turn = (v.turn ?? 0) * (v.altTurn && i % 2 ? -1 : 1);
    b.wave = v.wave ?? 0;
    b.t = 0;
  }
}

/** Kilka salw jedna po drugiej (w czasie gry); przerwane, gdy strzelec zginie. */
function sequence(run: Run, e: Enemy, times: number, gap: number, fire: (k: number) => void): void {
  const uid = e.uid;
  for (let k = 0; k < times; k++) run.schedule(k * gap, () => { if (!e.dead && e.uid === uid) fire(k); });
}

// ---------------- boss ----------------
const B_SPIN = (n: number): Volley => ({ shape: 'ring', count: n, speed: 50, sprite: 'eb_pink' });
const B_SHOTGUN: Volley = { shape: 'shotgun', count: 7, speed: 85, spread: 0.13, speedVar: 0.35, sprite: 'eb_big' };
const B_GAP: Volley = { shape: 'gapRing', count: 22, gap: 4, speed: 60, sprite: 'eb_big' };
const B_FLOWER: Volley = { shape: 'ring', count: 10, speed: 48, turn: 0.9, altTurn: true, sprite: 'eb_cyan' };
const B_STREAM: Volley = { shape: 'fan', count: 3, speed: 125, spread: 0.12, sprite: 'eb_blue' };
const B_MINEFIELD: Volley = { shape: 'ring', count: 18, speed: 95, acc: -70, minV: 10, sprite: 'eb_orange' };
const B_WAVE: Volley = { shape: 'fan', count: 5, speed: 70, spread: 0.3, wave: 0.6, sprite: 'eb_big' };

/** Style Serca Pustki w kolejnych fazach: Oko Pustki, Żar Pustkowia, Władca Otchłani. */
const VOID_STYLES = [3, 2, 0];

/** Kolory spirali i pocisków ataków wg stylu bossa (biomu). */
const SPIN_SPRITE = ['eb_pink', 'eb_cyan', 'eb_orange', 'eb_blue'];

/**
 * Boss w trzech fazach (wg % HP), w stylu bossów z ROTMG: stała spirala + nazwane ataki z zapowiedzią
 * (boss miga przez ostatnie 0,5 s przed atakiem). Zmiana fazy: chwila nietykalności, czyszczenie pocisków.
 * Każdy biom ma własnego bossa (styl = biom poziomu) z innymi atakami (BOSS_STYLES) i mocami do kradzieży (data/enemies.ts):
 *  0 Władca Otchłani — śrut, pierścienie z luką, kwiat, strumień, szarża, szlamy, pole minowe, wężyki, nietoperze;
 *  1 Królowa Bagien — kwaśny deszcz, roje szlamów, sieci bagna pod graczem, skręcające kwiaty, toksyczne pole;
 *  2 Żar Pustkowia — ogniste pierścienie, szarże, deszcz żaru (zaznaczone kręgi), podwójny śrut;
 *  3 Oko Pustki — teleporty, długie strumienie, gęsta spirala, obrotowy wzrok pustki.
 */
function updateBoss(run: Run, e: Enemy, dt: number, dx: number, dy: number, dist: number): void {
  const frac = e.hp / e.maxHp;
  const phase = frac > 0.66 ? 0 : frac > 0.33 ? 1 : 2;
  // Serce Pustki (sekretny biom): w każdej fazie walczy jak inny boss.
  const style = run.levelInfo.biome === VOID_BIOME ? VOID_STYLES[phase] : run.levelInfo.biome % BOSS_STYLES.length;
  if (phase !== e.phase) {
    e.phase = phase;
    e.invuln = 1.2;
    e.dashT = 0;
    e.actT = 2;
    for (const b of run.bullets.items) run.burst(b.x, b.y, C.pink, 1, 15);
    run.bullets.clear();
    run.showBanner(`Faza ${phase + 1}!`);
    run.addShake(6);
    sfx.play('boss');
  }
  if (e.invuln > 0) e.invuln -= dt;

  if (e.dashT > 0) {
    e.dashT -= dt;
    if (e.dashT < 0.5) { e.x += e.dvx * dt; e.y += e.dvy * dt; } // po zapowiedzi — szarża
    else if (run.step % 4 < 2) e.flash = 2;
  } else if (dist > 1) {
    // Boss trzyma dystans: walka toczy się na pociski, nie na zderzenia (jak w ROTMG).
    const dir = dist > 70 ? 1 : dist < 50 ? -1 : 0;
    const sp = e.speed * (1 + 0.25 * phase) * dir;
    e.x += (dx / dist) * sp * dt;
    e.y += (dy / dist) * sp * dt;
  }

  const dmg = e.damage * BAL.bossBulletDmg;
  e.shootT -= dt;
  if (e.shootT <= 0) {
    e.shootT = [0.26, 0.22, 0.18][phase];
    e.shootA += phase === 2 ? -0.21 : 0.19;
    fireVolley(run, e.x, e.y, { ...B_SPIN(2 + phase), sprite: SPIN_SPRITE[style] }, e.shootA, dmg);
  }
  e.actT -= dt;
  if (e.actT > 0 && e.actT < 0.5 && run.step % 6 < 3) e.flash = 2; // zapowiedź ataku
  if (e.actT > 0) return;
  const alt = (e.phase + Math.floor(e.age / 3)) % 2; // na zmianę dwa ataki fazy
  e.actT = BOSS_STYLES[style](run, e, phase, alt, dmg, dx, dy, dist);
}

type BossAttack = (run: Run, e: Enemy, phase: number, alt: number, dmg: number, dx: number, dy: number, dist: number) => number;

const aimAt = (run: Run, e: Enemy) => Math.atan2(run.player.y - e.y, run.player.x - e.x);

/** Szarża bossa: zapowiedź, potem pęd w stronę gracza. */
function bossCharge(e: Enemy, dx: number, dy: number, dist: number, speed = 190): void {
  e.dashT = 1.1;
  e.dvx = (dx / dist) * speed;
  e.dvy = (dy / dist) * speed;
}

/** Zaznaczone kręgi wokół gracza, w które po chwili uderza ogień bossa (systems/levelevents.ts updateStrikes). */
function markStrikes(run: Run, n: number, dmg: number): void {
  const p = run.player;
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, TAU), d = i === 0 ? 0 : rng.range(30, 110);
    run.strikes.push({ x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, t: 0.9 + i * 0.12, foe: dmg });
  }
}

/** Teleport bossa w losowe miejsce w pobliżu gracza. */
function bossBlink(run: Run, e: Enemy): void {
  const a = rng.range(0, TAU), r = rng.range(80, 120);
  run.burst(e.x, e.y, C.pink, 16, 60);
  e.x = run.player.x + Math.cos(a) * r;
  e.y = run.player.y + Math.sin(a) * r;
  run.burst(e.x, e.y, C.pink, 16, 60);
}

const BOSS_STYLES: BossAttack[] = [
  // 0 — Władca Otchłani.
  (run, e, phase, alt, dmg, dx, dy, dist) => {
    const aim = () => aimAt(run, e);
    if (phase === 0) {
      if (alt === 0) fireVolley(run, e.x, e.y, B_SHOTGUN, aim(), dmg);
      else sequence(run, e, 2, 0.45, () => fireVolley(run, e.x, e.y, B_GAP, aim() + rng.range(-1.2, 1.2), dmg));
      return 2.8;
    }
    if (phase === 1) {
      if (alt === 0) sequence(run, e, 2, 0.45, (k) => fireVolley(run, e.x, e.y, B_FLOWER, k * 0.3, dmg));
      else sequence(run, e, 5, 0.12, () => fireVolley(run, e.x, e.y, B_STREAM, aim(), dmg));
      if (rng.chance(0.35)) bossCharge(e, dx, dy, dist);
      else if (rng.chance(0.3)) for (let i = 0; i < 6; i++) spawnEnemy(run, 'slime', e.x + Math.cos((i * TAU) / 6) * 20, e.y + Math.sin((i * TAU) / 6) * 20);
      return 3.2;
    }
    if (alt === 0) {
      fireVolley(run, e.x, e.y, B_MINEFIELD, rng.range(0, TAU), dmg);
      sequence(run, e, 2, 0.9, (k) => { if (k) fireVolley(run, e.x, e.y, B_GAP, aim(), dmg); });
    } else sequence(run, e, 2, 0.4, () => fireVolley(run, e.x, e.y, B_WAVE, aim(), dmg));
    if (rng.chance(0.3)) for (let i = 0; i < 8; i++) spawnEnemy(run, 'bat', e.x + rng.range(-25, 25), e.y + rng.range(-25, 25));
    return 2.6;
  },
  // 1 — Królowa Bagien: kwaśny deszcz, szlamy, sieci bagna, kwiaty.
  (run, e, phase, alt, dmg) => {
    const aim = () => aimAt(run, e);
    const acid: Volley = { shape: 'fan', count: 5 + phase, speed: 70, spread: 0.22, acc: -20, minV: 30, sprite: 'eb_cyan' };
    if (phase === 0) {
      if (alt === 0) sequence(run, e, 3, 0.35, () => fireVolley(run, e.x, e.y, acid, aim() + rng.range(-0.3, 0.3), dmg));
      else for (let i = 0; i < 8; i++) spawnEnemy(run, 'slime', e.x + Math.cos((i * TAU) / 8) * 26, e.y + Math.sin((i * TAU) / 8) * 26);
      return 3;
    }
    if (phase === 1) {
      if (alt === 0) sequence(run, e, 3, 0.4, (k) => fireVolley(run, e.x, e.y, { ...B_FLOWER, count: 12 }, k * 0.25, dmg));
      else {
        // Bagno: sieci pod graczem i wokół niego (spowalniają).
        const p = run.player;
        for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU; run.webs.push({ x: p.x + Math.cos(a) * 34 * (i ? 1 : 0), y: p.y + Math.sin(a) * 34 * (i ? 1 : 0), r: 30, t: 4 }); }
        fireVolley(run, e.x, e.y, acid, aim(), dmg);
      }
      return 3.2;
    }
    if (alt === 0) {
      fireVolley(run, e.x, e.y, { ...B_MINEFIELD, sprite: 'eb_cyan', count: 24 }, rng.range(0, TAU), dmg);
      sequence(run, e, 3, 0.5, () => fireVolley(run, e.x, e.y, acid, aim(), dmg));
    } else {
      sequence(run, e, 2, 0.4, () => fireVolley(run, e.x, e.y, { ...B_WAVE, sprite: 'eb_cyan' }, aim(), dmg));
      for (let i = 0; i < 6; i++) spawnEnemy(run, 'slime', e.x + rng.range(-25, 25), e.y + rng.range(-25, 25));
    }
    return 2.6;
  },
  // 2 — Żar Pustkowia: ogniste pierścienie, szarże, deszcz żaru, podwójny śrut.
  (run, e, phase, alt, dmg, dx, dy, dist) => {
    const aim = () => aimAt(run, e);
    const ring: Volley = { shape: 'gapRing', count: 26, gap: 4, speed: 70, sprite: 'eb_orange' };
    if (phase === 0) {
      if (alt === 0) sequence(run, e, 2, 0.5, () => fireVolley(run, e.x, e.y, ring, aim() + rng.range(-1, 1), dmg));
      else { bossCharge(e, dx, dy, dist, 210); fireVolley(run, e.x, e.y, { ...B_SHOTGUN, sprite: 'eb_orange' }, aim(), dmg); }
      return 2.8;
    }
    if (phase === 1) {
      if (alt === 0) markStrikes(run, 6, dmg * 1.5);
      else sequence(run, e, 2, 0.3, () => fireVolley(run, e.x, e.y, { ...B_SHOTGUN, count: 9, sprite: 'eb_orange' }, aim(), dmg));
      return 3;
    }
    if (alt === 0) { markStrikes(run, 9, dmg * 1.5); fireVolley(run, e.x, e.y, ring, aim(), dmg); }
    else { bossCharge(e, dx, dy, dist, 240); sequence(run, e, 2, 0.6, () => fireVolley(run, e.x, e.y, { ...B_MINEFIELD, count: 22 }, rng.range(0, TAU), dmg)); }
    return 2.5;
  },
  // 3 — Oko Pustki: teleporty, długie strumienie, gęsta spirala, obrotowy wzrok.
  (run, e, phase, alt, dmg) => {
    const aim = () => aimAt(run, e);
    if (phase === 0) {
      if (alt === 0) { bossBlink(run, e); fireVolley(run, e.x, e.y, { ...B_GAP, sprite: 'eb_blue' }, aim(), dmg); }
      else sequence(run, e, 8, 0.1, () => fireVolley(run, e.x, e.y, B_STREAM, aim(), dmg));
      return 2.8;
    }
    if (phase === 1) {
      if (alt === 0) sequence(run, e, 10, 0.08, (k) => fireVolley(run, e.x, e.y, { ...B_SPIN(4), sprite: 'eb_blue', speed: 70 }, k * 0.2, dmg));
      else sequence(run, e, 2, 0.5, () => fireVolley(run, e.x, e.y, { ...B_GAP, count: 28, sprite: 'eb_blue' }, aim(), dmg));
      return 3;
    }
    // Wzrok pustki: strumień obracający się wokół bossa.
    const base = aim() - 1.2;
    if (alt === 0) sequence(run, e, 14, 0.07, (k) => fireVolley(run, e.x, e.y, { ...B_STREAM, count: 2, spread: 0.08 }, base + k * 0.18, dmg));
    else { bossBlink(run, e); sequence(run, e, 2, 0.4, () => fireVolley(run, e.x, e.y, { ...B_WAVE, sprite: 'eb_blue' }, aim(), dmg)); }
    return 2.4;
  },
];

/** Salwa zwykłego wroga wg ShootDef (kąt bazowy zależny od `aim`). */
function shoot(run: Run, e: Enemy, sh: ShootDef, dmg: number): void {
  const p = run.player;
  let base: number;
  if (sh.aim === 'player') base = Math.atan2(p.y - e.y, p.x - e.x);
  else if (sh.aim === 'spin') base = (e.shootA += sh.spin ?? 0.4);
  else base = rng.range(0, TAU);
  fireVolley(run, e.x, e.y, sh.volley, base, dmg);
}

/** Elita "Ostrzał": kwiat skręcających pocisków. */
const ELITE_FLOWER: Volley = { shape: 'ring', count: 8, speed: 45, turn: 0.8, altTurn: true, sprite: 'eb_orange' };

/** Ruch, strzelanie, separacja, odrzut, obrażenia kontaktowe i usuwanie martwych. */
export function updateEnemies(run: Run, dt: number): void {
  const items = run.enemies.items;
  const p = run.player, N = BAL.newEnemies;
  // Sieci Pajęczarzy: wygasają, gracz w sieci jest spowolniony (systems/player.ts).
  run.webbed = false;
  for (const w of run.webs) { w.t -= dt; if ((w.x - p.x) ** 2 + (w.y - p.y) ** 2 < w.r * w.r) run.webbed = true; }
  if (run.webs.some((w) => w.t <= 0)) run.webs = run.webs.filter((w) => w.t > 0);
  for (let i = items.length - 1; i >= 0; i--) {
    const e = items[i];
    if (e.dead) { run.enemies.release(e); continue; }
    e.age += dt;
    if (e.flash > 0) e.flash--;
    if (e.regen > 0) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * e.regen * dt);
    if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) { e.slowF = 0; e.chill = 0; } }
    // Stany żywiołów: porażenie wygasa, podpalenie i trucizna zadają obrażenia co ELEM.dotTick.
    if (e.shockT > 0) e.shockT -= dt;
    if (e.burnT > 0 || e.poisonT > 0) {
      e.burnT -= dt;
      e.poisonT -= dt;
      if (e.burnT <= 0) e.burnDps = 0;
      if (e.poisonT <= 0) { e.poisonStacks = 0; e.poisonUnit = 0; }
      e.dotT -= dt;
      if (e.dotT <= 0) {
        e.dotT = ELEM.dotTick;
        if (e.burnDps > 0) run.damageEnemy(e, e.burnDps * ELEM.dotTick, 'Podpalenie', { dot: true });
        if (e.poisonStacks > 0 && !e.dead) run.damageEnemy(e, e.poisonUnit * e.poisonStacks * ELEM.dotTick, 'Trucizna', { dot: true });
        if (e.dead) continue;
      }
    }

    let dx = p.x - e.x, dy = p.y - e.y;
    let dist = Math.hypot(dx, dy) || 1;

    // Zbyt daleko — przenieś na drugą stronę gracza zamiast tracić wroga.
    if (dist > RELOCATE_DIST && !e.boss && !e.elite && e.def.behavior !== 'flee') {
      const a = Math.atan2(dy, dx) + rng.range(-0.5, 0.5);
      e.x = p.x + Math.cos(a) * 200;
      e.y = p.y + Math.sin(a) * 200;
      dx = p.x - e.x; dy = p.y - e.y; dist = Math.hypot(dx, dy) || 1;
    }

    if (e.boss) {
      updateBoss(run, e, dt, dx, dy, dist);
    } else if (e.stunT > 0) {
      e.stunT -= dt;
    } else {
      const sp = e.speed * (1 - e.slowF) * dt;
      const nx = dx / dist, ny = dy / dist;
      switch (e.def.behavior) {
        case 'chase':
          e.x += nx * sp; e.y += ny * sp;
          break;
        case 'flee':
          // Złoty szlam: ucieka zygzakiem i po chwili znika.
          e.x -= (nx - ny * Math.sin(e.age * 3)) * sp; e.y -= (ny + nx * Math.sin(e.age * 3)) * sp;
          if (e.age > BAL.events.goldSlimeLife) e.dead = true;
          break;
        case 'fast': {
          const w = Math.sin(e.age * 6 + e.uid) * 0.6;
          e.x += (nx - ny * w) * sp; e.y += (ny + nx * w) * sp;
          break;
        }
        case 'shield': {
          // Tarcza obraca się powoli w stronę gracza (kąt w shootA); idzie wolno naprzód.
          let d = Math.atan2(dy, dx) - e.shootA;
          d = Math.atan2(Math.sin(d), Math.cos(d));
          e.shootA += Math.max(-1, Math.min(1, d)) * N.shieldTurn * dt;
          e.x += nx * sp; e.y += ny * sp;
          break;
        }
        case 'kamikaze':
          // Lont: stoi i miga, potem wybuch (rani gracza w promieniu, sam ginie).
          if (e.dashT > 0) {
            e.dashT -= dt;
            if (run.step % 4 < 2) e.flash = 2;
            if (e.dashT <= 0) {
              if (dist < N.kamikazeR + p.r) run.hurtPlayer(e.damage * N.kamikazeDmg);
              run.boomFx(e.x, e.y, N.kamikazeR);
              run.burst(e.x, e.y, C.orange, 16, 80);
              sfx.play('explode');
              run.killEnemy(e);
              continue;
            }
          } else if (dist < N.kamikazeFuseAt) e.dashT = N.kamikazeFuse;
          else { e.x += nx * sp; e.y += ny * sp; }
          break;
        case 'blink':
          // Teleport obok gracza po zapowiedzi (miganie).
          e.actT -= dt;
          if (e.actT < 0.5 && run.step % 4 < 2) e.flash = 2;
          if (e.actT <= 0) {
            e.actT = N.blinkEvery * rng.range(0.8, 1.2);
            const a = rng.range(0, TAU), r = rng.range(N.blinkMin, N.blinkMax);
            run.burst(e.x, e.y, C.cyan, 6, 40);
            e.x = p.x + Math.cos(a) * r; e.y = p.y + Math.sin(a) * r;
            run.burst(e.x, e.y, C.cyan, 6, 40);
          } else { e.x += nx * sp; e.y += ny * sp; }
          break;
        case 'summoner':
        case 'weaver': {
          const k = e.def.keepDist ?? 110;
          const dir = dist > k + 10 ? 1 : dist < k - 10 ? -0.6 : 0;
          e.x += (nx * dir - ny * 0.3) * sp; e.y += (ny * dir + nx * 0.3) * sp;
          e.actT -= dt;
          if (e.actT < 0.5 && dist < 220 && run.step % 6 < 3) e.flash = 2;
          if (e.actT > 0 || dist > 220) break;
          if (e.def.behavior === 'summoner') {
            e.actT = N.summonEvery;
            for (let i = 0; i < N.summonCount && run.enemies.count < BAL.maxEnemies; i++) spawnEnemy(run, 'bat', e.x + rng.range(-12, 12), e.y + rng.range(-12, 12));
            run.burst(e.x, e.y, C.lime, 10, 50);
          } else {
            // Sieć pod graczem (spowalnia, dopóki w niej stoi).
            e.actT = N.webEvery;
            run.webs.push({ x: p.x, y: p.y, r: N.webR, t: N.webLife });
          }
          break;
        }
        case 'keep': {
          const k = e.def.keepDist ?? 80;
          const dir = dist > k + 10 ? 1 : dist < k - 10 ? -0.6 : 0;
          e.x += (nx * dir - ny * 0.4) * sp; e.y += (ny * dir + nx * 0.4) * sp;
          break;
        }
      }
      const sh = e.def.shoot;
      if (sh || e.extraRing) {
        const dmg = e.damage * BAL.bulletDmg;
        // Seria w toku: kolejne salwy co burstGap (każda celuje od nowa).
        if (sh && e.burstLeft > 0) {
          e.burstT -= dt;
          if (e.burstT <= 0) { shoot(run, e, sh, dmg); e.burstLeft--; e.burstT = sh.burstGap ?? 0.2; }
        }
        e.shootT -= dt;
        // Zapowiedź salwy: wróg miga.
        if (sh?.windup && e.shootT < sh.windup && dist < sh.range && run.step % 6 < 3) e.flash = 2;
        if (e.shootT <= 0 && run.bullets.count < BAL.enemyBulletSoftCap) {
          if (sh && dist < sh.range) {
            shoot(run, e, sh, dmg);
            e.burstLeft = (sh.burst ?? 1) - 1;
            e.burstT = sh.burstGap ?? 0.2;
          }
          if (e.extraRing && dist < 170) fireVolley(run, e.x, e.y, ELITE_FLOWER, rng.range(0, TAU), dmg);
          e.shootT = sh ? sh.cooldown : 2.5;
          if (e.extraRing && sh) e.shootT = Math.max(sh.cooldown, 1.2);
        }
      }
    }

    // Odrzut (wygasa wykładniczo).
    if (e.kx !== 0 || e.ky !== 0) {
      e.x += e.kx * dt; e.y += e.ky * dt;
      e.kx *= 0.85; e.ky *= 0.85;
      if (Math.abs(e.kx) + Math.abs(e.ky) < 1) e.kx = e.ky = 0;
    }

    // Separacja: co drugi krok (naprzemiennie wg uid), tylko wróg przesuwa siebie.
    if (!e.boss && (run.step + e.uid) % 2 === 0) {
      const near = run.hash.query(e.x, e.y, e.radius * 2, run.qb);
      for (let j = 0; j < near.length; j++) {
        const o = near[j];
        if (o === e || o.dead) continue;
        const ox = e.x - o.x, oy = e.y - o.y;
        const min = e.radius + o.radius;
        const d2 = ox * ox + oy * oy;
        if (d2 < min * min && d2 > 0.0001) {
          const d = Math.sqrt(d2);
          const push = ((min - d) / d) * (o.boss ? 1 : 0.5);
          e.x += ox * push; e.y += oy * push;
        }
      }
    }

    // Uderzenie wręcz: każdy wróg osobno co BAL.contactCooldown (tłum jest groźny, leczenie go nie przebije).
    if (e.touchCd > 0) e.touchCd -= dt;
    if (e.reactT > 0) e.reactT -= dt;
    if (e.touchCd <= 0 && e.damage > 0 && dist < e.radius + p.r && run.hurtPlayer(e.damage)) e.touchCd = BAL.contactCooldown;
  }
}
