import { W, H } from '../core/renderer';
import { C, PAL } from '../core/palette';
import { drawText, wrapText, textWidth } from '../core/font';
import { sfx } from '../core/audio';
import { heroRecord, type AimMode, type PlayerFx } from '../core/save';
import { drawSprite, drawShadow, getSprite, TILE } from '../gfx/sprites';
import { animFrame } from '../gfx/actors';
import { HEROES, HERO_BY_ID, resourceDetails, type HeroDef } from '../data/heroes';
import { WEAPON_BY_ID } from '../data/weapons';
import { levelDef, objectiveLabel } from '../data/levels';
import { BAL } from '../data/balance';
import { endSlotRun } from '../game/campaign';
import type { Mode, RunSnapshot, SlotMode } from '../game/run';
import { fmtTime, fmt } from '../util/format';
import type { App, Screen } from './app';
import { Menu, panel, inside, slot, type MenuItem } from './widgets';
import type { Action } from '../core/input';
import { music, MENU_MOOD } from '../core/music';
import { GameScreen, type GameOpts } from './game-screen';
import { CollectionScreen } from './collection';
import { MetaScreen } from './meta';
import { BalanceScreen } from './balance';
import { HelpScreen } from './help';
import { heroMeta, paragonLevel } from '../data/meta';
import { pactLevel, pactBadge, pactDesc, heroSkins, BADGE_BY_ID, PACT_BY_ID } from '../data/pacts';
import { dailyOf, todayKey } from '../data/daily';
import { PactScreen } from './pacts';

const PARADE = ['slime', 'bat', 'golem', 'eye', 'wisp', 'spinner'];

/** Tło menu: nocne niebo z gradientem, gwiazdy, księżyc, dwa pasma wzgórz, przewijany pas łąki i defilada potworów goniących bohaterów. */
function menuBackdrop(app: App, t: number): void {
  const r = app.r, g = r.g;
  const groundY = H - 58;
  const sky = g.createLinearGradient(0, 0, 0, groundY);
  sky.addColorStop(0, PAL[C.black]);
  sky.addColorStop(0.7, PAL[C.navy]);
  sky.addColorStop(1, PAL[C.slate]);
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 70; i++) {
    const x = ((i * 97 + t * (2 + (i % 3) * 2)) % (W + 20)) - 10;
    const y = (i * 53) % (groundY - 40);
    const tw = (Math.sin(t * 2 + i) + 1) / 2;
    r.withAlpha(0.4 + 0.6 * tw, () => r.rect(x, y, i % 7 === 0 ? 1 : 0.5, i % 7 === 0 ? 1 : 0.5, i % 5 === 0 ? C.white : C.lgray));
  }
  // Księżyc z poświatą.
  r.withAlpha(0.12, () => r.circle(404, 38, 22, C.cream, true));
  r.circle(404, 38, 12, C.cream, true);
  r.circle(400, 35, 3, C.tan, true);
  r.circle(408, 42, 2, C.tan, true);
  // Wzgórza: dalsze jaśniejsze, bliższe ciemniejsze, przesuwają się wolniej niż łąka (paralaksa).
  for (const [col, base, amp, speed, freq] of [[C.navy, groundY - 34, 12, 4, 0.021], [C.black, groundY - 14, 10, 10, 0.034]] as const) {
    g.fillStyle = PAL[col];
    g.beginPath();
    g.moveTo(0, groundY);
    for (let x = 0; x <= W; x += 4) g.lineTo(x, base - amp * (0.5 + 0.5 * Math.sin((x + t * speed) * freq)) - 6 * Math.sin((x + t * speed) * freq * 2.7));
    g.lineTo(W, groundY);
    g.fill();
  }
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
  walk('vesper', lead - 98, false, 4);
  walk('aurel', lead - 122, false, 5);
  PARADE.forEach((name, i) => walk(name, lead - 166 - i * 28, false, i + 6));
}

/**
 * Kod Konami (góra, góra, dół, dół, lewo, prawo, lewo, prawo, B, A): na klawiaturze B to banish, a A to lewo (stąd drugi wariant),
 * na padzie B to E, a A to confirm. Otwiera sekretny tryb Głowy bossów.
 */
const KONAMI = ['UUDDLRLRBA', 'UUDDLRLRBL'];
const KONAMI_KEYS: [Action, string][] = [['up', 'U'], ['down', 'D'], ['left', 'L'], ['right', 'R'], ['banish', 'B'], ['e', 'B'], ['confirm', 'A']];

