import test from 'node:test';
import assert from 'node:assert/strict';
import { canWalkMarket, marketActivities, marketStart, nearbyActivity, walkMarket, readMarketVisits } from '../src/market-world.ts';

test('all four neighbors can be reached from the arrival footpath',()=>{
  const queue=[[1,8]],visited=new Set<string>();
  for(let i=0;i<queue.length;i++){
    const [x,z]=queue[i],key=`${x},${z}`;if(visited.has(key))continue;visited.add(key);
    for(const [dx,dz] of [[.5,0],[-.5,0],[0,.5],[0,-.5]])if(canWalkMarket(x+dx,z+dz)&&!visited.has(`${x+dx},${z+dz}`))queue.push([x+dx,z+dz]);
  }
  for(const activity of marketActivities)assert.ok([...visited].some(key=>{const [x,z]=key.split(',').map(Number);return nearbyActivity({x,z,pitch:0,yaw:Math.atan2(-(activity.x-x),-(activity.z-z))})?.id===activity.id;}),activity.name);
});
test('movement has street boundaries and cannot tunnel through a stall',()=>{
  const pose={...marketStart(),x:11.2,z:8};
  const blocked=walkMarket(pose,0,-8);assert.ok(blocked.z>=6.6);
  const edge=walkMarket(marketStart(),100,0);assert.ok(edge.x<=24);
  assert.equal(canWalkMarket(-13.2,8.35),false);
  assert.equal(nearbyActivity(marketStart()),undefined);
  assert.equal(nearbyActivity({...pose,yaw:Math.PI})?.id,undefined); // Facing away.
  assert.equal(nearbyActivity({...pose,z:7.8,yaw:0})?.id,'fruit');
});
test('saved visits accept only real neighbors and remain optional',()=>{
  assert.deepEqual(readMarketVisits({getItem:()=> '["fruit","fruit","fake","family"]'}),['fruit','family']);
  assert.deepEqual(readMarketVisits({getItem:()=>'{bad'}),[]);
  assert.deepEqual(readMarketVisits({getItem:()=>{throw Error('blocked');}}),[]);
});
test('collision follows people who step out of the way',()=>{
  assert.equal(canWalkMarket(-8.8,7.2),false);
  assert.equal(canWalkMarket(-8.8,7.2,[{x:-7,z:7.2}]),true);
  assert.equal(canWalkMarket(-7,7.2,[{x:-7,z:7.2}]),false);
});
