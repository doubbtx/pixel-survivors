import { W, H } from '../core/renderer';
import { C } from '../core/palette';
import { drawText } from '../core/font';
import { sfx } from '../core/audio';
import { heroRecord } from '../core/save';
import { drawSprite } from '../gfx/sprites';
import { PASSIVE_BY_ID } from '../data/passives';
import { CARD_BY_ID } from '../data/cards';
import { BAL } from '../data/balance';
import { levelDef, objectiveLabel } from '../data/levels';
import { Run, type Mode, type RunSnapshot } from '../game/run';
import { renderWorld } from '../game/render';
import { loseHardcoreRun } from '../game/campaign';
import { fmt, fmtTime } from '../util/format';
import type { App, Screen } from './app';
import { Menu, dim, panel } from './widgets';
import { renderHud } from './hud';
import { LevelUpView } from './levelup';
import { LootView, InventoryView, drawItemSlot } from './items';
import { SLOTS } from '../data/items';
import { CardPickView, rarityColor } from './cards';
import { ShopView } from './shop';
import { SynergyView } from './synergies';
import { AnvilView } from './anvil';
import { rollShop } from '../data/shop';
import { metaBonus, runEssence } from '../data/meta';
import { MainMenu, HeroSelect, SettingsScreen } from './menus';

type State = 'play' | 'levelup' | 'cards' | 'loot' | 'inventory' | 'shop' | 'anvil' | 'synergies' | 'pause' | 'cleared' | 'end';

/** Krótka blokada wejścia po otwarciu nakładki — żeby wciśnięty akurat klawisz nie wybrał karty. */
const OVERLAY_DELAY = 0.3;

/**
 * Ekran rozgrywki: run + nakładki (awans, karta, skrzynia, pauza, ukończenie poziomu, koniec runu).
 * Trening: jeden poziom. Hardcore: poziomy po kolei, zapis między poziomami, śmierć kasuje slot.
 * Między poziomami Hardcore jest sklep; po wczytaniu zapisu z ofertą sklepu gra zaczyna się od niego.
 */
export class GameScreen implements Screen {
  private run: Run;
  private state: State = 'play';
  private levelUp: LevelUpView | null = null;
  private cardPick: CardPickView | null = null;
  private loot: LootView | null = null;
  private inventory: InventoryView | null = null;
  private shop: ShopView | null = null;
  private synergies: SynergyView | null = null;
  private anvil: AnvilView | null = null;
  /** Stan, do którego wraca kowadło (ekran ukończenia albo sklep). */
  private anvilReturn: State = 'cleared';
  /** Wczytany zapis między poziomami: run stoi już na następnym poziomie, który jeszcze się nie zaczął. */
  private resumed = false;
  /** Esencja zdobyta w tym runie (ekran końca). */
  private essence = 0;
  /** Stan, do którego wraca ekran ekwipunku (gra albo pauza). */
  private invReturn: State = 'play';
  private toast = '';
  private toastT = 0;
  private delay = 0;
  private confirmQuit = false;
  private pauseMenu: Menu;
  private clearedMenu: Menu;
  private endMenu: Menu;