export class MainMenu implements Screen {
  private t = 0;
  private menu: Menu;
  private konami = '';

  constructor(private readonly app: App) {
    this.menu = new Menu([
      { label: () => 'Kampania Hardcore', act: () => app.go(new SlotScreen(app, 'hardcore')) },
      { label: () => 'Ekspedycja (3 akty)', act: () => app.go(new SlotScreen(app, 'expedition')) },
      { label: () => 'Endless (bez końca)', act: () => app.go(new SlotScreen(app, 'endless')) },
      { label: () => 'Trening (jeden poziom)', act: () => app.go(new HeroSelect(app, 'training')) },
      { label: () => 'Szybki run (3 poziomy, ok. 10 min)', act: () => app.go(new HeroSelect(app, 'training', { quick: true })) },
      { label: () => 'Wyzwanie dnia', act: () => app.go(new DailyScreen(app)) },
      { label: () => (app.save.meta.unassigned > 0 ? `Rozwój (${fmt(app.save.meta.unassigned)} do rozdania)` : 'Rozwój bohaterów'), act: () => app.go(new MetaScreen(app, this)) },
      { label: () => 'Kolekcja i osiągnięcia', act: () => app.go(new CollectionScreen(app, this)) },
      { label: () => 'Rekordy', act: () => app.go(new RecordsScreen(app)) },
      { label: () => 'Pomoc', act: () => app.go(new HelpScreen(app, this)) },
      { label: () => 'Ustawienia', act: () => app.go(new SettingsScreen(app, this)) },
    ], MENU_X + MENU_W / 2, 64, MENU_W - 12, 11, { 6: 11, 9: 11 });
    music.setMood(MENU_MOOD);
    // Nowy gracz (bez żadnego runu i zapisu): kursor od razu na Treningu.
    if (isNewPlayer(app)) this.menu.sel = 3;
  }

  update(dt: number): void {
    this.t += dt;
    if (this.checkKonami()) return;
    const before = this.menu.sel;
    this.menu.update(this.app.input);
    // Komunikat (np. o przerwanym runie) znika po pierwszej interakcji.
    if (this.app.save.notice && (this.menu.sel !== before || this.app.input.pressed('confirm') || this.app.input.pressed('click'))) {
      this.app.save.notice = '';
      this.app.persist();
    }
  }

  /** Bufor ostatnich wciśnięć; po pełnym kodzie wybór bohatera do trybu Głowy bossów. */
  private checkKonami(): boolean {
    const inp = this.app.input;
    const hit = KONAMI_KEYS.find(([a]) => inp.pressed(a));
    if (!hit) return false;
    this.konami = (this.konami + hit[1]).slice(-KONAMI[0].length);
    if (!KONAMI.includes(this.konami)) return false;
    this.konami = '';
    sfx.play('boss');
    this.app.go(new HeroSelect(this.app, 'training', { rush: true }));
    return true;
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
    // Lewy panel: pozycje w grupach z nagłówkami.
    panel(r, MENU_X, 48, MENU_W, 166, C.gold);
    MENU_GROUPS.forEach(([name, first]) => {
      const y = m.top(first) - 9;
      drawText(g, name, MENU_X + 10, y, C.gold, { scale: 0.75 });
      r.withAlpha(0.4, () => r.rect(MENU_X + 10 + textWidth(name) * 0.75 + 4, y + 3.5, MENU_W - 30 - textWidth(name) * 0.75, 0.5, C.gold));
    });
    m.render(r);
    // Prawy panel: ikona, nazwa i opis zaznaczonej pozycji; nowemu graczowi Trening jest polecany.
    const dx = MENU_X + MENU_W + 10, dw = W - dx - 18;
    panel(r, dx, 48, dw, 112, C.lavender);
    slot(r, dx + 10, 58, 28, C.gold);
    drawSprite(g, MENU_ICON[m.sel], dx + 24, 72);
    drawText(g, m.items[m.sel].label(), dx + 46, 60, C.yellow, { shadow: C.black });
    const tip = isNewPlayer(this.app) && m.sel === 3;
    if (tip) drawText(g, 'Polecane na start!', dx + 46, 72, C.lime, { shadow: C.black });
    let ly = 94;
    for (const l of wrapText(MENU_DESC[m.sel] ?? '', dw - 22)) { drawText(g, l, dx + 11, ly, C.lgray); ly += 11; }
    ly += 4;
    for (const [l, col] of this.info(m.sel)) { drawText(g, l, dx + 11, ly, col, { scale: 0.75 }); ly += 9; }
    drawText(g, 'Strzałki / mysz: wybór   Enter: wejdź   F: pełny ekran', dx + dw / 2, 148, C.dgray, { align: 'center', scale: 0.75 });
    if (this.app.save.notice) {
      panel(r, dx, 166, dw, 44, C.orange);
      wrapText(this.app.save.notice, dw - 22).slice(0, 3).forEach((l, i) => drawText(g, l, dx + 11, 172 + i * 11, C.orange));
    }
  }

