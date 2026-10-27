# Pixel Survivors — kontekst projektu

Przeglądarkowa gra bullet hell / survivors-like (w stylu Vampire Survivors) z bohaterami w stylu LoL Arena,
kartami-augmentami i ekwipunkiem z jakościami. Wszystko po polsku.

## Zasady pracy

- Odpowiadaj po polsku. Komentarze w kodzie po polsku. Bez martwego kodu (usuwaj nieużywane funkcje).
- Gra ma być grywalna po każdym etapie; po etapie krótko: co doszło i jak przetestować.
- Kolory tylko przez nazwy `C.*` z `core/palette.ts` (paleta ENDESGA 32), nigdy liczby indeksów.
- Czcionka pikselowa nie ma znaku "—" (em-dash) ani egzotycznych symboli — w tekstach widocznych w grze używaj "-" / ",".
- Wszystkie liczby balansu w `data/balance.ts` (`BAL`).
- Styl grafiki: 16-bit, wszystko rysowane proceduralnie w kodzie (bez plików graficznych).
- Po zmianach: `npx tsc --noEmit` musi przejść.

## Technologia

HTML5 Canvas 2D + TypeScript + Vite. Bufor 480×270 skalowany całkowitoliczbowo, świat rysowany z ZOOM 1.5.
Stały krok symulacji 60 Hz. Zapis w localStorage z wersjami i migracjami (`core/save.ts`, SAVE_VERSION 7).
Pule obiektów + spatial hash (cel: 60 FPS przy ~1000 wrogach i ~2000 pocisków).

## Struktura `src/`

- `core/` — pętla, renderer (W/H/ZOOM, `rect`, `circle`, `withAlpha`), input (akcje abstrakcyjne: klawiatura, pad, mysz/dotyk),
  font (`drawText`, `wrapText`, LINE_H 12, polskie znaki), paleta (`C`, `RAMP`), audio (Web Audio, `sfx.play`), rng, save.
- `gfx/` — `painter.ts` (sphere, polyShade, block, ring, disc, outline), `sprites.ts` (rejestr po nazwie, `drawSprite`),
  `icons.ts` (ikony 16×16: `ic_<broń>`, `pi_<pasywka>`, `ab_<umiejętność>`, `tag:<Tag>`, `bp_<moc bossa>`; `fu:<A>:<B>` = ikona hybrydy złożona w sprites.ts), `items.ts` (`it_<przedmiot>`),
  `actors.ts` (animowane postacie, `name@klatka`), `world.ts` (efekty spark/poof/boom, strzały, dekoracje biomów), `objects.ts` (kapliczki, portale, kamień zadania, totem, teren: `tcover@v`, `tbarrel`, `tspikes@0/1`).
- `data/` — `balance.ts`, `weapons.ts` (z ewolucjami, hybrydy i `FUSIONS`), `passives.ts`, `enemies.ts` (Volley: kształt i ruch salw, `BOSS_POWERS`), `waves.ts`, `heroes.ts`,
  `levels.ts` (biomy, cele poziomów, `LevelDef.boss`/`eliteMul`), `expedition.ts` (mapy jak w PoE: `MapNode`, `MAP_MODS`, `MAP_BONUSES`, `EX_BLESSINGS`, `levelAt`, `nextLanes`), `augments.ts` (augmenty broni, `weaponBase`), `upgrades.ts` (jakość ulepszeń broni, `WeaponBonus`), `shop.ts` (usługi, eliksiry, ceny, rollShop), `synergies.ts` (tagi wszystkiego, progi synergii), `meta.ts` (drzewka per bohater `HERO_TREES`, klucze, Paragon, prestiż, esencja), `cards.ts` (88 kart: stats/mul/flags/hooks; lista flag w komentarzu pliku),
  `items.ts` (sloty, jakości, typy bazowe, afiksy, super-bonusy, unikaty `UNIQUES`, rollItem, rollUnique, porównania), `tasks.ts` (zadania), `pacts.ts` (pakty ryzyka, odznaki).
- `entities/` — typy encji.
- `systems/` — gracz, bronie, umiejętności, spawner, wrogowie + boss, pociski, strefy, znajdźki, awans (levelup), wieżyczki, sługi (`minions.ts`),
  `resource.ts` (zasób bohatera), `tasks.ts` (zadania w trakcie poziomu), `powers.ts` (moce bossów), `terrain.ts` (teren i arena bossa),
  sklep (zakupy), kowadło (`anvil.ts`: ulepsz, przekuj, jakość, przenieś super-bonus).
