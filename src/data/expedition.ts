import { C } from '../core/palette';
import { rng } from '../core/rng';
import type { Stats } from '../entities/types';
import { BAL } from './balance';
import { BIOMES, BIOME_CYCLE, VOID_BIOME, type LevelDef, type Objective } from './levels';
import { ELITE_MODS, eliteCompatible } from './enemies';
import type { Element } from './elements';

/**
 * Ekspedycja: skończona wyprawa przez BAL.expedition.acts aktów. Każdy akt to mapa rzędów po kilka węzłów —
 * z węzła w kolumnie `lane` można przejść do kolumn lane-1..lane+1 w następnym rzędzie. Ostatni rząd aktu to boss.
 *
 * Węzły z walką to „mapy” jak w Path of Exile: nazwa, rzadkość (Zwykła / Magiczna / Rzadka) i modyfikatory ryzyka
 * (silniejsi lub szybsi wrogowie, gęstsze salwy...) — każdy dokłada nagrodę (więcej łupu, lepsza jakość, więcej esencji).
 * Do tego bonus mapy (stała zaleta). Efekty działają przez flagi runu na czas poziomu (`LevelDef.flags`).
 *
 * Sekret: w aktach 2-3 czasem pojawia się węzeł „?” (Rozdarcie: walka w Pustce). Wygrana daje Klucz Pustki, który po
 * ostatnim akcie otwiera sekretny akt 4 w biomie Pustka.
 */
export type NodeKind = 'fight' | 'elite' | 'dungeon' | 'treasure' | 'shop' | 'anvil' | 'rest' | 'shrine' | 'boss' | 'secret' | 'ambush' | 'hunt' | 'vault';

export interface NodeInfo {
  name: string;
  icon: string;
  color: number;
  desc: string;
}

export const NODE_INFO: Record<NodeKind, NodeInfo> = {
  fight: { name: 'Mapa', icon: 'ex_fight', color: C.lgray, desc: 'Krótka walka bez bossa. Nagroda: złoto i karta.' },
  elite: { name: 'Mapa elit', icon: 'ex_elite', color: C.orange, desc: 'Walka z częstymi elitami i minibossem. Nagroda: skrzynia elity i karta jak za elitę.' },
  dungeon: { name: 'Loch', icon: 'ex_dungeon', color: C.pink, desc: 'Arena z falami wrogów i strażnikiem. Nagroda: dwie skrzynie i złoto.' },
  treasure: { name: 'Skarb', icon: 'ex_chest', color: C.yellow, desc: 'Skrzynia z przedmiotem wysokiej jakości, bez walki.' },
  shop: { name: 'Sklep', icon: 'ex_shop', color: C.gold, desc: 'Sklep z przedmiotami, usługami i eliksirami.' },
  anvil: { name: 'Kowadło', icon: 'ex_anvil', color: C.cyan, desc: 'Ulepszanie i przekuwanie przedmiotów, plus darmowe odłamki.' },
  rest: { name: 'Obóz', icon: 'ex_rest', color: C.lime, desc: 'Rest: heals, raises max HP for good and lets you pick one of two bonuses for the next map (dungeons do not use it up).' },
  shrine: { name: 'Kapliczka', icon: 'ex_shrine', color: C.yellow, desc: 'Pick one of two blessings for the next few maps.' },
  boss: { name: 'Boss', icon: 'ex_boss', color: C.salmon, desc: 'Pełny poziom z bossem na końcu aktu.' },
  ambush: { name: 'Ambush', icon: 'ex_ambush', color: C.salmon, desc: 'A short survival map: every few seconds a ring of enemies closes in, the last ones with elites. Reward: gold, card and an elite chest.' },
  hunt: { name: 'Hunt', icon: 'ex_hunt', color: C.orange, desc: 'The biome miniboss with an escort, tougher than usual. Kill it before it escapes. Reward: a boss chest.' },
  vault: { name: 'Vault', icon: 'ex_vault', color: C.gold, desc: 'An arena with waves of wardens and treasure at the end (a chance for a unique item).' },
  secret: { name: '???', icon: 'ex_secret', color: C.hotpink, desc: 'Coś tu nie pasuje. Ścieżka, której nie było na mapie...' },
};

