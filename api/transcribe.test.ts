import handler from './transcribe';

const post = (body: BodyInit = new Blob(['x'])) => new Request('http://x/api/transcribe', { method: 'POST', body });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('transcribe', () => {
  it('rejects non-POST', async () => {
    expect((await handler(new Request('http://x', { method: 'GET' }))).status).toBe(405);
  });
  it('501 when not configured', async () => {
    vi.stubEnv('TRANSCRIBE_API_URL', '');
    expect((await handler(post())).status).toBe(501);
  });
  it('returns text on success', async () => {
    vi.stubEnv('TRANSCRIBE_API_URL', 'http://p');
    vi.stubEnv('TRANSCRIBE_API_KEY', 'k');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ text: 'hello' }))));
    const res = await handler(post());
    expect(await res.json()).toEqual({ text: 'hello' });
  });
  it('502 on upstream failure without leaking details', async () => {
    vi.stubEnv('TRANSCRIBE_API_URL', 'http://p');
    vi.stubEnv('TRANSCRIBE_API_KEY', 'secret');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('boom secret', { status: 500 })));
    const res = await handler(post());
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain('secret');
  });
});
