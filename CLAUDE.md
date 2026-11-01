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
Stały krok symulacji 60 Hz. Zapis w localStorage z wersjami i migracjami (`core/save.ts`, SAVE_VERSION 10; nowe pola bez migracji dostają wartości domyślne w `loadSave`).
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

## Stan (wersja 0.64.0)

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
    (podpowiedź ustępuje, w ostateczności „...”). Drobne etykiety (HUD, klawisze, podpowiedzi, plakietki) mają `smallS()`:
    0.75 przy Normal, 0.85 przy Large. Nowa drobna etykieta: `scale: smallS()` i szerokość `textWidth(t) * smallS()`, nie 0.75.
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
- Narzędzia deweloperskie (F3, F4, F6, F7, podgląd balansu) zostają w grze; znikają dopiero w wersji wydawanej (faza 6):
  `npm run build:release` (vite `--mode release`) ustawia `__DEV_TOOLS__ = false` (src/env.d.ts) — nowe narzędzie testowe
  sprawdzaj przez `__DEV_TOOLS__`, żeby nie trafiło do wydania. GitHub Pages dalej dostaje zwykły `npm run build` (testy autora).
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
- 0.34.2: Rytm przebudowany (w grze nie ma walki „poza walką”, więc dawny zanik nie działał): budowanie → Przepływ
  (`Run.flowT/flowMax`, flaga `rhythm.flow`), potem od zera; Takezo tymczasowo w START_HEROES.
- 0.34.3 (przegląd UI): podpowiedzi w miejscu wskazanym przez ekran (`HINT_BOX` w ui/game-screen.ts, `HintBox` w ui/hints.ts:
  `y` górna krawędź albo dolna przy `up`); w grze nad paskiem umiejętności (dotyk: u góry). Wspólna oprawa kart
  `cardFrame` / `cardBadge` / `cardIcon` (ui/widgets.ts) dla awansu, kart, mocy bossa i kolekcji; zaznaczenie = złota
  obwódka + uniesienie. Porównanie przedmiotów: `compareItems` zwraca `StatDiff` (`stat`, `short`), karta przedmiotu
  pokazuje ↑/↓ przy wierszu bonusu (sumy w nawiasach tylko bez porównania). Pauza: zakładki Postać / Build / Umiejętności
  (`renderPauseBuild`), pełny rozmiar tekstu. Kolekcja: rząd zakładek (`tabRect`, `TAB_COL`). Tekst opisów domyślnie duży
  (migracja 9 → 10 ustawia `textLarge`). Tekst drugorzędny `C.lavender` zamiast `C.dgray` (kontrast ~4.9:1 na `C.navy`;
  `C.dgray` tylko dla wyłączonych przycisków i grafiki). Tytuły ekranów `C.yellow` (kolorowe tylko ze znaczeniem: rzadkość,
  wynik runu). Przyciski powrotu „Wstecz [Esc]”, etykiety „Nazwa (n) [klawisz]”.
- 0.34.4 (audyt, para Tech Lead + Game Designer): `Renderer.line` — grube / półprzezroczyste / długie linie to jeden wypełniony
  czworokąt (dawniej kwadrat w×w na każdy krok Bresenhama: 28% czasu klatki i kumulacja przezroczystości), przycinanie
  Liang-Barsky (`clipSegment`) do widoku, guard NaN; `Renderer.fan` (stożek Salamandry). Pomiar (Ignara, t=900, ~1000 wrogów):
  render p95 17.9→12.9 ms, fillRect 34%→1.5%. Następne z audytu: obrażenia wrogów niezależne od DPS gracza (`power.dmgExp`),
  telemetria runów, przebudowa `powerMul` (gonienie DPS gracza), auto worldRes=2 (endWorld ~29%).
- 0.34.5: `titleBar` (ui/widgets.ts) — wstęga tytułu na ekranach menu (jak `dim` w nakładkach); Rekordy i rekordy slotu
  „not played yet” zamiast zer; Wszechstronność jako pierwszy rząd przewijanej listy synergii (progi `DESC`); panel mapy
  Ekspedycji: „Enemies:” z `BIOME_WAVES` biomu (+ `BIOME_MINIBOSS` na mapie elit) pod modyfikatorami, w tej samej przewijanej liście.
- 0.35.0 (Ekspedycja, audyt Agenta 2): obóz i kapliczka ustawiają `ex.offer` (`rollOffer`: dwie różne opcje z CAMP_BUFFS /
  EX_BLESSINGS), mapa (`ExpeditionMapView.updateOffer/renderOffer`) blokuje wybór węzła do decyzji (1/2, strzałki, klik, Enter).
  Podgląd trasy: `peek` (mysz po ruchu albo R/X po zablokowaniu trudności; strzałki/Enter go zdejmują, żeby panel pokazywał
  to, w co wejdzie Enter), `routeTo` (osiągalność w przód i wstecz) podświetla drogi, zielony „+” = bonus mapy. Trudność:
  `tierOpen` (tylko przed pierwszym węzłem aktu; koniec przełączania przed lochem). Przed bossem obóz/sklep w każdej połowie
  kolumn. Bonus obozu: loch go nie używa ani nie zużywa; błogosławieństwo liczy każdą mapę z walką. Podgląd Rozdarcia: tylko „???” i opis. Telemetria runu: `Run.telemetry` (próbka co
  `BAL.telemetryEvery` s: czasy, pm, dps, hp, taken, kills, alive), w bocie `BotRun.tl`, w DEV `window.__telemetry()`.
  Testy balansu botem uruchamiać na zamrożonej kopii (osobny vite na innym porcie), bo HMR przeładowuje stronę przy edycji.
- 0.35.1 (zadanie C): obrażenia wrogów `BAL.power.dmg(głębokość, Run.depthTime())` zamiast `powerMul^0.45` (dopasowane do
  P35 telemetrii; samouczek bez krzywej). Walidacja bez god mode (7 bohaterów × 4 runy): mediana przeżycia 82 → 80 s.
  Następne: D (przebudowa `powerMul` HP: podłoga czasowa + ograniczone gonienie liczone z zadanych obrażeń, bez overkillu).
- 0.36.0 (zadanie D): `powerMul` = podłoga `1.06^(poziom-12)` × pogoń `sqrt(DPS·ttk/(baza·podłoga))` w [0.45, 8], całość
  [1, 300]; DPS liczy tylko obrażenia zadane (bez nadwyżki; Egzekucja zadawała 3× maks. HP). Podłoga w pm (bossowie dalej
  pm^0.5). Bot: `&pmax=` (sufit do pomiarów), `BotRun.maps`/`bosses` (czasy poziomów i walk z bossem). A/B 2 rundy:
  przeżycie mediana 75.5→77 s, boss Ekspedycja P90 58→18 s, Endless P90 175→124 s, mapa P90 230→230 (P50 +24%),
  tłum ≥900 wrogów 7.7%→1%. Po wydaniu: objKills (mapa P50), pula ulepszeń przy szybszym levelowaniu, za krótcy bossowie
  Ekspedycji, telemetria elit / ulta / growth, TTK zamiast kills/15 s.
- 0.36.1 (styl „kamień i żar”, analiza frontend-design): okna bez dekoracyjnych kolorowych ramek (`panel` bez akcentu);
  kolor ramki tylko ze znaczeniem: rzadkość, stan (aktywna synergia, wybrany węzeł), ostrzeżenie. Jedyny świecący element to
  zaznaczenie: `ember` (ui/widgets.ts, ciepła poświata) pod zaznaczoną pozycją `Menu`, aktywnym złotym przyciskiem, wybraną
  kartą (`cardFrame`) i bohaterem na liście. Podpowiedzi jako cicha płytka z turkusowym znacznikiem po lewej. Nagłówki grup menu
  zwykłą pisownią (Play / Progress / Other), bez wielkich liter. Przy nowych ekranach: `panel(r, x, y, w, h)` bez akcentu,
  akcent tylko gdy coś znaczy.
- 0.36.2 (sprawdzenie układu): test wystawania napisów (przechwycenie `fillText` i `roundRect` w Playwright, z uwzględnieniem
  przycinania przewijanych list) na wszystkich ekranach po angielsku i po polsku. Poprawki: opis w Ustawieniach pod oknem listy
  (dłuższe zakładki), przyciski sklepu `BTNS` (wspólne dla rysowania i kliknięć, „Back to the map” się mieści), podpowiedzi
  sklepu i kowadła w nowych miejscach, krótsza podpowiedź mapy, kolumny tabeli żywiołów liczone z najdłuższej nazwy
  (`renderElements`), nazwy i koszty węzłów Rozwoju dopasowane do kafelka (`fit`), „Endless Stream” po polsku „Wieczny nurt”,
  podświetlenie wiersza `Menu` co najmniej `LINE_H + 2` (ogonki ę, g, j), tekst przycisku wyśrodkowany na wysokości 12·skala,
  zakładki wyboru bohatera 14 px. Nowe ekrany: szerokości kolumn i przycisków z `textWidth`, nie stałe (polski jest dłuższy).
