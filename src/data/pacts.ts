import { C } from '../core/palette';

/**
 * Pakty ryzyka (jak Heat w Hadesie): utrudnienia włączane przed runem na ekranie wyboru bohatera (ui/pacts.ts).
 * Każdy poziom paktu to `per` dodane do flag silnika (lista flag w data/cards.ts) na cały run — liczone w Run.indexEffects.
 * Suma poziomów = poziom Paktu: mnoży esencję (BAL.pacts) i daje odznaki bohatera za pokonanego bossa.
 * Wybór zapisuje się w `save.pacts.chosen` (na kolejne runy) i w zapisie runu; najwyższy poziom z bossem w `save.pacts.best`.
 */
export interface PactDef {
  id: string;
  name: string;
  /** Opis z {v} = łączna wartość na bieżącym poziomie (w procentach). */
  desc: string;
  max: number;
  flags: Record<string, number>;
}

export const PACTS: PactDef[] = [
  { id: 'hp', name: 'Twardzi wrogowie', desc: 'Wrogowie mają +{v} HP.', max: 3, flags: { enemyHp: 0.15 } },
  { id: 'dmg', name: 'Bolesne ciosy', desc: 'Wrogowie zadają +{v} obrażeń.', max: 3, flags: { enemyDmg: 0.15 } },
  { id: 'horde', name: 'Hordy', desc: '+{v} wrogów naraz.', max: 2, flags: { enemyCount: 0.15 } },
  { id: 'bullets', name: 'Szybkie pociski', desc: 'Pociski wrogów lecą {v} szybciej.', max: 3, flags: { bulletSpeed: 0.12 } },
  { id: 'elites', name: 'Elity z cechami', desc: 'Elity mają dodatkową cechę i pojawiają się {v} częściej.', max: 2, flags: { eliteMods: 1, eliteRate: 0.2 } },
  { id: 'heal', name: 'Suche rany', desc: 'Leczenie słabsze o {v}.', max: 3, flags: { healCut: 0.2 } },
  { id: 'tasks', name: 'Pośpiech', desc: 'Czas na zadania krótszy o {v}.', max: 3, flags: { taskTime: 0.12 } },
  { id: 'boss', name: 'Gniew władcy', desc: 'Bossowie mają +{v} HP.', max: 3, flags: { bossHp: 0.3 } },
];

export const PACT_BY_ID: Record<string, PactDef> = Object.fromEntries(PACTS.map((p) => [p.id, p]));

/** Poziom Paktu (suma poziomów, tylko znane pakty). */
export function pactLevel(chosen: Record<string, number>): number {
  return PACTS.reduce((n, p) => n + Math.min(p.max, chosen[p.id] ?? 0), 0);
}

/** Opis paktu na danym poziomie (wartość pierwszej flagi w procentach). */
export function pactDesc(p: PactDef, level: number): string {
  const v = Object.values(p.flags)[p.id === 'elites' ? 1 : 0] * Math.max(1, level);
  return p.desc.replace('{v}', `${Math.round(v * 100)}%`);
}

/** Odznaki bohatera za najwyższy poziom Paktu z pokonanym bossem. */
/** Odznaki Paktu; każda odblokowuje skórkę bohatera (`skin`: rampa od cienia do światła, gfx/painter.ts recolor). */
export const PACT_BADGES: { id: string; from: number; name: string; color: number; skin: number[] }[] = [
  { id: 'bronze', from: 5, name: 'Brąz', color: C.clay, skin: [C.ddbrown, C.dbrown, C.brown, C.clay] },
  { id: 'silver', from: 10, name: 'Srebro', color: C.lgray, skin: [C.slate, C.dgray, C.lavender, C.lgray] },
  { id: 'gold', from: 15, name: 'Złoto', color: C.gold, skin: [C.dbrown, C.orange, C.gold, C.yellow] },
  { id: 'void', from: 20, name: 'Mistrz', color: C.hotpink, skin: [C.black, C.plum, C.hotpink, C.pink] },
];
export const BADGE_BY_ID = Object.fromEntries(PACT_BADGES.map((b) => [b.id, b]));

/** Skórki dostępne dla bohatera (odznaki zdobyte najwyższym Paktem z bossem). */
export const heroSkins = (best: number) => PACT_BADGES.filter((b) => best >= b.from);

export function pactBadge(best: number): { name: string; color: number } | null {
  return [...PACT_BADGES].reverse().find((b) => best >= b.from) ?? null;
}
