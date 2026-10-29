import { tr } from '../core/i18n';
import { W, H, type Renderer } from '../core/renderer';
import { C, RAMP } from '../core/palette';
import { drawText, wrapText, textWidth, DESC, descS, descLH, smallS } from '../core/font';
import { sfx } from '../core/audio';
import { heroRecord, type HeroRecord } from '../core/save';
import { drawSprite } from '../gfx/sprites';
import { passiveIcon, PASSIVE_BY_ID } from '../data/passives';
import { CARD_BY_ID } from '../data/cards';
import { BAL } from '../data/balance';
import { Run, type Mode, type RunSnapshot } from '../game/run';
import { renderWorld, warmFx } from '../game/render';
import { endSlotRun } from '../game/campaign';
import { fmt, fmtTime } from '../util/format';
import type { App, Screen } from './app';
import { button, Menu, dim, panel, inside, slot, bar, Scroll } from './widgets';
import { renderHud } from './hud';
import { drawSkills } from './skills';
import type { AbilitySlot } from '../data/heroes';
import { abilityMaxCd } from '../systems/abilities';
import { LevelUpView } from './levelup';
import { LootView, InventoryView, drawItemSlot } from './items';
import { SLOTS } from '../data/items';
import { CardPickView, rarityColor } from './cards';
import { ShopView } from './shop';
import { SynergyView } from './synergies';
import { BuildView } from './build';
import { AnvilView } from './anvil';
import { rollShop } from '../data/shop';
import { metaBonus, runEssence, heroMeta, heroTree } from '../data/meta';
import { rollItem } from '../data/items';
import { advanceAct, currentMap, currentNode, isCombat, mapReward, newExpedition, nodeDepth, rollOffer } from '../data/expedition';
import { music } from '../core/music';
import { ExpeditionMapView } from './expedition';
import { Hints, type HintBox } from './hints';
import { HelpScreen } from './help';
import { CodexScreen } from './codex';
import { AUGMENT_BY_ID, augmentWorks } from '../data/augments';
import { MainMenu, HeroSelect, SettingsScreen } from './menus';
import { MetaScreen } from './meta';
import { HERO_BY_ID } from '../data/heroes';
import { PowerPickView } from './powers';
import { RelicPickView } from './relics';
import { ACHIEVEMENTS } from '../data/achievements';
import { Tutorial } from '../game/tutorial';
import { grantUnlocks, maxTier, unlocked, type UnlockCtx, type UnlockDef } from '../data/unlocks';
import { heroSkins } from '../data/pacts';
import { FEAT_BY_ID } from '../data/feats';
import { featsOnWin } from '../systems/feats';
import { BESTIARY_BY_ID, loreBonus, loreMuls } from '../data/bestiary';
import { BOSS_POWER_BY_ID } from '../data/enemies';
import { WEAPON_BY_ID, maxLevel } from '../data/weapons';
import { SECRET_BY_ID } from '../data/secrets';

const PEEK_LABELS = ['Build [C]', 'Plecak [I]', 'Synergie [Y]'];

type State = 'play' | 'levelup' | 'cards' | 'power' | 'relic' | 'loot' | 'inventory' | 'shop' | 'anvil' | 'synergies' | 'build' | 'pause' | 'map' | 'end';

/** Krótka blokada wejścia po otwarciu nakładki — żeby wciśnięty akurat klawisz nie wybrał karty. */
const OVERLAY_DELAY = 0.3;
/** Kolejne okno tego samego rodzaju (awanse pod rząd): krócej, ale nie zero — przytrzymany Enter nie wybierze przypadkiem. */
const REPEAT_DELAY = 0.12;
/** Pauza: lewa kolumna z menu (x, szerokość) i drobny tekst podsumowania. */
const PL = 8, PLW = 150;
const PAUSE_TABS = ['Postać', 'Build', 'Umiejętności'];

/**
 * Ekran rozgrywki: run + nakładki (awans, karta, skrzynia, pauza, ukończenie poziomu, mapa Ekspedycji, koniec runu).
 * Endless: jeden poziom bez końca. Ekspedycja: mapa węzłów (walki, sklepy, kowadła, obozy, skarby) przez 3 akty.
 * Każdy tryb ma własny slot zapisu: wyjście z gry wznawia run, śmierć albo poddanie kasuje slot.
 */
export class GameScreen implements Screen {
  private run: Run;
  private state: State = 'play';
  private levelUp: LevelUpView | null = null;
  private cardPick: CardPickView | null = null;
  private powerPick: PowerPickView | null = null;
  private relicPick: RelicPickView | null = null;
  /** Seria nagród (0.44): ile było w kolejce na początku, ile już otwartych, rodzaj ostatniego okna. */
  private rewardTotal = 0;
  private rewardDone = 0;
  private lastPick: State | null = null;
  private loot: LootView | null = null;
  private inventory: InventoryView | null = null;
  private shop: ShopView | null = null;
  private synergies: SynergyView | null = null;
  private build: BuildView | null = null;
  /** Stan, do którego wraca podgląd broni i pasywek (gra albo pauza). */
  private buildReturn: State = 'pause';
  private synReturn: State = 'pause';
  /** Statystyki diagnostyczne w HUD (F3 / `), nie zapisywane. */
  private diag = false;
  /** Prawa kolumna pauzy: 0 postać (statystyki, bronie, karty), 1 umiejętności z opisami. */
  private pausePage = 0;
  /** Pauza, zakładka Build: karta przypięta kliknięciem (opis w okienku; -1 = brak) i prostokąty kart z ostatniej klatki. */
  private pauseCard = -1;
  private cardRects: [number, number, number, number][] = [];
  private anvil: AnvilView | null = null;
  private map: ExpeditionMapView | null = null;
  /** Stan, do którego wraca kowadło (ekran ukończenia, sklep albo mapa). */
  private anvilReturn: State = 'map';
  /** Stan po zamknięciu sklepu (ekran ukończenia albo mapa) i po nakładkach nagród i pauzie (gra albo mapa). */
  private overlayReturn: State = 'play';
  /** Wczytany zapis między poziomami: run stoi już na następnym poziomie, który jeszcze się nie zaczął. */
  /** Esencja zdobyta w tym runie (ekran końca). */
  private essence = 0;
  /** Stan, do którego wraca ekran ekwipunku (gra albo pauza). */
  private invReturn: State = 'play';
  private toast = '';
  private toastT = 0;
  private delay = 0;
  private confirmQuit = false;
  private hints: Hints;
  /** Czy ultimate był gotowy w poprzedniej klatce (komunikat „R gotowe!” przy zmianie). */
  private ultReady = false;
  /** Odblokowania zdobyte w tym runie (banery po kolei, lista na ekranie końca) i licznik bossów do wykrycia nowego. */
  private unlockQueue: UnlockDef[] = [];
  private unlockedRun: UnlockDef[] = [];
  private bossSeen = 0;
  private pauseScroll = new Scroll();
  private pauseMenu: Menu;
  private endMenu: Menu;
  /** Zakładka ekranu końca: obrażenia, wykres DPS, karta buildu. */
  private endPage = 0;
  /** Rekordy bohatera sprzed runu (do „pobitych rekordów” w podsumowaniu). */
  private recStart: HeroRecord;

  /** Samouczek (game/tutorial.ts): bez zapisu, rekordów, esencji i odblokowań; gracz nie może zginąć. */
  private readonly tut: Tutorial | null;

