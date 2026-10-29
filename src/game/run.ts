import { Pool } from '../core/pool';
import { SpatialHash } from '../core/spatial';
import { rng } from '../core/rng';
import { sfx } from '../core/audio';
import type { Input } from '../core/input';
import type { AimMode, PlayerFx } from '../core/save';
import { VIEW_W, VIEW_H } from '../core/renderer';
import { C } from '../core/palette';
import { BAL } from '../data/balance';
import { HERO_BY_ID, evolveAbility, type HeroDef, type AbilitySlot } from '../data/heroes';
import { WEAPON_BY_ID } from '../data/weapons';
import { PASSIVE_BY_ID } from '../data/passives';
import { levelDef, BIOME_CYCLE, VOID_BIOME, type LevelDef } from '../data/levels';
import type { FeatId } from '../data/feats';
import { resetLevelFeats, featsOnBoss, featsOnKill, featsOnWin } from '../systems/feats';
import { nodeLevel, EX_BLESSINGS, CAMP_BUFFS, type ExpeditionState } from '../data/expedition';
import { AUGMENT_BY_ID, augmentWorks } from '../data/augments';
import type { WeaponBonus } from '../data/upgrades';
import type { ShopState } from '../data/shop';
import { SRC_ELEMENT, ELEM, damageElement, type Element } from '../data/elements';
import type { MetaBonus } from '../data/meta';
import { CARD_BY_ID, type CardSource, type HookName, type CardHooks, type Tag } from '../data/cards';
import { SYNERGIES, VERSATILITY, tagPoints, tierOf, type SynergyTier } from '../data/synergies';
import { equippedSupers, equippedUniques, implicitOf, forgeMul, salvageGold, salvageShards, slotKind, rollItem, rollUnique, BASE_BY_ID, RARITIES, type Item, type SlotId, type LootSource } from '../data/items';
import {
  SLOT, SLOT_COUNT, type Stats, type Player, type Enemy, type Projectile, type EnemyBullet, type Gem, type Pickup,
  type Particle, type DmgNum, type Zone, type Fx, type WeaponInst, type PassiveInst, type AbilityInst, type PickupKind,
  type Turret, type Minion, type CardInst, type ProjKind,
} from '../entities/types';
import { fmt } from '../util/format';
import { updatePlayer } from '../systems/player';
import { updateAbilities, castAbility } from '../systems/abilities';
import { updateWeapons } from '../systems/weapons';
import { updateSpawner, spawnEnemy } from '../systems/spawner';
import { situationKill, type Spot } from '../systems/situations';
import { updateEnemies } from '../systems/enemies';
import { updateProjectiles, updateEnemyBullets } from '../systems/projectiles';
import { updateZones } from '../systems/zones';
import { updatePickups } from '../systems/pickups';
import { updateEffects } from '../systems/effects';
import { updateTurrets } from '../systems/turrets';
import { updateMinions, spawnMinion } from '../systems/minions';
import { updateEvents, enterDungeon, type MapObject, type Buff, type Dungeon } from '../systems/events';
import { updateResource, resourceOnHit, resourceOnHurt, resourceOnKill, resourceOnHeal, resourceDamageMul, resourceCrit, resourceTakenMul, rhythmGain } from '../systems/resource';
import { updateTasks, taskOnHurt, taskOnKill, type Task } from '../systems/tasks';
import { updatePower } from '../systems/powers';
import { updateTerrain, terrainBlast, type TerrainObj, type Arena } from '../systems/terrain';
import { BOSS_POWER_BY_ID, BIOME_MINIBOSS } from '../data/enemies';
import { PACTS, pactLevel } from '../data/pacts';
import { equippedAwakenings, forgeKillDrops, forgeBossDrops, grantMat, emptyMats, emptyScrolls } from '../systems/forge';
import type { MatId, ScrollId } from '../data/forge';
import { updateSecrets, activeSecrets } from '../systems/secrets';
import { PACIFIST_KEY } from '../data/secrets';
import { secretsOnKill } from '../systems/mapsecrets';
import { updateLevelEvents, eventFlags, comboOnKill, comboOnHurt, type LevelEventId } from '../systems/levelevents';

/** Próbka telemetrii runu (Run.telemetry): czasy (całkowity, poziomu, fal), poziom, mnożnik siły, DPS, HP i obrażenia przyjęte (ułamki maks. HP), zabójstwa od ostatniej próbki, wrogowie na mapie. */
export interface TelemetrySample {
  t: number; lt: number; wt: number; lvl: number; depth: number; pm: number; dps: number; hp: number; taken: number; kills: number; alive: number;
  /** Średni czas życia zabitych zwykłych wrogów i elit (s, -1 = brak), użycia ulta, mnożnik XP, cel poziomu. */
  life: number; eLife: number; ult: number; growth: number; goal: string;
  /** Powinowactwo mapy ('weak:fire', 'resist:ice' albo ''). */
  aff: string;
  /** Sytuacja w toku (id) albo ''. */
  sit: string;
}

export const DEFAULT_STATS: Stats = {
  maxHp: 100, regen: 0, armor: 0, speed: 58, speedBonus: 0, might: 1, area: 1, cdr: 0, amount: 0,
  duration: 1, projSpeed: 1, magnet: 1, crit: 0.05, critMult: 2, lifesteal: 0, luck: 0, choices: 0, growth: 1, greed: 1, atkSpeed: 0, elemPower: 0,
};

/** Numer progu synergii na banerze. */
const ROMAN_TIER = ['', 'I', 'II', 'III', 'IV'];

/**
 * Źródła zadające procent HP wroga — pomijane w pomiarze siły buildu (inaczej mocniejsi wrogowie podbijaliby DPS),
 * razem z obrażeniami wywołanymi przez ich trafienia (hooki onHit); takie trafienia nie nakładają żywiołów.
 */
const PCT_SOURCES = new Set(['Egzekucja', 'Ognista dusza', 'Wybuchowe zgony', 'Synergia: Ogień', 'Supernowa']);

export interface DamageOpts {
  /** Kierunek odrzutu (nie musi być znormalizowany) i jego siła. */
  kx?: number;
  ky?: number;
  knock?: number;
  forceCrit?: boolean;
  stun?: number;
  /** Obrażenia od stanu (podpalenie, trucizna): bez krytyka, bez nakładania żywiołu i bez hooków onHit. */
  dot?: boolean;
}

const ELEMENT_LIST: Element[] = ['fire', 'ice', 'lightning', 'poison'];
/** Kolory liczb obrażeń reakcji żywiołów (po nazwie źródła). */
const REACTION_COL: Record<string, number> = { 'Para': C.lgray, 'Wybuch toksyn': C.lime, 'Przeciążenie': C.orange };

export interface ProjectileSpec {
  x: number;
  y: number;
  angle: number;
  speed: number;
  damage: number;
  src: string;
  sprite?: string;
  kind?: ProjKind;
  pierce?: number;
  life?: number;
  radius?: number;
  knock?: number;
  forceCrit?: boolean;
}

/**
 * Tryb gry: Endless (jeden poziom bez końca, boss co BAL.endlessBossEvery s, każdy boss podnosi głębokość)
 * albo Ekspedycja (3 akty map z węzłami, data/expedition.ts).
 */
export type Mode = 'endless' | 'expedition';
/** Tryby z własnym slotem zapisu (core/save.ts): wyjście z gry wznawia run (wszystkie tryby). */
export type SlotMode = Mode;
/** Wynik bieżącego poziomu: 'victory' = boss pokonany, poziom ukończony. */
export type Outcome = 'none' | 'dead' | 'victory';

/** Zapis runu (slot trybu). `depth` = poziom, który gracz rozegra jako następny (albo trwający, gdy `inProgress`). */
export interface RunSnapshot {
  hero: string;
  mode: Mode;
  depth: number;
  inProgress: boolean;
  level: number;
  xp: number;
  gold: number;
  kills: number;
  totalTime: number;
  hp: number;
  /** Broń: id, poziom i bonusy z jakości ulepszeń (od 0.10). */
  weapons: [string, number, WeaponBonus?][];
  passives: [string, number, number?][];
  abilities: Record<AbilitySlot, number>;
  cards: [string, number][];
  rerolls: number;
  skips: number;
  banishes: number;
  cardRerolls: number;
  banished: string[];
  ultCharge: number;
  ultUses: number;
  bonus: Partial<Stats>;
  basicWeaponId: string;
  dmgBySource: [string, number][];
  cardState: Record<string, number>;
  /** Ekwipunek (od wersji 0.4; starsze zapisy go nie mają). */
  equipment?: Record<SlotId, Item | null>;
  bag?: Item[];
  /** Sklep między poziomami i liczba kupionych eliksirów (etap 4; starsze zapisy ich nie mają). */
  shop?: ShopState | null;
  elixirsBought?: number;
  /** Odłamki — waluta kowadła (z rozkładania przedmiotów). */
  shards?: number;
  /** Suma leczenia w runie. */
  healed?: number;
  shopLevel?: number;
  anvilLevel?: number;
  /** Umiejętności po ewolucji. */
  abilityEvo?: AbilitySlot[];
  /** Postęp przerwanego poziomu (zapis w trakcie): czas, zabójstwa, elity, zdarzenia, HP bossa (ułamek). */
  stage?: { time: number; kills: number; eliteT: number; nextEvent: number; bossHpFrac: number; nextBossAt?: number };
  /** Mapa i pozycja Ekspedycji. */
  expedition?: ExpeditionState;
  /** Średni DPS (siła buildu, BAL.power) — żeby po wczytaniu wrogowie nie byli na chwilę za słabi. */
  dpsEma?: number;
  /** Augmenty broni. */
  augments?: string[];
  /** Zasób bohatera (od 0.13). */
  resource?: number;
  /** Moc bossa: id i poziom (od 0.13). */
  power?: [string, number];
  /** Pakty ryzyka runu i pokonani bossowie (od 0.13). */
  pacts?: Record<string, number>;
  bossKills?: number;
  /** Wyczyny: trafienia w runie, passa Nietykalnego, zdobyte wyczyny. */
  runHits?: number;
  hitlessLevels?: number;
  feats?: FeatId[];
  /** Materiały i zwoje kuźni (od 0.14). */
  mats?: Partial<Record<MatId, number>>;
  scrolls?: Partial<Record<ScrollId, number>>;
  /** Obudzone sekrety (od 0.15). */
  secrets?: string[];
  /** DPS co 5 s (wykres na ekranie końca). */
  dpsLog?: number[];
  /** Wyróżnienia runu: najdłuższe kombo, seria zabójstw, najmocniejsze trafienie i jego źródło. */
  highlights?: [number, number, number, string];
}

/**
 * Stan runu: postać (trwa przez kolejne poziomy) + świat bieżącego poziomu (pule encji,
 * czas, boss). Run zna kolejność systemów (update) i udostępnia im wspólne operacje:
 * obrażenia, śmierć, leczenie, dropy, efekty kart. Same systemy są w katalogu systems/.
 */
export class Run {
  readonly hero: HeroDef;
  readonly player: Player;
  stats: Stats = { ...DEFAULT_STATS };
  weapons: WeaponInst[] = [];
  passives: PassiveInst[] = [];
  abilities: Record<AbilitySlot, AbilityInst>;

  // --- karty ---
  cards: CardInst[] = [];
  /** Zsumowane flagi kart (× liczba stosów). */
  private flags: Record<string, number> = {};
  /** Hooki kart pogrupowane po zdarzeniu — dispatch bez przeszukiwania wszystkich kart. */
  private hooks: { [K in HookName]: { fn: NonNullable<CardHooks[K]>; stacks: number }[] } = {
    onHit: [], onKill: [], onAbilityCast: [], onDash: [], onDamageTaken: [], onLevelUp: [], onTick: [],
  };
  /** Liczniki stanu kart (np. "co 50 zabójstw"). */
  cardState: Record<string, number> = {};
  /** Punkty tagów buildu i osiągnięte progi synergii (data/synergies.ts). */
  tagPts = {} as Record<Tag, number>;
  synTiers: Partial<Record<Tag, number>> = {};
  private synReady = false;
  /** Wszechstronność: liczba aktywnych synergii i osiągnięty próg. */
  versCount = 0;
  versTier = 0;
  /** Wszystkie aktywne progi synergii (ze Wszechstronnością) — ich stats/mul liczy recomputeStats. */
  private synEffects: SynergyTier[] = [];
  /** Stałe przyrosty statystyk zdobyte w trakcie runu (np. +HP za zabójstwo). */
  bonus: Partial<Stats> = {};
  /** Meta-progresja (drzewko, Paragon, prestiż) — ustawiana przez ekran gry z zapisu, niezapisywana w runie. */
  private meta: MetaBonus = { stats: {}, mul: {}, flags: {}, start: {}, essenceMul: 1 };
  private statsDirty = false;
  private hookDepth = 0;
  cardRerolls: number = BAL.cardRerollsStart;
  pendingCards: CardSource[] = [];
  /** Z kolekcji (core/save.ts), ustawiane przez ekran gry: bany wykluczone z ofert i karty już odkryte. */
  cardBans = new Set<string>();
  knownCards = new Set<string>();
  /** Księga sekretów (systems/secrets.ts): obudzone w runie i odkryte od ostatniej synchronizacji z kolekcją. */
  secrets = new Set<string>();
  secretsFound = new Set<string>();
  /** Sieci Pajęczarzy (spowalniają gracza) i czy gracz w którejś stoi. */
  webs: { x: number; y: number; r: number; t: number }[] = [];
  webbed = false;
  /** Wydarzenia poziomu i kombo (systems/levelevents.ts): trwające wydarzenie, czas do losowania, pioruny burzy, kombo zabójstw. */
  levelEvent: { id: LevelEventId; t: number } | null = null;
  levelEventT: number = BAL.levelEvents.every * 0.6;
  /** Uderzenia w zaznaczone kręgi: pioruny burzy (ranią wszystkich) i deszcz żaru bossa (`foe` = obrażenia tylko dla gracza). */
  /** Zaznaczone kręgi uderzeń: piorun burzy, ogień bossa (`foe`), nasiona Cierniaka (`seed`: mniejszy, zielony wybuch). */
  strikes: { x: number; y: number; t: number; foe?: number; seed?: boolean; r?: number }[] = [];
  stormT = 0;
  combo = 0;
  /** Wyróżnienia runu (0.33, ekran końca): najdłuższe kombo, najlepsza seria zabójstw, najmocniejsze trafienie. */
  bestCombo = 0;
  bestStreak = 0;
  maxHit = 0;
  maxHitSrc = '';
  /** Seria zabójstw: liczba i czas ostatniego zabójstwa; krok ostatniego efektu krytyka (limit efektów w tłumie). */
  streakN = 0;
  streakT = -9;
  private critFxStep = -99;
  /** Sekrety map (systems/mapsecrets.ts): czas do kolejnego, odurzenie (odwrócone sterowanie, s), tytuł sekretnego bossa w HUD,
   * bossowie pokonani bez trafienia (trofea). */
  secretT: number = BAL.secretsMap.every * 0.6;
  confusedT = 0;
  bossTitle: string | null = null;
  noHitBosses = 0;
  /** Unikaty wylosowane od ostatniej synchronizacji z kolekcją. */
  uniquesFound = new Set<string>();
  /** Karty zobaczone i wybrane od ostatniej synchronizacji z kolekcją. */
  private cardLog = { seen: new Set<string>(), picked: [] as string[] };

