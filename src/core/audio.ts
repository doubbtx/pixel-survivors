/**
 * Dźwięki chiptune generowane w locie przez Web Audio API (oscylatory + szum).
 * Każdy efekt ma limit częstotliwości odtwarzania, żeby setki trafień w jednej klatce
 * nie zlewały się w jeden przester.
 */
export type SfxName =
  | 'shoot' | 'hit' | 'kill' | 'pickup' | 'levelup' | 'hurt' | 'dash'
  | 'ability' | 'explode' | 'boss' | 'select' | 'chest' | 'zap'
  | 'burn' | 'freeze' | 'shock' | 'poison' | 'react' | 'hover' | 'crit' | 'streak' | 'evolve'
  | 'w_bolt' | 'w_arrow' | 'w_knife' | 'w_fire' | 'w_soul' | 'w_chain' | 'w_nova' | 'w_laser' | 'w_meteor' | 'w_boom' | 'w_mine' | 'w_cleave';

interface Tone {
  wave: OscillatorType | 'noise';
  f0: number;
  f1: number;
  dur: number;
  vol: number;
  /** Minimalny odstęp między odtworzeniami w ms. */
  gap: number;
}

const TONES: Record<SfxName, Tone[]> = {
  shoot: [{ wave: 'square', f0: 900, f1: 500, dur: 0.05, vol: 0.05, gap: 60 }],
  hit: [{ wave: 'noise', f0: 2000, f1: 800, dur: 0.04, vol: 0.06, gap: 45 }],
  kill: [{ wave: 'square', f0: 320, f1: 80, dur: 0.08, vol: 0.06, gap: 50 }],
  pickup: [{ wave: 'triangle', f0: 1200, f1: 1800, dur: 0.04, vol: 0.05, gap: 35 }],
  levelup: [
    { wave: 'square', f0: 523, f1: 523, dur: 0.08, vol: 0.08, gap: 0 },
    { wave: 'square', f0: 659, f1: 659, dur: 0.08, vol: 0.08, gap: 0 },
    { wave: 'square', f0: 784, f1: 1046, dur: 0.16, vol: 0.08, gap: 0 },
  ],
  hurt: [{ wave: 'sawtooth', f0: 220, f1: 60, dur: 0.15, vol: 0.1, gap: 120 }],
  dash: [{ wave: 'noise', f0: 600, f1: 3000, dur: 0.12, vol: 0.07, gap: 80 }],
  ability: [{ wave: 'square', f0: 300, f1: 900, dur: 0.12, vol: 0.08, gap: 60 }],
  explode: [{ wave: 'noise', f0: 900, f1: 100, dur: 0.3, vol: 0.12, gap: 70 }],
  // Boss: niski ryk z warstwą szumu i drugim, opadającym tonem.
  boss: [
    { wave: 'noise', f0: 400, f1: 60, dur: 0.35, vol: 0.16, gap: 500 },
    { wave: 'sawtooth', f0: 110, f1: 45, dur: 0.6, vol: 0.18, gap: 0 },
    { wave: 'square', f0: 70, f1: 35, dur: 0.7, vol: 0.12, gap: 0 },
  ],
  select: [{ wave: 'square', f0: 660, f1: 880, dur: 0.05, vol: 0.06, gap: 30 }],
  chest: [
    { wave: 'triangle', f0: 392, f1: 392, dur: 0.1, vol: 0.1, gap: 0 },
    { wave: 'triangle', f0: 587, f1: 784, dur: 0.25, vol: 0.1, gap: 0 },
  ],
  zap: [{ wave: 'sawtooth', f0: 1600, f1: 400, dur: 0.07, vol: 0.05, gap: 70 }],
  // Żywioły (nałożenie stanu) i reakcje.
  burn: [{ wave: 'noise', f0: 1800, f1: 500, dur: 0.08, vol: 0.04, gap: 140 }],
  freeze: [{ wave: 'triangle', f0: 1700, f1: 2600, dur: 0.07, vol: 0.04, gap: 140 }],
  shock: [{ wave: 'sawtooth', f0: 2400, f1: 900, dur: 0.04, vol: 0.035, gap: 140 }],
  poison: [{ wave: 'square', f0: 240, f1: 170, dur: 0.07, vol: 0.035, gap: 160 }],
  react: [
    { wave: 'square', f0: 520, f1: 1040, dur: 0.06, vol: 0.07, gap: 110 },
    { wave: 'noise', f0: 2500, f1: 400, dur: 0.12, vol: 0.07, gap: 0 },
  ],
  hover: [{ wave: 'triangle', f0: 880, f1: 990, dur: 0.025, vol: 0.03, gap: 40 }],
  // Uczucie mocy (0.33): ostry, wysoki trzask krytyka, fanfara serii zabójstw i narastający akord ewolucji.
  crit: [
    { wave: 'square', f0: 1500, f1: 2400, dur: 0.035, vol: 0.05, gap: 70 },
    { wave: 'noise', f0: 4000, f1: 1500, dur: 0.05, vol: 0.05, gap: 0 },
  ],
  streak: [
    { wave: 'square', f0: 440, f1: 880, dur: 0.07, vol: 0.07, gap: 300 },
    { wave: 'square', f0: 660, f1: 1320, dur: 0.12, vol: 0.07, gap: 0 },
  ],
  evolve: [
    { wave: 'triangle', f0: 262, f1: 523, dur: 0.25, vol: 0.1, gap: 400 },
    { wave: 'square', f0: 392, f1: 784, dur: 0.3, vol: 0.07, gap: 0 },
    { wave: 'triangle', f0: 523, f1: 1046, dur: 0.45, vol: 0.09, gap: 0 },
  ],
  // Bronie (0.34): każdy typ ma własne brzmienie; pociski różnią się po rodzaju (strzała, nóż, ogień, dusza, gwiazda).
  w_bolt: [{ wave: 'square', f0: 1200, f1: 700, dur: 0.05, vol: 0.035, gap: 70 }],
  w_arrow: [
    { wave: 'noise', f0: 3200, f1: 1200, dur: 0.05, vol: 0.045, gap: 70 },
    { wave: 'triangle', f0: 900, f1: 600, dur: 0.03, vol: 0.02, gap: 0 },
  ],
  w_knife: [{ wave: 'noise', f0: 5200, f1: 2600, dur: 0.035, vol: 0.04, gap: 60 }],
  w_fire: [
    { wave: 'noise', f0: 1300, f1: 400, dur: 0.08, vol: 0.05, gap: 80 },
    { wave: 'square', f0: 300, f1: 150, dur: 0.06, vol: 0.02, gap: 0 },
  ],
  w_soul: [{ wave: 'triangle', f0: 700, f1: 1150, dur: 0.09, vol: 0.035, gap: 90 }],
  w_chain: [
    { wave: 'sawtooth', f0: 1800, f1: 300, dur: 0.07, vol: 0.045, gap: 90 },
    { wave: 'noise', f0: 5000, f1: 2000, dur: 0.03, vol: 0.03, gap: 0 },
  ],
  w_nova: [{ wave: 'triangle', f0: 420, f1: 950, dur: 0.18, vol: 0.05, gap: 150 }],
  w_laser: [{ wave: 'sawtooth', f0: 900, f1: 1500, dur: 0.15, vol: 0.035, gap: 120 }],
  w_meteor: [{ wave: 'noise', f0: 600, f1: 90, dur: 0.25, vol: 0.07, gap: 150 }],
  w_boom: [{ wave: 'triangle', f0: 500, f1: 950, dur: 0.1, vol: 0.04, gap: 100 }],
  w_mine: [{ wave: 'square', f0: 220, f1: 130, dur: 0.05, vol: 0.04, gap: 120 }],
  w_cleave: [
    { wave: 'noise', f0: 2600, f1: 600, dur: 0.07, vol: 0.06, gap: 70 },
    { wave: 'square', f0: 220, f1: 110, dur: 0.05, vol: 0.025, gap: 0 },
  ],
};

