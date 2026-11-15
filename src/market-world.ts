export type MarketPose = { x: number; z: number; yaw: number; pitch: number };
export const marketStart = (): MarketPose => ({ x:1.2, z:7.8, yaw:Math.PI * 1.5 - .3, pitch:0 });

// World coordinates: the street runs east/west, across the shop entrance.
export const marketActivities = [
  { id:'fruit', name:'Fruit stall', person:'Maya · fruit seller', x:11.2, z:5.35, count:2, item:'apples', hint:'Along this footpath, past the family', request:'I’m packing your picnic. How many apples does this note ask for?', done:'Two apples for your picnic. All packed!', color:'#d67a53', required:true },
  { id:'bread', name:'Bakery', person:'Arun · baker', x:-9.2, z:5.35, count:3, item:'coins', hint:'Back along the same footpath', request:'A warm loaf costs तीन rupees. Put that many one-rupee coins on the counter.', done:'Three rupees, exactly. Here’s your warm loaf!', color:'#ceab60', required:true },
  { id:'flowers', name:'Flower stall', person:'Tara · flower seller', x:-2.4, z:22.65, count:4, item:'flowers', hint:'Across the street, near the crossing', request:'Make a bouquet with चार flowers. Take them from the vase on your left — बायाँ.', done:'Four flowers from the left vase. A lovely bouquet!', color:'#ad7896', required:true },
  { id:'family', name:'Find the lost toy', person:'A neighbor and their child', x:5.2, z:7.55, count:1, item:'toy', hint:'A few steps ahead on this footpath', request:'Our little one lost a red teddy. Face the shop, turn right toward the bakery, then look behind the planter past it.', done:'You found the teddy! Look at that smile.', color:'#748e9c', required:false },
] as const;
export type MarketActivity = typeof marketActivities[number];
export type ActivityId = MarketActivity['id'];
export const learnedNumbersKey = 'wayword.numbers.ne.v1';
export const marketVisitsKey = 'wayword.market-visits.ne.v1';
export const lostToy = { x:-14.4, z:7.8 };
export type MarketTask = { id:ActivityId; picked:string[]; coins:number; carryingToy:boolean; delivered?:boolean };

export type MarketBump = 'none' | 'object' | 'person';
function marketPeopleAt(x: number, z: number, people?:readonly {x:number;z:number}[]): boolean {
  if (people) return people.some(person => Math.hypot(x - person.x, z - person.z) < .58);
  for (const side of [-1, 1]) for (const localZ of [16.8, 23.6, 37.2, 44]) {
    if (side === 1 && localZ === 23.6) continue;
    if (Math.hypot(x - (localZ - 25.6), z - (14 - side * 6.8)) < .58) return true;
  }
  for (const [px, pz] of [[4.6,7.8], [5.65,7.55], [2.7,20.25], [8,20.3]]) if (Math.hypot(x-px,z-pz)<.58) return true;
  return false;
}
export function canWalkMarketWorld(x: number, z: number): boolean {
  if (x < -19 || x > 24 || z < 6.55 || z > 21.45) return false;
  // Stall posts, counters, and tree planters have real footprints.
  for (const side of [-1, 1]) for (let i = 0; i < 8; i++) {
    if (side === 1 && (i === 2 || i === 3)) continue;
    const center = 10 + i * 6.8 - 26;
    if (i < 6 && Math.abs(x - center) < 2.17 && Math.abs(z - (side === 1 ? 5.35 : 22.65)) < 1.35) return false;
    if (i % 2 === 0 && Math.hypot(x - center - 2.8, z - (14 - side * 5.65)) < .83) return false;
  }
  return true;
}
export function canWalkMarket(x: number, z: number, people?:readonly {x:number;z:number}[]): boolean {
  return canWalkMarketWorld(x, z) && !marketPeopleAt(x, z, people);
}
/** Classify an attempted walk step. NPC contact wins when both would block. */
export function marketBump(pose: MarketPose, dx: number, dz: number, people?:readonly {x:number;z:number}[]): MarketBump {
  if (Math.hypot(dx, dz) < 1e-6) return 'none';
  const x = pose.x + dx, z = pose.z + dz;
  if (canWalkMarket(x, z, people)) return 'none';
  if (marketPeopleAt(x, z, people)) return 'person';
  return 'object';
}
export function walkMarket(pose: MarketPose, dx: number, dz: number,people?:readonly {x:number;z:number}[]): MarketPose {
  let { x, z } = pose;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx,dz)/.12));
  for (let i=0;i<steps;i++) {
    if (canWalkMarket(x+dx/steps,z,people)) x+=dx/steps;
    if (canWalkMarket(x,z+dz/steps,people)) z+=dz/steps;
  }
  return { ...pose, x, z };
}
export function nearbyActivity(pose: MarketPose): MarketActivity | undefined {
  return [...marketActivities].sort((a,b)=>Math.hypot(a.x-pose.x,a.z-pose.z)-Math.hypot(b.x-pose.x,b.z-pose.z)).find(activity=> {
    const dx=activity.x-pose.x,dz=activity.z-pose.z,distance=Math.hypot(dx,dz);
    return distance<2.9 && (-Math.sin(pose.yaw)*dx-Math.cos(pose.yaw)*dz)/Math.max(distance,.01)>.25;
  });
}
export function readMarketVisits(storage: Pick<Storage,'getItem'>): ActivityId[] {
  try { const value: unknown=JSON.parse(storage.getItem(marketVisitsKey)??'[]'); return Array.isArray(value)?marketActivities.filter(activity=>value.includes(activity.id)).map(activity=>activity.id):[]; }
  catch { return []; }
}
