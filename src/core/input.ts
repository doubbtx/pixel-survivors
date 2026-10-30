import { W, H, OX, type Renderer } from './renderer';

/** Abstrakcyjne akcje — logika gry nie wie nic o konkretnych klawiszach czy przyciskach pada. */
export type Action =
  | 'up' | 'down' | 'left' | 'right'
  | 'q' | 'e' | 'dash' | 'ult'
  | 'pause' | 'confirm' | 'back' | 'click' | 'inventory' | 'fullscreen'
  | 'reroll' | 'skip' | 'banish' | 'anvil' | 'build' | 'synergies' | 'torment'
  | 'n1' | 'n2' | 'n3' | 'n4' | 'pageUp' | 'pageDown'
  | 'debug' | 'debugTime' | 'debugLevel' | 'debugLoot';

/** Klawisze stałe (menu: strzałki, Enter, Esc, Tab, cyfry, przewijanie, debug) — zawsze działają, niezależnie od przypisań. */
const FIXED: Record<string, Action[]> = {
  ArrowUp: ['up'], ArrowDown: ['down'], ArrowLeft: ['left'], ArrowRight: ['right'],
  Space: ['confirm'], KeyR: ['reroll'], Enter: ['confirm'], Escape: ['pause', 'back'], KeyF: ['fullscreen'], Tab: ['inventory'], KeyT: ['torment'],
  Digit1: ['n1'], Digit2: ['n2'], Digit3: ['n3'], Digit4: ['n4'], PageUp: ['pageUp'], PageDown: ['pageDown'],
  F3: ['debug'], Backquote: ['debug'], F4: ['debugTime'], F6: ['debugLevel'], F7: ['debugLoot'],
};

/** Akcje do zmiany w Ustawieniach → Sterowanie (ui/controls.ts) i ich domyślne klawisze (KeyboardEvent.code). */
export const REBIND: [Action, string][] = [
  ['up', 'KeyW'], ['down', 'KeyS'], ['left', 'KeyA'], ['right', 'KeyD'],
  ['q', 'KeyQ'], ['e', 'KeyE'], ['dash', 'Space'], ['ult', 'KeyR'],
  ['inventory', 'KeyI'], ['build', 'KeyC'], ['synergies', 'KeyY'], ['skip', 'KeyX'], ['banish', 'KeyB'], ['anvil', 'KeyK'], ['pause', 'KeyP'],
];
const DEFAULT_KEY = Object.fromEntries(REBIND) as Partial<Record<Action, string>>;

let bindings: Partial<Record<Action, string>> = {};
let KEYMAP = buildKeymap();

function buildKeymap(): Record<string, Action[]> {
  const m: Record<string, Action[]> = {};
  for (const [k, v] of Object.entries(FIXED)) m[k] = [...v];
  for (const [a] of REBIND) {
    const code = keyOf(a);
    if (!(m[code] ??= []).includes(a)) m[code].push(a);
  }
  return m;
}

/** Przypisania gracza (Settings.keys: akcja → kod klawisza); brakujące = domyślne. */
export function setBindings(b: Partial<Record<Action, string>>): void {
  bindings = { ...b };
  KEYMAP = buildKeymap();
}

/** Bieżący klawisz akcji do zmiany. */
export function keyOf(a: Action): string {
  return bindings[a] ?? DEFAULT_KEY[a] ?? '';
}

