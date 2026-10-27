import { rng } from '../core/rng';
import { C } from '../core/palette';
import { BAL } from '../data/balance';
import { WEAPONS, WEAPON_BY_ID, maxLevel, describeLevel, type WeaponDef } from '../data/weapons';
import { PASSIVES, PASSIVE_BY_ID } from '../data/passives';
import { describeAbilityLevel, evolveAbility, type AbilitySlot } from '../data/heroes';
import type { Run } from '../game/run';
import type { Tag } from '../data/cards';
import type { Stats } from '../entities/types';
import { WEAPON_TAGS, STAT_TAG, SYNERGY_BY_TAG, tierOf } from '../data/synergies';
import { ELEMENTS, WEAPON_ELEMENT } from '../data/elements';

/** 'stat' = mała stała premia statystyki (gdy w puli zabrakło ulepszeń, BAL.statBoosts). */
export type OptionKind = 'weaponNew' | 'weaponUp' | 'passiveNew' | 'passiveUp' | 'ability' | 'abilityEvolve' | 'evolve' | 'stat';

/** Jedna karta wyboru przy awansie. */
export interface Option {
  kind: OptionKind;
  id: string;
  name: string;
  desc: string;
  /** Podpowiedź pod opisem (ewolucje, poziom). */
  hint: string;
  icon: string;
  tag: string;
  color: number;
  /** Tagi synergii, które ta opcja wzmacnia. */
  tags: Tag[];
}

/** Nowa pasywka daje punkt tagu swojej statystyki (kolejne poziomy już nie). */
const tagsOf = (stat: keyof Stats): Tag[] => (STAT_TAG[stat] ? [STAT_TAG[stat]!] : []);

const WEIGHTS: Record<OptionKind, number> = {
  evolve: 6, abilityEvolve: 6, weaponUp: 2.2, passiveUp: 1.4, ability: 1.6, weaponNew: 1.2, passiveNew: 1, stat: 1,
};

/** Podpowiedź ewolucji dla broni: jaka pasywka jest potrzebna. */
function evolveHint(run: Run, def: WeaponDef): string {
  const ev = def.evolve;
  if (!ev) return '';
  const p = PASSIVE_BY_ID[ev.passive];
  const has = run.passives.some((x) => x.id === ev.passive);
  return `Ewolucja: max poziom + ${p.name}${has ? ' (masz)' : ''}`;
}

/** Podpowiedź dla pasywki: którą posiadaną broń pozwala rozwinąć w ewolucję. */
function passiveHint(run: Run, id: string): string {
  const w = run.weapons.find((x) => x.def.evolve?.passive === id);
  return w ? `Potrzebna do ewolucji: ${w.def.name}` : '';
}

/** Wszystkie możliwe ulepszenia w obecnym stanie runu. */
function candidates(run: Run): Option[] {
  const out: Option[] = [];
  const ownedW = new Set(run.weapons.map((w) => w.def.id));
  // Broń bazowa, której ewolucję już masz, nie wraca do oferty.
  for (const d of WEAPONS) if (d.evolve && ownedW.has(d.evolve.into)) ownedW.add(d.id);
  const ownedP = new Map(run.passives.map((p) => [p.id, p.level]));

  for (const w of run.weapons) {
    const ev = w.def.evolve;
    if (w.level >= maxLevel(w.def) && ev && ownedP.has(ev.passive)) {
      const into = WEAPON_BY_ID[ev.into];
      out.push({ kind: 'evolve', id: w.def.id, name: into.name, desc: into.desc, hint: `Zastępuje: ${w.def.name}`, icon: into.icon, tag: 'Ewolucja', color: into.color, tags: WEAPON_TAGS[into.kind] });
    } else if (w.level < maxLevel(w.def)) {
      out.push({ kind: 'weaponUp', id: w.def.id, name: w.def.name, desc: describeLevel(w.def, w.level + 1), hint: evolveHint(run, w.def), icon: w.def.icon, tag: `Poziom ${w.level + 1}/${maxLevel(w.def)}`, color: w.def.color, tags: [] });
    }
  }
  if (run.weapons.length < BAL.weaponSlots) {
    for (const d of WEAPONS) {
      if (d.evolved || ownedW.has(d.id) || run.banished.has(d.id) || (d.hero && d.hero !== run.hero.id)) continue;
      const el = WEAPON_ELEMENT[d.id];
      const desc = el ? `${d.desc} Żywioł: ${ELEMENTS[el].name} (${ELEMENTS[el].desc}).` : d.desc;
      out.push({ kind: 'weaponNew', id: d.id, name: d.name, desc, hint: evolveHint(run, d), icon: d.icon, tag: 'Nowa broń', color: d.color, tags: WEAPON_TAGS[d.kind] });
    }
  }
  for (const p of run.passives) {
    const d = PASSIVE_BY_ID[p.id];
    if (p.level < d.maxLevel) out.push({ kind: 'passiveUp', id: d.id, name: d.name, desc: d.desc, hint: passiveHint(run, d.id), icon: d.icon, tag: `Poziom ${p.level + 1}/${d.maxLevel}`, color: C.white, tags: [] });
  }
  if (run.passives.length < BAL.passiveSlots) {
    for (const d of PASSIVES) {
      if (ownedP.has(d.id) || run.banished.has(d.id)) continue;
      out.push({ kind: 'passiveNew', id: d.id, name: d.name, desc: d.desc, hint: passiveHint(run, d.id), icon: d.icon, tag: 'Nowa pasywka', color: C.white, tags: tagsOf(d.stat) });
    }
  }
  for (const slot of ['q', 'e', 'ult'] as AbilitySlot[]) {
    const a = run.abilities[slot];
    const key = slot === 'ult' ? 'R' : slot.toUpperCase();
    const evo = a.def.evo;
    if (a.level >= a.def.maxLevel) {
      // Ewolucja umiejętności: maks. poziom + aktywna synergia z jej opisu.
      if (evo && (run.synTiers[evo.tag] ?? 0) > 0) out.push({ kind: 'abilityEvolve', id: slot, name: `${evo.name} [${key}]`, desc: evo.desc, hint: `Zastępuje: ${a.def.name}`, icon: evo.icon, tag: 'Ewolucja', color: a.def.color, tags: [] });
      continue;
    }
    const hint = evo ? `Ewolucja: max poziom + synergia ${evo.tag}` : '';
    out.push({ kind: 'ability', id: slot, name: `${a.def.name} [${key}]`, desc: describeAbilityLevel(a.def), hint, icon: a.def.icon, tag: `Poziom ${a.level + 1}/${a.def.maxLevel}`, color: a.def.color, tags: [] });
  }
  return out;
}

