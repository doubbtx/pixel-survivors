import { sfx } from './audio';
import { Rng } from './rng';

/**
 * Muzyka proceduralna (Web Audio, ten sam kontekst co efekty): 16-krokowe takty, cztery takty progresji, warstwy
 * włączane intensywnością walki (0..1):
 *  zawsze   bas i cichy pad,
 *  > 0.25   arpeggio (wzór motywu),
 *  > 0.5    perkusja (wzór motywu: stopa, werbel, hi-hat),
 *  > 0.75   melodia (błądzenie po skali, instrument motywu).
 * Motywy (0.34): menu, każdy biom (skala, progresja, tempo, rytm, instrumenty) i osobny motyw bossa w skali biomu
 * (ostinato basu ósemkami, cztery stopy na takt, wyższe tempo). Ważne efekty przyciszają muzykę na chwilę (`duck`).
 * Ekrany ustawiają nastrój (setMood), main.ts woła update co krok. Głośność osobno od efektów (Ustawienia).
 */
export interface Mood {
  /** 0..1: spokój w menu, tłum i boss podnoszą. */
  intensity: number;
  /** Biom (skala); 0-3 kampania, 4 Pustka, -1 menu. */
  biome: number;
  boss: boolean;
}

/** Motyw: skala (półtony od toniki), tonika (Hz), progresja (stopnie), tempo, wzory 16 kroków i brzmienia. */
interface Theme {
  root: number;
  steps: number[];
  prog: number[];
  bpm: number;
  /** Wzór arpeggia: stopnie nad akordem na kolejnych ósemkach (8 pozycji). */
  arp: number[];
  /** Kroki z basem (0-15) i z perkusją. */
  bass: number[];
  kick: number[];
  snare: number[];
  hat: number[];
  lead: OscillatorType;
  pad: OscillatorType;
  /** Prawdopodobieństwo nuty melodii na szesnastkę. */
  density: number;
}

const BASS_14 = [0, 8], BASS_8THS = [0, 2, 4, 6, 8, 10, 12, 14];
const KICK_2 = [0, 8], KICK_4 = [0, 4, 8, 12], SNARE_24 = [4, 12], HAT_8 = [0, 2, 4, 6, 8, 10, 12, 14];

/** Menu, potem biomy 0-4 (łąka, bagno, pustkowie, otchłań, Pustka). */
const THEMES: Theme[] = [
  // Menu: jasna pentatonika durowa, wolno (intensywność menu jest niska, więc bez perkusji).
  { root: 130.8, steps: [0, 2, 4, 7, 9], prog: [0, 3, 1, 4], bpm: 96, arp: [0, 1, 2, 3, 2, 1, 2, 3], bass: BASS_14, kick: KICK_2, snare: SNARE_24, hat: HAT_8, lead: 'triangle', pad: 'sine', density: 0.4 },
  // Mroczna łąka: eolska, równy marsz.
  { root: 110, steps: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 2, 6], bpm: 112, arp: [0, 2, 4, 7, 4, 2, 4, 7], bass: BASS_14, kick: KICK_2, snare: SNARE_24, hat: HAT_8, lead: 'square', pad: 'triangle', density: 0.55 },
  // Nocne bagno: dorycka, kołysząca (synkopy), miękkie brzmienie.
  { root: 98, steps: [0, 2, 3, 5, 7, 9, 10], prog: [0, 3, 0, 4], bpm: 104, arp: [0, 4, 2, 6, 0, 4, 2, 7], bass: [0, 6, 10], kick: [0, 6, 10], snare: [12], hat: [2, 6, 10, 14], lead: 'triangle', pad: 'sine', density: 0.45 },
  // Spalone pustkowie: frygijska, szybciej, ostre brzmienie.
  { root: 82.4, steps: [0, 1, 3, 5, 7, 8, 10], prog: [0, 1, 0, 6], bpm: 124, arp: [0, 1, 4, 1, 0, 1, 4, 7], bass: [0, 3, 8, 11], kick: [0, 3, 8, 11], snare: SNARE_24, hat: HAT_8, lead: 'sawtooth', pad: 'triangle', density: 0.6 },
  // Otchłań: harmoniczna molowa, ciężki, wolniejszy puls.
  { root: 92.5, steps: [0, 2, 3, 5, 7, 8, 11], prog: [0, 5, 3, 4], bpm: 108, arp: [0, 2, 4, 6, 7, 6, 4, 2], bass: BASS_14, kick: [0, 10], snare: [8], hat: [4, 12], lead: 'square', pad: 'sawtooth', density: 0.5 },
  // Pustka: lokrycka, niepokojąca, rzadka melodia.
  { root: 77.8, steps: [0, 1, 3, 5, 6, 8, 10], prog: [0, 4, 1, 5], bpm: 100, arp: [0, 4, 1, 5, 0, 4, 1, 6], bass: [0, 7], kick: [0, 7], snare: [11], hat: [3, 7, 11, 15], lead: 'sine', pad: 'sawtooth', density: 0.35 },
];

/** Motyw bossa: skala i tonika biomu, ale własna progresja, ostinato basu, cztery stopy i szybsze tempo. */
function bossTheme(t: Theme): Theme {
  return { ...t, prog: [0, 0, 5, 6], bpm: 146, arp: [0, 2, 4, 2, 0, 2, 4, 7], bass: BASS_8THS, kick: KICK_4, snare: SNARE_24, hat: HAT_8, lead: 'square', density: 0.7 };
}
const BOSS_THEMES = THEMES.map(bossTheme);

const LOOKAHEAD = 0.12;

