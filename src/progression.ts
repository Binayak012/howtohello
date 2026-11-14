const progressKey = 'wayword.progress.ne.v1';
export const journey = [
  {id:'moving-in',chapter:1,title:'Your First Hello',subtitle:'Move in, meet your host, and find your first words.',route:'moving-in',implemented:true},
  {id:'second-lesson',chapter:2,title:'Unpack Your Suitcase',subtitle:'Settle into your room and learn five colors.',route:'second-lesson',implemented:true},
  {id:'little-shop',chapter:3,title:'The Little Shop',subtitle:'Use directions to complete your first errand.',route:'shop',implemented:true},
  {id:'next-adventure',chapter:4,title:'The Morning Market',subtitle:'The finale: greetings, directions, numbers and real interactions.',route:'market',implemented:true},
] as const;
export type LevelId = typeof journey[number]['id'];
const orderedLevels:LevelId[]=journey.map(level=>level.id);
export type ProgressStore = Pick<Storage, 'getItem' | 'setItem'>;

export function completedLevels(storage: ProgressStore): LevelId[] {
  try {
    const data: unknown = JSON.parse(storage.getItem(progressKey) ?? '[]');
    return Array.isArray(data) ? orderedLevels.filter(id => data.includes(id)) : [];
  } catch { return []; }
}
export function isUnlocked(id: LevelId, completed: readonly LevelId[]): boolean {
  // Existing shop/market saves retain access without inventing new completions.
  if(completed.includes(id))return true;
  if(id==='next-adventure'&&completed.includes('little-shop'))return true;
  const index = orderedLevels.indexOf(id);
  return index === 0 || (index > 0 && orderedLevels.slice(0, index).every(previous => completed.includes(previous)));
}
export function completeLevel(storage: ProgressStore, id: LevelId): boolean {
  if(!journey.find(level=>level.id===id)?.implemented)return false;
  const completed = completedLevels(storage);
  if (!isUnlocked(id, completed)) return false;
  try {
    storage.setItem(progressKey, JSON.stringify([...new Set([...completed, id])]));
    return true;
  } catch { return false; }
}
