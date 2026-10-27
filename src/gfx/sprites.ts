import { C, RAMP, type Ramp } from '../core/palette';
import { Rng } from '../core/rng';
import { BIOMES, type Biome } from '../data/levels';
import { Painter } from './painter';
import { ICON_FNS } from './icons';
import { ACTORS, boss } from './actors';
import { shrine, swordStone, portal } from './objects';
import { spark, poof, boom, arrowSprite, prop, patch, uiSkull } from './world';

/**
 * Rejestr sprite'ów 16-bit. Logika gry odwołuje się wyłącznie do NAZW sprite'ów,
 * więc podmiana na sprite sheet = podmiana tego modułu (wycinanie klatek z PNG
 * do tych samych nazw), bez zmian w systemach gry.
 *
 * Grafika powstaje proceduralnie (gfx/painter.ts): kształty cieniowane rampami palety
 * ze światłem z lewej-góry i ciemnym obrysem — spójny wygląd bez ręcznego rysowania każdego piksela.
 * Każdy sprite ma też wersję "flash" (biała sylwetka) do błysku przy trafieniu.
 */
export interface Sprite {
  img: HTMLCanvasElement;
  flash: HTMLCanvasElement;
  flip?: HTMLCanvasElement;
  w: number;
  h: number;
}


/** Gwiazda: `n` ramion, promienie zewnętrzny/wewnętrzny. */
function starPts(cx: number, cy: number, n: number, ro: number, ri: number, rot = -Math.PI / 2): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? ri : ro, a = rot + (i * Math.PI) / n;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

function rotPts(pts: [number, number][], cx: number, cy: number, a: number): [number, number][] {
  const c = Math.cos(a), s = Math.sin(a);
  return pts.map(([x, y]) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]);
}

// ========================= pociski i znajdźki =========================

function orb(size: number, ramp: Ramp, ring: number): Painter {
  const p = new Painter(size, size);
  const c = size / 2, r = size / 2 - 1;
  p.sphere(c, c, r, r, ramp);
  p.rect(Math.floor(c) - 1, Math.floor(c) - 1, 2, 2, C.white);
  return p.outline(ring);
}

function star(): Painter {
  const p = new Painter(11, 11);
  p.poly(starPts(5.5, 5.5, 5, 5, 2.2), C.gold).poly(starPts(5.5, 5.5, 5, 3, 1.3), C.yellow).px(5, 5, C.white);
  return p.outline(C.orange);
}

function blade(): Painter {
  const p = new Painter(11, 11);
  p.poly([[5.5, 0.5], [10, 5.5], [5.5, 10.5], [1, 5.5]], C.lavender).poly([[5.5, 1.5], [5.5, 9.5], [2, 5.5]], C.lgray).px(5, 3, C.white);
  return p.outline(C.slate);
}

function boomerang(frame: number): Painter {
  const p = new Painter(13, 13);
  const shape: [number, number][] = [[1.5, 4], [6.5, 1.5], [11.5, 4], [10.5, 6], [6.5, 4], [2.5, 6.5]];
  p.poly(rotPts(shape, 6.5, 6.5, (frame * Math.PI) / 2), C.clay);
  p.poly(rotPts([[2.5, 4], [6.5, 2.5], [6.5, 3.5]], 6.5, 6.5, (frame * Math.PI) / 2), C.gold);
  return p.outline(C.dbrown);
}

function mine(lit: boolean): Painter {
  const p = new Painter(13, 13);
  p.px(6, 1, C.lavender).px(6, 11, C.lavender).px(1, 6, C.lavender).px(11, 6, C.lavender);
  p.sphere(6.5, 6.5, 4, 4, RAMP.night).rect(5, 5, 3, 3, lit ? C.yellow : C.red).px(5, 5, lit ? C.white : C.salmon);
  return p.outline();
}

function gem(ramp: Ramp): Painter {
  const p = new Painter(9, 11);
  p.poly([[4.5, 0.5], [8.5, 4.5], [4.5, 10.5], [0.5, 4.5]], ramp[1]);
  p.poly([[4.5, 0.5], [4.5, 10.5], [0.5, 4.5]], ramp[2]);
  p.poly([[4.5, 0.5], [6.5, 3], [4.5, 4.5], [2.5, 3]], ramp[3]).px(3, 3, C.white);
  return p.outline(ramp[0]);
}

function chest(): Painter {
  const p = new Painter(19, 16);
  p.block(1, 6, 17, 9, RAMP.wood).block(1, 1, 17, 6, RAMP.wood);
  p.rect(4, 1, 2, 14, C.gold).rect(13, 1, 2, 14, C.gold).rect(4, 1, 2, 1, C.yellow).rect(13, 1, 2, 1, C.yellow);
  p.rect(8, 5, 3, 4, C.yellow).px(9, 7, C.ddbrown).px(8, 5, C.white);
  return p.outline();
}

