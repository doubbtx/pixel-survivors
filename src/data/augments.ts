import { WEAPONS, WEAPON_BY_ID, fusionOf, type WeaponDef } from './weapons';
import type { Element } from './elements';

/**
 * Augmenty broni: osobny typ opcji przy awansie (systems/levelup.ts), który zmienia działanie konkretnej broni,
 * a nie tylko jej liczby. Dotyczą broni bazowej, jej ewolucji i hybryd z fuzji (augmentWorks). Efekty czyta silnik: pociski (systems/weapons.ts
 * fireProjectile + systems/projectiles.ts), strefy (systems/zones.ts), wzorce broni (systems/weapons.ts)
 * i `elem` — żywioł nadany obrażeniom broni (Run.augElem).
 */
export interface AugmentDef {
  id: string;
  /** Id broni bazowej. */
  weapon: string;
  name: string;
  desc: string;
  elem?: Element;
}

export const AUGMENTS: AugmentDef[] = [
  { id: 'bolt_seek', weapon: 'bolt', name: 'Rykoszet', desc: 'Po trafieniu pocisk skacze do najbliższego innego wroga (2 razy).' },
  { id: 'bolt_split', weapon: 'bolt', name: 'Rozprysk', desc: 'Trafienie wypuszcza 2 odłamki na boki (40% obrażeń).' },
  { id: 'arrow_fire', weapon: 'arrow', name: 'Płonące groty', desc: 'Strzały podpalają wrogów.', elem: 'fire' },
  { id: 'arrow_split', weapon: 'arrow', name: 'Rozszczepienie', desc: 'Strzała, która wyczerpie przebicia, rozpada się na 3 mniejsze (50% obrażeń).' },
  { id: 'orbit_grow', weapon: 'orbit', name: 'Żarłoczne ostrza', desc: 'Każde zabójstwo ostrzem powiększa orbitę o 3% (do +60% na poziomie).' },
  { id: 'orbit_fling', weapon: 'orbit', name: 'Ciskane ostrza', desc: 'Co 3 s każde ostrze wystrzeliwuje ostrze na zewnątrz (60% obrażeń, przebija 2 wrogów).' },
  { id: 'aura_pulse', weapon: 'aura', name: 'Puls', desc: 'Co 4. tick aura wypuszcza falę, która mocno odpycha wrogów (150% obrażeń).' },
  { id: 'aura_drain', weapon: 'aura', name: 'Wysysanie', desc: 'Aura leczy 0.2% maks. HP za każdego trafionego wroga (do 1% na tick).' },
  { id: 'chain_burst', weapon: 'chain', name: 'Przeładowany łańcuch', desc: 'Ostatni cel każdego łańcucha wybucha (60% obrażeń).' },
  { id: 'chain_stun', weapon: 'chain', name: 'Paraliż', desc: 'Każde trafienie piorunem ogłusza wroga na 0.3 s.' },
  { id: 'meteor_crater', weapon: 'meteor', name: 'Krater', desc: 'Meteor zostawia płonącą ziemię na 3 s.' },
  { id: 'meteor_shards', weapon: 'meteor', name: 'Odłamki skał', desc: 'Wybuch meteoru rozrzuca 5 odłamków (30% obrażeń).' },
  { id: 'boom_return', weapon: 'boomerang', name: 'Powrót', desc: 'W drodze powrotnej bumerang zadaje podwójne obrażenia.' },
  { id: 'boom_frost', weapon: 'boomerang', name: 'Lodowy bumerang', desc: 'Bumerang spowalnia i zamraża wrogów (lód).', elem: 'ice' },
  { id: 'laser_prism', weapon: 'laser', name: 'Rozszczepienie światła', desc: 'Każdy promień tworzy 2 krótsze promienie pod kątem (50% obrażeń).' },
  { id: 'laser_burn', weapon: 'laser', name: 'Żar', desc: 'Promień podpala zamiast porażać (ogień).', elem: 'fire' },
  { id: 'mine_magnet', weapon: 'mines', name: 'Magnetyczne miny', desc: 'Uzbrojone miny suną do najbliższego wroga.' },
  { id: 'mine_cluster', weapon: 'mines', name: 'Miny kasetowe', desc: 'Wybuch zostawia 3 mniejsze miny (40% obrażeń).' },
  { id: 'axe_wave', weapon: 'axe', name: 'Fala ostrza', desc: 'Każde cięcie wypuszcza szeroką falę, która przelatuje przez wszystkich wrogów i osłony (70% obrażeń).' },
  { id: 'axe_blood', weapon: 'axe', name: 'Krwawe cięcie', desc: 'Cięcie leczy 0.5 HP za każdego trafionego wroga (do 5 HP).' },
  { id: 'staff_blast', weapon: 'staff', name: 'Wybuchowe kule', desc: 'Kula ognia wybucha przy trafieniu (50% obrażeń).' },
  { id: 'staff_seek', weapon: 'staff', name: 'Wędrujący płomień', desc: 'Po trafieniu kula leci do najbliższego innego wroga (2 razy).' },
  { id: 'souls_seek', weapon: 'souls', name: 'Wędrujące dusze', desc: 'Po trafieniu dusza leci do kolejnego wroga (2 razy).' },
  { id: 'souls_raise', weapon: 'souls', name: 'Żniwo', desc: 'Wróg zabity duszą ma 10% szans powstać jako duch-sługa.' },
  { id: 'knives_seek', weapon: 'knives', name: 'Rykoszet ostrzy', desc: 'Po trafieniu nóż odbija się do kolejnego wroga (2 razy).' },
  { id: 'knives_poison', weapon: 'knives', name: 'Zatrute ostrza', desc: 'Noże zatruwają wrogów.', elem: 'poison' },
  { id: 'light_shock', weapon: 'light', name: 'Gniew niebios', desc: 'Światło poraża wrogów (więcej obrażeń ze wszystkich źródeł).', elem: 'lightning' },
  { id: 'light_mend', weapon: 'light', name: 'Kojące światło', desc: 'Każdy trafiony wróg leczy cię o 0.1% maks. HP (do 1% na wyładowanie).' },
];

