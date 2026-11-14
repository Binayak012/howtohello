// Chapter 2 rules: learn five colors, unpack by color, then a short recall check.
// Standard Nepali color adjectives; native-speaker review of the chapter is still pending.
export const colors={
  red:{word:'रातो',roman:'raato',meaning:'Red',hex:'#c64b3c'},
  blue:{word:'निलो',roman:'nilo',meaning:'Blue',hex:'#3d6fb0'},
  yellow:{word:'पहेँलो',roman:'pahelo',meaning:'Yellow',hex:'#e9b52f'},
  green:{word:'हरियो',roman:'hariyo',meaning:'Green',hex:'#4c9a57'},
  white:{word:'सेतो',roman:'seto',meaning:'White',hex:'#f6f3ec'},
} as const;
export type ColorId=keyof typeof colors;
export const colorOrder=Object.keys(colors) as ColorId[];

/** Unpacking order deliberately differs from the study order. */
export const items=[
  {id:'sweater',color:'green',name:'sweater'},
  {id:'shirt',color:'red',name:'shirt'},
  {id:'towel',color:'white',name:'towel'},
  {id:'trousers',color:'blue',name:'trousers'},
  {id:'scarf',color:'yellow',name:'scarf'},
] as const;
export type ItemId=typeof items[number]['id'];

export const checks=[
  {target:'towel',label:'the towel on the hook',answer:'white',options:['yellow','white','blue']},
  {target:'plant',label:'the plant by the door',answer:'green',options:['green','red','white']},
  {target:'shirt',label:'the shirt on the shelf',answer:'red',options:['blue','yellow','red']},
] as const satisfies readonly {target:string;label:string;answer:ColorId;options:readonly ColorId[]}[];

export type UnpackState={seen:ColorId[];task:number;check:number;misses:number};
export const initialUnpack=():UnpackState=>({seen:[],task:0,check:0,misses:0});

export function see(state:UnpackState,color:ColorId):UnpackState{
  return state.seen.includes(color)?state:{...state,seen:[...state.seen,color]};
}
export const canStartUnpacking=(state:UnpackState)=>colorOrder.every(color=>state.seen.includes(color));
export const currentItem=(state:UnpackState)=>items[state.task];
export const unpacked=(state:UnpackState)=>state.task>=items.length;
export const checked=(state:UnpackState)=>state.check>=checks.length;

/** Picks an item from the suitcase; only the requested color counts. */
export function pick(state:UnpackState,id:ItemId):{state:UnpackState;correct:boolean}{
  const wanted=currentItem(state);
  if(!canStartUnpacking(state)||!wanted)return{state,correct:false};
  if(wanted.id===id)return{state:{...state,task:state.task+1},correct:true};
  const alreadyPlaced=items.slice(0,state.task).some(item=>item.id===id);
  return{state:alreadyPlaced?state:{...state,misses:state.misses+1},correct:false};
}

/** Answers the current recall question with a color word. */
export function answer(state:UnpackState,color:ColorId):{state:UnpackState;correct:boolean}{
  const question=checks[state.check];
  if(!unpacked(state)||!question)return{state,correct:false};
  if(question.answer===color)return{state:{...state,check:state.check+1},correct:true};
  return{state:{...state,misses:state.misses+1},correct:false};
}
