import type { Lang } from './i18n';
import type { RunSnapshot, SlotMode } from '../game/run';
import type { MetaState } from '../data/meta';
import { ALL_UNLOCKS } from '../data/unlocks';

/**
 * Zapis w localStorage z wersjonowaniem.
 * Przy każdej zmianie formatu: podbij SAVE_VERSION i dodaj migrację MIGRATIONS[stara_wersja],
 * która przekształca dane do wersji o 1 wyższej. Ładowanie aplikuje migracje po kolei.
 */
const KEY = 'pixel-survivors-save';
export const SAVE_VERSION = 12;

export interface HeroRecord {
  bestTime: number;
  bestKills: number;
  bestLevel: number;
  /** Najdłużej przetrwany czas w trybie Endless (s). */
  bestEndless: number;
  /** Ekspedycja: najwięcej ukończonych węzłów i liczba ukończonych wypraw. */
  bestExpedition: number;
  expeditionWins: number;
  /** Rekordy z wyróżnień runu (0.33): szczytowy DPS, najdłuższe kombo, najdłuższa seria zabójstw. */
  bestDps?: number;
  bestCombo?: number;
  bestStreak?: number;
}

/**
 * Celowanie umiejętności: 'auto' — zawsze najbliższy wróg; 'mixed' — mysz/prawa gałka, a bez nich najbliższy wróg;
 * 'manual' — tylko mysz/prawa gałka, bez nich kierunek ruchu.
 */
export type AimMode = 'auto' | 'mixed' | 'manual';

/** Ataki gracza: widoczne, przygaszone (półprzezroczyste, bez poświat) albo ukryte (działają dalej). */
/** Ataki gracza: 'auto' (0.40) — widoczne, przygaszane, gdy blisko bohatera jest dużo pocisków wrogów. */
export type PlayerFx = 'auto' | 'visible' | 'dim' | 'hidden';

/** Nowe ustawienia nie wymagają migracji: brakujące pola dostają wartości domyślne przy wczytaniu. */
export interface Settings {
  volume: number;
  /** Głośność muzyki proceduralnej (core/music.ts). */
  music: number;
  shake: boolean;
  debug: boolean;
  aim: AimMode;
  /** Liczby obrażeń zadawanych wrogom. */
  damageNumbers: boolean;
  /** Pauza, gdy okno gry traci fokus. */
  autoPause: boolean;
  /** 0.52: po każdym łupie automatycznie najlepszy ekwipunek (Run.autoEquip). */
  autoEquip: boolean;
  minimap: boolean;
  /** Zielone liczby leczenia nad postacią. */
  healNumbers: boolean;
  /** Oszczędne efekty (słabszy sprzęt, telefon): mniej cząsteczek, bez cieni, poświat i winiety. */
  lowFx: boolean;
  /** Widoczność ataków gracza (pociski, aury, strefy, efekty trafień) — żeby lepiej widzieć pociski wrogów. */
  playerFx: PlayerFx;
  /** Podpowiedzi kontekstowe (ui/hints.ts) i krótkie zatrzymanie klatki przy mocnych trafieniach. */
  hints: boolean;
  hitstop: boolean;
  /** Dostępność: tryb łatwy (słabsi wrogowie, bez odznak Paktu) i kształty żywiołów dla daltonistów. */
  easy: boolean;
  elemShapes: boolean;
  /**
   * Obraz i widoczność: wypełnianie okna (inaczej tylko całkowite powiększenie), przyciemnienie tła (0..1),
   * obwódki pocisków wrogów, znacznik pod graczem.
   */
  scaleFill: boolean;
  /** Przybliżenie świata (1 daleko, 1.25 normalne, 1.5 blisko; Renderer.setZoom). */
  zoom: number;
  bgDim: number;
  bulletOutline: boolean;
  playerMarker: boolean;
  /** Język (core/i18n.ts); domyślnie angielski. */
  lang: Lang;
  /** Rozmiar tekstów opisowych (core/font.ts `setTextSize`): duży domyślnie na dotyku. */
  textLarge: boolean;
  /** Ograniczenie błysków (dostępność): bez migania i białych błysków. */
  reduceFlash: boolean;
  /** Rozmiar HUD-u w grze (1 / 1.25 / 1.5; core/input.ts `setHudScale`): bloki w rogach rosną w stronę środka. Większy domyślnie na dotyku. */
  hudScale: number;
  /** Ostrzeżenie o błyskach pokazane (pierwsze uruchomienie). */
  flashWarned: boolean;
  /** Przypisania klawiszy (core/input.ts REBIND: akcja → KeyboardEvent.code); brak = domyślny. */
  keys: Record<string, string>;
}

