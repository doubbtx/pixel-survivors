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
  /** Kępki trawy / porostów: [ciemny, jasny]. */
  tuft: [number, number];
  /** Kamyki: rampa od cienia do światła. */
  stone: Ramp;
  /** Akcent (kwiaty, iskry, kryształki). */
  accent: number;
  /** Rampa szaty bossa tego biomu. */
  bossRobe: Ramp;
  bossName: string;
}

export const BIOMES: Biome[] = [
  { name: 'Mroczna łąka', ground: [C.teal, C.dgreen, C.green], tuft: [C.teal, C.green], stone: RAMP.stone, accent: C.yellow, bossRobe: RAMP.purple, bossName: 'Władca Otchłani' },
  { name: 'Nocne bagno', ground: [C.black, C.teal, C.dgreen], tuft: [C.dgreen, C.green], stone: RAMP.night, accent: C.cyan, bossRobe: RAMP.green, bossName: 'Królowa Bagien' },
  { name: 'Spalone pustkowie', ground: [C.dbrown, C.brown, C.clay], tuft: [C.ddbrown, C.dbrown], stone: RAMP.wood, accent: C.orange, bossRobe: RAMP.red, bossName: 'Żar Pustkowia' },
  { name: 'Otchłań', ground: [C.black, C.navy, C.slate], tuft: [C.plum, C.pink], stone: RAMP.night, accent: C.pink, bossRobe: RAMP.blue, bossName: 'Oko Pustki' },
];

export interface LevelDef {
  depth: number;
  name: string;
  biome: number;
  objective: Objective;
  /** Przesunięcie czasu fal (s): późniejsze poziomy od startu mają bogatszy skład wrogów. */
  waveOffset: number;
  bossName: string;
}

const ROMAN = ['', '', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX', ' X'];

export function levelDef(depth: number): LevelDef {
  const biome = (depth - 1) % BIOMES.length;
  const cycle = Math.floor((depth - 1) / BIOMES.length) + 1;
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
  };
}

export function objectiveLabel(o: Objective): string {
  return o.kind === 'survive' ? `Przetrwaj ${Math.floor(o.time / 60)}:${String(o.time % 60).padStart(2, '0')}` : `Pokonaj ${o.count} wrogów`;
}
