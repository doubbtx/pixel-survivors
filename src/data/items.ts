import { C } from '../core/palette';
import { rng } from '../core/rng';
import type { Stats } from '../entities/types';
import type { Run } from '../game/run';
import type { CardHooks } from './cards';
import { BAL } from './balance';
import { weaponStatsAt } from './weapons';
import { spawnMinion } from '../systems/minions';

/**
 * Przedmioty ekwipunku: 8 slotów, 5 stopni jakości, losowe afiksy zależne od poziomu przedmiotu
 * (item level = głębokość kampanii, więc przedmioty rosną bez sufitu) oraz rzadkie super-bonusy.
 *
 * Nowy typ przedmiotu = wpis w BASES; nowy afiks = wpis w AFFIXES; nowy super-bonus = wpis w SUPERS
 * (efekt przez flagi i hooki — ten sam mechanizm co karty, bez zmian w silniku).
 */
export type SlotId = 'weapon' | 'helmet' | 'armor' | 'gloves' | 'boots' | 'ring1' | 'ring2' | 'amulet';
export type ItemKind = 'weapon' | 'helmet' | 'armor' | 'gloves' | 'boots' | 'ring' | 'amulet';
export type Gender = 'm' | 'f' | 'pl';

export const SLOTS: { id: SlotId; kind: ItemKind; name: string }[] = [
  { id: 'weapon', kind: 'weapon', name: 'Broń' },
  { id: 'helmet', kind: 'helmet', name: 'Hełm' },
  { id: 'armor', kind: 'armor', name: 'Zbroja' },
  { id: 'gloves', kind: 'gloves', name: 'Rękawice' },
  { id: 'boots', kind: 'boots', name: 'Buty' },
  { id: 'ring1', kind: 'ring', name: 'Pierścień' },
  { id: 'ring2', kind: 'ring', name: 'Pierścień' },
  { id: 'amulet', kind: 'amulet', name: 'Amulet' },
];

// ============================ rzadkość ============================

export interface RarityDef {
  name: Record<Gender, string>;
  color: number;
  /** Liczba losowych afiksów. */
  affixes: number;
  /** Mnożnik wartości afiksów i bonusu bazowego. */
  power: number;
  /** Szansa na super-bonus. */
  superChance: number;
  /** Bazowa waga losowania. */
  weight: number;
}

export const RARITIES: RarityDef[] = [
  { name: { m: 'Zwykły', f: 'Zwykła', pl: 'Zwykłe' }, color: C.lgray, affixes: 1, power: 1, superChance: 0.01, weight: 60 },
  { name: { m: 'Magiczny', f: 'Magiczna', pl: 'Magiczne' }, color: C.blue, affixes: 2, power: 1.15, superChance: 0.03, weight: 28 },
  { name: { m: 'Rzadki', f: 'Rzadka', pl: 'Rzadkie' }, color: C.yellow, affixes: 3, power: 1.3, superChance: 0.08, weight: 9 },
  { name: { m: 'Epicki', f: 'Epicka', pl: 'Epickie' }, color: C.pink, affixes: 4, power: 1.5, superChance: 0.2, weight: 2.5 },
  { name: { m: 'Legendarny', f: 'Legendarna', pl: 'Legendarne' }, color: C.orange, affixes: 5, power: 1.8, superChance: 1, weight: 0.5 },
];

// ============================ typy bazowe ============================

export interface BaseDef {
  id: string;
  kind: ItemKind;
  name: string;
  gender: Gender;
  /** Ikona 16×16 (gfx/items.ts). */
  icon: string;
}

export const BASES: BaseDef[] = [
  { id: 'sword', kind: 'weapon', name: 'Miecz', gender: 'm', icon: 'it_sword' },
  { id: 'axe', kind: 'weapon', name: 'Topór', gender: 'm', icon: 'it_axe' },
  { id: 'staff', kind: 'weapon', name: 'Kostur', gender: 'm', icon: 'it_staff' },
  { id: 'dagger', kind: 'weapon', name: 'Sztylet', gender: 'm', icon: 'it_dagger' },
  { id: 'helm', kind: 'helmet', name: 'Hełm', gender: 'm', icon: 'it_helm' },
  { id: 'hood', kind: 'helmet', name: 'Kaptur', gender: 'm', icon: 'it_hood' },
  { id: 'crown', kind: 'helmet', name: 'Korona', gender: 'f', icon: 'it_crown' },
  { id: 'plate', kind: 'armor', name: 'Zbroja', gender: 'f', icon: 'it_plate' },
  { id: 'mail', kind: 'armor', name: 'Kolczuga', gender: 'f', icon: 'it_mail' },
  { id: 'robe', kind: 'armor', name: 'Szata', gender: 'f', icon: 'it_robe' },
  { id: 'gloves', kind: 'gloves', name: 'Rękawice', gender: 'pl', icon: 'it_gloves' },
  { id: 'bracers', kind: 'gloves', name: 'Karwasze', gender: 'pl', icon: 'it_bracers' },
  { id: 'boots', kind: 'boots', name: 'Buty', gender: 'pl', icon: 'it_boots' },
  { id: 'sandals', kind: 'boots', name: 'Sandały', gender: 'pl', icon: 'it_sandals' },
  { id: 'ring', kind: 'ring', name: 'Pierścień', gender: 'm', icon: 'it_ring' },
  { id: 'signet', kind: 'ring', name: 'Sygnet', gender: 'm', icon: 'it_signet' },
  { id: 'amulet', kind: 'amulet', name: 'Amulet', gender: 'm', icon: 'it_amulet' },
  { id: 'necklace', kind: 'amulet', name: 'Naszyjnik', gender: 'm', icon: 'it_necklace' },
  { id: 'talisman', kind: 'amulet', name: 'Talizman', gender: 'm', icon: 'it_talisman' },
  { id: 'mace', kind: 'weapon', name: 'Buzdygan', gender: 'm', icon: 'it_mace' },
  { id: 'wand', kind: 'weapon', name: 'Różdżka', gender: 'f', icon: 'it_wand' },
  { id: 'mask', kind: 'helmet', name: 'Maska', gender: 'f', icon: 'it_mask' },
  { id: 'cloak', kind: 'armor', name: 'Płaszcz', gender: 'm', icon: 'it_cloak' },
  { id: 'claws', kind: 'gloves', name: 'Szpony', gender: 'pl', icon: 'it_claws' },
  { id: 'greaves', kind: 'boots', name: 'Nagolenniki', gender: 'pl', icon: 'it_greaves' },
  { id: 'band', kind: 'ring', name: 'Obrączka', gender: 'f', icon: 'it_band' },
  { id: 'charm', kind: 'amulet', name: 'Wisior', gender: 'm', icon: 'it_charm' },
];