  constructor(private readonly app: App, private readonly heroId: string, private readonly mode: Mode, snapshot?: RunSnapshot, tutorial = false) {
    this.run = snapshot ? Run.fromSnapshot(snapshot) : new Run(heroId, mode, 1, true, !!app.save.altUlt?.[heroId]);
    this.tut = tutorial ? new Tutorial() : null;
    this.run.scripted = tutorial;
    // Nowy run: pakty ryzyka wybrane przed startem (ui/pacts.ts) obowiązują do jego końca.
    if (!snapshot && !tutorial && unlocked(app.save, 'pacts')) this.run.pacts = { ...app.save.pacts.chosen };
    this.run.unlocked = new Set(app.save.achievements);
    // Skórka za odznakę Paktu (tylko jeśli nadal zdobyta).
    const skin = app.save.skins[heroId] ?? '';
    this.run.skin = heroSkins(app.save.pacts.best[heroId] ?? 0).some((b) => b.id === skin) ? skin : '';
    this.run.lore = loreMuls(app.save.bestiary);
    this.bossSeen = this.run.bossKills;
    this.recStart = { ...heroRecord(app.save, heroId) };
    this.hints = new Hints(app.save, () => app.persist());
    this.run.cardBans = new Set(app.save.collection.banned);
    this.run.knownCards = new Set(app.save.collection.seen);
    // Rozwój bohatera działa w obu trybach (Ekspedycja i Endless).
    this.run.applyMeta(metaBonus(heroMeta(app.save.meta, heroId), heroTree(heroId)), !snapshot);
    warmFx();
    this.pauseMenu = tutorial ? new Menu([
      { label: () => 'Wznów', act: () => (this.state = this.overlayReturn) },
      { label: () => 'Ustawienia', act: () => app.go(new SettingsScreen(app, this)) },
      { label: () => 'Skip tutorial', act: () => this.endTutorial() },
    ], PL + PLW / 2, 60, PLW - 14) : new Menu([
      { label: () => 'Wznów', act: () => (this.state = this.overlayReturn) },
      { label: () => 'Ekwipunek', act: () => this.openInventory('pause') },
      { label: () => 'Bronie i pasywki [C]', act: () => this.openBuild('pause') },
      { label: () => 'Synergie', act: () => this.openSynergies('pause') },
      { label: () => 'Evolution book', act: () => app.go(new CodexScreen(app, this)) },
      { label: () => 'Pomoc', act: () => app.go(new HelpScreen(app, this)) },
      { label: () => 'Ustawienia', act: () => app.go(new SettingsScreen(app, this)) },
      { label: () => 'Zapisz i wyjdź', act: () => { this.saveSlot(this.overlayReturn === 'play'); app.go(new MainMenu(app)); } },
      {
        // Poddanie z potwierdzeniem: przepada cały run.
        label: () => (this.confirmQuit ? 'Na pewno? Run przepadnie' : 'Poddaj run'),
        act: () => {
          if (!this.confirmQuit) { this.confirmQuit = true; return; }
          this.onRunOver();
        },
      },
    ], PL + PLW / 2, 52, PLW - 16, 17);
    this.endMenu = new Menu([
      { label: () => `Rozwój: ${HERO_BY_ID[heroId].name}`, act: () => app.go(new MetaScreen(app, new MainMenu(app), heroId)) },
      { label: () => (mode === 'expedition' ? 'Nowa ekspedycja' : 'New Endless run'), act: () => app.go(new HeroSelect(app, mode)) },
      { label: () => 'Menu główne', act: () => app.go(new MainMenu(app)) },
    ], W / 2, 216, 200, 15);
    if (mode === 'expedition' && !snapshot) {
      this.run.expedition = newExpedition(app.save.exTier, maxTier(app.save), !unlocked(app.save, 'forge'));
      this.openMap();
    } else if (mode === 'expedition' && !snapshot!.inProgress) {
      // Zapis z mapy: sklep, w którym gracz wyszedł, albo mapa.
      if (this.run.shop) this.openShop('map');
      else this.openMap();
    } else {
      this.saveSlot(true);
    }
  }

  /**
   * Zapis slotu trybu. `inProgress` = trwa poziom (wznowienie od zapisanego postępu); inaczej Ekspedycja zapisuje pozycję na mapie.
   */
  private saveSlot(inProgress: boolean): void {
    if (this.tut) return;
    const run = this.run;
    this.syncCollection();
    this.app.save.slots[this.mode] = run.toSnapshot(run.depth, inProgress);
    this.app.persist();
  }

  /** Przenosi karty zobaczone i wybrane w runie do kolekcji (zapisuje się przy najbliższym persist). */
  private syncCollection(): void {
    const log = this.run.drainCardLog();
    const col = this.app.save.collection;
    for (const id of log.seen) if (!col.seen.includes(id)) col.seen.push(id);
    for (const id of log.picked) col.picks[id] = (col.picks[id] ?? 0) + 1;
    for (const id of this.run.uniquesFound) if (!col.uniques.includes(id)) col.uniques.push(id);
    this.run.uniquesFound.clear();
    for (const id of this.run.secretsFound) if (!col.secrets.includes(id)) col.secrets.push(id);
    this.run.secretsFound.clear();
    // Bestiariusz: zabójstwa per wróg; po przekroczeniu progu bonus działa od razu.
    const best = this.app.save.bestiary, run = this.run;
    for (const [id, n] of Object.entries(run.killsById)) {
      const b = BESTIARY_BY_ID[id], before = best[id] ?? 0;
      best[id] = before + n;
      if (b && loreBonus(b, best[id]) > loreBonus(b, before)) {
        run.lore[id] = 1 + loreBonus(b, best[id]);
        this.showToast(`Bestiariusz: +${Math.round(loreBonus(b, best[id]) * 100)}% obrażeń przeciw ${b.id === 'boss' ? 'bossom' : 'temu wrogowi'}`);
      }
    }
    run.killsById = {};
    // Samouczek nie daje wyczynów ani osiągnięć (te odblokowują bohaterów).
    if (this.tut) { run.featsNew = []; return; }
    // Wyczyny: liczniki w zapisie.
    for (const id of run.featsNew) this.app.save.feats[id] = (this.app.save.feats[id] ?? 0) + 1;
    run.featsNew = [];
    // Osiągnięcia: odblokowują karty w ofertach od razu, także w tym runie.
    const got = this.app.save.achievements;
    for (const a of ACHIEVEMENTS) {
      if (got.includes(a.id) || !a.check(run, this.app.save)) continue;
      got.push(a.id);
      run.unlocked.add(a.id);
      run.showBanner(`Osiągnięcie: ${a.name}!`);
      this.showToast(`Nowa karta w ofertach: ${CARD_BY_ID[a.card].name}`);
      sfx.play('levelup');
    }
  }

  private updateRecords(): void {
    const run = this.run;
    this.syncCollection();
    const rec = heroRecord(this.app.save, this.heroId);
    rec.bestTime = Math.max(rec.bestTime, run.totalTime);
    rec.bestKills = Math.max(rec.bestKills, run.kills);
    rec.bestLevel = Math.max(rec.bestLevel, run.level);
    // Odznaki Paktu: najwyższy poziom Paktu, z którym bohater pokonał bossa.
    const pacts = this.app.save.pacts.best;
    if (run.bossKills > 0 && !run.easy) pacts[this.heroId] = Math.max(pacts[this.heroId] ?? 0, run.pactLevel);
    rec.bestDps = Math.max(rec.bestDps ?? 0, ...run.dpsLog, 0);
    rec.bestCombo = Math.max(rec.bestCombo ?? 0, run.bestCombo);
    rec.bestStreak = Math.max(rec.bestStreak ?? 0, run.bestStreak);
    if (this.mode === 'endless') rec.bestEndless = Math.max(rec.bestEndless, run.totalTime);
    else rec.bestExpedition = Math.max(rec.bestExpedition, run.expedition!.cleared);
  }

  /**
   * Esencja za zakończony run (Rozwój bohatera) — dodawana do zapisu, pokazywana na ekranie końca. Endless daje mniej niż
   * Ekspedycja (BAL.meta.endlessEssenceMul), zależnie od czasu przetrwania, głębi, zabójstw i poziomu postaci.
   */
  private awardEssence(mul = 1): void {
    const h = heroMeta(this.app.save.meta, this.heroId);
    const ex = this.run.expedition;
    if (this.mode === 'endless') mul *= BAL.meta.endlessEssenceMul;
    // Modyfikatory ukończonych map podnoszą esencję (BAL.expedition.rewardEssence na punkt nagrody).
    const mapMul = 1 + (ex?.bonus ?? 0) * BAL.expedition.rewardEssence / 100;
    this.essence = runEssence(this.run, ex?.cleared ?? 0, this.run.essenceMul * mul * mapMul);
    h.essence += this.essence;
    h.total += this.essence;
  }

  /** Śmierć albo poddanie: slot trybu czyszczony. Esencja zostaje. */
  private onRunOver(): void {
    this.suggestEasy();
    this.updateRecords();
    this.unlock({});
    this.awardEssence();
    this.endSlot();
    this.app.persist();
    this.state = 'end';
  }

  /** Wczesne porażki pod rząd (playtest): po dwóch ekran końca proponuje tryb łatwy jednym przyciskiem. */
  private suggestEasy(): void {
    const run = this.run, save = this.app.save, ex = run.expedition;
    if (this.tut || save.settings.easy) return;
    const early = run.outcome === 'dead' && (ex ? ex.act === 1 : run.depth <= 1 && run.totalTime < 240);
    save.earlyDeaths = early ? (save.earlyDeaths ?? 0) + 1 : 0;
    if ((save.earlyDeaths ?? 0) < 2) return;
    this.endMenu.items.unshift({
      label: () => (save.settings.easy ? 'Easy mode on' : 'Too hard? Turn on Easy mode'),
      act: () => {
        if (save.settings.easy) return;
        save.settings.easy = true;
        save.earlyDeaths = 0;
        this.app.persist();
        this.showToast('Easy mode on: weaker enemies (Settings to change)');
        sfx.play('levelup');
      },
    });
    this.endMenu.y -= this.endMenu.lineH;
  }

  private endSlot(): void {
    const run = this.run;
    endSlotRun(this.app.save, this.mode, { hero: this.heroId, depth: run.depth, totalTime: run.totalTime, kills: run.kills, level: run.level, expedition: run.expedition ?? undefined });
  }

