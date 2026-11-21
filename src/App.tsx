import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ClerkProvider } from '@clerk/clerk-react';
import {
  BookOpen,
  Cloud,
  FolderKanban,
  LogOut,
  Palette,
  Plus,
  Sparkles,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import type { DiaryEntry } from './types/diary';
import { deleteDay, loadAllDays, saveDay } from './storage/diaryDb';
import {
  deleteCloudDay,
  fetchCloudDays,
  getAuthConfig,
  upsertCloudDay,
  type AppUserProfile,
} from './lib/supabaseClient';
import { ArchiveFeed } from './components/ArchiveFeed';
import { DayFolderView } from './components/DayFolderView';
import { CreateDayView } from './components/CreateDayView';
import { VisualSystemPage } from './components/VisualSystemPage';
import {
  BackdropCanvas,
  type WorldThemeId,
} from './components/BackdropCanvas';
import { AuthModal } from './components/AuthModal';
import { ClerkBridge } from './components/ClerkBridge';
import { WelcomeLanding } from './components/WelcomeLanding';
import './App.css';

type TabView = 'archive' | 'create' | 'system' | 'folder';

const WORLD_LIST: Array<{ id: WorldThemeId; label: string }> = [
  { id: 'indigo', label: 'Velvet Indigo' },
  { id: 'turrell', label: 'Turrell Dawn' },
];

const SESSION_USER_KEY = 'yourdiary_active_session_user';

export function App() {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState<TabView>('archive');
  const [selectedEntry, setSelectedEntry] = useState<DiaryEntry | null>(null);
  const [editingEntry, setEditingEntry] = useState<DiaryEntry | null>(null);
  const [hoveredEntry, setHoveredEntry] = useState<DiaryEntry | null>(null);
  const [autoImmersive, setAutoImmersive] = useState(false);
  const [autoReel, setAutoReel] = useState(false);
  const [world, setWorld] = useState<WorldThemeId>('indigo');

  const [authCfg, setAuthCfg] = useState(() => getAuthConfig());
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [activeUser, setActiveUser] = useState<AppUserProfile | null>(null);
  const [cloudSynced, setCloudSynced] = useState(false);

  const currentUserId = activeUser?.id ?? null;

  // Загружаем только личные дневники вошедшего пользователя
  useEffect(() => {
    if (!currentUserId) return;
    let cancelled = false;
    loadAllDays(currentUserId).then((days) => {
      if (!cancelled) {
        setEntries(days);
        setIsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  // Облачная синхронизация записей с Supabase для текущего аккаунта
  useEffect(() => {
    if (!activeUser || !authCfg.hasSupabase) return;
    let cancelled = false;

    const syncWithCloud = async () => {
      const cloudEntries = await fetchCloudDays(activeUser.id);
      if (cancelled || !cloudEntries) return;

      if (cloudEntries.length > 0) {
        const mergedMap = new Map<string, DiaryEntry>();
        for (const ce of cloudEntries) {
          mergedMap.set(ce.id, ce);
          await saveDay(ce, activeUser.id);
        }
        setEntries((prev) => {
          for (const localItem of prev) {
            if (!mergedMap.has(localItem.id)) {
              mergedMap.set(localItem.id, localItem);
              upsertCloudDay(activeUser.id, localItem).catch(() => {});
            }
          }
          return Array.from(mergedMap.values()).sort(
            (a, b) => b.indexNumber - a.indexNumber
          );
        });
      }
      if (!cancelled) setCloudSynced(true);
    };

    syncWithCloud();
    return () => {
      cancelled = true;
    };
  }, [activeUser, authCfg.hasSupabase]);

  const handleUserAuthenticated = useCallback((user: AppUserProfile | null) => {
    setActiveUser((prev) => {
      if (prev?.id !== user?.id) {
        setSelectedEntry(null);
        setEditingEntry(null);
        setView('archive');
      }
      return user;
    });
    if (user) {
      localStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(SESSION_USER_KEY);
      setEntries([]);
      setCloudSynced(false);
    }
  }, []);

  const handleCreated = async (entry: DiaryEntry) => {
    if (!currentUserId) return;
    await saveDay(entry, currentUserId);
    if (activeUser && authCfg.hasSupabase) {
      upsertCloudDay(activeUser.id, entry).catch(() => {});
    }
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
    if (!currentUserId) return;
    await deleteDay(id, currentUserId);
    if (activeUser && authCfg.hasSupabase) {
      deleteCloudDay(activeUser.id, id).catch(() => {});
    }
    setEntries((prev) => prev.filter((e) => e.id !== id));
    setSelectedEntry(null);
    setView('archive');
  };

  const nextIndex =
    entries.length > 0
      ? Math.max(...entries.map((e) => e.indexNumber)) + 1
      : 1;

  const selectedIdx = selectedEntry
    ? entries.findIndex((e) => e.id === selectedEntry.id)
    : -1;

  const activeAuraEntry = selectedEntry ?? hoveredEntry;
  const auraColors = activeAuraEntry
    ? [
        activeAuraEntry.analysis.palette.accent,
        activeAuraEntry.analysis.palette.secondary,
        activeAuraEntry.photos[0]?.dominantColors[0] ?? '#38bdf8',
        activeAuraEntry.photos[0]?.dominantColors[2] ?? '#a855f7',
      ]
    : ['#f59e0b', '#38bdf8', '#10b981', '#ec4899'];

  const isDarkWorld = world === 'indigo';

  // Динамическое оформление Clerk под текущую тему сайта (Velvet Indigo или Turrell Dawn)
  const clerkAppearance = useMemo(
    () => ({
      variables: isDarkWorld
        ? {
            colorPrimary: '#f59e0b',
            colorBackground: '#1b173d',
            colorText: '#fdfcff',
            colorTextSecondary: '#c9c6e0',
            colorInputBackground: '#120f2c',
            colorInputText: '#fdfcff',
            colorNeutral: '#fdfcff',
            borderRadius: '14px',
            fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
          }
        : {
            colorPrimary: '#e11d48',
            colorBackground: '#fff9f3',
            colorText: '#17161c',
            colorTextSecondary: '#484654',
            colorInputBackground: '#ffffff',
            colorInputText: '#17161c',
            colorNeutral: '#17161c',
            borderRadius: '14px',
            fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
          },
      elements: {
        card: isDarkWorld
          ? 'yourdiary-clerk-card-dark'
          : 'yourdiary-clerk-card-light',
        headerTitle: 'font-serif',
      },
    }),
    [isDarkWorld]
  );

  const content = (
    <div
      className={`app-shell ${
        isDarkWorld ? 'theme-prism' : 'theme-editorial'
      } world-${world}`}
      style={
        {
          '--aura-1': auraColors[0],
          '--aura-2': auraColors[1],
          '--aura-3': auraColors[2],
          '--aura-4': auraColors[3],
        } as React.CSSProperties
      }
    >
      <BackdropCanvas world={world} activeColors={auraColors} />
      <div className="aurora-grid-overlay" aria-hidden="true" />

      <header className="topbar">
        <div
          className="brand"
          onClick={() => {
            setSelectedEntry(null);
            setView('archive');
          }}
        >
          <span className="brand-dot animate-pulse-dot" />
          <span className="brand-name font-mono">YourDiary</span>
          <span className="brand-sub font-mono">// PERSONAL MEMORY VAULT</span>
        </div>

        <nav className="topnav">
          {activeUser ? (
            <>
              <button
                className={`nav-btn ${
                  view === 'archive' || view === 'folder' ? 'active' : ''
                }`}
                onClick={() => {
                  setSelectedEntry(null);
                  setView('archive');
                }}
              >
                <FolderKanban size={15} />
                Мой дневник ({entries.length})
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
            </>
          ) : (
            <button
              className={`nav-btn ${view === 'archive' ? 'active' : ''}`}
              onClick={() => setView('archive')}
            >
              <Sparkles size={15} />О проекте YourDiary
            </button>
          )}

          <button
            className={`nav-btn ${view === 'system' ? 'active' : ''}`}
            onClick={() => setView('system')}
          >
            <BookOpen size={15} />
            Визуальная система
          </button>
        </nav>

        <div className="topbar-right-cluster">
          <button
            type="button"
            className="theme-switch-btn font-mono"
            onClick={() => {
              const idx = WORLD_LIST.findIndex((w) => w.id === world);
              const next = WORLD_LIST[(idx + 1) % WORLD_LIST.length];
              setWorld(next.id);
            }}
            title="Переключить тему сайта и окна Clerk"
          >
            <Palette size={14} />
            <span>
              {WORLD_LIST.find((w) => w.id === world)?.label ?? 'Velvet Indigo'}
            </span>
          </button>

          {authCfg.hasClerk ? (
            <ClerkBridge
              hasSupabase={authCfg.hasSupabase}
              onUserChange={handleUserAuthenticated}
            />
          ) : activeUser ? (
            <div className="user-pill-box">
              <span className="user-badge font-mono">
                <UserCheck size={13} />
                {activeUser.fullName}
              </span>
              {authCfg.hasSupabase && (
                <span
                  className="cloud-sync-dot font-mono"
                  title={
                    cloudSynced
                      ? 'Синхронизировано с Supabase'
                      : 'Подключено к Supabase'
                  }
                >
                  <Cloud size={12} />
                </span>
              )}
              <button
                type="button"
                className="btn-ghost btn-icon-only"
                onClick={() => handleUserAuthenticated(null)}
                title="Выйти из аккаунта"
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn-primary btn-auth-compact"
              onClick={() => setShowAuthModal(true)}
            >
              <UserPlus size={14} />
              Регистрация / Вход
            </button>
          )}
        </div>
      </header>

      <main className="main-container">
        {view === 'system' ? (
          <VisualSystemPage sampleEntry={entries[0]} />
        ) : !activeUser ? (
          <WelcomeLanding onOpenSystem={() => setView('system')} />
        ) : isLoading ? (
          <div className="loading-state font-mono">
            Загрузка вашего личного дневника...
          </div>
        ) : view === 'folder' && selectedEntry ? (
          <DayFolderView
            key={selectedEntry.id}
            entry={selectedEntry}
            hasPrev={selectedIdx > 0}
            hasNext={selectedIdx >= 0 && selectedIdx < entries.length - 1}
            initialImmersive={autoImmersive}
            initialAutoReel={autoReel}
            onPrev={() => {
              if (selectedIdx > 0) {
                setAutoImmersive(false);
                setAutoReel(false);
                setSelectedEntry(entries[selectedIdx - 1]);
              }
            }}
            onNext={() => {
              if (selectedIdx >= 0 && selectedIdx < entries.length - 1) {
                setAutoImmersive(false);
                setAutoReel(false);
                setSelectedEntry(entries[selectedIdx + 1]);
              }
            }}
            onNextReel={() => {
              if (entries.length === 0) return;
              const nextI =
                selectedIdx >= 0 && selectedIdx < entries.length - 1
                  ? selectedIdx + 1
                  : 0;
              setAutoImmersive(true);
              setAutoReel(true);
              setSelectedEntry(entries[nextI]);
            }}
            onBack={() => {
              setAutoImmersive(false);
              setAutoReel(false);
              setSelectedEntry(null);
              setView('archive');
            }}
            onEdit={(entry) => {
              setAutoImmersive(false);
              setAutoReel(false);
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
        ) : (
          <ArchiveFeed
            entries={entries}
            onSelect={(entry) => {
              setAutoImmersive(false);
              setAutoReel(false);
              setSelectedEntry(entry);
              setView('folder');
            }}
            onOpenRandomCapsule={() => {
              if (entries.length === 0) return;
              const randomEntry =
                entries[Math.floor(Math.random() * entries.length)];
              setAutoImmersive(true);
              setAutoReel(false);
              setSelectedEntry(randomEntry);
              setView('folder');
            }}
            onStartReel={() => {
              if (entries.length === 0) return;
              setAutoImmersive(true);
              setAutoReel(true);
              setSelectedEntry(entries[0]);
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
        <span>YOURDIARY // GENESIS ARTTECH // MAKE THE INVISIBLE VISIBLE_</span>
        <span>
          {activeUser
            ? `DIARY OWNER: ${activeUser.fullName.toUpperCase()}`
            : '4:5 PERSONAL VISUAL SYSTEM'}
        </span>
      </footer>

      {showAuthModal && (
        <AuthModal
          onSuccess={(user) => {
            handleUserAuthenticated(user);
            setShowAuthModal(false);
          }}
          onConfigSaved={() => {
            setAuthCfg(getAuthConfig());
            setShowAuthModal(false);
          }}
          onClose={() => setShowAuthModal(false)}
        />
      )}
    </div>
  );

  if (authCfg.hasClerk) {
    return (
      <ClerkProvider
        publishableKey={authCfg.clerkKey}
        appearance={clerkAppearance}
      >
        {content}
      </ClerkProvider>
    );
  }

  return content;
}

export default App;
