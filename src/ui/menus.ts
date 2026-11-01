import { W, H, OX } from '../core/renderer';
import { C, PAL } from '../core/palette';
import { drawText, wrapText, textWidth, setTextSize, DESC, descS, descLH, smallS } from '../core/font';
import { tr } from '../core/i18n';
import { sfx } from '../core/audio';
import { heroRecord, HUD_SCALES, type AimMode, type PlayerFx } from '../core/save';
import { drawSprite, drawShadow, blit, TILE } from '../gfx/sprites';
import { animFrame } from '../gfx/actors';
import { HEROES, HERO_BY_ID, resourceDesc, resourceDetails, heroAbilities, type HeroDef, type AbilityDef } from '../data/heroes';
import { WEAPON_BY_ID } from '../data/weapons';
import { BAL } from '../data/balance';
import { endSlotRun } from '../game/campaign';
import type { Mode, RunSnapshot, SlotMode } from '../game/run';
import { fmtTime, fmt } from '../util/format';
import type { App, Screen } from './app';
import { Menu, panel, inside, slot, button, hovered, Scroll, type MenuItem, titleBar, Confirm, pill, statTile, tabs, tabRect, sectionTitle, screenTabs } from './widgets';
import { UI } from './theme';
import { drawSkills } from './skills';
import { setLang, type Lang } from '../core/i18n';
import { music, MENU_MOOD } from '../core/music';
import { setHudScale } from '../core/input';
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

const PARADE = ['slime', 'boar', 'bat', 'shieldbearer', 'golem', 'kamikaze', 'eye', 'wisp'];

/** Tło menu (eksport: scripts/store.cjs rysuje z niego kapsuły sklepu): nocne niebo z gradientem, gwiazdy, księżyc, dwa pasma wzgórz, przewijany pas łąki i defilada potworów goniących bohaterów. */
export function menuBackdrop(app: App, t: number): void {
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
  // Spadająca gwiazda co ~7 s: jasna głowa i blednący ogon, przez górną część nieba.
  const sp = (t % 7) / 0.9;
  if (sp < 1) {
    const sx = L + 60 + ((Math.floor(t / 7) * 137) % Math.max(1, R - L - 200)), sy = 6 + sp * 26;
    for (let k = 0; k < 8; k++) r.withAlpha((1 - k / 8) * (1 - sp) * 0.9, () => r.rect(sx + sp * 70 - k * 2.4, sy - k * 0.9, 1.2, 0.6, k ? C.lgray : C.white));
  }
  // Chmury: płaskie pasma przesuwające się przed księżycem (półprzezroczyste, kilka owali).
  for (let i = 0; i < 4; i++) {
    const w = 46 + (i % 2) * 24, cx = L + ((i * 151 + t * (3 + i)) % (R - L + w * 2)) - w, cy = 24 + i * 9;
    r.withAlpha(0.18 + (i % 2) * 0.06, () => {
      g.fillStyle = PAL[i % 2 ? C.slate : C.dgray];
      g.beginPath();
      g.ellipse(cx, cy, w / 2, 3.2, 0, 0, Math.PI * 2);
      g.ellipse(cx - w / 5, cy - 2.4, w / 4, 2.6, 0, 0, Math.PI * 2);
      g.ellipse(cx + w / 6, cy - 2, w / 5, 2.2, 0, 0, Math.PI * 2);
      g.fill();
    });
  }
  // Wzgórza: dalsze jaśniejsze, bliższe ciemniejsze, przesuwają się wolniej niż łąka (paralaksa).
  const hill = (x: number, base: number, amp: number, speed: number, freq: number) =>
    base - amp * (0.5 + 0.5 * Math.sin((x + t * speed) * freq)) - 6 * Math.sin((x + t * speed) * freq * 2.7);
  for (const [col, base, amp, speed, freq] of [[C.navy, groundY - 34, 12, 4, 0.021], [C.black, groundY - 14, 10, 10, 0.034]] as const) {
    // Zamek na dalszym paśmie (pod prawym panelem menu): wieże z blankami i migoczącymi oknami, płynie razem ze wzgórzem.
    if (col === C.black) castle(r, ((360 - t * 4) % (R - L + 120) + (R - L + 120)) % (R - L + 120) + L - 60, (x) => hill(x, base - 20, 12, 4, 0.021), t);
    g.fillStyle = PAL[col];
    g.beginPath();
    g.moveTo(L, groundY);
    for (let x = L; x <= R + 4; x += 4) g.lineTo(x, hill(x, base, amp, speed, freq));
    g.lineTo(R + 4, groundY);
    g.fill();
  }
  // Łąka przesuwa się w lewo; wariant kafelka z kolumny w przesuniętym świecie (`col`), nie na ekranie — inaczej co TILE
  // pikseli wszystkie kafelki wracały do poprzedniego wzoru i trawa przeskakiwała.
  const scrolled = Math.floor(t * 30), off = scrolled % TILE, col = Math.floor(scrolled / TILE);
  const x0 = L - ((L % TILE) + TILE) % TILE - off;
  for (let x = x0; x < R; x += TILE) for (let y = groundY; y < H; y += TILE) blit(g, `tile0_${(((x + off) / TILE + col + y) % 10 + 10) % 10}`, x, y);
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
  // Świetliki nad łąką: powolne ósemki, pulsujące światło z poświatą.
  for (let i = 0; i < 14; i++) {
    const fx = L + ((i * 89 + Math.sin(t * 0.4 + i) * 30 + t * 6) % (R - L)), fy = groundY + 6 + ((i * 37) % 44) + Math.sin(t * 0.9 + i * 2) * 5;
    const glow = 0.5 + 0.5 * Math.sin(t * 2.2 + i * 1.7);
    r.withAlpha(0.25 * glow, () => r.rect(fx - 1, fy - 1, 3, 3, C.lime));
    r.withAlpha(0.4 + 0.6 * glow, () => r.rect(fx, fy, 1, 1, C.yellow));
  }
}

