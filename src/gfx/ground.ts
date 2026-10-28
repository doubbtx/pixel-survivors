import { PAL } from '../core/palette';
import type { Biome } from '../data/levels';

/**
 * Podłoże poziomu jako kompozycja kilku powierzchni zamiast powtarzanych kafelków: trawa w dwóch spokojnych odcieniach,
 * płaty ziemi, wydeptane ścieżki i kamienne posadzki ruin z mchem w szczelinach. Pola (szum wartości, fbm) liczone są
 * w pikselach logicznych świata, krawędzie powierzchni rozpuszcza dithering Bayera na drobnych pikselach płótna świata.
 * Kawałki CHUNK × CHUNK pikseli logicznych powstają leniwie (limit na klatkę) i trafiają do pamięci podręcznej.
 * Funkcje `surfaceAt` / `clusterAt` dają rozmieszczenie skupisk dekoracji i ruin (game/render.ts) — czysto wizualnie,
 * bez kolizji.
 */
export const CHUNK = 192;
/** Ile kawałków wolno zbudować w jednej klatce (reszta dostaje tymczasowo jednolity kolor). */
const BUILD_PER_FRAME = 3;
const CACHE_MAX = 28;

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

function hash(x: number, y: number, s: number): number {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function noise(x: number, y: number, s: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Szum fraktalny (3 oktawy), wynik ok. 0..1. */
function fbm(x: number, y: number, s: number): number {
  return (noise(x, y, s) * 0.57 + noise(x * 2.03, y * 2.03, s + 17) * 0.29 + noise(x * 4.1, y * 4.1, s + 41) * 0.14);
}

export type Surface = 'grass' | 'dirt' | 'path' | 'paving';

/** Pola powierzchni w punkcie (piksele logiczne świata). Progi: ziemia > DIRT, posadzka > PAVE, ścieżka |p − 0,5| < PATH. */
interface Fields { tone: number; dirt: number; path: number; pave: number; moss: number }
const DIRT = 0.69, PAVE = 0.735, PATH = 0.013;
/** Płyta posadzki (piksele logiczne). */
const STONE_W = 8, STONE_H = 5;

function fields(x: number, y: number, seed: number): Fields {
  return {
    tone: fbm(x / 150, y / 150, seed),
    dirt: fbm((x + 531) / 120, (y - 211) / 120, seed + 3),
    path: fbm((x - 1291) / 420, (y + 707) / 420, seed + 7),
    pave: fbm((x + 911) / 95, (y + 433) / 95, seed + 11),
    moss: noise(x / 9, y / 9, seed + 13),
  };
}

/** Powierzchnia w punkcie (bez ditheringu) — do rozmieszczania dekoracji. */
export function surfaceAt(x: number, y: number, seed: number): Surface {
  const f = fields(x, y, seed);
  if (f.pave > PAVE) return 'paving';
  if (Math.abs(f.path - 0.5) < PATH * 1.4) return 'path';
  if (f.dirt > DIRT) return 'dirt';
  return 'grass';
}

/** Losowa liczba 0..1 przypisana do komórki siatki (stała dla danego ziarna). */
export function cellRand(cx: number, cy: number, seed: number, k = 0): number {
  return hash(cx * 31 + k, cy * 17 - k, seed + 101);
}

type RGB = [number, number, number];
function mix(a: RGB, b: RGB, t: number): RGB {
  return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
}

const rgbCache = new Map<number, [number, number, number]>();
function rgb(col: number): [number, number, number] {
  let c = rgbCache.get(col);
  if (!c) {
    const n = parseInt(PAL[col].slice(1), 16);
    c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    rgbCache.set(col, c);
  }
  return c;
}

const cache = new Map<string, HTMLCanvasElement>();
let builtThisFrame = 0;

/** Nowa klatka: zeruje limit budowania kawałków. */
export function groundFrame(): void {
  builtThisFrame = 0;
}

/** Kawałek podłoża (CHUNK × CHUNK pikseli logicznych w rozdzielczości `res`) albo null, gdy limit klatki wyczerpany. */
export function groundChunk(b: Biome, seed: number, cx: number, cy: number, res: number): HTMLCanvasElement | null {
  const key = `${seed}|${res}|${cx},${cy}`;
  const hit = cache.get(key);
  if (hit) { cache.delete(key); cache.set(key, hit); return hit; }
  if (builtThisFrame >= BUILD_PER_FRAME) return null;
  builtThisFrame++;
  const c = buildChunk(b, seed, cx * CHUNK, cy * CHUNK, res);
  cache.set(key, c);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
  return c;
}

/** Kolor zastępczy dla kawałka, który jeszcze się nie zbudował. */
export function groundBase(b: Biome): string {
  return PAL[b.ground[1]];
}

function buildChunk(b: Biome, seed: number, wx: number, wy: number, res: number): HTMLCanvasElement {
  const N = CHUNK + 1, size = CHUNK * res;
  // Pola na siatce pikseli logicznych (z zapasem 1), drobne piksele interpolują je dwuliniowo.
  const F = { tone: new Float32Array(N * N), dirt: new Float32Array(N * N), path: new Float32Array(N * N), pave: new Float32Array(N * N), moss: new Float32Array(N * N) };
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const f = fields(wx + i, wy + j, seed), k = j * N + i;
    F.tone[k] = f.tone; F.dirt[k] = f.dirt; F.path[k] = f.path; F.pave[k] = f.pave; F.moss[k] = f.moss;
  }
  const lerp = (a: Float32Array, x: number, y: number) => {
    const xi = Math.min(N - 2, Math.floor(x)), yi = Math.min(N - 2, Math.floor(y)), xf = x - xi, yf = y - yi, k = yi * N + xi;
    return a[k] + (a[k + 1] - a[k]) * xf + (a[k + N] - a[k]) * yf + (a[k] - a[k + 1] - a[k + N] + a[k + N + 1]) * xf * yf;
  };
  const [gDark, gBase, gLight] = b.ground.map(rgb);
  // Ziemia i kamień zmieszane z trawą: stonowane, żeby nie konkurowały z pociskami i wrogami.
  const [dDark, dBase, dLight] = b.dirt.map((c) => mix(rgb(c), gBase, 0.35));
  const pv = b.paving.map((c) => mix(rgb(c), gBase, 0.18)), mortar = pv[0], moss = rgb(b.tuft[0]);
  const img = new ImageData(size, size), px = img.data;
  for (let fy = 0; fy < size; fy++) {
    for (let fx = 0; fx < size; fx++) {
      const lx = (fx + 0.5) / res, ly = (fy + 0.5) / res, th = BAYER[(fy & 3) * 4 + (fx & 3)];
      const tone = lerp(F.tone, lx, ly), dirt = lerp(F.dirt, lx, ly), path = Math.abs(lerp(F.path, lx, ly) - 0.5), pave = lerp(F.pave, lx, ly);
      let c = gBase;
      // Trawa: dwa spokojne odcienie dużymi płatami (bez drobnego szumu).
      if (tone < 0.42 && (0.42 - tone) / 0.06 > th) c = gDark;
      else if (tone > 0.66 && (tone - 0.66) / 0.05 > th) c = gLight;
      // Ziemia: płaty z ditherowanym brzegiem, ciemniejsza w środku.
      if (dirt > DIRT - 0.03 && (dirt - (DIRT - 0.03)) / 0.03 > th) c = dirt > DIRT + 0.07 && (dirt - DIRT - 0.07) / 0.05 > th ? dDark : dBase;
      // Wydeptana ścieżka: jasny środek, ciemniejszy brzeg.
      if (path < PATH) c = path < PATH * 0.55 ? dLight : dBase;
      else if (path < PATH * 1.4 && (PATH * 1.4 - path) / (PATH * 0.4) > th) c = dBase;
      // Posadzka ruin: płyty 10×7 w przesuniętych rzędach, fugi, brakujące płyty na brzegu, mech w szczelinach.
      if (pave > PAVE - 0.02) {
        const gx = wx + lx, gy = wy + ly, row = Math.floor(gy / STONE_H), sx = gx + (row % 2) * (STONE_W / 2), col = Math.floor(sx / STONE_W);
        const stone = hash(col, row, seed + 23);
        const edgeOk = pave > PAVE + 0.02 || stone > 0.45 + (PAVE + 0.02 - pave) * 12;
        if (edgeOk) {
          const ux = sx - col * STONE_W, uy = gy - row * STONE_H;
          if (ux < 0.6 || uy < 0.6) c = lerp(F.moss, lx, ly) > 0.6 ? moss : mortar;
          else {
            c = pv[1 + (stone > 0.7 ? 1 : 0)];
            if (uy < 1 && ux > 1) c = pv[3];
            else if (uy > STONE_H - 0.7 || ux > STONE_W - 0.6) c = pv[0];
            // Pęknięcie w części płyt.
            if (stone < 0.18 && Math.abs(ux - 2 - uy * 0.9) < 0.35) c = mortar;
          }
        }
      }
      const k = (fy * size + fx) * 4;
      px[k] = c[0]; px[k + 1] = c[1]; px[k + 2] = c[2]; px[k + 3] = 255;
    }
  }
  // Rzadkie źdźbła i kamyki (spokojnie, w skupiskach): tylko na trawie.
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d')!;
  g.putImageData(img, 0, 0);
  g.scale(res, res);
  const step = 6;
  for (let j = 0; j < CHUNK; j += step) for (let i = 0; i < CHUNK; i += step) {
    const x = wx + i, y = wy + j, r = hash(Math.floor(x / step), Math.floor(y / step), seed + 31);
    const dense = noise(x / 40, y / 40, seed + 37);
    if (r > 0.25 + (1 - dense) * 0.9) continue;
    if (surfaceAt(x, y, seed) !== 'grass') continue;
    const ox = i + hash(i, j, seed + 41) * step, oy = j + hash(j, i, seed + 43) * step;
    if (r < 0.03) {
      g.fillStyle = PAL[b.stone[1]]; g.fillRect(ox, oy, 2, 1.34);
      g.fillStyle = PAL[b.stone[2]]; g.fillRect(ox, oy, 1.34, 0.67);
    } else {
      g.fillStyle = PAL[b.tuft[0]];
      g.fillRect(ox, oy - 2, 1 / res, 2); g.fillRect(ox + 1, oy - 3, 1 / res, 3); g.fillRect(ox + 2, oy - 1.67, 1 / res, 1.67);
      g.fillStyle = PAL[b.tuft[1]];
      g.fillRect(ox + 1, oy - 3, 1 / res, 1 / res);
    }
  }
  return cv;
}
