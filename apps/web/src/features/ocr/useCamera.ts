import { useCallback, useEffect, useRef, useState } from 'react';

export type CameraState = 'idle' | 'starting' | 'live' | 'denied' | 'unavailable' | 'error';

/**
 * SCN-1: rear camera stream with optional torch (flash). Torch only exists where the browser
 * exposes it (Android Chrome); callers hide the toggle otherwise. The stream stops on unmount.
 */
export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CameraState>('idle');
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setTorchOn(false);
  }, []);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setState('unavailable');
      return;
    }
    setState('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      const caps = (track?.getCapabilities?.() ?? {}) as MediaTrackCapabilities & {
        torch?: boolean;
      };
      setTorchSupported(caps.torch === true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setState('live');
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      setState(
        name === 'NotAllowedError' || name === 'SecurityError'
          ? 'denied'
          : name === 'NotFoundError' || name === 'OverconstrainedError'
            ? 'unavailable'
            : 'error',
      );
    }
  }, []);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorchOn(next);
    } catch {
      setTorchSupported(false);
    }
  }, [torchOn]);

  /** Grab the current frame at full resolution as a JPEG blob; the temporary canvas is emptied. */
  const capture = useCallback(async (): Promise<Blob | null> => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.95),
    );
    canvas.width = canvas.height = 0;
    return blob;
  }, []);

  useEffect(() => stop, [stop]);

  return { videoRef, state, start, stop, capture, torchSupported, torchOn, toggleTorch };
}