class Music {
  private mood: Mood = { intensity: 0.1, biome: -1, boss: false };
  /** Wygładzona intensywność (warstwy wchodzą i schodzą płynnie). */
  private level = 0;
  private step = 0;
  private nextT = 0;
  private gain: GainNode | null = null;
  private vol = 0.4;
  private melody = 3;
  /** Ducking: 1 = pełna głośność, mniej = przyciszona przez ważny efekt; wraca płynnie. */
  private duckLv = 1;
  private readonly rng = new Rng(7);

  constructor() {
    sfx.duck = (amount) => { this.duckLv = Math.min(this.duckLv, 1 - amount); };
  }

  setMood(m: Mood): void {
    // Zmiana motywu (menu, inny biom, boss): od początku taktu.
    if (m.biome !== this.mood.biome || m.boss !== this.mood.boss) this.step = 0;
    this.mood = m;
  }

  setVolume(v: number): void {
    this.vol = v;
    this.applyGain();
  }

  private applyGain(): void {
    if (this.gain) this.gain.gain.value = this.vol * 0.5 * this.duckLv;
  }

  private theme(): Theme {
    const i = Math.max(-1, Math.min(THEMES.length - 2, this.mood.biome)) + 1;
    return this.mood.boss && this.mood.biome >= 0 ? BOSS_THEMES[i] : THEMES[i];
  }

  update(dt: number): void {
    const ctx = sfx.context;
    if (!ctx || ctx.state !== 'running') return;
    if (!this.gain) {
      this.gain = ctx.createGain();
      this.gain.connect(ctx.destination);
      this.nextT = ctx.currentTime + 0.1;
    }
    if (this.duckLv < 1) this.duckLv = Math.min(1, this.duckLv + dt * 1.2);
    this.applyGain();
    if (this.vol <= 0) return;
    const target = this.mood.boss ? 1 : this.mood.intensity;
    this.level += (target - this.level) * Math.min(1, dt * 0.8);
    // Po przerwie (karta w tle, pauza przeglądarki) nie nadrabiamy zaległych nut.
    if (this.nextT < ctx.currentTime) this.nextT = ctx.currentTime + 0.05;
    const th = this.theme();
    while (this.nextT < ctx.currentTime + LOOKAHEAD) {
      this.playStep(th, this.nextT);
      const bpm = th.bpm + (this.mood.boss ? 0 : 14 * this.level);
      this.nextT += 60 / bpm / 4;
      this.step = (this.step + 1) % (16 * th.prog.length);
    }
  }

  /** Częstotliwość stopnia skali `deg` (może wychodzić poza oktawę) z przesunięciem o oktawy. */
  private freq(th: Theme, deg: number, octave: number): number {
    const n = th.steps.length, o = Math.floor(deg / n) + octave;
    return th.root * Math.pow(2, o + th.steps[((deg % n) + n) % n] / 12);
  }

  private playStep(th: Theme, t: number): void {
    const s = this.step % 16, chord = th.prog[Math.floor(this.step / 16) % th.prog.length], lv = this.level;
    // Bas wg wzoru motywu (ostinato bossa krótsze), pad na początku taktu.
    if (th.bass.includes(s)) this.note('square', this.freq(th, chord, 0), t, th.bass.length > 4 ? 0.12 : 0.22, 0.05);
    if (s === 0) this.note(th.pad, this.freq(th, chord + 2, 1), t, 1.6, th.pad === 'sawtooth' ? 0.014 : 0.025);
    // Arpeggio ósemkami wg wzoru.
    if (lv > 0.25 && s % 2 === 0) this.note('triangle', this.freq(th, chord + th.arp[(s / 2) % 8], 1), t, 0.14, 0.035 * Math.min(1, (lv - 0.25) * 4));
    // Perkusja wg wzoru.
    if (lv > 0.5) {
      const v = Math.min(1, (lv - 0.5) * 4);
      if (th.kick.includes(s)) this.kick(t, 0.12 * v);
      if (th.snare.includes(s)) this.noise(t, 0.09, 1800, 0.05 * v);
      if (th.hat.includes(s)) this.noise(t, 0.03, 7000, 0.018 * v);
    }
    // Melodia: błądzenie po skali, gęstość i instrument motywu.
    if (lv > 0.75 && this.rng.chance(th.density)) {
      this.melody = Math.max(0, Math.min(10, this.melody + this.rng.int(-2, 2)));
      this.note(th.lead, this.freq(th, chord + this.melody, 2), t, 0.09, (th.lead === 'sawtooth' ? 0.016 : 0.022) * Math.min(1, (lv - 0.75) * 4));
    }
  }

  private note(wave: OscillatorType, f: number, t: number, dur: number, vol: number): void {
    const ctx = sfx.context!, g = ctx.createGain(), o = ctx.createOscillator();
    o.type = wave;
    o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.gain!);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private kick(t: number, vol: number): void {
    const ctx = sfx.context!, g = ctx.createGain(), o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    o.connect(g).connect(this.gain!);
    o.start(t);
    o.stop(t + 0.16);
  }

  private noise(t: number, dur: number, freq: number, vol: number): void {
    const ctx = sfx.context!, g = ctx.createGain(), src = ctx.createBufferSource(), f = ctx.createBiquadFilter();
    src.buffer = sfx.noiseBuffer;
    f.type = 'highpass';
    f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.gain!);
    src.start(t);
    src.stop(t + dur);
  }
}

export const music = new Music();

/** Nastrój menu: własny motyw (biome -1), spokojnie. */
export const MENU_MOOD: Mood = { intensity: 0.1, biome: -1, boss: false };