/** Węzły z walką (mapy); pozostałe działają od razu z mapy wyprawy. */
export const isCombat = (k: NodeKind): boolean => k === 'fight' || k === 'elite' || k === 'dungeon' || k === 'boss' || k === 'secret' || k === 'ambush' || k === 'hunt' || k === 'vault';

/** Węzły-areny (loch, skarbiec): krótkie, więc nagroda modyfikatorów mniejsza (BAL.expedition.arenaReward). */
export const isArena = (k: NodeKind): boolean => k === 'dungeon' || k === 'vault';

/** Biom aktu: kolejne biomy kampanii, sekretny akt 4 w Pustce. */
export const actBiome = (act: number): number => (act > BAL.expedition.acts ? VOID_BIOME : (act - 1) % BIOME_CYCLE);

// ============================ modyfikatory i bonusy map ============================

/** Modyfikator ryzyka: flagi runu (lista w data/cards.ts) i nagroda w punktach ilości łupu (%). */
export interface MapMod {
  id: string;
  name: string;
  desc: string;
  flags: Record<string, number>;
  reward: number;
}

export const MAP_MODS: MapMod[] = [
  { id: 'hp', name: 'Opancerzeni', desc: 'Wrogowie mają +40% HP', flags: { enemyHp: 0.4 }, reward: 15 },
  { id: 'dmg', name: 'Okrutni', desc: 'Wrogowie zadają +30% obrażeń', flags: { enemyDmg: 0.3 }, reward: 18 },
  { id: 'fast', name: 'Zwinni', desc: 'Wrogowie są 20% szybsi', flags: { enemySpeed: 0.2 }, reward: 14 },
  { id: 'bullets', name: 'Nawałnica', desc: 'Salwy wrogów mają +30% pocisków', flags: { bulletDensity: 0.3 }, reward: 20 },
  { id: 'elites', name: 'Hordy elit', desc: 'Elity pojawiają się 2x częściej', flags: { eliteRate: 1 }, reward: 20 },
  { id: 'frail', name: 'Kruchość', desc: 'Otrzymujesz +20% obrażeń', flags: { dmgTaken: -0.2 }, reward: 16 },
  { id: 'drought', name: 'Susza', desc: 'Leczenie słabsze o 50%', flags: { healCut: 0.5 }, reward: 16 },
  { id: 'crowd', name: 'Tłum', desc: '+30% wrogów naraz', flags: { enemyCount: 0.3 }, reward: 14 },
];
export const MAP_MOD_BY_ID: Record<string, MapMod> = Object.fromEntries(MAP_MODS.map((m) => [m.id, m]));

/** Bonus mapy (zaleta): flagi runu albo nagroda po ukończeniu (obsługa w ui/game-screen.ts). */
export interface MapBonus {
  id: string;
  name: string;
  desc: string;
  flags?: Record<string, number>;
}

export const MAP_BONUSES: MapBonus[] = [
  { id: 'shrines', name: 'Święta ziemia', desc: 'Kapliczki pojawiają się 2x częściej', flags: { shrineRate: 1 } },
  { id: 'gold', name: 'Żyła złota', desc: 'Złote szlamy częściej, +50% złota', flags: { goldSlimeRate: 3, mapGold: 0.5 } },
  { id: 'xp', name: 'Mądrość przodków', desc: '+40% doświadczenia', flags: { mapXp: 0.4 } },
  { id: 'chest', name: 'Ukryty skarb', desc: 'Po ukończeniu dodatkowa skrzynia jak od bossa' },
  { id: 'card', name: 'Wróżba', desc: 'Po ukończeniu dodatkowy wybór karty' },
  { id: 'heal', name: 'Źródło', desc: 'Po ukończeniu leczenie 40% HP' },
];
export const MAP_BONUS_BY_ID: Record<string, MapBonus> = Object.fromEntries(MAP_BONUSES.map((b) => [b.id, b]));

