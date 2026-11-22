import type { MusicInput } from '../types/diary';
import { searchTrackPreviews } from './musicSearch';

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
  private userVolume = 0.85;
  private isDucked = false;

  private getEffectiveGain(): number {
    return this.baseVolume * this.userVolume * (this.isDucked ? 0.25 : 1);
  }

  public setVolume(volume: number): void {
    this.userVolume = Math.max(0, Math.min(1, volume));
    if (!this.ctx || !this.masterGain) return;
    this.masterGain.gain.setTargetAtTime(
      this.getEffectiveGain(),
      this.ctx.currentTime,
      0.06
    );
  }

  public start(music: MusicInput): void {
    this.stop();

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    this.ctx = new AudioCtx();
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
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
    this.masterGain.gain.value = this.getEffectiveGain();

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
      this.playDirectAudioUrl(audioSrc, music);
      return;
    }

    // Если previewUrl ещё не подгружен — ищем настоящий 30-сек трек по исполнителю и названию
    const query = `${music.artist ?? ''} ${music.title ?? ''}`.trim();
    if (query && query !== 'Без названия') {
      this.startProceduralSoundscape(music);
      searchTrackPreviews(query)
        .then((results) => {
          if (!this.isPlaying || !this.ctx) return;
          const foundUrl = results[0]?.previewUrl;
          if (foundUrl) {
            music.previewUrl = foundUrl;
            if (this.synthTimer !== null) {
              clearInterval(this.synthTimer);
              this.synthTimer = null;
            }
            this.playDirectAudioUrl(foundUrl, music);
          }
        })
        .catch(() => {});
      return;
    }

    this.startProceduralSoundscape(music);
  }

  private playDirectAudioUrl(url: string, fallbackMusic: MusicInput): void {
    if (!this.ctx || !this.masterGain) return;
    this.baseVolume = 0.85;
    this.masterGain.gain.value = this.getEffectiveGain();

    const audio = new Audio(url);
    audio.loop = true;
    audio.crossOrigin = 'anonymous';
    this.audioEl = audio;
    this.mediaSource = this.ctx.createMediaElementSource(audio);
    this.mediaSource.connect(this.masterGain);
    audio.play().catch(() => {
      if (this.isPlaying && this.synthTimer === null) {
        this.startProceduralSoundscape(fallbackMusic);
      }
    });
  }

  public setDucking(ducked: boolean): void {
    this.isDucked = ducked;
    if (!this.ctx || !this.masterGain) return;
    this.masterGain.gain.setTargetAtTime(
      this.getEffectiveGain(),
      this.ctx.currentTime,
      0.25
    );
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
    const tag = `${music.genre} ${music.artist} ${music.title}`.toLowerCase();

    // 5 совершенно разных по вайбу и гармонии звуковых профилей
    type VibeProfile = {
      chords: number[][];
      wave: OscillatorType;
      subWave: OscillatorType;
      cutoff: number;
      pattern: 'postpunk' | 'ambient' | 'synthpop' | 'soul' | 'bossa';
    };

    let profile: VibeProfile;

    if (/(post-punk|electronic|idm|moderat|molchat|rock|storm)/.test(tag)) {
      // 1. Пост-панк / Драйвовый урбан-бит после бури (пульсирующий бас F#m - D - Bm - C#m)
      profile = {
        chords: [
          [185.0, 220.0, 277.18],
          [146.83, 185.0, 220.0],
          [123.47, 146.83, 185.0],
          [138.59, 164.81, 207.65],
        ],
        wave: 'sawtooth',
        subWave: 'square',
        cutoff: 1450,
        pattern: 'postpunk',
      };
    } else if (/(ambient|cinematic|eno|zimmer|space|sky|field)/.test(tag)) {
      // 2. Бескрайнее небо и поле (парящий кинематографичный орган-пад Dmaj9 - Asus4 - Gmaj7)
      profile = {
        chords: [
          [146.83, 220.0, 277.18, 329.63],
          [110.0, 164.81, 220.0, 246.94],
          [98.0, 146.83, 185.0, 246.94],
          [110.0, 164.81, 220.0, 293.66],
        ],
        wave: 'sine',
        subWave: 'sine',
        cutoff: 680,
        pattern: 'ambient',
      };
    } else if (/(synth|indie|m83|city|pop|roof)/.test(tag)) {
      // 3. Панорама города с крыши (светлый арпеджио-синтвейв Ebmaj7 - Cm7 - Abmaj7 - Bb)
      profile = {
        chords: [
          [155.56, 196.0, 233.08, 293.66],
          [130.81, 155.56, 196.0, 233.08],
          [207.65, 261.63, 311.13, 392.0],
          [233.08, 293.66, 349.23, 466.16],
        ],
        wave: 'triangle',
        subWave: 'sawtooth',
        cutoff: 2200,
        pattern: 'synthpop',
      };
    } else if (/(soul|grover|sunset|golden|lofi|r&b)/.test(tag)) {
      // 4. Золотой закатный час (тёплое электропианино Rhodes Fmaj7 - E7 - Am7 - Gm7)
      profile = {
        chords: [
          [174.61, 220.0, 261.63, 329.63],
          [164.81, 207.65, 246.94, 311.13],
          [220.0, 261.63, 329.63, 392.0],
          [196.0, 233.08, 293.66, 349.23],
        ],
        wave: 'sine',
        subWave: 'triangle',
        cutoff: 1150,
        pattern: 'soul',
      };
    } else {
      // 5. Солнечные коты на брусчатке (уютная щипковая босса-нова G6 - Am7 - Bm7 - E7b9)
      profile = {
        chords: [
          [196.0, 246.94, 293.66, 329.63],
          [220.0, 261.63, 329.63, 392.0],
          [246.94, 293.66, 369.99, 440.0],
          [164.81, 207.65, 293.66, 349.23],
        ],
        wave: 'triangle',
        subWave: 'sine',
        cutoff: 1600,
        pattern: 'bossa',
      };
    }

    const beatMs = Math.round(60000 / Math.max(58, music.bpm));
    const stepMs =
      profile.pattern === 'postpunk' || profile.pattern === 'synthpop'
        ? Math.max(180, Math.round(beatMs / 2))
        : profile.pattern === 'ambient'
          ? Math.round(beatMs * 1.5)
          : beatMs;

    let stepIndex = 0;

    const triggerNote = () => {
      if (!this.isPlaying || !this.ctx || !this.masterGain) return;
      const now = ctx.currentTime;
      const chord =
        profile.chords[Math.floor(stepIndex / 4) % profile.chords.length];
      const noteFreq = chord[stepIndex % chord.length];
      const dur = stepMs / 1000;

      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const env = ctx.createGain();

      osc.type = profile.wave;
      const octaveMult =
        profile.pattern === 'postpunk'
          ? stepIndex % 2 === 0
            ? 0.5
            : 1
          : profile.pattern === 'synthpop'
            ? stepIndex % 4 === 3
              ? 2
              : 1
            : 1;
      osc.frequency.setValueAtTime(noteFreq * octaveMult, now);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(profile.cutoff, now);

      const attack = profile.pattern === 'ambient' ? 0.35 : 0.025;
      const release =
        profile.pattern === 'bossa'
          ? dur * 0.75
          : profile.pattern === 'ambient'
            ? dur * 2.2
            : dur * 1.25;

      env.gain.setValueAtTime(0.001, now);
      env.gain.exponentialRampToValueAtTime(0.22, now + attack);
      env.gain.exponentialRampToValueAtTime(0.001, now + release);

      osc.connect(filter);
      filter.connect(env);
      env.connect(master);

      osc.start(now);
      osc.stop(now + release + 0.05);

      // Для Soul и Ambient одновременно берём мягкий аккордовый подклад
      if (
        (profile.pattern === 'soul' || profile.pattern === 'ambient') &&
        stepIndex % 2 === 0
      ) {
        chord.slice(0, 3).forEach((cf) => {
          const padOsc = ctx.createOscillator();
          const padGain = ctx.createGain();
          padOsc.type = profile.subWave;
          padOsc.frequency.setValueAtTime(cf, now);
          padGain.gain.setValueAtTime(0.001, now);
          padGain.gain.exponentialRampToValueAtTime(0.06, now + 0.18);
          padGain.gain.exponentialRampToValueAtTime(0.001, now + dur * 1.9);
          padOsc.connect(filter);
          padOsc.start(now);
          padOsc.stop(now + dur * 2);
        });
      }

      // Жанровая перкуссия и бас
      if (profile.pattern === 'postpunk' && stepIndex % 2 === 0) {
        const kick = ctx.createOscillator();
        const kEnv = ctx.createGain();
        kick.type = 'sine';
        kick.frequency.setValueAtTime(125, now);
        kick.frequency.exponentialRampToValueAtTime(40, now + 0.13);
        kEnv.gain.setValueAtTime(0.28, now);
        kEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        kick.connect(kEnv);
        kEnv.connect(master);
        kick.start(now);
        kick.stop(now + 0.16);
      } else if (
        profile.pattern === 'bossa' &&
        (stepIndex % 4 === 0 || stepIndex % 4 === 3)
      ) {
        // Мягкий акустический римшот/шейкер босса-новы
        const rim = ctx.createOscillator();
        const rEnv = ctx.createGain();
        rim.type = 'triangle';
        rim.frequency.setValueAtTime(stepIndex % 4 === 0 ? 92 : 640, now);
        rEnv.gain.setValueAtTime(0.11, now);
        rEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        rim.connect(rEnv);
        rEnv.connect(master);
        rim.start(now);
        rim.stop(now + 0.09);
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
