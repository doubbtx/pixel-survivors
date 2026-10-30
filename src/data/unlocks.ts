import type { SaveData } from '../core/save';
import type { Run } from '../game/run';
import type { Tag } from './cards';
import { BAL } from './balance';
import { WEAPON_BY_ID } from './weapons';
import { PASSIVE_BY_ID } from './passives';

/**
 * Stopniowe odblokowania (faza 2): nowy gracz zaczyna od Ekspedycji i dwóch bohaterów, reszta przychodzi z postępem.
 * Warunki sprawdza ui/game-screen.ts (`grantUnlocks`) po bossie, po akcie i po wygranej wyprawie; zdobyte id w `save.unlocks`.
 * Nazwy i opisy po angielsku (polski w core/i18n-pl.ts).
 */
export interface UnlockCtx {
  /** Pokonany boss aktu Ekspedycji albo boss Endless. */
  boss: boolean;
  /** Ukończone akty w tym runie (Ekspedycja). */
  acts: number;
  /** Wygrana wyprawa i jej poziom trudności (0 Zwykła … 3 Koszmarna). */
  won: boolean;
  tier: number;
  /** Bieżący run (liczniki do odblokowań zawartości); brak przy wczytaniu gry. */
  run?: Run;
}

export interface UnlockDef {
  id: string;
  name: string;
  /** Jak zdobyć (przy zablokowanym elemencie). */
  how: string;
  /** Krótka podpowiedź po odblokowaniu. */
  hint: string;
  check: (save: SaveData, c: UnlockCtx) => boolean;
  /** Postęp warunku w runie [obecnie, cel] (najlepszy wynik trzyma `save.unlockBest`). */
  progress?: (run: Run) => [number, number];
  /** Cel warunku „w jednym runie” (do opisu postępu bez runu). */
  goal?: number;
  /** Dodatkowe id odblokowane razem z tym (np. pasywka potrzebna do ewolucji odblokowanej broni). */
  grants?: string[];
}

const wins = (s: SaveData) => Object.values(s.records).reduce((n, r) => n + (r.expeditionWins ?? 0), 0);

export const UNLOCKS: UnlockDef[] = [
  { id: 'forge', name: 'Anvil and Forge', how: 'Defeat your first boss.', hint: 'Anvil nodes now appear on Expedition maps.', check: (_s, c) => c.boss },
  { id: 'tier1', name: 'Magic difficulty', how: 'Defeat your first boss.', hint: 'Pick it on the Expedition map (key 2): more risk, better loot.', check: (_s, c) => c.boss },
  { id: 'hero:ignara', name: 'Ignara', how: 'Complete act 1 of an Expedition.', hint: 'A new hero is waiting in hero select.', check: (_s, c) => c.acts >= 1 },
  { id: 'hero:morwen', name: 'Morwen', how: 'Complete act 2 of an Expedition.', hint: 'A new hero is waiting in hero select.', check: (_s, c) => c.acts >= 2 },
  { id: 'endless', name: 'Endless mode', how: 'Win an Expedition.', hint: 'Endless is now in the main menu.', check: (_s, c) => c.won },
  { id: 'pacts', name: 'Risk Pacts', how: 'Win an Expedition.', hint: 'Set Pacts in hero select (Tab) for badges and skins.', check: (_s, c) => c.won },
  { id: 'tier2', name: 'Rare difficulty', how: 'Win an Expedition.', hint: 'Pick it on the Expedition map (key 3).', check: (_s, c) => c.won },
  { id: 'hero:vesper', name: 'Vesper', how: 'Earn 4 achievements.', hint: 'A new hero is waiting in hero select.', check: (s) => s.achievements.length >= 4 },
  { id: 'hero:aurel', name: 'Aurel', how: 'Win 2 Expeditions.', hint: 'A new hero is waiting in hero select.', check: (s) => wins(s) >= 2 },
  { id: 'hero:takezo', name: 'Takezo', how: 'Win an Expedition with Borgun or Vesper.', hint: 'A new hero is waiting in hero select.', check: (s) => (s.records.borgun?.expeditionWins ?? 0) + (s.records.vesper?.expeditionWins ?? 0) >= 1 },
  { id: 'tier3', name: 'Nightmare difficulty', how: 'Win an Expedition on Rare difficulty.', hint: 'Pick it on the Expedition map (key 4).', check: (_s, c) => c.won && c.tier >= 2 },
];
/** Warunek „w jednym runie”: licznik runu ≥ cel (z postępem). */
const inRun = (get: (r: Run) => number, n: number) => ({
  goal: n,
  check: (_s: SaveData, c: UnlockCtx) => !!c.run && get(c.run) >= n,
  progress: (r: Run): [number, number] => [Math.min(n, Math.floor(get(r))), n],
});

