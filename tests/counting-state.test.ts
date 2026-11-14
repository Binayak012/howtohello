import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialCounting, seeNumber, canStartCounting, addApple, removeApple, giveBasket, answerCount, counted, recalled, rounds, recall } from '../src/counting-state.ts';

const ready = () => [1, 2, 3, 4, 5].reduce(seeNumber, initialCounting());

test('counting starts only after all five numbers are explored', () => {
  let state = seeNumber(seeNumber(initialCounting(), 1), 1);
  assert.equal(state.seen.length, 1);
  assert.equal(addApple(state).basket, 0);
  state = [2, 3, 4, 5].reduce(seeNumber, state);
  assert.equal(canStartCounting(state), true);
  assert.equal(seeNumber(state, 6), state);
});

test('the basket must hold exactly the requested number', () => {
  let state = ready();
  state = addApple(addApple(state));
  let result = giveBasket(state);
  assert.equal(result.correct, false); assert.equal(result.state.misses, 1);
  state = addApple(result.state);
  result = giveBasket(state);
  assert.equal(result.correct, true); assert.equal(result.state.basket, 0); assert.equal(result.state.round, 1);
  state = removeApple(result.state);
  assert.equal(state.basket, 0, 'cannot remove from an empty basket');
  for (const wanted of rounds.slice(1)) { for (let i = 0; i < wanted; i++) state = addApple(state); state = giveBasket(state).state; }
  assert.equal(counted(state), true);
  assert.equal(addApple(state).basket, 0);
});

test('the basket never holds more than five apples', () => {
  let state = ready();
  for (let i = 0; i < 8; i++) state = addApple(state);
  assert.equal(state.basket, 5);
});

test('naming a count follows the counting rounds', () => {
  let state = ready();
  assert.equal(answerCount(state, 5).correct, false, 'not before the rounds');
  for (const wanted of rounds) { for (let i = 0; i < wanted; i++) state = addApple(state); state = giveBasket(state).state; }
  const wrong = answerCount(state, 1); assert.equal(wrong.correct, false); state = wrong.state;
  for (const question of recall) { assert.ok((question.options as readonly number[]).includes(question.count)); state = answerCount(state, question.count).state; }
  assert.equal(recalled(state), true);
  assert.equal(state.misses, 1);
});
