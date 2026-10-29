import { C } from '../core/palette';
import type { Renderer } from '../core/renderer';

/**
 * Pogoda i nastrój biomów: cząsteczki w przestrzeni ekranu (w pikselach logicznych: wołający skaluje o ZOOM), zawijane na krawędziach i przesuwane
 * z kamerą (paralaksa `par`), więc nie potrzebują stanu ani puli. Łąka: pyłki i świetliki, bagno: deszcz i mgła,
 * pustkowie: popiół i iskry, Otchłań: fioletowe drobiny, Pustka: migoczące gwiazdy. Lekkie (około 100 prostokątów), więc rysowane zawsze.
 */
export function drawWeather(r: Renderer, biome: number, t: number, camX: number, camY: number, vw: number, vh: number): void {
  // Pozycja cząstki `i`: stałe ziarno + dryf w czasie − ruch kamery (głębia `par`), zawinięta do ekranu z marginesem.
  const pos = (i: number, vx: number, vy: number, par: number): [number, number] => {
    const sx = (i * 137.3) % 997, sy = (i * 71.9) % 619;
    const x = (((sx + vx * t - camX * par) % (vw + 24)) + vw + 24) % (vw + 24) - 12;
    const y = (((sy + vy * t - camY * par) % (vh + 24)) + vh + 24) % (vh + 24) - 12;
    return [x, y];
  };
  const g = r.g;
  switch (biome) {
    case 0:
      // Pyłki dmuchawców dryfują z wiatrem, świetliki pulsują.
      for (let i = 0; i < 26; i++) {
        const [x, y] = pos(i, 9 + (i % 3) * 3, 4 + Math.sin(t + i) * 3, 0.7);
        r.withAlpha(0.6, () => r.rect(x, y + Math.sin(t * 2 + i) * 2, 1.5, 1.5, C.cream));
      }
      for (let i = 0; i < 10; i++) {
        const [x, y] = pos(i + 50, Math.sin(t * 0.5 + i) * 6, Math.cos(t * 0.4 + i) * 5, 0.9);
        const glow = 0.5 + 0.5 * Math.sin(t * 2.4 + i * 1.9);
        r.withAlpha(0.18 * glow, () => r.rect(x - 1.5, y - 1.5, 4, 4, C.lime));
        r.withAlpha(0.3 + 0.7 * glow, () => r.rect(x, y, 1, 1, C.yellow));
      }
      break;
    case 1: {
      // Mgła: szerokie, bardzo blade pasma; deszcz: ukośne smugi z rozbryzgami.
      for (let i = 0; i < 4; i++) {
        const [x, y] = pos(i + 200, 5, 0, 0.4);
        r.withAlpha(0.06, () => { g.fillStyle = '#c0cbdc'; g.beginPath(); g.ellipse(x, y, 90, 12, 0, 0, Math.PI * 2); g.fill(); });
      }
      for (let i = 0; i < 70; i++) {
        const [x, y] = pos(i, -40, 190, 1);
        r.withAlpha(0.35, () => { r.rect(x, y, 0.6, 4, C.lgray); r.rect(x - 0.6, y + 2, 0.6, 2, C.lgray); });
        if (i % 7 === 0) {
          const ph = (t * 3 + i * 0.37) % 1;
          r.withAlpha(0.4 * (1 - ph), () => r.rect(x - ph * 3, y + 8, ph * 6, 0.6, C.lgray));
        }
      }
      break;
    }
    case 2:
      // Popiół opada powoli i wiruje, iskry wznoszą się i migoczą.
      for (let i = 0; i < 55; i++) {
        const [x, y] = pos(i, 6 + Math.sin(t + i) * 8, 16, 0.8);
        r.withAlpha(0.7, () => r.rect(x, y, i % 2 ? 2 : 1.5, 1.5, i % 3 ? C.lgray : C.lavender));
      }
      for (let i = 0; i < 24; i++) {
        const [x, y] = pos(i + 90, Math.sin(t * 1.5 + i) * 10, -26, 1);
        const fl = 0.5 + 0.5 * Math.sin(t * 9 + i * 3);
        r.withAlpha(0.25 * fl, () => r.rect(x - 1, y - 1, 3, 3, C.orange));
        r.withAlpha(0.5 + 0.5 * fl, () => r.rect(x, y, 1.5, 1.5, fl > 0.6 ? C.yellow : C.orange));
      }
      break;
    case 3:
      // Drobiny Otchłani unoszą się powoli, część z poświatą.
      for (let i = 0; i < 40; i++) {
        const [x, y] = pos(i, Math.sin(t * 0.3 + i) * 4, -8, 0.6);
        const a = 0.4 + 0.3 * Math.sin(t * 1.7 + i);
        if (i % 3 === 0) r.withAlpha(a * 0.5, () => r.rect(x - 1, y - 1, 3, 3, C.plum));
        r.withAlpha(a + 0.3, () => r.rect(x, y, 1.5, 1.5, i % 4 ? C.pink : C.salmon));
      }
      break;
    case 4:
      // Pustka: gwiazdy w głębi (wolna paralaksa), migoczą krzyżykiem.
      for (let i = 0; i < 45; i++) {
        const [x, y] = pos(i, 0, 0, 0.25);
        const tw = Math.max(0, Math.sin(t * 1.3 + i * 2.7));
        r.withAlpha(0.45 + 0.55 * tw, () => r.rect(x, y, 1.5, 1.5, i % 5 ? C.lgray : C.hotpink));
        if (tw > 0.95) r.withAlpha(0.5, () => { r.rect(x - 1.5, y, 4, 0.5, C.white); r.rect(x, y - 1.5, 0.5, 4, C.white); });
      }
      break;
  }
}
