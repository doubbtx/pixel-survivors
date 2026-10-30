import { RELIC_BY_ID } from '../data/relics';
import { W, H, SW, OX, VIEW_W, VIEW_H, type Renderer } from '../core/renderer';
import { itemColor } from '../data/items';
import { ELEMENTS, WEAPON_ELEMENT } from '../data/elements';
import { C, PAL } from '../core/palette';
import type { MapObject, MapObjectKind } from '../systems/events';
import { drawText, textWidth, smallS } from '../core/font';
import { drawSprite } from '../gfx/sprites';
import type { AbilitySlot } from '../data/heroes';
import { BAL } from '../data/balance';
import { abilityMaxCd } from '../systems/abilities';
import { passiveIcon } from '../data/passives';
import { fmt, fmtTime, hpText } from '../util/format';
import type { LoopStats } from '../core/loop';
import { actionKey, abilitySlotPos, ABILITY_SLOT, TOUCH_PAUSE, STICK_R, type Input } from '../core/input';
import type { Run } from '../game/run';
import { drawSynergyHud } from './synergies';
import { resFrac, resMax } from '../systems/resource';
import { taskStatus } from '../systems/tasks';
import { LEVEL_EVENTS, comboGoldMul } from '../systems/levelevents';
import { powerCd } from '../systems/powers';
import { BOSS_POWER_BY_ID } from '../data/enemies';
import { REWARD_LABEL } from '../data/tasks';
import { drawElemMark } from '../gfx/elemmark';
import { situationName, situationRing } from '../systems/situations';
import { UI, SMALL, OUT, tile, meter, iconSlot, cornerTag, label, approach } from './theme';
import { hintShowing } from './hints';

/**
 * HUD (tylko rysowanie; stan gry czyta z `Run`, własny stan animacji trzyma w `HudAnim`; rozmiary i kolory w ui/theme.ts).
 * Układ: cienki pasek XP u góry; lewy górny róg — karta bohatera (portret, życie, zasób, poziom, akt) i pod nią
 * Szał, błogosławieństwa i ikony synergii; środek — zegar, jeden pasek celu z licznikiem, etykiety wydarzenia i kombo;
 * prawy górny róg — zabójstwa i złoto w jednym wierszu, minimapa, zadanie; lewy dół — bronie i pasywki;
 * środek dołu — pasek umiejętności Q/E/Spacja/R (na dotyku prawy dół, większe przyciski).
 */

const ABILITIES: AbilitySlot[] = ['q', 'e', 'dash', 'ult'];

/** Kolory pasków zasobów bohaterów (płaskie). */
const RES_COL = { focus: C.green, fury: C.red, heat: C.orange, souls: C.pink, streak: C.lavender, faith: C.gold, rhythm: C.cyan } as const;
/** Czas rozbłysku gotowości umiejętności (s). */
const READY_FLASH = 0.45;

/** Stan animacji HUD-u dla jednego runu (wygładzone paski, błyski, krycie etykiet). */
interface HudAnim {
  last: number;
  hp: number;
  hpTrail: number;
  trailHold: number;
  /** Błysk paska życia po trafieniu i ostatnia utrata (liczba przy pasku). */
  hitFlash: number;
  hitT: number;
  hitAmt: number;
  hpAbs: number;
  xp: number;
  level: number;
  levelFlash: number;
  gold: number;
  /** Wyświetlane złoto: dolicza się płynnie do `run.gold` (spadki od razu). */
  goldShown: number;
  goldFlash: number;
  combo: number;
  comboText: string;
  ready: Record<AbilitySlot, boolean>;
  readyFlash: Record<AbilitySlot, number>;
}
const anims = new WeakMap<Run, HudAnim>();

function abilityReady(run: Run, sl: AbilitySlot): boolean {
  return sl === 'ult' ? run.ultCharge >= run.ultNeed() : run.abilities[sl].cd <= 0;
}

function animFor(run: Run): HudAnim {
  let a = anims.get(run);
  if (!a) {
    const hp = Math.max(0, run.player.hp / run.stats.maxHp);
    a = {
      last: performance.now(), hp, hpTrail: hp, trailHold: 0, hitFlash: 0, hitT: 0, hitAmt: 0, hpAbs: run.player.hp, xp: run.xp / run.xpNext, level: run.level, levelFlash: 0,
      gold: run.gold, goldShown: run.gold, goldFlash: 0, combo: 0, comboText: '',
      ready: { q: abilityReady(run, 'q'), e: abilityReady(run, 'e'), dash: abilityReady(run, 'dash'), ult: abilityReady(run, 'ult') },
      readyFlash: { q: 0, e: 0, dash: 0, ult: 0 },
    };
    anims.set(run, a);
  }
  return a;
}

