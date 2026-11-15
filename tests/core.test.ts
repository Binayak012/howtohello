import test from 'node:test';
import assert from 'node:assert/strict';
import { atCheckout, atShopDoor, baseBeats, blocked, facedRack, outside, rackFor, racks, relativeTo, reviewBeat, routeTo, start, step, turn } from '../src/core.ts';
import { createStock, layouts, takeOne } from '../src/stock.ts';

test('movement respects the floor plan and two-tile reach', () => {
  assert.deepEqual(start(), { col: 4, row: 7, facing: 'N' });
  assert.equal(facedRack(turn(start(), -1))?.id, 'rack_2_7');
  assert.equal(facedRack({ col: 5, row: 7, facing: 'W' }), undefined);
  assert.deepEqual(step({ col: 3, row: 7, facing: 'W' }), { col: 3, row: 7, facing: 'W' });
  assert.ok(blocked(4, 1));
  assert.ok(blocked(4, 2));
  assert.deepEqual(step({ col: 4, row: 3, facing: 'N' }), { col: 4, row: 3, facing: 'N' });
  assert.equal(turn(turn(start(), 1), -1).facing, 'N');
});

test('taking removes exactly one individual unit, and reset restores the stock', () => {
  const stock = createStock();
  const rackId = 'rack_2_3';
  const initial = stock.filter(unit => unit.rackId === rackId).length;
  assert.equal(initial, layouts.fruit.columns * layouts.fruit.depths * layouts.fruit.tiers.length);
  const first = takeOne(stock, rackId)!;
  assert.equal(first.tier, 1);
  assert.equal(first.depth, 0);
  assert.equal(stock.filter(unit => unit.taken).length, 1);
  assert.equal(takeOne(stock, rackId, first.id), undefined);
  assert.equal(stock.filter(unit => unit.taken).length, 1);
  const chosen = stock.find(unit => unit.rackId === rackId && !unit.taken)!;
  assert.equal(takeOne(stock, rackId, chosen.id)?.id, chosen.id);
  assert.equal(stock.filter(unit => unit.taken).length, 2);
  assert.equal(takeOne(stock, rackId, 'rack_2_7_0_0_0'), undefined);
  for (let i = 2; i < initial; i++) assert.ok(takeOne(stock, rackId));
  assert.equal(takeOne(stock, rackId), undefined);
  assert.equal(stock.filter(unit => unit.taken).length, initial);
  assert.equal(createStock().filter(unit => unit.taken).length, 0);
});

test('all shopping tasks and a review remain reachable', () => {
  let player = start();
  const review = reviewBeat([{ item: 'fruit', misses: 3, helped: true }, { item: 'bag', misses: 0, helped: false }]);
  assert.equal(review.expect, 'take:rack_2_3');
  for (const beat of [...baseBeats, review]) {
    const route = routeTo(player, beat.expect);
    assert.ok(route, `unreachable: ${beat.expect}`);
    for (const action of route) {
      if (action === 'left') player = turn(player, -1);
      if (action === 'right') player = turn(player, 1);
      if (action === 'forward') player = step(player);
      if (action === 'backward') player = step(player, true);
    }
    assert.ok(beat.expect === `face:${player.facing}` || beat.expect === `take:${facedRack(player)?.id}`);
  }
  assert.equal(racks.length, 8);
  // Every shelf sells something different, so a direction always names one product.
  assert.equal(new Set(racks.map(rack => rack.item)).size, 8);
});

test('direction words describe where a shelf is from where you stand and face', () => {
  const bag = rackFor(baseBeats[0]);
  assert.deepEqual(relativeTo(start(), bag.col, bag.row).ways, ['left']);
  assert.deepEqual(relativeTo(turn(start(), -1), bag.col, bag.row).ways, ['forward']);
  assert.deepEqual(relativeTo(turn(start(), 1), bag.col, bag.row).ways, ['backward']);
  assert.deepEqual(relativeTo(turn(turn(start(), 1), 1), bag.col, bag.row).ways, ['right']);
  // Far shelves are diagonal: ahead and to one side.
  assert.deepEqual(relativeTo(start(), 6, 3).ways, ['forward', 'right']);
  assert.deepEqual(relativeTo({ col: 4, row: 3, facing: 'N' }, 6, 7).ways, ['backward', 'right']);
  assert.ok(relativeTo(start(), 6, 7).angle > 0 && relativeTo(start(), 2, 7).angle < 0);
});

test('backward movement preserves facing, and the exit stays locked until checkout', () => {
  const forward = step(start());
  assert.deepEqual(step(forward, true), start());
  assert.deepEqual(step(start(), true), start());
  let player = { ...start(), facing: 'S' as const };
  assert.deepEqual(step(player), player);
  const threshold = step(player, false, true);
  assert.equal(threshold.row, 8);
  assert.equal(outside(threshold), false);
  assert.equal(outside(step(threshold, false, true)), true);
  assert.equal(atCheckout({ col:4, row:3, facing:'N' }), true);
  assert.equal(atCheckout({ col:4, row:3, facing:'S' }), false);
});

test('the counter and the outside are reachable after collecting all four items', () => {
  let player = start();
  for (const expect of [...baseBeats.map(beat => beat.expect), 'at:4,3,N', 'exit']) {
    const route = routeTo(player, expect);
    assert.ok(route, `unreachable: ${expect}`);
    for (const action of route) {
      if (action === 'left') player = turn(player, -1);
      if (action === 'right') player = turn(player, 1);
      if (action === 'forward') player = step(player, false, expect === 'exit');
      if (action === 'backward') player = step(player, true, expect === 'exit');
    }
    if (expect === 'at:4,3,N') assert.ok(atCheckout(player));
    if (expect === 'exit') assert.ok(outside(player));
  }
});

test('exit guidance turns toward the door and walks forward', () => {
  let player = { col: 4, row: 3, facing: 'N' as const } as ReturnType<typeof start>;
  const route = routeTo(player, 'exit')!;
  assert.ok(route);
  assert.equal(route.includes('backward'), false);
  for (const action of route) {
    if (action === 'left') player = turn(player, -1);
    if (action === 'right') player = turn(player, 1);
    if (action === 'forward') { assert.equal(player.facing, 'S'); player = step(player, false, true); }
  }
  assert.equal(outside(player), true);
});

test('shop completion guidance stops inside at the closed door, facing it', () => {
  let player = { col: 4, row: 3, facing: 'N' as const } as ReturnType<typeof start>;
  const route = routeTo(player, 'door')!;
  assert.ok(route); assert.equal(route.includes('backward'), false);
  assert.equal(atShopDoor(start()), false);
  for (const action of route) {
    if (action === 'left') player = turn(player, -1);
    if (action === 'right') player = turn(player, 1);
    if (action === 'forward') player = step(player);
    assert.equal(outside(player), false);
  }
  assert.equal(atShopDoor(player), true);
  assert.deepEqual(player, { col: 4, row: 7, facing: 'S' });
});
