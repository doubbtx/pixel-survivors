import { W, H, type Renderer } from './renderer';

/** Abstrakcyjne akcje — logika gry nie wie nic o konkretnych klawiszach czy przyciskach pada. */
export type Action =
  | 'up' | 'down' | 'left' | 'right'
  | 'q' | 'e' | 'dash' | 'ult'
  | 'pause' | 'confirm' | 'back' | 'click' | 'inventory' | 'fullscreen'
  | 'reroll' | 'skip' | 'banish' | 'anvil'
  | 'n1' | 'n2' | 'n3' | 'n4'
  | 'debug' | 'debugTime' | 'debugLevel' | 'debugLoot';

const KEYMAP: Record<string, Action[]> = {
  KeyW: ['up'], ArrowUp: ['up'], KeyS: ['down'], ArrowDown: ['down'],
  KeyA: ['left'], ArrowLeft: ['left'], KeyD: ['right'], ArrowRight: ['right'],
  KeyQ: ['q'], KeyE: ['e'], Space: ['dash', 'confirm'], KeyR: ['ult', 'reroll'],
  Enter: ['confirm'], Escape: ['pause', 'back'], KeyP: ['pause'],
  KeyF: ['fullscreen'], KeyX: ['skip'], KeyB: ['banish'], KeyI: ['inventory'], Tab: ['inventory'], KeyK: ['anvil'],
  Digit1: ['n1'], Digit2: ['n2'], Digit3: ['n3'], Digit4: ['n4'],
  F3: ['debug'], Backquote: ['debug'], F4: ['debugTime'], F6: ['debugLevel'], F7: ['debugLoot'],
};

/** Gniazda umiejętności w HUD (prawy dół) — na telefonie są też przyciskami dotykowymi. Kolejność: Q, E, unik, R. */
export const ABILITY_SLOT = 32;
export function abilitySlotPos(i: number): [number, number] {
  return [W - 4 - (4 - i) * (ABILITY_SLOT + 3), H - ABILITY_SLOT - 4];
}
const TOUCH_ACTIONS: Action[] = ['q', 'e', 'dash', 'ult'];
/** Przycisk pauzy na ekranie dotykowym (lewo od licznika zabójstw). */
export const TOUCH_PAUSE = { x: W - 110, y: 8, s: 20 };
/** Zasięg wychylenia wirtualnego joysticka (piksele logiczne). */
export const STICK_R = 26;

/** Standardowe mapowanie Gamepad API (Xbox: A=0, B=1, X=2, Y=3, LB=4, RB=5, Start=9, D-pad=12..15). */
const PADMAP: Record<number, Action[]> = {
  0: ['confirm', 'dash'], 1: ['back', 'e'], 2: ['q'], 3: ['ult'],
  4: ['reroll'], 5: ['skip'], 9: ['pause'], 8: ['banish'], 6: ['inventory'],
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
  lastDevice: 'kbm' | 'pad' | 'touch' = 'kbm';
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

  constructor(renderer: Renderer, canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (e) => {
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
      if (e.pointerType === 'touch') { this.lastDevice = 'touch'; return; }
      this.mouse.lastMove = performance.now();
      this.lastDevice = 'kbm';
    };
    canvas.addEventListener('pointermove', (e) => {
      pos(e);
      if (this.stick && this.stick.id === e.pointerId) { this.stick.x = this.mouse.x; this.stick.y = this.mouse.y; }
    });
    canvas.addEventListener('pointerdown', (e) => {
      pos(e);
      if (e.pointerType === 'touch' && this.touchControls && this.touchDown(e.pointerId)) return;
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
  }

  /** Dotyk w trakcie gry: przycisk umiejętności, pauza albo start joysticka (lewa połowa). True = obsłużony. */
  private touchDown(id: number): boolean {
    const { x, y } = this.mouse;
    for (let i = 0; i < TOUCH_ACTIONS.length; i++) {
      const [bx, by] = abilitySlotPos(i);
      if (x >= bx - 3 && x < bx + ABILITY_SLOT + 3 && y >= by - 6 && y < by + ABILITY_SLOT + 4) {
        const a = TOUCH_ACTIONS[i];
        this.touchHeld.set(id, a);
        this.held.add(a);
        this.pressedSet.add(a);
        return true;
      }
    }
    const P = TOUCH_PAUSE;
    if (x >= P.x - 4 && x < P.x + P.s + 4 && y >= P.y - 4 && y < P.y + P.s + 4) { this.pressedSet.add('pause'); return true; }
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
    this.focusLost = false;
  }

  /** Czy celować myszą (mysz była użyta nad płótnem, a ostatnim urządzeniem nie był pad). */
  mouseAiming(): boolean {
    return this.lastDevice === 'kbm' && this.mouse.lastMove > 0;
  }
}
