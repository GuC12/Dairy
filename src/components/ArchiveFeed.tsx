import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Disc3,
  Download,
  Folder,
  Pause,
  Play,
  Plus,
  Search,
  Sparkles,
  Upload,
} from 'lucide-react';
import type { ArtMovementId, DiaryEntry } from '../types/diary';
import { DayAudioController } from '../engine/audioAnalyzer';
import { MemoryCanvas } from './MemoryCanvas';
import { AtmosphereCompass } from './AtmosphereCompass';

interface ArchiveFeedProps {
  entries: DiaryEntry[];
  onSelect: (entry: DiaryEntry) => void;
  onOpenRandomCapsule: () => void;
  onCreateNew: () => void;
  onImport: (entry: DiaryEntry) => void;
  onHoverEntry?: (entry: DiaryEntry | null) => void;
}

const FILTERS: Array<{
  id: 'all' | ArtMovementId;
  label: string;
  dotColor: string;
}> = [
  { id: 'all', label: 'Все экспонаты', dotColor: '#f472b6' },
  { id: 'impressionism', label: 'Моне · Свет', dotColor: '#f59e0b' },
  { id: 'constructivism', label: 'Кандинский · Ритм', dotColor: '#38bdf8' },
  { id: 'wabi-sabi', label: 'Ваби-саби · Тишина', dotColor: '#34d399' },
  { id: 'film-35mm', label: 'Плёнка 35mm · Хроника', dotColor: '#c084fc' },
];

const MOVEMENT_SHORT: Record<ArtMovementId, { tag: string; color: string }> = {
  impressionism: { tag: 'МОНЕ // СВЕТ', color: '#f59e0b' },
  constructivism: { tag: 'КАНДИНСКИЙ // РИТМ', color: '#38bdf8' },
  'wabi-sabi': { tag: 'ВАБИ-САБИ // ВОЗДУХ', color: '#34d399' },
  'film-35mm': { tag: '35MM // АНАЛОГ', color: '#c084fc' },
};

