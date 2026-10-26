import { W, H } from '../core/renderer';
import { C } from '../core/palette';
import { drawText, wrapText } from '../core/font';
import { sfx } from '../core/audio';
import { heroRecord, type AimMode } from '../core/save';
import { drawSprite, drawShadow, getSprite, TILE } from '../gfx/sprites';
import { animFrame } from '../gfx/actors';
import { HEROES, HERO_BY_ID } from '../data/heroes';
import { WEAPON_BY_ID } from '../data/weapons';
import { levelDef, objectiveLabel } from '../data/levels';
import { loseHardcoreRun } from '../game/campaign';
import type { Mode } from '../game/run';
import { fmtTime, fmt } from '../util/format';
import type { App, Screen } from './app';
import { Menu, panel, inside, slot } from './widgets';
import { GameScreen } from './game-screen';
import { CollectionScreen } from './collection';
import { MetaScreen } from './meta';

const PARADE = ['slime', 'bat', 'golem', 'eye', 'wisp', 'spinner'];

/** Tło menu: gwiazdy, przewijany pas łąki i defilada potworów goniących bohaterów. */
function menuBackdrop(app: App, t: number): void {
  const r = app.r, g = r.g;
  r.clear(C.black);
  for (let i = 0; i < 70; i++) {
    const x = ((i * 97 + t * (4 + (i % 3) * 3)) % (W + 20)) - 10;
    const y = (i * 53) % (H - 70);
    r.rect(x, y, 1, 1, i % 5 === 0 ? C.lgray : i % 2 ? C.slate : C.navy);
  }
  const groundY = H - 58;
  const off = Math.floor(t * 30) % TILE;
  for (let x = -off; x < W; x += TILE) for (let y = groundY; y < H; y += TILE) g.drawImage(getSprite(`tile0_${((x + off) / TILE + y) % 10}`).img, x, y);
  r.rect(0, groundY, W, 1, C.black);
  const walk = (name: string, x: number, flip: boolean, k: number) => {
    const y = groundY + 22 + Math.round(Math.abs(Math.sin(t * 8 + k)) * -2);
    drawShadow(g, x, groundY + 32, 14);
    drawSprite(g, `${name}@${animFrame(name, Math.floor(t * 60), k * 7)}`, x, y, { flipX: flip });
  };
  const lead = ((t * 40 + 320) % (W + 280)) - 40;
  walk('kestra', lead, false, 0);
  walk('borgun', lead - 26, false, 1);
  PARADE.forEach((name, i) => walk(name, lead - 70 - i * 28, false, i + 2));
}

export class MainMenu implements Screen {
  private t = 0;
  private menu: Menu;

  constructor(private readonly app: App) {
    this.menu = new Menu([
      { label: () => 'Kampania Hardcore', act: () => app.go(new HardcoreScreen(app)) },
      { label: () => 'Trening (jeden poziom)', act: () => app.go(new HeroSelect(app, 'training')) },
      { label: () => 'Endless (bez końca)', act: () => app.go(new HeroSelect(app, 'endless')) },
      { label: () => `Rozwój (${fmt(app.save.meta.essence)} esencji)`, act: () => app.go(new MetaScreen(app, this)) },
      { label: () => 'Kolekcja kart', act: () => app.go(new CollectionScreen(app, this)) },
      { label: () => 'Rekordy', act: () => app.go(new RecordsScreen(app)) },
      { label: () => 'Ustawienia', act: () => app.go(new SettingsScreen(app, this)) },
    ], W / 2, 90, 220, 15);
  }

  update(dt: number): void {
    this.t += dt;
    const before = this.menu.sel;
    this.menu.update(this.app.input);
    // Komunikat (np. o przerwanym runie) znika po pierwszej interakcji.
    if (this.app.save.notice && (this.menu.sel !== before || this.app.input.pressed('confirm') || this.app.input.pressed('click'))) {
      this.app.save.notice = '';
      this.app.persist();
    }
  }

