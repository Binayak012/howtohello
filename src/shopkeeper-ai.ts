/** Browser side of the AI market neighbors (see api/shopkeeper.ts). */
export type NeighborTurn = { role: 'learner' | 'neighbor'; text: string };
export type NeighborReply = { nepali: string; roman: string; english: string; tip: string; success: boolean };
export type NeighborQuestion = {
  neighbor: string; stage: string; message: string; history: NeighborTurn[];
  mistakes: number; hints: number; completed: number; mismatch?: number;
  /** Shop only: where each shelf, the counter and the door are from where the learner stands. */
  shop?: { places: Record<string, string[]>; want?: string; facing?: string };
};

// Automated test browsers keep the scripted market unless a test asks for the AI with ?ai.
const params = typeof location === 'undefined' ? new URLSearchParams() : new URLSearchParams(location.search);
let available = !(typeof navigator !== 'undefined' && navigator.webdriver) || params.has('ai');
/** Whether to offer typing to neighbors. Turns off for the visit if the server has no AI key. */
export const neighborAiAvailable = () => available;

export async function askNeighbor(question: NeighborQuestion): Promise<NeighborReply> {
  const response = await fetch('/api/shopkeeper', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(question), signal: AbortSignal.timeout(20000),
  });
  if (response.status === 503 || response.status === 404) available = false;
  if (!response.ok) throw new Error(`Neighbor unavailable (${response.status})`);
  return await response.json() as NeighborReply;
}