  /** Poziom (mapa) Ekspedycji ukończony: powrót na mapę (po bossie: następny akt albo koniec wyprawy). Endless nie kończy poziomów. */
  private onLevelCleared(): void {
    const run = this.run;
    if (this.mode === 'expedition') {
      const ex = run.expedition!, m = currentMap(ex)!;
      ex.cleared++;
      ex.bonus += mapReward(m);
      if (m.kind === 'secret' && !ex.voidKey) { ex.voidKey = true; this.showToast('Klucz Pustki! Po ostatnim akcie otworzy się akt 4'); }
      // Błogosławieństwo liczy każdą mapę z walką (także loch); bonusu obozu loch nie używa ani nie zużywa.
      if (ex.blessing && --ex.blessing.maps <= 0) ex.blessing = null;
      if (m.kind !== 'dungeon') ex.camp = null;
      this.updateRecords();
      if (m.kind === 'boss') {
        featsOnWin(run);
        this.unlock({ boss: true, acts: ex.act });
        if (!advanceAct(ex)) { this.onExpeditionWon(); return; }
        run.heal(run.stats.maxHp * BAL.levelClearHeal);
        this.showToast(`${ex.act > BAL.expedition.acts ? 'Sekretny akt 4: Pustka' : `Akt ${ex.act}`}! +${Math.round(BAL.levelClearHeal * 100)}% HP`);
      }
      this.openMap();
      // Bonus mapy po ukończeniu: skrzynia, karta albo leczenie (nakładki wracają na mapę).
      if (m.bonus === 'chest') run.pendingLoot.push(run.rollLoot('boss'));
      if (m.bonus === 'card') run.pendingCards.push('elite');
      if (m.bonus === 'heal') run.heal(run.stats.maxHp * 0.4);
      this.openPending();
      return;
    }
  }

  /** Ostatni boss pokonany: wyprawa ukończona — rekord, więcej esencji, slot czyszczony. */
  private onExpeditionWon(): void {
    heroRecord(this.app.save, this.heroId).expeditionWins++;
    this.unlock({ boss: true, acts: this.run.expedition!.act, won: true });
    const X = BAL.expedition;
    this.awardEssence(X.winEssenceMul * (this.run.expedition!.act > X.acts ? X.voidEssenceMul : 1));
    this.endSlot();
    this.app.persist();
    this.state = 'end';
  }

  private showToast(text: string, t = 2.5): void {
    this.toast = text;
    this.toastT = t;
  }

  /** Nowe odblokowania (data/unlocks.ts): zapis, komunikat w menu głównym, banery w grze po kolei. */
  private unlock(c: Partial<UnlockCtx>): void {
    const s = this.app.save, ex = this.run.expedition;
    if (this.tut) return;
    const fresh = grantUnlocks(s, { boss: false, acts: 0, won: false, tier: ex?.tier ?? 0, ...c });
    if (!fresh.length) return;
    const last = fresh[fresh.length - 1];
    s.notice = `Unlocked: ${last.name}. ${last.hint}`;
    this.app.persist();
    this.unlockQueue.push(...fresh);
    this.unlockedRun.push(...fresh);
    // Trwająca wyprawa korzysta od razu (kowadła od następnego aktu, trudność od teraz).
    if (ex) { ex.maxTier = maxTier(s); ex.noForge = !unlocked(s, 'forge'); }
  }

  /** Samouczek: krok po kroku; gracz nie ginie (wskrzeszenie z pełnym życiem); na końcu Enter / klik → pierwsza Ekspedycja. */
  private updateTutorial(dt: number): void {
    const run = this.run, tut = this.tut!, inp = this.app.input;
    if (run.outcome === 'dead') { run.outcome = 'none'; run.player.hp = run.stats.maxHp; run.player.iframes = 2; }
    tut.update(run, dt);
    if (tut.finished && tut.t > 1 && (inp.pressed('confirm') || inp.pressed('click'))) this.endTutorial();
    if (tut.finished) tut.t += dt;
  }

  /** Panel samouczka pod licznikiem czasu: krok, tytuł, opis dla urządzenia gracza; na końcu przejście dalej. */
  private renderTutorial(): void {
    const r = this.app.r, g = r.g, tut = this.tut!, { title, body } = tut.text(this.app.input);
    const w = 220, x = W / 2 - w / 2, y = 44, lines = wrapText(body, w - 16);
    const h = 22 + lines.length * 11 + (tut.finished ? 12 : 0);
    panel(r, x, y, w, h);
    drawText(g, title, x + 8, y + 5, C.yellow, { shadow: C.black });
    drawText(g, tut.finished ? '' : `${Math.min(tut.step + 1, tut.total)}/${tut.total}`, x + w - 8, y + 6, C.lavender, { align: 'right', scale: smallS() });
    lines.forEach((l, i) => drawText(g, l, x + 8, y + 18 + i * 11, C.white));
    if (tut.finished) drawText(g, this.app.input.lastDevice === 'touch' ? 'Tap to continue' : 'Enter: continue', W / 2, y + h - 11, C.lime, { align: 'center', scale: smallS() });
    else drawText(g, 'Esc: pause (skip tutorial)', x + w - 8, y + h + 2, C.lavender, { align: 'right', scale: smallS() });
  }

  /** Koniec albo pominięcie samouczka: zapis i wybór bohatera do pierwszej Ekspedycji. */
  private endTutorial(): void {
    this.app.save.tutorialDone = true;
    this.app.persist();
    this.app.go(new HeroSelect(this.app, 'expedition'));
  }

  /** Kolejny baner odblokowania, gdy poprzedni komunikat zniknął. */
  private showUnlocks(): void {
    if (!this.unlockQueue.length || this.toastT > 0) return;
    const u = this.unlockQueue.shift()!;
    this.run.showBanner(`Unlocked: ${u.name}`);
    this.showToast(`Unlocked: ${u.name}. ${u.hint}`, 4);
    sfx.play('levelup');
  }

  /** Mapa Ekspedycji między węzłami (zapis pozycji). */
  private openMap(): void {
    this.hints.show('map');
    this.map ??= new ExpeditionMapView(this.run, (t) => { this.app.save.exTier = t; this.app.persist(); }, (text) => { this.showToast(text); this.saveSlot(false); });
    this.overlayReturn = 'map';
    this.state = 'map';
    this.delay = 0.1;
    this.saveSlot(false);
  }

  /** Wybór węzła na mapie: walka zaczyna poziom, reszta działa od razu (węzeł liczy się jako ukończony). */
  private enterNode(lane: number): void {
    const run = this.run, ex = run.expedition!, X = BAL.expedition;
    ex.path.push(lane);
    const kind = currentNode(ex)!;
    sfx.play('select');
    if (isCombat(kind)) {
      run.startLevel(nodeDepth(ex));
      this.overlayReturn = 'play';
      this.state = 'play';
      this.saveSlot(true);
      sfx.play('levelup');
      return;
    }
    run.depth = nodeDepth(ex);
    ex.cleared++;
    switch (kind) {
      case 'treasure':
        run.pendingLoot.push({ source: 'boss', item: rollItem(run.depth, 'boss', run.luck() + X.treasureLuck) });
        this.saveSlot(false);
        this.openPending();
        break;
      case 'shop':
        run.shop = rollShop(run, run.depth);
        this.saveSlot(false);
        this.openShop('map');
        break;
      case 'anvil':
        run.shards += X.anvilShards * ex.act;
        run.mats.stone += BAL.forge.anvilStones * ex.act;
        run.mats.ore += BAL.forge.anvilOre * ex.act;
        this.saveSlot(false);
        this.openAnvil('map');
        break;
      case 'rest':
        run.heal(run.stats.maxHp * X.restHeal);
        run.addBonus('maxHp', X.restMaxHp);
        ex.offer = rollOffer('rest', run.relic('pilgrim') ? 3 : 2);
        this.saveSlot(false);
        break;
      case 'shrine':
        ex.offer = rollOffer('shrine', run.relic('pilgrim') ? 3 : 2);
        this.saveSlot(false);
        break;
    }
  }

  private openAnvil(from: State): void {
    this.hints.show('anvil');
    this.anvil = new AnvilView(this.run, () => this.saveSlot(false));
    this.anvilReturn = from;
    this.state = 'anvil';
    this.delay = 0.1;
  }

  private openShop(from: State): void {
    this.hints.show('shop');
    const label = from === 'map' ? 'Do mapy' : 'Wróć';
    this.shop = new ShopView(this.run, () => this.saveSlot(false), label);
    this.state = 'shop';
    this.delay = 0.1;
  }

  /** Podgląd broni i pasywek (ewolucje, fuzje) z gry albo z pauzy. */
  private openBuild(from: State): void {
    this.build = new BuildView(this.run);
    this.buildReturn = from;
    this.state = 'build';
    this.delay = 0.1;
  }

  private openSynergies(from: State): void {
    this.synergies = new SynergyView(this.run);
    this.synReturn = from;
    this.state = 'synergies';
    this.delay = 0.1;
  }

