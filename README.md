# Pixel Survivors

Przeglądarkowy survivors-like / bullet hell w stylu 16-bit: Canvas 2D + TypeScript, bez silnika, Vite jako bundler.

## Styl graficzny

- Ekran 480×270 skalowany całkowitoliczbowo (`imageSmoothingEnabled = false`). Świat rysowany w powiększeniu 1,5× (`ZOOM` w `core/renderer.ts`): logika gry działa w jednostkach świata, a sprite'y mają więcej detali niż hitboksy.
- Paleta ENDESGA 32 z rampami cieniowania (`core/palette.ts`). Półprzezroczystość (cienie, poświaty stref, przyciemnienia) miesza kolory palety, jak „color math” na SNES-ie.
- Sprite'y generowane w kodzie: `gfx/painter.ts` (cieniowanie rampą ze światłem z lewej-góry, automatyczny obrys), `gfx/actors.ts` (postacie z animacją: chód bohaterów, pulsowanie szlamów, machanie skrzydłami, mruganie, migotanie płomieni, „oddech” bossa), `gfx/icons.ts` (56 ikon 16×16: 20 broni z ewolucjami, 13 pasywek, 8 umiejętności, 4 usługi sklepu, odłamek, 10 tagów kart), `gfx/world.ts` (iskry trafień, obłoki śmierci, eksplozje, strzały w 16 kierunkach, 24 dekoracje terenu — 6 na biom). Gra odwołuje się tylko do nazw sprite'ów (`nazwa@klatka`), więc można je podmienić na sprite sheet bez zmian w logice.
- Pikselowa czcionka Jersey 10 (`core/font.ts`, pakiet @fontsource/jersey-10, licencja OFL) z cieniem albo obrysem.
- Okna z fazowaną ramką i gradientem (dithering), paski z połyskiem, kursor-strzałka w menu, winieta, cienie pod postaciami, poświaty pocisków wrogów.
- HUD: portret bohatera, gniazda broni i pasywek (puste też widoczne), umiejętności z ikonami, odnowieniem i ładunkiem ultimate, ozdobny pasek bossa; karty z narożnymi klejnotami, poświatą ikony i połyskiem kart pryzmatycznych; gradientowe logo.

```bash
npm install
npm run dev       # serwer deweloperski
npm run build     # statyczne pliki w dist/ (GitHub Pages / itch.io — ścieżki względne)
npm run preview   # podgląd buildu
```

## Sterowanie

| Akcja | Klawiatura / mysz | Pad (Xbox) |
|---|---|---|
| Ruch | WASD / strzałki | lewa gałka, D-pad |
| Celowanie umiejętności | kursor myszy | prawa gałka |
| Umiejętności | Q, E | X, B |
| Unik / doskok | Spacja | A |
| Ultimate | R | Y |
| Pauza | Esc / P | Start |
| Ekwipunek | I / Tab (albo Pauza → Ekwipunek) | LT |
| Ekwipunek: załóż/zdejmij / rozłóż | Enter, klik / X | A / RB |
| Awans: wybór | 1-4, strzałki + Enter, klik | D-pad + A |
| Awans: losuj / pomiń / wygnaj | R / X / B | LB / RB / Back |
| Kolekcja kart: wybór / ban / wróć | strzałki, mysz / B, Enter / Esc | D-pad / Back, A / B |
| Karta: wybór / losuj zaznaczoną | 1-3, klik / R | D-pad + A / LB |
| Sklep: kup / odśwież przedmioty / ekwipunek / kowadło / wyjdź | Enter, klik / R / I / K / Esc | A / LB / LT / - / B |
| Kowadło: przedmiot / operacja / wybór bonusu i tagu / wróć | strzałki + Enter, klik / góra-dół + Enter / lewo-prawo / Esc | D-pad + A / B |
| Debug (FPS, liczniki encji) | F3 lub ` | — |
| Debug: przyspiesz cel poziomu / natychmiastowy awans / łup bossa | F4 / F6 / F7 (gdy debug włączony) | — |

Celowanie umiejętności (bronie zawsze namierzają same) wybierasz w **Ustawieniach**: *automatyczne* (zawsze najbliższy wróg), *mieszane* (domyślne: mysz/prawa gałka, a bez nich najbliższy wróg) albo *ręczne* (tylko mysz/prawa gałka, bez nich kierunek ruchu).

## Ustawienia

Głośność efektów i muzyki, przybliżenie świata, trudność (łatwa: słabsi wrogowie, bez odznak Paktu), kształty żywiołów dla daltonistów, tryb celowania, liczby obrażeń nad wrogami, wstrząsy ekranu, zatrzymanie klatki, podpowiedzi (z resetem), auto-pauza po wyjściu z okna/karty, pełny ekran, licznik FPS/debug. Zapisują się w localStorage; nowe pola dostają wartości domyślne bez migracji zapisu (`Settings` w `core/save.ts`).

## Struktura

```
src/
  core/      pętla 60 Hz (stały krok), renderer 480×270 (świat ×1.5), input, pula obiektów, spatial hash,
             czcionka pikselowa, paleta ENDESGA 32, dźwięk i muzyka proceduralna (Web Audio), zapis z migracjami
  gfx/       malarz sprite'ów (cieniowanie, obrys), rejestr sprite'ów po nazwach, ikony (icons.ts, items.ts)
  data/      balance.ts (wszystkie wzory), bronie (z fuzjami), pasywki, wrogowie (z mocami bossów), fale, bohaterowie,
             poziomy kampanii (levels.ts), karty (cards.ts), przedmioty i unikaty (items.ts), sklep (shop.ts),
             zadania (tasks.ts), pakty ryzyka (pacts.ts), Kuźnia (forge.ts), sekrety, osiągnięcia, bestiariusz, wyzwanie dnia
  entities/  typy encji
  systems/   gracz, bronie, umiejętności, spawner, wrogowie + boss, pociski, strefy, znajdźki, awans,
             wieżyczki, zakupy w sklepie, zasób bohatera, zadania, moce bossów, teren, Kuźnia, sekrety (buildy i mapy), wydarzenia
  game/      Run (postać + świat poziomu, obrażenia, hooki kart, snapshot), kampania, render świata
  ui/        menu, sloty trybów, mapa Ekspedycji (expedition.ts), wybór bohatera, HUD, awans, wybór karty, łup i ekwipunek (items.ts), sklep (shop.ts), pauza,
             ukończenie poziomu, podsumowanie
