# Pixel Survivors — kontekst projektu

Przeglądarkowa gra bullet hell / survivors-like (w stylu Vampire Survivors) z bohaterami w stylu LoL Arena,
kartami-augmentami i ekwipunkiem z jakościami. Teksty w kodzie po polsku, gra domyślnie po angielsku (tłumaczenie w locie).

## Zasady pracy

- Odpowiadaj po polsku. Komentarze w kodzie po polsku. Bez martwego kodu (usuwaj nieużywane funkcje).
- Gra ma być grywalna po każdym etapie; po etapie krótko: co doszło i jak przetestować.
- Kolory tylko przez nazwy `C.*` z `core/palette.ts` (paleta ENDESGA 32), nigdy liczby indeksów.
- Czcionka pikselowa nie ma znaku "—" (em-dash) ani egzotycznych symboli — w tekstach widocznych w grze używaj "-" / ",".
- Wszystkie liczby balansu w `data/balance.ts` (`BAL`).
- Język: `core/font.ts` tłumaczy każdy rysowany tekst przez `tr` (`core/i18n.ts`). Od 0.27 nowe napisy piszemy po angielsku
  i dopisujemy polską wersję w `core/i18n-pl.ts` (wstawki jako `{}`, ta sama kolejność). Stare polskie napisy tłumaczy
  `core/i18n-en.ts`; zmieniając taki napis, przepisz go po angielsku i przenieś do `i18n-pl.ts`.
  Części składane z kawałków tłumaczą się osobno, więc wystarczy wpis dla każdego kawałka.
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
  `music.setMood`), rng, save (`SAVE_VERSION`, `MIGRATIONS`, `seenVersion`), i18n (`tr`: PL → EN przez `i18n-en.ts`, EN → PL przez `i18n-pl.ts`).
- `gfx/` — `painter.ts` (sphere, polyShade, block, ring, disc, outline), `sprites.ts` (rejestr po nazwie, `drawSprite`),
  `icons.ts` (ikony 16×16: `ic_<broń>`, `pi_<pasywka>`, `ab_<umiejętność>`, `tag:<Tag>`, `bp_<moc bossa>`; `fu:<A>:<B>` = ikona hybrydy złożona w sprites.ts), `items.ts` (`it_<przedmiot>`),
  `hero-icons.ts` (ikony Vesper i Aurela), `elemmark.ts` (kształty żywiołów dla daltonistów), `actors.ts` (animowane postacie, `name@klatka`, skórki `name~odznaka@klatka` przez `Painter.recolor`), `world.ts` (efekty spark/poof/boom, strzały, dekoracje biomów), `ground.ts` (podłoże z pól szumu w kawałkach `CHUNK`: trawa, ziemia, ścieżki, posadzki; `surfaceAt`), `landmarks.ts` (brama, obelisk, obozowisko, ruiny, kolumny), `objects.ts` (kapliczki, portale, kamień zadania, totem, teren: `tcover@v`, `tbarrel`, `tspikes@0/1`).
- `data/` — `balance.ts`, `weapons.ts` (z ewolucjami, hybrydy i `FUSIONS`), `passives.ts`, `enemies.ts` (Volley: kształt i ruch salw, `BOSS_POWERS`), `waves.ts`, `heroes.ts`,
  `levels.ts` (biomy, cele poziomów, `LevelDef.boss`/`eliteMul`), `expedition.ts` (mapy jak w PoE: `MapNode`, `MAP_MODS`, `MAP_BONUSES`, `EX_BLESSINGS`, `levelAt`, `nextLanes`), `augments.ts` (augmenty broni, `weaponBase`), `upgrades.ts` (jakość ulepszeń broni, `WeaponBonus`), `shop.ts` (usługi, eliksiry, ceny, rollShop), `synergies.ts` (tagi wszystkiego, progi synergii), `meta.ts` (drzewka per bohater `HERO_TREES`, klucze, Paragon, prestiż, esencja), `cards.ts` (~115 kart: stats/mul/flags/hooks, `unlock` = karta z osiągnięcia; lista flag w komentarzu pliku),
  `items.ts` (sloty, jakości, typy bazowe, afiksy, super-bonusy, unikaty `UNIQUES`, rollItem, rollUnique, porównania), `tasks.ts` (zadania), `pacts.ts` (pakty ryzyka, odznaki i skórki), `forge.ts` (Kuźnia: materiały, zwoje, `FORGE_STEPS`, progi, `AWAKENINGS`, warsztat `CRAFTS`),
  `secrets.ts` (Księga sekretów), `achievements.ts`, `bestiary.ts`.
- `entities/` — typy encji.
- `systems/` — gracz, bronie, umiejętności, spawner, wrogowie + boss, pociski, strefy, znajdźki, awans (levelup), wieżyczki, sługi (`minions.ts`),
  `resource.ts` (zasób bohatera), `tasks.ts` (zadania w trakcie poziomu), `secrets.ts` (budzenie sekretów), `mapsecrets.ts` (sekrety map),
  `levelevents.ts` (wydarzenia poziomu, kombo, pioruny i zaznaczone uderzenia), `powers.ts` (moce bossów), `terrain.ts` (teren i arena bossa), `forge.ts` (próby kucia, naprawa, dropy materiałów, przebudzenia),
  sklep (zakupy), kowadło (`anvil.ts`: koszt w złocie ulepszenia, przekuj, jakość, przenieś super-bonus).
- `game/run.ts` — klasa `Run`: postać + świat poziomu, `damageEnemy` (jedyne miejsce utraty HP wroga), `killEnemy`,
  `hurtPlayer`, `recomputeStats` (bohater + pasywki + karty + ekwipunek), `indexEffects` (flagi i hooki z kart i super-bonusów),
  `emit` hooków (onHit, onKill, onAbilityCast, onDash, onDamageTaken, onLevelUp, onTick), ekwipunek (`equip`, `unequip`,
  `salvage`, `slotFor`), `toSnapshot`/`fromSnapshot`.