- 0.37.0 (punkt 2 + węzły-wydarzenia): telemetria `life`/`eLife` (czas życia zabitych), `ult`, `growth`, `goal`; bot `maps`
  z celem, `statOnly`/`offers`. Pomiar: pula ulepszeń nie wyczerpuje się (do poz. 142), bonusy XP nie spychają na podłogę,
  mapy „przetrwaj” 4× dłuższe niż „pokonaj” → `surviveScale` 0.5; bossowie Ekspedycji P50 6 s → `expedition.bossHp` ×3
  (tylko boss aktu). Węzły: `ambush` (cel przetrwania × `ambushScale`, `encircle` co `ambushEvery` s, numer pierścienia z
  czasu, bez `EVENTS`), `hunt` (cel 'hunt' z limitem, miniboss ×`huntHp` + eskorta bez łupu i kart, `huntKilled`,
  `huntPaused` w lochu, ponowny spawn po wczytaniu i po lochu), `vault` (`dungeonKind`, bez iskry pustki). `isArena`:
  nagroda modyfikatorów × `arenaReward` w `mapReward`. Mapa elit i Zasadzka: skrzynia co `eliteChestEvery` elitę.
  `freeSlot` (spawner): pełna pula nigdy nie zwalnia bossa ani elity; zabezpieczenie na zwolniony obiekt bossa
  (rzadka blokada poziomu w teście bota). Legenda mapy: tylko rodzaje obecne w akcie.

- 0.38.0 (#4 węzły pod build + G wydajność): `MapNode.affinity` (`rollAffinities`: rzędy 1..rows-3, odporność 25% /
  podatność 25%, najwyżej 1 odporność na rząd i zawsze do ominięcia — `avoidable`), `LevelDef.weak/resist`; `resistOf`
  zwraca żywioł mapy dla nie-bossów (blokuje stany i reakcje), podatność ×`weakMul` tylko na trafieniu (ticki dziedziczą),
  `dmgStep` i `elemDmg` dzielone przez powinowactwo (pogoń HP go nie wyrównuje). `elemDmg` zerowane w `startLevel` — panel
  „Your build (last map)”. `MapNode.eliteMods`: Mapa elit / Zasadzka, 1 cecha w akcie 1, 2 dalej, bez Pancernych na mapie
  odpornej; spawner i `encircle(..., eliteMods)`. Znacznik `drawElemMark` na węźle. Automatyczna jakość (main.ts
  `updateQuality`, `LoopStats.workMs`): praca klatki > 12 ms przez 2 s → `setWorldRes(2)`, powrót po 20 s < 6 ms, najwyżej
  2 razy; w bocie tylko z `&autoq=1`, w DEV `window.__quality`, `__loop()`. Pomiar (1000 wrogów): render p50 ~10 → 5-8 ms.

- 0.39.0 (zadanie F, sytuacje): `systems/situations.ts` — tabela SITUATIONS (ogólne: shieldwall, crossfire, kamikaze,
  ritual; biomowe z `biomes`: stampede 0, below 1/4, desert 2, mirrors 3), `plan(skala, kąt)` → offsety wokół gracza.
  Czas poziomu (`situationT`, BAL.situations), `from` wg czasu fal; bez bossa, lochu, Zasadzki, burzy, samouczka i obok
  EVENTS (±`eventGap`). Zapowiedź `run.situation` (render.ts: znaczniki `mark`, krąg przy `ring`; hud.ts: czerwona strzałka
  kierunkowych), spawn z `e.sit` (pełna pula: zwalnia najdalszych zwykłych, nie nagrody), `situationKill` w killEnemy:
  rozbicie = monety, Rytuał = skrzynia elity za obu przywoływaczy w `ritualWindow`. Dziennik `run.sitLog` (broken /
  failed / lost), `sit` w telemetrii, `sits` w bocie; boss kasuje zapowiedź. Przywoływacz z sytuacji ma limit `summonCap`.
  A/B (bez god): przeżycie mediana 72 → 72 s; bot god rozbija formacje w 1-8 s (bez obrażeń) — do strojenia skali na
  prawdziwych runach (telemetria `sitLog`).

- 0.40.0 (B2, B3, G2, B4 krok 1): `Objective survive.kills` (Ekspedycja: przetrwaj albo zabij tylu, ilu na mapie
  „pokonaj”, `surviveKills`), `BAL.bossSoften` (`Run.bossSoftMul`: po 90 s walki boss dostaje do ×2, baner, „Weakened” na
  pasku; bez lochu), `PlayerFx 'auto'` (domyślne nowych zapisów; `Run.updateFxDim` z histerezą `BAL.readability`, ataki
  i liczby obrażeń przygaszane), pociski wrogów rysowane nad cząsteczkami i fx. Bohaterowie: Ignara maxHp 95, Borgun
  might 1.15, Takezo 1.08 (UWAGA: `HeroDef.base` NADPISUJE domyślne statystyki — might 1.15, nie 0.15). Bot: `&style=
  kite|melee|auto` (melee dla broni 'cleave'). A/B: mapa „przetrwaj” P50 130 → 48 s, boss Ekspedycji P90 78 → 50 s,
  przeżycie bez god mediana 68.5 → 67 s (Borgun 140 → 233 s — do sprawdzenia botem melee, potem obszar zamiast might).

- 0.41.0 (R3, B4 krok 2, G6): `EliteMod.kind` commander / splitter / banner / phase (`eliteTraits` w enemies.ts, wspólny
  `e.traitT`, więc `eliteCompatible` dopuszcza najwyżej jedną cechę zachowania + `ELITE_FORBIDDEN`). Dowódca znakuje
  `buffT` (ruch, kontakt, zwykłe strzały +25%), sztandar → `run.banners` (`updateBanners`: leczenie wrogów, `inBanner`
  +20% obrażeń gracza, czip w HUD), cień → `e.hidden` (poza hashem: pociski przelatują, bez strzałów), rozszczepiacz w
  killEnemy (kopie bez cech, nie po wykonaniu celu). Od `eliteTraits.from` s czasu fal, w Ekspedycji od aktu 2. DEV
  `window.__spawn(id, dx, dy, mods)`. B4: bot `style=melee` pokazał, że luka Borguna była artefaktem bota (DPS 1.2M → 40M);
  Takezo katana area 1.25. G6: profil — logika ~5% klatki przy 1000 wrogów, koszt w `endWorld` (auto jakość), bez zmian.

- 0.41.1: `rollOffer` dopełnia ofertę kart do 3 kartami niższej rzadkości, gdy pula wylosowanej rzadkości jest prawie
  pusta (unikalne pryzmatyczne zebrane) — wcześniej nagroda za bossa mogła pokazać jedną kartę.

- 0.41.2: awans — wolny slot broni, a wszystkie bronie bazowe wykorzystane (po kilku fuzjach): składniki fuzji wracają do
  oferty (`candidates`, zapasowe `taken`); opcja fuzji pomija hybrydę, którą już masz.

- 0.41.3: sekret Takezo `ganryu` (data/secrets.ts): `sec.ganryu` = odbicia Mikiri pod rząd (tryParry +1, zerowane w
  hurtPlayer przy obrażeniach), 15 → Przepływ +2.5 s (`rhythm.flow`), +10% obrażeń. Każdy bohater ma teraz swój sekret.

