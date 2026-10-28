import { C, RAMP, type Ramp } from '../core/palette';

/**
 * Poziomy kampanii są generowane z numeru (głębokości), więc kampania nie ma końca.
 * Co 4 poziomy biomy się powtarzają z kolejnym numerem rzymskim i coraz silniejszymi wrogami.
 */
export type Objective = { kind: 'survive'; time: number } | { kind: 'kills'; count: number };

export interface Biome {
  name: string;
  /** Podłoże: [cień, baza, rozjaśnienie] — kafelki mieszają je ditheringiem. */
  ground: [number, number, number];
  /** Płaty ziemi i wydeptane ścieżki: [cień, baza, jasny środek ścieżki]. */
  dirt: [number, number, number];
  /** Kamienna posadzka ruin: [fuga, płyta, jaśniejsza płyta, krawędź w świetle]. */
  paving: [number, number, number, number];
  /** Kępki trawy / porostów: [ciemny, jasny]. */
  tuft: [number, number];
  /** Kamyki: rampa od cienia do światła. */
  stone: Ramp;
  /** Akcent (kwiaty, iskry, kryształki). */
  accent: number;
  /** Kolor światła otoczenia: wspólna korekta barwna całej sceny (game/render.ts, mnożenie). */
  ambient: number;
  /** Rampa szaty bossa tego biomu. */
  bossRobe: Ramp;
  bossName: string;
}

export const BIOMES: Biome[] = [
  { name: 'Mroczna łąka', ground: [C.teal, C.dgreen, C.green], dirt: [C.ddbrown, C.dbrown, C.brown], paving: [C.navy, C.slate, C.dgray, C.lavender], tuft: [C.teal, C.green], stone: RAMP.stone, accent: C.yellow, ambient: C.slate, bossRobe: RAMP.purple, bossName: 'Władca Otchłani' },
  { name: 'Nocne bagno', ground: [C.black, C.teal, C.dgreen], dirt: [C.black, C.ddbrown, C.dbrown], paving: [C.black, C.navy, C.slate, C.dgray], tuft: [C.dgreen, C.green], stone: RAMP.night, accent: C.cyan, ambient: C.teal, bossRobe: RAMP.green, bossName: 'Królowa Bagien' },
  { name: 'Spalone pustkowie', ground: [C.dbrown, C.brown, C.clay], dirt: [C.ddbrown, C.dbrown, C.tan], paving: [C.ddbrown, C.dbrown, C.brown, C.tan], tuft: [C.ddbrown, C.dbrown], stone: RAMP.wood, accent: C.orange, ambient: C.rust, bossRobe: RAMP.red, bossName: 'Żar Pustkowia' },
  { name: 'Otchłań', ground: [C.black, C.navy, C.slate], dirt: [C.black, C.plum, C.dgray], paving: [C.black, C.navy, C.slate, C.dgray], tuft: [C.plum, C.pink], stone: RAMP.night, accent: C.pink, ambient: C.plum, bossRobe: RAMP.blue, bossName: 'Oko Pustki' },
  // Sekretny biom (VOID_BIOME): poza cyklem kampanii.
  { name: 'Pustka', ground: [C.black, C.black, C.navy], dirt: [C.black, C.navy, C.plum], paving: [C.black, C.navy, C.plum, C.slate], tuft: [C.plum, C.hotpink], stone: RAMP.night, accent: C.white, ambient: C.navy, bossRobe: [C.black, C.plum, C.hotpink, C.white], bossName: 'Serce Pustki' },
];

/** Biomy kampanii powtarzają się co BIOME_CYCLE poziomów; Pustka (VOID_BIOME) jest sekretna. */
export const BIOME_CYCLE = 4;
export const VOID_BIOME = 4;

export interface LevelDef {
  depth: number;
  name: string;
  biome: number;
  objective: Objective;
  /** Przesunięcie czasu fal (s): późniejsze poziomy od startu mają bogatszy skład wrogów. */
  waveOffset: number;
  bossName: string;
  /** Czy po celu pojawia się boss (Ekspedycja: zwykłe walki kończą się po wykonaniu celu). */
  boss: boolean;
  /** Mnożnik odstępu między elitami (mniej = częściej). */
  eliteMul: number;
  /** Ekspedycja: poziom to loch (arena z falami) i flagi mapy na czas poziomu (modyfikatory, bonus, nagroda). */
  dungeon?: boolean;
  flags?: Record<string, number>;
}

const ROMAN = ['', '', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX', ' X'];

/**
 * Poziom (głębia). `isVoid`: sekretny biom Pustka zamiast zwykłego (Run.levelFor: w Endless po pełnym cyklu biomów
 * z Paktem 5+ albo po długim przetrwaniu) — bez leczenia, podwójny łup i złoto.
 */
export function levelDef(depth: number, isVoid = false): LevelDef {
  const biome = isVoid ? VOID_BIOME : (depth - 1) % BIOME_CYCLE;
  const cycle = Math.floor((depth - 1) / BIOME_CYCLE) + 1;
  const suffix = ROMAN[cycle] ?? ` ${cycle}`;
  const b = BIOMES[biome];
  // Nieparzyste poziomy: przetrwaj określony czas; parzyste: zabij określoną liczbę wrogów.
  const objective: Objective = depth % 2 === 1
    ? { kind: 'survive', time: Math.min(300, 180 + 30 * Math.floor(depth / 2)) }
    : { kind: 'kills', count: Math.min(4000, 400 + 350 * depth) };
  return {
    depth,
    name: b.name + suffix,
    biome,
    objective,
    waveOffset: Math.min(240, (depth - 1) * 70),
    bossName: b.bossName + suffix,
    boss: true,
    eliteMul: 1,
    flags: isVoid ? { noHeal: 1, mapLoot: 1, mapGold: 1 } : undefined,
  };
}

export function objectiveLabel(o: Objective): string {
  return o.kind === 'survive' ? `Przetrwaj ${Math.floor(o.time / 60)}:${String(o.time % 60).padStart(2, '0')}` : `Pokonaj ${o.count} wrogów`;
}
