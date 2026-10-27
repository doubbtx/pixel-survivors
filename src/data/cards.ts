import { C } from '../core/palette';
import { rng } from '../core/rng';
import { BAL } from './balance';
import type { Enemy, Stats } from '../entities/types';
import type { AbilitySlot } from './heroes';
import type { Run } from '../game/run';
import { castAbility } from '../systems/abilities';
import { spawnTurret } from '../systems/turrets';

/**
 * Karty (augmenty): rzadsze i mocniejsze wybory niż level up.
 * Nowa karta = nowy wpis w CARDS. Efekt to dowolne połączenie:
 *  - stats  — dodatki do statystyk (× liczba stosów),
 *  - mul    — mnożniki statystyk (^ liczba stosów),
 *  - flags  — przełączniki mechanik czytane przez systemy (lista niżej),
 *  - hooks  — funkcje wywoływane przy zdarzeniach (onHit, onKill, onAbilityCast, onDash,
 *             onDamageTaken, onLevelUp, onTick).
 *
 * Flagi obsługiwane przez silnik:
 *  bounce          odbicia pocisków od krawędzi ekranu
 *  overhealShield  nadmiar leczenia → tarcza (maks. ułamek HP)
 *  noHeal          blokada leczenia
 *  momentum        +obrażenia równe bonusowi szybkości × wartość
 *  ultGain         szybsze ładowanie ultimate
 *  enemyHp         +% HP wrogów
 *  dmgTaken        redukcja otrzymywanych obrażeń
 *  revive          odrodzenia na poziom
 *  overcrit        szansa krytyczna >100% daje podwójny krytyk
 *  meatHeal        mocniejsze leczenie z mięsa
 *  turretRate      szybsze strzelanie wieżyczek
 *  cd.q / cd.e / cd.dash        skrócenie odnowienia danej umiejętności
 *  passive.n / passive.extra / passive.shieldCap   modyfikacje pasywki bohatera
 *  <idUmiejętności>.<parametr>  dodatek do parametru umiejętności (np. k_volley.count)
 *
 * Flagi super-bonusów przedmiotów (data/items.ts):
 *  aegis           co ile sekund blokowane jest jedno trafienie
 *  rage            +obrażenia × brakujący ułamek HP
 *  itemLuck        lepsza rzadkość łupów
 */
export type Rarity = 'silver' | 'gold' | 'prism';
export type Tag = 'Ogień' | 'Krytyk' | 'Przywołania' | 'Tarcze' | 'Szybkość' | 'Pociski' | 'Obszar' | 'Życie' | 'Umiejętności' | 'Klątwa';

export interface CardHooks {
  onHit?(run: Run, e: Enemy, dmg: number, crit: boolean, stacks: number): void;
  onKill?(run: Run, e: Enemy, stacks: number): void;
  onAbilityCast?(run: Run, slot: AbilitySlot, stacks: number): void;
  onDash?(run: Run, stacks: number): void;
  onDamageTaken?(run: Run, dmg: number, stacks: number): void;
  onLevelUp?(run: Run, stacks: number): void;
  onTick?(run: Run, dt: number, stacks: number): void;
}
export type HookName = keyof CardHooks;

export interface CardDef {
  id: string;
  name: string;
  rarity: Rarity;
  tags: Tag[];
  desc: string;
  /** Ikona karty (ustawiana z CARD_ICONS; domyślnie ikona pierwszego tagu). */
  icon?: string;
  /** Karta dostępna tylko dla tego bohatera. */
  hero?: string;
  /** Przeklęta: silny bonus z realnym minusem. */
  cursed?: boolean;
  /** Można ją wybrać wielokrotnie (efekty się kumulują). */
  stackable?: boolean;
  stats?: Partial<Stats>;
  mul?: Partial<Stats>;
  flags?: Record<string, number>;
  hooks?: CardHooks;
}

