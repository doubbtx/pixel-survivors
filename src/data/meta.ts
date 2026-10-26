import type { Stats } from '../entities/types';
import { BAL } from './balance';

/**
 * Meta-progresja (między runami): esencja zdobywana na końcu każdego runu (także po śmierci)
 * kupuje poziomy węzłów drzewka rozwoju. Do tego Paragon (poziom konta z całej zdobytej esencji,
 * bez limitu) i prestiż (reset drzewka za stały bonus).
 *
 * Nowy węzeł = wpis w META_NODES (gałąź, kolejność w gałęzi = wymagania: węzeł wymaga poprzedniego
 * w tej samej gałęzi na poziomie 1+). Efekt: dodatek do statystyki, mnożnik, flaga albo zasób na start runu.
 */
export type MetaBranch = 'Siła' | 'Przetrwanie' | 'Fortuna' | 'Taktyka';
export const BRANCHES: MetaBranch[] = ['Siła', 'Przetrwanie', 'Fortuna', 'Taktyka'];

/** Zasoby dodawane na start nowego runu. */
export type StartRes = 'gold' | 'shards' | 'rerolls' | 'skips' | 'banishes' | 'cardRerolls';

export type MetaEffect =
  | { kind: 'stat'; stat: keyof Stats; per: number }
  | { kind: 'mul'; stat: keyof Stats; per: number }
  | { kind: 'flag'; flag: string; per: number }
  | { kind: 'start'; res: StartRes; per: number }
  | { kind: 'essence'; per: number };

export interface MetaNode {
  id: string;
  branch: MetaBranch;
  name: string;
  /** Opis z {v} = łączna wartość na danym poziomie. */
  desc: string;
  icon: string;
  max: number;
  /** Koszt pierwszego poziomu; każdy kolejny × BAL.meta.costGrowth. */
  cost: number;
  effect: MetaEffect;
  pct: boolean;
}

const N = (id: string, branch: MetaBranch, name: string, icon: string, max: number, cost: number, effect: MetaEffect, desc: string, pct: boolean): MetaNode =>
  ({ id, branch, name, icon, max, cost, effect, desc, pct });

export const META_NODES: MetaNode[] = [
  N('m_might', 'Siła', 'Ostrze', 'pi_might', 5, 20, { kind: 'stat', stat: 'might', per: 0.04 }, '+{v} obrażeń', true),
  N('m_crit', 'Siła', 'Precyzja', 'pi_crit', 5, 25, { kind: 'stat', stat: 'crit', per: 0.02 }, '+{v} szansy na krytyk', true),
  N('m_fury', 'Siła', 'Furia', 'pi_fury', 5, 30, { kind: 'stat', stat: 'atkSpeed', per: 0.04 }, '+{v} szybkości ataku', true),
  N('m_slaughter', 'Siła', 'Rzeź', 'ic_axe_evo', 5, 35, { kind: 'stat', stat: 'critMult', per: 0.1 }, '+{v} obrażeń krytycznych', true),
  N('m_amount', 'Siła', 'Mnogość', 'pi_dup', 1, 400, { kind: 'stat', stat: 'amount', per: 1 }, '+{v} pocisk dla każdej broni', false),

  N('m_hp', 'Przetrwanie', 'Witalność', 'pi_heart', 5, 20, { kind: 'mul', stat: 'maxHp', per: 0.05 }, '+{v} maks. HP', true),
  N('m_armor', 'Przetrwanie', 'Skóra', 'pi_armor', 5, 25, { kind: 'stat', stat: 'armor', per: 1 }, '+{v} pancerza', false),
  N('m_regen', 'Przetrwanie', 'Odnowa', 'pi_herb', 5, 30, { kind: 'stat', stat: 'regen', per: 0.2 }, '+{v} HP na sekundę', false),
  N('m_leech', 'Przetrwanie', 'Wampir', 'pi_fang', 5, 35, { kind: 'stat', stat: 'lifesteal', per: 0.005 }, '+{v} leczenia z obrażeń', true),
  N('m_ward', 'Przetrwanie', 'Ochrona', 'tag:Tarcze', 5, 45, { kind: 'flag', flag: 'dmgTaken', per: 0.03 }, '-{v} otrzymywanych obrażeń', true),

  N('m_gold', 'Fortuna', 'Sakiewka', 'coin', 5, 15, { kind: 'start', res: 'gold', per: 25 }, '+{v} złota na start runu', false),
  N('m_xp', 'Fortuna', 'Mądrość', 'gem0', 5, 20, { kind: 'stat', stat: 'growth', per: 0.05 }, '+{v} doświadczenia', true),
  N('m_greed', 'Fortuna', 'Chciwość', 'cd_gold', 5, 25, { kind: 'stat', stat: 'greed', per: 0.1 }, '+{v} złota', true),
  N('m_shards', 'Fortuna', 'Kowal', 'sh_shard', 5, 30, { kind: 'start', res: 'shards', per: 3 }, '+{v} odłamków na start runu', false),
  N('m_luck', 'Fortuna', 'Szczęście', 'pi_clover', 5, 35, { kind: 'flag', flag: 'itemLuck', per: 0.1 }, '+{v} szansy na lepsze przedmioty', true),

  N('m_reroll', 'Taktyka', 'Plan B', 'sh_dice', 3, 30, { kind: 'start', res: 'rerolls', per: 1 }, '+{v} losowania przy awansie', false),
  N('m_skip', 'Taktyka', 'Wybredność', 'ab_k_roll', 3, 25, { kind: 'start', res: 'skips', per: 1 }, '+{v} pominięcia przy awansie', false),
  N('m_banish', 'Taktyka', 'Wygnaniec', 'sh_scroll', 3, 30, { kind: 'start', res: 'banishes', per: 1 }, '+{v} wygnania przy awansie', false),
  N('m_cards', 'Taktyka', 'Talia', 'sh_card', 3, 40, { kind: 'start', res: 'cardRerolls', per: 1 }, '+{v} losowania karty', false),
  N('m_legacy', 'Taktyka', 'Dziedzictwo', 'syn_all', 5, 50, { kind: 'essence', per: 0.1 }, '+{v} esencji z runów', true),
];

