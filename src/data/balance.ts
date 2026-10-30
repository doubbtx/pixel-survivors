import type { Stats } from '../entities/types';

/**
 * Wszystkie wzory balansu w jednym miejscu. Czas `t` w sekundach od startu poziomu.
 * Zmieniając liczby tutaj, tuningujesz całą grę bez dotykania systemów.
 */
export const BAL = {
  // --- run ---
  /** Co ile sekund pojawia się elita. */
  eliteEvery: 55,
  /**
   * Zdolność elity (systems/enemies.ts eliteAbility): co `cdMin`-`cdMax` s, z zapowiedzią `windup` s, gdy gracz jest bliżej niż `range`.
   * Elity wręcz: szarża (`chargeSpeed`) i pierścień `ring` pocisków przy lądowaniu; strzelające: na zmianę dwie serie wachlarza
   * `fan` pocisków z wyprzedzeniem ruchu gracza i pierścień z luką (`gapRing`).
   */
  eliteAbility: { cdMin: 2.2, cdMax: 3.2, windup: 0.5, range: 200, chargeSpeed: 210, ring: 12, fan: 6, gapRing: 18 },
  maxEnemies: 1000,
  /** Zasoby wyboru przy level upie na cały run. */
  rerolls: 3,
  skips: 2,
  banishes: 2,
  weaponSlots: 6,
  /**
   * Jakość ulepszeń broni przy awansie (data/upgrades.ts): wagi jakości 0-4 (Zwykłe..Legendarne), Szczęście mnoży wagę
   * jakości q przez (1 + szczęście × luckMul × q); wartości bonusów dla jakości 0-4; +1 pocisk od jakości amountFrom.
   */
  weaponQuality: {
    weights: [62, 24, 9, 4, 1],
    luckMul: 1.5,
    amountFrom: 3,
    values: {
      dmg: [0, 0.06, 0.1, 0.16, 0.25],
      atk: [0, 0.05, 0.08, 0.12, 0.18],
      area: [0, 0.06, 0.1, 0.15, 0.22],
      proj: [0, 0.08, 0.12, 0.18, 0.25],
      amount: [0, 0, 0, 1, 1],
      crit: [0, 0.02, 0.03, 0.05, 0.08],
      elem: [0, 0.08, 0.12, 0.2, 0.3],
    },
  },
  /** Sługi (systems/minions.ts): limit naraz, szybkość, zasięg szukania celu, odstęp ciosów, promień zwarcia, odległość od gracza bez celu. */
  minions: { cap: 40, speed: 85, range: 180, hitEvery: 0.5, radius: 6, bigRadius: 10, follow: 26, passiveDmg: 12, passiveLife: 8, harvestChance: 0.1 },
  /**
   * Zasoby bohaterów (systems/resource.ts). Karty: res.gain (+przyrost), res.power (+siła efektu), res.max (+pojemność).
   * focus: trafienie wroga dalej niż `range` daje 1 (najwyżej co `gap` s); +`crit` krytyka za punkt; pełna = darmowa Salwa i zostaje `keep`;
   *        oberwanie zabiera ułamek `hurtLoss`.
   * fury: cios we wroga bliżej niż `meleeR` daje `hit` (co `gap` s), oberwanie `hurt` × ułamek maks. HP × 100, zabójstwo w pobliżu `kill`;
   *       w trakcie budowania do +`might` obrażeń i -`dr` otrzymanych; po `idle` s bez walki opada o `decay`/s.
   *       Pełna furia = Szał na `rage` s (sekret Berserk: × `rageHold`): +`rageMight` obrażeń, +`rageAtk` szybkości ataku,
   *       leczenie `rageLeech` zadanych obrażeń, -`dr` otrzymanych; pasek odlicza czas Szału i spada do zera.
   * heat: Q/E dają `cast`; czary zadają do +`spell` obrażeń; powyżej `burnFrom` tracisz `burn` maks. HP/s (nie zabija); opada `decay`/s;
   *       unik od `ventMin` zrzuca żar: wybuch (promień `ventR`, obrażenia kart `vent` × żar) i płonąca ziemia.
   * souls: zabity wróg bliżej niż `range` daje 1; pełne: sługa za `auto` dusz; R zużywa wszystkie: +`ultDmg` obrażeń sług za duszę,
   *        +1 sługa za każde `ultExtra` dusz.
   */
  /** Tryb łatwy (Ustawienia): o tyle mniej obrażeń i HP wrogów. */
  easy: { dmg: 0.4, hp: 0.25 },
  /**
   * Sekretny biom Pustka w Endless (Run.levelFor): po pełnym cyklu biomów, gdy Pakt ma co najmniej `voidPact`
   * albo run trwa co najmniej `voidEndlessTime` s. W Ekspedycji Pustkę otwiera Klucz Pustki (akt 4).
   */
  voidPact: 5,
  voidEndlessTime: 1200,
  /** Muzyka (core/music.ts): tylu wrogów naraz daje pełną intensywność walki (bez bossa). */
  musicCrowd: 140,
  /**
   * Wyczyny (data/feats.ts): Spokój (s bez trafienia), minimalny czas poziomu dla wyczynów poziomowych, Spartanin (maks. poziom postaci),
   * Mistrz kombo (zabójstwa), Łowca elit (elity na poziomie), szybki boss (s), próg HP „Na krawędzi”,
   * Rzeź (zabójstwa w oknie s), passa Nietykalnego (+obrażenia), nagrody: odłamki, losowania kart, złoto (× głębokość).
   */
  feats: { calmAfter: 10, minTime: 60, spartanLevel: 10, combo: 300, elites: 5, speedBoss: 30, edgeHp: 0.15, massacreKills: 250, massacreWindow: 30, streakMight: 0.08, shards: 4, rerolls: 2, gold: 40 },
  /** Odstęp pomiaru DPS do wykresu na ekranie końca (s). */
  dpsEvery: 5,
  /** Bestiariusz (data/bestiary.ts): bonus obrażeń przeciw wrogowi po progach `master` i `legend` zabójstw. */
  bestiary: { master: 0.05, legend: 0.1 },
  resource: {
    focus: { max: 40, range: 70, gap: 0.15, crit: 0.005, keep: 0.25, hurtLoss: 0.5 },
    fury: { max: 100, meleeR: 52, hit: 1, gap: 0.12, hurt: 1.5, kill: 1, might: 0.15, dr: 0.2, idle: 3, decay: 15, rage: 6, rageHold: 1.5, rageMight: 0.4, rageAtk: 0.3, rageLeech: 0.03 },
    heat: { max: 100, cast: 20, spell: 0.6, burnFrom: 75, burn: 0.03, decay: 3, ventMin: 40, ventR: 50, vent: 0.7 },
    souls: { max: 30, range: 150, auto: 10, ultDmg: 0.03, ultExtra: 10 },
    /** Kombo (Vesper): +1 za trafienie co `gap` s; obrażenia do +might przy pełnym; Egzekucja +exec za punkt; Taniec ostrzy tnie co danceEvery kroków. */
    streak: { max: 40, gap: 0.08, might: 0.5, exec: 0.04, danceEvery: 6 },
    /**
     * Wiara (Aurel): zabójstwa w `range` (+1, elita 3, boss 10), leczenie +heal za każdy 1% maks. HP. Pełna: Łaska (leczenie i tarcza
     * jako ułamek HP) i zużycie `grace`. Sąd: +judgDmg obrażeń za punkt, +1 cel za judgExtra punktów, Sąd ostateczny zostawia `keep`.
     * Strażnicy leczą `guardHeal` maks. HP trafieniem; Opiekun: tarcza shieldPer za sługę (do shieldCap).
     */
    /**
     * Rytm (Takezo, 0.34.2): +1 za trafienie co `gap` s (odbicie: BAL.resource.parry.rhythm), +atk szybkości ataku za punkt w trakcie budowania;
     * oberwanie zabiera hurtLoss. Pełny: Przepływ na `flow` s (+flowAtk szybkości ataku, +flowDmg obrażeń, Tysiąc cięć
     * odnowiony), pasek opada do zera, potem budowanie od nowa. Iai: poza Przepływem +iai obrażeń za punkt (zużywa Rytm),
     * w Przepływie ×flowIai i Przepływ trwa dalej.
     */
    rhythm: { max: 40, gap: 0.04, hit: 1.5, drain: 16, atk: 0.0075, iai: 0.02, flow: 5, flowAtk: 0.6, flowDmg: 0.2, flowIai: 2 },
    /** Mikiri (pasywka Takezo): szansa na odbicie base + perLevel × (poziom − 1), najwyżej max (razem z flagą passive.parry); po odbiciu iframes s nietykalności (tylko to trafienie); kontra wokół (riposteR), +rhythm rytmu, odbity pocisk: reflect × obrażenia kart. */
    parry: { base: 0.05, perLevel: 0.006, max: 0.35, riposteR: 26, rhythm: 6, reflect: 1.5, iframes: 0.1 },
    faith: { max: 100, range: 150, heal: 0.5, graceHeal: 0.15, graceShield: 0.1, grace: 60, judgDmg: 0.01, judgExtra: 10, keep: 0.3, guardHeal: 0.004, shieldPer: 0.03, shieldCap: 0.18 },
  },
  /**
   * Zadania w trakcie poziomu (data/tasks.ts, systems/tasks.ts): pierwsze po `first` s, kolejne co `every` s; kamień czeka `acceptLife` s
   * w odległości placeMin-placeMax. Łowy: elita w odległości `huntDist` od kamienia. Totem: promień, utrata HP (% na s za wroga, liczonych najwyżej `totemMax`),
   * utrata HP, gdy gracz jest dalej niż `totemGuard`.
   * Krąg: promień. Złoto za zadanie × głębokość. Karna fala: zwykli wrogowie i elity.
   */
  tasks: { first: 40, every: 60, acceptLife: 25, placeMin: 90, placeMax: 150, huntDist: 60, totemR: 40, totemKillR: 70, totemDrain: 1.5, totemMax: 5, totemGuard: 70, totemAlone: 4, circleR: 32, gold: 25, ore: 1, failWave: 16, failElites: 2 },
  /** Poziom broni, od którego przy awansie pojawiają się jej augmenty (data/augments.ts). */
  augmentMinLevel: 3,
  passiveSlots: 6,

  // --- doświadczenie ---
  /** XP potrzebne, by z poziomu `lvl` wejść na `lvl+1`. Rośnie kwadratowo, bez sufitu. */
  xpToNext: (lvl: number) => Math.floor(5 + lvl * 5 + lvl * lvl * 0.6),

  // --- skalowanie wrogów (wykładniczo w czasie; łagodny start: obrażenia od 60% do pełnych w 1. minucie) ---
  enemyHpMul: (t: number) => Math.pow(1.38, t / 60),
  enemyDmgMul: (t: number) => Math.pow(1.22, t / 60) * Math.min(1, 0.45 + t / 300),
  /** Docelowa liczba wrogów na mapie; spawner dąży do niej. */
  targetEnemies: (t: number) => Math.min(1000, 6 + 0.75 * t + 0.004 * t * t),
  /** Odstęp elit maleje w późnej grze (czas fal) do 35% wartości bazowej. */
  eliteGap: (t: number) => Math.max(0.35, 1 - t / 700),
  /** Gęstość salw wrogów (mnożnik liczby pocisków) rośnie po 4. minucie czasu fal, do +60%. */
  patternDensity: (t: number) => 1 + Math.min(0.6, Math.max(0, (t - 240) / 600)),
  /**
   * Siła buildu (0.35.2): HP wrogów = baza × `floor(poziom postaci)` × pogoń. Podłoga to oczekiwana siła na danym poziomie
   * (dopasowana do telemetrii bez sufitu: log(siły) koreluje z poziomem 0.82, z głębokością 0.66), pogoń dopasowuje się
   * do średniego DPS (średnia krocząca `emaSec` s, tylko obrażenia zadane, bez nadwyżki ponad HP wroga), tak by przeciętny
   * wróg ginął w ok. `ttk(t)` s — ale łagodnie: pierwiastek (`chaseExp`), w granicach `chaseMin`-`chaseMax`. Build 4× ponad
   * podłogę zabija 2× szybciej (dawniej 1.3×), najsłabsze buildy dostają do 55% litości. Całość ≥ 1 i ≤ `max` (jak dawniej).
   * Obrażenia wrogów NIE zależą od siły buildu (0.35.1): krzywa `dmg(głębokość, czas na tej głębokości)` zastąpiła
   * `powerMul^0.45`. Dopasowana do 35. percentyla dawnego mnożnika z telemetrii bota (21 runów Endless, 14 Ekspedycji):
   * ×2 na głębokość, w obrębie głębokości rośnie z czasem (najwyżej ×2; na pierwszej głębokości wolniej i najwyżej ×1.6
   * — nowi gracze i słabe buildy), sufit jak dawniej 60^0.45 ≈ 6.3. Wobec dawnego wzoru (ta sama próbka): Endless mediana
   * ×0.84, P90 ×1.6; Ekspedycja mediana ×1.0, P90 ×1.11.
   * Dodatkowo poziom postaci (`levelHp`, `levelDmg` na poziom).
   */
  power: {
    emaSec: 15,
    baseHp: 15,
    ttk: (t: number) => 0.06 + 0.06 * Math.exp(-t / 240),
    floor: (level: number) => Math.pow(1.06, Math.max(0, level - 12)),
    chaseExp: 0.5,
    chaseMin: 0.45,
    // 0.60: sufit 300 / pogoń 8 → 1000 / 12 — od aktu 3 mnożnik stał na suficie przy DPS 50-100× wyższym, wrogowie
    // ginęli na pierścieniu pojawiania (poza kadrem), a akty 3-4 były łatwiejsze niż akt 2.
    chaseMax: 12,
    max: 1000,
    dmg: (depth: number, t: number) => Math.min(6.3, Math.pow(2, depth - 1) * (depth <= 1 ? Math.min(1.6, 1 + t / 300) : Math.min(2, 1 + t / 120))),
    levelHp: 0.01,
    levelDmg: 0.012,
  },
  /**
   * Sytuacje (systems/situations.ts, 0.39): pierwsza po `first` s czasu poziomu, potem co `every` s (po `lateAfter` s czasu fal
   * co `everyLate`), zapowiedź `warn` s, odłożenie o `eventGap` s przy pierścieniu EVENTS, nierozbita wygasa po `expire` s;
   * nagroda za rozbicie: monety, Rytuał: skrzynia elity, gdy obaj przywoływacze zginą w `ritualWindow` s.
   */
  situations: { first: 30, every: [75, 100] as [number, number], everyLate: [60, 80] as [number, number], lateAfter: 600, warn: 2, eventGap: 20, expire: 60, coins: 8, ritualWindow: 20 },
  /** Czytelność (0.40): tryb 'auto' ataków gracza — przygaszenie przy ≥ `on` pociskach wrogów w promieniu, koniec przy ≤ `off`. */
  readability: { radius: 110, on: 20, off: 12, ema: 0.3, alpha: 0.55, flashCrowd: 500 },
  /** 0.47 (gracz: „biorę bronie dystansowe i samo się wygrywa”; pomiar: wręcz ≈ 30% zabójstw pocisków naprowadzanych).
   * Mnożniki obrażeń/obszaru broni wg wzorca (z ewolucjami) i wg id (prefiks), plus bonus za trafienia z bliska. */
  weaponTune: {
    kind: { aura: { dmg: 1.5, area: 1.3 }, orbit: { dmg: 1.5, area: 1.3 }, cleave: { dmg: 1.35, area: 1.1 }, lash: { dmg: 1.45, area: 1.15 }, nova: { dmg: 1.2, area: 1.1 }, mines: { dmg: 1.25 } } as Record<string, { dmg: number; area?: number }>,
    id: { chain: 0.85 } as Record<string, number>,
  },
  close: { r: 50, bonus: 0.2 },
  /** 0.49 (runda 2, Agent 2): strzelcy bliżej (keepDist ×0.75) i po salwie naciskają o `step` px przez `t` s (gdy bliżej niż
   * `near` × keepDist). Trans bitewny: przy ≥ `min` wrogach w pierścieniu bliskiego dystansu −`taken` obrażeń, zabójstwo z bliska
   * leczy `killHeal` maks. HP (wspólny budżet drainHeal). */
  press: { keepMul: 0.75, step: 30, t: 1.5, near: 1.5 },
  /** Automatyczny ekwipunek po łupie: zamiana przy przewadze oceny o `margin` i `perUpg` pkt za każde ulepszenie założonego. */
  /** Scenariusze map (0.56): bezpieczniki rytmu, oddech, gęstość zwykłych fal w trakcie uderzenia, czas „trwania” uderzenia. */
  scripts: { first: 20, gap: 12, last: 0.9, breath: 5, beatDensity: 0.85, beatDur: 10, tierSize: 0.1, size: 1.3 },
  /**
   * `melee`: profil wag oceny (itemScore) dla buildu z przewagą broni bliskiego zasięgu (`kinds`); reszta wag bez zmian.
   * Ilość (`amount`) zostaje przy domyślnej wadze: orbita, fala, smagnięcie i cięcie rosną z nią liniowo (systems/weapons.ts).
   */
  autoEquip: {
    margin: 0.08, perUpg: 0.5,
    melee: { kinds: ['aura', 'orbit', 'cleave', 'lash', 'nova'] as string[], w: { area: 1.4, duration: 0.9 } as Partial<Record<keyof Stats, number>> },
  },
  /** Odrodzenie (Feniks i inne): nietykalność (s) i promień, w którym zwykli wrogowie giną, a pociski znikają. */
  revive: { iframes: 3, r: 130 },
  /** Limit pojedynczego trafienia gracza jako ułamek maks. HP (0.59): `base`, +`perTorment` na poziom Udręki, do `max`. */
  hitCap: { base: 0.4, perTorment: 0.04, max: 0.8 },
  trance: { min: 3, taken: 0.15, killHeal: 0.002 },
  /** Zasięg wyboru celu broni naprowadzanych (było 200 / 170): strzelają do wrogów bliżej, nie z drugiego końca ekranu. */
  homing: { bolt: 160, chain: 130 },
  /**
   * Boss słabnie (0.40): po `after` s walki otrzymuje coraz więcej obrażeń, do ×(1 + `max`) po kolejnych `ramp` s
   * (długie walki słabych buildów; bossowie aktów i Endless, bez Króla z kurhanu, strażników i minibossów).
   */
  bossSoften: { after: 90, ramp: 60, max: 1 },
  /**
   * Cechy zachowania elit (R3, 0.41): od `from` s czasu fal. Dowódca: aura `auraR`, wzmocnienie co `stamp` s na `buffT` s
   * (+`speed`, +`dmg`). Rozszczepiacz: `kids` kopii z HP × `kidHp` zwykłego wroga. Sztandar: co `bannerEvery` s strefa `bannerR`
   * na `bannerLife` s (leczenie wrogów `bannerRegen`/s maks. HP, gracz +`bannerTaken` obrażeń). Cień: co `phaseEvery` s
   * znika na `phaseTime` s i pojawia się do `phaseStep` px bliżej gracza.
   */
  eliteTraits: { from: 150, auraR: 70, stamp: 0.25, buffT: 0.35, speed: 0.25, dmg: 0.25, kids: 3, kidHp: 1.5, bannerEvery: 8, bannerR: 50, bannerLife: 6, bannerRegen: 0.03, bannerTaken: 0.2, phaseEvery: 4, phaseTime: 1, phaseStep: 40 },
  /** Relikwie (data/relics.ts, R2): limit, wartości efektów i wad. */
  /** Bronie 0.43: Kości (szansa szóstki: baza + Szczęście × sixLuck, maks. sixMax) i budżet leczenia Sierpa krwi (ułamek maks. HP na sekundę). */
  dice: { six: 1 / 6, sixLuck: 1 / 8, sixMax: 0.5, low: 0.5, high: 1.6, blast: 0.5, blastR: 20, coinEvery: 1 },
  drainPerSec: 0.015,
  /**
   * Odkrycia (0.61, data/unlocks.ts grantDiscovery): punkty za koniec runu (`run`), każdy ukończony akt Ekspedycji
   * (`act`) i co `endlessMin` minut Endless; co `every` punktów otwiera się najbliższa zablokowana zawartość.
   * Od startu otwarte: `goldPerTag` pierwszych złotych kart każdego tagu i `prism` pierwszych pryzmatycznych (data/cards.ts `cardLock`).
   */
  discovery: {
    run: 1, act: 1, endlessMin: 5, every: 3, goldPerTag: 2, prism: 5,
    /** Progi warunków „w jednym runie” (data/unlocks.ts CONTENT); próg synergii = jej poziom (1 = 3 punkty, 2 = 6). */
    goals: { magnet: 25, laser: 40, reactions: 250, crits: 3000, heal: 2500, kills: 3000, synTier: 2, minesMin: 10 },
  },
  /** Kradzież życia (0.60): osobny budżet, ułamek maks. HP na sekundę; wcześniej 2% za każde trafienie = kilka pasków HP na s. */
  lifestealPerSec: 0.04,
  /** Piętno Aurela (0.43): leczenie za trafienie napiętnowanego (ułamek maks. HP, w budżecie drainPerSec; do Wiary liczy się `faith` leczenia), maks. czas, przedłużanie w Uświęconej ziemi (s/s), tarcza Opiekuna za napiętnowanego w `guardR`, wybuch Włóczni świtu. */
  brand: { heal: 0.004, faith: 0.5, max: 12, shieldCap: 0.1, sanct: 1.5, guardR: 120, shieldPer: 0.02, boom: 0.6, boomR: 24, speed: 260, life: 0.6, width: 9 },
  relics: { max: 3, offer: 3, prismWeak: 2.25, prismResist: 0.25, huntElite: 0.4, huntRegular: 0.1, cloakTime: 1, cloakCd: 8, cloakHp: 0.75, maceTime: 6, maceDmgLoss: 0.15, turncoatHp: 1.5, turncoatAura: 0.5, hornWindow: 15, chaliceHeal: 0.15, bossDmg: 1.25, shopMarkup: 1.25 },
  /** Odstęp próbek telemetrii runu (s). */
  telemetryEvery: 15,
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
  /**
   * Teren (systems/terrain.ts): kawałek świata `chunk` px, skład kawałka wg biomu [osłony, beczki, kolce, bagna, lody]
   * (łąka, bagno, pustkowie, otchłań); wolne miejsce przy starcie poziomu i przy graczu. Osłona: promień, HP (trafienia),
   * obrażenia od wybuchu. Beczka: promień, zasięg wybuchu, obrażenia kart. Kolce: promień, cykl i czas wysunięcia (s),
   * obrażenia kart, utrata HP gracza (ułamek maks. HP na tick). Bagno: spowolnienie; lód: przyczepność (wyżej = mniej poślizgu).
   * Arena bossa: promień startowy, końcowy i czas zwężania (s).
   */
  terrain: {
    chunk: 320,
    biomes: [[3, 1, 1, 0, 0], [1, 1, 1, 2, 0], [1, 3, 2, 0, 0], [2, 1, 0, 0, 2], [1, 0, 3, 0, 2]] as const,
    clearStart: 90, clearPlayer: 70,
    coverR: 11, coverHp: 20, blastDmg: 6,
    barrelR: 6, barrelBlast: 42, barrelDmg: 45,
    spikesR: 12, spikeCycle: 2.2, spikeUp: 0.6, spikeDmg: 14, spikeHurt: 0.04,
    poolR: [32, 48] as const, swampSlow: 0.4, iceGrip: 2.5,
    arenaR: 260, arenaMin: 150, arenaTime: 45,
  },
  /**
   * Sekrety map (systems/mapsecrets.ts): odstęp losowania sekretu (s) i wagi rodzajów, czas życia obiektów; fontanna (postój s,
   * koszt × głębokość, użycia), runy (odstęp kamieni, moc, zasadzka), grzyby (liczba, odurzenie s), mimik (szansa zwykłej skrzyni),
   * klucz kurhanu (szansa z elity), Król (mnożnik HP), skarbiec (fale, szansa na unikat), pęknięta ściana (szansa na kawałek terenu).
   */
  secretsMap: {
    every: 70, life: 90,
    weights: [['fountain', 3], ['runes', 2.5], ['mushrooms', 2.5], ['stag', 2]] as const,
    fountainStand: 1.2, fountainCost: 20, fountainUses: 3,
    runeR: 45, runeMight: 0.2, runeSpeed: 0.15, ambush: 10,
    mushrooms: 4, confused: 5,
    mimicChance: 0.25, keyChance: 0.1, kingHp: 1.3, vaultWaves: 2, vaultUnique: 0.5, wallChance: 0.12,
    /** Minibossowie lochów (Strażnik skarbca, Strażnik lochu): odstęp ataków (losowy min-max s), spirala co `spin` s; w szale (< połowy HP) odstępy × `rageMul`, szansa na drugi atak naraz; dalej niż `catchUp` od gracza goni go × `catchUpMul`. */
    warden: { actMin: 1.1, actMax: 1.8, spin: 0.6, rageSpin: 0.42, rageMul: 0.7, rageDouble: 0.35, catchUp: 100, catchUpMul: 2 },
  },
  /**
   * Wydarzenia poziomu (systems/levelevents.ts): co `every` s szansa `chance` na wydarzenie trwające `duration` s.
   * Złota godzina: mnożnik szansy monet. Burza: piorun co stormEvery s, zapowiedź stormWarn s, promień, obrażenia kart,
   * utrata HP gracza (ułamek maks. HP).
   */
  levelEvents: { every: 150, chance: 0.7, duration: 30, goldRain: 9, stormEvery: 0.7, stormWarn: 0.8, stormR: 26, stormDmg: 30, stormHurt: 0.08 },
  /** Kombo: zabójstwa bez oberwania; co `announce` napis, złoto × (1 + kombo × per), najwyżej +maxBonus. */
  combo: { announce: 50, per: 0.002, maxBonus: 1 },
  /**
   * Nowi wrogowie (systems/enemies.ts): obrót tarczy (rad/s) i jej kąt ochrony; kamikaze (dystans zapalenia, lont s, promień,
   * mnożnik obrażeń wybuchu); skoczek (odstęp teleportu, odległość od gracza); przywoływacz (odstęp, liczba nietoperzy);
   * pajęczarz (odstęp sieci, promień, czas, spowolnienie gracza).
   */
  newEnemies: {
    shieldTurn: 1.4, shieldArc: 1.1, kamikazeFuseAt: 22, kamikazeFuse: 0.6, kamikazeR: 32, kamikazeDmg: 2.5,
    blinkEvery: 3.5, blinkMin: 45, blinkMax: 75, summonEvery: 6, summonCount: 3, summonCap: 12, webEvery: 5, webR: 26, webLife: 5, webSlow: 0.5,
  },
  /**
   * Wrogowie biomów (data/enemies.ts, systems/enemies.ts): Dzik (odstęp szarży, zapowiedź s, prędkość, czas pędu), Cierniak
   * (odstęp, liczba kręgów, rozrzut, czas do uderzenia, mnożnik obrażeń), Ropucha (odstęp skoku, czas lotu, wysokość,
   * zasięg, pierścień), Topielec (pod ziemią s, na powierzchni s, zapowiedź s, promień ugryzienia), Salamandra (zasięg, zapowiedź,
   * liczba płomieni, stożek rad), Skorpion (odstęp, celowanie s, prędkość kolca), Rozszczepieniec (dzieci), Odbicie (odstęp,
   * zapowiedź, prędkość, czas pędu).
   */
  biomeEnemies: {
    chargeEvery: 3.2, chargeWarn: 0.75, chargeSpeed: 175, chargeTime: 0.55,
    /** Minibossowie biomów: w Endless pierwszy po `first` s, potem co `every` s; w Ekspedycji na mapie elit przy połowie celu. */
    miniFirst: 150, miniEvery: 240, miniAt: 0.5, miniLeapH: 22,
    mortarEvery: 3.4, mortarCount: 3, mortarSpread: 40, mortarDelay: 1.1, mortarDmg: 1.6, mortarR: 11,
    leapEvery: 2.2, leapTime: 0.6, leapHeight: 12, leapRange: 70, leapRing: 8,
    burrowUnder: 2.6, burrowUp: 2.5, burrowWarn: 0.7, burrowR: 20,
    flameRange: 55, flameWarn: 0.6, flameCount: 7, flameCone: 0.55, flameEvery: 3,
    snipeEvery: 3.6, snipeAim: 0.85, snipeSpeed: 230,
    splitKids: 2,
    orbitEvery: 3.4, orbitWarn: 0.65, orbitSpeed: 240, orbitTime: 0.55,
  },
  /** Pakty ryzyka (data/pacts.ts): esencja × (1 + essencePer × poziom Paktu). */
  pacts: { essencePer: 0.08 },
  /**
   * Kuźnia runiczna (data/forge.ts, systems/forge.ts): litość za porażkę (+szansa), zwój smoka, bonus trybu ryzyka,
   * pęknięcie (mnożnik wartości), naprawa (złoto x koszt ulepszenia, Ruda gwiezdna), progi +6 i +15.
   * Dropy materiałów: szansa zwykłego wroga na kamień, rozkładanie (kamienie za rzadkość), elita (ruda), boss (serca,
   * łzy od depthTear, iskry od depthVoid — rzadko, główna droga to warsztat), zwoje z elit i bossów, materiały za zadanie i loch.
   * Warsztat (CRAFTS): +szansa za poziom kowadła, ułamek składników traconych przy porażce.
   */
  forge: {
    pity: 0.05, dragon: 0.15, risk: 0.1, crackMul: 0.7, repairMul: 2, glowMul: 1.2, divineMul: 1.25,
    stoneChance: 0.004, salvageStones: [0, 1, 1, 2, 3], eliteOre: [1, 2], bossHeart: [1, 2],
    tearChance: 0.15, depthTear: 3, voidChance: 0.08, depthVoid: 5, pactVoid: 10,
    craftPerAnvil: 0.05, craftLoss: 0.5,
    scrollElite: 0.06, scrollBoss: 0.6, dungeonOre: 2, slimeHeart: 1, anvilStones: 2, anvilOre: 1,
  },
  /** Moce bossów (systems/powers.ts): maks. poziom i przyrost obrażeń za poziom. */
  bossPowers: { maxLevel: 3, perLevel: 0.5 },
  /** Szansa, że łup bossa / elity (także skrzynia elity) to unikat (× (1 + Fortuna)). */
  uniques: { boss: 0.08, elite: 0.02 },
  /** Szansa, że zwykły wróg upuści skrzynię z przedmiotem. */
  itemDropChance: 0.0008,
  /** Szczęście zwiększa szansę na skrzynię ze zwykłego wroga: × (1 + szczęście × luckDrop). */
  luckDrop: 1,
  /** Szczęście a karty: +szczęście × gold do szansy na złote, szansa na pryzmatyczne × (1 + szczęście × prism). */
  luckCards: { gold: 0.3, prism: 1 },
  bagSize: 24,

  // --- sklep (węzły sklepu Ekspedycji) ---
  /** Mnożnik cen sklepu z głębokością (jak wartość rozkładania przedmiotów — liniowo). */
  shopScale: (depth: number) => 1 + 0.5 * (depth - 1),
  shopItems: 4,
  /** Cena przedmiotu = wartość rozłożenia × narzut (rozkładanie zakupów nigdy się nie opłaca). */
  shopItemMarkup: 2.5,
  /** Szansa na lepszą jakość przedmiotów w sklepie (jak u elity, ale słabsza). */
  shopItemBoost: 1.15,
  /**
   * Jakość łupu (data/items.ts rollRarity): waga rzadkości i rośnie jak boost^i, boost = (1 + `depth` × (głębokość - 1))
   * × (1 + `luck` × szczęście) × źródło (`boss`, `elite`). Boss nie daje Zwykłych.
   * Szczęśliwy traf: każdy łup (także zwykła skrzynia) z szansą `jackpot` × (1 + Fortuna) to Legendarny przedmiot,
   * a z tego ułamek `jackpotUnique` to unikat — runy, w których los sprzyja, mają być wyraźnie mocniejsze.
   */
  loot: { depth: 0.1, luck: 0.5, boss: 1.8, elite: 1.3, jackpot: 0.03, jackpotUnique: 0.35 },
  /** Odświeżenie przedmiotów: cena bazowa, podwaja się przy każdym użyciu w tym samym sklepie. */
  shopRefresh: 10,
  /** Ceny bazowe usług (× shopScale). */
  shopPrice: { potion: 15, card: 70, reroll: 12, banish: 12, cardReroll: 25, elixir: 40, stone: 10, ore: 30, bless: 60, dragon: 50 },
  /** Zapas usług w jednym sklepie. */
  shopStock: { potion: 1, card: 1, reroll: 2, banish: 1, cardReroll: 1, elixir: 1, stone: 3, ore: 2, bless: 1, dragon: 1 },
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
    maxUpgrades: 15,
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
    costGrowth: 1.8,
    /** Następny węzeł gałęzi odblokowuje się, gdy poprzedni ma co najmniej taką część swoich poziomów (w górę). */
    unlockFrac: 0.5,
    /** Esencja za run: za poziom kampanii, za sekundę (dzielnik), za zabójstwa (dzielnik), za poziom postaci. */
    essencePerDepth: 12,
    essenceSecDiv: 20,
    essenceKillDiv: 60,
    essencePerLevel: 1.5,
    /** Esencja za każdą ukończoną mapę Ekspedycji. */
    essencePerMap: 8,
    /** Endless: esencja z tego samego wzoru (głębia, czas, zabójstwa, poziom postaci) × tyle — mniej niż Ekspedycja. */
    endlessEssenceMul: 0.6,
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
  /**
   * Reakcje żywiołów (dwa stany naraz na wrogu, game/run.ts react): odnowienie na wrogu (s) i parametry.
   * Obrażenia liczone od trafienia wywołującego reakcję (× mnożnik × (1 + flaga reactPower)).
   */
  /**
   * Wierność broni: od poziomu `first` co `every` poziomów, z wciąż jedną bronią (startowa albo jej ewolucja), stopień
   * rośnie o 1, bez limitu. Za stopień: obrażenia tej broni × (1 + dmg) (mnożnikowo), szybkość ataku + atkSpeed,
   * obszar + area, pocisk co `amountEvery` stopni (pierwszy od razu); od 1. stopnia ewolucja bez pasywki.
   * Działa, dopóki broń jest jedna. Dobrane symulacją (jedna broń vs pełny zestaw w Endless).
   */
  loyal: { first: 10, every: 5, dmg: 0.35, atkSpeed: 0.08, area: 0.1, amountEvery: 2 },
  /**
   * Szarża Borguna: uderzenie na końcu × (1 + perHit za staranowanego wroga, maks. maxBonus), Furia za wroga,
   * każde zabójstwo szarżą skraca odnowienie o `refund` (maks. refundMax).
   */
  charge: { impactMul: 1.2, perHit: 0.12, maxBonus: 1.5, fury: 2, refund: 0.1, refundMax: 0.5 },
  /**
   * Odporność bossa na żywioł swojego biomu (indeks = biom: łąka, bagno, pustkowie, otchłań, pustka):
   * stan tego żywiołu się nie nakłada, a obrażenia od niego × mul.
   */
  bossResist: { mul: 0.5, biome: ['lightning', 'poison', 'fire', 'ice', null] as const },
  reactions: {
    cd: 0.6,
    /** Ogień + Lód: ogłuszenie i obrażenia; zużywa oba stany. */
    steam: { mul: 1.2, stun: 1 },
    /** Błyskawica + Lód: następne trafienie × mul; zużywa lód. */
    shatter: { mul: 2 },
    /** Ogień + Trucizna: wybuch (promień) za wszystkie warstwy trucizny × mul (za sekundę trucizny); zużywa truciznę. */
    toxic: { r: 30, mul: 3 },
    /** Błyskawica + Trucizna: trucizna przeskakuje na `n` wrogów w promieniu. */
    conduct: { r: 55, n: 3 },
    /** Ogień + Błyskawica: mały wybuch z odrzutem; zużywa porażenie. */
    overload: { r: 22, mul: 0.8, knock: 6 },
  },
  /** Ekspedycja (data/expedition.ts): 3 akty map z węzłami. */
  expedition: {
    acts: 3,
    /** Rzędy mapy aktu (ostatni = boss) i kolumny. */
    rows: 7,
    lanes: 4,
    /** Szansa, że boczna kolumna rzędu jest pusta. */
    emptyChance: 0.3,
    /** Wagi typów węzłów w środkowych rzędach. */
    weights: [['fight', 34], ['elite', 12], ['dungeon', 6], ['treasure', 7], ['shop', 10], ['anvil', 8], ['rest', 9], ['shrine', 8], ['ambush', 5], ['hunt', 5], ['vault', 3]] as const,
    /** Węzły-wydarzenia (0.37): Zasadzka — krótsza mapa (× czasu walki), pierścień co `ambushEvery` s (wrogów: ambushRing + ambushGrow × numer),
     *  elity od pierścienia ambushEliteFrom; Polowanie — limit czasu (s), HP minibossa ×, mniej zwykłych wrogów, eskorta elit;
     *  areny (loch, skarbiec) — × nagrody modyfikatorów; Mapa elit — skrzynia co N-ta elita. */
    ambushScale: 0.5,
    ambushEvery: 15,
    ambushRing: 18,
    ambushGrow: 6,
    ambushEliteFrom: 4,
    huntLimit: 120,
    huntHp: 1.5,
    huntCrowd: -0.3,
    huntEscort: 2,
    arenaReward: 0.5,
    /** Powinowactwa map (0.38): szansa na odporność / podatność węzła, mnożnik podatności, nagroda za odporność (punkty). */
    resistChance: 0.25,
    weakChance: 0.25,
    weakMul: 1.5,
    resistReward: 15,
    eliteChestEvery: 2,
    /** Szansa, że mapa nie ma bonusu. */
    noBonusChance: 0.35,
    /** Nagroda modyfikatorów: punkt ilości łupu (%) daje tyle szczęścia przedmiotów (× ułamek) i esencji (× ułamek). */
    rewardLuck: 1,
    rewardEssence: 0.15,
    /** Błogosławieństwo kapliczki działa na tyle kolejnych map z walką. */
    blessingMaps: 3,
    /** Cel pełnego poziomu aktu (boss): czas przetrwania (s) albo liczba zabójstw. */
    objTime: (act: number) => 180 + 40 * act,
    objKills: (act: number) => 500 + 400 * act,
    /** Długość celu zwykłej walki i elity względem pełnego poziomu. */
    fightScale: 0.75,
    /** Cel czasowy zwykłej walki krótszy niż zabójczy (0.37: mapy „przetrwaj” trwały ~4× dłużej niż „pokonaj”, telemetria). */
    surviveScale: 0.5,
    /** Mapa „przetrwaj” kończy się też po tylu zabójstwach (× liczby z mapy „pokonaj”). */
    surviveKills: 1,
    /** HP bossa aktu ponad zwykły wzór (0.37: walki trwały medianę 6-9 s; przy ×4 bot god P50 19 s, P90 119 s — ×3 z zapasem dla słabszych buildów). */
    bossHp: 3,
    /** Dodatkowy tłum wrogów na mapach Ekspedycji (flaga enemyCount) w akcie. */
    crowd: (act: number) => 0.5 + 0.25 * act,
    /** Pierwszy węzeł wyprawy (playtest 0.43.2: gracze i boty ginęli tu w 50-100 s): cel zabójstw, mniej wrogów (enemyCount), cisza bez sytuacji, zadań i wydarzeń (s), pierwsza elita (s). */
    gentle: { kills: 300, crowd: -0.5, dmg: -0.35, quiet: 90, stagger: 20, elite: 60, second: 0.5 },
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
    /** Mnożnik esencji za ukończoną ekspedycję (sekretny akt 4: × voidEssenceMul) i szansa na ukryty węzeł w akcie 2-3. */
    winEssenceMul: 1.5,
    voidEssenceMul: 1.5,
    secretChance: 0.5,
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
  /**
   * „Soczystość”: zatrzymanie klatki (s) po zabiciu elity / bossa i po mocnym trafieniu gracza (ułamek maks. HP),
   * minimalny odstęp między zatrzymaniami; powyżej tylu wrogów liczby obrażeń tylko dla krytyków (czytelność późnej gry).
   */
  /** Serie zabójstw (0.33): zabójstwa w odstępach najwyżej `gap` s; progi napisów i ich nazwy. Ewolucja: zatrzymanie `evolveFreeze` s. */
  streak: { gap: 0.8, tiers: [25, 60, 120, 250], names: ['Rampage', 'Massacre', 'Carnage', 'Annihilation'], evolveFreeze: 0.35, critFxEvery: 4 },
  juice: { hitstopElite: 0.07, hitstopBoss: 0.3, hitstopHurt: 0.05, hurtBig: 0.15, hitstopGap: 0.4, numbersCritOnly: 350, numbersCrowd: 24 },
  /** Limity efektów (wydajność przy masowych wybuchach): cząsteczki na krok, efekty wybuchów na krok i odległość scalania, obłoczki śmierci. */
  fx: { particlesPerStep: 160, sparksPerStep: 12, boomsPerStep: 6, boomMerge: 24, poofCap: 140 },
  bossBaseHp: 3200,
  /** Wykładnik mnożnika siły (BAL.power) dla HP bossa: 1 = jak zwykli wrogowie, mniej = krótsze walki. */
  bossPowerExp: 0.5,

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
  bulletDmg: 1.35,
  bossBulletDmg: 1.1,

  // --- limity wydajnościowe ---
  gemCap: 450,
  dmgNumberCap: 70,
  particleCap: 1600,
  enemyBulletCap: 2600,
  /** Powyżej tej liczby pocisków zwykli wrogowie wstrzymują ogień (boss strzela zawsze) — czytelność. */
  /** 0.44: 500 → 320 (playtest 2: 400-580 pocisków w 3-6 min); strzelają tylko widoczni (margines shootMargin), a pocisk mocniejszy (bulletDmg). */
  enemyBulletSoftCap: 320,
  /** Twardy limit (salwy w toku obcinane; walka z bossem bez limitu). */
  enemyBulletHardCap: 400,
  /** R4 (0.45): drugie ultimate — liczby (parametry z poziomu ulta: damage, radius, duration, count, blast, dist). */
  altUlt: {
    falconLen: 300, falconW: 10, falconFocus: 0.02,
    quakeWaves: 3, quakeWavesEvo: 5, quakeGap: 0.45, quakeStun: 0.5, quakeFuryStun: 0.6, quakeDmg: 1.6,
    flareDelay: 0.8, flareDmg: 4, flareHeat: 1.5, flareHeatR: 0.5,
    /** Premia do czasu Inferno (karty, węzeł Rozwoju i_inferno) wzmacnia Rozbłysk: +obrażeń na sekundę premii. */
    flareDur: 0.12,
    plagueDmg: 1.2, plagueBudget: 60, plagueR: 60, plagueStacks: 4, plagueSlowT: 5,
    markDelay: 1.5, markDmg: 2.5, markExec: 0.15, markStreak: 0.1,
    bastionTime: 3, bastionPerCount: 0.125, bastionHeal: 0.002,
    mushinDmg: 0.4, mushinCounters: 6, mushinMax: 5,
  },
  /** Udręka (0.46): esencja ×(1 + essence × poziom), maks. poziom. */
  torment: { essence: 0.15, max: 10 },
  /** Maks. awansów z zebrania kryształów całej mapy po bossie / końcu poziomu (0.45, analiza Agenta 2). */
  collectLevels: 3,
  shootMargin: 10,
  projectileCap: 2600,

  // --- dropy ---
  meatChance: 0.004,
  magnetChance: 0.0012,
  coinChance: 0.02,
} as const;
