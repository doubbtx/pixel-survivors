import { C } from '../core/palette';
import type { Renderer } from '../core/renderer';
import { ELEMENTS, type Element } from '../data/elements';

/**
 * Znaczniki żywiołów dla daltonistów (Ustawienia: kształty żywiołów): każdy żywioł ma inny kształt 5×5 na czarnym tle,
 * nie tylko kolor. Ogień: trójkąt, lód: romb, błyskawica: zygzak, trucizna: kropla.
 */
const SHAPES: Record<Element, string[]> = {
  fire: ['..#..', '..#..', '.###.', '.###.', '#####'],
  ice: ['..#..', '.###.', '#####', '.###.', '..#..'],
  lightning: ['...##', '..##.', '.###.', '.##..', '##...'],
  poison: ['..#..', '.###.', '#####', '#####', '.###.'],
};

/** Znacznik żywiołu ze środkiem w (x, y). */
export function drawElemMark(r: Renderer, el: Element, x: number, y: number): void {
  const rows = SHAPES[el], col = ELEMENTS[el].color;
  r.rect(x - 3, y - 3, 7, 7, C.black);
  rows.forEach((row, j) => { for (let i = 0; i < 5; i++) if (row[i] === '#') r.rect(x - 2 + i, y - 2 + j, 1, 1, col); });
}
