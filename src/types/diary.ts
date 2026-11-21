export type ArtMovementId =
  | 'impressionism'
  | 'constructivism'
  | 'wabi-sabi'
  | 'film-35mm';

export type MoodTone =
  | 'warm-nostalgic'
  | 'tense-electric'
  | 'quiet-melancholy'
  | 'bright-alive';

export interface MusicInput {
  mode: 'file' | 'link';
  title: string;
  artist: string;
  genre: string;
  bpm: number;
  tonality: 'major' | 'minor';
  /** 0..1 */
  energy: number;
  url?: string;
  audioDataUrl?: string;
  fileName?: string;
}

export interface PhotoItem {
  id: string;
  dataUrl: string;
  name: string;
  dominantColors: string[];
  /** 0..1 */
  brightness: number;
  /** 0..1 */
  contrast: number;
}

export interface PaletteConfig {
  bg: string;
  surface: string;
  accent: string;
  ink: string;
  secondary: string;
}

export interface VisualParams {
  /** 0..1 плёночное зерно */
  grain: number;
  /** 0..1 мягкость / импрессионистическое размытие */
  blurSoftness: number;
  /** 0..1 жёсткость геометрической сетки */
  gridRigidity: number;
  /** 0..1 количество «воздуха» вокруг фото */
  whitespace: number;
  /** 0.3..2.5 скорость смены кадров и анимации */
  rhythmSpeed: number;
  /** 0..1 плотность мазков или геометрических фигур */
  overlayDensity: number;
  /** 0.8..1.4 контрастность изображения */
  contrastBoost: number;
}

export interface VoiceProfile {
  rate: number;
  pitch: number;
  label: string;
}

export interface LogicRuleExplanation {
  source: 'Текст' | 'Фото' | 'Музыка' | 'Синтез';
  signal: string;
  effect: string;
}

export interface AtmosphereAnalysis {
  folderName: string;
  movement: ArtMovementId;
  movementTitle: string;
  movementReference: string;
  mood: MoodTone;
  moodLabel: string;
  /** -1 (минор/холод/напряжение) .. +1 (тепло/свет) */
  valence: number;
  /** 0 (тишина) .. 1 (высокая энергия) */
  arousal: number;
  timeOfDay: 'утро' | 'день' | 'вечер' | 'ночь';
  season: 'весна' | 'лето' | 'осень' | 'зима' | 'вне сезона';
  palette: PaletteConfig;
  visualParams: VisualParams;
  voiceProfile: VoiceProfile;
  explanation: LogicRuleExplanation[];
  engineUsed: 'local' | 'gemini-2.5-flash';
}

export interface DiaryEntry {
  id: string;
  indexNumber: number;
  createdAt: string;
  dateLabel: string;
  weather?: string;
  location?: string;
  text: string;
  signature: string;
  photos: PhotoItem[];
  music: MusicInput;
  analysis: AtmosphereAnalysis;
}