/** Rzadkość mapy: liczba modyfikatorów (min-max) i kolor. */
export const MAP_RARITY = [
  { name: 'Zwykła', color: C.lgray, mods: [0, 0] },
  { name: 'Magiczna', color: C.blue, mods: [1, 2] },
  { name: 'Rzadka', color: C.yellow, mods: [3, 4] },
  { name: 'Koszmarna', color: C.red, mods: [5, 6] },
] as const;

/** Nazwy map w biomach aktów (kolejność jak BIOMES). */
const MAP_NAMES: string[][] = [
  ['Zarośnięty szlak', 'Stare kurhany', 'Mglisty gaj', 'Ruiny młyna', 'Polana wisielców', 'Kamienny krąg', 'Opuszczony sad', 'Wilcze doły'],
  ['Topielisko', 'Zgniłe mokradła', 'Chata wiedźmy', 'Zatopiona wieś', 'Trzęsawisko', 'Wyspa grzybów', 'Czarna grobla', 'Gnijący las'],
  ['Spalona osada', 'Popielne wydmy', 'Kuźnia olbrzymów', 'Szklane pole', 'Wąwóz żaru', 'Ołtarz słońca', 'Suche koryto', 'Dymiące szczeliny'],
  ['Brama pustki', 'Wiszące wyspy', 'Gwiezdny most', 'Krypta echa', 'Lustrzane jezioro', 'Tron cieni', 'Rozdarte niebo', 'Ostatnia iglica'],
  ['Nicość', 'Pęknięty horyzont', 'Morze ciszy', 'Szczelina', 'Zapomniane echo', 'Czarne słońce', 'Próg', 'Bez imienia'],
];

/** Błogosławieństwa kapliczek Ekspedycji: statystyki na kilka kolejnych map. */
export const EX_BLESSINGS: { id: string; name: string; desc: string; stats: Partial<Stats> }[] = [
  { id: 'might', name: 'Siła', desc: '+25% obrażeń', stats: { might: 0.25 } },
  { id: 'haste', name: 'Zręczność', desc: '+25% szybkości ataku', stats: { atkSpeed: 0.25 } },
  { id: 'wisdom', name: 'Mądrość', desc: '+40% doświadczenia', stats: { growth: 0.4 } },
  { id: 'vigor', name: 'Żywotność', desc: '+25 maks. HP i +1 HP/s', stats: { maxHp: 25, regen: 1 } },
  { id: 'luck', name: 'Fortuna', desc: '+30% złota i +1 karta przy awansie', stats: { greed: 0.3, choices: 1 } },
];

/** Bonus z obozu (węzeł Odpoczynek, 0.30.1): mocniejszy niż kapliczka, ale tylko na następną mapę z walką (loch go nie zużywa). */
export const CAMP_BUFFS: { id: string; name: string; desc: string; stats: Partial<Stats> }[] = [
  { id: 'whetstone', name: 'Sharpened blades', desc: '+35% damage', stats: { might: 0.35 } },
  { id: 'drill', name: 'Morning drill', desc: '+35% attack speed', stats: { atkSpeed: 0.35 } },
  { id: 'feast', name: 'Hearty meal', desc: '+40 max HP and +2 HP/s', stats: { maxHp: 40, regen: 2 } },
  { id: 'scout', name: 'Scouted ahead', desc: '+60% experience and +25% gold', stats: { growth: 0.6, greed: 0.25 } },
  { id: 'calm', name: 'Quiet night', desc: '+20% damage and +20% movement speed', stats: { might: 0.2, speedBonus: 0.2 } },
];

/** Węzeł mapy wyprawy. Mapy z walką mają nazwę, rzadkość, modyfikatory i bonus. */
export interface MapNode {
  kind: NodeKind;
  name?: string;
  rarity?: number;
  mods?: string[];
  /** Wylosowane modyfikatory dla każdego poziomu trudności (MAP_RARITY); gracz wybiera poziom przed wejściem (chooseTier). */
  tiers?: string[][];
  bonus?: string;
  /** Powinowactwo żywiołu (0.38): mapa podatna albo odporna na żywioł — decyzja zależna od żywiołów buildu. */
  affinity?: { el: Element; kind: 'weak' | 'resist' };
  /** Stałe cechy elit (Mapa elit, Zasadzka), widoczne na mapie. */
  eliteMods?: string[];
}

