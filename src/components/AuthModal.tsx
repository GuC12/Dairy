import React, { useState } from 'react';
import { useClerk, useSignIn, useSignUp } from '@clerk/clerk-react';
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
import {
  getSupabaseClient,
  syncUserProfileToSupabase,
  type AppUserProfile,
} from '../lib/supabaseClient';
import { useLanguage } from '../i18n/LanguageContext';

interface AuthModalProps {
  initialMode?: 'signin' | 'signup';
  onSuccess: (user: AppUserProfile) => void;
  onClose: () => void;
}

interface ClerkErrorItem {
  code?: string;
  message?: string;
  longMessage?: string;
  meta?: { paramName?: string };
}

export const USERNAME_MAP_KEY = 'yourdiary_username_email_map_v1';

export interface UsernameEmailRecord {
  username: string;
  email: string;
}

export function saveUsernameEmailMap(username: string, email: string): void {
  try {
    const cleanU = username.trim().toLowerCase();
    const cleanE = email.trim().toLowerCase();
    if (!cleanU || !cleanE) return;
    const raw = localStorage.getItem(USERNAME_MAP_KEY);
    const list: UsernameEmailRecord[] = raw ? JSON.parse(raw) : [];
    const filtered = list.filter(
      (r) => r.username !== cleanU && r.email !== cleanE
    );
    filtered.push({ username: cleanU, email: cleanE });
    localStorage.setItem(USERNAME_MAP_KEY, JSON.stringify(filtered));
  } catch {
    // ignore
  }
}

export function getUsernameByEmail(email: string): string | null {
  try {
    const cleanE = email.trim().toLowerCase();
    const raw = localStorage.getItem(USERNAME_MAP_KEY);
    const list: UsernameEmailRecord[] = raw ? JSON.parse(raw) : [];
    return list.find((r) => r.email === cleanE)?.username ?? null;
  } catch {
    return null;
  }
}

export async function resolveEmailFromIdentifier(
  identifier: string
): Promise<string> {
  const clean = identifier.trim().toLowerCase();
  if (clean.includes('@')) return clean;

  try {
    const raw = localStorage.getItem(USERNAME_MAP_KEY);
    const list: UsernameEmailRecord[] = raw ? JSON.parse(raw) : [];
    const foundLocal = list.find((r) => r.username === clean);
    if (foundLocal) return foundLocal.email;
  } catch {
    // ignore
  }

  const sb = getSupabaseClient();
  if (sb) {
    try {
      const { data } = await sb
        .from('profiles')
        .select('email, full_name')
        .ilike('full_name', clean)
        .maybeSingle();
      if (data?.email && data.email.includes('@')) {
        saveUsernameEmailMap(clean, data.email);
        return data.email.toLowerCase();
      }
    } catch {
      // ignore
    }
  }

  return clean;
}