export const BASE_BY_ID: Record<string, BaseDef> = Object.fromEntries(BASES.map((b) => [b.id, b]));

/**
 * Bonus bazowy (implicit) typu przedmiotu. Broń mnoży obrażenia wykładniczo z poziomem
 * przedmiotu (`mul`), zbroja daje HP rosnące wykładniczo — to główne źródło skalowania postaci
 * względem głębokości kampanii.
 */
const IMPLICIT: Record<ItemKind, { stat: keyof Stats; mode: 'add' | 'mul'; value: (ilvl: number) => number }> = {
  weapon: { stat: 'might', mode: 'mul', value: (l) => 1 + 0.3 * BAL.itemScale(l) },
  helmet: { stat: 'armor', mode: 'add', value: (l) => 2 + 0.4 * (l - 1) },
  armor: { stat: 'maxHp', mode: 'add', value: (l) => 20 * BAL.itemHpScale(l) },
  gloves: { stat: 'crit', mode: 'add', value: () => 0.03 },
  boots: { stat: 'speedBonus', mode: 'add', value: () => 0.06 },
  ring: { stat: 'cdr', mode: 'add', value: () => 0.03 },
  amulet: { stat: 'growth', mode: 'add', value: () => 0.08 },
};

/** Rola typu przedmiotu (opis w ekwipunku). */
const KIND_ABOUT: Record<ItemKind, string> = {
  weapon: 'Broń mnoży obrażenia wszystkiego, co zadajesz. Mnożnik rośnie z poziomem przedmiotu: to najważniejszy slot.',
  helmet: 'Hełm daje pancerz: każdy punkt zmniejsza obrażenia od ciosów i pocisków (25 pancerza = o połowę).',
  armor: 'Zbroja daje maks. HP, które rośnie z poziomem przedmiotu.',
  gloves: 'Rękawice zwiększają szansę na krytyk.',
  boots: 'Buty przyspieszają ruch, łatwiej o uniki.',
  ring: 'Pierścień skraca odnowienie umiejętności. Masz dwa sloty na pierścienie.',
  amulet: 'Amulet daje więcej doświadczenia, więc szybsze awanse.',
};

/** Opis przedmiotu w ekwipunku: rola slotu, co daje rzadkość, gwiazdka, kowadło. */
export function itemAbout(it: Item): string[] {
  const base = BASE_BY_ID[it.base], R = RARITIES[it.rarity];
  const out = [KIND_ABOUT[base.kind]];
  if (!it.unique) out.push(`${R.name[base.gender]}: ${R.affixes} losowe bonusy (niebieskie), wartości x${R.power}.`);
  else out.push('Unikat: stały efekt specjalny, który zmienia zasady gry.');
  if (it.super) out.push('Gwiazdka: super-bonus (złoty), rzadki efekt specjalny.');
  out.push(`Kowadło ulepsza do +${BAL.anvil.maxUpgrades}. W nawiasie: twoja suma.`);
  return out;
}

// ============================ afiksy ============================

/** Jak afiks rośnie z poziomem przedmiotu: 'hp' i 'power' wykładniczo, 'mild' liniowo i łagodnie. */
type Scaling = 'hp' | 'mild' | 'none';

export interface AffixDef {
  stat: keyof Stats;
  min: number;
  max: number;
  scaling: Scaling;
  /** Format opisu: {v} = wartość. */
  label: string;
  pct: boolean;
  /** Przyrostek nazwy przedmiotu ("Miecz Siły"). */
  suffix: string;
  /** Tylko od tej rzadkości (indeks). */
  minRarity?: number;
}