export const RARITY: Record<Rarity, { name: string; color: number }> = {
  silver: { name: 'Srebrna', color: C.lgray },
  gold: { name: 'Złota', color: C.yellow },
  prism: { name: 'Pryzmatyczna', color: C.pink },
};

/** Licznik w stanie kart (np. "co 12 s", "co 50 zabójstw"). Zwraca true, gdy próg przekroczony. */
function every(run: Run, key: string, add: number, threshold: number): boolean {
  const v = (run.cardState[key] ?? 0) + add;
  if (v >= threshold) { run.cardState[key] = v - threshold; return true; }
  run.cardState[key] = v;
  return false;
}

export const CARDS: CardDef[] = [
  // ======================= SREBRNE =======================
  { id: 's_might', name: 'Wprawa', rarity: 'silver', tags: ['Krytyk'], desc: '+12% obrażeń.', stackable: true, stats: { might: 0.12 } },
  { id: 's_haste', name: 'Lekkie buty', rarity: 'silver', tags: ['Szybkość'], desc: '+12% szybkości ruchu.', stackable: true, stats: { speedBonus: 0.12 } },
  { id: 's_vigor', name: 'Krzepa', rarity: 'silver', tags: ['Życie'], desc: '+25 maks. HP.', stackable: true, stats: { maxHp: 25 } },
  { id: 's_elem', name: 'Moc żywiołów', rarity: 'silver', tags: ['Ogień'], desc: 'Podpalenie, trucizna i lód są 20% silniejsze.', stackable: true, stats: { elemPower: 0.2 } },
  { id: 's_fury', name: 'Szybkie ręce', rarity: 'silver', tags: ['Szybkość'], desc: 'Bronie atakują 12% szybciej.', stackable: true, stats: { atkSpeed: 0.12 } },
  { id: 's_reflex', name: 'Refleks', rarity: 'silver', tags: ['Umiejętności'], desc: 'Umiejętności odnawiają się 10% szybciej.', stackable: true, stats: { cdr: 0.1 } },
  { id: 's_sight', name: 'Bystre oko', rarity: 'silver', tags: ['Krytyk'], desc: '+6% szansy na krytyk.', stackable: true, stats: { crit: 0.06 } },
  { id: 's_reach', name: 'Długie ramię', rarity: 'silver', tags: ['Obszar'], desc: '+12% obszaru.', stackable: true, stats: { area: 0.12 } },
  { id: 's_plating', name: 'Blacha', rarity: 'silver', tags: ['Tarcze'], desc: '+3 pancerza.', stackable: true, stats: { armor: 3 } },
  { id: 's_leech', name: 'Pijawka', rarity: 'silver', tags: ['Życie'], desc: 'Leczysz się za 1% zadanych obrażeń.', stackable: true, stats: { lifesteal: 0.01 } },
  { id: 's_pockets', name: 'Głębokie kieszenie', rarity: 'silver', tags: ['Szybkość'], desc: '+40% zasięgu przyciągania łupów, +20% złota.', stackable: true, stats: { magnet: 0.4, greed: 0.2 } },
  {
    id: 's_hunger', name: 'Głód krwi', rarity: 'silver', tags: ['Życie'], desc: 'Każde zabójstwo: +0.1 maks. HP na stałe.', stackable: true,
    hooks: { onKill: (run, _e, n) => run.addBonus('maxHp', 0.1 * n) },
  },
  {
    id: 's_spark', name: 'Iskra', rarity: 'silver', tags: ['Ogień'], desc: 'Każde trafienie: 5% szans na płomienie pod wrogiem.', stackable: true,
    hooks: { onHit: (run, e, _d, _c, n) => { if (rng.chance(0.05 * n)) run.addFire(e.x, e.y, 10, run.cardDamage(4), 2, 'Iskra'); } },
  },
  { id: 's_roll', name: 'Akrobata', rarity: 'silver', tags: ['Szybkość', 'Umiejętności'], desc: 'Unik odnawia się 30% szybciej.', stackable: true, flags: { 'cd.dash': 0.3 } },
  { id: 's_warm', name: 'Ciepły posiłek', rarity: 'silver', tags: ['Życie'], desc: 'Mięso leczy 2x mocniej, +0.2 HP na sekundę.', flags: { meatHeal: 1 }, stats: { regen: 0.2 } },
  { id: 'h_k_net', name: 'Kolczasta sieć', rarity: 'silver', tags: ['Umiejętności', 'Obszar'], hero: 'kestra', desc: 'Sieć: +6 obrażeń co pół sekundy i jest większa.', stackable: true, flags: { 'k_net.damage': 6, 'k_net.radius': 10 } },
  { id: 'h_i_kindle', name: 'Rozżarzenie', rarity: 'silver', tags: ['Ogień', 'Obszar'], hero: 'ignara', desc: 'Kula ognia: +15 obrażeń, +6 promienia.', stackable: true, flags: { 'i_fireball.damage': 15, 'i_fireball.radius': 6 } },
  { id: 'h_b_hide', name: 'Twarda skóra', rarity: 'silver', tags: ['Tarcze'], hero: 'borgun', desc: 'Tarcza z Żelaznej woli może urosnąć o 10% HP więcej. +2 pancerza.', stackable: true, flags: { 'passive.shieldCap': 0.1 }, stats: { armor: 2 } },

  // ======================= ZŁOTE =======================
  {
    id: 'g_echo', name: 'Echo', rarity: 'gold', tags: ['Umiejętności'], desc: 'Q odpala się drugi raz po pół sekundy.',
    hooks: { onAbilityCast: (run, slot) => { if (slot === 'q') run.schedule(0.5, () => castAbility(run, 'q', true)); } },
  },
  {
    id: 'g_firetrail', name: 'Płonący ślad', rarity: 'gold', tags: ['Ogień', 'Szybkość'], desc: 'Unik zostawia ognisty ślad.',
    hooks: {
      onDash: (run) => {
        for (let i = 0; i < 6; i++) run.schedule(i * 0.03, () => run.addFire(run.player.x, run.player.y, 10, run.cardDamage(7), 3, 'Płonący ślad'));
      },
    },
  },
  { id: 'g_bounce', name: 'Rykoszet', rarity: 'gold', tags: ['Pociski'], desc: 'Pociski odbijają się od krawędzi ekranu (do 2 razy).', flags: { bounce: 2 } },
  { id: 'g_overheal', name: 'Nadmiar życia', rarity: 'gold', tags: ['Tarcze', 'Życie'], desc: 'Nadmiarowe leczenie zamienia się w tarczę (maks. 50% HP).', flags: { overhealShield: 0.5 }, stats: { regen: 0.3 } },
  {
    id: 'g_explode', name: 'Wybuchowe zgony', rarity: 'gold', tags: ['Ogień', 'Obszar'], desc: 'Zabici wrogowie wybuchają (30% ich maks. HP).',
    hooks: { onKill: (run, e) => { if (!e.boss) run.queueExplosion(e.x, e.y, 18 * run.stats.area, e.maxHp * 0.3, 'Wybuchowe zgony', C.orange); } },
  },
  {
    id: 'g_critchain', name: 'Krytyczna masa', rarity: 'gold', tags: ['Krytyk'], desc: 'Trafienie krytyczne: 25% szans na piorun do 2 pobliskich wrogów.',
    hooks: {
      onHit: (run, e, dmg, crit) => {
        if (!crit || !rng.chance(0.25)) return;
        const hit = [e.uid];
        let from: Enemy = e;
        for (let i = 0; i < 2; i++) {
          const t = run.nearestEnemy(from.x, from.y, 60, hit);
          if (!t) break;
          hit.push(t.uid);
          const f = run.addFx('line', from.x, from.y, C.yellow, 0.12);
          if (f) { f.x2 = t.x; f.y2 = t.y; }
          run.damageEnemy(t, dmg * 0.5, 'Krytyczna masa');
          from = t;
        }
      },
    },
  },
  {
    id: 'g_bone', name: 'Pancerz z kości', rarity: 'gold', tags: ['Tarcze'], desc: 'Zabójstwa dają tarczę 0.3% HP (maks. 20% HP).', stackable: true,
    hooks: { onKill: (run, _e, n) => run.killShield(0.003 * n, 0.2) },
  },
  {
    id: 'g_turret', name: 'Wieżyczka', rarity: 'gold', tags: ['Przywołania'], desc: 'Co 12 s stawiasz wieżyczkę strzelającą przez 10 s.', stackable: true,
    hooks: { onTick: (run, dt, n) => { if (every(run, 'g_turret', dt * n, 12)) spawnTurret(run, run.player.x, run.player.y, 10); } },
  },
  { id: 'g_battle', name: 'Głód bitwy', rarity: 'gold', tags: ['Umiejętności'], desc: 'Ultimate ładuje się 40% szybciej.', stackable: true, flags: { ultGain: 0.4 } },
  { id: 'g_second', name: 'Druga natura', rarity: 'gold', tags: ['Umiejętności'], desc: 'E odnawia się 35% szybciej.', stackable: true, flags: { 'cd.e': 0.35 } },
  {
    id: 'g_thorns', name: 'Ciernie', rarity: 'gold', tags: ['Tarcze', 'Obszar'], desc: 'Gdy otrzymasz obrażenia, ranisz wrogów wokół siebie (najwyżej co 0.4 s).', stackable: true,
    hooks: {
      onDamageTaken: (run, _d, n) => {
        if (run.totalTime < (run.cardState.thornsAt ?? 0)) return;
        run.cardState.thornsAt = run.totalTime + 0.4;
        run.explode(run.player.x, run.player.y, 32, run.cardDamage(15 * n), 'Ciernie', C.green);
      },
    },
  },
  {
    id: 'g_renewal', name: 'Odnowa', rarity: 'gold', tags: ['Życie'], desc: 'Każdy awans leczy 25% HP.',
    hooks: { onLevelUp: (run) => run.heal(run.stats.maxHp * 0.25) },
  },
  { id: 'g_executioner', name: 'Egzekutor', rarity: 'gold', tags: ['Krytyk'], desc: '+60% obrażeń krytycznych.', stackable: true, stats: { critMult: 0.6 } },
  { id: 'g_quiver', name: 'Kołczan', rarity: 'gold', tags: ['Pociski'], desc: '+1 pocisk dla każdej broni.', stats: { amount: 1 } },
  { id: 'g_momentum', name: 'Pęd', rarity: 'gold', tags: ['Szybkość'], desc: '+10% szybkości. Każdy % bonusu szybkości to też % obrażeń.', flags: { momentum: 1 }, stats: { speedBonus: 0.1 } },
  { id: 'c_glass', name: 'Szklana armata', rarity: 'gold', tags: ['Klątwa', 'Pociski'], cursed: true, desc: '+80% obrażeń, ale -40% maks. HP.', stats: { might: 0.8 }, mul: { maxHp: 0.6 } },
  { id: 'c_fever', name: 'Gorączka', rarity: 'gold', tags: ['Klątwa', 'Szybkość'], cursed: true, desc: '-35% czasu odnowienia, ale tracisz 1 HP/s.', stats: { cdr: 0.35, regen: -1 } },
  { id: 'c_greed', name: 'Przeklęte złoto', rarity: 'gold', tags: ['Klątwa'], cursed: true, desc: '+100% złota, +50% XP, ale wrogowie mają +25% HP.', stats: { greed: 1, growth: 0.5 }, flags: { enemyHp: 0.25 } },
  { id: 'h_k_volley', name: 'Grad z nieba', rarity: 'gold', tags: ['Pociski', 'Umiejętności'], hero: 'kestra', desc: 'Salwa: +4 strzały, każda przebija 2 wrogów więcej.', stackable: true, flags: { 'k_volley.count': 4, 'k_volley.pierce': 2 } },
  { id: 'h_k_rain', name: 'Ulewa', rarity: 'gold', tags: ['Obszar', 'Umiejętności'], hero: 'kestra', desc: 'Deszcz strzał: +2 s, +20 promienia.', stackable: true, flags: { 'k_rain.duration': 2, 'k_rain.radius': 20 } },
  { id: 'h_b_ram', name: 'Taran', rarity: 'gold', tags: ['Umiejętności'], hero: 'borgun', desc: 'Szarża: +40 dystansu, +20 obrażeń, +0.6 s ogłuszenia.', stackable: true, flags: { 'b_charge.dist': 40, 'b_charge.damage': 20, 'b_charge.stun': 0.6 } },
  {
    id: 'h_b_wrath', name: 'Wieczny gniew', rarity: 'gold', tags: ['Życie', 'Umiejętności'], hero: 'borgun', desc: 'Gniew tytana trwa 4 s dłużej, a zabójstwa w jego trakcie leczą 1 HP.',
    flags: { 'b_titan.duration': 4 },
    hooks: { onKill: (run) => { if (run.abilities.ult.activeT > 0) run.heal(1); } },
  },
  { id: 'h_i_ring', name: 'Wieczny płomień', rarity: 'gold', tags: ['Ogień', 'Umiejętności'], hero: 'ignara', desc: 'Pierścień ognia: +2 s, +8 obrażeń co tick, +10 promienia.', stackable: true, flags: { 'i_ring.duration': 2, 'i_ring.damage': 8, 'i_ring.radius': 10 } },
  { id: 'h_i_inferno', name: 'Ognisty deszcz', rarity: 'gold', tags: ['Ogień', 'Obszar'], hero: 'ignara', desc: 'Inferno: +2 s, +20 obrażeń, +8 promienia wybuchów.', stackable: true, flags: { 'i_inferno.duration': 2, 'i_inferno.damage': 20, 'i_inferno.blast': 8 } },

  // ======================= PRYZMATYCZNE =======================
  { id: 'p_bloodpact', name: 'Pakt krwi', rarity: 'prism', tags: ['Klątwa', 'Krytyk'], cursed: true, desc: '+100% obrażeń, ale nie możesz się leczyć.', stats: { might: 1 }, flags: { noHeal: 1 } },
  {
    id: 'p_tempest', name: 'Nawałnica', rarity: 'prism', tags: ['Umiejętności'], desc: 'Ultimate resetuje odnowienie Q, E i uniku.',
    hooks: { onAbilityCast: (run, slot) => { if (slot === 'ult') for (const s of ['q', 'e', 'dash'] as const) run.abilities[s].cd = 0; } },
  },
  { id: 'p_twins', name: 'Bliźniacze dusze', rarity: 'prism', tags: ['Pociski', 'Obszar'], desc: '+1 pocisk dla każdej broni i +20% obszaru.', stats: { amount: 1, area: 0.2 } },
  { id: 'p_phoenix', name: 'Feniks', rarity: 'prism', tags: ['Życie', 'Ogień'], desc: 'Raz na poziom po śmierci odradzasz się z 50% HP.', flags: { revive: 1 } },
  {
    id: 'p_nova', name: 'Supernowa', rarity: 'prism', tags: ['Ogień', 'Obszar'], desc: 'Co 50 zabójstw wybuch wokół ciebie zadaje 50% maks. HP wrogów (bossom 5%).',
    hooks: {
      onKill: (run) => {
        if (!every(run, 'p_nova', 1, 50)) return;
        const p = run.player;
        run.explode(p.x, p.y, 70 * run.stats.area, (e) => e.maxHp * (e.boss ? 0.05 : 0.5), 'Supernowa', C.yellow);
      },
    },
  },
  {
    id: 'p_frost', name: 'Lodowe serce', rarity: 'prism', tags: ['Tarcze'], desc: '-30% otrzymywanych obrażeń. Gdy oberwiesz, zamrażasz wrogów obok na 2 s.', flags: { dmgTaken: 0.3 },
    hooks: {
      onDamageTaken: (run) => {
        const p = run.player;
        run.enemiesInCircle(p.x, p.y, 28, (e) => { e.stunT = Math.max(e.stunT, e.boss ? 0.4 : 2); });
        const f = run.addFx('ring', p.x, p.y, C.blue, 0.3);
        if (f) f.r = 28;
      },
    },
  },
  {
    id: 'p_shrapnel', name: 'Odłamki', rarity: 'prism', tags: ['Pociski'], desc: 'Zabici wrogowie mają 15% szans wystrzelić 6 odłamków.',
    hooks: {
      onKill: (run, e) => {
        if (!rng.chance(0.15)) return;
        for (let i = 0; i < 6; i++) {
          run.spawnProjectile({ x: e.x, y: e.y, angle: (i / 6) * Math.PI * 2, speed: 160, damage: run.cardDamage(8), src: 'Odłamki', sprite: 'bolt', pierce: 1, life: 0.8 });
        }
      },
    },
  },
  {
    id: 'p_legion', name: 'Legion', rarity: 'prism', tags: ['Przywołania'], desc: 'Co 6 s przywołujesz wieżyczkę. Wieżyczki strzelają 2× szybciej.', flags: { turretRate: 1 },
    hooks: { onTick: (run, dt) => { if (every(run, 'p_legion', dt, 6)) spawnTurret(run, run.player.x, run.player.y, 12); } },
  },
  { id: 'p_overcrit', name: 'Nadkrytyk', rarity: 'prism', tags: ['Krytyk'], desc: '+15% krytyka. Szansa na krytyk ponad 100% może dać podwójny krytyk.', stats: { crit: 0.15 }, flags: { overcrit: 1 } },
  { id: 'p_hourglass', name: 'Klepsydra losu', rarity: 'prism', tags: ['Umiejętności'], desc: '-40% czasu odnowienia, +30% czasu trwania.', stats: { cdr: 0.4, duration: 0.3 } },
  { id: 'h_k_hawk', name: 'Jastrzębi wzrok', rarity: 'prism', tags: ['Krytyk', 'Pociski'], hero: 'kestra', desc: 'Sokole oko działa co 3. strzał zamiast co 4. i daje 2 strzały więcej.', flags: { 'passive.n': 1, 'passive.extra': 2 } },
  {
    id: 'h_b_quake', name: 'Trzęsienie ziemi', rarity: 'prism', tags: ['Obszar', 'Umiejętności'], hero: 'borgun', desc: 'Wstrząs uderza trzy razy.',
    hooks: {
      onAbilityCast: (run, slot) => {
        if (slot !== 'e') return;
        run.schedule(0.4, () => castAbility(run, 'e', true));
        run.schedule(0.8, () => castAbility(run, 'e', true));
      },
    },
  },
  {
    id: 'h_i_echo', name: 'Podwójne echo', rarity: 'prism', tags: ['Umiejętności', 'Ogień'], hero: 'ignara', desc: 'Echo mocy działa co 2. użycie Q lub E zamiast co 3., a odnowienie umiejętności jest o 15% krótsze.',
    flags: { 'passive.n': 1 }, stats: { cdr: 0.15 },
  },
];

