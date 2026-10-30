/**
 * Helpers for turning speech-recognition results into text without repeats.
 * Android Chrome reports results cumulatively ("buy", "buy milk", "buy milk and eggs") and
 * sometimes repeats a final result, so results are collapsed before anything is written.
 */

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);
const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '');

/** True when every word of `a` starts `b` (ignoring case and punctuation). */
function isPrefix(a: string[], b: string[]): boolean {
  return a.length <= b.length && a.every((w, i) => norm(w) === norm(b[i]));
}

/** Joins one recognition session's result texts, collapsing cumulative and repeated results. */
export function joinResults(parts: string[]): string {
  const out: string[][] = [];
  for (const part of parts) {
    const w = words(part);
    if (!w.length) continue;
    const last = out[out.length - 1];
    if (last && isPrefix(last, w)) out[out.length - 1] = w;
    else if (!last || !isPrefix(w, last)) out.push(w);
  }
  return out.map((w) => w.join(' ')).join(' ');
}

/** The words of `heard` beyond what was already written (`said`); empty when nothing is new. */
export function newWords(said: string, heard: string): string {
  const a = words(said);
  const b = words(heard);
  return b.length > a.length ? b.slice(a.length).join(' ') : '';
}

/** Appends dictated text to what is already in the field, with one space between. */
export function appendText(current: string, add: string): string {
  if (!add) return current;
  return current && !/\s$/.test(current) ? `${current} ${add}` : current + add;
}

/** m:ss for a recording timer. */
export function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
