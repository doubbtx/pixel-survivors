import { C } from '../core/palette';

/**
 * Definicje broni. Nowa broń = nowy wpis tutaj (+ ewentualnie nowy `kind` w systems/weapons.ts,
 * jeśli potrzebny zupełnie nowy wzorzec ataku).
 *
 * Znaczenie pól WeaponStats zależy od wzorca — opis przy każdym `kind`:
 *  bolt      pociski w najbliższych wrogów; amount = liczba pocisków, pierce = przebicia
 *  orbit     ostrza krążące wokół gracza; cooldown = odstęp trafień tego samego wroga, speed = rad/s
 *  aura      pole wokół gracza; cooldown = odstęp ticków, area × 26 px = promień
 *  chain     piorun skaczący między wrogami; pierce = liczba skoków, area × 55 px = zasięg skoku
 *  meteor    uderzenia w losowych wrogów; duration = opóźnienie upadku, area × 20 px = promień
 *  boomerang leci i wraca; duration = czas lotu w jedną stronę
 *  laser     promień; damage na tick (0.1 s), duration = czas świecenia, area × 3 px = szerokość
 *  mines     miny przy graczu; duration = czas życia miny, area × 22 px = promień wybuchu
 *  cleave    cięcie łukiem przed graczem; area × 26 px = zasięg, amount = liczba cięć
 */
export type WeaponKind = 'bolt' | 'orbit' | 'aura' | 'chain' | 'meteor' | 'boomerang' | 'laser' | 'mines' | 'cleave';

export interface WeaponStats {
  damage: number;
  cooldown: number;
  amount: number;
  speed: number;
  area: number;
  duration: number;
  pierce: number;
  knock: number;
}

export interface WeaponDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  kind: WeaponKind;
  color: number;
  /** Sprite pocisku (dla wzorców z pociskami). */
  proj?: string;
  base: WeaponStats;
  /** Przyrosty na kolejnych poziomach: levels[0] = poziom 2 itd. maxLevel = levels.length + 1. */
  levels: Partial<WeaponStats>[];
  evolve?: { passive: string; into: string };
  evolved?: boolean;
  /** Broń dostępna tylko dla tego bohatera. */
  hero?: string;
}

const S = (o: Partial<WeaponStats>): WeaponStats => ({
  damage: 0, cooldown: 1, amount: 1, speed: 0, area: 1, duration: 1, pierce: 0, knock: 1, ...o,
});

