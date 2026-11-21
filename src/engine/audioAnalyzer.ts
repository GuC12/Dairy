import type { MusicInput } from '../types/diary';

export interface AudioFileMetrics {
  bpm: number;
  energy: number;
  durationSec: number;
}

export async function analyzeAudioFile(file: File): Promise<{
  dataUrl: string;
  metrics: AudioFileMetrics;
}> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  try {
    const arrayBuffer = await file.arrayBuffer();
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new AudioCtx();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const channel = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;

    const maxSamples = Math.min(channel.length, sampleRate * 35);
    let sumSq = 0;
    const step = 4;
    let count = 0;
    for (let i = 0; i < maxSamples; i += step) {
      const v = channel[i];
      sumSq += v * v;
      count++;
    }
    const rms = Math.sqrt(sumSq / Math.max(1, count));
    const energy = Math.min(1, Math.max(0.1, rms * 3.4));

    const winSize = Math.floor(sampleRate * 0.025);
    const envelopes: number[] = [];
    for (let i = 0; i < maxSamples - winSize; i += winSize) {
      let e = 0;
      for (let j = 0; j < winSize; j += 4) {
        e += Math.abs(channel[i + j]);
      }
      envelopes.push(e / (winSize / 4));
    }

    const avgEnv =
      envelopes.reduce((a, b) => a + b, 0) / Math.max(1, envelopes.length);
    let peaks = 0;
    let cooldown = 0;
    for (let i = 1; i < envelopes.length - 1; i++) {
      if (cooldown > 0) {
        cooldown--;
        continue;
      }
      if (
        envelopes[i] > avgEnv * 1.35 &&
        envelopes[i] > envelopes[i - 1] &&
        envelopes[i] >= envelopes[i + 1]
      ) {
        peaks++;
        cooldown = 8;
      }
    }

    const analyzedSec = maxSamples / sampleRate;
    const rawBpm = analyzedSec > 2 ? (peaks / analyzedSec) * 60 : 96;
    const bpm = Math.round(Math.max(60, Math.min(165, rawBpm)));

    await ctx.close();

    return {
      dataUrl,
      metrics: {
        bpm,
        energy: Number(energy.toFixed(2)),
        durationSec: Math.round(audioBuffer.duration),
      },
    };
  } catch {
    return {
      dataUrl,
      metrics: {
        bpm: 96,
        energy: 0.5,
        durationSec: 0,
      },
    };
  }
}

export interface SpectrumMetrics {
  bass: number;
  mid: number;
  treble: number;
  energy: number;
  bars: number[];
}

/**
 * Контроллер воспроизведения дня:
 * - если есть audioDataUrl — играет реальный файл через AnalyserNode;
 * - если только ссылка — генерирует процедурный саундскейп в нужной тональности и BPM;
 * - поддерживает плавное приглушение (ducking) и выдачу MediaStream для записи видео.
 */
export class DayAudioController {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private audioEl: HTMLAudioElement | null = null;
  private mediaSource: MediaElementAudioSourceNode | null = null;
  private noiseNode: AudioBufferSourceNode | null = null;
  private synthTimer: number | null = null;
  private masterGain: GainNode | null = null;
  private clarityFilter: BiquadFilterNode | null = null;
  private streamDest: MediaStreamAudioDestinationNode | null = null;
  private freqData: Uint8Array<ArrayBuffer> | null = null;
  private isPlaying = false;
  private baseVolume = 0.35;

  public start(music: MusicInput): void {
    this.stop();

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    this.ctx = new AudioCtx();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 64;
    this.freqData = new Uint8Array(
      this.analyser.frequencyBinCount
    ) as Uint8Array<ArrayBuffer>;

    const hasAudioSource =
      (music.mode === 'file' && Boolean(music.audioDataUrl)) ||
      Boolean(music.previewUrl);

    this.masterGain = this.ctx.createGain();
    this.baseVolume = hasAudioSource ? 0.85 : 0.38;
    this.masterGain.gain.value = this.baseVolume;

    this.clarityFilter = this.ctx.createBiquadFilter();
    this.clarityFilter.type = 'lowpass';
    this.clarityFilter.frequency.value = 18500;

    this.streamDest = this.ctx.createMediaStreamDestination();

    this.masterGain.connect(this.clarityFilter);
    this.clarityFilter.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    this.analyser.connect(this.streamDest);

    this.isPlaying = true;
    this.startVinylAmbientLayer();

    const audioSrc =
      music.mode === 'file' && music.audioDataUrl
        ? music.audioDataUrl
        : music.previewUrl;

    if (audioSrc) {
      const audio = new Audio(audioSrc);
      audio.loop = true;
      audio.crossOrigin = 'anonymous';
      this.audioEl = audio;
      this.mediaSource = this.ctx.createMediaElementSource(audio);
      this.mediaSource.connect(this.masterGain);
      audio.play().catch(() => {
        if (this.isPlaying && this.synthTimer === null) {
          this.startProceduralSoundscape(music);
        }
      });
      return;
    }

    this.startProceduralSoundscape(music);
  }