/** Ważne dźwięki: zawsze grają (ponad limit głosów) i przyciszają muzykę (ducking). */
const IMPORTANT: Partial<Record<SfxName, number>> = { boss: 0.75, evolve: 0.6, levelup: 0.45, chest: 0.35, streak: 0.35, hurt: 0.25 };
/** Interfejs bez losowej wysokości (zawsze tak samo); pozostałe dźwięki mają warianty ±6%. */
const STEADY = new Set<SfxName>(['select', 'hover', 'levelup', 'chest', 'evolve', 'streak', 'boss']);
/** Najwięcej jednocześnie grających tonów efektów (tłum nie zagłusza ważnych dźwięków). */
const MAX_VOICES = 22;

class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private last: Partial<Record<SfxName, number>> = {};
  private vol = 0.5;
  private voices = 0;
  /** Ducking: ustawiane przez core/music.ts — przyciszenie muzyki o `amount` na chwilę. */
  duck: ((amount: number) => void) | null = null;

  /** AudioContext można utworzyć dopiero po geście użytkownika. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.vol;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 0.5;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  /** Kontekst i bufor szumu dla muzyki (core/music.ts); null przed pierwszym gestem użytkownika. */
  get context(): AudioContext | null {
    return this.ctx;
  }

  get noiseBuffer(): AudioBuffer | null {
    return this.noise;
  }

  setVolume(v: number): void {
    this.vol = v;
    if (this.master) this.master.gain.value = v;
  }

  /** Licznik grających głosów (limit MAX_VOICES). */
  private track(n: AudioScheduledSourceNode): void {
    this.voices++;
    n.onended = () => { this.voices--; };
  }

  play(name: SfxName): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || this.vol <= 0) return;
    const tones = TONES[name];
    const nowMs = performance.now();
    if (nowMs - (this.last[name] ?? 0) < tones[0].gap) return;
    const important = IMPORTANT[name];
    if (!important && this.voices >= MAX_VOICES) return;
    this.last[name] = nowMs;
    if (important) this.duck?.(important);
    // Warianty: lekko inna wysokość przy każdym odtworzeniu (powtarzające się trafienia nie brzmią identycznie).
    const pitch = STEADY.has(name) ? 1 : 0.94 + Math.random() * 0.12;
    let t = ctx.currentTime;
    for (const tone of tones) {
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(tone.vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + tone.dur);
      gain.connect(this.master);
      if (tone.wave === 'noise') {
        const src = ctx.createBufferSource();
        src.buffer = this.noise;
        const filt = ctx.createBiquadFilter();
        filt.type = 'bandpass';
        filt.frequency.setValueAtTime(tone.f0 * pitch, t);
        filt.frequency.exponentialRampToValueAtTime(tone.f1 * pitch, t + tone.dur);
        src.connect(filt).connect(gain);
        src.start(t);
        src.stop(t + tone.dur);
        this.track(src);
      } else {
        const osc = ctx.createOscillator();
        osc.type = tone.wave;
        osc.frequency.setValueAtTime(tone.f0 * pitch, t);
        osc.frequency.exponentialRampToValueAtTime(tone.f1 * pitch, t + tone.dur);
        osc.connect(gain);
        osc.start(t);
        osc.stop(t + tone.dur);
        this.track(osc);
      }
      t += tone.dur;
    }
  }
}

export const sfx = new Audio();
