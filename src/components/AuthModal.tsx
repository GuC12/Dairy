import React, { useState } from 'react';
import { LogIn, ShieldCheck, UserPlus, X } from 'lucide-react';
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
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanUser = username.trim().toLowerCase().replace(/\s+/g, '_');
    if (cleanUser.length < 2) {
      setError('Введите логин (минимум 2 символа).');
      return;
    }
    if (password.length < 4) {
      setError('Пароль должен содержать минимум 4 символа.');
      return;
    }

    setIsSubmitting(true);
    try {
      const passHash = btoa(encodeURIComponent(password));
      const userId = `user_${cleanUser}`;
      const raw = localStorage.getItem(LOCAL_USERS_KEY);
      const list: StoredUsernameAccount[] = raw ? JSON.parse(raw) : [];

      const sb = getSupabaseClient();

      if (mode === 'signup') {
        const existingLocal = list.find((u) => u.username === cleanUser);
        if (existingLocal) {
          setError('Этот логин уже занят. Выберите другой или нажмите «Вход».');
          setIsSubmitting(false);
          return;
        }

        // Проверяем также в Supabase profiles, если таблица доступна
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
          email: passHash, // сохраняем хеш для облачной сверки в profiles
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
            setError('Неверный пароль.');
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

        // Если локально нет — проверяем в облаке Supabase
        if (sb) {
          try {
            const { data: remoteUser } = await sb
              .from('profiles')
              .select('id, email, full_name')
              .eq('id', userId)
              .maybeSingle();

            if (remoteUser) {
              if (remoteUser.email && remoteUser.email !== passHash) {
                setError('Неверный пароль.');
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
            <ShieldCheck size={16} /> YOURDIARY // ЛИЧНЫЙ АККАУНТ
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
              setMode('signin');
            }}
          >
            <LogIn size={14} /> Вход
          </button>
        </div>

        <form className="auth-form" onSubmit={handleAuthSubmit}>
          <p className="auth-helper-text">
            {mode === 'signup'
              ? 'Придумайте логин и пароль (без почты и лишних данных). У каждого логина свой отдельный дневник.'
              : 'Введите ваш логин и пароль, чтобы открыть свой личный дневник.'}
          </p>

          <div>
            <label className="mini-label font-mono">Логин (никнейм)</label>
            <input
              type="text"
              className="input-field"
              placeholder="например: guc12"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div>
            <label className="mini-label font-mono">Пароль</label>
            <input
              type="password"
              className="input-field"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <div className="form-error">{error}</div>}

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
            ) : (
              <>
                <LogIn size={16} />
                {isSubmitting ? 'Открываем...' : 'Войти в дневник'}
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
