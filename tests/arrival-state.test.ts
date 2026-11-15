import test from 'node:test';
import assert from 'node:assert/strict';
import {initialArrival,arrivalAction,arrivalStart,arrivalSpots,canWalkArrival,arrivalBump,closeToArrival,walkArrival,type ArrivalAction} from '../src/arrival-state.ts';

test('a key, polite exchange and correct suitcase are required before moving in',()=>{
  let state=initialArrival();
  for(const action of ['key','thanks','yes','bag','home'] as ArrivalAction[])assert.equal(arrivalAction(state,action),state);
  for(const action of ['greet','please','key','thanks','no','yes','bag'] as ArrivalAction[])state=arrivalAction(state,action);
  assert.equal(state.bagHome,false);assert.equal(state.bagHeld,true);
  state=arrivalAction(state,'home');assert.equal(state.bagHome,true);assert.equal(state.bagHeld,false);
  assert.equal(arrivalAction(state,'bag').bagHeld,false);
});
test('returning a parcel needs the parcel and a greeting, and is optional',()=>{
  let state=initialArrival();assert.equal(arrivalAction(state,'return-parcel'),state);
  state=arrivalAction(state,'parcel');assert.equal(arrivalAction(state,'return-parcel'),state);
  state=arrivalAction(arrivalAction(state,'greet'),'neighbor-greet');state=arrivalAction(state,'return-parcel');
  assert.equal(state.parcelReturned,true);assert.equal(state.parcelHeld,false);assert.equal(state.bagHome,false);
});
test('courtyard movement respects the fountain, table, luggage cart and boundaries',()=>{
  assert.equal(canWalkArrival(0,.3),false);assert.equal(canWalkArrival(-1.8,-.25),false);assert.equal(canWalkArrival(4.7,3.5),false);
  assert.equal(canWalkArrival(0,8),false);assert.equal(canWalkArrival(-1.8,1.1),true);
  const stopped=walkArrival({...arrivalStart(),x:0,z:3},0,-8);assert.ok(stopped.z>1);
  assert.equal(closeToArrival({...arrivalStart(),x:-1.8,z:1.1},'host'),true);
  assert.equal(closeToArrival({...arrivalStart(),x:-1.8,z:1.1,yaw:Math.PI},'host'),false);
});
test('every courtyard interaction has a reachable nearby position',()=>{
  const queue=[[0,6]],visited=new Set<string>();
  for(let i=0;i<queue.length;i++){const[x,z]=queue[i],key=`${x},${z}`;if(visited.has(key))continue;visited.add(key);for(const[dx,dz]of[[.25,0],[-.25,0],[0,.25],[0,-.25]])if(canWalkArrival(x+dx,z+dz)&&!visited.has(`${x+dx},${z+dz}`))queue.push([x+dx,z+dz]);}
  for(const target of Object.keys(arrivalSpots) as (keyof typeof arrivalSpots)[])assert.ok([...visited].some(key=>{const[x,z]=key.split(',').map(Number),spot=arrivalSpots[target];return closeToArrival({x,z,pitch:0,yaw:Math.atan2(-(spot.x-x),-(spot.z-z))},target);}),target);
});
test('courtyard bumps classify object vs person and give NPCs priority',()=>{
  const pose={...arrivalStart(),x:0,z:2};
  assert.equal(arrivalBump(pose,0,0),'none');
  assert.equal(arrivalBump(pose,0,-2),'object');
  assert.equal(arrivalBump(pose,0,-.4,[{x:0,z:1.7}]),'person');
  assert.equal(arrivalBump({...arrivalStart(),x:0,z:.9},0,-.5,[{x:0,z:.4}]),'person');
});
