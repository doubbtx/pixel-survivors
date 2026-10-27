import { BAL } from './balance';
import { C } from '../core/palette';

/**
 * Salwa pocisków (bullet hell w stylu ROTMG: dużo uników, czytelne wzory).
 *  fan      wachlarz wokół kąta bazowego, `spread` = odstęp między pociskami (rad)
 *  ring     pełny pierścień
 *  gapRing  pierścień z luką `gap` pocisków — trzeba do niej uciec
 *  shotgun  wachlarz z losową prędkością pocisków (`speedVar`)
 * Ruch pocisku: `acc` (px/s², ujemne = zwalnia do `minV` i wisi w powietrzu), `turn` (skręt rad/s,
 * `altTurn` = co drugi w drugą stronę, "kwiat"), `wave` (wężyk, amplituda w rad).
 */
export type VolleyShape = 'fan' | 'ring' | 'gapRing' | 'shotgun';

export interface Volley {
  shape: VolleyShape;
  count: number;
  speed: number;
  sprite: string;
  spread?: number;
  gap?: number;
  speedVar?: number;
  acc?: number;
  minV?: number;
  turn?: number;
  altTurn?: boolean;
  wave?: number;
}

/**
 * chase — idzie prosto na gracza; fast — szybko, falującym torem;
 * keep — trzyma dystans i ostrzeliwuje; flee — ucieka (Złoty szlam); boss — osobna logika faz;
 * shield — tarcza z przodu blokuje pociski (obraca się powoli, trzeba obejść albo bić obszarem);
 * summoner — trzyma dystans i przywołuje nietoperze; kamikaze — dobiega, zapala lont i wybucha;
 * blink — teleportuje się obok gracza po zapowiedzi; weaver — trzyma dystans i rzuca pod gracza spowalniające sieci.
 */
export type EnemyBehavior = 'chase' | 'fast' | 'keep' | 'flee' | 'boss' | 'shield' | 'summoner' | 'kamikaze' | 'blink' | 'weaver';

export interface ShootDef {
  volley: Volley;
  cooldown: number;
  /** Kąt bazowy: w gracza, obracający się (spirala, `spin` rad na salwę) albo losowy. */
  aim: 'player' | 'spin' | 'random';
  spin?: number;
  /** Seria: tyle salw co `burstGap` s (każda celuje od nowa). */
  burst?: number;
  burstGap?: number;
  /** Zapowiedź: wróg miga tyle sekund przed salwą. */
  windup?: number;
  /** Strzela tylko, gdy gracz jest bliżej niż to (px). */
  range: number;
}

export interface EnemyDef {
  id: string;
  name: string;
  sprite: string;
  /** Kolor cząsteczek przy śmierci. */
  color: number;
  hp: number;
  speed: number;
  damage: number;
  radius: number;
  xp: number;
  behavior: EnemyBehavior;
  keepDist?: number;
  shoot?: ShootDef;
  /** 0 = pełny odrzut, 1 = brak odrzutu. */
  knockResist: number;
}

