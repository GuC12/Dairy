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

interface VisualSystemPageProps {
  sampleEntry?: DiaryEntry;
}

const SANDBOX_PRESETS: Array<{
  movement: ArtMovementId;
  label: string;
  text: string;
  bpm: number;
  tonality: 'major' | 'minor';
  energy: number;
  artist: string;
  title: string;
}> = [
  {
    movement: 'impressionism',
    label: '01 // Моне (Импрессионизм)',
    text: 'Тёплый солнечный день в осеннем парке, пили горячее какао у пруда и долго разговаривали.',
    bpm: 76,
    tonality: 'major',
    energy: 0.36,
    artist: 'Frank Sinatra',
    title: 'Autumn in New York',
  },
  {
    movement: 'constructivism',
    label: '02 // Кандинский (Конструктивизм)',
    text: 'Срочная сдача проекта, ночь в офисе, дедлайн, код на экране и плотный электронный ритм.',
    bpm: 132,
    tonality: 'minor',
    energy: 0.88,
    artist: 'Rival Consoles',
    title: 'Midnight Grid',
  },
  {
    movement: 'wabi-sabi',
    label: '03 // Ваби-саби (Минимализм)',
    text: 'Тишина, туман над пустым утренним берегом, медленный поезд и спокойное созерцание.',
    bpm: 64,
    tonality: 'minor',
    energy: 0.22,
    artist: 'Brian Eno',
    title: 'An Ending (Ascent)',
  },
  {
    movement: 'film-35mm',
    label: '04 // Плёнка 35mm (Коллаж)',
    text: 'Вечерняя прогулка по городу на старом трамвае, огни витрин и кофе на остановке.',
    bpm: 104,
    tonality: 'major',
    energy: 0.56,
    artist: 'Pomplamoose',
    title: 'La Javanaise',
  },
];

const WEATHER_PRESETS = [
  { id: 'leaves', label: 'Осенний листопад', weather: '+8°C, листопад в парке' },
  { id: 'rain', label: 'Дождь и гроза', weather: '+6°C, дождь и гроза' },
  { id: 'mist', label: 'Густой туман', weather: '+4°C, густой туман у моря' },
  { id: 'snow', label: 'Зимний снегопад', weather: '-4°C, тихий снег' },
];

