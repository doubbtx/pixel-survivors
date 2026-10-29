import { BAL } from '../data/balance';
import { ENEMIES } from '../data/enemies';
import type { App, Screen } from '../ui/app';
import type { Action } from '../core/input';
import type { Mode, TelemetrySample } from '../game/run';
import { GameScreen } from '../ui/game-screen';
import { HEROES } from '../data/heroes';
import { trMisses } from '../core/i18n';
import { ALL_UNLOCKS } from '../data/unlocks';
import { spawnEnemy } from '../systems/spawner';

/**
 * Bot testowy (tylko serwer deweloperski): `?bot=endless`, `?bot=expedition`, `?bot=tutorial` (samouczek do końca)
 * albo `?bot=gallery` (przegląd grafiki: każdy bohater używa Q, E, uniku i R w tłumie, zrzut po każdym — scripts/bot.cjs), opcjonalnie `&hero=kestra`
 * (`all` = po kolei wszyscy), `&runs=3`, `&time=600` (limit czasu runu w sekundach gry), `&turbo=4` (kroki na klatkę),
 * `&tier=1` (trudność map Ekspedycji 1-4), `&god=1` (nietykalność i pełne życie co krok — do testów dalszej zawartości), `&fresh=1` (bez odblokowań, jak nowy gracz;
 * domyślnie bot ma wszystkie).
 *
 * Gra jak gracz przez Input (ruch jak gałka pada, naciśnięcia akcji): ucieka od wrogów i pocisków, zbiera kryształy
 * i skrzynie, używa umiejętności, losowo wybiera awanse, karty i węzły mapy. Raport w `window.__bot` (dla Playwright):
 * przebieg runów, błędy, najwolniejsze kroki, odwiedzone stany i brakujące tłumaczenia.
 */
export interface BotRun { hero: string; mode: Mode; result: string; time: number; level: number; kills: number; depth: number; act: number; byId?: Record<string, number>; build?: string[]; parries?: number; tl?: TelemetrySample[]; maps?: number[]; bosses?: number[] }
export interface BotReport {
  done: boolean;
  runs: BotRun[];
  errors: string[];
  states: Record<string, number>;
  slowSteps: number;
  maxStepMs: number;
  missing: string[];
  /** Odblokowania w zapisie po ostatnim runie (test stopniowych odblokowań z `fresh=1`). */
  unlocks: string[];
  /** Galeria: nazwa zrzutu do zrobienia (gra stoi, aż skrypt odpowie `ack` tą samą nazwą). */
  shot?: string;
  ack?: string;
}

/** Obiekty mapy, do których bot podchodzi. */
const BOT_GOALS = new Set(['exit', 'portal', 'shrine', 'sword', 'stairs', 'barrow', 'grove', 'fountain']);
const rnd = (n: number) => Math.floor(Math.random() * n);

export class Bot {
  readonly report: BotReport = { done: false, runs: [], errors: [], states: {}, slowSteps: 0, maxStepMs: 0, missing: [], unlocks: [] };
  readonly turbo: number;
  private readonly mode: Mode;
  private readonly tutorial: boolean;
  private readonly gallery: boolean;
  /** Galeria wrogów (`&foes=boar,toad`): zamiast umiejętności bohatera zrzuty podanych wrogów i ich zapowiedzi ataków. */
  private readonly foes: string[];
  /** Galeria: kolejka kroków bieżącego bohatera i czas do następnego. */
  private steps: (() => string | void)[] = [];
  private stepT = 0;
  private readonly heroes: string[];
  private readonly runs: number;
  private readonly maxTime: number;
  private readonly tier: number;
  private readonly god: boolean;
  private runIdx = 0;
  private cur: GameScreen | null = null;
  private wander = Math.random() * Math.PI * 2;
  private wait = 0;
  private dashCd = 0;
  private castT = 0;
  /** Pomiar balansu: czasy ukończonych poziomów (map) i walk z bossem w bieżącym runie (s czasu gry). */
  private maps: number[] = [];
  private bosses: number[] = [];
  private lastLt = 0;
  private bossT = 0;

