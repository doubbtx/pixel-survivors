import { C } from '../core/palette';
import { rng } from '../core/rng';
import { BAL } from './balance';
import { prismGroup } from './unlocks';
import { SLOT, type Enemy, type Stats } from '../entities/types';
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
 *  elemChance.fire / .ice / .lightning / .poison / .any   szansa na żywioł przy trafieniu (any = losowy)
 *  critShock       trafienia krytyczne porażają
 *  reactPower      mocniejsze reakcje żywiołów (+ułamek)
 *  reactCd         krótsze odnowienie reakcji na wrogu (ułamek)
 *  shockBonus      porażeni wrogowie dostają dodatkowe obrażenia (+ułamek)
 *  bossDmg         +obrażenia przeciw elitom i bossom
 *  cull            wrogowie (nie bossowie) poniżej tego ułamka HP giną od trafienia
 *  enemySpeed      +szybkość wrogów
 *  echo.q / echo.e     liczba darmowych powtórzeń umiejętności po użyciu
 *  dashResetQ      unik skraca odnowienie Q o ten ułamek
 *  dashNet         unik zostawia sieć (spowalnia i rani)
 *  ringShield      Pierścień ognia daje tarczę (ułamek maks. HP)
 *  counterSlam     oberwanie wyzwala darmowe E (wartość = odstęp w s)
 *  minionDmg / minionSpeed / minionLife   mocniejsze, szybsze, dłużej żyjące sługi (systems/minions.ts)
 *  dashSummon      unik przywołuje ducha-sługę
 *  res.gain / res.power / res.max   zasób bohatera: szybszy przyrost, silniejszy efekt, większa pojemność (systems/resource.ts)
 *  heat.safe / heat.vent            Żar Ignary: przegrzanie nie rani, mocniejszy Wydech żaru
 *  execHeal / execKeep / stepResetDash   Vesper: Egzekucja leczy za zabitych i zostawia część kombo, Cios z cienia odnawia unik
 *  guardHeal       Aurel: mocniejsze leczenie z trafień w napiętnowanych (+ułamek)
 *  brandDmg        Aurel: więcej obrażeń przeciw napiętnowanym (+ułamek)
 *  lanceDmg / lanceSpeed  Aurel: obrażenia / prędkość Włóczni światła (+ułamek)
 *  secretRate      częstsze sekrety map (+ułamek)
 *  calm            +obrażenia po BAL.feats.calmAfter s bez trafienia; firstBlock: pierwsze trafienie na poziomie blokowane
 * Flagi paktów (data/pacts.ts, na cały run):
 *  bulletSpeed     szybsze pociski wrogów (+ułamek)
 *  eliteMods       dodatkowe cechy elit (liczba)
 *  bossHp          +HP bossów (ułamek)
 *  taskTime        krótszy czas na zadania (ułamek, maks. 0.5)
 * Flagi sekretów (data/secrets.ts): focusKeep (Celność nie spada od trafień), furyHold (Furia nie opada, dłuższy Szał).
 * Flagi unikatów (data/items.ts UNIQUES):
 *  facing          bronie kierunkowe strzelają w kierunku ruchu, obrażenia × (1 + wartość)
 *  healShield      leczenie zamienia się w tarczę (maks. ułamek HP)
 * Flagi map Ekspedycji (data/expedition.ts, na czas poziomu):
 *  enemyDmg / enemyCount / eliteRate / bulletDensity   silniejsi, liczniejsi wrogowie, częstsze elity, gęstsze salwy
 *  healCut         leczenie słabsze o ułamek
 *  bossFoeDmg      +obrażenia bossów zadawane graczowi (ułamek; Udręka), nie mylić z bossDmg gracza
 *  mapLoot / mapGold / mapXp   więcej przedmiotów, złota, doświadczenia
 *  shrineRate / goldSlimeRate  częstsze kapliczki i Złote szlamy
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
  /** Karta odblokowywana osiągnięciem (id z data/achievements.ts). */
  unlock?: string;
  /** Przeklęta: silny bonus z realnym minusem. */
  cursed?: boolean;
  /** Można ją wybrać wielokrotnie (efekty się kumulują). */
  stackable?: boolean;
  /** Karta tylko dla podstawowego ('base') albo drugiego ('alt') ultimate bohatera (Run.altUlt). */
  ult?: 'base' | 'alt';
  stats?: Partial<Stats>;
  mul?: Partial<Stats>;
  flags?: Record<string, number>;
  hooks?: CardHooks;
}

/**
 * Źródła płomieni z hooków onHit (Iskra, Synergia: Ogień): ich trafienia nie odpalają hooków onHit
 * (systems/zones.ts), inaczej płomienie rodziłyby kolejne płomienie aż do zapełnienia puli stref.
 */
export const PROC_FIRES = new Set(['Iskra', 'Synergia: Ogień']);

