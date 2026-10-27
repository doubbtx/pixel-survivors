import { rng } from '../core/rng';
import { sfx } from '../core/audio';
import { C } from '../core/palette';
import { BAL } from '../data/balance';
import { weaponStatsAt, type WeaponKind, type WeaponStats } from '../data/weapons';
import type { Enemy, WeaponInst } from '../entities/types';
import type { Run } from '../game/run';
import { weaponBase } from '../data/augments';

/** Statystyki broni po uwzględnieniu statystyk gracza (moc, obszar, szybkość ataku, ilość…). */
export interface EffWeapon extends WeaponStats {
  /** Odstęp między trafieniami tego samego wroga, w krokach (dla broni ciągłych). */
  hitSteps: number;
}

export function effectiveStats(run: Run, w: WeaponInst): EffWeapon {
  const s = weaponStatsAt(w.def, w.level);
  const st = run.stats;
  const b = w.bonus;
  const cooldown = s.cooldown * BAL.attackSpeedMul(st.atkSpeed + (b.atk ?? 0));
  // Żarłoczne ostrza (augment): orbita rośnie z zabójstwami na tym poziomie.
  const grow = w.def.kind === 'orbit' ? 1 + (run.cardState['aug.orbit'] ?? 0) : 1;
  return {
    damage: s.damage * st.might * (1 + (b.dmg ?? 0)),
    cooldown,
    amount: Math.max(0, s.amount + st.amount + (b.amount ?? 0)),
    speed: s.speed * st.projSpeed * (1 + (b.proj ?? 0)),
    area: s.area * st.area * grow * (1 + (b.area ?? 0)),
    duration: s.duration * st.duration,
    pierce: s.pierce,
    knock: s.knock,
    hitSteps: Math.max(4, Math.round(cooldown * 60)),
  };
}

/** Promień orbity — wspólny dla logiki i renderu. */
export const orbitRadius = (area: number) => 30 * area;
export const auraRadius = (area: number) => 26 * area;

type Behavior = (run: Run, w: WeaponInst, s: EffWeapon, dt: number) => void;

/** Odlicza czas odnowienia; zwraca true, gdy broń ma wystrzelić w tym kroku. */
function ready(w: WeaponInst, s: EffWeapon, dt: number): boolean {
  w.timer -= dt;
  if (w.timer > 0) return false;
  w.timer += s.cooldown;
  if (w.timer < 0) w.timer = s.cooldown;
  return true;
}

/** N najbliższych wrogów w zasięgu (posortowanych po odległości). */
function nearestN(run: Run, n: number, range: number): Enemy[] {
  const p = run.player;
  const cand = run.hash.query(p.x, p.y, range, run.qa).filter((e) => !e.dead && (e.x - p.x) ** 2 + (e.y - p.y) ** 2 <= range * range);
  cand.sort((a, b) => (a.x - p.x) ** 2 + (a.y - p.y) ** 2 - ((b.x - p.x) ** 2 + (b.y - p.y) ** 2));
  return cand.slice(0, n);
}

function fireProjectile(run: Run, w: WeaponInst, s: EffWeapon, angle: number, forceCrit: boolean): void {
  const boomerang = w.def.kind === 'boomerang';
  const pr = run.spawnProjectile({
    x: run.player.x, y: run.player.y, angle, speed: s.speed, damage: s.damage, src: w.def.name,
    sprite: w.def.proj ?? 'bolt', kind: boomerang ? 'boomerang' : w.def.proj === 'arrow' ? 'arrow' : 'normal',
    pierce: s.pierce, life: boomerang ? s.duration * 2 + 1.5 : s.duration, radius: 3 * s.area, knock: s.knock, forceCrit,
  });
  if (!pr) return;
  if (boomerang) pr.t = -s.duration; // bumerang: t<0 = lot w przód
  // Augmenty pocisków (data/augments.ts).
  const base = weaponBase(w.def);
  if ((base === 'bolt' && run.aug('bolt_seek')) || (base === 'staff' && run.aug('staff_seek')) || (base === 'souls' && run.aug('souls_seek'))) pr.retarget = 2;
  if (base === 'bolt' && run.aug('bolt_split')) pr.split = 1;
  if (base === 'arrow' && run.aug('arrow_split')) pr.splitEnd = 1;
  if (base === 'boomerang' && run.aug('boom_return')) pr.retMul = 2;
  if (base === 'staff' && run.aug('staff_blast')) pr.blast = 0.5;
}

/** Pocisk-odłamek z augmentu (bez dalszych augmentów). */
export function shardProjectile(run: Run, x: number, y: number, angle: number, damage: number, src: string, sprite: string, pierce = 0): void {
  run.spawnProjectile({ x, y, angle, speed: 170, damage, src, sprite, kind: sprite === 'arrow' ? 'arrow' : 'normal', pierce, life: 0.45, radius: 2 });
}

