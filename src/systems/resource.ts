import { C } from '../core/palette';
import { rng } from '../core/rng';
import { sfx } from '../core/audio';
import { BAL } from '../data/balance';
import type { AbilitySlot } from '../data/heroes';
import type { Enemy } from '../entities/types';
import type { Run } from '../game/run';
import { castAbility } from './abilities';
import { spawnMinion } from './minions';

/**
 * Zasoby bohaterów (HeroDef.resource, liczby w BAL.resource): stan w `run.res`, zdarzenia wołane z Run i umiejętności.
 * Karty i węzły: res.gain (szybszy przyrost), res.power (silniejszy efekt), res.max (większa pojemność),
 * heat.safe (przegrzanie nie rani), heat.vent (mocniejszy Wydech żaru), execKeep (Egzekucja zostawia część kombo).
 */
const R = BAL.resource;
/** Nazwa źródła obrażeń zrzutu żaru (Ignara). */
export const VENT_SRC = 'Wydech żaru';

export function resMax(run: Run): number {
  return R[run.hero.resource.kind].max + run.flag('res.max');
}

export function resFrac(run: Run): number {
  return Math.min(1, run.res / resMax(run));
}

function gain(run: Run, v: number): void {
  run.res = Math.min(resMax(run), run.res + v * (1 + run.flag('res.gain')));
}

const power = (run: Run) => 1 + run.flag('res.power');

/** Czy źródło to czar bohatera (Q, E, R — także po ewolucji, bo nazwa pochodzi z bieżącej definicji). */
function isSpell(run: Run, src: string): boolean {
  const a = run.abilities;
  return src === a.q.def.name || src === a.e.def.name || src === a.ult.def.name;
}

/** Mnożnik obrażeń zadawanych: furia (wszystko) i żar (czary). */
export function resourceDamageMul(run: Run, src: string): number {
  const k = run.hero.resource.kind;
  if (k === 'fury') return 1 + (run.rageT > 0 ? R.fury.rageMight : R.fury.might * resFrac(run)) * power(run);
  if (k === 'streak') return 1 + R.streak.might * resFrac(run) * power(run);
  if (k === 'heat' && isSpell(run, src)) return 1 + R.heat.spell * resFrac(run) * power(run);
  if (k === 'rhythm' && run.flowT > 0) return 1 + R.rhythm.flowDmg * power(run);
  return 1;
}

/** Dodatkowa szansa na krytyk z celności. */
export function resourceCrit(run: Run): number {
  return run.hero.resource.kind === 'focus' ? run.res * R.focus.crit * power(run) : 0;
}

/** Mnożnik otrzymywanych obrażeń (furia). */
export function resourceTakenMul(run: Run): number {
  return run.hero.resource.kind === 'fury' ? Math.max(0.3, 1 - R.fury.dr * (run.rageT > 0 ? 1 : resFrac(run)) * power(run)) : 1;
}

/** Trafienie wroga (bez obrażeń od stanów i procentowych): celność z dystansu, furia z bliska, kombo z każdego. */
export function resourceOnHit(run: Run, e: Enemy): void {
  const k = run.hero.resource.kind;
  if ((k !== 'focus' && k !== 'fury' && k !== 'streak' && k !== 'rhythm') || run.resGap > 0) return;
  if (k === 'rhythm') {
    run.resGap = R.rhythm.gap;
    rhythmGain(run, R.rhythm.hit);
    return;
  }
  if (k === 'streak') {
    run.resGap = R.streak.gap;
    const was = run.res;
    gain(run, 1);
    if (was < resMax(run) && run.res >= resMax(run)) run.popText(run.player.x, run.player.y - 14, 'Pełne kombo!', C.lavender);
    return;
  }
  const p = run.player, d2 = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
  if (k === 'focus') {
    const F = R.focus;
    if (d2 < F.range * F.range) return;
    run.resGap = F.gap;
    gain(run, 1);
    run.cardState['sec.falcon'] = (run.cardState['sec.falcon'] ?? 0) + 1;
    if (run.res < resMax(run)) return;
    // Pełna celność: darmowa Salwa (w następnym kroku — trafienie może być w środku zapytania o wrogów).
    run.res = resMax(run) * F.keep;
    run.schedule(0, () => castAbility(run, 'q', true));
    run.popText(p.x, p.y - 14, 'Celny strzał!', C.lime);
  } else {
    const F = R.fury;
    if (d2 > F.meleeR * F.meleeR) return;
    run.resGap = F.gap;
    furyGain(run, F.hit);
  }
}