- `game/run.ts` — klasa `Run`: postać + świat poziomu, `damageEnemy` (jedyne miejsce utraty HP wroga), `killEnemy`,
  `hurtPlayer`, `recomputeStats` (bohater + pasywki + karty + ekwipunek), `indexEffects` (flagi i hooki z kart i super-bonusów),
  `emit` hooków (onHit, onKill, onAbilityCast, onDash, onDamageTaken, onLevelUp, onTick), ekwipunek (`equip`, `unequip`,
  `salvage`, `slotFor`), `toSnapshot`/`fromSnapshot`.
- `game/` — też `render.ts` (świat), `campaign.ts` (`endSlotRun`: koniec runu w slocie, rekordy, tablica Hardcore).
- `ui/` — `widgets.ts` (panel, dim, bar, Menu, slot), `hud.ts`, `levelup.ts`, `cards.ts`, `items.ts` (LootView, InventoryView),
  `shop.ts` (ShopView), `anvil.ts` (AnvilView), `expedition.ts` (ExpeditionMapView), `collection.ts` (kolekcja i bany kart, zakładka Unikaty), `meta.ts` (ekran Rozwój), `synergies.ts` (ekran synergii, lista w HUD, ikony tagów), `powers.ts` (wybór mocy bossa), `pacts.ts` (ekran paktów), `game-screen.ts` (stany: play/levelup/cards/power/loot/inventory/shop/anvil/synergies/pause/cleared/map/end; `saveSlot`, `overlayReturn`), `menus.ts` (`SlotScreen` per tryb).

## Stan (wersja 0.13.0)

- Etap 1: ruch, broń automatyczna, XP, awans 3 karty z losuj/pomiń/wygnaj.
- Etap 2: 10 broni + ewolucje, 13 pasywek, 6 typów wrogów + elity, boss z 3 fazami, 2 bohaterów
  (Kestra — strzelec, Borgun — wojownik; Q/E/Spacja/R, ultimate ładowany zabójstwami).
- Etap 3: kampania poziomów bez końca (biomy, cele „przetrwaj”/„zabij N”, boss), Hardcore (śmierć/wyjście = utrata runu,
  tablica rekordów; od etapu 4 wyjście w trakcie poziomu wznawia go z zapisu), Trening, 49 kart (srebrne/złote/pryzmatyczne, przeklęte, karty bohaterów).
- Restyl 16-bit + pass grafiki i ikon.
- Przedmioty: 8 slotów, 5 jakości (Zwykły/Magiczny/Rzadki/Epicki/Legendarny = 1–5 afiksów), bonus bazowy skalowany
  poziomem przedmiotu, 15 afiksów, 12 super-bonusów (m.in. Egzekucja 0,1% natychmiastowego zabicia), łup z elit/bossa/rzadko
  zwykłych wrogów, ekran łupu i ekwipunku z porównaniem (zielone/czerwone), zapis w slocie Hardcore.
- Synergie (zestawy tagów): bohater, bronie (wg wzorca), pasywki i afiksy (wg statystyki), karty, super-bonusy dają punkty
  10 tagów; progi 3/6/9 (Klątwa 2/3/4) kumulują bonusy (stats/mul/flags/hooks jak karty). Liczone w `Run.indexEffects`;
  każda zmiana buildu przez `run.onBuildChanged()`.
- Tarcza za zabójstwa ma limit przyrostu na sekundę (`BAL.killShieldRate`, `run.killShield`), `hurtCooldown` 0.4.
- Bullet hell w stylu ROTMG (dużo uników): salwy `Volley` (fan/ring/gapRing/shotgun) z ruchem pocisków (zwalnianie,
  skręt, wężyk), serie i zapowiedzi (miganie), Kultysta (strumień) i Strażnik (pierścienie z luką), boss z nazwanymi
  atakami, trafienie od małego rdzenia gracza (`BAL.playerBulletR`, rdzeń rysowany przy pociskach).