/** Aktualizuje animacje HUD-u (czas z zegara przeglądarki — HUD nie wpływa na symulację). */
function tickAnim(run: Run, a: HudAnim): void {
  const now = performance.now(), dt = Math.min(0.1, (now - a.last) / 1000);
  a.last = now;
  const hp = Math.max(0, run.player.hp / run.stats.maxHp);
  // Życie: przy trafieniu pasek błyska, jasny ślad utraconej części zostaje na chwilę i szybko się zwija,
  // a obok paska pojawia się utracona liczba (sumowana przy serii trafień).
  if (run.player.hp < a.hpAbs - 0.5) {
    const lost = a.hpAbs - run.player.hp;
    a.hitAmt = a.hitT > 0 ? a.hitAmt + lost : lost;
    a.hitT = 0.9; a.hitFlash = 0.18;
    a.hpTrail = Math.max(a.hpTrail, a.hp); a.trailHold = 0.22;
  }
  a.hpAbs = run.player.hp;
  a.hitT = Math.max(0, a.hitT - dt);
  a.hitFlash = Math.max(0, a.hitFlash - dt);
  a.hp = approach(a.hp, hp, dt, 25);
  if (a.trailHold > 0) a.trailHold -= dt;
  else a.hpTrail = approach(a.hpTrail, a.hp, dt, 9);
  if (a.hpTrail < a.hp) a.hpTrail = a.hp;
  // Doświadczenie: przy awansie pasek zaczyna od zera, a poziom krótko błyska.
  if (run.level !== a.level) { a.level = run.level; a.levelFlash = 0.8; a.xp = 0; }
  a.xp = approach(a.xp, Math.min(1, run.xp / run.xpNext), dt, 10);
  a.levelFlash = Math.max(0, a.levelFlash - dt);
  // Złoto: krótki błysk licznika przy zdobyciu.
  if (run.gold > a.gold) a.goldFlash = 0.45;
  a.gold = run.gold;
  a.goldShown = run.gold <= a.goldShown ? run.gold : a.goldShown + Math.max(1, (run.gold - a.goldShown) * Math.min(1, dt * 8));
  if (a.goldShown > run.gold) a.goldShown = run.gold;
  a.goldFlash = Math.max(0, a.goldFlash - dt);
  // Kombo: etykieta pojawia się i wygasza płynnie (tekst zostaje na czas wygaszania).
  const comboOn = run.combo >= 10;
  if (comboOn) a.comboText = `Kombo ${run.combo}  +${Math.round((comboGoldMul(run) - 1) * 100)}% zł`;
  a.combo = approach(a.combo, comboOn ? 1 : 0, dt, comboOn ? 12 : 4);
  // Gotowość umiejętności: jeden krótki rozbłysk przy przejściu w stan gotowy.
  for (const sl of ABILITIES) {
    const ready = abilityReady(run, sl);
    if (ready && !a.ready[sl]) a.readyFlash[sl] = READY_FLASH;
    a.ready[sl] = ready;
    a.readyFlash[sl] = Math.max(0, a.readyFlash[sl] - dt);
  }
}

/** Zasięg minimapy w jednostkach świata (połowa szerokości / wysokości). */
const MAP_RX = 300, MAP_RY = 190;

/**
 * Minimapa: tylko to, co ważne — zwykli wrogowie (przygaszone kropki), elity (pomarańczowe z obwódką), boss (różowy,
 * największy), cele i obiekty mapy (kwadraty z ciemną obwódką), skrzynie w kolorze jakości, gracz jako biały krzyżyk.
 */
function drawMinimap(r: Renderer, run: Run, x: number, y: number, w: number, h: number): void {
  const p = run.player, g = r.g;
  // Prawie kryjące tło: świat (kamienie, kryształy) nie prześwituje i nie myli się ze znacznikami.
  tile(r, x, y, w, h, undefined, 0.88);
  const sx = (w / 2 - 2) / MAP_RX, sy = (h / 2 - 2) / MAP_RY;
  const cx = x + w / 2, cy = y + h / 2;
  // Granice wnętrza minimapy (rzutowanie świat → mapa liczone w miejscu, bez krotek na klatkę).
  const x0 = x + 2, y0 = y + 2, x1 = x + w - 2, y1 = y + h - 2;
  // Kształty znaczników (nie tylko kolor): kwadrat, romb, kółko; ciemna obwódka na jasnym tle.
  const mark = (wx: number, wy: number, s: number, col: number, shape: 'sq' | 'dia' | 'dot') => {
    const mx = cx + (wx - p.x) * sx, my = cy + (wy - p.y) * sy;
    if (mx < x0 || my < y0 || mx > x1 || my > y1) return;
    if (shape === 'sq') { r.rect(mx - s / 2 - 0.5, my - s / 2 - 0.5, s + 1, s + 1, C.black); r.rect(mx - s / 2, my - s / 2, s, s, col); return; }
    g.beginPath();
    if (shape === 'dia') { const k = s / 2 + 0.6; g.moveTo(mx, my - k); g.lineTo(mx + k, my); g.lineTo(mx, my + k); g.lineTo(mx - k, my); g.closePath(); }
    else g.arc(mx, my, s / 2 + 0.3, 0, Math.PI * 2);
    g.fillStyle = PAL[col]; g.strokeStyle = PAL[C.black]; g.lineWidth = 0.6;
    g.stroke(); g.fill();
  };
  // Widok ekranu: same narożniki zamiast pełnej ramki.
  const vw = VIEW_W * sx, vh = VIEW_H * sy, vx = cx - vw / 2, vy = cy - vh / 2, L = 3;
  r.withAlpha(0.45, () => {
    for (const [ox, oy, dx, dy] of [[vx, vy, 1, 1], [vx + vw, vy, -1, 1], [vx, vy + vh, 1, -1], [vx + vw, vy + vh, -1, -1]] as const) {
      r.rect(dx > 0 ? ox : ox - L, oy - (dy > 0 ? 0 : UI.line), L, UI.line, C.lavender);
      r.rect(ox - (dx > 0 ? 0 : UI.line), dy > 0 ? oy : oy - L, UI.line, L, C.lavender);
    }
  });
  // Zwykli wrogowie: jedna ścieżka i jedno fill na klatkę (do ~1000 kropek), zaokrąglenie jak Renderer.rect w UI.
  r.withAlpha(0.7, () => {
    g.fillStyle = PAL[C.red];
    g.beginPath();
    for (const e of run.enemies.items) {
      if (e.dead || e.boss || e.elite) continue;
      const mx = cx + (e.x - p.x) * sx, my = cy + (e.y - p.y) * sy;
      if (mx < x0 || my < y0 || mx > x1 || my > y1) continue;
      g.rect(Math.round(mx - 0.5), Math.round(my - 0.5), 1, 1);
    }
    g.fill();
  });
  for (const e of run.enemies.items) if (!e.dead && e.elite && !e.boss) mark(e.x, e.y, 2, C.orange, 'sq');
  for (const it of run.pickups.items) if (it.item) mark(it.x, it.y, 2, itemColor(it.item), 'sq');
  // Obiekty mapy: kapliczki, portale; miecz w kamieniu dopiero z bliska (to sekret).
  for (const o of run.mapObjects) {
    if (o.kind === 'sword' && (o.x - p.x) ** 2 + (o.y - p.y) ** 2 > 250 * 250) continue;
    const col = o.kind === 'shrine' || o.kind === 'fountain' ? C.cyan : o.kind === 'portal' || o.kind === 'stairs' ? C.pink : o.kind === 'exit' ? C.lime : o.kind === 'barrow' ? C.gold : C.yellow;
    mark(o.x, o.y, 2.5, col, 'dot');
  }
  if (run.task) mark(run.task.x, run.task.y, 2.5, C.cyan, 'dot');
  if (run.boss && !run.boss.dead) mark(run.boss.x, run.boss.y, 4, C.pink, 'dia');
  // Gracz: strzałka w kierunku patrzenia (biała z ciemną obwódką).
  const fl = Math.hypot(p.fx, p.fy) || 1, fx = p.fx / fl, fy = p.fy / fl;
  g.beginPath();
  g.moveTo(cx + fx * 3.2, cy + fy * 3.2);
  g.lineTo(cx - fx * 2 - fy * 2.2, cy - fy * 2 + fx * 2.2);
  g.lineTo(cx - fx * 1, cy - fy * 1);
  g.lineTo(cx - fx * 2 + fy * 2.2, cy - fy * 2 - fx * 2.2);
  g.closePath();
  g.fillStyle = PAL[C.white]; g.strokeStyle = PAL[C.black]; g.lineWidth = 0.8;
  g.stroke(); g.fill();
}

