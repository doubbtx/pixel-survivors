import { C } from '../core/palette';
import { VIEW_W, VIEW_H } from '../core/renderer';
import { BAL } from '../data/balance';
import { rng } from '../core/rng';
import type { Projectile } from '../entities/types';
import type { Run } from '../game/run';
import { shardProjectile } from './weapons';
import { terrainBlocker, hitTerrain } from './terrain';

/** Rzut Kości: zwykle x0.5–1.6, szóstka x`pr.dice` (złoty napis; Złota szóstka: wybuch i moneta, limit monet na sekundę). */
function rollDie(run: Run, pr: Projectile, x: number, y: number): number {
  const D = BAL.dice;
  if (!rng.chance(Math.min(D.sixMax, D.six + Math.max(0, run.stats.luck) * D.sixLuck))) return rng.range(D.low, D.high);
  run.popText(x, y - 8, '6!', C.gold);
  if (pr.sixBlast) {
    run.explode(x, y, D.blastR, pr.damage * pr.dice * D.blast, pr.src, C.gold, 2);
    if (run.totalTime - run.diceCoinT >= D.coinEvery) { run.diceCoinT = run.totalTime; run.spawnPickup(x, y, 'coin', 1); }
  }
  return pr.dice;
}

/** Pociski gracza: ruch, bumerangi, kolizje przez spatial hash, przebicia. */
export function updateProjectiles(run: Run, dt: number): void {
  const items = run.projectiles.items;
  const p = run.player;
  for (let i = items.length - 1; i >= 0; i--) {
    if (i >= items.length) continue; // pula skurczyła się w trakcie pętli (np. zwolnienie kilku pocisków w jednym trafieniu)
    const pr = items[i];
    pr.life -= dt;
    pr.t += dt;
    if (pr.kind === 'boomerang') {
      if (pr.t >= 0 && !pr.returning) {
        pr.returning = true;
        pr.hits.length = 0; // w drodze powrotnej może trafić te same cele ponownie
      }
      if (pr.returning) {
        const dx = p.x - pr.x, dy = p.y - pr.y;
        const d = Math.hypot(dx, dy);
        if (d < 6) { run.projectiles.release(pr); continue; }
        const sp = Math.hypot(pr.vx, pr.vy);
        pr.vx = (dx / d) * sp;
        pr.vy = (dy / d) * sp;
      }
    }
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;
    if (pr.life <= 0) { run.projectiles.release(pr); continue; }
    // Karta Rykoszet: odbicie od krawędzi ekranu (odświeża czas lotu, żeby pocisk wrócił na arenę).
    if (pr.bounces > 0 && pr.kind !== 'boomerang') {
      const bx = pr.x < run.camX || pr.x > run.camX + VIEW_W, by = pr.y < run.camY || pr.y > run.camY + VIEW_H;
      if (bx || by) {
        if (bx) pr.vx = -pr.vx;
        if (by) pr.vy = -pr.vy;
        pr.x = Math.max(run.camX, Math.min(run.camX + VIEW_W, pr.x));
        pr.y = Math.max(run.camY, Math.min(run.camY + VIEW_H, pr.y));
        pr.bounces--;
        pr.life = Math.max(pr.life, 1);
        pr.hits.length = 0;
      }
    }

    // Teren: osłony i beczki zatrzymują pociski gracza (bumerangi i fale przelatują).
    const tb = pr.kind === 'boomerang' || pr.kind === 'wave' ? null : terrainBlocker(run, pr.x, pr.y, pr.radius);
    if (tb) { hitTerrain(run, tb); run.projectiles.release(pr); continue; }
    const cand = run.hash.query(pr.x, pr.y, pr.radius + 12, run.qa);
    for (let j = 0; j < cand.length; j++) {
      const e = cand[j];
      if (e.dead) continue;
      const rr = pr.radius + e.radius;
      if ((e.x - pr.x) ** 2 + (e.y - pr.y) ** 2 > rr * rr || pr.hits.includes(e.uid)) continue;
      pr.hits.push(e.uid);
      // Tarczownik: pocisk z przodu (w kącie tarczy) odbija się bez obrażeń.
      if (e.def.behavior === 'shield' && !e.dead) {
        let d = Math.atan2(pr.y - e.y, pr.x - e.x) - e.shootA;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        if (Math.abs(d) < BAL.newEnemies.shieldArc) {
          run.burst(pr.x, pr.y, C.lgray, 3, 40);
          run.projectiles.release(pr);
          break;
        }
      }
      // Kości (0.43): każdy rzut losuje obrażenia, „szóstka” (szansa rośnie ze Szczęściem) mnoży je mocniej.
      // Włócznia światła: Piętno przed obrażeniami (zabity samą włócznią też wybucha przy Włóczni świtu).
      if (pr.brand > 0) { e.brandT = Math.max(e.brandT, pr.brand); if (pr.brandBoom) e.brandBoom = true; }
      let roll = 1;
      if (pr.dice > 0) roll = rollDie(run, pr, e.x, e.y);
      run.damageEnemy(e, pr.damage * roll * (pr.returning ? pr.retMul : 1), pr.src, { kx: pr.vx, ky: pr.vy, knock: pr.knock, forceCrit: pr.forceCrit });
      if (pr.drain > 0) run.drainHeal(pr.drain);
      // Augmenty (data/augments.ts): odłamki na boki, wybuch przy trafieniu.
      const dir = Math.atan2(pr.vy, pr.vx);
      if (pr.split) for (const d of [-0.7, 0.7]) shardProjectile(run, pr.x, pr.y, dir + d, pr.damage * 0.4, pr.src, pr.sprite);
      if (pr.blast) run.explode(pr.x, pr.y, 18, pr.damage * pr.blast, pr.src, C.orange, 2);
      if (--pr.pierce >= 0) continue;
      // Skok do następnego wroga zamiast zniknięcia.
      const next = pr.retarget > 0 ? run.nearestEnemy(pr.x, pr.y, 90, pr.hits) : null;
      if (next) {
        pr.retarget--;
        pr.pierce = 0;
        const sp = Math.hypot(pr.vx, pr.vy), a = Math.atan2(next.y - pr.y, next.x - pr.x);
        pr.vx = Math.cos(a) * sp; pr.vy = Math.sin(a) * sp;
        pr.life = Math.max(pr.life, 0.6);
        break;
      }
      if (pr.splitEnd) for (const d of [-0.4, 0, 0.4]) shardProjectile(run, pr.x, pr.y, dir + d, pr.damage * 0.5, pr.src, pr.sprite, 1);
      run.projectiles.release(pr);
      break;
    }
  }
}

