import { C } from '../core/palette';

/**
 * Zadania w trakcie poziomu (systems/tasks.ts, liczby w BAL.tasks): co jakiś czas obok gracza pojawia się kamień zadania.
 * Dotknięcie go zaczyna zadanie z zegarem; wykonane daje nagrodę, część porażek przyzywa karną falę.
 *  hunt     zabij przywołaną elitę przed końcem czasu
 *  totem    obroń totem: wrogowie obok niego go niszczą
 *  circle   spędź łącznie `need` s w kręgu
 *  dodge    nie daj się trafić do końca czasu
 *  element  zabij `need` wrogów pod wpływem żywiołu (tylko gdy build nakłada jakiś żywioł)
 */
export type TaskKind = 'hunt' | 'totem' | 'circle' | 'dodge' | 'element';
export type TaskReward = 'chest' | 'card' | 'gold';

export interface TaskDef {
  kind: TaskKind;
  name: string;
  /** Krótki opis na banerze przy starcie. */
  desc: string;
  /** Czas na wykonanie (s). */
  time: number;
  /** Cel liczbowy (sekundy w kręgu, zabójstwa); 0 = brak. */
  need: number;
  reward: TaskReward;
  /** Porażka przyzywa karną falę (elity i okrążenie). */
  failWave: boolean;
}

export const TASKS: TaskDef[] = [
  { kind: 'hunt', name: 'Łowy', desc: 'Zabij elitę przed końcem czasu', time: 20, need: 0, reward: 'chest', failWave: true },
  { kind: 'totem', name: 'Obrona totemu', desc: 'Stój przy totemie i nie daj go zniszczyć', time: 25, need: 0, reward: 'card', failWave: true },
  { kind: 'circle', name: 'Krąg mocy', desc: 'Stój w kręgu przez 10 s', time: 25, need: 10, reward: 'gold', failWave: false },
  { kind: 'dodge', name: 'Bez skazy', desc: 'Nie daj się trafić przez 20 s', time: 20, need: 0, reward: 'card', failWave: true },
  { kind: 'element', name: 'Próba żywiołu', desc: 'Zabijaj wrogów pod wpływem żywiołu', time: 30, need: 25, reward: 'chest', failWave: false },
];

export const REWARD_LABEL: Record<TaskReward, { name: string; color: number }> = {
  chest: { name: 'skrzynia', color: C.gold },
  card: { name: 'karta', color: C.lavender },
  gold: { name: 'złoto', color: C.yellow },
};
