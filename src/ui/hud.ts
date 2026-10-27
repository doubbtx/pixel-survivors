import { W, H, VIEW_W, VIEW_H, type Renderer } from '../core/renderer';
import { RARITIES } from '../data/items';
import { ELEMENTS, WEAPON_ELEMENT } from '../data/elements';
import { C, RAMP } from '../core/palette';
import { drawText } from '../core/font';
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
  for (const it of run.pickups.items) if (it.item) dot(it.x - 1, it.y - 1, 2, RARITIES[it.item.rarity].color);
  if (run.boss && run.step % 20 < 14) dot(run.boss.x - 1, run.boss.y - 1, 3, C.pink);
  // Obiekty mapy: kapliczki, portale; miecz w kamieniu dopiero z bliska (to sekret).
  for (const o of run.mapObjects) {
    if (o.kind === 'sword' && (o.x - p.x) ** 2 + (o.y - p.y) ** 2 > 250 * 250) continue;
    const col = o.kind === 'shrine' ? C.cyan : o.kind === 'portal' ? C.pink : o.kind === 'exit' ? C.lime : C.yellow;
    dot(o.x - 1, o.y - 1, 3, col);
  }
  r.rect(cx - 1, cy - 1, 2, 2, C.white);
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

  // Portret bohatera + poziom postaci.
  slot(r, 4, 9, 32, C.gold);
  drawSprite(g, `${run.hero.sprite}@0`, 20, 25);
  plate(r, 4, 42, 32, 12);
  drawText(g, `LV ${run.level}`, 20, 42, C.yellow, { align: 'center', ...OUT });
  const synH = drawSynergyHud(r, run, 4, 58);

  // HP + tarcza + poziom kampanii.
  bar(r, 40, 11, 126, 11, p.hp / st.maxHp, RAMP.red);
  // Leczenie: zielona poświata paska HP.
  if (run.healGlow > 0) r.withAlpha(run.healGlow * 2, () => r.frame(39, 10, 128, 13, C.lime));
  drawText(g, `${fmt(p.hp)} / ${fmt(st.maxHp)}`, 103, 10, C.white, { align: 'center', ...OUT });
  if (p.shield > 0) bar(r, 40, 23, Math.max(6, Math.round(126 * Math.min(1, p.shield / st.maxHp))), 5, 1, RAMP.blue);
  const hc = run.mode === 'hardcore';
  const ex = run.expedition;
  drawText(g, ex ? `Akt ${ex.act}, głębia ${run.depth}` : `Poziom ${run.depth}`, 41, 30, hc ? C.orange : C.lgray, OUT);
  if (hc) drawText(g, 'Hardcore', 89, 30, C.salmon, OUT);
  // Aktywne błogosławieństwa kapliczek z czasem.
  if (run.buffs.length) drawText(g, run.buffs.map((b) => (Number.isFinite(b.t) ? `${b.name} ${Math.ceil(b.t)}s` : b.name)).join('  '), 41, 42, C.yellow, OUT);

  // Czas na płytce + cel poziomu albo pasek bossa.
  plate(r, W / 2 - 36, 7, 72, 25);
  drawText(g, fmtTime(run.time), W / 2, 8, C.white, { align: 'center', scale: 2, ...OUT });
  if (run.boss) {
    const b = run.boss;
    drawText(g, run.levelInfo.bossName, W / 2, 34, C.salmon, { align: 'center', ...OUT });
    const bw = 220, bx = W / 2 - bw / 2;
    bar(r, bx, 47, bw, 9, b.hp / b.maxHp, RAMP.purple);
    r.rect(bx - 2, 46, 2, 11, C.gold);
    r.rect(bx + bw, 46, 2, 11, C.gold);
    drawSprite(g, 'ui_skull', bx - 9, 51);
  } else if (!run.bossSpawned) {
    const o = run.levelInfo.objective;
    const label = run.dungeon ? `Loch: fala ${run.dungeon.wave}/${BAL.events.dungeonWaves}${run.dungeon.cleared ? ', oczyszczony' : ''}`
      : run.mode === 'endless' ? `Endless: boss za ${fmtTime(Math.max(0, run.nextBossAt - run.time))}`
      : o.kind === 'survive' ? `Cel: przetrwaj ${fmtTime(o.time)}` : `Cel: zabójstwa ${fmt(run.levelKills)} / ${fmt(o.count)}`;
    drawText(g, label, W / 2, 34, C.lgray, { align: 'center', ...OUT });
    bar(r, W / 2 - 60, 47, 120, 6, run.objectiveProgress(), RAMP.green);
  }

  // Zabójstwa i złoto (prawy górny róg).
  plate(r, W - 86, 8, 82, 30);
  drawSprite(g, 'ui_skull', W - 76, 16);
  drawText(g, fmt(run.kills), W - 9, 10, C.lgray, { align: 'right', ...OUT });
  drawSprite(g, 'coin', W - 76, 30);
  drawText(g, fmt(run.gold), W - 9, 24, C.gold, { align: 'right', ...OUT });
  if (minimap) drawMinimap(r, run, W - 86, 41, 82, 56);

  // Baner (zapowiedzi, fazy bossa, elity).
  if (run.bannerT > 0 && run.step % 10 < 8) {
    const big = run.banner.length <= 26;
    drawText(g, run.banner, W / 2, 70, C.yellow, { align: 'center', scale: big ? 2 : 1, ...OUT });
  }

  // Gniazda broni (górny rząd) i pasywek (dolny rząd); puste gniazda też widać.
  for (let i = 0; i < BAL.weaponSlots; i++) {
    const w = run.weapons[i], x = 4 + i * (SLOT + 2), y = H - 2 * SLOT - 6;
    slot(r, x, y, SLOT, w?.def.evolved ? C.gold : C.slate);
    if (!w) continue;
    drawSprite(g, w.def.icon, x + SLOT / 2, y + SLOT / 2);
    // Żywioł broni: kolorowa kropka w lewym górnym rogu gniazda.
    const el = WEAPON_ELEMENT[w.def.id];
    if (el) { r.rect(x + 2, y + 2, 4, 4, C.black); r.rect(x + 3, y + 3, 2, 2, ELEMENTS[el].color); }
    drawText(g, w.def.evolved ? '*' : String(w.level), x + SLOT - 2, y + SLOT - 11, w.def.evolved ? C.yellow : C.white, { align: 'right', ...OUT });
  }
  for (let i = 0; i < BAL.passiveSlots; i++) {
    const pa = run.passives[i], x = 4 + i * (SLOT + 2), y = H - SLOT - 4;
    slot(r, x, y, SLOT);
    if (!pa) continue;
    drawSprite(g, PASSIVE_BY_ID[pa.id].icon, x + SLOT / 2, y + SLOT / 2);
    drawText(g, String(pa.level), x + SLOT - 2, y + SLOT - 11, C.white, { align: 'right', ...OUT });
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