/** Nazwy sekretów mapy na strzałkach przy krawędzi ekranu. */
const SECRET_LABEL: Partial<Record<MapObjectKind, string>> = {
  fountain: 'Fontanna', mural: 'Runy', mushroom: 'Grzyby', stairs: 'Schody', barrow: 'Kurhan', grove: 'Gaj', sword: 'Miecz',
};
/** Pęknięta ściana pokazywana strzałką z takiej odległości (jednostki świata). */
const WALL_HINT_R = 400;
/** Odstęp strzałek od krawędzi ekranu (poziomo, pionowo): poza kartą bohatera, minimapą i slotami. */
const ARROW_MX = 26, ARROW_MY = 52;

/**
 * Strzałki przy krawędzi ekranu do sekretów poza widokiem: obiekty mapy (grzyby: najbliższy), biały jeleń
 * i najbliższa pęknięta ściana. Z nazwą i odległością.
 */
function drawSecretArrows(r: Renderer, run: Run): void {
  // Świat na całą szerokość ekranu (SW), interfejs przesunięty o OX: współrzędne strzałek w układzie interfejsu.
  const p = run.player, k = SW / VIEW_W;
  const targets: { x: number; y: number; label: string; col?: number }[] = [];
  let mush: MapObject | null = null;
  const d2 = (x: number, y: number) => (x - p.x) ** 2 + (y - p.y) ** 2;
  for (const o of run.mapObjects) {
    const lb = SECRET_LABEL[o.kind];
    if (!lb) continue;
    if (o.kind === 'mushroom') { if (!mush || d2(o.x, o.y) < d2(mush.x, mush.y)) mush = o; continue; }
    targets.push({ x: o.x, y: o.y, label: lb });
  }
  if (mush) targets.push({ x: mush.x, y: mush.y, label: 'Grzyby' });
  for (const e of run.enemies.items) if (!e.dead && e.def.id === 'stag') targets.push({ x: e.x, y: e.y, label: 'Jeleń' });
  let wall: { x: number; y: number } | null = null;
  for (const t of run.terrain) if (t.secret && t.hp > 0 && d2(t.x, t.y) < WALL_HINT_R ** 2 && (!wall || d2(t.x, t.y) < d2(wall.x, wall.y))) wall = t;
  if (wall) targets.push({ x: wall.x, y: wall.y, label: 'Ściana' });
  // Zapowiedź sytuacji z jednego kierunku: czerwona strzałka z nazwą.
  const sit = run.situation;
  if (sit && !situationRing(sit.id)) targets.push({ x: p.x + Math.cos(sit.a) * 400, y: p.y + Math.sin(sit.a) * 400, label: situationName(sit.id), col: C.red });
  for (const t of targets) {
    const sx = (t.x - run.camX) * k - OX, sy = (t.y - run.camY) * k;
    if (sx > -OX && sx < W + OX && sy > 0 && sy < H) continue;
    const cx = W / 2, cy = H / 2, dx = sx - cx, dy = sy - cy;
    const s = Math.min((W / 2 - ARROW_MX) / Math.max(1e-6, Math.abs(dx)), (H / 2 - ARROW_MY) / Math.max(1e-6, Math.abs(dy)));
    const ax = cx + dx * s, ay = cy + dy * s, a = Math.atan2(dy, dx);
    const tri = (len: number, wid: number, col: number) => {
      r.g.fillStyle = PAL[col];
      r.g.beginPath();
      r.g.moveTo(ax + Math.cos(a) * len, ay + Math.sin(a) * len);
      r.g.lineTo(ax + Math.cos(a + 2.4) * wid, ay + Math.sin(a + 2.4) * wid);
      r.g.lineTo(ax + Math.cos(a - 2.4) * wid, ay + Math.sin(a - 2.4) * wid);
      r.g.fill();
    };
    tri(8, 6, C.black); tri(6.5, 4.5, t.col ?? C.pink);
    // Podpowiedź w grze stoi u góry (dotyk) albo nad umiejętnościami: na jej 6 s zostaje sama strzałka celu.
    if (hintShowing()) continue;
    const text = t.col ? t.label : `${t.label} ${Math.round(Math.sqrt(d2(t.x, t.y)) / 10)}m`, tw = textWidth(text) * smallS() + 6;
    const lx = Math.max(tw / 2 + 2, Math.min(W - tw / 2 - 2, ax - Math.cos(a) * 16)), ly = ay - Math.sin(a) * 12 - 4;
    tile(r, lx - tw / 2, ly - 1, tw, 8, undefined, 0.7);
    drawText(r.g, text, lx, ly - 0.5, t.col ?? C.pink, { align: 'center', ...SMALL });
  }
}