- 0.42.0 (R2, relikwie): data/relics.ts (`RELICS`, `mode` 'expedition' dla Pryzmatu i Pielgrzyma), `BAL.relics`,
  `Run.relics` / `pendingRelics` (w snapshocie), `Run.relic(id)`. Źródło: `onBossKilled` — Ekspedycja: boss aktu poza
  lochem i nie ostatni (wyprawa trwa dalej), Endless: boss parzystej głębokości poza lochem. Wybór: ui/relics.ts
  (`RelicPickView`, stan 'relic' po mocach w `openPending`; przy limicie 3 drugi krok wymiany, Esc = zostaw). HUD: złote
  gniazda za pasywkami. Efekty: Róg (sytuacje x2, skrzynia elity przy rozbiciu w 15 s), Klepsydra (bossSoftMul od połowy
  czasu, max x2; boss +25% obrażeń poza lochem), Znak łowcy (elity +40%, zwykli -10%), Pryzmat (weak 2.25 / resist 0.25),
  Pielgrzym (oferty obozu/kapliczki po 3, pierwsze odświeżenie darmowe, sklep x1.25), Przeniewierca (aura dowódcy i
  sztandar dają graczowi `cmdBuffT`, dowódcy/sztandary częściej, elity z cechą +50% HP), Buława (zabicie elity → aura 6 s,
  bez aury -15% obrażeń), Płaszcz (1 s iframes co 8 s, -25% maks. HP), Kielich (rozbicie/elita leczą 15%, mięso nie).
  Podgląd przy wyborze: `peekFromPick` w game-screen (stany levelup/cards/power/relic/loot) — C build, I/Tab plecak,
  Y synergie (nowa akcja `synergies`, do zmiany w Sterowaniu) albo przyciski `peekBtn`; powrót przez build/inv/synReturn.
  Nowe bronie ogólne: `sickle` (Sierp krwi, bolt z `hybrid.seek`, ewolucja z `fang` → `sickle_evo` z `hybrid.drain` 0.4%
  maks. HP za trafienie w budżecie `BAL.drainPerSec` 1.5%/s — `Run.drainHeal`, przez `heal`, nie działa z Kielichem; alt z
  `crit`) i `dice` (Kości, `hybrid.dice` = mnożnik szóstki, rzut w `rollDie` w projectiles.ts: x0.5–1.6 albo szóstka z
  szansą 1/6 + stats.luck/8, maks. 0.5; ewolucja z `horseshoe` → `dice_evo` z `sixBlast` (wybuch + moneta co 1 s); alt z
  `clover`). `WeaponDef.tags` dodaje tagi synergii obok tagów wzorca (`weaponTags`). Sprite'y obrotowe `SPIN` w render.ts
  (`sickle0..3`, `dice0..3`, `gdice0..3`), ikony z `crescentPts` / `die` w gfx/icons.ts.

- 0.43.0: Aurel Q = Włócznia światła (kind 'lance', id `a_guard` i flagi `a_guard.*` bez zmian dla zapisów/drzewka/kart):
  pocisk z `pr.brand` (czas Piętna) przebija linię; `Enemy.brandT` / `brandBoom`. Trafienie napiętnowanego leczy przez
  `drainHeal` (wspólny budżet `BAL.drainPerSec` z Sierpem krwi, Wiara ×`BAL.brand.faith`), `brandDmg` z karty. Ewolucja
  Włócznia świtu: 3 włócznie, wybuch 'Dawn Burst' w killEnemy (bez łańcucha: `lastHitSrc`). Opiekun: tarcza
  `BAL.brand.shieldPer` za napiętnowanego w `guardR`; Uświęcona ziemia przedłuża Piętno; Łaska bez sług; sekret 'saint':
  20 napiętnowanych przy ≥95% HP; meta: `lanceDmg`, `cd.q`. Render: włócznia liniami (gałąź `pr.brand`), romb Piętna pod
  wrogiem. Takezo: broń 'katana' ma kind 'lash' (cięcia poziome jak bicz: `lashCut`, fx 'slash'), bot traktuje 'lash' jak walkę wręcz.

- 0.43.2 (poprawki z playtestu Agenta 3): `LevelDef.gentle` — pierwszy węzeł wyprawy (akt 1, rząd 0): cel 300 zabójstw,
  `BAL.expedition.gentle` (enemyCount −0.5, enemyDmg −0.35, sytuacje/zadania/wydarzenia od 90 s, elita od 60 s; bot fresh:
  pierwsza mapa 4/6 bohaterów zamiast 2/6). `save.earlyDeaths` + `suggestEasy` (przycisk trybu łatwego na ekranie końca po
  2 wczesnych porażkach). Ekran końca: „Your first records!”. Pauza w samouczku: „Tutorial”. Liczby: HP ceil, złoto floor,
  `statTotal` „obecnie”. Toast mapy nad przyciskami. Rytm Takezo (0.43.0): `rhythmDrain` po trafieniu, `hit` 1.5, `gap` 0.04.
- 0.43.3: Przepływ trwa do trafienia (`flowT = Infinity`, pasek pełny); trafienie: `breakRhythm` (opadanie) albo, z flagą
  `rhythm.flow` (węzeł t_max, karta h_t_max, sekret Ganryū), jeszcze tyle sekund Przepływu, potem opadanie od pełnego.
- 0.43.5 (playtest 2): `earlyDeaths` w loadSave; tr() wstawek w pauzie (pasywka, zasób, ewolucje w skills.ts); Y zamyka
  Synergie; łagodny start: zadanie +20 s, wydarzenie +40 s po ciszy (`gentle.stagger`); DPS zaokrąglany; podpis ekranu relikwii pod kartami.
- 0.44.0 (playtest 2, krytyka Agenta 2): `openPending` w kolejności relikwia → moc → karty → awanse → łup; seria ≥3 nagród:
  licznik `rewardTotal/rewardDone` („Rewards 4/14”), ten sam rodzaj pod rząd `REPEAT_DELAY` 0.12 s. LootView: „Take all to
  backpack” (`takeAll`, bez unikatów/legend). Strzelają tylko widoczni wrogowie (`BAL.shootMargin`, boss zawsze),
  `enemyBulletSoftCap` 500 → 320, `bulletDmg` 1.1 → 1.35 (A/B bot: mediana przeżycia 64.5 vs 61.5 s; pociski w 3 min ~340
  zamiast 400-580); telemetria `bul`. Render: bohater drugi raz nad efektami gracza (`drawHero`), 'boom' skala ≥3 z alfą 0.5.
- 0.45.0 (R4 + analiza skalowania Agenta 2): `HeroDef.altUlt` (to samo `id` co pierwszy ult → flagi drzewka i kart, `alt: true`
  pomija EVO_EXTRA; ewolucja w samym zachowaniu), `heroAbilities(h, alt)`, `save.altUlt[hero]`, snapshot `altUlt`, R na
  ekranie bohatera. Kinds: falcon (linia przez wszystkich, Celność), quake (fale, ogłuszenie bez bossów, furia), flare (zużywa
  Żar, wybuch), plague (trucizna na widocznych, `spreadPlague` w killEnemy z budżetem), deathmark (`markT`, cięcie + egzekucja
  'Death Mark: execute' w PCT_SOURCES), bastion (`bastionT` niszczy wrogie pociski, wybuch na koniec), mushin (`mushinT`:
  Mikiri pewne, kontry z limitem/s). `BAL.altUlt`, `updateAltUlts`. Bot `&ult=alt|mix`. `BAL.collectLevels` 3: collectAll
  daje najwyżej 3 awanse (nadwyżka XP do 90% paska) — analiza: skok L18→L45 przy bossie podbijał floor HP i lawinę okien.
- 0.46.0 (prośba gracza: Koszmar za łatwy dla doświadczonych): Udręka 1–10 (`TORMENT` w data/expedition.ts, `tormentFlags`
  sumowane do flag każdej mapy w `levelAt(..., torment)`, bez łagodnego startu). Odblokowanie: wygrana wyprawy na najwyższym
  poziomie map albo na Udręce N → `save.tormentMax` N+1 (do `BAL.torment.max`). Wybór: T / przycisk na mapie tylko przed
  pierwszą walką aktu 1 (`ex.torment`, `save.exTorment`), zasady w okienku po wskazaniu. Esencja ×(1 + 0.15·N). Bot `&torment=N`.
- 0.46.2 (playtest 3, top 5): linia „R: zmień ultimate” w dolnym rzędzie ekranu bohatera (wyrównana do prawej); HINT_BOX
  levelup/cards/power od x 232 (nie zasłania C/I/Y); `BAL.enemyBulletHardCap` 400 w fireVolley (poza bossem); fx 'disc'
  (wypełnione koło + obrys) dla Earthquake / Solar Flare / Death Mark; błysk trafienia wyłączony przy ≥ `BAL.readability.flashCrowd`
  (500) wrogach; koniec samouczka → MainMenu z `save.notice` (Rozwój, Kolekcja) zamiast HeroSelect. 0.46.1 = druga sesja.
- 0.47.0 (gracz: „biorę bronie dystansowe i samo się wygrywa”, po krytyce Agenta 2): `BAL.weaponTune` — mnożniki obrażeń/obszaru
  wg wzorca (aura/orbit ×1.5 + obszar ×1.3, cleave ×1.35, lash ×1.45, nova ×1.2, mines ×1.25, z ewolucjami) i wg id (chain ×0.85),
  stosowane przy ładowaniu data/weapons.ts (zaokrąglenie do całości). `BAL.close` (+20% dla trafień w promieniu 50 px + promień
  wroga, bez stanów i PCT_SOURCES; pierścień przy bohaterze `run.closeAt`, telemetria `close` w bocie). `BAL.homing` zasięg wyboru
  celu bolt 200→160, chain 170→130. Bot: `&kit=a,b` (tylko te bronie na maks., bez awansów) i `&style=idle`. Pomiar (god, 180 s,
  1 broń): wręcz ≈ pociski (2000–2900 zabójstw); A/B 7 bohaterów: Borgun 140→172 s, reszta w szumie.
