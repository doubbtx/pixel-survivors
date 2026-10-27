import { W, H } from '../core/renderer';
import { C } from '../core/palette';
import { drawText, wrapText, textWidth } from '../core/font';
import { sfx } from '../core/audio';
import type { App, Screen } from './app';
import { panel, inside } from './widgets';

/** Strony pomocy: tytuł i akapity (pierwsze słowa przed dwukropkiem wyróżnione). */
const PAGES: { title: string; lines: string[] }[] = [
  {
    title: 'Klawisze',
    lines: [
      'Ruch: WASD albo strzałki. Broń strzela sama w najbliższych wrogów.',
      'Umiejętności: Q i E, unik: Spacja (chwilowa nietykalność), ultimate: R (ładuje się zabójstwami).',
      'Celowanie: myszą albo prawą gałką pada. W Ustawieniach możesz wybrać celowanie automatyczne.',
      'Menu w grze: Esc pauza, I albo Tab ekwipunek, K kowadło (między poziomami).',
      'Awans: 1-4 albo klik wybiera, R losuje ponownie, X pomija, B wygania opcję z puli do końca runu.',
      'Telefon: lewa połowa ekranu to joystick, ikony umiejętności w prawym dolnym rogu to przyciski.',
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
      'Przedmioty: skrzynie z elit i bossów. Kolor to jakość. Kowadło: Kuźnia do +15, przekuwanie i jakość (strona Moce).',
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
      'Furia (Borgun): rośnie od ciosów z bliska i obrywania. Daje obrażenia i redukcję obrażeń, poza walką opada.',
      'Żar (Ignara): Q i E rozgrzewają, czary są mocniejsze. Powyżej żółtej kreski żar cię rani. Unik (od 40 żaru) zrzuca go wybuchem.',
      'Dusze (Morwen): wrogowie ginący w pobliżu dają dusze. Pełne stają się sługą, R zużywa wszystkie na mocniejszą armię.',
      'Zadania: co minutę pojawia się turkusowy kamień. Dotknij go: zadanie z zegarem (panel po prawej) i nagrodą.',
      'Rodzaje zadań: Łowy, Obrona totemu, Krąg mocy, Bez skazy, Próba żywiołu. Porażka w części z nich przyzywa karną falę.',
    ],
  },
  {
    title: 'Moce',
    lines: [
      'Unikaty: rzadkie przedmioty z bossów i elit ze stałym efektem, który łamie zasady, zwykle za jakąś cenę. Kolekcja: Tab.',
      'Moc bossa: każdy biom ma własnego bossa z innymi atakami. Po zwycięstwie wybierasz 1 z 3 jego ataków. Strzela sam, ta sama moc rośnie.',
      'Fuzja: dwie bronie na maks. poziomie (albo po ewolucji) łączą się w hybrydę i zwalniają slot.',
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
      'Księga sekretów: ukryte buildy (np. pełna trucizna, same bronie ognia, 4 żywioły). Spełnij warunek, a sekret obudzi się do końca runu. Zagadki: Kolekcja, Tab.',
      'Fontanna życzeń: stań w niej i zapłać złotem. Zwykle błogosławieństwo, czasem klątwa.',
      'Runy: dotknij 4 kamieni w kolejności kolorów z malowidła. Zła kolejność to zasadzka.',
      'Grzyby: zjedz na własne ryzyko. Biały jeleń: złap go, a odsłoni ukryty gaj z unikatem.',
      'Mimik: niektóre skrzynie gryzą. Pęknięta ściana (fioletowa szczelina): rozbij ją, za nią są schody do skarbca.',
      'Kurhan: zbierz 3 klucze z elit. W środku czeka Zapomniany Król i jego moc.',
      'Bezbłędnie: pokonaj bossa bez trafienia, a dostaniesz dodatkową moc bossa.',
    ],
  },
  {
    title: 'Tryby',
    lines: [
      'Trening: jeden poziom, dobry na start i do nauki bohaterów.',
      'Hardcore: poziomy po kolei z bossami i sklepem między nimi. Śmierć kasuje cały run.',
      'Endless: jeden poziom bez końca, boss co 5 minut, coraz trudniej.',
      'Ekspedycja: 3 akty map z modyfikatorami (ryzyko za lepsze nagrody), lochy, kapliczki, sklepy.',
      'Rozwój: esencja z Ekspedycji kupuje węzły drzewka bohatera. Różowe klucze zmieniają umiejętności.',
      'Zapis: Hardcore, Endless i Ekspedycja zapisują się same. Wyjście z gry wznawia run.',
    ],
  },
];

/** Szerokość zakładki: wszystkie strony w jednym rzędzie. */
const TAB_W = Math.floor((W - 20) / PAGES.length) - 3;

/**
 * Pomoc (menu główne i pauza): strony ze sterowaniem i zasadami. Strzałki lewo/prawo albo klik w zakładkę: strona, Esc: wróć.
 */
export class HelpScreen implements Screen {
  private page = 0;

  constructor(private readonly app: App, private readonly back: Screen) {}

  private tabX(i: number): number {
    return 10 + i * (TAB_W + 3);
  }

  update(): void {
    const inp = this.app.input, n = PAGES.length;
    if (inp.pressed('back') || inp.pressed('pause')) { this.app.go(this.back); return; }
    if (inp.pressed('left') || inp.pressed('up')) { this.page = (this.page - 1 + n) % n; sfx.play('select'); }
    if (inp.pressed('right') || inp.pressed('down') || inp.pressed('confirm')) { this.page = (this.page + 1) % n; sfx.play('select'); }
    if (inp.pressed('click')) {
      PAGES.forEach((_, i) => { if (inside(inp.mouse.x, inp.mouse.y, this.tabX(i), 30, TAB_W, 16)) { this.page = i; sfx.play('select'); } });
      if (inside(inp.mouse.x, inp.mouse.y, W / 2 - 40, H - 22, 80, 16)) this.app.go(this.back);
    }
  }

  render(): void {
    const r = this.app.r, g = r.g;
    r.clear(C.black);
    drawText(g, 'Pomoc', W / 2, 6, C.yellow, { align: 'center', scale: 2, outline: C.black });
    PAGES.forEach((p, i) => {
      const on = i === this.page;
      panel(r, this.tabX(i), 30, TAB_W, 16, on ? C.gold : C.slate);
      drawText(g, p.title, this.tabX(i) + TAB_W / 2, 32, on ? C.white : C.lgray, { align: 'center' });
    });
    panel(r, 10, 52, W - 20, H - 80, C.gold);
    let y = 62;
    for (const line of PAGES[this.page].lines) {
      const cut = line.indexOf(':');
      const wrapped = wrapText(line, W - 44);
      wrapped.forEach((l, k) => {
        // Wyróżnienie nazwy przed dwukropkiem w pierwszej linii akapitu.
        if (k === 0 && cut > 0 && cut < l.length) {
          const head = l.slice(0, cut + 1);
          drawText(g, head, 22, y, C.yellow);
          drawText(g, l.slice(cut + 1), 22 + textWidth(head), y, C.lgray);
        } else drawText(g, l, 22, y, C.lgray);
        y += 11;
      });
      y += 5;
    }
    panel(r, W / 2 - 40, H - 22, 80, 16, C.slate);
    drawText(g, 'Wróć', W / 2, H - 20, C.lgray, { align: 'center' });
    drawText(g, 'Strzałki: strona', W - 12, H - 20, C.dgray, { align: 'right' });
  }
}