/** Karta bohatera (lewy górny róg): portret z poziomem, życie z tarczą, zasób, akt/głębia. Zwraca dolną krawędź. */
function drawHeroCard(r: Renderer, run: Run, a: HudAnim): number {
  const g = r.g, p = run.player, st = run.stats, { w, h, portrait: ps } = UI.card;
  const x = UI.edge, y = UI.edge + UI.xpH;
  tile(r, x, y, w, h);
  // Portret (przycięty do gniazda) i plakietka poziomu z błyskiem przy awansie.
  const px = x + 3, py = y + 3;
  iconSlot(r, px, py, ps, a.levelFlash > 0 ? UI.xp : UI.border, 0.45);
  g.save();
  g.beginPath(); g.rect(px, py, ps, ps); g.clip();
  drawSprite(g, `${run.heroSprite}@0`, px + ps / 2, py + ps / 2 + 2);
  g.restore();
  const lv = `LV ${run.level}`, lw = textWidth(lv) * smallS() + 4, flash = a.levelFlash > 0 && (run.reduceFlash || a.levelFlash % 0.2 > 0.1);
  r.roundRect(px + ps / 2 - lw / 2, py + ps - 4, lw, 7, 1.5, flash ? C.teal : C.black);
  r.roundFrame(px + ps / 2 - lw / 2, py + ps - 4, lw, 7, 1.5, UI.xp, UI.line);
  drawText(g, lv, px + ps / 2, py + ps - 4.5, a.levelFlash > 0 ? C.white : UI.xp, { align: 'center', scale: smallS() });
  // Życie: aktualna i maksymalna wartość na pasku, ślad utraconego życia, tarcza jako cienka linia pod spodem.
  const bx = px + ps + 4, bw = x + w - 3 - bx;
  meter(r, bx, py, bw, 8, a.hp, UI.life, a.hpTrail, UI.lifeTrail);
  if (a.hitFlash > 0 && !run.reduceFlash) r.withAlpha(a.hitFlash / 0.18 * 0.7, () => r.roundRect(bx, py, bw, 8, 1, C.white));
  if (run.healGlow > 0) r.withAlpha(Math.min(1, run.healGlow * 2), () => r.roundFrame(bx - 0.5, py - 0.5, bw + 1, 9, 1, C.lime, 0.75));
  if (p.shield > 0) r.rect(bx, py + 8.5, bw * Math.min(1, p.shield / st.maxHp), 1, C.cyan);
  drawText(g, hpText(p.hp, st.maxHp, ' / '), bx + bw / 2, py + 0.3, C.white, { align: 'center', scale: 0.75, outline: C.black });
  if (a.hitT > 0) {
    const t = `-${fmt(Math.round(a.hitAmt))}`, up = (0.9 - a.hitT) * 4;
    r.withAlpha(Math.min(1, a.hitT * 3), () => drawText(g, t, x + w + 3, py - up, C.red, { outline: C.black }));
  }
  // Zasób bohatera: płaski pasek z nazwą i wartością.
  const res = run.hero.resource, fr = resFrac(run), ry = py + 11;
  const hot = res.kind === 'heat' && run.res > BAL.resource.heat.burnFrom;
  meter(r, bx, ry, bw, 6, fr, RES_COL[res.kind]);
  if (res.kind === 'heat') r.rect(bx + (bw * BAL.resource.heat.burnFrom) / resMax(run), ry, 0.5, 6, C.yellow);
  if (fr >= 0.99) r.withAlpha(0.25, () => r.roundRect(bx, ry, bw, 6, 1, C.white));
  drawText(g, `${res.name} ${Math.floor(run.res)}`, bx + 2, ry - 1, hot ? C.yellow : C.white, SMALL);
  // Mikiri (Takezo): bieżąca szansa na odbicie po prawej stronie paska zasobu.
  const parry = run.parryChance();
  if (parry > 0) drawText(g, `Parry ${Math.round(parry * 100)}%`, bx + bw - 2, ry - 1, C.cyan, { align: 'right', ...SMALL });
  // Druga linia: akt i głębia (drugorzędnie) i Pakt jako krótki dopisek.
  const ex = run.expedition;
  let lx = bx;
  for (const [text, col] of [[ex ? `Akt ${ex.act}, głębia ${run.depth}` : `Głębia ${run.depth}`, UI.textDim], [run.pactLevel ? `Pakt ${run.pactLevel}` : '', C.red]] as const) {
    if (!text) continue;
    // Dopiski, które nie mieszczą się w karcie, są pomijane (pełna informacja jest w pauzie).
    const tw = textWidth(text) * smallS();
    if (lx + tw > x + w - 2) break;
    drawText(g, text, lx, ry + 6.5, col, SMALL);
    lx += tw + 4;
  }
  return y + h;
}