/** Przyrost furii (poza Szałem); pełna wyzwala Szał. */
export function furyGain(run: Run, v: number): void {
  run.resIdle = 0;
  if (run.rageT > 0) return;
  gain(run, v);
  if (run.res < resMax(run)) return;
  const F = R.fury, p = run.player;
  run.rageT = run.rageMax = F.rage * (run.flag('furyHold') > 0 ? F.rageHold : 1);
  run.cardState['sec.berserk'] = (run.cardState['sec.berserk'] ?? 0) + 1;
  run.recomputeStats();
  run.popText(p.x, p.y - 16, 'Szał!', C.red);
  run.burst(p.x, p.y, C.red, 24, 80);
  run.addShake(3);
  sfx.play('boss');
}

/** Oberwanie: celność spada, furia rośnie (wg ułamka maks. HP). */
export function resourceOnHurt(run: Run, dmg: number): void {
  const k = run.hero.resource.kind;
  if (k === 'focus') {
    run.cardState['sec.falcon'] = 0;
    if (run.flag('focusKeep') <= 0) run.res *= 1 - R.focus.hurtLoss;
  }
  else if (k === 'fury') furyGain(run, (R.fury.hurt * 100 * dmg) / run.stats.maxHp);
  else if (k === 'streak') run.res = 0;
  else if (k === 'rhythm' && run.flowT === Infinity) {
    // Przepływ trwa do pierwszego trafienia; flaga rhythm.flow: jeszcze tyle sekund po trafieniu, potem opadanie.
    const grace = run.flag('rhythm.flow');
    run.flowT = run.flowMax = Math.max(0, grace);
    if (grace > 0) run.popText(run.player.x, run.player.y - 16, `Flow ${grace}s`, C.cyan);
    else breakRhythm(run);
  } else if (k === 'rhythm' && run.flowT <= 0 && run.res > 0 && !run.rhythmDrain) breakRhythm(run);
}

/** Rytm (0.43.3): trzyma się, dopóki nie oberwiesz — wtedy opada do zera (BAL.resource.rhythm.drain na sekundę), bez przyrostu. */
function breakRhythm(run: Run): void {
  run.flowT = 0;
  run.rhythmDrain = true;
  run.popText(run.player.x, run.player.y - 16, 'Rhythm broken', C.salmon);
}

/** Przyrost rytmu (Takezo, poza Przepływem); pełny pasek wyzwala Przepływ. */
export function rhythmGain(run: Run, v: number): void {
  if (run.hero.resource.kind !== 'rhythm' || run.flowT > 0 || run.rhythmDrain) return;
  gain(run, v);
  if (run.res < resMax(run)) return;
  // Przepływ: duża szybkość ataku i obrażenia, Tysiąc cięć od razu gotowy; pełny pasek trzyma się do trafienia (0.43.3).
  const p = run.player;
  run.flowT = run.flowMax = Infinity;
  run.abilities.e.cd = 0;
  run.popText(p.x, p.y - 16, 'Flow!', C.cyan);
  const f = run.addFx('ring', p.x, p.y, C.cyan, 0.4);
  if (f) f.r = 36;
  run.burst(p.x, p.y, C.cyan, 20, 80);
  sfx.play('streak');
}