- 0.48.0 (playtest 4 + gracz: „na telefonie nie da się zmienić ulta”): audyt dotyku (Explore) → HeroSelect: przycisk ultimate
  (ULT_X/ULT_W między Wstecz a Start, każda zakładka) i skórki (`skinAt`); PowerPick przycisk Pomiń (SKIP_BTN); Pakty Resetuj;
  ControlsScreen: dotknięcie anuluje `input.capture`; items/shop/meta/cards: przy `lastDevice === 'touch'` pierwsze dotknięcie
  zaznacza, drugie działa; mapa: dotknięcie dalszego węzła = podgląd. Playtest 4: drugi węzeł aktu 1 z połową ulgi
  (`gentle.second`), okienko zasad Udręki 3 s po zmianie (`torAt`), plakietka esencji z mnożnikiem Udręki, pierścień bliskiego
  dystansu biały + podpowiedź 'close', przy ≥ flashCrowd wrogach połowa wybuchów i krytyki do `juice.numbersCrowd` (24),
  Rozbłysk z 12 promieniami. Bot `&kit=` naprawiony (xpNext = ∞, awans → skip), `&easy=1`. Pomiar: Kestra god 15 min 1–440 mln
  DPS (0.46.3: 0.2–327 mln) — rozrzut sprzed 0.47, nie regresja.
- 0.49.0 (runda 2 dystans/wręcz, krytyka Agenta 2): analiza fal — od 5. min ~38% wag to strzelcy 'keep' (keepDist 85–150 px,
  poza zasięgiem broni wręcz 40–90 px), goniący 2–3× wolniejsi od gracza, wymuszający ruch tylko 11–16%. Zmiany: `BAL.press`
  (keepDist ×0.75, po salwie nacisk 30 px / 1.5 s, `e.pressT`; snajper też ×0.75), `BAL.trance` (≥3 wrogów w pierścieniu:
  −15% obrażeń, `run.tranceOn()`, turkusowy pierścień; zabójstwo z bliska `drainHeal(0.002)`), auraRadius 26→32,
  orbitRadius 30→36, fale: kamikaze/migacz/pajęczarz 20% (170 s) → 30% (460 s), EVENTS pierścienie co 60 s od 330 s.
  Pomiar (kit 4 bronie, 300 s, 5 runów): bez mierzalnej poprawy wręcz (54 s vs 62 s) i dystansu stojącego (101 vs 103 s) —
  test kończy się przed 2. minutą, zanim działają fale; 7 bohaterów × 6: mediany −10…+5 s (szum). Cele Agenta 2 niespełnione,
  do potwierdzenia playtestem człowieka.
- 0.50.0 (prośba gracza): Rytm Takezo w trakcie budowania nie spada od trafień (resourceOnHurt bez gałęzi breakRhythm
  poza Przepływem); łamie go tylko trafienie w Przepływie (jak dotąd: flaga rhythm.flow daje sekundy łaski, potem opadanie).
- 0.50.1: karty (cards.ts) znów wybierane jednym kliknięciem/dotknięciem (gracz: „czasem trzeba dwa razy kliknąć”);
  podwójne dotknięcie zostaje w sklepie, plecaku i Rozwoju (zakup).
- 0.51.0 (prośba gracza): domyślnie `playerFx: 'dim'` i `zoom: 1` (daleko); zapis v11 przestawia tylko nietknięte stare
  domyślne (auto / 1.25). Koniec samouczka poleca ukrycie własnych ataków w późnej grze (Ustawienia > Czytelność).
- 0.53.0 (prośba gracza): najlepszy ekwipunek — `itemScore` (data/items.ts: log mnożnika broni ×16, statystyki / maks. rzut
  afiksu × SCORE_W, +6 unikat, +3 super, +2 Przebudzenie) i `Run.autoEquip()` (najlepsze w slocie spośród założonych i plecaka,
  pierścienie: dwa najlepsze, zamiana do plecaka, idempotentne). Ustawienie `autoEquip` (domyślnie tak) po każdym łupie
  (game-screen 'loot'), przycisk „Best gear [R]” w InventoryView. Wersja 0.52 zostawiona drugiej sesji.
- 0.55.0 (review Agenta 2 do 0.53): `itemScore(it, ref)` normalizuje do maks. rzutu na wspólnym ilvl (affixScale, implicit add
  przez IMPLICIT[kind].value(ref); broń ln×30) — wcześniej HP (skala wykładnicza) wypierało obrażenia. `autoEquip(fresh?)`:
  po łupie tylko nowe przedmioty z okna (game-screen `lootBefore`), bez `noAuto` (ustawiane przy ręcznym zdjęciu / zamianie
  w Run.equip/unequip) i bez unikatów; zapas `BAL.autoEquip` (margin 8%, +0.5 pkt / ulepszenie). Toast „Założono: X (zamiast Y)”,
  podpowiedź 'gear'. Przycisk Najlepsze [R] = pełna optymalizacja.
- 0.57.0 (pomysł gracza „scripted maps”, krytyka Agenta 2): prototyp scenariuszy map w akcie 1 Ekspedycji. data/scripts.ts
  (MAP_SCRIPTS prolog/charge/barrage, uderzenia w ułamkach `objectiveProgress`, ROLE_FOES wg biomu), `MapNode.script` losowany
  w rollActMap (rząd 0 = prolog), `LevelDef.script`. systems/scripts.ts: `updateScript` (BAL.scripts: pierwsze ≥ 20 s, odstęp
  ≥ 12 s, nic po 0.9), role swarm/rush/shoot przez sytuacje `beat_*` (startBeat, scriptOnly w SITUATIONS, noChase HP),
  tank = elita ze stałymi cechami mapy, bombard = 3 salwy `run.strikes`, breath = `run.breathT` bez spawnów; w trakcie
  uderzenia zwykłe fale ×0.85. Na mapach ze scenariuszem bez losowych sytuacji i EVENTS. Podgląd węzła: „Plan: …”.
  A/B (bot, 7 bohaterów × 4, mediana map): mieszane, w szumie (Borgun 1.5→2.5, Morwen 1.5→3.5, Kestra 1→0.5, reszta =);
  buildy kit bez różnicy. Do oceny playtestem człowieka; dalej: akty 2–3, więcej szablonów (Oblężenie, Łowy).
- 0.58.0 (ultracode: przegląd 8 specjalistów → 3 weryfikatorów na zgłoszenie → fixery): 78 zgłoszeń, 69 potwierdzonych, 9
  odrzuconych; naprawione wszystkie high/medium (43) w 34 plikach, m.in. updateEnemyBullets po bullets.clear(), portale w walce
  z bossem (events.ts), wznowienie mapy ze scenariuszem, e.plague zerowane, beat nie nadpisuje sitActive, kamikaze bez kill,
  łup węzła skarbu przed zapisem, revivesLeft po wczytaniu, mysz w spoczynku nie kradnie wyboru (levelup/cards/power/relic),
  dotyk (peek mapy, plecak/sklep/Rozwój pierwsze dotknięcie, podwójne potwierdzenia, relikwie z opóźnieniem, opisy ustawień),
  i18n banerów ultów i uderzeń, Iskra bez wykładniczych stref ognia, ellipse/minimapa/miniony/strefy (wydajność), c_fever
  drenuje HP, karty ultów działają z alt-ultem, Mushin czas od poziomu, telegrafy wrogów nie znikają z cullingiem.
  26 drobnych (low) zostawionych — lista w raporcie przeglądu.
- 0.59.0 (ultracode runda 2 + uwagi gracza): 26 poprawek low z przeglądu (m.in. pasek bossa Endless, Mushin reset, ukryci wrogowie
  w ultach, bossHpFrac, pressT, kowadło po wczytaniu, autozapis bez nagród, etykiety klawiszy po zmianie przypisań, rysik, tint
  zdarzeń); C1 etykiety/podpowiedzi dotyku (isTouch, keyGlyphs), C2 TOUCH_MENU + pigułka plecaka, C3 wspólny przycisk Wstecz
  (widgets BACK_BTN, lewy górny róg), C4 batchLoot (rarity<2 do plecaka + jeden autoEquip), C5 Settings.hudScale (1/1.25/1.5,
  hud.ts transform + abilitySlotPos, belowHud/hudGap), C7 Udręka z regułami (shortWarn, noBreath, deathBurst, cardCurse,
  bossFoeDmg), C8 profil walki wręcz w autoEquip (BAL.autoEquip.melee). Gracz: `BAL.hitCap` (40% maks. HP, +4%/Udręka, do 80%)
  w hurtPlayer; `BAL.revive` (3 s, promień 130: zwykli wrogowie giną, pociski znikają); automat nie zdejmuje super/unikatów;
  karty ultów h_k_rain/h_i_inferno/h_v_dance/h_a_judge `ult: 'base'`; ekran końca: karty w rzędzie broni przy niskim panelu,
  sekrety tłumaczone, wiersze Obrażeń wg wysokości, linia odrodzeń.
