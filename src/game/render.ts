import { W, H, ZOOM, type Renderer } from '../core/renderer';
import { C } from '../core/palette';
import { drawLabel } from '../core/font';
import { rng } from '../core/rng';
import { drawSprite, drawShadow, getSprite, TILE, TILE_VARIANTS } from '../gfx/sprites';
import { animFrame } from '../gfx/actors';
import { FX_FRAMES, ARROW_DIRS, PROP_KINDS } from '../gfx/world';
import { effectiveStats, orbitRadius, auraRadius } from '../systems/weapons';
import { itemColor } from '../data/items';
import { BAL } from '../data/balance';
import type { Run } from './run';
import { taskTarget } from '../systems/tasks';

const MARGIN = 40;
const FIRE_COLS = [C.red, C.orange, C.gold, C.yellow, C.orange];
/** Kolor poświaty pocisku wroga wg sprite'a (domyślnie czerwony). */
const BULLET_GLOW: Record<string, number> = { eb_orange: C.orange, eb_pink: C.pink, eb_blue: C.blue, eb_cyan: C.cyan };

let vignette: HTMLCanvasElement | null = null;

/** Winieta: delikatne przyciemnienie brzegów ekranu (rysowana raz, potem z cache). */
function getVignette(): HTMLCanvasElement {
  if (vignette) return vignette;
  vignette = document.createElement('canvas');
  vignette.width = W;
  vignette.height = H;
  const g = vignette.getContext('2d')!;
  const grad = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.62);
  grad.addColorStop(0, 'rgba(24,20,37,0)');
  grad.addColorStop(1, 'rgba(24,20,37,0.55)');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  return vignette;
}

/**
 * Rysuje świat gry (bez HUD). Logika działa w jednostkach świata, a ekran pokazuje je
 * w powiększeniu ZOOM: sx = x·ZOOM − kamera. Kolejność warstw: podłoże → strefy → cienie →
 * znajdźki → wrogowie → gracz → pociski → cząsteczki/efekty → liczby obrażeń → winieta.
 */
/** Buduje z góry klatki efektów wybuchów, żeby pierwszy wybuch w runie nie przycinał gry. */
export function warmFx(): void {
  for (const [kind, n] of Object.entries(FX_FRAMES)) for (let f = 0; f < n; f++) getSprite(`${kind}@${f}`);
}