/** Sylwetka zamku na wzgórzu tła: `hy(x)` = wysokość wzgórza w punkcie x (zamek stoi na nim), okna migoczą z czasem `t`. */
function castle(r: App['r'], cx: number, hy: (x: number) => number, t: number): void {
  const g = r.g, base = hy(cx) + 3;
  g.fillStyle = PAL[C.navy];
  const block = (x: number, w: number, h: number) => {
    g.fillRect(cx + x, base - h, w, h);
    for (let k = 0; k < w; k += 2) g.fillRect(cx + x + k, base - h - 1.5, 1, 1.5);
  };
  block(-16, 6, 22);
  block(10, 6, 18);
  block(-10, 20, 12);
  block(-3, 6, 30);
  g.beginPath();
  g.moveTo(cx - 4, base - 31.5); g.lineTo(cx, base - 38); g.lineTo(cx + 4, base - 31.5);
  g.fill();
  // Proporzec na najwyższej wieży.
  r.rect(cx, base - 44, 0.5, 6, C.slate);
  r.rect(cx + 0.5, base - 44 + Math.round(Math.sin(t * 3)) * 0.5, 4, 1.6, C.dred);
  // Okna: ciepłe światło, każde migocze w swoim rytmie.
  for (const [wx, wy, k] of [[-14, 14, 0], [12, 11, 1], [-1, 22, 2], [-1, 14, 3], [-7, 7, 4], [4, 7, 5]] as const) {
    const on = 0.55 + 0.45 * Math.sin(t * (1.3 + k * 0.4) + k * 2);
    r.withAlpha(on, () => r.rect(cx + wx, base - wy, 1.2, 1.8, k % 3 ? C.gold : C.orange));
  }
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
    // Logo: ciepła poświata, cień, obrys i pionowy gradient (żółty → złoty → pomarańczowy) przez przycinanie pasami.
    const lw = textWidth('Pixel Survivors') * 3;
    g.save();
    g.translate(W / 2, 21);
    g.scale(lw / 2 + 24, 22);
    const glow = g.createRadialGradient(0, 0, 0, 0, 0, 1);
    glow.addColorStop(0, PAL[C.orange]);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = glow;
    r.withAlpha(0.16 + 0.05 * Math.sin(this.t * 1.5), () => { g.beginPath(); g.arc(0, 0, 1, 0, Math.PI * 2); g.fill(); });
    g.restore();
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
    // Przebłysk co ~5 s: ukośny jasny pas przesuwa się przez litery (przycięty do ich wnętrza przez przemalowanie bieli).
    const sw = (this.t % 5) / 0.8;
    if (sw < 1) {
      const bx = W / 2 - lw / 2 - 10 + sw * (lw + 20);
      g.save();
      g.beginPath();
      g.moveTo(bx, 8); g.lineTo(bx + 8, 8); g.lineTo(bx + 2, 36); g.lineTo(bx - 6, 36);
      g.clip();
      r.withAlpha(0.75, () => drawText(g, 'Pixel Survivors', W / 2, 8, C.white, { align: 'center', scale: 3 }));
      g.restore();
    }
    drawText(g, 'Przetrwaj. Rozwijaj się. Bez końca.', W / 2, 39, C.lavender, { align: 'center', scale: smallS(), outline: C.black });
    drawText(g, `v${__APP_VERSION__}`, W - 4, H - 10, C.lavender, { align: 'right', scale: smallS(), outline: C.black });
    // Lewy panel (karta): pozycje w grupach z nagłówkami sekcji.
    panel(r, MENU_X, 48, MENU_W, MENU_H);
    MENU_GROUPS.forEach(([name, first]) => sectionTitle(r, name, MENU_X + 10, m.top(first) - 9, MENU_W - 20));
    m.render(r);
    // Prawa karta: ikona w gnieździe, nazwa, pigułka stanu, opis, kafelki liczb i (na dole) komunikat albo klawisze.
    const dx = MENU_X + MENU_W + 10, dw = W - dx - 18, s = this.app.save;
    panel(r, dx, 48, dw, MENU_H);
    slot(r, dx + 10, 58, 28);
    drawSprite(g, MENU_ICON[m.sel], dx + 24, 72);
    drawText(g, m.items[m.sel].label(), dx + 46, 59, C.white, { shadow: C.black, scale: Math.min(1, (dw - 56) / textWidth(m.items[m.sel].label())) });
    const st = this.status(m.sel);
    if (st) pill(r, dx + 46, 73, st[0], st[1]);
    let ly = 94;
    const locked = m.sel === 1 && !unlocked(s, 'endless');
    const desc = locked ? UNLOCK_BY_ID.endless.how : MENU_DESC[m.sel] ?? '';
    for (const l of wrapText(desc, dw - 22)) { drawText(g, l, dx + 11, ly, C.lgray); ly += 11; }
    // Komunikat (przerwany run, odblokowania) w pomarańczowej karcie przy dolnej krawędzi; bez niego podpowiedź klawiszy.
    const notice = s.notice ? wrapText(s.notice, dw - 34).slice(0, 3) : [];
    const bottom = notice.length ? 48 + MENU_H - 12 - notice.length * 11 - 8 : 48 + MENU_H - 16;
    const tiles = this.tiles(m.sel), th = 26;
    if (tiles.length && ly + 4 + th <= bottom - 2) {
      const tw = (dw - 22 - (tiles.length - 1) * 5) / tiles.length;
      tiles.forEach(([lab, val, col], i) => statTile(r, dx + 11 + i * (tw + 5), ly + 4, tw, th, lab, val, col));
    }
    if (notice.length) {
      panel(r, dx + 6, bottom, dw - 12, notice.length * 11 + 8, C.orange);
      notice.forEach((l, i) => drawText(g, l, dx + 12, bottom + 4 + i * 11, C.orange));
    } else drawText(g, 'Strzałki / mysz: wybór   Enter: wejdź   F: pełny ekran', dx + dw / 2, bottom + 2, C.lavender, { align: 'center', scale: smallS() });
  }

  /** Pigułka stanu pod nazwą pozycji: polecane, zablokowane, zapisany run, esencja do rozdania. */
  private status(sel: number): [string, number] | null {
    const s = this.app.save, slotMode = (['expedition', 'endless'] as const)[sel];
    if (slotMode === 'endless' && !unlocked(s, 'endless')) return ['Locked', C.lavender];
    if (slotMode && s.slots[slotMode]) return ['Saved run', C.lime];
    if (sel === 0 && isNewPlayer(this.app)) return ['Recommended for a first run', C.lime];
    if (sel === 2 && s.meta.unassigned > 0) return [`${fmt(s.meta.unassigned)} to assign`, C.cyan];
    return null;
  }

  /** Kafelki liczb w karcie opisu: zapisany run, esencja bohatera, postęp kolekcji. */
  private tiles(sel: number): [string, string, number][] {
    const s = this.app.save, slotMode = (['expedition', 'endless'] as const)[sel];
    if (slotMode === 'endless' && !unlocked(s, 'endless')) return [];
    if (slotMode) {
      const snap = s.slots[slotMode], recs = Object.values(s.records);
      // Bez zapisanego runu: rekordy trybu ze wszystkich bohaterów.
      if (!snap) return slotMode === 'endless'
        ? [['Best Endless', fmtTime(Math.max(0, ...recs.map((x) => x.bestEndless))), C.cyan], ['Most kills', fmt(Math.max(0, ...recs.map((x) => x.bestKills))), C.white]]
        : [['Most maps', String(Math.max(0, ...recs.map((x) => x.bestExpedition))), C.white], ['Expeditions won', String(recs.reduce((n, x) => n + x.expeditionWins, 0)), C.gold]];
      const where = slotMode === 'endless' ? ['Depth', String(snap.depth)] : ['Act', `${snap.expedition?.act ?? 1}/${BAL.expedition.acts}`];
      return [['Hero', HERO_BY_ID[snap.hero]?.name ?? snap.hero, HERO_BY_ID[snap.hero]?.color ?? C.white], ['LV', String(snap.level), C.white], [where[0], where[1], C.white]];
    }
    if (sel === 2) {
      const h = HERO_BY_ID[s.lastHero] ?? HEROES[0];
      return [['Hero', h.name, h.color], ['Essence', fmt(heroMeta(s.meta, h.id).essence), C.cyan]];
    }
    if (sel === 3) return [['Cards', String(s.collection.seen.length), C.gold], ['Secrets', String(s.collection.secrets.length), C.hotpink], ['Achievements', String(s.achievements.length), C.lime]];
    return [];
  }
}

