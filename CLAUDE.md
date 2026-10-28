# Pixel Survivors — kontekst projektu

Przeglądarkowa gra bullet hell / survivors-like (w stylu Vampire Survivors) z bohaterami w stylu LoL Arena,
kartami-augmentami i ekwipunkiem z jakościami. Teksty w kodzie po polsku, gra domyślnie po angielsku (tłumaczenie w locie).

## Zasady pracy

- Odpowiadaj po polsku. Komentarze w kodzie po polsku. Bez martwego kodu (usuwaj nieużywane funkcje).
- Gra ma być grywalna po każdym etapie; po etapie krótko: co doszło i jak przetestować.
- Kolory tylko przez nazwy `C.*` z `core/palette.ts` (paleta ENDESGA 32), nigdy liczby indeksów.
- Czcionka pikselowa nie ma znaku "—" (em-dash) ani egzotycznych symboli — w tekstach widocznych w grze używaj "-" / ",".
- Wszystkie liczby balansu w `data/balance.ts` (`BAL`).
- Język: napisy w kodzie piszemy po polsku, `core/font.ts` tłumaczy każdy rysowany tekst przez `tr` (`core/i18n.ts`).
  Każdy nowy napis widoczny w grze musi mieć wpis w `core/i18n-en.ts` (wstawki jako `{}`, ta sama kolejność);
  części składane z kawałków tłumaczą się osobno, więc wystarczy wpis dla każdego kawałka.
- Styl grafiki: 16-bit, wszystko rysowane proceduralnie w kodzie (bez plików graficznych).
- Po zmianach: `npx tsc --noEmit` musi przejść.

## Technologia

HTML5 Canvas 2D + TypeScript + Vite. Logika ekranu 480×270 (W, H): UI rysuje w tych współrzędnych na płótnie ekranu W·K × H·K
(K 2-4, transformacja ×K, więc dostępne są linie ułamkowe: `roundRect`, `roundFrame`, tekst `scale: 0.75`). Świat rysuje się
między `r.beginWorld()` i `r.endWorld()` na osobnym płótnie VW × VH (piksele logiczne świata, ZOOM 1.5 na jednostkę) i jest
wklejany powiększony o VIEW_S (przybliżenie z Ustawień, K·VIEW_S całkowite). VIEW_W/VIEW_H/VW/VH/VIEW_S to żywe eksporty renderer.ts.
Stały krok symulacji 60 Hz. Zapis w localStorage z wersjami i migracjami (`core/save.ts`, SAVE_VERSION 7; nowe pola bez migracji dostają wartości domyślne w `loadSave`).
Pule obiektów + spatial hash (cel: 60 FPS przy ~1000 wrogach i ~2000 pocisków).

## Struktura `src/`

- `core/` — pętla, renderer (W/H/ZOOM, `rect`, `circle`, `withAlpha`), input (akcje abstrakcyjne: klawiatura, pad, mysz/dotyk),
  font (`drawText`, `wrapText`, LINE_H 12, polskie znaki), paleta (`C`, `RAMP`), audio (Web Audio, `sfx.play`), `music.ts` (muzyka proceduralna,
  `music.setMood`), rng (`rng.seed` dla wyzwania dnia), save.
- `gfx/` — `painter.ts` (sphere, polyShade, block, ring, disc, outline), `sprites.ts` (rejestr po nazwie, `drawSprite`),
  `icons.ts` (ikony 16×16: `ic_<broń>`, `pi_<pasywka>`, `ab_<umiejętność>`, `tag:<Tag>`, `bp_<moc bossa>`; `fu:<A>:<B>` = ikona hybrydy złożona w sprites.ts), `items.ts` (`it_<przedmiot>`),
  `hero-icons.ts` (ikony Vesper i Aurela), `elemmark.ts` (kształty żywiołów dla daltonistów), `actors.ts` (animowane postacie, `name@klatka`, skórki `name~odznaka@klatka` przez `Painter.recolor`), `world.ts` (efekty spark/poof/boom, strzały, dekoracje biomów), `objects.ts` (kapliczki, portale, kamień zadania, totem, teren: `tcover@v`, `tbarrel`, `tspikes@0/1`).