  // --- encje w pulach (zero alokacji w trakcie gry) ---
  readonly enemies = new Pool<Enemy>(newEnemy, BAL.maxEnemies + 20);
  readonly projectiles = new Pool<Projectile>(newProjectile, BAL.projectileCap);
  readonly bullets = new Pool<EnemyBullet>(newBullet, BAL.enemyBulletCap);
  readonly gems = new Pool<Gem>(() => ({ _i: -1, x: 0, y: 0, value: 0, flying: false, v: 0 }));
  readonly pickups = new Pool<Pickup>(() => ({ _i: -1, x: 0, y: 0, kind: 'coin', value: 0, flying: false, v: 0, item: null, source: 'drop', mimic: false }), 300);
  readonly particles = new Pool<Particle>(() => ({ _i: -1, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, col: 7, size: 1 }), BAL.particleCap);
  readonly dmgNums = new Pool<DmgNum>(() => ({ _i: -1, x: 0, y: 0, life: 0, text: '', col: 7, big: false }), BAL.dmgNumberCap);
  readonly zones = new Pool<Zone>(newZone, 500);
  readonly fx = new Pool<Fx>(newFx, 400);
  readonly turrets = new Pool<Turret>(() => ({ _i: -1, x: 0, y: 0, life: 0, timer: 0 }), 24);
  readonly minions = new Pool<Minion>(() => ({ _i: -1, x: 0, y: 0, life: 0, damage: 0, hitT: 0, big: false, burst: false, holy: false, src: '' }), BAL.minions.cap);
  readonly hash = new SpatialHash<Enemy>(16, 8, 2048);
  /** Wspólne bufory zapytań (żeby nie alokować tablic co klatkę). */
  readonly qa: Enemy[] = [];
  readonly qb: Enemy[] = [];
  /** Stos buforów dla enemiesInCircle — zapytania mogą się zagnieżdżać (wybuch w callbacku). */
  private qStack: Enemy[][] = [];
  private qDepth = 0;
  /** Zaplanowane akcje (opóźnione efekty kart). */
  private timers: { t: number; fn: () => void }[] = [];
  private explosionsThisStep = 0;
  /** Środki wybuchów narysowanych w tym kroku (scalanie efektów bliskich wybuchów) i cząsteczki dodane w tym kroku. */
  private boomSpots: number[] = [];
  private particlesThisStep = 0;
  private sparksThisStep = 0;
  /** Ile tarczy za zabójstwa można jeszcze dodać (odnawia się z BAL.killShieldRate). */
  private killShieldBudget = 0;

  // --- postęp postaci (trwa przez poziomy) ---
  step = 0;
  kills = 0;
  totalTime = 0;
  level = 1;
  xp = 0;
  xpNext = BAL.xpToNext(1);
  gold = 0;
  ultCharge = 0;
  ultUses = 0;
  dmgBySource = new Map<string, number>();
  /** Suma zadanych obrażeń i DPS co BAL.dpsEvery s (wykres na ekranie końca); `dpsMark` = suma przy ostatnim pomiarze. */
  dmgTotal = 0;
  dpsLog: number[] = [];
  dpsMark = 0;
  /**
   * Między runami (ustawia ui/game-screen.ts): odblokowane osiągnięcia (karty z `unlock`), mnożniki obrażeń z bestiariusza per wróg,
   * zabójstwa per wróg do przeniesienia do bestiariusza.
   */
  unlocked = new Set<string>();
  /** Skórka bohatera (id odznaki Paktu, '' = zwykły wygląd) i nazwa sprite'a postaci. */
  skin = '';
  get heroSprite(): string {
    return this.skin ? `${this.hero.sprite}~${this.skin}` : this.hero.sprite;
  }
  /**
   * Wyczyny (systems/feats.ts): liczniki poziomu (trafienia, uniki, Q/E, start, Rzeź i Mistrz kombo zdobyte, elity), czasy zabójstw do Rzezi,
   * trafienia w całym runie, passa poziomów bez trafienia, wyczyny runu i nowe do przeniesienia do zapisu, wyczyny ostatniego bossa,
   * czas ostatniego trafienia (karta Spokój).
   */
  feat = { hits: 0, dashes: 0, casts: 0, start: 0, massacre: false, combo: false, elites: 0 };
  killTimes: number[] = [];
  runHits = 0;
  hitlessLevels = 0;
  featsRun: FeatId[] = [];
  featsNew: FeatId[] = [];
  featsLevel: FeatId[] = [];
  lastHurtAt = -999;
  lore: Record<string, number> = {};
  killsById: Record<string, number> = {};
  /** Leczenie: suma w runie, zebrane od ostatniej liczby nad postacią, poświata paska HP. */
  healed = 0;
  private healAcc = 0;
  private healT = 0;
  healGlow = 0;
  /** Czerwony błysk krawędzi ekranu po trafieniu (s). */
  hurtFx = 0;
  /** Zatrzymanie klatki (s, ekran gry wstrzymuje symulację) i chwila, od której można zatrzymać ponownie. */
  hitstop = 0;
  private hitstopAt = 0;
  /** Zasób bohatera (systems/resource.ts): wartość, czas do kolejnego przyrostu z trafień, czas od ostatniej walki (furia). */
  res = 0;
  resGap = 0;
  resIdle = 0;
  /** Szał Borguna (pełna furia): pozostały i pełny czas. */
  rageT = 0;
  rageMax = 1;
  /** Przepływ (Rytm Takezo): pozostały czas i pełny czas (flaga rhythm.flow wydłuża). */
  flowT = 0;
  flowMax = 1;
  /** Liczba reakcji żywiołów w runie (podpowiedź przy pierwszej). */
  reactions = 0;
  /** Błysk paska XP po zebraniu kryształu (s). */
  xpPulse = 0;
  rerolls: number = BAL.rerolls;
  skips: number = BAL.skips;
  banishes: number = BAL.banishes;
  banished = new Set<string>();
  pendingLevels = 0;
  /** Moc bossa (systems/powers.ts): posiadana, czas do wystrzału, wybory do pokazania (po każdym bossie). */
  power: { id: string; level: number } | null = null;
  powerT = 0;
  pendingPowers = 0;
  /** Pakty ryzyka na cały run (data/pacts.ts, ustawiane przy starcie z zapisu gracza) i pokonani bossowie (odznaki Paktu). */
  pacts: Record<string, number> = {};
  bossKills = 0;
  /** Skrzynie do otwarcia: przedmiot (wylosowany przy upadku) i źródło (tytuł ekranu łupu). */
  pendingLoot: { source: LootSource; item: Item }[] = [];

  // --- ekwipunek ---
  equipment: Record<SlotId, Item | null> = { weapon: null, helmet: null, armor: null, gloves: null, boots: null, ring1: null, ring2: null, amulet: null };
  bag: Item[] = [];
  // --- sklep ---
  /** Oferta sklepu między poziomami (null w trakcie poziomu). */
  shop: ShopState | null = null;
  /** Eliksiry kupione w całym runie (podnoszą cenę kolejnych). */
  elixirsBought = 0;
  /** Poziomy rozbudowy sklepu i ulepszenia kowadła (na cały run). */
  shopLevel = 1;
  anvilLevel = 1;
  /** Odłamki z rozkładania przedmiotów — waluta kowadła. */
  shards = 0;
  /** Kuźnia runiczna (systems/forge.ts): materiały do ulepszania i zwoje. */
  mats = emptyMats();
  scrolls = emptyScrolls();
  /** Id broni podstawowej bohatera (zmienia się po ewolucji) — dla pasywki "co N-ta salwa". */
  basicWeaponId: string;

  // --- bieżący poziom ---
  depth = 1;
  levelInfo!: LevelDef;
  /** Czas od startu poziomu (napędza fale i cel "przetrwaj"). */
  time = 0;
  levelKills = 0;
  revivesLeft = 0;
  /** Zdarzenia mapy (systems/events.ts): obiekty, błogosławieństwa, loch i liczniki. */
  mapObjects: MapObject[] = [];
  buffs: Buff[] = [];
  dungeon: Dungeon | null = null;
  /** Samouczek (game/tutorial.ts): bez zwykłych fal, wydarzeń, zadań i obiektów mapy — wrogów wystawia skrypt. */
  scripted = false;
  shrineT = 0;
  portalT = 0;
  swordRolled = false;
  /** Teren poziomu (systems/terrain.ts): obiekty, wygenerowane kawałki, ziarno, arena bossa i podłoże pod graczem. */
  terrain: TerrainObj[] = [];
  terrainChunks = new Set<string>();
  terrainSeed = 0;
  arena: Arena | null = null;
  ground: 'none' | 'swamp' | 'ice' = 'none';
  /** Zadanie poziomu (systems/tasks.ts): trwające albo czekające kamieniem, czas do następnego i licznik wykonanych w runie. */
  task: Task | null = null;
  taskT: number = BAL.tasks.first;
  tasksDone = 0;
  /** Czas do możliwego pojawienia się następnego Złotego szlamu. */
  goldSlimeT = 0;
  /** HP bossa po wznowieniu przerwanego poziomu (ułamek; 1 = pełne). */
  bossHpFrac = 1;
  /** Augmenty broni (id z data/augments.ts) i nadane przez nie żywioły (nazwa źródła → żywioł). */
  augments: string[] = [];
  augElem = new Map<string, Element>();
  /** Bonusy jakości ulepszeń broni działające przy trafieniu: szansa na krytyk i siła żywiołu (nazwa źródła → wartość). */
  srcCrit = new Map<string, number>();
  srcElem = new Map<string, number>();
  /** Ekspedycja: mapa aktu i pozycja (null w innych trybach). */
  expedition: ExpeditionState | null = null;
  /** Endless: czas poziomu, w którym pojawi się następny boss. */
  nextBossAt: number = BAL.endlessBossEvery;
  boss: Enemy | null = null;
  bossSpawned = false;
  /** Miniboss biomu: odliczanie w Endless; w Ekspedycji czy już był na tym poziomie (systems/spawner.ts updateMiniboss). */
  minibossT: number = BAL.biomeEnemies.miniFirst;
  minibossDone = false;
  /** Węzły-wydarzenia Ekspedycji: Polowanie (miniboss zabity), Zasadzka (odliczanie i numer pierścienia), Mapa elit (zabite elity). */
  huntKilled = false;
  ambushT = 0;
  ambushRing = 0;
  eliteKills = 0;
  /** Polowanie: czas spędzony w lochu (sekretne schody) nie liczy się do limitu ucieczki. */
  huntPaused = 0;
  /** Sztandary elit (R3): wrogowie w strefie się leczą, gracz w strefie dostaje więcej obrażeń. */
  banners: { x: number; y: number; t: number }[] = [];
  inBanner = false;
  /** Baner „boss słabnie” pokazany dla bieżącego bossa. */
  bossSoftShown = false;
  /** Sytuacje (systems/situations.ts): zapowiedź, aktywna formacja, odliczanie, ostatnia (bez powtórek), dziennik wyników. */
  situation: { id: string; t: number; a: number; spots: Spot[] } | null = null;
  sitActive: { uid: number; id: string; left: number; keys: number; keysLeft: number; t0: number; taken0: number } | null = null;
  situationT: number = BAL.situations.first;
  sitSeq = 0;
  lastSituation = '';
  readonly sitLog: { id: string; result: 'broken' | 'failed' | 'lost'; dur: number; taken: number }[] = [];
  /** Obrażenia zadane na bieżącej (ostatniej) mapie wg żywiołu źródła — udział żywiołów buildu na mapie Ekspedycji. */
  elemDmg: Partial<Record<Element | 'none', number>> = {};
  eliteT: number = BAL.eliteEvery;
  /** Średni DPS gracza (średnia krocząca) i wynikający z niego mnożnik siły wrogów (BAL.power). */
  dpsEma = 0;
  powerMul = 1;
  private dmgStep = 0;
  /**
   * Telemetria (0.34.5): próbka co `BAL.telemetryEvery` s czasu runu — do strojenia trudności na pomiarach (bot, DEV
   * `window.__telemetry`). Obrażenia przyjęte to całe trafienia przed tarczą, od ostatniej próbki.
   */
  readonly telemetry: TelemetrySample[] = [];
  private takenMark = 0;
  private takenTotal = 0;
  private killsMark = 0;
  private ultMark = 0;
  /** Czas życia zabitych wrogów od ostatniej próbki (suma, liczba): zwykli i elity (TTK w telemetrii). */
  private lifeSum = 0;
  private lifeN = 0;
  private eliteLifeSum = 0;
  private eliteLifeN = 0;
  /** Źródło ostatniego trafienia (np. Żniwo: czy wroga zabiła dusza). */
  private lastHitSrc = '';
  /** > 0 w trakcie hooków trafienia procentowego (PCT_SOURCES). */
  private pctDepth = 0;
  nextEvent = 0;
  spawnAcc = 0;
  private uid = 1;
  private gemMerge = 0;
  outcome: Outcome = 'none';
  outcomeT = 0;

  // --- kamera, celowanie, efekty ekranu ---
  camX = 0;
  camY = 0;
  aimX = 0;
  aimY = 0;
  shake = 0;
  banner = '';
  bannerT = 0;
  /** Ustawiane co klatkę z ustawień gracza: wstrząsy, tryb celowania, liczby obrażeń. */
  shakeEnabled = true;
  aimMode: AimMode = 'mixed';
  damageNumbers = true;
  healNumbers = true;
  /** Oszczędne efekty (ustawienie): mniej cząsteczek i iskier; render pomija cienie, poświaty i winietę. */
  lowFx = false;
  /** Dostępność (Ustawienia): kształty żywiołów i tryb łatwy (słabsi wrogowie, flagi w indexEffects). */
  elemShapes = false;
  easy = false;
  /** Widoczność (Ustawienia → Obraz i widoczność): przyciemnienie tła, obwódki pocisków wrogów, znacznik gracza. */
  bgDim = 0;
  bulletOutline = false;
  playerMarker = false;
  /** Ograniczenie błysków (Ustawienia, dostępność): miganie zastępuje stały kolor, bez białych błysków trafień. */
  reduceFlash = false;
  /** Ukryte pociski gracza (ustawienie): nadal działają, tylko nie są rysowane. */
  playerFx: PlayerFx = 'auto';
  /** Tryb 'auto' ataków gracza: przygaszenie 0..1 (wygładzone) i stan z histerezą (BAL.readability). */
  fxDim = 0;
  private fxDimOn = false;