/** Czytelna nazwa klawisza: „KeyQ” → „Q”, „Digit5” → „5”, „ShiftLeft” → „L-Shift”. */
export function keyName(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  const side = code.endsWith('Left') ? 'L-' : code.endsWith('Right') ? 'R-' : '';
  const base = side ? code.replace(/(Left|Right)$/, '') : code;
  const named: Record<string, string> = { Space: 'Space', Control: 'Ctrl', Meta: 'Cmd', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\' };
  return side + (named[base] ?? base);
}

/** Klawisz akcji na klawiaturze (ekran Sterowania). */
export const keyboardKey = (a: Action): string => keyName(keyOf(a));

/** Gra padem (ostatnie urządzenie): podpowiedzi pokazują przyciski pada zamiast klawiszy (Input.lastDevice). */
let padActive = false;
/** Gra dotykiem (ostatnie urządzenie): napisy tracą oznaczenia klawiszy („ [R]”), bo na telefonie nie ma klawiatury. */
let touchActive = false;
/** Ostatnie urządzenie to dotyk (dla miejsc bez dostępu do Input, np. render ekranów). */
export const isTouch = (): boolean => touchActive;
const PAD_NAMES = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Start', 'L3', 'R3'];
/** Przycisk pada dla akcji (pierwszy z PADMAP) albo null (ruch, akcje bez przycisku). */
function padButton(a: Action): string | null {
  for (const [i, acts] of Object.entries(PADMAP)) if (acts.includes(a) && PAD_NAMES[+i]) return PAD_NAMES[+i];
  return null;
}

/** Klawisz akcji do wyświetlenia (HUD, opisy umiejętności, samouczek): przy padzie nazwa przycisku pada. */
export const actionKey = (a: Action): string => (padActive && padButton(a)) || keyboardKey(a);

/** Czy tekst w nawiasach to nazwa klawisza (stałego, domyślnego albo przypisanego), a nie np. licznik „[2/3]”. */
function isKeyLabel(k: string): boolean {
  if (k === 'Esc' || k === 'Spc') return true;
  return [...Object.keys(FIXED), ...REBIND.map(([, c]) => c), ...Object.values(bindings)].some((c) => c && keyName(c) === k);
}

/** Klawisze menu w napisach („[Esc]”, „[Enter]”) — stałe, poza przypisaniami. */
const MENU_KEYS: Record<string, Action> = { Esc: 'back', Enter: 'confirm' };
/** Kolejność dopasowania klawisza do akcji: napisy w nawiasach są w menu, więc R to najpierw „losuj”, nie ultimate. */
const GLYPH_ORDER: Action[] = ['reroll', 'skip', 'banish', 'inventory', 'build', 'synergies', 'anvil', 'pause', 'q', 'e', 'dash', 'ult'];
/**
 * Napis z klawiszami w nawiasach („Reroll (3) [R]”) przy grze padem: klawisz zamieniony na przycisk pada tej samej akcji
 * („[LB]”); akcja bez przycisku pada traci oznaczenie. Bez pada albo bez dopasowania napis zostaje bez zmian.
 * Wołane raz, po tłumaczeniu (core/font.ts).
 */
export function keyGlyphs(s: string): string {
  if (!s.includes('[')) return s;
  if (touchActive) {
    // Dotyk: oznaczenie klawisza znika razem z jedną spacją („Reroll (3) [R]” → „Reroll (3)”, „[B] Przydziel” → „Przydziel”).
    return s.replace(/( ?)\[([^\]]+)\]( ?)/g, (m, a: string, k: string, b: string) => (isKeyLabel(k) ? (a && b ? ' ' : '') : m));
  }
  if (!padActive) {
    // Klawiatura: napisy mają domyślne klawisze — po zmianie przypisania pokazujemy bieżący klawisz akcji.
    // Bez przypisań (szybka ścieżka) albo gdy klawisz z napisu nadal działa dla jakiejś akcji — bez zmian.
    if (!Object.keys(bindings).length) return s;
    return s.replace(/\[([^\]]+)\]/g, (m, k: string) => {
      const a = GLYPH_ORDER.find((x) => (DEFAULT_KEY[x] && keyName(DEFAULT_KEY[x]!) === k) || Object.entries(FIXED).some(([c, acts]) => acts.includes(x) && keyName(c) === k));
      if (!a || !bindings[a] || REBIND.some(([x]) => keyboardKey(x) === k)) return m;
      return `[${keyboardKey(a)}]`;
    });
  }
  return s.replace(/ ?\[([^\]]+)\]/g, (m, k: string) => {
    const a = MENU_KEYS[k] ?? GLYPH_ORDER.find((x) => keyboardKey(x) === k || Object.entries(FIXED).some(([c, acts]) => acts.includes(x) && keyName(c) === k));
    if (!a) return m;
    const b = padButton(a);
    return b ? m.replace(`[${k}]`, `[${b}]`) : '';
  });
}


/**
 * Rozmiar HUD-u (Ustawienia → Czytelność, Settings.hudScale: 1 / 1.25 / 1.5): bloki w rogach ekranu (ui/hud.ts) skalowane
 * wokół swojego narożnika, więc rosną w stronę środka. Tutaj, bo od niego zależą też obszary dotyku gniazd umiejętności.
 */
let hudK = 1;
export function setHudScale(k: number): void { hudK = k; }
export const hudScale = (): number => hudK;

/** Gniazda umiejętności w HUD (prawy dół) — na telefonie są też przyciskami dotykowymi. Kolejność: Q, E, unik, R. */
export const ABILITY_SLOT = 32;
/**
 * Lewy górny róg gniazda `i` w skali `k` (domyślnie rozmiar HUD-u; ui/hud.ts rysuje w skali 1 pod przekształceniem płótna
 * wokół tego samego narożnika: prawy dolny róg okna minus margines 4). Bok gniazda: ABILITY_SLOT · k.
 */
