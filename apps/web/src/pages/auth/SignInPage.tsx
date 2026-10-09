import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button/Button';
import { ErrorState } from '../../components/ErrorState/ErrorState';
import { MailIcon } from '../../components/icons';
import { AuthError, signInWithEmail } from '../../lib/authApi';
import { forgetExpired, useSession } from '../../lib/session';
import { markActive } from '../../lib/sessionTimeout';
import { useOnlineStatus } from '../../lib/useOnlineStatus';
import { AuthLayout, Field, EMAIL_RE } from './AuthLayout';

/** Sign in with email and password (Milestone 9b). */
export function SignInPage() {
  const { t } = useTranslation();
  const session = useSession();
  const navigate = useNavigate();
  const online = useOnlineStatus();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [unconfirmed, setUnconfirmed] = useState(false);

  if (session.status === 'ready') return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const errs = {
      email: EMAIL_RE.test(email.trim()) ? undefined : t('auth.errors.email'),
      password: password ? undefined : t('auth.errors.passwordMissing'),
    };
    setFieldErrors(errs);
    setError(null);
    setUnconfirmed(false);
    if (errs.email || errs.password) return;
    setBusy(true);
    try {
      markActive();
      forgetExpired();
      await signInWithEmail({ email: email.trim(), password });
      await session.refresh();
      navigate('/', { replace: true });
    } catch (err) {
      const code = err instanceof AuthError ? err.code : 'unknown';
      if (code === 'not_verified') setUnconfirmed(true);
      else
        setError(
          t(
            `auth.errors.${code === 'invalid_credentials' || code === 'too_many' || code === 'network' ? code : 'unknown'}`,
          ),
        );
      setBusy(false);
    }
  }

  return (
    <AuthLayout title={t('auth.signIn.title')}>
      <form noValidate onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-6">
        <Field
          label={t('auth.email')}
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldErrors.email}
        />
        <Field
          label={t('auth.password')}
          password
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
        />
        <Link
          to="/forgot-password"
          className="self-start py-2 font-semibold text-navy underline underline-offset-4"
        >
          {t('auth.signIn.forgot')}
        </Link>
        {unconfirmed ? (
          <p role="status" className="flex items-start gap-2 text-ink">
            <MailIcon size={20} className="mt-0.5 shrink-0" />
            {t('auth.signIn.unconfirmed', { email: email.trim() })}
          </p>
        ) : null}
        {error ? <ErrorState message={error} /> : null}
        <Button type="submit" fullWidth loading={busy} disabled={!online}>
          {t('auth.signIn.submit')}
        </Button>
        <p className="text-center text-secondary">
          {t('auth.signIn.new')}{' '}
          <Link to="/sign-up" className="font-semibold text-navy underline underline-offset-4">
            {t('auth.signIn.create')}
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