```

### Dodawanie zawartości

- **Broń**: wpis w `data/weapons.ts` (statystyki bazowe + przyrosty na poziom, opcjonalna ewolucja `{ passive, into }`). Nowy wzorzec ataku = nowa funkcja w `BEHAVIORS` w `systems/weapons.ts`.
- **Pasywka**: jedna linia w `data/passives.ts` (statystyka + przyrost na poziom).
- **Wróg**: wpis w `data/enemies.ts` (zachowanie `chase|fast|keep`, opcjonalny `shoot`: salwa `Volley` — kształt `fan|ring|gapRing|shotgun`, ruch pocisków `acc/turn/altTurn/wave`, celowanie `player|spin|random`, seria `burst`, zapowiedź `windup`), sprite w `gfx/actors.ts` i dodanie do `data/waves.ts`.
- **Bohater**: wpis w `data/heroes.ts` — statystyki, broń startowa, pasywka, zasób (`resource`: rodzaj z `systems/resource.ts`), 4 umiejętności (`kind` → zachowanie w `systems/abilities.ts`).
- **Unikat**: wpis w `UNIQUES` w `data/items.ts` (typ bazowy, stałe afiksy, opis i efekt przez `stats`/`mul`/`flags`/`hooks`).
- **Fuzja**: hybryda jako broń w `WEAPONS` (`fused: true`, opcjonalnie `hybrid`) + wpis w `FUSIONS` (dwie bronie bazowe), żywioł w `WEAPON_ELEMENT`.
- **Moc bossa**: wpis w `BOSS_POWERS` (`data/enemies.ts`) + funkcja w `FIRE` (`systems/powers.ts`) + ikona `bp_<id>`.
- **Zadanie**: wpis w `TASKS` (`data/tasks.ts`) + przypadek w `systems/tasks.ts` (start, postęp, status).
- **Pakt**: wpis w `PACTS` (`data/pacts.ts`) z flagami silnika na poziom.
- **Teren**: liczby i skład kawałków wg biomu w `BAL.terrain`, nowy rodzaj obiektu w `systems/terrain.ts` (+ sprite w `gfx/objects.ts`).
- **Karta**: wpis w `data/cards.ts` — rzadkość, 1-2 tagi, opcjonalnie bohater, a efekt jako `stats` (dodatki), `mul` (mnożniki), `flags` (przełączniki mechanik, lista w komentarzu pliku) i/lub `hooks` (`onHit`, `onKill`, `onAbilityCast`, `onDash`, `onDamageTaken`, `onLevelUp`, `onTick`). Silnika nie trzeba ruszać.
- **Przedmiot**: nowy typ bazowy = wpis w `BASES` w `data/items.ts` + ikona `it_<id>` w `gfx/items.ts`; nowy afiks = wpis w `AFFIXES`; nowy super-bonus = wpis w `SUPERS` (zakres wartości, opis z `{v}`, `flags` albo `hooks` jak u kart — hook dostaje wartość bonusu jako ostatni argument).
- **Synergia**: tagi źródeł w `data/synergies.ts` (`STAT_TAG`, `WEAPON_TAGS`, `SUPER_TAGS`, tagi bohatera w `heroes.ts`, tagi kart w `cards.ts`); nowy próg lub efekt = wpis w `SYNERGIES` (stats / mul / flags / hooks).
- **Sklep**: nowa usługa = wpis w `SERVICES` w `data/shop.ts` + cena i zapas w `BAL.shopPrice` / `BAL.shopStock` + przypadek w `buyService` (`systems/shop.ts`); nowy eliksir = wpis w `ELIXIRS` (statystyka i wartość).
- **Poziom kampanii**: generowany z numeru w `data/levels.ts` (biom, cel, przesunięcie fal, nazwa bossa); nowy biom = wpis w `BIOMES`.
- **Balans**: tylko `data/balance.ts` — krzywa XP, skalowanie HP/obrażeń wrogów w czasie, gęstość fal, diminishing returns (pancerz, cdr, szybkość), limity wydajnościowe.

## Stan: etapy 1-3 + przedmioty + etap 4 (sklep, synergie, kowadło, kolekcja kart, Ekspedycja, sloty zapisu) + etap 5 (meta-progresja, Endless) + etap 6 (telefon, optymalizacja, polish) + sekrety i mini-lochy + 0.13 (zasoby, zadania, unikaty, moce bossów, fuzje, pakty, teren) + 0.14 (Kuźnia runiczna) + 0.15 (sekrety, Vesper i Aurel, osiągnięcia, tryby, muzyka)

**Etap 1 (MVP)** — ruch, automatyczna broń, wrogowie, kryształy XP, awans z wyborem 3 kart (4 z Koniczyną), zasoby runu: losowanie (3), pominięcie (2), wygnanie (2), śmierć, ekran podsumowania, restart.

**Etap 2** — zawartość:
- 10 broni (8 wspólnych wzorców: pocisk, orbita, aura, łańcuch, meteoryt/obszar, bumerang, laser, miny + broń podstawowa każdego bohatera) i 10 ewolucji (broń na max. poziomie + konkretna pasywka).
- 13 pasywek.
- 6 typów wrogów: pościgowy, szybki, tank, strzelcy z wzorami wachlarz / pierścień / spirala; elity z modyfikatorami (szybki, pancerny, regenerujący, olbrzymi, ostrzał) co ~55 s; pierścienie okrążenia.
- Boss po wykonaniu celu poziomu, z 3 fazami (spirale, wachlarze, szarża z zapowiedzią, przywołania, pierścienie). Pokonanie = zwycięstwo.
- Skrzynie od elit i bossa (od wersji 0.4 dają przedmioty ekwipunku, patrz niżej).
- 2 bohaterów: **Kestra** (strzelec: Salwa, Sieć, Przewrót, Deszcz strzał) i **Borgun** (wojownik: Szarża, Wstrząs, Doskok, Gniew tytana). Ultimate ładuje się zabójstwami. Umiejętności Q/E/R awansują w puli level upów.
- Rekordy per bohater w localStorage (wersjonowany zapis), ustawienia: głośność, wstrząsy ekranu, debug.

**Etap 3** — kampania, Hardcore, karty:
- Poziomy po kolei, bez końca: nieparzyste „przetrwaj X min”, parzyste „pokonaj N wrogów”, potem boss. 4 biomy (inne podłoże i kolory bossa) powtarzają się z numerem rzymskim. HP i obrażenia wrogów rosną wykładniczo z głębokością (`depthHpMul`, `depthDmgMul`), późniejsze poziomy startują z bogatszym składem fal.
- **Hardcore**: po pokonaniu bossa ekran podsumowania i zapis postępu (wszystko zostaje: poziom postaci, bronie, pasywki, karty, złoto), +20% HP na start kolejnego poziomu. Śmierć albo poddanie = utrata całego runu i wpis do tablicy rekordów Hardcore (najdalszy poziom, czas); zamknięcie gry w trakcie poziomu wznawia go z ostatniego zapisu.
- **Trening**: jeden poziom bez zapisu (dawny tryb z etapu 2).
- **Karty (49)**: wybór co 5 poziomów postaci, po elicie i po bossie; 3 karty tej samej rzadkości (srebrna / złota / pryzmatyczna), szansa na wyższą rośnie z poziomem i głębokością, boss daje co najmniej złotą. Typy: statystyczne (kumulowane), modyfikujące umiejętności (Echo, Płonący ślad, Nawałnica…), zmieniające mechanikę (Rykoszet, Nadmiar życia, Wybuchowe zgony, wieżyczki…), przeklęte (Szklana armata, Pakt krwi…) i 8 kart bohaterów. Losowanie pojedynczej karty jako zasób (1 na start, +1 za bossa). Tagi są już w danych; zestawy dojdą w etapie 4.
- Zapis w wersji 2 z migracją z wersji 1 (stare rekordy zostają).

**Przedmioty (0.4)**:
- 8 slotów (broń, hełm, zbroja, rękawice, buty, 2 pierścienie, amulet), 19 typów bazowych z własnymi ikonami, plecak na 24 przedmioty.
- 5 stopni jakości: **Zwykły** (1 losowy bonus), **Magiczny** (2), **Rzadki** (3), **Epicki** (4), **Legendarny** (5). Wyższa jakość = więcej bonusów i mocniejsze wartości (×1–×1.8). Kolor ramki i nazwy zależy od jakości.
- Każdy typ ma bonus bazowy (broń mnoży obrażenia, zbroja daje HP, hełm pancerz, rękawice krytyk, buty szybkość, pierścień odnowienie, amulet XP), skalowany poziomem przedmiotu (= głębokość kampanii), więc łupy z dalszych poziomów są wyraźnie mocniejsze.
- 15 losowych bonusów (obrażenia, HP, regeneracja, pancerz, odnowienie, obszar, krytyk, obr. krytyczne, wampiryzm, szybkość, zbieranie, czas trwania, XP, złoto, +1 pocisk — ten ostatni od Epickiego).
- **Super-bonusy** (12), szansa: Zwykły 1%, Magiczny 3%, Rzadki 8%, Epicki 20%, Legendarny zawsze: Egzekucja (0,1–0,2% szansy na natychmiastowe zabicie; boss traci 5% HP), Echo ciosu, Gniew burzy, Lodowy dotyk, Pocałunek wampira, Ognista dusza, Dotyk Midasa, Wir przyciągania, Tarcza bogów (blok trafienia co N s), Szał, Popiół feniksa (odrodzenie), Fortuna (lepsze łupy). Przedmiot z super-bonusem ma złotą gwiazdkę w rogu.
- Źródła: elita (lepsze szanse), boss (co najmniej Rzadki), rzadko zwykły wróg (0,08%). Jakość rośnie z głębokością i z Fortuną.
- Ekran łupu: nowy przedmiot obok założonego, z różnicami statystyk na zielono/czerwono; Załóż / Do plecaka / Rozłóż na złoto. Ekran ekwipunku: sloty, plecak, szczegóły z porównaniem.
- Ekwipunek zapisuje się w slocie Hardcore (stare zapisy wczytują się z pustym ekwipunkiem).

**Żywioły, kowadło, statystyki**:
- **Żywioły** na broniach (kolorowa kropka w gnieździe broni w HUD, opis przy nowej broni): Ogień (Meteor, Miny — podpalenie: 3 s obrażeń), Lód (Magiczny pocisk, Święta aura — spowolnienie, co 5. trafienie zamrożenie), Błyskawica (Piorun, Promień — porażony wróg dostaje +20% obrażeń), Trucizna (Ostrza orbity — do 10 kumulujących się warstw). Stany widać na wrogach (płomyki, szron, iskry, bąbelki), obrażenia od podpalenia i trucizny mają własne kolory liczb. Nowa statystyka **siła żywiołów** (bonus przedmiotów „Żywiołów”, karta Moc żywiołów).
- **Kowadło** to jedyne miejsce przekuwania: przycisk R przy każdym bonusie w karcie przedmiotu, „Przekuj wszystkie” pod kartą (taniej), w menu też rozkładanie przedmiotu. „Cel przekucia” usunięty, ekwipunek już nie przekuwa.
- Przy każdym bonusie przedmiotu (ekwipunek, łup, sklep, kowadło) w nawiasie suma tej statystyki gracza, np. „+8% obrażeń (razem x1.45)”.
- Pauza: łączny DPS i DPS każdej broni pod jej ikoną.
- Ustawienie **Pociski gracza: ukryte** — działają, ale nie są rysowane (łatwiej widzieć pociski wrogów).

**Etap 6 i nowości na mapach**:
- **Telefon**: lewa połowa ekranu to wirtualny joystick (pojawia się pod palcem), gniazda Q / E / Spc / R w prawym dolnym rogu są przyciskami, pauza w prawym górnym rogu. W menu i nakładkach dotyk działa jak klik. Umiejętności celują same (najbliższy wróg).
- **Efekty: pełne / oszczędne** (Ustawienia; na telefonie domyślnie oszczędne): mniej cząsteczek, bez cieni, poświat pocisków i winiety. Pomiar przy ~1000 wrogach (Chromium na PC): aktualizacja < 1 ms, rysowanie 7.6 ms (pełne) / 5.8 ms (oszczędne).
- **Polish**: czerwony błysk krawędzi ekranu po trafieniu, pulsujące krawędzie poniżej 30% HP, płynne wyciemnienie przy zmianie ekranu.
- **Widok leczenia**: zielone liczby „+X” nad postacią (zsumowane co pół sekundy), zielona poświata paska HP, suma leczenia na ekranie końca; wyłączalne w ustawieniach.
- **Ulepszanie sklepu i kowadła** (na cały run): w sklepie pole „Rozbudowa” na końcu rzędu przedmiotów (5 poziomów: lepsza jakość, -6% cen za poziom, +1 przedmiot na poziomie 3 i 5); w kowadle przycisk / R „Ulepsz kowadło” (5 poziomów: -8% kosztów, bonusy losowane kilka razy z wyborem najlepszego, większa szansa na super-bonus przy podnoszeniu jakości).
- **Kapliczki**: pojawiają się na mapie (niebieski znacznik na minimapie); stań na nich 2 s — losowe błogosławieństwo: Szał (+50% obrażeń, 20 s), Pośpiech (+50% szybkości ruchu i ataku, 20 s), Odnowa (pełne leczenie), Bogactwo (kryształy + złoto), Tarcza (40% HP).
- **Mini-lochy**: czasem pojawia się portal (różowy znacznik). W środku arena ze ścianami i mrokiem, 3 fale wrogów (ostatnia ze Strażnikiem-elitą), potem dwie skrzynie, złoto i zielony portal powrotny.
- **Sekrety**: Złoty szlam (bardzo rzadki, ucieka i znika po 25 s — złapany sypie złotem i daje skrzynię) i Miecz w kamieniu (czasem ukryty daleko od startu; widać go na minimapie dopiero z bliska; daje przedmiot Legendarny).

**Etap 5: meta-progresja**:
- **Esencja**: na końcu każdego runu (śmierć, poddanie, koniec treningu, Endless) — za głębokość, czas, zabójstwa i poziom postaci. Widać ją na ekranie końca.
- **Rozwój** (menu główne): drzewko 4 gałęzi po 5 węzłów — Siła (obrażenia, krytyk, szybkość ataku, obrażenia krytyczne, +1 pocisk), Przetrwanie (HP, pancerz, regeneracja, leczenie z obrażeń, mniej otrzymywanych obrażeń), Fortuna (złoto i odłamki na start, XP, złoto, lepsze przedmioty), Taktyka (losowania, pominięcia, wygnania, losowania kart, więcej esencji). Węzeł wymaga poprzedniego w gałęzi; koszt rośnie z poziomem.
- **Paragon**: poziom konta z całej zdobytej esencji (bez limitu): +1% obrażeń i maks. HP za poziom.
- **Prestiż**: od 1500 wydanej esencji — drzewko i esencja się zerują, w zamian na stałe +5% obrażeń i HP oraz +15% esencji za każdy prestiż.
- **Endless** (menu główne): jeden poziom bez końca, boss co 5:00; po bossie gra trwa dalej, głębia rośnie (silniejsi wrogowie, kolejny biom). Rekord czasu w Rekordach.
- **Szybkość ataku**: nowa statystyka przyspieszająca bronie (pasywka Furia, bonus przedmiotów „Furii”, karta Szybkie ręce, Eliksir furii, synergia Szybkość, węzeł Furia). Odnowienie (Zegar, pierścienie) dotyczy teraz tylko umiejętności.
- Duże liczby wszędzie przez `fmt` (1.2K, 3.4M...). Zapis w wersji 4.

**Druga runda poprawek po testach**:
- **Hardcore**: wyjście z gry (albo „Zapisz i wyjdź” w pauzie) nie kasuje runu — poziom wznawia się z ostatniego zapisu (co ~5 s: czas, zabójstwa, elity, HP bossa). Run przepada tylko po śmierci albo poddaniu.
- **Obrażenia**: nie ma już globalnej nietykalności po trafieniu (z dużym leczeniem nie dało się zginąć). Każdy wróg może uderzyć wręcz raz na 0.7 s (`BAL.contactCooldown`), a pociski trafiają zawsze — tłum i salwy realnie zabijają.
- **Łup**: wyraźniejsza poświata, rozchodzący się pierścień i słup światła już od Magicznego (wyższy z każdą jakością), z unoszącymi się iskrami.
- **Minimapa** w prawym górnym rogu (wrogowie, elity, boss, skrzynie w kolorze jakości, widok kamery); wyłączalna w ustawieniach.
- **Wszechstronność**: nadsynergia za różnorodny build — liczy aktywne synergie (próg I+). 4: +10% obrażeń i HP, 6: +1 pocisk i -10% odnowienia, 8: tęczowy wybuch co 10 s z leczeniem, 10 (wszystkie): Mistrz, +30% obrażeń, +10% krytyka, +1 karta przy awansie. Pasek na ekranie synergii i wpis w HUD.
- **Przekuwanie myszką** (od kolejnej wersji tylko w kowadle): przycisk „R” przy każdym bonusie, „Przekuj wszystkie” 30% taniej niż po kolei.
- **Ikony**: każda karta ma własną ikonę (dawniej tylko ikonę tagu), 8 nowych typów przedmiotów (buzdygan, różdżka, maska, płaszcz, szpony, nagolenniki, obrączka, wisior).
- **Ewolucje umiejętności**: Q, E i R na maks. poziomie + aktywna synergia z opisu ewoluują (podpowiedź przy awansie). Kestra: Burza strzał (Pociski), Lodowa sieć (Obszar), Nawałnica z nieba (Umiejętności). Borgun: Taran tytana (Szybkość), Rozłam (Obszar), Awatar (Życie).

**Czytelność i balans (po testach)**:
- Awans: umiejętności pokazują, co daje następny poziom (np. „+10 obrażeń, +1 strzała, odnowienie krótsze o 0.4 s”), bronie mówią po ludzku („atakuje częściej”, „+1 ostrze”). Karty mają podpowiedzi ewolucji („Ewolucja: max poziom + Moc (masz)”, „Potrzebna do ewolucji: ...”), tagi z postępem synergii po wyborze (zielone = nowy próg) i znaczek **Polecane** przy najlepszej opcji. Oferta kart też pokazuje postęp synergii.
- Łup na ziemi: przedmiot losuje się, gdy skrzynia spada — skrzynia świeci kolorem jakości, od Rzadkiego słup światła (wyższy dla Epickiego i Legendarnego), iskry przy super-bonusie, a dobre skrzynie poza ekranem mają znacznik na krawędzi.
- Trudniej: wrogowie mają więcej HP i mocniej biją (w czasie i z głębokością), elity są twardsze, mniej leczenia między poziomami. Pocisków jest mniej (mniejsze salwy, limit 500), ale każdy boli bardziej (`BAL.bulletDmg`).
- Echo: drugie Q po pół sekundy. Przejrzane opisy pasywek, bonusów przedmiotów, umiejętności i kart (bez „pocisk/ilość”, „wampiryzmu”, „kursora”).

**Kolekcja i bany kart**:
- Menu główne → **Kolekcja kart**: wszystkie karty (53); odkryta jest każda, którą zobaczyłeś w ofercie (w dowolnym trybie), nieodkryte to „?”. Szczegóły karty i liczba wyborów.
- **Bany**: do 5 odkrytych kart (B albo przycisk) — zbanowana karta nie pojawia się w żadnej ofercie, więc łatwiej trafić karty pod swoje synergie. Odbanowanie tym samym przyciskiem.
- W ofercie kart nowa (nieodkryta) karta ma zielony napis „Nowa!”.
- Zapis w wersji 3 (migracja z wersji 2: karty z trwającego runu Hardcore od razu trafiają do kolekcji).

**Bullet hell w stylu ROTMG**:
- Główne zagrożenie to pociski: strzelcy pojawiają się od 20. sekundy. Salwy mają czytelne kształty (wachlarz, pierścień, pierścień z luką, śrut) i ruch (pociski zwalniające i wiszące w powietrzu, skręcające „kwiaty”, wężyki). Wrogowie migają przed salwą (zapowiedź).
- Nowi wrogowie: **Kultysta** (seria szybkich pocisków w gracza) i **Strażnik** (pierścień z luką, do której trzeba uciec).
- Boss trzyma dystans i ma nazwane ataki z zapowiedzią: śrut, pierścienie z luką, kwiat, strumień, pole wiszących pocisków, wężykowe wachlarze.
- Trafienie liczy się od małego rdzenia w środku postaci (biały punkt widoczny, gdy lecą pociski), więc można się przeciskać przez luki.

**Kowadło**:
- Między poziomami (ekran „Poziom ukończony”, przycisk w sklepie albo K). Waluta: złoto + **odłamki** z rozkładania przedmiotów (Zwykły 1 … Legendarny 12).
- **Ulepsz**: +1 poziom przedmiotu. **Przekuj bonus**: przycisk R przy bonusie losuje go od nowa, „Przekuj wszystkie” — wszystkie naraz taniej. **Rozłóż**: na złoto i odłamki. **Jakość**: Zwykły → … → Legendarny (mocniejsze wartości, nowy bonus, Legendarny zawsze z super-bonusem). **Przenieś super-bonus**: na inny przedmiot, dawca przepada.
- Ceny w `BAL.anvil` (złoto rośnie z poziomem przedmiotu).

**Synergie (etap 4)**:
- Wszystko ma tagi (10: Ogień, Krytyk, Pociski, Obszar, Tarcze, Życie, Szybkość, Umiejętności, Przywołania, Klątwa): bohater (2 tagi), bronie wg wzorca (ewolucja liczy się podwójnie), pasywki i afiksy przedmiotów wg statystyki, karty, super-bonusy.
- Punkty tagu odblokowują progi 3 / 6 / 9 (Klątwa 2 / 3 / 4), które się kumulują: od statystyk po efekty (pożoga co 6 s, fala uderzeniowa, darmowe wieżyczki, reset odnowienia Q/E...).
- Nowy próg ogłasza baner „Synergia: ...”. HUD pod portretem pokazuje aktywne i bliskie synergie (punkty / następny próg, kropki = progi). Pauza → Synergie: pełna lista. Karty awansu i przedmioty pokazują ikony tagów, które wzmacniają.

**Balans**: tarcza Borguna za zabójstwa ma limit przyrostu (0,5% HP za zabójstwo, do 3% HP/s) — wcześniej szybkie zabijanie dawało nieśmiertelność; przerwa między trafieniami gracza 0,4 s (była 0,5).

**Sklep (etap 4)**:
- Po pokonaniu bossa w Hardcore ekran „Poziom ukończony” ma pozycję **Sklep**. Oferta losuje się raz na przerwę między poziomami i jest zapisana w runie, więc wyjście z gry jej nie odświeża. Po „Zapisz i wyjdź” → Kontynuuj gra zaczyna od sklepu, a dopiero „Do walki” startuje poziom (wtedy też +30% HP).
- 4 przedmioty z poziomem następnego poziomu kampanii i nieco lepszą szansą na jakość (cena = 2,5× wartość rozłożenia; przedmiot do pustego slotu zakłada się sam, reszta trafia do plecaka). Odświeżenie przedmiotów kosztuje coraz więcej (×2 przy każdym użyciu).
- Usługi: Mikstura (leczy do pełna), Karta (wybór karty jak za elitę), Kość losu (+1 losowanie awansu), Zwój wygnania (+1 wygnanie), Czterolistna talia (+1 losowanie karty).
- 2 losowe eliksiry ze stałym bonusem (obrażenia, HP, pancerz, krytyk, obszar, odnowienie); każdy kupiony w runie podnosi cenę kolejnych o 35%.
- Ceny rosną liniowo z głębokością (jak wartość rozkładania). Z poziomu sklepu [I] otwiera ekwipunek — można rozłożyć przedmioty na złoto i od razu wydać.

**Ekspedycja i sloty zapisu (0.5, koniec etapu 4)**:
- **Ekspedycja** (menu główne): wyprawa przez 3 akty (Mroczna łąka, Nocne bagno, Spalone pustkowie). Każdy akt to mapa 5 rzędów węzłów i boss na końcu; z węzła idzie się do sąsiednich kolumn następnego rzędu.
- Węzły: **Walka** (krótki cel bez bossa, złoto i karta „za walkę”), **Elita** (częste elity, przedmiot jak od bossa i karta jak za elitę), **Skarb** (przedmiot wysokiej jakości), **Sklep**, **Kowadło** (plus darmowe odłamki), **Obóz** (leczenie 50% i +10 maks. HP), **Boss** (pełny poziom aktu, potem +20% HP i nowa mapa).
- Siła wrogów i łupu (głębokość) rośnie co 2 rzędy i z każdym aktem. Ukończenie wyprawy daje x2 esencji; rekordy: najwięcej ukończonych węzłów i liczba ukończonych wypraw. Liczby w `BAL.expedition`.
- **Sloty zapisu per tryb**: Hardcore, Ekspedycja i Endless mają osobne sloty (ekran slotu: Kontynuuj / Porzuć run / Nowy run). Każdy zapisuje się co ~5 s w trakcie poziomu i przez „Zapisz i wyjdź”; Endless też da się teraz przerwać i wznowić. Zapis w wersji 5 (migracja: run Hardcore i tablica rekordów przechodzą do nowych pól).

**Ignara, Mag ognia (0.6, etap 7: bohaterowie 3/6)**:
- 85 HP, -10% odnowienia, +15% siły żywiołów. Broń: **Ognisty kostur** (kule ognia, podpalają; ewolucja z Soczewką: **Kostur feniksa**).
- Pasywka **Echo mocy**: co 3. użycie Q lub E powtarza się po chwili za darmo.
- Q **Kula ognia** (wybuch w miejscu celownika + płonąca ziemia), E **Pierścień ognia** (odepchnięcie i krąg płomieni), Spacja **Mignięcie**, R **Inferno** (deszcz meteorów wokół ciebie).
- Ewolucje: Słońce (3 dodatkowe wybuchy), Płomienna bariera (tarcza 15% HP), Kataklizm (dwa razy gęstsze meteory). 4 karty bohaterki (Rozżarzenie, Wieczny płomień, Ognisty deszcz, Podwójne echo).
- Nowy ekran wyboru bohatera: lista po lewej, szczegóły po prawej.

**Etap A: poprawki i balans (0.7)**:
- Ustawienia → **Ataki gracza: widoczne / przygaszone / ukryte** (pociski, aury, promienie, pioruny, orbity, meteory, miny, wybuchy, błyski trafień). Pociski wrogów, wrogowie i łup zawsze w pełni widoczne. Stare „ukryj pociski” przechodzi w „ukryte”.
- Broń bazowa nie wraca w ofercie, gdy masz jej ewolucję. Gdy wszystko jest rozwinięte, awans proponuje stałe premie (np. +4% obrażeń, +15 HP, +3% szybkości ataku).
- Trudność: HP wrogów dopasowuje się do średniego DPS gracza (tylko w górę, maks. x60), HP i obrażenia rosną też z poziomem postaci. W późnej grze częstsze elity, więcej strzelców i gęstsze salwy (do +60% pocisków); łagodniejszy start (obrażenia wrogów od 60%, mniej wrogów w 1. minucie). Symulacja (bot, 15 min): czas zabicia przeciętnego wroga trzyma się ok. 10-20% DPS zamiast spadać do 0,5%.
- Kowadło: **Ulepsz** do 10 razy, każda wartość rośnie o 6-14% wartości z łupu (liniowo, nigdy w dół); cena rośnie z liczbą ulepszeń. Rozłożenie zwraca dodatkowo 25% złota i odłamków wydanych na przedmiot w kowadle. Miękkie limity: krytyk, kradzież życia, szybkość ruchu.
- Karta Głód krwi: najwyżej +100 maks. HP na kartę (wcześniej bez limitu). Złoty szlam: rzadziej, co najmniej 90 s odstępu, najwyżej jeden naraz.
- Wydajność wybuchów: limit cząsteczek i iskier na krok, scalanie efektów bliskich wybuchów, liczby obrażeń z gotowych obrazków, grafika wybuchów budowana przy starcie.
- Ustawienia (z włączonym debug) → **Podgląd balansu**: HP zbroi z poziomem i po ulepszeniach, skalowanie wrogów w czasie, miękkie limity.

**Etap B: żywioły i nowa zawartość (0.8)**:
- **Reakcje żywiołów**, gdy na wrogu spotkają się dwa stany (napis nad wrogiem, własny kolor liczb, odnowienie 0,6 s na wrogu):
  Ogień + Lód = **Para** (ogłuszenie 1 s i obrażenia), Błyskawica + Lód = **Kruszenie** (następne trafienie x2),
  Ogień + Trucizna = **Wybuch toksyn** (obszarowy, zużywa truciznę), Błyskawica + Trucizna = **Przewodzenie** (trucizna przeskakuje na 3 wrogów),
  Ogień + Błyskawica = **Przeciążenie** (mały wybuch z odrzutem). Liczby w `BAL.reactions`.
- **Augmenty broni**: nowy rodzaj opcji przy awansie (turkusowe karty, od 3. poziomu broni albo po ewolucji), po 2 na każdą broń, np. Rykoszet i Rozprysk (Magiczny pocisk), Płonące groty i Rozszczepienie (Strzała), Żarłoczne i Ciskane ostrza (Orbita), Puls i Wysysanie (Aura), Krater i Odłamki skał (Meteor), Magnetyczne i kasetowe miny, Fala ostrza i Krwawe cięcie (Topór), Wybuchowe kule (Ognisty kostur). W pauzie kropki nad bronią = augmenty.
- **25 nowych kart** (razem 78): żywiołowe (Krzesiwo, Szron, Jad, Ładunek, Pryzmat żywiołów, Reaktor, Burza żywiołów, Zaraza, Katalizator), późna gra (Weteran, Pogromca olbrzymów, Ścinacz, Przeładowanie, Mądrość), przeklęte (Kruche kości, Nawiedzenie, Krwawy rytuał) i augmenty bohaterów zmieniające umiejętności (Kestra: Sidła, Ogień zaporowy, Natchnienie; Borgun: Lądowanie, Tarcza szarży, Kontratak; Ignara: Ognisty skok, Wir płomieni).
- **Żywioły na przedmiotach**: super-bonusy Płomienne krytyki, Mroźny oddech, Przewodnik, Burzowe serce, Zaraza.

**Etap C: Ekspedycja jak mapy z PoE i Rozwój per bohater (0.9)**:
- **Ekspedycja**: 3 akty, każdy to mapa 6 rzędów × 4 kolumny i boss. Węzły z walką to **mapy** z nazwą i poziomem trudności wybranym dla całej wyprawy: Zwykła (bez modyfikatorów), Magiczna (1-2), Rzadka (3-4), Koszmarna (5-6). Modyfikatory to ryzyko (Opancerzeni, Okrutni, Zwinni, Nawałnica, Hordy elit, Kruchość, Susza, Tłum), a każdy daje nagrodę: więcej łupu, lepszą jakość i więcej esencji. Do tego **bonus mapy** (Święta ziemia, Żyła złota, Mądrość przodków, Ukryty skarb, Wróżba, Źródło).
- Nowe węzły: **Loch** (arena z 3 falami i strażnikiem, dwie skrzynie) i **Kapliczka** (błogosławieństwo na 3 kolejne mapy).
- **Rozwój tylko w Ekspedycji**: Hardcore i Endless są bez meta-bonusów (uczciwe rekordy), esencję daje tylko Ekspedycja.
- **Drzewko per bohater**: 4 gałęzie tematyczne + wspólna Wyprawa. Kestra: Krytyki, Zasięg, Mobilność, Pułapki; Borgun: Wytrzymałość, Kontratak, Obszar, Tarcza; Ignara: Ogień, Echo, Bariera, Żywioły. Ostatni węzeł gałęzi to **klucz**, który zmienia umiejętność (np. Przewrót zostawia Sieć, Wstrząs uderza sam po otrzymaniu obrażeń, Kula ognia leci dwa razy, Pierścień ognia daje tarczę). Osobna esencja, Paragon i prestiż dla każdego bohatera; Q/E przełącza bohatera.
- **Zapis v6**: dotychczasowa esencja, kupione węzły i prestiże wracają jako pula do rozdania (Rozwój → [B] Przydziel), razem z dawnym Paragonem. Trwająca Ekspedycja ze starą mapą zaczyna się od nowa.

**Etap D: polish, grafika i jakość ulepszeń (0.10)**:
- **Jakość ulepszeń broni** przy awansie: Zwykłe, Magiczne, Rzadkie, Epickie, Legendarne. Zwykłe daje sam poziom, każda wyższa jakość dokłada bonus (do 4): obrażenia, szybkość ataku, obszar, szybkość pocisków, szansa na krytyk, siła żywiołu, od Epickiego +1 pocisk. Wartości rosną z jakością (np. obrażenia +6% Magiczne, +25% Legendarne). Szczęście podnosi szansę. Karta ma ramkę i nazwę w kolorze jakości, Epickie i Legendarne błyskają. Bonusy sumują się na broni (zostają po ewolucji) i widać je w pauzie pod DPS. Liczby w `BAL.weaponQuality`.
- **Soczystość**: zatrzymanie klatki przy zabiciu elity / bossa i mocnym trafieniu, rozbłysk śmierci, animacja zbierania XP (błysk paska) i łupu (pierścień i napis w kolorze jakości), karty awansu i kart wjeżdżają kolejno, rzadkie z błyskiem.
- **Dźwięk**: osobne efekty żywiołów i reakcji, mocniejszy ryk bossa, kliknięcie przy najechaniu na menu.
- **Grafika**: więcej klatek animacji wrogów (Golem chodzi i macha rękami, Kultysta faluje szatą, Strażnik ma krążące runy), boss w 4 klatkach z naramiennikami, pasem, runami i iskrami, druga warstwa podłoża (plamy terenu), migoczące legendarne przedmioty.
- **Czytelność późnej gry**: przy ponad 350 wrogach liczby obrażeń tylko dla krytyków.

**Morwen, Przywoływaczka (0.11, bohaterowie 4/6)**:
- 95 HP, efekty trwają 10% dłużej. Broń: **Duszki** (zatrute dusze; ewolucja z Klepsydrą: **Rój dusz**).
- Pasywka **Zew dusz**: co 15. zabójstwo z ciała wroga powstaje duch-sługa na 8 s.
- Q **Przywołanie** (duchy gonią i ranią wrogów), E **Bagno dusz** (spowalnia, rani i zatruwa), Spacja **Cień**, R **Armia umarłych** (potężni wojownicy-duchy).
- Ewolucje: Zastęp, Przeklęta ziemia (bagno też poraża), Nieśmiertelny legion (wojownicy na koniec wybuchają). Karty: Mroczny zew, Liczny zastęp, Głębokie bagno, Lisz. Augmenty Duszek: Wędrujące dusze, Żniwo (zabity wróg może powstać jako sługa). Własne drzewko Rozwoju: Przywołania, Klątwy, Cień, Dusze.
- Synergia Przywołania (3+) wzmacnia też sługi (+30% obrażeń).

**Polish i prowadzenie gracza (0.12)**:
- **Podpowiedzi kontekstowe**: każda pojawia się raz, gdy pierwszy raz trafisz na daną mechanikę (ruch, kryształy, umiejętności, awans, skrzynia, łup, karty, elita, boss, synergia, augment, reakcja żywiołów, obrażenia, mapa, sklep, kowadło). Można je wyłączyć albo pokazać od nowa w Ustawieniach.
- **Pomoc** (menu główne i pauza): 5 stron (sterowanie, rozgrywka, żywioły i reakcje, synergie i augmenty, tryby i Rozwój).
- Menu główne opisuje zaznaczoną pozycję. Nowy gracz ma od razu zaznaczony Trening z dopiskiem „Polecane na start!”. Wybór bohatera pamięta ostatniego.
- Napis „R gotowe!”, gdy ultimate jest naładowany. Nowe przedmioty w plecaku mają znacznik „!”, a HUD przypomina o nich (I). Na mapie Ekspedycji jest opis sterowania.
- Ustawienie „Zatrzymanie klatki” wyłącza efekt hitstop.

**Inna gra niż Vampire Survivors (0.13)** — zmiany w samej pętli walki i buildów:
- **Zasób bohatera** (pasek pod HP): Kestra — **Celność** z trafień z dystansu (więcej krytyków, pełna wypuszcza darmową Salwę, oberwanie zabiera połowę); Borgun — **Furia** z ciosów z bliska, obrywania i zabójstw (pełna wyzwala Szał, poza walką opada); Ignara — **Żar** z Q/E (czary do +60% mocniejsze, powyżej żółtej kreski żar rani, unik od 40 żaru zrzuca go wybuchem ognia); Morwen — **Dusze** z wrogów ginących w pobliżu (pełne zamieniają się w sługę, R zużywa wszystkie: mocniejsza i liczniejsza armia). Nowe karty: Spokojna ręka, Krwawy szał, Serce żaru, Zbieracz dusz.
- **Zadania**: co minutę turkusowy kamień — dotknij, żeby zacząć zadanie z zegarem: Łowy (zabij elitę), Obrona totemu, Krąg mocy, Bez skazy (nie daj się trafić), Próba żywiołu. Nagroda: skrzynia, karta albo złoto; część porażek przyzywa karną falę. Panel po prawej, znacznik celu poza ekranem.
- **Unikaty**: 10 przedmiotów z bossów i elit ze stałym efektem łamiącym zasady (np. bronie strzelają w kierunku ruchu za 2.5x obrażeń, leczenie zamienia się w tarczę, unik wystrzeliwuje pierścień pocisków, co 10. trafienie to reakcja żywiołów). Nie da się ich przekuć; kolekcja odkrytych (Kolekcja → Tab).
- **Moce bossów**: po bossie wybierasz 1 z 3 jego nazwanych ataków (Śrut Otchłani, Pierścień Otchłani, Kwiat zagłady, Strumień, Pole minowe, Wylęgarnia). Moc strzela sama w twoich wrogów; wybór tej samej podnosi jej poziom (do 3).
- **Fuzje broni**: dwie bronie na maks. poziomie (albo po ewolucji) łączą się w hybrydę i zwalniają slot — 12 receptur, np. Strzała + Meteor = Płonące strzały (wybuchy), Topór + Aura = Mroźny wir, Kostur + Piorun = Kostur burzy (naprowadzane kule), Duszki + Miny = Grobowe miny. Awans zawsze proponuje dostępną fuzję, ulepszenia broni podpowiadają „Fuzja z”.
- **Pakty ryzyka** (jak Heat w Hadesie): na ekranie wyboru bohatera (Tab) 8 utrudnień z poziomami (twardsi i silniejsi wrogowie, hordy, szybsze pociski, elity z cechami, słabsze leczenie, krótszy czas zadań, mocniejszy boss). Poziom Paktu mnoży esencję i daje odznaki bohatera (Brąz 5 … Mistrz 20) za pokonanego bossa. Zapis v7.
- **Teren**: osłony blokują pociski wrogów i twoje (da się je rozbić), beczki wybuchają łańcuchowo (zwabiaj wrogów), kolce ranią wszystkich, bagno spowalnia, na lodzie się ślizgasz; skład zależy od biomu. Przy bossie arena się zwęża.
- Pomoc ma nowe strony (Zasoby, Moce) i nowe podpowiedzi.

**Kuźnia runiczna (0.14)** — ulepszanie przedmiotów jak w Metinie:
- Kowadło → Kuźnia: przedmiot ulepszasz do **+15**. Każda próba kosztuje złoto i **materiał**: Kamień kowalski (+1…+3), Ruda gwiezdna (+4…+6), Serce smoka (+7…+9), Łza bogów (+10…+12), Iskra pustki (+13…+15). Materiały dają wrogowie, rozkładanie, elity, zadania, lochy, bossowie, Złoty szlam, miecz w kamieniu i sklep (nowy rząd „Kuźnia”).
- Szansa maleje od 100% (+1) do 5% (+15). **Porażka**: nic, spadek o poziom albo **pęknięcie** (wartości -30%, trzeba naprawić rudą). Każda porażka dodaje 5% szansy na następną próbę (litość).
- **Zwoje**: błogosławieństwa (porażka nie obniża poziomu), smoka (+15% szansy), talizman kowala (chroni przed pęknięciem). **Tryb ryzyka**: +10% szansy, ale pęknięcie niszczy przedmiot na zawsze (z potwierdzeniem).
- **Progi**: +3 nowy bonus, +6 blask (bonus bazowy x1.2), +9 **Przebudzenie** zależne od typu (broń: co 10. trafienie podwójne, hełm: blok trafienia, zbroja: tarcza, rękawice: krytyki porażają, buty: ogniste kroki, pierścień: szybsze umiejętności, amulet: XP i złoto), +12 runa mocy (super-bonus albo +50% jego wartości), +15 **Boski** (wszystko x1.25, Przebudzenie x2).
- Animacja młota z iskrami i wielki napis wyniku; poziom +N widać na gnieździe przedmiotu, pęknięty na czerwono. Odłamki zostają do przekuwania i jakości.

**Sekrety, nowi bohaterowie i tryby (0.15)**:
- **Warsztat Kuźni** (B w kowadle): przetapianie materiałów na wyższe (4 kamienie → ruda, ruda + kamień → serce smoka, serca → łza bogów, łzy → iskra pustki) z szansą, złotem i odłamkami. Na wysokie poziomy materiały trzeba wytopić samemu.
- **Księga sekretów** (Kolekcja → Tab): 13 ukrytych buildów, np. Wieczna Zaraza (pełna trucizna), Feniks (same bronie ognia), Pryzmat (4 żywioły), Pacyfista, i sekrety każdego bohatera. Nieodkryty sekret pokazuje tylko zagadkę.
- **Sekrety map**: fontanna życzeń, runy z malowidłem, grzyby, biały jeleń i ukryty gaj, mimiki, pęknięta ściana ze schodami do skarbca, kurhan Zapomnianego Króla (3 klucze z elit), dodatkowa moc za bossa bez trafienia.
- **Wydarzenia poziomu** (Krwawy księżyc, Złota godzina, Burza) i **kombo** zabójstw (więcej złota). **Nowi wrogowie**: Tarczownik, Przywoływacz, Kamikaze, Skoczek, Pajęczarz. **Bossowie biomów** walczą inaczej i dają własne moce.
- **Vesper, Zabójczyni** (zasób **Kombo**: każde trafienie podbija obrażenia, Egzekucja na E zużywa całe kombo, słabych wrogów zabija od razu) i **Aurel, Kapłan** (zasób **Wiara**: z zabójstw i leczenia, pełna daje Łaskę; Strażnicy leczą go trafieniami, Uświęcona ziemia leczy i przedłuża sługi, Sąd na R spuszcza słupy światła). Komplet: bronie z ewolucjami, augmenty, fuzje, karty, drzewka Rozwoju, sekrety.
- **Osiągnięcia** (12) odblokowują nowe karty, **bestiariusz** (opis i bonus obrażeń po progach zabójstw), **Wyzwanie dnia** (ten sam bohater, pakty i ziarno dla wszystkich), koniec runu z **wykresem DPS** i **kartą buildu**.
- Tryby i sekrety: **Szybki run** (3 krótkie poziomy, ok. 10 min), sekretne: tryb **Głowy bossów**, biom **Pustka**, ukryty węzeł i **akt 4** Ekspedycji. **Skórki** bohaterów za odznaki Paktu (X przy wyborze bohatera).
- **Dostępność**: trudność łatwa, kształty żywiołów dla daltonistów. **Muzyka proceduralna**: skala zależy od biomu, warstwy (arpeggio, bębny, melodia) rosną z walką.

**Grywalność i wyczyny (0.16)**:
- Naprawiony błąd: dotyk wroga ranił w każdej klatce (teraz co 0,7 s na wroga), krótka nietykalność po trafieniu, łagodniejsze pierwsze 2 minuty.
- **Wyczyny** z nagrodami: poziom bez trafienia (karta i passa +8% obrażeń), bez uniku, bez Q/E, z jedną bronią, szybki boss, boss przy niskim HP, boss na niskim poziomie postaci (unikat), Rzeź, Mistrz kombo, Łowca elit i **Bez skazy** (cały run bez trafienia). Lista w Kolekcji, 3 nowe osiągnięcia z kartami.
- **Obraz**: gra wypełnia całe okno, F = pełny ekran, Ustawienia → Obraz i widoczność (przyciemnienie tła, wyraźne pociski wrogów, znacznik gracza).

**Wygląd i bossowie (0.17)**:
- **Przybliżenie świata** (Ustawienia → Obraz i widoczność: daleko / normalne / blisko): większe postacie i pociski.
- Gra rysuje w wyższej rozdzielczości: gładkie, zaokrąglone okna, paski z gradientem, cieńszy obrys tekstu, nowy HUD i menu główne.
- **Bossowie na uniki**: przy pojawieniu się bossa zwykli wrogowie znikają i nie przychodzą nowi, walka trwa ok. 1-2 minut, ataki mają zapowiedzi (krąg, linia szarży).

**Balans i Ekspedycja (0.18)**:
- Trudniejsza późna gra (obrażenia wrogów rosną razem z twoją siłą), łagodniejszy start, bez nietykalności po trafieniu.
- Rozwój bohatera wolniejszy: ok. 10 wygranych wypraw na pełne drzewko.
- Ekspedycja: przed wejściem na mapę wybierasz trudność (1-4: Zwykła, Magiczna, Rzadka, Koszmarna), modyfikatory są losowe.
- Karty awansu pokazują przepis ewolucji i fuzji ikonami (broń + pasywka > ewolucja). Runy znikają po złej kolejności.

**Szał i trudność wyprawy (0.19)**:
- Furia Borguna przebudowana: pełna wyzwala **Szał** (6 s: +40% obrażeń, +30% szybkości ataku, leczenie z ciosów, -20% otrzymanych), potem pasek od zera.
- Ekspedycja: wybrany poziom trudności (1-4) zostaje dla całej wyprawy i następnych, bez losowania trudności map.
- Wybór bohatera: zakładka **Zasób** (strzałka w prawo) z dokładnymi liczbami pasywki i zasobu.
- Poprawki układu: panel mapy Ekspedycji, synergie, karty awansu.

**Trudniejsza Ekspedycja i żywsze UI (0.20)**:
- Wrogowie nadążają za bardzo silnymi buildami (wyższy limit HP od siły buildu), w Ekspedycji walki są dłuższe i wrogów jest więcej.
- Po fuzji broni jej składniki nie wracają już do awansów.
- Ekwipunek: opis zaznaczonego przedmiotu (co daje slot, rzadkość, gwiazdka, kowadło).
- Przyciski podświetlają się pod myszą (kursor-rączka), pulsujące ramki i strzałki pokazują, gdzie jest więcej informacji.

**Sekrety na wierzchu i Arsenał (0.21)**:
- Różowe strzałki przy krawędzi ekranu wskazują sekrety mapy (fontanna, runy, grzyby, kurhan, schody, gaj, miecz, biały jeleń, pęknięta ściana).
- Księga sekretów pokazuje warunek wprost i efekt, także nieodkrytych; Pomoc wyjaśnia Pustkę, Rozdarcie i kod w menu.
- Kolekcja: nowa zakładka **Arsenał** (każda broń: ewolucja, fuzje, augmenty; każda pasywka), opisy nieodkrytych kart.
- Po Ekspedycji od razu przejście do Rozwoju granego bohatera.
- Dobre przedmioty rzadsze (szczególnie legendarne i unikaty).

**English and lucky runs (0.22)**:
- The game is now in English by default; Polish can be chosen in Settings → General → Language.
- Settings redesigned: categories on top (General, Sound, Display, Readability, Other), options listed below with values on the right.
- Lucky runs: any loot has a small chance to be a **Lucky find** (Legendary item or unique), and enemy HP follows very strong builds less closely.

**Weapons and Passives screen, Vault Warden (0.23)**:
- Press **C** in game (or open it from Pause) to inspect your weapons and passives: next level, quality bonuses, augments, and evolution/fusion recipes as icons (green = ingredient ready).
- The vault behind a cracked wall now ends with the **Vault Warden**: a mini-boss with six random attacks (some aimed where you are going), a rage phase below half HP, and boss-like HP instead of a damage sponge.

**Fair poison, resistant bosses, smarter fusions (0.23.3)**:
- Fixed runaway poison: Eternal Plague multiplied poison strength on every spread, so Poison and Toxic Blast reached 1E18 damage and inflated enemy HP. Overkill damage no longer counts toward your power either.
- Bosses and mini-bosses can't be stunned or frozen. Each boss resists the element of its biome (shown under its health bar).
- Elements and reactions table: press **C**, then **Tab**.
- Fused weapons keep their parents' augments (elements always, attack changes when the attack type matches), the rules are explained in the Arsenal and Weapons screen, and every hybrid has its own icon.
- Blade Wave is now a wide, visible wave that passes through cover. Borgun's Charge ends with a ground slam that grows with every trampled enemy, builds Fury, and kills shorten its cooldown.
- Totem Defense: kill 15 enemies near the totem. Flawless task: up to 2 hits allowed, no punishment wave.
- **Weapon Devotion**: reach level 10 and 20 with a single weapon for +20% damage, +10% attack speed and +1 projectile per rank.

**Weapon Devotion for the whole run (0.23.4)**:
- With a single weapon you now gain a Devotion rank at level 10 and every 5 levels after, with no limit: x1.35 damage per rank (multiplicative), +8% attack speed, +10% area, an extra projectile every second rank, and evolution without its passive. A one-weapon run now keeps up with a full arsenal until the end.

**Cleaner pause screen (0.23.5)**:
- The pause screen no longer shows the HUD and banners underneath. Menu on the left, your character on the right: stats in two columns (unchanged ones dimmed), weapons with level, DPS and share bar, passives with equipment, and cards.

**Cleaner screens (0.23.6)**:
- The HUD is hidden behind every overlay (level up, loot, equipment...), and tips no longer cover buttons: in game they appear at the top, on overlays over the title, and only the ones about the current screen.
- End of run: tiles with the key numbers, damage table with share bars and percentages.
- HUD: synergy badges show the tag name, and "Stage N" replaces "Level N" so it isn't confused with your character level.

**Fixes (0.23.7)**:
- End of run: the DPS chart and Build tabs react to clicks on the buttons themselves.
- Progression in English no longer shows Polish words ("Keystone", "damage taken").

**Difficulty restored (0.23.8)**:
- Enemy health follows your full damage again (including overkill), as before 0.23.3. The game had become too easy; the poison fix stays.

**Aurel's own weapon (0.23.9)**:
- Holy Light is no longer a copy of Chain Lightning: a ring of light spreads out from Aurel, hitting and pushing back every enemy it passes. The evolution sends several wide rings one after another.

**Light and polish (0.23.10)**:
- A warm light around your hero and soft glows on crystals, your projectiles and enemy bullets. Settings → Effects: low turns them off on slower devices.
- Richer interface: bevelled panels, glossy bars, inset slots and a gold-framed hero card.

**32-bit graphics, step 1 (0.23.11)**:
- The world is now drawn at twice the resolution. All heroes, enemies and bosses are rendered with twice the detail: smoother shapes and shading, thinner outlines, plus new details on heroes and common enemies (glints, eye shine, stitching, cracks, wing veins). Terrain, projectiles, effects and icons come next.

**32-bit graphics, step 2 (0.23.12)**:
- Every hero, enemy, summon and boss redrawn from scratch with far more detail: armour plates and rivets, cloth folds and embroidery, shaded faces with eye shine, feathered wings, finger bones in bat wings, crystal facets, skull markings and more.
- Smoother dithered shading, rim light on every shape and coloured dark outlines.
- Ground tiles, decorations, projectiles, crystals, chests, coins and effects are now drawn at double resolution too.

**Matching interface (0.23.13)**:
- All icons (weapons, passives, items, cards, abilities) use the new smoother style.
- One interface theme: steel bevelled frames, gold highlight for the selected menu entry, buttons and tabs.

**Rarity in order (0.23.14)**:
- Quality colours now climb the way most games do: Common grey, Magic green, Rare blue, Epic purple, Legendary orange, and Uniques gold (they used to be beige and looked weaker than Common). Gold cards use the same gold.

**Smoother look (0.23.15)**:
- New smooth, rounded font (Nunito) across the whole game instead of the blocky pixel font.
- Heroes, enemies, skills, icons and the world are drawn at triple resolution: finer pixels, smoother curves and shading. Settings → Effects: low keeps the world at double resolution for slower devices.

**One scene, not stickers (0.23.16)**:
- Shared lighting: the whole world (ground, heroes, enemies, projectiles) gets one colour grade per biome, and your hero carries a warm light, so everything belongs to the same scene.
- Characters blend in: outlines use a dark shade of their own colour instead of near-black, softer rim light, soft gradient shadows.
- Lighter HUD: empty slots are faded, panels are translucent.

**Hero in the scene, tidier text (0.23.17)**:
- Your hero no longer looks pasted on: a thin ground ellipse instead of the bright ring, the hit core only shows when a bullet is close, the small HP bar only when you are hurt, a soft shield glow, and your light now falls on the ground around you.
- Smaller, thinner text everywhere; ability keys, slot levels and the resource label fit inside the HUD; banners and tips are much smaller.

**One pixel size for the whole world (0.23.18)**:
- Everything in the world now uses the same fine pixel grid as the characters: ground patches, bullet outlines, the ground ellipse under the hero, puddles, circles and particles were drawn in big chunky pixels before.
- Ground spots fade out softly instead of a coarse checkerboard; the crate, boulder, pillar, spikes, flowers, reeds and arrows got fine details matching the heroes.
- The menu moon is smooth like the hills, and circles in panels (level-up cards) follow the smooth UI frames.

**Pixel font (0.23.19)**:
- The whole game now uses Pixelify Sans, a pixel font that matches the pixel art (with Polish letters), instead of the smooth rounded Nunito.

**Forest ruins and a lighter HUD (0.24.0)**:
- New HUD: a thin XP bar, a small hero card (portrait, HP with current/max, resource, level, act), synergies as small icons with tooltips, Frenzy and blessings as small timers, one goal bar with a counter under a smaller clock, a combo label that fades in and out, gold and kills in one row with a cleaner minimap, compact inventory, and the Q/E/Space/R bar at the bottom centre with a single "ready" flash.
- Debug stats are hidden from normal play: F3 (or `) toggles them.
- Menus and overlays use the same flat panels and thin frames.
- The ground is no longer a green carpet: grass, patches of earth, trodden paths and old stone floors, plants and rocks in natural clusters, and ruins (a broken gate, an obelisk, a camp, low walls, fallen columns). Decoration has no collision.
- Clearer combat: enemy bullets have a bright core and a short trail, the shield is one ring, killed enemies fade out, normal damage numbers are smaller and crits stand out.

