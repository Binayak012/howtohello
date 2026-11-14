export type Facing = 'N' | 'E' | 'S' | 'W';
export type Player = { col: number; row: number; facing: Facing };
export type Item = 'fruit' | 'book' | 'bottle' | 'bag';
export type Rack = { id: string; col: number; row: number; item: Item };
export const DIRECTIONS: Facing[] = ['N', 'E', 'S', 'W'];
export const DELTA: Record<Facing, [number, number]> = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
export const start = (): Player => ({ col: 4, row: 7, facing: 'N' });
export const racks: Rack[] = [
  [2, 3, 'fruit'], [2, 4, 'book'], [2, 6, 'bottle'], [2, 7, 'bag'],
  [6, 6, 'fruit'], [6, 4, 'book'], [6, 3, 'bottle'], [6, 7, 'bag'],
].map(([col, row, item]) => ({ id: `rack_${col}_${row}`, col: Number(col), row: Number(row), item: item as Item }));

export function blocked(col: number, row: number): boolean {
  if (col < 1 || col > 7 || row < 1 || row > 7) return true;
  if (col === 1 || col === 7) return true;
  if (row === 1 && col >= 2 && col <= 6) return true;
  // Checkout desk occupies the two rear rows; keep players on its customer side.
  if (row === 2 && col >= 3 && col <= 5) return true;
  return racks.some(r => r.col === col && r.row === row);
}
export function turn(player: Player, direction: -1 | 1): Player {
  return { ...player, facing: DIRECTIONS[(DIRECTIONS.indexOf(player.facing) + direction + 4) % 4] };
}
export function step(player: Player, backwards = false, canExit = false): Player {
  const [dx, dz] = DELTA[player.facing];
  const multiplier = backwards ? -1 : 1;
  const col = player.col + dx * multiplier, row = player.row + dz * multiplier;
  const doorway = canExit && col === 4 && (row === 8 || row === 9);
  return !doorway && blocked(col, row) ? player : { ...player, col, row };
}
export const atCheckout = (player: Player) => player.col === 4 && player.row === 3 && player.facing === 'N';
export const outside = (player: Player) => player.col === 4 && player.row === 9;
export function facedRack(player: Player): Rack | undefined {
  const [dx, dz] = DELTA[player.facing];
  for (let distance = 1; distance <= 2; distance++) {
    const col = player.col + dx * distance, row = player.row + dz * distance;
    const rack = racks.find(r => r.col === col && r.row === row);
    if (rack) return rack;
    if (blocked(col, row)) break;
  }
}

export type Beat = { cue: string; expect: string };
export const baseBeats: Beat[] = [
  { cue: 'take.left.bag', expect: 'take:rack_2_7' },
  { cue: 'take.right.fruit', expect: 'take:rack_6_6' },
  { cue: 'take.left.fruit', expect: 'take:rack_2_3' },
  { cue: 'take.right.bottle', expect: 'take:rack_6_3' },
];

// Exhaustively validate reachability using the very same rules as play.
export function routeTo(player: Player, expect: string): string[] | null {
  const queue: { player: Player; actions: string[] }[] = [{ player, actions: [] }];
  const visited = new Set<string>();
  for (let index = 0; index < queue.length; index++) {
    const current = queue[index];
    const key = `${current.player.col},${current.player.row},${current.player.facing}`;
    if (visited.has(key)) continue;
    visited.add(key);
    if (expect === `face:${current.player.facing}`) return current.actions;
    if (expect === `take:${facedRack(current.player)?.id}`) return [...current.actions, 'take'];
    if (expect === `at:${current.player.col},${current.player.row},${current.player.facing}`) return current.actions;
    if (expect === 'exit' && outside(current.player)) return current.actions;
    for (const [action, next] of [
      ['forward', step(current.player, false, expect === 'exit')], ['backward', step(current.player, true, expect === 'exit')],
      ['left', turn(current.player, -1)], ['right', turn(current.player, 1)],
    ] as const) queue.push({ player: next, actions: [...current.actions, action] });
  }
  return null;
}

export function reviewBeat(history: { item: Item; misses: number; helped: boolean }[]): Beat {
  const weakest = [...history].sort((a, b) => (b.misses * 2 + Number(b.helped)) - (a.misses * 2 + Number(a.helped)))[0];
  const item = weakest?.item ?? 'bag';
  // Pick a fresh rack so reviewing an item always remains possible.
  const rack = racks.find(r => r.item === item && r.col === 6)!;
  return { cue: `review.${item}`, expect: `take:${rack.id}` };
}
