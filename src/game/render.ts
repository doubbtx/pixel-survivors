import { W, H, VW, VH, ZOOM, type Renderer } from '../core/renderer';
import { C, PAL } from '../core/palette';
import { drawLabel } from '../core/font';
import { rng } from '../core/rng';
import { drawSprite, drawShadow, getSprite, queueWarm, warmStep } from '../gfx/sprites';
import { ANIM } from '../gfx/actors';
import { ENEMIES } from '../data/enemies';
import { LANDMARK_KINDS } from '../gfx/landmarks';
import { CHUNK, groundChunk, groundBase, groundFrame, groundReady } from '../gfx/ground';
import { drawScenery } from './scenery';
import { animFrame } from '../gfx/actors';
import { FX_FRAMES, ARROW_DIRS, PROP_KINDS } from '../gfx/world';
import { effectiveStats, orbitRadius, auraRadius } from '../systems/weapons';
import { itemColor } from '../data/items';
import { BAL } from '../data/balance';
import { BIOMES } from '../data/levels';
import type { Run } from './run';
import type { Enemy } from '../entities/types';
import { taskTarget } from '../systems/tasks';
import { drawElemMark } from '../gfx/elemmark';
import { BOSS_TELL, BOSS_TELLS, bossStyle } from '../systems/enemies';

const MARGIN = 40;
/** Siła wspólnej korekty barwnej sceny (0..1). */
const GRADE = 0.35;
/** Czas (ms) na budowanie podłoża w jednej klatce (gfx/ground.ts). */
const GROUND_BUDGET = 3;
/** Czas (ms) na wstępne budowanie sprite'ów w jednej klatce. */
const WARM_BUDGET = 2;
/** Ile sekund po trafieniu widać mały pasek życia pod bohaterem. */
const HP_BAR_SHOW = 2;
/** Ostatnio widziane życie gracza i czas ostatniego trafienia (pasek pod bohaterem). */
const hpSeen: { run: Run | null; hp: number; at: number } = { run: null, hp: 0, at: -99 };
/** Odległość pocisku (jednostki świata), od której pokazuje się rdzeń trafienia gracza. */
const CORE_SHOW = 45;
const FIRE_COLS = [C.red, C.orange, C.gold, C.yellow, C.orange];
/** Kolor poświaty pocisku wroga wg sprite'a (domyślnie czerwony). */
const BULLET_GLOW: Record<string, number> = { eb_orange: C.orange, eb_pink: C.pink, eb_blue: C.blue, eb_cyan: C.cyan };

let vignette: HTMLCanvasElement | null = null;

/** Miękkie poświaty (radialny gradient koloru palety do przezroczystości), z cache per kolor i promień. */
const glowCache = new Map<string, HTMLCanvasElement>();
function glowSprite(col: number, rad: number): HTMLCanvasElement {
  rad = Math.max(2, Math.round(rad));
  const key = `${col}|${rad}`;
  let c = glowCache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = rad * 2;
  const g = c.getContext('2d')!, hex = PAL[col];
  const grad = g.createRadialGradient(rad, rad, 0, rad, rad, rad);
  grad.addColorStop(0, hex);
  grad.addColorStop(0.35, `${hex}99`);
  grad.addColorStop(1, `${hex}00`);
  g.fillStyle = grad;
  g.fillRect(0, 0, rad * 2, rad * 2);
  glowCache.set(key, c);
  return c;
}

/** Światło addytywne (tryb 'lighter'): wszystkie poświaty z `fn` rozjaśniają to, co pod nimi. */
function lit(g: CanvasRenderingContext2D, fn: (glow: (x: number, y: number, rad: number, col: number, a: number) => void) => void): void {
  const prevOp = g.globalCompositeOperation, prevA = g.globalAlpha;
  g.globalCompositeOperation = 'lighter';
  fn((x, y, rad, col, a) => { g.globalAlpha = prevA * a; g.drawImage(glowSprite(col, rad), Math.round(x - rad), Math.round(y - rad)); });
  g.globalCompositeOperation = prevOp;
  g.globalAlpha = prevA;
}

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

/** Biom, dla którego zlecono już wstępne budowanie grafik. */
let warmedBiome = -1;

/** Zleca zbudowanie z wyprzedzeniem dekoracji i kompozycji biomu oraz wszystkich klatek wrogów i bohatera. */
function queueBiomeWarm(run: Run, biome: number): void {
  const names: string[] = [];
  for (let k = 0; k < PROP_KINDS; k++) names.push(`prop${biome}@${k}`);
  for (let k = 0; k < LANDMARK_KINDS; k++) names.push(`lm${biome}@${k}`);
  for (const sprite of new Set([...Object.values(ENEMIES).map((e) => e.sprite), run.heroSprite.split('~')[0]])) {
    for (const f of new Set(ANIM[sprite]?.seq ?? [0])) names.push(`${sprite}@${f}`);
  }
  queueWarm(names);
}

export function renderWorld(run: Run, r: Renderer): void {
  r.beginWorld();
  drawWorld(run, r);
  r.endWorld();
}

