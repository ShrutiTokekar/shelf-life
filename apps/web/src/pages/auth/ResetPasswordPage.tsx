import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../../components/Button/Button';
import { ErrorState } from '../../components/ErrorState/ErrorState';
import { AuthError, resetPassword } from '../../lib/authApi';
import { useOnlineStatus } from '../../lib/useOnlineStatus';
import { AuthLayout, ButtonLink, Field, PASSWORD_MIN } from './AuthLayout';

/** The page the reset email links to (Milestone 9b): choose a new password. */
export function ResetPasswordPage() {
  const { t } = useTranslation();
  const online = useOnlineStatus();
  const [params] = useSearchParams();
  const token = params.get('token');
  const [password, setPassword] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<'form' | 'done' | 'expired'>(
    token && !params.get('error') ? 'form' : 'expired',
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < PASSWORD_MIN) return setFieldError(t('auth.errors.passwordShort'));
    setFieldError(null);
    setBusy(true);
    try {
      await resetPassword(token!, password);
      setState('done');
    } catch (err) {
      const code = err instanceof AuthError ? err.code : 'unknown';
      if (code === 'invalid_token') setState('expired');
      else if (code === 'breached_password') setFieldError(t('auth.errors.breached'));
      else if (code === 'weak_password') setFieldError(t('auth.errors.passwordShort'));
      else
        setError(t(`auth.errors.${code === 'too_many' || code === 'network' ? code : 'unknown'}`));
    } finally {
      setBusy(false);
    }
  }

  if (state === 'expired')
    return (
      <AuthLayout title={t('auth.reset.expiredTitle')} intro={t('auth.reset.expired')}>
        <ButtonLink to="/forgot-password" variant="primary">
          {t('auth.reset.again')}
        </ButtonLink>
      </AuthLayout>
    );

  if (state === 'done')
    return (
      <AuthLayout title={t('auth.reset.doneTitle')} intro={t('auth.reset.done')}>
        <ButtonLink to="/sign-in" variant="primary">
          {t('auth.signIn.submit')}
        </ButtonLink>
      </AuthLayout>
    );

  return (
    <AuthLayout title={t('auth.reset.title')}>
      <form noValidate onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-6">
        <Field
          label={t('auth.newPassword')}
          password
          name="password"
          autoComplete="new-password"
          maxLength={128}
          hint={t('auth.signUp.passwordHint')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldError}
        />
        {error ? <ErrorState message={error} /> : null}
        <Button type="submit" fullWidth loading={busy} disabled={!online}>
          {t('auth.reset.submit')}
        </Button>
      </form>
    </AuthLayout>
  );
}