  constructor(heroId: string, readonly mode: Mode, depth = 1, fresh = true) {
    this.hero = HERO_BY_ID[heroId];
    this.player = { x: 0, y: 0, r: 4, hp: 1, shield: 0, hurtCd: 0, iframes: 0, fx: 1, fy: 0, dashT: 0, dvx: 0, dvy: 0, vx: 0, vy: 0, moving: false, flash: 0 };
    const ab = (slot: AbilitySlot): AbilityInst => ({ def: this.hero.abilities.find((a) => a.slot === slot)!, level: 1, cd: 0, activeT: 0 });
    this.abilities = { q: ab('q'), e: ab('e'), dash: ab('dash'), ult: ab('ult') };
    this.basicWeaponId = this.hero.weapon;
    if (fresh) {
      this.recomputeStats();
      this.player.hp = this.stats.maxHp;
      this.addWeapon(this.hero.weapon);
      this.indexEffects();
      this.startLevel(depth);
    }
  }

  // ================= poziomy =================

  /** Czyści świat i zaczyna poziom `depth`. Postać, karty i postęp zostają. */
  startLevel(depth: number): void {
    this.depth = depth;
    this.levelInfo = this.levelFor(depth);
    this.shop = null;
    this.time = 0;
    this.levelKills = 0;
    this.boss = null;
    this.bossSpawned = false;
    this.minibossDone = false;
    this.huntKilled = false;
    this.ambushT = BAL.expedition.ambushEvery * 0.4;
    this.ambushRing = 0;
    this.eliteKills = 0;
    this.huntPaused = 0;
    this.elemDmg = {};
    this.banners = [];
    this.situation = null;
    this.sitActive = null;
    this.situationT = BAL.situations.first + rng.range(0, 15);
    this.eliteT = BAL.eliteEvery * this.levelInfo.eliteMul * BAL.eliteGap(this.levelInfo.waveOffset);
    this.nextEvent = 0;
    this.spawnAcc = 0;
    this.outcome = 'none';
    this.outcomeT = 0;
    this.mapObjects = [];
    this.buffs = [];
    this.dungeon = null;
    this.shrineT = BAL.events.shrineEvery * 0.5;
    this.portalT = BAL.events.portalEvery;
    this.swordRolled = false;
    this.task = null;
    this.taskT = BAL.tasks.first;
    this.secretT = BAL.secretsMap.every * 0.6;
    this.confusedT = 0;
    this.webs = [];
    this.levelEvent = null;
    this.levelEventT = BAL.levelEvents.every * 0.6;
    this.strikes = [];
    this.bossTitle = null;
    resetLevelFeats(this);
    this.featsLevel = [];
    delete this.cardState.halo;
    this.terrain = [];
    this.terrainChunks.clear();
    this.terrainSeed = rng.int(1, 1e9);
    this.arena = null;
    this.goldSlimeT = BAL.events.goldSlimeGap * 0.5;
    delete this.cardState['aug.orbit'];
    for (const p of [this.enemies, this.projectiles, this.bullets, this.gems, this.pickups, this.particles, this.dmgNums, this.zones, this.fx, this.turrets, this.minions] as Pool<{ _i: number }>[]) p.clear();
    this.timers = [];
    const p = this.player;
    p.x = 0; p.y = 0; p.vx = 0; p.vy = 0; p.dashT = 0; p.iframes = 1; p.hurtCd = 0;
    for (const a of Object.values(this.abilities)) { a.cd = 0; a.activeT = 0; }
    // Dusze zostają między poziomami, pozostałe zasoby budują się od nowa.
    if (this.hero.resource.kind !== 'souls') this.res = 0;
    this.rageT = 0;
    this.flowT = 0;
    delete this.cardState['sec.berserk'];
    // Błogosławieństwo kapliczki Ekspedycji na kolejne mapy (trwa cały poziom).
    const bless = this.expedition?.blessing ? EX_BLESSINGS.find((b) => b.id === this.expedition!.blessing!.id) : null;
    if (bless) this.buffs.push({ name: bless.name, stats: bless.stats, t: Infinity });
    // Bonus z obozu: tylko ta jedna mapa (zdejmowany w GameScreen.onLevelCleared); loch go nie używa ani nie zużywa.
    const camp = this.expedition?.camp && !this.levelInfo.dungeon ? CAMP_BUFFS.find((b) => b.id === this.expedition!.camp) : null;
    if (camp) this.buffs.push({ name: camp.name, stats: camp.stats, t: Infinity });
    this.indexEffects();
    this.recomputeStats();
    this.revivesLeft = this.flag('revive');
    this.showBanner(this.expedition ? this.levelInfo.name : `Poziom ${depth}: ${this.levelInfo.name}`);
    if (this.levelInfo.biome === VOID_BIOME && !this.expedition) this.showBanner('Sekretny biom: Pustka! Bez leczenia, podwójny łup');
    if (this.levelInfo.dungeon) enterDungeon(this, this.levelInfo.dungeonKind ?? 'portal');
  }

  /**
   * Definicja poziomu: węzeł Ekspedycji albo głębia Endless. W Endless po pełnym cyklu biomów pierwsza głębia nowego cyklu
   * zamienia się w sekretny biom Pustka, gdy Pakt ma BAL.voidPact+ albo run trwa co najmniej BAL.voidEndlessTime.
   */
  levelFor(depth: number): LevelDef {
    if (this.expedition) return nodeLevel(this.expedition);
    const open = this.pactLevel >= BAL.voidPact || this.totalTime >= BAL.voidEndlessTime;
    return levelDef(depth, open && depth > BIOME_CYCLE && (depth - 1) % BIOME_CYCLE === 0);
  }

  /** Postęp celu poziomu 0..1. Po jego osiągnięciu pojawia się boss. */
  objectiveProgress(): number {
    if (this.mode === 'endless') return Math.min(1, this.time / this.nextBossAt);
    const o = this.levelInfo.objective;
    // Polowanie: cel wykonany po zabiciu minibossa albo gdy uciekł (limit czasu).
    if (o.kind === 'hunt') { const t = this.time - this.huntPaused; return this.huntKilled || t >= o.time ? 1 : Math.min(0.99, t / o.time); }
    return Math.min(1, o.kind === 'survive' ? Math.max(this.time / o.time, o.kills ? this.levelKills / o.kills : 0) : this.levelKills / o.count);
  }

  /** Czas fal: czas poziomu + przesunięcie głębokości (skład fal, elity, gęstość salw, siła buildu). */
  waveTime(): number {
    return this.time + this.levelInfo.waveOffset;
  }

  /** Średnia krocząca DPS (z obrażeń zadanych w poprzednim kroku) i mnożnik siły wrogów (BAL.power). */
  private updatePower(dt: number): void {
    const P = BAL.power;
    this.dpsEma += (this.dmgStep / dt - this.dpsEma) * Math.min(1, dt / P.emaSec);
    this.dmgStep = 0;
    const t = this.waveTime();
    const base = P.baseHp * BAL.enemyHpMul(this.time) * BAL.depthHpMul(this.depth);
    const floor = P.floor(this.level), chase = Math.pow((this.dpsEma * P.ttk(t)) / (base * floor), P.chaseExp);
    this.powerMul = Math.min(P.max, Math.max(1, floor * Math.min(P.chaseMax, Math.max(P.chaseMin, chase))));
  }

  private sample(): void {
    const st = this.stats;
    this.telemetry.push({
      t: Math.round(this.totalTime), lt: Math.round(this.time), wt: Math.round(this.waveTime()), lvl: this.level, depth: this.depth,
      pm: Math.round(this.powerMul * 10) / 10, dps: Math.round(this.dpsEma), hp: Math.round((this.player.hp / st.maxHp) * 100) / 100,
      taken: Math.round(((this.takenTotal - this.takenMark) / st.maxHp) * 100) / 100, kills: this.kills - this.killsMark, alive: this.enemies.count,
      life: this.lifeN ? Math.round((this.lifeSum / this.lifeN) * 100) / 100 : -1, eLife: this.eliteLifeN ? Math.round(this.eliteLifeSum / this.eliteLifeN) : -1,
      ult: this.ultUses - this.ultMark, growth: Math.round(st.growth * 100) / 100,
      goal: this.levelInfo.dungeon ? 'dungeon' : this.levelInfo.objective.kind,
      sit: this.sitActive?.id ?? this.situation?.id ?? '',
      aff: this.levelInfo.weak ? `weak:${this.levelInfo.weak}` : this.levelInfo.resist ? `resist:${this.levelInfo.resist}` : '',
    });
    this.takenMark = this.takenTotal;
    this.killsMark = this.kills;
    this.ultMark = this.ultUses;
    this.lifeSum = this.lifeN = this.eliteLifeSum = this.eliteLifeN = 0;
  }

  /** Czas na bieżącej głębokości (s): od startu poziomu, w Endless od pokonania ostatniego bossa (krzywa obrażeń wrogów). */
  depthTime(): number {
    return this.mode === 'endless' ? Math.max(0, this.time - (this.nextBossAt - BAL.endlessBossEvery)) : this.time;
  }

