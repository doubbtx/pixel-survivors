/**
 * Skład fal w czasie: od sekundy `from` spawner losuje wrogów z `mix` (id, waga).
 * Aktywny jest ostatni wpis, którego `from` ≤ czas.
 * Bullet hell w stylu ROTMG: strzelcy pojawiają się wcześnie i stanowią główne zagrożenie,
 * a tłum wręcz zmusza do ruchu między salwami.
 */
export const WAVES: { from: number; mix: [string, number][] }[] = [
  { from: 0, mix: [['slime', 1]] },
  { from: 20, mix: [['slime', 4], ['bat', 1], ['eye', 1]] },
  { from: 45, mix: [['slime', 3], ['bat', 2], ['eye', 1.5], ['wisp', 1]] },
  { from: 80, mix: [['slime', 3], ['bat', 2], ['eye', 1.5], ['wisp', 1], ['cultist', 1]] },
  { from: 100, mix: [['slime', 3], ['bat', 2], ['eye', 1.5], ['wisp', 1], ['cultist', 1], ['kamikaze', 0.6], ['blinker', 0.5]] },
  { from: 120, mix: [['slime', 2], ['bat', 3], ['golem', 1], ['eye', 1.5], ['wisp', 1], ['cultist', 1.2], ['sentinel', 0.15], ['kamikaze', 0.8], ['blinker', 0.6]] },
  { from: 170, mix: [['slime', 2], ['bat', 3], ['golem', 2], ['eye', 1.5], ['wisp', 1], ['cultist', 1.2], ['spinner', 0.2], ['sentinel', 0.25], ['kamikaze', 1.4], ['blinker', 1], ['shieldbearer', 0.6], ['weaver', 0.5]] },
  { from: 230, mix: [['bat', 3], ['golem', 3], ['eye', 2], ['wisp', 2], ['cultist', 1.5], ['spinner', 0.3], ['sentinel', 0.3], ['kamikaze', 2], ['blinker', 1.5], ['shieldbearer', 0.8], ['weaver', 0.7], ['summoner', 0.3]] },
  // Późna gra: coraz więcej strzelców.
  { from: 330, mix: [['bat', 2], ['golem', 2.5], ['eye', 3], ['wisp', 2.5], ['cultist', 2.5], ['spinner', 0.5], ['sentinel', 0.5], ['kamikaze', 2.6], ['blinker', 2.2], ['shieldbearer', 1], ['weaver', 0.9], ['summoner', 0.4]] },
  { from: 460, mix: [['bat', 2], ['golem', 2], ['eye', 3], ['wisp', 3], ['cultist', 3], ['spinner', 0.8], ['sentinel', 0.8], ['kamikaze', 3.2], ['blinker', 2.6], ['shieldbearer', 1.2], ['weaver', 1.1], ['summoner', 0.5]] },
];

/**
 * Wrogowie biomów (0.30): dokładani do zwykłego składu fal (spawner currentMix) od sekundy `from` w danym biomie
 * (indeks jak w data/levels.ts BIOMES; 4 = sekretna Pustka ma ich mieszankę od początku).
 */
export const BIOME_WAVES: Record<number, { from: number; mix: [string, number][] }[]> = {
  0: [{ from: 35, mix: [['boar', 0.9]] }, { from: 95, mix: [['boar', 1.4], ['thornling', 1]] }],
  1: [{ from: 30, mix: [['toad', 1.1]] }, { from: 90, mix: [['toad', 1.4], ['lurker', 1]] }],
  2: [{ from: 35, mix: [['salamander', 1.1]] }, { from: 95, mix: [['salamander', 1.4], ['scorpion', 1]] }],
  3: [{ from: 30, mix: [['splitter', 1.1]] }, { from: 90, mix: [['splitter', 1.4], ['mirror', 1]] }],
  4: [{ from: 0, mix: [['splitter', 1], ['mirror', 1], ['scorpion', 0.7], ['lurker', 0.7]] }],
};

/** Zdarzenia specjalne: pierścień wrogów zamykający się wokół gracza. */
export const EVENTS: { at: number; enemy: string; count: number }[] = [
  { at: 90, enemy: 'slime', count: 36 },
  { at: 150, enemy: 'bat', count: 48 },
  { at: 210, enemy: 'golem', count: 24 },
  { at: 270, enemy: 'bat', count: 64 },
  // 0.49: dalej co ~60 s pierścień szybkich wrogów (stanie w miejscu z bronią dystansową przestaje wystarczać).
  { at: 330, enemy: 'kamikaze', count: 20 },
  { at: 390, enemy: 'bat', count: 80 },
  { at: 450, enemy: 'kamikaze', count: 28 },
  { at: 510, enemy: 'bat', count: 96 },
  { at: 570, enemy: 'kamikaze', count: 36 },
];
