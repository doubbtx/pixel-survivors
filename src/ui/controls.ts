import { W, H } from '../core/renderer';
import { C } from '../core/palette';
import { drawText, smallS } from '../core/font';
import { sfx } from '../core/audio';
import { REBIND, actionKey, keyOf, setBindings, type Action } from '../core/input';
import type { App, Screen } from './app';
import { Menu, panel, titleBar } from './widgets';

/** Nazwy akcji do zmiany (po angielsku; polski w core/i18n-pl.ts). */
const ACTION_NAME: Partial<Record<Action, string>> = {
  up: 'Move up', down: 'Move down', left: 'Move left', right: 'Move right',
  q: 'Ability Q', e: 'Ability E', dash: 'Dodge', ult: 'Ultimate',
  inventory: 'Backpack', build: 'Weapons and passives', synergies: 'Synergies', skip: 'Skip / salvage', banish: 'Banish', anvil: 'Anvil', pause: 'Pause',
};

/**
 * Ustawienia → Sterowanie: zmiana klawiszy akcji gry (core/input.ts REBIND). Enter na akcji, potem nowy klawisz
 * (Esc anuluje). Klawisz zajęty przez inną akcję zamienia się z nią miejscami. Strzałki, Enter, Esc, Tab i cyfry są stałe.
 */
export class ControlsScreen implements Screen {
  private menu: Menu;
  /** Akcja czekająca na nowy klawisz. */
  private waiting: Action | null = null;

  constructor(private readonly app: App, private readonly back: Screen) {
    this.menu = new Menu([
      ...REBIND.map(([a]) => ({ label: () => ACTION_NAME[a] ?? a, value: () => (this.waiting === a ? '...' : actionKey(a)), act: () => this.listen(a) })),
      { label: () => 'Reset to defaults', act: () => { this.save({}); sfx.play('select'); } },
      { label: () => 'Wróć', act: () => app.go(back) },
    ], W / 2, 38, 300, 12.5);
  }

  private save(keys: Record<string, string>): void {
    this.app.save.settings.keys = keys;
    setBindings(keys);
    this.app.persist();
  }

  /** Następny klawisz zostaje przypisany do akcji; Esc anuluje. */
  private listen(a: Action): void {
    this.waiting = a;
    this.app.input.capture = (code) => {
      this.waiting = null;
      if (code === 'Escape') return;
      const keys = { ...this.app.save.settings.keys }, old = keyOf(a);
      // Zamiana z akcją, która miała ten klawisz.
      for (const [b] of REBIND) if (b !== a && keyOf(b) === code) keys[b] = old;
      keys[a] = code;
      this.save(keys);
      sfx.play('select');
    };
  }

  update(): void {
    // Czekanie na klawisz: dotknięcie / klik anuluje (na telefonie bez klawiatury ekran był zablokowany).
    if (this.waiting) {
      if (this.app.input.pressed('click')) { this.waiting = null; this.app.input.capture = null; sfx.play('select'); }
      return;
    }
    if (this.app.input.pressed('back')) { this.app.go(this.back); return; }
    this.menu.update(this.app.input);
  }

  render(): void {
    const r = this.app.r, g = r.g;
    r.clear(C.black);
    titleBar(r, 'Controls', 8);
    panel(r, W / 2 - 160, 32, 320, (REBIND.length + 2) * 12.5 + 8);
    this.menu.render(r);
    const tip = this.waiting ? 'Press a new key (Esc or tap: cancel)' : 'Enter: change key. Arrows, Enter, Esc, Tab and 1-4 always work in menus.';
    drawText(g, tip, W / 2, H - 12, this.waiting ? C.yellow : C.lavender, { align: 'center', scale: smallS() });
  }
}
