import { C } from '../core/palette';
import type { Stats } from '../entities/types';
import type { Tag } from './cards';

/**
 * Umiejętności aktywne bohaterów. `kind` wskazuje zachowanie w systems/abilities.ts,
 * a `p` (wartości bazowe) i `pl` (przyrost na poziom) to jego parametry.
 * Ultimate (slot 'ult') nie ma czasu odnowienia — ładuje się zabójstwami (`charge`).
 */
export type AbilitySlot = 'q' | 'e' | 'dash' | 'ult';
export type AbilityKind = 'volley' | 'net' | 'dash' | 'rain' | 'charge' | 'slam' | 'titan';

export interface AbilityDef {
  id: string;
  name: string;
  desc: string;
  slot: AbilitySlot;
  kind: AbilityKind;
  /** Ikona 16×16 (gfx/icons.ts). */
  icon: string;
  color: number;
  cooldown: number;
  /** Zmiana czasu odnowienia na poziom (ujemna = szybciej). */
  cdPerLevel: number;
  /** Zabójstwa potrzebne do pierwszego naładowania (tylko ultimate); każde użycie podnosi próg (BAL.ultGrowth). */
  charge?: number;
  maxLevel: number;
  p: Record<string, number>;
  pl: Record<string, number>;
  /**
   * Ewolucja: na maks. poziomie, gdy synergia `tag` jest aktywna (próg I+), umiejętność zmienia się
   * w mocniejszą wersję (nowa nazwa, ikona, `bonus` do parametrów i dodatkowy efekt w systems/abilities.ts).
   */
  evo?: { tag: Tag; name: string; desc: string; icon: string; bonus: Record<string, number> };
  /** Wersja po ewolucji (tworzona przez evolveAbility). */
  evolved?: boolean;
}

export type HeroPassiveKind = 'nthVolley' | 'killShield';

export interface HeroDef {
  id: string;
  name: string;
  role: string;
  sprite: string;
  color: number;
  base: Partial<Stats>;
  weapon: string;
  /** Tagi synergii bohatera (po 1 punkcie, data/synergies.ts). */
  tags: Tag[];
  passive: { name: string; desc: string; kind: HeroPassiveKind; value: number };
  abilities: AbilityDef[];
}

/** Wartość parametru umiejętności na danym poziomie. */
export function abilityParam(def: AbilityDef, level: number, key: string): number {
  return (def.p[key] ?? 0) + (def.pl[key] ?? 0) * (level - 1);
}

/** Definicja umiejętności po ewolucji (id bez zmian — karty typu "k_volley.count" działają dalej). */
export function evolveAbility(def: AbilityDef): AbilityDef {
  const e = def.evo!;
  const p = { ...def.p };
  for (const [k, v] of Object.entries(e.bonus)) p[k] = (p[k] ?? 0) + v;
  return { ...def, name: e.name, desc: e.desc, icon: e.icon, p, evo: undefined, evolved: true };
}

export function abilityCooldown(def: AbilityDef, level: number): number {
  return Math.max(0.5, def.cooldown + def.cdPerLevel * (level - 1));
}

/** Opisy przyrostów parametrów umiejętności na poziom (klucze z `pl`). */
const ABILITY_DELTA: Record<string, (v: number, def: AbilityDef) => string> = {
  damage: (v) => `+${v} obrażeń`,
  count: (v, d) => `+${v} ${d.kind === 'volley' ? 'strzała' : 'pocisk'}`,
  radius: (v) => `+${v} promienia`,
  duration: (v) => `działa o ${v} s dłużej`,
  dist: (v) => `+${v} zasięgu`,
  might: (v) => `+${Math.round(v * 100)}% obrażeń w trakcie`,
  stun: (v) => `ogłuszenie o ${v} s dłuższe`,
};

/** Co daje następny poziom umiejętności (dla ekranu awansu). */
export function describeAbilityLevel(def: AbilityDef): string {
  const parts = Object.entries(def.pl).map(([k, v]) => (ABILITY_DELTA[k] ? ABILITY_DELTA[k](v, def) : `${k} +${v}`));
  if (def.cdPerLevel < 0) parts.push(`odnowienie krótsze o ${-def.cdPerLevel} s`);
  return parts.join(', ');
}

