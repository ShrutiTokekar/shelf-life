import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { WarnIcon } from '../../components/icons';
import { OfflineBanner } from '../../components/OfflineBanner/OfflineBanner';
import { SkipLink } from '../../components/SkipLink/SkipLink';
import { Wordmark } from '../../components/Wordmark/Wordmark';
import { cx } from '../../lib/cx';

/** The frame for sign-in, sign-up and password pages (Milestone 9b), styled like Onboarding. */
export function AuthLayout({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <>
      <SkipLink targetId="auth-form" text={t('auth.skip')} />
      <OfflineBanner />
      <main
        id="main"
        className="mx-auto flex min-h-dvh w-full max-w-[30rem] flex-col px-6 pb-11 pt-10"
      >
        <Link to="/welcome" className="self-center rounded-button" aria-label={t('auth.home')}>
          <Wordmark size={32} />
        </Link>
        <h1 className="mt-10 text-[2rem] leading-[1.125]">{title}</h1>
        {intro ? <div className="mt-3 text-[1.0625rem] text-secondary">{intro}</div> : null}
        <div id="auth-form" tabIndex={-1} className="mt-8 outline-none">
          {children}
        </div>
      </main>
    </>
  );
}

const inputClass =
  'min-h-[3.25rem] w-full rounded-button bg-white px-4 text-[1.0625rem] text-ink bordered aria-invalid:border-terra-dark';

/** A labelled field with an optional hint and inline error (A11Y: label, describedby). */
export function Field({
  label,
  hint,
  error,
  password,
  ...input
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string | null;
  /** Adds a Show/Hide button. */
  password?: boolean;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [shown, setShown] = useState(false);
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-error` : '']
    .filter(Boolean)
    .join(' ');
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="font-semibold text-ink">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          {...input}
          type={password ? (shown ? 'text' : 'password') : input.type}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={cx(inputClass, password && 'pr-24')}
        />
        {password ? (
          <button
            type="button"
            aria-pressed={shown}
            onClick={() => setShown((s) => !s)}
            className="absolute inset-y-0 right-1 my-auto min-h-11 min-w-11 rounded-button px-3 font-semibold text-navy"
          >
            {shown ? t('auth.hidePassword') : t('auth.showPassword')}
          </button>
        ) : null}
      </div>
      {hint ? (
        <p id={`${id}-hint`} className="text-sm text-secondary">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={`${id}-error`}
          className="flex items-center gap-2 text-sm font-medium text-terra-dark"
        >
          <WarnIcon size={18} />
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** A link that looks like a button (44 px target). */
export function ButtonLink({
  to,
  children,
  variant = 'secondary',
}: {
  to: string;
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
}) {
  return (
    <Link
      to={to}
      className={cx(
        'inline-flex min-h-[3.25rem] w-full items-center justify-center rounded-button border-2 px-6 text-[1.0625rem] font-semibold',
        variant === 'primary' && 'border-navy bg-navy text-white',
        variant === 'secondary' && 'border-navy bg-cream text-navy',
        variant === 'ghost' && 'border-transparent text-navy underline underline-offset-4',
      )}
    >
      {children}
    </Link>
  );
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PASSWORD_MIN = 12;