/** Kolekcja kart (między runami): odkryte, liczba wyborów i bany (wykluczone z ofert); odkryte unikaty (nowe pole bez migracji). */
export interface CardCollection {
  seen: string[];
  picks: Record<string, number>;
  banned: string[];
  uniques: string[];
  /** Odkryte sekrety (Księga sekretów). */
  secrets: string[];
}

export interface SaveData {
  version: number;
  /** Porażki pod rząd na początku (akt 1 Ekspedycji, pierwsza głębia Endless < 4 min) bez trybu łatwego: od 2 ekran końca proponuje Łatwy (0.43.2). */
  earlyDeaths?: number;
  settings: Settings;
  records: Record<string, HeroRecord>;
  /** Sloty zapisu per tryb: trwający run (między poziomami albo w trakcie poziomu). */
  slots: Record<SlotMode, RunSnapshot | null>;
  /** Komunikat do pokazania w menu przy następnym uruchomieniu (np. przerwany run). */
  notice: string;
  collection: CardCollection;
  /** Meta-progresja: esencja, drzewko rozwoju, Paragon (z całej esencji), prestiż. */
  meta: MetaState;
  /** Podpowiedzi już pokazane (ui/hints.ts) i ostatnio wybrany bohater (ekran wyboru). Nowe pola bez migracji. */
  seenHints: string[];
  lastHero: string;
  /** Ostatnio wybrany poziom trudności map Ekspedycji (nowa wyprawa zaczyna od niego). */
  exTier: number;
  /** Udręka (0.46): najwyższy odblokowany poziom (0 = brak) i ostatnio wybrany. */
  tormentMax?: number;
  exTorment?: number;
  /** Pakty ryzyka (data/pacts.ts): wybrane na następny run i najwyższy poziom Paktu z pokonanym bossem per bohater. */
  pacts: { chosen: Record<string, number>; best: Record<string, number> };
  /** Zdobyte osiągnięcia (data/achievements.ts) i zabójstwa per wróg (bestiariusz). Nowe pola bez migracji. */
  achievements: string[];
  bestiary: Record<string, number>;
  /** Skórki bohaterów (odznaki Paktu). */
  skins: Record<string, string>;
  /** R4: bohaterowie z wybranym drugim ultimate (ekran bohatera, R). */
  altUlt?: Record<string, boolean>;
  /** Wersja gry, której ekran „What's new” gracz już widział ('' = nowa gra, bez ekranu). */
  seenVersion: string;
  /** Wyczyny (data/feats.ts): ile razy zdobyty każdy. */
  feats: Record<string, number>;
  /** Odblokowania (data/unlocks.ts): bohaterowie, tryby, trudności, kuźnia, zawartość (bronie, pasywki, karty, fuzje, warianty). */
  unlocks: string[];
  /** Punkty odkryć do następnej zawartości (data/unlocks.ts grantDiscovery). */
  discovery?: number;
  /** Najlepszy postęp warunków „w jednym runie” zablokowanej zawartości (id → wartość). */
  unlockBest?: Record<string, number>;
  /** Samouczek ukończony albo pominięty (nowa gra zaczyna od niego). */
  tutorialDone: boolean;
}

type Migration = (old: Record<string, unknown>) => Record<string, unknown>;

