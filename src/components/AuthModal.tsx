import React, { useState } from 'react';
import {
  CheckCircle2,
  Cloud,
  Database,
  KeyRound,
  LogIn,
  ShieldCheck,
  UserPlus,
  X,
} from 'lucide-react';
import {
  getAuthConfig,
  getSupabaseClient,
  saveRuntimeAuthConfig,
  syncUserProfileToSupabase,
  type AppUserProfile,
} from '../lib/supabaseClient';

interface AuthModalProps {
  onSuccess: (user: AppUserProfile) => void;
  onConfigSaved: () => void;
  onClose: () => void;
}

const LOCAL_USERS_KEY = 'atmos_registered_users';

interface StoredLocalAccount {
  id: string;
  email: string;
  fullName: string;
  passwordHash: string;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  onSuccess,
  onConfigSaved,
  onClose,
}) => {
  const [mode, setMode] = useState<'signin' | 'signup' | 'keys'>('signup');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const initialCfg = getAuthConfig();
  const [clerkKey, setClerkKey] = useState(initialCfg.clerkKey);
  const [supabaseUrl, setSupabaseUrl] = useState(initialCfg.supabaseUrl);
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(
    initialCfg.supabaseAnonKey
  );

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Введите корректный Email.');
      return;
    }
    if (password.length < 4) {
      setError('Пароль должен содержать минимум 4 символа.');
      return;
    }
    if (mode === 'signup' && !fullName.trim()) {
      setError('Укажите ваше имя для дневника.');
      return;
    }

    setIsSubmitting(true);
    try {
      const sb = getSupabaseClient();

      // Если подключён Supabase — пробуем также стандартную регистрацию/вход Supabase Auth + запись в profiles
      if (sb) {
        if (mode === 'signup') {
          const { data } = await sb.auth.signUp({
            email: cleanEmail,
            password,
            options: { data: { full_name: fullName.trim() } },
          });
          if (data?.user) {
            const profile: AppUserProfile = {
              id: data.user.id,
              email: cleanEmail,
              fullName: fullName.trim(),
              provider: 'supabase-local',
            };
            await syncUserProfileToSupabase(profile);
            onSuccess(profile);
            return;
          }
        } else {
          const { data } = await sb.auth.signInWithPassword({
            email: cleanEmail,
            password,
          });
          if (data?.user) {
            const metaName =
              (data.user.user_metadata?.full_name as string | undefined) ||
              cleanEmail.split('@')[0];
            const profile: AppUserProfile = {
              id: data.user.id,
              email: cleanEmail,
              fullName: metaName,
              provider: 'supabase-local',
            };
            await syncUserProfileToSupabase(profile);
            onSuccess(profile);
            return;
          }
        }
      }

      // Локальный реестр аккаунтов + синхронизация с таблицей profiles в Supabase
      const raw = localStorage.getItem(LOCAL_USERS_KEY);
      const list: StoredLocalAccount[] = raw ? JSON.parse(raw) : [];

      if (mode === 'signup') {
        const existing = list.find((u) => u.email === cleanEmail);
        if (existing) {
          setError('Пользователь с таким Email уже зарегистрирован. Войдите.');
          setIsSubmitting(false);
          return;
        }
        const newAcc: StoredLocalAccount = {
          id: `user_${Date.now().toString(36)}`,
          email: cleanEmail,
          fullName: fullName.trim(),
          passwordHash: btoa(encodeURIComponent(password)),
        };
        list.push(newAcc);
        localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(list));

        const profile: AppUserProfile = {
          id: newAcc.id,
          email: newAcc.email,
          fullName: newAcc.fullName,
          provider: 'supabase-local',
        };
        await syncUserProfileToSupabase(profile);
        onSuccess(profile);
      } else {
        const found = list.find((u) => u.email === cleanEmail);
        if (!found) {
          setError('Аккаунт не найден. Зарегистрируйтесь.');
          setIsSubmitting(false);
          return;
        }
        if (found.passwordHash !== btoa(encodeURIComponent(password))) {
          setError('Неверный пароль.');
          setIsSubmitting(false);
          return;
        }
        const profile: AppUserProfile = {
          id: found.id,
          email: found.email,
          fullName: found.fullName,
          provider: 'supabase-local',
        };
        await syncUserProfileToSupabase(profile);
        onSuccess(profile);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveKeys = (e: React.FormEvent) => {
    e.preventDefault();
    saveRuntimeAuthConfig({
      clerkKey,
      supabaseUrl,
      supabaseAnonKey,
    });
    onConfigSaved();
  };

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <div
        className="lightbox-box auth-modal-box"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="lightbox-head font-mono">
          <span className="tapestry-head-title">
            <ShieldCheck size={16} /> ATMOS ID // CLERK & SUPABASE AUTH
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
          <button
            type="button"
            className={`mode-tab ${mode === 'keys' ? 'active' : ''}`}
            onClick={() => {
              setError(null);
              setMode('keys');
            }}
          >
            <KeyRound size={14} /> Ключи Clerk / Supabase
          </button>
        </div>

        {mode === 'keys' ? (
          <form className="auth-form" onSubmit={handleSaveKeys}>
            <p className="auth-helper-text">
              Вставьте ключи вашего проекта <strong>Clerk</strong> и{' '}
              <strong>Supabase</strong> (или задайте их в файле{' '}
              <code>.env</code>). SQL-схема таблиц находится в файле{' '}
              <code>SUPABASE_SETUP.sql</code>.
            </p>

            <div>
              <label className="mini-label font-mono">
                VITE_CLERK_PUBLISHABLE_KEY (pk_test_...)
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="pk_test_..."
                value={clerkKey}
                onChange={(e) => setClerkKey(e.target.value)}
              />
            </div>

            <div>
              <label className="mini-label font-mono">
                VITE_SUPABASE_URL (https://xxx.supabase.co)
              </label>
              <input
                type="url"
                className="input-field"
                placeholder="https://your-project.supabase.co"
                value={supabaseUrl}
                onChange={(e) => setSupabaseUrl(e.target.value)}
              />
            </div>

            <div>
              <label className="mini-label font-mono">
                VITE_SUPABASE_ANON_KEY
              </label>
              <input
                type="password"
                className="input-field"
                placeholder="eyJhbGciOi..."
                value={supabaseAnonKey}
                onChange={(e) => setSupabaseAnonKey(e.target.value)}
              />
            </div>

            <div className="auth-status-row font-mono">
              <span>
                <CheckCircle2 size={13} /> Clerk:{' '}
                {clerkKey.startsWith('pk_') ? 'Подключён' : 'Встроенный режим'}
              </span>
              <span>
                <Database size={13} /> Supabase:{' '}
                {supabaseUrl.startsWith('http') ? 'Подключён' : 'Локальный БД'}
              </span>
            </div>

            <button type="submit" className="btn-primary btn-large">
              <Cloud size={16} />
              Сохранить и перезагрузить провайдеры
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={handleAuthSubmit}>
            <p className="auth-helper-text">
              {mode === 'signup'
                ? 'Создайте личный аккаунт дневника для сохранения и синхронизации ваших папок дней в облаке Supabase.'
                : 'Войдите в свой аккаунт дневника, чтобы синхронизировать записи.'}
            </p>

            {mode === 'signup' && (
              <div>
                <label className="mini-label font-mono">Ваше имя</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Алихан"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
            )}

            <div>
              <label className="mini-label font-mono">Email</label>
              <input
                type="email"
                className="input-field"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                  {isSubmitting ? 'Создаём аккаунт...' : 'Зарегистрироваться'}
                </>
              ) : (
                <>
                  <LogIn size={16} />
                  {isSubmitting ? 'Входим...' : 'Войти в дневник'}
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
