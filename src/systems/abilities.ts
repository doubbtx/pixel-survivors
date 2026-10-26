import type { Input } from '../core/input';
import { sfx } from '../core/audio';
import { C } from '../core/palette';
import { BAL } from '../data/balance';
import { abilityParam, abilityCooldown, type AbilityKind, type AbilitySlot } from '../data/heroes';
import { SLOT, type AbilityInst } from '../entities/types';
import type { Run } from '../game/run';

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
};

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
      if (a.activeT <= 0) run.recomputeStats();
    }
  }
  if (input.pressed('q')) castAbility(run, 'q');
  if (input.pressed('e')) castAbility(run, 'e');
  if (input.pressed('dash')) castAbility(run, 'dash');
  if (input.pressed('ult')) castAbility(run, 'ult');
}
