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
}

const P = (id: string, name: string, desc: string, stat: keyof Stats, perLevel: number, maxLevel = 5): PassiveDef =>
  ({ id, name, desc, icon: `pi_${id}`, stat, perLevel, maxLevel });

export const PASSIVES: PassiveDef[] = [
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
  P('clover', 'Koniczyna', '+1 karta do wyboru przy każdym awansie', 'luck', 1, 1),
];

export const PASSIVE_BY_ID: Record<string, PassiveDef> = Object.fromEntries(PASSIVES.map((p) => [p.id, p]));
