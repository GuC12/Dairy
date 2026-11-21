import React, { useMemo, useState } from 'react';
import { Folder, Plus, Search, Upload } from 'lucide-react';
import type { ArtMovementId, DiaryEntry } from '../types/diary';
import { MemoryCanvas } from './MemoryCanvas';
import { AtmosphereCompass } from './AtmosphereCompass';

interface ArchiveFeedProps {
  entries: DiaryEntry[];
  onSelect: (entry: DiaryEntry) => void;
  onCreateNew: () => void;
  onImport: (entry: DiaryEntry) => void;
}

const FILTERS: Array<{ id: 'all' | ArtMovementId; label: string }> = [
  { id: 'all', label: 'Все дни' },
  { id: 'impressionism', label: 'Моне / Импрессионизм' },
  { id: 'constructivism', label: 'Кандинский / Конструктивизм' },
  { id: 'wabi-sabi', label: 'Ваби-саби / Минимализм' },
  { id: 'film-35mm', label: 'Плёнка 35mm' },
];

export const ArchiveFeed: React.FC<ArchiveFeedProps> = ({
  entries,
  onSelect,
  onCreateNew,
  onImport,
}) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | ArtMovementId>('all');
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleImportFile = async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as DiaryEntry;
      if (parsed && parsed.text && parsed.analysis && parsed.photos) {
        onImport({
          ...parsed,
          id: `imported_${Date.now()}`,
        });
      }
    } catch {
      // ignore invalid files
    }
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
      <div className="archive-hero">
        <div>
          <div className="font-mono section-kicker">
            GENESIS ARTTECH // ПРОВЕРКА ЛЕНТОЙ
          </div>
          <h1 className="font-serif hero-title">
            Дневник ощущений — <em>Make the Invisible Visible_</em>
          </h1>
          <p className="hero-subtitle">
            Каждая папка хранит текст, фотографии, песню и собранное воспоминание.
            Все страницы подчиняются единой сетке 4:5, но меняют палитру, фактуру и ритм под атмосферу дня.
          </p>
        </div>
        <div className="hero-right-col">
          <AtmosphereCompass
            entries={entries}
            onSelect={onSelect}
            compact
          />
          <div className="hero-cta-row">
            <button className="btn-primary btn-large" onClick={onCreateNew}>
              <Plus size={18} />
              Записать новый день
            </button>
            <label
              className="btn-secondary"
              title="Загрузить папку дня (.atmos.json)"
            >
              <Upload size={16} />
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
          {filtered.map((entry, idx) => (
            <article
              key={entry.id}
              className="archive-card"
              style={{ animationDelay: `${idx * 65}ms` }}
              onMouseEnter={() => setHoveredId(entry.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => onSelect(entry)}
            >
              <div className="archive-canvas-wrap">
                <MemoryCanvas
                  entry={entry}
                  compact
                  isPlaying={hoveredId === entry.id}
                />
                <div className="archive-hover-pill font-mono">
                  Открыть воспоминание →
                </div>
              </div>

              <div className="archive-card-meta">
                <div className="archive-folder-row font-mono">
                  <Folder size={13} />
                  <span>{entry.analysis.folderName}</span>
                </div>
                <div className="archive-card-sub">
                  <span>{entry.analysis.moodLabel}</span>
                  <span>·</span>
                  <span>{entry.photos.length} фото</span>
                  <span>·</span>
                  <span>{entry.music.bpm} BPM</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};
