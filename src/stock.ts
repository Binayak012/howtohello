import { racks, type Item } from './core.ts';

export type ShelfUnit = { id: string; rackId: string; item: Item; tier: number; column: number; depth: number; taken: boolean };
export const layouts: Record<Item, { columns: number; depths: number; tiers: number[] }> = {
  fruit: { columns: 7, depths: 3, tiers: [.31, .69, 1.07] },
  bottle: { columns: 6, depths: 2, tiers: [.31, .69, 1.07] },
  book: { columns: 8, depths: 1, tiers: [.31, .69, 1.07] },
  bag: { columns: 3, depths: 2, tiers: [.31, .69, 1.07] },
};

export function createStock(): ShelfUnit[] {
  return racks.flatMap(rack => {
    const layout = layouts[rack.item];
    return layout.tiers.flatMap((_, tier) => Array.from({ length: layout.depths }, (_, depth) =>
      Array.from({ length: layout.columns }, (_, column) => ({
        id: `${rack.id}_${tier}_${depth}_${column}`, rackId: rack.id, item: rack.item, tier, column, depth, taken: false,
      })),
    ).flat());
  });
}

// Pick one front-row unit near eye level when Take is used without a pointer.
export function takeOne(stock: ShelfUnit[], rackId: string, unitId?: string): ShelfUnit | undefined {
  const candidates = stock.filter(unit => unit.rackId === rackId && !unit.taken);
  const unit = unitId ? candidates.find(unit => unit.id === unitId) : candidates.sort((a, b) =>
    Math.abs(a.tier - 1) - Math.abs(b.tier - 1) || a.depth - b.depth ||
    Math.abs(a.column - (layouts[a.item].columns - 1) / 2) - Math.abs(b.column - (layouts[b.item].columns - 1) / 2),
  )[0];
  if (unit) unit.taken = true;
  return unit;
}
