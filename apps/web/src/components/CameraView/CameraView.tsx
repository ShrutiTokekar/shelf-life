import { useEffect, useRef, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { findReceipt, toGray } from '../../features/ocr/preprocess';
import { cx } from '../../lib/cx';
import { CheckIcon } from '../icons';

export type CameraViewProps = {
  videoRef: RefObject<HTMLVideoElement | null>;
  live: boolean;
  /** Show the scan-line sweep (while reading). Hidden when Reduce motion is on (SCN-5). */
  scanning: boolean;
  placeholder?: string;
};

const DETECT_EVERY_MS = 500;

/**
 * SCN-1 viewfinder: live video with corner guides; SCN-5 "Receipt found" pill when a receipt
 * outline is detected in the frame, announced to screen readers (A11Y-8).
 */
export function CameraView({ videoRef, live, scanning, placeholder }: CameraViewProps) {
  const { t } = useTranslation();
  const [found, setFound] = useState(false);
  const probe = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!live || scanning) return;
    const canvas = (probe.current ??= document.createElement('canvas'));
    const timer = setInterval(() => {
      const video = videoRef.current;
      if (!video || !video.videoWidth) return;
      // A tiny frame is enough to spot the paper; this stays well under 50 ms on the main thread.
      const scale = 160 / Math.max(video.videoWidth, video.videoHeight);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setFound(findReceipt(toGray(data, canvas.width, canvas.height)).found);
    }, DETECT_EVERY_MS);
    return () => {
      clearInterval(timer);
      canvas.width = canvas.height = 0;
    };
  }, [live, scanning, videoRef]);

  return (
    <div className="relative aspect-[342/400] max-h-[55dvh] w-full overflow-hidden rounded-[1.5rem] bg-navy/40">
      <video
        ref={videoRef as RefObject<HTMLVideoElement>}
        playsInline
        muted
        aria-hidden="true"
        className={cx('absolute inset-0 size-full object-cover', !live && 'hidden')}
      />
      {!live && placeholder ? (
        <p className="absolute inset-0 flex items-center justify-center px-8 text-center text-periwinkle">
          {placeholder}
        </p>
      ) : null}
      {/* Corner guides (Figma 04). */}
      <svg
        aria-hidden="true"
        viewBox="0 0 294 352"
        preserveAspectRatio="none"
        className="absolute inset-6 h-[calc(100%-3rem)] w-[calc(100%-3rem)] text-periwinkle"
      >
        <path
          d="M2 40V14C2 7 7 2 14 2h26M254 2h26c7 0 12 5 12 12v26M292 312v26c0 7-5 12-12 12h-26M40 350H14c-7 0-12-5-12-12v-26"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {scanning ? (
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-full">
          <div
            data-testid="scan-line"
            className="scan-line absolute inset-x-0 h-16 bg-gradient-to-b from-sage/40 to-transparent"
          >
            <div className="h-[3px] bg-sage" />
          </div>
        </div>
      ) : null}
      <div
        role="status"
        aria-live="polite"
        className="absolute inset-x-0 bottom-6 flex justify-center"
      >
        {found && live && !scanning ? (
          <span className="flex items-center gap-1.5 rounded-chip bg-sage px-3 py-1.5 text-[0.8125rem] font-semibold text-olive-dark">
            <CheckIcon size={16} strokeWidth={2.5} />
            {t('scan.receiptFound')}
          </span>
        ) : null}
      </div>
    </div>
  );
}
