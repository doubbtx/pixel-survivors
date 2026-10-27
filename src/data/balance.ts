import type { Stats } from '../entities/types';

/**
 * Wszystkie wzory balansu w jednym miejscu. Czas `t` w sekundach od startu poziomu.
 * Zmieniając liczby tutaj, tuningujesz całą grę bez dotykania systemów.
 */
export const BAL = {
  // --- run ---
  /** Co ile sekund pojawia się elita. */
  eliteEvery: 55,
  maxEnemies: 1000,
  /** Zasoby wyboru przy level upie na cały run. */
  rerolls: 3,
  skips: 2,
  banishes: 2,
  weaponSlots: 6,
  passiveSlots: 6,

  // --- doświadczenie ---
  /** XP potrzebne, by z poziomu `lvl` wejść na `lvl+1`. Rośnie kwadratowo, bez sufitu. */
  xpToNext: (lvl: number) => Math.floor(5 + lvl * 5 + lvl * lvl * 0.6),

  // --- skalowanie wrogów (wykładniczo w czasie; łagodny start: obrażenia od 60% do pełnych w 1. minucie) ---
  enemyHpMul: (t: number) => Math.pow(1.38, t / 60),
  enemyDmgMul: (t: number) => Math.pow(1.2, t / 60) * Math.min(1, 0.6 + t / 150),
  /** Docelowa liczba wrogów na mapie; spawner dąży do niej. */
  targetEnemies: (t: number) => Math.min(1000, 6 + 0.75 * t + 0.004 * t * t),
  /** Odstęp elit maleje w późnej grze (czas fal) do 35% wartości bazowej. */
  eliteGap: (t: number) => Math.max(0.35, 1 - t / 700),
  /** Gęstość salw wrogów (mnożnik liczby pocisków) rośnie po 4. minucie czasu fal, do +60%. */
  patternDensity: (t: number) => 1 + Math.min(0.6, Math.max(0, (t - 240) / 600)),
  /**
   * Siła buildu: HP wrogów dopasowuje się do średniego DPS gracza (średnia krocząca `emaSec` s), tak by przeciętny wróg
   * ginął w ok. `ttk(t)` sekundy całego DPS. Tylko w górę (mnożnik ≥ 1), z wykładnikiem `exp` (łagodniej niż 1:1) i limitem `max`.
   * Obrażenia wrogów rosną z tym mnożnikiem do potęgi `dmgExp` oraz z poziomem postaci (`levelHp`, `levelDmg` na poziom).
   */
  power: {
    emaSec: 15,
    baseHp: 15,
    ttk: (t: number) => 0.06 + 0.06 * Math.exp(-t / 240),
    exp: 0.75,
    max: 60,
    dmgExp: 0.2,
    levelHp: 0.01,
    levelDmg: 0.012,
  },
  /** Maks. spawnów na sekundę (żeby fala nie pojawiała się w jednej klatce). */
  spawnRateCap: (t: number) => 4 + t * 0.15,
  eliteHpMul: 20,

  // --- głębokość kampanii (poziom 1, 2, 3...) — mnożniki wykładnicze bez sufitu ---
  depthHpMul: (depth: number) => Math.pow(1.9, depth - 1),
  depthDmgMul: (depth: number) => Math.pow(1.35, depth - 1),
  /** Obrażenia efektów kart rosną z głębokością, żeby karty nie traciły znaczenia. */
  cardPower: (depth: number) => Math.pow(1.3, depth - 1),
  /** Leczenie (ułamek maks. HP) przy przejściu na następny poziom. */
  levelClearHeal: 0.2,

  // --- przedmioty ---
  /** Skalowanie mnożnika obrażeń broni z poziomem przedmiotu (wykładniczo, bez sufitu). */
  itemScale: (ilvl: number) => Math.pow(1.3, ilvl - 1),
  /** Skalowanie HP/regeneracji z przedmiotów (nadąża za wzrostem obrażeń wrogów). */
  itemHpScale: (ilvl: number) => Math.pow(1.25, ilvl - 1),
  /** Szansa, że zwykły wróg upuści skrzynię z przedmiotem. */
  itemDropChance: 0.0008,
  bagSize: 24,

  // --- sklep między poziomami (Hardcore) ---
  /** Mnożnik cen sklepu z głębokością (jak wartość rozkładania przedmiotów — liniowo). */
  shopScale: (depth: number) => 1 + 0.5 * (depth - 1),
  shopItems: 4,
  /** Cena przedmiotu = wartość rozłożenia × narzut (rozkładanie zakupów nigdy się nie opłaca). */
  shopItemMarkup: 2.5,
  /** Szansa na lepszą jakość przedmiotów w sklepie (jak u elity, ale słabsza). */
  shopItemBoost: 1.3,
  /** Odświeżenie przedmiotów: cena bazowa, podwaja się przy każdym użyciu w tym samym sklepie. */
  shopRefresh: 10,
  /** Ceny bazowe usług (× shopScale). */
  shopPrice: { potion: 15, card: 70, reroll: 12, banish: 12, cardReroll: 25, elixir: 40 },
  /** Zapas usług w jednym sklepie. */
  shopStock: { potion: 1, card: 1, reroll: 2, banish: 1, cardReroll: 1, elixir: 1 },
  /** Eliksirów w ofercie jednego sklepu. */
  shopElixirs: 2,
  /** Rozbudowa sklepu w runie (poziom 1-max): koszt w złocie, +szczęście przedmiotów i rabat na poziom; +1 przedmiot na poziomach 3 i 5. */
  shopUpgrade: { max: 5, gold: 60, growth: 1.8, luck: 0.25, discount: 0.06 },
  /** Ulepszanie kowadła w runie: koszt, rabat na operacje, lepsze losowania bonusów (najlepszy z kilku), szansa na super-bonus. */
  anvilUpgrade: { max: 5, gold: 50, growth: 1.8, shards: 4, discount: 0.08, superBonus: 0.05 },
  /** Każdy kupiony w runie eliksir podnosi cenę kolejnych. */
  elixirPriceGrowth: 1.35,

  // --- kowadło (między poziomami) ---
  /** Złoto × BAL.shopScale(poziom przedmiotu); odłamki stałe. Jakość: koszty × (obecna jakość + 1). */
  anvil: {
    shardsByRarity: [1, 2, 4, 7, 12],
    upgrade: { gold: 20, shards: 2 },
    /** Ulepszenie: limit, przyrost każdej wartości (ułamek wartości z łupu, losowy z zakresu), wzrost ceny na ulepszenie. */
    maxUpgrades: 10,
    upgradeMin: 0.06,
    upgradeMax: 0.14,
    upgradeCostGrowth: 0.35,
    /** Rozłożenie zwraca taki ułamek złota i odłamków wydanych na przedmiot w kowadle. */
    salvageRefund: 0.25,
    reroll: { gold: 15, shards: 1 },
    /** Przekucie wszystkich bonusów naraz: suma kosztów pojedynczych × tyle. */
    rerollAllMul: 0.7,
    rarity: { gold: 50, shards: 4 },
    transfer: { gold: 30, shards: 6 },
  },

  // --- meta-progresja (data/meta.ts) ---
  meta: {
    /** Koszt kolejnego poziomu węzła = koszt bazowy × tyle^poziom. */
    costGrowth: 1.6,
    /** Esencja za run: za poziom kampanii, za sekundę (dzielnik), za zabójstwa (dzielnik), za poziom postaci. */
    essencePerDepth: 12,
    essenceSecDiv: 20,
    essenceKillDiv: 60,
    essencePerLevel: 1.5,
    /** Paragon: poziom = sqrt(cała esencja / dzielnik); każdy poziom daje tyle obrażeń i maks. HP. */
    paragonDiv: 40,
    paragonPct: 0.01,
    /** Prestiż: wymagana wydana esencja; bonus za każdy prestiż (statystyki, esencja). */
    prestigeCost: 1500,
    prestigePct: 0.05,
    prestigeEssence: 0.15,
  },
  /** Zdarzenia mapy (systems/events.ts) i Złoty szlam. */
  events: {
    shrineEvery: 55, shrineMax: 2, shrineLife: 90, shrineCharge: 2, buffTime: 20,
    swordAt: 40, swordChance: 0.4,
    portalEvery: 120, portalChance: 0.6, portalLife: 35,
    dungeonWaves: 3, dungeonWaveSize: 10, arenaR: 150,
    /** Złoty szlam: szansa przy spawnie, minimalny odstęp (s), najwyżej jeden naraz. */
    goldSlimeChance: 0.0005, goldSlimeGap: 90, goldSlimeLife: 25, goldSlimeCoins: 30,
  },
  /** Endless: boss co tyle sekund; każdy pokonany boss podnosi głębokość (trudność). */
  endlessBossEvery: 300,
  /** Premie statystyk przy awansie, gdy wszystko jest rozwinięte (stały przyrost, do wyboru jak zwykłe opcje). */
  statBoosts: [
    { stat: 'might', value: 0.04, name: 'Siła', desc: '+4% obrażeń.', icon: 'pi_might' },
    { stat: 'maxHp', value: 15, name: 'Witalność', desc: '+15 maks. HP.', icon: 'pi_heart' },
    { stat: 'atkSpeed', value: 0.03, name: 'Zręczność', desc: '+3% szybkości ataku.', icon: 'pi_fury' },
    { stat: 'armor', value: 1, name: 'Hart', desc: '+1 pancerza.', icon: 'pi_armor' },
    { stat: 'regen', value: 0.15, name: 'Odnowa', desc: '+0.15 HP na sekundę.', icon: 'pi_herb' },
    { stat: 'crit', value: 0.02, name: 'Precyzja', desc: '+2% szansy na krytyk.', icon: 'pi_crit' },
    { stat: 'area', value: 0.03, name: 'Zasięg', desc: 'Ataki i efekty 3% większe.', icon: 'pi_lens' },
    { stat: 'speedBonus', value: 0.03, name: 'Zwinność', desc: '+3% szybkości ruchu.', icon: 'pi_wings' },
    { stat: 'cdr', value: 0.02, name: 'Skupienie', desc: 'Umiejętności odnawiają się 2% szybciej.', icon: 'pi_clock' },
  ] as { stat: keyof Stats; value: number; name: string; desc: string; icon: string }[],
  /** Ekspedycja (data/expedition.ts): 3 akty map z węzłami. */
  expedition: {
    acts: 3,
    /** Rzędy mapy aktu (ostatni = boss) i kolumny. */
    rows: 6,
    lanes: 3,
    /** Szansa, że boczna kolumna rzędu jest pusta. */
    emptyChance: 0.3,
    /** Wagi typów węzłów w środkowych rzędach. */
    weights: [['fight', 40], ['elite', 16], ['treasure', 9], ['shop', 12], ['anvil', 9], ['rest', 12]] as const,
    /** Cel pełnego poziomu aktu (boss): czas przetrwania (s) albo liczba zabójstw. */
    objTime: (act: number) => 150 + 30 * act,
    objKills: (act: number) => 300 + 250 * act,
    /** Długość celu zwykłej walki i elity względem pełnego poziomu. */
    fightScale: 0.5,
    /** Przesunięcie czasu fal (s) na głębokość — bogatszy skład wrogów w dalszych węzłach. */
    waveOffsetPerDepth: 50,
    /** Elity w węźle elity pojawiają się co eliteEvery × ten mnożnik. */
    eliteEveryMul: 0.35,
    /** O ile rośnie głębokość z każdym aktem. */
    depthPerAct: 2,
    /** Złoto za walkę (× głębokość × chciwość). */
    fightGold: 20,
    /** Obóz: leczenie (ułamek maks. HP) i stały bonus maks. HP. */
    restHeal: 0.5,
    restMaxHp: 10,
    /** Kowadło: darmowe odłamki (× akt). */
    anvilShards: 3,
    /** Fortuna skarbu (lepsza jakość przedmiotu). */
    treasureLuck: 2,
    /** Mnożnik esencji za ukończoną ekspedycję. */
    winEssenceMul: 2,
  },

  // --- karty (augmenty) ---
  /** Ile kart można zbanować w kolekcji (zbanowane nie pojawiają się w ofertach). */
  cardBanSlots: 5,
  /** Wybór karty co tyle poziomów postaci. */
  cardEveryLevels: 5,
  cardRerollsStart: 1,
  /** Szansa na złotą/pryzmatyczną ofertę; rośnie z głębokością i poziomem postaci. */
  goldChance: (depth: number, lvl: number) => Math.min(0.5, 0.2 + 0.05 * (depth - 1) + 0.004 * lvl),
  prismChance: (depth: number, lvl: number) => Math.min(0.3, 0.03 + 0.03 * (depth - 1) + 0.002 * lvl),
  /** Maks. liczba eksplozji z efektów kart w jednym kroku (chroni przed reakcją łańcuchową). */
  explosionBudget: 12,
  /** Limity efektów (wydajność przy masowych wybuchach): cząsteczki na krok, efekty wybuchów na krok i odległość scalania, obłoczki śmierci. */
  fx: { particlesPerStep: 160, sparksPerStep: 12, boomsPerStep: 6, boomMerge: 24, poofCap: 140 },
  bossBaseHp: 3200,

  // --- gracz: diminishing returns tam, gdzie wartości ≥100% psułyby grę ---
  /** Pancerz → mnożnik otrzymywanych obrażeń. 25 pancerza = -50%. Nigdy 0. */
  /** Miękkie limity statystyk procentowych: powyżej progu przyrost maleje (asymptota 2 × próg). */
  softCaps: { crit: 0.6, lifesteal: 0.1, speedBonus: 0.8 } as Partial<Record<keyof Stats, number>>,
  softCap: (v: number, knee: number) => (v <= knee ? v : knee + (v - knee) / (1 + (v - knee) / knee)),
  armorMul: (armor: number) => 25 / (25 + Math.max(0, armor)),
  /** Szybkość ataku → mnożnik odstępu między atakami broni. +100% = ataki 2x częściej. */
  attackSpeedMul: (as: number) => 1 / (1 + Math.max(0, as)),
  /** Redukcja odnowienia umiejętności (cdr) → mnożnik czasu odnowienia. cdr 1.0 = -50%, nigdy 0. */
  cooldownMul: (cdr: number) => 1 / (1 + Math.max(0, cdr)),
  /** Bonus szybkości ruchu → mnożnik z asymptotą 2.5×. */
  speedMul: (bonus: number) => 1 + (1.5 * bonus) / (bonus + 1.5),
  /**
   * Gracz nie ma globalnej nietykalności po trafieniu (z nią duże leczenie dawało nieśmiertelność).
   * Zamiast tego każdy wróg może uderzyć wręcz najwyżej raz na tyle sekund; pociski trafiają zawsze.
   */
  contactCooldown: 0.7,
  /** Czas mignięcia postaci po trafieniu (tylko efekt wizualny). */
  hurtFlash: 0.12,
  /** Tarcza za zabójstwa (pasywka Borguna, karty): ułamek maks. HP za zabójstwo... */
  killShieldPerKill: 0.005,
  /** ...ale nie więcej niż tyle maks. HP na sekundę — szybkie zabijanie nie daje nieskończonej tarczy. */
  killShieldRate: 0.03,

  // --- ładowanie ultimate zabójstwami ---
  ultKillsDefault: 120,
  /** Każde użycie ultimate mnoży próg ładowania (rośnie razem z tempem zabijania). */
  ultGrowth: 1.1,

  // --- bullet hell ---
  /** Promień "rdzenia" gracza dla pocisków wrogów (mniejszy niż postać — uczciwe przeciskanie się przez luki). */
  playerBulletR: 2,
  /** Obrażenia pocisków jako ułamek obrażeń wroga: pocisków jest mało, ale każdy boli (zwykli wrogowie / boss). */
  bulletDmg: 1.1,
  bossBulletDmg: 1.1,

  // --- limity wydajnościowe ---
  gemCap: 450,
  dmgNumberCap: 70,
  particleCap: 1600,
  enemyBulletCap: 2600,
  /** Powyżej tej liczby pocisków zwykli wrogowie wstrzymują ogień (boss strzela zawsze) — czytelność. */
  enemyBulletSoftCap: 500,
  projectileCap: 2600,

  // --- dropy ---
  meatChance: 0.004,
  magnetChance: 0.0012,
  coinChance: 0.02,
} as const;
