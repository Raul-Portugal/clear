// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './parse-dump';

let ipCounter = 0;
function req(body: unknown, opts: { method?: string; ip?: string } = {}): Request {
  return new Request('http://localhost/api/parse-dump', {
    method: opts.method ?? 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': opts.ip ?? `10.0.0.${++ipCounter}` },
    body: opts.method === 'GET' ? undefined : JSON.stringify(body),
  });
}
const valid = { text: 'call mum tomorrow', tags: ['home'], today: '2026-10-29' };

function anthropicOk(input: unknown): Response {
  return new Response(
    JSON.stringify({ content: [{ type: 'tool_use', name: 'create_tasks', input }] }),
    { status: 200 },
  );
}

describe('parse-dump', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-secret');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('returns proposed tasks with ids', async () => {
    fetchMock.mockResolvedValue(
      anthropicOk({
        tasks: [
          { title: 'Call mum', due: { date: '2026-10-30' }, urgency: 1, tags: ['home'], status: 'open', subtasks: [] },
          { title: 'Chase invoice', urgency: 2, tags: [], status: 'waiting', waitingOn: 'Ana', subtasks: ['Email'] },
        ],
      }),
    );
    const res = await handler(req(valid));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { tasks: { id: string; title: string }[] };
    expect(body.tasks.map((t) => t.id)).toEqual(['p1', 'p2']);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect((init.headers as Record<string, string>)['x-api-key']).toBe('sk-secret');
    expect(JSON.parse(init.body as string).tool_choice).toEqual({ type: 'tool', name: 'create_tasks' });
  });

  it('rejects invalid body with 400', async () => {
    expect((await handler(req({ text: '', tags: [], today: '2026-10-29' }))).status).toBe(400);
    expect((await handler(req({ ...valid, text: 'x'.repeat(8001) }))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects wrong method with 405', async () => {
    expect((await handler(req(null, { method: 'GET' }))).status).toBe(405);
  });

  it('returns 500 without leaking when key missing', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    const res = await handler(req(valid));
    expect(res.status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 502 on upstream failure without leaking the body', async () => {
    fetchMock.mockResolvedValue(new Response('secret upstream detail sk-secret', { status: 500 }));
    const res = await handler(req(valid));
    expect(res.status).toBe(502);
    const text = await res.text();
    expect(text).not.toContain('secret');
    fetchMock.mockRejectedValue(new Error('network'));
    expect((await handler(req(valid))).status).toBe(502);
  });

  it('returns 502 on schema-invalid output', async () => {
    fetchMock.mockResolvedValue(anthropicOk({ tasks: [{ title: 'x', urgency: 9, tags: [], status: 'open', subtasks: [] }] }));
    expect((await handler(req(valid))).status).toBe(502);
  });

  it('rate limits per IP', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(anthropicOk({ tasks: [] })));
    const ip = '192.168.1.1';
    for (let i = 0; i < 10; i++) expect((await handler(req(valid, { ip }))).status).toBe(200);
    expect((await handler(req(valid, { ip }))).status).toBe(429);
    expect((await handler(req(valid, { ip: '192.168.1.2' }))).status).toBe(200);
  });
});
