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
export type WeaponKind = 'bolt' | 'orbit' | 'aura' | 'chain' | 'meteor' | 'boomerang' | 'laser' | 'mines' | 'cleave' | 'nova';

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
  /** Ewolucje: broń na maks. poziomie + pasywka `passive` → `into`. Pierwsza to ewolucja podstawowa, kolejne to warianty (ALT_EVOS). */
  evolves?: { passive: string; into: string }[];
  evolved?: boolean;
  /** Hybryda z fuzji (FUSIONS): zajmuje slot jednej z dwóch broni-rodziców. */
  fused?: boolean;
  /** Efekty pocisków hybrydy: wybuch przy trafieniu (ułamek obrażeń), rozszczepienie, naprowadzanie. */
  hybrid?: { blast?: number; split?: boolean; seek?: boolean };
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
    evolves: [{ passive: 'might', into: 'bolt_evo' }],
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
    evolves: [{ passive: 'wings', into: 'arrow_evo' }],
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
    evolves: [{ passive: 'hourglass', into: 'orbit_evo' }],
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
    evolves: [{ passive: 'armor', into: 'aura_evo' }],
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
    evolves: [{ passive: 'clock', into: 'chain_evo' }],
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
    evolves: [{ passive: 'lens', into: 'meteor_evo' }],
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
    evolves: [{ passive: 'dup', into: 'boomer_evo' }],
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
    evolves: [{ passive: 'crit', into: 'laser_evo' }],
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
    evolves: [{ passive: 'heart', into: 'mines_evo' }],
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
    evolves: [{ passive: 'fang', into: 'axe_evo' }],
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
    evolves: [{ passive: 'lens', into: 'staff_evo' }],
  },
  {
    id: 'staff_evo', name: 'Kostur feniksa', desc: 'Słoneczne kule przebijające wrogów.', icon: 'ic_staff_evo', kind: 'bolt', color: C.yellow, proj: 'sun', hero: 'ignara',
    base: S({ damage: 34, cooldown: 0.5, amount: 4, speed: 200, area: 1.6, duration: 1.8, pierce: 3, knock: 2 }),
    levels: [], evolved: true,
  },
  {
    id: 'souls', name: 'Duszki', desc: 'Zatrute dusze lecą w najbliższych wrogów.', icon: 'ic_souls', kind: 'bolt', color: C.pink, proj: 'soul', hero: 'morwen',
    base: S({ damage: 11, cooldown: 0.9, speed: 140, duration: 1.7, pierce: 1 }),
    levels: [{ damage: 4 }, { amount: 1 }, { cooldown: -0.1 }, { pierce: 1, damage: 4 }, { amount: 1 }, { cooldown: -0.1 }, { damage: 10, amount: 1 }],
    evolves: [{ passive: 'hourglass', into: 'souls_evo' }],
  },
  {
    id: 'souls_evo', name: 'Rój dusz', desc: 'Chmara dusz przenikających wrogów.', icon: 'ic_souls_evo', kind: 'bolt', color: C.salmon, proj: 'soul', hero: 'morwen',
    base: S({ damage: 26, cooldown: 0.45, amount: 4, speed: 170, area: 1.3, duration: 2, pierce: 4, knock: 1 }),
    levels: [], evolved: true,
  },

  {
    id: 'knives', name: 'Noże do rzucania', desc: 'Szybkie noże lecące w najbliższych wrogów.', icon: 'ic_knives', kind: 'bolt', color: C.lavender, proj: 'knife', hero: 'vesper',
    base: S({ damage: 9, cooldown: 0.5, speed: 250, duration: 0.9, pierce: 1, knock: 0.5 }),
    levels: [{ damage: 3 }, { amount: 1 }, { cooldown: -0.06 }, { pierce: 1, damage: 3 }, { amount: 1 }, { cooldown: -0.06 }, { damage: 8, amount: 1 }],
    evolves: [{ passive: 'fury', into: 'knives_evo' }],
  },
  {
    id: 'knives_evo', name: 'Wachlarz cieni', desc: 'Chmara noży przebijających wrogów.', icon: 'ic_knives_evo', kind: 'bolt', color: C.white, proj: 'knife', hero: 'vesper',
    base: S({ damage: 22, cooldown: 0.28, amount: 4, speed: 300, duration: 1, pierce: 3, knock: 1 }),
    levels: [], evolved: true,
  },
  {
    id: 'light', name: 'Święte światło', desc: 'Z bohatera rozchodzi się pierścień światła, który rani i odpycha każdego wroga na drodze.', icon: 'ic_light', kind: 'nova', color: C.yellow, hero: 'aurel',
    base: S({ damage: 14, cooldown: 1.5, knock: 2 }),
    levels: [{ damage: 4 }, { area: 0.15 }, { cooldown: -0.2 }, { amount: 1 }, { damage: 6 }, { area: 0.15 }, { amount: 1, damage: 6 }],
    evolves: [{ passive: 'herb', into: 'light_evo' }],
  },
  {
    id: 'light_evo', name: 'Promień niebios', desc: 'Szerokie pierścienie słonecznego światła, jeden po drugim, palą i odpychają wrogów.', icon: 'ic_light_evo', kind: 'nova', color: C.white, hero: 'aurel',
    base: S({ damage: 34, cooldown: 1, amount: 3, area: 1.6, knock: 3 }),
    levels: [], evolved: true,
  },

  // ---- hybrydy z fuzji (FUSIONS); ikony ic_f_* w gfx/icons.ts ----
  {
    id: 'f_firearrow', name: 'Płonące strzały', desc: 'Strzały wybuchające ogniem przy trafieniu.', icon: 'ic_f_firearrow', kind: 'bolt', color: C.orange, proj: 'arrow', hero: 'kestra',
    base: S({ damage: 36, cooldown: 0.42, amount: 4, speed: 300, duration: 1.4, pierce: 4, knock: 2 }), levels: [], evolved: true, fused: true, hybrid: { blast: 0.6 },
  },
  {
    id: 'f_stormarrow', name: 'Burzowe strzały', desc: 'Strzały rozszczepiające się przy trafieniu, porażają.', icon: 'ic_f_stormarrow', kind: 'bolt', color: C.yellow, proj: 'arrow', hero: 'kestra',
    base: S({ damage: 34, cooldown: 0.4, amount: 4, speed: 300, duration: 1.4, pierce: 5, knock: 1.5 }), levels: [], evolved: true, fused: true, hybrid: { split: true },
  },
  {
    id: 'f_frostwhirl', name: 'Mroźny wir', desc: 'Cięcia dookoła bohatera, które mrożą wrogów.', icon: 'ic_f_frostwhirl', kind: 'cleave', color: C.cyan, hero: 'borgun',
    base: S({ damage: 55, cooldown: 0.55, amount: 4, area: 2, knock: 5 }), levels: [], evolved: true, fused: true,
  },
  {
    id: 'f_flyaxe', name: 'Latające topory', desc: 'Topory lecą przed siebie i wracają, tnąc wszystko po drodze.', icon: 'ic_f_flyaxe', kind: 'boomerang', color: C.lgray, proj: 'boom', hero: 'borgun',
    base: S({ damage: 52, cooldown: 0.8, amount: 4, speed: 260, duration: 0.8, pierce: 999, knock: 4 }), levels: [], evolved: true, fused: true,
  },
  {
    id: 'f_stormstaff', name: 'Kostur burzy', desc: 'Słoneczne kule naprowadzane na kolejnych wrogów, porażają.', icon: 'ic_f_stormstaff', kind: 'bolt', color: C.yellow, proj: 'sun', hero: 'ignara',
    base: S({ damage: 40, cooldown: 0.45, amount: 4, speed: 210, area: 1.6, duration: 1.8, pierce: 3, knock: 2 }), levels: [], evolved: true, fused: true, hybrid: { seek: true },
  },
  {
    id: 'f_comet', name: 'Kometa', desc: 'Ogromne kule ognia wybuchające przy trafieniu.', icon: 'ic_f_comet', kind: 'bolt', color: C.red, proj: 'sun', hero: 'ignara',
    base: S({ damage: 46, cooldown: 0.55, amount: 3, speed: 180, area: 2, duration: 1.8, pierce: 1, knock: 3 }), levels: [], evolved: true, fused: true, hybrid: { blast: 1 },
  },
  {
    id: 'f_soulwhirl', name: 'Wir dusz', desc: 'Gęsty wir zatrutych dusz krąży wokół ciebie.', icon: 'ic_f_soulwhirl', kind: 'orbit', color: C.pink, proj: 'soul', hero: 'morwen',
    base: S({ damage: 36, cooldown: 0.22, amount: 9, speed: 4, area: 1.8, knock: 2 }), levels: [], evolved: true, fused: true,
  },
  {
    id: 'f_gravemines', name: 'Grobowe miny', desc: 'Miny pełne trucizny rozsiane wokół ciebie.', icon: 'ic_f_gravemines', kind: 'mines', color: C.lime, proj: 'mine', hero: 'morwen',
    base: S({ damage: 95, cooldown: 0.9, amount: 4, area: 1.9, duration: 7, knock: 4 }), levels: [], evolved: true, fused: true,
  },
  {
    id: 'f_bladering', name: 'Wir sztyletów', desc: 'Pierścień sztyletów tnie wszystko wokół ciebie.', icon: 'ic_f_bladering', kind: 'orbit', color: C.lavender, proj: 'knife', hero: 'vesper',
    base: S({ damage: 34, cooldown: 0.2, amount: 9, speed: 5, area: 1.7, knock: 2 }), levels: [], evolved: true, fused: true,
  },
  {
    id: 'f_shuriken', name: 'Gwiazdy cienia', desc: 'Wirujące noże lecą przed siebie i wracają.', icon: 'ic_f_shuriken', kind: 'boomerang', color: C.lavender, proj: 'boom', hero: 'vesper',
    base: S({ damage: 44, cooldown: 0.6, amount: 5, speed: 280, duration: 0.7, pierce: 999, knock: 2 }), levels: [], evolved: true, fused: true,
  },
  {
    id: 'f_halo', name: 'Aureola', desc: 'Złota aura pali i odpycha wrogów wokół ciebie.', icon: 'ic_f_halo', kind: 'aura', color: C.yellow, hero: 'aurel',
    base: S({ damage: 22, cooldown: 0.3, amount: 0, area: 2.4, knock: 2 }), levels: [], evolved: true, fused: true,
  },
  {
    id: 'f_sunbeam', name: 'Promień słońca', desc: 'Wachlarz słonecznych promieni przeszywa wrogów.', icon: 'ic_f_sunbeam', kind: 'laser', color: C.yellow, hero: 'aurel',
    base: S({ damage: 28, cooldown: 0.9, amount: 4, area: 2, duration: 0.9, knock: 0 }), levels: [], evolved: true, fused: true,
  },
  {
    id: 'f_thunderorb', name: 'Kula piorunów', desc: 'Gwiazdy rozszczepiające się przy trafieniu, porażają.', icon: 'ic_f_thunderorb', kind: 'bolt', color: C.yellow, proj: 'star',
    base: S({ damage: 36, cooldown: 0.45, amount: 5, speed: 230, area: 1.3, duration: 2, pierce: 3, knock: 1.5 }), levels: [], evolved: true, fused: true, hybrid: { split: true },
  },
  {
    id: 'f_frostring', name: 'Mroźny pierścień', desc: 'Szeroki pierścień lodowych ostrzy.', icon: 'ic_f_frostring', kind: 'orbit', color: C.cyan, proj: 'blade',
    base: S({ damage: 36, cooldown: 0.22, amount: 10, speed: 4.5, area: 2.2, knock: 3 }), levels: [], evolved: true, fused: true,
  },
  {
    id: 'f_firefield', name: 'Ognista ziemia', desc: 'Nieustanny deszcz ogromnych meteorów.', icon: 'ic_f_firefield', kind: 'meteor', color: C.red,
    base: S({ damage: 100, cooldown: 1.2, amount: 6, area: 2, duration: 0.6, knock: 4 }), levels: [], evolved: true, fused: true,
  },
  {
    id: 'f_mirror', name: 'Lustrzany promień', desc: 'Wachlarz porażających promieni.', icon: 'ic_f_mirror', kind: 'laser', color: C.yellow,
    base: S({ damage: 26, cooldown: 1, amount: 5, area: 2, duration: 0.9, knock: 0 }), levels: [], evolved: true, fused: true,
  },
];