export const ENEMIES: Record<string, EnemyDef> = {
  slime: { id: 'slime', color: C.lime, name: 'Szlam', sprite: 'slime', hp: 10, speed: 30, damage: 7, radius: 4, xp: 1, behavior: 'chase', knockResist: 0 },
  bat: { id: 'bat', color: C.lavender, name: 'Nietoperz', sprite: 'bat', hp: 7, speed: 52, damage: 6, radius: 3, xp: 1, behavior: 'fast', knockResist: 0 },
  golem: { id: 'golem', color: C.dgray, name: 'Golem', sprite: 'golem', hp: 80, speed: 18, damage: 20, radius: 6, xp: 6, behavior: 'chase', knockResist: 0.85 },
  eye: {
    id: 'eye', color: C.white, name: 'Oko', sprite: 'eye', hp: 16, speed: 24, damage: 5, radius: 4, xp: 3, behavior: 'keep', keepDist: 85, knockResist: 0.2,
    shoot: { volley: { shape: 'fan', count: 3, speed: 70, spread: 0.3, sprite: 'eb_red' }, aim: 'player', cooldown: 2.6, windup: 0.4, range: 160 },
  },
  wisp: {
    id: 'wisp', color: C.orange, name: 'Ognik', sprite: 'wisp', hp: 14, speed: 30, damage: 5, radius: 3, xp: 3, behavior: 'chase', knockResist: 0,
    shoot: { volley: { shape: 'ring', count: 7, speed: 75, acc: -55, minV: 14, sprite: 'eb_orange' }, aim: 'random', cooldown: 3.6, windup: 0.5, range: 110 },
  },
  spinner: {
    id: 'spinner', color: C.pink, name: 'Wirownik', sprite: 'spinner', hp: 45, speed: 14, damage: 6, radius: 4, xp: 8, behavior: 'keep', keepDist: 110, knockResist: 0.5,
    shoot: { volley: { shape: 'ring', count: 2, speed: 50, wave: 0.5, sprite: 'eb_pink' }, aim: 'spin', spin: 0.5, cooldown: 0.4, range: 160 },
  },
  shieldbearer: { id: 'shieldbearer', color: C.lgray, name: 'Tarczownik', sprite: 'shieldbearer', hp: 60, speed: 20, damage: 12, radius: 6, xp: 6, behavior: 'shield', knockResist: 0.8 },
  summoner: { id: 'summoner', color: C.plum, name: 'Przywoływacz', sprite: 'summoner', hp: 40, speed: 18, damage: 6, radius: 5, xp: 8, behavior: 'summoner', keepDist: 120, knockResist: 0.3 },
  kamikaze: { id: 'kamikaze', color: C.orange, name: 'Kamikaze', sprite: 'kamikaze', hp: 12, speed: 62, damage: 10, radius: 4, xp: 2, behavior: 'kamikaze', knockResist: 0 },
  blinker: { id: 'blinker', color: C.cyan, name: 'Skoczek', sprite: 'blinker', hp: 25, speed: 30, damage: 8, radius: 4, xp: 4, behavior: 'blink', knockResist: 0.2 },
  weaver: { id: 'weaver', color: C.dgray, name: 'Pajęczarz', sprite: 'weaver', hp: 35, speed: 22, damage: 6, radius: 5, xp: 6, behavior: 'weaver', keepDist: 110, knockResist: 0.3 },
  // Sekrety map (systems/mapsecrets.ts): mimik udaje skrzynię, biały jeleń ucieka jak Złoty szlam.
  mimic: { id: 'mimic', color: C.brown, name: 'Mimik', sprite: 'mimic', hp: 30, speed: 44, damage: 12, radius: 6, xp: 15, behavior: 'chase', knockResist: 0.7 },
  stag: { id: 'stag', color: C.white, name: 'Biały jeleń', sprite: 'stag', hp: 90, speed: 50, damage: 0, radius: 5, xp: 30, behavior: 'flee', knockResist: 0.6 },
  goldslime: { id: 'goldslime', color: C.gold, name: 'Złoty szlam', sprite: 'goldslime', hp: 60, speed: 46, damage: 0, radius: 4, xp: 20, behavior: 'flee', knockResist: 0.5 },
  cultist: {
    id: 'cultist', color: C.blue, name: 'Kultysta', sprite: 'cultist', hp: 22, speed: 22, damage: 5, radius: 4, xp: 4, behavior: 'keep', keepDist: 100, knockResist: 0.2,
    shoot: { volley: { shape: 'fan', count: 1, speed: 105, sprite: 'eb_blue' }, aim: 'player', cooldown: 3, burst: 4, burstGap: 0.12, windup: 0.45, range: 170 },
  },
  sentinel: {
    id: 'sentinel', color: C.cyan, name: 'Strażnik', sprite: 'sentinel', hp: 90, speed: 10, damage: 7, radius: 6, xp: 10, behavior: 'keep', keepDist: 120, knockResist: 0.9,
    shoot: { volley: { shape: 'gapRing', count: 18, gap: 4, speed: 58, sprite: 'eb_cyan' }, aim: 'random', cooldown: 4.5, windup: 0.7, range: 180 },
  },
  boss: {
    id: 'boss', color: C.pink, name: 'Władca Otchłani', sprite: 'boss', hp: BAL.bossBaseHp, speed: 22, damage: 25, radius: 10, xp: 400, behavior: 'boss', knockResist: 1,
  },
};

/** Modyfikatory elit — losowane 1-2 na elitę. */
export interface EliteMod {
  name: string;
  speedMul?: number;
  dr?: number;
  regen?: number;
  hpMul?: number;
  ring?: boolean;
}

export const ELITE_MODS: Record<string, EliteMod> = {
  swift: { name: 'Szybki', speedMul: 1.6 },
  armored: { name: 'Pancerny', dr: 0.5 },
  regen: { name: 'Regenerujący', regen: 0.02 },
  huge: { name: 'Olbrzymi', hpMul: 2 },
  volley: { name: 'Ostrzał', ring: true },
};

/**
 * Moce bossów (systems/powers.ts): po pokonaniu bossa gracz wybiera 1 z 3 jego nazwanych ataków. Moc strzela sama co `cd` s
 * (× odnowienie umiejętności) pociskami gracza w kształcie salwy bossa. Jedna moc naraz: wybór tej samej podnosi poziom
 * (BAL.bossPowers), innej — zastępuje. `phase` = faza bossa, z której pochodzi atak.
 */
export interface BossPowerDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  phase: number;
  cd: number;
  /** Moc sekretnego bossa (Zapomniany Król z kurhanu) — tylko z jego oferty. */
  secret?: boolean;
}

export const BOSS_POWERS: BossPowerDef[] = [
  { id: 'shotgun', name: 'Śrut Otchłani', desc: 'Co 2.5 s 7 pocisków śrutu w najbliższego wroga.', icon: 'bp_shotgun', phase: 0, cd: 2.5 },
  { id: 'gapring', name: 'Pierścień Otchłani', desc: 'Co 3.5 s pierścień 20 przebijających pocisków wokół ciebie.', icon: 'bp_ring', phase: 0, cd: 3.5 },
  { id: 'flower', name: 'Kwiat zagłady', desc: 'Co 4 s dwa obrócone pierścienie płonących pocisków.', icon: 'bp_flower', phase: 1, cd: 4 },
  { id: 'stream', name: 'Strumień', desc: 'Co 3 s seria 5 wachlarzy ostrzy w najbliższego wroga.', icon: 'bp_stream', phase: 1, cd: 3 },
  { id: 'minefield', name: 'Pole minowe', desc: 'Co 5 s 6 min wokół ciebie, wybuchają przy wrogach.', icon: 'bp_mines', phase: 2, cd: 5 },
  { id: 'crown', name: 'Gniew Króla', desc: 'Co 3 s pierścień 16 pocisków i śrut w najbliższego wroga.', icon: 'bp_crown', phase: 3, cd: 3, secret: true },
  { id: 'brood', name: 'Wylęgarnia', desc: 'Co 8 s 3 duchy-sługi walczą za ciebie przez 8 s.', icon: 'bp_brood', phase: 2, cd: 8 },
];

export const BOSS_POWER_BY_ID: Record<string, BossPowerDef> = Object.fromEntries(BOSS_POWERS.map((p) => [p.id, p]));