/** Szybkość ataku z rytmu: przy budowaniu za punkt, w Przepływie stały duży bonus (broń w systems/weapons.ts, liczba cięć). */
export function rhythmAtk(run: Run): number {
  if (run.hero.resource.kind !== 'rhythm') return 0;
  return (run.flowT > 0 ? R.rhythm.flowAtk : run.res * R.rhythm.atk) * power(run);
}

/** Iai: poza Przepływem zużywa cały rytm (mnożnik za punkt), w Przepływie stały mnożnik i Przepływ trwa. */
export function spendRhythm(run: Run): number {
  if (run.hero.resource.kind !== 'rhythm') return 1;
  if (run.flowT > 0) return R.rhythm.flowIai * power(run);
  if (run.res < 1) return 1;
  const n = run.res;
  run.res = 0;
  if (n >= 5) run.popText(run.player.x, run.player.y - 16, `Rhythm x${Math.floor(n)}`, C.cyan);
  return 1 + R.rhythm.iai * n * power(run);
}

/** Egzekucja zużywa całe kombo: mnożnik obrażeń. */
export function spendStreak(run: Run): number {
  if (run.hero.resource.kind !== 'streak') return 1;
  const n = run.res;
  run.res = n * Math.min(0.9, run.flag('execKeep'));
  if (n >= 5) run.popText(run.player.x, run.player.y - 16, `Kombo x${Math.floor(n)}`, C.lavender);
  return 1 + R.streak.exec * n * power(run);
}

/** Leczenie (faktycznie odzyskane HP) daje wiarę. */
export function resourceOnHeal(run: Run, got: number): void {
  if (run.hero.resource.kind !== 'faith') return;
  faithGain(run, (R.faith.heal * 100 * got) / run.stats.maxHp);
}

/** Przyrost wiary; pełna zamienia się w Łaskę: leczenie i tarcza. */
function faithGain(run: Run, v: number): void {
  gain(run, v);
  if (run.res < resMax(run)) return;
  const F = R.faith, p = run.player;
  run.res -= F.grace;
  run.addShield(run.stats.maxHp * F.graceShield * power(run), 0.3);
  run.heal(run.stats.maxHp * F.graceHeal * power(run));
  const f = run.addFx('ring', p.x, p.y, C.yellow, 0.4);
  if (f) f.r = 40;
  run.burst(p.x, p.y, C.yellow, 20, 60);
  run.popText(p.x, p.y - 16, 'Łaska!', C.yellow);
  sfx.play('levelup');
}

/** Sąd zużywa wiarę (Sąd ostateczny zostawia część): mnożnik obrażeń i dodatkowe cele. */
export function spendFaith(run: Run, evolved: boolean): { mul: number; extra: number } {
  if (run.hero.resource.kind !== 'faith' || run.res < 1) return { mul: 1, extra: 0 };
  const F = R.faith, n = run.res;
  run.res = evolved ? n * F.keep : 0;
  return { mul: 1 + F.judgDmg * n * power(run), extra: Math.floor(n / F.judgExtra) };
}

/** Użycie umiejętności (bez darmowych powtórzeń): Q/E rozgrzewają, unik zrzuca żar. */
export function resourceOnCast(run: Run, slot: AbilitySlot): void {
  if (run.hero.resource.kind !== 'heat') return;
  if (slot === 'q' || slot === 'e') gain(run, R.heat.cast);
  else if (slot === 'dash') vent(run);
}

/** Wydech żaru: wybuch ognia wokół Ignary za cały zgromadzony żar. */
function vent(run: Run): void {
  const H = R.heat, heat = run.res;
  if (heat < H.ventMin) return;
  run.res = 0;
  const p = run.player, r = H.ventR * run.stats.area;
  const dmg = run.cardDamage(H.vent * heat) * power(run) * (1 + run.flag('heat.vent'));
  run.explode(p.x, p.y, r, dmg, VENT_SRC, C.orange, 5);
  run.addFire(p.x, p.y, r * 0.6, dmg * 0.08, 2 * run.stats.duration, VENT_SRC);
  run.popText(p.x, p.y - 14, 'Wydech!', C.orange);
}