/**
 * Warianty ewolucji (0.31): każda pasywka ewoluuje co najmniej dwie bronie. Wariant to ta sama broń po ewolucji podstawowej
 * (wzorzec, pocisk, bohater), ale z inną pasywką i innym profilem statystyk albo efektem pocisków (`hybrid`).
 * Ikona: ikona ewolucji podstawowej przemalowana rampą `ramp` (gfx/icons.ts).
 */
export interface AltEvo {
  base: string;
  passive: string;
  id: string;
  name: string;
  desc: string;
  color: number;
  ramp: readonly number[];
  stats: Partial<WeaponStats>;
  hybrid?: WeaponDef['hybrid'];
}

const R_GOLD = [C.dbrown, C.orange, C.gold, C.yellow], R_BLOOD = [C.ddbrown, C.dred, C.red, C.salmon], R_ICE = [C.navy, C.dblue, C.blue, C.cyan];
const R_LEAF = [C.teal, C.dgreen, C.green, C.lime], R_VOID = [C.black, C.plum, C.pink, C.salmon], R_STEEL = [C.slate, C.dgray, C.lavender, C.white];
const R_FIRE = [C.dred, C.rust, C.orange, C.gold];

export const ALT_EVOS: AltEvo[] = [
  { base: 'bolt', passive: 'magnet', id: 'bolt_mag', name: 'Lodestar Volley', desc: 'Stars that home in on enemies.', color: C.cyan, ramp: R_ICE, stats: { damage: 30, amount: 4, pierce: 2 }, hybrid: { seek: true } },
  { base: 'arrow', passive: 'crit', id: 'arrow_crit', name: 'Hawkeye Bow', desc: 'Fewer, heavier arrows that pierce the whole line.', color: C.gold, ramp: R_GOLD, stats: { damage: 52, amount: 3, cooldown: 0.5, pierce: 9 } },
  { base: 'arrow', passive: 'whetstone', id: 'arrow_sharp', name: 'Razor Quiver', desc: 'Arrows split into shards when they hit.', color: C.lgray, ramp: R_STEEL, stats: { damage: 28 }, hybrid: { split: true } },
  { base: 'orbit', passive: 'armor', id: 'orbit_armor', name: 'Bulwark Ring', desc: 'Heavy blades in a wide ring that throw enemies back.', color: C.lgray, ramp: R_STEEL, stats: { damage: 30, amount: 6, speed: 3, area: 2, knock: 5 } },
  { base: 'aura', passive: 'herb', id: 'aura_herb', name: 'Grove Aura', desc: 'A very wide aura of thorns around the hero.', color: C.lime, ramp: R_LEAF, stats: { damage: 12, cooldown: 0.3, area: 2.8, knock: 1 } },
  { base: 'chain', passive: 'fury', id: 'chain_fury', name: 'Thunder Rage', desc: 'Fast chains of lightning, one after another.', color: C.yellow, ramp: R_GOLD, stats: { damage: 26, cooldown: 0.5, amount: 3, pierce: 6 } },
  { base: 'meteor', passive: 'might', id: 'meteor_might', name: 'Doom Star', desc: 'Two huge meteors that flatten a wide area.', color: C.hotpink, ramp: R_BLOOD, stats: { damage: 220, cooldown: 1.6, amount: 2, area: 2.6, knock: 6 } },
  { base: 'meteor', passive: 'ember', id: 'meteor_ember', name: 'Cinder Storm', desc: 'A storm of small burning meteors.', color: C.orange, ramp: R_FIRE, stats: { damage: 50, cooldown: 1.2, amount: 9, area: 1.3 } },
  { base: 'boomerang', passive: 'wings', id: 'boomer_wings', name: 'Gale Wheels', desc: 'Fast boomerangs that fly far.', color: C.cyan, ramp: R_ICE, stats: { damage: 36, cooldown: 0.7, speed: 340, duration: 1 } },
  { base: 'boomerang', passive: 'horseshoe', id: 'boomer_luck', name: 'Lucky Return', desc: 'Boomerangs that burst on every hit.', color: C.gold, ramp: R_GOLD, stats: { damage: 34, amount: 5 }, hybrid: { blast: 0.4 } },
  { base: 'laser', passive: 'clock', id: 'laser_clock', name: 'Chrono Beam', desc: 'Beams that fire much more often.', color: C.cyan, ramp: R_ICE, stats: { damage: 14, cooldown: 0.7, amount: 3, duration: 0.6 } },
  { base: 'laser', passive: 'horseshoe', id: 'laser_luck', name: 'Fortune Prism', desc: 'A wide fan of six golden beams.', color: C.gold, ramp: R_GOLD, stats: { damage: 12, amount: 6, area: 2 } },
  { base: 'mines', passive: 'magnet', id: 'mines_mag', name: 'Magnet Mines', desc: 'Mines with a huge blast radius.', color: C.blue, ramp: R_ICE, stats: { damage: 70, amount: 5, area: 2.4 } },
  { base: 'axe', passive: 'whetstone', id: 'axe_sharp', name: "Headsman's Axe", desc: 'Slow, huge cuts that hit very hard.', color: C.lgray, ramp: R_STEEL, stats: { damage: 75, cooldown: 0.8, amount: 2, area: 1.9 } },
  { base: 'staff', passive: 'clover', id: 'staff_luck', name: 'Star Staff', desc: 'Suns that home in on enemies.', color: C.lime, ramp: R_LEAF, stats: { damage: 30, amount: 5 }, hybrid: { seek: true } },
  { base: 'staff', passive: 'ember', id: 'staff_ember', name: 'Inferno Staff', desc: 'Suns that explode on hit.', color: C.red, ramp: R_BLOOD, stats: { damage: 30, amount: 3 }, hybrid: { blast: 0.8 } },
  { base: 'souls', passive: 'fang', id: 'souls_fang', name: 'Blood Souls', desc: 'Red souls that hunt enemies down.', color: C.red, ramp: R_BLOOD, stats: { damage: 30, amount: 5, pierce: 2 }, hybrid: { seek: true } },
  { base: 'knives', passive: 'dup', id: 'knives_dup', name: 'Knife Storm', desc: 'A storm of eight knives at once.', color: C.pink, ramp: R_VOID, stats: { damage: 16, cooldown: 0.3, amount: 8 } },
  { base: 'light', passive: 'heart', id: 'light_heart', name: 'Sun Heart', desc: 'Two wide, strong rings of light.', color: C.salmon, ramp: R_BLOOD, stats: { damage: 40, amount: 2, area: 2.2 } },
  { base: 'light', passive: 'clover', id: 'light_luck', name: 'Blessed Light', desc: 'Five rings of light, one after another.', color: C.lime, ramp: R_LEAF, stats: { damage: 28, cooldown: 0.8, amount: 5 } },
];

