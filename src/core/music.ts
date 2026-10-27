import { sfx } from './audio';
import { Rng } from './rng';

/**
 * Muzyka proceduralna (Web Audio, ten sam kontekst co efekty): 16-krokowe takty w skali biomu, progresja
 * i - VI - III - VII, warstwy włączane intensywnością walki (0..1):
 *  zawsze   bas na 1 i 3 oraz cichy pad,
 *  > 0.25   arpeggio ósemkami po dźwiękach akordu,
 *  > 0.5    perkusja (stopa, werbel, hi-hat),
 *  > 0.75   melodia szesnastkami (błądzenie po skali, z pauzami); boss: szybsze tempo.
 * Ekrany ustawiają nastrój (setMood), main.ts woła update co krok. Głośność osobno od efektów (Ustawienia).
 */
export interface Mood {
  /** 0..1: spokój w menu, tłum i boss podnoszą. */
  intensity: number;
  /** Biom (skala); 0-3 kampania, 4 Pustka. */
  biome: number;
  boss: boolean;
}

/** Skale biomów (półtony od toniki) i tonika (Hz): eolska, dorycka, frygijska, harmoniczna, lokrycka. */
const SCALES: { root: number; steps: number[] }[] = [
  { root: 110, steps: [0, 2, 3, 5, 7, 8, 10] },
  { root: 98, steps: [0, 2, 3, 5, 7, 9, 10] },
  { root: 82.4, steps: [0, 1, 3, 5, 7, 8, 10] },
  { root: 92.5, steps: [0, 2, 3, 5, 7, 8, 11] },
  { root: 77.8, steps: [0, 1, 3, 5, 6, 8, 10] },
];
/** Progresja (stopnie skali, od 0): i - VI - III - VII, po takcie na akord. */
const PROGRESSION = [0, 5, 2, 6];
const LOOKAHEAD = 0.12;

class Music {
  private mood: Mood = { intensity: 0.1, biome: 0, boss: false };
  /** Wygładzona intensywność (warstwy wchodzą i schodzą płynnie). */
  private level = 0;
  private step = 0;
  private nextT = 0;
  private gain: GainNode | null = null;
  private vol = 0.4;
  private melody = 3;
  private readonly rng = new Rng(7);

  setMood(m: Mood): void {
    this.mood = m;
  }

  setVolume(v: number): void {
    this.vol = v;
    if (this.gain) this.gain.gain.value = v * 0.5;
  }

  update(dt: number): void {
    const ctx = sfx.context;
    if (!ctx || ctx.state !== 'running') return;
    if (!this.gain) {
      this.gain = ctx.createGain();
      this.gain.gain.value = this.vol * 0.5;
      this.gain.connect(ctx.destination);
      this.nextT = ctx.currentTime + 0.1;
    }
    if (this.vol <= 0) return;
    const target = this.mood.boss ? 1 : this.mood.intensity;
    this.level += (target - this.level) * Math.min(1, dt * 0.8);
    // Po przerwie (karta w tle, pauza przeglądarki) nie nadrabiamy zaległych nut.
    if (this.nextT < ctx.currentTime) this.nextT = ctx.currentTime + 0.05;
    while (this.nextT < ctx.currentTime + LOOKAHEAD) {
      this.playStep(this.nextT);
      const bpm = this.mood.boss ? 138 : 112 + 14 * this.level;
      this.nextT += 60 / bpm / 4;
      this.step = (this.step + 1) % 64;
    }
  }

  /** Częstotliwość stopnia skali `deg` (może wychodzić poza oktawę) z przesunięciem o oktawy. */
  private freq(deg: number, octave: number): number {
    const sc = SCALES[this.mood.biome] ?? SCALES[0];
    const n = sc.steps.length, o = Math.floor(deg / n) + octave;
    return sc.root * Math.pow(2, o + sc.steps[((deg % n) + n) % n] / 12);
  }

  private playStep(t: number): void {
    const s = this.step % 16, chord = PROGRESSION[Math.floor(this.step / 16)], lv = this.level;
    // Bas na 1 i 3, pad na początku taktu.
    if (s === 0 || s === 8) this.note('square', this.freq(chord, 0), t, 0.22, 0.05);
    if (s === 0) this.note('triangle', this.freq(chord + 2, 1), t, 1.6, 0.025);
    // Arpeggio ósemkami.
    if (lv > 0.25 && s % 2 === 0) this.note('triangle', this.freq(chord + [0, 2, 4, 7][(s / 2) % 4], 1), t, 0.14, 0.035 * Math.min(1, (lv - 0.25) * 4));
    // Perkusja.
    if (lv > 0.5) {
      const v = Math.min(1, (lv - 0.5) * 4);
      if (s % 8 === 0) this.kick(t, 0.12 * v);
      if (s % 8 === 4) this.noise(t, 0.09, 1800, 0.05 * v);
      if (s % 2 === 0) this.noise(t, 0.03, 7000, 0.018 * v);
    }
    // Melodia: błądzenie po skali szesnastkami, z pauzami.
    if (lv > 0.75 && this.rng.chance(0.55)) {
      this.melody = Math.max(0, Math.min(10, this.melody + this.rng.int(-2, 2)));
      this.note('square', this.freq(chord + this.melody, 2), t, 0.09, 0.022 * Math.min(1, (lv - 0.75) * 4));
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

/** Nastrój menu: spokojnie, łąka. */
export const MENU_MOOD: Mood = { intensity: 0.1, biome: 0, boss: false };