export interface ExpeditionState {
  /** Akt 1..BAL.expedition.acts. */
  act: number;
  /** Mapa bieżącego aktu: rzędy węzłów (null = brak węzła w tej kolumnie). Ostatni rząd: tylko boss. */
  map: (MapNode | null)[][];
  /** Kolumny wybranych węzłów w kolejnych rzędach bieżącego aktu (ostatnia = bieżący węzeł). */
  path: number[];
  /** Ukończone węzły w całej ekspedycji (rekord, esencja). */
  cleared: number;
  /** Suma nagród modyfikatorów ukończonych map (punkty %, mnoży esencję). */
  bonus: number;
  /** Błogosławieństwo kapliczki i liczba map, na które jeszcze działa. */
  blessing: { id: string; maps: number } | null;
  /** Bonus z obozu (CAMP_BUFFS) na następną mapę z walką (poza lochem). */
  camp?: string | null;
  /** Wybór czekający na mapie (0.35): obóz albo kapliczka proponuje dwie opcje (id z CAMP_BUFFS / EX_BLESSINGS). */
  offer?: { kind: 'rest' | 'shrine'; ids: string[] } | null;
  /** Klucz Pustki (wygrane Rozdarcie): po ostatnim akcie otwiera sekretny akt 4. */
  voidKey?: boolean;
  /** Poziom trudności map (MAP_RARITY) wybrany przez gracza na początku aktu (0.35: potem zablokowany do końca aktu). */
  tier?: number;
  /** Odblokowania (data/unlocks.ts) przeniesione do wyprawy: najwyższy dostępny poziom trudności i brak kowadła/kuźni. */
  maxTier?: number;
  noForge?: boolean;
}

/** Mapa z walką: nazwa z biomu, poziom trudności wybrany przez gracza, modyfikatory i bonus. */
function rollMapNode(kind: NodeKind, act: number, tier: number, used: Set<string>): MapNode {
  const X = BAL.expedition;
  const names = MAP_NAMES[actBiome(act)].filter((n) => !used.has(n));
  const name = names.length ? rng.pick(names) : NODE_INFO[kind].name;
  used.add(name);
  // Modyfikatory każdego poziomu losowane z góry, gracz wybiera tylko poziom.
  const tiers = MAP_RARITY.map(({ mods: [lo, hi] }) => {
    const pool = MAP_MODS.map((m) => m.id), out: string[] = [];
    for (let n = rng.int(lo, hi); n > 0 && pool.length; n--) out.push(pool.splice(Math.floor(rng.next() * pool.length), 1)[0]);
    return out;
  });
  const bonus = kind === 'boss' || rng.chance(X.noBonusChance) ? undefined : rng.pick(MAP_BONUSES).id;
  return { kind, name, rarity: tier, mods: tiers[tier], tiers, bonus };
}

/** Poziom trudności można zmienić tylko przed pierwszym węzłem aktu (0.35: bez przełączania przed każdą mapą). */
export const tierOpen = (ex: ExpeditionState): boolean => ex.path.length === 0;

/** Wybór poziomu trudności wyprawy: obowiązuje dla wszystkich jeszcze nieodwiedzonych map (także w kolejnych aktach). */
export function chooseTier(ex: ExpeditionState, tier: number): boolean {
  if (!tierOpen(ex) || tier < 0 || tier >= MAP_RARITY.length || tier > (ex.maxTier ?? MAP_RARITY.length - 1) || (ex.tier ?? 0) === tier) return false;
  ex.tier = tier;
  for (const row of ex.map.slice(exRow(ex) + 1)) {
    for (const m of row) {
      if (!m?.tiers) continue;
      m.rarity = tier;
      m.mods = m.tiers[tier];
    }
  }
  return true;
}

