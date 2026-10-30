import type { Input } from '../core/input';
import { sfx } from '../core/audio';
import { C } from '../core/palette';
import { rng } from '../core/rng';
import { BAL } from '../data/balance';
import { abilityParam, abilityCooldown, type AbilityKind, type AbilitySlot } from '../data/heroes';
import { SLOT, type AbilityInst, type Enemy } from '../entities/types';
import type { Run } from '../game/run';
import { spawnMinion } from './minions';
import { resourceOnCast, spendSouls, spendStreak, spendFaith, furyGain, rhythmAtk, spendRhythm, rhythmGain, resFrac } from './resource';
import { VIEW_W, VIEW_H } from '../core/renderer';

const ORDER: AbilitySlot[] = ['q', 'e', 'dash', 'ult'];

/** Wróg w kadrze (R4: ulty na „wszystkich widocznych”). */
function onScreen(run: Run, e: Enemy): boolean {
  return e.x > run.camX && e.x < run.camX + VIEW_W && e.y > run.camY && e.y < run.camY + VIEW_H;
}

/** Kierunek od gracza do punktu celowania (znormalizowany). */
function aimDir(run: Run): [number, number] {
  const p = run.player;
  const dx = run.aimX - p.x, dy = run.aimY - p.y;
  const d = Math.hypot(dx, dy);
  return d < 0.001 ? [p.fx, p.fy] : [dx / d, dy / d];
}

/** Punkt celowania przycięty do maks. zasięgu umiejętności. */
function aimPoint(run: Run, range: number): [number, number] {
  const p = run.player;
  const dx = run.aimX - p.x, dy = run.aimY - p.y;
  const d = Math.hypot(dx, dy);
  if (d <= range) return [run.aimX, run.aimY];
  return [p.x + (dx / d) * range, p.y + (dy / d) * range];
}

type Cast = (run: Run, a: AbilityInst, P: (k: string) => number) => void;

/** Cios z cienia: doskok za plecy wroga (przez ruch, więc z kolizjami terenu) i krytyczne cięcie po dotarciu. */
function stepStrike(run: Run, a: AbilityInst, P: (k: string) => number, t: Enemy | null, x: number, y: number): void {
  const p = run.player, dur = 0.1;
  let tx = x, ty = y;
  if (t) {
    const dx = t.x - p.x, dy = t.y - p.y, d = Math.hypot(dx, dy) || 1;
    tx = t.x + (dx / d) * (t.radius + 6);
    ty = t.y + (dy / d) * (t.radius + 6);
  }
  const f = run.addFx('line', p.x, p.y, C.lavender, 0.2);
  if (f) { f.x2 = tx; f.y2 = ty; f.w = 2; }
  run.burst(p.x, p.y, C.slate, 8, 40);
  p.dashT = dur;
  p.dvx = (tx - p.x) / dur;
  p.dvy = (ty - p.y) / dur;
  p.iframes = Math.max(p.iframes, 0.3);
  run.schedule(dur, () => {
    const r = P('radius') * run.stats.area;
    run.enemiesInCircle(p.x, p.y, r, (e) => run.damageEnemy(e, P('damage') * run.stats.might, a.def.name, { forceCrit: true, kx: e.x - p.x, ky: e.y - p.y, knock: 3 }));
    const ring = run.addFx('ring', p.x, p.y, C.lavender, 0.2);
    if (ring) ring.r = r;
    run.burst(p.x, p.y, C.white, 8, 60);
    sfx.play('hit');
  });
}

/** Taniec ostrzy: cień tnie losowego wroga w promieniu. */
function danceStrike(run: Run, a: AbilityInst): void {
  const P = (k: string) => abilityParam(a.def, a.level, k) + run.flag(`${a.def.id}.${k}`);
  const p = run.player, R = P('radius') * run.stats.area;
  const cand = run.hash.query(p.x, p.y, R, run.qa).filter((e) => !e.dead && (e.x - p.x) ** 2 + (e.y - p.y) ** 2 <= R * R);
  if (!cand.length) return;
  const e = rng.pick(cand), ang = rng.range(0, Math.PI * 2);
  const f = run.addFx('line', e.x + Math.cos(ang) * 14, e.y + Math.sin(ang) * 14, C.white, 0.12);
  if (f) { f.x2 = e.x - Math.cos(ang) * 14; f.y2 = e.y - Math.sin(ang) * 14; f.w = 2; }
  run.damageEnemy(e, P('damage') * run.stats.might, a.def.name, { kx: e.x - p.x, ky: e.y - p.y, knock: 2 });
  run.burst(e.x, e.y, C.lavender, 4, 50);
}

/** Sąd: słupy światła na `n` najbliższych wrogach (kolejno, z małym odstępem). */
function judgeWave(run: Run, a: AbilityInst, P: (k: string) => number, n: number, mul: number, delay: number): void {
  const p = run.player, R = P('radius') * run.stats.area;
  const cand = run.hash.query(p.x, p.y, R, run.qa).filter((e) => !e.dead && (e.x - p.x) ** 2 + (e.y - p.y) ** 2 <= R * R);
  cand.sort((u, v) => (u.x - p.x) ** 2 + (u.y - p.y) ** 2 - ((v.x - p.x) ** 2 + (v.y - p.y) ** 2));
  cand.slice(0, n).forEach((e, i) => {
    const x = e.x, y = e.y;
    run.schedule(delay + i * 0.04, () => {
      const tx = e.dead ? x : e.x, ty = e.dead ? y : e.y;
      const f = run.addFx('line', tx, ty - 150, C.yellow, 0.2);
      if (f) { f.x2 = tx; f.y2 = ty; f.w = 4; }
      run.explode(tx, ty, P('blast') * run.stats.area, P('damage') * mul * run.stats.might, a.def.name, C.yellow, 2);
    });
  });
}

