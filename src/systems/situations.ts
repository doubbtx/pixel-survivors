import { rng } from '../core/rng';
import { sfx } from '../core/audio';
import { C } from '../core/palette';
import { BAL } from '../data/balance';
import { EVENTS } from '../data/waves';
import type { Enemy } from '../entities/types';
import type { Run } from '../game/run';
import { spawnEnemy } from './spawner';

/**
 * Sytuacje (0.39, zadanie F): co kilkadziesiąt sekund czasu poziomu zestaw istniejących zachowań wrogów w formacji, która
 * wymusza konkretną odpowiedź (oskrzydlenie, unik w bok, wyrwanie się z krzyżowego ognia, priorytetowy cel...), zamiast
 * samego HP. Zapowiedź `BAL.situations.warn` s: baner, strzałka przy krawędzi (kierunkowe) albo pulsujący krąg wokół gracza
 * (pierścienie), znaczniki w miejscach pojawienia się wrogów w polu widzenia. Wrogowie sytuacji mają `e.sit`; gdy wszyscy
 * zginą — „Rozbite!” i złoto (Rytuał: skrzynia elity za obu przywoływaczy w `ritualWindow` s).
 * Ogólne sytuacje ze wspólnych wrogów, biomowe (pole `biomes`) z wrogów danego biomu. Odblokowanie wg czasu fal (`from`),
 * moment wg czasu poziomu (pierwsza po `first` s, potem co `every` s), bez bossa, lochu, Zasadzki, burzy i pierścieni EVENTS.
 */
export interface Spot {
  id: string;
  dx: number;
  dy: number;
  /** Znacznik w miejscu pojawienia się (wrogowie w polu widzenia). */
  mark?: boolean;
  /** Topielec pojawia się zakopany (nietrafialny, z ostrzeżeniem przed wynurzeniem). */
  buried?: boolean;
  /** Cel priorytetowy (Rytuał: przywoływacz). */
  key?: boolean;
}

interface SitDef {
  id: string;
  name: string;
  /** Czas fal, od którego sytuacja może się pojawić. */
  from: number;
  biomes?: number[];
  /** Pierścień wokół gracza (bez jednego kierunku): ostrzeżenie krąg, nie strzałka. */
  ring?: boolean;
  plan: (s: number, a: number) => Spot[];
}

const at = (a: number, d: number): [number, number] => [Math.cos(a) * d, Math.sin(a) * d];
const n = (base: number, grow: number, s: number) => Math.round(base + grow * s);

