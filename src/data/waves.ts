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
  { from: 120, mix: [['slime', 2], ['bat', 3], ['golem', 1], ['eye', 1.5], ['wisp', 1], ['cultist', 1.2], ['sentinel', 0.15]] },
  { from: 170, mix: [['slime', 2], ['bat', 3], ['golem', 2], ['eye', 1.5], ['wisp', 1], ['cultist', 1.2], ['spinner', 0.2], ['sentinel', 0.25]] },
  { from: 230, mix: [['bat', 3], ['golem', 3], ['eye', 2], ['wisp', 2], ['cultist', 1.5], ['spinner', 0.3], ['sentinel', 0.3]] },
];

/** Zdarzenia specjalne: pierścień wrogów zamykający się wokół gracza. */
export const EVENTS: { at: number; enemy: string; count: number }[] = [
  { at: 90, enemy: 'slime', count: 36 },
  { at: 150, enemy: 'bat', count: 48 },
  { at: 210, enemy: 'golem', count: 24 },
  { at: 270, enemy: 'bat', count: 64 },
];
