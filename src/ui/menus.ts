import { W, H } from '../core/renderer';
import { C } from '../core/palette';
import { drawText, wrapText, textWidth } from '../core/font';
import { sfx } from '../core/audio';
import { heroRecord, type AimMode, type PlayerFx } from '../core/save';
import { drawSprite, drawShadow, getSprite, TILE } from '../gfx/sprites';
import { animFrame } from '../gfx/actors';
import { HEROES, HERO_BY_ID } from '../data/heroes';
import { WEAPON_BY_ID } from '../data/weapons';
import { levelDef, objectiveLabel } from '../data/levels';
import { BAL } from '../data/balance';
import { endSlotRun } from '../game/campaign';
import type { Mode, RunSnapshot, SlotMode } from '../game/run';
import { fmtTime, fmt } from '../util/format';
import type { App, Screen } from './app';
import { Menu, panel, inside, slot } from './widgets';
import { GameScreen } from './game-screen';
import { CollectionScreen } from './collection';
import { MetaScreen } from './meta';
import { BalanceScreen } from './balance';
import { HelpScreen } from './help';
import { heroMeta, paragonLevel } from '../data/meta';

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
  walk('ignara', lead - 50, false, 2);
  walk('morwen', lead - 74, false, 3);
  PARADE.forEach((name, i) => walk(name, lead - 118 - i * 28, false, i + 4));
}

export class MainMenu implements Screen {
  private t = 0;
  private menu: Menu;

  constructor(private readonly app: App) {
    this.menu = new Menu([
      { label: () => 'Kampania Hardcore', act: () => app.go(new SlotScreen(app, 'hardcore')) },
      { label: () => 'Ekspedycja (3 akty)', act: () => app.go(new SlotScreen(app, 'expedition')) },
      { label: () => 'Endless (bez końca)', act: () => app.go(new SlotScreen(app, 'endless')) },
      { label: () => 'Trening (jeden poziom)', act: () => app.go(new HeroSelect(app, 'training')) },
      { label: () => (app.save.meta.unassigned > 0 ? `Rozwój (${fmt(app.save.meta.unassigned)} do rozdania)` : 'Rozwój bohaterów'), act: () => app.go(new MetaScreen(app, this)) },
      { label: () => 'Kolekcja kart', act: () => app.go(new CollectionScreen(app, this)) },
      { label: () => 'Rekordy', act: () => app.go(new RecordsScreen(app)) },
      { label: () => 'Pomoc', act: () => app.go(new HelpScreen(app, this)) },
      { label: () => 'Ustawienia', act: () => app.go(new SettingsScreen(app, this)) },
    ], W / 2, 86, 220, 12);
    // Nowy gracz (bez żadnego runu i zapisu): kursor od razu na Treningu.
    if (isNewPlayer(app)) this.menu.sel = 3;
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
    drawText(g, 'Przetrwaj. Rozwijaj się. Bez końca.', W / 2, 66, C.lavender, { align: 'center', shadow: C.black });
    if (this.app.save.notice) drawText(g, this.app.save.notice, W / 2, 74, C.orange, { align: 'center', outline: C.black });
    this.menu.render(this.app.r);
    // Opis zaznaczonej pozycji; nowemu graczowi Trening jest polecany.
    const desc = MENU_DESC[this.menu.sel] ?? '';
    const tip = isNewPlayer(this.app) && this.menu.sel === 3 ? 'Polecane na start! ' : '';
    drawText(g, tip + desc, W / 2, 199, tip ? C.lime : C.lavender, { align: 'center', outline: C.black });
  }
}

/** Opisy pozycji menu głównego (kolejność jak w menu). */
const MENU_DESC = [
  'Poziomy po kolei z bossami i sklepem. Śmierć kasuje cały run.',
  'Wyprawa przez 3 akty map z modyfikatorami. Daje esencję na Rozwój.',
  'Jeden poziom bez końca, boss co 5 minut, coraz trudniej.',
  'Jeden poziom z bossem, bez zapisu. Dobry na naukę bohaterów.',
  'Drzewka bohaterów kupowane esencją z Ekspedycji.',
  'Odkryte karty i bany (wykluczenie kart z ofert), odkryte unikaty.',
  'Najlepsze wyniki bohaterów w każdym trybie.',
  'Sterowanie, zasady, żywioły i reakcje, synergie, tryby.',
  'Dźwięk, celowanie, widoczność efektów, podpowiedzi.',
];