  render(): void {
    menuBackdrop(this.app, this.t);
    const g = this.app.r.g;
    // Logo: cień, obrys i pionowy gradient (żółty → złoty → pomarańczowy) przez przycinanie pasami.
    drawText(g, 'Pixel Survivors', W / 2 + 2, 30, C.dred, { align: 'center', scale: 3 });
    drawText(g, 'Pixel Survivors', W / 2, 28, C.yellow, { align: 'center', scale: 3, outline: C.black });
    for (const [y0, col] of [[39, C.gold], [48, C.orange]] as const) {
      g.save();
      g.beginPath();
      g.rect(0, y0, W, 30);
      g.clip();
      drawText(g, 'Pixel Survivors', W / 2, 28, col, { align: 'center', scale: 3 });
      g.restore();
    }
    drawText(g, 'Przetrwaj. Rozwijaj się. Bez końca.', W / 2, 70, C.lavender, { align: 'center', shadow: C.black });
    if (this.app.save.notice) drawText(g, this.app.save.notice, W / 2, 88, C.orange, { align: 'center', outline: C.black });
    this.menu.render(this.app.r);
    drawText(g, 'WASD / strzałki: ruch    Enter / klik: wybór', W / 2, 196, C.slate, { align: 'center' });
  }
}

/** Slot kampanii Hardcore: kontynuacja zapisanego runu, porzucenie albo nowa kampania + tablica rekordów. */
export class HardcoreScreen implements Screen {
  private menu: Menu;
  private confirmAbandon = false;

  constructor(private readonly app: App) {
    const slot = app.save.hardcore;
    this.menu = new Menu(slot.run ? [
      { label: () => 'Kontynuuj', act: () => { const s = slot.run!; app.go(new GameScreen(app, s.hero, 'hardcore', s)); } },
      {
        label: () => (this.confirmAbandon ? 'Na pewno? Run przepadnie' : 'Porzuć run'),
        act: () => {
          if (!this.confirmAbandon) { this.confirmAbandon = true; return; }
          loseHardcoreRun(app.save, slot.run!);
          app.persist();
          app.go(new HardcoreScreen(app));
        },
      },
      { label: () => 'Wstecz', act: () => app.go(new MainMenu(app)) },
    ] : [
      { label: () => 'Nowa kampania', act: () => app.go(new HeroSelect(app, 'hardcore')) },
      { label: () => 'Wstecz', act: () => app.go(new MainMenu(app)) },
    ], 124, 196, 220);
  }

  update(): void {
    if (this.app.input.pressed('back')) { this.app.go(new MainMenu(this.app)); return; }
    this.menu.update(this.app.input);
  }

  render(): void {
    const r = this.app.r, g = r.g;
    r.clear(C.black);
    drawText(g, 'Kampania Hardcore', W / 2, 10, C.salmon, { align: 'center', scale: 2, outline: C.dred });
    panel(r, 12, 40, 224, 146, C.red);
    const s = this.app.save.hardcore.run;
    if (s) {
      const h = HERO_BY_ID[s.hero];
      const next = levelDef(s.depth);
      drawSprite(g, h.sprite, 38, 70, { scale: 2 });
      drawText(g, h.name, 62, 54, h.color, { scale: 2, shadow: C.black });
      drawText(g, h.role, 62, 78, C.lavender);
      const lines = [
        s.inProgress ? `W trakcie poziomu ${s.depth} (${fmtTime(s.stage?.time ?? 0)})` : `Następny poziom: ${s.depth}`,
        next.name,
        `Cel: ${objectiveLabel(next.objective)}`,
        `LV ${s.level}   karty ${s.cards.reduce((n, c) => n + c[1], 0)}   złoto ${fmt(s.gold)}`,
        `Czas ${fmtTime(s.totalTime)}   zabójstwa ${fmt(s.kills)}`,
      ];
      lines.forEach((l, i) => drawText(g, l, 24, 104 + i * 13, i === 0 ? C.yellow : C.lgray));
    } else {
      const rules = 'Poziomy po kolei: cel, potem boss. Po zwycięstwie zachowujesz wszystko i idziesz dalej. Śmierć lub poddanie kasuje cały postęp. Wyjście z gry w trakcie poziomu też.';
      wrapText(rules, 200).forEach((l, i) => drawText(g, l, 24, 52 + i * 13, C.lgray));
    }
    this.menu.render(r);
    renderBoard(this.app, 246, 40, 224, 8);
  }
}

