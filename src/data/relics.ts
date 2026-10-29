/**
 * Relikwie (0.42, R2): rzadkie nagrody za bossa aktu (Ekspedycja) i co drugiego bossa (Endless). Bez slotu, do końca runu,
 * najwyżej BAL.relics.max — przy limicie nowa relikwia wymienia jedną z posiadanych. Każda zmienia zasadę gry
 * i ma wyraźną wadę (`drawback`); efekty sprawdza Run.relic(id) w systemach. `mode`: tylko w danym trybie.
 */
export interface RelicDef {
  id: string;
  name: string;
  desc: string;
  drawback: string;
  icon: string;
  mode?: 'expedition';
}

export const RELICS: RelicDef[] = [
  { id: 'warhorn', name: 'War Horn', icon: 'ab_b_charge', desc: 'Breaking a situation within 15 s drops an elite chest.', drawback: 'Situations come twice as often.' },
  { id: 'hourglass', name: "Tyrant's Hourglass", icon: 'pi_hourglass', desc: 'Bosses start weakening after 45 s and up to triple damage taken.', drawback: 'Bosses deal 25% more damage.' },
  { id: 'huntmark', name: "Hunter's Mark", icon: 'ex_hunt', desc: 'Elites and minibosses take 40% more damage from you.', drawback: 'Regular enemies take 10% less.' },
  { id: 'prism', name: 'Prism Shard', icon: 'bp_gaze', mode: 'expedition', desc: 'Map weaknesses are stronger (x2.25 damage).', drawback: 'Map resistances are stronger too (x0.25 damage).' },
  { id: 'pilgrim', name: "Pilgrim's Map", icon: 'sh_scroll', mode: 'expedition', desc: 'Camps and shrines offer three choices. The first shop refresh is free.', drawback: 'Shops are 25% more expensive.' },
  { id: 'turncoat', name: 'Turncoat', icon: 'bp_crown', desc: 'Enemy commander auras and banners empower you instead (+25% damage and speed). Commanders and banners appear more often.', drawback: 'Elites with traits have +50% HP.' },
  { id: 'mace', name: "Commander's Mace", icon: 'ab_b_slam', desc: 'Killing an elite gives you a commander aura for 6 s (+25% damage and speed).', drawback: '-15% damage while the aura is off.' },
  { id: 'cloak', name: 'Shadow Cloak', icon: 'ab_m_shade', desc: 'After taking a hit you are invulnerable for 1 s (every 8 s).', drawback: '-25% max HP.' },
  { id: 'chalice', name: 'Blood Chalice', icon: 'mt_heart', desc: 'Breaking a situation or killing an elite heals 15% HP.', drawback: 'Meat, food and weapon healing no longer heal you.' },
];

export const RELIC_BY_ID: Record<string, RelicDef> = Object.fromEntries(RELICS.map((r) => [r.id, r]));