  /**
   * Podgląd przy wyborze (awans, karty, moc, relikwia, łup): C = build (bronie, pasywki, fuzje), I/Tab = plecak,
   * Y = synergie — klawiszem albo klikiem w przyciski pod ofertą; po zamknięciu wraca do tego samego wyboru.
   */
  private peekFromPick(): boolean {
    const inp = this.app.input, m = inp.mouse, from = this.state;
    const hit = (i: number) => inp.pressed('click') && inside(m.x, m.y, ...this.peekBtn(i));
    if (inp.pressed('build') || hit(0)) { this.openBuild(from); return true; }
    if (inp.pressed('inventory') || hit(1)) { this.openInventory(from); return true; }
    if (inp.pressed('synergies') || hit(2)) { this.openSynergies(from); return true; }
    return false;
  }

  private peekBtn(i: number): [number, number, number, number] {
    return [4 + i * 74, H - 16, 72, 14];
  }

  private renderPeekBar(r: Renderer): void {
    PEEK_LABELS.forEach((l, i) => button(r, ...this.peekBtn(i), l, { scale: 0.9 }));
  }

  private openPause(): void {
    this.state = 'pause';
    this.pauseCard = -1;
    this.pauseMenu.sel = 0;
    this.confirmQuit = false;
  }

  private openInventory(from: State): void {
    this.inventory = new InventoryView(this.run);
    this.invReturn = from;
    this.state = 'inventory';
    this.delay = 0.1;
  }

  /** Podpowiedzi i komunikaty zależne od sytuacji w grze (każda podpowiedź raz; skan wrogów co pół sekundy). */
  private gameplayHints(): void {
    if (this.tut) return;
    const run = this.run, h = this.hints;
    if (run.time > 0.5) h.show('move');
    if (run.time > 4 && run.gems.count > 0) h.show('gems');
    if (run.time > 12) h.show('abilities');
    if (run.player.hp < run.stats.maxHp && run.hurtFx > 0) h.show('hurt');
    if (run.boss) h.show('boss');
    if (run.reactions > 0) h.show('reaction');
    if (run.time > 20) h.show('resource');
    if (run.time > 30 && run.terrain.some((t) => (t.x - run.player.x) ** 2 + (t.y - run.player.y) ** 2 < 120 * 120)) h.show('terrain');
    if (run.task) h.show('task');
    if (run.secretsFound.size || run.mapObjects.some((o) => o.kind === 'fountain' || o.kind === 'rune' || o.kind === 'mushroom')) h.show('secret');
    const ready = run.ultCharge >= run.ultNeed() && run.abilities.ult.activeT <= 0;
    if (ready && !this.ultReady) { run.showBanner('R gotowe!'); sfx.play('levelup'); h.show('ult'); }
    this.ultReady = ready;
    if (run.step % 30 !== 0) return;
    if (run.pickups.items.some((p) => p.kind === 'chest')) h.show('chest');
    if (run.enemies.items.some((e) => !e.dead && e.elite)) h.show('elite');
    if (Object.values(run.synTiers).some((t) => (t ?? 0) > 0)) h.show('synergy');
  }

  /** Otwiera nakładkę dla zaległych nagród: łup → awans → karta → moc bossa. */
  /**
   * Następna nagroda w kolejce (0.44, playtest 2): najpierw najważniejsze decyzje — relikwia, moc bossa, karty — potem awanse,
   * łup na końcu. Przy ≥3 nagrodach naraz (np. po bossie) licznik „Rewards 4/14” u góry; kolejne okno tego samego rodzaju
   * (np. awanse pod rząd) otwiera się szybciej.
   */
  private openPending(): boolean {
    const run = this.run;
    const left = run.pendingLoot.length + run.pendingLevels + run.pendingCards.length + run.pendingPowers + run.pendingRelics;
    if (!left) { this.rewardTotal = 0; this.rewardDone = 0; this.lastPick = null; return false; }
    if (!this.rewardTotal) { this.rewardDone = 0; this.rewardTotal = left >= 3 ? left : 0; }
    else this.rewardDone++;
    if (run.pendingRelics > 0) {
      run.pendingRelics--;
      this.relicPick = new RelicPickView(run);
      this.state = 'relic';
    } else if (run.pendingPowers > 0) {
      run.pendingPowers--;
      this.powerPick = new PowerPickView(run);
      this.state = 'power';
      this.hints.show('power');
    } else if (run.pendingCards.length > 0) {
      this.cardPick = new CardPickView(run, run.pendingCards.shift()!);
      this.state = 'cards';
      this.hints.show('cards');
    } else if (run.pendingLevels > 0) {
      this.levelUp = new LevelUpView(run);
      this.state = 'levelup';
      this.hints.show('levelup');
      if (this.levelUp.options.some((o) => o.kind === 'augment')) this.hints.show('augment');
      if (this.levelUp.options.some((o) => o.kind === 'fusion')) this.hints.show('fusion');
    } else {
      this.loot = new LootView(run, run.pendingLoot.shift()!);
      this.state = 'loot';
      this.hints.show('loot');
      if (this.loot.item.unique) this.hints.show('unique');
    }
    this.delay = this.state === this.lastPick ? REPEAT_DELAY : OVERLAY_DELAY;
    this.lastPick = this.state;
    return true;
  }

  /** Licznik serii nagród nad nakładką („Rewards 4/14”). */
  private renderRewardCounter(r: Renderer): void {
    if (!this.rewardTotal) return;
    const t = `${tr('Rewards')} ${Math.min(this.rewardTotal, this.rewardDone + 1)}/${this.rewardTotal}`;
    drawText(r.g, t, W - 6, 3, C.gold, { align: 'right', outline: C.black, scale: smallS() });
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
    run.lowFx = true; // pełne efekty (poświaty, cienie, winieta) wyłączone na stałe od 0.30.1
    run.playerFx = set.playerFx;
    run.elemShapes = set.elemShapes;
    run.bgDim = set.bgDim;
    run.bulletOutline = set.bulletOutline;
    run.playerMarker = set.playerMarker;
    run.reduceFlash = set.reduceFlash;
    if (run.easy !== set.easy) { run.easy = set.easy; run.onBuildChanged(); }
    // Statystyki diagnostyczne (F3 / `): tylko na czas sesji; klawisze testowe nadal wymagają trybu debug w Ustawieniach.
    if (inp.pressed('debug')) this.diag = !this.diag;
    this.hints.update(dt, this.state);
    // Muzyka: intensywność z liczby wrogów, lochu i wydarzenia; boss na pełno; poza walką ciszej.
    const fight = this.state === 'play' && run.outcome === 'none';
    const crowd = Math.min(1, run.enemies.count / BAL.musicCrowd) * 0.8 + (run.dungeon || run.levelEvent ? 0.2 : 0);
    music.setMood({ intensity: fight ? crowd : 0.08, biome: run.levelInfo.biome, boss: fight && !!run.boss });
    if (this.delay > 0) { this.delay -= dt; return; }

    switch (this.state) {
      case 'play':
        if ((inp.pressed('pause') || (set.autoPause && inp.focusLost)) && run.outcome === 'none') { this.openPause(); return; }
        if (inp.pressed('inventory') && run.outcome === 'none') { this.openInventory('play'); return; }
        if (inp.pressed('build') && run.outcome === 'none') { this.openBuild('play'); return; }
        this.toastT = Math.max(0, this.toastT - dt);
        // Zatrzymanie klatki po mocnym trafieniu / zabiciu elity: symulacja stoi przez chwilę (można wyłączyć w Ustawieniach).
        if (run.hitstop > 0 && !set.hitstop) run.hitstop = 0;
        if (run.hitstop > 0) { run.hitstop -= dt; break; }
        this.gameplayHints();
        if (this.tut) this.updateTutorial(dt);
        if (run.bossKills > this.bossSeen) { this.bossSeen = run.bossKills; this.unlock({ boss: true }); }
        this.showUnlocks();
        if (this.app.save.settings.debug) {
          if (inp.pressed('debugTime')) run.debugAdvance();
          if (inp.pressed('debugLevel')) run.addXp(run.xpNext - run.xp);
          if (inp.pressed('debugLoot')) run.pendingLoot.push(run.rollLoot('boss'));
        }
        run.update(dt, inp);
        // Co ~5 s zapis trwającego poziomu — po zamknięciu gry poziom wznowi się z tego miejsca.
        if (run.outcome === 'none' && run.step % 300 === 0) this.saveSlot(true);
        if (run.outcome === 'dead') {
          if (run.outcomeT <= 0) this.onRunOver();
        } else if (run.outcome === 'victory' && run.outcomeT > 0) {
          // chwila na "Boss pokonany!" zanim pojawią się nagrody
        } else if (!this.openPending() && run.outcome === 'victory') {
          this.onLevelCleared();
        }
        break;
      case 'levelup':
        if (this.peekFromPick()) break;
        if (this.levelUp!.update(inp)) {
          run.pendingLevels--;
          this.state = this.overlayReturn;
          this.openPending();
        }
        break;
      case 'cards':
        if (this.peekFromPick()) break;
        if (this.cardPick!.update(inp)) {
          this.state = this.overlayReturn;
          this.openPending();
        }
        break;
      case 'power':
        if (this.peekFromPick()) break;
        if (this.powerPick!.update(inp)) {
          this.state = this.overlayReturn;
          this.openPending();
        }
        break;
      case 'relic':
        if (this.peekFromPick()) break;
        if (this.relicPick!.update(inp)) {
          this.state = this.overlayReturn;
          this.openPending();
        }
        break;
      case 'loot': {
        if (this.peekFromPick()) break;
        const res = this.loot!.update(inp);
        if (res.done) {
          if (res.note) this.showToast(res.note);
          this.state = this.overlayReturn;
          this.openPending();
        }
        break;
      }
      case 'inventory':
        if (this.inventory!.update(inp, dt)) {
          this.state = this.invReturn;
          this.delay = 0.1;
          if (this.invReturn !== 'play' && this.invReturn !== 'pause') this.saveSlot(false);
        }
        break;
      case 'anvil':
        if (this.anvil!.update(inp, dt)) { this.state = this.anvilReturn; this.delay = 0.1; }
        break;
      case 'synergies':
        if (this.synergies!.update(inp)) { this.state = this.synReturn; this.delay = 0.1; }
        break;
      case 'build':
        if (this.build!.update(inp)) { this.state = this.buildReturn; this.delay = 0.1; }
        break;
      case 'shop': {
        const act = this.shop!.update(inp, dt);
        if (act === 'inventory') this.openInventory('shop');
        else if (act === 'anvil' && !this.run.expedition?.noForge) this.openAnvil('shop');
        else if (act === 'close') { this.run.shop = null; this.openMap(); }
        break;
      }
      case 'map': {
        this.toastT = Math.max(0, this.toastT - dt);
        this.showUnlocks();
        const act = this.map!.update(inp);
        if (act === 'menu') this.openPause();
        else if (act === 'inventory') this.openInventory('map');
        else if (act) this.enterNode(act.pick);
        break;
      }
      case 'pause':
        if (inp.pressed('pause')) { this.state = this.overlayReturn; return; }
        if (inp.pressed('left') || inp.pressed('right')) {
          this.pausePage = (this.pausePage + (inp.pressed('left') ? PAUSE_TABS.length - 1 : 1)) % PAUSE_TABS.length;
          sfx.play('select');
          this.pauseScroll.reset();
        }
        if (this.pausePage === 2) this.pauseScroll.update(inp, ...this.pauseArea());
        PAUSE_TABS.forEach((_, i) => { if (inp.pressed('click') && inside(inp.mouse.x, inp.mouse.y, ...this.pauseTab(i))) { this.pausePage = i; sfx.play('select'); } });
        // Build: klik w kartę pokazuje / chowa jej opis.
        if (this.pausePage === 1 && inp.pressed('click')) {
          const hit = this.cardRects.findIndex((rc) => inside(inp.mouse.x, inp.mouse.y, ...rc));
          if (hit >= 0) { this.pauseCard = this.pauseCard === hit ? -1 : hit; sfx.play('select'); }
        }
        this.pauseMenu.update(inp);
        break;
      case 'end':
        this.endMenu.update(inp);
        if (inp.pressed('inventory') || inp.pressed('left') || inp.pressed('right')) {
          this.endPage = (this.endPage + (inp.pressed('left') ? END_TABS.length - 1 : 1)) % END_TABS.length;
          sfx.play('select');
        }
        END_TABS.forEach((_, i) => { if (inp.pressed('click') && inside(inp.mouse.x, inp.mouse.y, ...this.endTab(i))) this.endPage = i; });
        break;
    }
  }