  constructor(private readonly app: App, params: URLSearchParams) {
    this.mode = params.get('bot') === 'expedition' ? 'expedition' : 'endless';
    this.tutorial = params.get('bot') === 'tutorial';
    this.gallery = params.get('bot') === 'gallery';
    this.foes = (params.get('foes') ?? '').split(',').filter(Boolean);
    const hero = params.get('hero') ?? 'all';
    this.heroes = hero === 'all' ? HEROES.map((h) => h.id) : [hero];
    this.runs = this.tutorial ? 1 : Number(params.get('runs') ?? this.heroes.length);
    this.maxTime = Number(params.get('time') ?? 300);
    this.turbo = Math.max(1, Number(params.get('turbo') ?? 1));
    this.god = params.get('god') === '1';
    // Pomiar balansu: `&pmax=1e6` zdejmuje sufit mnożnika siły (BAL.power.max), żeby telemetria pokazała prawdziwy zakres.
    if (params.has('pmax')) (BAL.power as { max: number }).max = Number(params.get('pmax'));
    this.tier = Math.max(1, Math.min(4, Number(params.get('tier') ?? 1)));
    if (params.get('fresh') !== '1') app.save.unlocks = [...ALL_UNLOCKS];
    window.addEventListener('error', (e) => this.report.errors.push(String(e.message)));
    window.addEventListener('unhandledrejection', (e) => this.report.errors.push(String(e.reason)));
    (window as unknown as { __bot: BotReport }).__bot = this.report;
  }

  /** Czas kroku symulacji (do raportu wydajności). */
  stepTime(ms: number): void {
    this.report.maxStepMs = Math.max(this.report.maxStepMs, Math.round(ms * 10) / 10);
    if (ms > 16) this.report.slowSteps++;
  }

  /** Galeria: gra stoi, dopóki skrypt nie zrobi zamówionego zrzutu. */
  get frozen(): boolean {
    return !!this.report.shot && this.report.ack !== this.report.shot;
  }

