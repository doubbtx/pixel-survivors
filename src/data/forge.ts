import { C } from '../core/palette';
import type { Stats } from '../entities/types';
import type { CardHooks } from './cards';
import type { ItemKind } from './items';

/**
 * Kuźnia runiczna (systems/forge.ts, ekran w ui/anvil.ts): ulepszanie przedmiotów do +15 jak w Metinie.
 * Każda próba kosztuje złoto i materiał danego stopnia (MATERIALS, zdobywane z wrogów, elit, bossów, zadań, sklepu),
 * udaje się z szansą z FORGE_STEPS (+ litość za porażki, + zwój smoka, + tryb ryzyka). Porażka: nic, spadek o poziom
 * albo pęknięcie (przedmiot słabszy do naprawy); w trybie ryzyka pęknięcie oznacza ZNISZCZENIE przedmiotu.
 * Zwoje (SCROLLS) zmieniają zasady jednej próby. Progi (FORGE_TIERS) dają bonusy: +3 i +12 na stałe przy pierwszym
 * osiągnięciu, +6, +9 (Przebudzenie wg typu przedmiotu) i +15 — dopóki przedmiot ma ten poziom.
 */
export type MatId = 'stone' | 'ore' | 'heart' | 'tear' | 'void';
export type ScrollId = 'bless' | 'dragon' | 'talisman';

export interface MatDef {
  id: MatId;
  name: string;
  icon: string;
  color: number;
  /** Skąd się bierze (opis w kuźni). */
  from: string;
}

export const MATERIALS: MatDef[] = [
  { id: 'stone', name: 'Kamień kowalski', icon: 'mt_stone', color: C.lgray, from: 'wrogowie, rozkładanie, sklep' },
  { id: 'ore', name: 'Ruda gwiezdna', icon: 'mt_ore', color: C.blue, from: 'elity, zadania, lochy, sklep' },
  { id: 'heart', name: 'Serce smoka', icon: 'mt_heart', color: C.red, from: 'bossowie, Złoty szlam' },
  { id: 'tear', name: 'Łza bogów', icon: 'mt_tear', color: C.cyan, from: 'bossowie od 3. poziomu, bossowie aktów' },
  { id: 'void', name: 'Iskra pustki', icon: 'mt_void', color: C.pink, from: 'bossowie od 5. poziomu, miecz w kamieniu, Pakt 10+' },
];

export const MAT_BY_ID = Object.fromEntries(MATERIALS.map((m) => [m.id, m])) as Record<MatId, MatDef>;

export interface ScrollDef {
  id: ScrollId;
  name: string;
  desc: string;
  icon: string;
  color: number;
}

export const SCROLLS: ScrollDef[] = [
  { id: 'bless', name: 'Zwój błogosławieństwa', desc: 'porażka nie obniża poziomu', icon: 'sc_bless', color: C.yellow },
  { id: 'dragon', name: 'Zwój smoka', desc: '+15% szansy', icon: 'sc_dragon', color: C.orange },
  { id: 'talisman', name: 'Talizman kowala', desc: 'chroni przed pęknięciem i zniszczeniem', icon: 'sc_talisman', color: C.lime },
];

export const SCROLL_BY_ID = Object.fromEntries(SCROLLS.map((s) => [s.id, s])) as Record<ScrollId, ScrollDef>;

/**
 * Próba ulepszenia na poziom `to` (indeks to-1): szansa, materiał i jego liczba, a po porażce szansa na spadek o poziom
 * i na pęknięcie (liczone po kolei; reszta = nic się nie dzieje).
 */
export interface ForgeStep {
  chance: number;
  mat: MatId;
  count: number;
  down: number;
  crack: number;
}

const step = (chance: number, mat: MatId, count: number, down: number, crack: number): ForgeStep => ({ chance, mat, count, down, crack });