/** Wrogowie w pasie szerokości `w` wzdłuż odcinka (każdy raz): cięcie Iai Takezo. */
function alongPath(run: Run, x0: number, y0: number, x1: number, y1: number, w: number, fn: (e: Enemy) => void): void {
  const L = Math.hypot(x1 - x0, y1 - y0), seen = new Set<number>();
  for (let d = 0; d <= L; d += 8) {
    const k = L ? d / L : 0;
    run.enemiesInCircle(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, w, (e) => {
      if (seen.has(e.uid)) return;
      seen.add(e.uid);
      fn(e);
    });
  }
}

/** Uderzenie z góry Takezo: obszar w punkcie (x, y) — obrażenia, ogłuszenie, pionowy błysk ostrza i krąg. */
function overheadHit(run: Run, a: AbilityInst, x: number, y: number, r: number, dmg: number, stun: number): void {
  run.enemiesInCircle(x, y, r, (e) => run.damageEnemy(e, dmg, a.def.name, { kx: e.x - x, ky: e.y - y, knock: 4, stun }));
  const f = run.addFx('line', x, y - 34, C.white, 0.14);
  if (f) { f.x2 = x; f.y2 = y; f.w = 3; }
  const ring = run.addFx('ring', x, y, C.lgray, 0.3);
  if (ring) ring.r = r;
  run.burst(x, y, C.lgray, 14, 70);
  run.burst(x, y, C.dbrown, 8, 40);
  run.addShake(3);
  sfx.play('explode');
}

/** Jedno cięcie Tysiąca cięć: stożek przed Takezo (Dwa niebiosa: także za nim). */
function flurrySlash(run: Run, a: AbilityInst, P: (k: string) => number, k: number): void {
  const p = run.player, [dx, dy] = aimDir(run), r = P('radius') * run.stats.area, arc = 0.62;
  const dirs = [Math.atan2(dy, dx) + (k % 2 ? 0.18 : -0.18)];
  if (a.def.evolved) dirs.push(dirs[0] + Math.PI);
  for (const base of dirs) {
    run.enemiesInCircle(p.x, p.y, r, (e) => {
      let d = Math.atan2(e.y - p.y, e.x - p.x) - base;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      if (Math.abs(d) <= arc) run.damageEnemy(e, P('damage') * run.stats.might, a.def.name, { kx: e.x - p.x, ky: e.y - p.y, knock: 1 });
    });
    const f = run.addFx('arc', p.x, p.y, k % 2 ? C.cyan : C.white, 0.16);
    if (f) { f.r = r; f.a0 = base - arc; f.a1 = base + arc; }
  }
  if (k % 3 === 0) sfx.play('hit');
}

/** Iai: doskok wzdłuż kierunku, chwila ciszy (chowanie miecza), potem cięcie wszystkiego na trasie. */
function iaiCut(run: Run, a: AbilityInst, P: (k: string) => number, dx: number, dy: number, mul: number, then?: () => void): void {
  const p = run.player, dist = P('dist'), dur = 0.15, sx = p.x, sy = p.y, ex = p.x + dx * dist, ey = p.y + dy * dist;
  p.dashT = dur;
  p.dvx = (dx * dist) / dur;
  p.dvy = (dy * dist) / dur;
  p.iframes = Math.max(p.iframes, 0.6);
  const f = run.addFx('line', sx, sy, C.lgray, 0.5);
  if (f) { f.x2 = ex; f.y2 = ey; f.w = 1; }
  sfx.play('dash');
  run.schedule(0.5, () => {
    const w = P('width') * run.stats.area;
    alongPath(run, sx, sy, ex, ey, w, (e) => run.damageEnemy(e, P('damage') * mul * run.stats.might, a.def.name, { forceCrit: true, kx: -dy, ky: dx, knock: 3 }));
    const cut = run.addFx('line', sx, sy, C.white, 0.25);
    if (cut) { cut.x2 = ex; cut.y2 = ey; cut.w = 4; }
    run.burst((sx + ex) / 2, (sy + ey) / 2, C.white, 18, 90);
    run.addShake(5);
    run.freeze(0.08);
    sfx.play('boss');
    then?.();
  });
}

