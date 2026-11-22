import type {
  ArtMovementId,
  AtmosphereAnalysis,
  LogicRuleExplanation,
  MoodTone,
  MusicInput,
  PaletteConfig,
  PhotoItem,
  VisualParams,
  VoiceProfile,
} from '../types/diary';
import { getColorWarmth, hexToRgb, rgbToHex } from './photoAnalyzer';
import { searchTrackPreviews } from './musicSearch';

const MOVEMENT_META: Record<
  ArtMovementId,
  { title: string; reference: string }
> = {
  impressionism: {
    title: 'Импрессионизм / Свет и мазки',
    reference: 'Клод Моне — диффузный свет, мягкие мазки и плёночное тепло',
  },
  constructivism: {
    title: 'Конструктивизм / Геометрия ритма',
    reference: 'Василий Кандинский — жёсткая сетка, контраст, линии и импульс',
  },
  'wabi-sabi': {
    title: 'Японский минимализм / Ваби-саби',
    reference: 'Много «воздуха», приглушённые тона, созерцательная тишина',
  },
  'film-35mm': {
    title: 'Аналоговая плёнка 35mm / Коллаж',
    reference: 'Зерно, маркеры кадра, живые засветки и хроника прогулки',
  },
};

const MOOD_LABELS: Record<MoodTone, string> = {
  'warm-nostalgic': 'Тёплая ностальгия',
  'tense-electric': 'Напряжённый фокус',
  'quiet-melancholy': 'Тихая меланхолия',
  'bright-alive': 'Живое движение',
};

function mixHex(hexA: string, hexB: string, t: number): string {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  return rgbToHex(
    a.r + (b.r - a.r) * t,
    a.g + (b.g - a.g) * t,
    a.b + (b.b - a.b) * t
  );
}

function detectTimeOfDay(text: string): AtmosphereAnalysis['timeOfDay'] {
  const lower = text.toLowerCase();
  if (/(ноч|полноч|поздн|темно|фонар|бессон|02:|03:|01:)/.test(lower)) return 'ночь';
  if (/(утр|рассвет|завтрак|проснул|кофе с утр)/.test(lower)) return 'утро';
  if (/(вечер|закат|сумерк|после работ|ужин)/.test(lower)) return 'вечер';
  return 'день';
}

function detectSeason(text: string): AtmosphereAnalysis['season'] {
  const lower = text.toLowerCase();
  if (/(осен|жёлт.*лист|желт.*лист|листопад|сентябр|октябр|ноябр)/.test(lower)) return 'осень';
  if (/(зим|снег|мороз|лёд|лед|холодн.*ветер|декабр|январ|феврал)/.test(lower)) return 'зима';
  if (/(весн|апрел|май|март|капел|цвет|сирен)/.test(lower)) return 'весна';
  if (/(лет|июн|июл|август|жар|пляж|солнцепёк)/.test(lower)) return 'лето';
  return 'вне сезона';
}

