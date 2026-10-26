import { C } from '../core/palette';
import { rng } from '../core/rng';
import type { Stats } from '../entities/types';
import type { Run } from '../game/run';
import { spawnTurret } from '../systems/turrets';
import { CARD_BY_ID, type CardHooks, type Tag } from './cards';
import { PASSIVE_BY_ID } from './passives';
import type { WeaponKind } from './weapons';
import type { Item } from './items';

/**
 * Synergie: wszystko w buildzie ma tagi (bohater, bronie, pasywki, karty, afiksy i super-bonusy przedmiotów),
 * a punkty tagów odblokowują progi z bonusami — jak cechy w auto-battlerach. Dzięki temu karta "Ogień",
 * meteor, mina i przedmiot z Ognistą duszą budują jedno combo.
 *
 * Punkty: bohater 1 za tag, broń 1 (ewolucja 2), pasywka 1, karta 1 za tag × stosy,
 * przedmiot 1 za każdy różny tag swoich afiksów + 1 za tag super-bonusu.
 * Progi kumulują się (próg 6 daje też bonus progu 3). Efekty jak u kart: stats / mul / flags / hooks.
 */
export const TAGS: Tag[] = ['Ogień', 'Krytyk', 'Pociski', 'Obszar', 'Tarcze', 'Życie', 'Szybkość', 'Umiejętności', 'Przywołania', 'Klątwa'];

/** Tag statystyki — dla pasywek i afiksów przedmiotów (ekonomia: XP, złoto, szczęście bez tagu). */
export const STAT_TAG: Partial<Record<keyof Stats, Tag>> = {
  might: 'Krytyk', crit: 'Krytyk', critMult: 'Krytyk',
  maxHp: 'Życie', regen: 'Życie', lifesteal: 'Życie',
  armor: 'Tarcze',
  cdr: 'Umiejętności', duration: 'Umiejętności',
  area: 'Obszar',
  speedBonus: 'Szybkość', magnet: 'Szybkość', atkSpeed: 'Szybkość',
  elemPower: 'Ogień',
  amount: 'Pociski', projSpeed: 'Pociski',
};

/** Tagi wzorców broni (ewolucja dziedziczy tagi wzorca). */
export const WEAPON_TAGS: Record<WeaponKind, Tag[]> = {
  bolt: ['Pociski'],
  orbit: ['Obszar', 'Przywołania'],
  aura: ['Obszar', 'Życie'],
  chain: ['Krytyk', 'Pociski'],
  meteor: ['Ogień', 'Obszar'],
  boomerang: ['Pociski', 'Szybkość'],
  laser: ['Krytyk', 'Ogień'],
  mines: ['Ogień', 'Przywołania'],
  cleave: ['Obszar', 'Tarcze'],
};

/** Tagi super-bonusów przedmiotów (id z data/items.ts SUPERS). */
export const SUPER_TAGS: Record<string, Tag> = {
  execute: 'Krytyk', echo: 'Krytyk', storm: 'Pociski', frost: 'Tarcze', vampire: 'Życie', pyre: 'Ogień',
  midas: 'Szybkość', vortex: 'Szybkość', aegis: 'Tarcze', rage: 'Klątwa', phoenix: 'Ogień', fortune: 'Klątwa',
};

/** Różne tagi przedmiotu (afiksy + super-bonus) — do punktów i do opisu na karcie przedmiotu. */
export function itemTags(it: Item): Tag[] {
  const out = new Set<Tag>();
  for (const a of it.affixes) { const t = STAT_TAG[a.stat]; if (t) out.add(t); }
  if (it.super && SUPER_TAGS[it.super.id]) out.add(SUPER_TAGS[it.super.id]);
  return [...out];
}

export interface SynergyTier {
  /** Krótki opis (mieści się w kolumnie ekranu synergii). */
  desc: string;
  stats?: Partial<Stats>;
  mul?: Partial<Stats>;
  flags?: Record<string, number>;
  hooks?: CardHooks;
}

export interface SynergyDef {
  tag: Tag;
  /** Punkty potrzebne do kolejnych progów. */
  thresholds: number[];
  tiers: SynergyTier[];
}