/** Menu główne: lewy panel z pozycjami (grupy: od indeksu) i ikony pozycji w panelu opisu. */
const MENU_X = 18, MENU_W = 196, MENU_H = 166;
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
  /** Porzucenie: drugie naciśnięcie po chwili (nie podwójne dotknięcie), uzbrojenie wygasa. */
  private confirmAbandon = new Confirm();

  constructor(private readonly app: App, private readonly mode: SlotMode) {
    const run = app.save.slots[mode];
    this.menu = new Menu(run ? [
      { label: () => 'Kontynuuj', act: () => { this.confirmAbandon.reset(); app.go(new GameScreen(app, run.hero, mode, run)); } },
      {
        label: () => (this.confirmAbandon.armed ? 'Na pewno? Run przepadnie' : 'Porzuć run'),
        act: () => {
          if (!this.confirmAbandon.press()) return;
          endSlotRun(app.save, mode, run);
          app.persist();
          app.go(new SlotScreen(app, mode));
        },
      },
      { label: () => 'Wstecz', act: () => { this.confirmAbandon.reset(); app.go(new MainMenu(app)); } },
    ] : [
      { label: () => SLOT_NEW[mode], act: () => app.go(new HeroSelect(app, mode)) },
      { label: () => 'Wstecz', act: () => app.go(new MainMenu(app)) },
    ], 124, run ? 196 : this.panelH() + 50, 220);
  }

  /** Wysokość panelu po lewej: zapisany run albo opis zasad (wtedy menu tuż pod nim, bez pustego pola). */
  private panelH(): number {
    return this.app.save.slots[this.mode] ? 146 : 32 + wrapText(SLOT_RULES[this.mode], 200).length * 13;
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
      // Zapisany run: bohater z pigułką stanu, kafelki liczb w dwóch rzędach, pod nimi miejsce w runie.
      const h = HERO_BY_ID[s.hero];
      r.withAlpha(0.5, () => r.circle(36, 64, 16, C.black, true));
      drawSprite(g, h.sprite, 36, 64, { scale: 2 });
      drawText(g, h.name, 60, 48, h.color, { scale: 2, shadow: C.black });
      drawText(g, h.role, 60, 70, C.lavender);
      pill(r, 228, 48, 'Saved run', C.lime, 'right');
      const tw = (224 - 22 - 10) / 3;
      const where: [string, string] = this.mode === 'endless' ? ['Depth', String(s.depth)] : ['Act', `${s.expedition?.act ?? 1}/${BAL.expedition.acts}`];
      ([['LV', String(s.level)], ['Time', fmtTime(s.totalTime)], ['Kills', fmt(s.kills)], ['Gold', fmt(s.gold)], ['Cards', String(s.cards.reduce((n, c) => n + c[1], 0))], where] as [string, string][])
        .forEach(([lab, val], i) => statTile(r, 23 + (i % 3) * (tw + 5), 86 + Math.floor(i / 3) * 30, tw, 26, lab, val, lab === 'Gold' ? C.gold : C.white));
      slotLines(this.mode, s).forEach((l, i) => drawText(g, l, 24, 148 + i * 12, i === 0 ? C.yellow : C.lgray));
    } else {
      sectionTitle(r, 'Rules', 24, 48, 200);
      wrapText(SLOT_RULES[this.mode], 200).forEach((l, i) => drawText(g, l, 24, 60 + i * 13, C.lgray));
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
  const RH = 15;
  panel(r, x, y, w, 36 + HEROES.length * RH);
  sectionTitle(r, 'Rekordy bohaterów', x + 10, y + 7, w - 20);
  // Nagłówki kolumn (przygaszone), liczby wyrównane do prawej.
  const cols: [string, number][] = mode === 'endless' ? [['Best time', x + w - 12]] : [['Most maps', x + w - 70], ['Won', x + w - 12]];
  cols.forEach(([t, cx]) => drawText(g, t, cx, y + 19, C.lavender, { align: 'right', scale: smallS() }));
  HEROES.forEach((h, i) => {
    const rec = heroRecord(app.save, h.id);
    const yy = y + 30 + i * RH;
    if (i % 2 === 0) r.withAlpha(0.25, () => r.roundRect(x + 6, yy - 2, w - 12, RH - 1, 3, C.black));
    drawText(g, h.name, x + 12, yy, h.color);
    const none = mode === 'endless' ? rec.bestEndless <= 0 : rec.bestExpedition <= 0 && rec.expeditionWins <= 0;
    if (none) { pill(r, x + w - 12, yy + 1, 'not played yet', C.lavender, 'right'); return; }
    if (mode === 'endless') drawText(g, fmtTime(rec.bestEndless), x + w - 12, yy, C.white, { align: 'right' });
    else {
      drawText(g, String(rec.bestExpedition), x + w - 70, yy, C.white, { align: 'right' });
      drawText(g, String(rec.expeditionWins), x + w - 12, yy, rec.expeditionWins ? C.gold : C.white, { align: 'right' });
    }
  });
}

