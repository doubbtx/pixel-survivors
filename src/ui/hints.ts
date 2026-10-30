import { W, H, type Renderer } from '../core/renderer';
import { C } from '../core/palette';
import { drawText, wrapText } from '../core/font';
import { sfx } from '../core/audio';
import type { SaveData } from '../core/save';
import { panel } from './widgets';
import { tile, UI } from './theme';

/**
 * Podpowiedzi kontekstowe: każda pokazuje się raz (zapis `save.seenHints`), w chwili gdy gracz pierwszy raz
 * trafia na daną mechanikę. Wyłączane w Ustawieniach (`settings.hints`), resetowane stamtąd. Kolejka po jednej naraz.
 */
export const HINTS = {
  move: 'Ruszasz się WASD albo strzałkami. Broń strzela sama, ty unikaj wrogów i ich pocisków.',
  abilities: 'Q i E to umiejętności, Spacja to unik z nietykalnością. Celujesz myszą.',
  gems: 'Zbieraj niebieskie kryształy z pokonanych wrogów: dają doświadczenie i awans.',
  levelup: 'Level up: pick one upgrade (1-4 or click). Icons at the bottom of a card: evolution recipe (weapon + passive > evolution) and synergy tags. R rerolls, X skips, B banishes an option from the pool.',
  ult: 'Ultimate gotowy! Wciśnij R. Ładuje się zabójstwami.',
  chest: 'Skrzynia na ziemi! Podejdź, żeby ją podnieść. Kolor poświaty to jakość przedmiotu.',
  loot: 'Nowy przedmiot: załóż go albo schowaj do plecaka. I otwiera ekwipunek w każdej chwili.',
  cards: 'Karta: rzadsze i mocniejsze ulepszenie. Tagi na dole budują synergie (zestawy bonusów).',
  elite: 'Elita (żółty krąg): silniejszy wróg, ale daje skrzynię i kartę.',
  boss: 'Boss! Pokonaj go, żeby ukończyć poziom. Uważaj na jego salwy.',
  synergy: 'Synergia aktywna! Lista pod portretem pokazuje tagi i progi. Pauza (Esc) pokazuje szczegóły.',
  augment: 'Augment (turkusowa karta) zmienia działanie broni, nie tylko liczby.',
  reaction: 'Reakcja żywiołów! Dwa różne żywioły na jednym wrogu dają dodatkowy efekt. Szczegóły w Pomocy.',
  map: 'Pick the next node (click or arrows), then Travel (Enter). Point at later nodes to preview routes. Keys 1-4: difficulty for the act, more modifiers (red dots) = bigger rewards.',
  shop: 'Sklep: kup przedmioty i usługi. I otwiera ekwipunek (rozłóż zbędne przedmioty na złoto), K kowadło.',
  anvil: 'Kowadło: Kuźnia ulepsza przedmioty do +15 za złoto i materiały, ale może się nie udać. Przekuwanie kosztuje odłamki.',
  unique: 'Unikat! Ma stały efekt, który łamie zasady gry, zwykle za jakąś cenę. Nie da się go przekuć. Trafia do kolekcji.',
  fusion: 'Fuzja! Dwie bronie na maksymalnym poziomie łączą się w mocniejszą hybrydę i zwalniają slot na nową broń.',
  power: 'Moc bossa: wybrany atak bossa strzela sam w twoich wrogów. Ikona obok broni pokazuje odnowienie.',
  terrain: 'Teren: osłony blokują pociski wrogów i twoje, beczki wybuchają, kolce ranią wszystkich. Wciągaj w to wrogów!',
  secret: 'Sekret! Ten świat skrywa więcej: fontanny, runy, grzyby, pęknięte ściany, kurhany. Szczegóły w Pomocy (Sekrety).',
  resource: 'Pasek pod HP to zasób bohatera. Każdy bohater zdobywa go i używa inaczej, opis w Pomocy (Esc).',
  task: 'Zadanie! Dotknij turkusowego kamienia, żeby je zacząć. Za wykonanie nagroda, za część porażek karna fala.',
  close: 'Close combat: hits on enemies right next to you deal +20% damage; each such hit flashes a white ring around you. Melee weapons are built for it.',
  hurt: 'Oberwałeś! Trafia cię tylko mały środek postaci, więc da się przecisnąć między pociskami. Spacja = unik.',
} as const;

