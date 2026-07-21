/**
 * דף התחברות/הרשמה
 * תומך ב-Email/Password ו-Google Sign In
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button, Input } from '@/components/common';
import { isValidEmail, isValidPassword } from '@/utils/validators';
import { logger } from '@/utils/logger';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { signIn, signUp, signInWithGoogle, error: authError, isAuthenticated } = useAuth();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // שגיאות ולידציה
  const [errors, setErrors] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    displayName: '',
  });

  /**
   * ולידציה של טופס
   */
  const validate = (): boolean => {
    const newErrors = {
      email: '',
      password: '',
      confirmPassword: '',
      displayName: '',
    };

    if (!isValidEmail(email)) {
      newErrors.email = 'כתובת אימייל לא תקינה';
    }

    if (!isValidPassword(password)) {
      newErrors.password = 'הסיסמה חייבת להכיל לפחות 6 תווים';
    }

    if (mode === 'signup') {
      if (displayName.trim().length < 2) {
        newErrors.displayName = 'השם חייב להכיל לפחות 2 תווים';
      }

      if (password !== confirmPassword) {
        newErrors.confirmPassword = 'הסיסמאות לא תואמות';
      }
    }

    setErrors(newErrors);
    return !Object.values(newErrors).some(err => err !== '');
  };

  /**
   * טיפול בשליחת טופס Email/Password
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setIsLoading(true);
    setSuccessMessage('');

    try {
      if (mode === 'signin') {
        await signIn(email, password);
      } else {
        await signUp(email, password, displayName);
        setSuccessMessage('נשלח אימייל אימות לכתובת המייל שלך. אנא בדוק את תיבת הדואר שלך.');
      }
    } catch (error) {
      logger.error('Authentication error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * טיפול בהתחברות Google
   */
  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      logger.error('Google sign-in error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * החלפה בין מצב התחברות להרשמה
   */
  const toggleMode = () => {
    setMode(mode === 'signin' ? 'signup' : 'signin');
    setErrors({ email: '', password: '', confirmPassword: '', displayName: '' });
    setSuccessMessage('');
    setConfirmPassword('');
  };

  return (
    <div className="min-h-screen bg-gradient-login flex items-center justify-center p-4">
      <div className="bg-surface-light dark:bg-surface-dark rounded-2xl shadow-e3 p-8 w-full max-w-md">
        {/* לוגו וכותרת */}
        <div className="text-center mb-8">
          <h1 className="text-display text-ink-light dark:text-ink-dark mb-2">
            📝 אפליקציית פתקים
          </h1>
          <span className="text-[9px] text-ink-3-light dark:text-ink-3-dark block -mt-2 mb-2">v{__APP_VERSION__}</span>
          <p className="text-ink-2-light dark:text-ink-2-dark">
            {mode === 'signin' ? 'התחבר לחשבון שלך' : 'צור חשבון חדש'}
          </p>
        </div>

        {/* הודעת הצלחה */}
        {successMessage && (
          <div className="mb-4 p-3 bg-success/10 border border-success/30 rounded-lg">
            <p className="text-body-sm text-success dark:text-success-dark">{successMessage}</p>
          </div>
        )}

        {/* שגיאת אימות */}
        {authError && (
          <div className="mb-4 p-3 bg-danger-soft dark:bg-danger-soft-dark border border-danger/30 rounded-lg">
            <p className="text-body-sm text-danger dark:text-danger-dark">{authError}</p>
          </div>
        )}

        {/* טופס */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* שם (רק בהרשמה) */}
          {mode === 'signup' && (
            <Input
              label="שם מלא"
              type="text"
              placeholder="הזן את שמך"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              error={errors.displayName}
              disabled={isLoading}
            />
          )}

          {/* אימייל */}
          <Input
            label="אימייל"
            type="email"
            placeholder="example@gmail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            disabled={isLoading}
          />

          {/* סיסמה */}
          <Input
            label="סיסמה"
            type="password"
            placeholder="לפחות 6 תווים"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            disabled={isLoading}
            showPasswordToggle={true}
          />

          {/* אישור סיסמה (רק בהרשמה) */}
          {mode === 'signup' && (
            <Input
              label="אישור סיסמה"
              type="password"
              placeholder="הזן שוב את הסיסמה"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={errors.confirmPassword}
              disabled={isLoading}
              showPasswordToggle={true}
            />
          )}

          {/* כפתור שליחה */}
          <Button
            type="submit"
            fullWidth
            isLoading={isLoading}
            className="mt-6"
          >
            {mode === 'signin' ? 'התחבר' : 'הרשם'}
          </Button>
        </form>

        {/* מפריד */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-hairline-light dark:border-hairline-dark"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-surface-light dark:bg-surface-dark text-ink-3-light dark:text-ink-3-dark">או</span>
          </div>
        </div>

        {/* כפתור Google - `secondary` ולא `outline`: מאז ש-`outline` הפך
            ל-ghost הוא נטול מסגרת ורקע, ופעולת התחברות מלאה נראתה כמו
            קישור. כאן צריך משקל של כפתור. */}
        <Button
          variant="secondary"
          fullWidth
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          className="flex items-center justify-center gap-3"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          <span>המשך עם Google</span>
        </Button>

        {/* החלפת מצב */}
        <div className="mt-6 text-center">
          <p className="text-body-sm text-ink-2-light dark:text-ink-2-dark">
            {mode === 'signin' ? 'עדיין אין לך חשבון?' : 'כבר יש לך חשבון?'}
            <button
              type="button"
              onClick={toggleMode}
              className="ms-1 text-brand-text dark:text-brand-text-dark font-medium hover:underline"
              disabled={isLoading}
            >
              {mode === 'signin' ? 'הירשם כעת' : 'התחבר'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
