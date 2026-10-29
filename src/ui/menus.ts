import { W, H, OX } from '../core/renderer';
import { C, PAL } from '../core/palette';
import { drawText, wrapText, textWidth, setTextSize, DESC, descS, descLH } from '../core/font';
import { sfx } from '../core/audio';
import { heroRecord, type AimMode, type PlayerFx } from '../core/save';
import { drawSprite, drawShadow, blit, TILE } from '../gfx/sprites';
import { animFrame } from '../gfx/actors';
import { HEROES, HERO_BY_ID, resourceDetails, type HeroDef } from '../data/heroes';
import { WEAPON_BY_ID } from '../data/weapons';
import { BAL } from '../data/balance';
import { endSlotRun } from '../game/campaign';
import type { Mode, RunSnapshot, SlotMode } from '../game/run';
import { fmtTime, fmt } from '../util/format';
import type { App, Screen } from './app';
import { Menu, panel, inside, slot, button, hovered, Scroll, type MenuItem, titleBar, ember } from './widgets';
import { UI } from './theme';
import { drawSkills } from './skills';
import { setLang, type Lang } from '../core/i18n';
import { music, MENU_MOOD } from '../core/music';
import { GameScreen } from './game-screen';
import { CodexScreen } from './codex';
import { CollectionScreen } from './collection';
import { MetaScreen } from './meta';
import { BalanceScreen } from './balance';
import { ControlsScreen } from './controls';
import { HelpScreen } from './help';
import { heroMeta, paragonLevel } from '../data/meta';
import { pactLevel, pactBadge, heroSkins, BADGE_BY_ID } from '../data/pacts';
import { UNLOCK_BY_ID, heroUnlocked, unlocked } from '../data/unlocks';
import { PactScreen } from './pacts';

const PARADE = ['slime', 'bat', 'golem', 'eye', 'wisp', 'spinner'];

/** Tło menu: nocne niebo z gradientem, gwiazdy, księżyc, dwa pasma wzgórz, przewijany pas łąki i defilada potworów goniących bohaterów. */
function menuBackdrop(app: App, t: number): void {
  const r = app.r, g = r.g;
  const groundY = H - 58;
  // Szeroki ekran: tło od lewej do prawej krawędzi okna (L..R), interfejs zostaje na środku.
  const L = -OX, R = W + OX;
  const sky = g.createLinearGradient(0, 0, 0, groundY);
  sky.addColorStop(0, PAL[C.black]);
  sky.addColorStop(0.7, PAL[C.navy]);
  sky.addColorStop(1, PAL[C.slate]);
  g.fillStyle = sky;
  g.fillRect(L, 0, R - L, H);
  for (let i = 0; i < 90; i++) {
    const x = L + ((i * 97 + t * (2 + (i % 3) * 2)) % (R - L + 20)) - 10;
    const y = (i * 53) % (groundY - 40);
    const tw = (Math.sin(t * 2 + i) + 1) / 2;
    r.withAlpha(0.4 + 0.6 * tw, () => r.rect(x, y, i % 7 === 0 ? 1 : 0.5, i % 7 === 0 ? 1 : 0.5, i % 5 === 0 ? C.white : C.lgray));
  }
  // Księżyc z poświatą: gładkie koła jak wzgórza (grube piksele logiczne odstawały od drobnych sprite'ów).
  const disc = (x: number, y: number, rad: number, col: number) => {
    g.fillStyle = PAL[col];
    g.beginPath();
    g.arc(x, y, rad, 0, Math.PI * 2);
    g.fill();
  };
  r.withAlpha(0.08, () => disc(404, 38, 24, C.cream));
  r.withAlpha(0.12, () => disc(404, 38, 17, C.cream));
  disc(404, 38, 12, C.cream);
  r.withAlpha(0.7, () => { disc(400, 35, 2.8, C.tan); disc(408.5, 42, 1.8, C.tan); disc(406, 32.5, 1.2, C.tan); });
  // Wzgórza: dalsze jaśniejsze, bliższe ciemniejsze, przesuwają się wolniej niż łąka (paralaksa).
  for (const [col, base, amp, speed, freq] of [[C.navy, groundY - 34, 12, 4, 0.021], [C.black, groundY - 14, 10, 10, 0.034]] as const) {
    g.fillStyle = PAL[col];
    g.beginPath();
    g.moveTo(L, groundY);
    for (let x = L; x <= R + 4; x += 4) g.lineTo(x, base - amp * (0.5 + 0.5 * Math.sin((x + t * speed) * freq)) - 6 * Math.sin((x + t * speed) * freq * 2.7));
    g.lineTo(R + 4, groundY);
    g.fill();
  }
  const off = Math.floor(t * 30) % TILE;
  const x0 = L - ((L % TILE) + TILE) % TILE - off;
  for (let x = x0; x < R; x += TILE) for (let y = groundY; y < H; y += TILE) blit(g, `tile0_${(((x + off) / TILE + y) % 10 + 10) % 10}`, x, y);
  r.rect(L, groundY, R - L, 1, C.black);
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
  walk('vesper', lead - 98, false, 4);
  walk('aurel', lead - 122, false, 5);
  walk('takezo', lead - 146, false, 6);
  PARADE.forEach((name, i) => walk(name, lead - 190 - i * 28, false, i + 7));
}

export class MainMenu implements Screen {
  private t = 0;
  private menu: Menu;