**Smoother (0.24.1)**:
- Fixed regular stutter while walking: new ground pieces are now built a little at a time and ahead of the camera, and enemy and decoration graphics are prepared in the background instead of on first sight.

**Clearer hits, abilities and Expedition map (0.25.0)**:
- New font: Jersey 10.
- Taking damage is easy to see: the HP bar flashes, the lost part shows briefly in a light colour and shrinks quickly, and the amount lost ("-12") pops up next to the bar. The small HP bar under your hero only shows for a moment after a hit (and always when you are low).
- Hero select has clickable tabs (General, Abilities with full descriptions, Resource) and Back / Start buttons.
- The pause screen has an Abilities tab: level, cooldown or ult charge, description, evolution and the synergy it needs.
- A nicer Expedition map: the act's terrain in the background, act progress, status chips, a legend, clearer paths, and Backpack / Menu / Travel buttons.
- Progression: the next node in a branch unlocks once the previous one has at least half of its levels.

**Aurel without lag (0.25.1)**:
- Fixed heavy stutter during Aurel's attacks (and other growing rings, auras and zones): large circles are now drawn directly instead of being rebuilt pixel by pixel every frame.

**Clearer Expedition bonus (0.25.2)**:
- The Expedition map now shows "essence +X%" (with a tooltip) instead of the misleading "loot +X%": rewards from map modifiers you finished raise the essence you get at the end of the expedition.

