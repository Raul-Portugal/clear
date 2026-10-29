/**
 * Server transcription fallback for browsers without the Web Speech API.
 * Provider-agnostic: any OpenAI-compatible `/audio/transcriptions` endpoint
 * (set TRANSCRIBE_API_URL, TRANSCRIBE_API_KEY, optional TRANSCRIBE_MODEL). Keys stay server-side.
 */
const MAX_BYTES = 10 * 1024 * 1024;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const url = process.env.TRANSCRIBE_API_URL;
  const key = process.env.TRANSCRIBE_API_KEY;
  if (!url || !key) return json({ error: 'Transcription is not configured' }, 501);

  const audio = await req.blob();
  if (audio.size === 0) return json({ error: 'Empty audio' }, 400);
  if (audio.size > MAX_BYTES) return json({ error: 'Audio too large' }, 413);

  const form = new FormData();
  form.append('file', audio, 'note.webm');
  form.append('model', process.env.TRANSCRIBE_MODEL ?? 'whisper-1');
  try {
    const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form });
    if (!res.ok) return json({ error: 'Upstream error' }, 502);
    const data = (await res.json()) as { text?: unknown };
    return json({ text: typeof data.text === 'string' ? data.text : '' });
  } catch {
    return json({ error: 'Upstream error' }, 502);
  }
}
