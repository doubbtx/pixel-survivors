import type { SaveData } from '../core/save';
import type { Run } from '../game/run';
import { HEROES } from './heroes';
import { BESTIARY } from './bestiary';

/**
 * Osiągnięcia: sprawdzane w trakcie runu (ui/game-screen.ts), zapisane w `save.achievements`.
 * Każde odblokowuje kartę (CardDef.unlock = id osiągnięcia), która od tej chwili może wypaść w ofertach.
 */
export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  /** Karta odblokowana tym osiągnięciem (data/cards.ts). */
  card: string;
  check: (run: Run, save: SaveData) => boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_boss', name: 'Pierwsza krew', desc: 'Pokonaj bossa.', card: 'u_trophy', check: (run) => run.bossKills >= 1 },
  { id: 'butcher', name: 'Rzeźnik', desc: '1000 zabójstw w jednym runie.', card: 'u_butcher', check: (run) => run.kills >= 1000 },
  { id: 'veteran', name: 'Weteran', desc: 'Osiągnij 30. poziom postaci w runie.', card: 'u_mentor', check: (run) => run.level >= 30 },
  { id: 'seeker', name: 'Poszukiwacz', desc: 'Odkryj pierwszy sekret z Księgi sekretów.', card: 'u_map', check: (_r, save) => save.collection.secrets.length >= 1 },
  { id: 'smith', name: 'Mistrz kuźni', desc: 'Ulepsz przedmiot do +10.', card: 'u_smith', check: (run) => Object.values(run.equipment).some((i) => (i?.peak ?? i?.upg ?? 0) >= 10) },
  { id: 'untouchable', name: 'Nietykalny', desc: 'Pokonaj bossa, nie dając się trafić w trakcie walki.', card: 'u_ghost', check: (run) => run.noHitBosses >= 1 },
  { id: 'party', name: 'Drużyna', desc: 'Pokonaj bossa każdym bohaterem.', card: 'u_banner', check: (_r, save) => HEROES.every((h) => h.id in save.pacts.best) },
  { id: 'combo', name: 'Kombinator', desc: 'Kombo 200 zabójstw bez oberwania.', card: 'u_greed', check: (run) => run.combo >= 200 },
  { id: 'scholar', name: 'Badacz', desc: 'Poznaj każdego wroga w bestiariuszu.', card: 'u_lore', check: (_r, save) => BESTIARY.every((b) => (save.bestiary[b.id] ?? 0) >= b.know) },
  { id: 'eternal', name: 'Nieśmiertelny', desc: 'Przetrwaj 15 minut w trybie Endless.', card: 'u_eternal', check: (run) => run.mode === 'endless' && run.totalTime >= 900 },
  { id: 'daily', name: 'Codzienność', desc: 'Ukończ wyzwanie dnia.', card: 'u_sun', check: (run) => run.daily && run.bossKills >= 1 },
  { id: 'flawless_level', name: 'Nietykalny', desc: 'Wyczyn Nietykalny: poziom z bossem bez trafienia.', card: 'u_ward', check: (run) => run.featsRun.includes('untouched') },
  { id: 'flawless_run', name: 'Bez skazy', desc: 'Wyczyn Bez skazy: wygrany run bez jednego trafienia.', card: 'u_halo', check: (run) => run.featsRun.includes('flawless') },
  { id: 'feat_hunter', name: 'Łowca wyczynów', desc: 'Zdobądź 6 różnych wyczynów (Kolekcja, Wyczyny).', card: 'u_medal', check: (_r, save) => Object.keys(save.feats).length >= 6 },
  { id: 'gambler', name: 'Ryzykant', desc: 'Pokonaj bossa z Paktem 5 lub wyżej.', card: 'u_pact', check: (run) => run.pactLevel >= 5 && run.bossKills >= 1 },
];

export const ACHIEVEMENT_BY_ID: Record<string, AchievementDef> = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