**Luck (0.26.0)**:
- New Luck stat: better item quality, more chests from normal enemies, more uniques and lucky jackpots, rarer card offers and better weapon upgrade quality. Sources: the new Horseshoe passive (+15% per level), the Fortune affix, cards and map rewards.
- "+1 level-up choice" (Clover, Medal and others) is now its own stat and works as before.
- Luck and level-up choices are shown in the pause stats.

**Version number (0.26.1)**:
- The main menu shows the game version in the bottom-right corner, so you can check that the browser loaded the latest build.

**Two modes, both ways translation, What's new (0.27.0)**:
- Only Expedition and Endless stay. Hardcore campaign, Training, Quick run, Boss rush (Konami code) and the Daily challenge are removed from the menu, code, records, help and save.
- Progression (hero trees) works in Endless too; Endless gives essence (×0.6 of the Expedition formula, which grows with time survived).
- Moved secrets: the Void opens in Endless with Pact 5+ or after 20 minutes; Ascetic needs act 2 of an Expedition or 10 minutes of Endless; the Flawless feat is an Expedition act boss or the first Endless boss without a hit all run.
- The Daily achievement became **Wayfarer** (finish act 1 of an Expedition) — same id, so earned achievements and the Morning Sun card stay.
- Save version 8: removed modes' data is dropped safely, records, collection and Progression stay; a note in the menu says when a Hardcore run was removed.
- **What's new** screen after an update (once, any key or tap closes it). New players don't see it.
- Translation works both ways: old Polish texts → English as before, new texts are written in English with Polish in `core/i18n-pl.ts`.

