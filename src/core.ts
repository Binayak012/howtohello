export type Facing = 'N' | 'E' | 'S' | 'W';
export type Player = { col: number; row: number; facing: Facing };
export type Item = 'fruit' | 'veg' | 'tea' | 'bag' | 'bottle' | 'rice' | 'snack' | 'book';
export type Rack = { id: string; col: number; row: number; item: Item };
export const DIRECTIONS: Facing[] = ['N', 'E', 'S', 'W'];
export const DELTA: Record<Facing, [number, number]> = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
export const start = (): Player => ({ col: 4, row: 7, facing: 'N' });
// Eight different shelves, so a direction word always points to exactly one product.
// Left and right are as you walk in: the left wall is col 2, the right wall col 6.
export const racks: Rack[] = [
  [2, 3, 'fruit'], [2, 4, 'veg'], [2, 6, 'tea'], [2, 7, 'bag'],
  [6, 3, 'bottle'], [6, 4, 'rice'], [6, 6, 'snack'], [6, 7, 'book'],
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
export const atShopDoor = (player: Player) => player.col === 4 && player.row === 7 && player.facing === 'S';
export function facedRack(player: Player): Rack | undefined {
  const [dx, dz] = DELTA[player.facing];
  for (let distance = 1; distance <= 2; distance++) {
    const col = player.col + dx * distance, row = player.row + dz * distance;
    const rack = racks.find(r => r.col === col && r.row === row);
    if (rack) return rack;
    if (blocked(col, row)) break;
  }
}

export type Beat = { item: Item; expect: string };
export const baseBeats: Beat[] = [
  { item: 'bag', expect: 'take:rack_2_7' },
  { item: 'snack', expect: 'take:rack_6_6' },
  { item: 'fruit', expect: 'take:rack_2_3' },
  { item: 'bottle', expect: 'take:rack_6_3' },
];
export const rackFor = (beat: Beat) => racks.find(rack => `take:${rack.id}` === beat.expect)!;

export type Way = 'forward' | 'left' | 'right' | 'backward';
/**
 * Where a tile is from the player's point of view.
 * `angle` is in radians, 0 straight ahead and positive to the right.
 * `ways` is one word, or two for a diagonal ("ahead, on the left").
 */
export function relativeTo(player: Player, col: number, row: number): { angle: number; ways: Way[] } {
  const [fx, fz] = DELTA[player.facing];
  const [rx, rz] = DELTA[DIRECTIONS[(DIRECTIONS.indexOf(player.facing) + 1) % 4]];
  const dx = col - player.col, dz = row - player.row;
  const angle = Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz);
  const degrees = Math.abs(angle) * 180 / Math.PI, side: Way = angle > 0 ? 'right' : 'left';
  if (dx === 0 && dz === 0) return { angle: 0, ways: ['forward'] };
  if (degrees <= 22.5) return { angle, ways: ['forward'] };
  if (degrees >= 157.5) return { angle, ways: ['backward'] };
  if (degrees < 67.5) return { angle, ways: ['forward', side] };
  if (degrees > 112.5) return { angle, ways: ['backward', side] };
  return { angle, ways: [side] };
}

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
    if (expect === 'door' && atShopDoor(current.player)) return current.actions;
    for (const [action, next] of [
      ['forward', step(current.player, false, expect === 'exit')],
      // Exit guidance turns the learner toward the door before walking forward.
      ...(expect === 'exit' || expect === 'door' ? [] : [['backward', step(current.player, true)] as const]),
      ['left', turn(current.player, -1)], ['right', turn(current.player, 1)],
    ] as const) queue.push({ player: next, actions: [...current.actions, action] });
  }
  return null;
}

export function reviewBeat(history: { item: Item; misses: number; helped: boolean }[]): Beat {
  const weakest = [...history].sort((a, b) => (b.misses * 2 + Number(b.helped)) - (a.misses * 2 + Number(a.helped)))[0];
  const item = weakest?.item ?? 'bag';
  const rack = racks.find(r => r.item === item)!;
  return { item, expect: `take:${rack.id}` };
}