/** Tablica rekordów Hardcore (najdalszy poziom, potem czas). */
function renderBoard(app: App, x: number, y: number, w: number, rows: number): void {
  const r = app.r, g = r.g;
  panel(r, x, y, w, 26 + rows * 13, C.gold);
  drawText(g, 'Rekordy Hardcore', x + 12, y + 8, C.yellow, { shadow: C.black });
  const board = app.save.hardcore.board;
  if (board.length === 0) drawText(g, 'Brak wpisów', x + 12, y + 24, C.dgray);
  board.slice(0, rows).forEach((e, i) => {
    const h = HERO_BY_ID[e.hero];
    const yy = y + 24 + i * 13;
    drawText(g, `${i + 1}.`, x + 12, yy, C.lavender);
    drawText(g, h?.name ?? e.hero, x + 28, yy, h?.color ?? C.white);
    drawText(g, `poziom ${e.depth}`, x + w - 60, yy, C.white, { align: 'right' });
    drawText(g, fmtTime(e.time), x + w - 12, yy, C.lgray, { align: 'right' });
  });
}

const CARD_W = 222;
const CARD_H = 204;

export class HeroSelect implements Screen {
  private sel = 0;

  constructor(private readonly app: App, private readonly mode: Mode) {}

  private start(): void {
    sfx.play('levelup');
    this.app.go(new GameScreen(this.app, HEROES[this.sel].id, this.mode));
  }

  private cardX(i: number): number {
    return 12 + i * (CARD_W + 12);
  }

  update(): void {
    const inp = this.app.input;
    const n = HEROES.length;
    if (inp.pressed('left')) { this.sel = (this.sel - 1 + n) % n; sfx.play('select'); }
    if (inp.pressed('right')) { this.sel = (this.sel + 1) % n; sfx.play('select'); }
    if (inp.pressed('confirm')) this.start();
    if (inp.pressed('back')) this.app.go(this.mode === 'hardcore' ? new HardcoreScreen(this.app) : new MainMenu(this.app));
    if (inp.pressed('click')) {
      HEROES.forEach((_, i) => {
        if (!inside(inp.mouse.x, inp.mouse.y, this.cardX(i), 38, CARD_W, CARD_H)) return;
        if (this.sel === i) this.start();
        else this.sel = i;
      });
    }
  }

