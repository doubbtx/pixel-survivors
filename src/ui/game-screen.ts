import { W, H } from '../core/renderer';
import { C } from '../core/palette';
import { drawText, wrapText } from '../core/font';
import { sfx } from '../core/audio';
import { heroRecord } from '../core/save';
import { drawSprite } from '../gfx/sprites';
import { PASSIVE_BY_ID } from '../data/passives';
import { CARD_BY_ID } from '../data/cards';
import { BAL } from '../data/balance';
import { levelDef, objectiveLabel, BIOME_CYCLE } from '../data/levels';
import { Run, type Mode, type RunSnapshot, type SlotMode } from '../game/run';
import { renderWorld, warmFx } from '../game/render';
import { endSlotRun } from '../game/campaign';
import { fmt, fmtTime } from '../util/format';
import type { App, Screen } from './app';
import { Menu, dim, panel, inside } from './widgets';
import { renderHud } from './hud';
import { LevelUpView } from './levelup';
import { LootView, InventoryView, drawItemSlot } from './items';
import { SLOTS } from '../data/items';
import { CardPickView, rarityColor } from './cards';
import { ShopView } from './shop';
import { SynergyView } from './synergies';
import { AnvilView } from './anvil';
import { rollShop } from '../data/shop';
import { metaBonus, runEssence, heroMeta, heroTree, NO_META } from '../data/meta';
import { rollItem } from '../data/items';
import { NODE_INFO, EX_BLESSINGS, advanceAct, currentMap, currentNode, isCombat, mapReward, newExpedition, nodeDepth } from '../data/expedition';
import { rng } from '../core/rng';
import { music } from '../core/music';
import { ExpeditionMapView } from './expedition';
import { Hints } from './hints';
import { HelpScreen } from './help';
import { AUGMENT_BY_ID, weaponBase } from '../data/augments';
import { bonusLines } from '../data/upgrades';
import { MainMenu, HeroSelect, SettingsScreen } from './menus';
import { PowerPickView } from './powers';
import { ACHIEVEMENTS } from '../data/achievements';
import { heroSkins } from '../data/pacts';
import { FEAT_BY_ID } from '../data/feats';
import { featsOnWin } from '../systems/feats';
import { BESTIARY_BY_ID, loreBonus, loreMuls } from '../data/bestiary';
import type { DailyDef } from '../data/daily';
import { BOSS_POWER_BY_ID } from '../data/enemies';
import { WEAPON_BY_ID } from '../data/weapons';
import { SECRET_BY_ID } from '../data/secrets';

type State = 'play' | 'levelup' | 'cards' | 'power' | 'loot' | 'inventory' | 'shop' | 'anvil' | 'synergies' | 'pause' | 'cleared' | 'map' | 'end';

/** Krótka blokada wejścia po otwarciu nakładki — żeby wciśnięty akurat klawisz nie wybrał karty. */
const OVERLAY_DELAY = 0.3;

/**
 * Ekran rozgrywki: run + nakładki (awans, karta, skrzynia, pauza, ukończenie poziomu, mapa Ekspedycji, koniec runu).
 * Trening: jeden poziom bez zapisu. Hardcore: poziomy po kolei, sklep między nimi. Endless: jeden poziom bez końca.
 * Ekspedycja: mapa węzłów (walki, sklepy, kowadła, obozy, skarby) przez 3 akty.
 * Tryby poza treningiem mają własny slot zapisu: wyjście z gry wznawia run, śmierć albo poddanie kasuje slot.
 */
export class GameScreen implements Screen {
  private run: Run;
  private state: State = 'play';
  private levelUp: LevelUpView | null = null;
  private cardPick: CardPickView | null = null;
  private powerPick: PowerPickView | null = null;
  private loot: LootView | null = null;
  private inventory: InventoryView | null = null;
  private shop: ShopView | null = null;
  private synergies: SynergyView | null = null;
  private anvil: AnvilView | null = null;
  private map: ExpeditionMapView | null = null;
  /** Stan, do którego wraca kowadło (ekran ukończenia, sklep albo mapa). */
  private anvilReturn: State = 'cleared';
  /** Stan po zamknięciu sklepu (ekran ukończenia albo mapa) i po nakładkach nagród i pauzie (gra albo mapa). */
  private shopReturn: State = 'cleared';
  private overlayReturn: State = 'play';
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
  private hints: Hints;
  /** Czy ultimate był gotowy w poprzedniej klatce (komunikat „R gotowe!” przy zmianie). */
  private ultReady = false;
  private pauseMenu: Menu;
  private clearedMenu: Menu;
  private endMenu: Menu;
  /** Zakładka ekranu końca: obrażenia, wykres DPS, karta buildu. */
  private endPage = 0;