/** Losuje mapę aktu: pierwszy rząd to walki, w środku mieszanka, ostatni rząd przed bossem gwarantuje obóz lub sklep w zasięgu. */
export function rollActMap(act: number, tier: number, noForge = false): (MapNode | null)[][] {
  const X = BAL.expedition;
  const used = new Set<string>();
  const map: (MapNode | null)[][] = [];
  const mid = Math.floor((X.lanes - 1) / 2);
  for (let row = 0; row < X.rows - 1; row++) {
    const kinds: (NodeKind | null)[] = [];
    for (let lane = 0; lane < X.lanes; lane++) {
      // Środkowe kolumny zawsze istnieją (spójność ścieżek), skrajne czasem znikają.
      if ((lane === 0 || lane === X.lanes - 1) && rng.chance(X.emptyChance)) { kinds.push(null); continue; }
      const k: NodeKind = row === 0 ? 'fight' : rng.weighted(X.weights);
      // Kowadło jeszcze niezdobyte (pierwszy boss): zamiast niego obóz.
      kinds.push(noForge && k === 'anvil' ? 'rest' : k);
    }
    // Przed bossem obóz albo sklep osiągalny z każdej kolumny (sąsiednie kolumny): po jednym w każdej połowie mapy.
    if (row === X.rows - 2) {
      const calm = (k: NodeKind | null) => k === 'rest' || k === 'shop';
      for (const [a, b] of [[0, mid], [mid + 1, X.lanes - 1]]) {
        if (!kinds.slice(a, b + 1).some(calm)) kinds[a === 0 ? mid : mid + 1] = rng.chance(0.5) ? 'rest' : 'shop';
      }
    }
    map.push(kinds.map((k) => (!k ? null : isCombat(k) ? rollMapNode(k, act, tier, used) : { kind: k })));
  }
  rollAffinities(map, act);
  // Ukryty węzeł „?” w aktach 2-3 (zamiast losowego węzła środkowego rzędu).
  if (act >= 2 && act <= X.acts && rng.chance(X.secretChance)) {
    const row = rng.int(1, X.rows - 3), lanes = map[row].map((n, l) => (n ? l : -1)).filter((l) => l >= 0);
    map[row][rng.pick(lanes)] = { kind: 'secret', name: 'Rozdarcie', rarity: 2 };
  }
  const boss: (MapNode | null)[] = Array.from({ length: X.lanes }, () => null);
  boss[mid] = rollMapNode('boss', act, tier, used);
  map.push(boss);
  return map;
}

export function newExpedition(tier: number, maxTier = MAP_RARITY.length - 1, noForge = false): ExpeditionState {
  tier = Math.min(tier, maxTier);
  return { act: 1, map: rollActMap(1, tier, noForge), path: [], cleared: 0, bonus: 0, blessing: null, tier, maxTier, noForge };
}

/** Bieżący rząd (-1 = w tym akcie nie wybrano jeszcze węzła). */
export const exRow = (ex: ExpeditionState): number => ex.path.length - 1;

/** Czy z kolumny `from` (rząd wyżej) można przejść do `to`; boss jest osiągalny z każdej kolumny. */
export const linked = (from: number, to: number, toBoss = false): boolean => toBoss || Math.abs(from - to) <= 1;

/** Kolumny następnego rzędu dostępne z bieżącego węzła. */
export function nextLanes(ex: ExpeditionState): number[] {
  const row = ex.map[ex.path.length];
  if (!row) return [];
  const at = ex.path[ex.path.length - 1];
  const boss = ex.path.length === ex.map.length - 1;
  return row.map((k, lane) => (k && (at === undefined || linked(at, lane, boss)) ? lane : -1)).filter((l) => l >= 0);
}

export function currentMap(ex: ExpeditionState): MapNode | null {
  const row = exRow(ex);
  return row < 0 ? null : ex.map[row][ex.path[row]];
}

export const currentNode = (ex: ExpeditionState): NodeKind | null => currentMap(ex)?.kind ?? null;