for (const a of ALT_EVOS) {
  const base = WEAPONS.find((w) => w.id === a.base)!, ref = WEAPONS.find((w) => w.id === base.evolves![0].into)!;
  WEAPONS.push({ ...ref, id: a.id, name: a.name, desc: a.desc, icon: `ic_${a.id}`, color: a.color, base: { ...ref.base, ...a.stats }, levels: [], evolved: true, hybrid: a.hybrid ?? ref.hybrid });
  base.evolves!.push({ passive: a.passive, into: a.id });
}

/** Ewolucje broni (pusta lista dla ewolucji i hybryd). */
export const evolvesOf = (d: WeaponDef): { passive: string; into: string }[] => d.evolves ?? [];

/** Broń bazowa i pasywka, z których powstaje ewolucja `id`. */
export function evolveSource(id: string): { base: WeaponDef; passive: string } | undefined {
  for (const w of WEAPONS) for (const e of evolvesOf(w)) if (e.into === id) return { base: w, passive: e.passive };
  return undefined;
}

export const WEAPON_BY_ID: Record<string, WeaponDef> = Object.fromEntries(WEAPONS.map((w) => [w.id, w]));

/**
 * Fuzje: dwie bronie (id bazowe, przed ewolucją), każda na maks. poziomie albo po ewolucji, łączą się w hybrydę `into`
 * (opcja awansu 'fusion'). Hybryda zajmuje slot pierwszej, druga znika (wolny slot), bonusy jakości się sumują.
 */
