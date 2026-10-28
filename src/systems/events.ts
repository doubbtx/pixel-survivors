import { rng } from '../core/rng';
import { sfx } from '../core/audio';
import { C } from '../core/palette';
import { BAL } from '../data/balance';
import { rollItem, rollUnique } from '../data/items';
import type { Stats } from '../entities/types';
import type { Run } from '../game/run';
import { spawnEnemy } from './spawner';
import { grantMat } from './forge';
import { updateMapSecrets, touchSecret } from './mapsecrets';

/**
 * Zdarzenia mapy (sekrety i mini-lochy):
 *  kapliczka  — stań na niej BAL.events.shrineCharge s: losowe błogosławieństwo (czasowy bonus albo efekt),
 *  miecz      — ukryty daleko od startu (szansa raz na poziom): przedmiot Legendarny,
 *  portal     — wejście do mini-lochu: arena ze ścianami, fale wrogów, skarb i portal powrotny.
 * Złoty szlam (rzadki, uciekający wróg) jest w data/enemies.ts i spawnerze. Sekrety map (fontanna, runy, grzyby,
 * schody skarbca, kurhan, gaj) — systems/mapsecrets.ts; lochy mają rodzaje: portal, skarbiec (vault) i kurhan (barrow).
 */
export type MapObjectKind = 'shrine' | 'sword' | 'portal' | 'exit' | 'fountain' | 'rune' | 'mural' | 'mushroom' | 'stairs' | 'barrow' | 'grove';

export interface MapObject {
  kind: MapObjectKind;
  x: number;
  y: number;
  /** Kapliczka: rodzaj błogosławieństwa (indeks BLESSINGS) i postęp aktywacji. */
  blessing: number;
  charge: number;
  life: number;
  /** Malowidło run: kolejność kolorów. */
  order?: number[];
}

/** Rodzaj lochu: portal (fale), skarbiec spod pękniętej ściany (krótszy, lepszy łup), kurhan (Zapomniany Król). */
export type DungeonKind = 'portal' | 'vault' | 'barrow';

/** Czasowy bonus z kapliczki (liczony w recomputeStats). */
export interface Buff {
  name: string;
  stats: Partial<Stats>;
  t: number;
}

export interface Dungeon {
  /** Pozycja powrotu i środek areny (daleko od zwykłej mapy). */
  rx: number;
  ry: number;
  cx: number;
  cy: number;
  wave: number;
  cleared: boolean;
  kind: DungeonKind;
}

interface Blessing {
  name: string;
  desc: string;
  apply: (run: Run) => void;
}

const buff = (run: Run, name: string, stats: Partial<Stats>) => {
  run.buffs.push({ name, stats, t: BAL.events.buffTime });
  run.recomputeStats();
};

/** Błogosławieństwa kapliczek (kolejność = kolory kul w gfx/objects.ts). */
export const BLESSINGS: Blessing[] = [
  { name: 'Szał', desc: '+50% obrażeń na 20 s', apply: (run) => buff(run, 'Szał', { might: 0.5 }) },
  { name: 'Pośpiech', desc: '+50% szybkości ruchu i ataku na 20 s', apply: (run) => buff(run, 'Pośpiech', { speedBonus: 0.5, atkSpeed: 0.5 }) },
  { name: 'Odnowa', desc: 'Pełne leczenie', apply: (run) => run.heal(run.stats.maxHp) },
  {
    name: 'Bogactwo', desc: 'Wszystkie kryształy lecą do ciebie, +złoto',
    apply: (run) => { for (const g of run.gems.items) g.flying = true; run.gold += 25 * run.depth * run.stats.greed; },
  },
  { name: 'Tarcza', desc: 'Tarcza 40% HP', apply: (run) => run.addShield(run.stats.maxHp * 0.4, 0.5) },
];

function place(run: Run, kind: MapObjectKind, minR: number, maxR: number, life: number): MapObject {
  const a = rng.range(0, Math.PI * 2), d = rng.range(minR, maxR);
  const o: MapObject = { kind, x: run.player.x + Math.cos(a) * d, y: run.player.y + Math.sin(a) * d, blessing: rng.int(0, BLESSINGS.length - 1), charge: 0, life };
  run.mapObjects.push(o);
  return o;
}

/** Loch jako cały poziom (węzeł Ekspedycji): arena od razu, po oczyszczeniu poziom jest ukończony (bez portalu powrotnego). */
export function startDungeon(run: Run): void {
  enterDungeon(run, 'portal');
}