  render(): void {
    const r = this.app.r, g = r.g;
    r.clear(C.black);
    const hc = this.mode === 'hardcore';
    const title = hc ? 'Hardcore: wybierz bohatera' : this.mode === 'endless' ? 'Endless: wybierz bohatera' : 'Trening: wybierz bohatera';
    drawText(g, title, W / 2, 10, hc ? C.salmon : this.mode === 'endless' ? C.pink : C.yellow, { align: 'center', scale: 2, outline: C.black });
    HEROES.forEach((h, i) => {
      const x = this.cardX(i), y = 38, on = i === this.sel;
      panel(r, x, y, CARD_W, CARD_H, on ? C.gold : C.slate);
      r.withAlpha(0.5, () => r.circle(x + 32, y + 34, 22, C.black, true));
      drawShadow(g, x + 32, y + 56, 30);
      drawSprite(g, `${h.sprite}@${on ? animFrame(h.sprite, Math.floor(performance.now() / 16), 0) : 0}`, x + 32, y + 34, { scale: 2 });
      drawText(g, h.name, x + 64, y + 12, h.color, { scale: 2, shadow: C.black });
      drawText(g, `${h.role}   HP ${h.base.maxHp}   szybkość ${h.base.speed}`, x + 64, y + 38, C.lavender);
      const wpn = WEAPON_BY_ID[h.weapon];
      drawSprite(g, wpn.icon, x + 19, y + 71);
      drawText(g, `Broń: ${wpn.name}`, x + 32, y + 66, C.white);
      drawText(g, `Pasywka: ${h.passive.name}`, x + 12, y + 84, C.yellow);
      let ly = y + 97;
      for (const line of wrapText(h.passive.desc, CARD_W - 24)) { drawText(g, line, x + 12, ly, C.lgray); ly += 11; }
      ly += 4;
      // Umiejętności w dwóch kolumnach: ikona, klawisz, nazwa.
      h.abilities.forEach((a, i) => {
        const key = a.slot === 'dash' ? 'Spc' : a.slot === 'ult' ? 'R' : a.slot.toUpperCase();
        const ax = x + 12 + (i % 2) * 104, ay = ly + Math.floor(i / 2) * 20;
        slot(r, ax, ay, 18, a.color);
        drawSprite(g, a.icon, ax + 9, ay + 9);
        drawText(g, key, ax + 22, ay - 1, C.lavender);
        drawText(g, a.name, ax + 22, ay + 8, a.color);
      });
      const rec = heroRecord(this.app.save, h.id);
      drawText(g, hc ? `Najdalej: poziom ${rec.bestDepth}` : `Rekord: ${fmtTime(rec.bestTime)}   wygrane: ${rec.wins}`, x + 12, y + CARD_H - 20, C.dgray);
    });
    drawText(g, 'Strzałki: wybór    Enter: start    Esc: wstecz', W / 2, H - 18, C.lavender, { align: 'center' });
  }
}

export class RecordsScreen implements Screen {
  constructor(private readonly app: App) {}

  update(): void {
    const inp = this.app.input;
    if (inp.pressed('back') || inp.pressed('confirm') || inp.pressed('click')) this.app.go(new MainMenu(this.app));
  }

  render(): void {
    const r = this.app.r, g = r.g;
    r.clear(C.black);
    drawText(g, 'Rekordy', W / 2, 8, C.yellow, { align: 'center', scale: 2, outline: C.black });
    renderBoard(this.app, 120, 34, 240, 10);
    panel(r, 20, 200, 440, 56, C.slate);
    const cols = [32, 96, 160, 226, 284, 350, 410];
    ['Bohater', 'Najdłużej', 'Zabójstwa', 'Maks. LV', 'Hardcore', 'Endless', 'Trening'].forEach((s, i) => drawText(g, s, cols[i], 208, C.lavender));
    HEROES.forEach((h, i) => {
      const rec = heroRecord(this.app.save, h.id);
      const y = 222 + i * 12;
      [h.name, fmtTime(rec.bestTime), fmt(rec.bestKills), String(rec.bestLevel), `poziom ${rec.bestDepth}`, fmtTime(rec.bestEndless), `${rec.wins}/${rec.runs}`]
        .forEach((s, j) => drawText(g, s, cols[j], y, j === 0 ? h.color : C.white));
    });
  }
}

const AIM_MODES: AimMode[] = ['auto', 'mixed', 'manual'];
const AIM_LABEL: Record<AimMode, string> = { auto: 'automatyczne', mixed: 'mieszane', manual: 'ręczne' };
const AIM_HINT: Record<AimMode, string> = {
  auto: 'Umiejętności zawsze celują w najbliższego wroga.',
  mixed: 'Celujesz myszą lub prawą gałką, bez nich umiejętności celują w najbliższego wroga.',
  manual: 'Celujesz tylko myszą lub prawą gałką, bez nich w kierunku ruchu.',
};

export class SettingsScreen implements Screen {
  private menu: Menu;
  /** Podpowiedź pod menu dla zaznaczonej pozycji. */
  private hints: (() => string)[];

