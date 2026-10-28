import { W, H, VIEW_W, VIEW_H, type Renderer } from '../core/renderer';
import { itemColor } from '../data/items';
import { ELEMENTS, WEAPON_ELEMENT } from '../data/elements';
import { C, RAMP, PAL } from '../core/palette';
import type { MapObject, MapObjectKind } from '../systems/events';
import { drawText, textWidth } from '../core/font';
import { drawSprite } from '../gfx/sprites';
import type { AbilitySlot } from '../data/heroes';
import { BAL } from '../data/balance';
import { abilityMaxCd } from '../systems/abilities';
import { PASSIVE_BY_ID } from '../data/passives';
import { fmt, fmtTime } from '../util/format';
import type { LoopStats } from '../core/loop';
import { abilitySlotPos, ABILITY_SLOT, TOUCH_PAUSE, STICK_R, type Input } from '../core/input';
import type { Run } from '../game/run';
import { bar, slot, plate } from './widgets';
import { drawSynergyHud } from './synergies';
import { resFrac, resMax } from '../systems/resource';
import { taskStatus } from '../systems/tasks';
import { LEVEL_EVENTS, comboGoldMul } from '../systems/levelevents';
import { powerCd } from '../systems/powers';
import { BOSS_POWER_BY_ID } from '../data/enemies';
import { REWARD_LABEL } from '../data/tasks';
import { drawElemMark } from '../gfx/elemmark';

const KEY_LABEL: Record<AbilitySlot, string> = { q: 'Q', e: 'E', dash: 'Spc', ult: 'R' };
const OUT = { outline: C.black } as const;
const SLOT = 20;

/**
 * HUD: portret z paskami HP/tarczy, pasek XP, czas i cel poziomu (albo pasek bossa),
 * zabójstwa, złoto i minimapa, synergie (pod portretem), gniazda broni i pasywek, umiejętności z odnowieniem, banery.
 */
/** Zasięg minimapy w jednostkach świata (połowa szerokości / wysokości). */
const MAP_RX = 300, MAP_RY = 200;

/**
 * Minimapa: wrogowie (czerwone kropki), elity (pomarańczowe), boss (różowy, miga), skrzynie w kolorze jakości,
 * prostokąt widoku kamery i gracz w środku.
 */
function drawMinimap(r: Renderer, run: Run, x: number, y: number, w: number, h: number): void {
  const p = run.player;
  plate(r, x, y, w, h);
  r.frame(x, y, w, h, C.slate);
  const sx = (w / 2 - 2) / MAP_RX, sy = (h / 2 - 2) / MAP_RY;
  const cx = x + w / 2, cy = y + h / 2;
  const dot = (wx: number, wy: number, s: number, col: number) => {
    const mx = cx + (wx - p.x) * sx, my = cy + (wy - p.y) * sy;
    if (mx < x + 1 || my < y + 1 || mx > x + w - 1 - s || my > y + h - 1 - s) return;
    r.rect(mx, my, s, s, col);
  };
  r.frame(Math.round(cx - (VIEW_W / 2) * sx), Math.round(cy - (VIEW_H / 2) * sy), Math.round(VIEW_W * sx), Math.round(VIEW_H * sy), C.dgray);
  for (const e of run.enemies.items) {
    if (e.dead || e.boss) continue;
    if (e.elite) dot(e.x - 1, e.y - 1, 2, C.orange);
    else dot(e.x, e.y, 1, C.red);
  }
  for (const it of run.pickups.items) if (it.item) dot(it.x - 1, it.y - 1, 2, itemColor(it.item));
  if (run.boss && run.step % 20 < 14) dot(run.boss.x - 1, run.boss.y - 1, 3, C.pink);
  // Obiekty mapy: kapliczki, portale; miecz w kamieniu dopiero z bliska (to sekret).
  for (const o of run.mapObjects) {
    if (o.kind === 'sword' && (o.x - p.x) ** 2 + (o.y - p.y) ** 2 > 250 * 250) continue;
    const col = o.kind === 'shrine' || o.kind === 'fountain' ? C.cyan : o.kind === 'portal' || o.kind === 'stairs' ? C.pink : o.kind === 'exit' ? C.lime : o.kind === 'barrow' ? C.gold : C.yellow;
    dot(o.x - 1, o.y - 1, 3, col);
  }
  r.rect(cx - 1, cy - 1, 2, 2, C.white);
}

