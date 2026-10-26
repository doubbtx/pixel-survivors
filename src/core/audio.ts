/**
 * Dźwięki chiptune generowane w locie przez Web Audio API (oscylatory + szum).
 * Każdy efekt ma limit częstotliwości odtwarzania, żeby setki trafień w jednej klatce
 * nie zlewały się w jeden przester.
 */
export type SfxName =
  | 'shoot' | 'hit' | 'kill' | 'pickup' | 'levelup' | 'hurt' | 'dash'
  | 'ability' | 'explode' | 'boss' | 'select' | 'chest' | 'zap';

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
  boss: [{ wave: 'sawtooth', f0: 90, f1: 40, dur: 0.8, vol: 0.15, gap: 500 }],
  select: [{ wave: 'square', f0: 660, f1: 880, dur: 0.05, vol: 0.06, gap: 30 }],
  chest: [
    { wave: 'triangle', f0: 392, f1: 392, dur: 0.1, vol: 0.1, gap: 0 },
    { wave: 'triangle', f0: 587, f1: 784, dur: 0.25, vol: 0.1, gap: 0 },
  ],
  zap: [{ wave: 'sawtooth', f0: 1600, f1: 400, dur: 0.07, vol: 0.05, gap: 70 }],
};

class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private last: Partial<Record<SfxName, number>> = {};
  private vol = 0.5;

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

  setVolume(v: number): void {
    this.vol = v;
    if (this.master) this.master.gain.value = v;
  }

  play(name: SfxName): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || this.vol <= 0) return;
    const tones = TONES[name];
    const nowMs = performance.now();
    if (nowMs - (this.last[name] ?? 0) < tones[0].gap) return;
    this.last[name] = nowMs;
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
        filt.frequency.setValueAtTime(tone.f0, t);
        filt.frequency.exponentialRampToValueAtTime(tone.f1, t + tone.dur);
        src.connect(filt).connect(gain);
        src.start(t);
        src.stop(t + tone.dur);
      } else {
        const osc = ctx.createOscillator();
        osc.type = tone.wave;
        osc.frequency.setValueAtTime(tone.f0, t);
        osc.frequency.exponentialRampToValueAtTime(tone.f1, t + tone.dur);
        osc.connect(gain);
        osc.start(t);
        osc.stop(t + tone.dur);
      }
      t += tone.dur;
    }
  }
}

export const sfx = new Audio();