function generateLocalFolderName(
  text: string,
  timeOfDay: AtmosphereAnalysis['timeOfDay'],
  season: AtmosphereAnalysis['season'],
  mood: MoodTone
): string {
  const lower = text.toLowerCase();

  // Характерные сюжетные связки (3-7 слов в едином поэтичном стиле)
  if (/(шквальн|шторм|ветки|бак)/.test(lower)) {
    return 'Двор после внезапного штормового ветра';
  }
  if (/(бесконечное небо|ангар|степн|провод)/.test(lower)) {
    return 'Большое небо на краю города';
  }
  if (/(верхнего этажа|пятиэтаж|горизонт)/.test(lower)) {
    return 'Панорама города с высоты крыш';
  }
  if (/(золотой час|велосипед|перекрёст)/.test(lower)) {
    return 'Золотой час на тихом перекрёстке';
  }
  if (/(котов|кота|брусчатк)/.test(lower)) {
    return 'Два кота и солнечные тени';
  }
  if (/офис/.test(lower) && /(сдач|проект|дедлайн|работ)/.test(lower)) {
    return 'Ночь в офисе перед сдачей';
  }
  if (/поезд/.test(lower) && /(туман|утр|море)/.test(lower)) {
    return 'Утренний поезд сквозь прибрежный туман';
  }
  if (/трамва/.test(lower) && /(дожд|огн|витрин)/.test(lower)) {
    return 'Дождливый трамвай и огни витрин';
  }

  // Извлекаем значимые образы из текста
  const motifs: Array<[RegExp, string]> = [
    [/дожд|ливень|мокры/, 'под дождём'],
    [/снег|вьюг|метел/, 'в снежном свете'],
    [/море|берег|причал|волн/, 'у тихого берега'],
    [/парк|лес|алле|дерев/, 'среди тихих аллей'],
    [/офис|экран|ноут|код|проект/, 'перед светящимся экраном'],
    [/кофе|какао|чай|кофейн/, 'с тёплой чашкой'],
    [/поезд|метро|трамва|дорог/, 'в пути по городу'],
    [/друз|разговар|вдвоём|девушк|семь/, 'в долгом разговоре'],
    [/музык|наушник|пластинк/, 'под любимый ритм'],
  ];

  const foundMotifs = motifs
    .filter(([re]) => re.test(lower))
    .map(([, label]) => label)
    .slice(0, 2);

  const timePrefix: Record<AtmosphereAnalysis['timeOfDay'], string> = {
    утро: season === 'осень' ? 'Осеннее утро' : 'Тихое утро',
    день: season === 'осень' ? 'Осенний день' : season === 'зима' ? 'Зимний день' : 'Живой день',
    вечер:
      mood === 'warm-nostalgic'
        ? 'Тёплый вечер'
        : mood === 'quiet-melancholy'
          ? 'Тихий вечер'
          : 'Вечерний свет',
    ночь: mood === 'tense-electric' ? 'Собранная ночь' : 'Поздняя ночь',
  };

  if (foundMotifs.length > 0) {
    return `${timePrefix[timeOfDay]} ${foundMotifs.join(' ')}`;
  }

  const moodSuffix: Record<MoodTone, string> = {
    'warm-nostalgic': 'и тёплые воспоминания',
    'tense-electric': 'на пределе ритма',
    'quiet-melancholy': 'в тишине мыслей',
    'bright-alive': 'в движении города',
  };

  return `${timePrefix[timeOfDay]} ${moodSuffix[mood]}`;
}

function buildPalette(
  movement: ArtMovementId,
  photos: PhotoItem[],
  timeOfDay: AtmosphereAnalysis['timeOfDay'] = 'день',
  text = ''
): PaletteConfig {
  const basePhotoColor = photos[0]?.dominantColors[0] ?? '#8b6f56';
  const accentPhotoColor = photos[0]?.dominantColors[1] ?? '#c47b45';
  const isEveningTwilight =
    timeOfDay === 'вечер' || /(гроз|винил|сумерк|закат|свеч)/i.test(text);

  switch (movement) {
    case 'impressionism':
      if (isEveningTwilight) {
        return {
          bg: mixHex('#291d3a', basePhotoColor, 0.26),
          surface: '#36274b',
          accent: mixHex('#f59e0b', accentPhotoColor, 0.35),
          ink: '#fdf2e9',
          secondary: mixHex('#ec4899', basePhotoColor, 0.35),
        };
      }
      return {
        bg: mixHex('#f7e3c4', basePhotoColor, 0.28),
        surface: '#fdf5e6',
        accent: mixHex('#d95b24', accentPhotoColor, 0.4),
        ink: '#2b1d12',
        secondary: mixHex('#eab308', basePhotoColor, 0.35),
      };
    case 'constructivism':
      return {
        bg: mixHex('#0f1c36', basePhotoColor, 0.22),
        surface: '#17294a',
        accent: mixHex('#ff4757', accentPhotoColor, 0.25),
        ink: '#f0f6ff',
        secondary: '#38bdf8',
      };
    case 'wabi-sabi':
      return {
        bg: mixHex('#d3e6e0', basePhotoColor, 0.25),
        surface: '#e8f3ef',
        accent: mixHex('#1d6f61', accentPhotoColor, 0.3),
        ink: '#152925',
        secondary: '#5ea89c',
      };
    case 'film-35mm':
      return {
        bg: mixHex('#1b262c', basePhotoColor, 0.25),
        surface: '#24333b',
        accent: mixHex('#f59e0b', accentPhotoColor, 0.35),
        ink: '#f5ebd9',
        secondary: mixHex('#2dd4bf', basePhotoColor, 0.3),
      };
  }
}

