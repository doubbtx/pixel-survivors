import { Rng } from '../core/rng';
import { sfx } from '../core/audio';
import { C } from '../core/palette';
import { SpatialHash } from '../core/spatial';
import { BAL } from '../data/balance';
import type { Run } from '../game/run';

/**
 * Teren, który ma znaczenie (liczby w BAL.terrain). Świat jest nieskończony, więc teren powstaje w kawałkach (chunk)
 * wokół gracza — deterministycznie z numeru kawałka i ziarna poziomu, skład wg biomu:
 *  cover   niszczalna osłona: blokuje pociski wrogów i gracza (każdy pocisk -1 HP), postacie ją obchodzą
 *  barrel  beczka: trafiona albo w zasięgu wybuchu eksploduje (rani wrogów, łańcuchy beczek) — zwabiaj wrogów
 *  spikes  kolce: wysuwają się co chwilę i ranią wszystkich na nich, także gracza
 *  swamp   bagno: spowalnia gracza i wrogów
 *  ice     lód: gracz ślizga się (bezwładność ruchu)
 * Przy bossie arena zwęża się do BAL.terrain.arenaMin (gracz i wrogowie nie wyjdą poza ścianę).
 */
export type TerrainKind = 'cover' | 'barrel' | 'spikes' | 'swamp' | 'ice';

export interface TerrainObj {
  kind: TerrainKind;
  x: number;
  y: number;
  r: number;
  hp: number;
  /** Kolce: faza cyklu; beczka: zapalnik (> 0 = wybuchnie). */
  t: number;
  /** Wariant grafiki. */
  v: number;
  chunk: string;
}

/** Zwężająca się arena bossa. */
export interface Arena {
  x: number;
  y: number;
  r: number;
}

const KINDS: TerrainKind[] = ['cover', 'barrel', 'spikes', 'swamp', 'ice'];
const BLOCKS = new Set<TerrainKind>(['cover', 'barrel']);
const hash = new SpatialHash<TerrainObj>(32, 7, 256);
const q: TerrainObj[] = [];

/** Rozmiar obiektu wg rodzaju (bagno i lód losowo większe). */
function radiusOf(kind: TerrainKind, r: Rng): number {
  const T = BAL.terrain;
  return kind === 'cover' ? T.coverR : kind === 'barrel' ? T.barrelR : kind === 'spikes' ? T.spikesR : r.range(T.poolR[0], T.poolR[1]);
}

/** Kawałek terenu: obiekty wg biomu, nie przy starcie poziomu ani tuż przy graczu, osłony nie nachodzą na siebie. */
function genChunk(run: Run, cx: number, cy: number, key: string): void {
  const T = BAL.terrain, S = T.chunk, p = run.player;
  const r = new Rng(((cx * 73856093) ^ (cy * 19349663) ^ (run.terrainSeed * 83492791)) >>> 0);
  const mix = T.biomes[run.levelInfo.biome % T.biomes.length];
  KINDS.forEach((kind, k) => {
    for (let n = 0; n < mix[k]; n++) {
      for (let tries = 0; tries < 6; tries++) {
        const x = (cx + r.next()) * S, y = (cy + r.next()) * S, rad = radiusOf(kind, r);
        if (x * x + y * y < T.clearStart ** 2 || (x - p.x) ** 2 + (y - p.y) ** 2 < T.clearPlayer ** 2) continue;
        if (run.terrain.some((o) => (o.x - x) ** 2 + (o.y - y) ** 2 < (o.r + rad + 6) ** 2)) continue;
        run.terrain.push({ kind, x, y, r: rad, hp: kind === 'cover' ? T.coverHp : 1, t: kind === 'spikes' ? r.range(0, T.spikeCycle) : 0, v: r.int(0, 2), chunk: key });
        break;
      }
    }
  });
}

/** Kawałki w promieniu 1 od gracza są wygenerowane; dalsze (2+) znikają i powstaną od nowa po powrocie. */
function streamChunks(run: Run): void {
  const S = BAL.terrain.chunk, p = run.player;
  const pcx = Math.floor(p.x / S), pcy = Math.floor(p.y / S);
  let removed = false;
  for (const key of run.terrainChunks) {
    const [cx, cy] = key.split(',').map(Number);
    if (Math.abs(cx - pcx) <= 2 && Math.abs(cy - pcy) <= 2) continue;
    run.terrainChunks.delete(key);
    removed = true;
  }
  if (removed) run.terrain = run.terrain.filter((o) => run.terrainChunks.has(o.chunk));
  for (let cy = pcy - 1; cy <= pcy + 1; cy++) {
    for (let cx = pcx - 1; cx <= pcx + 1; cx++) {
      const key = `${cx},${cy}`;
      if (run.terrainChunks.has(key)) continue;
      run.terrainChunks.add(key);
      genChunk(run, cx, cy, key);
    }
  }
}

/** Wypycha okrąg (x, y, r) poza osłonę. */
function pushOut(o: { x: number; y: number }, r: number, t: TerrainObj): void {
  const dx = o.x - t.x, dy = o.y - t.y, min = r + t.r, d2 = dx * dx + dy * dy;
  if (d2 >= min * min) return;
  const d = Math.sqrt(d2) || 0.01;
  o.x = t.x + (dx / d) * min;
  o.y = t.y + (dy / d) * min;
}