/** Zabójstwo: dusze i wiara z wrogów ginących w pobliżu; pełne dusze zamieniają się w sługę. */
export function resourceOnKill(run: Run, e: Enemy): void {
  const k = run.hero.resource.kind, p = run.player;
  if (k === 'fury') {
    if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 <= (R.fury.meleeR * 1.5) ** 2) furyGain(run, R.fury.kill);
    return;
  }
  if (k === 'faith') {
    if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 <= R.faith.range ** 2) faithGain(run, e.boss ? 10 : e.elite ? 3 : 1);
    return;
  }
  if (k !== 'souls') return;
  const S = R.souls;
  if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 > S.range * S.range) return;
  gain(run, e.boss ? 10 : e.elite ? 3 : 1);
  if (run.res < resMax(run)) return;
  run.res -= S.auto;
  spawnMinion(run, e.x, e.y, run.cardDamage(BAL.minions.passiveDmg) * power(run), BAL.minions.passiveLife, false, run.hero.resource.name);
}

/** Armia umarłych zużywa wszystkie dusze: mnożnik obrażeń sług i dodatkowi wojownicy. */
export function spendSouls(run: Run): { mul: number; extra: number } {
  if (run.hero.resource.kind !== 'souls' || run.res < 1) return { mul: 1, extra: 0 };
  const S = R.souls, n = run.res;
  run.res = 0;
  run.popText(run.player.x, run.player.y - 16, `Dusze: ${Math.floor(n)}`, C.pink);
  return { mul: 1 + S.ultDmg * n * power(run), extra: Math.floor(n / S.ultExtra) };
}

/** Odliczanie, opadanie furii poza walką, stygnięcie i przegrzanie żaru. */
export function updateResource(run: Run, dt: number): void {
  run.resGap = Math.max(0, run.resGap - dt);
  run.resIdle += dt;
  const k = run.hero.resource.kind;
  if (k === 'fury') {
    // Szał: pasek odlicza pozostały czas, po końcu furia od zera.
    if (run.rageT > 0) {
      run.rageT = Math.max(0, run.rageT - dt);
      run.res = (resMax(run) * run.rageT) / run.rageMax;
      if (run.rageT <= 0) run.recomputeStats();
    } else if (run.resIdle > R.fury.idle && run.flag('furyHold') <= 0) run.res = Math.max(0, run.res - R.fury.decay * dt);
  }
  if (k === 'rhythm' && run.flowT === Infinity) run.res = resMax(run);
  else if (k === 'rhythm' && run.flowT > 0) {
    // Ostatnie sekundy Przepływu po trafieniu (flaga rhythm.flow); potem pasek opada od pełnego.
    run.flowT = Math.max(0, run.flowT - dt);
    if (run.flowT <= 0) { run.res = resMax(run); run.rhythmDrain = true; }
  } else if (k === 'rhythm' && run.rhythmDrain) {
    run.res = Math.max(0, run.res - R.rhythm.drain * dt);
    if (run.res <= 0) run.rhythmDrain = false;
  }
  if (k !== 'heat') return;
  const H = R.heat, p = run.player;
  run.res = Math.max(0, run.res - H.decay * dt);
  if (run.res <= H.burnFrom) return;
  run.cardState['sec.pyre'] = (run.cardState['sec.pyre'] ?? 0) + dt;
  if (run.step % 6 === 0) run.burst(p.x + rng.range(-3, 3), p.y - 4, rng.chance(0.5) ? C.orange : C.gold, 1, 30);
  if (run.flag('heat.safe') > 0) return;
  p.hp = Math.max(1, p.hp - run.stats.maxHp * H.burn * dt);
  if (run.step % 40 === 0) { p.flash = 3; sfx.play('burn'); }
}