  constructor(private readonly app: App, private readonly back: Screen) {
    const s = app.save.settings;
    const vol = (d: number) => () => { s.volume = Math.round(Math.max(0, Math.min(1, s.volume + d)) * 10) / 10; app.persist(); };
    const toggle = (k: 'shake' | 'debug' | 'damageNumbers' | 'autoPause' | 'minimap' | 'healNumbers' | 'lowFx' | 'hideProjectiles') => () => { s[k] = !s[k]; app.persist(); };
    const aim = (d: number) => () => {
      const i = Math.max(0, AIM_MODES.indexOf(s.aim));
      s.aim = AIM_MODES[(i + d + AIM_MODES.length) % AIM_MODES.length];
      app.persist();
    };
    const yes = (v: boolean) => (v ? 'tak' : 'nie');
    this.menu = new Menu([
      { label: () => `Głośność ${Math.round(s.volume * 100)}%`, left: vol(-0.1), right: vol(0.1) },
      { label: () => `Celowanie: ${AIM_LABEL[s.aim] ?? AIM_LABEL.mixed}`, left: aim(-1), right: aim(1) },
      { label: () => `Liczby obrażeń: ${yes(s.damageNumbers)}`, act: toggle('damageNumbers') },
      { label: () => `Liczby leczenia: ${yes(s.healNumbers)}`, act: toggle('healNumbers') },
      { label: () => `Minimapa: ${yes(s.minimap)}`, act: toggle('minimap') },
      { label: () => `Wstrząsy ekranu: ${yes(s.shake)}`, act: toggle('shake') },
      { label: () => `Efekty: ${s.lowFx ? 'oszczędne' : 'pełne'}`, act: toggle('lowFx') },
      { label: () => `Pociski gracza: ${s.hideProjectiles ? 'ukryte' : 'widoczne'}`, act: toggle('hideProjectiles') },
      { label: () => `Pauza po wyjściu z okna: ${yes(s.autoPause)}`, act: toggle('autoPause') },
      { label: () => `Pełny ekran: ${yes(!!document.fullscreenElement)}`, act: () => toggleFullscreen() },
      { label: () => `Licznik FPS / debug: ${yes(s.debug)}`, act: toggle('debug') },
      { label: () => 'Wróć', act: () => app.go(back) },
    ], W / 2, 42, 280, 14);
    this.hints = [
      () => 'Strzałki w lewo/prawo zmieniają wartość.',
      () => AIM_HINT[s.aim] ?? AIM_HINT.mixed,
      () => 'Liczby nad trafionymi wrogami (obrażenia gracza zawsze widać).',
      () => 'Zielone liczby nad postacią: ile HP odzyskałeś (co pół sekundy).',
      () => 'Mała mapa w prawym górnym rogu: wrogowie, elity, boss i skrzynie.',
      () => 'Drganie ekranu przy wybuchach i trafieniach.',
      () => 'Oszczędne: mniej cząsteczek, bez cieni, poświat i winiety (więcej FPS, telefon).',
      () => 'Ukryte: twoje pociski działają, ale ich nie widać (łatwiej unikać pocisków wrogów).',
      () => 'Gra pauzuje się sama, gdy przełączysz okno lub kartę.',
      () => 'Przełącza tryb pełnoekranowy przeglądarki.',
      () => 'Licznik klatek i encji; włącza klawisze F4, F6, F7.',
      () => '',
    ];
  }

  update(): void {
    if (this.app.input.pressed('back')) { this.app.go(this.back); return; }
    this.menu.update(this.app.input);
  }

  render(): void {
    const r = this.app.r;
    r.clear(C.black);
    drawText(r.g, 'Ustawienia', W / 2, 8, C.yellow, { align: 'center', scale: 2, outline: C.black });
    panel(r, W / 2 - 160, 34, 320, this.menu.items.length * 14 + 16, C.slate);
    this.menu.render(r);
    wrapText(this.hints[this.menu.sel](), 360).forEach((l, i) => drawText(r.g, l, W / 2, 232 + i * 12, C.lavender, { align: 'center' }));
  }
}

/** Pełny ekran przeglądarki (wywoływane z akcji menu, czyli tuż po geście gracza). */
function toggleFullscreen(): void {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen().catch(() => undefined);
}