**Tutorial and gradual unlocks (0.28.0)**:
- A new game starts with a short interactive tutorial (Kestra, 8 steps: move, auto attack, crystals and level up, Q and E, dodge, ultimate, chest and item, small boss), with texts for keyboard, gamepad and touch. Skip it from the pause menu, replay it in Settings → General.
- Gradual unlocks with an "Unlocked: …" banner and a short tip: start with the Expedition, Kestra and Borgun; the first boss unlocks the Anvil and Forge and the Magic difficulty; act 1 → Ignara, act 2 → Morwen; an Expedition win → Endless, Risk Pacts and Rare; 4 achievements → Vesper; 2 wins → Aurel; a win on Rare → Nightmare.
- Locked things show how to get them (main menu, hero select, map difficulty buttons). Collection tabs appear once they have something in them.
- Existing saves keep everything unlocked and skip the tutorial (save version 9).
- Test bot (dev server only): `node scripts/bot.cjs bot=endless|expedition|tutorial ...` plays the game by itself and reports errors, slow steps and missing translations.

**Readability and accessibility (0.29.0)**:
- Text size (Settings → Readability): Normal or Large (default on touch screens). Large draws descriptions at full size: abilities, hero resource, Arsenal, weapons and passives, elements, map modifiers, item description, pause, synergies, help. Long texts scroll with the mouse wheel, a finger drag, PageUp / PageDown or the right stick.
- Reduce flashing (Settings → Readability) and a photosensitivity warning on first launch: blinking warnings stay lit, no white hit flashes, the hero turns half-transparent instead of blinking while invulnerable.
- Key rebinding (Settings → General → Controls): movement, Q, E, dodge, ultimate, backpack, weapons, skip, banish, anvil, pause. Arrows, Enter, Esc, Tab and 1-4 always work in menus. The HUD, ability descriptions and the tutorial show your keys.
- Graphics (0.29.1): Kestra's Net is a real rope net, explosions are clouds of fire instead of one big ball, Arrow Rain shows falling arrows, the minimap has a direction arrow, view corners and shaped markers. Test bot `bot=gallery` screenshots every hero's abilities for review.
- Expedition map: clicking a node only selects it; Travel or Enter starts it (no accidental fights).
- Gamepad: RT opens weapons and passives, right stick click the anvil, LB / RB change the map difficulty, forge options with up / down and RB.

