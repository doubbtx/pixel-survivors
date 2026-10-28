import type { Renderer } from '../core/renderer';
import { C } from '../core/palette';
import { drawText, textWidth, wrapText } from '../core/font';
import { drawSprite } from '../gfx/sprites';
import type { AbilityDef, AbilitySlot } from '../data/heroes';
import { slot } from './widgets';

/** Klawisz umiejętności w opisach. */
export const SKILL_KEY: Record<AbilitySlot, string> = { q: 'Q', e: 'E', dash: 'Spacja', ult: 'R' };

export interface SkillEntry {
  def: AbilityDef;
  /** Poziom w runie (brak = opis z wyboru bohatera). */
  level?: number;
  /** Odnowienie albo ładowanie (gotowy tekst). */
  cd: string;
  /** Pokazać ewolucję (warunek i efekt) pod opisem. */
  evo: boolean;
}

const SMALL = { scale: 0.75 } as const;
const LINE = 8;

/**
 * Lista umiejętności z opisami: ikona, klawisz, nazwa, poziom i odnowienie w pierwszym wierszu, opis małym tekstem,
 * opcjonalnie ewolucja (synergia, która ją odblokowuje, i efekt). Zwraca dolną krawędź.
 */
export function drawSkills(r: Renderer, list: SkillEntry[], x: number, y: number, w: number): number {
  const g = r.g, tw = (w - 26) / SMALL.scale;
  for (const s of list) {
    const d = s.def;
    slot(r, x, y, 18, d.color);
    drawSprite(g, d.icon, x + 9, y + 9);
    const tx = x + 24;
    drawText(g, `[${SKILL_KEY[d.slot]}]`, tx, y - 1, C.lavender);
    drawText(g, d.name, tx + textWidth(`[${SKILL_KEY[d.slot]}]`) + 4, y - 1, d.color);
    const info = s.level !== undefined && d.maxLevel > 1 ? `poz. ${s.level}/${d.maxLevel}   ${s.cd}` : s.cd;
    drawText(g, info, x + w, y - 1, C.lgray, { align: 'right', ...SMALL });
    let ly = y + 10;
    for (const line of wrapText(d.desc, tw)) { drawText(g, line, tx, ly, C.white, SMALL); ly += LINE; }
    if (s.evo && d.evo) {
      const t = d.evolved ? 'Ewolucja aktywna.' : `Ewolucja (synergia ${d.evo.tag}): ${d.evo.name}. ${d.evo.desc}`;
      for (const line of wrapText(t, tw)) { drawText(g, line, tx, ly, d.evolved ? C.gold : C.yellow, SMALL); ly += LINE; }
    }
    y = Math.max(y + 22, ly + 4);
  }
  return y;
}
