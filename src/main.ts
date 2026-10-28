import { Renderer, W, H } from './core/renderer';
import { C } from './core/palette';
import { Input } from './core/input';
import { startLoop } from './core/loop';
import { sfx } from './core/audio';
import { loadSave, writeSave } from './core/save';
import type { App, Screen } from './ui/app';
import { MainMenu, toggleFullscreen } from './ui/menus';
import { pointer } from './ui/widgets';
import { setLang } from './core/i18n';
import { music } from './core/music';
import { resetFontCache } from './core/font';
import '@fontsource/pixelify-sans/500.css';
import '@fontsource/pixelify-sans/700.css';

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
// Czcionka: wymuszenie wczytania (płótno samo jej nie zażąda), potem nowe pomiary szerokości napisów.
const SAMPLE = 'Aa ąćęłńóśźż ĄĆĘŁŃÓŚŹŻ';
Promise.all([document.fonts.load('500 10px "Pixelify Sans"', SAMPLE), document.fonts.load('700 20px "Pixelify Sans"', SAMPLE)]).then(resetFontCache, () => undefined);

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
screen = new MainMenu(app);

app.loop = startLoop(
  (dt) => {
    input.pollGamepads();
    fadeT = Math.max(0, fadeT - dt);
    // Pełny ekran: F na każdym ekranie.
    if (input.pressed('fullscreen')) toggleFullscreen();
    screen.update(dt);
    music.update(dt);
    input.endStep();
  },
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