  constructor(private readonly app: App) {
    this.menu = new Menu([
      { label: () => 'Ekspedycja (3 akty)', act: () => app.go(new SlotScreen(app, 'expedition')) },
      { label: () => (unlocked(app.save, 'endless') ? 'Endless (bez końca)' : 'Endless (locked)'), act: () => (unlocked(app.save, 'endless') ? app.go(new SlotScreen(app, 'endless')) : sfx.play('hurt')) },
      { label: () => (app.save.meta.unassigned > 0 ? `Rozwój (${fmt(app.save.meta.unassigned)} do rozdania)` : 'Rozwój bohaterów'), act: () => app.go(new MetaScreen(app, this)) },
      { label: () => 'Kolekcja i osiągnięcia', act: () => app.go(new CollectionScreen(app, this)) },
      { label: () => 'Evolution book', act: () => app.go(new CodexScreen(app, this)) },
      { label: () => 'Rekordy', act: () => app.go(new RecordsScreen(app)) },
      { label: () => 'Pomoc', act: () => app.go(new HelpScreen(app, this)) },
      { label: () => 'Ustawienia', act: () => app.go(new SettingsScreen(app, this)) },
    ], MENU_X + MENU_W / 2, 66, MENU_W - 12, 15, { 2: 10, 6: 10 });
    music.setMood(MENU_MOOD);
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
    const r = this.app.r, g = r.g, m = this.menu;
    // Logo: cień, obrys i pionowy gradient (żółty → złoty → pomarańczowy) przez przycinanie pasami.
    drawText(g, 'Pixel Survivors', W / 2 + 2, 10, C.dred, { align: 'center', scale: 3 });
    drawText(g, 'Pixel Survivors', W / 2, 8, C.yellow, { align: 'center', scale: 3, outline: C.black });
    for (const [y0, col] of [[19, C.gold], [28, C.orange]] as const) {
      g.save();
      g.beginPath();
      g.rect(0, y0, W, 30);
      g.clip();
      drawText(g, 'Pixel Survivors', W / 2, 8, col, { align: 'center', scale: 3 });
      g.restore();
    }
    drawText(g, 'Przetrwaj. Rozwijaj się. Bez końca.', W / 2, 39, C.lavender, { align: 'center', scale: 0.75, outline: C.black });
    drawText(g, `v${__APP_VERSION__}`, W - 4, H - 10, C.lavender, { align: 'right', scale: 0.75, outline: C.black });
    // Lewy panel: pozycje w grupach z nagłówkami.
    panel(r, MENU_X, 48, MENU_W, 166);
    MENU_GROUPS.forEach(([name, first]) => {
      const y = m.top(first) - 9;
      drawText(g, name, MENU_X + 10, y, C.lavender, { scale: 0.75 });
      r.withAlpha(0.5, () => r.rect(MENU_X + 10 + textWidth(name) * 0.75 + 4, y + 3.5, MENU_W - 30 - textWidth(name) * 0.75, 0.5, C.slate));
    });
    m.render(r);
    // Prawy panel: ikona, nazwa i opis zaznaczonej pozycji; nowemu graczowi Ekspedycja jest polecana.
    const dx = MENU_X + MENU_W + 10, dw = W - dx - 18;
    panel(r, dx, 48, dw, 112);
    slot(r, dx + 10, 58, 28);
    drawSprite(g, MENU_ICON[m.sel], dx + 24, 72);
    drawText(g, m.items[m.sel].label(), dx + 46, 60, C.yellow, { shadow: C.black });
    const tip = isNewPlayer(this.app) && m.sel === 0;
    if (tip) drawText(g, 'Recommended for a first run', dx + 46, 72, C.lime, { shadow: C.black });
    let ly = 94;
    const desc = m.sel === 1 && !unlocked(this.app.save, 'endless') ? `Locked. ${UNLOCK_BY_ID.endless.how}` : MENU_DESC[m.sel] ?? '';
    for (const l of wrapText(desc, dw - 22)) { drawText(g, l, dx + 11, ly, C.lgray); ly += 11; }
    ly += 4;
    for (const [l, col] of this.info(m.sel)) { drawText(g, l, dx + 11, ly, col, { scale: 0.75 }); ly += 9; }
    drawText(g, 'Strzałki / mysz: wybór   Enter: wejdź   F: pełny ekran', dx + dw / 2, 148, C.lavender, { align: 'center', scale: 0.75 });
    if (this.app.save.notice) {
      panel(r, dx, 166, dw, 44, C.orange);
      wrapText(this.app.save.notice, dw - 22).slice(0, 3).forEach((l, i) => drawText(g, l, dx + 11, 172 + i * 11, C.orange));
    }
  }

  /** Dodatkowe informacje w panelu opisu: zapisany run, esencja do rozdania, postęp kolekcji. */
  private info(sel: number): [string, number][] {
    const s = this.app.save;
    const slotMode = (['expedition', 'endless'] as const)[sel];
    if (slotMode === 'endless' && !unlocked(s, 'endless')) return [];
    if (slotMode) {
      const snap = s.slots[slotMode];
      return snap ? [[`Zapisany run: ${HERO_BY_ID[snap.hero]?.name ?? snap.hero}, LV ${snap.level}`, C.lime], ...slotLines(slotMode, snap).slice(0, 1).map((l): [string, number] => [l, C.lgray])] : [['Brak zapisanego runu.', C.lavender]];
    }
    if (sel === 2) return [[s.meta.unassigned > 0 ? `Esencja do rozdania: ${fmt(s.meta.unassigned)}` : 'You earn essence in Expeditions and in Endless.', C.cyan]];
    if (sel === 3) return [[`Karty ${s.collection.seen.length}, sekrety ${s.collection.secrets.length}, osiągnięcia ${s.achievements.length}`, C.lgray]];
    return [];
  }
}

/** Menu główne: lewy panel z pozycjami (grupy: od indeksu) i ikony pozycji w panelu opisu. */
const MENU_X = 18, MENU_W = 196;
const MENU_GROUPS: [string, number][] = [['Play', 0], ['Progress', 2], ['Other', 6]];
const MENU_ICON = ['ex_boss', 'ic_orbit_evo', 'syn_all', 'ex_chest', 'ic_bolt_evo', 'cd_gold', 'tag:Umiejętności', 'ex_anvil'];

