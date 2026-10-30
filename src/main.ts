import { Renderer } from './core/renderer';
import { C } from './core/palette';
import { Input, setBindings, setHudScale } from './core/input';
import { startLoop } from './core/loop';
import { sfx } from './core/audio';
import { spawnEnemy } from './systems/spawner';
import { loadSave, writeSave } from './core/save';
import { grantUnlocks } from './data/unlocks';
import type { App, Screen } from './ui/app';
import { MainMenu, toggleFullscreen } from './ui/menus';
import { WhatsNewScreen, pendingNews } from './ui/whats-new';
import { GameScreen } from './ui/game-screen';
import { FlashWarningScreen } from './ui/flash-warning';
import { pointer } from './ui/widgets';
import { setLang } from './core/i18n';
import { music } from './core/music';
import { resetFontCache, setTextSize } from './core/font';
import '@fontsource/jersey-10/400.css';

/**
 * Punkt wejścia: tworzy renderer, wejście i zapis, a potem kręci pętlę ze stałym krokiem.
 * Ekrany przełącza app.go(); zmiana ekranu działa od następnego kroku.
 */
const canvas = document.getElementById('game') as HTMLCanvasElement;
const renderer = new Renderer(canvas);
const input = new Input(renderer, canvas);
const save = loadSave();
// Odblokowania zależne tylko od zapisu (np. nowy bohater za wcześniejsze wygrane) przyznawane od razu po wczytaniu.
if (grantUnlocks(save, { boss: false, acts: 0, won: false, tier: 0 }).length) writeSave(save);
sfx.setVolume(save.settings.volume);
music.setVolume(save.settings.music);
renderer.setFill(save.settings.scaleFill);
renderer.setZoom(save.settings.zoom);
renderer.setWorldRes(save.settings.lowFx ? 2 : 3);
setLang(save.settings.lang);
setTextSize(save.settings.textLarge);
setBindings(save.settings.keys);
setHudScale(save.settings.hudScale);
// Czcionka: wymuszenie wczytania (płótno samo jej nie zażąda), potem nowe pomiary szerokości napisów.
const SAMPLE = 'Aa ąćęłńóśźż ĄĆĘŁŃÓŚŹŻ';
Promise.all([document.fonts.load('12px "Jersey 10"', SAMPLE), document.fonts.load('24px "Jersey 10"', SAMPLE)]).then(resetFontCache, () => undefined);

// AudioContext wymaga gestu użytkownika.
const unlock = () => sfx.unlock();
window.addEventListener('keydown', unlock);
window.addEventListener('pointerdown', unlock);

let screen: Screen;
/** Płynne przejście między ekranami: krótkie wyciemnienie po zmianie ekranu. */
const FADE = 0.22;
let fadeT = 0;
/** Stan automatycznej jakości (updateQuality niżej). */
const QUALITY = { slowMs: 12, fastMs: 6, downAfter: 2, upAfter: 20, maxUps: 2 };
const quality = { low: false, slowT: 0, fastT: 0, ups: 0, last: performance.now() };
const app: App = {
  r: renderer,
  input,
  save,
  loop: { fps: 0, updateMs: 0, workMs: 0 },
  go(s) { screen = s; fadeT = FADE; input.touchControls = false; input.stick = null; },
  persist() {
    writeSave(save);
    renderer.setWorldRes(save.settings.lowFx || quality.low ? 2 : 3);
    sfx.setVolume(save.settings.volume);
    music.setVolume(save.settings.music);
  },
};
// Bot testowy (tylko serwer deweloperski, `?bot=endless|expedition|tutorial`): src/dev/bot.ts.
const botParams = new URLSearchParams(location.search);
// Po aktualizacji najpierw nowości (raz), potem menu.
// Nowa gra zaczyna się od samouczka (do pominięcia w pauzie; powtórka w Ustawieniach).
const first = (): Screen => (!save.tutorialDone && !botParams.has('bot') ? new GameScreen(app, 'kestra', 'endless', undefined, true)
  : pendingNews(app) ? new WhatsNewScreen(app) : new MainMenu(app));
