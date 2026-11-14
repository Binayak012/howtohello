// Chapter 3 rules: explore numbers 1–5, fill Lila's basket on request, then name a count.
export const appleCount = 5;
/** How many apples Lila asks for, in order. */
export const rounds = [3, 1, 4] as const;
/** Lila fills the basket herself and asks how many there are. */
export const recall = [
  { count: 5, options: [2, 5, 3] },
  { count: 2, options: [4, 1, 2] },
] as const;

export type CountingState = { seen: number[]; round: number; basket: number; recall: number; misses: number };
export const initialCounting = (): CountingState => ({ seen: [], round: 0, basket: 0, recall: 0, misses: 0 });

export function seeNumber(state: CountingState, value: number): CountingState {
  return value < 1 || value > appleCount || state.seen.includes(value) ? state : { ...state, seen: [...state.seen, value] };
}
export const canStartCounting = (state: CountingState) => state.seen.length === appleCount;
export const counted = (state: CountingState) => state.round >= rounds.length;
export const recalled = (state: CountingState) => state.recall >= recall.length;

export function addApple(state: CountingState): CountingState {
  return canStartCounting(state) && !counted(state) && state.basket < appleCount ? { ...state, basket: state.basket + 1 } : state;
}
export function removeApple(state: CountingState): CountingState {
  return state.basket > 0 && !counted(state) ? { ...state, basket: state.basket - 1 } : state;
}
/** Hands the basket over; an exact count moves to the next request and empties the basket. */
export function giveBasket(state: CountingState): { state: CountingState; correct: boolean } {
  if (!canStartCounting(state) || counted(state)) return { state, correct: false };
  if (state.basket === rounds[state.round]) return { state: { ...state, round: state.round + 1, basket: 0 }, correct: true };
  return { state: { ...state, misses: state.misses + 1 }, correct: false };
}
export function answerCount(state: CountingState, value: number): { state: CountingState; correct: boolean } {
  const question = recall[state.recall];
  if (!counted(state) || !question) return { state, correct: false };
  if (question.count === value) return { state: { ...state, recall: state.recall + 1 }, correct: true };
  return { state: { ...state, misses: state.misses + 1 }, correct: false };
}