- Kowadło między poziomami (ekran ukończenia, sklep, klawisz K): złoto + odłamki (z rozkładania), ceny w `BAL.anvil`.
- Kolekcja kart (menu główne): odkryte / wybrane karty między runami i do `BAL.cardBanSlots` banów (wykluczone z `cardPool`).
  Zapis v3: `save.collection`; run zbiera dziennik (`noteCardsSeen`, `drainCardLog`), ekran gry przenosi go do kolekcji.
  W ofercie karty nieodkryte mają napis „Nowa!”.
- Czytelność: opisy poziomów umiejętności (`describeAbilityLevel`) i broni (`describeLevel` wg wzorca), podpowiedzi
  ewolucji i „Polecane” (`optionScore`) przy awansie, postęp synergii przy tagach (`drawTagGain`). Skrzynie mają przedmiot
  od upadku (`run.dropChest`) — poświata/słup światła wg jakości i znacznik poza ekranem.
- Hardcore: zapis w trakcie poziomu (`RunSnapshot.stage`, co ~5 s i „Zapisz i wyjdź”) — wyjście wznawia poziom, run przepada tylko po śmierci/poddaniu.
- Obrażenia gracza bez globalnej nietykalności: `Enemy.touchCd` (BAL.contactCooldown) per wróg, pociski zawsze.
- Wszechstronność (`VERSATILITY` w synergies.ts) za liczbę aktywnych synergii; minimapa w HUD (ustawienie `minimap`).
- Ewolucje umiejętności (`AbilityDef.evo`, `evolveAbility`, `EVO_EXTRA` w systems/abilities.ts, opcja awansu `abilityEvolve`).
- Ikony kart: `CARD_ICONS` w data/cards.ts + `gfx/card-icons.ts` (cd_*, ab_*_evo); 27 typów przedmiotów.
- Etap 5: esencja za każdy zakończony run (`runEssence`, ekran końca), drzewko Rozwój (4 gałęzie × 5 węzłów, `META_NODES`),
  Paragon (poziom z całej esencji, +1% obrażeń/HP), prestiż (reset drzewka za +5% statystyk i +15% esencji), bonusy w runie
  przez `run.applyMeta(metaBonus(save.meta), fresh)`. Tryb Endless (`mode: 'endless'`, boss co `BAL.endlessBossEvery`,
  głębia rośnie, rekord `bestEndless`). Liczby przez `fmt`.
- Etap 6: dotyk (`Input.touchControls`, joystick `Input.stick`, przyciski = gniazda umiejętności `abilitySlotPos`, `TOUCH_PAUSE`),
  ustawienie `lowFx` (oszczędne efekty), błysk/niskie HP w HUD, wyciemnienie przy `app.go`. Widok leczenia (`run.healed`, liczby, `healNumbers`).
- Mapa: `systems/events.ts` (kapliczki i błogosławieństwa `run.buffs`, miecz w kamieniu, portal i loch `run.dungeon` z areną),
  Złoty szlam (`goldslime`, zachowanie `flee`), grafika w `gfx/objects.ts`. Ulepszenia w runie: `run.shopLevel` (BAL.shopUpgrade),
  `run.anvilLevel` (BAL.anvilUpgrade).
- Żywioły (`data/elements.ts`: WEAPON_ELEMENT, SRC_ELEMENT po nazwie źródła, stany na Enemy: burn/chill/shock/poison,
  `run.applyElement`, ticki DoT w systems/enemies.ts, `DamageOpts.dot`), statystyka `elemPower`.
- Przekuwanie tylko w kowadle (przyciski R na karcie przedmiotu, `anvilReroll`/`anvilRerollAll`, bez celu tagu).
  `drawItemCard(..., stats)` pokazuje sumy statystyk (`statTotal`). Pauza: DPS broni. Ustawienie `playerFx` (ataki gracza: widoczne/przygaszone/ukryte).
- Szybkość ataku (`Stats.atkSpeed`, `BAL.attackSpeedMul`) przyspiesza bronie; `cdr` dotyczy już tylko umiejętności.
- Ustawienia: głośność, celowanie umiejętności (auto/mieszane/ręczne, `AimMode` w `core/save.ts`), liczby obrażeń,
  wstrząsy, auto-pauza po utracie fokusu, pełny ekran, debug.
- Etap 4 (część): sklep między poziomami Hardcore (4 przedmioty z poziomem następnego poziomu, odświeżanie,
  mikstura, karta, zasoby wyboru, 2 eliksiry ze stałym bonusem; oferta zapisana w runie, po wczytaniu gra startuje od sklepu).