/** Świat w pikselach logicznych świata (VW × VH, renderer powiększa je o przybliżenie). */
function drawWorld(run: Run, r: Renderer): void {
  const g = r.g;
  const shx = run.shake > 0 ? rng.range(-run.shake, run.shake) * ZOOM : 0;
  const shy = run.shake > 0 ? rng.range(-run.shake, run.shake) * ZOOM : 0;
  const ox = Math.round(run.camX * ZOOM + shx), oy = Math.round(run.camY * ZOOM + shy);
  const X = (x: number) => Math.round(x * ZOOM) - ox;
  const Y = (y: number) => Math.round(y * ZOOM) - oy;
  const vis = (x: number, y: number) => {
    const sx = X(x), sy = Y(y);
    return sx > -MARGIN && sx < VW + MARGIN && sy > -MARGIN && sy < VH + MARGIN;
  };
  const p = run.player;
  const px = X(p.x), py = Y(p.y);

  // Podłoże: kompozycja trawy, ziemi, ścieżek i posadzek ruin (gfx/ground.ts) w kawałkach z pamięci podręcznej.
  const biome = run.levelInfo.biome, B = BIOMES[biome], seed = run.depth * 7919 + biome * 101 + 17;
  const res = r.worldDensity();
  const c0 = Math.floor(ox / CHUNK), c1 = Math.floor((ox + VW) / CHUNK), r0 = Math.floor(oy / CHUNK), r1 = Math.floor((oy + VH) / CHUNK);
  // Budżet budowania: kilka ms na klatkę; na starcie poziomu (nic gotowego na ekranie) budujemy od razu wszystko widoczne.
  let ready = false;
  for (let cy = r0; cy <= r1 && !ready; cy++) for (let cx = c0; cx <= c1; cx++) if (groundReady(seed, cx, cy, res)) { ready = true; break; }
  groundFrame(ready ? GROUND_BUDGET : 1000);
  for (let cy = r0; cy <= r1; cy++) {
    for (let cx = c0; cx <= c1; cx++) {
      const chunk = groundChunk(B, seed, cx, cy, res);
      if (chunk) g.drawImage(chunk, cx * CHUNK - ox, cy * CHUNK - oy, CHUNK, CHUNK);
      else { g.fillStyle = groundBase(B); g.fillRect(cx * CHUNK - ox, cy * CHUNK - oy, CHUNK, CHUNK); }
    }
  }
  // Z wyprzedzeniem: pierścień kawałków tuż poza ekranem (z resztą budżetu), żeby przy chodzeniu były już gotowe.
  for (let cy = r0 - 1; cy <= r1 + 1; cy++) for (let cx = c0 - 1; cx <= c1 + 1; cx++) {
    if (cy < r0 || cy > r1 || cx < c0 || cx > c1) groundChunk(B, seed, cx, cy, res, true);
  }
  if (warmedBiome !== biome) { warmedBiome = biome; queueBiomeWarm(run, biome); }
  warmStep(WARM_BUDGET);
  drawScenery(g, ox, oy, biome, seed);

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

  // Przyciemnienie tła (Ustawienia): podłoże i dekoracje ciemniejsze, wszystko, co żyje, odcina się od nich.
  if (run.bgDim > 0) r.withAlpha(run.bgDim, () => r.rect(0, 0, VW, VH, C.black));

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
      r.circle(px, py, rad, run.blink(20, 10) ? w.def.color : C.orange);
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
          if (run.blink(8, 5)) r.circle(zx, zy, zr, C.red);
          const fall = Math.max(0, 1 - z.t / z.delay);
          drawSprite(g, 'eb_orange', zx + fall * 45, zy - fall * 135, { scale: 2 });
          break;
        }
        case 'mine':
          drawShadow(g, zx, zy + 5, 10);
          drawSprite(g, z.t > 0.4 && run.blink(20, 10) ? 'mine1' : 'mine0', zx, zy);
          break;
        case 'net':
          drawNet(r, zx, zy, zr, z.t, z.life);
          break;
        case 'rain':
          r.withAlpha(0.12, () => r.circle(zx, zy, zr, C.gold, true));
          r.circle(zx, zy, zr, C.gold);
          // Spadające strzały: drzewce z obwódką, stalowy grot, białe lotki; część właśnie wbija się w ziemię (pył).
          for (let k = 0; k < 9; k++) {
            // Każda strzała: cykl 0.35 s, w każdym cyklu nowe (stałe w cyklu) miejsce, spada z wysokości 22 do ziemi.
            const u = z.t / 0.35 + k / 9, cyc = Math.floor(u), ph = u - cyc;
            const h1 = Math.sin(cyc * 12.9898 + k * 78.233 + z.x) * 43758.5453, h2 = Math.sin(cyc * 39.346 + k * 11.135 + z.y) * 24634.6345;
            const a = (h1 - Math.floor(h1)) * Math.PI * 2, d = Math.sqrt(h2 - Math.floor(h2)) * zr * 0.85, fall = (1 - Math.min(1, ph / 0.75)) * 22;
            const ax = zx + Math.cos(a) * d, ay = zy + Math.sin(a) * d * 0.8;
            const hx = ax, hy = ay - fall, tx = hx + 3, ty = hy - 13;
            r.line(tx, ty, hx, hy, C.ddbrown, 2);
            r.line(tx, ty, hx, hy, C.clay, 1);
            r.rect(hx - 1, hy - 1, 2, 2, C.lgray);
            r.rect(tx - 1, ty - 1, 2, 1, C.white);
            r.rect(tx + 0.5, ty, 1, 2, C.white);
            if (fall <= 0) r.withAlpha(0.6, () => r.ellipse(ax, ay + 1, 3, 1.2, C.tan));
          }
          break;
        case 'curse':
          // Bagno dusz: zielono-fioletowa toń z bąblami i ognikami.
          r.withAlpha(0.22, () => r.circle(zx, zy, zr, C.dgreen, true));
          r.circle(zx, zy, zr, run.blink(30, 15) ? C.lime : C.plum);
          for (let k = 0; k < 4; k++) r.rect(zx + rng.range(-zr, zr) * 0.7, zy + rng.range(-zr, zr) * 0.7, 2, 2, k % 2 ? C.lime : C.pink);
          break;
        case 'holy':
          // Uświęcona ziemia: złoty krąg z unoszącymi się iskrami światła.
          r.withAlpha(0.18, () => r.circle(zx, zy, zr, C.yellow, true));
          r.circle(zx, zy, zr, run.blink(30, 15) ? C.gold : C.yellow);
          r.circle(zx, zy, zr * 0.6, C.cream);
          for (let k = 0; k < 4; k++) r.rect(zx + rng.range(-zr, zr) * 0.7, zy + rng.range(-zr, zr) * 0.7 - rng.range(0, 6), 1, 2, k % 2 ? C.white : C.yellow);
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
    if (!e.dead && !e.hidden && vis(e.x, e.y)) drawShadow(g, X(e.x), Y(e.y) + e.radius * ZOOM * e.scale * 0.9, e.radius * 3 * e.scale * (1 - e.z / 30));
  }
  if (run.outcome !== 'dead') drawShadow(g, px, py + 8, 13);
  for (const t of run.turrets.items) drawShadow(g, X(t.x), Y(t.y) + 7, 12);

  // Loch: mrok i kamienne ściany areny.
  if (run.dungeon) {
    const d = run.dungeon, R = BAL.events.arenaR * ZOOM;
    r.withAlpha(0.4, () => r.rect(0, 0, VW, VH, C.black));
    const cx = X(d.cx), cy = Y(d.cy);
    r.withAlpha(0.25, () => r.circle(cx, cy, R, C.plum, true));
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2, wx = cx + Math.cos(a) * (R + 4), wy = cy + Math.sin(a) * (R + 4);
      if (wx < -10 || wy < -10 || wx > VW + 10 || wy > VH + 10) continue;
      r.rect(wx - 4, wy - 4, 9, 9, C.black);
      r.rect(wx - 3, wy - 3, 7, 7, i % 3 ? C.dgray : C.slate);
      r.rect(wx - 3, wy - 3, 7, 1, C.lavender);
    }
  }

  // Sieci Pajęczarzy: szare promienie i okręgi.
  for (const w of run.webs) {
    if (!vis(w.x, w.y)) continue;
    const wx = X(w.x), wy = Y(w.y), wr = w.r * ZOOM;
    r.withAlpha(Math.min(0.7, w.t), () => {
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; r.line(wx, wy, wx + Math.cos(a) * wr, wy + Math.sin(a) * wr, C.lgray); }
      r.circle(wx, wy, wr, C.lgray);
      r.circle(wx, wy, wr * 0.55, C.lavender);
    });
  }

  // Arena bossa: zwężający się krąg kamiennych bloków, poza nim mrok.
  if (run.arena) {
    const a = run.arena, cx = X(a.x), cy = Y(a.y), R = a.r * ZOOM, n = Math.max(48, Math.round(a.r / 4));
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2, wx = cx + Math.cos(ang) * (R + 4), wy = cy + Math.sin(ang) * (R + 4);
      if (wx < -10 || wy < -10 || wx > VW + 10 || wy > VH + 10) continue;
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
      if (t.secret && run.blink(50, 12)) { r.rect(tx - 1, ty - 10, 2, 8, C.pink); r.rect(tx + 1, ty - 4, 2, 2, C.hotpink); }
    }
    else drawSprite(g, 'tbarrel', tx, ty - 4, { flash: t.t > 0 && run.blink(4, 2) });
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
      drawSprite(g, `barrow@${run.blink(40, 20) ? 1 : 0}`, ox, oy - 4);
    } else if (o.kind === 'sword') {
      if (run.blink(30, 15)) r.rect(ox + 3, oy - 12, 2, 2, C.white);
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
      // Zabójstwa w tym kręgu liczą się do zadania.
      r.withAlpha(0.5, () => r.circle(tx, ty, Math.round(BAL.tasks.totemKillR * ZOOM), C.lime));
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
      if (e && vis(e.x, e.y) && run.blink(20, 14)) {
        const ex = X(e.x), ey = Y(e.y - e.radius) - 10;
        r.rect(ex - 3, ey - 4, 7, 3, C.black); r.rect(ex - 2, ey - 3, 5, 1, C.red); r.rect(ex - 1, ey - 2, 3, 2, C.red); r.rect(ex, ey, 1, 1, C.red);
      }
    }
  }

  // Znajdźki.
  // Poświaty kryształów pod nimi (pełne efekty).
  if (fancy) lit(g, (glow) => {
    let n = 0;
    for (const gm of run.gems.items) {
      if (n > 150 || !vis(gm.x, gm.y)) continue;
      n++;
      glow(X(gm.x), Y(gm.y), gm.value < 25 ? 9 : 14, C.cyan, 0.28 + 0.1 * Math.sin(run.time * 3 + gm.x * 0.07));
    }
  });
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
      if (it.item.super && run.blink(16, 10)) {
        for (const [ox, oy] of [[-11, -8], [10, -4], [-6, 6], [8, 9]]) r.rect(sx + ox, sy + oy + bob, 2, 2, C.yellow);
      }
    }
    drawShadow(g, sx, sy + 7, 10);
    drawSprite(g, it.kind, sx, sy + bob);
  }

  // Wieżyczki (karty z tagiem Przywołania).
  for (const t of run.turrets.items) {
    if (t.life > 1.5 || run.blink(8, 5)) drawSprite(g, 'turret', X(t.x), Y(t.y));
  }

  // Sługi (duchy): półprzezroczyste, migają przed zniknięciem.
  for (const m of run.minions.items) {
    if (!vis(m.x, m.y) || (m.life < 1.5 && !run.reduceFlash && run.step % 8 >= 5)) continue;
    const name = m.holy ? (m.big ? 'angelbig' : 'angel') : m.big ? 'wraithbig' : 'wraith';
    r.withAlpha(0.85, () => drawSprite(g, `${name}@${animFrame(name, run.step, m._i * 5)}`, X(m.x), Y(m.y) - 2, { flipX: m.x > p.x }));
  }

  // Wrogowie.
  for (const e of run.enemies.items) {
    if (e.dead || !vis(e.x, e.y)) continue;
    const ex = X(e.x), ey = Y(e.y);
    if (e.elite) r.circle(ex, ey + e.radius * ZOOM, e.radius * ZOOM * 1.2, run.blink(30, 15) ? C.yellow : C.orange);
    if (e.boss && e.invuln > 0 && !run.reduceFlash && run.step % 6 < 3) continue;
    drawTell(r, run, e, ex, ey);
    if (e.hidden) continue;
    drawSprite(g, `${e.sprite}@${animFrame(e.sprite, run.step, e.uid * 7)}`, ex, ey - e.z * ZOOM, { flash: e.flash > 0, scale: e.scale, flipX: e.x > p.x });
    // Boss: zapowiedzi ataków — kurczący się krąg przed nazwanym atakiem, linia szarży (unik ma być czytelny).
    if (e.boss && e.invuln <= 0) {
      if (e.actT > 0 && e.actT < 0.6) {
        const k = e.actT / 0.6, R = (e.radius * e.scale + 6 + 30 * k) * ZOOM;
        r.withAlpha(0.8 - 0.5 * k, () => r.circle(ex, ey, R, C.yellow));
      }
      // Zapowiedź rodzaju ataku (0.33): linia w gracza, rozszerzający się pierścień wokół bossa albo zaciskający się krąg pod graczem.
      if (e.actT > 0 && e.actT < BOSS_TELL) {
        const k = 1 - e.actT / BOSS_TELL, kind = BOSS_TELLS[bossStyle(run, e.phase)][e.phase][e.nextAlt], on = run.blink(8, 5) ? 0.9 : 0.5;
        if (kind === 'aim') {
          const a = Math.atan2(p.y - e.y, p.x - e.x), L = 220 * ZOOM;
          r.withAlpha(0.3 + 0.25 * k, () => r.line(ex, ey, ex + Math.cos(a) * L, ey + Math.sin(a) * L, C.red, 6));
          r.withAlpha(on, () => r.line(ex, ey, ex + Math.cos(a) * L * k, ey + Math.sin(a) * L * k, C.red, 2));
        } else if (kind === 'ring') {
          r.withAlpha(on, () => r.circle(ex, ey, (e.radius * e.scale + 10 + 70 * k) * ZOOM, C.red));
        } else if (kind === 'player') {
          const R = (90 - 60 * k) * ZOOM;
          r.withAlpha(on, () => r.circle(X(p.x), Y(p.y), R, C.red));
          r.withAlpha(0.12, () => r.circle(X(p.x), Y(p.y), R, C.red, true));
        }
      }
      if (e.dashT > 0.5) {
        const d = Math.hypot(e.dvx, e.dvy) || 1, L = 0.5 * d * ZOOM;
        r.withAlpha(run.blink(6, 3) ? 0.7 : 0.35, () => r.line(ex, ey, ex + (e.dvx / d) * L, ey + (e.dvy / d) * L, C.red, 3));
      }
    }
    // Tarczownik: łuk tarczy w kierunku, w którym patrzy.
    if (e.def.behavior === 'shield') {
      const R = (e.radius + 4) * ZOOM * e.scale, arc = BAL.newEnemies.shieldArc;
      for (let a = e.shootA - arc; a <= e.shootA + arc; a += 0.12) {
        r.rect(ex + Math.cos(a) * R - 1, ey + Math.sin(a) * R - 1, 3, 3, C.black);
        r.rect(ex + Math.cos(a) * R, ey + Math.sin(a) * R, 2, 2, C.lgray);
      }
    }
    // Stany żywiołów: płomyki (podpalenie), szron (spowolnienie lodem), iskry (porażenie), bąbelki (trucizna).
    if (e.burnT > 0 || e.slowT > 0 || e.shockT > 0 || e.poisonT > 0) {
      const top = ey - e.radius * ZOOM * e.scale, ph = (run.step + e.uid * 5) % 12;
      if (e.burnT > 0) { r.rect(ex - 3 + (ph % 6), top - 2 - (ph >> 1), 2, 2, ph < 6 ? C.orange : C.yellow); }
      if (e.slowT > 0) { r.withAlpha(0.35, () => r.circle(ex, ey, e.radius * ZOOM * e.scale + 1, C.cyan)); }
      if (e.shockT > 0 && ph < 4) { r.rect(ex + 3, top + 1, 1, 3, C.yellow); r.rect(ex + 2, top + 2, 3, 1, C.white); }
      if (e.poisonT > 0) { r.rect(ex - 4 + ((ph * 3) % 8), top + 2 - (ph % 4), 2, 2, C.lime); }
      // Kształty żywiołów (Ustawienia, dla daltonistów): rząd znaczników nad wrogiem.
      if (run.elemShapes) {
        const marks = ([['fire', e.burnT], ['ice', e.chill > 0 ? e.slowT : 0], ['lightning', e.shockT], ['poison', e.poisonT]] as const).filter(([, t]) => t > 0);
        marks.forEach(([el], k) => drawElemMark(r, el, ex + (k - (marks.length - 1) / 2) * 8, top - 8));
      }
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

  // Szał Borguna: jeden spokojnie pulsujący czerwony pierścień.
  if (run.rageT > 0 && run.outcome !== 'dead') {
    r.withAlpha(0.45 + 0.2 * Math.sin(run.time * 8), () => r.circle(px, py, 15, C.red));
  }
  // Znacznik gracza (Ustawienia): cienka elipsa na ziemi pod stopami (część sceny, nie nakładka).
  if (run.playerMarker && run.outcome !== 'dead') {
    const pr = 10 + Math.sin(run.time * 4) * 0.8;
    r.withAlpha(0.5, () => r.ellipse(px, py + 9, pr, pr * 0.42, run.player.hurtCd > 0 ? C.red : C.gold));
  }
  // Gracz (miganie przy nietykalności).
  // Ograniczenie błysków: zamiast migania stałe półprzezroczyste.
  const blink = (p.hurtCd > 0 || p.iframes > 0) && !run.reduceFlash && run.step % 6 < 3;
  const ghost = (p.hurtCd > 0 || p.iframes > 0) && run.reduceFlash;
  if (!blink && run.outcome !== 'dead') r.withAlpha(ghost ? 0.55 : 1, () => {
    const scale = ult.def.kind === 'titan' && ult.activeT > 0 ? 2 : 1;
    const frame = p.moving || p.dashT > 0 ? animFrame(run.heroSprite, run.step, 0) : 0;
    drawSprite(g, `${run.heroSprite}@${frame}`, px, py, { flash: p.flash > 0 && !run.reduceFlash, scale, flipX: p.fx < 0 });
  });
  if (p.shield > 0) {
    // Tarcza: jeden czytelny pierścień (bez nakładających się poświat).
    r.withAlpha(0.6, () => r.circle(px, py + 1, 13, C.cyan));
  }
  // Rdzeń trafienia (BAL.playerBulletR) widoczny tylko, gdy pocisk jest blisko — wiadomo, jak blisko można go minąć.
  if (run.outcome !== 'dead' && run.bullets.items.some((b) => (b.x - p.x) ** 2 + (b.y - p.y) ** 2 < CORE_SHOW * CORE_SHOW)) {
    r.withAlpha(0.85, () => { r.rect(px - 1.5, py - 1.5, 3, 3, C.black); r.rect(px - 0.5, py - 0.5, 1, 1, C.white); });
  }
  // Mały pasek HP pod graczem: przez chwilę po trafieniu (wygasa) i stale przy niskim życiu.
  if (p.hp < hpSeen.hp - 0.5 || hpSeen.run !== run) hpSeen.at = run.totalTime;
  hpSeen.hp = p.hp; hpSeen.run = run;
  const frac = Math.max(0, p.hp / run.stats.maxHp), since = run.totalTime - hpSeen.at;
  const barA = frac < 0.3 ? 0.85 : since < HP_BAR_SHOW ? Math.min(0.85, (HP_BAR_SHOW - since) * 2) : 0;
  if (barA > 0 && p.hp < run.stats.maxHp && run.outcome !== 'dead') r.withAlpha(barA, () => {
    r.rect(px - 8, py + 13, 16, 2, C.black);
    r.rect(px - 8, py + 13, 16 * frac, 1.5, since < 0.15 ? C.white : C.red);
  });

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
    // Poświaty pocisków gracza (pełne efekty, do 200 naraz).
    if (fancy) lit(g, (glow) => {
      let n = 0;
      for (const pr of run.projectiles.items) {
        if (n > 200 || pr.kind === 'wave' || !vis(pr.x, pr.y)) continue;
        n++;
        glow(X(pr.x), Y(pr.y), 10, C.peach, 0.3);
      }
    });
    for (const pr of run.projectiles.items) {
      if (!vis(pr.x, pr.y)) continue;
      const x = X(pr.x), y = Y(pr.y);
      if (pr.kind === 'arrow') {
        const dir = (Math.round((Math.atan2(pr.vy, pr.vx) / (Math.PI * 2)) * ARROW_DIRS) + ARROW_DIRS) % ARROW_DIRS;
        drawSprite(g, `${pr.forceCrit ? 'arrowc' : 'arrow'}@${dir}`, x, y);
      } else if (pr.kind === 'boomerang') {
        drawSprite(g, `boom${Math.floor(pr.t * 16) & 3}`, x, y);
      } else if (pr.kind === 'wave') {
        // Fala ostrza: półksiężyc wypukły w stronę lotu, blednie pod koniec.
        const d = Math.atan2(pr.vy, pr.vx), rr = pr.radius * ZOOM;
        r.withAlpha(Math.min(1, pr.life * 4), () => {
          for (let a = d - 1.1; a <= d + 1.1; a += 0.12) {
            r.rect(x - Math.cos(d) * rr * 0.5 + Math.cos(a) * rr, y - Math.sin(d) * rr * 0.5 + Math.sin(a) * rr, 3, 3, C.lgray);
            r.rect(x - Math.cos(d) * rr * 0.5 + Math.cos(a) * (rr - 2), y - Math.sin(d) * rr * 0.5 + Math.sin(a) * (rr - 2), 2, 2, C.white);
          }
        });
      } else {
        drawSprite(g, pr.sprite, x, y);
      }
    }
  });

  // Pociski wrogów: najpierw poświaty (jedna zmiana przezroczystości dla wszystkich), potem kule.
  // Przy bardzo dużej liczbie pocisków poświaty są pomijane (wydajność).
  if (fancy && run.bullets.count < 600) {
    lit(g, (glow) => {
      for (const b of run.bullets.items) if (vis(b.x, b.y)) glow(X(b.x), Y(b.y), b.radius * ZOOM + 8, BULLET_GLOW[b.sprite] ?? C.red, 0.55);
    });
  }
  // Wyraźne pociski (Ustawienia): ciemna obwódka pod każdym pociskiem.
  // Krótki ślad za pociskiem (dwa bledsze odbicia wstecz wzdłuż lotu) i jasny rdzeń: wrogie pociski są okrągłe,
  // ze śladem i rdzeniem, pociski gracza — wydłużone, bez śladu. Przy bardzo wielu pociskach ślad jest pomijany.
  const trails = run.bullets.count < 700;
  for (const b of run.bullets.items) {
    if (!vis(b.x, b.y)) continue;
    const bx = X(b.x), by = Y(b.y);
    if (trails) {
      const sp = Math.hypot(b.vx, b.vy) || 1, k = Math.min(1, 60 / sp) * 0.045 * ZOOM;
      r.withAlpha(0.18, () => drawSprite(g, b.sprite, bx - b.vx * k * 2, by - b.vy * k * 2));
      r.withAlpha(0.38, () => drawSprite(g, b.sprite, bx - b.vx * k, by - b.vy * k));
    }
    if (run.bulletOutline) r.circle(bx, by, b.radius * ZOOM + 1.5, C.black, true);
    drawSprite(g, b.sprite, bx, by);
    r.rect(bx - 0.67, by - 0.67, 1.34, 1.34, C.white);
  }

  // Cząsteczki i efekty (trafienia, wybuchy, błyski) — też ataki gracza.
  atk(() => {
    for (const pt of run.particles.items) {
      // Cząsteczki w drobnych pikselach (2/3 piksela logicznego na stopień rozmiaru), jak detale sprite'ów.
      if (vis(pt.x, pt.y)) r.rect(X(pt.x), Y(pt.y), (pt.size + 1) * 0.67, (pt.size + 1) * 0.67, pt.col);
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
        case 'fade': {
          // Znikający wróg: biały błysk sylwetki, potem bladnięcie i lekkie uniesienie.
          const up = (1 - k) * 4;
          r.withAlpha(k * 0.8, () => drawSprite(g, f.sprite, X(f.x), Y(f.y) - up, { flash: k > 0.7 && !run.reduceFlash, scale: Math.max(1, Math.round(f.r)), flipX: f.a0 === 1 }));
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

  // Wspólne światło sceny (pełne efekty): korekta barwna biomu mnoży całą scenę (ziemia, postacie, pociski razem),
  // potem ciepłe światło bohatera rozjaśnia okolicę. Napisy i znaczniki rysowane później zostają czyste.
  if (fancy) {
    const prev = g.globalCompositeOperation;
    g.globalCompositeOperation = 'multiply';
    r.withAlpha(GRADE, () => r.rect(0, 0, Math.ceil(VW), Math.ceil(VH), BIOMES[run.levelInfo.biome].ambient));
    g.globalCompositeOperation = prev;
    // Światło od stóp bohatera: oświetla ziemię i wszystko wokół, a nie rozbiela samej postaci.
    lit(g, (glow) => { glow(px, py + 10, 150, C.peach, 0.16); glow(px, py + 12, 60, C.yellow, 0.05); });
  }

  // Zwykłe liczby małe, krytyki większe z krótkim „wyskokiem”; wszystkie blakną pod koniec życia.
  for (const n of run.dmgNums.items) {
    if (!vis(n.x, n.y)) continue;
    const pop = n.big && n.life > 0.55 ? 1.25 : 1;
    r.withAlpha(Math.min(1, n.life * 5), () => drawLabel(g, n.text, X(n.x), Y(n.y) - 6, n.col, C.black, n.big ? pop : 0.75));
  }

  // Wydarzenia poziomu: zabarwione niebo i kręgi ostrzegawcze piorunów burzy.
  if (run.levelEvent) {
    const id = run.levelEvent.id;
    r.withAlpha(id === 'storm' ? 0.22 : 0.1, () => r.rect(0, 0, VW, VH, id === 'blood' ? C.dred : id === 'gold' ? C.gold : C.navy));
  }
  for (const s of run.strikes) {
    const sx = X(s.x), sy = Y(s.y), col = s.seed ? C.lime : s.foe ? C.orange : C.cyan, R = (s.r ?? BAL.levelEvents.stormR) * ZOOM;
    r.circle(sx, sy, R, !run.reduceFlash && run.step % 8 < 4 ? C.white : col);
    r.withAlpha(0.15, () => r.circle(sx, sy, R * Math.max(0, 1 - s.t / (s.seed ? BAL.biomeEnemies.mortarDelay : BAL.levelEvents.stormWarn)), col, true));
  }
  if (fancy) g.drawImage(getVignette(), 0, 0, VW, VH);

  // Znaczniki poza ekranem na krawędzi w stronę celu: dobre skrzynie (Rzadki+ albo super-bonus) i cel zadania.
  const marker = (x: number, y: number, col: number) => {
    const dx = X(x) - px, dy = Y(y) - py;
    const k = Math.min((VW / 2 - 12) / Math.max(1, Math.abs(dx)), (VH / 2 - 12) / Math.max(1, Math.abs(dy)));
    const mx = Math.round(px + dx * k), my = Math.round(py + dy * k);
    r.circle(mx, my, 5, C.black, true);
    r.circle(mx, my, 4, col, true);
    if (run.blink(30, 15)) r.rect(mx - 1, my - 1, 2, 2, C.white);
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

/**
 * Sieć (E Kestry, Sidła; kolory jak na ikonie ab_k_net): rozwija się przy rzucie, ukośne oczka ze sznurka przycięte do koła, węzły na skrzyżowaniach,
 * grubsza lina na obwodzie z obciążnikami; cień pod spodem i wygaszenie pod koniec.
 */
function drawNet(r: Renderer, x: number, y: number, R0: number, t: number, life: number): void {
  const open = 1 - (1 - Math.min(1, t / 0.18)) ** 3, R = R0 * (0.35 + 0.65 * open);
  const a = Math.min(1, (life - t) / 0.3, 0.25 + open);
  r.withAlpha(a, () => {
    r.withAlpha(0.22, () => r.circle(x, y + 2, R, C.black, true));
    r.withAlpha(0.1, () => r.circle(x, y, R, C.lgray, true));
    // Dwie rodziny ukośnych linek (±35°): cięciwy koła w stałych odstępach.
    const sp = Math.max(6, R / 3.2), dirs = [0.6, -0.6].map((q) => [Math.cos(q), Math.sin(q)] as const);
    for (const [dx, dy] of dirs) {
      const nx = -dy, ny = dx;
      for (let k = -R + sp / 2; k < R; k += sp) {
        const h = Math.sqrt(Math.max(0, R * R - k * k)) * 0.96, cx = x + nx * k, cy = y + ny * k;
        r.line(cx - dx * h, cy - dy * h, cx + dx * h, cy + dy * h, C.slate, 2);
        r.line(cx - dx * h, cy - dy * h, cx + dx * h, cy + dy * h, C.lgray, 1);
      }
    }
    // Węzły: przecięcia linek wewnątrz koła.
    const [[ax, ay], [bx, by]] = dirs, det = (-ay) * bx - ax * (-by);
    for (let i = -R + sp / 2; i < R; i += sp) {
      for (let j = -R + sp / 2; j < R; j += sp) {
        // Punkt P - c spełnia n1·P = i, n2·P = j (n = prostopadła do kierunku).
        const px = (i * bx - ax * j) / det, py = ((-ay) * j - (-by) * i) / det;
        if (px * px + py * py > R * R * 0.85) continue;
        r.rect(x + px - 1, y + py - 1, 2, 2, C.slate);
        r.rect(x + px - 0.5, y + py - 1, 1, 1, C.white);
      }
    }
    // Lina na obwodzie i obciążniki.
    r.circle(x, y, R + 0.5, C.slate);
    r.circle(x, y, R - 0.5, C.lavender);
    for (let k = 0; k < 8; k++) {
      const q = (k / 8) * Math.PI * 2 + 0.2, wx = x + Math.cos(q) * R, wy = y + Math.sin(q) * R;
      r.rect(wx - 1.5, wy - 1.5, 3, 3, C.dgray);
      r.rect(wx - 1.5, wy - 1.5, 1.5, 1, C.lgray);
    }
  });
}

/**
 * Zapowiedzi ataków wrogów biomów (0.30): linia szarży (Dzik), cień lądowania (Ropucha), zmarszczki i bulgotanie
 * pod ziemią (Topielec), stożek płomienia (Salamandra), linia celownika (Skorpion), linia cięcia (Odbicie).
 * Rysowane pod sprite'em wroga; czerwień = obszar trafienia.
 */
function drawTell(r: Renderer, run: Run, e: Enemy, ex: number, ey: number): void {
  const B = BAL.biomeEnemies;
  switch (e.def.behavior) {
    case 'charger':
    case 'orbiter': {
      const warn = e.def.behavior === 'charger' ? B.chargeTime : B.orbitTime;
      if (e.dashT <= warn) return;
      const sp = Math.hypot(e.dvx, e.dvy) || 1, L = (e.def.behavior === 'charger' ? B.chargeSpeed * B.chargeTime : sp * B.orbitTime) * ZOOM;
      const ux = e.dvx / sp, uy = e.dvy / sp, k = 1 - (e.dashT - warn) / (e.def.behavior === 'charger' ? B.chargeWarn : B.orbitWarn);
      r.withAlpha(0.25, () => r.line(ex, ey, ex + ux * L, ey + uy * L, C.red, 6));
      r.withAlpha(0.8, () => r.line(ex, ey, ex + ux * L * Math.min(1, k + 0.15), ey + uy * L * Math.min(1, k + 0.15), C.red, 2));
      return;
    }
    case 'warden': {
      // Minibossowie: linia szarży albo cień i krąg lądowania skoku Matrony (zapowiedź 0,6 s przed ruchem).
      if (e.dashT <= 0.5) {
        if (e.def.id === 'toadqueen' && e.dashT > 0) r.withAlpha(0.6, () => r.ellipse(ex + (e.tx - e.x) * ZOOM, ey + (e.ty - e.y) * ZOOM + 2, 14 * ZOOM, 6 * ZOOM, C.red));
        return;
      }
      if (e.def.id === 'toadqueen') {
        const tx = ex + (e.tx - e.x) * ZOOM, ty = ey + (e.ty - e.y) * ZOOM;
        r.withAlpha(0.3, () => r.ellipse(tx, ty + 2, 14 * ZOOM, 6 * ZOOM, C.black));
        r.withAlpha(0.8, () => r.ellipse(tx, ty + 2, 14 * ZOOM, 6 * ZOOM, C.red));
        return;
      }
      const L = 0.5 * ZOOM;
      r.withAlpha(0.25, () => r.line(ex, ey, ex + e.dvx * L, ey + e.dvy * L, C.red, 8));
      r.withAlpha(0.8, () => r.line(ex, ey, ex + e.dvx * L, ey + e.dvy * L, C.red, 2));
      return;
    }
    case 'leaper': {
      if (e.dashT <= 0) return;
      const k = 1 - e.dashT / B.leapTime, tx = ex + (e.tx - e.x) * ZOOM, ty = ey + (e.ty - e.y) * ZOOM, R = (5 + 6 * k) * ZOOM;
      r.withAlpha(0.35, () => r.ellipse(tx, ty + 2, R, R * 0.45, C.black));
      r.withAlpha(0.7, () => r.ellipse(tx, ty + 2, R + 1, (R + 1) * 0.45, C.red));
      return;
    }
    case 'burrow': {
      if (!e.hidden) return;
      // Zmarszczki płynące z Topielcem; przed wynurzeniem czerwony krąg ugryzienia i bąble.
      const t = run.totalTime * 3 + e.uid;
      for (let k = 0; k < 2; k++) {
        const q = (t + k * 0.5) % 1, R = (3 + q * 8) * ZOOM;
        r.withAlpha(0.6 * (1 - q), () => r.ellipse(ex, ey + 2, R, R * 0.45, C.cyan));
      }
      if (e.phase === 2) {
        const R = B.burrowR * ZOOM, k = 1 - e.actT / B.burrowWarn;
        r.withAlpha(0.2 + 0.3 * k, () => r.circle(ex, ey, R, C.red, true));
        r.withAlpha(0.9, () => r.circle(ex, ey, R, C.red));
        for (let i = 0; i < 3; i++) r.rect(ex + Math.sin(t * 2 + i * 2) * R * 0.5, ey + Math.cos(t * 3 + i) * R * 0.3, 2, 2, C.lgray);
      }
      return;
    }
    case 'flamer': {
      if (e.dashT <= 0) return;
      const L = 60 * ZOOM, a0 = e.shootA - B.flameCone, a1 = e.shootA + B.flameCone, k = 1 - e.dashT / B.flameWarn;
      r.withAlpha(0.18 + 0.2 * k, () => r.fan(ex, ey, L, a0, a1, C.orange));
      r.withAlpha(0.8, () => { r.line(ex, ey, ex + Math.cos(a0) * L, ey + Math.sin(a0) * L, C.red, 1); r.line(ex, ey, ex + Math.cos(a1) * L, ey + Math.sin(a1) * L, C.red, 1); });
      return;
    }
    case 'sniper': {
      if (e.dashT <= 0) return;
      const L = 260 * ZOOM, locked = e.dashT <= B.snipeAim * 0.4;
      r.withAlpha(locked ? 0.95 : 0.7, () => r.line(ex, ey, ex + Math.cos(e.shootA) * L, ey + Math.sin(e.shootA) * L, locked ? C.red : C.salmon, 1));
      return;
    }
  }
}
