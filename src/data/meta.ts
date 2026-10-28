import type { Stats } from '../entities/types';
import { BAL } from './balance';

/**
 * Meta-progresja (Ekspedycja i Endless): każdy bohater ma własne drzewko, esencję, Paragon i prestiż.
 * Esencję zdobywa bohater na koniec runu (także po śmierci); w Endless mniej, zależnie od czasu przetrwania.
 *
 * Drzewko bohatera: 4 gałęzie tematyczne + wspólna gałąź Wyprawa (zasoby na start, mnożnik esencji).
 * Kolejność w gałęzi = wymagania (węzeł wymaga poprzedniego na poziomie 1+). Ostatni węzeł gałęzi tematycznej
 * to „klucz” (1 poziom), który zmienia działanie umiejętności — przez flagi silnika (lista w data/cards.ts).
 */

/** Zasoby dodawane na start nowego runu. */
export type StartRes = 'gold' | 'shards' | 'rerolls' | 'skips' | 'banishes' | 'cardRerolls';

export type MetaEffect =
  | { kind: 'stat'; stat: keyof Stats; per: number }
  | { kind: 'mul'; stat: keyof Stats; per: number }
  | { kind: 'flag'; flag: string; per: number }
  | { kind: 'start'; res: StartRes; per: number }
  | { kind: 'essence'; per: number };

export interface MetaNode {
  id: string;
  branch: string;
  name: string;
  /** Opis z {v} = łączna wartość na danym poziomie. */
  desc: string;
  icon: string;
  max: number;
  /** Koszt pierwszego poziomu; każdy kolejny × BAL.meta.costGrowth. */
  cost: number;
  effect: MetaEffect;
  pct: boolean;
  /** Węzeł-klucz: zmienia działanie umiejętności. */
  key?: boolean;
}

const N = (id: string, branch: string, name: string, icon: string, max: number, cost: number, effect: MetaEffect, desc: string, pct: boolean): MetaNode =>
  ({ id, branch, name, icon, max, cost, effect, desc, pct });
const stat = (s: keyof Stats, per: number): MetaEffect => ({ kind: 'stat', stat: s, per });
const flag = (f: string, per: number): MetaEffect => ({ kind: 'flag', flag: f, per });
/** Klucz gałęzi: 1 poziom, efekt opisany słownie. */
const KEY = (id: string, branch: string, name: string, icon: string, cost: number, effect: MetaEffect, desc: string): MetaNode =>
  ({ id, branch, name, icon, max: 1, cost, effect, desc, pct: false, key: true });

/** Gałąź wspólna dla wszystkich bohaterów (poziomy liczone osobno dla każdego). */
const EXPEDITION: MetaNode[] = [
  N('w_gold', 'Wyprawa', 'Sakiewka', 'coin', 5, 15, { kind: 'start', res: 'gold', per: 25 }, '+{v} złota na start', false),
  N('w_shards', 'Wyprawa', 'Kowal', 'sh_shard', 5, 25, { kind: 'start', res: 'shards', per: 3 }, '+{v} odłamków na start', false),
  N('w_reroll', 'Wyprawa', 'Plan B', 'sh_dice', 3, 30, { kind: 'start', res: 'rerolls', per: 1 }, '+{v} losowania przy awansie', false),
  N('w_cards', 'Wyprawa', 'Talia', 'sh_card', 3, 40, { kind: 'start', res: 'cardRerolls', per: 1 }, '+{v} losowania karty', false),
  N('w_legacy', 'Wyprawa', 'Dziedzictwo', 'syn_all', 5, 50, { kind: 'essence', per: 0.1 }, '+{v} esencji z wypraw', true),
];

