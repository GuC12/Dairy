import React, { useState } from 'react';
import { KeyRound, LogIn, ShieldCheck, UserPlus, X } from 'lucide-react';
import {
  getSupabaseClient,
  syncUserProfileToSupabase,
  type AppUserProfile,
} from '../lib/supabaseClient';

interface AuthModalProps {
  initialMode?: 'signin' | 'signup';
  onSuccess: (user: AppUserProfile) => void;
  onClose: () => void;
}

const LOCAL_USERS_KEY = 'yourdiary_username_accounts_v1';

interface StoredUsernameAccount {
  id: string;
  username: string;
  passwordHash: string;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  initialMode = 'signup',
  onSuccess,
  onClose,
}) => {
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>(initialMode);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanUser = username.trim().toLowerCase().replace(/\s+/g, '_');
    if (cleanUser.length < 2) {
      setError('Введите логин (минимум 2 символа).');
      return;
    }
    if (password.length < 4) {
      setError('Пароль должен содержать минимум 4 символа.');
      return;
    }
    if (mode === 'reset' && password !== confirmPassword) {
      setError('Новый пароль и подтверждение пароля не совпадают.');
      return;
    }

    setIsSubmitting(true);
    try {
      const passHash = btoa(encodeURIComponent(password));
      const userId = `user_${cleanUser}`;
      const raw = localStorage.getItem(LOCAL_USERS_KEY);
      const list: StoredUsernameAccount[] = raw ? JSON.parse(raw) : [];

      const sb = getSupabaseClient();

      if (mode === 'reset') {
        // Сброс пароля по логину
        const localIdx = list.findIndex((u) => u.username === cleanUser);
        let foundInCloud = false;

        if (sb) {
          try {
            const { data: remoteUser } = await sb
              .from('profiles')
              .select('id')
              .eq('id', userId)
              .maybeSingle();
            if (remoteUser) {
              foundInCloud = true;
            }
          } catch {
            // ignore
          }
        }

        if (localIdx === -1 && !foundInCloud) {
          setError('Аккаунт с таким логином не найден. Проверьте логин или создайте новый.');
          setIsSubmitting(false);
          return;
        }

        if (localIdx !== -1) {
          list[localIdx].passwordHash = passHash;
        } else {
          list.push({
            id: userId,
            username: cleanUser,
            passwordHash: passHash,
          });
        }
        localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(list));

        const updatedProfile: AppUserProfile = {
          id: userId,
          email: passHash,
          fullName: cleanUser,
          provider: 'supabase-local',
        };
        await syncUserProfileToSupabase(updatedProfile);
        setSuccessMsg('Пароль успешно обновлён! Открываем ваш дневник...');
        onSuccess(updatedProfile);
        return;
      }

      if (mode === 'signup') {
        const existingLocal = list.find((u) => u.username === cleanUser);
        if (existingLocal) {
          setError('Этот логин уже занят. Выберите другой или нажмите «Вход».');
          setIsSubmitting(false);
          return;
        }

        if (sb) {
          try {
            const { data: remoteUser } = await sb
              .from('profiles')
              .select('id, email')
              .eq('id', userId)
              .maybeSingle();
            if (remoteUser) {
              setError('Этот логин уже зарегистрирован в облаке. Войдите.');
              setIsSubmitting(false);
              return;
            }
          } catch {
            // ignore if table not created yet
          }
        }

        const newAcc: StoredUsernameAccount = {
          id: userId,
          username: cleanUser,
          passwordHash: passHash,
        };
        list.push(newAcc);
        localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(list));

        const profile: AppUserProfile = {
          id: userId,
          email: passHash,
          fullName: cleanUser,
          provider: 'supabase-local',
        };
        await syncUserProfileToSupabase(profile);
        onSuccess(profile);
      } else {
        // Вход по логину и паролю
        const foundLocal = list.find((u) => u.username === cleanUser);
        if (foundLocal) {
          if (foundLocal.passwordHash !== passHash) {
            setError('Неверный пароль. Нажмите «Забыл пароль», если хотите задать новый.');
            setIsSubmitting(false);
            return;
          }
          const profile: AppUserProfile = {
            id: foundLocal.id,
            email: passHash,
            fullName: foundLocal.username,
            provider: 'supabase-local',
          };
          await syncUserProfileToSupabase(profile);
          onSuccess(profile);
          return;
        }

        if (sb) {
          try {
            const { data: remoteUser } = await sb
              .from('profiles')
              .select('id, email, full_name')
              .eq('id', userId)
              .maybeSingle();

            if (remoteUser) {
              if (remoteUser.email && remoteUser.email !== passHash) {
                setError('Неверный пароль. Нажмите «Забыл пароль», чтобы сбросить его.');
                setIsSubmitting(false);
                return;
              }
              const syncedAcc: StoredUsernameAccount = {
                id: userId,
                username: cleanUser,
                passwordHash: passHash,
              };
              list.push(syncedAcc);
              localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(list));

              const profile: AppUserProfile = {
                id: userId,
                email: passHash,
                fullName: cleanUser,
                provider: 'supabase-local',
              };
              onSuccess(profile);
              return;
            }
          } catch {
            // ignore
          }
        }

        setError('Аккаунт с таким логином не найден. Зарегистрируйтесь.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <div
        className="lightbox-box auth-modal-box"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="lightbox-head font-mono">
          <span className="tapestry-head-title">
            <ShieldCheck size={16} /> ЛИЧНЫЙ АККАУНТ ДНЕВНИКА
          </span>
          <button type="button" className="btn-ghost" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="auth-mode-tabs font-mono">
          <button
            type="button"
            className={`mode-tab ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => {
              setError(null);
              setSuccessMsg(null);
              setMode('signup');
            }}
          >
            <UserPlus size={14} /> Регистрация
          </button>
          <button
            type="button"
            className={`mode-tab ${mode === 'signin' ? 'active' : ''}`}
            onClick={() => {
              setError(null);
              setSuccessMsg(null);
              setMode('signin');
            }}
          >
            <LogIn size={14} /> Вход
          </button>
          <button
            type="button"
            className={`mode-tab ${mode === 'reset' ? 'active' : ''}`}
            onClick={() => {
              setError(null);
              setSuccessMsg(null);
              setMode('reset');
            }}
          >
            <KeyRound size={14} /> Забыл пароль
          </button>
        </div>

        <form className="auth-form" onSubmit={handleAuthSubmit}>
          <p className="auth-helper-text">
            {mode === 'signup'
              ? 'Придумайте логин и пароль (без почты и лишних данных). У каждого логина свой отдельный дневник.'
              : mode === 'signin'
                ? 'Введите ваш логин и пароль, чтобы открыть свой личный дневник.'
                : 'Введите ваш логин и задайте новый пароль для доступа к вашему дневнику.'}
          </p>

          <div>
            <label className="mini-label font-mono">Логин</label>
            <input
              type="text"
              className="input-field"
              placeholder="Ваш логин"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div>
            <div className="auth-label-row">
              <label className="mini-label font-mono">
                {mode === 'reset' ? 'Новый пароль' : 'Пароль'}
              </label>
              {mode === 'signin' && (
                <button
                  type="button"
                  className="auth-forgot-link font-mono"
                  onClick={() => {
                    setError(null);
                    setSuccessMsg(null);
                    setMode('reset');
                  }}
                >
                  Забыли пароль?
                </button>
              )}
            </div>
            <input
              type="password"
              className="input-field"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {mode === 'reset' && (
            <div>
              <label className="mini-label font-mono">
                Повторите новый пароль
              </label>
              <input
                type="password"
                className="input-field"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          )}

          {error && <div className="form-error">{error}</div>}
          {successMsg && <div className="form-success">{successMsg}</div>}

          <button
            type="submit"
            className="btn-primary btn-large"
            disabled={isSubmitting}
          >
            {mode === 'signup' ? (
              <>
                <UserPlus size={16} />
                {isSubmitting ? 'Создаём дневник...' : 'Создать дневник'}
              </>
            ) : mode === 'signin' ? (
              <>
                <LogIn size={16} />
                {isSubmitting ? 'Открываем...' : 'Войти в дневник'}
              </>
            ) : (
              <>
                <KeyRound size={16} />
                {isSubmitting ? 'Сохраняем пароль...' : 'Сохранить новый пароль'}
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
