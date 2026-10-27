import { Rng } from '../core/rng';
import { HEROES } from './heroes';
import { PACTS } from './pacts';

/**
 * Wyzwanie dnia: jeden poziom treningowy z bohaterem, paktami i ziarnem losowania wyliczonymi z daty —
 * ten sam zestaw dla każdego gracza tego dnia. Wynik = czas pokonania bossa (najlepszy w `save.daily`).
 */
export interface DailyDef {
  date: string;
  seed: number;
  hero: string;
  pacts: Record<string, number>;
}

/** Data w formacie RRRR-MM-DD (czas lokalny). */
export function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function dailyOf(date: string): DailyDef {
  let seed = 0;
  for (const ch of date) seed = (Math.imul(seed, 31) + ch.charCodeAt(0)) >>> 0;
  const r = new Rng(seed);
  const hero = r.pick(HEROES).id;
  // Dwa różne pakty po 1-2 poziomy.
  const pool = [...PACTS];
  const pacts: Record<string, number> = {};
  for (let i = 0; i < 2; i++) {
    const p = pool.splice(r.int(0, pool.length - 1), 1)[0];
    pacts[p.id] = Math.min(p.max, r.int(1, 2));
  }
  return { date, seed, hero, pacts };
}