/** Dodatkowe efekty umiejętności po ewolucji (po zwykłym użyciu), wg id umiejętności. */
const EVO_EXTRA: Record<string, Cast> = {
  // Burza strzał: druga salwa po chwili.
  k_volley: (run, a, P) => run.schedule(0.3, () => CASTS.volley(run, a, P)),
  // Lodowa sieć: zamrożenie wrogów w środku.
  k_net: (run, _a, P) => {
    const [x, y] = aimPoint(run, P('range'));
    run.enemiesInCircle(x, y, P('radius') * run.stats.area, (e) => { e.stunT = Math.max(e.stunT, 1.5); });
  },
  // Nawałnica z nieba: drugi grad wokół gracza.
  k_rain: (run, a, P) => {
    const z = run.addZone('rain', run.player.x, run.player.y, P('radius') * run.stats.area * 0.8, P('damage') * run.stats.might, P('duration') * run.stats.duration, SLOT.ult, a.def.name);
    if (z) z.tick = 15;
  },
  // Taran tytana: druga, szersza fala uderzeniowa po uderzeniu kończącym szarżę.
  b_charge: (run, a, P) => run.schedule(0.45, () => run.explode(run.player.x, run.player.y, P('impact') * 1.5 * run.stats.area, P('damage') * run.stats.might, a.def.name, C.orange, 6)),
  // Rozłam: druga, szersza fala.
  b_slam: (run, a, P) => run.schedule(0.45, () => {
    const p = run.player, r = P('radius') * 1.6 * run.stats.area;
    run.enemiesInCircle(p.x, p.y, r, (e) => run.damageEnemy(e, P('damage') * 0.7 * run.stats.might, a.def.name, { kx: e.x - p.x, ky: e.y - p.y, knock: 4, stun: P('stun') }));
    const f = run.addFx('ring', p.x, p.y, C.orange, 0.35);
    if (f) f.r = r;
    run.addShake(3);
  }),
  // Słońce: trzy dodatkowe wybuchy wokół celu.
  i_fireball: (run, a, P) => {
    const [x, y] = aimPoint(run, P('range'));
    for (let i = 0; i < 3; i++) {
      const ang = (i / 3) * Math.PI * 2 + rng.range(0, 1);
      const d = P('radius') * run.stats.area;
      run.schedule(0.25 + i * 0.12, () => run.explode(x + Math.cos(ang) * d, y + Math.sin(ang) * d, P('radius') * 0.8 * run.stats.area, P('damage') * 0.6 * run.stats.might, a.def.name, C.gold, 3));
    }
  },
  // Płomienna bariera: tarcza 15% HP.
  i_ring: (run) => { run.addShield(run.stats.maxHp * 0.15, 0.3); },
  // Widmowy cios: dwa kolejne doskoki do najbliższych wrogów.
  v_step: (run, a, P) => {
    for (let i = 1; i <= 2; i++) run.schedule(0.22 * i, () => {
      const t = run.nearestEnemy(run.player.x, run.player.y, 100);
      if (t) stepStrike(run, a, P, t, t.x, t.y);
    });
  },
  // Rozłupanie niebios: druga, większa eksplozja dalej przed Takezo.
  t_slam: (run, a, P) => {
    const p = run.player, [dx, dy] = aimDir(run), d = P('dist') * 2.2, x = p.x + dx * d, y = p.y + dy * d;
    run.schedule(0.35, () => overheadHit(run, a, x, y, P('radius') * 1.4 * run.stats.area, P('damage') * 0.8 * run.stats.might, P('stun')));
  },
  // Sanktuarium: tarcza na start.
  a_sanct: (run) => { run.addShield(run.stats.maxHp * 0.12, 0.3); },
  // Przeklęta ziemia: wrogowie w bagnie zostają porażeni.
  m_curse: (run, _a, P) => {
    const [x, y] = aimPoint(run, P('range'));
    run.enemiesInCircle(x, y, P('radius') * run.stats.area, (e) => run.applyElement(e, 'lightning', P('damage') * run.stats.might));
  },
};