/** Ikony kart: pasujące ikony broni, pasywek i umiejętności albo własne (gfx/card-icons.ts, cd_*). */
const CARD_ICONS: Record<string, string> = {
  s_elem: 'cd_tempest', s_fury: 'pi_fury', s_might: 'pi_might', s_haste: 'pi_wings', s_vigor: 'pi_heart', s_reflex: 'pi_clock', s_sight: 'pi_crit', s_reach: 'pi_lens',
  s_plating: 'pi_armor', s_leech: 'pi_fang', s_pockets: 'pi_magnet', s_hunger: 'meat', s_spark: 'tag:Ogień', s_roll: 'ab_k_roll',
  s_warm: 'pi_herb', h_k_net: 'ab_k_net', h_b_hide: 'it_plate',
  g_echo: 'cd_echo', g_firetrail: 'ic_mines_evo', g_bounce: 'cd_bounce', g_overheal: 'tag:Tarcze', g_explode: 'cd_explode',
  g_critchain: 'ic_chain', g_bone: 'ui_skull', g_turret: 'turret', g_battle: 'ic_chain_evo', g_second: 'pi_hourglass',
  g_thorns: 'ic_aura_evo', g_renewal: 'tag:Życie', g_executioner: 'ic_axe_evo', g_quiver: 'ic_arrow', g_momentum: 'tag:Szybkość',
  c_glass: 'cd_glass', c_fever: 'cd_fever', c_greed: 'cd_gold', h_k_volley: 'ab_k_volley', h_k_rain: 'ab_k_rain',
  h_b_ram: 'ab_b_charge', h_b_wrath: 'ab_b_titan',
  p_bloodpact: 'cd_blood', p_tempest: 'cd_tempest', p_twins: 'pi_dup', p_phoenix: 'cd_phoenix', p_nova: 'cd_nova',
  p_frost: 'cd_frost', p_shrapnel: 'cd_shrapnel', p_legion: 'tag:Przywołania', p_overcrit: 'tag:Krytyk', p_hourglass: 'ic_bolt_evo',
  h_k_hawk: 'ic_arrow_evo', h_b_quake: 'ab_b_slam',
  h_i_kindle: 'ab_i_fireball', h_i_ring: 'ab_i_ring', h_i_inferno: 'ab_i_inferno', h_i_echo: 'cd_echo',
};
for (const c of CARDS) c.icon = CARD_ICONS[c.id] ?? `tag:${c.tags[0]}`;

