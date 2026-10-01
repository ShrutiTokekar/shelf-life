import { createListInputSchema, type ListColor } from '@shelf-life/shared';
import { useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button/Button';
import { ColorSwatchPicker } from '../../components/ColorSwatchPicker/ColorSwatchPicker';
import { TagIcon, WarnIcon } from '../../components/icons';
import { PantryLabel } from '../../components/PantryLabel/PantryLabel';
import { ApiRequestError, createList } from '../../lib/api';
import { useSession } from '../../lib/session';
import { useOnlineStatus } from '../../lib/useOnlineStatus';

/**
 * New shared list (SHR-2, SHR-7; Figma mobile 19). Name, pantry label color with a preview,
 * "Just me" private, optional shop-by date. People are added on the next step (the share dialog),
 * because invite links need the list to exist.
 */
export function NewListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const session = useSession();
  const online = useOnlineStatus();
  const ids = {
    form: useId(),
    name: useId(),
    err: useId(),
    color: useId(),
    colorHint: useId(),
    shop: useId(),
    priv: useId(),
  };
  const [name, setName] = useState('');
  const [color, setColor] = useState<ListColor>('amber');
  const [isPrivate, setIsPrivate] = useState(false);
  const [shopBy, setShopBy] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = createListInputSchema.safeParse({
      name,
      color,
      isPrivate,
      shopBy: shopBy || null,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? t('newList.error'));
      document.getElementById(ids.name)?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const list = await createList(parsed.data);
      await session.refresh();
      navigate(isPrivate ? `/lists/${list.id}` : `/lists/${list.id}/share`, { replace: true });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t('newList.error'));
      setBusy(false);
    }
  }

  const field = 'min-h-12 w-full rounded-button bg-white px-4 text-base text-ink bordered';

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5 page-x pb-8 pt-6">
      <div className="flex items-center justify-between gap-3">
        <Link to="/lists" className="flex min-h-11 items-center font-semibold text-navy">
          {t('newList.cancel')}
        </Link>
        <h1 className="font-ui text-xl font-semibold text-ink">{t('newList.title')}</h1>
        <Button
          type="submit"
          form={ids.form}
          variant="ghost"
          size="sm"
          loading={busy}
          disabled={!online}
          className="text-navy"
        >
          {t('newList.create')}
        </Button>
      </div>

      <form id={ids.form} noValidate onSubmit={submit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.name} className="font-semibold text-ink">
            {t('newList.name')}
          </label>
          <input
            id={ids.name}
            value={name}
            maxLength={40}
            autoComplete="off"
            placeholder={t('newList.namePlaceholder')}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? ids.err : undefined}
            onChange={(e) => setName(e.target.value)}
            className={`${field} aria-invalid:border-terra-dark`}
          />
          {error ? (
            <p
              id={ids.err}
              role="alert"
              className="flex items-center gap-2 text-sm font-medium text-terra-dark"
            >
              <WarnIcon size={16} />
              {error}
            </p>
          ) : null}
        </div>

        <section className="flex flex-col gap-3 rounded-card bg-shelf p-5">
          <h2
            id={ids.color}
            className="flex items-center gap-2 font-ui text-lg font-semibold text-ink"
          >
            <TagIcon size={20} />
            {t('newList.label')}
          </h2>
          <p id={ids.colorHint} className="text-sm text-ink">
            {t('newList.labelBody')}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <ColorSwatchPicker
              value={color}
              onChange={setColor}
              labelledBy={ids.color}
              describedBy={ids.colorHint}
            />
            <span className="rounded-chip bg-white px-3 py-1.5" aria-hidden="true">
              <PantryLabel listName={name.trim() || t('newList.namePlaceholder')} color={color} />
            </span>
          </div>
        </section>

        <div className="flex items-start gap-3 rounded-card border-2 border-line bg-white p-4">
          <input
            id={ids.priv}
            type="checkbox"
            checked={isPrivate}
            aria-describedby={`${ids.priv}-body`}
            onChange={(e) => setIsPrivate(e.target.checked)}
            className="mt-0.5 size-6 shrink-0 cursor-pointer accent-[var(--navy)]"
          />
          <div>
            <label htmlFor={ids.priv} className="block cursor-pointer font-semibold text-ink">
              {t('newList.private')}
            </label>
            <p id={`${ids.priv}-body`} className="text-sm text-secondary">
              {t('newList.privateBody')}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.shop} className="font-semibold text-ink">
            {t('newList.shopBy')}
          </label>
          <input
            id={ids.shop}
            type="date"
            value={shopBy}
            onChange={(e) => setShopBy(e.target.value)}
            className={field}
          />
        </div>

        {!isPrivate ? <p className="text-sm text-secondary">{t('newList.nextShare')}</p> : null}
        {!online ? <p className="text-sm text-ink">{t('share.offline')}</p> : null}
      </form>
    </div>
  );
}