/** Opisy pozycji menu głównego (kolejność jak w menu). */
const MENU_DESC = [
  'Expedition across 3 acts of maps with modifiers, dungeons, shops and bosses. The most essence for Progression.',
  'One endless level, a boss every few minutes, harder and harder. Essence depends on how long you survive.',
  'Hero trees bought with essence from Expeditions and Endless.',
  'Karty i bany, unikaty, Księga sekretów, bestiariusz i osiągnięcia.',
  'Every weapon, passive and ability evolution, every fusion, quality and augment, and how to get them in a run.',
  'Najlepsze wyniki bohaterów w każdym trybie.',
  'Sterowanie, zasady, żywioły, synergie, zasoby, moce, tryby.',
  'Dźwięk, celowanie, widoczność efektów, podpowiedzi.',
];

/** Nowy gracz: żadnego zakończonego ani trwającego runu. */
function isNewPlayer(app: App): boolean {
  const s = app.save;
  return Object.values(s.records).every((r) => r.bestTime === 0) && !Object.values(s.slots).some(Boolean);
}

const SLOT_TITLE: Record<SlotMode, string> = { expedition: 'Ekspedycja', endless: 'Endless' };
/** Tytuł wyboru bohatera (pełne napisy: wzorzec „{}: …” łapał polski wzorzec „Endless: {}”). */
const PICK_TITLE: Record<SlotMode, string> = { expedition: 'Expedition: choose a hero', endless: 'Endless: choose a hero' };
const SLOT_NEW: Record<SlotMode, string> = { expedition: 'Nowa ekspedycja', endless: 'Nowy run' };
const SLOT_RULES: Record<SlotMode, string> = {
  expedition: `An expedition across ${BAL.expedition.acts} acts. Pick your path through maps with modifiers (risk for more loot), dungeons, shrines, shops, anvils and camps. A boss ends every act. The most essence for Progression.`,
  endless: 'One endless level: a boss every few minutes, then stronger enemies and the next biome. Quitting the game saves the run, death ends it. Essence for Progression depends on how long you survive.',
};

/** Slot trybu (Ekspedycja, Endless): kontynuacja zapisanego runu, porzucenie albo nowy run + rekordy. */
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
    ], 124, run ? 196 : this.panelH() + 50, 220);
  }

  /** Wysokość panelu po lewej: zapisany run albo opis zasad (wtedy menu tuż pod nim, bez pustego pola). */
  private panelH(): number {
    return this.app.save.slots[this.mode] ? 146 : 24 + wrapText(SLOT_RULES[this.mode], 200).length * 13;
  }

  update(): void {
    if (this.app.input.pressed('back')) { this.app.go(new MainMenu(this.app)); return; }
    this.menu.update(this.app.input);
  }

  render(): void {
    const r = this.app.r, g = r.g;
    r.clear(C.black);
    titleBar(r, SLOT_TITLE[this.mode], 10);
    panel(r, 12, 40, 224, this.panelH());
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
    renderHeroBests(this.app, this.mode, 246, 40, 224);
  }
}

/** Opis zapisanego runu w slocie (pierwsza linia wyróżniona). */
function slotLines(mode: SlotMode, s: RunSnapshot): string[] {
  if (mode === 'endless') return [`Głębia ${s.depth}, czas poziomu ${fmtTime(s.stage?.time ?? 0)}`];
  const ex = s.expedition;
  return [
    s.inProgress ? `W trakcie walki (${fmtTime(s.stage?.time ?? 0)})` : 'Na mapie, wybór drogi',
    `Akt ${ex?.act ?? 1}/${BAL.expedition.acts}, rząd ${ex?.path.length ?? 0}/${BAL.expedition.rows}`,
    `Ukończone węzły: ${ex?.cleared ?? 0}`,
  ];
}

/** Rekordy bohaterów w trybie (Endless: najdłuższy czas, Ekspedycja: węzły i ukończone wyprawy). */
function renderHeroBests(app: App, mode: SlotMode, x: number, y: number, w: number): void {
  const r = app.r, g = r.g;
  panel(r, x, y, w, 26 + HEROES.length * 13);
  drawText(g, 'Rekordy bohaterów', x + 12, y + 8, C.yellow, { shadow: C.black });
  HEROES.forEach((h, i) => {
    const rec = heroRecord(app.save, h.id);
    const yy = y + 24 + i * 13;
    drawText(g, h.name, x + 12, yy, h.color);
    const none = mode === 'endless' ? rec.bestEndless <= 0 : rec.bestExpedition <= 0 && rec.expeditionWins <= 0;
    const v = none ? 'not played yet' : mode === 'endless' ? fmtTime(rec.bestEndless) : `węzły ${rec.bestExpedition}   ukończone ${rec.expeditionWins}`;
    drawText(g, v, x + w - 12, yy, none ? C.lavender : C.white, { align: 'right' });
  });
}

const LIST_X = 12, LIST_W = 140, ROW_H = 27, TOP = 36;
const DET_X = LIST_X + LIST_W + 8, DET_W = W - DET_X - 12, DET_H = 212, TAB_W = 62, MORE_W = 64;
const TABS = ['Ogólne', 'Umiejętności', 'Zasób'];
const TAB_Y = TOP + 43;
/** Przyciski na dole ekranu wyboru bohatera: Wstecz (lewo) i Start (prawo). */
const BTN_Y = H - 18, BTN_H = 15, BACK_W = 70, START_W = 110;
/** Przewijany obszar szczegółów na stronach Umiejętności i Zasób (x, y, w, h). */
const DET_AREA = [DET_X + 4, TOP + 60, DET_W - 8, DET_H - 63] as const;