  render(): void {
    const r = this.app.r;
    const run = this.run;
    renderWorld(run, r);
    const between = this.state === 'shop' || this.state === 'anvil' || this.state === 'map' || this.overlayReturn === 'map'
      || (this.state === 'inventory' && (this.invReturn === 'shop' || this.invReturn === 'map'));
    // HUD tylko w trakcie gry: nakładki (pauza, awans, łup, ekwipunek...) zasłaniają go w całości.
    if (this.state === 'play' && !between) renderHud(run, r, this.app.loop, this.diag, this.app.save.settings.debug, this.app.save.settings.minimap, this.app.input);
    if (this.state === 'play' && this.tut) this.renderTutorial();
    switch (this.state) {
      case 'levelup':
        this.levelUp!.render(r);
        this.renderPeekBar(r);
        this.renderRewardCounter(r);
        break;
      case 'cards':
        this.cardPick!.render(r);
        this.renderPeekBar(r);
        this.renderRewardCounter(r);
        break;
      case 'power':
        this.powerPick!.render(r);
        this.renderPeekBar(r);
        this.renderRewardCounter(r);
        break;
      case 'relic':
        this.relicPick!.render(r);
        this.renderPeekBar(r);
        this.renderRewardCounter(r);
        break;
      case 'loot':
        this.loot!.render(r);
        this.renderPeekBar(r);
        this.renderRewardCounter(r);
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
      case 'build':
        this.build!.render(r);
        break;
      case 'anvil':
        this.anvil!.render(r);
        break;
      case 'play':
        if (this.toastT > 0) drawText(r.g, this.toast, W / 2, H - 40, C.yellow, { align: 'center', outline: C.black });
        break;
      case 'map':
        this.map!.render(r);
        if (this.toastT > 0) drawText(r.g, this.toast, W / 2, H - 44, C.lime, { align: 'center', outline: C.black }); // nad przyciskami mapy (playtest)
        break;
      case 'pause':
        this.renderPause();
        break;
      case 'end':
        this.renderEnd();
        break;
    }
    if (this.state !== 'pause' && this.state !== 'end') this.hints.render(r, HINT_BOX[this.state] ?? null, this.app.input.lastDevice === 'touch');
  }

