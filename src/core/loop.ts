/** Krok symulacji: 60 Hz, niezależnie od częstotliwości odświeżania monitora. */
export const STEP = 1 / 60;
const MAX_STEPS_PER_FRAME = 5;

export interface LoopStats {
  fps: number;
  updateMs: number;
}

/**
 * Pętla ze stałym krokiem czasowym (akumulator). Logika zawsze dostaje dt = 1/60,
 * render wykonuje się raz na klatkę przeglądarki. Przy dużym lagu (np. karta w tle)
 * ograniczamy liczbę kroków, żeby nie wpaść w "spiralę śmierci".
 */
export function startLoop(update: (dt: number) => void, render: () => void): LoopStats {
  const stats: LoopStats = { fps: 0, updateMs: 0 };
  let acc = 0;
  let last = performance.now();
  let frames = 0;
  let fpsTimer = last;

  const frame = (now: number) => {
    acc += Math.min(0.25, (now - last) / 1000);
    last = now;
    let steps = 0;
    const t0 = performance.now();
    while (acc >= STEP && steps < MAX_STEPS_PER_FRAME) {
      update(STEP);
      acc -= STEP;
      steps++;
    }
    if (steps === MAX_STEPS_PER_FRAME) acc = 0;
    if (steps > 0) stats.updateMs = (performance.now() - t0) / steps;
    render();
    frames++;
    if (now - fpsTimer >= 1000) {
      stats.fps = Math.round((frames * 1000) / (now - fpsTimer));
      frames = 0;
      fpsTimer = now;
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  return stats;
}