/** Wybór bohatera: lista po lewej (do 6 bohaterów), szczegóły zaznaczonego po prawej. */
export class HeroSelect implements Screen {
  private sel = 0;
  private scroll = new Scroll();
  private scrollKey = -1;
  /** Strona szczegółów: 0 ogólne (broń, pasywka, umiejętności), 1 umiejętności z opisami, 2 zasób z liczbami. */
  private page = 0;
  /** Lewy górny róg przycisku „Szczegóły” na stronie ogólnej (ustawiany przy rysowaniu). */
  private moreAt: [number, number] = [-99, -99];
  /** Górna krawędź siatki umiejętności na stronie ogólnej (klik otwiera stronę umiejętności). */
  private skillsAt = -99;

  constructor(private readonly app: App, private readonly mode: Mode) {
    // Kursor na ostatnio wybranym bohaterze.
    this.sel = Math.max(0, HEROES.findIndex((h) => h.id === app.save.lastHero));
  }

  private start(): void {
    if (!heroUnlocked(this.app.save, HEROES[this.sel].id)) { sfx.play('hurt'); return; }
    sfx.play('levelup');
    this.app.save.lastHero = HEROES[this.sel].id;
    this.app.persist();
    this.app.go(new GameScreen(this.app, HEROES[this.sel].id, this.mode));
  }

  update(): void {
    const inp = this.app.input;
    const n = HEROES.length;
    this.scroll.update(inp, ...DET_AREA);
    if (inp.pressed('up')) { this.sel = (this.sel - 1 + n) % n; sfx.play('select'); }
    if (inp.pressed('down')) { this.sel = (this.sel + 1) % n; sfx.play('select'); }
    if (inp.pressed('left') || inp.pressed('right')) { this.page = (this.page + (inp.pressed('left') ? TABS.length - 1 : 1)) % TABS.length; sfx.play('select'); }
    if (inp.pressed('confirm')) this.start();
    if (inp.pressed('back')) this.app.go(new SlotScreen(this.app, this.mode));
    if (inp.pressed('inventory') && unlocked(this.app.save, 'pacts')) { this.app.go(new PactScreen(this.app, this)); return; }
    if (inp.pressed('skip')) this.cycleSkin();
    if (inp.pressed('click')) {
      const { x, y } = inp.mouse;
      if (inside(x, y, LIST_X, this.pactY(), LIST_W, 18) && unlocked(this.app.save, 'pacts')) { this.app.go(new PactScreen(this.app, this)); return; }
      for (let i = 0; i < TABS.length; i++) if (inside(x, y, this.tabX(i), TAB_Y, TAB_W, 14)) { this.page = i; sfx.play('select'); return; }
      if (this.page === 0 && inside(x, y, this.moreAt[0], this.moreAt[1] - 1, MORE_W, 14)) { this.page = 2; sfx.play('select'); return; }
      if (this.page === 0 && inside(x, y, DET_X + 8, this.skillsAt, DET_W - 16, 40)) { this.page = 1; sfx.play('select'); return; }
      if (inside(x, y, W - 12 - START_W, BTN_Y, START_W, BTN_H)) { this.start(); return; }
      if (inside(x, y, LIST_X, BTN_Y, BACK_W, BTN_H)) { this.app.go(new SlotScreen(this.app, this.mode)); return; }
      HEROES.forEach((_, i) => {
        if (!inside(x, y, LIST_X, TOP + i * ROW_H, LIST_W, ROW_H - 4)) return;
        if (this.sel === i) this.start();
        else { this.sel = i; sfx.play('select'); }
      });
    }
  }

  /** Skórka zaznaczonego bohatera: zwykła, potem kolejne zdobyte odznaki Paktu (X). */
  private cycleSkin(): void {
    const h = HEROES[this.sel], skins = this.app.save.skins;
    const ids = ['', ...heroSkins(this.app.save.pacts.best[h.id] ?? 0).map((b) => b.id)];
    if (ids.length < 2) { sfx.play('hurt'); return; }
    skins[h.id] = ids[(ids.indexOf(skins[h.id] ?? '') + 1) % ids.length];
    this.app.persist();
    sfx.play('select');
  }

  /** Sprite bohatera ze skórką (jeśli wybrana i zdobyta). */
  private spriteOf(id: string): string {
    const h = HERO_BY_ID[id], skin = this.app.save.skins[id] ?? '';
    return skin && heroSkins(this.app.save.pacts.best[id] ?? 0).some((b) => b.id === skin) ? `${h.sprite}~${skin}` : h.sprite;
  }

  /** Lewa krawędź zakładki `i` szczegółów (rząd pod nazwą bohatera). */
  private tabX(i: number): number {
    return DET_X + 64 + i * (TAB_W + 2);
  }

  /** Przycisk paktów pod listą bohaterów. */
  private pactY(): number {
    return TOP + HEROES.length * ROW_H + 2;
  }

