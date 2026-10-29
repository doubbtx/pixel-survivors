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
    b.life = v.life ?? 6;
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
  const style = bossStyle(run, phase);
  if (phase !== e.phase) {
    e.phase = phase;
    e.nextAlt = 0;
    e.told = false;
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
    else if (run.blink(4, 2)) e.flash = 2;
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
  if (e.actT > 0 && e.actT < 0.5 && run.blink(6, 3)) e.flash = 2; // zapowiedź ataku
  // Nazwa nadchodzącego ataku nad bossem (0.33), razem z zapowiedzią w render.ts (linia, pierścień albo krąg pod graczem).
  if (e.actT > 0 && e.actT < BOSS_TELL && !e.told) {
    e.told = true;
    run.popText(e.x, e.y - e.radius * e.scale - 10, BOSS_NAMES[style][phase][e.nextAlt], C.yellow);
  }
  if (e.actT > 0) return;
  // Trzy ataki fazy po kolei (0.33: trzeci atak w każdej fazie).
  const alt = e.nextAlt;
  e.actT = BOSS_STYLES[style](run, e, phase, alt, dmg, dx, dy, dist);
  e.nextAlt = (alt + 1) % 3;
  e.told = false;
}

/** Czas zapowiedzi ataku bossa (nazwa i znak w render.ts). */
export const BOSS_TELL = 0.7;

/** Nazwy ataków bossów [styl][faza][atak] (po angielsku, polski w core/i18n-pl.ts). */
const BOSS_NAMES: string[][][] = [
  [['Buckshot', 'Gap Rings', 'Cross Fire'], ['Blossom', 'Stream', 'Abyss Bloom'], ['Minefield', 'Snake Waves', 'Final Spiral']],
  [['Acid Rain', 'Slime Brood', 'Spore Ring'], ['Swamp Flowers', 'Bog Nets', 'Bog Rain'], ['Toxic Field', 'Tide', 'Hydra']],
  [['Fire Rings', 'Burning Charge', 'Flame Fan'], ['Ember Rain', 'Double Buckshot', 'Burning Circle'], ['Inferno', 'Stampede', 'Meteor Barrage']],
  [['Void Blink', 'Void Stream', 'Void Lance'], ['Spiral', 'Twin Gaps', 'Mirror Blink'], ['Void Gaze', 'Phase Shift', 'Collapse']],
];

/** Rodzaj zapowiedzi ataku [styl][faza][atak]: 'aim' linia w gracza, 'ring' pierścień wokół bossa, 'player' krąg pod graczem, '' sama nazwa. */
export const BOSS_TELLS: string[][][] = [
  [['aim', 'aim', 'ring'], ['ring', 'aim', 'aim'], ['ring', 'aim', 'ring']],
  [['aim', 'ring', 'ring'], ['ring', 'player', 'player'], ['ring', 'aim', 'aim']],
  [['aim', 'aim', 'aim'], ['player', 'aim', 'player'], ['player', 'aim', 'player']],
  [['ring', 'aim', 'aim'], ['ring', 'aim', 'ring'], ['aim', 'aim', 'player']],
];

