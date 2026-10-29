import { z } from 'zod';
import { toISODate } from '../../domain/dates';
import type { ProposedTask } from '../../domain/proposed';
import { splitDump } from '../../domain/splitDump';

const responseSchema = z.object({ tasks: z.array(z.custom<ProposedTask>((v) => typeof v === 'object' && v !== null)) });

export interface OrganizeResult {
  tasks: ProposedTask[];
  /** True when AI was requested but the local splitter was used instead. */
  fellBack: boolean;
}

/** Local splitter, or the AI endpoint when enabled and online; falls back locally on any failure. */
export async function organize(
  text: string,
  tags: { id: string; name: string }[],
  smart: boolean,
  now = new Date(),
): Promise<OrganizeResult> {
  const local = () => splitDump(text, tags, now);
  if (!smart || !navigator.onLine) return { tasks: local(), fellBack: smart };
  try {
    const res = await fetch('/api/parse-dump', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, tags: tags.map((t) => t.name), today: toISODate(now) }),
    });
    if (!res.ok) throw new Error(String(res.status));
    const parsed = responseSchema.parse(await res.json());
    if (parsed.tasks.length === 0) throw new Error('empty');
    return { tasks: parsed.tasks, fellBack: false };
  } catch {
    return { tasks: local(), fellBack: true };
  }
}