export const AFFIXES: AffixDef[] = [
  { stat: 'might', min: 0.04, max: 0.09, scaling: 'mild', label: '+{v} obrażeń', pct: true, suffix: 'Siły' },
  { stat: 'maxHp', min: 8, max: 20, scaling: 'hp', label: '+{v} maks. HP', pct: false, suffix: 'Życia' },
  { stat: 'regen', min: 0.2, max: 0.5, scaling: 'hp', label: '+{v} HP na sekundę', pct: false, suffix: 'Odnowy' },
  { stat: 'armor', min: 1, max: 3, scaling: 'mild', label: '+{v} pancerza', pct: false, suffix: 'Obrony' },
  { stat: 'cdr', min: 0.02, max: 0.05, scaling: 'mild', label: '-{v} czasu odnowienia', pct: true, suffix: 'Pośpiechu' },
  { stat: 'area', min: 0.04, max: 0.08, scaling: 'mild', label: '+{v} wielkości ataków', pct: true, suffix: 'Zasięgu' },
  { stat: 'crit', min: 0.02, max: 0.04, scaling: 'mild', label: '+{v} szansy na krytyk', pct: true, suffix: 'Precyzji' },
  { stat: 'critMult', min: 0.1, max: 0.25, scaling: 'mild', label: '+{v} obrażeń krytycznych', pct: true, suffix: 'Rzezi' },
  { stat: 'lifesteal', min: 0.003, max: 0.008, scaling: 'none', label: '+{v} leczenia z obrażeń', pct: true, suffix: 'Wampira' },
  { stat: 'speedBonus', min: 0.03, max: 0.06, scaling: 'none', label: '+{v} szybkości', pct: true, suffix: 'Wiatru' },
  { stat: 'magnet', min: 0.1, max: 0.25, scaling: 'none', label: '+{v} zasięgu przyciągania', pct: true, suffix: 'Przyciągania' },
  { stat: 'duration', min: 0.04, max: 0.08, scaling: 'mild', label: '+{v} czasu działania', pct: true, suffix: 'Trwałości' },
  { stat: 'growth', min: 0.04, max: 0.08, scaling: 'none', label: '+{v} doświadczenia', pct: true, suffix: 'Mądrości' },
  { stat: 'greed', min: 0.05, max: 0.12, scaling: 'none', label: '+{v} złota', pct: true, suffix: 'Chciwości' },
  { stat: 'elemPower', min: 0.06, max: 0.14, scaling: 'none', label: '+{v} siły żywiołów', pct: true, suffix: 'Żywiołów' },
  { stat: 'atkSpeed', min: 0.03, max: 0.07, scaling: 'none', label: '+{v} szybkości ataku', pct: true, suffix: 'Furii' },
  { stat: 'amount', min: 1, max: 1, scaling: 'none', label: '+{v} pocisk dla każdej broni', pct: false, suffix: 'Mnogości', minRarity: 3 },
];

const AFFIX_BY_STAT = Object.fromEntries(AFFIXES.map((a) => [a.stat, a])) as Record<keyof Stats, AffixDef>;

// ============================ super-bonusy ============================

export interface SuperDef {
  id: string;
  name: string;
  /** Zakres wartości (przed mnożnikiem rzadkości). */
  min: number;
  max: number;
  /** Opis z wartością {v} (formatowaną jako procent, jeśli pct). */
  desc: string;
  pct: boolean;
  /** Flagi silnika ustawiane na wartość bonusu (lista flag w data/cards.ts; 'aegis' bierze najkrótszy czas). */
  flags?: string[];
  /** Hooki dostają wartość bonusu jako ostatni argument. */
  hooks?: CardHooks;
}

/** Szansa skalowana rzadkością, ale nigdy powyżej sensownego limitu. */
const chance = (v: number) => Math.min(0.5, v);