/** Koszty pierwszego poziomu węzłów dawnego wspólnego drzewka (zapis v5) — do zwrotu esencji w migracji 5 → 6. */
const V5_NODE_COST: Record<string, number> = {
  m_might: 20, m_crit: 25, m_fury: 30, m_slaughter: 35, m_amount: 400, m_hp: 20, m_armor: 25, m_regen: 30, m_leech: 35, m_ward: 45,
  m_gold: 15, m_xp: 20, m_greed: 25, m_shards: 30, m_luck: 35, m_reroll: 30, m_skip: 25, m_banish: 30, m_cards: 40, m_legacy: 50,
};
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
  // 5 → 6: Rozwój per bohater (tylko Ekspedycja). Dawna esencja, koszt kupionych węzłów i prestiże wracają jako pula do rozdania.
  // Trwający run Ekspedycji ze starą mapą zaczyna się od nowej mapy aktu (węzły map mają teraz modyfikatory).
  5: (old) => {
    const m = (old.meta ?? {}) as { essence?: number; total?: number; nodes?: Record<string, number>; prestige?: number };
    let refund = m.essence ?? 0;
    for (const [id, lvl] of Object.entries(m.nodes ?? {})) {
      for (let l = 0; l < lvl; l++) refund += Math.round((V5_NODE_COST[id] ?? 0) * Math.pow(1.6, l));
    }
    refund += (m.prestige ?? 0) * 1500;
    const slots = (old.slots ?? {}) as Record<string, unknown>;
    const notice = refund > 0 ? 'Rozwój: każdy bohater ma własne drzewko. Twoja esencja czeka do rozdania.' : old.notice;
    return { ...old, version: 6, meta: { heroes: {}, unassigned: refund, legacy: m.total ?? 0 }, slots: { ...slots, expedition: null }, notice };
  },
  // 6 → 7: pakty ryzyka (wybrane na kolejne runy i najwyższy poziom z pokonanym bossem per bohater).
  6: (old) => ({ ...old, version: 7, pacts: { chosen: {}, best: {} } }),
  // 7 → 8 (0.27): zostają tylko Ekspedycja i Endless. Zapisy usuniętych trybów (Hardcore, wyzwanie dnia, Głowy bossów)
  // i ich rekordy są porzucane; reszta postępu (Rozwój, kolekcja, osiągnięcia, bestiariusz, pakty) zostaje.
  7: (old) => {
    const { board: _b, daily: _d, rushBest: _r, ...rest } = old;
    const slots = (old.slots ?? {}) as Record<string, unknown>;
    const records = (old.records ?? {}) as Record<string, Record<string, unknown>>;
    for (const r of Object.values(records)) { delete r.bestDepth; delete r.wins; delete r.runs; }
    const hadHardcore = !!slots.hardcore;
    return {
      ...rest, version: 8, records, slots: { endless: slots.endless ?? null, expedition: slots.expedition ?? null },
      // Gracz z wcześniejszych wersji zobaczy ekran nowości (poprzednia wersja ≠ bieżąca).
      seenVersion: '0.26',
      notice: hadHardcore ? 'Hardcore mode was removed. Your progress, unlocks and Progression stay.' : old.notice,
    };
  },
  // 8 → 9 (0.28): stopniowe odblokowania. Gracz, który już grał, dostaje wszystko; nowy zapis zaczyna od zera.
  8: (old) => {
    const records = Object.values((old.records ?? {}) as Record<string, { bestTime?: number }>);
    const played = records.some((r) => (r.bestTime ?? 0) > 0) || ((old.achievements as unknown[] | undefined)?.length ?? 0) > 0;
    return { ...old, version: 9, unlocks: played ? [...ALL_UNLOCKS] : [], tutorialDone: played };
  },
  // 9 → 10 (0.34.3): opisy w pełnym rozmiarze dla wszystkich (mniejszy tekst bywał nieczytelny); można wrócić w Ustawieniach.
  9: (old) => ({ ...old, version: 10, settings: { ...(old.settings as object), textLarge: true } }),
  // 10 → 11 (0.51): nowe domyślne pod widoczność (prośba gracza) — ataki gracza przygaszone, widok daleko; tylko tam, gdzie
  // zostały stare domyślne (automatyczne / normalne przybliżenie), żeby nie nadpisać świadomego wyboru.
  10: (old) => {
    const s = { ...(old.settings as Record<string, unknown>) };
    if (s.playerFx === undefined || s.playerFx === 'auto') s.playerFx = 'dim';
    if (s.zoom === undefined || s.zoom === 1.25) s.zoom = 1;
    return { ...old, version: 11, settings: s };
  },
  // 11 → 12 (0.61): odblokowania zawartości (bronie, pasywki, karty, fuzje, warianty ewolucji). Gracz, który już grał,
  // dostaje wszystko (jak przy 8 → 9), nowy zapis odkrywa po kolei.
  11: (old) => {
    const records = Object.values((old.records ?? {}) as Record<string, { bestTime?: number }>);
    const played = records.some((r) => (r.bestTime ?? 0) > 0);
    const unlocks = (old.unlocks as string[] | undefined) ?? [];
    return { ...old, version: 12, unlocks: played ? [...new Set([...unlocks, ...ALL_UNLOCKS])] : unlocks };
  },
};

