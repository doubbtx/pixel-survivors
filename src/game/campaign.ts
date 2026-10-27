import { addHardcoreEntry, heroRecord, type SaveData } from '../core/save';
import type { SlotMode } from './run';

interface RunSummary {
  hero: string;
  depth: number;
  totalTime: number;
  kills: number;
  level: number;
  /** Ekspedycja: ukończone węzły. */
  expedition?: { cleared: number };
}

/**
 * Koniec runu w slocie trybu (śmierć, poddanie, porzucenie, ukończona Ekspedycja): rekordy bohatera i wyczyszczenie slotu.
 * Hardcore dodaje wpis do tablicy rekordów. Wyjście z gry w trakcie poziomu nie kończy runu — poziom wznawia się z zapisu.
 */
export function endSlotRun(save: SaveData, mode: SlotMode, r: RunSummary): void {
  const rec = heroRecord(save, r.hero);
  if (mode === 'hardcore') {
    addHardcoreEntry(save, { hero: r.hero, depth: r.depth, time: r.totalTime, kills: r.kills, level: r.level, date: new Date().toISOString().slice(0, 10) });
    rec.bestDepth = Math.max(rec.bestDepth, r.depth);
    rec.runs++;
  } else if (mode === 'endless') {
    rec.bestEndless = Math.max(rec.bestEndless, r.totalTime);
  } else {
    rec.bestExpedition = Math.max(rec.bestExpedition, r.expedition?.cleared ?? 0);
  }
  save.slots[mode] = null;
}