- 0.60.0 (gracz: Ekspedycja Takezo „prawie bez ruchu”; agenci: pomiar zagrożenia przy bezruchu, skalowanie obrażeń, UI):
  w `damageEnemy` trafienia `secondary` (PCT_SOURCES, reakcje z REACTION_COL, `DamageOpts.proc`: Krytyczna masa, Echo ciosu,
  Gniew burzy, Przebudzenie) bez krytyka i bez onHit; `Run.chainKill()` — zabity źródłem procentowym nie wybucha ponownie
  (Wybuchowe zgony, Ognista dusza, Synergia: Ogień); usunięte `pctDepth`. Sym: Wybuchowe zgony 290-530 → ~3 zabójstw/s,
  do pogoni 5% → 85-94%. `BAL.lifestealPerSec` 0.04 (`Run.stealLeft`, bez DoT). Strzelec poza zasięgiem: ponowna próba po
  `windup + 0.3` zamiast pełnego odnowienia. `BAL.power` max 300 → 1000, chaseMax 8 → 12. Odrodzenie nie zabija elit ani
  minibossów ('warden'). UI: ekran końca i pauza (Build) bez „+N” — pełne listy z `Scroll`, opis pod kursorem/dotykiem
  (`drawTip`/`Tip` w widgets.ts, `itemTip` w items.ts), wykres DPS w skali log. Zasada: zamiast ucinać do „+N” przewijanie
  i podpowiedź. Pomiar (bot stojący od aktu 2, nieśmiertelny): śmierci w akcie 2 0-12 → ~155; akt 3 przeciętnego buildu
  już nie bez trafień; bardzo mocne buildy dalej czyszczą poza kadrem (dalej: presja niezależna od tempa zabijania).
  Test w worktree: `node_modules` musi być prawdziwy (junction → Vite 403 na czcionce).
- 0.61.0 (odblokowania zawartości, gracz: „nie wszystko od razu, ale nie ciężko”): data/unlocks.ts `CONTENT` (`w:<broń>`,
  `p:<pasywka>`, `fusions`, `cards:<tag>`, `prism:1..3`, `evo:<broń>` = warianty po pierwszej ewolucji tej broni, `evo:all`
  dla starych zapisów), `isOpen`, `lockText` (warunek i najlepszy postęp `save.unlockBest`), `grants` (Kości → Podkowa).
  Start: 5 broni ogólnych (bolt orbit aura chain boomerang), 12 pasywek (zablokowane tylko te od wariantów: magnet, ember,
  whetstone, clover, horseshoe), `BAL.discovery.goldPerTag` złotych kart na tag i `prism` pryzmatycznych (data/cards.ts
  `cardLock`); karty bohaterów i bronie bohaterów zawsze otwarte. Warunki „w jednym runie” z `BAL.discovery.goals` (liczniki
  `Run.critHits`, `jackpots`, `evolvedBases`, w snapshocie `unlockStats`). Odkrycia: `grantDiscovery` (punkty za run, akt,
  minuty Endless; co `every` punktów najbliższa zablokowana zawartość z kolejki). `Run.content` (= `save.unlocks`) filtruje
  pulę awansu (systems/levelup.ts `openFusions`, `openEvolves`), `cardPool`. UI: Księga ewolucji, Arsenał i Kolekcja kart
  pokazują warunek, ekran końca „Next discovery x/3”. Zapis v12 (migracja 11 → 12: kto grał, dostaje wszystko).
- 0.61.1: menu główne — wariant kafelka łąki liczony z kolumny przesuniętego świata (`menuBackdrop`, `col`); wcześniej co TILE
  pikseli wszystkie kafelki wracały do poprzedniego wzoru i trawa przeskakiwała.
  Salwy `fan` / `shotgun` przy zagęszczaniu (`patternDensity`, `bulletDensity`) zachowują parzystość `count` (fireVolley): wachlarz
  Oka z 3 robił się 4 pociskami bez środkowego i stojący gracz nie dostawał trafień od ok. 6. minuty mapy i na Udręce.
- 0.62.0 (gracz: Koszmarna „bez problemu”, Takezo 61, 680K DPS w akcie 3): symulacja buildu gracza na mapach aktu 3
  (Run z prawdziwym spawnerem, skrypt agent-tough/tough.cjs w scratchpadzie: stoi / krąży, źródła obrażeń, zabici poza kadrem).
  Przyczyny: Book of the Void z +10 pociskami robił 12 cięć w 6 rzędach, przy obszarze ×4 cięcie sięgało 235 px — 85% zabójstw
  poza kadrem, 95% strzelców ginęło przed pierwszą salwą; mapy „pokonaj” kończyły się w ~38 s. Zmiany: `BAL.lash` (rows 3 =
  najwyżej 6 cięć, len 150 px; systems/weapons.ts `lash`/`lashCut`); `BAL.power.tier` — na Rzadkiej / Koszmarnej / Udręce pogoń
  HP stromsza powyżej `knee` × podłoga (Run.updatePower), słabsze buildy i Zwykła/Magiczna bez zmian. Pomiar (akt 3, głębokość 5):
  zabici poza kadrem 77% → 36%, strzelcy bez salwy 87% → 56%, mapa 39 → 44 s, śmierci (bez odrodzeń) stojąc 6.5 → 47 na mapę,
  krążąc 1.2 → 3.7; boss aktu 3 77-102 → 84-117 s. Bot bez god na Koszmarnej (21 runów) mediana 74 → 80 s, na Zwykłej bez zmian.
- 0.62.0 (playtest 3 testerów: nowicjusz, szybko się uczy, weteran — wszyscy 6/10; sterownik turowy `scratchpad/pt/driver.cjs`):
  sprawiedliwa śmierć: `Run.hurtPlayer(base, src, bullet?)`, źródło trafienia to wróg jak w bestiariuszu (`foeName`, zmienna
  `firing` w systems/enemies.ts dla salw i uderzeń, `EnemyBullet.src`), „Kolce”, „Burza”, „Bombardment”. `Run.takenBySource`
  (snapshot `taken`), `hitLog` (HIT_LOG 3 s), `killedBy`; ekran końca: linia „Killed by…” i zakładka Damage taken.
  `BAL.burst`: obrażenia z 1 s ponad 30% maks. HP wchodzą w 35% (funkcja rosnąca, stanie dalej zabija szybciej), biały pierścień.
  `Input.guardCombat(s)`: na ekranach otwieranych z walki klawisze wspólne z q/e/dash/ult dają tylko akcję walki (nagrody 0.6 s,
  koniec runu 1.5 s, każde naciśnięcie przedłuża o 0.4 s). Wybór kart nie startuje na przeklętej.
  Czytelność: pociski wrogów rysowane na końcu świata (nad atakami, efektami, liczbami, pogodą) z obwódką `bulletRim`
  (`BAL.readability.ring` + ciemna tarcza, jeden obraz z pamięci podręcznej); 'dim' schodzi do `dimMin` przy gęstych pociskach
  i w walce z bossem (`Run.fxDim` też dla 'dim'); najwyżej `projDraw` rysowanych pocisków gracza; meteor jako `pb_ember`;
  błysk trafienia bossa / elity co `bigFlashGap` s. UI: `HINT_SCREEN` przyjmuje listę ekranów (gear / reaction / synergy /
  secret czekają na spokojny ekran), `Hints.dismiss()` na mapie, w walce `SHOW_PLAY` 5 s; strzałki sekretów omijają
  `TOP_RECTS`/`BANNER_RECT`; toast mapy na wstędze (`renderMapToast`), podpis węzła z boku; `pendingLoot.title` (Treasure!,
  Map bonus!); „(now X)” raz na statystykę; „Best weapon” tylko z broni (`ROLE_BY_SRC`); awans wyjaśnia zaznaczoną kartę (`explain`, `recommendWhy`).
  Rampa aktu 1: na Zwykłej/Magicznej bez Udręki `BAL.expedition.ramp` (`LevelDef.dmgCap` = sufit mnożnika obrażeń z czasu
  i głębokości wg rzędu, także boss aktu; mniejszy tłum; flaga `shooters` w `rampMix` i linii strzelców; `heal` po mapie
  w `onLevelCleared`). W 2. rzędzie aktu 1 nie ma Polowania, Zasadzki ani aren. Limit pocisków `BAL.bulletRamp` (`bulletCap`)
  rośnie z głębokością. Sufit `powerMul` = `BAL.power.max × (tier.top[poziom] + topPerTorment × Udręka)`. HP Polowania:
  `BAL.expedition.huntHp[poziom] + huntHpPerTorment × Udręka`. Odkrycia: `discoveryCost` (`BAL.discovery.first`, potem `every`).
  Bot: `maps[]` w raporcie ma `node`, `bul`, `hp`, `shot` (udział pocisków) i `dead`.
  Runda 2 (drugi playtest: wszyscy 7/10; sterownik turowy wymaga `page.clock.pauseAt`, sam `install` nie zatrzymuje czasu):
  wybuchy z zabójstw `Run.queueExplosion(x, y, r, hpZabitego, frac, …)` biją każdego za `min(HP zabitego, własne) × frac`, najwyżej
  raz na `BAL.procs.gap` s i tylko w kadrze (`Run.inView`, `BAL.procs.view`); Supernowa liczy tylko zabójstwa bronią i umiejętnościami
  (`chainKill` obejmuje reakcje); minibossowie (`Run.bigFoe`) jak bossowie dla Supernowej, Egzekucji i Ścinacza. Żywioły i reakcje
  z trafienia bez krytyka, trafienie zabijające nie nakłada żywiołów, wybuch reakcji (`splash` w `Run.react`) trafia wroga raz na
  odnowienie; `BAL.reactions` cd 1 z `cdFloor`, toxic r 20 / mul 1 (udział wybuchów i reakcji 84-94% → 52-60%).
  Bohaterowie poza Borgunem: więcej HP, pancerz 1-3, regeneracja 0.2. Akt 2 na Zwykłej/Magicznej: `ramp.cap2/crowd2/shooters2`.
  Miniboss Polowania: podłoga HP z DPS (`huntTtk`, `huntTtkAct`). `BAL.levelGap` (`Run.levelGapT`): po serii awansów w walce
  następny czeka 3 s, 0.5 s nietykalności. Karta co `eliteCardEvery` elitę, Szczęśliwy traf od `loot.jackpotDepth`.
  Czytelność: zapowiedzi (`drawTell`, `drawBossTell`, `run.strikes`, sytuacje) w warstwie po liczbach, przed pociskami wrogów
  (`tellQ`, `TELL_KINDS`, `tellLine/tellRing/tellOval`, `BAL.readability.tellBack/tellShade`); błysk trafienia w świecie to
  `DrawOpts.hit` (`hitImage`), nie biała sylwetka `flash`; znacznik gracza w tłumie (`crowdK`, `markerCrowd`); napisy reakcji raz
  na `BAL.reactions.labelGap` s. UI: lista odblokowań na końcu w `END_UNLOCK_LINES` liniach, `pickBuf` (Enter/cyfra z opóźnienia
  nakładki), awans zaznacza Polecane, `Option.evoPiece` (karta „Evolution piece!”: nowa pasywka/broń dopełnia ewolucję posiadanej),
  odbicie Takezo pod kartą bohatera, „Weakened” pod paskiem bossa, w Ekspedycji w rogu HUD tylko złoto, sklep bez Kuźni przy `noForge`.
