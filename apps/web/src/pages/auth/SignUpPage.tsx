import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate } from 'react-router-dom';
import { Button } from '../../components/Button/Button';
import { ErrorState } from '../../components/ErrorState/ErrorState';
import { AuthError, resendVerification, signUpWithEmail } from '../../lib/authApi';
import { useSession } from '../../lib/session';
import { useOnlineStatus } from '../../lib/useOnlineStatus';
import { AuthLayout, ButtonLink, EMAIL_RE, Field, PASSWORD_MIN } from './AuthLayout';

/** Create an account with email and password (Milestone 9b). The address is confirmed by link. */
export function SignUpPage() {
  const { t } = useTranslation();
  const session = useSession();
  const online = useOnlineStatus();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  if (session.status === 'ready') return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next = {
      name: name.trim() ? undefined : t('auth.errors.name'),
      email: EMAIL_RE.test(email.trim()) ? undefined : t('auth.errors.email'),
      password: password.length >= PASSWORD_MIN ? undefined : t('auth.errors.passwordShort'),
    };
    setErrors(next);
    setError(null);
    if (next.name || next.email || next.password) return;
    setBusy(true);
    try {
      await signUpWithEmail({ name: name.trim(), email: email.trim(), password });
      setSentTo(email.trim());
    } catch (err) {
      const code = err instanceof AuthError ? err.code : 'unknown';
      if (code === 'breached_password') setErrors({ password: t('auth.errors.breached') });
      else if (code === 'weak_password') setErrors({ password: t('auth.errors.passwordShort') });
      else
        setError(t(`auth.errors.${code === 'too_many' || code === 'network' ? code : 'unknown'}`));
    } finally {
      setBusy(false);
    }
  }

  if (sentTo)
    return (
      <AuthLayout
        title={t('auth.checkEmail.title')}
        intro={t('auth.checkEmail.body', { email: sentTo })}
      >
        <div className="flex flex-col gap-4">
          <p className="text-secondary">{t('auth.checkEmail.spam')}</p>
          {resent ? (
            <p role="status" className="text-ink">
              {t('auth.checkEmail.resent')}
            </p>
          ) : null}
          <Button
            variant="secondary"
            fullWidth
            disabled={!online}
            onClick={() => {
              void resendVerification(sentTo)
                .then(() => setResent(true))
                .catch(() => setError(t('auth.errors.unknown')));
            }}
          >
            {t('auth.checkEmail.resend')}
          </Button>
          {error ? <ErrorState message={error} /> : null}
          <ButtonLink to="/sign-in" variant="ghost">
            {t('auth.checkEmail.toSignIn')}
          </ButtonLink>
        </div>
      </AuthLayout>
    );

  return (
    <AuthLayout title={t('auth.signUp.title')} intro={t('auth.signUp.intro')}>
      <form noValidate onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-6">
        <Field
          label={t('auth.name')}
          name="name"
          autoComplete="name"
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
        />
        <Field
          label={t('auth.email')}
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />
        <Field
          label={t('auth.password')}
          password
          name="password"
          autoComplete="new-password"
          maxLength={128}
          hint={t('auth.signUp.passwordHint')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />
        <p className="text-sm text-secondary">{t('auth.signUp.privacy')}</p>
        {error ? <ErrorState message={error} /> : null}
        <Button type="submit" fullWidth loading={busy} disabled={!online}>
          {t('auth.signUp.submit')}
        </Button>
        <p className="text-center text-secondary">
          {t('auth.signUp.have')}{' '}
          <Link to="/sign-in" className="font-semibold text-navy underline underline-offset-4">
            {t('auth.signUp.signIn')}
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