/** Styl bossa (biom; Serce Pustki zmienia styl z fazą) — wspólne dla logiki i zapowiedzi w render.ts. */
export function bossStyle(run: Run, phase: number): number {
  return run.levelInfo.biome === VOID_BIOME ? VOID_STYLES[phase] : run.levelInfo.biome % BOSS_STYLES.length;
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
      if (alt === 2) { sequence(run, e, 6, 0.12, (k) => { for (let q = 0; q < 4; q++) fireVolley(run, e.x, e.y, { shape: 'fan', count: 2, speed: 90, spread: 0.1, sprite: 'eb_pink' }, k * 0.12 + (q * TAU) / 4, dmg); }); return 2.8; }
      if (alt === 0) fireVolley(run, e.x, e.y, B_SHOTGUN, aim(), dmg);
      else sequence(run, e, 2, 0.45, () => fireVolley(run, e.x, e.y, B_GAP, aim() + rng.range(-1.2, 1.2), dmg));
      return 2.8;
    }
    if (phase === 1) {
      if (alt === 2) { sequence(run, e, 3, 0.35, (k) => fireVolley(run, e.x, e.y, { ...B_GAP, count: 24, speed: 55 + k * 12, sprite: 'eb_pink' }, aim() + (k % 2 ? 0.5 : -0.5), dmg)); return 3; }
      if (alt === 0) sequence(run, e, 2, 0.45, (k) => fireVolley(run, e.x, e.y, B_FLOWER, k * 0.3, dmg));
      else sequence(run, e, 5, 0.12, () => fireVolley(run, e.x, e.y, B_STREAM, aim(), dmg));
      if (rng.chance(0.35)) bossCharge(e, dx, dy, dist);
      else if (rng.chance(0.3)) for (let i = 0; i < 6; i++) spawnEnemy(run, 'slime', e.x + Math.cos((i * TAU) / 6) * 20, e.y + Math.sin((i * TAU) / 6) * 20);
      return 3.2;
    }
    if (alt === 2) { sequence(run, e, 16, 0.06, (k) => { fireVolley(run, e.x, e.y, { shape: 'ring', count: 2, speed: 80, sprite: 'eb_pink' }, k * 0.33, dmg); fireVolley(run, e.x, e.y, { shape: 'ring', count: 2, speed: 80, sprite: 'eb_big' }, -k * 0.33, dmg); }); return 2.6; }
    if (alt === 0) {
      fireVolley(run, e.x, e.y, B_MINEFIELD, rng.range(0, TAU), dmg);
      sequence(run, e, 2, 0.9, (k) => { if (k) fireVolley(run, e.x, e.y, B_GAP, aim(), dmg); });
    } else sequence(run, e, 2, 0.4, () => fireVolley(run, e.x, e.y, B_WAVE, aim(), dmg));
    if (rng.chance(0.3)) for (let i = 0; i < 8; i++) spawnEnemy(run, 'bat', e.x + rng.range(-25, 25), e.y + rng.range(-25, 25));
    return 2.6;
  },
  // 1 — Królowa Bagien: kwaśny deszcz (część z wyprzedzeniem ruchu gracza), szlamy, sieci bagna, kwiaty.
  (run, e, phase, alt, dmg) => {
    const aim = () => aimAt(run, e);
    const acid: Volley = { shape: 'fan', count: 6 + phase, speed: 82, spread: 0.2, acc: -20, minV: 34, sprite: 'eb_cyan' };
    if (phase === 0) {
      if (alt === 2) { fireVolley(run, e.x, e.y, { shape: 'ring', count: 20, speed: 18, acc: 70, minV: 18, sprite: 'eb_cyan' }, rng.range(0, TAU), dmg); return 2.3; }
      if (alt === 0) sequence(run, e, 4, 0.3, (k) => fireVolley(run, e.x, e.y, acid, k % 2 ? leadAim(run, e, 82) : aim() + rng.range(-0.3, 0.3), dmg));
      else {
        for (let i = 0; i < 8; i++) spawnEnemy(run, 'slime', e.x + Math.cos((i * TAU) / 8) * 26, e.y + Math.sin((i * TAU) / 8) * 26);
        sequence(run, e, 2, 0.4, () => fireVolley(run, e.x, e.y, acid, leadAim(run, e, 82), dmg));
      }
      return 2.3;
    }
    if (phase === 1) {
      if (alt === 2) {
        const p = run.player, M = BAL.biomeEnemies;
        for (let i = 0; i < 7; i++) { const a = rng.range(0, TAU), d = i ? rng.range(20, 80) : 0; run.strikes.push({ x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, t: 0.9 + i * 0.12, foe: dmg * 1.4, seed: true, r: M.mortarR }); }
        return 2.5;
      }
      if (alt === 0) sequence(run, e, 3, 0.35, (k) => fireVolley(run, e.x, e.y, { ...B_FLOWER, count: 14 }, k * 0.25, dmg));
      else {
        // Bagno: sieci pod graczem i wokół niego (spowalniają), w tym czasie kwas w miejsce, gdzie gracz będzie.
        const p = run.player;
        for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU; run.webs.push({ x: p.x + Math.cos(a) * 34 * (i ? 1 : 0), y: p.y + Math.sin(a) * 34 * (i ? 1 : 0), r: 30, t: 4 }); }
        sequence(run, e, 3, 0.35, () => fireVolley(run, e.x, e.y, acid, leadAim(run, e, 82), dmg));
      }
      return 2.5;
    }
    if (alt === 2) { const a = aim(); sequence(run, e, 2, 0.5, () => { for (const o of [-0.7, 0, 0.7]) fireVolley(run, e.x, e.y, { ...B_WAVE, sprite: 'eb_cyan' }, a + o, dmg); }); return 2.1; }
    if (alt === 0) {
      fireVolley(run, e.x, e.y, { ...B_MINEFIELD, sprite: 'eb_cyan', count: 26 }, rng.range(0, TAU), dmg);
      sequence(run, e, 4, 0.4, (k) => fireVolley(run, e.x, e.y, acid, k % 2 ? leadAim(run, e, 82) : aim(), dmg));
    } else {
      sequence(run, e, 3, 0.35, () => fireVolley(run, e.x, e.y, { ...B_WAVE, sprite: 'eb_cyan' }, aim(), dmg));
      for (let i = 0; i < 6; i++) spawnEnemy(run, 'slime', e.x + rng.range(-25, 25), e.y + rng.range(-25, 25));
    }
    return 2.1;
  },
  // 2 — Żar Pustkowia: ogniste pierścienie, szarże, deszcz żaru, podwójny śrut.
  (run, e, phase, alt, dmg, dx, dy, dist) => {
    const aim = () => aimAt(run, e);
    const ring: Volley = { shape: 'gapRing', count: 26, gap: 4, speed: 70, sprite: 'eb_orange' };
    if (phase === 0) {
      if (alt === 2) { const a = aim(); sequence(run, e, 4, 0.18, (k) => fireVolley(run, e.x, e.y, { ...B_SHOTGUN, sprite: 'eb_orange' }, a - 0.6 + k * 0.4, dmg)); return 2.8; }
      if (alt === 0) sequence(run, e, 2, 0.5, () => fireVolley(run, e.x, e.y, ring, aim() + rng.range(-1, 1), dmg));
      else { bossCharge(e, dx, dy, dist, 210); fireVolley(run, e.x, e.y, { ...B_SHOTGUN, sprite: 'eb_orange' }, aim(), dmg); }
      return 2.8;
    }
    if (phase === 1) {
      if (alt === 2) {
        const p = run.player;
        for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; run.strikes.push({ x: p.x + Math.cos(a) * 55, y: p.y + Math.sin(a) * 55, t: 0.9, foe: dmg * 1.5 }); }
        run.strikes.push({ x: p.x, y: p.y, t: 1.6, foe: dmg * 1.5 });
        return 3;
      }
      if (alt === 0) markStrikes(run, 6, dmg * 1.5);
      else sequence(run, e, 2, 0.3, () => fireVolley(run, e.x, e.y, { ...B_SHOTGUN, count: 9, sprite: 'eb_orange' }, aim(), dmg));
      return 3;
    }
    if (alt === 2) { markStrikes(run, 12, dmg * 1.5); bossCharge(e, dx, dy, dist, 220); return 2.5; }
    if (alt === 0) { markStrikes(run, 9, dmg * 1.5); fireVolley(run, e.x, e.y, ring, aim(), dmg); }
    else { bossCharge(e, dx, dy, dist, 240); sequence(run, e, 2, 0.6, () => fireVolley(run, e.x, e.y, { ...B_MINEFIELD, count: 22 }, rng.range(0, TAU), dmg)); }
    return 2.5;
  },
  // 3 — Oko Pustki: teleporty, długie strumienie, gęsta spirala, obrotowy wzrok.
  (run, e, phase, alt, dmg) => {
    const aim = () => aimAt(run, e);
    if (phase === 0) {
      if (alt === 2) { sequence(run, e, 5, 0.12, () => fireVolley(run, e.x, e.y, { shape: 'fan', count: 1, speed: 210, sprite: 'eb_big' }, leadAim(run, e, 210), dmg * 1.3)); return 2.8; }
      if (alt === 0) { bossBlink(run, e); fireVolley(run, e.x, e.y, { ...B_GAP, sprite: 'eb_blue' }, aim(), dmg); }
      else sequence(run, e, 8, 0.1, () => fireVolley(run, e.x, e.y, B_STREAM, aim(), dmg));
      return 2.8;
    }
    if (phase === 1) {
      if (alt === 2) { sequence(run, e, 2, 0.6, () => { bossBlink(run, e); fireVolley(run, e.x, e.y, { shape: 'ring', count: 18, speed: 60, sprite: 'eb_blue' }, rng.range(0, TAU), dmg); }); return 3; }
      if (alt === 0) sequence(run, e, 10, 0.08, (k) => fireVolley(run, e.x, e.y, { ...B_SPIN(4), sprite: 'eb_blue', speed: 70 }, k * 0.2, dmg));
      else sequence(run, e, 2, 0.5, () => fireVolley(run, e.x, e.y, { ...B_GAP, count: 28, sprite: 'eb_blue' }, aim(), dmg));
      return 3;
    }
    if (alt === 2) {
      const p = run.player;
      for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU; fireVolley(run, p.x + Math.cos(a) * 120, p.y + Math.sin(a) * 120, { shape: 'fan', count: 1, speed: 55, sprite: 'eb_blue' }, a + Math.PI, dmg); }
      return 2.4;
    }
    // Wzrok pustki: strumień obracający się wokół bossa.
    const base = aim() - 1.2;
    if (alt === 0) sequence(run, e, 14, 0.07, (k) => fireVolley(run, e.x, e.y, { ...B_STREAM, count: 2, spread: 0.08 }, base + k * 0.18, dmg));
    else { bossBlink(run, e); sequence(run, e, 2, 0.4, () => fireVolley(run, e.x, e.y, { ...B_WAVE, sprite: 'eb_blue' }, aim(), dmg)); }
    return 2.4;
  },
];