// Przed wszystkim (raz): ostrzeżenie o błyskach z opcją ich ograniczenia.
screen = !save.settings.flashWarned && !botParams.has('bot') ? new FlashWarningScreen(app, first) : first();

const bot = import.meta.env.DEV && botParams.has('bot') ? new (await import('./dev/bot')).Bot(app, botParams) : null;

// Podgląd stanu w konsoli i w testach (tylko serwer deweloperski): window.__screen(), telemetria bieżącego runu
// window.__telemetry() (JSON do skopiowania z prawdziwej gry).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (import.meta.env.DEV) Object.assign(window, { __screen: () => screen, __sfx: sfx, __telemetry: () => JSON.stringify((screen as any).run?.telemetry ?? []), __quality: quality, __loop: () => app.loop,
  // Testy: wróg (opcjonalnie elita z cechami) obok gracza bieżącego runu.
  __spawn: (id: string, dx: number, dy: number, elite?: string[]) => { const run = (screen as any).run; return run && spawnEnemy(run, id, run.player.x + dx, run.player.y + dy, elite ? { elite } : {}); } });

/**
 * Automatyczna jakość (0.38): gdy praca klatki (logika + render) przez `downAfter` s przekracza `slowMs`, świat rysuje się
 * w rozdzielczości 2 zamiast 3 (jak Efekty oszczędne: 2.25× mniej pikseli do wypełnienia i wklejenia). Powrót po `upAfter` s
 * szybkich klatek, najwyżej `maxUps` razy na sesję (bez migania jakości). W bocie tylko z `&autoq=1` (pomiary wydajności).
 */
function updateQuality(): void {
  const now = performance.now(), dt = Math.min(0.25, (now - quality.last) / 1000), w = app.loop.workMs;
  quality.last = now;
  if (save.settings.lowFx || (botParams.has('bot') && !botParams.has('autoq'))) return;
  if (!quality.low) {
    quality.slowT = w > QUALITY.slowMs ? quality.slowT + dt : 0;
    if (quality.slowT < QUALITY.downAfter) return;
    quality.low = true;
    quality.fastT = 0;
  } else {
    quality.fastT = w < QUALITY.fastMs ? quality.fastT + dt : 0;
    if (quality.fastT < QUALITY.upAfter || quality.ups >= QUALITY.maxUps) return;
    quality.low = false;
    quality.slowT = 0;
    quality.ups++;
  }
  renderer.setWorldRes(quality.low ? 2 : 3);
}

const step = (dt: number) => {
  input.pollGamepads();
  fadeT = Math.max(0, fadeT - dt);
  // Pełny ekran: F na każdym ekranie.
  if (input.pressed('fullscreen')) toggleFullscreen();
  if (bot?.frozen) { input.endStep(); return; }
  const t0 = bot ? performance.now() : 0;
  bot?.tick(screen, dt);
  screen.update(dt);
  bot?.stepTime(performance.now() - t0);
  music.update(dt);
  input.endStep();
};
app.loop = startLoop(
  (dt) => { for (let i = bot?.turbo ?? 1; i > 0; i--) step(dt); },
  () => {
    // Podświetlenia pod myszą tylko przy myszy (dotyk i pad nie mają kursora).
    const mouse = input.lastDevice === 'kbm' && input.mouse.lastMove > 0;
    pointer.x = mouse ? input.mouse.x : -1;
    pointer.y = mouse ? input.mouse.y : -1;
    pointer.hit = false;
    pointer.down = mouse && input.mouse.down;
    screen.render();
    updateQuality();
    canvas.style.cursor = pointer.hit ? 'pointer' : '';
    if (fadeT > 0) renderer.withAlpha(fadeT / FADE, () => renderer.cover(C.black));
  },
);
// Ekran ładowania z index.html znika, gdy gra rysuje pierwszą klatkę.
document.getElementById('splash')?.remove();