export function analyzeLocally(
  text: string,
  photos: PhotoItem[],
  music: MusicInput
): AtmosphereAnalysis {
  const lower = text.toLowerCase();
  const timeOfDay = detectTimeOfDay(text);
  const season = detectSeason(text);

  // 1. Оценка валентности (тепло/свет vs холод/напряжение) и энергии
  let textWarmth = 0;
  let textTension = 0;
  let textQuiet = 0;

  const warmWords = /(тепл|тёпл|какао|уют|улыб|любл|нежн|солнц|золотой|жёлт|желт|долго разговар|хорошо|счаст|смея|обнял)/g;
  const tenseWords = /(срочн|сдач|дедлайн|проект|офис|ночь|стресс|устал|код|горит|успеть|тревог|бегом|шум)/g;
  const quietWords = /(тишин|туман|один|пуст|медлен|дожд|груст|спокой|дыш|молча|окн|след)/g;

  textWarmth += (lower.match(warmWords)?.length ?? 0) * 0.25;
  textTension += (lower.match(tenseWords)?.length ?? 0) * 0.28;
  textQuiet += (lower.match(quietWords)?.length ?? 0) * 0.25;

  // Фото-метрики
  const avgBrightness =
    photos.length > 0
      ? photos.reduce((s, p) => s + p.brightness, 0) / photos.length
      : 0.5;
  const avgContrast =
    photos.length > 0
      ? photos.reduce((s, p) => s + p.contrast, 0) / photos.length
      : 0.45;
  const avgPhotoWarmth =
    photos.length > 0
      ? photos.reduce(
          (s, p) => s + getColorWarmth(p.dominantColors[0] ?? '#808080'),
          0
        ) / photos.length
      : 0;

  // Музыка-метрики
  const musicEnergy = music.energy;
  const isMinor = music.tonality === 'minor';
  const isFast = music.bpm >= 115;
  const isSlow = music.bpm <= 82;

  const valence = Math.max(
    -1,
    Math.min(
      1,
      textWarmth - textTension * 0.8 + avgPhotoWarmth * 0.6 + (isMinor ? -0.25 : 0.25)
    )
  );
  const arousal = Math.max(
    0,
    Math.min(
      1,
      musicEnergy * 0.55 + textTension * 0.35 + (isFast ? 0.2 : 0) - textQuiet * 0.25
    )
  );

  // Выбор художественного направления по правилам системы
  let movement: ArtMovementId;
  let mood: MoodTone;

  if (arousal >= 0.6 && (textTension >= 0.25 || isFast || music.genre.toLowerCase().includes('электр'))) {
    movement = 'constructivism';
    mood = 'tense-electric';
  } else if (valence >= 0.15 && arousal < 0.62 && (avgPhotoWarmth > -0.05 || textWarmth > 0.2)) {
    movement = 'impressionism';
    mood = 'warm-nostalgic';
  } else if (isSlow || (isMinor && arousal < 0.45) || textQuiet >= 0.25) {
    movement = 'wabi-sabi';
    mood = 'quiet-melancholy';
  } else {
    movement = 'film-35mm';
    mood = 'bright-alive';
  }

  const palette = buildPalette(movement, photos, timeOfDay, text);

  const visualParams: VisualParams = {
    grain: movement === 'film-35mm' ? 0.55 : movement === 'impressionism' ? 0.32 : 0.14,
    blurSoftness: movement === 'impressionism' ? 0.55 : movement === 'wabi-sabi' ? 0.22 : 0.05,
    gridRigidity: movement === 'constructivism' ? 0.92 : movement === 'wabi-sabi' ? 0.45 : 0.25,
    whitespace: movement === 'wabi-sabi' ? 0.78 : movement === 'constructivism' ? 0.28 : 0.44,
    rhythmSpeed: Number((0.45 + (music.bpm / 120) * (0.6 + musicEnergy * 0.7)).toFixed(2)),
    overlayDensity: Number(Math.min(1, 0.25 + musicEnergy * 0.65).toFixed(2)),
    contrastBoost: Number((movement === 'constructivism' ? 1.24 : 0.95 + avgContrast * 0.22).toFixed(2)),
  };

  const voiceProfile: VoiceProfile =
    mood === 'warm-nostalgic'
      ? { rate: 0.9, pitch: 0.94, label: 'Спокойный и тёплый' }
      : mood === 'tense-electric'
        ? { rate: 1.12, pitch: 1.04, label: 'Живой и собранный' }
        : mood === 'quiet-melancholy'
          ? { rate: 0.82, pitch: 0.88, label: 'Тихий и неспешный' }
          : { rate: 1.02, pitch: 1.02, label: 'Лёгкий разговорный' };

  const folderName = generateLocalFolderName(text, timeOfDay, season, mood);

  const explanation: LogicRuleExplanation[] = [
    {
      source: 'Текст',
      signal: `Время: ${timeOfDay}, настроение: ${MOOD_LABELS[mood].toLowerCase()}${season !== 'вне сезона' ? `, сезон: ${season}` : ''}`,
      effect: `Задано название папки «${folderName}» и подобран голос озвучки (${voiceProfile.label})`,
    },
    {
      source: 'Фото',
      signal: `${photos.length} кадр(а), яркость ${Math.round(avgBrightness * 100)}%, доминанты ${photos[0]?.dominantColors.slice(0, 3).join(' ')}`,
      effect: `Сформирована адаптивная палитра страницы (фон ${palette.bg}, акцент ${palette.accent})`,
    },
    {
      source: 'Музыка',
      signal: `${music.artist ? music.artist + ' — ' : ''}${music.title || 'Трек'} (${music.bpm} BPM, ${music.tonality === 'minor' ? 'минор' : 'мажор'}, энергия ${Math.round(musicEnergy * 100)}%)`,
      effect: `${isMinor ? 'Минорная тональность приглушила палитру' : 'Мажорная тональность поддержала свет'}; темп ${music.bpm} BPM задал скорость ритма ${visualParams.rhythmSpeed}×`,
    },
    {
      source: 'Синтез',
      signal: `Выбран режим «${MOVEMENT_META[movement].title}»`,
      effect: MOVEMENT_META[movement].reference,
    },
  ];

  return {
    folderName,
    movement,
    movementTitle: MOVEMENT_META[movement].title,
    movementReference: MOVEMENT_META[movement].reference,
    mood,
    moodLabel: MOOD_LABELS[mood],
    valence: Number(valence.toFixed(2)),
    arousal: Number(arousal.toFixed(2)),
    timeOfDay,
    season,
    palette,
    visualParams,
    voiceProfile,
    explanation,
    engineUsed: 'local',
  };
}