  constructor(private readonly app: App, private readonly heroId: string, private readonly mode: Mode, snapshot?: RunSnapshot) {
    this.run = snapshot ? Run.fromSnapshot(snapshot) : new Run(heroId, mode);
    this.run.cardBans = new Set(app.save.collection.banned);
    this.run.knownCards = new Set(app.save.collection.seen);
    this.run.applyMeta(metaBonus(app.save.meta), !snapshot);
    const hc = mode === 'hardcore';
    this.pauseMenu = new Menu([
      { label: () => 'Wznów', act: () => (this.state = 'play') },
      { label: () => 'Ekwipunek', act: () => this.openInventory('pause') },
      { label: () => 'Synergie', act: () => { this.synergies = new SynergyView(this.run); this.state = 'synergies'; this.delay = 0.1; } },
      { label: () => 'Ustawienia', act: () => app.go(new SettingsScreen(app, this)) },
      ...(hc ? [{ label: () => 'Zapisz i wyjdź', act: () => { this.saveHardcore(true); app.go(new MainMenu(app)); } }] : []),
      {
        label: () => (hc ? (this.confirmQuit ? 'Na pewno? Run przepadnie' : 'Poddaj run') : 'Zakończ run'),
        act: () => {
          if (hc && !this.confirmQuit) { this.confirmQuit = true; return; }
          this.onRunOver();
        },
      },
    ], 104, 104, 180);
    this.clearedMenu = new Menu([
      { label: () => `Dalej: poziom ${this.run.depth + 1}`, act: () => this.nextLevel() },
      { label: () => `Sklep (${fmt(this.run.gold)} zł)`, act: () => this.openShop() },
      { label: () => `Kowadło (${this.run.shards} odł.)`, act: () => this.openAnvil('cleared') },
      { label: () => 'Zapisz i wyjdź do menu', act: () => app.go(new MainMenu(app)) },
    ], W / 2, 194, 240, 16);
    this.endMenu = new Menu(hc ? [
      { label: () => 'Nowa kampania', act: () => app.go(new HeroSelect(app, 'hardcore')) },
      { label: () => 'Menu główne', act: () => app.go(new MainMenu(app)) },
    ] : [
      { label: () => 'Zagraj ponownie', act: () => app.go(new GameScreen(app, heroId, mode)) },
      { label: () => 'Wybór bohatera', act: () => app.go(new HeroSelect(app, mode)) },
      { label: () => 'Menu główne', act: () => app.go(new MainMenu(app)) },
    ], W / 2, 210, 200, 17);
    if (hc && snapshot && !snapshot.inProgress) {
      this.resumed = true;
      if (this.run.shop) this.openShop();
      else this.beginLevel();
    } else if (hc) {
      this.saveHardcore(true);
    }
  }

  /** Zapis slotu Hardcore. `inProgress` = trwa poziom (wyjście z gry w tym stanie = utrata runu). */
  private saveHardcore(inProgress: boolean): void {
    const run = this.run;
    this.syncCollection();
    this.app.save.hardcore.run = run.toSnapshot(inProgress || this.resumed ? run.depth : run.depth + 1, inProgress);
    this.app.persist();
  }

  /** Przenosi karty zobaczone i wybrane w runie do kolekcji (zapisuje się przy najbliższym persist). */
  private syncCollection(): void {
    const log = this.run.drainCardLog();
    const col = this.app.save.collection;
    for (const id of log.seen) if (!col.seen.includes(id)) col.seen.push(id);
    for (const id of log.picked) col.picks[id] = (col.picks[id] ?? 0) + 1;
  }

  private updateRecords(won: boolean): void {
    const run = this.run;
    this.syncCollection();
    const rec = heroRecord(this.app.save, this.heroId);
    rec.bestTime = Math.max(rec.bestTime, run.totalTime);
    rec.bestKills = Math.max(rec.bestKills, run.kills);
    rec.bestLevel = Math.max(rec.bestLevel, run.level);
    if (this.mode === 'hardcore') rec.bestDepth = Math.max(rec.bestDepth, run.depth);
    else if (this.mode === 'endless') rec.bestEndless = Math.max(rec.bestEndless, run.totalTime);
    else { rec.runs++; if (won) rec.wins++; }
  }

  /** Esencja za zakończony run (meta-progresja) — dodawana do zapisu, pokazywana na ekranie końca. */
  private awardEssence(): void {
    const meta = this.app.save.meta;
    this.essence = runEssence(this.run, this.run.essenceMul);
    meta.essence += this.essence;
    meta.total += this.essence;
  }