const SITUATIONS: SitDef[] = [
  {
    // Mur tarcz: szereg tarczowników w poprzek kierunku, strzelcy za nimi — oskrzydlić albo przebić.
    id: 'shieldwall', name: 'Shield wall', from: 0,
    plan: (s, a) => {
      const out: Spot[] = [], k = n(6, 4, s), px = -Math.sin(a), py = Math.cos(a), [cx, cy] = at(a, 170);
      for (let i = 0; i < k; i++) { const o = (i - (k - 1) / 2) * 14; out.push({ id: 'shieldbearer', dx: cx + px * o, dy: cy + py * o }); }
      const [bx, by] = at(a, 200), m = n(4, 2, s);
      for (let i = 0; i < m; i++) { const o = (i - (m - 1) / 2) * 20; out.push({ id: i % 2 ? 'eye' : 'cultist', dx: bx + px * o, dy: by + py * o }); }
      return out;
    },
  },
  {
    // Krzyżowy ogień: strażnicy i wirowniki na czterech przekątnych blisko gracza — wyrwać się, zabić jeden róg.
    id: 'crossfire', name: 'Crossfire', from: 150, ring: true,
    plan: (s, a) => {
      const out: Spot[] = [];
      for (let i = 0; i < 4; i++) { const [dx, dy] = at(a + Math.PI / 4 + (i * Math.PI) / 2, 120); out.push({ id: i % 2 ? 'spinner' : 'sentinel', dx, dy, mark: true }); }
      for (let i = 0, m = n(8, 6, s); i < m; i++) { const [dx, dy] = at((i / m) * Math.PI * 2, 180); out.push({ id: 'bat', dx, dy }); }
      return out;
    },
  },
  {
    // Rój samobójców: zamykający się pierścień kamikaze i kilka migaczy — ruch bez przerwy.
    id: 'kamikaze', name: 'Kamikaze swarm', from: 120, ring: true,
    plan: (s) => {
      const out: Spot[] = [];
      for (let i = 0, m = n(16, 8, s); i < m; i++) { const [dx, dy] = at((i / m) * Math.PI * 2, 170); out.push({ id: 'kamikaze', dx, dy }); }
      for (let i = 0; i < 3; i++) { const [dx, dy] = at(rng.range(0, Math.PI * 2), 150); out.push({ id: 'blinker', dx, dy }); }
      return out;
    },
  },
  {
    // Rytuał: dwóch przywoływaczy, każdy w kręgu tarczowników — cel priorytetowy (skrzynia za szybkie zabicie obu).
    id: 'ritual', name: 'Ritual', from: 180,
    plan: (_s, a) => {
      const out: Spot[] = [];
      for (const side of [-0.55, 0.55]) {
        const [cx, cy] = at(a + side, 150);
        out.push({ id: 'summoner', dx: cx, dy: cy, mark: true, key: true });
        for (let i = 0; i < 5; i++) { const [dx, dy] = at((i / 5) * Math.PI * 2, 20); out.push({ id: 'shieldbearer', dx: cx + dx, dy: cy + dy }); }
      }
      return out;
    },
  },
  {
    // Stado (łąka): zwarta kolumna dzików z jednego kierunku i ciernisty moździerz z tyłu — unik w bok w dobrym momencie.
    id: 'stampede', name: 'Stampede', from: 90, biomes: [0],
    plan: (s, a) => {
      const out: Spot[] = [], k = n(8, 6, s);
      for (let i = 0; i < k; i++) { const [dx, dy] = at(a + rng.range(-0.12, 0.12), 190 + i * 10); out.push({ id: 'boar', dx, dy }); }
      for (let i = 0; i < 3; i++) { const [dx, dy] = at(a + (i - 1) * 0.35, 230); out.push({ id: 'thornling', dx, dy }); }
      return out;
    },
  },
  {
    // Spod ziemi (bagno, Pustka): zakopani topielcy wokół gracza i skoczkowie dalej — zmiana pozycji.
    id: 'below', name: 'From below', from: 120, biomes: [1, 4], ring: true,
    plan: (s) => {
      const out: Spot[] = [];
      for (let i = 0, m = n(6, 2, s); i < m; i++) { const [dx, dy] = at((i / m) * Math.PI * 2 + rng.range(-0.3, 0.3), rng.range(60, 90)); out.push({ id: 'lurker', dx, dy, mark: true, buried: true }); }
      for (let i = 0; i < 4; i++) { const [dx, dy] = at((i / 4) * Math.PI * 2 + 0.4, 140); out.push({ id: 'toad', dx, dy }); }
      return out;
    },
  },
  {
    // Pustynna zasadzka: skorpiony-snajperzy z daleka i salamandry z bliska — uniki na dwóch dystansach.
    id: 'desert', name: 'Desert ambush', from: 120, biomes: [2],
    plan: (s, a) => {
      const out: Spot[] = [];
      for (let i = 0; i < 3; i++) { const [dx, dy] = at(a + (i - 1) * 0.6, 200); out.push({ id: 'scorpion', dx, dy }); }
      for (let i = 0, m = n(5, 3, s); i < m; i++) { const [dx, dy] = at(a + (i / m - 0.5) * 2.4, 115); out.push({ id: 'salamander', dx, dy, mark: true }); }
      return out;
    },
  },
  {
    // Lustrzany taniec (otchłań): pierścień krążących luster i rozszczepiacze — przebić się przez krąg.
    id: 'mirrors', name: 'Mirror dance', from: 120, biomes: [3], ring: true,
    plan: (s) => {
      const out: Spot[] = [];
      for (let i = 0, m = n(8, 4, s); i < m; i++) { const [dx, dy] = at((i / m) * Math.PI * 2, 150); out.push({ id: 'mirror', dx, dy }); }
      for (let i = 0; i < 3; i++) { const [dx, dy] = at(rng.range(0, Math.PI * 2), 175); out.push({ id: 'splitter', dx, dy }); }
      return out;
    },
  },
];
const SIT_BY_ID: Record<string, SitDef> = Object.fromEntries(SITUATIONS.map((d) => [d.id, d]));

export const situationName = (id: string): string => SIT_BY_ID[id]?.name ?? id;
export const situationRing = (id: string): boolean => !!SIT_BY_ID[id]?.ring;