export function abilitySlotPos(i: number, k = hudK): [number, number] {
  // Szeroki ekran: przy prawej krawędzi okna (OX), jak cały prawy blok HUD.
  return [W + OX - 4 - (4 - i) * (ABILITY_SLOT + 3) * k, H - 4 - ABILITY_SLOT * k];
}
const TOUCH_ACTIONS: Action[] = ['q', 'e', 'dash', 'ult'];
/**
 * Przyciski dotykowe pauzy, buildu i plecaka w kolumnie (większy HUD): blok liczników i minimapy sięga wtedy dalej w lewo,
 * a wiersz przycisków wszedłby pod zegar, cel i pasek bossa — kolumna stoi na lewo od tego bloku.
 */
export const touchColumn = (): boolean => hudK > 1;
/**
 * Przycisk pauzy na ekranie dotykowym (lewo od licznika zabójstw). W kolumnie (większy HUD): 8 px na lewo od bloku liczników
 * i minimapy (szerokość 70 = UI.minimap.w, skalowana, plus margines 4).
 */
export const TOUCH_PAUSE = { get x(): number { return touchColumn() ? W + OX - 4 - 70 * hudK - 8 - 20 : W + OX - 110; }, y: 8, s: 20 };
/** Przyciski dotykowe obok pauzy (od pauzy w lewo albo w kolumnie w dół): build (C) i plecak (I); ten sam rozmiar co pauza. */
export const TOUCH_MENU: Action[] = ['build', 'inventory'];
export function touchMenuPos(i: number): [number, number] {
  const d = (i + 1) * (TOUCH_PAUSE.s + 4);
  return touchColumn() ? [TOUCH_PAUSE.x, TOUCH_PAUSE.y + d] : [TOUCH_PAUSE.x - d, TOUCH_PAUSE.y];
}
/** Plakietka „nowy przedmiot w plecaku” w HUD (współrzędne ekranu, ustawia ui/hud.ts przy rysowaniu): dotknięcie otwiera plecak. */
export const TOUCH_BAG_PILL = { on: false, x: 0, y: 0, w: 0, h: 0 };
/** Zasięg wychylenia wirtualnego joysticka (piksele logiczne). */
export const STICK_R = 26;

/** Standardowe mapowanie Gamepad API (Xbox: A=0, B=1, X=2, Y=3, LB=4, RB=5, LT=6, RT=7, View=8, Start=9, prawa gałka=11, D-pad=12..15). */
const PADMAP: Record<number, Action[]> = {
  0: ['confirm', 'dash'], 1: ['back', 'e'], 2: ['q'], 3: ['ult'],
  4: ['reroll'], 5: ['skip'], 9: ['pause'], 8: ['banish'], 6: ['inventory'], 7: ['build'], 11: ['anvil'],
  12: ['up'], 13: ['down'], 14: ['left'], 15: ['right'],
};

export class Input {
  private held = new Set<Action>();
  private pressedSet = new Set<Action>();
  private padHeld = new Set<Action>();
  /** Pozycja myszy/dotyku w pikselach logicznych. */
  mouse = { x: 0, y: 0, down: false, lastMove: -1e9 };
  /** Lewa gałka pada / wirtualny joystick (oś ruchu). */
  private padMove = { x: 0, y: 0 };
  /** Prawa gałka pada (celowanie). */
  padAim = { x: 0, y: 0 };
  private device: 'kbm' | 'pad' | 'touch' = 'kbm';
  /** Ostatnio używane urządzenie (podświetlenia, podpowiedzi klawiszy / przycisków pada). */
  get lastDevice(): 'kbm' | 'pad' | 'touch' { return this.device; }
  set lastDevice(d: 'kbm' | 'pad' | 'touch') { this.device = d; padActive = d === 'pad'; touchActive = d === 'touch'; }
  /**
   * Sterowanie dotykowe w grze: lewa połowa ekranu = wirtualny joystick, gniazda umiejętności = przyciski.
   * Włącza je ekran gry w stanie rozgrywki (app.go wyłącza); poza tym dotyk działa jak klik myszą.
   */
  touchControls = false;
  /** Wirtualny joystick: środek i bieżąca pozycja (do rysowania), null = nieaktywny. */
  stick: { id: number; ox: number; oy: number; x: number; y: number } | null = null;
  /** Dotknięcia trzymające przyciski (id wskaźnika → akcja). */
  private touchHeld = new Map<number, Action>();
  /** Okno straciło fokus od ostatniego kroku (dla auto-pauzy); czyszczone jak zbocza. */
  focusLost = false;
  /** Przewinięcie w pikselach logicznych od ostatniego kroku (kółko myszy, przeciąganie palcem; dodatnie = w dół). */
  scroll = 0;
  /** Następny wciśnięty klawisz trafia tutaj zamiast do gry (zmiana przypisania). */
  capture: ((code: string) => void) | null = null;
  /** Dowolny klawisz (także bez przypisanej akcji) naciśnięty od ostatniego kroku. */
  private anyKey = false;

