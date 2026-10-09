import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button/Button';
import { ErrorState } from '../../components/ErrorState/ErrorState';
import { AuthError, requestPasswordReset } from '../../lib/authApi';
import { useOnlineStatus } from '../../lib/useOnlineStatus';
import { AuthLayout, ButtonLink, EMAIL_RE, Field } from './AuthLayout';

/** Forgot password (Milestone 9b). The same answer whether or not the address has an account. */
export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const online = useOnlineStatus();
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!EMAIL_RE.test(email.trim())) return setFieldError(t('auth.errors.email'));
    setFieldError(null);
    setBusy(true);
    try {
      await requestPasswordReset(email.trim());
      setSentTo(email.trim());
    } catch (err) {
      const code = err instanceof AuthError ? err.code : 'unknown';
      setError(t(`auth.errors.${code === 'too_many' || code === 'network' ? code : 'unknown'}`));
    } finally {
      setBusy(false);
    }
  }

  if (sentTo)
    return (
      <AuthLayout
        title={t('auth.checkEmail.title')}
        intro={t('auth.forgot.sent', { email: sentTo })}
      >
        <ButtonLink to="/sign-in">{t('auth.checkEmail.toSignIn')}</ButtonLink>
      </AuthLayout>
    );

  return (
    <AuthLayout title={t('auth.forgot.title')} intro={t('auth.forgot.intro')}>
      <form noValidate onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-6">
        <Field
          label={t('auth.email')}
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldError}
        />
        {error ? <ErrorState message={error} /> : null}
        <Button type="submit" fullWidth loading={busy} disabled={!online}>
          {t('auth.forgot.submit')}
        </Button>
        <ButtonLink to="/sign-in" variant="ghost">
          {t('auth.checkEmail.toSignIn')}
        </ButtonLink>
      </form>
    </AuthLayout>
  );
}