/**
 * Pociski wrogów: ruch (przyspieszenie / zwalnianie, skręt, wężyk), trafienie gracza i usuwanie.
 * Trafienie liczone jest od małego "rdzenia" gracza (BAL.playerBulletR), jak w grach bullet hell:
 * pocisk musi wejść w środek postaci, więc przeciskanie się przez luki jest uczciwe.
 */
export function updateEnemyBullets(run: Run, dt: number): void {
  const items = run.bullets.items;
  const p = run.player;
  for (let i = items.length - 1; i >= 0; i--) {
    // hurtPlayer może zabić bossa (riposta, Ciernie, kontra, Feniks) -> collectAll() czyści run.bullets w trakcie pętli.
    if (i >= items.length) continue;
    const b = items[i];
    b.t += dt;
    if (b.acc !== 0 || b.turn !== 0 || b.wave !== 0) {
      let sp = Math.hypot(b.vx, b.vy);
      let a = Math.atan2(b.vy, b.vx);
      if (b.acc !== 0) sp = Math.min(220, Math.max(b.minV, sp + b.acc * dt));
      a += b.turn * dt;
      if (b.wave !== 0) a += b.wave * 6 * Math.cos(b.t * 6) * dt; // pochodna sin(6t) — tor wężykiem
      b.vx = Math.cos(a) * sp;
      b.vy = Math.sin(a) * sp;
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    // Teren: osłony i beczki zatrzymują pociski wrogów.
    const tb = terrainBlocker(run, b.x, b.y, b.radius);
    if (tb) { hitTerrain(run, tb); run.bullets.release(b); continue; }
    const dx = b.x - p.x, dy = b.y - p.y;
    const rr = b.radius + BAL.playerBulletR;
    if (dx * dx + dy * dy < rr * rr && p.iframes <= 0) {
      run.hurtPlayer(b.damage, b.src || 'Bullets', b);
      run.burst(b.x, b.y, C.red, 3, 30);
      run.bullets.release(b);
    } else if (b.life <= 0 || dx * dx + dy * dy > 300 * 300) {
      run.bullets.release(b);
    }
  }
}