/** Szał (Borgun) i błogosławieństwa kapliczek: małe wskaźniki z czasem pod kartą bohatera. Zwraca dolną krawędź. */
function drawStatusRow(r: Renderer, run: Run, x: number, y: number): number {
  const chips: { text: string; col: number; frac: number }[] = [];
  if (run.rageT > 0) chips.push({ text: `Szał ${Math.ceil(run.rageT)}s`, col: UI.threat, frac: Math.min(1, run.rageT / Math.max(run.rageT, run.rageMax)) });
  if (run.inBanner) chips.push({ text: `Banner +${Math.round(BAL.eliteTraits.bannerTaken * 100)}% dmg taken`, col: UI.threat, frac: 1 });
  if (run.flowT > 0) chips.push({ text: run.flowT === Infinity ? 'Flow' : `Flow ${Math.ceil(run.flowT)}s`, col: C.cyan, frac: run.flowT === Infinity ? 1 : run.flowT / run.flowMax });
  for (const b of run.buffs) chips.push({ text: Number.isFinite(b.t) ? `${b.name} ${Math.ceil(b.t)}s` : b.name, col: UI.reward, frac: 1 });
  if (!chips.length) return y - UI.gap - 1;
  const maxX = UI.edge + UI.card.w + 60;
  let cx = x;
  for (const c of chips) {
    const w = textWidth(c.text) * smallS() + 8;
    if (cx > x && cx + w > maxX) { cx = x; y += 11; }
    tile(r, cx, y, w, 10, c.col);
    if (c.frac < 1) r.rect(cx + 1, y + 8.5, (w - 2) * c.frac, 0.75, c.col);
    drawText(r.g, c.text, cx + w / 2, y + 0.5, c.col, { align: 'center', ...SMALL });
    cx += w + UI.gap;
  }
  return y + 10;
}

/** Zegar, jeden pasek celu z licznikiem (albo pasek bossa), etykiety wydarzenia i kombo. */
/** Środek górnej krawędzi: zegar, cel albo pasek bossa, wydarzenie i kombo. Zwraca dolną krawędź (baner pod spodem). */
function drawCenter(r: Renderer, run: Run, a: HudAnim): number {
  const g = r.g, cx = W / 2;
  drawText(g, fmtTime(run.time), cx, UI.edge + UI.xpH - 1, C.white, { align: 'center', scale: 1.5, ...OUT });
  let y = UI.edge + UI.xpH + 15;
  if (run.boss) {
    const b = run.boss, bw = 150;
    drawText(g, run.bossTitle ?? run.levelInfo.bossName, cx, y - 1, C.salmon, { align: 'center', ...SMALL });
    meter(r, cx - bw / 2, y + 7, bw, 5, b.hp / b.maxHp, C.pink);
    // Boss słabnie (długa walka): napis z mnożnikiem nad paskiem.
    const soft = run.dungeon ? 1 : run.bossSoftMul(b);
    if (soft > 1) drawText(g, `Weakened x${soft.toFixed(1)}`, cx + bw / 2, y - 1, C.yellow, { align: 'right', ...SMALL });
    drawSprite(g, 'ui_skull', cx - bw / 2 - 8, y + 9.5);
    y += 15;
    const res = run.resistOf(b);
    if (res) { drawText(g, `Odporny na: ${ELEMENTS[res].name}`, cx, y - 1, ELEMENTS[res].color, { align: 'center', ...SMALL }); y += 8; }
  } else if (!run.bossSpawned && !run.scripted) {
    const o = run.levelInfo.objective, bw = 92;
    const kills = !run.dungeon && run.mode !== 'endless' && o.kind === 'kills';
    const text = run.dungeon ? `Loch: fala ${run.dungeon.wave}/${run.dungeon.kind === 'vault' ? BAL.secretsMap.vaultWaves : BAL.events.dungeonWaves}${run.dungeon.cleared ? ', oczyszczony' : ''}`
      : run.mode === 'endless' ? `Boss za ${fmtTime(Math.max(0, run.nextBossAt - run.time))}`
      : o.kind === 'hunt' ? `Hunt: escapes in ${fmtTime(Math.max(0, o.time - run.time + run.huntPaused))}`
      : kills ? `${fmt(run.levelKills)} / ${fmt(o.count)}` : o.kind === 'survive' && o.kills ? `Survive to ${fmtTime(o.time)} or ${fmt(run.levelKills)} / ${fmt(o.kills)}` : `Przetrwaj do ${fmtTime(o.kind === 'survive' ? o.time : 0)}`;
    meter(r, cx - bw / 2, y, bw, 3, run.objectiveProgress(), UI.reward);
    const tw = textWidth(text) * smallS() + (kills ? 10 : 0);
    if (kills) drawSprite(g, 'ui_skull', cx - tw / 2 + 3, y + 8.5);
    drawText(g, text, cx + (kills ? 5 : 0), y + 4, UI.text, { align: 'center', ...SMALL });
    y += 14;
  }
  // Wydarzenie poziomu (stałe, z czasem) i kombo (pojawia się i wygasza) obok siebie.
  const ev = run.levelEvent;
  const items: [string, number, number][] = [];
  if (ev) items.push([`${LEVEL_EVENTS[ev.id].name} ${Math.ceil(ev.t)}s`, LEVEL_EVENTS[ev.id].color, 1]);
  if (a.combo > 0.02) items.push([a.comboText, UI.reward, a.combo]);
  const ws = items.map(([t]) => textWidth(t) * smallS() + 8), total = ws.reduce((s, w) => s + w, 0) + UI.gap * 2 * (items.length - 1);
  let lx = cx - total / 2;
  items.forEach(([t, col, al], i) => {
    // Etykieta wsuwa się lekko z góry przy pojawieniu się i odjeżdża przy wygaszaniu.
    label(r, t, lx + ws[i] / 2, y - (1 - al) * 3, col, al);
    lx += ws[i] + UI.gap * 2;
  });
  return y + (items.length ? 10 : 0);
}

