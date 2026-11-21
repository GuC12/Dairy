import React from 'react';
import {
  Calendar,
  Cloud,
  Download,
  FolderKanban,
  Image as ImageIcon,
  LogOut,
  Music,
  Palette,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import type { DiaryEntry } from '../types/diary';
import type { AppUserProfile } from '../lib/supabaseClient';
import { useLanguage } from '../i18n/LanguageContext';

interface ProfileModalProps {
  user: AppUserProfile;
  entries: DiaryEntry[];
  cloudSynced: boolean;
  onLogout: () => void;
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  user,
  entries,
  cloudSynced,
  onLogout,
  onClose,
}) => {
  const { t } = useLanguage();
  const totalPhotos = entries.reduce((s, e) => s + e.photos.length, 0);
  const avgBpm =
    entries.length > 0
      ? Math.round(
          entries.reduce((s, e) => s + e.music.bpm, 0) / entries.length
        )
      : 0;

  const dominantStyle = (() => {
    if (entries.length === 0)
      return t('Ещё не определён', 'Not determined yet');
    const counts = new Map<string, number>();
    for (const e of entries) {
      const title = e.analysis.movementTitle;
      counts.set(title, (counts.get(title) ?? 0) + 1);
    }
    return (
      Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ??
      t('Импрессионизм', 'Impressionism')
    );
  })();

  const personalColors = Array.from(
    new Set(
      entries.flatMap((e) => [
        ...(e.photos[0]?.dominantColors ?? []),
        e.analysis.palette.accent,
      ])
    )
  ).slice(0, 8);

  const handleBackup = () => {
    const blob = new Blob([JSON.stringify(entries, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `YourDiary_${user.fullName}_${entries.length}_days.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <div
        className="lightbox-box profile-modal-box"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="lightbox-head font-mono">
          <span className="tapestry-head-title">
            <User size={16} />{' '}
            {t('ПРОФИЛЬ АВТОРА // YOURDIARY', 'AUTHOR PROFILE // YOURDIARY')}
          </span>
          <button type="button" className="btn-ghost" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="profile-hero-card">
          <div
            className="profile-avatar-circle font-serif"
            style={{
              background:
                personalColors.length >= 2
                  ? `linear-gradient(135deg, ${personalColors[0]}, ${personalColors[1]})`
                  : 'linear-gradient(135deg, #f59e0b, #ec4899)',
            }}
          >
            {user.fullName.slice(0, 1).toUpperCase()}
          </div>

          <div className="profile-hero-info">
            <div className="profile-username font-serif">@{user.fullName}</div>
            {user.email && user.email.includes('@') && (
              <div className="profile-meta-line font-mono">
                <span>
                  {t('Почта', 'Email')}: {user.email}
                </span>
              </div>
            )}
            <div className="profile-meta-line font-mono">
              <span>ID: {user.id}</span>
              <span>·</span>
              <span className="profile-cloud-tag">
                <Cloud size={12} />
                {cloudSynced
                  ? t('Облако синхронизировано', 'Cloud Synced')
                  : t('Локальный + Облако', 'Local + Cloud')}
              </span>
            </div>
          </div>
        </div>

        <div className="profile-stats-grid">
          <div className="profile-stat-box">
            <div className="profile-stat-label font-mono">
              <FolderKanban size={13} /> {t('ПАПОК ДНЕЙ', 'DAY FOLDERS')}
            </div>
            <div className="profile-stat-val font-serif">{entries.length}</div>
          </div>

          <div className="profile-stat-box">
            <div className="profile-stat-label font-mono">
              <ImageIcon size={13} /> {t('ФОТОГРАФИЙ', 'PHOTOS')}
            </div>
            <div className="profile-stat-val font-serif">{totalPhotos}</div>
          </div>

          <div className="profile-stat-box">
            <div className="profile-stat-label font-mono">
              <Music size={13} /> {t('СРЕДНИЙ РИТМ', 'AVG RHYTHM')}
            </div>
            <div className="profile-stat-val font-serif">
              {avgBpm > 0 ? `${avgBpm} BPM` : '—'}
            </div>
          </div>

          <div className="profile-stat-box">
            <div className="profile-stat-label font-mono">
              <Calendar size={13} /> {t('ПОСЛЕДНЯЯ ЗАПИСЬ', 'LATEST ENTRY')}
            </div>
            <div className="profile-stat-val-sm font-mono">
              {entries[0]?.dateLabel ?? t('Нет записей', 'No entries')}
            </div>
          </div>
        </div>

        <div className="profile-style-card">
          <div className="mini-label font-mono">
            <Sparkles size={12} />{' '}
            {t(
              'ПРЕОБЛАДАЮЩИЙ ХУДОЖЕСТВЕННЫЙ ЯЗЫК',
              'DOMINANT ARTISTIC MOVEMENT'
            )}
          </div>
          <div className="profile-style-name">{dominantStyle}</div>

          {personalColors.length > 0 && (
            <>
              <div className="mini-label font-mono" style={{ marginTop: 12 }}>
                <Palette size={12} />{' '}
                {t(
                  'ЛИЧНАЯ ЦВЕТОВАЯ ПАЛИТРА ДНЕВНИКА',
                  'PERSONAL DIARY COLOR PALETTE'
                )}
              </div>
              <div className="profile-palette-bar">
                {personalColors.map((hex, i) => (
                  <span
                    key={i}
                    className="profile-color-chip"
                    style={{ backgroundColor: hex }}
                    title={hex}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        <div className="profile-actions-footer">
          {entries.length > 0 && (
            <button
              type="button"
              className="btn-secondary"
              onClick={handleBackup}
            >
              <Download size={15} />
              {t('Скачать архив (.JSON)', 'Download Backup (.JSON)')}
            </button>
          )}

          <button
            type="button"
            className="btn-logout-danger"
            onClick={onLogout}
          >
            <LogOut size={15} />
            {t('Выйти из аккаунта', 'Sign Out')}
          </button>
        </div>
      </div>
    </div>
  );
};
