/** Plays what the AI shopkeeper and neighbors say (see api/speak.ts). One line at a time; silent if voices are unavailable. */
import { neighborAiAvailable } from './shopkeeper-ai';

export type Speaker = 'shop' | 'fruit' | 'bread' | 'flowers' | 'family';
type Hooks = { start?: () => void; end?: () => void };

const audio = typeof Audio === 'undefined' ? undefined : new Audio();
let hooks: Hooks = {};
let playing = false;
let failures = 0;

function finish() {
  if (!playing) return;
  playing = false; hooks.end?.();
}
audio?.addEventListener('ended', finish);
audio?.addEventListener('pause', finish);
// A voice that fails (no key, no audio permission) twice in a row stays quiet for the rest of the visit.
audio?.addEventListener('error', () => { failures++; finish(); });
audio?.addEventListener('playing', () => { failures = 0; });

export const speechUrl = (who: Speaker, text: string) => `/api/speak?who=${who}&text=${encodeURIComponent(text)}`;

/** Say one Nepali line in this character's voice, replacing anything still playing. */
export function speakLine(who: Speaker, text: string, lineHooks: Hooks = {}) {
  if (!audio || !text || failures >= 2 || !neighborAiAvailable()) return;
  stopSpeaking();
  hooks = lineHooks;
  audio.src = speechUrl(who, text);
  playing = true; hooks.start?.();
  audio.play().catch(() => finish());
}

export function stopSpeaking() {
  if (!audio) return;
  audio.pause(); finish();
}