export const HERO_TREES: Record<string, MetaNode[]> = {
  kestra: [
    N('k_crit', 'Krytyki', 'Precyzja', 'pi_crit', 5, 20, stat('crit', 0.02), '+{v} szansy na krytyk', true),
    N('k_critmult', 'Krytyki', 'Rzeź', 'ic_axe_evo', 5, 25, stat('critMult', 0.1), '+{v} obrażeń krytycznych', true),
    N('k_extra', 'Krytyki', 'Sokół', 'ic_arrow_evo', 3, 40, flag('passive.extra', 1), '+{v} strzały Sokolego oka', false),
    N('k_giant', 'Krytyki', 'Łowca', 'ui_skull', 5, 35, flag('bossDmg', 0.06), '+{v} obrażeń przeciw elitom i bossom', true),
    KEY('k_hawk', 'Krytyki', 'Jastrząb', 'pi_crit', 600, flag('passive.n', 1), 'Sokole oko co 3. strzał zamiast co 4.'),
    N('k_area', 'Zasięg', 'Rozmach', 'pi_lens', 5, 20, stat('area', 0.04), '+{v} obszaru', true),
    N('k_proj', 'Zasięg', 'Cięciwa', 'ic_arrow', 5, 25, stat('projSpeed', 0.08), '+{v} szybkości pocisków', true),
    N('k_volley', 'Zasięg', 'Wachlarz', 'ab_k_volley', 5, 30, flag('k_volley.count', 1), '+{v} strzał Salwy', false),
    N('k_rain', 'Zasięg', 'Chmura', 'ab_k_rain', 5, 35, flag('k_rain.radius', 6), '+{v} promienia Deszczu strzał', false),
    KEY('k_pierce', 'Zasięg', 'Przeszycie', 'ab_k_volley_evo', 600, flag('k_volley.pierce', 20), 'Strzały Salwy przebijają wszystkich wrogów.'),
    N('k_move', 'Mobilność', 'Lekki krok', 'pi_wings', 5, 20, stat('speedBonus', 0.04), '+{v} szybkości ruchu', true),
    N('k_rollcd', 'Mobilność', 'Refleks', 'ab_k_roll', 5, 25, flag('cd.dash', 0.08), 'Przewrót odnawia się {v} szybciej', true),
    N('k_rolldist', 'Mobilność', 'Skok', 'ab_k_roll', 5, 25, flag('k_roll.dist', 8), '+{v} zasięgu Przewrotu', false),
    N('k_evade', 'Mobilność', 'Unik', 'tag:Szybkość', 5, 35, flag('dmgTaken', 0.02), '-{v} otrzymywanych obrażeń', true),
    KEY('k_reset', 'Mobilność', 'Kontra', 'cd_echo', 600, flag('dashResetQ', 0.5), 'Przewrót skraca odnowienie Salwy o połowę.'),
    N('k_netdmg', 'Pułapki', 'Kolce', 'ab_k_net', 5, 20, flag('k_net.damage', 3), '+{v} obrażeń Sieci co tick', false),
    N('k_netrad', 'Pułapki', 'Szeroka sieć', 'ab_k_net', 5, 25, flag('k_net.radius', 4), '+{v} promienia Sieci', false),
    N('k_netdur', 'Pułapki', 'Mocne liny', 'pi_hourglass', 5, 25, flag('k_net.duration', 0.4), 'Sieć trwa o {v} s dłużej', false),
    N('k_netcd', 'Pułapki', 'Zastawianie', 'pi_clock', 5, 30, flag('cd.e', 0.06), 'Sieć odnawia się {v} szybciej', true),
    KEY('k_dashnet', 'Pułapki', 'Sidła', 'ab_k_net_evo', 600, flag('dashNet', 1), 'Przewrót zostawia w miejscu startu Sieć.'),
    ...EXPEDITION,
  ],
  borgun: [
    N('b_hp', 'Wytrzymałość', 'Witalność', 'pi_heart', 5, 20, { kind: 'mul', stat: 'maxHp', per: 0.05 }, '+{v} maks. HP', true),
    N('b_armor', 'Wytrzymałość', 'Skóra', 'pi_armor', 5, 25, stat('armor', 1), '+{v} pancerza', false),
    N('b_regen', 'Wytrzymałość', 'Odnowa', 'pi_herb', 5, 30, stat('regen', 0.2), '+{v} HP na sekundę', false),
    N('b_ward', 'Wytrzymałość', 'Ochrona', 'tag:Tarcze', 5, 40, flag('dmgTaken', 0.03), '-{v} otrzymywanych obrażeń', true),
    KEY('b_undying', 'Wytrzymałość', 'Niezłomny', 'cd_phoenix', 700, flag('revive', 1), 'Raz na poziom odradzasz się po śmierci.'),
    N('b_chdmg', 'Kontratak', 'Taran', 'ab_b_charge', 5, 20, flag('b_charge.damage', 10), '+{v} obrażeń Szarży', false),
    N('b_chcd', 'Kontratak', 'Rozpęd', 'pi_clock', 5, 25, flag('cd.q', 0.06), 'Szarża odnawia się {v} szybciej', true),
    N('b_stun', 'Kontratak', 'Ogłuszenie', 'ab_b_charge_evo', 5, 30, flag('b_charge.stun', 0.15), 'Szarża ogłusza o {v} s dłużej', false),
    N('b_leech', 'Kontratak', 'Wampir', 'pi_fang', 5, 35, stat('lifesteal', 0.005), '+{v} leczenia z obrażeń', true),
    KEY('b_counter', 'Kontratak', 'Odwet', 'ab_b_slam', 600, flag('counterSlam', 3), 'Gdy oberwiesz, Wstrząs uderza sam (najwyżej co 3 s).'),
    N('b_area', 'Obszar', 'Zamach', 'pi_lens', 5, 20, stat('area', 0.04), '+{v} obszaru', true),
    N('b_slamdmg', 'Obszar', 'Ciężka ręka', 'ab_b_slam', 5, 25, flag('b_slam.damage', 8), '+{v} obrażeń Wstrząsu', false),
    N('b_slamrad', 'Obszar', 'Pęknięcia', 'ab_b_slam', 5, 25, flag('b_slam.radius', 4), '+{v} promienia Wstrząsu', false),
    N('b_titan', 'Obszar', 'Gniew', 'ab_b_titan', 5, 35, flag('b_titan.radius', 6), '+{v} promienia aury Gniewu tytana', false),
    KEY('b_double', 'Obszar', 'Wstrząsy', 'ab_b_slam_evo', 600, flag('echo.e', 1), 'Wstrząs uderza drugi raz po chwili.'),
    N('b_cap', 'Tarcza', 'Żelazo', 'it_plate', 5, 20, flag('passive.shieldCap', 0.03), 'Tarcza Żelaznej woli do +{v} HP więcej', true),
    N('b_overheal', 'Tarcza', 'Nadmiar', 'tag:Tarcze', 5, 25, flag('overhealShield', 0.06), 'Nadmiar leczenia w tarczę (maks. {v} HP)', true),
    N('b_ult', 'Tarcza', 'Furia', 'ab_b_titan', 5, 30, flag('ultGain', 0.06), 'Ultimate ładuje się {v} szybciej', true),
    N('b_bulwark', 'Tarcza', 'Mur', 'pi_armor', 5, 35, stat('armor', 1), '+{v} pancerza', false),
    KEY('b_bastion', 'Tarcza', 'Bastion', 'cd_frost', 600, flag('aegis', 15), 'Co 15 s pierwsze trafienie w ciebie jest blokowane.'),
    ...EXPEDITION,
  ],
  ignara: [
    N('i_elem', 'Ogień', 'Żar', 'tag:Ogień', 5, 20, stat('elemPower', 0.05), '+{v} siły żywiołów', true),
    N('i_fbdmg', 'Ogień', 'Płomień', 'ab_i_fireball', 5, 25, flag('i_fireball.damage', 8), '+{v} obrażeń Kuli ognia', false),
    N('i_fbrad', 'Ogień', 'Pożoga', 'ab_i_fireball', 5, 25, flag('i_fireball.radius', 3), '+{v} promienia Kuli ognia', false),
    N('i_inferno', 'Ogień', 'Ulewa ognia', 'ab_i_inferno', 5, 35, flag('i_inferno.duration', 0.5), 'Inferno trwa o {v} s dłużej', false),
    KEY('i_twin', 'Ogień', 'Bliźniacze kule', 'ab_i_fireball_evo', 600, flag('echo.q', 1), 'Kula ognia leci drugi raz po chwili.'),
    N('i_cdr', 'Echo', 'Skupienie', 'pi_clock', 5, 20, stat('cdr', 0.03), 'Umiejętności odnawiają się {v} szybciej', true),
    N('i_cdq', 'Echo', 'Szybka kula', 'ab_i_fireball', 5, 25, flag('cd.q', 0.05), 'Kula ognia odnawia się {v} szybciej', true),
    N('i_cde', 'Echo', 'Szybki krąg', 'ab_i_ring', 5, 25, flag('cd.e', 0.05), 'Pierścień ognia odnawia się {v} szybciej', true),
    N('i_ult', 'Echo', 'Natchnienie', 'ab_i_inferno', 5, 35, flag('ultGain', 0.06), 'Ultimate ładuje się {v} szybciej', true),
    KEY('i_echo', 'Echo', 'Podwójne echo', 'cd_echo', 600, flag('passive.n', 1), 'Echo mocy co 2. użycie zamiast co 3.'),
    N('i_hp', 'Bariera', 'Witalność', 'pi_heart', 5, 20, { kind: 'mul', stat: 'maxHp', per: 0.05 }, '+{v} maks. HP', true),
    N('i_armor', 'Bariera', 'Osłona', 'pi_armor', 5, 25, stat('armor', 1), '+{v} pancerza', false),
    N('i_ringdur', 'Bariera', 'Krąg', 'ab_i_ring', 5, 25, flag('i_ring.duration', 0.4), 'Pierścień ognia trwa o {v} s dłużej', false),
    N('i_blink', 'Bariera', 'Błysk', 'ab_i_blink', 5, 30, flag('cd.dash', 0.08), 'Mignięcie odnawia się {v} szybciej', true),
    KEY('i_ringshield', 'Bariera', 'Płomienna tarcza', 'ab_i_ring_evo', 600, flag('ringShield', 0.15), 'Pierścień ognia daje tarczę 15% HP.'),
    N('i_react', 'Żywioły', 'Reakcja', 'cd_explode', 5, 20, flag('reactPower', 0.08), 'Reakcje żywiołów silniejsze o {v}', true),
    N('i_burn', 'Żywioły', 'Iskry', 'tag:Ogień', 5, 25, flag('elemChance.fire', 0.02), '{v} szansy na podpalenie przy trafieniu', true),
    N('i_shock', 'Żywioły', 'Wyładowanie', 'ic_chain', 5, 30, flag('shockBonus', 0.03), 'Porażeni wrogowie dostają +{v} obrażeń', true),
    N('i_tox', 'Żywioły', 'Opary', 'ic_orbit', 5, 30, flag('elemChance.poison', 0.02), '{v} szansy na zatrucie przy trafieniu', true),
    KEY('i_catalyst', 'Żywioły', 'Katalizator', 'cd_nova', 600, flag('reactCd', 0.5), 'Reakcje odnawiają się na wrogu 2x szybciej.'),
    ...EXPEDITION,
  ],
  morwen: [
    N('mo_count', 'Przywołania', 'Zastępy', 'ab_m_raise', 3, 40, flag('m_raise.count', 1), '+{v} ducha z Przywołania', false),
    N('mo_dmg', 'Przywołania', 'Groza', 'ab_m_raise_evo', 5, 25, flag('minionDmg', 0.06), 'Sługi zadają +{v} obrażeń', true),
    N('mo_life', 'Przywołania', 'Więź', 'pi_hourglass', 5, 25, flag('m_raise.duration', 1), 'Duchy z Przywołania trwają o {v} s dłużej', false),
    N('mo_speed', 'Przywołania', 'Pośpiech', 'pi_wings', 5, 30, flag('minionSpeed', 0.05), 'Sługi są {v} szybsze', true),
    KEY('mo_echo', 'Przywołania', 'Podwójny rytuał', 'ab_m_raise_evo', 600, flag('echo.q', 1), 'Przywołanie działa drugi raz po chwili.'),
    N('mo_cdmg', 'Klątwy', 'Trucizna', 'ab_m_curse', 5, 20, flag('m_curse.damage', 3), '+{v} obrażeń Bagna dusz co tick', false),
    N('mo_crad', 'Klątwy', 'Rozlewisko', 'ab_m_curse', 5, 25, flag('m_curse.radius', 4), '+{v} promienia Bagna dusz', false),
    N('mo_cdur', 'Klątwy', 'Trwałość', 'pi_hourglass', 5, 25, flag('m_curse.duration', 0.4), 'Bagno dusz trwa o {v} s dłużej', false),
    N('mo_elem', 'Klątwy', 'Zaraza', 'ic_orbit', 5, 30, stat('elemPower', 0.05), '+{v} siły żywiołów', true),
    KEY('mo_swamps', 'Klątwy', 'Dwa bagna', 'ab_m_curse_evo', 600, flag('echo.e', 1), 'Bagno dusz pojawia się drugi raz po chwili.'),
    N('mo_move', 'Cień', 'Mgła', 'pi_wings', 5, 20, stat('speedBonus', 0.04), '+{v} szybkości ruchu', true),
    N('mo_shadecd', 'Cień', 'Zmrok', 'ab_m_shade', 5, 25, flag('cd.dash', 0.08), 'Cień odnawia się {v} szybciej', true),
    N('mo_evade', 'Cień', 'Ulotność', 'tag:Szybkość', 5, 30, flag('dmgTaken', 0.02), '-{v} otrzymywanych obrażeń', true),
    N('mo_hp', 'Cień', 'Witalność', 'pi_heart', 5, 30, { kind: 'mul', stat: 'maxHp', per: 0.05 }, '+{v} maks. HP', true),
    KEY('mo_shadow', 'Cień', 'Cienisty sługa', 'ab_m_shade', 600, flag('dashSummon', 1), 'Cień zostawia ducha-sługę.'),
    N('mo_n', 'Dusze', 'Zew', 'ab_m_raise', 5, 30, flag('passive.n', 1), 'Zew dusz o {v} zabójstw wcześniej', false),
    N('mo_legion', 'Dusze', 'Legion', 'ab_m_legion', 3, 45, flag('m_legion.count', 1), '+{v} wojownika Armii umarłych', false),
    N('mo_legdmg', 'Dusze', 'Ostrza zmarłych', 'ab_m_legion', 5, 30, flag('m_legion.damage', 8), '+{v} obrażeń wojowników Armii', false),
    N('mo_ult', 'Dusze', 'Żniwiarz', 'ab_m_legion_evo', 5, 35, flag('ultGain', 0.06), 'Ultimate ładuje się {v} szybciej', true),
    KEY('mo_eternal', 'Dusze', 'Wieczni', 'cd_phoenix', 600, flag('minionLife', 0.5), 'Wszystkie sługi żyją 50% dłużej.'),
    ...EXPEDITION,
  ],
  vesper: [
    N('ve_crit', 'Ostrza', 'Pchnięcie', 'pi_crit', 5, 20, stat('crit', 0.02), '+{v} szansy na krytyk', true),
    N('ve_critmult', 'Ostrza', 'Głębokie rany', 'ab_v_exec', 5, 25, stat('critMult', 0.1), '+{v} obrażeń krytycznych', true),
    N('ve_atk', 'Ostrza', 'Zwinne dłonie', 'ic_knives', 5, 30, stat('atkSpeed', 0.04), '+{v} szybkości ataku', true),
    N('ve_boss', 'Ostrza', 'Zlecenie', 'ui_skull', 5, 35, flag('bossDmg', 0.06), '+{v} obrażeń przeciw elitom i bossom', true),
    KEY('ve_reset', 'Ostrza', 'Łańcuch', 'ab_v_step_evo', 600, flag('passive.n', 4), 'Łowczyni odnawia Cios z cienia o 4 zabójstwa wcześniej.'),
    N('ve_stepdmg', 'Cień', 'Cichy cios', 'ab_v_step', 5, 20, flag('v_step.damage', 8), '+{v} obrażeń Ciosu z cienia', false),
    N('ve_stepcd', 'Cień', 'Bez śladu', 'pi_clock', 5, 25, flag('cd.q', 0.06), 'Cios z cienia odnawia się {v} szybciej', true),
    N('ve_dashcd', 'Cień', 'Dym', 'ab_v_vanish', 5, 25, flag('cd.dash', 0.08), 'Zniknięcie odnawia się {v} szybciej', true),
    N('ve_move', 'Cień', 'Lekkie stopy', 'pi_wings', 5, 30, stat('speedBonus', 0.04), '+{v} szybkości ruchu', true),
    KEY('ve_dashreset', 'Cień', 'Widmo', 'ab_v_vanish', 600, flag('stepResetDash', 1), 'Cios z cienia od razu odnawia Zniknięcie.'),
    N('ve_gain', 'Kombo', 'Rytm', 'ab_v_dance', 5, 20, flag('res.gain', 0.08), 'Kombo rośnie {v} szybciej', true),
    N('ve_max', 'Kombo', 'Seria', 'tag:Krytyk', 5, 25, flag('res.max', 4), '+{v} maks. kombo', false),
    N('ve_execdmg', 'Kombo', 'Kat', 'ab_v_exec', 5, 30, flag('v_exec.damage', 10), '+{v} obrażeń Egzekucji', false),
    N('ve_exec', 'Kombo', 'Wyrok', 'ab_v_exec_evo', 5, 35, flag('v_exec.exec', 0.01), 'Egzekucja zabija od razu wrogów do {v} HP więcej', true),
    KEY('ve_keep', 'Kombo', 'Bez końca', 'ab_v_dance_evo', 600, flag('execKeep', 0.3), 'Egzekucja zostawia 30% kombo.'),
    N('ve_hp', 'Przetrwanie', 'Hart', 'pi_heart', 5, 20, { kind: 'mul', stat: 'maxHp', per: 0.05 }, '+{v} maks. HP', true),
    N('ve_leech', 'Przetrwanie', 'Krew za krew', 'pi_fang', 5, 25, stat('lifesteal', 0.004), 'Leczysz się za {v} zadanych obrażeń', true),
    N('ve_dance', 'Przetrwanie', 'Taniec', 'ab_v_dance', 5, 30, flag('v_dance.duration', 0.3), 'Taniec ostrzy trwa o {v} s dłużej', false),
    N('ve_ult', 'Przetrwanie', 'Żądza krwi', 'ab_v_dance_evo', 5, 35, flag('ultGain', 0.06), 'Ultimate ładuje się {v} szybciej', true),
    KEY('ve_blood', 'Przetrwanie', 'Krwawe żniwo', 'ab_v_exec_evo', 600, flag('execHeal', 0.03), 'Egzekucja leczy 3% HP za każdego zabitego.'),
    ...EXPEDITION,
  ],
  aurel: [
    N('au_count', 'Strażnicy', 'Zastęp', 'ab_a_guard', 3, 40, flag('a_guard.count', 1), '+{v} strażnik', false),
    N('au_dmg', 'Strażnicy', 'Święty miecz', 'ab_a_guard_evo', 5, 25, flag('minionDmg', 0.06), 'Sługi zadają +{v} obrażeń', true),
    N('au_life', 'Strażnicy', 'Wierność', 'pi_hourglass', 5, 25, flag('a_guard.duration', 1), 'Strażnicy trwają o {v} s dłużej', false),
    N('au_speed', 'Strażnicy', 'Skrzydła', 'pi_wings', 5, 30, flag('minionSpeed', 0.05), 'Sługi są {v} szybsze', true),
    KEY('au_echo', 'Strażnicy', 'Druga modlitwa', 'ab_a_guard_evo', 600, flag('echo.q', 1), 'Strażnicy przybywają drugi raz po chwili.'),
    N('au_sheal', 'Świątynia', 'Ukojenie', 'ab_a_sanct', 5, 20, flag('a_sanct.heal', 0.2), 'Uświęcona ziemia leczy o {v}% HP na sekundę więcej', false),
    N('au_srad', 'Świątynia', 'Szeroki krąg', 'ab_a_sanct', 5, 25, flag('a_sanct.radius', 4), '+{v} promienia Uświęconej ziemi', false),
    N('au_sdur', 'Świątynia', 'Trwałość', 'pi_hourglass', 5, 25, flag('a_sanct.duration', 0.4), 'Uświęcona ziemia trwa o {v} s dłużej', false),
    N('au_scd', 'Świątynia', 'Nabożeństwo', 'pi_clock', 5, 30, flag('cd.e', 0.06), 'Uświęcona ziemia odnawia się {v} szybciej', true),
    KEY('au_echoe', 'Świątynia', 'Dwa kręgi', 'ab_a_sanct_evo', 600, flag('echo.e', 1), 'Uświęcona ziemia pojawia się drugi raz po chwili.'),
    N('au_hp', 'Wiara', 'Krzepa', 'pi_heart', 5, 20, { kind: 'mul', stat: 'maxHp', per: 0.05 }, '+{v} maks. HP', true),
    N('au_regen', 'Wiara', 'Modlitwa', 'pi_herb', 5, 25, stat('regen', 0.2), '+{v} HP na sekundę', false),
    N('au_gain', 'Wiara', 'Gorliwość', 'tag:Życie', 5, 30, flag('res.gain', 0.08), 'Wiara rośnie {v} szybciej', true),
    N('au_power', 'Wiara', 'Łaska', 'ab_a_sanct_evo', 5, 35, flag('res.power', 0.06), 'Łaska i Sąd są {v} silniejsze', true),
    KEY('au_shield', 'Wiara', 'Opoka', 'tag:Tarcze', 600, flag('passive.shieldCap', 0.1), 'Tarcza Opiekuna może urosnąć o 10% HP więcej.'),
    N('au_jdmg', 'Sąd', 'Gniew niebios', 'ab_a_judge', 5, 20, flag('a_judge.damage', 12), '+{v} obrażeń słupów Sądu', false),
    N('au_jcount', 'Sąd', 'Wielu winnych', 'ab_a_judge', 5, 30, flag('a_judge.count', 1), '+{v} cel Sądu', false),
    N('au_jblast', 'Sąd', 'Jasność', 'ab_a_judge_evo', 5, 25, flag('a_judge.blast', 2), '+{v} promienia słupów', false),
    N('au_ult', 'Sąd', 'Pobożność', 'ab_a_judge_evo', 5, 35, flag('ultGain', 0.06), 'Ultimate ładuje się {v} szybciej', true),
    KEY('au_guardheal', 'Sąd', 'Kojące ostrza', 'ab_a_guard', 600, flag('guardHeal', 1), 'Trafienia strażników leczą 2x mocniej.'),
    ...EXPEDITION,
  ],
};

