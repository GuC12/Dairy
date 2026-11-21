import React, { useEffect, useState } from 'react';
import { SignIn, SignUp, useUser } from '@clerk/react';
import { KeyRound, LogIn, ShieldCheck, UserPlus, X } from 'lucide-react';
import { useLanguage } from '../i18n/useLanguage';

interface AuthModalProps {
  initialMode?: 'signin' | 'signup';
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  initialMode = 'signup',
  onClose,
}) => {
  const { t } = useLanguage();
  const { isSignedIn } = useUser();
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>(initialMode);

  // Автоматически закрываем окно, как только пользователь успешно вошёл через Clerk
  useEffect(() => {
    if (isSignedIn) {
      onClose();
    }
  }, [isSignedIn, onClose]);

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <div
        className="lightbox-box auth-modal-box"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="lightbox-head font-mono">
          <span className="tapestry-head-title">
            <ShieldCheck size={16} />{' '}
            {t('ЛИЧНЫЙ АККАУНТ ДНЕВНИКА', 'PERSONAL DIARY ACCOUNT')}
          </span>
          <button type="button" className="btn-ghost" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="auth-mode-tabs font-mono">
          <button
            type="button"
            className={`mode-tab ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => setMode('signup')}
          >
            <UserPlus size={14} /> {t('Регистрация', 'Sign Up')}
          </button>
          <button
            type="button"
            className={`mode-tab ${mode === 'signin' ? 'active' : ''}`}
            onClick={() => setMode('signin')}
          >
            <LogIn size={14} /> {t('Вход', 'Sign In')}
          </button>
          <button
            type="button"
            className={`mode-tab ${mode === 'reset' ? 'active' : ''}`}
            onClick={() => setMode('reset')}
          >
            <KeyRound size={14} /> {t('Забыл пароль', 'Forgot Password')}
          </button>
        </div>

        {mode === 'reset' && (
          <div className="form-success" style={{ marginBottom: 14 }}>
            {t(
              '1. Введите вашу почту или логин и нажмите «Продолжить».\n2. На шаге ввода пароля нажмите «Забыли пароль?» — на вашу почту придёт 6-значный код для смены пароля.',
              '1. Enter your email or username and click "Continue".\n2. On the password step, click "Forgot password?" — a 6-digit code will be sent to your email to set a new password.'
            )}
          </div>
        )}

        <div className="clerk-embedded-wrap">
          {mode === 'signup' ? (
            <SignUp routing="hash" />
          ) : (
            <SignIn routing="hash" />
          )}
        </div>
      </div>
    </div>
  );
};