  /** Śmierć albo poddanie: w Hardcore przepada wszystko (slot czyszczony, wpis do tablicy). Esencja zostaje. */
  private onRunOver(): void {
    const run = this.run;
    this.updateRecords(false);
    this.awardEssence();
    if (this.mode === 'hardcore') loseHardcoreRun(this.app.save, { hero: this.heroId, depth: run.depth, totalTime: run.totalTime, kills: run.kills, level: run.level });
    this.app.persist();
    this.state = 'end';
  }

  /** Boss pokonany. Trening kończy się zwycięstwem; Hardcore zapisuje postęp i proponuje kolejny poziom. */
  private onLevelCleared(): void {
    this.updateRecords(true);
    if (this.mode === 'training') {
      this.awardEssence();
      this.app.persist();
      this.state = 'end';
      return;
    }
    this.run.shop = rollShop(this.run, this.run.depth + 1);
    this.saveHardcore(false);
    this.state = 'cleared';
    this.clearedMenu.sel = 0;
  }

  private nextLevel(): void {
    this.run.startLevel(this.run.depth + 1);
    this.beginLevel();
  }

  /** Start poziomu po przerwie: leczenie i zapis "w trakcie" (od teraz wyjście z gry = utrata runu). */
  private beginLevel(): void {
    const run = this.run;
    run.heal(run.stats.maxHp * BAL.levelClearHeal);
    run.shop = null;
    this.resumed = false;
    this.saveHardcore(true);
    this.state = 'play';
    sfx.play('levelup');
  }

  private openAnvil(from: State): void {
    this.anvil = new AnvilView(this.run, () => this.saveHardcore(false));
    this.anvilReturn = from;
    this.state = 'anvil';
    this.delay = 0.1;
  }

  private openShop(): void {
    this.shop = new ShopView(this.run, () => this.saveHardcore(false), this.resumed ? 'Do walki' : 'Wróć');
    this.state = 'shop';
    this.delay = 0.1;
  }

  private openInventory(from: State): void {
    this.inventory = new InventoryView(this.run);
    this.invReturn = from;
    this.state = 'inventory';
    this.delay = 0.1;
  }

  /** Otwiera nakładkę dla zaległych nagród: łup → awans → karta. */
  private openPending(): boolean {
    const run = this.run;
    if (run.pendingLoot.length > 0) {
      this.loot = new LootView(run, run.pendingLoot.shift()!);
      this.state = 'loot';
    } else if (run.pendingLevels > 0) {
      this.levelUp = new LevelUpView(run);
      this.state = 'levelup';
    } else if (run.pendingCards.length > 0) {
      this.cardPick = new CardPickView(run, run.pendingCards.shift()!);
      this.state = 'cards';
    } else {
      return false;
    }
    this.delay = OVERLAY_DELAY;
    return true;
  }

