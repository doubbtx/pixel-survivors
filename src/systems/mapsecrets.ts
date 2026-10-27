import { rng } from '../core/rng';
import { sfx } from '../core/audio';
import { C } from '../core/palette';
import { BAL } from '../data/balance';
import { rollUnique } from '../data/items';
import type { Enemy } from '../entities/types';
import type { Run } from '../game/run';
import { BLESSINGS, enterDungeon, type MapObject, type MapObjectKind } from './events';
import { spawnEnemy, currentMix } from './spawner';
import { grantMat, grantScroll } from './forge';

/**
 * Sekrety map (liczby w BAL.secretsMap):
 *  fontanna — stań w niej: płacisz złoto, los: błogosławieństwo, materiał, zwój albo klątwa (do 3 razy),
 *  runy     — 4 kamienie i malowidło z kolejnością kolorów: dobra kolejność = moc run na poziom i skrzynia, zła = zasadzka,
 *  grzyby   — zjedzone dają losowy efekt (leczenie, XP, siła, szybkość albo odurzenie: odwrócone sterowanie),
 *  jeleń    — biały jeleń ucieka; zabity odsłania ukryty gaj z unikatem,
 *  mimik    — część zwykłych skrzyń gryzie: walka, potem dwie skrzynie,
 *  ściana   — pęknięta osłona terenu (systems/terrain.ts) skrywa schody do skarbca (loch 'vault'),
 *  kurhan   — 3 klucze z elit otwierają kurhan z Zapomnianym Królem (loch 'barrow', boss z własną mocą),
 *  bezbłędnie — boss pokonany bez trafienia daje dodatkową moc bossa.
 */
function place(run: Run, kind: MapObjectKind, minR: number, maxR: number, life: number, extra: Partial<MapObject> = {}): MapObject {
  const a = rng.range(0, Math.PI * 2), d = rng.range(minR, maxR);
  const o: MapObject = { kind, x: run.player.x + Math.cos(a) * d, y: run.player.y + Math.sin(a) * d, blessing: 0, charge: 0, life, ...extra };
  run.mapObjects.push(o);
  return o;
}

/** Losowanie sekretu mapy co BAL.secretsMap.every s (poza lochem i walką z bossem). */
export function updateMapSecrets(run: Run, dt: number): void {
  const S = BAL.secretsMap;
  run.secretT -= dt;
  if (run.secretT > 0 || run.boss) return;
  run.secretT = S.every;
  const kind = rng.weighted(S.weights);
  if (kind === 'fountain' && !run.mapObjects.some((o) => o.kind === 'fountain')) place(run, 'fountain', 130, 220, S.life);
  else if (kind === 'runes' && !run.mapObjects.some((o) => o.kind === 'rune')) placeRunes(run);
  else if (kind === 'mushrooms') for (let i = 0; i < S.mushrooms; i++) place(run, 'mushroom', 60, 200, S.life);
  else if (kind === 'stag' && !run.enemies.items.some((e) => !e.dead && e.def.id === 'stag')) {
    const a = rng.range(0, Math.PI * 2);
    spawnEnemy(run, 'stag', run.player.x + Math.cos(a) * 150, run.player.y + Math.sin(a) * 150);
    run.showBanner('Biały jeleń! Złap go');
  }
}

/** Runy: 4 kamienie na rogach kwadratu i malowidło z kolejnością w środku. */
function placeRunes(run: Run): void {
  const S = BAL.secretsMap, a = rng.range(0, Math.PI * 2), d = rng.range(150, 220);
  const cx = run.player.x + Math.cos(a) * d, cy = run.player.y + Math.sin(a) * d;
  const order = [0, 1, 2, 3].sort(() => rng.next() - 0.5);
  run.mapObjects.push({ kind: 'mural', x: cx, y: cy, blessing: 0, charge: 0, life: S.life, order });
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy], i) => run.mapObjects.push({ kind: 'rune', x: cx + sx * S.runeR, y: cy + sy * S.runeR, blessing: i, charge: 0, life: S.life }));
  run.cardState['runes.next'] = 0;
  run.showBanner('Kamienne runy... i malowidło obok');
}

