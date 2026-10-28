import { BAL } from '../data/balance';
import {
  ELIXIR_BY_ID, SERVICE_BY_ID, elixirPrice, itemPrice, refreshPrice, rollShopItems, servicePrice, shopUpgradePrice,
  type ServiceId,
} from '../data/shop';
import type { Run } from '../game/run';

/** Wynik zakupu: komunikat dla gracza; `card` = trzeba pokazać wybór karty. */
export interface BuyResult {
  ok: boolean;
  note: string;
  card?: boolean;
}

const fail = (note: string): BuyResult => ({ ok: false, note });

/** Kupno przedmiotu: od razu zakładany, jeśli jego slot jest pusty, inaczej trafia do plecaka. */
export function buyItem(run: Run, i: number): BuyResult {
  const shop = run.shop!, it = shop.items[i];
  if (!it) return fail('Sprzedane');
  const price = itemPrice(it, shop);
  if (run.gold < price) return fail('Za mało złota');
  const slot = run.slotFor(it);
  if (run.equipment[slot] && run.bag.length >= BAL.bagSize) return fail('Plecak pełny');
  run.gold -= price;
  shop.items[i] = null;
  if (!run.equipment[slot]) { run.equip(it, slot); return { ok: true, note: `Założono: ${it.name}` }; }
  run.stash(it);
  return { ok: true, note: `${it.name} w plecaku` };
}

export function buyService(run: Run, id: ServiceId): BuyResult {
  const shop = run.shop!;
  if ((shop.stock[id] ?? 0) <= 0) return fail('Wyprzedane');
  const price = servicePrice(shop, id);
  if (run.gold < price) return fail('Za mało złota');
  if (id === 'potion' && run.player.hp >= run.stats.maxHp) return fail('Masz pełne HP');
  if (id === 'potion' && run.flag('noHeal') > 0) return fail('Klątwa blokuje leczenie');
  run.gold -= price;
  shop.stock[id]--;
  switch (id) {
    case 'potion': run.heal(run.stats.maxHp); return { ok: true, note: 'Uleczono' };
    case 'card': return { ok: true, note: '', card: true };
    case 'reroll': run.rerolls++; return { ok: true, note: `Losowania: ${run.rerolls}` };
    case 'banish': run.banishes++; return { ok: true, note: `Wygnania: ${run.banishes}` };
    case 'cardReroll': run.cardRerolls++; return { ok: true, note: `Losowania kart: ${run.cardRerolls}` };
    case 'stone': case 'ore': run.mats[id]++; return { ok: true, note: `${SERVICE_BY_ID[id].name}: ${run.mats[id]}` };
    case 'bless': case 'dragon': run.scrolls[id]++; return { ok: true, note: `${SERVICE_BY_ID[id].name}: ${run.scrolls[id]}` };
  }
}

export function buyElixir(run: Run, id: string): BuyResult {
  const shop = run.shop!, key = `elixir:${id}`, e = ELIXIR_BY_ID[id];
  if ((shop.stock[key] ?? 0) <= 0) return fail('Wyprzedane');
  const price = elixirPrice(shop, run.elixirsBought);
  if (run.gold < price) return fail('Za mało złota');
  run.gold -= price;
  shop.stock[key]--;
  run.elixirsBought++;
  run.addBonus(e.stat, e.value(shop.depth));
  run.recomputeStats();
  return { ok: true, note: `Wypito: ${e.name}` };
}

/** Rozbudowa sklepu (na cały run): rabat, lepsze przedmioty, na poziomie 3 i 5 dodatkowe miejsce. */
export function buyShopUpgrade(run: Run): BuyResult {
  const shop = run.shop!;
  if (run.shopLevel >= BAL.shopUpgrade.max) return fail('Sklep w pełni rozbudowany');
  const price = shopUpgradePrice(shop);
  if (run.gold < price) return fail('Za mało złota');
  run.gold -= price;
  shop.level = ++run.shopLevel;
  if (run.shopLevel === 3 || run.shopLevel === 5) shop.items.push(rollShopItems(shop.depth, run.luck(), run.shopLevel)[0]);
  return { ok: true, note: `Sklep poziom ${run.shopLevel}` };
}

/** Nowe przedmioty w sklepie (usługi i eliksiry zostają). */
export function refreshShop(run: Run): BuyResult {
  const shop = run.shop!, price = refreshPrice(shop);
  if (run.gold < price) return fail('Za mało złota');
  run.gold -= price;
  shop.refreshes++;
  shop.items = rollShopItems(shop.depth, run.luck(), shop.level ?? 1);
  return { ok: true, note: 'Nowe przedmioty' };
}