/** Kąt w miejsce, w którym gracz będzie, gdy dolecą pociski o prędkości `speed` (wyprzedzenie ruchu). */
function leadAim(run: Run, e: Enemy, speed: number): number {
  const p = run.player, t = Math.hypot(p.x - e.x, p.y - e.y) / speed;
  return Math.atan2(p.y + p.vy * t - e.y, p.x + p.vx * t - e.x);
}

type WardenAttack = (run: Run, e: Enemy, dmg: number, spr: string, dx: number, dy: number, dist: number) => void;

/** Ataki minibossów lochów (losowane, bez powtórki tego samego dwa razy z rzędu); `spr` = sprite pocisków. */
const WARDEN_ATTACKS: WardenAttack[] = [
  // Śrut z wyprzedzeniem.
  (run, e, dmg, spr) => fireVolley(run, e.x, e.y, { ...B_SHOTGUN, sprite: spr }, leadAim(run, e, 85), dmg),
  // Trzy pierścienie z przesuwającą się luką.
  (run, e, dmg, spr) => { const a = aimAt(run, e); sequence(run, e, 3, 0.35, (k) => fireVolley(run, e.x, e.y, { ...B_GAP, count: 24, sprite: spr }, a + k * 0.7, dmg)); },
  // Szarża zakończona pierścieniem.
  (run, e, dmg, spr, dx, dy, dist) => {
    bossCharge(e, dx, dy, dist, 230);
    sequence(run, e, 2, 1.15, (k) => { if (k) fireVolley(run, e.x, e.y, { shape: 'ring', count: 16, speed: 70, sprite: spr }, rng.range(0, TAU), dmg); });
  },
  // Strumień celujący z wyprzedzeniem.
  (run, e, dmg, spr) => sequence(run, e, 6, 0.1, () => fireVolley(run, e.x, e.y, { ...B_STREAM, sprite: spr }, leadAim(run, e, 125), dmg)),
  // Hamujące pociski dookoła (pole minowe).
  (run, e, dmg, spr) => fireVolley(run, e.x, e.y, { ...B_MINEFIELD, count: 20, sprite: spr }, rng.range(0, TAU), dmg),
  // Krzyżowy ogień: dwa falujące wachlarze po bokach gracza.
  (run, e, dmg, spr) => { const a = aimAt(run, e); for (const s of [-0.6, 0.6]) fireVolley(run, e.x, e.y, { ...B_WAVE, sprite: spr }, a + s, dmg); },
];

