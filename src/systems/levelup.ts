import { rng } from '../core/rng';
import { C } from '../core/palette';
import { BAL } from '../data/balance';
import { WEAPONS, WEAPON_BY_ID, FUSIONS, fusionOf, maxLevel, describeLevel, evolvesOf, type WeaponDef } from '../data/weapons';
import type { WeaponInst } from '../entities/types';
import { PASSIVES, PASSIVE_BY_ID } from '../data/passives';
import { describeAbilityLevel, evolveAbility, type AbilitySlot } from '../data/heroes';
import type { Run } from '../game/run';
import type { Tag } from '../data/cards';
import type { Stats } from '../entities/types';
import { weaponTags, STAT_TAG, SYNERGY_BY_TAG, tierOf } from '../data/synergies';
import { ELEMENTS, WEAPON_ELEMENT } from '../data/elements';
import { AUGMENTS, weaponBase, augmentWorks, fusionAugments } from '../data/augments';
import { rollQuality, rollWeaponBonus, addWeaponBonus, bonusLines, type WeaponBonus } from '../data/upgrades';
import { RARITIES } from '../data/items';

/**
 * 'stat' = mała stała premia statystyki (gdy w puli zabrakło ulepszeń, BAL.statBoosts); 'augment' = augment broni (data/augments.ts);
 * 'fusion' = połączenie dwóch broni w hybrydę (data/weapons.ts FUSIONS, `id` = id hybrydy).
 */
export type OptionKind = 'weaponNew' | 'weaponUp' | 'passiveNew' | 'passiveUp' | 'passiveEvolve' | 'ability' | 'abilityEvolve' | 'evolve' | 'fusion' | 'augment' | 'stat';

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
  /** Ulepszenie broni: jakość (0-4, data/upgrades.ts) i wylosowane bonusy. */
  quality?: number;
  /** Przepis ewolucji / fuzji do pokazania ikonami na karcie: składniki i wynik. */
  recipe?: Recipe;
  bonus?: WeaponBonus;
  /** Pasywka: ścieżki ewolucji, które otwiera (ikony broni bazowej i ewolucji) — karta rysuje je obrazkami zamiast napisu. */
  evolves?: [string, string][];
}

/** Nowa pasywka daje punkt tagu swojej statystyki (kolejne poziomy już nie). */
const tagsOf = (stat: keyof Stats): Tag[] => (STAT_TAG[stat] ? [STAT_TAG[stat]!] : []);

const WEIGHTS: Record<OptionKind, number> = {
  evolve: 6, abilityEvolve: 6, passiveEvolve: 6, fusion: 6, weaponUp: 2.2, passiveUp: 1.4, ability: 1.6, weaponNew: 1.2, passiveNew: 1, augment: 1.1, stat: 1,
};

/** Przepis: ikony składników i ikona wyniku (karta awansu rysuje „A + B → C”). */
export interface Recipe {
  parts: string[];
  result: string;
}

/** Przepis broni: fuzja z posiadaną bronią (gdy jest), inaczej ewolucja (broń + pasywka). */
function weaponRecipe(run: Run, def: WeaponDef): Recipe | undefined {
  const base = weaponBase(def);
  for (const f of FUSIONS) {
    const other = f.a === base ? f.b : f.b === base ? f.a : '';
    const w = other ? ownedBase(run, other) : undefined;
    if (w && w.def !== def) return { parts: [def.icon, w.def.icon], result: WEAPON_BY_ID[f.into].icon };
  }
  // Ewolucja: najpierw ta, do której masz już pasywkę.
  const evs = evolvesOf(def), ev = evs.find((e) => run.passives.some((p) => p.id === e.passive)) ?? evs[0];
  return ev ? { parts: [def.icon, PASSIVE_BY_ID[ev.passive].icon], result: WEAPON_BY_ID[ev.into].icon } : undefined;
}

