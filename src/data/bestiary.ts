import { BAL } from './balance';

/**
 * Bestiariusz: zabójstwa każdego rodzaju wroga liczone między runami (`save.bestiary`).
 * Próg `know` odsłania opis, `master` i `legend` dają stały bonus obrażeń przeciw temu wrogowi (BAL.bestiary).
 * Bossowie liczą się razem (id 'boss').
 */
export interface BestiaryEntry {
  id: string;
  /** Sprite do ikony (klatka 0). */
  sprite: string;
  lore: string;
  know: number;
  master: number;
  legend: number;
}

const E = (id: string, sprite: string, lore: string, know = 25, master = 250, legend = 1000): BestiaryEntry => ({ id, sprite, lore, know, master, legend });

export const BESTIARY: BestiaryEntry[] = [
  E('slime', 'slime', 'Galaretowaty żarłok. Sam groźny nie jest, ale nigdy nie chodzi sam.'),
  E('bat', 'bat', 'Szybki i nerwowy. Lata zakosami, więc łatwo go przeoczyć w tłumie.'),
  E('golem', 'golem', 'Kamienny strażnik. Powolny, prawie nie da się go odepchnąć, uderza mocno.'),
  E('eye', 'eye', 'Pływające oko strzela z daleka. Trzyma dystans, dopóki go nie dopadniesz.'),
  E('wisp', 'wisp', 'Błędny ognik. Krąży wokół ofiary i pluje płomieniami.'),
  E('spinner', 'spinner', 'Wirujący pancerz. Rozsiewa pociski we wszystkie strony.'),
  E('cultist', 'cultist', 'Kultysta Pustki. Rzuca serie kul i chowa się za innymi.'),
  E('sentinel', 'sentinel', 'Wartownik starożytnych. Gruby pancerz i salwy pocisków.'),
  E('shieldbearer', 'shieldbearer', 'Tarczownik blokuje pociski z przodu. Zajdź go z boku albo od tyłu.'),
  E('summoner', 'summoner', 'Przywoływacz trzyma się z tyłu i wzywa sługi. Zabij go pierwszego.'),
  E('kamikaze', 'kamikaze', 'Żywa bomba. Gdy się zbliży, zapala lont i wybucha po chwili.'),
  E('blinker', 'blinker', 'Skoczek znika i pojawia się obok ciebie. Nie stój długo w miejscu.'),
  E('weaver', 'weaver', 'Pajęczarz rozsnuwa sieci, które spowalniają. Omijaj lepkie kręgi.'),
  E('boar', 'boar', 'Wild boar of the dark meadow. It paws the ground and shows where it will charge: step aside.'),
  E('thornling', 'thornling', 'A walking bush that throws thorny seeds. Leave the marked circles before they land.'),
  E('toad', 'toad', 'A heavy swamp toad. Its shadow shows where it lands, and the landing throws a ring of slime.'),
  E('lurker', 'lurker', 'The drowner hides under the mud, where nothing can hit it. Ripples show where it will surface.'),
  E('salamander', 'salamander', 'A fire lizard. It shows a cone before it breathes flame: get out of the cone or behind it.'),
  E('scorpion', 'scorpion', 'A desert sniper. A thin line shows where its sting will fly a moment later.'),
  E('splitter', 'splitter', 'A void creature that splits in two when killed. Area attacks deal with the pieces best.'),
  E('mirror', 'mirror', 'Your reflection circles you and slices across your path. Watch the line and step out of it.'),
  E('boarking', 'boarking', "The lord of the meadow herd. It charges again and again, stamps out waves and calls its boars.", 2, 15, 40),
  E('toadqueen', 'toadqueen', "Mother of the swamp toads. A red ring shows where she lands, and acid rains from the sky.", 2, 15, 40),
  E('sandtyrant', 'sandtyrant', "The oldest scorpion of the wastes. Three sniper shots in a row, then stings fall from the sky.", 2, 15, 40),
  E('shatterknight', 'shatterknight', "A knight trapped in a broken mirror. It slices across your path three times and calls its reflections.", 2, 15, 40),
  E('voidprism', 'voidprism', "A crystal of the Void. It jumps through space and breaks into two Splitters when it dies.", 2, 15, 40),
  E('mimic', 'mimic', 'Skrzynia z zębami. Nie każdy skarb chce zostać otwarty.', 3, 15, 40),
  E('stag', 'stag', 'Biały jeleń ucieka, gdy tylko cię zobaczy. Złapany prowadzi do ukrytego gaju.', 2, 10, 30),
  E('goldslime', 'goldslime', 'Złoty szlam pełen monet. Ucieka, więc trzeba go dogonić.', 3, 20, 60),
  E('boss', 'boss0', 'Władcy biomów: Otchłani, Bagien, Pustkowia i Pustki. Każdy walczy inaczej.', 1, 10, 40),
];

export const BESTIARY_BY_ID: Record<string, BestiaryEntry> = Object.fromEntries(BESTIARY.map((b) => [b.id, b]));

/** Mnożnik obrażeń przeciw wrogowi z bestiariusza (progi master i legend). */
export function loreBonus(b: BestiaryEntry, kills: number): number {
  return kills >= b.legend ? BAL.bestiary.legend : kills >= b.master ? BAL.bestiary.master : 0;
}

/** Mnożniki dla Run.lore z zapisanych zabójstw. */
export function loreMuls(kills: Record<string, number>): Record<string, number> {
  return Object.fromEntries(BESTIARY.map((b) => [b.id, 1 + loreBonus(b, kills[b.id] ?? 0)]));
}
