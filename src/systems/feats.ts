import { C } from '../core/palette';
import { sfx } from '../core/audio';
import { BAL } from '../data/balance';
import { FEAT_BY_ID, type FeatId } from '../data/feats';
import type { Run } from '../game/run';
import { grantMat, grantScroll } from './forge';
import { rollUnique } from '../data/items';
import type { Enemy } from '../entities/types';

/** Nagrody wyczynów (data/feats.ts). */
const REWARD: Record<FeatId, (run: Run) => void> = {
  untouched: (run) => {
    run.pendingCards.push('boss');
    run.hitlessLevels++;
    run.addBonus('might', BAL.feats.streakMight);
  },
  nodash: (run) => { run.shards += BAL.feats.shards; grantMat(run, 'ore'); },
  nospell: (run) => { run.cardRerolls += BAL.feats.rerolls; run.gold += BAL.feats.gold * run.depth * run.stats.greed; },
  onlyone: (run) => run.pendingCards.push('elite'),
  speedboss: (run) => run.pendingLoot.push(run.rollLoot('boss')),
  edge: (run) => { grantMat(run, 'heart'); run.pendingLoot.push(run.rollLoot('elite')); },
  spartan: (run) => run.pendingLoot.push({ source: 'boss', item: rollUnique(run.depth) }),
  combo: (run) => run.pendingCards.push('boss'),
  elites: (run) => { grantScroll(run); run.pendingLoot.push(run.rollLoot('elite')); },
  massacre: (run) => { run.addXp(run.xpNext - run.xp); run.gold += BAL.feats.gold * run.depth * run.stats.greed; },
  flawless: () => {},
};

/** Przyznaje wyczyn; `row` przesuwa napis, gdy kilka wpada naraz. */
function award(run: Run, id: FeatId, row = 0): void {
  run.featsRun.push(id);
  run.featsNew.push(id);
  REWARD[id](run);
  run.popText(run.player.x, run.player.y - 22 - row * 9, `Wyczyn: ${FEAT_BY_ID[id].name}!`, C.gold);
  sfx.play('chest');
}

/** Nowy poziom (albo kolejny etap Szybkiego runu / Głów bossów): liczniki od zera. */
export function resetLevelFeats(run: Run): void {
  run.feat = { hits: 0, dashes: 0, casts: 0, start: run.time, massacre: false, combo: false, elites: 0 };
  run.killTimes = [];
}

/** Boss pokonany: wyczyny bossowe, a dla dość długiego poziomu z bossem także poziomowe. Zwraca zdobyte (do banera). */
export function featsOnBoss(run: Run, bossAge: number): FeatId[] {
  const F = BAL.feats, f = run.feat, got: FeatId[] = [];
  if (bossAge <= F.speedBoss) got.push('speedboss');
  if (run.player.hp <= run.stats.maxHp * F.edgeHp) got.push('edge');
  if (run.level <= F.spartanLevel) got.push('spartan');
  if (run.time - f.start >= F.minTime) {
    if (f.hits === 0) got.push('untouched');
    if (f.dashes === 0) got.push('nodash');
    if (f.casts === 0) got.push('nospell');
    if (run.weapons.length === 1) got.push('onlyone');
  }
  // Baner zajmie „Boss pokonany!”; wyczyny widać w napisach nad postacią i na ekranie ukończenia poziomu.
  got.forEach((id, i) => award(run, id, i));
  resetLevelFeats(run);
  return got;
}

/** Zabójstwo: Łowca elit, Mistrz kombo i Rzeź (BAL.feats.massacreKills w oknie massacreWindow s); każdy raz na poziom. */
export function featsOnKill(run: Run, e: Enemy): void {
  const F = BAL.feats, f = run.feat;
  if (e.elite && ++f.elites === F.elites) { award(run, 'elites'); run.showBanner('Wyczyn: Łowca elit!'); }
  if (!f.combo && run.combo >= F.combo) { f.combo = true; award(run, 'combo'); run.showBanner('Wyczyn: Mistrz kombo!'); }
  if (f.massacre) return;
  const t = run.time, k = run.killTimes;
  k.push(t);
  while (k.length && k[0] < t - F.massacreWindow) k.shift();
  if (k.length < F.massacreKills) return;
  run.feat.massacre = true;
  run.killTimes = [];
  award(run, 'massacre');
  run.showBanner('Wyczyn: Rzeź!');
}

/** Wygrany run bez trafienia (ui/game-screen.ts przy zwycięstwie). */
export function featsOnWin(run: Run): void {
  if (run.runHits === 0 && !run.featsRun.includes('flawless')) {
    award(run, 'flawless');
    run.showBanner('Wyczyn: Bez skazy!');
  }
}