- 0.62.1 (hotfix po trzeciej rundzie testerów: 8, 7, 7/10): HP minibossa Polowania z `Run.dpsEma` (bez próbek `dpsLog`, które
  liczą wybuchy z tłumu — w akcie 3 miał miliardy HP), po lochu wraca z `Run.huntHpFrac`. `WB_LABEL` (bonusy jakości broni)
  po angielsku: polskie „obszaru” bez diakrytyków przegrywało w `tr` przy liście. Oczyszczony loch: „Dungeon cleared: go to
  the portal” i strzałka `exit` w `SECRET_LABEL`. `weaponRecipe`: ewolucja z posiadaną pasywką przed fuzją (karta „Evolution
  piece!” pokazywała przepis fuzji). Ukończony samouczek bez komunikatu w menu (dwa Entery).
- 0.63.0 (runda balansu po testerach 0.62): sufit stałego leczenia `BAL.sustain` (`Run.sustain` / `sustainLeft` / `sustainRate`:
  regeneracja, kradzież życia, Sierp krwi, Piętno, aury i strefy leczące, strażnicy Aurela — wspólny budżet ułamka maks. HP/s
  wg poziomu map, Udręki i głębokości Endless; jednorazowe leczenie przez `heal` bez limitu). Podłoga HP bossa (poza lochem)
  i minibossa mapy elit / Endless `BAL.bossTtk` (`ttkFloor` w spawner.ts: s × `Run.dpsEma`). Magiczna w akcie 2 ostrzej
  (`ramp.cap2/crowd2/shooters2[1]`), `BAL.heroHpTier` (premia HP z 0.62 tylko na Zwykłej), `expedition.bossScale` (cel mapy
  bossa wg aktu). Czytelność: aura ponad `readability.auraBig` bez wypełnienia, plamy meteorów bledsze ponad `meteorMany`,
  promień (`beam`) bez białej płachty, Skorpion grubsza linia i krąg na linii, w walce z bossem liczby tylko na bossie
  (`juice.numbersBoss`). Przeklęte karty z czerwoną ramką („Cursed: no healing”), `REROLL_GUARD` (ui/widgets.ts) na R w awansie
  i kartach, licznik „Rewards” rośnie z nagrodami dokładanymi w serii, `optionScore`: jakość ×10, próg synergii +25, `evoPiece` +30.
  Po testerach: podłoga HP z `Run.bigDps` (DPS w elity i bossów, nie `dpsEma` z tłumem), najwyżej `bossTtk.maxMul` × zwykłe HP.