/** Zabójstwa i złoto w jednym wierszu (prawy górny róg, szerokość minimapy). Zwraca dolną krawędź. */
function drawCounters(r: Renderer, run: Run, a: HudAnim): number {
  const g = r.g, y = UI.edge + UI.xpH, right = W - UI.edge;
  const kills = fmt(run.kills), gold = fmt(Math.floor(a.goldShown));
  const kw = textWidth(kills) * smallS(), gw = textWidth(gold) * smallS();
  const x = right - Math.max(kw + gw + 34, UI.minimap.w);
  tile(r, x, y, right - x, 11);
  drawSprite(g, 'ui_skull', x + 7, y + 5.5);
  drawText(g, kills, x + 13, y + 1.5, UI.text, SMALL);
  const gx = right - 4 - gw;
  if (a.goldFlash > 0) r.withAlpha(a.goldFlash, () => r.roundRect(gx - 1, y + 1.5, gw + 2, 8, 1, C.gold));
  drawSprite(g, 'coin', gx - 6, y + 5.5);
  drawText(g, gold, right - 4, y + 1.5, a.goldFlash > 0.2 ? C.white : UI.reward, { align: 'right', ...SMALL });
  return y + 11;
}

/** Panel zadania (pod minimapą): nazwa, nagroda, postęp i pasek czasu. */
function drawTask(r: Renderer, run: Run, x: number, y: number, w: number): void {
  const t = run.task!, g = r.g, rw = REWARD_LABEL[t.def.reward];
  tile(r, x, y, w, 24, t.started ? C.cyan : undefined);
  drawText(g, t.def.name, x + 3, y + 0.5, C.cyan, SMALL);
  drawText(g, rw.name, x + w - 3, y + 0.5, rw.color, { align: 'right', ...SMALL });
  drawText(g, taskStatus(run), x + 3, y + 8, UI.textHi, SMALL);
  meter(r, x + 3, y + 18, w - 6, 3, t.life / t.max, t.started && t.life < 5 ? UI.threat : C.cyan);
}

/** Bronie (górny rząd) i pasywki (dolny rząd): ikony, poziom w rogu, puste gniazda przygaszone bez ramek. */
function drawInventory(r: Renderer, run: Run): void {
  const g = r.g, S = UI.slot, step = S + UI.gap;
  const y1 = H - UI.edge - 2 * S - UI.gap, y2 = H - UI.edge - S;
  for (let i = 0; i < BAL.weaponSlots; i++) {
    const w = run.weapons[i], x = UI.edge + i * step;
    if (!w) { iconSlot(r, x, y1, S, undefined, 0.25); continue; }
    iconSlot(r, x, y1, S, w.def.fused ? C.cyan : w.def.evolved ? UI.reward : UI.border);
    drawSprite(g, w.def.icon, x + S / 2, y1 + S / 2);
    const el = WEAPON_ELEMENT[w.def.id];
    if (el && run.elemShapes) drawElemMark(r, el, x + 4, y1 + 4);
    else if (el) { r.rect(x + 1.5, y1 + 1.5, 3, 3, C.black); r.rect(x + 2, y1 + 2, 2, 2, ELEMENTS[el].color); }
    cornerTag(r, w.def.fused ? '+' : w.def.evolved ? '*' : String(w.level), x + S, y1 + S, w.def.fused ? C.cyan : w.def.evolved ? C.yellow : UI.textHi);
  }
  for (let i = 0; i < BAL.passiveSlots; i++) {
    const pa = run.passives[i], x = UI.edge + i * step;
    if (!pa) { iconSlot(r, x, y2, S, undefined, 0.25); continue; }
    iconSlot(r, x, y2, S, UI.border);
    drawSprite(g, passiveIcon(pa), x + S / 2, y2 + S / 2);
    cornerTag(r, String(pa.level), x + S, y2 + S);
  }
  // Moc bossa: gniazdo za bronią, odnowienie od góry, poziom kreskami.
  if (run.power) {
    const def = BOSS_POWER_BY_ID[run.power.id], x = UI.edge + BAL.weaponSlots * step + 3;
    iconSlot(r, x, y1, S, C.pink);
    drawSprite(g, def.icon, x + S / 2, y1 + S / 2);
    const fr = Math.max(0, Math.min(1, run.powerT / powerCd(run, def)));
    if (fr > 0) r.withAlpha(0.6, () => r.rect(x, y1, S, S * fr, C.black));
    for (let l = 0; l < run.power.level; l++) r.rect(x + 1 + l * 4, y1 - 3, 3, 1.5, C.pink);
  }
  // Relikwie (0.42): złote gniazda za pasywkami; Płaszcz przyciemnia się w czasie odnowienia.
  run.relics.forEach((id, k) => {
    const def = RELIC_BY_ID[id], x = UI.edge + BAL.passiveSlots * step + 3 + k * step;
    if (!def) return;
    iconSlot(r, x, y2, S, C.gold);
    drawSprite(g, def.icon, x + S / 2, y2 + S / 2);
    if (id === 'cloak' && run.cloakCd > 0) r.withAlpha(0.6, () => r.rect(x, y2, S, S * Math.min(1, run.cloakCd / BAL.relics.cloakCd), C.black));
  });
  // Nowy przedmiot w plecaku: krótkie przypomnienie nad gniazdami.
  if (run.bag.some((it) => it.fresh)) {
    const t = '! Nowy przedmiot w plecaku (I)', tw = textWidth(t) * smallS() + 6;
    tile(r, UI.edge, y1 - 12, tw, 9, C.lime);
    drawText(g, t, UI.edge + 3, y1 - 11.5, C.lime, SMALL);
  }
}

