import { rng } from '../core/rng';
import { sfx } from '../core/audio';
import { BAL } from '../data/balance';
import { ELITE_MODS } from '../data/enemies';
import { ROLE_FOES, SCRIPT_BY_ID, type Beat } from '../data/scripts';
import type { Run } from '../game/run';
import { spawnEnemy } from './spawner';
import { startBeat, type Spot } from './situations';

/**
 * Scenariusz mapy (0.56, data/scripts.ts): kolejne uderzenia przy ułamku postępu celu, z bezpiecznikami rytmu
 * (pierwsze najwcześniej po `first` s, odstęp ≥ `gap` s, żadnego po `last` postępu). Rój, szarża i linia strzelców
 * idą przez sytuacje (`beat_*`: zapowiedź, „Rozbite!”, sitLog), twardziel to elita ze stałymi cechami mapy, ostrzał
 * terenu to kręgi `run.strikes` w miejscu gracza, oddech wstrzymuje zwykłe fale (w Udręce noBreath zamiast niego ostrzał).
 */
export function updateScript(run: Run, dt: number): void {
  run.breathT = Math.max(0, run.breathT - dt);
  run.beatT = Math.max(0, run.beatT - dt);
  const sc = run.levelInfo.script ? SCRIPT_BY_ID[run.levelInfo.script] : null;
  if (!sc || run.bossSpawned || run.dungeon) return;
  const S = BAL.scripts, beat = sc.beats[run.beatIdx];
  // Poprzednia formacja jeszcze żyje (rozbita/utracona/wygasła najpóźniej po expire): dwie naraz to chaos.
  if (!beat || run.situation || run.sitActive) return;
  const p = run.objectiveProgress(), t = run.time;
  if (p >= S.last) { run.beatIdx = sc.beats.length; return; }
  if (p < beat.at || t < S.first || t - run.lastBeatT < S.gap) return;
  run.beatIdx++;
  run.lastBeatT = t;
  fireBeat(run, beat);
}

/** Nowa mapa albo wczytany zapis: uderzenia sprzed bieżącego postępu przepadają (bez serii naraz po wczytaniu). */
export function resetScript(run: Run): void {
  const sc = run.levelInfo.script ? SCRIPT_BY_ID[run.levelInfo.script] : null;
  const p = run.objectiveProgress();
  run.beatIdx = sc ? sc.beats.findIndex((b) => b.at > p) : 0;
  if (run.beatIdx < 0) run.beatIdx = sc?.beats.length ?? 0;
  run.lastBeatT = -99;
  run.breathT = run.beatT = 0;
}

const at = (a: number, d: number): [number, number] => [Math.cos(a) * d, Math.sin(a) * d];

function fireBeat(run: Run, beat: Beat): void {
  const S = BAL.scripts, biome = run.levelInfo.biome;
  // Liczebność: ±20% losowo, +10% na poziom trudności mapy (bez dodatkowego HP).
  const size = (beat.size ?? 1) * S.size * rng.range(0.8, 1.2) * (1 + S.tierSize * (run.expedition?.tier ?? 0));
  const foes = (role: 'swarm' | 'rush' | 'shoot' | 'tank') => ROLE_FOES[role][biome] ?? ROLE_FOES[role][0];
  const a0 = rng.range(0, Math.PI * 2);
  const spots: Spot[] = [];
  // Udręka „Bez wytchnienia” (noBreath): oddech staje się ostrzałem terenu.
  const role = beat.role === 'breath' && run.flag('noBreath') > 0 ? 'bombard' : beat.role;
  switch (role) {
    case 'breath':
      run.breathT = S.breath;
      run.showBanner('A moment of calm');
      return;
    case 'bombard': {
      // Ostrzał terenu: trzy salwy kręgów wokół gracza (z ostrzeżeniem); aktywny gracz wychodzi, stojący obrywa.
      const dmg = 9 * BAL.enemyDmgMul(run.time) * BAL.depthDmgMul(run.depth) * (1 + run.flag('enemyDmg'));
      for (let v = 0; v < 3; v++) {
        run.schedule(v * 1.6, () => {
          const p = run.player;
          for (let i = 0; i < 7; i++) {
            const [dx, dy] = i ? at(rng.range(0, Math.PI * 2), rng.range(18, 70)) : [0, 0];
            run.strikes.push({ x: p.x + dx, y: p.y + dy, t: 0.9 + i * 0.08, foe: dmg });
          }
        });
      }
      run.beatT = S.beatDur;
      run.showBanner('Bombardment! Keep moving');
      sfx.play('boss');
      return;
    }
    case 'tank': {
      // Twardziel: elita ze stałymi cechami mapy (widoczne w węźle) albo jedną cechą bez zachowania (akt 1).
      const plain = Object.keys(ELITE_MODS).filter((k) => !ELITE_MODS[k].kind);
      const mods = run.levelInfo.eliteMods ? [...run.levelInfo.eliteMods] : [rng.pick(plain)];
      const [dx, dy] = at(a0, 150), p = run.player;
      const e = spawnEnemy(run, rng.pick(foes('tank')), p.x + dx, p.y + dy, { elite: mods, noChase: true });
      if (e) run.showBanner(`Tough foe: ${mods.map((k) => ELITE_MODS[k].name).join(', ')}`);
      run.beatT = S.beatDur;
      sfx.play('boss');
      return;
    }
    case 'swarm': {
      const m = Math.round(22 * size), id = rng.pick(foes('swarm'));
      for (let i = 0; i < m; i++) { const [dx, dy] = at(a0 + (i / m) * Math.PI * 2, 175); spots.push({ id, dx, dy }); }
      break;
    }
    case 'rush': {
      // Szarża z `sides` stron (kąty losowe, odstęp co najmniej 60°).
      // Rampa aktu 1 (LevelDef.dmgCap): bez całych grup kamikaze (wybuch ×2.5 obrażeń), co szósty zamiast co trzeciego.
      const ramp = run.levelInfo.dmgCap !== undefined, every = ramp ? 6 : 3;
      const pool = foes('rush').filter((f) => !ramp || f !== 'kamikaze');
      const k = beat.sides ?? 2, per = Math.round(6 * size), id = rng.pick(pool.length ? pool : foes('rush'));
      for (let s = 0; s < k; s++) {
        const a = a0 + (s / k) * Math.PI * 2 + rng.range(-0.3, 0.3);
        for (let i = 0; i < per; i++) { const [dx, dy] = at(a + rng.range(-0.15, 0.15), 185 + i * 8); spots.push({ id: i % every === every - 1 ? 'kamikaze' : id, dx, dy }); }
      }
      break;
    }
    case 'shoot': {
      // Linia strzelców z jednej strony, prostopadle do kierunku na gracza: trzeba podejść albo obejść.
      // Rampa aktu 1 (flaga shooters): krótsza linia.
      const m = Math.max(3, Math.round(6 * size * (1 + Math.min(0, run.flag('shooters'))))), id = rng.pick(foes('shoot'));
      const [cx, cy] = at(a0, 150), px = -Math.sin(a0), py = Math.cos(a0);
      for (let i = 0; i < m; i++) { const o = (i - (m - 1) / 2) * 16; spots.push({ id, dx: cx + px * o, dy: cy + py * o, mark: true }); }
      break;
    }
  }
  run.beatT = S.beatDur;
  startBeat(run, `beat_${beat.role}`, a0, spots);
}