/** Nowy gracz: żadnego zakończonego ani trwającego runu. */
function isNewPlayer(app: App): boolean {
  const s = app.save;
  return Object.values(s.records).every((r) => r.runs === 0 && r.bestTime === 0) && !Object.values(s.slots).some(Boolean);
}

const SLOT_TITLE: Record<SlotMode, string> = { hardcore: 'Kampania Hardcore', expedition: 'Ekspedycja', endless: 'Endless' };
const SLOT_COLOR: Record<SlotMode, number> = { hardcore: C.salmon, expedition: C.lime, endless: C.pink };
const SLOT_NEW: Record<SlotMode, string> = { hardcore: 'Nowa kampania', expedition: 'Nowa ekspedycja', endless: 'Nowy run' };
const SLOT_RULES: Record<SlotMode, string> = {
  hardcore: 'Poziomy po kolei: cel, potem boss. Po zwycięstwie zachowujesz wszystko i idziesz dalej. Śmierć lub poddanie kasuje cały postęp. Wyjście z gry zapisuje run.',
  expedition: `Wyprawa przez ${BAL.expedition.acts} akty. Wybierasz drogę przez mapy z modyfikatorami (ryzyko za więcej łupu), lochy, kapliczki, sklepy, kowadła i obozy. Na końcu aktu boss. Tylko tu działa Rozwój i zdobywasz esencję.`,
  endless: 'Jeden poziom bez końca: boss co kilka minut, potem silniejsi wrogowie i następny biom. Wyjście z gry zapisuje run, śmierć go kończy.',
};

/** Slot trybu (Hardcore, Ekspedycja, Endless): kontynuacja zapisanego runu, porzucenie albo nowy run + rekordy. */
export class SlotScreen implements Screen {
  private menu: Menu;
  private confirmAbandon = false;