export const heroTree = (heroId: string): MetaNode[] => HERO_TREES[heroId] ?? EXPEDITION;
/** Gałęzie drzewka bohatera w kolejności. */
export const treeBranches = (heroId: string): string[] => [...new Set(heroTree(heroId).map((n) => n.branch))];

/** Rozwój jednego bohatera. */
export interface HeroMeta {
  essence: number;
  /** Cała esencja zdobyta przez bohatera (Paragon; prestiż jej nie zeruje). */
  total: number;
  nodes: Record<string, number>;
  prestige: number;
}

/** Stan meta-progresji w zapisie (core/save.ts): rozwój per bohater i pula esencji do rozdania (z migracji v6). */
export interface MetaState {
  heroes: Record<string, HeroMeta>;
  unassigned: number;
  /** Cała esencja dawnego wspólnego drzewka (Paragon) — przechodzi do bohatera razem z pulą. */
  legacy?: number;
}

export function heroMeta(m: MetaState, heroId: string): HeroMeta {
  return (m.heroes[heroId] ??= { essence: 0, total: 0, nodes: {}, prestige: 0 });
}

export function nodeCost(n: MetaNode, level: number): number {
  return Math.round(n.cost * Math.pow(BAL.meta.costGrowth, level));
}

/** Poprzedni węzeł w gałęzi (null dla pierwszego). */
export function prevNode(tree: MetaNode[], n: MetaNode): MetaNode | null {
  const branch = tree.filter((x) => x.branch === n.branch);
  const i = branch.indexOf(n);
  return i > 0 ? branch[i - 1] : null;
}