export const META_BY_ID: Record<string, MetaNode> = Object.fromEntries(META_NODES.map((n) => [n.id, n]));

/** Stan meta-progresji w zapisie (core/save.ts). */
export interface MetaState {
  essence: number;
  /** Cała esencja zdobyta od początku (Paragon; prestiż jej nie zeruje). */
  total: number;
  nodes: Record<string, number>;
  prestige: number;
}

export function nodeCost(n: MetaNode, level: number): number {
  return Math.round(n.cost * Math.pow(BAL.meta.costGrowth, level));
}

/** Węzeł wymaga poprzedniego w swojej gałęzi na poziomie 1+. */
export function nodeUnlocked(m: MetaState, n: MetaNode): boolean {
  const branch = META_NODES.filter((x) => x.branch === n.branch);
  const i = branch.indexOf(n);
  return i === 0 || (m.nodes[branch[i - 1].id] ?? 0) > 0;
}

export function nodeLine(n: MetaNode, level: number): string {
  const v = n.effect.per * Math.max(1, level);
  return n.desc.replace('{v}', n.pct ? `${Math.round(v * 1000) / 10}%` : String(Math.round(v * 10) / 10));
}

/** Poziom Paragonu z całej zdobytej esencji (rośnie bez limitu, coraz wolniej). */
export function paragonLevel(total: number): number {
  return Math.floor(Math.sqrt(total / BAL.meta.paragonDiv));
}

/** Esencja wydana w drzewku (warunek prestiżu). */
export function spentEssence(m: MetaState): number {
  let s = 0;
  for (const n of META_NODES) for (let l = 0; l < (m.nodes[n.id] ?? 0); l++) s += nodeCost(n, l);
  return s;
}

/** Zbiorcze efekty meta dla runu: statystyki, mnożniki, flagi i zasoby startowe. */
export interface MetaBonus {
  stats: Partial<Stats>;
  mul: Partial<Stats>;
  flags: Record<string, number>;
  start: Partial<Record<StartRes, number>>;
  essenceMul: number;
}

export function metaBonus(m: MetaState): MetaBonus {
  const b: MetaBonus = { stats: {}, mul: {}, flags: {}, start: {}, essenceMul: 1 + BAL.meta.prestigeEssence * m.prestige };
  for (const n of META_NODES) {
    const lvl = m.nodes[n.id] ?? 0;
    if (!lvl) continue;
    const v = n.effect.per * lvl, e = n.effect;
    if (e.kind === 'stat') b.stats[e.stat] = (b.stats[e.stat] ?? 0) + v;
    else if (e.kind === 'mul') b.mul[e.stat] = (b.mul[e.stat] ?? 1) * (1 + v);
    else if (e.kind === 'flag') b.flags[e.flag] = (b.flags[e.flag] ?? 0) + v;
    else if (e.kind === 'start') b.start[e.res] = (b.start[e.res] ?? 0) + v;
    else b.essenceMul += v;
  }
  // Paragon i prestiż: procent obrażeń i maks. HP.
  const pct = BAL.meta.paragonPct * paragonLevel(m.total) + BAL.meta.prestigePct * m.prestige;
  b.stats.might = (b.stats.might ?? 0) + pct;
  b.mul.maxHp = (b.mul.maxHp ?? 1) * (1 + pct);
  return b;
}

/** Esencja za run: głębokość, czas, zabójstwa, poziom postaci (× mnożnik z drzewka i prestiżu). */
export function runEssence(r: { depth: number; totalTime: number; kills: number; level: number }, mul: number): number {
  const M = BAL.meta;
  return Math.round((r.depth * M.essencePerDepth + r.totalTime / M.essenceSecDiv + r.kills / M.essenceKillDiv + r.level * M.essencePerLevel) * mul);
}