export const VisualSystemPage: React.FC<VisualSystemPageProps> = ({
  sampleEntry,
}) => {
  const [presetIdx, setPresetIdx] = useState(0);
  const [weatherIdx, setWeatherIdx] = useState(0);

  const sandboxEntry: DiaryEntry = useMemo(() => {
    const preset = SANDBOX_PRESETS[presetIdx];
    const wPreset = WEATHER_PRESETS[weatherIdx];
    const photos = sampleEntry?.photos ?? [];
    const combinedText = `${preset.text} (${wPreset.weather})`;
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
      dateLabel: '21 ноября 2026',
      weather: wPreset.weather,
      location: 'Интерактивный стенд',
      text: combinedText,
      signature: 'Один кадр — четыре визуальных языка',
      photos,
      music,
      analysis,
    };
  }, [presetIdx, weatherIdx, sampleEntry]);

  return (
    <div className="system-page view-enter">
      <div className="system-header">
        <div className="font-mono section-kicker">
          АРХИТЕКТУРА И ВИЗУАЛЬНАЯ ГРАММАТИКА
        </div>
        <h1 className="font-serif create-title">
          Единая визуальная система дневника
        </h1>
        <p className="hero-subtitle">
          Дневник — это серия, а не набор случайных картинок. Каждая генерация
          подчиняется строгим правилам перевода невидимого ощущения дня в
          видимую форму.
        </p>
      </div>

      {/* Интерактивная лаборатория визуальной системы для демонстрации жюри */}
      <div className="system-card sandbox-card">
        <div className="system-card-title font-mono">
          <Sliders size={16} /> ИНТЕРАКТИВНАЯ ЛАБОРАТОРИЯ // ПРОВЕРКА ПРАВИЛ ВЖИВУЮ
        </div>

        <div className="sandbox-grid">
          <div className="sandbox-canvas-col">
            <MemoryCanvas entry={sandboxEntry} isPlaying />
          </div>

          <div className="sandbox-controls-col">
            <p className="sandbox-intro">
              Переключайте художественные режимы и погодные слои на одном и том
              же кадре (и проведите курсором по холсту слева), чтобы увидеть,
              как <strong>постоянная сетка 4:5</strong> сохраняет узнаваемость
              дневника, а <strong>переменные элементы</strong> меняют атмосферу:
            </p>

            <div className="sandbox-group">
              <div className="mini-label font-mono">
                1. ХУДОЖЕСТВЕННЫЙ РЕЖИМ И МУЗЫКАЛЬНЫЙ РИТМ
              </div>
              <div className="sandbox-buttons-grid">
                {SANDBOX_PRESETS.map((p, idx) => (
                  <button
                    key={p.movement}
                    type="button"
                    className={`sandbox-btn ${presetIdx === idx ? 'active' : ''}`}
                    onClick={() => setPresetIdx(idx)}
                  >
                    <div className="sandbox-btn-title font-mono">{p.label}</div>
                    <div className="sandbox-btn-sub">
                      {p.bpm} BPM · {p.tonality === 'minor' ? 'Минор' : 'Мажор'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="sandbox-group">
              <div className="mini-label font-mono">
                2. АТМОСФЕРНЫЙ ПОГОДНЫЙ СЛОЙ (ЧАСТИЦЫ ХОЛСТА)
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
                    {w.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="visual-math-grid font-mono">
              <div className="math-meter">
                <div className="math-meter-head">
                  <span>Воздух (Паспарту)</span>
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
                  <span>Жёсткость сетки</span>
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
                  <span>Скорость ритма</span>
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
            <Layers size={16} /> ПОСТОЯННЫЕ ЭЛЕМЕНТЫ (ЦЕЛЬНОСТЬ ЛЕНТЫ)
          </div>
          <ul className="system-list">
            <li>
              <strong>Единый формат 4:5:</strong> каждая запись оформляется как
              коллекционная страница дневника с фиксированной внешней
              рамкой-паспарту и Pantone-чипами палитры.
            </li>
            <li>
              <strong>Типографическая иерархия:</strong> моноширинный индекс{' '}
              <code>ДЕНЬ // 01</code>, дата и погода сверху; поэтичный заголовок
              папки (3–7 слов) на антикве <em>Cormorant Garamond</em> и личная
              рукописная подпись снизу.
            </li>
            <li>
              <strong>Окно встраивания фото:</strong> снимки всегда живут внутри
              центрального кадра и не выпадают из общей сетки.
            </li>
          </ul>
        </div>

        <div className="system-card">
          <div className="system-card-title font-mono">
            <Palette size={16} /> ПЕРЕМЕННЫЕ ЭЛЕМЕНТЫ (УНИКАЛЬНОСТЬ ДНЯ)
          </div>
          <ul className="system-list">
            <li>
              <strong>Адаптивная палитра:</strong> вычисляется из доминирующих
              цветов загруженных фото (Canvas-квантование) и сдвигается по
              температуре настроения и тональности музыки.
            </li>
            <li>
              <strong>Плотность «воздуха» и сетка:</strong> тихие минорные дни
              увеличивают поля паспарту, напряжённые — сжимают их жёсткой
              сеткой.
            </li>
            <li>
              <strong>Ритм, погода и тактильный отклик:</strong> скорость смены
              кадров, погодные частицы (дождь, листья, туман, снег), мазки и
              геометрия откликаются на курсор и реальный спектр музыки (Web
              Audio API).
            </li>
          </ul>
        </div>
      </div>

      <div className="system-card">
        <div className="system-card-title font-mono">
          <BookOpen size={16} /> 4 ХУДОЖЕСТВЕННЫХ ПРИЁМА И РЕФЕРЕНСА
        </div>
        <div className="movements-grid">
          <div className="movement-box">
            <div className="movement-tag font-mono">01 // ИМПРЕССИОНИЗМ</div>
            <h3>Клод Моне — свет и мазки</h3>
            <p>
              <strong>Когда включается:</strong> тёплые, спокойные,
              ностальгические дни, мажорная музыка, мягкий свет на фото.
            </p>
            <p>
              <strong>Как передаёт ощущение:</strong> полупрозрачные мазки из
              палитры снимков, диффузный свет и плавный кроссфейд кадров создают
              эффект тёплого воспоминания.
            </p>
          </div>

          <div className="movement-box">
            <div className="movement-tag font-mono">02 // КОНСТРУКТИВИЗМ</div>
            <h3>Василий Кандинский — геометрия</h3>
            <p>
              <strong>Когда включается:</strong> высокий темп (&gt;115 BPM),
              высокая энергия, дедлайны, ночная работа, электроника.
            </p>
            <p>
              <strong>Как передаёт ощущение:</strong> глубокая сапфировая
              палитра, пересекающиеся оси, резкая смена кадров и импульсные
              фигуры в такт басу.
            </p>
          </div>

          <div className="movement-box">
            <div className="movement-tag font-mono">03 // ЯПОНСКИЙ МИНИМАЛИЗМ</div>
            <h3>Ваби-саби — воздух и тишина</h3>
            <p>
              <strong>Когда включается:</strong> медленный темп (&le;82 BPM),
              минорная тональность, туман, дождь, созерцание.
            </p>
            <p>
              <strong>Как передаёт ощущение:</strong> увеличенное негативное
              пространство вокруг фото, нефритово-селадоновый тон, печать ханко
              и тонкая горизонтальная линия туши.
            </p>
          </div>

          <div className="movement-box">
            <div className="movement-tag font-mono">04 // АНАЛОГОВАЯ ПЛЁНКА</div>
            <h3>Плёнка 35mm / Коллаж</h3>
            <p>
              <strong>Когда включается:</strong> живые городские прогулки,
              смешанное настроение, средний темп, инди/поп.
            </p>
            <p>
              <strong>Как передаёт ощущение:</strong> бегущая перфорация кадра,
              боковая засветка, зернистость и движение хроники.
            </p>
          </div>
        </div>
      </div>

      <div className="system-grid-2">
        <div className="system-card">
          <div className="system-card-title font-mono">
            <Music size={16} /> КАК ВВОД ВЛИЯЕТ НА РЕЗУЛЬТАТ
          </div>
          <ul className="system-list">
            <li>
              <strong>Текст и голос:</strong> определяют время суток, сезон,
              погоду и валентность настроения, генерируют название папки (3–7
              слов) и профиль голоса для озвучки.
            </li>
            <li>
              <strong>Фото:</strong> Canvas извлекает 4 доминирующих цвета,
              яркость и контраст — они становятся цветовой основой страницы и
              мазков.
            </li>
            <li>
              <strong>Музыка:</strong> Web Audio API оценивает BPM и энергию
              аудиофайла (или использует 30-секундные официальные превью треков
              + процедурный саундскейп с виниловым треском), управляя скоростью
              анимации и пульсацией в 60 FPS.
            </li>
          </ul>
        </div>

        <div className="system-card">
          <div className="system-card-title font-mono">
            <Cpu size={16} /> ИСПОЛЬЗОВАННЫЕ ИНСТРУМЕНТЫ И СТЕК
          </div>
          <ul className="system-list">
            <li>
              <strong>Клиентская часть:</strong> React 19, TypeScript, Vite.
            </li>
            <li>
              <strong>Графика и физика холста:</strong> HTML5 Canvas 2D
              (квантование цветов, погодные частицы, тактильный след курсора,
              экспорт PNG и запись WebM-видео через <code>MediaRecorder</code>).
            </li>
            <li>
              <strong>Аудио и речь:</strong> Web Audio API (
              <code>AnalyserNode</code>, оценка BPM/RMS, виниловый эмбиент-слой),
              iTunes Search API (30-сек превью), Web Speech API (синтез речи и
              голосовая диктовка).
            </li>
            <li>
              <strong>Хранилище и гео-контекст:</strong> IndexedDB для локальных
              папок дней + Open-Meteo & Nominatim API для авто-погоды.
            </li>
          </ul>
        </div>
      </div>

      <div className="system-footer-note font-mono">
        <Sparkles size={14} />
        <span>
          Все демо-дни в архиве сгенерированы без использования чужих личных
          дневников или защищённых авторским правом полных аудиофайлов.
        </span>
      </div>
    </div>
  );
};
