import { rng } from '../core/rng';
import type { Stats } from '../entities/types';
import type { Run } from '../game/run';
import { BAL } from './balance';
import { rollItem, salvageValue, type Item } from './items';

/**
 * Sklep między poziomami kampanii: przedmioty (lepsze niż zwykły łup, z poziomem następnego
 * poziomu kampanii), usługi (mikstura, karta, zasoby wyboru) i eliksiry ze stałym bonusem.
 * Oferta jest losowana raz po pokonaniu bossa i zapisywana w runie — wyjście z gry jej nie odświeża.
 *
 * Nowa usługa = wpis w SERVICES (+ cena i zapas w BAL.shopPrice / BAL.shopStock) i obsługa w systems/shop.ts.
 * Nowy eliksir = wpis w ELIXIRS (statystyka + wartość; HP rośnie z głębokością jak przedmioty).
 */
export type ServiceId = 'potion' | 'card' | 'reroll' | 'banish' | 'cardReroll' | 'stone' | 'ore' | 'bless' | 'dragon';

export interface ServiceDef {
  id: ServiceId;
  name: string;
  desc: string;
  icon: string;
}

export const SERVICES: ServiceDef[] = [
  { id: 'potion', name: 'Mikstura', desc: 'Leczy do pełna.', icon: 'sh_potion' },
  { id: 'card', name: 'Karta', desc: 'Wybór jednej z 3 kart (jak za elitę).', icon: 'sh_card' },
  { id: 'reroll', name: 'Kość losu', desc: '+1 losowanie przy awansie.', icon: 'sh_dice' },
  { id: 'banish', name: 'Zwój wygnania', desc: '+1 wygnanie przy awansie.', icon: 'sh_scroll' },
  { id: 'cardReroll', name: 'Czterolistna talia', desc: '+1 losowanie karty.', icon: 'pi_clover' },
  // Kuźnia runiczna (data/forge.ts).
  { id: 'stone', name: 'Kamień kowalski', desc: 'Materiał kuźni na +1 do +3.', icon: 'mt_stone' },
  { id: 'ore', name: 'Ruda gwiezdna', desc: 'Materiał kuźni na +4 do +6 i naprawy.', icon: 'mt_ore' },
  { id: 'bless', name: 'Zwój błogosławieństwa', desc: 'Kuźnia: porażka nie obniża poziomu.', icon: 'sc_bless' },
  { id: 'dragon', name: 'Zwój smoka', desc: 'Kuźnia: +15% szansy na jedną próbę.', icon: 'sc_dragon' },
];

export const SERVICE_BY_ID = Object.fromEntries(SERVICES.map((s) => [s.id, s])) as Record<ServiceId, ServiceDef>;

export interface ElixirDef {
  id: string;
  name: string;
  icon: string;
  stat: keyof Stats;
  value: (depth: number) => number;
  /** Opis z {v} = wartość. */
  desc: string;
  pct: boolean;
}

export const ELIXIRS: ElixirDef[] = [
  { id: 'might', name: 'Eliksir siły', icon: 'pi_might', stat: 'might', value: () => 0.06, desc: '+{v} obrażeń na stałe', pct: true },
  { id: 'life', name: 'Eliksir żywotności', icon: 'pi_heart', stat: 'maxHp', value: (d) => 15 * BAL.itemHpScale(d), desc: '+{v} maks. HP na stałe', pct: false },
  { id: 'guard', name: 'Eliksir ochrony', icon: 'pi_armor', stat: 'armor', value: () => 2, desc: '+{v} pancerza na stałe', pct: false },
  { id: 'focus', name: 'Eliksir precyzji', icon: 'pi_crit', stat: 'crit', value: () => 0.03, desc: '+{v} szansy na krytyk na stałe', pct: true },
  { id: 'reach', name: 'Eliksir zasięgu', icon: 'pi_lens', stat: 'area', value: () => 0.06, desc: '+{v} obszaru na stałe', pct: true },
  { id: 'fury', name: 'Eliksir furii', icon: 'pi_fury', stat: 'atkSpeed', value: () => 0.06, desc: '+{v} szybkości ataku na stałe', pct: true },
  { id: 'haste', name: 'Eliksir pośpiechu', icon: 'pi_clock', stat: 'cdr', value: () => 0.04, desc: 'Umiejętności odnawiają się {v} szybciej na stałe', pct: true },
];

