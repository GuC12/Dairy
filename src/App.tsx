import React, { useEffect, useState } from 'react';
import { BookOpen, FolderKanban, Palette, Plus } from 'lucide-react';
import type { DiaryEntry } from './types/diary';
import { deleteDay, loadAllDays, saveDay } from './storage/diaryDb';
import { ArchiveFeed } from './components/ArchiveFeed';
import { DayFolderView } from './components/DayFolderView';
import { CreateDayView } from './components/CreateDayView';
import { VisualSystemPage } from './components/VisualSystemPage';
import './App.css';

type TabView = 'archive' | 'create' | 'system' | 'folder';
type GalleryTheme = 'prism' | 'editorial';

export function App() {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<TabView>('archive');
  const [selectedEntry, setSelectedEntry] = useState<DiaryEntry | null>(null);
  const [editingEntry, setEditingEntry] = useState<DiaryEntry | null>(null);
  const [hoveredEntry, setHoveredEntry] = useState<DiaryEntry | null>(null);
  const [theme, setTheme] = useState<GalleryTheme>('prism');

  useEffect(() => {
    loadAllDays().then((days) => {
      setEntries(days);
      setIsLoading(false);
    });
  }, []);

  const handleCreated = async (entry: DiaryEntry) => {
    await saveDay(entry);
    setEntries((prev) => {
      const exists = prev.some((e) => e.id === entry.id);
      if (exists) {
        return prev.map((e) => (e.id === entry.id ? entry : e));
      }
      return [entry, ...prev];
    });
    setEditingEntry(null);
    setSelectedEntry(entry);
    setView('folder');
  };

  const handleDelete = async (id: string) => {
    await deleteDay(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
    setSelectedEntry(null);
    setView('archive');
  };

  const nextIndex =
    entries.length > 0
      ? Math.max(...entries.map((e) => e.indexNumber)) + 1
      : 1;

  // Активный источник цветовой ауры сайта: открытый день, наведённый день или 4 стихии
  const activeAuraEntry = selectedEntry ?? hoveredEntry;
  const auraColors = activeAuraEntry
    ? [
        activeAuraEntry.analysis.palette.accent,
        activeAuraEntry.analysis.palette.secondary,
        activeAuraEntry.photos[0]?.dominantColors[0] ?? '#38bdf8',
        activeAuraEntry.photos[0]?.dominantColors[2] ?? '#a855f7',
      ]
    : ['#f59e0b', '#38bdf8', '#10b981', '#ec4899'];

  return (
    <div
      className={`app-shell theme-${theme}`}
      style={
        {
          '--aura-1': auraColors[0],
          '--aura-2': auraColors[1],
          '--aura-3': auraColors[2],
          '--aura-4': auraColors[3],
        } as React.CSSProperties
      }
    >
      {/* Многоцветная живая фоновая аура, реагирующая на каждый день */}
      <div className="chromatic-aurora-stage" aria-hidden="true">
        <div className="aurora-orb orb-1" />
        <div className="aurora-orb orb-2" />
        <div className="aurora-orb orb-3" />
        <div className="aurora-orb orb-4" />
        <div className="aurora-grid-overlay" />
      </div>

      <header className="topbar">
        <div
          className="brand"
          onClick={() => {
            setSelectedEntry(null);
            setView('archive');
          }}
        >
          <span className="brand-dot animate-pulse-dot" />
          <span className="brand-name font-mono">ATMOS_</span>
          <span className="brand-sub font-mono">// GENESIS.ARTTECH</span>
        </div>

        <nav className="topnav">
          <button
            className={`nav-btn ${view === 'archive' || view === 'folder' ? 'active' : ''}`}
            onClick={() => {
              setSelectedEntry(null);
              setView('archive');
            }}
          >
            <FolderKanban size={15} />
            Архив дней ({entries.length})
          </button>

          <button
            className={`nav-btn ${view === 'create' ? 'active' : ''}`}
            onClick={() => {
              setEditingEntry(null);
              setView('create');
            }}
          >
            <Plus size={15} />
            Новый день
          </button>

          <button
            className={`nav-btn ${view === 'system' ? 'active' : ''}`}
            onClick={() => setView('system')}
          >
            <BookOpen size={15} />
            Визуальная система
          </button>
        </nav>

        <button
          type="button"
          className="theme-switch-btn font-mono"
          onClick={() =>
            setTheme((prev) => (prev === 'prism' ? 'editorial' : 'prism'))
          }
          title="Переключить атмосферу галереи"
        >
          <Palette size={14} />
          <span>
            {theme === 'prism' ? 'Chromatic Prism' : 'Genesis Paper'}
          </span>
        </button>
      </header>

      <main className="main-container">
        {isLoading ? (
          <div className="loading-state font-mono">
            Синтез хроматического архива и папок дней...
          </div>
        ) : view === 'folder' && selectedEntry ? (
          <DayFolderView
            entry={selectedEntry}
            onBack={() => {
              setSelectedEntry(null);
              setView('archive');
            }}
            onEdit={(entry) => {
              setEditingEntry(entry);
              setView('create');
            }}
            onDelete={handleDelete}
          />
        ) : view === 'create' ? (
          <CreateDayView
            nextIndex={nextIndex}
            editingEntry={editingEntry}
            onCreated={handleCreated}
            onCancel={() => {
              setEditingEntry(null);
              setView(selectedEntry ? 'folder' : 'archive');
            }}
          />
        ) : view === 'system' ? (
          <VisualSystemPage />
        ) : (
          <ArchiveFeed
            entries={entries}
            onSelect={(entry) => {
              setSelectedEntry(entry);
              setView('folder');
            }}
            onCreateNew={() => {
              setEditingEntry(null);
              setView('create');
            }}
            onImport={handleCreated}
            onHoverEntry={setHoveredEntry}
          />
        )}
      </main>

      <footer className="app-footer font-mono">
        <span>GENESIS HACKATHON // ARTTECH // MAKE THE INVISIBLE VISIBLE_</span>
        <span>4:5 POLYCHROME VISUAL SYSTEM</span>
      </footer>
    </div>
  );
}

export default App;