  /** Dodatkowe informacje w panelu opisu: zapisany run, rekordy, bohater dnia, postęp kolekcji. */
  private info(sel: number): [string, number][] {
    const s = this.app.save;
    const slotMode = (['hardcore', 'expedition', 'endless'] as const)[sel];
    if (slotMode) {
      const snap = s.slots[slotMode];
      return snap ? [[`Zapisany run: ${HERO_BY_ID[snap.hero]?.name ?? snap.hero}, LV ${snap.level}`, C.lime], ...slotLines(slotMode, snap).slice(0, 1).map((l): [string, number] => [l, C.lgray])] : [['Brak zapisanego runu.', C.dgray]];
    }
    if (sel === 3 || sel === 4) {
      const recs = Object.values(s.records);
      return [[`Wygrane treningi: ${recs.reduce((n, r) => n + r.wins, 0)} / ${recs.reduce((n, r) => n + r.runs, 0)}`, C.lgray]];
    }
    if (sel === 5) {
      const d = dailyOf(todayKey()), today = s.daily.date === d.date;
      return [[`Bohater dnia: ${HERO_BY_ID[d.hero].name}`, HERO_BY_ID[d.hero].color], [today && s.daily.best ? `Twój czas dziś: ${fmtTime(s.daily.best)}` : 'Dziś jeszcze bez wyniku.', C.lgray]];
    }
    if (sel === 6) return [[s.meta.unassigned > 0 ? `Esencja do rozdania: ${fmt(s.meta.unassigned)}` : 'Esencję zdobywasz w Ekspedycji.', C.cyan]];
    if (sel === 7) return [[`Karty ${s.collection.seen.length}, sekrety ${s.collection.secrets.length}, osiągnięcia ${s.achievements.length}`, C.lgray]];
    return [];
  }
}

/** Menu główne: lewy panel z pozycjami (grupy: od indeksu) i ikony pozycji w panelu opisu. */
const MENU_X = 18, MENU_W = 196;
const MENU_GROUPS: [string, number][] = [['GRAJ', 0], ['POSTĘP', 6], ['INNE', 9]];
const MENU_ICON = ['ui_skull', 'ex_boss', 'ic_orbit_evo', 'ab_k_volley', 'pi_clock', 'ex_shrine', 'syn_all', 'ex_chest', 'cd_gold', 'tag:Umiejętności', 'ex_anvil'];

/** Opisy pozycji menu głównego (kolejność jak w menu). */
const MENU_DESC = [
  'Poziomy po kolei z bossami i sklepem. Śmierć kasuje cały run.',
  'Wyprawa przez 3 akty map z modyfikatorami. Daje esencję na Rozwój.',
  'Jeden poziom bez końca, boss co 5 minut, coraz trudniej.',
  'Jeden poziom z bossem, bez zapisu. Dobry na naukę bohaterów.',
  'Trzy krótkie poziomy z bossami jeden po drugim, więcej XP i złota. Na jedną przerwę.',
  'Codziennie ten sam bohater i pakty dla wszystkich. Pokonaj bossa jak najszybciej.',
  'Drzewka bohaterów kupowane esencją z Ekspedycji.',
  'Karty i bany, unikaty, Księga sekretów, bestiariusz i osiągnięcia.',
  'Najlepsze wyniki bohaterów w każdym trybie.',
  'Sterowanie, zasady, żywioły, synergie, zasoby, moce, tryby.',
  'Dźwięk, celowanie, widoczność efektów, podpowiedzi.',
];

/** Wyzwanie dnia: dzisiejszy bohater i pakty, najlepszy czas, start (Enter / klik). */
export class DailyScreen implements Screen {
  private readonly def = dailyOf(todayKey());