/** Wejście do lochu: świat zwykłej mapy odkładamy (kryształy i łupy zebrane), gracz trafia na arenę. */
export function enterDungeon(run: Run, kind: DungeonKind): void {
  const p = run.player;
  for (const g of run.gems.items) run.addXp(g.value);
  run.gems.clear();
  for (const it of run.pickups.items) {
    if (it.kind === 'coin') run.gold += it.value * run.stats.greed;
    if (it.kind === 'chest' && it.item) run.pendingLoot.push({ source: it.source, item: it.item });
  }
  run.pickups.clear();
  run.enemies.clear();
  run.bullets.clear();
  run.mapObjects = [];
  run.dungeon = { rx: p.x, ry: p.y, cx: p.x + 100000, cy: p.y, wave: 0, cleared: false, kind };
  p.x = run.dungeon.cx;
  p.y = run.dungeon.cy;
  p.iframes = 1;
  spawnWave(run);
  run.showBanner(kind === 'barrow' ? 'Kurhan: Zapomniany Król się budzi!' : kind === 'vault' ? 'Skarbiec! Pokonaj strażników' : `Loch! Pokonaj ${BAL.events.dungeonWaves} fale`);
  run.addShake(4);
  sfx.play('boss');
}

const WAVE_MIX = ['golem', 'cultist', 'eye', 'wisp', 'slime', 'bat'];

/** Liczba fal lochu wg rodzaju (kurhan: jedna — sam Król). */
const wavesOf = (d: Dungeon) => (d.kind === 'barrow' ? 1 : d.kind === 'vault' ? BAL.secretsMap.vaultWaves : BAL.events.dungeonWaves);

function spawnWave(run: Run): void {
  const d = run.dungeon!, E = BAL.events;
  if (d.kind === 'barrow') {
    // Zapomniany Król: boss z mocniejszym HP i własnym tytułem.
    const b = spawnEnemy(run, 'boss', d.cx, d.cy - E.arenaR * 0.5);
    if (b) b.maxHp = b.hp = b.maxHp * BAL.secretsMap.kingHp;
    run.bossTitle = 'Zapomniany Król';
    d.wave++;
    return;
  }
  const n = E.dungeonWaveSize + d.wave * 4;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    spawnEnemy(run, rng.pick(WAVE_MIX), d.cx + Math.cos(a) * E.arenaR * 0.8, d.cy + Math.sin(a) * E.arenaR * 0.8);
  }
  // Ostatnia fala: miniboss lochu z losowymi atakami (skarbiec: Strażnik skarbca, zwykły loch: Strażnik lochu),
  // HP skalowane siłą buildu słabiej, jak u bossa.
  if (d.wave === wavesOf(d) - 1) {
    const w = spawnEnemy(run, d.kind === 'vault' ? 'warden' : 'keeper', d.cx, d.cy - E.arenaR * 0.6, { elite: [] });
    if (w) w.maxHp = w.hp = w.maxHp * Math.pow(run.powerMul, BAL.bossPowerExp - 1);
  }
  d.wave++;
}

function exitDungeon(run: Run): void {
  const d = run.dungeon!, p = run.player;
  run.enemies.clear();
  run.bullets.clear();
  for (const it of run.pickups.items) {
    if (it.kind === 'coin') run.gold += it.value * run.stats.greed;
    if (it.kind === 'chest' && it.item) run.pendingLoot.push({ source: it.source, item: it.item });
  }
  run.pickups.clear();
  run.mapObjects = [];
  p.x = d.rx;
  p.y = d.ry;
  p.iframes = 1;
  run.dungeon = null;
  run.showBanner('Powrót z lochu');
}

/** Arena lochu: gracz i wrogowie nie wychodzą poza ściany. */
function clampArena(run: Run): void {
  const d = run.dungeon!, R = BAL.events.arenaR;
  const clamp = (o: { x: number; y: number }, r: number) => {
    const dx = o.x - d.cx, dy = o.y - d.cy, dist = Math.hypot(dx, dy);
    if (dist > R - r) { o.x = d.cx + (dx / dist) * (R - r); o.y = d.cy + (dy / dist) * (R - r); }
  };
  clamp(run.player, run.player.r);
  for (const e of run.enemies.items) if (!e.dead) clamp(e, e.radius);
}

