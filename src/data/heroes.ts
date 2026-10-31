import { C } from '../core/palette';
import { getLang } from '../core/i18n';
import { BAL } from './balance';
import type { Stats } from '../entities/types';
import type { Tag } from './cards';

/**
 * Umiejętności aktywne bohaterów. `kind` wskazuje zachowanie w systems/abilities.ts,
 * a `p` (wartości bazowe) i `pl` (przyrost na poziom) to jego parametry.
 * Ultimate (slot 'ult') nie ma czasu odnowienia — ładuje się zabójstwami (`charge`).
 */
export type AbilitySlot = 'q' | 'e' | 'dash' | 'ult';
export type AbilityKind = 'volley' | 'net' | 'dash' | 'rain' | 'charge' | 'slam' | 'titan' | 'fireball' | 'firering' | 'inferno' | 'summon' | 'curse' | 'legion'
  | 'shadowstep' | 'execute' | 'bladedance' | 'guardian' | 'lance' | 'sanctum' | 'judgment' | 'overhead' | 'flurry' | 'iai'
  | 'falcon' | 'quake' | 'flare' | 'plague' | 'deathmark' | 'bastion' | 'mushin';

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
  /** Drugi ultimate (R4): to samo `id` co pierwszy (flagi drzewka i kart), własna ewolucja w swoim zachowaniu. */
  alt?: boolean;
}

/**
 * nthVolley: co N-ta salwa broni podstawowej mocniejsza; killShield: tarcza za zabójstwa; echoCast: co N-te Q/E powtarza się za darmo;
 * killSummon: co N-te zabójstwo przywołuje ducha-sługę; killReset: co N-te zabójstwo (i każda elita) odnawia Q;
 * guardShield: co N s tarcza za każdego sługę (systems/minions.ts).
 */
export type HeroPassiveKind = 'nthVolley' | 'killShield' | 'echoCast' | 'killSummon' | 'killReset' | 'guardShield' | 'parry';

/**
 * Zasób bohatera (pasek pod HP, systems/resource.ts, liczby w BAL.resource):
 * focus — celność z trafień z dystansu (krytyki, przy pełnej darmowa Salwa), fury — furia z walki wręcz i obrywania
 * (obrażenia i redukcja, opada poza walką), heat — żar z czarów (mocniejsze czary, przegrzanie rani, unik zrzuca żar),
 * souls — dusze z zabitych w pobliżu (przy pełnych sługa, R zużywa wszystkie),
 * streak — kombo z każdego trafienia (więcej obrażeń, E zużywa całe na egzekucję, oberwanie zeruje),
 * faith — wiara z zabójstw w pobliżu i leczenia (przy pełnej Łaska: leczenie, tarcza, dłuższe sługi; R zużywa całą),
 * rhythm — rytm z trafień: każdy punkt to szybkość ataku, opada bez walki, oberwanie zabiera część, Iai (R) zużywa cały.
 */
export type ResourceKind = 'focus' | 'fury' | 'heat' | 'souls' | 'streak' | 'faith' | 'rhythm';

export interface ResourceDef {
  kind: ResourceKind;
  name: string;
  desc: string;
  color: number;
}

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
  resource: ResourceDef;
  abilities: AbilityDef[];
  /** R4 (0.45): drugi ultimate do wyboru na ekranie bohatera (R); zastępuje ult z `abilities`. */
  altUlt?: AbilityDef;
}

/** Umiejętności bohatera z wybranym ultimate (alt = drugi, jeśli bohater go ma). */
export function heroAbilities(h: HeroDef, alt: boolean): AbilityDef[] {
  return alt && h.altUlt ? h.abilities.map((a) => (a.slot === 'ult' ? h.altUlt! : a)) : h.abilities;
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
  count: (v, d) => `+${v} ${d.kind === 'volley' ? 'strzała' : d.kind === 'summon' || d.kind === 'legion' || d.kind === 'guardian' ? 'sługa' : d.kind === 'judgment' ? 'cel' : d.kind === 'lance' ? 'włócznia' : 'pocisk'}`,
  radius: (v) => `+${v} promienia`,
  duration: (v) => `działa o ${v} s dłużej`,
  dist: (v) => `+${v} zasięgu`,
  might: (v) => `+${Math.round(v * 100)}% obrażeń w trakcie`,
  stun: (v) => `ogłuszenie o ${v} s dłuższe`,
  blast: (v) => `+${v} promienia wybuchów`,
  exec: (v) => `próg egzekucji +${Math.round(v * 100)}% HP`,
  impact: (v) => `+${v} promienia uderzenia`,
  slashes: (v) => `+${v} slash`,
};