export const SUPERS: SuperDef[] = [
  {
    id: 'execute', name: 'Egzekucja', min: 0.001, max: 0.0015, pct: true,
    desc: '{v} szansy przy trafieniu na natychmiastowe zabicie (bossowie tracą 5% HP)',
    hooks: {
      onHit: (run, e, _d, _c, v) => {
        if (!rng.chance(chance(v))) return;
        run.damageEnemy(e, e.boss ? e.maxHp * 0.05 : e.hp + 1, 'Egzekucja');
        run.popText(e.x, e.y - 10, 'Egzekucja!', C.hotpink);
      },
    },
  },
  {
    id: 'echo', name: 'Echo ciosu', min: 0.02, max: 0.04, pct: true,
    desc: '{v} szansy, że trafienie powtórzy się z pełną siłą',
    hooks: { onHit: (run, e, dmg, _c, v) => { if (rng.chance(chance(v))) run.damageEnemy(e, dmg, 'Echo ciosu'); } },
  },
  {
    id: 'storm', name: 'Gniew burzy', min: 0.02, max: 0.04, pct: true,
    desc: '{v} szansy przy trafieniu na piorun skaczący do 3 wrogów',
    hooks: {
      onHit: (run, e, dmg, _c, v) => {
        if (!rng.chance(chance(v))) return;
        const hit = [e.uid];
        let from = e;
        for (let i = 0; i < 3; i++) {
          const t = run.nearestEnemy(from.x, from.y, 70, hit);
          if (!t) break;
          hit.push(t.uid);
          const f = run.addFx('line', from.x, from.y, C.cyan, 0.15);
          if (f) { f.x2 = t.x; f.y2 = t.y; }
          run.damageEnemy(t, dmg, 'Gniew burzy');
          from = t;
        }
      },
    },
  },
  {
    id: 'frost', name: 'Lodowy dotyk', min: 0.03, max: 0.06, pct: true,
    desc: '{v} szansy przy trafieniu na zamrożenie wroga na 2 s',
    hooks: { onHit: (_run, e, _d, _c, v) => { if (rng.chance(chance(v))) e.stunT = Math.max(e.stunT, 2); } },
  },
  {
    id: 'vampire', name: 'Pocałunek wampira', min: 0.01, max: 0.02, pct: true,
    desc: '{v} szansy przy trafieniu na uleczenie 5% HP',
    hooks: { onHit: (run, _e, _d, _c, v) => { if (rng.chance(chance(v))) run.heal(run.stats.maxHp * 0.05); } },
  },
  {
    id: 'pyre', name: 'Ognista dusza', min: 0.05, max: 0.1, pct: true,
    desc: '{v} szansy, że zabity wróg wybuchnie (50% jego maks. HP)',
    hooks: { onKill: (run, e, v) => { if (!e.boss && rng.chance(chance(v))) run.queueExplosion(e.x, e.y, 20, e.maxHp * 0.5, 'Ognista dusza', C.orange); } },
  },
  {
    id: 'midas', name: 'Dotyk Midasa', min: 0.01, max: 0.02, pct: true,
    desc: '{v} szansy, że zabity wróg upuści 10 monet',
    hooks: { onKill: (run, e, v) => { if (rng.chance(chance(v))) for (let i = 0; i < 10; i++) run.spawnPickup(e.x + rng.range(-8, 8), e.y + rng.range(-8, 8), 'coin', 1); } },
  },
  {
    id: 'vortex', name: 'Wir przyciągania', min: 30, max: 20, pct: false,
    desc: 'Co {v} s wszystkie kryształy XP lecą do ciebie',
    hooks: {
      onTick: (run, dt, v) => {
        const t = (run.cardState.vortex ?? 0) + dt;
        run.cardState.vortex = t >= v ? 0 : t;
        if (t >= v) for (const g of run.gems.items) g.flying = true;
      },
    },
  },
  {
    id: 'aegis', name: 'Tarcza bogów', min: 20, max: 12, pct: false, flags: ['aegis'],
    desc: 'Co {v} s pierwsze trafienie w ciebie jest całkowicie blokowane',
  },
  {
    id: 'rage', name: 'Szał', min: 0.5, max: 0.8, pct: true, flags: ['rage'],
    desc: '+{v} obrażeń przy prawie zerowym HP (rośnie z brakującym HP)',
  },
  {
    id: 'phoenix', name: 'Popiół feniksa', min: 1, max: 1, pct: false, flags: ['revive'],
    desc: 'Raz na poziom odradzasz się po śmierci',
  },
  // Żywioły (etap B): podpalenie krytykami, lód, siła reakcji, porażenie, zaraza.
  {
    id: 'ignite', name: 'Płomienne krytyki', min: 0.3, max: 0.5, pct: true,
    desc: '{v} szansy, że trafienie krytyczne podpali wroga',
    hooks: { onHit: (run, e, dmg, crit, v) => { if (crit && rng.chance(chance(v))) run.applyElement(e, 'fire', dmg); } },
  },
  {
    id: 'frostbite', name: 'Mroźny oddech', min: 0.05, max: 0.1, pct: true,
    desc: '{v} szansy przy trafieniu na nałożenie lodu',
    flags: ['elemChance.ice'],
  },
  {
    id: 'conductor', name: 'Przewodnik', min: 0.3, max: 0.6, pct: true, flags: ['reactPower'],
    desc: 'Reakcje żywiołów silniejsze o {v}',
  },
  {
    id: 'thunder', name: 'Burzowe serce', min: 0.1, max: 0.2, pct: true, flags: ['shockBonus'],
    desc: 'Porażeni wrogowie dostają dodatkowo {v} obrażeń',
  },
  {
    id: 'plague', name: 'Zaraza', min: 0.05, max: 0.1, pct: true,
    desc: '{v} szansy przy trafieniu na zatrucie wroga',
    flags: ['elemChance.poison'],
  },
  {
    id: 'fortune', name: 'Fortuna', min: 0.3, max: 0.6, pct: true, flags: ['itemLuck'],
    desc: '+{v} szansy na lepszą jakość przedmiotów',
  },
];

export const SUPER_BY_ID: Record<string, SuperDef> = Object.fromEntries(SUPERS.map((s) => [s.id, s]));

// ============================ unikaty ============================

/**
 * Unikaty (jak w PoE): stała nazwa i typ, moc Legendarnego, stałe afiksy (najwyższy rzut) i efekt łamiący zasady
 * z ceną. Efekt przez `stats`/`mul` (liczone z ekwipunkiem), `flags` i `hooks` (jak karty; hook dostaje 1 jako ostatni argument).
 * Wypadają rzadko z bossów i elit (BAL.uniques), nie da się ich przekuć ani dać im super-bonusu. Odkryte trafiają do kolekcji.
 */
export interface UniqueDef {
  id: string;
  name: string;
  base: string;
  desc: string;
  affixes: (keyof Stats)[];
  stats?: Partial<Stats>;
  mul?: Partial<Stats>;
  flags?: Record<string, number>;
  hooks?: CardHooks;
}

/** Kolor unikatów (nazwa, ramka, poświata). */
export const UNIQUE_COLOR = C.tan;