export const ELIXIR_BY_ID: Record<string, ElixirDef> = Object.fromEntries(ELIXIRS.map((e) => [e.id, e]));

/** Stan sklepu (serializowany w zapisie runu). `null` w `items` = sprzedane miejsce. */
export interface ShopState {
  /** Głębokość, dla której liczone są ceny i siła eliksirów (= następny poziom). */
  depth: number;
  items: (Item | null)[];
  elixirs: string[];
  /** Pozostały zapas usług i eliksirów (klucz: id usługi albo `elixir:<id>`). */
  stock: Record<string, number>;
  refreshes: number;
  /** Poziom rozbudowy sklepu (z runu; starsze zapisy go nie mają = 1). */
  level?: number;
  /** Narzut cen (relikwia Mapa pielgrzyma). */
  markup?: number;
}

/** Przedmioty sklepu: rozbudowa daje lepszą jakość i dodatkowe miejsca (poziom 3 i 5). */
export function rollShopItems(depth: number, luck: number, level: number): Item[] {
  const n = BAL.shopItems + (level >= 3 ? 1 : 0) + (level >= 5 ? 1 : 0);
  return Array.from({ length: n }, () => rollItem(depth, 'shop', luck + BAL.shopUpgrade.luck * (level - 1)));
}

/** Mnożnik cen z rabatu rozbudowy. */
const discount = (shop: ShopState) => (1 - BAL.shopUpgrade.discount * ((shop.level ?? 1) - 1)) * (shop.markup ?? 1);

/** Nowa oferta sklepu przed poziomem `depth`. */
export function rollShop(run: Run, depth: number): ShopState {
  const pool = [...ELIXIRS];
  const elixirs: string[] = [];
  while (elixirs.length < BAL.shopElixirs && pool.length) elixirs.push(pool.splice(Math.floor(rng.next() * pool.length), 1)[0].id);
  const stock: Record<string, number> = {};
  for (const s of SERVICES) stock[s.id] = BAL.shopStock[s.id];
  for (const e of elixirs) stock[`elixir:${e}`] = BAL.shopStock.elixir;
  return { depth, items: rollShopItems(depth, run.luck(), run.shopLevel), elixirs, stock, refreshes: 0, level: run.shopLevel, markup: run.relic('pilgrim') ? BAL.relics.shopMarkup : 1 };
}

export function itemPrice(it: Item, shop: ShopState): number {
  return Math.round(salvageValue(it) * BAL.shopItemMarkup * discount(shop));
}

export function servicePrice(shop: ShopState, id: ServiceId): number {
  return Math.round(BAL.shopPrice[id] * BAL.shopScale(shop.depth) * discount(shop));
}

/** Cena eliksiru rośnie z liczbą eliksirów kupionych w całym runie. */
export function elixirPrice(shop: ShopState, bought: number): number {
  return Math.round(BAL.shopPrice.elixir * BAL.shopScale(shop.depth) * Math.pow(BAL.elixirPriceGrowth, bought) * discount(shop));
}

/** Cena rozbudowy sklepu na następny poziom. */
export function shopUpgradePrice(shop: ShopState): number {
  const U = BAL.shopUpgrade;
  return Math.round(U.gold * Math.pow(U.growth, (shop.level ?? 1) - 1) * BAL.shopScale(shop.depth));
}

export function refreshPrice(shop: ShopState): number {
  // Mapa pielgrzyma: pierwsze odświeżenie w każdym sklepie za darmo.
  if ((shop.markup ?? 1) > 1 && shop.refreshes === 0) return 0;
  return Math.round(BAL.shopRefresh * BAL.shopScale(shop.depth) * Math.pow(2, shop.refreshes));
}

export function elixirLine(e: ElixirDef, depth: number): string {
  const v = e.value(depth);
  return e.desc.replace('{v}', e.pct ? `${Math.round(v * 100)}%` : String(Math.round(v)));
}