/** Przywołanie świty minibossa: `n` wrogów `id` w kręgu wokół gracza. */
function callAdds(run: Run, id: string, n: number): void {
  const p = run.player, a0 = rng.range(0, TAU);
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * TAU, x = p.x + Math.cos(a) * 110, y = p.y + Math.sin(a) * 80;
    run.burst(x, y, C.lgray, 6, 40);
    spawnEnemy(run, id, x, y);
  }
}

/** Skok Matrony: cel w miejscu gracza (z wyprzedzeniem), lot nad ziemią w updateWarden, przy lądowaniu pierścień. */
function wardenLeap(run: Run, e: Enemy): void {
  const p = run.player;
  e.tx = p.x + p.vx * 0.4; e.ty = p.y + p.vy * 0.4;
  e.dashT = 1.1;
  e.dvx = (e.tx - e.x) / 0.5; e.dvy = (e.ty - e.y) / 0.5;
}

/** Minibossowie biomów (0.30): każdy ma własne 4 ataki zamiast WARDEN_ATTACKS; reszta (spirala, szał, zapowiedź) jak u Strażnika skarbca. */
const MINIBOSS_ATTACKS: Record<string, WardenAttack[]> = {
  // Król Dzików: szarże (pojedyncza z pierścieniem, potrójna), tąpnięcie (fale z luką), wezwanie stada.
  boarking: [
    (run, e, dmg, spr, dx, dy, dist) => { bossCharge(e, dx, dy, dist, 250); sequence(run, e, 2, 1.15, (k) => { if (k) fireVolley(run, e.x, e.y, { shape: 'ring', count: 14, speed: 70, sprite: spr }, rng.range(0, TAU), dmg); }); },
    (run, e) => sequence(run, e, 3, 1.15, () => { const p = run.player, ddx = p.x - e.x, ddy = p.y - e.y; bossCharge(e, ddx, ddy, Math.hypot(ddx, ddy) || 1, 230); }),
    (run, e, dmg, spr) => sequence(run, e, 3, 0.45, (k) => { run.addShake(1.5); fireVolley(run, e.x, e.y, { ...B_GAP, count: 20, speed: 55 + k * 10, sprite: spr }, aimAt(run, e) + k * 0.5, dmg); }),
    (run) => { callAdds(run, 'boar', 3); run.showBanner('The herd answers!'); },
  ],
  // Matrona Ropuch: skok na gracza (pierścień przy lądowaniu), kwaśny deszcz (zielone kręgi), falujący splunięcie, wylęg ropuch.
  toadqueen: [
    (run, e) => wardenLeap(run, e),
    (run, _e, dmg) => {
      const p = run.player, B = BAL.biomeEnemies;
      for (let i = 0; i < 6; i++) { const a = rng.range(0, TAU), d = i ? rng.range(20, 70) : 0; run.strikes.push({ x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, t: 0.9 + i * 0.12, foe: dmg * B.mortarDmg, seed: true, r: B.mortarR }); }
    },
    (run, e, dmg, spr) => sequence(run, e, 2, 0.35, () => fireVolley(run, e.x, e.y, { ...B_WAVE, count: 7, sprite: spr }, aimAt(run, e), dmg)),
    (run) => callAdds(run, 'toad', 3),
  ],
  // Tyran Piasków: trzy strzały snajperskie, deszcz żądeł (kręgi), szarża z pierścieniem, śrut.
  sandtyrant: [
    (run, e, dmg) => sequence(run, e, 3, 0.4, () => fireVolley(run, e.x, e.y, { shape: 'fan', count: 1, speed: 250, sprite: 'eb_big' }, leadAim(run, e, 250), dmg * 1.4)),
    (run, _e, dmg) => markStrikes(run, 5, dmg * 1.6),
    (run, e, dmg, spr, dx, dy, dist) => { bossCharge(e, dx, dy, dist, 230); sequence(run, e, 2, 1.15, (k) => { if (k) fireVolley(run, e.x, e.y, { shape: 'ring', count: 16, speed: 70, sprite: spr }, rng.range(0, TAU), dmg); }); },
    (run, e, dmg, spr) => fireVolley(run, e.x, e.y, { ...B_SHOTGUN, sprite: spr }, leadAim(run, e, 85), dmg),
  ],
  // Strzaskany Rycerz: trzy cięcia-szarże, odbicia, teleport z pierścieniem z luką, krzyżowe fale.
  shatterknight: [
    (run, e) => sequence(run, e, 3, 1, () => { const p = run.player, ddx = p.x - e.x, ddy = p.y - e.y; bossCharge(e, ddx, ddy, Math.hypot(ddx, ddy) || 1, 270); }),
    (run) => { callAdds(run, 'mirror', 2); run.showBanner('Reflections step out of the glass!'); },
    (run, e, dmg, spr) => { bossBlink(run, e); fireVolley(run, e.x, e.y, { ...B_GAP, sprite: spr }, aimAt(run, e), dmg); },
    (run, e, dmg, spr) => { const a = aimAt(run, e); for (const s of [-0.6, 0.6]) fireVolley(run, e.x, e.y, { ...B_WAVE, sprite: spr }, a + s, dmg); },
  ],
  // Pryzmat Pustki: teleport z pierścieniem, odpryski, skręcający kwiat, pierścienie z luką (po śmierci pęka na dwa Rozszczepieńce).
  voidprism: [
    (run, e, dmg, spr) => { bossBlink(run, e); fireVolley(run, e.x, e.y, { shape: 'ring', count: 20, speed: 60, sprite: spr }, rng.range(0, TAU), dmg); },
    (run) => callAdds(run, 'splitling', 4),
    (run, e, dmg) => sequence(run, e, 2, 0.6, () => fireVolley(run, e.x, e.y, B_FLOWER, rng.range(0, TAU), dmg)),
    (run, e, dmg, spr) => sequence(run, e, 3, 0.35, (k) => fireVolley(run, e.x, e.y, { ...B_GAP, count: 24, sprite: spr }, aimAt(run, e) + k * 0.7, dmg)),
  ],
};