export const WEAPONS: WeaponDef[] = [
  {
    id: 'bolt', name: 'Magiczny pocisk', desc: 'Strzela w najbliższego wroga.', icon: 'ic_bolt', kind: 'bolt', color: C.blue, proj: 'bolt',
    base: S({ damage: 10, cooldown: 1.1, speed: 170, duration: 1.6, pierce: 1 }),
    levels: [{ amount: 1 }, { damage: 5 }, { cooldown: -0.15 }, { amount: 1 }, { damage: 5, pierce: 1 }, { amount: 1 }, { damage: 10 }],
    evolve: { passive: 'might', into: 'bolt_evo' },
  },
  {
    id: 'bolt_evo', name: 'Gwiezdny grad', desc: 'Grad gwiazd przebijających wrogów.', icon: 'ic_bolt_evo', kind: 'bolt', color: C.yellow, proj: 'star',
    base: S({ damage: 28, cooldown: 0.5, amount: 5, speed: 220, area: 1.2, duration: 2, pierce: 3, knock: 1.5 }),
    levels: [], evolved: true,
  },
  {
    id: 'arrow', name: 'Strzała', desc: 'Szybkie strzały przebijające wrogów.', icon: 'ic_arrow', kind: 'bolt', color: C.peach, proj: 'arrow', hero: 'kestra',
    base: S({ damage: 12, cooldown: 0.7, speed: 230, duration: 1.2, pierce: 2 }),
    levels: [{ damage: 4 }, { amount: 1 }, { cooldown: -0.1 }, { pierce: 1, damage: 4 }, { amount: 1 }, { cooldown: -0.1 }, { damage: 10, amount: 1 }],
    evolve: { passive: 'wings', into: 'arrow_evo' },
  },
  {
    id: 'arrow_evo', name: 'Wichrowy łuk', desc: 'Nawałnica strzał niesiona wiatrem.', icon: 'ic_arrow_evo', kind: 'bolt', color: C.white, proj: 'arrow', hero: 'kestra',
    base: S({ damage: 30, cooldown: 0.42, amount: 4, speed: 300, duration: 1.4, pierce: 6, knock: 1.5 }),
    levels: [], evolved: true,
  },
  {
    id: 'orbit', name: 'Ostrza orbity', desc: 'Ostrza krążą wokół ciebie.', icon: 'ic_orbit', kind: 'orbit', color: C.lgray, proj: 'blade',
    base: S({ damage: 8, cooldown: 0.3, amount: 2, speed: 3, knock: 2 }),
    levels: [{ amount: 1 }, { damage: 4 }, { area: 0.2 }, { amount: 1 }, { damage: 4, speed: 0.5 }, { amount: 1 }, { damage: 8 }],
    evolve: { passive: 'hourglass', into: 'orbit_evo' },
  },
  {
    id: 'orbit_evo', name: 'Pierścień Saturna', desc: 'Gęsty pierścień tnących ostrzy.', icon: 'ic_orbit_evo', kind: 'orbit', color: C.yellow, proj: 'blade',
    base: S({ damage: 22, cooldown: 0.25, amount: 8, speed: 4, area: 1.6, knock: 3 }),
    levels: [], evolved: true,
  },
  {
    id: 'aura', name: 'Święta aura', desc: 'Rani i spowalnia wrogów wokół ciebie.', icon: 'ic_aura', kind: 'aura', color: C.yellow,
    base: S({ damage: 5, cooldown: 0.5, amount: 0, knock: 0.5 }),
    levels: [{ area: 0.15 }, { damage: 3 }, { cooldown: -0.05 }, { area: 0.15 }, { damage: 4 }, { area: 0.15 }, { damage: 6 }],
    evolve: { passive: 'armor', into: 'aura_evo' },
  },
  {
    id: 'aura_evo', name: 'Cytadela', desc: 'Potężna aura odpychająca wrogów.', icon: 'ic_aura_evo', kind: 'aura', color: C.orange,
    base: S({ damage: 16, cooldown: 0.35, amount: 0, area: 2.2, knock: 1.5 }),
    levels: [], evolved: true,
  },
  {
    id: 'chain', name: 'Piorun łańcuchowy', desc: 'Błyskawica skacze między wrogami.', icon: 'ic_chain', kind: 'chain', color: C.yellow,
    base: S({ damage: 14, cooldown: 1.6, pierce: 3, knock: 0 }),
    levels: [{ pierce: 1 }, { damage: 6 }, { amount: 1 }, { cooldown: -0.2 }, { pierce: 2 }, { damage: 8 }, { amount: 1 }],
    evolve: { passive: 'clock', into: 'chain_evo' },
  },
  {
    id: 'chain_evo', name: 'Burza', desc: 'Nieustanna burza błyskawic.', icon: 'ic_chain_evo', kind: 'chain', color: C.blue,
    base: S({ damage: 35, cooldown: 0.8, amount: 3, area: 1.4, pierce: 8, knock: 0 }),
    levels: [], evolved: true,
  },
  {
    id: 'meteor', name: 'Meteor', desc: 'Z nieba spadają płonące skały.', icon: 'ic_meteor', kind: 'meteor', color: C.orange,
    base: S({ damage: 30, cooldown: 2.6, duration: 0.7, knock: 3 }),
    levels: [{ amount: 1 }, { damage: 12 }, { area: 0.2 }, { cooldown: -0.3 }, { amount: 1 }, { damage: 15 }, { area: 0.25, amount: 1 }],
    evolve: { passive: 'lens', into: 'meteor_evo' },
  },
  {
    id: 'meteor_evo', name: 'Apokalipsa', desc: 'Deszcz meteorów pustoszy pole bitwy.', icon: 'ic_meteor_evo', kind: 'meteor', color: C.red,
    base: S({ damage: 80, cooldown: 1.4, amount: 5, area: 1.8, duration: 0.6, knock: 4 }),
    levels: [], evolved: true,
  },
  {
    id: 'boomerang', name: 'Bumerang', desc: 'Leci przed siebie i wraca.', icon: 'ic_boomerang', kind: 'boomerang', color: C.orange, proj: 'boom',
    base: S({ damage: 15, cooldown: 1.5, speed: 200, duration: 0.7, pierce: 999, knock: 2 }),
    levels: [{ damage: 5 }, { amount: 1 }, { speed: 30 }, { damage: 8 }, { amount: 1 }, { cooldown: -0.2 }, { damage: 12 }],
    evolve: { passive: 'dup', into: 'boomer_evo' },
  },
  {
    id: 'boomer_evo', name: 'Wir ostrzy', desc: 'Wirujące bumerangi tną wszystko.', icon: 'ic_boomer_evo', kind: 'boomerang', color: C.yellow, proj: 'boom',
    base: S({ damage: 40, cooldown: 0.9, amount: 4, speed: 260, duration: 0.8, pierce: 999, knock: 3 }),
    levels: [], evolved: true,
  },
  {
    id: 'laser', name: 'Promień', desc: 'Przeszywa wszystkich wrogów w linii.', icon: 'ic_laser', kind: 'laser', color: C.pink,
    base: S({ damage: 6, cooldown: 2.4, duration: 0.5, knock: 0 }),
    levels: [{ damage: 2 }, { duration: 0.15 }, { amount: 1 }, { cooldown: -0.3 }, { damage: 3 }, { area: 0.4 }, { amount: 1 }],
    evolve: { passive: 'crit', into: 'laser_evo' },
  },
  {
    id: 'laser_evo', name: 'Pryzmat', desc: 'Wachlarz promieni o ogromnej mocy.', icon: 'ic_laser_evo', kind: 'laser', color: C.white,
    base: S({ damage: 16, cooldown: 1.2, amount: 4, area: 1.8, duration: 0.8, knock: 0 }),
    levels: [], evolved: true,
  },
  {
    id: 'mines', name: 'Miny', desc: 'Zostawiasz miny wybuchające przy wrogach.', icon: 'ic_mines', kind: 'mines', color: C.red, proj: 'mine',
    base: S({ damage: 35, cooldown: 2.0, duration: 7, knock: 4 }),
    levels: [{ amount: 1 }, { damage: 12 }, { cooldown: -0.3 }, { area: 0.25 }, { amount: 1 }, { damage: 18 }, { amount: 1 }],
    evolve: { passive: 'heart', into: 'mines_evo' },
  },
  {
    id: 'mines_evo', name: 'Serce wulkanu', desc: 'Pola min wybuchające lawą.', icon: 'ic_mines_evo', kind: 'mines', color: C.orange, proj: 'mine',
    base: S({ damage: 90, cooldown: 1.0, amount: 4, area: 1.8, duration: 7, knock: 5 }),
    levels: [], evolved: true,
  },
  {
    id: 'axe', name: 'Topór', desc: 'Szerokie cięcie przed tobą.', icon: 'ic_axe', kind: 'cleave', color: C.lgray, hero: 'borgun',
    base: S({ damage: 18, cooldown: 1.0, knock: 4 }),
    levels: [{ damage: 6 }, { area: 0.15 }, { amount: 1 }, { cooldown: -0.12 }, { damage: 8 }, { area: 0.2 }, { amount: 1, damage: 10 }],
    evolve: { passive: 'fang', into: 'axe_evo' },
  },
  {
    id: 'axe_evo', name: 'Krwawy topór', desc: 'Wir cięć wokół bohatera.', icon: 'ic_axe_evo', kind: 'cleave', color: C.red, hero: 'borgun',
    base: S({ damage: 45, cooldown: 0.6, amount: 3, area: 1.7, knock: 5 }),
    levels: [], evolved: true,
  },
  {
    id: 'staff', name: 'Ognisty kostur', desc: 'Kule ognia lecące w najbliższych wrogów.', icon: 'ic_staff', kind: 'bolt', color: C.orange, proj: 'ember', hero: 'ignara',
    base: S({ damage: 14, cooldown: 1.0, speed: 160, area: 1.2, duration: 1.5 }),
    levels: [{ damage: 5 }, { amount: 1 }, { cooldown: -0.12 }, { damage: 6, pierce: 1 }, { amount: 1 }, { cooldown: -0.1 }, { damage: 12, amount: 1 }],
    evolve: { passive: 'lens', into: 'staff_evo' },
  },
  {
    id: 'staff_evo', name: 'Kostur feniksa', desc: 'Słoneczne kule przebijające wrogów.', icon: 'ic_staff_evo', kind: 'bolt', color: C.yellow, proj: 'sun', hero: 'ignara',
    base: S({ damage: 34, cooldown: 0.5, amount: 4, speed: 200, area: 1.6, duration: 1.8, pierce: 3, knock: 2 }),
    levels: [], evolved: true,
  },
];