export const HEROES: HeroDef[] = [
  {
    id: 'kestra', name: 'Kestra', role: 'Strzelec', sprite: 'kestra', color: C.lime,
    base: { maxHp: 100, speed: 62, crit: 0.08 },
    weapon: 'arrow',
    tags: ['Pociski', 'Krytyk'],
    passive: { name: 'Sokole oko', desc: 'Co 4. strzał z łuku wypuszcza 2 dodatkowe strzały, zawsze krytyczne.', kind: 'nthVolley', value: 4 },
    abilities: [
      {
        id: 'k_volley', name: 'Salwa', icon: 'ab_k_volley', desc: 'Wachlarz strzał w stronę celownika, każda przebija kilku wrogów.', slot: 'q', kind: 'volley', color: C.peach,
        cooldown: 6, cdPerLevel: -0.4, maxLevel: 5,
        p: { damage: 22, count: 7, spread: 0.9, pierce: 3, speed: 240 }, pl: { damage: 10, count: 1 },
        evo: { tag: 'Pociski', name: 'Burza strzał', desc: 'Dwie salwy jedna po drugiej, więcej strzał i przebić.', icon: 'ab_k_volley_evo', bonus: { count: 4, damage: 15, pierce: 2 } },
      },
      {
        id: 'k_net', name: 'Sieć', icon: 'ab_k_net', desc: 'Sieć w miejscu celownika: spowalnia i rani wrogów w środku.', slot: 'e', kind: 'net', color: C.lgray,
        cooldown: 11, cdPerLevel: -0.6, maxLevel: 5,
        p: { damage: 8, radius: 30, slow: 0.6, duration: 3, range: 130 }, pl: { damage: 5, radius: 4, duration: 0.4 },
        evo: { tag: 'Obszar', name: 'Lodowa sieć', desc: 'Większa sieć, która na starcie zamraża wrogów w środku na 1.5 s.', icon: 'ab_k_net_evo', bonus: { radius: 15, damage: 8, duration: 1 } },
      },
      {
        id: 'k_roll', name: 'Przewrót', icon: 'ab_k_roll', desc: 'Szybki unik z chwilową nietykalnością.', slot: 'dash', kind: 'dash', color: C.blue,
        cooldown: 2.5, cdPerLevel: 0, maxLevel: 1,
        p: { dist: 64, iframes: 0.35 }, pl: {},
      },
      {
        id: 'k_rain', name: 'Deszcz strzał', icon: 'ab_k_rain', desc: 'Grad strzał spada przez kilka sekund w miejscu celownika.', slot: 'ult', kind: 'rain', color: C.yellow,
        cooldown: 0, cdPerLevel: 0, charge: 120, maxLevel: 5,
        p: { damage: 18, radius: 52, duration: 3.5, range: 150 }, pl: { damage: 10, radius: 6 },
        evo: { tag: 'Umiejętności', name: 'Nawałnica z nieba', desc: 'Większy i dłuższy grad, a drugi spada wokół ciebie.', icon: 'ab_k_rain_evo', bonus: { radius: 25, duration: 2, damage: 10 } },
      },
    ],
  },
  {
    id: 'borgun', name: 'Borgun', role: 'Wojownik', sprite: 'borgun', color: C.red,
    base: { maxHp: 150, speed: 52, armor: 4, regen: 0.3 },
    weapon: 'axe',
    tags: ['Tarcze', 'Obszar'],
    passive: { name: 'Żelazna wola', desc: 'Zabójstwa dają tarczę (0.5% HP każde, do 3% HP na sekundę, maks. 15% HP).', kind: 'killShield', value: 0.15 },
    abilities: [
      {
        id: 'b_charge', name: 'Szarża', icon: 'ab_b_charge', desc: 'Pędzisz w stronę celownika, raniąc i ogłuszając wrogów na drodze.', slot: 'q', kind: 'charge', color: C.orange,
        cooldown: 7, cdPerLevel: -0.4, maxLevel: 5,
        p: { damage: 30, dist: 90, width: 14, stun: 0.6 }, pl: { damage: 14, dist: 8 },
        evo: { tag: 'Szybkość', name: 'Taran tytana', desc: 'Dłuższa szarża zakończona falą uderzeniową.', icon: 'ab_b_charge_evo', bonus: { damage: 30, dist: 30 } },
      },
      {
        id: 'b_slam', name: 'Wstrząs', icon: 'ab_b_slam', desc: 'Uderzasz w ziemię: ranisz i ogłuszasz wrogów wokół siebie.', slot: 'e', kind: 'slam', color: C.brown,
        cooldown: 9, cdPerLevel: -0.5, maxLevel: 5,
        p: { damage: 40, radius: 46, stun: 1.2 }, pl: { damage: 18, radius: 4 },
        evo: { tag: 'Obszar', name: 'Rozłam', desc: 'Mocniejsze uderzenie i druga, szersza fala po chwili.', icon: 'ab_b_slam_evo', bonus: { damage: 40, radius: 15 } },
      },
      {
        id: 'b_leap', name: 'Doskok', icon: 'ab_b_leap', desc: 'Krótki doskok z nietykalnością.', slot: 'dash', kind: 'dash', color: C.blue,
        cooldown: 3, cdPerLevel: 0, maxLevel: 1,
        p: { dist: 52, iframes: 0.3 }, pl: {},
      },
      {
        id: 'b_titan', name: 'Gniew tytana', icon: 'ab_b_titan', desc: 'Na kilka sekund: więcej obrażeń i pancerza, ranisz wrogów wokół.', slot: 'ult', kind: 'titan', color: C.red,
        cooldown: 0, cdPerLevel: 0, charge: 140, maxLevel: 5,
        p: { duration: 7, might: 0.5, armor: 10, damage: 20, radius: 40 }, pl: { duration: 1, might: 0.15, damage: 10 },
        evo: { tag: 'Życie', name: 'Awatar', desc: 'Dłuższy gniew, większa aura i leczenie 2% HP na sekundę.', icon: 'ab_b_titan_evo', bonus: { duration: 3, damage: 15, radius: 15 } },
      },
    ],
  },
];

export const HERO_BY_ID: Record<string, HeroDef> = Object.fromEntries(HEROES.map((h) => [h.id, h]));
