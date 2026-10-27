import { C } from '../core/palette';
import { rng } from '../core/rng';
import { BAL } from './balance';
import { BIOMES, type LevelDef } from './levels';

/**
 * Ekspedycja: skończona wyprawa przez BAL.expedition.acts aktów. Każdy akt to mapa rzędów po kilka węzłów
 * (ścieżki jak w grach "roguelike deckbuilder") — z węzła w kolumnie `lane` można przejść do kolumn lane-1..lane+1
 * w następnym rzędzie. Ostatni rząd aktu to jeden węzeł bossa. Walki są krótsze niż w Hardcore i bez bossa.
 */
export type NodeKind = 'fight' | 'elite' | 'treasure' | 'shop' | 'anvil' | 'rest' | 'boss';

export interface NodeInfo {
  name: string;
  icon: string;
  color: number;
  desc: string;
}

export const NODE_INFO: Record<NodeKind, NodeInfo> = {
  fight: { name: 'Walka', icon: 'ex_fight', color: C.lgray, desc: 'Krótka walka bez bossa. Nagroda: złoto i karta.' },
  elite: { name: 'Elita', icon: 'ex_elite', color: C.orange, desc: 'Walka z częstymi elitami. Nagroda: przedmiot jak od bossa i karta jak za elitę.' },
  treasure: { name: 'Skarb', icon: 'ex_chest', color: C.yellow, desc: 'Skrzynia z przedmiotem wysokiej jakości, bez walki.' },
  shop: { name: 'Sklep', icon: 'ex_shop', color: C.gold, desc: 'Sklep z przedmiotami, usługami i eliksirami.' },
  anvil: { name: 'Kowadło', icon: 'ex_anvil', color: C.cyan, desc: 'Ulepszanie i przekuwanie przedmiotów, plus darmowe odłamki.' },
  rest: { name: 'Obóz', icon: 'ex_rest', color: C.lime, desc: 'Odpoczynek: leczenie i stały bonus do maks. HP.' },
  boss: { name: 'Boss', icon: 'ex_boss', color: C.salmon, desc: 'Pełny poziom z bossem na końcu aktu.' },
};

/** Węzły z walką (poziom na mapie świata); pozostałe działają od razu z mapy. */
export const isCombat = (k: NodeKind): boolean => k === 'fight' || k === 'elite' || k === 'boss';

export interface ExpeditionState {
  /** Akt 1..BAL.expedition.acts. */
  act: number;
  /** Mapa bieżącego aktu: rzędy węzłów (null = brak węzła w tej kolumnie). Ostatni rząd: tylko boss. */
  map: (NodeKind | null)[][];
  /** Kolumny wybranych węzłów w kolejnych rzędach bieżącego aktu (ostatnia = bieżący węzeł). */
  path: number[];
  /** Ukończone węzły w całej ekspedycji (rekord, esencja). */
  cleared: number;
}

/** Losuje mapę aktu: pierwszy rząd to walki, w środku mieszanka, ostatni rząd przed bossem gwarantuje obóz lub sklep. */
export function rollActMap(): (NodeKind | null)[][] {
  const X = BAL.expedition;
  const map: (NodeKind | null)[][] = [];
  for (let row = 0; row < X.rows - 1; row++) {
    const cells: (NodeKind | null)[] = [];
    for (let lane = 0; lane < X.lanes; lane++) {
      // Środkowa kolumna zawsze istnieje (spójność ścieżek), boczne czasem znikają.
      if (lane !== 1 && rng.chance(X.emptyChance)) { cells.push(null); continue; }
      cells.push(row === 0 ? 'fight' : rng.weighted(X.weights));
    }
    if (row === X.rows - 2 && !cells.some((k) => k === 'rest' || k === 'shop')) cells[1] = rng.chance(0.5) ? 'rest' : 'shop';
    map.push(cells);
  }
  map.push([null, 'boss', null]);
  return map;
}

export function newExpedition(): ExpeditionState {
  return { act: 1, map: rollActMap(), path: [], cleared: 0 };
}

/** Bieżący rząd (-1 = w tym akcie nie wybrano jeszcze węzła). */
export const exRow = (ex: ExpeditionState): number => ex.path.length - 1;

/** Czy z kolumny `from` (rząd wyżej) można przejść do `to`. */
export const linked = (from: number, to: number): boolean => Math.abs(from - to) <= 1;

/** Kolumny następnego rzędu dostępne z bieżącego węzła. */
export function nextLanes(ex: ExpeditionState): number[] {
  const row = ex.map[ex.path.length];
  if (!row) return [];
  const at = ex.path[ex.path.length - 1];
  return row.map((k, lane) => (k && (at === undefined || linked(at, lane)) ? lane : -1)).filter((l) => l >= 0);
}

export function currentNode(ex: ExpeditionState): NodeKind | null {
  const row = exRow(ex);
  return row < 0 ? null : ex.map[row][ex.path[row]];
}

/** Ostatni węzeł aktu (boss) ukończony: następny akt z nową mapą. Zwraca false, gdy to był ostatni akt. */
export function advanceAct(ex: ExpeditionState): boolean {
  if (ex.act >= BAL.expedition.acts) return false;
  ex.act++;
  ex.map = rollActMap();
  ex.path = [];
  return true;
}

/** Głębokość (siła wrogów, jakość łupu, ceny) węzła: rośnie co 2 rzędy i z każdym aktem. */
export function depthAt(act: number, row: number): number {
  return 1 + (act - 1) * BAL.expedition.depthPerAct + Math.floor(Math.max(0, row) / 2);
}

export const nodeDepth = (ex: ExpeditionState): number => depthAt(ex.act, exRow(ex));

/** Poziom dla węzła z walką: biom aktu, krótszy cel bez bossa (walka, elita) albo pełny poziom z bossem. */
export function levelAt(act: number, row: number, kind: NodeKind): LevelDef {
  const X = BAL.expedition;
  const depth = depthAt(act, row);
  const biome = (act - 1) % BIOMES.length;
  const b = BIOMES[biome];
  const boss = kind === 'boss';
  const short = boss ? 1 : X.fightScale;
  const objective = (row + act) % 2 === 0
    ? { kind: 'survive' as const, time: Math.round(X.objTime(act) * short / 10) * 10 }
    : { kind: 'kills' as const, count: Math.round(X.objKills(act) * short / 10) * 10 };
  return {
    depth,
    name: `${b.name}, akt ${act}`,
    biome,
    objective,
    waveOffset: Math.min(240, (depth - 1) * X.waveOffsetPerDepth),
    bossName: b.bossName,
    boss,
    eliteMul: kind === 'elite' ? X.eliteEveryMul : 1,
  };
}

export const nodeLevel = (ex: ExpeditionState): LevelDef => levelAt(ex.act, exRow(ex), currentNode(ex) ?? 'fight');
