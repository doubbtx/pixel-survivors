import { rng } from '../core/rng';
import { sfx } from '../core/audio';
import { C } from '../core/palette';
import { BAL } from '../data/balance';
import { TASKS, REWARD_LABEL, type TaskDef } from '../data/tasks';
import { ELEMENTS, WEAPON_ELEMENT, type Element } from '../data/elements';
import { ELITE_MODS } from '../data/enemies';
import type { Enemy } from '../entities/types';
import type { Run } from '../game/run';
import { spawnEnemy, currentMix, encircle } from './spawner';
import { grantMat } from './forge';

/** Trwające albo czekające na start zadanie (kamień na mapie). */
export interface Task {
  def: TaskDef;
  x: number;
  y: number;
  started: boolean;
  /** Przed startem: czas do zniknięcia kamienia; po starcie: czas na wykonanie. */
  life: number;
  max: number;
  progress: number;
  /** Totem: HP 0..1. */
  hp: number;
  elem: Element | null;
  /** Łowy: uid elity. */
  target: number;
}

const ELEMS: Element[] = ['fire', 'ice', 'lightning', 'poison'];

/** Żywioły, które build nakłada: bronie (i augmenty), karty, super-bonusy. */
export function buildElements(run: Run): Element[] {
  const out = new Set<Element>();
  for (const w of run.weapons) { const el = WEAPON_ELEMENT[w.def.id]; if (el) out.add(el); }
  for (const el of run.augElem.values()) out.add(el);
  for (const el of ELEMS) if (run.flag(`elemChance.${el}`) > 0) out.add(el);
  return [...out];
}

function hasElement(e: Enemy, el: Element): boolean {
  return el === 'fire' ? e.burnT > 0 : el === 'ice' ? e.slowT > 0 : el === 'lightning' ? e.shockT > 0 : e.poisonStacks > 0;
}

/** Czy teraz mogą pojawiać się zadania (zwykła mapa, bez bossa na planszy). */
function allowed(run: Run): boolean {
  return !run.dungeon && !run.levelInfo.dungeon && !run.boss && (!run.bossSpawned || run.mode === 'endless');
}

function offer(run: Run): void {
  const T = BAL.tasks, els = buildElements(run);
  const def = rng.pick(TASKS.filter((d) => d.kind !== 'element' || els.length > 0));
  const a = rng.range(0, Math.PI * 2), d = rng.range(T.placeMin, T.placeMax);
  run.task = {
    def, x: run.player.x + Math.cos(a) * d, y: run.player.y + Math.sin(a) * d, started: false,
    life: T.acceptLife, max: T.acceptLife, progress: 0, hp: 1, elem: def.kind === 'element' ? rng.pick(els) : null, target: 0,
  };
  run.showBanner(`Zadanie: ${def.name}! Dotknij kamienia`);
  sfx.play('select');
}

function start(run: Run, t: Task): void {
  const T = BAL.tasks;
  t.started = true;
  t.max = t.life = t.def.time * (1 - Math.min(0.5, run.flag('taskTime')));
  if (t.def.kind === 'hunt') {
    const a = rng.range(0, Math.PI * 2);
    const base = rng.weighted(currentMix(run.waveTime(), run.levelInfo.biome).filter(([id]) => id !== 'bat'));
    const e = spawnEnemy(run, base, t.x + Math.cos(a) * T.huntDist, t.y + Math.sin(a) * T.huntDist, { elite: [rng.pick(Object.keys(ELITE_MODS))] });
    if (!e) { t.life = 0; return; }
    t.target = e.uid;
  }
  const label = t.def.kind === 'element' ? `${t.def.desc}: ${ELEMENTS[t.elem!].name}` : t.def.desc;
  run.showBanner(label);
  run.burst(t.x, t.y, C.cyan, 20, 60);
  sfx.play('levelup');
}

function finish(run: Run, ok: boolean): void {
  const t = run.task!, p = run.player;
  run.task = null;
  run.taskT = BAL.tasks.every;
  if (!ok) {
    run.showBanner(`Zadanie nieudane: ${t.def.name}`);
    sfx.play('hurt');
    if (t.def.failWave) punish(run);
    return;
  }
  run.tasksDone++;
  grantMat(run, 'ore', BAL.tasks.ore);
  switch (t.def.reward) {
    case 'chest': run.dropChest(p.x + rng.range(-16, 16), p.y - 20, 'elite'); break;
    case 'card': run.pendingCards.push('elite'); break;
    case 'gold':
      run.gold += BAL.tasks.gold * run.depth * run.stats.greed;
      for (let i = 0; i < 12; i++) run.spawnPickup(p.x + rng.range(-20, 20), p.y + rng.range(-20, 20), 'coin', 1);
      break;
  }
  run.showBanner(`Zadanie wykonane! Nagroda: ${REWARD_LABEL[t.def.reward].name}`);
  run.burst(p.x, p.y, C.gold, 30, 80);
  sfx.play('chest');
}

