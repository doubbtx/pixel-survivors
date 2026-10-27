import { W, H, type Renderer } from '../core/renderer';
import { C } from '../core/palette';
import { drawText, wrapText } from '../core/font';
import { sfx } from '../core/audio';
import type { SaveData } from '../core/save';
import { panel } from './widgets';

/**
 * Podpowiedzi kontekstowe: każda pokazuje się raz (zapis `save.seenHints`), w chwili gdy gracz pierwszy raz
 * trafia na daną mechanikę. Wyłączane w Ustawieniach (`settings.hints`), resetowane stamtąd. Kolejka po jednej naraz.
 */
export const HINTS = {
  move: 'Ruszasz się WASD albo strzałkami. Broń strzela sama, ty unikaj wrogów i ich pocisków.',
  abilities: 'Q i E to umiejętności, Spacja to unik z nietykalnością. Celujesz myszą.',
  gems: 'Zbieraj niebieskie kryształy z pokonanych wrogów: dają doświadczenie i awans.',
  levelup: 'Awans: wybierz jedno ulepszenie (1-4 albo klik). R losuje ponownie, X pomija, B wygania opcję z puli.',
  ult: 'Ultimate gotowy! Wciśnij R. Ładuje się zabójstwami.',
  chest: 'Skrzynia na ziemi! Podejdź, żeby ją podnieść. Kolor poświaty to jakość przedmiotu.',
  loot: 'Nowy przedmiot: załóż go albo schowaj do plecaka. I otwiera ekwipunek w każdej chwili.',
  cards: 'Karta: rzadsze i mocniejsze ulepszenie. Tagi na dole budują synergie (zestawy bonusów).',
  elite: 'Elita (żółty krąg): silniejszy wróg, ale daje skrzynię i kartę.',
  boss: 'Boss! Pokonaj go, żeby ukończyć poziom. Uważaj na jego salwy.',
  synergy: 'Synergia aktywna! Lista pod portretem pokazuje tagi i progi. Pauza (Esc) pokazuje szczegóły.',
  augment: 'Augment (turkusowa karta) zmienia działanie broni, nie tylko liczby.',
  reaction: 'Reakcja żywiołów! Dwa różne żywioły na jednym wrogu dają dodatkowy efekt. Szczegóły w Pomocy.',
  map: 'Mapa wyprawy: wybierz kolejny węzeł. Klawisze 1-4 ustawiają trudność mapy: więcej modyfikatorów (czerwone kropki) to większa nagroda.',
  shop: 'Sklep: kup przedmioty i usługi. I otwiera ekwipunek (rozłóż zbędne przedmioty na złoto), K kowadło.',
  anvil: 'Kowadło: Kuźnia ulepsza przedmioty do +15 za złoto i materiały, ale może się nie udać. Przekuwanie kosztuje odłamki.',
  unique: 'Unikat! Ma stały efekt, który łamie zasady gry, zwykle za jakąś cenę. Nie da się go przekuć. Trafia do kolekcji.',
  fusion: 'Fuzja! Dwie bronie na maksymalnym poziomie łączą się w mocniejszą hybrydę i zwalniają slot na nową broń.',
  power: 'Moc bossa: wybrany atak bossa strzela sam w twoich wrogów. Ikona obok broni pokazuje odnowienie.',
  terrain: 'Teren: osłony blokują pociski wrogów i twoje, beczki wybuchają, kolce ranią wszystkich. Wciągaj w to wrogów!',
  secret: 'Sekret! Ten świat skrywa więcej: fontanny, runy, grzyby, pęknięte ściany, kurhany. Szczegóły w Pomocy (Sekrety).',
  resource: 'Pasek pod HP to zasób bohatera. Każdy bohater zdobywa go i używa inaczej, opis w Pomocy (Esc).',
  task: 'Zadanie! Dotknij turkusowego kamienia, żeby je zacząć. Za wykonanie nagroda, za część porażek karna fala.',
  hurt: 'Oberwałeś! Trafia cię tylko mały środek postaci, więc da się przecisnąć między pociskami. Spacja = unik.',
} as const;

export type HintId = keyof typeof HINTS;

const SHOW = 6;

export class Hints {
  private queue: HintId[] = [];
  private cur: HintId | null = null;
  private t = 0;

  constructor(private readonly save: SaveData, private readonly persist: () => void) {}

  /** Dodaje podpowiedź do kolejki, jeśli jeszcze jej nie było (i podpowiedzi są włączone). */
  show(id: HintId): void {
    if (!this.save.settings.hints || this.save.seenHints.includes(id) || this.queue.includes(id) || this.cur === id) return;
    this.save.seenHints.push(id);
    this.persist();
    this.queue.push(id);
  }

  update(dt: number): void {
    if (this.cur) { this.t -= dt; if (this.t <= 0) this.cur = null; }
    if (!this.cur && this.queue.length) {
      this.cur = this.queue.shift()!;
      this.t = SHOW;
      sfx.play('hover');
    }
  }

  /** Ramka z podpowiedzią: w grze nad dolną krawędzią (między slotami broni a umiejętnościami), w nakładkach przy samym dole. */
  render(r: Renderer, overlay: boolean): void {
    if (!this.cur || !this.save.settings.hints) return;
    const lines = wrapText(HINTS[this.cur], overlay ? 300 : 196);
    const w = overlay ? 316 : 212, h = 12 + lines.length * 11, x = (W - w) / 2, y = overlay ? H - h - 2 : H - h - 50;
    const a = Math.min(1, this.t * 3, (SHOW - this.t) * 6);
    r.withAlpha(a, () => {
      panel(r, x, y, w, h, C.cyan);
      lines.forEach((l, i) => drawText(r.g, l, x + 8, y + 6 + i * 11, C.white, { shadow: C.black }));
    });
  }
}