/** Poziom poprzedniego węzła potrzebny do odblokowania następnego: co najmniej połowa jego maksimum (w górę). */
export function unlockLevel(prev: MetaNode): number {
  return Math.ceil(prev.max * BAL.meta.unlockFrac);
}

/** Węzeł wymaga poprzedniego w swojej gałęzi rozwiniętego co najmniej do połowy (`unlockLevel`). */
export function nodeUnlocked(h: HeroMeta, tree: MetaNode[], n: MetaNode): boolean {
  const prev = prevNode(tree, n);
  return !prev || (h.nodes[prev.id] ?? 0) >= unlockLevel(prev);
}

export function nodeLine(n: MetaNode, level: number): string {
  if (n.key) return n.desc;
  const v = n.effect.per * Math.max(1, level);
  return n.desc.replace('{v}', n.pct ? `${Math.round(v * 1000) / 10}%` : String(Math.round(v * 10) / 10));
}

/** Poziom Paragonu z całej zdobytej esencji (rośnie bez limitu, coraz wolniej). */
export function paragonLevel(total: number): number {
  return Math.floor(Math.sqrt(total / BAL.meta.paragonDiv));
}

/** Esencja wydana w drzewku bohatera (warunek prestiżu). */
export function spentEssence(h: HeroMeta, tree: MetaNode[]): number {
  let s = 0;
  for (const n of tree) for (let l = 0; l < (h.nodes[n.id] ?? 0); l++) s += nodeCost(n, l);
  return s;
}