/** Zachowania umiejętności. `P(klucz)` zwraca parametr na bieżącym poziomie. */
const CASTS: Record<AbilityKind, Cast> = {
  volley(run, a, P) {
    const [dx, dy] = aimDir(run);
    const base = Math.atan2(dy, dx);
    const n = Math.round(P('count'));
    for (let i = 0; i < n; i++) {
      run.spawnProjectile({
        x: run.player.x, y: run.player.y, angle: base + (n > 1 ? (i / (n - 1) - 0.5) * P('spread') : 0), speed: P('speed'),
        damage: P('damage') * run.stats.might, src: a.def.name, sprite: 'arrow', kind: 'arrow', pierce: P('pierce'), life: 0.9, knock: 2,
      });
    }
  },

  net(run, a, P) {
    const [x, y] = aimPoint(run, P('range'));
    const z = run.addZone('net', x, y, P('radius') * run.stats.area, P('damage') * run.stats.might, P('duration') * run.stats.duration, SLOT.e, a.def.name);
    if (z) { z.slow = P('slow'); z.tick = 30; }
    run.burst(x, y, C.lgray, 10, 40);
  },

  dash(run, _a, P) {
    const p = run.player;
    let dx = p.fx, dy = p.fy;
    if (!p.moving) [dx, dy] = aimDir(run);
    const dur = 0.15;
    p.dashT = dur;
    p.dvx = (dx * P('dist')) / dur;
    p.dvy = (dy * P('dist')) / dur;
    p.iframes = Math.max(p.iframes, P('iframes'));
    sfx.play('dash');
  },

  rain(run, a, P) {
    const [x, y] = aimPoint(run, P('range'));
    const z = run.addZone('rain', x, y, P('radius') * run.stats.area, P('damage') * run.stats.might, P('duration') * run.stats.duration, SLOT.ult, a.def.name);
    if (z) z.tick = 15;
    run.showBanner(a.def.name + '!');
  },

  charge(run, a, P) {
    const p = run.player;
    const [dx, dy] = aimDir(run);
    const dist = P('dist'), Q = BAL.charge;
    const dur = 0.2;
    // Obrażenia na całej trasie od razu (wrogowie odrzuceni na boki); samo przemieszczenie trwa `dur`.
    let hits = 0, kills = 0;
    for (let d = 0; d <= dist; d += 8) {
      run.enemiesInCircle(p.x + dx * d, p.y + dy * d, P('width'), (e) => {
        if (e.hitStamp[SLOT.q] === run.step) return;
        e.hitStamp[SLOT.q] = run.step;
        const side = (e.x - p.x) * -dy + (e.y - p.y) * dx >= 0 ? 1 : -1;
        run.damageEnemy(e, P('damage') * run.stats.might, a.def.name, { kx: -dy * side + dx * 0.3, ky: dx * side + dy * 0.3, knock: 5, stun: P('stun') });
        hits++;
        if (e.dead) kills++;
      });
    }
    // Furia za staranowanych, zabójstwa skracają odnowienie.
    if (run.hero.resource.kind === 'fury' && hits) furyGain(run, hits * Q.fury);
    if (kills) a.cd *= 1 - Math.min(Q.refundMax, kills * Q.refund);
    // Uderzenie w ziemię na końcu: tym mocniejsze, im więcej wrogów staranowano.
    const impact = P('impact') * run.stats.area, bonus = 1 + Math.min(Q.maxBonus, hits * Q.perHit);
    run.schedule(dur, () => {
      run.explode(p.x, p.y, impact, P('damage') * Q.impactMul * bonus * run.stats.might, a.def.name, C.orange, 5);
      run.burst(p.x, p.y, C.brown, 14 + hits * 2, 70);
      run.addShake(2 + Math.min(3, hits * 0.3));
    });
    const f = run.addFx('line', p.x, p.y, C.orange, 0.25);
    if (f) { f.x2 = p.x + dx * dist; f.y2 = p.y + dy * dist; f.w = 3; }
    p.dashT = dur;
    p.dvx = (dx * dist) / dur;
    p.dvy = (dy * dist) / dur;
    p.iframes = Math.max(p.iframes, 0.3);
    run.addShake(2);
  },

  slam(run, a, P) {
    const p = run.player;
    const r = P('radius') * run.stats.area;
    run.enemiesInCircle(p.x, p.y, r, (e) =>
      run.damageEnemy(e, P('damage') * run.stats.might, a.def.name, { kx: e.x - p.x, ky: e.y - p.y, knock: 6, stun: P('stun') }));
    const f = run.addFx('ring', p.x, p.y, C.brown, 0.3);
    if (f) f.r = r;
    run.burst(p.x, p.y, C.brown, 20, 80);
    run.addShake(4);
    sfx.play('explode');
  },

  titan(run, a, P) {
    a.activeT = P('duration');
    run.recomputeStats();
    run.showBanner(a.def.name + '!');
    run.addShake(5);
  },

  fireball(run, a, P) {
    const p = run.player;
    const [x, y] = aimPoint(run, P('range'));
    const f = run.addFx('line', p.x, p.y, C.orange, 0.15);
    if (f) { f.x2 = x; f.y2 = y; f.w = 2; }
    // Krótki lot kuli, potem wybuch i płonąca ziemia.
    run.schedule(0.12, () => {
      const r = P('radius') * run.stats.area;
      run.explode(x, y, r, P('damage') * run.stats.might, a.def.name, C.orange, 4);
      run.addFire(x, y, r * 0.7, P('damage') * 0.12 * run.stats.might, 2 * run.stats.duration, a.def.name);
    });
  },

  firering(run, a, P) {
    const p = run.player;
    const r = P('radius') * run.stats.area;
    // Odepchnięcie od środka, potem krąg płomieni na obwodzie.
    run.enemiesInCircle(p.x, p.y, r, (e) => run.damageEnemy(e, P('damage') * 2 * run.stats.might, a.def.name, { kx: e.x - p.x, ky: e.y - p.y, knock: 7 }));
    const n = 10;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2;
      run.addFire(p.x + Math.cos(ang) * r, p.y + Math.sin(ang) * r, 12 * run.stats.area, P('damage') * run.stats.might, P('duration') * run.stats.duration, a.def.name);
    }
    const f = run.addFx('ring', p.x, p.y, C.gold, 0.3);
    if (f) f.r = r;
    run.addShake(2);
  },

  summon(run, a, P) {
    const p = run.player;
    for (let i = 0; i < Math.round(P('count')); i++) spawnMinion(run, p.x, p.y, P('damage') * run.stats.might, P('duration'), false, a.def.name);
  },

  curse(run, a, P) {
    const [x, y] = aimPoint(run, P('range'));
    const z = run.addZone('curse', x, y, P('radius') * run.stats.area, P('damage') * run.stats.might, P('duration') * run.stats.duration, SLOT.e, a.def.name);
    if (z) { z.slow = 0.4; z.tick = 30; }
    run.burst(x, y, C.lime, 12, 40);
  },

  legion(run, a, P) {
    const p = run.player;
    // Dusze (zasób Morwen): mocniejsi i liczniejsi wojownicy.
    const souls = spendSouls(run);
    for (let i = 0; i < Math.round(P('count')) + souls.extra; i++) spawnMinion(run, p.x, p.y, P('damage') * souls.mul * run.stats.might, P('duration'), true, a.def.name, !!a.def.evolved);
    run.showBanner(a.def.name + '!');
    run.addShake(5);
  },

  shadowstep(run, a, P) {
    const [x, y] = aimPoint(run, P('range'));
    stepStrike(run, a, P, run.nearestEnemy(x, y, 60) ?? run.nearestEnemy(run.player.x, run.player.y, P('range')), x, y);
    if (run.flag('stepResetDash') > 0) run.abilities.dash.cd = 0;
  },

  execute(run, a, P) {
    const p = run.player;
    // Kombo (zasób Vesper): całe zużyte na jeden cios.
    const mul = spendStreak(run);
    const [dx, dy] = aimDir(run);
    const base = Math.atan2(dy, dx), arc = a.def.evolved ? Math.PI : 1.1;
    const r = P('radius') * run.stats.area;
    let kills = 0;
    run.enemiesInCircle(p.x, p.y, r, (e) => {
      let da = Math.atan2(e.y - p.y, e.x - p.x) - base;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      if (Math.abs(da) > arc) return;
      // Egzekucja: słabi wrogowie (bez bossów) giną od razu.
      const weak = !e.boss && e.hp <= e.maxHp * P('exec');
      run.damageEnemy(e, weak ? e.maxHp * 3 : P('damage') * mul * run.stats.might, a.def.name, { kx: e.x - p.x, ky: e.y - p.y, knock: 4, forceCrit: weak });
      if (e.dead) kills++;
    });
    run.cardState['sec.exec'] = Math.max(run.cardState['sec.exec'] ?? 0, kills);
    if (kills) run.heal(run.stats.maxHp * run.flag('execHeal') * kills);
    const f = run.addFx('arc', p.x, p.y, C.salmon, 0.2);
    if (f) { f.r = r; f.a0 = base - arc; f.a1 = base + arc; }
    run.addShake(mul > 2 ? 4 : 2);
  },

  bladedance(run, a, P) {
    a.activeT = P('duration') * run.stats.duration;
    run.player.iframes = Math.max(run.player.iframes, a.activeT);
    run.showBanner(a.def.name + '!');
    run.addShake(3);
  },

  lance(run, a, P) {
    // Włócznia światła (Aurel, 0.43): lecąca włócznia przebija wszystkich na linii i nakłada Piętno; Włócznia świtu: wachlarz.
    const p = run.player, B = BAL.brand, [dx, dy] = aimDir(run), base = Math.atan2(dy, dx), n = Math.max(1, Math.round(P('count')));
    const dmg = P('damage') * run.stats.might * (1 + run.flag('lanceDmg'));
    run.cardState.lanceDmg = dmg;
    for (let k = 0; k < n; k++) {
      const ang = base + (k - (n - 1) / 2) * 0.28;
      const pr = run.spawnProjectile({ x: p.x, y: p.y, angle: ang, speed: B.speed * (1 + run.flag('lanceSpeed')), damage: dmg, src: a.def.name, sprite: 'lance', pierce: 999, life: B.life, radius: B.width * run.stats.area, knock: 1.5 });
      if (!pr) continue;
      pr.bounces = 0;
      pr.brand = Math.min(B.max, P('duration') * run.stats.duration);
      pr.brandBoom = !!a.def.evolved;
    }
    run.burst(p.x + dx * 8, p.y + dy * 8, C.yellow, 8, 50);
  },

  guardian(run, a, P) {
    const p = run.player;
    for (let i = 0; i < Math.round(P('count')); i++) spawnMinion(run, p.x, p.y, P('damage') * run.stats.might, P('duration'), !!a.def.evolved, a.def.name, false, true);
  },

  sanctum(run, a, P) {
    const p = run.player;
    const z = run.addZone('holy', p.x, p.y, P('radius') * run.stats.area, P('damage') * run.stats.might, P('duration') * run.stats.duration, SLOT.e, a.def.name);
    if (z) { z.tick = 30; z.len = P('heal'); }
    run.burst(p.x, p.y, C.yellow, 14, 50);
  },

  judgment(run, a, P) {
    // Wiara (zasób Aurela): mocniejsze słupy i więcej celów; Sąd ostateczny spuszcza drugą falę.
    const faith = spendFaith(run, !!a.def.evolved);
    const n = Math.round(P('count')) + faith.extra;
    judgeWave(run, a, P, n, faith.mul, 0.15);
    if (a.def.evolved) judgeWave(run, a, P, n, faith.mul, 0.9);
    run.showBanner(a.def.name + '!');
    run.addShake(5);
  },

  overhead(run, a, P) {
    // Cios z góry w punkt przed Takezo (po krótkim zamachu).
    const p = run.player, [dx, dy] = aimDir(run), x = p.x + dx * P('dist'), y = p.y + dy * P('dist');
    const f = run.addFx('arc', p.x, p.y, C.lgray, 0.14);
    if (f) { const b = Math.atan2(dy, dx); f.r = 16; f.a0 = b - 1.4; f.a1 = b + 0.2; }
    run.schedule(0.12, () => overheadHit(run, a, x, y, P('radius') * run.stats.area, P('damage') * run.stats.might, P('stun')));
  },

  flurry(run, a, P) {
    // Liczba i tempo cięć rosną z szybkością ataku (statystyka i Rytm).
    const atk = 1 + Math.max(0, run.stats.atkSpeed) + rhythmAtk(run), n = Math.round(P('slashes') * atk), gap = 0.09 / atk;
    for (let k = 0; k < n; k++) run.schedule(k * gap, () => flurrySlash(run, a, P, k));
  },

  iai(run, a, P) {
    const [dx, dy] = aimDir(run), mul = spendRhythm(run);
    run.showBanner(a.def.name + '!');
    // Ostatnie cięcie (ewolucja): powrót tą samą drogą i drugie cięcie.
    iaiCut(run, a, P, dx, dy, mul, a.def.evolved ? () => run.schedule(0.1, () => iaiCut(run, a, P, -dx, -dy, mul)) : undefined);
  },

  // ===== R4: drugie ultimate (to samo id co pierwsze — flagi drzewka i kart; ewolucja w samym zachowaniu) =====

  falcon(run, a, P) {
    // Strzał sokoła (Kestra): jedna potężna strzała po linii celowania, przebija wszystko; Celność zużyta = mocniej.
    const p = run.player, U = BAL.altUlt, focus = run.hero.resource.kind === 'focus' ? run.res : 0;
    if (focus > 0) run.res = 0;
    const dmg = P('damage') * (P('duration') / 3.5) * (1 + U.falconFocus * focus) * run.stats.might;
    const w = (U.falconW + P('radius') * 0.1) * run.stats.area, [dx, dy] = aimDir(run), base = Math.atan2(dy, dx);
    for (const off of a.def.evolved ? [-0.18, 0, 0.18] : [0]) {
      const ux = Math.cos(base + off), uy = Math.sin(base + off), L = U.falconLen;
      for (const e of run.enemies.items) {
        if (e.dead) continue;
        const t = Math.max(0, Math.min(L, (e.x - p.x) * ux + (e.y - p.y) * uy));
        if (Math.hypot(e.x - p.x - ux * t, e.y - p.y - uy * t) <= w + e.radius) run.damageEnemy(e, dmg, a.def.name, { kx: ux, ky: uy, knock: 4 });
      }
      const f = run.addFx('line', p.x, p.y, C.gold, 0.35);
      if (f) { f.x2 = p.x + ux * L; f.y2 = p.y + uy * L; f.w = w * 0.6; }
      for (let k = 1; k <= 4; k++) { const r = run.addFx('ring', p.x + ux * L * k / 4, p.y + uy * L * k / 4, C.yellow, 0.3); if (r) r.r = w * 1.5; }
    }
    run.addShake(4);
    run.showBanner(a.def.name + '!');
  },

  quake(run, a, P) {
    // Trzęsienie ziemi (Borgun): fale uderzeniowe coraz szersze; ogłuszenie (bez bossów) dłuższe z furią.
    const p = run.player, U = BAL.altUlt, waves = a.def.evolved ? U.quakeWavesEvo : U.quakeWaves;
    const fury = run.hero.resource.kind === 'fury' ? resFrac(run) : 0;
    const stun = U.quakeStun + P('duration') * 0.05 + fury * U.quakeFuryStun;
    for (let i = 0; i < waves; i++) run.schedule(i * U.quakeGap, () => {
      const r = P('radius') * (1.4 + i * 0.7) * run.stats.area;
      run.enemiesInCircle(p.x, p.y, r, (e) => run.damageEnemy(e, P('damage') * U.quakeDmg * run.stats.might, a.def.name, { kx: e.x - p.x, ky: e.y - p.y, knock: 5, stun: e.boss ? 0 : stun }));
      const f = run.addFx('ring', p.x, p.y, C.brown, 0.35);
      if (f) f.r = r;
      const d = run.addFx('disc', p.x, p.y, C.tan, 0.5);
      if (d) { d.r = r; d.a0 = 0.3; }
      for (let k = 0; k < 10; k++) { const ang = (k / 10) * Math.PI * 2; run.burst(p.x + Math.cos(ang) * r * 0.9, p.y + Math.sin(ang) * r * 0.9, C.brown, 3, 40); }
      run.addShake(4);
      sfx.play('explode');
    });
    run.showBanner(a.def.name + '!');
  },

  flare(run, a, P) {
    // Rozbłysk słońca (Ignara): zużywa cały żar; po chwili ogromny wybuch wokół bohatera, bez przegrzania.
    const p = run.player, U = BAL.altUlt, heat = run.hero.resource.kind === 'heat' ? resFrac(run) : 0;
    if (heat > 0) run.res = 0;
    // Premia do czasu z kart i Rozwoju (flaga `i_inferno.duration`) zamienia się w obrażenia — Rozbłysk nie trwa.
    const durBonus = 1 + U.flareDur * run.flag(`${a.def.id}.duration`);
    const r = (P('radius') + P('blast')) * (1 + U.flareHeatR * heat) * run.stats.area, dmg = P('damage') * U.flareDmg * (1 + U.flareHeat * heat) * durBonus * run.stats.might;
    const f = run.addFx('ring', p.x, p.y, C.gold, U.flareDelay);
    if (f) f.r = r;
    // Ładowanie: złoty krąg zbiera się wokół bohatera; wybuch: jasny dysk na cały promień (półprzezroczysty, G2).
    const charge = run.addFx('disc', p.x, p.y, C.orange, U.flareDelay);
    if (charge) { charge.r = r * 0.5; charge.a0 = 0.25; }
    const boom = () => {
      const d = run.addFx('disc', p.x, p.y, C.yellow, 0.5);
      if (d) { d.r = r; d.a0 = 0.4; }
      run.enemiesInCircle(p.x, p.y, r, (e) => run.damageEnemy(e, dmg, a.def.name, { kx: e.x - p.x, ky: e.y - p.y, knock: 6 }));
      const ring = run.addFx('ring', p.x, p.y, C.yellow, 0.4);
      if (ring) ring.r = r;
      // Promienie słońca od bohatera do brzegu i ogień na obwodzie (playtest 4: Rozbłysk wciąż słabo widoczny).
      for (let k = 0; k < 12; k++) {
        const ang = (k / 12) * Math.PI * 2 + 0.13, ray = run.addFx('line', p.x, p.y, k % 2 ? C.yellow : C.orange, 0.35);
        if (ray) { ray.x2 = p.x + Math.cos(ang) * r; ray.y2 = p.y + Math.sin(ang) * r; }
        run.burst(p.x + Math.cos(ang) * r * 0.92, p.y + Math.sin(ang) * r * 0.92, C.orange, 3, 50);
      }
      run.burst(p.x, p.y, C.orange, 30, 140);
      run.addShake(6);
      sfx.play('explode');
    };
    run.schedule(U.flareDelay, boom);
    if (a.def.evolved) run.schedule(U.flareDelay + 0.6, boom);
    run.showBanner(a.def.name + '!');
  },

  plague(run, a, P) {
    // Zaraza (Morwen): trucizna na wszystkich widocznych; zmarły zaraża sąsiadów (Run.killEnemy, budżet na rzucenie).
    const souls = spendSouls(run), U = BAL.altUlt;
    run.plagueDmg = P('damage') * U.plagueDmg * souls.mul * run.stats.might;
    run.plagueSpread = Math.max(1, Math.floor(P('count') / 2.5)) + (a.def.evolved ? 1 : 0);
    run.plagueLeft = U.plagueBudget + souls.extra * 10;
    run.plagueSlow = !!a.def.evolved;
    // Flaga `plague` = zarażony bieżącym rzuceniem (bez tego wrogowie z poprzedniej Zarazy, np. boss, byli pomijani).
    for (const e of run.enemies.items) e.plague = false;
    for (const e of run.enemies.items) if (onScreen(run, e)) run.plagueInfect(e, run.plagueSlow);
    run.burst(run.player.x, run.player.y, C.lime, 24, 120);
    run.showBanner(a.def.name + '!');
  },

  deathmark(run, a, P) {
    // Znak śmierci (Vesper): znakuje widocznych; po chwili każdy dostaje cięcie, poniżej progu ginie (bez bossów).
    const U = BAL.altUlt;
    // Ewolucja: mocniejsze cięcie i wyższy próg egzekucji.
    const evo = a.def.evolved ? 1.5 : 1;
    run.markDmg = P('damage') * U.markDmg * evo * run.stats.might;
    run.markExec = U.markExec + P('duration') * 0.015 + (a.def.evolved ? 0.05 : 0) + (run.hero.resource.kind === 'streak' ? resFrac(run) * U.markStreak : 0);
    run.markSrc = a.def.name;
    for (const e of run.enemies.items) if (!e.dead && onScreen(run, e)) e.markT = U.markDelay;
    run.showBanner(a.def.name + '!');
  },

  bastion(run, a, P) {
    // Bastion światła (Aurel): kopuła wokół bohatera niszczy pociski wrogów; Wiara ją wydłuża; na koniec wybuch światła.
    const faith = spendFaith(run, false), U = BAL.altUlt;
    run.bastionT = (U.bastionTime + P('count') * U.bastionPerCount) * faith.mul * run.stats.duration;
    run.bastionR = (P('radius') + P('blast')) * run.stats.area;
    run.bastionDmg = P('damage') * run.stats.might;
    run.bastionSrc = a.def.name;
    run.bastionEvo = !!a.def.evolved;
    run.showBanner(a.def.name + '!');
  },

  mushin(run, a, P) {
    // Mushin (Takezo): kilka sekund pewnego odbicia (Mikiri), kontry z limitem na sekundę; Rytm od razu pełny.
    const U = BAL.altUlt;
    // 3 s na 1. poziomie; każde +30 'dist' (poziomy, karta Jeden ruch) to +1 s, aż do limitu.
    run.mushinT = Math.min(U.mushinMax, 3 + (P('dist') - 150) / 30) * run.stats.duration;
    run.mushinDmg = P('damage') * U.mushinDmg * run.stats.might;
    run.mushinSrc = a.def.name;
    run.mushinEvo = !!a.def.evolved;
    rhythmGain(run, 999);
    const f = run.addFx('ring', run.player.x, run.player.y, C.cyan, 0.4);
    if (f) f.r = 30;
    run.showBanner(a.def.name + '!');
  },

  inferno(run, a, P) {
    a.activeT = P('duration') * run.stats.duration;
    run.showBanner(a.def.name + '!');
    run.addShake(4);
  },
};