export const UNIQUES: UniqueDef[] = [
  {
    id: 'u_blinders', name: 'Klapki Berserkera', base: 'mask', affixes: ['might', 'atkSpeed'], flags: { facing: 1.5 },
    desc: 'Bronie kierunkowe (pociski, bumerang, promień, cięcie) celują tylko w kierunku ruchu, ale zadają 2.5x obrażeń.',
  },
  {
    id: 'u_bulwark', name: 'Zbroja Wiecznej Warty', base: 'plate', affixes: ['maxHp', 'armor'], flags: { healShield: 0.6 },
    desc: 'Leczenie nie przywraca HP: zamienia się w tarczę (do 60% maks. HP).',
  },
  {
    id: 'u_stormstep', name: 'Buty Burzy Strzał', base: 'boots', affixes: ['speedBonus', 'amount'],
    desc: 'Unik wystrzeliwuje pierścień 12 pocisków (60% obrażeń broni podstawowej).',
    hooks: {
      onDash: (run) => {
        const w = run.weapons[0], p = run.player;
        if (!w) return;
        const dmg = weaponStatsAt(w.def, w.level).damage * run.stats.might * 0.6;
        for (let i = 0; i < 12; i++) run.spawnProjectile({ x: p.x, y: p.y, angle: (i / 12) * Math.PI * 2, speed: 200, damage: dmg, src: 'Burza strzał', sprite: w.def.proj ?? 'bolt', pierce: 1, life: 0.7 });
      },
    },
  },
  {
    id: 'u_prism', name: 'Pryzmat Żywiołów', base: 'band', affixes: ['elemPower', 'crit'],
    desc: 'Co 10. trafienie nakłada na cel dwa różne żywioły naraz (reakcja).',
    hooks: {
      onHit: (run, e, dmg) => {
        const n = (run.cardState.prism = (run.cardState.prism ?? 0) + 1);
        if (n % 10 || e.dead) return;
        const els = ['fire', 'ice', 'lightning', 'poison'] as const;
        const a = rng.int(0, 3), b = (a + rng.int(1, 3)) % 4;
        run.applyElement(e, els[a], dmg);
        run.applyElement(e, els[b], dmg);
      },
    },
  },
  {
    id: 'u_glass', name: 'Szklane Serce', base: 'talisman', affixes: ['critMult', 'growth'], mul: { might: 1.6 }, flags: { dmgTaken: -0.5 },
    desc: 'Obrażenia x1.6, ale otrzymujesz 50% więcej obrażeń.',
  },
  {
    id: 'u_nightclaw', name: 'Szpony Nocy', base: 'claws', affixes: ['lifesteal', 'crit'], stats: { lifesteal: 0.01 }, mul: { lifesteal: 3, regen: 0 },
    desc: 'Leczenie z obrażeń x3, ale regeneracja HP nie działa.',
  },
  {
    id: 'u_reaper', name: 'Kosa Żniwiarza', base: 'axe', affixes: ['might', 'duration'], flags: { minionDmg: 0.5 },
    desc: 'Co 30. zabójstwo przywołuje ducha-sługę. Sługi zadają +50% obrażeń.',
    hooks: {
      onKill: (run, e) => {
        const n = (run.cardState.reaper = (run.cardState.reaper ?? 0) + 1);
        if (n % 30 === 0) spawnMinion(run, e.x, e.y, run.cardDamage(BAL.minions.passiveDmg), BAL.minions.passiveLife, false, 'Kosa Żniwiarza');
      },
    },
  },
  {
    id: 'u_chronos', name: 'Sygnet Chronosa', base: 'signet', affixes: ['cdr', 'duration'], stats: { cdr: 0.4 }, flags: { ultGain: -0.35 },
    desc: 'Umiejętności odnawiają się 40% szybciej, ale ultimate ładuje się 35% wolniej.',
  },
  {
    id: 'u_hunter', name: 'Płaszcz Łowcy Głów', base: 'cloak', affixes: ['maxHp', 'critMult'], flags: { bossDmg: 0.6, eliteRate: 0.3 },
    desc: '+60% obrażeń przeciw elitom i bossom, ale elity pojawiają się 30% częściej.',
  },
  {
    id: 'u_midas', name: 'Wisior Midasa', base: 'charm', affixes: ['greed', 'magnet'], mul: { greed: 2 }, flags: { enemyHp: 0.2 },
    desc: 'Złoto x2, ale wrogowie mają 20% więcej HP.',
  },
];

export const UNIQUE_BY_ID: Record<string, UniqueDef> = Object.fromEntries(UNIQUES.map((u) => [u.id, u]));

// ============================ przedmiot ============================

export interface Item {
  base: string;
  rarity: number;
  ilvl: number;
  name: string;
  /** `up` = suma przyrostów z ulepszeń w kowadle (ułamek wartości z łupu; brak = 0). */
  implicit: { stat: keyof Stats; mode: 'add' | 'mul'; value: number; up?: number };
  affixes: { stat: keyof Stats; value: number; up?: number }[];
  super?: { id: string; value: number };
  /** Ulepszenia w kowadle (do BAL.anvil.maxUpgrades). */
  upg?: number;
  /** Złoto i odłamki wydane na przedmiot w kowadle (część wraca przy rozkładaniu). */
  spent?: { gold: number; shards: number };
  /** Nowy w plecaku (znaczek „!” do pierwszego zamknięcia ekwipunku). */
  fresh?: boolean;
  /** Unikat: id z UNIQUES (stała nazwa, afiksy i efekt). */
  unique?: string;
  /**
   * Kuźnia (data/forge.ts): pęknięty (wartości x BAL.forge.crackMul do naprawy, bez kucia), najwyższy osiągnięty poziom
   * (progi +3 i +12 dają nagrodę raz) i litość (+szansa po porażkach, zerowana po sukcesie).
   */
  cracked?: boolean;
  peak?: number;
  pity?: number;
}

/** Źródło przedmiotu; 'shop' = oferta sklepu między poziomami. */
export type LootSource = 'drop' | 'elite' | 'boss' | 'shop';

const ADJ: Record<Gender, string>[] = [
  { m: 'Starożytny', f: 'Starożytna', pl: 'Starożytne' },
  { m: 'Mroczny', f: 'Mroczna', pl: 'Mroczne' },
  { m: 'Lśniący', f: 'Lśniąca', pl: 'Lśniące' },
  { m: 'Runiczny', f: 'Runiczna', pl: 'Runiczne' },
  { m: 'Królewski', f: 'Królewska', pl: 'Królewskie' },
  { m: 'Krwawy', f: 'Krwawa', pl: 'Krwawe' },
];
const LEGEND = ['Feniksa', 'Pustki', 'Tytana', 'Burzy', 'Zmierzchu', 'Smoka'];