/** Pasek umiejętności: odnowienie przez przyciemnienie i licznik, ładunek R od dołu, jeden rozbłysk przy gotowości. */
function drawAbilities(r: Renderer, run: Run, a: HudAnim, touch: boolean): void {
  const g = r.g;
  const S = touch ? ABILITY_SLOT : UI.ability, step = S + UI.abilityGap;
  const x0 = Math.round(W / 2 - (4 * S + 3 * UI.abilityGap) / 2), y0 = H - UI.edge - S;
  if (!touch) r.withAlpha(0.4, () => r.roundRect(x0 - 3, y0 - 4, 4 * step - UI.abilityGap + 6, S + 7, UI.radius + 1, C.black));
  ABILITIES.forEach((sl, i) => {
    const ab = run.abilities[sl];
    const [x, y] = touch ? abilitySlotPos(i) : [x0 + i * step, y0];
    const isUlt = sl === 'ult', ready = a.ready[sl];
    iconSlot(r, x, y, S, ready ? (isUlt ? UI.reward : UI.border) : C.navy, 0.6);
    if (isUlt && !ready) {
      const fr = Math.min(1, run.ultCharge / run.ultNeed());
      r.withAlpha(0.5, () => r.rect(x + 1, y + S - 1 - (S - 2) * fr, S - 2, (S - 2) * fr, C.dbrown));
      r.rect(x + 1, y + S - 1.5, (S - 2) * fr, 1, UI.reward);
    }
    drawSprite(g, ab.def.icon, x + S / 2, y + S / 2);
    if (!isUlt && ab.cd > 0) {
      const fr = Math.min(1, ab.cd / abilityMaxCd(run, sl));
      r.withAlpha(0.5, () => r.rect(x + 0.5, y + 0.5, S - 1, S - 1, C.black));
      r.withAlpha(0.35, () => r.rect(x + 0.5, y + 0.5, S - 1, (S - 1) * fr, C.black));
      drawText(g, ab.cd.toFixed(ab.cd < 1 ? 1 : 0), x + S / 2, y + S / 2 - 6, C.white, { align: 'center', ...OUT });
    }
    if (isUlt && ab.activeT > 0) drawText(g, ab.activeT.toFixed(0), x + S / 2, y + S / 2 - 6, C.white, { align: 'center', ...OUT });
    // Rozbłysk gotowości: jasna ramka rozszerza się i znika (raz, bez ciągłego migania).
    const f = a.readyFlash[sl];
    if (f > 0) {
      const k = f / READY_FLASH, e = (1 - k) * 3;
      r.withAlpha(k, () => r.roundFrame(x - e, y - e, S + 2 * e, S + 2 * e, UI.radius + e, isUlt ? C.yellow : C.white, 1));
      r.withAlpha(k * 0.3, () => r.roundRect(x, y, S, S, UI.radius, C.white));
    }
    // Klawisz: mała plakietka w lewym dolnym rogu; poziom umiejętności kreskami nad gniazdem.
    // Plakietka klawisza (na dotyku bez niej: gniazdo samo jest przyciskiem).
    if (!touch) {
      const kl = sl === 'dash' && actionKey('dash') === 'Space' ? 'Spc' : actionKey(sl), kw = textWidth(kl) * smallS() + 3;
      const kh = smallS() > 0.75 ? 7.5 : 6.5;
      r.withAlpha(0.8, () => r.roundRect(x, y + S - kh, kw, kh, 1, C.black));
      drawText(g, kl, x + 1.5, y + S - kh - (kh > 7 ? 2 : 1), ready ? C.white : UI.textDim, { scale: smallS() });
    }
    if (ab.def.maxLevel > 1) for (let l = 0; l < ab.level; l++) r.rect(x + 1 + l * 4, y - 2.5, 3, 1, UI.reward);
  });
}

/** Statystyki diagnostyczne (F3 lub `): klatki, czas aktualizacji, liczby encji i klawisze testowe. */
function drawDiagnostics(r: Renderer, run: Run, loop: LoopStats, cheats: boolean): void {
  const lines = [
    `FPS ${loop.fps}  update ${loop.updateMs.toFixed(2)} ms`,
    `wrogowie ${run.enemies.count}`,
    `pociski ${run.projectiles.count}  wrogów ${run.bullets.count}`,
    `cząsteczki ${run.particles.count}  XP ${run.gems.count}  efekty ${run.fx.count}`,
    cheats ? 'F4 cel+   F6 awans   F7 łup' : 'Klawisze testowe: Ustawienia, tryb debug',
  ];
  // Pod minimapą po prawej (środek ekranu zostaje dla walki i podpowiedzi).
  const w = 150, x = W - UI.edge - w, y = H / 2 - 20;
  tile(r, x, y, w, lines.length * 8 + 4, C.lime);
  lines.forEach((s, i) => drawText(r.g, s, x + 4, y + 1.5 + i * 8, C.lime, SMALL));
}

/** Krawędzie ekranu: czerwony błysk po trafieniu, spokojne pulsowanie przy niskim życiu (poniżej 30%). */
function drawDanger(r: Renderer, run: Run): void {
  const low = run.player.hp / run.stats.maxHp < 0.3 ? 0.12 + 0.08 * Math.sin(run.totalTime * 4) : 0;
  const edge = Math.max(low, run.hurtFx * 1.4);
  if (edge <= 0) return;
  r.withAlpha(Math.min(0.5, edge), () => {
    const L = -OX, R = W + OX; // krawędzie okna (szeroki ekran)
    r.rect(L, 0, R - L, 3, C.red); r.rect(L, H - 3, R - L, 3, C.red);
    r.rect(L, 0, 3, H, C.red); r.rect(R - 3, 0, 3, H, C.red);
  });
}