- 0.63.1 (gracz: Morwen na Koszmarnej w 9 min, 64% obrażeń z trucizny): siła warstwy trucizny = średnia trafień (`applyElement`),
  Wybuch toksyn pełny tylko w cel, wokół `reactions.toxic.splash`; `power.tier` exp/max wyżej na Rzadkiej i Koszmarnej.
  Bot (god, Koszmarna): Wybuch toksyn Morwen 54% → poza top 5, Ignara 16% → poza top 5.
  Sługi (tester Morwen: 68-82% obrażeń w akcie 1, akt 1 bez ulepszania broni): `minions.cap` 30, Zew dusz co 22. zabójstwo na 6 s,
  `minions.bigMul` 0.5 na bossy i elity. Bot Magiczna: Morwen 2,7 → 1,7 mapy (Kestra 2,7), Zew dusz 15-43% → 12-16%.
  Wskrzeszenie widoczne: `Run.reviveStop` (gra staje na `BAL.revive.stop` s, także przy wyłączonym zatrzymaniu klatki), baner
  „Revived! N left”, wstrząs i dźwięk. Naprawa: Buty Burzy Strzał z minami jako pierwszą bronią („Brak sprite'a: mine”).
- 0.63.2 (gracz: świeży zapis, Borgun z tarczą do aktu 3 za pierwszym razem): `killShield` zużywa też `sustainLeft`, `BAL.sustain.tier`
  [0.035, 0.025, 0.018, 0.013], Zwykła ostrzej (`ramp.cap/crowd[0]` od 2. mapy, `heal[0]` 0.2, `cap2/crowd2/shooters2[0]`), `expedition.crowd`
  0.6 + 0.3 × akt. Bot nowy gracz (Kestra, Borgun, Takezo × 2): 0.63.0 do aktu 1-2 (2-9 map), 0.63.2 ginie w akcie 1 (2-3 mapy).
  Kradzież życia: budżet `lifesteal × BAL.lifestealRate` maks. HP/s (zamiast stałego 4%/s), pauza pokazuje „4% (2%/s)” i sufit leczenia przy regeneracji.
- Ekran końca, zakładka Summary (pierwsza; pomysł z BoardUI): `runGrade` (0-100, litera `GRADES` S/A/B/C/D; postęp 40, przetrwanie 20,
  zabójstwa/min 15, bossowie 15, trudność 10) w pierścieniu z rozbiciem i trzy pierścienie udziału obrażeń `renderSummary` (bronie po
  `ROLE_BY_SRC`, umiejętności i sługi po nazwach Q/E/unik/R, pasywki i zasobu, reszta = efekty). `END_TABS` ma 6 zakładek (Build = 5).
- 0.64.0 (rework UI na wzór BoardUI, zespół agentów): widgets.ts — `panel` jako karta (radius 4, cień, linia u góry), `button`
  active = wypełniony akcentem z ciemnym napisem, `pill` (pigułka stanu, 10/11 px), `statTile`, `tabs` + `tabRect` (zakładki
  segmentowe; na czarnym tle menu `screenTabs`), `ring`, `sectionTitle`, `inlineStat`, `rowBg` + `tableHead` (tabele), `Menu`:
  aktywny wiersz C.slate ze złotym paskiem (bez kursora). Menu: kafelki i pigułki na MainMenu/SlotScreen/HeroSelect (kafelek Resource
  otwiera zakładkę Zasób)/Records, pierścienie gałęzi w Rozwoju, zaznaczenie w siatkach Kolekcji złotą obwódką. Ekrany runu: pauza
  (pierścień ładunku R, pigułka poziomu, wiersze statystyk), ekran końca (statTile, tabele), karty awansu/kart (pigułki rodzaju i tagów),
  porównanie przedmiotów (pigułki zmian, werdykt Better/Worse/Similar z `itemScore`), Kup/Kuj/Wyrusz wypełnione gdy możliwe,
  pierścień szansy Kuźni i postępu synergii. HUD bez zmian (czytelność walki). Poprawki: duże pierścienie fx i Uświęcona ziemia ponad
  `auraBig` bez wypełnienia (`readability.bigRingA`), nova rysuje co drugi krok; portal wyjścia z lochu obok skrzyń
  (`events.exitDx`), `enterDungeon` kasuje `run.situation`; `CURSE_CLASH` (Gorączka / Pakt krwi), drenaż wstrzymany przy noHeal;
  opis mapy elit w panelu mapy; miniboss: podłoga z `max(bigDps, dpsEma × bossTtk.emaFrac)`; Takezo maxHp 150, pancerz 4; bot `minis`.
- 0.61.0 (role broni, gracz: „nie chcę, żeby wszystko było AoE”): `WeaponDef.role` / `AltEvo.role` ('single' | 'crowd' |
  'hybrid', data/weapons.ts; ewolucje i warianty mają własną rolę, fuzje = hybryda), `ROLE_BY_SRC` (rola po nazwie źródła),
  `roleInfo` (nazwa, kolor, opis dla UI). `BAL.roles`: mnożnik `big` na bossach, elitach i minibossach w `damageEnemy`
  (single 1.25, crowd 0.5, hybrid 1.15; stany żywiołów dziedziczą przez bazę), `spread` 0.12 rad dla salwy w jeden cel.
  Pojedynczy cel celuje najpierw w bossa / elitę (`focusTarget` w systems/weapons.ts: bolt, meteor, boomerang, cleave).
  Bazowe: single bolt/sickle/dice/arrow/staff/knives, hybrid meteor/boomerang/mines/souls/katana, crowd orbit/aura/chain/
  laser/axe/light. UI: plakietka roli na karcie awansu (ui/levelup.ts), opis roli i rola każdej ewolucji w ekranie Bronie
  i pasywki (ui/build.ts). Pomiar (symulacja zestawów 4 broni, Endless głębokość 2): boss single 101→46 s, mixed 131→85 s,
  crowd 165→243 s (2.9× mixed), hybrid 197→184 s; zabójstwa w 300 s single 3.9k, mixed 7.4k, crowd 9.5k.

- 0.37.1 (grafika obiektów map, praca równoległa z drugą sesją): gfx/objects.ts w stylu 32-bit, te same rozmiary sprite'ów.
  Pomocnik `stone` (blok z fugami, plamki, mech). Kapliczka: dwustopniowy cokół, żłobiony postument, brązowa obejma, kula
  z poświatą; miecz wbity w głaz (zbrocze, jelec z kamieniami, owinięta rękojeść); kamień zadania jako obelisk z wyrytą runą;
  totem z rzeźbioną twarzą, czaszką i piórami; portal jako kamienny pierścień z runami i spiralnym wirem; beczka z klepkami,
  obręczami, pasem ostrzegawczym i lontem; kuta płyta kolców z nitami; fontanna dwupiętrowa z kroplami (klatka); cztery
  różne znaki run (`GLYPHS`) z poświatą po zapaleniu; mural w ramie ze strzałkami kolejności; grzyb, schody, kurhan z
  portalem i gniazdami kluczy, gaj z kwiatami i kryształem.
- 0.38.1 (praca równoległa z drugą sesją): wrogie pociski jako świecąca energia (`orb` w gfx/sprites.ts: ciemna krawędź,
  nasycony kolor, jaśniejące pierścienie przez `soft` do białego rdzenia; `eb_big` z koroną kolców — pociski bossów mają
  inną sylwetkę). Animacje bohatera tylko w rysowaniu (`heroAnim` / `heroSquash` w game/render.ts, stan w WeakMap per run,
  czas z `run.time`): przysiad i wyprost po Q/E/ultimate (skok odnowienia albo `activeT`), powidoki uniku, kurz spod stóp
  w biegu, oddech w miejscu, drgnięcie o piksel przy trafieniu. `DrawOpts.squash` = [szerokość, wysokość] względem stóp.
- 0.41.4 (praca równoległa z drugą sesją): oprawa cech elit — sztandar Chorążego `banner@0-2` (powiewający płat ze
  skrzyżowanymi mieczami), ikona cechy zachowania nad paskiem życia elity `trait_<kind>` (korona, flaga, duch, odłamki),
  wzmocnienie Dowódcy `buffmark` (złota strzałka) zamiast kropki; rysunki w gfx/objects.ts. Test układu `scripts/layout.cjs`
  (`npm run layout`, opis w Testowaniu).
- 0.42.1 (drugi pełny przegląd UI): szeroki ekran — `SW` (logiczna szerokość ekranu ≥ W) i `OX` (przesunięcie
  interfejsu) w core/renderer.ts: na oknach szerszych niż 16:9 (przy wypełnianiu) świat ma pełną szerokość (VW = SW / VIEW_S),
  interfejs W × H na środku (transformacja z przesunięciem), `Renderer.cover` na przyciemnienia, `clear` i `toLogical` z OX;
  celowanie myszą (systems/player.ts) dodaje OX, promień pojawiania wrogów `spawnR()` rośnie z półprzekątną widoku, strzałki
  sekretów w HUD liczone z SW; tło menu głównego na całą szerokość. Na 16:9 SW = W, OX = 0. Nowe ekrany: tła i przyciemnienia
  na cały ekran przez `cover` / `-OX..SW`, nie `0..W`. Baner HUD pod środkowym blokiem (`drawCenter` zwraca dolną krawędź),
  z dala od napisów serii zabójstw. Kowadło i Pakty z przyciskiem „Wstecz [Esc]”, podpis Paktów pod wstęgą, tytuły wyboru
  bohatera `PICK_TITLE` (wzorzec „{}: wybierz bohatera” łapał polski „Endless: {}”), opis karty awansu przy dużym tekście
  najpierw w 85%, przyciski podglądu przy wyborze 72×14, treść usługi sklepu wyśrodkowana (`OY`).
- 0.44.1: pociski gracza wydłużone wzdłuż lotu (zasada czytelności: okrągłe = wróg) — `STREAKS` i `streak()` w gfx/sprites.ts
  (wrzeciono z ogonem, grotem i białym punktem), klatki `pb_<nazwa>@<kierunek>` w `ARROW_DIRS` kierunkach dla bolt, soul, ember,
  sun; w render.ts gałąź pocisków gracza wybiera kierunek jak strzały. Nowy okrągły sprite pocisku gracza: dopisz go do STREAKS.
- 0.44.2: najmniejszy tekst czytelniejszy na telefonie — `smallS()` w core/font.ts (0.85 przy Large, 0.75 przy Normal) zamiast
  stałego 0.75 w etykietach HUD, plakietkach, podpowiedziach klawiszy i menu; `SMALL` (theme, expedition, build) to gettery.
  Wyjątki zostają 0.75: tekst HP w pasku, znak „+” bonusu mapy. Pigułka `label` i plakietka klawisza rosną o 1 px przy Large,
  podpis wybranego węzła mapy rysowany po wszystkich węzłach (nie chowa się pod węzłem niżej).
- 0.44.3: rzadziej spotykani wrogowie przerysowani w stylu 32-bit (gfx/actors.ts, te same wymiary płócien): kultysta (kaptur
  ze szpicem, rozcięta szata, złoty rąbek), tarczownik (pawęż z herbem, wapenrok, buzdygan), kamikaze (obręcz z nitami, żarzące
  się pęknięcia, iskra-gwiazdka), skoczek (jasna i ciemna faseta, odłamki, iskry teleportu po okręgu), rozszczepieniec (geoda:
  skorupa, kryształy w szczelinie, rdzeń), odbicie (rycerz z tafli szkła, refleksy, hełm z wizjerem, szklany miecz).
- 0.45.1: przygotowanie do wydania — `npm run build:release` (vite `--mode release`, `__DEV_TOOLS__ = false`): bez F3/F4/F6/F7,
  bez zakładki Ustawień „Inne” (tryb debug, podgląd balansu); bot i haki `window.__*` już wcześniej tylko w DEV. `npm run layout`
  wypisuje też napisy bez tłumaczenia (`trMisses`) ze wszystkich odwiedzonych ekranów.
  Legenda mapy Ekspedycji zmniejsza tekst (do 0.75) i odstępy, gdy rodzaje węzłów się nie mieszczą; wiersz „Wrogowie”
  odsuwa nazwę o szerokość sprite'a (dzik nie dotyka napisu).
- 0.46.3: podpowiedzi nie zasłaniają treści — `hintShowing()` (ui/hints.ts): na awansie, kartach i mocy (ramka w prawej części
  dołu, 0.46.2) chowa się linia klawiszy pod ramką, w sklepie ramka zastępuje linię stanu i klawiszy, na mapie stoi w prawym dolnym rogu obszaru mapy. `npm run layout` ma warianty `hints=1`, `small=1`, `wide=1`
  (20:9), `touch=1` (zrzuty w /tmp/layout-shots/<wariant>-<język>) — przed wydaniem uruchom wszystkie. Menu główne: zamek
  z migoczącymi oknami na dalszym wzgórzu (`castle`), chmury, spadająca gwiazda, świetliki, miękka poświata i przebłysk logo,
  w defiladzie nowsi wrogowie. Przerysowani: przywoływacz (płaszcz z piór, pas z kości, kostur ze szponem), topielec
  (przygarbiony, łachmany, szpony), ropucha (głowa z pyskiem, brzuch, łapy, źrenice), skrzydła aniołów (osobne lotki);
  powieka oka kopiowana co drobny piksel (wcześniej kratka).
- 0.47.1: własni bossowie biomów (gfx/actors.ts `BOSS_ART`, `boss(b, f, i)`): biom 0 Władca Otchłani (`lich`), 1 Królowa
  Bagien (`swampQueen`), 2 Żar Pustkowia (`magmaLord`), 3 Oko Pustki (`voidEye`), 4 Serce Pustki (`voidHeart`). Minibossy z własnymi
  sprite'ami (`MINIBOSSES`: ciało zwykłego wroga + `Deco` przed obrysem — korona `crown()`, przebarwienie `recolor`): boarking,
  toadqueen, sandtyrant, shatterknight, voidprism, vaultwarden, dungeonkeeper (data/enemies.ts i bestiary.ts). Zjawa z kapturem,
  łańcuchem i rękawami. Śmierć według materiału (`DEATH_STYLE`, efekt 'fade' w render.ts): rozprysk, rozpad na bryły, rozbicie
  na odłamki. Pogoda biomów (gfx/weather.ts, rysowana zawsze, w pikselach logicznych: łąka pyłki i świetliki, bagno deszcz
  i mgła, pustkowie popiół i iskry, Otchłań drobiny, Pustka gwiazdy; w lochu bez). Stany żywiołów na wrogach czytelniejsze
  (języki ognia, odłamki lodu, zygzak, bąbelki). Ultimate: `Run.ultAt` + fala i ramka w kolorze bohatera przez 0.7 s.
  Uwaga: `fancy` (pełne efekty) jest wyłączone od 0.30.1 — nowe efekty rysuj poza tym blokiem.
- 0.49.1: UI i wydanie. Moc bossa: karty wjeżdżają jak przy awansie. Przycisk wciśnięty pod kursorem siada o piksel
  (`pointer.down`, main.ts). Złoto w HUD dolicza się płynnie (`HudAnim.goldShown`). Pad: `Input.lastDevice` jest akcesorem
  (ustawia `padActive` w core/input.ts); `actionKey` przy padzie daje przycisk pada (A/B/X/Y/LB/RB/LT/RT/View), napisy z klawiszem
  w nawiasach zamienia `keyGlyphs` (core/font.ts woła po tłumaczeniu w `drawText` i `textWidth`; kolejność `GLYPH_ORDER`: R = losuj,
  nie ultimate; akcja bez przycisku pada traci oznaczenie); ekran Sterowania pokazuje klawisze (`keyboardKey`). Test układu:
  wariant `pad=1`. Dotyk: joystick z obręczą i kulką, bez palca blady zarys nad slotami broni. Ikony (`npm run icons` →
  public/icon-512/192, apple-touch-icon, favicon-32), manifest PWA (pełny ekran, poziomo), ekran ładowania w index.html (usuwa
  main.ts). `npm run store` (out=/tmp/store): zrzuty 1920×1080 (menu, bohaterowie, mapa, walka w biomach z bossem, awans),
  kapsuły Steam z tła menu (`menuBackdrop` eksportowane) i nagranie webm bota (video=sekundy).
  Przy podpowiedzi w grze etykiety celów zadań chowają się (zostaje strzałka), podpowiedź ruchu ma wersję dotykową (`TOUCH_TEXT`).
- 0.49.2: przerysowani ostatni starsi wrogowie (gfx/actors.ts): jeleń (stawy nóg, pierś, grzywa, ucho, poroże z jarzącymi się
  końcami, smugi ducha), ognik (oczy z żarem, paszcza, iskry, języki u dołu), wirujący (pięć osobnych ostrzy z krawędzią tnącą,
  pierścień z nitami, czerwone oko; `starPts` usunięte), mimik (deski ze słojami, żelazne okucia z nitami, pazury, oczy w szparze).
- 0.50.1 (zrzut z telefonu): HP jako `hpText()` (util/format.ts: obie liczby w górę, bieżące ≤ maks.; było „107 / 106”)
  w HUD, sklepie i na mapie. Na dotyku gniazda umiejętności bez plakietek klawiszy. Szeroki ekran: HUD przy krawędziach okna —
  `shifted()` w hud.ts (lewy blok −OX: karta bohatera, statusy, synergie, bronie; prawy +OX: liczniki, minimapa, zadanie),
  pasek XP i czerwona ramka niskiego HP na całą szerokość; `abilitySlotPos` i `TOUCH_PAUSE.x` (core/input.ts) z +OX, więc
  rysunek i dotyk się zgadzają. Napis o joysticku chowa się, gdy jest podpowiedź (ta sama treść).
- Zablokowane: kenney.nl, opengameart.org, freesound.org (polityka sieci środowiska, 403). Po odblokowaniu: nagrania CC0,
  plik licencji, mp3/m4a obok ogg.
- Mieszanka nagrań CC0 (Kenney.nl, OpenGameArt, Freesound z filtrem CC0: uderzenia, wybuchy, interfejs, ambient biomów, motywy bossów) i ulepszonego dźwięku generowanego (bronie i efekty reagujące na grę: warianty wysokości, warstwy; muzyka narastająca z walką).
- Osobny dźwięk dla każdej broni, warianty, żeby się nie powtarzały; motyw menu, każdego biomu i osobne motywy bossów.
- Miks: ściszanie muzyki przy ważnych dźwiękach, limit dźwięków naraz, osobne suwaki efektów i muzyki.
- Licencje: plik z listą źródeł i licencji, wpis w napisach końcowych, formaty działające na iPhonie (mp3 lub m4a obok ogg).

### Faza 6: przygotowanie do wydania (v0.35, potem 1.0)
- Wersja wydawana bez narzędzi deweloperskich (zostają w wersji deweloperskiej) — GOTOWE (`npm run build:release`).
- Automatyczny test brakujących tłumaczeń w obie strony (bot przechodzi grę i zgłasza napisy bez wpisu) — GOTOWE: bot (`missing` w raporcie) i `npm run layout`
  (wszystkie 136 ekranów w obu językach, „bez tłumaczenia” na końcu raportu).
- Pełny test: Ekspedycja, akt 4, długi Endless (30+ min), samouczek.
- Lokalny dziennik runów (czas, przyczyna śmierci, DPS, wybory) i strojenie balansu na runach autora.
- Potem opakowanie: najpierw Android, potem iOS, na końcu Steam.

### Otwarte sprawy z ostatnich wersji (do wplecenia w fazy)
- Grafika 32-bit: obiekty map i efekty zrobione (0.29.1, 0.37.1); mniej popularni wrogowie do dopracowania.
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
- Test układu (najpierw `npm run dev`): `node scripts/layout.cjs` (oba języki, `lang=pl`, `only=menu|game`) przechodzi ekrany menu
  i gry i zgłasza napisy poza ekranem, wystające poza okno / kafelek / przycisk albo nachodzące na inne; zrzuty w
  /tmp/layout-shots. Po każdej zmianie UI albo nowych tekstach (polskie są dłuższe). Kod 1 przy problemach.
- Stan gry w konsoli przeglądarki (serwer deweloperski): `__screen()` (bieżący ekran, `.run`, `.state`).
- `npm run dev`, w grze F3 = debug, F4 = przyspiesz cel poziomu, F6 = awans, F7 = łup bossa (12% szans na unikat).
- Bez UI: moduły z serwera Vite w Playwright (`await import('/src/game/run.ts')`, `new Run(...)`, `run.update(1/60, wejście)`) —
  szybki test systemów (zasoby, zadania, moce, fuzje: `generateOptions`/`applyOption`, teren: `run.terrain`).
- Sklep bez grania: zapis w `slots.expedition` z otwartym węzłem sklepu (pole `shop`), potem Kontynuuj.
- Ekspedycja: zapis w `slots.expedition` z polem `expedition` (np. `path` przed bossem) pozwala od razu testować bossa i przejście aktu.
- Szczegóły sterowania i dodawania zawartości: README.md.