export const RARITY: Record<Rarity, { name: string; color: number }> = {
  silver: { name: 'Srebrna', color: C.lgray },
  gold: { name: 'Złota', color: C.gold },
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
    id: 's_hunger', name: 'Głód krwi', rarity: 'silver', tags: ['Życie'], desc: 'Każde zabójstwo: +0.1 maks. HP na stałe (do +100 na kartę).', stackable: true,
    hooks: {
      onKill: (run, _e, n) => {
        const got = run.cardState.hunger ?? 0;
        const add = Math.min(0.1 * n, 100 * n - got);
        if (add <= 0) return;
        run.cardState.hunger = got + add;
        run.addBonus('maxHp', add);
      },
    },
  },
  {
    id: 's_spark', name: 'Iskra', rarity: 'silver', tags: ['Ogień'], desc: 'Każde trafienie: 5% szans na płomienie pod wrogiem.', stackable: true,
    hooks: { onHit: (run, e, _d, _c, n) => { if (rng.chance(0.05 * n)) run.addFire(e.x, e.y, 10, run.cardDamage(4), 2, 'Iskra'); } },
  },
  { id: 's_roll', name: 'Akrobata', rarity: 'silver', tags: ['Szybkość', 'Umiejętności'], desc: 'Unik odnawia się 30% szybciej.', stackable: true, flags: { 'cd.dash': 0.3 } },
  { id: 's_warm', name: 'Ciepły posiłek', rarity: 'silver', tags: ['Życie'], desc: 'Mięso leczy 2x mocniej, +0.2 HP na sekundę.', flags: { meatHeal: 1 }, stats: { regen: 0.2 } },
  { id: 'h_k_net', name: 'Kolczasta sieć', rarity: 'silver', tags: ['Umiejętności', 'Obszar'], hero: 'kestra', desc: 'Sieć: +6 obrażeń co pół sekundy i jest większa.', stackable: true, flags: { 'k_net.damage': 6, 'k_net.radius': 10 } },
  { id: 's_tinder', name: 'Krzesiwo', rarity: 'silver', tags: ['Ogień'], desc: 'Trafienia mają 8% szans podpalić wroga.', stackable: true, flags: { 'elemChance.fire': 0.08 } },
  { id: 's_rime', name: 'Szron', rarity: 'silver', tags: ['Obszar'], desc: 'Trafienia mają 8% szans nałożyć lód.', stackable: true, flags: { 'elemChance.ice': 0.08 } },
  { id: 's_venom', name: 'Jad', rarity: 'silver', tags: ['Pociski'], desc: 'Trafienia mają 8% szans zatruć wroga.', stackable: true, flags: { 'elemChance.poison': 0.08 } },
  { id: 's_static', name: 'Ładunek', rarity: 'silver', tags: ['Krytyk'], desc: 'Trafienia krytyczne porażają wroga (+obrażenia od wszystkich źródeł).', flags: { critShock: 1 } },
  { id: 's_wisdom', name: 'Mądrość', rarity: 'silver', tags: ['Umiejętności'], desc: '+15% doświadczenia.', stackable: true, stats: { growth: 0.15 } },
  {
    id: 'h_k_trapper', name: 'Sidła', rarity: 'silver', tags: ['Obszar', 'Szybkość'], hero: 'kestra', desc: 'Przewrót zostawia w miejscu startu sieć, która spowalnia i rani.',
    hooks: {
      onDash: (run) => {
        const z = run.addZone('net', run.player.x, run.player.y, 26 * run.stats.area, run.cardDamage(6), 2.5 * run.stats.duration, SLOT.card, 'Sidła');
        if (z) { z.slow = 0.6; z.tick = 30; }
      },
    },
  },
  {
    id: 'h_b_landing', name: 'Lądowanie', rarity: 'silver', tags: ['Obszar', 'Tarcze'], hero: 'borgun', desc: 'Doskok kończy się uderzeniem, które rani i odpycha wrogów.',
    hooks: { onDash: (run) => run.schedule(0.16, () => run.explode(run.player.x, run.player.y, 30 * run.stats.area, run.cardDamage(20), 'Lądowanie', C.brown, 5)) },
  },
  {
    id: 'h_b_chargeshield', name: 'Tarcza szarży', rarity: 'silver', tags: ['Tarcze'], hero: 'borgun', desc: 'Szarża daje tarczę 8% HP (maks. 30% HP).', stackable: true,
    hooks: { onAbilityCast: (run, slot, n) => { if (slot === 'q') run.addShield(run.stats.maxHp * 0.08 * n, 0.3); } },
  },
  {
    id: 'h_i_blinkfire', name: 'Ognisty skok', rarity: 'silver', tags: ['Ogień', 'Szybkość'], hero: 'ignara', desc: 'Mignięcie zostawia wybuch ognia w miejscu startu.',
    hooks: { onDash: (run) => run.explode(run.player.x, run.player.y, 26 * run.stats.area, run.cardDamage(25), 'Ognisty skok', C.orange, 4) },
  },
  { id: 'h_m_call', name: 'Mroczny zew', rarity: 'silver', tags: ['Przywołania'], hero: 'morwen', desc: 'Zew dusz działa o 4 zabójstwa wcześniej.', stackable: true, flags: { 'passive.n': 4 } },
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
    hooks: { onKill: (run, e) => { if (!e.boss && !run.chainKill()) run.queueExplosion(e.x, e.y, 18 * run.stats.area, e.maxHp * 0.3, 'Wybuchowe zgony', C.orange); } },
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
          run.damageEnemy(t, dmg * 0.5, 'Krytyczna masa', { proc: true });
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
  { id: 'c_fever', name: 'Gorączka', rarity: 'gold', tags: ['Klątwa', 'Szybkość'], cursed: true, desc: 'Umiejętności odnawiają się 35% szybciej, ale tracisz 1 HP/s.', stats: { cdr: 0.35 }, flags: { hpDrain: 1 } },
  { id: 'c_greed', name: 'Przeklęte złoto', rarity: 'gold', tags: ['Klątwa'], cursed: true, desc: '+100% złota, +50% XP, ale wrogowie mają +25% HP.', stats: { greed: 1, growth: 0.5 }, flags: { enemyHp: 0.25 } },
  { id: 'h_k_volley', name: 'Grad z nieba', rarity: 'gold', tags: ['Pociski', 'Umiejętności'], hero: 'kestra', desc: 'Salwa: +4 strzały, każda przebija 2 wrogów więcej.', stackable: true, flags: { 'k_volley.count': 4, 'k_volley.pierce': 2 } },
  { id: 'h_k_rain', name: 'Ulewa', rarity: 'gold', tags: ['Obszar', 'Umiejętności'], hero: 'kestra', ult: 'base', desc: 'Deszcz strzał: +2 s, +20 promienia.', stackable: true, flags: { 'k_rain.duration': 2, 'k_rain.radius': 20 } },
  { id: 'h_b_ram', name: 'Taran', rarity: 'gold', tags: ['Umiejętności'], hero: 'borgun', desc: 'Szarża: +40 dystansu, +20 obrażeń, +0.6 s ogłuszenia.', stackable: true, flags: { 'b_charge.dist': 40, 'b_charge.damage': 20, 'b_charge.stun': 0.6 } },
  {
    id: 'h_b_wrath', name: 'Wieczny gniew', rarity: 'gold', tags: ['Życie', 'Umiejętności'], hero: 'borgun', ult: 'base', desc: 'Gniew tytana trwa 4 s dłużej, a zabójstwa w jego trakcie leczą 1 HP.',
    flags: { 'b_titan.duration': 4 },
    hooks: { onKill: (run) => { if (run.abilities.ult.activeT > 0) run.heal(1); } },
  },
  { id: 'h_i_ring', name: 'Wieczny płomień', rarity: 'gold', tags: ['Ogień', 'Umiejętności'], hero: 'ignara', desc: 'Pierścień ognia: +2 s, +8 obrażeń co tick, +10 promienia.', stackable: true, flags: { 'i_ring.duration': 2, 'i_ring.damage': 8, 'i_ring.radius': 10 } },
  { id: 'h_i_inferno', name: 'Ognisty deszcz', rarity: 'gold', tags: ['Ogień', 'Obszar'], hero: 'ignara', ult: 'base', desc: 'Inferno: +2 s, +20 obrażeń, +8 promienia wybuchów.', stackable: true, flags: { 'i_inferno.duration': 2, 'i_inferno.damage': 20, 'i_inferno.blast': 8 } },
  { id: 'g_prism', name: 'Pryzmat żywiołów', rarity: 'gold', tags: ['Ogień', 'Krytyk'], desc: 'Trafienia mają 15% szans nałożyć losowy żywioł.', stackable: true, flags: { 'elemChance.any': 0.15 } },
  { id: 'g_reactor', name: 'Reaktor', rarity: 'gold', tags: ['Obszar', 'Ogień'], desc: 'Reakcje żywiołów są o 50% silniejsze.', stackable: true, flags: { reactPower: 0.5 } },
  { id: 'g_storm', name: 'Burza żywiołów', rarity: 'gold', tags: ['Umiejętności'], desc: '+30% siły żywiołów, porażeni wrogowie dostają dodatkowe +10% obrażeń.', stats: { elemPower: 0.3 }, flags: { shockBonus: 0.1 } },
  {
    id: 'g_spread', name: 'Zaraza', rarity: 'gold', tags: ['Obszar'], desc: 'Zabity wróg przekazuje swoje żywioły najbliższemu wrogowi.',
    hooks: {
      onKill: (run, e) => {
        if (e.burnT <= 0 && e.slowT <= 0 && e.shockT <= 0 && e.poisonStacks <= 0) return;
        const t = run.nearestEnemy(e.x, e.y, 50, [e.uid]);
        if (!t) return;
        if (e.burnT > 0) { t.burnT = Math.max(t.burnT, e.burnT); t.burnDps = Math.max(t.burnDps, e.burnDps); }
        if (e.slowT > 0) { t.slowT = Math.max(t.slowT, e.slowT); t.slowF = Math.max(t.slowF, e.slowF); }
        if (e.shockT > 0) t.shockT = Math.max(t.shockT, e.shockT);
        if (e.poisonStacks > 0) { t.poisonStacks = Math.max(t.poisonStacks, e.poisonStacks); t.poisonUnit = Math.max(t.poisonUnit, e.poisonUnit); t.poisonT = Math.max(t.poisonT, e.poisonT); }
      },
    },
  },
  {
    id: 'g_veteran', name: 'Weteran', rarity: 'gold', tags: ['Życie'], desc: 'Od 20. poziomu postaci każdy awans: +1% obrażeń i +2 maks. HP na stałe.', stackable: true,
    hooks: { onLevelUp: (run, n) => { if (run.level > 20) { run.addBonus('might', 0.01 * n); run.addBonus('maxHp', 2 * n); } } },
  },
  { id: 'g_giant', name: 'Pogromca olbrzymów', rarity: 'gold', tags: ['Krytyk'], desc: '+40% obrażeń przeciw elitom i bossom.', stackable: true, flags: { bossDmg: 0.4 } },
  { id: 'g_cull', name: 'Ścinacz', rarity: 'gold', tags: ['Krytyk', 'Obszar'], desc: 'Wrogowie (poza bossami) poniżej 12% HP giną od trafienia.', flags: { cull: 0.12 } },
  { id: 'c_brittle', name: 'Kruche kości', rarity: 'gold', tags: ['Klątwa', 'Szybkość'], cursed: true, desc: '+40% szybkości ataku, ale -6 pancerza.', stats: { atkSpeed: 0.4, armor: -6 } },
  { id: 'c_haunt', name: 'Nawiedzenie', rarity: 'gold', tags: ['Klątwa', 'Ogień'], cursed: true, desc: '+50% siły żywiołów i reakcji, ale wrogowie są 15% szybsi.', stats: { elemPower: 0.5 }, flags: { reactPower: 0.5, enemySpeed: 0.15 } },
  {
    id: 'h_k_cover', name: 'Ogień zaporowy', rarity: 'gold', tags: ['Obszar', 'Umiejętności'], hero: 'kestra', desc: 'Salwa zostawia w miejscu celownika krótki deszcz strzał.',
    hooks: {
      onAbilityCast: (run, slot) => {
        if (slot !== 'q') return;
        const z = run.addZone('rain', run.aimX, run.aimY, 30 * run.stats.area, run.cardDamage(10), 1.5 * run.stats.duration, SLOT.card, 'Ogień zaporowy');
        if (z) z.tick = 15;
      },
    },
  },
  {
    id: 'h_b_counter', name: 'Kontratak', rarity: 'gold', tags: ['Tarcze', 'Umiejętności'], hero: 'borgun', desc: 'Gdy oberwiesz, Szarża jest od razu gotowa (najwyżej co 4 s).',
    hooks: {
      onDamageTaken: (run) => {
        if (run.totalTime < (run.cardState.counterAt ?? 0)) return;
        run.cardState.counterAt = run.totalTime + 4;
        run.abilities.q.cd = 0;
      },
    },
  },
  {
    id: 'h_i_vortex', name: 'Wir płomieni', rarity: 'gold', tags: ['Ogień', 'Obszar'], hero: 'ignara', desc: 'Pierścień ognia najpierw wciąga wrogów z dalszej okolicy do kręgu.',
    hooks: {
      onAbilityCast: (run, slot) => {
        if (slot !== 'e') return;
        const p = run.player;
        run.enemiesInCircle(p.x, p.y, 110 * run.stats.area, (e) => { if (!e.boss) { e.kx += (p.x - e.x) * 4; e.ky += (p.y - e.y) * 4; } });
      },
    },
  },
  { id: 'h_m_army', name: 'Liczny zastęp', rarity: 'gold', tags: ['Przywołania', 'Umiejętności'], hero: 'morwen', desc: 'Przywołanie: +2 duchy, trwają 4 s dłużej.', stackable: true, flags: { 'm_raise.count': 2, 'm_raise.duration': 4 } },
  { id: 'h_m_swamp', name: 'Głębokie bagno', rarity: 'gold', tags: ['Klątwa', 'Obszar'], hero: 'morwen', desc: 'Bagno dusz: +12 promienia, +2 s, +6 obrażeń co tick.', stackable: true, flags: { 'm_curse.radius': 12, 'm_curse.duration': 2, 'm_curse.damage': 6 } },

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
        run.enemiesInCircle(p.x, p.y, 28, (e) => { e.stunT = Math.max(e.stunT, 2); });
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
  { id: 'p_hourglass', name: 'Klepsydra losu', rarity: 'prism', tags: ['Umiejętności'], desc: 'Umiejętności odnawiają się 40% szybciej, +30% czasu trwania.', stats: { cdr: 0.4, duration: 0.3 } },
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
  { id: 'h_m_lich', name: 'Lisz', rarity: 'prism', tags: ['Przywołania', 'Klątwa'], hero: 'morwen', desc: 'Sługi zadają +60% obrażeń, są 30% szybsze i żyją 50% dłużej.', flags: { minionDmg: 0.6, minionSpeed: 0.3, minionLife: 0.5 } },
  { id: 'p_catalyst', name: 'Katalizator', rarity: 'prism', tags: ['Ogień', 'Obszar'], desc: 'Reakcje żywiołów są 2x silniejsze i odnawiają się na wrogu 2x szybciej.', flags: { reactPower: 1, reactCd: 0.5 } },
  {
    id: 'p_overdrive', name: 'Przeładowanie', rarity: 'prism', tags: ['Umiejętności', 'Szybkość'], desc: 'Co 10 s bronie atakują 3x szybciej przez 3 s.',
    hooks: {
      onTick: (run, dt) => {
        if (!every(run, 'p_overdrive', dt, 10)) return;
        run.buffs.push({ name: 'Przeładowanie', stats: { atkSpeed: 2 }, t: 3 });
        run.recomputeStats();
      },
    },
  },
  {
    id: 'c_ritual', name: 'Krwawy rytuał', rarity: 'prism', tags: ['Klątwa', 'Życie'], cursed: true, desc: '+50% obrażeń i +25% obszaru, ale co 10 s tracisz 5% HP (nie zabija).', stats: { might: 0.5, area: 0.25 },
    hooks: { onTick: (run, dt) => { if (every(run, 'c_ritual', dt, 10)) run.player.hp = Math.max(1, run.player.hp - run.stats.maxHp * 0.05); } },
  },
  // Zasoby bohaterów (systems/resource.ts).
  { id: 'h_k_focus', name: 'Spokojna ręka', rarity: 'silver', tags: ['Krytyk'], hero: 'kestra', desc: 'Celność rośnie 40% szybciej i daje 30% więcej krytyka.', stackable: true, flags: { 'res.gain': 0.4, 'res.power': 0.3 } },
  { id: 'h_b_fury', name: 'Krwawy szał', rarity: 'silver', tags: ['Tarcze'], hero: 'borgun', desc: 'Furia rośnie 40% szybciej i daje 30% silniejsze efekty.', stackable: true, flags: { 'res.gain': 0.4, 'res.power': 0.3 } },
  { id: 'h_i_heat', name: 'Serce żaru', rarity: 'gold', tags: ['Ogień'], hero: 'ignara', desc: 'Przegrzanie cię nie rani, a Wydech żaru zadaje 2x obrażeń.', flags: { 'heat.safe': 1, 'heat.vent': 1 } },
  { id: 'h_m_souls', name: 'Zbieracz dusz', rarity: 'silver', tags: ['Przywołania'], hero: 'morwen', desc: '+15 maks. dusz, a każde zabójstwo daje o 30% więcej dusz.', stackable: true, flags: { 'res.max': 15, 'res.gain': 0.3 } },
  // Vesper (zabójczyni) i Aurel (kapłan).
  { id: 'h_v_step', name: 'Ostrze w plecy', rarity: 'silver', tags: ['Krytyk'], hero: 'vesper', desc: 'Cios z cienia: +15 obrażeń, +4 promienia.', stackable: true, flags: { 'v_step.damage': 15, 'v_step.radius': 4 } },
  { id: 'h_v_streak', name: 'Rytm ostrzy', rarity: 'silver', tags: ['Krytyk'], hero: 'vesper', desc: 'Kombo rośnie 40% szybciej i daje 30% więcej obrażeń.', stackable: true, flags: { 'res.gain': 0.4, 'res.power': 0.3 } },
  {
    id: 'h_v_smoke', name: 'Bomba dymna', rarity: 'silver', tags: ['Szybkość'], hero: 'vesper', desc: 'Zniknięcie ogłusza wrogów wokół miejsca startu na 0.8 s.',
    hooks: {
      onDash: (run) => {
        const p = run.player;
        run.enemiesInCircle(p.x, p.y, 34 * run.stats.area, (e) => { e.stunT = Math.max(e.stunT, 0.8); });
        run.burst(p.x, p.y, C.lgray, 16, 40);
      },
    },
  },
  { id: 'h_v_exec', name: 'Kat', rarity: 'gold', tags: ['Umiejętności', 'Krytyk'], hero: 'vesper', desc: 'Egzekucja: +30 obrażeń, +8 promienia, zabija od razu wrogów do 5% HP więcej.', stackable: true, flags: { 'v_exec.damage': 30, 'v_exec.radius': 8, 'v_exec.exec': 0.05 } },
  { id: 'h_v_dance', name: 'Wirujący taniec', rarity: 'gold', tags: ['Umiejętności', 'Szybkość'], hero: 'vesper', ult: 'base', desc: 'Taniec ostrzy: +1.5 s, +15 obrażeń cięć.', stackable: true, flags: { 'v_dance.duration': 1.5, 'v_dance.damage': 15 } },
  { id: 'h_v_blood', name: 'Krwawe żniwo', rarity: 'gold', tags: ['Życie', 'Krytyk'], hero: 'vesper', desc: 'Egzekucja leczy 4% HP za każdego zabitego wroga.', stackable: true, flags: { execHeal: 0.04 } },
  { id: 'h_v_shadow', name: 'Mistrzyni cieni', rarity: 'prism', tags: ['Krytyk', 'Szybkość'], hero: 'vesper', desc: 'Łowczyni działa o 6 zabójstw wcześniej, a Cios z cienia odnawia też Zniknięcie.', flags: { 'passive.n': 6, stepResetDash: 1 } },
  { id: 'h_a_guard', name: 'Twin Spears', rarity: 'silver', tags: ['Obszar'], hero: 'aurel', desc: 'Spear of Light: +1 spear, +12 damage.', stackable: true, flags: { 'a_guard.count': 1, 'a_guard.damage': 12 } },
  { id: 'h_a_faith', name: 'Gorliwość', rarity: 'silver', tags: ['Życie'], hero: 'aurel', desc: 'Wiara rośnie 40% szybciej, a Łaska i Sąd są 30% silniejsze.', stackable: true, flags: { 'res.gain': 0.4, 'res.power': 0.3 } },
  {
    id: 'h_a_step', name: 'Ślad światła', rarity: 'silver', tags: ['Życie', 'Szybkość'], hero: 'aurel', desc: 'Krok światła leczy 4% maks. HP.', stackable: true,
    hooks: { onDash: (run, n) => run.heal(run.stats.maxHp * 0.04 * n) },
  },
  { id: 'h_a_sanct', name: 'Święty krąg', rarity: 'gold', tags: ['Życie', 'Obszar'], hero: 'aurel', desc: 'Uświęcona ziemia: +2 s, +12 promienia, leczy o 0.5% HP na sekundę więcej.', stackable: true, flags: { 'a_sanct.duration': 2, 'a_sanct.radius': 12, 'a_sanct.heal': 0.5 } },
  { id: 'h_a_judge', name: 'Wyrok', rarity: 'gold', tags: ['Umiejętności'], hero: 'aurel', ult: 'base', desc: 'Sąd: +4 cele, +30 obrażeń słupów.', stackable: true, flags: { 'a_judge.count': 4, 'a_judge.damage': 30 } },
  { id: 'h_a_shield', name: 'Tarcza wiary', rarity: 'gold', tags: ['Tarcze', 'Życie'], hero: 'aurel', desc: 'Guardian works every 4 s instead of 6 s, and its shield can grow 10% HP higher.', flags: { 'passive.n': 2, 'passive.shieldCap': 0.1 } },
  { id: 'h_a_saint', name: 'Święty patron', rarity: 'prism', tags: ['Życie', 'Obszar'], hero: 'aurel', desc: 'Branded enemies take +25% damage from you, and hits on them heal twice as much.', flags: { brandDmg: 0.25, guardHeal: 1 } },
  // Takezo (szermierz, 0.32): opisy po angielsku, polski w core/i18n-pl.ts.
  { id: 'h_t_slam', name: 'Heavy Blade', rarity: 'silver', tags: ['Obszar'], hero: 'takezo', desc: 'Helm Splitter: +16 damage, +4 radius.', stackable: true, flags: { 't_slam.damage': 16, 't_slam.radius': 4 } },
  { id: 'h_t_rhythm', name: 'Steady Breath', rarity: 'silver', tags: ['Szybkość'], hero: 'takezo', desc: 'Rhythm builds 40% faster and gives 30% more attack speed.', stackable: true, flags: { 'res.gain': 0.4, 'res.power': 0.3 } },
  { id: 'h_t_step', name: 'Open Guard', rarity: 'silver', tags: ['Szybkość', 'Krytyk'], hero: 'takezo', desc: 'Mikiri: +5% parry chance, and Footwork recharges 10% faster.', flags: { 'passive.parry': 0.05, 'cd.dash': 0.1 } },
  { id: 'h_t_flurry', name: 'Flowing Water', rarity: 'gold', tags: ['Szybkość', 'Umiejętności'], hero: 'takezo', desc: 'Thousand Cuts: +2 slashes, +6 damage per slash.', stackable: true, flags: { 't_flurry.slashes': 2, 't_flurry.damage': 6 } },
  { id: 'h_t_iai', name: 'Single Stroke', rarity: 'gold', tags: ['Krytyk', 'Umiejętności'], hero: 'takezo', desc: 'Iai: +60 damage, +30 dash length (Mushin: +1 s).', stackable: true, flags: { 't_iai.damage': 60, 't_iai.dist': 30 } },
  { id: 'h_t_max', name: 'Deep Focus', rarity: 'gold', tags: ['Szybkość'], hero: 'takezo', desc: 'After a hit, Flow lasts 1.5 s more.', stackable: true, flags: { 'rhythm.flow': 1.5 } },
  { id: 'h_t_niten', name: 'Niten Ichi', rarity: 'prism', tags: ['Krytyk', 'Szybkość'], hero: 'takezo', desc: 'Helm Splitter strikes a second time a moment later, and Mikiri gets +10% parry chance.', flags: { 'echo.q': 1, 'passive.parry': 0.1 } },
  // Karty z osiągnięć (data/achievements.ts): w ofertach dopiero po zdobyciu osiągnięcia.
  { id: 'u_trophy', name: 'Trofeum', rarity: 'silver', tags: ['Krytyk'], unlock: 'first_boss', desc: '+10% obrażeń przeciw elitom i bossom.', stackable: true, flags: { bossDmg: 0.1 } },
  { id: 'u_butcher', name: 'Rzeźnia', rarity: 'gold', tags: ['Krytyk', 'Szybkość'], unlock: 'butcher', desc: '+20% obrażeń i +10% szybkości ataku.', stats: { might: 0.2, atkSpeed: 0.1 } },
  { id: 'u_mentor', name: 'Nauczyciel', rarity: 'silver', tags: ['Umiejętności'], unlock: 'veteran', desc: '+25% doświadczenia.', stackable: true, stats: { growth: 0.25 } },
  { id: 'u_map', name: 'Mapa skarbów', rarity: 'silver', tags: ['Szybkość'], unlock: 'seeker', desc: 'Sekrety map pojawiają się 50% częściej.', stackable: true, flags: { secretRate: 0.5 } },
  { id: 'u_smith', name: 'Kowalski pancerz', rarity: 'gold', tags: ['Tarcze'], unlock: 'smith', desc: '+4 pancerza i +30 maks. HP.', stats: { armor: 4, maxHp: 30 } },
  { id: 'u_ghost', name: 'Duch', rarity: 'prism', tags: ['Szybkość'], unlock: 'untouchable', desc: '+25% szybkości ruchu, unik odnawia się 30% szybciej.', stats: { speedBonus: 0.25 }, flags: { 'cd.dash': 0.3 } },
  { id: 'u_banner', name: 'Sztandar drużyny', rarity: 'prism', tags: ['Życie', 'Obszar'], unlock: 'party', desc: '+15% obrażeń, +30 maks. HP, +10% szybkości i obszaru.', stats: { might: 0.15, maxHp: 30, speedBonus: 0.1, area: 0.1 } },
  { id: 'u_greed', name: 'Chciwość', rarity: 'silver', tags: ['Szybkość'], unlock: 'combo', desc: '+30% złota.', stackable: true, stats: { greed: 0.3 } },
  { id: 'u_lore', name: 'Wiedza łowcy', rarity: 'gold', tags: ['Krytyk'], unlock: 'scholar', desc: '+5% szansy na krytyk i +25% obrażeń krytycznych.', stats: { crit: 0.05, critMult: 0.25 } },
  { id: 'u_eternal', name: 'Wieczność', rarity: 'gold', tags: ['Życie'], unlock: 'eternal', desc: '+1 HP na sekundę, leczysz się za 1% zadanych obrażeń.', stats: { regen: 1, lifesteal: 0.01 } },
  { id: 'u_sun', name: 'Poranne słońce', rarity: 'silver', tags: ['Obszar'], unlock: 'daily', desc: '+15% obszaru.', stackable: true, stats: { area: 0.15 } },
  { id: 'u_pact', name: 'Krwawy kontrakt', rarity: 'prism', tags: ['Klątwa', 'Krytyk'], unlock: 'gambler', cursed: true, desc: '+35% obrażeń i +20% szybkości ataku, ale wrogowie mają +20% HP.', stats: { might: 0.35, atkSpeed: 0.2 }, flags: { enemyHp: 0.2 } },
  { id: 'u_ward', name: 'Spokój', rarity: 'gold', tags: ['Krytyk', 'Tarcze'], unlock: 'flawless_level', desc: 'Po 10 s bez trafienia zadajesz +25% obrażeń.', flags: { calm: 0.25 } },
  { id: 'u_halo', name: 'Nimb', rarity: 'prism', tags: ['Tarcze', 'Życie'], unlock: 'flawless_run', desc: 'Pierwsze trafienie na każdym poziomie jest zablokowane. +20 maks. HP.', flags: { firstBlock: 1 }, stats: { maxHp: 20 } },
  { id: 'u_medal', name: 'Medal', rarity: 'gold', tags: ['Umiejętności'], unlock: 'feat_hunter', desc: '+1 karta do wyboru przy każdym awansie, +10% doświadczenia.', stats: { choices: 1, growth: 0.1 } },
  {
    id: 'h_k_inspire', name: 'Natchnienie', rarity: 'prism', tags: ['Umiejętności'], hero: 'kestra', desc: 'Przez 4 s po Deszczu strzał Q i E odnawiają się 3x szybciej.',
    hooks: {
      onAbilityCast: (run, slot) => { if (slot === 'ult') run.cardState.inspire = 4; },
      onTick: (run, dt) => {
        const t = run.cardState.inspire ?? 0;
        if (t <= 0) return;
        run.cardState.inspire = t - dt;
        run.abilities.q.cd -= dt * 2;
        run.abilities.e.cd -= dt * 2;
      },
    },
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
  s_tinder: 'tag:Ogień', s_rime: 'cd_frost', s_venom: 'ic_orbit', s_static: 'ic_chain', s_wisdom: 'gem2',
  h_k_trapper: 'ab_k_net', h_b_landing: 'ab_b_leap', h_b_chargeshield: 'ab_b_charge', h_i_blinkfire: 'ab_i_blink',
  g_prism: 'syn_all', g_reactor: 'cd_explode', g_storm: 'cd_tempest', g_spread: 'ic_orbit_evo', g_veteran: 'pi_heart',
  g_giant: 'ui_skull', g_cull: 'ic_axe_evo', c_brittle: 'cd_glass', c_haunt: 'cd_fever',
  h_k_cover: 'ab_k_rain', h_b_counter: 'ab_b_titan', h_i_vortex: 'ab_i_ring_evo',
  h_m_call: 'ab_m_raise', h_m_army: 'ab_m_raise_evo', h_m_swamp: 'ab_m_curse', h_m_lich: 'ab_m_legion_evo',
  p_catalyst: 'cd_nova', p_overdrive: 'pi_fury', c_ritual: 'cd_blood', h_k_inspire: 'ab_k_rain_evo',
  h_k_focus: 'pi_crit', h_b_fury: 'pi_fury', h_i_heat: 'ab_i_ring_evo', h_m_souls: 'ab_m_legion',
  h_t_slam: 'ab_t_slam', h_t_rhythm: 'ab_t_flurry', h_t_step: 'ab_t_step', h_t_flurry: 'ab_t_flurry_evo', h_t_iai: 'ab_t_iai', h_t_max: 'ic_katana', h_t_niten: 'ic_katana_evo',
  h_v_step: 'ab_v_step', h_v_streak: 'ab_v_dance', h_v_smoke: 'ab_v_vanish', h_v_exec: 'ab_v_exec', h_v_dance: 'ab_v_dance_evo',
  h_v_blood: 'ab_v_exec_evo', h_v_shadow: 'ab_v_step_evo', h_a_guard: 'ab_a_guard', h_a_faith: 'ab_a_sanct', h_a_step: 'ab_a_step',
  h_a_sanct: 'ab_a_sanct_evo', h_a_judge: 'ab_a_judge', h_a_shield: 'tag:Tarcze', h_a_saint: 'ab_a_guard_evo',
  u_trophy: 'ui_skull', u_butcher: 'ic_axe_evo', u_mentor: 'gem2', u_map: 'cd_gold', u_smith: 'it_plate', u_ghost: 'pi_wings',
  u_banner: 'syn_all', u_greed: 'coin', u_lore: 'pi_crit', u_eternal: 'pi_herb', u_sun: 'ic_light_evo', u_pact: 'cd_blood',
  u_ward: 'tag:Tarcze', u_halo: 'tag:Życie', u_medal: 'pi_clover',
};
for (const c of CARDS) c.icon = CARD_ICONS[c.id] ?? `tag:${c.tags[0]}`;