function defaults(): SaveData {
  return {
    version: SAVE_VERSION,
    settings: { volume: 0.5, music: 0.4, shake: true, debug: false, aim: 'mixed', damageNumbers: true, autoPause: true, autoEquip: true, minimap: true, healNumbers: true,
      // Telefon / tablet (dotyk jako główne wejście): domyślnie oszczędne efekty.
      lowFx: typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches,
      playerFx: 'dim', hints: true, hitstop: true, easy: false, elemShapes: false, scaleFill: true, zoom: 1, bgDim: 0.2, bulletOutline: true, playerMarker: true, lang: 'en',
      textLarge: true, reduceFlash: false, flashWarned: false, keys: {},
      hudScale: typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches ? 1.25 : 1 },
    records: {},
    slots: { endless: null, expedition: null },
    notice: '',
    collection: { seen: [], picks: {}, banned: [], uniques: [], secrets: [] },
    meta: { heroes: {}, unassigned: 0 },
    seenHints: [],
    lastHero: '',
    exTier: 0,
    pacts: { chosen: {}, best: {} },
    achievements: [],
    bestiary: {},
    skins: {},
    seenVersion: '',
    feats: {},
    unlocks: [],
    tutorialDone: false,
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
    settings: settingsOf(base.settings, d.settings),
    records: { ...d.records },
    slots: { endless: d.slots?.endless ?? null, expedition: d.slots?.expedition ?? null },
    notice: d.notice ?? '',
    collection: { ...base.collection, ...d.collection },
    meta: { ...base.meta, ...d.meta },
    seenHints: d.seenHints ?? [],
    lastHero: d.lastHero ?? '',
    exTier: d.exTier ?? 0,
    tormentMax: d.tormentMax ?? 0,
    exTorment: d.exTorment ?? 0,
    earlyDeaths: d.earlyDeaths ?? 0,
    pacts: { ...base.pacts, ...d.pacts },
    achievements: d.achievements ?? [],
    bestiary: { ...d.bestiary },
    skins: { ...d.skins },
    altUlt: { ...d.altUlt },
    seenVersion: d.seenVersion ?? '',
    feats: { ...d.feats },
    unlocks: d.unlocks ?? [],
    discovery: d.discovery ?? 0,
    unlockBest: { ...d.unlockBest },
    tutorialDone: d.tutorialDone ?? false,
  };
}

/** Dozwolone rozmiary HUD-u (Ustawienia → Czytelność). */
export const HUD_SCALES = [1, 1.25, 1.5];

/**
 * Ustawienia z zapisu: brakujące pola domyślne; dawne "ukryj pociski gracza" przechodzi w `playerFx: 'hidden'`;
 * rozmiar HUD-u spoza listy (stary zapis bez pola, ręczna edycja) → domyślny.
 */
function settingsOf(base: Settings, saved: Partial<Settings> & { hideProjectiles?: boolean } = {}): Settings {
  const { hideProjectiles, ...rest } = saved;
  return {
    ...base, ...rest, playerFx: rest.playerFx ?? (hideProjectiles ? 'hidden' : 'visible'),
    hudScale: HUD_SCALES.includes(rest.hudScale as number) ? (rest.hudScale as number) : base.hudScale,
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
  return (d.records[heroId] ??= { bestTime: 0, bestKills: 0, bestLevel: 0, bestEndless: 0, bestExpedition: 0, expeditionWins: 0 });
}