- `data/` — `balance.ts`, `weapons.ts` (z ewolucjami, hybrydy i `FUSIONS`), `passives.ts`, `enemies.ts` (Volley: kształt i ruch salw, `BOSS_POWERS`), `waves.ts`, `heroes.ts`,
  `levels.ts` (biomy, cele poziomów, `LevelDef.boss`/`eliteMul`), `expedition.ts` (mapy jak w PoE: `MapNode`, `MAP_MODS`, `MAP_BONUSES`, `EX_BLESSINGS`, `levelAt`, `nextLanes`), `augments.ts` (augmenty broni, `weaponBase`), `upgrades.ts` (jakość ulepszeń broni, `WeaponBonus`), `shop.ts` (usługi, eliksiry, ceny, rollShop), `synergies.ts` (tagi wszystkiego, progi synergii), `meta.ts` (drzewka per bohater `HERO_TREES`, klucze, Paragon, prestiż, esencja), `cards.ts` (~115 kart: stats/mul/flags/hooks, `unlock` = karta z osiągnięcia; lista flag w komentarzu pliku),
  `items.ts` (sloty, jakości, typy bazowe, afiksy, super-bonusy, unikaty `UNIQUES`, rollItem, rollUnique, porównania), `tasks.ts` (zadania), `pacts.ts` (pakty ryzyka, odznaki i skórki), `forge.ts` (Kuźnia: materiały, zwoje, `FORGE_STEPS`, progi, `AWAKENINGS`, warsztat `CRAFTS`),
  `secrets.ts` (Księga sekretów), `achievements.ts`, `bestiary.ts`, `daily.ts` (wyzwanie dnia z daty).
- `entities/` — typy encji.
- `systems/` — gracz, bronie, umiejętności, spawner, wrogowie + boss, pociski, strefy, znajdźki, awans (levelup), wieżyczki, sługi (`minions.ts`),
  `resource.ts` (zasób bohatera), `tasks.ts` (zadania w trakcie poziomu), `secrets.ts` (budzenie sekretów), `mapsecrets.ts` (sekrety map),
  `levelevents.ts` (wydarzenia poziomu, kombo, pioruny i zaznaczone uderzenia), `powers.ts` (moce bossów), `terrain.ts` (teren i arena bossa), `forge.ts` (próby kucia, naprawa, dropy materiałów, przebudzenia),
  sklep (zakupy), kowadło (`anvil.ts`: koszt w złocie ulepszenia, przekuj, jakość, przenieś super-bonus).
- `game/run.ts` — klasa `Run`: postać + świat poziomu, `damageEnemy` (jedyne miejsce utraty HP wroga), `killEnemy`,
  `hurtPlayer`, `recomputeStats` (bohater + pasywki + karty + ekwipunek), `indexEffects` (flagi i hooki z kart i super-bonusów),
  `emit` hooków (onHit, onKill, onAbilityCast, onDash, onDamageTaken, onLevelUp, onTick), ekwipunek (`equip`, `unequip`,
  `salvage`, `slotFor`), `toSnapshot`/`fromSnapshot`.
- `game/` — też `render.ts` (świat), `campaign.ts` (`endSlotRun`: koniec runu w slocie, rekordy, tablica Hardcore).
- `ui/` — `widgets.ts` (panel, dim, bar, Menu, slot), `hud.ts`, `levelup.ts`, `cards.ts`, `items.ts` (LootView, InventoryView),
  `shop.ts` (ShopView), `anvil.ts` (AnvilView z panelem Kuźni: etap `forge`, animacja młota), `expedition.ts` (ExpeditionMapView), `collection.ts` (zakładki: karty i bany, unikaty, sekrety, bestiariusz, osiągnięcia), `meta.ts` (ekran Rozwój), `synergies.ts` (ekran synergii, lista w HUD, ikony tagów), `powers.ts` (wybór mocy bossa), `pacts.ts` (ekran paktów), `game-screen.ts` (stany: play/levelup/cards/power/loot/inventory/shop/anvil/synergies/pause/cleared/map/end; `saveSlot`, `overlayReturn`), `menus.ts` (`SlotScreen` per tryb, `HeroSelect` z `GameOpts`, `DailyScreen`, kod Konami w `MainMenu`).