function affixScale(a: AffixDef, ilvl: number): number {
  if (a.scaling === 'hp') return BAL.itemHpScale(ilvl);
  if (a.scaling === 'mild') return 1 + 0.06 * (ilvl - 1);
  return 1;
}

/** Wartość afiksu; `rolls` > 1 = najlepszy z kilku rzutów (ulepszone kowadło). */
function affixValue(a: AffixDef, ilvl: number, power: number, rolls = 1): number {
  let roll = rng.range(a.min, a.max);
  for (let k = 1; k < rolls; k++) roll = Math.max(roll, rng.range(a.min, a.max));
  return roll * (a.stat === 'amount' ? 1 : power) * affixScale(a, ilvl);
}

/** Bonus bazowy z łupu × (1 + `up`) — dla mnożnika rośnie tylko nadwyżka ponad 1. */
function implicitValue(kind: ItemKind, ilvl: number, power: number, up = 0): number {
  const imp = IMPLICIT[kind];
  return imp.mode === 'mul' ? 1 + (imp.value(ilvl) - 1) * power * (1 + up) : imp.value(ilvl) * power * (1 + up);
}

/** Przyrost nowego afiksu na przedmiocie już ulepszanym (średni przyrost × liczba ulepszeń). */
const upOf = (it: Item) => (it.upg ?? 0) * (BAL.anvil.upgradeMin + BAL.anvil.upgradeMax) / 2;

/** Losowy afiks, którego przedmiot jeszcze nie ma (z dodatkowym filtrem, np. tag synergii). */
function newAffix(it: Item, filter: (a: AffixDef) => boolean = () => true): AffixDef | null {
  const pool = AFFIXES.filter((a) => (a.minRarity ?? 0) <= it.rarity && !it.affixes.some((x) => x.stat === a.stat) && filter(a));
  return pool.length ? rng.pick(pool) : null;
}

function rollSuper(rarity: number): NonNullable<Item['super']> {
  const s = rng.pick(SUPERS);
  // Dla bonusów "co X s" mniejsza wartość jest lepsza, więc min > max — interpolacja działa tak samo.
  const t = Math.min(1, rng.next() * (0.6 + 0.1 * rarity));
  const v = s.min + (s.max - s.min) * t;
  return { id: s.id, value: s.pct ? v * (1 + 0.25 * Math.max(0, rarity - 2)) : v };
}

/** Losuje rzadkość: wyższe stopnie są częstsze na głębszych poziomach, z elit, bossów i sklepu oraz z Fortuną. */
export function rollRarity(depth: number, source: LootSource, luck: number): number {
  const L = BAL.loot;
  const boost = (1 + L.depth * (depth - 1)) * (1 + L.luck * luck) * (source === 'boss' ? L.boss : source === 'elite' ? L.elite : source === 'shop' ? BAL.shopItemBoost : 1);
  const weights = RARITIES.map((r, i) => (source === 'boss' && i < 1 ? 0 : r.weight * Math.pow(boost, i)));
  return rng.weighted(weights.map((w, i) => [i, w] as const));
}

/** Przedmiot z łupu; `forceRarity` = z góry ustalona rzadkość (szczęśliwy traf). */
export function rollItem(depth: number, source: LootSource, luck = 0, kind?: ItemKind, forceRarity?: number): Item {
  const pool = kind ? BASES.filter((b) => b.kind === kind) : BASES;
  const base = rng.pick(pool);
  const rarity = forceRarity ?? rollRarity(depth, source, luck);
  const R = RARITIES[rarity];
  const ilvl = depth + (source === 'boss' ? 1 : 0);
  const imp = IMPLICIT[base.kind];
  const it: Item = { base: base.id, rarity, ilvl, name: '', implicit: { stat: imp.stat, mode: imp.mode, value: implicitValue(base.kind, ilvl, R.power) }, affixes: [] };
  while (it.affixes.length < R.affixes) {
    const a = newAffix(it);
    if (!a) break;
    it.affixes.push({ stat: a.stat, value: affixValue(a, ilvl, R.power) });
  }
  if (rng.chance(R.superChance)) it.super = rollSuper(rarity);
  it.name = itemName(base, rarity, it.affixes, !!it.super);
  return it;
}

/** Unikat (losowy albo o podanym id) na poziomie głębokości + 1: moc Legendarnego, afiksy z najwyższym rzutem. */
export function rollUnique(depth: number, id?: string): Item {
  const def = id ? UNIQUE_BY_ID[id] : rng.pick(UNIQUES);
  const base = BASE_BY_ID[def.base], rarity = RARITIES.length - 1, R = RARITIES[rarity], ilvl = depth + 1;
  const imp = IMPLICIT[base.kind];
  return {
    base: base.id, rarity, ilvl, name: def.name, unique: def.id,
    implicit: { stat: imp.stat, mode: imp.mode, value: implicitValue(base.kind, ilvl, R.power) },
    affixes: def.affixes.map((stat) => {
      const a = AFFIX_BY_STAT[stat];
      return { stat, value: a.max * (stat === 'amount' ? 1 : R.power) * affixScale(a, ilvl) };
    }),
  };
}

/** Kolor przedmiotu: unikaty mają własny, reszta kolor rzadkości. */
export function itemColor(it: Item): number {
  return it.unique ? UNIQUE_COLOR : RARITIES[it.rarity].color;
}

/** Efekty założonych unikatów (flagi, hooki, statystyki) — liczone w Run jak super-bonusy. */
export function equippedUniques(run: Run): UniqueDef[] {
  const out: UniqueDef[] = [];
  for (const it of Object.values(run.equipment)) if (it?.unique && UNIQUE_BY_ID[it.unique]) out.push(UNIQUE_BY_ID[it.unique]);
  return out;
}

