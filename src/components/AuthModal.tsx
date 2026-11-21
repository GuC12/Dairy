import React, { useEffect, useState } from 'react';
import { useUser } from '@clerk/react';
import { useSignIn, useSignUp } from '@clerk/react/legacy';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  LogIn,
  Mail,
  RefreshCw,
  ShieldCheck,
  User,
  UserPlus,
  X,
} from 'lucide-react';
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
  const { isLoaded: isSignUpLoaded, signUp, setActive: setSignUpActive } = useSignUp();
  const { isLoaded: isSignInLoaded, signIn, setActive: setSignInActive } = useSignIn();

  // Mode: signin | signup | reset
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>(initialMode);

  // Sign up fields
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [signupStep, setSignupStep] = useState<'form' | 'verify'>('form');
  const [regVerifyCode, setRegVerifyCode] = useState('');

  // Sign in fields
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Forgot password fields
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [resetStep, setResetStep] = useState<'request' | 'verify'>('request');
  const [resetCode, setResetCode] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);

  // Status & errors
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Автоматически закрываем окно, как только пользователь вошёл
  useEffect(() => {
    if (isSignedIn) {
      onClose();
    }
  }, [isSignedIn, onClose]);

  const clearMessages = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleSwitchMode = (nextMode: 'signin' | 'signup' | 'reset') => {
    setMode(nextMode);
    clearMessages();
  };

  const parseErrorMessage = (err: unknown): string => {
    if (!err) return '';
    const errObj = err as {
      errors?: Array<{ code?: string; message?: string; longMessage?: string }>;
      message?: string;
    };
    const first = errObj.errors?.[0];
    const code = first?.code || '';
    const msg = (first?.longMessage || first?.message || errObj.message || '').toLowerCase();

    if (code === 'form_password_length_too_short' || msg.includes('at least') || msg.includes('length')) {
      return t(
        'Пароль слишком короткий. Минимальная длина: 8 символов.',
        'Password is too short. Minimum length: 8 characters.'
      );
    }
    if (code === 'form_password_pwned' || msg.includes('pwned') || msg.includes('compromised')) {
      return t(
        'Этот пароль слишком простой или скомпрометирован. Придумайте более надёжный пароль.',
        'This password is too common or compromised. Please choose a stronger password.'
      );
    }
    if (
      code === 'form_identifier_not_found' ||
      msg.includes("couldn't find") ||
      msg.includes('not found')
    ) {
      return t(
        'Аккаунт с таким логином или почтой не найден.',
        'Account with this username or email was not found.'
      );
    }
    if (
      code === 'form_password_incorrect' ||
      msg.includes('incorrect password') ||
      msg.includes('password is incorrect')
    ) {
      return t(
        'Неверный пароль. Пожалуйста, проверьте введённые данные.',
        'Incorrect password. Please verify your credentials and try again.'
      );
    }
    if (
      code === 'form_code_incorrect' ||
      msg.includes('incorrect') ||
      msg.includes('verification code')
    ) {
      return t(
        'Неверный код из письма. Проверьте 6 цифр и попробуйте снова.',
        'Incorrect verification code. Please check the 6 digits and try again.'
      );
    }
    if (
      code === 'form_identifier_exists' ||
      msg.includes('already taken') ||
      msg.includes('already exists')
    ) {
      return t(
        'Пользователь с таким логином или почтой уже зарегистрирован.',
        'A user with this username or email already exists.'
      );
    }
    if (code === 'form_username_invalid_character') {
      return t(
        'Имя пользователя может содержать только латинские буквы, цифры и знаки _',
        'Username can only contain Latin letters, numbers, and _'
      );
    }
    if (code === 'form_param_format_invalid') {
      return t(
        'Неверный формат адреса электронной почты.',
        'Invalid email address format.'
      );
    }

    return (
      first?.longMessage ||
      first?.message ||
      errObj.message ||
      t('Не удалось выполнить запрос. Проверьте данные и попробуйте ещё раз.', 'Request failed. Please check the entered data.')
    );
  };

  // 1. Регистрация: отправка формы
  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    const cleanUser = regUsername.replace(/^@+/, '').trim();
    const cleanMail = regEmail.trim();

    if (!cleanUser) {
      setErrorMsg(t('Введите имя пользователя.', 'Please enter a username.'));
      return;
    }
    if (cleanUser.length < 4) {
      setErrorMsg(
        t('Имя пользователя должно содержать не менее 4 символов.', 'Username must be at least 4 characters long.')
      );
      return;
    }
    if (!cleanMail || !cleanMail.includes('@')) {
      setErrorMsg(
        t('Введите корректный адрес электронной почты.', 'Please enter a valid email address.')
      );
      return;
    }
    if (regPassword.length < 8) {
      setErrorMsg(
        t('Пароль должен содержать не менее 8 символов.', 'Password must be at least 8 characters long.')
      );
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setErrorMsg(t('Пароли не совпадают.', 'Passwords do not match.'));
      return;
    }

    if (!isSignUpLoaded || !signUp) {
      setErrorMsg(t('Сервис авторизации загружается...', 'Auth service is loading...'));
      return;
    }

    setIsSubmitting(true);
    try {
      await signUp.create({
        username: cleanUser,
        emailAddress: cleanMail,
        password: regPassword,
      });

      // Отправляем код подтверждения на email
      await signUp.prepareEmailAddressVerification({
        strategy: 'email_code',
      });

      setSignupStep('verify');
      setSuccessMsg(
        t(
          `Код подтверждения отправлен на ${cleanMail}. Введите его ниже.`,
          `Verification code sent to ${cleanMail}. Enter it below.`
        )
      );
    } catch (err) {
      setErrorMsg(parseErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Регистрация: ввод проверочного кода
  const handleVerifyEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    const code = regVerifyCode.trim();
    if (!code) {
      setErrorMsg(t('Введите 6-значный код из письма.', 'Enter the 6-digit code from the email.'));
      return;
    }

    if (!isSignUpLoaded || !signUp) return;

    setIsSubmitting(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === 'complete') {
        if (setSignUpActive) {
          await setSignUpActive({ session: result.createdSessionId });
        }
        onClose();
      } else {
        setErrorMsg(
          t('Не удалось завершить регистрацию. Попробуйте ещё раз.', 'Could not complete registration. Please try again.')
        );
      }
    } catch (err) {
      setErrorMsg(parseErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Повторная отправка кода регистрации
  const handleResendSignUpCode = async () => {
    if (!isSignUpLoaded || !signUp) return;
    clearMessages();
    setIsSubmitting(true);
    try {
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setSuccessMsg(t('Новый код отправлен на вашу почту.', 'A new code has been sent to your email.'));
    } catch (err) {
      setErrorMsg(parseErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Вход в аккаунт
  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    const id = loginIdentifier.replace(/^@+/, '').trim();
    if (!id) {
      setErrorMsg(
        t('Введите имя пользователя или почту.', 'Enter your username or email.')
      );
      return;
    }
    if (!loginPassword) {
      setErrorMsg(t('Введите пароль.', 'Enter your password.'));
      return;
    }

    if (!isSignInLoaded || !signIn) {
      setErrorMsg(t('Сервис авторизации загружается...', 'Auth service is loading...'));
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await signIn.create({
        identifier: id,
        password: loginPassword,
      });

      if (result.status === 'complete') {
        if (setSignInActive) {
          await setSignInActive({ session: result.createdSessionId });
        }
        onClose();
      } else {
        setErrorMsg(
          t('Требуется дополнительное подтверждение аккаунта.', 'Additional account verification required.')
        );
      }
    } catch (err) {
      setErrorMsg(parseErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. Забыл пароль: запрос кода
  const handleResetRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    const id = resetIdentifier.replace(/^@+/, '').trim();
    if (!id) {
      setErrorMsg(
        t('Введите имя пользователя или почту.', 'Enter your username or email.')
      );
      return;
    }

    if (!isSignInLoaded || !signIn) return;

    setIsSubmitting(true);
    try {
      await signIn.create({
        strategy: 'reset_password_email_code',
        identifier: id,
      });
      setResetStep('verify');
      setSuccessMsg(
        t(
          'Код для смены пароля отправлен на почту. Введите его ниже.',
          'Password reset code sent to your email. Enter it below.'
        )
      );
    } catch (err) {
      setErrorMsg(parseErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // 5. Забыл пароль: ввод кода и нового пароля
  const handleResetVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    const code = resetCode.trim();
    if (!code) {
      setErrorMsg(t('Введите код из письма.', 'Enter the code from the email.'));
      return;
    }
    if (resetNewPassword.length < 8) {
      setErrorMsg(
        t('Пароль должен содержать не менее 8 символов.', 'Password must be at least 8 characters long.')
      );
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      setErrorMsg(t('Пароли не совпадают.', 'Passwords do not match.'));
      return;
    }

    if (!isSignInLoaded || !signIn) return;

    setIsSubmitting(true);
    try {
      const result = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code,
        password: resetNewPassword,
      });

      if (result.status === 'complete') {
        if (setSignInActive) {
          await setSignInActive({ session: result.createdSessionId });
        }
        onClose();
      } else {
        setErrorMsg(
          t('Не удалось сменить пароль. Попробуйте ещё раз.', 'Could not reset password. Please try again.')
        );
      }
    } catch (err) {
      setErrorMsg(parseErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <div
        className="lightbox-box auth-modal-box auth-custom-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="lightbox-head font-mono">
          <span className="tapestry-head-title">
            <ShieldCheck size={16} />{' '}
            {t('ЛИЧНЫЙ АККАУНТ ДНЕВНИКА', 'PERSONAL DIARY ACCOUNT')}
          </span>
          <button type="button" className="btn-ghost" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* Табы режимов */}
        <div className="auth-mode-tabs font-mono">
          <button
            type="button"
            className={`mode-tab ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => handleSwitchMode('signup')}
          >
            <UserPlus size={14} /> {t('Регистрация', 'Sign Up')}
          </button>
          <button
            type="button"
            className={`mode-tab ${mode === 'signin' ? 'active' : ''}`}
            onClick={() => handleSwitchMode('signin')}
          >
            <LogIn size={14} /> {t('Вход', 'Sign In')}
          </button>
          <button
            type="button"
            className={`mode-tab ${mode === 'reset' ? 'active' : ''}`}
            onClick={() => handleSwitchMode('reset')}
          >
            <KeyRound size={14} /> {t('Забыл пароль', 'Forgot Password')}
          </button>
        </div>

        {/* Уведомления */}
        {errorMsg && (
          <div className="auth-alert auth-alert-error font-mono">
            <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="auth-alert auth-alert-success font-mono">
            <CheckCircle2 size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ФОРМА 1: РЕГИСТРАЦИЯ */}
        {mode === 'signup' && (
          <div>
            {signupStep === 'form' ? (
              <form onSubmit={handleSignUpSubmit} className="auth-form-body">
                <div className="auth-field">
                  <label className="auth-label font-mono">
                    {t('Имя пользователя', 'Username')}
                  </label>
                  <div className="auth-input-wrap">
                    <User size={15} className="auth-input-icon" />
                    <input
                      type="text"
                      className="input-field auth-input-with-icon"
                      placeholder={t('Логин', 'Username')}
                      value={regUsername}
                      onChange={(e) => setRegUsername(e.target.value.replace(/^@+/, ''))}
                      autoComplete="username"
                      required
                    />
                  </div>
                  <span className="auth-hint font-mono">
                    {t('От 4 символов, латинские буквы и цифры', 'Min 4 characters, letters and numbers')}
                  </span>
                </div>

                <div className="auth-field">
                  <label className="auth-label font-mono">
                    {t('Электронная почта', 'Email')}
                  </label>
                  <div className="auth-input-wrap">
                    <Mail size={15} className="auth-input-icon" />
                    <input
                      type="email"
                      className="input-field auth-input-with-icon"
                      placeholder={t('Адрес почты', 'Email address')}
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      autoComplete="email"
                      required
                    />
                  </div>
                  <span className="auth-hint font-mono">
                    {t('Сюда придёт код подтверждения', 'A verification code will be sent here')}
                  </span>
                </div>

                <div className="auth-field">
                  <label className="auth-label font-mono">
                    {t('Пароль', 'Password')}
                  </label>
                  <div className="auth-input-wrap">
                    <Lock size={15} className="auth-input-icon" />
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      className="input-field auth-input-with-icon"
                      placeholder="••••••••••••"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      className="auth-eye-btn"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      tabIndex={-1}
                    >
                      {showRegPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  <span className="auth-hint font-mono">
                    {t('Минимум 8 символов', 'Minimum 8 characters')}
                  </span>
                </div>

                <div className="auth-field">
                  <label className="auth-label font-mono">
                    {t('Повторите пароль', 'Confirm Password')}
                  </label>
                  <div className="auth-input-wrap">
                    <Lock size={15} className="auth-input-icon" />
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      className="input-field auth-input-with-icon"
                      placeholder="••••••••••••"
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn-primary auth-submit-btn font-mono"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      {t('Создаём аккаунт...', 'Creating account...')}
                    </>
                  ) : (
                    <>
                      <UserPlus size={16} />
                      {t('Зарегистрироваться', 'Sign Up')}
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyEmailSubmit} className="auth-form-body">
                <div className="auth-step-desc font-mono">
                  {t(
                    `На почту ${regEmail} отправлен 6-значный код подтверждения. Введите его для завершения регистрации.`,
                    `A 6-digit confirmation code has been sent to ${regEmail}. Enter it below to complete registration.`
                  )}
                </div>

                <div className="auth-field">
                  <label className="auth-label font-mono">
                    {t('Код из письма', 'Code from Email')}
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    className="input-field auth-code-input font-mono"
                    placeholder="••••••"
                    value={regVerifyCode}
                    onChange={(e) => setRegVerifyCode(e.target.value.replace(/\D/g, ''))}
                    required
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  className="btn-primary auth-submit-btn font-mono"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      {t('Проверяем...', 'Verifying...')}
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      {t('Подтвердить и войти', 'Verify & Sign In')}
                    </>
                  )}
                </button>

                <div className="auth-sub-actions font-mono">
                  <button
                    type="button"
                    className="btn-ghost auth-link-btn"
                    onClick={() => setSignupStep('form')}
                  >
                    <ArrowLeft size={13} /> {t('Изменить данные', 'Edit details')}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost auth-link-btn"
                    onClick={handleResendSignUpCode}
                    disabled={isSubmitting}
                  >
                    <RefreshCw size={13} /> {t('Отправить код ещё раз', 'Resend code')}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ФОРМА 2: ВХОД В АККАУНТ */}
        {mode === 'signin' && (
          <form onSubmit={handleSignInSubmit} className="auth-form-body">
            <div className="auth-field">
              <label className="auth-label font-mono">
                {t('Имя пользователя или почта', 'Username or Email')}
              </label>
              <div className="auth-input-wrap">
                <User size={15} className="auth-input-icon" />
                <input
                  type="text"
                  className="input-field auth-input-with-icon"
                  placeholder={t('Логин или почта', 'Username or email')}
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value.replace(/^@+/, ''))}
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div className="auth-field">
              <div className="auth-label-row">
                <label className="auth-label font-mono">
                  {t('Пароль', 'Password')}
                </label>
                <button
                  type="button"
                  className="auth-forgot-link font-mono"
                  onClick={() => handleSwitchMode('reset')}
                >
                  {t('Забыли пароль?', 'Forgot password?')}
                </button>
              </div>
              <div className="auth-input-wrap">
                <Lock size={15} className="auth-input-icon" />
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  className="input-field auth-input-with-icon"
                  placeholder="••••••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="auth-eye-btn"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  tabIndex={-1}
                >
                  {showLoginPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary auth-submit-btn font-mono"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {t('Входим...', 'Signing in...')}
                </>
              ) : (
                <>
                  <LogIn size={16} />
                  {t('Войти', 'Sign In')}
                </>
              )}
            </button>
          </form>
        )}

        {/* ФОРМА 3: ВОССТАНОВЛЕНИЕ ПАРОЛЯ */}
        {mode === 'reset' && (
          <div>
            {resetStep === 'request' ? (
              <form onSubmit={handleResetRequestSubmit} className="auth-form-body">
                <div className="auth-step-desc font-mono">
                  {t(
                    'Введите ваше имя пользователя или почту. Мы вышлем проверочный код для создания нового пароля.',
                    'Enter your username or email. We will send a verification code to set a new password.'
                  )}
                </div>

                <div className="auth-field">
                  <label className="auth-label font-mono">
                    {t('Имя пользователя или почта', 'Username or Email')}
                  </label>
                  <div className="auth-input-wrap">
                    <User size={15} className="auth-input-icon" />
                    <input
                      type="text"
                      className="input-field auth-input-with-icon"
                      placeholder={t('Логин или почта', 'Username or email')}
                      value={resetIdentifier}
                      onChange={(e) => setResetIdentifier(e.target.value.replace(/^@+/, ''))}
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn-primary auth-submit-btn font-mono"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      {t('Отправка...', 'Sending...')}
                    </>
                  ) : (
                    <>
                      <Mail size={16} />
                      {t('Получить код на почту', 'Send Code to Email')}
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetVerifySubmit} className="auth-form-body">
                <div className="auth-step-desc font-mono">
                  {t(
                    'Код отправлен на вашу почту. Введите полученный код и укажите новый пароль.',
                    'Code sent to your email. Enter the code and set a new password.'
                  )}
                </div>

                <div className="auth-field">
                  <label className="auth-label font-mono">
                    {t('Код из письма', 'Code from Email')}
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    className="input-field auth-code-input font-mono"
                    placeholder="••••••"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ''))}
                    required
                    autoFocus
                  />
                </div>

                <div className="auth-field">
                  <label className="auth-label font-mono">
                    {t('Новый пароль', 'New Password')}
                  </label>
                  <div className="auth-input-wrap">
                    <Lock size={15} className="auth-input-icon" />
                    <input
                      type={showResetPassword ? 'text' : 'password'}
                      className="input-field auth-input-with-icon"
                      placeholder="••••••••••••"
                      value={resetNewPassword}
                      onChange={(e) => setResetNewPassword(e.target.value)}
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      className="auth-eye-btn"
                      onClick={() => setShowResetPassword(!showResetPassword)}
                      tabIndex={-1}
                    >
                      {showResetPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  <span className="auth-hint font-mono">
                    {t('Минимум 8 символов', 'Minimum 8 characters')}
                  </span>
                </div>

                <div className="auth-field">
                  <label className="auth-label font-mono">
                    {t('Повторите новый пароль', 'Confirm New Password')}
                  </label>
                  <div className="auth-input-wrap">
                    <Lock size={15} className="auth-input-icon" />
                    <input
                      type={showResetPassword ? 'text' : 'password'}
                      className="input-field auth-input-with-icon"
                      placeholder="••••••••••••"
                      value={resetConfirmPassword}
                      onChange={(e) => setResetConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn-primary auth-submit-btn font-mono"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      {t('Сохраняем пароль...', 'Saving password...')}
                    </>
                  ) : (
                    <>
                      <KeyRound size={16} />
                      {t('Сменить пароль и войти', 'Reset Password & Sign In')}
                    </>
                  )}
                </button>

                <div className="auth-sub-actions font-mono">
                  <button
                    type="button"
                    className="btn-ghost auth-link-btn"
                    onClick={() => setResetStep('request')}
                  >
                    <ArrowLeft size={13} /> {t('Назад', 'Back')}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
