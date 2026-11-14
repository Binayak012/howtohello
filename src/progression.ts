const progressKey = 'wayword.progress.ne.v1';
const orderedLevels = ['little-shop', 'next-adventure', 'hidden-horizon'] as const;
export type LevelId = typeof orderedLevels[number];
export type ProgressStore = Pick<Storage, 'getItem' | 'setItem'>;

export function completedLevels(storage: ProgressStore): LevelId[] {
  try {
    const data: unknown = JSON.parse(storage.getItem(progressKey) ?? '[]');
    return Array.isArray(data) ? orderedLevels.filter(id => data.includes(id)) : [];
  } catch { return []; }
}
export function isUnlocked(id: LevelId, completed: readonly LevelId[]): boolean {
  const index = orderedLevels.indexOf(id);
  return index === 0 || (index > 0 && orderedLevels.slice(0, index).every(previous => completed.includes(previous)));
}
export function completeLevel(storage: ProgressStore, id: LevelId): boolean {
  const completed = completedLevels(storage);
  if (!isUnlocked(id, completed)) return false;
  try {
    storage.setItem(progressKey, JSON.stringify([...new Set([...completed, id])]));
    return true;
  } catch { return false; }
}