export function updateEvents(run: Run, dt: number): void {
  const E = BAL.events, p = run.player;
  // Błogosławieństwa czasowe.
  if (run.buffs.length) {
    for (const b of run.buffs) b.t -= dt;
    if (run.buffs.some((b) => b.t <= 0)) { run.buffs = run.buffs.filter((b) => b.t > 0); run.recomputeStats(); }
  }

  if (run.dungeon) {
    clampArena(run);
    const d = run.dungeon;
    if (!d.cleared && run.enemies.count === 0) {
      if (d.wave < wavesOf(d)) { spawnWave(run); run.showBanner(`Fala ${d.wave}/${wavesOf(d)}`); }
      else {
        d.cleared = true;
        run.dropChest(d.cx - 14, d.cy, 'elite');
        run.dropChest(d.cx + 14, d.cy, 'boss');
        // Skarbiec: unikat (szansa) i iskra pustki.
        if (d.kind === 'vault') {
          if (rng.chance(BAL.secretsMap.vaultUnique)) run.pendingLoot.push({ source: 'boss', item: rollUnique(run.depth) });
          grantMat(run, 'void');
        }
        grantMat(run, 'ore', BAL.forge.dungeonOre);
        for (let i = 0; i < 20; i++) run.spawnPickup(d.cx + rng.range(-30, 30), d.cy + rng.range(-30, 30), 'coin', 1);
        if (run.levelInfo.dungeon) { run.clearObjective(); return; }
        run.mapObjects.push({ kind: 'exit', x: d.cx, y: d.cy - 40, blessing: 0, charge: 0, life: Infinity });
        run.showBanner(d.kind === 'barrow' ? 'Zapomniany Król pokonany! Portal powrotny' : 'Loch oczyszczony! Skarb i portal powrotny');
        sfx.play('levelup');
      }
    }
  } else if (!run.bossSpawned || run.mode === 'endless') {
    updateMapSecrets(run, dt);
    run.shrineT -= dt;
    if (run.shrineT <= 0) {
      run.shrineT = E.shrineEvery / (1 + run.flag('shrineRate'));
      if (run.mapObjects.filter((o) => o.kind === 'shrine').length < E.shrineMax) place(run, 'shrine', 120, 220, E.shrineLife);
    }
    if (!run.swordRolled && run.time >= E.swordAt) {
      run.swordRolled = true;
      if (rng.chance(E.swordChance)) { place(run, 'sword', 380, 520, Infinity); run.showBanner('Coś lśni w oddali...'); }
    }
    run.portalT -= dt;
    if (run.portalT <= 0) {
      run.portalT = E.portalEvery;
      if (!run.mapObjects.some((o) => o.kind === 'portal') && rng.chance(E.portalChance)) {
        place(run, 'portal', 110, 170, E.portalLife);
        run.showBanner('Pojawił się portal do lochu!');
      }
    }
  }

  // Aktywacja obiektów (dotknięcie; kapliczka wymaga chwili postoju).
  for (const o of run.mapObjects) {
    o.life -= dt;
    const near = (o.x - p.x) ** 2 + (o.y - p.y) ** 2 < 14 * 14;
    if (o.kind === 'shrine') {
      o.charge = near ? o.charge + dt : Math.max(0, o.charge - dt);
      if (o.charge >= E.shrineCharge) {
        const b = BLESSINGS[o.blessing];
        b.apply(run);
        run.showBanner(`Kapliczka: ${b.name}!`);
        run.burst(o.x, o.y, C.yellow, 24, 70);
        sfx.play('levelup');
        o.life = 0;
      }
    } else if (near && o.kind === 'sword') {
      run.pendingLoot.push({ source: 'boss', item: rollLegendary(run) });
      run.showBanner('Miecz w kamieniu!');
      grantMat(run, 'void');
      run.burst(o.x, o.y, C.gold, 40, 90);
      sfx.play('chest');
      o.life = 0;
    } else if (near && o.kind === 'portal') {
      o.life = 0;
      enterDungeon(run, 'portal');
      return;
    } else if (near && o.kind === 'exit') {
      exitDungeon(run);
      return;
    } else if (near) {
      if (touchSecret(run, o, dt)) return;
    } else if (o.kind === 'fountain') o.charge = 0;
  }
  if (run.mapObjects.some((o) => o.life <= 0)) run.mapObjects = run.mapObjects.filter((o) => o.life > 0);
}

/** Przedmiot Legendarny (z mieczem w kamieniu): losujemy łup bossa, aż trafi się Legendarny (z limitem prób). */
function rollLegendary(run: Run) {
  for (let i = 0; i < 200; i++) {
    const it = rollItem(run.depth + 1, 'boss', run.luck() + 3);
    if (it.rarity === 4) return it;
  }
  return rollItem(run.depth + 1, 'boss', 10);
}