/** Inferno: meteor w losowym punkcie wokół gracza (trafia najbliższego wroga w pobliżu tego punktu). */
function infernoStrike(run: Run, a: AbilityInst): void {
  const P = (k: string) => abilityParam(a.def, a.level, k) + run.flag(`${a.def.id}.${k}`);
  const p = run.player;
  const ang = rng.range(0, Math.PI * 2), d = Math.sqrt(rng.next()) * P('radius') * run.stats.area;
  let x = p.x + Math.cos(ang) * d, y = p.y + Math.sin(ang) * d;
  const e = run.nearestEnemy(x, y, 30);
  if (e) { x = e.x; y = e.y; }
  run.explode(x, y, P('blast') * run.stats.area, P('damage') * run.stats.might, a.def.name, C.orange, 3);
}

/** Czas odnowienia umiejętności po wszystkich modyfikatorach (cdr gracza + karty dla slotu). */
export function abilityMaxCd(run: Run, slot: AbilitySlot): number {
  const a = run.abilities[slot];
  return abilityCooldown(a.def, a.level) * BAL.cooldownMul(run.stats.cdr) * BAL.cooldownMul(run.flag(`cd.${slot}`));
}

/**
 * Użycie umiejętności. `free` = darmowe powtórzenie z efektu karty (Echo, Trzęsienie ziemi):
 * bez kosztu i bez ponownego wyzwalania hooków.
 */
