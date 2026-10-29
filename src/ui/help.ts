import { W, H } from '../core/renderer';
import { C } from '../core/palette';
import { drawText, wrapText, textWidth, descS } from '../core/font';
import { sfx } from '../core/audio';
import type { App, Screen } from './app';
import { moreArrow, button, panel, inside, Scroll, titleBar } from './widgets';

/** Strony pomocy: tytuł i akapity (pierwsze słowa przed dwukropkiem wyróżnione). */
const PAGES: { title: string; lines: string[] }[] = [
  {
    title: 'Klawisze',
    lines: [
      'Ruch: WASD albo strzałki. Broń strzela sama w najbliższych wrogów.',
      'Umiejętności: Q i E, unik: Spacja (chwilowa nietykalność), ultimate: R (ładuje się zabójstwami).',
      'Celowanie: myszą albo prawą gałką pada. W Ustawieniach możesz wybrać celowanie automatyczne.',
      'Menu w grze: Esc pauza, I albo Tab ekwipunek, C bronie i pasywki (ewolucje, fuzje), K kowadło (między poziomami), F pełny ekran.',
      'Awans: 1-4 albo klik wybiera, R losuje ponownie, X pomija, B wygania opcję z puli do końca runu.',
      'Telefon: lewa połowa ekranu to joystick, ikony umiejętności w prawym dolnym rogu to przyciski.',
      'Gamepad: left stick moves, A dodges and confirms, X and B abilities, Y ultimate, Start pause, LT backpack, RT weapons and passives, LB / RB reroll and skip (map difficulty), right stick aims and scrolls.',
      'Keys: change them in Settings, General, Controls. Long texts: PageUp / PageDown, mouse wheel or drag.',
    ],
  },
  {
    title: 'Rozgrywka',
    lines: [
      'Cel poziomu: przetrwaj czas albo pokonaj wrogów (pasek u góry), potem boss.',
      'Doświadczenie: niebieskie kryształy z wrogów. Każdy awans to nowa broń, pasywka albo ulepszenie.',
      'Ulepszenia broni mają jakość: od Zwykłego do Legendarnego. Lepsza jakość daje dodatkowe bonusy.',
      'Ewolucja: broń na maksymalnym poziomie z pasywką z jej opisu zmienia się w mocniejszą wersję.',
      'Karty: rzadsze, mocne ulepszenia. Co 5 poziomów, po elicie i po bossie.',
      'Wierność broni: z jedną bronią od poziomu 10 co 5 poziomów dostajesz stopień (bez limitu): x1.35 obrażeń, szybkość ataku, obszar, pociski i ewolucja bez pasywki.',
      'Przedmioty: skrzynie z elit i bossów. Kolor to jakość. Kowadło: Kuźnia do +15, przekuwanie i jakość (strona Moce).',
      'Szczęście (pasywka Podkowa, afiks Fortuna, karty): lepsze przedmioty, częstsze skrzynie i unikaty, rzadsze karty, lepsza jakość ulepszeń broni.',
      'Trafia cię tylko mały środek postaci: przeciskaj się między pociskami.',
      'Nowi wrogowie: Tarczownik (blokuje pociski z przodu, obejdź go), Przywoływacz, Kamikaze (wybucha), Skoczek (teleport), Pajęczarz (sieci spowalniają).',
      'Wydarzenia: Krwawy księżyc (więcej elit i łupu), Złota godzina, Burza (pioruny w zaznaczone kręgi). Kombo: zabójstwa bez oberwania dają więcej złota.',
    ],
  },
  {
    title: 'Żywioły',
    lines: [
      'Ogień: podpalenie (obrażenia w czasie). Lód: spowolnienie, co 5. trafienie zamraża.',
      'Błyskawica: wróg dostaje więcej obrażeń. Trucizna: kumulujące się warstwy.',
      'Para (ogień + lód): ogłuszenie i dodatkowe obrażenia.',
      'Kruszenie (błyskawica + lód): następne trafienie zadaje podwójne obrażenia.',
      'Wybuch toksyn (ogień + trucizna): wybuch obszarowy za warstwy trucizny.',
      'Przewodzenie (błyskawica + trucizna): trucizna przeskakuje na pobliskich wrogów.',
      'Przeciążenie (ogień + błyskawica): mały wybuch z odrzutem.',
      'Odporność: każdy boss jest odporny na żywioł swojego biomu. Tabela reakcji: C, potem Tab.',
    ],
  },
  {
    title: 'Synergie',
    lines: [
      'Synergie: bohater, bronie, pasywki, karty i przedmioty dają punkty tagów (Ogień, Krytyk...).',
      'Progi 3, 6 i 9 punktów włączają kolejne bonusy. Lista jest pod portretem, szczegóły w pauzie.',
      'Wszechstronność: dodatkowy bonus za liczbę aktywnych synergii naraz.',
      'Augmenty (turkusowe karty): od 3. poziomu broni zmieniają jej działanie, np. odbijające się pociski.',
      'Polecane: znaczek przy najlepszej opcji awansu (ewolucje, nowe progi synergii, wysoka jakość).',
    ],
  },
  {
    title: 'Zasoby',
    lines: [
      'Zasób bohatera: pasek pod HP. Każdy bohater ma własny i zmienia on styl gry.',
      'Celność (Kestra): trafienia z dystansu dają więcej krytyków. Pełna wypuszcza darmową Salwę, oberwanie zabiera połowę.',
      'Furia (Borgun): rośnie od walki wręcz, obrywania i zabójstw obok. Pełna wyzwala Szał: kilka sekund mocniejszych, szybszych ciosów z leczeniem.',
      'Żar (Ignara): Q i E rozgrzewają, czary są mocniejsze. Powyżej żółtej kreski żar cię rani. Unik (od 40 żaru) zrzuca go wybuchem.',
      'Dusze (Morwen): wrogowie ginący w pobliżu dają dusze. Pełne stają się sługą, R zużywa wszystkie na mocniejszą armię.',
      'Kombo (Vesper): każde trafienie podbija obrażenia. Egzekucja (E) zużywa całe kombo, oberwanie je zeruje.',
      'Faith (Aurel): from kills nearby and healing. When full it gives Grace (healing and a shield); Judgment (R) spends all of it. Spear of Light (Q) Brands enemies: your hits on them heal you.',
    ],
  },
  {
    title: 'Moce',
    lines: [
      'Unikaty: rzadkie przedmioty z bossów i elit ze stałym efektem, który łamie zasady, zwykle za jakąś cenę. Kolekcja: Tab.',
      'Moc bossa: każdy biom ma własnego bossa z innymi atakami. Po zwycięstwie wybierasz 1 z 3 jego ataków. Strzela sam, ta sama moc rośnie.',
      'Fuzja: dwie bronie na maks. poziomie (albo po ewolucji) łączą się w hybrydę i zwalniają slot.',
      'Zadania: co minutę pojawia się turkusowy kamień. Dotknij go: zadanie z zegarem (panel po prawej) i nagrodą.',
      'Rodzaje zadań: Łowy, Obrona totemu, Krąg mocy, Bez skazy, Próba żywiołu. Porażka w części z nich przyzywa karną falę.',
      'Pakty: przed runem (wybór bohatera, Tab) włączasz utrudnienia. Więcej esencji i odznaki za bossa.',
      'Teren: osłony blokują pociski (także twoje) i da się je zniszczyć. Beczki wybuchają, kolce ranią wszystkich.',
      'Bagno spowalnia ciebie i wrogów, na lodzie się ślizgasz. Przy bossie arena się zwęża.',
    ],
  },
  {
    title: 'Kuźnia',
    lines: [
      'Kuźnia: w kowadle ulepszasz przedmiot do +15. Każda próba kosztuje złoto i materiał, i może się nie udać.',
      'Materiały: kamień kowalski (+1 do +3, wrogowie, rozkładanie), ruda gwiezdna (+4 do +6, elity, zadania, lochy), serce smoka (+7 do +9, bossowie), łza bogów (+10 do +12) i iskra pustki (+13 do +15).',
      'Warsztat (B w kowadle): przetapiasz niższe materiały w wyższe za odłamki i złoto. Łzy i iskry prawie tylko stąd. Może się nie udać.',
      'Porażka: nic, spadek o poziom albo pęknięcie (wartości -30%, napraw rudą). Każda porażka dodaje 5% szansy na następną próbę (litość).',
      'Zwoje: błogosławieństwo (bez spadku), smoka (+15% szansy), talizman (bez pęknięcia). Klawisze 1-3 w kuźni.',
      'Tryb ryzyka (klawisz 4): +10% szansy, ale pęknięcie NISZCZY przedmiot, już od +4.',
      'Progi: +3 nowy bonus, +6 blask (bonus bazowy x1.2), +9 Przebudzenie (efekt wg typu), +12 runa mocy (super-bonus), +15 Boski.',
    ],
  },
  {
    title: 'Sekrety',
    lines: [
      'Księga sekretów: ukryte buildy (np. pełna trucizna, same bronie ognia, 4 żywioły). Spełnij warunek, a sekret obudzi się do końca runu. Zagadki i warunki wprost: Kolekcja, zakładka Sekrety.',
      'Fontanna życzeń: stań w niej i zapłać złotem. Zwykle błogosławieństwo, czasem klątwa.',
      'Runy: dotknij 4 kamieni w kolejności kolorów z malowidła. Zła kolejność: runy znikają i jest zasadzka.',
      'Grzyby: zjedz na własne ryzyko. Biały jeleń: złap go, a odsłoni ukryty gaj z unikatem.',
      'Mimik: niektóre skrzynie gryzą. Pęknięta ściana (fioletowa szczelina): rozbij ją, za nią są schody do skarbca.',
      'Kurhan: zbierz 3 klucze z elit. W środku czeka Zapomniany Król i jego moc.',
      'Bezbłędnie: pokonaj bossa bez trafienia, a dostaniesz dodatkową moc bossa. Wyczyny (poziom bez trafienia, bez uniku, Rzeź...): nagrody, lista w Kolekcji.',
      'Void: in Endless with Pact 5 or higher, or after 20 minutes survived; after a full cycle of 4 biomes the Void replaces the next biome.',
      'Rozdarcie: na mapie Ekspedycji (akty 2-3) bywa pole ze znakiem zapytania. Wygrana walka w Pustce daje Klucz Pustki i sekretny akt 4.',
      'W grze różowe strzałki przy krawędzi ekranu wskazują sekrety mapy poza widokiem (z nazwą i odległością).',
    ],
  },
  {
    title: 'Tryby',
    lines: [
      'Expedition: a journey across 3 acts with a boss at the end of each. Endless: one level without end, a boss every few minutes.',
      'Expedition maps: before entering you pick the map difficulty (1-4): random risk modifiers for better rewards.',
      'Progression: essence from Expeditions and Endless (less, based on time) buys nodes in the hero tree. Pink keystones change abilities.',
      'Saving: Endless and Expedition save automatically. Quitting the game resumes the run.',
      'Osiągnięcia: odblokowują nowe karty w ofertach. Bestiariusz: zabijaj wrogów, by poznać opis i zdobyć bonus obrażeń.',
      'Skórki: odznaki Paktu (Brąz, Srebro, Złoto, Mistrz), X przy wyborze bohatera. Koniec runu: Tab pokazuje wykres DPS i build.',
    ],
  },
];