**Biome enemies and minibosses (0.30.0)**:
- 8 new enemies, two per biome (the Void mixes them), each with its own move and a clear warning: Boar charges along a red line, Thornling lobs seeds into marked circles, Bog Toad leaps (shadow and red ring where it lands, slime ring on landing), Drowner swims under the mud where it can't be hit and surfaces with a bite (ripples, then a red circle), Salamander breathes a short flame cone, Scorpion fires a fast sting along a thin aiming line, Splitter breaks into two Splitlings, Reflection circles you and slices across your path.
- 5 biome minibosses in the style of the Vault Guardian, each with four of its own random attacks plus a spiral and a rage phase: Boar King (charges, triple charge, stomp waves, calls boars), Toad Matriarch (leap with a landing ring, acid rain, wave spit, calls toads), Sand Tyrant (three sniper shots, sting rain, charge, shotgun), Shattered Knight (three slicing dashes, calls Reflections, teleport, cross waves), Void Prism (teleport ring, Splitlings, flower, gap rings; breaks into two Splitters). One per Expedition elite map at half the objective, and every 4 minutes in Endless (first after 2.5). Elite chest, card and XP.
- 0.30.1: the Expedition camp (Rest) also gives a random bonus for the next fight (Sharpened blades +35% damage, Morning drill +35% attack speed, Hearty meal +40 max HP and +2 HP/s, Scouted ahead +60% XP and +25% gold, Quiet night +20% damage and speed), shown on the map. Full effects (glows, shadows, vignette, extra particles) are off for good and the Effects option is gone. Icons: nearly symmetric icons are centered automatically, new Volley and Arrow Hail arrows, symmetric Synergy, chest, Shrapnel, Legion and Skills tag.
- Bestiary entries for all of them. Test bot: `bot=gallery foes=boar,toad` screenshots chosen enemies and their warnings.

