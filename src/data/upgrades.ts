import { rng } from '../core/rng';
import { BAL } from './balance';
import { WEAPON_ELEMENT } from './elements';
import type { WeaponDef } from './weapons';

/**
 * Jakość ulepszeń broni przy awansie (Zwykłe → Legendarne, kolory i nazwy jak RARITIES przedmiotów).
 * Zwykłe daje sam poziom broni, każda wyższa jakość dokłada kolejny bonus z puli tej broni (do 4 przy Legendarnym),
 * a wartości rosną z jakością. Bonusy sumują się na broni (WeaponInst.bonus) i zostają po ewolucji.
 * Liczby: BAL.weaponQuality.
 */
export type WBonusKey = 'dmg' | 'atk' | 'area' | 'proj' | 'amount' | 'crit' | 'elem';
export type WeaponBonus = Partial<Record<WBonusKey, number>>;

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** Opis bonusu (wartość już zsumowana albo pojedyncza). */
export const WB_LABEL: Record<WBonusKey, (v: number) => string> = {
  dmg: (v) => `+${pct(v)} obrażeń`,
  atk: (v) => `+${pct(v)} szybkości ataku`,
  area: (v) => `+${pct(v)} obszaru`,
  proj: (v) => `+${pct(v)} szybkości pocisków`,
  amount: (v) => `+${v} pocisk`,
  crit: (v) => `+${pct(v)} szansy na krytyk`,
  elem: (v) => `+${pct(v)} siły żywiołu`,
};

/** Krótki opis do pauzy (pod bronią). */
export const WB_SHORT: Record<WBonusKey, (v: number) => string> = {
  dmg: (v) => `obr+${pct(v)}`,
  atk: (v) => `atk+${pct(v)}`,
  area: (v) => `obsz+${pct(v)}`,
  proj: (v) => `lot+${pct(v)}`,
  amount: (v) => `+${v} poc`,
  crit: (v) => `kryt+${pct(v)}`,
  elem: (v) => `żyw+${pct(v)}`,
};

/** Losuje jakość: wagi BAL.weaponQuality.weights, Szczęście podnosi wagi wyższych jakości. */
export function rollQuality(luck: number): number {
  const Q = BAL.weaponQuality;
  return rng.weighted(Q.weights.map((w, q) => [q, w * (1 + Math.max(0, luck) * Q.luckMul * q)] as const));
}

/** Pula bonusów broni: szybkość pocisków tylko dla broni z pociskami, siła żywiołu dla broni z żywiołem, +1 pocisk od Epickiego. */
function poolFor(def: WeaponDef, q: number): WBonusKey[] {
  const out: WBonusKey[] = ['dmg', 'atk', 'area', 'crit'];
  if (def.kind === 'bolt' || def.kind === 'boomerang') out.push('proj');
  if (WEAPON_ELEMENT[def.id]) out.push('elem');
  if (q >= BAL.weaponQuality.amountFrom) out.push('amount');
  return out;
}

/** Bonusy ulepszenia jakości `q` (q różnych z puli broni, wartości wg jakości). */
export function rollWeaponBonus(def: WeaponDef, q: number): WeaponBonus {
  const pool = poolFor(def, q);
  const b: WeaponBonus = {};
  for (let n = 0; n < q && pool.length; n++) {
    const k = pool.splice(Math.floor(rng.next() * pool.length), 1)[0];
    b[k] = BAL.weaponQuality.values[k][q];
  }
  return b;
}

export function addWeaponBonus(into: WeaponBonus, b: WeaponBonus): void {
  for (const [k, v] of Object.entries(b) as [WBonusKey, number][]) into[k] = (into[k] ?? 0) + v;
}

export const bonusLines = (b: WeaponBonus, short = false): string[] =>
  (Object.entries(b) as [WBonusKey, number][]).filter(([, v]) => v).map(([k, v]) => (short ? WB_SHORT : WB_LABEL)[k](v));
