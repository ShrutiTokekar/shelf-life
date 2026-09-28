import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button/Button';
import { CameraView } from '../../components/CameraView/CameraView';
import { ErrorState } from '../../components/ErrorState/ErrorState';
import {
  CloseIcon,
  FlashIcon,
  ImageIcon,
  LockIcon,
  PlusIcon,
  RefreshIcon,
  WarnIcon,
} from '../../components/icons';
import { ScanProgressSheet } from '../../components/ScanProgressSheet/ScanProgressSheet';
import { SkipLink } from '../../components/SkipLink/SkipLink';
import { useToast } from '../../components/Toast/Toast';
import { UploadDropZone } from '../../components/UploadDropZone/UploadDropZone';
import { Wordmark } from '../../components/Wordmark/Wordmark';
import {
  runScan,
  ScanError,
  validateImage,
  type ScanProgress,
} from '../../features/ocr/scanSession';
import { useCamera } from '../../features/ocr/useCamera';
import { cx } from '../../lib/cx';
import { DESKTOP_QUERY, useMediaQuery } from '../../lib/useMediaQuery';
import { useScanResult } from '../../stores/scanResult';

type Phase = 'capture' | 'reading' | 'unreadable' | 'failed';

/** Scan receipt (SRS 6.4, Figma mobile 04; desktop upload per SCN-2). */
export function ScanPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const camera = useCamera();
  const { start: startCamera, stop: stopCamera } = camera;
  const setResult = useScanResult((s) => s.set);
  const [phase, setPhase] = useState<Phase>('capture');
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  // Mobile opens the rear camera; desktop uses the drop zone (SCN-1, SCN-2).
  useEffect(() => {
    if (isDesktop || phase !== 'capture') return;
    const id = setTimeout(() => void startCamera(), 0);
    return () => {
      clearTimeout(id);
      stopCamera();
    };
  }, [isDesktop, phase, startCamera, stopCamera]);

  // Stop any scan in progress when leaving the page.
  useEffect(() => () => abortRef.current?.abort(), []);

  const scan = useCallback(
    async (file: Blob & { name?: string }) => {
      setFileError(null);
      try {
        validateImage(file);
      } catch (err) {
        setFileError(err instanceof ScanError ? err.message : t('scan.failed'));
        return;
      }
      const controller = new AbortController();
      abortRef.current = controller;
      setPhase('reading');
      setProgress(null);
      try {
        const receipt = await runScan(file, { signal: controller.signal, onProgress: setProgress });
        setResult(receipt);
        navigate('/scan/review');
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          setPhase('capture');
          toast({ message: t('scan.cancelled') });
        } else if (err instanceof ScanError && err.code === 'unreadable') {
          setPhase('unreadable');
        } else {
          setPhase('failed');
        }
      } finally {
        abortRef.current = null;
      }
    },
    [navigate, setResult, t, toast],
  );

  const shutter = async () => {
    const photo = await camera.capture();
    if (photo) void scan(photo);
  };

  const retake = () => {
    setProgress(null);
    setPhase('capture');
  };

  const lockText = isDesktop ? t('scan.lockNoteDesktop') : t('scan.lockNote');
  const progressView = (
    <ScanProgressSheet
      variant={isDesktop ? 'card' : 'sheet'}
      lockText={lockText}
      onCancel={() => abortRef.current?.abort()}
      progress={
        progress ?? {
          percent: 0,
          steps: { clean: 'active', read: 'todo', match: 'todo', expiry: 'todo' },
          lineCount: null,
          preparing: false,
        }
      }
    />
  );
  const unreadableView = (
    <section
      role="alert"
      aria-labelledby="unreadable-title"
      className={cx(
        'flex flex-col gap-4 bg-cream px-6 pb-9 pt-6',
        isDesktop ? 'rounded-hero bordered' : 'rounded-t-[1.75rem]',
      )}
    >
      <h2 id="unreadable-title" className="flex items-center gap-2 text-[1.375rem] leading-tight">
        <WarnIcon size={24} className="text-terra-dark" />
        {t('scan.unreadableTitle')}
      </h2>
      <p className="text-secondary">{t('scan.unreadableBody')}</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button icon={<RefreshIcon size={20} />} onClick={retake}>
          {t('scan.retake')}
        </Button>
        <Button asChild variant="secondary">
          <Link to="/pantry?add=1">
            <PlusIcon size={20} />
            {t('scan.addManually')}
          </Link>
        </Button>
      </div>
    </section>
  );
  const failedView = (
    <div
      className={cx('bg-cream px-6 pb-9 pt-6', isDesktop ? 'rounded-hero' : 'rounded-t-[1.75rem]')}
    >
      <ErrorState message={t('scan.failed')} onRetry={retake} />
    </div>
  );

  if (isDesktop) {
    return (
      <div className="min-h-dvh bg-cream">
        <SkipLink targetId="main" text={t('skip.scan')} />
        <header className="flex items-center justify-between page-x pt-5">
          <Link to="/" className="flex min-h-11 items-center rounded-xl">
            <Wordmark size={38} />
          </Link>
          <Button asChild variant="ghost" size="sm">
            <Link to="/pantry">
              <CloseIcon size={20} />
              {t('scan.close')}
            </Link>
          </Button>
        </header>
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto flex max-w-[45rem] flex-col gap-6 px-6 py-10 outline-none"
        >
          <div>
            <h1 className="text-[3.5rem] leading-[1.14]">{t('scan.desktopTitle')}</h1>
            <p className="mt-2 text-lg text-secondary">{t('scan.desktopBody')}</p>
          </div>
          {phase === 'capture' ? (
            <UploadDropZone onFile={(f) => void scan(f)} error={fileError} />
          ) : null}
          {phase === 'reading' ? progressView : null}
          {phase === 'unreadable' ? unreadableView : null}
          {phase === 'failed' ? failedView : null}
          {phase === 'capture' ? (
            <p className="flex items-center gap-2 text-sm text-secondary">
              <LockIcon size={16} />
              {lockText}
            </p>
          ) : null}
        </main>
      </div>
    );
  }

  const cameraMessage =
    camera.state === 'denied'
      ? t('scan.cameraDenied')
      : camera.state === 'unavailable' || camera.state === 'error'
        ? t('scan.cameraUnavailable')
        : t('scan.cameraStarting');

  return (
    <div className="flex min-h-dvh flex-col bg-ink">
      <SkipLink targetId="main" text={t('skip.scan')} />
      <header className="flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <Link
          to="/"
          aria-label={t('scan.close')}
          className="flex size-11 items-center justify-center rounded-xl text-white"
        >
          <CloseIcon size={24} />
        </Link>
        <h1 className="font-ui text-lg font-semibold text-white">{t('scan.title')}</h1>
        {camera.torchSupported && phase === 'capture' ? (
          <button
            type="button"
            aria-label={t('scan.flash')}
            aria-pressed={camera.torchOn}
            onClick={() => void camera.toggleTorch()}
            className="flex size-11 items-center justify-center rounded-xl text-white aria-pressed:bg-white aria-pressed:text-ink"
          >
            <FlashIcon size={24} />
          </button>
        ) : (
          <span className="size-11" aria-hidden="true" />
        )}
      </header>

      <main
        id="main"
        tabIndex={-1}
        className="flex flex-1 flex-col gap-[1.125rem] pt-[1.125rem] outline-none"
      >
        <div className="px-6">
          <CameraView
            videoRef={camera.videoRef}
            live={camera.state === 'live'}
            scanning={phase === 'reading'}
            placeholder={cameraMessage}
          />
        </div>

        {phase === 'capture' ? (
          <div className="flex flex-1 flex-col items-center gap-5 px-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
            {fileError ? (
              <p
                role="alert"
                className="flex items-center gap-2 rounded-card bg-terra-light px-4 py-2 font-medium text-terra-dark"
              >
                <WarnIcon size={18} />
                {fileError}
              </p>
            ) : null}
            <div className="grid w-full grid-cols-3 items-center">
              <button
                type="button"
                onClick={() => uploadRef.current?.click()}
                className="flex min-h-11 flex-col items-center gap-1 justify-self-start rounded-xl px-2 text-sm font-semibold text-periwinkle"
              >
                <ImageIcon size={26} />
                {t('scan.uploadPhoto')}
              </button>
              <button
                type="button"
                aria-label={t('scan.takePhoto')}
                disabled={camera.state !== 'live'}
                onClick={() => void shutter()}
                className="size-[4.5rem] justify-self-center rounded-chip border-4 border-white bg-periwinkle disabled:opacity-40"
              />
              <span aria-hidden="true" />
            </div>
            <input
              ref={uploadRef}
              type="file"
              accept="image/jpeg,image/png,image/heic,image/heif,.heic,.heif"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              data-testid="file-input"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) void scan(file);
              }}
            />
            <p className="mt-auto flex items-center gap-2 text-[0.8125rem] text-periwinkle">
              <LockIcon size={16} />
              {lockText}
            </p>
          </div>
        ) : (
          <div className="mt-auto">
            {phase === 'reading'
              ? progressView
              : phase === 'unreadable'
                ? unreadableView
                : failedView}
          </div>
        )}
      </main>
    </div>
  );
}