/** Ścieżki ewolucji przez pasywkę `id` dla broni dostępnych temu bohaterowi (broń bazowa → ewolucja). */
export function passiveEvolves(id: string, hero?: string): { base: WeaponDef; into: WeaponDef }[] {
  const out: { base: WeaponDef; into: WeaponDef }[] = [];
  for (const w of WEAPONS) {
    if (hero && w.hero && w.hero !== hero) continue;
    for (const e of evolvesOf(w)) if (e.passive === id) out.push({ base: w, into: WEAPON_BY_ID[e.into] });
  }
  return out;
}

/** Przepis pasywki: posiadana broń, którą ta pasywka ewoluuje. */
function passiveRecipe(run: Run, id: string): Recipe | undefined {
  for (const w of run.weapons) {
    const e = evolvesOf(w.def).find((x) => x.passive === id);
    if (e) return { parts: [w.def.icon, PASSIVE_BY_ID[id].icon], result: WEAPON_BY_ID[e.into].icon };
  }
  return undefined;
}

/** Podpowiedź ewolucji dla broni: które pasywki ją ewoluują (posiadana z dopiskiem). */
function evolveHint(run: Run, def: WeaponDef): string {
  const evs = evolvesOf(def);
  if (!evs.length) return '';
  const names = evs.map((e) => `${PASSIVE_BY_ID[e.passive].name}${run.passives.some((x) => x.id === e.passive) ? ' (masz)' : ''}`);
  return `Ewolucja: max poziom + ${names.join(' / ')}`;
}

/** Ikony ścieżek ewolucji pasywki dla bohatera runu: [broń bazowa, ewolucja]. */
function evoIcons(run: Run, id: string): [string, string][] {
  return passiveEvolves(id, run.hero.id).map((x) => [x.base.icon, x.into.icon]);
}

/** Czy pasywka może ewoluować: maks. poziom i jedna z broni, które ewoluuje, jest już po tej ewolucji. */
function passiveEvoReady(run: Run, id: string, level: number): boolean {
  const d = PASSIVE_BY_ID[id];
  if (level < d.maxLevel) return false;
  return run.weapons.some((w) => passiveEvolves(id).some((x) => x.into.id === w.def.id));
}

/** Broń gotowa do fuzji: na maks. poziomie albo po ewolucji (hybryda już nie łączy się dalej). */
const fusionReady = (w: WeaponInst) => !w.def.fused && (!!w.def.evolved || w.level >= maxLevel(w.def));

/** Posiadana broń o danym id bazowym (także po ewolucji). */
const ownedBase = (run: Run, base: string) => run.weapons.find((w) => weaponBase(w.def) === base);

/** Podpowiedź fuzji: z którą posiadaną bronią ta broń może się połączyć (pierwsza pasująca receptura). */
function fusionHint(run: Run, def: WeaponDef): string {
  const base = weaponBase(def);
  for (const f of FUSIONS) {
    const other = f.a === base ? f.b : f.b === base ? f.a : '';
    const w = other ? ownedBase(run, other) : undefined;
    if (w && w.def !== def) return `Fuzja z: ${w.def.name} (obie na max)`;
  }
  return '';
}

/** Podpowiedź dla pasywki: którą posiadaną broń pozwala rozwinąć w ewolucję. */
function passiveHint(run: Run, id: string): string {
  const w = run.weapons.find((x) => evolvesOf(x.def).some((e) => e.passive === id));
  return w ? `Potrzebna do ewolucji: ${w.def.name}` : '';
}