  render(): void {
    const r = this.app.r, g = r.g;
    r.clear(C.black);
    const m = this.mode;
    titleBar(r, PICK_TITLE[m], 10);
    // Lista bohaterów.
    HEROES.forEach((h, i) => {
      const y = TOP + i * ROW_H, on = i === this.sel;
      if (on) ember(r, LIST_X, y, LIST_W, ROW_H - 4, UI.radius + 1);
      panel(r, LIST_X, y, LIST_W, ROW_H - 4, on ? C.gold : hovered(LIST_X, y, LIST_W, ROW_H - 4) ? C.lavender : C.slate);
      const spr = this.spriteOf(h.id), open = heroUnlocked(this.app.save, h.id);
      // Zablokowany bohater: przygaszony, zamiast roli warunek odblokowania.
      r.withAlpha(open ? 1 : 0.3, () => drawSprite(g, `${spr}@${on && open ? animFrame(spr, Math.floor(performance.now() / 16), 0) : 0}`, LIST_X + 18, y + 11.5));
      drawText(g, h.name, LIST_X + 34, y + 2, open ? h.color : C.lavender, { shadow: C.black });
      if (open) drawText(g, h.role, LIST_X + 34, y + 12, C.lavender);
      else drawText(g, UNLOCK_BY_ID[`hero:${h.id}`]?.how ?? "", LIST_X + 34, y + 14, C.lavender, { scale: 0.75 });
      // Odznaka Paktu: najwyższy poziom Paktu z pokonanym bossem.
      const best = this.app.save.pacts.best[h.id] ?? 0, badge = pactBadge(best);
      if (badge) drawText(g, `${badge.name} ${best}`, LIST_X + LIST_W - 6, y + 3, badge.color, { align: 'right' });
    });
    const pl = pactLevel(this.app.save.pacts.chosen);
    if (unlocked(this.app.save, 'pacts')) button(r, LIST_X, this.pactY(), LIST_W, 18, pl ? `Pakty: poziom ${pl} [Tab]` : 'Pakty ryzyka [Tab]', { accent: C.salmon, col: pl ? C.salmon : undefined });
    else button(r, LIST_X, this.pactY(), LIST_W, 18, 'Risk Pacts (locked)', { col: C.dgray });
    // Szczegóły zaznaczonego (inny bohater albo zakładka: przewijanie od góry).
    const h = HEROES[this.sel], x = DET_X, y = TOP;
    if (this.sel * 10 + this.page !== this.scrollKey) { this.scrollKey = this.sel * 10 + this.page; this.scroll.reset(); }
    panel(r, x, y, DET_W, DET_H);
    r.withAlpha(0.5, () => r.circle(x + 32, y + 34, 22, C.black, true));
    drawShadow(g, x + 32, y + 56, 30);
    const spr = this.spriteOf(h.id);
    drawSprite(g, `${spr}@${animFrame(spr, Math.floor(performance.now() / 16), 0)}`, x + 32, y + 34, { scale: 2 });
    drawText(g, h.name, x + 64, y + 12, h.color, { scale: 2, shadow: C.black });
    // Skórki za odznaki Paktu.
    const owned = heroSkins(this.app.save.pacts.best[h.id] ?? 0), cur = this.app.save.skins[h.id] ?? '';
    if (owned.length) drawText(g, `Skórka: ${cur && BADGE_BY_ID[cur] ? BADGE_BY_ID[cur].name : 'zwykła'} [X]`, x + DET_W - 10, y + 8, cur ? BADGE_BY_ID[cur]?.color ?? C.lgray : C.lgray, { align: 'right' });
    drawText(g, `${h.role}   HP ${h.base.maxHp}   szybkość ${h.base.speed}`, x + 64, y + 31, C.lavender);
    TABS.forEach((t, i) => button(r, this.tabX(i), TAB_Y, TAB_W, 14, t, { active: i === this.page, accent: C.gold }));
    if (this.page === 0) this.renderGeneral(h, x, y);
    else {
      // Umiejętności i zasób: przewijany obszar do dołu panelu (dłuższe opisy przy dużym tekście).
      const [ax, ay, aw, ah] = DET_AREA, oy = this.scroll.begin(r, ax, ay, aw, ah);
      const end = this.page === 1
        ? drawSkills(r, h.abilities.map((a) => ({ def: a, cd: a.slot === 'ult' ? 'ładowane zabójstwami' : `odnowienie ${a.cooldown} s`, evo: false })), x + 12, ay + 4 - oy, DET_W - 26)
        : this.renderResource(h, x, ay + 2 - oy);
      this.scroll.end(r, end + oy - ay, ax, ay, aw, ah);
    }
    if (this.page !== 0) { this.renderButtons(h); return; }
    const rec = heroRecord(this.app.save, h.id);
    const best = m === 'expedition' ? `Najwięcej map: ${rec.bestExpedition}   ukończone: ${rec.expeditionWins}` : `Rekord: ${fmtTime(rec.bestEndless)}`;
    drawText(g, best, x + 12, y + DET_H - 14, C.lavender);
    {
      const hm = heroMeta(this.app.save.meta, h.id);
      drawText(g, `Rozwój: esencja ${fmt(hm.essence)}, Paragon ${paragonLevel(hm.total)}, prestiż ${hm.prestige}`, x + 12, y + DET_H - 25, C.cyan);
    }
    this.renderButtons(h);
  }

  /** Przyciski: Wstecz i Start (myszą lub klawiszami Esc / Enter). */
  private renderButtons(h: HeroDef): void {
    const r = this.app.r, g = r.g;
    button(r, LIST_X, BTN_Y, BACK_W, BTN_H, 'Wstecz [Esc]');
    if (heroUnlocked(this.app.save, h.id)) button(r, W - 12 - START_W, BTN_Y, START_W, BTN_H, `Start: ${h.name} [Enter]`, { accent: C.gold, col: C.yellow, pulse: true });
    else button(r, W - 12 - START_W, BTN_Y, START_W, BTN_H, 'Locked', { col: C.dgray });
    drawText(g, 'Góra/dół: bohater    Lewo/prawo: zakładki', (LIST_X + BACK_W + W - 12 - START_W) / 2, BTN_Y + 2, C.lavender, { align: 'center', scale: 0.75 });
  }