  update(dt: number): void {
    const inp = this.app.input;
    const run = this.run;
    const set = this.app.save.settings;
    this.syncCollection();
    // Dotyk: joystick i przyciski tylko w trakcie rozgrywki (w nakładkach dotyk = klik).
    inp.touchControls = this.state === 'play';
    if (!inp.touchControls) inp.stick = null;
    run.shakeEnabled = set.shake;
    run.aimMode = set.aim;
    run.damageNumbers = set.damageNumbers;
    run.healNumbers = set.healNumbers;
    run.lowFx = set.lowFx;
    run.hideProjectiles = set.hideProjectiles;
    if (inp.pressed('debug')) {
      set.debug = !set.debug;
      this.app.persist();
    }
    if (this.delay > 0) { this.delay -= dt; return; }

    switch (this.state) {
      case 'play':
        if ((inp.pressed('pause') || (set.autoPause && inp.focusLost)) && run.outcome === 'none') { this.state = 'pause'; this.pauseMenu.sel = 0; this.confirmQuit = false; return; }
        if (inp.pressed('inventory') && run.outcome === 'none') { this.openInventory('play'); return; }
        this.toastT = Math.max(0, this.toastT - dt);
        if (this.app.save.settings.debug) {
          if (inp.pressed('debugTime')) run.debugAdvance();
          if (inp.pressed('debugLevel')) run.addXp(run.xpNext - run.xp);
          if (inp.pressed('debugLoot')) run.pendingLoot.push(run.rollLoot('boss'));
        }
        run.update(dt, inp);
        // Co ~5 s zapis trwającego poziomu — po zamknięciu gry poziom wznowi się z tego miejsca.
        if (this.mode === 'hardcore' && run.outcome === 'none' && run.step % 300 === 0) this.saveHardcore(true);
        if (run.outcome === 'dead') {
          if (run.outcomeT <= 0) this.onRunOver();
        } else if (run.outcome === 'victory' && run.outcomeT > 0) {
          // chwila na "Boss pokonany!" zanim pojawią się nagrody
        } else if (!this.openPending() && run.outcome === 'victory') {
          this.onLevelCleared();
        }
        break;
      case 'levelup':
        if (this.levelUp!.update(inp)) {
          run.pendingLevels--;
          this.state = 'play';
          this.openPending();
        }
        break;
      case 'cards':
        if (this.cardPick!.update(inp)) {
          this.state = 'play';
          this.openPending();
        }
        break;
      case 'loot': {
        const res = this.loot!.update(inp);
        if (res.done) {
          if (res.note) { this.toast = res.note; this.toastT = 2.5; }
          this.state = 'play';
          this.openPending();
        }
        break;
      }
      case 'inventory':
        if (this.inventory!.update(inp, dt)) {
          this.state = this.invReturn;
          this.delay = 0.1;
          if (this.invReturn === 'shop') this.saveHardcore(false);
        }
        break;
      case 'anvil':
        if (this.anvil!.update(inp, dt)) { this.state = this.anvilReturn; this.delay = 0.1; }
        break;
      case 'synergies':
        if (this.synergies!.update(inp)) { this.state = 'pause'; this.delay = 0.1; }
        break;
      case 'shop': {
        const act = this.shop!.update(inp, dt);
        if (act === 'inventory') this.openInventory('shop');
        else if (act === 'anvil') this.openAnvil('shop');
        else if (act === 'close' && this.resumed) this.beginLevel();
        else if (act === 'close') { this.state = 'cleared'; this.delay = 0.1; }
        break;
      }
      case 'pause':
        if (inp.pressed('pause')) { this.state = 'play'; return; }
        this.pauseMenu.update(inp);
        break;
      case 'cleared':
        this.clearedMenu.update(inp);
        break;
      case 'end':
        this.endMenu.update(inp);
        break;
    }
  }

  render(): void {
    const r = this.app.r;
    const run = this.run;
    renderWorld(run, r);
    const between = this.state === 'cleared' || this.state === 'shop' || this.state === 'anvil' || (this.state === 'inventory' && this.invReturn === 'shop');
    if (this.state !== 'end' && !between) renderHud(run, r, this.app.loop, this.app.save.settings.debug, this.app.save.settings.minimap, this.app.input);
    switch (this.state) {
      case 'levelup':
        this.levelUp!.render(r);
        break;
      case 'cards':
        this.cardPick!.render(r);
        break;
      case 'loot':
        this.loot!.render(r);
        break;
      case 'inventory':
        this.inventory!.render(r);
        break;
      case 'shop':
        this.shop!.render(r);
        break;
      case 'synergies':
        this.synergies!.render(r);
        break;
      case 'anvil':
        this.anvil!.render(r);
        break;
      case 'play':
        if (this.toastT > 0) drawText(r.g, this.toast, W / 2, H - 40, C.yellow, { align: 'center', outline: C.black });
        break;
      case 'pause':
        this.renderPause();
        break;
      case 'cleared':
        this.renderCleared();
        break;
      case 'end':
        this.renderEnd();
        break;
    }
  }