export function castAbility(run: Run, slot: AbilitySlot, free = false): void {
  const a = run.abilities[slot];
  // Parametr = wartość z poziomu umiejętności + dodatki z kart (flaga "<id>.<parametr>").
  const P = (k: string) => abilityParam(a.def, a.level, k) + run.flag(`${a.def.id}.${k}`);
  if (!free) {
    if (slot === 'ult') {
      if (run.ultCharge < run.ultNeed() || a.activeT > 0) return;
      run.ultCharge = 0;
      run.ultUses++;
      run.ultAt = run.totalTime;
    } else {
      if (a.cd > 0) return;
      a.cd = abilityMaxCd(run, slot);
    }
  }
  CASTS[a.def.kind](run, a, P);
  if (a.def.evolved && !a.def.alt) EVO_EXTRA[a.def.id]?.(run, a, P);
  if (a.def.kind !== 'dash') sfx.play('ability');
  if (free) return;
  // Wyczyny Twardziel i Czysta broń.
  if (slot === 'dash') run.feat.dashes++;
  else if (slot === 'q' || slot === 'e') run.feat.casts++;
  resourceOnCast(run, slot);
  // Węzły Rozwoju (data/meta.ts, flagi): powtórzenie umiejętności, Przewrót skraca Q / zostawia Sieć, tarcza z Pierścienia.
  for (let i = 0; i < run.flag(`echo.${slot}`); i++) run.schedule(0.4 * (i + 1), () => castAbility(run, slot, true));
  if (slot === 'dash') {
    const reset = run.flag('dashResetQ');
    if (reset > 0) run.abilities.q.cd *= 1 - Math.min(1, reset);
    if (run.flag('dashSummon') > 0) spawnMinion(run, run.player.x, run.player.y, 14 * run.stats.might, 8, false, 'Cień');
    if (run.flag('dashNet') > 0) {
      const z = run.addZone('net', run.player.x, run.player.y, 26 * run.stats.area, 8 * run.stats.might, 2.5 * run.stats.duration, SLOT.e, 'Sidła');
      if (z) { z.slow = 0.6; z.tick = 30; }
    }
  }
  if (a.def.kind === 'firering' && run.flag('ringShield') > 0) run.addShield(run.stats.maxHp * run.flag('ringShield'), 0.3);
  // Echo mocy (pasywka): co N-te Q/E powtarza się za darmo.
  const hp = run.hero.passive;
  if (hp.kind === 'echoCast' && (slot === 'q' || slot === 'e')) {
    const every = Math.max(2, hp.value - run.flag('passive.n'));
    run.cardState.echoCast = (run.cardState.echoCast ?? 0) + 1;
    if (run.cardState.echoCast % every === 0) {
      run.schedule(0.35, () => castAbility(run, slot, true));
      run.popText(run.player.x, run.player.y - 14, 'Echo!', C.gold);
    }
  }
  run.emit('onAbilityCast', slot);
  if (a.def.kind === 'dash') run.emit('onDash');
}