export const AUGMENT_BY_ID: Record<string, AugmentDef> = Object.fromEntries(AUGMENTS.map((a) => [a.id, a]));

/** Id broni bazowej (ewolucja → broń, z której powstała). */
export function weaponBase(def: WeaponDef): string {
  return def.evolved ? WEAPONS.find((w) => w.evolve?.into === def.id)?.id ?? def.id : def.id;
}

/** Bronie bazowe, z których broń się wywodzi: hybryda z fuzji = obaj rodzice, inaczej broń bazowa. */
export function weaponLines(def: WeaponDef): string[] {
  const f = def.fused ? fusionOf(def.id) : undefined;
  return f ? [f.a, f.b] : [weaponBase(def)];
}

/**
 * Czy augment działa na broni: należy do jej linii; na hybrydzie żywioł działa zawsze, a zmiana ataku
 * tylko wtedy, gdy rodzic ma ten sam typ ataku co hybryda (np. cięcia topora w Mroźnym wirze).
 */
export function augmentWorks(a: AugmentDef, def: WeaponDef): boolean {
  return weaponLines(def).includes(a.weapon) && (!def.fused || !!a.elem || WEAPON_BY_ID[a.weapon].kind === def.kind);
}

/** Augmenty rodziców hybrydy: te, które w niej działają, i te, które przepadają (inny typ ataku). */
export function fusionAugments(def: WeaponDef): { kept: AugmentDef[]; lost: AugmentDef[] } {
  const lines = weaponLines(def), all = AUGMENTS.filter((a) => lines.includes(a.weapon));
  return { kept: all.filter((a) => augmentWorks(a, def)), lost: all.filter((a) => !augmentWorks(a, def)) };
}

/** Zasady fuzji (opis w Arsenale, ekranie broni i przy awansie). */
export const FUSION_RULES = 'Kolejność broni nie ma znaczenia, a hybryda ma zawsze te same statystyki, także bez ewolucji rodziców. Zastępuje obie bronie własnym atakiem i zwalnia slot. Bonusy jakości obu broni się sumują.';