  private renderPause(): void {
    const r = this.app.r, g = r.g, run = this.run, s = run.stats;
    dim(r);
    drawText(g, 'Pauza', 104, 64, C.yellow, { align: 'center', scale: 3, outline: C.black });
    if (this.mode === 'hardcore') {
      drawText(g, 'Hardcore: poddanie', 104, 214, C.salmon, { align: 'center', shadow: C.black });
      drawText(g, 'oznacza utratę wszystkiego', 104, 226, C.salmon, { align: 'center', shadow: C.black });
    }
    this.pauseMenu.render(r);
    const px = 208, pw = W - px - 8;
    panel(r, px, 8, pw, H - 16);
    // DPS: średnie obrażenia na sekundę w tym runie (łącznie i dla każdej broni).
    const time = Math.max(1, run.totalTime);
    let totalDmg = 0;
    for (const v of run.dmgBySource.values()) totalDmg += v;
    drawText(g, `${run.hero.name}   LV ${run.level}   poziom ${run.depth}`, px + 10, 14, run.hero.color, { shadow: C.black });
    drawText(g, `DPS ${fmt(totalDmg / time)}`, px + pw - 10, 14, C.gold, { align: 'right', shadow: C.black });
    const lines = [
      `HP ${fmt(s.maxHp)}   regeneracja ${s.regen.toFixed(1)}/s   pancerz ${fmt(s.armor)}`,
      `obrażenia x${s.might.toFixed(2)}   obszar x${s.area.toFixed(2)}   czas działania x${s.duration.toFixed(2)}`,
      `krytyk ${Math.round(s.crit * 100)}% (x${s.critMult.toFixed(1)})   leczenie z obrażeń ${Math.round(s.lifesteal * 100)}%`,
      `szybkość ataku +${Math.round(s.atkSpeed * 100)}%   odnowienie -${Math.round(s.cdr * 100)}%   pociski +${s.amount}`,
    ];
    lines.forEach((l, i) => drawText(g, l, px + 10, 30 + i * 11, C.lgray));
    // Bronie z poziomem i DPS pod ikoną, pasywki w drugim rzędzie.
    run.weapons.forEach((w, i) => {
      const x = px + 10 + i * 42, y = 76;
      drawSprite(g, w.def.icon, x + 7, y + 7);
      drawText(g, w.def.evolved ? '*' : String(w.level), x + 16, y + 6, C.white, { align: 'right', outline: C.black });
      drawText(g, fmt((run.dmgBySource.get(w.def.name) ?? 0) / time), x + 7, y + 16, C.gold, { align: 'center' });
    });
    drawText(g, 'DPS', px + pw - 10, 92, C.dgray, { align: 'right' });
    run.passives.forEach((p, i) => {
      const x = px + 10 + i * 19, y = 106;
      drawSprite(g, PASSIVE_BY_ID[p.id].icon, x + 7, y + 7);
      drawText(g, String(p.level), x + 16, y + 6, C.white, { align: 'right', outline: C.black });
    });
    // Założony ekwipunek (szczegóły: ekran Ekwipunek).
    SLOTS.forEach((s, i) => drawItemSlot(r, run.equipment[s.id], px + 10 + i * 21, 126, 20, false));
    drawText(g, '[I] ekwipunek', px + pw - 10, 131, C.dgray, { align: 'right' });
    drawText(g, `Karty (${run.cards.reduce((n, c) => n + c.stacks, 0)})    losowania kart: ${run.cardRerolls}`, px + 10, 150, C.lavender);
    run.cards.slice(0, 16).forEach((c, i) => {
      const def = CARD_BY_ID[c.id];
      const x = px + 10 + (i % 2) * 128, y = 163 + Math.floor(i / 2) * 11;
      drawText(g, `${def.name}${c.stacks > 1 ? ' x' + c.stacks : ''}`, x, y, def.cursed ? C.hotpink : rarityColor(def.rarity, 0));
    });
  }