  constructor(private readonly app: App) {}

  update(): void {
    const inp = this.app.input;
    if (inp.pressed('back')) { this.app.go(new MainMenu(this.app)); return; }
    if (inp.pressed('confirm') || inp.pressed('click')) {
      sfx.play('levelup');
      this.app.go(new GameScreen(this.app, this.def.hero, 'training', undefined, { daily: this.def }));
    }
  }

  render(): void {
    const r = this.app.r, g = r.g, d = this.def, h = HERO_BY_ID[d.hero];
    r.clear(C.black);
    drawText(g, 'Wyzwanie dnia', W / 2, 10, C.gold, { align: 'center', scale: 2, outline: C.black });
    drawText(g, d.date, W / 2, 34, C.lavender, { align: 'center' });
    panel(r, 60, 50, W - 120, 170, C.gold);
    drawSprite(g, `${h.sprite}@${animFrame(h.sprite, Math.floor(performance.now() / 16), 0)}`, 100, 86, { scale: 2 });
    drawText(g, h.name, 130, 66, h.color, { scale: 2, shadow: C.black });
    drawText(g, `${h.role}: bohater dnia`, 130, 90, C.lavender);
    drawText(g, 'Pakty dnia:', 80, 120, C.salmon);
    Object.entries(d.pacts).forEach(([id, lv], i) => {
      const p = PACT_BY_ID[id];
      drawText(g, `${p.name} ${lv}: ${pactDesc(p, lv)}`, 92, 133 + i * 12, C.peach);
    });
    const s = this.app.save.daily, today = s.date === d.date;
    drawText(g, 'Cel: pokonaj bossa jak najszybciej. Bez zapisu, bez Rozwoju.', 80, 166, C.lgray);
    drawText(g, today && s.best ? `Twój najlepszy czas dziś: ${fmtTime(s.best)}` : 'Dziś jeszcze bez wyniku.', 80, 182, today && s.best ? C.yellow : C.dgray);
    drawText(g, `Podejścia dziś: ${today ? s.tries : 0}`, 80, 196, C.dgray);
    drawText(g, 'Enter: start    Esc: wstecz', W / 2, H - 20, C.lavender, { align: 'center' });
  }
}

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

const LIST_X = 12, LIST_W = 140, ROW_H = 32, TOP = 38;
const DET_X = LIST_X + LIST_W + 8, DET_W = W - DET_X - 12, DET_H = 212, TAB_W = 44;
const TABS = ['Ogólne', 'Zasób'];
/** Mały tekst szczegółów. */
const SMALL = { scale: 0.75 } as const;

/** Wybór bohatera: lista po lewej (do 6 bohaterów), szczegóły zaznaczonego po prawej. */
export class HeroSelect implements Screen {
  private sel = 0;
  /** Strona szczegółów: 0 ogólne (broń, pasywka, umiejętności), 1 zasób z liczbami. */
  private page = 0;

  constructor(private readonly app: App, private readonly mode: Mode, private readonly opts: GameOpts = {}) {
    // Kursor na ostatnio wybranym bohaterze.
    this.sel = Math.max(0, HEROES.findIndex((h) => h.id === app.save.lastHero));
  }

  private start(): void {
    sfx.play('levelup');
    this.app.save.lastHero = HEROES[this.sel].id;
    this.app.persist();
    this.app.go(new GameScreen(this.app, HEROES[this.sel].id, this.mode, undefined, this.opts));
  }

