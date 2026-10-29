import { parseQuickAdd } from './parseQuickAdd';
import type { ProposedTask } from './proposed';

const BULLET_RE = /^(?:[-*•]|\d{1,3}[.)])\s+/;
const CHECKBOX_RE = /^\[[ xX]?\]\s*/;

const FILLER_RE =
  /^(?:(?:also|and|then|plus)[\s,:-]+|(?:to-?do|to do)\s*:\s*|(?:i\s+)?(?:need|needs|have|want|got|gotta)\s+to\s+|i\s+(?:should|must|ought to)\s+|remember\s+to\s+|(?:don'?t|do not)\s+forget\s+to\s+|(?:don'?t|do not)\s+forget\s*:\s*)/i;

const ABBREVIATIONS = new Set([
  'e.g', 'i.e', 'etc', 'vs', 'mr', 'mrs', 'ms', 'dr', 'prof', 'st', 'no',
  'approx', 'inc', 'jr', 'sr', 'fig', 'cf', 'ca', 'min', 'max',
]);

const THEN_RE = /\s+(?:and then|then)\s+/i;
const MIN_THEN_WORDS = 3;

function wordCount(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

function indentOf(line: string): number {
  const lead = /^[ \t]*/.exec(line)?.[0] ?? '';
  let n = 0;
  for (const ch of lead) n += ch === '\t' ? 4 : 1;
  return n;
}

function stripFiller(s: string): string {
  let out = s.trim();
  for (let i = 0; i < 4; i++) {
    const next = out.replace(FILLER_RE, '').trim();
    if (!next || next === out) break;
    out = next;
  }
  return out;
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function hasContent(s: string): boolean {
  return /[\p{L}\p{N}]/u.test(s);
}

/** True when the punctuation at `idx` ends an abbreviation, initial or urgency token rather than a sentence. */
function isFalseBoundary(text: string, idx: number): boolean {
  const ch = text[idx];
  if (ch === '!') {
    // Urgency tokens like "!!" or " !" are not sentence ends.
    return idx === 0 || /[\s!]/.test(text[idx - 1]);
  }
  if (ch !== '.') return false;
  const word = /[\p{L}\p{N}.]+$/u.exec(text.slice(0, idx))?.[0].toLowerCase() ?? '';
  if (!word) return true;
  if (ABBREVIATIONS.has(word)) return true;
  if (/^\p{L}$/u.test(word)) return true; // single-letter initial
  return false;
}

function splitSentences(text: string): string[] {
  const parts: string[] = [];
  let start = 0;
  const re = /([.!?;])\s+(?=\p{Lu})|(;)\s+(?=\p{L})/gu;
  for (const m of text.matchAll(re)) {
    const idx = m.index ?? 0;
    if (isFalseBoundary(text, idx)) continue;
    const left = text.slice(start, idx + 1);
    const right = text.slice(idx + m[0].length);
    if (m[0].startsWith(';') && (wordCount(left) < 2 || wordCount(right) < 2)) continue;
    parts.push(left);
    start = idx + m[0].length;
  }
  parts.push(text.slice(start));
  return parts;
}

function splitThen(piece: string): string[] {
  const out: string[] = [];
  let rest = piece;
  for (;;) {
    const m = THEN_RE.exec(rest);
    if (!m) break;
    const left = rest.slice(0, m.index);
    const right = rest.slice(m.index + m[0].length);
    if (wordCount(left) < MIN_THEN_WORDS || wordCount(right) < MIN_THEN_WORDS) break;
    out.push(left);
    rest = right;
  }
  out.push(rest);
  return out;
}

function cleanTitle(s: string): string {
  return capitalize(stripFiller(s).replace(/[\s.,;:!?]+$/, '').trim());
}

export function splitDump(
  text: string,
  existingTags: { id: string; name: string }[],
  now: Date,
): ProposedTask[] {
  const tasks: ProposedTask[] = [];
  let topIndent = 0;

  const makeTask = (raw: string): ProposedTask | null => {
    const lead = stripFiller(raw.replace(/[\s.,;]+$/, ''));
    if (!hasContent(lead)) return null;
    const parsed = parseQuickAdd(lead, existingTags, now);
    const title = cleanTitle(parsed.title);
    if (!title || !hasContent(title)) return null;
    const task: ProposedTask = {
      id: '',
      title,
      urgency: parsed.urgency,
      tags: parsed.tags,
      status: parsed.status,
      subtasks: [],
    };
    if (parsed.due) task.due = parsed.due;
    if (parsed.effort) task.effort = parsed.effort;
    if (parsed.waitingOn) task.waitingOn = parsed.waitingOn;
    return task;
  };

  for (const rawLine of text.split(/\r?\n/)) {
    if (!rawLine.trim()) continue;
    const indent = indentOf(rawLine);
    const trimmed = rawLine.trim();
    const bullet = BULLET_RE.test(trimmed);
    const body = trimmed.replace(BULLET_RE, '').replace(CHECKBOX_RE, '').trim();
    if (!hasContent(body)) continue;

    const prev = tasks[tasks.length - 1];
    if (prev && bullet && indent >= topIndent + 2) {
      const sub = cleanTitle(body);
      if (hasContent(sub)) prev.subtasks.push(sub);
      continue;
    }

    topIndent = indent;
    for (const piece of splitSentences(body).flatMap(splitThen)) {
      const task = makeTask(piece);
      if (task) tasks.push(task);
    }
  }

  return tasks.map((t, i) => ({ ...t, id: `p${i + 1}` }));
}
