import { Renderer, W, H } from './core/renderer';
import { C } from './core/palette';
import { Input } from './core/input';
import { startLoop } from './core/loop';
import { sfx } from './core/audio';
import { loadSave, writeSave } from './core/save';
import type { App, Screen } from './ui/app';
import { MainMenu, toggleFullscreen } from './ui/menus';
import { WhatsNewScreen, pendingNews } from './ui/whats-new';
import { GameScreen } from './ui/game-screen';
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
sfx.setVolume(save.settings.volume);
music.setVolume(save.settings.music);
renderer.setFill(save.settings.scaleFill);
renderer.setZoom(save.settings.zoom);
renderer.setWorldRes(save.settings.lowFx ? 2 : 3);
setLang(save.settings.lang);
setTextSize(save.settings.textLarge);
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
const app: App = {
  r: renderer,
  input,
  save,
  loop: { fps: 0, updateMs: 0 },
  go(s) { screen = s; fadeT = FADE; input.touchControls = false; input.stick = null; },
  persist() {
    writeSave(save);
    renderer.setWorldRes(save.settings.lowFx ? 2 : 3);
    sfx.setVolume(save.settings.volume);
    music.setVolume(save.settings.music);
  },
};
// Bot testowy (tylko serwer deweloperski, `?bot=endless|expedition|tutorial`): src/dev/bot.ts.
const botParams = new URLSearchParams(location.search);
// Po aktualizacji najpierw nowości (raz), potem menu.
// Nowa gra zaczyna się od samouczka (do pominięcia w pauzie; powtórka w Ustawieniach).
screen = !save.tutorialDone && !botParams.has('bot') ? new GameScreen(app, 'kestra', 'endless', undefined, true)
  : pendingNews(app) ? new WhatsNewScreen(app) : new MainMenu(app);

const bot = import.meta.env.DEV && botParams.has('bot') ? new (await import('./dev/bot')).Bot(app, botParams) : null;

// Podgląd stanu w konsoli i w testach (tylko serwer deweloperski): window.__screen().
if (import.meta.env.DEV) (window as unknown as { __screen: () => Screen }).__screen = () => screen;

const step = (dt: number) => {
  input.pollGamepads();
  fadeT = Math.max(0, fadeT - dt);
  // Pełny ekran: F na każdym ekranie.
  if (input.pressed('fullscreen')) toggleFullscreen();
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
    screen.render();
    canvas.style.cursor = pointer.hit ? 'pointer' : '';
    if (fadeT > 0) renderer.withAlpha(fadeT / FADE, () => renderer.rect(0, 0, W, H, C.black));
  },
);
