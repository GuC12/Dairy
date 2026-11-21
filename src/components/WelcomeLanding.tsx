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

interface WelcomeLandingProps {
  onOpenAuth: (mode: 'signin' | 'signup') => void;
  onOpenSystem: () => void;
}

const PREVIEW_MODES: Array<{
  id: ArtMovementId;
  label: string;
  folder: string;
  text: string;
  bpm: number;
  tonality: 'major' | 'minor';
  energy: number;
  artist: string;
  title: string;
  colors: string[];
}> = [
  {
    id: 'impressionism',
    label: 'Моне · Свет',
    folder: 'Золотой час и тёплый разговор',
    text: 'Гуляли по парку в золотых листьях, пили горячее какао и долго разговаривали.',
    bpm: 78,
    tonality: 'major',
    energy: 0.36,
    artist: 'Frank Sinatra',
    title: 'Autumn in New York',
    colors: ['#f59e0b', '#d97706', '#fbbf24', '#78350f'],
  },
  {
    id: 'constructivism',
    label: 'Кандинский · Ритм',
    folder: 'Ночной фокус и ритм города',
    text: 'Срочная сдача проекта, ночь в офисе, в наушниках плотная электронная музыка.',
    bpm: 130,
    tonality: 'minor',
    energy: 0.86,
    artist: 'Moderat',
    title: 'A New Error',
    colors: ['#38bdf8', '#ff4757', '#1e293b', '#a855f7'],
  },
  {
    id: 'wabi-sabi',
    label: 'Ваби-саби · Тишина',
    folder: 'Большое небо и утренний туман',
    text: 'Раннее утро в тумане у воды, тишина и медленное спокойное дыхание дня.',
    bpm: 66,
    tonality: 'minor',
    energy: 0.24,
    artist: 'Brian Eno',
    title: 'An Ending (Ascent)',
    colors: ['#34d399', '#0d9488', '#99f6e4', '#134e4a'],
  },
  {
    id: 'film-35mm',
    label: 'Плёнка 35mm · Хроника',
    folder: 'Вечерний трамвай и огни витрин',
    text: 'Ехали вечером через весь город под дождём, огни витрин расплывались на стекле.',
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
    const analysis = analyzeLocally(m.text, [fakePhoto], music);
    return {
      id: 'welcome_demo',
      indexNumber: modeIdx + 1,
      createdAt: '2026-11-21T00:00:00.000Z',
      dateLabel: 'Ваш день',
      weather: 'Живой холст 4:5',
      location: 'YourDiary',
      text: m.text,
      signature: 'Проведите курсором по картине →',
      photos: [],
      music,
      analysis: {
        ...analysis,
        folderName: m.folder,
      },
    };
  }, [modeIdx]);

  return (
    <div className="welcome-landing view-enter">
      <div className="welcome-grid">
        <div className="welcome-left">
          <div className="genesis-exe-bar font-mono">
            <span className="exe-title">[ yourdiary.exe // personal_vault ]</span>
            <div className="exe-squares">
              <span style={{ background: '#f59e0b' }} />
              <span style={{ background: '#38bdf8' }} />
              <span style={{ background: '#34d399' }} />
              <span style={{ background: '#ec4899' }} />
            </div>
          </div>

          <h1 className="font-serif welcome-title">
            YourDiary — превратите ваш день в{' '}
            <span className="hero-gradient-word">живое воспоминание</span>
          </h1>

          <p className="welcome-lead">
            Фотографии в галерее хранят то, как выглядел день, но не то, как он
            ощущался. <strong>YourDiary</strong> соединяет ваш рассказ, снимки и
            песню дня в интерактивную картину <strong>4:5</strong> и сохраняет
            её в вашем личном зашифрованном дневнике.
          </p>

          <div className="welcome-steps">
            <div className="welcome-step-card">
              <div className="step-icon-box">
                <Sparkles size={18} />
              </div>
              <div>
                <h3>01 // Текст и фотографии дня</h3>
                <p>
                  Расскажите, как прошёл день (текстом или голосом), и
                  приложите фотографии — система извлечёт их палитру и свет.
                </p>
              </div>
            </div>

            <div className="welcome-step-card">
              <div className="step-icon-box">
                <Music size={18} />
              </div>
              <div>
                <h3>02 // Песня и художественный стиль</h3>
                <p>
                  Музыка управляет ритмом анимации, мазками Моне, геометрией
                  Кандинского, воздухом Ваби-саби или зерном 35mm плёнки.
                </p>
              </div>
            </div>

            <div className="welcome-step-card">
              <div className="step-icon-box">
                <FolderLock size={18} />
              </div>
              <div>
                <h3>03 // Личный архив каждого аккаунта</h3>
                <p>
                  У каждого пользователя свой приватный дневник с синхронизацией
                  через Clerk и Supabase.
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
              Создать свой дневник
            </button>

            <button
              type="button"
              className="btn-secondary btn-large"
              onClick={() => onOpenAuth('signin')}
            >
              <LogIn size={18} />
              Войти в аккаунт
            </button>

            <button
              type="button"
              className="btn-ghost"
              onClick={onOpenSystem}
            >
              <BookOpen size={16} />
              Как работает визуальная система
            </button>
          </div>
        </div>

        {/* Правая колонка: интерактивная демонстрация холста 4:5 */}
        <div className="welcome-right">
          <div className="welcome-showcase-card">
            <div className="showcase-top-bar font-mono">
              <span>ИНТЕРАКТИВНЫЙ ПРЕДПРОСМОТР // 4:5</span>
              <span className="showcase-hint">
                <Disc3 size={13} className="spin-slow" /> Наведите курсор
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
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
