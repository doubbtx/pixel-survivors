import { Renderer, W, H } from './core/renderer';
import { C } from './core/palette';
import { Input } from './core/input';
import { startLoop } from './core/loop';
import { sfx } from './core/audio';
import { loadSave, writeSave } from './core/save';
import type { App, Screen } from './ui/app';
import { MainMenu } from './ui/menus';
import { music } from './core/music';

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
    sfx.setVolume(save.settings.volume);
    music.setVolume(save.settings.music);
  },
};
screen = new MainMenu(app);

app.loop = startLoop(
  (dt) => {
    input.pollGamepads();
    fadeT = Math.max(0, fadeT - dt);
    screen.update(dt);
    music.update(dt);
    input.endStep();
  },
  () => {
    screen.render();
    if (fadeT > 0) renderer.withAlpha(fadeT / FADE, () => renderer.rect(0, 0, W, H, C.black));
    renderer.present();
  },
);