  constructor(private readonly app: App, private readonly heroId: string, private readonly mode: Mode, snapshot?: RunSnapshot, opts: GameOpts = {}) {
    const { daily, rush, quick } = opts;
    // Wyzwanie dnia: to samo ziarno losowania dla wszystkich tego dnia.
    if (daily) rng.seed(daily.seed);
    this.run = snapshot ? Run.fromSnapshot(snapshot) : new Run(heroId, mode);
    // Nowy run: pakty ryzyka wybrane przed startem (ui/pacts.ts) obowiązują do jego końca; wyzwanie dnia ma własne.
    if (!snapshot) this.run.pacts = { ...(daily ? daily.pacts : app.save.pacts.chosen) };
    if (daily) {
      this.run.daily = true;
      const d = app.save.daily;
      if (d.date !== daily.date) app.save.daily = { date: daily.date, best: 0, tries: 0 };
      app.save.daily.tries++;
      app.persist();
    }
    // Głowy bossów: poziom od nowa z krótką rozgrzewką i kilka awansów na start.
    if (rush) {
      this.run.rush = true;
      this.run.startLevel(1);
      for (let i = 0; i < BAL.rush.startLevels; i++) this.run.addXp(this.run.xpNext - this.run.xp);
    }
    if (quick) { this.run.quick = true; this.run.startLevel(1); }
    this.run.unlocked = new Set(app.save.achievements);
    // Skórka za odznakę Paktu (tylko jeśli nadal zdobyta).
    const skin = app.save.skins[heroId] ?? '';
    this.run.skin = heroSkins(app.save.pacts.best[heroId] ?? 0).some((b) => b.id === skin) ? skin : '';
    this.run.lore = loreMuls(app.save.bestiary);
    this.hints = new Hints(app.save, () => app.persist());
    this.run.cardBans = new Set(app.save.collection.banned);
    this.run.knownCards = new Set(app.save.collection.seen);
    // Rozwój działa tylko w Ekspedycji (Hardcore i Endless bez meta-bonusów).
    this.run.applyMeta(mode === 'expedition' ? metaBonus(heroMeta(app.save.meta, heroId), heroTree(heroId)) : NO_META, !snapshot);
    warmFx();
    const hc = mode === 'hardcore';
    const slotted = mode !== 'training';
    // Poddanie z potwierdzeniem tam, gdzie przepada dłuższy postęp (Hardcore, Ekspedycja).
    const confirm = hc || mode === 'expedition';
    this.pauseMenu = new Menu([
      { label: () => 'Wznów', act: () => (this.state = this.overlayReturn) },
      { label: () => 'Ekwipunek', act: () => this.openInventory('pause') },
      { label: () => 'Synergie', act: () => { this.synergies = new SynergyView(this.run); this.state = 'synergies'; this.delay = 0.1; } },
      { label: () => 'Pomoc', act: () => app.go(new HelpScreen(app, this)) },
      { label: () => 'Ustawienia', act: () => app.go(new SettingsScreen(app, this)) },
      ...(slotted ? [{ label: () => 'Zapisz i wyjdź', act: () => { this.saveSlot(this.overlayReturn === 'play'); app.go(new MainMenu(app)); } }] : []),
      {
        label: () => (confirm ? (this.confirmQuit ? 'Na pewno? Run przepadnie' : 'Poddaj run') : 'Zakończ run'),
        act: () => {
          if (confirm && !this.confirmQuit) { this.confirmQuit = true; return; }
          this.onRunOver();
        },
      },
    ], 104, 96, 180, 15);
    this.clearedMenu = new Menu([
      { label: () => `Dalej: poziom ${this.run.depth + 1}`, act: () => this.nextLevel() },
      { label: () => `Sklep (${fmt(this.run.gold)} zł)`, act: () => this.openShop('cleared') },
      { label: () => `Kowadło (${this.run.shards} odł.)`, act: () => this.openAnvil('cleared') },
      { label: () => 'Zapisz i wyjdź do menu', act: () => app.go(new MainMenu(app)) },
    ], W / 2, 194, 240, 16);
    this.endMenu = new Menu(daily || rush || quick ? [
      { label: () => 'Spróbuj ponownie', act: () => app.go(new GameScreen(app, heroId, mode, undefined, opts)) },
      { label: () => 'Menu główne', act: () => app.go(new MainMenu(app)) },
    ] : hc || mode === 'expedition' ? [
      { label: () => (hc ? 'Nowa kampania' : 'Nowa ekspedycja'), act: () => app.go(new HeroSelect(app, mode)) },
      { label: () => 'Menu główne', act: () => app.go(new MainMenu(app)) },
    ] : [
      { label: () => 'Zagraj ponownie', act: () => app.go(new GameScreen(app, heroId, mode)) },
      { label: () => 'Wybór bohatera', act: () => app.go(new HeroSelect(app, mode)) },
      { label: () => 'Menu główne', act: () => app.go(new MainMenu(app)) },
    ], W / 2, 210, 200, 17);
    if (mode === 'expedition' && !snapshot) {
      this.run.expedition = newExpedition();
      this.openMap();
    } else if (mode === 'expedition' && !snapshot!.inProgress) {
      // Zapis z mapy: sklep, w którym gracz wyszedł, albo mapa.
      if (this.run.shop) this.openShop('map');
      else this.openMap();
    } else if (hc && snapshot && !snapshot.inProgress) {
      this.resumed = true;
      if (this.run.shop) this.openShop('cleared');
      else this.beginLevel();
    } else if (slotted) {
      this.saveSlot(true);
    }
  }

