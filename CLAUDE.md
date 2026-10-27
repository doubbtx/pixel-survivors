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
Stały krok symulacji 60 Hz. Zapis w localStorage z wersjami i migracjami (`core/save.ts`, SAVE_VERSION 5).
Pule obiektów + spatial hash (cel: 60 FPS przy ~1000 wrogach i ~2000 pocisków).

## Struktura `src/`

- `core/` — pętla, renderer (W/H/ZOOM, `rect`, `circle`, `withAlpha`), input (akcje abstrakcyjne: klawiatura, pad, mysz/dotyk),
  font (`drawText`, `wrapText`, LINE_H 12, polskie znaki), paleta (`C`, `RAMP`), audio (Web Audio, `sfx.play`), rng, save.
- `gfx/` — `painter.ts` (sphere, polyShade, block, ring, disc, outline), `sprites.ts` (rejestr po nazwie, `drawSprite`),
  `icons.ts` (ikony 16×16: `ic_<broń>`, `pi_<pasywka>`, `ab_<umiejętność>`, `tag:<Tag>`), `items.ts` (`it_<przedmiot>`),
  `actors.ts` (animowane postacie, `name@klatka`), `world.ts` (efekty spark/poof/boom, strzały, dekoracje biomów).
- `data/` — `balance.ts`, `weapons.ts` (z ewolucjami), `passives.ts`, `enemies.ts` (Volley: kształt i ruch salw), `waves.ts`, `heroes.ts`,
  `levels.ts` (biomy, cele poziomów, `LevelDef.boss`/`eliteMul`), `expedition.ts` (węzły, mapa aktu, `levelAt`, `nextLanes`), `shop.ts` (usługi, eliksiry, ceny, rollShop), `synergies.ts` (tagi wszystkiego, progi synergii), `meta.ts` (drzewko rozwoju, Paragon, prestiż, esencja), `cards.ts` (49 kart: stats/mul/flags/hooks; lista flag w komentarzu pliku),
  `items.ts` (sloty, jakości, typy bazowe, afiksy, super-bonusy, rollItem, porównania).
- `entities/` — typy encji.
- `systems/` — gracz, bronie, umiejętności, spawner, wrogowie + boss, pociski, strefy, znajdźki, awans (levelup), wieżyczki,
  sklep (zakupy), kowadło (`anvil.ts`: ulepsz, przekuj, jakość, przenieś super-bonus).
- `game/run.ts` — klasa `Run`: postać + świat poziomu, `damageEnemy` (jedyne miejsce utraty HP wroga), `killEnemy`,
  `hurtPlayer`, `recomputeStats` (bohater + pasywki + karty + ekwipunek), `indexEffects` (flagi i hooki z kart i super-bonusów),
  `emit` hooków (onHit, onKill, onAbilityCast, onDash, onDamageTaken, onLevelUp, onTick), ekwipunek (`equip`, `unequip`,
  `salvage`, `slotFor`), `toSnapshot`/`fromSnapshot`.
- `game/` — też `render.ts` (świat), `campaign.ts` (`endSlotRun`: koniec runu w slocie, rekordy, tablica Hardcore).
- `ui/` — `widgets.ts` (panel, dim, bar, Menu, slot), `hud.ts`, `levelup.ts`, `cards.ts`, `items.ts` (LootView, InventoryView),
  `shop.ts` (ShopView), `anvil.ts` (AnvilView), `expedition.ts` (ExpeditionMapView), `collection.ts` (kolekcja i bany kart), `meta.ts` (ekran Rozwój), `synergies.ts` (ekran synergii, lista w HUD, ikony tagów), `game-screen.ts` (stany: play/levelup/cards/loot/inventory/shop/anvil/synergies/pause/cleared/map/end; `saveSlot`, `overlayReturn`), `menus.ts` (`SlotScreen` per tryb).

## Stan (wersja 0.5.0)

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
  `drawItemCard(..., stats)` pokazuje sumy statystyk (`statTotal`). Pauza: DPS broni. Ustawienie `hideProjectiles`.
- Szybkość ataku (`Stats.atkSpeed`, `BAL.attackSpeedMul`) przyspiesza bronie; `cdr` dotyczy już tylko umiejętności.
- Ustawienia: głośność, celowanie umiejętności (auto/mieszane/ręczne, `AimMode` w `core/save.ts`), liczby obrażeń,
  wstrząsy, auto-pauza po utracie fokusu, pełny ekran, debug.
- Etap 4 (część): sklep między poziomami Hardcore (4 przedmioty z poziomem następnego poziomu, odświeżanie,
  mikstura, karta, zasoby wyboru, 2 eliksiry ze stałym bonusem; oferta zapisana w runie, po wczytaniu gra startuje od sklepu).
- Etap 4 (koniec): Ekspedycja (`mode: 'expedition'`, `run.expedition`: akt, mapa, `path`, `cleared`) — 3 akty map z węzłami
  walka/elita/skarb/sklep/kowadło/obóz/boss (`data/expedition.ts`, `BAL.expedition`); walki bez bossa kończy `run.clearObjective()`
  (spawner, gdy `!levelInfo.boss`), nagroda karta 'fight'/'elite'. Sloty zapisu per tryb: `save.slots` (hardcore/expedition/endless,
  `SlotMode`), `save.board` (tablica Hardcore), rekordy `bestExpedition`/`expeditionWins`. Endless też zapisuje i wznawia run (`stage.nextBossAt`).

## Plan dalej

- Kolejni bohaterowie (docelowo 6 ról, wszystko oryginalne).
- Balans Ekspedycji po testach (długość walk, nagrody węzłów).

## Testowanie

- `npm run dev`, w grze F3 = debug, F4 = przyspiesz cel poziomu, F6 = awans, F7 = łup bossa.
- Sklep bez grania do bossa: wstrzyknij w localStorage zapis w `slots.hardcore` z `inProgress: false` i polem `shop`, potem Kontynuuj.
- Ekspedycja: zapis w `slots.expedition` z polem `expedition` (np. `path` przed bossem) pozwala od razu testować bossa i przejście aktu.
- Szczegóły sterowania i dodawania zawartości: README.md.
