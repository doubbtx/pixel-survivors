import { W } from '../core/renderer';
import { C } from '../core/palette';
import { drawText, wrapText, smallS } from '../core/font';
import { sfx } from '../core/audio';
import type { App, Screen } from './app';
import { Menu, panel } from './widgets';

/**
 * Ostrzeżenie dla osób wrażliwych na błyski (pierwsze uruchomienie, przed samouczkiem i menu): opis i przełącznik
 * ograniczenia błysków (to samo co w Ustawieniach → Czytelność), potem gra przechodzi do `next`.
 * Teksty po angielsku (polski w core/i18n-pl.ts).
 */
export class FlashWarningScreen implements Screen {
  private menu: Menu;
  private t = 0;

  constructor(private readonly app: App, private readonly next: () => Screen) {
    const s = app.save.settings;
    this.menu = new Menu([
      { label: () => 'Continue', act: () => this.close() },
      { label: () => 'Reduce flashing', value: () => (s.reduceFlash ? 'on' : 'off'), act: () => this.toggle(), left: () => this.toggle(), right: () => this.toggle() },
    ], W / 2, 182, 240, 16);
  }

  private toggle(): void {
    const s = this.app.save.settings;
    s.reduceFlash = !s.reduceFlash;
    this.app.persist();
    sfx.play('select');
  }

  private close(): void {
    this.app.save.settings.flashWarned = true;
    this.app.persist();
    this.app.go(this.next());
  }

  update(dt: number): void {
    this.t += dt;
    // Krótka blokada: klawisz wciśnięty przy starcie nie zamyka ostrzeżenia.
    if (this.t > 0.4) this.menu.update(this.app.input);
  }

  render(): void {
    const r = this.app.r, g = r.g;
    r.clear(C.black);
    drawText(g, 'Photosensitivity warning', W / 2, 24, C.yellow, { align: 'center', scale: 2, outline: C.black });
    panel(r, 50, 60, W - 100, 104, C.orange);
    const text = 'A small part of people may have seizures when exposed to flashing lights or patterns, even without a history of epilepsy. This game has explosions, blinking warnings and fast effects. If you feel dizzy, have blurred vision or twitching, stop playing and see a doctor.';
    wrapText(text, W - 124).forEach((l, i) => drawText(g, l, 62, 70 + i * 12, C.white));
    drawText(g, 'Reduce flashing: no blinking or white flashes (you can change it later in Settings).', W / 2, 146, C.lgray, { align: 'center', scale: smallS() });
    this.menu.render(r);
  }
}