/** Nazwy sekretów mapy na strzałkach przy krawędzi ekranu. */
const SECRET_LABEL: Partial<Record<MapObjectKind, string>> = {
  fountain: 'Fontanna', mural: 'Runy', mushroom: 'Grzyby', stairs: 'Schody', barrow: 'Kurhan', grove: 'Gaj', sword: 'Miecz',
};
/** Pęknięta ściana pokazywana strzałką z takiej odległości (jednostki świata). */
const WALL_HINT_R = 400;
/** Odstęp strzałek od krawędzi ekranu (poziomo, pionowo): poza portretem, minimapą i slotami. */
const ARROW_MX = 30, ARROW_MY = 66;

/**
 * Strzałki przy krawędzi ekranu do sekretów poza widokiem: obiekty mapy (grzyby: najbliższy), biały jeleń
 * i najbliższa pęknięta ściana. Pulsują, z nazwą i odległością.
 */
function drawSecretArrows(r: Renderer, run: Run): void {
  const p = run.player, k = W / VIEW_W;
  const targets: { x: number; y: number; label: string }[] = [];
  let mush: MapObject | null = null;
  const d2 = (x: number, y: number) => (x - p.x) ** 2 + (y - p.y) ** 2;
  for (const o of run.mapObjects) {
    const label = SECRET_LABEL[o.kind];
    if (!label) continue;
    if (o.kind === 'mushroom') { if (!mush || d2(o.x, o.y) < d2(mush.x, mush.y)) mush = o; continue; }
    targets.push({ x: o.x, y: o.y, label });
  }
  if (mush) targets.push({ x: mush.x, y: mush.y, label: 'Grzyby' });
  for (const e of run.enemies.items) if (!e.dead && e.def.id === 'stag') targets.push({ x: e.x, y: e.y, label: 'Jeleń' });
  let wall: { x: number; y: number } | null = null;
  for (const t of run.terrain) if (t.secret && t.hp > 0 && d2(t.x, t.y) < WALL_HINT_R ** 2 && (!wall || d2(t.x, t.y) < d2(wall.x, wall.y))) wall = t;
  if (wall) targets.push({ x: wall.x, y: wall.y, label: 'Ściana' });
  const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 160);
  for (const t of targets) {
    const sx = (t.x - run.camX) * k, sy = (t.y - run.camY) * k;
    if (sx > 0 && sx < W && sy > 0 && sy < H) continue;
    // Punkt na brzegu wewnętrznego prostokąta (omija portret, minimapę i sloty) w kierunku celu.
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
    r.withAlpha(pulse, () => { tri(11, 8, C.black); tri(9, 6, C.hotpink); });
    // Podpis po wewnętrznej stronie strzałki, na płytce.
    const text = `${t.label} ${Math.round(Math.sqrt(d2(t.x, t.y)) / 10)}m`, tw = textWidth(text) * 0.75 + 8;
    const lx = Math.max(tw / 2 + 2, Math.min(W - tw / 2 - 2, ax - Math.cos(a) * 20)), ly = ay - Math.sin(a) * 14 - 4;
    r.withAlpha(0.7, () => r.roundRect(lx - tw / 2, ly - 1, tw, 9, 4, C.black));
    drawText(r.g, text, lx, ly, C.pink, { align: 'center', ...SMALL });
  }
}

/** Rampy pasków zasobów bohaterów. */
const RES_RAMP = { focus: RAMP.green, fury: RAMP.red, heat: RAMP.fire, souls: RAMP.purple, streak: RAMP.stone, faith: RAMP.gold } as const;

/** Małe napisy HUD (3/4 rozmiaru: przy buforze ×4 nadal równe piksele). */
const SMALL = { scale: 0.75, outline: C.black } as const;

/** Pasek zasobu bohatera pod HP: nazwa i wartość na pasku, miganie przy pełnym zasobie i przegrzaniu (żar). */
function drawResource(r: Renderer, run: Run, x: number, y: number, w: number): void {
  const res = run.hero.resource, fr = resFrac(run);
  const hot = res.kind === 'heat' && run.res > BAL.resource.heat.burnFrom;
  bar(r, x, y, w, 8, fr, RES_RAMP[res.kind], C.navy);
  if (res.kind === 'heat') r.rect(x + (w * BAL.resource.heat.burnFrom) / resMax(run), y, 1, 8, C.yellow);
  if ((hot || fr >= 0.95) && run.step % 16 < 8) r.withAlpha(0.4, () => r.roundRect(x + 1, y + 1, w - 2, 6, 2, C.white));
  drawText(r.g, run.rageT > 0 ? `Szał ${Math.ceil(run.rageT)}s` : `${res.name} ${Math.floor(run.res)}`, x + 4, y + 0.5, hot || run.rageT > 0 ? C.yellow : C.white, SMALL);
}

