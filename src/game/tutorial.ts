import type { Run } from './run';
import type { Input } from '../core/input';
import type { AbilitySlot } from '../data/heroes';
import { spawnEnemy } from '../systems/spawner';
import { rng } from '../core/rng';

/**
 * Samouczek (faza 2): krótki, interaktywny run Kestrą na pustej mapie. Zwykły spawner jest wyłączony (`run.scripted`),
 * każdy krok wystawia własnych wrogów i czeka na działanie gracza. Teksty po angielsku (polski w core/i18n-pl.ts),
 * dopasowane do urządzenia (klawiatura, pad, dotyk). Gracz nie może zginąć (ui/game-screen.ts go wskrzesza).
 */
type Device = 'kbm' | 'pad' | 'touch';
interface Step {
  title: string;
  /** Opis kroku dla klawiatury, pada i dotyku. */
  body: Record<Device, string>;
  /** Start kroku: wrogowie, skrzynia, ładunek ultimate. */
  enter?: (run: Run) => void;
  /** Krok zaliczony (sprawdzane co klatkę rozgrywki). */
  done: (run: Run, t: Tutorial) => boolean;
}

/** Wrogowie samouczka: słabsi i wolniejsi niż w grze. */
function weak(run: Run, id: string, n: number, dist: number, hpMul = 1): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng.range(-0.2, 0.2);
    const e = spawnEnemy(run, id, run.player.x + Math.cos(a) * dist, run.player.y + Math.sin(a) * dist);
    if (!e) continue;
    e.damage *= 0.3;
    e.speed *= 0.7;
    e.maxHp = e.hp = e.hp * hpMul;
  }
}

const alive = (run: Run) => run.enemies.items.some((e) => !e.dead);

const STEPS: Step[] = [
  {
    title: 'Move',
    body: { kbm: 'Move with WASD or the arrow keys.', pad: 'Move with the left stick.', touch: 'Drag on the left side of the screen to move.' },
    done: (_r, t) => t.moved > 80,
  },
  {
    title: 'Attack',
    body: { kbm: 'Your weapon fires on its own. Stay away from enemies and let it work.', pad: 'Your weapon fires on its own. Stay away from enemies and let it work.', touch: 'Your weapon fires on its own. Stay away from enemies and let it work.' },
    enter: (run) => weak(run, 'slime', 6, 120),
    done: (run) => !alive(run),
  },
  {
    title: 'Level up',
    body: { kbm: 'Collect the blue crystals. When the bar fills, pick an upgrade (arrows and Enter, or the mouse).', pad: 'Collect the blue crystals. When the bar fills, pick an upgrade (D-pad and A).', touch: 'Collect the blue crystals. When the bar fills, tap an upgrade.' },
    enter: (run) => { weak(run, 'slime', 8, 130); run.addXp(Math.max(0, run.xpNext - run.xp - 3)); },
    done: (run) => run.level >= 2 && run.pendingLevels === 0,
  },
  {
    title: 'Abilities',
    body: { kbm: 'Use your abilities: press Q, then E.', pad: 'Use your abilities: press X, then B.', touch: 'Use your abilities: tap Q, then E (bottom right).' },
    enter: (run) => weak(run, 'bat', 8, 140),
    done: (_r, t) => t.cast.q && t.cast.e,
  },
  {
    title: 'Dodge',
    body: { kbm: 'Press Space to dodge. You cannot be hurt while dodging, even through enemies.', pad: 'Press A to dodge. You cannot be hurt while dodging, even through enemies.', touch: 'Tap the dodge button (bottom right). You cannot be hurt while dodging, even through enemies.' },
    enter: (run) => weak(run, 'slime', 12, 70, 3),
    done: (_r, t) => t.cast.dash,
  },
  {
    title: 'Ultimate',
    body: { kbm: 'Kills charge your ultimate. It is ready now: press R.', pad: 'Kills charge your ultimate. It is ready now: press Y.', touch: 'Kills charge your ultimate. It is ready now: tap R.' },
    enter: (run) => { run.ultCharge = run.ultNeed(); weak(run, 'bat', 10, 150); },
    done: (_r, t) => t.cast.ult,
  },
  {
    title: 'Loot',
    body: { kbm: 'Walk over the chest and equip the item. Items make you stronger for the whole run.', pad: 'Walk over the chest and equip the item. Items make you stronger for the whole run.', touch: 'Walk over the chest and equip the item. Items make you stronger for the whole run.' },
    enter: (run) => { for (const e of run.enemies.items) e.dead = true; run.dropChest(run.player.x + 40, run.player.y + 10, 'boss'); },
    done: (run) => !run.pickups.items.some((p) => p.kind === 'chest') && run.pendingLoot.length === 0,
  },
  {
    title: 'Boss',
    body: { kbm: 'A boss! Watch the red warnings, dodge its attacks and keep moving.', pad: 'A boss! Watch the red warnings, dodge its attacks and keep moving.', touch: 'A boss! Watch the red warnings, dodge its attacks and keep moving.' },
    enter: (run) => {
      const a = rng.range(0, Math.PI * 2), b = spawnEnemy(run, 'boss', run.player.x + Math.cos(a) * 140, run.player.y + Math.sin(a) * 140);
      if (b) { b.maxHp = b.hp = b.maxHp * 0.12; b.damage *= 0.3; }
    },
    done: (run) => run.bossKills > 0,
  },
];

