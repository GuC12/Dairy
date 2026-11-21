import React from 'react';
import type { DiaryEntry } from '../types/diary';

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
  return (
    <div className={`compass-card ${compact ? 'compass-compact' : ''}`}>
      <div className="compass-head font-mono">
        <span>КОМПАС АТМОСФЕРЫ // VALENCE × ENERGY</span>
      </div>

      <div className="compass-plane">
        {/* Квадранты */}
        <div className="compass-axis-x" />
        <div className="compass-axis-y" />

        <span className="compass-quadrant q-tl font-mono">
          Кандинский · Фокус
        </span>
        <span className="compass-quadrant q-tr font-mono">
          Плёнка 35mm · Драйв
        </span>
        <span className="compass-quadrant q-bl font-mono">
          Ваби-саби · Тишина
        </span>
        <span className="compass-quadrant q-br font-mono">
          Моне · Тепло
        </span>

        {entries.map((entry) => {
          // valence: -1..1 -> 8%..92%
          const leftPct = 50 + entry.analysis.valence * 40;
          // arousal: 0..1 -> bottom 10%..90% (top = 90%..10%)
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