  /** Strona ogólna: broń, pasywka, zasób w skrócie, umiejętności. */
  private renderGeneral(h: HeroDef, x: number, y: number): void {
    const r = this.app.r, g = r.g;
    const wpn = WEAPON_BY_ID[h.weapon];
    drawSprite(g, wpn.icon, x + 19, y + 71);
    drawText(g, `Broń: ${wpn.name}`, x + 32, y + 66, C.white);
    drawText(g, `Pasywka: ${h.passive.name}`, x + 12, y + 84, C.yellow);
    let ly = y + 97;
    for (const line of wrapText(h.passive.desc, DET_W - 24)) { drawText(g, line, x + 12, ly, C.lgray); ly += 11; }
    // Zasób bohatera: tylko nazwa, opis z liczbami na drugiej zakładce.
    drawText(g, `Zasób: ${h.resource.name}`, x + 12, ly + 2, h.resource.color);
    const mx = x + 18 + textWidth(`Zasób: ${h.resource.name}`);
    button(r, mx, ly - 1, MORE_W, 14, 'Szczegóły >', { pulse: true, accent: h.resource.color, col: h.resource.color });
    this.moreAt = [mx, ly];
    ly += 11;
    ly += 6;
    // Umiejętności w dwóch kolumnach: ikona, klawisz, nazwa (klik: strona z opisami).
    this.skillsAt = ly;
    if (hovered(x + 8, ly, DET_W - 16, 40)) r.withAlpha(0.15, () => r.roundRect(x + 8, ly - 2, DET_W - 16, 42, 2, C.white));
    drawText(g, 'Opisy: zakładka Umiejętności', x + DET_W - 12, ly + 41, C.lavender, { align: 'right', scale: 0.75 });
    h.abilities.forEach((a, i) => {
      const key = a.slot === 'dash' ? 'Spc' : a.slot === 'ult' ? 'R' : a.slot.toUpperCase();
      const ax = x + 12 + (i % 2) * 140, ay = ly + Math.floor(i / 2) * 20;
      slot(r, ax, ay, 18, a.color);
      drawSprite(g, a.icon, ax + 9, ay + 9);
      drawText(g, key, ax + 22, ay - 1, C.lavender);
      drawText(g, a.name, ax + 22, ay + 8, a.color);
    });
  }

  /** Strona zasobu: pasywka i zasób z liczbami z balansu (tekst opisowy). Zwraca dolną krawędź. */
  private renderResource(h: HeroDef, x: number, y: number): number {
    const g = this.app.r.g, w = (DET_W - 32) / descS(), lh = descLH();
    let ly = y;
    drawText(g, `Pasywka: ${h.passive.name}`, x + 12, ly, C.yellow);
    ly += 12;
    for (const line of wrapText(h.passive.desc, w)) { drawText(g, line, x + 12, ly, C.lgray, DESC); ly += lh; }
    ly += 6;
    drawText(g, `Zasób: ${h.resource.name}`, x + 12, ly, h.resource.color);
    ly += 12;
    for (const line of wrapText(h.resource.desc, w)) { drawText(g, line, x + 12, ly, C.white, DESC); ly += lh; }
    ly += 3;
    for (const item of resourceDetails(h.resource.kind)) {
      wrapText(item, w).forEach((line, i) => {
        if (i === 0) drawText(g, '-', x + 12, ly, h.resource.color, DESC);
        drawText(g, line, x + 18, ly, C.lgray, DESC);
        ly += lh;
      });
      ly += 2;
    }
    return ly;
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
    titleBar(r, 'Rekordy', 8);
    panel(r, 30, 40, 420, 30 + HEROES.length * 16, C.slate);
    const cols = [42, 110, 176, 242, 300, 370];
    ['Bohater', 'Najdłużej', 'Zabójstwa', 'Maks. LV', 'Endless', 'Ekspedycja'].forEach((s, i) => drawText(g, s, cols[i], 48, C.lavender));
    drawText(g, 'Expedition: most maps (expeditions won)', W / 2, 54 + HEROES.length * 16 + 26, C.lavender, { align: 'center' });
    HEROES.forEach((h, i) => {
      const rec = heroRecord(this.app.save, h.id);
      const y = 64 + i * 16;
      drawText(g, h.name, cols[0], y, h.color);
      // Bohater bez żadnego runu: jeden napis zamiast rzędu zer.
      if (rec.bestTime <= 0 && rec.bestEndless <= 0 && rec.bestExpedition <= 0) { drawText(g, 'not played yet', cols[1], y, C.lavender); return; }
      [fmtTime(rec.bestTime), fmt(rec.bestKills), String(rec.bestLevel), fmtTime(rec.bestEndless), `${rec.bestExpedition} (${rec.expeditionWins})`]
        .forEach((s, j) => drawText(g, s, cols[j + 1], y, C.white));
    });
  }
}

const AIM_MODES: AimMode[] = ['auto', 'mixed', 'manual'];
const FX_MODES: PlayerFx[] = ['auto', 'visible', 'dim', 'hidden'];
const FX_LABEL: Record<PlayerFx, string> = { auto: 'automatyczne', visible: 'widoczne', dim: 'przygaszone', hidden: 'ukryte' };
const AIM_LABEL: Record<AimMode, string> = { auto: 'automatyczne', mixed: 'mieszane', manual: 'ręczne' };
const AIM_HINT: Record<AimMode, string> = {
  auto: 'Umiejętności zawsze celują w najbliższego wroga.',
  mixed: 'Celujesz myszą lub prawą gałką, bez nich umiejętności celują w najbliższego wroga.',
  manual: 'Celujesz tylko myszą lub prawą gałką, bez nich w kierunku ruchu.',
};

/** Przyciemnienie tła: kolejne poziomy (Ustawienia → Obraz i widoczność). */
const DIM_LEVELS = [0, 0.2, 0.35];
const DIM_LABEL = ['brak', 'lekkie', 'mocne'];
/** Przybliżenie świata. */
const ZOOM_LEVELS = [1, 1.25, 1.5];
const ZOOM_LABEL = ['daleko', 'normalne', 'blisko'];

/** Kategorie ustawień (zakładki u góry ekranu). */
const SET_TABS = ['Ogólne', 'Dźwięk', 'Obraz', 'Czytelność', 'Inne'];
const SET_TAB_W = 76, SET_TAB_Y = 32, SET_LIST_Y = 58, SET_ROW = 15;
const setTabX = (i: number) => W / 2 - (SET_TABS.length * (SET_TAB_W + 4) - 4) / 2 + i * (SET_TAB_W + 4);