/** Zbiorcze efekty meta dla runu: statystyki, mnożniki, flagi i zasoby startowe. */
export interface MetaBonus {
  stats: Partial<Stats>;
  mul: Partial<Stats>;
  flags: Record<string, number>;
  start: Partial<Record<StartRes, number>>;
  essenceMul: number;
}

export function metaBonus(h: HeroMeta, tree: MetaNode[]): MetaBonus {
  const b: MetaBonus = { stats: {}, mul: {}, flags: {}, start: {}, essenceMul: 1 + BAL.meta.prestigeEssence * h.prestige };
  for (const n of tree) {
    const lvl = h.nodes[n.id] ?? 0;
    if (!lvl) continue;
    const v = n.effect.per * lvl, e = n.effect;
    if (e.kind === 'stat') b.stats[e.stat] = (b.stats[e.stat] ?? 0) + v;
    else if (e.kind === 'mul') b.mul[e.stat] = (b.mul[e.stat] ?? 1) * (1 + v);
    else if (e.kind === 'flag') b.flags[e.flag] = (b.flags[e.flag] ?? 0) + v;
    else if (e.kind === 'start') b.start[e.res] = (b.start[e.res] ?? 0) + v;
    else b.essenceMul += v;
  }
  // Paragon i prestiż: procent obrażeń i maks. HP.
  const pct = BAL.meta.paragonPct * paragonLevel(h.total) + BAL.meta.prestigePct * h.prestige;
  b.stats.might = (b.stats.might ?? 0) + pct;
  b.mul.maxHp = (b.mul.maxHp ?? 1) * (1 + pct);
  return b;
}

/** Esencja za Ekspedycję: głębokość, czas, zabójstwa, poziom postaci, ukończone mapy (× mnożnik z drzewka i prestiżu). */
export function runEssence(r: { depth: number; totalTime: number; kills: number; level: number }, cleared: number, mul: number): number {
  const M = BAL.meta;
  return Math.round((r.depth * M.essencePerDepth + r.totalTime / M.essenceSecDiv + r.kills / M.essenceKillDiv + r.level * M.essencePerLevel + cleared * M.essencePerMap) * mul);
}