  /**
   * Pauza: po lewej menu z miejscem w runie, po prawej podsumowanie postaci — statystyki w dwóch kolumnach
   * (wartości domyślne przygaszone), bronie z poziomem i DPS, pasywki z ekwipunkiem i karty. HUD pod spodem ukryty.
   */
  private renderPause(): void {
    const r = this.app.r, g = r.g, run = this.run, s = run.stats, ex = run.expedition;
    r.withAlpha(0.78, () => r.cover(C.black));
    // Lewa kolumna: tytuł, miejsce w runie, menu, ostrzeżenie o poddaniu.
    panel(r, PL, 8, PLW, H - 16);
    drawText(g, 'Pauza', PL + PLW / 2, 15, C.yellow, { align: 'center', scale: 2, outline: C.black });
    const where = [this.tut ? 'Tutorial' : ex ? `Akt ${ex.act}, głębia ${run.depth}` : this.mode === 'endless' ? `Endless, głębia ${run.depth}` : `Etap ${run.depth}`, fmtTime(run.totalTime)].join('   ');
    drawText(g, where, PL + PLW / 2, 36, C.lgray, { align: 'center' });
    if (run.pactLevel) drawText(g, `Pakt ${run.pactLevel}`, PL + PLW / 2, 47, C.red, { align: 'center' });
    this.pauseMenu.render(r);
    {
      const warn = this.tut ? 'Tutorial: giving up ends the tutorial' : `${this.mode === 'expedition' ? 'Ekspedycja' : 'Endless'}: giving up ends the run (essence stays)`;
      const lines = wrapText(warn, PLW - 16);
      lines.forEach((l, i) => drawText(g, l, PL + PLW / 2, H - 14 - lines.length * 11 + i * 11, C.salmon, { align: 'center' }));
    }

    // Prawa kolumna: zakładki (strzałki lewo/prawo albo klik) i wspólny nagłówek: bohater, poziom, DPS.
    const px = PL + PLW + 6, pw = W - px - 8, x0 = px + 10, colW = (pw - 20) / 2;
    panel(r, px, 8, pw, H - 16);
    PAUSE_TABS.forEach((t, i) => button(r, ...this.pauseTab(i), t, { active: i === this.pausePage, accent: C.gold }));
    const time = Math.max(1, run.totalTime);
    let totalDmg = 0;
    for (const v of run.dmgBySource.values()) totalDmg += v;
    drawText(g, run.hero.name, x0, 33, run.hero.color, { shadow: C.black });
    const lvlTxt = `poziom postaci ${run.level}`, lvlX = x0 + textWidth(run.hero.name) + 6;
    drawText(g, lvlTxt, lvlX, 33, C.lgray);
    drawText(g, `DPS ${fmt(Math.round(totalDmg / time))}`, lvlX + textWidth(lvlTxt) + 10, 33, C.gold, { shadow: C.black });
    if (this.pausePage === 2) { this.renderPauseSkills(x0, pw); return; }
    const head = (t: string, y: number) => { drawText(g, t, x0, y, C.lavender); r.withAlpha(0.4, () => r.rect(x0 + textWidth(t) + 4, y + 5, pw - 24 - textWidth(t), 0.5, C.lavender)); };
    if (this.pausePage === 1) { this.renderPauseBuild(x0, colW, head); return; }

    // Statystyki: etykieta po lewej, wartość po prawej; wartość bazowa przygaszona.
    head('Statystyki', 47);
    const pct = (v: number) => `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`;
    const stats: [string, string, boolean][] = [
      ['HP', fmt(s.maxHp), true], ['Pancerz', fmt(s.armor), s.armor > 0],
      ['Regeneracja', `${s.regen.toFixed(1)}/s`, s.regen > 0], ['Leczenie z obrażeń', `${Math.round(s.lifesteal * 100)}%`, s.lifesteal > 0],
      ['Obrażenia', `x${s.might.toFixed(2)}`, s.might !== 1], ['Krytyk', `${Math.round(s.crit * 100)}% (x${s.critMult.toFixed(1)})`, true],
      ['Szybkość ataku', pct(s.atkSpeed), s.atkSpeed !== 0], ['Odnowienie', pct(-s.cdr), s.cdr !== 0],
      ['Obszar', `x${s.area.toFixed(2)}`, s.area !== 1], ['Pociski', `+${s.amount}`, s.amount > 0],
      ['Czas działania', `x${s.duration.toFixed(2)}`, s.duration !== 1], ['Siła żywiołów', pct(s.elemPower), s.elemPower !== 0],
      ['Szczęście', pct(run.luck()), run.luck() > 0], ['Karty przy awansie', String(Math.min(4, 3 + s.choices)), s.choices > 0],
    ];
    stats.forEach(([k, v, on], i) => {
      const cx = x0 + (i % 2) * (colW + 8), y = 59 + Math.floor(i / 2) * 11;
      drawText(g, k, cx, y, on ? C.lgray : C.lavender);
      drawText(g, v, cx + colW - 8, y, on ? C.white : C.lavender, { align: 'right' });
    });

    // Bronie: ikona, nazwa, poziom, DPS i udział w obrażeniach.
    head('Bronie', 140);
    const best = Math.max(1, ...run.weapons.map((w) => run.dmgBySource.get(w.def.name) ?? 0));
    run.weapons.forEach((w, i) => {
      const cx = x0 + (i % 2) * (colW + 8), y = 152 + Math.floor(i / 2) * 22;
      slot(r, cx, y, 18, w.def.evolved ? C.gold : C.slate);
      drawSprite(g, w.def.icon, cx + 9, y + 9);
      const augs = run.augments.filter((id) => augmentWorks(AUGMENT_BY_ID[id], w.def)).length;
      for (let k = 0; k < augs; k++) r.rect(cx + 2 + k * 4, y - 2, 3, 2, C.cyan);
      drawText(g, w.def.name, cx + 22, y - 1, w.def.color);
      drawText(g, w.def.fused ? 'fuzja' : w.def.evolved ? 'ewolucja' : `poz. ${w.level}/${maxLevel(w.def)}`, cx + 22, y + 9, C.lavender);
      const dmg = run.dmgBySource.get(w.def.name) ?? 0;
      drawText(g, fmt(Math.round(dmg / time)), cx + colW - 8, y - 1, C.gold, { align: 'right' });
      bar(r, cx + colW - 40, y + 12, 32, 4, dmg / best, RAMP.gold);
    });
  }

  /** Pauza, zakładka Build: pasywki z poziomami, ekwipunek i karty (pełny rozmiar tekstu). */
  private renderPauseBuild(x0: number, colW: number, head: (t: string, y: number) => void): void {
    const r = this.app.r, g = r.g, run = this.run;
    head('Pasywki', 47);
    if (!run.passives.length) drawText(g, 'No passives yet', x0, 59, C.lavender);
    run.passives.forEach((p, i) => {
      const cx = x0 + (i % 2) * (colW + 8), y = 59 + Math.floor(i / 2) * 21;
      slot(r, cx, y, 18, p.evo ? C.gold : C.slate);
      drawSprite(g, passiveIcon(p), cx + 9, y + 9);
      drawText(g, PASSIVE_BY_ID[p.id].name, cx + 22, y - 1, C.white);
      drawText(g, `poz. ${p.level}`, cx + 22, y + 9, C.lavender);
    });
    const ey = 59 + Math.ceil(Math.max(1, run.passives.length) / 2) * 21 + 2;
    head('Ekwipunek', ey);
    SLOTS.forEach((sl, i) => drawItemSlot(r, run.equipment[sl.id], x0 + i * 22, ey + 12, 20, false));
    // Karty: nazwy w dwóch kolumnach, reszta jako „+N więcej”.
    const cy = ey + 38, nCards = run.cards.reduce((n, c) => n + c.stacks, 0);
    head(`Karty (${nCards})`, cy);
    const rows = Math.max(1, Math.floor((H - 26 - (cy + 12)) / 11)), max = rows * 2;
    const shown = run.cards.length > max ? max - 1 : max;
    if (run.cards.length) drawText(g, 'Click or point at a card: description', x0, H - 22, C.lavender, { scale: smallS() });
    this.cardRects = [];
    const m = this.app.input.mouse;
    let hover = -1;
    run.cards.slice(0, shown).forEach((c, i) => {
      const def = CARD_BY_ID[c.id], cx = x0 + (i % 2) * (colW + 8), y = cy + 12 + Math.floor(i / 2) * 11;
      this.cardRects.push([cx - 1, y - 1, colW, 11]);
      const on = this.pauseCard === i || inside(m.x, m.y, cx - 1, y - 1, colW, 11);
      if (on && hover < 0 && this.pauseCard < 0) hover = i;
      if (this.pauseCard === i || (this.pauseCard < 0 && hover === i)) r.withAlpha(0.25, () => r.rect(cx - 2, y - 1, colW, 11, C.lavender));
      drawText(g, `${def.name}${c.stacks > 1 ? ' x' + c.stacks : ''}`, cx, y, def.cursed ? C.hotpink : rarityColor(def.rarity, 0));
    });
    if (run.cards.length > shown) drawText(g, `+${run.cards.length - shown} więcej`, x0 + (shown % 2) * (colW + 8), cy + 12 + Math.floor(shown / 2) * 11, C.lavender);
    if (!run.cards.length) drawText(g, 'Brak kart', x0, cy + 12, C.lavender);
    // Opis karty: przypiętej kliknięciem albo pod kursorem; okienko nad listą kart (nie zasłania wskazanej karty).
    const idx = this.pauseCard >= 0 && this.pauseCard < shown ? this.pauseCard : hover;
    if (idx >= 0) this.renderCardTip(run.cards[idx], x0, colW, this.cardRects[idx][1]);
  }

  /** Okienko z opisem karty (pauza, Build): nazwa w kolorze rzadkości, tagi, opis i liczba kopii. */
  private renderCardTip(c: { id: string; stacks: number }, x0: number, colW: number, rowY: number): void {
    const r = this.app.r, g = r.g, def = CARD_BY_ID[c.id], w = colW * 2 + 8, tw = (w - 12) / descS(), lh = descLH();
    const lines = wrapText(def.desc, tw), h = 26 + lines.length * lh + (c.stacks > 1 ? lh : 0);
    const y = Math.max(40, rowY - h - 3);
    panel(r, x0 - 4, y, w + 2, h);
    drawText(g, def.name, x0 + 2, y + 4, def.cursed ? C.hotpink : rarityColor(def.rarity, 0), { shadow: C.black });
    drawText(g, def.tags.join(' / '), x0 + w - 6, y + 4, C.lavender, { align: 'right', scale: smallS() });
    let ly = y + 17;
    for (const l of lines) { drawText(g, l, x0 + 2, ly, C.white, DESC); ly += lh; }
    if (c.stacks > 1) drawText(g, `x${c.stacks}: the effect stacks`, x0 + 2, ly, C.lime, DESC);
  }

  /** Zakładka `i` prawej kolumny pauzy: [x, y, szerokość, wysokość]. */
  private pauseTab(i: number): [number, number, number, number] {
    const px = PL + PLW + 6, tw = 80;
    return [px + 10 + i * (tw + 3), 12, tw, 16];
  }

  /** Pauza, zakładka umiejętności: poziom, odnowienie, opis i ewolucja każdej umiejętności; pasywka i zasób bohatera. */
  private renderPauseSkills(x0: number, pw: number): void {
    const r = this.app.r, g = r.g, run = this.run;
    const slots: AbilitySlot[] = ['q', 'e', 'dash', 'ult'];
    // Przewijane (opisy w pełnym rozmiarze przy dużym tekście).
    const area = this.pauseArea(), oy = this.pauseScroll.begin(r, ...area);
    let y = drawSkills(r, slots.map((sl) => {
      const a = run.abilities[sl];
      const cd = sl === 'ult' ? `ładunek ${Math.min(run.ultCharge, run.ultNeed())}/${run.ultNeed()}` : `odnowienie ${abilityMaxCd(run, sl).toFixed(1)} s`;
      return { def: a.def, level: a.level, cd, evo: true };
    }), x0, area[1] + 4 - oy, pw - 22);
    const tw = (pw - 22) / descS();
    for (const [t, col] of [[`Pasywka: ${tr(run.hero.passive.name)}. ${tr(run.hero.passive.desc)}`, C.yellow], [`Zasób: ${tr(run.hero.resource.name)}. ${tr(run.hero.resource.desc)}`, run.hero.resource.color]] as const) {
      for (const line of wrapText(t, tw)) { drawText(g, line, x0, y, col, DESC); y += descLH(); }
      y += 3;
    }
    this.pauseScroll.end(r, y + oy - area[1], ...area);
  }

