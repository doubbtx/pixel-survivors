import type { Input } from '../core/input';
import { sfx } from '../core/audio';
import { C } from '../core/palette';
import { rng } from '../core/rng';
import { BAL } from '../data/balance';
import { abilityParam, abilityCooldown, type AbilityKind, type AbilitySlot } from '../data/heroes';
import { SLOT, type AbilityInst } from '../entities/types';
import type { Run } from '../game/run';
import { spawnMinion } from './minions';

const ORDER: AbilitySlot[] = ['q', 'e', 'dash', 'ult'];

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

/** Dodatkowe efekty umiejętności po ewolucji (po zwykłym użyciu), wg id umiejętności. */
const EVO_EXTRA: Record<string, Cast> = {
  // Burza strzał: druga salwa po chwili.
  k_volley: (run, a, P) => run.schedule(0.3, () => CASTS.volley(run, a, P)),
  // Lodowa sieć: zamrożenie wrogów w środku.
  k_net: (run, _a, P) => {
    const [x, y] = aimPoint(run, P('range'));
    run.enemiesInCircle(x, y, P('radius') * run.stats.area, (e) => { e.stunT = Math.max(e.stunT, e.boss ? 0.3 : 1.5); });
  },
  // Nawałnica z nieba: drugi grad wokół gracza.
  k_rain: (run, a, P) => {
    const z = run.addZone('rain', run.player.x, run.player.y, P('radius') * run.stats.area * 0.8, P('damage') * run.stats.might, P('duration') * run.stats.duration, SLOT.ult, a.def.name);
    if (z) z.tick = 15;
  },
  // Taran tytana: fala uderzeniowa na końcu szarży.
  b_charge: (run, a, P) => run.schedule(0.22, () => run.explode(run.player.x, run.player.y, 40 * run.stats.area, P('damage') * run.stats.might, a.def.name, C.orange, 6)),
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
    const dist = P('dist');
    const dur = 0.2;
    // Obrażenia na całej trasie od razu; samo przemieszczenie trwa `dur`.
    for (let d = 0; d <= dist; d += 8) {
      run.enemiesInCircle(p.x + dx * d, p.y + dy * d, P('width'), (e) => {
        if (e.hitStamp[SLOT.q] === run.step) return;
        e.hitStamp[SLOT.q] = run.step;
        run.damageEnemy(e, P('damage') * run.stats.might, a.def.name, { kx: e.x - p.x, ky: e.y - p.y, knock: 5, stun: P('stun') });
      });
    }
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
    for (let i = 0; i < Math.round(P('count')); i++) spawnMinion(run, p.x, p.y, P('damage') * run.stats.might, P('duration'), true, a.def.name, !!a.def.evolved);
    run.showBanner(a.def.name + '!');
    run.addShake(5);
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
    } else {
      if (a.cd > 0) return;
      a.cd = abilityMaxCd(run, slot);
    }
  }
  CASTS[a.def.kind](run, a, P);
  if (a.def.evolved) EVO_EXTRA[a.def.id]?.(run, a, P);
  if (a.def.kind !== 'dash') sfx.play('ability');
  if (free) return;
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
      if (a.activeT <= 0) run.recomputeStats();
    }
  }
  if (input.pressed('q')) castAbility(run, 'q');
  if (input.pressed('e')) castAbility(run, 'e');
  if (input.pressed('dash')) castAbility(run, 'dash');
  if (input.pressed('ult')) castAbility(run, 'ult');
}
