import * as chrono from 'chrono-node/en';
import { toISODate } from './dates';
import type { Effort, Urgency } from './types';

export type TokenKind = 'due' | 'urgency' | 'effort' | 'tag' | 'waiting';

export interface Token {
  kind: TokenKind;
  start: number;
  end: number;
  text: string;
}

export interface Parsed {
  title: string;
  due?: { date: string; time?: string };
  urgency: Urgency;
  effort?: Effort;
  tags: string[];
  status: 'open' | 'waiting';
  waitingOn?: string;
  tokens: Token[];
}

const MASK = '\u0000';

const URGENCY_WORDS: Record<string, Urgency> = {
  low: 1,
  med: 2,
  medium: 2,
  high: 3,
};
const EFFORT_WORDS: Record<string, Effort> = {
  quick: 'quick',
  med: 'medium',
  medium: 'medium',
  deep: 'deep',
};

const URGENCY_RE = /(^|\s)(!{1,3}|!(?:low|medium|med|high))(?=\s|$|[.,;:)])/gi;
const EFFORT_RE = /(^|\s)(~(?:quick|medium|med|deep))(?=\s|$|[.,;:)])/gi;
const TAG_RE = /(^|\s)(#([\p{L}\p{N}_-]+))/gu;
const WAITING_TAG_RE = /(^|\s)(@waiting)(?=\s|$|[.,;:)])/gi;
const WAITING_ON_RE = /\bwaiting\s+on\s+/i;

const MONTH = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const WEEKDAY_FULL = '(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)';

/** Phrases we trust as dates; guards against chrono over-matching ("may", "sat", "1"). */
const DATE_GUARDS: RegExp[] = [
  /\b(?:today|tomorrow|tmrw|tonight|yesterday|noon|midnight|eod)\b/i,
  new RegExp(`\\b(?:next|this|last)\\s+(?:${WEEKDAY_FULL}|week|weekend|month|year|${MONTH})\\b`, 'i'),
  new RegExp(`\\b${WEEKDAY_FULL}\\b`, 'i'),
  /\bin\s+(?:\d+|an?|one|two|three|four|five|six|seven|ten)\s+(?:minute|min|hour|day|week|month|year)s?\b/i,
  new RegExp(`\\b${MONTH}\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?\\b`, 'i'),
  new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH}\\b`, 'i'),
  /\b\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?\b/,
  /\b\d{4}-\d{2}-\d{2}\b/,
  /\b\d{1,2}:\d{2}\b/,
  /\b\d{1,2}\s*(?:am|pm|a\.m\.|p\.m\.)(?![a-z])/i,
];

function maskRange(s: string, start: number, end: number): string {
  return s.slice(0, start) + MASK.repeat(end - start) + s.slice(end);
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function parseQuickAdd(
  input: string,
  existingTags: { id: string; name: string }[],
  now: Date,
): Parsed {
  const tokens: Token[] = [];
  let masked = input;
  let urgency: Urgency = 0;
  let effort: Effort | undefined;
  let status: 'open' | 'waiting' = 'open';
  let waitingOn: string | undefined;
  let due: Parsed['due'];
  const tags: string[] = [];

  const add = (kind: TokenKind, start: number, end: number) => {
    tokens.push({ kind, start, end, text: input.slice(start, end) });
    masked = maskRange(masked, start, end);
  };

  // Explicit tokens (matched against the original so offsets line up).
  for (const m of input.matchAll(URGENCY_RE)) {
    const text = m[2];
    const start = (m.index ?? 0) + m[1].length;
    const word = text.slice(1).toLowerCase();
    urgency = text.startsWith('!') && /^!+$/.test(text) ? (text.length as Urgency) : URGENCY_WORDS[word];
    add('urgency', start, start + text.length);
  }
  for (const m of input.matchAll(EFFORT_RE)) {
    const start = (m.index ?? 0) + m[1].length;
    effort = EFFORT_WORDS[m[2].slice(1).toLowerCase()];
    add('effort', start, start + m[2].length);
  }
  for (const m of input.matchAll(TAG_RE)) {
    const start = (m.index ?? 0) + m[1].length;
    const typed = m[3].toLowerCase();
    const existing = existingTags.find((t) => t.name.toLowerCase() === typed);
    const name = existing ? existing.name.toLowerCase() : typed;
    if (!tags.includes(name)) tags.push(name);
    add('tag', start, start + m[2].length);
  }
  for (const m of input.matchAll(WAITING_TAG_RE)) {
    const start = (m.index ?? 0) + m[1].length;
    status = 'waiting';
    add('waiting', start, start + m[2].length);
  }

  // Natural-language date (on a copy where masked ranges are blanked).
  const chronoText = masked.split(MASK).join(' ');
  for (const r of chrono.parse(chronoText, now, { forwardDate: true })) {
    if (!DATE_GUARDS.some((g) => g.test(r.text))) continue;
    const d = r.start.date();
    due = { date: toISODate(d) };
    if (r.start.isCertain('hour')) {
      due.time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    add('due', r.index, r.index + r.text.length);
    break;
  }

  // "waiting on X": X runs up to the next token (or end).
  const wm = WAITING_ON_RE.exec(masked);
  if (wm) {
    const start = wm.index;
    const valueStart = start + wm[0].length;
    // eslint-disable-next-line no-control-regex
    const rest = /^[^\u0000]*/.exec(masked.slice(valueStart))?.[0] ?? '';
    const value = rest.trim();
    const end = valueStart + rest.trimEnd().length;
    status = 'waiting';
    if (value) waitingOn = value;
    add('waiting', start, value ? end : start + wm[0].trimEnd().length);
  }

  tokens.sort((a, b) => a.start - b.start);

  let title = collapse(removeRanges(input, tokens));
  if (!title) {
    title = input.trim();
    due = undefined;
    const i = tokens.findIndex((t) => t.kind === 'due');
    if (i >= 0) tokens.splice(i, 1);
  }

  const out: Parsed = { title, urgency, tags, status, tokens };
  if (due) out.due = due;
  if (effort) out.effort = effort;
  if (waitingOn) out.waitingOn = waitingOn;
  return out;
}

function removeRanges(s: string, tokens: Token[]): string {
  let out = '';
  let pos = 0;
  for (const t of tokens) {
    out += s.slice(pos, t.start) + ' ';
    pos = t.end;
  }
  return out + s.slice(pos);
}

function collapse(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}