  /** Przewijany obszar zakładki Umiejętności w pauzie (pod imieniem bohatera). */
  private pauseArea(): [number, number, number, number] {
    const px = PL + PLW + 6, pw = W - px - 8;
    return [px + 4, 46, pw - 8, H - 56];
  }

  /** Góra i wysokość panelu zakładek na ekranie końca (zależą od liczby linii informacji). */
  private endY = 98;
  private endH = END_BOTTOM - 98;

  /** Prostokąt zakładki `i` ekranu końca (rysowanie i kliknięcie z jednego miejsca). */
  private endTab(i: number): [number, number, number, number] {
    const n = END_TABS.length;
    return [END_X + i * ((END_W + 4) / n), this.endY - 17, (END_W + 4) / n - 4, 14];
  }

  private renderEnd(): void {
    const r = this.app.r, g = r.g, run = this.run;
    dim(r);
    const ex = run.expedition;
    // Ekspedycja: zwycięstwo tylko po ostatnim bossie (wcześniejsze zwycięstwa wracają na mapę).
    const won = run.outcome === 'victory' && run.mode !== 'expedition' || (!!ex && run.outcome === 'victory' && ex.act >= BAL.expedition.acts && currentNode(ex) === 'boss');
    const title = won ? (ex ? 'Ekspedycja ukończona!' : 'Zwycięstwo!') : run.outcome === 'dead' ? 'Zginąłeś' : 'Koniec runu';
    drawText(g, title, W / 2, 6, won ? C.yellow : C.salmon, { align: 'center', scale: 2, outline: C.black });
    // Kafelki z najważniejszymi liczbami runu.
    let total = 0;
    for (const v of run.dmgBySource.values()) total += v;
    const tiles: [string, string, number][] = [
      ['Czas', fmtTime(run.totalTime), C.white],
      ['Zabójstwa', fmt(run.kills), C.white],
      ['Poziom postaci', String(run.level), C.white],
      [ex ? 'Akt' : this.mode === 'endless' ? 'Głębia' : 'Etap', ex ? `${ex.act}/${BAL.expedition.acts}` : String(run.depth), C.white],
      ['Średni DPS', fmt(Math.round(total / Math.max(1, run.totalTime))), C.gold],
      ['Złoto', fmt(Math.floor(run.gold)), C.yellow],
    ];
    const tw = (W - 24 - 5 * 4) / 6;
    tiles.forEach(([k, v, col], i) => {
      const x = 12 + i * (tw + 4);
      r.withAlpha(0.85, () => r.roundRect(x, 38, tw, 26, 3, C.navy, C.black));
      r.roundFrame(x + 0.5, 38.5, tw - 1, 25, 3, C.slate, 0.75);
      drawText(g, k, x + tw / 2, 41, C.lgray, { align: 'center', scale: smallS() });
      drawText(g, v, x + tw / 2, 50, col, { align: 'center', shadow: C.black });
    });
    const modeLine = this.mode === 'endless' ? `Endless: rekord ${fmtTime(heroRecord(this.app.save, this.heroId).bestEndless)}`
      : `Ekspedycja: ukończone węzły ${ex!.cleared}${won ? `, esencja x${BAL.expedition.winEssenceMul}` : ''}`;
    // Esencja za run (oba tryby) i wyczyny runu (jeśli są).
    const feats = [...new Set(run.featsRun)].map((id) => FEAT_BY_ID[id].name).join(', ');
    const essence = `+${fmt(this.essence)} esencji dla: ${run.hero.name} (Rozwój w menu głównym)`;
    const info: [string, number][] = [[modeLine, C.lgray], [essence, C.cyan]];
    if (feats) info.push([`Wyczyny: ${feats}`, C.gold]);
    if (this.unlockedRun.length) info.push([`Unlocked: ${this.unlockedRun.map((u) => u.name).join(', ')}`, C.lime]);
    info.forEach(([t, col], i) => drawText(g, t, W / 2, 69 + i * 10, col, { align: 'center', shadow: C.black }));
    // Panel zakładek zaczyna się tuż pod liniami informacji (bez pustego pasa, gdy ich nie ma).
    this.endY = 88 + info.length * 10;
    this.endH = END_BOTTOM - this.endY;
    // Zakładki: obrażenia, wykres DPS, karta buildu (Tab / strzałki / klik).
    END_TABS.forEach((t, i) => {
      button(r, ...this.endTab(i), t, { active: i === this.endPage, accent: C.gold });
    });
    panel(r, END_X, this.endY, END_W, this.endH);
    if (this.endPage === 0) this.renderHighlights();
    else if (this.endPage === 1) this.renderDamage();
    else if (this.endPage === 2) this.renderDpsGraph();
    else this.renderBuild();
    this.endMenu.render(r);
  }

  /**
   * Ekran końca, wyróżnienia (0.33): najlepsza broń, szczytowy DPS, najmocniejsze trafienie, najdłuższe kombo i seria zabójstw
   * (złota plakietka „Record!”, gdy pobity), a pod spodem lista rekordów bohatera pobitych w tym runie.
   */
  private renderHighlights(): void {
    const r = this.app.r, g = r.g, run = this.run, before = this.recStart, ex = run.expedition;
    const all = [...run.dmgBySource.entries()].sort((a, b) => b[1] - a[1]);
    const total = all.reduce((sum, x) => sum + x[1], 0) || 1, top = all[0];
    const topW = top ? run.weapons.find((w) => w.def.name === top[0]) : undefined;
    // Krótki run bez pomiarów: szczyt co najmniej równy średniej.
    const peak = Math.max(total / Math.max(1, run.totalTime), ...run.dpsLog);
    const cards: { title: string; value: string; note: string; icon?: string; rec: boolean }[] = [
      { title: 'Best weapon', value: top ? top[0] : '-', note: top ? `${Math.round((100 * top[1]) / total)}% of damage` : '', icon: topW?.def.icon, rec: false },
      { title: 'Peak DPS', value: fmt(Math.round(peak)), note: `average ${fmt(Math.round(total / Math.max(1, run.totalTime)))}`, icon: 'cd_tempest', rec: peak > (before.bestDps ?? 0) && peak > 0 },
      { title: 'Biggest hit', value: fmt(run.maxHit), note: run.maxHitSrc, icon: 'pi_crit', rec: false },
      { title: 'Longest combo', value: String(run.bestCombo), note: 'kills, no hits taken', icon: 'pi_fury', rec: run.bestCombo > (before.bestCombo ?? 0) && run.bestCombo > 0 },
      { title: 'Best kill streak', value: String(run.bestStreak), note: 'quick kills', icon: 'cd_explode', rec: run.bestStreak > (before.bestStreak ?? 0) && run.bestStreak > 0 },
    ];
    const cw = (END_W - 24 - 4 * 4) / 5, ch = 48, y = this.endY + 6;
    cards.forEach((c, i) => {
      const x = END_X + 12 + i * (cw + 4);
      r.withAlpha(0.85, () => r.roundRect(x, y, cw, ch, 3, C.navy, C.black));
      r.roundFrame(x + 0.5, y + 0.5, cw - 1, ch - 1, 3, c.rec ? C.gold : C.slate, c.rec ? 1 : 0.75);
      drawText(g, c.title, x + cw / 2, y + 3, C.lgray, { align: 'center', scale: smallS() });
      if (c.icon) drawSprite(g, c.icon, x + cw / 2, y + 18);
      drawText(g, c.value, x + cw / 2, y + 27, c.rec ? C.yellow : C.white, { align: 'center', shadow: C.black, scale: textWidth(c.value) > cw - 6 ? 0.75 : 1 });
      drawText(g, c.note, x + cw / 2, y + 38, C.lavender, { align: 'center', scale: smallS() });
      if (c.rec && run.blink(40, 28)) drawText(g, 'Record!', x + cw - 4, y + 13, C.gold, { align: 'right', outline: C.black, scale: smallS() });
    });
    // Pobite rekordy bohatera (porównanie z zapisem sprzed runu).
    const broke: string[] = [];
    if (run.totalTime > before.bestTime && before.bestTime > 0) broke.push(`Longest run: ${fmtTime(run.totalTime)}`);
    if (run.kills > before.bestKills && before.bestKills > 0) broke.push(`Most kills: ${fmt(run.kills)}`);
    if (run.level > before.bestLevel && before.bestLevel > 0) broke.push(`Highest level: ${run.level}`);
    if (this.mode === 'endless' && run.totalTime > before.bestEndless && before.bestEndless > 0) broke.push(`Endless: ${fmtTime(run.totalTime)}`);
    if (ex && ex.cleared > before.bestExpedition && before.bestExpedition > 0) broke.push(`Expedition: ${ex.cleared} maps`);
    for (const c of cards) if (c.rec && (c.title === 'Peak DPS' ? (before.bestDps ?? 0) : c.title === 'Longest combo' ? (before.bestCombo ?? 0) : (before.bestStreak ?? 0)) > 0) broke.push(`${c.title}: ${c.value}`);
    const ly = y + ch + 5, room = Math.max(0, Math.floor((this.endY + this.endH - ly - 13) / 10)) * 2;
    // Pierwszy run bohatera: plakietki „Record!” bez wcześniejszych rekordów — zamiast sprzecznego „bez rekordów” (playtest).
    const first = !broke.length && cards.some((c) => c.rec);
    drawText(g, broke.length ? 'Records broken' : first ? 'Your first records! Beat them next time.' : 'No records broken this time', END_X + 12, ly, broke.length || first ? C.gold : C.lavender);
    if (broke.length > room) broke.splice(room - 1, broke.length, `+${broke.length - room + 1} more`);
    broke.forEach((t, i) => {
      const bx = END_X + 16 + (i % 2) * (END_W / 2 - 10), by = ly + 11 + Math.floor(i / 2) * 10;
      drawText(g, '-', bx, by, C.gold);
      drawText(g, t, bx + 6, by, C.yellow);
    });
  }

