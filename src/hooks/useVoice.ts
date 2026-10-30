import { useCallback, useEffect, useRef, useState } from 'react';
import { joinResults, newWords } from '../domain/transcript';

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
  /** Newer Chrome accepts the audio track to listen to; older browsers ignore the argument. */
  start: (track?: MediaStreamTrack) => void;
  stop: () => void;
  abort: () => void;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | undefined {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export type VoiceState = 'idle' | 'listening';

interface Options {
  /** Called with newly finalized transcript text (append to the dump). */
  onFinal: (text: string) => void;
  /** Called with the recording when it stops, so the original audio can be kept and replayed. */
  onAudio: (blob: Blob) => void;
  /** BCP 47 language for the transcript; empty = the device language. */
  lang?: string;
}

const BLOCKED = 'Microphone access is blocked. Allow it in your browser settings.';
/** Recognition ends on its own (silence, Android's time limit); it is restarted while recording. */
const RESTART_MS = 250;
/** Consecutive failed recognition sessions before the live transcript gives up. */
const MAX_FAILS = 3;

/**
 * Voice capture. Records the original audio (MediaRecorder) until the user stops, however long
 * that is. Where the Web Speech API exists it also writes a live transcript, restarting
 * recognition whenever the browser ends it. Feature-detected; never throws into the UI.
 */
export function useVoice({ onFinal, onAudio, lang = '' }: Options) {
  const [state, setState] = useState<VoiceState>('idle');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [startedAt, setStartedAt] = useState(0);
  /** The user wants to be recording; only start/stop change it. */
  const active = useRef(false);
  const rec = useRef<Recognition | null>(null);
  const media = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const lock = useRef<WakeLockSentinel | null>(null);
  const fails = useRef(0);
  /** The previous recognition session's final text: Android may send it again after a restart. */
  const before = useRef('');
  const shareTrack = useRef(true);
  const restart = useRef<ReturnType<typeof setTimeout>>(undefined);
  const waiters = useRef<(() => void)[]>([]);
  /** `listen`, for restarting itself from a timer. */
  const relisten = useRef<() => void>(() => {});
  const cb = useRef({ onFinal, onAudio, lang });
  useEffect(() => {
    cb.current = { onFinal, onAudio, lang };
  });

  const canRecord = typeof window !== 'undefined' && !!navigator.mediaDevices && typeof MediaRecorder !== 'undefined';
  const supported = typeof window !== 'undefined' && (canRecord || !!recognitionCtor());

  const wake = useCallback(async () => {
    try {
      if (active.current && !lock.current && document.visibilityState === 'visible')
        lock.current = (await navigator.wakeLock?.request('screen')) ?? null;
    } catch {
      // not supported or refused: the screen may sleep, which is all we lose
    }
  }, []);

  /** Goes idle once the user stopped and both the recorder and recognition have finished. */
  const settle = useCallback(() => {
    if (active.current || rec.current || media.current?.state === 'recording') return;
    clearTimeout(restart.current);
    void lock.current?.release().catch(() => {});
    lock.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    media.current = null;
    setInterim('');
    setState('idle');
    waiters.current.splice(0).forEach((resolve) => resolve());
  }, []);

  const listen = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor || !active.current) return;
    const r = new Ctor();
    r.continuous = true;
    r.interimResults = true;
    r.lang = cb.current.lang || navigator.language || 'en-US';
    const began = Date.now();
    const carried = before.current;
    let said = carried;
    let heard = false;
    let track: MediaStreamTrack | undefined;
    r.onresult = (e) => {
      heard = true;
      fails.current = 0;
      // rebuilt from every result each time: Android repeats and re-sends earlier ones
      const finals: string[] = [carried];
      const all: string[] = [carried];
      for (let i = 0; i < e.results.length; i++) {
        const text = e.results[i][0].transcript;
        all.push(text);
        if (e.results[i].isFinal) finals.push(text);
      }
      const final = joinResults(finals);
      const added = newWords(said, final);
      if (added) {
        said = final;
        before.current = final;
        cb.current.onFinal(added);
      }
      setInterim(newWords(said, joinResults(all)));
    };
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        fails.current = MAX_FAILS;
        if (!media.current) setError(BLOCKED);
      } else if (e.error === 'audio-capture' && track) {
        shareTrack.current = false; // this browser can't listen to our track: let it open the mic itself
      } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
        fails.current++;
      }
    };
    r.onend = () => {
      track?.stop();
      if (rec.current === r) rec.current = null;
      if (!heard && Date.now() - began < 1000) fails.current++; // ended at once: don't spin
      if (!active.current) return settle();
      if (fails.current < MAX_FAILS) {
        restart.current = setTimeout(() => relisten.current(), RESTART_MS);
      } else if (media.current) {
        setInterim('');
        setNotice('Live transcript stopped. Still recording, so you can listen back.');
      } else {
        active.current = false;
        settle();
      }
    };
    rec.current = r;
    try {
      // share the recorder's microphone where supported, so the two don't fight over it (Android)
      track = shareTrack.current ? stream.current?.getAudioTracks()[0]?.clone() : undefined;
      r.start(track);
    } catch {
      track?.stop();
      rec.current = null;
      fails.current++;
      if (fails.current < MAX_FAILS) restart.current = setTimeout(() => relisten.current(), RESTART_MS);
    }
  }, [settle]);
  useEffect(() => {
    relisten.current = listen;
  }, [listen]);

  const start = useCallback(async () => {
    if (active.current) return;
    active.current = true;
    fails.current = 0;
    before.current = '';
    setError('');
    setNotice('');
    setInterim('');
    setState('listening');
    setStartedAt(Date.now());
    const Ctor = recognitionCtor();
    if (canRecord) {
      try {
        stream.current = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        if (!active.current) {
          // stopped while the permission prompt was up
          stream.current.getTracks().forEach((t) => t.stop());
          stream.current = null;
          return settle();
        }
        chunks.current = [];
        const m = new MediaRecorder(stream.current);
        m.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
        m.onstop = () => {
          const blob = new Blob(chunks.current, { type: m.mimeType || 'audio/webm' });
          if (blob.size > 0) cb.current.onAudio(blob);
          if (active.current) {
            // the recorder died (the system took the mic): stop cleanly rather than half-record
            active.current = false;
            rec.current?.stop();
          }
          settle();
        };
        media.current = m;
        m.start(1000); // chunked, so a long recording isn't held in one buffer
      } catch (e) {
        stream.current?.getTracks().forEach((t) => t.stop());
        stream.current = null;
        media.current = null;
        if (e instanceof DOMException && e.name === 'NotAllowedError') {
          active.current = false;
          setError(BLOCKED);
          return settle();
        }
        // recording unavailable: continue with speech-to-text only
      }
    }
    if (!media.current && !Ctor) {
      active.current = false;
      setError('Voice input is not available here.');
      return settle();
    }
    if (!Ctor) setNotice('No live transcript in this browser. The recording is saved, so type what you need or listen back.');
    listen();
    void wake();
  }, [canRecord, listen, settle, wake]);

  /** Stops recording; resolves once the last transcript and the audio have been delivered. */
  const stop = useCallback(
    () =>
      new Promise<void>((resolve) => {
        if (!active.current && !rec.current && media.current?.state !== 'recording') return resolve();
        active.current = false;
        waiters.current.push(resolve);
        clearTimeout(restart.current);
        rec.current?.stop();
        if (media.current?.state === 'recording') media.current.stop();
        settle();
        // recognition doesn't always report its end: don't wait on it forever
        setTimeout(() => {
          rec.current?.abort();
          rec.current = null;
          settle();
        }, 1500);
      }),
    [settle],
  );

  // the wake lock is dropped when the page is hidden; take it again on return
  useEffect(() => {
    const onVisible = () => void wake();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [wake]);

  useEffect(
    () => () => {
      active.current = false;
      clearTimeout(restart.current);
      rec.current?.abort();
      rec.current = null;
      // the recorder's onstop still saves the audio and releases the mic
      if (media.current?.state === 'recording') media.current.stop();
      else settle();
    },
    [settle],
  );

  return { state, interim, error, notice, startedAt, supported, start, stop };
}
