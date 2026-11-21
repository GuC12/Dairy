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
  const totalPhotos = entries.reduce((s, e) => s + e.photos.length, 0);
  const avgBpm =
    entries.length > 0
      ? Math.round(
          entries.reduce((s, e) => s + e.music.bpm, 0) / entries.length
        )
      : 0;

  // Определяем преобладающий художественный стиль автора
  const dominantStyle = (() => {
    if (entries.length === 0) return 'Ещё не определён';
    const counts = new Map<string, number>();
    for (const e of entries) {
      const title = e.analysis.movementTitle;
      counts.set(title, (counts.get(title) ?? 0) + 1);
    }
    return (
      Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ??
      'Импрессионизм'
    );
  })();

  // Собираем до 8 характерных цветов из дневника пользователя
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
            <User size={16} /> ПРОФИЛЬ АВТОРА // YOURDIARY
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
                <span>Почта: {user.email}</span>
              </div>
            )}
            <div className="profile-meta-line font-mono">
              <span>ID: {user.id}</span>
              <span>·</span>
              <span className="profile-cloud-tag">
                <Cloud size={12} />
                {cloudSynced ? 'Облако синхронизировано' : 'Локальный + Облако'}
              </span>
            </div>
          </div>
        </div>

        {/* Статистика личного дневника */}
        <div className="profile-stats-grid">
          <div className="profile-stat-box">
            <div className="profile-stat-label font-mono">
              <FolderKanban size={13} /> ПАПОК ДНЕЙ
            </div>
            <div className="profile-stat-val font-serif">{entries.length}</div>
          </div>

          <div className="profile-stat-box">
            <div className="profile-stat-label font-mono">
              <ImageIcon size={13} /> ФОТОГРАФИЙ
            </div>
            <div className="profile-stat-val font-serif">{totalPhotos}</div>
          </div>

          <div className="profile-stat-box">
            <div className="profile-stat-label font-mono">
              <Music size={13} /> СРЕДНИЙ РИТМ
            </div>
            <div className="profile-stat-val font-serif">
              {avgBpm > 0 ? `${avgBpm} BPM` : '—'}
            </div>
          </div>

          <div className="profile-stat-box">
            <div className="profile-stat-label font-mono">
              <Calendar size={13} /> ПОСЛЕДНЯЯ ЗАПИСЬ
            </div>
            <div className="profile-stat-val-sm font-mono">
              {entries[0]?.dateLabel ?? 'Нет записей'}
            </div>
          </div>
        </div>

        <div className="profile-style-card">
          <div className="mini-label font-mono">
            <Sparkles size={12} /> ПРЕОБЛАДАЮЩИЙ ХУДОЖЕСТВЕННЫЙ ЯЗЫК
          </div>
          <div className="profile-style-name">{dominantStyle}</div>

          {personalColors.length > 0 && (
            <>
              <div className="mini-label font-mono" style={{ marginTop: 12 }}>
                <Palette size={12} /> ЛИЧНАЯ ЦВЕТОВАЯ ПАЛИТРА ДНЕВНИКА
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
              Скачать архив (.json)
            </button>
          )}

          <button
            type="button"
            className="btn-primary btn-logout-danger"
            onClick={() => {
              onLogout();
              onClose();
            }}
          >
            <LogOut size={15} />
            Выйти из аккаунта
          </button>
        </div>
      </div>
    </div>
  );
};
