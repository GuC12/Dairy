import { useEffect, useState } from 'react';
import { BookOpen, FolderKanban, Plus, Settings2 } from 'lucide-react';
import type { DiaryEntry } from './types/diary';
import {
  deleteDay,
  loadAllDays,
  resetToSeedDays,
  saveDay,
} from './storage/diaryDb';
import { ArchiveFeed } from './components/ArchiveFeed';
import { DayFolderView } from './components/DayFolderView';
import { CreateDayView } from './components/CreateDayView';
import { VisualSystemPage } from './components/VisualSystemPage';
import { SettingsModal } from './components/SettingsModal';
import './App.css';

type TabView = 'archive' | 'create' | 'system' | 'folder';

const KEY_STORAGE = 'atmos_gemini_api_key';

export function App() {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<TabView>('archive');
  const [selectedEntry, setSelectedEntry] = useState<DiaryEntry | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [geminiKey, setGeminiKey] = useState(
    () => localStorage.getItem(KEY_STORAGE) ?? ''
  );

  useEffect(() => {
    loadAllDays().then((days) => {
      setEntries(days);
      setIsLoading(false);
    });
  }, []);

  const handleSaveKey = (key: string) => {
    setGeminiKey(key);
    if (key) {
      localStorage.setItem(KEY_STORAGE, key);
    } else {
      localStorage.removeItem(KEY_STORAGE);
    }
  };

  const handleCreated = async (entry: DiaryEntry) => {
    await saveDay(entry);
    setEntries((prev) => [entry, ...prev]);
    setSelectedEntry(entry);
    setView('folder');
  };

  const handleDelete = async (id: string) => {
    await deleteDay(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
    setSelectedEntry(null);
    setView('archive');
  };

  const handleResetDemo = async () => {
    setIsLoading(true);
    const days = await resetToSeedDays();
    setEntries(days);
    setSelectedEntry(null);
    setView('archive');
    setIsLoading(false);
  };

  const nextIndex =
    entries.length > 0
      ? Math.max(...entries.map((e) => e.indexNumber)) + 1
      : 1;

  return (
    <div className="app-shell bg-gallery-grid">
      <header className="topbar">
        <div
          className="brand"
          onClick={() => {
            setSelectedEntry(null);
            setView('archive');
          }}
        >
          <span className="brand-dot animate-pulse-dot" />
          <span className="brand-name font-mono">ATMOS</span>
          <span className="brand-sub font-mono">// ARTTECH DIARY</span>
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
            onClick={() => setView('create')}
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
          className="btn-ghost settings-btn font-mono"
          onClick={() => setShowSettings(true)}
        >
          <Settings2 size={15} />
          {geminiKey ? 'Gemini ON' : 'Local Engine'}
        </button>
      </header>

      <main className="main-container">
        {isLoading ? (
          <div className="loading-state font-mono">
            Инициализация архива и папок дней...
          </div>
        ) : view === 'folder' && selectedEntry ? (
          <DayFolderView
            entry={selectedEntry}
            onBack={() => {
              setSelectedEntry(null);
              setView('archive');
            }}
            onDelete={handleDelete}
          />
        ) : view === 'create' ? (
          <CreateDayView
            nextIndex={nextIndex}
            geminiApiKey={geminiKey}
            onCreated={handleCreated}
            onCancel={() => setView('archive')}
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
            onCreateNew={() => setView('create')}
          />
        )}
      </main>

      <footer className="app-footer font-mono">
        <span>GENESIS HACKATHON // ARTTECH // MAKE THE INVISIBLE VISIBLE_</span>
        <span>4:5 UNIFIED VISUAL SYSTEM</span>
      </footer>

      {showSettings && (
        <SettingsModal
          apiKey={geminiKey}
          onSaveKey={handleSaveKey}
          onResetDemo={handleResetDemo}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

export default App;
