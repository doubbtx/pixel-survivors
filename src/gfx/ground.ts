import { PAL } from '../core/palette';
import type { Biome } from '../data/levels';

/**
 * Podłoże poziomu jako kompozycja kilku powierzchni zamiast powtarzanych kafelków: trawa w dwóch spokojnych odcieniach,
 * płaty ziemi, wydeptane ścieżki i kamienne posadzki ruin z mchem w szczelinach. Pola (szum wartości, fbm) liczone są
 * w pikselach logicznych świata, krawędzie powierzchni rozpuszcza dithering Bayera na drobnych pikselach płótna świata.
 * Kawałki CHUNK × CHUNK pikseli logicznych budują się po trochu w limicie czasu na klatkę (także z wyprzedzeniem, tuż
 * poza ekranem) i trafiają do pamięci podręcznej.
 * Funkcje `surfaceAt` / `clusterAt` dają rozmieszczenie skupisk dekoracji i ruin (game/render.ts) — czysto wizualnie,
 * bez kolizji.
 */
export const CHUNK = 192;
const CACHE_MAX = 40;

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
/** Krok siatki pól (piksele logiczne): pola są gładkie, drobne piksele interpolują je dwuliniowo. */
const FS = 2;
const FN = CHUNK / FS + 1;

/** Kawałek w budowie: pola liczone wierszami, potem wiersze drobnych pikseli, na końcu źdźbła — po trochu w każdej klatce. */
interface Job {
  b: Biome;
  seed: number;
  wx: number;
  wy: number;
  res: number;
  /** Pola: ton trawy, ziemia, ścieżka, posadzka, mech. */
  F: Float32Array[];
  fRow: number;
  img: ImageData;
  row: number;
}
const jobs = new Map<string, Job>();
let budgetEnd = 0;

/**
 * Nowa klatka: czas (ms), jaki wolno w niej przeznaczyć na budowanie podłoża. Mały budżet rozkłada koszt na wiele klatek
 * (bez przycinek przy chodzeniu); duży — gdy na ekranie nie ma jeszcze żadnego gotowego kawałka (start poziomu).
 */
export function groundFrame(budgetMs: number): void {
  budgetEnd = performance.now() + budgetMs;
}

/** Czy kawałek jest gotowy (bez budowania). */
export function groundReady(seed: number, cx: number, cy: number, res: number): boolean {
  return cache.has(`${seed}|${res}|${cx},${cy}`);
}

/**
 * Kawałek podłoża (CHUNK × CHUNK pikseli logicznych w rozdzielczości `res`) albo null, gdy jeszcze się buduje.
 * Kolejne wywołania dokładają pracy w ramach budżetu klatki (`groundFrame`); `prefetch` = kawałek tuż poza ekranem.
 */
export function groundChunk(b: Biome, seed: number, cx: number, cy: number, res: number, prefetch = false): HTMLCanvasElement | null {
  const key = `${seed}|${res}|${cx},${cy}`;
  const hit = cache.get(key);
  if (hit) {
    if (!prefetch) { cache.delete(key); cache.set(key, hit); }
    return hit;
  }
  if (performance.now() >= budgetEnd) return null;
  let job = jobs.get(key);
  if (!job) {
    const size = CHUNK * res;
    job = { b, seed, wx: cx * CHUNK, wy: cy * CHUNK, res, F: Array.from({ length: 5 }, () => new Float32Array(FN * FN)), fRow: 0, img: new ImageData(size, size), row: 0 };
    jobs.set(key, job);
  }
  const done = work(job);
  if (!done) return null;
  jobs.delete(key);
  cache.set(key, done);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
  // Porzucone budowy (np. po zmianie poziomu) nie rosną bez końca.
  if (jobs.size > 24) jobs.delete(jobs.keys().next().value!);
  return done;
}

/** Kolor zastępczy dla kawałka, który jeszcze się nie zbudował. */
export function groundBase(b: Biome): string {
  return PAL[b.ground[1]];
}

/** Interpolacja dwuliniowa pola w komórce `k` siatki z wagami rogów. */
function bl(a: Float32Array, k: number, w00: number, w10: number, w01: number, w11: number): number {
  return a[k] * w00 + a[k + 1] * w10 + a[k + FN] * w01 + a[k + FN + 1] * w11;
}

