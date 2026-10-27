import { rng } from '../core/rng';
import { C } from '../core/palette';
import { BAL } from '../data/balance';
import { FORGE_STEPS, MATERIALS, MAT_BY_ID, SCROLLS, SCROLL_BY_ID, AWAKENINGS, type AwakenDef, type CraftDef, type ForgeStep, type MatId, type ScrollId } from '../data/forge';
import { upgradeItem, downgradeItem, addForgeAffix, empowerSuper, BASE_BY_ID, type Item } from '../data/items';
import type { Enemy } from '../entities/types';
import type { Run } from '../game/run';
import { anvilCost } from './anvil';

/**
 * Kuźnia runiczna (data/forge.ts): próby ulepszenia z szansą, materiały i zwoje w runie (`run.mats`, `run.scrolls`),
 * naprawa pękniętych przedmiotów i dropy materiałów (BAL.forge).
 */
export interface ForgeOpts {
  bless: boolean;
  dragon: boolean;
  talisman: boolean;
  /** Tryb ryzyka: wyższa szansa, ale pęknięcie niszczy przedmiot (i grozi już od +4). */
  risk: boolean;
}

export type ForgeOutcome = 'success' | 'fail' | 'down' | 'crack' | 'destroy';

/** Następny krok kucia przedmiotu (null = maks. poziom). */
export function nextStep(it: Item): ForgeStep | null {
  return FORGE_STEPS[it.upg ?? 0] ?? null;
}

/** Szansa próby z rozbiciem na składniki (do pokazania graczowi). */
export function forgeChance(it: Item, o: ForgeOpts): { base: number; pity: number; dragon: number; risk: number; total: number } {
  const F = BAL.forge, s = nextStep(it);
  const base = s?.chance ?? 0, pity = it.pity ?? 0, dragon = o.dragon ? F.dragon : 0, risk = o.risk ? F.risk : 0;
  return { base, pity, dragon, risk, total: Math.min(1, base + pity + dragon + risk) };
}

/** Szanse skutków porażki: spadek i pęknięcie (w trybie ryzyka zniszczenie) po zastosowaniu zwojów. */
export function failRisks(it: Item, o: ForgeOpts): { down: number; crack: number } {
  const s = nextStep(it);
  if (!s) return { down: 0, crack: 0 };
  const crack = o.talisman ? 0 : o.risk && (it.upg ?? 0) >= 3 ? Math.max(s.crack, 0.15) : s.crack;
  // Talizman zamienia pęknięcie w spadek, błogosławieństwo usuwa spadek.
  const down = o.bless ? 0 : Math.min(1 - crack, s.down + (o.talisman ? s.crack : 0));
  return { down, crack };
}

export function forgeGold(run: Run, it: Item): number {
  return anvilCost(run, 'upgrade', it).gold;
}

/** Powód, dla którego nie można kuć (null = można). */
export function forgeBlock(run: Run, it: Item, o: ForgeOpts): string | null {
  const s = nextStep(it);
  if (!s) return 'Maksymalny poziom +15';
  if (it.cracked) return 'Przedmiot pęknięty: najpierw napraw';
  if ((run.mats[s.mat] ?? 0) < s.count) return `Brak: ${MAT_BY_ID[s.mat].name} (${run.mats[s.mat] ?? 0}/${s.count})`;
  if (run.gold < forgeGold(run, it)) return 'Za mało złota';
  for (const id of ['bless', 'dragon', 'talisman'] as ScrollId[]) if (o[id] && (run.scrolls[id] ?? 0) <= 0) return `Brak: ${SCROLL_BY_ID[id].name}`;
  return null;
}

/** Usuwa przedmiot z ekwipunku i plecaka (zniszczenie w trybie ryzyka). */
function destroy(run: Run, it: Item): void {
  for (const s of Object.keys(run.equipment) as (keyof typeof run.equipment)[]) if (run.equipment[s] === it) run.equipment[s] = null;
  run.bag = run.bag.filter((b) => b !== it);
}