- `game/` — też `render.ts` (świat), `scenery.ts` (skupiska dekoracji i kompozycje ruin, bez kolizji), `campaign.ts` (`endSlotRun`: koniec runu w slocie, rekordy).
- `ui/` — `theme.ts` (wspólny styl: kolory akcentów, odstępy, rozmiary HUD, `tile`, `meter`, `iconSlot`, `cornerTag`, `label`), `widgets.ts` (panel, dim, bar, Menu, slot — w stylu z theme.ts), `hud.ts` (tylko rysowanie + stan animacji `HudAnim`), `levelup.ts`, `cards.ts`, `items.ts` (LootView, InventoryView),
  `shop.ts` (ShopView), `anvil.ts` (AnvilView z panelem Kuźni: etap `forge`, animacja młota), `expedition.ts` (ExpeditionMapView), `collection.ts` (zakładki: karty i bany, unikaty, sekrety, bestiariusz, osiągnięcia), `meta.ts` (ekran Rozwój), `synergies.ts` (ekran synergii, lista w HUD, ikony tagów), `powers.ts` (wybór mocy bossa), `pacts.ts` (ekran paktów), `game-screen.ts` (stany: play/levelup/cards/power/loot/inventory/shop/anvil/synergies/pause/map/end; `saveSlot`, `overlayReturn`), `skills.ts` (`drawSkills`: opisy umiejętności na wyborze bohatera i w pauzie), `menus.ts` (`MainMenu`, `SlotScreen` per tryb: Ekspedycja i Endless, `HeroSelect` — zakładki Ogólne/Umiejętności/Zasób, przyciski Wstecz i Start, `RecordsScreen`), `whats-new.ts` (ekran nowości po aktualizacji: `NOTES`, `pendingNews`).
- `game/tutorial.ts` (samouczek: kroki `STEPS`, teksty per urządzenie), `data/unlocks.ts` (odblokowania: `UNLOCKS`, `grantUnlocks`, `heroUnlocked`, `maxTier`),
  `dev/bot.ts` (bot testowy, tylko serwer deweloperski) i `scripts/bot.cjs` (uruchamia bota w Playwright i wypisuje raport).