// ============================ kowadło (systems/anvil.ts) ============================

/**
 * Kowadło: ulepszenie (do BAL.anvil.maxUpgrades). Każda wartość rośnie o losowe upgradeMin..upgradeMax
 * swojej wartości z łupu — liniowo i nigdy w dół. False = limit ulepszeń.
 */
export function upgradeItem(it: Item): boolean {
  const n = it.upg ?? 0;
  if (n >= BAL.anvil.maxUpgrades) return false;
  const step = () => rng.range(BAL.anvil.upgradeMin, BAL.anvil.upgradeMax);
  const imp = it.implicit;
  imp.up = (imp.up ?? 0) + step();
  imp.value = implicitValue(BASE_BY_ID[it.base].kind, it.ilvl, RARITIES[it.rarity].power, imp.up);
  for (const a of it.affixes) {
    if (a.stat === 'amount') continue;
    const up = a.up ?? 0, next = up + step();
    a.value *= (1 + next) / (1 + up);
    a.up = next;
  }
  it.upg = n + 1;
  return true;
}

/** Kuźnia +3 (Hartowanie): nowy afiks ponad limit jakości. False = brak kandydatów. */
export function addForgeAffix(it: Item): boolean {
  const a = newAffix(it);
  if (!a) return false;
  const up = upOf(it);
  it.affixes.push({ stat: a.stat, value: affixValue(a, it.ilvl, RARITIES[it.rarity].power) * (1 + up), up });
  return true;
}

/** Kuźnia +12 (Runa mocy): super-bonus, a gdy już jest — o połowę mocniejszy (dla bonusów „co X s” krótszy odstęp). */
export function empowerSuper(it: Item): void {
  if (!it.super) { it.super = rollSuper(it.rarity); return; }
  const def = SUPER_BY_ID[it.super.id];
  it.super.value = def.min > def.max ? it.super.value / 1.5 : it.super.value * 1.5;
}

/** Kuźnia: spadek o poziom — każda wartość traci średni przyrost jednego ulepszenia. */
export function downgradeItem(it: Item): void {
  const n = it.upg ?? 0;
  if (n <= 0) return;
  const avg = (BAL.anvil.upgradeMin + BAL.anvil.upgradeMax) / 2;
  const imp = it.implicit;
  imp.up = Math.max(0, (imp.up ?? 0) - avg);
  imp.value = implicitValue(BASE_BY_ID[it.base].kind, it.ilvl, RARITIES[it.rarity].power, imp.up);
  for (const a of it.affixes) {
    if (a.stat === 'amount') continue;
    const up = a.up ?? 0, next = Math.max(0, up - avg);
    a.value *= (1 + next) / (1 + up);
    a.up = next;
  }
  it.upg = n - 1;
}

/** Mnożnik wartości z kuźni: pęknięcie osłabia, +15 (Boski) wzmacnia. */
export function forgeMul(it: Item): number {
  return ((it.upg ?? 0) >= 15 ? BAL.forge.divineMul : 1) * (it.cracked ? BAL.forge.crackMul : 1);
}

/** Bonus bazowy po kuźni (+6: Blask x BAL.forge.glowMul; mnożnik broni rośnie tylko ponad 1). */
export function implicitOf(it: Item): number {
  const k = forgeMul(it) * ((it.upg ?? 0) >= 6 ? BAL.forge.glowMul : 1), v = it.implicit.value;
  return it.implicit.mode === 'mul' ? 1 + (v - 1) * k : v * k;
}

/** Kowadło: nowy losowy afiks w miejsce afiksu `idx`. False = brak kandydatów. */
export function rerollAffix(it: Item, idx: number, rolls = 1): boolean {
  const old = it.affixes[idx];
  if (!old) return false;
  const rest = { ...it, affixes: it.affixes.filter((_, i) => i !== idx) };
  const a = newAffix(rest, (x) => x.stat !== old.stat);
  if (!a) return false;
  const up = upOf(it);
  it.affixes[idx] = { stat: a.stat, value: affixValue(a, it.ilvl, RARITIES[it.rarity].power, rolls) * (1 + up), up };
  return true;
}

/** Kowadło: wyższa jakość — mocniejsze wartości, nowy afiks, Legendarny zawsze z super-bonusem. */
export function raiseRarity(it: Item, rolls = 1, superBonus = 0): boolean {
  if (it.rarity >= RARITIES.length - 1) return false;
  const from = RARITIES[it.rarity].power, R = RARITIES[++it.rarity];
  for (const a of it.affixes) if (a.stat !== 'amount') a.value *= R.power / from;
  const base = BASE_BY_ID[it.base];
  it.implicit.value = implicitValue(base.kind, it.ilvl, R.power, it.implicit.up);
  while (it.affixes.length < R.affixes) {
    const a = newAffix(it);
    if (!a) break;
    const up = upOf(it);
    it.affixes.push({ stat: a.stat, value: affixValue(a, it.ilvl, R.power, rolls) * (1 + up), up });
  }
  if (!it.super && rng.chance(R.superChance + superBonus)) it.super = rollSuper(it.rarity);
  it.name = itemName(base, it.rarity, it.affixes, !!it.super);
  return true;
}

function itemName(base: BaseDef, rarity: number, affixes: Item['affixes'], hasSuper: boolean): string {
  const suffix = affixes.length ? AFFIX_BY_STAT[affixes[0].stat].suffix : '';
  if (rarity === 0) return base.name;
  if (rarity === 1) return `${base.name} ${suffix}`;
  const adj = rng.pick(ADJ)[base.gender];
  if (rarity === 4 || hasSuper) return `${adj} ${base.name} ${rng.pick(LEGEND)}`;
  return `${adj} ${base.name} ${suffix}`;
}

