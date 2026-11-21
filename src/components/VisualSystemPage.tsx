import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  CloudRain,
  Cpu,
  Layers,
  Music,
  Palette,
  Sliders,
  Sparkles,
} from 'lucide-react';
import type { ArtMovementId, DiaryEntry } from '../types/diary';
import { analyzeLocally } from '../engine/atmosphereEngine';
import { MemoryCanvas } from './MemoryCanvas';
import { useLanguage } from '../i18n/useLanguage';

interface VisualSystemPageProps {
  sampleEntry?: DiaryEntry;
}

const SANDBOX_PRESETS: Array<{
  movement: ArtMovementId;
  labelRu: string;
  labelEn: string;
  textRu: string;
  textEn: string;
  bpm: number;
  tonality: 'major' | 'minor';
  energy: number;
  artist: string;
  title: string;
}> = [
  {
    movement: 'impressionism',
    labelRu: '01 // Моне (Импрессионизм)',
    labelEn: '01 // Monet (Impressionism)',
    textRu: 'Тёплый солнечный день в осеннем парке, пили горячее какао у пруда и долго разговаривали.',
    textEn: 'Warm sunny day in the autumn park, drank hot cocoa by the pond and talked for hours.',
    bpm: 76,
    tonality: 'major',
    energy: 0.36,
    artist: 'Frank Sinatra',
    title: 'Autumn in New York',
  },
  {
    movement: 'constructivism',
    labelRu: '02 // Кандинский (Конструктивизм)',
    labelEn: '02 // Kandinsky (Constructivism)',
    textRu: 'Срочная сдача проекта, ночь в офисе, дедлайн, код на экране и плотный электронный ритм.',
    textEn: 'Urgent project deadline, late night at the office, code on screen and dense electronic rhythm.',
    bpm: 132,
    tonality: 'minor',
    energy: 0.88,
    artist: 'Rival Consoles',
    title: 'Midnight Grid',
  },
  {
    movement: 'wabi-sabi',
    labelRu: '03 // Ваби-саби (Минимализм)',
    labelEn: '03 // Wabi-Sabi (Minimalism)',
    textRu: 'Тишина, туман над пустым утренним берегом, медленный поезд и спокойное созерцание.',
    textEn: 'Silence, mist over the empty morning shore, slow train and calm contemplation.',
    bpm: 64,
    tonality: 'minor',
    energy: 0.22,
    artist: 'Brian Eno',
    title: 'An Ending (Ascent)',
  },
  {
    movement: 'film-35mm',
    labelRu: '04 // Плёнка 35mm (Коллаж)',
    labelEn: '04 // 35mm Film (Collage)',
    textRu: 'Вечерняя прогулка по городу на старом трамвае, огни витрин и кофе на остановке.',
    textEn: 'Evening tram ride through the city, storefront lights and coffee at the stop.',
    bpm: 104,
    tonality: 'major',
    energy: 0.56,
    artist: 'Pomplamoose',
    title: 'La Javanaise',
  },
];

const WEATHER_PRESETS = [
  { id: 'leaves', labelRu: 'Осенний листопад', labelEn: 'Autumn leaves', weatherRu: '+8°C, листопад в парке', weatherEn: '+8°C, park foliage' },
  { id: 'rain', labelRu: 'Дождь и гроза', labelEn: 'Rain & storm', weatherRu: '+6°C, дождь и гроза', weatherEn: '+6°C, rain and thunder' },
  { id: 'mist', labelRu: 'Густой туман', labelEn: 'Dense fog', weatherRu: '+4°C, густой туман у моря', weatherEn: '+4°C, dense seaside mist' },
  { id: 'snow', labelRu: 'Зимний снегопад', labelEn: 'Winter snow', weatherRu: '-4°C, тихий снег', weatherEn: '-4°C, gentle snowfall' },
];

