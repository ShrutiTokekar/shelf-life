import {
  DEFAULT_HOME_LIST_NAME,
  LIST_NAME_MAX_LENGTH,
  type ListColor,
  createListInputSchema,
} from '@shelf-life/shared';
import { useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button/Button';
import { ColorSwatchPicker } from '../../components/ColorSwatchPicker/ColorSwatchPicker';
import { ErrorState } from '../../components/ErrorState/ErrorState';
import { CloudOffIcon, WarnIcon } from '../../components/icons';
import { OfflineBanner } from '../../components/OfflineBanner/OfflineBanner';
import { SkipLink } from '../../components/SkipLink/SkipLink';
import { Wordmark } from '../../components/Wordmark/Wordmark';
import { ApiRequestError, createList } from '../../lib/api';
import { useSession } from '../../lib/session';
import { useOnlineStatus } from '../../lib/useOnlineStatus';

/** Home list setup (WEL-4). The home list owns the user's pantry. */
export function OnboardingPage() {
  const { t } = useTranslation();
  const session = useSession();
  const navigate = useNavigate();
  const online = useOnlineStatus();
  const [name, setName] = useState(DEFAULT_HOME_LIST_NAME);
  const [color, setColor] = useState<ListColor>('navy');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState(false);
  const [saving, setSaving] = useState(false);
  const ids = {
    name: useId(),
    nameHint: useId(),
    nameError: useId(),
    color: useId(),
    colorHint: useId(),
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = createListInputSchema.safeParse({ name, color });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? t('onboarding.failed'));
      document.getElementById(ids.name)?.focus();
      return;
    }
    setFieldError(null);
    setSubmitError(false);
    setSaving(true);
    try {
      await createList(parsed.data);
    } catch (err) {
      // 409 means the home list already exists (e.g. a double tap); just reload and carry on.
      if (!(err instanceof ApiRequestError && err.status === 409)) {
        setSubmitError(true);
        setSaving(false);
        return;
      }
    }
    await session.refresh();
    navigate('/', { replace: true });
  }

  return (
    <>
      <SkipLink targetId="setup" text={t('skip.setup')} />
      <OfflineBanner />
      <main
        id="main"
        className="mx-auto flex min-h-dvh w-full max-w-[30rem] flex-col px-6 pb-11 pt-10"
      >
        <Wordmark size={32} className="self-center" />
        <h1 className="mt-10 text-[2rem] leading-[1.125]">{t('onboarding.title')}</h1>
        <p className="mt-3 text-[1.0625rem] text-secondary">{t('onboarding.body')}</p>

        <form
          id="setup"
          tabIndex={-1}
          noValidate
          onSubmit={(e) => void onSubmit(e)}
          className="mt-8 flex flex-col gap-7 outline-none"
        >
          <div className="flex flex-col gap-2">
            <label htmlFor={ids.name} className="font-semibold text-ink">
              {t('onboarding.nameLabel')}
            </label>
            <input
              id={ids.name}
              name="name"
              value={name}
              maxLength={LIST_NAME_MAX_LENGTH}
              autoComplete="off"
              aria-invalid={fieldError ? true : undefined}
              aria-describedby={fieldError ? `${ids.nameError} ${ids.nameHint}` : ids.nameHint}
              onChange={(e) => setName(e.target.value)}
              className="min-h-[3.25rem] rounded-button bg-white px-4 text-[1.0625rem] text-ink bordered aria-invalid:border-terra-dark"
            />
            <p id={ids.nameHint} className="text-sm text-secondary">
              {t('onboarding.nameHint')}
            </p>
            {fieldError ? (
              <p
                id={ids.nameError}
                className="flex items-center gap-2 text-sm font-medium text-terra-dark"
              >
                <WarnIcon size={18} />
                {fieldError}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <span id={ids.color} className="font-semibold text-ink">
              {t('onboarding.colorLabel')}
            </span>
            <ColorSwatchPicker
              value={color}
              onChange={setColor}
              labelledBy={ids.color}
              describedBy={ids.colorHint}
            />
            <p id={ids.colorHint} className="text-sm text-secondary">
              {t('onboarding.colorHint')}
            </p>
          </div>

          {submitError ? <ErrorState message={t('onboarding.failed')} /> : null}
          {!online ? (
            <p className="flex items-center gap-2 text-sm text-ink">
              <CloudOffIcon size={18} />
              {t('onboarding.offline')}
            </p>
          ) : null}

          <Button type="submit" fullWidth loading={saving} disabled={!online}>
            {t('onboarding.create')}
          </Button>
        </form>
      </main>
    </>
  );
}
