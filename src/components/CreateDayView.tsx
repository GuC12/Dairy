import React, { useMemo, useRef, useState } from 'react';
import {
  Check,
  ImagePlus,
  Link2,
  Loader2,
  MapPin,
  Mic,
  MicOff,
  Music,
  Search,
  Sparkles,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import type { DiaryEntry, MusicInput, PhotoItem } from '../types/diary';
import { analyzeDataUrl, analyzePhotoFile } from '../engine/photoAnalyzer';
import { analyzeAudioFile } from '../engine/audioAnalyzer';
import {
  analyzeDayAtmosphere,
  analyzeLocally,
  inferMusicMetricsFromContext,
  suggestMusicForDay,
} from '../engine/atmosphereEngine';
import {
  searchTrackPreviews,
  type TrackSearchResult,
} from '../engine/musicSearch';
import { MemoryCanvas } from './MemoryCanvas';
import { useLanguage } from '../i18n/useLanguage';

interface CreateDayViewProps {
  nextIndex: number;
  geminiApiKey?: string;
  editingEntry?: DiaryEntry | null;
  onCreated: (entry: DiaryEntry) => void;
  onCancel: () => void;
}

function createQuickAtmosphericPhoto(seedText: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = 720;
  canvas.height = 540;
  const ctx = canvas.getContext('2d')!;
  const isNight = /(ноч|офис|гроз|темн)/i.test(seedText);
  const isWarm = /(парк|какао|осень|тепл|закат|солн)/i.test(seedText);

  const grad = ctx.createLinearGradient(0, 0, 720, 540);
  if (isNight) {
    grad.addColorStop(0, '#101928');
    grad.addColorStop(1, '#253652');
  } else if (isWarm) {
    grad.addColorStop(0, '#e2a866');
    grad.addColorStop(1, '#7c3f21');
  } else {
    grad.addColorStop(0, '#a8b7b4');
    grad.addColorStop(1, '#4c5b5d');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 720, 540);

  for (let i = 0; i < 24; i++) {
    ctx.fillStyle = isNight
      ? 'rgba(130, 185, 240, 0.18)'
      : isWarm
        ? 'rgba(255, 224, 155, 0.25)'
        : 'rgba(255, 255, 255, 0.2)';
    ctx.beginPath();
    ctx.arc(
      (i * 113) % 720,
      (i * 71) % 540,
      20 + (i % 5) * 14,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
  return canvas.toDataURL('image/jpeg', 0.86);
}

export const CreateDayView: React.FC<CreateDayViewProps> = ({
  nextIndex,
  geminiApiKey,
  editingEntry,
  onCreated,
  onCancel,
}) => {
  const { lang, t } = useLanguage();
  const [text, setText] = useState(editingEntry?.text ?? '');
  const [dateLabel, setDateLabel] = useState(
    () =>
      editingEntry?.dateLabel ??
      new Date().toLocaleDateString(lang === 'en' ? 'en-US' : 'ru-RU', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
  );
  const [weather, setWeather] = useState(editingEntry?.weather ?? '');
  const [location, setLocation] = useState(editingEntry?.location ?? '');
  const [signature, setSignature] = useState(editingEntry?.signature ?? '');

  const [photos, setPhotos] = useState<PhotoItem[]>(editingEntry?.photos ?? []);
  const [isAnalyzingPhotos, setIsAnalyzingPhotos] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [musicMode, setMusicMode] = useState<'link' | 'file'>(
    editingEntry?.music.mode ?? 'link'
  );
  const [musicTitle, setMusicTitle] = useState(editingEntry?.music.title ?? '');
  const [musicArtist, setMusicArtist] = useState(
    editingEntry?.music.artist ?? ''
  );
  const [musicGenre, setMusicGenre] = useState(
    editingEntry?.music.genre ?? 'Indie / Acoustic'
  );
  const [musicUrl, setMusicUrl] = useState(editingEntry?.music.url ?? '');
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(
    editingEntry?.music.previewUrl
  );
  const [artworkUrl, setArtworkUrl] = useState<string | undefined>(
    editingEntry?.music.artworkUrl
  );
  const [musicBpm, setMusicBpm] = useState(editingEntry?.music.bpm ?? 92);
  const [musicTonality, setMusicTonality] = useState<'major' | 'minor'>(
    editingEntry?.music.tonality ?? 'major'
  );
  const [musicEnergy, setMusicEnergy] = useState(
    editingEntry?.music.energy ?? 0.45
  );
  const [hasExactMetrics, setHasExactMetrics] = useState(
    Boolean(editingEntry)
  );
  const [audioDataUrl, setAudioDataUrl] = useState<string | undefined>(
    editingEntry?.music.audioDataUrl
  );
  const [audioFileName, setAudioFileName] = useState<string | undefined>(
    editingEntry?.music.fileName
  );
  const [isAnalyzingAudio, setIsAnalyzingAudio] = useState(false);

  const [trackQuery, setTrackQuery] = useState('');
  const [trackResults, setTrackResults] = useState<TrackSearchResult[]>([]);
  const [isSearchingTracks, setIsSearchingTracks] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isSuggestingMusic, setIsSuggestingMusic] = useState(false);
  const [isDictating, setIsDictating] = useState(false);
  const [isDetectingGeo, setIsDetectingGeo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  const toggleDictation = () => {
    if (isDictating) {
      recognitionRef.current?.stop();
      setIsDictating(false);
      return;
    }

    const SpeechRec =
      (window as unknown as { SpeechRecognition?: new () => unknown })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => unknown })
        .webkitSpeechRecognition;

    if (!SpeechRec) {
      setError(
        t(
          'Ваш браузер не поддерживает голосовую диктовку (используйте Chrome/Edge).',
          'Your browser does not support voice dictation (please use Chrome or Edge).'
        )
      );
      return;
    }

    try {
      const rec = new SpeechRec() as {
        lang: string;
        continuous: boolean;
        interimResults: boolean;
        onresult: (event: {
          results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }>;
        }) => void;
        onerror: () => void;
        onend: () => void;
        start: () => void;
        stop: () => void;
      };
      rec.lang = lang === 'en' ? 'en-US' : 'ru-RU';
      rec.continuous = true;
      rec.interimResults = false;

      rec.onresult = (event) => {
        const lastIdx = event.results.length - 1;
        const phrase = event.results[lastIdx]?.[0]?.transcript?.trim();
        if (phrase) {
          setText((prev) => (prev ? `${prev.trim()} ${phrase}` : phrase));
        }
      };
      rec.onerror = () => setIsDictating(false);
      rec.onend = () => setIsDictating(false);

      recognitionRef.current = rec;
      setIsDictating(true);
      rec.start();
    } catch {
      setIsDictating(false);
    }
  };

  const handleAutoWeatherGeo = () => {
    if (!('geolocation' in navigator)) {
      setWeather('+4°C, переменная облачность');
      setLocation('Астана');
      return;
    }
    setIsDetectingGeo(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const [weatherRes, geoRes] = await Promise.all([
            fetch(
              `https://api.open-meteo.com/v1/forecast?latitude=${latitude.toFixed(
                3
              )}&longitude=${longitude.toFixed(3)}&current_weather=true`
            ),
            fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude.toFixed(
                3
              )}&lon=${longitude.toFixed(3)}&accept-language=ru`
            ),
          ]);

          if (weatherRes.ok) {
            const wData = (await weatherRes.json()) as {
              current_weather?: { temperature?: number; weathercode?: number };
            };
            const temp = Math.round(wData.current_weather?.temperature ?? 5);
            const code = wData.current_weather?.weathercode ?? 0;
            const sign = temp > 0 ? `+${temp}°C` : `${temp}°C`;
            let sky = 'ясно';
            if (code >= 95) sky = 'гроза';
            else if (code >= 71) sky = 'снег';
            else if (code >= 51) sky = 'дождь';
            else if (code >= 45) sky = 'туман';
            else if (code >= 1) sky = 'облачно';
            setWeather(`${sign}, ${sky}`);
          }

          if (geoRes.ok) {
            const gData = (await geoRes.json()) as {
              address?: {
                city?: string;
                town?: string;
                village?: string;
                suburb?: string;
              };
            };
            const place =
              gData.address?.city ||
              gData.address?.town ||
              gData.address?.village ||
              gData.address?.suburb;
            if (place) setLocation(place);
          }
        } catch {
          setWeather('+3°C, свежий ветер');
        } finally {
          setIsDetectingGeo(false);
        }
      },
      () => {
        setWeather('+4°C, вечерняя прохлада');
        setLocation('Астана');
        setIsDetectingGeo(false);
      },
      { timeout: 6000 }
    );
  };

  const displayIndex = editingEntry?.indexNumber ?? nextIndex;

  const inferredMusic = useMemo(
    () => inferMusicMetricsFromContext(musicTitle, musicGenre, text),
    [musicTitle, musicGenre, text]
  );

  const effectiveBpm = hasExactMetrics ? musicBpm : inferredMusic.bpm;
  const effectiveTonality = hasExactMetrics
    ? musicTonality
    : inferredMusic.tonality;
  const effectiveEnergy = hasExactMetrics ? musicEnergy : inferredMusic.energy;

  const livePreviewEntry: DiaryEntry = useMemo(() => {
    const previewMusic: MusicInput = {
      mode: musicMode,
      title: musicTitle.trim() || audioFileName || 'Атмосфера дня',
      artist: musicArtist.trim(),
      genre: musicGenre.trim() || 'Ambient',
      bpm: effectiveBpm,
      tonality: effectiveTonality,
      energy: effectiveEnergy,
      url: musicUrl.trim() || undefined,
      previewUrl,
      artworkUrl,
      audioDataUrl,
      fileName: audioFileName,
    };

    const previewText =
      text.trim() ||
      t(
        'Напишите о своём дне, чтобы увидеть, как меняется атмосфера...',
        'Write about your day to watch its living atmosphere unfold...'
      );
    const analysis = analyzeLocally(previewText, photos, previewMusic);

    return {
      id: editingEntry?.id ?? 'live_preview',
      indexNumber: displayIndex,
      createdAt: editingEntry?.createdAt ?? '2026-01-01T00:00:00.000Z',
      dateLabel: dateLabel.trim() || t('Сегодня', 'Today'),
      weather: weather.trim() || undefined,
      location: location.trim() || undefined,
      text: previewText,
      signature: signature.trim() || analysis.folderName,
      photos,
      music: previewMusic,
      analysis,
    };
  }, [
    text,
    dateLabel,
    weather,
    location,
    signature,
    photos,
    musicMode,
    musicTitle,
    musicArtist,
    musicGenre,
    musicUrl,
    previewUrl,
    artworkUrl,
    effectiveBpm,
    effectiveTonality,
    effectiveEnergy,
    audioDataUrl,
    audioFileName,
    displayIndex,
    editingEntry,
    t,
  ]);

  const handlePhotoUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsAnalyzingPhotos(true);
    setError(null);
    try {
      const added: PhotoItem[] = [];
      for (const file of Array.from(files).slice(0, 6)) {
        if (!file.type.startsWith('image/')) continue;
        const item = await analyzePhotoFile(file);
        added.push(item);
      }
      if (added.length === 0) {
        setError(
          t(
            'Выберите файлы изображений (JPG, PNG, WebP).',
            'Please select image files (JPG, PNG, WebP).'
          )
        );
      } else {
        setPhotos((prev) => [...prev, ...added].slice(0, 6));
      }
    } catch {
      setError(
        t('Не удалось прочитать одно из изображений.', 'Failed to read one of the images.')
      );
    } finally {
      setIsAnalyzingPhotos(false);
    }
  };

  const handleGenerateTestPhoto = async () => {
    setIsAnalyzingPhotos(true);
    try {
      const dataUrl = createQuickAtmosphericPhoto(text);
      const item = await analyzeDataUrl(dataUrl, `generated_${Date.now()}.jpg`);
      setPhotos((prev) => [...prev, item].slice(0, 6));
    } finally {
      setIsAnalyzingPhotos(false);
    }
  };

  const handleAudioUpload = async (file: File | null) => {
    if (!file) return;
    setIsAnalyzingAudio(true);
    setError(null);
    try {
      const { dataUrl, metrics } = await analyzeAudioFile(file);
      setAudioDataUrl(dataUrl);
      setAudioFileName(file.name);
      setPreviewUrl(undefined);
      setMusicBpm(metrics.bpm);
      setMusicEnergy(metrics.energy);
      setHasExactMetrics(true);
      if (!musicTitle) {
        setMusicTitle(file.name.replace(/\.[^.]+$/, ''));
      }
    } catch {
      setError(
        t('Не удалось проанализировать аудиофайл.', 'Failed to analyze the audio file.')
      );
    } finally {
      setIsAnalyzingAudio(false);
    }
  };

  const handleSearchTracks = async () => {
    if (!trackQuery.trim()) return;
    setIsSearchingTracks(true);
    try {
      const results = await searchTrackPreviews(trackQuery);
      setTrackResults(results);
    } finally {
      setIsSearchingTracks(false);
    }
  };

  const applyTrackResult = (tr: TrackSearchResult) => {
    setMusicMode('link');
    setMusicArtist(tr.artist);
    setMusicTitle(tr.title);
    setMusicGenre(tr.genre);
    setMusicUrl(tr.trackUrl);
    setPreviewUrl(tr.previewUrl);
    setArtworkUrl(tr.artworkUrl);
    setMusicBpm(tr.estimatedBpm);
    setMusicTonality(tr.estimatedTonality);
    setMusicEnergy(tr.estimatedEnergy);
    setHasExactMetrics(true);
    setTrackResults([]);
  };

  const handleAutoPickMusic = async () => {
    setIsSuggestingMusic(true);
    setError(null);
    try {
      const picked = await suggestMusicForDay(
        text.trim() || 'Спокойный вечер',
        photos,
        geminiApiKey
      );
      setMusicMode('link');
      setMusicArtist(picked.artist);
      setMusicTitle(picked.title);
      setMusicGenre(picked.genre);
      setMusicBpm(picked.bpm);
      setMusicTonality(picked.tonality);
      setMusicEnergy(picked.energy);
      setHasExactMetrics(true);
      setMusicUrl(picked.url ?? '');

      // Попробуем подтянуть реальное 30-сек превью для подобранного трека
      const previews = await searchTrackPreviews(
        `${picked.artist} ${picked.title}`
      );
      if (previews[0]?.previewUrl) {
        setPreviewUrl(previews[0].previewUrl);
        setArtworkUrl(previews[0].artworkUrl);
      } else {
        setPreviewUrl(undefined);
      }
    } finally {
      setIsSuggestingMusic(false);
    }
  };

  const fillQuickExample = async () => {
    const sampleText =
      'Вечером после дождя вышли на набережную. Город отражался в лужах жёлтыми фонарями, мы купили горячие булочки с корицей и слушали старый джаз через один наушник.';
    setText(sampleText);
    setWeather('+6°C, после дождя');
    setLocation('Набережная');
    setSignature('Огни на мокром асфальте');
    setMusicMode('link');
    setMusicArtist('Chet Baker');
    setMusicTitle('Almost Blue');
    setMusicGenre('Cool Jazz');
    setMusicBpm(72);
    setMusicTonality('minor');
    setMusicEnergy(0.32);
    setHasExactMetrics(true);
    setMusicUrl('https://open.spotify.com/search/Chet%20Baker%20Almost%20Blue');

    const previews = await searchTrackPreviews('Chet Baker Almost Blue');
    if (previews[0]?.previewUrl) {
      setPreviewUrl(previews[0].previewUrl);
      setArtworkUrl(previews[0].artworkUrl);
    }

    if (photos.length === 0) {
      const dataUrl = createQuickAtmosphericPhoto(sampleText);
      const item = await analyzeDataUrl(dataUrl, 'demo_evening.jpg');
      setPhotos([item]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) {
      setError(
        t(
          'Напишите хотя бы пару предложений о том, как прошёл день.',
          'Please write at least a few sentences about how your day went.'
        )
      );
      return;
    }
    if (photos.length === 0) {
      setError(
        t(
          'Добавьте хотя бы одну фотографию этого дня (или сгенерируйте тестовый кадр).',
          'Please add at least one photo of this day (or generate a test frame).'
        )
      );
      return;
    }
    setIsGenerating(true);
    setError(null);

    try {
      let music: MusicInput;
      if (!musicTitle.trim() && !audioDataUrl) {
        const autoPicked = await suggestMusicForDay(
          text.trim(),
          photos,
          geminiApiKey
        );
        const previews = await searchTrackPreviews(
          `${autoPicked.artist} ${autoPicked.title}`
        );
        music = {
          ...autoPicked,
          previewUrl: previews[0]?.previewUrl,
          artworkUrl: previews[0]?.artworkUrl,
        };
      } else {
        music = {
          mode: musicMode,
          title: musicTitle.trim() || audioFileName || 'Без названия',
          artist: musicArtist.trim(),
          genre: musicGenre.trim() || 'Ambient',
          bpm: effectiveBpm,
          tonality: effectiveTonality,
          energy: effectiveEnergy,
          url: musicMode === 'link' ? musicUrl.trim() || undefined : undefined,
          previewUrl: musicMode === 'link' ? previewUrl : undefined,
          artworkUrl: musicMode === 'link' ? artworkUrl : undefined,
          audioDataUrl: musicMode === 'file' ? audioDataUrl : undefined,
          fileName: audioFileName,
        };
      }

      const analysis = await analyzeDayAtmosphere(
        text.trim(),
        photos,
        music,
        geminiApiKey
      );

      const newEntry: DiaryEntry = {
        id: editingEntry?.id ?? `day_${Date.now()}`,
        indexNumber: displayIndex,
        createdAt: editingEntry?.createdAt ?? new Date().toISOString(),
        dateLabel: dateLabel.trim() || 'Сегодня',
        weather: weather.trim() || undefined,
        location: location.trim() || undefined,
        text: text.trim(),
        signature: signature.trim() || analysis.folderName,
        photos,
        music,
        analysis,
      };

      onCreated(newEntry);
    } catch {
      setError('Произошла ошибка при сборке воспоминания.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="studio-view view-enter">
      <div className="create-header">
        <div>
          <div className="font-mono section-kicker">
            {t('МАСТЕРСКАЯ ДНЯ // ДЕНЬ', 'DAY STUDIO // DAY')}{' '}
            {String(displayIndex).padStart(2, '0')}
          </div>
          <h1 className="font-serif create-title">
            {editingEntry
              ? t('Редактировать день', 'Edit Day')
              : t('Сохранить атмосферу дня', 'Preserve Day Atmosphere')}
          </h1>
        </div>
        <div className="create-header-actions">
          {!editingEntry && (
            <button type="button" className="btn-ghost" onClick={fillQuickExample}>
              <Sparkles size={15} />
              {t('Заполнить пример', 'Fill Sample')}
            </button>
          )}
          <button type="button" className="btn-ghost" onClick={onCancel}>
            {t('Отмена', 'Cancel')}
          </button>
        </div>
      </div>

      <div className="studio-grid">
        <form className="create-form" onSubmit={handleSubmit}>
          {/* 1. Текст дня */}
          <div className="form-card">
            <div className="form-card-head">
              <label className="form-label font-mono">
                {t('01 // КАК ПРОШЁЛ ДЕНЬ', '01 // HOW THE DAY WENT')}
              </label>
              <div className="photo-head-actions">
                <button
                  type="button"
                  className={`btn-ghost ${isDictating ? 'dictation-active' : ''}`}
                  onClick={toggleDictation}
                  title={t(
                    'Рассказать о дне голосом в микрофон',
                    'Dictate your day story using the microphone'
                  )}
                >
                  {isDictating ? <MicOff size={14} /> : <Mic size={14} />}
                  {isDictating
                    ? t('Слушаю речь...', 'Listening...')
                    : t('Надиктовать голосом', 'Voice Dictation')}
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={handleAutoWeatherGeo}
                  disabled={isDetectingGeo}
                  title={t(
                    'С согласия пользователя определить реальную погоду и город',
                    'Detect live weather and city with user permission'
                  )}
                >
                  {isDetectingGeo ? (
                    <Loader2 size={14} className="spin" />
                  ) : (
                    <MapPin size={14} />
                  )}
                  {t('Авто-погода и город', 'Auto Weather & City')}
                </button>
              </div>
            </div>
            <textarea
              className="textarea-main"
              rows={4}
              placeholder={t(
                'Опишите погоду, свет, звуки, людей рядом и главное ощущение этого дня...',
                'Describe the weather, light, sounds, people nearby, and how the day felt...'
              )}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />

            <div className="meta-inputs-grid">
              <div>
                <label className="mini-label font-mono">{t('Дата', 'Date')}</label>
                <input
                  type="text"
                  className="input-field"
                  value={dateLabel}
                  onChange={(e) => setDateLabel(e.target.value)}
                />
              </div>
              <div>
                <label className="mini-label font-mono">{t('Погода (опц.)', 'Weather (opt.)')}</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="+8°C, туман"
                  value={weather}
                  onChange={(e) => setWeather(e.target.value)}
                />
              </div>
              <div>
                <label className="mini-label font-mono">{t('Место (опц.)', 'Location (opt.)')}</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder={t('Парк, офис, поезд...', 'Park, studio, train...')}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
              <div>
                <label className="mini-label font-mono">{t('Подпись на странице', 'Page signature')}</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder={t('Короткая фраза внизу...', 'Short closing phrase...')}
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* 2. Фотографии с Drag-and-Drop */}
          <div className="form-card">
            <div className="form-card-head">
              <label className="form-label font-mono">
                {t(
                  '02 // РЕАЛЬНЫЕ ФОТОГРАФИИ ДНЯ (1–6 ШТ.)',
                  '02 // REAL PHOTOS OF THE DAY (1–6)'
                )}
              </label>
              <div className="photo-head-actions">
                {isAnalyzingPhotos && (
                  <span className="font-mono analyzing-badge">
                    <Loader2 size={13} className="spin" />{' '}
                    {t('Анализ цвета...', 'Color analysis...')}
                  </span>
                )}
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={handleGenerateTestPhoto}
                >
                  <Wand2 size={14} /> {t('Тестовый кадр', 'Test Frame')}
                </button>
              </div>
            </div>

            <label
              className={`upload-dropzone ${isDragging ? 'is-dragging' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                handlePhotoUpload(e.dataTransfer.files);
              }}
            >
              <ImagePlus size={20} />
              <span>
                {t(
                  'Перетащите фото сюда или нажмите для выбора (JPG, PNG, WebP)',
                  'Drag and drop photos here or click to browse (JPG, PNG, WebP)'
                )}
              </span>
              <input
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => handlePhotoUpload(e.target.files)}
              />
            </label>

            {photos.length > 0 && (
              <div className="uploaded-photos-grid">
                {photos.map((ph) => (
                  <div key={ph.id} className="uploaded-photo-item">
                    <img src={ph.dataUrl} alt={ph.name} />
                    <button
                      type="button"
                      className="remove-photo-btn"
                      onClick={() =>
                        setPhotos((prev) => prev.filter((p) => p.id !== ph.id))
                      }
                    >
                      <X size={13} />
                    </button>
                    <div className="swatch-row">
                      {ph.dominantColors.map((c) => (
                        <span
                          key={c}
                          className="swatch"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. Музыка */}
          <div className="form-card">
            <div className="form-card-head">
              <label className="form-label font-mono">
                {t('03 // ПЕСНЯ ЭТОГО ДНЯ', '03 // SONG OF THE DAY')}
              </label>
              <div className="mode-tabs">
                <button
                  type="button"
                  className={`mode-tab ${musicMode === 'link' ? 'active' : ''}`}
                  onClick={() => setMusicMode('link')}
                >
                  <Link2 size={14} /> {t('Поиск / Ссылка', 'Search / Link')}
                </button>
                <button
                  type="button"
                  className={`mode-tab ${musicMode === 'file' ? 'active' : ''}`}
                  onClick={() => setMusicMode('file')}
                >
                  <Upload size={14} /> {t('Аудиофайл', 'Audio File')}
                </button>
                <button
                  type="button"
                  className="mode-tab"
                  onClick={handleAutoPickMusic}
                  disabled={isSuggestingMusic}
                  title={t(
                    'Автоматически подобрать песню под текст и фото',
                    'Automatically pick a song matching text and photos'
                  )}
                >
                  {isSuggestingMusic ? (
                    <Loader2 size={14} className="spin" />
                  ) : (
                    <Sparkles size={14} />
                  )}
                  {t('Подобрать по дню', 'Smart Match')}
                </button>
              </div>
            </div>

            {musicMode === 'link' && (
              <div className="track-search-wrap">
                <div className="track-search-bar">
                  <Search size={15} />
                  <input
                    type="text"
                    placeholder={t(
                      'Найти реальный трек с 30-сек превью...',
                      'Search real track with 30s preview...'
                    )}
                    value={trackQuery}
                    onChange={(e) => setTrackQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSearchTracks();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleSearchTracks}
                    disabled={isSearchingTracks}
                  >
                    {isSearchingTracks
                      ? t('Ищем...', 'Searching...')
                      : t('Найти', 'Search')}
                  </button>
                </div>

                {trackResults.length > 0 && (
                  <div className="track-results-list">
                    {trackResults.map((tr, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className="track-result-item"
                        onClick={() => applyTrackResult(tr)}
                      >
                        {tr.artworkUrl && (
                          <img src={tr.artworkUrl} alt={tr.title} />
                        )}
                        <div className="track-result-info">
                          <div className="track-result-title">
                            {tr.artist} — {tr.title}
                          </div>
                          <div className="track-result-sub font-mono">
                            {tr.genre} · ~{tr.estimatedBpm} BPM · 30s preview
                          </div>
                        </div>
                        <Check size={15} />
                      </button>
                    ))}
                  </div>
                )}

                {previewUrl && (
                  <div className="preview-audio-badge font-mono">
                    ♪ {t('Подключён официальный 30-сек фрагмент трека', 'Official 30s audio preview connected')}
                  </div>
                )}
              </div>
            )}

            {musicMode === 'file' && (
              <label className="upload-dropzone upload-audio">
                <Music size={20} />
                <span>
                  {isAnalyzingAudio
                    ? t('Анализируем BPM и энергию трека...', 'Analyzing BPM and audio energy...')
                    : audioFileName
                      ? `${t('Загружен', 'Loaded')}: ${audioFileName} (${musicBpm} BPM)`
                      : t(
                          'Загрузите MP3 / WAV / OGG — темп и энергия определятся автоматически',
                          'Upload MP3 / WAV / OGG — tempo and energy will be detected automatically'
                        )}
                </span>
                <input
                  type="file"
                  accept="audio/*"
                  hidden
                  onChange={(e) => handleAudioUpload(e.target.files?.[0] ?? null)}
                />
              </label>
            )}

            <div className="meta-inputs-grid">
              <div>
                <label className="mini-label font-mono">{t('Исполнитель', 'Artist')}</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder={t('Имя исполнителя', 'Artist name')}
                  value={musicArtist}
                  onChange={(e) => setMusicArtist(e.target.value)}
                />
              </div>
              <div>
                <label className="mini-label font-mono">{t('Название трека *', 'Track Title *')}</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder={t('Название песни', 'Song title')}
                  value={musicTitle}
                  onChange={(e) => setMusicTitle(e.target.value)}
                />
              </div>
              <div>
                <label className="mini-label font-mono">{t('Жанр', 'Genre')}</label>
                <input
                  type="text"
                  className="input-field"
                  value={musicGenre}
                  onChange={(e) => setMusicGenre(e.target.value)}
                />
              </div>
              {musicMode === 'link' && (
                <div>
                  <label className="mini-label font-mono">
                    {t('Ссылка на трек', 'Track Link')}
                  </label>
                  <input
                    type="url"
                    className="input-field"
                    placeholder="https://..."
                    value={musicUrl}
                    onChange={(e) => setMusicUrl(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div className="auto-music-summary font-mono">
              <Sparkles size={13} />
              <span>
                {t('Авто-анализ', 'Auto-analysis')}: {effectiveBpm} BPM ·{' '}
                {effectiveTonality === 'minor' ? t('Минор', 'Minor') : t('Мажор', 'Major')} · {t('Энергия', 'Energy')}{' '}
                {Math.round(effectiveEnergy * 100)}%
                {!musicTitle.trim() && !audioDataUrl
                  ? ` ${t('(если песню не указывать — подберём автоматически)', '(if omitted, we will pick one automatically)')}`
                  : ''}
              </span>
            </div>
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="form-submit-row">
            <button
              type="submit"
              className="btn-primary btn-large"
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 size={18} className="spin" />
                  {t('Сохраняем папку дня...', 'Saving day folder...')}
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  {editingEntry
                    ? t('Сохранить изменения', 'Save Changes')
                    : t('Сохранить воспоминание и папку дня', 'Save Memory & Day Folder')}
                </>
              )}
            </button>
          </div>
        </form>

        {/* Правая колонка: живой предпросмотр в реальном времени */}
        <aside className="studio-preview">
          <div className="preview-header font-mono">
            <span>{t('ЖИВОЙ ПРЕДПРОСМОТР // 4:5', 'LIVE PREVIEW // 4:5')}</span>
            <span className="preview-regime">
              {livePreviewEntry.analysis.movementTitle}
            </span>
          </div>

          <MemoryCanvas entry={livePreviewEntry} isPlaying />

          <div className="preview-logic-hint">
            <div className="font-mono preview-folder-tag">
              {t('Папка', 'Folder')}: «{livePreviewEntry.analysis.folderName}»
            </div>
            <div className="preview-sub">
              {t('Настроение', 'Mood')}: {livePreviewEntry.analysis.moodLabel} · {t('Ритм', 'Rhythm')}{' '}
              {livePreviewEntry.analysis.visualParams.rhythmSpeed}×
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