/**
 * Miniboss lochu (Strażnik skarbca, Strażnik lochu): krąży wokół gracza, strzela stałą spiralą i co chwilę (losowy odstęp) wykonuje losowy atak
 * z zapowiedzią (miga). Poniżej połowy HP szał: bliżej, gęstsza spirala, krótsze odstępy i czasem dwa ataki naraz.
 */
/** `sp`: prędkość ruchu (jednostki/s, po spowolnieniu). */
function updateWarden(run: Run, e: Enemy, dt: number, dx: number, dy: number, dist: number, nx: number, ny: number, sp: number): void {
  const Wd = BAL.secretsMap.warden, rage = e.hp < e.maxHp * 0.5, spr = e.def.bullet ?? 'eb_cyan';
  if (e.dashT > 0) {
    e.dashT -= dt;
    if (e.dashT < 0.5) {
      e.x += e.dvx * dt; e.y += e.dvy * dt;
      // Matrona skacze: łuk nad ziemią, przy lądowaniu pierścień i wstrząs.
      if (e.def.id === 'toadqueen') {
        e.z = Math.sin(Math.max(0, e.dashT / 0.5) * Math.PI) * BAL.biomeEnemies.miniLeapH;
        if (e.dashT <= 0) {
          e.z = 0;
          fireVolley(run, e.x, e.y, { shape: 'ring', count: 18, speed: 60, sprite: spr }, rng.range(0, TAU), e.damage * BAL.bulletDmg);
          run.burst(e.x, e.y + 4, C.dgreen, 16, 60);
          run.addShake(2.5);
          sfx.play('explode');
        }
      }
    } else if (run.blink(4, 2)) e.flash = 2;
  } else {
    // Krąży w dystansie `k`; gdy gracz ucieka poza ekran, dogania go prosto i szybciej (miniboss ma być widoczny).
    const k = rage ? 55 : 70, far = dist > Wd.catchUp, side = e.uid % 2 ? 1 : -1;
    const dir = far ? Wd.catchUpMul : dist > k + 10 ? 1 : dist < k - 10 ? -0.8 : 0, strafe = far ? 0 : 0.7 * side;
    e.x += (nx * dir - ny * strafe) * sp * dt;
    e.y += (ny * dir + nx * strafe) * sp * dt;
  }
  const dmg = e.damage * BAL.bulletDmg;
  e.shootT -= dt;
  if (e.shootT <= 0) {
    e.shootT = rage ? Wd.rageSpin : Wd.spin;
    e.shootA += 0.37;
    fireVolley(run, e.x, e.y, { shape: 'ring', count: rage ? 3 : 2, speed: 55, sprite: spr }, e.shootA, dmg);
  }
  e.actT -= dt;
  if (e.actT > 0 && e.actT < 0.4 && run.blink(6, 3)) e.flash = 2; // zapowiedź ataku
  if (e.actT > 0) return;
  const list = MINIBOSS_ATTACKS[e.def.id] ?? WARDEN_ATTACKS, n = list.length;
  let pick = rng.int(0, n - 1);
  if (pick === e.phase) pick = (pick + 1) % n;
  e.phase = pick;
  list[pick](run, e, dmg, spr, dx, dy, dist);
  // Drugi atak w szale — u minibossów biomów bez przywołań i skoków (te nie łączą się z innymi).
  const second = (pick + (list === WARDEN_ATTACKS ? 3 : 2)) % n;
  if (rage && rng.chance(Wd.rageDouble)) list[second](run, e, dmg, spr, dx, dy, dist);
  e.actT = rng.range(Wd.actMin, Wd.actMax) * (rage ? Wd.rageMul : 1);
}

