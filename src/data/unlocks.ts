import type { SaveData } from '../core/save';

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
}

export interface UnlockDef {
  id: string;
  name: string;
  /** Jak zdobyć (przy zablokowanym elemencie). */
  how: string;
  /** Krótka podpowiedź po odblokowaniu. */
  hint: string;
  check: (save: SaveData, c: UnlockCtx) => boolean;
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
export const UNLOCK_BY_ID: Record<string, UnlockDef> = Object.fromEntries(UNLOCKS.map((u) => [u.id, u]));

/** Bohaterowie dostępni od początku. */
export const START_HEROES = ['kestra', 'borgun'];

export const unlocked = (s: SaveData, id: string): boolean => s.unlocks.includes(id);
export const heroUnlocked = (s: SaveData, hero: string): boolean => START_HEROES.includes(hero) || unlocked(s, `hero:${hero}`);
/** Najwyższy dostępny poziom trudności map (0 Zwykła … 3 Koszmarna). */
export const maxTier = (s: SaveData): number => (unlocked(s, 'tier3') ? 3 : unlocked(s, 'tier2') ? 2 : unlocked(s, 'tier1') ? 1 : 0);

/** Sprawdza warunki i zapisuje nowe odblokowania; zwraca nowo zdobyte (do banerów). */
export function grantUnlocks(s: SaveData, c: UnlockCtx): UnlockDef[] {
  const fresh = UNLOCKS.filter((u) => !s.unlocks.includes(u.id) && u.check(s, c));
  for (const u of fresh) s.unlocks.push(u.id);
  return fresh;
}

/** Wszystkie odblokowania (gracze z wcześniejszych wersji, bot testowy). */
export const ALL_UNLOCKS = UNLOCKS.map((u) => u.id);