function meat(): Painter {
  const p = new Painter(15, 13);
  p.line(1, 10, 5, 7, C.cream).sphere(2, 11, 1.5, 1.5, RAMP.bone).sphere(1.5, 9.5, 1.3, 1.3, RAMP.bone);
  p.sphere(9, 5.5, 5, 4.5, [C.ddbrown, C.dred, C.rust, C.clay]).px(7, 3, C.peach);
  return p.outline();
}

function magnet(): Painter {
  const p = new Painter(14, 14);
  p.rect(2, 3, 3, 8, C.red).rect(9, 3, 3, 8, C.red).rect(2, 9, 10, 3, C.red).rect(3, 4, 1, 6, C.salmon).rect(3, 10, 7, 1, C.salmon);
  p.rect(2, 1, 3, 2, C.lgray).rect(9, 1, 3, 2, C.lgray).px(2, 1, C.white).px(9, 1, C.white);
  return p.outline();
}

function coin(): Painter {
  const p = new Painter(9, 9);
  p.sphere(4.5, 4.5, 3.5, 3.5, RAMP.gold).line(4, 3, 4, 5, C.orange);
  return p.outline(C.dbrown);
}

function turret(): Painter {
  const p = new Painter(15, 16);
  p.line(3, 14, 5, 10, C.dgray).line(11, 14, 9, 10, C.dgray);
  p.block(3, 8, 8, 4, RAMP.stone).sphere(7, 6, 4, 3.5, RAMP.stone);
  p.rect(9, 5, 4, 2, C.slate).px(12, 5, C.dgray).px(6, 5, C.cyan);
  return p.outline();
}

/** Kafelek podłoża 32×32 biomu: dithering trzech odcieni, kępki, kamyki z cieniem, akcenty. */
function groundTile(b: Biome, v: number): Painter {
  const p = new Painter(32, 32);
  const r = new Rng(v * 7919 + 13);
  const [dark, base, light] = b.ground;
  p.rect(0, 0, 32, 32, base);
  for (let i = 0; i < 2; i++) {
    const cx = r.int(4, 27), cy = r.int(4, 27), rx = r.int(2, 5), ry = r.int(1, 3);
    for (let y = cy - ry; y <= cy + ry; y++) {
      for (let x = cx - rx; x <= cx + rx; x++) {
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 && (x + y) % 2 === 0) p.px(x, y, dark);
      }
    }
  }
  for (let i = 0; i < 14; i++) p.px(r.int(0, 31), r.int(0, 31), r.chance(0.6) ? dark : light);
  if (v % 2 === 0) {
    for (let k = 0; k < 2; k++) {
      const x = r.int(4, 26), y = r.int(6, 26);
      p.line(x, y, x - 1, y - 3, b.tuft[0]).line(x + 1, y, x + 1, y - 4, b.tuft[1]).line(x + 2, y, x + 3, y - 2, b.tuft[0]);
    }
  }
  if (v % 5 === 1) {
    const x = r.int(5, 25), y = r.int(5, 25);
    p.rect(x - 2, y + 2, 5, 1, dark);
    p.sphere(x + 0.5, y + 0.5, 2.5, 1.8, b.stone);
  }
  if (v % 7 === 2) {
    const x = r.int(4, 27), y = r.int(4, 27);
    p.px(x, y, b.accent).px(x + 1, y + 1, b.accent).px(x + 2, y, b.accent).px(x + 1, y, C.white);
  }
  return p;
}

const BUILDERS: Record<string, () => Painter> = {
  ui_skull: uiSkull,
  bolt: () => orb(9, RAMP.blue, C.dblue),
  ember: () => orb(7, RAMP.fire, C.gold), // złoty obrys: odróżnia od pomarańczowych pocisków wrogów
  sun: () => orb(11, [C.orange, C.gold, C.yellow, C.white], C.rust),
  star, blade,
  boom0: () => boomerang(0), boom1: () => boomerang(1), boom2: () => boomerang(2), boom3: () => boomerang(3),
  mine0: () => mine(false), mine1: () => mine(true),
  eb_red: () => orb(9, RAMP.red, C.dred),
  eb_pink: () => orb(9, RAMP.purple, C.plum),
  eb_orange: () => orb(9, RAMP.fire, C.dred),
  eb_big: () => orb(13, RAMP.red, C.hotpink),
  eb_blue: () => orb(7, RAMP.blue, C.navy),
  eb_cyan: () => orb(9, [C.dblue, C.blue, C.cyan, C.white], C.dblue),
  gem0: () => gem(RAMP.blue), gem1: () => gem(RAMP.green), gem2: () => gem(RAMP.red), gem3: () => gem(RAMP.purple),
  chest, meat, magnet, coin, turret,
};

