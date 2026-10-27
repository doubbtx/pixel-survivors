/**
 * Wyczyny: nagrody za styl gry (systems/feats.ts, liczby w BAL.feats). Poziomowe sprawdzane po bossie
 * (poziom musi trwać co najmniej BAL.feats.minTime s), bossowe przy jego śmierci, Rzeź od razu, Bez skazy na końcu wygranego runu.
 * Zdobyte liczą się w `save.feats` (Kolekcja → Wyczyny).
 */
export type FeatId = 'untouched' | 'nodash' | 'nospell' | 'onlyone' | 'speedboss' | 'edge' | 'spartan' | 'massacre' | 'combo' | 'elites' | 'flawless';

export interface FeatDef {
  id: FeatId;
  name: string;
  /** Warunek. */
  desc: string;
  /** Nagroda. */
  reward: string;
}

export const FEATS: FeatDef[] = [
  { id: 'untouched', name: 'Nietykalny', desc: 'Poziom z bossem bez jednego trafienia.', reward: 'Karta jak po bossie i +8% obrażeń do końca runu (sumuje się).' },
  { id: 'nodash', name: 'Twardziel', desc: 'Poziom z bossem bez użycia uniku.', reward: '4 odłamki i ruda gwiezdna.' },
  { id: 'nospell', name: 'Czysta broń', desc: 'Poziom z bossem bez użycia Q i E.', reward: '2 losowania kart i złoto.' },
  { id: 'onlyone', name: 'Jedna broń', desc: 'Poziom z bossem ukończony z jedną bronią.', reward: 'Dodatkowy wybór karty jak za elitę.' },
  { id: 'speedboss', name: 'Błyskawiczny łowca', desc: 'Boss pokonany w 30 s od pojawienia się.', reward: 'Dodatkowa skrzynia bossa.' },
  { id: 'edge', name: 'Na krawędzi', desc: 'Boss pokonany, gdy masz najwyżej 15% HP.', reward: 'Serce smoka i skrzynia elity.' },
  { id: 'spartan', name: 'Spartanin', desc: 'Boss pokonany na poziomie postaci 10 lub niższym.', reward: 'Unikat.' },
  { id: 'massacre', name: 'Rzeź', desc: '250 zabójstw w 30 sekund (raz na poziom).', reward: 'Natychmiastowy awans i złoto.' },
  { id: 'combo', name: 'Mistrz kombo', desc: 'Kombo 300 zabójstw bez trafienia (raz na poziom).', reward: 'Karta jak po bossie.' },
  { id: 'elites', name: 'Łowca elit', desc: '5 elit na jednym poziomie.', reward: 'Zwój kowalski i skrzynia elity.' },
  { id: 'flawless', name: 'Bez skazy', desc: 'Wygrany run (albo 3 poziomy Hardcore) bez trafienia.', reward: 'Osiągnięcie i karta Nimb.' },
];

export const FEAT_BY_ID: Record<string, FeatDef> = Object.fromEntries(FEATS.map((f) => [f.id, f]));
