import React from 'react';
import type { DiaryEntry } from '../types/diary';
import { useLanguage } from '../i18n/LanguageContext';

interface AtmosphereCompassProps {
  entries: DiaryEntry[];
  activeId?: string;
  onSelect?: (entry: DiaryEntry) => void;
  compact?: boolean;
}

export const AtmosphereCompass: React.FC<AtmosphereCompassProps> = ({
  entries,
  activeId,
  onSelect,
  compact = false,
}) => {
  const { t } = useLanguage();

  return (
    <div className={`compass-card ${compact ? 'compass-compact' : ''}`}>
      <div className="compass-head font-mono">
        <span>
          {t(
            'КОМПАС АТМОСФЕРЫ // НАСТРОЕНИЕ × ЭНЕРГИЯ',
            'ATMOSPHERE COMPASS // VALENCE × ENERGY'
          )}
        </span>
      </div>

      <div className="compass-plane">
        <div className="compass-axis-x" />
        <div className="compass-axis-y" />

        <span className="compass-quadrant q-tl font-mono">
          {t('Кандинский · Фокус', 'Kandinsky · Focus')}
        </span>
        <span className="compass-quadrant q-tr font-mono">
          {t('Плёнка 35мм · Драйв', '35mm Film · Drive')}
        </span>
        <span className="compass-quadrant q-bl font-mono">
          {t('Ваби-саби · Тишина', 'Wabi-Sabi · Silence')}
        </span>
        <span className="compass-quadrant q-br font-mono">
          {t('Моне · Тепло', 'Monet · Warmth')}
        </span>

        {entries.map((entry) => {
          const leftPct = 50 + entry.analysis.valence * 40;
          const topPct = 88 - entry.analysis.arousal * 76;
          const isActive = entry.id === activeId;

          return (
            <button
              key={entry.id}
              type="button"
              className={`compass-dot ${isActive ? 'is-active' : ''}`}
              style={{
                left: `${leftPct}%`,
                top: `${topPct}%`,
                backgroundColor: entry.analysis.palette.accent,
              }}
              title={`${entry.analysis.folderName} (${entry.analysis.movementTitle})`}
              onClick={() => onSelect?.(entry)}
            >
              <span className="compass-dot-label font-mono">
                {String(entry.indexNumber).padStart(2, '0')}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