export const CARD_BY_ID: Record<string, CardDef> = Object.fromEntries(CARDS.map((c) => [c.id, c]));

/** Źródło oferty kart; 'fight' = wygrana walka w Ekspedycji. */
export type CardSource = 'level' | 'fight' | 'elite' | 'boss' | 'shop';

/** Rzadkość oferty: wszystkie 3 karty w ofercie mają tę samą rzadkość. */
export function rollRarity(depth: number, lvl: number, source: CardSource): Rarity {
  let gold = BAL.goldChance(depth, lvl), prism = BAL.prismChance(depth, lvl);
  if (source === 'elite' || source === 'shop') gold += 0.1;
  if (source === 'boss') prism *= 2;
  const r = rng.next();
  if (r < prism) return 'prism';
  if (r < prism + gold || source === 'boss') return 'gold';
  return 'silver';
}

/** Karty, które można teraz wylosować (pasujący bohater; unikalne tylko raz; bez kart zbanowanych w kolekcji). */
export function cardPool(run: Run, rarity: Rarity, exclude: string[] = []): CardDef[] {
  return CARDS.filter((c) =>
    c.rarity === rarity &&
    !run.cardBans.has(c.id) &&
    (!c.hero || c.hero === run.hero.id) &&
    (c.stackable || !run.cards.some((x) => x.id === c.id)) &&
    !exclude.includes(c.id));
}

export function rollOffer(run: Run, source: CardSource): { rarity: Rarity; cards: CardDef[] } {
  let rarity = rollRarity(run.depth, run.level, source);
  let pool = cardPool(run, rarity);
  // Wszystkie unikalne karty tej rzadkości już zebrane — srebrne karty kumulowane są zawsze dostępne.
  if (pool.length === 0) { rarity = 'silver'; pool = cardPool(run, rarity); }
  const cards: CardDef[] = [];
  while (cards.length < 3 && pool.length) cards.push(pool.splice(Math.floor(rng.next() * pool.length), 1)[0]);
  return { rarity, cards };
}