export type HintId = keyof typeof HINTS;

/** Miejsce na podpowiedź: lewy górny róg i szerokość; `up`: `y` to dolna krawędź. */
export interface HintBox { x: number; y: number; w: number; up?: boolean }

/** Ekran, na którym pokazuje się podpowiedź (stan GameScreen); pozostałe dotyczą samej gry ('play'). Inne czekają w kolejce. */
const HINT_SCREEN: Partial<Record<HintId, string>> = {
  levelup: 'levelup', augment: 'levelup', fusion: 'levelup', loot: 'loot', unique: 'loot', cards: 'cards',
  power: 'power', map: 'map', shop: 'shop', anvil: 'anvil',
};
const screenOf = (id: HintId) => HINT_SCREEN[id] ?? 'play';

/** Wersje podpowiedzi na dotyk (bez klawiszy). */
const TOUCH_TEXT: Partial<Record<HintId, string>> = {
  move: 'Drag on the left half of the screen to move. Your weapons fire on their own, you dodge enemies and their shots.',
};

const SHOW = 6;
/** Podpowiedź jest teraz na ekranie: nakładki chowają wtedy linię klawiszy i przyciski podglądu, w których miejscu stoi ramka. */
let showing = false;
export const hintShowing = (): boolean => showing;
/** Wielkość tekstu podpowiedzi (mniejsza niż zwykły tekst: podpowiedź nie może zasłaniać gry). */
const HINT_SCALE = 0.85;

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

  /** `screen`: bieżący stan ekranu gry; pokazywane są tylko podpowiedzi do niego (inne czekają w kolejce). */
  update(dt: number, screen: string): void {
    showing = false;
    if (this.cur && screenOf(this.cur) !== screen) {
      // Podpowiedź nie pasuje do ekranu: wraca na początek kolejki.
      this.queue.unshift(this.cur);
      this.cur = null;
    }
    if (this.cur) { this.t -= dt; if (this.t <= 0) this.cur = null; }
    showing = !!this.cur && this.save.settings.hints;
    const i = this.queue.findIndex((id) => screenOf(id) === screen);
    if (!this.cur && i >= 0) {
      this.cur = this.queue.splice(i, 1)[0];
      this.t = SHOW;
      showing = this.save.settings.hints;
      sfx.play('hover');
    }
  }

  /**
   * Ramka z podpowiedzią w miejscu `box`, które ekran trzyma wolne (nigdy na tytule, legendzie ani przyciskach):
   * `y` to górna krawędź albo, przy `up`, dolna (ramka rośnie w górę). Bez `box`: w grze nad paskiem umiejętności
   * (na dotyku u góry pod celem poziomu, dół zajmują przyciski dotykowe). W nakładkach pełne okno, w grze lekka płytka.
   */
  render(r: Renderer, box: HintBox | null, touch: boolean): void {
    if (!this.cur || !this.save.settings.hints) return;
    const overlay = box !== null;
    const b = box ?? (touch ? { x: (W - 192) / 2, y: 52, w: 192 } : { x: (W - 240) / 2, y: H - UI.edge - UI.ability - 8, w: 240, up: true });
    const lines = wrapText((touch && TOUCH_TEXT[this.cur]) || HINTS[this.cur], (b.w - 12) / HINT_SCALE);
    const h = 9 + lines.length * 9, y = b.up ? b.y - h : b.y;
    const a = Math.min(1, this.t * 3, (SHOW - this.t) * 6);
    r.withAlpha(a, () => {
      // Cicha płytka (nie kolejne okno): kamienne tło i turkusowy znacznik po lewej, który mówi „to wskazówka”.
      if (overlay) panel(r, b.x, y, b.w, h);
      else tile(r, b.x, y, b.w, h, undefined, 0.78);
      r.roundRect(b.x + 2, y + 2, 1.5, h - 4, 0.75, C.cyan);
      lines.forEach((l, i) => drawText(r.g, l, b.x + 7, y + 4 + i * 9, C.lgray, { shadow: C.black, scale: HINT_SCALE }));
    });
  }
}