export const CARD_BY_ID: Record<string, CardDef> = Object.fromEntries(CARDS.map((c) => [c.id, c]));

/**
 * Blokada karty (0.61, data/unlocks.ts): złote karty ponad pierwsze `goldPerTag` swojego pierwszego tagu → `cards:<tag>`,
 * pryzmatyczne ponad pierwsze `prism` → kolejno grupy `prism:1..3`. Karty bohaterów i z osiągnięć (`unlock`) bez blokady.
 */
const CARD_LOCK: Record<string, string> = (() => {
  const out: Record<string, string> = {}, perTag: Record<string, number> = {};
  let prism = 0;
  for (const c of CARDS) {
    if (c.hero || c.unlock) continue;
    if (c.rarity === 'gold' && (perTag[c.tags[0]] = (perTag[c.tags[0]] ?? 0) + 1) > BAL.discovery.goldPerTag) out[c.id] = `cards:${c.tags[0]}`;
    if (c.rarity === 'prism' && ++prism > BAL.discovery.prism) out[c.id] = prismGroup(prism - BAL.discovery.prism - 1);
  }
  return out;
})();
/** Id odblokowania potrzebne do karty ('' = dostępna od startu). */
export const cardLock = (id: string): string => CARD_LOCK[id] ?? '';

/** Źródło oferty kart; 'fight' = wygrana walka w Ekspedycji. */
export type CardSource = 'level' | 'fight' | 'elite' | 'boss' | 'shop';