/** Zachowania z własnym użyciem dashT/actT (wrogowie biomów): bez szarży elity, która by je nadpisała. */
const OWN_MOVES = new Set(['charger', 'mortar', 'leaper', 'burrow', 'flamer', 'sniper', 'orbiter']);

/** Elity bez własnych pocisków walczą wręcz: ich zdolnością jest szarża. */
const isMeleeElite = (e: Enemy) => !e.def.shoot && e.def.behavior !== 'keep' && e.def.behavior !== 'summoner' && e.def.behavior !== 'weaver' && !OWN_MOVES.has(e.def.behavior);

/**
 * Wrogowie biomów (0.30, data/enemies.ts): każdy z zapowiedzią ataku (rysuje ją game/render.ts drawTells).
 * Stan w polach wroga: actT (odliczanie do ataku), dashT (zapowiedź + wykonanie), tx/ty (cel), shootA (kąt), z, hidden, phase.
 */
function updateBiomeEnemy(run: Run, e: Enemy, dt: number, dist: number, nx: number, ny: number, sp: number): void {
  const B = BAL.biomeEnemies, p = run.player, dmg = e.damage * BAL.bulletDmg;
  /** Trzyma dystans `k` i krąży (strafe) — strzelcy i Odbicie. */
  const keep = (k: number, strafe: number) => {
    const dir = dist > k + 10 ? 1 : dist < k - 10 ? -0.7 : 0, side = e.uid % 2 ? 1 : -1;
    e.x += (nx * dir - ny * strafe * side) * sp; e.y += (ny * dir + nx * strafe * side) * sp;
  };
  switch (e.def.behavior) {
    case 'charger': {
      // Dzik: podchodzi, staje i grzebie (linia szarży), potem pędzi po prostej.
      if (e.dashT > 0) {
        e.dashT -= dt;
        if (e.dashT < B.chargeTime) { e.x += e.dvx * dt; e.y += e.dvy * dt; } else if (run.blink(6, 3)) e.flash = 2;
        break;
      }
      e.x += nx * sp; e.y += ny * sp;
      e.actT -= dt;
      if (e.actT <= 0 && dist < 150) {
        e.actT = B.chargeEvery * rng.range(0.85, 1.2);
        e.dashT = B.chargeWarn + B.chargeTime;
        e.dvx = nx * B.chargeSpeed; e.dvy = ny * B.chargeSpeed;
      }
      break;
    }
    case 'mortar': {
      // Cierniak: powoli trzyma dystans i ciska nasiona w kręgi pod graczem (pierwszy z wyprzedzeniem ruchu).
      keep(e.def.keepDist ?? 120, 0.2);
      e.actT -= dt;
      if (e.actT < 0.4 && dist < 210 && run.blink(6, 3)) e.flash = 2;
      if (e.actT > 0 || dist > 210) break;
      e.actT = B.mortarEvery * rng.range(0.85, 1.2);
      for (let i = 0; i < B.mortarCount; i++) {
        const lead = i === 0 ? B.mortarDelay * 0.6 : 0, a = rng.range(0, TAU), d = i === 0 ? 0 : rng.range(B.mortarSpread * 0.4, B.mortarSpread);
        run.strikes.push({ x: p.x + p.vx * lead + Math.cos(a) * d, y: p.y + p.vy * lead + Math.sin(a) * d, t: B.mortarDelay + i * 0.15, foe: dmg * B.mortarDmg, seed: true, r: B.mortarR });
      }
      run.burst(e.x, e.y - 6, C.lime, 4, 40);
      break;
    }
    case 'leaper': {
      // Ropucha: skok łukiem do celu (cień w miejscu lądowania), przy lądowaniu pierścień kwasu.
      if (e.dashT > 0) {
        e.dashT -= dt;
        const k = Math.min(1, 1 - e.dashT / B.leapTime);
        e.x = e.dvx + (e.tx - e.dvx) * k; e.y = e.dvy + (e.ty - e.dvy) * k;
        e.z = Math.sin(k * Math.PI) * B.leapHeight;
        if (e.dashT <= 0) {
          e.z = 0;
          fireVolley(run, e.x, e.y, { shape: 'ring', count: B.leapRing, speed: 55, sprite: 'eb_cyan' }, rng.range(0, TAU), dmg);
          run.burst(e.x, e.y + 3, C.dgreen, 8, 40);
          run.addShake(0.8);
        }
        break;
      }
      e.actT -= dt;
      if (e.actT < 0.35 && run.blink(6, 3)) e.flash = 2;
      if (e.actT > 0) break;
      e.actT = B.leapEvery * rng.range(0.8, 1.2);
      const d = Math.min(dist, B.leapRange) + rng.range(-8, 8);
      e.dvx = e.x; e.dvy = e.y;
      e.tx = e.x + nx * d; e.ty = e.y + ny * d;
      e.dashT = B.leapTime;
      break;
    }
    case 'burrow': {
      // Topielec: na powierzchni goni; pod ziemią (nietrafialny) płynie do gracza, staje, bulgocze i wynurza się z ugryzieniem.
      e.actT -= dt;
      if (e.phase === 0) {
        e.x += nx * sp; e.y += ny * sp;
        if (e.actT <= 0) { e.phase = 1; e.hidden = true; e.actT = B.burrowUnder; run.burst(e.x, e.y, C.teal, 8, 40); }
      } else if (e.phase === 1) {
        e.x += nx * sp * 1.6; e.y += ny * sp * 1.6;
        if (e.actT <= 0 || dist < 10) { e.phase = 2; e.actT = B.burrowWarn; e.tx = p.x; e.ty = p.y; }
      } else {
        e.x = e.tx; e.y = e.ty;
        if (e.actT <= 0) {
          e.phase = 0; e.hidden = false; e.actT = B.burrowUp;
          if ((p.x - e.x) ** 2 + (p.y - e.y) ** 2 < (B.burrowR + p.r) ** 2) run.hurtPlayer(e.damage * 1.3);
          run.burst(e.x, e.y, C.teal, 14, 70);
          run.burst(e.x, e.y, C.cyan, 6, 90);
          sfx.play('hit');
        }
      }
      break;
    }
    case 'flamer': {
      // Salamandra: podchodzi; stożek zapowiedzi (zablokowany kąt), potem krótki płomień (zwalniające pociski ognia).
      if (e.dashT > 0) {
        e.dashT -= dt;
        if (run.blink(6, 3)) e.flash = 2;
        if (e.dashT <= 0) {
          const n = B.flameCount;
          fireVolley(run, e.x, e.y, { shape: 'fan', count: n, speed: 105, spread: (B.flameCone * 2) / (n - 1), acc: -110, minV: 18, life: 0.75, sprite: 'eb_orange' }, e.shootA, dmg);
          run.burst(e.x + Math.cos(e.shootA) * 8, e.y + Math.sin(e.shootA) * 8, C.orange, 8, 70);
        }
        break;
      }
      keep(e.def.keepDist ?? 45, 0.3);
      e.actT -= dt;
      if (e.actT <= 0 && dist < B.flameRange) {
        e.actT = B.flameEvery * rng.range(0.85, 1.2);
        e.dashT = B.flameWarn;
        e.shootA = Math.atan2(p.y - e.y, p.x - e.x);
      }
      break;
    }
    case 'sniper': {
      // Skorpion: daleko; linia celownika (śledzi gracza przez 60% czasu, potem stoi), potem szybki kolec.
      if (e.dashT > 0) {
        e.dashT -= dt;
        if (e.dashT > B.snipeAim * 0.4) e.shootA = Math.atan2(p.y - e.y, p.x - e.x);
        if (e.dashT <= 0) fireVolley(run, e.x, e.y, { shape: 'fan', count: 1, speed: B.snipeSpeed, sprite: 'eb_big' }, e.shootA, dmg * 1.5);
        break;
      }
      keep(e.def.keepDist ?? 150, 0.5);
      e.actT -= dt;
      if (e.actT <= 0 && dist < 260) { e.actT = B.snipeEvery * rng.range(0.85, 1.2); e.dashT = B.snipeAim; }
      break;
    }
    case 'splitter':
      e.x += nx * sp; e.y += ny * sp;
      break;
    case 'orbiter': {
      // Odbicie: krąży wokół gracza; linia przez gracza (zapowiedź), potem cięcie szarżą wzdłuż niej.
      if (e.dashT > 0) {
        e.dashT -= dt;
        if (e.dashT < B.orbitTime) { e.x += e.dvx * dt; e.y += e.dvy * dt; } else if (run.blink(6, 3)) e.flash = 2;
        break;
      }
      keep(e.def.keepDist ?? 75, 1);
      e.actT -= dt;
      if (e.actT <= 0 && dist < 130) {
        e.actT = B.orbitEvery * rng.range(0.85, 1.2);
        e.tx = p.x + nx * 60; e.ty = p.y + ny * 60;
        const L = Math.hypot(e.tx - e.x, e.ty - e.y) || 1;
        e.dvx = ((e.tx - e.x) / L) * B.orbitSpeed; e.dvy = ((e.ty - e.y) / L) * B.orbitSpeed;
        e.dashT = B.orbitWarn + B.orbitTime;
      }
      break;
    }
  }
}