/** Pigułka: zaokrąglona płytka z krótkim napisem w kolorze `col` (wydarzenia, kombo). Zwraca szerokość. */
function pill(r: Renderer, text: string, cx: number, y: number, col: number): void {
  const w = textWidth(text) * 0.75 + 10;
  r.withAlpha(0.7, () => r.roundRect(cx - w / 2, y, w, 9, 4.5, C.black));
  r.roundFrame(cx - w / 2, y, w, 9, 4.5, col, 0.5);
  drawText(r.g, text, cx, y + 0.5, col, { align: 'center', ...SMALL });
}

/** Panel zadania (prawa strona): nazwa, nagroda, postęp i pasek czasu (przed startem: czas do zniknięcia kamienia). */
function drawTask(r: Renderer, run: Run, x: number, y: number): void {
  const t = run.task!, g = r.g, rw = REWARD_LABEL[t.def.reward];
  const w = 110;
  plate(r, x, y, w, 38);
  r.frame(x, y, w, 38, t.started ? C.cyan : C.slate);
  drawText(g, t.def.name, x + 4, y + 1, C.cyan, OUT);
  drawText(g, taskStatus(run), x + 4, y + 12, C.white, OUT);
  drawText(g, rw.name, x + w - 4, y + 12, rw.color, { align: 'right', ...OUT });
  const low = t.started && t.life < 5 && run.step % 20 < 10;
  bar(r, x + 4, y + 27, w - 8, 6, t.life / t.max, low ? RAMP.red : RAMP.blue, C.navy);
}