export const VisualSystemPage: React.FC<VisualSystemPageProps> = ({
  sampleEntry,
}) => {
  const { lang, t } = useLanguage();
  const [presetIdx, setPresetIdx] = useState(0);
  const [weatherIdx, setWeatherIdx] = useState(0);

  const sandboxEntry: DiaryEntry = useMemo(() => {
    const preset = SANDBOX_PRESETS[presetIdx];
    const wPreset = WEATHER_PRESETS[weatherIdx];
    const photos = sampleEntry?.photos ?? [];
    const chosenText = lang === 'en' ? preset.textEn : preset.textRu;
    const chosenWeather = lang === 'en' ? wPreset.weatherEn : wPreset.weatherRu;
    const combinedText = `${chosenText} (${chosenWeather})`;
    const music = {
      mode: 'link' as const,
      artist: preset.artist,
      title: preset.title,
      genre: preset.movement === 'constructivism' ? 'Electronic' : 'Atmospheric',
      bpm: preset.bpm,
      tonality: preset.tonality,
      energy: preset.energy,
    };
    const analysis = analyzeLocally(combinedText, photos, music);

    return {
      id: 'sandbox_demo',
      indexNumber: presetIdx + 1,
      createdAt: '2026-11-21T00:00:00.000Z',
      dateLabel: lang === 'en' ? 'November 21, 2026' : '21 ноября 2026',
      weather: chosenWeather,
      location: lang === 'en' ? 'Interactive Stand' : 'Интерактивный стенд',
      text: combinedText,
      signature: lang === 'en' ? 'One frame — four visual languages' : 'Один кадр — четыре визуальных языка',
      photos,
      music,
      analysis,
    };
  }, [presetIdx, weatherIdx, sampleEntry, lang]);

  return (
    <div className="system-page view-enter">
      <div className="system-header">
        <div className="font-mono section-kicker">
          {t('АРХИТЕКТУРА И ВИЗУАЛЬНАЯ ГРАММАТИКА', 'ARCHITECTURE & VISUAL GRAMMAR')}
        </div>
        <h1 className="font-serif create-title">
          {t('Единая визуальная система дневника', 'Unified Visual Diary System')}
        </h1>
        <p className="hero-subtitle">
          {t(
            'Дневник — это серия, а не набор случайных картинок. Каждая генерация подчиняется строгим правилам перевода невидимого ощущения дня в видимую форму.',
            'A diary is a coherent series, not random pictures. Every generation follows strict rules translating the invisible feeling of a day into a tangible form.'
          )}
        </p>
      </div>

      {/* Интерактивная лаборатория визуальной системы для демонстрации жюри */}
      <div className="system-card sandbox-card">
        <div className="system-card-title font-mono">
          <Sliders size={16} />{' '}
          {t(
            'ИНТЕРАКТИВНАЯ ЛАБОРАТОРИЯ // ПРОВЕРКА ПРАВИЛ ВЖИВУЮ',
            'INTERACTIVE LAB // LIVE RULE VERIFICATION'
          )}
        </div>

        <div className="sandbox-grid">
          <div className="sandbox-canvas-col">
            <MemoryCanvas entry={sandboxEntry} isPlaying />
          </div>

          <div className="sandbox-controls-col">
            <p className="sandbox-intro">
              {t(
                'Переключайте художественные режимы и погодные слои на одном и том же кадре (и проведите курсором по холсту слева), чтобы увидеть, как постоянная сетка 4:5 сохраняет узнаваемость дневника, а переменные элементы меняют атмосферу:',
                'Switch artistic movements and weather layers on the same frame (and hover across the canvas on the left) to see how the persistent 4:5 grid preserves identity while dynamic variables shift the atmosphere:'
              )}
            </p>

            <div className="sandbox-group">
              <div className="mini-label font-mono">
                {t(
                  '1. ХУДОЖЕСТВЕННЫЙ РЕЖИМ И МУЗЫКАЛЬНЫЙ РИТМ',
                  '1. ARTISTIC MOVEMENT & SONIC PULSE'
                )}
              </div>
              <div className="sandbox-buttons-grid">
                {SANDBOX_PRESETS.map((p, idx) => (
                  <button
                    key={p.movement}
                    type="button"
                    className={`sandbox-btn ${presetIdx === idx ? 'active' : ''}`}
                    onClick={() => setPresetIdx(idx)}
                  >
                    <div className="sandbox-btn-title font-mono">
                      {t(p.labelRu, p.labelEn)}
                    </div>
                    <div className="sandbox-btn-sub">
                      {p.bpm} BPM ·{' '}
                      {p.tonality === 'minor' ? t('Минор', 'Minor') : t('Мажор', 'Major')}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="sandbox-group">
              <div className="mini-label font-mono">
                {t(
                  '2. АТМОСФЕРНЫЙ ПОГОДНЫЙ СЛОЙ (ЧАСТИЦЫ ХОЛСТА)',
                  '2. ATMOSPHERIC WEATHER LAYER (PARTICLES)'
                )}
              </div>
              <div className="filter-pills">
                {WEATHER_PRESETS.map((w, idx) => (
                  <button
                    key={w.id}
                    type="button"
                    className={`filter-pill ${weatherIdx === idx ? 'active' : ''}`}
                    onClick={() => setWeatherIdx(idx)}
                  >
                    <CloudRain size={13} />
                    {t(w.labelRu, w.labelEn)}
                  </button>
                ))}
              </div>
            </div>

            <div className="visual-math-grid font-mono">
              <div className="math-meter">
                <div className="math-meter-head">
                  <span>{t('Воздух (Паспарту)', 'Whitespace (Matte)')}</span>
                  <strong>
                    {Math.round(
                      sandboxEntry.analysis.visualParams.whitespace * 100
                    )}
                    %
                  </strong>
                </div>
                <div className="math-bar-track">
                  <div
                    className="math-bar-fill"
                    style={{
                      width: `${Math.round(
                        sandboxEntry.analysis.visualParams.whitespace * 100
                      )}%`,
                      backgroundColor: sandboxEntry.analysis.palette.accent,
                    }}
                  />
                </div>
              </div>

              <div className="math-meter">
                <div className="math-meter-head">
                  <span>{t('Жёсткость сетки', 'Grid Rigidity')}</span>
                  <strong>
                    {Math.round(
                      sandboxEntry.analysis.visualParams.gridRigidity * 100
                    )}
                    %
                  </strong>
                </div>
                <div className="math-bar-track">
                  <div
                    className="math-bar-fill"
                    style={{
                      width: `${Math.round(
                        sandboxEntry.analysis.visualParams.gridRigidity * 100
                      )}%`,
                      backgroundColor: sandboxEntry.analysis.palette.secondary,
                    }}
                  />
                </div>
              </div>

              <div className="math-meter">
                <div className="math-meter-head">
                  <span>{t('Скорость ритма', 'Rhythm Speed')}</span>
                  <strong>
                    {sandboxEntry.analysis.visualParams.rhythmSpeed}×
                  </strong>
                </div>
                <div className="math-bar-track">
                  <div
                    className="math-bar-fill"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round(
                          (sandboxEntry.analysis.visualParams.rhythmSpeed / 2) *
                            100
                        )
                      )}%`,
                      backgroundColor: sandboxEntry.analysis.palette.accent,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="system-grid-2">
        <div className="system-card">
          <div className="system-card-title font-mono">
            <Layers size={16} />{' '}
            {t(
              'ПОСТОЯННЫЕ ЭЛЕМЕНТЫ (ЦЕЛЬНОСТЬ ЛЕНТЫ)',
              'CONSTANT ELEMENTS (FEED COHESION)'
            )}
          </div>
          <ul className="system-list">
            <li>
              <strong>{t('Единый формат 4:5:', 'Unified 4:5 format:')}</strong>{' '}
              {t(
                'каждая запись оформляется как коллекционная страница дневника с фиксированной внешней рамкой-паспарту и Pantone-чипами палитры.',
                'every entry is structured as a collectible diary page with a fixed passe-partout matte and Pantone palette swatches.'
              )}
            </li>
            <li>
              <strong>{t('Типографическая иерархия:', 'Typographic hierarchy:')}</strong>{' '}
              {t(
                'моноширинный индекс ДЕНЬ // 01, дата и погода сверху; поэтичный заголовок папки (3–7 слов) на антикве Cormorant Garamond и личная рукописная подпись снизу.',
                'monospace DAY // 01 index, date and weather at top; poetic folder title (3–7 words) in Cormorant Garamond serif and personal handwritten signature at bottom.'
              )}
            </li>
            <li>
              <strong>{t('Окно встраивания фото:', 'Photo viewport frame:')}</strong>{' '}
              {t(
                'снимки всегда живут внутри центрального кадра и не выпадают из общей сетки.',
                'photos always live inside the unified central frame, preserving editorial grid discipline.'
              )}
            </li>
          </ul>
        </div>

        <div className="system-card">
          <div className="system-card-title font-mono">
            <Palette size={16} />{' '}
            {t(
              'ПЕРЕМЕННЫЕ ЭЛЕМЕНТЫ (УНИКАЛЬНОСТЬ ДНЯ)',
              'DYNAMIC VARIABLES (DAILY UNIQUENESS)'
            )}
          </div>
          <ul className="system-list">
            <li>
              <strong>{t('Адаптивная палитра:', 'Adaptive palette:')}</strong>{' '}
              {t(
                'вычисляется из доминирующих цветов загруженных фото (Canvas-квантование) и сдвигается по температуре настроения и тональности музыки.',
                'extracted from dominant photo colors (Canvas quantization) and modulated by emotional valence and musical tonality.'
              )}
            </li>
            <li>
              <strong>{t('Плотность «воздуха» и сетка:', 'Whitespace & grid density:')}</strong>{' '}
              {t(
                'тихие минорные дни увеличивают поля паспарту, напряжённые — сжимают их жёсткой сеткой.',
                'quiet minor-key days expand negative space, while intense days contract into a rigid geometric grid.'
              )}
            </li>
            <li>
              <strong>{t('Ритм, погода и тактильный отклик:', 'Rhythm, weather & tactile feedback:')}</strong>{' '}
              {t(
                'скорость смены кадров, погодные частицы (дождь, листья, туман, снег), мазки и геометрия откликаются на курсор и реальный спектр музыки (Web Audio API).',
                'frame transitions, weather particles (rain, leaves, fog, snow), brushstrokes and geometry respond live to the cursor and real audio spectrum (Web Audio API).'
              )}
            </li>
          </ul>
        </div>
      </div>

      <div className="system-card">
        <div className="system-card-title font-mono">
          <BookOpen size={16} />{' '}
          {t(
            '4 ХУДОЖЕСТВЕННЫХ ПРИЁМА И РЕФЕРЕНСА',
            '4 ARTISTIC MOVEMENTS & HISTORICAL REFERENCES'
          )}
        </div>
        <div className="movements-grid">
          <div className="movement-box">
            <div className="movement-tag font-mono">
              {t('01 // ИМПРЕССИОНИЗМ', '01 // IMPRESSIONISM')}
            </div>
            <h3>{t('Клод Моне — свет и мазки', 'Claude Monet — Light & Strokes')}</h3>
            <p>
              <strong>{t('Когда включается:', 'When it activates:')}</strong>{' '}
              {t(
                'тёплые, спокойные, ностальгические дни, мажорная музыка, мягкий свет на фото.',
                'warm, nostalgic, peaceful days, major-key melody, soft ambient sunlight.'
              )}
            </p>
            <p>
              <strong>{t('Как передаёт ощущение:', 'Sensory expression:')}</strong>{' '}
              {t(
                'полупрозрачные мазки из палитры снимков, диффузный свет и плавный кроссфейд кадров создают эффект тёплого воспоминания.',
                'translucent brushwork sampled from photo hues, diffuse light, and soft crossfades evoke a warm memory.'
              )}
            </p>
          </div>

          <div className="movement-box">
            <div className="movement-tag font-mono">
              {t('02 // КОНСТРУКТИВИЗМ', '02 // CONSTRUCTIVISM')}
            </div>
            <h3>{t('Василий Кандинский — геометрия', 'Wassily Kandinsky — Geometry')}</h3>
            <p>
              <strong>{t('Когда включается:', 'When it activates:')}</strong>{' '}
              {t(
                'высокий темп (>115 BPM), высокая энергия, дедлайны, ночная работа, электроника.',
                'high tempo (>115 BPM), high energy, crunch deadlines, late-night code, electronic pulse.'
              )}
            </p>
            <p>
              <strong>{t('Как передаёт ощущение:', 'Sensory expression:')}</strong>{' '}
              {t(
                'глубокая сапфировая палитра, пересекающиеся оси, резкая смена кадров и импульсные фигуры в такт басу.',
                'deep sapphire palette, intersecting axes, angular cuts, and geometric impulse rings synced to sub-bass.'
              )}
            </p>
          </div>

          <div className="movement-box">
            <div className="movement-tag font-mono">
              {t('03 // ЯПОНСКИЙ МИНИМАЛИЗМ', '03 // JAPANESE MINIMALISM')}
            </div>
            <h3>{t('Ваби-саби — воздух и тишина', 'Wabi-Sabi — Space & Stillness')}</h3>
            <p>
              <strong>{t('Когда включается:', 'When it activates:')}</strong>{' '}
              {t(
                'медленный темп (≤82 BPM), минорная тональность, туман, дождь, созерцание.',
                'slow tempo (≤82 BPM), minor key, fog, rain, solitary contemplation.'
              )}
            </p>
            <p>
              <strong>{t('Как передаёт ощущение:', 'Sensory expression:')}</strong>{' '}
              {t(
                'увеличенное негативное пространство вокруг фото, нефритово-селадоновый тон, печать ханко и тонкая горизонтальная линия туши.',
                'expanded negative space, celadon jade mist, red hanko stamp seal, and delicate horizontal sumi ink lines.'
              )}
            </p>
          </div>

          <div className="movement-box">
            <div className="movement-tag font-mono">
              {t('04 // АНАЛОГОВАЯ ПЛЁНКА', '04 // ANALOG FILM')}
            </div>
            <h3>{t('Плёнка 35mm / Коллаж', '35mm Film / Collage')}</h3>
            <p>
              <strong>{t('Когда включается:', 'When it activates:')}</strong>{' '}
              {t(
                'живые городские прогулки, смешанное настроение, средний темп, инди/поп.',
                'vibrant city walks, mixed mood, mid-tempo, indie and acoustic rhythm.'
              )}
            </p>
            <p>
              <strong>{t('Как передаёт ощущение:', 'Sensory expression:')}</strong>{' '}
              {t(
                'бегущая перфорация кадра, боковая засветка, зернистость и движение хроники.',
                'scrolling sprocket perforation, warm lateral light leaks, film grain, and cinematic chronicle pulse.'
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="system-grid-2">
        <div className="system-card">
          <div className="system-card-title font-mono">
            <Music size={16} />{' '}
            {t(
              'КАК ВВОД ВЛИЯЕТ НА РЕЗУЛЬТАТ',
              'HOW MULTIMODAL INPUT SHAPES OUTPUT'
            )}
          </div>
          <ul className="system-list">
            <li>
              <strong>{t('Текст и голос:', 'Text & voice:')}</strong>{' '}
              {t(
                'определяют время суток, сезон, погоду и валентность настроения, генерируют название папки (3–7 слов) и профиль голоса для озвучки.',
                'determine time of day, season, weather, and mood valence, generating a poetic folder title (3–7 words) and voice reading profile.'
              )}
            </li>
            <li>
              <strong>{t('Фото:', 'Photos:')}</strong>{' '}
              {t(
                'Canvas извлекает 4 доминирующих цвета, яркость и контраст — они становятся цветовой основой страницы и мазков.',
                'Canvas extracts 4 dominant colors, brightness, and contrast — becoming the chromatic foundation of the page and strokes.'
              )}
            </li>
            <li>
              <strong>{t('Музыка:', 'Music:')}</strong>{' '}
              {t(
                'Web Audio API оценивает BPM и энергию аудиофайла (или использует 30-секундные официальные превью треков + процедурный саундскейп с виниловым треском), управляя скоростью анимации и пульсацией в 60 FPS.',
                'Web Audio API analyzes BPM and energy (or streams official 30s track previews + procedural vinyl crackle soundscapes), orchestrating 60 FPS visual physics.'
              )}
            </li>
          </ul>
        </div>

        <div className="system-card">
          <div className="system-card-title font-mono">
            <Cpu size={16} />{' '}
            {t(
              'ИСПОЛЬЗОВАННЫЕ ИНСТРУМЕНТЫ И СТЕК',
              'TOOLS & TECH STACK'
            )}
          </div>
          <ul className="system-list">
            <li>
              <strong>{t('Клиентская часть:', 'Frontend Client:')}</strong> React 19, TypeScript, Vite.
            </li>
            <li>
              <strong>{t('Графика и физика холста:', 'Canvas 2D Graphics:')}</strong> HTML5 Canvas 2D{' '}
              {t(
                '(квантование цветов, погодные частицы, тактильный след курсора, экспорт PNG и запись WebM-видео через MediaRecorder).',
                '(color quantization, weather particles, cursor trace physics, PNG export, and WebM video recording via MediaRecorder).'
              )}
            </li>
            <li>
              <strong>{t('Аудио и речь:', 'Audio & Speech:')}</strong> Web Audio API{' '}
              {t(
                '(AnalyserNode, оценка BPM/RMS, виниловый эмбиент-слой), iTunes Search API (30-сек превью), Web Speech API (синтез речи и голосовая диктовка).',
                '(AnalyserNode, BPM/RMS estimation, procedural vinyl layer), iTunes Search API (30s preview), Web Speech API (speech synthesis & voice dictation).'
              )}
            </li>
            <li>
              <strong>{t('Хранилище и синхронизация:', 'Storage & Cloud Sync:')}</strong> IndexedDB{' '}
              {t(
                'для локальных изолированных папок + Supabase PostgreSQL & Clerk для облачной синхронизации.',
                'for isolated local memory vaults + Supabase PostgreSQL & Clerk for cloud synchronization.'
              )}
            </li>
          </ul>
        </div>
      </div>

      <div className="system-footer-note font-mono">
        <Sparkles size={14} />
        <span>
          {t(
            'Все демо-дни в архиве сгенерированы без использования чужих личных дневников или защищённых авторским правом полных аудиофайлов.',
            'All demo days in the archive were generated without using copyrighted audio or other people’s personal diaries.'
          )}
        </span>
      </div>
    </div>
  );
};