/**
 * Ustawienia: kategorie jako zakładki u góry (Tab / Q / E albo klik), pod nimi lista opcji: nazwa po lewej,
 * wartość po prawej (strzałki lewo/prawo albo Enter zmieniają), na dole opis zaznaczonej opcji.
 */
export class SettingsScreen implements Screen {
  private menu!: Menu;
  /** Opis pod listą dla zaznaczonej pozycji. */
  private hints: (() => string)[] = [];

  constructor(private readonly app: App, private readonly back: Screen, private tab = 0) {
    this.build();
  }

  /** Lista opcji bieżącej kategorii. */
  private build(): void {
    const app = this.app, s = app.save.settings;
    const step = (k: 'volume' | 'music', d: number) => () => { s[k] = Math.round(Math.max(0, Math.min(1, s[k] + d)) * 10) / 10; app.persist(); };
    const toggle = (k: 'shake' | 'debug' | 'damageNumbers' | 'autoPause' | 'minimap' | 'healNumbers' | 'lowFx' | 'hints' | 'hitstop' | 'easy' | 'elemShapes' | 'scaleFill' | 'bulletOutline' | 'playerMarker') => () => {
      s[k] = !s[k];
      app.persist();
      if (k === 'scaleFill') app.r.setFill(s.scaleFill);
    };
    const cycle = <T,>(list: T[], get: () => T, set: (v: T) => void) => (d: number) => () => {
      const i = Math.max(0, list.indexOf(get()));
      set(list[(i + d + list.length) % list.length]);
      app.persist();
    };
    const aim = cycle(AIM_MODES, () => s.aim, (v) => { s.aim = v; });
    const fx = cycle(FX_MODES, () => s.playerFx, (v) => { s.playerFx = v; });
    const dim = cycle(DIM_LEVELS, () => s.bgDim, (v) => { s.bgDim = v; });
    const zoom = cycle(ZOOM_LEVELS, () => s.zoom, (v) => { s.zoom = v; app.r.setZoom(v); });
    const lang = cycle<Lang>(['en', 'pl'], () => s.lang, (v) => { s.lang = v; setLang(v); });
    const yes = (v: boolean) => (v ? 'tak' : 'nie');
    // Przełącznik: Enter i strzałki zmieniają wartość.
    const sw = (label: string, value: () => string, flip: () => void, hint: string): [MenuItem, () => string] =>
      [{ label: () => label, value, act: flip, left: flip, right: flip }, () => hint];
    const opt = (label: string, value: () => string, ch: (d: number) => () => void, hint: () => string): [MenuItem, () => string] =>
      [{ label: () => label, value, act: ch(1), left: ch(-1), right: ch(1) }, hint];
    const rows: [MenuItem, () => string][][] = [
      [
        opt('Język', () => (s.lang === 'en' ? 'English' : 'Polski'), lang, () => 'Language / Język: English, Polski.'),
        sw('Trudność', () => (s.easy ? 'łatwa' : 'normalna'), toggle('easy'), `Łatwa: wrogowie zadają ${Math.round(BAL.easy.dmg * 100)}% mniej obrażeń i mają ${Math.round(BAL.easy.hp * 100)}% mniej HP. Bez odznak Paktu.`),
        opt('Celowanie', () => AIM_LABEL[s.aim] ?? AIM_LABEL.mixed, aim, () => AIM_HINT[s.aim] ?? AIM_HINT.mixed),
        sw('Pauza po wyjściu z okna', () => yes(s.autoPause), toggle('autoPause'), 'Gra pauzuje się sama, gdy przełączysz okno lub kartę.'),
        sw('Podpowiedzi', () => yes(s.hints), toggle('hints'), 'Krótkie wskazówki przy pierwszym spotkaniu z mechaniką (awans, skrzynie, elity, reakcje...).'),
        [{ label: () => (app.save.seenHints.length ? 'Pokaż podpowiedzi od nowa' : 'Podpowiedzi: wszystkie przed tobą'), act: () => { app.save.seenHints = []; app.persist(); } }, () => 'Kolejna gra pokaże wszystkie podpowiedzi jeszcze raz.'],
        [{ label: () => 'Controls', act: () => app.go(new ControlsScreen(app, this)) }, () => 'Change the keys for movement, abilities, dodge and menus in the game.'],
        [{ label: () => 'Replay tutorial', act: () => app.go(new GameScreen(app, 'kestra', 'endless', undefined, true)) }, () => 'Play the short tutorial again (2-3 minutes): movement, abilities, dodging, loot and a boss.'],
      ],
      [
        opt('Sound effects', () => `${Math.round(s.volume * 100)}%`, (d) => step('volume', d * 0.1), () => 'Volume of weapons, hits and the interface (music has its own slider). Important sounds briefly lower the music.'),
        opt('Muzyka', () => `${Math.round(s.music * 100)}%`, (d) => step('music', d * 0.1), () => 'Muzyka tworzona na bieżąco: w każdym biomie inna skala, rośnie razem z walką (bębny w tłumie, melodia przy bossie).'),
      ],
      [
        sw('Obraz', () => (s.scaleFill ? 'cały ekran' : 'ostre piksele'), toggle('scaleFill'), 'Cały ekran: gra wypełnia okno (większy obraz). Ostre piksele: tylko całkowite powiększenie, z ramką.'),
        opt('Przybliżenie', () => ZOOM_LABEL[Math.max(0, ZOOM_LEVELS.indexOf(s.zoom))], zoom, () => 'Blisko: większe postacie i pociski, mniej widać wokół. Daleko: widok jak w starszych wersjach.'),
        sw('Pełny ekran', () => yes(!!document.fullscreenElement), () => toggleFullscreen(), 'Przełącza tryb pełnoekranowy przeglądarki. W grze: klawisz F.'),
        sw('Wstrząsy ekranu', () => yes(s.shake), toggle('shake'), 'Drganie ekranu przy wybuchach i trafieniach.'),
        sw('Zatrzymanie klatki przy trafieniach', () => yes(s.hitstop), toggle('hitstop'), 'Gra na ułamek sekundy staje przy zabiciu elity, bossa i mocnym trafieniu.'),
      ],
      [
        sw('Reduce flashing', () => yes(s.reduceFlash), () => { s.reduceFlash = !s.reduceFlash; app.persist(); }, 'For players sensitive to flashing lights: no blinking warnings (they stay lit instead) and no white hit flashes.'),
        sw('Text size', () => (s.textLarge ? 'Large' : 'Normal'), () => { s.textLarge = !s.textLarge; setTextSize(s.textLarge); app.persist(); }, 'Large: descriptions (abilities, cards, items, map, pause) at full size instead of smaller text. Longer texts scroll or split into pages.'),
        opt('Przyciemnienie tła', () => DIM_LABEL[Math.max(0, DIM_LEVELS.indexOf(s.bgDim))], dim, () => 'Ciemniejsze podłoże i dekoracje: postacie, wrogowie i pociski bardziej odcinają się od tła.'),
        sw('Wyraźne pociski wrogów', () => yes(s.bulletOutline), toggle('bulletOutline'), 'Pociski wrogów dostają ciemną obwódkę, lepiej odcinają się od tła i efektów.'),
        sw('Znacznik gracza', () => yes(s.playerMarker), toggle('playerMarker'), 'Pulsujący krąg pod twoją postacią, łatwo ją znaleźć w tłumie.'),
        opt('Ataki gracza', () => FX_LABEL[s.playerFx] ?? FX_LABEL.visible, fx, () => 'Twoje pociski, aury, strefy i błyski trafień: automatyczne (przygaszane, gdy blisko jest dużo pocisków wrogów), przygaszone (półprzezroczyste) albo ukryte. Działają dalej, a pociski wrogów widać lepiej.'),
        sw('Kształty żywiołów', () => yes(s.elemShapes), toggle('elemShapes'), 'Dla daltonistów: każdy żywioł ma też własny kształt (ogień trójkąt, lód romb, błyskawica zygzak, trucizna kropla).'),
        sw('Liczby obrażeń', () => yes(s.damageNumbers), toggle('damageNumbers'), 'Liczby nad trafionymi wrogami (obrażenia gracza zawsze widać).'),
        sw('Liczby leczenia', () => yes(s.healNumbers), toggle('healNumbers'), 'Zielone liczby nad postacią: ile HP odzyskałeś (co pół sekundy).'),
        sw('Minimapa', () => yes(s.minimap), toggle('minimap'), 'Mała mapa w prawym górnym rogu: wrogowie, elity, boss i skrzynie.'),
      ],
      [
        sw('Tryb debug', () => yes(s.debug), toggle('debug'), 'Klawisze testowe F4, F6, F7 i podgląd balansu. Statystyki wydajności w grze: F3.'),
        [{ label: () => (s.debug ? 'Podgląd balansu' : 'Podgląd balansu (włącz debug)'), act: () => { if (s.debug) app.go(new BalanceScreen(app, this)); } }, () => 'Wartości do sprawdzenia: HP przedmiotów i ulepszeń, skalowanie wrogów, miękkie limity.'],
      ],
    ];
    const list = [...rows[this.tab], [{ label: () => 'Wróć', act: () => app.go(this.back) }, () => ''] as [MenuItem, () => string]];
    this.menu = new Menu(list.map(([it]) => it), W / 2, SET_LIST_Y, 340, SET_ROW);
    this.hints = list.map(([, h]) => h);
  }