## Stan (wersja 0.23.7)

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
  Ekspedycja: mapy 7 rzędów × 4 kolumny, węzły z walką = mapy (nazwa, poziom trudności wspólny dla wyprawy, 0-6 modyfikatorów ryzyka z nagrodą,
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

- Etap 0.14 (Kuźnia runiczna jak w Metinie, `data/forge.ts`, `systems/forge.ts`, `BAL.forge`): ulepszanie do +15
  (`BAL.anvil.maxUpgrades`) z szansą (`FORGE_STEPS`: szansa, materiał i liczba, szansa spadku i pęknięcia), litość `Item.pity`
  (+5% za porażkę), materiały `run.mats` (kamień, ruda, serce smoka, łza bogów, iskra pustki) i zwoje `run.scrolls`
  (błogosławieństwo = bez spadku, smok = +15%, talizman = bez pęknięcia) w zapisie runu (`mats`, `scrolls`).
  Porażka: nic / `downgradeItem` / pęknięcie `Item.cracked` (wartości × `crackMul`, bez kucia i przebudzenia, `repairItem` za rudę).
  Tryb ryzyka: +10% szansy, pęknięcie od +4 i = zniszczenie przedmiotu (potwierdzenie drugim Enterem).
  Progi (`FORGE_TIERS`): +3 `addForgeAffix` i +12 `empowerSuper` raz (`Item.peak`), +6 bonus bazowy × `glowMul`, +9 przebudzenie
  wg typu (`AWAKENINGS`, `equippedAwakenings` w indexEffects/recomputeStats), +15 wszystko × `divineMul`, przebudzenie × 2.
  Wartości efektywne: `implicitOf`, `forgeMul` (Run, porównania, karta przedmiotu). Dropy: `forgeKillDrops` (kamienie, ruda i zwoje
  z elit), `forgeBossDrops` (serca, łzy od głębi 3, iskry od 5 / Paktu 10), rozkładanie (kamienie), zadania i lochy (ruda), Złoty szlam,
  miecz w kamieniu, węzeł kowadła Ekspedycji. Sklep: trzeci rząd (kamień, ruda, zwoje). Pomoc: strona Kuźnia.

- Etap 0.15 (wszystkie pomysły z rozmowy):
  1. Warsztat Kuźni (`CRAFTS`, `craft`/`craftChance` w systems/forge.ts, `B` w kowadle): przetapianie materiałów na wyższe
     (ruda, serce, łza, iskra) z szansą, złotem i odłamkami; porażka zwraca część składników. Łzy i iskry z bossów są rzadkie.
  2. Księga sekretów (`data/secrets.ts`, `systems/secrets.ts`, `run.secrets`, `save.collection.secrets`): 13 ukrytych buildów
     (warunek `check`, efekt jak karta, `while` = tylko dopóki trwa), liczniki w `cardState['sec.*']`.
  3. Sekrety map (`systems/mapsecrets.ts`, `BAL.secretsMap`): fontanna, runy z malowidłem, grzyby, biały jeleń i gaj, mimik,
     pęknięta ściana → skarbiec (loch 'vault'), 3 klucze z elit → kurhan z Zapomnianym Królem (loch 'barrow', moc `crown`), bezbłędny boss.
  4. Wydarzenia poziomu (Krwawy księżyc, Złota godzina, Burza; `BAL.levelEvents`) i kombo zabójstw ze złotem (`BAL.combo`).
  5. Nowi wrogowie: Tarczownik (tarcza z przodu), Przywoływacz, Kamikaze, Skoczek, Pajęczarz (sieci `run.webs`).
  6. Bossowie biomów: `BOSS_STYLES` w systems/enemies.ts (Władca Otchłani, Królowa Bagien, Żar Pustkowia, Oko Pustki),
     moce `BossPowerDef.bosses` (najpierw moce pokonanego bossa).
  7. Bohaterowie Vesper (Zabójczyni, zasób Kombo `streak`: trafienia, Egzekucja zużywa, pasywka `killReset`) i Aurel (Kapłan,
     Wiara `faith`: zabójstwa i leczenie, Łaska, Sąd zużywa; strażnicy `Minion.holy`, strefa `holy`, pasywka `guardShield`),
     bronie `knives`/`light` z ewolucjami, augmentami i fuzjami, karty, drzewka, sekrety Królowa cieni i Święty.
  8. Osiągnięcia (`ACHIEVEMENTS` → karty `unlock`, `run.unlocked`), bestiariusz (`save.bestiary`, `run.killsById`, `run.lore`:
     bonus obrażeń po progach), wyzwanie dnia (`dailyOf(date)`: bohater, pakty, ziarno; `save.daily`), ekran końca z zakładkami
     (obrażenia, wykres DPS `run.dpsLog` co `BAL.dpsEvery`, karta buildu).
  9. Sekrety trybów: kod Konami w menu → Głowy bossów (`run.rush`, `BAL.rush`, bossowie po kolei i Serce Pustki, `save.rushBest`),
     sekretny biom Pustka (`VOID_BIOME`, `Run.levelFor`: po pełnym cyklu biomów z Paktem `BAL.voidPact`+, bez leczenia, podwójny łup),
     ukryty węzeł „?” w Ekspedycji (Rozdarcie → `ex.voidKey`) i akt 4 w Pustce (`actBiome`), skórki za odznaki Paktu (`save.skins`, X).
  10. Dostępność: tryb łatwy (`settings.easy`, `BAL.easy`, bez odznak Paktu), kształty żywiołów (`settings.elemShapes`),
      Szybki run (`run.quick`, `BAL.quick`: 3 krótkie poziomy z bossami w jednym świecie).
  11. Muzyka proceduralna (`core/music.ts`): skala biomu, warstwy bas/pad, arpeggio, perkusja, melodia wg intensywności walki
      (`BAL.musicCrowd`, boss = pełna), osobna głośność `settings.music`.

- Etap 0.16 (grywalność):
  - Naprawiony błąd od 0.8: kontakt z wrogiem ignorował `touchCd` i ranił co klatkę. Nietykalność po trafieniu `BAL.hurtIframes`,
    łagodniejszy start obrażeń wrogów (`enemyDmgMul`).
  - Wyczyny (`data/feats.ts`, `systems/feats.ts`, `BAL.feats`, `run.feat`/`featsRun`, `save.feats`): Nietykalny (passa +obrażenia),
    Twardziel, Czysta broń, Jedna broń, Błyskawiczny łowca, Na krawędzi, Spartanin, Rzeź, Mistrz kombo, Łowca elit, Bez skazy;
    zakładka Wyczyny w Kolekcji, osiągnięcia z kartami Spokój (`calm`), Nimb (`firstBlock`), Medal.
  - Obraz: `Renderer.setFill` (wypełnienie okna przez bufor o całkowitej skali + wygładzone dopasowanie; inaczej skala całkowita),
    klawisz F = pełny ekran, Ustawienia → Obraz i widoczność: przyciemnienie tła (`bgDim`), obwódki pocisków wrogów, znacznik gracza.

- Etap 0.17 (wygląd i bossowie):
  - Renderer: płótno ekranu K× (bez osobnego bufora i kopiowania), świat na płótnie VW × VH, przybliżenie świata `settings.zoom`.
  - UI: `panel` (zaokrąglone, gradient, romby w rogach), `slot`, `bar` (gradient rampy, podziałki), `plate`, `Menu` (podświetlenie,
    `gaps` dla grup), cieńszy obrys tekstu (pół piksela, 8 kierunków). HUD: karta bohatera, plakietka czasu i celu, pigułki,
    baner na wstędze. Menu główne: niebo z księżycem i wzgórzami, panel grup (GRAJ / POSTĘP / INNE) i panel opisu z informacjami.
  - Bossowie: przy pojawieniu się bossa zwykli wrogowie znikają, w walce nie ma nowych (spawner); HP bossa × powerMul^`bossPowerExp`;
    zapowiedzi ataków (krąg, linia szarży) w render.ts.

- Etap 0.18 (balans i Ekspedycja):
  - Trudność: obrażenia wrogów rosną z mnożnikiem siły mocniej (`BAL.power.dmgExp` 0.45), łagodniejszy start (`enemyDmgMul`),
    bez nietykalności po trafieniu (zostaje odstęp ciosów każdego wroga `contactCooldown`).
  - Esencja: `costGrowth` 1.8, klucze 600-700, `rewardEssence` 0.15, `winEssenceMul` 1.5 (pełne drzewko ok. 10 wygranych wypraw).
  - Ekspedycja: każdy węzeł z walką ma `MapNode.tiers` (modyfikatory wylosowane dla 4 poziomów MAP_RARITY, nowy Koszmarna),
    gracz wybiera poziom klawiszami 1-4 albo przyciskiem (`chooseTier`).
  - Awans: `Option.recipe` (ikony składników i wyniku ewolucji / fuzji), rysowane na karcie (`drawRecipe`).
  - Runy: zła kolejność usuwa runy i malowidło.

- Etap 0.19 (Szał, trudność wyprawy, UI):
  - Furia Borguna: pełna wyzwala Szał (`run.rageT/rageMax`, `furyGain`): na `rage` s +`rageMight` obrażeń, +`rageAtk` szybkości
    ataku, leczenie `rageLeech`, pełne `dr`; pasek odlicza Szał, potem od zera. Sekret Berserk: 3 Szały na poziomie (`sec.berserk`).
  - Trudność Ekspedycji: `ExpeditionState.tier` dla całej wyprawy (`chooseTier(ex, t)` zmienia wszystkie nieodwiedzone mapy,
    `rollActMap(act, tier)`), zapamiętana w `save.exTier`; modyfikatory nadal losowane osobno dla każdego poziomu.
  - Wybór bohatera: zakładki Ogólne / Zasób (lewo/prawo), `resourceDetails(kind)` w data/heroes.ts liczy opis z `BAL.resource`.
  - UI: panel szczegółów mapy (przyciski trudności u góry, modyfikatory w dwóch kolumnach), podpowiedź mapy u góry ekranu,
    małe opisy progów synergii, długie opisy kart awansu małym tekstem.

- Etap 0.20 (Ekspedycja trudniejsza, interaktywne UI):
  - Siła buildu: `BAL.power.exp` 0.9, `max` 500 (HP wrogów nadąża za ogromnym DPS), obrażenia wrogów liczone z mnożnika
    obciętego do `dmgMax` 60 (jak dawniej).
  - Ekspedycja: dłuższe cele (`objTime`, `objKills`, `fightScale` 0.75) i większy tłum (`crowd(act)` dodawany do `enemyCount`).
  - Fuzja: składniki hybrydy nie wracają do oferty awansu (jak broń bazowa po ewolucji).
  - Ekwipunek: `itemAbout(it)` (rola slotu, rzadkość, gwiazdka, kowadło) pod plecakiem.
  - widgets: `pointer` (mysz ustawiana w main.ts, kursor-rączka nad klikalnym), `hovered`, `button` (podświetlenie, uniesienie,
    `pulse` = tu jest coś więcej), `moreArrow`; przyciski wszystkich ekranów przez `button`.

- Etap 0.21 (sekrety jawniejsze, Arsenał, łup):
  - HUD: `drawSecretArrows` — różowe strzałki przy krawędzi do sekretów mapy poza widokiem (obiekty z `SECRET_LABEL`,
    najbliższe grzyby, biały jeleń, pęknięta ściana do `WALL_HINT_R`), z nazwą i odległością.
  - Sekrety: `SecretDef.hint` (warunek wprost); Księga w Kolekcji pokazuje nazwę, zagadkę, warunek i efekt także nieodkrytych.
    Pomoc mówi wprost o Pustce, Rozdarciu i kodzie; za długa strona pomocy rysuje się małym tekstem.
  - Kolekcja: zakładka Arsenał (bronie bazowe i pasywki: ewolucja, fuzje, augmenty), nieodkryte karty widać wyblakłe.
  - Koniec Ekspedycji: pierwsza opcja `Rozwój: bohater` (MetaScreen z `heroId`, domyślnie `save.lastHero`).
  - Łup: `BAL.loot` (boss ×1.8, elita ×1.3, głębokość 0.1, szczęście ×0.5; boss wyklucza tylko Zwykłe), elita w Ekspedycji
    daje łup elity, unikat z bossa 8%.

- Etap 0.22 (angielski, ustawienia, szczęśliwe runy):
  - i18n: `core/i18n.ts` (`tr`, `setLang`, `Settings.lang`, domyślnie 'en') i słownik `core/i18n-en.ts` (ok. 2200 wpisów).
    `drawText`, `textWidth`, `wrapText` i `drawLabel` tłumaczą; kolejność prób: dokładnie, wzorce `{}`, podział na kawałki
    (`SEPS`), słowo po słowie; wygrywa kandydat z najmniejszą liczbą polskich resztek (`polish`).
  - Ustawienia: zakładki kategorii (Ogólne, Dźwięk, Obraz, Czytelność, Inne; Tab / Q / E / klik), lista opcji
    z wartością po prawej (`MenuItem.value`), Język w Ogólnych.
  - Balans: `BAL.power` exp 0.8 / max 300 (silny build zostaje silny), szczęśliwy traf `BAL.loot.jackpot` (Legendarny
    przedmiot albo unikat z dowolnego łupu, baner).
  - 0.22.1: angielski przepisany naturalnie (nie 1:1): krótsze opisy, nazwy jak w grach (Progression zamiast Development,
    Hero select, Lucky find), krótkie opisy modyfikatorów map. `core/i18n-en.ts` jest źródłem tłumaczeń (edytuj go ręcznie).

- Etap 0.23 (podgląd buildu, Strażnik skarbca):
  - `ui/build.ts` BuildView: bronie i pasywki w trakcie runu (klawisz C = akcja `build`, albo pauza): opis, następny poziom,
    bonusy jakości, augmenty, ewolucja i fuzje ikonami (zielone = składnik gotowy), dla pasywki bronie, które ewoluuje.
  - Skarbiec (pęknięta ściana): zamiast elity-Wartownika miniboss `warden` (systems/enemies.ts `updateWarden`, `WARDEN_ATTACKS`):
    krąży, stała spirala, losowy atak co `BAL.secretsMap.warden.actMin-actMax` s (bez powtórek, część z wyprzedzeniem ruchu
    gracza `leadAim`), szał poniżej połowy HP; HP × powerMul^(bossPowerExp-1) jak u bossa (wcześniej pełny mnożnik = gąbka).
  - 0.23.1: zwykły loch (portal, węzeł Dungeon) kończy się minibossem `keeper` (Strażnik lochu, to samo zachowanie, pociski
    `EnemyDef.bullet`), HP obu minibossów 80 (ok. połowa bossa), doganianie gracza (`catchUp`), Król w kurhanie 1.3× HP bossa.
  - 0.23.2: zdolność elity (`eliteAbility`, `BAL.eliteAbility`, pole `Enemy.abilT`): elity wręcz szarżują z pierścieniem
    przy lądowaniu, strzelające na zmianę wachlarz z wyprzedzeniem i pierścień z luką. Królowa Bagien wzmocniona (była
    najsłabszym bossem). Pomiar zagrożenia: bot krążący z unikami, % maks. HP w 30 s (skrypt w scratchpadzie threat.cjs).
  - 0.23.3: naprawa trucizny (sekret Wieczna Zaraza kopiuje truciznę zamiast `applyElement`, który mnożył siłę przy
    każdym przeskoku: wykładniczy wzrost do 1E18); statystyki i `dmgStep` (siła gracza → HP wrogów) liczą tylko zadane
    obrażenia, bez nadwyżki ponad HP. Bossowie i minibossowie (`warden`) odporni na ogłuszenie. Odporność bossa na żywioł
    biomu (`BAL.bossResist`, `Run.resistOf`, napis pod paskiem bossa). Tabela żywiołów i reakcji w ekranie broni (C, Tab).
    Augmenty działają w hybrydach (`weaponLines`, `augmentWorks`, `Run.augOn`): żywioł zawsze, zmiana ataku gdy rodzic ma
    ten sam typ ataku; zasady fuzji (`FUSION_RULES`) w Arsenale, ekranie broni i przy awansie; własne ikony hybryd `ic_f_*`.
    Fala ostrza: pocisk `kind: 'wave'` (szeroki, przez teren). Szarża Borguna: uderzenie na końcu rośnie z liczbą
    staranowanych (`BAL.charge`), Furia, zabójstwa skracają odnowienie. Zadania: Obrona totemu = 15 zabójstw przy totemie,
    Bez skazy = limit 2 trafień bez karnej fali. Wierność broni (`BAL.loyal`, `cardState.loyal`): poziom 10 i 20 z jedną bronią.
  - 0.23.4: Wierność broni bez limitu: stopień od poziomu 10 co 5 poziomów (`BAL.loyal`, `Run.nextLoyalLevel`), obrażenia
    × 1.35^stopień, szybkość ataku, obszar, pocisk co 2 stopnie, ewolucja bez pasywki. Dobrane symulacją Endless (skrypt
    lone.cjs w scratchpadzie): jedna broń dochodzi do głębi 3 w 13 min, pełny zestaw do głębi 2 w 15 min.
  - 0.23.5: nowy ekran pauzy (game-screen.ts renderPause): HUD pod spodem ukryty, lewa kolumna z menu i miejscem w runie,
    prawa z podsumowaniem: statystyki w dwóch kolumnach (bazowe przygaszone), bronie z poziomem, DPS i paskiem udziału,
    pasywki z ekwipunkiem, karty.
  - 0.23.6: HUD rysowany tylko w stanie 'play' (nakładki go zasłaniają). Podpowiedzi przypisane do ekranów (`HINT_SCREEN`
    w ui/hints.ts): w grze u góry pod celem, w nakładkach na wstędze tytułu, pozostałe czekają w kolejce. Ekran końca:
    kafelki z liczbami, panel zakładek tuż pod liniami informacji (`endY`), obrażenia z paskiem i udziałem %. HUD:
    plakietki synergii z nazwą tagu, „Etap N” zamiast „Poziom N” (myliło się z poziomem postaci). Plakietka „Polecane” na karcie.
  - 0.23.7: zakładki ekranu końca klikane tam, gdzie są rysowane (`endTab`); Rozwój po angielsku bez polskich resztek (Klucz, otrzymywanych obrażeń).

## Plan dalej

- Balans po testach: Ekspedycja (długość walk, nagrody węzłów), zasoby (Kombo, Wiara), zadania, moce bossów, Głowy bossów, Pustka.
- Pomysły: więcej unikatów i receptur fuzji, kolejne sekrety i osiągnięcia, warianty muzyki dla bossów.

## Testowanie

- `npm run dev`, w grze F3 = debug, F4 = przyspiesz cel poziomu, F6 = awans, F7 = łup bossa (12% szans na unikat).
- Bez UI: moduły z serwera Vite w Playwright (`await import('/src/game/run.ts')`, `new Run(...)`, `run.update(1/60, wejście)`) —
  szybki test systemów (zasoby, zadania, moce, fuzje: `generateOptions`/`applyOption`, teren: `run.terrain`).
- Sklep bez grania do bossa: wstrzyknij w localStorage zapis w `slots.hardcore` z `inProgress: false` i polem `shop`, potem Kontynuuj.
- Ekspedycja: zapis w `slots.expedition` z polem `expedition` (np. `path` przed bossem) pozwala od razu testować bossa i przejście aktu.
- Szczegóły sterowania i dodawania zawartości: README.md.
