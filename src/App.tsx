import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ClerkProvider } from '@clerk/react';
import { enUS, ruRU } from '@clerk/localizations';
import {
  BookOpen,
  Cloud,
  FolderKanban,
  Globe,
  LogIn,
  LogOut,
  Palette,
  Plus,
  Sparkles,
  User,
  UserPlus,
} from 'lucide-react';
import { useLanguage } from './i18n/useLanguage';
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
import { ProfileModal } from './components/ProfileModal';
import { WelcomeLanding } from './components/WelcomeLanding';
import { ErrorBoundary } from './components/ErrorBoundary';
import './App.css';

type TabView = 'archive' | 'create' | 'system' | 'folder';

const WORLD_LIST: Array<{ id: WorldThemeId; ru: string; en: string }> = [
  { id: 'indigo', ru: 'Бархатный Индиго', en: 'Velvet Indigo' },
  { id: 'turrell', ru: 'Рассвет Таррелла', en: 'Turrell Dawn' },
];

const SESSION_USER_KEY = 'yourdiary_active_session_user';

export function App() {
  const { lang, toggleLang, t } = useLanguage();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState<TabView>('archive');
  const [selectedEntry, setSelectedEntry] = useState<DiaryEntry | null>(null);
  const [editingEntry, setEditingEntry] = useState<DiaryEntry | null>(null);
  const [hoveredEntry, setHoveredEntry] = useState<DiaryEntry | null>(null);
  const [autoImmersive, setAutoImmersive] = useState(false);
  const [autoReel, setAutoReel] = useState(false);
  const [world, setWorld] = useState<WorldThemeId>('indigo');

  const [authCfg] = useState(() => getAuthConfig());
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup'>('signup');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [activeUser, setActiveUser] = useState<AppUserProfile | null>(() => {
    try {
      const saved = localStorage.getItem(SESSION_USER_KEY);
      return saved ? (JSON.parse(saved) as AppUserProfile) : null;
    } catch {
      return null;
    }
  });
  const [cloudSynced, setCloudSynced] = useState(false);
  const clerkSignOutRef = useRef<(() => Promise<void>) | null>(null);

  const geminiApiKey = useMemo(() => {
    try {
      return (
        (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim() ||
        localStorage.getItem('atmos_gemini_api_key')?.trim() ||
        undefined
      );
    } catch {
      return undefined;
    }
  }, []);

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

  const handleLogout = useCallback(async () => {
    setShowProfileModal(false);
    if (clerkSignOutRef.current) {
      await clerkSignOutRef.current();
    }
    handleUserAuthenticated(null);
  }, [handleUserAuthenticated]);

  const registerClerkSignOut = useCallback((fn: () => Promise<void>) => {
    clerkSignOutRef.current = fn;
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
          <span className="brand-sub font-mono">
            {t('// ЛИЧНЫЙ АРХИВ ВОСПОМИНАНИЙ', '// PERSONAL MEMORY VAULT')}
          </span>
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
                {t('Мой дневник', 'My Diary')} ({entries.length})
              </button>

              <button
                className={`nav-btn ${view === 'create' ? 'active' : ''}`}
                onClick={() => {
                  setEditingEntry(null);
                  setView('create');
                }}
              >
                <Plus size={15} />
                {t('Новый день', 'New Day')}
              </button>
            </>
          ) : (
            <button
              className={`nav-btn ${view === 'archive' ? 'active' : ''}`}
              onClick={() => setView('archive')}
            >
              <Sparkles size={15} />
              {t('О проекте YourDiary', 'About YourDiary')}
            </button>
          )}

          <button
            className={`nav-btn ${view === 'system' ? 'active' : ''}`}
            onClick={() => setView('system')}
          >
            <BookOpen size={15} />
            {t('Визуальная система', 'Visual System')}
          </button>
        </nav>

        <div className="topbar-right-cluster">
          <button
            type="button"
            className="theme-switch-btn font-mono"
            onClick={toggleLang}
            title={t(
              'Переключить язык сайта (Русский / English)',
              'Switch website language (Russian / English)'
            )}
          >
            <Globe size={14} />
            <span>{lang === 'ru' ? 'RU / EN' : 'EN / RU'}</span>
          </button>

          <button
            type="button"
            className="theme-switch-btn font-mono"
            onClick={() => {
              const idx = WORLD_LIST.findIndex((w) => w.id === world);
              const next = WORLD_LIST[(idx + 1) % WORLD_LIST.length];
              setWorld(next.id);
            }}
            title={t('Переключить тему оформления сайта', 'Switch website theme')}
          >
            <Palette size={14} />
            <span>
              {t(
                WORLD_LIST.find((w) => w.id === world)?.ru ?? 'Бархатный Индиго',
                WORLD_LIST.find((w) => w.id === world)?.en ?? 'Velvet Indigo'
              )}
            </span>
          </button>

          {activeUser ? (
            <div className="user-pill-box">
              <button
                type="button"
                className="btn-ghost btn-auth-compact"
                onClick={() => setShowProfileModal(true)}
                title={t(
                  'Открыть профиль и статистику дневника',
                  'Open profile and diary stats'
                )}
              >
                <User size={14} />
                <span>{activeUser.fullName}</span>
              </button>

              {authCfg.hasSupabase && (
                <span
                  className="cloud-sync-dot font-mono"
                  title={
                    cloudSynced
                      ? t('Синхронизировано с Supabase', 'Synced with Supabase')
                      : t('Подключено к Supabase', 'Connected to Supabase')
                  }
                >
                  <Cloud size={12} />
                </span>
              )}

              <button
                type="button"
                className="btn-ghost btn-auth-compact"
                onClick={handleLogout}
                title={t('Выйти из аккаунта', 'Sign Out')}
              >
                <LogOut size={14} />
                <span>{t('Выйти', 'Sign Out')}</span>
              </button>
            </div>
          ) : (
            <div className="clerk-auth-buttons">
              <button
                type="button"
                className="btn-ghost btn-auth-compact"
                onClick={() => {
                  setAuthModalMode('signin');
                  setShowAuthModal(true);
                }}
              >
                <LogIn size={14} />
                {t('Вход', 'Sign In')}
              </button>
              <button
                type="button"
                className="btn-primary btn-auth-compact"
                onClick={() => {
                  setAuthModalMode('signup');
                  setShowAuthModal(true);
                }}
              >
                <UserPlus size={14} />
                {t('Регистрация', 'Sign Up')}
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="main-container">
        {view === 'system' ? (
          <VisualSystemPage sampleEntry={entries[0]} />
        ) : !activeUser ? (
          <WelcomeLanding
            onOpenSystem={() => setView('system')}
            onOpenAuth={(mode) => {
              setAuthModalMode(mode);
              setShowAuthModal(true);
            }}
          />
        ) : isLoading ? (
          <div className="loading-state font-mono">
            {t(
              'Загрузка вашего личного дневника...',
              'Loading your personal diary...'
            )}
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
            geminiApiKey={geminiApiKey}
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
        <span>
          {t(
            'YOURDIARY // ИСКУССТВО И ТЕХНОЛОГИИ // СДЕЛАТЬ НЕВИДИМОЕ ВИДИМЫМ',
            'YOURDIARY // GENESIS ARTTECH // MAKE THE INVISIBLE VISIBLE_'
          )}
        </span>
        <span>
          {activeUser
            ? t(
                `ВЛАДЕЛЕЦ ДНЕВНИКА: @${activeUser.fullName.toUpperCase()}`,
                `DIARY OWNER: @${activeUser.fullName.toUpperCase()}`
              )
            : t(
                'ЕДИНАЯ ВИЗУАЛЬНАЯ СИСТЕМА 4:5',
                '4:5 PERSONAL VISUAL SYSTEM'
              )}
        </span>
      </footer>

      {showAuthModal && (
        <AuthModal
          initialMode={authModalMode}
          onClose={() => setShowAuthModal(false)}
        />
      )}

      {showProfileModal && activeUser && (
        <ProfileModal
          user={activeUser}
          entries={entries}
          cloudSynced={cloudSynced}
          onLogout={handleLogout}
          onClose={() => setShowProfileModal(false)}
        />
      )}
    </div>
  );

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
        rootBox: 'yourdiary-clerk-root',
        cardBox: 'yourdiary-clerk-cardbox',
        card: isDarkWorld
          ? 'yourdiary-clerk-card-dark'
          : 'yourdiary-clerk-card-light',
        headerTitle: 'font-serif',
      },
    }),
    [isDarkWorld]
  );

  if (authCfg.hasClerk) {
    return (
      <ErrorBoundary fallbackTitle="YourDiary // Автономный режим">
        <ClerkProvider
          publishableKey={authCfg.clerkKey}
          localization={lang === 'ru' ? ruRU : enUS}
          appearance={clerkAppearance}
        >
          <ClerkBridge
            onUserChange={handleUserAuthenticated}
            onRegisterSignOut={registerClerkSignOut}
          />
          {content}
        </ClerkProvider>
      </ErrorBoundary>
    );
  }

  return content;
}

export default App;