/** Szarża elity: zapowiedź (miga), pęd w zapamiętanym kierunku, przy lądowaniu pierścień pocisków. */
function updateEliteCharge(run: Run, e: Enemy, dt: number): void {
  const A = BAL.eliteAbility, prev = e.dashT;
  e.dashT -= dt;
  if (e.dashT < 0.4) { e.x += e.dvx * dt; e.y += e.dvy * dt; } else if (run.blink(4, 2)) e.flash = 2;
  if (prev > 0 && e.dashT <= 0) fireVolley(run, e.x, e.y, { shape: 'ring', count: A.ring, speed: 65, sprite: 'eb_orange' }, rng.range(0, TAU), e.damage * BAL.bulletDmg);
}

/**
 * Zdolność elity co kilka sekund (z zapowiedzią): elity wręcz szarżują, strzelające na zmianę puszczają dwie serie wachlarza
 * celowane z wyprzedzeniem i pierścień z luką. Dzięki temu elita jest groźna sama, nie tylko w tłumie.
 */
function eliteAbility(run: Run, e: Enemy, dt: number, nx: number, ny: number, dist: number): void {
  const A = BAL.eliteAbility;
  e.abilT -= dt;
  if (e.abilT > 0 && e.abilT < A.windup && dist < A.range && run.blink(6, 3)) e.flash = 2;
  if (e.abilT > 0 || dist > A.range) return;
  e.abilT = rng.range(A.cdMin, A.cdMax);
  const dmg = e.damage * BAL.bulletDmg;
  if (isMeleeElite(e)) {
    e.dashT = 0.9;
    e.dvx = nx * A.chargeSpeed;
    e.dvy = ny * A.chargeSpeed;
    return;
  }
  e.phase = 1 - e.phase;
  if (e.phase) sequence(run, e, 2, 0.25, () => fireVolley(run, e.x, e.y, { shape: 'fan', count: A.fan, speed: 90, spread: 0.18, sprite: 'eb_red' }, leadAim(run, e, 90), dmg));
  else fireVolley(run, e.x, e.y, { shape: 'gapRing', count: A.gapRing, gap: 3, speed: 60, sprite: 'eb_orange' }, aimAt(run, e), dmg);
}

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

    // Bossowie i minibossowie są odporni na ogłuszenie i zamrożenie.
    if (e.boss || e.def.behavior === 'warden') e.stunT = 0;
    if (e.boss) {
      updateBoss(run, e, dt, dx, dy, dist);
    } else if (e.stunT > 0) {
      e.stunT -= dt;
    } else if (e.elite && e.dashT > 0 && e.def.behavior !== 'warden' && !OWN_MOVES.has(e.def.behavior)) {
      updateEliteCharge(run, e, dt);
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
            if (run.blink(4, 2)) e.flash = 2;
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
          if (e.actT < 0.5 && run.blink(4, 2)) e.flash = 2;
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
          if (e.actT < 0.5 && dist < 220 && run.blink(6, 3)) e.flash = 2;
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
        case 'charger': case 'mortar': case 'leaper': case 'burrow': case 'flamer': case 'sniper': case 'splitter': case 'orbiter':
          updateBiomeEnemy(run, e, dt, dist, nx, ny, sp);
          break;
        case 'warden':
          updateWarden(run, e, dt, dx, dy, dist, nx, ny, e.speed * (1 - e.slowF));
          break;
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
        if (sh?.windup && e.shootT < sh.windup && dist < sh.range && run.blink(6, 3)) e.flash = 2;
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
      if (e.elite && e.def.behavior !== 'warden' && e.def.behavior !== 'flee') eliteAbility(run, e, dt, nx, ny, dist);
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
    if (e.touchCd <= 0 && e.damage > 0 && !e.hidden && e.z < 4 && dist < e.radius + p.r && run.hurtPlayer(e.damage)) e.touchCd = BAL.contactCooldown;
  }
}