  constructor(renderer: Renderer, canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (e) => {
      // Przechwycenie klawisza (Ustawienia → Sterowanie): bez akcji gry.
      if (this.capture && !e.repeat) { e.preventDefault(); const cb = this.capture; this.capture = null; cb(e.code); return; }
      if (!e.repeat) this.anyKey = true;
      const acts = KEYMAP[e.code];
      if (!acts) return;
      e.preventDefault();
      this.lastDevice = 'kbm';
      if (e.repeat) return;
      for (const a of acts) { this.held.add(a); this.pressedSet.add(a); }
    });
    window.addEventListener('keyup', (e) => {
      for (const a of KEYMAP[e.code] ?? []) this.held.delete(a);
    });
    window.addEventListener('blur', () => { this.held.clear(); this.focusLost = true; });
    const pos = (e: PointerEvent) => {
      const p = renderer.toLogical(e.clientX, e.clientY);
      this.mouse.x = p.x;
      this.mouse.y = p.y;
      // Rysik (pen) jak dotyk: joystick i przyciski umiejętności.
      if (e.pointerType !== 'mouse') { this.lastDevice = 'touch'; return; }
      this.mouse.lastMove = performance.now();
      this.lastDevice = 'kbm';
    };
    canvas.addEventListener('pointermove', (e) => {
      const py = this.mouse.y;
      pos(e);
      // Przeciąganie palcem poza rozgrywką przewija panele (ui/widgets.ts Scroll).
      if (e.pointerType !== 'mouse' && this.mouse.down && !this.touchControls) this.scroll += py - this.mouse.y;
      if (this.stick && this.stick.id === e.pointerId) { this.stick.x = this.mouse.x; this.stick.y = this.mouse.y; }
    });
    canvas.addEventListener('pointerdown', (e) => {
      pos(e);
      if (e.pointerType !== 'mouse' && this.touchControls && this.touchDown(e.pointerId)) return;
      this.mouse.down = true;
      this.pressedSet.add('click');
    });
    const up = (e: PointerEvent) => {
      this.mouse.down = false;
      if (this.stick?.id === e.pointerId) this.stick = null;
      const a = this.touchHeld.get(e.pointerId);
      if (a) { this.touchHeld.delete(e.pointerId); this.held.delete(a); }
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => { this.scroll += Math.sign(e.deltaY) * Math.min(40, Math.abs(e.deltaY) / 4 + 8); e.preventDefault(); }, { passive: false });
  }

  /** Dotyk w trakcie gry: przycisk umiejętności, pauza, build, plecak albo start joysticka (lewa połowa). True = obsłużony. */
  private touchDown(id: number): boolean {
    const { x, y } = this.mouse;
    for (let i = 0; i < TOUCH_ACTIONS.length; i++) {
      // Obszar dotyku skalowany tak samo jak rysowane gniazdo (rozmiar HUD-u).
      const [bx, by] = abilitySlotPos(i), k = hudK;
      if (x >= bx - 3 * k && x < bx + (ABILITY_SLOT + 3) * k && y >= by - 6 * k && y < by + (ABILITY_SLOT + 4) * k) {
        const a = TOUCH_ACTIONS[i];
        this.touchHeld.set(id, a);
        this.held.add(a);
        this.pressedSet.add(a);
        return true;
      }
    }
    const P = TOUCH_PAUSE;
    // W kolumnie pod pauzą jest build: dolny margines pauzy 2 px (połowa odstępu), jak margines buildu niżej.
    if (x >= P.x - 4 && x < P.x + P.s + 4 && y >= P.y - 4 && y < P.y + P.s + (touchColumn() ? 2 : 4)) { this.pressedSet.add('pause'); return true; }
    // Build i plecak: margines 2 px (połowa odstępu) w stronę sąsiednich przycisków (w wierszu poziomo, w kolumnie pionowo),
    // żeby ich obszary się nie nakładały; w drugą stronę 4 px.
    const mx = touchColumn() ? 4 : 2, my = touchColumn() ? 2 : 4;
    for (let i = 0; i < TOUCH_MENU.length; i++) {
      const [bx, by] = touchMenuPos(i);
      if (x >= bx - mx && x < bx + P.s + mx && y >= by - my && y < by + P.s + my) { this.pressedSet.add(TOUCH_MENU[i]); return true; }
    }
    const B = TOUCH_BAG_PILL;
    if (B.on && x >= B.x - 2 && x < B.x + B.w + 2 && y >= B.y - 4 && y < B.y + B.h + 4) { this.pressedSet.add('inventory'); return true; }
    if (x < W / 2 && !this.stick) { this.stick = { id, ox: x, oy: y, x, y }; return true; }
    return false;
  }

  isDown(a: Action): boolean {
    return this.held.has(a) || this.padHeld.has(a);
  }

  /** Zbocze narastające — true tylko w pierwszym kroku po naciśnięciu. */
  pressed(a: Action): boolean {
    return this.pressedSet.has(a);
  }

  /** Bot testowy (src/dev/bot.ts): naciśnięcie akcji w tym kroku. */
  botPress(a: Action): void {
    this.pressedSet.add(a);
  }

  /** Bot testowy: ruch w tym kroku (jak gałka pada; wołane po pollGamepads). */
  botMove(x: number, y: number): void {
    this.padMove.x = x;
    this.padMove.y = y;
  }

  /** Cokolwiek naciśnięte w tym kroku (klawisz, przycisk pada, klik albo dotknięcie). */
  anyPressed(): boolean {
    return this.anyKey || this.pressedSet.size > 0;
  }

  /** Wektor ruchu z klawiatury lub gałki, długość ≤ 1. */
  move(): { x: number; y: number } {
    let x = (this.isDown('right') ? 1 : 0) - (this.isDown('left') ? 1 : 0);
    let y = (this.isDown('down') ? 1 : 0) - (this.isDown('up') ? 1 : 0);
    if (this.padMove.x !== 0 || this.padMove.y !== 0) { x = this.padMove.x; y = this.padMove.y; }
    if (this.stick) {
      const dx = this.stick.x - this.stick.ox, dy = this.stick.y - this.stick.oy, d = Math.hypot(dx, dy);
      if (d > 3) { x = dx / Math.max(d, STICK_R); y = dy / Math.max(d, STICK_R); }
    }
    const l = Math.hypot(x, y);
    return l > 1 ? { x: x / l, y: y / l } : { x, y };
  }

  /** Odpytuje pady; wywoływane raz na krok symulacji, przed logiką. */
  pollGamepads(): void {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const now = new Set<Action>();
    this.padMove.x = this.padMove.y = 0;
    this.padAim.x = this.padAim.y = 0;
    for (const p of pads) {
      if (!p) continue;
      p.buttons.forEach((b, i) => { if (b.pressed) for (const a of PADMAP[i] ?? []) now.add(a); });
      const dz = (v: number) => (Math.abs(v) < 0.2 ? 0 : v);
      const lx = dz(p.axes[0] ?? 0), ly = dz(p.axes[1] ?? 0);
      if (lx || ly) { this.padMove.x = lx; this.padMove.y = ly; }
      // Gałka jako nawigacja menu (zbocza generowane niżej jak dla przycisków).
      if (ly < -0.6) now.add('up');
      if (ly > 0.6) now.add('down');
      if (lx < -0.6) now.add('left');
      if (lx > 0.6) now.add('right');
      const rx = dz(p.axes[2] ?? 0), ry = dz(p.axes[3] ?? 0);
      if (Math.hypot(rx, ry) > 0.3) { this.padAim.x = rx; this.padAim.y = ry; }
    }
    for (const a of now) if (!this.padHeld.has(a)) { this.pressedSet.add(a); this.lastDevice = 'pad'; }
    this.padHeld = now;
  }

  /** Czyści zbocza po kroku symulacji, który je obsłużył. */
  endStep(): void {
    this.pressedSet.clear();
    this.anyKey = false;
    this.scroll = 0;
    this.focusLost = false;
  }

  /** Czy celować myszą (mysz była użyta nad płótnem, a ostatnim urządzeniem nie był pad). */
  mouseAiming(): boolean {
    return this.lastDevice === 'kbm' && this.mouse.lastMove > 0;
  }
}
