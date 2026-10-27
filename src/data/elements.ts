import { C } from '../core/palette';
import { WEAPONS } from './weapons';

/**
 * Żywioły: trafienie bronią (albo efektem) z żywiołem nakłada stan na wroga (systems/enemies.ts, game/run.ts damageEnemy).
 *  fire       podpalenie — obrażenia co pół sekundy przez 3 s (30% trafienia na sekundę)
 *  ice        spowolnienie 30%; co 5. trafienie zamraża na 1 s (boss krócej)
 *  lightning  porażenie — wróg otrzymuje +20% obrażeń ze wszystkich źródeł przez 3 s
 *  poison     trucizna — do 10 warstw, każda 6% trafienia na sekundę, przez 4 s
 * Siłę stanów zwiększa statystyka `elemPower` (siła żywiołów).
 * Nowa broń z żywiołem = wpis w WEAPON_ELEMENT (id broni, także ewolucji); efekty kart — w EXTRA_SOURCES (nazwa źródła).
 */
export type Element = 'fire' | 'ice' | 'lightning' | 'poison';

export const ELEMENTS: Record<Element, { name: string; color: number; desc: string }> = {
  fire: { name: 'Ogień', color: C.orange, desc: 'podpala' },
  ice: { name: 'Lód', color: C.cyan, desc: 'spowalnia i zamraża' },
  lightning: { name: 'Błyskawica', color: C.yellow, desc: 'wróg dostaje +20% obrażeń' },
  poison: { name: 'Trucizna', color: C.lime, desc: 'kumulująca się trucizna' },
};

export const WEAPON_ELEMENT: Record<string, Element> = {
  bolt: 'ice', bolt_evo: 'ice', aura: 'ice', aura_evo: 'ice',
  chain: 'lightning', chain_evo: 'lightning', laser: 'lightning', laser_evo: 'lightning',
  meteor: 'fire', meteor_evo: 'fire', mines: 'fire', mines_evo: 'fire',
  orbit: 'poison', orbit_evo: 'poison',
  staff: 'fire', staff_evo: 'fire',
};

/** Źródła obrażeń spoza broni z żywiołem (karty, synergie, umiejętności). */
const EXTRA_SOURCES: Record<string, Element> = {
  'Iskra': 'fire', 'Płonący ślad': 'fire', 'Synergia: Ogień': 'fire', 'Ognista dusza': 'fire', 'Wybuchowe zgony': 'fire',
  'Gniew burzy': 'lightning', 'Krytyczna masa': 'lightning',
  'Sieć': 'ice', 'Lodowa sieć': 'ice',
  'Kula ognia': 'fire', 'Słońce': 'fire', 'Pierścień ognia': 'fire', 'Płomienna bariera': 'fire', 'Inferno': 'fire', 'Kataklizm': 'fire',
};

/** Żywioł źródła obrażeń po nazwie (bronie zapisują obrażenia pod swoją nazwą). */
export const SRC_ELEMENT: Record<string, Element> = {
  ...Object.fromEntries(WEAPONS.filter((w) => WEAPON_ELEMENT[w.id]).map((w) => [w.name, WEAPON_ELEMENT[w.id]])),
  ...EXTRA_SOURCES,
};

/** Parametry stanów (wartości bazowe; × (1 + siła żywiołów) tam, gdzie to obrażenia lub spowolnienie). */
export const ELEM = {
  burnTime: 3, burnRatio: 0.3,
  chillTime: 2, chillSlow: 0.3, chillMaxSlow: 0.6, freezeStacks: 5, freezeTime: 1,
  shockTime: 3, shockMul: 1.2,
  poisonTime: 4, poisonRatio: 0.06, poisonMaxStacks: 10,
  /** Odstęp obrażeń od podpalenia i trucizny (s). */
  dotTick: 0.5,
};