/** Dotknięcie obiektu sekretu (wołane z systems/events.ts). Zwraca true, gdy gracz przeszedł do lochu. */
export function touchSecret(run: Run, o: MapObject, dt: number): boolean {
  const S = BAL.secretsMap;
  switch (o.kind) {
    case 'fountain': {
      o.charge += dt;
      if (o.charge < S.fountainStand) return false;
      o.charge = 0;
      const cost = Math.round(S.fountainCost * run.depth);
      if (run.gold < cost) { run.popText(o.x, o.y - 14, `Potrzeba ${cost} zł`, C.salmon); o.charge = -1; return false; }
      run.gold -= cost;
      wish(run, o);
      if (++o.blessing >= S.fountainUses) o.life = 0;
      return false;
    }
    case 'rune': {
      if (o.charge > 0) return false;
      const mural = run.mapObjects.find((m) => m.kind === 'mural');
      const next = run.cardState['runes.next'] ?? 0;
      if (!mural?.order) return false;
      if (mural.order[next] === o.blessing) {
        o.charge = 1;
        sfx.play('select');
        run.burst(o.x, o.y, C.white, 10, 50);
        if (next + 1 < 4) { run.cardState['runes.next'] = next + 1; return false; }
        // Dobra kolejność: moc run na resztę poziomu i skrzynia.
        run.buffs.push({ name: 'Moc run', stats: { might: S.runeMight, speedBonus: S.runeSpeed }, t: Infinity });
        run.recomputeStats();
        run.dropChest(o.x, o.y - 12, 'elite');
        run.showBanner('Runy przebudzone! Moc run do końca poziomu');
        sfx.play('levelup');
        for (const m of run.mapObjects) if (m.kind === 'rune' || m.kind === 'mural') m.life = 0;
      } else {
        // Zła kolejność: runy gasną i zasadzka.
        for (const m of run.mapObjects) if (m.kind === 'rune') m.charge = 0;
        run.cardState['runes.next'] = 0;
        const mix = currentMix(run.waveTime());
        for (let i = 0; i < S.ambush; i++) { const a = (i / S.ambush) * Math.PI * 2; spawnEnemy(run, rng.weighted(mix), o.x + Math.cos(a) * 60, o.y + Math.sin(a) * 60); }
        run.showBanner('Zła kolejność! Zasadzka');
        sfx.play('hurt');
      }
      return false;
    }
    case 'mushroom':
      eatMushroom(run, o);
      o.life = 0;
      return false;
    case 'grove':
      run.pendingLoot.push({ source: 'boss', item: rollUnique(run.depth) });
      run.showBanner('Ukryty gaj jelenia!');
      run.burst(o.x, o.y, C.white, 30, 80);
      sfx.play('chest');
      o.life = 0;
      return false;
    case 'stairs':
      o.life = 0;
      enterDungeon(run, 'vault');
      return true;
    case 'barrow':
      o.life = 0;
      run.cardState['keys'] = 0;
      enterDungeon(run, 'barrow');
      return true;
    default:
      return false;
  }
}

/** Fontanna: los życzenia. */
function wish(run: Run, o: MapObject): void {
  const r = rng.next();
  run.burst(o.x, o.y - 6, C.cyan, 16, 60);
  if (r < 0.55) {
    const b = rng.pick(BLESSINGS);
    b.apply(run);
    run.showBanner(`Fontanna: ${b.name}!`);
    sfx.play('levelup');
  } else if (r < 0.75) grantMat(run, rng.chance(0.7) ? 'ore' : 'heart');
  else if (r < 0.85) grantScroll(run);
  else {
    run.buffs.push({ name: 'Pech', stats: { might: -0.25, speedBonus: -0.2 }, t: 20 });
    run.recomputeStats();
    run.showBanner('Fontanna: klątwa pecha!');
    sfx.play('hurt');
  }
}

/** Grzyb: leczenie, doświadczenie, siła, szybkość albo odurzenie (odwrócone sterowanie). */
function eatMushroom(run: Run, o: MapObject): void {
  const S = BAL.secretsMap, r = rng.int(0, 4);
  const say = (t: string, col: number) => run.popText(o.x, o.y - 12, t, col);
  if (r === 0) { run.heal(run.stats.maxHp * 0.25); say('Smaczny!', C.lime); }
  else if (r === 1) { run.addXp(run.xpNext * 0.5); say('Olśnienie!', C.cyan); }
  else if (r === 2) { run.buffs.push({ name: 'Grzybowa siła', stats: { might: 0.4 }, t: 12 }); run.recomputeStats(); say('Siła!', C.orange); }
  else if (r === 3) { run.buffs.push({ name: 'Lekkość', stats: { speedBonus: 0.5 }, t: 12 }); run.recomputeStats(); say('Lekkość!', C.yellow); }
  else { run.confusedT = S.confused; say('Odurzenie...', C.pink); }
  sfx.play('pickup');
}

/** Zabójstwo: mimik zostawia 2 skrzynie, jeleń odsłania gaj, elita może upuścić klucz kurhanu. */
export function secretsOnKill(run: Run, e: Enemy): void {
  const S = BAL.secretsMap;
  if (e.def.id === 'mimic') { run.dropChest(e.x - 10, e.y, 'elite'); run.dropChest(e.x + 10, e.y, 'elite'); }
  else if (e.def.id === 'stag') run.mapObjects.push({ kind: 'grove', x: e.x, y: e.y, blessing: 0, charge: 0, life: S.life });
  else if (e.elite && !run.dungeon && (run.cardState['keys'] ?? 0) < 3 && rng.chance(S.keyChance)) {
    const k = (run.cardState['keys'] = (run.cardState['keys'] ?? 0) + 1);
    run.popText(e.x, e.y - 14, `Klucz kurhanu ${k}/3`, C.gold);
    if (k >= 3) {
      place(run, 'barrow', 140, 200, Infinity);
      run.showBanner('Kurhan się otworzył!');
      sfx.play('boss');
    }
  }
}

/** Mimik zamiast zwykłej skrzyni (systems/pickups.ts przy podniesieniu). */
export function springMimic(run: Run, x: number, y: number): void {
  spawnEnemy(run, 'mimic', x, y, { elite: ['swift'] });
  run.showBanner('Mimik!');
  run.addShake(3);
  sfx.play('hurt');
}