/** Wołane ze spawnera co krok (poza lochem i walką z bossem). */
export function updateSituations(run: Run, dt: number, waveT: number): void {
  const S = BAL.situations, w = run.situation;
  // Zapowiedź: odliczanie, potem formacja wokół bieżącej pozycji gracza.
  if (w) {
    w.t -= dt;
    if (w.t <= 0) { spawnSituation(run, w.id, w.spots); run.situation = null; }
    return;
  }
  const act = run.sitActive;
  if (act) {
    // Co sekundę: wrogowie sytuacji mogli zniknąć bez zabicia (koniec mapy, pojawienie się bossa, pełna pula) — „lost”.
    if (run.step % 60 === 0 && !run.enemies.items.some((e) => !e.dead && e.sit === act.uid)) { logSituation(run, 'lost'); run.sitActive = null; }
    // Nierozbita po `expire` s: „failed”, kolejna może przyjść.
    else if (run.totalTime - act.t0 > S.expire) { logSituation(run, 'failed'); run.sitActive = null; }
  }
  if (run.scripted || run.levelInfo.ambush || run.levelEvent?.id === 'storm' || (run.bossSpawned && run.mode !== 'endless')) return;
  run.situationT -= dt;
  if (run.situationT > 0 || run.sitActive) return;
  const t = run.time;
  // Pierścień EVENTS tuż obok: odłóż (dwie formacje naraz to chaos, nie decyzja).
  if (EVENTS.some((ev) => Math.abs(ev.at - t) < S.eventGap)) { run.situationT = S.eventGap; return; }
  const biome = run.levelInfo.biome;
  const pool = SITUATIONS.filter((d) => waveT >= d.from && (!d.biomes || d.biomes.includes(biome)) && d.id !== run.lastSituation);
  if (!pool.length) { run.situationT = 10; return; }
  // Biomowe trochę częściej (tożsamość biomu), ogólne zawsze w puli.
  const def = rng.weighted(pool.map((d) => [d, d.biomes ? 1.4 : 1] as [SitDef, number]));
  const late = waveT > S.lateAfter;
  run.situationT = rng.range(...(late ? S.everyLate : S.every));
  const scale = Math.min(1, waveT / 600);
  run.situation = { id: def.id, t: S.warn, a: rng.range(0, Math.PI * 2), spots: [] };
  run.situation.spots = def.plan(scale, run.situation.a);
  run.lastSituation = def.id;
  run.showBanner(`${def.name}!`);
  sfx.play('boss');
}

function spawnSituation(run: Run, id: string, spots: Spot[]): void {
  const p = run.player, uid = ++run.sitSeq;
  // Pełna pula: formacja ma pierwszeństwo — zwalniamy najdalszych zwykłych wrogów (poza ekranem, gracz tego nie widzi).
  const need = spots.length - (run.enemies.cap - run.enemies.count);
  if (need > 0) {
    // Bez nagród chodzących po mapie (jeleń, złoty szlam, mimik).
    const far = run.enemies.items.filter((e) => !e.dead && !e.boss && !e.elite && !e.sit && e.def.behavior !== 'flee' && e.def.id !== 'mimic')
      .sort((u, v) => (v.x - p.x) ** 2 + (v.y - p.y) ** 2 - ((u.x - p.x) ** 2 + (u.y - p.y) ** 2)).slice(0, need);
    for (const e of far) run.enemies.release(e);
  }
  let count = 0, keys = 0;
  for (const s of spots) {
    const e = spawnEnemy(run, s.id, p.x + s.dx, p.y + s.dy);
    if (!e) continue;
    e.sit = uid;
    count++;
    if (s.key) { keys++; e.flash = 4; }
    if (s.buried) { e.phase = 1; e.hidden = true; e.actT = BAL.biomeEnemies.burrowUnder * 0.6; }
  }
  if (!count) return;
  run.sitActive = { uid, id, left: count, keys, keysLeft: keys, t0: run.totalTime, taken0: run.takenSoFar() };
  run.addShake(3);
}

/** Wróg sytuacji zginął: licznik, Rytuał (przywoływacze), rozbicie formacji. */
export function situationKill(run: Run, e: Enemy): void {
  const act = run.sitActive;
  if (!act || e.sit !== act.uid) return;
  act.left--;
  const S = BAL.situations, p = run.player;
  // Rytuał: obaj przywoływacze (cel priorytetowy) w oknie czasu od pojawienia się — skrzynia elity od razu.
  if (e.def.behavior === 'summoner' && act.keys && --act.keysLeft === 0 && run.totalTime - act.t0 <= S.ritualWindow) {
    run.dropChest(e.x, e.y, 'elite');
    run.showBanner('Ritual broken! Chest');
  }
  if (act.left > 0) return;
  for (let i = 0; i < S.coins; i++) run.spawnPickup(p.x + rng.range(-20, 20), p.y + rng.range(-20, 20), 'coin', 1);
  run.showBanner('Broken!');
  run.burst(p.x, p.y, C.gold, 20, 70);
  sfx.play('chest');
  logSituation(run, 'broken');
  run.sitActive = null;
}

function logSituation(run: Run, result: 'broken' | 'failed' | 'lost'): void {
  const act = run.sitActive!;
  run.sitLog.push({ id: act.id, result, dur: Math.round(run.totalTime - act.t0), taken: Math.round(((run.takenSoFar() - act.taken0) / run.stats.maxHp) * 100) / 100 });
}