  update(): void {
    const inp = this.app.input;
    const n = HEROES.length;
    if (inp.pressed('up')) { this.sel = (this.sel - 1 + n) % n; sfx.play('select'); }
    if (inp.pressed('down')) { this.sel = (this.sel + 1) % n; sfx.play('select'); }
    if (inp.pressed('left') || inp.pressed('right')) { this.page = 1 - this.page; sfx.play('select'); }
    if (inp.pressed('confirm')) this.start();
    if (inp.pressed('back')) this.app.go(this.mode === 'training' ? new MainMenu(this.app) : new SlotScreen(this.app, this.mode));
    if (inp.pressed('inventory')) { this.app.go(new PactScreen(this.app, this)); return; }
    if (inp.pressed('skip')) this.cycleSkin();
    if (inp.pressed('click')) {
      const { x, y } = inp.mouse;
      if (inside(x, y, LIST_X, this.pactY(), LIST_W, 18)) { this.app.go(new PactScreen(this.app, this)); return; }
      for (let i = 0; i < 2; i++) if (inside(x, y, this.tabX(i), TOP + 22, TAB_W, 12)) { this.page = i; sfx.play('select'); return; }
      if (inside(x, y, DET_X, TOP, DET_W, DET_H)) { this.start(); return; }
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

  /** Lewa krawędź zakładki `i` szczegółów (prawy górny róg panelu). */
  private tabX(i: number): number {
    return DET_X + DET_W - 8 - (2 - i) * (TAB_W + 2);
  }

  /** Przycisk paktów pod listą bohaterów. */
  private pactY(): number {
    return TOP + HEROES.length * ROW_H + 2;
  }

  render(): void {
    const r = this.app.r, g = r.g;
    r.clear(C.black);
    const m = this.mode;
    const o = this.opts;
    const title = `${o.rush ? 'Głowy bossów' : o.quick ? 'Szybki run' : m === 'training' ? 'Trening' : SLOT_TITLE[m].split(' ').pop()}: wybierz bohatera`;
    drawText(g, title, W / 2, 10, o.rush ? C.hotpink : o.quick ? C.cyan : m === 'training' ? C.yellow : SLOT_COLOR[m], { align: 'center', scale: 2, outline: C.black });
    // Lista bohaterów.
    HEROES.forEach((h, i) => {
      const y = TOP + i * ROW_H, on = i === this.sel;
      panel(r, LIST_X, y, LIST_W, ROW_H - 4, on ? C.gold : C.slate);
      const spr = this.spriteOf(h.id);
      drawSprite(g, `${spr}@${on ? animFrame(spr, Math.floor(performance.now() / 16), 0) : 0}`, LIST_X + 18, y + 14);
      drawText(g, h.name, LIST_X + 34, y + 3, h.color, { shadow: C.black });
      drawText(g, h.role, LIST_X + 34, y + 15, C.lavender);
      // Odznaka Paktu: najwyższy poziom Paktu z pokonanym bossem.
      const best = this.app.save.pacts.best[h.id] ?? 0, badge = pactBadge(best);
      if (badge) drawText(g, `${badge.name} ${best}`, LIST_X + LIST_W - 6, y + 3, badge.color, { align: 'right' });
    });
    const pl = pactLevel(this.app.save.pacts.chosen);
    panel(r, LIST_X, this.pactY(), LIST_W, 18, pl ? C.salmon : C.slate);
    drawText(g, pl ? `Pakty: poziom ${pl} [Tab]` : 'Pakty ryzyka [Tab]', LIST_X + LIST_W / 2, this.pactY() + 3, pl ? C.salmon : C.lgray, { align: 'center' });
    // Szczegóły zaznaczonego.
    const h = HEROES[this.sel], x = DET_X, y = TOP;
    panel(r, x, y, DET_W, DET_H, C.gold);
    r.withAlpha(0.5, () => r.circle(x + 32, y + 34, 22, C.black, true));
    drawShadow(g, x + 32, y + 56, 30);
    const spr = this.spriteOf(h.id);
    drawSprite(g, `${spr}@${animFrame(spr, Math.floor(performance.now() / 16), 0)}`, x + 32, y + 34, { scale: 2 });
    drawText(g, h.name, x + 64, y + 12, h.color, { scale: 2, shadow: C.black });
    // Skórki za odznaki Paktu.
    const owned = heroSkins(this.app.save.pacts.best[h.id] ?? 0), cur = this.app.save.skins[h.id] ?? '';
    if (owned.length) drawText(g, `Skórka: ${cur && BADGE_BY_ID[cur] ? BADGE_BY_ID[cur].name : 'zwykła'} [X]`, x + DET_W - 10, y + 8, cur ? BADGE_BY_ID[cur]?.color ?? C.lgray : C.lgray, { align: 'right' });
    drawText(g, `${h.role}   HP ${h.base.maxHp}   szybkość ${h.base.speed}`, x + 64, y + 38, C.lavender);
    TABS.forEach((t, i) => {
      const on = i === this.page;
      r.roundRect(this.tabX(i), y + 22, TAB_W, 12, 3, on ? C.brown : C.navy);
      drawText(g, t, this.tabX(i) + TAB_W / 2, y + 24, on ? C.yellow : C.lgray, { align: 'center' });
    });
    if (this.page === 0) this.renderGeneral(h, x, y);
    else this.renderResource(h, x, y);
    const rec = heroRecord(this.app.save, h.id);
    const best = m === 'hardcore' ? `Najdalej: poziom ${rec.bestDepth}`
      : m === 'expedition' ? `Najwięcej map: ${rec.bestExpedition}   ukończone: ${rec.expeditionWins}`
      : m === 'endless' ? `Rekord: ${fmtTime(rec.bestEndless)}` : `Rekord: ${fmtTime(rec.bestTime)}   wygrane: ${rec.wins}`;
    drawText(g, best, x + 12, y + DET_H - 14, C.dgray);
    if (m === 'expedition') {
      const hm = heroMeta(this.app.save.meta, h.id);
      drawText(g, `Rozwój: esencja ${fmt(hm.essence)}, Paragon ${paragonLevel(hm.total)}, prestiż ${hm.prestige}`, x + 12, y + DET_H - 25, C.cyan);
    }
    drawText(g, 'Góra/dół: bohater    Lewo/prawo: szczegóły    Enter: start    Esc: wstecz', W / 2, H - 16, C.lavender, { align: 'center' });
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
    drawText(g, 'szczegóły: strzałka w prawo', x + 16 + textWidth(`Zasób: ${h.resource.name}`), ly + 2, C.dgray);
    ly += 11;
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
  }

  /** Strona zasobu: pasywka i zasób z liczbami z balansu (małym tekstem). */
  private renderResource(h: HeroDef, x: number, y: number): void {
    const g = this.app.r.g, w = (DET_W - 30) / SMALL.scale;
    let ly = y + 64;
    drawText(g, `Pasywka: ${h.passive.name}`, x + 12, ly, C.yellow);
    ly += 12;
    for (const line of wrapText(h.passive.desc, w)) { drawText(g, line, x + 12, ly, C.lgray, SMALL); ly += 9; }
    ly += 6;
    drawText(g, `Zasób: ${h.resource.name}`, x + 12, ly, h.resource.color);
    ly += 12;
    for (const line of wrapText(h.resource.desc, w)) { drawText(g, line, x + 12, ly, C.white, SMALL); ly += 9; }
    ly += 3;
    for (const item of resourceDetails(h.resource.kind)) {
      wrapText(item, w).forEach((line, i) => {
        if (i === 0) drawText(g, '-', x + 12, ly, h.resource.color, SMALL);
        drawText(g, line, x + 18, ly, C.lgray, SMALL);
        ly += 9;
      });
      ly += 2;
    }
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
    renderBoard(this.app, 120, 30, 240, 8);
    panel(r, 20, 168, 440, 98, C.slate);
    const cols = [30, 84, 136, 192, 240, 290, 340, 408];
    ['Bohater', 'Najdłużej', 'Zabójstwa', 'Maks. LV', 'Hardcore', 'Endless', 'Ekspedycja', 'Trening'].forEach((s, i) => drawText(g, s, cols[i], 175, C.lavender));
    HEROES.forEach((h, i) => {
      const rec = heroRecord(this.app.save, h.id);
      const y = 189 + i * 12;
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

/** Przyciemnienie tła: kolejne poziomy (Ustawienia → Obraz i widoczność). */
const DIM_LEVELS = [0, 0.2, 0.35];
const DIM_LABEL = ['brak', 'lekkie', 'mocne'];
/** Przybliżenie świata. */
const ZOOM_LEVELS = [1, 1.25, 1.5];
const ZOOM_LABEL = ['daleko', 'normalne', 'blisko'];

/** Ustawienia: strona główna (dźwięk, trudność, sterowanie) i strona Obraz i widoczność. */
export class SettingsScreen implements Screen {
  private menu: Menu;
  /** Podpowiedź pod menu dla zaznaczonej pozycji. */
  private hints: (() => string)[];

  constructor(private readonly app: App, private readonly back: Screen, private readonly page: 'main' | 'video' = 'main') {
    const s = app.save.settings;
    const step = (k: 'volume' | 'music', d: number) => () => { s[k] = Math.round(Math.max(0, Math.min(1, s[k] + d)) * 10) / 10; app.persist(); };
    const toggle = (k: 'shake' | 'debug' | 'damageNumbers' | 'autoPause' | 'minimap' | 'healNumbers' | 'lowFx' | 'hints' | 'hitstop' | 'easy' | 'elemShapes' | 'scaleFill' | 'bulletOutline' | 'playerMarker') => () => {
      s[k] = !s[k];
      app.persist();
      if (k === 'scaleFill') app.r.setFill(s.scaleFill);
    };
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
    const dim = (d: number) => () => {
      const i = Math.max(0, DIM_LEVELS.indexOf(s.bgDim));
      s.bgDim = DIM_LEVELS[(i + d + DIM_LEVELS.length) % DIM_LEVELS.length];
      app.persist();
    };
    const zoom = (d: number) => () => {
      const i = Math.max(0, ZOOM_LEVELS.indexOf(s.zoom));
      s.zoom = ZOOM_LEVELS[(i + d + ZOOM_LEVELS.length) % ZOOM_LEVELS.length];
      app.r.setZoom(s.zoom);
      app.persist();
    };
    const yes = (v: boolean) => (v ? 'tak' : 'nie');
    // Pozycja menu i jej podpowiedź w jednym miejscu.
    const rows: [MenuItem, () => string][] = page === 'main' ? [
      [{ label: () => `Głośność ${Math.round(s.volume * 100)}%`, left: step('volume', -0.1), right: step('volume', 0.1) }, () => 'Strzałki w lewo/prawo zmieniają wartość.'],
      [{ label: () => `Muzyka ${Math.round(s.music * 100)}%`, left: step('music', -0.1), right: step('music', 0.1) }, () => 'Muzyka tworzona na bieżąco: w każdym biomie inna skala, rośnie razem z walką (bębny w tłumie, melodia przy bossie).'],
      [{ label: () => `Trudność: ${s.easy ? 'łatwa' : 'normalna'}`, act: toggle('easy'), left: toggle('easy'), right: toggle('easy') }, () => `Łatwa: wrogowie zadają ${Math.round(BAL.easy.dmg * 100)}% mniej obrażeń i mają ${Math.round(BAL.easy.hp * 100)}% mniej HP. Bez odznak Paktu.`],
      [{ label: () => `Celowanie: ${AIM_LABEL[s.aim] ?? AIM_LABEL.mixed}`, left: aim(-1), right: aim(1) }, () => AIM_HINT[s.aim] ?? AIM_HINT.mixed],
      [{ label: () => 'Obraz i widoczność...', act: () => app.go(new SettingsScreen(app, this, 'video')) }, () => 'Wielkość obrazu, pełny ekran, czytelność pocisków i postaci, efekty.'],
      [{ label: () => `Pauza po wyjściu z okna: ${yes(s.autoPause)}`, act: toggle('autoPause') }, () => 'Gra pauzuje się sama, gdy przełączysz okno lub kartę.'],
      [{ label: () => `Podpowiedzi: ${yes(s.hints)}`, act: toggle('hints') }, () => 'Krótkie wskazówki przy pierwszym spotkaniu z mechaniką (awans, skrzynie, elity, reakcje...).'],
      [{ label: () => (app.save.seenHints.length ? 'Pokaż podpowiedzi od nowa' : 'Podpowiedzi: wszystkie przed tobą'), act: () => { app.save.seenHints = []; app.persist(); } }, () => 'Kolejna gra pokaże wszystkie podpowiedzi jeszcze raz.'],
      [{ label: () => `Zatrzymanie klatki przy trafieniach: ${yes(s.hitstop)}`, act: toggle('hitstop') }, () => 'Gra na ułamek sekundy staje przy zabiciu elity, bossa i mocnym trafieniu.'],
      [{ label: () => `Licznik FPS / debug: ${yes(s.debug)}`, act: toggle('debug') }, () => 'Licznik klatek i encji; włącza klawisze F4, F6, F7.'],
      [{ label: () => (s.debug ? 'Podgląd balansu' : 'Podgląd balansu (włącz debug)'), act: () => { if (s.debug) app.go(new BalanceScreen(app, this)); } }, () => 'Wartości do sprawdzenia: HP przedmiotów i ulepszeń, skalowanie wrogów, miękkie limity.'],
      [{ label: () => 'Wróć', act: () => app.go(back) }, () => ''],
    ] : [
      [{ label: () => `Obraz: ${s.scaleFill ? 'cały ekran' : 'ostre piksele'}`, act: toggle('scaleFill'), left: toggle('scaleFill'), right: toggle('scaleFill') }, () => 'Cały ekran: gra wypełnia okno (większy obraz). Ostre piksele: tylko całkowite powiększenie, z ramką.'],
      [{ label: () => `Przybliżenie: ${ZOOM_LABEL[Math.max(0, ZOOM_LEVELS.indexOf(s.zoom))]}`, left: zoom(-1), right: zoom(1), act: zoom(1) }, () => 'Blisko: większe postacie i pociski, mniej widać wokół. Daleko: widok jak w starszych wersjach.'],
      [{ label: () => `Pełny ekran: ${yes(!!document.fullscreenElement)}`, act: () => toggleFullscreen() }, () => 'Przełącza tryb pełnoekranowy przeglądarki. W grze: klawisz F.'],
      [{ label: () => `Przyciemnienie tła: ${DIM_LABEL[Math.max(0, DIM_LEVELS.indexOf(s.bgDim))]}`, left: dim(-1), right: dim(1), act: dim(1) }, () => 'Ciemniejsze podłoże i dekoracje: postacie, wrogowie i pociski bardziej odcinają się od tła.'],
      [{ label: () => `Wyraźne pociski wrogów: ${yes(s.bulletOutline)}`, act: toggle('bulletOutline') }, () => 'Pociski wrogów dostają ciemną obwódkę, lepiej odcinają się od tła i efektów.'],
      [{ label: () => `Znacznik gracza: ${yes(s.playerMarker)}`, act: toggle('playerMarker') }, () => 'Pulsujący krąg pod twoją postacią, łatwo ją znaleźć w tłumie.'],
      [{ label: () => `Kształty żywiołów: ${yes(s.elemShapes)}`, act: toggle('elemShapes') }, () => 'Dla daltonistów: każdy żywioł ma też własny kształt (ogień trójkąt, lód romb, błyskawica zygzak, trucizna kropla).'],
      [{ label: () => `Efekty: ${s.lowFx ? 'oszczędne' : 'pełne'}`, act: toggle('lowFx') }, () => 'Oszczędne: mniej cząsteczek, bez cieni, poświat i winiety (więcej FPS, telefon).'],
      [{ label: () => `Ataki gracza: ${FX_LABEL[s.playerFx] ?? FX_LABEL.visible}`, left: fx(-1), right: fx(1) }, () => 'Twoje pociski, aury, strefy i błyski trafień: przygaszone (półprzezroczyste) albo ukryte. Działają dalej, a pociski wrogów widać lepiej.'],
      [{ label: () => `Wstrząsy ekranu: ${yes(s.shake)}`, act: toggle('shake') }, () => 'Drganie ekranu przy wybuchach i trafieniach.'],
      [{ label: () => `Liczby obrażeń: ${yes(s.damageNumbers)}`, act: toggle('damageNumbers') }, () => 'Liczby nad trafionymi wrogami (obrażenia gracza zawsze widać).'],
      [{ label: () => `Liczby leczenia: ${yes(s.healNumbers)}`, act: toggle('healNumbers') }, () => 'Zielone liczby nad postacią: ile HP odzyskałeś (co pół sekundy).'],
      [{ label: () => `Minimapa: ${yes(s.minimap)}`, act: toggle('minimap') }, () => 'Mała mapa w prawym górnym rogu: wrogowie, elity, boss i skrzynie.'],
      [{ label: () => 'Wróć', act: () => app.go(back) }, () => ''],
    ];
    this.menu = new Menu(rows.map(([it]) => it), W / 2, 38, 280, 14);
    this.hints = rows.map(([, h]) => h);
  }

  update(): void {
    if (this.app.input.pressed('back')) { this.app.go(this.back); return; }
    this.menu.update(this.app.input);
  }

  render(): void {
    const r = this.app.r;
    r.clear(C.black);
    drawText(r.g, this.page === 'main' ? 'Ustawienia' : 'Obraz i widoczność', W / 2, 8, C.yellow, { align: 'center', scale: 2, outline: C.black });
    panel(r, W / 2 - 160, 32, 320, this.menu.items.length * 14 + 12, C.slate);
    this.menu.render(r);
    wrapText(this.hints[this.menu.sel](), 400).forEach((l, i) => drawText(r.g, l, W / 2, 246 + i * 11, C.lavender, { align: 'center' }));
  }
}

/** Pełny ekran przeglądarki (wywoływane z akcji menu albo klawisza F, czyli tuż po geście gracza). */
export function toggleFullscreen(): void {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen().catch(() => undefined);
}
