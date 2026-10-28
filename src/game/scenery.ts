import { VW, VH } from '../core/renderer';
import { drawSprite, drawShadow, getSprite } from '../gfx/sprites';
import { PROP_KINDS } from '../gfx/world';
import { LANDMARK_KINDS } from '../gfx/landmarks';
import { surfaceAt, cellRand } from '../gfx/ground';

/**
 * Dekoracje terenu (czysto wizualne, bez kolizji), rozmieszczone deterministycznie w pikselach logicznych świata:
 * rzadkie kompozycje (brama, obelisk, obozowisko, ruiny, kolumny) na dużej siatce i skupiska roślin i kamieni
 * na mniejszej, dobrane do powierzchni (nic nie wyrasta na ścieżce, na posadzce tylko kamienie i grzyby).
 * Wszystkie cienie padają tak samo: miękka elipsa tuż pod podstawą.
 */
const LM_CELL = 560, LM_CHANCE = 0.5, LM_PAD = 110;
const CL_CELL = 150, CL_CHANCE = 0.55, CL_R = 24;
/** Przepisy skupisk: indeksy rodzajów dekoracji biomu (gfx/world.ts prop): gaj, kamienie, grzyby, zarośla. */
const RECIPES = [[0, 0, 1, 5], [2, 2, 4, 2], [3, 3, 1], [5, 5, 0, 1]];
/** Rodzaje, które mogą leżeć na posadzce ruin (kamienie, pniaki, grzyby). */
const ON_PAVING = new Set([2, 3, 4]);

function landmarkIn(cx: number, cy: number, seed: number): { x: number; y: number; kind: number } | null {
  if (cellRand(cx, cy, seed, 0) > LM_CHANCE) return null;
  return {
    x: cx * LM_CELL + LM_PAD + cellRand(cx, cy, seed, 1) * (LM_CELL - 2 * LM_PAD),
    y: cy * LM_CELL + LM_PAD + cellRand(cx, cy, seed, 2) * (LM_CELL - 2 * LM_PAD),
    kind: Math.floor(cellRand(cx, cy, seed, 3) * LANDMARK_KINDS),
  };
}

interface Prop { x: number; y: number; k: number }
const clusters = new Map<string, Prop[]>();
const NONE: Prop[] = [];

/** Dekoracje skupiska w komórce (z pamięci podręcznej: pola powierzchni liczone tylko raz). */
function clusterIn(cx: number, cy: number, seed: number): Prop[] {
  const key = `${seed}|${cx},${cy}`;
  let list = clusters.get(key);
  if (list) return list;
  list = NONE;
  if (cellRand(cx, cy, seed, 10) <= CL_CHANCE) {
    const bx = cx * CL_CELL + 30 + cellRand(cx, cy, seed, 11) * (CL_CELL - 60), by = cy * CL_CELL + 30 + cellRand(cx, cy, seed, 12) * (CL_CELL - 60);
    // Bez skupisk tuż przy kompozycjach (sprawdzane w sąsiednich komórkach kompozycji).
    const lx = Math.floor(bx / LM_CELL), ly = Math.floor(by / LM_CELL);
    let near = false;
    for (let j = ly - 1; j <= ly + 1 && !near; j++) for (let i = lx - 1; i <= lx + 1; i++) {
      const l = landmarkIn(i, j, seed);
      if (l && (l.x - bx) ** 2 + (l.y - by) ** 2 < 70 * 70) { near = true; break; }
    }
    if (!near) {
      list = [];
      const recipe = RECIPES[Math.floor(cellRand(cx, cy, seed, 13) * RECIPES.length)];
      const n = 3 + Math.floor(cellRand(cx, cy, seed, 14) * 4);
      for (let i = 0; i < n; i++) {
        const a = cellRand(cx, cy, seed, 20 + i) * Math.PI * 2, d = CL_R * Math.sqrt(cellRand(cx, cy, seed, 40 + i));
        const x = bx + Math.cos(a) * d, y = by + Math.sin(a) * d * 0.7, k = recipe[i % recipe.length] % PROP_KINDS;
        const surf = surfaceAt(x, y, seed);
        if (surf === 'path' || (surf === 'paving' && !ON_PAVING.has(k))) continue;
        list.push({ x, y, k });
      }
    }
  }
  clusters.set(key, list);
  if (clusters.size > 600) clusters.delete(clusters.keys().next().value!);
  return list;
}

export function drawScenery(g: CanvasRenderingContext2D, ox: number, oy: number, biome: number, seed: number): void {
  const M = 70;
  // Kompozycje (pod skupiskami).
  for (let cy = Math.floor((oy - M) / LM_CELL); cy * LM_CELL < oy + VH + M; cy++) {
    for (let cx = Math.floor((ox - M) / LM_CELL); cx * LM_CELL < ox + VW + M; cx++) {
      const lm = landmarkIn(cx, cy, seed);
      if (!lm) continue;
      const name = `lm${biome}@${lm.kind}`, s = getSprite(name);
      const sx = lm.x - ox, sy = lm.y - oy;
      if (sx < -s.w || sx > VW + s.w || sy < -s.h || sy > VH + s.h) continue;
      drawShadow(g, sx, sy - 2, s.w * 0.9);
      drawSprite(g, name, sx, sy - s.h / 2);
    }
  }
  // Skupiska roślin i kamieni (liczone raz na komórkę), sortowane po wysokości (bliższe zasłaniają dalsze).
  const props: Prop[] = [];
  for (let cy = Math.floor((oy - M) / CL_CELL); cy * CL_CELL < oy + VH + M; cy++) {
    for (let cx = Math.floor((ox - M) / CL_CELL); cx * CL_CELL < ox + VW + M; cx++) props.push(...clusterIn(cx, cy, seed));
  }
  props.sort((a, b) => a.y - b.y);
  for (const p of props) {
    const sx = p.x - ox, sy = p.y - oy;
    if (sx < -20 || sx > VW + 20 || sy < -24 || sy > VH + 24) continue;
    drawShadow(g, sx, sy + 7, 14);
    drawSprite(g, `prop${biome}@${p.k}`, sx, sy);
  }
}