export async function analyzeDayAtmosphere(
  text: string,
  photos: PhotoItem[],
  music: MusicInput,
  geminiApiKey?: string
): Promise<AtmosphereAnalysis> {
  const base = analyzeLocally(text, photos, music);

  if (!geminiApiKey || !geminiApiKey.trim()) {
    return base;
  }

  try {
    const prompt = `Ты — арт-директор личного дневника ощущений "ATMOS".
Проанализируй один день пользователя и верни строго JSON без markdown-обёрток.

Текст дня: "${text}"
Музыка: "${music.artist} - ${music.title}" (жанр: ${music.genre}, BPM: ${music.bpm}, тональность: ${music.tonality}, энергия: ${music.energy})
Фото: ${photos.length} шт., доминирующие цвета: ${photos[0]?.dominantColors.join(', ') ?? 'нет'}

Выбери одно из 4 художественных направлений (movement):
- "impressionism" (Клод Моне: тёплое, мягкое, ностальгическое, свет)
- "constructivism" (Кандинский: напряжённое, дедлайн, электроника, резкий ритм)
- "wabi-sabi" (Японский минимализм: тихое, минорное, много воздуха, созерцание)
- "film-35mm" (Плёнка 35mm: живая прогулка, хроника города, смешанные эмоции)

Требуемая JSON-структура:
{
  "folderName": "Короткое поэтичное название папки строго 3-6 слов на русском",
  "movement": "impressionism" | "constructivism" | "wabi-sabi" | "film-35mm",
  "mood": "warm-nostalgic" | "tense-electric" | "quiet-melancholy" | "bright-alive",
  "textReason": "Одно короткое предложение: какой сигнал из текста повлиял на оформление",
  "musicReason": "Одно короткое предложение: как музыка повлияла на ритм и палитру"
}`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiApiKey.trim())}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.5,
          },
        }),
      }
    );

    if (!res.ok) return base;
    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return base;

    const parsed = JSON.parse(rawText) as {
      folderName?: string;
      movement?: ArtMovementId;
      mood?: MoodTone;
      textReason?: string;
      musicReason?: string;
    };

    const validMovements: ArtMovementId[] = [
      'impressionism',
      'constructivism',
      'wabi-sabi',
      'film-35mm',
    ];
    const movement =
      parsed.movement && validMovements.includes(parsed.movement)
        ? parsed.movement
        : base.movement;

    const palette = buildPalette(movement, photos, base.timeOfDay, text);
    const folderName =
      parsed.folderName && parsed.folderName.trim().length >= 5
        ? parsed.folderName.trim()
        : base.folderName;

    const updatedExplanation = [...base.explanation];
    if (parsed.textReason) {
      updatedExplanation[0] = {
        ...updatedExplanation[0],
        effect: `${parsed.textReason} (название: «${folderName}»)`,
      };
    }
    if (parsed.musicReason) {
      updatedExplanation[2] = {
        ...updatedExplanation[2],
        effect: parsed.musicReason,
      };
    }

    return {
      ...base,
      folderName,
      movement,
      movementTitle: MOVEMENT_META[movement].title,
      movementReference: MOVEMENT_META[movement].reference,
      mood: parsed.mood ?? base.mood,
      moodLabel: MOOD_LABELS[parsed.mood ?? base.mood] ?? base.moodLabel,
      palette,
      explanation: updatedExplanation,
      engineUsed: 'gemini-2.5-flash',
    };
  } catch {
    return base;
  }
}

