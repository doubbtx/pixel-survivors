import type { Renderer } from '../core/renderer';
import type { Input } from '../core/input';
import type { LoopStats } from '../core/loop';
import type { SaveData } from '../core/save';

/** Ekran aplikacji (menu, gra, ustawienia...). Aktywny jest dokładnie jeden. */
export interface Screen {
  update(dt: number): void;
  render(): void;
}

/** Wspólny kontekst przekazywany ekranom. */
export interface App {
  r: Renderer;
  input: Input;
  save: SaveData;
  loop: LoopStats;
  go(s: Screen): void;
  /** Zapisuje `save` do localStorage i stosuje ustawienia (głośność). */
  persist(): void;
}