const BEHAVIORS: Record<WeaponKind, Behavior> = {
  /** Pociski w najbliższych wrogów; nadmiar pocisków rozchodzi się wachlarzem. */
  bolt(run, w, s, dt) {
    if (!ready(w, s, dt)) return;
    let amount = s.amount;
    let crit = false;
    // Pasywka "co N-ta salwa" działa tylko na broń podstawową bohatera.
    const hp = run.hero.passive;
    const every = Math.max(2, hp.value - run.flag('passive.n'));
    if (hp.kind === 'nthVolley' && w.def.id === run.basicWeaponId && ++w.shots % every === 0) {
      amount += 2 + run.flag('passive.extra');
      crit = true;
    }
    const targets = nearestN(run, amount, 200);
    if (targets.length === 0) { w.timer = 0.1; return; }
    for (let i = 0; i < amount; i++) {
      const t = targets[i % targets.length];
      const base = Math.atan2(t.y - run.player.y, t.x - run.player.x);
      const extra = Math.floor(i / targets.length);
      const off = extra === 0 ? 0 : (extra % 2 ? 1 : -1) * Math.ceil(extra / 2) * 0.15;
      fireProjectile(run, w, s, base + off, crit);
    }
    sfx.play('shoot');
  },

  /** Ostrza krążą stale; każdy wróg trafiany co `hitSteps`. */
  orbit(run, w, s, dt) {
    w.angle += s.speed * dt;
    const n = Math.max(1, s.amount);
    const R = orbitRadius(s.area);
    const p = run.player;
    const grow = run.aug('orbit_grow');
    // Ciskane ostrza (augment): co 3 s każde ostrze wylatuje na zewnątrz.
    const fling = run.aug('orbit_fling') && (w.timer -= dt) <= 0;
    if (fling) w.timer = 3;
    for (let k = 0; k < n; k++) {
      const a = w.angle + (k * Math.PI * 2) / n;
      const bx = p.x + Math.cos(a) * R, by = p.y + Math.sin(a) * R;
      run.enemiesInCircle(bx, by, 4 * s.area, (e) => {
        if (!run.canHit(e, w.slot, s.hitSteps)) return;
        run.damageEnemy(e, s.damage, w.def.name, { kx: e.x - p.x, ky: e.y - p.y, knock: s.knock });
        if (grow && e.dead) run.cardState['aug.orbit'] = Math.min(0.6, (run.cardState['aug.orbit'] ?? 0) + 0.03);
      });
      if (fling) shardProjectile(run, bx, by, a, s.damage * 0.6, w.def.name, w.def.proj ?? 'blade', 2);
    }
  },

  /** Pole wokół gracza: tick obrażeń + spowolnienie. */
  aura(run, w, s, dt) {
    if (!ready(w, s, dt)) return;
    const p = run.player;
    // Puls (augment): co 4. tick fala z mocnym odrzutem; Wysysanie: leczenie za trafionych.
    const pulse = run.aug('aura_pulse') && ++w.shots % 4 === 0;
    const R = auraRadius(s.area) * (pulse ? 1.3 : 1);
    let hits = 0;
    run.enemiesInCircle(p.x, p.y, R, (e) => {
      run.damageEnemy(e, s.damage * (pulse ? 1.5 : 1), w.def.name, { kx: e.x - p.x, ky: e.y - p.y, knock: pulse ? 8 : s.knock });
      e.slowT = 0.6;
      e.slowF = Math.max(e.slowF, 0.35);
      hits++;
    });
    if (pulse) { const f = run.addFx('ring', p.x, p.y, w.def.color, 0.3); if (f) f.r = R; }
    if (hits && run.aug('aura_drain')) run.heal(run.stats.maxHp * Math.min(0.01, hits * 0.002));
  },

  /** Błyskawica: pierwszy cel najbliższy, potem skoki do najbliższego nietrafionego. */
  chain(run, w, s, dt) {
    if (!ready(w, s, dt)) return;
    const p = run.player;
    const hit: number[] = [];
    const stun = run.aug('chain_stun') ? 0.3 : 0, burst = run.aug('chain_burst');
    for (let c = 0; c < s.amount; c++) {
      let cur = c === 0 ? run.nearestEnemy(p.x, p.y, 170) : run.nearestEnemy(p.x + rng.range(-80, 80), p.y + rng.range(-60, 60), 120, hit);
      let fx = p.x, fy = p.y, any = false;
      for (let j = 0; j <= s.pierce && cur; j++) {
        hit.push(cur.uid);
        const f = run.addFx('line', fx, fy, j % 2 ? C.white : w.def.color, 0.15);
        if (f) { f.x2 = cur.x; f.y2 = cur.y; }
        fx = cur.x; fy = cur.y;
        any = true;
        run.damageEnemy(cur, s.damage, w.def.name, { stun });
        cur = run.nearestEnemy(fx, fy, 55 * s.area, hit);
      }
      // Przeładowany łańcuch (augment): wybuch na ostatnim celu.
      if (burst && any) run.explode(fx, fy, 22 * s.area, s.damage * 0.6, w.def.name, w.def.color, 2);
    }
    if (hit.length) sfx.play('zap');
    else w.timer = 0.2;
  },

  /** Meteoryty spadają na losowych wrogów w pobliżu (strefa z opóźnieniem). */
  meteor(run, w, s, dt) {
    if (!ready(w, s, dt)) return;
    const p = run.player;
    const cand = run.hash.query(p.x, p.y, 140, run.qa).filter((e) => !e.dead);
    for (let i = 0; i < s.amount; i++) {
      const t = cand.length ? rng.pick(cand) : null;
      const x = t ? t.x : p.x + rng.range(-100, 100);
      const y = t ? t.y : p.y + rng.range(-70, 70);
      const z = run.addZone('meteor', x, y, 20 * s.area, s.damage, 0, w.slot, w.def.name);
      if (z) { z.delay = s.duration + i * 0.12; z.knock = s.knock; }
    }
  },

  /** Bumerang: lot w kierunku celu, potem powrót do gracza (logika w systems/projectiles). */
  boomerang(run, w, s, dt) {
    if (!ready(w, s, dt)) return;
    const p = run.player;
    const t = run.nearestEnemy(p.x, p.y, 180);
    const base = t ? Math.atan2(t.y - p.y, t.x - p.x) : Math.atan2(p.fy, p.fx);
    for (let i = 0; i < s.amount; i++) fireProjectile(run, w, s, base + (i - (s.amount - 1) / 2) * 0.5, false);
  },

  /** Promień: strefa 'beam' przyczepiona do gracza na czas `duration`. */
  laser(run, w, s, dt) {
    if (!ready(w, s, dt)) return;
    const p = run.player;
    const t = run.nearestEnemy(p.x, p.y, 200);
    const base = t ? Math.atan2(t.y - p.y, t.x - p.x) : Math.atan2(p.fy, p.fx);
    for (let i = 0; i < s.amount; i++) {
      const a = base + (i - (s.amount - 1) / 2) * 0.35;
      const z = run.addZone('beam', p.x, p.y, 3 * s.area, s.damage, s.duration, w.slot, w.def.name);
      if (z) { z.angle = a; z.len = 170; z.tick = 6; }
      // Rozszczepienie światła (augment): dwa krótsze promienie pod kątem.
      if (run.aug('laser_prism')) for (const d of [-0.5, 0.5]) {
        const zz = run.addZone('beam', p.x, p.y, 2 * s.area, s.damage * 0.5, s.duration, w.slot, w.def.name);
        if (zz) { zz.angle = a + d; zz.len = 85; zz.tick = 6; }
      }
    }
    sfx.play('zap');
  },

  /** Miny wokół gracza: uzbrajają się, wybuchają przy wrogu albo po czasie. */
  mines(run, w, s, dt) {
    if (!ready(w, s, dt)) return;
    const p = run.player;
    for (let i = 0; i < s.amount; i++) {
      const z = run.addZone('mine', p.x + rng.range(-18, 18), p.y + rng.range(-18, 18), 22 * s.area, s.damage, s.duration, w.slot, w.def.name);
      if (z) z.knock = s.knock;
    }
  },

  /** Cięcie łukiem ±60° przed graczem; kolejne cięcia rozkładają się po okręgu. */
  cleave(run, w, s, dt) {
    if (!ready(w, s, dt)) return;
    const p = run.player;
    const R = 26 * s.area;
    const t = run.nearestEnemy(p.x, p.y, R + 30);
    const base = t ? Math.atan2(t.y - p.y, t.x - p.x) : Math.atan2(p.fy, p.fx);
    let hits = 0;
    for (let k = 0; k < Math.max(1, s.amount); k++) {
      const a = base + (k * Math.PI * 2) / Math.max(1, s.amount);
      run.enemiesInCircle(p.x, p.y, R, (e) => {
        let d = Math.atan2(e.y - p.y, e.x - p.x) - a;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        if (Math.abs(d) > 1.05) return;
        run.damageEnemy(e, s.damage, w.def.name, { kx: e.x - p.x, ky: e.y - p.y, knock: s.knock });
        hits++;
      });
      // Fala ostrza (augment): przebijająca fala w kierunku cięcia.
      if (run.aug('axe_wave')) shardProjectile(run, p.x, p.y, a, s.damage * 0.7, w.def.name, 'blade', 99);
      const f = run.addFx('arc', p.x, p.y, w.def.color, 0.15);
      if (f) { f.r = R; f.a0 = a - 1.05; f.a1 = a + 1.05; }
    }
    // Krwawe cięcie (augment): leczenie za trafionych.
    if (hits && run.aug('axe_blood')) run.heal(Math.min(5, hits * 0.5));
    sfx.play('dash');
  },
};

export function updateWeapons(run: Run, dt: number): void {
  for (const w of run.weapons) BEHAVIORS[w.def.kind](run, w, effectiveStats(run, w), dt);
}
