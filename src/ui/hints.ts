import { W, H, type Renderer } from '../core/renderer';
import { C } from '../core/palette';
import { drawText, wrapText } from '../core/font';
import { sfx } from '../core/audio';
import type { SaveData } from '../core/save';
import { panel } from './widgets';
import { tile, UI } from './theme';
import { hudScale } from '../core/input';
import { belowHud, hudGap } from './hud';

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
  gear: 'Better loot is equipped automatically (Settings > General). Best gear [R] in the backpack checks everything; items you take off yourself stay off.',
  hurt: 'Oberwałeś! Trafia cię tylko mały środek postaci, więc da się przecisnąć między pociskami. Spacja = unik.',
} as const;

export type HintId = keyof typeof HINTS;

/** Miejsce na podpowiedź: lewy górny róg i szerokość; `up`: `y` to dolna krawędź. */
export interface HintBox { x: number; y: number; w: number; up?: boolean }

/**
 * Ekrany, na których pokazuje się podpowiedź (stany GameScreen); pozostałe dotyczą samej gry ('play'). Inne czekają w kolejce.
 * Wiedza, która nie ratuje życia w tej sekundzie (ekwipunek, reakcje, synergie, sekrety), czeka na spokojny ekran
 * (0.62, playtest: podpowiedzi o plecaku i reakcjach wyskakiwały w największym ścisku).
 */
const CALM = ['levelup', 'cards', 'map'];
const HINT_SCREEN: Partial<Record<HintId, string[]>> = {
  levelup: ['levelup'], augment: ['levelup'], fusion: ['levelup'], loot: ['loot'], unique: ['loot'], cards: ['cards'],
  power: ['power'], map: ['map'], shop: ['shop'], anvil: ['anvil'],
  gear: ['loot', 'map'], reaction: CALM, synergy: CALM, secret: CALM,
};
const onScreen = (id: HintId, screen: string) => (HINT_SCREEN[id] ?? ['play']).includes(screen);

/** Wersje podpowiedzi na dotyk (bez klawiszy); pozostałe nie wspominają klawiszy (np. `close`) i są wspólne. */
const TOUCH_TEXT: Partial<Record<HintId, string>> = {
  move: 'Drag on the left half of the screen to move. Your weapons fire on their own, you dodge enemies and their shots.',
  abilities: 'Buttons at the bottom right: Q and E are abilities (aimed at the nearest enemy), Dodge makes you untouchable for a moment.',
  ult: 'Ultimate ready! Tap the last button at the bottom right (R). It charges with kills.',
  hurt: 'You got hit! Only the small centre of your hero can be hit, so you can slip between bullets. Dodge button = untouchable dash.',
  loot: 'New item: equip it or put it in the backpack. Pause (top right) > Equipment opens your gear at any time.',
  levelup: 'Level up: tap a card to pick an upgrade. Card icons: evolution recipe and synergy tags. Buttons below: reroll, skip, banish.',
  shop: 'Shop: tap an offer to see it, tap again to buy. Equipment: sell spare items for gold.',
  map: 'Tap the next node, then Travel. Tap later nodes to preview routes. Difficulty buttons (top right) set the act difficulty: more modifiers (red dots) = bigger rewards.',
  gear: 'Better loot is equipped automatically (Settings > General). The Best gear button in the backpack checks everything; items you take off yourself stay off.',
  synergy: 'Synergy active! The list under the portrait shows tags and thresholds. Pause (top right) shows the details.',
  resource: 'The bar under HP is your hero resource. Every hero gains and spends it differently, see Help in the pause menu (top right).',
};

const SHOW = 6;
/** W walce krócej: ramka leży na polu bitwy. */
const SHOW_PLAY = 5;
/** Podpowiedź jest teraz na ekranie: nakładki chowają wtedy linię klawiszy i przyciski podglądu, w których miejscu stoi ramka. */
let showing = false;
export const hintShowing = (): boolean => showing;
/** Wielkość tekstu podpowiedzi (mniejsza niż zwykły tekst: podpowiedź nie może zasłaniać gry). */
const HINT_SCALE = 0.85;

