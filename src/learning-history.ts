import type { ProgressStore } from './progression';
const key = 'wayword.learning.v1';
export type LearningHistory = { started: string[]; lastLanguage: string | null };

export function readLearningHistory(storage: ProgressStore): LearningHistory {
  try {
    const data = JSON.parse(storage.getItem(key) ?? 'null');
    if (!data || !Array.isArray(data.started)) return { started: [], lastLanguage: null };
    const started: string[] = [...new Set<string>(data.started.filter((id: unknown) => typeof id === 'string'))];
    return { started, lastLanguage: started.includes(data.lastLanguage) ? data.lastLanguage : null };
  } catch { return { started: [], lastLanguage: null }; }
}
export function recordLanguageStarted(storage: ProgressStore, language: string): void {
  const previous = readLearningHistory(storage);
  try {
    storage.setItem(key, JSON.stringify({ started: [...new Set([...previous.started, language])], lastLanguage: language }));
  } catch { /* Browsing and playing never depend on storage availability. */ }
}