  constructor(private readonly app: App, private readonly mode: SlotMode) {
    const run = app.save.slots[mode];
    this.menu = new Menu(run ? [
      { label: () => 'Kontynuuj', act: () => app.go(new GameScreen(app, run.hero, mode, run)) },
      {
        label: () => (this.confirmAbandon ? 'Na pewno? Run przepadnie' : 'Porzuć run'),
        act: () => {
          if (!this.confirmAbandon) { this.confirmAbandon = true; return; }
          endSlotRun(app.save, mode, run);
          app.persist();
          app.go(new SlotScreen(app, mode));
        },
      },
      { label: () => 'Wstecz', act: () => app.go(new MainMenu(app)) },
    ] : [
      { label: () => SLOT_NEW[mode], act: () => app.go(new HeroSelect(app, mode)) },
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
    const col = SLOT_COLOR[this.mode];
    drawText(g, SLOT_TITLE[this.mode], W / 2, 10, col, { align: 'center', scale: 2, outline: C.black });
    panel(r, 12, 40, 224, 146, col);
    const s = this.app.save.slots[this.mode];
    if (s) {
      const h = HERO_BY_ID[s.hero];
      drawSprite(g, h.sprite, 38, 70, { scale: 2 });
      drawText(g, h.name, 62, 54, h.color, { scale: 2, shadow: C.black });
      drawText(g, h.role, 62, 78, C.lavender);
      const lines = [...slotLines(this.mode, s),
        `LV ${s.level}   karty ${s.cards.reduce((n, c) => n + c[1], 0)}   złoto ${fmt(s.gold)}`,
        `Czas ${fmtTime(s.totalTime)}   zabójstwa ${fmt(s.kills)}`,
      ];
      lines.forEach((l, i) => drawText(g, l, 24, 104 + i * 13, i === 0 ? C.yellow : C.lgray));
    } else {
      wrapText(SLOT_RULES[this.mode], 200).forEach((l, i) => drawText(g, l, 24, 52 + i * 13, C.lgray));
    }
    this.menu.render(r);
    if (this.mode === 'hardcore') renderBoard(this.app, 246, 40, 224, 8);
    else renderHeroBests(this.app, this.mode, 246, 40, 224);
  }
}

/** Opis zapisanego runu w slocie (pierwsza linia wyróżniona). */
function slotLines(mode: SlotMode, s: RunSnapshot): string[] {
  if (mode === 'hardcore') {
    const next = levelDef(s.depth);
    return [
      s.inProgress ? `W trakcie poziomu ${s.depth} (${fmtTime(s.stage?.time ?? 0)})` : `Następny poziom: ${s.depth}`,
      next.name,
      `Cel: ${objectiveLabel(next.objective)}`,
    ];
  }
  if (mode === 'endless') return [`Głębia ${s.depth}, czas poziomu ${fmtTime(s.stage?.time ?? 0)}`];
  const ex = s.expedition;
  return [
    s.inProgress ? `W trakcie walki (${fmtTime(s.stage?.time ?? 0)})` : 'Na mapie, wybór drogi',
    `Akt ${ex?.act ?? 1}/${BAL.expedition.acts}, rząd ${ex?.path.length ?? 0}/${BAL.expedition.rows}`,
    `Ukończone węzły: ${ex?.cleared ?? 0}`,
  ];
}

/** Rekordy bohaterów w trybie bez tablicy (Endless: najdłuższy czas, Ekspedycja: węzły i ukończone wyprawy). */
function renderHeroBests(app: App, mode: SlotMode, x: number, y: number, w: number): void {
  const r = app.r, g = r.g;
  panel(r, x, y, w, 26 + HEROES.length * 13, C.gold);
  drawText(g, 'Rekordy bohaterów', x + 12, y + 8, C.yellow, { shadow: C.black });
  HEROES.forEach((h, i) => {
    const rec = heroRecord(app.save, h.id);
    const yy = y + 24 + i * 13;
    drawText(g, h.name, x + 12, yy, h.color);
    const v = mode === 'endless' ? fmtTime(rec.bestEndless) : `węzły ${rec.bestExpedition}   ukończone ${rec.expeditionWins}`;
    drawText(g, v, x + w - 12, yy, C.white, { align: 'right' });
  });
}

/** Tablica rekordów Hardcore (najdalszy poziom, potem czas). */
function renderBoard(app: App, x: number, y: number, w: number, rows: number): void {
  const r = app.r, g = r.g;
  panel(r, x, y, w, 26 + rows * 13, C.gold);
  drawText(g, 'Rekordy Hardcore', x + 12, y + 8, C.yellow, { shadow: C.black });
  const board = app.save.board;
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

const LIST_X = 12, LIST_W = 140, ROW_H = 36, TOP = 38;
const DET_X = LIST_X + LIST_W + 8, DET_W = W - DET_X - 12, DET_H = 212;

/** Wybór bohatera: lista po lewej (do 6 bohaterów), szczegóły zaznaczonego po prawej. */
export class HeroSelect implements Screen {
  private sel = 0;

  constructor(private readonly app: App, private readonly mode: Mode) {
    // Kursor na ostatnio wybranym bohaterze.
    this.sel = Math.max(0, HEROES.findIndex((h) => h.id === app.save.lastHero));
  }

  private start(): void {
    sfx.play('levelup');
    this.app.save.lastHero = HEROES[this.sel].id;
    this.app.persist();
    this.app.go(new GameScreen(this.app, HEROES[this.sel].id, this.mode));
  }

  update(): void {
    const inp = this.app.input;
    const n = HEROES.length;
    if (inp.pressed('up') || inp.pressed('left')) { this.sel = (this.sel - 1 + n) % n; sfx.play('select'); }
    if (inp.pressed('down') || inp.pressed('right')) { this.sel = (this.sel + 1) % n; sfx.play('select'); }
    if (inp.pressed('confirm')) this.start();
    if (inp.pressed('back')) this.app.go(this.mode === 'training' ? new MainMenu(this.app) : new SlotScreen(this.app, this.mode));
    if (inp.pressed('click')) {
      const { x, y } = inp.mouse;
      if (inside(x, y, DET_X, TOP, DET_W, DET_H)) { this.start(); return; }
      HEROES.forEach((_, i) => {
        if (!inside(x, y, LIST_X, TOP + i * ROW_H, LIST_W, ROW_H - 4)) return;
        if (this.sel === i) this.start();
        else { this.sel = i; sfx.play('select'); }
      });
    }
  }

  render(): void {
    const r = this.app.r, g = r.g;
    r.clear(C.black);
    const m = this.mode;
    const title = `${m === 'training' ? 'Trening' : SLOT_TITLE[m].split(' ').pop()}: wybierz bohatera`;
    drawText(g, title, W / 2, 10, m === 'training' ? C.yellow : SLOT_COLOR[m], { align: 'center', scale: 2, outline: C.black });
    // Lista bohaterów.
    HEROES.forEach((h, i) => {
      const y = TOP + i * ROW_H, on = i === this.sel;
      panel(r, LIST_X, y, LIST_W, ROW_H - 4, on ? C.gold : C.slate);
      drawSprite(g, `${h.sprite}@${on ? animFrame(h.sprite, Math.floor(performance.now() / 16), 0) : 0}`, LIST_X + 18, y + 16);
      drawText(g, h.name, LIST_X + 34, y + 5, h.color, { shadow: C.black });
      drawText(g, h.role, LIST_X + 34, y + 17, C.lavender);
    });
    // Szczegóły zaznaczonego.
    const h = HEROES[this.sel], x = DET_X, y = TOP;
    panel(r, x, y, DET_W, DET_H, C.gold);
    r.withAlpha(0.5, () => r.circle(x + 32, y + 34, 22, C.black, true));
    drawShadow(g, x + 32, y + 56, 30);
    drawSprite(g, `${h.sprite}@${animFrame(h.sprite, Math.floor(performance.now() / 16), 0)}`, x + 32, y + 34, { scale: 2 });
    drawText(g, h.name, x + 64, y + 12, h.color, { scale: 2, shadow: C.black });
    drawText(g, `${h.role}   HP ${h.base.maxHp}   szybkość ${h.base.speed}`, x + 64, y + 38, C.lavender);
    const wpn = WEAPON_BY_ID[h.weapon];
    drawSprite(g, wpn.icon, x + 19, y + 71);
    drawText(g, `Broń: ${wpn.name}`, x + 32, y + 66, C.white);
    drawText(g, `Pasywka: ${h.passive.name}`, x + 12, y + 84, C.yellow);
    let ly = y + 97;
    for (const line of wrapText(h.passive.desc, DET_W - 24)) { drawText(g, line, x + 12, ly, C.lgray); ly += 11; }
    // Zasób bohatera: nazwa w kolorze paska, opis w tej samej linii.
    const head = `Zasób: ${h.resource.name}. `;
    wrapText(head + h.resource.desc, DET_W - 24).forEach((line, i) => {
      if (i === 0) {
        drawText(g, head, x + 12, ly + 2, h.resource.color);
        drawText(g, line.slice(head.length), x + 12 + textWidth(head), ly + 2, C.lgray);
      } else drawText(g, line, x + 12, ly + 2, C.lgray);
      ly += 11;
    });
    ly += 6;
    // Umiejętności w dwóch kolumnach: ikona, klawisz, nazwa.
    h.abilities.forEach((a, i) => {
      const key = a.slot === 'dash' ? 'Spc' : a.slot === 'ult' ? 'R' : a.slot.toUpperCase();
      const ax = x + 12 + (i % 2) * 140, ay = ly + Math.floor(i / 2) * 20;
      slot(r, ax, ay, 18, a.color);
      drawSprite(g, a.icon, ax + 9, ay + 9);
      drawText(g, key, ax + 22, ay - 1, C.lavender);
      drawText(g, a.name, ax + 22, ay + 8, a.color);
    });
    const rec = heroRecord(this.app.save, h.id);
    const best = m === 'hardcore' ? `Najdalej: poziom ${rec.bestDepth}`
      : m === 'expedition' ? `Najwięcej map: ${rec.bestExpedition}   ukończone: ${rec.expeditionWins}`
      : m === 'endless' ? `Rekord: ${fmtTime(rec.bestEndless)}` : `Rekord: ${fmtTime(rec.bestTime)}   wygrane: ${rec.wins}`;
    drawText(g, best, x + 12, y + DET_H - 14, C.dgray);
    if (m === 'expedition') {
      const hm = heroMeta(this.app.save.meta, h.id);
      drawText(g, `Rozwój: esencja ${fmt(hm.essence)}, Paragon ${paragonLevel(hm.total)}, prestiż ${hm.prestige}`, x + 12, y + DET_H - 25, C.cyan);
    }
    drawText(g, 'Strzałki: wybór    Enter: start    Esc: wstecz', W / 2, H - 16, C.lavender, { align: 'center' });
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
    const cols = [30, 84, 136, 192, 240, 290, 340, 408];
    ['Bohater', 'Najdłużej', 'Zabójstwa', 'Maks. LV', 'Hardcore', 'Endless', 'Ekspedycja', 'Trening'].forEach((s, i) => drawText(g, s, cols[i], 208, C.lavender));
    HEROES.forEach((h, i) => {
      const rec = heroRecord(this.app.save, h.id);
      const y = 222 + i * 12;
      [h.name, fmtTime(rec.bestTime), fmt(rec.bestKills), String(rec.bestLevel), `poz. ${rec.bestDepth}`, fmtTime(rec.bestEndless), `${rec.bestExpedition} (${rec.expeditionWins})`, `${rec.wins}/${rec.runs}`]
        .forEach((s, j) => drawText(g, s, cols[j], y, j === 0 ? h.color : C.white));
    });
  }
}

const AIM_MODES: AimMode[] = ['auto', 'mixed', 'manual'];
const FX_MODES: PlayerFx[] = ['visible', 'dim', 'hidden'];
const FX_LABEL: Record<PlayerFx, string> = { visible: 'widoczne', dim: 'przygaszone', hidden: 'ukryte' };
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
    const toggle = (k: 'shake' | 'debug' | 'damageNumbers' | 'autoPause' | 'minimap' | 'healNumbers' | 'lowFx' | 'hints' | 'hitstop') => () => { s[k] = !s[k]; app.persist(); };
    const aim = (d: number) => () => {
      const i = Math.max(0, AIM_MODES.indexOf(s.aim));
      s.aim = AIM_MODES[(i + d + AIM_MODES.length) % AIM_MODES.length];
      app.persist();
    };
    const fx = (d: number) => () => {
      const i = Math.max(0, FX_MODES.indexOf(s.playerFx));
      s.playerFx = FX_MODES[(i + d + FX_MODES.length) % FX_MODES.length];
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
      { label: () => `Ataki gracza: ${FX_LABEL[s.playerFx] ?? FX_LABEL.visible}`, left: fx(-1), right: fx(1) },
      { label: () => `Pauza po wyjściu z okna: ${yes(s.autoPause)}`, act: toggle('autoPause') },
      { label: () => `Podpowiedzi: ${yes(s.hints)}`, act: toggle('hints') },
      { label: () => (app.save.seenHints.length ? 'Pokaż podpowiedzi od nowa' : 'Podpowiedzi: wszystkie przed tobą'), act: () => { app.save.seenHints = []; app.persist(); } },
      { label: () => `Zatrzymanie klatki przy trafieniach: ${yes(s.hitstop)}`, act: toggle('hitstop') },
      { label: () => `Pełny ekran: ${yes(!!document.fullscreenElement)}`, act: () => toggleFullscreen() },
      { label: () => `Licznik FPS / debug: ${yes(s.debug)}`, act: toggle('debug') },
      { label: () => (s.debug ? 'Podgląd balansu' : 'Podgląd balansu (włącz debug)'), act: () => { if (s.debug) app.go(new BalanceScreen(app, this)); } },
      { label: () => 'Wróć', act: () => app.go(back) },
    ], W / 2, 40, 280, 12);
    this.hints = [
      () => 'Strzałki w lewo/prawo zmieniają wartość.',
      () => AIM_HINT[s.aim] ?? AIM_HINT.mixed,
      () => 'Liczby nad trafionymi wrogami (obrażenia gracza zawsze widać).',
      () => 'Zielone liczby nad postacią: ile HP odzyskałeś (co pół sekundy).',
      () => 'Mała mapa w prawym górnym rogu: wrogowie, elity, boss i skrzynie.',
      () => 'Drganie ekranu przy wybuchach i trafieniach.',
      () => 'Oszczędne: mniej cząsteczek, bez cieni, poświat i winiety (więcej FPS, telefon).',
      () => 'Twoje pociski, aury, strefy i błyski trafień: przygaszone (półprzezroczyste) albo ukryte. Działają dalej, a pociski wrogów widać lepiej.',
      () => 'Gra pauzuje się sama, gdy przełączysz okno lub kartę.',
      () => 'Krótkie wskazówki przy pierwszym spotkaniu z mechaniką (awans, skrzynie, elity, reakcje...).',
      () => 'Kolejna gra pokaże wszystkie podpowiedzi jeszcze raz.',
      () => 'Gra na ułamek sekundy staje przy zabiciu elity, bossa i mocnym trafieniu.',
      () => 'Przełącza tryb pełnoekranowy przeglądarki.',
      () => 'Licznik klatek i encji; włącza klawisze F4, F6, F7.',
      () => 'Wartości do sprawdzenia: HP przedmiotów i ulepszeń, skalowanie wrogów, miękkie limity.',
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
    panel(r, W / 2 - 160, 32, 320, this.menu.items.length * 12 + 16, C.slate);
    this.menu.render(r);
    wrapText(this.hints[this.menu.sel](), 400).forEach((l, i) => drawText(r.g, l, W / 2, 246 + i * 11, C.lavender, { align: 'center' }));
  }
}

/** Pełny ekran przeglądarki (wywoływane z akcji menu, czyli tuż po geście gracza). */
function toggleFullscreen(): void {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen().catch(() => undefined);
}
