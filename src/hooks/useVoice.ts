import { useCallback, useEffect, useRef, useState } from 'react';

interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}
interface Recognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | undefined {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export type VoiceState = 'idle' | 'listening';

interface Options {
  /** Called with finalized transcript text (append to the dump). */
  onFinal: (text: string) => void;
  /** Called with the recording when it stops, so the original audio can be kept and replayed. */
  onAudio: (blob: Blob) => void;
}

const BLOCKED = 'Microphone access is blocked. Allow it in your browser settings.';

/**
 * Voice capture. Always records the original audio (MediaRecorder); where the Web Speech API
 * exists it also streams a live transcript. Feature-detected; never throws into the UI.
 */
export function useVoice({ onFinal, onAudio }: Options) {
  const [state, setState] = useState<VoiceState>('idle');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const rec = useRef<Recognition | null>(null);
  const media = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const cb = useRef({ onFinal, onAudio });
  useEffect(() => {
    cb.current = { onFinal, onAudio };
  });

  const canRecord = typeof window !== 'undefined' && !!navigator.mediaDevices && typeof MediaRecorder !== 'undefined';
  const supported = typeof window !== 'undefined' && (canRecord || !!recognitionCtor());

  const cleanup = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }, []);

  const start = useCallback(async () => {
    if (state !== 'idle') return;
    setError('');
    setNotice('');
    setInterim('');
    const Ctor = recognitionCtor();
    try {
      if (canRecord) {
        try {
          stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
          chunks.current = [];
          const m = new MediaRecorder(stream.current);
          m.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
          m.onstop = () => {
            const blob = new Blob(chunks.current, { type: m.mimeType || 'audio/webm' });
            cleanup();
            if (blob.size > 0) cb.current.onAudio(blob);
            setState('idle');
          };
          media.current = m;
          m.start();
        } catch (e) {
          cleanup();
          if (e instanceof DOMException && e.name === 'NotAllowedError') throw e;
          media.current = null; // recording unavailable: continue with speech-to-text only
        }
      }
      if (Ctor) {
        const r = new Ctor();
        r.continuous = true;
        r.interimResults = true;
        r.lang = navigator.language || 'en-US';
        r.onresult = (e) => {
          let live = '';
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const res = e.results[i];
            if (res.isFinal) cb.current.onFinal(res[0].transcript.trim());
            else live += res[0].transcript;
          }
          setInterim(live);
        };
        r.onerror = (e) => {
          if (e.error === 'not-allowed') setError(BLOCKED);
          else if (e.error !== 'no-speech' && e.error !== 'aborted') setNotice('Live transcript stopped. The recording is kept.');
        };
        r.onend = () => {
          setInterim('');
          if (media.current?.state === 'recording') media.current.stop();
          else setState('idle');
        };
        rec.current = r;
        r.start();
      } else if (media.current) {
        setNotice('No live transcript in this browser. The recording is saved, so type what you need or listen back.');
      }
      if (!media.current && !Ctor) throw new Error('unavailable');
      setState('listening');
    } catch (e) {
      cleanup();
      setError(e instanceof DOMException && e.name === 'NotAllowedError' ? BLOCKED : 'Voice input is not available here.');
      setState('idle');
    }
  }, [state, canRecord, cleanup]);

  const stop = useCallback(() => {
    if (rec.current) rec.current.stop();
    else if (media.current?.state === 'recording') media.current.stop();
    if (rec.current && media.current?.state === 'recording') media.current.stop();
  }, []);

  useEffect(
    () => () => {
      rec.current?.stop();
      if (media.current?.state === 'recording') media.current.stop();
      cleanup();
    },
    [cleanup],
  );

  return { state, interim, error, notice, supported, start, stop };
}
