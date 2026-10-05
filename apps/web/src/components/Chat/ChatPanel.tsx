import type { ChatAction } from '@shelf-life/shared';
import type { TFunction } from 'i18next';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChatProblem } from '../../features/cooking/useRecipeChat';
import { useSpeech } from '../../features/cooking/useSpeech';
import { cx } from '../../lib/cx';
import type { ChatEntry } from '../../stores/cookSession';
import {
  CheckIcon,
  CloudOffIcon,
  ListIcon,
  MicIcon,
  PlusIcon,
  SendIcon,
  SparkIcon,
  SwapIcon,
  UsersIcon,
} from '../icons';

export type ChatPanelProps = {
  /** "Using: 42 pantry items · 2 servings · vegetarian". */
  context: string;
  messages: readonly ChatEntry[];
  suggestions: readonly string[];
  pending: boolean;
  problem: ChatProblem;
  online: boolean;
  onSend: (text: string) => void;
  onAction: (action: ChatAction, messageIndex: number, actionIndex: number) => void;
  /** Hide the title row (a sheet shows its own). */
  showTitle?: boolean;
  className?: string;
};

function actionLabel(t: TFunction, a: ChatAction): string {
  switch (a.type) {
    case 'swap':
      return t('chat.actions.swap', { to: a.to.toLowerCase() });
    case 'addToList':
      return t('chat.actions.addToList', { name: a.name.toLowerCase() });
    case 'updateServings':
      return t('chat.actions.servings', { count: a.servings });
    case 'updateRecipe':
      return t('chat.actions.recipe');
  }
}

function actionIcon(a: ChatAction) {
  if (a.type === 'swap') return <SwapIcon size={16} />;
  if (a.type === 'addToList') return <PlusIcon size={16} />;
  if (a.type === 'updateServings') return <UsersIcon size={16} />;
  return <CheckIcon size={16} />;
}

/**
 * RCP-8 / RCP-9 AI chat (SRS 7 ChatPanel): a `role="log"` conversation with polite live updates,
 * action buttons inside AI replies, suggestion chips, a labeled input with optional voice and
 * send, and the safety footer. Offline it says chat needs a connection; the recipe still works.
 */
export function ChatPanel({
  context,
  messages,
  suggestions,
  pending,
  problem,
  online,
  onSend,
  onAction,
  showTitle = true,
  className,
}: ChatPanelProps) {
  const { t, i18n } = useTranslation();
  const [text, setText] = useState('');
  const id = useId();
  const logRef = useRef<HTMLDivElement>(null);
  const speech = useSpeech(i18n.language === 'hi' ? 'hi-IN' : 'en-US', setText);
  const blocked = !online || problem === 'offline';

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, pending]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() || blocked || pending) return;
    onSend(text);
    setText('');
  }

  return (
    <section
      aria-labelledby={showTitle ? `${id}-title` : undefined}
      aria-label={showTitle ? undefined : t('chat.title')}
      className={cx('flex min-h-0 flex-col gap-3', className)}
    >
      {showTitle ? (
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-periwinkle text-navy">
            <SparkIcon size={22} />
          </span>
          <div>
            <h2 id={`${id}-title`} className="font-ui text-lg font-semibold">
              {t('chat.title')}
            </h2>
            <p className="text-sm text-secondary">{t('chat.subtitle')}</p>
          </div>
        </div>
      ) : null}
      <p className="inline-flex items-center gap-2 self-start rounded-xl bg-shelf px-3 py-1.5 text-sm">
        <ListIcon size={16} />
        {context}
      </p>

      <div
        ref={logRef}
        role="log"
        aria-live="polite"
        aria-label={t('chat.log')}
        className="flex min-h-24 flex-1 flex-col gap-3 overflow-y-auto rounded-xl"
      >
        {messages.length === 0 ? <p className="text-sm text-secondary">{t('chat.empty')}</p> : null}
        {messages.map((m, mi) =>
          m.role === 'user' ? (
            <p
              key={mi}
              className="max-w-[85%] self-end rounded-[1.125rem] rounded-br-md bg-navy px-4 py-2.5 text-white"
            >
              <span className="sr-only">{`${t('chat.you')}: `}</span>
              {m.text}
            </p>
          ) : (
            <div
              key={mi}
              className="flex max-w-[90%] flex-col items-start gap-2 self-start rounded-[1.125rem] rounded-bl-md bg-shelf px-4 py-3"
            >
              <p>
                <span className="sr-only">{`${t('chat.ai')}: `}</span>
                {m.text}
              </p>
              {m.actions.map((a, ai) => {
                const done = m.applied?.includes(ai) ?? false;
                return (
                  <button
                    key={ai}
                    type="button"
                    disabled={done}
                    aria-label={done ? `${actionLabel(t, a)}, ${t('chat.done')}` : undefined}
                    onClick={() => onAction(a, mi, ai)}
                    className={cx(
                      'inline-flex min-h-11 items-center gap-1.5 rounded-button px-3 text-sm font-semibold',
                      ai === 0 ? 'bg-navy text-white' : 'bg-white text-navy bordered',
                      done && 'opacity-70',
                    )}
                  >
                    {done ? <CheckIcon size={16} /> : actionIcon(a)}
                    {actionLabel(t, a)}
                  </button>
                );
              })}
            </div>
          ),
        )}
        {pending ? (
          <p className="self-start rounded-[1.125rem] bg-shelf px-4 py-2.5 text-secondary">
            {t('chat.typing')}
          </p>
        ) : null}
      </div>

      {blocked || problem ? (
        <p
          role="status"
          className="flex items-start gap-2 rounded-xl bg-peach px-3 py-2 text-sm text-ink"
        >
          <CloudOffIcon size={18} className="mt-0.5 shrink-0" />
          {blocked
            ? t('chat.offline')
            : problem === 'limit'
              ? t('chat.limit')
              : t('chat.unavailable')}
        </p>
      ) : null}

      <div role="group" aria-label={t('chat.suggestions')} className="flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            disabled={blocked || pending}
            onClick={() => onSend(s)}
            className="min-h-11 rounded-chip bg-white px-3.5 text-sm font-semibold text-ink bordered disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      <form
        onSubmit={submit}
        className="flex items-center gap-2 rounded-button bg-white p-1.5 pl-4 bordered"
      >
        <label htmlFor={`${id}-input`} className="sr-only">
          {t('chat.inputLabel')}
        </label>
        <input
          id={`${id}-input`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('chat.placeholder')}
          disabled={blocked}
          maxLength={500}
          className="min-h-11 min-w-0 flex-1 bg-transparent"
        />
        {speech.supported ? (
          <button
            type="button"
            onClick={speech.toggle}
            disabled={blocked}
            aria-pressed={speech.listening}
            aria-label={t('chat.voice')}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-navy aria-pressed:bg-periwinkle"
          >
            <MicIcon size={22} />
          </button>
        ) : null}
        <button
          type="submit"
          disabled={blocked || pending || !text.trim()}
          aria-label={t('chat.send')}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-navy text-white disabled:opacity-50"
        >
          <SendIcon size={20} />
        </button>
      </form>
      {speech.showNote ? (
        <p role="status" className="text-sm text-secondary">
          {t('chat.voiceNote')}
        </p>
      ) : null}
      <p className="text-xs text-secondary">{t('chat.footer')}</p>
    </section>
  );
}