/** Próba kucia: zapłata (złoto, materiał, użyte zwoje), rzut, skutek i nagrody progów +3 / +12. */
export function forgeAttempt(run: Run, it: Item, o: ForgeOpts): { outcome: ForgeOutcome; note: string } {
  const s = nextStep(it)!, F = BAL.forge, gold = forgeGold(run, it);
  run.gold -= gold;
  run.mats[s.mat] -= s.count;
  for (const id of ['bless', 'dragon', 'talisman'] as ScrollId[]) if (o[id]) run.scrolls[id]--;
  it.spent = { gold: (it.spent?.gold ?? 0) + gold, shards: it.spent?.shards ?? 0 };
  const chance = forgeChance(it, o).total;
  let outcome: ForgeOutcome, note: string;
  if (rng.chance(chance)) {
    upgradeItem(it);
    it.pity = 0;
    const lvl = it.upg ?? 0;
    note = `Sukces! +${lvl}`;
    // Nagrody progów dawane raz (przy pierwszym osiągnięciu poziomu).
    if (lvl > (it.peak ?? 0)) {
      if (lvl === 3 && addForgeAffix(it)) note += ': Hartowanie, nowy bonus';
      if (lvl === 12) { empowerSuper(it); note += ': Runa mocy'; }
      if (lvl === 9) note += ': Przebudzenie!';
      if (lvl === 15) note += ': BOSKI przedmiot!';
      it.peak = lvl;
    }
    outcome = 'success';
  } else {
    it.pity = (it.pity ?? 0) + F.pity;
    const { down, crack } = failRisks(it, o), r = rng.next();
    if (r < crack && o.risk) { outcome = 'destroy'; note = `Zniszczony: ${it.name}`; destroy(run, it); }
    else if (r < crack) { outcome = 'crack'; note = 'Pęknięcie! Przedmiot osłabiony, napraw go'; it.cracked = true; }
    else if (r < crack + down) { outcome = 'down'; downgradeItem(it); note = `Porażka, spadek do +${it.upg ?? 0}`; }
    else { outcome = 'fail'; note = `Porażka (litość +${Math.round(F.pity * 100)}%)`; }
  }
  run.onBuildChanged();
  return { outcome, note };
}

/** Naprawa pękniętego przedmiotu: złoto i Ruda gwiezdna. */
export function repairCost(run: Run, it: Item): { gold: number; ore: number } {
  return { gold: Math.round(forgeGold(run, it) * BAL.forge.repairMul), ore: 1 };
}

export function repairItem(run: Run, it: Item): { ok: boolean; note: string } {
  const c = repairCost(run, it);
  if (!it.cracked) return { ok: false, note: 'Przedmiot nie jest pęknięty' };
  if (run.gold < c.gold || run.mats.ore < c.ore) return { ok: false, note: 'Za mało złota lub Rudy gwiezdnej' };
  run.gold -= c.gold;
  run.mats.ore -= c.ore;
  it.cracked = false;
  run.onBuildChanged();
  return { ok: true, note: 'Naprawiono' };
}

/** Materiał (albo zwój) do runu z napisem nad graczem. */
export function grantMat(run: Run, id: MatId, n = 1): void {
  run.mats[id] += n;
  run.popText(run.player.x, run.player.y - 20, `+${n} ${MAT_BY_ID[id].name}`, MAT_BY_ID[id].color);
}

export function grantScroll(run: Run, id: ScrollId = rng.pick(SCROLLS).id): void {
  run.scrolls[id]++;
  run.popText(run.player.x, run.player.y - 28, `+1 ${SCROLL_BY_ID[id].name}`, SCROLL_BY_ID[id].color);
}

/** Dropy kuźni z zabójstwa: kamienie ze zwykłych wrogów, ruda i zwoje z elit. Bossowie: forgeBossDrops. */
export function forgeKillDrops(run: Run, e: Enemy): void {
  const F = BAL.forge;
  if (e.elite) {
    grantMat(run, 'ore', rng.int(F.eliteOre[0], F.eliteOre[1]));
    if (rng.chance(F.scrollElite)) grantScroll(run);
  } else if (!e.boss && rng.chance(F.stoneChance)) grantMat(run, 'stone');
}