/** Przewijany obszar strony (x, y, w, h) w ramce pod zakładkami. */
const AREA = [12, 54, W - 24, H - 84] as const;

/** Szerokość zakładki: wszystkie strony w jednym rzędzie. */
const TAB_W = Math.floor((W - 20) / PAGES.length) - 3;

/**
 * Pomoc (menu główne i pauza): strony ze sterowaniem i zasadami. Strzałki lewo/prawo albo klik w zakładkę: strona, góra/dół: przewijanie, Esc: wróć.
 */
export class HelpScreen implements Screen {
  private page = 0;
  private scroll = new Scroll();

  constructor(private readonly app: App, private readonly back: Screen) {}

  private tabX(i: number): number {
    return 10 + i * (TAB_W + 3);
  }

  update(): void {
    const inp = this.app.input, n = PAGES.length;
    if (inp.pressed('back') || inp.pressed('pause')) { this.app.go(this.back); return; }
    // Lewo/prawo: strona; góra/dół, kółko, palec: przewijanie strony, gdy się nie mieści.
    this.scroll.update(inp, ...AREA, true);
    const before = this.page;
    if (inp.pressed('left')) { this.page = (this.page - 1 + n) % n; sfx.play('select'); }
    if (inp.pressed('right') || inp.pressed('confirm')) { this.page = (this.page + 1) % n; sfx.play('select'); }
    if (inp.pressed('click')) {
      PAGES.forEach((_, i) => { if (inside(inp.mouse.x, inp.mouse.y, this.tabX(i), 30, TAB_W, 16)) { this.page = i; sfx.play('select'); } });
      if (inside(inp.mouse.x, inp.mouse.y, W / 2 - 40, H - 22, 80, 16)) this.app.go(this.back);
    }
    if (this.page !== before) this.scroll.reset();
  }

