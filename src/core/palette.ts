/**
 * Paleta 16-bit: ENDESGA 32 (32 kolory). Cała grafika i UI używają wyłącznie tych indeksów;
 * półprzezroczystość (cienie, poświaty) to mieszanie tych samych kolorów, jak "color math" na SNES-ie.
 */
export const PAL = [
  '#be4a2f', '#d77643', '#ead4aa', '#e4a672', '#b86f50', '#733e39', '#3e2731', '#a22633',
  '#e43b44', '#f77622', '#feae34', '#fee761', '#63c74d', '#3e8948', '#265c42', '#193c3e',
  '#124e89', '#0099db', '#2ce8f5', '#ffffff', '#c0cbdc', '#8b9bb4', '#5a6988', '#3a4466',
  '#262b44', '#181425', '#ff0044', '#68386c', '#b55088', '#f6757a', '#e8b796', '#c28569',
] as const;

/** Nazwane indeksy kolorów — czytelniejsze niż gołe liczby w kodzie. */
export const C = {
  rust: 0, clay: 1, cream: 2, tan: 3, brown: 4, dbrown: 5, ddbrown: 6, dred: 7,
  red: 8, orange: 9, gold: 10, yellow: 11, lime: 12, green: 13, dgreen: 14, teal: 15,
  dblue: 16, blue: 17, cyan: 18, white: 19, lgray: 20, lavender: 21, dgray: 22, slate: 23,
  navy: 24, black: 25, hotpink: 26, plum: 27, pink: 28, salmon: 29, peach: 30, skin: 31,
} as const;

/** Rampy cieniowania (od cienia do światła) — podstawa światłocienia sprite'ów. */
export const RAMP = {
  skin: [C.dbrown, C.skin, C.tan, C.peach],
  green: [C.teal, C.dgreen, C.green, C.lime],
  red: [C.ddbrown, C.dred, C.red, C.salmon],
  blue: [C.navy, C.dblue, C.blue, C.cyan],
  stone: [C.slate, C.dgray, C.lavender, C.lgray],
  purple: [C.black, C.plum, C.pink, C.salmon],
  wood: [C.ddbrown, C.dbrown, C.brown, C.clay],
  gold: [C.dbrown, C.orange, C.gold, C.yellow],
  fire: [C.dred, C.rust, C.orange, C.gold],
  bone: [C.lavender, C.lgray, C.cream, C.white],
  night: [C.black, C.navy, C.slate, C.dgray],
} as const;

export type Ramp = readonly number[];