  /** Sztandary elit: odliczanie, leczenie wrogów w strefie (co krok, ułamek maks. HP), gracz w strefie. */
  private updateBanners(dt: number): void {
    this.inBanner = false;
    if (!this.banners.length) return;
    const T = BAL.eliteTraits, p = this.player;
    for (const b of this.banners) {
      b.t -= dt;
      if ((p.x - b.x) ** 2 + (p.y - b.y) ** 2 < T.bannerR * T.bannerR) this.inBanner = true;
      this.enemiesInCircle(b.x, b.y, T.bannerR, (e) => { if (!e.boss) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * T.bannerRegen * dt); });
    }
    if (this.banners.some((b) => b.t <= 0)) this.banners = this.banners.filter((b) => b.t > 0);
  }

  /** Czytelność w tłumie: dużo pocisków wrogów blisko bohatera przygasza jego ataki (tryb 'auto'). */
  private updateFxDim(dt: number): void {
    if (this.playerFx !== 'auto') { this.fxDim = 0; return; }
    const R = BAL.readability, p = this.player, r2 = R.radius * R.radius;
    let n = 0;
    for (const b of this.bullets.items) if ((b.x - p.x) ** 2 + (b.y - p.y) ** 2 < r2 && ++n >= R.on) break;
    this.fxDimOn = this.fxDimOn ? n > R.off : n >= R.on;
    this.fxDim += ((this.fxDimOn ? 1 : 0) - this.fxDim) * Math.min(1, dt / R.ema);
  }

  /** Mnożnik obrażeń słabnącego bossa (po BAL.bossSoften.after s walki rośnie do 1 + max). */
  bossSoftMul(e: Enemy): number {
    const S = BAL.bossSoften, a = e.age - S.after;
    return a > 0 ? 1 + S.max * Math.min(1, a / S.ramp) : 1;
  }

  /** Suma obrażeń przyjętych w runie (całe trafienia przed tarczą) — telemetria sytuacji. */
  takenSoFar(): number {
    return this.takenTotal;
  }

  /** Debug (F4): przyspiesza cel poziomu i czas fal. */
  debugAdvance(): void {
    this.time += 30;
    if (this.levelInfo.objective.kind === 'kills') this.levelKills += 60;
  }

  // ================= główna aktualizacja =================

  update(dt: number, input: Input): void {
    if (this.outcome !== 'none') {
      this.outcomeT -= dt;
      updateEffects(this, dt);
      return;
    }
    this.time += dt;
    this.totalTime += dt;
    this.step++;
    if (this.step % Math.round(BAL.dpsEvery * 60) === 0) { this.dpsLog.push((this.dmgTotal - this.dpsMark) / BAL.dpsEvery); this.dpsMark = this.dmgTotal; }
    this.xpPulse = Math.max(0, this.xpPulse - dt);
    this.confusedT = Math.max(0, this.confusedT - dt);
    this.updatePower(dt);
    this.updateFxDim(dt);
    this.updateBanners(dt);
    if (this.step % Math.round(BAL.telemetryEvery * 60) === 0) this.sample();
    this.explosionsThisStep = 0;
    this.boomSpots.length = 0;
    this.particlesThisStep = 0;
    this.sparksThisStep = 0;
    if (this.flag('aegis') > 0) this.cardState.aegis = (this.cardState.aegis ?? 0) + dt;
    const shieldRate = this.stats.maxHp * BAL.killShieldRate;
    this.killShieldBudget = Math.min(shieldRate, this.killShieldBudget + shieldRate * dt);
    this.runTimers(dt);
    this.rebuildHash();
    updateSpawner(this, dt);
    updateEnemies(this, dt);
    this.rebuildHash();
    updatePlayer(this, input, dt);
    updateTerrain(this, dt);
    if (!this.scripted) { updateEvents(this, dt); updateTasks(this, dt); }
    updateSecrets(this);
    if (!this.scripted) updateLevelEvents(this, dt);
    updateAbilities(this, input, dt);
    updateResource(this, dt);
    updateWeapons(this, dt);
    updateTurrets(this, dt);
    updateMinions(this, dt);
    updatePower(this, dt);
    this.emit('onTick', dt);
    updateProjectiles(this, dt);
    updateEnemyBullets(this, dt);
    updateZones(this, dt);
    updatePickups(this, dt);
    updateEffects(this, dt);
    if (this.statsDirty) this.recomputeStats();
    if (this.bannerT > 0) this.bannerT -= dt;
    this.healGlow = Math.max(0, this.healGlow - dt);
    this.hurtFx = Math.max(0, this.hurtFx - dt);
    this.healT -= dt;
    if (this.healT <= 0) {
      this.healT = 0.5;
      if (this.healNumbers && this.healAcc >= 1) this.popText(this.player.x, this.player.y - 14, `+${fmt(this.healAcc)}`, C.lime);
      this.healAcc = 0;
    }
    this.shake = Math.max(0, this.shake - dt * 20);
    this.camX = this.player.x - VIEW_W / 2;
    this.camY = this.player.y - VIEW_H / 2;
  }

  /** Miganie co `period` kroków (włączone przez pierwsze `on`); przy ograniczeniu błysków zawsze włączone (stały stan). */
  blink(period: number, on: number): boolean {
    return this.reduceFlash || this.step % period < on;
  }

  private rebuildHash(): void {
    this.hash.clear();
    for (const e of this.enemies.items) if (!e.dead && !e.hidden) this.hash.insert(e);
  }

  private runTimers(dt: number): void {
    if (this.timers.length === 0) return;
    const due: (() => void)[] = [];
    this.timers = this.timers.filter((t) => {
      t.t -= dt;
      if (t.t > 0) return true;
      due.push(t.fn);
      return false;
    });
    for (const fn of due) fn();
  }

  /** Planuje akcję za `delay` sekund (w czasie gry — pauza ją wstrzymuje). */
  schedule(delay: number, fn: () => void): void {
    this.timers.push({ t: delay, fn });
  }

  // ================= karty =================

  flag(name: string): number {
    return this.flags[name] ?? 0;
  }

  addCard(id: string): void {
    const inst = this.cards.find((c) => c.id === id);
    if (inst) inst.stacks++;
    else this.cards.push({ id, stacks: 1 });
    this.cardLog.picked.push(id);
    this.onBuildChanged();
  }

  /** Karty pokazane w ofercie (do kolekcji). */
  noteCardsSeen(ids: string[]): void {
    for (const id of ids) this.cardLog.seen.add(id);
  }

  /** Oddaje i czyści dziennik kart (ekran gry przenosi go do kolekcji w zapisie). */
  drainCardLog(): { seen: string[]; picked: string[] } {
    const out = { seen: [...this.cardLog.seen], picked: this.cardLog.picked };
    this.cardLog = { seen: new Set(), picked: [] };
    return out;
  }

  /**
   * Przelicza flagi i listy hooków po zmianie kart albo ekwipunku.
   * Hooki dostają jako ostatni argument liczbę stosów karty albo wartość super-bonusu przedmiotu.
   */
  private indexEffects(): void {
    this.flags = { ...this.meta.flags };
    for (const [k, v] of Object.entries(this.levelInfo?.flags ?? {})) this.flags[k] = (this.flags[k] ?? 0) + v;
    // Tryb łatwy (Ustawienia): wrogowie zadają mniej obrażeń i mają mniej HP.
    if (this.easy) { this.flags.enemyDmg = (this.flags.enemyDmg ?? 0) - BAL.easy.dmg; this.flags.enemyHp = (this.flags.enemyHp ?? 0) - BAL.easy.hp; }
    for (const [k, v] of Object.entries(eventFlags(this))) this.flags[k] = (this.flags[k] ?? 0) + v;
    for (const p of PACTS) {
      const lvl = Math.min(p.max, this.pacts[p.id] ?? 0);
      for (const [k, v] of Object.entries(p.flags)) if (lvl) this.flags[k] = (this.flags[k] ?? 0) + v * lvl;
    }
    for (const k of Object.keys(this.hooks) as HookName[]) this.hooks[k] = [];
    const addHooks = (hooks: CardHooks | undefined, n: number) => {
      for (const [k, fn] of Object.entries(hooks ?? {})) (this.hooks[k as HookName] as { fn: unknown; stacks: number }[]).push({ fn, stacks: n });
    };
    for (const c of this.cards) {
      const def = CARD_BY_ID[c.id];
      for (const [k, v] of Object.entries(def.flags ?? {})) this.flags[k] = (this.flags[k] ?? 0) + v * c.stacks;
      addHooks(def.hooks, c.stacks);
    }
    for (const { def, value } of equippedSupers(this)) {
      for (const k of def.flags ?? []) {
        // Tarcza bogów: liczy się najkrótszy odstęp; pozostałe flagi się sumują.
        this.flags[k] = k === 'aegis' && this.flags[k] ? Math.min(this.flags[k], value) : (this.flags[k] ?? 0) + value;
      }
      addHooks(def.hooks, value);
    }
    for (const u of equippedUniques(this)) {
      for (const [k, v] of Object.entries(u.flags ?? {})) this.flags[k] = (this.flags[k] ?? 0) + v;
      addHooks(u.hooks, 1);
    }
    for (const s of activeSecrets(this)) {
      for (const [k, v] of Object.entries(s.flags ?? {})) this.flags[k] = (this.flags[k] ?? 0) + v;
      addHooks(s.hooks, 1);
    }
    // Przebudzenia z kuźni (+9): Czujność bierze najkrótszy odstęp, jak Tarcza bogów.
    for (const { def, v } of equippedAwakenings(this)) {
      for (const [k, val] of Object.entries(def.flags?.(v) ?? {})) this.flags[k] = k === 'aegis' && this.flags[k] ? Math.min(this.flags[k], val) : (this.flags[k] ?? 0) + val;
      addHooks(def.hooks, v);
    }
    // Synergie: punkty tagów całego buildu → progi (kumulowane), efekty jak u kart.
    this.tagPts = tagPoints(this);
    const newTiers: string[] = [];
    this.synEffects = [];
    for (const def of SYNERGIES) {
      const tier = tierOf(def, this.tagPts[def.tag]);
      if (tier > (this.synTiers[def.tag] ?? 0)) newTiers.push(`${def.tag} ${ROMAN_TIER[tier]}`);
      this.synTiers[def.tag] = tier;
      this.synEffects.push(...def.tiers.slice(0, tier));
    }
    this.versCount = SYNERGIES.filter((d) => (this.synTiers[d.tag] ?? 0) > 0).length;
    const vt = VERSATILITY.thresholds.filter((t) => this.versCount >= t).length;
    if (vt > this.versTier) newTiers.push(`${VERSATILITY.name} ${ROMAN_TIER[vt]}`);
    this.versTier = vt;
    this.synEffects.push(...VERSATILITY.tiers.slice(0, vt));
    for (const t of this.synEffects) {
      for (const [k, v] of Object.entries(t.flags ?? {})) this.flags[k] = (this.flags[k] ?? 0) + v;
      addHooks(t.hooks, 1);
    }
    // Pierwsze przeliczenie (start / wczytanie zapisu) nie ogłasza progów.
    if (newTiers.length && this.synReady) { this.showBanner(`Synergia: ${newTiers.join(', ')}!`); sfx.play('levelup'); }
    this.synReady = true;
  }

  /**
   * Bonusy meta-progresji. `fresh` = nowy run: dochodzą też zasoby startowe (złoto, odłamki, losowania...)
   * i pełne HP. Przy wznowieniu z zapisu tylko statystyki i flagi.
   */
  applyMeta(b: MetaBonus, fresh: boolean): void {
    this.meta = b;
    if (fresh) {
      const s = b.start;
      this.gold += s.gold ?? 0;
      this.shards += s.shards ?? 0;
      this.rerolls += s.rerolls ?? 0;
      this.skips += s.skips ?? 0;
      this.banishes += s.banishes ?? 0;
      this.cardRerolls += s.cardRerolls ?? 0;
    }
    this.onBuildChanged();
    if (fresh) this.player.hp = this.stats.maxHp;
  }

  /** Mnożnik esencji za run (drzewko, prestiż i poziom Paktu). */
  get essenceMul(): number {
    return this.meta.essenceMul * (1 + BAL.pacts.essencePer * this.pactLevel);
  }

  /** Poziom Paktu runu (suma poziomów paktów). */
  get pactLevel(): number {
    return pactLevel(this.pacts);
  }

  /** Czy run ma augment broni o danym id. */
  aug(id: string): boolean {
    return this.augments.includes(id);
  }

  /** Czy augment o danym id działa na tej broni (także po ewolucji i w hybrydzie z fuzji). */
  augOn(w: WeaponInst, id: string): boolean {
    return this.augments.includes(id) && augmentWorks(AUGMENT_BY_ID[id], w.def);
  }

  /** Żywioły z augmentów dla nazw posiadanych broni (także po ewolucji). */
  private indexAugments(): void {
    this.augElem.clear();
    this.srcCrit.clear();
    this.srcElem.clear();
    for (const w of this.weapons) {
      if (w.bonus.crit) this.srcCrit.set(w.def.name, w.bonus.crit);
      if (w.bonus.elem) this.srcElem.set(w.def.name, w.bonus.elem);
      for (const id of this.augments) {
        const a = AUGMENT_BY_ID[id];
        if (a?.elem && augmentWorks(a, w.def)) this.augElem.set(w.def.name, a.elem);
      }
    }
  }

  /** Po każdej zmianie buildu (broń, pasywka, karta, przedmiot): augmenty, flagi, hooki, synergie i statystyki. */
  onBuildChanged(): void {
    this.indexAugments();
    this.indexEffects();
    this.recomputeStats();
  }

  // ================= ekwipunek =================

  /** Slot, w którym przedmiot zostałby założony (pierścień: pierwszy wolny, inaczej pierwszy). */
  slotFor(it: Item): SlotId {
    const kind = BASE_BY_ID[it.base].kind;
    if (kind !== 'ring') return kind;
    return !this.equipment.ring1 ? 'ring1' : !this.equipment.ring2 ? 'ring2' : 'ring1';
  }

  /**
   * Zakłada przedmiot (z plecaka albo nowy łup). Zdjęty przedmiot trafia do plecaka,
   * a gdy ten jest pełny — jest rozkładany. Zwraca złoto z takiego rozłożenia.
   */
  equip(it: Item, slot: SlotId = this.slotFor(it)): number {
    const old = this.equipment[slot];
    this.bag = this.bag.filter((b) => b !== it);
    this.equipment[slot] = it;
    let gold = 0;
    if (old && this.bag.length < BAL.bagSize) this.bag.push(old);
    else if (old) { gold = salvageGold(old, this.stats.greed); this.gold += gold; this.shards += salvageShards(old); }
    this.onBuildChanged();
    return gold;
  }

  /** Nowy przedmiot do plecaka (oznaczony jako nowy w ekwipunku). */
  stash(it: Item): void {
    it.fresh = true;
    this.bag.push(it);
  }

  /** Zdejmuje przedmiot do plecaka (false, gdy plecak jest pełny). */
  unequip(slot: SlotId): boolean {
    const it = this.equipment[slot];
    if (!it || this.bag.length >= BAL.bagSize) return false;
    this.equipment[slot] = null;
    this.bag.push(it);
    this.onBuildChanged();
    return true;
  }

  /** Rozkłada przedmiot (z plecaka albo założony) na złoto i odłamki; zwraca kwotę złota. */
  salvage(it: Item): number {
    for (const s of Object.keys(this.equipment) as SlotId[]) if (this.equipment[s] === it) this.equipment[s] = null;
    this.bag = this.bag.filter((b) => b !== it);
    const g = salvageGold(it, this.stats.greed);
    // Kamienie kowalskie z rozkładania (wg jakości).
    const stones = BAL.forge.salvageStones[it.rarity] ?? 0;
    if (stones) this.mats.stone += stones;
    this.shards += salvageShards(it);
    this.gold += g;
    this.onBuildChanged();
    return g;
  }

  /** Krótkie zatrzymanie klatki (z odstępem BAL.juice.hitstopGap, żeby gra nie przycinała się seriami). */
  freeze(t: number): void {
    if (this.totalTime < this.hitstopAt) return;
    this.hitstop = Math.max(this.hitstop, t);
    this.hitstopAt = this.totalTime + BAL.juice.hitstopGap;
  }

  /** Tekst unoszący się nad światem (np. "Egzekucja!"). */
  popText(x: number, y: number, text: string, col: number): void {
    const n = this.dmgNums.obtain();
    if (!n) return;
    n.x = x; n.y = y; n.life = 0.9; n.text = text; n.col = col; n.big = false;
  }

  /** Czy w pobliżu jest świeża liczba obrażeń (ogranicza nakładanie się liczb w tłumie). */
  private numberNear(x: number, y: number): boolean {
    for (const n of this.dmgNums.items) if (n.life > 0.3 && Math.abs(n.x - x) < 8 && Math.abs(n.y - y) < 6) return true;
    return false;
  }

  /**
   * Wywołuje hooki kart. Hooki nie wywołują się rekurencyjnie: obrażenia zadane z wnętrza
   * hooka nie odpalają kolejnych onHit/onKill (chroni przed nieskończonymi łańcuchami).
   */
  emit(name: 'onHit', e: Enemy, dmg: number, crit: boolean): void;
  emit(name: 'onKill', e: Enemy): void;
  emit(name: 'onAbilityCast', slot: AbilitySlot): void;
  emit(name: 'onDash' | 'onLevelUp'): void;
  emit(name: 'onDamageTaken', dmg: number): void;
  emit(name: 'onTick', dt: number): void;
  emit(name: HookName, ...args: unknown[]): void {
    const list = this.hooks[name];
    if (list.length === 0 || this.hookDepth > 0) return;
    this.hookDepth++;
    for (const h of list) (h.fn as (...a: unknown[]) => void)(this, ...args, h.stacks);
    this.hookDepth--;
  }

  addBonus(stat: keyof Stats, v: number): void {
    this.bonus[stat] = (this.bonus[stat] ?? 0) + v;
    this.statsDirty = true;
  }

  /** Obrażenia efektów kart: baza × moc × skalowanie głębokości. */
  cardDamage(base: number): number {
    return base * this.stats.might * BAL.cardPower(this.depth);
  }

  addFire(x: number, y: number, r: number, damage: number, life: number, src: string): void {
    const z = this.addZone('fire', x, y, r, damage, life, SLOT.card, src);
    if (z) z.tick = 20;
  }

  /**
   * Wybuch: obrażenia (stałe albo liczone per wróg) z odrzutem od środka + efekty.
   * Efekty wybuchów blisko już narysowanego w tym kroku (albo ponad limit na krok) są pomijane — obrażenia zawsze działają.
   */
  explode(x: number, y: number, r: number, dmg: number | ((e: Enemy) => number), src: string, col: number, knock = 3): void {
    this.enemiesInCircle(x, y, r, (e) => this.damageEnemy(e, typeof dmg === 'number' ? dmg : dmg(e), src, { kx: e.x - x, ky: e.y - y, knock }));
    // Teren: beczki w zasięgu wybuchają łańcuchowo, osłony pękają.
    terrainBlast(this, x, y, r);
    const spots = this.boomSpots, near = BAL.fx.boomMerge * BAL.fx.boomMerge;
    if (spots.length >= BAL.fx.boomsPerStep * 2) return;
    for (let i = 0; i < spots.length; i += 2) if ((spots[i] - x) ** 2 + (spots[i + 1] - y) ** 2 < near) return;
    spots.push(x, y);
    const f = this.addFx('ring', x, y, col, 0.25);
    if (f) f.r = r;
    this.boomFx(x, y, r);
    this.burst(x, y, col, 10, 60);
    this.addShake(1);
    sfx.play('explode');
  }

  /** Animacja eksplozji dobrana skalą (całkowitą, żeby piksele zostały ostre) do promienia w jednostkach świata. */
  boomFx(x: number, y: number, r: number): void {
    const f = this.addFx('boom', x, y, C.orange, 0.42);
    if (f) f.r = Math.max(1, Math.min(4, Math.round((r * 1.5 * 2) / 30)));
  }

  /** Wybuch w następnym kroku, z limitem na krok — dla efektów wyzwalanych zabójstwami. */
  queueExplosion(x: number, y: number, r: number, dmg: number, src: string, col: number): void {
    if (this.explosionsThisStep >= BAL.explosionBudget) return;
    this.explosionsThisStep++;
    this.schedule(0, () => this.explode(x, y, r, dmg, src, col, 2));
  }

  // ================= statystyki i ekwipunek runu =================

  /** Liczy statystyki od zera: bohater + pasywki + karty + bonusy + aktywne efekty umiejętności. */
  recomputeStats(): void {
    this.statsDirty = false;
    const s: Stats = { ...DEFAULT_STATS, ...this.hero.base };
    const add = (o: Partial<Stats>, k = 1) => { for (const key in o) s[key as keyof Stats] += o[key as keyof Stats]! * k; };
    for (const p of this.passives) {
      const def = PASSIVE_BY_ID[p.id];
      s[def.stat] += def.perLevel * p.level;
      if (p.evo) add(def.evo.stats);
    }
    for (const c of this.cards) {
      const def = CARD_BY_ID[c.id];
      if (def.stats) add(def.stats, c.stacks);
    }
    add(this.bonus);
    add(this.meta.stats);
    for (const b of this.buffs) add(b.stats);
    for (const t of this.synEffects) if (t.stats) add(t.stats);
    // Ekwipunek: bonusy bazowe i afiksy; mnożniki (broń) po dodawaniu.
    const itemMul: Partial<Record<keyof Stats, number>> = {};
    for (const it of Object.values(this.equipment)) {
      if (!it) continue;
      // Wartości po kuźni (pęknięcie, progi +6 i +15).
      if (it.implicit.mode === 'add') s[it.implicit.stat] += implicitOf(it);
      else itemMul[it.implicit.stat] = (itemMul[it.implicit.stat] ?? 1) * implicitOf(it);
      const k = forgeMul(it);
      for (const a of it.affixes) s[a.stat] += a.value * (a.stat === 'amount' ? 1 : k);
    }
    for (const u of equippedUniques(this)) {
      if (u.stats) add(u.stats);
      for (const k in u.mul ?? {}) itemMul[k as keyof Stats] = (itemMul[k as keyof Stats] ?? 1) * u.mul![k as keyof Stats]!;
    }
    for (const { def, v } of equippedAwakenings(this)) if (def.stats) add(def.stats(v));
    for (const sec of activeSecrets(this)) if (sec.stats) add(sec.stats);
    // Wierność broni (obrażenia: damageEnemy).
    const lt = this.loyal;
    if (lt) { s.atkSpeed += lt * BAL.loyal.atkSpeed; s.area += lt * BAL.loyal.area; s.amount += Math.ceil(lt / BAL.loyal.amountEvery); }
    // Szał Borguna: szybkość ataku i leczenie z obrażeń (obrażenia: resourceDamageMul).
    if (this.rageT > 0) {
      const F = BAL.resource.fury, pw = 1 + this.flag('res.power');
      s.atkSpeed += F.rageAtk * pw;
      s.lifesteal += F.rageLeech;
    }
    const ult = this.abilities.ult;
    if (ult.def.kind === 'titan' && ult.activeT > 0) {
      s.might += ult.def.p.might + ult.def.pl.might * (ult.level - 1);
      s.armor += ult.def.p.armor;
      s.area += 0.3;
    }
    if (this.flag('momentum') > 0) s.might += s.speedBonus * this.flag('momentum');
    for (const c of this.cards) {
      const def = CARD_BY_ID[c.id];
      for (const key in def.mul ?? {}) s[key as keyof Stats] *= Math.pow(def.mul![key as keyof Stats]!, c.stacks);
    }
    for (const k in itemMul) s[k as keyof Stats] *= itemMul[k as keyof Stats]!;
    for (const k in this.meta.mul) s[k as keyof Stats] *= this.meta.mul[k as keyof Stats]!;
    for (const t of this.synEffects) for (const k in t.mul ?? {}) s[k as keyof Stats] *= t.mul![k as keyof Stats]!;
    // Bonusy mapy Ekspedycji: złoto i doświadczenie.
    s.greed *= 1 + this.flag('mapGold');
    s.growth *= 1 + this.flag('mapXp');
    for (const k in BAL.softCaps) s[k as keyof Stats] = BAL.softCap(s[k as keyof Stats], BAL.softCaps[k as keyof Stats]!);
    s.maxHp = Math.max(1, s.maxHp);
    const oldMax = this.stats.maxHp;
    this.stats = s;
    if (s.maxHp > oldMax) this.player.hp += s.maxHp - oldMax;
    this.player.hp = Math.min(this.player.hp, s.maxHp);
  }

  addWeapon(id: string): void {
    // Najmniejszy wolny indeks slotu (po fuzji w środku listy może zostać luka).
    let slot = 0;
    while (this.weapons.some((w) => w.slot === slot)) slot++;
    this.weapons.push({ def: WEAPON_BY_ID[id], level: 1, timer: 0.3, slot, angle: 0, shots: 0, bonus: {} });
  }

  addXp(v: number): void {
    this.xp += v * this.stats.growth;
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      this.xpNext = BAL.xpToNext(this.level);
      this.pendingLevels++;
      const f = this.addFx('ring', this.player.x, this.player.y, C.gold, 0.4);
      if (f) f.r = 22;
      this.burst(this.player.x, this.player.y, C.yellow, 16, 70);
      if (this.level % BAL.cardEveryLevels === 0) this.pendingCards.push('level');
      const L = BAL.loyal;
      if (this.level >= L.first && (this.level - L.first) % L.every === 0 && this.weapons.length === 1) {
        this.cardState.loyal = (this.cardState.loyal ?? 0) + 1;
        this.showBanner(`Wierność broni ${this.cardState.loyal}: ${this.weapons[0].def.name} jest mocniejsza!`);
        this.recomputeStats();
      }
      this.emit('onLevelUp');
    }
  }

  /** Stopień Wierności broni (BAL.loyal); 0, gdy gracz ma więcej niż jedną broń. */
  get loyal(): number {
    return this.weapons.length === 1 ? this.cardState.loyal ?? 0 : 0;
  }

  /** Następny poziom, na którym Wierność broni zyska stopień. */
  get nextLoyalLevel(): number {
    const L = BAL.loyal;
    return this.level < L.first ? L.first : L.first + (Math.floor((this.level - L.first) / L.every) + 1) * L.every;
  }

  /** Liczba zabójstw potrzebna do następnego ultimate. */
  ultNeed(): number {
    return Math.round((this.abilities.ult.def.charge ?? BAL.ultKillsDefault) * Math.pow(BAL.ultGrowth, this.ultUses));
  }

  /** Leczenie z uwzględnieniem kart: blokada leczenia, nadmiar → tarcza. */
  heal(v: number): void {
    if (this.flag('noHeal') > 0 || v <= 0) return;
    v *= 1 - Math.min(0.9, this.flag('healCut'));
    // Zbroja Wiecznej Warty (unikat): leczenie zamienia się w tarczę.
    const toShield = this.flag('healShield');
    if (toShield > 0) { this.addShield(v, toShield); return; }
    const p = this.player;
    const room = this.stats.maxHp - p.hp;
    // Widok leczenia: liczymy tylko faktycznie odzyskane HP (zielone liczby co pół sekundy, suma w podsumowaniu).
    const got = Math.min(v, room);
    this.healAcc += got;
    this.healed += got;
    if (got > 0) this.healGlow = 0.3;
    if (v <= room) p.hp += v;
    else {
      p.hp = this.stats.maxHp;
      const cap = this.flag('overhealShield');
      if (cap > 0) this.addShield(v - room, cap);
    }
    // Wiara (Aurel) rośnie z leczenia — na końcu, bo pełna wiara sama leczy (Łaska).
    if (got > 0) resourceOnHeal(this, got);
  }

  /** Dodaje tarczę, nie przekraczając limitu `capFrac` × maks. HP (nie obcina tarczy z innych źródeł). Zwraca przyrost. */
  addShield(amount: number, capFrac: number): number {
    const cap = this.stats.maxHp * capFrac;
    const p = this.player;
    if (p.shield >= cap) return 0;
    const before = p.shield;
    p.shield = Math.min(cap, p.shield + amount);
    return p.shield - before;
  }

  /**
   * Tarcza za zabójstwo: `frac` × maks. HP, ze wspólnym limitem przyrostu na sekundę (BAL.killShieldRate).
   * Bez limitu szybkie zabijanie odnawiało tarczę szybciej, niż wrogowie ją zbijali.
   */
  killShield(frac: number, capFrac: number): void {
    const gain = Math.min(this.killShieldBudget, this.stats.maxHp * frac);
    if (gain > 0) this.killShieldBudget -= this.addShield(gain, capFrac);
  }

  // ================= walka =================

  /**
   * Jedyne miejsce, gdzie wróg traci HP: krytyki (z nadkrytykiem), redukcja elit, odrzut,
   * ogłuszenie, wampiryzm, liczby obrażeń, statystyki per źródło, hook onHit i śmierć.
   */
  damageEnemy(e: Enemy, base: number, src: string, o: DamageOpts = {}): void {
    if (e.dead || (e.boss && e.invuln > 0)) return;
    const st = this.stats;
    let mult = 1;
    if (!o.dot && (o.forceCrit || rng.chance(Math.min(1, st.crit + (this.srcCrit.get(src) ?? 0) + resourceCrit(this))))) {
      mult = st.critMult;
      if (this.flag('overcrit') > 0 && st.crit > 1 && rng.chance(Math.min(1, st.crit - 1))) mult *= st.critMult;
    }
    const crit = mult > 1;
    // Szał (super-bonus): obrażenia rosną z brakującym HP gracza.
    const rage = this.flag('rage') > 0 ? 1 + this.flag('rage') * (1 - this.player.hp / st.maxHp) : 1;
    // Porażenie (błyskawica): wróg otrzymuje więcej obrażeń ze wszystkich źródeł.
    const shock = e.shockT > 0 ? ELEM.shockMul + this.flag('shockBonus') : 1;
    // Kruszenie (reakcja): następne trafienie wzmocnione; Pogromca olbrzymów: elity i bossowie.
    let brittle = 1;
    if (e.brittle > 0 && !o.dot) { brittle = e.brittle; e.brittle = 0; }
    const big = e.boss || e.elite ? 1 + this.flag('bossDmg') : 1;
    const lore = this.lore[e.boss ? 'boss' : e.def.id] ?? 1;
    // Spokój (karta z osiągnięcia): więcej obrażeń po dłuższym czasie bez trafienia.
    const calm = this.flag('calm') > 0 && this.totalTime - this.lastHurtAt >= BAL.feats.calmAfter ? 1 + this.flag('calm') : 1;
    const loyal = this.loyal && src === this.weapons[0].def.name ? Math.pow(1 + BAL.loyal.dmg, this.loyal) : 1;
    // Odporność (boss: żywioł biomu; mapa Ekspedycji: żywioł mapy) i podatność mapy na żywioł źródła.
    const el = damageElement(src, this.augElem), res = this.resistOf(e);
    const resist = res !== undefined && el === res ? BAL.bossResist.mul : 1;
    const weak = el !== undefined && el === this.levelInfo.weak ? BAL.expedition.weakMul : 1;
    // Długa walka z bossem: boss słabnie (BAL.bossSoften); pogoń HP tego nie wyrównuje.
    const soft = e.boss && !this.dungeon ? this.bossSoftMul(e) : 1;
    if (soft > 1 && !this.bossSoftShown) { this.bossSoftShown = true; this.showBanner(`${this.levelInfo.bossName} weakens!`); }
    // Podatność raz: ticki stanów (podpalenie, trucizna) dziedziczą ją przez bazę z trafienia, które je nałożyło.
    const dmg = Math.max(0.01, base * mult * rage * shock * brittle * big * lore * calm * resist * (o.dot ? 1 : weak) * soft * loyal * resourceDamageMul(this, src) * (1 - e.dr));
    // Statystyki (tabela obrażeń, DPS) i siła gracza (trudność, 0.35.2: bez nadwyżki ponad HP wroga) liczą tylko zadane
    // obrażenia; kradzież życia całe trafienie.
    const dealt = Math.min(dmg, Math.max(0, e.hp));
    e.hp -= dmg;
    if (!this.reduceFlash) e.flash = 3;
    this.dmgBySource.set(src, (this.dmgBySource.get(src) ?? 0) + dealt);
    this.dmgTotal += dealt;
    const pct = PCT_SOURCES.has(src) || this.pctDepth > 0;
    // Siła buildu bez powinowactwa mapy: mapa podatna / odporna działa w pełni, pogoń HP jej nie wyrównuje.
    if (!pct) this.dmgStep += dealt / (resist * weak * soft);
    this.elemDmg[el ?? 'none'] = (this.elemDmg[el ?? 'none'] ?? 0) + dealt / (resist * weak);
    this.lastHitSrc = src;
    if (st.lifesteal > 0) this.heal(Math.min(dmg * st.lifesteal, st.maxHp * 0.02));
    if (o.knock) {
      const l = Math.hypot(o.kx ?? 0, o.ky ?? 0) || 1;
      const f = o.knock * 25 * (1 - e.def.knockResist);
      e.kx += ((o.kx ?? 0) / l) * f;
      e.ky += ((o.ky ?? 0) / l) * f;
    }
    if (o.stun) e.stunT = Math.max(e.stunT, o.stun);
    // Czytelność w tłumie: przy wielu wrogach liczby tylko dla krytyków.
    // Zwykłe liczby nie nakładają się: przy świeżej liczbie tuż obok nowa jest pomijana (krytyki zawsze widać).
    const n = this.damageNumbers && (crit || (this.enemies.count < BAL.juice.numbersCritOnly && !this.numberNear(e.x, e.y - e.radius))) ? this.dmgNums.obtain() : null;
    if (n) {
      n.x = e.x + rng.range(-3, 3);
      n.y = e.y - e.radius - 2;
      n.life = crit ? 0.8 : 0.5;
      n.big = crit;
      // Krytyk: wykrzyknik, podwójny krytyk (Nadkrytyk): dwa.
      n.text = fmt(dmg) + (mult > st.critMult ? '!!' : crit ? '!' : '');
      n.col = REACTION_COL[src] ?? (o.dot ? (src === 'Trucizna' ? C.lime : C.orange) : mult > st.critMult ? C.orange : crit ? C.yellow : C.white);
    }
    if (!this.lowFx && this.sparksThisStep < BAL.fx.sparksPerStep && rng.chance(0.5)) {
      this.sparksThisStep++;
      const s = this.addFx('spark', e.x + rng.range(-2, 2), e.y + rng.range(-3, 1), C.white, 0.16);
      if (s) s.r = crit ? 2 : 1;
    }
    if (!o.dot && dmg > this.maxHit) { this.maxHit = dmg; this.maxHitSrc = src; }
    // Krytyk (0.33): trzask i błysk w miejscu trafienia (co kilka kroków, żeby tłum nie zagłuszył gry).
    if (crit && !o.dot && this.step - this.critFxStep >= BAL.streak.critFxEvery) {
      this.critFxStep = this.step;
      sfx.play('crit');
      const f = this.addFx('ring', e.x, e.y, mult > st.critMult ? C.orange : C.yellow, 0.12);
      if (f) f.r = 5 + e.radius * e.scale;
      if (!this.reduceFlash) this.burst(e.x, e.y - 2, C.white, 3, 70);
    }
    if (o.dot) { if (e.hp <= 0 && !e.dead) this.killEnemy(e); return; }
    // Trafienia procentowe i reakcji nie nakładają żywiołów (inaczej reakcje napędzałyby się same).
    if (!pct) resourceOnHit(this, e);
    if (!pct && REACTION_COL[src] === undefined) {
      const el = this.augElem.get(src) ?? SRC_ELEMENT[src];
      if (el) this.applyElement(e, el, dmg * (1 + (this.srcElem.get(src) ?? 0)));
      // Karty i super-bonusy: szansa na żywioł przy trafieniu, krytyki porażają.
      for (const k of ELEMENT_LIST) if (!e.dead && this.flag(`elemChance.${k}`) > 0 && rng.chance(this.flag(`elemChance.${k}`))) this.applyElement(e, k, dmg);
      const any = this.flag('elemChance.any');
      if (any > 0 && !e.dead && rng.chance(any)) this.applyElement(e, rng.pick(ELEMENT_LIST), dmg);
      if (crit && this.flag('critShock') > 0 && !e.dead) this.applyElement(e, 'lightning', dmg);
    }
    // Ścinacz: zwykli wrogowie i elity poniżej progu HP giną od razu.
    const cull = this.flag('cull');
    if (cull > 0 && !e.boss && e.hp > 0 && e.hp < e.maxHp * cull) e.hp = 0;
    sfx.play('hit');
    if (pct) this.pctDepth++;
    this.emit('onHit', e, dmg, crit);
    if (pct) this.pctDepth--;
    if (e.hp <= 0 && !e.dead) this.killEnemy(e);
  }

  /** Żywioł, na który wróg jest odporny: boss biomu poziomu (BAL.bossResist). */
  resistOf(e: Enemy): Element | undefined {
    return e.boss ? BAL.bossResist.biome[this.levelInfo.biome % BAL.bossResist.biome.length] ?? undefined : this.levelInfo.resist;
  }

  /** Nakłada stan żywiołu po trafieniu (siła z `elemPower`); najpierw sprawdza reakcję z innym stanem na wrogu. */
  applyElement(e: Enemy, el: Element, dmg: number): void {
    if (e.dead || this.resistOf(e) === el || this.react(e, el, dmg)) return;
    sfx.play(el === 'fire' ? 'burn' : el === 'ice' ? 'freeze' : el === 'lightning' ? 'shock' : 'poison');
    const ep = 1 + this.stats.elemPower;
    switch (el) {
      case 'fire':
        e.burnT = ELEM.burnTime;
        e.burnDps = Math.max(e.burnDps, dmg * ELEM.burnRatio * ep);
        break;
      case 'ice':
        e.slowF = Math.max(e.slowF, Math.min(ELEM.chillMaxSlow, ELEM.chillSlow * ep));
        e.slowT = Math.max(e.slowT, ELEM.chillTime);
        if (++e.chill >= ELEM.freezeStacks) { e.chill = 0; e.stunT = Math.max(e.stunT, ELEM.freezeTime); }
        break;
      case 'lightning':
        e.shockT = ELEM.shockTime;
        break;
      case 'poison':
        e.poisonStacks = Math.min(ELEM.poisonMaxStacks, e.poisonStacks + 1);
        e.poisonT = ELEM.poisonTime;
        e.poisonUnit = Math.max(e.poisonUnit, dmg * ELEM.poisonRatio * ep);
        break;
    }
  }

  /**
   * Reakcja żywiołów (BAL.reactions): nowy żywioł `el` spotyka inny stan na wrogu. Zwraca true, gdy reakcja
   * zużyła nowy żywioł (nie jest już nakładany). Napis nad wrogiem i liczby w kolorze reakcji.
   */
  private react(e: Enemy, el: Element, dmg: number): boolean {
    if (e.reactT > 0) return false;
    const has = (k: Element) => k !== el && (k === 'fire' ? e.burnT > 0 : k === 'ice' ? e.slowT > 0 : k === 'lightning' ? e.shockT > 0 : e.poisonStacks > 0);
    const pair = (a: Element, b: Element) => (el === a && has(b)) || (el === b && has(a));
    const R = BAL.reactions, power = 1 + this.flag('reactPower');
    const label = (text: string, col: number) => {
      e.reactT = R.cd * Math.max(0, 1 - this.flag('reactCd'));
      this.reactions++;
      this.popText(e.x, e.y - e.radius - 10, text, col);
      sfx.play('react');
    };
    if (pair('fire', 'ice')) {
      label('Para!', C.lgray);
      e.slowT = 0; e.slowF = 0; e.chill = 0; e.burnT = 0; e.burnDps = 0;
      this.damageEnemy(e, dmg * R.steam.mul * power, 'Para', { stun: R.steam.stun });
      return true;
    }
    if (pair('lightning', 'ice')) {
      label('Kruszenie!', C.cyan);
      e.slowT = 0; e.slowF = 0; e.chill = 0;
      e.brittle = R.shatter.mul * power;
      return true;
    }
    if (pair('fire', 'poison')) {
      label('Wybuch toksyn!', C.lime);
      const d = e.poisonUnit * e.poisonStacks * R.toxic.mul * power;
      e.poisonStacks = 0; e.poisonUnit = 0; e.poisonT = 0;
      this.explode(e.x, e.y, R.toxic.r * this.stats.area, d, 'Wybuch toksyn', C.lime, 2);
      return true;
    }
    if (pair('lightning', 'poison')) {
      label('Przewodzenie!', C.yellow);
      const src = e, hit = [e.uid];
      for (let i = 0; i < R.conduct.n; i++) {
        const t = this.nearestEnemy(src.x, src.y, R.conduct.r, hit);
        if (!t) break;
        hit.push(t.uid);
        t.poisonStacks = Math.max(t.poisonStacks, src.poisonStacks);
        t.poisonUnit = Math.max(t.poisonUnit, src.poisonUnit);
        t.poisonT = ELEM.poisonTime;
        const f = this.addFx('line', src.x, src.y, C.lime, 0.15);
        if (f) { f.x2 = t.x; f.y2 = t.y; }
      }
      return false;
    }
    if (pair('fire', 'lightning')) {
      label('Przeciążenie!', C.orange);
      e.shockT = 0;
      this.explode(e.x, e.y, R.overload.r * this.stats.area, dmg * R.overload.mul * power, 'Przeciążenie', C.orange, R.overload.knock);
      return true;
    }
    return false;
  }

  killEnemy(e: Enemy): void {
    e.dead = true;
    if (e.elite && !e.boss) { this.eliteLifeSum += e.age; this.eliteLifeN++; } else if (!e.boss) { this.lifeSum += e.age; this.lifeN++; }
    this.kills++;
    this.levelKills++;
    this.ultCharge += (e.boss ? 30 : e.elite ? 5 : 1) * (1 + this.flag('ultGain'));
    this.burst(e.x, e.y, e.def.color, e.boss ? 60 : e.elite ? 24 : 5, e.boss ? 90 : 50);
    // Rozbłysk śmierci: białe iskry (elity i boss także złote) i zatrzymanie klatki przy mocnych wrogach.
    this.burst(e.x, e.y, C.white, e.boss ? 20 : e.elite ? 10 : 2, 80);
    if (e.boss || e.elite) { this.burst(e.x, e.y, C.gold, e.boss ? 30 : 12, 110); this.freeze(e.boss ? BAL.juice.hitstopBoss : BAL.juice.hitstopElite); }
    if (this.fx.count < BAL.fx.poofCap) {
      const f = this.addFx('poof', e.x, e.y, C.lgray, 0.32);
      if (f) f.r = e.boss ? 3 : e.elite ? 2 : 1;
      // Znikanie: sylwetka wroga blednie i lekko unosi się (krótko, tylko przy wolnym miejscu na efekty).
      const d = e.boss ? null : this.addFx('fade', e.x, e.y, C.white, 0.22);
      if (d) { d.sprite = `${e.sprite}@0`; d.r = e.scale; d.a0 = e.x > this.player.x ? 1 : 0; }
    }
    if (e.boss || e.elite) this.boomFx(e.x, e.y, e.boss ? 40 : 20);
    this.spawnGem(e.x, e.y, e.xp);
    // Elita z cechą Rozszczepiacz (R3): kopie bez cech, HP jak kidHp × zwykły wróg (bez mnożnika elity).
    if (e.elite?.includes('splitter')) {
      const x = e.x, y = e.y, id = e.def.id, hp = (e.maxHp / BAL.eliteHpMul) * BAL.eliteTraits.kidHp;
      this.schedule(0, () => {
        // Cel wykonany tym zabójstwem: bez kopii na ekranie zwycięstwa.
        if (this.outcome !== 'none' || (this.bossSpawned && !this.boss && this.mode !== 'endless')) return;
        for (let k = 0; k < BAL.eliteTraits.kids; k++) {
          const a = (k / BAL.eliteTraits.kids) * Math.PI * 2, c = spawnEnemy(this, id, x + Math.cos(a) * 8, y + Math.sin(a) * 8);
          if (c) { c.maxHp = c.hp = hp; c.scale = 0.8; c.kx = Math.cos(a) * 60; c.ky = Math.sin(a) * 60; }
        }
      });
    }
    // Rozszczepieniec: po śmierci dwa mniejsze (w następnym kroku, poza pętlą wrogów).
    if (e.def.behavior === 'splitter' || e.def.id === 'voidprism') {
      // Rozszczepieniec pęka na dwa Odpryski, Pryzmat Pustki na dwa Rozszczepieńce.
      const x = e.x, y = e.y, kid = e.def.id === 'voidprism' ? 'splitter' : 'splitling';
      this.schedule(0, () => {
        for (let k = 0; k < BAL.biomeEnemies.splitKids; k++) {
          const c = spawnEnemy(this, kid, x + (k ? 7 : -7), y + rng.range(-4, 4));
          if (c) { if (kid === 'splitling') c.scale = 0.7; c.kx = (k ? 1 : -1) * 60; }
        }
      });
    }
    sfx.play('kill');
    const hp = this.hero.passive;
    if (hp.kind === 'killShield') this.killShield(BAL.killShieldPerKill, hp.value + this.flag('passive.shieldCap'));
    // Zew dusz (Morwen): co N-te zabójstwo z ciała wroga powstaje duch-sługa.
    if (hp.kind === 'killSummon' && (this.cardState.killSummon = (this.cardState.killSummon ?? 0) + 1) >= Math.max(3, hp.value - this.flag('passive.n'))) {
      this.cardState.killSummon = 0;
      spawnMinion(this, e.x, e.y, this.cardDamage(BAL.minions.passiveDmg), BAL.minions.passiveLife, false, hp.name);
    }
    // Łowczyni (Vesper): elita albo co N-te zabójstwo odnawia Q.
    if (hp.kind === 'killReset' && (e.elite || e.boss || (this.cardState.killReset = (this.cardState.killReset ?? 0) + 1) >= Math.max(3, hp.value - this.flag('passive.n')))) {
      this.cardState.killReset = 0;
      if (this.abilities.q.cd > 0) { this.abilities.q.cd = 0; this.popText(this.player.x, this.player.y - 14, 'Odnowione!', C.lavender); }
    }
    // Żniwo (augment Duszek): wróg zabity duszą może powstać jako sługa.
    if (this.aug('souls_raise') && (this.lastHitSrc === 'Duszki' || this.lastHitSrc === 'Rój dusz') && rng.chance(BAL.minions.harvestChance)) {
      spawnMinion(this, e.x, e.y, this.cardDamage(BAL.minions.passiveDmg), BAL.minions.passiveLife, false, 'Żniwo');
    }
    if (e.sit) situationKill(this, e);
    const kid = e.boss ? 'boss' : e.def.id;
    this.killsById[kid] = (this.killsById[kid] ?? 0) + 1;
    resourceOnKill(this, e);
    taskOnKill(this, e);
    secretsOnKill(this, e);
    comboOnKill(this);
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.onStreakKill();
    featsOnKill(this, e);
    forgeKillDrops(this, e);
    this.emit('onKill', e);
    if (e.elite) {
      // Zabicie elity (0.33): napis, złoty krąg i wybuch, niezależnie od zatrzymania klatki wyżej.
      this.popText(e.x, e.y - 14, 'Elite slain!', C.gold);
      const ring = this.addFx('ring', e.x, e.y, C.gold, 0.35);
      if (ring) ring.r = 34;
      sfx.play('explode');
      // Mapa elit: skrzynia co N-ta elita; Polowanie: miniboss kończy łowy, eskorta bez skrzyń.
      const X = BAL.expedition, hunt = this.levelInfo.objective.kind === 'hunt', mini = BIOME_MINIBOSS.includes(e.def.id);
      if (hunt && mini) this.huntKilled = true;
      // Mapa elit i Zasadzka: skrzynia co N-ta elita; eskorta Polowania bez skrzyń i kart.
      const counted = !!this.expedition && (this.levelInfo.eliteMul < 1 || !!this.levelInfo.ambush) && !mini, escort = hunt && !mini;
      if (counted) this.eliteKills++;
      if (!escort && (!counted || this.eliteKills % X.eliteChestEvery === 0)) this.dropChest(e.x, e.y, 'elite');
      for (let i = 0; i < 5; i++) this.spawnPickup(e.x + rng.range(-8, 8), e.y + rng.range(-8, 8), 'coin', 1);
      if (!escort) this.pendingCards.push('elite');
    } else if (e.boss) {
      this.onBossKilled();
    } else if (e.def.id === 'goldslime') {
      for (let i = 0; i < BAL.events.goldSlimeCoins; i++) this.spawnPickup(e.x + rng.range(-12, 12), e.y + rng.range(-12, 12), 'coin', 1);
      this.dropChest(e.x, e.y, 'elite');
      this.showBanner('Złoty szlam złapany!');
      grantMat(this, 'heart', BAL.forge.slimeHeart);
    } else {
      if (rng.chance(BAL.itemDropChance * (1 + this.flag('mapLoot')) * (1 + this.luck() * BAL.luckDrop))) this.dropChest(e.x, e.y, 'drop');
      else if (rng.chance(BAL.meatChance)) this.spawnPickup(e.x, e.y, 'meat', 0);
      else if (rng.chance(BAL.magnetChance)) this.spawnPickup(e.x, e.y, 'magnet', 0);
      else if (rng.chance(BAL.coinChance * (1 + this.flag('goldRain') * BAL.levelEvents.goldRain))) this.spawnPickup(e.x, e.y, 'coin', 1);
    }
  }

  /** Boss pokonany = poziom ukończony. */
  private onBossKilled(): void {
    const bossAge = this.boss?.age ?? Infinity;
    this.boss = null;
    this.pendingLoot.push(this.rollLoot('boss'));
    this.pendingCards.push('boss');
    this.pendingPowers++;
    this.bossKills++;
    forgeBossDrops(this);
    // Bezbłędnie: boss pokonany bez trafienia — dodatkowa moc bossa (trofeum).
    if (!this.cardState.bossHit) { this.pendingPowers++; this.noHitBosses++; this.showBanner('Bezbłędnie! Dodatkowa moc bossa'); }
    // Pacyfista (sekret): unikat z najbliższego bossa.
    if (this.cardState[PACIFIST_KEY]) { delete this.cardState[PACIFIST_KEY]; this.pendingLoot.push({ source: 'boss', item: rollUnique(this.depth) }); }
    this.cardRerolls++;
    this.gold += 30 * this.stats.greed;
    // Sekretny boss w lochu (kurhan): łup Króla, jego moc w ofercie, poziom trwa dalej (wyjście portalem).
    if (this.dungeon) {
      this.bossTitle = null;
      if (this.dungeon.kind === 'barrow') {
        this.pendingLoot.push({ source: 'boss', item: rollUnique(this.depth) });
        grantMat(this, 'void', 2);
        this.cardState.kingPower = 1;
        this.showBanner('Zapomniany Król pokonany!');
      }
      return;
    }
    this.featsLevel = featsOnBoss(this, bossAge);
    // Endless: gra toczy się dalej — kolejna głębokość (silniejsi wrogowie, następny biom) i boss za BAL.endlessBossEvery.
    if (this.mode === 'endless') {
      featsOnWin(this);
      this.collectAll();
      this.bossSpawned = false;
      this.nextBossAt = this.time + BAL.endlessBossEvery;
      this.depth++;
      this.levelInfo = this.levelFor(this.depth);
      this.onBuildChanged();
      this.showBanner(`Boss pokonany! Głębia ${this.depth}`);
      sfx.play('explode');
      return;
    }
    this.finishLevel('Boss pokonany!');
  }

  /**
   * Cel poziomu bez bossa wykonany (Ekspedycja: walka, elita) — nagroda zależy od węzła.
   * Wywoływane przez spawner w miejscu pojawienia się bossa.
   */
  clearObjective(): void {
    this.bossSpawned = true;
    const elite = this.levelInfo.eliteMul < 1, o = this.levelInfo.objective;
    if (elite || this.levelInfo.ambush) this.pendingLoot.push(this.rollLoot('elite'));
    // Polowanie: skrzynia bossa tylko za zabitego minibossa (ucieczka: sama karta walki i złoto).
    if (o.kind === 'hunt' && this.huntKilled) this.pendingLoot.push(this.rollLoot('boss'));
    this.pendingCards.push(elite ? 'elite' : 'fight');
    this.gold += BAL.expedition.fightGold * this.depth * this.stats.greed;
    this.finishLevel(o.kind === 'hunt' ? (this.huntKilled ? 'Hunt complete!' : 'The miniboss escaped...') : this.levelInfo.ambush ? 'Ambush survived!' : elite ? 'Elity pokonane!' : 'Walka wygrana!');
  }

  /** Koniec poziomu: zbiera wszystko z ziemi, czyści wrogów i pociski, ustawia zwycięstwo. */
  private finishLevel(banner: string): void {
    this.collectAll();
    for (const e of this.enemies.items) if (!e.dead) { e.dead = true; this.burst(e.x, e.y, e.def.color, 2, 30); }
    this.showBanner(banner);
    this.outcome = 'victory';
    this.outcomeT = 2.5;
    sfx.play('explode');
  }

  /** Klejnoty, monety i skrzynie z całej mapy trafiają od razu do gracza; pociski wrogów znikają. */
  private collectAll(): void {
    for (const g of this.gems.items) this.addXp(g.value);
    this.gems.clear();
    for (const it of this.pickups.items) {
      if (it.kind === 'coin') this.gold += it.value * this.stats.greed;
      if (it.kind === 'chest' && it.item) this.pendingLoot.push({ source: it.source, item: it.item });
    }
    this.pickups.clear();
    for (const b of this.bullets.items) this.burst(b.x, b.y, C.pink, 1, 20);
    this.bullets.clear();
    this.shake = 10;
  }

  /** Obrażenia dla gracza: nietykalność (unik), pancerz (diminishing returns), karty, tarcza, odrodzenie, śmierć. Zwraca true, gdy trafiło. */
  /**
   * Szansa na odbicie Mikiri (pasywka Takezo): rośnie z poziomem postaci; karty i Rozwój (passive.parry) przyspieszają
   * dojście do limitu, ale twardy limit `max` obejmuje wszystko (0.32.2: bez limitu było za mocne w późnej grze).
   */
  parryChance(): number {
    if (this.hero.passive.kind !== 'parry') return 0;
    const P = BAL.resource.parry;
    return Math.min(P.max, P.base + P.perLevel * (this.level - 1) + this.flag('passive.parry'));
  }

  /**
   * Odbicie (Mikiri): brak obrażeń, chwila nietykalności, kontra wokół i rytm. Pocisk (`bullet`) wraca w najbliższego wroga.
   * Zwraca true, gdy trafienie zostało odbite.
   */
  private tryParry(bullet?: { x: number; y: number; vx: number; vy: number }): boolean {
    const ch = this.parryChance();
    if (ch <= 0 || !rng.chance(ch)) return false;
    const p = this.player, P = BAL.resource.parry, dmg = this.cardDamage(this.hero.passive.value);
    p.iframes = Math.max(p.iframes, P.iframes);
    this.enemiesInCircle(p.x, p.y, P.riposteR * this.stats.area, (e) => this.damageEnemy(e, dmg, this.hero.passive.name, { kx: e.x - p.x, ky: e.y - p.y, knock: 3 }));
    const f = this.addFx('arc', p.x, p.y, C.white, 0.18);
    if (f) { const a = bullet ? Math.atan2(bullet.y - p.y, bullet.x - p.x) : rng.range(0, Math.PI * 2); f.r = 14; f.a0 = a - 1.2; f.a1 = a + 1.2; }
    if (bullet) {
      const t = this.nearestEnemy(p.x, p.y, 220), ang = t ? Math.atan2(t.y - p.y, t.x - p.x) : Math.atan2(-bullet.vy, -bullet.vx);
      this.spawnProjectile({ x: p.x, y: p.y, angle: ang, speed: 260, damage: dmg * P.reflect, src: this.hero.passive.name, sprite: 'knife', pierce: 2, life: 1 });
    }
    rhythmGain(this, P.rhythm);
    this.popText(p.x, p.y - 12, 'Parry!', C.cyan);
    sfx.play('hit');
    this.cardState['sec.parry'] = (this.cardState['sec.parry'] ?? 0) + 1;
    return true;
  }

  hurtPlayer(base: number, bullet?: { x: number; y: number; vx: number; vy: number }): boolean {
    const p = this.player;
    if (this.outcome !== 'none' || p.iframes > 0) return false;
    if (this.tryParry(bullet)) return false;
    // Tarcza bogów (super-bonus): co N sekund jedno trafienie jest blokowane.
    const aegis = this.flag('aegis');
    if (aegis > 0 && (this.cardState.aegis ?? aegis) >= aegis) {
      this.cardState.aegis = 0;
      p.iframes = Math.max(p.iframes, 0.3); // blok obejmuje też pociski lecące razem z tym
      this.popText(p.x, p.y - 10, 'Blok!', C.cyan);
      const f = this.addFx('ring', p.x, p.y, C.cyan, 0.3);
      if (f) f.r = 14;
      return false;
    }
    // Nimb (karta z osiągnięcia): pierwsze trafienie na poziomie blokowane.
    if (this.flag('firstBlock') > 0 && !this.cardState.halo) {
      this.cardState.halo = 1;
      p.iframes = Math.max(p.iframes, 0.5);
      this.popText(p.x, p.y - 10, 'Nimb!', C.yellow);
      return false;
    }
    let dmg = base * BAL.armorMul(this.stats.armor) * (1 - Math.min(0.8, this.flag('dmgTaken'))) * resourceTakenMul(this) * (this.inBanner ? 1 + BAL.eliteTraits.bannerTaken : 1);
    const total = dmg;
    this.takenTotal += total;
    const absorbed = Math.min(p.shield, dmg);
    p.shield -= absorbed;
    dmg -= absorbed;
    p.hp -= dmg;
    p.hurtCd = BAL.hurtFlash;
    this.hurtFx = 0.25;
    p.flash = 6;
    this.addShake(1.5);
    sfx.play('hurt');
    const n = this.dmgNums.obtain();
    if (n) { n.x = p.x; n.y = p.y - 8; n.life = 0.7; n.text = fmt(total); n.col = C.red; n.big = true; }
    if (total >= this.stats.maxHp * BAL.juice.hurtBig) this.freeze(BAL.juice.hitstopHurt);
    resourceOnHurt(this, total);
    if (this.boss) this.cardState.bossHit = 1;
    comboOnHurt(this);
    taskOnHurt(this);
    this.feat.hits++;
    this.runHits++;
    this.lastHurtAt = this.totalTime;
    this.emit('onDamageTaken', total);
    // Odwet (węzeł Rozwoju Borguna): oberwanie wyzwala darmowy Wstrząs (najwyżej co `counterSlam` s).
    const counter = this.flag('counterSlam');
    if (counter > 0 && this.totalTime >= (this.cardState.counterSlam ?? 0)) {
      this.cardState.counterSlam = this.totalTime + counter;
      castAbility(this, 'e', true);
    }
    if (p.hp <= 0) {
      if (this.revivesLeft > 0) {
        this.revivesLeft--;
        p.hp = this.stats.maxHp * 0.5;
        p.iframes = 2;
        this.explode(p.x, p.y, 60, this.cardDamage(40), 'Feniks', C.orange, 6);
        this.showBanner('Feniks!');
        return true;
      }
      p.hp = 0;
      this.outcome = 'dead';
      this.outcomeT = 1.8;
      this.burst(p.x, p.y, C.red, 50, 80);
      this.addShake(8);
    }
    return true;
  }

  /**
   * Odpytuje wrogów w okręgu (spatial hash + dokładny test z promieniem wroga)
   * i wywołuje `fn` dla każdego trafionego.
   */
  enemiesInCircle(x: number, y: number, r: number, fn: (e: Enemy) => void): void {
    const cand = this.hash.query(x, y, r + 16, (this.qStack[this.qDepth] ??= []));
    this.qDepth++;
    for (let i = 0; i < cand.length; i++) {
      const e = cand[i];
      if (e.dead) continue;
      const rr = r + e.radius;
      const dx = e.x - x, dy = e.y - y;
      if (dx * dx + dy * dy <= rr * rr) fn(e);
    }
    this.qDepth--;
  }

  nearestEnemy(x: number, y: number, maxR: number, exclude?: number[]): Enemy | null {
    const cand = this.hash.query(x, y, maxR, this.qb);
    let best: Enemy | null = null;
    let bd = maxR * maxR;
    for (let i = 0; i < cand.length; i++) {
      const e = cand[i];
      if (e.dead || (exclude && exclude.includes(e.uid))) continue;
      const d = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  /** Czy źródło ze slotu może znów trafić tego wroga (odstęp w krokach symulacji). */
  canHit(e: Enemy, slot: number, intervalSteps: number): boolean {
    if (this.step - e.hitStamp[slot] < intervalSteps) return false;
    e.hitStamp[slot] = this.step;
    return true;
  }

  // ================= tworzenie encji i efektów =================

  newUid(): number {
    return this.uid++;
  }

  spawnProjectile(s: ProjectileSpec): Projectile | null {
    const pr = this.projectiles.obtain();
    if (!pr) return null;
    pr.x = s.x; pr.y = s.y;
    pr.vx = Math.cos(s.angle) * s.speed;
    pr.vy = Math.sin(s.angle) * s.speed;
    pr.life = s.life ?? 1.5;
    pr.damage = s.damage;
    pr.radius = s.radius ?? 3;
    pr.pierce = s.pierce ?? 0;
    pr.hits.length = 0;
    pr.sprite = s.sprite ?? 'bolt';
    pr.src = s.src;
    pr.kind = s.kind ?? 'normal';
    pr.returning = false;
    pr.knock = s.knock ?? 1;
    pr.forceCrit = s.forceCrit ?? false;
    pr.t = 0;
    pr.bounces = this.flag('bounce');
    pr.retarget = 0; pr.split = 0; pr.splitEnd = 0; pr.retMul = 1; pr.blast = 0;
    return pr;
  }

  /** Kryształ XP; przy limicie łączy wartość z istniejącym kryształem zamiast tworzyć nowy. */
  spawnGem(x: number, y: number, value: number): void {
    if (this.gems.count >= BAL.gemCap) {
      const g = this.gems.items[this.gemMerge++ % this.gems.count];
      g.value += value;
      return;
    }
    const g = this.gems.obtain()!;
    g.x = x; g.y = y; g.value = value; g.flying = false; g.v = 0;
  }

  spawnPickup(x: number, y: number, kind: PickupKind, value: number): Pickup | null {
    const p = this.pickups.obtain();
    if (!p) return null;
    p.x = x; p.y = y; p.kind = kind; p.value = value; p.flying = false; p.v = 0; p.item = null; p.source = 'drop'; p.mimic = false;
    return p;
  }

  /** Seria zabójstw: liczy zabójstwa w odstępach najwyżej BAL.streak.gap s; przy progach napis, dźwięk i wstrząs. */
  private onStreakKill(): void {
    const S = BAL.streak;
    if (this.totalTime - this.streakT > S.gap) this.streakN = 0;
    this.streakT = this.totalTime;
    this.streakN++;
    this.bestStreak = Math.max(this.bestStreak, this.streakN);
    const tier = (S.tiers as readonly number[]).indexOf(this.streakN);
    if (tier < 0) return;
    const p = this.player, col = [C.yellow, C.orange, C.red, C.hotpink][tier];
    this.popText(p.x, p.y - 28, `${S.names[tier]}! x${this.streakN}`, col);
    sfx.play('streak');
    this.addShake(1 + tier);
  }

  /** Chwila ewolucji (broń, umiejętność, pasywka, fuzja): zatrzymanie, baner, złoty krąg i fanfara. */
  celebrate(name: string, fusion = false): void {
    const p = this.player;
    this.freeze(BAL.streak.evolveFreeze);
    this.showBanner(fusion ? `Fusion: ${name}!` : `Evolution: ${name}!`);
    for (const [r, t] of [[30, 0.35], [55, 0.5]] as const) { const f = this.addFx('ring', p.x, p.y, C.gold, t); if (f) f.r = r; }
    this.burst(p.x, p.y, C.gold, 26, 90);
    this.burst(p.x, p.y, C.white, 10, 60);
    this.addShake(3);
    sfx.play('evolve');
  }

  /** Szczęście: statystyka bohatera (pasywka Podkowa, karty, synergie) plus flaga `itemLuck` (afiks Fortuna, karty, nagrody map). */
  luck(): number {
    return Math.max(0, this.stats.luck + this.flag('itemLuck'));
  }

  /** Łup ze źródła (jakość zależy od źródła, głębokości i Szczęścia); z bossów i elit rzadko unikat (BAL.uniques). */
  rollLoot(source: LootSource): { source: LootSource; item: Item } {
    const U = BAL.uniques, chance = source === 'boss' ? U.boss : source === 'elite' ? U.elite : 0, L = BAL.loot;
    // Szczęśliwy traf: Legendarny przedmiot albo unikat z dowolnego łupu.
    if (rng.chance(L.jackpot * (1 + this.luck()))) {
      this.showBanner('Szczęśliwy traf!');
      // Szczęśliwy traf (0.33): złoty deszcz iskier, napis nad bohaterem i krótkie zatrzymanie.
      this.popText(this.player.x, this.player.y - 20, 'Lucky find!', C.gold);
      this.burst(this.player.x, this.player.y, C.gold, 30, 100);
      this.burst(this.player.x, this.player.y, C.yellow, 14, 60);
      this.freeze(0.2);
      sfx.play('evolve');
      if (rng.chance(L.jackpotUnique)) {
        const item = rollUnique(this.depth);
        this.uniquesFound.add(item.unique!);
        return { source, item };
      }
      return { source, item: rollItem(this.depth, source, 0, undefined, RARITIES.length - 1) };
    }
    if (chance > 0 && rng.chance(chance * (1 + this.luck()))) {
      const item = rollUnique(this.depth);
      this.uniquesFound.add(item.unique!);
      return { source, item };
    }
    return { source, item: rollItem(this.depth, source, this.luck()) };
  }

  /** Skrzynia na ziemi z przedmiotem wylosowanym od razu — jakość widać po poświacie. */
  dropChest(x: number, y: number, source: LootSource): void {
    const p = this.spawnPickup(x, y, 'chest', 0);
    if (!p) return;
    const l = this.rollLoot(source);
    p.item = l.item;
    p.source = source;
    // Mimik (sekret mapy): część zwykłych skrzyń gryzie po podniesieniu.
    p.mimic = source === 'drop' && !l.item.unique && rng.chance(BAL.secretsMap.mimicChance);
  }

  burst(x: number, y: number, col: number, n: number, speed: number): void {
    if (this.lowFx) n = Math.ceil(n / 3);
    n = Math.min(n, BAL.fx.particlesPerStep - this.particlesThisStep);
    this.particlesThisStep += Math.max(0, n);
    for (let i = 0; i < n; i++) {
      const p = this.particles.obtain();
      if (!p) return;
      const a = rng.range(0, Math.PI * 2), s = rng.range(0.3, 1) * speed;
      p.x = x; p.y = y; p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s;
      p.max = p.life = rng.range(0.2, 0.5);
      p.col = col; p.size = rng.chance(0.3) ? 2 : 1;
    }
  }

  addFx(kind: Fx['kind'], x: number, y: number, col: number, life: number): Fx | null {
    const f = this.fx.obtain();
    if (!f) return null;
    f.kind = kind; f.x = x; f.y = y; f.x2 = x; f.y2 = y; f.r = 0; f.a0 = 0; f.a1 = 0;
    f.col = col; f.life = f.max = life; f.w = 1; f.sprite = '';
    return f;
  }

  addZone(kind: Zone['kind'], x: number, y: number, r: number, damage: number, life: number, slot: number, src: string): Zone | null {
    const z = this.zones.obtain();
    if (!z) return null;
    z.kind = kind; z.x = x; z.y = y; z.r = r; z.damage = damage; z.life = life; z.slot = slot; z.src = src;
    z.t = 0; z.delay = 0; z.angle = 0; z.len = 0; z.tick = 6; z.slow = 0; z.knock = 0;
    return z;
  }

  addShake(v: number): void {
    if (this.shakeEnabled) this.shake = Math.min(12, this.shake + v);
  }

  showBanner(text: string): void {
    this.banner = text;
    this.bannerT = 2.5;
  }

  // ================= zapis =================

  /** Zapis postaci do kontynuacji od poziomu `nextDepth`. */
  toSnapshot(nextDepth: number, inProgress: boolean): RunSnapshot {
    const ab = this.abilities;
    return {
      hero: this.hero.id, mode: this.mode, depth: nextDepth, inProgress,
      level: this.level, xp: this.xp, gold: this.gold, kills: this.kills, totalTime: this.totalTime, hp: this.player.hp,
      weapons: this.weapons.map((w) => [w.def.id, w.level, { ...w.bonus }]),
      passives: this.passives.map((p) => (p.evo ? [p.id, p.level, 1] : [p.id, p.level])),
      abilities: { q: ab.q.level, e: ab.e.level, dash: ab.dash.level, ult: ab.ult.level },
      cards: this.cards.map((c) => [c.id, c.stacks]),
      rerolls: this.rerolls, skips: this.skips, banishes: this.banishes, cardRerolls: this.cardRerolls,
      banished: [...this.banished], ultCharge: this.ultCharge, ultUses: this.ultUses,
      bonus: { ...this.bonus }, basicWeaponId: this.basicWeaponId,
      dmgBySource: [...this.dmgBySource.entries()], cardState: { ...this.cardState },
      equipment: { ...this.equipment }, bag: [...this.bag],
      shop: this.shop, elixirsBought: this.elixirsBought, shards: this.shards, healed: this.healed, shopLevel: this.shopLevel, anvilLevel: this.anvilLevel,
      abilityEvo: (Object.keys(ab) as AbilitySlot[]).filter((k) => ab[k].def.evolved),
      stage: inProgress ? {
        time: this.time, kills: this.levelKills, eliteT: this.eliteT, nextEvent: this.nextEvent,
        bossHpFrac: this.boss ? this.boss.hp / this.boss.maxHp : 1, nextBossAt: this.nextBossAt,
      } : undefined,
      expedition: this.expedition ? structuredClone(this.expedition) : undefined,
      dpsEma: this.dpsEma,
      augments: [...this.augments],
      resource: this.res,
      power: this.power ? [this.power.id, this.power.level] : undefined,
      pacts: { ...this.pacts },
      bossKills: this.bossKills,
      runHits: this.runHits, hitlessLevels: this.hitlessLevels, feats: [...this.featsRun],
      mats: { ...this.mats },
      scrolls: { ...this.scrolls },
      secrets: [...this.secrets],
      dpsLog: [...this.dpsLog],
      highlights: [this.bestCombo, this.bestStreak, this.maxHit, this.maxHitSrc],
    };
  }

  static fromSnapshot(s: RunSnapshot): Run {
    const run = new Run(s.hero, s.mode, s.depth, false);
    run.level = s.level;
    run.xp = s.xp;
    run.xpNext = BAL.xpToNext(s.level);
    run.gold = s.gold;
    run.kills = s.kills;
    run.totalTime = s.totalTime;
    // Wpisy, których nie ma już w danych gry (np. usunięta karta), są pomijane.
    for (const [id, lvl, bonus] of s.weapons.filter(([id]) => WEAPON_BY_ID[id])) {
      run.addWeapon(id);
      const w = run.weapons[run.weapons.length - 1];
      w.level = lvl;
      w.bonus = { ...bonus };
    }
    run.passives = s.passives.filter(([id]) => PASSIVE_BY_ID[id]).map(([id, level, evo]) => ({ id, level, evo: !!evo }));
    for (const slot of ['q', 'e', 'dash', 'ult'] as AbilitySlot[]) run.abilities[slot].level = s.abilities[slot];
    for (const slot of s.abilityEvo ?? []) if (run.abilities[slot].def.evo) run.abilities[slot].def = evolveAbility(run.abilities[slot].def);
    run.cards = s.cards.filter(([id]) => CARD_BY_ID[id]).map(([id, stacks]) => ({ id, stacks }));
    run.rerolls = s.rerolls; run.skips = s.skips; run.banishes = s.banishes; run.cardRerolls = s.cardRerolls;
    run.banished = new Set(s.banished);
    run.ultCharge = s.ultCharge; run.ultUses = s.ultUses;
    run.bonus = { ...s.bonus };
    run.basicWeaponId = s.basicWeaponId;
    run.dmgBySource = new Map(s.dmgBySource);
    run.cardState = { ...s.cardState };
    run.pacts = { ...s.pacts };
    run.mats = { ...run.mats, ...s.mats };
    run.secrets = new Set(s.secrets ?? []);
    run.dpsLog = s.dpsLog ?? [];
    if (s.highlights) [run.bestCombo, run.bestStreak, run.maxHit, run.maxHitSrc] = s.highlights;
    for (const v of run.dmgBySource.values()) run.dmgTotal += v;
    run.dpsMark = run.dmgTotal;
    run.scrolls = { ...run.scrolls, ...s.scrolls };
    run.bossKills = s.bossKills ?? 0;
    run.runHits = s.runHits ?? 0;
    run.hitlessLevels = s.hitlessLevels ?? 0;
    run.featsRun = s.feats ?? [];
    // Przedmioty nieznanych typów (np. z nowszej wersji danych) są pomijane.
    const known = (it: Item | null | undefined): it is Item => !!it && !!BASE_BY_ID[it.base];
    for (const sl of Object.keys(run.equipment) as SlotId[]) {
      const it = s.equipment?.[sl];
      run.equipment[sl] = known(it) && slotKind(sl) === BASE_BY_ID[it.base].kind ? it : null;
    }
    run.bag = (s.bag ?? []).filter(known);
    run.indexEffects();
    run.recomputeStats();
    run.player.hp = Math.min(s.hp, run.stats.maxHp);
    run.elixirsBought = s.elixirsBought ?? 0;
    run.shards = s.shards ?? 0;
    run.healed = s.healed ?? 0;
    run.shopLevel = s.shopLevel ?? 1;
    run.anvilLevel = s.anvilLevel ?? 1;
    run.expedition = s.expedition ? structuredClone(s.expedition) : null;
    run.dpsEma = s.dpsEma ?? 0;
    run.augments = (s.augments ?? []).filter((id) => AUGMENT_BY_ID[id]);
    if (s.power && BOSS_POWER_BY_ID[s.power[0]]) run.power = { id: s.power[0], level: s.power[1] };
    run.indexAugments();
    run.startLevel(s.depth);
    // Zasób: przerwany poziom wraca z zapisaną wartością, dusze zostają także między poziomami.
    if (s.inProgress || run.hero.resource.kind === 'souls') run.res = s.resource ?? 0;
    // Przerwany poziom: wznowienie od zapisanego postępu (boss, jeśli był, wraca z zapisanym HP).
    if (s.inProgress && s.stage) {
      run.time = s.stage.time;
      run.levelKills = s.stage.kills;
      run.eliteT = s.stage.eliteT;
      run.nextEvent = s.stage.nextEvent;
      run.bossHpFrac = s.stage.bossHpFrac;
      run.nextBossAt = s.stage.nextBossAt ?? BAL.endlessBossEvery;
      run.showBanner(`Wznowiono poziom ${s.depth}`);
    }
    // Sklep przed poziomem, który dopiero się zacznie (zapis między poziomami).
    if (s.shop && !s.inProgress) run.shop = { ...s.shop, items: s.shop.items.map((it) => (known(it) ? it : null)) };
    return run;
  }
}

function newEnemy(): Enemy {
  return {
    _i: -1, uid: 0, def: null!, sprite: '', x: 0, y: 0, kx: 0, ky: 0, hp: 0, maxHp: 0, speed: 0, damage: 0, radius: 4, xp: 0,
    flash: 0, slowT: 0, slowF: 0, stunT: 0, shootT: 0, shootA: 0, age: 0, dead: false, elite: null, boss: false,
    scale: 1, dr: 0, regen: 0, extraRing: false, burstLeft: 0, burstT: 0, touchCd: 0, abilT: 0,
    burnT: 0, burnDps: 0, chill: 0, shockT: 0, poisonT: 0, poisonStacks: 0, poisonUnit: 0, dotT: 0, reactT: 0, brittle: 0, hitStamp: new Int32Array(SLOT_COUNT),
    phase: 0, invuln: 0, actT: 0, dashT: 0, dvx: 0, dvy: 0, z: 0, hidden: false, tx: 0, ty: 0, nextAlt: 0, told: false, sit: 0, summons: 0, traitT: 0, buffT: 0,
  };
}

function newProjectile(): Projectile {
  return {
    _i: -1, x: 0, y: 0, vx: 0, vy: 0, life: 0, damage: 0, radius: 2, pierce: 0, hits: [], sprite: '', src: '',
    kind: 'normal', returning: false, knock: 0, forceCrit: false, t: 0, bounces: 0,
    retarget: 0, split: 0, splitEnd: 0, retMul: 1, blast: 0,
  };
}

function newBullet(): EnemyBullet {
  return { _i: -1, x: 0, y: 0, vx: 0, vy: 0, life: 0, damage: 0, radius: 2, sprite: 'eb_red', acc: 0, minV: 0, turn: 0, wave: 0, t: 0 };
}

function newZone(): Zone {
  return {
    _i: -1, kind: 'meteor', x: 0, y: 0, r: 0, angle: 0, len: 0, t: 0, life: 0, delay: 0, damage: 0, tick: 6,
    slot: 0, src: '', slow: 0, knock: 0,
  };
}

function newFx(): Fx {
  return { _i: -1, kind: 'ring', x: 0, y: 0, x2: 0, y2: 0, r: 0, a0: 0, a1: 0, life: 0, max: 0, col: 7, w: 1, sprite: '' };
}
