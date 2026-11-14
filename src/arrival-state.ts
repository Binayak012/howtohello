export type ArrivalPose={x:number;z:number;yaw:number;pitch:number};
export const arrivalStart=():ArrivalPose=>({x:0,z:6,yaw:0,pitch:0});
export const arrivalSpots={
  host:{x:-1.8,z:-1,name:'Asha · your host'},
  porter:{x:4,z:3.4,name:'Biren · your porter'},
  neighbor:{x:-4.6,z:2.2,name:'Lila · your neighbor'},
  key:{x:-1.8,z:-.25,name:'Your room key'},
  suitcase:{x:2.4,z:1.8,name:'Your blue suitcase'},
  parcel:{x:-5.5,z:-.6,name:'Lila’s parcel'},
  door:{x:0,z:-4.3,name:'Your new front door'},
} as const;
export type ArrivalTarget=keyof typeof arrivalSpots;
export type ArrivalState={greeted:boolean;requestedKey:boolean;keyTaken:boolean;thanked:boolean;rejectedWrongCase:boolean;acceptedOwnCase:boolean;bagHeld:boolean;bagHome:boolean;neighborGreeted:boolean;parcelHeld:boolean;parcelReturned:boolean};
export const initialArrival=():ArrivalState=>({greeted:false,requestedKey:false,keyTaken:false,thanked:false,rejectedWrongCase:false,acceptedOwnCase:false,bagHeld:false,bagHome:false,neighborGreeted:false,parcelHeld:false,parcelReturned:false});
export type ArrivalAction='greet'|'please'|'key'|'thanks'|'no'|'yes'|'bag'|'home'|'neighbor-greet'|'parcel'|'return-parcel';
export function arrivalAction(state:ArrivalState,action:ArrivalAction):ArrivalState{
  if(action==='greet')return{...state,greeted:true};
  if(action==='please'&&state.greeted)return{...state,requestedKey:true};
  if(action==='key'&&state.requestedKey)return{...state,keyTaken:true};
  if(action==='thanks'&&state.keyTaken)return{...state,thanked:true};
  if(action==='no'&&state.thanked)return{...state,rejectedWrongCase:true};
  if(action==='yes'&&state.rejectedWrongCase)return{...state,acceptedOwnCase:true};
  if(action==='bag'&&state.acceptedOwnCase&&!state.bagHome)return{...state,bagHeld:true};
  if(action==='home'&&state.keyTaken&&state.thanked&&state.bagHeld)return{...state,bagHeld:false,bagHome:true};
  if(action==='neighbor-greet'&&state.greeted)return{...state,neighborGreeted:true};
  if(action==='parcel'&&!state.parcelReturned)return{...state,parcelHeld:true};
  if(action==='return-parcel'&&state.neighborGreeted&&state.parcelHeld)return{...state,parcelHeld:false,parcelReturned:true};
  return state;
}
export function canWalkArrival(x:number,z:number,people:readonly {x:number;z:number}[]=[]){
  if(Math.abs(x)>6.35||z< -3.65||z>6.7)return false;
  if(Math.hypot(x,z-.3)<1.08)return false;
  if(Math.abs(x+1.8)<.58&&Math.abs(z+.38)<.48)return false;
  if(x>3.85&&x<5.75&&z>2.7&&z<4.4)return false;
  if(x< -3.3&&x> -6&&Math.abs(z+2.8)<.57)return false;
  for(const [px,pz] of [[-6,-1.6],[6,-2.7],[5.8,5.5],[-5.8,5.8]])if(Math.hypot(x-px,z-pz)<.62)return false;
  return !people.some(person=>Math.hypot(x-person.x,z-person.z)<.5);
}
export function walkArrival(pose:ArrivalPose,dx:number,dz:number,people:readonly {x:number;z:number}[]=[]):ArrivalPose{
  let{x,z}=pose;const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.1));
  for(let i=0;i<steps;i++){if(canWalkArrival(x+dx/steps,z,people))x+=dx/steps;if(canWalkArrival(x,z+dz/steps,people))z+=dz/steps;}
  return{...pose,x,z};
}
export function closeToArrival(pose:ArrivalPose,target:ArrivalTarget,radius=2.5){
  const spot=arrivalSpots[target],dx=spot.x-pose.x,dz=spot.z-pose.z,distance=Math.hypot(dx,dz);
  return distance<radius&&(distance<.25||(-Math.sin(pose.yaw)*dx-Math.cos(pose.yaw)*dz)/distance>.3);
}

// Ho/hoina are taught specifically as answers to an identification question.
// Sources: Introduction to the Nepali Language, chapters 2 and 3.
export const arrivalPhrases={
  hello:{word:'नमस्ते',roman:'namaste',meaning:'Hello'},
  please:{word:'कृपया',roman:'kripaya',meaning:'Please'},
  thanks:{word:'धन्यवाद',roman:'dhanyawaad',meaning:'Thank you'},
  yes:{word:'हो',roman:'ho',meaning:'Yes, it is'},
  no:{word:'होइन',roman:'hoina',meaning:'No, it isn’t'},
} as const;
