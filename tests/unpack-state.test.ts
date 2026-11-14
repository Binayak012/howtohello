import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialUnpack,see,canStartUnpacking,pick,answer,unpacked,checked,colorOrder,items,checks} from '../src/unpack-state.ts';

test('unpacking needs all five colors explored first',()=>{
  let state=initialUnpack();
  assert.equal(pick(state,'sweater').correct,false);
  for(const color of colorOrder.slice(0,4))state=see(state,color);
  assert.equal(canStartUnpacking(state),false);
  state=see(see(state,'white'),'white');
  assert.equal(canStartUnpacking(state),true);
  assert.equal(state.seen.length,5);
});

test('only the requested color is put away and mistakes are counted',()=>{
  let state=colorOrder.reduce(see,initialUnpack());
  let result=pick(state,'shirt');assert.equal(result.correct,false);assert.equal(result.state.misses,1);state=result.state;
  result=pick(state,'sweater');assert.equal(result.correct,true);state=result.state;
  result=pick(state,'sweater');assert.equal(result.correct,false);assert.equal(result.state.misses,1,'re-picking a placed item is not a miss');
  for(const item of items.slice(1))state=pick(state,item.id).state;
  assert.equal(unpacked(state),true);
});

test('the recall check accepts only the right color word',()=>{
  let state=items.reduce((current,item)=>pick(current,item.id).state,colorOrder.reduce(see,initialUnpack()));
  assert.equal(answer(state,'yellow').correct,false);
  for(const question of checks){assert.ok(question.options.includes(question.answer));state=answer(state,question.answer).state;}
  assert.equal(checked(state),true);
});