/** Ostatni węzeł aktu (boss) ukończony: następny akt z nową mapą. Zwraca false, gdy to był ostatni akt (akt 4 tylko z Kluczem Pustki). */
export function advanceAct(ex: ExpeditionState): boolean {
  if (ex.act > BAL.expedition.acts || (ex.act === BAL.expedition.acts && !ex.voidKey)) return false;
  ex.act++;
  ex.map = rollActMap(ex.act, ex.tier ?? 0, ex.noForge);
  ex.path = [];
  return true;
}

/** Głębokość (siła wrogów, jakość łupu, ceny) węzła: rośnie co 2 rzędy i z każdym aktem. */
export function depthAt(act: number, row: number): number {
  return 1 + (act - 1) * BAL.expedition.depthPerAct + Math.floor(Math.max(0, row) / 2);
}

export const nodeDepth = (ex: ExpeditionState): number => depthAt(ex.act, exRow(ex));

/** Suma nagród modyfikatorów mapy (punkty %). */
export const mapReward = (m: MapNode): number => (m.mods ?? []).reduce((s, id) => s + (MAP_MOD_BY_ID[id]?.reward ?? 0), 0) * (isArena(m.kind) ? BAL.expedition.arenaReward : 1)
  + (m.affinity?.kind === 'resist' ? BAL.expedition.resistReward : 0);

/** Flagi mapy na czas poziomu: modyfikatory, bonus, nagroda (ilość i jakość łupu). */
/** Ekspedycja: większy tłum wrogów niż w kampanii (rośnie z aktem), dodany do modyfikatorów mapy. */
function crowded(f: Record<string, number>, act: number): Record<string, number> {
  return { ...f, enemyCount: (f.enemyCount ?? 0) + BAL.expedition.crowd(act) };
}

function mapFlags(m: MapNode): Record<string, number> {
  const f: Record<string, number> = {};
  const add = (o: Record<string, number> | undefined) => { for (const [k, v] of Object.entries(o ?? {})) f[k] = (f[k] ?? 0) + v; };
  for (const id of m.mods ?? []) add(MAP_MOD_BY_ID[id]?.flags);
  add(m.bonus ? MAP_BONUS_BY_ID[m.bonus]?.flags : undefined);
  const r = mapReward(m) / 100;
  if (r > 0) add({ mapLoot: r, itemLuck: r * BAL.expedition.rewardLuck });
  return f;
}

/** Poziom dla węzła z walką: biom aktu, krótszy cel bez bossa (mapa, elita), loch albo pełny poziom z bossem. */
export function levelAt(act: number, row: number, m: MapNode): LevelDef {
  const X = BAL.expedition;
  const depth = depthAt(act, row);
  // Rozdarcie: walka w Pustce, silniejsi wrogowie, częste elity i więcej łupu.
  const biome = m.kind === 'secret' ? VOID_BIOME : actBiome(act);
  const b = BIOMES[biome];
  const boss = m.kind === 'boss';
  const short = boss ? 1 : X.fightScale;
  const objective: Objective = m.kind === 'hunt' ? { kind: 'hunt', time: X.huntLimit }
    : m.kind === 'ambush' ? { kind: 'survive', time: Math.round(X.objTime(act) * short * X.ambushScale / 10) * 10 }
    : (row + act) % 2 === 0
      // Zwykła walka „przetrwaj”: albo zabij tylu, ilu na mapie „pokonaj” (silny build kończy szybciej, 0.40).
      ? { kind: 'survive', time: Math.round(X.objTime(act) * (boss ? 1 : X.surviveScale) / 10) * 10, kills: boss ? undefined : Math.round(X.objKills(act) * short * X.surviveKills / 10) * 10 }
      : { kind: 'kills', count: Math.round(X.objKills(act) * short / 10) * 10 };
  const f = m.kind === 'secret' ? { enemyHp: 0.5, enemyDmg: 0.3, mapLoot: 1, mapGold: 1 } : mapFlags(m);
  return {
    depth,
    name: m.name ?? `${b.name}, akt ${act}`,
    biome,
    objective,
    waveOffset: Math.min(240, (depth - 1) * X.waveOffsetPerDepth),
    bossName: b.bossName,
    boss,
    eliteMul: m.kind === 'elite' || m.kind === 'secret' ? X.eliteEveryMul : 1,
    dungeon: isArena(m.kind),
    dungeonKind: m.kind === 'vault' ? 'vault' : undefined,
    ambush: m.kind === 'ambush',
    weak: m.affinity?.kind === 'weak' ? m.affinity.el : undefined,
    resist: m.affinity?.kind === 'resist' ? m.affinity.el : undefined,
    eliteMods: m.eliteMods,
    // Polowanie: rzadsze zwykłe fale (pojedynek z minibossem).
    flags: crowded(m.kind === 'hunt' ? { ...f, enemyCount: (f.enemyCount ?? 0) + X.huntCrowd } : f, act),
  };
}