  public setDucking(ducked: boolean): void {
    if (!this.ctx || !this.masterGain) return;
    const target = ducked ? this.baseVolume * 0.25 : this.baseVolume;
    this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.25);
  }

  /**
   * 0 = глухой звук сквозь «туман времени» (360 Hz), 1 = чистый звук (18500 Hz)
   */
  public setMemoryClarity(clarity: number): void {
    if (!this.ctx || !this.clarityFilter) return;
    const c = Math.max(0, Math.min(1, clarity));
    const freq = 360 * Math.pow(18500 / 360, c);
    this.clarityFilter.frequency.setTargetAtTime(
      freq,
      this.ctx.currentTime,
      0.12
    );
  }

  public getAudioStream(): MediaStream | null {
    return this.streamDest?.stream ?? null;
  }

  private startVinylAmbientLayer(): void {
    if (!this.ctx || !this.masterGain) return;
    try {
      const sr = this.ctx.sampleRate;
      const len = sr * 3;
      const buf = this.ctx.createBuffer(1, len, sr);
      const data = buf.getChannelData(0);
      let lastOut = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        // Мягкий коричневый шум + редкие виниловые микро-щелчки
        lastOut = (lastOut + 0.03 * white) / 1.03;
        const crackle = Math.random() > 0.9985 ? (Math.random() * 2 - 1) * 0.45 : 0;
        data[i] = lastOut * 0.18 + crackle;
      }

      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1100;
      filter.Q.value = 0.7;

      const gain = this.ctx.createGain();
      gain.gain.value = 0.055;

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      src.start();
      this.noiseNode = src;
    } catch {
      // ignore
    }
  }

  private startProceduralSoundscape(music: MusicInput): void {
    if (!this.ctx || !this.masterGain) return;
    const ctx = this.ctx;
    const master = this.masterGain;

    const minorChords = [
      [220.0, 261.63, 329.63],
      [174.61, 220.0, 261.63],
      [146.83, 220.0, 261.63],
      [164.81, 246.94, 329.63],
    ];
    const majorChords = [
      [261.63, 329.63, 392.0],
      [196.0, 246.94, 293.66],
      [220.0, 261.63, 329.63],
      [174.61, 220.0, 261.63],
    ];

    const progression = music.tonality === 'minor' ? minorChords : majorChords;
    const stepMs = Math.max(
      240,
      Math.round(
        (60000 / Math.max(55, music.bpm)) * (music.energy > 0.65 ? 1 : 2)
      )
    );
    let stepIndex = 0;

    const triggerNote = () => {
      if (!this.isPlaying || !this.ctx || !this.masterGain) return;
      const now = ctx.currentTime;
      const chord = progression[Math.floor(stepIndex / 2) % progression.length];
      const noteFreq = chord[stepIndex % chord.length];

      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const env = ctx.createGain();

      osc.type = music.energy > 0.65 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(
        stepIndex % 4 === 0 ? noteFreq / 2 : noteFreq,
        now
      );

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(music.energy > 0.65 ? 2100 : 920, now);

      const dur = stepMs / 1000;
      env.gain.setValueAtTime(0.001, now);
      env.gain.exponentialRampToValueAtTime(0.24, now + 0.06);
      env.gain.exponentialRampToValueAtTime(0.001, now + dur * 1.4);

      osc.connect(filter);
      filter.connect(env);
      env.connect(master);

      osc.start(now);
      osc.stop(now + dur * 1.5);

      if (music.energy > 0.6 && stepIndex % 2 === 0) {
        const kick = ctx.createOscillator();
        const kEnv = ctx.createGain();
        kick.type = 'sine';
        kick.frequency.setValueAtTime(118, now);
        kick.frequency.exponentialRampToValueAtTime(42, now + 0.14);
        kEnv.gain.setValueAtTime(0.24, now);
        kEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        kick.connect(kEnv);
        kEnv.connect(master);
        kick.start(now);
        kick.stop(now + 0.18);
      }

      stepIndex++;
    };

    triggerNote();
    this.synthTimer = window.setInterval(triggerNote, stepMs);
  }

  public getSpectrumMetrics(): SpectrumMetrics {
    if (!this.isPlaying || !this.analyser || !this.freqData) {
      return {
        bass: 0,
        mid: 0,
        treble: 0,
        energy: 0,
        bars: Array(16).fill(0.08),
      };
    }
    this.analyser.getByteFrequencyData(this.freqData);
    const len = this.freqData.length;
    const third = Math.max(1, Math.floor(len / 3));

    let bass = 0;
    let mid = 0;
    let treble = 0;

    for (let i = 0; i < len; i++) {
      const val = this.freqData[i] / 255;
      if (i < third) bass += val;
      else if (i < third * 2) mid += val;
      else treble += val;
    }

    bass /= third;
    mid /= third;
    treble /= Math.max(1, len - third * 2);
    const energy = bass * 0.45 + mid * 0.35 + treble * 0.2;

    const bars: number[] = [];
    const step = Math.max(1, Math.floor(len / 16));
    for (let i = 0; i < 16; i++) {
      const idx = Math.min(len - 1, i * step);
      bars.push(Math.max(0.08, this.freqData[idx] / 255));
    }

    return { bass, mid, treble, energy, bars };
  }

  public stop(): void {
    this.isPlaying = false;
    if (this.synthTimer !== null) {
      clearInterval(this.synthTimer);
      this.synthTimer = null;
    }
    if (this.noiseNode) {
      try {
        this.noiseNode.stop();
        this.noiseNode.disconnect();
      } catch {
        // ignore
      }
      this.noiseNode = null;
    }
    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl.src = '';
      this.audioEl = null;
    }
    if (this.mediaSource) {
      try {
        this.mediaSource.disconnect();
      } catch {
        // ignore
      }
      this.mediaSource = null;
    }
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    this.analyser = null;
    this.streamDest = null;
    this.freqData = null;
  }
}