export function renderHud(run: Run, r: Renderer, loop: LoopStats, debug: boolean, minimap: boolean, input: Input): void {
  const g = r.g;
  const p = run.player;
  const st = run.stats;

  // Krawędzie ekranu: czerwony błysk po trafieniu, pulsowanie przy niskim HP (poniżej 30%).
  const low = p.hp / st.maxHp < 0.3 ? 0.18 + 0.14 * Math.sin(run.totalTime * 7) : 0;
  const edge = Math.max(low, run.hurtFx * 1.6);
  if (edge > 0) {
    r.withAlpha(Math.min(0.6, edge), () => {
      r.rect(0, 0, W, 6, C.red); r.rect(0, H - 6, W, 6, C.red);
      r.rect(0, 0, 6, H, C.red); r.rect(W - 6, 0, 6, H, C.red);
    });
    r.withAlpha(Math.min(0.35, edge * 0.6), () => {
      r.rect(6, 6, W - 12, 4, C.dred); r.rect(6, H - 10, W - 12, 4, C.dred);
      r.rect(6, 6, 4, H - 12, C.dred); r.rect(W - 10, 6, 4, H - 12, C.dred);
    });
  }

  // Pasek XP na całej szerokości.
  bar(r, 0, 0, W, 6, run.xp / run.xpNext, RAMP.blue, C.navy);
  // Błysk paska po zebraniu kryształu.
  if (run.xpPulse > 0) r.withAlpha(run.xpPulse * 3, () => r.rect(1, 1, Math.round((W - 2) * Math.min(1, run.xp / run.xpNext)), 4, C.white));

  // Karta bohatera: portret z poziomem, HP (z tarczą), zasób, poziom kampanii i błogosławieństwa.
  const cw = 174;
  r.withAlpha(0.65, () => r.roundRect(3, 9, cw, 47, 5, C.black));
  r.withAlpha(0.35, () => r.roundFrame(3, 9, cw, 47, 5, C.lavender, 0.5));
  slot(r, 6, 12, 32, C.gold);
  drawSprite(g, `${run.heroSprite}@0`, 22, 28);
  r.roundRect(8, 39, 28, 9, 4.5, C.dbrown, C.ddbrown);
  r.roundFrame(8, 39, 28, 9, 4.5, C.gold, 0.5);
  drawText(g, `LV ${run.level}`, 22, 39.5, C.yellow, { align: 'center', ...SMALL });
  const bx = 42, bw = cw - 44;
  bar(r, bx, 12, bw, 11, p.hp / st.maxHp, RAMP.red);
  // Leczenie: zielona poświata paska HP; tarcza: niebieski pasek na dole paska HP.
  if (run.healGlow > 0) r.withAlpha(run.healGlow * 2, () => r.roundFrame(bx - 1, 11, bw + 2, 13, 4, C.lime, 1));
  if (p.shield > 0) r.roundRect(bx + 1, 20, Math.max(3, (bw - 2) * Math.min(1, p.shield / st.maxHp)), 2, 1, C.cyan);
  drawText(g, `${fmt(p.hp)} / ${fmt(st.maxHp)}`, bx + bw / 2, 13.5, C.white, { align: 'center', ...SMALL });
  drawResource(r, run, bx, 26, bw);
  const hc = run.mode === 'hardcore';
  const ex = run.expedition;
  // Poziom (albo akt), dopiski Hardcore i Pakt jeden za drugim.
  let lx = bx + 1;
  for (const [text, col] of [[ex ? `Akt ${ex.act}, głębia ${run.depth}` : run.mode === 'endless' ? `Głębia ${run.depth}` : `Etap ${run.depth}`, hc ? C.orange : C.lgray], [hc ? 'Hardcore' : '', C.salmon], [run.pactLevel ? `Pakt ${run.pactLevel}` : '', C.red]] as const) {
    if (!text) continue;
    drawText(g, text, lx, 37, col, SMALL);
    lx += textWidth(text) * 0.75 + 5;
  }
  // Aktywne błogosławieństwa kapliczek z czasem.
  if (run.buffs.length) drawText(g, run.buffs.map((b) => (Number.isFinite(b.t) ? `${b.name} ${Math.ceil(b.t)}s` : b.name)).join('  '), bx + 1, 46, C.yellow, SMALL);
  const synH = drawSynergyHud(r, run, 4, 60);

  // Czas na płytce + cel poziomu albo pasek bossa.
  r.withAlpha(0.65, () => r.roundRect(W / 2 - 36, 8, 72, 22, 5, C.black));
  r.withAlpha(0.35, () => r.roundFrame(W / 2 - 36, 8, 72, 22, 5, C.lavender, 0.5));
  drawText(g, fmtTime(run.time), W / 2, 11, C.white, { align: 'center', scale: 2, ...OUT });
  let py = 49;
  if (run.boss) {
    const b = run.boss;
    drawText(g, run.bossTitle ?? run.levelInfo.bossName, W / 2, 32, C.salmon, { align: 'center', ...OUT });
    const bw2 = 170, bx2 = W / 2 - bw2 / 2;
    bar(r, bx2, 42, bw2, 9, b.hp / b.maxHp, RAMP.purple);
    r.roundRect(bx2 - 3, 41, 3, 11, 1, C.gold);
    r.roundRect(bx2 + bw2, 41, 3, 11, 1, C.gold);
    drawSprite(g, 'ui_skull', bx2 - 10, 46);
    py = 55;
    const res = run.resistOf(b);
    if (res) { drawText(g, `Odporny na: ${ELEMENTS[res].name}`, W / 2, 54, ELEMENTS[res].color, { align: 'center', ...SMALL }); py = 64; }
  } else if (!run.bossSpawned) {
    const o = run.levelInfo.objective;
    const label = run.dungeon ? `Loch: fala ${run.dungeon.wave}/${BAL.events.dungeonWaves}${run.dungeon.cleared ? ', oczyszczony' : ''}`
      : run.mode === 'endless' ? `Endless: boss za ${fmtTime(Math.max(0, run.nextBossAt - run.time))}`
      : o.kind === 'survive' ? `Cel: przetrwaj ${fmtTime(o.time)}` : `Cel: zabójstwa ${fmt(run.levelKills)} / ${fmt(o.count)}`;
    drawText(g, label, W / 2, 32, C.lgray, { align: 'center', ...SMALL });
    bar(r, W / 2 - 60, 40, 120, 6, run.objectiveProgress(), RAMP.green);
  }
  // Wydarzenie poziomu i kombo: pigułki pod celem poziomu.
  const ev = run.levelEvent;
  const pills: [string, number][] = [];
  if (ev) pills.push([`${LEVEL_EVENTS[ev.id].name} ${Math.ceil(ev.t)}s`, LEVEL_EVENTS[ev.id].color]);
  if (run.combo >= 10) pills.push([`Kombo ${run.combo}  +${Math.round((comboGoldMul(run) - 1) * 100)}% zł`, C.yellow]);
  pills.forEach(([t, col], i) => pill(r, t, W / 2 + (i - (pills.length - 1) / 2) * 92, py, col));

  // Zabójstwa i złoto (prawy górny róg).
  plate(r, W - 86, 8, 82, 30);
  drawSprite(g, 'ui_skull', W - 76, 16);
  drawText(g, fmt(run.kills), W - 9, 10, C.lgray, { align: 'right', ...OUT });
  drawSprite(g, 'coin', W - 76, 30);
  drawText(g, fmt(run.gold), W - 9, 24, C.gold, { align: 'right', ...OUT });
  if (minimap) drawMinimap(r, run, W - 86, 41, 82, 56);
  drawSecretArrows(r, run);
  if (run.task) drawTask(r, run, W - 114, minimap ? 100 : 41);

  // Baner (zapowiedzi, fazy bossa, elity): wstęga z cienkimi złotymi liniami, wsuwa się i znika.
  if (run.bannerT > 0) {
    const big = run.banner.length <= 26, sc = big ? 2 : 1;
    const tw = textWidth(run.banner) * sc + 40, th = big ? 22 : 14, by = 68;
    const a = Math.min(1, run.bannerT * 3, (2.5 - run.bannerT) * 6 + 0.2);
    r.withAlpha(a, () => {
      r.withAlpha(0.7, () => r.roundRect(W / 2 - tw / 2, by, tw, th, 4, C.black));
      r.rect(W / 2 - tw / 2 + 6, by, tw - 12, 0.5, C.gold);
      r.rect(W / 2 - tw / 2 + 6, by + th - 0.5, tw - 12, 0.5, C.gold);
      drawText(g, run.banner, W / 2, by + (big ? 3 : 3), C.yellow, { align: 'center', scale: sc, ...OUT });
    });
  }

  // Gniazda broni (górny rząd) i pasywek (dolny rząd); puste gniazda też widać.
  for (let i = 0; i < BAL.weaponSlots; i++) {
    const w = run.weapons[i], x = 4 + i * (SLOT + 2), y = H - 2 * SLOT - 6;
    slot(r, x, y, SLOT, w?.def.fused ? C.cyan : w?.def.evolved ? C.gold : C.slate);
    if (!w) continue;
    drawSprite(g, w.def.icon, x + SLOT / 2, y + SLOT / 2);
    // Żywioł broni: kolorowa kropka w lewym górnym rogu gniazda.
    const el = WEAPON_ELEMENT[w.def.id];
    if (el && run.elemShapes) drawElemMark(r, el, x + 5, y + 5);
    else if (el) { r.rect(x + 2, y + 2, 4, 4, C.black); r.rect(x + 3, y + 3, 2, 2, ELEMENTS[el].color); }
    drawText(g, w.def.fused ? '+' : w.def.evolved ? '*' : String(w.level), x + SLOT - 2, y + SLOT - 11, w.def.fused ? C.cyan : w.def.evolved ? C.yellow : C.white, { align: 'right', ...OUT });
  }
  for (let i = 0; i < BAL.passiveSlots; i++) {
    const pa = run.passives[i], x = 4 + i * (SLOT + 2), y = H - SLOT - 4;
    slot(r, x, y, SLOT);
    if (!pa) continue;
    drawSprite(g, PASSIVE_BY_ID[pa.id].icon, x + SLOT / 2, y + SLOT / 2);
    drawText(g, String(pa.level), x + SLOT - 2, y + SLOT - 11, C.white, { align: 'right', ...OUT });
  }
  // Moc bossa: gniazdo za bronią, odnowienie od góry, poziom kropkami.
  if (run.power) {
    const def = BOSS_POWER_BY_ID[run.power.id], x = 4 + BAL.weaponSlots * (SLOT + 2) + 4, y = H - 2 * SLOT - 6;
    slot(r, x, y, SLOT, C.pink);
    drawSprite(g, def.icon, x + SLOT / 2, y + SLOT / 2);
    const h = Math.round((SLOT - 4) * Math.max(0, Math.min(1, run.powerT / powerCd(run, def))));
    if (h > 0) r.withAlpha(0.6, () => r.rect(x + 2, y + 2, SLOT - 4, h, C.black));
    for (let l = 0; l < run.power.level; l++) r.rect(x + 2 + l * 5, y - 4, 4, 2, C.pink);
  }
  // Nowy przedmiot w plecaku: przypomnienie nad gniazdami broni.
  if (run.bag.some((it) => it.fresh) && Math.floor(performance.now() / 500) % 2) {
    drawText(g, '! Nowy przedmiot w plecaku (I)', 4, H - 2 * SLOT - 18, C.lime, OUT);
  }

  // Umiejętności (prawy dół): ikona, odnowienie od góry, ładunek ultimate od dołu.
  const slots: AbilitySlot[] = ['q', 'e', 'dash', 'ult'];
  slots.forEach((sl, i) => {
    const a = run.abilities[sl];
    const S = ABILITY_SLOT, [x, y] = abilitySlotPos(i);
    const isUlt = sl === 'ult';
    const ready = isUlt ? run.ultCharge >= run.ultNeed() : a.cd <= 0;
    slot(r, x, y, S, isUlt && ready && run.step % 20 < 10 ? C.yellow : a.def.color);
    if (isUlt) {
      const fr = Math.min(1, run.ultCharge / run.ultNeed());
      const h = Math.round((S - 4) * fr);
      r.withAlpha(0.45, () => r.rect(x + 2, y + S - 2 - h, S - 4, h, ready ? C.orange : C.dbrown));
    }
    drawSprite(g, a.def.icon, x + S / 2, y + S / 2 - 1);
    if (!isUlt && a.cd > 0) {
      const h = Math.round((S - 4) * Math.min(1, a.cd / abilityMaxCd(run, sl)));
      r.withAlpha(0.7, () => r.rect(x + 2, y + 2, S - 4, h, C.black));
      drawText(g, a.cd.toFixed(a.cd < 1 ? 1 : 0), x + S / 2, y + 10, C.white, { align: 'center', ...OUT });
    }
    if (isUlt && a.activeT > 0) drawText(g, a.activeT.toFixed(0), x + S / 2, y + 10, C.white, { align: 'center', ...OUT });
    drawText(g, KEY_LABEL[sl], x + 3, y + S - 12, C.white, OUT);
    for (let l = 0; l < a.level && a.def.maxLevel > 1; l++) r.rect(x + 3 + l * 5, y - 4, 4, 2, C.gold);
  });

  // Sterowanie dotykowe: przycisk pauzy i wirtualny joystick (gdy palec jest na ekranie).
  if (input.lastDevice === 'touch') {
    const P = TOUCH_PAUSE;
    slot(r, P.x, P.y, P.s, C.slate);
    r.rect(P.x + 6, P.y + 5, 3, 10, C.white);
    r.rect(P.x + 11, P.y + 5, 3, 10, C.white);
    const s = input.stick;
    if (s) {
      r.withAlpha(0.35, () => r.circle(s.ox, s.oy, STICK_R, C.black, true));
      r.circle(s.ox, s.oy, STICK_R, C.lavender);
      const dx = s.x - s.ox, dy = s.y - s.oy, d = Math.hypot(dx, dy), k = d > STICK_R ? STICK_R / d : 1;
      r.circle(s.ox + dx * k, s.oy + dy * k, 9, C.white, true);
      r.circle(s.ox + dx * k, s.oy + dy * k, 9, C.slate);
    } else if (run.time < 6) {
      drawText(g, 'Dotknij lewej połowy ekranu i przesuń, żeby chodzić', W / 2, H - 60, C.lavender, { align: 'center', ...OUT });
    }
  }

  if (debug) {
    const lines = [
      `FPS ${loop.fps}  update ${loop.updateMs.toFixed(2)} ms`,
      `wrogowie ${run.enemies.count}`,
      `pociski ${run.projectiles.count}  wrogów ${run.bullets.count}`,
      `cząsteczki ${run.particles.count}  XP ${run.gems.count}`,
      'F4 cel+   F6 awans',
    ];
    lines.forEach((s, i) => drawText(g, s, 6, 62 + synH + i * 11, C.lime, OUT));
  }
}