  /** Ekran końca: obrażenia per źródło (suma, udział i DPS, pasek udziału). */
  private renderDamage(): void {
    const r = this.app.r, g = r.g, run = this.run, x0 = END_X + 12, x1 = END_X + END_W - 12;
    drawText(g, 'Źródło obrażeń', x0, this.endY + 6, C.lavender);
    drawText(g, 'Suma', x1 - 110, this.endY + 6, C.lavender, { align: 'right' });
    drawText(g, 'Udział', x1 - 55, this.endY + 6, C.lavender, { align: 'right' });
    drawText(g, 'DPS', x1, this.endY + 6, C.lavender, { align: 'right' });
    const all = [...run.dmgBySource.entries()].sort((a, b) => b[1] - a[1]);
    const total = all.reduce((sum, x) => sum + x[1], 0) || 1, best = all[0]?.[1] || 1;
    all.slice(0, 7).forEach(([name, dmg], i) => {
      const y = this.endY + 19 + i * 11;
      bar(r, x0 + 120, y + 2, 140, 5, dmg / best, RAMP.gold);
      drawText(g, name, x0, y, C.white);
      drawText(g, fmt(dmg), x1 - 110, y, C.gold, { align: 'right' });
      drawText(g, `${Math.round((100 * dmg) / total)}%`, x1 - 55, y, C.lgray, { align: 'right' });
      drawText(g, fmt(dmg / Math.max(1, run.totalTime)), x1, y, C.lgray, { align: 'right' });
    });
    if (all.length > 7) drawText(g, `+${all.length - 7} więcej`, x1, this.endY + this.endH - 10, C.lavender, { align: 'right', scale: smallS() });
  }

  /** Ekran końca: wykres DPS w czasie (pomiar co BAL.dpsEvery s). */
  private renderDpsGraph(): void {
    const r = this.app.r, g = r.g, log = this.run.dpsLog;
    if (log.length < 2) { drawText(g, 'Za krótki run na wykres.', W / 2, this.endY + this.endH / 2 - 5, C.lavender, { align: 'center' }); return; }
    const x0 = END_X + 16, x1 = END_X + END_W - 12, y0 = this.endY + 18, y1 = this.endY + this.endH - 14, max = Math.max(1, ...log);
    const avg = log.reduce((a, b) => a + b, 0) / log.length;
    drawText(g, `Najwyżej ${fmt(Math.round(max))} DPS`, x0, this.endY + 5, C.gold);
    drawText(g, `Średnio ${fmt(avg)} DPS`, x1, this.endY + 5, C.lgray, { align: 'right' });
    r.rect(x0, y1, x1 - x0, 1, C.slate);
    r.rect(x0, y0, 1, y1 - y0, C.slate);
    const ay = y1 - ((y1 - y0) * avg) / max;
    for (let x = x0; x < x1; x += 4) r.rect(x, ay, 2, 1, C.dgray);
    const px = (i: number) => x0 + ((x1 - x0) * i) / (log.length - 1), py = (v: number) => y1 - ((y1 - y0) * v) / max;
    r.withAlpha(0.3, () => { for (let i = 0; i < log.length; i++) r.rect(px(i) - 1, py(log[i]), 2, y1 - py(log[i]), C.dblue); });
    for (let i = 1; i < log.length; i++) r.line(px(i - 1), py(log[i - 1]), px(i), py(log[i]), C.gold);
    drawText(g, '0:00', x0, y1 + 2, C.lavender, { scale: smallS() });
    drawText(g, fmtTime(log.length * BAL.dpsEvery), x1, y1 + 2, C.lavender, { align: 'right', scale: smallS() });
  }

  /** Ekran końca: karta buildu (bohater, bronie, pasywki, przedmioty, karty, sekrety i moc bossa). */
  private renderBuild(): void {
    const r = this.app.r, g = r.g, run = this.run, x0 = END_X + 12, top = this.endY + 6;
    drawSprite(g, `${run.heroSprite}@0`, x0 + 12, top + 14, { scale: 2 });
    drawText(g, run.hero.name, x0 + 32, top, run.hero.color, { scale: 2, shadow: C.black });
    drawText(g, `${run.hero.role}   poziom postaci ${run.level}${run.pactLevel ? `   Pakt ${run.pactLevel}` : ''}`, x0 + 32, top + 18, C.lavender, { scale: smallS() });
    // Przedmioty (8 slotów) po prawej.
    SLOTS.forEach((sl, i) => drawItemSlot(r, run.equipment[sl.id], END_X + END_W - 12 - (4 - (i % 4)) * 20, top + Math.floor(i / 4) * 20, 18, false));
    // Bronie i pasywki z poziomami.
    let x = x0;
    const wy = top + 42;
    for (const w of run.weapons) {
      slot(r, x, wy, 18, w.def.evolved ? C.gold : C.slate);
      drawSprite(g, WEAPON_BY_ID[w.def.id].icon, x + 9, wy + 9);
      drawText(g, w.def.evolved ? '*' : String(w.level), x + 17, wy + 9, C.white, { align: 'right', outline: C.black, scale: smallS() });
      x += 20;
    }
    x += 8;
    for (const p of run.passives) {
      slot(r, x, wy, 18);
      drawSprite(g, passiveIcon(p), x + 9, wy + 9);
      drawText(g, String(p.level), x + 17, wy + 9, C.white, { align: 'right', outline: C.black, scale: smallS() });
      x += 20;
    }
    // Karty (jeden rząd).
    const per = Math.floor((END_W - 24) / 17);
    run.cards.slice(0, per).forEach((c, i) => {
      const cx = x0 + i * 17, cy = wy + 22;
      const def = CARD_BY_ID[c.id];
      drawSprite(g, def.icon!, cx + 8, cy + 8);
      if (c.stacks > 1) drawText(g, String(c.stacks), cx + 14, cy + 9, C.white, { outline: C.black, scale: smallS() });
    });
    const extra = [
      ...[...run.secrets].map((id) => SECRET_BY_ID[id]?.name).filter(Boolean),
      run.power ? `Moc: ${BOSS_POWER_BY_ID[run.power.id].name} ${run.power.level}` : '',
    ].filter(Boolean).join(', ');
    if (extra) drawText(g, extra, x0, this.endY + this.endH - 11, C.hotpink, { scale: smallS() });
  }
}

/**
 * Miejsce podpowiedzi w każdej nakładce: wolny pas pod przyciskami albo obok nich, tak żeby nie zasłaniała tytułu,
 * legendy ani przycisków (podpis z klawiszami pod spodem może przykryć, podpowiedź mówi to samo).
 */
const HINT_BOX: Partial<Record<string, HintBox>> = {
  levelup: { x: 10, y: 232, w: W - 20 },
  cards: { x: 10, y: 232, w: W - 20 },
  power: { x: 10, y: 222, w: W - 20 },
  loot: { x: 8, y: 207, w: 128 },
  map: { x: 14, y: H - 8, w: 240, up: true },
  shop: { x: 6, y: 232, w: 266, up: true },
  anvil: { x: 10, y: 181, w: 208, up: true },
};

/** Zakładki ekranu końca runu i panel pod nimi. */
const END_TABS = ['Highlights', 'Obrażenia', 'Wykres DPS', 'Build'];
const END_X = 12, END_W = W - 24, END_BOTTOM = 210;
