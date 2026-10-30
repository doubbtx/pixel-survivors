/**
 * Scenariusze map (0.56, prototyp w akcie 1 Ekspedycji, po krytyce Agenta 2): zamiast losowych sytuacji mapa ma 3–4
 * zaplanowane „uderzenia” w ułamkach postępu celu (`objectiveProgress`), między nimi zwykłe fale. Każdy szablon (poza
 * Prologiem) ma sprawdzian przeciw staniu w miejscu (szarża, ostrzał terenu) i przeciw słabemu obszarowi albo jednemu celowi
 * (rój, twardziel). Wykonanie: systems/scripts.ts (uderzenia jako sytuacje `beat_*` z ostrzeżeniem i telemetrią sitLog).
 */
export type BeatRole = 'swarm' | 'rush' | 'shoot' | 'tank' | 'bombard' | 'breath';

export interface Beat {
  /** Ułamek postępu celu mapy (0..1), od którego uderzenie może się zacząć. */
  at: number;
  role: BeatRole;
  /** Mnożnik liczebności (1 = zwykła). */
  size?: number;
  /** Szarża: z ilu stron. */
  sides?: number;
}

export interface MapScript {
  id: string;
  name: string;
  /** Krótko, co czeka na mapie (podgląd węzła). */
  desc: string;
  beats: Beat[];
}

export const MAP_SCRIPTS: MapScript[] = [
  {
    id: 'prolog', name: 'Prologue', desc: 'A gentle start: a small swarm, then the first shooters.',
    beats: [{ at: 0.3, role: 'swarm', size: 0.6 }, { at: 0.6, role: 'shoot', size: 0.7 }, { at: 0.75, role: 'breath' }],
  },
  {
    id: 'charge', name: 'Charge', desc: 'Charges from several sides and a tough elite: keep moving, hit hard.',
    beats: [{ at: 0.2, role: 'rush', sides: 2 }, { at: 0.45, role: 'tank' }, { at: 0.6, role: 'breath' }, { at: 0.75, role: 'rush', sides: 3 }],
  },
  {
    id: 'barrage', name: 'Barrage', desc: 'A line of shooters, fire raining on the ground and a swarm: close in and do not stand still.',
    beats: [{ at: 0.2, role: 'shoot' }, { at: 0.4, role: 'bombard' }, { at: 0.55, role: 'swarm' }, { at: 0.7, role: 'breath' }, { at: 0.82, role: 'bombard' }],
  },
];

export const SCRIPT_BY_ID: Record<string, MapScript> = Object.fromEntries(MAP_SCRIPTS.map((s) => [s.id, s]));

/** Szablony do losowania na zwykłe węzły (Prolog tylko na pierwszym rzędzie aktu 1). */
export const SCRIPT_POOL = ['charge', 'barrage'];

/** Wrogowie ról wg biomu (indeks jak w data/levels.ts BIOMES). */
export const ROLE_FOES: Record<'swarm' | 'rush' | 'shoot' | 'tank', Record<number, string[]>> = {
  swarm: { 0: ['bat', 'slime'], 1: ['bat', 'slime'], 2: ['bat', 'slime'], 3: ['bat', 'slime'], 4: ['bat'] },
  rush: { 0: ['boar', 'kamikaze'], 1: ['toad', 'kamikaze'], 2: ['salamander', 'kamikaze'], 3: ['mirror', 'kamikaze'], 4: ['kamikaze'] },
  shoot: { 0: ['eye', 'cultist'], 1: ['eye', 'cultist'], 2: ['scorpion', 'cultist'], 3: ['eye', 'cultist'], 4: ['cultist'] },
  tank: { 0: ['golem', 'boar'], 1: ['golem', 'toad'], 2: ['golem', 'salamander'], 3: ['golem', 'splitter'], 4: ['golem'] },
};
