import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cx } from '../../lib/cx';
import { Button } from '../Button/Button';
import { UploadIcon, WarnIcon } from '../icons';

export type UploadDropZoneProps = {
  onFile: (file: File) => void;
  error?: string | null;
  className?: string;
};

/** SCN-2: drop zone + "Choose a photo" for JPG, PNG, HEIC up to 15 MB. Keyboard users use the button. */
export function UploadDropZone({ onFile, error, className }: UploadDropZoneProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const errorId = useId();
  const [over, setOver] = useState(false);

  const take = (files: FileList | null) => {
    const file = files?.[0];
    if (file) onFile(file);
    // Drop our reference to the photo right away (SEC-5).
    if (inputRef.current) inputRef.current.value = '';
  };

  // Drag-and-drop is a mouse extra; keyboard and touch users use the button. Listeners are attached
  // directly so the zone stays a plain (non-interactive) element for assistive tech.
  const takeRef = useRef(take);
  useEffect(() => {
    takeRef.current = take;
  });
  const zoneRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const zone = zoneRef.current;
    if (!zone) return;
    const over = (e: DragEvent) => {
      e.preventDefault();
      setOver(true);
    };
    const leave = () => setOver(false);
    const drop = (e: DragEvent) => {
      e.preventDefault();
      setOver(false);
      takeRef.current(e.dataTransfer?.files ?? null);
    };
    zone.addEventListener('dragover', over);
    zone.addEventListener('dragleave', leave);
    zone.addEventListener('drop', drop);
    return () => {
      zone.removeEventListener('dragover', over);
      zone.removeEventListener('dragleave', leave);
      zone.removeEventListener('drop', drop);
    };
  }, []);

  return (
    <div className={cx('flex flex-col gap-3', className)}>
      <div
        ref={zoneRef}
        data-testid="drop-zone"
        className={cx(
          'flex flex-col items-center gap-3 rounded-hero border-2 border-dashed px-6 py-10 text-center',
          over ? 'border-navy bg-periwinkle' : 'border-line bg-white',
        )}
      >
        <span
          aria-hidden="true"
          className="flex size-14 items-center justify-center rounded-chip bg-periwinkle text-navy"
        >
          <UploadIcon size={26} />
        </span>
        <p className="text-lg font-semibold text-ink">{t('scan.dropHere')}</p>
        <p className="text-sm text-secondary">{t('scan.or')}</p>
        <Button
          icon={<UploadIcon size={20} />}
          aria-describedby={[hintId, error ? errorId : ''].filter(Boolean).join(' ')}
          onClick={() => inputRef.current?.click()}
        >
          {t('scan.choosePhoto')}
        </Button>
        <p id={hintId} className="text-[0.8125rem] text-secondary">
          {t('scan.fileHint')}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/heic,image/heif,.heic,.heif"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          data-testid="file-input"
          onChange={(e) => take(e.target.files)}
        />
      </div>
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="flex items-center gap-2 font-medium text-terra-dark"
        >
          <WarnIcon size={18} />
          {error}
        </p>
      ) : null}
    </div>
  );
}
