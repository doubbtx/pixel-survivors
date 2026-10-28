import { W, type Renderer } from '../core/renderer';
import type { Input } from '../core/input';
import { C } from '../core/palette';
import { drawText, textWidth } from '../core/font';
import { drawSprite } from '../gfx/sprites';
import { SYNERGIES, SYNERGY_BY_TAG, VERSATILITY, tierOf, type SynergyDef } from '../data/synergies';
import type { Tag } from '../data/cards';
import type { Run } from '../game/run';
import { dim, panel, inside, hovered } from './widgets';
import { UI, tile, iconSlot, cornerTag } from './theme';

const OUT = { outline: C.black } as const;
/** Mały tekst progów (ekran synergii). */
const SMALL = { scale: 0.75 } as const;

/** Następny próg albo ostatni (gdy wszystkie osiągnięte). */
function nextThreshold(def: SynergyDef, tier: number): number {
  return def.thresholds[Math.min(tier, def.thresholds.length - 1)];
}

/**
 * Tagi z postępem synergii po wyborze: ikona + "punkty/próg" (zielone, gdy wybór osiąga nowy próg).
 * Karty awansu i oferty kart — od razu widać, co buduje combo.
 */
export function drawTagGain(r: Renderer, run: Run, tags: Tag[], cx: number, y: number): void {
  const step = 40, x0 = cx - ((tags.length - 1) * step) / 2;
  tags.forEach((t, i) => {
    const def = SYNERGY_BY_TAG[t], after = run.tagPts[t] + 1;
    const tier = tierOf(def, after), reached = tier > tierOf(def, after - 1);
    const goal = reached ? def.thresholds[tier - 1] : nextThreshold(def, tier);
    const x = x0 + i * step;
    drawSprite(r.g, `tag:${t}`, x - 9, y);
    drawText(r.g, `${after}/${goal}`, x - 1, y - 5, reached ? C.lime : C.lgray, OUT);
  });
}

/** Rząd małych ikon tagów (przedmioty). */
export function drawTagIcons(r: Renderer, tags: Tag[], cx: number, y: number): void {
  const step = 18, x0 = cx - ((tags.length - 1) * step) / 2;
  tags.forEach((t, i) => drawSprite(r.g, `tag:${t}`, x0 + i * step, y));
}

/**
 * HUD: synergie jako zwarte ikony (aktywne i bliskie progu) pod kartą bohatera, w rzędach do szerokości `maxW`.
 * Kreski pod ikoną = osiągnięte progi, liczba w rogu = punkty; nazwa i postęp w podpowiedzi pod myszą.
 * Zwraca dolną krawędź.
 */
export function drawSynergyHud(r: Renderer, run: Run, x: number, y: number, maxW: number): number {
  const list = SYNERGIES
    .filter((d) => run.tagPts[d.tag] >= Math.max(2, d.thresholds[0] - 1))
    .sort((a, b) => (run.synTiers[b.tag] ?? 0) - (run.synTiers[a.tag] ?? 0) || run.tagPts[b.tag] - run.tagPts[a.tag])
    .slice(0, 8);
  const chips: { icon: string; name: string; pts: number; goal: number; tier: number; tiers: number; col: number }[] = [];
  if (run.versCount >= 2) {
    const vt = run.versTier;
    chips.push({ icon: 'syn_all', name: VERSATILITY.name, pts: run.versCount, goal: VERSATILITY.thresholds[Math.min(vt, VERSATILITY.thresholds.length - 1)], tier: vt, tiers: VERSATILITY.thresholds.length, col: C.pink });
  }
  for (const d of list) {
    const tier = run.synTiers[d.tag] ?? 0;
    chips.push({ icon: `tag:${d.tag}`, name: d.tag, pts: run.tagPts[d.tag], goal: nextThreshold(d, tier), tier, tiers: d.thresholds.length, col: UI.reward });
  }
  if (!chips.length) return y;
  const S = UI.synIcon + 4, step = S + 1, perRow = Math.max(1, Math.floor((maxW + 1) / step));
  let tip: (typeof chips)[number] | null = null, tx = 0, ty = 0;
  chips.forEach((c, i) => {
    const cx = x + (i % perRow) * step, cy = y + Math.floor(i / perRow) * (step + 2);
    const on = c.tier > 0;
    iconSlot(r, cx, cy, S, on ? c.col : undefined, on ? 0.6 : 0.4);
    r.withAlpha(on ? 1 : 0.55, () => drawSprite(r.g, c.icon, cx + S / 2, cy + S / 2));
    cornerTag(r, String(c.pts), cx + S, cy + S, on ? C.yellow : UI.text);
    for (let k = 0; k < c.tiers; k++) r.rect(cx + 1 + k * 3, cy + S + 0.5, 2, 1, k < c.tier ? c.col : C.dgray);
    if (hovered(cx, cy, S, S)) { tip = c; tx = cx; ty = cy + S + 3; }
  });
  if (tip) {
    const t = tip as (typeof chips)[number], text = `${t.name}: ${t.pts}/${t.goal}`;
    const w = textWidth(text) * 0.75 + 8;
    tile(r, tx, ty, w, 9, t.col, 0.85);
    drawText(r.g, text, tx + 4, ty + 0.5, t.tier > 0 ? C.yellow : UI.text, { scale: 0.75 });
  }
  const rows = Math.ceil(chips.length / perRow);
  return y + rows * (step + 2);
}