export const FORGE_STEPS: ForgeStep[] = [
  step(1, 'stone', 1, 0, 0), step(0.95, 'stone', 1, 0, 0), step(0.9, 'stone', 2, 0, 0),
  step(0.75, 'ore', 1, 0.3, 0), step(0.65, 'ore', 1, 0.3, 0), step(0.55, 'ore', 2, 0.3, 0),
  step(0.45, 'heart', 1, 0.5, 0.1), step(0.35, 'heart', 1, 0.5, 0.1), step(0.25, 'heart', 2, 0.5, 0.1),
  step(0.2, 'tear', 1, 0.6, 0.2), step(0.15, 'tear', 1, 0.6, 0.2), step(0.12, 'tear', 2, 0.6, 0.2),
  step(0.09, 'void', 1, 0.7, 0.3), step(0.07, 'void', 1, 0.7, 0.3), step(0.05, 'void', 2, 0.7, 0.3),
];

/** Progi kuźni: poziom, nazwa i opis (do karty przedmiotu i ekranu kuźni). */
export const FORGE_TIERS: { at: number; name: string; desc: string }[] = [
  { at: 3, name: 'Hartowanie', desc: 'nowy bonus (na stałe)' },
  { at: 6, name: 'Blask', desc: 'bonus bazowy x1.2' },
  { at: 9, name: 'Przebudzenie', desc: 'efekt zależny od typu przedmiotu' },
  { at: 12, name: 'Runa mocy', desc: 'super-bonus albo +50% jego wartości (na stałe)' },
  { at: 15, name: 'Boski', desc: 'wszystkie wartości x1.25, Przebudzenie x2' },
];

/** Przebudzenie (+9) wg typu przedmiotu; `v` = 1, a na +15 = 2. Efekty jak karty: flagi, statystyki, hooki (stosy = v). */
export interface AwakenDef {
  name: string;
  desc: (v: number) => string;
  flags?: (v: number) => Record<string, number>;
  stats?: (v: number) => Partial<Stats>;
  hooks?: CardHooks;
}

/** Licznik w stanie kart (co N-te zdarzenie) — wspólny dla hooków przebudzeń. */
const nth = (st: Record<string, number>, key: string, n: number) => (st[key] = (st[key] ?? 0) + 1) % n === 0;

export const AWAKENINGS: Record<ItemKind, AwakenDef> = {
  weapon: {
    name: 'Przebudzony cios', desc: (v) => `co 10. trafienie zadaje dodatkowo ${v * 100}% obrażeń`,
    hooks: { onHit: (run, e, dmg, _c, v) => { if (nth(run.cardState, 'awk.weapon', 10)) run.damageEnemy(e, dmg * v, 'Przebudzenie'); } },
  },
  helmet: { name: 'Czujność', desc: (v) => `co ${30 / v} s pierwsze trafienie w ciebie jest blokowane`, flags: (v) => ({ aegis: 30 / v }) },
  armor: {
    name: 'Żywy pancerz', desc: (v) => `co 20 s tarcza ${10 * v}% maks. HP`,
    hooks: { onTick: (run, dt, v) => { if ((run.cardState['awk.armor'] = (run.cardState['awk.armor'] ?? 0) + dt) >= 20) { run.cardState['awk.armor'] = 0; run.addShield(run.stats.maxHp * 0.1 * v, 0.4); } } },
  },
  gloves: { name: 'Iskrzące dłonie', desc: (v) => `krytyki porażają, +${3 * v}% krytyka`, flags: () => ({ critShock: 1 }), stats: (v) => ({ crit: 0.03 * v }) },
  boots: {
    name: 'Ogniste kroki', desc: (v) => `unik zostawia płonącą ziemię (${v === 1 ? 'mała' : 'duża'})`,
    hooks: { onDash: (run, v) => run.addFire(run.player.x, run.player.y, 18 * v * run.stats.area, run.cardDamage(6 * v), 2.5 * run.stats.duration, 'Ogniste kroki') },
  },
  ring: { name: 'Pierścień czasu', desc: (v) => `umiejętności odnawiają się ${5 * v}% szybciej`, stats: (v) => ({ cdr: 0.05 * v }) },
  amulet: { name: 'Mądrość wieków', desc: (v) => `+${10 * v}% doświadczenia i złota`, stats: (v) => ({ growth: 0.1 * v, greed: 0.1 * v }) },
};
