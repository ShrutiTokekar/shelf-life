import { useCallback, useEffect, useRef, useState } from 'react';

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

function recognitionClass(): (new () => Recognition) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as Record<string, unknown>;
  return ((w.SpeechRecognition ?? w.webkitSpeechRecognition) as new () => Recognition) ?? null;
}

const NOTE_KEY = 'shelf-life:voice-note-seen';

/**
 * RCP-8 voice input with the browser's own speech recognition (free). Only offered where the
 * browser has it. The first time, the panel says the browser turns speech into text (Chrome
 * sends audio to Google's servers), as decided in Milestone 7.
 */
export function useSpeech(lang: string, onText: (text: string) => void) {
  const Ctor = recognitionClass();
  const [listening, setListening] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const rec = useRef<Recognition | null>(null);
  const onTextRef = useRef(onText);
  useEffect(() => {
    onTextRef.current = onText;
  });

  useEffect(() => () => rec.current?.stop(), []);

  const toggle = useCallback(() => {
    if (!Ctor) return;
    if (listening) {
      rec.current?.stop();
      return;
    }
    try {
      if (!window.localStorage.getItem(NOTE_KEY)) {
        window.localStorage.setItem(NOTE_KEY, '1');
        setShowNote(true);
      }
    } catch {
      setShowNote(true);
    }
    const r = new Ctor();
    r.lang = lang;
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e) => {
      const text = Array.from(e.results)
        .map((res) => res[0]?.transcript ?? '')
        .join('');
      onTextRef.current(text);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    setListening(true);
    r.start();
  }, [Ctor, listening, lang]);

  return { supported: !!Ctor, listening, toggle, showNote };
}