export const ArchiveFeed: React.FC<ArchiveFeedProps> = ({
  entries,
  onSelect,
  onOpenRandomCapsule,
  onCreateNew,
  onImport,
  onHoverEntry,
}) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | ArtMovementId>('all');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<DayAudioController | null>(null);

  useEffect(() => {
    const ctrl = new DayAudioController();
    audioRef.current = ctrl;
    return () => {
      ctrl.stop();
    };
  }, []);

  const toggleInlinePlay = (e: React.MouseEvent, entry: DiaryEntry) => {
    e.stopPropagation();
    const ctrl = audioRef.current;
    if (!ctrl) return;
    if (playingId === entry.id) {
      ctrl.stop();
      setPlayingId(null);
    } else {
      ctrl.start(entry.music);
      setPlayingId(entry.id);
      onHoverEntry?.(entry);
    }
  };

  const handleImportFile = async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as DiaryEntry | DiaryEntry[];
      const list = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of list) {
        if (item && item.text && item.analysis && item.photos) {
          onImport({
            ...item,
            id: item.id || `imported_${Date.now()}`,
          });
        }
      }
    } catch {
      // ignore invalid files
    }
  };

  const handleExportAll = () => {
    const blob = new Blob([JSON.stringify(entries, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `atmos_diary_backup_${entries.length}_days.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (filter !== 'all' && e.analysis.movement !== filter) return false;
      if (!q) return true;
      return (
        e.analysis.folderName.toLowerCase().includes(q) ||
        e.text.toLowerCase().includes(q) ||
        e.music.title.toLowerCase().includes(q) ||
        e.music.artist.toLowerCase().includes(q)
      );
    });
  }, [entries, query, filter]);

  return (
    <div className="archive-view view-enter">
      {/* Editorial Genesis Hero */}
      <div className="archive-hero">
        <div className="hero-left-col">
          <div className="genesis-exe-bar font-mono">
            <span className="exe-title">[ atmos.exe // art_case_2026 ]</span>
            <div className="exe-squares">
              <span style={{ background: '#f59e0b' }} />
              <span style={{ background: '#38bdf8' }} />
              <span style={{ background: '#34d399' }} />
              <span style={{ background: '#ec4899' }} />
            </div>
          </div>

          <h1 className="font-serif hero-title">
            Make the <span className="hero-gradient-word">Invisible</span>{' '}
            <em>Visible_</em>
          </h1>

          <p className="hero-subtitle">
            Личный дневник-галерея, превращающий текст, фотографии и музыку в
            живое воспоминание. Каждая страница подчиняется единой модульной
            сетке <strong>4:5</strong>, но обретает собственный цвет, мазок и
            звуковой пульс.
          </p>

          {/* Хроматическая ДНК всего дневника */}
          {entries.length > 0 && (
            <div className="chromatic-dna-box">
              <div className="dna-head font-mono">
                <Sparkles size={13} />
                <span>ХРОМАТИЧЕСКИЙ СПЕКТР ДНЕВНИКА ({entries.length} ДНЕЙ)</span>
              </div>
              <div className="dna-ribbon">
                {entries.map((entry) => {
                  const colors = entry.photos[0]?.dominantColors ?? [
                    entry.analysis.palette.accent,
                    entry.analysis.palette.secondary,
                  ];
                  const c1 = colors[0] ?? entry.analysis.palette.accent;
                  const c2 = colors[1] ?? entry.analysis.palette.secondary;
                  const isFocused =
                    hoveredId === entry.id || playingId === entry.id;

                  return (
                    <button
                      key={entry.id}
                      type="button"
                      className={`dna-segment ${isFocused ? 'is-focused' : ''}`}
                      style={{
                        background: `linear-gradient(135deg, ${c1}, ${c2})`,
                      }}
                      onMouseEnter={() => {
                        setHoveredId(entry.id);
                        onHoverEntry?.(entry);
                      }}
                      onClick={() => onSelect(entry)}
                      title={`${entry.analysis.folderName} · ${entry.music.bpm} BPM`}
                    >
                      <span className="dna-day font-mono">
                        {String(entry.indexNumber).padStart(2, '0')}
                      </span>
                      <span className="dna-name">{entry.analysis.folderName}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="hero-right-col">
          <AtmosphereCompass
            entries={entries}
            activeId={hoveredId ?? playingId ?? undefined}
            onSelect={onSelect}
            compact
          />
          <div className="hero-cta-row">
            <button className="btn-primary btn-large" onClick={onCreateNew}>
              <Plus size={18} />
              Записать новый день
            </button>
          </div>
          <div className="hero-secondary-row">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                audioRef.current?.stop();
                setPlayingId(null);
                onOpenRandomCapsule();
              }}
              disabled={entries.length === 0}
              title="Открыть случайное воспоминание в полноэкранном режиме погружения"
            >
              <Sparkles size={15} />
              Капсула времени
            </button>

            <button
              type="button"
              className="btn-secondary"
              onClick={handleExportAll}
              title="Скачать полный бэкап всего дневника (.json)"
            >
              <Download size={15} />
              Бэкап
            </button>

            <label
              className="btn-secondary"
              title="Загрузить папку дня или полный бэкап (.json)"
            >
              <Upload size={15} />
              Импорт
              <input
                type="file"
                accept=".json,.atmos.json,application/json"
                hidden
                onChange={(e) => handleImportFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
        </div>
      </div>

      {/* Поиск и полихромные фильтры */}
      <div className="archive-toolbar">
        <div className="search-box">
          <Search size={16} />
          <input
            type="text"
            placeholder="Поиск по папкам, тексту или песне..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="filter-pills">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              className={`filter-pill ${filter === f.id ? 'active' : ''}`}
              onClick={() => setFilter(f.id)}
            >
              <span
                className="filter-dot"
                style={{ backgroundColor: f.dotColor }}
              />
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-archive">
          <p>По вашему запросу папок не найдено.</p>
        </div>
      ) : (
        <div className="archive-grid">
          {filtered.map((entry, idx) => {
            const mv = MOVEMENT_SHORT[entry.analysis.movement];
            const isCardPlaying = playingId === entry.id;
            const isCardActive = hoveredId === entry.id || isCardPlaying;
            const swatches = entry.photos[0]?.dominantColors ?? [
              entry.analysis.palette.accent,
              entry.analysis.palette.secondary,
            ];

            return (
              <article
                key={entry.id}
                className={`archive-card ${isCardPlaying ? 'is-playing-card' : ''}`}
                style={
                  {
                    animationDelay: `${idx * 65}ms`,
                    '--card-accent': entry.analysis.palette.accent,
                    '--card-secondary': entry.analysis.palette.secondary,
                    '--card-movement': mv.color,
                  } as React.CSSProperties
                }
                onMouseEnter={() => {
                  setHoveredId(entry.id);
                  onHoverEntry?.(entry);
                }}
                onMouseLeave={() => {
                  setHoveredId(null);
                }}
                onClick={() => {
                  audioRef.current?.stop();
                  setPlayingId(null);
                  onSelect(entry);
                }}
              >
                {/* Верхний паспорт экспоната с живыми цветами фото */}
                <div className="card-exhibit-bar font-mono">
                  <span
                    className="exhibit-badge"
                    style={{
                      color: mv.color,
                      borderColor: `${mv.color}55`,
                      background: `${mv.color}16`,
                    }}
                  >
                    {mv.tag}
                  </span>

                  <div className="card-swatches" title="Палитра фотографий дня">
                    {swatches.slice(0, 4).map((hex, sIdx) => (
                      <span
                        key={sIdx}
                        className="card-swatch-dot"
                        style={{ backgroundColor: hex }}
                      />
                    ))}
                  </div>
                </div>

                <div className="archive-canvas-wrap">
                  <MemoryCanvas
                    entry={entry}
                    compact
                    isPlaying={isCardActive}
                    getSpectrum={
                      isCardPlaying
                        ? () =>
                            audioRef.current?.getSpectrumMetrics() ?? {
                              bass: 0,
                              mid: 0,
                              treble: 0,
                              energy: 0,
                              bars: [],
                            }
                        : undefined
                    }
                  />
                  <div className="archive-hover-pill font-mono">
                    Открыть папку дня →
                  </div>
                </div>

                <div className="archive-card-meta">
                  <div className="archive-folder-row font-mono">
                    <Folder
                      size={13}
                      style={{ color: entry.analysis.palette.accent }}
                    />
                    <span>{entry.analysis.folderName}</span>
                  </div>

                  {/* Интерактивная музыкальная капсула с винилом */}
                  <div className="card-vinyl-row">
                    <button
                      type="button"
                      className={`vinyl-play-btn ${isCardPlaying ? 'playing' : ''}`}
                      style={{
                        borderColor: entry.analysis.palette.accent,
                      }}
                      onClick={(e) => toggleInlinePlay(e, entry)}
                      title={
                        isCardPlaying
                          ? 'Остановить музыку'
                          : 'Послушать атмосферу прямо в ленте'
                      }
                    >
                      <Disc3
                        size={15}
                        className={isCardPlaying ? 'spin-slow' : ''}
                      />
                      {isCardPlaying ? <Pause size={12} /> : <Play size={12} />}
                    </button>

                    <div className="vinyl-track-text">
                      <div className="vinyl-track-name">
                        {entry.music.artist ? `${entry.music.artist} — ` : ''}
                        {entry.music.title}
                      </div>
                      <div className="archive-card-sub font-mono">
                        <span>{entry.analysis.moodLabel}</span>
                        <span>·</span>
                        <span>{entry.music.bpm} BPM</span>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