## Stan (wersja 0.30.0)

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
  - 0.23.8: siła gracza (`dmgStep` → powerMul → HP wrogów) i kradzież życia znowu liczą całe trafienie z nadwyżką, jak do 0.23.2
    (bez nadwyżki gra była za łatwa); tabela obrażeń i DPS w statystykach dalej tylko zadane obrażenia.
  - 0.23.9: Święte światło Aurela (i ewolucja) to nowy wzorzec `nova`: pierścień światła rozchodzi się z bohatera
    (`NOVA_R`, `NOVA_T`, `NOVA_STEPS` w systems/weapons.ts), każdego wroga trafia raz i odpycha; wcześniej kopia Pioruna łańcuchowego.
  - 0.23.10: krok w stronę 32-bit: światło addytywne (`lit`, `glowSprite` w game/render.ts, tryb 'lighter', cache poświat per
    kolor i promień): ciepłe światło wokół bohatera, poświaty kryształów, pocisków gracza i wrogów; wyłączane przez Efekty:
    oszczędne (`lowFx`). UI: faza paneli (jasna góra, cień dołu), połysk i cień pasków, wklęsłe gniazda, plakietki z gradientem,
    karta bohatera w złotej ramce. Koncepcja pełnego 32-bit (makiety) na płótnie Artifact „Pixel Survivors – nowy wygląd”.
  - 0.23.11: przejście na 32-bit, etap 1. Płótno świata `WORLD_RES` = 2 (core/renderer.ts, transformacja ×2: rysowanie dalej
    w pikselach logicznych). Painter z `res` (gfx/painter.ts): kształty liczone na drobnej siatce, obrys i faza 1 piksel
    obrazu, `dot` = jeden drobny piksel; `canvasRes` + `register` w sprites.ts: rozmiar logiczny = obraz / res. Wszystkie
    postacie (gfx/actors.ts, `HI` = 2) rysowane w 2×, bohaterowie i podstawowi wrogowie z detalami (`Detale 32-bit`).
    Dalej: teren, pociski, efekty, ikony, bossowie w 32-bit.
  - 0.23.12: grafika 32-bit, etap 2. Painter: dithering przejść w `sphere` (Bayer 4×4), światło krawędzi i ciemny kolorowy
    obrys w `outline` (tablica `SHADE`: ciemniejszy/jaśniejszy odcień koloru), `thin` (linia 1 piksel obrazu). Wszyscy
    bohaterowie, wrogowie, przywołańcy i boss przerysowani od nowa (helpery `legs`, `eyeAt`). `HI` w painter.ts: świat,
    obiekty, pociski, kryształy, skrzynie i efekty w 2×; `blit` dla kafelków; kafelki podłoża z drobnym szumem i źdźbłami.
    Ikony interfejsu zostają przy res 1.
  - 0.23.13: ikony (ICON_FNS) też w `HI`; jednolity interfejs: stalowe ramki paneli z fazą (domyślny akcent `C.dgray`),
    złote podświetlenie zaznaczonej pozycji menu, przycisków i zakładek (wcześniej niebieskie), gniazda w kolorze stali.
  - 0.23.14: kolory jakości jak w WoW (data/items.ts RARITIES): Zwykły szary, Magiczny zielony, Rzadki niebieski, Epicki
    fioletowy, Legendarny pomarańczowy, unikaty złote (`UNIQUE_COLOR`, wcześniej beżowe); karty Złote w `C.gold`;
    karta awansu „Nowa broń/pasywka” biała (nie myli się z Magicznym).
  - 0.23.15: gładsza grafika. Czcionka wektorowa Nunito (@fontsource/nunito 700/800, OFL; core/font.ts rysuje fillText,
    pomiary z pamięcią podręczną `resetFontCache` po wczytaniu czcionki w main.ts; `drawLabel` z obrazów 4×). `HI` = 3
    (postacie, ikony, świat, przedmioty), płótno świata `worldRes` 3 (Efekty oszczędne: 2, `Renderer.setWorldRes`).
  - 0.23.16: spójna scena. Wspólne światło: korekta barwna biomu (`Biome.ambient`, mnożenie `GRADE` w game/render.ts) na całym
    świecie, potem światło bohatera (addytywne); napisy i znaczniki po korekcie. Obrys postaci w ciemnym odcieniu własnego
    koloru (bez czerni), światło krawędzi tylko u góry, miękkie cienie (gradient). HUD lżejszy: puste gniazda przygaszone,
    półprzezroczyste karta bohatera, zegar i plakietki.
  - 0.23.17: bohater wtopiony w scenę: znacznik gracza jako cienka elipsa na ziemi, rdzeń trafienia tylko przy pocisku bliżej
    niż `CORE_SHOW`, pasek HP pod postacią tylko po obrażeniach, tarcza jako delikatna poświata, światło bohatera od stóp.
    Czcionka mniejsza (8,5 px, cieńszy obrys); napisy w gniazdach HUD w SMALL; banery (`sc` 1,4) i podpowiedzi (`HINT_SCALE`) mniejsze.
  - 0.23.18: jedna wielkość piksela w świecie. Prymitywy renderera (`rect`, `circle`, `line`, nowe `ellipse`) w świecie trzymają się
    siatki płótna świata (`worldRes`, jak sprite'y), w UI zostają w pikselach logicznych (okrąg w UI na siatce bufora K).
    Painter: `soft` (miękka plama z brzegiem Bayera), `spot` (detal 2×2 piksele obrazu), `stroke` (linia 2 piksele obrazu);
    dekoracje i efekty w world.ts używają `spot`/`stroke` zamiast `px`/`line`. Plamy podłoża i kafelków bez grubej szachownicy,
    przerysowane osłony terenu, kolce, kwiaty, strzały; cząsteczki 2/3 rozmiaru; gładki księżyc w menu.

  - 0.23.19: czcionka pikselowa Pixelify Sans (@fontsource/pixelify-sans 500/700, OFL, z polskimi znakami) zamiast Nunito (od 0.25 Jersey 10);
    core/font.ts: `FONT_PX` 9, waga 500 (tytuły `scale` ≥ 2: 700). Układ ekranów bez zmian, napisy się mieszczą.
- Etap 0.24 (przebudowa oprawy: ruiny w lesie, lekki HUD):
  - HUD (ui/hud.ts + ui/theme.ts): cienki pasek XP (`UI.xpH`), karta bohatera 108×31 (portret, życie z wartością i śladem
    utraconego życia, zasób, LV, akt/głębia drugorzędnie), pod nią wskaźniki Szału i błogosławieństw z czasem i synergie jako
    ikony 16 px (punkty w rogu, progi kreskami, opis pod myszą). Środek: zegar, jeden pasek celu z licznikiem („110 / 680”,
    „Przetrwaj do 03:00”), etykiety wydarzenia i kombo (kombo pojawia się i wygasza). Prawa: zabójstwa i złoto w jednym
    wierszu, minimapa 70×44 (gracz krzyżykiem, elity/cele/skrzynie kwadratami z obwódką), zadanie. Lewy dół: gniazda 18 px,
    poziom w rogu (`cornerTag`), puste gniazda bez ramek. Środek dołu: pasek Q/E/Spacja/R (24 px; dotyk: dawne pozycje
    `abilitySlotPos`), odnowienie przyciemnieniem i licznikiem, jeden rozbłysk gotowości (`READY_FLASH`). Animacje w `HudAnim`
    (WeakMap per run, czas z `performance.now`, bez wpływu na symulację). Diagnostyka: F3 / ` przełącza `GameScreen.diag`
    (nie zapisywane); klawisze F4/F6/F7 nadal wymagają `settings.debug` („Tryb debug”).
  - Okna i przyciski (`widgets.ts`): płaskie wypełnienie, jedna cienka ramka, bez połysku i rombów w rogach; podpowiedzi w grze
    jako lekka płytka.
  - Teren: `gfx/ground.ts` buduje podłoże z pól fbm (ton trawy, ziemia `DIRT`, ścieżki `PATH`, posadzka `PAVE` z płytami
    `STONE_W`×`STONE_H`, mech) w kawałkach `CHUNK` = 192 px logicznych (do `BUILD_PER_FRAME` na klatkę, LRU `CACHE_MAX`),
    kolory ziemi i kamienia mieszane z trawą (stonowane); `Biome.dirt`, `Biome.paving`. `game/scenery.ts`: kompozycje
    (`LM_CELL`, `LM_CHANCE`) i skupiska dekoracji (`RECIPES`, nic na ścieżkach). Wszystko bez kolizji. Kafelki `tile<b>_<v>`
    zostają tylko w tle menu; usunięte plamy `patch`.
  - Walka: wrogie pociski z jasnym rdzeniem i krótkim śladem (dwa bledsze odbicia, pomijane przy 700+ pociskach), tarcza i Szał
    jako jeden pierścień, efekt `fade` (sylwetka zabitego wroga blednie i unosi się; `Fx.sprite`), liczby obrażeń: zwykłe 0,75,
    krytyki większe z wyskokiem (`DmgNum.big`, `drawLabel(..., scale)`), bez nakładania (`Run.numberNear`), puls poświaty
    kryształów i pierścień przy zebraniu.

  - 0.24.1: płynność. Kawałki podłoża budują się po trochu (`Job`: pola na siatce co `FS` = 2 px, potem wiersze pikseli,
    na końcu źdźbła) w budżecie `GROUND_BUDGET` ms na klatkę, z wyprzedzeniem (pierścień tuż poza ekranem, `prefetch`);
    tylko na starcie poziomu (nic gotowego na ekranie) budżet jest duży. Skupiska dekoracji liczone raz na komórkę
    (`clusters` w game/scenery.ts). Sprite'y biomu, kompozycji, wszystkich wrogów i bohatera budowane z wyprzedzeniem
    (`queueWarm` / `warmStep`, `WARM_BUDGET` ms na klatkę). Wcześniej nowy kawałek terenu kosztował 30–110 ms w jednej klatce.
- Etap 0.25 (czytelność i menu):
  - Czcionka Jersey 10 (@fontsource/jersey-10, jedna grubość 400, `FONT_PX` 11,5).
  - Życie w HUD: przy trafieniu pasek błyska na biało, jasny ślad (`UI.lifeTrail` = kremowy) zostaje 0,22 s i szybko się
    zwija, obok karty pojawia się utracona liczba („-12”, sumowana w serii, `HudAnim.hitAmt`). Mały pasek pod bohaterem tylko
    przez `HP_BAR_SHOW` s po trafieniu (stale poniżej 30% życia).
  - Wybór bohatera: zakładki klikane (Ogólne, Umiejętności z pełnymi opisami, Zasób; lewo/prawo przełącza), przyciski
    „Wstecz [Esc]” i „Start [Enter]”; klik w panel szczegółów już nie startuje gry.
  - Pauza: prawa kolumna z zakładkami Postać / Umiejętności (lewo/prawo albo klik): poziom, odnowienie lub ładunek R, opis,
    ewolucja z wymaganą synergią, pasywka i zasób.
  - Mapa Ekspedycji: tło z podłoża biomu aktu (gfx/ground.ts), kropki postępu aktów, plakietki stanu (HP, złoto, łup, mapy,
    błogosławieństwo), legenda rodzajów węzłów, grubsze ścieżki, puls dostępnych węzłów, podpis wybranego, przyciski
    Plecak / Menu / Wyrusz (`BTNS`).
  - Rozwój: następny węzeł gałęzi wymaga poprzedniego na poziomie co najmniej `ceil(max × BAL.meta.unlockFrac)` (0,5),
    `prevNode`, `unlockLevel` w data/meta.ts; kafelek pokazuje „wymaga 3/5”, opis — „Odblokowanie: nazwa poziom/wymagany”.
    Już kupione węzły zostają (zasada dotyczy tylko zakupu).
  - 0.25.1: wydajność okręgów (`Renderer.circle`): promień powyżej `CIRCLE_BITMAP_MAX` (24 px logiczne) rysowany wprost łukiem
    (fale Aurela, aury, strefy, efekty `ring` rosnące co klatkę), mniejsze z bitmap budowanych przez ImageData z limitem
    `CIRCLE_CACHE_MAX`. Wcześniej każdy nowy promień budował bitmapę piksel po pikselu (Aurel: do 367 ms na klatkę).
  - 0.25.2: mapa Ekspedycji pokazuje „esencja +X%” (= `ex.bonus` × `BAL.expedition.rewardEssence`, z podpowiedzią pod myszą)
    zamiast mylącego „łup +X%” (`ex.bonus` nie zwiększa łupu, tylko esencję na koniec wyprawy); „mapy N” obok nazwy biomu.
- Etap 0.26 (Szczęście): `Stats.luck` to teraz Szczęście w ułamku (0.15 = +15%), a dawne „+1 karta przy awansie” to
  `Stats.choices` (Koniczyna, Medal, synergia Mistrz, błogosławieństwo Fortuna Ekspedycji; awans: 3 + choices, najwyżej 4).
  `Run.luck()` = `stats.luck` + flaga `itemLuck` (afiks Fortuna, karty, nagrody map) — jedno źródło dla: rzadkości przedmiotów
  (`rollRarity`), szczęśliwego trafu i unikatów, sklepu, szansy na skrzynię ze zwykłego wroga (× (1 + szczęście ×
  `BAL.luckDrop`)), rzadkości kart (`BAL.luckCards`: złote +, pryzmatyczne ×), jakości ulepszeń broni (`rollQuality`,
  `BAL.weaponQuality.luckMul` 1.5). Nowa pasywka Podkowa (`horseshoe`, +15% na poziom, ikona `pi_horseshoe`). W pauzie
  wiersze Szczęście i Karty przy awansie; opis w Pomocy (Rozgrywka).
  - 0.26.1: numer wersji w prawym dolnym rogu menu głównego (`__APP_VERSION__` z package.json przez `define` w vite.config.ts,
    deklaracja w src/env.d.ts) — łatwo sprawdzić, czy przeglądarka wczytała najnowszą grę.
- Etap 0.27 (faza 1 planu): tryby tylko `'endless' | 'expedition'` (`Mode` = `SlotMode`). Usunięte: Hardcore (tablica `board`,
  stan `cleared`, `nextLevel`), Trening, Szybki run (`BAL.quick`), Głowy bossów (`BAL.rush`, `rushBest`, kod Konami), Wyzwanie dnia
  (`data/daily.ts`, `save.daily`). `HeroRecord`: bestTime/bestKills/bestLevel/bestEndless/bestExpedition/expeditionWins.
  Zapis v8 (migracja 7 → 8 porzuca dane usuniętych trybów, `notice` gdy był slot Hardcore, `seenVersion: '0.26'`).
  Endless: meta-bonusy Rozwoju i esencja × `BAL.meta.endlessEssenceMul` (0.6); Pustka w Endless przy Pakcie `BAL.voidPact`+ albo po
  `BAL.voidEndlessTime` (1200 s). Bez skazy (`featsOnWin`): boss aktu albo boss Endless przy `runHits === 0`. Asceta: akt 2 albo 600 s Endless.
  Osiągnięcie `daily` → Wayfarer (akt 1 Ekspedycji, to samo id). i18n w obie strony: `core/i18n-pl.ts` (EN → PL, dokładnie i wzorce `{}`);
  napis ze słownika PL w trybie angielskim zostaje bez zmian, wstawki tłumaczone osobno. Ekran What's new (`ui/whats-new.ts`):
  raz po zmianie major.minor (`seenVersion`), nowa gra oznacza wersję od razu; zamyka go dowolny klawisz (`Input.anyPressed`), klik albo dotyk.
- Etap 0.28 (faza 2 planu): samouczek i stopniowe odblokowania. Zapis v9: `unlocks` (id z data/unlocks.ts) i `tutorialDone`;
  migracja 8 → 9 daje wszystko graczowi, który już grał (rekord czasu albo osiągnięcie), nowy zapis zaczyna od zera.
  Odblokowania: start Kestra i Borgun + Ekspedycja na trudności Zwykłej; pierwszy boss → `forge` (kowadła na mapie, przycisk w sklepie;
  bez niego `rollActMap(..., noForge)` zamienia kowadła na obozy) i `tier1`; akt 1 → Ignara, akt 2 → Morwen; wygrana Ekspedycja →
  `endless`, `pacts`, `tier2`; 4 osiągnięcia → Vesper; 2 wygrane → Aurel; wygrana na Rzadkiej → `tier3`. `ExpeditionState.maxTier`
  i `noForge` przenoszą stan do wyprawy (aktualizowane od razu po odblokowaniu). `GameScreen.unlock` (po bossie: wzrost `run.bossKills`,
  po akcie, po wygranej, po końcu runu): zapis, `save.notice`, baner i podpowiedź po kolei, lista na ekranie końca.
  Zablokowane: Endless w menu (opis z warunkiem), bohaterowie na wyborze (przygaszeni, warunek zamiast roli, przycisk Locked),
  Pakty, poziomy trudności na mapie (locked). Kolekcja: zakładki Unikaty, Sekrety, Bestiariusz, Osiągnięcia, Wyczyny od pierwszej rzeczy.
  Samouczek (`GameScreen(..., tutorial = true)`, Kestra w trybie endless): `run.scripted` wyłącza spawner, wydarzenia, zadania
  i wydarzenia poziomu; 8 kroków (ruch, atak, awans, Q/E, unik, R, skrzynia, mały boss), teksty dla klawiatury, pada i dotyku
  (`input.lastDevice`); bez zapisu slotu, esencji, rekordów i odblokowań; śmierć = wskrzeszenie. Pauza: Wznów, Ustawienia, Skip tutorial.
  Koniec/pominięcie → `tutorialDone` i wybór bohatera Ekspedycji. Pierwsze uruchomienie (`!tutorialDone`) zaczyna od samouczka;
  powtórka: Ustawienia → Ogólne → Replay tutorial. HUD w samouczku bez licznika bossa.
  Bot testowy: `?bot=endless|expedition|tutorial` (src/dev/bot.ts, tylko `import.meta.env.DEV`), `scripts/bot.cjs` / `npm run bot`.
  Tłumaczenie: zdania tłumaczone też osobno (kandydat obok podziału na separatorach), lista „A, B” we wstawce wzorca EN → PL.
- Etap 0.29 (faza 3 planu): czytelność i dostępność.
  - Rozmiar tekstu: `Settings.textLarge` (domyślnie na dotyku), `core/font.ts` `setTextSize`, `DESC` (opcje rysowania),
    `descS()` (skala: 0.75 albo 1), `descLH()` (odstęp linii 9 albo 11). Teksty opisowe używają DESC: umiejętności (`drawSkills`),
    strony Umiejętności i Zasób na wyborze bohatera, Arsenał, ekran Bronie i pasywki z Żywiołami, modyfikatory i podpowiedzi mapy,
    opis przedmiotu w plecaku, pauza (Umiejętności), Synergie, Pomoc; karty awansu przy dużym tekście nie zmniejszają opisu
    (podpowiedź ustępuje, w ostateczności „...”). Drobne etykiety HUD zostają 0.75.
  - Przewijanie: `ui/widgets.ts` `Scroll` (`update` z obszarem, `begin` → przesunięcie, `end` z wysokością treści i paskiem),
    `Input.scroll` (kółko myszy, przeciąganie palcem poza rozgrywką), akcje `pageUp`/`pageDown`, prawa gałka pada.
  - Ograniczenie błysków: `Settings.reduceFlash`, `run.reduceFlash`, `Run.blink(okres, wł.)` zamiast `run.step % n < m`
    (przy ograniczeniu zawsze włączone: zapowiedzi ataków świecą stale), bez białych błysków trafień i znikania, gracz przy
    nietykalności półprzezroczysty zamiast migać; HUD: bez błysku paska XP i HP, plakietka LV bez migania.
  - Ostrzeżenie o błyskach przy pierwszym uruchomieniu (`ui/flash-warning.ts`, `Settings.flashWarned`) z przełącznikiem.
  - Zmiana klawiszy: `core/input.ts` `FIXED` (strzałki, Enter, Esc, Tab, cyfry, Spacja = confirm, R = reroll, debug) i `REBIND`
    (akcja → domyślny kod), `setBindings`, `keyOf`, `keyName`, `actionKey`; `Input.capture` przechwytuje następny klawisz.
    Ekran `ui/controls.ts` (Ustawienia → Ogólne → Controls): zamiana z akcją, która miała ten klawisz; Reset to defaults.
    `Settings.keys`. Klawisze w HUD, opisach umiejętności (`skillKey`) i samouczku (`{q}`, `{move}`…) z przypisań.
  - Pad: RT = bronie i pasywki, prawa gałka (klik) = kowadło; mapa: LB/RB (R/X) zmienia trudność; Kuźnia: góra/dół + RB/X
    przełącza opcję (`optSel`). Wszystkie menu mają odpowiedniki klawiszy (strzałki, Enter, Esc, Tab).
  - Mapa Ekspedycji: klik w węzeł tylko zaznacza (`ExpeditionMapView.update`), wejście przyciskiem Wyrusz albo Enterem.
  - 0.29.1 (grafika): sieć Kestry (`drawNet` w game/render.ts: rozwinięcie, ukośne oczka z linki, węzły, lina z obciążnikami),
    minimapa (strzałka gracza w kierunku patrzenia, narożniki widoku, kształty znaczników: boss romb, elity i przedmioty
    kwadraty, obiekty kółka; tło 0.88), wybuch (`gfx/world.ts boom`: chmura kul ognia z iskrami zamiast jednej sfery),
    deszcz strzał (spadające strzały z lotkami w cyklach 0.35 s, pył przy wbiciu). Bot `bot=gallery`: każdy bohater
    używa Q, E, uniku i R w tłumie, `scripts/bot.cjs` robi zrzut po każdej (gra stoi do zrzutu: `Bot.frozen`), /tmp/bot-shots/gallery.
  - 0.29.2: ikona Sieci (`ab_k_net`, `netIcon` w gfx/icons.ts: złapany szlam pod jasną linką, obciążniki) i Lodowej sieci
    (`ab_k_net_evo`, niebieski szlam, kolory lodu); sieć w grze w tych samych kolorach (szara linka).
  - 0.29.3: przegląd ikon (arkusz wszystkich ICON_FNS w powiększeniu): przerobione przedmioty (hełm, kaptur, napierśnik,
    kolczuga, szata, rękawica, karwasz, buty, skrzydlaty sandał, sygnet, naszyjnik, maska demona, płaszcz, pazury, nagolennik,
    obrączka), bronie (pocisk, kostur, dusze, orbita, bumerang, laser, miny), umiejętności (sztylet Vesper `dagger`, Krok cienia,
    Zniknięcie, Anioł stróż, Szarża, Uderzenie, Cień, Mignięcie, Wskrzeszenie), pasywki (skrzydło `wing`, Duplikator, Furia,
    Magnes), karta Szklane działo, zwój Talizman. Zasada: 3 tony z rampy, światło z lewej góry, detale `thin`/`spot`/`stroke`.
  - 0.29.4: poprawka — przy podmianie ikon w 0.29.3 zginęły `it_ring`, `it_greaves`, `it_band` i `it_charm` (gra przerywała się
    błędem „Brak sprite'a”, gdy wypadł taki przedmiot); przywrócone. Bot (endless/expedition) wykrywa takie błędy w raporcie.
  - Nie zrobione: szersza logiczna rozdzielczość na ekranach 20:9 (telefon ma pasy po bokach, interfejs nie zajmuje więcej miejsca).
## Plan dalej (przed wydaniem)

Stan wyjściowy: wersja 0.26.1 (numery faz przesunięte za wersje 0.24–0.26 z innej sesji). Plan uzgodniony z autorem; kolejność faz = kolejność wersji.

### Zasady na cały plan
- Nowe teksty w grze pisane po angielsku, polski jako tłumaczenie (oba języki zawsze kompletne). Język komentarzy w kodzie bez znaczenia.
- Narzędzia deweloperskie (F3, F4, F6, F7, podgląd balansu) zostają w grze; znikają dopiero w wersji wydawanej (faza 6).
- Kuźnia bez zmian.
- Wszystko od razu pod telefon i Steam: pad, różne rozdzielczości, okno i pełny ekran, zapis w jednym pliku (Steam Cloud), osiągnięcia gotowe do przypięcia pod osiągnięcia Steam.
- Grafika proceduralna (w kodzie); wyjątek: dźwięk może korzystać z plików (faza 5).

### Faza 1: porządki w trybach, język i wersja (v0.27) — GOTOWE (0.27.0)
- Usunięcie trybów: Kampania Hardcore, Trening, Szybki run, Głowy bossów i Wyzwanie dnia znikają z menu, kodu, rekordów, pomocy i zapisu. Zostają Ekspedycja i Endless.
- Rozwój (drzewko bohatera) działa też w Endless, Endless daje esencję (mniej niż Ekspedycja, zależnie od czasu przetrwania). Zmienić opisy „Endless bez Rozwoju”.
- Sekrety przenoszone, nie usuwane:
  - Pustka otwiera się w Ekspedycji i w Endless (np. Pakt 5+ albo określony czas);
  - Asceta: zamiast „2. poziomu kampanii” np. akt 2 albo 10 minut w Endless;
  - wyczyn Bez skazy: zamiast „3 poziomów Hardcore” wygrana Ekspedycja albo odpowiednik w Endless.
- Zamienniki osiągnięć przypiętych do usuwanych trybów (np. za Wyzwanie dnia), żeby karty, które odblokowują, dalej były do zdobycia.
- Kod Konami w menu: usunąć (otwierał Głowy bossów).
- Tłumaczenie w obie strony: stare teksty PL→EN jak dziś, nowe EN→PL.
- Migracja zapisu z numerem wersji: zapisy usuniętych trybów bezpiecznie porzucone, cały postęp zostaje.
- Ekran „What's new” po aktualizacji (numer wersji w menu jest od 0.26.1) (raz, zamykany jednym klawiszem albo dotknięciem).

### Faza 2: samouczek i stopniowe odblokowania (v0.28) — GOTOWE (0.28.0)
- Samouczek przy pierwszym uruchomieniu: interaktywny, 2–3 minuty, dopasowany do klawiatury, pada albo dotyku. Kolejno: ruch i automatyczne strzelanie; kryształy i pierwszy awans; Q i E; unik z nietykalnością; ultimate; skrzynia i założenie przedmiotu; mały boss. Potem przejście do pierwszej Ekspedycji. Można pominąć i powtórzyć z Ustawień.
- Odblokowania (zaakceptowane), każde z banerem „Unlocked: …” i krótką podpowiedzią:
  - start: Ekspedycja, akt 1, dwóch bohaterów;
  - pierwszy pokonany boss: kowadło i kuźnia, trudność Magic;
  - ukończony akt 1: kolejni bohaterowie (za wygrane i osiągnięcia);
  - pierwsza wygrana Ekspedycja: Endless, Pakty, trudność Rare;
  - wygrana na Rare: trudność Nightmare;
  - Kolekcja: zakładki pojawiają się, gdy jest w nich pierwsza rzecz.

### Faza 3: czytelność i dostępność (v0.29) — GOTOWE (0.29.0), poza szerszym interfejsem na 20:9
- Tekst czytelny na PC i telefonie (czcionka Jersey 10 od 0.25; sprawdzić czytelność na telefonie):
  - opcja Text size (Normal / Large), domyślnie Large na dotyku;
  - ważne opisy bez pomniejszonego tekstu, w zamian strony albo przewijanie (Arsenał, szczegóły zasobu, karty, panel mapy);
  - na małych ekranach interfejs zajmuje więcej miejsca i pokazuje mniej naraz;
  - przegląd każdego ekranu na zrzutach: PC, telefon 20:9, tablet.
- Dostępność:
  - ostrzeżenie dla osób wrażliwych na błyski przy pierwszym uruchomieniu i opcja ograniczenia błysków;
  - zmiana przypisania klawiszy;
  - pełne sterowanie padem we wszystkich menu (Steam Deck);
  - zostają: kształty żywiołów, wyłączanie wstrząsów ekranu, autocelowanie.

### Faza 4: różnorodność i uczucie mocy (v0.30–0.33) — v0.30 GOTOWE (wrogowie i minibossowie), v0.31 GOTOWE (ewolucje), v0.32 GOTOWE (bohater Takezo), v0.33 GOTOWE (ataki bossów, uczucie mocy, podsumowanie) — FAZA 4 ZAKOŃCZONA
- 0.31.0 — ewolucje (prośba gracza): `WeaponDef.evolves` (lista ścieżek; pierwsza = podstawowa), `ALT_EVOS` w data/weapons.ts
  (wariant = kopia ewolucji podstawowej z innymi statystykami / `hybrid`, ikona `ic_<id>` = ikona ewolucji podstawowej
  przemalowana `ramp`, żywioł jak broń bazowa). Każda pasywka ewoluuje ≥ 2 bronie (`passiveEvolves(id, hero?)` w
  systems/levelup.ts). Opcja 'evolve' ma `id` = id ewolucji (kilka ścieżek = kilka kart). Ewolucja pasywki: `PassiveDef.evo`
  (stats), opcja 'passiveEvolve' gdy maks. poziom + posiadana broń ewoluowana tą pasywką; `PassiveInst.evo`, zapis jako
  [id, level, 1]; ikona `pi_<id>_evo` (gwiazda `evoStar`), `passiveIcon(p)`. Nowe pasywki `ember` (elemPower), `whetstone`
  (critMult). Księga ewolucji `ui/codex.ts` (menu główne): strony Bronie, Pasywki, Fuzje, Umiejętności, Ulepszenia.
  Raport bota: `build` (bronie i pasywki, `*` = po ewolucji).
- 0.30.0 — wrogowie biomów (data/enemies.ts, zachowania w `updateBiomeEnemy` w systems/enemies.ts, parametry `BAL.biomeEnemies`,
  skład `BIOME_WAVES` w data/waves.ts dokładany przez `currentMix(t, biome)`):
  `boar` charger (stoi i miga `chargeWarn`, potem jazda `dvx/dvy`), `thornling` mortar (`run.strikes` z `seed: true` i `r`,
  zielony wybuch), `toad` leaper (`dvx/dvy` start, `tx/ty` cel, `e.z` wysokość łuku, pierścień przy lądowaniu), `lurker` burrow
  (`hidden`: poza siatką kolizji i bez obrażeń; fazy 0 powierzchnia / 1 pływa / 2 bulgocze w `tx/ty`), `salamander` flamer
  (stożek `shootA` ± `flameCone`, wachlarz pocisków z `life` 0.75 s), `scorpion` sniper (celuje, kąt blokuje się w 40% czasu),
  `splitter` (po śmierci 2× `splitling`, run.ts killEnemy), `mirror` orbiter (krąży, cięcie wzdłuż linii przez gracza).
  Pola wroga: `z`, `hidden`, `tx`, `ty`. Zapowiedzi w `drawTell` (game/render.ts), sprite'y w gfx/actors.ts (domyślnie w prawo).
  Kontakt rani tylko gdy `!hidden && z < 4`. `OWN_MOVES` wyłącza dla nich szarżę elity.
- 0.32.0 — bohater Takezo (na wzór Musashiego): umiejętności 'overhead' (Q, cios w punkt `dist` przed sobą), 'flurry'
  (E, `slashes` × (1 + szybkość ataku + rytm) cięć w stożku), 'iai' (R, doskok `dist`, po 0.5 s cięcie wzdłuż trasy
  `alongPath`, zużywa rytm), pasywka 'parry' Mikiri (0.32.1: `Run.parryChance`/`tryParry` w hurtPlayer, BAL.resource.parry, flaga `passive.parry`; pocisk przekazany do hurtPlayer wraca; 0.32.2: twardy limit 35% razem z kartami, nietykalność po odbiciu 0.1 s, Otwarta garda bez kumulacji — test na 60. poziomie: przepuszcza ~64% trafień, stara wersja ~35–49%), zasób 'rhythm' (BAL.resource.rhythm;
  `rhythmAtk` dodawane w `effectiveStats` broni bez przeliczania statystyk, `spendRhythm`, `rhythmGain`). Broń `katana`
  (cleave, amount 2 = przód i tył), ewolucje `katana_evo` (fury), `katana_sharp` (whetstone, ALT_EVOS). Ikony w
  gfx/hero-icons.ts (`katana`, `slashArc`), sprite `takezo` w gfx/actors.ts. Karty h_t_*, drzewko takezo (Earth/Water/
  Fire/Void), odblokowanie 'hero:takezo' (rekordy; `grantUnlocks` także przy wczytaniu w main.ts). Lista bohaterów:
  ROW_H 27. Tłumaczenie: `toPolish` dzieli polskie szablony z angielskimi wstawkami; ui/meta.ts tłumaczy kawałki osobno.
- 0.33.0 — bossowie: trzeci atak w każdej fazie (`alt === 2` w BOSS_STYLES), ataki po kolei (`Enemy.nextAlt`), nazwa nad
  bossem `BOSS_TELL` s przed atakiem (`BOSS_NAMES`, `Enemy.told`), zapowiedź wg `BOSS_TELLS` ('aim' / 'ring' / 'player')
  w render.ts (`bossStyle`). Uczucie mocy: `sfx` 'crit' / 'streak' / 'evolve', efekt krytyka co `BAL.streak.critFxEvery`
  kroków, liczby z '!', `Run.celebrate` (ewolucje, fuzje, ewolucje pasywek), seria zabójstw `onStreakKill` (BAL.streak),
  elity i Szczęśliwy traf. Podsumowanie: zakładka Highlights (`renderHighlights`), `Run.bestCombo/bestStreak/maxHit`
  (w snapshocie `highlights`), rekordy `HeroRecord.bestDps/bestCombo/bestStreak`, porównanie z `recStart`.
- Minibossowie biomów: `boarking`, `toadqueen`, `sandtyrant`, `shatterknight`, `voidprism` (`BIOME_MINIBOSS` wg biomu),
  zachowanie 'warden' z własną listą `MINIBOSS_ATTACKS[id]` (4 ataki; w szale drugi atak `(pick + 2) % n`). Skok Matrony
  w `updateWarden` (łuk `miniLeapH`, pierścień przy lądowaniu), zapowiedź szarży/skoku w `drawTell` case 'warden' (także
  Strażnicy lochów). Pojawianie: `updateMiniboss` (systems/spawner.ts) — Ekspedycja: mapa elit (`eliteMul < 1`) przy
  `miniAt` celu, raz (`run.minibossDone`); Endless: `run.minibossT` (`miniFirst`, potem `miniEvery`). Elita bez cech
  (`elite: []`): skrzynia, karta, XP; HP × `powerMul^(bossPowerExp-1)`, po 300 s rośnie. Pryzmat pęka na 2 Rozszczepieńce.
- 0.30.1: obóz (węzeł 'rest') losuje `CAMP_BUFFS` (data/expedition.ts) do `ExpeditionState.camp`: buff na jedną mapę
  (Run.startLevel jak błogosławieństwo, zdejmowany w GameScreen.onLevelCleared), plakietka na mapie. Pełne efekty wyłączone
  na stałe (`run.lowFx = true` w GameScreen, bez opcji Efekty; `settings.lowFx` decyduje już tylko o gęstości świata ×2/×3).
  Ikony: `Painter.centerMirror()` (wołane dla ICON_FNS w sprites.ts) przesuwa prawie symetryczny rysunek tak, by oś lustra
  była na środku — pamiętaj, że `line`/`px` w x zajmują x..x+1 (środek x+0.5), a `disc`/`sphere`/`poly` liczą wokół x.
  `arrowHi` (gfx/icons.ts): strzała z wielokątów (Salwa, Grad strzał). Arkusz ikon: /tmp/claude-0/sheet.cjs.
- Bot: `bot=gallery foes=id,id` (zrzuty wrogów i zapowiedzi, wrogowie z 1e6 HP), raport runu ma `byId` (bestiariusz).
- Ok. 8 nowych wrogów (1–2 na biom), każdy z innym zachowaniem, zapowiedzią ataku i wpisem w bestiariuszu; grafika od razu w stylu 32-bit (Painter `HI`, detale jak w gfx/actors.ts).
- Jeden miniboss na biom w stylu Strażnika skarbca, z własnym zestawem losowych ataków (mapy elit i wydarzenie w Endless).
- Bossowie: 1–2 nowe ataki na fazę i lepsze zapowiedzi.
- Uczucie mocy: mocniejsze krytyki (dźwięk, błysk, wyróżnione liczby), chwila ewolucji (krótkie zatrzymanie, efekt, baner), wyraźniejsze zabójstwa elit, serie zabójstw i „Lucky find”.
- Podsumowanie runu z wyróżnieniami: najlepsza broń, rekord DPS, pobite rekordy, najdłuższe kombo.

### Faza 5: dźwięk i muzyka (v0.34) — część generowana GOTOWA (0.34.0), nagrania CC0 czekają na dostęp sieci
- 0.34.0: core/audio.ts — dźwięki broni `w_*` (`weaponSound` w systems/weapons.ts wg wzorca i pocisku), warianty wysokości
  (bez `STEADY`), limit głosów `MAX_VOICES` (licznik `voices`, `onended`), `IMPORTANT` = ważne dźwięki ponad limit i ducking
  (`sfx.duck` ustawiane przez music.ts). core/music.ts — motywy `THEMES` (menu = biome -1, biomy 0-4) i `bossTheme`;
  zmiana motywu od początku taktu. `window.__sfx` w DEV (test audio: kliknięcie odblokowuje kontekst).
- 0.34.1: karty pasywek przy awansie — `Option.evolves` (ikony [broń, ewolucja] z `passiveEvolves(id, hero)`), rysowane
  `drawEvoRow` w ui/levelup.ts zamiast napisu; Księga ewolucji w menu pauzy (CodexScreen z powrotem do GameScreen).
- Zablokowane: kenney.nl, opengameart.org, freesound.org (polityka sieci środowiska, 403). Po odblokowaniu: nagrania CC0,
  plik licencji, mp3/m4a obok ogg.
- Mieszanka nagrań CC0 (Kenney.nl, OpenGameArt, Freesound z filtrem CC0: uderzenia, wybuchy, interfejs, ambient biomów, motywy bossów) i ulepszonego dźwięku generowanego (bronie i efekty reagujące na grę: warianty wysokości, warstwy; muzyka narastająca z walką).
- Osobny dźwięk dla każdej broni, warianty, żeby się nie powtarzały; motyw menu, każdego biomu i osobne motywy bossów.
- Miks: ściszanie muzyki przy ważnych dźwiękach, limit dźwięków naraz, osobne suwaki efektów i muzyki.
- Licencje: plik z listą źródeł i licencji, wpis w napisach końcowych, formaty działające na iPhonie (mp3 lub m4a obok ogg).

### Faza 6: przygotowanie do wydania (v0.35, potem 1.0)
- Wersja wydawana bez narzędzi deweloperskich (zostają w wersji deweloperskiej).
- Automatyczny test brakujących tłumaczeń w obie strony (bot przechodzi grę i zgłasza napisy bez wpisu).
- Pełny test: Ekspedycja, akt 4, długi Endless (30+ min), samouczek.
- Lokalny dziennik runów (czas, przyczyna śmierci, DPS, wybory) i strojenie balansu na runach autora.
- Potem opakowanie: najpierw Android, potem iOS, na końcu Steam.

### Otwarte sprawy z ostatnich wersji (do wplecenia w fazy)
- Grafika 32-bit: obiekty map (kapliczki, portale, totemy, sekrety) i efekty (wybuchy, iskry) bez dorysowanych detali; mniej popularni wrogowie do dopracowania.
- Nowa broń Aurela (pierścień światła, 0.23.9): siła ustawiona na oko, do zmierzenia botem względem starej.
- Do decyzji autora: celownik myszy i ramki gniazd umiejętności (czy też je wyciszyć), pulsujące światło dla unikatów (pomarańczowy Legendarny i złoty Unikat są do siebie podobne).
- Balans: Ekspedycja (długość walk, nagrody węzłów), zasoby (Kombo, Wiara), zadania, moce bossów, Pustka; reakcje żywiołów (Przeciążenie, Wybuch toksyn) dominują obrażenia w późnej grze.
- Pomysły: więcej unikatów i receptur fuzji, kolejne sekrety i osiągnięcia.

## Testowanie

- Bot testowy (najpierw `npm run dev`): `node scripts/bot.cjs bot=endless runs=6 time=240 turbo=6` (wszyscy bohaterowie),
  `bot=expedition hero=borgun runs=1 time=5400 turbo=8 god=1 fresh=1` (cała wyprawa jako nowy gracz, lista odblokowań w raporcie),
  `bot=tutorial turbo=2` (samouczek), `lang=pl` (braki tłumaczeń po polsku), `shots=N` (zrzuty co N s do /tmp/bot-shots).
  Raport: runy, błędy, braki tłumaczeń (`missing`), najwolniejszy krok, odwiedzone stany. Kod 1 przy błędach albo brakach.
  W trakcie testu nie zmieniaj plików src (HMR przeładuje stronę i przerwie bota).
- Stan gry w konsoli przeglądarki (serwer deweloperski): `__screen()` (bieżący ekran, `.run`, `.state`).
- `npm run dev`, w grze F3 = debug, F4 = przyspiesz cel poziomu, F6 = awans, F7 = łup bossa (12% szans na unikat).
- Bez UI: moduły z serwera Vite w Playwright (`await import('/src/game/run.ts')`, `new Run(...)`, `run.update(1/60, wejście)`) —
  szybki test systemów (zasoby, zadania, moce, fuzje: `generateOptions`/`applyOption`, teren: `run.terrain`).
- Sklep bez grania: zapis w `slots.expedition` z otwartym węzłem sklepu (pole `shop`), potem Kontynuuj.
- Ekspedycja: zapis w `slots.expedition` z polem `expedition` (np. `path` przed bossem) pozwala od razu testować bossa i przejście aktu.
- Szczegóły sterowania i dodawania zawartości: README.md.