const RECENT_TRACKS_KEY = 'yourdiary_recent_tracks';

function getRecentTrackKeys(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_TRACKS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function rememberTrackKey(key: string): void {
  try {
    const prev = getRecentTrackKeys().filter((k) => k !== key);
    const next = [key, ...prev].slice(0, 30);
    localStorage.setItem(RECENT_TRACKS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

function buildLiveMusicQueries(text: string, avgWarmth: number): string[] {
  const lower = text.toLowerCase();
  if (/(закат|золотой|рассвет|вечер|sunset|golden)/.test(lower)) {
    return ['dream pop', 'shoegaze', 'indie chill', 'chillwave'];
  }
  if (/(кот|кош|собак|питом|уют|кофе|какао|дом|брусчат)/.test(lower)) {
    return ['jazz hop', 'bossa nova', 'neo soul', 'indie folk'];
  }
  if (/(небо|поле|облак|воздух|трав|природ|лес|гор|море|океан)/.test(lower)) {
    return ['indie folk', 'ambient electronic', 'post rock', 'acoustic indie'];
  }
  if (/(город|панорам|крыш|высот|улиц|ветер|ночь|огни|фонар)/.test(lower)) {
    return ['synthwave', 'post punk', 'indie rock', 'russian rock'];
  }
  if (/(срочн|сдач|дедлайн|офис|код|проект|бегом|шум|спорт|драйв)/.test(lower)) {
    return ['synthpop', 'electronic dance', 'nu disco', 'indie electronic'];
  }
  if (/(туман|дожд|груст|тоск|один|луж|rain|fog)/.test(lower)) {
    return ['modern classical', 'sad indie', 'ambient piano', 'slowcore'];
  }
  if (/(парк|осень|тепл|тёпл|свеч|винил|любл|солнц|лето)/.test(lower)) {
    return ['vocal jazz', 'soul', 'indie pop', 'french pop'];
  }
  return avgWarmth > 0.05
    ? ['indie pop', 'neo soul', 'psychedelic pop', 'bossa nova']
    : ['dream pop', 'ambient', 'indie rock', 'chillwave'];
}

export async function suggestMusicForDay(
  text: string,
  photos: PhotoItem[],
  geminiApiKey?: string
): Promise<MusicInput> {
  const avgWarmth =
    photos.length > 0
      ? photos.reduce(
          (s, p) => s + getColorWarmth(p.dominantColors[0] ?? '#808080'),
          0
        ) / photos.length
      : 0;

  // 1. Если задан Gemini API ключ, сначала пробуем подобрать через Gemini
  if (geminiApiKey && geminiApiKey.trim()) {
    try {
      const prompt = `Подбери одну реально существующую песню, которая идеально передаёт атмосферу этого дня.
Текст дня: "${text}"
Цвета фото: ${photos[0]?.dominantColors.join(', ') ?? 'не заданы'}

Верни строго JSON:
{
  "artist": "Исполнитель",
  "title": "Название трека",
  "genre": "Жанр",
  "bpm": число от 60 до 150,
  "tonality": "major" | "minor",
  "energy": число от 0.1 до 1.0
}`;

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiApiKey.trim())}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.6,
            },
          }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<MusicInput>;
          if (parsed.title) {
            const query = encodeURIComponent(
              `${parsed.artist ?? ''} ${parsed.title}`.trim()
            );
            return {
              mode: 'link',
              artist: parsed.artist ?? '',
              title: parsed.title,
              genre: parsed.genre ?? 'Indie',
              bpm: Math.max(55, Math.min(165, Number(parsed.bpm) || 92)),
              tonality: parsed.tonality === 'minor' ? 'minor' : 'major',
              energy: Math.max(0.1, Math.min(1, Number(parsed.energy) || 0.5)),
              url: `https://open.spotify.com/search/${query}`,
            };
          }
        }
      }
    } catch {
      // Переходим к живому поиску по интернету
    }
  }

  // 2. Живой автоматический поиск в интернете (iTunes Search API) по настроению и тексту дня
  const queries = buildLiveMusicQueries(text, avgWarmth);
  const chosenQuery = queries[Math.floor(Math.random() * queries.length)];
  const rawTracks = await searchTrackPreviews(chosenQuery, 25);

  if (rawTracks.length > 0) {
    // Отфильтровываем спам-названия и убираем повторы одного исполнителя
    const recent = new Set(getRecentTrackKeys());
    const seenArtists = new Set<string>();
    const cleanUnique = rawTracks.filter((tr) => {
      if (tr.title.length > 52) return false;
      const artistKey = tr.artist.trim().toLowerCase();
      if (!artistKey || seenArtists.has(artistKey)) return false;
      seenArtists.add(artistKey);
      return true;
    });

    const pool = cleanUnique.length > 0 ? cleanUnique : rawTracks;
    const freshPool = pool.filter(
      (tr) => !recent.has(`${tr.artist} - ${tr.title}`.toLowerCase())
    );
    const candidates = freshPool.length > 0 ? freshPool : pool;
    const picked = candidates[Math.floor(Math.random() * candidates.length)];
    rememberTrackKey(`${picked.artist} - ${picked.title}`.toLowerCase());

    const spQuery = encodeURIComponent(`${picked.artist} ${picked.title}`.trim());
    return {
      mode: 'link',
      artist: picked.artist,
      title: picked.title,
      genre: picked.genre,
      bpm: picked.estimatedBpm,
      tonality: picked.estimatedTonality,
      energy: picked.estimatedEnergy,
      url: `https://open.spotify.com/search/${spQuery}`,
      previewUrl: picked.previewUrl,
      artworkUrl: picked.artworkUrl,
    };
  }

  // 3. Резервный вариант только при отсутствии интернета
  return {
    mode: 'link',
    artist: 'Khruangbin',
    title: 'White Gloves',
    genre: 'Indie / Psychedelic Soul',
    bpm: 98,
    tonality: 'major',
    energy: 0.52,
    url: 'https://open.spotify.com/search/Khruangbin%20White%20Gloves',
  };
}

export function inferMusicMetricsFromContext(
  title: string,
  genre: string,
  dayText: string
): { bpm: number; tonality: 'major' | 'minor'; energy: number } {
  const combined = `${title} ${genre} ${dayText}`.toLowerCase();

  if (/(electronic|idm|techno|house|dance|rock|metal|срочн|дедлайн|ночь в офисе|бегом)/.test(combined)) {
    return { bpm: 128, tonality: 'minor', energy: 0.84 };
  }
  if (/(ambient|classical|sad|blue|rain|туман|дожд|тишин|груст|утро|море)/.test(combined)) {
    return { bpm: 72, tonality: 'minor', energy: 0.3 };
  }
  if (/(jazz|soul|acoustic|folk|парк|какао|осень|тёпл|тепл|уют|винил|любл)/.test(combined)) {
    return { bpm: 78, tonality: 'major', energy: 0.38 };
  }
  if (/(indie|pop|funk|disco|прогулк|город|смеял|трамва|солн)/.test(combined)) {
    return { bpm: 106, tonality: 'major', energy: 0.6 };
  }
  return { bpm: 92, tonality: 'major', energy: 0.48 };
}
