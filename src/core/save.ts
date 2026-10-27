import type { RunSnapshot, SlotMode } from '../game/run';
import type { MetaState } from '../data/meta';

/**
 * Zapis w localStorage z wersjonowaniem.
 * Przy każdej zmianie formatu: podbij SAVE_VERSION i dodaj migrację MIGRATIONS[stara_wersja],
 * która przekształca dane do wersji o 1 wyższej. Ładowanie aplikuje migracje po kolei.
 */
const KEY = 'pixel-survivors-save';
export const SAVE_VERSION = 5;

export interface HeroRecord {
  bestTime: number;
  bestKills: number;
  bestLevel: number;
  /** Najdalszy poziom kampanii Hardcore. */
  bestDepth: number;
  /** Najdłużej przetrwany czas w trybie Endless (s). */
  bestEndless: number;
  /** Ekspedycja: najwięcej ukończonych węzłów i liczba ukończonych wypraw. */
  bestExpedition: number;
  expeditionWins: number;
  wins: number;
  runs: number;
}

/** Wpis tablicy rekordów Hardcore. */
export interface HardcoreEntry {
  hero: string;
  depth: number;
  time: number;
  kills: number;
  level: number;
  date: string;
}

/**
 * Celowanie umiejętności: 'auto' — zawsze najbliższy wróg; 'mixed' — mysz/prawa gałka, a bez nich najbliższy wróg;
 * 'manual' — tylko mysz/prawa gałka, bez nich kierunek ruchu.
 */
export type AimMode = 'auto' | 'mixed' | 'manual';

/** Nowe ustawienia nie wymagają migracji: brakujące pola dostają wartości domyślne przy wczytaniu. */
export interface Settings {
  volume: number;
  shake: boolean;
  debug: boolean;
  aim: AimMode;
  /** Liczby obrażeń zadawanych wrogom. */
  damageNumbers: boolean;
  /** Pauza, gdy okno gry traci fokus. */
  autoPause: boolean;
  minimap: boolean;
  /** Zielone liczby leczenia nad postacią. */
  healNumbers: boolean;
  /** Oszczędne efekty (słabszy sprzęt, telefon): mniej cząsteczek, bez cieni, poświat i winiety. */
  lowFx: boolean;
  /** Ukrycie pocisków gracza (działają dalej) — żeby lepiej widzieć pociski wrogów. */
  hideProjectiles: boolean;
}

/** Kolekcja kart (między runami): odkryte, liczba wyborów i bany (wykluczone z ofert). */
export interface CardCollection {
  seen: string[];
  picks: Record<string, number>;
  banned: string[];
}

export interface SaveData {
  version: number;
  settings: Settings;
  records: Record<string, HeroRecord>;
  /** Sloty zapisu per tryb: trwający run (między poziomami albo w trakcie poziomu). */
  slots: Record<SlotMode, RunSnapshot | null>;
  /** Tablica rekordów Hardcore. */
  board: HardcoreEntry[];
  /** Komunikat do pokazania w menu przy następnym uruchomieniu (np. przerwany run). */
  notice: string;
  collection: CardCollection;
  /** Meta-progresja: esencja, drzewko rozwoju, Paragon (z całej esencji), prestiż. */
  meta: MetaState;
}

type Migration = (old: Record<string, unknown>) => Record<string, unknown>;
const MIGRATIONS: Record<number, Migration> = {
  // 1 → 2: slot Hardcore (etap 3) i najdalszy poziom w rekordach bohatera.
  1: (old) => {
    const records = (old.records ?? {}) as Record<string, Record<string, unknown>>;
    for (const r of Object.values(records)) r.bestDepth ??= 0;
    return { ...old, version: 2, records, hardcore: { run: null, board: [] }, notice: '' };
  },
  // 2 → 3: kolekcja i bany kart (etap 4). Karty z trwającego runu Hardcore trafiają od razu do kolekcji.
  2: (old) => {
    const run = (old.hardcore as { run?: { cards?: [string, number][] } } | undefined)?.run;
    const cards = run?.cards ?? [];
    return { ...old, version: 3, collection: { seen: cards.map(([id]) => id), picks: Object.fromEntries(cards), banned: [] } };
  },
  // 3 → 4: meta-progresja (etap 5) i rekord trybu Endless.
  3: (old) => {
    const records = (old.records ?? {}) as Record<string, Record<string, unknown>>;
    for (const r of Object.values(records)) r.bestEndless ??= 0;
    return { ...old, version: 4, records, meta: { essence: 0, total: 0, nodes: {}, prestige: 0 } };
  },
  // 4 → 5: sloty zapisu per tryb (Hardcore, Endless, Ekspedycja) i rekordy Ekspedycji.
  4: (old) => {
    const hc = (old.hardcore ?? {}) as { run?: unknown; board?: unknown[] };
    const records = (old.records ?? {}) as Record<string, Record<string, unknown>>;
    for (const r of Object.values(records)) { r.bestExpedition ??= 0; r.expeditionWins ??= 0; }
    const { hardcore: _, ...rest } = old;
    return { ...rest, version: 5, records, slots: { hardcore: hc.run ?? null, endless: null, expedition: null }, board: hc.board ?? [] };
  },
};

function defaults(): SaveData {
  return {
    version: SAVE_VERSION,
    settings: { volume: 0.5, shake: true, debug: false, aim: 'mixed', damageNumbers: true, autoPause: true, minimap: true, healNumbers: true,
      // Telefon / tablet (dotyk jako główne wejście): domyślnie oszczędne efekty.
      lowFx: typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches,
      hideProjectiles: false },
    records: {},
    slots: { hardcore: null, endless: null, expedition: null },
    board: [],
    notice: '',
    collection: { seen: [], picks: {}, banned: [] },
    meta: { essence: 0, total: 0, nodes: {}, prestige: 0 },
  };
}

export function loadSave(): SaveData {
  const base = defaults();
  let raw: Record<string, unknown> | null = null;
  try {
    const s = localStorage.getItem(KEY);
    raw = s ? (JSON.parse(s) as Record<string, unknown>) : null;
  } catch {
    raw = null;
  }
  if (!raw) return base;
  let v = typeof raw.version === 'number' ? raw.version : 0;
  while (v < SAVE_VERSION) {
    const m = MIGRATIONS[v];
    if (!m) return base; // nieznana stara wersja — bezpieczny start od domyślnych
    raw = m(raw);
    v++;
  }
  const d = raw as unknown as Partial<SaveData>;
  return {
    version: SAVE_VERSION,
    settings: { ...base.settings, ...d.settings },
    records: { ...d.records },
    slots: { ...base.slots, ...d.slots },
    board: d.board ?? [],
    notice: d.notice ?? '',
    collection: { ...base.collection, ...d.collection },
    meta: { ...base.meta, ...d.meta },
  };
}

export function writeSave(d: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    // brak miejsca / tryb prywatny — gra działa dalej bez zapisu
  }
}

export function heroRecord(d: SaveData, heroId: string): HeroRecord {
  return (d.records[heroId] ??= { bestTime: 0, bestKills: 0, bestLevel: 0, bestDepth: 0, bestEndless: 0, bestExpedition: 0, expeditionWins: 0, wins: 0, runs: 0 });
}

/** Dodaje wynik do tablicy Hardcore (top 10: najdalszy poziom, potem krótszy czas). */
export function addHardcoreEntry(d: SaveData, e: HardcoreEntry): void {
  d.board.push(e);
  d.board.sort((a, b) => b.depth - a.depth || a.time - b.time);
  d.board.length = Math.min(d.board.length, 10);
}
