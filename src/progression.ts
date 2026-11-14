const progressKey = 'wayword.progress.ne.v1';
export const journey = [
  {id:'moving-in',chapter:1,title:'Your First Hello',subtitle:'Move in, meet your host, and find your first words.',route:'moving-in',implemented:true},
  {id:'second-lesson',chapter:2,title:'Unpack Your Suitcase',subtitle:'Settle into your room and learn five colors.',route:'second-lesson',implemented:true},
  {id:'counting',chapter:3,title:'Counting with Lila',subtitle:'Help your neighbor fill her basket and learn numbers 1–5.',route:'counting',implemented:true},
  {id:'letters',chapter:4,title:'Your First Letters',subtitle:'Trace five Nepali vowels and hear how each one sounds.',route:'letters',implemented:true},
  {id:'little-shop',chapter:5,title:'The Little Shop',subtitle:'Use directions to complete your first errand.',route:'shop',implemented:true},
  {id:'next-adventure',chapter:6,title:'The Morning Market',subtitle:'The finale: greetings, colors, numbers and directions together.',route:'market',implemented:true},
] as const;
export type JourneyLevel = typeof journey[number];
/** Link to a chapter. The letters chapter lives on the website's tracing page, not inside the game bundle. */
export function levelHref(level: JourneyLevel, website: boolean): string {
  if (level.id === 'letters') return website ? '/unit/index.html' : `?level=${level.route}`;
  return `${website ? '/game/index.html' : ''}?level=${level.route}`;
}
export function nextLevel(id: JourneyLevel['id']): JourneyLevel | undefined {
  return journey[journey.findIndex(level => level.id === id) + 1];
}
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