/** Boss: serca smoka, łzy (od BAL.forge.depthTear), iskry pustki (od depthVoid albo z Paktem pactVoid+), zwój. */
export function forgeBossDrops(run: Run): void {
  const F = BAL.forge;
  grantMat(run, 'heart', rng.int(F.bossHeart[0], F.bossHeart[1]));
  if (run.depth >= F.depthTear && rng.chance(F.tearChance)) grantMat(run, 'tear');
  if ((run.depth >= F.depthVoid || run.pactLevel >= F.pactVoid) && rng.chance(F.voidChance)) grantMat(run, 'void');
  if (rng.chance(F.scrollBoss)) grantScroll(run);
}

/** Przebudzenia założonych przedmiotów (+9; siła v = 2 od +15) — liczone w Run jak super-bonusy. */
export function equippedAwakenings(run: Run): { def: AwakenDef; v: number }[] {
  const out: { def: AwakenDef; v: number }[] = [];
  for (const it of Object.values(run.equipment)) {
    const lvl = it?.upg ?? 0;
    if (it && lvl >= 9 && !it.cracked) out.push({ def: AWAKENINGS[BASE_BY_ID[it.base].kind], v: lvl >= 15 ? 2 : 1 });
  }
  return out;
}

/** Puste zapasy kuźni (nowy run). */
export function emptyMats(): Record<MatId, number> {
  return Object.fromEntries(MATERIALS.map((m) => [m.id, 0])) as Record<MatId, number>;
}

export function emptyScrolls(): Record<ScrollId, number> {
  return Object.fromEntries(SCROLLS.map((s) => [s.id, 0])) as Record<ScrollId, number>;
}

/** Kolor wyniku kucia (napisy w kuźni). */
export const OUTCOME_COL: Record<ForgeOutcome, number> = { success: C.lime, fail: C.lgray, down: C.orange, crack: C.red, destroy: C.hotpink };

/** Warsztat: szansa przepisu (z poziomem kowadła) i koszt w złocie (× głębokość). */
export function craftChance(run: Run, c: CraftDef): number {
  return Math.min(1, c.chance + BAL.forge.craftPerAnvil * (run.anvilLevel - 1));
}

export function craftGold(run: Run, c: CraftDef): number {
  return Math.round(c.gold * BAL.shopScale(run.depth));
}

/** Czego brakuje do przepisu (null = można). */
export function craftBlock(run: Run, c: CraftDef): string | null {
  for (const [id, n] of Object.entries(c.need) as [MatId, number][]) if (run.mats[id] < n) return `Brak: ${MAT_BY_ID[id].name} (${run.mats[id]}/${n})`;
  if (run.shards < c.shards) return `Brak odłamków (${run.shards}/${c.shards})`;
  if (run.gold < craftGold(run, c)) return 'Za mało złota';
  return null;
}

/** Przetopienie: zapłata, rzut; porażka zwraca część składników (reszta przepada). */
export function craft(run: Run, c: CraftDef): { ok: boolean; note: string } {
  const block = craftBlock(run, c);
  if (block) return { ok: false, note: block };
  run.gold -= craftGold(run, c);
  run.shards -= c.shards;
  for (const [id, n] of Object.entries(c.need) as [MatId, number][]) run.mats[id] -= n;
  if (rng.chance(craftChance(run, c))) {
    run.mats[c.out]++;
    return { ok: true, note: `Wytopiono: ${MAT_BY_ID[c.out].name}` };
  }
  // Porażka: wraca (1 - craftLoss) składników, zaokrąglone w dół.
  for (const [id, n] of Object.entries(c.need) as [MatId, number][]) run.mats[id] += Math.floor(n * (1 - BAL.forge.craftLoss));
  return { ok: false, note: 'Przetapianie nieudane, część składników przepadła' };
}