function translateClerkError(err: unknown, lang: 'ru' | 'en'): string {
  const clerkErr = err as { errors?: ClerkErrorItem[]; message?: string };
  const first = clerkErr?.errors?.[0];
  const code = first?.code ?? '';
  const rawMessage = first?.longMessage || first?.message || clerkErr?.message || '';
  const raw = rawMessage.toLowerCase();

  if (lang === 'en') {
    return rawMessage || 'Could not complete request. Please check your details.';
  }

  if (
    code === 'form_identifier_not_found' ||
    raw.includes("couldn't find your account")
  ) {
    return 'Аккаунт с такой почтой или логином не найден. Проверьте данные или зарегистрируйтесь.';
  }
  if (
    code === 'form_password_incorrect' ||
    raw.includes('password is incorrect')
  ) {
    return 'Неверный пароль. Попробуйте ещё раз или нажмите «Забыл пароль».';
  }
  if (code === 'form_identifier_exists') {
    if (raw.includes('username')) {
      return 'Этот логин уже занят. Выберите другой логин.';
    }
    return 'Эта электронная почта уже зарегистрирована. Перейдите во вкладку «Вход» или «Забыл пароль».';
  }
  if (code === 'form_password_pwned' || raw.includes('data breach')) {
    return 'Этот пароль слишком простой (встречается в публичных базах). Придумайте более надёжный пароль (например, добавьте цифры и заглавные буквы).';
  }
  if (
    code === 'form_password_length_too_short' ||
    raw.includes('8 characters')
  ) {
    return 'Пароль должен содержать не менее 8 символов.';
  }
  if (
    code === 'form_code_incorrect' ||
    raw.includes('incorrect code') ||
    raw.includes('is incorrect')
  ) {
    return 'Неверный код из письма. Проверьте цифры и попробуйте снова.';
  }
  if (code === 'verification_expired' || raw.includes('expired')) {
    return 'Срок действия кода истёк. Нажмите «Отправить код повторно».';
  }
  if (
    code === 'form_username_invalid_character' ||
    code === 'form_username_invalid_length' ||
    raw.includes('username')
  ) {
    return 'Логин должен быть от 4 до 32 символов и содержать только латинские буквы, цифры, дефис или нижнее подчёркивание.';
  }
  if (code === 'form_param_format_invalid') {
    return 'Проверьте правильность введённого адреса электронной почты.';
  }
  if (code === 'too_many_requests' || raw.includes('too many')) {
    return 'Слишком много попыток. Подождите минуту и попробуйте снова.';
  }
  if (code === 'captcha_invalid' || code === 'captcha_missing_token' || raw.includes('captcha')) {
    return 'Проверка безопасности Clerk (CAPTCHA). Подождите секунду и нажмите кнопку ещё раз.';
  }
  return rawMessage
    ? `Ошибка проверки: ${rawMessage}`
    : 'Не удалось выполнить запрос. Проверьте введённые данные.';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  initialMode = 'signup',
  onSuccess,
  onClose,
}) => {
  const { lang, t } = useLanguage();
  const clerk = useClerk();
  const {
    isLoaded: signUpLoaded,
    signUp,
    setActive: setActiveSignUp,
  } = useSignUp();
  const {
    isLoaded: signInLoaded,
    signIn,
    setActive: setActiveSignIn,
  } = useSignIn();

  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>(initialMode);
  const [signupStep, setSignupStep] = useState<'form' | 'verify'>('form');
  const [signinStep, setSigninStep] = useState<'form' | 'verify2fa'>('form');
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

  // Завершение входа/регистрации и синхронизация с Supabase
  const finalizeClerkLogin = async (
    sessionId: string | null,
    setActiveFn: (params: { session: string }) => Promise<void>,
    fallbackEmail: string,
    preferredUsername?: string
  ) => {
    if (sessionId) {
      await setActiveFn({ session: sessionId });
    }
    const cleanE = fallbackEmail.trim().toLowerCase();
    const cleanU =
      preferredUsername?.trim().toLowerCase() ||
      getUsernameByEmail(cleanE) ||
      cleanE.split('@')[0] ||
      'author';

    if (cleanE && cleanU) {
      saveUsernameEmailMap(cleanU, cleanE);
    }

    const clerkUserId = clerk.user?.id || `clerk_${cleanE || cleanU}`;
    const profile: AppUserProfile = {
      id: clerkUserId,
      email: cleanE,
      fullName: cleanU,
      provider: 'clerk',
    };
    await syncUserProfileToSupabase(profile).catch(() => {});
    onSuccess(profile);
    onClose();
  };

  // 1. РЕГИСТРАЦИЯ: Шаг 1 (Логин + Email + Пароль -> отправка кода на почту)
  const handleSignUpStart = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    if (!signUpLoaded || !signUp) return;

    const cleanUser = username.trim().toLowerCase().replace(/\s+/g, '_');
    const cleanEmail = email.trim().toLowerCase();

    if (cleanUser.length < 3) {
      setError(
        t(
          'Логин должен содержать минимум 3 символа (латинские буквы, цифры или _).',
          'Username must be at least 3 characters.'
        )
      );
      return;
    }
    if (!cleanEmail.includes('@')) {
      setError(
        t(
          'Введите корректный адрес электронной почты.',
          'Please enter a valid email address.'
        )
      );
      return;
    }
    if (password.length < 8) {
      setError(
        t(
          'Пароль должен содержать минимум 8 символов.',
          'Password must be at least 8 characters.'
        )
      );
      return;
    }

    setIsSubmitting(true);
    try {
      // Если осталась старая сессия Clerk, сначала закрываем её
      if (clerk.session) {
        await clerk.signOut();
      }

      saveUsernameEmailMap(cleanUser, cleanEmail);

      let res;
      try {
        // Сначала пробуем передать username напрямую в Clerk
        res = await signUp.create({
          username: cleanUser,
          emailAddress: cleanEmail,
          password,
          unsafeMetadata: { username: cleanUser },
        });
      } catch (firstErr) {
        const cErr = firstErr as { errors?: ClerkErrorItem[] };
        const errCode = cErr?.errors?.[0]?.code ?? '';
        const paramName = cErr?.errors?.[0]?.meta?.paramName ?? '';
        // Если в настройках Clerk поле username отключено или требует только email+password:
        if (
          errCode === 'form_param_unknown' ||
          paramName === 'username' ||
          errCode === 'form_username_invalid_length'
        ) {
          res = await signUp.create({
            emailAddress: cleanEmail,
            password,
            unsafeMetadata: { username: cleanUser },
          });
        } else {
          throw firstErr;
        }
      }

      // Если в Clerk обязательны first_name / last_name — заполняем их автоматически из логина
      if (
        res.status === 'missing_requirements' &&
        (res.missingFields.includes('first_name') ||
          res.missingFields.includes('last_name'))
      ) {
        res = await signUp.update({
          firstName: cleanUser,
          lastName: 'YourDiary',
        });
      }

      if (res.status === 'complete' && res.createdSessionId) {
        await finalizeClerkLogin(
          res.createdSessionId,
          setActiveSignUp,
          cleanEmail,
          cleanUser
        );
        return;
      }

      await signUp.prepareEmailAddressVerification({
        strategy: 'email_code',
      });

      setCode('');
      setSignupStep('verify');
      setSuccessMsg(
        t(
          `Код подтверждения отправлен на почту ${cleanEmail}. Введите его ниже.`,
          `Verification code sent to ${cleanEmail}. Please enter it below.`
        )
      );
    } catch (err) {
      setError(translateClerkError(err, lang));
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. РЕГИСТРАЦИЯ: Шаг 2 (Подтверждение кода из письма)
  const handleSignUpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    if (!signUpLoaded || !signUp) return;

    const cleanCode = code.trim();
    if (cleanCode.length < 6) {
      setError(
        t(
          'Введите 6-значный код из письма.',
          'Please enter the 6-digit code from the email.'
        )
      );
      return;
    }

    setIsSubmitting(true);
    try {
      let res = await signUp.attemptEmailAddressVerification({
        code: cleanCode,
      });

      // Если после верификации почты Clerk просит обязательное поле (например username/first_name)
      if (res.status === 'missing_requirements') {
        const cleanUser = username.trim().toLowerCase().replace(/\s+/g, '_');
        const updatePayload: Record<string, string> = {};
        if (res.missingFields.includes('username')) {
          updatePayload.username =
            cleanUser.length >= 4 ? cleanUser : `${cleanUser}_user`;
        }
        if (res.missingFields.includes('first_name')) {
          updatePayload.firstName = cleanUser;
        }
        if (res.missingFields.includes('last_name')) {
          updatePayload.lastName = 'YourDiary';
        }
        if (Object.keys(updatePayload).length > 0) {
          res = await signUp.update(updatePayload);
        }
      }

      if (res.status === 'complete' && res.createdSessionId) {
        await finalizeClerkLogin(
          res.createdSessionId,
          setActiveSignUp,
          email,
          username
        );
      } else {
        setError(
          t(
            'Не удалось завершить подтверждение. Проверьте код из письма.',
            'Could not complete verification. Please check the code.'
          )
        );
      }
    } catch (err) {
      setError(translateClerkError(err, lang));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendSignUpCode = async () => {
    resetMessages();
    if (!signUpLoaded || !signUp) return;
    setIsSubmitting(true);
    try {
      await signUp.prepareEmailAddressVerification({
        strategy: 'email_code',
      });
      setSuccessMsg(
        t(
          `Новый код отправлен на ${email.trim()}.`,
          `A new code has been sent to ${email.trim()}.`
        )
      );
    } catch (err) {
      setError(translateClerkError(err, lang));
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. ВХОД В АККАУНТ (Почта или Логин + Пароль)
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    if (!signInLoaded || !signIn) return;

    const rawId = identifier.trim();
    if (!rawId) {
      setError(
        t(
          'Введите вашу электронную почту или логин.',
          'Please enter your email or username.'
        )
      );
      return;
    }
    if (!password) {
      setError(t('Введите пароль.', 'Please enter your password.'));
      return;
    }

    setIsSubmitting(true);
    try {
      if (clerk.session) {
        await clerk.signOut();
      }

      // Если пользователь ввёл логин (без @), проверяем привязанную почту
      const resolvedIdentifier = await resolveEmailFromIdentifier(rawId);

      let res;
      try {
        res = await signIn.create({
          identifier: rawId,
          password,
        });
      } catch (firstErr) {
        if (resolvedIdentifier !== rawId.toLowerCase()) {
          res = await signIn.create({
            identifier: resolvedIdentifier,
            password,
          });
        } else {
          throw firstErr;
        }
      }

      if (res.status === 'needs_first_factor') {
        res = await signIn.attemptFirstFactor({
          strategy: 'password',
          password,
        });
      }

      // Если Clerk требует подтверждение входа кодом с почты (Client Trust / 2FA)
      if (
        res.status === 'needs_second_factor' ||
        res.status === 'needs_first_factor'
      ) {
        await signIn.prepareSecondFactor?.({
          strategy: 'email_code',
        }).catch(async () => {
          const emailFactor = res.supportedFirstFactors?.find(
            (f) => f.strategy === 'email_code'
          ) as { emailAddressId?: string } | undefined;
          if (emailFactor?.emailAddressId) {
            await signIn.prepareFirstFactor({
              strategy: 'email_code',
              emailAddressId: emailFactor.emailAddressId,
            });
          }
        });
        setCode('');
        setSigninStep('verify2fa');
        setSuccessMsg(
          t(
            'Для защиты аккаунта мы отправили код подтверждения входа на вашу почту.',
            'We sent a sign-in verification code to your email.'
          )
        );
        return;
      }

      if (res.status === 'complete' && res.createdSessionId) {
        const usedEmail = resolvedIdentifier.includes('@')
          ? resolvedIdentifier
          : '';
        const usedUser = !rawId.includes('@')
          ? rawId
          : getUsernameByEmail(usedEmail) || undefined;
        await finalizeClerkLogin(
          res.createdSessionId,
          setActiveSignIn,
          usedEmail,
          usedUser
        );
      } else {
        setError(
          t(
            'Не удалось завершить вход. Проверьте почту/логин и пароль.',
            'Could not complete sign in. Please check your credentials.'
          )
        );
      }
    } catch (err) {
      setError(translateClerkError(err, lang));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Подтверждение кода при входе (если Clerk включил Client Trust)
  const handleSignInVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    if (!signInLoaded || !signIn) return;

    const cleanCode = code.trim();
    if (cleanCode.length < 6) {
      setError(
        t('Введите 6-значный код из письма.', 'Enter the 6-digit email code.')
      );
      return;
    }

    setIsSubmitting(true);
    try {
      let res;
      if (signIn.status === 'needs_second_factor') {
        res = await signIn.attemptSecondFactor({
          strategy: 'email_code',
          code: cleanCode,
        });
      } else {
        res = await signIn.attemptFirstFactor({
          strategy: 'email_code',
          code: cleanCode,
        });
      }

      if (res.status === 'complete' && res.createdSessionId) {
        const resolved = await resolveEmailFromIdentifier(identifier);
        await finalizeClerkLogin(
          res.createdSessionId,
          setActiveSignIn,
          resolved,
          !identifier.includes('@') ? identifier : undefined
        );
      } else {
        setError(t('Неверный код подтверждения.', 'Invalid verification code.'));
      }
    } catch (err) {
      setError(translateClerkError(err, lang));
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. ЗАБЫЛ ПАРОЛЬ — Шаг 1: отправка кода сброса на почту
  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    if (!signInLoaded || !signIn) return;

    const rawInput = email.trim();
    if (!rawInput) {
      setError(
        t(
          'Введите вашу электронную почту или логин.',
          'Please enter your email address or username.'
        )
      );
      return;
    }

    setIsSubmitting(true);
    try {
      if (clerk.session) {
        await clerk.signOut();
      }

      const targetEmail = await resolveEmailFromIdentifier(rawInput);
      await signIn.create({
        strategy: 'reset_password_email_code',
        identifier: targetEmail,
      });
      setEmail(targetEmail);
      setCode('');
      setPassword('');
      setConfirmPassword('');
      setResetStep('confirm');
      setSuccessMsg(
        t(
          `Код для восстановления пароля отправлен на почту ${targetEmail}.`,
          `Password reset code sent to ${targetEmail}.`
        )
      );
    } catch (err) {
      setError(translateClerkError(err, lang));
    } finally {
      setIsSubmitting(false);
    }
  };

  // 5. ЗАБЫЛ ПАРОЛЬ — Шаг 2: ввод кода с почты и установка нового пароля
  const handleResetConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    if (!signInLoaded || !signIn) return;

    const cleanCode = code.trim();
    if (cleanCode.length < 6) {
      setError(
        t(
          'Введите 6-значный код из письма.',
          'Please enter the 6-digit code from the email.'
        )
      );
      return;
    }
    if (password.length < 8) {
      setError(
        t(
          'Новый пароль должен содержать минимум 8 символов.',
          'New password must be at least 8 characters.'
        )
      );
      return;
    }
    if (password !== confirmPassword) {
      setError(
        t(
          'Новый пароль и подтверждение пароля не совпадают.',
          'Passwords do not match.'
        )
      );
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
        await finalizeClerkLogin(
          res.createdSessionId,
          setActiveSignIn,
          email
        );
      } else {
        setError(
          t(
            'Не удалось обновить пароль. Проверьте код из письма.',
            'Could not reset password. Please check the code.'
          )
        );
      }
    } catch (err) {
      setError(translateClerkError(err, lang));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendResetCode = async () => {
    resetMessages();
    if (!signInLoaded || !signIn) return;
    setIsSubmitting(true);
    try {
      const targetEmail = await resolveEmailFromIdentifier(email);
      await signIn.create({
        strategy: 'reset_password_email_code',
        identifier: targetEmail,
      });
      setSuccessMsg(
        t(
          `Новый код восстановления отправлен на ${targetEmail}.`,
          `A new reset code has been sent to ${targetEmail}.`
        )
      );
    } catch (err) {
      setError(translateClerkError(err, lang));
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
            onClick={() => {
              resetMessages();
              setSignupStep('form');
              setMode('signup');
            }}
          >
            <UserPlus size={14} /> {t('Регистрация', 'Sign Up')}
          </button>
          <button
            type="button"
            className={`mode-tab ${mode === 'signin' ? 'active' : ''}`}
            onClick={() => {
              resetMessages();
              setSigninStep('form');
              setMode('signin');
            }}
          >
            <LogIn size={14} /> {t('Вход', 'Sign In')}
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
            <KeyRound size={14} /> {t('Забыл пароль', 'Forgot Password')}
          </button>
        </div>

        {/* Контейнер для защитного виджета Clerk CAPTCHA при необходимости */}
        <div id="clerk-captcha" />

        {/* === РЕГИСТРАЦИЯ: ШАГ 1 (ЛОГИН + ПОЧТА + ПАРОЛЬ) === */}
        {mode === 'signup' && signupStep === 'form' && (
          <form className="auth-form" onSubmit={handleSignUpStart}>
            <p className="auth-helper-text">
              {t(
                'Укажите ваш логин, электронную почту и пароль. Мы отправим 6-значный код подтверждения на вашу почту.',
                'Enter your username, email, and password. We will send a 6-digit verification code to your email.'
              )}
            </p>

            <div>
              <label className="mini-label font-mono">
                {t('Логин', 'Username')}
              </label>
              <input
                type="text"
                className="input-field"
                placeholder={t('Ваш логин', 'Your username')}
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div>
              <label className="mini-label font-mono">
                {t('Электронная почта', 'Email Address')}
              </label>
              <input
                type="email"
                className="input-field"
                placeholder={t('Ваша почта', 'Your email')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="mini-label font-mono">
                {t('Пароль (минимум 8 символов)', 'Password (min 8 characters)')}
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
              {isSubmitting
                ? t('Отправляем код на почту...', 'Sending code to email...')
                : t('Получить код на почту', 'Send Verification Code')}
            </button>
          </form>
        )}

        {/* === РЕГИСТРАЦИЯ: ШАГ 2 (ВВОД КОДА С ПОЧТЫ) === */}
        {mode === 'signup' && signupStep === 'verify' && (
          <form className="auth-form" onSubmit={handleSignUpVerify}>
            <p className="auth-helper-text">
              {t(
                `Введите 6-значный код, отправленный на почту ${email}.`,
                `Enter the 6-digit verification code sent to ${email}.`
              )}
            </p>

            <div>
              <label className="mini-label font-mono">
                {t('Код подтверждения из письма', 'Verification Code')}
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
              {isSubmitting
                ? t('Проверяем код...', 'Verifying code...')
                : t(
                    'Подтвердить и создать дневник',
                    'Verify & Create Diary'
                  )}
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
                <ArrowLeft size={14} /> {t('Изменить данные', 'Change details')}
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={handleResendSignUpCode}
                disabled={isSubmitting}
              >
                <RefreshCw size={14} />{' '}
                {t('Отправить код повторно', 'Resend code')}
              </button>
            </div>
          </form>
        )}

        {/* === ВХОД В АККАУНТ: ШАГ 1 (ПОЧТА ИЛИ ЛОГИН + ПАРОЛЬ) === */}
        {mode === 'signin' && signinStep === 'form' && (
          <form className="auth-form" onSubmit={handleSignIn}>
            <p className="auth-helper-text">
              {t(
                'Введите вашу электронную почту или логин и пароль от дневника.',
                'Enter your email address or username and password.'
              )}
            </p>

            <div>
              <label className="mini-label font-mono">
                {t('Электронная почта или логин', 'Email or Username')}
              </label>
              <input
                type="text"
                className="input-field"
                placeholder={t('Ваша почта или логин', 'Your email or username')}
                autoFocus
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
              />
            </div>

            <div>
              <div className="auth-label-row">
                <label className="mini-label font-mono">
                  {t('Пароль', 'Password')}
                </label>
                <button
                  type="button"
                  className="auth-forgot-link font-mono"
                  onClick={() => {
                    resetMessages();
                    if (identifier.trim()) {
                      setEmail(identifier.trim());
                    }
                    setResetStep('request');
                    setMode('reset');
                  }}
                >
                  {t('Забыли пароль?', 'Forgot password?')}
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
              {isSubmitting
                ? t('Открываем дневник...', 'Signing in...')
                : t('Войти в дневник', 'Sign In')}
            </button>
          </form>
        )}

        {/* === ВХОД В АККАУНТ: ШАГ 2 (КОД С ПОЧТЫ ПРИ ЗАЩИТЕ ВХОДА) === */}
        {mode === 'signin' && signinStep === 'verify2fa' && (
          <form className="auth-form" onSubmit={handleSignInVerify2FA}>
            <p className="auth-helper-text">
              {t(
                'Введите 6-значный код подтверждения входа, который пришёл на вашу почту.',
                'Enter the 6-digit verification code sent to your email.'
              )}
            </p>

            <div>
              <label className="mini-label font-mono">
                {t('Код из письма', 'Email Code')}
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
              {isSubmitting
                ? t('Проверяем...', 'Verifying...')
                : t('Подтвердить вход', 'Confirm Sign In')}
            </button>

            <div className="auth-sub-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  resetMessages();
                  setSigninStep('form');
                }}
              >
                <ArrowLeft size={14} /> {t('Назад', 'Back')}
              </button>
            </div>
          </form>
        )}

        {/* === ЗАБЫЛ ПАРОЛЬ: ШАГ 1 (ВВОД ПОЧТЫ ИЛИ ЛОГИНА ДЛЯ ПОЛУЧЕНИЯ КОДА) === */}
        {mode === 'reset' && resetStep === 'request' && (
          <form className="auth-form" onSubmit={handleResetRequest}>
            <p className="auth-helper-text">
              {t(
                'Укажите вашу электронную почту (или логин). Мы отправим на почту 6-значный код, чтобы вы могли поменять пароль.',
                'Enter your email address (or username). We will send a 6-digit code to your email to reset your password.'
              )}
            </p>

            <div>
              <label className="mini-label font-mono">
                {t('Электронная почта или логин', 'Email or Username')}
              </label>
              <input
                type="text"
                className="input-field"
                placeholder={t('Ваша почта или логин', 'Your email or username')}
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
              {isSubmitting
                ? t('Отправляем код...', 'Sending code...')
                : t('Отправить код на почту', 'Send Reset Code')}
            </button>
          </form>
        )}

        {/* === ЗАБЫЛ ПАРОЛЬ: ШАГ 2 (КОД С ПОЧТЫ + НОВЫЙ ПАРОЛЬ) === */}
        {mode === 'reset' && resetStep === 'confirm' && (
          <form className="auth-form" onSubmit={handleResetConfirm}>
            <p className="auth-helper-text">
              {t(
                `Введите 6-значный код из письма, отправленного на ${email}, и задайте новый пароль.`,
                `Enter the 6-digit code sent to ${email} and choose a new password.`
              )}
            </p>

            <div>
              <label className="mini-label font-mono">
                {t('Код из письма (6 цифр)', '6-Digit Email Code')}
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
                {t(
                  'Новый пароль (минимум 8 символов)',
                  'New Password (min 8 characters)'
                )}
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
                {t('Повторите новый пароль', 'Confirm New Password')}
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
              {isSubmitting
                ? t('Сохраняем пароль...', 'Saving password...')
                : t('Сменить пароль и войти', 'Change Password & Sign In')}
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
                <ArrowLeft size={14} />{' '}
                {t('Указать другую почту', 'Use another email')}
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={handleResendResetCode}
                disabled={isSubmitting}
              >
                <RefreshCw size={14} />{' '}
                {t('Отправить код повторно', 'Resend code')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