  private setTab(i: number): void {
    this.tab = (i + SET_TABS.length) % SET_TABS.length;
    this.build();
    sfx.play('select');
  }

  update(): void {
    const inp = this.app.input;
    if (inp.pressed('back')) { this.app.go(this.back); return; }
    if (inp.pressed('inventory') || inp.pressed('e')) { this.setTab(this.tab + 1); return; }
    if (inp.pressed('q')) { this.setTab(this.tab - 1); return; }
    if (inp.pressed('click')) {
      for (let i = 0; i < SET_TABS.length; i++) if (inside(inp.mouse.x, inp.mouse.y, setTabX(i), SET_TAB_Y, SET_TAB_W, 16)) { this.setTab(i); return; }
    }
    this.menu.update(inp);
  }

  render(): void {
    const r = this.app.r, g = r.g;
    r.clear(C.black);
    titleBar(r, 'Ustawienia', 6);
    SET_TABS.forEach((t, i) => button(r, setTabX(i), SET_TAB_Y, SET_TAB_W, 16, t, { active: i === this.tab, accent: C.gold }));
    panel(r, W / 2 - 180, SET_LIST_Y - 6, 360, this.menu.items.length * SET_ROW + 10, C.slate);
    this.menu.render(r);
    drawText(g, 'Tab / Q / E: kategoria    Lewo/prawo: zmień', W / 2, H - 14, C.lavender, { align: 'center' });
    // Opis pod oknem listy (długie zakładki mają wyższe okno, opis zjeżdża niżej).
    const descY = Math.max(222, SET_LIST_Y + 4 + this.menu.items.length * SET_ROW + 4);
    wrapText(this.hints[this.menu.sel](), 420).forEach((l, i) => drawText(g, l, W / 2, descY + i * 11, C.lavender, { align: 'center' }));
  }
}

/** Pełny ekran przeglądarki (wywoływane z akcji menu albo klawisza F, czyli tuż po geście gracza). */
export function toggleFullscreen(): void {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen().catch(() => undefined);
}