/** Karna fala: elity i okrążenie zwykłych wrogów wokół gracza. */
function punish(run: Run): void {
  encircle(run, BAL.tasks.failWave, BAL.tasks.failElites);
}

export function updateTasks(run: Run, dt: number): void {
  const t = run.task, p = run.player, T = BAL.tasks;
  if (!t) {
    if (!allowed(run)) return;
    run.taskT -= dt;
    if (run.taskT <= 0) offer(run);
    return;
  }
  // Boss albo loch przerywa zadanie bez kary i nagrody.
  if (!allowed(run)) { run.task = null; run.taskT = T.every; return; }
  t.life -= dt;
  if (!t.started) {
    if ((t.x - p.x) ** 2 + (t.y - p.y) ** 2 < 14 * 14) start(run, t);
    else if (t.life <= 0) { run.task = null; run.taskT = T.every * 0.5; }
    return;
  }
  switch (t.def.kind) {
    case 'hunt': {
      const e = run.enemies.items.find((x) => x.uid === t.target);
      if (!e || e.dead) { finish(run, true); return; }
      break;
    }
    case 'totem': {
      // Wrogowie przy totemie go niszczą (z limitem), a bez obrońcy w pobliżu totem słabnie sam.
      let n = 0;
      run.enemiesInCircle(t.x, t.y, T.totemR, () => { n++; });
      t.hp -= (Math.min(n, T.totemMax) * T.totemDrain / 100) * dt;
      if ((t.x - p.x) ** 2 + (t.y - p.y) ** 2 > T.totemGuard * T.totemGuard) t.hp -= (T.totemAlone / 100) * dt;
      if (t.hp <= 0) { run.burst(t.x, t.y, C.brown, 24, 70); finish(run, false); return; }
      if (t.progress >= t.def.need) { finish(run, true); return; }
      break;
    }
    case 'circle':
      if ((t.x - p.x) ** 2 + (t.y - p.y) ** 2 < T.circleR * T.circleR) t.progress += dt;
      if (t.progress >= t.def.need) { finish(run, true); return; }
      break;
    case 'element':
      if (t.progress >= t.def.need) { finish(run, true); return; }
      break;
  }
  if (t.life <= 0) finish(run, t.def.kind === 'dodge');
}

/** Oberwanie w zadaniu „Bez skazy”: `need`-te trafienie je przerywa. */
export function taskOnHurt(run: Run): void {
  const t = run.task;
  if (t?.started && t.def.kind === 'dodge' && ++t.progress >= t.def.need) finish(run, false);
}

/** Zabójstwo: postęp „Próby żywiołu” i „Obrony totemu”. */
export function taskOnKill(run: Run, e: Enemy): void {
  const t = run.task;
  if (t?.started && t.def.kind === 'element' && hasElement(e, t.elem!)) t.progress++;
  const R = BAL.tasks.totemKillR;
  if (t?.started && t.def.kind === 'totem' && (e.x - t.x) ** 2 + (e.y - t.y) ** 2 < R * R) t.progress++;
}

/** Punkt do znacznika poza ekranem: kamień, totem, krąg albo ścigana elita. */
export function taskTarget(run: Run): { x: number; y: number } | null {
  const t = run.task;
  if (!t) return null;
  if (t.started && t.def.kind === 'hunt') return run.enemies.items.find((x) => x.uid === t.target && !x.dead) ?? null;
  if (t.started && (t.def.kind === 'dodge' || t.def.kind === 'element')) return null;
  return t;
}

/** Postęp zadania do panelu w HUD. */
export function taskStatus(run: Run): string {
  const t = run.task!;
  if (!t.started) return 'Dotknij kamienia';
  switch (t.def.kind) {
    case 'hunt': return 'Zabij elitę';
    case 'totem': return `Totem ${Math.max(0, Math.ceil(t.hp * 100))}%, ${t.progress}/${t.def.need}`;
    case 'circle': return `W kręgu ${Math.floor(t.progress)}/${t.def.need} s`;
    case 'dodge': return `Trafienia ${t.progress}/${t.def.need - 1}`;
    case 'element': return `${ELEMENTS[t.elem!].name} ${t.progress}/${t.def.need}`;
  }
}