/** Wszystkie możliwe ulepszenia w obecnym stanie runu. */
function candidates(run: Run): Option[] {
  const out: Option[] = [];
  const ownedW = new Set(run.weapons.map((w) => w.def.id));
  // Broń bazowa, której ewolucję albo fuzję już masz, nie wraca do oferty.
  for (const d of WEAPONS) if (evolvesOf(d).some((e) => ownedW.has(e.into))) ownedW.add(d.id);
  for (const f of FUSIONS) if (ownedW.has(f.into)) { ownedW.add(f.a); ownedW.add(f.b); }
  const ownedP = new Map(run.passives.map((p) => [p.id, p.level]));

  for (const w of run.weapons) {
    const evs = evolvesOf(w.def);
    // Każda ścieżka z posiadaną pasywką to osobna opcja (id = ewolucja); Wierność broni: ewolucja podstawowa bez pasywki.
    const ready = w.level >= maxLevel(w.def) ? evs.filter((e, i) => ownedP.has(e.passive) || (i === 0 && run.loyal > 0)) : [];
    if (ready.length) {
      for (const ev of ready) {
        const into = WEAPON_BY_ID[ev.into];
        out.push({ kind: 'evolve', id: ev.into, name: into.name, desc: into.desc, hint: `Zastępuje: ${w.def.name}`, icon: into.icon, tag: 'Ewolucja', color: into.color, tags: weaponTags(into), recipe: { parts: [w.def.icon, PASSIVE_BY_ID[ev.passive].icon], result: into.icon } });
      }
    } else if (w.level < maxLevel(w.def)) {
      // Jakość ulepszenia: dodatkowe bonusy broni (Szczęście podnosi szansę na lepszą).
      const q = rollQuality(run.luck()), bonus = rollWeaponBonus(w.def, q);
      const extra = bonusLines(bonus);
      const desc = describeLevel(w.def, w.level + 1) + (extra.length ? `. Bonus: ${extra.join(', ')}` : '');
      out.push({ kind: 'weaponUp', id: w.def.id, name: w.def.name, desc, hint: fusionHint(run, w.def) || evolveHint(run, w.def), icon: w.def.icon, tag: `${q ? RARITIES[q].name.pl : 'Poziom'} ${w.level + 1}/${maxLevel(w.def)}`, color: q ? RARITIES[q].color : w.def.color, tags: [], quality: q, bonus, recipe: weaponRecipe(run, w.def) });
    }
  }
  // Fuzje: obie bronie-rodzice gotowe.
  for (const f of FUSIONS) {
    const a = ownedBase(run, f.a), b = ownedBase(run, f.b), into = WEAPON_BY_ID[f.into];
    if (!a || !b || !fusionReady(a) || !fusionReady(b) || run.weapons.some((w) => w.def.id === f.into)) continue;
    const { kept, lost } = fusionAugments(into), has = (l: typeof kept) => l.filter((x) => run.aug(x.id)).map((x) => x.name);
    const augNote = `${has(kept).length ? ` Zostają: ${has(kept).join(', ')}.` : ''}${has(lost).length ? ` Przepadną: ${has(lost).join(', ')}.` : ''}`;
    out.push({ kind: 'fusion', id: f.into, name: into.name, desc: into.desc + augNote, hint: `Łączy: ${a.def.name} + ${b.def.name}, zwalnia slot`, icon: into.icon, tag: 'Fuzja', color: into.color, tags: [], recipe: { parts: [a.def.icon, b.def.icon], result: into.icon } });
  }
  // Augmenty: broń od BAL.augmentMinLevel (ewolucja zawsze), każdy augment raz.
  for (const w of run.weapons) {
    if (!w.def.evolved && w.level < BAL.augmentMinLevel) continue;
    for (const a of AUGMENTS) {
      if (!augmentWorks(a, w.def) || run.aug(a.id)) continue;
      const el = a.elem ? ` Żywioł: ${ELEMENTS[a.elem].name}.` : '';
      out.push({ kind: 'augment', id: a.id, name: a.name, desc: a.desc + el, hint: `Augment broni: ${w.def.name}`, icon: w.def.icon, tag: 'Augment', color: C.cyan, tags: [] });
    }
  }
  if (run.weapons.length < BAL.weaponSlots) {
    // Druga broń kończy Wierność broni (BAL.loyal).
    const lone = run.weapons.length === 1;
    const loyalHint = lone && run.loyal > 0 ? 'Tracisz Wierność broni!' : lone ? 'Kończy szansę na Wierność broni' : '';
    const offerable = (d: (typeof WEAPONS)[number], taken: Set<string>) => !d.evolved && !taken.has(d.id) && !run.banished.has(d.id) && (!d.hero || d.hero === run.hero.id);
    // Wolny slot, a wszystkie bronie bazowe już wykorzystane (długi run, kilka fuzji): składniki fuzji wracają do oferty
    // (0.41.2; wcześniej zostawały same premie statystyk). Ta sama fuzja nie powtórzy się (opcja fuzji pomija posiadaną hybrydę).
    let taken = ownedW;
    if (!WEAPONS.some((d) => offerable(d, ownedW))) {
      taken = new Set(run.weapons.map((w) => w.def.id));
      for (const d of WEAPONS) if (evolvesOf(d).some((e) => taken.has(e.into))) taken.add(d.id);
    }
    for (const d of WEAPONS) {
      if (!offerable(d, taken)) continue;
      const el = WEAPON_ELEMENT[d.id];
      const desc = el ? `${d.desc} Żywioł: ${ELEMENTS[el].name} (${ELEMENTS[el].desc}).` : d.desc;
      out.push({ kind: 'weaponNew', id: d.id, name: d.name, desc, hint: loyalHint || fusionHint(run, d) || evolveHint(run, d), icon: d.icon, tag: 'Nowa broń', color: d.color, tags: weaponTags(d), recipe: weaponRecipe(run, d) });
    }
  }
  for (const p of run.passives) {
    const d = PASSIVE_BY_ID[p.id];
    if (!p.evo && passiveEvoReady(run, p.id, p.level)) {
      const evIcon = `${d.icon}_evo`, w = run.weapons.find((x) => passiveEvolves(p.id).some((e) => e.into.id === x.def.id))!;
      out.push({ kind: 'passiveEvolve', id: d.id, name: d.evo.name, desc: d.evo.desc, hint: `Upgrades: ${d.name}`, icon: evIcon, tag: 'Ewolucja', color: C.gold, tags: [], recipe: { parts: [d.icon, w.def.icon], result: evIcon } });
    }
    if (p.level < d.maxLevel) out.push({ kind: 'passiveUp', id: d.id, name: d.name, desc: d.desc, hint: passiveHint(run, d.id), icon: d.icon, tag: `Poziom ${p.level + 1}/${d.maxLevel}`, color: C.white, tags: [], recipe: passiveRecipe(run, d.id), evolves: evoIcons(run, d.id) });
  }
  if (run.passives.length < BAL.passiveSlots) {
    for (const d of PASSIVES) {
      if (ownedP.has(d.id) || run.banished.has(d.id)) continue;
      out.push({ kind: 'passiveNew', id: d.id, name: d.name, desc: d.desc, hint: passiveHint(run, d.id), icon: d.icon, tag: 'Nowa pasywka', color: C.white, tags: tagsOf(d.stat), recipe: passiveRecipe(run, d.id), evolves: evoIcons(run, d.id) });
    }
  }
  for (const slot of ['q', 'e', 'ult'] as AbilitySlot[]) {
    const a = run.abilities[slot];
    const key = slot === 'ult' ? 'R' : slot.toUpperCase();
    const evo = a.def.evo;
    if (a.level >= a.def.maxLevel) {
      // Ewolucja umiejętności: maks. poziom + aktywna synergia z jej opisu.
      if (evo && (run.synTiers[evo.tag] ?? 0) > 0) out.push({ kind: 'abilityEvolve', id: slot, name: `${evo.name} [${key}]`, desc: evo.desc, hint: `Zastępuje: ${a.def.name}`, icon: evo.icon, tag: 'Ewolucja', color: a.def.color, tags: [], recipe: { parts: [a.def.icon, `tag:${evo.tag}`], result: evo.icon } });
      continue;
    }
    const hint = evo ? `Ewolucja: max poziom + synergia ${evo.tag}` : '';
    out.push({ kind: 'ability', id: slot, name: `${a.def.name} [${key}]`, desc: describeAbilityLevel(a.def), hint, icon: a.def.icon, tag: `Poziom ${a.level + 1}/${a.def.maxLevel}`, color: a.def.color, tags: [], recipe: evo ? { parts: [a.def.icon, `tag:${evo.tag}`], result: evo.icon } : undefined });
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
  let s = { evolve: 100, fusion: 98, abilityEvolve: 95, passiveEvolve: 90, augment: 24, weaponUp: 22, weaponNew: 16, ability: 14, passiveNew: 12, passiveUp: 10, stat: 0 }[o.kind];
  s += (o.quality ?? 0) * 6;
  if (o.tags.some((t) => reachesThreshold(run, t))) s += 40;
  if (o.hint.startsWith('Potrzebna do ewolucji') || o.hint.endsWith('(masz)') || o.hint.startsWith('Fuzja z')) s += 25;
  return s;
}

const key = (o: Option) => `${o.kind}:${o.id}`;

/** Opcje premii statystyk (BAL.statBoosts) — dopełniają ofertę, gdy zabrakło ulepszeń. */
function statOptions(): Option[] {
  return BAL.statBoosts.map((b) => ({
    kind: 'stat' as const, id: String(b.stat), name: b.name, desc: b.desc, hint: 'Wszystko rozwinięte: stała premia', icon: b.icon, tag: 'Premia', color: C.lgray, tags: [],
  }));
}

/** Liczba kart w ofercie awansu: 3 + premia (maks. 4); Udręka „Klątwa kart” (cardCurse) zabiera jedną (min. 2). */
export function offerCount(run: Run): number {
  return Math.max(2, Math.min(4, 3 + run.stats.choices) - run.flag('cardCurse'));
}

/**
 * Losuje `count` różnych opcji (ważonych). Dostępna ewolucja (albo fuzja) jest zawsze wśród nich
 * (dawniej gwarantowała ją skrzynia, która teraz daje przedmioty). Brakujące miejsca dopełniają premie statystyk.
 */
export function generateOptions(run: Run, count: number, exclude: Option[] = []): Option[] {
  const pool = candidates(run).filter((o) => !exclude.some((x) => key(x) === key(o)));
  const evo = pool.find((o) => o.kind === 'evolve' || o.kind === 'abilityEvolve' || o.kind === 'passiveEvolve' || o.kind === 'fusion');
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
    case 'weaponUp': {
      const w = run.weapons.find((x) => x.def.id === o.id)!;
      w.level++;
      if (o.bonus) addWeaponBonus(w.bonus, o.bonus);
      break;
    }
    case 'evolve': {
      const w = run.weapons.find((x) => evolvesOf(x.def).some((e) => e.into === o.id))!;
      const into = o.id;
      if (run.basicWeaponId === w.def.id) run.basicWeaponId = into;
      w.def = WEAPON_BY_ID[into];
      w.level = 1;
      run.celebrate(w.def.name);
      break;
    }
    case 'fusion': {
      // Hybryda zajmuje slot pierwszej broni, druga znika; bonusy jakości obu się sumują.
      const f = fusionOf(o.id)!;
      const a = ownedBase(run, f.a)!, b = ownedBase(run, f.b)!;
      if (run.basicWeaponId === a.def.id || run.basicWeaponId === b.def.id) run.basicWeaponId = o.id;
      addWeaponBonus(a.bonus, b.bonus);
      a.def = WEAPON_BY_ID[o.id];
      a.level = 1;
      run.weapons = run.weapons.filter((w) => w !== b);
      run.celebrate(a.def.name, true);
      break;
    }
    case 'passiveNew':
      run.passives.push({ id: o.id, level: 1 });
      break;
    case 'passiveUp':
      run.passives.find((p) => p.id === o.id)!.level++;
      break;
    case 'passiveEvolve':
      run.passives.find((p) => p.id === o.id)!.evo = true;
      run.celebrate(o.name);
      break;
    case 'ability':
      run.abilities[o.id as AbilitySlot].level++;
      break;
    case 'abilityEvolve': {
      const a = run.abilities[o.id as AbilitySlot];
      a.def = evolveAbility(a.def);
      run.celebrate(a.def.name);
      break;
    }
    case 'augment':
      run.augments.push(o.id);
      break;
    case 'stat': {
      const b = BAL.statBoosts.find((x) => String(x.stat) === o.id)!;
      run.addBonus(b.stat, b.value);
      break;
    }
  }
  // Nowa broń / pasywka / ewolucja zmienia punkty synergii.
  run.onBuildChanged();
}
