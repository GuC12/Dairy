import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Disc3,
  FolderLock,
  LogIn,
  Music,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import type { ArtMovementId, DiaryEntry } from '../types/diary';
import { analyzeLocally } from '../engine/atmosphereEngine';
import { MemoryCanvas } from './MemoryCanvas';
import { useLanguage } from '../i18n/LanguageContext';

interface WelcomeLandingProps {
  onOpenAuth: (mode: 'signin' | 'signup') => void;
  onOpenSystem: () => void;
}

const PREVIEW_MODES: Array<{
  id: ArtMovementId;
  labelRu: string;
  labelEn: string;
  folderRu: string;
  folderEn: string;
  textRu: string;
  textEn: string;
  bpm: number;
  tonality: 'major' | 'minor';
  energy: number;
  artist: string;
  title: string;
  colors: string[];
}> = [
  {
    id: 'impressionism',
    labelRu: 'Моне · Свет',
    labelEn: 'Monet · Light',
    folderRu: 'Золотой час и тёплый разговор',
    folderEn: 'Golden Hour & Warm Conversation',
    textRu:
      'Гуляли по парку в золотых листьях, пили горячее какао и долго разговаривали.',
    textEn:
      'Walked through the park in golden autumn leaves, drank hot cocoa and talked for hours.',
    bpm: 78,
    tonality: 'major',
    energy: 0.36,
    artist: 'Frank Sinatra',
    title: 'Autumn in New York',
    colors: ['#f59e0b', '#d97706', '#fbbf24', '#78350f'],
  },
  {
    id: 'constructivism',
    labelRu: 'Кандинский · Ритм',
    labelEn: 'Kandinsky · Rhythm',
    folderRu: 'Ночной фокус и ритм города',
    folderEn: 'Night Focus & City Pulse',
    textRu:
      'Срочная сдача проекта, ночь в офисе, в наушниках плотная электронная музыка.',
    textEn:
      'Urgent project deadline, late night at the office, dense electronic pulse in headphones.',
    bpm: 130,
    tonality: 'minor',
    energy: 0.86,
    artist: 'Moderat',
    title: 'A New Error',
    colors: ['#38bdf8', '#ff4757', '#1e293b', '#a855f7'],
  },
  {
    id: 'wabi-sabi',
    labelRu: 'Ваби-саби · Тишина',
    labelEn: 'Wabi-Sabi · Silence',
    folderRu: 'Большое небо и утренний туман',
    folderEn: 'Big Sky & Morning Fog',
    textRu:
      'Раннее утро в тумане у воды, тишина и медленное спокойное дыхание дня.',
    textEn:
      'Early morning mist by the water, silence and the slow, calm breath of the day.',
    bpm: 66,
    tonality: 'minor',
    energy: 0.24,
    artist: 'Brian Eno',
    title: 'An Ending (Ascent)',
    colors: ['#34d399', '#0d9488', '#99f6e4', '#134e4a'],
  },
  {
    id: 'film-35mm',
    labelRu: 'Плёнка 35мм · Хроника',
    labelEn: '35mm Film · Chronicle',
    folderRu: 'Вечерний трамвай и огни витрин',
    folderEn: 'Evening Tram & Storefront Lights',
    textRu:
      'Ехали вечером через весь город под дождём, огни витрин расплывались на стекле.',
    textEn:
      'Rode across the city in the evening rain as storefront lights blurred on the window.',
    bpm: 104,
    tonality: 'major',
    energy: 0.58,
    artist: 'M83',
    title: 'Midnight City',
    colors: ['#c084fc', '#f59e0b', '#2dd4bf', '#1e1b4b'],
  },
];