export const nodeLevel = (ex: ExpeditionState): LevelDef => levelAt(ex.act, exRow(ex), currentMap(ex) ?? { kind: 'fight' });

const AFFINITY_KINDS = new Set<NodeKind>(['fight', 'elite', 'ambush', 'hunt']);
const ELEMS: Element[] = ['fire', 'ice', 'lightning', 'poison'];

/**
 * Powinowactwa żywiołów i stałe cechy elit (0.38). Bez powinowactwa w pierwszym rzędzie i w rzędzie przed bossem;
 * najwyżej jedna odporność na rząd i zawsze do ominięcia (z każdego węzła poprzedniego rzędu da się dojść do węzła bez
 * odporności). Na mapie odpornej elity nie są Pancerne (odporność × pancerz to ściana, nie wybór).
 */
function rollAffinities(map: (MapNode | null)[][], act: number): void {
  const X = BAL.expedition;
  // Rzędy 1..rows-3 (mapa bez rzędu bossa ma rows-1 rzędów; ostatni z nich to rząd przed bossem).
  for (let row = 1; row < map.length - 1; row++) {
    let resisted = false;
    map[row].forEach((m, lane) => {
      if (!m || !AFFINITY_KINDS.has(m.kind)) return;
      const r = rng.next();
      if (r < X.resistChance && !resisted && avoidable(map, row, lane)) { m.affinity = { el: rng.pick(ELEMS), kind: 'resist' }; resisted = true; }
      else if (r >= X.resistChance && r < X.resistChance + X.weakChance) m.affinity = { el: rng.pick(ELEMS), kind: 'weak' };
    });
  }
  for (const row of map) for (const m of row) {
    if (!m || (m.kind !== 'elite' && m.kind !== 'ambush')) continue;
    // Akt 1: jedna cecha i bez cech zachowania (R3); dalej dwie zgodne.
    const pool = Object.keys(ELITE_MODS).filter((k) => !(k === 'armored' && m.affinity?.kind === 'resist') && (act > 1 || !ELITE_MODS[k].kind));
    const a = rng.pick(pool);
    m.eliteMods = act === 1 ? [a] : [a, rng.pick(pool.filter((k) => eliteCompatible([a], k)))];
  }
}

/** Czy odporność w (row, lane) da się ominąć: każdy węzeł rzędu wyżej, który tu prowadzi, ma też inny dostępny węzeł. */
function avoidable(map: (MapNode | null)[][], row: number, lane: number): boolean {
  return map[row - 1].every((p, from) => !p || !linked(from, lane) || map[row].some((n, l) => n && l !== lane && linked(from, l)));
}

/** Dwie różne opcje do wyboru (obóz, kapliczka). */
export function rollOffer(kind: 'rest' | 'shrine', n = 2): { kind: 'rest' | 'shrine'; ids: string[] } {
  const pool = (kind === 'rest' ? CAMP_BUFFS : EX_BLESSINGS).map((b) => b.id), ids: string[] = [];
  while (ids.length < n && pool.length) ids.push(pool.splice(Math.floor(rng.next() * pool.length), 1)[0]);
  return { kind, ids };
}