export const WEAPON_BY_ID: Record<string, WeaponDef> = Object.fromEntries(WEAPONS.map((w) => [w.id, w]));

export function maxLevel(def: WeaponDef): number {
  return def.levels.length + 1;
}

/** Statystyki broni na danym poziomie: baza + suma przyrostów. */
export function weaponStatsAt(def: WeaponDef, level: number): WeaponStats {
  const s = { ...def.base };
  for (let i = 0; i < level - 1 && i < def.levels.length; i++) {
    const d = def.levels[i];
    for (const k in d) {
      const key = k as keyof WeaponStats;
      s[key] += d[key]!;
    }
  }
  return s;
}

/** Rzeczownik "sztuki" broni dla opisu +ilości (zależy od wzorca). */
const AMOUNT_NOUN: Record<WeaponKind, string> = {
  bolt: 'pocisk', orbit: 'ostrze', aura: 'aura', chain: 'piorun', meteor: 'meteor', boomerang: 'bumerang', laser: 'promień', mines: 'mina', cleave: 'cięcie',
};

const r2 = (v: number) => Math.round(Math.abs(v) * 100) / 100;

/** Czytelne opisy przyrostów (zależne od wzorca broni). */
const DELTA_LABEL: Record<keyof WeaponStats, (v: number, k: WeaponKind) => string> = {
  damage: (v) => `+${v} obrażeń`,
  cooldown: (v, k) => (v < 0 ? `${k === 'orbit' ? 'trafia' : 'atakuje'} częściej (-${r2(v)} s)` : `atakuje rzadziej (+${r2(v)} s)`),
  amount: (v, k) => `+${v} ${AMOUNT_NOUN[k]}`,
  speed: (_v, k) => (k === 'orbit' ? 'szybciej krąży' : 'szybsze pociski'),
  area: (v) => `+${Math.round(v * 100)}% zasięgu`,
  duration: (v, k) => (k === 'meteor' ? (v < 0 ? 'szybciej spada' : 'wolniej spada') : k === 'boomerang' ? 'leci dalej' : `działa ${r2(v)} s dłużej`),
  pierce: (v, k) => (k === 'chain' ? `+${v} skok pioruna` : `przebija +${v} wroga`),
  knock: () => 'mocniej odrzuca',
};

/** Tekst opisujący, co daje następny poziom broni. */
export function describeLevel(def: WeaponDef, nextLevel: number): string {
  const d = def.levels[nextLevel - 2];
  if (!d) return def.desc;
  return Object.entries(d).map(([k, v]) => DELTA_LABEL[k as keyof WeaponStats](v!, def.kind)).join(', ');
}