/** Rzadkość oferty: wszystkie 3 karty w ofercie mają tę samą rzadkość. */
export function rollRarity(depth: number, lvl: number, source: CardSource, luck = 0): Rarity {
  // Szczęście podnosi szansę na złote i pryzmatyczne karty (BAL.luckCards).
  let gold = BAL.goldChance(depth, lvl) + luck * BAL.luckCards.gold, prism = BAL.prismChance(depth, lvl) * (1 + luck * BAL.luckCards.prism);
  if (source === 'elite' || source === 'shop') gold += 0.1;
  if (source === 'boss') prism *= 2;
  const r = rng.next();
  if (r < prism) return 'prism';
  if (r < prism + gold || source === 'boss') return 'gold';
  return 'silver';
}

/** Karty, które można teraz wylosować (pasujący bohater i ultimate; unikalne tylko raz; bez kart zbanowanych w kolekcji). */
export function cardPool(run: Run, rarity: Rarity, exclude: string[] = []): CardDef[] {
  return CARDS.filter((c) =>
    c.rarity === rarity &&
    !run.cardBans.has(c.id) &&
    (!c.unlock || run.unlocked.has(c.unlock)) &&
    (!CARD_LOCK[c.id] || run.content.has(CARD_LOCK[c.id])) &&
    (!c.hero || c.hero === run.hero.id) &&
    (!c.ult || (c.ult === 'alt') === run.altUlt) &&
    (c.stackable || !run.cards.some((x) => x.id === c.id)) &&
    !exclude.includes(c.id));
}

export function rollOffer(run: Run, source: CardSource): { rarity: Rarity; cards: CardDef[] } {
  let rarity = rollRarity(run.depth, run.level, source, run.luck());
  let pool = cardPool(run, rarity);
  // Wszystkie unikalne karty tej rzadkości już zebrane — srebrne karty kumulowane są zawsze dostępne.
  if (pool.length === 0) { rarity = 'silver'; pool = cardPool(run, rarity); }
  const cards: CardDef[] = [];
  while (cards.length < 3 && pool.length) cards.push(pool.splice(Math.floor(rng.next() * pool.length), 1)[0]);
  // Wyczerpana pula tej rzadkości (unikalne karty już zebrane): dopełnienie do 3 kartami niższej rzadkości — zawsze jest wybór.
  for (const lower of (rarity === 'prism' ? ['gold', 'silver'] : rarity === 'gold' ? ['silver'] : []) as Rarity[]) {
    const extra = cardPool(run, lower, cards.map((c) => c.id));
    while (cards.length < 3 && extra.length) cards.push(extra.splice(Math.floor(rng.next() * extra.length), 1)[0]);
  }
  return { rarity, cards };
}