  /**
   * Zapis slotu trybu. `inProgress` = trwa poziom (wznowienie od zapisanego postępu);
   * inaczej Hardcore zapisuje następny poziom, a Ekspedycja pozycję na mapie.
   */
  private saveSlot(inProgress: boolean): void {
    if (this.mode === 'training') return;
    const run = this.run;
    this.syncCollection();
    const next = inProgress || this.resumed || this.mode !== 'hardcore' ? run.depth : run.depth + 1;
    this.app.save.slots[this.mode as SlotMode] = run.toSnapshot(next, inProgress);
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

  private updateRecords(won: boolean): void {
    const run = this.run;
    this.syncCollection();
    const rec = heroRecord(this.app.save, this.heroId);
    rec.bestTime = Math.max(rec.bestTime, run.totalTime);
    rec.bestKills = Math.max(rec.bestKills, run.kills);
    rec.bestLevel = Math.max(rec.bestLevel, run.level);
    // Odznaki Paktu: najwyższy poziom Paktu, z którym bohater pokonał bossa.
    const pacts = this.app.save.pacts.best;
    if (run.bossKills > 0 && !run.easy) pacts[this.heroId] = Math.max(pacts[this.heroId] ?? 0, run.pactLevel);
    if (this.mode === 'hardcore') rec.bestDepth = Math.max(rec.bestDepth, run.depth);
    else if (this.mode === 'endless') rec.bestEndless = Math.max(rec.bestEndless, run.totalTime);
    else if (this.mode === 'expedition') rec.bestExpedition = Math.max(rec.bestExpedition, run.expedition!.cleared);
    else { rec.runs++; if (won) rec.wins++; }
  }

  /** Esencja za zakończoną Ekspedycję (Rozwój bohatera) — dodawana do zapisu, pokazywana na ekranie końca. Inne tryby jej nie dają. */
  private awardEssence(mul = 1): void {
    if (this.mode !== 'expedition') return;
    const h = heroMeta(this.app.save.meta, this.heroId);
    const ex = this.run.expedition;
    // Modyfikatory ukończonych map podnoszą esencję (BAL.expedition.rewardEssence na punkt nagrody).
    const mapMul = 1 + (ex?.bonus ?? 0) * BAL.expedition.rewardEssence / 100;
    this.essence = runEssence(this.run, ex?.cleared ?? 0, this.run.essenceMul * mul * mapMul);
    h.essence += this.essence;
    h.total += this.essence;
  }

  /** Śmierć albo poddanie: slot trybu czyszczony (Hardcore: wpis do tablicy). Esencja zostaje. */
  private onRunOver(): void {
    this.updateRecords(false);
    this.awardEssence();
    this.endSlot();
    this.app.persist();
    this.state = 'end';
  }

  private endSlot(): void {
    const run = this.run;
    if (this.mode !== 'training') endSlotRun(this.app.save, this.mode, { hero: this.heroId, depth: run.depth, totalTime: run.totalTime, kills: run.kills, level: run.level, expedition: run.expedition ?? undefined });
  }

  /**
   * Poziom ukończony. Trening kończy się zwycięstwem; Hardcore zapisuje postęp i proponuje kolejny poziom;
   * Ekspedycja wraca na mapę (po bossie: następny akt albo koniec wyprawy).
   */
  private onLevelCleared(): void {
    const run = this.run;
    if (this.mode === 'expedition') {
      const ex = run.expedition!, m = currentMap(ex)!;
      ex.cleared++;
      ex.bonus += mapReward(m);
      if (m.kind === 'secret' && !ex.voidKey) { ex.voidKey = true; this.showToast('Klucz Pustki! Po ostatnim akcie otworzy się akt 4'); }
      if (ex.blessing && --ex.blessing.maps <= 0) ex.blessing = null;
      this.updateRecords(true);
      if (m.kind === 'boss') {
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
    // Bez skazy: wygrany run (tryby treningowe) albo 3 poziomy Hardcore bez trafienia.
    if (this.mode === 'training' || (this.mode === 'hardcore' && run.depth >= 3)) featsOnWin(run);
    this.updateRecords(true);
    if (this.mode === 'training') {
      // Wyzwanie dnia: najlepszy czas pokonania bossa.
      const d = this.app.save.daily;
      if (run.daily && (d.best === 0 || run.time < d.best)) { d.best = run.time; this.showToast('Nowy rekord dnia!'); }
      const s = this.app.save;
      if (run.rush && (s.rushBest === 0 || run.time < s.rushBest)) s.rushBest = run.time;
      this.awardEssence();
      this.app.persist();
      this.state = 'end';
      return;
    }
    run.shop = rollShop(run, run.depth + 1);
    this.saveSlot(false);
    this.state = 'cleared';
    this.clearedMenu.sel = 0;
  }

  /** Ostatni boss pokonany: wyprawa ukończona — rekord, więcej esencji, slot czyszczony. */
  private onExpeditionWon(): void {
    heroRecord(this.app.save, this.heroId).expeditionWins++;
    const X = BAL.expedition;
    this.awardEssence(X.winEssenceMul * (this.run.expedition!.act > X.acts ? X.voidEssenceMul : 1));
    this.endSlot();
    this.app.persist();
    this.state = 'end';
  }

  private showToast(text: string): void {
    this.toast = text;
    this.toastT = 2.5;
  }

  /** Mapa Ekspedycji między węzłami (zapis pozycji). */
  private openMap(): void {
    this.hints.show('map');
    this.map ??= new ExpeditionMapView(this.run);
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
        run.pendingLoot.push({ source: 'boss', item: rollItem(run.depth, 'boss', run.flag('itemLuck') + X.treasureLuck) });
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
        this.showToast(`${NODE_INFO.rest.name}: +${Math.round(X.restHeal * 100)}% HP, +${X.restMaxHp} maks. HP`);
        this.saveSlot(false);
        break;
      case 'shrine': {
        const b = rng.pick(EX_BLESSINGS);
        ex.blessing = { id: b.id, maps: X.blessingMaps };
        this.showToast(`Kapliczka: ${b.name} (${b.desc}) na ${X.blessingMaps} mapy`);
        this.saveSlot(false);
        break;
      }
    }
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
    this.saveSlot(true);
    this.state = 'play';
    sfx.play('levelup');
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
    const label = from === 'map' ? 'Do mapy' : this.resumed ? 'Do walki' : 'Wróć';
    this.shop = new ShopView(this.run, () => this.saveSlot(false), label);
    this.shopReturn = from;
    this.state = 'shop';
    this.delay = 0.1;
  }

  private openPause(): void {
    this.state = 'pause';
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
  private openPending(): boolean {
    const run = this.run;
    if (run.pendingLoot.length > 0) {
      this.loot = new LootView(run, run.pendingLoot.shift()!);
      this.state = 'loot';
      this.hints.show('loot');
      if (this.loot.item.unique) this.hints.show('unique');
    } else if (run.pendingLevels > 0) {
      this.levelUp = new LevelUpView(run);
      this.state = 'levelup';
      this.hints.show('levelup');
      if (this.levelUp.options.some((o) => o.kind === 'augment')) this.hints.show('augment');
      if (this.levelUp.options.some((o) => o.kind === 'fusion')) this.hints.show('fusion');
    } else if (run.pendingCards.length > 0) {
      this.cardPick = new CardPickView(run, run.pendingCards.shift()!);
      this.state = 'cards';
      this.hints.show('cards');
    } else if (run.pendingPowers > 0) {
      run.pendingPowers--;
      this.powerPick = new PowerPickView(run);
      this.state = 'power';
      this.hints.show('power');
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
    run.playerFx = set.playerFx;
    run.elemShapes = set.elemShapes;
    run.bgDim = set.bgDim;
    run.bulletOutline = set.bulletOutline;
    run.playerMarker = set.playerMarker;
    if (run.easy !== set.easy) { run.easy = set.easy; run.onBuildChanged(); }
    if (inp.pressed('debug')) {
      set.debug = !set.debug;
      this.app.persist();
    }
    this.hints.update(dt);
    // Muzyka: intensywność z liczby wrogów, lochu i wydarzenia; boss na pełno; poza walką ciszej.
    const fight = this.state === 'play' && run.outcome === 'none';
    const crowd = Math.min(1, run.enemies.count / BAL.musicCrowd) * 0.8 + (run.dungeon || run.levelEvent ? 0.2 : 0);
    music.setMood({ intensity: fight ? crowd : 0.08, biome: run.levelInfo.biome, boss: fight && !!run.boss });
    if (this.delay > 0) { this.delay -= dt; return; }

    switch (this.state) {
      case 'play':
        if ((inp.pressed('pause') || (set.autoPause && inp.focusLost)) && run.outcome === 'none') { this.openPause(); return; }
        if (inp.pressed('inventory') && run.outcome === 'none') { this.openInventory('play'); return; }
        this.toastT = Math.max(0, this.toastT - dt);
        // Zatrzymanie klatki po mocnym trafieniu / zabiciu elity: symulacja stoi przez chwilę (można wyłączyć w Ustawieniach).
        if (run.hitstop > 0 && !set.hitstop) run.hitstop = 0;
        if (run.hitstop > 0) { run.hitstop -= dt; break; }
        this.gameplayHints();
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
        if (this.levelUp!.update(inp)) {
          run.pendingLevels--;
          this.state = this.overlayReturn;
          this.openPending();
        }
        break;
      case 'cards':
        if (this.cardPick!.update(inp)) {
          this.state = this.overlayReturn;
          this.openPending();
        }
        break;
      case 'power':
        if (this.powerPick!.update(inp)) {
          this.state = this.overlayReturn;
          this.openPending();
        }
        break;
      case 'loot': {
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
        if (this.synergies!.update(inp)) { this.state = 'pause'; this.delay = 0.1; }
        break;
      case 'shop': {
        const act = this.shop!.update(inp, dt);
        if (act === 'inventory') this.openInventory('shop');
        else if (act === 'anvil') this.openAnvil('shop');
        else if (act === 'close' && this.shopReturn === 'map') { this.run.shop = null; this.openMap(); }
        else if (act === 'close' && this.resumed) this.beginLevel();
        else if (act === 'close') { this.state = 'cleared'; this.delay = 0.1; }
        break;
      }
      case 'map': {
        this.toastT = Math.max(0, this.toastT - dt);
        const act = this.map!.update(inp);
        if (act === 'menu') this.openPause();
        else if (act === 'inventory') this.openInventory('map');
        else if (act) this.enterNode(act.pick);
        break;
      }
      case 'pause':
        if (inp.pressed('pause')) { this.state = this.overlayReturn; return; }
        this.pauseMenu.update(inp);
        break;
      case 'cleared':
        this.clearedMenu.update(inp);
        break;
      case 'end':
        this.endMenu.update(inp);
        if (inp.pressed('inventory') || inp.pressed('left') || inp.pressed('right')) {
          this.endPage = (this.endPage + (inp.pressed('left') ? 2 : 1)) % 3;
          sfx.play('select');
        }
        END_TABS.forEach((_, i) => { if (inp.pressed('click') && inside(inp.mouse.x, inp.mouse.y, 50 + i * 128, 62, 124, 14)) this.endPage = i; });
        break;
    }
  }

  render(): void {
    const r = this.app.r;
    const run = this.run;
    renderWorld(run, r);
    const between = this.state === 'cleared' || this.state === 'shop' || this.state === 'anvil' || this.state === 'map' || this.overlayReturn === 'map'
      || (this.state === 'inventory' && (this.invReturn === 'shop' || this.invReturn === 'map'));
    if (this.state !== 'end' && !between) renderHud(run, r, this.app.loop, this.app.save.settings.debug, this.app.save.settings.minimap, this.app.input);
    switch (this.state) {
      case 'levelup':
        this.levelUp!.render(r);
        break;
      case 'cards':
        this.cardPick!.render(r);
        break;
      case 'power':
        this.powerPick!.render(r);
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
      case 'map':
        this.map!.render(r);
        if (this.toastT > 0) drawText(r.g, this.toast, W / 2, H - 14, C.lime, { align: 'center', outline: C.black });
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
    if (this.state !== 'pause' && this.state !== 'end') this.hints.render(r, this.state !== 'play');
  }

  private renderPause(): void {
    const r = this.app.r, g = r.g, run = this.run, s = run.stats;
    dim(r);
    drawText(g, 'Pauza', 104, 64, C.yellow, { align: 'center', scale: 3, outline: C.black });
    if (this.mode === 'hardcore' || this.mode === 'expedition') {
      drawText(g, `${this.mode === 'hardcore' ? 'Hardcore' : 'Ekspedycja'}: poddanie`, 104, 214, C.salmon, { align: 'center', shadow: C.black });
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
      // Augmenty broni: turkusowe kropki nad ikoną.
      const augs = run.augments.filter((id) => AUGMENT_BY_ID[id].weapon === weaponBase(w.def)).length;
      for (let k = 0; k < augs; k++) r.rect(x + k * 4, y - 3, 3, 2, C.cyan);
      // Zebrane bonusy jakości ulepszeń (najwyżej 2 linie, reszta jako +N).
      const lines = bonusLines(w.bonus, true);
      lines.slice(0, 2).forEach((l, k) => drawText(g, l, x - 1, y + 26 + k * 9, C.lgray));
      if (lines.length > 2) drawText(g, `+${lines.length - 2}`, x - 1, y + 44, C.dgray);
    });
    drawText(g, 'DPS', px + pw - 10, 92, C.dgray, { align: 'right' });
    run.passives.forEach((p, i) => {
      const x = px + 10 + i * 19, y = 128;
      drawSprite(g, PASSIVE_BY_ID[p.id].icon, x + 7, y + 7);
      drawText(g, String(p.level), x + 16, y + 6, C.white, { align: 'right', outline: C.black });
    });
    // Założony ekwipunek (szczegóły: ekran Ekwipunek).
    SLOTS.forEach((s, i) => drawItemSlot(r, run.equipment[s.id], px + 10 + i * 21, 148, 20, false));
    drawText(g, '[I] ekwipunek', px + pw - 10, 153, C.dgray, { align: 'right' });
    drawText(g, `Karty (${run.cards.reduce((n, c) => n + c.stacks, 0)})    losowania kart: ${run.cardRerolls}`, px + 10, 172, C.lavender);
    run.cards.slice(0, 14).forEach((c, i) => {
      const def = CARD_BY_ID[c.id];
      const x = px + 10 + (i % 2) * 128, y = 185 + Math.floor(i / 2) * 10;
      drawText(g, `${def.name}${c.stacks > 1 ? ' x' + c.stacks : ''}`, x, y, def.cursed ? C.hotpink : rarityColor(def.rarity, 0));
    });
    if (run.cards.length > 14) drawText(g, `+${run.cards.length - 14} więcej`, px + pw - 10, 172, C.dgray, { align: 'right' });
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
    if (run.featsLevel.length) drawText(g, `Wyczyny: ${run.featsLevel.map((id) => FEAT_BY_ID[id].name).join(', ')}`, 94, 128, C.gold);
    drawText(g, `Dalej: ${next.name}`, 94, 140, C.white);
    drawText(g, `Cel: ${objectiveLabel(next.objective)}, potem ${next.bossName}`, 94, 152, C.lavender);
    drawText(g, `Postęp zapisany. Na start +${Math.round(BAL.levelClearHeal * 100)}% HP.`, 94, 166, C.dgray);
    this.clearedMenu.render(r);
  }

  private renderEnd(): void {
    const r = this.app.r, g = r.g, run = this.run;
    dim(r);
    const ex = run.expedition;
    // Ekspedycja: zwycięstwo tylko po ostatnim bossie (wcześniejsze zwycięstwa wracają na mapę).
    const won = run.outcome === 'victory' && run.mode !== 'expedition' || (!!ex && run.outcome === 'victory' && ex.act >= BAL.expedition.acts && currentNode(ex) === 'boss');
    const title = won ? (ex ? 'Ekspedycja ukończona!' : 'Zwycięstwo!') : run.outcome === 'dead' ? 'Zginąłeś' : 'Koniec runu';
    drawText(g, title, W / 2, 6, won ? C.yellow : C.salmon, { align: 'center', scale: 2, outline: C.black });
    const stats = `Czas ${fmtTime(run.totalTime)}    Zabójstwa ${fmt(run.kills)}    LV ${run.level}    Złoto ${fmt(run.gold)}    Leczenie ${fmt(run.healed)}${run.pactLevel ? `    Pakt ${run.pactLevel}` : ''}`;
    const modeLine = this.mode === 'hardcore' ? `Hardcore: przepadło wszystko. Dotarłeś do poziomu ${run.depth}.`
      : this.mode === 'endless' ? `Endless: przetrwałeś ${fmtTime(run.totalTime)}, głębia ${run.depth} (rekord ${fmtTime(heroRecord(this.app.save, this.heroId).bestEndless)})`
      : run.quick ? `Szybki run: ${won ? 'wszystkie poziomy ukończone' : `poziom ${run.depth}/${BAL.quick.levels}`}`
      : run.rush ? `Głowy bossów: ${won ? `wszystkie w ${fmtTime(run.time)}` : `zdobyte głowy ${run.bossKills}/${BIOME_CYCLE + 1}`}, rekord ${this.app.save.rushBest ? fmtTime(this.app.save.rushBest) : 'brak'}`
      : run.daily ? `Wyzwanie dnia ${this.app.save.daily.date}: ${won ? `boss pokonany w ${fmtTime(run.time)}` : 'boss niepokonany'}, najlepszy czas ${this.app.save.daily.best ? fmtTime(this.app.save.daily.best) : 'brak'}`
      : ex ? `Ekspedycja: akt ${ex.act}/${BAL.expedition.acts}, ukończone węzły ${ex.cleared}${won ? `, esencja x${BAL.expedition.winEssenceMul}` : ''}` : '';
    if (modeLine) drawText(g, modeLine, W / 2, 28, C.orange, { align: 'center', shadow: C.black });
    drawText(g, stats, W / 2, 39, C.white, { align: 'center', shadow: C.black });
    // Poza Ekspedycją zamiast informacji o esencji: wyczyny runu (jeśli są).
    const feats = [...new Set(run.featsRun)].map((id) => FEAT_BY_ID[id].name).join(', ');
    const essence = this.mode === 'expedition' ? `+${fmt(this.essence)} esencji dla: ${run.hero.name}   (Rozwój w menu głównym)`
      : feats ? `Wyczyny: ${feats}` : 'Bez esencji i Rozwoju: rekord uczciwy (esencja tylko w Ekspedycji)';
    drawText(g, essence, W / 2, 50, feats && this.mode !== 'expedition' ? C.gold : C.cyan, { align: 'center', shadow: C.black });
    // Zakładki: obrażenia, wykres DPS, karta buildu (Tab / strzałki / klik).
    END_TABS.forEach((t, i) => {
      panel(r, 50 + i * 128, 62, 124, 14, i === this.endPage ? C.gold : C.slate);
      drawText(g, t, 112 + i * 128, 63, i === this.endPage ? C.white : C.lgray, { align: 'center' });
    });
    panel(r, 50, 78, 380, 124);
    if (this.endPage === 0) this.renderDamage();
    else if (this.endPage === 1) this.renderDpsGraph();
    else this.renderBuild();
    this.endMenu.render(r);
  }

  /** Ekran końca: obrażenia per źródło (suma, DPS i pasek udziału). */
  private renderDamage(): void {
    const r = this.app.r, g = r.g, run = this.run;
    drawText(g, 'Źródło obrażeń', 62, 84, C.lavender);
    drawText(g, 'Suma', 340, 84, C.lavender, { align: 'right' });
    drawText(g, 'DPS', 418, 84, C.lavender, { align: 'right' });
    const rows = [...run.dmgBySource.entries()].sort((a, b) => b[1] - a[1]).slice(0, 9);
    const total = rows.reduce((sum, x) => sum + x[1], 0) || 1;
    rows.forEach(([name, dmg], i) => {
      const y = 96 + i * 11;
      r.rect(62, y + 9, Math.round(200 * (dmg / total)), 1, C.dblue);
      drawText(g, name, 62, y, C.white);
      drawText(g, fmt(dmg), 340, y, C.gold, { align: 'right' });
      drawText(g, fmt(dmg / Math.max(1, run.totalTime)), 418, y, C.lgray, { align: 'right' });
    });
  }

  /** Ekran końca: wykres DPS w czasie (pomiar co BAL.dpsEvery s). */
  private renderDpsGraph(): void {
    const r = this.app.r, g = r.g, log = this.run.dpsLog;
    if (log.length < 2) { drawText(g, 'Za krótki run na wykres.', 240, 130, C.dgray, { align: 'center' }); return; }
    const x0 = 66, x1 = 418, y0 = 96, y1 = 190, max = Math.max(1, ...log);
    const avg = log.reduce((a, b) => a + b, 0) / log.length;
    drawText(g, `Najwyżej ${fmt(max)} DPS`, 62, 83, C.gold);
    drawText(g, `Średnio ${fmt(avg)} DPS`, 418, 83, C.lgray, { align: 'right' });
    r.rect(x0, y1, x1 - x0, 1, C.slate);
    r.rect(x0, y0, 1, y1 - y0, C.slate);
    const ay = y1 - ((y1 - y0) * avg) / max;
    for (let x = x0; x < x1; x += 4) r.rect(x, ay, 2, 1, C.dgray);
    const px = (i: number) => x0 + ((x1 - x0) * i) / (log.length - 1), py = (v: number) => y1 - ((y1 - y0) * v) / max;
    r.withAlpha(0.3, () => { for (let i = 0; i < log.length; i++) r.rect(px(i) - 1, py(log[i]), 2, y1 - py(log[i]), C.dblue); });
    for (let i = 1; i < log.length; i++) r.line(px(i - 1), py(log[i - 1]), px(i), py(log[i]), C.gold);
    drawText(g, '0:00', x0, y1 + 2, C.dgray);
    drawText(g, fmtTime(log.length * BAL.dpsEvery), x1, y1 + 2, C.dgray, { align: 'right' });
  }

  /** Ekran końca: karta buildu (bohater, bronie, pasywki, przedmioty, karty, sekrety i moc bossa). */
  private renderBuild(): void {
    const r = this.app.r, g = r.g, run = this.run;
    drawSprite(g, `${run.heroSprite}@0`, 78, 104, { scale: 2 });
    drawText(g, run.hero.name, 100, 84, run.hero.color, { scale: 2, shadow: C.black });
    drawText(g, `${run.hero.role}   LV ${run.level}${run.pactLevel ? `   Pakt ${run.pactLevel}` : ''}`, 100, 102, C.lavender);
    // Przedmioty (8 slotów) po prawej.
    SLOTS.forEach((sl, i) => drawItemSlot(r, run.equipment[sl.id], 268 + (i % 4) * 38, 84 + Math.floor(i / 4) * 20, 18, false));
    // Bronie i pasywki z poziomami.
    let x = 62;
    for (const w of run.weapons) {
      drawSprite(g, WEAPON_BY_ID[w.def.id].icon, x + 8, 136);
      drawText(g, w.def.evolved ? 'E' : String(w.level), x + 17, 136, C.yellow);
      x += 26;
    }
    x += 6;
    for (const p of run.passives) {
      drawSprite(g, PASSIVE_BY_ID[p.id].icon, x + 8, 136);
      drawText(g, String(p.level), x + 17, 136, C.lgray);
      x += 24;
    }
    // Karty (do 2 rzędów).
    run.cards.slice(0, 40).forEach((c, i) => {
      const cx = 62 + (i % 20) * 18, cy = 148 + Math.floor(i / 20) * 17;
      const def = CARD_BY_ID[c.id];
      drawSprite(g, def.icon!, cx + 8, cy + 8);
      if (c.stacks > 1) drawText(g, String(c.stacks), cx + 13, cy + 9, C.white, { outline: C.black });
    });
    const extra = [
      run.featsRun.length ? `Wyczyny: ${[...new Set(run.featsRun)].map((id) => FEAT_BY_ID[id].name).join(', ')}` : '',
      ...[...run.secrets].map((id) => SECRET_BY_ID[id]?.name).filter(Boolean),
      run.power ? `Moc: ${BOSS_POWER_BY_ID[run.power.id].name} ${run.power.level}` : '',
    ].filter(Boolean).join(', ');
    wrapText(extra, 360).slice(0, 2).forEach((l, i) => drawText(g, l, 62, 183 + i * 9, C.hotpink));
  }
}

/** Opcje nowego runu (tryb 'training'): wyzwanie dnia (bohater, pakty, ziarno), Głowy bossów albo Szybki run. */
export interface GameOpts {
  daily?: DailyDef;
  rush?: boolean;
  quick?: boolean;
}

/** Zakładki ekranu końca runu. */
const END_TABS = ['Obrażenia', 'Wykres DPS', 'Build'];