/** Obiekt terenu blokujący pociski w punkcie (osłona albo beczka) albo null. */
export function terrainBlocker(run: Run, x: number, y: number, r: number): TerrainObj | null {
  if (!run.terrain.length) return null;
  const cand = hash.query(x, y, r + 16, q);
  for (const t of cand) if (t.hp > 0 && BLOCKS.has(t.kind) && (t.x - x) ** 2 + (t.y - y) ** 2 < (t.r + r) ** 2) return t;
  return null;
}

/** Trafienie obiektu terenu pociskiem: osłona traci HP, beczka dostaje zapalnik. */
export function hitTerrain(run: Run, t: TerrainObj, dmg = 1): void {
  if (t.kind === 'barrel') { if (t.t <= 0) t.t = 0.05; return; }
  t.hp -= dmg;
  run.burst(t.x, t.y, C.lgray, 2, 30);
  if (t.hp <= 0) { run.burst(t.x, t.y, C.dgray, 14, 60); sfx.play('hit'); }
}

/** Wybuch w zasięgu: beczki odpalają się łańcuchowo, osłony pękają. */
export function terrainBlast(run: Run, x: number, y: number, r: number): void {
  for (const t of run.terrain) {
    if (t.hp <= 0 || !BLOCKS.has(t.kind) || (t.x - x) ** 2 + (t.y - y) ** 2 > (r + t.r) ** 2) continue;
    hitTerrain(run, t, BAL.terrain.blastDmg);
  }
}

/** Arena bossa: start przy pojawieniu się bossa, zwężanie, ściana dla gracza i bossa; znika po walce. */
function updateArena(run: Run, dt: number): void {
  const T = BAL.terrain, p = run.player;
  if (!run.boss) { run.arena = null; return; }
  const a = (run.arena ??= { x: (p.x + run.boss.x) / 2, y: (p.y + run.boss.y) / 2, r: T.arenaR });
  if (a.r === T.arenaR) run.showBanner('Arena się zamyka!');
  a.r = Math.max(T.arenaMin, a.r - ((T.arenaR - T.arenaMin) / T.arenaTime) * dt);
  const clamp = (o: { x: number; y: number }, r: number) => {
    const dx = o.x - a.x, dy = o.y - a.y, d = Math.hypot(dx, dy), lim = a.r - r;
    if (d > lim) { o.x = a.x + (dx / d) * lim; o.y = a.y + (dy / d) * lim; }
  };
  clamp(p, p.r);
  for (const e of run.enemies.items) if (!e.dead) clamp(e, e.radius);
}

/**
 * Teren w kroku: kawałki wokół gracza, wybuchy beczek, kolce, kolizje z osłonami, bagno i lód (stan gracza na ziemi)
 * oraz arena bossa. W lochu teren nie działa (loch ma własną arenę).
 */
export function updateTerrain(run: Run, dt: number): void {
  run.ground = 'none';
  if (run.dungeon) return;
  const T = BAL.terrain, p = run.player;
  streamChunks(run);
  updateArena(run, dt);
  hash.clear();
  for (const t of run.terrain) if (t.hp > 0) hash.insert(t);
  for (const t of run.terrain) {
    if (t.hp <= 0) continue;
    const near = (t.x - p.x) ** 2 + (t.y - p.y) ** 2 < (t.r + p.r) ** 2;
    switch (t.kind) {
      case 'cover':
        pushOut(p, p.r, t);
        run.enemiesInCircle(t.x, t.y, t.r, (e) => { if (!e.boss) pushOut(e, e.radius, t); });
        break;
      case 'barrel':
        pushOut(p, p.r, t);
        if (t.t > 0 && (t.t -= dt) <= 0) {
          t.hp = 0;
          const R = T.barrelBlast * run.stats.area;
          run.explode(t.x, t.y, R, run.cardDamage(T.barrelDmg), 'Beczka', C.orange, 6);
        }
        break;
      case 'spikes': {
        // Kolce wysunięte przez spikeUp s każdego cyklu: ranią wrogów (co tick) i gracza.
        t.t = (t.t + dt) % T.spikeCycle;
        if (t.t > T.spikeUp || run.step % 15) break;
        run.enemiesInCircle(t.x, t.y, t.r, (e) => run.damageEnemy(e, run.cardDamage(T.spikeDmg), 'Kolce'));
        if (near) run.hurtPlayer(run.stats.maxHp * T.spikeHurt);
        break;
      }
      case 'swamp':
      case 'ice':
        if (near) run.ground = t.kind;
        if (t.kind === 'swamp') run.enemiesInCircle(t.x, t.y, t.r, (e) => { e.slowF = Math.max(e.slowF, T.swampSlow); e.slowT = Math.max(e.slowT, 0.1); });
        break;
    }
  }
  if (run.terrain.some((t) => t.hp <= 0)) run.terrain = run.terrain.filter((t) => t.hp > 0 || !BLOCKS.has(t.kind));
}