export class Tutorial {
  step = -1;
  /** Czas w bieżącym kroku i droga przebyta w kroku ruchu. */
  t = 0;
  moved = 0;
  /** Użyte umiejętności w bieżącym kroku (wykrywane po starcie odnowienia). */
  cast: Record<AbilitySlot, boolean> = { q: false, e: false, dash: false, ult: false };
  /** Koniec: ekran gry pokazuje podsumowanie i przejście do Ekspedycji. */
  finished = false;
  private last = { x: 0, y: 0 };
  private prevCd: Record<AbilitySlot, number> = { q: 0, e: 0, dash: 0, ult: 0 };

  get total(): number {
    return STEPS.length;
  }

  /** Bieżący krok: tytuł i opis dla urządzenia gracza. */
  text(input: Input): { title: string; body: string } {
    if (this.finished) return { title: 'Tutorial complete', body: 'You are ready. Your first Expedition is next: three acts, each with a boss at the end.' };
    const s = STEPS[Math.max(0, this.step)];
    return { title: s.title, body: s.body[input.lastDevice] };
  }

  /** Co klatkę rozgrywki (po run.update). */
  update(run: Run, dt: number): void {
    if (this.finished) return;
    const p = run.player;
    if (this.step < 0) { this.next(run); this.last = { x: p.x, y: p.y }; }
    this.t += dt;
    this.moved += Math.hypot(p.x - this.last.x, p.y - this.last.y);
    this.last = { x: p.x, y: p.y };
    for (const k of ['q', 'e', 'dash'] as const) {
      const cd = run.abilities[k].cd;
      if (cd > this.prevCd[k] + 0.05) this.cast[k] = true;
      this.prevCd[k] = cd;
    }
    if (run.abilities.ult.activeT > 0 || (this.step === 5 && this.t > 0.2 && run.ultCharge < run.ultNeed())) this.cast.ult = true;
    // Krok z wrogami, którzy uciekli z ekranu albo zginęli przypadkiem za wcześnie: dorzucenie nowych.
    if (this.t > 0.5 && STEPS[this.step].done(run, this)) { this.next(run); return; }
    if (this.step >= 3 && this.step <= 5 && !alive(run) && this.t > 1) weak(run, 'slime', 6, 120);
  }

  private next(run: Run): void {
    this.step++;
    this.t = 0;
    this.moved = 0;
    this.cast = { q: false, e: false, dash: false, ult: false };
    for (const k of ['q', 'e', 'dash'] as const) this.prevCd[k] = run.abilities[k].cd;
    if (this.step >= STEPS.length) { this.finished = true; return; }
    STEPS[this.step].enter?.(run);
  }
}