  render(): void {
    const r = this.app.r, g = r.g;
    r.clear(C.black);
    titleBar(r, 'Pomoc', 6);
    PAGES.forEach((p, i) => {
      const on = i === this.page;
      button(r, this.tabX(i), 30, TAB_W, 16, p.title, { active: on, accent: C.gold });
    });
    panel(r, 10, 52, W - 20, H - 80);
    // Strona, która nie mieści się w ramce: mniejszym tekstem, a przy dużym tekście (Ustawienia) przewijana.
    const lines = PAGES[this.page].lines;
    const fits = lines.reduce((h, l) => h + wrapText(l, W - 44).length * 11 + 5, 0) <= H - 92;
    const sc = fits || descS() >= 1 ? 1 : 0.75, lh = sc >= 1 ? 11 : 8.5, gap = sc >= 1 ? 5 : 3;
    const oy = this.scroll.begin(r, ...AREA);
    let y = 62 - oy;
    for (const line of lines) {
      const wrapped = wrapText(line, (W - 44) / sc), cut = wrapped[0].indexOf(':');
      wrapped.forEach((l, k) => {
        // Wyróżnienie nazwy przed dwukropkiem w pierwszej linii akapitu.
        if (k === 0 && cut > 0 && cut < l.length) {
          const head = l.slice(0, cut + 1);
          drawText(g, head, 22, y, C.yellow, { scale: sc });
          drawText(g, l.slice(cut + 1), 22 + textWidth(head, sc), y, C.lgray, { scale: sc });
        } else drawText(g, l, 22, y, C.lgray, { scale: sc });
        y += lh;
      });
      y += gap;
    }
    this.scroll.end(r, y + oy - AREA[1], ...AREA);
    button(r, W / 2 - 40, H - 22, 80, 16, 'Wstecz [Esc]');
    // Kolejna strona: strzałka i podpis.
    if (this.page < PAGES.length - 1) {
      moreArrow(r, W - 16, H - 14, 1);
      drawText(g, `Dalej: ${PAGES[this.page + 1].title}`, W - 24, H - 20, C.lavender, { align: 'right' });
    }
  }
}