/** Złoto za rozłożenie przedmiotu. */
export function salvageValue(it: Item): number {
  return Math.round(4 * (it.rarity + 1) ** 2 * (1 + 0.5 * (it.ilvl - 1)));
}

/** Odłamki (waluta kowadła) za rozłożenie przedmiotu — zależą od jakości, plus zwrot części wydanych w kowadle. */
export function salvageShards(it: Item): number {
  return (BAL.anvil.shardsByRarity[it.rarity] ?? 1) + Math.floor((it.spent?.shards ?? 0) * BAL.anvil.salvageRefund);
}

/** Złoto za rozłożenie: wartość przedmiotu × chciwość + zwrot części złota wydanego w kowadle. */
export function salvageGold(it: Item, greed: number): number {
  return Math.round(salvageValue(it) * greed + (it.spent?.gold ?? 0) * BAL.anvil.salvageRefund);
}

export function slotKind(slot: SlotId): ItemKind {
  return SLOTS.find((s) => s.id === slot)!.kind;
}

// ============================ opisy i porównania ============================

function fmtVal(v: number, pct: boolean): string {
  if (pct) {
    const p = v * 100;
    return `${p < 1 ? p.toFixed(2) : p < 10 ? p.toFixed(1) : Math.round(p)}%`;
  }
  return v < 10 && v % 1 !== 0 ? v.toFixed(1) : String(Math.round(v));
}

const STAT_LABEL: Partial<Record<keyof Stats, { label: string; pct: boolean }>> = Object.fromEntries(
  AFFIXES.map((a) => [a.stat, { label: a.label, pct: a.pct }]),
);

export function statLine(stat: keyof Stats, value: number): string {
  const d = STAT_LABEL[stat];
  return d ? d.label.replace('{v}', fmtVal(value, d.pct)) : `${stat} ${value}`;
}

/** Jak pokazać sumę statystyki gracza (w nawiasie przy bonusie). */
const TOTAL_FMT: Partial<Record<keyof Stats, 'mul' | 'pct' | 'flat'>> = {
  might: 'mul', area: 'mul', duration: 'mul', projSpeed: 'mul', magnet: 'mul', growth: 'mul', greed: 'mul', critMult: 'mul',
  crit: 'pct', cdr: 'pct', lifesteal: 'pct', speedBonus: 'pct', atkSpeed: 'pct', elemPower: 'pct',
};

/** Suma statystyki gracza do pokazania przy bonusie przedmiotu, np. "razem x1.45" albo "razem 25%". */
export function statTotal(stat: keyof Stats, s: Stats): string {
  const v = s[stat], f = TOTAL_FMT[stat] ?? 'flat';
  if (f === 'mul') return `razem x${v.toFixed(2)}`;
  if (f === 'pct') return `razem ${Math.round(v * 100)}%`;
  return `razem ${v < 10 && v % 1 !== 0 ? v.toFixed(1) : Math.round(v)}`;
}

export function implicitLine(it: Item): string {
  const i = it.implicit;
  return i.mode === 'mul' ? `Obrażenia x${implicitOf(it).toFixed(2)}` : statLine(i.stat, implicitOf(it));
}

export function superLine(it: Item): string {
  if (!it.super) return '';
  const s = SUPER_BY_ID[it.super.id];
  return `${s.name}: ${s.desc.replace('{v}', fmtVal(it.super.value, s.pct))}`;
}

/** Suma statystyk przedmiotu (addytywne) — do porównań. Bonus mnożący broni liczony jest osobno. */
export function itemStats(it: Item | null): Partial<Record<keyof Stats, number>> {
  const out: Partial<Record<keyof Stats, number>> = {};
  if (!it) return out;
  if (it.implicit.mode === 'add') out[it.implicit.stat] = implicitOf(it);
  const k = forgeMul(it);
  for (const a of it.affixes) out[a.stat] = (out[a.stat] ?? 0) + a.value * (a.stat === 'amount' ? 1 : k);
  return out;
}

/** Różnice statystyk nowego przedmiotu względem założonego: [opis, czy lepiej]. */
export function compareItems(next: Item, cur: Item | null): { text: string; better: boolean }[] {
  const a = itemStats(next), b = itemStats(cur);
  const keys = new Set([...Object.keys(a), ...Object.keys(b)] as (keyof Stats)[]);
  const out: { text: string; better: boolean }[] = [];
  for (const k of keys) {
    const d = (a[k] ?? 0) - (b[k] ?? 0);
    if (Math.abs(d) < 1e-6) continue;
    const line = statLine(k, Math.abs(d));
    out.push({ text: (d > 0 ? line : line.replace(/^[+-]/, '-')), better: d > 0 });
  }
  const ma = next.implicit.mode === 'mul' ? implicitOf(next) : 1;
  const mb = cur?.implicit.mode === 'mul' ? implicitOf(cur) : 1;
  if (Math.abs(ma - mb) > 1e-6) out.unshift({ text: `Obrażenia x${(ma / mb).toFixed(2)}`, better: ma > mb });
  return out;
}

/** Wpływ super-bonusów założonych przedmiotów na Run: flagi i hooki (jak karty). */
export function equippedSupers(run: Run): { def: SuperDef; value: number }[] {
  const out: { def: SuperDef; value: number }[] = [];
  for (const it of Object.values(run.equipment)) if (it?.super) out.push({ def: SUPER_BY_ID[it.super.id], value: it.super.value });
  return out;
}