export function renderWorld(run: Run, r: Renderer): void {
  const g = r.g;
  const shx = run.shake > 0 ? rng.range(-run.shake, run.shake) * ZOOM : 0;
  const shy = run.shake > 0 ? rng.range(-run.shake, run.shake) * ZOOM : 0;
  const ox = Math.round(run.camX * ZOOM + shx), oy = Math.round(run.camY * ZOOM + shy);
  const X = (x: number) => Math.round(x * ZOOM) - ox;
  const Y = (y: number) => Math.round(y * ZOOM) - oy;
  const vis = (x: number, y: number) => {
    const sx = X(x), sy = Y(y);
    return sx > -MARGIN && sx < W + MARGIN && sy > -MARGIN && sy < H + MARGIN;
  };
  const p = run.player;
  const px = X(p.x), py = Y(p.y);

  // Podłoże z kafelków (wariant z hasha współrzędnych — stabilny przy ruchu kamery).
  const tx0 = Math.floor(ox / TILE), ty0 = Math.floor(oy / TILE);
  for (let ty = ty0; ty <= ty0 + Math.ceil(H / TILE); ty++) {
    for (let tx = tx0; tx <= tx0 + Math.ceil(W / TILE); tx++) {
      const h = ((tx * 73856093) ^ (ty * 19349663)) >>> 0;
      g.drawImage(getSprite(`tile${run.levelInfo.biome}_${h % TILE_VARIANTS}`).img, tx * TILE - ox, ty * TILE - oy);
    }
  }

  // Druga warstwa podłoża: duże plamy (ciemniejsze i jaśniejsze) co kilkanaście kafelków.
  const biome = run.levelInfo.biome;
  for (let ty = ty0 - 1; ty <= ty0 + Math.ceil(H / TILE); ty++) {
    for (let tx = tx0 - 1; tx <= tx0 + Math.ceil(W / TILE); tx++) {
      const h = ((tx * 2654435761) ^ (ty * 40503)) >>> 0;
      if (h % 13 !== 0) continue;
      g.drawImage(getSprite(`patch${biome}@${(h >>> 9) % 6}`).img, tx * TILE - ox - 8, ty * TILE - oy);
    }
  }

  // Teren: kałuże bagna i lodu (pod wszystkim, co stoi na ziemi).
  for (const t of run.terrain) {
    if ((t.kind !== 'swamp' && t.kind !== 'ice') || !vis(t.x, t.y)) continue;
    const tx = X(t.x), ty = Y(t.y), tr = t.r * ZOOM, ice = t.kind === 'ice';
    r.withAlpha(ice ? 0.35 : 0.6, () => r.circle(tx, ty, tr, ice ? C.blue : C.dbrown, true));
    r.withAlpha(ice ? 0.3 : 0.45, () => r.circle(tx - tr * 0.15, ty - tr * 0.15, tr * 0.6, ice ? C.cyan : C.green, true));
    r.circle(tx, ty, tr, ice ? C.cyan : C.green);
    r.circle(tx, ty, tr - 1, ice ? C.white : C.dgreen);
    // Bąble bagna i odblaski lodu (stałe względem kałuży).
    for (let k = 0; k < 4; k++) {
      const a = k * 1.7 + t.v, d = tr * (0.3 + 0.15 * k);
      if (ice) r.rect(tx + Math.cos(a) * d, ty + Math.sin(a) * d, 3, 1, C.white);
      else if ((run.step + k * 13) % 50 < 25) r.rect(tx + Math.cos(a) * d, ty + Math.sin(a) * d, 2, 2, C.lime);
    }
  }

  // Dekoracje terenu: co ~8. kafelek dostaje element z hasha współrzędnych (stabilny przy ruchu kamery).
  for (let ty = ty0 - 1; ty <= ty0 + Math.ceil(H / TILE); ty++) {
    for (let tx = tx0 - 1; tx <= tx0 + Math.ceil(W / TILE); tx++) {
      const h = ((tx * 92837111) ^ (ty * 689287499)) >>> 0;
      if (h % 8 !== 0) continue;
      const x = tx * TILE - ox + 4 + ((h >>> 8) % 20), y = ty * TILE - oy + 4 + ((h >>> 13) % 20);
      drawShadow(g, x, y + 8, 16);
      drawSprite(g, `prop${biome}@${(h >>> 4) % PROP_KINDS}`, x, y);
    }
  }

  // Ataki gracza (ustawienie): przygaszone = półprzezroczyste i bez poświat, ukryte = pominięte (działają dalej).
  const atkOn = run.playerFx !== 'hidden', glow = run.playerFx === 'visible';
  const atk = (fn: () => void) => { if (atkOn) { if (glow) fn(); else r.withAlpha(0.35, fn); } };

  // Aury broni i tytana: półprzezroczyste pole + pulsujący brzeg.
  const ult = run.abilities.ult;
  atk(() => {
    for (const w of run.weapons) {
      if (w.def.kind !== 'aura') continue;
      const rad = auraRadius(effectiveStats(run, w).area) * ZOOM;
      if (glow) r.withAlpha(0.16, () => r.circle(px, py, rad, w.def.color, true));
      r.circle(px, py, rad, run.step % 20 < 10 ? w.def.color : C.orange);
    }
    if (ult.def.kind === 'titan' && ult.activeT > 0) {
      const rad = ult.def.p.radius * run.stats.area * ZOOM;
      if (glow) r.withAlpha(0.18, () => r.circle(px, py, rad, C.red, true));
      r.circle(px, py, rad, C.red);
    }
  });

  // Strefy (wszystkie są atakami gracza).
  atk(() => {
    for (const z of run.zones.items) {
      const zx = X(z.x), zy = Y(z.y), zr = z.r * ZOOM;
      switch (z.kind) {
        case 'meteor': {
          r.withAlpha(0.25, () => r.circle(zx, zy, zr, C.red, true));
          if (run.step % 8 < 5) r.circle(zx, zy, zr, C.red);
          const fall = Math.max(0, 1 - z.t / z.delay);
          drawSprite(g, 'eb_orange', zx + fall * 45, zy - fall * 135, { scale: 2 });
          break;
        }
        case 'mine':
          drawShadow(g, zx, zy + 5, 10);
          drawSprite(g, z.t > 0.4 && run.step % 20 < 10 ? 'mine1' : 'mine0', zx, zy);
          break;
        case 'net':
          r.withAlpha(0.15, () => r.circle(zx, zy, zr, C.lgray, true));
          r.circle(zx, zy, zr, C.lgray);
          for (let k = -zr + 5; k < zr; k += 8) {
            const hw = Math.sqrt(zr * zr - k * k);
            r.rect(zx - hw, zy + k, hw * 2, 1, C.lavender);
            r.rect(zx + k, zy - hw, 1, hw * 2, C.lavender);
          }
          break;
        case 'rain':
          r.withAlpha(0.15, () => r.circle(zx, zy, zr, C.gold, true));
          r.circle(zx, zy, zr, C.gold);
          for (let k = 0; k < 8; k++) {
            const ax = zx + rng.range(-zr, zr) * 0.8, ay = zy + rng.range(-zr, zr) * 0.8;
            r.line(ax, ay - 9, ax, ay, C.brown);
            r.rect(ax, ay, 1, 1, C.white);
          }
          break;
        case 'curse':
          // Bagno dusz: zielono-fioletowa toń z bąblami i ognikami.
          r.withAlpha(0.22, () => r.circle(zx, zy, zr, C.dgreen, true));
          r.circle(zx, zy, zr, run.step % 30 < 15 ? C.lime : C.plum);
          for (let k = 0; k < 4; k++) r.rect(zx + rng.range(-zr, zr) * 0.7, zy + rng.range(-zr, zr) * 0.7, 2, 2, k % 2 ? C.lime : C.pink);
          break;
        case 'fire':
          r.withAlpha(0.2, () => r.circle(zx, zy, zr, C.orange, true));
          for (let k = 0; k < 5; k++) {
            r.rect(zx + rng.range(-zr, zr) * 0.7, zy + rng.range(-zr, zr) * 0.7 - rng.range(0, 4), 2, 2, rng.pick(FIRE_COLS));
          }
          break;
        case 'beam': {
          const ex = zx + Math.cos(z.angle) * z.len * ZOOM, ey = zy + Math.sin(z.angle) * z.len * ZOOM;
          const wdt = Math.max(2, Math.round(z.r * 2 * ZOOM));
          r.withAlpha(0.35, () => r.line(zx, zy, ex, ey, C.pink, wdt + 4));
          r.line(zx, zy, ex, ey, C.pink, wdt);
          r.line(zx, zy, ex, ey, C.white, Math.max(1, wdt - 3));
          break;
        }
      }
    }
  });

  // Cienie (pod wszystkimi stojącymi na ziemi; pomijane w trybie oszczędnych efektów).
  const fancy = !run.lowFx;
  if (fancy) for (const e of run.enemies.items) {
    if (!e.dead && vis(e.x, e.y)) drawShadow(g, X(e.x), Y(e.y) + e.radius * ZOOM * e.scale * 0.9, e.radius * 3 * e.scale);
  }
  if (run.outcome !== 'dead') drawShadow(g, px, py + 8, 13);
  for (const t of run.turrets.items) drawShadow(g, X(t.x), Y(t.y) + 7, 12);

  // Loch: mrok i kamienne ściany areny.
  if (run.dungeon) {
    const d = run.dungeon, R = BAL.events.arenaR * ZOOM;
    r.withAlpha(0.4, () => r.rect(0, 0, W, H, C.black));
    const cx = X(d.cx), cy = Y(d.cy);
    r.withAlpha(0.25, () => r.circle(cx, cy, R, C.plum, true));
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2, wx = cx + Math.cos(a) * (R + 4), wy = cy + Math.sin(a) * (R + 4);
      if (wx < -10 || wy < -10 || wx > W + 10 || wy > H + 10) continue;
      r.rect(wx - 4, wy - 4, 9, 9, C.black);
      r.rect(wx - 3, wy - 3, 7, 7, i % 3 ? C.dgray : C.slate);
      r.rect(wx - 3, wy - 3, 7, 1, C.lavender);
    }
  }

  // Arena bossa: zwężający się krąg kamiennych bloków, poza nim mrok.
  if (run.arena) {
    const a = run.arena, cx = X(a.x), cy = Y(a.y), R = a.r * ZOOM, n = Math.max(48, Math.round(a.r / 4));
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2, wx = cx + Math.cos(ang) * (R + 4), wy = cy + Math.sin(ang) * (R + 4);
      if (wx < -10 || wy < -10 || wx > W + 10 || wy > H + 10) continue;
      r.rect(wx - 4, wy - 4, 9, 9, C.black);
      r.rect(wx - 3, wy - 3, 7, 7, i % 3 ? C.dred : C.plum);
      r.rect(wx - 3, wy - 3, 7, 1, C.salmon);
    }
  }

  // Teren: kolce, osłony (pęknięte poniżej połowy HP) i beczki (migają przed wybuchem).
  for (const t of run.terrain) {
    if (t.kind === 'swamp' || t.kind === 'ice' || !vis(t.x, t.y)) continue;
    const tx = X(t.x), ty = Y(t.y);
    if (t.kind === 'spikes') { drawSprite(g, `tspikes@${t.t <= BAL.terrain.spikeUp ? 1 : 0}`, tx, ty); continue; }
    drawShadow(g, tx, ty + t.r * ZOOM * 0.8, t.r * 3);
    if (t.kind === 'cover') {
      drawSprite(g, `tcover@${t.v + (t.hp < BAL.terrain.coverHp / 2 ? 3 : 0)}`, tx, ty - 4);
      // Pęknięta ściana (sekret): migocząca fioletowa szczelina.
      if (t.secret && run.step % 50 < 12) { r.rect(tx - 1, ty - 10, 2, 8, C.pink); r.rect(tx + 1, ty - 4, 2, 2, C.hotpink); }
    }
    else drawSprite(g, 'tbarrel', tx, ty - 4, { flash: t.t > 0 && run.step % 4 < 2 });
  }

  // Obiekty mapy: kapliczki (z paskiem aktywacji), miecz w kamieniu, portale.
  for (const o of run.mapObjects) {
    if (!vis(o.x, o.y)) continue;
    const ox = X(o.x), oy = Y(o.y);
    drawShadow(g, ox, oy + 10, 16);
    if (o.kind === 'shrine') {
      r.withAlpha(0.18 + 0.1 * Math.sin(run.time * 4), () => r.circle(ox, oy - 4, 14, C.yellow, true));
      drawSprite(g, `shrine${o.blessing}`, ox, oy);
      if (o.charge > 0) {
        r.rect(ox - 10, oy + 14, 20, 4, C.black);
        r.rect(ox - 9, oy + 15, Math.round(18 * Math.min(1, o.charge / BAL.events.shrineCharge)), 2, C.yellow);
      }
    } else if (o.kind === 'fountain') {
      r.withAlpha(0.15, () => r.circle(ox, oy + 4, 18, C.cyan, true));
      drawSprite(g, `fountain@${Math.floor(run.step / 8) % 3}`, ox, oy);
      if (o.charge > 0) { r.rect(ox - 10, oy + 14, 20, 4, C.black); r.rect(ox - 9, oy + 15, Math.round(18 * Math.min(1, o.charge / BAL.secretsMap.fountainStand)), 2, C.cyan); }
    } else if (o.kind === 'rune') {
      if (o.charge > 0) r.withAlpha(0.3, () => r.circle(ox, oy - 2, 12, C.white, true));
      drawSprite(g, `rune${o.blessing}@${o.charge > 0 ? 1 : 0}`, ox, oy);
    } else if (o.kind === 'mural') {
      drawSprite(g, `mural:${o.order!.join('')}`, ox, oy);
    } else if (o.kind === 'mushroom') {
      drawSprite(g, 'mushroom', ox, oy + 4);
    } else if (o.kind === 'stairs' || o.kind === 'grove') {
      r.withAlpha(0.2 + 0.1 * Math.sin(run.time * 5), () => r.circle(ox, oy, 16, o.kind === 'grove' ? C.white : C.plum, true));
      drawSprite(g, o.kind, ox, oy);
    } else if (o.kind === 'barrow') {
      r.withAlpha(0.25, () => r.circle(ox, oy, 24, C.gold, true));
      drawSprite(g, `barrow@${run.step % 40 < 20 ? 1 : 0}`, ox, oy - 4);
    } else if (o.kind === 'sword') {
      if (run.step % 30 < 15) r.rect(ox + 3, oy - 12, 2, 2, C.white);
      drawSprite(g, 'swordstone', ox, oy);
    } else {
      r.withAlpha(0.3, () => r.circle(ox, oy, 20, o.kind === 'exit' ? C.lime : C.pink, true));
      drawSprite(g, `${o.kind === 'exit' ? 'exitportal' : 'portal'}@${Math.floor(run.step / 8) % 3}`, ox, oy - 4);
    }
  }

  // Zadanie: kamień przed startem, krąg mocy, totem z paskiem HP, znacznik nad ściganą elitą.
  const task = run.task;
  if (task) {
    const tx = X(task.x), ty = Y(task.y), kind = task.def.kind;
    if (task.started && kind === 'circle') {
      const R = Math.round(BAL.tasks.circleR * ZOOM), inCircle = (task.x - p.x) ** 2 + (task.y - p.y) ** 2 < BAL.tasks.circleR ** 2;
      r.withAlpha(inCircle ? 0.28 : 0.15, () => r.circle(tx, ty, R, C.cyan, true));
      r.circle(tx, ty, R, inCircle ? C.white : C.cyan);
      r.withAlpha(0.6, () => r.circle(tx, ty, Math.max(1, Math.round(R * Math.min(1, task.progress / task.def.need))), C.cyan));
    } else if (task.started && kind === 'totem' && vis(task.x, task.y)) {
      r.withAlpha(0.15, () => r.circle(tx, ty, Math.round(BAL.tasks.totemR * ZOOM), C.red, true));
      drawShadow(g, tx, ty + 12, 16);
      drawSprite(g, 'totem', tx, ty);
      r.rect(tx - 12, ty - 22, 24, 4, C.black);
      r.rect(tx - 11, ty - 21, Math.round(22 * Math.max(0, task.hp)), 2, task.hp > 0.35 ? C.lime : C.red);
    } else if (!task.started && vis(task.x, task.y)) {
      r.withAlpha(0.2 + 0.12 * Math.sin(run.time * 5), () => r.circle(tx, ty - 2, 16, C.cyan, true));
      drawShadow(g, tx, ty + 11, 14);
      drawSprite(g, 'taskstone', tx, ty);
    } else if (task.started && kind === 'hunt') {
      const e = run.enemies.items.find((x) => x.uid === task.target && !x.dead);
      if (e && vis(e.x, e.y) && run.step % 20 < 14) {
        const ex = X(e.x), ey = Y(e.y - e.radius) - 10;
        r.rect(ex - 3, ey - 4, 7, 3, C.black); r.rect(ex - 2, ey - 3, 5, 1, C.red); r.rect(ex - 1, ey - 2, 3, 2, C.red); r.rect(ex, ey, 1, 1, C.red);
      }
    }
  }

  // Znajdźki.
  for (const gm of run.gems.items) {
    if (!vis(gm.x, gm.y)) continue;
    const tier = gm.value < 5 ? 0 : gm.value < 25 ? 1 : gm.value < 100 ? 2 : 3;
    const gx = X(gm.x), gy = Y(gm.y) + Math.round(Math.sin(run.time * 5 + gm.x) * 1);
    drawSprite(g, `gem${tier}`, gx, gy);
    // Błysk: co jakiś czas mrugnięcie światła na krysztale.
    if ((run.step + Math.floor(gm.x * 13)) % 120 < 5) { r.rect(gx - 1, gy - 4, 1, 3, C.white); r.rect(gx - 2, gy - 3, 3, 1, C.white); }
  }
  for (const it of run.pickups.items) {
    if (!vis(it.x, it.y)) continue;
    const bob = Math.round(Math.sin(run.time * 4 + it.x) * 1.5);
    const sx = X(it.x), sy = Y(it.y);
    // Skrzynia: poświata, rozchodzący się pierścień i słup światła w kolorze jakości (od Magicznego),
    // iskry unoszące się w słupie; super-bonus = złote iskry wokół.
    if (it.item) {
      const q = it.item.rarity, col = itemColor(it.item), pulse = 0.5 + 0.5 * Math.sin(run.time * 5 + it.x);
      r.withAlpha(0.2 + 0.15 * pulse, () => r.circle(sx, sy + 4, 12 + q * 4, col, true));
      r.withAlpha(0.35, () => r.circle(sx, sy + 4, 7 + q * 2, C.white, true));
      const wave = (run.time * 0.8 + it.x * 0.01) % 1;
      r.withAlpha(0.6 * (1 - wave), () => r.circle(sx, sy + 4, 8 + wave * (16 + q * 6), col));
      if (q >= 1) {
        const h = 40 + q * 28, w = 4 + q * 3;
        r.withAlpha(0.14 + 0.08 * pulse, () => r.rect(sx - w, sy - h, w * 2, h, col));
        r.withAlpha(0.3 + 0.1 * pulse, () => r.rect(sx - w / 2, sy - h, w, h, col));
        r.withAlpha(0.6, () => r.rect(sx - 1, sy - h, 2, h, C.white));
        for (let k = 0; k < q + 1; k++) {
          const t = (run.time * 0.6 + k / (q + 1) + it.x * 0.013) % 1;
          r.rect(sx - w / 2 + ((k * 7) % w), sy - t * h, 2, 2, t > 0.7 ? C.white : col);
        }
      }
      if (it.item.super && run.step % 16 < 10) {
        for (const [ox, oy] of [[-11, -8], [10, -4], [-6, 6], [8, 9]]) r.rect(sx + ox, sy + oy + bob, 2, 2, C.yellow);
      }
    }
    drawShadow(g, sx, sy + 7, 10);
    drawSprite(g, it.kind, sx, sy + bob);
  }

  // Wieżyczki (karty z tagiem Przywołania).
  for (const t of run.turrets.items) {
    if (t.life > 1.5 || run.step % 8 < 5) drawSprite(g, 'turret', X(t.x), Y(t.y));
  }

  // Sługi (duchy): półprzezroczyste, migają przed zniknięciem.
  for (const m of run.minions.items) {
    if (!vis(m.x, m.y) || (m.life < 1.5 && run.step % 8 >= 5)) continue;
    const name = m.big ? 'wraithbig' : 'wraith';
    r.withAlpha(0.85, () => drawSprite(g, `${name}@${animFrame(name, run.step, m._i * 5)}`, X(m.x), Y(m.y) - 2, { flipX: m.x > p.x }));
  }

  // Wrogowie.
  for (const e of run.enemies.items) {
    if (e.dead || !vis(e.x, e.y)) continue;
    const ex = X(e.x), ey = Y(e.y);
    if (e.elite) r.circle(ex, ey + e.radius * ZOOM, e.radius * ZOOM * 1.2, run.step % 30 < 15 ? C.yellow : C.orange);
    if (e.boss && e.invuln > 0 && run.step % 6 < 3) continue;
    drawSprite(g, `${e.sprite}@${animFrame(e.sprite, run.step, e.uid * 7)}`, ex, ey, { flash: e.flash > 0, scale: e.scale, flipX: e.x > p.x });
    // Stany żywiołów: płomyki (podpalenie), szron (spowolnienie lodem), iskry (porażenie), bąbelki (trucizna).
    if (e.burnT > 0 || e.slowT > 0 || e.shockT > 0 || e.poisonT > 0) {
      const top = ey - e.radius * ZOOM * e.scale, ph = (run.step + e.uid * 5) % 12;
      if (e.burnT > 0) { r.rect(ex - 3 + (ph % 6), top - 2 - (ph >> 1), 2, 2, ph < 6 ? C.orange : C.yellow); }
      if (e.slowT > 0) { r.withAlpha(0.35, () => r.circle(ex, ey, e.radius * ZOOM * e.scale + 1, C.cyan)); }
      if (e.shockT > 0 && ph < 4) { r.rect(ex + 3, top + 1, 1, 3, C.yellow); r.rect(ex + 2, top + 2, 3, 1, C.white); }
      if (e.poisonT > 0) { r.rect(ex - 4 + ((ph * 3) % 8), top + 2 - (ph % 4), 2, 2, C.lime); }
    }
    if (e.stunT > 0) {
      const sy = ey - e.radius * ZOOM * e.scale - 8;
      for (let k = 0; k < 3; k++) {
        const a = run.time * 6 + (k * Math.PI * 2) / 3;
        r.rect(ex + Math.cos(a) * 5, sy + Math.sin(a) * 2, 2, 2, C.yellow);
      }
    }
    if (e.elite) {
      const w = 26, fr = Math.max(0, e.hp / e.maxHp), by = ey - e.radius * ZOOM * e.scale - 7;
      r.rect(ex - w / 2 - 1, by - 1, w + 2, 5, C.black);
      r.rect(ex - w / 2, by, Math.round(w * fr), 3, C.orange);
      r.rect(ex - w / 2, by, Math.round(w * fr), 1, C.gold);
    }
  }

  // Gracz (miganie przy nietykalności).
  const blink = (p.hurtCd > 0 || p.iframes > 0) && run.step % 6 < 3;
  if (!blink && run.outcome !== 'dead') {
    const scale = ult.def.kind === 'titan' && ult.activeT > 0 ? 2 : 1;
    const frame = p.moving || p.dashT > 0 ? animFrame(run.hero.sprite, run.step, 0) : 0;
    drawSprite(g, `${run.hero.sprite}@${frame}`, px, py, { flash: p.flash > 0, scale, flipX: p.fx < 0 });
  }
  if (p.shield > 0) {
    r.withAlpha(0.25, () => r.circle(px, py, 12, C.cyan, true));
    r.circle(px, py, 12, C.cyan);
  }
  // Rdzeń trafienia (BAL.playerBulletR) widoczny, gdy w pobliżu lecą pociski — wiadomo, jak blisko można je mijać.
  if (run.bullets.count > 0 && run.outcome !== 'dead') {
    r.rect(px - 2, py - 2, 4, 4, C.black);
    r.rect(px - 1, py - 1, 2, 2, C.white);
  }
  // Mały pasek HP pod graczem.
  r.rect(px - 9, py + 12, 18, 4, C.black);
  r.rect(px - 8, py + 13, Math.round(16 * Math.max(0, p.hp / run.stats.maxHp)), 2, C.red);
  r.rect(px - 8, py + 13, Math.round(16 * Math.max(0, p.hp / run.stats.maxHp)), 1, C.salmon);

  // Ostrza orbity i pociski gracza.
  atk(() => {
    for (const w of run.weapons) {
      if (w.def.kind !== 'orbit') continue;
      const s = effectiveStats(run, w);
      const n = Math.max(1, s.amount), R = orbitRadius(s.area) * ZOOM;
      for (let k = 0; k < n; k++) {
        const a = w.angle + (k * Math.PI * 2) / n;
        drawSprite(g, w.def.proj ?? 'blade', px + Math.cos(a) * R, py + Math.sin(a) * R, { scale: s.area >= 1.5 ? 2 : 1 });
      }
    }
    for (const pr of run.projectiles.items) {
      if (!vis(pr.x, pr.y)) continue;
      const x = X(pr.x), y = Y(pr.y);
      if (pr.kind === 'arrow') {
        const dir = (Math.round((Math.atan2(pr.vy, pr.vx) / (Math.PI * 2)) * ARROW_DIRS) + ARROW_DIRS) % ARROW_DIRS;
        drawSprite(g, `${pr.forceCrit ? 'arrowc' : 'arrow'}@${dir}`, x, y);
      } else if (pr.kind === 'boomerang') {
        drawSprite(g, `boom${Math.floor(pr.t * 16) & 3}`, x, y);
      } else {
        drawSprite(g, pr.sprite, x, y);
      }
    }
  });

  // Pociski wrogów: najpierw poświaty (jedna zmiana przezroczystości dla wszystkich), potem kule.
  // Przy bardzo dużej liczbie pocisków poświaty są pomijane (wydajność).
  if (fancy && run.bullets.count < 600) {
    r.withAlpha(0.28, () => {
      for (const b of run.bullets.items) if (vis(b.x, b.y)) r.circle(X(b.x), Y(b.y), b.radius * ZOOM + 4, BULLET_GLOW[b.sprite] ?? C.red, true);
    });
  }
  for (const b of run.bullets.items) {
    if (vis(b.x, b.y)) drawSprite(g, b.sprite, X(b.x), Y(b.y));
  }

  // Cząsteczki i efekty (trafienia, wybuchy, błyski) — też ataki gracza.
  atk(() => {
    for (const pt of run.particles.items) {
      if (vis(pt.x, pt.y)) r.rect(X(pt.x), Y(pt.y), pt.size + 1, pt.size + 1, pt.col);
    }
    for (const f of run.fx.items) {
      const k = f.life / f.max;
      switch (f.kind) {
        case 'line':
          if (glow) r.withAlpha(0.4, () => r.line(X(f.x), Y(f.y), X(f.x2), Y(f.y2), f.col, f.w + 3));
          r.line(X(f.x), Y(f.y), X(f.x2), Y(f.y2), f.col, f.w + 1);
          r.line(X(f.x), Y(f.y), X(f.x2), Y(f.y2), C.white, 1);
          break;
        case 'ring': {
          const rr = f.r * ZOOM * (1.15 - k * 0.3);
          if (glow) r.withAlpha(0.3 * k, () => r.circle(X(f.x), Y(f.y), rr, f.col, true));
          r.circle(X(f.x), Y(f.y), rr, f.col);
          break;
        }
        case 'spark':
        case 'poof':
        case 'boom': {
          const n = FX_FRAMES[f.kind];
          const fr = Math.min(n - 1, Math.floor((1 - k) * n));
          drawSprite(g, `${f.kind}@${fr}`, X(f.x), Y(f.y), { scale: Math.max(1, Math.round(f.r)) });
          break;
        }
        case 'arc':
          for (let a = f.a0; a <= f.a1; a += 0.08) {
            const rr = f.r * ZOOM * (0.6 + 0.4 * (1 - k));
            r.rect(X(f.x) + Math.cos(a) * rr, Y(f.y) + Math.sin(a) * rr, 3, 3, f.col);
            r.rect(X(f.x) + Math.cos(a) * (rr - 3), Y(f.y) + Math.sin(a) * (rr - 3), 2, 2, C.white);
          }
          break;
      }
    }
  });

  // Liczby obrażeń.
  for (const n of run.dmgNums.items) {
    if (vis(n.x, n.y)) drawLabel(g, n.text, X(n.x), Y(n.y) - 6, n.col, C.black);
  }

  if (fancy) g.drawImage(getVignette(), 0, 0);

  // Znaczniki poza ekranem na krawędzi w stronę celu: dobre skrzynie (Rzadki+ albo super-bonus) i cel zadania.
  const marker = (x: number, y: number, col: number) => {
    const dx = X(x) - px, dy = Y(y) - py;
    const k = Math.min((W / 2 - 12) / Math.max(1, Math.abs(dx)), (H / 2 - 12) / Math.max(1, Math.abs(dy)));
    const mx = Math.round(px + dx * k), my = Math.round(py + dy * k);
    r.circle(mx, my, 5, C.black, true);
    r.circle(mx, my, 4, col, true);
    if (run.step % 30 < 15) r.rect(mx - 1, my - 1, 2, 2, C.white);
  };
  for (const it of run.pickups.items) {
    if (!it.item || vis(it.x, it.y) || (it.item.rarity < 2 && !it.item.super)) continue;
    marker(it.x, it.y, itemColor(it.item));
  }
  const goal = taskTarget(run);
  if (goal && !vis(goal.x, goal.y)) marker(goal.x, goal.y, C.cyan);

  // Celownik.
  const ax = X(run.aimX), ay = Y(run.aimY);
  for (const [dx, dy, w, h] of [[-5, 0, 3, 1], [3, 0, 3, 1], [0, -5, 1, 3], [0, 3, 1, 3]]) {
    r.rect(ax + dx - 1, ay + dy - 1, w + 2, h + 2, C.black);
    r.rect(ax + dx, ay + dy, w, h, C.white);
  }
}
