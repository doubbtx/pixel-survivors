import type { Item, LootSource } from '../data/items';
import type { Poolable } from '../core/pool';
import type { EnemyDef } from '../data/enemies';
import type { WeaponDef } from '../data/weapons';
import type { AbilityDef } from '../data/heroes';

/** Statystyki postaci — liczone od nowa z bohatera + pasywek (później: ekwipunek, karty, meta). */
export interface Stats {
  maxHp: number;
  regen: number;
  armor: number;
  speed: number;
  speedBonus: number;
  might: number;
  area: number;
  cdr: number;
  amount: number;
  duration: number;
  projSpeed: number;
  magnet: number;
  crit: number;
  critMult: number;
  lifesteal: number;
  luck: number;
  growth: number;
  greed: number;
  /** Siła żywiołów: mnoży obrażenia podpalenia i trucizny oraz spowolnienie lodu (0.2 = +20%). */
  elemPower: number;
  /** Szybkość ataku broni (0.2 = +20%; z malejącymi przyrostami, BAL.attackSpeedMul). */
  atkSpeed: number;
}

/**
 * Sloty obrażeń: każde źródło obrażeń obszarowych ma własny slot,
 * a wróg pamięta numer kroku ostatniego trafienia z każdego slotu (hitStamp).
 * Dzięki temu aura/orbita/laser biją każdego wroga co N kroków bez alokacji.
 */
export const SLOT = { q: 6, e: 7, ult: 8, card: 9 } as const;
/** Sloty 0-5 to bronie (indeks broni), dalej umiejętności i efekty kart. */
export const SLOT_COUNT = 10;

export interface Player {
  x: number;
  y: number;
  r: number;
  hp: number;
  shield: number;
  hurtCd: number;
  iframes: number;
  fx: number;
  fy: number;
  dashT: number;
  dvx: number;
  dvy: number;
  moving: boolean;
  flash: number;
}

export interface Enemy extends Poolable {
  uid: number;
  def: EnemyDef;
  /** Sprite instancji (boss ma wariant zależny od biomu). */
  sprite: string;
  x: number;
  y: number;
  /** Prędkość odrzutu (wygasa). */
  kx: number;
  ky: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  radius: number;
  xp: number;
  flash: number;
  slowT: number;
  slowF: number;
  stunT: number;
  shootT: number;
  shootA: number;
  age: number;
  dead: boolean;
  elite: string[] | null;
  boss: boolean;
  scale: number;
  /** Redukcja obrażeń 0..1 (modyfikator elity). */
  dr: number;
  /** Regeneracja jako ułamek maks. HP na sekundę. */
  regen: number;
  extraRing: boolean;
  /** Pozostałe salwy serii i czas do następnej. */
  burstLeft: number;
  burstT: number;
  /** Czas do kolejnego uderzenia wręcz w gracza (BAL.contactCooldown). */
  touchCd: number;
  hitStamp: Int32Array;
  // — stany żywiołów (data/elements.ts) —
  burnT: number;
  burnDps: number;
  chill: number;
  shockT: number;
  poisonT: number;
  poisonStacks: number;
  /** Obrażenia trucizny na warstwę na sekundę. */
  poisonUnit: number;
  /** Odliczanie do następnego ticku podpalenia / trucizny. */
  dotT: number;
  /** Odnowienie reakcji żywiołów na tym wrogu (s) i mnożnik następnego trafienia po Kruszeniu (0 = brak). */
  reactT: number;
  brittle: number;
  // — tylko boss —
  phase: number;
  invuln: number;
  actT: number;
  dashT: number;
  dvx: number;
  dvy: number;
}

export type ProjKind = 'normal' | 'arrow' | 'boomerang';

export interface Projectile extends Poolable {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  damage: number;
  radius: number;
  pierce: number;
  hits: number[];
  sprite: string;
  src: string;
  kind: ProjKind;
  returning: boolean;
  knock: number;
  forceCrit: boolean;
  t: number;
  /** Pozostałe odbicia od krawędzi ekranu (karta Rykoszet). */
  bounces: number;
  /**
   * Augmenty broni (data/augments.ts): skoki do kolejnego wroga po wyczerpaniu przebić, odłamki przy trafieniu,
   * rozpad na końcu (po wyczerpaniu przebić), mnożnik obrażeń w drodze powrotnej, wybuch przy trafieniu (ułamek obrażeń).
   */
  retarget: number;
  split: number;
  splitEnd: number;
  retMul: number;
  blast: number;
}

export interface EnemyBullet extends Poolable {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  damage: number;
  radius: number;
  sprite: string;
  /** Ruch (data/enemies.ts Volley): przyspieszenie, minimalna prędkość, skręt, wężyk, wiek. */
  acc: number;
  minV: number;
  turn: number;
  wave: number;
  t: number;
}

export interface Gem extends Poolable {
  x: number;
  y: number;
  value: number;
  flying: boolean;
  v: number;
}

export type PickupKind = 'chest' | 'meat' | 'magnet' | 'coin';

export interface Pickup extends Poolable {
  x: number;
  y: number;
  kind: PickupKind;
  value: number;
  flying: boolean;
  v: number;
  /** Skrzynia: przedmiot wylosowany przy upadku (jakość widać na ziemi) i źródło łupu. */
  item: Item | null;
  source: LootSource;
}

export interface Particle extends Poolable {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  col: number;
  size: number;
}

export interface DmgNum extends Poolable {
  x: number;
  y: number;
  life: number;
  text: string;
  col: number;
}

export type ZoneKind = 'meteor' | 'mine' | 'net' | 'rain' | 'beam' | 'fire';

/** Strefa obrażeń w świecie: meteoryt, mina, sieć, deszcz strzał, promień lasera, ogień. */
export interface Zone extends Poolable {
  kind: ZoneKind;
  x: number;
  y: number;
  r: number;
  angle: number;
  len: number;
  t: number;
  life: number;
  delay: number;
  damage: number;
  tick: number;
  slot: number;
  src: string;
  slow: number;
  knock: number;
}

export type FxKind = 'line' | 'ring' | 'arc' | 'spark' | 'poof' | 'boom';

/** Krótkotrwałe efekty wizualne bez logiki (błyskawice, fale, cięcia, iskry, obłoki, eksplozje). Dla klatek animacji `r` = skala. */
export interface Fx extends Poolable {
  kind: FxKind;
  x: number;
  y: number;
  x2: number;
  y2: number;
  r: number;
  a0: number;
  a1: number;
  life: number;
  max: number;
  col: number;
  w: number;
}

export interface WeaponInst {
  def: WeaponDef;
  level: number;
  timer: number;
  slot: number;
  /** Stan zależny od wzorca (kąt orbity, licznik salw itp.). */
  angle: number;
  shots: number;
}

export interface PassiveInst {
  id: string;
  level: number;
}

export interface AbilityInst {
  def: AbilityDef;
  level: number;
  cd: number;
  /** Czas trwania aktywnego efektu (np. ultimate wojownika). */
  activeT: number;
}

/** Wieżyczka przywołana efektem karty: strzela w najbliższego wroga, znika po czasie. */
export interface Turret extends Poolable {
  x: number;
  y: number;
  life: number;
  timer: number;
}

/** Karta (augment) zebrana w runie; karty statystyczne mogą mieć kilka stosów. */
export interface CardInst {
  id: string;
  stacks: number;
}