- Etap 4 (koniec): Ekspedycja (`mode: 'expedition'`, `run.expedition`: akt, mapa, `path`, `cleared`) — 3 akty map z węzłami
  walka/elita/skarb/sklep/kowadło/obóz/boss (`data/expedition.ts`, `BAL.expedition`); walki bez bossa kończy `run.clearObjective()`
  (spawner, gdy `!levelInfo.boss`), nagroda karta 'fight'/'elite'. Sloty zapisu per tryb: `save.slots` (hardcore/expedition/endless,
  `SlotMode`), `save.board` (tablica Hardcore), rekordy `bestExpedition`/`expeditionWins`. Endless też zapisuje i wznawia run (`stage.nextBossAt`).

- Etap 7 (bohaterowie, 3/6): Ignara — Mag ognia (broń `staff`/`staff_evo` z żywiołem ognia, umiejętności `fireball`/`firering`/`dash`/`inferno`
  w systems/abilities.ts, ewolucje Słońce/Płomienna bariera/Kataklizm, pasywka `echoCast` — co N-te Q/E darmowe powtórzenie, `cardState.echoCast`),
  4 karty `h_i_*`. Wybór bohatera: lista po lewej + szczegóły (miejsce na 6 bohaterów).

- Etap A (0.7, poprawki i balans): `playerFx` (render.ts `atk()`: aury, strefy, orbity, pociski, cząsteczki, efekty; `withAlpha` mnoży),
  broń bazowa nie wraca po ewolucji, opcje `stat` przy awansie (`BAL.statBoosts`) gdy brak ulepszeń, siła buildu `BAL.power`
  (`run.dpsEma`, `run.powerMul` — HP i obrażenia wrogów rosną z DPS gracza i poziomem; `PCT_SOURCES` w run.ts nie liczą się do DPS),
  `BAL.eliteGap`, `BAL.patternDensity`, późne fale, łagodniejszy start; ulepszenie przedmiotu w kowadle liniowe (`Item.upg`, `up`,
  `BAL.anvil.maxUpgrades`), miękkie limity `BAL.softCaps`, zwrot 25% kosztów kowadła przy rozkładaniu (`Item.spent`, `salvageGold`),
  Głód krwi z limitem, Złoty szlam rzadziej (`goldSlimeGap`, jeden naraz), limity efektów `BAL.fx` (cząsteczki, iskry, scalanie wybuchów),
  `drawLabel` (liczby obrażeń z pamięci podręcznej), `warmFx`, ekran Podgląd balansu (`ui/balance.ts`, Ustawienia w trybie debug).
- Etap B (0.8, żywioły i zawartość): reakcje żywiołów w `Run.react` (Para, Kruszenie `Enemy.brittle`, Wybuch toksyn, Przewodzenie,
  Przeciążenie; `BAL.reactions`, `Enemy.reactT`, kolory `REACTION_COL`; trafienia reakcji i procentowe nie nakładają żywiołów),
  `applyElement` publiczne. 22 augmenty broni (opcja awansu `augment` od `BAL.augmentMinLevel`, `run.augments`, `run.aug(id)`,
  `run.augElem`; pola pocisku `retarget/split/splitEnd/retMul/blast`, `shardProjectile`), 25 nowych kart (flagi `elemChance.*`,
  `critShock`, `reactPower`, `reactCd`, `shockBonus`, `bossDmg`, `cull`, `enemySpeed`; augmenty bohaterów `h_k_*`, `h_b_*`, `h_i_*`),
  5 żywiołowych super-bonusów (ignite, frostbite, conductor, thunder, plague).