/**
 * Ekran synergii (z pauzy): wszystkie tagi, punkty i progi z opisami; osiągnięte progi na zielono.
 */
export class SynergyView {
  constructor(private readonly run: Run) {}

  /** Zwraca true, gdy ekran ma zostać zamknięty. */
  update(input: Input): boolean {
    if (input.pressed('back') || input.pressed('pause') || input.pressed('confirm')) return true;
    return input.pressed('click') && inside(input.mouse.x, input.mouse.y, W - 70, 6, 64, 22);
  }

  render(r: Renderer): void {
    const g = r.g, run = this.run;
    dim(r);
    drawText(g, 'Synergie', W / 2, 6, C.yellow, { align: 'center', scale: 2, outline: C.black });
    drawText(g, 'Esc: wróć', W - 10, 10, C.lgray, { align: 'right', ...OUT });
    // Wszechstronność: nagroda za liczbę aktywnych synergii (pasek u góry, progi w dwóch kolumnach).
    const vt = run.versTier;
    panel(r, 6, 28, 468, 30, vt > 0 ? C.pink : C.slate);
    drawSprite(g, 'syn_all', 18, 43);
    drawText(g, VERSATILITY.name, 30, 31, vt > 0 ? C.pink : C.white, { shadow: C.black });
    drawText(g, `aktywne synergie: ${run.versCount}`, 30, 43, C.lgray);
    VERSATILITY.tiers.forEach((t, k) => {
      const x = 140 + (k % 2) * 166, y = 33 + Math.floor(k / 2) * 11;
      drawText(g, `${VERSATILITY.thresholds[k]}: ${t.desc}`, x, y, k < vt ? C.lime : C.dgray, SMALL);
    });
    SYNERGIES.forEach((d, i) => {
      const x = 6 + (i % 2) * 236, y = 60 + Math.floor(i / 2) * 42;
      const pts = run.tagPts[d.tag], tier = run.synTiers[d.tag] ?? 0;
      panel(r, x, y, 232, 41, tier > 0 ? C.gold : C.slate);
      drawSprite(g, `tag:${d.tag}`, x + 12, y + 10);
      drawText(g, d.tag, x + 24, y + 3, tier > 0 ? C.yellow : C.white, { shadow: C.black });
      drawText(g, `${pts} pkt`, x + 224, y + 3, tier > 0 ? C.yellow : C.lgray, { align: 'right' });
      d.tiers.forEach((t, k) => {
        const on = k < tier;
        drawText(g, `${d.thresholds[k]}: ${t.desc}`, x + 24, y + 14 + k * 8.5, on ? C.lime : C.dgray, SMALL);
      });
    });
  }
}