/** Co daje następny poziom umiejętności (dla ekranu awansu). */
export function describeAbilityLevel(def: AbilityDef): string {
  const parts = Object.entries(def.pl).map(([k, v]) => (ABILITY_DELTA[k] ? ABILITY_DELTA[k](v, def) : `${k} +${v}`));
  if (def.cdPerLevel < 0) parts.push(`odnowienie krótsze o ${-def.cdPerLevel} s`);
  return parts.join(', ');
}

/**
 * Statystyki bazowe (`base` nadpisuje DEFAULT_STATS). 0.62 (playtest 2: Kestra ginęła na 2. mapie, Borgun przechodził akt 1
 * bez obrażeń — tarcza za zabójstwa, pancerz i 150 HP): pozostali bohaterowie dostali więcej HP, trochę pancerza i regeneracji
 * (bot, akt 1 na Zwykłej: mediana przejść map Kestry 1 → 4, Borgun bez zmian).
 */
export const HEROES: HeroDef[] = [
  {
    id: 'kestra', name: 'Kestra', role: 'Strzelec', sprite: 'kestra', color: C.lime,
    base: { maxHp: 135, speed: 62, crit: 0.08, armor: 3, regen: 0.2 },
    weapon: 'arrow',
    tags: ['Pociski', 'Krytyk'],
    passive: { name: 'Sokole oko', desc: 'Co 4. strzał z łuku wypuszcza 2 dodatkowe strzały, zawsze krytyczne.', kind: 'nthVolley', value: 4 },
    resource: { kind: 'focus', name: 'Celność', color: C.lime, desc: 'Trafienia z dystansu dają celność (więcej krytyków). Pełna celność wypuszcza darmową Salwę. Trafienie cię zabiera połowę.' },
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
    altUlt: { id: 'k_rain', alt: true, name: 'Falcon Shot', icon: 'ab_k_falcon', desc: 'One huge arrow along your aim that pierces everything in a long line. Spends all Focus for more damage.', slot: 'ult', kind: 'falcon', color: C.gold,
      cooldown: 0, cdPerLevel: 0, charge: 110, maxLevel: 5,
      p: { damage: 90, radius: 52, duration: 3.5 }, pl: { damage: 40, radius: 6 },
      evo: { tag: 'Umiejętności', name: 'Falcon Storm', desc: 'Three huge arrows in a fan.', icon: 'ab_k_falcon_evo', bonus: { damage: 30 } } },
  },
  {
    id: 'borgun', name: 'Borgun', role: 'Wojownik', sprite: 'borgun', color: C.red,
    base: { maxHp: 150, speed: 52, armor: 4, regen: 0.3, might: 1.15 },
    weapon: 'axe',
    tags: ['Tarcze', 'Obszar'],
    passive: { name: 'Żelazna wola', desc: 'Zabójstwa dają tarczę (0.5% HP każde, do 3% HP na sekundę, maks. 15% HP).', kind: 'killShield', value: 0.15 },
    resource: { kind: 'fury', name: 'Furia', color: C.red, desc: 'Rośnie od walki wręcz i obrywania. Pełna wyzwala Szał: kilka sekund dużo silniejszych i szybszych ciosów z leczeniem.' },
    abilities: [
      {
        id: 'b_charge', name: 'Szarża', icon: 'ab_b_charge', desc: 'Szarżujesz do celownika, tratując wrogów, i kończysz uderzeniem w ziemię. Każdy staranowany wróg wzmacnia uderzenie i daje Furię, zabójstwa skracają odnowienie.', slot: 'q', kind: 'charge', color: C.orange,
        cooldown: 7, cdPerLevel: -0.4, maxLevel: 5,
        p: { damage: 30, dist: 90, width: 14, stun: 0.6, impact: 30 }, pl: { damage: 14, dist: 8, impact: 2 },
        evo: { tag: 'Szybkość', name: 'Taran tytana', desc: 'Dłuższa szarża, dwa razy szersze uderzenie i druga fala uderzeniowa.', icon: 'ab_b_charge_evo', bonus: { damage: 30, dist: 30, impact: 30 } },
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
    altUlt: { id: 'b_titan', alt: true, name: 'Earthquake', icon: 'ab_b_quake', desc: 'Three ever wider shockwaves around you: damage, knockback and a short stun (not on bosses). Fury makes the stun longer.', slot: 'ult', kind: 'quake', color: C.brown,
      cooldown: 0, cdPerLevel: 0, charge: 140, maxLevel: 5,
      p: { duration: 7, damage: 40, radius: 40 }, pl: { duration: 1, damage: 15, radius: 4 },
      evo: { tag: 'Życie', name: 'World Breaker', desc: 'Five shockwaves instead of three.', icon: 'ab_b_quake_evo', bonus: { damage: 15, radius: 10 } } },
  },
  {
    id: 'ignara', name: 'Ignara', role: 'Mag ognia', sprite: 'ignara', color: C.orange,
    base: { maxHp: 140, speed: 58, cdr: 0.1, elemPower: 0.15, armor: 3, regen: 0.2 },
    weapon: 'staff',
    tags: ['Ogień', 'Umiejętności'],
    passive: { name: 'Echo mocy', desc: 'Co 3. użycie Q lub E powtarza się po chwili za darmo.', kind: 'echoCast', value: 3 },
    resource: { kind: 'heat', name: 'Żar', color: C.orange, desc: 'Q i E rozgrzewają: czary są mocniejsze, ale przegrzanie rani. Unik (od 40 żaru) zrzuca go wybuchem ognia.' },
    abilities: [
      {
        id: 'i_fireball', name: 'Kula ognia', icon: 'ab_i_fireball', desc: 'Kula ognia w miejscu celownika: wybuch i płonąca ziemia.', slot: 'q', kind: 'fireball', color: C.orange,
        cooldown: 5, cdPerLevel: -0.3, maxLevel: 5,
        p: { damage: 45, radius: 26, range: 140 }, pl: { damage: 18, radius: 3 },
        evo: { tag: 'Ogień', name: 'Słońce', desc: 'Potężniejszy wybuch, po którym wokół celu wybuchają 3 kolejne kule.', icon: 'ab_i_fireball_evo', bonus: { damage: 30, radius: 8 } },
      },
      {
        id: 'i_ring', name: 'Pierścień ognia', icon: 'ab_i_ring', desc: 'Odpychasz wrogów i otaczasz się kręgiem płomieni.', slot: 'e', kind: 'firering', color: C.gold,
        cooldown: 12, cdPerLevel: -0.6, maxLevel: 5,
        p: { damage: 10, radius: 40, duration: 3 }, pl: { damage: 5, radius: 4, duration: 0.5 },
        evo: { tag: 'Tarcze', name: 'Płomienna bariera', desc: 'Większy krąg, a ty dostajesz tarczę 15% HP.', icon: 'ab_i_ring_evo', bonus: { radius: 10, damage: 6 } },
      },
      {
        id: 'i_blink', name: 'Mignięcie', icon: 'ab_i_blink', desc: 'Błyskawiczny przeskok z nietykalnością.', slot: 'dash', kind: 'dash', color: C.blue,
        cooldown: 2.8, cdPerLevel: 0, maxLevel: 1,
        p: { dist: 72, iframes: 0.3 }, pl: {},
      },
      {
        id: 'i_inferno', name: 'Inferno', icon: 'ab_i_inferno', desc: 'Przez kilka sekund wokół ciebie spadają płonące meteory.', slot: 'ult', kind: 'inferno', color: C.red,
        cooldown: 0, cdPerLevel: 0, charge: 130, maxLevel: 5,
        p: { duration: 5, damage: 30, radius: 90, blast: 22 }, pl: { duration: 0.5, damage: 12, blast: 2 },
        evo: { tag: 'Umiejętności', name: 'Kataklizm', desc: 'Dłuższy deszcz meteorów, które spadają dwa razy gęściej.', icon: 'ab_i_inferno_evo', bonus: { duration: 2, damage: 15 } },
      },
    ],
    altUlt: { id: 'i_inferno', alt: true, name: 'Solar Flare', icon: 'ab_i_flare', desc: 'Spends all Heat (no overheating): after a moment a huge explosion around you. More Heat = bigger and stronger.', slot: 'ult', kind: 'flare', color: C.gold,
      cooldown: 0, cdPerLevel: 0, charge: 130, maxLevel: 5,
      p: { duration: 5, damage: 60, radius: 90, blast: 22 }, pl: { damage: 25, blast: 4 },
      evo: { tag: 'Umiejętności', name: 'Twin Suns', desc: 'A second explosion right after the first.', icon: 'ab_i_flare_evo', bonus: { damage: 20 } } },
  },
  {
    id: 'morwen', name: 'Morwen', role: 'Przywoływaczka', sprite: 'morwen', color: C.pink,
    base: { maxHp: 110, speed: 56, duration: 1.1, armor: 1, regen: 0.2 },
    weapon: 'souls',
    tags: ['Przywołania', 'Klątwa'],
    passive: { name: 'Zew dusz', desc: 'Co 15. zabójstwo z ciała wroga powstaje duch-sługa na 8 s.', kind: 'killSummon', value: 15 },
    resource: { kind: 'souls', name: 'Dusze', color: C.pink, desc: 'Wrogowie ginący w pobliżu dają dusze. Pełne zamieniają się w sługę, a R zużywa wszystkie: mocniejsza armia.' },
    abilities: [
      {
        id: 'm_raise', name: 'Przywołanie', icon: 'ab_m_raise', desc: 'Przywołujesz duchy-sługi, które gonią i ranią wrogów.', slot: 'q', kind: 'summon', color: C.pink,
        cooldown: 9, cdPerLevel: -0.5, maxLevel: 5,
        p: { count: 2, damage: 14, duration: 10 }, pl: { count: 1, damage: 6 },
        evo: { tag: 'Przywołania', name: 'Zastęp', desc: 'Więcej i silniejszych duchów, które dłużej trwają.', icon: 'ab_m_raise_evo', bonus: { count: 2, damage: 10, duration: 4 } },
      },
      {
        id: 'm_curse', name: 'Bagno dusz', icon: 'ab_m_curse', desc: 'Przeklęte bagno w miejscu celownika: spowalnia, rani i zatruwa.', slot: 'e', kind: 'curse', color: C.lime,
        cooldown: 11, cdPerLevel: -0.6, maxLevel: 5,
        p: { damage: 8, radius: 34, duration: 4, range: 130 }, pl: { damage: 4, radius: 4, duration: 0.5 },
        evo: { tag: 'Klątwa', name: 'Przeklęta ziemia', desc: 'Większe bagno, które także poraża wrogów (więcej obrażeń ze wszystkich źródeł).', icon: 'ab_m_curse_evo', bonus: { radius: 14, damage: 6 } },
      },
      {
        id: 'm_shade', name: 'Cień', icon: 'ab_m_shade', desc: 'Rozpływasz się w cień i przemykasz z nietykalnością.', slot: 'dash', kind: 'dash', color: C.plum,
        cooldown: 2.8, cdPerLevel: 0, maxLevel: 1,
        p: { dist: 60, iframes: 0.45 }, pl: {},
      },
      {
        id: 'm_legion', name: 'Armia umarłych', icon: 'ab_m_legion', desc: 'Z ziemi wstają potężni wojownicy-duchy, które walczą za ciebie.', slot: 'ult', kind: 'legion', color: C.salmon,
        cooldown: 0, cdPerLevel: 0, charge: 130, maxLevel: 5,
        p: { count: 5, damage: 40, duration: 12 }, pl: { count: 1, damage: 15 },
        evo: { tag: 'Umiejętności', name: 'Nieśmiertelny legion', desc: 'Więcej wojowników, a każdy na koniec wybucha (3x obrażeń).', icon: 'ab_m_legion_evo', bonus: { count: 2, damage: 15 } },
      },
    ],
    altUlt: { id: 'm_legion', alt: true, name: 'Plague', icon: 'ab_m_plague', desc: 'Poisons and slows every enemy on screen. An infected enemy that dies passes the plague to its neighbours. Souls make the poison stronger.', slot: 'ult', kind: 'plague', color: C.lime,
      cooldown: 0, cdPerLevel: 0, charge: 110, maxLevel: 5,
      p: { count: 5, damage: 40, duration: 12 }, pl: { count: 1, damage: 15 },
      evo: { tag: 'Umiejętności', name: 'Black Death', desc: 'The plague spreads further and slows the infected.', icon: 'ab_m_plague_evo', bonus: { count: 2, damage: 15 } } },
  },
  {
    id: 'vesper', name: 'Vesper', role: 'Zabójczyni', sprite: 'vesper', color: C.salmon,
    base: { maxHp: 115, speed: 66, crit: 0.12, armor: 2, regen: 0.2 },
    weapon: 'knives',
    tags: ['Krytyk', 'Szybkość'],
    passive: { name: 'Łowczyni', desc: 'Elita albo co 12. zabójstwo od razu odnawia Cios z cienia.', kind: 'killReset', value: 12 },
    resource: { kind: 'streak', name: 'Kombo', color: C.lavender, desc: 'Trafienia podbijają kombo: więcej obrażeń. Egzekucja (E) zużywa całe na potężny cios. Oberwanie je zeruje.' },
    abilities: [
      {
        id: 'v_step', name: 'Cios z cienia', icon: 'ab_v_step', desc: 'Przenosisz się za wroga przy celowniku i zadajesz krytyczny cios.', slot: 'q', kind: 'shadowstep', color: C.lavender,
        cooldown: 5, cdPerLevel: -0.3, maxLevel: 5,
        p: { damage: 40, radius: 20, range: 130 }, pl: { damage: 16, radius: 2 },
        evo: { tag: 'Krytyk', name: 'Widmowy cios', desc: 'Po ciosie przeskakujesz do dwóch kolejnych wrogów.', icon: 'ab_v_step_evo', bonus: { damage: 30, radius: 6 } },
      },
      {
        id: 'v_exec', name: 'Egzekucja', icon: 'ab_v_exec', desc: 'Cięcie przed sobą za całe kombo. Słabi wrogowie (bez bossów) giną od razu.', slot: 'e', kind: 'execute', color: C.salmon,
        cooldown: 8, cdPerLevel: -0.4, maxLevel: 5,
        p: { damage: 50, radius: 44, exec: 0.15 }, pl: { damage: 20, radius: 3, exec: 0.02 },
        evo: { tag: 'Szybkość', name: 'Rzeź', desc: 'Cięcie dookoła ciebie, większe i mocniejsze.', icon: 'ab_v_exec_evo', bonus: { damage: 30, radius: 12, exec: 0.05 } },
      },
      {
        id: 'v_vanish', name: 'Zniknięcie', icon: 'ab_v_vanish', desc: 'Rozpływasz się w dymie i przemykasz z nietykalnością.', slot: 'dash', kind: 'dash', color: C.lgray,
        cooldown: 2.4, cdPerLevel: 0, maxLevel: 1,
        p: { dist: 70, iframes: 0.4 }, pl: {},
      },
      {
        id: 'v_dance', name: 'Taniec ostrzy', icon: 'ab_v_dance', desc: 'Przez kilka sekund cienie tną wrogów wokół, a ty jesteś nietykalna.', slot: 'ult', kind: 'bladedance', color: C.white,
        cooldown: 0, cdPerLevel: 0, charge: 130, maxLevel: 5,
        p: { duration: 3.5, damage: 30, radius: 110 }, pl: { duration: 0.4, damage: 12 },
        evo: { tag: 'Umiejętności', name: 'Burza ostrzy', desc: 'Dłuższy taniec, a cienie tną dwa razy częściej.', icon: 'ab_v_dance_evo', bonus: { duration: 1.5, damage: 15 } },
      },
    ],
    altUlt: { id: 'v_dance', alt: true, name: 'Death Mark', icon: 'ab_v_mark', desc: 'Marks every enemy on screen. A moment later each one is cut, and those below a share of their HP die at once (not bosses). Combo raises the share.', slot: 'ult', kind: 'deathmark', color: C.red,
      cooldown: 0, cdPerLevel: 0, charge: 130, maxLevel: 5,
      p: { duration: 3.5, damage: 30 }, pl: { duration: 0.4, damage: 12 },
      evo: { tag: 'Umiejętności', name: 'Reaper Mark', desc: 'A stronger cut and a higher kill threshold.', icon: 'ab_v_mark_evo', bonus: { damage: 15 } } },
  },
  {
    id: 'aurel', name: 'Aurel', role: 'Kapłan', sprite: 'aurel', color: C.yellow,
    base: { maxHp: 135, speed: 54, regen: 0.4, duration: 1.05, armor: 2 },
    weapon: 'light',
    tags: ['Życie', 'Obszar'],
    passive: { name: 'Guardian', desc: 'Every 6 s you get a shield of 2% HP for each Branded enemy near you (max 10% HP).', kind: 'guardShield', value: 6 },
    resource: { kind: 'faith', name: 'Wiara', color: C.yellow, desc: 'Grows from kills nearby and from healing. When full it becomes Grace: healing and a shield. Judgment (R) spends all of it.' },
    abilities: [
      {
        // 0.43: Włócznia światła zamiast Strażników (id i flagi a_guard.* zostają dla zapisów, drzewka i kart).
        id: 'a_guard', name: 'Spear of Light', icon: 'ab_a_guard', desc: 'You throw a spear of light that pierces every enemy in a line and Brands them for a few seconds. Your hits on Branded enemies heal you a little.', slot: 'q', kind: 'lance', color: C.yellow,
        cooldown: 4, cdPerLevel: -0.2, maxLevel: 5,
        p: { count: 1, damage: 70, duration: 6 }, pl: { damage: 22, duration: 0.5 },
        evo: { tag: 'Obszar', name: 'Dawn Spear', desc: 'Three spears in a fan, and Branded enemies burst with light when they die.', icon: 'ab_a_guard_evo', bonus: { count: 2, damage: 20 } },
      },
      {
        id: 'a_sanct', name: 'Uświęcona ziemia', icon: 'ab_a_sanct', desc: 'A circle of light around you: it heals you, hurts enemies and makes their Brand last longer.', slot: 'e', kind: 'sanctum', color: C.gold,
        cooldown: 12, cdPerLevel: -0.6, maxLevel: 5,
        p: { damage: 8, radius: 44, duration: 4, heal: 1 }, pl: { damage: 4, radius: 4, duration: 0.5 },
        evo: { tag: 'Życie', name: 'Sanktuarium', desc: 'Większy krąg, który na start daje tarczę 12% HP.', icon: 'ab_a_sanct_evo', bonus: { radius: 14, damage: 6, heal: 0.5 } },
      },
      {
        id: 'a_step', name: 'Krok światła', icon: 'ab_a_step', desc: 'Przeskakujesz w błysku z nietykalnością.', slot: 'dash', kind: 'dash', color: C.blue,
        cooldown: 3, cdPerLevel: 0, maxLevel: 1,
        p: { dist: 58, iframes: 0.35 }, pl: {},
      },
      {
        id: 'a_judge', name: 'Sąd', icon: 'ab_a_judge', desc: 'Słupy światła spadają na wielu wrogów. Wiara wzmacnia je i dokłada celów.', slot: 'ult', kind: 'judgment', color: C.white,
        cooldown: 0, cdPerLevel: 0, charge: 130, maxLevel: 5,
        p: { count: 8, damage: 70, radius: 160, blast: 20 }, pl: { count: 2, damage: 25 },
        evo: { tag: 'Umiejętności', name: 'Sąd ostateczny', desc: 'Po chwili spada druga fala słupów, a wiara nie przepada w całości.', icon: 'ab_a_judge_evo', bonus: { count: 4, damage: 25 } },
      },
    ],
    altUlt: { id: 'a_judge', alt: true, name: 'Bastion of Light', icon: 'ab_a_bastion', desc: 'A dome of light around you destroys enemy projectiles for a few seconds, then bursts and hurts nearby enemies. Faith makes it last longer.', slot: 'ult', kind: 'bastion', color: C.yellow,
      cooldown: 0, cdPerLevel: 0, charge: 130, maxLevel: 5,
      p: { count: 8, damage: 70, radius: 60, blast: 0 }, pl: { count: 2, damage: 25 },
      evo: { tag: 'Umiejętności', name: 'Fortress of Dawn', desc: 'Every destroyed projectile heals you a little.', icon: 'ab_a_bastion_evo', bonus: { count: 4, damage: 25 } } },
  },
  {
    // Takezo (0.32): szermierz na wzór Miyamoto Musashiego — dwa miecze (Niten Ichi-ryū), rytm walki (hyōshi), cięcie iai.
    id: 'takezo', name: 'Takezo', role: 'Swordsman', sprite: 'takezo', color: C.blue,
    base: { maxHp: 135, speed: 60, atkSpeed: 0.1, might: 1.08, armor: 3, regen: 0.2 },
    weapon: 'katana',
    tags: ['Szybkość', 'Krytyk'],
    passive: { name: 'Mikiri', desc: '5% chance to parry a hit or a projectile at level 1, +0.6% per level (max 35%, cards included): no damage, a counter cut around you and +6 Rhythm. Parried projectiles fly back at enemies.', kind: 'parry', value: 20 },
    resource: { kind: 'rhythm', name: 'Rhythm', color: C.cyan, desc: 'Every hit builds Rhythm and attack speed, and getting hit does not take it away. Full Rhythm starts Flow: very fast, stronger attacks that last until you are hit; then the bar drains to zero and builds again. Iai (R) spends it on a stronger cut.' },
    abilities: [
      {
        id: 't_slam', name: 'Helm Splitter', icon: 'ab_t_slam', desc: 'An overhead strike into the ground in front of you: damage and a short stun in a circle.', slot: 'q', kind: 'overhead', color: C.lgray,
        cooldown: 5, cdPerLevel: -0.3, maxLevel: 5,
        p: { damage: 55, radius: 30, dist: 34, stun: 0.5 }, pl: { damage: 18, radius: 3 },
        evo: { tag: 'Obszar', name: 'Heaven Splitter', desc: 'The strike cracks the ground: a second, bigger blast further ahead.', icon: 'ab_t_slam_evo', bonus: { damage: 30, radius: 6 } },
      },
      {
        id: 't_flurry', name: 'Thousand Cuts', icon: 'ab_t_flurry', desc: 'A flurry of slashes in a cone in front of you. Attack speed and Rhythm add slashes.', slot: 'e', kind: 'flurry', color: C.cyan,
        cooldown: 7, cdPerLevel: -0.3, maxLevel: 5,
        p: { damage: 15, radius: 48, slashes: 4 }, pl: { damage: 5, slashes: 1 },
        evo: { tag: 'Szybkość', name: 'Two Heavens', desc: 'Both blades: every slash cuts in front of and behind you.', icon: 'ab_t_flurry_evo', bonus: { damage: 6, slashes: 2 } },
      },
      {
        id: 't_step', name: 'Footwork', icon: 'ab_t_step', desc: 'A quick step with a moment of invulnerability.', slot: 'dash', kind: 'dash', color: C.blue,
        cooldown: 2.6, cdPerLevel: 0, maxLevel: 1,
        p: { dist: 66, iframes: 0.38 }, pl: {},
      },
      {
        id: 't_iai', name: 'Iai', icon: 'ab_t_iai', desc: 'You dash through the enemies and sheathe your sword: a moment later everything on the path is cut. Spends all Rhythm.', slot: 'ult', kind: 'iai', color: C.white,
        cooldown: 0, cdPerLevel: 0, charge: 120, maxLevel: 5,
        p: { damage: 120, dist: 150, width: 18 }, pl: { damage: 45, dist: 10 },
        evo: { tag: 'Krytyk', name: 'Final Cut', desc: 'After the cut you dash back along the path and cut it again.', icon: 'ab_t_iai_evo', bonus: { damage: 60, width: 6 } },
      },
    ],
    altUlt: { id: 't_iai', alt: true, name: 'Mushin', icon: 'ab_t_mushin', desc: 'For a few seconds you parry every hit and projectile, answering with counter cuts. Rhythm fills at once (Flow).', slot: 'ult', kind: 'mushin', color: C.cyan,
      cooldown: 0, cdPerLevel: 0, charge: 120, maxLevel: 5,
      p: { damage: 120, dist: 150 }, pl: { damage: 45, dist: 10 },
      evo: { tag: 'Krytyk', name: 'Empty Mind', desc: 'Twice as many counter cuts per second.', icon: 'ab_t_mushin_evo', bonus: { damage: 60 } } },
  },
];

/** Procent z ułamka (do opisów). */
const pc = (v: number) => `${Math.round(v * 100)}%`;
/** Liczba z najwyżej dwoma miejscami po przecinku (separator wg języka). */
const dec = (v: number) => { const t = String(Math.round(v * 100) / 100); return getLang() === 'pl' ? t.replace('.', ',') : t; };

/** Opis zasobu wg wybranego ultimate: z Mushin (Takezo) zdanie o Iai zużywającym Rytm zastępuje zapełnianie. */
export function resourceDesc(h: HeroDef, alt: boolean): string {
  const d = h.resource.desc;
  return alt && h.altUlt?.kind === 'mushin' ? d.replace('Iai (R) spends it on a stronger cut.', 'Mushin (R) fills it at once (Flow).') : d;
}

/** Szczegóły zasobu z liczbami z BAL.resource (ekran wyboru bohatera). */
export function resourceDetails(kind: ResourceKind, alt = false): string[] {
  const R = BAL.resource;
  switch (kind) {
    case 'focus': return [
      `Maks. ${R.focus.max}. +1 za trafienie wroga dalej niż ${R.focus.range} (z bliska nic).`,
      `Każdy punkt: +${String(R.focus.crit * 100).replace('.', ',')}% szansy na krytyk (pełna: +${pc(R.focus.crit * R.focus.max)}).`,
      `Pełna: darmowa Salwa (Q), zostaje ${pc(R.focus.keep)}.`,
      `Oberwanie zabiera ${pc(R.focus.hurtLoss)} celności.`,
    ];
    case 'fury': return [
      `Maks. ${R.fury.max}. Rośnie od ciosów z bliska, obrywania i zabójstw obok.`,
      `W trakcie budowania: do +${pc(R.fury.might)} obrażeń i -${pc(R.fury.dr)} otrzymanych.`,
      `Pełna: Szał na ${R.fury.rage} s: +${pc(R.fury.rageMight)} obrażeń, +${pc(R.fury.rageAtk)} szybkości ataku, -${pc(R.fury.dr)} otrzymanych, leczenie ${pc(R.fury.rageLeech)} zadanych. Potem furia od zera.`,
      `Po ${R.fury.idle} s bez walki opada.`,
    ];
    case 'heat': return [
      `Maks. ${R.heat.max}. Q i E: +${R.heat.cast}, stygnie ${R.heat.decay} na sekundę.`,
      `Czary (Q, E, R) do +${pc(R.heat.spell)} obrażeń przy pełnym żarze.`,
      `Powyżej ${R.heat.burnFrom} (żółta kreska) tracisz ${pc(R.heat.burn)} maks. HP na sekundę.`,
      `Unik przy ${R.heat.ventMin}+ żaru: wybuch ognia tym silniejszy, im więcej żaru.`,
    ];
    case 'souls': return [
      `Maks. ${R.souls.max}. Wróg zabity w promieniu ${R.souls.range}: +1 (elita 3, boss 10).`,
      `Pełne: ${R.souls.auto} dusz zamienia się w ducha-sługę.`,
      `R zużywa wszystkie: +${pc(R.souls.ultDmg)} obrażeń wojowników za duszę, +1 wojownik za każde ${R.souls.ultExtra}.`,
      'Dusze zostają między poziomami.',
    ];
    case 'streak': return [
      `Maks. ${R.streak.max}. Każde trafienie: +1.`,
      `Pełne kombo: +${pc(R.streak.might)} obrażeń.`,
      `Egzekucja (E) zużywa całe: +${pc(R.streak.exec)} obrażeń ciosu za punkt.`,
      'Oberwanie zeruje kombo.',
    ];
    case 'faith': return [
      `Maks. ${R.faith.max}. Zabójstwo w pobliżu +1 (elita 3, boss 10), leczenie +${R.faith.heal} za 1% HP.`,
      `Pełna: Łaska (koszt ${R.faith.grace}): leczenie ${pc(R.faith.graceHeal)} HP, tarcza ${pc(R.faith.graceShield)} HP.`,
      `Sąd (R) zużywa całą: +${pc(R.faith.judgDmg)} obrażeń za punkt, +1 cel za każde ${R.faith.judgExtra}.`,
    ];
    case 'rhythm': return [
      `Max ${R.rhythm.max}. Every hit: +${dec(R.rhythm.hit)} (at most every ${dec(R.rhythm.gap)} s), a parry: +${R.parry.rhythm}.`,
      // Za punkt poniżej 1%: miejsca po przecinku (pc() zaokrąglałby 0,75% do 1%), w PL przecinek dziesiętny.
      `While it builds: +${dec(R.rhythm.atk * 100)}% attack speed per point (full bar: +${pc(R.rhythm.atk * R.rhythm.max)}). Getting hit does not lower it.`,
      `Full: Flow until you take damage: +${pc(R.rhythm.flowAtk)} attack speed, +${pc(R.rhythm.flowDmg)} damage, Thousand Cuts ready. A hit ends it and the bar drains to zero (${R.rhythm.drain} per second).`,
      // Mushin (alternatywny ultimate) nie zużywa Rytmu, tylko go od razu zapełnia.
      alt ? 'Mushin (R): fills Rhythm at once (Flow).'
        : `Iai (R): outside Flow spends it all (+${pc(R.rhythm.iai)} damage per point), in Flow deals x${R.rhythm.flowIai} and Flow goes on.`,
    ];
  }
}

export const HERO_BY_ID: Record<string, HeroDef> = Object.fromEntries(HEROES.map((h) => [h.id, h]));