**Evolutions for every passive (0.31.0)**:
- Every passive evolves at least two weapons. 20 new weapon evolutions (`ALT_EVOS`), each a variant of that weapon's evolution in its colors with its own profile: Lodestar Volley, Hawkeye Bow, Razor Quiver, Bulwark Ring, Grove Aura, Thunder Rage, Doom Star, Cinder Storm, Gale Wheels, Lucky Return, Chrono Beam, Fortune Prism, Magnet Mines, Headsman's Axe, Star Staff, Inferno Staff, Blood Souls, Knife Storm, Sun Heart, Blessed Light. A weapon with several matching passives offers each evolution as its own card.
- Passive evolutions: a passive at max level plus a weapon evolved with it offers its evolution (gold star icon, extra stats on top of the levels), e.g. Might → Titan Might, Heart → Giant's Heart.
- New passives: Ember (+12% elemental power per level) and Whetstone (+15% critical damage per level).
- Level up cards say what a passive evolves; the build view and the Arsenal list every evolution path and the passive evolution.
- Evolution book (main menu): weapon, passive and ability evolutions, fusions, upgrade qualities and augments, each as an icon recipe with how to get it.

**New hero: Takezo (0.32.0)**:
- A swordsman with two swords, inspired by Miyamoto Musashi (Niten Ichi-ryū). Weapon Two Swords: cuts in front of and behind him; evolves with Fury into Two Heavens as One, or with Whetstone into Book of the Void.
- Q Helm Splitter: overhead strike into a spot in front of you (damage, short stun); evolution Heaven Splitter (second, bigger blast further ahead, needs Area synergy).
- E Thousand Cuts: slashes in a cone in front; the number and speed of slashes scale with attack speed and Rhythm; evolution Two Heavens (slashes in front and behind, needs Speed synergy).
- R Iai: dash along your aim, a moment of stillness, then every enemy on the path takes a guaranteed critical cut; spends all Rhythm (+3% damage per point); evolution Final Cut (dash back and cut again, needs Crit synergy).
- Resource Rhythm (max 30): +1 per hit (every 0.1 s), +1.5% attack speed per point (+45% full), fades after 1.5 s without hits, getting hit costs 40%.
- Passive Mikiri (0.32.1, capped in 0.32.2): 5% chance to parry a hit or projectile at level 1, +0.6% per level, hard cap 35% including cards and Progression (they only reach the cap sooner); 0.1 s of invulnerability after a parry (only that hit). A parry negates the damage, cuts enemies around you and gives +3 Rhythm; a parried projectile flies back at the nearest enemy. The current chance is shown next to the Rhythm bar.
- 7 hero cards, a Progression tree (Earth, Water, Fire, Void), unlock: win an Expedition with Borgun or Vesper (granted on load if you already have such a win).
- Polish: English names inside Polish templates are translated piece by piece (`toPolish` in core/i18n.ts).

