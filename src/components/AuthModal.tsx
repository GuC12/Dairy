import React, { useState } from 'react';
import { useSignIn, useSignUp } from '@clerk/clerk-react';
import {
  ArrowLeft,
  KeyRound,
  LogIn,
  MailCheck,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  X,
} from 'lucide-react';
import type { AppUserProfile } from '../lib/supabaseClient';

interface AuthModalProps {
  initialMode?: 'signin' | 'signup';
  onSuccess: (user: AppUserProfile) => void;
  onClose: () => void;
}

interface ClerkErrorItem {
  code?: string;
  message?: string;
  longMessage?: string;
}

function translateClerkError(err: unknown): string {
  const clerkErr = err as { errors?: ClerkErrorItem[]; message?: string };
  const first = clerkErr?.errors?.[0];
  const code = first?.code ?? '';
  const raw = (first?.longMessage || first?.message || clerkErr?.message || '').toLowerCase();

  if (code === 'form_identifier_not_found' || raw.includes("couldn't find your account")) {
    return 'Аккаунт с такой почтой или логином не найден. Проверьте данные или зарегистрируйтесь.';
  }
  if (code === 'form_password_incorrect' || raw.includes('password is incorrect')) {
    return 'Неверный пароль. Попробуйте ещё раз или нажмите «Забыл пароль».';
  }
  if (code === 'form_identifier_exists') {
    if (raw.includes('username')) {
      return 'Этот логин уже занят. Выберите другой логин.';
    }
    return 'Эта электронная почта уже зарегистрирована. Перейдите во вкладку «Вход» или «Забыл пароль».';
  }
  if (code === 'form_password_pwned' || raw.includes('data breach')) {
    return 'Этот пароль слишком простой. Придумайте более надёжный пароль (минимум 8 символов с буквами и цифрами).';
  }
  if (code === 'form_password_length_too_short' || raw.includes('8 characters')) {
    return 'Пароль должен содержать не менее 8 символов.';
  }
  if (code === 'form_code_incorrect' || raw.includes('incorrect code') || raw.includes('is incorrect')) {
    return 'Неверный код из письма. Проверьте цифры и попробуйте снова.';
  }
  if (code === 'verification_expired' || raw.includes('expired')) {
    return 'Срок действия кода истёк. Нажмите «Отправить код повторно».';
  }
  if (code === 'form_username_invalid_character' || raw.includes('username')) {
    return 'Логин может содержать только латинские буквы, цифры, дефис или нижнее подчёркивание (от 4 символов).';
  }
  if (code === 'form_param_format_invalid') {
    return 'Проверьте правильность введённой электронной почты и логина.';
  }
  if (code === 'too_many_requests' || raw.includes('too many')) {
    return 'Слишком много попыток. Подождите минуту и попробуйте снова.';
  }
  return 'Не удалось выполнить запрос. Проверьте введённые данные и попробуйте ещё раз.';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  initialMode = 'signup',
  onClose,
}) => {
  const { isLoaded: signUpLoaded, signUp, setActive: setActiveSignUp } = useSignUp();
  const { isLoaded: signInLoaded, signIn, setActive: setActiveSignIn } = useSignIn();

  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>(initialMode);

  // Шаги регистрации: 'form' -> 'verify' (код с почты)
  const [signupStep, setSignupStep] = useState<'form' | 'verify'>('form');
  // Шаги сброса пароля: 'request' (ввод почты) -> 'confirm' (код с почты + новый пароль)
  const [resetStep, setResetStep] = useState<'request' | 'confirm'>('request');

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetMessages = () => {
    setError(null);
    setSuccessMsg(null);
  };

  // 1. Отправка формы регистрации (Логин + Email + Пароль -> отправка кода на почту)
  const handleSignUpStart = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    if (!signUpLoaded || !signUp) return;

    const cleanUser = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();

    if (cleanUser.length < 3) {
      setError('Логин должен содержать минимум 3 символа (латинские буквы, цифры или _).');
      return;
    }
    if (!cleanEmail.includes('@')) {
      setError('Введите корректный адрес электронной почты.');
      return;
    }
    if (password.length < 8) {
      setError('Пароль должен содержать минимум 8 символов.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await signUp.create({
        username: cleanUser,
        emailAddress: cleanEmail,
        password,
      });

      if (res.status === 'complete' && res.createdSessionId) {
        await setActiveSignUp({ session: res.createdSessionId });
        onClose();
        return;
      }

      await signUp.prepareEmailAddressVerification({
        strategy: 'email_code',
      });

      setCode('');
      setSignupStep('verify');
      setSuccessMsg(
        `Код подтверждения отправлен на почту ${cleanEmail}. Введите его ниже.`
      );
    } catch (err) {
      setError(translateClerkError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Подтверждение кода из письма при регистрации
  const handleSignUpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    if (!signUpLoaded || !signUp) return;

    const cleanCode = code.trim();
    if (cleanCode.length < 6) {
      setError('Введите 6-значный код из письма.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await signUp.attemptEmailAddressVerification({
        code: cleanCode,
      });

      if (res.status === 'complete' && res.createdSessionId) {
        await setActiveSignUp({ session: res.createdSessionId });
        onClose();
      } else {
        setError('Не удалось завершить подтверждение. Проверьте код из письма.');
      }
    } catch (err) {
      setError(translateClerkError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Повторная отправка кода при регистрации
  const handleResendSignUpCode = async () => {
    resetMessages();
    if (!signUpLoaded || !signUp) return;
    setIsSubmitting(true);
    try {
      await signUp.prepareEmailAddressVerification({
        strategy: 'email_code',
      });
      setSuccessMsg(`Новый код отправлен на ${email.trim()}.`);
    } catch (err) {
      setError(translateClerkError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Вход по Почте или Логину + Паролю
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    if (!signInLoaded || !signIn) return;

    const cleanId = identifier.trim();
    if (!cleanId) {
      setError('Введите вашу электронную почту или логин.');
      return;
    }
    if (!password) {
      setError('Введите пароль.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await signIn.create({
        identifier: cleanId,
        password,
      });

      if (res.status === 'complete' && res.createdSessionId) {
        await setActiveSignIn({ session: res.createdSessionId });
        onClose();
      } else {
        setError('Не удалось завершить вход. Проверьте почту/логин и пароль.');
      }
    } catch (err) {
      setError(translateClerkError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. Забыл пароль — Шаг 1: отправка кода сброса на почту
  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    if (!signInLoaded || !signIn) return;

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Введите электронную почту, на которую зарегистрирован аккаунт.');
      return;
    }

    setIsSubmitting(true);
    try {
      await signIn.create({
        strategy: 'reset_password_email_code',
        identifier: cleanEmail,
      });
      setCode('');
      setPassword('');
      setConfirmPassword('');
      setResetStep('confirm');
      setSuccessMsg(
        `Код для восстановления пароля отправлен на почту ${cleanEmail}.`
      );
    } catch (err) {
      setError(translateClerkError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // 5. Забыл пароль — Шаг 2: ввод кода с почты и установка нового пароля
  const handleResetConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    if (!signInLoaded || !signIn) return;

    const cleanCode = code.trim();
    if (cleanCode.length < 6) {
      setError('Введите 6-значный код из письма.');
      return;
    }
    if (password.length < 8) {
      setError('Новый пароль должен содержать минимум 8 символов.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Новый пароль и подтверждение пароля не совпадают.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code: cleanCode,
        password,
      });

      if (res.status === 'complete' && res.createdSessionId) {
        await setActiveSignIn({ session: res.createdSessionId });
        onClose();
      } else {
        setError('Не удалось обновить пароль. Проверьте код из письма.');
      }
    } catch (err) {
      setError(translateClerkError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Повторная отправка кода сброса пароля
  const handleResendResetCode = async () => {
    resetMessages();
    if (!signInLoaded || !signIn) return;
    setIsSubmitting(true);
    try {
      await signIn.create({
        strategy: 'reset_password_email_code',
        identifier: email.trim().toLowerCase(),
      });
      setSuccessMsg(`Новый код восстановления отправлен на ${email.trim()}.`);
    } catch (err) {
      setError(translateClerkError(err));
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
              resetMessages();
              setSignupStep('form');
              setMode('signup');
            }}
          >
            <UserPlus size={14} /> Регистрация
          </button>
          <button
            type="button"
            className={`mode-tab ${mode === 'signin' ? 'active' : ''}`}
            onClick={() => {
              resetMessages();
              setMode('signin');
            }}
          >
            <LogIn size={14} /> Вход
          </button>
          <button
            type="button"
            className={`mode-tab ${mode === 'reset' ? 'active' : ''}`}
            onClick={() => {
              resetMessages();
              setResetStep('request');
              setMode('reset');
            }}
          >
            <KeyRound size={14} /> Забыл пароль
          </button>
        </div>

        {/* === РЕГИСТРАЦИЯ: ШАГ 1 (ЛОГИН + ПОЧТА + ПАРОЛЬ) === */}
        {mode === 'signup' && signupStep === 'form' && (
          <form className="auth-form" onSubmit={handleSignUpStart}>
            <p className="auth-helper-text">
              Укажите ваш логин, электронную почту и пароль. Мы отправим код
              подтверждения на вашу почту.
            </p>

            <div>
              <label className="mini-label font-mono">Логин</label>
              <input
                type="text"
                className="input-field"
                placeholder="Ваш логин (латиницей)"
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div>
              <label className="mini-label font-mono">Электронная почта</label>
              <input
                type="email"
                className="input-field"
                placeholder="Ваша почта"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="mini-label font-mono">
                Пароль (минимум 8 символов)
              </label>
              <input
                type="password"
                className="input-field"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && <div className="form-error">{error}</div>}
            {successMsg && <div className="form-success">{successMsg}</div>}

            <button
              type="submit"
              className="btn-primary btn-large"
              disabled={isSubmitting}
            >
              <UserPlus size={16} />
              {isSubmitting ? 'Отправляем код на почту...' : 'Продолжить'}
            </button>
          </form>
        )}

        {/* === РЕГИСТРАЦИЯ: ШАГ 2 (ВВОД КОДА С ПОЧТЫ) === */}
        {mode === 'signup' && signupStep === 'verify' && (
          <form className="auth-form" onSubmit={handleSignUpVerify}>
            <p className="auth-helper-text">
              Введите 6-значный код, который пришёл на почту{' '}
              <strong>{email}</strong>.
            </p>

            <div>
              <label className="mini-label font-mono">
                Код подтверждения из письма
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                className="input-field font-mono"
                placeholder="000000"
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>

            {error && <div className="form-error">{error}</div>}
            {successMsg && <div className="form-success">{successMsg}</div>}

            <button
              type="submit"
              className="btn-primary btn-large"
              disabled={isSubmitting}
            >
              <MailCheck size={16} />
              {isSubmitting ? 'Проверяем код...' : 'Подтвердить и создать дневник'}
            </button>

            <div className="auth-sub-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  resetMessages();
                  setSignupStep('form');
                }}
              >
                <ArrowLeft size={14} /> Изменить данные
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={handleResendSignUpCode}
                disabled={isSubmitting}
              >
                <RefreshCw size={14} /> Отправить код повторно
              </button>
            </div>
          </form>
        )}

        {/* === ВХОД В АККАУНТ (ПОЧТА ИЛИ ЛОГИН + ПАРОЛЬ) === */}
        {mode === 'signin' && (
          <form className="auth-form" onSubmit={handleSignIn}>
            <p className="auth-helper-text">
              Введите вашу электронную почту или логин и пароль от дневника.
            </p>

            <div>
              <label className="mini-label font-mono">
                Электронная почта или логин
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="Ваша почта или логин"
                autoFocus
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
              />
            </div>

            <div>
              <div className="auth-label-row">
                <label className="mini-label font-mono">Пароль</label>
                <button
                  type="button"
                  className="auth-forgot-link font-mono"
                  onClick={() => {
                    resetMessages();
                    if (identifier.includes('@')) {
                      setEmail(identifier.trim());
                    }
                    setResetStep('request');
                    setMode('reset');
                  }}
                >
                  Забыли пароль?
                </button>
              </div>
              <input
                type="password"
                className="input-field"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && <div className="form-error">{error}</div>}
            {successMsg && <div className="form-success">{successMsg}</div>}

            <button
              type="submit"
              className="btn-primary btn-large"
              disabled={isSubmitting}
            >
              <LogIn size={16} />
              {isSubmitting ? 'Открываем дневник...' : 'Войти в дневник'}
            </button>
          </form>
        )}

        {/* === ЗАБЫЛ ПАРОЛЬ: ШАГ 1 (ВВОД ПОЧТЫ ДЛЯ ПОЛУЧЕНИЯ КОДА) === */}
        {mode === 'reset' && resetStep === 'request' && (
          <form className="auth-form" onSubmit={handleResetRequest}>
            <p className="auth-helper-text">
              Укажите вашу электронную почту. Мы отправим на неё 6-значный код,
              чтобы вы могли задать новый пароль.
            </p>

            <div>
              <label className="mini-label font-mono">Электронная почта</label>
              <input
                type="email"
                className="input-field"
                placeholder="Ваша почта"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {error && <div className="form-error">{error}</div>}
            {successMsg && <div className="form-success">{successMsg}</div>}

            <button
              type="submit"
              className="btn-primary btn-large"
              disabled={isSubmitting}
            >
              <MailCheck size={16} />
              {isSubmitting ? 'Отправляем код...' : 'Отправить код на почту'}
            </button>
          </form>
        )}

        {/* === ЗАБЫЛ ПАРОЛЬ: ШАГ 2 (КОД С ПОЧТЫ + НОВЫЙ ПАРОЛЬ) === */}
        {mode === 'reset' && resetStep === 'confirm' && (
          <form className="auth-form" onSubmit={handleResetConfirm}>
            <p className="auth-helper-text">
              Введите 6-значный код из письма, отправленного на{' '}
              <strong>{email}</strong>, и задайте новый пароль.
            </p>

            <div>
              <label className="mini-label font-mono">
                Код из письма (6 цифр)
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                className="input-field font-mono"
                placeholder="000000"
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>

            <div>
              <label className="mini-label font-mono">
                Новый пароль (минимум 8 символов)
              </label>
              <input
                type="password"
                className="input-field"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

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

            {error && <div className="form-error">{error}</div>}
            {successMsg && <div className="form-success">{successMsg}</div>}

            <button
              type="submit"
              className="btn-primary btn-large"
              disabled={isSubmitting}
            >
              <KeyRound size={16} />
              {isSubmitting ? 'Сохраняем пароль...' : 'Сменить пароль и войти'}
            </button>

            <div className="auth-sub-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  resetMessages();
                  setResetStep('request');
                }}
              >
                <ArrowLeft size={14} /> Указать другую почту
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={handleResendResetCode}
                disabled={isSubmitting}
              >
                <RefreshCw size={14} /> Отправить код повторно
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
