import { BAL } from '../data/balance';
import { RARITIES, upgradeItem, rerollAffix, raiseRarity, type Item } from '../data/items';
import type { Run } from '../game/run';

/**
 * Kowadło między poziomami: operacje na przedmiotach za złoto i odłamki (z rozkładania).
 *  upgrade   ulepszenie (do BAL.anvil.maxUpgrades): każda wartość rośnie, losowe jest tylko o ile
 *  reroll    nowy losowy afiks w miejsce wybranego (albo wszystkie naraz, taniej)
 *  rarity    wyższa jakość: mocniejsze wartości + nowy afiks
 *  transfer  super-bonus z przedmiotu-dawcy na inny przedmiot; dawca przepada
 * Unikaty można tylko ulepszać (bez przekuwania i super-bonusu).
 * Ceny: BAL.anvil (złoto × BAL.shopScale(poziom przedmiotu)).
 */
export type AnvilOp = 'upgrade' | 'reroll' | 'rarity' | 'transfer';

export interface Cost {
  gold: number;
  shards: number;
}

export function anvilCost(run: Run, op: AnvilOp, it: Item): Cost {
  const base = BAL.anvil[op];
  const scale = BAL.shopScale(it.ilvl) * anvilDiscount(run);
  const mul = op === 'rarity' ? it.rarity + 1 : op === 'upgrade' ? 1 + BAL.anvil.upgradeCostGrowth * (it.upg ?? 0) : 1;
  return { gold: Math.round(base.gold * scale * mul), shards: Math.round(base.shards * mul) };
}

/** Rabat z ulepszenia kowadła (złoto). */
const anvilDiscount = (run: Run) => 1 - BAL.anvilUpgrade.discount * (run.anvilLevel - 1);
/** Ulepszone kowadło losuje bonus kilka razy i bierze najlepszy wynik (poziom 3: 2 rzuty, 5: 3 rzuty). */
const anvilRolls = (run: Run) => 1 + Math.floor((run.anvilLevel - 1) / 2);

export function anvilUpgradeCost(run: Run): Cost {
  const U = BAL.anvilUpgrade, l = run.anvilLevel;
  return { gold: Math.round(U.gold * Math.pow(U.growth, l - 1) * BAL.shopScale(run.depth)), shards: U.shards * l };
}

/** Ulepszenie kowadła (na cały run): tańsze operacje, lepsze bonusy, większa szansa na super-bonus. */
export function upgradeAnvil(run: Run): AnvilResult {
  if (run.anvilLevel >= BAL.anvilUpgrade.max) return fail('Kowadło w pełni ulepszone');
  const c = anvilUpgradeCost(run);
  if (!canAfford(run, c)) return fail('Za mało złota lub odłamków');
  pay(run, c);
  run.anvilLevel++;
  return { ok: true, note: `Kowadło poziom ${run.anvilLevel}` };
}

export function canAfford(run: Run, c: Cost): boolean {
  return run.gold >= c.gold && run.shards >= c.shards;
}

function pay(run: Run, c: Cost): void {
  run.gold -= c.gold;
  run.shards -= c.shards;
}

export interface AnvilResult {
  ok: boolean;
  note: string;
}

const fail = (note: string): AnvilResult => ({ ok: false, note });

/** Wspólne zakończenie: zapłata (zapamiętana na przedmiocie — zwrot przy rozkładaniu) i przeliczenie buildu. */
function done(run: Run, it: Item, c: Cost, note: string): AnvilResult {
  pay(run, c);
  it.spent = { gold: (it.spent?.gold ?? 0) + c.gold, shards: (it.spent?.shards ?? 0) + c.shards };
  run.onBuildChanged();
  return { ok: true, note };
}

export function anvilUpgrade(run: Run, it: Item): AnvilResult {
  const c = anvilCost(run, 'upgrade', it);
  if ((it.upg ?? 0) >= BAL.anvil.maxUpgrades) return fail('Limit ulepszeń');
  if (!canAfford(run, c)) return fail('Za mało złota lub odłamków');
  upgradeItem(it);
  return done(run, it, c, `Ulepszenie ${it.upg}/${BAL.anvil.maxUpgrades}`);
}

export function anvilReroll(run: Run, it: Item, idx: number): AnvilResult {
  if (it.unique) return fail('Unikatu nie da się przekuć');
  const c = anvilCost(run, 'reroll', it);
  if (!it.affixes[idx]) return fail('Brak bonusu do przekucia');
  if (!canAfford(run, c)) return fail('Za mało złota lub odłamków');
  if (!rerollAffix(it, idx, anvilRolls(run))) return fail('Brak innych bonusów do wylosowania');
  return done(run, it, c, 'Bonus przekuty');
}

/** Koszt przekucia wszystkich bonusów naraz (taniej niż po kolei). */
export function rerollAllCost(run: Run, it: Item): Cost {
  const one = anvilCost(run, 'reroll', it);
  const n = it.affixes.length;
  return { gold: Math.round(one.gold * n * BAL.anvil.rerollAllMul), shards: Math.max(1, Math.round(one.shards * n * BAL.anvil.rerollAllMul)) };
}

export function anvilRerollAll(run: Run, it: Item): AnvilResult {
  if (it.unique) return fail('Unikatu nie da się przekuć');
  if (!it.affixes.length) return fail('Brak bonusów do przekucia');
  const c = rerollAllCost(run, it);
  if (!canAfford(run, c)) return fail('Za mało złota lub odłamków');
  for (let i = 0; i < it.affixes.length; i++) rerollAffix(it, i, anvilRolls(run));
  return done(run, it, c, 'Wszystkie bonusy przekute');
}

export function anvilRarity(run: Run, it: Item): AnvilResult {
  if (it.rarity >= RARITIES.length - 1) return fail('Najwyższa jakość');
  const c = anvilCost(run, 'rarity', it);
  if (!canAfford(run, c)) return fail('Za mało złota lub odłamków');
  raiseRarity(it, anvilRolls(run), BAL.anvilUpgrade.superBonus * (run.anvilLevel - 1));
  return done(run, it, c, `Nowa jakość: ${RARITIES[it.rarity].name.m}`);
}

/** Przenosi super-bonus z `from` na `to`; `from` przepada (bez złota i odłamków). */
export function anvilTransfer(run: Run, from: Item, to: Item): AnvilResult {
  if (!from.super) return fail('Dawca nie ma super-bonusu');
  if (from === to) return fail('Wybierz inny przedmiot');
  if (to.unique) return fail('Unikat nie przyjmie super-bonusu');
  const c = anvilCost(run, 'transfer', to);
  if (!canAfford(run, c)) return fail('Za mało złota lub odłamków');
  to.super = from.super;
  for (const s of Object.keys(run.equipment) as (keyof typeof run.equipment)[]) if (run.equipment[s] === from) run.equipment[s] = null;
  run.bag = run.bag.filter((b) => b !== from);
  return done(run, to, c, 'Super-bonus przeniesiony');
}