/** Licznik "co X" w stanie kart (zapisywany z runem). */
function every(run: Run, key: string, add: number, threshold: number): boolean {
  const v = (run.cardState[key] ?? 0) + add;
  if (v >= threshold) { run.cardState[key] = v - threshold; return true; }
  run.cardState[key] = v;
  return false;
}

const STD = [3, 6, 9];

export const SYNERGIES: SynergyDef[] = [
  {
    tag: 'Ogień', thresholds: STD, tiers: [
      { desc: 'Trafienia: 4% szans na płomienie pod wrogiem', hooks: { onHit: (run, e) => { if (rng.chance(0.04)) run.addFire(e.x, e.y, 12, run.cardDamage(5), 2, 'Synergia: Ogień'); } } },
      { desc: 'Zabici: 10% szans na wybuch (30% HP)', hooks: { onKill: (run, e) => { if (!e.boss && rng.chance(0.1)) run.queueExplosion(e.x, e.y, 20 * run.stats.area, e.maxHp * 0.3, 'Synergia: Ogień', C.orange); } } },
      {
        desc: 'Co 6 s pożoga wokół ciebie',
        hooks: { onTick: (run, dt) => { if (every(run, 'syn.fire', dt, 6)) run.explode(run.player.x, run.player.y, 70 * run.stats.area, run.cardDamage(40), 'Synergia: Ogień', C.orange, 4); } },
      },
    ],
  },
  {
    tag: 'Krytyk', thresholds: STD, tiers: [
      { desc: '+5% szansy na krytyk', stats: { crit: 0.05 } },
      { desc: '+40% obrażeń krytycznych', stats: { critMult: 0.4 } },
      { desc: '+10% krytyka, ponad 100% bywa podwójny', stats: { crit: 0.1 }, flags: { overcrit: 1 } },
    ],
  },
  {
    tag: 'Pociski', thresholds: STD, tiers: [
      { desc: '+20% szybkości pocisków, +8% obrażeń', stats: { projSpeed: 0.2, might: 0.08 } },
      { desc: '+1 pocisk/ilość', stats: { amount: 1 } },
      { desc: 'Pociski odbijają się, +1 pocisk/ilość', stats: { amount: 1 }, flags: { bounce: 1 } },
    ],
  },
  {
    tag: 'Obszar', thresholds: STD, tiers: [
      { desc: '+10% obszaru', stats: { area: 0.1 } },
      { desc: '+15% obszaru, +10% czasu trwania', stats: { area: 0.15, duration: 0.1 } },
      {
        desc: 'Co 8 s fala uderzeniowa wokół ciebie',
        hooks: { onTick: (run, dt) => { if (every(run, 'syn.area', dt, 8)) run.explode(run.player.x, run.player.y, 90 * run.stats.area, run.cardDamage(30), 'Synergia: Obszar', C.lime, 6); } },
      },
    ],
  },
  {
    tag: 'Tarcze', thresholds: STD, tiers: [
      { desc: '+3 pancerza', stats: { armor: 3 } },
      { desc: 'Co 6 s tarcza 8% HP (maks. 30% HP)', hooks: { onTick: (run, dt) => { if (every(run, 'syn.shield', dt, 6)) run.addShield(run.stats.maxHp * 0.08, 0.3); } } },
      { desc: '-15% otrzymywanych obrażeń', flags: { dmgTaken: 0.15 } },
    ],
  },
  {
    tag: 'Życie', thresholds: STD, tiers: [
      { desc: '+10% maks. HP', mul: { maxHp: 1.1 } },
      { desc: 'Co 5 s leczysz 3% HP', hooks: { onTick: (run, dt) => { if (every(run, 'syn.life', dt, 5)) run.heal(run.stats.maxHp * 0.03); } } },
      { desc: '+15% maks. HP, nadmiar leczenia w tarczę', mul: { maxHp: 1.15 }, flags: { overhealShield: 0.3 } },
    ],
  },
  {
    tag: 'Szybkość', thresholds: STD, tiers: [
      { desc: '+10% szybkości ruchu i ataku', stats: { speedBonus: 0.1, atkSpeed: 0.1, magnet: 0.3 } },
      { desc: 'Pół bonusu szybkości dodaje się do obrażeń', flags: { momentum: 0.5 } },
      { desc: 'Unik 40% szybciej, +15% szybkości', stats: { speedBonus: 0.15 }, flags: { 'cd.dash': 0.4 } },
    ],
  },
  {
    tag: 'Umiejętności', thresholds: STD, tiers: [
      { desc: '-8% czasu odnowienia', stats: { cdr: 0.08 } },
      { desc: 'Ultimate ładuje się 30% szybciej', flags: { ultGain: 0.3 } },
      { desc: 'Q i E: 20% szans na reset odnowienia', hooks: { onAbilityCast: (run, slot) => { if ((slot === 'q' || slot === 'e') && rng.chance(0.2)) run.abilities[slot].cd = 0; } } },
    ],
  },
  {
    tag: 'Przywołania', thresholds: STD, tiers: [
      { desc: 'Co 15 s wieżyczka na 8 s', hooks: { onTick: (run, dt) => { if (every(run, 'syn.summon', dt, 15)) spawnTurret(run, run.player.x, run.player.y, 8); } } },
      { desc: 'Wieżyczki strzelają 50% szybciej', flags: { turretRate: 0.5 } },
      { desc: 'Co 7 s kolejna wieżyczka na 8 s', hooks: { onTick: (run, dt) => { if (every(run, 'syn.summon2', dt, 7)) spawnTurret(run, run.player.x, run.player.y, 8); } } },
    ],
  },
  {
    // Klątwa: mało źródeł (przeklęte karty, Szał, Fortuna), więc niższe progi.
    tag: 'Klątwa', thresholds: [2, 3, 4], tiers: [
      { desc: '+15% obrażeń', stats: { might: 0.15 } },
      { desc: '+25% XP i złota', stats: { growth: 0.25, greed: 0.25 } },
      { desc: '+30% obrażeń, +10% krytyka', stats: { might: 0.3, crit: 0.1 } },
    ],
  },
];