const sprites = new Map<string, Sprite>();

function silhouette(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const g = c.getContext('2d')!;
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

function register(name: string, img: HTMLCanvasElement): Sprite {
  const s: Sprite = { img, flash: silhouette(img), w: img.width, h: img.height };
  sprites.set(name, s);
  return s;
}

function build(name: string): HTMLCanvasElement {
  if (name.startsWith('tile')) {
    const [b, v] = name.slice(4).split('_').map(Number);
    return groundTile(BIOMES[b], v).canvas();
  }
  // Klatki animacji: '<nazwa>@<klatka>' (postacie, efekty, strzały, dekoracje).
  const [base, fs] = name.split('@');
  const f = Number(fs ?? 0);
  if (base.startsWith('boss')) return boss(BIOMES[Number(base.slice(4))], f).canvas();
  if (ACTORS[base]) return ACTORS[base](f).canvas();
  if (base === 'spark') return spark(f).canvas();
  if (base === 'poof') return poof(f).canvas();
  if (base === 'boom') return boom(f).canvas();
  if (base === 'arrow' || base === 'arrowc') return arrowSprite(f, base === 'arrowc').canvas();
  if (base.startsWith('prop')) return prop(Number(base.slice(4)), f).canvas();
  if (base.startsWith('patch')) return patch(BIOMES[Number(base.slice(5))], f).canvas();
  if (base.startsWith('shrine')) return shrine(Number(base.slice(6))).canvas();
  if (base === 'portal' || base === 'exitportal') return portal(f, base === 'exitportal').canvas();
  if (base === 'swordstone') return swordStone().canvas();
  if (ICON_FNS[name]) {
    const p = new Painter(16, 16);
    ICON_FNS[name](p);
    return p.outline().canvas();
  }
  const b = BUILDERS[name];
  if (!b) throw new Error(`Brak sprite'a: ${name}`);
  return b().canvas();
}

export const TILE = 32;
export const TILE_VARIANTS = 10;

/**
 * Zwraca sprite po nazwie (budowany przy pierwszym użyciu). Nazwy specjalne:
 *  ic_/pi_/ab_/tag:      ikony 16×16 (gfx/icons.ts),
 *  'tile<biom>_<wariant>'  kafelek podłoża biomu,
 *  'boss<biom>'            boss w kolorach biomu,
 *  '<nazwa>@<klatka>'      klatka animacji (postacie, efekty, strzały, dekoracje 'prop<biom>@<rodzaj>').
 */
export function getSprite(name: string): Sprite {
  return sprites.get(name) ?? register(name, build(name));
}

export interface DrawOpts {
  flash?: boolean;
  scale?: number;
  flipX?: boolean;
}

/** Rysuje sprite wyśrodkowany w (x, y) (piksele ekranu). Skala całkowita, żeby zachować ostre piksele. */
export function drawSprite(g: CanvasRenderingContext2D, name: string, x: number, y: number, o: DrawOpts = {}): void {
  const s = getSprite(name);
  const sc = o.scale ?? 1;
  let img = o.flash ? s.flash : s.img;
  if (o.flipX && !o.flash) {
    if (!s.flip) {
      const c = document.createElement('canvas');
      c.width = s.w;
      c.height = s.h;
      const cg = c.getContext('2d')!;
      cg.translate(s.w, 0);
      cg.scale(-1, 1);
      cg.drawImage(s.img, 0, 0);
      s.flip = c;
    }
    img = s.flip;
  }
  g.drawImage(img, Math.round(x - (s.w * sc) / 2), Math.round(y - (s.h * sc) / 2), s.w * sc, s.h * sc);
}

const shadows = new Map<number, HTMLCanvasElement>();

/** Miękki cień pod postacią (płaska elipsa rysowana z przezroczystością). */
export function drawShadow(g: CanvasRenderingContext2D, x: number, y: number, w: number): void {
  w = Math.max(4, Math.round(w));
  let c = shadows.get(w);
  if (!c) {
    const h = Math.max(2, Math.round(w * 0.35));
    const p = new Painter(w, h);
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        if (((xx + 0.5 - w / 2) / (w / 2)) ** 2 + ((yy + 0.5 - h / 2) / (h / 2)) ** 2 <= 1) p.px(xx, yy, C.black);
      }
    }
    c = p.canvas();
    shadows.set(w, c);
  }
  const prev = g.globalAlpha;
  g.globalAlpha = prev * 0.35;
  g.drawImage(c, Math.round(x - c.width / 2), Math.round(y - c.height / 2));
  g.globalAlpha = prev;
}
