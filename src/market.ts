import * as THREE from 'three';
import { marketActivities, lostToy, pickColors, type ActivityId } from './market-world';

// The street shares the shop's world: crossing the threshold never cuts scenes.
export class GoldenMarket {
  root = new THREE.Group();
  /** Optional street-audio hook while the delivery bicycle is riding. */
  onBicyclePass?: (riding: boolean, progress: number) => void;
  private people: { body: THREE.Group; limbs: THREE.Group[]; role: 'vendor' | 'shopper' | 'child' | 'parent' | 'elder'; phase: number; home:THREE.Vector3; facing:number }[] = [];
  private clouds: THREE.Group[] = [];
  private bicycle = new THREE.Group();
  private wheels: THREE.Mesh[] = [];
  private pedals = new THREE.Group();
  private birds: THREE.Group[] = [];
  private fabrics: THREE.Mesh[] = [];
  private sun: THREE.Mesh;
  private dust: THREE.Points;
  private resources: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[] = [];
  private mats = new Map<string, THREE.MeshStandardMaterial>();
  private cube = new THREE.BoxGeometry(1, 1, 1);
  private sphere = new THREE.SphereGeometry(1, 10, 8);
  private markers = new Map<ActivityId, THREE.Sprite>();
  private delivered = new Map<ActivityId, THREE.Group>();
  private completed = new Set<ActivityId>();
  private lostTeddy = new THREE.Group();
  private taskItems = new Map<string,{object:THREE.Group;activity:ActivityId}>();
  private coinPile = new THREE.Group();
  private flights: {object:THREE.Object3D;from:THREE.Vector3;to:THREE.Vector3;at:number}[] = [];
  private actorActions = new Map<ActivityId,{kind:'greet'|'pack'|'point'|'give'|'receive'|'celebrate'|'bye';at:number;player:THREE.Vector3}>();
  private yielding = new Map<THREE.Group,THREE.Vector3>();
  private reduced = false;
  private coinGeometry = new THREE.CylinderGeometry(.075,.075,.018,20);
  private coinMaterial = new THREE.MeshStandardMaterial({color:'#e9be59',roughness:.28,metalness:.7});

