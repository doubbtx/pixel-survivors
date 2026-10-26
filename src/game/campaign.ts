import { addHardcoreEntry, heroRecord, type SaveData } from '../core/save';

interface RunSummary {
  hero: string;
  depth: number;
  totalTime: number;
  kills: number;
  level: number;
}

/**
 * Koniec runu Hardcore (śmierć albo poddanie): wpis do tablicy rekordów i wyczyszczenie slotu — przepada wszystko.
 * Wyjście z gry w trakcie poziomu nie kończy runu: poziom wznawia się z ostatniego zapisu (czas, zabójstwa, HP bossa).
 */
export function loseHardcoreRun(save: SaveData, r: RunSummary): void {
  addHardcoreEntry(save, { hero: r.hero, depth: r.depth, time: r.totalTime, kills: r.kills, level: r.level, date: new Date().toISOString().slice(0, 10) });
  const rec = heroRecord(save, r.hero);
  rec.bestDepth = Math.max(rec.bestDepth, r.depth);
  rec.runs++;
  save.hardcore.run = null;
}
