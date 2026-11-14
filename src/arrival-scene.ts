import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {arrivalSpots,arrivalStart,type ArrivalPose,type ArrivalTarget} from './arrival-state';

type Actor={root:THREE.Group;head:THREE.Group;arms:THREE.Group[];legs:THREE.Group[];home:THREE.Vector3;facing:number;action?:{kind:'hello'|'offer'|'nod'|'shake'|'wave'|'point'|'thanks';at:number;target:ArrivalPose};walk?:{from:THREE.Vector3;to:THREE.Vector3;at:number;duration:number}};
type Transfer={object:THREE.Object3D;from:THREE.Vector3;parent:THREE.Object3D;to:THREE.Vector3;at:number;duration:number;scale:number;fromScale:number;rot:THREE.Euler};
// Final standing pose inside the new room: a gentle look toward the bed and suitcase.
const homeView={x:-.15,z:-5.2,yaw:-.22,pitch:-.17};

export class ArrivalScene{
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(62,1,.06,80);renderer:THREE.WebGLRenderer;
  actors=new Map<'host'|'porter'|'neighbor',Actor>();
  key=new THREE.Group();blueCase=new THREE.Group();redCase=new THREE.Group();parcel=new THREE.Group();door=new THREE.Group();
  reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  private pose=arrivalStart();private raf=0;private last=0;private observer:ResizeObserver;
  private resources:(THREE.BufferGeometry|THREE.Material|THREE.Texture)[]=[];
  private cube=new RoundedBoxGeometry(1,1,1,2,.08);private sphere=new THREE.SphereGeometry(1,16,12);
  private mats=new Map<string,THREE.MeshStandardMaterial>();private transfers:Transfer[]=[];
  private entry?:{at:number;from:THREE.Vector3;yaw:number;pitch:number};private opening=false;private conversation=false;
  private flags:THREE.Mesh[]=[];private cat=new THREE.Group();private labels:THREE.Sprite[]=[];
  constructor(private host:HTMLElement,private interact:(target:ArrivalTarget)=>void){
    this.resources.push(this.cube,this.sphere);
    this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.05;
    this.renderer.domElement.tabIndex=0;this.renderer.domElement.setAttribute('role','img');this.renderer.domElement.setAttribute('aria-label','A golden courtyard with your host Asha, porter Biren, neighbor Lila, a luggage cart, a fountain and your new front door.');host.append(this.renderer.domElement);
    this.scene.background=new THREE.Color('#f5d9b3');this.scene.fog=new THREE.Fog('#f5d9b3',19,60);
    this.scene.add(new THREE.HemisphereLight('#fff2cf','#9d9d92',2));
    const sun=new THREE.DirectionalLight('#ffd6a3',3);sun.position.set(-8,12,7);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-10,right:10,top:12,bottom:-10,near:.5,far:35});sun.shadow.normalBias=.025;this.scene.add(sun);
    this.buildCourt();this.makeActor('host','#5d8a79','#a76b49','bun');this.makeActor('porter','#b27c52','#d3a078','short');this.makeActor('neighbor','#9385b1','#e2b58c','grey');
    this.buildKey();this.suitcase(this.blueCase,'#5a899c',true);this.suitcase(this.redCase,'#b96855',false);
    this.box(this.parcel,[.4,.3,.32],[0,.16,0],'#d1ac76');this.box(this.parcel,[.05,.31,.325],[0,.16,0],'#708f7b');this.box(this.parcel,[.405,.31,.04],[0,.16,0],'#708f7b');
    for(const [object,target]of[[this.key,'key'],[this.blueCase,'suitcase'],[this.parcel,'parcel']] as const){object.userData.target=target;this.scene.add(object);}
    this.scene.add(this.redCase,this.camera);this.reset();
    this.renderer.domElement.addEventListener('click',this.click);
    this.observer=new ResizeObserver(this.resize);this.observer.observe(host);this.resize();this.frame();
  }
  private mat(color:string){if(!this.mats.has(color)){const material=new THREE.MeshStandardMaterial({color,roughness:.87});this.mats.set(color,material);this.resources.push(material);}return this.mats.get(color)!;}
  box(parent:THREE.Object3D,size:number[],at:number[],color:string){const mesh=new THREE.Mesh(this.cube,this.mat(color));mesh.scale.set(size[0],size[1],size[2]);mesh.position.set(at[0],at[1],at[2]);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
  private ball(parent:THREE.Object3D,size:number[],at:number[],color:string){const mesh=new THREE.Mesh(this.sphere,this.mat(color));mesh.scale.set(size[0],size[1],size[2]);mesh.position.set(at[0],at[1],at[2]);mesh.castShadow=true;parent.add(mesh);return mesh;}
  private cylinder(parent:THREE.Object3D,r:number,height:number,at:number[],color:string){const geometry=new THREE.CylinderGeometry(r,r,height,24);this.resources.push(geometry);const mesh=new THREE.Mesh(geometry,this.mat(color));mesh.position.set(at[0],at[1],at[2]);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
  private sign(text:string,at:number[],width=1.3){const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#fff7e8';ctx.beginPath();ctx.roundRect(4,4,1016,248,64);ctx.fill();ctx.strokeStyle='#e2cfae';ctx.lineWidth=6;ctx.stroke();ctx.fillStyle='#315e55';ctx.font='800 76px system-ui,"Segoe UI",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';let size=76;while(ctx.measureText(text).width>930&&size>40){size-=4;ctx.font=`800 ${size}px system-ui,"Segoe UI",sans-serif`;}ctx.fillText(text,512,132);const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;const material=new THREE.SpriteMaterial({map});this.resources.push(map,material);const label=new THREE.Sprite(material);label.position.set(at[0],at[1],at[2]);label.scale.set(width,width/4,1);this.scene.add(label);label.userData.width=width;this.labels.push(label);return label;}
  private plant(x:number,z:number,scale=1){const group=new THREE.Group();group.position.set(x,0,z);group.scale.setScalar(scale);this.scene.add(group);this.cylinder(group,.26,.5,[0,.25,0],'#bd8064');for(let i=0;i<8;i++){const angle=i*Math.PI/4;const leaf=this.ball(group,[.11,.4,.08],[Math.sin(angle)*.22,.8+(i%2)*.2,Math.cos(angle)*.22],i%2?'#7c9b6e':'#9aaf7e');leaf.rotation.set(Math.cos(angle)*.4,angle,-Math.sin(angle)*.4);}}
  private buildCourt(){
    this.box(this.scene,[35,.18,35],[0,-.2,0],'#c9b494');
    for(let x=-7;x<=7;x++)for(let z=-5;z<=7;z++)this.box(this.scene,[.98,.04,.98],[x,-.06,z],(x+z)%2?'#dcc7a8':'#e6d2b4');
    // The facade has a true doorway and a furnished room behind it.
    for(const side of[-1,1])this.box(this.scene,[6.2,6.6,.28],[side*3.9,3.2,-4.92],side<0?'#d6b08a':'#e5c59e');
    this.box(this.scene,[1.65,3.7,.28],[0,4.8,-4.92],'#e0bd96');
    this.box(this.scene,[14.5,.2,.6],[0,6.55,-4.9],'#a88c70');
    for(const side of[-1,1]){
      this.box(this.scene,[.3,4.8,13],[side*7.1,2.3,1.4],side<0?'#d7c6a4':'#d7a47e');
      for(const z of[-2,2,5]){this.box(this.scene,[.12,1.5,1],[side*6.9,2.7,z],'#6c9695');for(const offset of[-.7,.7])this.box(this.scene,[.16,1.6,.3],[side*6.8,2.7,z+offset],'#739283');}
      for(const x of[2.2,4.7])for(const y of[2.2,4.7]){
        this.box(this.scene,[1.05,1.45,.12],[side*x,y,-4.7],'#6b9696');
        for(const offset of[-.72,.72]){this.box(this.scene,[.32,1.55,.16],[side*x+offset,y,-4.58],'#6e8872');for(let slat=0;slat<5;slat++)this.box(this.scene,[.28,.035,.025],[side*x+offset,y-.55+slat*.27,-4.48],'#a3b39a');}
        this.box(this.scene,[1.8,.13,.38],[side*x,y-.8,-4.6],'#b39c79');
      }
    }
    // A small, enclosed room so the final walk inside looks like arriving home.
    this.box(this.scene,[3.6,.06,3.3],[0,-.03,-6.65],'#c9a47c');this.box(this.scene,[3.75,3.2,.15],[0,1.5,-8.25],'#efe0c4');
    for(const side of[-1,1])this.box(this.scene,[.15,3.2,3.4],[side*1.85,1.5,-6.65],'#ead5b4');
    this.box(this.scene,[3.9,.12,3.4],[0,3.02,-6.65],'#d8c09c');
    this.box(this.scene,[.8,.45,1.5],[1.15,.24,-7.35],'#8fa58f');this.box(this.scene,[.8,.15,1.45],[1.15,.53,-7.35],'#eee4d4');this.box(this.scene,[.82,.06,.95],[1.15,.63,-7.1],'#c58469');this.box(this.scene,[.55,.12,.28],[1.15,.66,-7.93],'#fffaf0');
    this.box(this.scene,[1.2,.015,1.4],[-.2,.015,-6.9],'#c58469');this.box(this.scene,[.95,.02,1.15],[-.2,.02,-6.9],'#e2bd74');
    this.box(this.scene,[1,.85,.06],[-.5,1.75,-8.16],'#9fc6cc');this.box(this.scene,[1.1,.08,.1],[-.5,1.3,-8.13],'#b39c79');this.box(this.scene,[.06,.85,.08],[-.5,1.75,-8.14],'#b39c79');
    this.box(this.scene,[.42,.6,.42],[-1.45,.3,-7.85],'#b6a082');
    const glow=new THREE.MeshStandardMaterial({color:'#ffe2a0',emissive:'#ffc766',emissiveIntensity:1.3});this.resources.push(glow);const shade=new THREE.Mesh(this.sphere,glow);shade.scale.set(.13,.11,.13);shade.position.set(-1.45,.8,-7.85);this.scene.add(shade);
    this.box(this.scene,[.05,.5,.68],[1.76,1.6,-7.35],'#c58469');this.box(this.scene,[.03,.38,.54],[1.74,1.6,-7.35],'#e8d7a8');
    this.plant(-1.45,-5.6,.6);
    const lamp=new THREE.PointLight('#ffd49a',5,6,1.6);lamp.position.set(0,2.6,-6.9);this.scene.add(lamp);
    this.door.position.set(-.76,0,-4.72);this.scene.add(this.door);this.door.userData.target='door';this.box(this.door,[1.5,2.75,.13],[.75,1.375,0],'#587f6b');
    for(const y of[.7,2])this.box(this.door,[1.19,1.08,.15],[.75,y,.015],'#72947b');this.ball(this.door,[.045,.045,.045],[1.32,1.15,.12],'#d9b46b');
    for(const x of[-.85,.85])this.box(this.scene,[.14,2.95,.28],[x,1.45,-4.7],'#e7d7b9');this.box(this.scene,[1.84,.16,.3],[0,2.92,-4.7],'#e7d7b9');this.sign('YOUR NEW HOME',[0,3.24,-4.6],1.65);
    // A low fountain leaves clear paths to all three neighbors.
    this.cylinder(this.scene,.83,.3,[0,.1,.3],'#b1aa94');this.cylinder(this.scene,.68,.04,[0,.27,.3],'#7ba5a0');this.cylinder(this.scene,.13,.35,[0,.35,.3],'#b9b09b');
    for(let i=0;i<14;i++){const a=i*Math.PI/7;this.ball(this.scene,[.025,.025,.025],[Math.sin(a)*.4,.3,Math.cos(a)*.4+.3],'#e3eee0');}
    for(const x of[-5.5,-3.6])for(const z of[-3.05,-2.55])this.box(this.scene,[.12,.5,.12],[x,.25,z],'#7a7357');
    for(let plank=0;plank<4;plank++)this.box(this.scene,[2.3,.07,.13],[-4.55,.53,-3.05+plank*.17],'#bba17a');
    this.box(this.scene,[2.3,.6,.1],[-4.55,.93,-3.12],'#bba17a');
    for(const x of[-6,-3]){this.box(this.scene,[.12,3.3,.12],[x,1.65,-3.5],'#a28b63');for(const z of[-3.8,-2.8,-1.8])this.box(this.scene,[3.3,.09,.12],[-4.5,3.3,z],'#b8a27b');}
    this.plant(-6,-1.6);this.plant(6,-2.7,1.2);this.plant(5.8,5.5);this.plant(-5.8,5.8);
    for(const side of[-1,1]){this.box(this.scene,[.45,3,.5],[side*2.5,1.4,7.4],'#bba384');this.box(this.scene,[2.7,2.4,.1],[side*4.6,1.1,7.4],'#8ba18a');}
    this.box(this.scene,[.055,.65,.055],[-2.1,1.12,-1.04],'#a58c65');this.box(this.scene,[.045,.04,.16],[-2.1,1.43,-.97],'#d8b057');
    this.box(this.scene,[.8,.9,.45],[-1.8,.43,-.38],'#b6a082');this.box(this.scene,[.96,.07,.6],[-1.8,.92,-.38],'#e5ceb0');
    this.box(this.scene,[1.4,.12,.9],[4.7,.3,3.55],'#978976');for(const x of[4.15,5.25])for(const z of[3.2,3.9])this.ball(this.scene,[.15,.15,.08],[x,.16,z],'#5c625b');
    this.box(this.scene,[.07,1.2,.07],[5.35,.85,3.9],'#8c8a78');this.box(this.scene,[.8,.06,.07],[4.98,1.45,3.9],'#8c8a78');
    const stringGeo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-6,4.3,1.5),new THREE.Vector3(0,3.9,-1),new THREE.Vector3(6,4.3,-3.5)]);const stringMat=new THREE.LineBasicMaterial({color:'#86785f'});this.resources.push(stringGeo,stringMat);this.scene.add(new THREE.Line(stringGeo,stringMat));
    for(let i=0;i<9;i++){const cloth=this.box(this.scene,[.5,.7,.025],[-4.8+i*1.1,3.8+Math.abs(4-i)*.04,1-i*.42],['#e2bd74','#9dad9d','#c4938a'][i%3]);this.flags.push(cloth);}
    this.cat.position.set(5.7,.13,-1.5);this.scene.add(this.cat);this.ball(this.cat,[.34,.16,.17],[0,.15,0],'#d1b490');this.ball(this.cat,[.16,.17,.15],[-.3,.25,0],'#d1b490');for(const z of[-.08,.08]){const ear=this.box(this.cat,[.1,.12,.08],[-.35,.42,z],'#bc9c7d');ear.rotation.z=-.2;this.ball(this.cat,[.015,.019,.015],[-.445,.29,z],'#4f5144');}this.ball(this.cat,[.25,.04,.04],[.4,.2,0],'#bc9c7d');
    this.sign('ASHA · YOUR HOST',[-1.8,2.2,-1],1.5);this.sign('BIREN · LUGGAGE',[4,2.3,3.4],1.6);this.sign('LILA · NEIGHBOR',[-4.6,2.25,2.2],1.5);
  }
  private makeActor(id:'host'|'porter'|'neighbor',clothes:string,skin:string,hair:'bun'|'short'|'grey'){
    const root=new THREE.Group();root.name=`arrival-${id}`;root.userData.target=id;const spot=arrivalSpots[id];root.position.set(spot.x,0,spot.z);this.scene.add(root);
    const broad=id==='porter'?1.22:1;const legs:THREE.Group[]=[],arms:THREE.Group[]=[];
    for(const side of[-1,1]){const leg=new THREE.Group();leg.position.set(side*.11,.72,0);root.add(leg);this.box(leg,[.16,.67,.18],[0,-.34,0],'#5e645f');this.box(leg,[.18,.09,.29],[0,-.7,.05],'#655343');legs.push(leg);const arm=new THREE.Group();arm.position.set(side*.24*broad,1.24,0);root.add(arm);this.ball(arm,[.09,.2,.095],[0,-.16,0],clothes);this.ball(arm,[.066,.18,.065],[0,-.39,0],skin);arms.push(arm);}
    this.ball(root,[.23*broad,.33,.16],[0,1.02,0],clothes);this.box(root,[.35*broad,.4,.26],[0,.99,0],clothes);this.box(root,[.08,.5,.035],[-.11,1.05,.16],id==='neighbor'?'#d5bb7a':'#e8dbc1');
    const head=new THREE.Group();head.position.set(0,1.49,0);root.add(head);this.ball(head,[.16,.2,.16],[0,0,0],skin);const hairColor=hair==='grey'?'#bdbab1':'#4f382e';this.ball(head,[.17,.1,.17],[0,.13,-.02],hairColor);
    if(hair==='bun')this.ball(head,[.09,.1,.09],[0,.18,-.17],hairColor);if(hair==='grey')for(let i=0;i<4;i++)this.ball(head,[.05,.06,.05],[.14,-.06-i*.08,-.09],hairColor);
    for(const x of[-.055,.055]){this.ball(head,[.014,.019,.013],[x,.01,.15],'#382f2a');if(hair==='grey'){const geo=new THREE.TorusGeometry(.045,.007,6,18);this.resources.push(geo);const glass=new THREE.Mesh(geo,this.mat('#7e796a'));glass.position.set(x,.01,.164);head.add(glass);}}
    this.ball(head,[.025,.03,.025],[0,-.04,.16],skin);const geo=new THREE.TorusGeometry(.04,.006,6,12,Math.PI);this.resources.push(geo);const smile=new THREE.Mesh(geo,this.mat('#976653'));smile.position.set(0,-.085,.153);smile.rotation.z=Math.PI;head.add(smile);
    const actor={root,head,arms,legs,home:root.position.clone(),facing:id==='neighbor'?Math.PI*.25:0};root.rotation.y=actor.facing;this.actors.set(id,actor);
  }
  private buildKey(){const geometry=new THREE.TorusGeometry(.065,.015,8,20);this.resources.push(geometry);const ring=new THREE.Mesh(geometry,this.mat('#d8b057'));this.key.add(ring);this.box(this.key,[.14,.025,.025],[.12,0,0],'#d8b057');this.box(this.key,[.025,.065,.025],[.18,-.025,0],'#d8b057');this.key.name='room-key';}
  private suitcase(parent:THREE.Group,color:string,ours:boolean){this.box(parent,[.5,.61,.31],[0,.32,0],color);for(const x of[-.16,.16])this.box(parent,[.04,.63,.32],[x,.32,0],ours?'#a9bbc0':'#ba9180');this.box(parent,[.23,.035,.045],[0,.69,0],'#685f50');for(const x of[-.12,.12])this.box(parent,[.035,.1,.04],[x,.65,0],'#685f50');for(const x of[-.17,.17])this.ball(parent,[.055,.055,.055],[x,.025,0],'#575c54');this.box(parent,[.13,.17,.025],[.08,.43,.17],ours?'#efc65d':'#e8dbcb');if(ours)this.ball(parent,[.035,.035,.012],[.08,.44,.187],'#fff0ae');parent.name=ours?'blue-suitcase':'red-suitcase';}
  reset(){
    this.entry=undefined;this.opening=false;this.door.rotation.y=0;this.transfers=[];this.pose=arrivalStart();
    for(const actor of this.actors.values()){actor.action=undefined;actor.walk=undefined;actor.root.position.copy(actor.home);actor.root.rotation.set(0,actor.facing,0);}
    for(const item of[this.key,this.blueCase,this.redCase,this.parcel]){this.scene.add(item);item.visible=true;item.scale.setScalar(1);item.rotation.set(0,0,0);}
    this.key.position.set(-2.1,1.4,-.95);this.blueCase.position.set(5.1,.37,3.5);this.redCase.position.set(4.5,.37,3.5);this.parcel.position.set(arrivalSpots.parcel.x,.02,arrivalSpots.parcel.z);
    this.camera.position.set(this.pose.x,1.58,this.pose.z);this.camera.rotation.set(0,0,0,'YXZ');
  }
  setConversation(active:boolean){this.conversation=active;}
  setPose(pose:ArrivalPose){this.pose={...pose};}
  people(){return [...this.actors.values()].map(actor=>({x:actor.root.position.x,z:actor.root.position.z}));}
  react(id:'host'|'porter'|'neighbor',kind:NonNullable<Actor['action']>['kind'],player:ArrivalPose){this.actors.get(id)!.action={kind,at:performance.now(),target:{...player}};}
  transfer(object:THREE.Object3D,parent:THREE.Object3D,to:THREE.Vector3,duration=850,scale=1,rot=new THREE.Euler()){
    this.scene.updateMatrixWorld(true);const from=object.getWorldPosition(new THREE.Vector3()),fromScale=object.getWorldScale(new THREE.Vector3()).x;this.scene.attach(object);object.visible=true;
    this.transfers=this.transfers.filter(item=>item.object!==object);
    if(this.reduced){parent.attach(object);object.position.copy(to);object.scale.setScalar(scale);object.rotation.copy(rot);return;}
    this.transfers.push({object,from,parent,to,at:performance.now(),duration,scale,fromScale,rot});
  }
  offerKey(player:ArrivalPose){this.react('host','offer',player);this.transfer(this.key,this.scene,new THREE.Vector3(-1.8,.98,-.25),850,1,new THREE.Euler(-Math.PI/2,0,0));}
  takeKey(){this.transfer(this.key,this.camera,new THREE.Vector3(-.62,-.46,-.95),650,.36);}
  showCase(ours:boolean,player:ArrivalPose){const actor=this.actors.get('porter')!;this.react('porter','offer',player);if(ours)this.transfer(this.redCase,this.scene,new THREE.Vector3(4.5,.37,3.5),650);this.transfer(ours?this.blueCase:this.redCase,actor.root,new THREE.Vector3(-.42,.15,.22),850);}
  bringCase(player:ArrivalPose){const actor=this.actors.get('porter')!;this.react('porter','offer',player);actor.walk={from:actor.root.position.clone(),to:new THREE.Vector3(2.95,0,1.8),at:performance.now(),duration:1800};if(this.reduced)actor.root.position.set(2.95,0,1.8);}
  dropCase(){this.transfer(this.blueCase,this.scene,new THREE.Vector3(2.4,.04,1.8),300);}
  takeCase(){this.transfer(this.blueCase,this.camera,new THREE.Vector3(-.43,-.66,-1),750,.55);const actor=this.actors.get('porter')!;actor.walk={from:actor.root.position.clone(),to:actor.home.clone(),at:performance.now(),duration:1800};}
  takeParcel(){this.transfer(this.parcel,this.camera,new THREE.Vector3(.36,-.43,-.85),650,.65);}
  returnParcel(player:ArrivalPose){this.react('neighbor','thanks',player);this.transfer(this.parcel,this.actors.get('neighbor')!.root,new THREE.Vector3(.12,.8,.28),850);}
  // The key stays in the lock and swings with the door, so it never floats in mid-air.
  unlock(){this.opening=true;this.transfer(this.key,this.door,new THREE.Vector3(1.2,1.15,.12),650,.8,new THREE.Euler(0,Math.PI/2,0));}
  enter(){this.transfer(this.blueCase,this.scene,new THREE.Vector3(.3,.04,-6.45),1700,1,new THREE.Euler(0,-.35,0));this.entry={at:performance.now(),from:this.camera.position.clone(),yaw:this.camera.rotation.y,pitch:this.camera.rotation.x};}
  returnToCourt(pose:ArrivalPose){this.entry=undefined;this.pose={...pose};}
  /** Chapter 2 starts inside the room: jump the camera there and put the closed suitcase away. */
  placeInside(pose:ArrivalPose){this.entry=undefined;this.pose={...pose};this.camera.position.set(pose.x,1.58,pose.z);this.blueCase.visible=false;}
  /** Returns the first visible object under the pointer that carries `userData[key]`. */
  hit(clientX:number,clientY:number,key:string){
    const rect=this.renderer.domElement.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((clientX-rect.left)/rect.width*2-1,-(clientY-rect.top)/rect.height*2+1),this.camera);
    for(const hit of ray.intersectObjects(this.scene.children,true)){let object:THREE.Object3D|null=hit.object,visible=true;for(let o:THREE.Object3D|null=object;o;o=o.parent)if(!o.visible)visible=false;if(!visible)continue;while(object&&object.userData[key]===undefined)object=object.parent;return object??undefined;}
    return undefined;
  }
  private resize=()=>{const{width,height}=this.host.getBoundingClientRect();this.renderer.setSize(width,height);this.camera.aspect=width/Math.max(height,1);this.camera.fov=width<650?76:62;this.camera.updateProjectionMatrix();};
  private click=(event:MouseEvent)=>{const rect=this.renderer.domElement.getBoundingClientRect(),pointer=new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),ray=new THREE.Raycaster();ray.setFromCamera(pointer,this.camera);const hit=ray.intersectObjects(this.scene.children,true).find(hit=>{let object:THREE.Object3D|null=hit.object;while(object){if(!object.visible||object===this.camera)return false;object=object.parent;}return true;});let object:THREE.Object3D|null=hit?.object??null;while(object){if(object.userData.target){this.interact(object.userData.target as ArrivalTarget);break;}object=object.parent;}};
  private frame=()=>{
    this.raf=requestAnimationFrame(this.frame);const now=performance.now();if(now-this.last<28)return;this.last=now;
    if(!this.entry){this.camera.position.lerp(new THREE.Vector3(this.pose.x,1.58,this.pose.z),this.reduced?1:.35);this.camera.rotation.set(this.conversation?(innerWidth<=560?-.35:-.22):this.pose.pitch,this.pose.yaw,0,'YXZ');}
    else{
      // Step to the threshold facing the door, then walk in and settle on a view of the room.
      const p=this.reduced?1:Math.min(1,(now-this.entry.at)/2200),first=THREE.MathUtils.smoothstep(p,0,.4),second=THREE.MathUtils.smoothstep(p,.4,1);
      const threshold=new THREE.Vector3(0,1.58,-3.95),home=new THREE.Vector3(homeView.x,1.58,homeView.z);
      if(p<.4)this.camera.position.lerpVectors(this.entry.from,threshold,first);else this.camera.position.lerpVectors(threshold,home,second);
      const startYaw=Math.atan2(Math.sin(this.entry.yaw),Math.cos(this.entry.yaw));
      const yaw=p<.4?THREE.MathUtils.lerp(startYaw,0,first):THREE.MathUtils.lerp(0,homeView.yaw,second),pitch=p<.4?THREE.MathUtils.lerp(this.entry.pitch,0,first):THREE.MathUtils.lerp(0,homeView.pitch,second);
      this.camera.rotation.set(pitch,yaw,0,'YXZ');
    }
    this.door.rotation.y=THREE.MathUtils.lerp(this.door.rotation.y,this.opening?Math.PI*.55:0,this.reduced?1:.09);
    for(const actor of this.actors.values()){
      actor.arms.forEach(arm=>arm.rotation.set(0,0,0));actor.legs.forEach(leg=>leg.rotation.x=0);actor.head.rotation.set(0,0,0);actor.root.rotation.x=0;
      if(actor.walk){const p=this.reduced?1:Math.min(1,(now-actor.walk.at)/actor.walk.duration);actor.root.position.lerpVectors(actor.walk.from,actor.walk.to,p);actor.root.rotation.y=Math.atan2(actor.walk.to.x-actor.walk.from.x,actor.walk.to.z-actor.walk.from.z);actor.legs.forEach((leg,i)=>leg.rotation.x=this.reduced?0:Math.sin(p*Math.PI*7)*(i?-.45:.45));actor.arms[0].rotation.x=-.3;if(p===1)actor.walk=undefined;}
      const action=actor.action,age=action?(now-action.at)/1000:10;
      if(action&&age<2.3&&!actor.walk){const strength=this.reduced?.85:Math.sin(Math.min(1,age/2.3)*Math.PI);const face=Math.atan2(action.target.x-actor.root.position.x,action.target.z-actor.root.position.z);actor.root.rotation.y+=Math.atan2(Math.sin(face-actor.root.rotation.y),Math.cos(face-actor.root.rotation.y))*(this.reduced?1:.2);
        if(action.kind==='hello'){actor.arms[0].rotation.set(-strength,0,.55*strength);actor.arms[1].rotation.set(-strength,0,-.55*strength);actor.head.rotation.x=.2*strength;actor.root.rotation.x=.06*strength;}
        if(action.kind==='offer'||action.kind==='thanks'){actor.arms[0].rotation.x=-1.25*strength;actor.arms[1].rotation.x=-1.1*strength;actor.head.rotation.x=.12*strength;}
        if(action.kind==='wave'){actor.arms[1].rotation.set(-2.4*strength,0,this.reduced?.15:Math.sin(age*12)*.3*strength);}
        if(action.kind==='point'){actor.arms[1].rotation.set(-1.3*strength,-.6*strength,-.45*strength);actor.head.rotation.y=.35*strength;}
        if(action.kind==='shake')actor.head.rotation.y=this.reduced?.2:Math.sin(age*11)*.25*strength;
        if(action.kind==='nod')actor.head.rotation.x=this.reduced?.15:Math.abs(Math.sin(age*7))*.18*strength;
      }
    }
    this.scene.updateMatrixWorld(true);
    this.transfers=this.transfers.filter(item=>{const p=Math.min(1,(now-item.at)/item.duration),e=p*p*(3-2*p),target=item.parent.localToWorld(item.to.clone());item.object.position.lerpVectors(item.from,target,e);item.object.position.y+=Math.sin(p*Math.PI)*.13;item.object.scale.setScalar(THREE.MathUtils.lerp(item.fromScale,item.scale,e));if(p===1){item.parent.attach(item.object);item.object.position.copy(item.to);item.object.scale.setScalar(item.scale);item.object.rotation.copy(item.rot);return false;}return true;});
    if(!this.reduced){this.flags.forEach((flag,i)=>flag.rotation.x=Math.sin(now*.0014+i)*.08);this.cat.scale.y=1+Math.sin(now*.001)*.025;}
    for(const label of this.labels){const distance=label.position.distanceTo(this.camera.position),pixelsPerMeter=this.host.clientHeight/(2*Math.tan(THREE.MathUtils.degToRad(this.camera.fov/2))*distance),width=Math.min(label.userData.width,Math.min(250,this.host.clientWidth*.36)/Math.max(1,pixelsPerMeter));label.scale.set(width,width/4,1);}
    this.renderer.render(this.scene,this.camera);
  };
  dispose(){cancelAnimationFrame(this.raf);this.observer.disconnect();this.renderer.domElement.removeEventListener('click',this.click);this.resources.forEach(resource=>resource.dispose());this.renderer.dispose();this.renderer.domElement.remove();}
}