**Bosses, power and run summary (0.33.0)**:
- Every boss style has a third attack in each phase (12 new): Cross Fire, Abyss Bloom, Final Spiral; Spore Ring, Bog Rain, Hydra; Flame Fan, Burning Circle, Meteor Barrage; Void Lance, Mirror Blink, Collapse. Attacks rotate in a fixed order, and 0.7 s before each one its name appears above the boss with a warning that fits it: an aiming line, a ring around the boss or a closing circle under the player.
- Critical hits have their own sound, a flash ring and '!' on the number ('!!' for double crits). Evolutions, fusions and passive evolutions pause the game for a moment with rings, sparks and a fanfare. Elite kills show "Elite slain!" with a gold ring; Lucky find bursts gold.
- Kill streaks (kills at most 0.8 s apart): Rampage at 25, Massacre at 60, Carnage at 120, Annihilation at 250.
- End screen: new first tab Highlights (best weapon, peak DPS, biggest hit, longest combo, best kill streak, with Record! badges) and the list of hero records broken this run. New hero records: peak DPS, longest combo, best kill streak.

**Sound and music (0.34.0, generated part of phase 5)**:
- Weapon sounds by type and projectile (bolt, arrow, knife, fire, soul, chain lightning, holy nova, laser, meteor, boomerang, mines, cleave), ±6% pitch variation on game sounds, a limit of 22 simultaneous voices (important sounds always play) and ducking: boss, evolution, level up, chest, kill streak and getting hit briefly lower the music.
- Music themes: menu (major pentatonic), each biome with its own scale, progression, tempo, rhythm and instruments, and a boss theme per biome (bass ostinato, four-on-the-floor, faster tempo). Separate sliders: Sound effects and Music.
- 0.34.1: passive level-up cards show the evolutions they unlock as pictures (weapon > evolution, for weapons your hero can use) instead of a text line; the Evolution book is also in the pause menu.
- Not done yet: CC0 recordings (Kenney, OpenGameArt) — the cloud environment's network policy blocks those sites; the licence list and iPhone formats come with them.

### Jak przetestować

1. `npm run dev` → Endless → Nowy run → bohater (albo Ekspedycja → Nowa ekspedycja).
2. F3 włącza licznik FPS i liczby encji; F4 przyspiesza cel poziomu (+30 s albo +60 zabójstw), więc szybko dojdziesz do bossa; F6 daje natychmiastowy awans — co 5. awans pojawia się wybór karty.
3. Po bossie Ekspedycji: nagrody (skrzynia, awanse, karta) → mapa. Esc na mapie → Zapisz i wyjdź; w menu Ekspedycji pojawi się Kontynuuj.
4. Sklep: węzeł sklepu na mapie Ekspedycji; kup coś, wyjdź „Zapisz i wyjdź”, przeładuj stronę i Kontynuuj — sklep wraca w tym samym stanie.
5. Przeładuj stronę w trakcie runu Endless i wybierz Kontynuuj: run wznowi się z zapisanym czasem i zabójstwami. Poddanie w pauzie daje esencję (ekran końca).
6. Ewolucja: rozwiń broń do poziomu 8, weź pasywkę z jej opisu (np. Magiczny pocisk + Moc), a kolejny awans zaproponuje ewolucję.
7. Przedmioty: włącz debug (F3) i wciśnij F7 kilka razy — każde to łup bossa. Załóż coś, potem I/Tab otwiera ekwipunek; najedź na przedmiot w plecaku, żeby zobaczyć porównanie. Pauza pokazuje założone przedmioty.
8. Ekspedycja: menu → Ekspedycja → Nowa ekspedycja → bohater. Na mapie strzałki/mysz wybierają węzeł, Enter/klik wchodzi. W walce F3 + F4 szybko kończy cel. Esc na mapie → „Zapisz i wyjdź”, przeładuj stronę → Kontynuuj wraca na mapę (albo do przerwanej walki / otwartego sklepu).
9. Zasoby: Endless dowolnym bohaterem — pasek pod HP (Kestra: strzelaj z dystansu; Borgun: walcz wręcz; Ignara: Q/E, potem Spacja przy żarze 40+; Morwen: zabijaj blisko, potem R; Vesper: trafiaj bez obrywania, potem E; Aurel: Q i E, zabijaj blisko, potem R).
10. Zadania: po ok. 40 s pojawia się turkusowy kamień (znacznik na krawędzi ekranu) — dotknij go, panel po prawej pokazuje postęp i czas.
11. Moce bossów i unikaty: F3 + F4 kilka razy → boss → po nagrodach ekran „Moc bossa”. F7 daje łup bossa (12% na unikat); odkryte unikaty: Kolekcja → Tab.
12. Fuzje: F6 do maks. poziomu dwóch broni z receptury (np. Strzała + Meteor u Kestry) — awans zaproponuje „Fuzja”.
13. Pakty: wybór bohatera → Tab, ustaw poziomy strzałkami; poziom Paktu widać w HUD. Teren: bagno w biomie 2, lód w biomie 4 (Endless: kolejne biomy po bossach), arena zwęża się przy bossie.
14. Kuźnia: węzeł kowadła w Ekspedycji (daje też materiały) → przedmiot → „Kuźnia”. Klawisze 1-4: zwoje i ryzyko, Enter: kuj.
15. 0.15: Kowadło → B (warsztat); Kolekcja → Tab (sekrety, bestiariusz, osiągnięcia); Ustawienia → Muzyka, Trudność, Kształty żywiołów.
16. Wydajność: przy ~1000 wrogach symulacja zajmuje <1 ms na krok, render ~10 ms na klatkę w stylu 16-bit z cieniami, dekoracjami i efektami (Chromium headless, bez GPU — na zwykłej karcie graficznej szybciej).

## Kolejne etapy

0.15. Gotowe: warsztat Kuźni, sekrety, wydarzenia, nowi wrogowie, bossowie biomów, Vesper i Aurel, osiągnięcia, bestiariusz, wyzwanie dnia, sekretne tryby, dostępność, muzyka.
0.14. Gotowe: Kuźnia runiczna (ulepszanie do +15 z szansą, materiały, zwoje, pęknięcia, progi).
0.13. Gotowe: zasoby bohaterów, zadania, unikaty, moce bossów, fuzje broni, pakty ryzyka, teren.

4. Gotowe: sklep między poziomami, zestawy tagów, kowadło, kolekcja i bany kart, Ekspedycja, sloty zapisu per tryb.
7. Gotowe: 6 bohaterów (Kestra, Borgun, Ignara, Morwen, Vesper, Aurel).
5. Gotowe: meta-progresja, Paragon, prestiż, Endless, formatowanie liczb (break_infinity.js tylko, gdyby wartości wyszły poza zakres double).
6. Gotowe: optymalizacja (tryb oszczędnych efektów), polish, wirtualny joystick i przyciski na telefonie.
