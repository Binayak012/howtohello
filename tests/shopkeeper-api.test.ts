import test from 'node:test';
import assert from 'node:assert/strict';
import { POST } from '../api/shopkeeper.ts';

const ask = (body: unknown) => POST(new Request('http://localhost/api/shopkeeper', { method: 'POST', body: JSON.stringify(body) }));
const realFetch = globalThis.fetch;

test('without a key the neighbors say they are not set up, so the game falls back', async () => {
  delete process.env.OPENAI_API_KEY;
  const response = await ask({ neighbor: 'shop', stage: 'ask', message: 'chiya kahaa chha?' });
  assert.equal(response.status, 503);
});

test('the shopkeeper is told exactly where each shelf is, and only valid places and words get through', async () => {
  process.env.OPENAI_API_KEY = 'test-key';
  let sent: { model: string; messages: { role: string; content: string }[] } | undefined;
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    sent = JSON.parse(String(init.body));
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ nepali: 'चिया तपाईंको दायाँ छ।', roman: 'chiya tapaaiko daayaa chha.', english: 'The tea is on your right.', tip: '', success: true }) } }] }));
  }) as typeof fetch;
  try {
    const response = await ask({
      neighbor: 'shop', stage: 'ask', message: 'chiya kahaa chha?', history: [], mistakes: 0, hints: 0, completed: 1,
      shop: { places: { tea: ['right'], fruit: ['forward', 'left'], counter: ['forward'], spaceship: ['left'], bag: ['sideways'] }, want: 'tea', facing: 'fruit' },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { nepali: 'चिया तपाईंको दायाँ छ।', roman: 'chiya tapaaiko daayaa chha.', english: 'The tea is on your right.', tip: '', success: true });
    const context = sent!.messages[1].content;
    assert.match(context, /tea \(चिया\): दायाँ \(on the right\)/);
    assert.match(context, /fruit \(फलफूल\): अगाडि \(ahead\) \+ बायाँ \(on the left\) \(right in front of them/);
    assert.match(context, /On their list right now: tea/);
    assert.doesNotMatch(context, /spaceship|sideways|bags/);
    assert.equal(sent!.messages.at(-1)!.content, 'chiya kahaa chha?');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('unknown neighbors and empty messages are refused before reaching the AI', async () => {
  process.env.OPENAI_API_KEY = 'test-key';
  assert.equal((await ask({ neighbor: 'dragon', stage: 'ask', message: 'hi' })).status, 400);
  assert.equal((await ask({ neighbor: 'shop', stage: 'ask', message: '   ' })).status, 400);
});
