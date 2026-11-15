import { completedLevels, journey, type ProgressStore } from './progression.ts';
import { firstVowels, secondVowels, extraVowels, vowelOrder } from './vowel-curriculum.ts';
export type PracticeLetter = typeof vowelOrder[number];
export type WritingSetId = 'first-five' | 'second-five' | 'extra-vowels';
export const writingSets = [
  {id:'first-five', afterLesson:0, beforeLesson:5, letters:firstVowels},
  {id:'second-five', afterLesson:4, beforeLesson:9, letters:secondVowels},
  {id:'extra-vowels', afterLesson:8, beforeLesson:Infinity, letters:extraVowels},
] as const;
function key(set: WritingSetId) { return set === 'first-five' ? 'wayword.tracing.ne.v1' : `wayword.tracing.ne.${set}.v1`; }
export function tracedLetters(storage: ProgressStore, set: WritingSetId = 'first-five'): string[] {
  try {
    const value: unknown = JSON.parse(storage.getItem(key(set)) ?? '[]');
    const letters: readonly string[] = writingSets.find(item => item.id === set)!.letters;
    return Array.isArray(value) ? letters.filter(letter => value.includes(letter)) : [];
  } catch { return []; }
}
export function saveTracedLetter(storage: ProgressStore, letter: string, set: WritingSetId = 'first-five'): boolean {
  const letters: readonly string[] = writingSets.find(item => item.id === set)!.letters;
  if (!letters.includes(letter)) return false;
  try { storage.setItem(key(set), JSON.stringify([...new Set([...tracedLetters(storage,set), letter])])); return true; }
  catch { return false; }
}
export function tracingComplete(storage: ProgressStore, set: WritingSetId = 'first-five'): boolean {
  return tracedLetters(storage,set).length === writingSets.find(item => item.id === set)!.letters.length;
}
/** Main lesson progression is independent of writing until each prerequisite. */
export function canAccessLesson(chapter: number, stores: ProgressStore[]): boolean {
  return writingSets.filter(set => chapter >= set.beforeLesson).every(set =>
    new Set(stores.flatMap(storage => tracedLetters(storage,set.id))).size === set.letters.length);
}

/** Practice unlocks follow completed story lessons, independently of URL parameters. */
export function canPracticeSet(set: WritingSetId, stores: ProgressStore[]): boolean {
  const requirement = writingSets.find(item => item.id === set)!.afterLesson;
  if (requirement === 0) return true;
  const prerequisite = journey.find(level => Number(level.chapter) === requirement);
  return !!prerequisite && stores.some(storage => completedLevels(storage).includes(prerequisite.id));
}