export const WelcomeLanding: React.FC<WelcomeLandingProps> = ({
  onOpenAuth,
  onOpenSystem,
}) => {
  const { lang, t } = useLanguage();
  const [modeIdx, setModeIdx] = useState(0);

  const demoEntry: DiaryEntry = useMemo(() => {
    const m = PREVIEW_MODES[modeIdx];
    const music = {
      mode: 'link' as const,
      artist: m.artist,
      title: m.title,
      genre: 'Atmospheric',
      bpm: m.bpm,
      tonality: m.tonality,
      energy: m.energy,
    };
    const fakePhoto = {
      id: 'welcome_ph',
      dataUrl: '',
      name: 'preview.jpg',
      dominantColors: m.colors,
      brightness: 0.55,
      contrast: 0.5,
    };
    const analysis = analyzeLocally(m.textRu, [fakePhoto], music);
    return {
      id: 'welcome_demo',
      indexNumber: modeIdx + 1,
      createdAt: '2026-11-21T00:00:00.000Z',
      dateLabel: lang === 'en' ? 'Your Day' : 'Ваш день',
      weather: lang === 'en' ? 'Live Canvas 4:5' : 'Живой холст 4:5',
      location: 'YourDiary',
      text: lang === 'en' ? m.textEn : m.textRu,
      signature:
        lang === 'en'
          ? 'Move cursor across the painting →'
          : 'Проведите курсором по картине →',
      photos: [],
      music,
      analysis: {
        ...analysis,
        folderName: lang === 'en' ? m.folderEn : m.folderRu,
      },
    };
  }, [modeIdx, lang]);

  return (
    <div className="welcome-landing view-enter">
      <div className="welcome-grid">
        <div className="welcome-left">
          <div className="genesis-exe-bar font-mono">
            <span className="exe-title">
              {t(
                '[ личный_дневник // архив_воспоминаний ]',
                '[ yourdiary.exe // personal_vault ]'
              )}
            </span>
            <div className="exe-squares">
              <span style={{ background: '#f59e0b' }} />
              <span style={{ background: '#38bdf8' }} />
              <span style={{ background: '#34d399' }} />
              <span style={{ background: '#ec4899' }} />
            </div>
          </div>

          <h1 className="font-serif welcome-title">
            {t('YourDiary — превратите ваш день в ', 'YourDiary — turn your day into a ')}{' '}
            <span className="hero-gradient-word">
              {t('живое воспоминание', 'living memory')}
            </span>
          </h1>

          <p className="welcome-lead">
            {t(
              'Фотографии в галерее хранят то, как выглядел день, но не то, как он ощущался. YourDiary соединяет ваш рассказ, снимки и песню дня в интерактивную картину 4:5 и сохраняет её в вашем личном дневнике.',
              'Photos in a gallery capture how a day looked, but not how it felt. YourDiary combines your story, photos, and song of the day into an interactive 4:5 painting stored in your private diary.'
            )}
          </p>

          <div className="welcome-steps">
            <div className="welcome-step-card">
              <div className="step-icon-box">
                <Sparkles size={18} />
              </div>
              <div>
                <h3>
                  {t(
                    '01 // Текст и фотографии дня',
                    '01 // Story & Photos of the Day'
                  )}
                </h3>
                <p>
                  {t(
                    'Расскажите, как прошёл день (текстом или голосом), и приложите фотографии — система извлечёт их палитру и свет.',
                    'Tell how your day went (by text or voice) and attach photos — the system extracts their color palette and light.'
                  )}
                </p>
              </div>
            </div>

            <div className="welcome-step-card">
              <div className="step-icon-box">
                <Music size={18} />
              </div>
              <div>
                <h3>
                  {t(
                    '02 // Песня и художественный стиль',
                    '02 // Song & Artistic Style'
                  )}
                </h3>
                <p>
                  {t(
                    'Музыка управляет ритмом анимации, мазками Моне, геометрией Кандинского, воздухом Ваби-саби или зерном 35мм плёнки.',
                    'Music drives the animation rhythm, Monet brushstrokes, Kandinsky geometry, Wabi-Sabi whitespace, or 35mm film grain.'
                  )}
                </p>
              </div>
            </div>

            <div className="welcome-step-card">
              <div className="step-icon-box">
                <FolderLock size={18} />
              </div>
              <div>
                <h3>
                  {t(
                    '03 // Личный архив каждого аккаунта',
                    '03 // Private Archive for Every Account'
                  )}
                </h3>
                <p>
                  {t(
                    'У каждого пользователя свой приватный дневник с облачной синхронизацией записей.',
                    'Every user gets their own isolated personal diary with cloud synchronization.'
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="welcome-cta-cluster">
            <button
              type="button"
              className="btn-primary btn-large"
              onClick={() => onOpenAuth('signup')}
            >
              <UserPlus size={18} />
              {t('Создать свой дневник', 'Create Your Diary')}
            </button>

            <button
              type="button"
              className="btn-secondary btn-large"
              onClick={() => onOpenAuth('signin')}
            >
              <LogIn size={18} />
              {t('Войти в аккаунт', 'Sign In')}
            </button>

            <button
              type="button"
              className="btn-ghost"
              onClick={onOpenSystem}
            >
              <BookOpen size={16} />
              {t(
                'Как работает визуальная система',
                'How the Visual System Works'
              )}
            </button>
          </div>
        </div>

        {/* Правая колонка: интерактивная демонстрация холста 4:5 */}
        <div className="welcome-right">
          <div className="welcome-showcase-card">
            <div className="showcase-top-bar font-mono">
              <span>
                {t(
                  'ИНТЕРАКТИВНЫЙ ПРЕДПРОСМОТР // 4:5',
                  'INTERACTIVE PREVIEW // 4:5'
                )}
              </span>
              <span className="showcase-hint">
                <Disc3 size={13} className="spin-slow" />{' '}
                {t('Наведите курсор', 'Hover cursor')}
              </span>
            </div>

            <div className="archive-sleeve-stage">
              <div className="vinyl-sleeve-disc is-spinning">
                <div
                  className="vinyl-center-label"
                  style={{
                    background: `radial-gradient(circle, ${demoEntry.analysis.palette.accent}, ${demoEntry.analysis.palette.secondary})`,
                  }}
                />
              </div>
              <div className="archive-canvas-wrap">
                <MemoryCanvas entry={demoEntry} isPlaying />
              </div>
            </div>

            <div className="showcase-mode-pills">
              {PREVIEW_MODES.map((m, idx) => (
                <button
                  key={m.id}
                  type="button"
                  className={`filter-pill ${modeIdx === idx ? 'active' : ''}`}
                  onClick={() => setModeIdx(idx)}
                >
                  <span
                    className="filter-dot"
                    style={{ backgroundColor: m.colors[0] }}
                  />
                  {lang === 'en' ? m.labelEn : m.labelRu}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