export const SYNERGY_BY_TAG = Object.fromEntries(SYNERGIES.map((s) => [s.tag, s])) as Record<Tag, SynergyDef>;

/**
 * Wszechstronność: nagroda za różnorodny build. Punkty = liczba aktywnych synergii (próg I lub wyżej),
 * więc szeroki build (np. wszystkie synergie po 3 pkt) odblokowuje osobne, mocne bonusy.
 */
export const VERSATILITY: { name: string; thresholds: number[]; tiers: SynergyTier[] } = {
  name: 'Wszechstronność',
  thresholds: [4, 6, 8, 10],
  tiers: [
    { desc: '+10% obrażeń, +10% maks. HP', stats: { might: 0.1 }, mul: { maxHp: 1.1 } },
    { desc: '+1 pocisk, -10% odnowienia', stats: { amount: 1, cdr: 0.1 } },
    {
      desc: 'Co 10 s tęczowy wybuch, leczy 10% HP',
      hooks: {
        onTick: (run, dt) => {
          if (!every(run, 'syn.all', dt, 10)) return;
          run.explode(run.player.x, run.player.y, 110 * run.stats.area, run.cardDamage(60), 'Wszechstronność', C.pink, 6);
          run.heal(run.stats.maxHp * 0.1);
        },
      },
    },
    { desc: 'Mistrz: +30% obrażeń, +10% kryt., +1 karta', stats: { might: 0.3, crit: 0.1, luck: 1 } },
  ],
};

/** Punkty tagów całego buildu. */
export function tagPoints(run: Run): Record<Tag, number> {
  const pts = Object.fromEntries(TAGS.map((t) => [t, 0])) as Record<Tag, number>;
  const add = (t: Tag | undefined, n = 1) => { if (t) pts[t] += n; };
  for (const t of run.hero.tags) add(t);
  for (const w of run.weapons) for (const t of WEAPON_TAGS[w.def.kind]) add(t, w.def.evolved ? 2 : 1);
  for (const p of run.passives) add(STAT_TAG[PASSIVE_BY_ID[p.id].stat]);
  for (const c of run.cards) for (const t of CARD_BY_ID[c.id].tags) add(t, c.stacks);
  for (const it of Object.values(run.equipment)) if (it) for (const t of itemTags(it)) add(t);
  return pts;
}

/** Liczba osiągniętych progów dla danej liczby punktów. */
export function tierOf(def: SynergyDef, points: number): number {
  return def.thresholds.filter((t) => points >= t).length;
}