/** Rysowanie bloku HUD przesuniętego w poziomie (szeroki ekran: lewy blok −OX, prawy +OX). */
function shifted(r: Renderer, dx: number, draw: () => void): void {
  if (!dx) { draw(); return; }
  r.g.save();
  r.g.translate(dx, 0);
  draw();
  r.g.restore();
}

export function renderHud(run: Run, r: Renderer, loop: LoopStats, diag: boolean, cheats: boolean, minimap: boolean, input: Input): void {
  const g = r.g, a = animFor(run);
  tickAnim(run, a);
  drawDanger(r, run);

  // Cienki pasek doświadczenia na całej szerokości; błysk po zebraniu kryształu i przy awansie.
  // Szeroki ekran (20:9): pasek XP na całą szerokość okna, lewy blok przy lewej krawędzi, prawy przy prawej (OX);
  // środek (czas, cel, baner) zostaje na środku. Na 16:9 OX = 0.
  meter(r, -OX, 0, W + 2 * OX, UI.xpH, a.xp, UI.xp);
  if ((run.xpPulse > 0 || a.levelFlash > 0) && !run.reduceFlash) r.withAlpha(Math.min(0.8, run.xpPulse * 3 + a.levelFlash), () => r.rect(-OX, 0, (W + 2 * OX) * (a.levelFlash > 0 ? 1 : a.xp), UI.xpH, C.white));

  shifted(r, -OX, () => {
    const cardBottom = drawHeroCard(r, run, a);
    const statusBottom = drawStatusRow(r, run, UI.edge, cardBottom + UI.gap + 1);
    drawSynergyHud(r, run, UI.edge, statusBottom + UI.gap + 1, UI.card.w);
    drawInventory(r, run);
  });

  const centerBottom = drawCenter(r, run, a);

  shifted(r, OX, () => {
    let ry = drawCounters(r, run, a) + UI.gap;
    const mw = UI.minimap.w;
    if (minimap) { drawMinimap(r, run, W - UI.edge - mw, ry, mw, UI.minimap.h); ry += UI.minimap.h + UI.gap; }
    if (run.task) drawTask(r, run, W - UI.edge - 96, ry, 96);
  });
  drawSecretArrows(r, run);

  // Baner (zapowiedzi, fazy bossa, elity): wąska wstęga tuż pod środkowym blokiem, wsuwa się i znika. Wysoko, z dala od
  // głowy bohatera, nad którą wylatują napisy serii zabójstw (wcześniej nachodziły na baner).
  if (run.bannerT > 0) {
    const big = run.banner.length <= 26, sc = big ? 1.25 : 0.9;
    const tw = textWidth(run.banner) * sc + 24, th = big ? 15 : 11, by = centerBottom + 3;
    const al = Math.min(1, run.bannerT * 3, (2.5 - run.bannerT) * 6 + 0.2);
    r.withAlpha(al, () => {
      tile(r, W / 2 - tw / 2, by, tw, th, undefined, 0.75);
      r.rect(W / 2 - tw / 2 + 6, by + th - 1, tw - 12, UI.line, UI.reward);
      drawText(g, run.banner, W / 2, by + 1, C.yellow, { align: 'center', scale: sc, ...OUT });
    });
  }

  const touch = input.lastDevice === 'touch';
  drawAbilities(r, run, a, touch);

  // Sterowanie dotykowe: przycisk pauzy i wirtualny joystick (gdy palec jest na ekranie).
  if (touch) {
    const P = TOUCH_PAUSE;
    iconSlot(r, P.x, P.y, P.s, UI.border);
    r.rect(P.x + 6, P.y + 5, 3, 10, C.white);
    r.rect(P.x + 11, P.y + 5, 3, 10, C.white);
    const s = input.stick;
    // Joystick: obręcz z kreskami kierunków i kulka z odblaskiem; bez palca blady zarys w lewym dolnym rogu (gdzie dotknąć).
    const stick = (ox: number, oy: number, kx: number, ky: number, a: number) => r.withAlpha(a, () => {
      r.withAlpha(0.35, () => r.circle(ox, oy, STICK_R, C.black, true));
      r.circle(ox, oy, STICK_R, C.lavender);
      r.circle(ox, oy, STICK_R - 3, C.slate);
      for (const [ux, uy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) r.rect(ox + ux * (STICK_R - 5) - 1, oy + uy * (STICK_R - 5) - 1, 2, 2, C.lgray);
      if (kx || ky) r.withAlpha(0.5, () => r.line(ox, oy, ox + kx, oy + ky, C.cyan, 2));
      r.circle(ox + kx, oy + ky, 9, C.dgray, true);
      r.circle(ox + kx, oy + ky - 1, 8, C.lgray, true);
      r.withAlpha(0.8, () => r.circle(ox + kx - 3, oy + ky - 4, 2.5, C.white, true));
      r.circle(ox + kx, oy + ky, 9, C.black);
    });
    if (s) {
      const dx = s.x - s.ox, dy = s.y - s.oy, d = Math.hypot(dx, dy), k = d > STICK_R ? STICK_R / d : 1;
      stick(s.ox, s.oy, dx * k, dy * k, 1);
    } else stick(UI.edge + STICK_R + 14 - OX, H - 74, 0, 0, 0.3); // nad slotami broni
    if (!s && run.time < 6 && !hintShowing()) {
      drawText(g, 'Dotknij lewej połowy ekranu i przesuń, żeby chodzić', W / 2, H - 60, C.lavender, { align: 'center', ...OUT });
    }
  }

  if (diag) drawDiagnostics(r, run, loop, cheats);
}