/**
 * Odblokowania zawartości (0.61): nowy gracz zaczyna od połowy broni ogólnych, pasywek i kart (pełny build od pierwszego
 * runu), reszta za rzeczy, które i tak robi w grze. Id: `w:<broń>`, `p:<pasywka>`, `fusions`, `evo:<broń bazowa>`
 * (warianty ewolucji po pierwszej ewolucji tej broni), `cards:<tag>` (złote karty tagu, data/cards.ts `cardLock`),
 * `prism:<n>` (grupy kart pryzmatycznych). Bronie i karty bohaterów nigdy nie są zablokowane. Pasywki potrzebne do
 * podstawowej ewolucji broni ze startu zostają otwarte. Kolejność = kolejka odkryć (`grantDiscovery`).
 */
const CARD_TAGS: Tag[] = ['Ogień', 'Krytyk', 'Pociski', 'Obszar', 'Tarcze', 'Życie', 'Szybkość', 'Umiejętności', 'Przywołania', 'Klątwa'];
const PRISM_GROUPS = 3;
export const CONTENT: UnlockDef[] = [
  { id: 'w:meteor', name: WEAPON_BY_ID.meteor.name, how: 'Defeat a boss.', hint: 'A new weapon can now show up on level-up.', check: (_s, c) => c.boss },
  { id: 'fusions', name: 'Weapon fusions', how: 'Defeat a boss.', hint: 'Two maxed weapons can now fuse into a hybrid (Codex: Fusions).', check: (_s, c) => c.boss },
  { id: 'p:magnet', name: PASSIVE_BY_ID.magnet.name, how: 'Reach level 20 in a run.', hint: 'A new passive can now show up on level-up.', ...inRun((r) => r.level, 20) },
  { id: 'w:mines', name: WEAPON_BY_ID.mines.name, how: 'Complete act 1 of an Expedition or survive 10 minutes in Endless.', hint: 'A new weapon can now show up on level-up.', check: (_s, c) => c.acts >= 1 || (!!c.run && c.run.mode === 'endless' && c.run.totalTime >= 600) },
  { id: 'p:ember', name: PASSIVE_BY_ID.ember.name, how: 'Trigger 100 elemental reactions in one run.', hint: 'A new passive can now show up on level-up.', ...inRun((r) => r.reactions, 100) },
  { id: 'w:laser', name: WEAPON_BY_ID.laser.name, how: 'Reach level 30 in a run.', hint: 'A new weapon can now show up on level-up.', ...inRun((r) => r.level, 30) },
  { id: 'p:whetstone', name: PASSIVE_BY_ID.whetstone.name, how: 'Land 1000 critical hits in one run.', hint: 'A new passive can now show up on level-up.', ...inRun((r) => r.critHits, 1000) },
  { id: 'w:sickle', name: WEAPON_BY_ID.sickle.name, how: 'Heal 1000 HP in one run.', hint: 'A new weapon can now show up on level-up.', ...inRun((r) => r.healed, 1000) },
  { id: 'p:clover', name: PASSIVE_BY_ID.clover.name, how: 'Kill 1500 enemies in one run.', hint: 'A new passive can now show up on level-up.', ...inRun((r) => r.kills, 1500) },
  { id: 'w:dice', name: WEAPON_BY_ID.dice.name, how: 'Get a Lucky find.', hint: 'A new weapon and a new passive can now show up on level-up.', grants: ['p:horseshoe'], ...inRun((r) => r.jackpots, 1) },
  ...CARD_TAGS.map((t): UnlockDef => ({
    id: `cards:${t}`, name: `${t}: gold cards`, how: `Activate the ${t} synergy in a run (3 points).`, hint: 'More gold cards can now show up.',
    check: (_s, c) => (c.run?.synTiers[t] ?? 0) >= 1,
  })),
  { id: 'prism:1', name: 'Prismatic cards I', how: 'Complete act 1 of an Expedition or defeat 2 bosses in Endless.', hint: 'More prismatic cards can now show up.', check: (_s, c) => c.acts >= 1 || (c.run?.mode === 'endless' && c.run.bossKills >= 2) },
  { id: 'prism:2', name: 'Prismatic cards II', how: 'Complete act 2 of an Expedition or defeat 4 bosses in Endless.', hint: 'More prismatic cards can now show up.', check: (_s, c) => c.acts >= 2 || (c.run?.mode === 'endless' && c.run.bossKills >= 4) },
  { id: 'prism:3', name: 'Prismatic cards III', how: 'Win an Expedition or defeat 6 bosses in Endless.', hint: 'All prismatic cards can now show up.', check: (_s, c) => c.won || (c.run?.mode === 'endless' && c.run.bossKills >= 6) },
];
/** Grupa karty pryzmatycznej (kolejne zablokowane karty po kolei do grup 1..PRISM_GROUPS). */
export const prismGroup = (i: number): string => `prism:${(i % PRISM_GROUPS) + 1}`;
/** Pasywka odblokowana tylko razem z inną zawartością (`grants`), bez własnego warunku. */
const GRANTED = CONTENT.flatMap((u) => u.grants ?? []);
/** Zawartość zablokowana dla nowego gracza (id w `save.unlocks` po odblokowaniu). */
export const LOCKED = new Set([...CONTENT.map((u) => u.id), ...GRANTED]);