/** Dokłada pracy przy kawałku, dopóki starcza budżetu klatki; zwraca gotowe płótno albo null. */
function work(job: Job): HTMLCanvasElement | null {
  const { b, seed, wx, wy, res, F } = job, size = CHUNK * res;
  while (job.fRow < FN) {
    const j = job.fRow++;
    for (let i = 0; i < FN; i++) {
      const f = fields(wx + i * FS, wy + j * FS, seed), k = j * FN + i;
      F[0][k] = f.tone; F[1][k] = f.dirt; F[2][k] = f.path; F[3][k] = f.pave; F[4][k] = f.moss;
    }
    if (performance.now() >= budgetEnd) return null;
  }
  const [T, D, Pa, Pv, Mo] = F;
  const [gDark, gBase, gLight] = b.ground.map(rgb);
  // Ziemia i kamień zmieszane z trawą: stonowane, żeby nie konkurowały z pociskami i wrogami.
  const [dDark, dBase, dLight] = b.dirt.map((c) => mix(rgb(c), gBase, 0.35));
  const pv = b.paving.map((c) => mix(rgb(c), gBase, 0.18)), mortar = pv[0], moss = rgb(b.tuft[0]);
  const px = job.img.data;
  // Kolumny drobnych pikseli → indeks i ułamek siatki pól (te same w każdym wierszu).
  const cxi = new Int32Array(size), cxf = new Float32Array(size);
  for (let fx = 0; fx < size; fx++) {
    const gx = (fx + 0.5) / res / FS, xi = Math.min(FN - 2, Math.floor(gx));
    cxi[fx] = xi; cxf[fx] = gx - xi;
  }
  while (job.row < size) {
    const fy = job.row++;
    const ly = (fy + 0.5) / res, gy = ly / FS, yi = Math.min(FN - 2, Math.floor(gy)), yf = gy - yi;
    for (let fx = 0; fx < size; fx++) {
      const k = yi * FN + cxi[fx], xf = cxf[fx];
      const w00 = (1 - xf) * (1 - yf), w10 = xf * (1 - yf), w01 = (1 - xf) * yf, w11 = xf * yf;
      const th = BAYER[(fy & 3) * 4 + (fx & 3)];
      const tone = bl(T, k, w00, w10, w01, w11), dirt = bl(D, k, w00, w10, w01, w11), path = Math.abs(bl(Pa, k, w00, w10, w01, w11) - 0.5), pave = bl(Pv, k, w00, w10, w01, w11);
      let c = gBase;
      // Trawa: dwa spokojne odcienie dużymi płatami (bez drobnego szumu).
      if (tone < 0.42 && (0.42 - tone) / 0.06 > th) c = gDark;
      else if (tone > 0.66 && (tone - 0.66) / 0.05 > th) c = gLight;
      // Ziemia: płaty z ditherowanym brzegiem, ciemniejsza w środku.
      if (dirt > DIRT - 0.03 && (dirt - (DIRT - 0.03)) / 0.03 > th) c = dirt > DIRT + 0.07 && (dirt - DIRT - 0.07) / 0.05 > th ? dDark : dBase;
      // Wydeptana ścieżka: jasny środek, ciemniejszy brzeg.
      if (path < PATH) c = path < PATH * 0.55 ? dLight : dBase;
      else if (path < PATH * 1.4 && (PATH * 1.4 - path) / (PATH * 0.4) > th) c = dBase;
      // Posadzka ruin: płyty w przesuniętych rzędach, fugi, brakujące płyty na brzegu, mech w szczelinach.
      if (pave > PAVE - 0.02) {
        const gx = wx + (fx + 0.5) / res, gyy = wy + ly, prow = Math.floor(gyy / STONE_H), sx = gx + (prow % 2) * (STONE_W / 2), col = Math.floor(sx / STONE_W);
        const stone = hash(col, prow, seed + 23);
        if (pave > PAVE + 0.02 || stone > 0.45 + (PAVE + 0.02 - pave) * 12) {
          const ux = sx - col * STONE_W, uy = gyy - prow * STONE_H;
          if (ux < 0.6 || uy < 0.6) c = bl(Mo, k, w00, w10, w01, w11) > 0.6 ? moss : mortar;
          else {
            c = pv[1 + (stone > 0.7 ? 1 : 0)];
            if (uy < 1 && ux > 1) c = pv[3];
            else if (uy > STONE_H - 0.7 || ux > STONE_W - 0.6) c = pv[0];
            // Pęknięcie w części płyt.
            if (stone < 0.18 && Math.abs(ux - 2 - uy * 0.9) < 0.35) c = mortar;
          }
        }
      }
      const o = (fy * size + fx) * 4;
      px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = 255;
    }
    if ((fy & 7) === 7 && performance.now() >= budgetEnd) return null;
  }
  // Rzadkie źdźbła i kamyki (spokojnie, w skupiskach): tylko na trawie (pola z siatki, bez ponownego liczenia szumu).
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d')!;
  g.putImageData(job.img, 0, 0);
  g.scale(res, res);
  const step = 6;
  for (let j = 0; j < CHUNK; j += step) for (let i = 0; i < CHUNK; i += step) {
    const x = wx + i, y = wy + j, r = hash(Math.floor(x / step), Math.floor(y / step), seed + 31);
    const dense = noise(x / 40, y / 40, seed + 37);
    if (r > 0.25 + (1 - dense) * 0.9) continue;
    const k = Math.round(j / FS) * FN + Math.round(i / FS);
    if (D[k] > DIRT || Pv[k] > PAVE || Math.abs(Pa[k] - 0.5) < PATH * 1.4) continue;
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