export class Hints {
  private queue: HintId[] = [];
  private cur: HintId | null = null;
  private t = 0;
  /** Czas wyświetlania bieżącej podpowiedzi (wygaszanie i zamykanie). */
  private shown = SHOW;

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
    if (this.cur && !onScreen(this.cur, screen)) {
      // Podpowiedź nie pasuje do ekranu: wraca na początek kolejki.
      this.queue.unshift(this.cur);
      this.cur = null;
    }
    if (this.cur) { this.t -= dt; if (this.t <= 0) this.cur = null; }
    showing = !!this.cur && this.save.settings.hints;
    const i = this.queue.findIndex((id) => onScreen(id, screen));
    if (!this.cur && i >= 0) {
      this.cur = this.queue.splice(i, 1)[0];
      this.t = this.shown = screen === 'play' ? SHOW_PLAY : SHOW;
      showing = this.save.settings.hints;
      sfx.play('hover');
    }
  }

  /** Gracz już działa (np. wybiera węzeł mapy): podpowiedź wygasa, gdy była na ekranie co najmniej sekundę. */
  dismiss(): void {
    if (this.cur && this.shown - this.t > 1) this.t = Math.min(this.t, 0.2);
  }

  /**
   * Ramka z podpowiedzią w miejscu `box`, które ekran trzyma wolne (nigdy na tytule, legendzie ani przyciskach):
   * `y` to górna krawędź albo, przy `up`, dolna (ramka rośnie w górę). Bez `box`: w grze nad paskiem umiejętności
   * (na dotyku u góry pod celem poziomu, dół zajmują przyciski dotykowe). W nakładkach pełne okno, w grze lekka płytka.
   */
  render(r: Renderer, box: HintBox | null, touch: boolean): void {
    if (!this.cur || !this.save.settings.hints) return;
    const overlay = box !== null;
    // Na dotyku pod blokami lewego górnego rogu (karta, statusy, synergie) i banerem (ui/hud.ts
    // belowHud), węższa, gdy po prawej sięgają niżej przyciski dotykowe albo panel zadania; inaczej w prawej części dołu nad
    // paskiem umiejętności (jak w nakładkach), bo urośnięte gniazda broni i komunikat ekranu gry zajmują środek dołu.
    const k = hudScale(), tx = (W - 192) / 2;
    const b = box ?? (touch ? { x: tx, y: 52, w: Math.min(192, hudGap(52)[1] - UI.gap - tx) }
      : k > 1 ? { x: 232, y: H - UI.edge - (UI.ability + 4) * k - 2, w: W - 240, up: true }
      : { x: (W - 240) / 2, y: H - UI.edge - UI.ability - 8, w: 240, up: true });
    const lines = wrapText((touch && TOUCH_TEXT[this.cur]) || HINTS[this.cur], (b.w - 12) / HINT_SCALE);
    const h = 9 + lines.length * 9, y = b.up ? b.y - h : !box && touch ? belowHud(b.x, b.x + b.w, b.y, h) : b.y;
    const a = Math.min(1, this.t * 3, (this.shown - this.t) * 6);
    r.withAlpha(a, () => {
      // Cicha płytka (nie kolejne okno): kamienne tło i turkusowy znacznik po lewej, który mówi „to wskazówka”.
      if (overlay) panel(r, b.x, y, b.w, h);
      else tile(r, b.x, y, b.w, h, undefined, 0.78);
      r.roundRect(b.x + 2, y + 2, 1.5, h - 4, 0.75, C.cyan);
      lines.forEach((l, i) => drawText(r.g, l, b.x + 7, y + 4 + i * 9, C.lgray, { shadow: C.black, scale: HINT_SCALE }));
    });
  }
}