  /** Galeria: kroki dla bohatera (tłum wrogów, potem po kolei umiejętności ze zrzutem po każdej). */
  private galleryTick(gs: any, dt: number): void { // eslint-disable-line @typescript-eslint/no-explicit-any
    const run = gs.run, inp = this.app.input, hero = run.hero.id;
    run.player.hp = run.stats.maxHp; run.player.iframes = 1;
    if (gs.state !== 'play') { this.wait -= dt; if (this.wait <= 0) { inp.botPress(gs.state === 'pause' ? 'pause' : 'confirm'); this.wait = 0.25; } return; }
    if (!this.steps.length) {
      const cast = (sl: 'q' | 'e' | 'dash' | 'ult') => () => { if (sl === 'ult') run.ultCharge = run.ultNeed(); inp.botPress(sl); };
      const crowd = () => { for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; spawnEnemy(run, i % 3 ? 'slime' : 'bat', run.player.x + Math.cos(a) * 70, run.player.y + Math.sin(a) * 50); } };
      const shot = (name: string) => () => `${hero}-${name}`;
      if (this.foes.length) {
        const foes = () => { this.foes.forEach((id, i) => { for (let k = 0; k < 2; k++) { const a = ((i * 2 + k) / (this.foes.length * 2)) * Math.PI * 2; const e = spawnEnemy(run, id, run.player.x + Math.cos(a) * 90, run.player.y + Math.sin(a) * 60, ENEMIES[id]?.behavior === 'warden' ? { elite: [] } : {}); if (e) e.hp = e.maxHp = 1e6; } }); };
        this.steps = [foes];
        for (let k = 0; k < 14; k++) this.steps.push(() => { this.stepT = 0.3; }, shot(`foes${k}`));
        this.steps.push(() => this.finish(run, 'gallery'));
        this.stepT = 1;
        return;
      }
      this.steps = [crowd, shot('play'), cast('q'), shot('q'), cast('e'), shot('e'), crowd, cast('dash'), shot('dash'), cast('ult'), shot('ult'), () => { this.stepT = 1.5; }, shot('ult-late'), () => this.finish(run, 'gallery')];
      this.stepT = 2;
      return;
    }
    this.stepT -= dt;
    if (this.stepT > 0) return;
    const name = this.steps.shift()!();
    this.stepT = name ? 0.05 : 0.35;
    if (name) this.report.shot = name;
  }

  /** Wołane co krok przed `screen.update`: steruje wejściem. */
  tick(screen: Screen, dt: number): void {
    if (this.report.done) return;
    this.report.missing = [...trMisses];
    if (!(screen instanceof GameScreen)) { this.startNext(); return; }
    // Ekran gry z poprzedniego runu (np. po „Menu główne”) — nowy run.
    if (screen !== this.cur) { this.cur = screen; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gs = screen as any, run = gs.run, state: string = gs.state;
    if (this.gallery) { this.galleryTick(gs, dt); return; }
    this.report.states[state] = (this.report.states[state] ?? 0) + 1;
    const inp = this.app.input, press = (a: Action) => inp.botPress(a);
    if (state !== 'play') {
      // Nakładki: krótka pauza między naciśnięciami (widoki mają opóźnienie wejścia).
      this.wait -= dt;
      if (this.wait > 0) return;
      this.wait = 0.25;
    }
    switch (state) {
      case 'play':
        if (gs.tut?.finished) { if (!this.report.runs.length) this.report.runs.push({ hero: 'kestra', mode: this.mode, result: 'tutorial', time: Math.round(run.totalTime), level: run.level, kills: run.kills, depth: run.depth, act: 0 }); press('confirm'); return; }
        if (gs.tut) this.report.states[`tut${gs.tut.step}`] = (this.report.states[`tut${gs.tut.step}`] ?? 0) + 1;
        // Samouczek: co chwilę akcja, o którą prosi krok (unik, umiejętności).
        if (gs.tut && run.step % 90 === 0) press((['q', 'e', 'dash', 'ult'] as const)[rnd(4)]);
        if (!gs.tut && run.totalTime > this.maxTime && run.outcome === 'none') { this.finish(run, 'timeout'); return; }
        if (this.god) { run.player.hp = run.stats.maxHp; run.player.iframes = Math.max(run.player.iframes, 0.1); }
        if (run.time < this.lastLt - 1) this.maps.push(Math.round(this.lastLt));
        this.lastLt = run.time;
        if (run.boss && run.boss.hp > 0) this.bossT += dt;
        else if (this.bossT > 0) { this.bosses.push(Math.round(this.bossT)); this.bossT = 0; }
        this.play(run, dt);
        break;
      case 'levelup': press((['n1', 'n2', 'n3'] as const)[rnd(Math.min(3, gs.levelUp?.options?.length ?? 3))]); break;
      case 'cards': press((['n1', 'n2', 'n3'] as const)[rnd(3)]); break;
      case 'power': press('confirm'); break;
      case 'loot': press('confirm'); break;
      case 'map':
        press((['n1', 'n2', 'n3', 'n4'] as const)[this.tier - 1]);
        for (let i = rnd(3); i > 0; i--) press('down');
        press('confirm');
        break;
      case 'pause': press('pause'); break;
      case 'end': this.finish(run, run.outcome === 'dead' ? 'dead' : 'won'); break;
      default: press('back'); break; // sklep, kowadło, ekwipunek, synergie, build
    }
  }

  /** Ruch: ucieczka od wrogów i pocisków (ważona odległością), potem kryształy i skrzynie, inaczej wędrówka. */
  private play(run: any, dt: number): void { // eslint-disable-line @typescript-eslint/no-explicit-any
    const inp = this.app.input, p = run.player;
    let fx = 0, fy = 0, near = 0;
    for (const e of run.enemies.items) {
      if (e.dead) continue;
      const dx = p.x - e.x, dy = p.y - e.y, d2 = dx * dx + dy * dy, R = e.boss ? 140 : 70;
      if (d2 > R * R) continue;
      const d = Math.sqrt(d2) + 1, w = (e.boss ? 3 : 1) * (R - d) / R / d;
      fx += dx * w; fy += dy * w;
      if (d < 26) near++;
    }
    for (const b of run.bullets.items) {
      const dx = p.x - b.x, dy = p.y - b.y, d2 = dx * dx + dy * dy;
      if (d2 > 60 * 60) continue;
      // Pocisk lecący w stronę gracza: uniki w bok toru.
      if (dx * b.vx + dy * b.vy <= 0) continue;
      const d = Math.sqrt(d2) + 1, w = 2.5 * (60 - d) / 60 / d;
      const side = Math.sign(dx * b.vy - dy * b.vx) || 1;
      fx += (-b.vy * side / (Math.hypot(b.vx, b.vy) || 1) * d + dx) * w;
      fy += (b.vx * side / (Math.hypot(b.vx, b.vy) || 1) * d + dy) * w;
    }
    // Cel na mapie: wyjście z lochu zawsze, poza tym kapliczki, portale, miecz, schody, kurhan, gaj (sprawdzanie ich logiki).
    let goal: { x: number; y: number } | null = null, gd = Infinity;
    for (const o of run.mapObjects) {
      if (!BOT_GOALS.has(o.kind)) continue;
      const d = (o.x - p.x) ** 2 + (o.y - p.y) ** 2 - (o.kind === 'exit' ? 1e9 : 0);
      if (d < gd) { gd = d; goal = o; }
    }
    if (goal) {
      const dx = goal.x - p.x, dy = goal.y - p.y, d = Math.hypot(dx, dy) || 1;
      fx += (dx / d) * 0.6; fy += (dy / d) * 0.6;
    }
    const threat = Math.hypot(fx, fy);
    if (!goal && threat < 0.15) {
      // Bez zagrożenia: najbliższy kryształ, skrzynia albo mięso, inaczej wędrówka po łuku.
      let best = 160 * 160, tx = 0, ty = 0;
      for (const g of [...run.gems.items, ...run.pickups.items]) {
        const d2 = (g.x - p.x) ** 2 + (g.y - p.y) ** 2;
        if (d2 < best) { best = d2; tx = g.x - p.x; ty = g.y - p.y; }
      }
      if (tx || ty) { fx += tx * 0.02; fy += ty * 0.02; } else {
        this.wander += (Math.random() - 0.5) * dt * 2;
        fx += Math.cos(this.wander) * 0.5; fy += Math.sin(this.wander) * 0.5;
      }
    }
    const l = Math.hypot(fx, fy);
    if (l > 0) inp.botMove(fx / Math.max(l, 0.5), fy / Math.max(l, 0.5));
    // Umiejętności: Q/E co chwilę, R zawsze gdy gotowe, unik gdy otoczony.
    this.castT -= dt; this.dashCd -= dt;
    if (this.castT <= 0) { inp.botPress(Math.random() < 0.5 ? 'q' : 'e'); this.castT = 0.8 + Math.random(); }
    inp.botPress('ult');
    if (near >= 3 && this.dashCd <= 0) { inp.botPress('dash'); this.dashCd = 1; }
  }

  private finish(run: any, result: string): void { // eslint-disable-line @typescript-eslint/no-explicit-any
    this.report.runs.push({
      hero: run.hero.id, mode: this.mode, result, time: Math.round(run.totalTime), level: run.level, kills: run.kills,
      depth: run.depth, act: run.expedition?.act ?? 0, byId: { ...this.app.save.bestiary }, parries: run.cardState['sec.parry'] ?? 0, tl: run.telemetry, maps: this.maps, bosses: this.bosses, build: [...run.weapons.map((w: any) => w.def.id), ...run.passives.map((p: any) => p.id + (p.evo ? '*' : ''))], // eslint-disable-line @typescript-eslint/no-explicit-any
    });
    this.steps = [];
    this.maps = []; this.bosses = []; this.lastLt = 0; this.bossT = 0;
    this.app.save.slots[this.mode] = null;
    this.report.unlocks = [...this.app.save.unlocks];
    this.startNext();
  }

  private startNext(): void {
    if (this.runIdx >= this.runs) { this.report.done = true; return; }
    const hero = this.heroes[this.runIdx % this.heroes.length];
    this.runIdx++;
    this.app.save.slots[this.mode] = null;
    this.cur = new GameScreen(this.app, this.tutorial ? 'kestra' : hero, this.mode, undefined, this.tutorial);
    this.app.go(this.cur);
  }
}