  private renderCleared(): void {
    const r = this.app.r, g = r.g, run = this.run;
    dim(r);
    drawText(g, `Poziom ${run.depth} ukończony!`, W / 2, 16, C.yellow, { align: 'center', scale: 2, outline: C.black });
    drawText(g, run.levelInfo.name, W / 2, 44, C.lgray, { align: 'center', shadow: C.black });
    const next = levelDef(run.depth + 1);
    panel(r, 80, 62, 320, 128);
    const rows: [string, string][] = [
      ['Czas poziomu', fmtTime(run.time)],
      ['Zabójstwa na poziomie', fmt(run.levelKills)],
      ['Łączny czas', fmtTime(run.totalTime)],
      ['Poziom postaci / karty', `${run.level} / ${run.cards.reduce((n, c) => n + c.stacks, 0)}`],
      ['Złoto', fmt(run.gold)],
    ];
    rows.forEach(([k, v], i) => {
      drawText(g, k, 94, 72 + i * 12, C.lgray);
      drawText(g, v, 386, 72 + i * 12, C.white, { align: 'right' });
    });
    drawText(g, `Dalej: ${next.name}`, 94, 140, C.white);
    drawText(g, `Cel: ${objectiveLabel(next.objective)}, potem ${next.bossName}`, 94, 152, C.lavender);
    drawText(g, `Postęp zapisany. Na start +${Math.round(BAL.levelClearHeal * 100)}% HP.`, 94, 166, C.dgray);
    this.clearedMenu.render(r);
  }

  private renderEnd(): void {
    const r = this.app.r, g = r.g, run = this.run;
    dim(r);
    const won = run.outcome === 'victory';
    const title = won ? 'Zwycięstwo!' : run.outcome === 'dead' ? 'Zginąłeś' : 'Koniec runu';
    drawText(g, title, W / 2, 6, won ? C.yellow : C.salmon, { align: 'center', scale: 2, outline: C.black });
    const stats = `Czas ${fmtTime(run.totalTime)}    Zabójstwa ${fmt(run.kills)}    LV ${run.level}    Złoto ${fmt(run.gold)}    Leczenie ${fmt(run.healed)}`;
    const modeLine = this.mode === 'hardcore' ? `Hardcore: przepadło wszystko. Dotarłeś do poziomu ${run.depth}.`
      : this.mode === 'endless' ? `Endless: przetrwałeś ${fmtTime(run.totalTime)}, głębia ${run.depth} (rekord ${fmtTime(heroRecord(this.app.save, this.heroId).bestEndless)})` : '';
    if (modeLine) drawText(g, modeLine, W / 2, 28, C.orange, { align: 'center', shadow: C.black });
    drawText(g, stats, W / 2, 39, C.white, { align: 'center', shadow: C.black });
    drawText(g, `+${fmt(this.essence)} esencji   (Rozwój w menu głównym)`, W / 2, 50, C.cyan, { align: 'center', shadow: C.black });
    panel(r, 50, 62, 380, 140);
    drawText(g, 'Źródło obrażeń', 62, 70, C.lavender);
    drawText(g, 'Suma', 340, 70, C.lavender, { align: 'right' });
    drawText(g, 'DPS', 418, 70, C.lavender, { align: 'right' });
    const rows = [...run.dmgBySource.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    const total = rows.reduce((sum, x) => sum + x[1], 0) || 1;
    rows.forEach(([name, dmg], i) => {
      const y = 84 + i * 11;
      r.rect(62, y + 9, Math.round(200 * (dmg / total)), 1, C.dblue);
      drawText(g, name, 62, y, C.white);
      drawText(g, fmt(dmg), 340, y, C.gold, { align: 'right' });
      drawText(g, fmt(dmg / Math.max(1, run.totalTime)), 418, y, C.lgray, { align: 'right' });
    });
    this.endMenu.render(r);
  }
}