- Etap C (0.9): Rozwój tylko w Ekspedycji (`NO_META` w innych trybach, esencja tylko z Ekspedycji), drzewko per bohater
  (`HERO_TREES`: 4 gałęzie tematyczne z kluczem + wspólna Wyprawa; `save.meta.heroes[id]`, `heroMeta`; klucze przez flagi
  `echo.q/e`, `dashResetQ`, `dashNet`, `ringShield`, `counterSlam`, `aegis`, `revive`...), ekran Rozwój z zakładkami (Q/E),
  zapis v6 (zwrot dawnej esencji i węzłów do `meta.unassigned`, Paragon przez `meta.legacy`, przydział klawiszem B).
  Ekspedycja: mapy 7 rzędów × 4 kolumny, węzły z walką = mapy (nazwa, rzadkość, 0-4 modyfikatory ryzyka z nagrodą,
  bonus), `LevelDef.flags` dokładane w `indexEffects`, nowe węzły Loch (`LevelDef.dungeon`, `startDungeon`) i Kapliczka
  (`ex.blessing` na `BAL.expedition.blessingMaps` map), esencja × nagroda map (`ex.bonus`).
- Etap D (0.10, polish): jakość ulepszeń broni przy awansie (`rollQuality` ze Szczęściem, `rollWeaponBonus`, `WeaponInst.bonus`
  w `effectiveStats`, krytyk i siła żywiołu przez `run.srcCrit`/`srcElem`, `BAL.weaponQuality`, zapis broni `[id, poziom, bonus]`,
  bonusy w pauzie pod DPS), animowane karty awansu i wyboru kart (wjazd, błysk rzadkich, ramka jakości), zatrzymanie klatki
  (`run.freeze`, `BAL.juice`), rozbłysk śmierci, animacje zbierania (XP — błysk paska `run.xpPulse`, łup — pierścień i napis),
  liczby obrażeń tylko dla krytyków w tłumie, dźwięki żywiołów i reakcji, mocniejszy boss, dźwięk najechania w menu,
  więcej klatek wrogów (golem, kultysta, strażnik, wirujący) i 4-klatkowy boss z detalami, druga warstwa podłoża (`patch`),
  migotanie legendarnych przedmiotów.
- Etap 8 (0.11, bohaterowie 4/6): Morwen — Przywoływaczka. Sługi: `systems/minions.ts` (`spawnMinion`, `run.minions`, `BAL.minions`,
  flagi `minionDmg/minionSpeed/minionLife`, synergia Przywołania +30% obrażeń sług). Broń `souls`/`souls_evo` (trucizna),
  umiejętności `summon`/`curse` (strefa `curse`)/`dash`/`legion` z ewolucjami (Zastęp, Przeklęta ziemia — poraża, Nieśmiertelny
  legion — sługi wybuchają), pasywka `killSummon` (Zew dusz), 4 karty `h_m_*`, augmenty Duszek (Wędrujące dusze, Żniwo — `run.lastHitSrc`),
  drzewko Rozwoju (Przywołania, Klątwy, Cień, Dusze; klucz `dashSummon`), sprite'y `morwen`, `wraith`, `wraithbig`, `soul`.
  Uwaga: `HeroDef.base` nadpisuje wartości domyślne statystyk (np. `duration: 1.1`, nie `0.1`).
- Etap QoL (0.12): podpowiedzi kontekstowe `ui/hints.ts` (`HINTS`, `Hints.show(id)` raz na zapis — `save.seenHints`,
  ustawienie `hints`, wyzwalane w `GameScreen.gameplayHints`/`openPending`/`openMap`/`openShop`/`openAnvil`), ekran Pomocy
  `ui/help.ts` (menu główne i pauza), opisy pozycji menu (`MENU_DESC`, Trening polecany dla nowych), `save.lastHero`,
  baner „R gotowe!”, nowe przedmioty w plecaku (`Item.fresh` przez `run.stash`, znacznik „!”, przypomnienie w HUD),
  ustawienie `hitstop`, licznik `run.reactions`.

