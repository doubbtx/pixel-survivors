import type { Stats } from '../entities/types';

/**
 * Pasywki z level upów. Każda dodaje `perLevel` do jednej statystyki na poziom.
 * Ikona 'pi_<id>' jest rysowana w gfx/icons.ts.
 */
export interface PassiveDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  stat: keyof Stats;
  perLevel: number;
  maxLevel: number;
  /**
   * Ewolucja pasywki (0.31): dostępna przy awansie, gdy pasywka ma maks. poziom, a jedna z broni, które ewoluuje, jest już
   * po tej ewolucji. Dokłada `stats` do bonusu poziomów; ikona `pi_<id>_evo` (ikona pasywki ze złotą iskrą).
   */
  evo: { name: string; desc: string; stats: Partial<Stats> };
}

const P = (id: string, name: string, desc: string, stat: keyof Stats, perLevel: number, maxLevel = 5): Omit<PassiveDef, 'evo'> =>
  ({ id, name, desc, icon: `pi_${id}`, stat, perLevel, maxLevel });

const BASE: Omit<PassiveDef, 'evo'>[] = [
  P('might', 'Moc', '+10% obrażeń', 'might', 0.1),
  P('heart', 'Serce', '+20 maks. HP', 'maxHp', 20),
  P('armor', 'Pancerz', '+3 pancerza (mniej obrażeń od wrogów)', 'armor', 3),
  P('wings', 'Skrzydła', '+10% szybkości ruchu', 'speedBonus', 0.1),
  P('clock', 'Zegar', 'Umiejętności odnawiają się 8% szybciej', 'cdr', 0.08),
  P('lens', 'Soczewka', 'Ataki i efekty są 10% większe', 'area', 0.1),
  P('dup', 'Duplikator', '+1 pocisk dla każdej broni', 'amount', 1, 2),
  P('magnet', 'Magnes', 'Kryształy i monety przyciągasz z 30% większej odległości', 'magnet', 0.3),
  P('crit', 'Oko sokoła', '+5% szansy na trafienie krytyczne', 'crit', 0.05),
  P('hourglass', 'Klepsydra', 'Efekty broni i umiejętności trwają 12% dłużej', 'duration', 0.12),
  P('fang', 'Kieł', 'Leczysz się za 1% zadanych obrażeń', 'lifesteal', 0.01),
  P('herb', 'Ziele', 'Odnawiasz 0.3 HP na sekundę', 'regen', 0.3),
  P('fury', 'Furia', 'Bronie atakują 8% szybciej', 'atkSpeed', 0.08),
  P('clover', 'Koniczyna', '+1 karta do wyboru przy każdym awansie', 'choices', 1, 1),
  P('horseshoe', 'Podkowa', '+15% szczęścia: lepsze przedmioty i karty, częstsze skrzynie', 'luck', 0.15),
  // 0.31: nowe pasywki (każda ewoluuje dwie bronie).
  P('ember', 'Ember', '+12% elemental power (burning, poison, slow)', 'elemPower', 0.12),
  P('whetstone', 'Whetstone', '+15% critical damage', 'critMult', 0.15),
];

/** Ewolucje pasywek: dodatkowe statystyki ponad poziomy (opis po angielsku, polski w core/i18n-pl.ts). */
const EVO: Record<string, PassiveDef['evo']> = {
  might: { name: 'Titan Might', desc: '+25% damage and +10% area', stats: { might: 0.25, area: 0.1 } },
  heart: { name: "Giant's Heart", desc: '+60 max HP and +1 HP/s', stats: { maxHp: 60, regen: 1 } },
  armor: { name: 'Fortress', desc: '+8 armor and +30 max HP', stats: { armor: 8, maxHp: 30 } },
  wings: { name: 'Wind Walker', desc: '+15% movement speed and +10% attack speed', stats: { speedBonus: 0.15, atkSpeed: 0.1 } },
  clock: { name: 'Time Lord', desc: 'Abilities recharge 12% faster, effects last 10% longer', stats: { cdr: 0.12, duration: 0.1 } },
  lens: { name: 'Great Lens', desc: 'Attacks and effects are 20% bigger', stats: { area: 0.2 } },
  dup: { name: 'Mirror Image', desc: '+1 projectile for every weapon and +10% damage', stats: { amount: 1, might: 0.1 } },
  magnet: { name: 'Lodestone', desc: '+60% pickup range and +15% experience', stats: { magnet: 0.6, growth: 0.15 } },
  crit: { name: 'Eagle Eye', desc: '+10% critical chance and +25% critical damage', stats: { crit: 0.1, critMult: 0.25 } },
  hourglass: { name: 'Eternity', desc: 'Effects last 20% longer, abilities recharge 6% faster', stats: { duration: 0.2, cdr: 0.06 } },
  fang: { name: 'Vampire Fang', desc: '+2% life steal and +20 max HP', stats: { lifesteal: 0.02, maxHp: 20 } },
  herb: { name: 'World Tree', desc: '+1.5 HP/s and +30 max HP', stats: { regen: 1.5, maxHp: 30 } },
  fury: { name: 'Berserk Fury', desc: '+15% attack speed and +10% damage', stats: { atkSpeed: 0.15, might: 0.1 } },
  clover: { name: 'Four-Leaf Crown', desc: '+20% luck and +20% gold', stats: { luck: 0.2, greed: 0.2 } },
  horseshoe: { name: 'Golden Horseshoe', desc: '+25% luck and +25% gold', stats: { luck: 0.25, greed: 0.25 } },
  ember: { name: 'Phoenix Ember', desc: '+30% elemental power and +10% damage', stats: { elemPower: 0.3, might: 0.1 } },
  whetstone: { name: 'Diamond Edge', desc: '+40% critical damage and +5% critical chance', stats: { critMult: 0.4, crit: 0.05 } },
};

export const PASSIVES: PassiveDef[] = BASE.map((p) => ({ ...p, evo: EVO[p.id] }));

export const PASSIVE_BY_ID: Record<string, PassiveDef> = Object.fromEntries(PASSIVES.map((p) => [p.id, p]));

/** Ikona posiadanej pasywki (po ewolucji: ze złotą gwiazdą). */
export const passiveIcon = (p: { id: string; evo?: boolean }): string => `${PASSIVE_BY_ID[p.id].icon}${p.evo ? '_evo' : ''}`;
