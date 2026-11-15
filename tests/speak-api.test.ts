import test from 'node:test';
import assert from 'node:assert/strict';
import { GET } from '../api/speak.ts';

const say = (query: string) => GET(new Request(`http://localhost/api/speak?${query}`));
const realFetch = globalThis.fetch;

test('without a key the voices stay quiet, and the game keeps showing text', async () => {
  delete process.env.OPENAI_API_KEY;
  assert.equal((await say('who=shop&text=नमस्ते')).status, 503);
});

test('each character speaks in their own voice and style, and lines are cached for repeats', async () => {
  process.env.OPENAI_API_KEY = ' test-key\n';
  const sent: Record<string, unknown>[] = [];
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    assert.equal((init.headers as Record<string, string>).authorization, 'Bearer test-key');
    sent.push(JSON.parse(String(init.body)));
    return new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'audio/mpeg' } });
  }) as typeof fetch;
  try {
    const response = await say(`who=shop&text=${encodeURIComponent('चिया तपाईंको दायाँ छ।')}`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'audio/mpeg');
    assert.match(response.headers.get('cache-control')!, /s-maxage=31536000/);
    assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [1, 2, 3]);
    assert.equal(sent[0].input, 'चिया तपाईंको दायाँ छ।');
    assert.equal(sent[0].voice, 'ash');
    assert.match(String(sent[0].instructions), /shopkeeper.*slowly/s);
    await say(`who=fruit&text=${encodeURIComponent('नमस्ते!')}`);
    assert.equal(sent[1].voice, 'coral');
    assert.match(String(sent[1].instructions), /Maya/);
  } finally { globalThis.fetch = realFetch; }
});

test('if the styled voice model is unavailable, it falls back to the basic speech model', async () => {
  process.env.OPENAI_API_KEY = 'test-key';
  const models: unknown[] = [];
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)); models.push(body.model);
    return body.model === 'tts-1' ? new Response(new Uint8Array([9])) : new Response('{}', { status: 404 });
  }) as typeof fetch;
  try {
    assert.equal((await say('who=bread&text=hi')).status, 200);
    assert.deepEqual(models, ['gpt-4o-mini-tts', 'tts-1']);
  } finally { globalThis.fetch = realFetch; }
});

test('unknown characters and long text are refused before any cost', async () => {
  process.env.OPENAI_API_KEY = 'test-key';
  assert.equal((await say('who=dragon&text=hi')).status, 400);
  assert.equal((await say(`who=shop&text=${'क'.repeat(201)}`)).status, 400);
  assert.equal((await say('who=shop&text=')).status, 400);
});