- Etap 0.13 (plan „odróżnić od Vampire Survivors”, wszystkie 7 punktów):
  1. Zasób bohatera (`HeroDef.resource`, `systems/resource.ts`, `BAL.resource`, stan `run.res/resGap/resIdle`, zapis `resource`):
     Celność (Kestra: trafienia z dystansu, krytyk, pełna = darmowa Salwa), Furia (Borgun: ciosy z bliska i obrywanie, obrażenia
     i redukcja, opada poza walką), Żar (Ignara: Q/E, mocniejsze czary, przegrzanie rani, unik od `ventMin` = Wydech żaru),
     Dusze (Morwen: zabici w pobliżu, pełne = sługa, R zużywa wszystkie — `spendSouls`). Pasek pod HP, opis na wyborze bohatera.
     Flagi `res.gain/res.power/res.max`, `heat.safe/heat.vent`, karty `h_k_focus`, `h_b_fury`, `h_i_heat`, `h_m_souls`.
  2. Zadania (`data/tasks.ts`, `systems/tasks.ts`, `BAL.tasks`, `run.task`): kamień co minutę, dotknięcie zaczyna zadanie
     (Łowy, Obrona totemu, Krąg mocy, Bez skazy, Próba żywiołu), panel w HUD, znacznik poza ekranem (`taskTarget`),
     nagroda (skrzynia / karta / złoto), część porażek = karna fala. Boss albo loch przerywa zadanie.
  3. Unikaty (`UNIQUES` w data/items.ts, `Item.unique`, `rollUnique`, `itemColor`, `equippedUniques` w indexEffects/recomputeStats):
     10 przedmiotów, łup z bossów i elit (`BAL.uniques`, `run.rollLoot`), flagi `facing`, `healShield`; kowadło ich nie przekuwa;
     kolekcja `save.collection.uniques` (`run.uniquesFound`, `syncCollection`), zakładka Unikaty (Tab).
  4. Moce bossów (`BOSS_POWERS`, `systems/powers.ts`, `ui/powers.ts`): po bossie `run.pendingPowers` → wybór 1 z 3, jedna moc
     (`run.power`, zapis `power`), ta sama = poziom (`BAL.bossPowers`), strzela sama co `cd` (× cdr), gniazdo w HUD.
  5. Fuzje (`FUSIONS`, hybrydy `fused` z `hybrid: blast/split/seek` w data/weapons.ts): opcja awansu `fusion` (zawsze w ofercie),
     podpowiedź „Fuzja z”, hybryda w slocie pierwszej broni, druga znika (`addWeapon` bierze najmniejszy wolny slot),
     tagi obu rodziców, żywioły w `WEAPON_ELEMENT`.
  6. Pakty (`data/pacts.ts`, `ui/pacts.ts`, `BAL.pacts`): na wyborze bohatera (Tab), `save.pacts.chosen` → `run.pacts` (flagi w
     indexEffects; nowe `bulletSpeed`, `eliteMods`, `bossHp`), esencja × poziom Paktu (`run.essenceMul`), odznaki za bossa
     (`save.pacts.best`, `run.bossKills`), zapis v7.
  7. Teren (`systems/terrain.ts`, `BAL.terrain`, `run.terrain/terrainChunks/arena/ground`): kawałki generowane wokół gracza wg
     biomu, osłony blokują pociski obu stron (`terrainBlocker`, `hitTerrain`), beczki (łańcuchy przez `terrainBlast` w `explode`),
     kolce, bagno (spowolnienie), lód (bezwładność `Player.vx/vy`), zwężająca się arena bossa (gracz i wrogowie w środku).
  Pomoc: strony Zasoby i Moce; podpowiedzi `resource`, `task`, `unique`, `power`, `fusion`, `terrain`.

## Plan dalej

- Kolejni bohaterowie: zostały 2 role (np. zabójca, kapłan) — wszystko oryginalne, od razu z zasobem (`HeroDef.resource`, systems/resource.ts).
- Balans po testach: Ekspedycja (długość walk, nagrody węzłów), zasoby, zadania (totem), moce bossów, hybrydy, teren (gęstość osłon).
- Pomysły: więcej unikatów i receptur fuzji, moce z bossów aktów Ekspedycji z własnymi atakami, odblokowania za odznaki Paktu.

## Testowanie

- `npm run dev`, w grze F3 = debug, F4 = przyspiesz cel poziomu, F6 = awans, F7 = łup bossa (12% szans na unikat).
- Bez UI: moduły z serwera Vite w Playwright (`await import('/src/game/run.ts')`, `new Run(...)`, `run.update(1/60, wejście)`) —
  szybki test systemów (zasoby, zadania, moce, fuzje: `generateOptions`/`applyOption`, teren: `run.terrain`).
- Sklep bez grania do bossa: wstrzyknij w localStorage zapis w `slots.hardcore` z `inProgress: false` i polem `shop`, potem Kontynuuj.
- Ekspedycja: zapis w `slots.expedition` z polem `expedition` (np. `path` przed bossem) pozwala od razu testować bossa i przejście aktu.
- Szczegóły sterowania i dodawania zawartości: README.md.
