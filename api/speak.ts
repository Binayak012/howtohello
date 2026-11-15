/**
 * Voices for the shopkeeper and market neighbors: GET /api/speak?who=shop&text=नमस्ते
 *
 * Turns one short Nepali line into speech with OpenAI text-to-speech. Each character has a voice and a
 * speaking style. It is a GET request with a long cache, so Vercel's CDN keeps every line it has spoken once:
 * repeats (greetings, common answers) cost nothing. The key stays on the server (OPENAI_API_KEY).
 */
const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;

const slow = 'Speak Nepali with natural native pronunciation, slowly and clearly, because the listener is a beginner learning Nepali.';
const voices: Record<string, { voice: string; style: string }> = {
  shop: { voice: 'ash', style: `You are a kind, older shopkeeper in a small corner shop. Warm and patient. ${slow}` },
  fruit: { voice: 'coral', style: `You are Maya, a cheerful young fruit seller at a morning market. Bright and friendly. ${slow}` },
  bread: { voice: 'onyx', style: `You are Arun, a friendly baker with a deep, relaxed voice. ${slow}` },
  flowers: { voice: 'shimmer', style: `You are Tara, a gentle, soft-spoken flower seller. ${slow}` },
  family: { voice: 'sage', style: `You are a worried but kind parent whose child lost a teddy. ${slow}` },
};

const fail = (status: number, error: string) => new Response(JSON.stringify({ error }), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

async function speech(key: string, body: Record<string, unknown>) {
  return fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ ...body, response_format: 'mp3' }),
    signal: AbortSignal.timeout(20000),
  });
}

export async function GET(request: Request): Promise<Response> {
  const key = env.OPENAI_API_KEY?.trim();
  if (!key) return fail(503, 'not-configured');
  const params = new URL(request.url).searchParams;
  const who = params.get('who') ?? '', text = (params.get('text') ?? '').replace(/\s+/g, ' ').trim();
  const character = voices[who];
  // Short lines only: these are spoken replies, and the limit keeps the cost of each request tiny.
  if (!character || !text || text.length > 200) return fail(400, 'bad-request');

  const model = env.OPENAI_TTS_MODEL?.trim() || 'gpt-4o-mini-tts';
  try {
    let response = await speech(key, { model, voice: character.voice, input: text, instructions: character.style });
    // Older speech models don't take a speaking style; try once more with the basic model.
    if (!response.ok && ![401, 403, 429].includes(response.status)) response = await speech(key, { model: 'tts-1', voice: 'alloy', input: text });
    if (!response.ok) {
      // Pass on OpenAI's reason (never the key), so a missing permission or model is easy to spot.
      const detail = await response.json().catch(() => ({})) as { error?: { message?: string; code?: string } };
      return new Response(JSON.stringify({ error: 'voice-unavailable', status: response.status, reason: detail.error?.code ?? detail.error?.message?.slice(0, 200) }), { status: 502, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
    }
    return new Response(await response.arrayBuffer(), {
      headers: { 'content-type': 'audio/mpeg', 'cache-control': 'public, max-age=86400, s-maxage=31536000, immutable' },
    });
  } catch {
    return fail(502, 'voice-unavailable');
  }
}