/** Odliczanie, aktywacja z wejścia oraz efekty trwające (aura tytana). */
export function updateAbilities(run: Run, input: Input, dt: number): void {
  for (const slot of ORDER) {
    const a = run.abilities[slot];
    if (a.cd > 0) a.cd -= dt;
    if (a.activeT > 0) {
      a.activeT -= dt;
      if (a.def.kind === 'titan' && run.step % 30 === 0) {
        const p = run.player;
        const r = (abilityParam(a.def, a.level, 'radius') + run.flag(`${a.def.id}.radius`)) * run.stats.area;
        run.enemiesInCircle(p.x, p.y, r, (e) =>
          run.damageEnemy(e, (abilityParam(a.def, a.level, 'damage') + run.flag(`${a.def.id}.damage`)) * run.stats.might, a.def.name, { kx: e.x - p.x, ky: e.y - p.y, knock: 2 }));
        const f = run.addFx('ring', p.x, p.y, C.red, 0.2);
        if (f) f.r = r;
        // Awatar (ewolucja): leczenie 2% HP na sekundę (tick co pół sekundy).
        if (a.def.evolved) run.heal(run.stats.maxHp * 0.01);
      }
      // Inferno: meteor co 0.2 s (Kataklizm: dwa).
      if (a.def.kind === 'inferno' && run.step % 12 === 0) {
        infernoStrike(run, a);
        if (a.def.evolved) infernoStrike(run, a);
      }
      // Taniec ostrzy: cięcie co danceEvery kroków (Burza ostrzy: dwa).
      if (a.def.kind === 'bladedance' && run.step % BAL.resource.streak.danceEvery === 0) {
        danceStrike(run, a);
        if (a.def.evolved) danceStrike(run, a);
      }
      if (a.activeT <= 0) run.recomputeStats();
    }
  }
  if (input.pressed('q')) castAbility(run, 'q');
  if (input.pressed('e')) castAbility(run, 'e');
  if (input.pressed('dash')) castAbility(run, 'dash');
  if (input.pressed('ult')) castAbility(run, 'ult');
}