const LIST_X = 12, LIST_W = 140, ROW_H = 27, TOP = 36;
const DET_X = LIST_X + LIST_W + 8, DET_W = W - DET_X - 12, DET_H = 212;
const TABS = ['Ogólne', 'Umiejętności', 'Zasób'];
/** Zakładki segmentowe szczegółów (pod nagłówkiem z kafelkami): x, y, szerokość, wysokość. */
const TAB_Y = TOP + 54, TAB_X = DET_X + 8, TAB_TW = DET_W - 16, TAB_H = 14;
/** Przyciski na dole ekranu wyboru bohatera: Wstecz (lewo) i Start (prawo). */
const BTN_Y = H - 18, BTN_H = 15, BACK_W = 70, START_W = 110;
/** Przycisk zmiany ultimate (R4) między Wstecz a Start. */
const ULT_W = 200, ULT_X = (LIST_X + BACK_W + W - 12 - START_W) / 2 - ULT_W / 2;
/** Przewijany obszar szczegółów na stronach Umiejętności i Zasób (x, y, w, h). */
const DET_AREA = [DET_X + 4, TOP + 72, DET_W - 8, DET_H - 75] as const;

/** Wybór bohatera: lista po lewej (do 6 bohaterów), szczegóły zaznaczonego po prawej. */
export class HeroSelect implements Screen {
  private sel = 0;
  private scroll = new Scroll();
  private scrollKey = -1;
  /** Strona szczegółów: 0 ogólne (broń, pasywka, umiejętności), 1 umiejętności z opisami, 2 zasób z liczbami. */
  private page = 0;
  /** Prostokąt kafelka zasobu w nagłówku (klik: zakładka Zasób; ustawiany przy rysowaniu). */
  private moreAt: [number, number, number, number] = [-99, -99, 0, 0];
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
    if (inp.pressed('reroll')) this.toggleUlt();
    if (inp.pressed('click')) {
      const { x, y } = inp.mouse;
      if (inside(x, y, LIST_X, this.pactY(), LIST_W, 18) && unlocked(this.app.save, 'pacts')) { this.app.go(new PactScreen(this.app, this)); return; }
      for (let i = 0; i < TABS.length; i++) if (inside(x, y, ...tabRect(TAB_X, TAB_Y, TAB_TW, TAB_H, TABS.length, i))) { this.page = i; sfx.play('select'); return; }
      if (inside(x, y, ...this.moreAt)) { this.page = 2; sfx.play('select'); return; }
      if (this.page === 0 && inside(x, y, DET_X + 8, this.skillsAt, DET_W - 16, 40)) { this.page = 1; sfx.play('select'); return; }
      if (inside(x, y, W - 12 - START_W, BTN_Y, START_W, BTN_H)) { this.start(); return; }
      if (inside(x, y, LIST_X, BTN_Y, BACK_W, BTN_H)) { this.app.go(new SlotScreen(this.app, this.mode)); return; }
      if (HEROES[this.sel].altUlt && inside(x, y, ULT_X, BTN_Y, ULT_W, BTN_H)) { this.toggleUlt(); return; }
      if (this.skinAt && inside(x, y, ...this.skinAt)) { this.cycleSkin(); return; }
      HEROES.forEach((_, i) => {
        if (!inside(x, y, LIST_X, TOP + i * ROW_H, LIST_W, ROW_H - 4)) return;
        if (this.sel === i) this.start();
        else { this.sel = i; sfx.play('select'); }
      });
    }
  }

  /** Skórka zaznaczonego bohatera: zwykła, potem kolejne zdobyte odznaki Paktu (X). */
  /** Umiejętności z wybranym ultimate (R4). */
  private kit(h: HeroDef): AbilityDef[] {
    return heroAbilities(h, !!this.app.save.altUlt?.[h.id]);
  }

  /** Prostokąt przycisku skórki (null, gdy bohater nie ma skórek). */
  private skinAt: [number, number, number, number] | null = null;

  /** R4: przełącza ultimate zaznaczonego bohatera (zapamiętane per bohater). */
  private toggleUlt(): void {
    const h = HEROES[this.sel];
    if (!h.altUlt) return;
    const s = this.app.save;
    s.altUlt = { ...s.altUlt, [h.id]: !s.altUlt?.[h.id] };
    this.app.persist();
    sfx.play('select');
  }

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

  /** Przycisk paktów pod listą bohaterów. */
  private pactY(): number {
    return TOP + HEROES.length * ROW_H + 2;
  }

  render(): void {
    const r = this.app.r, g = r.g;
    r.clear(C.black);
    const m = this.mode;
    titleBar(r, PICK_TITLE[m], 10);
    // Lista bohaterów (menu boczne): zaznaczony wiersz jaśniejszy ze złotym paskiem po lewej, pod myszą jasna ramka.
    HEROES.forEach((h, i) => {
      const y = TOP + i * ROW_H, on = i === this.sel, rh = ROW_H - 4;
      panel(r, LIST_X, y, LIST_W, rh, !on && hovered(LIST_X, y, LIST_W, rh) ? C.lavender : UI.border, on ? C.slate : C.navy);
      if (on) r.roundRect(LIST_X + 2, y + 4, 2, rh - 8, 1, C.gold);
      const spr = this.spriteOf(h.id), open = heroUnlocked(this.app.save, h.id);
      // Zablokowany bohater: przygaszony, pigułka „Locked”, zamiast roli warunek odblokowania.
      r.withAlpha(open ? 1 : 0.3, () => drawSprite(g, `${spr}@${on && open ? animFrame(spr, Math.floor(performance.now() / 16), 0) : 0}`, LIST_X + 18, y + 11.5));
      drawText(g, h.name, LIST_X + 34, y + 2, open ? h.color : C.lavender, { shadow: C.black });
      if (open) drawText(g, h.role, LIST_X + 34, y + 12, C.lavender);
      else {
        drawText(g, UNLOCK_BY_ID[`hero:${h.id}`]?.how ?? "", LIST_X + 34, y + 14, C.lavender, { scale: smallS() });
        pill(r, LIST_X + LIST_W - 5, y + 3, 'Locked', C.lavender, 'right');
      }
      // Odznaka Paktu: najwyższy poziom Paktu z pokonanym bossem.
      const best = this.app.save.pacts.best[h.id] ?? 0, badge = pactBadge(best);
      if (badge && open) pill(r, LIST_X + LIST_W - 5, y + 3, `${badge.name} ${best}`, badge.color, 'right');
    });
    const pl = pactLevel(this.app.save.pacts.chosen);
    if (unlocked(this.app.save, 'pacts')) button(r, LIST_X, this.pactY(), LIST_W, 18, pl ? `Pakty: poziom ${pl} [Tab]` : 'Pakty ryzyka [Tab]', { accent: C.salmon, col: pl ? C.salmon : undefined });
    else button(r, LIST_X, this.pactY(), LIST_W, 18, 'Risk Pacts (locked)', { col: C.dgray });
    // Szczegóły zaznaczonego (inny bohater albo zakładka: przewijanie od góry).
    const h = HEROES[this.sel], x = DET_X, y = TOP;
    if (this.sel * 10 + this.page !== this.scrollKey) { this.scrollKey = this.sel * 10 + this.page; this.scroll.reset(); }
    panel(r, x, y, DET_W, DET_H);
    // Nagłówek karty bohatera: portret, imię i rola, po prawej kafelki liczb; pod spodem zakładki segmentowe.
    r.withAlpha(0.5, () => r.circle(x + 30, y + 27, 20, C.black, true));
    drawShadow(g, x + 30, y + 47, 26);
    const spr = this.spriteOf(h.id), open = heroUnlocked(this.app.save, h.id);
    r.withAlpha(open ? 1 : 0.4, () => drawSprite(g, `${spr}@${animFrame(spr, Math.floor(performance.now() / 16), 0)}`, x + 30, y + 27, { scale: 2 }));
    drawText(g, h.name, x + 58, y + 5, h.color, { scale: 2, shadow: C.black });
    const tilesX = x + DET_W - 8 - 3 * 50 - 2 * 4;
    drawText(g, h.role, x + 58, y + 28, C.lavender, { scale: Math.min(1, (tilesX - x - 62) / Math.max(1, textWidth(h.role))) });
    if (!open) pill(r, x + 58, y + 40, 'Locked', C.lavender);
    ([['HP', String(h.base.maxHp), C.lime], ['Speed', String(h.base.speed), C.white], ['Resource', h.resource.name, h.resource.color]] as [string, string, number][])
      .forEach(([lab, val, col], i) => statTile(r, tilesX + i * 54, y + 22, 50, 26, lab, val, col));
    // Kafelek zasobu jest przyciskiem: otwiera zakładkę Zasób (pod myszą ramka w kolorze zasobu, strzałka w rogu).
    this.moreAt = [tilesX + 108, y + 22, 50, 26];
    if (hovered(...this.moreAt)) r.roundFrame(tilesX + 108, y + 22, 50, 26, UI.radius + 2, h.resource.color, 1);
    drawText(g, '>', tilesX + 108 + 50 - 5, y + 25, h.resource.color, { align: 'right', scale: smallS() });
    // Skórki za odznaki Paktu.
    const owned = heroSkins(this.app.save.pacts.best[h.id] ?? 0), cur = this.app.save.skins[h.id] ?? '';
    // Skórka: napis jest też przyciskiem (dotyk).
    this.skinAt = null;
    if (owned.length) {
      const label = `Skórka: ${cur && BADGE_BY_ID[cur] ? BADGE_BY_ID[cur].name : 'zwykła'} [X]`, sw = textWidth(label) + 8;
      this.skinAt = [x + DET_W - 6 - sw, y + 5, sw, 13];
      button(r, ...this.skinAt, label, { col: cur ? BADGE_BY_ID[cur]?.color ?? C.lgray : C.lgray });
    }
    tabs(r, TAB_X, TAB_Y, TAB_TW, TAB_H, TABS, this.page);
    if (this.page === 0) this.renderGeneral(h, x, y);
    else {
      // Umiejętności i zasób: przewijany obszar do dołu panelu (dłuższe opisy przy dużym tekście).
      const [ax, ay, aw, ah] = DET_AREA, oy = this.scroll.begin(r, ax, ay, aw, ah);
      const end = this.page === 1
        ? drawSkills(r, this.kit(h).map((a) => ({ def: a, cd: a.slot === 'ult' ? 'ładowane zabójstwami' : `odnowienie ${a.cooldown} s`, evo: false })), x + 12, ay + 4 - oy, DET_W - 26)
        : this.renderResource(h, x, ay + 2 - oy);
      this.scroll.end(r, end + oy - ay, ax, ay, aw, ah);
    }
    if (this.page !== 0) { this.renderButtons(h); return; }
    const rec = heroRecord(this.app.save, h.id);
    // Stopka karty: rozwój bohatera po lewej, rekord trybu po prawej (drobny tekst nad linią podziału).
    const best = m === 'expedition' ? `Najwięcej map: ${rec.bestExpedition}   ukończone: ${rec.expeditionWins}` : `Rekord: ${fmtTime(rec.bestEndless)}`;
    const hm = heroMeta(this.app.save.meta, h.id), sc = smallS();
    const prog = `Rozwój: esencja ${fmt(hm.essence)}, Paragon ${paragonLevel(hm.total)}, prestiż ${hm.prestige}`;
    r.withAlpha(0.6, () => r.rect(x + 8, y + DET_H - 16, DET_W - 16, 0.5, C.slate));
    const room = DET_W - 24, fit = Math.min(sc, (room - 10) / Math.max(1, textWidth(prog) + textWidth(best)));
    drawText(g, prog, x + 12, y + DET_H - 12, C.cyan, { scale: fit });
    drawText(g, best, x + DET_W - 12, y + DET_H - 12, C.lavender, { align: 'right', scale: fit });
    this.renderButtons(h);
  }

  /** Przyciski: Wstecz i Start (myszą lub klawiszami Esc / Enter). */
  private renderButtons(h: HeroDef): void {
    const r = this.app.r, g = r.g;
    button(r, LIST_X, BTN_Y, BACK_W, BTN_H, 'Wstecz [Esc]');
    if (heroUnlocked(this.app.save, h.id)) button(r, W - 12 - START_W, BTN_Y, START_W, BTN_H, `Start: ${h.name} [Enter]`, { active: true });
    else button(r, W - 12 - START_W, BTN_Y, START_W, BTN_H, 'Locked', { col: C.dgray });
    // R4: przełącznik ultimate jako przycisk (dotyk: wcześniej tylko klawisz R), na każdej zakładce.
    if (h.altUlt) {
      const ult = this.kit(h).find((a) => a.slot === 'ult');
      button(r, ULT_X, BTN_Y, ULT_W, BTN_H, `${tr('Ultimate')}: ${tr(ult?.name ?? '')} [R]`, { accent: C.yellow, col: C.yellow, scale: smallS() });
    } else drawText(g, 'Góra/dół: bohater    Lewo/prawo: zakładki', (LIST_X + BACK_W + W - 12 - START_W) / 2, BTN_Y + 2, C.lavender, { align: 'center', scale: smallS() });
  }

  /** Strona ogólna: broń, pasywka, zasób w skrócie, umiejętności. */
  private renderGeneral(h: HeroDef, x: number, y: number): void {
    const r = this.app.r, g = r.g;
    const wpn = WEAPON_BY_ID[h.weapon];
    // Broń startowa w gnieździe (zasób: kafelek w nagłówku, klik otwiera jego stronę).
    slot(r, x + 10, y + 76, 18);
    drawSprite(g, wpn.icon, x + 19, y + 85);
    drawText(g, `Broń: ${wpn.name}`, x + 32, y + 79, C.white);
    sectionTitle(r, 'Passive', x + 12, y + 99, DET_W - 24);
    drawText(g, h.passive.name, x + 12, y + 108, C.yellow);
    let ly = y + 120;
    for (const line of wrapText(h.passive.desc, DET_W - 24)) { drawText(g, line, x + 12, ly, C.lgray); ly += 11; }
    ly += 4;
    // Umiejętności w dwóch kolumnach: ikona, klawisz, nazwa (klik: strona z opisami).
    this.skillsAt = ly;
    if (hovered(x + 8, ly, DET_W - 16, 40)) r.withAlpha(0.15, () => r.roundRect(x + 8, ly - 2, DET_W - 16, 42, 2, C.white));
    this.kit(h).forEach((a, i) => {
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
    const alt = !!this.app.save.altUlt?.[h.id];
    for (const line of wrapText(resourceDesc(h, alt), w)) { drawText(g, line, x + 12, ly, C.white, DESC); ly += lh; }
    ly += 3;
    for (const item of resourceDetails(h.resource.kind, alt)) {
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
    const recs = HEROES.map((h) => heroRecord(this.app.save, h.id));
    // Kafelki: najlepsze wyniki ze wszystkich bohaterów.
    const best = (f: (x: (typeof recs)[number]) => number) => Math.max(0, ...recs.map(f));
    const tiles: [string, string, number][] = [
      ['Longest run', fmtTime(best((x) => x.bestTime)), C.white],
      ['Most kills', fmt(best((x) => x.bestKills)), C.white],
      ['Best Endless', fmtTime(best((x) => x.bestEndless)), C.cyan],
      ['Expeditions won', String(recs.reduce((n, x) => n + x.expeditionWins, 0)), C.gold],
    ];
    const TX = 30, TW = 420, tw = (TW - 3 * 6) / 4;
    tiles.forEach(([lab, val, col], i) => statTile(r, TX + i * (tw + 6), 38, tw, 28, lab, val, col));
    // Tabela: nagłówki przygaszone, liczby wyrównane do prawej krawędzi kolumny, co drugi wiersz ciemniejszy.
    const RH = 16, ty = 74;
    panel(r, TX, ty, TW, 26 + HEROES.length * RH);
    const head = ['Bohater', 'Najdłużej', 'Zabójstwa', 'Maks. LV', 'Endless', 'Ekspedycja'];
    const right = [0, 170, 230, 285, 345, 408].map((c) => TX + c);
    head.forEach((s, i) => drawText(g, s, i ? right[i] : TX + 12, ty + 7, C.lavender, { align: i ? 'right' : 'left', scale: smallS() }));
    r.withAlpha(0.6, () => r.rect(TX + 8, ty + 18, TW - 16, 0.5, C.slate));
    HEROES.forEach((h, i) => {
      const rec = recs[i], y = ty + 23 + i * RH;
      if (i % 2 === 1) r.withAlpha(0.25, () => r.roundRect(TX + 6, y - 2, TW - 12, RH - 1, 3, C.black));
      drawText(g, h.name, TX + 12, y, h.color);
      // Bohater bez żadnego runu: pigułka zamiast rzędu zer.
      if (rec.bestTime <= 0 && rec.bestEndless <= 0 && rec.bestExpedition <= 0) { pill(r, right[1], y + 1, 'not played yet', C.lavender, 'right'); return; }
      [fmtTime(rec.bestTime), fmt(rec.bestKills), String(rec.bestLevel), fmtTime(rec.bestEndless), `${rec.bestExpedition} (${rec.expeditionWins})`]
        .forEach((s, j) => drawText(g, s, right[j + 1], y, C.white, { align: 'right' }));
    });
    drawText(g, 'Expedition: most maps (expeditions won)', W / 2, ty + 34 + HEROES.length * RH, C.lavender, { align: 'center', scale: smallS() });
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
/** Zakładka „Inne” (tryb debug, podgląd balansu) tylko w wersji deweloperskiej. */
const SET_TABS = ['Ogólne', 'Dźwięk', 'Obraz', 'Czytelność', ...(__DEV_TOOLS__ ? ['Inne'] : [])];
const SET_TAB_W = 80, SET_TAB_Y = 32, SET_TAB_H = 16, SET_LIST_Y = 58, SET_ROW = 15;
/** Tor zakładek segmentowych (x, szerokość); prostokąt zakładki do kliknięć: `tabRect`. */
const SET_TRACK_W = SET_TABS.length * SET_TAB_W, SET_TRACK_X = W / 2 - SET_TRACK_W / 2;

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
    const toggle = (k: 'shake' | 'debug' | 'damageNumbers' | 'autoPause' | 'autoEquip' | 'minimap' | 'healNumbers' | 'lowFx' | 'hints' | 'hitstop' | 'easy' | 'elemShapes' | 'scaleFill' | 'bulletOutline' | 'playerMarker') => () => {
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
    const hud = cycle(HUD_SCALES, () => s.hudScale, (v) => { s.hudScale = v; setHudScale(v); });
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
        sw('Auto-equip best items', () => yes(s.autoEquip), toggle('autoEquip'), 'Better new loot is equipped by itself (not uniques, not items you took off yourself). Common and magic items go straight to the backpack without a loot window. The Best gear button in the backpack checks everything on demand.'),
        sw('Pauza po wyjściu z okna', () => yes(s.autoPause), toggle('autoPause'), 'Gra pauzuje się sama, gdy przełączysz okno lub kartę.'),
        sw('Podpowiedzi', () => yes(s.hints), toggle('hints'), 'Krótkie wskazówki przy pierwszym spotkaniu z mechaniką (awans, skrzynie, elity, reakcje...).'),
        [{ label: () => (app.save.seenHints.length ? 'Pokaż podpowiedzi od nowa' : 'Podpowiedzi: wszystkie przed tobą'), act: () => { app.save.seenHints = []; app.persist(); } }, () => 'Kolejna gra pokaże wszystkie podpowiedzi jeszcze raz.'],
        [{ label: () => 'Controls', act: () => app.go(new ControlsScreen(app, this)) }, () => 'Change the keys for movement, abilities, dodge and menus in the game.'],
        // W trakcie runu (ustawienia z pauzy) bez samouczka: przejście porzuciłoby bieżący run bez zapisu.
        ...(this.back instanceof GameScreen ? [] : [[{ label: () => 'Replay tutorial', act: () => app.go(new GameScreen(app, 'kestra', 'endless', undefined, true)) }, () => 'Play the short tutorial again (2-3 minutes): movement, abilities, dodging, loot and a boss.'] as [MenuItem, () => string]]),
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
        opt('HUD size', () => `${Math.round(s.hudScale * 100)}%`, hud, () => 'In-game HUD panels (hero card, counters and minimap, weapon slots, ability bar) at a larger size. Corner panels grow toward the middle of the screen; on touch screens weapon slots may stay smaller to make room.'),
        opt('Przyciemnienie tła', () => DIM_LABEL[Math.max(0, DIM_LEVELS.indexOf(s.bgDim))], dim, () => 'Ciemniejsze podłoże i dekoracje: postacie, wrogowie i pociski bardziej odcinają się od tła.'),
        sw('Wyraźne pociski wrogów', () => yes(s.bulletOutline), toggle('bulletOutline'), 'Pociski wrogów dostają ciemną obwódkę, lepiej odcinają się od tła i efektów.'),
        sw('Znacznik gracza', () => yes(s.playerMarker), toggle('playerMarker'), 'Pulsujący krąg pod twoją postacią, łatwo ją znaleźć w tłumie.'),
        opt('Ataki gracza', () => FX_LABEL[s.playerFx] ?? FX_LABEL.visible, fx, () => 'Twoje pociski, aury, strefy i błyski trafień: automatyczne (przygaszane, gdy blisko jest dużo pocisków wrogów), przygaszone (półprzezroczyste) albo ukryte. Działają dalej, a pociski wrogów widać lepiej.'),
        sw('Kształty żywiołów', () => yes(s.elemShapes), toggle('elemShapes'), 'Dla daltonistów: każdy żywioł ma też własny kształt (ogień trójkąt, lód romb, błyskawica zygzak, trucizna kropla).'),
        sw('Liczby obrażeń', () => yes(s.damageNumbers), toggle('damageNumbers'), 'Liczby nad trafionymi wrogami (obrażenia gracza zawsze widać).'),
        sw('Liczby leczenia', () => yes(s.healNumbers), toggle('healNumbers'), 'Zielone liczby nad postacią: ile HP odzyskałeś (co pół sekundy).'),
        sw('Minimapa', () => yes(s.minimap), toggle('minimap'), 'Mała mapa w prawym górnym rogu: wrogowie, elity, boss i skrzynie.'),
      ],
      ...(__DEV_TOOLS__ ? [[
        sw('Tryb debug', () => yes(s.debug), toggle('debug'), 'Klawisze testowe F4, F6, F7 i podgląd balansu. Statystyki wydajności w grze: F3.'),
        [{ label: () => (s.debug ? 'Podgląd balansu' : 'Podgląd balansu (włącz debug)'), act: () => { if (s.debug) app.go(new BalanceScreen(app, this)); } }, () => 'Wartości do sprawdzenia: HP przedmiotów i ulepszeń, skalowanie wrogów, miękkie limity.'],
      ] as [MenuItem, () => string][]] : []),
    ];
    const list = [...rows[this.tab], [{ label: () => 'Wróć', act: () => app.go(this.back) }, () => ''] as [MenuItem, () => string]];
    // Długie zakładki (Czytelność) mają gęstsze wiersze: lista nie wyższa niż 11 wierszy po 15, więc trzy linie opisu
    // pod nią mieszczą się nad podpisem z klawiszami.
    this.menu = new Menu(list.map(([it]) => it), W / 2, SET_LIST_Y, 340, Math.min(SET_ROW, Math.floor((11 * SET_ROW) / list.length)));
    this.menu.previewOnTouch = true;
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
      for (let i = 0; i < SET_TABS.length; i++) if (inside(inp.mouse.x, inp.mouse.y, ...tabRect(SET_TRACK_X, SET_TAB_Y, SET_TRACK_W, SET_TAB_H, SET_TABS.length, i))) { this.setTab(i); return; }
    }
    this.menu.update(inp);
  }

  render(): void {
    const r = this.app.r, g = r.g;
    r.clear(C.black);
    titleBar(r, 'Ustawienia', 6);
    screenTabs(r, SET_TRACK_X, SET_TAB_Y, SET_TRACK_W, SET_TAB_H, SET_TABS, this.tab);
    panel(r, W / 2 - 180, SET_LIST_Y - 6, 360, this.menu.items.length * this.menu.lineH + 10);
    this.menu.render(r);
    drawText(g, 'Tab / Q / E: kategoria    Lewo/prawo: zmień', W / 2, H - 14, C.lavender, { align: 'center' });
    // Opis pod oknem listy (długie zakładki mają wyższe okno, opis zjeżdża niżej).
    const descY = Math.max(222, SET_LIST_Y + 4 + this.menu.items.length * this.menu.lineH + 4);
    wrapText(this.hints[this.menu.sel](), 420).forEach((l, i) => drawText(g, l, W / 2, descY + i * 11, C.lavender, { align: 'center' }));
  }
}

/** Pełny ekran przeglądarki (wywoływane z akcji menu albo klawisza F, czyli tuż po geście gracza). */
export function toggleFullscreen(): void {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen().catch(() => undefined);
}