export const UNLOCK_BY_ID: Record<string, UnlockDef> = Object.fromEntries([...UNLOCKS, ...CONTENT].map((u) => [u.id, u]));

/** Czy zawartość jest dostępna: niezablokowana albo odblokowana (`open` = zbiór z `save.unlocks`). Warianty ewolucji: `evo:<broń>`. */
export const isOpen = (open: ReadonlySet<string>, id: string): boolean =>
  id.startsWith('evo:') ? open.has(id) || open.has('evo:all') : !LOCKED.has(id) || open.has(id);

/**
 * Punkty odkryć: każdy ukończony run daje punkty (BAL.discovery), co `every` punktów otwiera się najbliższa zablokowana
 * zawartość z kolejki — nawet słaby gracz dostaje coś nowego co 1-2 runy. Zwraca nowo odblokowane.
 */
export function grantDiscovery(s: SaveData, points: number): UnlockDef[] {
  s.discovery = (s.discovery ?? 0) + points;
  const out: UnlockDef[] = [];
  while (s.discovery >= BAL.discovery.every) {
    const next = CONTENT.find((u) => !s.unlocks.includes(u.id));
    if (!next) { s.discovery = 0; break; }
    s.discovery -= BAL.discovery.every;
    out.push(...give(s, [next]));
  }
  return out;
}

/** Zapisuje odblokowania razem z `grants`. */
function give(s: SaveData, defs: UnlockDef[]): UnlockDef[] {
  for (const u of defs) for (const id of [u.id, ...(u.grants ?? [])]) if (!s.unlocks.includes(id)) s.unlocks.push(id);
  return defs;
}

/**
 * Opis brakującego odblokowania zawartości dla Księgi ewolucji, Arsenału i Kolekcji: pierwszy niespełniony z `ids`
 * (warunek i najlepszy postęp); '' gdy wszystko otwarte.
 */
export function lockText(s: SaveData, ids: string[]): string {
  const open = new Set(s.unlocks), id = ids.find((x) => !isOpen(open, x));
  if (!id) return '';
  if (id.startsWith('evo:')) return 'Locked: evolve this weapon once (its first evolution) to unlock the variants.';
  const u = UNLOCK_BY_ID[id] ?? CONTENT.find((c) => c.grants?.includes(id));
  if (!u) return '';
  return u.goal ? `Locked (${Math.floor(s.unlockBest?.[u.id] ?? 0)}/${u.goal}): ${u.how}` : `Locked: ${u.how}`;
}

/** Czy zostało coś do odkrycia (ekran końca: pasek odkryć). */
export const discoveryLeft = (s: SaveData): boolean => CONTENT.some((u) => !s.unlocks.includes(u.id));

/** Bohaterowie dostępni od początku. */
/** Takezo tymczasowo od początku (prośba gracza, 0.34.2); warunek 'hero:takezo' zostaje w UNLOCKS na później. */
export const START_HEROES = ['kestra', 'borgun', 'takezo'];

export const unlocked = (s: SaveData, id: string): boolean => s.unlocks.includes(id);
export const heroUnlocked = (s: SaveData, hero: string): boolean => START_HEROES.includes(hero) || unlocked(s, `hero:${hero}`);
/** Najwyższy dostępny poziom trudności map (0 Zwykła … 3 Koszmarna). */
export const maxTier = (s: SaveData): number => (unlocked(s, 'tier3') ? 3 : unlocked(s, 'tier2') ? 2 : unlocked(s, 'tier1') ? 1 : 0);

/** Sprawdza warunki i zapisuje nowe odblokowania; zwraca nowo zdobyte (do banerów). */
export function grantUnlocks(s: SaveData, c: UnlockCtx): UnlockDef[] {
  if (c.run) {
    // Najlepszy postęp warunków „w jednym runie” (Kolekcja i Księga pokazują go przy zablokowanej zawartości).
    const best = (s.unlockBest ??= {});
    for (const u of CONTENT) if (u.progress && !s.unlocks.includes(u.id)) best[u.id] = Math.max(best[u.id] ?? 0, u.progress(c.run)[0]);
    // Warianty ewolucji: pierwsza ewolucja broni w runie.
    for (const b of c.run.evolvedBases) if (!s.unlocks.includes(`evo:${b}`)) s.unlocks.push(`evo:${b}`);
  }
  return give(s, [...UNLOCKS, ...CONTENT].filter((u) => !s.unlocks.includes(u.id) && u.check(s, c)));
}

/** Wszystkie odblokowania (gracze z wcześniejszych wersji, bot testowy); `evo:all` otwiera warianty ewolucji wszystkich broni. */
export const ALL_UNLOCKS = [...UNLOCKS.map((u) => u.id), ...LOCKED, 'evo:all'];
