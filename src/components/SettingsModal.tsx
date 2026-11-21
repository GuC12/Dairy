import React, { useState } from 'react';
import { KeyRound, RotateCcw, X } from 'lucide-react';

interface SettingsModalProps {
  apiKey: string;
  onSaveKey: (key: string) => void;
  onResetDemo: () => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  apiKey,
  onSaveKey,
  onResetDemo,
  onClose,
}) => {
  const [draft, setDraft] = useState(apiKey);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="font-mono modal-title">
            <KeyRound size={16} /> НАСТРОЙКИ ДВИЖКА
          </div>
          <button className="btn-ghost" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <p className="modal-desc">
          Базовый движок атмосферы работает <strong>полностью автономно в браузере</strong> без ключей.
          По желанию можно указать ключ <strong>Gemini API</strong> (модель{' '}
          <code>gemini-2.5-flash</code>) — она усилит смысловой анализ текста и
          названия папок. Ключ хранится только в вашем <code>localStorage</code>.
        </p>

        <label className="mini-label font-mono">Gemini API Key (опционально)</label>
        <input
          type="password"
          className="input-field"
          placeholder="AIza..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />

        <div className="modal-actions">
          <button
            className="btn-secondary"
            onClick={() => {
              onResetDemo();
              onClose();
            }}
          >
            <RotateCcw size={14} /> Сбросить к 4 демо-дням
          </button>

          <button
            className="btn-primary"
            onClick={() => {
              onSaveKey(draft.trim());
              onClose();
            }}
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
};