export const FUSIONS: { a: string; b: string; into: string }[] = [
  { a: 'arrow', b: 'meteor', into: 'f_firearrow' }, { a: 'arrow', b: 'chain', into: 'f_stormarrow' },
  { a: 'axe', b: 'aura', into: 'f_frostwhirl' }, { a: 'axe', b: 'boomerang', into: 'f_flyaxe' },
  { a: 'staff', b: 'chain', into: 'f_stormstaff' }, { a: 'staff', b: 'meteor', into: 'f_comet' },
  { a: 'souls', b: 'orbit', into: 'f_soulwhirl' }, { a: 'souls', b: 'mines', into: 'f_gravemines' },
  { a: 'knives', b: 'orbit', into: 'f_bladering' }, { a: 'knives', b: 'boomerang', into: 'f_shuriken' },
  { a: 'light', b: 'aura', into: 'f_halo' }, { a: 'light', b: 'laser', into: 'f_sunbeam' },
  { a: 'bolt', b: 'chain', into: 'f_thunderorb' }, { a: 'orbit', b: 'aura', into: 'f_frostring' },
  { a: 'meteor', b: 'mines', into: 'f_firefield' }, { a: 'laser', b: 'boomerang', into: 'f_mirror' },
];

/** Receptura hybrydy (po id hybrydy). */
export function fusionOf(id: string): { a: string; b: string; into: string } | undefined {
  return FUSIONS.find((f) => f.into === id);
}

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
  bolt: 'pocisk', orbit: 'ostrze', aura: 'aura', chain: 'piorun', meteor: 'meteor', boomerang: 'bumerang', laser: 'promień', mines: 'mina', cleave: 'cięcie', nova: 'pierścień',
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