  constructor(scene: THREE.Scene) {
    this.root.name = 'golden-market-street'; scene.add(this.root);
    // Local street length maps to world X; the shop opens onto its near footpath.
    this.root.rotation.y = Math.PI / 2; this.root.position.set(-26, 0, 14);
    this.root.visible = false;
    this.root.userData.streetWidth = 10;
    this.resources.push(this.cube, this.sphere);
    this.resources.push(this.coinGeometry,this.coinMaterial);this.root.add(this.coinPile);
    const skyGeometry = new THREE.SphereGeometry(95, 32, 20);
    const skyMaterial = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false,
      vertexShader: 'varying vec3 vPosition; void main(){vPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'varying vec3 vPosition; void main(){float h=smoothstep(-2.,50.,vPosition.y);vec3 col=mix(vec3(1.,.53,.18),vec3(.12,.47,.75),h);float rose=exp(-pow((vPosition.y-7.)/6.,2.));col=mix(col,vec3(1.,.42,.46),rose*.42);gl_FragColor=vec4(col,1.);}' });
    this.resources.push(skyGeometry, skyMaterial);
    const sky = new THREE.Mesh(skyGeometry, skyMaterial); sky.position.z = 15; this.root.add(sky);
    const sunMat = new THREE.MeshBasicMaterial({ color: '#fff9dd', fog: false, toneMapped: false }); this.resources.push(sunMat);
    this.sun = new THREE.Mesh(this.sphere, sunMat); this.sun.position.set(-1.8, 8.5, 65); this.sun.scale.setScalar(3.1); this.root.add(this.sun);
    const glowCanvas = document.createElement('canvas'); glowCanvas.width = glowCanvas.height = 128;
    const ctx = glowCanvas.getContext('2d')!;
    const glow = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    glow.addColorStop(0, '#fff2b8bb'); glow.addColorStop(.25, '#ffce6d66'); glow.addColorStop(1, '#ffb54600');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, 128, 128);
    const glowMap = new THREE.CanvasTexture(glowCanvas);
    const glowMat = new THREE.SpriteMaterial({ map: glowMap, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    const halo = new THREE.Sprite(glowMat); halo.scale.set(26, 26, 1); this.sun.add(halo); halo.scale.divideScalar(3.1);
    this.resources.push(glowMap, glowMat);
    const light = new THREE.DirectionalLight('#ffcd83', 2.8); light.position.set(-12, 13, 43);
    light.target.position.set(0, 0, 18); light.castShadow = true; light.shadow.mapSize.set(2048, 2048);
    Object.assign(light.shadow.camera, { left: -18, right: 18, top: 28, bottom: -20, near: 1, far: 90 });
    light.shadow.normalBias = .04; this.root.add(light, light.target);
    this.root.add(new THREE.HemisphereLight('#ffe6b8', '#9a7466', 1.5));

    this.box([70, .15, 85], [0, -.16, 42], '#b7a28a');
    this.box([10, .025, 74], [0, -.06, 41], '#c2ad91');
    for (const side of [-1, 1]) {
      const footpath = this.box([4.5, .24, 70], [side * 7.25, .025, 39], '#e5cdb2'); footpath.name = 'raised-footpath';
      this.box([.2, .29, 70], [side * 5.05, .045, 39], '#f3dcc0');
      for (let slab = 0; slab < 70; slab++) this.box([4.3, .008, .025], [side * 7.3, .15, 4 + slab], '#cbb193');
    }
    const pavingGeometry = new THREE.BoxGeometry(.47, .035, .68);
    const pavingMaterial = this.mat('#d2b99a');
    const paving = new THREE.InstancedMesh(pavingGeometry, pavingMaterial, 1800);
    const matrix = new THREE.Matrix4(), color = new THREE.Color();
    for (let i = 0; i < 1800; i++) {
      const row = Math.floor(i / 20), col = i % 20;
      matrix.makeTranslation((col - 9.5) * .49 + (row % 2) * .2, -.035, 6 + row * .73);
      paving.setMatrixAt(i, matrix); color.set(['#dac2a3', '#cbb194', '#d1b79a', '#bfa78d'][i * 7 % 4]); paving.setColorAt(i, color);
    }
    paving.receiveShadow = true; this.root.add(paving); this.resources.push(pavingGeometry);
    const plaster = ['#dba67a', '#e6c7a0', '#c99178', '#d7bd92', '#c7b5a0'];
    const awnings = ['#a85b43', '#617e6d', '#c69a44', '#687e86'];
    for (const side of [-1, 1]) for (let i = 0; i < 8; i++) {
      if (side === 1 && (i === 2 || i === 3)) continue; // The existing shop occupies this frontage.
      const z = 10 + i * 6.8, height = 5.8 + (i * 3 % 5) * .6, x = side * 11.5;
      const building = new THREE.Group(); this.root.add(building);
      // Reuse facade coordinates within a translated building group.
      this.box([4.1, height, 6.45], [side * 6.2, height / 2 - .02, z], plaster[(i + (side > 0 ? 2 : 0)) % 5], building);
      this.box([4.35, .18, 6.6], [side * 6.2, height + .05, z], '#b08a6d', building);
      this.box([.12, .2, 6.4], [side * 4.09, 3.25, z], '#f1d9b4', building);
      for (const offset of [-1.8, 0, 1.8]) {
        this.box([.08, 1.8, 1.03], [side * 4.12, 1.05, z + offset], '#466359', building);
        for (const y of [4.3, 6.4]) if (y < height - .4) {
          this.box([.12, 1.2, .92], [side * 4.1, y, z + offset], '#596d68', building);
          for (const shutter of [-.62, .62]) {
            this.box([.16, 1.3, .29], [side * 4.0, y, z + offset + shutter], '#6c897c', building);
            for (let slat = 0; slat < 5; slat++) this.box([.02, .035, .25], [side * 3.90, y - .45 + slat * .22, z + offset + shutter], '#8e9c84', building);
          }
          this.box([.3, .12, 1.5], [side * 4, y - .67, z + offset], '#d2b28c', building);
        }
      }
      building.position.x = x - side * 6.2;
      if (i < 6) {
        const stall = new THREE.Group(); this.root.add(stall);
        this.stall(side, z, awnings[(i + (side > 0 ? 1 : 0)) % 4], i, stall);
        stall.position.x = side * 5.3;
      }
      if (i % 2 === 0) this.tree(side * 5.65, z + 2.8);
    }
    // Layered rooftops soften into the warm horizon.
    for (let i = 0; i < 18; i++) {
      const h = 3 + Math.sin(i * 8) * 1.4;
      this.box([3.7, h, 3], [(i - 8.5) * 3.9, h / 2, 73 + (i % 3) * 2], '#bda18e');
    }
    for (let row = 0; row < 5; row++) {
      const z = 13 + row * 9;
      const linePoints: THREE.Vector3[] = [];
      for (let i = 0; i <= 20; i++) linePoints.push(new THREE.Vector3(-9.4 + i * .94, 6.7 - Math.sin(i / 20 * Math.PI) * 1.15, z));
      const wireGeometry = new THREE.BufferGeometry().setFromPoints(linePoints);
      const wireMat = new THREE.LineBasicMaterial({ color: '#7e725b' }); this.resources.push(wireGeometry, wireMat);
      this.root.add(new THREE.Line(wireGeometry, wireMat));
      for (let i = 1; i < 13; i++) {
        const flagGeo = new THREE.BufferGeometry();
        flagGeo.setAttribute('position', new THREE.Float32BufferAttribute([-.22, 0, 0, .22, 0, 0, 0, -.53, 0], 3)); flagGeo.computeVertexNormals();
        const flagMat = new THREE.MeshStandardMaterial({ color: ['#b86e4e', '#e5bd65', '#7a9684', '#f4ddac'][i % 4], side: THREE.DoubleSide });
        const flag = new THREE.Mesh(flagGeo, flagMat); flag.position.set(-9.4 + i * 1.44, 6.7 - Math.sin(i / 13 * Math.PI) * 1.15, z);
        this.root.add(flag); this.fabrics.push(flag); this.resources.push(flagGeo, flagMat);
      }
    }
    this.makeResidents(); this.makeBicycle(); this.makeClouds();
    this.makeActivityMarkers();
    for (let i = 0; i < 9; i++) {
      const bird = new THREE.Group();
      for (const side of [-1, 1]) {
        const wing = this.box([.5, .045, .14], [side * .24, 0, 0], '#655b55', bird); wing.userData.side = side;
      }
      this.root.add(bird); this.birds.push(bird);
    }
    const dustGeometry = new THREE.BufferGeometry(); const positions = new Float32Array(180 * 3);
    for (let i = 0; i < 180; i++) { positions[i * 3] = Math.sin(i * 127.1) * 7; positions[i * 3 + 1] = (i % 27) / 5 + .3; positions[i * 3 + 2] = 6 + (i * 7.31 % 45); }
    dustGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const dustMaterial = new THREE.PointsMaterial({ color: '#ffe8b0', size: .035, transparent: true, opacity: .65, depthWrite: false });
    this.dust = new THREE.Points(dustGeometry, dustMaterial); this.root.add(this.dust); this.resources.push(dustGeometry, dustMaterial);
  }

  private mat(color: string) {
    if (!this.mats.has(color)) { const mat = new THREE.MeshStandardMaterial({ color, roughness: .9 }); this.mats.set(color, mat); this.resources.push(mat); }
    return this.mats.get(color)!;
  }
  private box(size: number[], at: number[], color: string, parent: THREE.Object3D = this.root) {
    const mesh = new THREE.Mesh(this.cube, this.mat(color)); mesh.scale.set(size[0], size[1], size[2]); mesh.position.set(at[0], at[1], at[2]);
    mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  private ball(size: number[], at: number[], color: string, parent: THREE.Object3D = this.root) {
    const mesh = new THREE.Mesh(this.sphere, this.mat(color)); mesh.scale.set(size[0], size[1], size[2]); mesh.position.set(at[0], at[1], at[2]); parent.add(mesh); return mesh;
  }
  private stall(side: number, z: number, color: string, index: number, parent: THREE.Group) {
    if(side===1&&index===1)parent.userData.activityId='bread';
    if(side===1&&index===4)parent.userData.activityId='fruit';
    if(side===-1&&index===2)parent.userData.activityId='flowers';
    for (const dz of [-1.95, 1.95]) this.box([.065, 2.6, .065], [side * 2.6, 1.3, z + dz], '#80674f', parent);
    for (let stripe = 0; stripe < 12; stripe++) {
      const roof = this.box([1.6, .045, .33], [side * 3.32, 2.72, z - 1.82 + stripe * .33], stripe % 2 ? '#f4dfb7' : color, parent);
      roof.rotation.z = side * .15;
      this.box([.06, .23, .33], [side * 2.53, 2.49, z - 1.82 + stripe * .33], stripe % 2 ? '#f4dfb7' : color, parent);
    }
    this.box([1.1, .75, 3.65], [side * 3.35, .38, z], '#9e7751', parent);
    this.box([1.25, .07, 3.85], [side * 3.35, .8, z], '#ddbb87', parent);
    for (let bin = 0; bin < 4; bin++) {
      this.box([.95, .12, .78], [side * 3.35, .88, z - 1.35 + bin * .88], '#b48c59', parent);
      // The two central trays hold the real pickable flowers. Decorative stems
      // here would obscure their hit targets and remain after collection.
      if(side===-1&&index===2&&(bin===1||bin===2))continue;
      for (let n = 0; n < 12; n++) {
        const at = [side * 3.35 + (n % 3 - 1) * .23, 1.01 + (n > 8 ? .09 : 0), z - 1.6 + bin * .88 + Math.floor(n / 3) * .16];
        if (side === -1 && index === 2) {
          this.box([.012,.3,.012],[at[0],1.1,at[2]],'#6d9062',parent);
          this.ball([.07,.045,.07],[at[0],1.27,at[2]],['#e6a0a7','#e9cc76','#c998ce'][n%3],parent);
        } else this.ball([.095,.09,side === 1 && index === 1 ? .21 : .095],at,side === 1 && index === 1 ? '#dfb778' : ['#cb6f42','#d6a848','#8eaa58','#b75b43'][(bin+index)%4],parent);
      }
    }
    // Hanging wooden signs and little pools of lamplight.
    this.box([.85, .06, .06], [side * 3.7, 3.55, z - 1.4], '#755e4b', parent);
    this.box([.13, .48, .65], [side * 3.35, 3.24, z - 1.4], color, parent);
    this.ball([.09, .17, .09], [side * 2.65, 2.28, z - 1.7], '#ffe1a0', parent);
  }
  private makeActivityMarkers() {
    for (const activity of marketActivities) {
      const canvas=document.createElement('canvas'); canvas.width=512; canvas.height=160;
      const ctx=canvas.getContext('2d')!;
      ctx.fillStyle='#fff7e7';ctx.beginPath();ctx.roundRect(4,4,504,152,45);ctx.fill();
      ctx.fillStyle='#285d58';ctx.textAlign='center';ctx.font='bold 35px sans-serif';ctx.fillText(activity.name.toUpperCase(),256,94);
      const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
      const mat=new THREE.SpriteMaterial({map,depthTest:true});const marker=new THREE.Sprite(mat);
      marker.position.set(14-activity.z,activity.id==='family'?2.05:2.55,activity.x+26);marker.scale.set(1.4,.44,1);
      marker.userData.activityId=activity.id;marker.name=`activity-${activity.id}`;
      this.root.add(marker);this.markers.set(activity.id,marker);this.resources.push(map,mat);
      const resident=this.people.find(person=>activity.id==='family'?person.role==='parent':person.role==='vendor'&&Math.abs(person.body.position.z-activity.x-26)<.1&&Math.abs(person.body.position.x-(14-activity.z))<.7);
      if(resident)resident.body.userData.activityId=activity.id;
      if(activity.id!=='family'){
        const customer=this.people.find(person=>person.role==='shopper'&&Math.abs(person.home.z-activity.x-26-.4)<.1&&Math.abs(person.home.x-(14-activity.z))<3);
        if(customer)customer.body.userData.forActivity=activity.id;
      }
    }
    this.teddy(this.lostTeddy);this.lostTeddy.position.set(14-lostToy.z,.16,lostToy.x+26);this.lostTeddy.userData.marketItem='lost-toy';this.lostTeddy.name='lost-red-teddy';this.root.add(this.lostTeddy);
    const child=this.people.find(person=>person.role==='child');if(child)child.body.userData.activityId='family';
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const ctx=canvas.getContext('2d')!;
    ctx.fillStyle='#376f61';ctx.beginPath();ctx.roundRect(0,0,512,128,18);ctx.fill();ctx.fillStyle='#fff5dc';ctx.font='bold 38px sans-serif';ctx.textAlign='center';ctx.fillText('THE LITTLE SHOP',256,80);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const labelMaterial=new THREE.SpriteMaterial({map:texture});const label=new THREE.Sprite(labelMaterial);label.position.set(9.85,3.1,26);label.scale.set(2.5,.625,1);this.root.add(label);this.resources.push(texture,labelMaterial);
  }
  /** Builds the teddy model; shared by the street, the handover, the child and the player's hand. */
  teddy(parent:THREE.Object3D){
    this.ball([.12,.15,.09],[0,.16,0],'#b95e4e',parent);this.ball([.13,.12,.1],[0,.36,0],'#c96b53',parent);
    this.ball([.075,.09,.02],[0,.16,.084],'#f1c599',parent);
    for(const side of [-1,1]){this.ball([.055,.055,.04],[side*.11,.45,0],'#b95e4e',parent);this.ball([.05,.1,.055],[side*.15,.2,0],'#c96b53',parent);this.ball([.06,.055,.08],[side*.08,.035,.02],'#b95e4e',parent);this.ball([.013,.016,.012],[side*.045,.38,.095],'#392d2c',parent);}
    this.ball([.018,.014,.016],[0,.33,.11],'#392d2c',parent);
  }
  react(id:ActivityId,kind:'greet'|'pack'|'point'|'give'|'receive'|'celebrate'|'bye',player:{x:number;z:number}){
    const previous=this.actorActions.get(id);if(kind==='bye'&&previous?.kind==='celebrate'&&performance.now()-previous.at<2400)return;
    this.actorActions.set(id,{kind,at:performance.now(),player:new THREE.Vector3(14-player.z,0,player.x+26)});
    const customer=this.people.find(person=>person.body.userData.forActivity===id);
    if(customer&&!this.yielding.has(customer.body)){
      const activity=marketActivities.find(item=>item.id===id)!;
      const target=customer.home.clone();target.z+=(player.x>activity.x?-1:1)*1.8;this.yielding.set(customer.body,target);
    }
  }
  peopleObstacles(){return this.people.filter(person=>person.role!=='vendor').map(person=>({x:person.body.position.z-26,z:14-person.body.position.x}));}
  private fly(object:THREE.Object3D,from:THREE.Vector3,to:THREE.Vector3,delay=0){
    if(this.reduced)return;
    const copy=object.clone(true);copy.position.copy(from);copy.visible=!delay;this.root.add(copy);this.flights.push({object:copy,from:from.clone(),to:to.clone(),at:performance.now()+delay});
  }
  prepareItems(id:ActivityId){
    if([...this.taskItems.values()].some(item=>item.activity===id))return;
    const activity=marketActivities.find(item=>item.id===id)!;
    if(id==='fruit'){
      // Red apples (asked for) alternate with green distractors along the counter.
      const colors=pickColors.fruit;
      for(let slot=0;slot<7;slot++){
        const right=slot%2===0,index=Math.floor(slot/2),key=right?`fruit-${index}`:`fruit-wrong-${index}`;
        const item=new THREE.Group();item.name=`pick-${key}`;item.userData.marketItem=key;
        item.position.set(14-6.05,1.04,activity.x+26-.9+slot*.3);
        this.ball([.12,.12,.12],[0,.12,0],right?colors.hex:colors.other,item);this.box([.018,.07,.018],[0,.26,0],'#6d5139',item);
        this.root.add(item);this.taskItems.set(key,{object:item,activity:id});
      }
      return;
    }
    for(let i=0;i<5;i++){
      const item=new THREE.Group();item.name=`pick-${id}-${i}`;item.userData.marketItem=`${id}-${i}`;
      const z=activity.id==='flowers'?21.95:6.05;
      item.position.set(14-z,1.04,activity.x+26-.7+i*(id==='flowers'?.11:.35));
      if(id==='flowers'){this.box([.025,.3,.025],[0,.16,0],'#678858',item);for(let petal=0;petal<5;petal++)this.ball([.07,.035,.07],[Math.sin(petal*1.256)*.06,.32,Math.cos(petal*1.256)*.06],pickColors.flowers.hex,item);}
      else this.ball([.12,.12,.12],[0,.12,0],'#db7552',item);
      this.root.add(item);this.taskItems.set(`${id}-${i}`,{object:item,activity:id});
    }
    if(id==='flowers')for(let i=0;i<3;i++){
      const item=new THREE.Group();item.position.set(-7.95,1.04,activity.x+26+.45+i*.12);item.userData.marketItem=`flowers-wrong-${i}`;
      this.box([.025,.3,.025],[0,.16,0],'#678858',item);this.ball([.08,.05,.08],[0,.32,0],pickColors.flowers.other,item);this.root.add(item);this.taskItems.set(`flowers-wrong-${i}`,{object:item,activity:id});
    }
  }
  pickItem(key:string,player:{x:number;z:number}){
    const item=this.taskItems.get(key);if(!item||!item.object.visible)return false;
    this.fly(item.object,item.object.position,new THREE.Vector3(14-player.z,1.05,player.x+26));item.object.visible=false;return true;
  }
  availableItem(id:ActivityId){return [...this.taskItems].find(([key,item])=>!key.includes('wrong')&&item.activity===id&&item.object.visible)?.[0];}
  returnItem(key:string){const item=this.taskItems.get(key);if(item)item.object.visible=true;}
  /** World anchor for positional child reactions (sniffles / giggle). */
  childBody(){return this.people.find(person=>person.role==='child')?.body;}
  /** World anchor for the delivery bicycle pass audio. */
  bicycleBody(){return this.bicycle;}
  /** World anchor for the neighbor who speaks during an errand conversation. */
  speakerBody(id:ActivityId){
    if(id==='family')return this.people.find(person=>person.role==='parent')?.body;
    return this.people.find(person=>person.body.userData.activityId===id&&person.role==='vendor')?.body
      ?? this.people.find(person=>person.body.userData.activityId===id)?.body;
  }
  pickToy(player:{x:number;z:number}){
    if(!this.lostTeddy.visible)return false;
    this.fly(this.lostTeddy,this.lostTeddy.position,new THREE.Vector3(14-player.z,1.05,player.x+26));this.lostTeddy.visible=false;return true;
  }
  setCoins(count:number,player:{x:number;z:number}){
    const targetCount=Math.max(0,Math.min(5,count));
    while(this.coinPile.children.length>targetCount)this.coinPile.children[this.coinPile.children.length-1].removeFromParent();
    while(this.coinPile.children.length<targetCount){
      const i=this.coinPile.children.length;const coin=new THREE.Mesh(this.coinGeometry,this.coinMaterial);
      coin.position.set(7.95,1.1,16.8-.35+i*.18);coin.name=`counter-coin-${i+1}`;this.coinPile.add(coin);
      this.fly(coin,new THREE.Vector3(14-player.z,1.1,player.x+26),coin.position);
    }
  }
  handover(id:ActivityId,player:{x:number;z:number}){
    const activity=marketActivities.find(item=>item.id===id)!;const parcel=new THREE.Group();
    if(id==='family'){this.teddy(parcel);this.fly(parcel,new THREE.Vector3(14-player.z,1.05,player.x+26),new THREE.Vector3(6.2,.8,30.6));}
    else {
      this.box([.38,.3,.22],[0,.15,0],'#c8a56f',parcel);
      const goods=id==='bread'?'#e1b679':id==='fruit'||id==='flowers'?pickColors[id].hex:activity.color;
      for(let i=0;i<(id==='bread'?1:activity.count);i++)this.ball([.08,.07,id==='bread'?.2:.08],[(i%3-1)*.1,.33,Math.floor(i/3)*.1],goods,parcel);
      const counter=new THREE.Vector3(14-activity.z,1.25,activity.x+26),hands=new THREE.Vector3(14-player.z,1.1,player.x+26);
      if(id==='bread'){
        this.coinPile.children.forEach(coin=>{this.fly(coin,coin.position,counter);coin.visible=false;});
        this.fly(parcel,counter,hands,700);
      }else{this.fly(parcel,hands,counter);this.fly(parcel,counter,hands,950);}
    }
    this.react(id,id==='family'?'celebrate':'pack',player);
  }
  markActivity(id: ActivityId, count: number, fulfilled = true) {
    if(fulfilled) this.completed.add(id);
    const marker=this.markers.get(id); if(marker) marker.material.color.set(fulfilled?'#9fdbc2':'#ffffff');
    this.delivered.get(id)?.removeFromParent();
    if(!fulfilled)return;
    const activity=marketActivities.find(item=>item.id===id)!;
    if(id==='family'){
      this.lostTeddy.visible=false;const child=this.people.find(person=>person.role==='child')!;const toy=new THREE.Group();this.teddy(toy);toy.position.set(0,.75,.26);toy.scale.setScalar(.8);child.body.add(toy);this.delivered.set(id,toy);return;
    }
    for(const [key,item] of this.taskItems)if(item.activity===id){item.object.removeFromParent();this.taskItems.delete(key);}
    if(id==='bread')this.coinPile.clear();
  }
  resetActivities() {
    this.completed.clear();this.delivered.forEach(goods=>goods.removeFromParent());this.delivered.clear();
    this.markers.forEach(marker=>marker.material.color.set('#ffffff'));
    this.lostTeddy.visible=true;this.taskItems.forEach(item=>item.object.removeFromParent());this.taskItems.clear();this.coinPile.clear();
    this.actorActions.clear();this.flights.forEach(flight=>flight.object.removeFromParent());this.flights=[];
    this.yielding.clear();this.people.forEach(person=>person.body.position.copy(person.home));
  }
  private tree(x: number, z: number) {
    this.box([.6, .48, .6], [x, .24, z], '#ab7359');
    this.box([.13, 2.5, .13], [x, 1.5, z], '#8d7752');
    for (let i = 0; i < 5; i++) this.ball([.7, .85, .7], [x + Math.sin(i * 2.4) * .45, 2.7 + i % 2 * .5, z + Math.cos(i * 2.4) * .4], i % 2 ? '#a8ad6d' : '#88965e');
  }
  private resident(i: number, role: 'vendor' | 'shopper' | 'child' | 'parent' | 'elder', x: number, z: number, facing: number) {
    const body = new THREE.Group(); this.root.add(body); body.name = `${role}-${i}`;
    const skin = ['#72432e', '#dba27a', '#9e603e', '#efc29a', '#b57c56'][i % 5];
    const shirt = ['#297c86', '#d07846', '#e7bd55', '#74669b', '#e6dfcc', '#4c8165', '#a44f62'][i % 7];
    const trousers = ['#434e6d', '#785945', '#e3c79b', '#42574c'][i % 4];
    const hair = role === 'elder' ? '#c9c6bb' : ['#302c2b', '#633d28', '#a16c3e', '#201f25'][i % 4];
    const breadth = role === 'child' ? .85 : [.85, 1.15, 1.4, 1][i % 4];
    const head = new THREE.Group(); head.position.y = 1.49; head.name = 'head'; body.add(head);
    this.ball([.15, .19, .15], [0, 0, 0], skin, head);
    if (i % 4 === 0) { // Curls, rather than a shared cap silhouette.
      for (let curl = 0; curl < 9; curl++) this.ball([.065, .065, .065], [Math.sin(curl * 2.4) * .13, .12 + curl % 2 * .045, Math.cos(curl * 2.4) * .12], hair, head);
    } else if (i % 4 === 1) {
      this.ball([.17, .1, .16], [0, .12, -.03], hair, head);
      this.ball([.075, .085, .09], [0, .17, -.18], hair, head); // Bun.
    } else if (i % 4 === 2) {
      this.ball([.17, .1, .16], [0, .12, -.025], hair, head);
      this.ball([.055, .19, .065], [.14, -.04, -.1], hair, head);
      this.ball([.055, .19, .065], [-.14, -.04, -.1], hair, head); // Bob.
    } else {
      this.ball([.16, .065, .15], [0, .14, -.03], hair, head);
      this.ball([.11, .06, .08], [-.06, .11, .09], hair, head); // Swept fringe.
    }
    for (const eye of [-.052, .052]) this.ball([.013, .018, .012], [eye, .02, .14], '#352e2b', head);
    this.ball([.025, .035, .025], [0, -.03, .15], skin, head);
    const mouthGeometry=new THREE.TorusGeometry(.035,.005,6,12,Math.PI);this.resources.push(mouthGeometry);
    const mouth=new THREE.Mesh(mouthGeometry,this.mat('#8e5149'));mouth.position.set(0,-.09,.148);mouth.rotation.z=role==='child'?0:Math.PI;mouth.name='mouth';head.add(mouth);
    this.ball([.21 * breadth, .32, .15], [0, 1.05, 0], shirt, body);
    this.box([.34 * breadth, .37, .25], [0, 1.0, 0], shirt, body);
    if (role === 'vendor') {
      this.box([.31 * breadth, .62, .025], [0, .93, .153], '#f1dfba', body);
      this.box([.19, .1, .025], [0, .94, .172], '#c5ac86', body);
      this.ball([.18, .08, .18], [0, 1.72, 0], shirt, body);
    } else if (i % 3 === 0 && role !== 'child') {
      const skirtGeo = new THREE.CylinderGeometry(.17 * breadth, .3 * breadth, .62, 12);
      this.resources.push(skirtGeo); const skirt = new THREE.Mesh(skirtGeo, this.mat(shirt)); skirt.position.y = .66; body.add(skirt);
      this.box([.07, .5, .03], [-.13, 1.18, .16], '#ebc785', body); // Scarf.
    } else if (i % 3 === 1) {
      for (const side of [-1, 1]) this.box([.13 * breadth, .47, .04], [side * .13 * breadth, 1.06, .15], '#554d66', body);
      for (let button = 0; button < 3; button++) this.ball([.015, .015, .014], [0, .94 + button * .11, .16], '#ead1a0', body);
    } else {
      for (let stripe = 0; stripe < 3; stripe++) this.box([.35 * breadth, .025, .015], [0, .96 + stripe * .12, .15], '#f1e0c1', body);
    }
    const limbs: THREE.Group[] = [];
    for (const side of [-1, 1]) {
      const leg = new THREE.Group(); leg.position.set(side * .1 * breadth, .82, 0); body.add(leg);
      this.box([.14 * breadth, .65, .16], [0, -.33, 0], trousers, leg); this.box([.16, .09, .26], [0, -.7, .045], '#604c3f', leg); limbs.push(leg);
      const arm = new THREE.Group(); arm.position.set(side * .24 * breadth, 1.26, 0); body.add(arm);
      this.ball([.085, .2, .085], [0, -.16, 0], shirt, arm); this.ball([.065, .17, .065], [0, -.4, 0], skin, arm); limbs.push(arm);
      if (side === 1 && role === 'shopper') {
        this.box([.27, .28, .17], [0, -.66, 0], '#ba965f', arm);
        this.ball([.075, .075, .075], [0, -.49, 0], '#c56939', arm);
      }
    }
    if (role === 'elder') {
      this.box([.035, .89, .035], [.35, .5, .18], '#815b3f', body);
      this.box([.15, .035, .035], [.3, .95, .18], '#815b3f', body);
      for (const side of [-1, 1]) {
        this.box([.083, .045, .02], [side * .055, 1.51, .15], '#b49b70', body);
        this.ball([.031, .015, .013], [side * .055, 1.51, .167], '#554a3e', body);
      }
    }
    if (role === 'child') {
      this.ball([.025, .045, .015], [-.095, -.04, .15], '#8ccfe9', head).name='cry-tear-left';
      this.ball([.025, .045, .015], [.095, -.04, .15], '#8ccfe9', head).name='cry-tear-right';
    }
    const scale = role === 'child' ? .59 : role === 'elder' ? .91 : [.98, 1.07, 1, 1.12][i % 4];
    body.scale.setScalar(scale); body.position.set(x, .15, z); body.rotation.y = facing;
    body.userData = { role, age: role === 'child' ? 'child' : role === 'elder' ? 'elder' : 'adult', outfit: role === 'vendor' ? 'apron' : i % 3, breadth, skin, hairstyle: i % 4 };
    this.people.push({ body, limbs, role, phase: i * .47, home:body.position.clone(), facing });
    return body;
  }
  private makeResidents() {
    let id = 0;
    // Customers face a stall and vendors serve them; nobody paces the roadway.
    for (const side of [-1, 1]) for (const z of [16.8, 23.6, 37.2, 44]) {
      if (side === 1 && z === 23.6) continue;
      this.resident(id++, 'vendor', side * 9.15, z, -side * Math.PI / 2);
      this.resident(id++, 'shopper', side * 6.8, z + .4, side * Math.PI / 2);
    }
    this.resident(16, 'child', 6.2, 30.6, .25);
    this.resident(17, 'parent', 6.45, 31.65, Math.PI);
    this.resident(18, 'elder', -6.25, 28.7, -.8);
    this.resident(19, 'shopper', -6.3, 34, -Math.PI / 2);
  }
  private rod(a: THREE.Vector3, b: THREE.Vector3, radius: number, color: string, parent: THREE.Object3D) {
    const geo = new THREE.CylinderGeometry(radius, radius, a.distanceTo(b), 8); this.resources.push(geo);
    const mesh = new THREE.Mesh(geo, this.mat(color)); mesh.position.copy(a).add(b).multiplyScalar(.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); parent.add(mesh);
  }
  private makeBicycle() {
    this.bicycle.name = 'delivery-bicycle'; this.root.add(this.bicycle);
    const tireGeo = new THREE.TorusGeometry(.36, .035, 8, 24); this.resources.push(tireGeo);
    for (const z of [-.62, .62]) {
      const wheel = new THREE.Mesh(tireGeo, this.mat('#414844')); wheel.position.set(0, .4, z); wheel.rotation.y = Math.PI / 2;
      this.bicycle.add(wheel); this.wheels.push(wheel);
      for (let spoke = 0; spoke < 8; spoke++) {
        const angle = spoke * Math.PI / 4;
        this.rod(new THREE.Vector3(0, 0, 0), new THREE.Vector3(Math.sin(angle) * .33, Math.cos(angle) * .33, 0), .007, '#c9c2ad', wheel);
      }
    }
    const nodes = [[0, .4, -.62], [0, .48, 0], [0, .95, -.24], [0, 1.04, .4], [0, .4, .62]].map(p => new THREE.Vector3(...p as [number, number, number]));
    for (const [a, b] of [[0, 1], [0, 2], [1, 2], [2, 3], [1, 3], [3, 4]]) this.rod(nodes[a], nodes[b], .028, '#368a8b', this.bicycle);
    this.box([.28, .07, .24], [0, 1.0, -.27], '#594c41', this.bicycle);
    this.rod(nodes[3], new THREE.Vector3(0, 1.22, .44), .025, '#c9c2ad', this.bicycle);
    this.box([.58, .035, .04], [0, 1.22, .44], '#5a5d56', this.bicycle);
    this.box([.46, .36, .38], [0, .89, -.72], '#bd8951', this.bicycle);
    for (let bread = 0; bread < 3; bread++) this.ball([.055, .07, .22], [-.13 + bread * .13, 1.12, -.72], '#e0b66f', this.bicycle);
    const rider = new THREE.Group(); this.bicycle.add(rider);
    this.ball([.15, .18, .15], [0, 1.78, .16], '#a96c48', rider);
    this.ball([.18, .095, .18], [0, 1.9, .15], '#ddac4c', rider);
    const torso = this.box([.38, .5, .24], [0, 1.4, -.02], '#506a9b', rider); torso.rotation.x = .24;
    for (const side of [-1, 1]) this.rod(new THREE.Vector3(side * .23, 1.58, .06), new THREE.Vector3(side * .27, 1.23, .44), .055, '#a96c48', rider);
    this.pedals.position.set(0, .5, 0); this.bicycle.add(this.pedals);
    for (const side of [-1, 1]) {
      this.box([.16, .05, .16], [side * .2, side * .16, 0], '#48483e', this.pedals);
      const leg = this.box([.14, .43, .17], [side * .13, .89, -.13], '#4e514c', rider); leg.name = `cycling-leg-${side}`;
    }
  }
  private makeClouds() {
    for (let i = 0; i < 12; i++) {
      const cloud = new THREE.Group(); cloud.position.set(-35 + i % 4 * 22, 13 + i % 3 * 4, 15 + Math.floor(i / 4) * 24);
      const cloudMat = new THREE.MeshBasicMaterial({ color: i % 3 ? '#ffd4bd' : '#fff1d4', fog: false, toneMapped: false }); this.resources.push(cloudMat);
      for (let puff = 0; puff < 6; puff++) {
        const mesh = new THREE.Mesh(this.sphere, cloudMat); mesh.position.set((puff - 2.5) * 1.35, Math.sin(puff * 2.2) * .4, Math.cos(puff) * .5);
        mesh.scale.set(2.3, .65 + (puff % 3) * .25, 1.1); cloud.add(mesh);
      }
      this.root.add(cloud); this.clouds.push(cloud);
    }
  }
  update(seconds: number, progress: number, reduced: boolean) {
    this.reduced=reduced;
    const t = reduced ? 0 : seconds;
    const now=performance.now();
    this.sun.position.y = 8.5 - progress * 2.2;
    this.people.forEach(person => {
      const gesture = Math.max(0, Math.sin(t * .8 + person.phase));
      person.limbs.forEach(limb => limb.rotation.set(0, 0, 0));
      if (person.role === 'shopper' || person.role === 'vendor') {
        // A reach, an exchange, then the bag lowers. Feet stay at the stall.
        person.limbs[3].rotation.x = -.3 - gesture * .85;
        person.limbs[1].rotation.x = person.role === 'vendor' ? -.25 - gesture * .55 : -.15;
        person.body.getObjectByName('head')!.rotation.x = gesture * .12;
      } else if (person.role === 'child') {
        const fuss = reduced || this.completed.has('family') ? 0 : Math.sin(t * 7);
        person.limbs[1].rotation.z = -.9 - fuss * .45;
        person.limbs[3].rotation.z = .9 + fuss * .45;
        person.limbs[0].rotation.x = Math.max(0, fuss) * -.5;
        person.limbs[2].rotation.x = Math.min(0, fuss) * .5;
        person.body.position.y = .15 + Math.abs(fuss) * .045;
        person.body.getObjectByName('head')!.rotation.z = fuss * .15;
        if(this.completed.has('family')){person.limbs[1].rotation.z=.15;person.limbs[3].rotation.z=-.15;person.limbs[1].rotation.x=-.6;person.limbs[3].rotation.x=-.6;}
        person.body.getObjectByName('cry-tear-left')!.visible=!this.completed.has('family');person.body.getObjectByName('cry-tear-right')!.visible=!this.completed.has('family');person.body.getObjectByName('mouth')!.rotation.z=this.completed.has('family')?Math.PI:0;
      } else if (person.role === 'parent') {
        person.body.position.y = this.completed.has('family')?.15:-.25; person.body.rotation.x = this.completed.has('family')?0:-.15;
        person.limbs[0].rotation.x = this.completed.has('family')?0:-.9; person.limbs[2].rotation.x = this.completed.has('family')?0:-.9;
        person.limbs[1].rotation.x = -.8 - gesture * .18; person.limbs[3].rotation.x = -.8;
      } else {
        person.body.rotation.x = .12; person.limbs[3].rotation.x = -.38;
        person.body.getObjectByName('head')!.rotation.y = Math.sin(t * .3) * .12;
      }
      const action=this.actorActions.get(person.body.userData.activityId as ActivityId);
      const age=action?(now-action.at)/1000:10;
      const active=action&&age<2.4;
      if(active){
        const strength=reduced?.85:Math.sin(Math.min(1,age/2.4)*Math.PI);
        const dx=action.player.x-person.home.x,dz=action.player.z-person.home.z;
        const face=Math.atan2(dx,dz);
        const delta=Math.atan2(Math.sin(face-person.body.rotation.y),Math.cos(face-person.body.rotation.y));
        person.body.rotation.y+=delta*(reduced?1:.15);
        const fetching=action.kind==='pack'&&person.role==='vendor';
        person.body.position.z=person.home.z+(reduced?0:fetching?Math.sin(Math.min(1,age/2.4)*Math.PI)*.85:Math.sin(age*Math.PI)*.17*strength);
        person.limbs[0].rotation.x=reduced?0:Math.sin(age*8)*(fetching?.5:.13)*strength;person.limbs[2].rotation.x=reduced?0:-Math.sin(age*8)*(fetching?.5:.13)*strength;
        if(action.kind==='greet'){person.limbs[1].rotation.set(-1.1*strength,0,.55*strength);person.limbs[3].rotation.set(-1.1*strength,0,-.55*strength);person.body.getObjectByName('head')!.rotation.x=.23*strength;}
        else if(action.kind==='point'){person.limbs[3].rotation.set(-1.5*strength,-.6*strength,-.5*strength);person.body.getObjectByName('head')!.rotation.y=.6*strength;}
        else if(action.kind==='bye'){person.limbs[3].rotation.set(-2.4*strength,0,Math.sin(age*12)*.3*strength);}
        else if(action.kind==='celebrate'){person.limbs[1].rotation.x=-1.6*strength;person.limbs[3].rotation.x=-1.6*strength;if(person.role==='child')person.body.position.y=.15+(reduced?0:Math.abs(Math.sin(age*8))*.12);}
        else{person.limbs[1].rotation.x=-1.25*strength;person.limbs[3].rotation.x=-1.25*strength;person.body.rotation.x=.12*strength;person.body.getObjectByName('head')!.rotation.x=.2*strength;}
      }else{if(!this.yielding.has(person.body))person.body.position.z=person.home.z;person.body.rotation.y+=Math.atan2(Math.sin(person.facing-person.body.rotation.y),Math.cos(person.facing-person.body.rotation.y))*.1;}
      const waitingSpot=this.yielding.get(person.body);
      if(waitingSpot){
        const walking=person.body.position.distanceTo(waitingSpot)>.04;
        person.body.position.lerp(waitingSpot,reduced?1:.08);
        if(walking&&!reduced){person.limbs[0].rotation.x=Math.sin(now*.012)*.5;person.limbs[2].rotation.x=-Math.sin(now*.012)*.5;}
      }
    });
    this.flights=this.flights.filter(flight=>{if(now<flight.at)return true;flight.object.visible=true;const p=Math.min(1,(now-flight.at)/850);flight.object.position.lerpVectors(flight.from,flight.to,p*p*(3-2*p));flight.object.position.y+=Math.sin(p*Math.PI)*.23;flight.object.rotation.y=p*1.5;if(p===1||reduced){flight.object.removeFromParent();return false;}return true;});
    // One purposeful delivery pass, with turning wheels and pedals.
    const deliveryTime=t%45;
    const ride = THREE.MathUtils.clamp((deliveryTime - 1.8) / 7.2, 0, 1);
    const riding = !reduced && deliveryTime >= 1.8 && deliveryTime < 9;
    this.bicycle.position.set(1.6, 0, 10 + ride * 46);
    this.bicycle.visible = reduced || riding;
    this.wheels.forEach(wheel => wheel.rotation.z = -ride * 46 / .36);
    this.pedals.rotation.x = t * 7;
    this.bicycle.getObjectsByProperty('name', 'cycling-leg--1').forEach(leg => leg.rotation.x = Math.sin(t * 7) * .5);
    this.bicycle.getObjectsByProperty('name', 'cycling-leg-1').forEach(leg => leg.rotation.x = -Math.sin(t * 7) * .5);
    this.onBicyclePass?.(riding, ride);
    this.clouds.forEach((cloud, i) => cloud.position.x = -35 + i % 4 * 22 + Math.sin(t * .025 + i) * .7);
    this.birds.forEach((bird, i) => {
      bird.position.set(((t * 1.1 + i * 3.7) % 35) - 17, 8 + Math.sin(t * .5 + i) * .4 + i % 3 * .8, 27 + i * 3);
      bird.rotation.y = -.35;
      bird.children.forEach(wing => wing.rotation.z = Number(wing.userData.side) * Math.sin(t * 5 + i) * .65);
    });
    this.fabrics.forEach((flag, i) => flag.rotation.x = Math.sin(t * 1.8 + i * .7) * .17);
    this.dust.position.y = Math.sin(t * .15) * .15;
  }
  dispose() { this.root.removeFromParent(); this.resources.forEach(resource => resource.dispose()); }
}