/** Czy +1 punkt tego tagu osiągnie nowy próg synergii. */
export function reachesThreshold(run: Run, t: Tag): boolean {
  const def = SYNERGY_BY_TAG[t];
  return tierOf(def, run.tagPts[t] + 1) > tierOf(def, run.tagPts[t]);
}

/**
 * Ocena opcji dla podpowiedzi "Polecane": ewolucja > nowy próg synergii > krok do ewolucji
 * > rozwój posiadanej broni > reszta. Prosta heurystyka — ma pomóc, nie grać za gracza.
 */
export function optionScore(run: Run, o: Option): number {
  let s = { evolve: 100, abilityEvolve: 95, weaponUp: 22, weaponNew: 16, ability: 14, passiveNew: 12, passiveUp: 10, stat: 0 }[o.kind];
  if (o.tags.some((t) => reachesThreshold(run, t))) s += 40;
  if (o.hint.startsWith('Potrzebna do ewolucji') || o.hint.endsWith('(masz)')) s += 25;
  return s;
}

const key = (o: Option) => `${o.kind}:${o.id}`;

/** Opcje premii statystyk (BAL.statBoosts) — dopełniają ofertę, gdy zabrakło ulepszeń. */
function statOptions(): Option[] {
  return BAL.statBoosts.map((b) => ({
    kind: 'stat' as const, id: String(b.stat), name: b.name, desc: b.desc, hint: 'Wszystko rozwinięte: stała premia', icon: b.icon, tag: 'Premia', color: C.lgray, tags: [],
  }));
}

/**
 * Losuje `count` różnych opcji (ważonych). Dostępna ewolucja jest zawsze wśród nich
 * (dawniej gwarantowała ją skrzynia, która teraz daje przedmioty). Brakujące miejsca dopełniają premie statystyk.
 */
export function generateOptions(run: Run, count: number, exclude: Option[] = []): Option[] {
  const pool = candidates(run).filter((o) => !exclude.some((x) => key(x) === key(o)));
  const evo = pool.find((o) => o.kind === 'evolve' || o.kind === 'abilityEvolve');
  const out: Option[] = evo ? pool.splice(pool.indexOf(evo), 1) : [];
  while (out.length < count && pool.length) {
    const pick = rng.weighted(pool.map((o) => [o, WEIGHTS[o.kind]] as const));
    out.push(pick);
    pool.splice(pool.indexOf(pick), 1);
  }
  const stats = statOptions().filter((o) => !exclude.some((x) => key(x) === key(o)));
  while (out.length < count && stats.length) out.push(stats.splice(Math.floor(rng.next() * stats.length), 1)[0]);
  return out;
}

/** Banować można tylko nowe przedmioty (nie wyrzuca się czegoś, co już masz). */
export function canBanish(o: Option): boolean {
  return o.kind === 'weaponNew' || o.kind === 'passiveNew';
}

export function applyOption(run: Run, o: Option): void {
  switch (o.kind) {
    case 'weaponNew':
      run.addWeapon(o.id);
      break;
    case 'weaponUp':
      run.weapons.find((w) => w.def.id === o.id)!.level++;
      break;
    case 'evolve': {
      const w = run.weapons.find((x) => x.def.id === o.id)!;
      const into = w.def.evolve!.into;
      if (run.basicWeaponId === w.def.id) run.basicWeaponId = into;
      w.def = WEAPON_BY_ID[into];
      w.level = 1;
      break;
    }
    case 'passiveNew':
      run.passives.push({ id: o.id, level: 1 });
      break;
    case 'passiveUp':
      run.passives.find((p) => p.id === o.id)!.level++;
      break;
    case 'ability':
      run.abilities[o.id as AbilitySlot].level++;
      break;
    case 'abilityEvolve': {
      const a = run.abilities[o.id as AbilitySlot];
      a.def = evolveAbility(a.def);
      break;
    }
    case 'stat': {
      const b = BAL.statBoosts.find((x) => String(x.stat) === o.id)!;
      run.addBonus(b.stat, b.value);
      break;
    }
  }
  // Nowa broń / pasywka / ewolucja zmienia punkty synergii.
  run.onBuildChanged();
}
